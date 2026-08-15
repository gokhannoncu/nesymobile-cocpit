import { describe, expect, it } from 'vitest'

import { observeInjectedClass } from '@nesy/workflow-contract'

import { createNetworkDisconnectSession } from './network-disconnect-injector.js'

const mutation = {
  effectClass: 'IDEMPOTENT_MUTATION' as const,
  operationRef: 'nesy.backoffice.approve-tour-request',
  timeoutPolicy: { timeoutMs: 20_000, maxAttempts: 1 },
}

const readOnly = {
  effectClass: 'READ_ONLY' as const,
  operationRef: 'nesy.backoffice.read-session',
  timeoutPolicy: { timeoutMs: 20_000, maxAttempts: 1 },
}

describe('network disconnect session', () => {
  it('stays inert when the run is uninjected', () => {
    const session = createNetworkDisconnectSession({ injectedFault: null, clock: () => 1 })
    session.request()
    expect(session.tryArm({ planStepId: 'approve', occurrenceId: 'occ-1', spec: mutation })).toBe(false)
    expect(session.injectionForCall(mutation.operationRef)).toBeNull()
    expect(session.snapshot().phase).toBeNull()
  })

  it('records requested → armed → triggered → effect observed without writing a class', () => {
    const session = createNetworkDisconnectSession({
      injectedFault: 'NETWORK_DISCONNECT',
      clock: () => 50,
    })
    expect(session.request().phase).toBe('REQUESTED')
    expect(session.tryArm({ planStepId: 'approve', occurrenceId: 'occ-1', spec: mutation })).toBe(true)
    expect(session.snapshot()).toMatchObject({
      phase: 'ARMED',
      triggerPoint: 'REMOTE_ACTION:nesy.backoffice.approve-tour-request@approve',
      occurrenceId: 'occ-1',
      actuallyFired: false,
    })
    session.markTriggered(mutation.operationRef)
    session.markTransportObserved()
    const provenance = session.snapshot()
    expect(provenance.phase).toBe('EFFECT_OBSERVED')
    expect(provenance.actuallyFired).toBe(true)
    expect(provenance.abortKind).toBe('TRANSPORT')
    expect(provenance.effectKind).toBe('HOST_TRANSPORT_CUT')
    expect(observeInjectedClass({ actionResult: 'UNKNOWN_EFFECT', provenance })).toBe('NETWORK_PARTITION')
  })

  it('does not arm a READ_ONLY probe — login-style remotes stay metadata-only', () => {
    const session = createNetworkDisconnectSession({
      injectedFault: 'NETWORK_DISCONNECT',
      clock: () => 1,
    })
    session.request()
    expect(session.tryArm({ planStepId: 'read-session', occurrenceId: 'occ-1', spec: readOnly })).toBe(false)
    expect(session.injectionForCall(readOnly.operationRef)).toBeNull()
    expect(
      observeInjectedClass({
        actionResult: 'UNKNOWN_EFFECT',
        provenance: session.snapshot(),
      }),
    ).toBeNull()
  })

  it('does not classify a planned fault that never triggered', () => {
    const session = createNetworkDisconnectSession({
      injectedFault: 'NETWORK_DISCONNECT',
      clock: () => 1,
    })
    session.request()
    session.tryArm({ planStepId: 'approve', occurrenceId: 'occ-1', spec: mutation })
    expect(
      observeInjectedClass({
        actionResult: 'SUCCEEDED',
        provenance: session.snapshot(),
      }),
    ).toBeNull()
  })

  it('does not look like a backend-timeout observation', () => {
    const session = createNetworkDisconnectSession({
      injectedFault: 'NETWORK_DISCONNECT',
      clock: () => 1,
    })
    session.request()
    session.tryArm({ planStepId: 'approve', occurrenceId: 'occ-1', spec: mutation })
    session.markTriggered(mutation.operationRef)
    session.markTransportObserved()
    expect(session.snapshot().abortKind).not.toBe('DEADLINE')
    expect(session.snapshot().effectKind).not.toBe('ADAPTER_DEADLINE_ABORT')
  })
})
