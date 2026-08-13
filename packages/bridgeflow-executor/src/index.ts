import type { UiWaitPlan, WaitAnyResult } from "@nesy/bridge-contract";
import type { BridgeFlowPlan, BridgeFlowPlanStep, CompiledUiWaitPlan } from "@nesy/bridgeflow-compiler";
import type {
  ActionTerminalState,
  ActionTransition,
  RunManifest,
  RunOutcomeAxes,
  StepOccurrence,
} from "@nesy/execution-contract";
import {
  appendActionTransition,
  buildRunManifest,
  createInitialStepOutcome,
  finalizeRunOutcome,
} from "@nesy/execution-contract";
import {
  type ContinueGateEvaluation,
  type FinalOracleEvaluation,
  type NormalizedEvidenceFact,
} from "@nesy/oracle-engine";
import {
  evaluateCondition,
  type ConditionEvaluationContext,
  type ConditionNode,
  type ConditionResultValue,
  type ProductVerdict,
  type StepActionOutcome,
  type UnknownPolicy,
} from "@nesy/workflow-contract";

export interface BridgeActionResult {
  terminalState: ActionTerminalState;
  /** Explicit post-action verification. Transport/gesture success is insufficient. */
  effectVerified: boolean;
  evidenceRef: string;
}

export interface BridgeRuntimePort {
  act(step: BridgeFlowPlanStep, context: StepExecutionContext): Promise<BridgeActionResult>;
  waitAny(plan: UiWaitPlan, context: StepExecutionContext): Promise<WaitAnyResult>;
  cancelWait(context: StepExecutionContext): Promise<unknown>;
  cancelAction(requestId: string, context: StepExecutionContext): Promise<unknown>;
}

export interface EvidenceRuntimePort {
  /**
   * Facts correlated to one step occurrence.
   *
   * `iterationKey` is part of the identity, not extra detail: [correlatedFacts]
   * drops any fact whose key differs, and the host's evidence runtime buckets
   * publications by `(runId, occurrenceId, iterationKey)`. Passing only the
   * occurrence left the host guessing the other half — it guessed `""` while the
   * producer wrote `"root"`, so the lookup hit a bucket that never existed and
   * every UI wait timed out with the fact sitting right there.
   */
  factsForOccurrence(
    occurrenceId: string,
    iterationKey: string,
  ): readonly ExecutorEvidenceFact[];
}

export type ExecutorEvidenceFact = NormalizedEvidenceFact;

export interface StepExecutionContext {
  runId: string;
  deviceId: string;
  occurrenceId: string;
  occurrenceIndex: number;
  iterationKey: string;
  requestId: string;
  /** Pinned once when the occurrence starts and reused by every Oracle revision. */
  startedAtMs: number;
  recoveryFence?: RecoveryFence;
}

export interface ExecuteBridgeFlowInput {
  runId: string;
  deviceId: string;
  plan: BridgeFlowPlan;
  profile?: {
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
  };
  signal?: AbortSignal;
  recovery?: RecoveryResumeState;
}

export type MaybePromise<T> = T | Promise<T>;

export interface RecoveryFence {
  token: string;
  epoch: number;
}

export interface PersistedRunStart {
  runId: string;
  engineType: "BRIDGEFLOW";
  manifest: RunManifest;
}

export interface PersistedActionTransition {
  runId: string;
  occurrenceId: string;
  transition: ActionTransition;
  recoveryFence?: RecoveryFence;
}

export interface PersistedStepOccurrence extends StepOccurrence {
  startedAtMs: number;
  recoveryFence?: RecoveryFence;
}

export interface PersistedWaitResult {
  runId: string;
  occurrenceId: string;
  waitPlanId: string;
  requestId: string;
  status: WaitAnyResult["status"];
  key?: string;
  cancelStatus?: string;
  recoveryFence?: RecoveryFence;
}

export interface WaitTerminalSettlement {
  won: boolean;
  result: PersistedWaitResult;
}

export interface RecoveryContinuationFrame {
  loopStepId: string;
  parentIterationKey: string;
  bodyStepId: string;
  stopBeforeStepId: string | null;
  returnStepId: string | null;
  currentIndex: number;
  itemCount: number;
  currentIterationKey: string;
}

export interface RecoveryOutcomeState {
  stopped: boolean;
  unknownEffect: boolean;
  automationFailure: boolean;
  evidenceInsufficient: boolean;
  productVerdicts: readonly ProductVerdict[];
  cleanupResult: RunOutcomeAxes["cleanupResult"];
  resourceReleaseResult: RunOutcomeAxes["resourceReleaseResult"];
  schedulerDisposition: RunOutcomeAxes["schedulerDisposition"];
  operationalDisposition: RunOutcomeAxes["operationalDisposition"];
}

export interface RecoveryResumeState {
  revision?: number;
  nextStepId: string | null;
  runtimeIterationKey: string;
  occurrenceCounts: Readonly<Record<string, number>>;
  completedOccurrenceIds: readonly string[];
  completedIterationKeys: readonly string[];
  startedAtMsByOccurrenceId?: Readonly<Record<string, number>>;
  continuationStack?: readonly RecoveryContinuationFrame[];
  outcomeState?: RecoveryOutcomeState;
  recoveryFence?: RecoveryFence;
  lastCompletedControl?: {
    occurrenceId: string;
    nextStepId: string | null;
    runtimeIterationKey: string;
  };
}

export interface PersistedRecoveryCheckpoint extends RecoveryResumeState {
  runId: string;
}

export interface PersistedOracleEvaluation {
  runId: string;
  occurrenceId: string;
  evaluatorKind: "CONTINUE_GATE" | "FINAL_ORACLE";
  evaluation: ContinueGateEvaluation | FinalOracleEvaluation;
  recoveryFence?: RecoveryFence;
}

export interface PersistedRunResult {
  runId: string;
  result: RunOutcomeAxes;
  recoveryFence?: RecoveryFence;
}

export interface ExecutionPersistencePort {
  /**
   * Persist the immutable run start and acquire the fresh-execution fence.
   * Fresh runs must receive a fence; missing fences fail closed in the executor.
   */
  persistRunStart(record: PersistedRunStart): MaybePromise<RecoveryFence | void>;
  persistStepOccurrence(occurrence: PersistedStepOccurrence): MaybePromise<void>;
  persistActionTransition(record: PersistedActionTransition): MaybePromise<void>;
  /** @deprecated Use settleWaitTerminal so every terminal source competes atomically. */
  persistWaitResult(result: PersistedWaitResult): MaybePromise<void>;
  settleWaitTerminal(result: PersistedWaitResult): MaybePromise<WaitTerminalSettlement>;
  persistRecoveryCheckpoint(checkpoint: PersistedRecoveryCheckpoint): MaybePromise<void>;
  persistOracleEvaluation(record: PersistedOracleEvaluation): MaybePromise<void>;
  persistRunResult(record: PersistedRunResult): MaybePromise<void>;
  /** Optional: fail closed before a physical/remote dispatch when the fence rotated. */
  assertExecutionFence?(runId: string, fence: RecoveryFence | undefined): MaybePromise<void>;
}

export interface MutationAdmissionPort {
  acquire(deviceId: string, runId: string): MaybePromise<boolean>;
  release(deviceId: string, runId: string): MaybePromise<void>;
}

export interface VariableRuntimePort {
  get(name: string): unknown;
  set(name: string, value: unknown): void;
}

export interface GenericStepResult {
  succeeded: boolean;
  next?: string | null;
  outputVariable?: string;
  output?: unknown;
  actionResult?: StepActionOutcome;
  /**
   * Why the step ended this way, in the runtime's own words.
   *
   * A generic step writes only the four outcome axes, so a failed
   * `RESOLVE_TARGET` persisted `action_result: FAILED` and nothing else — the
   * device's `not_found` / `ambiguous` / `stale_tree` code lived in host stdout
   * and nowhere a run report could reach. When present this is persisted as an
   * action transition so the reason survives the process.
   */
  evidenceRef?: string;
}

export interface GenericStepRuntimePort {
  execute(step: BridgeFlowPlanStep, context: StepExecutionContext): Promise<GenericStepResult>;
}

export interface RemoteRuntimePort {
  execute(step: BridgeFlowPlanStep, context: StepExecutionContext): Promise<GenericStepResult>;
}

