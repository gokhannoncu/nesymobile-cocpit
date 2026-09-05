import { describe, expect, it } from 'vitest'
import {
  buildRunDetailViewModel,
  formatBytes,
  formatDuration,
  stepLabelOf,
  stepResultOf,
} from './run-detail-view-model'
import type { RunDetailResult, RunTelemetryDto } from './types'

function detail(overrides: Partial<RunDetailResult> = {}): RunDetailResult {
  return {
    apiVersion: 'verdict-runtime.v1',
    run: { id: 'run-1' },
    runtime: null,
    partial: false,
    correlation: { runId: 'run-1', engineType: 'BRIDGEFLOW' },
    steps: [],
    waits: [],
    actionTransitions: [],
    oracleEvaluations: [],
    testExecutions: [],
    resourceLeases: [],
    remoteActions: [],
    ...overrides,
  }
}

function telemetry(overrides: Partial<RunTelemetryDto> = {}): RunTelemetryDto {
  return {
    apiVersion: 'verdict-run-telemetry.v1',
    runId: 'run-1',
    measurementState: 'UNAVAILABLE',
    summary: {
      durationMs: null,
      eventCount: null,
      memoryPeakBytes: null,
      riskCounts: null,
      httpCount: null,
      httpErrorRate: null,
      httpP50Ms: null,
      httpP95Ms: null,
      spanCount: null,
    },
    memorySamples: [],
    httpCalls: [],
    httpBodies: [],
    spans: [],
    incidents: [],
    eventBuckets: [],
    latestHealth: null,
    streamHealth: [],
    diagnosticCaptures: [],
    sections: {},
    ...overrides,
  }
}

