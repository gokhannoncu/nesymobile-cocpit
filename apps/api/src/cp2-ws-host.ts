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
let outboundFrames = 0;
let eventAcks = 0;
let gapAcks = 0;
let ackRegressions = 0;
const seen = new Map<string, Map<number, number>>();
const ackMax = new Map<string, bigint>();

const sniffer = {
  injectTestEvent(e: { runId: string; sessionId: string; seq: number; event: string; raw: string }) {
    injected += 1;
    const k = `${e.runId}|${e.sessionId}`;
    if (!seen.has(k)) seen.set(k, new Map());
    const seqCounts = seen.get(k)!;
    seqCounts.set(e.seq, (seqCounts.get(e.seq) ?? 0) + 1);
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
      outboundFrames += 1;
      const t = String(x);
      try {
        const frame = JSON.parse(t) as {
          type?: string;
          runId?: string;
          sessionId?: string;
          lastContiguousSeq?: string;
        };
        if (
          frame.type === "event_ack" &&
          typeof frame.runId === "string" &&
          typeof frame.sessionId === "string" &&
          typeof frame.lastContiguousSeq === "string"
        ) {
          eventAcks += 1;
          const k = `${frame.runId}|${frame.sessionId}`;
          const ack = BigInt(frame.lastContiguousSeq);
          const previousMax = ackMax.get(k);
          const regressed = previousMax !== undefined && ack < previousMax;
          if (regressed) ackRegressions += 1;
          if (previousMax === undefined || ack > previousMax) ackMax.set(k, ack);
          console.log(
            `[ACK#${eventAcks}] runId=${frame.runId} sessionId=${frame.sessionId} ` +
              `lastContiguousSeq=${ack} previousMax=${previousMax ?? "-"} regressed=${regressed}`,
          );
        } else if (frame.type === "gap_ack") {
          gapAcks += 1;
          console.log("[GAP_ACK]", t);
        } else {
          console.log("[RAW->]", t);
        }
      } catch {
        console.log("[RAW->]", t);
      }
      return origSend(x as string);
    };
  });
} else {
  console.error("[cp2] ws server did not start");
}

setInterval(() => {
  const unique = [...seen.values()].reduce((n, seqCounts) => n + seqCounts.size, 0);
  console.log(
    `[cp2] running=${TestEventWsServer.isRunning()} ingestReady=${TestEventWsServer.isIngestReady()} injected=${injected} ` +
      `unique=${unique} duplicates=${injected - unique} eventAcks=${eventAcks} gapAcks=${gapAcks} ` +
      `ackRegressions=${ackRegressions} streams=${seen.size}`,
  );
}, 10_000);

process.on("SIGINT", () => {
  const unique = [...seen.values()].reduce((n, seqCounts) => n + seqCounts.size, 0);
  console.log(
    `[cp2] FINAL frames=${injected} unique=${unique} duplicates=${injected - unique} ` +
      `outboundFrames=${outboundFrames} eventAcks=${eventAcks} gapAcks=${gapAcks} ` +
      `ackRegressions=${ackRegressions} streams=${seen.size}`,
  );
  for (const [k, seqCounts] of seen) {
    const seqs = [...seqCounts.keys()].sort((a, b) => a - b);
    const gaps: string[] = [];
    for (let i = 1; i < seqs.length; i++) {
      if (seqs[i] !== seqs[i - 1] + 1) gaps.push(`${seqs[i - 1]}->${seqs[i]}`);
    }
    const frames = [...seqCounts.values()].reduce((n, count) => n + count, 0);
    console.log(
      `[cp2] stream ${k}: frames=${frames} unique=${seqs.length} min=${seqs[0]} ` +
        `max=${seqs[seqs.length - 1]} duplicates=${frames - seqs.length} ` +
        `ackMax=${ackMax.get(k) ?? "-"} gaps=[${gaps.join(",")}]`,
    );
  }
  process.exit(0);
});
