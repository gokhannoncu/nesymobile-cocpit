import { describe, expect, it } from 'vitest'
import { buildNesyCourierBundle } from '@nesy/nesy-courier-domain-pack'

import { createNesyBackofficeAdapter, redact } from './nesy-backoffice-adapter.js'
import { MOBILE_APPROVAL_STATUS, NESY_BACKOFFICE_ENDPOINTS } from './nesy-backoffice-endpoints.js'
import { BridgeFlowEvidenceRuntime } from './bridgeflow-evidence-runtime.js'
import { BridgeFlowRunContext } from './bridgeflow-run-context.js'
import { createPackRemoteStepRuntime } from './bridgeflow-remote-steps.js'

const AUDIT = { recordRequest: true, recordResponse: true, redactFields: [] as string[] }
const STEP_CONTEXT = {
  runId: 'run-1',
  deviceId: 'device-1',
  occurrenceId: 'occ-1',
  occurrenceIndex: 0,
  iterationKey: '',
  requestId: 'req-1',
  startedAtMs: 0,
}

function envelope(payload: unknown, resultCode = 200) {
  return new Response(JSON.stringify({ resultCode, payload }), { status: 200 })
}

describe('back-office endpoint map', () => {
  it('covers every operation the pack allowlists', () => {
    const bundle = buildNesyCourierBundle()
    const declared = bundle.registries.remoteAdapters.flatMap((adapter) =>
      adapter.operations.map((operation) => operation.operationRef),
    )
    expect(declared.length).toBeGreaterThan(0)
    for (const operationRef of declared) {
      expect(Object.keys(NESY_BACKOFFICE_ENDPOINTS)).toContain(operationRef)
    }
  })

  it('approves tour requests through the mobile approval queue, not schedule end-of-day', () => {
    const endpoint = NESY_BACKOFFICE_ENDPOINTS['nesy.backoffice.approve-tour-request']!
    expect(endpoint.path).toBe('Task/ValidateMobileApprovalRequests')
    expect(endpoint.body({ approvalRequest: 'approval-1' })).toEqual({
      UniqueIdentifier: 'approval-1',
      Status: MOBILE_APPROVAL_STATUS.approved,
    })
  })

  it('narrows the approval status read to approved mobile approval requests only', () => {
    const endpoint = NESY_BACKOFFICE_ENDPOINTS['nesy.backoffice.read-tour-approval-status']!
    expect(endpoint.path).toBe('Task/GetMobileApprovalRequests')
    expect(endpoint.body({})).toEqual({ Status: MOBILE_APPROVAL_STATUS.approved })
  })

  it('sends AddUserIdToSchedule as the request model the backend service expects', () => {
    const endpoint = NESY_BACKOFFICE_ENDPOINTS['nesy.backoffice.seed-route-assignment']!
    expect(endpoint.body({ scheduleId: 'schedule-1' })).toEqual({ ScheduleId: 'schedule-1' })
  })

  it('uses delivery proof, not shipment search, for delivery confirmation', () => {
    const endpoint = NESY_BACKOFFICE_ENDPOINTS['nesy.backoffice.read-delivery-status']!
    expect(endpoint.path).toBe('Tracking/GetShipmentDeliveryProof')
    expect(endpoint.confidence).toBe('SOURCE_VERIFIED')
    expect(endpoint.body({ shipment: 'shipment-1' })).toEqual({ ShipmentIdList: ['shipment-1'] })
    expect(endpoint.normalize!([{ ShipmentId: 'shipment-1' }], { shipment: 'shipment-1' })).toMatchObject({
      delivery: { completed: true, status: 'PROOF_AVAILABLE', shipmentId: 'shipment-1' },
    })
  })

  it('reads the approval fact from the matching mobile approval request, not from any request', () => {
    const endpoint = NESY_BACKOFFICE_ENDPOINTS['nesy.backoffice.read-tour-approval-status']!
    const payload = [
      { UniqueIdentifier: 'other', Status: MOBILE_APPROVAL_STATUS.approved },
      { UniqueIdentifier: 'mine', Status: MOBILE_APPROVAL_STATUS.approved },
    ]
    expect(endpoint.normalize!(payload, { approvalRequest: 'mine' })).toMatchObject({
      approval: { statusIsApproved: true, approvalRequestCode: 'mine' },
    })
    expect(endpoint.normalize!(payload, { approvalRequest: 'absent' })).toMatchObject({
      approval: { statusIsApproved: false },
    })
  })
})

