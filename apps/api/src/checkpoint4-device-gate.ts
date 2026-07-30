/**
 * CHECKPOINT 4 local-only device gate. Do not commit.
 *
 * It wraps the real durable TestEventWsServer with the Faz 4 mutual-HMAC host
 * proof, then exercises the real Cockpit VerdictChannel against the fixed USB
 * device. Sensitive values are held in memory and never printed.
 */
import "dotenv/config";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { WebSocket, WebSocketServer } from "ws";
import {
  VerdictChannel,
  detectChannel,
  invalidateDetectedChannel,
  type AdbRunner,
} from "../../../packages/control-channels/src/index.js";
import { createNodeAdbRunner } from "../../../packages/control-channels/src/node-executor.js";
import { asSecret } from "../../../packages/control-contract/src/index.js";
import { TestEventWsServer } from "./services/test-event-ws-server.js";

const serial = "R6CW400BC8N";
const applicationId = "com.arasdigital.nesymobile.rstest";
const shipmentId = "32562939073268";
const runId = `checkpoint4-${Date.now()}`;
const scope = runId;
const secretBytes = randomBytes(32);
const secret = asSecret(secretBytes.toString("base64url"));

type JsonObject = Record<string, unknown>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function lp(value: string): Buffer {
  const bytes = Buffer.from(value, "utf8");
  const length = Buffer.allocUnsafe(4);
  length.writeUInt32BE(bytes.length);
  return Buffer.concat([length, bytes]);
}

function signature(
  direction: "app->host" | "host->app",
  hello: JsonObject,
): string {
  const message = Buffer.concat([
    lp("verdict-hmac-v1"),
    lp(direction),
    lp(String(hello.runId)),
    lp(String(hello.sessionId)),
    lp(String(hello.nonce)),
    lp(String(hello.ts)),
  ]);
  return createHmac("sha256", secretBytes).update(message).digest("base64url");
}

function signatureMatches(expected: string, supplied: unknown): boolean {
  if (typeof supplied !== "string") return false;
  const expectedBytes = Buffer.from(expected, "base64url");
  const suppliedBytes = Buffer.from(supplied, "base64url");
  return (
    expectedBytes.length === suppliedBytes.length &&
    timingSafeEqual(expectedBytes, suppliedBytes)
  );
}

function parseJson(text: string): JsonObject | null {
  try {
    const value = JSON.parse(text) as unknown;
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as JsonObject)
      : null;
  } catch {
    return null;
  }
}

const adb: AdbRunner = createNodeAdbRunner();

async function adbRun(args: string[], timeoutMs = 15_000): Promise<string> {
  return adb(serial, ["-s", serial, ...args], timeoutMs);
}

function summarizeResult(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  const result = value as Record<string, unknown>;
  if (result.ok !== true) return value;
  const data =
    result.data !== null && typeof result.data === "object"
      ? (result.data as Record<string, unknown>)
      : null;
  if (data && typeof data.key === "string") {
    return { ok: true, data: { keyPresent: data.key.length > 0, keyLength: data.key.length } };
  }
  return value;
}

function check(name: string, value: unknown): void {
  console.log(`CHECK|${name}|${JSON.stringify(summarizeResult(value))}`);
}

async function waitFor(
  predicate: () => boolean,
  timeoutMs: number,
  intervalMs = 50,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await sleep(intervalMs);
  }
  return predicate();
}

async function rawReceiver(
  cmd: string,
  requestId: string,
  params: Record<string, string> = {},
): Promise<string> {
  const nonce = randomBytes(16).toString("hex");
  const extras = Object.entries(params).flatMap(([key, value]) => [
    "--es",
    key,
    value,
  ]);
  return adbRun([
    "shell",
    "am",
    "broadcast",
    "-n",
    `${applicationId}/com.verdict.sdk.core.VerdictControlReceiver`,
    "-a",
    `${applicationId}.VERDICT_CMD`,
    "--es",
    "op",
    cmd,
    "--es",
    "cmd",
    cmd,
    "--es",
    "requestId",
    requestId,
    "--es",
    "scope",
    scope,
    "--es",
    "nonce",
    nonce,
    ...extras,
  ]);
}

