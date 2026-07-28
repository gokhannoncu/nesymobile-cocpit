// CHECKPOINT 2 diagnostic — NOT PRODUCTION. C.5.3a: per-frame ingest p95 and DB RTT.
import "dotenv/config";
import { ingestFrame } from "./services/verdict-ingest.js";
import { prisma } from "@nesy/db";

const N = Number(process.argv[2] ?? 200);
const runId = "cp2-perf";
const sessionId = "perf-" + Date.now();
const pct = (a: number[], p: number) => a.slice().sort((x, y) => x - y)[Math.max(0, Math.ceil(p / 100 * a.length) - 1)];

(async () => {
  const rtt: number[] = [];
  for (let i = 0; i < 20; i++) { const t = Date.now(); await prisma.$queryRaw`SELECT 1`; rtt.push(Date.now() - t); }
  console.log(`SELECT 1 RTT: n=20 p50=${pct(rtt,50)}ms p95=${pct(rtt,95)}ms max=${Math.max(...rtt)}ms`);

  const lat: number[] = []; let ok = 0; let contig = 0n;
  for (let i = 1; i <= N; i++) {
    const t = Date.now();
    const r = await ingestFrame({
      kind: "event", runId, sessionId, seq: String(i),
      payload: { v: 1, runId, sessionId, seq: i, ts: Date.now(), monoTs: i, screen: "", event: "BRIDGE_LOAD", taskId: "", data: {} },
    });
    lat.push(Date.now() - t);
    if (r.ok) { ok++; contig = r.lastContiguousSeq; } else if (i <= 3) console.log("  fail", r.code, r.detail.slice(0, 90));
  }
  console.log(`ingestFrame SERIAL: n=${N} ok=${ok} p50=${pct(lat,50)}ms p95=${pct(lat,95)}ms p99=${pct(lat,99)}ms max=${Math.max(...lat)}ms totalMs=${lat.reduce((a,b)=>a+b,0)} finalContiguous=${contig}`);
  console.log(`first10=${lat.slice(0,10)} last10=${lat.slice(-10)}   (linear scaling check: last10 ~= first10)`);
  await prisma.$disconnect();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
