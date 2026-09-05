import type { DiagramElement } from '@/data/product/nesy-types'
import type {
  RunDetailResult,
  RunTelemetryDto,
  RunTelemetryHttpBody,
  RunTelemetryHttpCall,
  RunTelemetryIncident,
  RunTelemetryMemorySample,
  RunTelemetrySpan,
} from './types'
import {
  deriveLayerApplicability,
  deriveStepLayerApplicability,
  type LayerApplicability,
} from './layer-applicability'

export type MeasurementLabel = 'NOT_MEASURED' | 'UNAVAILABLE'
export type OutcomeTone = 'green' | 'red' | 'amber' | 'blue' | 'gray' | 'purple'

export interface RunDetailKpi {
  key: 'verdict' | 'duration' | 'progress' | 'events' | 'memory' | 'risks'
  label: string
  value: string
  hint: string
  tone: OutcomeTone
}

export interface RunOutcomeCard {
  key: 'action' | 'gate' | 'oracle' | 'cleanup'
  label: string
  value: string
  description: string
  tone: OutcomeTone
}

export interface RunTimelineItem {
  id: string
  period: string
  title: string
  description: string
  kind: 'step' | 'wait' | 'oracle'
  result: string
  tone: OutcomeTone
  status: 'done' | 'active' | 'next'
}

export interface RunComparisonRow {
  label: string
  expected: string
  observed: string
  status: string
  tone: OutcomeTone
}

/** One HTTP call with whatever body evidence exists for it. */
export interface RunNetworkCall {
  call: RunTelemetryHttpCall
  request: RunTelemetryHttpBody | null
  response: RunTelemetryHttpBody | null
}

export interface RunDetailCharts {
  memory: RunTelemetryMemorySample[]
  http: RunTelemetryHttpCall[]
  /**
   * Calls joined to their bodies, plus any body whose call never arrived.
   *
   * Bodies leave the device from the OkHttp interceptor and `HTTP_CALL` from
   * the EventListener, so a body normally arrives FIRST. An orphan is therefore
   * ordinary — a lost or still-in-flight call — and is surfaced rather than
   * dropped.
   */
  network: RunNetworkCall[]
  spans: RunTelemetrySpan[]
  throughput: { startMs: number; count: number }[]
  incidents: RunTelemetryIncident[]
}

export interface WorkflowPathStep {
  label: string
  status: string
  tone: OutcomeTone
  occurrenceId?: string
  /** Wall-clock time between the persisted start and completion of the occurrence. */
  durationMs: number | null
  /** Null when the step declared no oracle policy, so nothing was evaluated. */
  layers: LayerApplicability[] | null
}

export interface RunDetailViewModel {
  header: {
    workflowName: string
    workflowDescription: string | null
    device: string
    environment: string
    lifecycle: string
  }
  kpis: RunDetailKpi[]
  outcomes: RunOutcomeCard[]
  timeline: RunTimelineItem[]
  comparisons: RunComparisonRow[]
  diagram: DiagramElement[]
  workflowPath: WorkflowPathStep[]
  charts: RunDetailCharts
  alert: {
    title: string
    description: string
    severity: 'warning' | 'destructive'
  } | null
}

type Row = Record<string, unknown>

