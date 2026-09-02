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
import {
  NESY_FULL_COURIER_DAY_MACRO,
  NESY_FULL_COURIER_DAY_WORKFLOW_KEY,
} from "../macros/full-courier-day.js";
import { NESY_FULL_COURIER_GOLDEN_WORKFLOW_KEY } from "../macros/full-courier-golden.js";
import { NESY_LOGIN_MACRO, NESY_LOGIN_REJECTED_MACRO } from "../macros/login.js";
import { NESY_LOGIN_AND_SELECT_ROUTE_MACRO, NESY_LOGIN_AND_SELECT_ROUTE_WORKFLOW_KEY } from "../macros/login-and-select-route.js";
import { NESY_OPEN_STOP_MACRO } from "../macros/open-stop.js";
import { NESY_PROCESS_PARCEL_MACRO } from "../macros/process-parcel.js";
import { NESY_LOAD_TO_VEHICLE_MACRO } from "../macros/load-to-vehicle.js";
import { NESY_SELECT_ROUTE_MACRO } from "../macros/select-route.js";
import { NESY_TOUR_APPROVAL_MACRO } from "../macros/tour-approval-lifecycle.js";
import { NESY_FACTS } from "../registries/facts.js";

export const NESY_FRAGMENTS = {
  reachOpenStop: "nesy.fragment.reach-open-stop",
} as const;

export const NESY_WORKFLOWS = {
  login: "nesy.workflow.login",
  loginRejected: "nesy.workflow.login-rejected",
  selectRoute: "nesy.workflow.select-route",
  loginAndSelectRoute: NESY_LOGIN_AND_SELECT_ROUTE_WORKFLOW_KEY,
  loadToVehicle: "nesy.workflow.load-to-vehicle",
  openStop: "nesy.workflow.open-stop",
  processParcel: "nesy.workflow.process-parcel",
  completeDelivery: "nesy.workflow.complete-delivery",
  tourApproval: "nesy.workflow.tour-approval-lifecycle",
  fullCourierDay: NESY_FULL_COURIER_DAY_WORKFLOW_KEY,
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
    displayName: "UI Login Success",
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
    workflowKey: NESY_WORKFLOWS.loginRejected,
    displayName: "Invalid PIN Rejection",
    businessMeaning: NESY_LOGIN_REJECTED_MACRO.businessMeaning,
    notResponsibleFor: NESY_LOGIN_REJECTED_MACRO.notResponsibleFor,
    macroRefs: [NESY_LOGIN_REJECTED_MACRO.macroKey],
    fragmentRefs: [],
    occurrenceScope: "INDEPENDENT",
    oracleTemplate: NESY_LOGIN_REJECTED_MACRO.oracleTemplate,
    producesTerminalVerdict: true,
  },
  {
    workflowKey: NESY_WORKFLOWS.selectRoute,
    displayName: "Backend Route Assignment",
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
    workflowKey: NESY_WORKFLOWS.loginAndSelectRoute,
    displayName: "Login Route Selection",
    businessMeaning: NESY_LOGIN_AND_SELECT_ROUTE_MACRO.businessMeaning,
    notResponsibleFor: NESY_LOGIN_AND_SELECT_ROUTE_MACRO.notResponsibleFor,
    // ONE composed macro. Listing login + select-route separately would be two
    // expansion snapshots, which an empty canvas cannot auto-materialize. The
    // composed snapshot is the stitch: PIN login continues into the route dialog.
    macroRefs: [NESY_LOGIN_AND_SELECT_ROUTE_MACRO.macroKey],
    fragmentRefs: [],
    occurrenceScope: "INDEPENDENT",
    oracleTemplate: NESY_LOGIN_AND_SELECT_ROUTE_MACRO.oracleTemplate,
    producesTerminalVerdict: true,
  },
  {
    workflowKey: NESY_WORKFLOWS.loadToVehicle,
    displayName: "Parcel Schedule Entry",
    businessMeaning: NESY_LOAD_TO_VEHICLE_MACRO.businessMeaning,
    notResponsibleFor: NESY_LOAD_TO_VEHICLE_MACRO.notResponsibleFor,
    // ONE macro, and no fragment. Having a route selected is a PRECONDITION —
    // declared on the macro as `FACT_TRUE: APP.SELECTED_ROUTE_OBSERVED` and
    // installed by a `reuse-session` launch profile — not a leg of this test. The
    // `reachOpenStop` fragment would additionally open a stop, which is work that
    // cannot happen before anything is loaded.
    macroRefs: [NESY_LOAD_TO_VEHICLE_MACRO.macroKey],
    fragmentRefs: [],
    occurrenceScope: "INDEPENDENT",
    oracleTemplate: NESY_LOAD_TO_VEHICLE_MACRO.oracleTemplate,
    producesTerminalVerdict: true,
  },
  {
    workflowKey: NESY_WORKFLOWS.openStop,
    displayName: "Target Stop Opening",
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
    displayName: "Parcel Scan Persistence",
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
    displayName: "Backend Delivery Confirmation",
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
    displayName: "Tour Approval Continuity",
    businessMeaning: NESY_TOUR_APPROVAL_MACRO.businessMeaning,
    notResponsibleFor: NESY_TOUR_APPROVAL_MACRO.notResponsibleFor,
    macroRefs: [NESY_TOUR_APPROVAL_MACRO.macroKey],
    fragmentRefs: [NESY_FRAGMENTS.reachOpenStop],
    occurrenceScope: "INDEPENDENT",
    oracleTemplate: NESY_TOUR_APPROVAL_MACRO.oracleTemplate,
    producesTerminalVerdict: true,
  },
  {
    workflowKey: NESY_WORKFLOWS.fullCourierDay,
    displayName: "Full Courier Day",
    businessMeaning: NESY_FULL_COURIER_DAY_MACRO.businessMeaning,
    notResponsibleFor: NESY_FULL_COURIER_DAY_MACRO.notResponsibleFor,
    // ONE composed macro, for the same reason as `loginAndSelectRoute`: seven
    // macroRefs would be seven expansion snapshots and an empty canvas can only
    // auto-materialize from one. The composed snapshot IS the stitch — see the
    // macro header for the four decisions a concatenation would have got wrong.
    macroRefs: [NESY_FULL_COURIER_DAY_MACRO.macroKey],
    // No fragment. `reachOpenStop` composes login + select-route + open-stop, so
    // reusing it here would drive login and route selection TWICE and would open
    // a stop before anything had been loaded into the schedule.
    fragmentRefs: [],
    occurrenceScope: "INDEPENDENT",
    oracleTemplate: NESY_FULL_COURIER_DAY_MACRO.oracleTemplate,
    producesTerminalVerdict: true,
  },
  {
    workflowKey: NESY_WORKFLOWS.fullCourierGolden,
    displayName: "Nested Parcel Processing",
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
