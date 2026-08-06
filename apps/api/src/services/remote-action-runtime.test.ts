import { describe, expect, it, vi } from 'vitest'
import type { ExternalActionSpec } from '@nesy/workflow-contract'
import {
  createStubRemoteAdapter,
  InMemoryRemoteActionAttemptStore,
  RemoteActionRuntime,
} from './remote-action-runtime.js'

const spec = (overrides: Partial<ExternalActionSpec> = {}): ExternalActionSpec => ({
  adapterRef: 'nesy.backoffice',
  operationRef: 'nesy.backoffice.tour.approve',
  role: 'VALIDATION',
  effectClass: 'IDEMPOTENT_MUTATION',
  idempotencyClass: 'KEYED',
  idempotencyKey: 'idem-1',
  inputBindings: [],
  outputFactBindings: [{ factKey: 'remote.tour_approved', responsePath: 'state' }],
  timeoutPolicy: { timeoutMs: 5_000, maxAttempts: 1 },
  auditPolicy: { recordRequest: true, recordResponse: true },
  reconciliationPolicy: 'RECONCILE_ON_UNKNOWN',
  ...overrides,
})

describe('remote action runtime', () => {
  const allowlist = [
    {
      adapterRef: 'nesy.backoffice',
      operationRef: 'nesy.backoffice.tour.approve',
      effectClass: 'IDEMPOTENT' as const,
      requiresResourceLease: true,
    },
  ]

  it('fail-closes unknown operation refs', async () => {
    const runtime = new RemoteActionRuntime(
      allowlist,
      createStubRemoteAdapter({}),
    )
    const result = await runtime.execute({
      runId: 'run-1',
      request: {
        operationRef: 'nesy.backoffice.unknown',
        allowlisted: true,
        idempotencyKey: 'idem-1',
        effectClass: 'IDEMPOTENT',
        timeoutMs: 1_000,
        occurrenceId: 'occ-1',
        resourceLeaseId: 'lease-1',
      },
      spec: spec({ operationRef: 'nesy.backoffice.unknown' }),
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.blockedReason).toMatch(/not allowlisted/i)
      expect(result.productVerdictHint).toBe('NOT_EVALUATED')
    }
  })

  it('does not replay a non-idempotent attempt left PENDING by a crash', async () => {
    const store = new InMemoryRemoteActionAttemptStore()
    store.upsert({
      runId: 'run-1',
      occurrenceId: 'occ-1',
      operationRef: 'nesy.backoffice.tour.approve',
      idempotencyKey: 'idem-1',
      effectClass: 'NON_IDEMPOTENT',
      status: 'PENDING',
      resourceLeaseId: 'lease-1',
    })
    const adapter = createStubRemoteAdapter({
      'nesy.backoffice.tour.approve': () => ({ status: 'SUCCEEDED' }),
    })
    const execute = vi.spyOn(adapter, 'execute')
    const runtime = new RemoteActionRuntime(allowlist, adapter, store)

    const result = await runtime.execute({
      runId: 'run-1',
      request: {
        operationRef: 'nesy.backoffice.tour.approve',
        allowlisted: true,
        idempotencyKey: 'idem-1',
        effectClass: 'NON_IDEMPOTENT',
        timeoutMs: 1_000,
        occurrenceId: 'occ-1',
        resourceLeaseId: 'lease-1',
      },
      spec: spec(),
    })

    expect(execute).not.toHaveBeenCalled()
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.terminal.status).toBe('UNKNOWN_EFFECT')
      expect(result.operationalDisposition).toBe('NEEDS_ATTENTION')
      expect(result.blockedReason).toMatch(/unterminated attempt/i)
    }
    expect(store.records[0]?.status).toBe('UNKNOWN_EFFECT')
  })

  it('requires idempotency key and resource lease before dispatch', async () => {
    const adapter = createStubRemoteAdapter({
      'nesy.backoffice.tour.approve': () => ({ status: 'SUCCEEDED' }),
    })
    const execute = vi.spyOn(adapter, 'execute')
    const runtime = new RemoteActionRuntime(allowlist, adapter)

    const missingKey = await runtime.execute({
      runId: 'run-1',
      request: {
        operationRef: 'nesy.backoffice.tour.approve',
        allowlisted: true,
        idempotencyKey: '   ',
        effectClass: 'IDEMPOTENT',
        timeoutMs: 1_000,
        occurrenceId: 'occ-1',
        resourceLeaseId: 'lease-1',
      },
      spec: spec({ idempotencyKey: '   ' }),
    })
    expect(missingKey.ok).toBe(false)
    expect(execute).not.toHaveBeenCalled()

    const missingLease = await runtime.execute({
      runId: 'run-1',
      request: {
        operationRef: 'nesy.backoffice.tour.approve',
        allowlisted: true,
        idempotencyKey: 'idem-1',
        effectClass: 'IDEMPOTENT',
        timeoutMs: 1_000,
        occurrenceId: 'occ-1',
      },
      spec: spec(),
    })
    expect(missingLease.ok).toBe(false)
    if (!missingLease.ok) expect(missingLease.blockedReason).toMatch(/resource lease/i)
    expect(execute).not.toHaveBeenCalled()
  })

  it('maps unknown/partial remote results to reconciliation attention without product PASS', async () => {
    const runtime = new RemoteActionRuntime(
      allowlist,
      createStubRemoteAdapter({
        'nesy.backoffice.tour.approve': () => ({
          status: 'UNKNOWN_EFFECT',
          error: 'response lost',
        }),
      }),
    )
    const result = await runtime.execute({
      runId: 'run-1',
      request: {
        operationRef: 'nesy.backoffice.tour.approve',
        allowlisted: true,
        idempotencyKey: 'idem-1',
        effectClass: 'IDEMPOTENT',
        timeoutMs: 1_000,
        occurrenceId: 'occ-1',
        resourceLeaseId: 'lease-1',
      },
      spec: spec(),
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.terminal.status).toBe('UNKNOWN_EFFECT')
      expect(result.operationalDisposition).toBe('NEEDS_ATTENTION')
      expect(result.productVerdictHint).toBe('NOT_EVALUATED')
    }
  })

  it('replays a stored terminal attempt for the same idempotency key without re-dispatch', async () => {
    const store = new InMemoryRemoteActionAttemptStore()
    const adapter = createStubRemoteAdapter({
      'nesy.backoffice.tour.approve': () => ({
        status: 'SUCCEEDED',
        responseRef: 'resp-1',
      }),
    })
    const execute = vi.spyOn(adapter, 'execute')
    const runtime = new RemoteActionRuntime(allowlist, adapter, store)
    const request = {
      operationRef: 'nesy.backoffice.tour.approve',
      allowlisted: true,
      idempotencyKey: 'idem-1',
      effectClass: 'IDEMPOTENT' as const,
      timeoutMs: 1_000,
      occurrenceId: 'occ-1',
      resourceLeaseId: 'lease-1',
    }

    await runtime.execute({ runId: 'run-1', request, spec: spec() })
    await runtime.execute({ runId: 'run-1', request, spec: spec() })
    expect(execute).toHaveBeenCalledTimes(1)
  })
})
