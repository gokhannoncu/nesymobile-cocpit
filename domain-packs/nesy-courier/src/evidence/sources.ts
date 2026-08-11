/**
 * ===========================================================================
 *  Nesy Courier Evidence Source Registry  (Plan D.6E · 4B.15)
 *
 *  Two entries in this file carry most of its weight.
 *
 *  `nesy.local.offline-queue-item-waiting` sits on the LOCAL plane with source
 *  kind `OFFLINE_QUEUE_WATCH`. The queue is not its own evidence plane. Making it
 *  one would mean a Core change for every new local mechanism, and the plane axis
 *  would stop answering "who observed this?".
 *
 *  `nesy.remote.delivery-transport-ack` declares `transportSuccessOnly: true`,
 *  binds NO fact and holds only `FALLBACK` authority. It is the honest model of
 *  an HTTP 2xx: proof that a request was accepted, and no evidence at all that a
 *  delivery happened. It is registered anyway because the raw response is worth
 *  archiving — just never worth concluding from.
 *
 *  Every source preserves its raw observation. A normalized fact without the
 *  observation it came from cannot answer "what did the device actually report?",
 *  which is the only question that matters six months later.
 * ===========================================================================
 */

import type {
  CorrelationPolicy,
  EvidenceSourceDefinition,
  FreshnessPolicy,
} from "@nesy/domain-pack-contracts";
import { NESY_ADAPTER_QUERY_REFS } from "../registries/application.js";
import { NESY_FACTS } from "../registries/facts.js";

const UI_FRESHNESS: FreshnessPolicy = { maxAgeMs: 5_000, onStale: "REOBSERVE" };
const APP_FRESHNESS: FreshnessPolicy = { maxAgeMs: 15_000, onStale: "REOBSERVE" };
const REMOTE_FRESHNESS: FreshnessPolicy = { maxAgeMs: 60_000, onStale: "REOBSERVE" };

/**
 * UI observations are correlated by occurrence but not by entity.
 *
 * A screen being ready is not about a particular stop; requiring an entity match
 * would leave the gate permanently UNKNOWN.
 */
const UI_CORRELATION: CorrelationPolicy = {
  requireEntityMatch: false,
  requireOccurrenceMatch: true,
  correlationPaths: ["treeGen"],
  crossPlane: false,
};

/** Entity-scoped observations must match both the entity and the occurrence. */
const ENTITY_CORRELATION: CorrelationPolicy = {
  requireEntityMatch: true,
  requireOccurrenceMatch: true,
  correlationPaths: ["entityRef.id", "correlationId"],
  crossPlane: true,
};

/** Builds a UI readiness/presence watch. */
function uiWatch(factKey: string, observationRef: string, displayName: string): EvidenceSourceDefinition {
  return {
    sourceKey: `nesy.ui.${observationRef}`,
    plane: "UI",
    kind: "BRIDGE_WATCH",
    authority: "PRIMARY",
    displayName,
    factKey,
    observationRef: `nesy.watch.${observationRef}`,
    freshness: UI_FRESHNESS,
    correlation: UI_CORRELATION,
    redaction: { redactPaths: ["nodeText"] },
    preservesRawEvidence: true,
    requiredCapabilityRefs: ["verdict.core.bridge.watch-fact"],
  };
}

