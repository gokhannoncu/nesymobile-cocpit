/**
 * ===========================================================================
 *  Independent test workflows and reusable fragments  (Plan D.6B · 4B.15)
 *
 *  The distinction the two lists below encode:
 *
 *  A REUSABLE FRAGMENT is a building block. `nesy.fragment.reach-open-stop`
 *  composes login, route selection and stop opening so that a delivery test does
 *  not have to restate them. It carries a Continue Gate — "are we there yet?" —
 *  and `producesTerminalVerdict: false`.
 *
 *  Why that flag is not negotiable: the fragment is reused by many workflows. If
 *  it could write a verdict, one shared helper would emit a product PASS for
 *  every test that used it, and the report would count those as coverage. Twelve
 *  tests would look like eighteen, and the extra six would all be the same login.
 *
 *  An INDEPENDENT TEST WORKFLOW is the thing that judges. It carries its own
 *  Final Oracle and `occurrenceScope: "INDEPENDENT"`, so two workflows sharing a
 *  fragment do not share its evidence — otherwise a failure inside the shared
 *  helper would taint a workflow that merely reused it.
 * ===========================================================================
 */

import type {
  IndependentTestWorkflowDefinition,
  ReusableFlowFragmentDefinition,
} from "@nesy/domain-pack-contracts";
import { NESY_COMPLETE_DELIVERY_MACRO } from "../macros/complete-delivery.js";
import { NESY_FULL_COURIER_GOLDEN_WORKFLOW_KEY } from "../macros/full-courier-golden.js";
import { NESY_LOGIN_MACRO } from "../macros/login.js";
import { NESY_OPEN_STOP_MACRO } from "../macros/open-stop.js";
import { NESY_PROCESS_PARCEL_MACRO } from "../macros/process-parcel.js";
import { NESY_SELECT_ROUTE_MACRO } from "../macros/select-route.js";
import { NESY_TOUR_APPROVAL_MACRO } from "../macros/tour-approval-lifecycle.js";
import { NESY_FACTS } from "../registries/facts.js";

export const NESY_FRAGMENTS = {
  reachOpenStop: "nesy.fragment.reach-open-stop",
} as const;

export const NESY_WORKFLOWS = {
  login: "nesy.workflow.login",
  selectRoute: "nesy.workflow.select-route",
  openStop: "nesy.workflow.open-stop",
  processParcel: "nesy.workflow.process-parcel",
  completeDelivery: "nesy.workflow.complete-delivery",
  tourApproval: "nesy.workflow.tour-approval-lifecycle",
  fullCourierGolden: NESY_FULL_COURIER_GOLDEN_WORKFLOW_KEY,
} as const;

export const NESY_COURIER_FRAGMENTS: readonly ReusableFlowFragmentDefinition[] = [
  {
    fragmentKey: NESY_FRAGMENTS.reachOpenStop,
    displayName: "Reach an opened stop",
    businessMeaning:
      "Composes login, route selection and stop opening so that downstream tests can start from an opened stop.",
    notResponsibleFor: [
      "producing any product verdict — a fragment reused by many workflows would otherwise emit one PASS per reuse",
      "judging whether login or route selection are correct; the dedicated workflows do that",
    ],
    macroRefs: [NESY_LOGIN_MACRO.macroKey, NESY_SELECT_ROUTE_MACRO.macroKey, NESY_OPEN_STOP_MACRO.macroKey],
    producesTerminalVerdict: false,
    continueGate: {
      allOf: [NESY_FACTS.ACTIVE_STOP_MATCHES],
      anyOf: [NESY_FACTS.TASK_LIST_READY, NESY_FACTS.DELIVERY_FLOW_READY],
      deadlineMs: 90_000,
      unknownPolicy: "FAIL",
    },
  },
];

