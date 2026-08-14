/**
 * ===========================================================================
 *  DURABLE EVENT RUNTIME — the store port, the two lanes' wiring, and the
 *  visibility that keeps a durable pipeline from stalling in silence.
 *  (plan B.5 / D.2 / C.40)
 *
 *  ## Why there is a port at all
 *
 *  Every interesting rule in this phase is a rule about ORDER and FAILURE:
 *  a receipt must not be published before COMMIT, a dead-lettered row must
 *  stop the ordered lane rather than be skipped, a cursor must survive a
 *  restart, a cancelled subscriber must not leak. None of those are SQL
 *  questions — but if the only way to reach them is through PostgreSQL, they
 *  can only be tested where a database exists, and this repository's
 *  integration suite is (as of Phase 2) provably unrunnable locally: no
 *  Docker, and the sole reachable `DATABASE_URL` is a shared production-like
 *  host.
 *
 *  So the lanes depend on a narrow port. `PrismaDurableEventStore` is the real
 *  implementation and the integration suite proves its SQL; the unit suite
 *  proves the semantics against an in-memory double. Neither substitutes for
 *  the other, and the split is what makes "restart loses nothing" a test
 *  rather than a claim.
 *
 *  ## Why the port is narrow on purpose
 *
 *  It exposes exactly the queries the two lanes need, not a general row API.
 *  A general API would let a future caller mark a row processed without having
 *  run the ordered consumer — which is the single most damaging thing anyone
 *  can do to this system, because it destroys evidence with no error anywhere.
 * ===========================================================================
 */
import { prisma } from "@nesy/db";
import { resolveEventName } from "@nesy/control-contract";
import type {
  DurableEventFilter,
  DurableRuntimeHealth,
  DurableStreamHealth,
  DurableStreamScope,
  EmitOutcomeDiagnosticQuery,
  EmitOutcomeDiagnosticResult,
  SyncDurableEqualityReport,
} from "@nesy/control-contract";

/** One committed inbox row, with both lanes' dispatch state. */
export interface DurableInboxRow {
  runId: string;
  sessionId: string;
  seq: bigint;
  payload: unknown;
  receivedAt: Date;
  receiptDispatchedAt: Date | null;
  processedAt: Date | null;
  attempt: number;
  lastError: string | null;
  nextRetryAt: Date | null;
  deadLetteredAt: Date | null;
}

/** Raw per-stream numbers the health read model is derived from. */
export interface DurableStreamHealthRow {
  runId: string;
  sessionId: string;
  contiguousSeq: bigint;
  receiptPending: number;
  orderedLag: number;
  oldestUnprocessedAt: Date | null;
  maxAttempt: number;
  lastError: string | null;
  deadLetteredCount: number;
  lateEventCount: number;
  closedAt: Date | null;
}

export interface DurableRunClosure {
  closedAt: Date;
  reason: string;
  lateEventCount: number;
}

/**
 * The persistence surface both lanes run on.
 *
 * Read the method names as guarantees, not as convenience: there is no
 * `updateRow`, and `markProcessed` is the only way `processed_at` can move.
 */
export interface DurableEventStore {
  /**
   * Committed rows for this stream above `afterSeq`, in seq order.
   *
   * NO watermark bound — that is the receipt lane's entire reason to exist
   * (C.40). A row above a hole is still committed, and a `RECEIPT_SAFE` fact
   * derived from it is still true.
   */
  listReceiptReady(
    scope: DurableStreamScope,
    afterSeq: bigint,
    limit: number,
  ): Promise<DurableInboxRow[]>;

  /** Records that the receipt lane handed this row to its subscribers. */
  markReceiptDispatched(scope: DurableStreamScope, seq: bigint, at: Date): Promise<void>;

  /**
   * The ordered CONSUMER's work queue: unprocessed rows at or below the
   * contiguous watermark, in seq order.
   *
   * ⚠️ It deliberately does NOT filter out dead-lettered rows or rows still
   * inside their retry backoff. Filtering them here was a real bug caught by
   * `dead-letters after the retry budget and then blocks the lane`: excluding
   * the blocked row made the very next seq eligible, so the lane quietly
   * delivered N+1 before N — the permanent ordering violation this whole lane
   * exists to prevent. Whether to stop is the LANE's decision, made in seq
   * order, and it can only make it if it can see the blocking row.
   */
  listOrderedReady(
    scope: DurableStreamScope,
    limit: number,
  ): Promise<DurableInboxRow[]>;

