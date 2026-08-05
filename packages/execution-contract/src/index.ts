import type {
  EvaluationFailureClass,
  OperationalDisposition,
  ProductVerdict,
  ResourceReleaseResult,
  RunLifecycleState,
  RunOutcomeAxes,
  RunTerminationReason,
  SchedulerDisposition,
  StepOutcomeAxes,
  WorkflowCleanupResult,
} from "@nesy/workflow-contract";

export type RuntimeEngineType = "MAESTRO_LEGACY" | "BRIDGEFLOW";
export type RunEpochUnit = "MONOTONIC_MS";

export interface TestProfileRunPin {
  profileKey: string;
  profileVersion: string;
  campaignId?: string;
  buildRef?: string;
  datasetRef?: string;
  deviceCell?: string;
  repetitionIndex?: number;
  faultPlanRef?: string;
  telemetryPolicyRef?: string;
  releaseGate: boolean;
}

export interface RunManifestInput {
  runId: string;
  workflowRef: string;
  workflowVersion: number;
  engineType: RuntimeEngineType;
  compiledPlanRef: string;
  compiledPlanHash: string;
  domainPackKey: string;
  domainPackVersion: string;
  domainPackDigest: string;
  workflowIrSchemaVersion: number;
  compilerVersion: string;
  bridgeProtocolVersion: string;
  sdkProtocolVersion: string;
  runEpochMs: number;
  profile: TestProfileRunPin;
  reducerGraphDigest: string;
}

export interface RunManifest extends Readonly<RunManifestInput> {
  runEpochUnit: RunEpochUnit;
}

export type ActionTransitionPhase =
  | "RECEIVED"
  | "TARGET_RESOLVED"
  | "GESTURE_DISPATCHED"
  | "GESTURE_COMPLETED"
  | "EFFECT_VERIFIED";

export type ActionTerminalState = "SUCCEEDED" | "FAILED" | "UNKNOWN_EFFECT" | "REJECTED" | "CANCELLED";

export interface ActionTransition {
  phase: ActionTransitionPhase;
  requestId: string;
  atMs: number;
  evidenceRef: string;
  terminal?: ActionTerminalState;
}

export interface StepOccurrence {
  occurrenceId: string;
  runId: string;
  planStepId: string;
  occurrenceIndex: number;
  iterationKey: string;
  requestId?: string;
  outcome: StepOutcomeAxes;
}

export type EvidenceJourneyStage =
  | "EMIT"
  | "WAL"
  | "TRANSPORT"
  | "INBOX"
  | "RECEIPT"
  | "ORDERED"
  | "NORMALIZATION"
  | "CORRELATION"
  | "EVALUATION";

export type EvidenceJourneyState = "PENDING" | "OBSERVED" | "NOT_OBSERVED" | "UNKNOWN" | "BLOCKED";

export interface EvidenceJourneyEntry {
  factKey: string;
  occurrenceId: string;
  stage: EvidenceJourneyStage;
  state: EvidenceJourneyState;
  reason?: string;
  authority?: "PRIMARY" | "CONFIRMATORY" | "FALLBACK";
  confidence?: number;
}

export type TestExecutionLifecycle = "PENDING" | "READY" | "LEASED" | "RUNNING" | "TERMINAL";
export type TestExecutionDisposition =
  | "COMPLETED"
  | "RETRYABLE"
  | "BLOCKED"
  | "SKIPPED"
  | "CANCELLED"
  | "ORPHANED"
  | "RECONCILIATION_REQUIRED"
  | "UNKNOWN_EFFECT";

export interface TestExecution {
  executionId: string;
  runId: string;
  lifecycle: TestExecutionLifecycle;
  productVerdict: ProductVerdict;
  schedulerDisposition: SchedulerDisposition;
  disposition: TestExecutionDisposition;
  heartbeatAtMs?: number;
}

export type BrokerResourceState =
  | "CLEAN"
  | "DIRTY"
  | "QUARANTINED"
  | "RECONCILIATION_REQUIRED"
  | "MANUAL_RELEASE_REQUIRED";

export interface BrokerResource {
  resourceId: string;
  conflictGroup: string;
  exclusive: boolean;
  state: BrokerResourceState;
}

export interface ResourceLease {
  leaseId: string;
  runId: string;
  resourceId: string;
  conflictGroup: string;
  exclusive: boolean;
  leasedAtMs: number;
}

export interface ResourcePool {
  readonly resources: Map<string, BrokerResource>;
  readonly leases: Map<string, ResourceLease>;
}

export type ResourceLeaseResult =
  | { ok: true; lease: ResourceLease }
  | { ok: false; reason: "RESOURCE_NOT_FOUND" | "RESOURCE_NOT_CLEAN" | "CONFLICT_GROUP_BUSY"; detail: string };

export type ResourceReleaseAttempt =
  | { ok: true; resource: BrokerResource }
  | { ok: false; reason: "LEASE_NOT_FOUND" | "RECONCILIATION_REQUIRED"; detail: string };

export type RemoteActionEffectClass = "IDEMPOTENT" | "NON_IDEMPOTENT";

export interface RemoteActionRuntimeRequest {
  operationRef: string;
  allowlisted: boolean;
  idempotencyKey: string;
  effectClass: RemoteActionEffectClass;
  timeoutMs: number;
  occurrenceId: string;
  entityRef?: string;
  resourceLeaseId?: string;
}

const ACTION_PHASE_ORDER: readonly ActionTransitionPhase[] = [
  "RECEIVED",
  "TARGET_RESOLVED",
  "GESTURE_DISPATCHED",
  "GESTURE_COMPLETED",
  "EFFECT_VERIFIED",
];

