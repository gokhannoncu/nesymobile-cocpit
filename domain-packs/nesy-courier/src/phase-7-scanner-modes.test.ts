/**
 * Phase 7.13 — scanner modes + release isolation.
 */

import { describe, expect, it } from "vitest";
import { NESY_SEAM_RELEASE_ISOLATION } from "./macros/common.js";
import { findReferenceSlice } from "./reference.js";
import {
  NESY_ADAPTER_SETUP_REFS,
  NESY_COURIER_APPLICATION,
} from "./registries/application.js";
import { NESY_FACTS } from "./registries/facts.js";
import { NESY_COURIER_SURFACES } from "./registries/surfaces.js";
import { NESY_SURFACES } from "./registries/screens.js";

describe("Phase 7.13 scanner modes", () => {
  const slice = findReferenceSlice("PROCESS_PARCEL");

  it("keeps SCANNER_INJECTION automation-only with named releaseGuard", () => {
    const seam = NESY_COURIER_APPLICATION.adapterCapabilities?.find((c) => c.kind === "SCANNER_INJECTION");
    expect(seam?.automationOnly).toBe(true);
    expect(seam?.releaseGuard).toBe("automationRelease=false");
    expect(seam?.mutating).toBe(true);
    expect(seam?.operationRefs).toEqual(
      expect.arrayContaining([
        NESY_ADAPTER_SETUP_REFS.scannerInject,
        NESY_ADAPTER_SETUP_REFS.scannerManualEntry,
      ]),
    );
  });

  /**
   * The seam still EXISTS and is still declared automation-only — the test above
   * guards that. What changed is that PROCESS_PARCEL no longer uses it.
   *
   * Measured 2026-08-13: the task page carries the same manual-entry control as
   * the stop list (`manuel_input` → `et_input_dialog_barcode_number` → `btn_ok`),
   * and typing a barcode there produced PARCEL_SCANNED, SCREEN_READY and
   * DELIVERY_STARTED with the delivery screen open. A slice that can drive the
   * product's own input has no business installing a backdoor to do it — and the
   * `SESSION_ISOLATION_ASSERTED` requirement went with the injection, because it
   * guarded a risk the slice no longer takes.
   */
  it("drives the product's own manual entry rather than the injection seam", () => {
    const steps = slice?.genericIrSnapshot.steps ?? [];
    expect(steps.find((s) => s.planStepId === "inject-payload")).toBeUndefined();
    expect(steps.some((s) => s.kind === "REMOTE_ACTION")).toBe(false);

    const typed = steps.find((s) => s.planStepId === "enter-scan-value");
    expect(typed?.kind === "BRIDGE_ACTION" ? typed.action : "").toBe("setText");
    const order = steps.map((s) => s.planStepId);
    expect(order.indexOf("tap-input-confirm")).toBeGreaterThan(order.indexOf("enter-scan-value"));

    // The tap that CAUSES the events carries their gate. A device event is
    // stamped with the occurrence the host last seeded — the tapping step — so a
    // separate wait would look under its own occurrence and never find it.
    const confirm = steps.find((s) => s.planStepId === "tap-input-confirm");
    const gated = confirm?.kind === "BRIDGE_ACTION" ? confirm.continueGate?.allOf ?? [] : [];
    expect(gated).toContain(NESY_FACTS.PARCEL_SCANNED);
    expect(gated).toContain(NESY_FACTS.DELIVERY_FLOW_STARTED);
  });

  it("keeps seam release isolation declared on the slice", () => {
    expect(slice?.releaseIsolation.automationOnly).toBe(true);
    expect(slice?.releaseIsolation.assertionFactKey).toBe(NESY_SEAM_RELEASE_ISOLATION.assertionFactKey);

    // And NOT as an oracle requirement of this slice. The assertion guards the
    // injection seam; this slice types into the product's own dialog, so
    // demanding it here would be asking the run to prove something about a
    // mechanism it never touches — the kind of requirement that can only ever
    // time out, which is how this slice was unrunnable in the first place.
    const assert = slice?.genericIrSnapshot.steps.find((s) => s.planStepId === "assert-delivery-started");
    expect(assert?.kind).toBe("ASSERT_FACT");
    if (assert?.kind !== "ASSERT_FACT") throw new Error("expected ASSERT_FACT");
    expect(
      assert.finalOraclePolicy?.requirements.map((r) => r.factKey),
    ).not.toContain(NESY_FACTS.SESSION_ISOLATION_ASSERTED);
  });

  it("treats scanner surface as IGNORE (expected overlay, not fatal)", () => {
    const scanner = NESY_COURIER_SURFACES.find((s) => s.surfaceKey === NESY_SURFACES.scannerSurface);
    expect(scanner?.defaultPolicy).toBe("IGNORE");
  });
});
