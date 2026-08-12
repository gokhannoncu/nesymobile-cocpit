/**
 * ===========================================================================
 *  WorkflowIR v2  (Plan B.9 · D.5)
 *
 *  The neutral, versioned, serializable brain of a Cockpit run. Two hard rules
 *  shape every type here:
 *
 *    NO DOMAIN. There is no `OPEN_STOP`, no `PARCEL`, no `APPROVE_TOUR`. A
 *    Domain Pack authoring macro expands INTO this union; it never extends it.
 *    The moment a business kind lands in the union, the second domain requires
 *    a Core redesign — which is precisely the debt Phase 4A exists to prevent.
 *
 *    NO FIXED WAIT. There is no SLEEP step and no `waitMs`. Every deadline is
 *    an upper bound on an event-driven evaluation. A sleep passes when the app
 *    is merely late and fails when the device is merely slow, and it is the
 *    single most common way an automation suite becomes both slow and useless.
 * ===========================================================================
 */

import type { ConditionNode, UnknownPolicy } from "./condition.js";
import type { EntityRef } from "./correlation.js";
import type { EvidencePolicy, FinalOraclePolicy } from "./evidence-policy.js";
import type { EffectClass, ExternalActionSpec } from "./remote-action.js";

/** Only one version exists today; the field exists so migration is possible. */
export type WorkflowIrVersion = 2;

export const WORKFLOW_IR_VERSION: WorkflowIrVersion = 2;

/** Every generic step kind. Closed union — see the NO DOMAIN rule above. */
export type WorkflowStepKind =
  | "SDK_QUERY"
  | "RESOLVE_TARGET"
  | "BRIDGE_ACTION"
  | "WAIT_ANY"
  | "ASSERT_FACT"
  | "CONDITION"
  | "SWITCH"
  | "FOR_EACH"
  | "WAIT_EVENT"
  | "REMOTE_ACTION"
  | "EXTERNAL_ACTION"
  | "CLEANUP"
  | "ANNOTATE"
  | "NOOP";

export const WORKFLOW_STEP_KINDS: readonly WorkflowStepKind[] = [
  "SDK_QUERY",
  "RESOLVE_TARGET",
  "BRIDGE_ACTION",
  "WAIT_ANY",
  "ASSERT_FACT",
  "CONDITION",
  "SWITCH",
  "FOR_EACH",
  "WAIT_EVENT",
  "REMOTE_ACTION",
  "EXTERNAL_ACTION",
  "CLEANUP",
  "ANNOTATE",
  "NOOP",
];

// ───────────────────────────────────────────────────────────────────────────
//  Cross-cutting policies
// ───────────────────────────────────────────────────────────────────────────

/**
 * Retry policy, effect-aware by construction.
 *
 * `effectClass` is not decoration: {@link validateWorkflowIrV2} refuses
 * `maxAttempts > 1` on a non-idempotent or unclassified effect, so an author
 * cannot express "retry this mutation and hope".
 */
export interface StepRetryPolicy {
  maxAttempts: number;
  backoffMs?: number;
  effectClass: EffectClass;
  /** Retry only when the previous attempt failed in one of these ways. */
  retryOn?: readonly ("FAILED" | "REJECTED" | "TIMED_OUT")[];
}

/**
 * A capability the step needs from the device/bridge.
 *
 * `optional` carries B-13: a Bridge v1 device has no `wait_any` and no
 * `cancel_request`, so a plan that hard-requires them cannot run at all. Marking
 * the requirement optional lets the compiler degrade to sequential legs instead
 * of rejecting the whole workflow.
 */
export interface WorkflowCapabilityRequirement {
  capability: string;
  optional: boolean;
  /** What the executor does instead when the capability is absent. */
  fallback?: "SEQUENTIAL_LEGS" | "HOST_ONLY_CANCEL" | "SKIP_STEP" | "FAIL_FAST";
}

export interface ArtifactPolicy {
  captureOnSuccess: boolean;
  captureOnFailure: boolean;
  /** Artifact kinds, e.g. "SCREENSHOT", "UI_TREE". Opaque to Core. */
  kinds?: readonly string[];
}

export interface RedactionPolicy {
  /** Operand/fact paths whose values must never be persisted verbatim. */
  redactPaths?: readonly string[];
  redactAllInputs?: boolean;
}

/** One entry tying an IR step back to whatever authored it. */
export interface WorkflowSourceMapEntry {
  /** Stable id referenced by {@link OccurrenceCorrelation.sourceMapRef}. */
  ref: string;
  planStepId: string;
  /** Editor node id, when the step came from the graph editor. */
  sourceNodeId?: string;
  /** Legacy config path (e.g. "nodes[3].data.config.barcode"). */
  legacyPath?: string;
  /** Domain Pack macro that expanded into this step, when applicable. */
  domainSourceRef?: string;
  note?: string;
}

export type WorkflowSourceMap = readonly WorkflowSourceMapEntry[];

/** Where the IR came from. `LEGACY_CONFIG` marks migrated workflows. */
export type WorkflowIrSourceKind = "EDITOR_GRAPH" | "LEGACY_CONFIG" | "DOMAIN_PACK_EXPANSION" | "FIXTURE";