const UI_SOURCES: readonly EvidenceSourceDefinition[] = [
  uiWatch(NESY_FACTS.LOGIN_SCREEN_READY, "login-screen-ready", "Login screen ready"),
  uiWatch(NESY_FACTS.ROUTE_LIST_READY, "route-list-ready", "Route list ready"),
  uiWatch(NESY_FACTS.ROUTE_DIALOG_READY, "route-dialog-ready", "Route selection dialog ready"),
  uiWatch(NESY_FACTS.TASK_LIST_READY, "task-list-ready", "Stop task list ready"),
  uiWatch(NESY_FACTS.DELIVERY_FLOW_READY, "delivery-flow-ready", "Delivery flow ready"),
  uiWatch(NESY_FACTS.PICKUP_FLOW_READY, "pickup-flow-ready", "Pickup flow ready"),
  uiWatch(NESY_FACTS.VEHICLE_LOADING_READY, "vehicle-loading-ready", "Vehicle loading ready"),
  uiWatch(NESY_FACTS.END_OF_DAY_READY, "end-of-day-ready", "End of day ready"),
  uiWatch(NESY_FACTS.SCANNER_SURFACE_READY, "scanner-surface-ready", "Scanner surface ready"),
  uiWatch(NESY_FACTS.PAYMENT_SURFACE_READY, "payment-surface-ready", "Payment sheet ready"),
  uiWatch(NESY_FACTS.FISCAL_SURFACE_READY, "fiscal-surface-ready", "Fiscal overlay ready"),
  uiWatch(NESY_FACTS.UPDATE_DIALOG_PRESENT, "update-dialog-present", "Mandatory update dialog present"),
  uiWatch(NESY_FACTS.SESSION_EXPIRED_DIALOG_PRESENT, "session-expired-present", "Session expired dialog present"),
  uiWatch(NESY_FACTS.PERMISSION_DIALOG_PRESENT, "permission-dialog-present", "Permission dialog present"),
  uiWatch(NESY_FACTS.NETWORK_DIALOG_PRESENT, "network-dialog-present", "Network dialog present"),
  uiWatch(NESY_FACTS.LOADING_BLOCKER_PRESENT, "loading-blocker-present", "Blocking loader present"),
];

