/**
 * ===========================================================================
 *  Nesy Back-office Adapter allowlist  (Plan D.6C · 4B.16)
 *
 *  `TOUR_APPROVAL_LIFECYCLE` is a two-actor flow: the courier asks for approval
 *  in the mobile UI, and a dispatcher or supervisor approves it elsewhere. The
 *  test has to act as that second person, and this file is the entire vocabulary
 *  it may use to do so.
 *
 *  Three properties, all of them enforced by
 *  `validateRemoteAdapterOperation`:
 *
 *    ALLOWLISTED — an operation exists in this list or it cannot be called. No
 *    url, method, header, body or script field exists anywhere for an endpoint to
 *    hide in.
 *
 *    TYPED — inputs and outputs are declared, and a VALIDATION output must carry
 *    BOTH an entity status path and a correlation path. That requirement is why
 *    `approve-tour-request` below is deliberately NOT a validation source: its
 *    HTTP 2xx says a request was accepted and nothing else.
 *
 *    AUDITED — every mutation records its request. A back-office mutation made by
 *    a test harness with no trace is indistinguishable from an incident, and
 *    someone will eventually have to prove which it was.
 *
 *  So business success takes THREE observations, not one: the courier's request
 *  event on the APP plane, the created record, and the approved status — all
 *  correlated (see `evidence/derived.ts`).
 * ===========================================================================
 */

import type { RemoteAdapterDefinition } from "@nesy/domain-pack-contracts";
import { NESY_ENTITIES } from "../registries/entities.js";
import { NESY_FACTS } from "../registries/facts.js";

export const NESY_BACKOFFICE_ADAPTER_REF = "nesy.backoffice";

export const NESY_BACKOFFICE_OPERATIONS = {
  approveTourRequest: "nesy.backoffice.approve-tour-request",
  readTourApprovalRequest: "nesy.backoffice.read-tour-approval-request",
  readTourApprovalStatus: "nesy.backoffice.read-tour-approval-status",
  readSession: "nesy.backoffice.read-session",
  readRoutes: "nesy.backoffice.read-routes",
  readDeliveryStatus: "nesy.backoffice.read-delivery-status",
  readRouteAssignment: "nesy.backoffice.read-route-assignment",
  seedRouteAssignment: "nesy.backoffice.seed-route-assignment",
  releaseRouteAssignment: "nesy.backoffice.release-route-assignment",
} as const;

