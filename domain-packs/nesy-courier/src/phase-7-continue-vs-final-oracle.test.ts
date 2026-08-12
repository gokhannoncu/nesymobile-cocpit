/**
 * Phase 7.15 — Continue Gate progress ≠ Final Oracle product PASS (pack IR).
 */

import { describe, expect, it } from "vitest";
import { findReferenceSlice } from "./reference.js";
import { NESY_FACTS } from "./registries/facts.js";

describe("Phase 7.15 Continue Gate vs Final Oracle (pack IR)", () => {
  it("SELECT_ROUTE separates readiness Continue Gate from the schedule oracle", () => {
    const slice = findReferenceSlice("SELECT_ROUTE");
    const tap = slice?.genericIrSnapshot.steps.find((s) => s.planStepId === "tap-confirm");
    // READINESS ONLY, which is what this test's name claims. The gate used to
    // also demand `APP.AVAILABLE_STOPS_LOADED` — a projection fact produced by an
    // SDK_QUERY two steps BELOW it, so the gate waited for something that could
    // not exist until it had already passed. Whether the stops loaded is the
    // oracle's question, and it is asserted there.
    expect(tap?.continueGate?.allOf).toEqual([NESY_FACTS.ROUTE_LIST_READY]);

    const stopsLoaded = slice?.genericIrSnapshot.steps
      .flatMap((s) => (s.kind === "SDK_QUERY" ? (s.outputFactBindings ?? []) : []))
      .find((b) => b.factKey === NESY_FACTS.AVAILABLE_STOPS_LOADED);
    expect(stopsLoaded).toBeDefined();

    const assert = slice?.genericIrSnapshot.steps.find((s) => s.planStepId === "assert-selection");
    expect(assert?.kind).toBe("ASSERT_FACT");
    if (assert?.kind !== "ASSERT_FACT") throw new Error("expected ASSERT_FACT");
    const required = (assert.finalOraclePolicy?.requirements ?? []).filter(
      (r) => r.obligation === "REQUIRED",
    );

    // What route selection must get right is ON THE DEVICE: today's schedule was
    // created, stored with its stops, and is the one the session is working with.
    // The derived fact is the one a mismatch trips — it requires the schedule ids
    // to agree, so yesterday's plan left on screen by a failed create cannot
    // satisfy it. This slice used to require the back-office assignment instead,
    // which made a staging data gap read as a route-selection defect.
    for (const factKey of [
      NESY_FACTS.SELECTED_ROUTE_OBSERVED,
      NESY_FACTS.SCHEDULE_PERSISTED,
      NESY_FACTS.SCHEDULE_IS_TODAY,
      NESY_FACTS.SCHEDULE_IN_USE_IS_TODAYS,
    ]) {
      const requirement = required.find((r) => r.factKey === factKey);
      expect(requirement, `missing REQUIRED ${factKey}`).toBeDefined();
      expect(requirement?.timing).toBe("IMMEDIATE");
    }

    // The remote assignment is no longer this slice's business, in either place.
    expect(required.map((r) => r.factKey)).not.toContain(NESY_FACTS.ROUTE_ASSIGNED);
    expect(tap?.continueGate?.allOf ?? []).not.toContain(NESY_FACTS.ROUTE_ASSIGNED);

    // Both schedule claims must be OBSERVED by this slice; a requirement whose
    // producer is missing is the failure mode this whole phase exists to remove.
    const bindings = slice?.genericIrSnapshot.steps.flatMap((s) =>
      s.kind === "SDK_QUERY" ? (s.outputFactBindings ?? []) : [],
    ) ?? [];
    for (const factKey of [
      NESY_FACTS.SCHEDULE_IN_USE,
      NESY_FACTS.SCHEDULE_PERSISTED,
      NESY_FACTS.SCHEDULE_IS_TODAY,
    ]) {
      const binding = bindings.find((b) => b.factKey === factKey);
      expect(binding, `no producer for ${factKey}`).toBeDefined();
      // Correlation is what turns three separate yeses into one answer.
      expect(binding?.correlationColumn).toBe("schedule_id");
    }
  });
});