const APP_SOURCES: readonly EvidenceSourceDefinition[] = [
  {
    sourceKey: "nesy.app.session-state",
    plane: "APP",
    kind: "SDK_STATE",
    authority: "PRIMARY",
    displayName: "App session state",
    factKey: NESY_FACTS.USER_SESSION_AVAILABLE_APP,
    observationRef: NESY_ADAPTER_QUERY_REFS.sessionState,
    freshness: APP_FRESHNESS,
    correlation: { requireEntityMatch: false, requireOccurrenceMatch: true, correlationPaths: ["sessionId"], crossPlane: true },
    redaction: { redactPaths: ["accessToken", "refreshToken"], hashPaths: ["userId"] },
    preservesRawEvidence: true,
    requiredCapabilityRefs: ["domain.nesy.adapter.state-projection"],
  },
  {
    sourceKey: "nesy.app.available-stops",
    plane: "APP",
    kind: "NAMED_QUERY",
    authority: "PRIMARY",
    displayName: "Available stops projection",
    factKey: NESY_FACTS.AVAILABLE_STOPS_LOADED,
    observationRef: NESY_ADAPTER_QUERY_REFS.availableStops,
    freshness: { maxAgeMs: 120_000, onStale: "REOBSERVE" },
    correlation: { requireEntityMatch: false, requireOccurrenceMatch: true, correlationPaths: ["routeCode"], crossPlane: true },
    redaction: { redactPaths: ["items[].address", "items[].recipientName", "items[].recipientPhone"] },
    preservesRawEvidence: true,
    requiredCapabilityRefs: ["domain.nesy.adapter.named-query"],
  },
  {
    sourceKey: "nesy.app.active-stop",
    plane: "APP",
    kind: "SDK_STATE",
    authority: "PRIMARY",
    displayName: "Active stop projection",
    factKey: NESY_FACTS.ACTIVE_STOP_OBSERVED,
    observationRef: NESY_ADAPTER_QUERY_REFS.stopState,
    freshness: APP_FRESHNESS,
    correlation: ENTITY_CORRELATION,
    redaction: { redactPaths: ["address", "recipientName", "recipientPhone"] },
    preservesRawEvidence: true,
    requiredCapabilityRefs: ["domain.nesy.adapter.state-projection"],
  },
  {
    sourceKey: "nesy.app.selected-route",
    plane: "APP",
    kind: "SDK_STATE",
    authority: "PRIMARY",
    displayName: "Selected route projection",
    factKey: NESY_FACTS.SELECTED_ROUTE_OBSERVED,
    observationRef: NESY_ADAPTER_QUERY_REFS.routeState,
    freshness: APP_FRESHNESS,
    correlation: ENTITY_CORRELATION,
    redaction: { redactPaths: ["assignedCourierName"] },
    preservesRawEvidence: true,
    requiredCapabilityRefs: ["domain.nesy.adapter.state-projection"],
  },
  {
    sourceKey: "nesy.app.scan-accepted",
    plane: "APP",
    kind: "SDK_EVENT",
    authority: "PRIMARY",
    displayName: "Scan accepted event",
    factKey: NESY_FACTS.PARCEL_SCANNED,
    observationRef: "nesy.events.critical/scan-accepted",
    freshness: APP_FRESHNESS,
    correlation: ENTITY_CORRELATION,
    redaction: { redactPaths: ["rawScanPayload"], hashPaths: ["scanValue"] },
    preservesRawEvidence: true,
    requiredCapabilityRefs: ["domain.nesy.adapter.event-stream"],
  },
  {
    sourceKey: "nesy.app.parcel-state",
    plane: "APP",
    kind: "NAMED_QUERY",
    authority: "PRIMARY",
    displayName: "Parcel state projection",
    factKey: NESY_FACTS.PARCEL_STATE_PROCESSED,
    observationRef: NESY_ADAPTER_QUERY_REFS.parcelState,
    freshness: APP_FRESHNESS,
    correlation: ENTITY_CORRELATION,
    redaction: { redactPaths: ["contentsDescription"] },
    preservesRawEvidence: true,
    requiredCapabilityRefs: ["domain.nesy.adapter.named-query"],
  },
  {
    sourceKey: "nesy.app.delivery-submitted",
    plane: "APP",
    kind: "SDK_EVENT",
    authority: "PRIMARY",
    displayName: "Delivery submitted event",
    factKey: NESY_FACTS.DELIVERY_SUBMITTED,
    observationRef: "nesy.events.critical/delivery-submitted",
    freshness: APP_FRESHNESS,
    correlation: ENTITY_CORRELATION,
    redaction: { redactPaths: ["signatureImage", "recipientName"] },
    preservesRawEvidence: true,
    requiredCapabilityRefs: ["domain.nesy.adapter.event-stream"],
  },
  {
    sourceKey: "nesy.app.approval-requested",
    plane: "APP",
    kind: "SDK_EVENT",
    authority: "PRIMARY",
    displayName: "Tour approval requested event",
    factKey: NESY_FACTS.TOUR_APPROVAL_REQUESTED,
    observationRef: "nesy.events.critical/tour-approval-requested",
    freshness: APP_FRESHNESS,
    correlation: ENTITY_CORRELATION,
    redaction: { redactPaths: ["requesterName"], hashPaths: ["requesterId"] },
    preservesRawEvidence: true,
    requiredCapabilityRefs: ["domain.nesy.adapter.event-stream"],
  },
  {
    sourceKey: "nesy.app.approval-push",
    plane: "APP",
    kind: "SDK_EVENT",
    // CONFIRMATORY, not PRIMARY: a push notification proves a message arrived,
    // not that the record was approved. Push delivery is also legitimately
    // unreliable, so a required gate on it would flake for the wrong reason.
    authority: "CONFIRMATORY",
    displayName: "Tour approval push received",
    factKey: NESY_FACTS.TOUR_APPROVAL_PUSH_RECEIVED,
    observationRef: "nesy.events.critical/tour-approval-push",
    freshness: { maxAgeMs: 120_000, onStale: "TREAT_AS_UNKNOWN" },
    correlation: ENTITY_CORRELATION,
    redaction: { redactWholePayload: true, redactPaths: [] },
    preservesRawEvidence: true,
    requiredCapabilityRefs: ["domain.nesy.adapter.event-stream"],
  },
  {
    sourceKey: "nesy.app.release-isolation",
    plane: "APP",
    kind: "SDK_STATE",
    authority: "PRIMARY",
    displayName: "Release isolation assertion",
    factKey: NESY_FACTS.SESSION_ISOLATION_ASSERTED,
    observationRef: "nesy.assert.release-isolation",
    freshness: APP_FRESHNESS,
    correlation: { requireEntityMatch: false, requireOccurrenceMatch: true, correlationPaths: ["buildFingerprint"], crossPlane: false },
    redaction: { redactPaths: [] },
    preservesRawEvidence: true,
    requiredCapabilityRefs: ["domain.nesy.adapter.release-isolation"],
  },
];