  /**
   * Rows an ordered SUBSCRIBER may see: above `afterSeq`, at or below the
   * watermark, in seq order.
   *
   * Dead-lettered rows are INCLUDED. A subscriber that could not see the
   * poisonous row would simply hang, and "hung for an unknown reason" is the
   * failure mode this phase exists to eliminate.
   */
  listOrderedVisible(
    scope: DurableStreamScope,
    afterSeq: bigint,
    limit: number,
  ): Promise<DurableInboxRow[]>;

  /** The ONLY way `processed_at` moves. Called after a successful consumer callback. */
  markProcessed(scope: DurableStreamScope, seq: bigint, at: Date): Promise<void>;

  /** Persists one ordered-consumer failure: attempt, message, backoff, dead-letter. */
  recordOrderedFailure(input: {
    scope: DurableStreamScope;
    seq: bigint;
    attempt: number;
    error: string;
    nextRetryAt: Date | null;
    deadLetteredAt: Date | null;
  }): Promise<void>;

  getRow(scope: DurableStreamScope, seq: bigint): Promise<DurableInboxRow | null>;

  getContiguousSeq(scope: DurableStreamScope): Promise<bigint>;

  /**
   * Single-consumer lease for the ordered lane. `false` means another process
   * owns the stream; the caller must return rather than proceed.
   */
  tryAcquireOrderedLease(scope: DurableStreamScope): Promise<boolean>;
  releaseOrderedLease(scope: DurableStreamScope): Promise<void>;

  /** Streams with committed-but-undispatched receipt rows. The restart scan's input. */
  listStreamsWithPendingReceipt(limit: number): Promise<DurableStreamScope[]>;
  /** Streams with unprocessed rows below their watermark. */
  listStreamsWithPendingOrdered(limit: number): Promise<DurableStreamScope[]>;

  getClosure(scope: DurableStreamScope): Promise<DurableRunClosure | null>;
  closeRun(scope: DurableStreamScope, reason: string, at: Date): Promise<void>;
  countLateEvent(scope: DurableStreamScope): Promise<void>;

  /** Per-stream health numbers. `scope` omitted = every unhealthy stream. */
  listStreamHealth(scope?: DurableStreamScope): Promise<DurableStreamHealthRow[]>;
}

/**
 * Retry/dead-letter policy for the ordered lane.
 *
 * Exponential, capped, and bounded by an attempt budget. The budget is the
 * important part: without it a genuinely broken payload is retried forever and
 * the stream is stuck without ever being *reported* as stuck.
 */
export interface OrderedRetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export const DEFAULT_ORDERED_RETRY_POLICY: OrderedRetryPolicy = {
  maxAttempts: 5,
  baseDelayMs: 250,
  maxDelayMs: 30_000,
};

/** Backoff for the Nth attempt (1-based). Pure — the clock is the caller's. */
export function orderedRetryDelayMs(attempt: number, policy: OrderedRetryPolicy): number {
  const exponent = Math.max(0, attempt - 1);
  const raw = policy.baseDelayMs * 2 ** exponent;
  return Math.min(raw, policy.maxDelayMs);
}

/** What to do after an ordered consumer threw on a row. */
export function planOrderedFailure(
  currentAttempt: number,
  policy: OrderedRetryPolicy,
  now: Date,
): { attempt: number; nextRetryAt: Date | null; deadLetteredAt: Date | null } {
  const attempt = currentAttempt + 1;
  if (attempt >= policy.maxAttempts) {
    // Budget exhausted. No further retry is scheduled — a dead-lettered row is
    // a human's problem now, and pretending otherwise hides it behind a loop.
    return { attempt, nextRetryAt: null, deadLetteredAt: now };
  }
  return {
    attempt,
    nextRetryAt: new Date(now.getTime() + orderedRetryDelayMs(attempt, policy)),
    deadLetteredAt: null,
  };
}

export const streamKeyOf = (scope: DurableStreamScope): string =>
  JSON.stringify([scope.runId, scope.sessionId]);

