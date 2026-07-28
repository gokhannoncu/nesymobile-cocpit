/**
 * ===========================================================================
 *  VERDICT INGEST — one durable transaction, then the ACK  (plan C.5.3)
 *
 *  ## Why the ACK is last
 *
 *  An earlier design ACKed straight after parsing. If the host then died
 *  between ACK and fan-out, the device had already deleted its WAL record and
 *  the event was gone for good — at-least-once was unachievable. The insert and
 *  the watermark move inside ONE transaction; the ACK goes out only after
 *  COMMIT. Anything the device is told is durable, is durable.
 *
 *  ## Why the watermark moves in the same transaction
 *
 *  It used to be updated before the insert. A failed insert then left an
 *  in-memory tracker ahead of reality, and the next successful frame ACKed a seq
 *  the host never stored. Both writes are now in the same transaction or
 *  neither happens.
 *
 *  ## Why raw SQL
 *
 *  `SELECT ... FOR UPDATE`, `array_append`, and `pg_try_advisory_lock` are not
 *  expressible through the Prisma query builder. The row lock is not optional:
 *  two connections advancing the same cursor concurrently would interleave
 *  read-modify-write and lose one of the advances.
 *
 *  ## Fan-out is NOT here
 *
 *  The ingest path never fans out. It was tempting — the event is right there —
 *  but the lock is released at COMMIT, so seq 412 could reach consumers before
 *  seq 411. Ordering is the whole point of the separate single-consumer worker
 *  in `verdict-fanout.ts`.
 * ===========================================================================
 */
import { prisma } from "@nesy/db";

import {
  advanceContiguous,
  applyGap,
  recomputeContiguous,
  PENDING_ABOVE_LIMIT,
  type GapRange,
  type StreamCursor,
} from "./verdict-contiguous.js";
import { StreamSerialiser } from "./verdict-stream-order.js";

const streamSerialiser = new StreamSerialiser();

/**
 * The transaction client type, derived from the client rather than imported from
 * `@prisma/client` — the generated namespace is not part of this app's public
 * dependency surface and importing it makes the app's build depend on which
 * generator ran last.
 */
type TxClient = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;


/** An event frame the device sent over the WebSocket. */
export interface EventFrame {
  kind: "event";
  runId: string;
  sessionId: string;
  /**
   * Decimal STRING on the wire, not a number.
   *
   * seq is a Kotlin `Long`; past 2^53 `JSON.parse` silently rounds it and two
   * distinct events collapse into one. The golden fixture corpus pins that
   * boundary (`structured/fields__large-seq.json`).
   */
  seq: string;
  payload: unknown;
}

/** A `BRIDGE_SEQUENCE_GAP` frame: a range the device will never send. */
export interface GapFrame {
  kind: "gap";
  runId: string;
  sessionId: string;
  /** Stream-scoped monotonic counter, persisted in the device's journal header. */
  generation: string;
  fromSeq: string;
  toSeq: string;
  reason: string;
}

export type IngestFrame = EventFrame | GapFrame;

export type IngestResult =
  | {
      ok: true;
      /** Send `event_ack` with this. Always the post-COMMIT value. */
      lastContiguousSeq: bigint;
      /** Set for a gap frame: send `gap_ack` with it so the device may clear its journal entry. */
      ackGeneration?: bigint;
      /** True when nothing new was stored. Still ACKed; must NOT be fanned out. */
      duplicate: boolean;
      /** True when the pending_above cap forced a recomputation from persisted state. */
      fullRescan: boolean;
    }
  | {
      ok: false;
      code: "PROTOCOL_VIOLATION" | "INVALID_FRAME" | "DB_ERROR";
      detail: string;
    };

/** Parses a decimal seq string into BigInt, rejecting anything lossy or absurd. */
function parseSeq(raw: string, field: string): bigint {
  if (!/^\d{1,19}$/.test(raw)) {
    throw new Error(`${field} must be a decimal string, got ${JSON.stringify(raw)}`);
  }
  const value = BigInt(raw);
  if (value < 1n) throw new Error(`${field} must be >= 1, got ${raw}`);
  return value;
}