export interface OracleRuntimePort {
  runContinueGate(work: {
    runId: string;
    occurrenceId: string;
    iterationKey: string;
    policy: NonNullable<BridgeFlowPlanStep["continueGate"]>;
    startedAtMs: number;
    signal?: AbortSignal;
    recoveryFence?: RecoveryFence;
  }): Promise<
    | { status: "SATISFIED" | "TIMED_OUT"; evaluation: ContinueGateEvaluation }
    | { status: "CANCELLED" | "CLOSED" | "BLOCKED"; reason?: string }
  >;
  runFinalOracle(work: {
    runId: string;
    occurrenceId: string;
    iterationKey: string;
    policy: NonNullable<BridgeFlowPlanStep["finalOraclePolicy"]>;
    startedAtMs: number;
    signal?: AbortSignal;
    recoveryFence?: RecoveryFence;
  }): Promise<
    | {
        status: "SATISFIED" | "VIOLATED" | "INCONCLUSIVE" | "NOT_APPLICABLE";
        evaluation: FinalOracleEvaluation;
      }
    | { status: "CANCELLED" | "CLOSED" | "BLOCKED"; reason?: string }
  >;
}

/**
 * How often a `WAIT_EVENT` re-reads its fact. Small enough that a screen the
 * device already reports does not add visible latency to a run, large enough that
 * a 30s wait is a few dozen map reads rather than thousands.
 */
const FACT_POLL_INTERVAL_MS = 200;

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

export interface BridgeFlowExecutorOptions {
  persistence: ExecutionPersistencePort;
  mutationAdmission: MutationAdmissionPort;
  bridge: BridgeRuntimePort;
  evidence: EvidenceRuntimePort;
  conditionContext?: ConditionEvaluationContext;
  variables?: VariableRuntimePort;
  genericSteps?: GenericStepRuntimePort;
  remoteRuntime?: RemoteRuntimePort;
  oracle?: OracleRuntimePort;
  clock: () => number;
  /**
   * Delay between re-reads while a `WAIT_EVENT` waits for its fact.
   *
   * Injectable so the wait can be tested without real time. This is the ONLY timer
   * in the executor and it does not contradict "no host-side polling" (RUN_PLAY
   * §3.9): that rule forbids the host re-reading the DEVICE's UI tree on a timer.
   * A fact has already arrived at the host when it arrives at all, so this re-reads
   * an in-memory map and generates no device traffic.
   */
  sleep?: (ms: number) => Promise<void>;
}

export class InMemoryExecutionPersistence implements ExecutionPersistencePort {
  readonly runs: PersistedRunStart[] = [];
  readonly stepOccurrences: PersistedStepOccurrence[] = [];
  readonly actionTransitions: ActionTransition[] = [];
  readonly actionTransitionRecords: PersistedActionTransition[] = [];
  readonly waitResults: PersistedWaitResult[] = [];
  readonly recoveryCheckpoints: PersistedRecoveryCheckpoint[] = [];
  readonly oracleEvaluations: PersistedOracleEvaluation[] = [];
  readonly runResults: RunOutcomeAxes[] = [];
  readonly runResultRecords: PersistedRunResult[] = [];
  private readonly fences = new Map<string, RecoveryFence>();

  persistRunStart(record: PersistedRunStart): RecoveryFence {
    this.runs.push(record);
    const fence = { token: `fence:${record.runId}`, epoch: 1 };
    this.fences.set(record.runId, fence);
    return { ...fence };
  }

  currentExecutionFence(runId: string): RecoveryFence | undefined {
    const fence = this.fences.get(runId);
    return fence === undefined ? undefined : { ...fence };
  }

  rotateExecutionFence(runId: string): RecoveryFence {
    const current = this.fences.get(runId) ?? { token: `fence:${runId}`, epoch: 0 };
    const next = { token: `${current.token}:rotated`, epoch: current.epoch + 1 };
    this.fences.set(runId, next);
    return { ...next };
  }

  assertExecutionFence(runId: string, fence: RecoveryFence | undefined): void {
    if (fence === undefined) return;
    const current = this.fences.get(runId);
    if (current === undefined) {
      // Recovery resumes install the durable fence on first assertion.
      this.fences.set(runId, { ...fence });
      return;
    }
    if (current.token !== fence.token || current.epoch !== fence.epoch) {
      throw new Error("execution fence lost");
    }
  }

  persistStepOccurrence(occurrence: PersistedStepOccurrence): void {
    this.assertExecutionFence(occurrence.runId, occurrence.recoveryFence);
    const existingIndex = this.stepOccurrences.findIndex((existing) => existing.occurrenceId === occurrence.occurrenceId);
    if (existingIndex === -1) this.stepOccurrences.push(occurrence);
    else this.stepOccurrences[existingIndex] = occurrence;
  }

  persistActionTransition(record: PersistedActionTransition): void {
    this.assertExecutionFence(record.runId, record.recoveryFence);
    this.actionTransitionRecords.push(record);
    this.actionTransitions.push(record.transition);
  }

  persistWaitResult(result: PersistedWaitResult): void {
    void this.settleWaitTerminal(result);
  }

  settleWaitTerminal(incoming: PersistedWaitResult): WaitTerminalSettlement {
    this.assertExecutionFence(incoming.runId, incoming.recoveryFence);
    const current = this.waitResults.find((existing) =>
      existing.runId === incoming.runId &&
      existing.occurrenceId === incoming.occurrenceId &&
      existing.waitPlanId === incoming.waitPlanId
    );
    if (current !== undefined) return { won: false, result: { ...current } };
    const result = { ...incoming };
    this.waitResults.push(result);
    return { won: true, result: { ...result } };
  }

  persistRecoveryCheckpoint(checkpoint: PersistedRecoveryCheckpoint): void {
    this.assertExecutionFence(checkpoint.runId, checkpoint.recoveryFence);
    this.recoveryCheckpoints.push(structuredClone(checkpoint));
  }

  persistOracleEvaluation(record: PersistedOracleEvaluation): void {
    this.assertExecutionFence(record.runId, record.recoveryFence);
    this.oracleEvaluations.push(record);
  }

  persistRunResult(record: PersistedRunResult): void {
    this.assertExecutionFence(record.runId, record.recoveryFence);
    this.runResultRecords.push(record);
    this.runResults.push(record.result);
  }
}

export function createInMemoryMutationAdmission(): MutationAdmissionPort {
  const activeByDevice = new Map<string, string>();
  return {
    acquire(deviceId, runId) {
      const activeRunId = activeByDevice.get(deviceId);
      if (activeRunId !== undefined && activeRunId !== runId) return false;
      activeByDevice.set(deviceId, runId);
      return true;
    },
    release(deviceId, runId) {
      if (activeByDevice.get(deviceId) === runId) activeByDevice.delete(deviceId);
    },
  };
}

export function createInMemoryVariables(initial: Readonly<Record<string, unknown>> = {}): VariableRuntimePort {
  const values = new Map(Object.entries(initial));
  return {
    get: (name) => values.get(name),
    set: (name, value) => values.set(name, value),
  };
}

export function adaptCompiledUiWaitPlan(compiled: CompiledUiWaitPlan): UiWaitPlan {
  return {
    timeoutMs: compiled.deadlineMs,
    expected: compiled.expected.map((target) => ({
      key: target.key,
      predicate: {
        ...target.predicate,
        ...(compiled.stableForMs === undefined ? {} : { stableForMs: compiled.stableForMs }),
      },
    })),
    interrupts: compiled.interrupts.map((target) => ({
      key: target.key,
      predicate: target.predicate,
      expected: target.expected,
    })),
    ...(compiled.candidateLimit === undefined ? {} : { candidateLimit: compiled.candidateLimit }),
    ...(compiled.priority === undefined ? {} : { priority: compiled.priority }),
  };
}

interface ExecutionState {
  stopped: boolean;
  unknownEffect: boolean;
  automationFailure: boolean;
  evidenceInsufficient: boolean;
  productVerdicts: ProductVerdict[];
  cleanupResult: RunOutcomeAxes["cleanupResult"];
  resourceReleaseResult: RunOutcomeAxes["resourceReleaseResult"];
  schedulerDisposition: RunOutcomeAxes["schedulerDisposition"];
  operationalDisposition: RunOutcomeAxes["operationalDisposition"];
  occurrenceCounts: Map<string, number>;
  completedOccurrenceIds: Set<string>;
  completedIterationKeys: Set<string>;
  startedAtMsByOccurrenceId: Map<string, number>;
  continuationStack: RecoveryContinuationFrame[];
  checkpointRevision: number;
  recoveryFence?: RecoveryFence;
  lastCompletedControl?: RecoveryResumeState["lastCompletedControl"];
  checkpointNextStepId: string | null;
  checkpointIterationKey: string;
  checkpointedStopped: boolean;
  transitionCount: number;
}

interface StepResult {
  next: string | null;
  stop: boolean;
}

export class BridgeFlowExecutor {
  private readonly activeWaits = new Map<string, StepExecutionContext>();
  private readonly activeActions = new Map<string, StepExecutionContext>();

  constructor(private readonly options: BridgeFlowExecutorOptions) {}

