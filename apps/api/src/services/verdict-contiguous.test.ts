/**
 * Tests for the incremental contiguous cursor (plan C.5.3a).
 *
 * The property that matters is stated once and then checked from several angles:
 * **the incremental cursor must equal the full recomputation, always.** Any
 * divergence is a watermark that ACKs data the host does not have, which makes
 * the device delete a WAL record for good.
 */
import { describe, expect, it } from "vitest";
import {
  PENDING_ABOVE_LIMIT,
  advanceContiguous,
  applyGap,
  recomputeContiguous,
  type GapRange,
  type StreamCursor,
} from "./verdict-contiguous.js";

const start = (): StreamCursor => ({ contiguousSeq: 0n, pendingAbove: [] });

/** Feeds a mixed arrival order and returns both the incremental and full result. */
function replay(arrivals: readonly (bigint | GapRange)[]) {
  let cursor = start();
  const received: bigint[] = [];
  const gaps: GapRange[] = [];
  const duplicates: string[] = [];
  for (const item of arrivals) {
    if (typeof item === "bigint") {
      const res = advanceContiguous(cursor, item, gaps);
      if (res.duplicate) duplicates.push(String(item));
      else received.push(item);
      cursor = { contiguousSeq: res.contiguousSeq, pendingAbove: res.pendingAbove };
    } else {
      const res = applyGap(cursor, item);
      if (!res.duplicate) gaps.push(item);
      cursor = { contiguousSeq: res.contiguousSeq, pendingAbove: res.pendingAbove };
    }
  }
  return {
    incremental: cursor.contiguousSeq,
    full: recomputeContiguous(received, gaps),
    cursor,
    duplicates,
  };
}

describe("advanceContiguous", () => {
  it("in-order arrivals advance one at a time", () => {
    const r = replay([1n, 2n, 3n]);
    expect(r.incremental).toBe(3n);
    expect(r.cursor.pendingAbove).toEqual([]);
  });

  it("a hole stops the cursor and parks the far side", () => {
    const r = replay([1n, 3n, 4n]);
    expect(r.incremental).toBe(1n);
    expect(r.cursor.pendingAbove).toEqual([3n, 4n]);
  });

  it("closing the hole drains everything parked behind it", () => {
    const r = replay([1n, 3n, 4n, 5n, 2n]);
    expect(r.incremental).toBe(5n);
    expect(r.cursor.pendingAbove).toEqual([]);
  });

  it("out-of-order arrivals converge on the same cursor as in-order ones", () => {
    const shuffled = replay([5n, 2n, 4n, 1n, 3n]);
    const ordered = replay([1n, 2n, 3n, 4n, 5n]);
    expect(shuffled.incremental).toBe(ordered.incremental);
    expect(shuffled.incremental).toBe(5n);
  });

  it("re-delivery below the cursor is a duplicate and moves nothing", () => {
    let cursor = start();
    for (const s of [1n, 2n, 3n]) {
      const r = advanceContiguous(cursor, s);
      cursor = { contiguousSeq: r.contiguousSeq, pendingAbove: r.pendingAbove };
    }
    const again = advanceContiguous(cursor, 2n);
    expect(again.duplicate).toBe(true);
    expect(again.contiguousSeq).toBe(3n);
  });

  it("re-delivery of a parked seq is a duplicate, not a second park", () => {
    let cursor = start();
    const first = advanceContiguous(cursor, 5n);
    cursor = { contiguousSeq: first.contiguousSeq, pendingAbove: first.pendingAbove };
    const second = advanceContiguous(cursor, 5n);
    expect(second.duplicate).toBe(true);
    expect(second.pendingAbove).toEqual([5n]);
  });

  it("incremental always equals full recomputation across many orders", () => {
    // Deterministic permutations rather than random input: a failing case has to
    // be reproducible from the test source alone.
    const orders: bigint[][] = [
      [1n, 2n, 3n, 4n, 5n, 6n],
      [6n, 5n, 4n, 3n, 2n, 1n],
      [2n, 4n, 6n, 1n, 3n, 5n],
      [3n, 1n, 5n, 2n, 6n, 4n],
      [1n, 3n, 2n, 6n, 4n, 5n],
      [4n, 5n, 6n, 1n, 2n, 3n],
    ];
    for (const order of orders) {
      const r = replay(order);
      expect(r.incremental, `order ${order.join(",")}`).toBe(r.full);
      expect(r.incremental).toBe(6n);
    }
  });

  it("a missing prefix keeps the cursor at 0 no matter how much arrives after", () => {
    const r = replay([2n, 3n, 4n, 5n]);
    expect(r.incremental).toBe(0n);
    expect(r.incremental).toBe(r.full);
  });

  it("overflowing pending_above asks for a rescan instead of growing unbounded", () => {
    let cursor = start();
    // Park PENDING_ABOVE_LIMIT entries, all above a permanent hole at 1.
    for (let i = 0; i < PENDING_ABOVE_LIMIT; i++) {
      const r = advanceContiguous(cursor, BigInt(i + 2));
      cursor = { contiguousSeq: r.contiguousSeq, pendingAbove: r.pendingAbove };
      expect(r.needsFullRescan).toBe(false);
    }
    expect(cursor.pendingAbove).toHaveLength(PENDING_ABOVE_LIMIT);
    const over = advanceContiguous(cursor, BigInt(PENDING_ABOVE_LIMIT + 2));
    expect(over.needsFullRescan).toBe(true);
    // The cursor and the array are left UNCHANGED so the caller can recompute
    // from persisted state rather than from a half-mutated cache.
    expect(over.contiguousSeq).toBe(cursor.contiguousSeq);
    expect(over.pendingAbove).toHaveLength(PENDING_ABOVE_LIMIT);
  });

  it("seq beyond 2^53 is handled exactly (BigInt, not number)", () => {
    // The wire carries seq as a decimal string for exactly this reason. If this
    // used `number`, 2^53+1 and 2^53+2 would collide and the cursor would skip.
    const base = 9_007_199_254_740_992n;
    let cursor: StreamCursor = { contiguousSeq: base, pendingAbove: [] };
    const a = advanceContiguous(cursor, base + 1n);
    cursor = { contiguousSeq: a.contiguousSeq, pendingAbove: a.pendingAbove };
    const b = advanceContiguous(cursor, base + 2n);
    expect(b.contiguousSeq).toBe(base + 2n);
    expect(b.duplicate).toBe(false);
  });
});