export const NESY_BACKOFFICE_ADAPTER: RemoteAdapterDefinition = {
  adapterRef: NESY_BACKOFFICE_ADAPTER_REF,
  displayName: "Nesy Back-office Adapter",
  systemName: "Nesy dispatch back office",
  requiredCapabilityRefs: ["domain.nesy.backoffice.approval-operations", "verdict.core.remote.allowlisted-operation"],
  operations: [
    {
      // The dispatcher's action. Note `transportSuccessOnly: true` and the empty
      // outputs: accepting the request is not the same as the record being
      // approved, and this operation is honest about which of the two it saw.
      operationRef: NESY_BACKOFFICE_OPERATIONS.approveTourRequest,
      displayName: "Approve a tour approval request",
      businessMeaning:
        "A dispatcher or supervisor approves the courier's end-of-day tour approval request. Acknowledgement of the call is NOT business success; the two read operations below establish that.",
      role: "ACTOR_ACTION",
      actorRole: "DISPATCHER",
      effectClass: "IDEMPOTENT_MUTATION",
      idempotencyClass: "KEYED",
      inputs: [
        { name: "approvalRequest", type: "entityRef", required: true, entityTypeRef: NESY_ENTITIES.tourApprovalRequest },
        { name: "approverComment", type: "string", required: false },
      ],
      outputs: [],
      audit: { recordRequest: true, recordResponse: true, redactFields: ["approverComment", "approverName"] },
      allowedEnvironments: ["qa", "staging"],
      transportSuccessOnly: true,
    },
    {
      operationRef: NESY_BACKOFFICE_OPERATIONS.readTourApprovalRequest,
      displayName: "Read the tour approval request record",
      businessMeaning: "First of two backend fact checks: the courier's request actually created a record.",
      role: "VALIDATION",
      actorRole: "BACK_OFFICE_SYSTEM",
      effectClass: "READ_ONLY",
      idempotencyClass: "NATURALLY_IDEMPOTENT",
      inputs: [
        { name: "approvalRequest", type: "entityRef", required: true, entityTypeRef: NESY_ENTITIES.tourApprovalRequest },
      ],
      outputs: [
        {
          factKey: NESY_FACTS.TOUR_APPROVAL_REQUEST_CREATED,
          responsePath: "request.exists",
          entityStatusPath: "request.status",
          correlationPath: "request.scheduleId",
        },
      ],
      audit: { recordRequest: true, recordResponse: true, redactFields: ["request.requesterName"] },
      allowedEnvironments: ["qa", "staging"],
    },
    {
      operationRef: NESY_BACKOFFICE_OPERATIONS.readTourApprovalStatus,
      displayName: "Read the tour approval status",
      businessMeaning: "Second of two backend fact checks: the record reached APPROVED for this request.",
      role: "VALIDATION",
      actorRole: "BACK_OFFICE_SYSTEM",
      effectClass: "READ_ONLY",
      idempotencyClass: "NATURALLY_IDEMPOTENT",
      inputs: [
        { name: "approvalRequest", type: "entityRef", required: true, entityTypeRef: NESY_ENTITIES.tourApprovalRequest },
      ],
      outputs: [
        {
          factKey: NESY_FACTS.TOUR_APPROVAL_STATUS_APPROVED,
          responsePath: "approval.statusIsApproved",
          entityStatusPath: "approval.status",
          correlationPath: "approval.scheduleId",
        },
      ],
      audit: { recordRequest: true, recordResponse: true, redactFields: ["approval.approverName"] },
      allowedEnvironments: ["qa", "staging"],
    },
    {
      operationRef: NESY_BACKOFFICE_OPERATIONS.readSession,
      displayName: "Read the backend session record",
      businessMeaning: "Confirms the backend actually authenticated this sign-in, rather than the app merely navigating away from the login screen.",
      role: "VALIDATION",
      actorRole: "BACK_OFFICE_SYSTEM",
      effectClass: "READ_ONLY",
      idempotencyClass: "NATURALLY_IDEMPOTENT",
      inputs: [{ name: "sessionCorrelationId", type: "string", required: true }],
      outputs: [
        {
          factKey: NESY_FACTS.AUTH_ACCEPTED,
          responsePath: "session.accepted",
          entityStatusPath: "session.status",
          correlationPath: "session.correlationId",
        },
      ],
      audit: { recordRequest: true, recordResponse: true, redactFields: ["session.tokenHint"] },
      allowedEnvironments: ["qa", "staging"],
    },
    {
      operationRef: NESY_BACKOFFICE_OPERATIONS.readRoutes,
      displayName: "Read the routes offered to this courier",
      businessMeaning: "Confirms the backend offers at least one route, so an empty route dialog is diagnosed as a backend state rather than a UI defect.",
      role: "VALIDATION",
      actorRole: "BACK_OFFICE_SYSTEM",
      effectClass: "READ_ONLY",
      idempotencyClass: "NATURALLY_IDEMPOTENT",
      inputs: [{ name: "courierCorrelationId", type: "string", required: true }],
      outputs: [
        {
          factKey: NESY_FACTS.ROUTES_AVAILABLE,
          responsePath: "routes.available",
          entityStatusPath: "routes.status",
          correlationPath: "routes.correlationId",
        },
      ],
      audit: { recordRequest: true, recordResponse: true, redactFields: ["routes.items[].assignedCourierName"] },
      allowedEnvironments: ["qa", "staging"],
    },
    {
      operationRef: NESY_BACKOFFICE_OPERATIONS.readDeliveryStatus,
      displayName: "Read the backend delivery status",
      businessMeaning: "Confirms the backend recorded the delivery for this shipment.",
      role: "VALIDATION",
      actorRole: "BACK_OFFICE_SYSTEM",
      effectClass: "READ_ONLY",
      idempotencyClass: "NATURALLY_IDEMPOTENT",
      inputs: [{ name: "shipment", type: "entityRef", required: true, entityTypeRef: NESY_ENTITIES.shipment }],
      outputs: [
        {
          factKey: NESY_FACTS.DELIVERY_STATUS_COMPLETED,
          responsePath: "delivery.completed",
          entityStatusPath: "delivery.status",
          correlationPath: "delivery.correlationId",
        },
      ],
      audit: { recordRequest: true, recordResponse: true, redactFields: ["delivery.recipientName"] },
      allowedEnvironments: ["qa", "staging"],
    },
    {
      operationRef: NESY_BACKOFFICE_OPERATIONS.readRouteAssignment,
      displayName: "Read the route assignment",
      businessMeaning: "Confirms the backend considers this route assigned to this courier.",
      role: "VALIDATION",
      actorRole: "BACK_OFFICE_SYSTEM",
      effectClass: "READ_ONLY",
      idempotencyClass: "NATURALLY_IDEMPOTENT",
      inputs: [{ name: "route", type: "entityRef", required: true, entityTypeRef: NESY_ENTITIES.route }],
      outputs: [
        {
          factKey: NESY_FACTS.ROUTE_ASSIGNED,
          responsePath: "assignment.exists",
          entityStatusPath: "assignment.status",
          correlationPath: "assignment.routeCode",
        },
      ],
      audit: { recordRequest: true, recordResponse: true, redactFields: ["assignment.assignedCourierName"] },
      allowedEnvironments: ["qa", "staging"],
    },
    {
      // SETUP with no outputs. A precondition seeder that also produced evidence
      // would let a run validate its own fixture instead of the product.
      operationRef: NESY_BACKOFFICE_OPERATIONS.seedRouteAssignment,
      displayName: "Seed a route assignment",
      businessMeaning: "Arranges the precondition that a route exists and is assigned. Produces no evidence.",
      role: "SETUP",
      actorRole: "SERVICE_ACCOUNT",
      effectClass: "IDEMPOTENT_MUTATION",
      idempotencyClass: "KEYED",
      inputs: [
        { name: "route", type: "entityRef", required: true, entityTypeRef: NESY_ENTITIES.route },
        { name: "stopCount", type: "number", required: true },
      ],
      outputs: [],
      audit: { recordRequest: true, recordResponse: true, redactFields: [] },
      allowedEnvironments: ["qa", "staging"],
    },
    {
      operationRef: NESY_BACKOFFICE_OPERATIONS.releaseRouteAssignment,
      displayName: "Release a seeded route assignment",
      businessMeaning: "Tears down the seeded precondition so the next run starts clean.",
      role: "TEARDOWN",
      actorRole: "SERVICE_ACCOUNT",
      effectClass: "IDEMPOTENT_MUTATION",
      idempotencyClass: "KEYED",
      inputs: [{ name: "route", type: "entityRef", required: true, entityTypeRef: NESY_ENTITIES.route }],
      outputs: [],
      audit: { recordRequest: true, recordResponse: true, redactFields: [] },
      allowedEnvironments: ["qa", "staging"],
    },
  ],
};