  async execute(input: ExecuteBridgeFlowInput): Promise<RunOutcomeAxes> {
    let recoveryFence = input.recovery?.recoveryFence;
    const manifest = buildRunManifest({
      runId: input.runId,
      workflowRef: input.plan.workflowRef,
      workflowVersion: input.plan.workflowVersion,
      engineType: "BRIDGEFLOW",
      compiledPlanRef: input.plan.planId,
      compiledPlanHash: input.plan.hash.digest,
      domainPackKey: input.plan.provenance.packKey,
      domainPackVersion: input.plan.provenance.packVersion,
      domainPackDigest: input.plan.packDigest,
      workflowIrSchemaVersion: input.plan.schemaVersion,
      compilerVersion: input.plan.provenance.compilerVersion,
      bridgeProtocolVersion: "1",
      sdkProtocolVersion: "1",
      runEpochMs: this.options.clock(),
      profile: input.profile ?? {
        profileKey: "default",
        profileVersion: "unversioned",
        releaseGate: false,
      },
      reducerGraphDigest: input.plan.evidenceManifest.derivedGraphDigest,
    });
    if (input.recovery === undefined) {
      const acquired = await this.options.persistence.persistRunStart({
        runId: input.runId,
        engineType: "BRIDGEFLOW",
        manifest,
      });
      if (
        acquired === undefined ||
        acquired === null ||
        typeof acquired !== "object" ||
        typeof acquired.token !== "string" ||
        acquired.token.trim() === "" ||
        !Number.isInteger(acquired.epoch) ||
        acquired.epoch < 1
      ) {
        throw new Error("execution fence required from persistRunStart");
      }
      recoveryFence = { token: acquired.token, epoch: acquired.epoch };
    }

    const stepsById = new Map(input.plan.steps.map((step) => [step.planStepId, step]));
    if (stepsById.size !== input.plan.steps.length) {
      return this.closeFailedRun(
        input.runId,
        "duplicate planStepId in compiled plan",
        recoveryFence,
      );
    }
    if (!stepsById.has(input.plan.entryStepId)) {
      return this.closeFailedRun(
        input.runId,
        `entryStepId ${input.plan.entryStepId} not found`,
        recoveryFence,
      );
    }

    const state: ExecutionState = {
      stopped: input.recovery?.outcomeState?.stopped ?? false,
      unknownEffect: input.recovery?.outcomeState?.unknownEffect ?? false,
      automationFailure: input.recovery?.outcomeState?.automationFailure ?? false,
      evidenceInsufficient: input.recovery?.outcomeState?.evidenceInsufficient ?? false,
      productVerdicts: [...(input.recovery?.outcomeState?.productVerdicts ?? [])],
      cleanupResult: input.recovery?.outcomeState?.cleanupResult ?? "SUCCEEDED",
      resourceReleaseResult: input.recovery?.outcomeState?.resourceReleaseResult ?? "RELEASED",
      schedulerDisposition: input.recovery?.outcomeState?.schedulerDisposition ?? "RELEASED",
      operationalDisposition: input.recovery?.outcomeState?.operationalDisposition ?? "OK",
      occurrenceCounts: new Map(Object.entries(input.recovery?.occurrenceCounts ?? {})),
      completedOccurrenceIds: new Set(input.recovery?.completedOccurrenceIds ?? []),
      completedIterationKeys: new Set(input.recovery?.completedIterationKeys ?? []),
      startedAtMsByOccurrenceId: new Map(
        Object.entries(input.recovery?.startedAtMsByOccurrenceId ?? {}),
      ),
      continuationStack: (input.recovery?.continuationStack ?? []).map((frame) => ({ ...frame })),
      checkpointRevision: input.recovery?.revision ?? 0,
      ...(recoveryFence === undefined ? {} : { recoveryFence: { ...recoveryFence } }),
      ...(input.recovery?.lastCompletedControl === undefined
        ? {}
        : { lastCompletedControl: { ...input.recovery.lastCompletedControl } }),
      checkpointNextStepId:
        input.recovery?.nextStepId ?? input.plan.entryStepId,
      checkpointIterationKey:
        input.recovery?.runtimeIterationKey ?? "root",
      checkpointedStopped: input.recovery?.outcomeState?.stopped ?? false,
      transitionCount: 0,
    };

    const needsMutationLease =
      !state.stopped &&
      input.plan.steps.some((step) => step.kind === "BRIDGE_ACTION");
    let leaseHeld = false;
    if (needsMutationLease) {
      leaseHeld = await this.options.mutationAdmission.acquire(input.deviceId, input.runId);
      if (!leaseHeld) {
        state.automationFailure = true;
        state.stopped = true;
      }
    }

    try {
      if (!state.stopped) {
        if (input.recovery !== undefined && state.continuationStack.length > 0) {
          await this.resumeContinuations(input, stepsById, state);
        } else {
          await this.executeFlow(
            input,
            stepsById,
            input.recovery?.nextStepId ?? input.plan.entryStepId,
            null,
            input.recovery?.runtimeIterationKey ?? "root",
            state,
          );
        }
      }
    } finally {
      if (input.signal?.aborted) {
        state.automationFailure = true;
        state.stopped = true;
      }
      await this.cancelInFlight(input.runId);
      if (leaseHeld) await this.options.mutationAdmission.release(input.deviceId, input.runId);
    }

    if (state.stopped && !state.checkpointedStopped) {
      await this.persistRecoveryCheckpoint(
        input.runId,
        state.checkpointNextStepId,
        state.checkpointIterationKey,
        state,
      );
    }
    const result = this.buildRunOutcome(state);
    await this.options.persistence.persistRunResult({
      runId: input.runId,
      result,
      ...this.fenceRecord(state),
    });
    return result;
  }

  private async executeFlow(
    input: ExecuteBridgeFlowInput,
    stepsById: ReadonlyMap<string, BridgeFlowPlanStep>,
    startStepId: string | null,
    stopBeforeStepId: string | null,
    iterationKey: string,
    state: ExecutionState,
  ): Promise<void> {
    let currentStepId = startStepId;
    const maxTransitions = 100_000;

    while (currentStepId !== null && currentStepId !== stopBeforeStepId && !state.stopped) {
      state.transitionCount += 1;
      if (state.transitionCount > maxTransitions) {
        state.automationFailure = true;
        state.stopped = true;
        return;
      }

      const step = stepsById.get(currentStepId);
      if (step === undefined) {
        state.automationFailure = true;
        state.stopped = true;
        return;
      }

      if (step.kind !== "FOR_EACH") {
        const occurrenceIndex = state.occurrenceCounts.get(step.planStepId) ?? 0;
        const occurrenceId = `${input.runId}:${step.planStepId}:${occurrenceIndex}`;
        if (state.completedOccurrenceIds.has(occurrenceId)) {
          state.occurrenceCounts.set(step.planStepId, occurrenceIndex + 1);
          currentStepId = step.next;
          await this.persistRecoveryCheckpoint(input.runId, currentStepId, iterationKey, state);
          continue;
        }
      }

      if (step.kind === "FOR_EACH") {
        currentStepId = await this.executeForEach(input, stepsById, step, iterationKey, state);
        continue;
      }

      const result = await this.executeStep(input, step, iterationKey, state);
      if (result.stop) state.stopped = true;
      currentStepId = result.next;
    }
  }

  private async executeForEach(
    input: ExecuteBridgeFlowInput,
    stepsById: ReadonlyMap<string, BridgeFlowPlanStep>,
    step: BridgeFlowPlanStep,
    parentIterationKey: string,
    state: ExecutionState,
  ): Promise<string | null> {
    const variables = this.options.variables;
    const itemsVariable = asString(step.params["itemsVariable"]);
    const body = asString(step.params["body"]);
    const itemVariable = asString(step.params["itemVariable"]);
    const indexVariable = asString(step.params["indexVariable"]);
    const maxIterations = asPositiveInteger(step.params["maxIterations"]);
    const emptyPolicy = step.params["emptyPolicy"];

    if (!variables || !itemsVariable || !body || !itemVariable || !indexVariable || maxIterations === undefined) {
      state.automationFailure = true;
      state.stopped = true;
      return null;
    }

    const items = variables.get(itemsVariable);
    if (!Array.isArray(items) || items.length > maxIterations) {
      state.automationFailure = true;
      state.stopped = true;
      return null;
    }
    if (items.length === 0 && emptyPolicy !== "SKIP") {
      state.automationFailure = true;
      state.stopped = true;
      return null;
    }
    if (items.length === 0) return step.next;

    const frame: RecoveryContinuationFrame = {
      loopStepId: step.planStepId,
      parentIterationKey,
      bodyStepId: body,
      stopBeforeStepId: step.next,
      returnStepId: step.next,
      currentIndex: 0,
      itemCount: items.length,
      currentIterationKey: iterationKeyFor(parentIterationKey, step.planStepId, 0),
    };
    state.continuationStack.push(frame);
    for (let index = 0; index < items.length; index += 1) {
      frame.currentIndex = index;
      const iterationKey =
        iterationKeyFor(parentIterationKey, step.planStepId, index);
      frame.currentIterationKey = iterationKey;
      variables.set(itemVariable, items[index]);
      variables.set(indexVariable, index);
      if (state.completedIterationKeys.has(iterationKey)) {
        continue;
      }
      await this.persistRecoveryCheckpoint(input.runId, body, iterationKey, state);
      await this.executeFlow(input, stepsById, body, step.next, iterationKey, state);
      if (state.stopped) break;
      state.completedIterationKeys.add(iterationKey);
      await this.persistRecoveryCheckpoint(input.runId, step.planStepId, parentIterationKey, state);
    }
    state.continuationStack.pop();
    await this.persistRecoveryCheckpoint(input.runId, step.next, parentIterationKey, state);
    return step.next;
  }

