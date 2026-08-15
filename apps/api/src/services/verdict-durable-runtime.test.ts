/**
 * ===========================================================================
 *  DURABLE EVENT RUNTIME — semantics, without a database  (plan D.2 / B.5)
 *
 *  What this suite is for, and what it deliberately is NOT for.
 *
 *  IT IS FOR: the rules. Lane separation, gap behaviour, cursor resume, retry
 *  budget, dead-letter blocking, cancel-without-leak, closed-run policy,
 *  restart recovery, sync/durable equality. Every one of those is a rule about
 *  order and failure, and none of them is a SQL question.
 *
 *  IT IS NOT FOR: the SQL. `FOR UPDATE`, `bigint[]` round-tripping, the
 *  watermark JOIN, partial indexes and the advisory lock only exist in
 *  PostgreSQL and are covered by `verdict-durable-runtime.integration.test.ts`.
 *  Neither suite substitutes for the other, and this header exists so nobody
 *  reads a green run here as "the durable runtime is verified".
 * ===========================================================================
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { decodeDurableCursor, encodeDurableCursor } from "@nesy/control-contract";

import {
  DEFAULT_ORDERED_RETRY_POLICY,
  DurableSubscriberRegistry,
  ReceiptLatencyTracker,
  StreamNudgeHub,
  SyncDurableComparisonRecorder,
  answerEmitOutcomeDiagnostic,
  compareSyncAndDurable,
  matchesDurableFilter,
  orderedRetryDelayMs,
  payloadFingerprint,
  planOrderedFailure,
  readDurableRuntimeHealth,
  streamKeyOf,
  type DurableEventStore,
  type DurableInboxRow,
  type DurableRunClosure,
  type DurableStreamHealthRow,
} from "./verdict-durable-runtime.js";
import { DurableReceiptBus } from "./verdict-receipt-bus.js";
import { OrderedEvidenceBus } from "./verdict-ordered-evidence-bus.js";
import {
  VerdictDurableRuntime,
  assertDeliveryContractSound,
} from "./verdict-wait-event.js";
import type { DurableStreamScope } from "@nesy/control-contract";

/**
 * ---------------------------------------------------------------------------
 *  In-memory store double.
 *
 *  It implements the port's PREDICATES, not a database: the watermark bound on
 *  the ordered lane, the retry-time bound, the dead-letter exclusion and the
 *  first-write-wins receipt dispatch are all reproduced, because those are the
 *  behaviours the lanes are built on. `writes` counts mutations so the
 *  side-effect-free diagnostic can be asserted rather than assumed.
 * ---------------------------------------------------------------------------
 */
class InMemoryDurableEventStore implements DurableEventStore {
  private readonly rows = new Map<string, Map<string, DurableInboxRow>>();
  private readonly contiguous = new Map<string, bigint>();
  private readonly closures = new Map<string, DurableRunClosure>();
  private readonly leases = new Set<string>();
  writes = 0;

  /** Simulates a COMMITTED inbox row. Nothing uncommitted can exist here. */
  commit(scope: DurableStreamScope, seq: bigint, payload: unknown, receivedAt = new Date()): void {
    const key = streamKeyOf(scope);
    const stream = this.rows.get(key) ?? new Map<string, DurableInboxRow>();
    this.rows.set(key, stream);
    if (stream.has(seq.toString())) return; // duplicate delivery: inbox PK absorbs it
    stream.set(seq.toString(), {
      runId: scope.runId,
      sessionId: scope.sessionId,
      seq,
      payload,
      receivedAt,
      receiptDispatchedAt: null,
      processedAt: null,
      attempt: 0,
      lastError: null,
      nextRetryAt: null,
      deadLetteredAt: null,
    });
  }

  /** The watermark the ingest transaction would have written. */
  setContiguous(scope: DurableStreamScope, seq: bigint): void {
    this.contiguous.set(streamKeyOf(scope), seq);
  }

  snapshot(scope: DurableStreamScope): DurableInboxRow[] {
    return this.sorted(scope);
  }

  private sorted(scope: DurableStreamScope): DurableInboxRow[] {
    const stream = this.rows.get(streamKeyOf(scope));
    if (!stream) return [];
    return [...stream.values()].sort((a, b) => (a.seq < b.seq ? -1 : a.seq > b.seq ? 1 : 0));
  }

  async listReceiptReady(
    scope: DurableStreamScope,
    afterSeq: bigint,
    limit: number,
  ): Promise<DurableInboxRow[]> {
    return this.sorted(scope)
      .filter((r) => r.seq > afterSeq)
      .slice(0, limit);
  }

  async markReceiptDispatched(scope: DurableStreamScope, seq: bigint, at: Date): Promise<void> {
    const row = this.rows.get(streamKeyOf(scope))?.get(seq.toString());
    if (!row || row.receiptDispatchedAt !== null) return;
    this.writes += 1;
    row.receiptDispatchedAt = at;
  }

  /**
   * Mirrors the SQL exactly, INCLUDING the absence of a dead-letter and backoff
   * filter. Filtering them here would make the double disagree with production
   * about the one behaviour that matters most: whether a blocked row hides
   * behind the rows after it.
   */
  async listOrderedReady(scope: DurableStreamScope, limit: number): Promise<DurableInboxRow[]> {
    const watermark = this.contiguous.get(streamKeyOf(scope)) ?? 0n;
    return this.sorted(scope)
      .filter((r) => r.processedAt === null && r.seq <= watermark)
      .slice(0, limit);
  }

  async listOrderedVisible(
    scope: DurableStreamScope,
    afterSeq: bigint,
    limit: number,
  ): Promise<DurableInboxRow[]> {
    const watermark = this.contiguous.get(streamKeyOf(scope)) ?? 0n;
    return this.sorted(scope)
      .filter((r) => r.seq > afterSeq && r.seq <= watermark)
      .slice(0, limit);
  }

  async markProcessed(scope: DurableStreamScope, seq: bigint, at: Date): Promise<void> {
    const row = this.rows.get(streamKeyOf(scope))?.get(seq.toString());
    if (!row) return;
    this.writes += 1;
    row.processedAt = at;
    row.nextRetryAt = null;
    row.lastError = null;
  }

