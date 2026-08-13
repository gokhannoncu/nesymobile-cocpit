/**
 * Phase 7.11 — dialog/surface policy + WAIT_ANY expected legs.
 */

import { describe, expect, it } from "vitest";
import {
  NESY_DEFAULT_INTERRUPT_POLICY,
  NESY_SCANNER_INTERRUPT_POLICY,
  NESY_TOUR_ROUTING_INTERRUPT_POLICY,
} from "./macros/common.js";
import { findReferenceSlice } from "./reference.js";
import { NESY_FACTS } from "./registries/facts.js";
import { NESY_COURIER_SURFACES, NESY_SURFACE_HANDLER_MACROS } from "./registries/surfaces.js";
import { NESY_COURIER_SCREENS, NESY_SCREENS, NESY_SURFACES } from "./registries/screens.js";
import { NESY_COURIER_TARGETS, NESY_TARGETS } from "./registries/targets.js";

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

  /**
   * The tour-start routing chooser. It is EXPECTED — the slice opens it itself —
   * so the properties worth pinning are the ones that keep the happy path quiet:
   * it must not be handled by a dismissing macro, must not be fatal, and must not
   * invalidate the verdict of the run that opened it.
   */
  it("models the tour routing chooser as a driven surface, not an interrupt", () => {
    const surface = NESY_COURIER_SURFACES.find((s) => s.surfaceKey === NESY_SURFACES.tourRoutingDialog);

    expect(surface).toBeDefined();
    expect(surface?.kind).toBe("DIALOG");
    expect(surface?.defaultPolicy).toBe("IGNORE");
    // HANDLE here would dismiss the dialog whose dismissal IS the business action.
    expect(surface?.handlerMacroRef).toBeUndefined();
    expect(surface?.blocksProductVerdict).toBe(false);
    // Screen-scoped, unlike the four global dialogs: it can only appear over the
    // stop list, and `"*"` would invite every other slice to expect it.
    expect(surface?.parentScreenRefs).toEqual([NESY_SCREENS.routeStopList]);
    // No producer exists for a presence fact — `showLeavePermissionDialog` emits
    // no verdict event — and naming one anyway is how a wait times out against a
    // dialog that is on screen.
    expect(surface?.detection.requiredFactKeys).toEqual([]);
  });

  it("keeps the stop list declaring the routing chooser it hosts", () => {
    const stopList = NESY_COURIER_SCREENS.find((s) => s.screenKey === NESY_SCREENS.routeStopList);
    expect(stopList?.supportedSurfaceRefs).toContain(NESY_SURFACES.tourRoutingDialog);
  });

  /**
   * IGNORE in the registry is only half of it: `unlistedSurfacePolicy` is judged
   * against the MACRO's lists, so a driven surface the slice does not name would
   * raise OPERATOR_ATTENTION every time the slice succeeded.
   */
  it("lets the tour approval slice account for the chooser it opens", () => {
    const slice = findReferenceSlice("TOUR_APPROVAL_LIFECYCLE");

    expect(slice?.surfaceRefs).toContain(NESY_SURFACES.tourRoutingDialog);
    expect(slice?.interruptPolicy.handledSurfaceRefs).toContain(NESY_SURFACES.tourRoutingDialog);
    expect(slice?.interruptPolicy.fatalSurfaceRefs).not.toContain(NESY_SURFACES.tourRoutingDialog);
    expect(NESY_TOUR_ROUTING_INTERRUPT_POLICY.handledSurfaceRefs).toContain(NESY_SURFACES.tourRoutingDialog);
    // The global dialogs stay fatal for this slice too — accounting for one
    // expected surface must not relax the ones that invalidate a run.
    expect(NESY_TOUR_ROUTING_INTERRUPT_POLICY.fatalSurfaceRefs).toEqual(
      expect.arrayContaining([NESY_SURFACES.mandatoryUpdateDialog, NESY_SURFACES.sessionExpiredDialog]),
    );
  });

  it("binds both routing buttons to the surface rather than to the screen alone", () => {
    for (const key of [NESY_TARGETS.tourRoutingAuto, NESY_TARGETS.tourRoutingManual]) {
      const target = NESY_COURIER_TARGETS.find((t) => t.targetKey === key);
      expect(target?.surfaceRef).toBe(NESY_SURFACES.tourRoutingDialog);
      expect(target?.screenRef).toBe(NESY_SCREENS.routeStopList);
    }
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
