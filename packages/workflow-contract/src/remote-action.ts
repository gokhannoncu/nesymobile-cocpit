/**
 * ===========================================================================
 *  REMOTE_ACTION / EXTERNAL_ACTION primitive  (Plan FAZ 4A.10 · CHECKPOINT 4A)
 *
 *  Test setup often needs something done outside the device — approve a record
 *  in a back office, seed a fixture, release a lock. The tempting shortcut is
 *  "let the workflow declare an HTTP call". That shortcut is refused here, for
 *  three concrete reasons:
 *
 *    1. A URL in a workflow row is an SSRF primitive with a UI in front of it.
 *    2. An endpoint name is domain knowledge. Once `nesy/tours/approve` lives
 *       in the shared IR union, Core is a courier system and the second domain
 *       forces a rewrite.
 *    3. Endpoints have no declared effect. A retry engine cannot know whether
 *       re-sending is safe, so it either never retries or double-charges.
 *
 *  Instead the IR names an ALLOWLISTED adapter operation — `adapterRef` +
 *  `operationRef` — and carries the properties the executor actually reasons
 *  about: effect class, idempotency, timeout, resource needs, output fact
 *  binding and reconciliation. The Domain Pack owns the mapping from
 *  operationRef to a real call; Core never sees it.
 * ===========================================================================
 */

import type { EntityRef } from "./correlation.js";

/**
 * What the operation does to the world.
 *
 * `UNKNOWN` exists because some legacy operations genuinely cannot be
 * classified — and an unclassified effect must block auto-retry rather than
 * default to "probably safe".
 */
export type EffectClass = "READ_ONLY" | "IDEMPOTENT_MUTATION" | "NON_IDEMPOTENT_MUTATION" | "UNKNOWN";

export const EFFECT_CLASSES: readonly EffectClass[] = [
  "READ_ONLY",
  "IDEMPOTENT_MUTATION",
  "NON_IDEMPOTENT_MUTATION",
  "UNKNOWN",
];

/**
 * How duplicate suppression is achieved.
 *
 * `KEYED` means the adapter honours `idempotencyKey`; that is the only way a
 * non-idempotent mutation becomes safely retryable.
 */
export type IdempotencyClass = "NATURALLY_IDEMPOTENT" | "KEYED" | "NONE";

/** What role the action plays in the verdict. */
export type ExternalActionRole = "SETUP" | "VALIDATION" | "TEARDOWN";

/**
 * What to do when the action's outcome is unknown (timeout, lost response).
 *
 * `RECONCILE_BEFORE_RELEASE` is the honest default for mutations: ask the
 * remote system what actually happened before letting the resource go.
 */
export type ReconciliationMode =
  | "NONE"
  | "RECONCILE_ON_UNKNOWN"
  | "RECONCILE_BEFORE_RELEASE"
  | "OPERATOR_ATTENTION";

/** Binds an operation input to a value the IR can already address. */
export interface ExternalActionInputBinding {
  /** Adapter-side input name. Opaque to Core. */
  name: string;
  source:
    | { kind: "literal"; value: string | number | boolean | null }
    | { kind: "runInput"; path: string }
    | { kind: "stepOutput"; stepId: string; path: string }
    | { kind: "loopItem"; path?: string }
    | { kind: "entityRef" };
}

/**
 * Binds an operation output to a normalized fact key.
 *
 * Without this an external action can succeed transport-wise and prove nothing.
 * Schema validation therefore refuses a VALIDATION-role action that produces
 * no fact: "HTTP 200" is not a business truth.
 */
export interface ExternalActionOutputFactBinding {
  factKey: string;
  /** Opaque path into the adapter's normalized response. */
  responsePath: string;
}

export interface ExternalActionTimeoutPolicy {
  timeoutMs: number;
  /** Attempts INCLUDING the first. 1 means "no retry". */
  maxAttempts: number;
  backoffMs?: number;
}

export interface ExternalActionAuditPolicy {
  /** Persist request/response for audit. Mutations must. */
  recordRequest: boolean;
  recordResponse: boolean;
  /** Adapter field names to redact before persisting. */
  redactFields?: readonly string[];
}

/**
 * The domain-neutral external action contract.
 *
 * Note what is absent and stays absent: url, method, headers, body, script,
 * host, port, query. There is no field an endpoint could hide in.
 */
