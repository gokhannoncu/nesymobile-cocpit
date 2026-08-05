import { API_BASE } from '../../services/api'
import type { EvidenceJourneyResult, RunDetailResult, RunHistoryQuery, RunHistoryResult, WorkflowRunApi } from './types'

export async function fetchVerdictRunHistory(query: RunHistoryQuery = {}): Promise<RunHistoryResult> {
  const params = new URLSearchParams()
  if (query.limit !== undefined) params.set('limit', String(query.limit))
  if (query.offset !== undefined) params.set('offset', String(query.offset))
  if (query.engineType !== undefined) params.set('engineType', query.engineType)
  return getJson<RunHistoryResult>(`/verdict/runtime/runs?${params.toString()}`)
}

export async function fetchVerdictRunDetail(runId: string): Promise<RunDetailResult> {
  return getJson<RunDetailResult>(`/verdict/runtime/runs/${encodeURIComponent(runId)}`)
}

export async function fetchVerdictLegacyRunSummary(runId: string): Promise<WorkflowRunApi> {
  return getJson<WorkflowRunApi>(`/verdict/runtime/runs/${encodeURIComponent(runId)}/legacy-summary`)
}

export async function fetchVerdictEvidenceJourney(runId: string): Promise<EvidenceJourneyResult> {
  return getJson<EvidenceJourneyResult>(`/verdict/runtime/runs/${encodeURIComponent(runId)}/evidence-journey`)
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  })
  if (!response.ok) {
    throw new Error(`Verdict runtime request failed: ${response.status} ${response.statusText}`)
  }
  return (await response.json()) as T
}
