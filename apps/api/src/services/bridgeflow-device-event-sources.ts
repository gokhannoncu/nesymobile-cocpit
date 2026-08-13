/**
 * Device wire event → normalized fact.
 *
 * `BridgeFlowEvidenceSources` starts EMPTY, and an unregistered `sourceEvent` is
 * refused by `resolveBridgeFlowDurableEvent`. Until this module registered
 * anything, no device event could become a fact for any workflow — frames arrived,
 * were stored, and were invisible to every oracle. The `UI.*_READY` facts appeared
 * to work only because they come from the screen observer, not from this path.
 *
 * ## What may be registered here
 *
 * Only wires whose payload carries ONE unambiguous boolean, on EVERY emit of that
 * wire. The resolver reads `definition.valueField` and refuses the frame when the
 * field is missing — and a refusal is blocking, so a wire that sometimes omits its
 * value would stop the run rather than be ignored. `STATE_LOGIN` is the cautionary
 * example: it is emitted on app start as well, where the field it would need is
 * about something else entirely.
 *
 * A wire that means "this happened" therefore gets its own event name and a value
 * that is always `true` on that path, with absence carrying the negative.
 */

import type { EvidenceSourceRegistry } from './evidence-source-resolver.js'

/** Long enough to survive a gate poll cycle, short enough that a retry re-observes. */
const LOGIN_REJECTED_MAX_AGE_MS = 30_000

export const NESY_LOGIN_REJECTED_FACT = 'APP.LOGIN_REJECTED'
export const NESY_ROUTE_DIALOG_READY_FACT = 'UI.ROUTE_DIALOG_READY'

/**
 * A surface's readiness is a STATE while the dialog is up, not an instant, but it
 * is reported as one event. The window is what bounds it: long enough for a step
 * that is waiting to see it, short enough that a dialog dismissed long ago stops
 * answering for a later occurrence.
 */
const SURFACE_READY_MAX_AGE_MS = 30_000

/** A business event happened at a moment; the window bounds how long it answers for. */
const BUSINESS_EVENT_MAX_AGE_MS = 60_000

function registerAppBarcodeFact(
  registry: EvidenceSourceRegistry,
  sourceEvent: string,
  factKey: string,
  subtype: string,
  valueField: string,
): void {
  registry.register({
    sourceEvent,
    factKey,
    plane: 'APP',
    subtype,
    authority: 'PRIMARY',
    deliveryLanes: ['RECEIPT_SAFE', 'ORDERED_REQUIRED'],
    freshnessMaxAgeMs: BUSINESS_EVENT_MAX_AGE_MS,
    valueField,
    correlationField: 'barcode',
  })
}

/**
 * Registers the device-event sources this host trusts.
 *
 * Idempotent by construction: `register` throws on a duplicate `sourceEvent`, and
 * the API process registers once at startup.
 */
