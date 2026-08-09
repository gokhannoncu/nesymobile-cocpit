/**
 * ===========================================================================
 *  OrderedEvidenceBus — contiguous order, idempotent processing, visible
 *  poison  (plan B.5 / D.2)
 *
 *  ## What this lane is for
 *
 *  Everything whose truth depends on what came before it: deterministic
 *  reducers, the Final Oracle, audit and replay. `verdict-fanout.ts` already
 *  drains a stream in seq order under an advisory lease; this module is the
 *  contract around it — the part that gives the ordered lane a *cursor*, a
 *  *retry budget*, a *dead-letter state* and a *subscriber*, none of which the
 *  bare worker had.
 *
 *  ## Why a failing row stops the stream instead of being skipped
 *
 *  Skipping delivers seq N+1 before N. That converts a transient consumer bug
 *  into a permanent ordering violation, and — worse — leaves no trace: the
 *  oracle simply reduces a history that never happened. A stopped stream is
 *  diagnosable. A reordered one is not. So the lane stops, and the row's
 *  `attempt`/`last_error`/`dead_lettered_at` make the stop visible.
 *
 *  ## Why dead-lettering does not unblock the stream
 *
 *  It is tempting: mark the poisonous row dead and carry on. That is exactly
 *  the silent-skip above, wearing a label. Dead-lettering ends the *retrying*,
 *  not the *blocking* — the stream halts at that seq and the health read model
 *  reports it, and a human decides whether the row can be dropped.
 *
 *  ## Why the consumer must be idempotent
 *
 *  `processed_at` is set AFTER the callback returns, so a crash in between
 *  re-delivers exactly one event. Marking first would silently drop events on
 *  any consumer failure, which is strictly worse. At-least-once is the contract,
 *  and `(runId, sessionId, seq)` is the key consumers deduplicate on.
 * ===========================================================================
 */
import {
  decodeDurableCursor,
  encodeDurableCursor,
  durableEventId,
  type DurableEventCursor,
  type DurableEventFilter,
  type DurableStreamScope,
  type OrderedEvidence,
  type WaitEventRequest,
  type WaitEventResult,
} from "@nesy/control-contract";

import {
  matchesDurableFilter,
  planOrderedFailure,
  streamKeyOf,
  DEFAULT_ORDERED_RETRY_POLICY,
  type DurableEventStore,
  type DurableInboxRow,
  type DurableSubscriberRegistry,
  type OrderedRetryPolicy,
  type StreamNudgeHub,
} from "./verdict-durable-runtime.js";

const ORDERED_BATCH_SIZE = 500;

/** Fallback poll interval for ordered subscribers. See the receipt lane's note. */
export const ORDERED_POLL_INTERVAL_MS = 2_000;

/**
 * What the ordered lane hands each event to.
 *
 * **Must be idempotent on `(runId, sessionId, seq)`.**
 */
export type OrderedConsumer = (row: DurableInboxRow) => Promise<void>;

export interface OrderedDrainStats {
  processed: number;
  /** Another process holds the stream lease; nothing was attempted. */
  skippedLocked: boolean;
  /** Set when the lane stopped at a row rather than draining. */
  stoppedAtSeq?: bigint;
  error?: string;
  /** True when the stop was a retry-budget exhaustion, not a transient failure. */
  deadLettered?: boolean;
  /**
   * Set when the lane stopped because the head row is waiting out its backoff.
   *
   * A separate field from `error`: "waiting to retry" is a healthy, temporary
   * state, and reporting it as an error would train everyone to ignore the
   * field that also reports real ones.
   */
  retryScheduledFor?: Date;
}

/**
 * Raised when an ordered subscriber reaches a dead-lettered row.
 *
 * A thrown error rather than a silently-ending iterator: an iterator that just
 * stops is indistinguishable from "no events yet", and the caller would wait out
 * its full timeout and report missing evidence for a row that is sitting right
 * there, poisoned.
 */
export class OrderedPoisonBlockedError extends Error {
  constructor(
    readonly ref: { runId: string; sessionId: string; seq: string },
    readonly cursor: DurableEventCursor | undefined,
    readonly lastError: string,
  ) {
    super(
      `ordered lane blocked at ${ref.runId}/${ref.sessionId}/${ref.seq}: ${lastError}`,
    );
    this.name = "OrderedPoisonBlockedError";
  }
}