describe('nesy back-office adapter', () => {
  it('treats a non-200 resultCode inside an HTTP 200 as a business failure', async () => {
    const adapter = createNesyBackofficeAdapter({
      credentials: () => ({ baseUrl: 'https://nesy.example', token: 't' }),
      fetchImpl: async () => envelope(null, 500),
    })

    const result = await adapter.call(
      { operationRef: 'nesy.backoffice.read-routes', inputs: {}, timeoutMs: 1_000 },
      AUDIT,
    )

    expect(result.terminal.status).toBe('FAILED')
  })

  it('reports a lost call as UNKNOWN_EFFECT so the mutation is not retried blind', async () => {
    const adapter = createNesyBackofficeAdapter({
      credentials: () => ({ baseUrl: 'https://nesy.example', token: 't' }),
      fetchImpl: async () => {
        throw new Error('socket hang up')
      },
    })

    const result = await adapter.call(
      { operationRef: 'nesy.backoffice.approve-tour-request', inputs: { approvalRequest: 's1' }, timeoutMs: 1_000 },
      AUDIT,
    )

    expect(result.terminal.status).toBe('UNKNOWN_EFFECT')
  })

  it('fails closed when the environment carries no back-office configuration', async () => {
    const adapter = createNesyBackofficeAdapter({
      credentials: () => ({ baseUrl: '', token: '' }),
      fetchImpl: async () => {
        throw new Error('must not reach the network')
      },
    })

    const result = await adapter.call(
      { operationRef: 'nesy.backoffice.read-routes', inputs: {}, timeoutMs: 1_000 },
      AUDIT,
    )

    expect(result.terminal).toMatchObject({ status: 'FAILED' })
    expect((result.terminal as { error: string }).error).toContain('not configured')
  })

  it('fails closed for an operation with no mapped endpoint', async () => {
    const adapter = createNesyBackofficeAdapter({
      credentials: () => ({ baseUrl: 'https://nesy.example', token: 't' }),
      fetchImpl: async () => envelope({}),
    })

    const result = await adapter.call(
      { operationRef: 'nesy.backoffice.not-mapped', inputs: {}, timeoutMs: 1_000 },
      AUDIT,
    )

    expect((result.terminal as { error: string }).error).toContain('no back-office endpoint is mapped')
  })

  it('posts to the mapped path and normalizes the payload the pack addresses', async () => {
    const calls: { url: string; body: unknown }[] = []
    const adapter = createNesyBackofficeAdapter({
      credentials: () => ({ baseUrl: 'https://nesy.example/', token: 't' }),
      fetchImpl: async (url, init) => {
        calls.push({ url: String(url), body: JSON.parse(String(init?.body ?? '{}')) })
        return envelope({ HasCourierTodaySchedule: true, Route: 'Z-14' })
      },
    })

    const result = await adapter.call(
      { operationRef: 'nesy.backoffice.read-route-assignment', inputs: {}, timeoutMs: 1_000 },
      AUDIT,
    )

    expect(calls[0]?.url).toBe('https://nesy.example/Task/CheckHasCourierTodaySchedule')
    expect(result.terminal.status).toBe('SUCCEEDED')
    expect(result.normalizedResponse).toMatchObject({ assignment: { assigned: true, route: 'Z-14' } })
  })

  it('redacts declared sensitive fields before they reach the audit sink', async () => {
    const audits: unknown[] = []
    const adapter = createNesyBackofficeAdapter({
      credentials: () => ({ baseUrl: 'https://nesy.example', token: 't' }),
      fetchImpl: async () => envelope({}),
      audit: (record) => audits.push(record.request),
    })

    await adapter.call(
      { operationRef: 'nesy.backoffice.read-routes', inputs: { approverComment: 'secret' }, timeoutMs: 1_000 },
      { recordRequest: true, recordResponse: false, redactFields: ['approverComment'] },
    )

    expect(JSON.stringify(audits)).not.toContain('secret')
  })

  it('redacts by leaf name so a pack-shaped path still matches a backend field', () => {
    expect(redact({ RequesterName: 'Ada' }, ['request.requesterName'])).toEqual({
      RequesterName: '[redacted]',
    })
  })
})