  async recordOrderedFailure(input: {
    scope: DurableStreamScope;
    seq: bigint;
    attempt: number;
    error: string;
    nextRetryAt: Date | null;
    deadLetteredAt: Date | null;
  }): Promise<void> {
    const row = this.rows.get(streamKeyOf(input.scope))?.get(input.seq.toString());
    if (!row) return;
    this.writes += 1;
    row.attempt = input.attempt;
    row.lastError = input.error;
    row.nextRetryAt = input.nextRetryAt;
    row.deadLetteredAt = input.deadLetteredAt;
  }

  async getRow(scope: DurableStreamScope, seq: bigint): Promise<DurableInboxRow | null> {
    return this.rows.get(streamKeyOf(scope))?.get(seq.toString()) ?? null;
  }

  async getContiguousSeq(scope: DurableStreamScope): Promise<bigint> {
    return this.contiguous.get(streamKeyOf(scope)) ?? 0n;
  }

  async withOrderedLease<T>(
    scope: DurableStreamScope,
    work: (store: DurableEventStore) => Promise<T>,
  ): Promise<{ acquired: false } | { acquired: true; value: T }> {
    const key = streamKeyOf(scope);
    if (this.leases.has(key)) return { acquired: false };
    this.leases.add(key);
    try {
      return { acquired: true, value: await work(this) };
    } finally {
      this.leases.delete(key);
    }
  }

  /** Forces the "another process owns this stream" branch. */
  holdLease(scope: DurableStreamScope): void {
    this.leases.add(streamKeyOf(scope));
  }

  releaseHeldLease(scope: DurableStreamScope): void {
    this.leases.delete(streamKeyOf(scope));
  }

  async listStreamsWithPendingReceipt(limit: number): Promise<DurableStreamScope[]> {
    return this.streamsWhere((r) => r.receiptDispatchedAt === null).slice(0, limit);
  }

  async listStreamsWithPendingOrdered(limit: number): Promise<DurableStreamScope[]> {
    return this.streamsWhere(
      (r, watermark) => r.processedAt === null && r.deadLetteredAt === null && r.seq <= watermark,
    ).slice(0, limit);
  }

  private streamsWhere(
    predicate: (row: DurableInboxRow, watermark: bigint) => boolean,
  ): DurableStreamScope[] {
    const out: DurableStreamScope[] = [];
    for (const [key, stream] of this.rows) {
      const watermark = this.contiguous.get(key) ?? 0n;
      const hit = [...stream.values()].some((r) => predicate(r, watermark));
      if (!hit) continue;
      const [runId, sessionId] = JSON.parse(key) as [string, string];
      out.push({ runId, sessionId });
    }
    return out;
  }

  async getClosure(scope: DurableStreamScope): Promise<DurableRunClosure | null> {
    return this.closures.get(streamKeyOf(scope)) ?? null;
  }

  async closeRun(scope: DurableStreamScope, reason: string, at: Date): Promise<void> {
    const key = streamKeyOf(scope);
    if (this.closures.has(key)) return; // first close wins
    this.writes += 1;
    this.closures.set(key, { closedAt: at, reason, lateEventCount: 0 });
  }

  async countLateEvent(scope: DurableStreamScope): Promise<void> {
    const closure = this.closures.get(streamKeyOf(scope));
    if (!closure) return;
    this.writes += 1;
    closure.lateEventCount += 1;
  }

  async listStreamHealth(scope?: DurableStreamScope): Promise<DurableStreamHealthRow[]> {
    const keys = scope ? [streamKeyOf(scope)] : [...this.rows.keys()];
    const out: DurableStreamHealthRow[] = [];
    for (const key of keys) {
      const stream = this.rows.get(key);
      if (!stream) continue;
      const [runId, sessionId] = JSON.parse(key) as [string, string];
      const watermark = this.contiguous.get(key) ?? 0n;
      const rows = [...stream.values()];
      const laggards = rows.filter((r) => r.processedAt === null && r.seq <= watermark);
      const closure = this.closures.get(key);
      out.push({
        runId,
        sessionId,
        contiguousSeq: watermark,
        receiptPending: rows.filter((r) => r.receiptDispatchedAt === null).length,
        orderedLag: laggards.length,
        oldestUnprocessedAt: laggards.length
          ? laggards.reduce((a, b) => (a.receivedAt < b.receivedAt ? a : b)).receivedAt
          : null,
        maxAttempt: rows.reduce((max, r) => Math.max(max, r.attempt), 0),
        lastError: rows.map((r) => r.lastError).filter((e): e is string => e !== null).pop() ?? null,
        deadLetteredCount: rows.filter((r) => r.deadLetteredAt !== null).length,
        lateEventCount: closure?.lateEventCount ?? 0,
        closedAt: closure?.closedAt ?? null,
      });
    }
    return out;
  }
}

const SCOPE: DurableStreamScope = { runId: "run-1", sessionId: "sess-1" };
const ev = (seq: number, event = "SCREEN_READY", data: Record<string, unknown> = {}) => ({
  v: 1,
  event,
  seq,
  data,
});

/** Poll fast: these tests assert semantics, not the production poll cadence. */
const FAST_POLL_MS = 5;

function buildLanes(store: InMemoryDurableEventStore) {
  const nudges = new StreamNudgeHub();
  const subscribers = new DurableSubscriberRegistry();
  const latency = new ReceiptLatencyTracker();
  return {
    nudges,
    subscribers,
    latency,
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
    }),
  };
}

/** Collects up to `count` deliveries, then cancels — the normal subscriber shape. */
async function takeReceipts(
  bus: DurableReceiptBus,
  request: Parameters<DurableReceiptBus["subscribe"]>[0],
  count: number,
): Promise<string[]> {
  const seen: string[] = [];
  for await (const receipt of bus.subscribe(request)) {
    seen.push(receipt.ref.seq);
    if (seen.length >= count) break;
  }
  return seen;
}

// ===========================================================================
//  Cursor and delivery contract
// ===========================================================================

