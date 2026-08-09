/**
 * Phase 7.6–7.8 — full courier golden + nested FOR_EACH / barcode bounds.
 */

import { hashWorkflowIrV2, validateWorkflowIrV2 } from "@nesy/workflow-contract";
import { describe, expect, it } from "vitest";
import {
  countGoldenPlanSteps,
  goldenForEachBounds,
  NESY_BARCODE_FOR_EACH_MAX,
  NESY_FULL_COURIER_GOLDEN_IR,
  NESY_FULL_COURIER_GOLDEN_WORKFLOW_KEY,
} from "./macros/full-courier-golden.js";
import { NESY_COURIER_ENTITIES } from "./registries/entities.js";
import { NESY_WORKFLOWS, NESY_COURIER_INDEPENDENT_WORKFLOWS } from "./profiles/workflows.js";

describe("Phase 7.6–7.8 full courier golden", () => {
  it("registers the golden workflow in the published pack catalog", () => {
    expect(NESY_WORKFLOWS.fullCourierGolden).toBe(NESY_FULL_COURIER_GOLDEN_WORKFLOW_KEY);
    expect(
      NESY_COURIER_INDEPENDENT_WORKFLOWS.some((w) => w.workflowKey === NESY_FULL_COURIER_GOLDEN_WORKFLOW_KEY),
    ).toBe(true);
  });

  it("validates as WorkflowIR v2", () => {
    const issues = validateWorkflowIrV2(NESY_FULL_COURIER_GOLDEN_IR, {
      availableCapabilities: NESY_FULL_COURIER_GOLDEN_IR.capabilityRequirements.map((c) => c.capability),
    });
    expect(issues).toEqual([]);
  });

  it("nests stop FOR_EACH around parcel/barcode FOR_EACH (entity discovery)", () => {
    const kinds = NESY_FULL_COURIER_GOLDEN_IR.steps.map((s) => s.kind);
    expect(kinds.filter((k) => k === "FOR_EACH")).toHaveLength(2);
    expect(kinds).toContain("SDK_QUERY");

    const queryRefs = NESY_FULL_COURIER_GOLDEN_IR.steps
      .filter((s) => s.kind === "SDK_QUERY")
      .map((s) => s.queryRef);
    expect(queryRefs).toContain("nesy.availableStops");
    expect(queryRefs).toContain("nesy.parcelState");

    const bounds = goldenForEachBounds();
    expect(bounds.innerMax).toBe(NESY_BARCODE_FOR_EACH_MAX);
    expect(bounds.outerMax).toBeGreaterThanOrEqual(bounds.innerMax);

    const outerIdx = NESY_FULL_COURIER_GOLDEN_IR.steps.findIndex((s) => s.planStepId === "for-each-route-item");
    const innerIdx = NESY_FULL_COURIER_GOLDEN_IR.steps.findIndex((s) => s.planStepId === "for-each-item");
    expect(innerIdx).toBeGreaterThan(outerIdx);
  });

  it("does not statically duplicate barcode processing nodes", () => {
    const stepCount = countGoldenPlanSteps();
    // A dishonest 20-barcode unroll would be ≫ one body step × 20.
    expect(stepCount).toBeLessThan(NESY_BARCODE_FOR_EACH_MAX);
    const itemBodies = NESY_FULL_COURIER_GOLDEN_IR.steps.filter(
      (s) => s.planStepId === "assert-item-processed",
    );
    expect(itemBodies).toHaveLength(1);
  });

  it("binds STOP and PARCEL entity types from the registry", () => {
    const entityTypes = new Set(NESY_COURIER_ENTITIES.map((e) => e.entityType));
    expect(entityTypes.has("STOP")).toBe(true);
    expect(entityTypes.has("PARCEL")).toBe(true);
    expect(entityTypes.has("TASK")).toBe(true);
    expect(entityTypes.has("SHIPMENT")).toBe(true);

    const bindings = NESY_FULL_COURIER_GOLDEN_IR.steps
      .map((s) => s.entityBinding?.type)
      .filter((t): t is string => typeof t === "string");
    expect(bindings).toContain("STOP");
    expect(bindings).toContain("PARCEL");
  });

  it("keeps offline queue on the LOCAL SWITCH path (7.9 contract shared)", () => {
    const sw = NESY_FULL_COURIER_GOLDEN_IR.steps.find((s) => s.planStepId === "branch-on-queue");
    expect(sw?.kind).toBe("SWITCH");
    if (sw?.kind !== "SWITCH") throw new Error("expected SWITCH");
    expect(sw.branches.some((b) => b.branchId === "queued-offline")).toBe(true);
    expect(sw.default.policy).toBe("GOTO");

    const wait = NESY_FULL_COURIER_GOLDEN_IR.steps.find((s) => s.planStepId === "await-queue-drain");
    expect(wait?.kind).toBe("WAIT_EVENT");
    if (wait?.kind !== "WAIT_EVENT") throw new Error("expected WAIT_EVENT");
    expect(wait.factKey).toBe("LOCAL.OFFLINE_QUEUE_DRAINED");
    expect(wait.sourceLane).toBe("LOCAL");
  });

  it("hashes deterministically", () => {
    expect(hashWorkflowIrV2(NESY_FULL_COURIER_GOLDEN_IR)).toBe(hashWorkflowIrV2(NESY_FULL_COURIER_GOLDEN_IR));
  });
});
