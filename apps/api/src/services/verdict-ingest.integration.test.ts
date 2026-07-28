/**
 * ===========================================================================
 *  INGEST + FAN-OUT against a REAL PostgreSQL  (plan Faz 0.2)
 *
 *  The unit tests in `verdict-contiguous.test.ts` cover the arithmetic without a
 *  database. They cannot cover the parts that only exist in SQL: `FOR UPDATE`,
 *  `bigint[]` round-tripping, `ON CONFLICT`, the CHECK constraints, and
 *  `pg_try_advisory_lock`. Those are exactly the places where code that looks
 *  right does the wrong thing, so they get exercised for real.
 *
 *  Requires `VERDICT_DB_IT=1` and a reachable `DATABASE_URL`. Without them the
 *  suite is SKIPPED, not passed — it must never look like the SQL was verified
 *  when nothing connected.
 *
 *  Every row it writes is namespaced by a unique run id and removed in
 *  `afterAll`, so it is safe against a shared database.
 * ===========================================================================
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@nesy/db";
import { ingestFrame, type IngestFrame } from "./verdict-ingest.js";
import { runFanoutOnce, type InboxRow } from "./verdict-fanout.js";

const ENABLED = process.env.VERDICT_DB_IT === "1" && Boolean(process.env.DATABASE_URL);
const suite = ENABLED ? describe : describe.skip;

/** Unique per run so concurrent executions cannot collide on a shared DB. */
const RUN = `it-${process.pid}-${process.hrtime.bigint().toString(36)}`;
const SESSION = "s1";

const ev = (seq: number, extra: Record<string, unknown> = {}): IngestFrame => ({
  kind: "event",
  runId: RUN,
  sessionId: SESSION,
  seq: String(seq),
  payload: { event: "SCREEN_READY", seq, ...extra },
});

const gap = (generation: number, fromSeq: number, toSeq: number, reason = "enospc"): IngestFrame => ({
  kind: "gap",
  runId: RUN,
  sessionId: SESSION,
  generation: String(generation),
  fromSeq: String(fromSeq),
  toSeq: String(toSeq),
  reason,
});

async function cursor(): Promise<{ contiguous: bigint; pending: bigint[]; rescans: number }> {
  const rows = await prisma.$queryRaw<
    { contiguous_seq: bigint; pending_above: bigint[]; full_rescan_count: number }[]
  >`SELECT contiguous_seq, pending_above, full_rescan_count FROM verdict_stream
    WHERE run_id = ${RUN} AND session_id = ${SESSION}`;
  const r = rows[0]!;
  return { contiguous: r.contiguous_seq, pending: r.pending_above, rescans: r.full_rescan_count };
}

