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

  it("inject-payload is SETUP with zero output facts (injection ≠ product evidence)", () => {
    const inject = slice?.genericIrSnapshot.steps.find((s) => s.planStepId === "inject-payload");
    expect(inject?.kind).toBe("REMOTE_ACTION");
    if (inject?.kind !== "REMOTE_ACTION") throw new Error("expected REMOTE_ACTION");
    expect(inject.spec.role).toBe("SETUP");
    expect(inject.spec.operationRef).toBe(NESY_ADAPTER_SETUP_REFS.scannerInject);
    expect(inject.spec.outputFactBindings).toEqual([]);
  });

  it("requires SESSION_ISOLATION_ASSERTED and seam release isolation on the slice", () => {
    expect(slice?.releaseIsolation.automationOnly).toBe(true);
    expect(slice?.releaseIsolation.assertionFactKey).toBe(NESY_SEAM_RELEASE_ISOLATION.assertionFactKey);

    const assert = slice?.genericIrSnapshot.steps.find((s) => s.planStepId === "assert-processed");
    expect(assert?.kind).toBe("ASSERT_FACT");
    if (assert?.kind !== "ASSERT_FACT") throw new Error("expected ASSERT_FACT");
    const iso = assert.finalOraclePolicy?.requirements.find(
      (r) => r.factKey === NESY_FACTS.SESSION_ISOLATION_ASSERTED,
    );
    expect(iso?.obligation).toBe("REQUIRED");
  });

  it("treats scanner surface as IGNORE (expected overlay, not fatal)", () => {
    const scanner = NESY_COURIER_SURFACES.find((s) => s.surfaceKey === NESY_SURFACES.scannerSurface);
    expect(scanner?.defaultPolicy).toBe("IGNORE");
  });
});
