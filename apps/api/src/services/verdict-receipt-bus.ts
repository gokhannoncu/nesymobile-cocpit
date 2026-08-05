/**
 * ===========================================================================
 *  DurableReceiptBus — low-latency readiness off COMMITTED rows  (B.5 / C.40)
 *
 *  ## What this lane is for
 *
 *  A `RECEIPT_SAFE` fact is one that is true on its own: "the app reported it
 *  reached the route screen" does not become more or less true because seq 411
 *  is still missing. Blocking that behind an ordered gap was the concrete bug
 *  C.40 exists to prevent — a login completed, the event was committed, and the
 *  Continue Gate still timed out because an unrelated earlier seq had not
 *  arrived.
 *
 *  ## Why this is NOT an in-memory event emitter
 *
 *  An emitter publishes at the moment of the nudge. If the process dies between
 *  COMMIT and that nudge, the row is durable and the notification is gone
 *  forever — the exact window this phase must close. So the subscriber is a
 *  CURSOR over committed rows: the nudge only decides *when* it looks, never
 *  *what* it sees. Restart the process, resume from the cursor, get the same
 *  rows. That is also why `receipt_dispatched_at` is persisted rather than
 *  tracked in a Set.
 *
 *  ## Why it publishes rows above the watermark
 *
 *  Because it must. Bounding this lane by `contiguous_seq` would silently turn
 *  it into a slower copy of the ordered lane and delete the reason it exists.
 *  The corresponding cost is stated explicitly in the type system: a
 *  `DurableReceipt` is never authority for an `ORDERED_REQUIRED` fact.
 * ===========================================================================
 */
import {
  decodeDurableCursor,
  encodeDurableCursor,
  durableEventId,
  type DurableEventCursor,
  type DurableEventFilter,
  type DurableReceipt,
  type DurableStreamScope,
  type WaitEventRequest,
  type WaitEventResult,
} from "@nesy/control-contract";

import {
  matchesDurableFilter,
  type DurableEventStore,
  type DurableSubscriberRegistry,
  type ReceiptLatencyTracker,
  type StreamNudgeHub,
} from "./verdict-durable-runtime.js";

/** Rows read per poll. Ordering comes from ORDER BY, not from the limit. */
const RECEIPT_BATCH_SIZE = 500;

/**
 * How long a subscriber sleeps when nothing is ready.
 *
 * This is the *fallback* interval, not the delivery latency: a post-commit
 * nudge normally wakes the subscriber within a millisecond. It is the ceiling
 * on how long a LOST nudge can delay an event, which is why it is seconds
 * rather than minutes.
 */
export const RECEIPT_POLL_INTERVAL_MS = 2_000;

export interface DurableReceiptBusOptions {
  store: DurableEventStore;
  nudges: StreamNudgeHub;
  subscribers: DurableSubscriberRegistry;
  latency: ReceiptLatencyTracker;
  pollIntervalMs?: number;
  now?: () => Date;
}

export interface DurableReceiptSubscribeRequest {
  runId: string;
  sessionId: string;
  cursor?: DurableEventCursor;
  filter?: DurableEventFilter;
  signal?: AbortSignal;
}

export class DurableReceiptBus {
  private readonly store: DurableEventStore;
  private readonly nudges: StreamNudgeHub;
  private readonly subscribers: DurableSubscriberRegistry;
  private readonly latency: ReceiptLatencyTracker;
  private readonly pollIntervalMs: number;
  private readonly now: () => Date;

  constructor(options: DurableReceiptBusOptions) {
    this.store = options.store;
    this.nudges = options.nudges;
    this.subscribers = options.subscribers;
    this.latency = options.latency;
    this.pollIntervalMs = options.pollIntervalMs ?? RECEIPT_POLL_INTERVAL_MS;
    this.now = options.now ?? (() => new Date());
  }

  /** Post-commit wake-up. Cheap, best-effort, never the delivery guarantee. */
  nudge(scope: DurableStreamScope): void {
    this.nudges.nudge(scope);
  }