async function rawDump(command: string, requestId: string): Promise<string> {
  const nonce = randomBytes(16).toString("hex");
  return adbRun([
    "shell",
    "dumpsys",
    "activity",
    "provider",
    `${applicationId}/com.verdict.sdk.core.VerdictDumpProvider`,
    `--verdict-command=${command}`,
    `--request-id=${requestId}`,
    `--scope=${scope}`,
    `--nonce=${nonce}`,
  ]);
}

let authenticated = false;
let appSignatureValid = false;
let helloFullCount = 0;
let wsSetRunResponse: JsonObject | null = null;
const screenFrames: JsonObject[] = [];
const sockets = new Set<WebSocket>();

TestEventWsServer.ensureStarted();
const server = (
  TestEventWsServer as unknown as { server: WebSocketServer | null }
).server;
if (!server) throw new Error("Cockpit durable WS server did not start");

server.on("connection", (socket) => {
  sockets.add(socket);
  socket.on("close", () => sockets.delete(socket));
  socket.on("message", (data) => {
    const frame = parseJson(String(data));
    if (!frame) return;
    if (frame.type === "hello") {
      const expectedApp = signature("app->host", frame);
      appSignatureValid = signatureMatches(expectedApp, frame.sig);
      check("ws_app_signature_valid", appSignatureValid);
      if (!appSignatureValid) return;
      socket.send(
        JSON.stringify({
          type: "auth",
          runId: frame.runId,
          sessionId: frame.sessionId,
          nonce: frame.nonce,
          ts: frame.ts,
          sig: signature("host->app", frame),
        }),
      );
      return;
    }
    if (frame.type === "hello_full") {
      authenticated = true;
      helloFullCount += 1;
      check("ws_hello_full", {
        runId: frame.runId,
        sessionId: frame.sessionId,
        count: helloFullCount,
      });
      return;
    }
    if (
      typeof frame.type === "string" &&
      frame.requestId === "ws-set-run-denied"
    ) {
      wsSetRunResponse = frame;
      check("ws_set_run_frame", frame);
    }
    if (
      typeof frame.event === "string" &&
      (frame.event.startsWith("SCREEN_") ||
        frame.event === "STATE_ROUTE" ||
        frame.event === "BRIDGE_INIT")
    ) {
      const compact = {
        event: frame.event,
        runId: frame.runId,
        sessionId: frame.sessionId,
        seq: frame.seq,
        screen: frame.screen,
        state: frame.state,
      };
      screenFrames.push(compact);
      check("sdk_event", compact);
    }
  });
});

if (!server.address()) {
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
}

check("host_listening", server.address());
await waitFor(() => TestEventWsServer.isIngestReady(), 5_000);
check("durable_ingest_ready", TestEventWsServer.isIngestReady());
await adbRun(["reverse", "tcp:8765", "tcp:8765"]);
check("adb_reverse", (await adbRun(["reverse", "--list"])).trim());

const ctx = { applicationId, adb };
invalidateDetectedChannel(serial, ctx);
const detected = await detectChannel(serial, ctx);
check("detectChannel", detected);
const channel = new VerdictChannel();

await adbRun(["logcat", "-c"]);
const setRun = await channel.run(serial, {
  op: "set_run",
  requestId: "set-run-device",
  scope,
  runId,
  secret,
  wsEnabled: true,
  wsPort: 8765,
  skipDeliveryWait: false,
  wakeStopped: true,
}, ctx);
check("set_run", setRun);

const authObserved = await waitFor(() => authenticated, 8_000);
check("ws_authenticated", {
  observed: authObserved,
  appSignatureValid,
  helloFullCount,
});

await adbRun([
  "shell",
  "am",
  "start",
  "-W",
  "-n",
  `${applicationId}/com.arasdigital.nesymobile.SplashActivity`,
]);
await sleep(3_000);

check(
  "get_request_key",
  await channel.run(serial, {
    op: "get_request_key",
    requestId: "get-key-device",
    scope,
  }, ctx),
);
check(
  "get_state_before",
  await channel.run(serial, {
    op: "get_state",
    requestId: "get-state-before",
    scope,
  }, ctx),
);