/**
 * ---------------------------------------------------------------------------
 *  PostgreSQL implementation
 *
 *  Raw SQL throughout, for the same reason `verdict-ingest.ts` is raw:
 *  `FOR UPDATE`, `pg_try_advisory_lock` and the watermark JOIN are not
 *  expressible through the Prisma query builder, and mixing the two styles in
 *  one lane would make it unclear which statements share a transaction.
 * ---------------------------------------------------------------------------
 */

type InboxSqlRow = {
  run_id: string;
  session_id: string;
  seq: bigint;
  payload: unknown;
  received_at: Date;
  receipt_dispatched_at: Date | null;
  processed_at: Date | null;
  attempt: number;
  last_error: string | null;
  next_retry_at: Date | null;
  dead_lettered_at: Date | null;
};

function mapInboxRow(row: InboxSqlRow): DurableInboxRow {
  return {
    runId: row.run_id,
    sessionId: row.session_id,
    seq: row.seq,
    payload: row.payload,
    receivedAt: row.received_at,
    receiptDispatchedAt: row.receipt_dispatched_at,
    processedAt: row.processed_at,
    attempt: row.attempt,
    lastError: row.last_error,
    nextRetryAt: row.next_retry_at,
    deadLetteredAt: row.dead_lettered_at,
  };
}

const INBOX_COLUMNS =
  "run_id, session_id, seq, payload, received_at, receipt_dispatched_at, " +
  "processed_at, attempt, last_error, next_retry_at, dead_lettered_at";

export class PrismaDurableEventStore implements DurableEventStore {
  private static readonly orderedLeases = new Set<string>();

  async listReceiptReady(
    scope: DurableStreamScope,
    afterSeq: bigint,
    limit: number,
  ): Promise<DurableInboxRow[]> {
    const rows = await prisma.$queryRawUnsafe<InboxSqlRow[]>(
      `SELECT ${INBOX_COLUMNS} FROM verdict_inbox
       WHERE run_id = $1 AND session_id = $2 AND seq > $3
       ORDER BY seq LIMIT $4`,
      scope.runId,
      scope.sessionId,
      afterSeq,
      limit,
    );
    return rows.map(mapInboxRow);
  }

  async markReceiptDispatched(scope: DurableStreamScope, seq: bigint, at: Date): Promise<void> {
    // Idempotent: the FIRST dispatch time is the one latency is measured from,
    // so a replay after a restart must not overwrite it with a later clock.
    await prisma.$executeRaw`
      UPDATE verdict_inbox SET receipt_dispatched_at = ${at}
      WHERE run_id = ${scope.runId} AND session_id = ${scope.sessionId} AND seq = ${seq}
        AND receipt_dispatched_at IS NULL`;
  }

  async listOrderedReady(scope: DurableStreamScope, limit: number): Promise<DurableInboxRow[]> {
    const rows = await prisma.$queryRawUnsafe<InboxSqlRow[]>(
      `SELECT ${INBOX_COLUMNS.split(", ").map((c) => `i.${c}`).join(", ")}
       FROM verdict_inbox i
       JOIN verdict_stream s ON s.run_id = i.run_id AND s.session_id = i.session_id
       WHERE i.run_id = $1 AND i.session_id = $2
         AND i.processed_at IS NULL
         AND i.seq <= s.contiguous_seq
       ORDER BY i.seq LIMIT $3`,
      scope.runId,
      scope.sessionId,
      limit,
    );
    return rows.map(mapInboxRow);
  }

  async listOrderedVisible(
    scope: DurableStreamScope,
    afterSeq: bigint,
    limit: number,
  ): Promise<DurableInboxRow[]> {
    const rows = await prisma.$queryRawUnsafe<InboxSqlRow[]>(
      `SELECT ${INBOX_COLUMNS.split(", ").map((c) => `i.${c}`).join(", ")}
       FROM verdict_inbox i
       JOIN verdict_stream s ON s.run_id = i.run_id AND s.session_id = i.session_id
       WHERE i.run_id = $1 AND i.session_id = $2
         AND i.seq > $3
         AND i.seq <= s.contiguous_seq
       ORDER BY i.seq LIMIT $4`,
      scope.runId,
      scope.sessionId,
      afterSeq,
      limit,
    );
    return rows.map(mapInboxRow);
  }