export function buildRunDetailViewModel(
  detail: RunDetailResult,
  telemetry?: RunTelemetryDto,
): RunDetailViewModel {
  const run = record(detail.run) ?? {}
  const runtime = record(detail.runtime) ?? {}
  const steps = chronological(records(detail.steps))
  const waits = records(detail.waits)
  const oracles = records(detail.oracleEvaluations)
  const oracleEvaluations = detail.oracleEvaluations ?? []
  const stepActionTransitions = detail.actionTransitions ?? []
  const runLayers = deriveLayerApplicability(detail)
  const telemetrySummary = record(telemetry?.summary) ?? {}
  const incidents = normalizeIncidents(telemetry?.incidents)

  const verdict = pickText(runtime.productVerdict, runtime.oracleOutcome, run.outcome)
  const durationMs = numberValue(telemetrySummary.durationMs) ?? numberValue(run.duration)
  const finishedSteps = steps.filter((step) => isFinishedStep(step)).length
  const progress =
    steps.length === 0 ? null : `${finishedSteps}/${steps.length}`
  const eventCount = numberValue(telemetrySummary.eventCount)
  const peakBytes = numberValue(telemetrySummary.memoryPeakBytes)
  const riskCounts = record(telemetrySummary.riskCounts)
  const riskTotal = riskCounts
    ? (numberValue(riskCounts.warning) ?? 0) +
      (numberValue(riskCounts.error) ?? 0) +
      (numberValue(riskCounts.critical) ?? 0)
    : null

  const action = pickText(
    runtime.actionOutcome,
    runtime.lastActionOutcome,
    resultOf(steps.at(-1)),
    resultOf(records(detail.actionTransitions).at(-1)),
  )
  const gateWait = waits.find((wait) =>
    pickText(wait.kind, wait.type, wait.waitKind).includes('GATE'),
  )
  const gate = pickText(runtime.continueGateOutcome, runtime.gateOutcome, resultOf(gateWait))
  const oracle = pickText(
    runtime.productVerdict,
    runtime.oracleOutcome,
    run.outcome,
    resultOf(oracles.at(-1)),
  )
  const cleanup = pickText(runtime.cleanupResult, runtime.cleanupOutcome)
  const operational = pickText(
    runtime.operationalDisposition,
    runtime.schedulerDisposition,
    run.status,
  )

  const workflowSteps = steps.map((step, index) => {
    const status = stepResultOf(step)
    const occurrenceId = fieldText(step, 'occurrenceId', 'occurrence_id') ?? undefined
    return {
      label: stepLabelOf(step, index),
      status,
      tone: toneFor(status),
      occurrenceId,
      durationMs: stepDurationOf(step),
      layers: occurrenceId
        ? deriveStepLayerApplicability(occurrenceId, oracleEvaluations, stepActionTransitions)
        : null,
    }
  })

  const diagram: DiagramElement[] = [
    {
      type: 'node',
      label: 'Run started',
      variant: 'start',
      desc: formatTimestamp(run.startedAt),
    },
    ...workflowSteps.flatMap<DiagramElement>((step) => [
      { type: 'arrow' as const },
      {
        type: 'node' as const,
        label: step.label,
        variant: isFailure(step.status) ? 'error' as const : 'process' as const,
        desc: step.status,
        ...(step.durationMs === null ? {} : { durationMs: step.durationMs }),
        ...(step.layers ? { layers: step.layers } : {}),
      },
    ]),
    { type: 'arrow' as const },
    {
      type: 'node',
      label: 'Run result',
      variant: isFailure(verdict) ? 'error' : verdict === 'NOT_MEASURED' || /INCONCLUSIVE/i.test(verdict) ? 'decision' : 'end',
      desc: verdict,
      layers: runLayers,
    },
  ]

  const failureDetail = nullableText(runtime.failureDetail)
  const urgentIncident = incidents.find((incident) => incident.severity === 'critical')
    ?? incidents.find((incident) => incident.severity === 'error')
  const alert = urgentIncident
    ? {
        title: urgentIncident.event.replaceAll('_', ' '),
        description: compact([
          urgentIncident.screen && `Screen: ${urgentIncident.screen}`,
          urgentIncident.operation && `Operation: ${urgentIncident.operation}`,
          urgentIncident.atMs !== null && `At ${formatDuration(urgentIncident.atMs)}`,
        ]) || 'A high-priority runtime incident was captured.',
        severity: 'destructive' as const,
      }
    : failureDetail || isFailure(verdict)
      ? {
          title: failureDetail ? 'Failure detail' : 'Run did not pass',
          description: failureDetail ?? verdict,
          severity: 'destructive' as const,
        }
      : riskTotal !== null && riskTotal > 0
        ? {
            title: 'Stability signals',
            description: `${riskTotal} warning or error signal${riskTotal === 1 ? '' : 's'} during this run.`,
            severity: 'warning' as const,
          }
        : null

  return {
    header: {
      workflowName: pickText(run.workflowName, run.workflowSlug, run.workflowId),
      workflowDescription: nullableText(run.workflowDescription),
      device: pickText(run.deviceLabel, run.deviceModelName, run.deviceId),
      environment: pickText(run.environment, run.country),
      lifecycle: pickText(runtime.lifecycle, run.status),
    },
    kpis: [
      {
        key: 'verdict',
        label: 'Business verdict',
        value: verdict,
        hint: verdict === 'NOT_MEASURED' ? 'No final oracle was persisted' : 'Final product outcome',
        tone: toneFor(verdict),
      },
      {
        key: 'duration',
        label: 'Duration',
        value: durationMs === null ? 'NOT_MEASURED' : formatDuration(durationMs),
        hint: durationMs === null ? 'No reliable run duration' : 'Wall-clock execution time',
        tone: durationMs === null ? 'gray' : 'blue',
      },
      {
        key: 'progress',
        label: 'Step progress',
        value: progress ?? 'NOT_MEASURED',
        hint: progress === null ? 'No persisted step occurrences' : `${finishedSteps} terminal step${finishedSteps === 1 ? '' : 's'}`,
        tone: progress === null ? 'gray' : finishedSteps === steps.length ? 'green' : 'amber',
      },
      {
        key: 'events',
        label: 'SDK events',
        value: eventCount === null ? 'NOT_MEASURED' : String(eventCount),
        hint: eventCount === null ? 'Telemetry event stream unavailable' : 'Durable telemetry events',
        tone: eventCount === null ? 'gray' : 'purple',
      },
      {
        key: 'memory',
        label: 'Peak heap',
        value: peakBytes === null ? 'NOT_MEASURED' : formatBytes(peakBytes),
        hint: peakBytes === null ? 'No memory samples captured' : 'Highest observed memory sample',
        tone: peakBytes === null ? 'gray' : 'blue',
      },
      {
        key: 'risks',
        label: 'Stability risks',
        value: riskTotal === null ? 'NOT_MEASURED' : String(riskTotal),
        hint: riskTotal === null ? 'Risk event telemetry unavailable' : 'Warnings, errors and critical incidents',
        tone: riskTotal === null ? 'gray' : riskTotal > 0 ? 'red' : 'green',
      },
    ],
    outcomes: [
      outcomeCard('action', 'Action', action, 'Latest persisted action or step result'),
      outcomeCard('gate', 'Continue Gate', gate, 'Whether execution was allowed to continue'),
      outcomeCard('oracle', 'Final Oracle', oracle, 'Persisted business-rule verdict'),
      outcomeCard('cleanup', 'Cleanup', cleanup, 'Resource cleanup; never rewrites the oracle'),
    ],
    timeline: buildTimeline(steps, waits, oracles),
    comparisons: [
      comparison('Continue Gate', 'Gate requirements satisfied', gate),
      comparison('Final Oracle', 'Business expectation satisfied', oracle),
      comparison('Operational', 'Run completed without runtime failure', operational),
    ],
    diagram,
    workflowPath: workflowSteps,
    charts: {
      memory: normalizeMemory(telemetry?.memorySamples),
      http: normalizeHttp(telemetry?.httpCalls),
      network: joinNetwork(
        normalizeHttp(telemetry?.httpCalls),
        normalizeHttpBodies(telemetry?.httpBodies),
      ),
      spans: normalizeSpans(telemetry?.spans),
      throughput: normalizeBuckets(telemetry?.eventBuckets),
      incidents,
    },
    alert,
  }
}