export function registerNesyDeviceEventSources(registry: EvidenceSourceRegistry): void {
  registry.register({
    sourceEvent: 'STATE_LOGIN_REJECTED',
    factKey: NESY_LOGIN_REJECTED_FACT,
    plane: 'APP',
    subtype: 'login-rejected',
    authority: 'PRIMARY',
    // BOTH lanes, because the two readers want different things from this fact.
    //
    // A continue gate reads `RECEIPT_SAFE` and a Final Oracle reads
    // `ORDERED_REQUIRED` (see `OracleEvaluationWorker`). Declaring only the
    // ordered lane — on the reasoning that a refusal is a business fact and not a
    // mere receipt — meant the gate whose whole purpose is to close on this event
    // could never see it: measured as 38 UNKNOWN evaluations followed by a
    // timeout, while the same fact sat accepted on the ordered lane.
    //
    // The receipt lane is right for the gate's question ("has the login attempt
    // resolved, either way?") — it is the same lane the UI readiness facts use.
    // The ordered lane is right for the oracle's ("what happened?"). Both are
    // honest readings of one event.
    deliveryLanes: ['RECEIPT_SAFE', 'ORDERED_REQUIRED'],
    freshnessMaxAgeMs: LOGIN_REJECTED_MAX_AGE_MS,
    valueField: 'login_rejected',
  })

  // A SURFACE, which is why it has to come from the device at all. The screen
  // readiness observer publishes facts a screen demonstrates by being entered;
  // a dialog is not an entered screen, so `UI.ROUTE_DIALOG_READY` had no producer
  // anywhere and `select-route` timed out at `wait-dialog` against a dialog that
  // was on screen the whole time.
  registry.register({
    sourceEvent: 'SURFACE_ROUTE_DIALOG_READY',
    factKey: NESY_ROUTE_DIALOG_READY_FACT,
    plane: 'UI',
    subtype: 'surface-ready',
    authority: 'PRIMARY',
    deliveryLanes: ['RECEIPT_SAFE', 'ORDERED_REQUIRED'],
    freshnessMaxAgeMs: SURFACE_READY_MAX_AGE_MS,
    valueField: 'surface_ready',
  })
  // The push notification list. It opens by ITSELF when a push arrives — the
  // app navigates there — so the pack models it as a HANDLE surface with a
  // dismiss handler. A surface the host cannot see is one it can never dismiss,
  // which is why this registration exists alongside the app-side emit rather
  // than the fact being declared with no producer.
  registry.register({
    sourceEvent: 'SURFACE_NOTIFICATION_LIST_READY',
    factKey: 'UI.NOTIFICATION_LIST_PRESENT',
    plane: 'UI',
    subtype: 'surface-ready',
    authority: 'PRIMARY',
    deliveryLanes: ['RECEIPT_SAFE', 'ORDERED_REQUIRED'],
    freshnessMaxAgeMs: SURFACE_READY_MAX_AGE_MS,
    valueField: 'surface_ready',
  })

  registry.register({
    sourceEvent: 'SURFACE_SCANNER_READY',
    factKey: 'UI.SCANNER_SURFACE_READY',
    plane: 'UI',
    subtype: 'surface-ready',
    authority: 'PRIMARY',
    deliveryLanes: ['RECEIPT_SAFE', 'ORDERED_REQUIRED'],
    freshnessMaxAgeMs: SURFACE_READY_MAX_AGE_MS,
    valueField: 'surface_ready',
  })

  // Business events the app already emitted but nothing on the host was told to
  // read. Each carries a value field that is present on EVERY emit of its wire —
  // a frame missing it is a blocking rejection, not an ignored one, so a field
  // that only appears on the happy path would stop the run it was meant to prove.
  //
  // `DELIVERY_UI_COMPLETED`, not `DELIVERY_PERSISTED`: the latter is emitted only
  // from an androidTest benchmark, while the delivery flow emits the former when
  // the event is saved (offline queue or online). Registering the benchmark wire
  // would have created a source no run could ever satisfy.
  registry.register({
    sourceEvent: 'PARCEL_SCANNED',
    factKey: 'APP.PARCEL_SCANNED',
    plane: 'APP',
    subtype: 'scan-accepted',
    authority: 'PRIMARY',
    deliveryLanes: ['RECEIPT_SAFE', 'ORDERED_REQUIRED'],
    freshnessMaxAgeMs: BUSINESS_EVENT_MAX_AGE_MS,
    valueField: 'scan_accepted',
    correlationField: 'barcode',
  })
  registry.register({
    sourceEvent: 'DELIVERY_UI_COMPLETED',
    factKey: 'APP.DELIVERY_SUBMITTED',
    plane: 'APP',
    subtype: 'delivery-submitted',
    authority: 'PRIMARY',
    deliveryLanes: ['RECEIPT_SAFE', 'ORDERED_REQUIRED'],
    freshnessMaxAgeMs: BUSINESS_EVENT_MAX_AGE_MS,
    // The error path (`emitDeliveryError`) uses this SAME wire with
    // `success=false` and `delivery_submitted=false`. Mapping the wire name
    // alone would read a backend refusal as a delivery. The boolean is present
    // on every emit; a missing field is still a blocking rejection.
    valueField: 'delivery_submitted',
    // Join on `data.barcode`. Envelope `taskId` is a piece barcode here and a
    // waybill on `DELIVERY_PERSISTED` — mixing them would invent a join.
    correlationField: 'barcode',
  })
  // Shared `DIALOG_SHOWN` / `DIALOG_DISMISSED` stay unregistered: ArasDialog
  // (central) and ScanProcessor still emit them, and four delivery-screen
  // meanings used to hide in the same names. The dedicated wires below each
  // have one meaning and a boolean on every emit.
  // The gate `initiateDeliveryProcess` checks first. `PARCEL_SCANNED` cannot
  // stand in for it: that wire fires pre-routing on every screen, so a run
  // resting on it reads green on branches that only raise a toast.
  registerAppBarcodeFact(
    registry,
    'DELIVERY_PARCEL_SCANNED',
    'APP.DELIVERY_PARCEL_SCANNED',
    'delivery-parcel-scanned',
    'delivery_parcel_scanned',
  )
  registerAppBarcodeFact(
    registry,
    'DELIVERY_TYPE_DIALOG_SHOWN',
    'APP.DELIVERY_TYPE_DIALOG_SHOWN',
    'delivery-type-dialog-shown',
    'delivery_type_dialog_shown',
  )
  registerAppBarcodeFact(
    registry,
    'DELIVERY_TYPE_PICKED',
    'APP.DELIVERY_TYPE_PICKED',
    'delivery-type-picked',
    'delivery_type_picked',
  )
  registerAppBarcodeFact(
    registry,
    'DELIVERY_CONFIRM_DIALOG_SHOWN',
    'APP.DELIVERY_CONFIRM_DIALOG_SHOWN',
    'delivery-confirm-dialog-shown',
    'delivery_confirm_dialog_shown',
  )
  registerAppBarcodeFact(
    registry,
    'DELIVERY_CONFIRM_RESULT',
    'APP.DELIVERY_CONFIRM_ACCEPTED',
    'delivery-confirm-result',
    'delivery_confirm_accepted',
  )
  registerAppBarcodeFact(
    registry,
    'UNSCANNED_ITEMS_DIALOG_SHOWN',
    'APP.UNSCANNED_ITEMS_DIALOG_SHOWN',
    'unscanned-items-dialog-shown',
    'unscanned_items_dialog_shown',
  )
  registerAppBarcodeFact(
    registry,
    'UNSCANNED_ITEMS_RESULT',
    'APP.UNSCANNED_ITEMS_CONTINUED',
    'unscanned-items-result',
    'unscanned_items_continued',
  )
  registerAppBarcodeFact(
    registry,
    'PAYMENT_DIALOG_SHOWN',
    'APP.PAYMENT_DIALOG_SHOWN',
    'payment-dialog-shown',
    'payment_dialog_shown',
  )
  registerAppBarcodeFact(
    registry,
    'SKIP_EXW_DIALOG_SHOWN',
    'APP.SKIP_EXW_DIALOG_SHOWN',
    'skip-exw-dialog-shown',
    'skip_exw_dialog_shown',
  )
  registerAppBarcodeFact(
    registry,
    'SKIP_EXW_RESULT',
    'APP.SKIP_EXW_ACCEPTED',
    'skip-exw-result',
    'skip_exw_accepted',
  )
  registerAppBarcodeFact(
    registry,
    'PAYMENT_COMPLETED',
    'APP.PAYMENT_COMPLETED',
    'payment-completed',
    'payment_completed',
  )
  registerAppBarcodeFact(
    registry,
    'FISCAL_COMPLETED',
    'APP.FISCAL_COMPLETED',
    'fiscal-completed',
    'fiscal_completed',
  )
  // WHICH flow a scan at a stop started.
  //
  // `PARCEL_SCANNED` is emitted for every accepted scan BEFORE the app routes it,
  // so a slice resting on it alone goes green on branches that show a toast and
  // do nothing. Mapped 2026-08-13: `whenBarcodeDetect` has roughly twenty
  // outcomes and most of them emit nothing whatsoever. This wire is what
  // distinguishes the delivery branch from its neighbours.
  registry.register({
    sourceEvent: 'DELIVERY_STARTED',
    factKey: 'APP.DELIVERY_FLOW_STARTED',
    plane: 'APP',
    subtype: 'delivery-started',
    authority: 'PRIMARY',
    deliveryLanes: ['RECEIPT_SAFE', 'ORDERED_REQUIRED'],
    freshnessMaxAgeMs: BUSINESS_EVENT_MAX_AGE_MS,
    valueField: 'delivery_started',
    correlationField: 'barcode',
  })
  registry.register({
    sourceEvent: 'TOUR_STARTED',
    factKey: 'APP.TOUR_APPROVAL_REQUESTED',
    plane: 'APP',
    subtype: 'tour-requested',
    authority: 'PRIMARY',
    deliveryLanes: ['RECEIPT_SAFE', 'ORDERED_REQUIRED'],
    freshnessMaxAgeMs: BUSINESS_EVENT_MAX_AGE_MS,
    valueField: 'tour_requested',
    // The schedule IS the tour approval request's identity — the product mints
    // no other id for it — and this fact is an input to a CORRELATED_ALL_OF
    // derivation, so without it the conclusion can never be drawn.
    correlationField: 'schedule_id',
  })
  registry.register({
    sourceEvent: 'TOUR_APPROVAL_PUSH',
    factKey: 'APP.TOUR_APPROVAL_PUSH_RECEIVED',
    plane: 'APP',
    subtype: 'tour-approval-push',
    authority: 'PRIMARY',
    deliveryLanes: ['RECEIPT_SAFE', 'ORDERED_REQUIRED'],
    freshnessMaxAgeMs: BUSINESS_EVENT_MAX_AGE_MS,
    valueField: 'push_received',
    correlationField: 'schedule_id',
  })
  registry.register({
    sourceEvent: 'SCHEDULE_STATUS_APPROVED',
    factKey: 'APP.SCHEDULE_STATUS_APPROVED',
    plane: 'APP',
    subtype: 'schedule-status-approved',
    authority: 'PRIMARY',
    deliveryLanes: ['RECEIPT_SAFE', 'ORDERED_REQUIRED'],
    freshnessMaxAgeMs: BUSINESS_EVENT_MAX_AGE_MS,
    // The BOOLEAN, never the numeric `schedule_status` the same frame carries.
    // The device emits this wire on every schedule store, so the field is present
    // on every emit — a value field that only appeared on the approved path would
    // make the negative case a blocking rejection instead of an observed `false`,
    // and the negative case is precisely the one worth catching.
    valueField: 'schedule_status_approved',
    // Same schedule identity as TOUR_STARTED / TOUR_APPROVAL_PUSH, so the three can
    // be joined on one tour. Measured 2026-08-12: the approval push arrived at +6.3s
    // and the device's own schedule did not change for another 28s (zero
    // Task/GetMyScheduleByZoneCode calls), so an uncorrelated read of this fact would
    // happily answer using the pre-approval store.
    correlationField: 'schedule_id',
  })
}
