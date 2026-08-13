import {
  fetchVerdictRunDetail,
  fetchVerdictEvidenceJourney,
  fetchVerdictRunTelemetry,
} from '@/lib/verdict-runtime/client'
import { canReadRawEvidence } from '@/lib/verdict-runtime/rbac'
import { headers } from 'next/headers'
import type {
  EvidenceJourneyResult,
  RunDetailResult,
  RunTelemetryDto,
} from '@/lib/verdict-runtime/types'
import { RunDetailLive } from '@/components/automation/run-detail/RunDetailLive'

/**
 * The durable snapshot, rendered on the server, handed to the live client shell.
 *
 * Never cached: a run that is still executing would otherwise be served from a
 * previous request's copy, and the socket stream would then be updating panels
 * whose baseline is minutes old.
 */
export const dynamic = 'force-dynamic'

export default async function RunDetailPage(props: {
  params: Promise<{ id: string; runId: string }>
}) {
  const params = await props.params
  const { id, runId } = params

  const [[detailSettled, evidenceSettled, telemetrySettled], requestHeaders] = await Promise.all([
    Promise.allSettled([
      fetchVerdictRunDetail(runId),
      fetchVerdictEvidenceJourney(runId),
      fetchVerdictRunTelemetry(runId),
    ]),
    headers(),
  ])
  const detailResult = unwrapSettled<RunDetailResult>(detailSettled)
  const evidenceResult = unwrapSettled<EvidenceJourneyResult>(evidenceSettled)
  const telemetryResult = unwrapSettled<RunTelemetryDto>(telemetrySettled)
  const runDetail = detailResult.data
  const evidenceJourney = evidenceResult.data
  const telemetry = telemetryResult.data

  return (
    <RunDetailLive
      automationId={id}
      runId={runId}
      initialDetail={runDetail ?? emptyRunDetail(runId)}
      initialEvidenceJourney={evidenceJourney}
      initialTelemetry={telemetry}
      canViewRawEvidence={canReadRawEvidence(requestHeaders)}
      initialSourceErrors={{
        ...(detailResult.error ? { detail: detailResult.error } : {}),
        ...(evidenceResult.error ? { evidence: evidenceResult.error } : {}),
        ...(telemetryResult.error ? { telemetry: telemetryResult.error } : {}),
      }}
    />
  )
}

function unwrapSettled<T>(
  result: PromiseSettledResult<unknown>,
): { data?: T; error?: string } {
  if (result.status === 'fulfilled') return { data: result.value as T }
  return {
    error:
      result.reason instanceof Error
        ? result.reason.message
        : 'The data source could not be reached',
  }
}

/**
 * A snapshot that measured nothing, for when the read model could not answer.
 *
 * Every list is empty rather than absent so the panels report NOT_MEASURED —
 * which is exactly what is true — instead of guessing a verdict from a missing
 * field.
 */
function emptyRunDetail(runId: string): RunDetailResult {
  return {
    apiVersion: 'verdict-runtime.v1',
    run: { id: runId },
    runtime: null,
    partial: false,
    correlation: { runId, engineType: 'BRIDGEFLOW' },
    steps: [],
    waits: [],
    actionTransitions: [],
    oracleEvaluations: [],
    testExecutions: [],
    resourceLeases: [],
    remoteActions: [],
  }
}
