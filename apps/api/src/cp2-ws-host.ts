/**
 * CHECKPOINT 2 measurement driver — NOT PRODUCTION CODE, do not commit.
 *
 * Boots the REAL `TestEventWsServer` (test-event-ws-server.ts) standalone against the real
 * PostgreSQL, so the device's OkHttpWalTransport talks to the actual host implementation
 * (hello, durable ingest, event_ack, gap_ack, fan-out nudge) rather than to a stub.
 *
 * Run:  cd apps/api && node_modules/.bin/tsx src/cp2-ws-host.ts
 * Then: adb reverse tcp:8765 tcp:8765
 */
import "dotenv/config";
import { TestEventWsServer } from "./services/test-event-ws-server.js";
import type { LogcatSniffer } from "./services/logcat-sniffer.js";

let injected = 0;
let acks = 0;
let lastAck = "-";
const seen = new Map<string, number[]>();

const sniffer = {
  injectTestEvent(e: { runId: string; sessionId: string; seq: number; event: string; raw: string }) {
    injected += 1;
    const k = `${e.runId}|${e.sessionId}`;
    if (!seen.has(k)) seen.set(k, []);
    const arr = seen.get(k)!; arr.push(e.seq); if (arr.length > 5000) arr.splice(0, 2500);
    if (injected % 500 === 0) console.log(`[SNIFF#${injected}] ${k} seq=${e.seq} event=${e.event}`);
  },
} as unknown as LogcatSniffer;

TestEventWsServer.addSink(sniffer);
TestEventWsServer.ensureStarted();

// Every raw frame, including the ones the server ignores (hello, heartbeat, stream_start).
// Patched onto the underlying ws server so nothing is invisible.
const srv = (TestEventWsServer as unknown as { server: import("ws").WebSocketServer | null }).server;
if (srv) {
  srv.on("connection", (socket) => {
    console.log("[RAW] connection");
    socket.on("message", (d) => { const t = String(d); if (t.length < 400 && !t.includes('"seq"')) console.log("[RAW<-]", t); });
    const origSend = socket.send.bind(socket);
    (socket as unknown as { send: (x: unknown) => void }).send = (x: unknown) => {
      acks += 1; const t = String(x); const m = /lastContiguousSeq":"(\d+)"/.exec(t); if (m) { lastAck = m[1]; } else { console.log("[RAW->]", t); }
      return origSend(x as string);
    };
  });
} else {
  console.error("[cp2] ws server did not start");
}

setInterval(() => {
  console.log(
    `[cp2] running=${TestEventWsServer.isRunning()} ingestReady=${TestEventWsServer.isIngestReady()} injected=${injected} ` +
      `acksSent=${acks} lastAck=${lastAck} streams=${seen.size} ` +
      `${[...seen.entries()].slice(-3).map(([k, v]) => `${k}:n=${v.length},max=${v[v.length - 1]}`).join(" ")}`,
  );
}, 10_000);

process.on("SIGINT", () => {
  console.log(`[cp2] FINAL injected=${injected}`);
  for (const [k, v] of seen) {
    const s = [...v].sort((a, b) => a - b);
    const uniq = [...new Set(s)];
    const gaps: string[] = [];
    for (let i = 1; i < uniq.length; i++) if (uniq[i] !== uniq[i - 1] + 1) gaps.push(`${uniq[i - 1]}->${uniq[i]}`);
    console.log(`[cp2] stream ${k}: frames=${v.length} unique=${uniq.length} min=${uniq[0]} max=${uniq[uniq.length - 1]} duplicates=${v.length - uniq.length} gaps=[${gaps.join(",")}]`);
  }
  process.exit(0);
});