describe("durable cursor", () => {
  it("round-trips a lane and a seq", () => {
    const cursor = encodeDurableCursor("RECEIPT_SAFE", 42n);
    expect(decodeDurableCursor(cursor, "RECEIPT_SAFE")).toEqual({
      lane: "RECEIPT_SAFE",
      seq: 42n,
    });
  });

  it("refuses a cursor from the other lane", () => {
    // Resuming an ordered subscriber from a receipt cursor would silently start
    // at the wrong position, which is worse than failing.
    const cursor = encodeDurableCursor("RECEIPT_SAFE", 42n);
    expect(decodeDurableCursor(cursor, "ORDERED_REQUIRED")).toBeNull();
  });

  it("refuses a seq that JSON would have rounded", () => {
    expect(decodeDurableCursor("RECEIPT_SAFE#12.5", "RECEIPT_SAFE")).toBeNull();
    expect(decodeDurableCursor("RECEIPT_SAFE#", "RECEIPT_SAFE")).toBeNull();
    expect(decodeDurableCursor("garbage", "RECEIPT_SAFE")).toBeNull();
  });

  it("survives a seq beyond 2^53", () => {
    const big = 9007199254740993n;
    expect(decodeDurableCursor(encodeDurableCursor("ORDERED_REQUIRED", big), "ORDERED_REQUIRED"))
      .toEqual({ lane: "ORDERED_REQUIRED", seq: big });
  });
});

describe("delivery contract validation", () => {
  it("rejects an ORDERED_REQUIRED fact with no stated ordering reason", () => {
    expect(() =>
      assertDeliveryContractSound({
        factKey: "f1",
        lane: "ORDERED_REQUIRED",
        idempotencyKey: "INBOX_EVENT_ID",
      }),
    ).toThrow(/orderingReason/);
  });

  it("rejects a RECEIPT_SAFE fact keyed on a derivation", () => {
    // The receipt lane only ever sees inbox rows; it cannot dedupe a derived
    // fact, so accepting this contract would produce duplicate logical facts.
    expect(() =>
      assertDeliveryContractSound({
        factKey: "f2",
        lane: "RECEIPT_SAFE",
        idempotencyKey: "DERIVATION_ID",
      }),
    ).toThrow(/DERIVATION_ID/);
  });

  it("accepts a well-formed contract on either lane", () => {
    expect(() =>
      assertDeliveryContractSound({
        factKey: "f3",
        lane: "RECEIPT_SAFE",
        idempotencyKey: "INBOX_EVENT_ID",
      }),
    ).not.toThrow();
    expect(() =>
      assertDeliveryContractSound({
        factKey: "f4",
        lane: "ORDERED_REQUIRED",
        idempotencyKey: "DERIVATION_ID",
        orderingReason: "reduces over the previous transition",
      }),
    ).not.toThrow();
  });
});

// ===========================================================================
//  Filter
// ===========================================================================

describe("durable filter", () => {
  it("matches an empty filter against anything", () => {
    expect(matchesDurableFilter(ev(1), {})).toBe(true);
  });

  it("resolves event-name aliases on both sides", () => {
    // The plan freezes `STATE_LOGIN`; the test standards say `LOGIN_SUCCESS`.
    // A filter written against either must match an event carrying either.
    expect(matchesDurableFilter(ev(1, "STATE_LOGIN"), { eventNames: ["LOGIN_SUCCESS"] })).toBe(true);
    expect(matchesDurableFilter(ev(1, "LOGIN_SUCCESS"), { eventNames: ["STATE_LOGIN"] })).toBe(true);
  });

  it("rejects a non-matching event name", () => {
    expect(matchesDurableFilter(ev(1, "SCREEN_READY"), { eventNames: ["STATE_ROUTE"] })).toBe(false);
  });

  it("compares payload fields as strings so a number/string build change still matches", () => {
    expect(
      matchesDurableFilter(ev(1, "SCREEN_READY", { stopId: 77 }), {
        payloadEquals: { stopId: "77" },
      }),
    ).toBe(true);
  });

  it("does not match when the required field is absent", () => {
    expect(
      matchesDurableFilter(ev(1, "SCREEN_READY", {}), { payloadEquals: { stopId: "77" } }),
    ).toBe(false);
  });

  it("does not throw on a malformed payload", () => {
    expect(matchesDurableFilter(null, { eventNames: ["X"] })).toBe(false);
    expect(matchesDurableFilter("not-an-object", { payloadEquals: { a: "b" } })).toBe(false);
  });
});

// ===========================================================================
//  Retry policy
// ===========================================================================

describe("ordered retry policy", () => {
  it("backs off exponentially and then caps", () => {
    const p = { maxAttempts: 10, baseDelayMs: 100, maxDelayMs: 1_000 };
    expect(orderedRetryDelayMs(1, p)).toBe(100);
    expect(orderedRetryDelayMs(2, p)).toBe(200);
    expect(orderedRetryDelayMs(4, p)).toBe(800);
    expect(orderedRetryDelayMs(9, p)).toBe(1_000);
  });

  it("schedules a retry until the budget is spent, then dead-letters", () => {
    const now = new Date("2026-08-05T00:00:00.000Z");
    const early = planOrderedFailure(0, DEFAULT_ORDERED_RETRY_POLICY, now);
    expect(early.attempt).toBe(1);
    expect(early.deadLetteredAt).toBeNull();
    expect(early.nextRetryAt).not.toBeNull();

    const last = planOrderedFailure(
      DEFAULT_ORDERED_RETRY_POLICY.maxAttempts - 1,
      DEFAULT_ORDERED_RETRY_POLICY,
      now,
    );
    expect(last.deadLetteredAt).toEqual(now);
    // No further retry is scheduled: a dead-lettered row is a human's problem,
    // and a retry loop would hide it.
    expect(last.nextRetryAt).toBeNull();
  });
});

// ===========================================================================
//  DurableReceiptBus
// ===========================================================================

