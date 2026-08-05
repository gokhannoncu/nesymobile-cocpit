import type { WaitAnyResult } from "@nesy/bridge-contract";
import type { BridgeFlowPlan, BridgeFlowPlanStep } from "@nesy/bridgeflow-compiler";
import { describe, expect, it, vi } from "vitest";

import {
  BridgeFlowExecutor,
  InMemoryExecutionPersistence,
  createInMemoryMutationAdmission,
  createInMemoryVariables,
  type BridgeFlowExecutorOptions,
  type RecoveryResumeState,
} from "./index.js";

function step(
  planStepId: string,
  kind: BridgeFlowPlanStep["kind"],
  next: string | null,
  params: Record<string, unknown> = {},
): BridgeFlowPlanStep {
  return {
    planStepId,
    kind,
    sourceMapRef: `src:${planStepId}`,
    timeoutMs: 1_000,
    next,
    capabilityRequirements: [],
    evidenceRequirements: [],
    params,
  };
}

function planFixture(steps: BridgeFlowPlanStep[], entryStepId = steps[0]?.planStepId ?? "missing"): BridgeFlowPlan {
  return {
    schemaVersion: 1,
    planId: "task-3-plan",
    hash: { algorithm: "sha256", digest: "sha256:task-3-plan" },
    provenance: {
      compiledAt: "2026-08-05T16:00:00.000Z",
      compilerVersion: "phase-5",
      packKey: "nesy-courier",
      packVersion: "1.0.0",
      packDigest: "sha256:pack",
      workflowRef: "workflow/task-3",
      workflowVersion: 1,
      irHash: "sha256:ir",
      derivedGraphDigest: "sha256:graph",
    },
    packVersion: "1.0.0",
    packDigest: "sha256:pack",
    workflowRef: "workflow/task-3",
    workflowVersion: 1,
    appCompatibilityRefs: [],
    adapterCompatibilityRefs: [],
    entryStepId,
    steps,
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
  };
}

function options(
  overrides: Partial<BridgeFlowExecutorOptions> = {},
): BridgeFlowExecutorOptions {
  return {
    persistence: new InMemoryExecutionPersistence(),
    mutationAdmission: createInMemoryMutationAdmission(),
    bridge: {
      act: async () => ({
        terminalState: "SUCCEEDED",
        effectVerified: true,
        evidenceRef: "bridge:effect",
      }),
      waitAny: async (): Promise<WaitAnyResult> => ({
        status: "EXPECTED_MATCH",
        key: "ready",
        elapsedMs: 1,
      }),
      cancelWait: async () => ({ status: "CANCELLED" }),
      cancelAction: async () => ({ status: "CANCELLED" }),
    },
    evidence: { factsForOccurrence: () => [] },
    clock: () => 100,
    ...overrides,
  };
}

