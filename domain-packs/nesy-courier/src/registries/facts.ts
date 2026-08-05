/**
 * ===========================================================================
 *  Normalized fact keys  (Plan D.6E · 4B.15)
 *
 *  Fact keys are plane-prefixed. That is not cosmetic: the same business
 *  question answered by the UI, by the app's own state, by the device's local
 *  store and by the backend are FOUR different pieces of evidence with four
 *  different failure modes. `USER_SESSION_AVAILABLE` alone would let a run
 *  satisfy a backend requirement with a screen observation.
 *
 *  Queue facts live under `LOCAL.`, not under a `QUEUE.` prefix, because an
 *  offline queue is a source kind inside the local plane. A plane per mechanism
 *  would mean a Core change for every new mechanism.
 * ===========================================================================
 */

/** Every fact this pack can produce, as a named constant per fact. */
export const NESY_FACTS = {
  // ── UI plane ────────────────────────────────────────────────────────────
  LOGIN_SCREEN_READY: "UI.LOGIN_SCREEN_READY",
  ROUTE_DIALOG_READY: "UI.ROUTE_DIALOG_READY",
  ROUTE_LIST_READY: "UI.ROUTE_LIST_READY",
  TASK_LIST_READY: "UI.TASK_LIST_READY",
  DELIVERY_FLOW_READY: "UI.DELIVERY_FLOW_READY",
  PICKUP_FLOW_READY: "UI.PICKUP_FLOW_READY",
  VEHICLE_LOADING_READY: "UI.VEHICLE_LOADING_READY",
  END_OF_DAY_READY: "UI.END_OF_DAY_READY",
  SCANNER_SURFACE_READY: "UI.SCANNER_SURFACE_READY",
  PAYMENT_SURFACE_READY: "UI.PAYMENT_SURFACE_READY",
  FISCAL_SURFACE_READY: "UI.FISCAL_SURFACE_READY",
  UPDATE_DIALOG_PRESENT: "UI.UPDATE_DIALOG_PRESENT",
  SESSION_EXPIRED_DIALOG_PRESENT: "UI.SESSION_EXPIRED_DIALOG_PRESENT",
  PERMISSION_DIALOG_PRESENT: "UI.PERMISSION_DIALOG_PRESENT",
  NETWORK_DIALOG_PRESENT: "UI.NETWORK_DIALOG_PRESENT",
  LOADING_BLOCKER_PRESENT: "UI.LOADING_BLOCKER_PRESENT",

  // ── APP plane (SDK state / adapter projections / critical events) ───────
  USER_SESSION_AVAILABLE_APP: "APP.USER_SESSION_AVAILABLE",
  AVAILABLE_STOPS_LOADED: "APP.AVAILABLE_STOPS_LOADED",
  ACTIVE_STOP_OBSERVED: "APP.ACTIVE_STOP_OBSERVED",
  /** The wrong-row guard. See `open-stop.ts`. */
  ACTIVE_STOP_MATCHES: "APP.ACTIVE_STOP_MATCHES",
  SELECTED_ROUTE_OBSERVED: "APP.SELECTED_ROUTE_OBSERVED",
  PARCEL_SCANNED: "APP.PARCEL_SCANNED",
  PARCEL_STATE_PROCESSED: "APP.PARCEL_STATE_PROCESSED",
  DELIVERY_SUBMITTED: "APP.DELIVERY_SUBMITTED",
  TOUR_APPROVAL_REQUESTED: "APP.TOUR_APPROVAL_REQUESTED",
  TOUR_APPROVAL_PUSH_RECEIVED: "APP.TOUR_APPROVAL_PUSH_RECEIVED",
  LOGIN_SUCCEEDED: "APP.LOGIN_SUCCEEDED",
  SESSION_ISOLATION_ASSERTED: "APP.SESSION_ISOLATION_ASSERTED",

  // ── LOCAL plane (device store, offline queue) ──────────────────────────
  USER_SESSION_AVAILABLE_LOCAL: "LOCAL.USER_SESSION_AVAILABLE",
  OFFLINE_QUEUE_ITEM_WAITING: "LOCAL.OFFLINE_QUEUE_ITEM_WAITING",
  OFFLINE_QUEUE_DRAINED: "LOCAL.OFFLINE_QUEUE_DRAINED",
  PARCEL_RECORD_PERSISTED: "LOCAL.PARCEL_RECORD_PERSISTED",

  // ── REMOTE plane (backend validators, back-office adapter) ─────────────
  AUTH_ACCEPTED: "REMOTE.AUTH_ACCEPTED",
  ROUTES_AVAILABLE: "REMOTE.ROUTES_AVAILABLE",
  ROUTE_ASSIGNED: "REMOTE.ROUTE_ASSIGNED",
  DELIVERY_STATUS_COMPLETED: "REMOTE.DELIVERY_STATUS_COMPLETED",
  DELIVERY_CONFIRMED: "REMOTE.DELIVERY_CONFIRMED",
  TOUR_APPROVAL_REQUEST_CREATED: "REMOTE.TOUR_APPROVAL_REQUEST_CREATED",
  TOUR_APPROVAL_STATUS_APPROVED: "REMOTE.TOUR_APPROVAL_STATUS_APPROVED",
  TOUR_APPROVAL_CONFIRMED: "REMOTE.TOUR_APPROVAL_CONFIRMED",
} as const;

export type NesyFactKey = (typeof NESY_FACTS)[keyof typeof NESY_FACTS];