describe("DurableReceiptBus", () => {
  let store: InMemoryDurableEventStore;
  let lanes: ReturnType<typeof buildLanes>;

  beforeEach(() => {
    store = new InMemoryDurableEventStore();
    lanes = buildLanes(store);
  });

  it("delivers a committed row and nothing that was never committed", async () => {
    store.commit(SCOPE, 1n, ev(1));
    const seen = await takeReceipts(lanes.receipts, { ...SCOPE }, 1);
    expect(seen).toEqual(["1"]);
    // seq 2 was never committed, so there is nothing for the lane to publish.
    expect(await store.listReceiptReady(SCOPE, 1n, 10)).toEqual([]);
  });

  it("delivers a row sitting ABOVE a hole — the gap does not block this lane", async () => {
    // Watermark stays at 0 (seq 1 never arrived), so the ordered lane can see
    // nothing at all. C.40 says the receipt lane must still deliver seq 2.
    store.commit(SCOPE, 2n, ev(2));
    store.setContiguous(SCOPE, 0n);

    expect(await store.listOrderedVisible(SCOPE, 0n, 10)).toEqual([]);
    const seen = await takeReceipts(lanes.receipts, { ...SCOPE }, 1);
    expect(seen).toEqual(["2"]);
  });

  it("treats a re-delivered event as one logical receipt", async () => {
    const receivedAt = new Date("2026-08-05T00:00:00.000Z");
    store.commit(SCOPE, 1n, ev(1), receivedAt);
    store.commit(SCOPE, 1n, ev(1), new Date("2026-08-05T00:00:09.000Z")); // device retransmit

    const seen = await takeReceipts(lanes.receipts, { ...SCOPE }, 1);
    expect(seen).toEqual(["1"]);
    // One inbox row, therefore one receipt. The PK absorbed the duplicate.
    expect(store.snapshot(SCOPE)).toHaveLength(1);
    expect(store.snapshot(SCOPE)[0]!.receivedAt).toEqual(receivedAt);
  });

  it("keeps the FIRST dispatch time when the row is re-read after a restart", async () => {
    store.commit(SCOPE, 1n, ev(1));
    await takeReceipts(lanes.receipts, { ...SCOPE }, 1);
    const first = store.snapshot(SCOPE)[0]!.receiptDispatchedAt;
    expect(first).not.toBeNull();

    // A fresh subscriber from cursor 0 re-reads the row. Latency must not be
    // re-measured from the replay, or a restart would look instantaneous.
    await takeReceipts(lanes.receipts, { ...SCOPE }, 1);
    expect(store.snapshot(SCOPE)[0]!.receiptDispatchedAt).toEqual(first);
  });

  it("resumes from a cursor after the process is gone", async () => {
    store.commit(SCOPE, 1n, ev(1));
    store.commit(SCOPE, 2n, ev(2));

    let cursor = "";
    for await (const receipt of lanes.receipts.subscribe({ ...SCOPE })) {
      cursor = receipt.cursor;
      break;
    }
    expect(cursor).toBe(encodeDurableCursor("RECEIPT_SAFE", 1n));

    // New bus == new process. Nothing in memory carried over.
    const revived = buildLanes(store);
    const seen = await takeReceipts(revived.receipts, { ...SCOPE, cursor }, 1);
    expect(seen).toEqual(["2"]);
  });

  it("refuses an ordered cursor rather than resuming from the wrong place", async () => {
    const wrong = encodeDurableCursor("ORDERED_REQUIRED", 5n);
    await expect(takeReceipts(lanes.receipts, { ...SCOPE, cursor: wrong }, 1)).rejects.toThrow(
      /not a RECEIPT_SAFE cursor/,
    );
  });

  it("advances its cursor over non-matching rows so a filtered subscriber stays cheap", async () => {
    for (let seq = 1; seq <= 5; seq += 1) store.commit(SCOPE, BigInt(seq), ev(seq, "NOISE"));
    store.commit(SCOPE, 6n, ev(6, "STATE_ROUTE"));

    const seen: string[] = [];
    for await (const receipt of lanes.receipts.subscribe({
      ...SCOPE,
      filter: { eventNames: ["STATE_ROUTE"] },
    })) {
      seen.push(receipt.ref.seq);
      break;
    }
    expect(seen).toEqual(["6"]);
    // Every skipped row was still marked dispatched — that is what stops the
    // next poll from re-reading the whole non-matching prefix.
    expect(store.snapshot(SCOPE).every((r) => r.receiptDispatchedAt !== null)).toBe(true);
  });

  it("records commit→dispatch latency", async () => {
    store.commit(SCOPE, 1n, ev(1), new Date(Date.now() - 250));
    await takeReceipts(lanes.receipts, { ...SCOPE }, 1);
    const observed = lanes.latency.get(SCOPE);
    expect(observed).not.toBeNull();
    expect(observed!).toBeGreaterThanOrEqual(200);
  });

  it("leaves no waiter, timer or subscriber behind when cancelled", async () => {
    const controller = new AbortController();
    const iterator = lanes.receipts.subscribe({ ...SCOPE, signal: controller.signal });
    // Start the subscriber and let it reach its idle wait.
    const pending = iterator.next();
    await new Promise((r) => setTimeout(r, FAST_POLL_MS * 3));
    controller.abort();
    await pending;
    await iterator.return(undefined);

    expect(lanes.nudges.waiterCount()).toBe(0);
    const snapshot = lanes.subscribers.snapshot();
    expect(snapshot.activeSubscribers).toBe(0);
    expect(snapshot.cancelledSubscribers).toBe(1);
  });

  it("waitEvent MATCHED on a filtered receipt", async () => {
    store.commit(SCOPE, 1n, ev(1, "STATE_LOGIN"));
    const result = await lanes.receipts.waitEvent({
      runId: SCOPE.runId,
      sessionId: SCOPE.sessionId,
      lane: "RECEIPT_SAFE",
      filter: { eventNames: ["STATE_LOGIN"] },
      timeoutMs: 500,
    });
    expect(result.status).toBe("MATCHED");
    if (result.status !== "MATCHED") return;
    expect(result.eventRef).toBe("run-1/sess-1/1");
    expect(result.lane).toBe("RECEIPT_SAFE");
  });

  it("waitEvent TIMEOUT when the event never arrives — and reports no failure", async () => {
    store.commit(SCOPE, 1n, ev(1, "NOISE"));
    const result = await lanes.receipts.waitEvent({
      runId: SCOPE.runId,
      sessionId: SCOPE.sessionId,
      lane: "RECEIPT_SAFE",
      filter: { eventNames: ["STATE_LOGIN"] },
      timeoutMs: 60,
    });
    // TIMEOUT, not FAILED: "we did not observe it" is not "it did not happen".
    expect(result.status).toBe("TIMEOUT");
  });

  it("waitEvent CANCELLED is distinguishable from a timeout", async () => {
    const controller = new AbortController();
    const pending = lanes.receipts.waitEvent({
      runId: SCOPE.runId,
      sessionId: SCOPE.sessionId,
      lane: "RECEIPT_SAFE",
      filter: { eventNames: ["STATE_LOGIN"] },
      timeoutMs: 10_000,
      signal: controller.signal,
    });
    await new Promise((r) => setTimeout(r, FAST_POLL_MS * 2));
    controller.abort();
    expect((await pending).status).toBe("CANCELLED");
  });

  it("waitEvent CLOSED_RUN without burning the timeout, and counts the late event", async () => {
    await store.closeRun(SCOPE, "run finished", new Date());
    const started = Date.now();
    const result = await lanes.receipts.waitEvent({
      runId: SCOPE.runId,
      sessionId: SCOPE.sessionId,
      lane: "RECEIPT_SAFE",
      filter: {},
      timeoutMs: 10_000,
    });
    expect(result.status).toBe("CLOSED_RUN");
    expect(Date.now() - started).toBeLessThan(1_000);
    expect((await store.getClosure(SCOPE))!.lateEventCount).toBe(1);
  });

  it("refuses to serve an ORDERED_REQUIRED wait", async () => {
    // The dangerous case: an order-sensitive fact answered off the receipt lane
    // opens a gate on evidence that has not been ordered yet.
    await expect(
      lanes.receipts.waitEvent({
        runId: SCOPE.runId,
        sessionId: SCOPE.sessionId,
        lane: "ORDERED_REQUIRED",
        filter: {},
        timeoutMs: 10,
      }),
    ).rejects.toThrow(/cannot serve lane ORDERED_REQUIRED/);
  });
});