describe("applyGap", () => {
  it("an adjacent gap advances the cursor to its far end", () => {
    const r = replay([1n, { fromSeq: 2n, toSeq: 5n }, 6n]);
    expect(r.incremental).toBe(6n);
  });

  it("a NON-adjacent gap does NOT jump the watermark to toSeq", () => {
    // This is the bug an earlier revision shipped: any gap frame moved the
    // watermark to toSeq, so [1..toSeq] was ACKed while [1..fromSeq-1] had never
    // arrived — the device then dropped WAL records the host never held.
    const r = replay([1n, { fromSeq: 4n, toSeq: 9n }]);
    expect(r.incremental).toBe(1n);
    expect(r.incremental).toBe(r.full);
  });

  it("the missing prefix arriving later closes the gap and the cursor jumps once", () => {
    const r = replay([1n, { fromSeq: 4n, toSeq: 9n }, 3n, 2n]);
    expect(r.incremental).toBe(9n);
    expect(r.incremental).toBe(r.full);
  });

  it("an event inside an accepted gap is dropped even with an empty pending_above", () => {
    // C.5.1c-O: the oracle has already been told that range will never come, so
    // re-inserting the seq would deliver it out of order.
    //
    // The state here is the one that occurs AFTER a full rescan: the cursor sits
    // below the gap and `pending_above` has been cleared, so nothing else can
    // recognise seq 5 as covered. `coveredByGap` is the only guard left.
    //
    // An earlier version of this test used an ADJACENT gap, where the cursor had
    // already moved past 5 and `seq <= contiguousSeq` caught it first — so the
    // guard was never reached and removing it broke no test. Verified by
    // mutation: with the guard disabled, this case now fails and that one did not.
    const gaps: GapRange[] = [{ fromSeq: 4n, toSeq: 9n }];
    const postRescan: StreamCursor = { contiguousSeq: 1n, pendingAbove: [] };
    const res = advanceContiguous(postRescan, 5n, gaps);
    expect(res.duplicate).toBe(true);
    expect(res.pendingAbove).toEqual([]);
    expect(res.contiguousSeq).toBe(1n);
  });

  it("a late event inside a gap the cursor already passed is a duplicate too", () => {
    const r = replay([1n, { fromSeq: 2n, toSeq: 9n }, 5n]);
    expect(r.duplicates).toContain("5");
    expect(r.incremental).toBe(9n);
  });

  it("a gap entirely below the cursor is a duplicate", () => {
    const r = replay([1n, 2n, 3n, { fromSeq: 2n, toSeq: 3n }]);
    expect(r.incremental).toBe(3n);
  });

  it("a gap starting at 1 is adjacent to the initial cursor", () => {
    const r = replay([{ fromSeq: 1n, toSeq: 4n }, 5n]);
    expect(r.incremental).toBe(5n);
  });

  it("two gaps that meet end-to-end both advance the cursor", () => {
    const r = replay([{ fromSeq: 1n, toSeq: 3n }, { fromSeq: 4n, toSeq: 6n }]);
    expect(r.incremental).toBe(6n);
    expect(r.incremental).toBe(r.full);
  });

  it("gaps arriving out of order still converge", () => {
    const r = replay([{ fromSeq: 4n, toSeq: 6n }, { fromSeq: 1n, toSeq: 3n }]);
    expect(r.incremental).toBe(6n);
    expect(r.incremental).toBe(r.full);
  });
});

describe("recomputeContiguous", () => {
  it("reproduces the cursor from persisted state alone", () => {
    // pending_above is a cache; correctness may not depend on it surviving a
    // restart. This is what makes that claim true.
    expect(recomputeContiguous([1n, 2n, 4n, 5n], [])).toBe(2n);
    expect(recomputeContiguous([1n, 2n, 5n], [{ fromSeq: 3n, toSeq: 4n }])).toBe(5n);
    expect(recomputeContiguous([], [{ fromSeq: 1n, toSeq: 100n }])).toBe(100n);
    expect(recomputeContiguous([2n, 3n], [])).toBe(0n);
  });

  it("does not treat a gap starting above the hole as coverage", () => {
    expect(recomputeContiguous([1n], [{ fromSeq: 3n, toSeq: 9n }])).toBe(1n);
  });
});
