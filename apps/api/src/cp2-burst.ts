// CHECKPOINT 2 diagnostic — NOT PRODUCTION. Reproduces the DB_ERROR seen under burst replay.
import "dotenv/config";
import { ingestFrame } from "./services/verdict-ingest.js";
import { prisma } from "@nesy/db";

const runId = "cp2-burst";
const sessionId = "burst-" + Date.now();
const N = Number(process.argv[2] ?? 51);
const CONCURRENT = process.argv[3] !== "serial";

function frame(seq: number) {
  return {
    kind: "event" as const, runId, sessionId, seq: String(seq),
    payload: { v: 1, runId, sessionId, seq, ts: Date.now(), monoTs: seq, screen: "", event: "BRIDGE_LOAD", taskId: "", data: {} },
  };
}

(async () => {
  const t0 = Date.now();
  const results = CONCURRENT
    ? await Promise.all(Array.from({ length: N }, (_, i) => ingestFrame(frame(i + 1))))
    : await (async () => { const r = []; for (let i = 0; i < N; i++) r.push(await ingestFrame(frame(i + 1))); return r; })();
  const ms = Date.now() - t0;
  let ok = 0; const errs = new Map<string, number>();
  let maxContig = 0n;
  for (const r of results) {
    if (r.ok) { ok++; if (r.lastContiguousSeq > maxContig) maxContig = r.lastContiguousSeq; }
    else {
      const key = `${r.code}: ${JSON.stringify(r.detail)}`;
      errs.set(key, (errs.get(key) ?? 0) + 1);
    }
  }
  console.log(`mode=${CONCURRENT ? "concurrent" : "serial"} n=${N} ms=${ms} ok=${ok} failed=${N - ok} maxLastContiguousSeq=${maxContig}`);
  for (const [k, v] of errs) console.log(`  x${v}  ${k}`);
  const row = await prisma.$queryRawUnsafe<{ contiguous_seq: bigint }[]>(
    `SELECT contiguous_seq FROM verdict_stream WHERE run_id=$1 AND session_id=$2`, runId, sessionId);
  const cnt = await prisma.$queryRawUnsafe<{ c: bigint }[]>(
    `SELECT count(*)::bigint AS c FROM verdict_inbox WHERE run_id=$1 AND session_id=$2`, runId, sessionId);
  console.log(`DB: contiguous_seq=${row[0]?.contiguous_seq} storedEvents=${cnt[0]?.c}`);
  await prisma.$disconnect();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
