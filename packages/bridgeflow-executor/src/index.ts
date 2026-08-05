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
  evaluateContinueGate,
  evaluateFinalOracle,
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
}

export interface EvidenceRuntimePort {
  factsForOccurrence(occurrenceId: string): readonly ExecutorEvidenceFact[];
}

export type ExecutorEvidenceFact = NormalizedEvidenceFact;

export interface StepExecutionContext {
  runId: string;
  deviceId: string;
  occurrenceId: string;
  occurrenceIndex: number;
  iterationKey: string;
  requestId: string;
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
}

export type MaybePromise<T> = T | Promise<T>;

export interface PersistedRunStart {
  runId: string;
  engineType: "BRIDGEFLOW";
  manifest: RunManifest;
}

export interface PersistedActionTransition {
  runId: string;
  occurrenceId: string;
  transition: ActionTransition;
}

export interface PersistedWaitResult {
  runId: string;
  occurrenceId: string;
  waitPlanId: string;
  requestId: string;
  status: WaitAnyResult["status"];
  key?: string;
  cancelStatus?: string;
}

export interface PersistedOracleEvaluation {
  runId: string;
  occurrenceId: string;
  evaluatorKind: "CONTINUE_GATE" | "FINAL_ORACLE";
  evaluation: ContinueGateEvaluation | FinalOracleEvaluation;
}

export interface PersistedRunResult {
  runId: string;
  result: RunOutcomeAxes;
}

export interface ExecutionPersistencePort {
  persistRunStart(record: PersistedRunStart): MaybePromise<void>;
  persistStepOccurrence(occurrence: StepOccurrence): MaybePromise<void>;
  persistActionTransition(record: PersistedActionTransition): MaybePromise<void>;
  persistWaitResult(result: PersistedWaitResult): MaybePromise<void>;
  persistOracleEvaluation(record: PersistedOracleEvaluation): MaybePromise<void>;
  persistRunResult(record: PersistedRunResult): MaybePromise<void>;
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
}

export interface GenericStepRuntimePort {
  execute(step: BridgeFlowPlanStep, context: StepExecutionContext): Promise<GenericStepResult>;
}

export interface BridgeFlowExecutorOptions {
  persistence: ExecutionPersistencePort;
  mutationAdmission: MutationAdmissionPort;
  bridge: BridgeRuntimePort;
  evidence: EvidenceRuntimePort;
  conditionContext?: ConditionEvaluationContext;
  variables?: VariableRuntimePort;
  genericSteps?: GenericStepRuntimePort;
  clock: () => number;
}

export class InMemoryExecutionPersistence implements ExecutionPersistencePort {
  readonly runs: PersistedRunStart[] = [];
  readonly stepOccurrences: StepOccurrence[] = [];
  readonly actionTransitions: ActionTransition[] = [];
  readonly actionTransitionRecords: PersistedActionTransition[] = [];
  readonly waitResults: PersistedWaitResult[] = [];
  readonly oracleEvaluations: PersistedOracleEvaluation[] = [];
  readonly runResults: RunOutcomeAxes[] = [];

  persistRunStart(record: PersistedRunStart): void {
    this.runs.push(record);
  }

  persistStepOccurrence(occurrence: StepOccurrence): void {
    const existingIndex = this.stepOccurrences.findIndex((existing) => existing.occurrenceId === occurrence.occurrenceId);
    if (existingIndex === -1) this.stepOccurrences.push(occurrence);
    else this.stepOccurrences[existingIndex] = occurrence;
  }

  persistActionTransition(record: PersistedActionTransition): void {
    this.actionTransitionRecords.push(record);
    this.actionTransitions.push(record.transition);
  }

  persistWaitResult(result: PersistedWaitResult): void {
    if (!this.waitResults.some((existing) => existing.occurrenceId === result.occurrenceId)) {
      this.waitResults.push(result);
    }
  }

  persistOracleEvaluation(record: PersistedOracleEvaluation): void {
    this.oracleEvaluations.push(record);
  }

