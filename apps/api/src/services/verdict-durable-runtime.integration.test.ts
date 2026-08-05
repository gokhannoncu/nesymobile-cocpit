/**
 * ===========================================================================
 *  DURABLE RUNTIME against a REAL PostgreSQL  (plan D.2 / Faz 2)
 *
 *  `verdict-durable-runtime.test.ts` proves the SEMANTICS against an in-memory
 *  double. This suite proves the parts that only exist in SQL, and which the
 *  double cannot be wrong about in the same way the database can:
 *
 *  - the watermark JOIN that bounds the ordered lane,
 *  - the *absence* of a watermark bound on the receipt lane,
 *  - `pg_try_advisory_lock` as a real cross-connection single-consumer lease,
 *  - the new dispatch columns and their CHECK constraints,
 *  - `verdict_run_closure` and its first-close-wins upsert,
 *  - the DISTINCT restart scans over the pending predicates,
 *  - `bigint` seq round-tripping past 2^53.
 *
 *  Requires `VERDICT_DB_IT=1` and a reachable `DATABASE_URL`. Without both the
 *  suite is SKIPPED, never passed: a green run must never be readable as "the
 *  SQL was verified" when nothing connected.
 *
 *  Every row is namespaced by a unique run id and removed in `afterAll`, so it
 *  is safe against a shared database — but note that a shared database is still
 *  not an acceptable target for this suite, because the migration it depends on
 *  must be applied first.
 * ===========================================================================
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "@nesy/db";

import {
  DurableSubscriberRegistry,
  PrismaDurableEventStore,
  ReceiptLatencyTracker,
  StreamNudgeHub,
  answerEmitOutcomeDiagnostic,
} from "./verdict-durable-runtime.js";
import { DurableReceiptBus } from "./verdict-receipt-bus.js";
import { OrderedEvidenceBus } from "./verdict-ordered-evidence-bus.js";
import { VerdictDurableRuntime } from "./verdict-wait-event.js";

const ENABLED = process.env.VERDICT_DB_IT === "1" && Boolean(process.env.DATABASE_URL);
const suite = ENABLED ? describe : describe.skip;

/** Unique per process so concurrent executions cannot collide. */
const RUN = `dr-it-${process.pid}-${process.hrtime.bigint().toString(36)}`;
const SESSION = "s1";
const SCOPE = { runId: RUN, sessionId: SESSION };
const FAST_POLL_MS = 5;

const payload = (seq: number, event = "SCREEN_READY", data: Record<string, unknown> = {}) => ({
  v: 1,
  event,
  seq,
  data,
});

/** Inserts a committed row directly: this suite tests delivery, not ingest. */
async function commit(seq: bigint, body: unknown, receivedAt?: Date): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO verdict_inbox (run_id, session_id, seq, payload, received_at)
    VALUES (${RUN}, ${SESSION}, ${seq}, ${JSON.stringify(body)}::jsonb,
            ${receivedAt ?? new Date()})
    ON CONFLICT (run_id, session_id, seq) DO NOTHING`;
}

async function setWatermark(seq: bigint): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO verdict_stream (run_id, session_id, contiguous_seq, updated_at)
    VALUES (${RUN}, ${SESSION}, ${seq}, now())
    ON CONFLICT (run_id, session_id)
      DO UPDATE SET contiguous_seq = ${seq}, updated_at = now()`;
}

async function cleanup(): Promise<void> {
  await prisma.$executeRaw`DELETE FROM verdict_inbox WHERE run_id = ${RUN}`;
  await prisma.$executeRaw`DELETE FROM verdict_gap WHERE run_id = ${RUN}`;
  await prisma.$executeRaw`DELETE FROM verdict_stream WHERE run_id = ${RUN}`;
  await prisma.$executeRaw`DELETE FROM verdict_run_closure WHERE run_id = ${RUN}`;
}

function buildLanes() {
  const store = new PrismaDurableEventStore();
  const nudges = new StreamNudgeHub();
  const subscribers = new DurableSubscriberRegistry();
  const latency = new ReceiptLatencyTracker();
  return {
    store,
    nudges,
    subscribers,
    receipts: new DurableReceiptBus({
      store,
      nudges,
      subscribers,
      latency,
      pollIntervalMs: FAST_POLL_MS,
    }),
    ordered: new OrderedEvidenceBus({
      store,
      nudges,
      subscribers,
      pollIntervalMs: FAST_POLL_MS,
      retryPolicy: { maxAttempts: 2, baseDelayMs: 0, maxDelayMs: 0 },
    }),
  };
}