  private async resumeContinuations(
    input: ExecuteBridgeFlowInput,
    stepsById: ReadonlyMap<string, BridgeFlowPlanStep>,
    state: ExecutionState,
  ): Promise<void> {
    let nextStepId = input.recovery?.nextStepId ?? null;
    let iterationKey = input.recovery?.runtimeIterationKey ?? "root";
    this.restoreLoopVariables(stepsById, state);

    while (!state.stopped) {
      const frame = state.continuationStack.at(-1);
      if (frame === undefined) {
        await this.executeFlow(input, stepsById, nextStepId, null, iterationKey, state);
        return;
      }
      await this.executeFlow(
        input,
        stepsById,
        nextStepId,
        frame.stopBeforeStepId,
        frame.currentIterationKey,
        state,
      );
      if (state.stopped) return;
      state.completedIterationKeys.add(frame.currentIterationKey);
      if (frame.currentIndex + 1 < frame.itemCount) {
        frame.currentIndex += 1;
        frame.currentIterationKey = iterationKeyFor(
          frame.parentIterationKey,
          frame.loopStepId,
          frame.currentIndex,
        );
        this.restoreLoopFrameVariables(stepsById, frame);
        nextStepId = frame.bodyStepId;
        iterationKey = frame.currentIterationKey;
        await this.persistRecoveryCheckpoint(input.runId, nextStepId, iterationKey, state);
        continue;
      }
      state.continuationStack.pop();
      nextStepId = frame.returnStepId;
      iterationKey = frame.parentIterationKey;
      await this.persistRecoveryCheckpoint(input.runId, nextStepId, iterationKey, state);
    }
  }

  private restoreLoopVariables(
    stepsById: ReadonlyMap<string, BridgeFlowPlanStep>,
    state: ExecutionState,
  ): void {
    for (const frame of state.continuationStack) {
      this.restoreLoopFrameVariables(stepsById, frame);
    }
  }

  private restoreLoopFrameVariables(
    stepsById: ReadonlyMap<string, BridgeFlowPlanStep>,
    frame: RecoveryContinuationFrame,
  ): void {
    const variables = this.options.variables;
    const loop = stepsById.get(frame.loopStepId);
    const itemsVariable = loop === undefined ? undefined : asString(loop.params["itemsVariable"]);
    const itemVariable = loop === undefined ? undefined : asString(loop.params["itemVariable"]);
    const indexVariable = loop === undefined ? undefined : asString(loop.params["indexVariable"]);
    const items = itemsVariable === undefined ? undefined : variables?.get(itemsVariable);
    if (
      variables === undefined ||
      loop?.kind !== "FOR_EACH" ||
      !itemVariable ||
      !indexVariable ||
      !Array.isArray(items) ||
      items.length !== frame.itemCount ||
      frame.currentIndex < 0 ||
      frame.currentIndex >= items.length
    ) {
      throw new Error(`cannot restore continuation frame ${frame.loopStepId}`);
    }
    variables.set(itemVariable, items[frame.currentIndex]);
    variables.set(indexVariable, frame.currentIndex);
  }

