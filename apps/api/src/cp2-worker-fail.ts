// CHECKPOINT 2 diagnostic — NOT PRODUCTION.
// "Worker hata davranışı": when one row's fan-out fails the worker must STOP on that row,
// not skip to the next seq, and must be retryable.
import "dotenv/config";
import { ingestFrame } from "./services/verdict-ingest.js";
import { runFanoutOnce } from "./services/verdict-fanout.js";
import { prisma } from "@nesy/db";

const runId = "cp2-wfail";
const sessionId = "wf-" + Date.now();
const N = 8;
const FAIL_AT = 4n;

(async () => {
  for (let i = 1; i <= N; i++) {
    const r = await ingestFrame({ kind: "event", runId, sessionId, seq: String(i),
      payload: { v: 1, runId, sessionId, seq: i, ts: Date.now(), monoTs: i, screen: "", event: "BRIDGE_LOAD", taskId: "", data: {} } });
    if (!r.ok) { console.log("seed failed", i, r.code); return; }
  }
  console.log(`seeded ${N} events on ${runId}/${sessionId}`);

  const pass1: bigint[] = [];
  try {
    const s = await runFanoutOnce(runId, sessionId, async (ev) => {
      if (ev.seq === FAIL_AT) throw new Error("injected consumer failure at seq " + ev.seq);
      pass1.push(ev.seq);
    });
    console.log(`pass1 (fault injected at seq ${FAIL_AT}): processed=${s.processed} consumed=[${pass1}]`);
  } catch (e) {
    console.log(`pass1 THREW: ${(e as Error).message}  consumed=[${pass1}]`);
  }
  const st1 = await prisma.$queryRawUnsafe<{ s: bigint; p: Date | null }[]>(
    `SELECT seq AS s, processed_at AS p FROM verdict_inbox WHERE run_id=$1 AND session_id=$2 ORDER BY seq`, runId, sessionId);
  console.log("after pass1 processed_at:", st1.map((r) => `${r.s}:${r.p ? "done" : "PENDING"}`).join(" "));

  const pass2: bigint[] = [];
  const s2 = await runFanoutOnce(runId, sessionId, async (ev) => { pass2.push(ev.seq); });
  console.log(`pass2 (retry, no fault): processed=${s2.processed} consumed=[${pass2}]`);
  const st2 = await prisma.$queryRawUnsafe<{ s: bigint; p: Date | null }[]>(
    `SELECT seq AS s, processed_at AS p FROM verdict_inbox WHERE run_id=$1 AND session_id=$2 ORDER BY seq`, runId, sessionId);
  console.log("after pass2 processed_at:", st2.map((r) => `${r.s}:${r.p ? "done" : "PENDING"}`).join(" "));
  const all = [...pass1, ...pass2].map(Number);
  console.log(`TOTAL side effects=${all.length} sequence=[${all}] duplicates=${all.length - new Set(all).size}`);
  await prisma.$disconnect();
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