type StreamRow = {
  contiguous_seq: bigint;
  pending_above: bigint[];
  full_rescan_count: number;
};

/**
 * Loads and LOCKS the stream row, creating it on first sight.
 *
 * The insert-then-lock order matters: `ON CONFLICT DO NOTHING` followed by
 * `SELECT ... FOR UPDATE` is safe under concurrency, whereas checking for
 * existence first and inserting after would let two connections both insert.
 */
async function lockStream(
  tx: TxClient,
  runId: string,
  sessionId: string,
): Promise<StreamRow> {
  await tx.$executeRaw`
    INSERT INTO verdict_stream (run_id, session_id, updated_at)
    VALUES (${runId}, ${sessionId}, now())
    ON CONFLICT (run_id, session_id) DO NOTHING`;
  const rows = await tx.$queryRaw<StreamRow[]>`
    SELECT contiguous_seq, pending_above, full_rescan_count
    FROM verdict_stream
    WHERE run_id = ${runId} AND session_id = ${sessionId}
    FOR UPDATE`;
  const row = rows[0];
  if (!row) throw new Error("verdict_stream row vanished after upsert");
  return row;
}

async function loadGaps(
  tx: TxClient,
  runId: string,
  sessionId: string,
): Promise<GapRange[]> {
  const rows = await tx.$queryRaw<{ from_seq: bigint; to_seq: bigint }[]>`
    SELECT from_seq, to_seq FROM verdict_gap
    WHERE run_id = ${runId} AND session_id = ${sessionId}
    ORDER BY from_seq`;
  return rows.map((r: { from_seq: bigint; to_seq: bigint }) => ({ fromSeq: r.from_seq, toSeq: r.to_seq }));
}

async function writeCursor(
  tx: TxClient,
  runId: string,
  sessionId: string,
  cursor: StreamCursor,
  rescanDelta: number,
): Promise<void> {
  await tx.$executeRaw`
    UPDATE verdict_stream
    SET contiguous_seq = ${cursor.contiguousSeq},
        pending_above = ${cursor.pendingAbove}::bigint[],
        full_rescan_count = full_rescan_count + ${rescanDelta},
        updated_at = now()
    WHERE run_id = ${runId} AND session_id = ${sessionId}`;
}

/** Recomputes the cursor from persisted state after a pending_above overflow. */
async function fullRescan(
  tx: TxClient,
  runId: string,
  sessionId: string,
  gaps: readonly GapRange[],
): Promise<StreamCursor> {
  const rows = await tx.$queryRaw<{ seq: bigint }[]>`
    SELECT seq FROM verdict_inbox
    WHERE run_id = ${runId} AND session_id = ${sessionId}
    ORDER BY seq`;
  return {
    contiguousSeq: recomputeContiguous(rows.map((r: { seq: bigint }) => r.seq), gaps),
    // Cleared on purpose: after a rescan the cursor is authoritative and the
    // cache starts empty. `coveredByGap` is what keeps events inside accepted
    // gaps out of the inbox in this state.
    pendingAbove: [],
  };
}

/**
 * Handles one frame end-to-end. Returns what to ACK, or why not to.
 *
 * The transaction is intentionally small: lock one row, write at most two rows,
 * commit. Nothing that can block on the network happens inside it.
 */
