/**
 * ===========================================================================
 *  Nesy Courier Screen Registry  (Plan D.6B/D.6C · 4B.15)
 *
 *  Seven screens: places a courier can BE. Every dialog, sheet, scanner and
 *  system prompt lives in `surfaces.ts` instead — see the header there for why
 *  that split is load-bearing rather than tidy.
 *
 *  Every readiness contract names facts. None of them names a duration. A screen
 *  declared "ready after 900ms" passes when the app is late and fails when the
 *  device is slow, and both outcomes get blamed on the wrong thing.
 * ===========================================================================
 */

import type { ScreenDefinition } from "@nesy/domain-pack-contracts";
import { NESY_COURIER_APPLICATION_KEY } from "./application.js";
import { NESY_FACTS } from "./facts.js";

export const NESY_SCREENS = {
  login: "nesy.auth.login",
  routeStopList: "nesy.route.stop-list",
  stopTaskList: "nesy.stop.task-list",
  deliveryFlow: "nesy.delivery.flow",
  pickupFlow: "nesy.pickup.flow",
  vehicleLoading: "nesy.vehicle-loading",
  endOfDay: "nesy.end-of-day",
} as const;

export const NESY_SURFACES = {
  routeSelectionDialog: "nesy.route.selection-dialog",
  mandatoryUpdateDialog: "nesy.mandatory-update-dialog",
  sessionExpiredDialog: "nesy.session-expired-dialog",
  permissionDialog: "nesy.permission-dialog",
  networkDialog: "nesy.network-dialog",
  scannerSurface: "nesy.scanner.surface",
  paymentSurface: "nesy.payment.surface",
  fiscalSurface: "nesy.fiscal.surface",
} as const;

export const NESY_ACTIONS = {
  login: "nesy.action.login",
  selectRoute: "nesy.action.select-route",
  openStop: "nesy.action.open-stop",
  processParcel: "nesy.action.process-parcel",
  completeDelivery: "nesy.action.complete-delivery",
  tourApprovalLifecycle: "nesy.action.tour-approval-lifecycle",
  grantPermission: "nesy.action.grant-permission",
  recoverNetwork: "nesy.action.recover-network",
} as const;

const APP = NESY_COURIER_APPLICATION_KEY;
const MAIN_ACTIVITY = "com.arasdigital.nesymobile.main.MainActivity";

