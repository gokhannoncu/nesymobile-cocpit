/**
 * Re-read GetShipmentDeliveryProof while complete-delivery's EVENTUAL
 * window is open.
 *
 * verify-backend-status is a one-shot VALIDATION. Nesy parks DELIVER_PARCELS
 * for 120s (`Request.createdAt + 120`, isWaitingRequest=true) even when the
 * WAN is up. An empty proof at that first read is REMOTE_PENDING, not a
 * product fail. The pack already gives REMOTE.DELIVERY_STATUS_COMPLETED a
 * 120s EVENTUAL deadline from assert-confirmed; this refresher is what
 * lets that deadline see a later proof row.
 *
 * Not a 14s→130s deadline bump. Poll is 5s so the 250ms host-state loop
 * does not stampede staging.
 *
 * EVENTUAL eligibility is `sourceEventAtMs` when the payload carries a
 * trusted eventDate, otherwise HTTP `completedAtMs`. `requestedAtMs` is
 * provenance only — stamping the ask as `observedAtMs` would admit a
 * Delivered that happened after the deadline (poll at 119.8s, event at
 * 121s). `flush()` waits for an in-flight ask, bounded by
 * `REMOTE_EVENTUAL_FLUSH_GRACE_MS`, so the 120s cut stays a decision
 * deadline.
 */

import { eventualObservedAtMs } from './eventual-observation-time.js'
import type { BackofficeAdapter } from './nesy-backoffice-adapter.js'
import type { SdkObservationStore } from './sdk-observation-store.js'

export const DELIVERY_STATUS_COMPLETED_FACT = 'REMOTE.DELIVERY_STATUS_COMPLETED'
export const DELIVERY_SUBMITTED_FACT = 'APP.DELIVERY_SUBMITTED'
export const READ_DELIVERY_STATUS_OPERATION = 'nesy.backoffice.read-delivery-status'
export const REMOTE_EVENTUAL_POLL_MS = 5_000
export const REMOTE_EVENTUAL_POLL_TIMEOUT_MS = 20_000
/** How long the timeout path may wait past the decision deadline. */
export const REMOTE_EVENTUAL_FLUSH_GRACE_MS = 2_000

export type PendingDeliveryStatusRefresher = (() => void) & {
  dispose(): void
  /**
   * Drain the in-flight ask, and start one if the 5s cadence is already
   * due and grace remains. Bounded: a hung GetShipmentDeliveryProof must
   * not turn the 120s EVENTUAL cut into an open wait.
   */
  flush(): Promise<void>
}

function awaitWithGrace(work: Promise<void>, graceMs: number): Promise<void> {
  if (graceMs <= 0) return Promise.resolve()
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, graceMs)
    void work.finally(() => {
      clearTimeout(timer)
      resolve()
    })
  })
}