  private async executeStep(
    input: ExecuteBridgeFlowInput,
    step: BridgeFlowPlanStep,
    runtimeIterationKey: string,
    state: ExecutionState,
  ): Promise<StepResult> {
    const occurrenceIndex = state.occurrenceCounts.get(step.planStepId) ?? 0;
    state.occurrenceCounts.set(step.planStepId, occurrenceIndex + 1);
    const occurrenceId = `${input.runId}:${step.planStepId}:${occurrenceIndex}`;
    const iterationKey = this.iterationKey(step, runtimeIterationKey);
    const startedAtMs =
      state.startedAtMsByOccurrenceId.get(occurrenceId) ?? this.options.clock();
    state.startedAtMsByOccurrenceId.set(occurrenceId, startedAtMs);
    const context: StepExecutionContext = {
      runId: input.runId,
      deviceId: input.deviceId,
      occurrenceId,
      occurrenceIndex,
      iterationKey,
      requestId: `${input.runId}:${step.planStepId}:${occurrenceIndex}:attempt-1`,
      startedAtMs,
      ...this.fenceRecord(state),
    };
    const outcome = createInitialStepOutcome();
    outcome.actionResult = "RUNNING";
    await this.persistOccurrence(input.runId, step, context, outcome);
    await this.persistRecoveryCheckpoint(input.runId, step.planStepId, runtimeIterationKey, state);

    let next = step.next;
    let stop = false;

    switch (step.kind) {
      case "BRIDGE_ACTION": {
        const actionResult = await this.executeBridgeAction(input.runId, step, context, input.signal);
        if (actionResult.terminalState === "UNKNOWN_EFFECT") {
          state.unknownEffect = true;
          outcome.actionResult = "UNKNOWN_EFFECT";
          stop = true;
        } else if (actionResult.terminalState === "SKIPPED") {
          // Nothing to do, and that is a correct outcome: the step's target is
          // declared `TREAT_AS_ABSENT` and was absent. NOT an automation failure
          // and NOT a success — the run continues and the report says the step
          // had no subject.
          //
          // `effectVerified` is deliberately not consulted. There was no effect,
          // so demanding its verification is how an optional interaction used to
          // become `FAILED` + evidenceInsufficient on every clean run.
          outcome.actionResult = "SKIPPED";
        } else if (actionResult.terminalState !== "SUCCEEDED") {
          outcome.actionResult = actionResult.terminalState;
          state.automationFailure = true;
          stop = true;
        } else if (!actionResult.effectVerified) {
          outcome.actionResult = "FAILED";
          state.evidenceInsufficient = true;
          stop = true;
        } else {
          outcome.actionResult = "SUCCEEDED";
        }
        break;
      }
      case "WAIT_ANY":
      case "WAIT_EVENT": {
        const result = await this.executeWait(input, step, context);
        outcome.actionResult = result.actionResult;
        outcome.continueGateResult = result.continueGateResult;
        next = result.next;
        stop = result.stop;
        if (stop) state.evidenceInsufficient = true;
        break;
      }
      case "CONDITION": {
        const branch = this.evaluateConditionStep(step);
        outcome.actionResult = branch.ok ? "SUCCEEDED" : "FAILED";
        next = branch.next;
        stop = !branch.ok;
        if (stop) state.automationFailure = true;
        break;
      }
      case "SWITCH": {
        const branch = this.evaluateSwitchStep(step);
        outcome.actionResult = branch.ok ? "SUCCEEDED" : "FAILED";
        next = branch.next;
        stop = !branch.ok;
        if (stop) state.automationFailure = true;
        break;
      }
      case "ASSERT_FACT": {
        const factKey = asString(step.params["factKey"]);
        const expected = step.params["expected"];
        const fact = this.correlatedFacts(context).find((candidate) => candidate.factKey === factKey);
        // MEASURED means the run observed a real boolean. `'UNKNOWN'` and an
        // absent fact are both "nobody could tell", which is a different claim.
        const measured = fact !== undefined && typeof fact.value === "boolean";
        const satisfied = measured && typeof expected === "boolean" && fact.value === expected;
        // NOT YET OBSERVED, and this step's own Final Oracle is the authority on
        // that fact: defer to it instead of pre-empting it.
        //
        // An ASSERT_FACT is a one-shot read; a requirement declared EVENTUAL is a
        // question with a deadline. When the same step carries both — which is
        // the normal shape, the assert being the fast path in front of the oracle
        // — a fact that has not landed YET is not "insufficient evidence", it is
        // evidence that has not arrived. Measured on device: tour approval
        // reached `assert-approved` a moment before its derived conclusion was
        // published, the assert flagged the run evidence-insufficient and stopped
        // it, and the Final Oracle on that very step then evaluated SATISFIED
        // with all five requirements met. The run reported INCONCLUSIVE over an
        // oracle that had said yes.
        //
        // A MEASURED contradiction still fails immediately — waiting out a
        // deadline for an answer the run already has is how a real product
        // failure gets reported three minutes late.
        const oracleOwnsFact =
          !measured &&
          (step.finalOraclePolicy?.requirements ?? []).some(
            (requirement) => requirement.factKey === factKey && requirement.timing === "EVENTUAL",
          );
        if (oracleOwnsFact) {
          outcome.actionResult = "SKIPPED";
          break;
        }
        outcome.actionResult = satisfied ? "SUCCEEDED" : "FAILED";
        if (!satisfied) {
          if (measured) {
            // The fact was observed and it is the opposite of what the plan
            // asserted: the PRODUCT failed. Recording `evidenceInsufficient` here
            // — as this did for both branches — made every real product failure
            // report as "not enough evidence", because `aggregateProductVerdicts`
            // short-circuits on that flag before it ever looks at the verdicts the
            // Final Oracle produced. A wrong PIN, observed and refused end to end,
            // came out INCONCLUSIVE while the oracle beside it said VIOLATED.
            state.productVerdicts.push("FAIL_PRODUCT");
          } else {
            state.evidenceInsufficient = true;
          }
          stop = true;
        }
        break;
      }
      case "ANNOTATE":
      case "NOOP":
        outcome.actionResult = "SUCCEEDED";
        break;
      case "REMOTE_ACTION":
      case "EXTERNAL_ACTION": {
        const remote = this.options.remoteRuntime;
        if (remote === undefined) {
          outcome.actionResult = "FAILED";
          state.automationFailure = true;
          stop = true;
          break;
        }
        await this.assertLiveFence(input.runId, context.recoveryFence);
        const result = await remote.execute(step, context);
        outcome.actionResult = result.actionResult ?? (result.succeeded ? "SUCCEEDED" : "FAILED");
        if (result.outputVariable) this.options.variables?.set(result.outputVariable, result.output);
        if (result.next !== undefined) next = result.next;
        if (!result.succeeded) {
          state.automationFailure = true;
          stop = true;
        }
        break;
      }
      default: {
        const generic = this.options.genericSteps;
        if (!generic) {
          outcome.actionResult = "FAILED";
          state.automationFailure = true;
          stop = true;
          break;
        }
        await this.assertLiveFence(input.runId, context.recoveryFence);
        const result = await generic.execute(step, context);
        outcome.actionResult = result.actionResult ?? (result.succeeded ? "SUCCEEDED" : "FAILED");
        if (result.evidenceRef !== undefined) {
          await this.recordGenericStepEvidence(input.runId, context, result.evidenceRef);
        }
        if (result.outputVariable) this.options.variables?.set(result.outputVariable, result.output);
        if (result.next !== undefined) next = result.next;
        if (!result.succeeded) {
          state.automationFailure = true;
          stop = true;
        }
      }
    }

    if (!stop && step.continueGate) {
      const gateResult = this.options.oracle === undefined
        ? undefined
        : await this.options.oracle.runContinueGate({
            policy: step.continueGate,
            runId: input.runId,
            occurrenceId,
            iterationKey,
            startedAtMs,
            ...(input.signal === undefined ? {} : { signal: input.signal }),
            ...this.fenceRecord(state),
          });
      const gate = gateResult !== undefined && "evaluation" in gateResult
        ? gateResult.evaluation
        : undefined;
      if (gate === undefined) {
        // A gate that never evaluated is NOT the same as a gate whose facts did not
        // hold, and both used to persist the identical `UNSATISFIED` with no oracle
        // evaluation row. That cost a full debugging session: a login run reported
        // "the route list was not ready" when the truth was that the run's evidence
        // stream had been blocked and the gate was short-circuited before it ever
        // looked at a fact. The status/reason is the only thing that tells them
        // apart, so it is written where a run report can read it.
        outcome.continueGateResult = "UNSATISFIED";
        state.evidenceInsufficient = true;
        if (input.signal?.aborted) state.automationFailure = true;
        stop = true;
        await this.recordGateShortCircuit(input.runId, context, gateResult);
      } else {
      await this.options.persistence.persistOracleEvaluation({
        runId: input.runId,
        occurrenceId,
        evaluatorKind: "CONTINUE_GATE",
        evaluation: gate,
        ...this.fenceRecord(state),
      });
      outcome.continueGateResult = gate.outcome;
      if (gate.outcome !== "SATISFIED") {
        state.evidenceInsufficient = true;
        stop = true;
      }
      }
    }

    if (step.finalOraclePolicy) {
      const oracleResult = this.options.oracle === undefined
        ? undefined
        : await this.options.oracle.runFinalOracle({
            policy: step.finalOraclePolicy,
            runId: input.runId,
            occurrenceId,
            iterationKey,
            startedAtMs,
            ...(input.signal === undefined ? {} : { signal: input.signal }),
            ...this.fenceRecord(state),
          });
      const oracle = oracleResult !== undefined && "evaluation" in oracleResult
        ? oracleResult.evaluation
        : undefined;
      if (oracle === undefined) {
        outcome.finalOracleResult = "INCONCLUSIVE";
        state.evidenceInsufficient = true;
        if (input.signal?.aborted) state.automationFailure = true;
        stop = true;
      } else {
      await this.options.persistence.persistOracleEvaluation({
        runId: input.runId,
        occurrenceId,
        evaluatorKind: "FINAL_ORACLE",
        evaluation: oracle,
        ...this.fenceRecord(state),
      });
      outcome.finalOracleResult = oracle.outcome;
      state.productVerdicts.push(oracle.productVerdict);
      if (oracle.evaluationFailureClass === "EVIDENCE_INSUFFICIENT") state.evidenceInsufficient = true;
      if (oracle.productVerdict === "FAIL_PRODUCT" || oracle.productVerdict === "INCONCLUSIVE") stop = true;
      }
    }

    if (stop) state.stopped = true;
    state.completedOccurrenceIds.add(occurrenceId);
    state.lastCompletedControl = {
      occurrenceId,
      nextStepId: next,
      runtimeIterationKey,
    };
    await this.persistRecoveryCheckpoint(input.runId, next, runtimeIterationKey, state);
    await this.persistOccurrence(input.runId, step, context, outcome);
    return { next, stop };
  }

  private async executeBridgeAction(
    runId: string,
    step: BridgeFlowPlanStep,
    context: StepExecutionContext,
    signal?: AbortSignal,
  ): Promise<BridgeActionResult> {
    if (signal?.aborted) {
      return {
        terminalState: "CANCELLED",
        effectVerified: false,
        evidenceRef: "executor:aborted-before-dispatch",
      };
    }
    await this.assertLiveFence(runId, context.recoveryFence);
    const transitions = this.buildPreEffectTransitions(context);
    for (const transition of transitions) {
      await this.options.persistence.persistActionTransition({
        runId,
        occurrenceId: context.occurrenceId,
        transition,
        ...(context.recoveryFence === undefined
          ? {}
          : { recoveryFence: context.recoveryFence }),
      });
    }

    if (typeof this.options.bridge.cancelAction !== "function") {
      return {
        terminalState: "FAILED",
        effectVerified: false,
        evidenceRef: "executor:missing-cancel-action-port",
      };
    }
    await this.assertLiveFence(runId, context.recoveryFence);
    this.activeActions.set(context.requestId, context);
    const actionPromise = this.options.bridge.act(step, context);
    const result = await this.raceActionWithAbort(actionPromise, context, signal);
    this.activeActions.delete(context.requestId);
    const terminal: ActionTerminalState =
      result.terminalState === "SUCCEEDED" && !result.effectVerified ? "FAILED" : result.terminalState;
    const finalTransition = appendActionTransition(transitions, {
      phase: "EFFECT_VERIFIED",
      requestId: context.requestId,
      atMs: this.options.clock(),
      evidenceRef: result.evidenceRef,
      terminal,
    }).at(-1);
    if (finalTransition) {
      await this.options.persistence.persistActionTransition({
        runId,
        occurrenceId: context.occurrenceId,
        transition: finalTransition,
        ...(context.recoveryFence === undefined
          ? {}
          : { recoveryFence: context.recoveryFence }),
      });
    }
    return result;
  }

