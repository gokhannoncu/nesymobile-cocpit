import { API_BASE } from '../../services/api'
import type {
  DeviceReadinessApi,
  DurableInteractionPageApi,
  EvidenceJourneyResult,
  EvidenceSourceCatalogApi,
  LaunchProfileCatalogApi,
  RunDetailResult,
  RunTelemetryDto,
  RunEvidenceSourceCatalogApi,
  RunHistoryQuery,
  RunHistoryResult,
  WorkflowCatalogApi,
  SemanticActionCatalogApi,
  TargetResolutionCatalogApi,
  TestCampaignCatalogApi,
  TestCampaignResultApi,
  TestProfileCatalogApi,
  WorkflowCompileApi,
  WorkflowRunStartApi,
  DomainPackCatalogApi,
  DomainPackDetailApi,
  DomainPackSaveResult,
  DomainPackPublishResult,
  LaunchProfileValidateApi,
  EntityBindingCatalogApi,
  ScreenSurfaceCatalogApi,
  DomainPackAdminGetApi,
} from './types'
import { mapAdminPackToDetailApi } from './domain-pack-detail'

export async function fetchVerdictRunHistory(query: RunHistoryQuery = {}): Promise<RunHistoryResult> {
  const params = new URLSearchParams()
  if (query.limit !== undefined) params.set('limit', String(query.limit))
  if (query.offset !== undefined) params.set('offset', String(query.offset))
  if (query.engineType !== undefined) params.set('engineType', query.engineType)
  return getJson<RunHistoryResult>(`/verdict/runtime/runs?${params.toString()}`)
}

export async function fetchVerdictWorkflowCatalog(limit = 100): Promise<WorkflowCatalogApi> {
  const params = new URLSearchParams({ limit: String(limit) })
  return getJson<WorkflowCatalogApi>(`/verdict/runtime/catalog/workflows?${params.toString()}`)
}

export async function fetchVerdictRunDetail(runId: string): Promise<RunDetailResult> {
  return getJson<RunDetailResult>(`/verdict/runtime/runs/${encodeURIComponent(runId)}`)
}

export async function fetchVerdictEvidenceJourney(runId: string): Promise<EvidenceJourneyResult> {
  return getJson<EvidenceJourneyResult>(`/verdict/runtime/runs/${encodeURIComponent(runId)}/evidence-journey`)
}

export async function fetchVerdictRunTelemetry(runId: string): Promise<RunTelemetryDto> {
  return getJson<RunTelemetryDto>(
    `/verdict/runtime/runs/${encodeURIComponent(runId)}/telemetry`,
  )
}

export async function fetchVerdictEvidenceSources(): Promise<EvidenceSourceCatalogApi> {
  return getJson<EvidenceSourceCatalogApi>('/verdict/runtime/evidence-sources')
}

export async function fetchVerdictRunEvidenceSources(runId: string): Promise<RunEvidenceSourceCatalogApi> {
  return getJson<RunEvidenceSourceCatalogApi>(
    `/verdict/runtime/runs/${encodeURIComponent(runId)}/evidence-sources`,
  )
}

export async function fetchVerdictSemanticActions(
  packKey: string,
  version: string,
  deviceId?: string,
): Promise<SemanticActionCatalogApi> {
  const params = new URLSearchParams()
  if (deviceId !== undefined) params.set('deviceId', deviceId)
  const query = params.size > 0 ? `?${params.toString()}` : ''
  return getJson<SemanticActionCatalogApi>(
    `/verdict/runtime/domain-packs/${encodeURIComponent(packKey)}/${encodeURIComponent(version)}/semantic-actions${query}`,
  )
}

export async function fetchVerdictTargetResolution(
  packKey: string,
  version: string,
): Promise<TargetResolutionCatalogApi> {
  return getJson<TargetResolutionCatalogApi>(
    `/verdict/runtime/domain-packs/${encodeURIComponent(packKey)}/${encodeURIComponent(version)}/target-resolution`,
  )
}

export async function fetchVerdictEntityBindings(
  packKey: string,
  version: string,
): Promise<EntityBindingCatalogApi> {
  return getJson<EntityBindingCatalogApi>(
    `/verdict/runtime/domain-packs/${encodeURIComponent(packKey)}/${encodeURIComponent(version)}/entity-bindings`,
  )
}

export async function fetchVerdictScreenSurfaces(
  packKey: string,
  version: string,
): Promise<ScreenSurfaceCatalogApi> {
  return getJson<ScreenSurfaceCatalogApi>(
    `/verdict/runtime/domain-packs/${encodeURIComponent(packKey)}/${encodeURIComponent(version)}/screen-surfaces`,
  )
}