function buildTimeline(steps: Row[], waits: Row[], oracles: Row[]): RunTimelineItem[] {
  const items = [
    ...steps.map((row, index) =>
      timelineItem('step', row, index, `Step ${index + 1}`),
    ),
    ...waits.map((row, index) =>
      timelineItem('wait', row, index, `Wait ${index + 1}`),
    ),
    ...oracles.map((row, index) =>
      timelineItem('oracle', row, index, `Oracle evaluation ${index + 1}`),
    ),
  ]
  return items.sort((left, right) => timestampValue(left.period) - timestampValue(right.period))
}

function timelineItem(
  kind: RunTimelineItem['kind'],
  row: Row,
  index: number,
  fallback: string,
): RunTimelineItem {
  const result = kind === 'step' ? stepResultOf(row) : resultOf(row)
  const at = pickTimestamp(
    row.createdAt,
    row.created_at,
    row.startedAt,
    row.started_at,
    row.terminalAt,
    row.terminal_at,
    row.completedAt,
    row.completed_at,
    row.atMs,
    row.at_ms,
  )
  const title = kind === 'step'
    ? stepLabelOf(row, index)
    : pickText(
      row.displayName,
      row.name,
      row.stepName,
      row.kind,
      row.evaluatorKind,
      row.evaluator_kind,
      row.plane,
      row.waitPlanId,
      row.wait_plan_id,
      fallback,
    )
  return {
    id: pickText(row.id, row.occurrenceId, row.occurrence_id, `${kind}-${index}`),
    period: at,
    title,
    description: pickText(row.reason, row.message, row.failureDetail, row.failure_detail, `${kind} · ${result}`),
    kind,
    result,
    tone: toneFor(result),
    status: kind === 'step' && isFinishedStep(row)
      ? 'done'
      : isTerminal(result)
        ? 'done'
        : isPending(result)
          ? 'next'
          : 'active',
  }
}

