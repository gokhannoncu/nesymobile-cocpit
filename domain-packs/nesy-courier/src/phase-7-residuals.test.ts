/**
 * Phase 7 residual close-out — code-provable CHECKPOINT leftovers (non-DUT).
 */

import { describe, expect, it } from "vitest";
import { NESY_DEFAULT_INTERRUPT_POLICY } from "./macros/common.js";
import { NESY_BARCODE_FOR_EACH_MAX, NESY_FULL_COURIER_GOLDEN_IR } from "./macros/full-courier-golden.js";
import { findReferenceSlice } from "./reference.js";
import { NESY_COURIER_LAUNCH_PROFILES, NESY_LAUNCH_PROFILES } from "./profiles/launch.js";
import { NESY_COURIER_TEST_PROFILES, NESY_TEST_PROFILES } from "./profiles/test-profiles.js";
import { NESY_ENTITIES } from "./registries/entities.js";
import { NESY_FACTS } from "./registries/facts.js";
import { NESY_COURIER_TARGETS, NESY_TARGETS } from "./registries/targets.js";

describe("Phase 7 residuals (code-provable)", () => {
  it("OPEN_STOP binds STOP identity (not row index) for hidden-list resolution", () => {
    const slice = findReferenceSlice("OPEN_STOP");
    const resolve = slice?.genericIrSnapshot.steps.find((s) => s.planStepId === "resolve-row");
    expect(resolve?.kind).toBe("RESOLVE_TARGET");
    if (resolve?.kind !== "RESOLVE_TARGET") throw new Error("expected RESOLVE_TARGET");
    expect(resolve.entityBinding?.type).toBe(NESY_ENTITIES.stop);
    expect(resolve.targetRef).toBe(NESY_TARGETS.stopRow);

    const stopRow = NESY_COURIER_TARGETS.find((t) => t.targetKey === NESY_TARGETS.stopRow);
    const chain = stopRow?.resolution.chain ?? [];
    const rowIndex = chain.findIndex((p) => p.kind === "ROW_INDEX_HINT");
    expect(rowIndex).toBe(chain.length - 1);
    expect(chain[rowIndex]?.establishesIdentity).toBe(false);
    expect(stopRow?.entityBinding?.entityTypeRef).toBe("STOP");
  });

  it("golden barcode loop binds PARCEL occurrence entity keys at FOR_EACH body", () => {
    const body = NESY_FULL_COURIER_GOLDEN_IR.steps.find((s) => s.planStepId === "assert-item-processed");
    expect(body?.kind).toBe("ASSERT_FACT");
    if (body?.kind !== "ASSERT_FACT") throw new Error("expected ASSERT_FACT");
    expect(body.entityBinding?.type).toBe(NESY_ENTITIES.parcel);
    expect(body.entityBinding?.id).toBe("vars.item");
    const loop = NESY_FULL_COURIER_GOLDEN_IR.steps.find((s) => s.planStepId === "for-each-item");
    expect(loop?.kind === "FOR_EACH" ? loop.maxIterations : undefined).toBe(NESY_BARCODE_FOR_EACH_MAX);
  });

  it("unknown dialog policy is OPERATOR_ATTENTION and slices capture on failure only", () => {
    expect(NESY_DEFAULT_INTERRUPT_POLICY.unlistedSurfacePolicy).toBe("OPERATOR_ATTENTION");
    for (const key of ["OPEN_STOP", "COMPLETE_DELIVERY", "TOUR_APPROVAL_LIFECYCLE"] as const) {
      const ir = findReferenceSlice(key)?.genericIrSnapshot;
      expect(ir?.policies.artifactPolicy.captureOnFailure, key).toBe(true);
      expect(ir?.policies.artifactPolicy.captureOnSuccess, key).toBe(false);
    }
  });

  it("launch readiness preconditions are declared on every launch profile", () => {
    for (const profile of NESY_COURIER_LAUNCH_PROFILES) {
      expect(profile.preconditionFactKeys.length, profile.profileKey).toBeGreaterThan(0);
      expect(profile.preconditionFactKeys).toContain(NESY_FACTS.SESSION_ISOLATION_ASSERTED);
    }
    const cold = NESY_COURIER_LAUNCH_PROFILES.find((p) => p.profileKey === NESY_LAUNCH_PROFILES.coldRealLogin);
    expect(cold?.producesProductVerdict).toBe(true);
    const prepared = NESY_COURIER_LAUNCH_PROFILES.find(
      (p) => p.profileKey === NESY_LAUNCH_PROFILES.preparedSession,
    );
    expect(prepared?.producesProductVerdict).toBe(false);
  });

  it("short soak uses reuse-session (restart/resume) and stays non-gating", () => {
    const soak = NESY_COURIER_TEST_PROFILES.find((p) => p.profileKey === NESY_TEST_PROFILES.soakShort);
    expect(soak?.launchProfileRef).toBe(NESY_LAUNCH_PROFILES.reuseSession);
    expect(soak?.releaseGate).toBe(false);
    expect(soak?.kind).toBe("DIAGNOSTIC");
  });

  it("accessibility preview is Bridge-metadata scoped and non-gating", () => {
    const a11y = NESY_COURIER_TEST_PROFILES.find(
      (p) => p.profileKey === NESY_TEST_PROFILES.previewAccessibilityBasic,
    );
    expect(a11y?.kind).toBe("PREVIEW");
    expect(a11y?.releaseGate).toBe(false);
    expect(a11y?.requiredCapabilityRefs).toContain("verdict.core.bridge.resolve-target");
    expect(a11y?.requiredCapabilityRefs).not.toContain("domain.nesy.scanner.inject");
  });

  it("Tour Approval withholds PASS when push/app-state chain is incomplete by design", () => {
    const slice = findReferenceSlice("TOUR_APPROVAL_LIFECYCLE");
    const assert = slice?.genericIrSnapshot.steps.find((s) => s.planStepId === "assert-approved");
    if (assert?.kind !== "ASSERT_FACT") throw new Error("expected ASSERT_FACT");
    const pushReq = assert.finalOraclePolicy?.requirements.find(
      (r) => r.factKey === NESY_FACTS.TOUR_APPROVAL_PUSH_RECEIVED,
    );
    expect(pushReq?.obligation).toBe("WARNING");
    const confirmed = assert.finalOraclePolicy?.requirements.find(
      (r) => r.factKey === NESY_FACTS.TOUR_APPROVAL_CONFIRMED,
    );
    expect(confirmed?.obligation).toBe("REQUIRED");
    const approve = slice?.genericIrSnapshot.steps.find((s) => s.planStepId === "dispatcher-approves");
    if (approve?.kind !== "REMOTE_ACTION") throw new Error("expected REMOTE_ACTION");
    expect(approve.spec.reconciliationPolicy).toBe("RECONCILE_BEFORE_RELEASE");
  });
});