export function buildRunManifest(input: RunManifestInput): RunManifest {
  return deepFreeze({
    ...input,
    profile: { ...input.profile },
    runEpochUnit: "MONOTONIC_MS",
  });
}

export function appendActionTransition(
  current: readonly ActionTransition[],
  transition: ActionTransition,
): readonly ActionTransition[] {
  const last = current.at(-1);
  if (last?.terminal !== undefined) {
    throw new Error(`action ${transition.requestId} already terminal (${last.terminal}); refusing ${transition.phase}`);
  }
  if (last !== undefined && last.requestId !== transition.requestId) {
    throw new Error(`action transition requestId mismatch: expected ${last.requestId}, got ${transition.requestId}`);
  }

  const expectedIndex = current.length;
  const actualIndex = ACTION_PHASE_ORDER.indexOf(transition.phase);
  if (actualIndex !== expectedIndex) {
    const expected = ACTION_PHASE_ORDER[expectedIndex] ?? "NO_MORE_TRANSITIONS";
    throw new Error(`invalid action transition ${transition.phase}; expected ${expected}`);
  }

  if (transition.terminal !== undefined && transition.phase !== "EFFECT_VERIFIED") {
    throw new Error(`terminal action state may only be written with EFFECT_VERIFIED, got ${transition.phase}`);
  }

  return [...current, { ...transition }];
}

export function finalizeRunOutcome(axes: RunOutcomeAxes): RunOutcomeAxes {
  const operationalDisposition: OperationalDisposition =
    (axes.cleanupResult === "FAILED" && isPassingVerdict(axes.productVerdict)) ||
    axes.resourceReleaseResult === "LEAKED"
      ? "NEEDS_ATTENTION"
      : axes.operationalDisposition;

  return {
    ...axes,
    operationalDisposition,
  };
}

export function createResourcePool(resources: readonly BrokerResource[]): ResourcePool {
  return {
    resources: new Map(resources.map((resource) => [resource.resourceId, { ...resource }])),
    leases: new Map(),
  };
}

export function leaseResource(pool: ResourcePool, lease: ResourceLease): ResourceLeaseResult {
  const resource = pool.resources.get(lease.resourceId);
  if (resource === undefined) {
    return { ok: false, reason: "RESOURCE_NOT_FOUND", detail: `resource ${lease.resourceId} does not exist` };
  }
  if (
    lease.exclusive &&
    [...pool.leases.values()].some((active) => active.conflictGroup === lease.conflictGroup && active.exclusive)
  ) {
    return {
      ok: false,
      reason: "CONFLICT_GROUP_BUSY",
      detail: `conflict group ${lease.conflictGroup} already has an exclusive lease`,
    };
  }
  if (resource.state !== "CLEAN") {
    return {
      ok: false,
      reason: "RESOURCE_NOT_CLEAN",
      detail: `resource ${lease.resourceId} is ${resource.state} and cannot be leased`,
    };
  }

  const stored = { ...lease };
  pool.leases.set(stored.leaseId, stored);
  resource.state = "DIRTY";
  return { ok: true, lease: stored };
}

export function markResourceForReconciliation(
  pool: ResourcePool,
  resourceId: string,
  _reason: "UNKNOWN_EFFECT" | "PARTIAL_FAILURE",
): void {
  const resource = pool.resources.get(resourceId);
  if (resource !== undefined) {
    resource.state = "RECONCILIATION_REQUIRED";
  }
}

export function releaseResource(pool: ResourcePool, leaseId: string): ResourceReleaseAttempt {
  const lease = pool.leases.get(leaseId);
  if (lease === undefined) {
    return { ok: false, reason: "LEASE_NOT_FOUND", detail: `lease ${leaseId} does not exist` };
  }
  const resource = pool.resources.get(lease.resourceId);
  pool.leases.delete(leaseId);

  if (resource === undefined) {
    return { ok: false, reason: "LEASE_NOT_FOUND", detail: `resource ${lease.resourceId} no longer exists` };
  }
  if (resource.state === "RECONCILIATION_REQUIRED" || resource.state === "MANUAL_RELEASE_REQUIRED") {
    return {
      ok: false,
      reason: "RECONCILIATION_REQUIRED",
      detail: `resource ${resource.resourceId} requires reconciliation before returning to the pool`,
    };
  }

  resource.state = "CLEAN";
  return { ok: true, resource };
}

export function createInitialRunOutcome(): RunOutcomeAxes {
  return {
    lifecycle: "PENDING",
    productVerdict: "NOT_EVALUATED",
    evaluationFailureClass: "NONE",
    terminationReason: "NOT_TERMINATED",
    cleanupResult: "NOT_STARTED",
    resourceReleaseResult: "NOT_REQUIRED",
    schedulerDisposition: "NOT_SCHEDULED",
    operationalDisposition: "OK",
  };
}

export function createInitialStepOutcome(): StepOutcomeAxes {
  return {
    actionResult: "NOT_STARTED",
    continueGateResult: "NOT_EVALUATED",
    finalOracleResult: "NOT_EVALUATED",
    cleanupResult: "NOT_STARTED",
  };
}

function isPassingVerdict(verdict: ProductVerdict): boolean {
  return verdict === "PASS_ONLINE" || verdict === "PASS_QUEUED_OFFLINE";
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null) return value;
  for (const child of Object.values(value)) {
    deepFreeze(child);
  }
  return Object.freeze(value);
}

export type {
  EvaluationFailureClass,
  OperationalDisposition,
  ProductVerdict,
  ResourceReleaseResult,
  RunLifecycleState,
  RunOutcomeAxes,
  RunTerminationReason,
  SchedulerDisposition,
  StepOutcomeAxes,
  WorkflowCleanupResult,
};