  private async executeWait(
    input: ExecuteBridgeFlowInput,
    step: BridgeFlowPlanStep,
    context: StepExecutionContext,
  ): Promise<{
    actionResult: StepActionOutcome;
    continueGateResult: StepOccurrence["outcome"]["continueGateResult"];
    next: string | null;
    stop: boolean;
  }> {
    const compiled = input.plan.waitPlans.find((candidate) => candidate.planStepId === step.planStepId);
    if (!compiled || typeof this.options.bridge.cancelWait !== "function") {
      return { actionResult: "FAILED", continueGateResult: "UNSATISFIED", next: null, stop: true };
    }

    await this.assertLiveFence(input.runId, context.recoveryFence);
    // A WAIT_ANY over FACTS asks the bridge for a view that does not exist.
    //
    // The compiler turns every leg into `{ by: "id", value: <factKey> }`
    // (`wait-compiler.ts`), so the device is asked for a view whose resource id
    // is the string "UI.TASK_LIST_READY". Measured 2026-08-13 with the task list
    // ON SCREEN: `find_id UI.TASK_LIST_READY` → matched 0,
    // `find_id UI.DELIVERY_FLOW_READY` → matched 0. `open-stop` reached this wait
    // having just SATISFIED a continue gate on those same two facts, opened the
    // stop, and then failed waiting to arrive where it already was.
    //
    // So the facts are consulted FIRST, and only when none of them is already
    // true does the bridge path run. Checking first rather than replacing the
    // bridge wait is deliberate: the bridge is what watches interrupt surfaces
    // during a wait, and a fact-only path would silently stop watching them.
    //
    // What this does NOT fix: a leg whose fact becomes true AFTER the step began
    // is still invisible, because from here on the bridge owns the wait and the
    // bridge is looking for a view. Closing that needs the bridge to accept fact
    // legs, or the host to race both — recorded rather than guessed at.
    if (step.kind === "WAIT_ANY") {
      const legs = Array.isArray(step.params["legs"]) ? step.params["legs"] : [];
      const facts = this.correlatedFacts(context);
      for (const leg of legs) {
        if (!isRecord(leg)) continue;
        const factKey = asString(leg["factKey"]);
        const legId = asString(leg["legId"]);
        if (factKey === undefined || legId === undefined) continue;
        if (!facts.some((candidate) => candidate.factKey === factKey && candidate.value === true)) continue;
        await this.options.persistence.settleWaitTerminal({
          runId: input.runId,
          occurrenceId: context.occurrenceId,
          waitPlanId: compiled.waitPlanId,
          requestId: context.requestId,
          status: "EXPECTED_MATCH",
          key: legId,
          ...(context.recoveryFence === undefined ? {} : { recoveryFence: context.recoveryFence }),
        });
        const onWin = leg["onWin"];
        const next = typeof onWin === "string" || onWin === null ? (onWin as string | null) : step.next;
        return { actionResult: "SUCCEEDED", continueGateResult: "SATISFIED", next, stop: false };
      }
    }
    if (step.kind === "WAIT_EVENT") {
      const factKey = asString(step.params["factKey"]);
      const expectedKey = compiled.expected.find((target) => target.primary)?.key ?? compiled.expected[0]?.key;
      if (factKey !== undefined && expectedKey !== undefined) {
        // A WAIT_EVENT waits for a FACT, so it must never fall through to
        // `bridge.waitAny`. The compiler builds this step's UI predicate as
        // `{ by: "id", value: <factKey> }` — it asks the device for a view whose
        // resource id is "UI.LOGIN_SCREEN_READY". No such view exists, so the
        // bridge path could only ever time out, and it did: every UI wait failed
        // against a device that was on the right screen and reporting it.
        const fact = await this.awaitCorrelatedFact(factKey, compiled.deadlineMs, context, input.signal);
        const status = fact !== undefined
          ? "EXPECTED_MATCH"
          : input.signal?.aborted === true
            ? "CANCELLED"
            : "TIMEOUT";
        await this.options.persistence.settleWaitTerminal({
          runId: input.runId,
          occurrenceId: context.occurrenceId,
          waitPlanId: compiled.waitPlanId,
          requestId: context.requestId,
          status,
          ...(status === "EXPECTED_MATCH" ? { key: expectedKey } : {}),
          ...(context.recoveryFence === undefined
            ? {}
            : { recoveryFence: context.recoveryFence }),
        });
        if (status === "EXPECTED_MATCH") {
          return { actionResult: "SUCCEEDED", continueGateResult: "SATISFIED", next: step.next, stop: false };
        }
        // See the same policy check on the bridge wait path below. This is the
        // branch that actually carries fact waits, so a CONTINUE policy that is
        // only honoured down there is not honoured at all.
        if (status === "TIMEOUT" && step.params["onTimeout"] === "CONTINUE") {
          return { actionResult: "SKIPPED", continueGateResult: "SKIPPED", next: step.next, stop: false };
        }
        return {
          actionResult: status === "CANCELLED" ? "CANCELLED" : "FAILED",
          continueGateResult: status === "TIMEOUT" ? "TIMED_OUT" : "UNSATISFIED",
          next: null,
          stop: true,
        };
      }
    }
    this.activeWaits.set(context.requestId, context);
    const waitPromise = this.options.bridge
      .waitAny(adaptCompiledUiWaitPlan(compiled), context)
      .then((candidate) => this.options.persistence.settleWaitTerminal({
        runId: input.runId,
        occurrenceId: context.occurrenceId,
        waitPlanId: compiled.waitPlanId,
        requestId: context.requestId,
        status: candidate.status,
        ...("key" in candidate ? { key: candidate.key } : {}),
        ...(context.recoveryFence === undefined
          ? {}
          : { recoveryFence: context.recoveryFence }),
      }));
    const abortRace = this.waitAbortSettlement(input, compiled.waitPlanId, context);
    let settled: WaitTerminalSettlement;
    try {
      settled = abortRace === undefined
        ? await waitPromise
        : await Promise.race([waitPromise, abortRace.promise]);
    } finally {
      abortRace?.dispose();
      await Promise.resolve(this.options.bridge.cancelWait(context)).catch(() => undefined);
      this.activeWaits.delete(context.requestId);
    }
    const waitResult = persistedWaitToBridgeResult(settled.result);

    if (waitResult.status === "EXPECTED_MATCH") {
      const legs = Array.isArray(step.params["legs"]) ? step.params["legs"] : [];
      const winner = legs.find((leg) => isRecord(leg) && leg["legId"] === waitResult.key);
      const winnerNext = isRecord(winner) && (typeof winner["onWin"] === "string" || winner["onWin"] === null)
        ? winner["onWin"] as string | null
        : step.next;
      return { actionResult: "SUCCEEDED", continueGateResult: "SATISFIED", next: winnerNext, stop: false };
    }

    if (waitResult.status === "INTERRUPT_MATCH") {
      const interrupt = compiled.interrupts.find((candidate) => candidate.key === waitResult.key);
      if (interrupt?.onInterrupt === "HANDLE") {
        return { actionResult: "SUCCEEDED", continueGateResult: "SATISFIED", next: step.next, stop: false };
      }
      return { actionResult: "FAILED", continueGateResult: "UNSATISFIED", next: null, stop: true };
    }

    // A timed-out wait is not automatically a failed run. The IR says what a
    // timeout MEANS for this particular wait (`onTimeout`), and until now the
    // executor read the deadline but not the policy — so a wait the pack had
    // explicitly marked as optional still stopped everything.
    //
    // The case that exposed it: TOUR_APPROVAL_LIFECYCLE waits for the approval
    // push, which is legitimately unreliable, declares `onTimeout: CONTINUE`,
    // and carries the fact as a WARNING requirement. On device every step
    // through the back-office approval succeeded and the run was still reported
    // INCONCLUSIVE — a verdict about Firebase, dressed as a verdict about the
    // product. Exactly what the CONTINUE policy existed to prevent.
    //
    // SKIPPED rather than SUCCEEDED, on both axes: nothing was observed and no
    // effect may be claimed. It is the same distinction an absent target makes —
    // "this step had no subject" is not "this step worked".
    if (waitResult.status === "TIMEOUT" && step.params["onTimeout"] === "CONTINUE") {
      return { actionResult: "SKIPPED", continueGateResult: "SKIPPED", next: step.next, stop: false };
    }

    return {
      actionResult: waitResult.status === "CANCELLED" ? "CANCELLED" : "FAILED",
      continueGateResult: waitResult.status === "TIMEOUT" ? "TIMED_OUT" : "UNSATISFIED",
      next: null,
      stop: true,
    };
  }

  private evaluateConditionStep(step: BridgeFlowPlanStep): { ok: boolean; next: string | null } {
    const condition = step.params["condition"] as ConditionNode | undefined;
    if (!condition || !this.options.conditionContext) return { ok: false, next: null };
    const result = evaluateCondition(condition, this.options.conditionContext).result;
    if (result === "TRUE") return { ok: true, next: nullableString(step.params["onTrue"]) };
    if (result === "FALSE") return { ok: true, next: nullableString(step.params["onFalse"]) };
    return this.resolveUnknown(step.params["unknownPolicy"], step.params["onUnknown"]);
  }