export const NESY_COURIER_INDEPENDENT_WORKFLOWS: readonly IndependentTestWorkflowDefinition[] = [
  {
    workflowKey: NESY_WORKFLOWS.login,
    displayName: "Login works through the real UI",
    businessMeaning: NESY_LOGIN_MACRO.businessMeaning,
    notResponsibleFor: NESY_LOGIN_MACRO.notResponsibleFor,
    macroRefs: [NESY_LOGIN_MACRO.macroKey],
    // Deliberately no fragment: the login workflow cannot delegate login.
    fragmentRefs: [],
    occurrenceScope: "INDEPENDENT",
    oracleTemplate: NESY_LOGIN_MACRO.oracleTemplate,
    producesTerminalVerdict: true,
  },
  {
    workflowKey: NESY_WORKFLOWS.selectRoute,
    displayName: "Route selection reaches the backend",
    businessMeaning: NESY_SELECT_ROUTE_MACRO.businessMeaning,
    notResponsibleFor: NESY_SELECT_ROUTE_MACRO.notResponsibleFor,
    // ONE macro. Signing in is a PRECONDITION of route selection, not part of
    // it, and the slice already says so (`FACT_TRUE: APP.USER_SESSION_AVAILABLE`).
    // A launch profile installs that precondition — `nesy.launch.reuse-session`
    // or `prepared-session` — which is what those profiles exist for.
    //
    // Listing the login macro here instead made the workflow two expansion
    // snapshots, and an empty canvas can only auto-materialize from one, so the
    // workflow could not compile at all. It also mixed two verdicts into one run:
    // a login failure would have been reported as a route-selection failure.
    macroRefs: [NESY_SELECT_ROUTE_MACRO.macroKey],
    fragmentRefs: [],
    occurrenceScope: "INDEPENDENT",
    oracleTemplate: NESY_SELECT_ROUTE_MACRO.oracleTemplate,
    producesTerminalVerdict: true,
  },
  {
    workflowKey: NESY_WORKFLOWS.openStop,
    displayName: "Opening a stop opens the requested stop",
    businessMeaning: NESY_OPEN_STOP_MACRO.businessMeaning,
    notResponsibleFor: NESY_OPEN_STOP_MACRO.notResponsibleFor,
    macroRefs: [NESY_OPEN_STOP_MACRO.macroKey],
    fragmentRefs: [NESY_FRAGMENTS.reachOpenStop],
    occurrenceScope: "INDEPENDENT",
    oracleTemplate: NESY_OPEN_STOP_MACRO.oracleTemplate,
    producesTerminalVerdict: true,
  },
  {
    workflowKey: NESY_WORKFLOWS.processParcel,
    displayName: "A scanned parcel is accepted and persisted",
    businessMeaning: NESY_PROCESS_PARCEL_MACRO.businessMeaning,
    notResponsibleFor: NESY_PROCESS_PARCEL_MACRO.notResponsibleFor,
    macroRefs: [NESY_PROCESS_PARCEL_MACRO.macroKey],
    fragmentRefs: [NESY_FRAGMENTS.reachOpenStop],
    occurrenceScope: "INDEPENDENT",
    oracleTemplate: NESY_PROCESS_PARCEL_MACRO.oracleTemplate,
    producesTerminalVerdict: true,
  },
  {
    workflowKey: NESY_WORKFLOWS.completeDelivery,
    displayName: "A completed delivery is confirmed by the backend",
    businessMeaning: NESY_COMPLETE_DELIVERY_MACRO.businessMeaning,
    notResponsibleFor: NESY_COMPLETE_DELIVERY_MACRO.notResponsibleFor,
    // ONE macro, same reasoning as `selectRoute`: a scanned parcel is a
    // PRECONDITION of completing the delivery, installed by a `direct-state`
    // launch profile rather than replayed through the scan macro. Chaining them
    // also meant a scanning defect would be reported as a delivery failure.
    macroRefs: [NESY_COMPLETE_DELIVERY_MACRO.macroKey],
    fragmentRefs: [NESY_FRAGMENTS.reachOpenStop],
    occurrenceScope: "INDEPENDENT",
    oracleTemplate: NESY_COMPLETE_DELIVERY_MACRO.oracleTemplate,
    producesTerminalVerdict: true,
  },
  {
    workflowKey: NESY_WORKFLOWS.tourApproval,
    displayName: "Tour approval survives the courier/dispatcher handover",
    businessMeaning: NESY_TOUR_APPROVAL_MACRO.businessMeaning,
    notResponsibleFor: NESY_TOUR_APPROVAL_MACRO.notResponsibleFor,
    macroRefs: [NESY_TOUR_APPROVAL_MACRO.macroKey],
    fragmentRefs: [NESY_FRAGMENTS.reachOpenStop],
    occurrenceScope: "INDEPENDENT",
    oracleTemplate: NESY_TOUR_APPROVAL_MACRO.oracleTemplate,
    producesTerminalVerdict: true,
  },
  {
    workflowKey: NESY_WORKFLOWS.fullCourierGolden,
    displayName: "Full courier golden — nested stop/parcel FOR_EACH",
    businessMeaning:
      "Discovers stops and parcels at runtime and processes them via nested FOR_EACH (max 20 barcodes), without static node duplication.",
    notResponsibleFor: [
      "unrolling one IR node per barcode",
      "treating offline queue as a separate evidence plane",
      "Maestro orchestration",
    ],
    macroRefs: [
      NESY_LOGIN_MACRO.macroKey,
      NESY_SELECT_ROUTE_MACRO.macroKey,
      NESY_OPEN_STOP_MACRO.macroKey,
      NESY_PROCESS_PARCEL_MACRO.macroKey,
      NESY_COMPLETE_DELIVERY_MACRO.macroKey,
    ],
    fragmentRefs: [NESY_FRAGMENTS.reachOpenStop],
    occurrenceScope: "INDEPENDENT",
    oracleTemplate: NESY_COMPLETE_DELIVERY_MACRO.oracleTemplate,
    producesTerminalVerdict: true,
  },
];
