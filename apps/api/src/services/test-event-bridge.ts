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

const execFileAsync = promisify(execFile);

const RECEIVER_CLASS = "com.arasdigital.nesymobile.adb.ProtectedRequestKeyReceiver";
const ACTION_SET_RUN = "com.arasdigital.nesymobile.SET_RUN";
const ACTION_GET_STATE = "com.arasdigital.nesymobile.GET_STATE";
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

    return {
      v: typeof parsed.v === "number" ? parsed.v : 0,
      runId: typeof parsed.runId === "string" ? parsed.runId : "",
      sessionId: parsed.sessionId,
      seq: typeof parsed.seq === "number" ? parsed.seq : -1,
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
    if (event.seq < 0) return true; // malformed seq — let it through for diagnostics
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
 */
export async function broadcastSetRun(deviceId: string, appId: string, runId: string): Promise<boolean> {
  try {
    const stdout = await adbShell(deviceId, [
      "am", "broadcast",
      "-n", `${appId}/${RECEIVER_CLASS}`,
      "-a", ACTION_SET_RUN,
      "--es", "run_id", runId === "" ? "''" : runId,
    ]);
    return stdout.includes("result=-1"); // Activity.RESULT_OK
  } catch (err) {
    console.warn(`[TestEventBridge] SET_RUN broadcast failed:`, err instanceof Error ? err.message : err);
    return false;
  }
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
  try {
    const stdout = await adbShell(deviceId, [
      "am", "broadcast",
      "-n", `${appId}/${RECEIVER_CLASS}`,
      "-a", ACTION_GET_STATE,
    ]);
    return parseGetStateOutput(stdout);
  } catch (err) {
    console.warn(`[TestEventBridge] GET_STATE failed:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Parses `am broadcast` output:
 * `Broadcast completed: result=-1, data="{...json...}"`
 * result=-1 is Activity.RESULT_OK; the mobile watchdog answers RESULT_CANCELED with
 * `ERROR:STATE_TIMEOUT` on a hung DB query.
 */
export function parseGetStateOutput(stdout: string): DeviceBridgeState | null {
  if (!stdout.includes("result=-1")) return null;

  const dataMatch = stdout.match(/data="([\s\S]*)"/);
  if (!dataMatch?.[1]) return null;

  const payload = dataMatch[1].trim();
  if (!payload.startsWith("{")) return null;

  try {
    const raw = JSON.parse(payload) as Record<string, unknown>;
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
  } catch {
    return null;
  }
}

function parseBooleanish(value: unknown): boolean | null {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return null;
}