const LOCAL_SOURCES: readonly EvidenceSourceDefinition[] = [
  {
    sourceKey: "nesy.local.session-record",
    plane: "LOCAL",
    kind: "DATABASE_VERIFIER",
    authority: "PRIMARY",
    displayName: "Local session record",
    factKey: NESY_FACTS.USER_SESSION_AVAILABLE_LOCAL,
    observationRef: NESY_ADAPTER_QUERY_REFS.dbSession,
    freshness: APP_FRESHNESS,
    correlation: { requireEntityMatch: false, requireOccurrenceMatch: true, correlationPaths: ["sessionId"], crossPlane: true },
    redaction: { redactPaths: ["accessToken", "refreshToken"], hashPaths: ["userId"] },
    preservesRawEvidence: true,
    requiredCapabilityRefs: ["domain.nesy.adapter.named-query"],
  },
  {
    // The queue-is-not-a-plane entry. See the file header.
    sourceKey: "nesy.local.offline-queue-item-waiting",
    plane: "LOCAL",
    kind: "OFFLINE_QUEUE_WATCH",
    authority: "PRIMARY",
    displayName: "Offline queue item waiting",
    factKey: NESY_FACTS.OFFLINE_QUEUE_ITEM_WAITING,
    observationRef: NESY_ADAPTER_QUERY_REFS.pendingOperation,
    freshness: { maxAgeMs: 15_000, onStale: "REOBSERVE" },
    correlation: ENTITY_CORRELATION,
    redaction: { redactPaths: ["payload"] },
    preservesRawEvidence: true,
    requiredCapabilityRefs: ["domain.nesy.adapter.named-query"],
  },
  {
    sourceKey: "nesy.local.offline-queue-drained",
    plane: "LOCAL",
    kind: "OFFLINE_QUEUE_WATCH",
    authority: "CONFIRMATORY",
    displayName: "Offline queue drained",
    factKey: NESY_FACTS.OFFLINE_QUEUE_DRAINED,
    observationRef: NESY_ADAPTER_QUERY_REFS.pendingOperation,
    freshness: { maxAgeMs: 15_000, onStale: "REOBSERVE" },
    correlation: ENTITY_CORRELATION,
    redaction: { redactPaths: ["payload"] },
    preservesRawEvidence: true,
    requiredCapabilityRefs: ["domain.nesy.adapter.named-query"],
  },
  {
    sourceKey: "nesy.local.parcel-record",
    plane: "LOCAL",
    kind: "DATABASE_VERIFIER",
    authority: "CONFIRMATORY",
    displayName: "Local parcel record persisted",
    factKey: NESY_FACTS.PARCEL_RECORD_PERSISTED,
    observationRef: "nesy.db.parcel",
    freshness: APP_FRESHNESS,
    correlation: ENTITY_CORRELATION,
    redaction: { redactPaths: ["contentsDescription"], hashPaths: ["parcelBarcode"] },
    preservesRawEvidence: true,
    requiredCapabilityRefs: ["domain.nesy.adapter.named-query"],
  },
];

