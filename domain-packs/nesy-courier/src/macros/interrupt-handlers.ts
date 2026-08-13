/**
 * ===========================================================================
 *  Interrupt handler macros  (Plan D.6B · 4B.15)
 *
 *  Three small macros, one per HANDLE-policy interrupt surface. They exist so the
 *  surfaces can name a handler instead of every flow re-implementing dismissal:
 *  `validateDomainPackBundle` requires a `handlerMacroRef` for any surface whose
 *  `defaultPolicy` is HANDLE, precisely so that "handled" is not an aspiration.
 *
 *  Neither carries an expansion snapshot. They are not reference slices, and
 *  hand-authoring six more IR documents to prove a two-tap dismissal works would
 *  add review surface without adding safety.
 *
 *  Note what is NOT here: no handler for the mandatory-update or session-expired
 *  dialogs. Those are FATAL by policy. A handler for them would convert a real
 *  regression into a slightly slower green run, which is the single most
 *  expensive thing an interrupt handler can do.
 * ===========================================================================
 */

import type { MacroDefinition } from "@nesy/domain-pack-contracts";
import { NESY_FACTS } from "../registries/facts.js";
import { NESY_ACTIONS, NESY_SCREENS, NESY_SURFACES } from "../registries/screens.js";
import { NESY_TARGETS } from "../registries/targets.js";
import { NESY_DEFAULT_INTERRUPT_POLICY } from "./common.js";

export const NESY_GRANT_PERMISSION_MACRO: MacroDefinition = {
  macroKey: "nesy.macro.grant-permission",
  actionRef: NESY_ACTIONS.grantPermission,
  displayName: "Grant a system permission prompt",
  businessMeaning: "Accepts the system permission dialog so the flow under test can continue.",
  notResponsibleFor: [
    "whether the app degrades correctly when a permission is DENIED — that is a separate, deliberate test",
    "permissions granted before the run started",
  ],
  input: { fields: [{ name: "permissionName", type: "string", required: true }] },
  output: { fields: [{ name: "dialogDismissed", type: "boolean", factKey: NESY_FACTS.PERMISSION_DIALOG_PRESENT }] },
  preconditions: [
    { kind: "FACT_TRUE", ref: NESY_FACTS.PERMISSION_DIALOG_PRESENT, deadlineMs: 10_000, onUnmet: "SKIP" },
  ],
  allowedRegistryRefs: {
    screenRefs: [NESY_SCREENS.login, NESY_SCREENS.routeStopList, NESY_SCREENS.deliveryFlow],
    surfaceRefs: [NESY_SURFACES.permissionDialog],
    entityTypeRefs: [],
    targetRefs: [],
    factKeys: [NESY_FACTS.PERMISSION_DIALOG_PRESENT],
    queryRefs: [],
    adapterOperationRefs: [],
  },
  oracleTemplate: {
    continueGate: {
      noneOf: [NESY_FACTS.PERMISSION_DIALOG_PRESENT],
      deadlineMs: 10_000,
      unknownPolicy: "OPERATOR_ATTENTION",
    },
    finalOracle: {
      requirements: [
        {
          factKey: NESY_FACTS.PERMISSION_DIALOG_PRESENT,
          obligation: "REQUIRED",
          timing: "IMMEDIATE",
          onTimeout: "FAIL",
        },
      ],
    },
    notResponsibleFor: ["the behaviour of the flow that was interrupted"],
  },
  interruptPolicy: NESY_DEFAULT_INTERRUPT_POLICY,
  requiredCapabilityRefs: ["verdict.core.bridge.tap", "verdict.core.bridge.watch-fact"],
};

/**
 * Dismisses the push-driven notification list.
 *
 * WHY A HANDLER EXISTS AT ALL, MEASURED 2026-08-12
 *
 * An FCM push ("Leaving Permission Approved by your Dispatcher" / "... Rejected")
 * makes `MainActivity`'s LocalBroadcast receiver call
 * `StopListFragment.setAndShowNotificationsList()`, and the list lands over
 * whatever the run was doing. `resolve-request-button` then answered
 * `resolve:id=btn_out:NOT_FOUND` — not because `btn_out` had changed, but because
 * a RecyclerView of notifications was on top of it — and every re-run needed a
 * human to send `tap_id btn_exit` first. That manual tap is precisely what a
 * handler macro is: the pack's own answer to "an unbidden thing appeared".
 *
 * ONE TAP, AND NOTHING ELSE
 *
 * The listener behind `btn_exit` is a bare `dismiss()` (StopListFragment ~5412).
 * Marking notifications read and refreshing the stop list are the DIALOG's own
 * `setOnDismissListener` work, not this macro's — which is why the non-goals below
 * disclaim them: they happen because the product closed, not because the harness
 * asserted anything about them.
 *
 * `preconditions … onUnmet: "SKIP"` is the same shape the two handlers around it
 * use, and it is load-bearing rather than copied: nothing schedules a push, so the
 * usual state of this dialog is absent, and a handler that FAILED when its
 * interrupt was not there would turn every quiet run red.
 */