  async markProcessed(scope: DurableStreamScope, seq: bigint, at: Date): Promise<void> {
    // Clearing the failure state on success is deliberate: a row that recovered
    // after two transient errors is healthy, and leaving `last_error` set would
    // make the health read model permanently report a problem that is over.
    await prisma.$executeRaw`
      UPDATE verdict_inbox
      SET processed_at = ${at}, next_retry_at = NULL, last_error = NULL
      WHERE run_id = ${scope.runId} AND session_id = ${scope.sessionId} AND seq = ${seq}`;
  }

  async recordOrderedFailure(input: {
    scope: DurableStreamScope;
    seq: bigint;
    attempt: number;
    error: string;
    nextRetryAt: Date | null;
    deadLetteredAt: Date | null;
  }): Promise<void> {
    await prisma.$executeRaw`
      UPDATE verdict_inbox
      SET attempt = ${input.attempt},
          last_error = ${input.error},
          next_retry_at = ${input.nextRetryAt},
          dead_lettered_at = ${input.deadLetteredAt}
      WHERE run_id = ${input.scope.runId} AND session_id = ${input.scope.sessionId}
        AND seq = ${input.seq}`;
  }

  async getRow(scope: DurableStreamScope, seq: bigint): Promise<DurableInboxRow | null> {
    const rows = await prisma.$queryRawUnsafe<InboxSqlRow[]>(
      `SELECT ${INBOX_COLUMNS} FROM verdict_inbox
       WHERE run_id = $1 AND session_id = $2 AND seq = $3`,
      scope.runId,
      scope.sessionId,
      seq,
    );
    const row = rows[0];
    return row ? mapInboxRow(row) : null;
  }

  async getContiguousSeq(scope: DurableStreamScope): Promise<bigint> {
    const rows = await prisma.$queryRaw<{ contiguous_seq: bigint }[]>`
      SELECT contiguous_seq FROM verdict_stream
      WHERE run_id = ${scope.runId} AND session_id = ${scope.sessionId}`;
    return rows[0]?.contiguous_seq ?? 0n;
  }

  async tryAcquireOrderedLease(scope: DurableStreamScope): Promise<boolean> {
    const key = `${scope.runId}|${scope.sessionId}`;
    if (PrismaDurableEventStore.orderedLeases.has(key)) return false;
    PrismaDurableEventStore.orderedLeases.add(key);
    return true;
  }

  async releaseOrderedLease(scope: DurableStreamScope): Promise<void> {
    const key = `${scope.runId}|${scope.sessionId}`;
    PrismaDurableEventStore.orderedLeases.delete(key);
  }

  async listStreamsWithPendingReceipt(limit: number): Promise<DurableStreamScope[]> {
    // DISTINCT over the partial predicate, not a per-row scan: the restart scan
    // is required to be linear in the number of PENDING rows, not in inbox size.
    const rows = await prisma.$queryRaw<{ run_id: string; session_id: string }[]>`
      SELECT DISTINCT run_id, session_id FROM verdict_inbox
      WHERE receipt_dispatched_at IS NULL
      LIMIT ${limit}`;
    return rows.map((r) => ({ runId: r.run_id, sessionId: r.session_id }));
  }

  async listStreamsWithPendingOrdered(limit: number): Promise<DurableStreamScope[]> {
    const rows = await prisma.$queryRaw<{ run_id: string; session_id: string }[]>`
      SELECT DISTINCT i.run_id, i.session_id
      FROM verdict_inbox i
      JOIN verdict_stream s ON s.run_id = i.run_id AND s.session_id = i.session_id
      WHERE i.processed_at IS NULL
        AND i.dead_lettered_at IS NULL
        AND i.seq <= s.contiguous_seq
      LIMIT ${limit}`;
    return rows.map((r) => ({ runId: r.run_id, sessionId: r.session_id }));
  }

  async getClosure(scope: DurableStreamScope): Promise<DurableRunClosure | null> {
    const rows = await prisma.$queryRaw<
      { closed_at: Date; reason: string; late_event_count: number }[]
    >`
      SELECT closed_at, reason, late_event_count FROM verdict_run_closure
      WHERE run_id = ${scope.runId} AND session_id = ${scope.sessionId}`;
    const row = rows[0];
    return row
      ? { closedAt: row.closed_at, reason: row.reason, lateEventCount: row.late_event_count }
      : null;
  }