export interface OrderedEvidenceBusOptions {
  store: DurableEventStore;
  nudges: StreamNudgeHub;
  subscribers: DurableSubscriberRegistry;
  retryPolicy?: OrderedRetryPolicy;
  pollIntervalMs?: number;
  now?: () => Date;
}

export interface OrderedSubscribeRequest {
  runId: string;
  sessionId: string;
  cursor?: DurableEventCursor;
  filter?: DurableEventFilter;
  signal?: AbortSignal;
}

export class OrderedEvidenceBus {
  private readonly store: DurableEventStore;
  private readonly nudges: StreamNudgeHub;
  private readonly subscribers: DurableSubscriberRegistry;
  private readonly retryPolicy: OrderedRetryPolicy;
  private readonly pollIntervalMs: number;
  private readonly now: () => Date;
  private readonly consumers = new Set<OrderedConsumer>();
  /** Coalesces concurrent drains per stream so a burst tail is never dropped. */
  private readonly drainPending = new Set<string>();
  private readonly drainRunning = new Set<string>();
  /** At most one pending backoff wake-up per stream. */
  private readonly retryTimers = new Map<string, ReturnType<typeof setTimeout>>();

  constructor(options: OrderedEvidenceBusOptions) {
    this.store = options.store;
    this.nudges = options.nudges;
    this.subscribers = options.subscribers;
    this.retryPolicy = options.retryPolicy ?? DEFAULT_ORDERED_RETRY_POLICY;
    this.pollIntervalMs = options.pollIntervalMs ?? ORDERED_POLL_INTERVAL_MS;
    this.now = options.now ?? (() => new Date());
  }

  /**
   * Registers an ordered consumer (Final Oracle, audit, replay).
   *
   * Returns the unregister function rather than exposing a `remove` method: a
   * caller holding the handle cannot unregister someone else's consumer by
   * mistake.
   */
  registerConsumer(consume: OrderedConsumer): () => void {
    this.consumers.add(consume);
    return () => {
      this.consumers.delete(consume);
    };
  }

  consumerCount(): number {
    return this.consumers.size;
  }

  /**
   * Drains one stream's ready region in seq order, under the stream lease.
   *
   * All registered consumers see a row before `processed_at` moves, and one
   * throwing stops the whole row — a partially consumed row must not be marked
   * processed, or the consumer that never saw it never will.
   */
  async drainOnce(scope: DurableStreamScope): Promise<OrderedDrainStats> {
    if (!(await this.store.tryAcquireOrderedLease(scope))) {
      return { processed: 0, skippedLocked: true };
    }
    const stats: OrderedDrainStats = { processed: 0, skippedLocked: false };
    try {
      for (;;) {
        const rows = await this.store.listOrderedReady(scope, ORDERED_BATCH_SIZE);
        if (rows.length === 0) return stats;

        for (const row of rows) {
          // Both checks below STOP the lane rather than skipping the row.
          //
          // Skipping was the actual bug this ordering is here to prevent: a row
          // held back by backoff or by dead-lettering made the very next seq
          // eligible, and the consumer then saw N+1 before N — permanently, with
          // no error anywhere. A blocked stream is diagnosable; a reordered one
          // is not.
          if (row.deadLetteredAt !== null) {
            stats.stoppedAtSeq = row.seq;
            stats.error = row.lastError ?? "dead-lettered row blocks the ordered lane";
            stats.deadLettered = true;
            return stats;
          }
          if (row.nextRetryAt !== null && row.nextRetryAt.getTime() > this.now().getTime()) {
            stats.stoppedAtSeq = row.seq;
            stats.retryScheduledFor = row.nextRetryAt;
            return stats;
          }

          try {
            for (const consume of this.consumers) await consume(row);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            const plan = planOrderedFailure(row.attempt, this.retryPolicy, this.now());
            await this.store.recordOrderedFailure({
              scope,
              seq: row.seq,
              attempt: plan.attempt,
              error: message,
              nextRetryAt: plan.nextRetryAt,
              deadLetteredAt: plan.deadLetteredAt,
            });
            stats.stoppedAtSeq = row.seq;
            stats.error = message;
            stats.deadLettered = plan.deadLetteredAt !== null;
            return stats;
          }
          await this.store.markProcessed(scope, row.seq, this.now());
          stats.processed += 1;
        }

        if (rows.length < ORDERED_BATCH_SIZE) return stats;
      }
    } finally {
      await this.store.releaseOrderedLease(scope);
    }
  }