function outcomeCard(
  key: RunOutcomeCard['key'],
  label: string,
  value: string,
  description: string,
): RunOutcomeCard {
  return { key, label, value, description, tone: toneFor(value) }
}

function comparison(label: string, expected: string, observed: string): RunComparisonRow {
  return {
    label,
    expected,
    observed,
    status: observed === 'NOT_MEASURED' ? 'UNAVAILABLE' : observed,
    tone: toneFor(observed),
  }
}

function normalizeMemory(values: RunTelemetryDto['memorySamples'] | undefined): RunTelemetryMemorySample[] {
  return records(values).flatMap((row) => {
    const totalBytes = numberValue(row.totalBytes)
    const peakBytes = numberValue(row.peakBytes)
    if (totalBytes === null || peakBytes === null) return []
    return [{
      atMs: numberValue(row.atMs),
      pid: numberValue(row.pid),
      totalBytes,
      peakBytes,
      heapUsedBytes: numberValue(row.heapUsedBytes),
      heapCommittedBytes: numberValue(row.heapCommittedBytes),
      heapMaxBytes: numberValue(row.heapMaxBytes),
      nativeAllocatedBytes: numberValue(row.nativeAllocatedBytes),
      rssBytes: numberValue(row.rssBytes),
      pssBytes: numberValue(row.pssBytes),
      javaHeapUsedBytes: numberValue(row.javaHeapUsedBytes),
      javaHeapMaxBytes: numberValue(row.javaHeapMaxBytes),
      nativeHeapAllocatedBytes: numberValue(row.nativeHeapAllocatedBytes),
      lowMemory: typeof row.lowMemory === 'boolean' ? row.lowMemory : null,
      ...(nullableText(row.sourceEvent) ? { sourceEvent: nullableText(row.sourceEvent)! } : {}),
    }]
  })
}

function normalizeHttp(values: RunTelemetryDto['httpCalls'] | undefined): RunTelemetryHttpCall[] {
  return records(values).map((row) => ({
    atMs: numberValue(row.atMs),
    requestId: nullableText(row.requestId),
    method: nullableText(row.method),
    host: nullableText(row.host),
    path: nullableText(row.path),
    code: numberValue(row.code),
    status: numberValue(row.status),
    success: typeof row.success === 'boolean' ? row.success : null,
    durationMs: numberValue(row.durationMs),
    bytesIn: numberValue(row.bytesIn),
    bytesOut: numberValue(row.bytesOut),
  }))
}

function normalizeHttpBodies(
  values: RunTelemetryDto['httpBodies'] | undefined,
): RunTelemetryHttpBody[] {
  return records(values).map((row) => ({
    requestId: nullableText(row.requestId),
    direction:
      row.direction === 'REQUEST' || row.direction === 'RESPONSE'
        ? row.direction
        : null,
    contentType: nullableText(row.contentType),
    originalBytes: numberValue(row.originalBytes),
    capturedBytes: numberValue(row.capturedBytes),
    truncated: typeof row.truncated === 'boolean' ? row.truncated : null,
    omittedReason: nullableText(row.omittedReason),
    encoding: nullableText(row.encoding),
    atMs: numberValue(row.atMs),
    chunkCount: numberValue(row.chunkCount),
    chunksReceived: numberValue(row.chunksReceived) ?? 0,
    complete: row.complete === true,
    withheld: row.withheld === true,
    purged: row.purged === true,
    body: nullableText(row.body),
  }))
}

/**
 * Joins calls to bodies on `requestId`.
 *
 * A call with no `requestId` cannot be joined and is not guessed at by
 * timestamp or path: two calls to the same endpoint one second apart would then
 * be indistinguishable, and attaching the wrong body to a call is worse than
 * showing none. Such calls appear with both bodies null, which reads correctly
 * as "no body evidence for this call".
 */