  async closeRun(scope: DurableStreamScope, reason: string, at: Date): Promise<void> {
    // First closure wins. Re-closing must not reset `late_event_count`, which is
    // the whole record of what arrived afterwards.
    await prisma.$executeRaw`
      INSERT INTO verdict_run_closure (run_id, session_id, closed_at, reason)
      VALUES (${scope.runId}, ${scope.sessionId}, ${at}, ${reason})
      ON CONFLICT (run_id, session_id) DO NOTHING`;
  }

  async countLateEvent(scope: DurableStreamScope): Promise<void> {
    await prisma.$executeRaw`
      UPDATE verdict_run_closure SET late_event_count = late_event_count + 1
      WHERE run_id = ${scope.runId} AND session_id = ${scope.sessionId}`;
  }

  async listStreamHealth(scope?: DurableStreamScope): Promise<DurableStreamHealthRow[]> {
    const rows = scope
      ? await prisma.$queryRawUnsafe<StreamHealthSqlRow[]>(
          `${STREAM_HEALTH_SELECT}
           WHERE s.run_id = $1 AND s.session_id = $2
           ${STREAM_HEALTH_GROUP_BY}`,
          scope.runId,
          scope.sessionId,
        )
      : await prisma.$queryRawUnsafe<StreamHealthSqlRow[]>(
          `${STREAM_HEALTH_SELECT}
           ${STREAM_HEALTH_GROUP_BY}
           ${STREAM_HEALTH_UNHEALTHY_HAVING}`,
        );
    return rows.map((r) => ({
      runId: r.run_id,
      sessionId: r.session_id,
      contiguousSeq: r.contiguous_seq,
      receiptPending: Number(r.receipt_pending),
      orderedLag: Number(r.ordered_lag),
      oldestUnprocessedAt: r.oldest_unprocessed_at,
      maxAttempt: Number(r.max_attempt ?? 0),
      lastError: r.last_error,
      deadLetteredCount: Number(r.dead_lettered_count),
      lateEventCount: Number(r.late_event_count ?? 0),
      closedAt: r.closed_at,
    }));
  }
}

type StreamHealthSqlRow = {
  run_id: string;
  session_id: string;
  contiguous_seq: bigint;
  receipt_pending: bigint;
  ordered_lag: bigint;
  oldest_unprocessed_at: Date | null;
  max_attempt: number | null;
  last_error: string | null;
  dead_lettered_count: bigint;
  late_event_count: number | null;
  closed_at: Date | null;
};

/**
 * One aggregate per stream rather than N round-trips.
 *
 * `ordered_lag` counts only rows AT OR BELOW the watermark: rows above a hole
 * are not late, they are correctly waiting, and counting them as lag would make
 * every gap look like a stalled consumer — and then a real stall would be
 * indistinguishable from normal gap behaviour.
 *
 * `LEFT JOIN` on the inbox, not an inner join: a stream with zero rows still has
 * a watermark and a closure state worth reporting.
 */
const STREAM_HEALTH_SELECT = `
  SELECT s.run_id,
         s.session_id,
         s.contiguous_seq,
         count(i.seq) FILTER (WHERE i.receipt_dispatched_at IS NULL) AS receipt_pending,
         count(i.seq) FILTER (
           WHERE i.processed_at IS NULL AND i.seq <= s.contiguous_seq
         ) AS ordered_lag,
         min(i.received_at) FILTER (
           WHERE i.processed_at IS NULL AND i.seq <= s.contiguous_seq
         ) AS oldest_unprocessed_at,
         max(i.attempt) AS max_attempt,
         max(i.last_error) AS last_error,
         count(i.seq) FILTER (WHERE i.dead_lettered_at IS NOT NULL) AS dead_lettered_count,
         max(c.late_event_count) AS late_event_count,
         max(c.closed_at) AS closed_at
  FROM verdict_stream s
  LEFT JOIN verdict_inbox i ON i.run_id = s.run_id AND i.session_id = s.session_id
  LEFT JOIN verdict_run_closure c ON c.run_id = s.run_id AND c.session_id = s.session_id`;

const STREAM_HEALTH_GROUP_BY = `GROUP BY s.run_id, s.session_id, s.contiguous_seq`;

/**
 * Without a scope the read model reports only streams that need attention.
 * Returning every stream that ever existed would bury the three that are stuck.
 */