export interface ExternalActionSpec {
  /** Allowlisted adapter id from the Domain Pack registry. */
  adapterRef: string;
  /** Allowlisted operation id within that adapter. */
  operationRef: string;
  role: ExternalActionRole;
  effectClass: EffectClass;
  idempotencyClass: IdempotencyClass;
  /** Required when idempotencyClass is KEYED. */
  idempotencyKey?: string;
  inputBindings: readonly ExternalActionInputBinding[];
  outputFactBindings: readonly ExternalActionOutputFactBinding[];
  timeoutPolicy: ExternalActionTimeoutPolicy;
  /** Refs into the run's declared resource requirements. Opaque to Core. */
  resourceRequirementRefs?: readonly string[];
  entityBinding?: EntityRef;
  reconciliationPolicy: ReconciliationMode;
  auditPolicy: ExternalActionAuditPolicy;
  /** Environments the operation may run in. Empty/absent means "any". */
  allowedEnvironments?: readonly string[];
}

export interface ExternalActionViolation {
  code:
    | "UNSAFE_RETRY"
    | "MISSING_IDEMPOTENCY_KEY"
    | "SETUP_PRODUCES_VERDICT"
    | "MISSING_OUTPUT_FACT"
    | "UNAUDITED_MUTATION"
    | "MISSING_RECONCILIATION";
  message: string;
}

const MUTATIONS: readonly EffectClass[] = ["IDEMPOTENT_MUTATION", "NON_IDEMPOTENT_MUTATION", "UNKNOWN"];

/**
 * Effect-aware validation of one external action.
 *
 * These are the checks that stop a retry engine from doing damage, so they are
 * part of the contract rather than an executor-side courtesy.
 */
export function validateExternalAction(spec: ExternalActionSpec): ExternalActionViolation[] {
  const violations: ExternalActionViolation[] = [];
  const retries = spec.timeoutPolicy.maxAttempts > 1;

  // The core safety rule: retrying an operation that may already have taken
  // effect, without a suppression key, duplicates the effect.
  if (retries && spec.effectClass === "NON_IDEMPOTENT_MUTATION" && spec.idempotencyClass !== "KEYED") {
    violations.push({
      code: "UNSAFE_RETRY",
      message: `operation "${spec.operationRef}" is a NON_IDEMPOTENT_MUTATION retried up to ${spec.timeoutPolicy.maxAttempts} times without a keyed idempotency class`,
    });
  }

  if (retries && spec.effectClass === "UNKNOWN") {
    violations.push({
      code: "UNSAFE_RETRY",
      message: `operation "${spec.operationRef}" has an UNKNOWN effect class and cannot be auto-retried; classify the effect first`,
    });
  }

  if (spec.idempotencyClass === "KEYED" && (spec.idempotencyKey === undefined || spec.idempotencyKey.trim() === "")) {
    violations.push({
      code: "MISSING_IDEMPOTENCY_KEY",
      message: `operation "${spec.operationRef}" declares KEYED idempotency but carries no idempotencyKey`,
    });
  }

  // A setup action arranges preconditions. If it were allowed to bind facts the
  // Final Oracle reads, the run would be validating its own fixture instead of
  // the product.
  if (spec.role === "SETUP" && spec.outputFactBindings.length > 0) {
    violations.push({
      code: "SETUP_PRODUCES_VERDICT",
      message: `SETUP operation "${spec.operationRef}" binds output facts; setup must not produce business evidence`,
    });
  }

  if (spec.role === "VALIDATION" && spec.outputFactBindings.length === 0) {
    violations.push({
      code: "MISSING_OUTPUT_FACT",
      message: `VALIDATION operation "${spec.operationRef}" binds no output fact; a transport-level success is not business evidence`,
    });
  }

  if (MUTATIONS.includes(spec.effectClass) && !spec.auditPolicy.recordRequest) {
    violations.push({
      code: "UNAUDITED_MUTATION",
      message: `mutating operation "${spec.operationRef}" must record its request for audit`,
    });
  }

  if (MUTATIONS.includes(spec.effectClass) && spec.reconciliationPolicy === "NONE") {
    violations.push({
      code: "MISSING_RECONCILIATION",
      message: `mutating operation "${spec.operationRef}" needs a reconciliation policy; a lost response must not be assumed to be a no-op`,
    });
  }

  return violations;
}