  private evaluateSwitchStep(step: BridgeFlowPlanStep): { ok: boolean; next: string | null } {
    if (!this.options.conditionContext || !Array.isArray(step.params["branches"])) return { ok: false, next: null };
    let sawUnknown = false;
    for (const branch of step.params["branches"]) {
      if (!isRecord(branch) || !isRecord(branch["condition"])) return { ok: false, next: null };
      const result = evaluateCondition(branch["condition"] as unknown as ConditionNode, this.options.conditionContext).result;
      if (result === "TRUE") return { ok: true, next: nullableString(branch["next"]) };
      if (result === "UNKNOWN") sawUnknown = true;
    }
    if (sawUnknown) return this.resolveUnknown(step.params["unknownPolicy"], undefined);

    const fallback = step.params["default"];
    if (!isRecord(fallback)) return { ok: false, next: null };
    if (fallback["policy"] === "GOTO") return { ok: true, next: nullableString(fallback["next"]) };
    return { ok: false, next: null };
  }

  private resolveUnknown(policy: unknown, onUnknown: unknown): { ok: boolean; next: string | null } {
    if ((policy as UnknownPolicy) === "BRANCH") return { ok: true, next: nullableString(onUnknown) };
    return { ok: false, next: null };
  }

  /**
   * Re-reads the occurrence's facts until the awaited one is true or the deadline
   * passes.
   *
   * Re-reading is what makes this work rather than a single check: the host's
   * producer correlates a live device state to THIS occurrence at query time, so
   * asking again is how the wait learns the screen arrived. The previous code
   * checked once, before the wait, which meant a fact that became true one
   * millisecond later was never seen.
   */
  /**
   * The first of several facts to arrive, or `undefined` on deadline.
   *
   * Legs are checked in DECLARED order on each poll, so a tie inside one polling
   * interval resolves to the leg the pack listed first rather than to whichever
   * the map happened to yield. A wait that raced non-deterministically would make
   * the branch it takes unreproducible.
   */
  private async awaitFirstCorrelatedFact(
    factKeys: readonly string[],
    deadlineMs: number,
    context: StepExecutionContext,
    signal: AbortSignal | undefined,
  ): Promise<string | undefined> {
    const sleep = this.options.sleep ?? defaultSleep;
    const expiresAt = this.options.clock() + deadlineMs;
    for (;;) {
      const facts = this.correlatedFacts(context);
      for (const factKey of factKeys) {
        if (facts.some((candidate) => candidate.factKey === factKey && candidate.value === true)) {
          return factKey;
        }
      }
      if (signal?.aborted === true) return undefined;
      const remaining = expiresAt - this.options.clock();
      if (remaining <= 0) return undefined;
      await sleep(Math.min(FACT_POLL_INTERVAL_MS, remaining));
    }
  }

  private async awaitCorrelatedFact(
    factKey: string,
    deadlineMs: number,
    context: StepExecutionContext,
    signal: AbortSignal | undefined,
  ): Promise<ExecutorEvidenceFact | undefined> {
    const sleep = this.options.sleep ?? defaultSleep;
    const expiresAt = this.options.clock() + deadlineMs;
    for (;;) {
      const fact = this.correlatedFacts(context).find(
        (candidate) => candidate.factKey === factKey && candidate.value === true,
      );
      if (fact !== undefined) return fact;
      if (signal?.aborted === true) return undefined;
      const remaining = expiresAt - this.options.clock();
      if (remaining <= 0) return undefined;
      await sleep(Math.min(FACT_POLL_INTERVAL_MS, remaining));
    }
  }

  private correlatedFacts(context: StepExecutionContext): readonly ExecutorEvidenceFact[] {
    const nowMs = this.options.clock();
    return this.options.evidence
      .factsForOccurrence(context.occurrenceId, context.iterationKey)
      .filter((fact) =>
        fact.occurrenceId === context.occurrenceId &&
        fact.iterationKey === context.iterationKey &&
        nowMs - fact.observedAtMs <= fact.freshnessMaxAgeMs
      );
  }

  /**
   * Persist why a continue gate never produced an evaluation.
   *
   * Its own `requestId` suffix, not the step's: a `BRIDGE_ACTION` has already
   * written a complete, terminal transition sequence under that id, and appending
   * to it would either be refused or read as a second attempt at the action. This
   * is a separate observation about the gate, so it gets a separate identity.
   */
  private async recordGateShortCircuit(
    runId: string,
    context: StepExecutionContext,
    gateResult: { status: string; reason?: string } | undefined,
  ): Promise<void> {
    const status = gateResult?.status ?? "NO_ORACLE_PORT";
    const reason = gateResult?.reason;
    const requestId = `${context.requestId}:continue-gate`;
    const transition = appendActionTransition([], {
      phase: "RECEIVED",
      requestId,
      atMs: this.options.clock(),
      evidenceRef: `continue-gate:not-evaluated:${status}${reason === undefined ? "" : `:${reason}`}`,
    })[0];
    if (transition === undefined) return;
    await this.options.persistence.persistActionTransition({
      runId,
      occurrenceId: context.occurrenceId,
      transition,
      ...(context.recoveryFence === undefined ? {} : { recoveryFence: context.recoveryFence }),
    });
  }

  /**
   * Persist a generic step's own account of what happened.
   *
   * `TARGET_RESOLVED` rather than a new phase: a generic step's observation IS a
   * resolution attempt, and the phase vocabulary is ordered and closed, so
   * inventing a phase would break every consumer that switches on it. No
   * `terminal` marker — that axis belongs to `EFFECT_VERIFIED`, and nothing was
   * dispatched here.
   */
  private async recordGenericStepEvidence(
    runId: string,
    context: StepExecutionContext,
    evidenceRef: string,
  ): Promise<void> {
    const transitions = appendActionTransition(
      appendActionTransition([], {
        phase: "RECEIVED",
        requestId: context.requestId,
        atMs: this.options.clock(),
        evidenceRef: "executor:received",
      }),
      {
        phase: "TARGET_RESOLVED",
        requestId: context.requestId,
        atMs: this.options.clock(),
        evidenceRef,
      },
    );
    for (const transition of transitions) {
      await this.options.persistence.persistActionTransition({
        runId,
        occurrenceId: context.occurrenceId,
        transition,
        ...(context.recoveryFence === undefined ? {} : { recoveryFence: context.recoveryFence }),
      });
    }
  }

  private buildPreEffectTransitions(context: StepExecutionContext): readonly ActionTransition[] {
    const received = appendActionTransition([], {
      phase: "RECEIVED",
      requestId: context.requestId,
      atMs: this.options.clock(),
      evidenceRef: "executor:received",
    });
    const resolved = appendActionTransition(received, {
      phase: "TARGET_RESOLVED",
      requestId: context.requestId,
      atMs: this.options.clock(),
      evidenceRef: "executor:target-resolved",
    });
    return appendActionTransition(
      appendActionTransition(resolved, {
        phase: "GESTURE_DISPATCHED",
        requestId: context.requestId,
        atMs: this.options.clock(),
        evidenceRef: "executor:gesture-dispatched",
      }),
      {
        phase: "GESTURE_COMPLETED",
        requestId: context.requestId,
        atMs: this.options.clock(),
        evidenceRef: "executor:gesture-completed",
      },
    );
  }

  private async persistOccurrence(
    runId: string,
    step: BridgeFlowPlanStep,
    context: StepExecutionContext,
    outcome: StepOccurrence["outcome"],
  ): Promise<void> {
    await this.options.persistence.persistStepOccurrence({
      occurrenceId: context.occurrenceId,
      runId,
      planStepId: step.planStepId,
      occurrenceIndex: context.occurrenceIndex,
      iterationKey: context.iterationKey,
      requestId: context.requestId,
      startedAtMs: context.startedAtMs,
      outcome: { ...outcome },
      ...(context.recoveryFence === undefined
        ? {}
        : { recoveryFence: context.recoveryFence }),
    });
  }

  private async persistRecoveryCheckpoint(
    runId: string,
    nextStepId: string | null,
    runtimeIterationKey: string,
    state: ExecutionState,
  ): Promise<void> {
    state.checkpointRevision += 1;
    await this.options.persistence.persistRecoveryCheckpoint({
      runId,
      revision: state.checkpointRevision,
      nextStepId,
      runtimeIterationKey,
      occurrenceCounts: Object.fromEntries(state.occurrenceCounts),
      completedOccurrenceIds: [...state.completedOccurrenceIds],
      completedIterationKeys: [...state.completedIterationKeys],
      startedAtMsByOccurrenceId: Object.fromEntries(state.startedAtMsByOccurrenceId),
      continuationStack: state.continuationStack.map((frame) => ({ ...frame })),
      outcomeState: {
        stopped: state.stopped,
        unknownEffect: state.unknownEffect,
        automationFailure: state.automationFailure,
        evidenceInsufficient: state.evidenceInsufficient,
        productVerdicts: [...state.productVerdicts],
        cleanupResult: state.cleanupResult,
        resourceReleaseResult: state.resourceReleaseResult,
        schedulerDisposition: state.schedulerDisposition,
        operationalDisposition: state.operationalDisposition,
      },
      ...(state.lastCompletedControl === undefined
        ? {}
        : { lastCompletedControl: { ...state.lastCompletedControl } }),
      ...this.fenceRecord(state),
    });
    state.checkpointNextStepId = nextStepId;
    state.checkpointIterationKey = runtimeIterationKey;
    state.checkpointedStopped = state.stopped;
  }

