/**
 * ===========================================================================
 *  Interrupt handler macros  (Plan D.6B · 4B.15)
 *
 *  Two small macros, one per HANDLE-policy global surface. They exist so the
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
