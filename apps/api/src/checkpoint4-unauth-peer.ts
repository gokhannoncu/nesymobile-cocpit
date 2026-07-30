/** CHECKPOINT 4 local-only unauthenticated peer smoke. Do not commit. */
import { randomBytes } from "node:crypto";
import { WebSocketServer } from "ws";
import {
  VerdictChannel,
  type AdbRunner,
} from "../../../packages/control-channels/src/index.js";
import { createNodeAdbRunner } from "../../../packages/control-channels/src/node-executor.js";
import { asSecret } from "../../../packages/control-contract/src/index.js";

const serial = "R6CW400BC8N";
const applicationId = "com.arasdigital.nesymobile.rstest";
const runId = `checkpoint4-unauth-${Date.now()}`;
const secretBytes = randomBytes(32);
const secret = asSecret(secretBytes.toString("base64url"));
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const adb: AdbRunner = createNodeAdbRunner({
  defaultTimeoutMs: 15_000,
  maxBufferBytes: 8 * 1024 * 1024,
});
const adbText = (args: string[]) =>
  adb(serial, ["-s", serial, ...args], 15_000);

function check(name: string, value: unknown): void {
  console.log(`CHECK|${name}|${JSON.stringify(value)}`);
}

async function readAcks(): Promise<Record<string, unknown>> {
  const raw = await adbText([
    "exec-out",
    "run-as",
    applicationId,
    "cat",
    "no_backup/verdict/wal/acks.json",
  ]);
  return JSON.parse(raw) as Record<string, unknown>;
}

function ackFor(
  value: Record<string, unknown>,
  targetRunId: string,
  targetSessionId: string,
): string | null {
  const streams = Array.isArray(value.streams) ? value.streams : [];
  for (const stream of streams) {
    if (stream === null || typeof stream !== "object") continue;
    const item = stream as Record<string, unknown>;
    if (item.runId === targetRunId && item.sessionId === targetSessionId) {
      return typeof item.ackedThrough === "string" ? item.ackedThrough : null;
    }
  }
  return null;
}

let connectionCount = 0;
let closeObserved = false;
const helloAtByConnection = new Map<number, number>();
const closeAfterHelloMs: number[] = [];
const sockets = new Set<import("ws").WebSocket>();
const frames: Array<{
  type: unknown;
  event: unknown;
  keys: string[];
  hasDeviceId: boolean;
  hasAppVersion: boolean;
  hasFlavor: boolean;
}> = [];
let helloIdentity: { runId: string; sessionId: string } | null = null;

const server = new WebSocketServer({
  host: "127.0.0.1",
  port: 8765,
  path: "/nesy",
});
await new Promise<void>((resolve, reject) => {
  server.once("listening", resolve);
  server.once("error", reject);
});

server.on("connection", (socket) => {
  connectionCount += 1;
  const connectionId = connectionCount;
  sockets.add(socket);
  socket.on("message", (data) => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(String(data)) as Record<string, unknown>;
    } catch {
      frames.push({
        type: "non_json",
        event: null,
        keys: [],
        hasDeviceId: false,
        hasAppVersion: false,
        hasFlavor: false,
      });
      return;
    }
    frames.push({
      type: parsed.type,
      event: parsed.event,
      keys: Object.keys(parsed).sort(),
      hasDeviceId: "deviceId" in parsed,
      hasAppVersion: "appVersion" in parsed,
      hasFlavor: "flavor" in parsed,
    });
    if (
      parsed.type === "hello" &&
      typeof parsed.runId === "string" &&
      typeof parsed.sessionId === "string"
    ) {
      helloAtByConnection.set(connectionId, Date.now());
      helloIdentity = {
        runId: parsed.runId,
        sessionId: parsed.sessionId,
      };
      socket.send(
        JSON.stringify({
          type: "event_ack",
          runId: parsed.runId,
          sessionId: parsed.sessionId,
          lastContiguousSeq: "999999",
        }),
      );
    }
  });
  socket.on("close", () => {
    sockets.delete(socket);
    closeObserved = true;
    const helloAt = helloAtByConnection.get(connectionId);
    if (helloAt !== undefined) closeAfterHelloMs.push(Date.now() - helloAt);
  });
});

await adbText(["shell", "am", "force-stop", applicationId]);
await adbText(["reverse", "tcp:8765", "tcp:8765"]);
const setRun = await new VerdictChannel().run(serial, {
  op: "set_run",
  requestId: "unauth-set-run",
  scope: runId,
  runId,
  secret,
  wsEnabled: true,
  wsPort: 8765,
  skipDeliveryWait: false,
  wakeStopped: true,
}, { applicationId, adb });
check("unauth_set_run", setRun);
await sleep(11_000);

const identity = helloIdentity;
const acks = await readAcks();
check("unauth_peer", {
  connectionCount,
  frameCount: frames.length,
  frames,
  allFramesReducedHello:
    frames.length > 0 &&
    frames.every(
      (frame) =>
        frame.type === "hello" &&
        !frame.hasDeviceId &&
        !frame.hasAppVersion &&
        !frame.hasFlavor,
    ),
  closeObserved,
  closeAfterHelloMs,
  forgedAckThrough:
    identity === null ? null : ackFor(acks, identity.runId, identity.sessionId),
  forgedAckAccepted:
    identity !== null &&
    ackFor(acks, identity.runId, identity.sessionId) === "999999",
});

secretBytes.fill(0);
for (const socket of sockets) socket.terminate();
await new Promise<void>((resolve) => server.close(() => resolve()));
process.exit(0);
