/**
 * Phase 7.12 — Tour Approval Lifecycle (real vs setup; no transport-as-PASS).
 */

import { describe, expect, it } from "vitest";
import { NESY_BACKOFFICE_OPERATIONS } from "./adapters/backoffice.js";
import { NESY_COURIER_DERIVED_FACTS } from "./evidence/derived.js";
import { NESY_LAUNCH_PROFILES, NESY_COURIER_LAUNCH_PROFILES } from "./profiles/launch.js";
import { findReferenceSlice } from "./reference.js";
import { NESY_FACTS } from "./registries/facts.js";

describe("Phase 7.12 Tour Approval Lifecycle", () => {
  const slice = findReferenceSlice("TOUR_APPROVAL_LIFECYCLE");

  it("keeps dispatcher approve as SETUP with empty output facts (transport ≠ approval)", () => {
    const approve = slice?.genericIrSnapshot.steps.find((s) => s.planStepId === "dispatcher-approves");
    expect(approve?.kind).toBe("REMOTE_ACTION");
    if (approve?.kind !== "REMOTE_ACTION") throw new Error("expected REMOTE_ACTION");
    expect(approve.spec.operationRef).toBe(NESY_BACKOFFICE_OPERATIONS.approveTourRequest);
    expect(approve.spec.role).toBe("SETUP");
    expect(approve.spec.outputFactBindings).toEqual([]);
    expect(approve.spec.reconciliationPolicy).toBe("RECONCILE_BEFORE_RELEASE");
  });

  it("requires correlated TOUR_APPROVAL_CONFIRMED; push is WARNING only", () => {
    const assert = slice?.genericIrSnapshot.steps.find((s) => s.planStepId === "assert-approved");
    expect(assert?.kind).toBe("ASSERT_FACT");
    if (assert?.kind !== "ASSERT_FACT") throw new Error("expected ASSERT_FACT");

    const reqs = assert.finalOraclePolicy?.requirements ?? [];
    expect(reqs.find((r) => r.factKey === NESY_FACTS.TOUR_APPROVAL_CONFIRMED)?.obligation).toBe("REQUIRED");
    expect(reqs.find((r) => r.factKey === NESY_FACTS.TOUR_APPROVAL_STATUS_APPROVED)?.obligation).toBe(
      "REQUIRED",
    );
    expect(reqs.find((r) => r.factKey === NESY_FACTS.TOUR_APPROVAL_PUSH_RECEIVED)?.obligation).toBe(
      "WARNING",
    );

    const push = slice?.genericIrSnapshot.steps.find((s) => s.planStepId === "await-push");
    expect(push?.kind).toBe("WAIT_EVENT");
    if (push?.kind !== "WAIT_EVENT") throw new Error("expected WAIT_EVENT");
    expect(push.onTimeout).toBe("CONTINUE");

    const derived = NESY_COURIER_DERIVED_FACTS.facts.find((f) => f.factKey === NESY_FACTS.TOUR_APPROVAL_CONFIRMED);
    expect(derived?.requiresCorrelation).toBe(true);
    expect(derived?.provenance.inputFactKeys).toEqual(
      expect.arrayContaining([
        NESY_FACTS.TOUR_APPROVAL_REQUESTED,
        NESY_FACTS.TOUR_APPROVAL_REQUEST_CREATED,
        NESY_FACTS.TOUR_APPROVAL_STATUS_APPROVED,
      ]),
    );
  });

  it("setup/precondition launch cannot produce product PASS", () => {
    const setup = NESY_COURIER_LAUNCH_PROFILES.find((p) => p.profileKey === NESY_LAUNCH_PROFILES.directState);
    expect(setup?.sessionPreparation).toBe("DIRECT_STATE");
    expect(setup?.producesProductVerdict).toBe(false);
    expect(setup?.releaseIsolation.automationOnly).toBe(true);

    const negative = slice?.negativeCases.map((c) => c.caseKey) ?? [];
    expect(negative).toEqual(expect.arrayContaining(["SETUP_MODE_CLAIMS_APPROVAL_VERDICT"]));
    expect(negative).toEqual(expect.arrayContaining(["TRANSPORT_ACK_AS_APPROVAL"]));
  });
});
