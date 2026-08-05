/**
 * ===========================================================================
 *  Entity Registry and Target Resolution Provider Chain  (Plan D.6B · 4B.7)
 *
 *  The bug this file exists to prevent, stated concretely: a run taps row 3 of
 *  a list because the plan said "row 3", the list re-sorted after a background
 *  sync, and the run then delivers the wrong item — successfully. Every oracle
 *  passes. The report is green. The data is wrong.
 *
 *  So resolution is a CHAIN of providers ordered by identity strength, and
 *  `ROW_INDEX_HINT` is explicitly not an identity provider: it may narrow a
 *  search but can never be the thing that decides which element is the target.
 *  {@link validateTargetResolutionPolicy} refuses a policy whose primary
 *  strategy is a row index, because a rule like that survives only as a failing
 *  test — not as a comment.
 *
 *  Ambiguity is fail-closed. When two candidates match, the honest outcome is
 *  "do not touch anything and report ambiguity". Picking the first match is how
 *  a suite quietly starts operating on the wrong entity.
 * ===========================================================================
 */

/**
 * Where a target's identity comes from, strongest first.
 *
 * - `ACCESSIBILITY_ID` — a stable, app-authored id. Best case.
 * - `ENTITY_BINDING` — resolve via the entity the row represents (the business
 *   key), which is what a human actually means by "the stop for order 42".
 * - `INSPECTOR_MAPPING` — a curated mapping captured from the app's own tree.
 * - `STRUCTURAL_FINGERPRINT` — shape/position within a container. Weak but real.
 * - `TEXT_MATCH` — visible text. Locale-fragile, so it is late in the chain.
 * - `ROW_INDEX_HINT` — NOT an identity. Narrowing hint only.
 */
export type TargetResolutionStrategyKind =
  | "ACCESSIBILITY_ID"
  | "ENTITY_BINDING"
  | "INSPECTOR_MAPPING"
  | "STRUCTURAL_FINGERPRINT"
  | "TEXT_MATCH"
  | "ROW_INDEX_HINT";

export const TARGET_RESOLUTION_STRATEGY_KINDS: readonly TargetResolutionStrategyKind[] = [
  "ACCESSIBILITY_ID",
  "ENTITY_BINDING",
  "INSPECTOR_MAPPING",
  "STRUCTURAL_FINGERPRINT",
  "TEXT_MATCH",
  "ROW_INDEX_HINT",
];

/**
 * Strategies that may NEVER establish identity on their own.
 *
 * Data rather than prose so the validator can enforce it.
 */
export const NON_IDENTITY_STRATEGY_KINDS: readonly TargetResolutionStrategyKind[] = ["ROW_INDEX_HINT"];

/** One provider in the chain. */
export interface TargetResolutionStrategy {
  kind: TargetResolutionStrategyKind;
  /** Opaque, provider-specific selector data. Never a script. */
  selector: Readonly<Record<string, string | number | boolean>>;
  /**
   * Whether this provider alone is sufficient to identify the target.
   *
   * A `ROW_INDEX_HINT` declaring `true` is a validation error.
   */
  establishesIdentity: boolean;
  /** Capability ids the provider needs (e.g. an inspector mapping in the pack). */
  requiredCapabilityRefs?: readonly string[];
}

/**
 * What to do when more than one candidate matches.
 *
 * Default is `FAIL`. `FIRST_MATCH` is intentionally absent from the union: there
 * is no safe way to express "just pick one" for a business target, and offering
 * the option is how it ends up used under deadline pressure.
 */
export type AmbiguityPolicy = "FAIL" | "OPERATOR_ATTENTION" | "REQUIRE_ADDITIONAL_STRATEGY";

export const AMBIGUITY_POLICIES: readonly AmbiguityPolicy[] = [
  "FAIL",
  "OPERATOR_ATTENTION",
  "REQUIRE_ADDITIONAL_STRATEGY",
];

export const DEFAULT_AMBIGUITY_POLICY: AmbiguityPolicy = "FAIL";

/** What to do when nothing matches at all. */
export type NotFoundPolicy = "FAIL" | "OPERATOR_ATTENTION" | "TREAT_AS_ABSENT";

/**
 * The provider chain for one target.
 *
 * `chain` order is semantics: the first provider that resolves wins, so the
 * order is the pack author's declaration of which identity they trust most.
 */
export interface TargetResolutionPolicy {
  chain: readonly TargetResolutionStrategy[];
  ambiguityPolicy: AmbiguityPolicy;
  notFoundPolicy: NotFoundPolicy;
  /** Upper bound on the event-driven resolution attempt. */
  deadlineMs: number;
  /**
   * Whether the resolved target must be re-verified immediately before acting.
   *
   * True is correct for list rows: the list can re-sort between resolution and
   * tap, and that window is exactly where the wrong-row bug lives.
   */
  reverifyBeforeAction: boolean;
}

export interface TargetResolutionViolation {
  code:
    | "EMPTY_CHAIN"
    | "ROW_INDEX_AS_IDENTITY"
    | "NO_IDENTITY_PROVIDER"
    | "AMBIGUITY_NOT_FAIL_CLOSED"
    | "ROW_INDEX_NOT_LAST"
    | "INVALID_DEADLINE";
  message: string;
}

/**
 * Validates one provider chain.
 *
 * These checks are the contract, not executor courtesy: an executor asked to
 * honour a rowIndex-only policy has no correct behaviour available to it.
 */