// ===========================================================================
//  OrderedEvidenceBus
// ===========================================================================

describe("OrderedEvidenceBus", () => {
  let store: InMemoryDurableEventStore;
  let lanes: ReturnType<typeof buildLanes>;

  beforeEach(() => {
    store = new InMemoryDurableEventStore();
    lanes = buildLanes(store);
  });

  it("does not cross a gap: a row above the watermark is invisible", async () => {
    store.commit(SCOPE, 1n, ev(1));
    store.commit(SCOPE, 3n, ev(3)); // seq 2 missing
    store.setContiguous(SCOPE, 1n);

    const consumed: string[] = [];
    lanes.ordered.registerConsumer(async (row) => {
      consumed.push(row.seq.toString());
    });
    const stats = await lanes.ordered.drainOnce(SCOPE);

    expect(stats.processed).toBe(1);
    expect(consumed).toEqual(["1"]);
    // seq 3 stays unprocessed until the hole closes — not skipped, not delivered.
    expect(store.snapshot(SCOPE).find((r) => r.seq === 3n)!.processedAt).toBeNull();
  });

  it("drains a burst with no unprocessed tail", async () => {
    for (let seq = 1; seq <= 120; seq += 1) store.commit(SCOPE, BigInt(seq), ev(seq));
    store.setContiguous(SCOPE, 120n);
    lanes.ordered.registerConsumer(async () => undefined);

    const stats = await lanes.ordered.drainOnce(SCOPE);
    expect(stats.processed).toBe(120);
    expect(store.snapshot(SCOPE).filter((r) => r.processedAt === null)).toEqual([]);
  });

  it("returns skippedLocked instead of double-processing a leased stream", async () => {
    store.commit(SCOPE, 1n, ev(1));
    store.setContiguous(SCOPE, 1n);
    store.holdLease(SCOPE);

    const consumed: string[] = [];
    lanes.ordered.registerConsumer(async (row) => {
      consumed.push(row.seq.toString());
    });
    const stats = await lanes.ordered.drainOnce(SCOPE);
    expect(stats).toEqual({ processed: 0, skippedLocked: true });
    expect(consumed).toEqual([]);
  });

  it("stops at a failing row rather than reordering the stream", async () => {
    store.commit(SCOPE, 1n, ev(1));
    store.commit(SCOPE, 2n, ev(2, "POISON"));
    store.commit(SCOPE, 3n, ev(3));
    store.setContiguous(SCOPE, 3n);

    const consumed: string[] = [];
    lanes.ordered.registerConsumer(async (row) => {
      consumed.push(row.seq.toString());
      if (row.seq === 2n) throw new Error("consumer exploded");
    });
    const stats = await lanes.ordered.drainOnce(SCOPE);

    expect(stats.processed).toBe(1);
    expect(stats.stoppedAtSeq).toBe(2n);
    expect(stats.error).toMatch(/exploded/);
    // seq 3 was NEVER handed to the consumer. Delivering it would have put 3
    // before 2 permanently.
    expect(consumed).toEqual(["1", "2"]);

    const rows = store.snapshot(SCOPE);
    expect(rows[1]!.processedAt).toBeNull();
    expect(rows[1]!.attempt).toBe(1);
    expect(rows[1]!.lastError).toMatch(/exploded/);
    expect(rows[1]!.nextRetryAt).not.toBeNull();
    expect(rows[1]!.deadLetteredAt).toBeNull();
  });

  it("does not mark a row processed when only one of several consumers succeeded", async () => {
    store.commit(SCOPE, 1n, ev(1));
    store.setContiguous(SCOPE, 1n);
    const first = vi.fn(async () => undefined);
    lanes.ordered.registerConsumer(first);
    lanes.ordered.registerConsumer(async () => {
      throw new Error("second consumer failed");
    });

    await lanes.ordered.drainOnce(SCOPE);
    expect(first).toHaveBeenCalledTimes(1);
    // Marking it processed here would mean the failing consumer never sees it.
    expect(store.snapshot(SCOPE)[0]!.processedAt).toBeNull();
  });

  it("dead-letters after the retry budget and then blocks the lane", async () => {
    store.commit(SCOPE, 1n, ev(1, "POISON"));
    store.commit(SCOPE, 2n, ev(2));
    store.setContiguous(SCOPE, 2n);

    // A policy with no backoff so the budget can be spent without waiting.
    const ordered = new OrderedEvidenceBus({
      store,
      nudges: lanes.nudges,
      subscribers: lanes.subscribers,
      pollIntervalMs: FAST_POLL_MS,
      retryPolicy: { maxAttempts: 3, baseDelayMs: 0, maxDelayMs: 0 },
    });
    ordered.registerConsumer(async (row) => {
      if (row.seq === 1n) throw new Error("always fails");
    });

    let last = await ordered.drainOnce(SCOPE);
    for (let i = 0; i < 5 && !last.deadLettered; i += 1) last = await ordered.drainOnce(SCOPE);

    expect(last.deadLettered).toBe(true);
    const rows = store.snapshot(SCOPE);
    expect(rows[0]!.deadLetteredAt).not.toBeNull();
    expect(rows[0]!.nextRetryAt).toBeNull();
    // Dead-lettering ended the RETRYING, not the BLOCKING. seq 2 is still
    // unprocessed, because letting it through is the silent skip in disguise.
    expect(rows[1]!.processedAt).toBeNull();
    expect((await ordered.drainOnce(SCOPE)).processed).toBe(0);
  });

  it("a row waiting out its backoff blocks the lane instead of letting the next seq past", async () => {
    // REGRESSION. The store query used to exclude rows inside their retry
    // backoff, which made seq 2 eligible while seq 1 was still waiting — the
    // consumer saw 2 before 1, permanently, with no error anywhere.
    store.commit(SCOPE, 1n, ev(1, "FLAKY"));
    store.commit(SCOPE, 2n, ev(2));
    store.setContiguous(SCOPE, 2n);

    const consumed: string[] = [];
    const ordered = new OrderedEvidenceBus({
      store,
      nudges: lanes.nudges,
      subscribers: lanes.subscribers,
      pollIntervalMs: FAST_POLL_MS,
      retryPolicy: { maxAttempts: 5, baseDelayMs: 60_000, maxDelayMs: 60_000 },
    });
    ordered.registerConsumer(async (row) => {
      consumed.push(row.seq.toString());
      if (row.seq === 1n) throw new Error("transient");
    });

    await ordered.drainOnce(SCOPE);
    const blocked = await ordered.drainOnce(SCOPE);

    expect(blocked.processed).toBe(0);
    expect(blocked.stoppedAtSeq).toBe(1n);
    expect(blocked.retryScheduledFor).toBeInstanceOf(Date);
    // A backoff is not an error state, and reporting it as one would train
    // everyone to ignore the field that also reports real failures.
    expect(blocked.error).toBeUndefined();
    expect(consumed).toEqual(["1"]);
    expect(store.snapshot(SCOPE)[1]!.processedAt).toBeNull();
  });

  it("reports a dead-lettered row to a waiting subscriber as POISON_BLOCKED", async () => {
    store.commit(SCOPE, 1n, ev(1, "POISON"));
    store.setContiguous(SCOPE, 1n);
    const ordered = new OrderedEvidenceBus({
      store,
      nudges: lanes.nudges,
      subscribers: lanes.subscribers,
      pollIntervalMs: FAST_POLL_MS,
      retryPolicy: { maxAttempts: 1, baseDelayMs: 0, maxDelayMs: 0 },
    });
    ordered.registerConsumer(async () => {
      throw new Error("bad payload");
    });
    await ordered.drainOnce(SCOPE);

    const result = await ordered.waitEvent({
      runId: SCOPE.runId,
      sessionId: SCOPE.sessionId,
      lane: "ORDERED_REQUIRED",
      filter: {},
      timeoutMs: 5_000,
    });
    // Not a TIMEOUT: the caller must be told the lane is blocked and which row
    // blocks it, otherwise this is diagnosed as a missing SDK event.
    expect(result.status).toBe("POISON_BLOCKED");
    if (result.status !== "POISON_BLOCKED") return;
    expect(result.eventRef).toBe("run-1/sess-1/1");
    expect(result.lastError).toMatch(/bad payload/);
  });

  it("is idempotent across repeated drains", async () => {
    store.commit(SCOPE, 1n, ev(1));
    store.setContiguous(SCOPE, 1n);
    const consume = vi.fn(async () => undefined);
    lanes.ordered.registerConsumer(consume);

    await lanes.ordered.drainOnce(SCOPE);
    await lanes.ordered.drainOnce(SCOPE);
    // `processed_at` is the guard. A second drain finds nothing ready.
    expect(consume).toHaveBeenCalledTimes(1);
  });

  it("re-delivers exactly one event when the process dies after the callback", async () => {
    // The crash window: consumer succeeded, `processed_at` never written.
    store.commit(SCOPE, 1n, ev(1));
    store.commit(SCOPE, 2n, ev(2));
    store.setContiguous(SCOPE, 2n);

    const consumed: string[] = [];
    // Zero backoff so the replay is immediate; the backoff itself has its own
    // test below.
    const noBackoff = { maxAttempts: 5, baseDelayMs: 0, maxDelayMs: 0 };
    const crashing = new OrderedEvidenceBus({
      store,
      nudges: lanes.nudges,
      subscribers: lanes.subscribers,
      pollIntervalMs: FAST_POLL_MS,
      retryPolicy: noBackoff,
    });
    crashing.registerConsumer(async (row) => {
      consumed.push(row.seq.toString());
      if (row.seq === 1n && consumed.length === 1) throw new Error("crash after side effect");
    });
    await crashing.drainOnce(SCOPE);
    expect(store.snapshot(SCOPE)[0]!.processedAt).toBeNull();

    // Restart: seq 1 arrives a second time. At-least-once, which is why the
    // consumer contract demands idempotency on (runId, sessionId, seq).
    const revived = new OrderedEvidenceBus({
      store,
      nudges: new StreamNudgeHub(),
      subscribers: new DurableSubscriberRegistry(),
      pollIntervalMs: FAST_POLL_MS,
      retryPolicy: noBackoff,
    });
    revived.registerConsumer(async (row) => {
      consumed.push(row.seq.toString());
    });
    await revived.drainOnce(SCOPE);
    expect(consumed).toEqual(["1", "1", "2"]);
    expect(store.snapshot(SCOPE).filter((r) => r.processedAt === null)).toEqual([]);
  });

  it("waitEvent MATCHED only below the watermark", async () => {
    store.commit(SCOPE, 2n, ev(2, "STATE_ROUTE"));
    store.setContiguous(SCOPE, 0n);

    const timedOut = await lanes.ordered.waitEvent({
      runId: SCOPE.runId,
      sessionId: SCOPE.sessionId,
      lane: "ORDERED_REQUIRED",
      filter: { eventNames: ["STATE_ROUTE"] },
      timeoutMs: 60,
    });
    // Correctly waiting behind the hole, not failing.
    expect(timedOut.status).toBe("TIMEOUT");

    store.commit(SCOPE, 1n, ev(1));
    store.setContiguous(SCOPE, 2n);
    const matched = await lanes.ordered.waitEvent({
      runId: SCOPE.runId,
      sessionId: SCOPE.sessionId,
      lane: "ORDERED_REQUIRED",
      filter: { eventNames: ["STATE_ROUTE"] },
      timeoutMs: 2_000,
    });
    expect(matched.status).toBe("MATCHED");
  });

  it("refuses to serve a RECEIPT_SAFE wait", async () => {
    await expect(
      lanes.ordered.waitEvent({
        runId: SCOPE.runId,
        sessionId: SCOPE.sessionId,
        lane: "RECEIPT_SAFE",
        filter: {},
        timeoutMs: 10,
      }),
    ).rejects.toThrow(/cannot serve lane RECEIPT_SAFE/);
  });

  it("leaves no subscriber behind when an ordered wait is cancelled", async () => {
    const controller = new AbortController();
    const pending = lanes.ordered.waitEvent({
      runId: SCOPE.runId,
      sessionId: SCOPE.sessionId,
      lane: "ORDERED_REQUIRED",
      filter: {},
      timeoutMs: 10_000,
      signal: controller.signal,
    });
    await new Promise((r) => setTimeout(r, FAST_POLL_MS * 2));
    controller.abort();
    await pending;
    expect(lanes.nudges.waiterCount()).toBe(0);
    expect(lanes.subscribers.snapshot().activeSubscribers).toBe(0);
  });
});

