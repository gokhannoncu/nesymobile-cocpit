/**
 * ===========================================================================
 *  Nesy Courier Surface Registry  (Plan D.6B/D.6C · 4B.15)
 *
 *  Ten surfaces. None of them is a screen, and that is the reason this file
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
  dismissNotificationList: "nesy.macro.dismiss-notification-list",
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
    /**
     * The tour-start routing chooser, measured on device 2026-08-12.
     *
     * WHY IT IS IGNORE, WHICH IS THE WHOLE POINT OF THE ENTRY
     *
     * This dialog is not an interrupt. It arrives because the macro asked for it:
     * `btn_out` reaches no backend at all, it inflates `dialog_exit_request`, and
     * `Task/RequestLeavingPermission` is issued only by `auto_route` /
     * `manual_route`. The tour-approval slice therefore drives it with explicit
     * RESOLVE_TARGET + BRIDGE_ACTION steps.
     *
     * None of the four policy values means "expected, and driven by the running
     * macro". IGNORE is the closest honest reading of the four — "benign, does not
     * block the current step" — and it is exactly how the scanner surface below,
     * the pack's other macro-driven surface, is already declared. The other three
     * would each be a lie about the happy path:
     *
     *   HANDLE  needs a handler macro whose job is to dismiss the surface. Here
     *           dismissal is the business action: a handler racing the slice's own
     *           tap would either request the tour with the wrong `calculateRoute`
     *           flag or cancel the request the slice exists to make.
     *   FAIL    would turn every successful tour request red.
     *   OPERATOR_ATTENTION would flag a dialog the pack put on screen itself.
     *
     * Being IGNORE in the registry is not sufficient on its own: a macro's
     * `InterruptPolicy` treats anything absent from its own lists as unlisted, so
     * the driving slice also names this surface in `handledSurfaceRefs` — see
     * `NESY_TOUR_ROUTING_INTERRUPT_POLICY` in `macros/common.ts`, the same
     * arrangement the scanner has.
     *
     * DETECTION NAMES NO FACT, DELIBERATELY
     *
     * `showLeavePermissionDialog` (StopListFragment ~2137) emits no verdict
     * `TestEvent`, unlike the route dialog and the scanner, which publish
     * `SURFACE_ROUTE_DIALOG_READY` / `SURFACE_SCANNER_READY`. So no fact key on
     * either side of the wire reports this dialog's presence, and inventing one
     * here would produce exactly the failure the route dialog already caused once:
     * a fact with no producer, and a wait that times out against a dialog that was
     * on screen the whole time. The list stays empty until the app emits the
     * event; nothing waits on it, because the slice resolves the buttons directly.
     */
    surfaceKey: NESY_SURFACES.tourRoutingDialog,
    applicationRef: APP,
    kind: "DIALOG",
    displayName: "Tour start routing chooser",
    parentScreenRefs: [NESY_SCREENS.routeStopList],
    detection: {
      requiredFactKeys: [],
      deadlineMs: 15_000,
    },
    defaultPolicy: "IGNORE",
    // Same tier as the other macro-driven surfaces; the key breaks the tie.
    priority: 30,
    blocksProductVerdict: false,
  },
  {
    /**
     * The push-driven notification list, measured on device 2026-08-12.
     *
     * THE EXACT OPPOSITE OF THE ENTRY ABOVE, WHICH IS WHY IT SITS HERE
     *
     * `nesy.tour.routing-dialog` is IGNORE because the pack ASKED for it: a macro
     * taps `btn_out`, the dialog is the answer, and a dismissal handler would race
     * the tap that carries the business meaning. This surface is the mirror image.
     * Nothing in any plan asks for it. An FCM push ("Leaving Permission Approved by
     * your Dispatcher" / "... Rejected") reaches `MainActivity`'s LocalBroadcast
     * receiver (~line 275), which — with the foreground fragment being
     * StopListFragment and no saved notification detail — calls
     * `StopListFragment.setAndShowNotificationsList()`, inflating
     * `notification_dialog.xml` (`rv_notifications`, `btn_notification`,
     * `btn_exit`) into a `Dialog` over the stop list.
     *
     * It arrives unbidden, it covers the screen, and it must go before work can
     * continue: that is the definition of HANDLE, and it is what the four policies
     * separate. IGNORE would be a lie about a surface that swallows every tap
     * underneath it — measured repeatedly on 2026-08-12, `resolve-request-button`
     * answered `resolve:id=btn_out:NOT_FOUND` with the list on top, and the only
     * fix was a human running `tap_id btn_exit` before each re-run. FAIL would turn
     * a dispatcher approving a tour — the very thing the tour slice waits for —
     * into a red run. OPERATOR_ATTENTION would page a person for the app behaving
     * exactly as designed.
     *
     * DISMISSAL IS SAFE HERE, UNLIKE THE ROUTING CHOOSER
     *
     * `btn_exit` calls `dismiss()` and nothing else; the dialog's own
     * `setOnDismissListener` marks the notifications read and refreshes. No
     * business decision is encoded in the choice to close it, so a handler cannot
     * steal a step from the macro it interrupted. Note `setCancelable(false)`
     * (StopListFragment ~5417): BACK does not close this dialog, so tapping
     * `btn_exit` is the ONLY dismissal the product offers — a handler is not a
     * convenience, it is the only way out.
     *
     * SCREEN-SCOPED, NOT `"*"`
     *
     * Unlike the four global dialogs below, the receiver dispatches on the
     * foreground fragment and only StopListFragment gets the list (ChatFragment
     * gets messages; everything else gets nothing). The TIMING is unscheduled — a
     * push is not planned by any run — but the PLACE is fixed, and `"*"` would
     * invite the delivery and login slices to expect a dialog that cannot reach
     * them. The unscheduled timing is answered where it belongs: in the SHARED
     * interrupt policy — see `macros/common.ts`.
     */
    surfaceKey: NESY_SURFACES.notificationListDialog,
    applicationRef: APP,
    kind: "DIALOG",
    displayName: "Push notification list",
    parentScreenRefs: [NESY_SCREENS.routeStopList],
    detection: {
      requiredFactKeys: [NESY_FACTS.NOTIFICATION_LIST_PRESENT],
      deadlineMs: 10_000,
    },
    defaultPolicy: "HANDLE",
    // Above the route dialog (40) and the macro-driven surfaces (30): while this
    // is up it covers them, so handling it first is what makes them reachable at
    // all. Below the network dialog (50), which reports a product problem rather
    // than product noise.
    priority: 45,
    handlerMacroRef: NESY_SURFACE_HANDLER_MACROS.dismissNotificationList,
    // A push landing mid-run says nothing about the flow under test. The run that
    // dismissed it still tested what it set out to test.
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
