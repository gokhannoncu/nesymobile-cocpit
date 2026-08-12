import { describe, expect, it } from "vitest";
import {
  BridgeFlowExecutor,
  InMemoryExecutionPersistence,
  adaptCompiledUiWaitPlan,
  createInMemoryMutationAdmission,
  createInMemoryVariables,
} from "./index.js";
import type { BridgeFlowPlan } from "@nesy/bridgeflow-compiler";
import type { WaitAnyResult } from "@nesy/bridge-contract";

function planFixture(overrides: Partial<BridgeFlowPlan> = {}): BridgeFlowPlan {
  return {
    schemaVersion: 1,
    planId: "plan-1",
    hash: { algorithm: "sha256", digest: "sha256:plan" },
    provenance: {
      compiledAt: "2026-08-05T13:00:00.000Z",
      compilerVersion: "phase-4c",
      packKey: "nesy-courier",
      packVersion: "1.0.0",
      packDigest: "sha256:pack",
      workflowRef: "workflow/demo",
      workflowVersion: 1,
      irHash: "sha256:ir",
      derivedGraphDigest: "sha256:graph",
    },
    packVersion: "1.0.0",
    packDigest: "sha256:pack",
    workflowRef: "workflow/demo",
    workflowVersion: 1,
    appCompatibilityRefs: [],
    adapterCompatibilityRefs: [],
    entryStepId: "step-1",
    steps: [
      {
        planStepId: "step-1",
        kind: "BRIDGE_ACTION",
        sourceMapRef: "src:1",
        timeoutMs: 1_000,
        next: null,
        capabilityRequirements: [],
        evidenceRequirements: [],
        params: {
          bridgeCommand: "tap",
          effectFactKey: "ui.done",
        },
      },
    ],
    waitPlans: [],
    capabilityManifest: { required: [], optional: [], gaps: [] },
    evidenceManifest: {
      continueGateRequirements: [],
      finalOracleRequirements: [],
      derivedGraphDigest: "sha256:graph",
      factDeliveryLanes: [],
    },
    resourceRequirements: [],
    domainDependencies: [],
    sourceMap: [],
    ...overrides,
  };
}

