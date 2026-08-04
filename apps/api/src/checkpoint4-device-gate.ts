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
} from "@nesy/control-channels";
import { createNodeAdbRunner } from "@nesy/control-channels/node";
import { asSecret } from "@nesy/control-contract";
import { prisma } from "@nesy/db";
import { LogcatSniffer } from "./services/logcat-sniffer.js";
import type { TestBridgeEvent } from "./services/test-event-bridge.js";
import { TestEventWsServer } from "./services/test-event-ws-server.js";

const serial = process.env.VERDICT_DEVICE_SERIAL ?? "R6CW400BC8N";
const applicationId =
  process.env.VERDICT_APPLICATION_ID ?? "com.arasdigital.nesymobile.rstest";
const shipmentId = process.env.VERDICT_SHIPMENT_ID ?? "32562939073268";
const runId = `checkpoint4-${Date.now()}`;
const preflightRunId = `checkpoint4-preflight-${Date.now()}`;
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

function nestedScreenHealth(result: unknown): JsonObject | null {
  if (result === null || typeof result !== "object") return null;
  const data = (result as JsonObject).data;
  if (data === null || typeof data !== "object") return null;
  const state = (data as JsonObject).state;
  if (state === null || typeof state !== "object") return null;
  const screenState = (state as JsonObject).screen;
  if (screenState === null || typeof screenState !== "object") return null;
  const health = (screenState as JsonObject).health;
  return health !== null && typeof health === "object"
    ? (health as JsonObject)
    : null;
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

async function waitForAsync(
  predicate: () => Promise<boolean>,
  timeoutMs: number,
  intervalMs = 100,
): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
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
const eventFrames: JsonObject[] = [];
const eventAcks: JsonObject[] = [];
const oracleFrames: TestBridgeEvent[] = [];
const sockets = new Set<WebSocket>();

// This is the same structured sink seam OracleEngine attaches to in a normal
// Cockpit workflow run. No logcat process is needed: the real WS server injects
// committed wire events into the sniffer during the current dual-write phase.
const oracleSniffer = new LogcatSniffer({ deviceId: serial, runId });
oracleSniffer.on("test_event", (event: TestBridgeEvent) => {
  oracleFrames.push(event);
});
TestEventWsServer.addSink(oracleSniffer);

TestEventWsServer.ensureStarted();
const server = (
  TestEventWsServer as unknown as { server: WebSocketServer | null }
).server;
if (!server) throw new Error("Cockpit durable WS server did not start");

server.on("connection", (socket) => {
  sockets.add(socket);
  socket.on("close", () => sockets.delete(socket));

  // Observe the real post-COMMIT ACKs without replacing the server's ingest
  // path. The wrapper delegates byte-for-byte to ws after recording metadata.
  const originalSend = socket.send;
  socket.send = (function (
    this: WebSocket,
    data: unknown,
    ...args: unknown[]
  ) {
    const outgoing = parseJson(String(data));
    if (outgoing?.type === "event_ack") eventAcks.push(outgoing);
    return Reflect.apply(originalSend, this, [data, ...args]);
  }) as WebSocket["send"];

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
    if (typeof frame.event === "string" && frame.runId === runId) {
      eventFrames.push({
        event: frame.event,
        runId: frame.runId,
        sessionId: frame.sessionId,
        seq: frame.seq,
        screen: frame.screen,
      });
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

// A same-port socket left behind by an already-running app is intentionally a
// no-op in the transport. Start this gate from a cold process so bootstrap sees
// the listening host and set_run can authenticate that fresh connection.
const retiredWalFiles = (
  await adbRun([
    "shell",
    `run-as ${applicationId} sh -c 'grep -l -F "checkpoint4-" no_backup/verdict/wal/seg-*.wal 2>/dev/null || true'`,
  ])
)
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);
check("preflight_retired_wal_files", retiredWalFiles);
await adbRun(["shell", "am", "force-stop", applicationId]);
await adbRun(["logcat", "-c"]);
const preflightSetRun = await channel.run(serial, {
  op: "set_run",
  requestId: "set-run-preflight",
  scope: preflightRunId,
  runId: preflightRunId,
  secret,
  wsEnabled: true,
  wsPort: 8765,
  skipDeliveryWait: false,
  wakeStopped: true,
}, ctx);
check("preflight_set_run", preflightSetRun);

const preflightAuthenticated = await waitFor(() => authenticated, 8_000);
check("preflight_ws_authenticated", {
  observed: preflightAuthenticated,
  appSignatureValid,
  helloFullCount,
});

let preflightHealthAttempt = 0;
const preflightWalReady = await waitForAsync(async () => {
  preflightHealthAttempt += 1;
  const snapshot = await channel.run(serial, {
    op: "get_screen_state",
    requestId: `preflight-health-${preflightHealthAttempt}`,
    scope: preflightRunId,
  }, ctx);
  return nestedScreenHealth(snapshot)?.wal === "ok";
}, 20_000, 750);
check("preflight_wal_ready", preflightWalReady);

const helloCountBeforeRun = helloFullCount;
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
const authObserved = await waitFor(
  () => helloFullCount > helloCountBeforeRun,
  8_000,
);
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
await waitFor(
  () =>
    oracleFrames.some(
      (frame) =>
        frame.event === "SCREEN_READY" && frame.screen === "DeliveryFragment",
    ) &&
    oracleFrames.some((frame) => frame.event === "DELIVERY_STARTED") &&
    oracleFrames.some((frame) => frame.event === "HTTP_CALL"),
  10_000,
  100,
);

const expectedOracleSignals = [
  {
    name: "SCREEN_READY:StopListFragment",
    observed: oracleFrames.some(
      (frame) =>
        frame.event === "SCREEN_READY" && frame.screen === "StopListFragment",
    ),
  },
  {
    name: "DELIVERY_STARTED",
    observed: oracleFrames.some((frame) => frame.event === "DELIVERY_STARTED"),
  },
  {
    name: "SCREEN_READY:DeliveryFragment",
    observed: oracleFrames.some(
      (frame) =>
        frame.event === "SCREEN_READY" && frame.screen === "DeliveryFragment",
    ),
  },
  {
    name: "HTTP_CALL",
    observed: oracleFrames.some((frame) => frame.event === "HTTP_CALL"),
  },
];
const oracleMissing = expectedOracleSignals
  .filter((signal) => !signal.observed)
  .map((signal) => signal.name);
const oraclePostCommit =
  oracleFrames.length > 0 &&
  oracleFrames.every((frame) => frame.raw.startsWith("DB|"));
const oracleVerdict = {
  complete: oracleMissing.length === 0 && oraclePostCommit,
  missing: oracleMissing,
  source: oraclePostCommit ? "durable_post_commit" : "pre_commit_or_mixed",
  observed: expectedOracleSignals
    .filter((signal) => signal.observed)
    .map((signal) => signal.name),
};
check("oracle_verdict", oracleVerdict);

const deliveryStartedCount = eventFrames.filter(
  (frame) => frame.event === "DELIVERY_STARTED",
).length;
const deliveryReadyCount = eventFrames.filter(
  (frame) =>
    frame.event === "SCREEN_READY" && frame.screen === "DeliveryFragment",
).length;
const commandExecutedOnce =
  openFirst.ok &&
  openDuplicate.ok &&
  deliveryStartedCount === 1 &&
  deliveryReadyCount === 1;
check("open_delivery_executed_once", {
  commandExecutedOnce,
  deliveryStartedCount,
  deliveryReadyCount,
});

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
const verticalHealth = nestedScreenHealth(screen);
const verticalWalHealthy =
  verticalHealth?.wal === "ok" && Number(verticalHealth.droppedSince ?? -1) === 0;
check("vertical_slice_wal_health", {
  healthy: verticalWalHealthy,
  wal: verticalHealth?.wal ?? null,
  droppedSince: verticalHealth?.droppedSince ?? null,
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

// Rotate once more while the socket is still authenticated. This seals the
// vertical-slice stream, replays any tail, receives cumulative ACKs, and gives
// AckedSegmentSweeper a chance to remove that stream's WAL segment.
const helloCountBeforeCleanup = helloFullCount;
const cleanupRunId = `checkpoint4-cleanup-${Date.now()}`;
const cleanupSetRun = await channel.run(serial, {
  op: "set_run",
  requestId: "set-run-cleanup",
  // Register the rollover command in the incoming run's scope. Using the
  // retiring scope lets onScopeRetired cancel its own response after the
  // rollover has already succeeded on-device.
  scope: cleanupRunId,
  runId: cleanupRunId,
  secret,
  wsEnabled: true,
  wsPort: 8765,
  skipDeliveryWait: false,
  wakeStopped: true,
}, ctx);
check("cleanup_set_run", cleanupSetRun);
const cleanupAuthenticated = await waitFor(
  () => helloFullCount > helloCountBeforeCleanup,
  8_000,
);
check("cleanup_ws_authenticated", cleanupAuthenticated);

const walCleared = await waitForAsync(async () => {
  const result = await adbRun([
    "shell",
    `run-as ${applicationId} sh -c 'if grep -l -F -- "${runId}" no_backup/verdict/wal/seg-*.wal >/dev/null 2>&1; then echo present; else echo absent; fi'`,
  ]);
  return result.trim() === "absent";
}, 15_000, 250);
check("vertical_slice_wal_cleared", walCleared);

const fanoutDrained = await waitForAsync(async () => {
  const remaining = await prisma.verdictInbox.count({
    where: { runId, processedAt: null },
  });
  return remaining === 0;
}, 8_000, 100);
check("durable_fanout_drained", fanoutDrained);

const stream = await prisma.verdictStream.findFirst({ where: { runId } });
const inboxRows = await prisma.verdictInbox.findMany({
  where: { runId },
  orderBy: { seq: "asc" },
  select: { seq: true, payload: true, processedAt: true },
});
const gaps = await prisma.verdictGap.findMany({ where: { runId } });
const inboxSeqs = inboxRows.map((row) => row.seq);
const rowsMonotonic = inboxSeqs.every(
  (seq, index) => seq === BigInt(index + 1),
);
const contiguousThrough = stream?.contiguousSeq ?? 0n;
const ingestComplete =
  stream !== null &&
  rowsMonotonic &&
  inboxSeqs.length > 0 &&
  contiguousThrough === BigInt(inboxSeqs.length) &&
  stream.pendingAbove.length === 0 &&
  stream.fullRescanCount === 0 &&
  gaps.length === 0 &&
  inboxRows.every((row) => row.processedAt !== null);
check("cockpit_ingest", {
  ingestComplete,
  rowCount: inboxRows.length,
  contiguousThrough: contiguousThrough.toString(),
  pendingAbove: stream?.pendingAbove.map(String) ?? [],
  fullRescanCount: stream?.fullRescanCount ?? null,
  gaps: gaps.length,
  rowsMonotonic,
  processedRows: inboxRows.filter((row) => row.processedAt !== null).length,
  events: inboxRows.map((row) => {
    const payload = row.payload as JsonObject;
    return `${row.seq.toString()}:${String(payload.event ?? "unknown")}`;
  }),
});

let ackSentThrough = 0n;
for (const ack of eventAcks) {
  if (ack.runId !== runId) continue;
  const value = BigInt(String(ack.lastContiguousSeq ?? "0"));
  if (value > ackSentThrough) ackSentThrough = value;
}

let deviceAckThrough = 0n;
try {
  const ackFile = JSON.parse(
    await adbRun([
      "shell",
      `run-as ${applicationId} cat no_backup/verdict/wal/acks.json`,
    ]),
  ) as { streams?: Array<{ runId?: string; ackedThrough?: string }> };
  const deviceAck = ackFile.streams?.find((entry) => entry.runId === runId);
  deviceAckThrough = BigInt(deviceAck?.ackedThrough ?? "0");
} catch {
  deviceAckThrough = 0n;
}
const ackComplete =
  contiguousThrough > 0n &&
  ackSentThrough >= contiguousThrough &&
  // AckedSegmentSweeper prunes the per-stream ack entry after deleting the
  // final segment. Segment absence is therefore stronger applied-ACK evidence
  // than retaining an acks.json watermark forever.
  (deviceAckThrough >= contiguousThrough || walCleared);
check("cockpit_ack", {
  ackComplete,
  sentThrough: ackSentThrough.toString(),
  deviceAppliedThrough: deviceAckThrough.toString(),
  deviceAppliedEvidence:
    deviceAckThrough >= contiguousThrough ? "acks.json" : "acked_segment_swept",
  expectedThrough: contiguousThrough.toString(),
});

const cleanupEndRun = await channel.run(serial, {
  op: "end_run",
  requestId: "end-run-cleanup",
  scope: cleanupRunId,
}, ctx);
check("cleanup_end_run", cleanupEndRun);

const gatePassed =
  TestEventWsServer.isIngestReady() &&
  preflightSetRun.ok &&
  preflightAuthenticated &&
  preflightWalReady &&
  authObserved &&
  appSignatureValid &&
  openFirst.ok &&
  openDuplicate.ok &&
  commandExecutedOnce &&
  oracleVerdict.complete &&
  verticalWalHealthy &&
  ingestComplete &&
  fanoutDrained &&
  ackComplete &&
  walCleared &&
  cleanupSetRun.ok &&
  cleanupEndRun.ok &&
  cleanupAuthenticated &&
  observedRunAfterWsDenial === runId &&
  screen.ok;
check("vertical_slice_gate", {
  passed: gatePassed,
  runId,
  shipmentId,
  device: serial,
});

TestEventWsServer.removeSink(oracleSniffer);
for (const socket of sockets) socket.close(1000, "checkpoint complete");
await new Promise<void>((resolve) => server.close(() => resolve()));
await adbRun(["reverse", "--remove", "tcp:8765"]);
check("adb_reverse_removed", true);
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
await prisma.$disconnect();
process.exit(gatePassed ? 0 : 1);