describe('remote step runtime', () => {
  const bundle = buildNesyCourierBundle()
  const spec = {
    adapterRef: 'nesy.backoffice',
    operationRef: 'nesy.backoffice.read-tour-approval-status',
    role: 'VALIDATION',
    effectClass: 'READ_ONLY',
    idempotencyClass: 'NATURALLY_IDEMPOTENT',
    inputBindings: [{ name: 'approvalRequest', source: { kind: 'runInput', path: 'approvalRequestCode' } }],
    outputFactBindings: [
      { factKey: 'REMOTE.TOUR_APPROVAL_STATUS_APPROVED', responsePath: 'approval.statusIsApproved' },
    ],
    timeoutPolicy: { timeoutMs: 20_000, maxAttempts: 1 },
    reconciliationPolicy: 'NONE',
    auditPolicy: { recordRequest: true, recordResponse: true, redactFields: [] },
  }

  const step = {
    planStepId: 'verify-approved',
    kind: 'REMOTE_ACTION' as const,
    sourceMapRef: 'src:verify',
    timeoutMs: 20_000,
    next: null,
    capabilityRequirements: [],
    evidenceRequirements: [],
    params: { spec },
  }

  it('publishes the backend fact into the run evidence scope so the oracle can settle', async () => {
    const evidence = new BridgeFlowEvidenceRuntime()
    const runtime = createPackRemoteStepRuntime({
      runId: 'run-1',
      bundle,
      adapter: {
        call: async () => ({
          terminal: { status: 'SUCCEEDED' },
          normalizedResponse: { approval: { statusIsApproved: true } },
        }),
      },
      variables: new BridgeFlowRunContext(),
      evidence,
      runInputs: { approvalRequestCode: 'sched-1' },
      clock: () => 1_000,
    })

    const result = await runtime.execute(step as never, STEP_CONTEXT as never)
    expect(result.succeeded).toBe(true)

    const facts = evidence.currentFacts(
      { runId: 'run-1', occurrenceId: 'occ-1', iterationKey: '' },
      1_000,
      'ORDERED_REQUIRED',
    )
    expect(facts).toHaveLength(1)
    expect(facts[0]).toMatchObject({
      factKey: 'REMOTE.TOUR_APPROVAL_STATUS_APPROVED',
      value: true,
      plane: 'REMOTE',
    })
  })

  it('publishes UNKNOWN rather than false when the response never carried the path', async () => {
    const evidence = new BridgeFlowEvidenceRuntime()
    const runtime = createPackRemoteStepRuntime({
      runId: 'run-1',
      bundle,
      adapter: {
        call: async () => ({ terminal: { status: 'SUCCEEDED' }, normalizedResponse: {} }),
      },
      variables: new BridgeFlowRunContext(),
      evidence,
      clock: () => 1_000,
    })

    await runtime.execute(step as never, STEP_CONTEXT as never)
    const facts = evidence.currentFacts(
      { runId: 'run-1', occurrenceId: 'occ-1', iterationKey: '' },
      1_000,
      'ORDERED_REQUIRED',
    )
    expect(facts[0]?.value).toBe('UNKNOWN')
  })

  it('refuses an operation the pack does not allowlist without calling the adapter', async () => {
    const runtime = createPackRemoteStepRuntime({
      runId: 'run-1',
      bundle,
      adapter: {
        call: async () => {
          throw new Error('a non-allowlisted operation must never reach the transport')
        },
      },
      variables: new BridgeFlowRunContext(),
      evidence: new BridgeFlowEvidenceRuntime(),
      clock: () => 1_000,
    })

    const result = await runtime.execute(
      { ...step, params: { spec: { ...spec, operationRef: 'nesy.backoffice.rogue' } } } as never,
      STEP_CONTEXT as never,
    )
    expect(result.succeeded).toBe(false)
  })

  it('surfaces UNKNOWN_EFFECT as itself so the executor stops instead of retrying', async () => {
    const runtime = createPackRemoteStepRuntime({
      runId: 'run-1',
      bundle,
      adapter: {
        call: async () => ({
          terminal: { status: 'UNKNOWN_EFFECT', error: 'timed out' },
          normalizedResponse: {},
        }),
      },
      variables: new BridgeFlowRunContext(),
      evidence: new BridgeFlowEvidenceRuntime(),
      clock: () => 1_000,
    })

    const result = await runtime.execute(step as never, STEP_CONTEXT as never)
    expect(result).toMatchObject({ succeeded: false, actionResult: 'UNKNOWN_EFFECT' })
  })
})