  /**
   * Streams committed rows from `cursor` onwards, forever, until cancelled.
   *
   * `for await` with a `break` or a thrown error runs the `finally` below —
   * that is what keeps the subscriber count honest and is why cancellation is
   * modelled as an AbortSignal plus generator return rather than a
   * `cancel()` method someone can forget to call.
   */
  async *subscribe(request: DurableReceiptSubscribeRequest): AsyncGenerator<DurableReceipt> {
    const scope: DurableStreamScope = {
      runId: request.runId,
      sessionId: request.sessionId,
    };
    const decoded = request.cursor ? decodeDurableCursor(request.cursor, "RECEIPT_SAFE") : null;
    if (request.cursor && !decoded) {
      // An ordered cursor handed to the receipt lane would silently resume from
      // the wrong position. Refuse loudly instead.
      throw new Error(`cursor ${request.cursor} is not a RECEIPT_SAFE cursor`);
    }
    let cursorSeq = decoded?.seq ?? 0n;
    const filter = request.filter ?? {};

    this.subscribers.open();
    let cancelled = false;
    try {
      for (;;) {
        if (request.signal?.aborted) {
          cancelled = true;
          return;
        }

        const rows = await this.store.listReceiptReady(scope, cursorSeq, RECEIPT_BATCH_SIZE);
        for (const row of rows) {
          // The cursor advances over EVERY committed row, matched or not.
          // Advancing only past matches would re-read the whole non-matching
          // prefix on every poll — O(rows) per poll, i.e. the O(n^2) the
          // acceptance criteria forbid.
          cursorSeq = row.seq;

          const dispatchedAt = this.now();
          if (row.receiptDispatchedAt === null) {
            await this.store.markReceiptDispatched(scope, row.seq, dispatchedAt);
            this.latency.record(scope, row.receivedAt, dispatchedAt);
          }

          if (!matchesDurableFilter(row.payload, filter)) continue;

          yield {
            lane: "RECEIPT_SAFE",
            ref: { runId: row.runId, sessionId: row.sessionId, seq: row.seq.toString() },
            cursor: encodeDurableCursor("RECEIPT_SAFE", row.seq),
            payload: row.payload,
            receivedAt: row.receivedAt,
          };
          if (request.signal?.aborted) {
            cancelled = true;
            return;
          }
        }

        // A full batch means there is certainly more; do not sleep on it.
        if (rows.length === RECEIPT_BATCH_SIZE) continue;
        await this.nudges.wait(scope, this.pollIntervalMs, request.signal);
      }
    } finally {
      if (cancelled || request.signal?.aborted) this.subscribers.closeCancelled();
      else this.subscribers.closeCompleted();
    }
  }

  /**
   * Waits for one matching receipt, or reports why not.
   *
   * The timeout is enforced against the wall clock across the whole wait rather
   * than per poll: a subscriber that keeps receiving non-matching rows would
   * otherwise never time out, and "waited forever without matching" is the
   * failure mode that produces unexplained hung runs.
   */
  async waitEvent(request: WaitEventRequest): Promise<WaitEventResult> {
    if (request.lane !== "RECEIPT_SAFE") {
      throw new Error(`DurableReceiptBus cannot serve lane ${request.lane}`);
    }
    const sessionId = request.sessionId;
    if (!sessionId) {
      throw new Error("waitEvent on the receipt lane requires sessionId");
    }
    const scope: DurableStreamScope = { runId: request.runId, sessionId };

    // Closed-run policy is checked BEFORE waiting, not after timing out: a run
    // that already ended will never produce the event, and burning the full
    // timeout to discover that turns one stale run into a slow test suite.
    const closure = await this.store.getClosure(scope);
    if (closure) {
      await this.store.countLateEvent(scope);
      return { status: "CLOSED_RUN", lane: "RECEIPT_SAFE", cursor: request.cursor };
    }

    const controller = new AbortController();
    const external = request.signal;
    const forward = () => controller.abort();
    external?.addEventListener("abort", forward, { once: true });
    const deadline = this.now().getTime() + request.timeoutMs;
    const timer = setTimeout(() => controller.abort(), request.timeoutMs);
    if (typeof timer.unref === "function") timer.unref();

    let lastCursor = request.cursor;
    try {
      for await (const receipt of this.subscribe({
        runId: request.runId,
        sessionId,
        cursor: request.cursor,
        filter: request.filter,
        signal: controller.signal,
      })) {
        lastCursor = receipt.cursor;
        return {
          status: "MATCHED",
          lane: "RECEIPT_SAFE",
          cursor: receipt.cursor,
          eventRef: durableEventId(receipt.ref),
          payload: receipt.payload,
        };
      }
      // The generator only ends on abort. Which abort it was decides the verdict:
      // an external cancel is not a timeout, and reporting one as the other
      // would make a deliberately cancelled wait look like missing evidence.
      if (external?.aborted) return { status: "CANCELLED", lane: "RECEIPT_SAFE", cursor: lastCursor };
      if (this.now().getTime() >= deadline) {
        return { status: "TIMEOUT", lane: "RECEIPT_SAFE", cursor: lastCursor };
      }
      return { status: "CANCELLED", lane: "RECEIPT_SAFE", cursor: lastCursor };
    } finally {
      clearTimeout(timer);
      external?.removeEventListener("abort", forward);
    }
  }
}