export const NESY_DISMISS_NOTIFICATION_LIST_MACRO: MacroDefinition = {
  macroKey: "nesy.macro.dismiss-notification-list",
  actionRef: NESY_ACTIONS.dismissNotificationList,
  displayName: "Dismiss the push notification list",
  businessMeaning:
    "Closes the notification list a push put over the stop list, so the interrupted flow can continue on the screen it was working.",
  notResponsibleFor: [
    "whether the push was correct, timely or correctly localized — that is the tour-approval slice's evidence, observed as APP.TOUR_APPROVAL_PUSH_RECEIVED",
    "the read/unread bookkeeping and stop-list refresh the dialog's own dismiss listener performs",
    "notification rows as navigation: tapping one scrolls the stop list elsewhere, which is a different flow and would move the run's ground",
  ],
  // No inputs. Which notification arrived does not change what dismissal does,
  // and an input nothing reads is an invitation to believe the handler is
  // selective when it is not.
  input: { fields: [] },
  output: { fields: [{ name: "dialogDismissed", type: "boolean", factKey: NESY_FACTS.NOTIFICATION_LIST_PRESENT }] },
  preconditions: [
    { kind: "FACT_TRUE", ref: NESY_FACTS.NOTIFICATION_LIST_PRESENT, deadlineMs: 10_000, onUnmet: "SKIP" },
  ],
  allowedRegistryRefs: {
    // The stop list alone: the receiver dispatches on the foreground fragment and
    // no other fragment is offered this dialog.
    screenRefs: [NESY_SCREENS.routeStopList],
    surfaceRefs: [NESY_SURFACES.notificationListDialog],
    entityTypeRefs: [],
    targetRefs: [NESY_TARGETS.notificationListExit],
    factKeys: [NESY_FACTS.NOTIFICATION_LIST_PRESENT],
    queryRefs: [],
    adapterOperationRefs: [],
  },
  oracleTemplate: {
    continueGate: {
      // The whole point: the interrupted macro may not resume while the list is
      // still up, because every target under it resolves to NOT_FOUND.
      noneOf: [NESY_FACTS.NOTIFICATION_LIST_PRESENT],
      deadlineMs: 10_000,
      unknownPolicy: "OPERATOR_ATTENTION",
    },
    finalOracle: {
      requirements: [
        {
          factKey: NESY_FACTS.NOTIFICATION_LIST_PRESENT,
          obligation: "REQUIRED",
          timing: "IMMEDIATE",
          onTimeout: "FAIL",
        },
      ],
    },
    notResponsibleFor: ["the behaviour of the flow that was interrupted"],
  },
  interruptPolicy: NESY_DEFAULT_INTERRUPT_POLICY,
  requiredCapabilityRefs: [
    "verdict.core.bridge.tap",
    "verdict.core.bridge.watch-fact",
    // Declared, unlike the two handlers above, because this one resolves a real
    // target (`btn_exit`) rather than acknowledging a system prompt.
    "verdict.core.bridge.resolve-target",
  ],
};

export const NESY_RECOVER_NETWORK_MACRO: MacroDefinition = {
  macroKey: "nesy.macro.recover-network",
  actionRef: NESY_ACTIONS.recoverNetwork,
  displayName: "Recover from the network error dialog",
  businessMeaning: "Dismisses the network error dialog and retries, so a transient connectivity blip does not end the run.",
  notResponsibleFor: [
    "proving offline behaviour is correct — that is the Bad Day profile's fault plan",
    "network conditioning or connectivity setup",
  ],
  input: { fields: [{ name: "retryCount", type: "number", required: false }] },
  output: { fields: [{ name: "dialogDismissed", type: "boolean", factKey: NESY_FACTS.NETWORK_DIALOG_PRESENT }] },
  preconditions: [{ kind: "FACT_TRUE", ref: NESY_FACTS.NETWORK_DIALOG_PRESENT, deadlineMs: 10_000, onUnmet: "SKIP" }],
  allowedRegistryRefs: {
    screenRefs: [NESY_SCREENS.routeStopList, NESY_SCREENS.deliveryFlow, NESY_SCREENS.endOfDay],
    surfaceRefs: [NESY_SURFACES.networkDialog],
    entityTypeRefs: [],
    targetRefs: [],
    factKeys: [NESY_FACTS.NETWORK_DIALOG_PRESENT],
    queryRefs: [],
    adapterOperationRefs: [],
  },
  oracleTemplate: {
    continueGate: {
      noneOf: [NESY_FACTS.NETWORK_DIALOG_PRESENT],
      deadlineMs: 15_000,
      unknownPolicy: "OPERATOR_ATTENTION",
    },
    finalOracle: {
      requirements: [
        { factKey: NESY_FACTS.NETWORK_DIALOG_PRESENT, obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "FAIL" },
      ],
    },
    notResponsibleFor: ["whether the underlying request eventually succeeded"],
  },
  interruptPolicy: NESY_DEFAULT_INTERRUPT_POLICY,
  requiredCapabilityRefs: ["verdict.core.bridge.tap", "verdict.core.bridge.watch-fact"],
};

