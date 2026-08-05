/**
 * ===========================================================================
 *  Condition AST  (Plan B.10 · D.6)
 *
 *  Conditions are a typed tree, never a string that some evaluator hands to
 *  `eval`, `new Function` or a template engine. Three reasons, all of them
 *  load-bearing:
 *
 *    1. A workflow is authored in a UI and stored in a database. Anything that
 *       reaches an interpreter from there is remote code execution.
 *    2. A free expression cannot be statically checked. `stop.count > 3` would
 *       compile fine against an operand namespace that never defines it, and
 *       fail at 2am on a device.
 *    3. Explainability. "Why did this branch run?" must be answerable from a
 *       persisted snapshot of the operands, which requires knowing what the
 *       operands *were* — a string does not tell you that.
 *
 *  DOMAIN-NEUTRAL: operand *namespaces* are fixed here; the paths under them
 *  are opaque strings resolved by a Domain Pack at runtime.
 * ===========================================================================
 */

/**
 * Allowlisted operand namespaces (B.10).
 *
 * A closed union: an operand from an unlisted namespace is a validation error,
 * not a runtime `UNKNOWN`. Typos must fail at authoring time.
 */
export type ConditionOperandSource =
  | "run.input"
  | "device.capability"
  | "sdk.state"
  | "sdk.event"
  | "bridge.node"
  | "bridge.visible"
  | "bridge.obscuredBy"
  | "step.output"
  | "loop.item"
  | "local.result"
  | "remote.result"
  | "environment"
  | "country";

export const CONDITION_OPERAND_SOURCES: readonly ConditionOperandSource[] = [
  "run.input",
  "device.capability",
  "sdk.state",
  "sdk.event",
  "bridge.node",
  "bridge.visible",
  "bridge.obscuredBy",
  "step.output",
  "loop.item",
  "local.result",
  "remote.result",
  "environment",
  "country",
];

/**
 * Namespaces that address a single value and take no path.
 *
 * `bridge.visible` with a `path` would be a silent authoring bug; keeping the
 * distinction typed makes it a validation error instead.
 */
const PATHLESS_SOURCES: readonly ConditionOperandSource[] = ["bridge.visible", "environment", "country"];

export function sourceTakesPath(source: ConditionOperandSource): boolean {
  return !PATHLESS_SOURCES.includes(source);
}

/** Literal value types the AST may carry. No objects, no functions. */
export type ConditionLiteralValue = string | number | boolean | null;

export interface ConditionOperandRef {
  kind: "operand";
  source: ConditionOperandSource;
  /** Opaque dotted path inside the namespace. Absent for pathless sources. */
  path?: string;
}

export interface ConditionLiteral {
  kind: "literal";
  value: ConditionLiteralValue;
}

export interface ConditionLiteralList {
  kind: "literalList";
  values: readonly ConditionLiteralValue[];
}

export type ConditionTerm = ConditionOperandRef | ConditionLiteral | ConditionLiteralList;

/** Binary comparison operators (B.10). */
export type ConditionComparisonOperator =
  | "equals"
  | "notEquals"
  | "contains"
  | "notContains"
  | "greaterThan"
  | "lessThan"
  | "in"
  | "notIn"
  | "matchesAllowlistedPattern";

/** Unary existence operators. */
export type ConditionExistenceOperator = "exists" | "notExists";

export type ConditionBooleanOperator = "and" | "or" | "not";

export interface ConditionComparisonNode {
  kind: "comparison";
  operator: ConditionComparisonOperator;
  left: ConditionTerm;
  right: ConditionTerm;
}

export interface ConditionExistenceNode {
  kind: "existence";
  operator: ConditionExistenceOperator;
  operand: ConditionOperandRef;
}

export interface ConditionAndNode {
  kind: "and";
  operands: readonly ConditionNode[];
}

export interface ConditionOrNode {
  kind: "or";
  operands: readonly ConditionNode[];
}

export interface ConditionNotNode {
  kind: "not";
  operand: ConditionNode;
}

export type ConditionNode =
  | ConditionComparisonNode
  | ConditionExistenceNode
  | ConditionAndNode
  | ConditionOrNode
  | ConditionNotNode;

// ───────────────────────────────────────────────────────────────────────────
//  Three-valued result
// ───────────────────────────────────────────────────────────────────────────

/**
 * `UNKNOWN` is not a third kind of false.
 *
 * It means "the operand could not be observed" — the app might be fine, the
 * probe might be broken. Rounding it to FALSE takes an untaken branch; a
 * system that does that reports confident answers it has no basis for.
 */
export type ConditionResultValue = "TRUE" | "FALSE" | "UNKNOWN";

/**
 * What the executor does when a condition lands on UNKNOWN.
 *
 * There is no default. Every condition site must state its policy, because
 * the right answer is genuinely site-specific: an optional banner check may
 * branch, a mutation precondition must fail.
 */
export type UnknownPolicy = "FAIL" | "RETRY" | "BRANCH" | "OPERATOR_ATTENTION" | "INCONCLUSIVE";

export const UNKNOWN_POLICIES: readonly UnknownPolicy[] = [
  "FAIL",
  "RETRY",
  "BRANCH",
  "OPERATOR_ATTENTION",
  "INCONCLUSIVE",
];

/** Why one operand could not be resolved. */
export type OperandUnresolvedReason =
  | "MISSING"
  | "INVALID_TYPE"
  | "NOT_OBSERVED"
  | "STALE"
  | "CAPABILITY_UNAVAILABLE";

/**
 * The persisted record of one operand read.
 *
 * This is the evidence that makes a branch decision reviewable months later,
 * so it holds *where* the value came from, not just what it was.
 */
export interface OperandSnapshot {
  source: ConditionOperandSource;
  path?: string;
  resolved: boolean;
  value?: ConditionLiteralValue | readonly ConditionLiteralValue[];
  unresolvedReason?: OperandUnresolvedReason;
  /** Free-form provenance, e.g. an evidence source id. Never a secret. */
  origin?: string;
  /** Host wall-clock epoch in milliseconds when the read happened. */
  observedAtMs: number;
}

/**
 * A full, persistable condition decision.
 *
 * `shortCircuited` is recorded because an `and` that stopped at operand 1
 * never read operands 2..n — without the flag the snapshot list looks
 * suspiciously incomplete during audit (D.6.9).
 */
export interface ConditionEvaluationSnapshot {
  result: ConditionResultValue;
  operands: readonly OperandSnapshot[];
  shortCircuited: boolean;
  /** Node kinds visited, outermost first — a readable decision trace. */
  trace: readonly string[];
}
