import { describe, expect, it } from 'vitest'

import {
  evidenceSubtypeForFact,
  isLocalQueueItemWaitingObservation,
  localQueueItemWaitingFromPendingCount,
} from './local-queue-evidence.js'

describe('local queue evidence', () => {
  it('maps the queue fact keys to subtype queue, not the query name', () => {
    expect(evidenceSubtypeForFact('LOCAL.OFFLINE_QUEUE_ITEM_WAITING', 'nesy.pendingOperation')).toBe(
      'queue',
    )
    expect(evidenceSubtypeForFact('LOCAL.OFFLINE_QUEUE_DRAINED', 'nesy.pendingOperation')).toBe('queue')
    expect(evidenceSubtypeForFact('APP.PARCEL_SCANNED', 'nesy.pendingOperation')).toBe(
      'nesy.pendingOperation',
    )
  })

  it('treats pending_count 0 as absent and any other count as waiting', () => {
    expect(localQueueItemWaitingFromPendingCount('0')).toBe(false)
    expect(localQueueItemWaitingFromPendingCount(0)).toBe(false)
    expect(localQueueItemWaitingFromPendingCount('')).toBe(false)
    expect(localQueueItemWaitingFromPendingCount(undefined)).toBe(false)
    expect(localQueueItemWaitingFromPendingCount('1')).toBe(true)
    expect(localQueueItemWaitingFromPendingCount(2)).toBe(true)
  })

  it('does not treat a missing or false queue fact as waiting', () => {
    expect(
      isLocalQueueItemWaitingObservation({
        factKey: 'LOCAL.OFFLINE_QUEUE_ITEM_WAITING',
        value: false,
        queryRef: 'nesy.pendingOperation',
      }),
    ).toBe(false)
    expect(
      isLocalQueueItemWaitingObservation({
        factKey: 'LOCAL.PARCEL_RECORD_PERSISTED',
        value: true,
        queryRef: 'nesy.pendingOperation',
      }),
    ).toBe(false)
    expect(
      isLocalQueueItemWaitingObservation({
        factKey: 'LOCAL.OFFLINE_QUEUE_ITEM_WAITING',
        value: true,
      }),
    ).toBe(false)
    expect(
      isLocalQueueItemWaitingObservation({
        factKey: 'LOCAL.OFFLINE_QUEUE_ITEM_WAITING',
        value: true,
        queryRef: 'nesy.pendingOperation',
      }),
    ).toBe(true)
  })

  it('refuses a queue fact from another occurrence', () => {
    expect(
      isLocalQueueItemWaitingObservation({
        factKey: 'LOCAL.OFFLINE_QUEUE_ITEM_WAITING',
        value: true,
        subtype: 'queue',
        occurrenceId: 'run_old:read-pending-queue:0',
        expectedOccurrenceId: 'run_now:read-pending-queue:0',
      }),
    ).toBe(false)
    expect(
      isLocalQueueItemWaitingObservation({
        factKey: 'LOCAL.OFFLINE_QUEUE_ITEM_WAITING',
        value: true,
        subtype: 'queue',
        occurrenceId: 'run_now:read-pending-queue:0',
        expectedOccurrenceId: 'run_now:read-pending-queue:0',
      }),
    ).toBe(true)
  })
})
