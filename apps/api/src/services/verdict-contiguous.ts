/**
 * ===========================================================================
 *  INCREMENTAL `contiguous_seq` ADVANCE  (plan C.5.3a / Faz 0.2)
 *
 *  `contiguous = max{ n : [1..n] ⊆ (received ∪ gaps) }` is a DEFINITION, not an
 *  algorithm. Recomputing it per frame — inside a transaction serialised by
 *  `SELECT ... FOR UPDATE` on the stream row — scans the stream's whole inbox
 *  every time: O(rows) per frame, O(n²) per run, with all ingest serialised
 *  behind the row lock. The device side has a "200 events/s, p95 < 5 ms"
 *  budget; the host had none.
 *
 *  So the cursor only ever walks FORWARD, and everything received above a hole
 *  is parked in `pending_above` until the hole closes.
 *
 *  This module is deliberately PURE — no Prisma, no SQL, no clock. The ingest
 *  transaction reads the row, calls `advanceContiguous`, and writes the result
 *  back. That is what makes the interesting part testable without a database,
 *  which matters because every bug here is a silently wrong watermark, and a
 *  wrong watermark ACKs data the host does not actually have.
 * ===========================================================================
 */

/**
 * Hard cap on `pending_above`.
 *
 * 10 000 simultaneous holes in one stream is not a healthy stream. The cap
 * exists so a pathological case degrades into one full rescan instead of an
 * unbounded array living in a hot row.
 */
export const PENDING_ABOVE_LIMIT = 10_000;

export interface StreamCursor {
  contiguousSeq: bigint;
  /** Seqs strictly above the cursor. Sorted ascending, no duplicates. */
  pendingAbove: bigint[];
}

/** A committed gap range `[fromSeq, toSeq]`, inclusive on both ends. */
export interface GapRange {
  fromSeq: bigint;
  toSeq: bigint;
}

export interface AdvanceResult extends StreamCursor {
  /**
   * `true` when the arrival was already covered — `seq <= contiguousSeq`, or a
   * seq already parked, or inside a committed gap.
   *
   * The caller still ACKs a duplicate (re-delivery must not stall the device),
   * but it must NOT fan the event out a second time.
   */
  duplicate: boolean;
  /**
   * Set when the cap was hit. The caller must then recompute the cursor from
   * `verdict_inbox ∪ verdict_gap` and bump `full_rescan_count` — the counter is
   * the signal that these assumptions stopped holding in production.
   */
  needsFullRescan: boolean;
}

/** Sorted-array insert that keeps the invariant and reports duplicates. */
function insertSorted(sorted: bigint[], value: bigint): { list: bigint[]; existed: boolean } {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const at = sorted[mid]!;
    if (at === value) return { list: sorted, existed: true };
    if (at < value) lo = mid + 1;
    else hi = mid;
  }
  return { list: [...sorted.slice(0, lo), value, ...sorted.slice(lo)], existed: false };
}

/**
 * Drains `pending_above` from the front for as long as it continues the cursor.
 *
 * Only the front matters: the array is sorted, so once an element is not
 * `cursor + 1` no later element can be either.
 */
function drain(contiguousSeq: bigint, pendingAbove: bigint[]): StreamCursor {
  let cursor = contiguousSeq;
  let i = 0;
  while (i < pendingAbove.length) {
    const next = pendingAbove[i]!;
    // Entries at or below the cursor are already covered — a gap range can
    // swallow several parked seqs at once, so drop them rather than stopping.
    if (next <= cursor) {
      i++;
      continue;
    }
    if (next !== cursor + 1n) break;
    cursor = next;
    i++;
  }
  return { contiguousSeq: cursor, pendingAbove: i === 0 ? pendingAbove : pendingAbove.slice(i) };
}

/** Is `seq` inside any committed gap range? */
export function coveredByGap(seq: bigint, gaps: readonly GapRange[]): boolean {
  return gaps.some((g) => seq >= g.fromSeq && seq <= g.toSeq);
}