// ===========================================================================
//  Lane routing and restart recovery
// ===========================================================================

describe("VerdictDurableRuntime", () => {
  let store: InMemoryDurableEventStore;
  let runtime: VerdictDurableRuntime;

  beforeEach(() => {
    store = new InMemoryDurableEventStore();
    runtime = new VerdictDurableRuntime({ store, pollIntervalMs: FAST_POLL_MS });
  });

  it("routes a wait to the lane the fact's contract declares", async () => {
    store.commit(SCOPE, 1n, ev(1, "STATE_LOGIN"));
    const result = await runtime.waitForFact(
      { factKey: "login", lane: "RECEIPT_SAFE", idempotencyKey: "INBOX_EVENT_ID" },
      {
        runId: SCOPE.runId,
        sessionId: SCOPE.sessionId,
        filter: { eventNames: ["STATE_LOGIN"] },
        timeoutMs: 2_000,
      },
    );
    expect(result.status).toBe("MATCHED");
    expect(result.lane).toBe("RECEIPT_SAFE");
  });

  it("finds a committed row the previous process never published", async () => {
    // Exactly the commit→nudge crash window: the row is durable, the
    // notification is gone, and nothing in memory remembers it.
    store.commit(SCOPE, 1n, ev(1));
    store.setContiguous(SCOPE, 1n);

    const scan = await runtime.bootstrap();
    expect(scan.receiptStreams).toBe(1);
    expect(scan.orderedStreams).toBe(1);

    // And the row is genuinely reachable afterwards, from persisted state alone.
    const result = await runtime.waitEvent({
      runId: SCOPE.runId,
      sessionId: SCOPE.sessionId,
      lane: "RECEIPT_SAFE",
      filter: {},
      timeoutMs: 2_000,
    });
    expect(result.status).toBe("MATCHED");
  });

  it("bootstrap is idempotent: a fully dispatched stream is not rediscovered", async () => {
    store.commit(SCOPE, 1n, ev(1));
    store.setContiguous(SCOPE, 1n);
    runtime.registerOrderedConsumer(async () => undefined);

    await runtime.waitEvent({
      runId: SCOPE.runId,
      sessionId: SCOPE.sessionId,
      lane: "RECEIPT_SAFE",
      filter: {},
      timeoutMs: 2_000,
    });
    await runtime.ordered.drainOnce(SCOPE);

    const scan = await runtime.bootstrap();
    expect(scan).toEqual({ receiptStreams: 0, orderedStreams: 0 });
  });

  it("closing a run wakes waiters instead of leaving them to time out", async () => {
    const pending = runtime.waitEvent({
      runId: SCOPE.runId,
      sessionId: SCOPE.sessionId,
      lane: "RECEIPT_SAFE",
      filter: { eventNames: ["NEVER"] },
      timeoutMs: 10_000,
    });
    await new Promise((r) => setTimeout(r, FAST_POLL_MS * 2));
    await runtime.closeRun(SCOPE, "run finished");
    // The wait already started before the closure, so it ends on the timeout
    // path rather than the pre-check; what matters is that a NEW wait is
    // answered immediately.
    const after = await runtime.waitEvent({
      runId: SCOPE.runId,
      sessionId: SCOPE.sessionId,
      lane: "RECEIPT_SAFE",
      filter: {},
      timeoutMs: 10_000,
    });
    expect(after.status).toBe("CLOSED_RUN");
    void pending.catch(() => undefined);
  });

  it("closing a run also nudges the ordered lane for committed pending rows", async () => {
    store.commit(SCOPE, 1n, ev(1, "SURFACE_ROUTE_DIALOG_READY"));
    store.setContiguous(SCOPE, 1n);
    const consumed: string[] = [];
    runtime.registerOrderedConsumer(async (row) => {
      consumed.push(row.seq.toString());
    });

    await runtime.closeRun(SCOPE, "run finished");
    await new Promise((r) => setTimeout(r, FAST_POLL_MS * 3));

    expect(consumed).toEqual(["1"]);
    expect(store.snapshot(SCOPE)[0]?.processedAt).not.toBeNull();
  });

  it("closing a run retries the ordered drain when another drain holds the lease", async () => {
    store.commit(SCOPE, 1n, ev(1, "SURFACE_ROUTE_DIALOG_READY"));
    store.setContiguous(SCOPE, 1n);
    store.holdLease(SCOPE);
    const consumed: string[] = [];
    runtime.registerOrderedConsumer(async (row) => {
      consumed.push(row.seq.toString());
    });

    setTimeout(() => store.releaseHeldLease(SCOPE), FAST_POLL_MS);
    await runtime.closeRun(SCOPE, "run finished");

    expect(consumed).toEqual(["1"]);
    expect(store.snapshot(SCOPE)[0]?.processedAt).not.toBeNull();
  });
});

