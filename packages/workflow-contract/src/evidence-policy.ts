/**
 * ===========================================================================
 *  Continue Gate / Final Oracle  (Plan B.10E · D.5.17 · D.5.21 · D.5.22)
 *
 *  Two questions that look alike and are not:
 *
 *    Continue Gate — "may the executor move on?" A readiness question about
 *    the automation. Its answer has no bearing on whether the product works.
 *
 *    Final Oracle — "did the business fact become true?" The only thing
 *    allowed to write a ProductVerdict.
 *
 *  Historically these were one `completionPolicy.required` array, which is why
 *  the pre-v2 engine had to report "UI passed but the required oracle never
 *  confirmed" as a prose string inside a `failed` step: there was no field for
 *  "we proceeded correctly AND the business fact is still pending".
 *
 *  Second correction in v2: obligation and timing live in ONE requirement.
 *  The old shape kept parallel `required[]` / `eventual[]` / `warning[]`
 *  arrays, so a fact listed in two of them had two contradictory truths and
 *  whichever list the reader consulted first won.
 *
 *  DOMAIN-NEUTRAL: `factKey` is an opaque, versioned string resolved by a
 *  Domain Pack Evidence Source Registry. Core never parses it.
 * ===========================================================================
 */

import type { ConditionResultValue, UnknownPolicy } from "./condition.js";

/** Boolean composition over fact keys. No nesting — deliberately flat. */
export interface EvidenceExpression {
  allOf?: readonly string[];
  anyOf?: readonly string[];
  noneOf?: readonly string[];
}

/**
 * Continue Gate policy.
 *
 * `deadlineMs` is an upper bound on an event-driven wait, NOT a sleep. The gate
 * closes the instant the expression is satisfied. A fixed-duration wait would
 * be both slower and less honest: it passes when the app is merely late and
 * fails when the device is merely slow.
 */
export interface EvidencePolicy {
  allOf?: readonly string[];
  anyOf?: readonly string[];
  noneOf?: readonly string[];
  deadlineMs: number;
  /** The condition must hold this long before the gate counts as closed. */
  stableForMs?: number;
  /**
   * Gate-specific UNKNOWN handling. `BRANCH` is not meaningful for a gate —
   * a gate has no branches — and is rejected by validation.
   */
  unknownPolicy: UnknownPolicy;
}

export type OracleObligation = "REQUIRED" | "WARNING" | "OPTIONAL" | "NOT_APPLICABLE";
export type OracleTiming = "IMMEDIATE" | "EVENTUAL";
export type OracleTimeoutAction = "FAIL" | "INCONCLUSIVE" | "WARNING";

export const ORACLE_OBLIGATIONS: readonly OracleObligation[] = [
  "REQUIRED",
  "WARNING",
  "OPTIONAL",
  "NOT_APPLICABLE",
];
export const ORACLE_TIMINGS: readonly OracleTiming[] = ["IMMEDIATE", "EVENTUAL"];
export const ORACLE_TIMEOUT_ACTIONS: readonly OracleTimeoutAction[] = ["FAIL", "INCONCLUSIVE", "WARNING"];

/**
 * One fact, one obligation, one timing. The whole point of the v2 model.
 *
 * `applicabilityCondition` replaces the pattern of duplicating a workflow to
 * express "this fact only matters offline": the requirement stays single and
 * declares when it applies.
 */
export interface OracleRequirement {
  factKey: string;
  obligation: OracleObligation;
  timing: OracleTiming;
  /** Required for EVENTUAL; meaningless for IMMEDIATE. */
  deadlineMs?: number;
  onTimeout: OracleTimeoutAction;
  applicabilityCondition?: EvidenceExpression;
}

export interface FinalOraclePolicy {
  requirements: readonly OracleRequirement[];
  /** Business composition over the same fact keys, when allOf/anyOf is needed. */
  completionExpression?: EvidenceExpression;
}

/** The two policies of a step, kept structurally separate (B.10E). */
export interface EvidenceDrivenStepPolicy {
  continueGate: EvidencePolicy;
  finalOraclePolicy: FinalOraclePolicy;
}

// ───────────────────────────────────────────────────────────────────────────
//  Legacy migration — parallel role/timing lists
// ───────────────────────────────────────────────────────────────────────────

/**
 * The pre-v2 shape. Kept only as migration *input*; never re-exported as a
 * runtime policy type, so no new code can accidentally author it.
 */
export interface LegacyParallelOracleLists {
  required?: readonly string[];
  eventual?: readonly string[];
  warning?: readonly string[];
  optional?: readonly string[];
  notApplicable?: readonly string[];
  deadlineMs?: number;
}

export interface OracleMigrationError {
  factKey: string;
  code: "AMBIGUOUS_ROLE" | "AMBIGUOUS_TIMING";
  message: string;
}