describe('run detail manager view model', () => {
  it('fails closed instead of inventing PASS or zero measurements', () => {
    const view = buildRunDetailViewModel(detail(), telemetry())

    expect(view.kpis.map((item) => item.value)).toEqual([
      'NOT_MEASURED',
      'NOT_MEASURED',
      'NOT_MEASURED',
      'NOT_MEASURED',
      'NOT_MEASURED',
      'NOT_MEASURED',
    ])
    expect(view.outcomes.every((item) => item.value === 'NOT_MEASURED')).toBe(true)
    expect(JSON.stringify(view)).not.toContain('"PASS"')
    expect(view.comparisons.map((row) => row.status)).toEqual([
      'UNAVAILABLE',
      'UNAVAILABLE',
      'UNAVAILABLE',
    ])
  })

  it('uses persisted gate and oracle outcomes without a hardcoded PASS', () => {
    const view = buildRunDetailViewModel(
      detail({
        run: { id: 'run-1', status: 'COMPLETED', outcome: 'FAIL' },
        waits: [{ id: 'wait-1', kind: 'CONTINUE_GATE', outcome: 'BLOCKED' }],
        oracleEvaluations: [{ id: 'oracle-1', outcome: 'FAIL', createdAt: '2026-08-13T09:00:00Z' }],
      }),
    )

    expect(view.outcomes.find((item) => item.key === 'gate')?.value).toBe('BLOCKED')
    expect(view.outcomes.find((item) => item.key === 'oracle')?.value).toBe('FAIL')
    expect(view.timeline.map((item) => item.result)).toContain('BLOCKED')
    expect(view.timeline.map((item) => item.result)).toContain('FAIL')
  })

  it('maps BridgeFlow step occurrences instead of showing NOT_MEASURED for every row', () => {
    const row = {
      plan_step_id: 'login.submit',
      lifecycle: 'COMPLETED',
      action_result: 'SUCCEEDED',
      continue_gate_result: 'NOT_EVALUATED',
      final_oracle_result: 'NOT_EVALUATED',
    }

    expect(stepLabelOf(row, 0)).toBe('login.submit')
    expect(stepResultOf(row)).toBe('SUCCEEDED')

    const pending = {
      plan_step_id: 'route.select',
      lifecycle: 'PENDING',
      action_result: 'NOT_STARTED',
    }
    expect(stepResultOf(pending)).toBe('PENDING')

    const view = buildRunDetailViewModel(
      detail({
        steps: [row, pending],
      }),
    )

    expect(view.workflowPath).toEqual([
      expect.objectContaining({ label: 'login.submit', status: 'SUCCEEDED', tone: 'green', layers: null }),
      expect.objectContaining({ label: 'route.select', status: 'PENDING', tone: 'gray', layers: null }),
    ])
    expect(view.diagram.every((element) => !('layers' in element) || element.layers !== undefined)).toBe(true)
    expect(view.kpis.find((item) => item.key === 'progress')?.value).toBe('1/2')
  })

  it('reports a timed-out continue gate over a successful action', () => {
    // Measured on run_3ef0e142: the gesture landed and the step's own closing
    // condition then timed out, which is what STOPPED the run — and the step
    // rendered green, leaving a cleanup three legs away as the only red row in
    // the report.
    const row = {
      plan_step_id: 'deliver-tap-scan-confirm',
      action_result: 'SUCCEEDED',
      continue_gate_result: 'TIMED_OUT',
      final_oracle_result: 'NOT_EVALUATED',
      lifecycle: 'COMPLETED',
    }
    expect(stepResultOf(row)).toBe('TIMED_OUT')
  })

  it('still prefers a failed action over the gate', () => {
    // A gesture that never landed is the more specific answer; the gate does not
    // even run on it.
    const row = {
      plan_step_id: 'deliver-tap-scan-confirm',
      action_result: 'FAILED',
      continue_gate_result: 'TIMED_OUT',
    }
    expect(stepResultOf(row)).toBe('FAILED')
  })

  it('leaves a satisfied gate out of the way', () => {
    const row = {
      plan_step_id: 'deliver-tap-scan-confirm',
      action_result: 'SUCCEEDED',
      continue_gate_result: 'SATISFIED',
    }
    expect(stepResultOf(row)).toBe('SUCCEEDED')
  })

  it('builds a flow diagram for long execution paths', () => {
    const steps = Array.from({ length: 12 }, (_, index) => ({
      plan_step_id: `step-${index + 1}`,
      lifecycle: index < 6 ? 'COMPLETED' : 'PENDING',
      action_result: index < 6 ? 'SUCCEEDED' : 'NOT_STARTED',
    }))

    const view = buildRunDetailViewModel(detail({ steps }))
    expect(view.workflowPath).toHaveLength(12)
    expect(view.diagram.filter((element) => element.type === 'node')).toHaveLength(14)
  })

  it('projects measured telemetry into KPI and chart data', () => {
    const view = buildRunDetailViewModel(
      detail({ steps: [{ id: 's1', displayName: 'Login', status: 'COMPLETED' }] }),
      telemetry({
        measurementState: 'PARTIAL',
        summary: {
          durationMs: 12_400,
          eventCount: 17,
          memoryPeakBytes: 128 * 1024 * 1024,
          riskCounts: { warning: 1, error: 0, critical: 0 },
          httpCount: 1,
          httpErrorRate: 0,
          httpP50Ms: 90,
          httpP95Ms: 90,
          spanCount: 1,
        },
        memorySamples: [{
          atMs: 100,
          pid: 9,
          totalBytes: 100,
          peakBytes: 128 * 1024 * 1024,
          heapUsedBytes: 64,
          heapCommittedBytes: 96,
          heapMaxBytes: 128,
          nativeAllocatedBytes: 16,
          rssBytes: null,
          pssBytes: null,
          javaHeapUsedBytes: null,
          javaHeapMaxBytes: null,
          nativeHeapAllocatedBytes: null,
          lowMemory: false,
        }],
        httpCalls: [{
          atMs: 150,
          requestId: 'req-1',
          method: 'GET',
          host: 'example.test',
          path: '/health',
          code: 200,
          status: 200,
          success: true,
          durationMs: 90,
          bytesIn: 20,
          bytesOut: 10,
        }],
        spans: [{ name: 'login', startMs: 0, durationMs: 500, status: 'OK' }],
        eventBuckets: [{ startMs: 0, count: 17 }],
      }),
    )

    expect(view.kpis.find((item) => item.key === 'duration')?.value).toBe('12 s')
    expect(view.kpis.find((item) => item.key === 'events')?.value).toBe('17')
    expect(view.kpis.find((item) => item.key === 'risks')?.value).toBe('1')
    expect(view.charts.memory).toHaveLength(1)
    expect(view.charts.http[0]?.durationMs).toBe(90)
    expect(view.charts.spans[0]?.name).toBe('login')
    expect(view.charts.throughput).toEqual([{ startMs: 0, count: 17 }])
    expect(formatDuration(500)).toBe('500 ms')
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB')
  })

  it('joins a captured body to its call by requestId', () => {
    const view = buildRunDetailViewModel(
      detail(),
      telemetry({
        httpCalls: [{
          atMs: 150,
          requestId: 'req-1',
          method: 'POST',
          host: 'example.test',
          path: '/login',
          code: 200,
          status: 200,
          success: true,
          durationMs: 90,
          bytesIn: 20,
          bytesOut: 10,
        }],
        httpBodies: [{
          requestId: 'req-1',
          direction: 'RESPONSE',
          contentType: 'application/json',
          originalBytes: 61,
          capturedBytes: 61,
          truncated: false,
          omittedReason: null,
          encoding: 'utf8',
          atMs: 150,
          chunkCount: 1,
          chunksReceived: 1,
          complete: true,
          withheld: false,
          purged: false,
          body: '{"ok":true}',
        }],
      }),
    )

    expect(view.charts.network).toHaveLength(1)
    expect(view.charts.network[0]?.response?.body).toBe('{"ok":true}')
    expect(view.charts.network[0]?.request).toBeNull()
  })

  it('keeps a body whose call never arrived instead of dropping it', () => {
    // Bodies leave the interceptor and HTTP_CALL leaves the EventListener, so a
    // body normally arrives first; an orphan is ordinary, not a corruption.
    const view = buildRunDetailViewModel(
      detail(),
      telemetry({
        httpCalls: [],
        httpBodies: [{
          requestId: 'req-orphan',
          direction: 'REQUEST',
          contentType: 'application/json',
          originalBytes: 12,
          capturedBytes: 12,
          truncated: false,
          omittedReason: null,
          encoding: 'utf8',
          atMs: 20,
          chunkCount: 1,
          chunksReceived: 1,
          complete: true,
          withheld: false,
          purged: false,
          body: '{"id":1}',
        }],
      }),
    )

    expect(view.charts.network).toHaveLength(1)
    expect(view.charts.network[0]?.call.requestId).toBe('req-orphan')
    expect(view.charts.network[0]?.call.method).toBeNull()
    expect(view.charts.network[0]?.request?.body).toBe('{"id":1}')
  })

  it('does not guess a body for a call that carries no requestId', () => {
    const view = buildRunDetailViewModel(
      detail(),
      telemetry({
        httpCalls: [{
          atMs: 150,
          requestId: null,
          method: 'GET',
          host: 'example.test',
          path: '/health',
          code: 200,
          status: 200,
          success: true,
          durationMs: 90,
          bytesIn: 20,
          bytesOut: 10,
        }],
        httpBodies: [{
          requestId: 'req-1',
          direction: 'RESPONSE',
          contentType: 'application/json',
          originalBytes: 11,
          capturedBytes: 11,
          truncated: false,
          omittedReason: null,
          encoding: 'utf8',
          atMs: 150,
          chunkCount: 1,
          chunksReceived: 1,
          complete: true,
          withheld: false,
          purged: false,
          body: '{"ok":true}',
        }],
      }),
    )

    // The call gets no body, and the body survives as an orphan. Matching them
    // on timestamp would attach the wrong payload to the wrong call.
    const unjoined = view.charts.network.find((item) => item.call.method === 'GET')
    expect(unjoined?.response).toBeNull()
    expect(view.charts.network).toHaveLength(2)
  })

  it('renders the workflow path in the order the steps happened', () => {
    // The read model used to ORDER BY occurrence_index, which is 0 on every row
    // of a run without FOR_EACH — so Postgres returned any order it liked and
    // the first step rendered last. The socket refetches on every event, so the
    // order also moved while the operator watched. The view sorts for itself
    // rather than trusting a remote ORDER BY for a claim about chronology.
    const view = buildRunDetailViewModel(
      detail({
        steps: [
          { plan_step_id: 'third', started_at: '2026-09-02T10:44:13.000Z', occurrence_index: 0 },
          { plan_step_id: 'first', started_at: '2026-09-02T10:44:06.000Z', occurrence_index: 0 },
          { plan_step_id: 'second', started_at: '2026-09-02T10:44:08.000Z', occurrence_index: 0 },
        ],
      }),
    )

    expect(view.workflowPath.map((step) => step.label)).toEqual(['first', 'second', 'third'])
  })

  it('keeps a step that has not started yet at the end', () => {
    const view = buildRunDetailViewModel(
      detail({
        steps: [
          { plan_step_id: 'pending' },
          { plan_step_id: 'started', started_at: '2026-09-02T10:44:06.000Z' },
        ],
      }),
    )

    expect(view.workflowPath.map((step) => step.label)).toEqual(['started', 'pending'])
  })

  it('orders FOR_EACH iterations of one step by their index', () => {
    // Same timestamp, different iteration: `occurrence_index` is what it is
    // actually for, and it only breaks ties.
    const view = buildRunDetailViewModel(
      detail({
        steps: [
          { plan_step_id: 'visit-b', started_at: '2026-09-02T10:44:06.000Z', occurrence_index: 1 },
          { plan_step_id: 'visit-a', started_at: '2026-09-02T10:44:06.000Z', occurrence_index: 0 },
        ],
      }),
    )

    expect(view.workflowPath.map((step) => step.label)).toEqual(['visit-a', 'visit-b'])
  })
})