  /**
   * Post-commit wake-up: drains the stream, coalescing concurrent nudges.
   *
   * The coalescer is not an optimisation. Without it, the final rows of a burst
   * can stay unprocessed forever: every later nudge loses the lease race to the
   * first worker, sees `skippedLocked`, and gives up — while the first worker has
   * already read its last batch. Remembering the nudge is what closes that.
   */
  nudge(scope: DurableStreamScope): void {
    const key = streamKeyOf(scope);
    this.drainPending.add(key);
    if (this.drainRunning.has(key)) return;
    this.drainRunning.add(key);

    void (async () => {
      try {
        while (this.drainPending.delete(key)) {
          const stats = await this.drainOnce(scope);
          if (stats.skippedLocked) {
            // Someone else owns the stream right now. Retry rather than drop —
            // the lease holder may already be past its last batch.
            this.drainPending.add(key);
            await new Promise((resolve) => {
              const timer = setTimeout(resolve, 25);
              if (typeof timer.unref === "function") timer.unref();
            });
          } else if (stats.error) {
            console.warn(
              `[OrderedEvidenceBus] stopped at seq ${stats.stoppedAtSeq?.toString() ?? "?"}` +
                `${stats.deadLettered ? " (DEAD-LETTERED)" : ""}: ${stats.error}`,
            );
          } else if (stats.retryScheduledFor) {
            // Without this the retry would only happen when the NEXT event
            // arrives — so the last event of a run could sit in backoff forever
            // and the run would time out on evidence that was already committed.
            this.scheduleRetryNudge(scope, stats.retryScheduledFor);
          }
          // Woken subscribers see the rows this drain made visible.
          this.nudges.nudge(scope);
        }
      } catch (err) {
        console.warn(
          "[OrderedEvidenceBus] drain failed:",
          err instanceof Error ? err.message : err,
        );
      } finally {
        this.drainRunning.delete(key);
        if (this.drainPending.has(key)) this.nudge(scope);
      }
    })();
  }

  /**
   * Re-nudges the stream once its head row's backoff expires.
   *
   * One timer per stream at a time (`retryTimers`), because a burst of nudges
   * against a stream in backoff would otherwise schedule one timer per nudge and
   * turn a stalled stream into a wake-up storm.
   */
  private scheduleRetryNudge(scope: DurableStreamScope, at: Date): void {
    const key = streamKeyOf(scope);
    if (this.retryTimers.has(key)) return;
    const delay = Math.max(0, at.getTime() - this.now().getTime());
    const timer = setTimeout(() => {
      this.retryTimers.delete(key);
      this.nudge(scope);
    }, delay);
    // Never a reason to hold the process open.
    if (typeof timer.unref === "function") timer.unref();
    this.retryTimers.set(key, timer);
  }

