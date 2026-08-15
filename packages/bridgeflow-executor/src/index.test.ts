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

    function assertPlanWithCleanup(): BridgeFlowPlan {
      return planFixture({
        entryStepId: "assert-1",
        steps: [
          {
            planStepId: "assert-1",
            kind: "ASSERT_FACT",
            sourceMapRef: "src:assert",
            timeoutMs: 1_000,
            next: "clear-session",
            capabilityRequirements: [],
            params: { factKey: "app.session", expected: true },
          },
          {
            planStepId: "clear-session",
            kind: "CLEANUP",
            sourceMapRef: "src:cleanup",
            timeoutMs: 1_000,
            next: null,
            capabilityRequirements: [],
            params: {},
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

    it("keeps cleanup SUCCEEDED by default for workflows without a cleanup step", async () => {
      const result = await runWith([fact(true)]);
      expect(result.cleanupResult).toBe("SUCCEEDED");
    });

    it("reports an UNKNOWN value as evidence-insufficient, not as a product failure", async () => {
      const result = await runWith([fact("UNKNOWN")]);
      expect(result.productVerdict).toBe("INCONCLUSIVE");
    });

    it("reports an absent fact as evidence-insufficient", async () => {
      const result = await runWith([]);
      expect(result.productVerdict).toBe("INCONCLUSIVE");
    });

    it("executes cleanup exactly once after a normal path", async () => {
      const persistence = new InMemoryExecutionPersistence();
      const genericSteps: string[] = [];
      const executor = new BridgeFlowExecutor({
        persistence,
        mutationAdmission: createInMemoryMutationAdmission(),
        bridge: {
          act: async () => ({ terminalState: "SUCCEEDED", effectVerified: true, evidenceRef: "bridge:act" }),
          waitAny: async (): Promise<WaitAnyResult> => ({ status: "EXPECTED_MATCH", key: "ready", elapsedMs: 10 }),
          cancelWait: async () => ({ status: "CANCELLED" }),
          cancelAction: async () => ({ status: "CANCELLED" }),
        },
        evidence: { factsForOccurrence: () => [fact(false)] },
        genericSteps: {
          execute: async (step) => {
            genericSteps.push(step.planStepId);
            return { succeeded: true, actionResult: "SUCCEEDED", evidenceRef: "cleanup:done" };
          },
        },
        clock: () => 10,
      });

      const result = await executor.execute({
        runId: "run-1",
        deviceId: "device-1",
        plan: assertPlanWithCleanup(),
      });

      expect(result.cleanupResult).toBe("SUCCEEDED");
      expect(genericSteps).toEqual(["clear-session"]);
      expect(persistence.stepOccurrences.map((occurrence) => occurrence.planStepId)).toEqual([
        "assert-1",
        "clear-session",
      ]);
    });

    it("executes cleanup exactly once after a measured product failure", async () => {
      const persistence = new InMemoryExecutionPersistence();
      const genericSteps: string[] = [];
      const executor = new BridgeFlowExecutor({
        persistence,
        mutationAdmission: createInMemoryMutationAdmission(),
        bridge: {
          act: async () => ({ terminalState: "SUCCEEDED", effectVerified: true, evidenceRef: "bridge:act" }),
          waitAny: async (): Promise<WaitAnyResult> => ({ status: "EXPECTED_MATCH", key: "ready", elapsedMs: 10 }),
          cancelWait: async () => ({ status: "CANCELLED" }),
          cancelAction: async () => ({ status: "CANCELLED" }),
        },
        evidence: { factsForOccurrence: () => [fact(false)] },
        genericSteps: {
          execute: async (step) => {
            genericSteps.push(step.planStepId);
            return { succeeded: true, actionResult: "SUCCEEDED", evidenceRef: "cleanup:done" };
          },
        },
        clock: () => 10,
      });

      const result = await executor.execute({
        runId: "run-1",
        deviceId: "device-1",
        plan: assertPlanWithCleanup(),
      });

      expect(result.productVerdict).toBe("FAIL_PRODUCT");
      expect(result.evaluationFailureClass).toBe("NONE");
      expect(result.cleanupResult).toBe("SUCCEEDED");
      expect(genericSteps).toEqual(["clear-session"]);
      expect(persistence.stepOccurrences.map((occurrence) => occurrence.planStepId)).toEqual([
        "assert-1",
        "clear-session",
      ]);
    });

    it("still runs a later runOnFailure CLEANUP after a continue-gate timeout", async () => {
      const persistence = new InMemoryExecutionPersistence();
      const genericSteps: string[] = [];
      const executor = new BridgeFlowExecutor({
        persistence,
        mutationAdmission: createInMemoryMutationAdmission(),
        bridge: {
          act: async () => ({ terminalState: "SUCCEEDED", effectVerified: true, evidenceRef: "bridge:act" }),
          waitAny: async (): Promise<WaitAnyResult> => ({ status: "EXPECTED_MATCH", key: "ready", elapsedMs: 10 }),
          cancelWait: async () => ({ status: "CANCELLED" }),
          cancelAction: async () => ({ status: "CANCELLED" }),
        },
        evidence: { factsForOccurrence: () => [] },
        genericSteps: {
          execute: async (step) => {
            genericSteps.push(step.planStepId);
            return { succeeded: true, actionResult: "SUCCEEDED", evidenceRef: "cleanup:done" };
          },
        },
        oracle: {
          runContinueGate: async () => ({
            status: "TIMED_OUT",
            evaluation: {
              outcome: "TIMED_OUT",
              completedAtMs: 10,
              evidenceRefs: [],
              reason: "continue gate deadline elapsed without required facts",
            },
          }),
          runFinalOracle: async () => {
            throw new Error("final oracle must not run after a timed-out continue gate");
          },
        },
        clock: () => 10,
      });

      const result = await executor.execute({
        runId: "run-1",
        deviceId: "device-1",
        plan: planFixture({
          entryStepId: "tap-submit",
          steps: [
            {
              planStepId: "tap-submit",
              kind: "BRIDGE_ACTION",
              sourceMapRef: "src:tap",
              timeoutMs: 1_000,
              next: "read-app-session",
              capabilityRequirements: [],
              evidenceRequirements: [],
              continueGate: {
                anyOf: ["UI.ROUTE_LIST_READY"],
                deadlineMs: 30_000,
                unknownPolicy: "RETRY",
              },
              params: { action: "tap" },
            },
            {
              planStepId: "read-app-session",
              kind: "SDK_QUERY",
              sourceMapRef: "src:read",
              timeoutMs: 1_000,
              next: "clear-session",
              capabilityRequirements: [],
              evidenceRequirements: [],
              params: { queryRef: "session" },
            },
            {
              planStepId: "clear-session",
              kind: "CLEANUP",
              sourceMapRef: "src:cleanup",
              timeoutMs: 1_000,
              next: null,
              capabilityRequirements: [],
              evidenceRequirements: [],
              params: { runOnFailure: true },
            },
          ],
        }),
      });

      expect(result.productVerdict).toBe("INCONCLUSIVE");
      expect(result.evaluationFailureClass).toBe("EVIDENCE_INSUFFICIENT");
      expect(result.cleanupResult).toBe("SUCCEEDED");
      expect(genericSteps).toEqual(["clear-session"]);
      expect(persistence.stepOccurrences.map((occurrence) => occurrence.planStepId)).toEqual([
        "tap-submit",
        "clear-session",
      ]);
    });

    it("keeps the product verdict when cleanup fails and raises operational attention", async () => {
      const executor = new BridgeFlowExecutor({
        persistence: new InMemoryExecutionPersistence(),
        mutationAdmission: createInMemoryMutationAdmission(),
        bridge: {
          act: async () => ({ terminalState: "SUCCEEDED", effectVerified: true, evidenceRef: "bridge:act" }),
          waitAny: async (): Promise<WaitAnyResult> => ({ status: "EXPECTED_MATCH", key: "ready", elapsedMs: 10 }),
          cancelWait: async () => ({ status: "CANCELLED" }),
          cancelAction: async () => ({ status: "CANCELLED" }),
        },
        evidence: { factsForOccurrence: () => [fact(false)] },
        genericSteps: {
          execute: async () => ({ succeeded: false, actionResult: "FAILED", evidenceRef: "cleanup:failed" }),
        },
        clock: () => 10,
      });

      const result = await executor.execute({
        runId: "run-1",
        deviceId: "device-1",
        plan: assertPlanWithCleanup(),
      });

      expect(result.productVerdict).toBe("FAIL_PRODUCT");
      expect(result.evaluationFailureClass).toBe("NONE");
      expect(result.cleanupResult).toBe("FAILED");
      expect(result.operationalDisposition).toBe("NEEDS_ATTENTION");
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

  it("treats a remote UNKNOWN_EFFECT as unknown effect, not a product or automation fail", async () => {
    let oracleCalls = 0;
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
      evidence: { factsForOccurrence: () => [] },
      remoteRuntime: {
        execute: async () => ({ succeeded: false, actionResult: "UNKNOWN_EFFECT" }),
      },
      oracle: {
        runContinueGate: async () => {
          oracleCalls += 1;
          return { status: "SATISFIED", evaluation: { outcome: "SATISFIED" } as never };
        },
        runFinalOracle: async () => {
          oracleCalls += 1;
          return {
            status: "VIOLATED",
            evaluation: { outcome: "VIOLATED", productVerdict: "FAIL_PRODUCT", evaluationFailureClass: "NONE" },
          } as never;
        },
      },
      clock: () => 10,
    });

    const result = await executor.execute({
      runId: "run-remote-timeout",
      deviceId: "device-1",
      plan: planFixture({
        steps: [
          {
            planStepId: "step-1",
            kind: "REMOTE_ACTION",
            sourceMapRef: "src:1",
            timeoutMs: 1_000,
            next: null,
            capabilityRequirements: [],
            evidenceRequirements: [],
            params: { spec: { operationRef: "remote.mutation" } },
            finalOraclePolicy: {
              mode: "ALL_OF",
              onTimeout: "INCONCLUSIVE",
              requirements: [
                {
                  factKey: "REMOTE.CONFIRMED",
                  obligation: "REQUIRED",
                  timing: "EVENTUAL",
                  onTimeout: "INCONCLUSIVE",
                },
              ],
            } as never,
          },
        ],
      }),
    });

    expect(result.productVerdict).toBe("INCONCLUSIVE");
    expect(result.evaluationFailureClass).toBe("NONE");
    expect(result.terminationReason).toBe("UNKNOWN_ACTION_EFFECT");
    expect(oracleCalls).toBe(0);
    expect(persistence.stepOccurrences[0]?.outcome.actionResult).toBe("UNKNOWN_EFFECT");
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

  it("honours onTimeout CONTINUE on a wait, and still refuses to call it a success", async () => {
    const actedSteps: string[] = [];
    const persistence = new InMemoryExecutionPersistence();
    const executor = new BridgeFlowExecutor({
      persistence,
      mutationAdmission: createInMemoryMutationAdmission(),
      bridge: {
        act: async (step) => {
          actedSteps.push(step.planStepId);
          return { terminalState: "SUCCEEDED", effectVerified: true, evidenceRef: "bridge:act" };
        },
        waitAny: async (): Promise<WaitAnyResult> => ({ status: "TIMEOUT", elapsedMs: 1_000 }),
        cancelWait: async () => ({ status: "CANCELLED" }),
        cancelAction: async () => ({ status: "CANCELLED" }),
      },
      evidence: { factsForOccurrence: () => [] },
      clock: () => 10,
    });

    await executor.execute({
      runId: "run-wait-continue",
      deviceId: "device-1",
      plan: planFixture({
        entryStepId: "wait",
        steps: [
          {
            planStepId: "wait",
            kind: "WAIT_ANY",
            sourceMapRef: "src:wait",
            timeoutMs: 1_000,
            next: "after",
            capabilityRequirements: [],
            evidenceRequirements: [],
            params: {
              legs: [{ legId: "push", factKey: "app.push", onWin: null }],
              maxLegs: 1,
              hostOnlyCancel: true,
              onTimeout: "CONTINUE",
            },
          },
          {
            planStepId: "after",
            kind: "BRIDGE_ACTION",
            sourceMapRef: "src:after",
            timeoutMs: 1_000,
            next: null,
            capabilityRequirements: [],
            evidenceRequirements: [],
            params: { action: "tap" },
          },
        ],
        waitPlans: [
          {
            waitPlanId: "wait-1",
            planStepId: "wait",
            sourceMapRef: "src:wait",
            expected: [{ key: "push", predicate: { selector: { by: "id", value: "push" }, until: "APPEAR" } }],
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

    // The run went on rather than stopping at the optional wait...
    expect(actedSteps).toEqual(["after"]);
    // ...but nothing was observed, so neither axis may read as success.
    expect(persistence.stepOccurrences[0]?.outcome.actionResult).toBe("SKIPPED");
    expect(persistence.stepOccurrences[0]?.outcome.continueGateResult).toBe("SKIPPED");
  });

  it("honours onTimeout CONTINUE on a WAIT_EVENT, the branch fact waits actually take", async () => {
    const actedSteps: string[] = [];
    const persistence = new InMemoryExecutionPersistence();
    let now = 10;
    const executor = new BridgeFlowExecutor({
      persistence,
      mutationAdmission: createInMemoryMutationAdmission(),
      bridge: {
        act: async (step) => {
          actedSteps.push(step.planStepId);
          return { terminalState: "SUCCEEDED", effectVerified: true, evidenceRef: "bridge:act" };
        },
        waitAny: async (): Promise<WaitAnyResult> => ({ status: "EXPECTED_MATCH", key: "push", elapsedMs: 1 }),
        cancelWait: async () => ({ status: "CANCELLED" }),
        cancelAction: async () => ({ status: "CANCELLED" }),
      },
      // No fact ever arrives, so the correlated wait can only time out. If the
      // bridge path were reached instead it would report EXPECTED_MATCH above —
      // which is how this test also proves the fact path was the one taken.
      evidence: { factsForOccurrence: () => [] },
      // The fact wait polls against the clock, so a frozen clock would spin for
      // ever. Advancing it from the injected sleep keeps the test instant.
      clock: () => now,
      sleep: async (ms: number) => {
        now += ms;
      },
    });

    await executor.execute({
      runId: "run-wait-event-continue",
      deviceId: "device-1",
      plan: planFixture({
        entryStepId: "wait",
        steps: [
          {
            planStepId: "wait",
            kind: "WAIT_EVENT",
            sourceMapRef: "src:wait",
            timeoutMs: 50,
            next: "after",
            capabilityRequirements: [],
            evidenceRequirements: [],
            params: {
              factKey: "APP.PUSH_RECEIVED",
              sourceLane: "APP",
              requireCorrelation: true,
              onTimeout: "CONTINUE",
            },
          },
          {
            planStepId: "after",
            kind: "BRIDGE_ACTION",
            sourceMapRef: "src:after",
            timeoutMs: 1_000,
            next: null,
            capabilityRequirements: [],
            evidenceRequirements: [],
            params: { action: "tap" },
          },
        ],
        waitPlans: [
          {
            waitPlanId: "wait-1",
            planStepId: "wait",
            sourceMapRef: "src:wait",
            expected: [{ key: "APP.PUSH_RECEIVED", predicate: { selector: { by: "id", value: "APP.PUSH_RECEIVED" }, until: "APPEAR" } }],
            interrupts: [],
            deadlineMs: 50,
            maxLegs: 1,
            ambiguityPolicy: "FAIL",
            hostOnlyCancel: true,
            capabilityFallbacks: [],
          },
        ],
      }),
    });

    expect(actedSteps).toEqual(["after"]);
    expect(persistence.stepOccurrences[0]?.outcome.actionResult).toBe("SKIPPED");
    expect(persistence.stepOccurrences[0]?.outcome.continueGateResult).toBe("SKIPPED");
  });

  it("still stops the run when a wait times out under the default FAIL policy", async () => {
    const actedSteps: string[] = [];
    const persistence = new InMemoryExecutionPersistence();
    const executor = new BridgeFlowExecutor({
      persistence,
      mutationAdmission: createInMemoryMutationAdmission(),
      bridge: {
        act: async (step) => {
          actedSteps.push(step.planStepId);
          return { terminalState: "SUCCEEDED", effectVerified: true, evidenceRef: "bridge:act" };
        },
        waitAny: async (): Promise<WaitAnyResult> => ({ status: "TIMEOUT", elapsedMs: 1_000 }),
        cancelWait: async () => ({ status: "CANCELLED" }),
        cancelAction: async () => ({ status: "CANCELLED" }),
      },
      evidence: { factsForOccurrence: () => [] },
      clock: () => 10,
    });

    await executor.execute({
      runId: "run-wait-fail",
      deviceId: "device-1",
      plan: planFixture({
        entryStepId: "wait",
        steps: [
          {
            planStepId: "wait",
            kind: "WAIT_ANY",
            sourceMapRef: "src:wait",
            timeoutMs: 1_000,
            next: "after",
            capabilityRequirements: [],
            evidenceRequirements: [],
            params: {
              legs: [{ legId: "ready", factKey: "ui.ready", onWin: null }],
              maxLegs: 1,
              hostOnlyCancel: true,
              onTimeout: "FAIL",
            },
          },
          {
            planStepId: "after",
            kind: "BRIDGE_ACTION",
            sourceMapRef: "src:after",
            timeoutMs: 1_000,
            next: null,
            capabilityRequirements: [],
            evidenceRequirements: [],
            params: { action: "tap" },
          },
        ],
        waitPlans: [
          {
            waitPlanId: "wait-1",
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

    expect(actedSteps).toEqual([]);
    expect(persistence.stepOccurrences[0]?.outcome.actionResult).toBe("FAILED");
    expect(persistence.stepOccurrences[0]?.outcome.continueGateResult).toBe("TIMED_OUT");
  });

  it("takes a WAIT_ANY leg whose fact is already true instead of asking the bridge", async () => {
    // The bridge is asked for a view whose resource id is the FACT KEY, and no
    // such view exists — measured on device with the screen already showing.
    // `open-stop` reached this wait having just satisfied a continue gate on the
    // same facts and then failed waiting to arrive where it already was.
    let bridgeAsked = 0;
    const persistence = new InMemoryExecutionPersistence();
    const executor = new BridgeFlowExecutor({
      persistence,
      mutationAdmission: createInMemoryMutationAdmission(),
      bridge: {
        act: async () => ({ terminalState: "SUCCEEDED", effectVerified: true, evidenceRef: "bridge:act" }),
        waitAny: async (): Promise<WaitAnyResult> => {
          bridgeAsked += 1;
          return { status: "TIMEOUT", elapsedMs: 1 };
        },
        cancelWait: async () => ({ status: "CANCELLED" }),
        cancelAction: async () => ({ status: "CANCELLED" }),
      },
      evidence: {
        factsForOccurrence: () => [
          {
            factKey: "ui.delivery",
            occurrenceId: "run-wait-fact:wait:0",
            iterationKey: "root",
            observedAtMs: 10,
            freshnessMaxAgeMs: 1_000,
            plane: "UI" as const,
            subtype: "screen",
            value: true,
            authority: "PRIMARY" as const,
            deliveryLane: "RECEIPT_SAFE" as const,
          },
        ],
      },
      clock: () => 10,
    });

    await executor.execute({
      runId: "run-wait-fact",
      deviceId: "device-1",
      plan: planFixture({
        entryStepId: "wait",
        steps: [
          {
            planStepId: "wait",
            kind: "WAIT_ANY",
            sourceMapRef: "src:wait",
            timeoutMs: 1_000,
            next: null,
            capabilityRequirements: [],
            evidenceRequirements: [],
            params: {
              // Declared order decides a tie; the first leg's fact is absent, so
              // the second wins and routes through its own branch.
              legs: [
                { legId: "tasks", factKey: "ui.tasks", onWin: null },
                { legId: "delivery", factKey: "ui.delivery", onWin: null },
              ],
              maxLegs: 2,
              hostOnlyCancel: true,
            },
          },
        ],
        waitPlans: [
          {
            waitPlanId: "wait-1",
            planStepId: "wait",
            sourceMapRef: "src:wait",
            expected: [
              { key: "tasks", predicate: { selector: { by: "id", value: "ui.tasks" }, until: "APPEAR" } },
              { key: "delivery", predicate: { selector: { by: "id", value: "ui.delivery" }, until: "APPEAR" } },
            ],
            interrupts: [],
            deadlineMs: 1_000,
            maxLegs: 2,
            ambiguityPolicy: "FAIL",
            hostOnlyCancel: true,
            capabilityFallbacks: [],
          },
        ],
      }),
    });

    expect(bridgeAsked).toBe(0);
    expect(persistence.waitResults[0]?.status).toBe("EXPECTED_MATCH");
    expect(persistence.waitResults[0]?.key).toBe("delivery");
    expect(persistence.stepOccurrences[0]?.outcome.actionResult).toBe("SUCCEEDED");
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
  it("lets an EVENTUAL Final Oracle decide a fact the assert has not seen yet", async () => {
    // Measured on device: tour approval reached its assert a moment before the
    // derived conclusion landed, the assert declared the run
    // evidence-insufficient and stopped it, and the Final Oracle on that very
    // step then evaluated SATISFIED with every requirement met. The run reported
    // INCONCLUSIVE over an oracle that had said yes.
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
      // The fact simply is not there yet.
      evidence: { factsForOccurrence: () => [] },
      oracle: {
        runContinueGate: async () => ({
          status: "SATISFIED",
          evaluation: { outcome: "SATISFIED", completedAtMs: 1_000, evidenceRefs: [], reason: "n/a" },
        }),
        runFinalOracle: async () => ({
          status: "SATISFIED",
          evaluation: {
            outcome: "SATISFIED",
            productVerdict: "PASS_ONLINE",
            evaluationFailureClass: "NONE",
            requirementsByFact: {},
            evidenceRefs: [],
          },
        }),
      },
      clock: () => 1_000,
    });

    const result = await executor.execute({
      runId: "run-assert-defers",
      deviceId: "device-1",
      plan: planFixture({
        entryStepId: "assert",
        steps: [
          {
            planStepId: "assert",
            kind: "ASSERT_FACT",
            sourceMapRef: "src:assert",
            timeoutMs: 1_000,
            next: null,
            capabilityRequirements: [],
            evidenceRequirements: [],
            params: { factKey: "remote.confirmed", expected: true, unknownPolicy: "INCONCLUSIVE" },
            finalOraclePolicy: {
              requirements: [
                {
                  factKey: "remote.confirmed",
                  obligation: "REQUIRED",
                  timing: "EVENTUAL",
                  deadlineMs: 180_000,
                  onTimeout: "INCONCLUSIVE",
                },
              ],
            },
          },
        ],
      }),
    });

    // The oracle had the last word, and the assert did not claim success either.
    expect(result.productVerdict).toBe("PASS_ONLINE");
    expect(persistence.stepOccurrences[0]?.outcome.actionResult).toBe("SKIPPED");
  });
});