export interface WorkflowIrSource {
  kind: WorkflowIrSourceKind;
  /** Opaque provenance id — a workflow row id, a pack version, a fixture name. */
  ref?: string;
}

export interface WorkflowInputDeclaration {
  name: string;
  type: "string" | "number" | "boolean" | "stringList";
  required: boolean;
  /** Redacted in every persisted artifact and log line. */
  secret?: boolean;
}

export interface WorkflowVariableDeclaration {
  name: string;
  type: "string" | "number" | "boolean" | "stringList";
}

/** Run-level policies. */
export interface WorkflowPolicies {
  /** Upper bound on the whole run. Event-driven, not a sleep. */
  runDeadlineMs: number;
  defaultRetry: StepRetryPolicy;
  artifactPolicy: ArtifactPolicy;
  redactionPolicy: RedactionPolicy;
  /** Cleanup gets its own bound so a stuck teardown cannot hang the run. */
  cleanupDeadlineMs: number;
}

// ───────────────────────────────────────────────────────────────────────────
//  Step union
// ───────────────────────────────────────────────────────────────────────────

/** Fields every step carries, regardless of kind (B.9). */
export interface WorkflowStepBase {
  planStepId: string;
  kind: WorkflowStepKind;
  sourceMapRef: string;
  /** Upper bound for this step. Event-driven. */
  timeoutMs: number;
  retryPolicy: StepRetryPolicy;
  capabilityRequirements: readonly WorkflowCapabilityRequirement[];
  continueGate?: EvidencePolicy;
  finalOraclePolicy?: FinalOraclePolicy;
  artifactPolicy?: ArtifactPolicy;
  redactionPolicy?: RedactionPolicy;
  entityBinding?: EntityRef;
  /** Next step in the default flow; `null` ends the sequence. */
  next: string | null;
}

/**
 * Binds a column of a query's first row to a normalized fact key.
 *
 * The symmetric case of `ExternalActionOutputFactBinding`, and it exists for the
 * same reason: without it a query can run, succeed and prove nothing. An
 * `SDK_QUERY` that only fills a variable is readable by later STEPS but invisible
 * to the ORACLE, so a requirement sourced from an app/local observation waits out
 * its deadline while the data sits in a variable one step away.
 */
export interface SdkQueryOutputFactBinding {
  factKey: string;
  /**
   * Where the fact's boolean comes from.
   *
   * `COLUMN` reads a named column of the FIRST row, which only answers a
   * question the projection already carries a boolean for (`route_selected`).
   * Most projections do not: `nesy.availableStops` returns stop ids and counts,
   * and the question an oracle asks of it is "did the app load any stops at
   * all" — a property of the RESULT SET, not of a column. `ROWS_PRESENT` is that
   * question, and having to state which one is being asked keeps a binding from
   * quietly claiming more than the projection can support.
   */
  from:
    | { kind: "COLUMN"; column: string }
    | { kind: "ROWS_PRESENT" };
}

/** Read the app's own state/query surface. Never mutating. */
export interface SdkQueryStep extends WorkflowStepBase {
  kind: "SDK_QUERY";
  /** Domain Pack named query id. Opaque to Core — never a SQL/HTTP string. */
  queryRef: string;
  /** Bounded projection: an unbounded query is a data-exfiltration primitive. */
  maxRows: number;
  outputVariable: string;
  /**
   * Facts this observation publishes into the run's evidence scope.
   *
   * Optional: most queries feed later steps rather than the oracle. A query that
   * declares none is a read, not evidence.
   */
  outputFactBindings?: readonly SdkQueryOutputFactBinding[];
}

/** Turn a logical target into a concrete, fingerprinted device target. */
export interface ResolveTargetStep extends WorkflowStepBase {
  kind: "RESOLVE_TARGET";
  /** Domain Pack target registry key. Opaque to Core. */
  targetRef: string;
  outputVariable: string;
}

/** A physical interaction on the device. */
export interface BridgeActionStep extends WorkflowStepBase {
  kind: "BRIDGE_ACTION";
  /** Generic bridge verb, e.g. "tap", "setText", "scroll". No business verbs. */
  action: string;
  targetVariable?: string;
  /** Opaque, redaction-aware action arguments. */
  args?: Readonly<Record<string, string | number | boolean | null>>;
}

/**
 * Wait for the first of several legs to settle.
 *
 * `maxLegs` is bounded and `hostOnlyCancel` is explicit because of B-13: on a
 * Bridge v1 device there is no `wait_any` and no `cancel_request`, so the host
 * runs the legs itself and can only cancel its own bookkeeping. Modelling that
 * honestly beats compiling a plan the device will silently not honour.
 */
export interface WaitAnyStep extends WorkflowStepBase {
  kind: "WAIT_ANY";
  legs: readonly WaitAnyLeg[];
  maxLegs: number;
  hostOnlyCancel: boolean;
}

export interface WaitAnyLeg {
  legId: string;
  /** Fact key the leg settles on. Opaque to Core. */
  factKey: string;
  /** Step to continue with when this leg wins. */
  onWin: string | null;
}

