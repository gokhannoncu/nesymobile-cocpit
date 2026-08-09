import { describe, expect, it } from "vitest";
import {
  detectDerivedFactCycles,
  evaluateContinueGate,
  evaluateFinalOracle,
  normalizeEvidence,
  replayDerivedFacts,
} from "./index.js";

const baseFact = {
  occurrenceId: "occ-1",
  iterationKey: "iteration-1",
  observedAtMs: 100,
  freshnessMaxAgeMs: 1_000,
  authority: "PRIMARY" as const,
};

describe("oracle engine v2", () => {
  it("satisfies Continue Gate from receipt-safe facts without waiting for the deadline", () => {
    const result = evaluateContinueGate({
      policy: {
        allOf: ["ui.ready"],
        deadlineMs: 5_000,
        unknownPolicy: "RETRY",
      },
      facts: [
        {
          ...baseFact,
          factKey: "ui.ready",
          plane: "UI",
          subtype: "screen",
          value: true,
          deliveryLane: "RECEIPT_SAFE",
        },
      ],
      occurrenceId: "occ-1",
      iterationKey: "iteration-1",
      nowMs: 120,
      startedAtMs: 100,
    });

    expect(result.outcome).toBe("SATISFIED");
    expect(result.completedAtMs).toBe(120);
    expect(result.evidenceRefs).toEqual(["ui.ready"]);
  });

  it("does not satisfy Continue Gate from ordered-only evidence", () => {
    const result = evaluateContinueGate({
      policy: {
        allOf: ["remote.confirmed"],
        deadlineMs: 5_000,
        unknownPolicy: "RETRY",
      },
      facts: [
        {
          ...baseFact,
          factKey: "remote.confirmed",
          plane: "REMOTE",
          subtype: "adapter",
          value: true,
          deliveryLane: "ORDERED_REQUIRED",
        },
      ],
      occurrenceId: "occ-1",
      iterationKey: "iteration-1",
      nowMs: 120,
      startedAtMs: 100,
    });

    expect(result.outcome).toBe("UNKNOWN");
    expect(result.evidenceRefs).toEqual([]);
  });

  it("enforces Continue Gate stability and refuses conflicting receipt-safe facts", () => {
    const input = {
      policy: {
        allOf: ["ui.ready"],
        deadlineMs: 5_000,
        stableForMs: 100,
        unknownPolicy: "RETRY" as const,
      },
      occurrenceId: "occ-1",
      iterationKey: "iteration-1",
      startedAtMs: 100,
    };
    const fact = {
      ...baseFact,
      factKey: "ui.ready",
      plane: "UI" as const,
      subtype: "screen",
      value: true as const,
      deliveryLane: "RECEIPT_SAFE" as const,
      observedAtMs: 150,
    };

    expect(evaluateContinueGate({ ...input, facts: [fact], nowMs: 200 }).outcome).toBe("UNKNOWN");
    expect(
      evaluateContinueGate({
        ...input,
        facts: [fact, { ...fact, value: false }],
        nowMs: 300,
      }).outcome,
    ).toBe("UNKNOWN");
  });

  it("does not turn UI-only success into a business pass when required APP or REMOTE facts are missing", () => {
    const result = evaluateFinalOracle({
      policy: {
        requirements: [
          { factKey: "ui.ready", obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "FAIL" },
          { factKey: "app.state.persisted", obligation: "REQUIRED", timing: "EVENTUAL", deadlineMs: 500, onTimeout: "INCONCLUSIVE" },
          { factKey: "remote.confirmed", obligation: "REQUIRED", timing: "EVENTUAL", deadlineMs: 500, onTimeout: "INCONCLUSIVE" },
        ],
      },
      facts: [
        {
          ...baseFact,
          factKey: "ui.ready",
          plane: "UI",
          subtype: "screen",
          value: true,
          deliveryLane: "ORDERED_REQUIRED",
        },
      ],
      occurrenceId: "occ-1",
      iterationKey: "iteration-1",
      nowMs: 700,
      startedAtMs: 100,
    });

    expect(result.productVerdict).toBe("INCONCLUSIVE");
    expect(result.evaluationFailureClass).toBe("EVIDENCE_INSUFFICIENT");
    expect(result.requirementsByFact["app.state.persisted"]?.state).toBe("REQUIRED_TIMEOUT");
  });

  it("rejects stale, wrong-occurrence and conflicting facts before producing PASS", () => {
    const result = evaluateFinalOracle({
      policy: {
        requirements: [
          { factKey: "remote.confirmed", obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "FAIL" },
        ],
      },
      facts: [
        {
          ...baseFact,
          factKey: "remote.confirmed",
          plane: "REMOTE",
          subtype: "adapter",
          value: true,
          deliveryLane: "ORDERED_REQUIRED",
          observedAtMs: 0,
          freshnessMaxAgeMs: 10,
        },
        {
          ...baseFact,
          factKey: "remote.confirmed",
          plane: "REMOTE",
          subtype: "adapter",
          value: true,
          deliveryLane: "ORDERED_REQUIRED",
          occurrenceId: "other-occurrence",
        },
        {
          ...baseFact,
          factKey: "remote.confirmed",
          plane: "REMOTE",
          subtype: "adapter",
          value: false,
          deliveryLane: "ORDERED_REQUIRED",
        },
        {
          ...baseFact,
          factKey: "remote.confirmed",
          plane: "REMOTE",
          subtype: "adapter",
          value: true,
          deliveryLane: "ORDERED_REQUIRED",
        },
      ],
      occurrenceId: "occ-1",
      iterationKey: "iteration-1",
      nowMs: 100,
      startedAtMs: 90,
    });

    expect(result.productVerdict).toBe("INCONCLUSIVE");
    expect(result.evaluationFailureClass).toBe("EVIDENCE_INSUFFICIENT");
    expect(result.requirementsByFact["remote.confirmed"]?.state).toBe("EVIDENCE_CONFLICT");
  });

  it("does not let confirmatory or fallback evidence independently create Final Oracle PASS", () => {
    for (const authority of ["CONFIRMATORY", "FALLBACK"] as const) {
      const result = evaluateFinalOracle({
        policy: {
          requirements: [
            {
              factKey: "delivery.persisted",
              obligation: "REQUIRED",
              timing: "IMMEDIATE",
              onTimeout: "FAIL",
            },
          ],
        },
        facts: [
          {
            ...baseFact,
            factKey: "delivery.persisted",
            plane: "APP",
            subtype: "sdk",
            value: true,
            authority,
            deliveryLane: "ORDERED_REQUIRED",
          },
        ],
        occurrenceId: "occ-1",
        iterationKey: "iteration-1",
        nowMs: 120,
        startedAtMs: 100,
      });

      expect(result.productVerdict).not.toMatch(/^PASS_/);
      expect(result.requirementsByFact["delivery.persisted"]?.state).toBe("REQUIRED_TIMEOUT");
    }
  });

  it("does not let receipt-safe evidence satisfy Final Oracle directly", () => {
    const result = evaluateFinalOracle({
      policy: {
        requirements: [
          {
            factKey: "delivery.persisted",
            obligation: "REQUIRED",
            timing: "IMMEDIATE",
            onTimeout: "FAIL",
          },
        ],
      },
      facts: [
        {
          ...baseFact,
          factKey: "delivery.persisted",
          plane: "APP",
          subtype: "sdk",
          value: true,
          authority: "PRIMARY",
          deliveryLane: "RECEIPT_SAFE",
        },
      ],
      occurrenceId: "occ-1",
      iterationKey: "iteration-1",
      nowMs: 120,
      startedAtMs: 100,
    });

    expect(result.productVerdict).toBe("FAIL_PRODUCT");
    expect(result.requirementsByFact["delivery.persisted"]?.state).toBe("REQUIRED_TIMEOUT");
  });

  it("applies each eventual requirement's own evidence deadline", () => {
    const policy = {
      requirements: [
        {
          factKey: "early.fact",
          obligation: "REQUIRED" as const,
          timing: "EVENTUAL" as const,
          deadlineMs: 10,
          onTimeout: "FAIL" as const,
        },
        {
          factKey: "late.fact",
          obligation: "REQUIRED" as const,
          timing: "EVENTUAL" as const,
          deadlineMs: 100,
          onTimeout: "INCONCLUSIVE" as const,
        },
      ],
    };
    const makeFact = (factKey: string, observedAtMs: number) => ({
      ...baseFact,
      factKey,
      observedAtMs,
      plane: "APP" as const,
      subtype: "sdk",
      value: true as const,
      deliveryLane: "ORDERED_REQUIRED" as const,
    });

    const lateEarlyFact = evaluateFinalOracle({
      policy,
      facts: [makeFact("early.fact", 110), makeFact("late.fact", 150)],
      occurrenceId: "occ-1",
      iterationKey: "iteration-1",
      nowMs: 160,
      startedAtMs: 100,
    });
    expect(lateEarlyFact.productVerdict).toBe("FAIL_PRODUCT");
    expect(lateEarlyFact.requirementsByFact["early.fact"]?.state).toBe("REQUIRED_TIMEOUT");

    const validEarlyFact = evaluateFinalOracle({
      policy,
      facts: [makeFact("early.fact", 109), makeFact("late.fact", 150)],
      occurrenceId: "occ-1",
      iterationKey: "iteration-1",
      nowMs: 160,
      startedAtMs: 100,
    });
    expect(validEarlyFact.productVerdict).toBe("PASS_ONLINE");
  });

  it("keeps HTTP transport success as raw audit evidence, not business truth", () => {
    const facts = normalizeEvidence([
      {
        rawEventId: "event-1",
        occurrenceId: "occ-1",
        iterationKey: "iteration-1",
        observedAtMs: 100,
        source: "REMOTE",
        subtype: "http",
        factKey: "remote.http.2xx",
        value: true,
        authority: "CONFIRMATORY",
        deliveryLane: "ORDERED_REQUIRED",
        reducerTrace: ["transport-status"],
      },
    ]);

    const result = evaluateFinalOracle({
      policy: {
        requirements: [
          { factKey: "remote.business.confirmed", obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "FAIL" },
        ],
      },
      facts,
      occurrenceId: "occ-1",
      iterationKey: "iteration-1",
      nowMs: 120,
      startedAtMs: 100,
    });

    expect(facts[0]?.rawEventId).toBe("event-1");
    expect(result.productVerdict).toBe("FAIL_PRODUCT");
    expect(result.evaluationFailureClass).toBe("NONE");
  });

  it("applies eventual onTimeout policy deterministically", () => {
    const evaluate = (onTimeout: "FAIL" | "INCONCLUSIVE" | "WARNING") =>
      evaluateFinalOracle({
        policy: {
          requirements: [
            {
              factKey: "remote.confirmed",
              obligation: "REQUIRED",
              timing: "EVENTUAL",
              deadlineMs: 100,
              onTimeout,
            },
          ],
        },
        facts: [],
        occurrenceId: "occ-1",
        iterationKey: "iteration-1",
        nowMs: 250,
        startedAtMs: 100,
      });

    expect(evaluate("FAIL").productVerdict).toBe("FAIL_PRODUCT");
    expect(evaluate("INCONCLUSIVE").productVerdict).toBe("INCONCLUSIVE");
    expect(evaluate("WARNING").productVerdict).toBe("PASS_ONLINE");
  });

  it("honors applicability and completion expressions", () => {
    const result = evaluateFinalOracle({
      policy: {
        requirements: [
          {
            factKey: "remote.confirmed",
            obligation: "REQUIRED",
            timing: "IMMEDIATE",
            onTimeout: "FAIL",
            applicabilityCondition: { allOf: ["mode.online"] },
          },
        ],
        completionExpression: { allOf: ["remote.confirmed"] },
      },
      facts: [
        {
          ...baseFact,
          factKey: "mode.online",
          plane: "LOCAL",
          subtype: "mode",
          value: false,
          deliveryLane: "ORDERED_REQUIRED",
        },
      ],
      occurrenceId: "occ-1",
      iterationKey: "iteration-1",
      nowMs: 120,
      startedAtMs: 100,
    });

    expect(result.requirementsByFact["remote.confirmed"]?.state).toBe("NOT_APPLICABLE");
    expect(result.productVerdict).toBe("PASS_ONLINE");
  });

  it("maps satisfied LOCAL queue subtype to PASS_QUEUED_OFFLINE (Phase 7.9)", () => {
    const result = evaluateFinalOracle({
      policy: {
        requirements: [
          {
            factKey: "LOCAL.OFFLINE_QUEUE_ITEM_WAITING",
            obligation: "REQUIRED",
            timing: "IMMEDIATE",
            onTimeout: "FAIL",
          },
        ],
      },
      facts: [
        {
          ...baseFact,
          factKey: "LOCAL.OFFLINE_QUEUE_ITEM_WAITING",
          plane: "LOCAL",
          subtype: "queue",
          value: true,
          deliveryLane: "ORDERED_REQUIRED",
        },
      ],
      occurrenceId: "occ-1",
      iterationKey: "iteration-1",
      nowMs: 120,
      startedAtMs: 100,
    });

    expect(result.outcome).toBe("SATISFIED");
    expect(result.productVerdict).toBe("PASS_QUEUED_OFFLINE");
  });

  it("does not treat non-queue LOCAL facts as PASS_QUEUED_OFFLINE", () => {
    const result = evaluateFinalOracle({
      policy: {
        requirements: [
          {
            factKey: "LOCAL.OFFLINE_QUEUE_ITEM_WAITING",
            obligation: "REQUIRED",
            timing: "IMMEDIATE",
            onTimeout: "FAIL",
          },
        ],
      },
      facts: [
        {
          ...baseFact,
          factKey: "LOCAL.OFFLINE_QUEUE_ITEM_WAITING",
          plane: "LOCAL",
          subtype: "mode",
          value: true,
          deliveryLane: "ORDERED_REQUIRED",
        },
      ],
      occurrenceId: "occ-1",
      iterationKey: "iteration-1",
      nowMs: 120,
      startedAtMs: 100,
    });

    expect(result.productVerdict).toBe("PASS_ONLINE");
  });

  it("replays derived facts idempotently and rejects cycles", () => {
    const graph = [
      { factKey: "b", dependsOn: ["a"] },
      { factKey: "c", dependsOn: ["b"] },
    ];

    expect(detectDerivedFactCycles(graph)).toEqual([]);
    expect(replayDerivedFacts(graph, ["a"])).toEqual(["a", "b", "c"]);
    expect(replayDerivedFacts(graph, ["a"])).toEqual(replayDerivedFacts(graph, ["a", "a"]));
    expect(
      detectDerivedFactCycles([
        { factKey: "a", dependsOn: ["b"] },
        { factKey: "b", dependsOn: ["a"] },
      ]),
    ).toEqual(["a -> b -> a"]);
  });
});