function joinNetwork(
  calls: RunTelemetryHttpCall[],
  bodies: RunTelemetryHttpBody[],
): RunNetworkCall[] {
  const byRequest = new Map<string, RunTelemetryHttpBody[]>()
  for (const body of bodies) {
    if (body.requestId === null) continue
    const bucket = byRequest.get(body.requestId)
    if (bucket) bucket.push(body)
    else byRequest.set(body.requestId, [body])
  }

  const claimed = new Set<string>()
  const joined = calls.map((call) => {
    const matches = call.requestId === null ? [] : byRequest.get(call.requestId) ?? []
    if (call.requestId !== null && matches.length > 0) claimed.add(call.requestId)
    return {
      call,
      request: matches.find((body) => body.direction === 'REQUEST') ?? null,
      response: matches.find((body) => body.direction === 'RESPONSE') ?? null,
    }
  })

  // Bodies whose call never arrived. Kept, with a placeholder call carrying the
  // little that is known, so a run does not silently under-report its evidence.
  const orphans: RunNetworkCall[] = []
  for (const [requestId, group] of byRequest) {
    if (claimed.has(requestId)) continue
    orphans.push({
      call: {
        atMs: group[0]?.atMs ?? null,
        requestId,
        method: null,
        host: null,
        path: null,
        code: null,
        status: null,
        success: null,
        durationMs: null,
        bytesIn: null,
        bytesOut: null,
      },
      request: group.find((body) => body.direction === 'REQUEST') ?? null,
      response: group.find((body) => body.direction === 'RESPONSE') ?? null,
    })
  }

  return [...joined, ...orphans]
}

function normalizeSpans(values: RunTelemetryDto['spans'] | undefined): RunTelemetrySpan[] {
  return records(values).flatMap((row) => {
    const startMs = numberValue(row.startMs)
    const durationMs = numberValue(row.durationMs)
    if (startMs === null || durationMs === null) return []
    return [{
      name: pickText(row.name, 'unnamed'),
      startMs,
      durationMs,
      status: nullableText(row.status),
    }]
  })
}

function normalizeIncidents(values: RunTelemetryDto['incidents'] | undefined): RunTelemetryIncident[] {
  return records(values).flatMap((row) => {
    const event = nullableText(row.event)
    const severity = row.severity
    if (!event || (severity !== 'warning' && severity !== 'error' && severity !== 'critical')) {
      return []
    }
    return [{
      atMs: numberValue(row.atMs),
      event,
      severity,
      screen: nullableText(row.screen),
      operation: nullableText(row.operation),
      spanId: nullableText(row.spanId),
    }]
  })
}

function normalizeBuckets(
  values: RunTelemetryDto['eventBuckets'] | undefined,
): { startMs: number; count: number }[] {
  return records(values).flatMap((row) => {
    const startMs = numberValue(row.startMs)
    const count = numberValue(row.count)
    return startMs === null || count === null ? [] : [{ startMs, count }]
  })
}

function records(value: unknown): Row[] {
  return Array.isArray(value)
    ? value.flatMap((item) => {
        const row = record(item)
        return row ? [row] : []
      })
    : []
}

function record(value: unknown): Row | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Row
    : null
}

function nullableText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

function pickText(...values: unknown[]): string {
  for (const value of values) {
    const text = nullableText(value)
    if (text) return text
  }
  return 'NOT_MEASURED'
}

/**
 * Steps in the order they actually happened.
 *
 * Sorted HERE and not left to the caller, because this list is rebuilt from two
 * sources — the server render and every socket-triggered refetch — and the page
 * renders it as "Actual workflow path". The read model orders chronologically
 * now, but a view that depends on a remote ORDER BY for a claim about
 * chronology is a view whose correctness lives in another repo's SQL. Measured
 * before the read model was fixed: `occurrence_index` was 0 on all 50 rows of a
 * run, the first step rendered last, and the order changed between refetches
 * while the operator watched.
 *
 * The comparison is TOTAL: timestamp, then iteration index, then the original
 * position. Without that last tiebreak two indistinguishable rows could still
 * swap on the next refetch, which is the flicker this exists to remove. Steps
 * with no timestamp have not started yet and sort last.
 */
