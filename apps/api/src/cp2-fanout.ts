// CHECKPOINT 2 diagnostic — NOT PRODUCTION.
// "İki process testi": two API processes fan out the same stream; only one may do work,
// total side effects must equal the event count, and order must be ascending by seq.
import "dotenv/config";
import { runFanoutOnce } from "./services/verdict-fanout.js";
import { prisma } from "@nesy/db";

const runId = process.argv[2];
const sessionId = process.argv[3];
const label = process.argv[4] ?? "P?";
if (runId === undefined || sessionId === undefined) {
  console.error(`${label} FATAL usage: cp2-fanout <runId> <sessionId> [label]`);
  process.exit(1);
}
const seen: bigint[] = [];

(async () => {
  const stats = await runFanoutOnce(runId, sessionId, async (ev) => {
    seen.push(ev.seq);
    await new Promise((r) => setTimeout(r, 2)); // make the window wide enough to race
  });
  let ordered = true;
  for (let i = 1; i < seen.length; i++) {
    const prev = seen[i - 1];
    const cur = seen[i];
    if (prev === undefined || cur === undefined) continue;
    if (cur <= prev) ordered = false;
  }
  console.log(
    `${label} processed=${stats.processed} skippedLocked=${stats.skippedLocked} ` +
      `consumed=${seen.length} ascending=${ordered} range=${seen[0] ?? "-"}..${seen[seen.length - 1] ?? "-"}`,
  );
  await prisma.$disconnect();
})().catch((e) => { console.error(label, "FATAL", e instanceof Error ? e.message : e); process.exit(1); });