describe("bridgeflow executor", () => {
  it("adapts compiled UiWaitPlan to bridge wait runtime without full-dump hot path fields", () => {
    const wait = adaptCompiledUiWaitPlan({
      waitPlanId: "wait-1",
      planStepId: "step-1",
      sourceMapRef: "src:1",
      expected: [
        {
          key: "ready",
          predicate: { selector: { by: "id", value: "ready" }, until: "APPEAR" },
          primary: true,
        },
      ],
      interrupts: [
        {
          key: "permission",
          predicate: { selector: { by: "text", value: "Allow", exact: true }, until: "APPEAR" },
          expected: false,
          onInterrupt: "FATAL",
        },
      ],
      deadlineMs: 2_000,
      stableForMs: 100,
      candidateLimit: 4,
      maxLegs: 2,
      ambiguityPolicy: "FAIL",
      hostOnlyCancel: true,
      capabilityFallbacks: [],
      diagnosticCaptureArtifactPath: "diagnostic-only/accessibility.json",
    });

    expect(wait.timeoutMs).toBe(2_000);
    expect(wait.expected).toHaveLength(1);
    expect(wait.interrupts).toHaveLength(1);
    expect(wait).not.toHaveProperty("diagnosticCaptureArtifactPath");
  });

  it("executes a compiled plan, persists occurrence/result axes, and never emits Maestro artifacts", async () => {
    const persistence = new InMemoryExecutionPersistence();
    const executor = new BridgeFlowExecutor({
      persistence,
      mutationAdmission: createInMemoryMutationAdmission(),
      bridge: {
        act: async () => ({ terminalState: "SUCCEEDED", effectVerified: true, evidenceRef: "bridge:act" }),
        waitAny: async (): Promise<WaitAnyResult> => ({ status: "EXPECTED_MATCH", key: "ready", elapsedMs: 10 }),
        cancelWait: async () => ({ status: "CANCELLED" }),
        cancelAction: async () => ({ status: "CANCELLED" }),
      },
      evidence: {
        factsForOccurrence: () => [
          {
            factKey: "ui.done",
            occurrenceId: "run-1:step-1:0",
            iterationKey: "root",
            observedAtMs: 10,
            freshnessMaxAgeMs: 1_000,
            plane: "UI",
            subtype: "screen",
            value: true,
            authority: "PRIMARY",
            deliveryLane: "ORDERED_REQUIRED",
          },
        ],
      },
      clock: () => 10,
    });

    const result = await executor.execute({
      runId: "run-1",
      deviceId: "device-1",
      plan: planFixture(),
    });

    expect(result.lifecycle).toBe("CLOSED");
    expect(result.productVerdict).toBe("NOT_EVALUATED");
    expect(result.schedulerDisposition).toBe("RELEASED");
    expect(persistence.runs[0]?.engineType).toBe("BRIDGEFLOW");
    expect(persistence.runs[0]).not.toHaveProperty("yamlContent");
    expect(persistence.stepOccurrences).toHaveLength(1);
    expect(persistence.actionTransitions.map((transition) => transition.phase)).toContain("EFFECT_VERIFIED");
  });

  // A fact OBSERVED to be the opposite of what the plan asserted is the product
  // failing. A fact nobody could observe is the harness failing. Reporting both as
  // "not enough evidence" — which this did — hides every real product defect
  // behind a message that blames the test.
  describe("ASSERT_FACT separates a measured failure from an unmeasured one", () => {
    function assertPlan(): BridgeFlowPlan {
      return planFixture({
        entryStepId: "assert-1",
        steps: [
          {
            planStepId: "assert-1",
            kind: "ASSERT_FACT",
            sourceMapRef: "src:assert",
            timeoutMs: 1_000,
            next: null,
            capabilityRequirements: [],
            params: { factKey: "app.session", expected: true },
          },
        ],
      } as Partial<BridgeFlowPlan>);
    }

    function fact(value: boolean | "UNKNOWN") {
      return {
        factKey: "app.session",
        occurrenceId: "run-1:assert-1:0",
        iterationKey: "root",
        observedAtMs: 10,
        freshnessMaxAgeMs: 1_000,
        plane: "APP" as const,
        subtype: "sdk",
        value,
        authority: "PRIMARY" as const,
        deliveryLane: "ORDERED_REQUIRED" as const,
      };
    }

    async function runWith(facts: ReturnType<typeof fact>[]) {
      return new BridgeFlowExecutor({
        persistence: new InMemoryExecutionPersistence(),
        mutationAdmission: createInMemoryMutationAdmission(),
        bridge: {
          act: async () => ({ terminalState: "SUCCEEDED", effectVerified: true, evidenceRef: "bridge:act" }),
          waitAny: async (): Promise<WaitAnyResult> => ({ status: "EXPECTED_MATCH", key: "ready", elapsedMs: 10 }),
          cancelWait: async () => ({ status: "CANCELLED" }),
          cancelAction: async () => ({ status: "CANCELLED" }),
        },
        evidence: { factsForOccurrence: () => facts },
        clock: () => 10,
      }).execute({ runId: "run-1", deviceId: "device-1", plan: assertPlan() });
    }

    it("reports a measured false as a product failure", async () => {
      const result = await runWith([fact(false)]);
      expect(result.productVerdict).toBe("FAIL_PRODUCT");
      expect(result.evaluationFailureClass).not.toBe("EVIDENCE_INSUFFICIENT");
    });

    it("reports an UNKNOWN value as evidence-insufficient, not as a product failure", async () => {
      const result = await runWith([fact("UNKNOWN")]);
      expect(result.productVerdict).toBe("INCONCLUSIVE");
    });

    it("reports an absent fact as evidence-insufficient", async () => {
      const result = await runWith([]);
      expect(result.productVerdict).toBe("INCONCLUSIVE");
    });
  });

  it("requires effect verification before a step can succeed", async () => {
    const persistence = new InMemoryExecutionPersistence();
    const executor = new BridgeFlowExecutor({
      persistence,
      mutationAdmission: createInMemoryMutationAdmission(),
      bridge: {
        act: async () => ({ terminalState: "SUCCEEDED", effectVerified: false, evidenceRef: "bridge:act" }),
        waitAny: async (): Promise<WaitAnyResult> => ({ status: "EXPECTED_MATCH", key: "ready", elapsedMs: 10 }),
        cancelWait: async () => ({ status: "CANCELLED" }),
        cancelAction: async () => ({ status: "CANCELLED" }),
      },
      evidence: { factsForOccurrence: () => [] },
      clock: () => 10,
    });

    const result = await executor.execute({
      runId: "run-2",
      deviceId: "device-1",
      plan: planFixture(),
    });

    expect(result.productVerdict).toBe("INCONCLUSIVE");
    expect(persistence.stepOccurrences[0]?.outcome.actionResult).toBe("FAILED");
    expect(persistence.stepOccurrences[0]?.outcome.finalOracleResult).toBe("NOT_EVALUATED");
  });

  it("does not retry unknown physical effects", async () => {
    let actionCount = 0;
    const executor = new BridgeFlowExecutor({
      persistence: new InMemoryExecutionPersistence(),
      mutationAdmission: createInMemoryMutationAdmission(),
      bridge: {
        act: async () => {
          actionCount += 1;
          return { terminalState: "UNKNOWN_EFFECT", effectVerified: false, evidenceRef: "bridge:lost-response" };
        },
        waitAny: async (): Promise<WaitAnyResult> => ({ status: "TIMEOUT", elapsedMs: 1_000 }),
        cancelWait: async () => ({ status: "CANCELLED" }),
        cancelAction: async () => ({ status: "CANCELLED" }),
      },
      evidence: { factsForOccurrence: () => [] },
      clock: () => 10,
    });

    const result = await executor.execute({
      runId: "run-3",
      deviceId: "device-1",
      plan: planFixture(),
    });

    expect(actionCount).toBe(1);
    expect(result.terminationReason).toBe("UNKNOWN_ACTION_EFFECT");
  });

  it("routes wait results once and cancels in-flight wait on run finish", async () => {
    let cancelCount = 0;
    const persistence = new InMemoryExecutionPersistence();
    const executor = new BridgeFlowExecutor({
      persistence,
      mutationAdmission: createInMemoryMutationAdmission(),
      bridge: {
        act: async () => ({ terminalState: "SUCCEEDED", effectVerified: true, evidenceRef: "bridge:act" }),
        waitAny: async (): Promise<WaitAnyResult> => ({ status: "INTERRUPT_MATCH", key: "dialog", expectedInterrupt: false, elapsedMs: 4 }),
        cancelWait: async () => {
          cancelCount += 1;
          return { status: "CANCELLED" };
        },
        cancelAction: async () => ({ status: "CANCELLED" }),
      },
      evidence: { factsForOccurrence: () => [] },
      clock: () => 10,
    });

    await executor.execute({
      runId: "run-4",
      deviceId: "device-1",
      plan: planFixture({
        steps: [
          {
            planStepId: "step-1",
            kind: "WAIT_ANY",
            sourceMapRef: "src:1",
            timeoutMs: 1_000,
            next: null,
            capabilityRequirements: [],
            evidenceRequirements: [],
            params: {
              legs: [{ legId: "ready", factKey: "ui.ready", onWin: null }],
              maxLegs: 2,
              hostOnlyCancel: true,
            },
          },
        ],
        waitPlans: [
          {
            waitPlanId: "wait-1",
            planStepId: "step-1",
            sourceMapRef: "src:1",
            expected: [{ key: "ready", predicate: { selector: { by: "id", value: "ready" }, until: "APPEAR" } }],
            interrupts: [{ key: "dialog", predicate: { selector: { by: "text", value: "Error" }, until: "APPEAR" }, expected: false, onInterrupt: "FATAL" }],
            deadlineMs: 1_000,
            maxLegs: 2,
            ambiguityPolicy: "FAIL",
            hostOnlyCancel: true,
            capabilityFallbacks: [],
          },
        ],
      }),
    });

    expect(cancelCount).toBe(1);
    expect(persistence.waitResults).toHaveLength(1);
    expect(persistence.waitResults[0]?.status).toBe("INTERRUPT_MATCH");
    expect(persistence.actionTransitions).toHaveLength(0);
  });

  it("routes an expected wait winner to its declared branch", async () => {
    const actedSteps: string[] = [];
    const executor = new BridgeFlowExecutor({
      persistence: new InMemoryExecutionPersistence(),
      mutationAdmission: createInMemoryMutationAdmission(),
      bridge: {
        act: async (step) => {
          actedSteps.push(step.planStepId);
          return { terminalState: "SUCCEEDED", effectVerified: true, evidenceRef: "bridge:act" };
        },
        waitAny: async (): Promise<WaitAnyResult> => ({ status: "EXPECTED_MATCH", key: "ready", elapsedMs: 4 }),
        cancelWait: async () => ({ status: "CANCELLED" }),
        cancelAction: async () => ({ status: "CANCELLED" }),
      },
      evidence: { factsForOccurrence: () => [] },
      clock: () => 10,
    });

    await executor.execute({
      runId: "run-wait-branch",
      deviceId: "device-1",
      plan: planFixture({
        entryStepId: "wait",
        steps: [
          {
            planStepId: "wait",
            kind: "WAIT_ANY",
            sourceMapRef: "src:wait",
            timeoutMs: 1_000,
            next: "decoy",
            capabilityRequirements: [],
            evidenceRequirements: [],
            params: {
              legs: [{ legId: "ready", factKey: "ui.ready", onWin: "selected" }],
              maxLegs: 1,
              hostOnlyCancel: true,
            },
          },
          {
            planStepId: "decoy",
            kind: "BRIDGE_ACTION",
            sourceMapRef: "src:decoy",
            timeoutMs: 1_000,
            next: null,
            capabilityRequirements: [],
            evidenceRequirements: [],
            params: { action: "tap" },
          },
          {
            planStepId: "selected",
            kind: "BRIDGE_ACTION",
            sourceMapRef: "src:selected",
            timeoutMs: 1_000,
            next: null,
            capabilityRequirements: [],
            evidenceRequirements: [],
            params: { action: "tap" },
          },
        ],
        waitPlans: [
          {
            waitPlanId: "wait-plan",
            planStepId: "wait",
            sourceMapRef: "src:wait",
            expected: [{ key: "ready", predicate: { selector: { by: "id", value: "ready" }, until: "APPEAR" } }],
            interrupts: [],
            deadlineMs: 1_000,
            maxLegs: 1,
            ambiguityPolicy: "FAIL",
            hostOnlyCancel: true,
            capabilityFallbacks: [],
          },
        ],
      }),
    });

    expect(actedSteps).toEqual(["selected"]);
  });

  it("stores repeated node occurrences with distinct occurrence ids", async () => {
    const persistence = new InMemoryExecutionPersistence();
    const executor = new BridgeFlowExecutor({
      persistence,
      mutationAdmission: createInMemoryMutationAdmission(),
      bridge: {
        act: async () => ({ terminalState: "SUCCEEDED", effectVerified: true, evidenceRef: "bridge:act" }),
        waitAny: async (): Promise<WaitAnyResult> => ({ status: "EXPECTED_MATCH", key: "ready", elapsedMs: 1 }),
        cancelWait: async () => ({ status: "CANCELLED" }),
        cancelAction: async () => ({ status: "CANCELLED" }),
      },
      evidence: {
        factsForOccurrence: (occurrenceId) => [
          {
            factKey: "ui.done",
            occurrenceId,
            iterationKey: "root",
            observedAtMs: 10,
            freshnessMaxAgeMs: 1_000,
            plane: "UI",
            subtype: "screen",
            value: true,
            authority: "PRIMARY",
            deliveryLane: "ORDERED_REQUIRED",
          },
        ],
      },
      variables: createInMemoryVariables({
        items: Array.from({ length: 20 }, (_, index) => `item-${index}`),
      }),
      clock: () => 10,
    });

    await executor.execute({
      runId: "run-5",
      deviceId: "device-1",
      plan: planFixture({
        entryStepId: "loop",
        steps: [
          {
            planStepId: "loop",
            kind: "FOR_EACH",
            sourceMapRef: "src:loop",
            timeoutMs: 20_000,
            next: "after",
            capabilityRequirements: [],
            evidenceRequirements: [],
            params: {
              itemsVariable: "items",
              maxIterations: 20,
              itemVariable: "item",
              indexVariable: "index",
              body: "repeated-node",
              emptyPolicy: "FAIL",
            },
          },
          {
            planStepId: "repeated-node",
            kind: "BRIDGE_ACTION",
            sourceMapRef: "src:repeated",
            timeoutMs: 1_000,
            next: "after",
            capabilityRequirements: [],
            evidenceRequirements: [],
            params: { action: "tap" },
          },
          {
            planStepId: "after",
            kind: "NOOP",
            sourceMapRef: "src:after",
            timeoutMs: 1_000,
            next: null,
            capabilityRequirements: [],
            evidenceRequirements: [],
            params: { reason: "loop complete" },
          },
        ],
      }),
    });

    const repeated = persistence.stepOccurrences.filter((occurrence) => occurrence.planStepId === "repeated-node");
    expect(new Set(repeated.map((occurrence) => occurrence.occurrenceId)).size).toBe(20);
  });

  it("starts at entryStepId and follows next instead of executing array order", async () => {
    const actedSteps: string[] = [];
    const executor = new BridgeFlowExecutor({
      persistence: new InMemoryExecutionPersistence(),
      mutationAdmission: createInMemoryMutationAdmission(),
      bridge: {
        act: async (step) => {
          actedSteps.push(step.planStepId);
          return { terminalState: "SUCCEEDED", effectVerified: true, evidenceRef: `bridge:${step.planStepId}` };
        },
        waitAny: async (): Promise<WaitAnyResult> => ({ status: "TIMEOUT", elapsedMs: 1 }),
        cancelWait: async () => ({ status: "CANCELLED" }),
        cancelAction: async () => ({ status: "CANCELLED" }),
      },
      evidence: { factsForOccurrence: () => [] },
      clock: () => 10,
    });

    await executor.execute({
      runId: "run-flow",
      deviceId: "device-1",
      plan: planFixture({
        entryStepId: "entry",
        steps: [
          {
            planStepId: "decoy",
            kind: "BRIDGE_ACTION",
            sourceMapRef: "src:decoy",
            timeoutMs: 1_000,
            next: null,
            capabilityRequirements: [],
            evidenceRequirements: [],
            params: { action: "tap" },
          },
          {
            planStepId: "entry",
            kind: "BRIDGE_ACTION",
            sourceMapRef: "src:entry",
            timeoutMs: 1_000,
            next: "terminal",
            capabilityRequirements: [],
            evidenceRequirements: [],
            params: { action: "tap" },
          },
          {
            planStepId: "terminal",
            kind: "BRIDGE_ACTION",
            sourceMapRef: "src:terminal",
            timeoutMs: 1_000,
            next: null,
            capabilityRequirements: [],
            evidenceRequirements: [],
            params: { action: "tap" },
          },
        ],
      }),
    });

    expect(actedSteps).toEqual(["entry", "terminal"]);
  });

  it("evaluates condition steps and only executes the selected branch", async () => {
    const actedSteps: string[] = [];
    const executor = new BridgeFlowExecutor({
      persistence: new InMemoryExecutionPersistence(),
      mutationAdmission: createInMemoryMutationAdmission(),
      bridge: {
        act: async (step) => {
          actedSteps.push(step.planStepId);
          return { terminalState: "SUCCEEDED", effectVerified: true, evidenceRef: `bridge:${step.planStepId}` };
        },
        waitAny: async (): Promise<WaitAnyResult> => ({ status: "TIMEOUT", elapsedMs: 1 }),
        cancelWait: async () => ({ status: "CANCELLED" }),
        cancelAction: async () => ({ status: "CANCELLED" }),
      },
      evidence: { factsForOccurrence: () => [] },
      conditionContext: {
        resolveOperand: () => ({ resolved: true, value: "ready" }),
      },
      clock: () => 10,
    });

    await executor.execute({
      runId: "run-condition",
      deviceId: "device-1",
      plan: planFixture({
        entryStepId: "condition",
        steps: [
          {
            planStepId: "condition",
            kind: "CONDITION",
            sourceMapRef: "src:condition",
            timeoutMs: 1_000,
            next: null,
            capabilityRequirements: [],
            evidenceRequirements: [],
            params: {
              condition: {
                kind: "comparison",
                operator: "equals",
                left: { kind: "operand", source: "run.input", path: "state" },
                right: { kind: "literal", value: "ready" },
              },
              onTrue: "selected",
              onFalse: "decoy",
              unknownPolicy: "FAIL",
            },
          },
          {
            planStepId: "decoy",
            kind: "BRIDGE_ACTION",
            sourceMapRef: "src:decoy",
            timeoutMs: 1_000,
            next: null,
            capabilityRequirements: [],
            evidenceRequirements: [],
            params: { action: "tap" },
          },
          {
            planStepId: "selected",
            kind: "BRIDGE_ACTION",
            sourceMapRef: "src:selected",
            timeoutMs: 1_000,
            next: null,
            capabilityRequirements: [],
            evidenceRequirements: [],
            params: { action: "tap" },
          },
        ],
      }),
    });

    expect(actedSteps).toEqual(["selected"]);
  });

  it("uses Final Oracle v2 and never derives PASS from receipt-safe evidence", async () => {
    const persistence = new InMemoryExecutionPersistence();
    const executor = new BridgeFlowExecutor({
      persistence,
      mutationAdmission: createInMemoryMutationAdmission(),
      bridge: {
        act: async () => ({ terminalState: "SUCCEEDED", effectVerified: true, evidenceRef: "bridge:act" }),
        waitAny: async (): Promise<WaitAnyResult> => ({ status: "TIMEOUT", elapsedMs: 1 }),
        cancelWait: async () => ({ status: "CANCELLED" }),
        cancelAction: async () => ({ status: "CANCELLED" }),
      },
      evidence: {
        factsForOccurrence: (occurrenceId) => [
          {
            factKey: "app.persisted",
            occurrenceId,
            iterationKey: "root",
            observedAtMs: 1_000,
            freshnessMaxAgeMs: 1_000,
            plane: "APP",
            subtype: "sdk",
            value: true,
            authority: "PRIMARY",
            deliveryLane: "RECEIPT_SAFE",
            rawEventId: "receipt:app.persisted",
            reducerTrace: ["trusted:test"],
          },
        ],
      },
      oracle: {
        runContinueGate: async () => ({
          status: "SATISFIED",
          evaluation: {
            outcome: "SATISFIED",
            completedAtMs: 1_000,
            evidenceRefs: [],
            reason: "not used by this plan",
          },
        }),
        runFinalOracle: async () => ({
          status: "VIOLATED",
          evaluation: {
            outcome: "VIOLATED",
            productVerdict: "FAIL_PRODUCT",
            evaluationFailureClass: "NONE",
            requirementsByFact: {
              "app.persisted": {
                state: "VIOLATED",
                reason: "receipt-safe evidence cannot authorize Final Oracle",
              },
            },
            evidenceRefs: [],
          },
        }),
      },
      clock: () => 1_000,
    });

    const result = await executor.execute({
      runId: "run-oracle",
      deviceId: "device-1",
      plan: planFixture({
        steps: [
          {
            ...planFixture().steps[0]!,
            finalOraclePolicy: {
              requirements: [
                {
                  factKey: "app.persisted",
                  obligation: "REQUIRED",
                  timing: "IMMEDIATE",
                  onTimeout: "FAIL",
                },
              ],
            },
          },
        ],
      }),
    });

    expect(result.productVerdict).toBe("FAIL_PRODUCT");
    expect(result.evaluationFailureClass).toBe("NONE");
    expect(persistence.stepOccurrences[0]?.outcome.finalOracleResult).toBe("VIOLATED");
    expect(persistence.oracleEvaluations).toHaveLength(1);
  });

  it("holds mutation admission for the whole run", async () => {
    let acquireCount = 0;
    let releaseCount = 0;
    const executor = new BridgeFlowExecutor({
      persistence: new InMemoryExecutionPersistence(),
      mutationAdmission: {
        acquire: () => {
          acquireCount += 1;
          return true;
        },
        release: () => {
          releaseCount += 1;
        },
      },
      bridge: {
        act: async () => ({ terminalState: "SUCCEEDED", effectVerified: true, evidenceRef: "bridge:act" }),
        waitAny: async (): Promise<WaitAnyResult> => ({ status: "TIMEOUT", elapsedMs: 1 }),
        cancelWait: async () => ({ status: "CANCELLED" }),
        cancelAction: async () => ({ status: "CANCELLED" }),
      },
      evidence: { factsForOccurrence: () => [] },
      clock: () => 10,
    });

    await executor.execute({
      runId: "run-lease",
      deviceId: "device-1",
      plan: planFixture({
        steps: [
          { ...planFixture().steps[0]!, planStepId: "first", next: "second" },
          { ...planFixture().steps[0]!, planStepId: "second", next: null },
        ],
        entryStepId: "first",
      }),
    });

    expect(acquireCount).toBe(1);
    expect(releaseCount).toBe(1);
  });
});
