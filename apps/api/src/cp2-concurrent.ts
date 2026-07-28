// CHECKPOINT 2 diagnostic — NOT PRODUCTION. #62/#44: two concurrent writers on ONE stream
// must not lose an update; contiguous_seq must never go backwards.
import "dotenv/config";
import { ingestFrame } from "./services/verdict-ingest.js";
import { prisma } from "@nesy/db";

const runId = "cp2-conc";
const sessionId = "conc-" + Date.now();
const ev = (seq: number) => ({
  kind: "event" as const, runId, sessionId, seq: String(seq),
  payload: { v: 1, runId, sessionId, seq, ts: Date.now(), monoTs: seq, screen: "", event: "BRIDGE_LOAD", taskId: "", data: {} },
});

(async () => {
  const observed: string[] = [];
  let regressions = 0, failed = 0, prev = -1n;
  // Pairs of concurrent frames (mimicking two WS connections for the same stream).
  for (let i = 1; i <= 30; i += 2) {
    const rs = await Promise.all([ingestFrame(ev(i)), ingestFrame(ev(i + 1))]);
    for (const r of rs) {
      if (!r.ok) { failed++; continue; }
      observed.push(r.lastContiguousSeq.toString());
      if (r.lastContiguousSeq < prev) regressions++;
      if (r.lastContiguousSeq > prev) prev = r.lastContiguousSeq;
    }
  }
  const row = await prisma.$queryRawUnsafe<{ contiguous_seq: bigint }[]>(
    `SELECT contiguous_seq FROM verdict_stream WHERE run_id=$1 AND session_id=$2`, runId, sessionId);
  const cnt = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
    `SELECT count(*)::bigint AS c FROM verdict_inbox WHERE run_id=$1 AND session_id=$2`, runId, sessionId);
  console.log(`concurrency=2 pairs=15 frames=30 failed=${failed} ackRegressions=${regressions}`);
  console.log(`finalContiguous=${row[0]?.contiguous_seq} storedRows=${cnt[0]?.c} (30 expected; a lost update shows as < 30)`);
  console.log(`ackSequence=[${observed.join(",")}]`);
  await prisma.$disconnect();
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
