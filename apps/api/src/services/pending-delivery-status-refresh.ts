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
 * Measured on run_4a9a7ff4: the first verify saw `[]`, the proof row's
 * eventDate landed ~4s before timeout, and Final Oracle still wrote
 * REQUIRED_TIMEOUT. Two host holes, not a product-window miss:
 *
 *   1. `refresh()` was fire-and-forget. Timeout evaluated the previous
 *      empty read, then dispose() aborted the in-flight poll that would
 *      have carried Delivered.
 *   2. EVENTUAL only admits facts with `observedAtMs < deadline`. Stamping
 *      the HTTP *response* time put a poll asked inside the window on the
 *      wrong side of that cut when the round-trip crossed the deadline.
 *
 * `flush()` awaits that in-flight ask. `observedAtMs` is the ask time.
 * The 120s bound is unchanged.
 */

import type { BackofficeAdapter } from './nesy-backoffice-adapter.js'
import type { SdkObservationStore } from './sdk-observation-store.js'

export const DELIVERY_STATUS_COMPLETED_FACT = 'REMOTE.DELIVERY_STATUS_COMPLETED'
export const DELIVERY_SUBMITTED_FACT = 'APP.DELIVERY_SUBMITTED'
export const READ_DELIVERY_STATUS_OPERATION = 'nesy.backoffice.read-delivery-status'
export const REMOTE_EVENTUAL_POLL_MS = 5_000

export type PendingDeliveryStatusRefresher = (() => void) & {
  dispose(): void
  /**
   * Drain the in-flight ask, and start one if the 5s cadence is already
   * due. Final Oracle calls this on the timeout path so a proof that
   * arrived while the last poll was on the wire is still judged.
   */
  flush(): Promise<void>
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

  const startPoll = (): Promise<void> => {
    const shipment = shipmentId()
    const askedAtMs = clock()
    lastPollMs = askedAtMs
    console.info(
      `[PendingDeliveryRefresh] request at=${new Date(askedAtMs).toISOString()} run=${options.runId} shipment=${shipment}`,
    )
    const pending = options.adapter
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
          // Ask time, not HTTP completion: EVENTUAL admits
          // `observedAtMs < deadline`. A poll started inside the window
          // must still count when the round-trip crosses the cut.
          observedAtMs: askedAtMs,
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
    if (inFlight !== undefined) await inFlight
    if (!active || controller.signal.aborted) return
    if (currentStatus()?.value === true) return
    if (!shouldWatch() && currentStatus() === undefined) return
    if (inFlight === undefined && clock() - lastPollMs >= REMOTE_EVENTUAL_POLL_MS) {
      await startPoll()
    }
  }

  refresh.dispose = () => {
    if (!active) return
    active = false
    controller.abort()
  }
  return refresh
}
