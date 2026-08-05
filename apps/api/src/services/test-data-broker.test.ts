import { describe, expect, it } from 'vitest'
import {
  InMemoryTestDataBrokerPersistence,
  TestDataBroker,
} from './test-data-broker.js'

describe('test data broker', () => {
  it('prevents parallel exclusive leases in the same conflict group', async () => {
    const broker = new TestDataBroker([
      {
        resourceId: 'tour-1',
        conflictGroup: 'tour:seed',
        exclusive: true,
        state: 'CLEAN',
      },
    ])

    const first = await broker.acquire({
      leaseId: 'lease-1',
      runId: 'run-1',
      resourceId: 'tour-1',
      conflictGroup: 'tour:seed',
      exclusive: true,
      leasedAtMs: 10,
    })
    expect(first.ok).toBe(true)

    const second = await broker.acquire({
      leaseId: 'lease-2',
      runId: 'run-2',
      resourceId: 'tour-1',
      conflictGroup: 'tour:seed',
      exclusive: true,
      leasedAtMs: 11,
    })
    expect(second).toMatchObject({ ok: false, reason: 'CONFLICT_GROUP_BUSY' })
  })

  it('keeps reconciliation-required resources out of the clean pool', async () => {
    const persistence = new InMemoryTestDataBrokerPersistence()
    const broker = new TestDataBroker(
      [
        {
          resourceId: 'tour-1',
          conflictGroup: 'tour:seed',
          exclusive: true,
          state: 'CLEAN',
        },
      ],
      persistence,
    )

    await broker.acquire({
      leaseId: 'lease-1',
      runId: 'run-1',
      resourceId: 'tour-1',
      conflictGroup: 'tour:seed',
      exclusive: true,
      leasedAtMs: 10,
    })
    await broker.markReconciliation('tour-1', 'PARTIAL_FAILURE')
    expect(await broker.release('lease-1', 20)).toMatchObject({
      ok: false,
      reason: 'RECONCILIATION_REQUIRED',
    })
    expect(broker.resourceState('tour-1')).toBe('RECONCILIATION_REQUIRED')
    expect(persistence.leases.get('lease-1')).toMatchObject({
      state: 'RECONCILIATION_REQUIRED',
      reconciliationReason: 'PARTIAL_FAILURE',
    })
  })
})
