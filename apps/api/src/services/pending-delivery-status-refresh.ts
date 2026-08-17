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
 */

import type { BackofficeAdapter } from './nesy-backoffice-adapter.js'
import type { SdkObservationStore } from './sdk-observation-store.js'

export const DELIVERY_STATUS_COMPLETED_FACT = 'REMOTE.DELIVERY_STATUS_COMPLETED'
export const READ_DELIVERY_STATUS_OPERATION = 'nesy.backoffice.read-delivery-status'
export const REMOTE_EVENTUAL_POLL_MS = 5_000

export type PendingDeliveryStatusRefresher = (() => void) & {
  dispose(): void
}

export function createPendingDeliveryStatusRefresher(options: {
  adapter: BackofficeAdapter
  observations: SdkObservationStore
  runId: string
  runInputs: Readonly<Record<string, unknown>>
  clock?: () => number
}): PendingDeliveryStatusRefresher {
  const clock = options.clock ?? Date.now
  const controller = new AbortController()
  let lastPollMs = Number.NEGATIVE_INFINITY
  let inFlight = false
  let active = true

  const refresh = (() => {
    if (!active || controller.signal.aborted) return
    const current = options.observations
      .current(options.runId)
      .find((observation) => observation.factKey === DELIVERY_STATUS_COMPLETED_FACT)
    if (current === undefined || current.value === true) return
    const now = clock()
    if (inFlight || now - lastPollMs < REMOTE_EVENTUAL_POLL_MS) return
    const shipment = String(options.runInputs['proofLookupId'] ?? options.runInputs['shipment'] ?? '').trim()
    if (shipment === '') return
    lastPollMs = now
    inFlight = true
    console.info(
      `[PendingDeliveryRefresh] request at=${new Date(now).toISOString()} run=${options.runId} shipment=${shipment}`,
    )
    void options.adapter
      .call(
        {
          operationRef: READ_DELIVERY_STATUS_OPERATION,
          inputs: { shipment },
          timeoutMs: 20_000,
          signal: controller.signal,
        },
        { recordRequest: false, recordResponse: false, redactFields: [] },
      )
      .then((result) => {
        // Cancellation is cooperative. A custom adapter may resolve after the
        // signal, so reject the late completion again at the sink boundary.
        if (!active || controller.signal.aborted) return
        const delivery = (result.normalizedResponse['delivery'] ?? {}) as Record<string, unknown>
        const completed = delivery['completed']
        const correlation = delivery['correlationId']
        console.info(
          `[PendingDeliveryRefresh] response at=${new Date(clock()).toISOString()} run=${options.runId}` +
            ` terminal=${result.terminal.status} completed=${String(completed)} status=${String(delivery['status'] ?? '')}`,
        )
        if (result.terminal.status !== 'SUCCEEDED') return
        options.observations.record(options.runId, {
          factKey: DELIVERY_STATUS_COMPLETED_FACT,
          value: typeof completed === 'boolean' ? completed : 'UNKNOWN',
          observedAtMs: clock(),
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
        inFlight = false
      })
  }) as PendingDeliveryStatusRefresher

  refresh.dispose = () => {
    if (!active) return
    active = false
    controller.abort()
  }
  return refresh
}
