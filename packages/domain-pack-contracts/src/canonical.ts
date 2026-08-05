/**
 * ===========================================================================
 *  Canonical serialization and digest primitives  (Plan D.6B.14 · 4B.12)
 *
 *  A Domain Pack digest is how a verdict from six months ago says "this is
 *  exactly the pack I was judged by". That guarantee dies if the digest depends
 *  on anything other than content.
 *
 *  `JSON.stringify` alone does not qualify: it preserves insertion order, so the
 *  same pack assembled by two code paths — or read back from two stores —
 *  digests differently. The snapshots would be flaky, someone would mark them
 *  skipped, and the guarantee would be gone.
 *
 *  Canonical form: object keys sorted, `undefined` members dropped (absent is
 *  not null), array order preserved (order is semantics in a provider chain or a
 *  step list), no whitespace. Non-finite numbers are refused rather than coerced
 *  — `JSON.stringify(NaN)` yields `null`, which would make two different broken
 *  packs digest identically.
 *
 *  This mirrors `@nesy/workflow-contract`'s `canonicalize.ts` deliberately: the
 *  two digests must be computed the same way, or a pack digest and a plan hash
 *  would disagree about what "the same content" means.
 * ===========================================================================
 */

import { createHash } from "node:crypto";

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

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

/** Canonical JSON text for any declarative pack document. */
export function canonicalizeDomainDocument(document: unknown): string {
  return JSON.stringify(canonicalizeValue(document, "$"));
}

/**
 * SHA-256 of the canonical form, algorithm-prefixed.
 *
 * The prefix matters when the digest lands in a database column that outlives
 * the code that wrote it.
 */
export function digestDomainDocument(document: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalizeDomainDocument(document), "utf8").digest("hex")}`;
}

/** Content equality by canonical form, ignoring key order. */
export function domainDocumentsEqual(a: unknown, b: unknown): boolean {
  return canonicalizeDomainDocument(a) === canonicalizeDomainDocument(b);
}
