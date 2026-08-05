/**
 * ===========================================================================
 *  ORDERED FAN-OUT WORKER — one consumer per stream  (plan C.5.3)
 *
 *  ⚠️ SUPERSEDED for the production path as of Faz 2. `OrderedEvidenceBus`
 *  (`verdict-ordered-evidence-bus.ts`) is what the WS server drives now: this
 *  worker has no cursor, no retry budget, no dead-letter state and no
 *  subscriber, so a poisonous row here retries forever without ever becoming
 *  visibly stuck. It is kept — not deleted — because the CP2 spikes
 *  (`cp2-*.ts`) and `verdict-ingest.integration.test.ts` exercise it as the
 *  baseline the new lane must not regress against. Both take the SAME advisory
 *  lock key, so they cannot double-process a stream during the cutover.
 *
 *  New code should use `OrderedEvidenceBus`.
 *
 *  ## Why fan-out is not on the ingest path
 *
 *  The ingest transaction releases its row lock at COMMIT. Fanning out inside it
 *  would let seq 412 reach the oracle before seq 411 whenever two frames land on
 *  different connections. The oracle's verdicts depend on order, so the ordering
 *  guarantee has to live somewhere that is serialised — here.
 *
 *  ## Why the single consumer is a DB lease, not a convention
 *
 *  "One worker per stream" was previously just an assumption. Two API processes
 *  (or one process restarted while the old event loop drained) would both process
 *  the same stream and double-fire side effects. `pg_try_advisory_lock` makes it
 *  a fact the database enforces — a second process gets `false` and returns.
 *
 *  ## Why the query JOINs
 *
 *  `contiguous_seq` lives on `verdict_stream`, not on `verdict_inbox`. An earlier
 *  revision wrote `WHERE seq <= contiguous_seq` against the inbox alone, which is
 *  not valid SQL. Nothing below the watermark is delivered, because below the
 *  watermark is exactly the region with no holes left in it.
 *
 *  ## Why an error stops the stream
 *
 *  On a consumer error the worker stops at that seq and retries later. Skipping
 *  ahead would deliver seq N+1 before N — silently converting a transient failure
 *  into a permanent ordering violation. A stalled stream is visible; a reordered
 *  one is not.
 * ===========================================================================
 */
import { prisma } from "@nesy/db";

/** Batch size per loop iteration. Ordering comes from ORDER BY, not from the limit. */
const BATCH_SIZE = 500;

export interface InboxRow {
  runId: string;
  sessionId: string;
  seq: bigint;
  payload: unknown;
}

/**
 * What the worker hands each event to.
 *
 * **Consumers must be idempotent on `(runId, sessionId, seq)`.** The worker marks
 * `processed_at` after the consumer returns, so a crash in between re-delivers
 * that one event. The alternative — marking first — would silently drop events
 * on any consumer failure, which is worse. At-least-once is the contract.
 */
export type EventConsumer = (row: InboxRow) => Promise<void>;

export interface FanoutStats {
  /** Events handed to the consumer and marked processed. */
  processed: number;
  /** True when another process held the lease; nothing was done. */
  skippedLocked: boolean;
  /** Set when the loop stopped early because the consumer threw. */
  stoppedAtSeq?: bigint;
  error?: string;
}

/**
 * Postgres advisory locks take a bigint key, so the stream identity has to be
 * hashed. `hashtext` collisions are possible in principle; a collision means two
 * unrelated streams serialise against each other — slower, never incorrect.
 * Correctness would only break if a collision let two workers run on the SAME
 * stream, which cannot happen: identical input always hashes identically.
 */
function lockKey(runId: string, sessionId: string): string {
  return `${runId}|${sessionId}`;
}

/**
 * Drains one stream's ready events in seq order.
 *
 * Returns without doing anything if another process holds the lease. Safe to
 * call on every ingest COMMIT — that is the intended trigger.
 */
export async function runFanoutOnce(
  runId: string,
  sessionId: string,
  consume: EventConsumer,
): Promise<FanoutStats> {
  const key = lockKey(runId, sessionId);
  const acquired = await prisma.$queryRaw<{ locked: boolean }[]>`
    SELECT pg_try_advisory_lock(hashtext(${key})) AS locked`;
  if (!acquired[0]?.locked) {
    return { processed: 0, skippedLocked: true };
  }

  const stats: FanoutStats = { processed: 0, skippedLocked: false };
  try {
    for (;;) {
      const rows = await prisma.$queryRaw<
        { run_id: string; session_id: string; seq: bigint; payload: unknown }[]
      >`
        SELECT i.run_id, i.session_id, i.seq, i.payload
        FROM verdict_inbox i
        JOIN verdict_stream s
          ON s.run_id = i.run_id AND s.session_id = i.session_id
        WHERE i.run_id = ${runId}
          AND i.session_id = ${sessionId}
          AND i.processed_at IS NULL
          AND i.seq <= s.contiguous_seq
        ORDER BY i.seq
        LIMIT ${BATCH_SIZE}`;
      if (rows.length === 0) break;

      for (const row of rows) {
        try {
          await consume({
            runId: row.run_id,
            sessionId: row.session_id,
            seq: row.seq,
            payload: row.payload,
          });
        } catch (err) {
          // STOP. Do not advance past a failed event.
          stats.stoppedAtSeq = row.seq;
          stats.error = err instanceof Error ? err.message : String(err);
          return stats;
        }
        await prisma.$executeRaw`
          UPDATE verdict_inbox SET processed_at = now()
          WHERE run_id = ${row.run_id} AND session_id = ${row.session_id}
            AND seq = ${row.seq}`;
        stats.processed++;
      }

      // A short batch means the ready region is drained.
      if (rows.length < BATCH_SIZE) break;
    }
    return stats;
  } finally {
    // Always released, including on the early return above — otherwise one
    // consumer error would wedge the stream until the connection died.
    await prisma.$executeRaw`SELECT pg_advisory_unlock(hashtext(${key}))`;
  }
}

/**
 * Resumes every stream that has unprocessed events below its watermark.
 *
 * Call on API start-up: `processed_at IS NULL` is the entire restart state, so
 * nothing needs to be remembered across a restart.
 */
export async function resumeAllStreams(consume: EventConsumer): Promise<FanoutStats[]> {
  const streams = await prisma.$queryRaw<{ run_id: string; session_id: string }[]>`
    SELECT DISTINCT i.run_id, i.session_id
    FROM verdict_inbox i
    JOIN verdict_stream s
      ON s.run_id = i.run_id AND s.session_id = i.session_id
    WHERE i.processed_at IS NULL
      AND i.seq <= s.contiguous_seq`;
  const out: FanoutStats[] = [];
  for (const s of streams) {
    out.push(await runFanoutOnce(s.run_id, s.session_id, consume));
  }
  return out;
}