export async function fetchVerdictDomainPackAdmin(
  packKey: string,
  version: string,
): Promise<DomainPackAdminGetApi> {
  return getJson<DomainPackAdminGetApi>(
    `/verdict/runtime/domain-packs/${encodeURIComponent(packKey)}/${encodeURIComponent(version)}`,
  )
}

export async function fetchVerdictLaunchProfiles(
  packKey: string,
  version: string,
  releaseBuild = false,
): Promise<LaunchProfileCatalogApi> {
  const params = new URLSearchParams()
  if (releaseBuild) params.set('releaseBuild', 'true')
  const query = params.size > 0 ? `?${params.toString()}` : ''
  return getJson<LaunchProfileCatalogApi>(
    `/verdict/runtime/domain-packs/${encodeURIComponent(packKey)}/${encodeURIComponent(version)}/launch-profiles${query}`,
  )
}

/**
 * Like compile: 422 is a validation *result* with structured violations, not a
 * transport failure. Partial drafts must surface MISSING_FIELD, not a thrown Error.
 */
export async function validateVerdictLaunchProfile(body: {
  profile: Record<string, unknown>
  releaseBuild?: boolean
}): Promise<LaunchProfileValidateApi> {
  const response = await fetch(`${API_BASE}/verdict/runtime/launch-profiles/validate`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (response.ok || response.status === 422) {
    return (await response.json()) as LaunchProfileValidateApi
  }
  throw new Error(`Verdict runtime request failed: ${response.status} ${response.statusText}`)
}

/**
 * A rejected compile is a *result*, not a transport failure: the 422 body
 * carries the same DTO with `ok: false` and the issue list the editor needs to
 * show. Throwing it away would leave the panel with nothing but "API error".
 */
export async function compileVerdictWorkflow(
  body: Record<string, unknown>,
): Promise<WorkflowCompileApi> {
  const response = await fetch(`${API_BASE}/verdict/runtime/compile`, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (response.ok || response.status === 422) {
    return (await response.json()) as WorkflowCompileApi
  }
  throw new Error(`Verdict runtime request failed: ${response.status} ${response.statusText}`)
}

export async function startVerdictWorkflowRun(body: Record<string, unknown>): Promise<WorkflowRunStartApi> {
  return postJson<WorkflowRunStartApi>('/verdict/runtime/runs', body)
}

export async function fetchVerdictDeviceReadiness(deviceId: string, appId?: string): Promise<DeviceReadinessApi> {
  const params = new URLSearchParams()
  if (appId !== undefined && appId.trim() !== '') params.set('appId', appId.trim())
  const query = params.size > 0 ? `?${params.toString()}` : ''
  return getJson<DeviceReadinessApi>(`/verdict/runtime/devices/${encodeURIComponent(deviceId)}/readiness${query}`)
}

export async function fetchVerdictTestProfiles(): Promise<TestProfileCatalogApi> {
  return getJson<TestProfileCatalogApi>('/verdict/runtime/test-profiles')
}

export async function fetchVerdictTestCampaigns(): Promise<TestCampaignCatalogApi> {
  return getJson<TestCampaignCatalogApi>('/verdict/runtime/test-campaigns')
}

export async function fetchVerdictTestCampaign(campaignId: string): Promise<TestCampaignResultApi> {
  return getJson<TestCampaignResultApi>(`/verdict/runtime/test-campaigns/${encodeURIComponent(campaignId)}`)
}

export async function startVerdictTestCampaign(body: Record<string, unknown>): Promise<{ campaign: TestCampaignResultApi | null }> {
  return postJson<{ campaign: TestCampaignResultApi | null }>('/verdict/runtime/test-campaigns', body)
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

export async function fetchVerdictDomainPacks(): Promise<DomainPackCatalogApi> {
  return getJson<DomainPackCatalogApi>('/verdict/runtime/domain-packs')
}

export async function fetchVerdictDomainPack(packKey: string, version: string): Promise<DomainPackDetailApi> {
  const admin = await getJson<DomainPackAdminGetApi>(
    `/verdict/runtime/domain-packs/${encodeURIComponent(packKey)}/${encodeURIComponent(version)}`,
  )
  return mapAdminPackToDetailApi(admin)
}

export async function saveDomainPackDraft(body: Record<string, unknown>): Promise<DomainPackSaveResult> {
  return putJson<DomainPackSaveResult>('/verdict/runtime/domain-packs/draft', body)
}

export async function publishDomainPack(body: Record<string, unknown>): Promise<DomainPackPublishResult> {
  return postJson<DomainPackPublishResult>('/verdict/runtime/domain-packs/publish', body)
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

async function putJson<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
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