  persistRunResult(record: PersistedRunResult): void {
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
  occurrenceCounts: Map<string, number>;
  transitionCount: number;
}

interface StepResult {
  next: string | null;
  stop: boolean;
}

export class BridgeFlowExecutor {
  constructor(private readonly options: BridgeFlowExecutorOptions) {}

  async execute(input: ExecuteBridgeFlowInput): Promise<RunOutcomeAxes> {
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
    await this.options.persistence.persistRunStart({ runId: input.runId, engineType: "BRIDGEFLOW", manifest });

    const stepsById = new Map(input.plan.steps.map((step) => [step.planStepId, step]));
    if (stepsById.size !== input.plan.steps.length) {
      return this.closeFailedRun(input.runId, "duplicate planStepId in compiled plan");
    }
    if (!stepsById.has(input.plan.entryStepId)) {
      return this.closeFailedRun(input.runId, `entryStepId ${input.plan.entryStepId} not found`);
    }

    const state: ExecutionState = {
      stopped: false,
      unknownEffect: false,
      automationFailure: false,
      evidenceInsufficient: false,
      productVerdicts: [],
      occurrenceCounts: new Map(),
      transitionCount: 0,
    };

    const needsMutationLease = input.plan.steps.some((step) => step.kind === "BRIDGE_ACTION");
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
        await this.executeFlow(input, stepsById, input.plan.entryStepId, null, "root", state);
      }
    } finally {
      if (leaseHeld) await this.options.mutationAdmission.release(input.deviceId, input.runId);
    }

    const result = this.buildRunOutcome(state);
    await this.options.persistence.persistRunResult({ runId: input.runId, result });
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

    for (const [index, item] of items.entries()) {
      variables.set(itemVariable, item);
      variables.set(indexVariable, index);
      const iterationKey =
        parentIterationKey === "root"
          ? `${step.planStepId}[${index}]`
          : `${parentIterationKey}/${step.planStepId}[${index}]`;
      await this.executeFlow(input, stepsById, body, step.next, iterationKey, state);
      if (state.stopped) break;
    }
    return step.next;
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
    const context: StepExecutionContext = {
      runId: input.runId,
      deviceId: input.deviceId,
      occurrenceId,
      occurrenceIndex,
      iterationKey,
      requestId: `${input.runId}:${step.planStepId}:${occurrenceIndex}:attempt-1`,
    };
    const outcome = createInitialStepOutcome();
    outcome.actionResult = "RUNNING";
    await this.persistOccurrence(input.runId, step, context, outcome);

    let next = step.next;
    let stop = false;