/** Assert a normalized fact. The generic replacement for per-domain asserts. */
export interface AssertFactStep extends WorkflowStepBase {
  kind: "ASSERT_FACT";
  factKey: string;
  expected: boolean;
  /** How to treat "the fact was never observed". */
  unknownPolicy: UnknownPolicy;
}

/** Two-way branch on a typed condition. */
export interface ConditionStep extends WorkflowStepBase {
  kind: "CONDITION";
  condition: ConditionNode;
  onTrue: string | null;
  onFalse: string | null;
  unknownPolicy: UnknownPolicy;
  /** Required when unknownPolicy is BRANCH. */
  onUnknown?: string | null;
}

/**
 * N-way branch.
 *
 * `default` is mandatory rather than optional: an unmatched switch with no
 * default is a silently skipped step, which reads as success in every report.
 */
export interface SwitchStep extends WorkflowStepBase {
  kind: "SWITCH";
  branches: readonly SwitchBranch[];
  default: SwitchDefaultPolicy;
  unknownPolicy: UnknownPolicy;
  /** Author's acknowledgement that overlapping branches are intended. */
  overlapAudited?: boolean;
}

export interface SwitchBranch {
  branchId: string;
  condition: ConditionNode;
  next: string | null;
}

export type SwitchDefaultPolicy =
  | { policy: "GOTO"; next: string | null }
  | { policy: "FAIL" }
  | { policy: "OPERATOR_ATTENTION" };

/**
 * Bounded iteration.
 *
 * `maxIterations` has no default. An unbounded loop over device-supplied data
 * is a runaway run, and "the list is usually short" is not a bound.
 */
export interface ForEachStep extends WorkflowStepBase {
  kind: "FOR_EACH";
  /** Variable holding the collection (produced by SDK_QUERY, etc.). */
  itemsVariable: string;
  maxIterations: number;
  itemVariable: string;
  indexVariable: string;
  /** First step of the loop body. */
  body: string;
  /** What to do when the collection is empty — never implicit. */
  emptyPolicy: "SKIP" | "FAIL" | "OPERATOR_ATTENTION";
}

/**
 * Event-driven readiness wait.
 *
 * This is the ONLY waiting primitive. `timeoutMs` is the ceiling, `stableForMs`
 * guards against a fact that flickers true for one frame.
 */
export interface WaitEventStep extends WorkflowStepBase {
  kind: "WAIT_EVENT";
  factKey: string;
  /** Which evidence plane the fact must come from. Opaque to Core. */
  sourceLane?: string;
  stableForMs?: number;
  /** Only accept facts correlated to this occurrence's entity/iteration. */
  requireCorrelation: boolean;
  onTimeout: "FAIL" | "INCONCLUSIVE" | "CONTINUE";
}

/** Call an allowlisted adapter operation in a Nesy-owned backend. */
export interface RemoteActionStep extends WorkflowStepBase {
  kind: "REMOTE_ACTION";
  spec: ExternalActionSpec;
}

/** Call an allowlisted adapter operation in a third-party system. */
export interface ExternalActionStep extends WorkflowStepBase {
  kind: "EXTERNAL_ACTION";
  spec: ExternalActionSpec;
}

/**
 * Teardown.
 *
 * Its result lands on {@link StepOutcomeAxes.cleanupResult} and can never touch
 * the product verdict (B.8.1).
 */
export interface CleanupStep extends WorkflowStepBase {
  kind: "CLEANUP";
  /** Steps this cleanup compensates for. Enables ordered teardown. */
  compensatesStepIds: readonly string[];
  /** Cleanup runs even after a failure — that is the point. */
  runOnFailure: boolean;
  spec?: ExternalActionSpec;
}

/** Operator-facing note. No side effects, no evidence. */
export interface AnnotateStep extends WorkflowStepBase {
  kind: "ANNOTATE";
  message: string;
}

/** Explicit no-op — a valid branch target and a migration placeholder. */
export interface NoopStep extends WorkflowStepBase {
  kind: "NOOP";
  reason?: string;
}

export type WorkflowStepV2 =
  | SdkQueryStep
  | ResolveTargetStep
  | BridgeActionStep
  | WaitAnyStep
  | AssertFactStep
  | ConditionStep
  | SwitchStep
  | ForEachStep
  | WaitEventStep
  | RemoteActionStep
  | ExternalActionStep
  | CleanupStep
  | AnnotateStep
  | NoopStep;

// ───────────────────────────────────────────────────────────────────────────
//  Root
// ───────────────────────────────────────────────────────────────────────────

export interface WorkflowIrV2 {
  schemaVersion: WorkflowIrVersion;
  workflowId: string;
  workflowVersion: number;
  name: string;
  source: WorkflowIrSource;
  inputs: readonly WorkflowInputDeclaration[];
  variables: readonly WorkflowVariableDeclaration[];
  steps: readonly WorkflowStepV2[];
  /** First step to execute. */
  entryStepId: string;
  policies: WorkflowPolicies;
  capabilityRequirements: readonly WorkflowCapabilityRequirement[];
  sourceMap: WorkflowSourceMap;
}