  /**
   * Streams contiguous evidence from `cursor` onwards.
   *
   * Bounded by `contiguous_seq` in the store query: that bound IS the "no
   * blind gap crossing" rule, expressed where it cannot be forgotten.
   *
   * Note what this deliberately does NOT require: that `processed_at` is
   * already set. A subscriber's ordering guarantee comes from the cursor and the
   * watermark, not from another consumer's progress. Requiring `processed_at`
   * would deadlock every `waitEvent` in a process where no ordered consumer
   * happens to be registered.
   */
  async *subscribe(request: OrderedSubscribeRequest): AsyncGenerator<OrderedEvidence> {
    const scope: DurableStreamScope = { runId: request.runId, sessionId: request.sessionId };
    const decoded = request.cursor ? decodeDurableCursor(request.cursor, "ORDERED_REQUIRED") : null;
    if (request.cursor && !decoded) {
      throw new Error(`cursor ${request.cursor} is not an ORDERED_REQUIRED cursor`);
    }
    let cursorSeq = decoded?.seq ?? 0n;
    let cursor = request.cursor;
    const filter = request.filter ?? {};

    this.subscribers.open();
    let cancelled = false;
    try {
      for (;;) {
        if (request.signal?.aborted) {
          cancelled = true;
          return;
        }

        const rows = await this.store.listOrderedVisible(scope, cursorSeq, ORDERED_BATCH_SIZE);
        for (const row of rows) {
          if (row.deadLetteredAt !== null) {
            throw new OrderedPoisonBlockedError(
              { runId: row.runId, sessionId: row.sessionId, seq: row.seq.toString() },
              cursor,
              row.lastError ?? "unknown ordered consumer failure",
            );
          }
          cursorSeq = row.seq;
          cursor = encodeDurableCursor("ORDERED_REQUIRED", row.seq);
          if (!matchesDurableFilter(row.payload, filter)) continue;

          yield {
            lane: "ORDERED_REQUIRED",
            ref: { runId: row.runId, sessionId: row.sessionId, seq: row.seq.toString() },
            cursor,
            payload: row.payload,
            receivedAt: row.receivedAt,
            contiguousSeq: (await this.store.getContiguousSeq(scope)).toString(),
          };
          if (request.signal?.aborted) {
            cancelled = true;
            return;
          }
        }

        if (rows.length === ORDERED_BATCH_SIZE) continue;
        await this.nudges.wait(scope, this.pollIntervalMs, request.signal);
      }
    } finally {
      if (cancelled || request.signal?.aborted) this.subscribers.closeCancelled();
      else this.subscribers.closeCompleted();
    }
  }

  /** Waits for one matching ordered fact, or reports why not. */
  async waitEvent(request: WaitEventRequest): Promise<WaitEventResult> {
    if (request.lane !== "ORDERED_REQUIRED") {
      throw new Error(`OrderedEvidenceBus cannot serve lane ${request.lane}`);
    }
    const sessionId = request.sessionId;
    if (!sessionId) {
      throw new Error("waitEvent on the ordered lane requires sessionId");
    }
    const scope: DurableStreamScope = { runId: request.runId, sessionId };

    const closure = await this.store.getClosure(scope);
    if (closure) {
      await this.store.countLateEvent(scope);
      return { status: "CLOSED_RUN", lane: "ORDERED_REQUIRED", cursor: request.cursor };
    }

    const controller = new AbortController();
    const external = request.signal;
    const forward = () => controller.abort();
    external?.addEventListener("abort", forward, { once: true });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, request.timeoutMs);
    if (typeof timer.unref === "function") timer.unref();

    let lastCursor = request.cursor;
    try {
      for await (const evidence of this.subscribe({
        runId: request.runId,
        sessionId,
        cursor: request.cursor,
        filter: request.filter,
        signal: controller.signal,
      })) {
        lastCursor = evidence.cursor;
        return {
          status: "MATCHED",
          lane: "ORDERED_REQUIRED",
          cursor: evidence.cursor,
          eventRef: durableEventId(evidence.ref),
          payload: evidence.payload,
        };
      }
      if (external?.aborted) {
        return { status: "CANCELLED", lane: "ORDERED_REQUIRED", cursor: lastCursor };
      }
      if (timedOut) {
        return { status: "TIMEOUT", lane: "ORDERED_REQUIRED", cursor: lastCursor };
      }
      return { status: "CANCELLED", lane: "ORDERED_REQUIRED", cursor: lastCursor };
    } catch (err) {
      if (err instanceof OrderedPoisonBlockedError) {
        // A poisoned stream is NOT a timeout and NOT a failed expectation. It is
        // "the evidence lane is blocked, and here is the row", which is the only
        // answer that leads anyone to the actual problem.
        return {
          status: "POISON_BLOCKED",
          lane: "ORDERED_REQUIRED",
          cursor: err.cursor,
          eventRef: durableEventId(err.ref),
          lastError: err.lastError,
        };
      }
      throw err;
    } finally {
      clearTimeout(timer);
      external?.removeEventListener("abort", forward);
    }
  }
}
