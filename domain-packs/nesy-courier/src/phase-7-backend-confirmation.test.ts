/**
 * Phase 7.10 — backend confirmation + HTTP 2xx ≠ business success.
 */

import { describe, expect, it } from "vitest";
import { NESY_COURIER_EVIDENCE_SOURCES } from "./evidence/sources.js";
import { NESY_COURIER_DERIVED_FACTS } from "./evidence/derived.js";
import { findReferenceSlice } from "./reference.js";
import { NESY_FACTS } from "./registries/facts.js";

describe("Phase 7.10 backend confirmation", () => {
  const slice = findReferenceSlice("COMPLETE_DELIVERY");

  it("pins verify-backend-status to SHIPMENT with VALIDATION remote read", () => {
    const step = slice?.genericIrSnapshot.steps.find((s) => s.planStepId === "verify-backend-status");
    expect(step?.kind).toBe("REMOTE_ACTION");
    if (step?.kind !== "REMOTE_ACTION") throw new Error("expected REMOTE_ACTION");
    expect(step.spec.role).toBe("VALIDATION");
    expect(step.spec.effectClass).toBe("READ_ONLY");
    expect(step.spec.entityBinding?.type).toBe("SHIPMENT");
    expect(step.spec.outputFactBindings.some((b) => b.factKey === NESY_FACTS.DELIVERY_STATUS_COMPLETED)).toBe(
      true,
    );
  });

  it("requires correlated DELIVERY_CONFIRMED as EVENTUAL Final Oracle", () => {
    const assert = slice?.genericIrSnapshot.steps.find((s) => s.planStepId === "assert-confirmed");
    expect(assert?.kind).toBe("ASSERT_FACT");
    if (assert?.kind !== "ASSERT_FACT") throw new Error("expected ASSERT_FACT");
    expect(assert.factKey).toBe(NESY_FACTS.DELIVERY_CONFIRMED);
    const req = assert.finalOraclePolicy?.requirements.find((r) => r.factKey === NESY_FACTS.DELIVERY_CONFIRMED);
    expect(req?.timing).toBe("EVENTUAL");
    expect(req?.obligation).toBe("REQUIRED");

    const derived = NESY_COURIER_DERIVED_FACTS.facts.find((f) => f.factKey === NESY_FACTS.DELIVERY_CONFIRMED);
    expect(derived?.provenance.reducerKind).toBe("CORRELATED_ALL_OF");
    expect(derived?.requiresCorrelation).toBe(true);
    expect(derived?.provenance.inputFactKeys).toEqual([
      NESY_FACTS.DELIVERY_STATUS_COMPLETED,
      NESY_FACTS.DELIVERY_SUBMITTED,
    ]);
  });

  it("keeps HTTP transport ack transportSuccessOnly without business factKey", () => {
    const ack = NESY_COURIER_EVIDENCE_SOURCES.find((s) => s.sourceKey === "nesy.remote.delivery-transport-ack");
    expect(ack?.transportSuccessOnly).toBe(true);
    expect(ack?.factKey).toBeUndefined();
    expect(ack?.authority).toBe("FALLBACK");
  });
});