suite("verdict ingest against PostgreSQL", () => {
  beforeAll(async () => {
    await prisma.$executeRaw`DELETE FROM verdict_inbox  WHERE run_id = ${RUN}`;
    await prisma.$executeRaw`DELETE FROM verdict_gap    WHERE run_id = ${RUN}`;
    await prisma.$executeRaw`DELETE FROM verdict_stream WHERE run_id = ${RUN}`;
  });

  afterAll(async () => {
    await prisma.$executeRaw`DELETE FROM verdict_inbox  WHERE run_id = ${RUN}`;
    await prisma.$executeRaw`DELETE FROM verdict_gap    WHERE run_id = ${RUN}`;
    await prisma.$executeRaw`DELETE FROM verdict_stream WHERE run_id = ${RUN}`;
    await prisma.$disconnect();
  });

  it("creates the stream row on first frame and advances the cursor", async () => {
    const res = await ingestFrame(ev(1));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.lastContiguousSeq).toBe(1n);
    expect((await cursor()).contiguous).toBe(1n);
  });

  it("serialises a concurrent burst for one stream without DB errors or lost updates", async () => {
    const runId = `${RUN}-concurrent`;
    const sessionId = "cp2-concurrent";
    const frames = Array.from({ length: 64 }, (_, index): IngestFrame => {
      const seq = index + 1;
      return {
        kind: "event",
        runId,
        sessionId,
        seq: String(seq),
        payload: { event: "SCREEN_READY", seq },
      };
    });

    try {
      const results = await Promise.all(frames.map((frame) => ingestFrame(frame)));
      expect(results.filter((result) => !result.ok)).toEqual([]);
      const rows = await prisma.$queryRaw<{ contiguous_seq: bigint; inbox_count: bigint }[]>`
        SELECT s.contiguous_seq,
               (SELECT count(*) FROM verdict_inbox i
                WHERE i.run_id = s.run_id AND i.session_id = s.session_id) AS inbox_count
        FROM verdict_stream s
        WHERE s.run_id = ${runId} AND s.session_id = ${sessionId}`;
      expect(rows[0]).toEqual({ contiguous_seq: 64n, inbox_count: 64n });
    } finally {
      await prisma.$executeRaw`DELETE FROM verdict_inbox  WHERE run_id = ${runId}`;
      await prisma.$executeRaw`DELETE FROM verdict_gap    WHERE run_id = ${runId}`;
      await prisma.$executeRaw`DELETE FROM verdict_stream WHERE run_id = ${runId}`;
    }
  }, 120_000);

  it("a hole parks in pending_above and survives the round trip as bigint[]", async () => {
    await ingestFrame(ev(3));
    await ingestFrame(ev(4));
    const c = await cursor();
    expect(c.contiguous).toBe(1n);
    // Proves bigint[] actually round-trips; a driver returning strings here would
    // silently break every comparison in the cursor arithmetic.
    expect(c.pending).toEqual([3n, 4n]);
    expect(typeof c.pending[0]).toBe("bigint");
  });

  it("closing the hole drains the parked seqs in one transaction", async () => {
    const res = await ingestFrame(ev(2));
    expect(res.ok && res.lastContiguousSeq).toBe(4n);
    const c = await cursor();
    expect(c.contiguous).toBe(4n);
    expect(c.pending).toEqual([]);
  });

  it("re-delivery is a duplicate, is still ACKed, and inserts nothing new", async () => {
    const before = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) n FROM verdict_inbox
      WHERE run_id = ${RUN} AND session_id = ${SESSION}`;
    const res = await ingestFrame(ev(2));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.duplicate).toBe(true);
      // Still ACKed: refusing would stall the device on a record the host has.
      expect(res.lastContiguousSeq).toBe(4n);
    }
    const after = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) n FROM verdict_inbox
      WHERE run_id = ${RUN} AND session_id = ${SESSION}`;
    expect(after[0]!.n).toBe(before[0]!.n);
  });

  it("an adjacent gap advances the cursor and returns a generation to ack", async () => {
    const res = await ingestFrame(gap(1, 5, 8));
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.lastContiguousSeq).toBe(8n);
      expect(res.ackGeneration).toBe(1n);
    }
  });

  it("a NON-adjacent gap does not jump the watermark", async () => {
    const res = await ingestFrame(gap(2, 20, 30));
    expect(res.ok).toBe(true);
    // [9..19] never arrived, so the cursor must stay at 8.
    if (res.ok) expect(res.lastContiguousSeq).toBe(8n);
    expect((await cursor()).contiguous).toBe(8n);
  });

  it("the same generation re-sent with the SAME range is idempotent", async () => {
    const res = await ingestFrame(gap(2, 20, 30));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.duplicate).toBe(true);
  });

  it("the same generation with a DIFFERENT range is a PROTOCOL_VIOLATION, not an ack", async () => {
    // Acking this would make the device clear a journal entry for a range the
    // host never recorded. Generations are immutable on the device — a merge is a
    // new generation — so a mismatch is a bug, not a race.
    const res = await ingestFrame(gap(2, 20, 99));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("PROTOCOL_VIOLATION");
    // The transaction rolled back: the stored range is untouched.
    const rows = await prisma.$queryRaw<{ to_seq: bigint }[]>`
      SELECT to_seq FROM verdict_gap
      WHERE run_id = ${RUN} AND session_id = ${SESSION} AND generation = 2`;
    expect(rows[0]!.to_seq).toBe(30n);
  });

  it("an event inside an accepted gap is not inserted", async () => {
    const res = await ingestFrame(ev(25));
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.duplicate).toBe(true);
    const rows = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) n FROM verdict_inbox
      WHERE run_id = ${RUN} AND session_id = ${SESSION} AND seq = 25`;
    expect(rows[0]!.n).toBe(0n);
  });

  it("the CHECK constraint rejects an inverted gap range before any cursor math", async () => {
    const res = await ingestFrame(gap(3, 40, 39));
    expect(res.ok).toBe(false);
  });

  it("fan-out delivers only up to the watermark, in seq order", async () => {
    const seen: bigint[] = [];
    const consume = async (row: InboxRow) => {
      seen.push(row.seq);
    };
    const stats = await runFanoutOnce(RUN, SESSION, consume);
    expect(stats.skippedLocked).toBe(false);
    // 1..4 were received; 5..8 are a gap so they are not rows at all.
    expect(seen).toEqual([1n, 2n, 3n, 4n]);
    // Sorted ascending — the ordering guarantee the whole worker exists for.
    expect([...seen].sort((a, b) => (a < b ? -1 : 1))).toEqual(seen);
  });

  it("a second fan-out pass delivers nothing (processed_at is set)", async () => {
    const seen: bigint[] = [];
    const stats = await runFanoutOnce(RUN, SESSION, async (r) => void seen.push(r.seq));
    expect(seen).toEqual([]);
    expect(stats.processed).toBe(0);
  });

  it("a consumer error STOPS the stream instead of skipping ahead", async () => {
    // Add 9..11 so there is something ready again.
    for (const s of [9, 10, 11]) await ingestFrame(ev(s));
    expect((await cursor()).contiguous).toBe(11n);

    const seen: bigint[] = [];
    const stats = await runFanoutOnce(RUN, SESSION, async (row) => {
      seen.push(row.seq);
      if (row.seq === 10n) throw new Error("consumer boom");
    });
    expect(stats.stoppedAtSeq).toBe(10n);
    expect(seen).toEqual([9n, 10n]);
    // 11 was NOT delivered — skipping it would have reordered the stream.
    expect(seen).not.toContain(11n);

    // 9 is marked processed, 10 is not: at-least-once means 10 comes back.
    const pending = await prisma.$queryRaw<{ seq: bigint }[]>`
      SELECT seq FROM verdict_inbox
      WHERE run_id = ${RUN} AND session_id = ${SESSION} AND processed_at IS NULL
      ORDER BY seq`;
    expect(pending.map((r) => r.seq)).toEqual([10n, 11n]);
  });

  it("the advisory lock is released after an error, so the retry can proceed", async () => {
    const seen: bigint[] = [];
    const stats = await runFanoutOnce(RUN, SESSION, async (r) => void seen.push(r.seq));
    expect(stats.skippedLocked).toBe(false);
    expect(seen).toEqual([10n, 11n]);
  });

  it("seq beyond 2^53 round-trips exactly through BIGINT", async () => {
    const big = 9_007_199_254_740_993n;
    await prisma.$executeRaw`
      INSERT INTO verdict_inbox (run_id, session_id, seq, payload)
      VALUES (${RUN}, ${SESSION}, ${big}, '{}'::jsonb)`;
    const rows = await prisma.$queryRaw<{ seq: bigint }[]>`
      SELECT seq FROM verdict_inbox
      WHERE run_id = ${RUN} AND session_id = ${SESSION} AND seq = ${big}`;
    expect(rows[0]!.seq).toBe(big);
  });
});
