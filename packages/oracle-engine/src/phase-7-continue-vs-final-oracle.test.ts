/**
 * Phase 7.15 — Continue Gate can SATISFY while Final Oracle stays non-PASS.
 */

import { describe, expect, it } from "vitest";
import { evaluateContinueGate, evaluateFinalOracle } from "./index.js";

const ROUTE_LIST_READY = "UI.ROUTE_LIST_READY";
const ROUTE_ASSIGNED = "REMOTE.ROUTE_ASSIGNED";

const base = {
  occurrenceId: "occ-1",
  iterationKey: "iteration-1",
  observedAtMs: 100,
  freshnessMaxAgeMs: 5_000,
  authority: "PRIMARY" as const,
};

describe("Phase 7.15 Continue Gate vs Final Oracle (engine)", () => {
  it("receipt-safe Continue Gate can SATISFY while Final Oracle stays non-PASS", () => {
    const continueResult = evaluateContinueGate({
      policy: {
        allOf: [ROUTE_LIST_READY],
        deadlineMs: 5_000,
        unknownPolicy: "RETRY",
      },
      facts: [
        {
          ...base,
          factKey: ROUTE_LIST_READY,
          plane: "UI",
          subtype: "screen",
          value: true,
          deliveryLane: "RECEIPT_SAFE",
        },
      ],
      occurrenceId: "occ-1",
      iterationKey: "iteration-1",
      nowMs: 150,
      startedAtMs: 100,
    });
    expect(continueResult.outcome).toBe("SATISFIED");

    const oracleEarly = evaluateFinalOracle({
      policy: {
        requirements: [
          {
            factKey: ROUTE_ASSIGNED,
            obligation: "REQUIRED",
            timing: "EVENTUAL",
            deadlineMs: 60_000,
            onTimeout: "INCONCLUSIVE",
          },
        ],
      },
      facts: [
        {
          ...base,
          factKey: ROUTE_LIST_READY,
          plane: "UI",
          subtype: "screen",
          value: true,
          deliveryLane: "ORDERED_REQUIRED",
        },
      ],
      occurrenceId: "occ-1",
      iterationKey: "iteration-1",
      nowMs: 150,
      startedAtMs: 100,
    });
    expect(oracleEarly.productVerdict).not.toMatch(/^PASS_/);

    const oracleLate = evaluateFinalOracle({
      policy: {
        requirements: [
          {
            factKey: ROUTE_ASSIGNED,
            obligation: "REQUIRED",
            timing: "EVENTUAL",
            deadlineMs: 60_000,
            onTimeout: "INCONCLUSIVE",
          },
        ],
      },
      facts: [
        {
          ...base,
          factKey: ROUTE_ASSIGNED,
          plane: "REMOTE",
          subtype: "adapter",
          value: true,
          deliveryLane: "ORDERED_REQUIRED",
          observedAtMs: 200,
        },
      ],
      occurrenceId: "occ-1",
      iterationKey: "iteration-1",
      nowMs: 250,
      startedAtMs: 100,
    });
    expect(oracleLate.productVerdict).toBe("PASS_ONLINE");
  });

  it("conflicting PRIMARY ordered facts keep Final Oracle non-PASS (CHECKPOINT 53)", () => {
    const result = evaluateFinalOracle({
      policy: {
        requirements: [
          {
            factKey: ROUTE_ASSIGNED,
            obligation: "REQUIRED",
            timing: "IMMEDIATE",
            onTimeout: "FAIL",
          },
        ],
      },
      facts: [
        {
          ...base,
          factKey: ROUTE_ASSIGNED,
          plane: "REMOTE",
          subtype: "adapter",
          value: true,
          deliveryLane: "ORDERED_REQUIRED",
        },
        {
          ...base,
          factKey: ROUTE_ASSIGNED,
          plane: "REMOTE",
          subtype: "adapter",
          value: false,
          deliveryLane: "ORDERED_REQUIRED",
          observedAtMs: 110,
        },
      ],
      occurrenceId: "occ-1",
      iterationKey: "iteration-1",
      nowMs: 150,
      startedAtMs: 100,
    });
    expect(result.productVerdict).not.toMatch(/^PASS_/);
    expect(result.requirementsByFact[ROUTE_ASSIGNED]?.state).toBe("EVIDENCE_CONFLICT");
  });
});