describe("Task 3 executor recovery and cancellation", () => {
  it("atomically keeps one wait terminal winner across simultaneous match, timeout, and cancel", async () => {
    const persistence = new InMemoryExecutionPersistence();
    const base = {
      runId: "run-race",
      occurrenceId: "run-race:wait:0",
      waitPlanId: "wait-plan",
      requestId: "request-1",
    };

    const [matched, timedOut, cancelled] = await Promise.all([
      persistence.settleWaitTerminal({
        ...base,
        status: "EXPECTED_MATCH",
        key: "ready",
      }),
      persistence.settleWaitTerminal({ ...base, status: "TIMEOUT" }),
      persistence.settleWaitTerminal({ ...base, status: "CANCELLED" }),
    ]);

    expect([matched, timedOut, cancelled].filter((result) => result.won)).toHaveLength(1);
    expect(persistence.waitResults).toHaveLength(1);
    expect(matched.result).toEqual(timedOut.result);
    expect(timedOut.result).toEqual(cancelled.result);
  });

  it("run abort cancels both the in-flight wait and physical action", async () => {
    const controller = new AbortController();
    const cancelWait = vi.fn(async () => ({ status: "CANCELLED" }));
    const cancelAction = vi.fn(async () => ({ status: "CANCELLED" }));
    const never = new Promise<never>(() => undefined);
    let announceActionStarted: (() => void) | undefined;
    const actionStarted = new Promise<void>((resolve) => {
      announceActionStarted = resolve;
    });
    const executor = new BridgeFlowExecutor(options({
      bridge: {
        act: async () => {
          announceActionStarted?.();
          return never;
        },
        waitAny: async () => never,
        cancelWait,
        cancelAction,
      },
    }));

    const actionRun = executor.execute({
      runId: "run-abort-action",
      deviceId: "device-1",
      plan: planFixture([step("action", "BRIDGE_ACTION", null, { action: "tap" })]),
      signal: controller.signal,
    });
    await actionStarted;
    controller.abort("operator abort");

    await expect(actionRun).resolves.toMatchObject({ terminationReason: "ABORTED" });
    expect(cancelAction).toHaveBeenCalledWith(
      "run-abort-action:action:0:attempt-1",
      expect.objectContaining({ occurrenceId: "run-abort-action:action:0" }),
    );

    const waitController = new AbortController();
    const waitRun = new BridgeFlowExecutor(options({
      bridge: {
        act: async () => never,
        waitAny: async () => never,
        cancelWait,
        cancelAction,
      },
    })).execute({
      runId: "run-abort-wait",
      deviceId: "device-1",
      plan: {
        ...planFixture([step("wait", "WAIT_ANY", null, { legs: [] })]),
        waitPlans: [{
          waitPlanId: "wait-plan",
          planStepId: "wait",
          sourceMapRef: "src:wait",
          expected: [],
          interrupts: [],
          deadlineMs: 1_000,
          maxLegs: 1,
          ambiguityPolicy: "FAIL",
          hostOnlyCancel: true,
          capabilityFallbacks: [],
        }],
      },
      signal: waitController.signal,
    });
    waitController.abort("operator abort");

    await expect(waitRun).resolves.toMatchObject({ terminationReason: "ABORTED" });
    expect(cancelWait).toHaveBeenCalledWith(
      expect.objectContaining({ occurrenceId: "run-abort-wait:wait:0" }),
    );
  });

  it("run cleanup never cancels another run's in-flight action", async () => {
    const controller = new AbortController();
    let announceStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      announceStarted = resolve;
    });
    const cancelAction = vi.fn(async () => ({ status: "CANCELLED" }));
    const executor = new BridgeFlowExecutor(options({
      bridge: {
        ...options().bridge,
        act: async () => {
          announceStarted?.();
          return new Promise<never>(() => undefined);
        },
        cancelAction,
      },
    }));
    const slow = executor.execute({
      runId: "run-slow",
      deviceId: "device-1",
      plan: planFixture([step("action", "BRIDGE_ACTION", null)]),
      signal: controller.signal,
    });
    await started;

    await executor.execute({
      runId: "run-fast",
      deviceId: "device-2",
      plan: planFixture([step("noop", "NOOP", null)]),
    });

    expect(cancelAction).not.toHaveBeenCalled();
    controller.abort();
    await slow;
  });

  it("pins one step start time for asynchronous Continue Gate and Final Oracle", async () => {
    const startedAt: number[] = [];
    let now = 1_000;
    const base = step("oracle", "NOOP", null);
    const executor = new BridgeFlowExecutor(options({
      clock: () => now++,
      oracle: {
        runContinueGate: async (work) => {
          startedAt.push(work.startedAtMs);
          return {
            status: "SATISFIED",
            evaluation: {
              outcome: "SATISFIED",
              completedAtMs: work.startedAtMs + 1,
              evidenceRefs: [],
              reason: "ready",
            },
          };
        },
        runFinalOracle: async (work) => {
          startedAt.push(work.startedAtMs);
          return {
            status: "SATISFIED",
            evaluation: {
              outcome: "SATISFIED",
              productVerdict: "PASS_ONLINE",
              evaluationFailureClass: "NONE",
              requirementsByFact: {},
              evidenceRefs: [],
            },
          };
        },
      },
    }));

    await executor.execute({
      runId: "run-pinned",
      deviceId: "device-1",
      plan: planFixture([{
        ...base,
        continueGate: { allOf: [], deadlineMs: 100 },
        finalOraclePolicy: { requirements: [] },
      }]),
    });

    expect(startedAt).toHaveLength(2);
    expect(new Set(startedAt)).toEqual(new Set([startedAt[0]]));
  });

  it("resumes after occurrence 5 at occurrence 6", async () => {
    const seen: number[] = [];
    const resume: RecoveryResumeState = {
      nextStepId: "repeat",
      runtimeIterationKey: "root",
      occurrenceCounts: { repeat: 6 },
      forEachNextIndexes: {},
      completedOccurrenceIds: [],
      completedIterationKeys: [],
    };
    const executor = new BridgeFlowExecutor(options({
      bridge: {
        ...options().bridge,
        act: async (_step, context) => {
          seen.push(context.occurrenceIndex);
          return {
            terminalState: "SUCCEEDED",
            effectVerified: true,
            evidenceRef: "bridge:effect",
          };
        },
      },
    }));

    await executor.execute({
      runId: "run-repeat",
      deviceId: "device-1",
      plan: planFixture([step("repeat", "BRIDGE_ACTION", null)]),
      recovery: resume,
    });

    expect(seen).toEqual([6]);
  });

  it("does not re-execute a completed occurrence from a stale cursor", async () => {
    const acted: string[] = [];
    const executor = new BridgeFlowExecutor(options({
      bridge: {
        ...options().bridge,
        act: async (current) => {
          acted.push(current.planStepId);
          return {
            terminalState: "SUCCEEDED",
            effectVerified: true,
            evidenceRef: "bridge:effect",
          };
        },
      },
    }));

    await executor.execute({
      runId: "run-skip",
      deviceId: "device-1",
      plan: planFixture([
        step("already-done", "BRIDGE_ACTION", "next"),
        step("next", "BRIDGE_ACTION", null),
      ]),
      recovery: {
        nextStepId: "already-done",
        runtimeIterationKey: "root",
        occurrenceCounts: {},
        forEachNextIndexes: {},
        completedOccurrenceIds: ["run-skip:already-done:0"],
        completedIterationKeys: [],
      },
    });

    expect(acted).toEqual(["next"]);
  });

  it("restores nested for-each continuation from a production checkpoint", async () => {
    const persistence = new InMemoryExecutionPersistence();
    const acted: string[] = [];
    let crash = true;
    const executorOptions = () => options({
      persistence,
      variables: createInMemoryVariables({
        outerItems: ["o0", "o1"],
        innerItems: ["i0", "i1"],
      }),
      bridge: {
        ...options().bridge,
        act: async (_current, context) => {
          acted.push(context.iterationKey);
          return {
            terminalState: "SUCCEEDED",
            effectVerified: true,
            evidenceRef: "bridge:effect",
          };
        },
      },
      genericSteps: {
        execute: async () => {
          if (crash) {
            crash = false;
            throw new Error("simulated process crash");
          }
          return { succeeded: true };
        },
      },
    });
    const plan = planFixture([
      step("outer", "FOR_EACH", "done", {
        itemsVariable: "outerItems",
        maxIterations: 2,
        itemVariable: "outerItem",
        indexVariable: "outerIndex",
        body: "inner",
        emptyPolicy: "FAIL",
      }),
      step("inner", "FOR_EACH", "outer-tail", {
        itemsVariable: "innerItems",
        maxIterations: 2,
        itemVariable: "innerItem",
        indexVariable: "innerIndex",
        body: "action",
        emptyPolicy: "FAIL",
      }),
      step("action", "BRIDGE_ACTION", "crash"),
      step("crash", "SDK_QUERY", "outer-tail"),
      step("outer-tail", "NOOP", "done"),
      step("done", "NOOP", null),
    ], "outer");

    await expect(new BridgeFlowExecutor(executorOptions()).execute({
      runId: "run-nested",
      deviceId: "device-1",
      plan,
    })).rejects.toThrow("simulated process crash");
    const recovery = persistence.recoveryCheckpoints.at(-1);
    expect(recovery).toBeDefined();

    await new BridgeFlowExecutor(executorOptions()).execute({
      runId: "run-nested",
      deviceId: "device-1",
      plan,
      recovery,
    });

    expect(acted).toEqual([
      "outer[0]/inner[0]",
      "outer[0]/inner[1]",
      "outer[1]/inner[0]",
      "outer[1]/inner[1]",
    ]);
  });

  it("preserves accumulated Oracle verdict when recovery has no next step", async () => {
    const persistence = new InMemoryExecutionPersistence();
    let crash = true;
    const plan = planFixture([
      {
        ...step("oracle", "NOOP", "crash"),
        finalOraclePolicy: { requirements: [] },
      },
      step("crash", "SDK_QUERY", null),
    ], "oracle");
    const makeOptions = () => options({
      persistence,
      oracle: {
        runContinueGate: async () => {
          throw new Error("unused");
        },
        runFinalOracle: async () => ({
          status: "SATISFIED",
          evaluation: {
            outcome: "SATISFIED",
            productVerdict: "PASS_ONLINE",
            evaluationFailureClass: "NONE",
            requirementsByFact: {},
            evidenceRefs: ["oracle:pass"],
          },
        }),
      },
      genericSteps: {
        execute: async () => {
          if (crash) {
            crash = false;
            throw new Error("simulated process crash");
          }
          return { succeeded: true };
        },
      },
    });

    await expect(new BridgeFlowExecutor(makeOptions()).execute({
      runId: "run-verdict-recovery",
      deviceId: "device-1",
      plan,
    })).rejects.toThrow("simulated process crash");
    const recovery = persistence.recoveryCheckpoints.at(-1);
    expect(recovery).toBeDefined();

    const result = await new BridgeFlowExecutor(makeOptions()).execute({
      runId: "run-verdict-recovery",
      deviceId: "device-1",
      plan,
      recovery,
    });

    expect(result.productVerdict).toBe("PASS_ONLINE");
  });

  it("holds action ownership for abort until cancellation is confirmed", async () => {
    const controller = new AbortController();
    let resolveAction: ((result: {
      terminalState: "SUCCEEDED";
      effectVerified: true;
      evidenceRef: string;
    }) => void) | undefined;
    let resolveCancel: ((result: { status: "TOO_LATE" }) => void) | undefined;
    const action = new Promise<{
      terminalState: "SUCCEEDED";
      effectVerified: true;
      evidenceRef: string;
    }>((resolve) => {
      resolveAction = resolve;
    });
    const cancellation = new Promise<{ status: "TOO_LATE" }>((resolve) => {
      resolveCancel = resolve;
    });
    let announceStarted: (() => void) | undefined;
    const started = new Promise<void>((resolve) => {
      announceStarted = resolve;
    });
    const persistence = new InMemoryExecutionPersistence();
    const run = new BridgeFlowExecutor(options({
      persistence,
      bridge: {
        ...options().bridge,
        act: async () => {
          announceStarted?.();
          return action;
        },
        cancelAction: async () => cancellation,
      },
    })).execute({
      runId: "run-action-owner",
      deviceId: "device-1",
      plan: planFixture([step("action", "BRIDGE_ACTION", null)]),
      signal: controller.signal,
    });
    await started;
    controller.abort();
    resolveAction?.({
      terminalState: "SUCCEEDED",
      effectVerified: true,
      evidenceRef: "bridge:late-success",
    });
    let settled = false;
    void run.then(() => {
      settled = true;
    });
    await Promise.resolve();
    expect(settled).toBe(false);
    resolveCancel?.({ status: "TOO_LATE" });

    await expect(run).resolves.toMatchObject({
      terminationReason: "UNKNOWN_ACTION_EFFECT",
    });
  });

  it("removes action and wait abort listeners after terminal settlement", async () => {
    const controller = new AbortController();
    const cancelAction = vi.fn(async () => ({ status: "CANCELLED" }));
    const cancelWait = vi.fn(async () => ({ status: "CANCELLED" }));
    const persistence = new InMemoryExecutionPersistence();
    const settle = vi.spyOn(persistence, "settleWaitTerminal");
    const executor = new BridgeFlowExecutor(options({
      persistence,
      bridge: {
        act: async () => ({
          terminalState: "SUCCEEDED",
          effectVerified: true,
          evidenceRef: "bridge:done",
        }),
        waitAny: async () => ({
          status: "EXPECTED_MATCH",
          key: "ready",
          elapsedMs: 1,
        }),
        cancelAction,
        cancelWait,
      },
    }));
    const wait = step("wait", "WAIT_ANY", "action", {
      legs: [{ legId: "ready", factKey: "ui.ready", onWin: "action" }],
    });
    await executor.execute({
      runId: "run-listener-cleanup",
      deviceId: "device-1",
      signal: controller.signal,
      plan: {
        ...planFixture([wait, step("action", "BRIDGE_ACTION", null)], "wait"),
        waitPlans: [{
          waitPlanId: "wait-plan",
          planStepId: "wait",
          sourceMapRef: "src:wait",
          expected: [{
            key: "ready",
            predicate: { selector: { by: "id", value: "ready" }, until: "APPEAR" },
          }],
          interrupts: [],
          deadlineMs: 1_000,
          maxLegs: 1,
          ambiguityPolicy: "FAIL",
          hostOnlyCancel: true,
          capabilityFallbacks: [],
        }],
      },
    });
    const settleCalls = settle.mock.calls.length;
    const cancelActionCalls = cancelAction.mock.calls.length;
    const cancelWaitCalls = cancelWait.mock.calls.length;

    controller.abort();
    await Promise.resolve();
    await Promise.resolve();

    expect(settle).toHaveBeenCalledTimes(settleCalls);
    expect(cancelAction).toHaveBeenCalledTimes(cancelActionCalls);
    expect(cancelWait).toHaveBeenCalledTimes(cancelWaitCalls);
  });

  it("restores terminal stopped state and finalizes without executing nextStepId", async () => {
    const firstPersistence = new InMemoryExecutionPersistence();
    firstPersistence.persistRunResult = () => {
      throw new Error("simulated crash before durable finalization");
    };
    const nextStep = vi.fn(async () => ({ succeeded: true }));
    const plan = planFixture([
      {
        ...step("oracle", "NOOP", "must-not-run"),
        finalOraclePolicy: { requirements: [] },
      },
      step("must-not-run", "SDK_QUERY", null),
    ], "oracle");
    const oracle = {
      runContinueGate: async () => {
        throw new Error("unused");
      },
      runFinalOracle: async () => ({
        status: "VIOLATED" as const,
        evaluation: {
          outcome: "VIOLATED" as const,
          productVerdict: "FAIL_PRODUCT" as const,
          evaluationFailureClass: "NONE" as const,
          requirementsByFact: {},
          evidenceRefs: ["oracle:fail"],
        },
      }),
    };

    await expect(new BridgeFlowExecutor(options({
      persistence: firstPersistence,
      oracle,
      genericSteps: { execute: nextStep },
    })).execute({
      runId: "run-terminal-stop",
      deviceId: "device-1",
      plan,
    })).rejects.toThrow("simulated crash");
    const recovery = firstPersistence.recoveryCheckpoints.at(-1);
    expect(recovery).toMatchObject({
      nextStepId: "must-not-run",
      outcomeState: {
        stopped: true,
        productVerdicts: ["FAIL_PRODUCT"],
      },
    });

    const result = await new BridgeFlowExecutor(options({
      oracle,
      genericSteps: { execute: nextStep },
    })).execute({
      runId: "run-terminal-stop",
      deviceId: "device-1",
      plan,
      recovery,
    });

    expect(nextStep).not.toHaveBeenCalled();
    expect(result.productVerdict).toBe("FAIL_PRODUCT");
  });

  it("fences malformed recovered-plan failure before validation closes the run", async () => {
    const persistence = new InMemoryExecutionPersistence();
    const persistRunResult = vi.spyOn(persistence, "persistRunResult");
    const duplicate = step("duplicate", "NOOP", null);

    await new BridgeFlowExecutor(options({ persistence })).execute({
      runId: "run-malformed-recovery",
      deviceId: "device-1",
      plan: planFixture([duplicate, { ...duplicate }]),
      recovery: {
        revision: 4,
        nextStepId: "duplicate",
        runtimeIterationKey: "root",
        occurrenceCounts: {},
        completedOccurrenceIds: [],
        completedIterationKeys: [],
        continuationStack: [],
        recoveryFence: { token: "successor-token", epoch: 8 },
        outcomeState: {
          stopped: false,
          unknownEffect: false,
          automationFailure: false,
          evidenceInsufficient: false,
          productVerdicts: [],
          cleanupResult: "SUCCEEDED",
          resourceReleaseResult: "RELEASED",
          schedulerDisposition: "RELEASED",
          operationalDisposition: "OK",
        },
      },
    });

    expect(persistRunResult).toHaveBeenCalledWith(expect.objectContaining({
      recoveryFence: { token: "successor-token", epoch: 8 },
    }));
  });

  it("checkpoints stopped state when mutation admission terminates before a step", async () => {
    const persistence = new InMemoryExecutionPersistence();
    persistence.persistRunResult = () => {
      throw new Error("simulated finalization crash");
    };
    const act = vi.fn(options().bridge.act);
    const executor = new BridgeFlowExecutor(options({
      persistence,
      mutationAdmission: {
        acquire: async () => false,
        release: async () => undefined,
      },
      bridge: { ...options().bridge, act },
    }));

    await expect(executor.execute({
      runId: "run-admission-stop",
      deviceId: "device-1",
      plan: planFixture([step("action", "BRIDGE_ACTION", null)]),
    })).rejects.toThrow("simulated finalization crash");

    expect(act).not.toHaveBeenCalled();
    expect(persistence.recoveryCheckpoints.at(-1)).toMatchObject({
      nextStepId: "action",
      outcomeState: {
        stopped: true,
        automationFailure: true,
      },
    });
  });

  it("acquires and attaches a fence to every fresh execution write", async () => {
    const persistence = new InMemoryExecutionPersistence();

    await new BridgeFlowExecutor(options({ persistence })).execute({
      runId: "run-fresh-fence",
      deviceId: "device-1",
      plan: planFixture([step("noop", "NOOP", null)]),
    });

    const fence = persistence.currentExecutionFence("run-fresh-fence");
    expect(fence).toEqual(expect.objectContaining({
      token: expect.any(String),
      epoch: 1,
    }));
    expect(persistence.stepOccurrences[0]?.recoveryFence).toEqual(fence);
    expect(persistence.recoveryCheckpoints.at(-1)?.recoveryFence).toEqual(fence);
    expect(persistence.runResultRecords.at(-1)?.recoveryFence).toEqual(fence);
  });

  it("fails closed when fresh run-start persistence returns no fence", async () => {
    const persistence = new InMemoryExecutionPersistence();
    persistence.persistRunStart = () => undefined as never;
    const act = vi.fn(options().bridge.act);

    await expect(new BridgeFlowExecutor(options({
      persistence,
      bridge: { ...options().bridge, act },
    })).execute({
      runId: "run-missing-fence",
      deviceId: "device-1",
      plan: planFixture([step("action", "BRIDGE_ACTION", null)]),
    })).rejects.toThrow(/execution fence|required/i);
    expect(act).not.toHaveBeenCalled();
  });

  it("blocks stale original action dispatch after recovery rotates its fence", async () => {
    const persistence = new InMemoryExecutionPersistence();
    const originalCheckpoint =
      persistence.persistRecoveryCheckpoint.bind(persistence);
    let rotated = false;
    persistence.persistRecoveryCheckpoint = (checkpoint) => {
      originalCheckpoint(checkpoint);
      if (!rotated) {
        rotated = true;
        persistence.rotateExecutionFence(checkpoint.runId);
      }
    };
    const act = vi.fn(options().bridge.act);

    await expect(new BridgeFlowExecutor(options({
      persistence,
      bridge: { ...options().bridge, act },
    })).execute({
      runId: "run-stale-action",
      deviceId: "device-1",
      plan: planFixture([step("action", "BRIDGE_ACTION", null)]),
    })).rejects.toThrow(/fence/i);
    expect(act).not.toHaveBeenCalled();
  });

  it.each([
    { kind: "WAIT_ANY" as const, runId: "run-stale-wait" },
    { kind: "REMOTE_ACTION" as const, runId: "run-stale-remote" },
  ])("blocks stale original $kind dispatch after fence rotation", async ({ kind, runId }) => {
    const persistence = new InMemoryExecutionPersistence();
    const originalCheckpoint =
      persistence.persistRecoveryCheckpoint.bind(persistence);
    let rotated = false;
    persistence.persistRecoveryCheckpoint = (checkpoint) => {
      originalCheckpoint(checkpoint);
      if (!rotated) {
        rotated = true;
        persistence.rotateExecutionFence(checkpoint.runId);
      }
    };
    const waitAny = vi.fn(options().bridge.waitAny);
    const remoteExecute = vi.fn(async () => ({ succeeded: true }));
    const current = step(
      "physical",
      kind,
      null,
      kind === "WAIT_ANY"
        ? { legs: [{ legId: "ready", factKey: "ui.ready", onWin: null }] }
        : {},
    );
    const plan = {
      ...planFixture([current]),
      waitPlans: kind === "WAIT_ANY"
        ? [{
            waitPlanId: "wait-physical",
            planStepId: "physical",
            sourceMapRef: "src:physical",
            expected: [{
              key: "ready",
              predicate: {
                selector: { by: "id" as const, value: "ready" },
                until: "APPEAR" as const,
              },
            }],
            interrupts: [],
            deadlineMs: 1_000,
            maxLegs: 1,
            ambiguityPolicy: "FAIL" as const,
            hostOnlyCancel: true,
            capabilityFallbacks: [],
          }]
        : [],
    };

    await expect(new BridgeFlowExecutor(options({
      persistence,
      bridge: { ...options().bridge, waitAny },
      remoteRuntime: { execute: remoteExecute },
    })).execute({
      runId,
      deviceId: "device-1",
      plan,
    })).rejects.toThrow(/fence/i);
    expect(waitAny).not.toHaveBeenCalled();
    expect(remoteExecute).not.toHaveBeenCalled();
  });
});
