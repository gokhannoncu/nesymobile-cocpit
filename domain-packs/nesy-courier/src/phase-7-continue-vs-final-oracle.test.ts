/**
 * Phase 7.15 — Continue Gate progress ≠ Final Oracle product PASS (pack IR).
 */

import { describe, expect, it } from "vitest";
import { findReferenceSlice } from "./reference.js";
import { NESY_FACTS } from "./registries/facts.js";

describe("Phase 7.15 Continue Gate vs Final Oracle (pack IR)", () => {
  it("SELECT_ROUTE separates readiness Continue Gate from EVENTUAL assignment oracle", () => {
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
    const routeAssigned = assert.finalOraclePolicy?.requirements.find(
      (r) => r.factKey === NESY_FACTS.ROUTE_ASSIGNED,
    );
    expect(routeAssigned?.timing).toBe("EVENTUAL");
    expect(routeAssigned?.obligation).toBe("REQUIRED");

    // Continue Gate must not require the eventual assignment fact.
    expect(tap?.continueGate?.allOf ?? []).not.toContain(NESY_FACTS.ROUTE_ASSIGNED);
  });
});
