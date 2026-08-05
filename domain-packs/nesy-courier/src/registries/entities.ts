/**
 * ===========================================================================
 *  Nesy Courier Entity Registry  (Plan D.6B · 4B.15)
 *
 *  Every entity declares a business key, and that is the whole reason the
 *  registry exists. "The same stop" has to mean the same thing in the UI row, in
 *  the device's local store and in the backend record; without a declared key,
 *  cross-plane correlation degrades to "same-ish", and same-ish is not evidence.
 *
 *  Redaction is declared per entity rather than globally because courier data is
 *  full of addresses, names and phone numbers. An evidence archive that keeps
 *  those in the clear is a privacy incident with a six-month retention policy.
 * ===========================================================================
 */

import type { EntityDefinition } from "@nesy/domain-pack-contracts";
import { NESY_ADAPTER_QUERY_REFS, NESY_COURIER_APPLICATION_KEY } from "./application.js";

const APP = NESY_COURIER_APPLICATION_KEY;

export const NESY_ENTITIES = {
  route: "ROUTE",
  stop: "STOP",
  task: "TASK",
  shipment: "SHIPMENT",
  parcel: "PARCEL",
  pendingOperation: "PENDING_OPERATION",
  tourApprovalRequest: "TOUR_APPROVAL_REQUEST",
} as const;

export const NESY_COURIER_ENTITIES: readonly EntityDefinition[] = [
  {
    entityType: NESY_ENTITIES.route,
    applicationRef: APP,
    displayName: "Route",
    businessKeyPath: "routeCode",
    identityPaths: ["routeId"],
    correlation: { correlationPaths: ["routeCode", "routeId"], crossPlane: true },
    freshness: { maxAgeMs: 120_000, onStale: "REFRESH" },
    redaction: { redactPaths: ["assignedCourierName"], hashPaths: ["assignedCourierId"] },
    sourceQueryRefs: [NESY_ADAPTER_QUERY_REFS.routeState],
  },
  {
    entityType: NESY_ENTITIES.stop,
    applicationRef: APP,
    displayName: "Stop",
    businessKeyPath: "stopCode",
    identityPaths: ["stopId", "routeCode"],
    correlation: { correlationPaths: ["stopCode", "routeCode"], crossPlane: true },
    // Two minutes: a stop list re-sorts after a background sync, and a stale
    // observation is the direct input to the wrong-row bug.
    freshness: { maxAgeMs: 120_000, onStale: "REFRESH" },
    redaction: {
      redactPaths: ["address", "recipientName", "recipientPhone", "geoLat", "geoLon"],
      hashPaths: ["recipientId"],
    },
    sourceQueryRefs: [NESY_ADAPTER_QUERY_REFS.availableStops, NESY_ADAPTER_QUERY_REFS.stopState],
  },
  {
    entityType: NESY_ENTITIES.task,
    applicationRef: APP,
    displayName: "Task",
    businessKeyPath: "taskCode",
    identityPaths: ["taskId", "stopCode"],
    correlation: { correlationPaths: ["taskCode", "stopCode"], crossPlane: true },
    freshness: { maxAgeMs: 60_000, onStale: "REFRESH" },
    redaction: { redactPaths: ["notes"] },
    sourceQueryRefs: [NESY_ADAPTER_QUERY_REFS.taskState],
  },
  {
    entityType: NESY_ENTITIES.shipment,
    applicationRef: APP,
    displayName: "Shipment",
    businessKeyPath: "shipmentNumber",
    identityPaths: ["shipmentId"],
    correlation: { correlationPaths: ["shipmentNumber"], crossPlane: true },
    freshness: { maxAgeMs: 60_000, onStale: "REFRESH" },
    redaction: { redactPaths: ["senderName", "receiverName", "declaredValue"] },
    sourceQueryRefs: [NESY_ADAPTER_QUERY_REFS.taskState],
  },
  {
    entityType: NESY_ENTITIES.parcel,
    applicationRef: APP,
    displayName: "Parcel",
    businessKeyPath: "parcelBarcode",
    identityPaths: ["parcelId", "shipmentNumber"],
    correlation: { correlationPaths: ["parcelBarcode", "shipmentNumber"], crossPlane: true },
    freshness: { maxAgeMs: 30_000, onStale: "REFRESH" },
    redaction: { redactPaths: ["contentsDescription"], hashPaths: ["parcelBarcode"] },
    sourceQueryRefs: [NESY_ADAPTER_QUERY_REFS.parcelState],
  },
  {
    entityType: NESY_ENTITIES.pendingOperation,
    applicationRef: APP,
    displayName: "Pending offline operation",
    businessKeyPath: "operationKey",
    identityPaths: ["operationId"],
    correlation: { correlationPaths: ["operationKey", "correlationId"], crossPlane: true },
    // Short window: the interesting question about a queued operation is always
    // "is it still queued NOW?".
    freshness: { maxAgeMs: 15_000, onStale: "REFRESH" },
    redaction: { redactPaths: ["payload"] },
    sourceQueryRefs: [NESY_ADAPTER_QUERY_REFS.pendingOperation],
  },
  {
    entityType: NESY_ENTITIES.tourApprovalRequest,
    applicationRef: APP,
    displayName: "Tour approval request",
    businessKeyPath: "approvalRequestCode",
    identityPaths: ["approvalRequestId", "routeCode"],
    // crossPlane is mandatory here: the whole slice is about matching what the
    // courier asked for against what the dispatcher approved.
    correlation: { correlationPaths: ["approvalRequestCode", "correlationId", "routeCode"], crossPlane: true },
    freshness: { maxAgeMs: 60_000, onStale: "REFRESH" },
    redaction: { redactPaths: ["requesterName", "approverName"], hashPaths: ["requesterId", "approverId"] },
    sourceQueryRefs: [NESY_ADAPTER_QUERY_REFS.routeState],
  },
];