const getRunStarted = performance.now();
const getRun = await channel.run(serial, {
  op: "get_run",
  requestId: "get-run-device",
  scope,
}, ctx);
check("get_run", { elapsedMs: performance.now() - getRunStarted, result: getRun });

check("ping", (await rawReceiver("ping", "ping-device")).trim());
check("get_health", (await rawReceiver("get_health", "get-health-device")).trim());

const openOp = {
  op: "seed" as const,
  requestId: "open-delivery-device",
  scope,
  verb: "open_delivery",
  params: { shipment_id: shipmentId },
};
const openFirst = await channel.run(serial, openOp, ctx);
check("open_delivery_first", openFirst);
const openDuplicate = await channel.run(serial, openOp, ctx);
check("open_delivery_duplicate", openDuplicate);
await sleep(4_000);

check(
  "get_state_after",
  await channel.run(serial, {
    op: "get_state",
    requestId: "get-state-after",
    scope,
  }, ctx),
);

const screenStarted = performance.now();
const screen = await channel.run(serial, {
  op: "get_screen_state",
  requestId: "screen-device",
  scope,
}, ctx);
check("dump_screen_state", {
  elapsedMs: performance.now() - screenStarted,
  result: screen,
});

const heavyStarted = performance.now();
const heavy = await rawDump("set_run", "dump-heavy-rejected");
check("dump_heavy_rejected", {
  elapsedMs: performance.now() - heavyStarted,
  output: heavy.trim(),
});

for (const socket of sockets) {
  if (socket.readyState === socket.OPEN) {
    socket.send(
      JSON.stringify({
        cmd: "set_run",
        requestId: "ws-set-run-denied",
        scope,
        params: {
          runId: "ws-must-not-apply",
          secret: randomBytes(32).toString("base64url"),
        },
      }),
    );
  }
}
await waitFor(() => wsSetRunResponse !== null, 3_000);
check("ws_set_run_denied", wsSetRunResponse ?? { response: "missing" });
const runAfterWsDenial = await channel.run(serial, {
  op: "get_run",
  requestId: "get-run-after-ws-denial",
  scope,
}, ctx);
const observedRunAfterWsDenial =
  runAfterWsDenial.ok &&
  runAfterWsDenial.data !== null &&
  typeof runAfterWsDenial.data === "object" &&
  "runId" in runAfterWsDenial.data
    ? runAfterWsDenial.data.runId
    : null;
check("ws_set_run_secret_not_applied", {
  expectedRunId: runId,
  observedRunId: observedRunAfterWsDenial,
  unchanged: observedRunAfterWsDenial === runId,
});
check("screen_event_count", screenFrames.length);

const foreground = await adbRun([
  "shell",
  "dumpsys",
  "activity",
  "activities",
]);
check(
  "foreground_activity",
  foreground
    .split("\n")
    .filter((line) =>
      /topResumedActivity|mResumedActivity|DeliveryFragment|StopListFragment|nesymobile\.rstest/.test(
        line,
      ),
    )
    .slice(0, 20),
);

for (const socket of sockets) socket.close(1000, "checkpoint complete");
await new Promise<void>((resolve) => server.close(() => resolve()));
const fullLogcat = await adbRun(["logcat", "-d", "-v", "threadtime"]);
check("full_logcat_secret_absent", !fullLogcat.includes(secret));
const walSecretScan = await adb(
  serial,
  [
    "-s",
    serial,
    "exec-out",
    "run-as",
    applicationId,
    "sh",
    "-c",
    "if grep -R -F -f - no_backup/verdict/wal >/dev/null 2>&1; then echo found; else echo absent; fi",
  ],
  15_000,
  secret,
);
check("wal_secret_absent", walSecretScan.trim() === "absent");
check(
  "sensitive_sidecars_remaining",
  (
    await adbRun([
      "shell",
      `run-as ${applicationId} sh -c 'find no_backup/verdict/control -type f 2>/dev/null | wc -l'`,
    ])
  ).trim(),
);
secretBytes.fill(0);
process.exit(0);
