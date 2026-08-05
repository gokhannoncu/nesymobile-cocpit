/**
 * ===========================================================================
 *  Nesy Courier Surface Registry  (Plan D.6B/D.6C · 4B.15)
 *
 *  Eight surfaces. None of them is a screen, and that is the reason this file
 *  exists separately.
 *
 *  Declared as screens, the four global dialogs below would need a fabricated
 *  entry strategy ("navigate to the session-expired dialog") and would have to
 *  be handled by every flow individually — so the first flow that forgot would
 *  hang on a dialog nobody planned for, and the failure would read as a timeout
 *  in an unrelated step.
 *
 *  As surfaces with `parentScreenRefs: ["*"]`, they are handled once by policy
 *  and caught wherever they fire.
 *
 *  `priority` orders competing interrupts; ties break deterministically on the
 *  key. `blocksProductVerdict` separates "the run never tested the flow" (a
 *  mandatory update mid-delivery) from "something benign appeared" (a network
 *  toast).
 * ===========================================================================
 */

import type { SurfaceDefinition } from "@nesy/domain-pack-contracts";
import { NESY_COURIER_APPLICATION_KEY } from "./application.js";
import { NESY_FACTS } from "./facts.js";
import { NESY_SCREENS, NESY_SURFACES } from "./screens.js";

const APP = NESY_COURIER_APPLICATION_KEY;

/** Handler macro keys referenced by HANDLE-policy surfaces. */
export const NESY_SURFACE_HANDLER_MACROS = {
  selectRoute: "nesy.macro.select-route",
  grantPermission: "nesy.macro.grant-permission",
  recoverNetwork: "nesy.macro.recover-network",
} as const;

export const NESY_COURIER_SURFACES: readonly SurfaceDefinition[] = [
  {
    surfaceKey: NESY_SURFACES.routeSelectionDialog,
    applicationRef: APP,
    kind: "DIALOG",
    displayName: "Route selection dialog",
    parentScreenRefs: [NESY_SCREENS.routeStopList],
    detection: {
      requiredFactKeys: [NESY_FACTS.ROUTE_DIALOG_READY],
      deadlineMs: 15_000,
      stableForMs: 200,
    },
    defaultPolicy: "HANDLE",
    priority: 40,
    handlerMacroRef: NESY_SURFACE_HANDLER_MACROS.selectRoute,
    blocksProductVerdict: false,
  },
  {
    // Highest priority: if this is on screen, nothing else in the app is
    // reachable, so any flow-level failure below it is a misdiagnosis.
    surfaceKey: NESY_SURFACES.mandatoryUpdateDialog,
    applicationRef: APP,
    kind: "DIALOG",
    displayName: "Mandatory update dialog",
    parentScreenRefs: ["*"],
    detection: {
      requiredFactKeys: [NESY_FACTS.UPDATE_DIALOG_PRESENT],
      deadlineMs: 10_000,
    },
    defaultPolicy: "FAIL",
    priority: 100,
    blocksProductVerdict: true,
  },
  {
    surfaceKey: NESY_SURFACES.sessionExpiredDialog,
    applicationRef: APP,
    kind: "DIALOG",
    displayName: "Session expired dialog",
    parentScreenRefs: ["*"],
    detection: {
      requiredFactKeys: [NESY_FACTS.SESSION_EXPIRED_DIALOG_PRESENT],
      deadlineMs: 10_000,
    },
    // Not HANDLE: silently re-authenticating would hide a real session bug and
    // turn an expiry regression into a slightly slower green run.
    defaultPolicy: "FAIL",
    priority: 90,
    blocksProductVerdict: true,
  },
  {
    surfaceKey: NESY_SURFACES.permissionDialog,
    applicationRef: APP,
    kind: "SYSTEM_OVERLAY",
    displayName: "System permission dialog",
    parentScreenRefs: ["*"],
    detection: {
      requiredFactKeys: [NESY_FACTS.PERMISSION_DIALOG_PRESENT],
      deadlineMs: 10_000,
    },
    defaultPolicy: "HANDLE",
    priority: 80,
    handlerMacroRef: NESY_SURFACE_HANDLER_MACROS.grantPermission,
    blocksProductVerdict: false,
  },
  {
    surfaceKey: NESY_SURFACES.networkDialog,
    applicationRef: APP,
    kind: "DIALOG",
    displayName: "Network error dialog",
    parentScreenRefs: ["*"],
    detection: {
      requiredFactKeys: [NESY_FACTS.NETWORK_DIALOG_PRESENT],
      deadlineMs: 10_000,
    },
    defaultPolicy: "HANDLE",
    priority: 50,
    handlerMacroRef: NESY_SURFACE_HANDLER_MACROS.recoverNetwork,
    blocksProductVerdict: false,
  },
  {
    // IGNORE rather than HANDLE: the scanner is an expected part of the parcel
    // macro's own path, not an interrupt that arrives unbidden.
    surfaceKey: NESY_SURFACES.scannerSurface,
    applicationRef: APP,
    kind: "SCANNER",
    displayName: "Barcode scanner surface",
    parentScreenRefs: [
      NESY_SCREENS.stopTaskList,
      NESY_SCREENS.deliveryFlow,
      NESY_SCREENS.pickupFlow,
      NESY_SCREENS.vehicleLoading,
    ],
    detection: {
      requiredFactKeys: [NESY_FACTS.SCANNER_SURFACE_READY],
      deadlineMs: 15_000,
      stableForMs: 200,
    },
    defaultPolicy: "IGNORE",
    priority: 30,
    blocksProductVerdict: false,
  },
  {
    surfaceKey: NESY_SURFACES.paymentSurface,
    applicationRef: APP,
    kind: "BOTTOM_SHEET",
    displayName: "Payment collection sheet",
    parentScreenRefs: [NESY_SCREENS.deliveryFlow],
    detection: {
      requiredFactKeys: [NESY_FACTS.PAYMENT_SURFACE_READY],
      deadlineMs: 15_000,
    },
    defaultPolicy: "IGNORE",
    priority: 30,
    blocksProductVerdict: false,
  },
  {
    surfaceKey: NESY_SURFACES.fiscalSurface,
    applicationRef: APP,
    kind: "WEBVIEW_OVERLAY",
    displayName: "Fiscal receipt overlay",
    parentScreenRefs: [NESY_SCREENS.deliveryFlow],
    detection: {
      requiredFactKeys: [NESY_FACTS.FISCAL_SURFACE_READY],
      deadlineMs: 20_000,
    },
    // Same priority as the two above; `compareSurfacePriority` breaks the tie on
    // the key so the same device state always produces the same handling order.
    defaultPolicy: "IGNORE",
    priority: 30,
    blocksProductVerdict: false,
  },
];
