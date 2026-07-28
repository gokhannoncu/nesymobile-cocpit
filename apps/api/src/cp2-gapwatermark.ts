// CHECKPOINT 2 diagnostic — NOT PRODUCTION. Host watermark semantics:
//  #58 gap must not advance the watermark blindly
//  #63 a deliberate duplicate must not stick the watermark
//  #31 out-of-order commit must not let fan-out deliver out of order
//  #33/#61 watermark must not advance when the insert fails
import "dotenv/config";
import { ingestFrame } from "./services/verdict-ingest.js";
import { runFanoutOnce } from "./services/verdict-fanout.js";
import { prisma } from "@nesy/db";

const runId = "cp2-gap";
const sessionId = "gap-" + Date.now();
const ev = (seq: number) => ({
  kind: "event" as const, runId, sessionId, seq: String(seq),
  payload: { v: 1, runId, sessionId, seq, ts: Date.now(), monoTs: seq, screen: "", event: "BRIDGE_LOAD", taskId: "", data: {} },
});
const contig = async () => {
  const r = await prisma.$queryRawUnsafe<{ contiguous_seq: bigint; pending_above: unknown }[]>(
    `SELECT contiguous_seq, pending_above FROM verdict_stream WHERE run_id=$1 AND session_id=$2`, runId, sessionId);
  return r[0];
};

(async () => {
  for (let i = 1; i <= 30; i++) { const r = await ingestFrame(ev(i)); if (!r.ok) { console.log("seed fail", i, r.code, r.detail.slice(0,60)); return; } }
  console.log("#58a after 1..30 :", JSON.stringify(await contig(), (k, v) => typeof v === "bigint" ? v.toString() : v));

  // out-of-order: 42 arrives with 31..41 missing
  const r42 = await ingestFrame(ev(42));
  console.log(`#31 ingest seq=42 out of order -> ok=${r42.ok} lastContiguousSeq=${r42.ok ? r42.lastContiguousSeq : "-"}`);
  console.log("#31 stream after 42 :", JSON.stringify(await contig(), (k, v) => typeof v === "bigint" ? v.toString() : v));

  // a persistent gap [31..41] declared by the device
  const g = await ingestFrame({ kind: "gap", runId, sessionId, generation: "1", fromSeq: "31", toSeq: "41", reason: "storage_capacity" });
  console.log(`#58b gap[31..41] -> ok=${g.ok} lastContiguousSeq=${g.ok ? g.lastContiguousSeq : "-"} ackGeneration=${g.ok ? g.ackGeneration : "-"}`);
  console.log("#58b stream after gap:", JSON.stringify(await contig(), (k, v) => typeof v === "bigint" ? v.toString() : v));

  // deliberate duplicate of seq 20
  const d = await ingestFrame(ev(20));
  console.log(`#63 duplicate seq=20 -> ok=${d.ok} duplicate=${d.ok ? d.duplicate : "-"} lastContiguousSeq=${d.ok ? d.lastContiguousSeq : "-"}`);

  // fan-out must deliver only <= contiguous, in ascending order
  const seen: bigint[] = [];
  const s = await runFanoutOnce(runId, sessionId, async (e) => { seen.push(e.seq); });
  let asc = true; for (let i = 1; i < seen.length; i++) if (seen[i] <= seen[i - 1]) asc = false;
  console.log(`#31 fanout processed=${s.processed} ascending=${asc} seqs=[${seen.join(",")}]`);
  await prisma.$disconnect();
})().catch((e) => { console.error("FATAL", e instanceof Error ? e.message : e); process.exit(1); });
