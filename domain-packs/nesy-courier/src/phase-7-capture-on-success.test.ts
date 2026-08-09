/**
 * Phase 7.18 — happy-path artifact policy never auto-dumps on success.
 */

import { describe, expect, it } from "vitest";
import { findReferenceSlice } from "./reference.js";

describe("Phase 7.18 captureOnSuccess policy", () => {
  it("reference IR snapshots keep captureOnSuccess:false", () => {
    for (const slice of [
      "COURIER_LOGIN",
      "SELECT_ROUTE",
      "OPEN_STOP",
      "PROCESS_PARCEL",
      "COMPLETE_DELIVERY",
      "TOUR_APPROVAL_LIFECYCLE",
    ] as const) {
      const ir = findReferenceSlice(slice)?.genericIrSnapshot;
      expect(ir?.policies.artifactPolicy.captureOnSuccess, slice).toBe(false);
      expect(ir?.policies.artifactPolicy.captureOnFailure, slice).toBe(true);
    }
  });
});