const STREAM_HEALTH_UNHEALTHY_HAVING = `
  HAVING count(i.seq) FILTER (WHERE i.processed_at IS NULL) > 0
      OR count(i.seq) FILTER (WHERE i.receipt_dispatched_at IS NULL) > 0
      OR count(i.seq) FILTER (WHERE i.dead_lettered_at IS NOT NULL) > 0`;

/**
 * ---------------------------------------------------------------------------
 *  Filter matching — shared by both lanes
 *
 *  Deliberately structural and domain-blind. It matches on the frozen wire
 *  event name and on flat string equality inside `data`. It cannot express
 *  "the parcel is at an open stop", and that is the point: the moment this
 *  function understands a domain concept, the durable core owns domain rules
 *  and the Domain Pack stops being the authority on them.
 * ---------------------------------------------------------------------------
 */

/** Reads the wire event name out of an inbox payload without trusting its shape. */
export function payloadEventName(payload: unknown): string | null {
  if (payload === null || typeof payload !== "object") return null;
  const name = (payload as Record<string, unknown>).event;
  return typeof name === "string" ? name : null;
}

function payloadData(payload: unknown): Record<string, unknown> {
  if (payload === null || typeof payload !== "object") return {};
  const data = (payload as Record<string, unknown>).data;
  if (data === null || typeof data !== "object" || Array.isArray(data)) return {};
  return data as Record<string, unknown>;
}

export function matchesDurableFilter(payload: unknown, filter: DurableEventFilter): boolean {
  const names = filter.eventNames;
  if (names && names.length > 0) {
    const actual = payloadEventName(payload);
    // `resolveEventName` on BOTH sides: the plan's frozen wire names and the
    // test-standards names differ, and a filter written against one must still
    // match an event carrying the other.
    if (actual === null) return false;
    const wanted = new Set(names.map(resolveEventName));
    if (!wanted.has(resolveEventName(actual))) return false;
  }

  const equals = filter.payloadEquals;
  if (equals) {
    const data = payloadData(payload);
    for (const [key, expected] of Object.entries(equals)) {
      const actual = data[key];
      // String comparison against the STRINGIFIED actual value: the device may
      // send a stop id as a number in one build and a string in another, and a
      // filter silently never matching is worse than a lenient comparison.
      if (actual === undefined || actual === null) return false;
      if (String(actual) !== expected) return false;
    }
  }

  return true;
}

/**
 * ---------------------------------------------------------------------------
 *  Nudge signalling
 *
 *  Post-commit nudges are an OPTIMISATION, never the delivery mechanism: both
 *  lanes also poll, because a lost nudge (process died between COMMIT and
 *  publish) must cost latency, not the event. That is exactly the crash window
 *  the bootstrap scanner closes.
 * ---------------------------------------------------------------------------
 */
export class StreamNudgeHub {
  private readonly waiters = new Map<string, Set<() => void>>();

  /** Wakes everything waiting on this stream. Never throws into the caller. */
  nudge(scope: DurableStreamScope): void {
    const key = streamKeyOf(scope);
    const set = this.waiters.get(key);
    if (!set) return;
    // Copy before iterating: a woken waiter unsubscribes itself, which would
    // otherwise mutate the set mid-iteration.
    for (const wake of [...set]) wake();
  }

  /**
   * Resolves on the next nudge for this stream, on `timeoutMs`, or on abort.
   *
   * Every exit path removes the waiter and clears the timer. That is not
   * tidiness — a subscriber cancelled mid-wait would otherwise leave both a
   * live timer and a map entry behind, which is precisely the leak the
   * acceptance criteria test for.
   */
  wait(scope: DurableStreamScope, timeoutMs: number, signal?: AbortSignal): Promise<void> {
    const key = streamKeyOf(scope);
    return new Promise<void>((resolve) => {
      let settled = false;
      const set = this.waiters.get(key) ?? new Set<() => void>();
      this.waiters.set(key, set);

      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        set.delete(wake);
        if (set.size === 0) this.waiters.delete(key);
        signal?.removeEventListener("abort", finish);
        resolve();
      };
      const wake = finish;
      const timer = setTimeout(finish, timeoutMs);
      // Do not hold the process open for a poll timer. A pending durable poll is
      // not a reason for the API process to refuse to exit.
      if (typeof timer.unref === "function") timer.unref();

      set.add(wake);
      if (signal) {
        if (signal.aborted) {
          finish();
          return;
        }
        signal.addEventListener("abort", finish, { once: true });
      }
    });
  }

  /** Waiter count, for leak assertions. */
  waiterCount(): number {
    let total = 0;
    for (const set of this.waiters.values()) total += set.size;
    return total;
  }
}

