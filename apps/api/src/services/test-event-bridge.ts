/**
 * Test Event Bridge — orchestrator side of the mobile structured-event contract.
 *
 * Mobile counterpart: NesyMobile `automation/` package (dual-emit period).
 * Contract document: NesyMobile `docs/test-event-bridge-mapping.md`.
 *
 * Covers the cockpit-side responsibilities of the contract:
 * - runId lifecycle over the `debug.nesy.run_id` system property (set before launch,
 *   clear at run end — a stale prop would tag tomorrow's manual session with today's runId)
 * - SET_RUN broadcast (tags an already-running process without waiting for a restart)
 * - GET_STATE synchronous pull (replaces waiting 10-15s on CHECK_LOGIN/CHECK_ROUTE logcat)
 * - `NESY_TEST_EVENT|{json}` line parsing + (runId, sessionId, seq) dedupe
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
  NO_SECRET,
  newRequestId,
  type Secret,
} from "@nesy/control-contract";
import { parseBroadcastPayload } from "@nesy/control-channels";
import { createControlExecutor } from "@nesy/control-channels/node";
import { RunSecretRegistry } from "./run-secret-registry.js";

const execFileAsync = promisify(execFile);

// Receiver class names and action strings USED TO LIVE HERE. They now live in
// `@nesy/control-channels` (C.9) — Faz 4 deletes both receivers on the mobile
// side, and a hardcoded copy in this file would have broken silently.
const RUN_ID_PROP = "debug.nesy.run_id";

/** Mobile watchdog finishes GET_STATE within 5s; give the broadcast a little headroom. */
const BROADCAST_TIMEOUT_MS = 8_000;
const LINE_PREFIX = "NESY_TEST_EVENT|";

// ─────────────────────────────────────────────────────────────────────────────
// Event schema (v=1) — mirrors NesyMobile TestEventModel
// ─────────────────────────────────────────────────────────────────────────────

export interface TestBridgeEvent {
  v: number;
  runId: string;
  sessionId: string;
  seq: number;
  ts: number;
  monoTs: number;
  screen: string;
  /** New taxonomy name (STATE_LOGIN, DELIVERY_PERSISTED, LEGACY, ...). */
  event: string;
  /** Legacy AutomationAction — only set for events mapped from legacy emits. */
  action?: string;
  status?: string;
  taskId: string;
  shipmentId?: string;
  requestId?: string;
  success?: boolean;
  durationMs?: number;
  /** Additive B.5.1 correlation fields emitted by the Verdict SDK. */
  spanId?: string;
  parentSpanId?: string;
  data?: Record<string, string | null>;
  /** Original logcat line, for diagnostics. */
  raw: string;
}

