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

/** Dotted-path lookup mirroring `readPath` in `bridgeflow-remote-steps`. */
function readTestPath(source: unknown, path: string): unknown {
  let current = source
  for (const segment of path.split('.')) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return current
}

/**
 * Presence, not truthiness. A path carrying `null` is a normalizer answering
 * "no value"; a path that is absent is a normalizer that never had the key —
 * only the second is a contract break.
 */
function hasPath(source: unknown, path: string): boolean {
  let current = source
  const segments = path.split('.')
  for (const [index, segment] of segments.entries()) {
    if (current === null || typeof current !== 'object') return false
    if (!(segment in (current as Record<string, unknown>))) return false
    if (index === segments.length - 1) return true
    current = (current as Record<string, unknown>)[segment]
  }
  return false
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

  // The mismatch this catches cost a full device run to diagnose: the pack read
  // `session.accepted` while the normalizer emitted `session.authenticated`, so
  // `readPath` returned undefined, the fact published as UNKNOWN, the remote step
  // still reported SUCCEEDED, and the only visible symptom was an
  // EVIDENCE_INSUFFICIENT final oracle three steps later. A declared path that the
  // normalizer never emits is a build-time error, not a run-time mystery.
  //
  // The shape is asserted TOTAL — every declared path must be present for an empty
  // backend response too. A normalizer that emits a key only on the happy path
  // still leaves the oracle waiting out its deadline on the unhappy one, which is
  // the same failure wearing a different hat.
  it('emits every response path the pack declares, including for an empty response', () => {
    const bundle = buildNesyCourierBundle()
    const missing: string[] = []

    for (const adapter of bundle.registries.remoteAdapters) {
      for (const operation of adapter.operations) {
        const declared = operation.outputs.flatMap((output) =>
          [output.responsePath, output.entityStatusPath, output.correlationPath].filter(
            (path): path is string => typeof path === 'string' && path !== '',
          ),
        )
        if (declared.length === 0) continue

        const endpoint = NESY_BACKOFFICE_ENDPOINTS[operation.operationRef]
        if (endpoint?.normalize === undefined) {
          missing.push(`${operation.operationRef}: declares ${declared.length} path(s) but has no normalize`)
          continue
        }

        const normalized = endpoint.normalize(null, {})
        for (const path of declared) {
          if (!hasPath(normalized, path)) missing.push(`${operation.operationRef}: ${path}`)
        }

        // A `responsePath` that resolves to a non-boolean publishes as UNKNOWN by
        // design (`bridgeflow-remote-steps` refuses to invent a `false`), so a
        // non-boolean here is a fact that can never settle a requirement.
        for (const output of operation.outputs) {
          const value = readTestPath(normalized, output.responsePath)
          if (hasPath(normalized, output.responsePath) && typeof value !== 'boolean') {
            missing.push(`${operation.operationRef}: ${output.responsePath} is ${typeof value}, not boolean`)
          }
        }
      }
    }

    expect(missing).toEqual([])
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
    // `assignment.exists` is what `select-route` actually binds; the earlier
    // `assigned`/`route` shape resolved to undefined at run time and published
    // ROUTE_ASSIGNED as UNKNOWN.
    expect(result.normalizedResponse).toMatchObject({
      assignment: { exists: true, status: 'ASSIGNED', routeCode: 'Z-14' },
    })
  })

  // Measured against RS staging: User/GetMyInfo answers with an envelope nested
  // inside the envelope (UserOperation.GetMyInfo hands a full ResponseMessage to
  // SetSuccessResponse, which wraps it again), while GetBranchSchedules,
  // CheckHasCourierTodaySchedule and GetMobileApprovalRequests answer flat.
  it('unwraps a nested envelope so the normalizer reads the business payload', async () => {
    const adapter = createNesyBackofficeAdapter({
      credentials: () => ({ baseUrl: 'https://nesy.example', token: 't' }),
      fetchImpl: async () =>
        envelope({ resultCode: 200, resultMessage: null, payload: { id: 'user-1', role: 'courier' } }),
    })

    const result = await adapter.call(
      { operationRef: 'nesy.backoffice.read-session', inputs: {}, timeoutMs: 1_000 },
      AUDIT,
    )

    expect(result.terminal.status).toBe('SUCCEEDED')
    expect(result.normalizedResponse).toMatchObject({
      session: { accepted: true, status: 'LIVE', userId: 'user-1' },
    })
  })

  it('leaves a flat envelope alone', async () => {
    const adapter = createNesyBackofficeAdapter({
      credentials: () => ({ baseUrl: 'https://nesy.example', token: 't' }),
      fetchImpl: async () => envelope({ HasCourierTodaySchedule: true, Route: 'Z-14' }),
    })

    const result = await adapter.call(
      { operationRef: 'nesy.backoffice.read-route-assignment', inputs: {}, timeoutMs: 1_000 },
      AUDIT,
    )

    expect(result.normalizedResponse).toMatchObject({ assignment: { exists: true, routeCode: 'Z-14' } })
  })

  // The outer envelope says 200 while the inner one carries the refusal. Reading
  // only the outer code turns "No such user" into a SUCCEEDED remote step that
  // publishes a fact nobody proved.
  it('fails on an inner business failure code hidden under an outer 200', async () => {
    const adapter = createNesyBackofficeAdapter({
      credentials: () => ({ baseUrl: 'https://nesy.example', token: 't' }),
      fetchImpl: async () =>
        envelope({ resultCode: 400, resultMessage: 'No such user', payload: {} }),
    })

    const result = await adapter.call(
      { operationRef: 'nesy.backoffice.read-session', inputs: {}, timeoutMs: 1_000 },
      AUDIT,
    )

    expect(result.terminal.status).toBe('FAILED')
    expect(result.terminal.error).toContain('No such user')
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