function chronological(rows: Row[]): Row[] {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const leftAt = startedAtMs(left.row)
      const rightAt = startedAtMs(right.row)
      if (leftAt !== rightAt) {
        if (leftAt === null) return 1
        if (rightAt === null) return -1
        return leftAt - rightAt
      }
      const leftOccurrence = numberValue(left.row.occurrenceIndex ?? left.row.occurrence_index) ?? 0
      const rightOccurrence =
        numberValue(right.row.occurrenceIndex ?? right.row.occurrence_index) ?? 0
      if (leftOccurrence !== rightOccurrence) return leftOccurrence - rightOccurrence
      return left.index - right.index
    })
    .map((entry) => entry.row)
}

function startedAtMs(row: Row): number | null {
  const raw = row.startedAt ?? row.started_at
  if (raw === null || raw === undefined) return null
  const parsed = raw instanceof Date ? raw.getTime() : new Date(String(raw)).getTime()
  return Number.isFinite(parsed) ? parsed : null
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function fieldText(row: Row, ...keys: string[]): string | null {
  for (const key of keys) {
    const text = nullableText(row[key])
    if (text) return text
  }
  return null
}

export function stepLabelOf(row: Row, index: number): string {
  const planStepId = fieldText(row, 'planStepId', 'plan_step_id')
  const sourceMapRef = fieldText(row, 'sourceMapRef', 'source_map_ref')
  const occurrenceId = fieldText(row, 'occurrenceId', 'occurrence_id')
  const iterationKey = fieldText(row, 'iterationKey', 'iteration_key')
  const label = pickText(
    planStepId,
    sourceMapRef,
    row.displayName,
    row.name,
    row.stepName,
    row.stepId,
    row.nodeId,
    occurrenceId,
    `Step ${index + 1}`,
  )
  if (iterationKey && iterationKey !== 'root') {
    return `${label} · ${iterationKey}`
  }
  return label
}

/**
 * Gate outcomes that mean the step's own closing condition was NOT met.
 *
 * Anything else the gate can say — `SATISFIED`, `NOT_EVALUATED` — leaves the
 * action's own result as the better answer.
 */
const UNMET_CONTINUE_GATE = new Set(['TIMED_OUT', 'UNSATISFIED', 'BLOCKED'])

export function stepResultOf(row: Row): string {
  const finalOracle = fieldText(row, 'finalOracleResult', 'final_oracle_result')
  if (finalOracle && finalOracle !== 'NOT_EVALUATED') return finalOracle

  const actionResult = fieldText(row, 'actionResult', 'action_result')
  const continueGate = fieldText(row, 'continueGateResult', 'continue_gate_result')

  // A FAILED action is the most specific answer there is, so it still comes
  // first — the gate never ran on a gesture that did not land.
  if (actionResult && actionResult !== 'NOT_STARTED' && isFailure(actionResult)) return actionResult

  // AN UNMET GATE OUTRANKS A SUCCESSFUL ACTION.
  //
  // `actionResult` used to be read before the gate was even looked at, and an
  // action result is only half of a step's outcome: the continue gate is the
  // step's own closing condition and the executor STOPS THE RUN on it. So a step
  // whose gesture landed and whose gate then timed out was displayed as
  // SUCCEEDED, and the run's only red row was the cleanup at the very end.
  //
  // Measured on run_3ef0e142: `deliver-tap-scan-confirm` reported
  // `actionResult: SUCCEEDED, continueGateResult: TIMED_OUT` and rendered green,
  // while `auth-clear-session` — a cleanup three legs away, failing for an
  // unrelated prefix bug — was the step the report pointed at. The reader was
  // asked to believe the delivery screen was fine and the login teardown was the
  // problem.
  if (continueGate && UNMET_CONTINUE_GATE.has(continueGate)) return continueGate

  if (actionResult && actionResult !== 'NOT_STARTED') return actionResult

  if (continueGate && continueGate !== 'NOT_EVALUATED') return continueGate

  const cleanup = fieldText(row, 'cleanupResult', 'cleanup_result')
  if (cleanup && cleanup !== 'NOT_STARTED') return cleanup

  const lifecycle = fieldText(row, 'lifecycle')
  if (lifecycle) return lifecycle

  // The GENERIC reader, not `resultOf`. `resultOf` sends any row carrying a
  // `planStepId` straight back here, so calling it from this last line was
  // mutual recursion by construction: a step row with none of the fields above
  // — a step the run has not reached yet, or a partial row from a socket
  // refetch — blew the stack and took the page down with it. Real runs always
  // carried a `lifecycle`, which is why it stayed hidden.
  return genericResultOf(row)
}

function isFinishedStep(row: Row): boolean {
  const lifecycle = fieldText(row, 'lifecycle')
  if (lifecycle === 'COMPLETED') return true
  return isTerminal(stepResultOf(row))
}

function resultOf(row: Row | undefined): string {
  if (!row) return 'NOT_MEASURED'
  if (fieldText(row, 'planStepId', 'plan_step_id')) return stepResultOf(row)
  return genericResultOf(row)
}

/** Result fields shared by every non-step row — and the step reader's fallback. */
function genericResultOf(row: Row): string {
  return pickText(
    row.outcome,
    row.productVerdict,
    row.product_verdict,
    row.result,
    row.status,
    row.state,
    row.verdict,
    row.terminal,
    row.resultKey,
    row.result_key,
    row.cancelStatus,
    row.cancel_status,
    row.actionResult,
    row.action_result,
    row.finalOracleResult,
    row.final_oracle_result,
    row.continueGateResult,
    row.continue_gate_result,
    row.cleanupResult,
    row.cleanup_result,
    row.lifecycle,
  )
}

function isFailure(value: string): boolean {
  return /(FAIL|ERROR|CRASH|ANR|ABORT|REJECT|BLOCK|LEAKED)/i.test(value)
}

function isTerminal(value: string): boolean {
  return /(PASS|SUCCEEDED|SUCCESS|COMPLETED|DONE|RELEASED|SKIPPED|FAIL|ERROR|ABORT|CANCEL|TIMEOUT|REJECT|BLOCKED)/i.test(value)
}

function isPending(value: string): boolean {
  return value === 'NOT_MEASURED' ||
    value === 'UNAVAILABLE' ||
    /(PENDING|QUEUED|WAITING|NOT_STARTED|NOT_EVALUATED|RUNNING|ACTIVE|STARTED)/i.test(value)
}

function toneFor(value: string): OutcomeTone {
  if (isFailure(value)) return 'red'
  if (/(WARN|RISK|PARTIAL|INCONCLUSIVE)/i.test(value)) return 'amber'
  if (/(PASS|SUCCEEDED|SUCCESS|COMPLETED|DONE|NORMAL|RELEASED|VERIFIED|MATCH)/i.test(value)) return 'green'
  if (value === 'NOT_MEASURED' || value === 'UNAVAILABLE') return 'gray'
  if (/(RUNNING|ACTIVE|STARTED)/i.test(value)) return 'blue'
  if (/(PENDING|NOT_STARTED|NOT_EVALUATED|QUEUED|WAITING)/i.test(value)) return 'gray'
  return 'purple'
}

function pickTimestamp(...values: unknown[]): string {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return String(value)
    if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return value
  }
  return 'UNAVAILABLE'
}