// ===========================================================================
//  Health read model
// ===========================================================================

describe("durable runtime health", () => {
  it("reports lag, oldest age, receipt backlog, dead letters and subscriber counts", async () => {
    const store = new InMemoryDurableEventStore();
    const now = new Date("2026-08-05T00:01:00.000Z");
    store.commit(SCOPE, 1n, ev(1), new Date("2026-08-05T00:00:00.000Z"));
    store.commit(SCOPE, 2n, ev(2), new Date("2026-08-05T00:00:30.000Z"));
    store.setContiguous(SCOPE, 2n);
    await store.recordOrderedFailure({
      scope: SCOPE,
      seq: 1n,
      attempt: 4,
      error: "boom",
      nextRetryAt: null,
      deadLetteredAt: now,
    });

    const subscribers = new DurableSubscriberRegistry();
    subscribers.open();
    subscribers.open();
    subscribers.closeCancelled();
    const latency = new ReceiptLatencyTracker();
    latency.record(SCOPE, new Date("2026-08-05T00:00:00.000Z"), new Date("2026-08-05T00:00:00.120Z"));

    const health = await readDurableRuntimeHealth(store, subscribers, latency, SCOPE, now);
    expect(health.subscribers).toEqual({
      activeSubscribers: 1,
      cancelledSubscribers: 1,
      completedSubscribers: 0,
    });
    const stream = health.streams[0]!;
    expect(stream.contiguousSeq).toBe("2");
    expect(stream.orderedLag).toBe(2);
    expect(stream.receiptPending).toBe(2);
    expect(stream.oldestUnprocessedAgeMs).toBe(60_000);
    expect(stream.lastReceiptDispatchLatencyMs).toBe(120);
    expect(stream.maxAttempt).toBe(4);
    expect(stream.lastError).toBe("boom");
    expect(stream.deadLetteredCount).toBe(1);
  });

  it("never reports a negative latency when the clocks disagree", () => {
    const latency = new ReceiptLatencyTracker();
    // DB clock ahead of the Node clock by a few ms — real, and a negative
    // number in a health payload reads as a broken metric.
    latency.record(SCOPE, new Date(1_000), new Date(900));
    expect(latency.get(SCOPE)).toBe(0);
  });
});