    switch (step.kind) {
      case "BRIDGE_ACTION": {
        const actionResult = await this.executeBridgeAction(input.runId, step, context);
        if (actionResult.terminalState === "UNKNOWN_EFFECT") {
          state.unknownEffect = true;
          outcome.actionResult = "UNKNOWN_EFFECT";
          stop = true;
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
      case "WAIT_ANY": {
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
        const satisfied = fact !== undefined && typeof expected === "boolean" && fact.value === expected;
        outcome.actionResult = satisfied ? "SUCCEEDED" : "FAILED";
        if (!satisfied) {
          state.evidenceInsufficient = true;
          stop = true;
        }
        break;
      }
      case "ANNOTATE":
      case "NOOP":
        outcome.actionResult = "SUCCEEDED";
        break;
      default: {
        const generic = this.options.genericSteps;
        if (!generic) {
          outcome.actionResult = "FAILED";
          state.automationFailure = true;
          stop = true;
          break;
        }
        const result = await generic.execute(step, context);
        outcome.actionResult = result.actionResult ?? (result.succeeded ? "SUCCEEDED" : "FAILED");
        if (result.outputVariable) this.options.variables?.set(result.outputVariable, result.output);
        if (result.next !== undefined) next = result.next;
        if (!result.succeeded) {
          state.automationFailure = true;
          stop = true;
        }
      }
    }

    if (!stop && step.continueGate) {
      const gate = evaluateContinueGate({
        policy: step.continueGate,
        facts: this.correlatedFacts(context),
        occurrenceId,
        iterationKey,
        nowMs: this.options.clock(),
        startedAtMs: this.options.clock(),
      });
      await this.options.persistence.persistOracleEvaluation({
        runId: input.runId,
        occurrenceId,
        evaluatorKind: "CONTINUE_GATE",
        evaluation: gate,
      });
      outcome.continueGateResult = gate.outcome;
      if (gate.outcome !== "SATISFIED") {
        state.evidenceInsufficient = true;
        stop = true;
      }
    }

    if (step.finalOraclePolicy) {
      const oracle = evaluateFinalOracle({
        policy: step.finalOraclePolicy,
        facts: this.correlatedFacts(context),
        occurrenceId,
        iterationKey,
        nowMs: this.options.clock(),
        startedAtMs: this.options.clock(),
      });
      await this.options.persistence.persistOracleEvaluation({
        runId: input.runId,
        occurrenceId,
        evaluatorKind: "FINAL_ORACLE",
        evaluation: oracle,
      });
      outcome.finalOracleResult = oracle.outcome;
      state.productVerdicts.push(oracle.productVerdict);
      if (oracle.evaluationFailureClass === "EVIDENCE_INSUFFICIENT") state.evidenceInsufficient = true;
      if (oracle.productVerdict === "FAIL_PRODUCT" || oracle.productVerdict === "INCONCLUSIVE") stop = true;
    }

    await this.persistOccurrence(input.runId, step, context, outcome);
    return { next, stop };
  }

  private async executeBridgeAction(
    runId: string,
    step: BridgeFlowPlanStep,
    context: StepExecutionContext,
  ): Promise<BridgeActionResult> {
    const transitions = this.buildPreEffectTransitions(context);
    for (const transition of transitions) {
      await this.options.persistence.persistActionTransition({
        runId,
        occurrenceId: context.occurrenceId,
        transition,
      });
    }

    const result = await this.options.bridge.act(step, context);
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
    if (!compiled) {
      return { actionResult: "FAILED", continueGateResult: "UNSATISFIED", next: null, stop: true };
    }

    let waitResult: WaitAnyResult;
    let cancelStatus: string | undefined;
    try {
      waitResult = await this.options.bridge.waitAny(adaptCompiledUiWaitPlan(compiled), context);
    } finally {
      const cancel = await this.options.bridge.cancelWait(context);
      if (isRecord(cancel) && typeof cancel["status"] === "string") cancelStatus = cancel["status"];
    }

    await this.options.persistence.persistWaitResult({
      runId: input.runId,
      occurrenceId: context.occurrenceId,
      waitPlanId: compiled.waitPlanId,
      requestId: context.requestId,
      status: waitResult.status,
      ...("key" in waitResult ? { key: waitResult.key } : {}),
      ...(cancelStatus ? { cancelStatus } : {}),
    });

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

  private correlatedFacts(context: StepExecutionContext): readonly ExecutorEvidenceFact[] {
    const nowMs = this.options.clock();
    return this.options.evidence
      .factsForOccurrence(context.occurrenceId)
      .filter((fact) =>
        fact.occurrenceId === context.occurrenceId &&
        fact.iterationKey === context.iterationKey &&
        nowMs - fact.observedAtMs <= fact.freshnessMaxAgeMs
      );
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
      outcome: { ...outcome },
    });
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
      cleanupResult: "SUCCEEDED",
      resourceReleaseResult: "RELEASED",
      schedulerDisposition: "RELEASED",
      operationalDisposition: state.automationFailure || state.evidenceInsufficient ? "NEEDS_ATTENTION" : "OK",
    });
  }

  private async closeFailedRun(runId: string, _reason: string): Promise<RunOutcomeAxes> {
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
    await this.options.persistence.persistRunResult({ runId, result });
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