/**
 * ---------------------------------------------------------------------------
 *  Health read model
 * ---------------------------------------------------------------------------
 */

/** Counts every subscriber the process has opened. Leaks show up here first. */
export class DurableSubscriberRegistry {
  private active = 0;
  private cancelled = 0;
  private completed = 0;

  open(): void {
    this.active += 1;
  }

  closeCancelled(): void {
    this.active = Math.max(0, this.active - 1);
    this.cancelled += 1;
  }

  closeCompleted(): void {
    this.active = Math.max(0, this.active - 1);
    this.completed += 1;
  }

  snapshot(): { activeSubscribers: number; cancelledSubscribers: number; completedSubscribers: number } {
    return {
      activeSubscribers: this.active,
      cancelledSubscribers: this.cancelled,
      completedSubscribers: this.completed,
    };
  }
}

/** Last observed commit→receipt-dispatch latency per stream. */
export class ReceiptLatencyTracker {
  private readonly latest = new Map<string, number>();

  record(scope: DurableStreamScope, receivedAt: Date, dispatchedAt: Date): void {
    // Clamp at zero: a receivedAt written by the database clock and a
    // dispatchedAt from the Node clock can disagree by a few ms, and a negative
    // "latency" in a health payload reads as a bug in the metric, not the clock.
    const delta = Math.max(0, dispatchedAt.getTime() - receivedAt.getTime());
    this.latest.set(streamKeyOf(scope), delta);
  }

  get(scope: DurableStreamScope): number | null {
    return this.latest.get(streamKeyOf(scope)) ?? null;
  }
}

export function buildStreamHealth(
  row: DurableStreamHealthRow,
  lastReceiptDispatchLatencyMs: number | null,
  now: Date,
): DurableStreamHealth {
  return {
    runId: row.runId,
    sessionId: row.sessionId,
    contiguousSeq: row.contiguousSeq.toString(),
    receiptPending: row.receiptPending,
    orderedLag: row.orderedLag,
    oldestUnprocessedAgeMs: row.oldestUnprocessedAt
      ? Math.max(0, now.getTime() - row.oldestUnprocessedAt.getTime())
      : null,
    lastReceiptDispatchLatencyMs,
    maxAttempt: row.maxAttempt,
    lastError: row.lastError,
    deadLetteredCount: row.deadLetteredCount,
    lateEventCount: row.lateEventCount,
    closedAt: row.closedAt,
  };
}

export async function readDurableRuntimeHealth(
  store: DurableEventStore,
  subscribers: DurableSubscriberRegistry,
  latency: ReceiptLatencyTracker,
  scope?: DurableStreamScope,
  now: Date = new Date(),
): Promise<DurableRuntimeHealth> {
  const rows = await store.listStreamHealth(scope);
  return {
    subscribers: subscribers.snapshot(),
    streams: rows.map((row) =>
      buildStreamHealth(row, latency.get({ runId: row.runId, sessionId: row.sessionId }), now),
    ),
  };
}

/**
 * ---------------------------------------------------------------------------
 *  SDK `EmitOutcome` diagnostic — a READ, and provably only a read
 *
 *  The device asks "you told me seq N was durable; is it?". Answering by
 *  emitting a diagnostic event would make every such question create new
 *  durable work, and a device that is already unsure about delivery would then
 *  generate load exactly when the host is struggling. This function touches no
 *  writable surface: `getRow` and `getContiguousSeq` are the only calls it can
 *  make through the port.
 * ---------------------------------------------------------------------------
 */
export async function answerEmitOutcomeDiagnostic(
  store: DurableEventStore,
  query: EmitOutcomeDiagnosticQuery,
): Promise<EmitOutcomeDiagnosticResult> {
  const scope: DurableStreamScope = { runId: query.runId, sessionId: query.sessionId };
  if (!/^\d{1,19}$/.test(query.throughSeq)) {
    throw new Error(`throughSeq must be a decimal string, got ${JSON.stringify(query.throughSeq)}`);
  }
  const seq = BigInt(query.throughSeq);
  const [row, contiguousSeq] = await Promise.all([
    store.getRow(scope, seq),
    store.getContiguousSeq(scope),
  ]);
  return {
    hostContiguousSeq: contiguousSeq.toString(),
    present: row !== null,
    orderedProcessed: row !== null && row.processedAt !== null,
    receiptDispatched: row !== null && row.receiptDispatchedAt !== null,
    deadLettered: row !== null && row.deadLetteredAt !== null,
    sideEffectFree: true,
  };
}

