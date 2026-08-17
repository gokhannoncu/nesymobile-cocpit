import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { observeInjectedClass } from '@nesy/workflow-contract'

import { createOfflineQueueSession } from './offline-queue-injector.js'

function fakeWan() {
  const calls: string[][] = []
  return {
    calls,
    cutter: {
      async cut() {
        calls.push(['cut'])
      },
      async restore() {
        calls.push(['restore'])
      },
    },
  }
}

beforeEach(() => {
  vi.stubEnv('NESY_REMOTE_ACTION_ENV', 'stage')
  vi.stubEnv('NESY_REMOTE_ACTION_COUNTRY', 'RS')
  vi.stubEnv('NESY_RS_STAGE_BASE_URL', 'https://stage.example.test')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('offline queue session', () => {
  it('stays inert when the run is uninjected', async () => {
    const wan = fakeWan()
    const session = createOfflineQueueSession({ injectedFault: null, clock: () => 1, wan: wan.cutter })
    session.request()
    expect(session.tryArm({ planStepId: 'tap-delivery-confirm', occurrenceId: 'occ-1' })).toBe(false)
    expect(await session.applyCut()).toBe(false)
    expect(wan.calls).toEqual([])
    expect(session.snapshot().phase).toBeNull()
  })

  it('stays inert outside the lab environments', async () => {
    const previous = process.env.NESY_REMOTE_ACTION_ENV
    process.env.NESY_REMOTE_ACTION_ENV = 'prod'
    try {
      const wan = fakeWan()
      const session = createOfflineQueueSession({
        injectedFault: 'OFFLINE_QUEUE',
        clock: () => 1,
        wan: wan.cutter,
      })
      session.request()
      expect(session.tryArm({ planStepId: 'tap-delivery-confirm', occurrenceId: 'occ-1' })).toBe(false)
      expect(await session.applyCut()).toBe(false)
      expect(session.snapshot().phase).toBeNull()
    } finally {
      if (previous === undefined) delete process.env.NESY_REMOTE_ACTION_ENV
      else process.env.NESY_REMOTE_ACTION_ENV = previous
    }
  })

  it('does not arm tour-approval or the process-parcel confirm', () => {
    const session = createOfflineQueueSession({ injectedFault: 'OFFLINE_QUEUE', clock: () => 1 })
    session.request()
    expect(session.tryArm({ planStepId: 'dispatcher-approves', occurrenceId: 'occ-1' })).toBe(false)
    expect(session.tryArm({ planStepId: 'tap-input-confirm', occurrenceId: 'occ-1' })).toBe(false)
    expect(session.snapshot().phase).toBe('REQUESTED')
  })

  it('records requested → armed → triggered without classifying from the input', async () => {
    const wan = fakeWan()
    const session = createOfflineQueueSession({
      injectedFault: 'OFFLINE_QUEUE',
      clock: () => 50,
      wan: wan.cutter,
    })
    expect(session.request().phase).toBe('REQUESTED')
    expect(session.tryArm({ planStepId: 'tap-delivery-confirm', occurrenceId: 'occ-1' })).toBe(true)
    expect(session.snapshot()).toMatchObject({
      phase: 'ARMED',
      triggerPoint: 'LOCAL_QUEUE:tap-delivery-confirm',
      occurrenceId: 'occ-1',
      actuallyFired: false,
      abortKind: 'NONE',
      effectKind: 'LOCAL_QUEUE_PERSIST',
    })
    expect(await session.applyCut()).toBe(true)
    expect(wan.calls).toEqual([['cut']])
    expect(session.snapshot().phase).toBe('TRIGGERED')
    expect(
      observeInjectedClass({
        actionResult: 'SUCCEEDED',
        productVerdict: 'PASS_QUEUED_OFFLINE',
        localQueueObserved: false,
        provenance: session.snapshot(),
      }),
    ).toBeNull()
  })

  it('becomes EFFECT_OBSERVED only when a LOCAL queue row is present', async () => {
    const wan = fakeWan()
    const session = createOfflineQueueSession({
      injectedFault: 'OFFLINE_QUEUE',
      clock: () => 50,
      wan: wan.cutter,
    })
    session.request()
    session.tryArm({ planStepId: 'tap-delivery-confirm', occurrenceId: 'occ-1' })
    await session.applyCut()
    session.markQueueObserved(false)
    expect(session.snapshot().phase).toBe('TRIGGERED')
    expect(session.snapshot().actuallyFired).toBe(false)
    session.markQueueObserved(true)
    const provenance = session.snapshot()
    expect(provenance.phase).toBe('EFFECT_OBSERVED')
    expect(provenance.actuallyFired).toBe(true)
    expect(provenance.abortKind).toBe('NONE')
    expect(provenance.effectKind).toBe('LOCAL_QUEUE_PERSIST')
    expect(
      observeInjectedClass({
        actionResult: 'SUCCEEDED',
        productVerdict: 'PASS_QUEUED_OFFLINE',
        localQueueObserved: true,
        provenance,
      }),
    ).toBe('OFFLINE_QUEUED')
    await session.restore()
    expect(wan.calls).toEqual([['cut'], ['restore']])
  })

  it('does not look like a transport-cut or deadline observation', async () => {
    const wan = fakeWan()
    const session = createOfflineQueueSession({
      injectedFault: 'OFFLINE_QUEUE',
      clock: () => 1,
      wan: wan.cutter,
    })
    session.request()
    session.tryArm({ planStepId: 'tap-delivery-confirm', occurrenceId: 'occ-1' })
    await session.applyCut()
    session.markQueueObserved(true)
    expect(session.snapshot().abortKind).toBe('NONE')
    expect(session.snapshot().effectKind).not.toBe('HOST_TRANSPORT_CUT')
    expect(session.snapshot().effectKind).not.toBe('ADAPTER_DEADLINE_ABORT')
    expect(
      observeInjectedClass({
        actionResult: 'UNKNOWN_EFFECT',
        provenance: session.snapshot(),
      }),
    ).toBeNull()
  })
})