/**
 * Duration of one step occurrence, or null when either endpoint is missing.
 *
 * A step that started but never completed has no measurable duration — reporting
 * "now minus started" would invent a number that grows every time the page renders.
 */
function stepDurationOf(row: Row): number | null {
  const started = epochOf(row.startedAt ?? row.started_at)
  const completed = epochOf(row.completedAt ?? row.completed_at)
  if (started === null || completed === null) return null
  const elapsed = completed - started
  return elapsed >= 0 ? elapsed : null
}

function epochOf(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (value instanceof Date) {
    const time = value.getTime()
    return Number.isFinite(time) ? time : null
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function timestampValue(value: string): number {
  if (value === 'UNAVAILABLE') return Number.MAX_SAFE_INTEGER
  const numeric = Number(value)
  if (Number.isFinite(numeric)) return numeric
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER
}

function formatTimestamp(value: unknown): string {
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toLocaleString()
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toLocaleString()
  }
  return 'UNAVAILABLE'
}

export function formatDuration(value: number): string {
  if (!Number.isFinite(value) || value < 0) return 'UNAVAILABLE'
  if (value < 1_000) return `${Math.round(value)} ms`
  const seconds = value / 1_000
  if (seconds < 60) return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m ${Math.round(seconds % 60)}s`
}

export function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value < 0) return 'UNAVAILABLE'
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`
  return `${(value / (1024 * 1024)).toFixed(1)} MB`
}

function compact(values: Array<string | null | false>): string {
  return values.filter((value): value is string => typeof value === 'string').join(' · ')
}