export type OracleMigrationResult =
  | { ok: true; policy: FinalOraclePolicy }
  | { ok: false; errors: readonly OracleMigrationError[] };

const OBLIGATION_LISTS = ["required", "warning", "optional", "notApplicable"] as const;

const OBLIGATION_BY_LIST: Record<(typeof OBLIGATION_LISTS)[number], OracleObligation> = {
  required: "REQUIRED",
  warning: "WARNING",
  optional: "OPTIONAL",
  notApplicable: "NOT_APPLICABLE",
};

/**
 * Folds the legacy parallel lists into unified requirements, or fails.
 *
 * `required` + `eventual` for the same fact is NOT ambiguous — those are two
 * different axes, and expressing that pair correctly is exactly why the new
 * shape exists. Two *obligation* lists for one fact, however, is a genuine
 * contradiction and must not be silently resolved by list order; that is how
 * a REQUIRED fact quietly degrades to OPTIONAL.
 */
export function migrateLegacyOracleLists(legacy: LegacyParallelOracleLists): OracleMigrationResult {
  const errors: OracleMigrationError[] = [];
  const obligations = new Map<string, OracleObligation>();

  for (const listName of OBLIGATION_LISTS) {
    for (const factKey of legacy[listName] ?? []) {
      const existing = obligations.get(factKey);
      const obligation = OBLIGATION_BY_LIST[listName];
      if (existing !== undefined && existing !== obligation) {
        errors.push({
          factKey,
          code: "AMBIGUOUS_ROLE",
          message: `fact "${factKey}" appears with conflicting obligations ${existing} and ${obligation}; resolve it in the source before migrating`,
        });
        continue;
      }
      obligations.set(factKey, obligation);
    }
  }

  const eventual = new Set(legacy.eventual ?? []);
  for (const factKey of eventual) {
    // An eventual fact that no obligation list mentions has no defined
    // strength. Guessing REQUIRED would invent a gate; guessing OPTIONAL would
    // erase one. Neither is safe.
    if (!obligations.has(factKey)) {
      errors.push({
        factKey,
        code: "AMBIGUOUS_TIMING",
        message: `fact "${factKey}" is listed as eventual but carries no obligation; it cannot be migrated without an explicit obligation`,
      });
    }
  }

  if (errors.length > 0) return { ok: false, errors };

  const requirements: OracleRequirement[] = [...obligations.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([factKey, obligation]) => {
      const timing: OracleTiming = eventual.has(factKey) ? "EVENTUAL" : "IMMEDIATE";
      const onTimeout: OracleTimeoutAction =
        obligation === "REQUIRED" ? (timing === "EVENTUAL" ? "INCONCLUSIVE" : "FAIL") : "WARNING";
      return {
        factKey,
        obligation,
        timing,
        ...(timing === "EVENTUAL" && legacy.deadlineMs !== undefined ? { deadlineMs: legacy.deadlineMs } : {}),
        onTimeout,
      };
    });

  return { ok: true, policy: { requirements } };
}

// ───────────────────────────────────────────────────────────────────────────
//  Evidence expression evaluation
// ───────────────────────────────────────────────────────────────────────────

/** Observed state of one fact. `UNKNOWN` means "not yet observed". */
export type FactState = ConditionResultValue;

export type FactLookup = (factKey: string) => FactState;

/**
 * Three-valued evaluation of an evidence expression.
 *
 * Same Kleene rules as the condition evaluator, for the same reason: a gate
 * must not close on facts it has not actually seen.
 */
export function evaluateEvidenceExpression(expression: EvidenceExpression, lookup: FactLookup): FactState {
  let sawUnknown = false;

  for (const factKey of expression.allOf ?? []) {
    const state = lookup(factKey);
    if (state === "FALSE") return "FALSE";
    if (state === "UNKNOWN") sawUnknown = true;
  }

  for (const factKey of expression.noneOf ?? []) {
    const state = lookup(factKey);
    if (state === "TRUE") return "FALSE";
    if (state === "UNKNOWN") sawUnknown = true;
  }

  const anyOf = expression.anyOf ?? [];
  if (anyOf.length > 0) {
    let satisfied = false;
    let anyUnknown = false;
    for (const factKey of anyOf) {
      const state = lookup(factKey);
      if (state === "TRUE") { satisfied = true; break; }
      if (state === "UNKNOWN") anyUnknown = true;
    }
    if (!satisfied) {
      if (anyUnknown) sawUnknown = true;
      else return "FALSE";
    }
  }

  return sawUnknown ? "UNKNOWN" : "TRUE";
}

/** Whether a requirement applies at all, given the current facts. */
export function requirementApplies(requirement: OracleRequirement, lookup: FactLookup): FactState {
  if (requirement.obligation === "NOT_APPLICABLE") return "FALSE";
  if (requirement.applicabilityCondition === undefined) return "TRUE";
  return evaluateEvidenceExpression(requirement.applicabilityCondition, lookup);
}