  private waitAbortSettlement(
    input: ExecuteBridgeFlowInput,
    waitPlanId: string,
    context: StepExecutionContext,
  ): { promise: Promise<WaitTerminalSettlement>; dispose: () => void } | undefined {
    if (input.signal === undefined) return undefined;
    let listener: (() => void) | undefined;
    const promise = new Promise<WaitTerminalSettlement>((resolve, reject) => {
      const settleCancelled = () => {
        void Promise.resolve(this.options.persistence.settleWaitTerminal({
            runId: input.runId,
            occurrenceId: context.occurrenceId,
            waitPlanId,
            requestId: context.requestId,
            status: "CANCELLED",
            ...(context.recoveryFence === undefined
              ? {}
              : { recoveryFence: context.recoveryFence }),
          }))
          .then(resolve, reject);
      };
      if (input.signal?.aborted) settleCancelled();
      else {
        listener = settleCancelled;
        input.signal?.addEventListener("abort", listener, { once: true });
      }
    });
    return {
      promise,
      dispose: () => {
        if (listener !== undefined) input.signal?.removeEventListener("abort", listener);
      },
    };
  }

  private raceActionWithAbort(
    action: Promise<BridgeActionResult>,
    context: StepExecutionContext,
    signal?: AbortSignal,
  ): Promise<BridgeActionResult> {
    if (signal === undefined) return action;
    return new Promise((resolve) => {
      let abortOwned = false;
      let settled = false;
      const finish = (result: BridgeActionResult) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener("abort", cancel);
        resolve(result);
      };
      const cancel = () => {
        if (settled || abortOwned) return;
        abortOwned = true;
        void this.options.bridge.cancelAction(context.requestId, context)
          .then((confirmation) => finish(
            isRecord(confirmation) &&
            (confirmation["status"] === "CANCELLED" ||
              confirmation["status"] === "CANCELLED_BEFORE_EFFECT")
              ? {
                  terminalState: "CANCELLED",
                  effectVerified: false,
                  evidenceRef: "executor:run-abort",
                }
              : {
                  terminalState: "UNKNOWN_EFFECT",
                  effectVerified: false,
                  evidenceRef: "executor:cancel-unconfirmed",
                },
          ), () => finish({
            terminalState: "UNKNOWN_EFFECT",
            effectVerified: false,
            evidenceRef: "executor:cancel-failed",
          }));
      };
      action.then(
        (result) => {
          if (!abortOwned) finish(result);
        },
        () => finish({
          terminalState: abortOwned ? "UNKNOWN_EFFECT" : "FAILED",
          effectVerified: false,
          evidenceRef: "executor:action-failed",
        }),
      );
      if (signal.aborted) cancel();
      else signal.addEventListener("abort", cancel, { once: true });
    });
  }

  private fenceRecord(state: ExecutionState): { recoveryFence?: RecoveryFence } {
    return state.recoveryFence === undefined
      ? {}
      : { recoveryFence: { ...state.recoveryFence } };
  }

  private async assertLiveFence(
    runId: string,
    fence: RecoveryFence | undefined,
  ): Promise<void> {
    const assert = this.options.persistence.assertExecutionFence?.bind(
      this.options.persistence,
    );
    if (assert !== undefined) {
      await assert(runId, fence);
    }
  }

  private async cancelInFlight(runId: string): Promise<void> {
    const waits = [...this.activeWaits.entries()]
      .filter(([, context]) => context.runId === runId);
    const actions = [...this.activeActions.entries()]
      .filter(([, context]) => context.runId === runId);
    await Promise.allSettled([
      ...waits.map(([, context]) => this.options.bridge.cancelWait(context)),
      ...actions.map(([, context]) =>
        this.options.bridge.cancelAction(context.requestId, context)
      ),
    ]);
    for (const [requestId] of waits) this.activeWaits.delete(requestId);
    for (const [requestId] of actions) this.activeActions.delete(requestId);
  }

  private iterationKey(step: BridgeFlowPlanStep, runtimeIterationKey: string): string {
    if (runtimeIterationKey !== "root") return runtimeIterationKey;
    if (step.iterationPath && step.iterationPath.length > 0) {
      return step.iterationPath.map((segment) => `${segment.loopStepId}[${segment.index}]`).join("/");
    }
    return "root";
  }

  private buildRunOutcome(state: ExecutionState): RunOutcomeAxes {
    const productVerdict = aggregateProductVerdicts(state.productVerdicts, state);
    return finalizeRunOutcome({
      lifecycle: "CLOSED",
      productVerdict,
      evaluationFailureClass: state.evidenceInsufficient
        ? "EVIDENCE_INSUFFICIENT"
        : state.automationFailure
          ? "AUTOMATION_FAILURE"
          : "NONE",
      terminationReason: state.unknownEffect ? "UNKNOWN_ACTION_EFFECT" : state.automationFailure ? "ABORTED" : "COMPLETED",
      cleanupResult: state.cleanupResult,
      resourceReleaseResult: state.resourceReleaseResult,
      schedulerDisposition: state.schedulerDisposition,
      operationalDisposition:
        state.automationFailure || state.evidenceInsufficient
          ? "NEEDS_ATTENTION"
          : state.operationalDisposition,
    });
  }

  private async closeFailedRun(
    runId: string,
    _reason: string,
    recoveryFence?: RecoveryFence,
  ): Promise<RunOutcomeAxes> {
    const result = finalizeRunOutcome({
      lifecycle: "CLOSED",
      productVerdict: "INCONCLUSIVE",
      evaluationFailureClass: "AUTOMATION_FAILURE",
      terminationReason: "ABORTED",
      cleanupResult: "SUCCEEDED",
      resourceReleaseResult: "NOT_REQUIRED",
      schedulerDisposition: "RELEASED",
      operationalDisposition: "NEEDS_ATTENTION",
    });
    await this.options.persistence.persistRunResult({
      runId,
      result,
      ...(recoveryFence === undefined ? {} : { recoveryFence }),
    });
    return result;
  }
}

function aggregateProductVerdicts(verdicts: readonly ProductVerdict[], state: ExecutionState): ProductVerdict {
  if (state.unknownEffect || state.automationFailure || state.evidenceInsufficient) return "INCONCLUSIVE";
  if (verdicts.includes("FAIL_PRODUCT")) return "FAIL_PRODUCT";
  if (verdicts.includes("INCONCLUSIVE")) return "INCONCLUSIVE";
  const evaluated = verdicts.filter((verdict) => verdict !== "NOT_EVALUATED");
  if (evaluated.length === 0) return "NOT_EVALUATED";
  if (evaluated.every((verdict) => verdict === "PASS_QUEUED_OFFLINE")) return "PASS_QUEUED_OFFLINE";
  if (evaluated.every((verdict) => verdict === "PASS_ONLINE" || verdict === "PASS_QUEUED_OFFLINE")) return "PASS_ONLINE";
  return "INCONCLUSIVE";
}

function iterationKeyFor(
  parentIterationKey: string,
  loopStepId: string,
  index: number,
): string {
  return parentIterationKey === "root"
    ? `${loopStepId}[${index}]`
    : `${parentIterationKey}/${loopStepId}[${index}]`;
}

function persistedWaitToBridgeResult(result: PersistedWaitResult): WaitAnyResult {
  switch (result.status) {
    case "EXPECTED_MATCH":
      if (result.key === undefined) return { status: "WAIT_CONNECTION_LOST", elapsedMs: 0 };
      return { status: "EXPECTED_MATCH", key: result.key, elapsedMs: 0 };
    case "INTERRUPT_MATCH":
      if (result.key === undefined) return { status: "WAIT_CONNECTION_LOST", elapsedMs: 0 };
      return { status: "INTERRUPT_MATCH", key: result.key, expectedInterrupt: false, elapsedMs: 0 };
    case "AMBIGUOUS":
      return { status: "AMBIGUOUS", key: result.key ?? "unknown", matchedCount: 2, elapsedMs: 0 };
    case "TIMEOUT":
      return { status: "TIMEOUT", elapsedMs: 0 };
    case "CANCELLED":
      return { status: "CANCELLED", elapsedMs: 0 };
    case "WAIT_CONNECTION_LOST":
      return { status: "WAIT_CONNECTION_LOST", elapsedMs: 0 };
  }
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asPositiveInteger(value: unknown): number | undefined {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