export const NESY_COURIER_SCREENS: readonly ScreenDefinition[] = [
  {
    screenKey: NESY_SCREENS.login,
    applicationRef: APP,
    displayName: "Login",
    runtimeImplementation: { kind: "FRAGMENT", hostActivity: MAIN_ACTIVITY, fragmentTag: "LoginFragment" },
    entryStrategies: [
      {
        kind: "WORKFLOW_ENTRY",
        entryRef: "nesy.entry.cold-launch",
        provesUserPath: true,
        requiredCapabilityRefs: ["verdict.core.bridge.watch-fact"],
      },
    ],
    readiness: {
      requiredFactKeys: [NESY_FACTS.LOGIN_SCREEN_READY],
      noneOfFactKeys: [NESY_FACTS.LOADING_BLOCKER_PRESENT],
      deadlineMs: 30_000,
      stableForMs: 300,
    },
    supportedSurfaceRefs: [],
    supportedActionRefs: [NESY_ACTIONS.login],
    designRevision: "2026-06-rev3",
  },
  {
    screenKey: NESY_SCREENS.routeStopList,
    applicationRef: APP,
    displayName: "Route stop list",
    runtimeImplementation: { kind: "COMPOSE", hostActivity: MAIN_ACTIVITY, routeKey: "route/list" },
    entryStrategies: [
      {
        kind: "WORKFLOW_ENTRY",
        entryRef: "nesy.entry.post-login",
        provesUserPath: true,
        requiredCapabilityRefs: ["verdict.core.bridge.watch-fact"],
      },
      {
        // A gateway shortcut. `provesUserPath: false` is what stops a run that
        // arrived this way from claiming the navigation works.
        kind: "TEST_GATEWAY",
        entryRef: "nesy.entry.gateway-route-list",
        provesUserPath: false,
        requiredCapabilityRefs: ["domain.nesy.adapter.direct-state"],
      },
    ],
    readiness: {
      requiredFactKeys: [NESY_FACTS.ROUTE_LIST_READY, NESY_FACTS.AVAILABLE_STOPS_LOADED],
      noneOfFactKeys: [NESY_FACTS.LOADING_BLOCKER_PRESENT],
      deadlineMs: 25_000,
      stableForMs: 250,
    },
    supportedSurfaceRefs: [NESY_SURFACES.routeSelectionDialog],
    supportedActionRefs: [NESY_ACTIONS.selectRoute, NESY_ACTIONS.openStop],
    designRevision: "2026-06-rev3",
  },
  {
    screenKey: NESY_SCREENS.stopTaskList,
    applicationRef: APP,
    displayName: "Stop task list",
    runtimeImplementation: { kind: "COMPOSE", hostActivity: MAIN_ACTIVITY, routeKey: "route/tasks" },
    entryStrategies: [
      {
        kind: "WORKFLOW_ENTRY",
        entryRef: "nesy.entry.open-from-list",
        provesUserPath: true,
        requiredCapabilityRefs: ["verdict.core.bridge.tap"],
      },
    ],
    readiness: {
      requiredFactKeys: [NESY_FACTS.TASK_LIST_READY],
      anyOfFactKeys: [NESY_FACTS.TASK_LIST_READY, NESY_FACTS.DELIVERY_FLOW_READY],
      noneOfFactKeys: [NESY_FACTS.LOADING_BLOCKER_PRESENT],
      deadlineMs: 20_000,
      stableForMs: 250,
    },
    supportedSurfaceRefs: [NESY_SURFACES.scannerSurface],
    supportedActionRefs: [NESY_ACTIONS.processParcel],
    designRevision: "2026-06-rev3",
  },
  {
    screenKey: NESY_SCREENS.deliveryFlow,
    applicationRef: APP,
    displayName: "Delivery flow",
    runtimeImplementation: { kind: "FRAGMENT", hostActivity: MAIN_ACTIVITY, fragmentTag: "delivery-flow" },
    entryStrategies: [
      {
        kind: "WORKFLOW_ENTRY",
        entryRef: "nesy.entry.task-selected",
        provesUserPath: true,
        requiredCapabilityRefs: ["verdict.core.bridge.tap"],
      },
    ],
    readiness: {
      requiredFactKeys: [NESY_FACTS.DELIVERY_FLOW_READY],
      noneOfFactKeys: [NESY_FACTS.LOADING_BLOCKER_PRESENT],
      deadlineMs: 20_000,
    },
    supportedSurfaceRefs: [
      NESY_SURFACES.scannerSurface,
      NESY_SURFACES.paymentSurface,
      NESY_SURFACES.fiscalSurface,
    ],
    supportedActionRefs: [NESY_ACTIONS.processParcel, NESY_ACTIONS.completeDelivery],
    designRevision: "2026-06-rev3",
  },
  {
    screenKey: NESY_SCREENS.pickupFlow,
    applicationRef: APP,
    displayName: "Pickup flow",
    runtimeImplementation: { kind: "FRAGMENT", hostActivity: MAIN_ACTIVITY, fragmentTag: "pickup-flow" },
    entryStrategies: [
      {
        kind: "WORKFLOW_ENTRY",
        entryRef: "nesy.entry.task-selected",
        provesUserPath: true,
        requiredCapabilityRefs: ["verdict.core.bridge.tap"],
      },
    ],
    readiness: {
      requiredFactKeys: [NESY_FACTS.PICKUP_FLOW_READY],
      deadlineMs: 20_000,
    },
    supportedSurfaceRefs: [NESY_SURFACES.scannerSurface],
    supportedActionRefs: [NESY_ACTIONS.processParcel],
    designRevision: "2026-06-rev3",
  },
  {
    screenKey: NESY_SCREENS.vehicleLoading,
    applicationRef: APP,
    displayName: "Vehicle loading",
    runtimeImplementation: { kind: "FRAGMENT", hostActivity: MAIN_ACTIVITY, fragmentTag: "VehicleLoadingFragment" },
    entryStrategies: [
      {
        kind: "DEEP_LINK",
        entryRef: "nesy.link.vehicle-loading",
        provesUserPath: false,
        requiredCapabilityRefs: ["domain.nesy.adapter.direct-state"],
      },
      {
        kind: "WORKFLOW_ENTRY",
        entryRef: "nesy.entry.loading-from-menu",
        provesUserPath: true,
        requiredCapabilityRefs: ["verdict.core.bridge.tap"],
      },
    ],
    readiness: {
      requiredFactKeys: [NESY_FACTS.VEHICLE_LOADING_READY],
      deadlineMs: 20_000,
    },
    supportedSurfaceRefs: [NESY_SURFACES.scannerSurface],
    supportedActionRefs: [NESY_ACTIONS.processParcel],
    designRevision: "2026-06-rev3",
  },
  {
    screenKey: NESY_SCREENS.endOfDay,
    applicationRef: APP,
    displayName: "End of day",
    runtimeImplementation: { kind: "COMPOSE", hostActivity: MAIN_ACTIVITY, routeKey: "day/close" },
    entryStrategies: [
      {
        kind: "WORKFLOW_ENTRY",
        entryRef: "nesy.entry.end-of-day-from-menu",
        provesUserPath: true,
        requiredCapabilityRefs: ["verdict.core.bridge.tap"],
      },
    ],
    readiness: {
      requiredFactKeys: [NESY_FACTS.END_OF_DAY_READY],
      deadlineMs: 20_000,
    },
    supportedSurfaceRefs: [],
    supportedActionRefs: [NESY_ACTIONS.tourApprovalLifecycle],
    designRevision: "2026-06-rev3",
  },
];