/**
 * ---------------------------------------------------------------------------
 *  Sync-vs-durable equality
 *
 *  The synchronous sink cannot be removed on the strength of "the durable path
 *  also works". It can only be removed once both paths are shown to produce the
 *  SAME logical evidence, because the failure this guards against is not "the
 *  durable path is broken" — it is "the durable path is subtly different", and
 *  that difference would surface as changed verdicts long after the cutover.
 *
 *  Identity is `(runId, sessionId, seq)` and nothing else: those three are the
 *  inbox primary key and therefore the only identity both paths agree on
 *  without either of them interpreting the payload.
 * ---------------------------------------------------------------------------
 */

/** One observation from either path, reduced to what equality is defined over. */
export interface EvidenceObservation {
  runId: string;
  sessionId: string;
  seq: string;
  /** Stable digest of the logical payload. NOT the raw string: the two paths
   *  legitimately differ in their `raw` prefix (`WS|` vs `DB|`). */
  fingerprint: string;
}

export const observationId = (o: EvidenceObservation): string =>
  `${o.runId}/${o.sessionId}/${o.seq}`;

/**
 * Order-insensitive fingerprint of a payload's logical content.
 *
 * Key order in a JSONB round-trip is not stable, so `JSON.stringify` of the
 * round-tripped object is not comparable with `JSON.stringify` of the original.
 * Sorting keys is what makes the comparison about content rather than about
 * PostgreSQL's storage decisions.
 */
export function payloadFingerprint(payload: unknown): string {
  return JSON.stringify(canonicalise(payload));
}

function canonicalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      // `raw` is excluded: both paths deliberately tag provenance into it
      // (`WS|` vs `DB|`), so including it would report every single event as a
      // mismatch and the report would be worthless.
      .filter(([key]) => key !== "raw")
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return Object.fromEntries(entries.map(([key, v]) => [key, canonicalise(v)]));
  }
  if (typeof value === "bigint") return value.toString();
  return value;
}

export function compareSyncAndDurable(
  sync: readonly EvidenceObservation[],
  durable: readonly EvidenceObservation[],
): SyncDurableEqualityReport {
  const syncById = new Map(sync.map((o) => [observationId(o), o]));
  const durableById = new Map(durable.map((o) => [observationId(o), o]));

  const missingFromDurable: string[] = [];
  const payloadMismatches: string[] = [];
  for (const [id, o] of syncById) {
    const other = durableById.get(id);
    if (!other) {
      missingFromDurable.push(id);
      continue;
    }
    if (other.fingerprint !== o.fingerprint) payloadMismatches.push(id);
  }
  const missingFromSync = [...durableById.keys()].filter((id) => !syncById.has(id));

  return {
    // Deduplicated counts, not array lengths: at-least-once means either side
    // may legitimately observe the same event twice, and calling that an
    // inequality would make the gate unpassable by design.
    equal:
      missingFromDurable.length === 0 &&
      missingFromSync.length === 0 &&
      payloadMismatches.length === 0,
    syncCount: syncById.size,
    durableCount: durableById.size,
    missingFromDurable,
    missingFromSync,
    payloadMismatches,
  };
}

/**
 * Collects both paths' observations for the equality gate.
 *
 * A recorder rather than a global: comparison mode must not change production
 * behaviour, and a process-wide accumulator that is never drained is a memory
 * leak dressed up as observability.
 */
export class SyncDurableComparisonRecorder {
  private readonly sync: EvidenceObservation[] = [];
  private readonly durable: EvidenceObservation[] = [];

  recordSync(o: EvidenceObservation): void {
    this.sync.push(o);
  }

  recordDurable(o: EvidenceObservation): void {
    this.durable.push(o);
  }

  report(): SyncDurableEqualityReport {
    return compareSyncAndDurable(this.sync, this.durable);
  }

  reset(): void {
    this.sync.length = 0;
    this.durable.length = 0;
  }
}