export function createPendingDeliveryStatusRefresher(options: {
  adapter: BackofficeAdapter
  observations: SdkObservationStore
  runId: string
  runInputs: Readonly<Record<string, unknown>>
  clock?: () => number
  flushGraceMs?: number
}): PendingDeliveryStatusRefresher {
  const clock = options.clock ?? Date.now
  const flushGraceMs = options.flushGraceMs ?? REMOTE_EVENTUAL_FLUSH_GRACE_MS
  const controller = new AbortController()
  let lastPollMs = Number.NEGATIVE_INFINITY
  let inFlight: Promise<void> | undefined
  let active = true

  const currentStatus = () =>
    options.observations
      .current(options.runId)
      .find((observation) => observation.factKey === DELIVERY_STATUS_COMPLETED_FACT)

  const shipmentId = () =>
    String(options.runInputs['proofLookupId'] ?? options.runInputs['shipment'] ?? '').trim()

  const shouldWatch = (): boolean => {
    const status = currentStatus()
    if (status?.value === true) return false
    if (status !== undefined) return true
    return options.observations
      .current(options.runId)
      .some((observation) => observation.factKey === DELIVERY_SUBMITTED_FACT && observation.value === true)
  }

  const startPoll = (timeoutMs = REMOTE_EVENTUAL_POLL_TIMEOUT_MS): Promise<void> => {
    const shipment = shipmentId()
    const requestedAtMs = clock()
    lastPollMs = requestedAtMs
    console.info(
      `[PendingDeliveryRefresh] request at=${new Date(requestedAtMs).toISOString()} run=${options.runId} shipment=${shipment}`,
    )
    const pending = options.adapter
      .call(
        {
          operationRef: READ_DELIVERY_STATUS_OPERATION,
          inputs: { shipment },
          timeoutMs,
          signal: controller.signal,
        },
        { recordRequest: false, recordResponse: false, redactFields: [] },
      )
      .then((result) => {
        if (!active || controller.signal.aborted) return
        const completedAtMs = clock()
        const delivery = (result.normalizedResponse['delivery'] ?? {}) as Record<string, unknown>
        const completed = delivery['completed']
        const correlation = delivery['correlationId']
        const sourceEventAtMs = delivery['sourceEventAtMs']
        const observedAtMs = eventualObservedAtMs({ sourceEventAtMs, completedAtMs })
        console.info(
          `[PendingDeliveryRefresh] response at=${new Date(completedAtMs).toISOString()} run=${options.runId}` +
            ` terminal=${result.terminal.status} completed=${String(completed)} status=${String(delivery['status'] ?? '')}` +
            ` requestedAtMs=${requestedAtMs} completedAtMs=${completedAtMs} sourceEventAtMs=${String(sourceEventAtMs)} observedAtMs=${observedAtMs}`,
        )
        if (result.terminal.status !== 'SUCCEEDED') return
        options.observations.record(options.runId, {
          factKey: DELIVERY_STATUS_COMPLETED_FACT,
          value: typeof completed === 'boolean' ? completed : 'UNKNOWN',
          observedAtMs,
          requestedAtMs,
          completedAtMs,
          ...(typeof sourceEventAtMs === 'number' ? { sourceEventAtMs } : {}),
          queryRef: READ_DELIVERY_STATUS_OPERATION,
          ...(typeof correlation === 'string' && correlation.trim() !== ''
            ? { correlationValue: correlation }
            : {}),
        })
      })
      .catch((error) => {
        if (active && !controller.signal.aborted) {
          console.warn(
            `[PendingDeliveryRefresh] failed run=${options.runId}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          )
        }
      })
      .finally(() => {
        if (inFlight === pending) inFlight = undefined
      })
    inFlight = pending
    return pending
  }

  const refresh = (() => {
    if (!active || controller.signal.aborted) return
    if (!shouldWatch()) return
    if (inFlight !== undefined || clock() - lastPollMs < REMOTE_EVENTUAL_POLL_MS) return
    if (shipmentId() === '') return
    void startPoll()
  }) as PendingDeliveryStatusRefresher

  refresh.flush = async () => {
    if (!active || controller.signal.aborted) return
    if (currentStatus()?.value === true) return
    if (shipmentId() === '') return
    const graceDeadline = Date.now() + flushGraceMs
    if (inFlight !== undefined) await awaitWithGrace(inFlight, graceDeadline - Date.now())
    if (!active || controller.signal.aborted) return
    if (currentStatus()?.value === true) return
    if (inFlight !== undefined) return
    if (!shouldWatch() && currentStatus() === undefined) return
    const remainingMs = graceDeadline - Date.now()
    if (remainingMs <= 0) return
    if (clock() - lastPollMs >= REMOTE_EVENTUAL_POLL_MS) {
      await awaitWithGrace(startPoll(remainingMs), remainingMs)
    }
  }

  refresh.dispose = () => {
    if (!active) return
    active = false
    controller.abort()
  }
  return refresh
}