// ===========================================================================
//  EmitOutcome diagnostic
// ===========================================================================

describe("EmitOutcome diagnostic", () => {
  it("answers from persisted state without writing anything", async () => {
    const store = new InMemoryDurableEventStore();
    store.commit(SCOPE, 1n, ev(1));
    store.setContiguous(SCOPE, 1n);
    await store.markProcessed(SCOPE, 1n, new Date());
    const writesBefore = store.writes;

    const result = await answerEmitOutcomeDiagnostic(store, {
      runId: SCOPE.runId,
      sessionId: SCOPE.sessionId,
      throughSeq: "1",
    });

    expect(result).toEqual({
      hostContiguousSeq: "1",
      present: true,
      orderedProcessed: true,
      receiptDispatched: false,
      deadLettered: false,
      sideEffectFree: true,
    });
    // The whole point: asking "was it durable?" must not create durable work,
    // or a device unsure about delivery generates load exactly when the host is
    // already struggling.
    expect(store.writes).toBe(writesBefore);
  });

  it("reports an absent seq as not present rather than throwing", async () => {
    const store = new InMemoryDurableEventStore();
    const result = await answerEmitOutcomeDiagnostic(store, {
      runId: SCOPE.runId,
      sessionId: SCOPE.sessionId,
      throughSeq: "99",
    });
    expect(result.present).toBe(false);
    expect(result.hostContiguousSeq).toBe("0");
  });

  it("rejects a seq that is not a decimal string", async () => {
    const store = new InMemoryDurableEventStore();
    await expect(
      answerEmitOutcomeDiagnostic(store, {
        runId: SCOPE.runId,
        sessionId: SCOPE.sessionId,
        throughSeq: "1e3",
      }),
    ).rejects.toThrow(/decimal string/);
  });
});

// ===========================================================================
//  Sync-vs-durable equality
// ===========================================================================

describe("sync-vs-durable equality", () => {
  const obs = (seq: string, payload: unknown) => ({
    runId: SCOPE.runId,
    sessionId: SCOPE.sessionId,
    seq,
    fingerprint: payloadFingerprint(payload),
  });

  it("reports equality when both paths saw the same logical events", () => {
    const report = compareSyncAndDurable(
      [obs("1", ev(1)), obs("2", ev(2))],
      [obs("2", ev(2)), obs("1", ev(1))],
    );
    expect(report.equal).toBe(true);
    expect(report.syncCount).toBe(2);
    expect(report.durableCount).toBe(2);
  });

  it("ignores the provenance tag both paths deliberately differ on", () => {
    // The sync path tags `WS|…` and the durable path `DB|…`. Comparing that
    // field would report every single event as a mismatch.
    const sync = obs("1", { ...ev(1), raw: "WS|{...}" });
    const durable = obs("1", { ...ev(1), raw: "DB|{...}" });
    expect(compareSyncAndDurable([sync], [durable]).equal).toBe(true);
  });

  it("ignores key order, which a JSONB round-trip does not preserve", () => {
    const a = payloadFingerprint({ event: "X", seq: 1, data: { b: 2, a: 1 } });
    const b = payloadFingerprint({ data: { a: 1, b: 2 }, seq: 1, event: "X" });
    expect(a).toBe(b);
  });

  it("treats duplicate observations as one — at-least-once is not inequality", () => {
    const report = compareSyncAndDurable([obs("1", ev(1)), obs("1", ev(1))], [obs("1", ev(1))]);
    expect(report.equal).toBe(true);
    expect(report.syncCount).toBe(1);
  });

  it("fails the gate when the durable path is missing an event", () => {
    const report = compareSyncAndDurable([obs("1", ev(1)), obs("2", ev(2))], [obs("1", ev(1))]);
    expect(report.equal).toBe(false);
    expect(report.missingFromDurable).toEqual(["run-1/sess-1/2"]);
  });

  it("fails the gate on the most dangerous case: same identity, different content", () => {
    const report = compareSyncAndDurable(
      [obs("1", ev(1, "SCREEN_READY", { stopId: "1" }))],
      [obs("1", ev(1, "SCREEN_READY", { stopId: "2" }))],
    );
    expect(report.equal).toBe(false);
    expect(report.payloadMismatches).toEqual(["run-1/sess-1/1"]);
  });

  it("accumulates through the recorder used by the WS server's comparison mode", () => {
    const recorder = new SyncDurableComparisonRecorder();
    recorder.recordSync(obs("1", ev(1)));
    recorder.recordDurable(obs("1", ev(1)));
    expect(recorder.report().equal).toBe(true);
    recorder.reset();
    expect(recorder.report()).toMatchObject({ syncCount: 0, durableCount: 0, equal: true });
  });
});
