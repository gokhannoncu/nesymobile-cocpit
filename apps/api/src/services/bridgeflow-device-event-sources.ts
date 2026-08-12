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
}
