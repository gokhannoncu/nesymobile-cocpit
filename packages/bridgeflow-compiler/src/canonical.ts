/**
 * Deterministic canonicalization and plan hashing  (Plan D.7.3 · Phase 4C)
 *
 * Same input MUST produce the same BridgeFlowPlan hash. Key rules:
 *   - Object keys sorted recursively
 *   - undefined dropped, null preserved
 *   - Array order preserved
 *   - Non-finite numbers refused
 *   - Derived graph/reducer digest included in plan hash
 *
 * This mirrors @nesy/workflow-contract's canonicalize.ts and
 * @nesy/domain-pack-contracts' canonical.ts by design.
 */

import { createHash } from "node:crypto";
import type { BridgeFlowPlan, BridgeFlowPlanHash, CompileProvenance } from "./bridgeflow-plan.js";

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** Recursively canonicalize a value — deterministic key order, no undefined, no NaN. */
export function canonicalizeValue(value: unknown, path: string): Json | undefined {
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

  if (value instanceof Map) {
    const sorted = [...value.entries()].sort(([a], [b]) => String(a).localeCompare(String(b)));
    const out: Record<string, Json> = {};
    for (const [key, val] of sorted) {
      const canonical = canonicalizeValue(val, `${path}.${String(key)}`);
      if (canonical !== undefined) out[String(key)] = canonical;
    }
    return out;
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

/** Canonical JSON text for any compiler document. */
export function canonicalizePlanDocument(document: unknown): string {
  return JSON.stringify(canonicalizeValue(document, "$"));
}

/** SHA-256 of the canonical form, algorithm-prefixed. */
export function digestPlanDocument(document: unknown): string {
  return `sha256:${createHash("sha256").update(canonicalizePlanDocument(document), "utf8").digest("hex")}`;
}

/** Content equality by canonical form, ignoring key order. */
export function planDocumentsEqual(a: unknown, b: unknown): boolean {
  return canonicalizePlanDocument(a) === canonicalizePlanDocument(b);
}

/**
 * Compute the plan hash from the plan content (excluding the hash field itself).
 * Includes the derived graph digest in the hash input.
 *
 * `provenance.compiledAt` is intentionally excluded. It is audit metadata about
 * this compilation event, not executable plan content; including it would make
 * the same workflow/bundle/device input produce a different hash on every run.
 */
export function computePlanHash(plan: Omit<BridgeFlowPlan, "hash">): BridgeFlowPlanHash {
  const digest = createHash("sha256")
    .update(canonicalizePlanDocument(planHashDocument(plan)), "utf8")
    .digest("hex");
  return { algorithm: "sha256", digest: `sha256:${digest}` };
}

function planHashDocument(plan: Omit<BridgeFlowPlan, "hash">): Omit<BridgeFlowPlan, "hash"> {
  return {
    ...plan,
    provenance: {
      ...plan.provenance,
      compiledAt: "<excluded-from-plan-hash>",
    },
  };
}

/**
 * Build CompileProvenance from compilation inputs.
 */
export function buildProvenance(opts: {
  packKey: string;
  packVersion: string;
  packDigest: string;
  workflowRef: string;
  workflowVersion: number;
  irHash: string;
  derivedGraphDigest: string;
  sourceCommit?: string;
}): CompileProvenance {
  return {
    compiledAt: new Date().toISOString(),
    compilerVersion: "0.1.0",
    packKey: opts.packKey,
    packVersion: opts.packVersion,
    packDigest: opts.packDigest,
    workflowRef: opts.workflowRef,
    workflowVersion: opts.workflowVersion,
    irHash: opts.irHash,
    derivedGraphDigest: opts.derivedGraphDigest,
    sourceCommit: opts.sourceCommit,
  };
}