export async function ingestFrame(frame: IngestFrame): Promise<IngestResult> {
  let runId: string;
  let sessionId: string;
  try {
    runId = frame.runId;
    sessionId = frame.sessionId;
    if (!runId || !sessionId) throw new Error("runId and sessionId are required");
  } catch (err) {
    return { ok: false, code: "INVALID_FRAME", detail: String(err) };
  }

  try {
    return await streamSerialiser.run(runId, sessionId, () => prisma.$transaction(async (tx) => {
      const row = await lockStream(tx, runId, sessionId);
      const gaps = await loadGaps(tx, runId, sessionId);
      let cursor: StreamCursor = {
        contiguousSeq: row.contiguous_seq,
        pendingAbove: row.pending_above,
      };

      if (frame.kind === "gap") {
        const generation = parseSeq(frame.generation, "generation");
        const fromSeq = parseSeq(frame.fromSeq, "fromSeq");
        const toSeq = parseSeq(frame.toSeq, "toSeq");
        if (toSeq < fromSeq) {
          return {
            ok: false as const,
            code: "INVALID_FRAME" as const,
            detail: `toSeq ${toSeq} < fromSeq ${fromSeq}`,
          };
        }

        const inserted = await tx.$executeRaw`
          INSERT INTO verdict_gap (run_id, session_id, generation, from_seq, to_seq, reason)
          VALUES (${runId}, ${sessionId}, ${generation}, ${fromSeq}, ${toSeq}, ${frame.reason})
          ON CONFLICT (run_id, session_id, generation) DO NOTHING`;

        if (inserted === 0) {
          // Same generation already stored. Verify it describes the SAME range.
          //
          // Silently treating a conflict as "accepted" would be the worst
          // possible outcome: the device clears the journal entry for a range the
          // host never recorded. Generations are immutable on the device — a merge
          // is a NEW generation — so a mismatch here is a protocol violation, not
          // a race.
          const existing = await tx.$queryRaw<
            { from_seq: bigint; to_seq: bigint; reason: string }[]
          >`
            SELECT from_seq, to_seq, reason FROM verdict_gap
            WHERE run_id = ${runId} AND session_id = ${sessionId}
              AND generation = ${generation}`;
          const prev = existing[0];
          if (!prev) throw new Error("gap row vanished after conflict");
          if (prev.from_seq !== fromSeq || prev.to_seq !== toSeq || prev.reason !== frame.reason) {
            // Roll back by throwing: no ACK, and an alarm worth waking someone.
            throw new GapConflictError(
              `generation ${generation} already stored as ` +
                `[${prev.from_seq}..${prev.to_seq}] reason=${prev.reason}, ` +
                `re-sent as [${fromSeq}..${toSeq}] reason=${frame.reason}`,
            );
          }
        }

        const res = applyGap(cursor, { fromSeq, toSeq });
        let rescanDelta = 0;
        if (res.needsFullRescan) {
          cursor = await fullRescan(tx, runId, sessionId, [...gaps, { fromSeq, toSeq }]);
          rescanDelta = 1;
        } else {
          cursor = { contiguousSeq: res.contiguousSeq, pendingAbove: res.pendingAbove };
        }
        await writeCursor(tx, runId, sessionId, cursor, rescanDelta);
        return {
          ok: true as const,
          lastContiguousSeq: cursor.contiguousSeq,
          ackGeneration: generation,
          duplicate: inserted === 0,
          fullRescan: rescanDelta === 1,
        };
      }

      // --- event frame ---
      const seq = parseSeq(frame.seq, "seq");
      const res = advanceContiguous(cursor, seq, gaps);

      // A duplicate, or a seq inside an accepted gap, is NOT inserted. Both are
      // still ACKed — refusing to ACK a re-delivery would stall the device
      // forever on a record the host already has.
      if (!res.duplicate) {
        await tx.$executeRaw`
          INSERT INTO verdict_inbox (run_id, session_id, seq, payload)
          VALUES (${runId}, ${sessionId}, ${seq}, ${JSON.stringify(frame.payload)}::jsonb)
          ON CONFLICT (run_id, session_id, seq) DO NOTHING`;
      }

      let rescanDelta = 0;
      if (res.needsFullRescan) {
        cursor = await fullRescan(tx, runId, sessionId, gaps);
        rescanDelta = 1;
      } else {
        cursor = { contiguousSeq: res.contiguousSeq, pendingAbove: res.pendingAbove };
      }
      await writeCursor(tx, runId, sessionId, cursor, rescanDelta);
      return {
        ok: true as const,
        lastContiguousSeq: cursor.contiguousSeq,
        duplicate: res.duplicate,
        fullRescan: rescanDelta === 1,
      };
    }));
  } catch (err) {
    if (err instanceof GapConflictError) {
      return { ok: false, code: "PROTOCOL_VIOLATION", detail: err.message };
    }
    return {
      ok: false,
      code: "DB_ERROR",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Same generation, different range — the device's journal and ours disagree. */
export class GapConflictError extends Error {}

export { PENDING_ABOVE_LIMIT };
