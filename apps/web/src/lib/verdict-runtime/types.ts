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