/** Parses one logcat line carrying a `NESY_TEST_EVENT|{json}` payload. */
export function parseTestEventLine(line: string): TestBridgeEvent | null {
  const idx = line.indexOf(LINE_PREFIX);
  if (idx === -1) return null;

  const json = line.slice(idx + LINE_PREFIX.length).trim();
  if (!json.startsWith("{")) return null;

  try {
    const parsed = JSON.parse(json) as Record<string, unknown>;
    if (typeof parsed.event !== "string" || typeof parsed.sessionId !== "string") return null;

    // `v` 1 or 2 (plan Faz 0.2). v2 only ADDS optional fields, so a v1 parser
    // reading a v2 line is correct — but an unknown MAJOR version is not
    // something to guess at.
    const version = typeof parsed.v === "number" ? parsed.v : 0;
    if (version !== 1 && version !== 2) {
      console.warn(`[TestEventBridge] rejecting event with unsupported v=${String(parsed.v)}`);
      return null;
    }

    // A missing seq used to become -1, and TestEventDeduper lets seq < 0 through
    // unconditionally "for diagnostics". Together those two silently DISABLED
    // dedupe for the malformed event — the one case where a replay is most
    // likely. Reject loudly instead (plan Faz 0.2).
    if (typeof parsed.seq !== "number" || !Number.isInteger(parsed.seq) || parsed.seq < 1) {
      console.warn(
        `[TestEventBridge] rejecting event without a usable seq: ` +
          `event=${parsed.event} seq=${String(parsed.seq)}`,
      );
      return null;
    }

    return {
      v: version,
      runId: typeof parsed.runId === "string" ? parsed.runId : "",
      sessionId: parsed.sessionId,
      seq: parsed.seq,
      ts: typeof parsed.ts === "number" ? parsed.ts : 0,
      monoTs: typeof parsed.monoTs === "number" ? parsed.monoTs : 0,
      screen: typeof parsed.screen === "string" ? parsed.screen : "",
      event: parsed.event,
      action: typeof parsed.action === "string" ? parsed.action : undefined,
      status: typeof parsed.status === "string" ? parsed.status : undefined,
      taskId: typeof parsed.taskId === "string" ? parsed.taskId : "",
      shipmentId: typeof parsed.shipmentId === "string" ? parsed.shipmentId : undefined,
      requestId: typeof parsed.requestId === "string" ? parsed.requestId : undefined,
      success: typeof parsed.success === "boolean" ? parsed.success : undefined,
      durationMs: typeof parsed.durationMs === "number" ? parsed.durationMs : undefined,
      spanId: typeof parsed.spanId === "string" ? parsed.spanId : undefined,
      parentSpanId:
        typeof parsed.parentSpanId === "string" ? parsed.parentSpanId : undefined,
      data: isStringRecord(parsed.data) ? parsed.data : undefined,
      raw: line,
    };
  } catch {
    return null;
  }
}

function isStringRecord(value: unknown): value is Record<string, string | null> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * (runId, sessionId, seq) dedupe. seq is strictly monotonic per session on the mobile
 * side, so tracking the highest seen seq per session is sufficient. Protects against
 * WebSocket ring-buffer replays (Phase 3) and stale buffered logcat lines.
 */
export class TestEventDeduper {
  private lastSeqBySession = new Map<string, number>();

