import { API_BASE } from '../../services/api'
import type {
  DeviceReadinessApi,
  DurableInteractionPageApi,
  EvidenceJourneyResult,
  RunDetailResult,
  RunHistoryQuery,
  RunHistoryResult,
  TestCampaignResultApi,
  TestProfileCatalogApi,
  WorkflowCompileApi,
  WorkflowRunApi,
  WorkflowRunStartApi,
} from './types'

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

export async function compileVerdictWorkflow(body: Record<string, unknown>): Promise<WorkflowCompileApi> {
  return postJson<WorkflowCompileApi>('/verdict/runtime/compile', body)
}

export async function startVerdictWorkflowRun(body: Record<string, unknown>): Promise<WorkflowRunStartApi> {
  return postJson<WorkflowRunStartApi>('/verdict/runtime/runs', body)
}

export async function fetchVerdictDeviceReadiness(deviceId: string): Promise<DeviceReadinessApi> {
  return getJson<DeviceReadinessApi>(`/verdict/runtime/devices/${encodeURIComponent(deviceId)}/readiness`)
}

export async function fetchVerdictTestProfiles(): Promise<TestProfileCatalogApi> {
  return getJson<TestProfileCatalogApi>('/verdict/runtime/test-profiles')
}

export async function fetchVerdictTestCampaign(campaignId: string): Promise<TestCampaignResultApi> {
  return getJson<TestCampaignResultApi>(`/verdict/runtime/test-campaigns/${encodeURIComponent(campaignId)}`)
}

export async function fetchVerdictInteractions(
  runId: string,
  afterRevision = 0,
): Promise<DurableInteractionPageApi> {
  const params = new URLSearchParams({ afterRevision: String(afterRevision) })
  return getJson<DurableInteractionPageApi>(
    `/verdict/runtime/runs/${encodeURIComponent(runId)}/interactions?${params.toString()}`,
  )
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

async function postJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    throw new Error(`Verdict runtime request failed: ${response.status} ${response.statusText}`)
  }
  return (await response.json()) as T
}
