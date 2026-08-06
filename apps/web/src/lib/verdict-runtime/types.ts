export type VerdictRuntimeApiVersion = 'verdict-runtime.v1'

export interface VerdictRuntimeCorrelation {
  runId: string
  engineType: 'BRIDGEFLOW' | 'MAESTRO_LEGACY' | string
}

export interface WorkflowRunApi {
  apiVersion: VerdictRuntimeApiVersion
  run: Record<string, unknown>
  runtime: Record<string, unknown> | null
  partial: boolean
  blockedReason?: string
  correlation: VerdictRuntimeCorrelation
}

export interface RunHistoryQuery {
  limit?: number
  offset?: number
  engineType?: 'BRIDGEFLOW' | 'MAESTRO_LEGACY'
}

export interface RunHistoryResult {
  apiVersion: VerdictRuntimeApiVersion
  limit: number
  offset: number
  items: WorkflowRunApi[]
}

export interface RunDetailResult extends WorkflowRunApi {
  steps: Record<string, unknown>[]
  waits: Record<string, unknown>[]
  actionTransitions: Record<string, unknown>[]
  oracleEvaluations: Record<string, unknown>[]
  testExecutions: Record<string, unknown>[]
  resourceLeases: Record<string, unknown>[]
  remoteActions: Record<string, unknown>[]
}

export interface EvidenceJourneyResult {
  apiVersion: VerdictRuntimeApiVersion
  runId: string
  items: Record<string, unknown>[]
}

export interface WorkflowCompileApi {
  apiVersion: VerdictRuntimeApiVersion
  ok: boolean
  compiledPlanRef: string
  compiledPlanHash: string
  sourceMap: Record<string, string>
  provenance: Record<string, unknown>
  issues: Record<string, unknown>[]
}

export interface WorkflowRunStartApi {
  apiVersion: VerdictRuntimeApiVersion
  runId: string
  executionId: string
  compiledPlanHash: string
  status: 'QUEUED'
  engineType: 'BRIDGEFLOW'
}

export interface DeviceReadinessApi {
  apiVersion: VerdictRuntimeApiVersion
  deviceId: string
  overall: string
  lanes: Record<string, unknown>[]
  commandAdmission: Record<string, unknown>
  externalBlockers: Record<string, unknown>[]
  partial: boolean
}

export interface TestProfileCatalogApi {
  apiVersion: VerdictRuntimeApiVersion
  partial: boolean
  items: Record<string, unknown>[]
}

export interface TestCampaignCatalogItemApi {
  campaignId: string
  campaignKey: string
  campaignVersion: string
  status: string
  cellCount: number
  releaseGateResult: string
}

export interface TestCampaignCatalogApi {
  apiVersion: VerdictRuntimeApiVersion
  items: TestCampaignCatalogItemApi[]
}

export interface TestCampaignResultApi {
  apiVersion: VerdictRuntimeApiVersion
  campaignId: string
  cells: Record<string, unknown>[]
  failedCells: string[]
  partial: boolean
}

export interface DurableInteractionPageApi {
  apiVersion: VerdictRuntimeApiVersion
  runId: string
  afterRevision: number
  latestRevision: number
  items: Record<string, unknown>[]
  reconnectCursor: { runId: string; afterRevision: number }
}

export type DomainPackState = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'

export interface DomainPackSummary {
  packKey: string
  displayName: string
  state: DomainPackState
  latestVersion: string
  publishedBundleHash?: string
  applicationCount: number
  screenCount: number
  targetCount: number
  evidenceSourceCount: number
  updatedAt: string
}

export interface DomainPackCatalogApi {
  apiVersion: VerdictRuntimeApiVersion
  partial: boolean
  items: DomainPackSummary[]
}

export interface DomainPackDetailApi {
  apiVersion: VerdictRuntimeApiVersion
  packKey: string
  displayName: string
  state: DomainPackState
  version: string
  publishedBundleHash?: string
  derivedGraphDigest?: string
  derivedReducerDigest?: string
  derivedTestProfileDigest?: string
  activePinnedRunVersions: string[]
  manifest: Record<string, unknown>
  compatibility: Record<string, unknown>
  applications: Record<string, unknown>[]
  screens: Record<string, unknown>[]
  surfaces: Record<string, unknown>[]
  entities: Record<string, unknown>[]
  targets: Record<string, unknown>[]
  evidenceSources: Record<string, unknown>[]
  semanticActions: Record<string, unknown>[]
  macros: Record<string, unknown>[]
  oracleTemplates: Record<string, unknown>[]
  launchProfiles: Record<string, unknown>[]
  testProfiles: Record<string, unknown>[]
  migrations: Record<string, unknown>[]
  validation: Record<string, unknown>
  partial: boolean
  blockedReason?: string
  concurrencyToken: string
}

export interface DomainPackSaveResult {
  apiVersion: VerdictRuntimeApiVersion
  packKey: string
  version: string
  ok: boolean
  concurrencyToken: string
}

export interface DomainPackPublishResult {
  apiVersion: VerdictRuntimeApiVersion
  packKey: string
  version: string
  publishedBundleHash: string
  ok: boolean
}
