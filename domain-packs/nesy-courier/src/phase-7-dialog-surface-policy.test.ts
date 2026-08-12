/**
 * Phase 7.11 — dialog/surface policy + WAIT_ANY expected legs.
 */

import { describe, expect, it } from "vitest";
import { NESY_DEFAULT_INTERRUPT_POLICY, NESY_SCANNER_INTERRUPT_POLICY } from "./macros/common.js";
import { findReferenceSlice } from "./reference.js";
import { NESY_FACTS } from "./registries/facts.js";
import { NESY_COURIER_SURFACES, NESY_SURFACE_HANDLER_MACROS } from "./registries/surfaces.js";
import { NESY_SURFACES } from "./registries/screens.js";

describe("Phase 7.11 dialog / surface policy", () => {
  it("separates route / update / session / permission / network surfaces", () => {
    const byKey = new Map(NESY_COURIER_SURFACES.map((s) => [s.surfaceKey, s]));

    expect(byKey.get(NESY_SURFACES.routeSelectionDialog)?.defaultPolicy).toBe("HANDLE");
    expect(byKey.get(NESY_SURFACES.routeSelectionDialog)?.handlerMacroRef).toBe(
      NESY_SURFACE_HANDLER_MACROS.selectRoute,
    );

    expect(byKey.get(NESY_SURFACES.mandatoryUpdateDialog)?.defaultPolicy).toBe("FAIL");
    expect(byKey.get(NESY_SURFACES.mandatoryUpdateDialog)?.blocksProductVerdict).toBe(true);

    expect(byKey.get(NESY_SURFACES.sessionExpiredDialog)?.defaultPolicy).toBe("FAIL");
    expect(byKey.get(NESY_SURFACES.sessionExpiredDialog)?.blocksProductVerdict).toBe(true);

    expect(byKey.get(NESY_SURFACES.permissionDialog)?.defaultPolicy).toBe("HANDLE");
    expect(byKey.get(NESY_SURFACES.permissionDialog)?.handlerMacroRef).toBe(
      NESY_SURFACE_HANDLER_MACROS.grantPermission,
    );

    expect(byKey.get(NESY_SURFACES.networkDialog)?.defaultPolicy).toBe("HANDLE");
    expect(byKey.get(NESY_SURFACES.networkDialog)?.handlerMacroRef).toBe(
      NESY_SURFACE_HANDLER_MACROS.recoverNetwork,
    );
  });

  it("marks unknown/unlisted surfaces as OPERATOR_ATTENTION (not silent green)", () => {
    expect(NESY_DEFAULT_INTERRUPT_POLICY.unlistedSurfacePolicy).toBe("OPERATOR_ATTENTION");
    expect(NESY_DEFAULT_INTERRUPT_POLICY.fatalSurfaceRefs).toEqual(
      expect.arrayContaining([NESY_SURFACES.mandatoryUpdateDialog, NESY_SURFACES.sessionExpiredDialog]),
    );
    expect(NESY_DEFAULT_INTERRUPT_POLICY.handledSurfaceRefs).toEqual(
      expect.arrayContaining([NESY_SURFACES.permissionDialog, NESY_SURFACES.networkDialog]),
    );
    expect(NESY_SCANNER_INTERRUPT_POLICY.handledSurfaceRefs).toContain(NESY_SURFACES.scannerSurface);
  });

  it("OPEN_STOP WAIT_ANY accepts expected task-list or delivery legs with hostOnlyCancel", () => {
    const slice = findReferenceSlice("OPEN_STOP");
    const wait = slice?.genericIrSnapshot.steps.find((s) => s.planStepId === "await-destination");
    expect(wait?.kind).toBe("WAIT_ANY");
    if (wait?.kind !== "WAIT_ANY") throw new Error("expected WAIT_ANY");
    expect(wait.hostOnlyCancel).toBe(true);
    expect(wait.legs.map((l) => l.factKey).sort()).toEqual(
      [NESY_FACTS.TASK_LIST_READY, NESY_FACTS.DELIVERY_FLOW_READY].sort(),
    );
    // Both legs converge on the SAME next step — that is the property worth
    // pinning, not its name. Whichever destination screen wins, the run then
    // observes which stop the app made active before asserting anything about it.
    expect(new Set(wait.legs.map((l) => l.onWin)).size).toBe(1);
    expect(wait.legs[0]?.onWin).toBe("read-active-stop");
  });
});
