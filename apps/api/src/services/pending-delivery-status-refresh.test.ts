import { describe, expect, it } from 'vitest'

import type { BackofficeAdapter } from './nesy-backoffice-adapter.js'
import {
  createPendingDeliveryStatusRefresher,
  DELIVERY_STATUS_COMPLETED_FACT,
  READ_DELIVERY_STATUS_OPERATION,
  REMOTE_EVENTUAL_POLL_MS,
} from './pending-delivery-status-refresh.js'
import { SdkObservationStore } from './sdk-observation-store.js'

function adapterWith(completed: unknown): BackofficeAdapter {
  return {
    async call() {
      return {
        terminal: { status: 'SUCCEEDED' },
        normalizedResponse: {
          delivery: { completed, status: completed === true ? 'PROOF_AVAILABLE' : 'REMOTE_PENDING', correlationId: 'w1' },
        },
      }
    },
  }
}

describe('pending delivery status refresh', () => {
  it('does not poll before verify has published a pending fact', () => {
    let calls = 0
    const observations = new SdkObservationStore()
    const refresh = createPendingDeliveryStatusRefresher({
      adapter: {
        async call() {
          calls += 1
          return { terminal: { status: 'SUCCEEDED' }, normalizedResponse: {} }
        },
      },
      observations,
      runId: 'run-1',
      runInputs: { proofLookupId: 'w1' },
    })
    refresh()
    expect(calls).toBe(0)
  })

  it('does not invent a poll when the first read already completed', () => {
    let calls = 0
    const observations = new SdkObservationStore()
    observations.record('run-1', {
      factKey: DELIVERY_STATUS_COMPLETED_FACT,
      value: true,
      observedAtMs: 0,
      queryRef: 'nesy.backoffice.read-delivery-status',
    })
    const refresh = createPendingDeliveryStatusRefresher({
      adapter: {
        async call() {
          calls += 1
          return { terminal: { status: 'SUCCEEDED' }, normalizedResponse: {} }
        },
      },
      observations,
      runId: 'run-1',
      runInputs: { proofLookupId: 'w1' },
    })
    refresh()
    expect(calls).toBe(0)
  })

  it('re-reads an UNKNOWN proof and publishes completed when the row appears', async () => {
    const observations = new SdkObservationStore()
    observations.record('run-1', {
      factKey: DELIVERY_STATUS_COMPLETED_FACT,
      value: 'UNKNOWN',
      observedAtMs: 0,
      queryRef: 'nesy.backoffice.read-delivery-status',
    })
    const refresh = createPendingDeliveryStatusRefresher({
      adapter: adapterWith(true),
      observations,
      runId: 'run-1',
      runInputs: { proofLookupId: 'w1' },
      clock: () => 10_000,
    })
    refresh()
    await new Promise((resolve) => setTimeout(resolve, 20))
    const latest = observations.current('run-1').find((row) => row.factKey === DELIVERY_STATUS_COMPLETED_FACT)
    expect(latest?.value).toBe(true)
    expect(latest?.correlationValue).toBe('w1')
  })

  it('throttles to the EVENTUAL poll interval', async () => {
    let now = 0
    let calls = 0
    const observations = new SdkObservationStore()
    observations.record('run-1', {
      factKey: DELIVERY_STATUS_COMPLETED_FACT,
      value: 'UNKNOWN',
      observedAtMs: 0,
      queryRef: 'nesy.backoffice.read-delivery-status',
    })
    const refresh = createPendingDeliveryStatusRefresher({
      adapter: {
        async call() {
          calls += 1
          return {
            terminal: { status: 'SUCCEEDED' },
            normalizedResponse: { delivery: { status: 'REMOTE_PENDING' } },
          }
        },
      },
      observations,
      runId: 'run-1',
      runInputs: { proofLookupId: 'w1' },
      clock: () => now,
    })
    refresh()
    await new Promise((resolve) => setTimeout(resolve, 20))
    now = REMOTE_EVENTUAL_POLL_MS - 1
    refresh()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(calls).toBe(1)
    now = REMOTE_EVENTUAL_POLL_MS
    refresh()
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(calls).toBe(2)
  })

  it('does not recreate a terminal run bucket when a refresh resolves late', async () => {
    let resolveCall!: (result: Awaited<ReturnType<BackofficeAdapter['call']>>) => void
    const observations = new SdkObservationStore()
    observations.open('run-1')
    observations.record('run-1', {
      factKey: DELIVERY_STATUS_COMPLETED_FACT,
      value: 'UNKNOWN',
      observedAtMs: 0,
      queryRef: READ_DELIVERY_STATUS_OPERATION,
    })
    const refresh = createPendingDeliveryStatusRefresher({
      adapter: {
        call: () =>
          new Promise((resolve) => {
            resolveCall = resolve
          }),
      },
      observations,
      runId: 'run-1',
      runInputs: { proofLookupId: 'w1' },
    })

    refresh()
    refresh.dispose()
    observations.close('run-1')
    resolveCall({
      terminal: { status: 'SUCCEEDED' },
      normalizedResponse: {
        delivery: {
          completed: true,
          status: 'PROOF_AVAILABLE',
          correlationId: 'w1',
        },
      },
    })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(observations.current('run-1')).toEqual([])
    expect(
      observations.record('run-1', {
        factKey: DELIVERY_STATUS_COMPLETED_FACT,
        value: true,
        observedAtMs: 1,
        queryRef: READ_DELIVERY_STATUS_OPERATION,
      }),
    ).toBe(false)
  })
})
