/**
 * ===========================================================================
 *  Nesy Courier semantic actions  (Plan D.6B · 4B.15)
 *
 *  A semantic action is the business-meaningful unit a human names; a macro is
 *  one concrete way of performing it. They are separate so that a second macro
 *  for the same action — a deep-link variant, a different app version's path —
 *  does not fork the business vocabulary.
 *
 *  Every entry carries `notResponsibleFor`, and `validateDomainPackBundle`
 *  rejects an empty one. An action that lists only what it covers reads as
 *  covering everything.
 * ===========================================================================
 */

import type { SemanticActionDefinition } from "@nesy/domain-pack-contracts";
import { NESY_COURIER_APPLICATION_KEY } from "./application.js";
import { NESY_ENTITIES } from "./entities.js";
import { NESY_ACTIONS, NESY_SCREENS, NESY_SURFACES } from "./screens.js";
import { NESY_TARGETS } from "./targets.js";

const APP = NESY_COURIER_APPLICATION_KEY;

export const NESY_COURIER_SEMANTIC_ACTIONS: readonly SemanticActionDefinition[] = [
  {
    actionKey: NESY_ACTIONS.login,
    applicationRef: APP,
    displayName: "Sign in",
    businessMeaning: "A courier authenticates and obtains a working session.",
    notResponsibleFor: ["password reset", "biometric re-authentication", "session refresh"],
    screenRefs: [NESY_SCREENS.login],
    surfaceRefs: [],
    entityTypeRefs: [],
    targetRefs: [NESY_TARGETS.loginUserField, NESY_TARGETS.loginPasswordField, NESY_TARGETS.loginSubmit],
    requiredCapabilityRefs: ["verdict.core.bridge.set-text", "verdict.core.bridge.tap"],
  },
  {
    actionKey: NESY_ACTIONS.selectRoute,
    applicationRef: APP,
    displayName: "Select route",
    businessMeaning: "A courier chooses the route they will work.",
    notResponsibleFor: ["route planning", "reassignment away from another courier"],
    screenRefs: [NESY_SCREENS.routeStopList],
    surfaceRefs: [NESY_SURFACES.routeSelectionDialog],
    entityTypeRefs: [NESY_ENTITIES.route],
    targetRefs: [NESY_TARGETS.routeRow, NESY_TARGETS.routeDialogConfirm],
    requiredCapabilityRefs: ["verdict.core.bridge.tap"],
  },
  {
    actionKey: NESY_ACTIONS.openStop,
    applicationRef: APP,
    displayName: "Open stop",
    businessMeaning: "A courier opens a specific stop, identified by business key.",
    notResponsibleFor: ["work performed inside the stop", "stop list ordering", "creating the stop"],
    screenRefs: [NESY_SCREENS.routeStopList, NESY_SCREENS.stopTaskList, NESY_SCREENS.deliveryFlow],
    surfaceRefs: [],
    entityTypeRefs: [NESY_ENTITIES.stop],
    targetRefs: [NESY_TARGETS.stopRow],
    requiredCapabilityRefs: ["verdict.core.bridge.tap", "verdict.core.bridge.resolve-target"],
  },
  {
    actionKey: NESY_ACTIONS.processParcel,
    applicationRef: APP,
    displayName: "Process parcel",
    businessMeaning: "A courier scans a parcel and the app accepts it.",
    notResponsibleFor: ["camera hardware", "delivery outcome", "payment"],
    screenRefs: [NESY_SCREENS.deliveryFlow, NESY_SCREENS.stopTaskList, NESY_SCREENS.pickupFlow, NESY_SCREENS.vehicleLoading],
    surfaceRefs: [NESY_SURFACES.scannerSurface],
    entityTypeRefs: [NESY_ENTITIES.parcel, NESY_ENTITIES.task, NESY_ENTITIES.shipment],
    targetRefs: [NESY_TARGETS.scanTrigger],
    requiredCapabilityRefs: ["domain.nesy.scanner.inject"],
  },
  {
    actionKey: NESY_ACTIONS.completeDelivery,
    applicationRef: APP,
    displayName: "Complete delivery",
    businessMeaning: "A courier completes a delivery and the backend records it.",
    notResponsibleFor: ["payment collection", "fiscal receipts", "failure reason codes"],
    screenRefs: [NESY_SCREENS.deliveryFlow],
    surfaceRefs: [NESY_SURFACES.paymentSurface, NESY_SURFACES.fiscalSurface],
    entityTypeRefs: [NESY_ENTITIES.shipment, NESY_ENTITIES.pendingOperation],
    targetRefs: [NESY_TARGETS.deliveryCompleteButton],
    requiredCapabilityRefs: ["verdict.core.bridge.tap", "verdict.core.remote.allowlisted-operation"],
  },
  {
    actionKey: NESY_ACTIONS.tourApprovalLifecycle,
    applicationRef: APP,
    displayName: "Tour approval lifecycle",
    businessMeaning: "A courier requests tour approval and a dispatcher approves it.",
    notResponsibleFor: ["rejection flows", "dispatcher authorisation rules", "settlement"],
    screenRefs: [NESY_SCREENS.endOfDay],
    surfaceRefs: [],
    entityTypeRefs: [NESY_ENTITIES.route, NESY_ENTITIES.tourApprovalRequest],
    targetRefs: [NESY_TARGETS.tourApprovalRequestButton],
    requiredCapabilityRefs: ["domain.nesy.backoffice.approval-operations"],
  },
  {
    actionKey: NESY_ACTIONS.grantPermission,
    applicationRef: APP,
    displayName: "Grant permission",
    businessMeaning: "Accepts a system permission prompt so a flow can continue.",
    notResponsibleFor: ["denied-permission degradation, which is a deliberate separate test"],
    screenRefs: [NESY_SCREENS.login, NESY_SCREENS.routeStopList, NESY_SCREENS.deliveryFlow],
    surfaceRefs: [NESY_SURFACES.permissionDialog],
    entityTypeRefs: [],
    targetRefs: [],
    requiredCapabilityRefs: ["verdict.core.bridge.tap"],
  },
  {
    actionKey: NESY_ACTIONS.recoverNetwork,
    applicationRef: APP,
    displayName: "Recover network",
    businessMeaning: "Dismisses a transient network error dialog and retries.",
    notResponsibleFor: ["proving offline correctness, which belongs to the Bad Day fault plan"],
    screenRefs: [NESY_SCREENS.routeStopList, NESY_SCREENS.deliveryFlow, NESY_SCREENS.endOfDay],
    surfaceRefs: [NESY_SURFACES.networkDialog],
    entityTypeRefs: [],
    targetRefs: [],
    requiredCapabilityRefs: ["verdict.core.bridge.tap"],
  },
];
