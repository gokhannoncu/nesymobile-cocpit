/**
 * ===========================================================================
 *  Canonical serialization and plan hash  (Plan D.6A.6 · RUN_PLAY 4A.9)
 *
 *  A plan hash is how a run says "this is exactly the plan I executed" months
 *  later, and how CI notices that a refactor changed a workflow's meaning. Both
 *  uses collapse if the hash depends on anything other than content.
 *
 *  `JSON.stringify` alone does not qualify: it preserves insertion order, so the
 *  same workflow built by two code paths — or read back from two databases —
 *  hashes differently. The golden snapshots would then be flaky, someone would
 *  mark them `.skip`, and the guarantee would be gone.
 *
 *  Canonical form here means: object keys sorted, `undefined` members dropped
 *  (they are absent, not null), array order preserved (order is semantics in a
 *  step list), and no whitespace.
 * ===========================================================================
 */

import { createHash } from "node:crypto";
import type { WorkflowIrV2 } from "./ir-v2.js";

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/**
 * Recursively canonicalizes a value.
 *
 * Non-finite numbers are refused rather than coerced: `JSON.stringify(NaN)`
 * yields `null`, which would make two different broken plans hash identically.
 */
function canonicalizeValue(value: unknown, path: string): Json | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`cannot canonicalize non-finite number at ${path}`);
    }
    return value;
  }
  if (typeof value === "string" || typeof value === "boolean") return value;

  if (Array.isArray(value)) {
    // Array order is meaningful (step order, requirement order), so it is
    // preserved. Holes and undefined members become null to keep positions.
    return value.map((item, i) => canonicalizeValue(item, `${path}[${i}]`) ?? null);
  }

  if (typeof value === "object") {
    const source = value as Record<string, unknown>;
    const out: Record<string, Json> = {};
    for (const key of Object.keys(source).sort()) {
      const canonical = canonicalizeValue(source[key], `${path}.${key}`);
      if (canonical !== undefined) out[key] = canonical;
    }
    return out;
  }

  throw new Error(`cannot canonicalize ${typeof value} at ${path}`);
}

/** Canonical JSON text for an IR document. Stable across key orderings. */
export function canonicalizeWorkflowIrV2(ir: WorkflowIrV2): string {
  const canonical = canonicalizeValue(ir, "$");
  return JSON.stringify(canonical);
}

/**
 * SHA-256 of the canonical form, prefixed so the algorithm is visible in logs.
 *
 * The prefix matters when the digest ends up in a database column that outlives
 * the code that wrote it.
 */
export function hashWorkflowIrV2(ir: WorkflowIrV2): string {
  return `sha256:${createHash("sha256").update(canonicalizeWorkflowIrV2(ir), "utf8").digest("hex")}`;
}

/** Content equality by canonical form, ignoring key order. */
export function workflowIrEquals(a: WorkflowIrV2, b: WorkflowIrV2): boolean {
  return canonicalizeWorkflowIrV2(a) === canonicalizeWorkflowIrV2(b);
}
