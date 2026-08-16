import { describe, expect, it } from 'vitest'
import { buildNesyCourierBundle } from '@nesy/nesy-courier-domain-pack'

import { createNesyBackofficeAdapter, redact } from './nesy-backoffice-adapter.js'
import { NESY_BACKOFFICE_ENDPOINTS, SCHEDULE_STATUS } from './nesy-backoffice-endpoints.js'
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

        // A `responsePath` that resolves to a non-boolean publishes as UNKNOWN.
        // For most operations that is a broken empty-path. Delivery proof is
        // the exception: an empty list is the product's 120s TwoDelayFlow
        // pending interval, and inventing `false` skips the pack EVENTUAL.
        for (const output of operation.outputs) {
          const value = readTestPath(normalized, output.responsePath)
          if (!hasPath(normalized, output.responsePath) || typeof value === 'boolean') continue
          if (
            operation.operationRef === 'nesy.backoffice.read-delivery-status' &&
            output.responsePath === 'delivery.completed' &&
            value === null
          ) {
            continue
          }
          missing.push(`${operation.operationRef}: ${output.responsePath} is ${typeof value}, not boolean`)
        }
      }
    }

    expect(missing).toEqual([])
  })

  it('rejects a leaving-permission request as a JSON array, not the approve object shape', () => {
    const endpoint = NESY_BACKOFFICE_ENDPOINTS['nesy.backoffice.reject-tour-request']!
    expect(endpoint.path).toBe('Task/RejectLeavingPermission')
    expect(endpoint.body({ approvalRequest: '11-31-20260815-1' })).toEqual([
      { ScheduleId: '11-31-20260815-1', RejectionReason: 0 },
    ])
  })

  it('refuses reject-tour-request without a schedule id', async () => {
    let fetchCalls = 0
    const adapter = createNesyBackofficeAdapter({
      credentials: () => ({ baseUrl: 'https://nesy.example', token: 't' }),
      fetchImpl: async () => {
        fetchCalls += 1
        return envelope('Request(s) are rejected')
      },
    })
    const result = await adapter.call(
      { operationRef: 'nesy.backoffice.reject-tour-request', inputs: {}, timeoutMs: 5_000 },
      AUDIT,
    )
    expect(result.terminal.status).toBe('FAILED')
    expect((result.terminal as { error: string }).error).toMatch(/approvalRequest/)
    expect(fetchCalls).toBe(0)
  })

  it('does not treat reject transport success as cleanup if the schedule is still waiting', async () => {
    const paths: string[] = []
    const adapter = createNesyBackofficeAdapter({
      credentials: () => ({ baseUrl: 'https://nesy.example', token: 't' }),
      reconcileDelayMs: 0,
      fetchImpl: async (url) => {
        paths.push(String(url))
        if (String(url).includes('RejectLeavingPermission')) {
          return envelope('Request(s) are rejected')
        }
        return envelope([{ scheduleId: '11-31-20260815-1', scheduleStatus: SCHEDULE_STATUS.waitingForApproval }])
      },
    })
    const result = await adapter.call(
      {
        operationRef: 'nesy.backoffice.reject-tour-request',
        inputs: { approvalRequest: '11-31-20260815-1' },
        timeoutMs: 5_000,
      },
      AUDIT,
    )
    expect(result.terminal.status).toBe('FAILED')
    expect((result.terminal as { error: string }).error).toMatch(/WaitingForApproval/)
    expect(paths.some((path) => path.includes('RejectLeavingPermission'))).toBe(true)
    expect(paths.some((path) => path.includes('GetWaitingLeavingRequests'))).toBe(true)
  })

  it('accepts reject only after the waiting list no longer holds the schedule', async () => {
    const adapter = createNesyBackofficeAdapter({
      credentials: () => ({ baseUrl: 'https://nesy.example', token: 't' }),
      reconcileDelayMs: 0,
      fetchImpl: async (url) => {
        if (String(url).includes('RejectLeavingPermission')) {
          return envelope('Request(s) are rejected')
        }
        return envelope([])
      },
    })
    const result = await adapter.call(
      {
        operationRef: 'nesy.backoffice.reject-tour-request',
        inputs: { approvalRequest: '11-31-20260815-1' },
        timeoutMs: 5_000,
      },
      AUDIT,
    )
    expect(result.terminal.status).toBe('SUCCEEDED')
  })

  it('approves the tour through the leaving-permission flow, not the mobile approval queue', () => {
    const endpoint = NESY_BACKOFFICE_ENDPOINTS['nesy.backoffice.approve-tour-request']!
    expect(endpoint.path).toBe('Task/ApproveLeavingPermission')
    expect(endpoint.body({ approvalRequest: '11-31-20260812-1' })).toEqual({
      ScheduleIds: ['11-31-20260812-1'],
      // Present even though the service overwrites the coordinates: it reads the
      // field before it writes it.
      EventLocation: { Lat: 0, Lon: 0 },
      CourierUserNames: [],
    })
  })

  it('reads both approval facts from the leaving-request list', () => {
    const created = NESY_BACKOFFICE_ENDPOINTS['nesy.backoffice.read-tour-approval-request']!
    const status = NESY_BACKOFFICE_ENDPOINTS['nesy.backoffice.read-tour-approval-status']!
    expect(created.path).toBe('Task/GetWaitingLeavingRequests')
    expect(status.path).toBe('Task/GetWaitingLeavingRequests')
    expect(created.body({})).toEqual({})
  })

  it('separates "a request exists" from "that request was approved"', () => {
    const created = NESY_BACKOFFICE_ENDPOINTS['nesy.backoffice.read-tour-approval-request']!
    const status = NESY_BACKOFFICE_ENDPOINTS['nesy.backoffice.read-tour-approval-status']!
    // The schedule is listed, but still waiting. An existence check alone would
    // call this approved; that is the whole reason there are two facts.
    const waiting = [{ scheduleId: 'mine', scheduleStatus: SCHEDULE_STATUS.waitingForApproval }]

    expect(created.normalize!(waiting, { approvalRequest: 'mine' })).toMatchObject({
      request: { exists: true, scheduleId: 'mine' },
    })
    expect(status.normalize!(waiting, { approvalRequest: 'mine' })).toMatchObject({
      approval: { statusIsApproved: false, status: SCHEDULE_STATUS.waitingForApproval },
    })
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

  it('matches RS staging proof rows by camelCase waybillNumber', () => {
    const endpoint = NESY_BACKOFFICE_ENDPOINTS['nesy.backoffice.read-delivery-status']!
    const liveRow = {
      waybillNumber: '40515485408297',
      shipmentStatus: 'Delivered',
      eventType: 'Delivered',
    }
    expect(endpoint.normalize!([liveRow], { shipment: '40515485408297' })).toMatchObject({
      delivery: {
        completed: true,
        status: 'PROOF_AVAILABLE',
        correlationId: '40515485408297',
        shipmentId: '40515485408297',
      },
    })
    expect(endpoint.normalize!([liveRow], { shipment: '32566991114744' })).toMatchObject({
      delivery: { completed: null, status: 'REMOTE_PENDING' },
    })
  })

  it('does not invent completed=false from an empty proof list', () => {
    const endpoint = NESY_BACKOFFICE_ENDPOINTS['nesy.backoffice.read-delivery-status']!
    expect(endpoint.normalize!([], { shipment: '40515485408297' })).toMatchObject({
      delivery: { completed: null, status: 'REMOTE_PENDING', shipmentId: '40515485408297' },
    })
  })

  it('reads the approval fact from this run\'s schedule, not from any approved schedule', () => {
    const endpoint = NESY_BACKOFFICE_ENDPOINTS['nesy.backoffice.read-tour-approval-status']!
    // The hub list really does look like this — 47 rows on RS staging, most of
    // them other couriers' tours, several already approved.
    const payload = [
      { scheduleId: 'someone-else', scheduleStatus: SCHEDULE_STATUS.approved },
      { scheduleId: 'mine', scheduleStatus: SCHEDULE_STATUS.approved },
    ]
    expect(endpoint.normalize!(payload, { approvalRequest: 'mine' })).toMatchObject({
      approval: { statusIsApproved: true, scheduleId: 'mine' },
    })
    expect(endpoint.normalize!(payload, { approvalRequest: 'absent' })).toMatchObject({
      approval: { statusIsApproved: false, scheduleId: null },
    })
    // An empty scheduleId must never fall through to the first row.
    expect(endpoint.normalize!(payload, {})).toMatchObject({
      approval: { statusIsApproved: false, scheduleId: null },
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

  it('forces the adapter deadline when a timeout injection is armed', async () => {
    const events: string[] = []
    let fetchCalls = 0
    const adapter = createNesyBackofficeAdapter({
      credentials: () => ({ baseUrl: 'https://nesy.example', token: 't' }),
      fetchImpl: async () => {
        fetchCalls += 1
        throw new Error('must not reach the network when the injector is armed')
      },
      timeoutInjection: () => ({ timeoutMs: 20 }),
      onTimeoutInjected: (event) => events.push(event.kind),
    })

    const result = await adapter.call(
      { operationRef: 'nesy.backoffice.approve-tour-request', inputs: { approvalRequest: 's1' }, timeoutMs: 20_000 },
      AUDIT,
    )

    expect(result.terminal.status).toBe('UNKNOWN_EFFECT')
    expect(result.terminal.error).toMatch(/injected adapter deadline/)
    expect(fetchCalls).toBe(0)
    expect(events).toEqual(['TRIGGERED', 'EFFECT_OBSERVED'])
  })

  it('cuts host transport immediately when a network-disconnect injection is armed', async () => {
    const events: string[] = []
    let fetchCalls = 0
    const adapter = createNesyBackofficeAdapter({
      credentials: () => ({ baseUrl: 'https://nesy.example', token: 't' }),
      fetchImpl: async () => {
        fetchCalls += 1
        throw new Error('must not reach the network when the transport injector is armed')
      },
      transportInjection: () => ({ cut: true }),
      onTransportInjected: (event) => events.push(event.kind),
    })

    const result = await adapter.call(
      { operationRef: 'nesy.backoffice.approve-tour-request', inputs: { approvalRequest: 's1' }, timeoutMs: 20_000 },
      AUDIT,
    )

    expect(result.terminal.status).toBe('UNKNOWN_EFFECT')
    expect(result.terminal.error).toMatch(/injected host transport cut/)
    expect(fetchCalls).toBe(0)
    expect(events).toEqual(['TRIGGERED', 'EFFECT_OBSERVED'])
  })

  it('refuses to arm timeout and transport injectors on the same call', async () => {
    const adapter = createNesyBackofficeAdapter({
      credentials: () => ({ baseUrl: 'https://nesy.example', token: 't' }),
      fetchImpl: async () => {
        throw new Error('must not fetch')
      },
      timeoutInjection: () => ({ timeoutMs: 20 }),
      transportInjection: () => ({ cut: true }),
    })

    const result = await adapter.call(
      { operationRef: 'nesy.backoffice.approve-tour-request', inputs: { approvalRequest: 's1' }, timeoutMs: 20_000 },
      AUDIT,
    )

    expect(result.terminal.status).toBe('FAILED')
    expect(result.terminal.error).toMatch(/conflicting timeout and transport/)
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

  it('resolves an entityRef input from the spec entityBinding when no step published one', async () => {
    // The failure this closes: `approvalRequest` resolved to undefined, the
    // adapter searched for the empty string, the read answered "no such record",
    // and the step still reported SUCCEEDED. Two runs looked healthy to the last
    // step before the Final Oracle failed for want of evidence never requested.
    let seenInputs: Record<string, unknown> | undefined
    const entityStep = {
      ...step,
      params: {
        spec: {
          ...spec,
          inputBindings: [{ name: 'approvalRequest', source: { kind: 'entityRef' } }],
          entityBinding: { type: 'TOUR_APPROVAL_REQUEST', id: 'run.input.scheduleId' },
        },
      },
    }
    const runtime = createPackRemoteStepRuntime({
      runId: 'run-1',
      bundle,
      adapter: {
        call: async (input) => {
          seenInputs = { ...input.inputs }
          return {
            terminal: { status: 'SUCCEEDED' },
            normalizedResponse: { approval: { statusIsApproved: true } },
          }
        },
      },
      // Nothing published `approvalRequest`, which is the normal case: the
      // schedule id is a run input, not something an earlier step observed.
      variables: new BridgeFlowRunContext(),
      evidence: new BridgeFlowEvidenceRuntime({ now: () => 1_000 }),
      runInputs: { scheduleId: '11-31-20260812-1' },
      clock: () => 1_000,
    })

    await runtime.execute(entityStep as never, STEP_CONTEXT as never)
    expect(seenInputs?.approvalRequest).toBe('11-31-20260812-1')
  })

  it("carries the operation's declared correlationPath onto the published fact", async () => {
    // Without this the fact is true but anonymous, and a CORRELATED_ALL_OF
    // derivation refuses anonymous inputs — measured on device as three
    // SATISFIED requirements under a REQUIRED_TIMEOUT conclusion.
    const evidence = new BridgeFlowEvidenceRuntime({ now: () => 1_000 })
    const runtime = createPackRemoteStepRuntime({
      runId: 'run-1',
      bundle,
      adapter: {
        call: async () => ({
          terminal: { status: 'SUCCEEDED' },
          normalizedResponse: {
            approval: { statusIsApproved: true, scheduleId: '11-31-20260812-1' },
          },
        }),
      },
      variables: new BridgeFlowRunContext(),
      evidence,
      runInputs: { approvalRequestCode: '11-31-20260812-1' },
      clock: () => 1_000,
    })

    await runtime.execute(step as never, STEP_CONTEXT as never)

    const [fact] = evidence.currentFacts(
      { runId: 'run-1', occurrenceId: 'occ-1', iterationKey: '' },
      1_000,
      'ORDERED_REQUIRED',
    )
    expect(fact?.correlationValue).toBe('11-31-20260812-1')
  })

  it('publishes the backend fact into the run evidence scope so the oracle can settle', async () => {
    const evidence = new BridgeFlowEvidenceRuntime({ now: () => 1_000 })
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
    const evidence = new BridgeFlowEvidenceRuntime({ now: () => 1_000 })
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

  // An unreachable back office aborted a login run whose backend requirement was
  // OPTIONAL anyway — reporting an infrastructure outage as if the product were
  // untestable, when the run could have judged itself on the planes it observed.
  it('continues past a read-only validation that could not be reached, recording it UNKNOWN', async () => {
    const bundle = buildNesyCourierBundle()
    const evidence = new BridgeFlowEvidenceRuntime({ now: () => 1_000 })
    const runtime = createPackRemoteStepRuntime({
      runId: STEP_CONTEXT.runId,
      bundle,
      adapter: {
        call: async () => ({
          terminal: { status: 'FAILED', error: 'back-office unreachable' },
          normalizedResponse: {},
        }),
      },
      variables: new BridgeFlowRunContext(),
      evidence,
      clock: () => 0,
    })

    const result = await runtime.execute(
      {
        planStepId: 'verify-backend-session',
        kind: 'REMOTE_ACTION',
        params: {
          spec: {
            adapterRef: 'nesy.backoffice',
            operationRef: 'nesy.backoffice.read-session',
            role: 'VALIDATION',
            effectClass: 'READ_ONLY',
            idempotencyClass: 'NATURALLY_IDEMPOTENT',
            inputBindings: [],
            outputFactBindings: [{ factKey: 'REMOTE.AUTH_ACCEPTED', responsePath: 'session.accepted' }],
            timeoutPolicy: { timeoutMs: 1_000, maxAttempts: 1 },
            onUnavailable: 'RECORD_UNMEASURED',
            reconciliationPolicy: 'NONE',
            auditPolicy: { recordRequest: true, recordResponse: true },
          },
        },
      } as never,
      STEP_CONTEXT as never,
    )

    // The run continues, and the step still says FAILED: a green row for a call
    // that never answered would be a lie told to whoever reads the run later.
    expect(result.succeeded).toBe(true)
    expect(result.actionResult).toBe('FAILED')

    const facts = evidence.currentFacts(
      { runId: STEP_CONTEXT.runId, occurrenceId: STEP_CONTEXT.occurrenceId, iterationKey: STEP_CONTEXT.iterationKey },
      0,
      'ORDERED_REQUIRED',
    )
    // UNKNOWN, never false — "we tried and could not tell" is the honest claim.
    expect(facts.map((f) => [f.factKey, f.value])).toEqual([['REMOTE.AUTH_ACCEPTED', 'UNKNOWN']])
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

  it('does not arm BD.3 on a READ_ONLY validation', async () => {
    const { createBackendTimeoutSession } = await import('./backend-timeout-injector.js')
    const session = createBackendTimeoutSession({
      injectedFault: 'BACKEND_TIMEOUT',
      clock: () => 1_000,
    })
    session.request()
    const runtime = createPackRemoteStepRuntime({
      runId: 'run-1',
      bundle,
      backendTimeout: session,
      adapter: {
        call: async () => ({
          terminal: { status: 'SUCCEEDED' },
          normalizedResponse: { approval: { statusIsApproved: true } },
        }),
      },
      variables: new BridgeFlowRunContext(),
      evidence: new BridgeFlowEvidenceRuntime(),
      clock: () => 1_000,
    })

    await runtime.execute(step as never, STEP_CONTEXT as never)
    expect(session.snapshot().phase).toBe('REQUESTED')
    expect(session.snapshot().actuallyFired).toBe(false)
  })

  it('arms BD.3 on a mutation remote and leaves observedClass to the classifier', async () => {
    const { createBackendTimeoutSession } = await import('./backend-timeout-injector.js')
    const session = createBackendTimeoutSession({
      injectedFault: 'BACKEND_TIMEOUT',
      clock: () => 1_000,
    })
    session.request()
    const mutationStep = {
      ...step,
      planStepId: 'approve',
      params: {
        spec: {
          adapterRef: 'nesy.backoffice',
          operationRef: 'nesy.backoffice.approve-tour-request',
          role: 'SETUP',
          effectClass: 'IDEMPOTENT_MUTATION',
          idempotencyClass: 'KEYED',
          idempotencyKey: 'approvalRequest',
          inputBindings: [{ name: 'approvalRequest', source: { kind: 'runInput', path: 'approvalRequestCode' } }],
          outputFactBindings: [],
          timeoutPolicy: { timeoutMs: 20_000, maxAttempts: 1 },
          reconciliationPolicy: 'RECONCILE_ON_UNKNOWN',
          auditPolicy: { recordRequest: true, recordResponse: true, redactFields: [] },
        },
      },
    }
    const runtime = createPackRemoteStepRuntime({
      runId: 'run-1',
      bundle,
      backendTimeout: session,
      adapter: {
        call: async () => ({
          terminal: { status: 'UNKNOWN_EFFECT', error: 'injected adapter deadline fired after 80ms; effect unknown' },
          normalizedResponse: {},
        }),
      },
      variables: new BridgeFlowRunContext(),
      evidence: new BridgeFlowEvidenceRuntime(),
      clock: () => 1_000,
    })

    const result = await runtime.execute(mutationStep as never, STEP_CONTEXT as never)
    expect(result).toMatchObject({ succeeded: false, actionResult: 'UNKNOWN_EFFECT' })
    expect(session.snapshot().phase).toBe('ARMED')
    expect(session.snapshot().actuallyFired).toBe(false)
  })

  it('does not re-arm BD.3 on a TEARDOWN cleanup', async () => {
    const { createBackendTimeoutSession } = await import('./backend-timeout-injector.js')
    const session = createBackendTimeoutSession({
      injectedFault: 'BACKEND_TIMEOUT',
      clock: () => 1_000,
    })
    session.request()
    session.tryArm({
      planStepId: 'dispatcher-approves',
      occurrenceId: 'occ-approve',
      spec: {
        effectClass: 'IDEMPOTENT_MUTATION',
        operationRef: 'nesy.backoffice.approve-tour-request',
        timeoutPolicy: { timeoutMs: 30_000, maxAttempts: 1 },
      },
    })
    session.markTriggered('nesy.backoffice.approve-tour-request', 80)
    session.markDeadlineObserved()
    const armedPoint = session.snapshot().triggerPoint

    let called = false
    const runtime = createPackRemoteStepRuntime({
      runId: 'run-1',
      bundle,
      backendTimeout: session,
      adapter: {
        call: async (input) => {
          called = true
          expect(input.operationRef).toBe('nesy.backoffice.reject-tour-request')
          return { terminal: { status: 'SUCCEEDED' }, normalizedResponse: {} }
        },
      },
      variables: new BridgeFlowRunContext(),
      evidence: new BridgeFlowEvidenceRuntime(),
      runInputs: { scheduleId: '11-31-20260815-1' },
      clock: () => 2_000,
    })

    const cleanupStep = {
      planStepId: 'release-approval-fixture',
      kind: 'CLEANUP' as const,
      sourceMapRef: 'src:cleanup',
      timeoutMs: 40_000,
      next: null,
      capabilityRequirements: [],
      evidenceRequirements: [],
      params: {
        spec: {
          adapterRef: 'nesy.backoffice',
          operationRef: 'nesy.backoffice.reject-tour-request',
          role: 'TEARDOWN',
          effectClass: 'IDEMPOTENT_MUTATION',
          idempotencyClass: 'KEYED',
          idempotencyKey: 'run.input.scheduleId',
          inputBindings: [{ name: 'approvalRequest', source: { kind: 'entityRef' } }],
          outputFactBindings: [],
          timeoutPolicy: { timeoutMs: 30_000, maxAttempts: 1 },
          entityBinding: { type: 'TOUR_APPROVAL_REQUEST', id: 'run.input.scheduleId' },
          reconciliationPolicy: 'RECONCILE_BEFORE_RELEASE',
          auditPolicy: { recordRequest: true, recordResponse: true, redactFields: [] },
        },
      },
    }

    const result = await runtime.execute(cleanupStep as never, STEP_CONTEXT as never)
    expect(result).toMatchObject({ succeeded: true, actionResult: 'SUCCEEDED' })
    expect(called).toBe(true)
    expect(session.snapshot().triggerPoint).toBe(armedPoint)
    expect(session.snapshot().phase).toBe('EFFECT_OBSERVED')
    expect(session.injectionForCall('nesy.backoffice.reject-tour-request')).toBeNull()
  })

  it('does not arm BD.2 on a READ_ONLY validation', async () => {
    const { createNetworkDisconnectSession } = await import('./network-disconnect-injector.js')
    const session = createNetworkDisconnectSession({
      injectedFault: 'NETWORK_DISCONNECT',
      clock: () => 1_000,
    })
    session.request()
    const runtime = createPackRemoteStepRuntime({
      runId: 'run-1',
      bundle,
      networkDisconnect: session,
      adapter: {
        call: async () => ({
          terminal: { status: 'SUCCEEDED' },
          normalizedResponse: { approval: { statusIsApproved: true } },
        }),
      },
      variables: new BridgeFlowRunContext(),
      evidence: new BridgeFlowEvidenceRuntime(),
      clock: () => 1_000,
    })

    await runtime.execute(step as never, STEP_CONTEXT as never)
    expect(session.snapshot().phase).toBe('REQUESTED')
    expect(session.snapshot().actuallyFired).toBe(false)
  })

  it('arms BD.2 on a mutation remote and leaves observedClass to the classifier', async () => {
    const { createNetworkDisconnectSession } = await import('./network-disconnect-injector.js')
    const session = createNetworkDisconnectSession({
      injectedFault: 'NETWORK_DISCONNECT',
      clock: () => 1_000,
    })
    session.request()
    const mutationStep = {
      ...step,
      planStepId: 'approve',
      params: {
        spec: {
          adapterRef: 'nesy.backoffice',
          operationRef: 'nesy.backoffice.approve-tour-request',
          role: 'SETUP',
          effectClass: 'IDEMPOTENT_MUTATION',
          idempotencyClass: 'KEYED',
          idempotencyKey: 'approvalRequest',
          inputBindings: [{ name: 'approvalRequest', source: { kind: 'runInput', path: 'approvalRequestCode' } }],
          outputFactBindings: [],
          timeoutPolicy: { timeoutMs: 20_000, maxAttempts: 1 },
          reconciliationPolicy: 'RECONCILE_ON_UNKNOWN',
          auditPolicy: { recordRequest: true, recordResponse: true, redactFields: [] },
        },
      },
    }
    const runtime = createPackRemoteStepRuntime({
      runId: 'run-1',
      bundle,
      networkDisconnect: session,
      adapter: {
        call: async () => ({
          terminal: { status: 'UNKNOWN_EFFECT', error: 'injected host transport cut; effect unknown' },
          normalizedResponse: {},
        }),
      },
      variables: new BridgeFlowRunContext(),
      evidence: new BridgeFlowEvidenceRuntime(),
      clock: () => 1_000,
    })

    const result = await runtime.execute(mutationStep as never, STEP_CONTEXT as never)
    expect(result).toMatchObject({ succeeded: false, actionResult: 'UNKNOWN_EFFECT' })
    expect(session.snapshot().phase).toBe('ARMED')
    expect(session.snapshot().actuallyFired).toBe(false)
  })

  it('does not re-arm BD.2 on a TEARDOWN cleanup', async () => {
    const { createNetworkDisconnectSession } = await import('./network-disconnect-injector.js')
    const session = createNetworkDisconnectSession({
      injectedFault: 'NETWORK_DISCONNECT',
      clock: () => 1_000,
    })
    session.request()
    session.tryArm({
      planStepId: 'dispatcher-approves',
      occurrenceId: 'occ-approve',
      spec: {
        effectClass: 'IDEMPOTENT_MUTATION',
        operationRef: 'nesy.backoffice.approve-tour-request',
        timeoutPolicy: { timeoutMs: 30_000, maxAttempts: 1 },
      },
    })
    session.markTriggered('nesy.backoffice.approve-tour-request')
    session.markTransportObserved()
    const armedPoint = session.snapshot().triggerPoint

    let called = false
    const runtime = createPackRemoteStepRuntime({
      runId: 'run-1',
      bundle,
      networkDisconnect: session,
      adapter: {
        call: async (input) => {
          called = true
          expect(input.operationRef).toBe('nesy.backoffice.reject-tour-request')
          return { terminal: { status: 'SUCCEEDED' }, normalizedResponse: {} }
        },
      },
      variables: new BridgeFlowRunContext(),
      evidence: new BridgeFlowEvidenceRuntime(),
      runInputs: { scheduleId: '11-31-20260815-1' },
      clock: () => 2_000,
    })

    const cleanupStep = {
      planStepId: 'release-approval-fixture',
      kind: 'CLEANUP' as const,
      sourceMapRef: 'src:cleanup',
      timeoutMs: 40_000,
      next: null,
      capabilityRequirements: [],
      evidenceRequirements: [],
      params: {
        spec: {
          adapterRef: 'nesy.backoffice',
          operationRef: 'nesy.backoffice.reject-tour-request',
          role: 'TEARDOWN',
          effectClass: 'IDEMPOTENT_MUTATION',
          idempotencyClass: 'KEYED',
          idempotencyKey: 'run.input.scheduleId',
          inputBindings: [{ name: 'approvalRequest', source: { kind: 'entityRef' } }],
          outputFactBindings: [],
          timeoutPolicy: { timeoutMs: 30_000, maxAttempts: 1 },
          entityBinding: { type: 'TOUR_APPROVAL_REQUEST', id: 'run.input.scheduleId' },
          reconciliationPolicy: 'RECONCILE_BEFORE_RELEASE',
          auditPolicy: { recordRequest: true, recordResponse: true, redactFields: [] },
        },
      },
    }

    const result = await runtime.execute(cleanupStep as never, STEP_CONTEXT as never)
    expect(result).toMatchObject({ succeeded: true, actionResult: 'SUCCEEDED' })
    expect(called).toBe(true)
    expect(session.snapshot().triggerPoint).toBe(armedPoint)
    expect(session.snapshot().phase).toBe('EFFECT_OBSERVED')
    expect(session.injectionForCall('nesy.backoffice.reject-tour-request')).toBeNull()
  })
})