/**
 * Applies one received event seq to the cursor.
 *
 * `gaps` are the stream's already-committed gap ranges. They are needed for the
 * duplicate verdict, not for the arithmetic: an event arriving inside an
 * accepted gap must be dropped rather than fanned out, because the oracle has
 * already been told that range will never come (C.5.1c-O). Re-inserting it
 * would deliver an event AFTER a later one, breaking the ordering the whole
 * single-consumer worker exists to guarantee.
 */
export function advanceContiguous(
  cursor: StreamCursor,
  seq: bigint,
  gaps: readonly GapRange[] = [],
): AdvanceResult {
  const { contiguousSeq, pendingAbove } = cursor;

  if (seq <= contiguousSeq) {
    return { contiguousSeq, pendingAbove, duplicate: true, needsFullRescan: false };
  }
  if (coveredByGap(seq, gaps)) {
    // The host committed to skipping this range. Accept the frame, discard the
    // event, keep the cursor where it is.
    return { contiguousSeq, pendingAbove, duplicate: true, needsFullRescan: false };
  }

  if (seq === contiguousSeq + 1n) {
    const drained = drain(seq, pendingAbove);
    return { ...drained, duplicate: false, needsFullRescan: false };
  }

  // Hole: park it.
  const { list, existed } = insertSorted(pendingAbove, seq);
  if (existed) {
    return { contiguousSeq, pendingAbove, duplicate: true, needsFullRescan: false };
  }
  if (list.length > PENDING_ABOVE_LIMIT) {
    return {
      contiguousSeq,
      pendingAbove,
      duplicate: false,
      needsFullRescan: true,
    };
  }
  return { contiguousSeq, pendingAbove: list, duplicate: false, needsFullRescan: false };
}

/**
 * Applies a committed gap range to the cursor.
 *
 * ⚠️ **There is no code path that assigns the watermark to `toSeq` blindly.**
 * That was the bug in an earlier revision: on any gap frame the watermark
 * jumped to `toSeq`, which ACKs `[1..toSeq]` even when `[1..fromSeq-1]` was
 * never received. The device then deletes WAL records the host never had. The
 * range only moves the cursor when it starts exactly at `contiguousSeq + 1`.
 */
export function applyGap(cursor: StreamCursor, gap: GapRange): AdvanceResult {
  const { contiguousSeq, pendingAbove } = cursor;

  if (gap.toSeq <= contiguousSeq) {
    return { contiguousSeq, pendingAbove, duplicate: true, needsFullRescan: false };
  }
  if (gap.fromSeq !== contiguousSeq + 1n) {
    // Not adjacent — park the range's far end so the cursor can still advance
    // once the missing prefix arrives. Every seq in the range is parked;
    // the range is small by construction (a device-side journal entry).
    let list = pendingAbove;
    for (let s = gap.fromSeq > contiguousSeq + 1n ? gap.fromSeq : contiguousSeq + 1n; s <= gap.toSeq; s++) {
      const res = insertSorted(list, s);
      list = res.list;
      if (list.length > PENDING_ABOVE_LIMIT) {
        return { contiguousSeq, pendingAbove, duplicate: false, needsFullRescan: true };
      }
    }
    return { contiguousSeq, pendingAbove: list, duplicate: false, needsFullRescan: false };
  }

  const drained = drain(gap.toSeq, pendingAbove);
  return { ...drained, duplicate: false, needsFullRescan: false };
}

/**
 * Full recomputation from persisted state. The fallback for a `pending_above`
 * overflow, and the proof that the cache is only a cache: `contiguous_seq` is
 * always reproducible from `verdict_inbox ∪ verdict_gap` alone, so a host
 * restart converges on the same value.
 */
export function recomputeContiguous(
  receivedSeqs: readonly bigint[],
  gaps: readonly GapRange[],
): bigint {
  const covered = new Set(receivedSeqs.map(String));
  const sortedGaps = [...gaps].sort((a, b) => (a.fromSeq < b.fromSeq ? -1 : 1));
  let cursor = 0n;
  for (;;) {
    const next = cursor + 1n;
    if (covered.has(String(next))) {
      cursor = next;
      continue;
    }
    const gap = sortedGaps.find((g) => next >= g.fromSeq && next <= g.toSeq);
    if (gap) {
      cursor = gap.toSeq;
      continue;
    }
    return cursor;
  }
}
