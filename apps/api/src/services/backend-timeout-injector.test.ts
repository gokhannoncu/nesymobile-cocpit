import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { observeInjectedClass } from '@nesy/workflow-contract'

import { createBackendTimeoutSession } from './backend-timeout-injector.js'

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

beforeEach(() => {
  vi.stubEnv('NESY_REMOTE_ACTION_ENV', 'stage')
  vi.stubEnv('NESY_REMOTE_ACTION_COUNTRY', 'RS')
  vi.stubEnv('NESY_RS_STAGE_BASE_URL', 'https://stage.example.test')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('backend timeout session', () => {
  it('stays inert when the run is uninjected', () => {
    const session = createBackendTimeoutSession({ injectedFault: null, clock: () => 1 })
    session.request()
    expect(session.tryArm({ planStepId: 'approve', occurrenceId: 'occ-1', spec: mutation })).toBe(false)
    expect(session.injectionForCall({ operationRef: mutation.operationRef, planStepId: 'approve' })).toBeNull()
    expect(session.snapshot().phase).toBeNull()
  })

  it('fires only at the armed plan step, not at every call with the same operationRef', () => {
    const session = createBackendTimeoutSession({
      injectedFault: 'BACKEND_TIMEOUT',
      clock: () => 1,
    })
    session.request()
    session.tryArm({ planStepId: 'dispatcher-approves', occurrenceId: 'occ-1', spec: mutation })

    expect(
      session.injectionForCall({ operationRef: mutation.operationRef, planStepId: 'dispatcher-approves' }),
    ).toEqual({ timeoutMs: 80 })
    expect(
      session.injectionForCall({ operationRef: mutation.operationRef, planStepId: 'retry-approve' }),
    ).toBeNull()
    expect(session.injectionForCall({ operationRef: mutation.operationRef })).toBeNull()
  })

  it('stays inert outside the lab environments', () => {
    const previous = process.env.NESY_REMOTE_ACTION_ENV
    process.env.NESY_REMOTE_ACTION_ENV = 'prod'
    try {
      const session = createBackendTimeoutSession({ injectedFault: 'BACKEND_TIMEOUT', clock: () => 1 })
      session.request()
      expect(session.tryArm({ planStepId: 'approve', occurrenceId: 'occ-1', spec: mutation })).toBe(false)
      expect(session.injectionForCall({ operationRef: mutation.operationRef, planStepId: 'approve' })).toBeNull()
      expect(session.snapshot().phase).toBeNull()
    } finally {
      if (previous === undefined) delete process.env.NESY_REMOTE_ACTION_ENV
      else process.env.NESY_REMOTE_ACTION_ENV = previous
    }
  })

  it('records requested → armed → triggered → effect observed without writing a class', () => {
    const session = createBackendTimeoutSession({
      injectedFault: 'BACKEND_TIMEOUT',
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
    session.markTriggered(mutation.operationRef, 80)
    session.markDeadlineObserved()
    const provenance = session.snapshot()
    expect(provenance.phase).toBe('EFFECT_OBSERVED')
    expect(provenance.actuallyFired).toBe(true)
    expect(observeInjectedClass({ actionResult: 'UNKNOWN_EFFECT', provenance })).toBe('BACKEND_TIMEOUT')
  })

  it('does not arm a READ_ONLY probe — login-style remotes stay metadata-only', () => {
    const session = createBackendTimeoutSession({
      injectedFault: 'BACKEND_TIMEOUT',
      clock: () => 1,
    })
    session.request()
    expect(session.tryArm({ planStepId: 'read-session', occurrenceId: 'occ-1', spec: readOnly })).toBe(false)
    expect(session.injectionForCall({ operationRef: readOnly.operationRef, planStepId: 'read-session' })).toBeNull()
    expect(
      observeInjectedClass({
        actionResult: 'UNKNOWN_EFFECT',
        provenance: session.snapshot(),
      }),
    ).toBeNull()
  })

  it('does not classify a planned fault that never triggered', () => {
    const session = createBackendTimeoutSession({
      injectedFault: 'BACKEND_TIMEOUT',
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
})