export function validateTargetResolutionPolicy(policy: TargetResolutionPolicy, path: string): TargetResolutionViolation[] {
  const violations: TargetResolutionViolation[] = [];

  if (policy.chain.length === 0) {
    violations.push({ code: "EMPTY_CHAIN", message: `${path}: target resolution chain is empty` });
    return violations;
  }

  for (const [index, strategy] of policy.chain.entries()) {
    if (NON_IDENTITY_STRATEGY_KINDS.includes(strategy.kind) && strategy.establishesIdentity) {
      violations.push({
        code: "ROW_INDEX_AS_IDENTITY",
        message: `${path}.chain[${index}]: ${strategy.kind} cannot establish target identity; it is a narrowing hint only`,
      });
    }
    // A hint before a real provider would be consulted first and would decide
    // the target in practice, whatever the flag says.
    if (NON_IDENTITY_STRATEGY_KINDS.includes(strategy.kind) && index !== policy.chain.length - 1) {
      violations.push({
        code: "ROW_INDEX_NOT_LAST",
        message: `${path}.chain[${index}]: ${strategy.kind} must be the last entry in the chain, otherwise it decides the target in practice`,
      });
    }
  }

  const identityProviders = policy.chain.filter(
    (s) => s.establishesIdentity && !NON_IDENTITY_STRATEGY_KINDS.includes(s.kind),
  );
  if (identityProviders.length === 0) {
    violations.push({
      code: "NO_IDENTITY_PROVIDER",
      message: `${path}: chain carries no identity-establishing provider; a hint-only chain cannot name a business target`,
    });
  }

  if (!AMBIGUITY_POLICIES.includes(policy.ambiguityPolicy)) {
    violations.push({
      code: "AMBIGUITY_NOT_FAIL_CLOSED",
      message: `${path}.ambiguityPolicy: "${String(policy.ambiguityPolicy)}" is not a fail-closed ambiguity policy`,
    });
  }

  if (!Number.isFinite(policy.deadlineMs) || policy.deadlineMs <= 0) {
    violations.push({ code: "INVALID_DEADLINE", message: `${path}.deadlineMs must be a positive number` });
  }

  return violations;
}

// ───────────────────────────────────────────────────────────────────────────
//  Entity Registry
// ───────────────────────────────────────────────────────────────────────────

/**
 * How long an entity observation stays usable.
 *
 * A stale stop list is the input to the wrong-row bug, so freshness is declared
 * per entity rather than assumed globally.
 */
export interface EntityFreshnessPolicy {
  maxAgeMs: number;
  /** What to do when the only observation is stale. */
  onStale: "REFRESH" | "FAIL" | "OPERATOR_ATTENTION";
}

/**
 * What must never be persisted verbatim for this entity.
 *
 * Courier data carries addresses and phone numbers; an evidence archive that
 * keeps them in the clear is a privacy incident waiting for a subpoena.
 */
export interface EntityRedactionPolicy {
  /** Field paths redacted in every artifact and log line. */
  redactPaths: readonly string[];
  /** Fields kept for correlation but hashed, not stored in clear. */
  hashPaths?: readonly string[];
}

/** How two observations of the same entity are recognised as the same thing. */
export interface EntityCorrelationPolicy {
  /** Fields that jointly identify the entity across planes. */
  correlationPaths: readonly string[];
  /** Whether a UI observation may be correlated to a backend record. */
  crossPlane: boolean;
}

/**
 * One typed business entity.
 *
 * `businessKeyPath` is required and is the reason the Entity Registry exists: a
 * business key is what makes "the same stop" mean the same thing in the UI, in
 * the local DB and in the backend. Without it, cross-plane correlation degrades
 * to "same-ish", and that is not evidence.
 */
export interface EntityDefinition {
  /** Entity type key, e.g. "STOP". Opaque to Core. */
  entityType: string;
  applicationRef: string;
  displayName: string;
  /** Path to the stable business key inside a normalized observation. */
  businessKeyPath: string;
  /** Additional identity paths, e.g. a backend surrogate id. */
  identityPaths: readonly string[];
  correlation: EntityCorrelationPolicy;
  freshness: EntityFreshnessPolicy;
  redaction: EntityRedactionPolicy;
  /** Named query refs that can produce this entity. */
  sourceQueryRefs: readonly string[];
}

/**
 * Ties an entity instance to the UI target that represents it.
 *
 * `projectedPaths` is bounded on purpose: an unbounded projection of the
 * selected entity into the plan turns evidence capture into data exfiltration.
 */
export interface EntityBindingDefinition {
  entityTypeRef: string;
  /** Target key whose resolution consumes this binding. */
  targetRef: string;
  /** Which entity fields the target resolution may read. Bounded. */
  projectedPaths: readonly string[];
  /** Whether the projection is redacted before persistence. */
  redactProjection: boolean;
}

/** One resolvable UI target. */
export interface TargetDefinition {
  /** Namespaced target key, e.g. "nesy.target.stop-row". */
  targetKey: string;
  applicationRef: string;
  /** Screen the target lives on. */
  screenRef: string;
  /** Surface the target lives on, when it is not on the screen itself. */
  surfaceRef?: string;
  displayName: string;
  resolution: TargetResolutionPolicy;
  /** Entity binding used by an ENTITY_BINDING provider in the chain. */
  entityBinding?: EntityBindingDefinition;
}