const REMOTE_SOURCES: readonly EvidenceSourceDefinition[] = [
  {
    sourceKey: "nesy.remote.auth-accepted",
    plane: "REMOTE",
    kind: "REMOTE_VALIDATOR",
    authority: "PRIMARY",
    displayName: "Backend accepted the authentication",
    factKey: NESY_FACTS.AUTH_ACCEPTED,
    observationRef: "nesy.backoffice.read-session",
    freshness: REMOTE_FRESHNESS,
    correlation: { requireEntityMatch: false, requireOccurrenceMatch: true, correlationPaths: ["sessionId", "correlationId"], crossPlane: true },
    redaction: { redactPaths: ["tokenHint"], hashPaths: ["userId"] },
    preservesRawEvidence: true,
    requiredCapabilityRefs: ["verdict.core.remote.allowlisted-operation"],
  },
  {
    sourceKey: "nesy.remote.routes-available",
    plane: "REMOTE",
    kind: "REMOTE_VALIDATOR",
    authority: "PRIMARY",
    displayName: "Routes available for the courier",
    factKey: NESY_FACTS.ROUTES_AVAILABLE,
    observationRef: "nesy.backoffice.read-routes",
    freshness: REMOTE_FRESHNESS,
    correlation: { requireEntityMatch: false, requireOccurrenceMatch: true, correlationPaths: ["routeCode"], crossPlane: true },
    redaction: { redactPaths: ["items[].assignedCourierName"] },
    preservesRawEvidence: true,
    requiredCapabilityRefs: ["verdict.core.remote.allowlisted-operation"],
  },
  {
    sourceKey: "nesy.remote.route-assigned",
    plane: "REMOTE",
    kind: "REMOTE_VALIDATOR",
    authority: "PRIMARY",
    displayName: "Route assigned to this courier",
    factKey: NESY_FACTS.ROUTE_ASSIGNED,
    observationRef: "nesy.backoffice.read-route-assignment",
    freshness: REMOTE_FRESHNESS,
    correlation: ENTITY_CORRELATION,
    redaction: { redactPaths: ["assignedCourierName"], hashPaths: ["assignedCourierId"] },
    preservesRawEvidence: true,
    requiredCapabilityRefs: ["verdict.core.remote.allowlisted-operation"],
  },
  {
    sourceKey: "nesy.remote.delivery-status",
    plane: "REMOTE",
    kind: "REMOTE_VALIDATOR",
    authority: "PRIMARY",
    displayName: "Backend delivery status",
    factKey: NESY_FACTS.DELIVERY_STATUS_COMPLETED,
    observationRef: "nesy.backoffice.read-delivery-status",
    freshness: REMOTE_FRESHNESS,
    correlation: ENTITY_CORRELATION,
    redaction: { redactPaths: ["recipientName", "signatureRef"] },
    preservesRawEvidence: true,
    requiredCapabilityRefs: ["verdict.core.remote.allowlisted-operation"],
  },
  {
    // The honest HTTP 2xx. Binds no fact, holds FALLBACK authority, and exists
    // only so the raw response is archived. See the file header.
    sourceKey: "nesy.remote.delivery-transport-ack",
    plane: "REMOTE",
    kind: "NETWORK_OPERATION",
    authority: "FALLBACK",
    displayName: "Delivery request transport acknowledgement",
    observationRef: "nesy.network.delivery-submit",
    freshness: { maxAgeMs: 30_000, onStale: "TREAT_AS_UNKNOWN" },
    correlation: { requireEntityMatch: true, requireOccurrenceMatch: true, correlationPaths: ["correlationId"], crossPlane: true },
    redaction: { redactWholePayload: true, redactPaths: [] },
    transportSuccessOnly: true,
    preservesRawEvidence: true,
    requiredCapabilityRefs: ["verdict.core.remote.allowlisted-operation"],
  },
];

export const NESY_COURIER_EVIDENCE_SOURCES: readonly EvidenceSourceDefinition[] = [
  ...UI_SOURCES,
  ...APP_SOURCES,
  ...LOCAL_SOURCES,
  ...REMOTE_SOURCES,
];