  /** Returns true when the event is fresh; false for duplicates/replays. */
  accept(event: TestBridgeEvent): boolean {
    // There used to be a `seq < 0 -> return true` bypass "for diagnostics". Paired
    // with the parser turning a missing seq into -1, it DISABLED dedupe for exactly
    // the malformed events most likely to be replays. The parser now rejects such
    // lines outright, so the bypass is both dead and misleading — removed.
    const key = `${event.runId}|${event.sessionId}`;
    const last = this.lastSeqBySession.get(key);
    if (last !== undefined && event.seq <= last) return false;
    this.lastSeqBySession.set(key, event.seq);
    return true;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Control plane: runId sysprop + broadcasts
// ─────────────────────────────────────────────────────────────────────────────

async function adbShell(deviceId: string, args: string[], timeoutMs = BROADCAST_TIMEOUT_MS): Promise<string> {
  const result = await execFileAsync("adb", ["-s", deviceId, "shell", ...args], {
    timeout: timeoutMs,
    maxBuffer: 1024 * 1024,
  });
  return String(result.stdout);
}

/**
 * Control-plane executor (C.9). Receiver class names and action strings live in
 * `@nesy/control-channels`, not here. Faz 8.1b nonce detection requires Verdict
 * and fails closed when its ping cannot be proven.
 */
function control(appId: string) {
  return createControlExecutor({ applicationId: appId });
}

/** Envelope for a one-shot control call. */
function envelope(deviceId: string, tag: string) {
  return { requestId: newRequestId(tag), scope: `${tag}:${deviceId}` };
}

/**
 * Writes the runId system property. The mobile app restores it in Application.onCreate,
 * so the runId survives mid-run app restarts (clearState nodes, crash recovery).
 * Call BEFORE launching the app; pass "" at run end (stale-prop cleanup).
 */
export async function setRunIdProperty(deviceId: string, runId: string): Promise<boolean> {
  try {
    // Empty value must reach the device shell as an empty argument.
    await adbShell(deviceId, ["setprop", RUN_ID_PROP, runId === "" ? "''" : runId]);
    return true;
  } catch (err) {
    console.warn(`[TestEventBridge] setprop ${RUN_ID_PROP} failed:`, err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * SET_RUN broadcast — tags an already-running app process with the runId (the sysprop
 * is only read at process start). Best-effort: an app that is not yet installed/running
 * still gets the runId from the sysprop on its next cold start.
 *
 * `wsEnabled` additionally instructs the app to (re)connect its WebSocket test
 * event sink to the host (through `adb reverse`) without waiting for a cold start.
 */
export async function broadcastSetRun(
  deviceId: string,
  appId: string,
  runId: string,
  options?: {
    wsEnabled?: boolean;
    wsPort?: number;
    skipDeliveryWait?: boolean;
    /** WS handshake sahibi önceden ürettiyse aynı typed secret geçirilir. */
    secret?: Secret;
  },
): Promise<boolean> {
  // Verdict ControlReceiver 32-byte base64url bootstrap secret ister. Legacy
  // kanal bu typed alanı taşımadığı için aynı op eski build'lerde değişmeden
  // çalışır. Empty runId yalnız detach'tir; yeni bir güven kökü kurmaz.
  const secret =
    runId === ""
      ? NO_SECRET
      : (options?.secret ?? RunSecretRegistry.issue({ runId, deviceId, appId }));
  const res = await control(appId).run(deviceId, {
    ...envelope(deviceId, "set-run"),
    op: "set_run",
    runId,
    secret,
    wakeStopped: true,
    ...(options?.wsEnabled
      ? { wsEnabled: true, wsPort: options.wsPort ?? 8765 }
      : {}),
    // Automation-only: flush the mobile ~120s "two-minute" delivery/pickup queue wait so the
    // backend leg (DELIVERY_RESPONSE_RECEIVED / BACKEND_CONFIRMED) confirms within seconds.
    // App-side setter is gated by AUTOMATION_BRIDGE_ENABLED, so it is a no-op on prod builds.
    ...(options?.skipDeliveryWait ? { skipDeliveryWait: true } : {}),
  });
  if (!res.ok) {
    console.warn(`[TestEventBridge] SET_RUN broadcast failed: ${res.code}`, res.detail ?? "");
    return false;
  }
  return true;
}

/**
 * SEED_STATE `select_route` — programmatically picks a route in the live "Please
 * Select Route" dialog via the Verdict `seed` built-in, replacing a fragile
 * scroll+tap. Returns the mobile result string (e.g. `OK:36`,
 * `ERROR:ROUTE_DIALOG_NOT_SHOWN`, `ERROR:ROUTE_NOT_FOUND:36`, `ERROR:NOT_ON_STOPLIST`)
 * or null when the broadcast itself failed. The caller decides how to surface a
 * non-OK result; the run then fails naturally because the route dialog stays up
 * and BridgeFlow wait evidence times out.
 */
export async function broadcastSelectRoute(
  deviceId: string,
  appId: string,
  route: string,
): Promise<{ ok: boolean; result: string } | null> {
  const res = await control(appId).run(deviceId, {
    ...envelope(deviceId, "select-route"),
    op: "seed",
    verb: "select_route",
    params: { route },
  });
  // `CHANNEL_UNAVAILABLE` = the broadcast itself never landed → null, exactly as
  // the old `catch` branch did. Every other code is a real mobile-side answer and
  // is surfaced through `raw` so callers keep seeing `ERROR:ROUTE_NOT_FOUND:36`.
  if (!res.ok && res.code === "CHANNEL_UNAVAILABLE") {
    console.warn(`[TestEventBridge] select_route broadcast failed: ${res.code}`, res.detail ?? "");
    return null;
  }
  return res.ok
    ? { ok: true, result: res.data.raw?.trim() ?? "OK" }
    : { ok: false, result: res.raw?.trim() ?? "" };
}

/**
 * Verdict `seed/login` — programmatically logs in with a PIN via the control SDK.
 * Mirrors broadcastSelectRoute.
 *
 * MOBILE CONTRACT:
 *   Verdict built-in seed verb `login`, sensitive PIN sidecar
 *   → drive LoginFragment's real login code path with the PIN, on the main thread.
 *   Return `OK:login` (RESULT_OK) or `ERROR:NOT_ON_LOGIN` / `ERROR:NO_PIN` / `ERROR:LOGIN_FAILED:<detail>`.
 *
 * Returns the mobile result string, or null when the broadcast itself failed.
 */
export async function broadcastLogin(
  deviceId: string,
  appId: string,
  pin: string,
): Promise<{ ok: boolean; result: string } | null> {
  const res = await control(appId).run(deviceId, {
    ...envelope(deviceId, "login"),
    op: "seed",
    verb: "login",
    params: { pin },
  });
  if (!res.ok && res.code === "CHANNEL_UNAVAILABLE") {
    console.warn(`[TestEventBridge] login broadcast failed: ${res.code}`, res.detail ?? "");
    return null;
  }
  return res.ok
    ? { ok: true, result: res.data.raw?.trim() ?? "OK" }
    : { ok: false, result: res.raw?.trim() ?? "" };
}

/** Snapshot returned by the mobile GET_STATE control-plane query. */
export interface DeviceBridgeState {
  isLoggedIn: boolean | null;
  routeSelected: boolean | null;
  routeName: string;
  scheduleLoaded: boolean | null;
  scheduleId: string;
  currentScreen: string;
  runId: string;
  sessionId: string;
  raw: Record<string, unknown>;
}

/**
 * GET_STATE synchronous pull — replaces waiting on CHECK_LOGIN/CHECK_ROUTE logcat events
 * for branching. Returns null when the query fails (old app build without GET_STATE,
 * device offline, mobile-side timeout) — callers must fall back to the legacy logcat wait.
 */
export async function getDeviceBridgeState(deviceId: string, appId: string): Promise<DeviceBridgeState | null> {
  const res = await control(appId).run(deviceId, {
    ...envelope(deviceId, "get-state"),
    op: "get_state",
  });
  if (!res.ok) {
    console.warn(`[TestEventBridge] GET_STATE failed: ${res.code}`, res.detail ?? "");
    return null;
  }
  return mapBridgeState(res.data);
}

/**
 * Parses `am broadcast` output:
 * `Broadcast completed: result=-1, data="{...json...}"`
 * result=-1 is Activity.RESULT_OK; the mobile watchdog answers RESULT_CANCELED with
 * `ERROR:STATE_TIMEOUT` on a hung DB query.
 */
export function parseGetStateOutput(stdout: string): DeviceBridgeState | null {
  if (!stdout.includes("result=-1")) return null;

  const payload = parseBroadcastPayload(stdout)?.trim();
  if (!payload?.startsWith("{")) return null;

  try {
    return mapBridgeState(JSON.parse(payload) as Record<string, unknown>);
  } catch {
    return null;
  }
}

/**
 * Mobile `GET_STATE` JSON → this module's snapshot shape.
 *
 * Split out of `parseGetStateOutput` so the control-plane path (which already
 * receives parsed JSON from the contract) and the raw-stdout path share ONE
 * field mapping. Two copies would drift the moment the mobile side adds a field.
 */
function mapBridgeState(raw: Record<string, unknown>): DeviceBridgeState {
  return {
    isLoggedIn: parseBooleanish(raw.is_logged_in),
    routeSelected: parseBooleanish(raw.route_selected),
    routeName: typeof raw.route_name === "string" ? raw.route_name : "",
    scheduleLoaded: parseBooleanish(raw.schedule_loaded),
    scheduleId: typeof raw.schedule_id === "string" ? raw.schedule_id : "",
    currentScreen: typeof raw.current_screen === "string" ? raw.current_screen : "",
    runId: typeof raw.run_id === "string" ? raw.run_id : "",
    sessionId: typeof raw.session_id === "string" ? raw.session_id : "",
    raw,
  };
}

function parseBooleanish(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return null;
}