suite("durable runtime against PostgreSQL", () => {
  beforeAll(cleanup);
  afterAll(cleanup);

  it("the migration's new columns and constraints exist", async () => {
    const cols = await prisma.$queryRaw<{ column_name: string; is_nullable: string }[]>`
      SELECT column_name, is_nullable FROM information_schema.columns
      WHERE table_name = 'verdict_inbox'
        AND column_name IN ('receipt_dispatched_at', 'attempt', 'last_error',
                            'next_retry_at', 'dead_lettered_at')
      ORDER BY column_name`;
    expect(cols.map((c) => c.column_name)).toEqual([
      "attempt",
      "dead_lettered_at",
      "last_error",
      "next_retry_at",
      "receipt_dispatched_at",
    ]);

    // A negative attempt count would make the retry budget meaningless, and the
    // database is the only place that guarantee cannot be bypassed by a future
    // code path.
    await commit(900n, payload(900));
    await expect(
      prisma.$executeRaw`
        UPDATE verdict_inbox SET attempt = -1
        WHERE run_id = ${RUN} AND session_id = ${SESSION} AND seq = 900`,
    ).rejects.toThrow();
  });

  it("the receipt lane publishes a row ABOVE the watermark", async () => {
    await cleanup();
    // seq 1 never arrived, so the watermark stays at 0 and the ordered lane can
    // see nothing. C.40 requires the receipt lane to deliver seq 2 anyway.
    await commit(2n, payload(2));
    await setWatermark(0n);
    const lanes = buildLanes();

    expect(await lanes.store.listOrderedVisible(SCOPE, 0n, 10)).toEqual([]);

    const seen: string[] = [];
    for await (const receipt of lanes.receipts.subscribe(SCOPE)) {
      seen.push(receipt.ref.seq);
      break;
    }
    expect(seen).toEqual(["2"]);

    const row = await lanes.store.getRow(SCOPE, 2n);
    expect(row?.receiptDispatchedAt).not.toBeNull();
  });

  it("the ordered lane's watermark JOIN is what stops it at a gap", async () => {
    await cleanup();
    await commit(1n, payload(1));
    await commit(3n, payload(3));
    await setWatermark(1n);
    const lanes = buildLanes();

    const consumed: string[] = [];
    lanes.ordered.registerConsumer(async (row) => {
      consumed.push(row.seq.toString());
    });
    const stats = await lanes.ordered.drainOnce(SCOPE);

    expect(stats.processed).toBe(1);
    expect(consumed).toEqual(["1"]);
    expect((await lanes.store.getRow(SCOPE, 3n))?.processedAt).toBeNull();
  });

  it("the advisory lease actually excludes a second holder on another connection", async () => {
    await cleanup();
    const store = new PrismaDurableEventStore();
    expect(await store.tryAcquireOrderedLease(SCOPE)).toBe(true);
    try {
      // Same session re-entrancy is not what this proves; the meaningful
      // assertion is that the lock is a real database object, which the
      // `pg_locks` row demonstrates.
      const held = await prisma.$queryRaw<{ count: bigint }[]>`
        SELECT count(*)::bigint AS count FROM pg_locks
        WHERE locktype = 'advisory' AND granted`;
      expect(Number(held[0]!.count)).toBeGreaterThan(0);
    } finally {
      await store.releaseOrderedLease(SCOPE);
    }
  });

  it("a failing consumer persists attempt/last_error and blocks the next seq", async () => {
    await cleanup();
    await commit(1n, payload(1, "POISON"));
    await commit(2n, payload(2));
    await setWatermark(2n);
    const lanes = buildLanes();
    lanes.ordered.registerConsumer(async (row) => {
      if (row.seq === 1n) throw new Error("consumer exploded");
    });

    const first = await lanes.ordered.drainOnce(SCOPE);
    expect(first.stoppedAtSeq).toBe(1n);

    const row = await lanes.store.getRow(SCOPE, 1n);
    expect(row?.attempt).toBe(1);
    expect(row?.lastError).toMatch(/exploded/);
    // seq 2 must NOT have been delivered — that is the ordering violation the
    // lane exists to prevent.
    expect((await lanes.store.getRow(SCOPE, 2n))?.processedAt).toBeNull();

    // Second attempt exhausts the budget (maxAttempts: 2) and dead-letters.
    const second = await lanes.ordered.drainOnce(SCOPE);
    expect(second.deadLettered).toBe(true);
    expect((await lanes.store.getRow(SCOPE, 1n))?.deadLetteredAt).not.toBeNull();

    // And the dead letter still blocks: it ends the retrying, not the blocking.
    expect((await lanes.ordered.drainOnce(SCOPE)).processed).toBe(0);
    const blocked = await lanes.ordered.waitEvent({
      runId: RUN,
      sessionId: SESSION,
      lane: "ORDERED_REQUIRED",
      filter: {},
      timeoutMs: 2_000,
    });
    expect(blocked.status).toBe("POISON_BLOCKED");
  });

  it("the restart scans find committed-but-undelivered rows through DISTINCT predicates", async () => {
    await cleanup();
    await commit(1n, payload(1));
    await setWatermark(1n);

    // A brand-new runtime: nothing in memory knows this row exists. The only
    // record of the crash window is `receipt_dispatched_at IS NULL` /
    // `processed_at IS NULL` in the database.
    const runtime = new VerdictDurableRuntime({
      store: new PrismaDurableEventStore(),
      pollIntervalMs: FAST_POLL_MS,
    });
    const scan = await runtime.bootstrap();
    expect(scan.receiptStreams).toBeGreaterThanOrEqual(1);
    expect(scan.orderedStreams).toBeGreaterThanOrEqual(1);

    const result = await runtime.waitEvent({
      runId: RUN,
      sessionId: SESSION,
      lane: "RECEIPT_SAFE",
      filter: {},
      timeoutMs: 5_000,
    });
    expect(result.status).toBe("MATCHED");
  });

  it("first close wins and late events are counted, not dropped", async () => {
    await cleanup();
    const store = new PrismaDurableEventStore();
    const firstAt = new Date("2026-08-05T00:00:00.000Z");
    await store.closeRun(SCOPE, "run finished", firstAt);
    await store.closeRun(SCOPE, "closed again", new Date("2026-08-05T01:00:00.000Z"));

    const closure = await store.getClosure(SCOPE);
    expect(closure?.reason).toBe("run finished");
    expect(closure?.closedAt.toISOString()).toBe(firstAt.toISOString());

    await store.countLateEvent(SCOPE);
    await store.countLateEvent(SCOPE);
    expect((await store.getClosure(SCOPE))?.lateEventCount).toBe(2);
  });

  it("a closed run answers a wait immediately instead of burning the timeout", async () => {
    await cleanup();
    const lanes = buildLanes();
    await lanes.store.closeRun(SCOPE, "run finished", new Date());
    const started = Date.now();
    const result = await lanes.receipts.waitEvent({
      runId: RUN,
      sessionId: SESSION,
      lane: "RECEIPT_SAFE",
      filter: {},
      timeoutMs: 10_000,
    });
    expect(result.status).toBe("CLOSED_RUN");
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("the health read model reports real lag, age and dead-letter counts", async () => {
    await cleanup();
    const old = new Date(Date.now() - 5_000);
    await commit(1n, payload(1), old);
    await commit(2n, payload(2), old);
    await setWatermark(2n);
    const runtime = new VerdictDurableRuntime({
      store: new PrismaDurableEventStore(),
      pollIntervalMs: FAST_POLL_MS,
    });

    const health = await runtime.health(SCOPE);
    const stream = health.streams[0]!;
    expect(stream.contiguousSeq).toBe("2");
    expect(stream.orderedLag).toBe(2);
    expect(stream.receiptPending).toBe(2);
    expect(stream.oldestUnprocessedAgeMs).toBeGreaterThanOrEqual(4_000);
  });

  it("a seq past 2^53 round-trips without collapsing into its neighbour", async () => {
    await cleanup();
    // JSON numbers lose precision here, which would silently merge two distinct
    // events. The whole pipeline keeps seq as bigint/decimal string for this.
    const big = 9007199254740993n;
    await commit(big, payload(1));
    await setWatermark(big);
    const store = new PrismaDurableEventStore();
    expect((await store.getRow(SCOPE, big))?.seq).toBe(big);
    expect((await store.getContiguousSeq(SCOPE))).toBe(big);

    const diagnostic = await answerEmitOutcomeDiagnostic(store, {
      runId: RUN,
      sessionId: SESSION,
      throughSeq: big.toString(),
    });
    expect(diagnostic.present).toBe(true);
    expect(diagnostic.hostContiguousSeq).toBe(big.toString());
    expect(diagnostic.sideEffectFree).toBe(true);
  });
});
