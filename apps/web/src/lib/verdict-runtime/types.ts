export type VerdictRuntimeApiVersion = 'verdict-runtime.v1'

export interface VerdictRuntimeCorrelation {
  runId: string
  engineType: 'BRIDGEFLOW' | string
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
  engineType?: 'BRIDGEFLOW'
}

export interface RunHistoryResult {
  apiVersion: VerdictRuntimeApiVersion
  limit: number
  offset: number
  items: WorkflowRunApi[]
}

export interface WorkflowCatalogItemApi {
  id: string
  slug: string
  name: string
  description: string | null
  status: string
  category: string | null
  icon: string
  iconClassName: string
  currentVersionId: string | null
  createdAt: string | number | Date
  updatedAt: string | number | Date
  latestVersion: {
    id: string
    version: number
    createdAt: string | number | Date
  } | null
  lastRun: {
    id: string
    status: string
    createdAt: string | number | Date
    duration: number | null
  } | null
}

export interface WorkflowCatalogApi {
  apiVersion: VerdictRuntimeApiVersion
  items: WorkflowCatalogItemApi[]
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

export type TelemetryMeasurementState = 'MEASURED' | 'PARTIAL' | 'UNAVAILABLE'

export interface TelemetrySectionMeta {
  measurementState: TelemetryMeasurementState
  source: readonly string[]
}

export interface RunTelemetryMemorySample {
  atMs: number | null
  pid: number | null
  totalBytes: number
  peakBytes: number
  heapUsedBytes: number | null
  heapCommittedBytes: number | null
  heapMaxBytes: number | null
  nativeAllocatedBytes: number | null
  rssBytes: number | null
  pssBytes: number | null
  javaHeapUsedBytes: number | null
  javaHeapMaxBytes: number | null
  nativeHeapAllocatedBytes: number | null
  lowMemory: boolean | null
  sourceEvent?: string
}

export interface RunTelemetryHttpCall {
  atMs: number | null
  requestId: string | null
  method: string | null
  host: string | null
  path: string | null
  code: number | null
  status: number | null
  success: boolean | null
  durationMs: number | null
  bytesIn: number | null
  bytesOut: number | null
}

export interface RunTelemetrySpan {
  name: string
  startMs: number
  durationMs: number
  status: string | null
}

export interface RunTelemetryIncident {
  atMs: number | null
  event: string
  severity: 'warning' | 'error' | 'critical'
  screen: string | null
  operation: string | null
  spanId: string | null
}

export interface RunTelemetryHealth {
  atMs: number | null
  pid: number | null
  apiLevel: number | null
  profileable: boolean | null
  inCriticalSpan: boolean | null
  heapUsedMb: number | null
  heapMaxMb: number | null
  nativeHeapMb: number | null
  gcCount: number | null
  blockingGcTimeMs: number | null
  crashedSince: boolean | number | string | null
  anrRisk: boolean | null
  anrBlockedMs: number | null
  anrLevel: string | null
  eventsEmitted: number | null
  droppedSince: number | null
  screen: string | null
  operation: string | null
  spanId: string | null
  walState: string | null
  gapEntryCount: number | null
  gapEntriesUsed: number | null
  gapUsableEntries: number | null
  wsAuthState: string | null
  gapPublishState: string | null
}

export interface RunTelemetryStreamHealth {
  runId: string | null
  sessionId: string | null
  contiguousSeq: string | null
  receiptPending: number | null
  orderedLag: number | null
  oldestUnprocessedAgeMs: number | null
  lastReceiptDispatchLatencyMs: number | null
  maxAttempt: number | null
  deadLetteredCount: number | null
  lateEventCount: number | null
  closedAt: string | null
}

export interface RunTelemetryDiagnosticCapture {
  captureId: string | null
  level: string | null
  triggerEvent: string | null
  status: string | null
  screen: string | null
  operation: string | null
  spanId: string | null
  sensitive: boolean
  skippedReason: string | null
  createdAt: string | null
  completedAt: string | null
}

/** Mirrors `RunTelemetryDto` from the API telemetry read model. */
export interface RunTelemetryDto {
  apiVersion: 'verdict-run-telemetry.v1'
  runId: string
  measurementState: TelemetryMeasurementState
  summary: {
    durationMs: number | null
    eventCount: number | null
    memoryPeakBytes: number | null
    riskCounts: { warning: number; error: number; critical: number } | null
    httpCount: number | null
    httpErrorRate: number | null
    httpP50Ms: number | null
    httpP95Ms: number | null
    spanCount: number | null
  }
  memorySamples: readonly RunTelemetryMemorySample[]
  httpCalls: readonly RunTelemetryHttpCall[]
  spans: readonly RunTelemetrySpan[]
  incidents: readonly RunTelemetryIncident[]
  eventBuckets: readonly { startMs: number; count: number }[]
  latestHealth: RunTelemetryHealth | null
  streamHealth: readonly RunTelemetryStreamHealth[]
  diagnosticCaptures: readonly RunTelemetryDiagnosticCapture[]
  sections: Readonly<Record<string, TelemetrySectionMeta>>
}

export interface WorkflowCompileApi {
  apiVersion: VerdictRuntimeApiVersion
  ok: boolean
  /** STUB until the real BridgeFlowCompiler adapter is wired (phase-5-debt 5D.4B). */
  compilerKind: 'STUB' | 'BRIDGEFLOW'
  compiledPlanRef: string
  compiledPlanHash: string
  sourceMap: Record<string, string>
  provenance: Record<string, unknown>
  issues: Record<string, unknown>[]
}

/** Mirrors `EvidenceSourceQueryService.list()` catalog items. */
export interface EvidenceSourceApi {
  sourceEvent: string
  factKey: string
  plane: string
  subtype: string
  authority: string
  deliveryLanes: readonly string[]
  freshnessMaxAgeMs: number
  valueField: string
  confidence?: number
}

export interface EvidenceSourceCatalogApi {
  apiVersion: VerdictRuntimeApiVersion
  partial: boolean
  items: EvidenceSourceApi[]
  blockedReason?: string
}

export interface RunEvidenceSourceApi extends EvidenceSourceApi {
  observed: boolean
  lastObservedAt?: string
  deliveryLane?: string
}

export interface RunEvidenceSourceCatalogApi {
  apiVersion: VerdictRuntimeApiVersion
  runId: string
  partial: boolean
  items: RunEvidenceSourceApi[]
  conflicts: readonly { factKey: string; reason: string; authorities: readonly string[] }[]
  blockedReason?: string
}

export interface CapabilityStatusApi {
  satisfied: boolean
  missing: readonly string[]
  reason: string | null
}

/** Mirrors pack-scoped semantic action read model. */
export interface SemanticActionApi {
  actionKey: string
  displayName: string
  businessMeaning: string
  notResponsibleFor: readonly string[]
  applicationRef: string
  screenRefs: readonly string[]
  surfaceRefs: readonly string[]
  entityTypeRefs: readonly string[]
  targetRefs: readonly string[]
  requiredCapabilityRefs: readonly string[]
  capabilityStatus: CapabilityStatusApi
}

export interface SemanticActionCatalogApi {
  apiVersion: VerdictRuntimeApiVersion
  packKey: string
  packVersion: string
  partial: boolean
  items: SemanticActionApi[]
  macros: readonly {
    macroKey: string
    actionRef: string
    displayName: string
    businessMeaning: string
    notResponsibleFor: readonly string[]
    requiredCapabilityRefs: readonly string[]
    capabilityStatus: CapabilityStatusApi
  }[]
  blockedReason?: string
}

export interface TargetResolutionEntityApi {
  entityKey: string
  targetKey: string
  strategies: readonly {
    order: number
    kind: string
    establishesIdentity: boolean
    ambiguityPolicy: string
  }[]
  notFoundPolicy: string
  ambiguityPolicy: string
  deadlineMs: number
  reverifyBeforeAction: boolean
  violations: readonly { code: string; message: string }[]
}

export interface TargetResolutionCatalogApi {
  apiVersion: VerdictRuntimeApiVersion
  packKey: string
  packVersion: string
  partial: boolean
  entities: TargetResolutionEntityApi[]
  blockedReason?: string
}

export interface LaunchProfileApi {
  profileKey: string
  applicationRef: string
  displayName: string
  startMode: string
  sessionPreparation: string
  preconditionFactKeys: readonly string[]
  entry: Record<string, unknown>
  preparationOperationRefs: readonly string[]
  cleanup: Record<string, unknown>
  producesProductVerdict: boolean
  releaseIsolation: Record<string, unknown>
  requiredCapabilityRefs: readonly string[]
  blockedReason?: string
}

export interface LaunchProfileCatalogApi {
  apiVersion: VerdictRuntimeApiVersion
  packKey: string
  packVersion: string
  partial: boolean
  items: LaunchProfileApi[]
  blockedReason?: string
}

export interface LaunchProfileValidateApi {
  apiVersion: VerdictRuntimeApiVersion
  ok: boolean
  violations: readonly { code: string; message: string }[]
  blockedReason?: string
}

export interface EntityCatalogItemApi {
  entityType: string
  applicationRef: string
  displayName: string
  businessKeyPath: string
  identityPaths: readonly string[]
  sourceQueryRefs: readonly string[]
}

export interface EntityBindingCatalogItemApi {
  entityTypeRef: string
  targetRef: string
  targetDisplayName: string
  projectedPaths: readonly string[]
  redactProjection: boolean
  entityKnown: boolean
}

export interface EntityBindingCatalogApi {
  apiVersion: VerdictRuntimeApiVersion
  packKey: string
  packVersion: string
  partial: boolean
  entities: EntityCatalogItemApi[]
  bindings: EntityBindingCatalogItemApi[]
  blockedReason?: string
}

export interface ReadinessContractApi {
  requiredFactKeys: readonly string[]
  anyOfFactKeys: readonly string[]
  noneOfFactKeys: readonly string[]
  deadlineMs: number
  stableForMs: number | null
}

export interface ApplicationRegistryItemApi {
  applicationKey: string
  displayName: string
  platform: string
}

export interface ScreenRegistryItemApi {
  screenKey: string
  applicationRef: string
  displayName: string
  readiness: ReadinessContractApi
  supportedSurfaceRefs: readonly string[]
}

export interface SurfaceRegistryItemApi {
  surfaceKey: string
  applicationRef: string
  kind: string
  displayName: string
  parentScreenRefs: readonly string[]
  detection: ReadinessContractApi
  defaultPolicy: string
  priority: number
  handlerMacroRef: string | null
  blocksProductVerdict: boolean
}

export interface ScreenSurfaceCatalogApi {
  apiVersion: VerdictRuntimeApiVersion
  packKey: string
  packVersion: string
  publicationState: DomainPackState
  revision: number
  bundleDigest: string
  partial: boolean
  applications: ApplicationRegistryItemApi[]
  screens: ScreenRegistryItemApi[]
  surfaces: SurfaceRegistryItemApi[]
  blockedReason?: string
  immutableReason?: string
}

/** Raw admin get payload — `{ apiVersion, pack }` with opaque bundle. */
export interface DomainPackVersionRecordApi {
  packKey: string
  version: string
  bundleDigest: string
  publicationState: DomainPackState
  bundle: unknown
  revision: number
  publishedAt?: string
  publishedBy?: string
}

export interface DomainPackAdminGetApi {
  apiVersion: VerdictRuntimeApiVersion
  pack: DomainPackVersionRecordApi
}

export interface WorkflowRunStartApi {
  apiVersion: VerdictRuntimeApiVersion
  runId: string
  executionId: string
  compiledPlanHash: string
  status: 'QUEUED'
  engineType: 'BRIDGEFLOW'
  injectedFault: string | null
  expectedClass: string | null
  injectedFaultHost: 'A' | 'B' | null
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

/** Mirrors `TestProfileCatalogService.list()`. */
export interface TestProfileCatalogItemApi {
  profileKey: string
  version: number
  kind: 'CORE' | 'PREVIEW' | 'SOAK' | 'FAULT'
  releaseGate: boolean
  packKey: string
  packVersion: string
  owner: string
  lastResult: string
  blockedReason?: string | null
}

export interface TestProfileCatalogApi {
  apiVersion: VerdictRuntimeApiVersion
  partial: boolean
  items: TestProfileCatalogItemApi[]
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

/**
 * Mirrors `DomainPackAdminService.list()` exactly. An earlier revision declared
 * a richer shape (displayName / latestVersion / applicationCount / …) that the
 * runtime never produced, which crashed the catalog page as soon as the list
 * was non-empty.
 */
export interface DomainPackSummary {
  packKey: string
  version: string
  bundleDigest: string
  publicationState: DomainPackState
  revision: number
  publishedAt?: string
  /**
   * True when this process can compile against the pack (code-resident registry
   * digest match, or a full published admin bundle the compile path can hydrate).
   */
  compileReady?: boolean
}

export interface DomainPackCatalogApi {
  apiVersion: VerdictRuntimeApiVersion
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
  features: Record<string, unknown>[]
  capabilities: Record<string, unknown>[]
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
