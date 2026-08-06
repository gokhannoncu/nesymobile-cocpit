import { prisma } from '@nesy/db'

export interface RuntimeHistoryQuery {
  limit: number
  offset: number
  engineType?: string
}

export interface WorkflowRunApi {
  apiVersion: 'verdict-runtime.v1'
  run: Record<string, unknown>
  runtime: Record<string, unknown> | null
  partial: boolean
  blockedReason?: string
  correlation: {
    runId: string
    engineType: string
  }
}

export interface RunHistoryResult {
  apiVersion: 'verdict-runtime.v1'
  limit: number
  offset: number
  items: readonly WorkflowRunApi[]
}

export interface RunDetailResult extends WorkflowRunApi {
  steps: readonly Record<string, unknown>[]
  waits: readonly Record<string, unknown>[]
  actionTransitions: readonly Record<string, unknown>[]
  oracleEvaluations: readonly Record<string, unknown>[]
  testExecutions: readonly Record<string, unknown>[]
  resourceLeases: readonly Record<string, unknown>[]
  remoteActions: readonly Record<string, unknown>[]
}

export interface EvidenceJourneyResult {
  apiVersion: 'verdict-runtime.v1'
  runId: string
  items: readonly Record<string, unknown>[]
}

type Row = Record<string, unknown>

export async function queryRunHistory(query: RuntimeHistoryQuery): Promise<RunHistoryResult> {
  const limit = clampLimit(query.limit)
  const offset = Math.max(0, query.offset)
  const rows = query.engineType
    ? await prisma.$queryRaw<Row[]>`
        SELECT
          wr.id,
          wr.status,
          wr."createdAt" AS "createdAt",
          wr."startedAt" AS "startedAt",
          wr."completedAt" AS "completedAt",
          wr.duration,
          wr."workflowId" AS "workflowId",
          wr."versionId" AS "versionId",
          w.slug AS "workflowSlug",
          w.name AS "workflowName",
          bfr.engine_type AS "engineType",
          bfr.lifecycle,
          bfr.product_verdict AS "productVerdict",
          bfr.scheduler_disposition AS "schedulerDisposition",
          bfr.operational_disposition AS "operationalDisposition"
        FROM workflow_runs wr
        LEFT JOIN workflows w ON w.id = wr."workflowId"
        LEFT JOIN bridgeflow_run_runtime bfr ON bfr.run_id = wr.id
        WHERE COALESCE(bfr.engine_type, 'MAESTRO_LEGACY') = ${query.engineType}
        ORDER BY wr."createdAt" DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `
    : await prisma.$queryRaw<Row[]>`
        SELECT
          wr.id,
          wr.status,
          wr."createdAt" AS "createdAt",
          wr."startedAt" AS "startedAt",
          wr."completedAt" AS "completedAt",
          wr.duration,
          wr."workflowId" AS "workflowId",
          wr."versionId" AS "versionId",
          w.slug AS "workflowSlug",
          w.name AS "workflowName",
          bfr.engine_type AS "engineType",
          bfr.lifecycle,
          bfr.product_verdict AS "productVerdict",
          bfr.scheduler_disposition AS "schedulerDisposition",
          bfr.operational_disposition AS "operationalDisposition"
        FROM workflow_runs wr
        LEFT JOIN workflows w ON w.id = wr."workflowId"
        LEFT JOIN bridgeflow_run_runtime bfr ON bfr.run_id = wr.id
        ORDER BY wr."createdAt" DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `

  return {
    apiVersion: 'verdict-runtime.v1',
    limit,
    offset,
    items: rows.map(toWorkflowRunApi),
  }
}

export async function getRunDetail(runId: string): Promise<RunDetailResult | null> {
  const runRows = await prisma.$queryRaw<Row[]>`
    SELECT
      wr.id,
      wr.status,
      wr."createdAt" AS "createdAt",
      wr."workflowId" AS "workflowId",
      wr."versionId" AS "versionId",
      wr."yamlContent" AS "yamlContent",
      wr."maestroOutput" AS "maestroOutput",
      bfr.engine_type AS "engineType",
      bfr.*
    FROM workflow_runs wr
    LEFT JOIN bridgeflow_run_runtime bfr ON bfr.run_id = wr.id
    WHERE wr.id = ${runId}
    LIMIT 1
  `
  const first = runRows[0]
  if (!first) return null

  const [steps, waits, actionTransitions, oracleEvaluations, testExecutions, resourceLeases, remoteActions] =
    await Promise.all([
      prisma.$queryRaw<Row[]>`
        SELECT * FROM bridgeflow_step_occurrence WHERE run_id = ${runId} ORDER BY occurrence_index ASC
      `,
      prisma.$queryRaw<Row[]>`
        SELECT * FROM bridgeflow_wait_event WHERE run_id = ${runId} ORDER BY terminal_at ASC
      `,
      prisma.$queryRaw<Row[]>`
        SELECT * FROM bridgeflow_action_transition WHERE run_id = ${runId} ORDER BY at_ms ASC
      `,
      prisma.$queryRaw<Row[]>`
        SELECT * FROM bridgeflow_oracle_evaluation WHERE run_id = ${runId} ORDER BY created_at ASC
      `,
      prisma.$queryRaw<Row[]>`
        SELECT * FROM verdict_test_execution WHERE run_id = ${runId} ORDER BY created_at ASC
      `,
      prisma.$queryRaw<Row[]>`
        SELECT * FROM verdict_resource_lease WHERE run_id = ${runId} ORDER BY leased_at ASC
      `,
      prisma.$queryRaw<Row[]>`
        SELECT * FROM verdict_remote_action_attempt WHERE run_id = ${runId} ORDER BY started_at ASC
      `,
    ])

  return {
    ...toWorkflowRunApi(first),
    steps: toJsonSafe(steps),
    waits: toJsonSafe(waits),
    actionTransitions: toJsonSafe(actionTransitions),
    oracleEvaluations: toJsonSafe(oracleEvaluations),
    testExecutions: toJsonSafe(testExecutions),
    resourceLeases: toJsonSafe(resourceLeases),
    remoteActions: toJsonSafe(remoteActions),
  }
}

export async function getEvidenceJourney(runId: string): Promise<EvidenceJourneyResult> {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT
      occurrence_id AS "occurrenceId",
      iteration_key AS "iterationKey",
      fact_key AS "factKey",
      plane,
      source_subtype AS "sourceSubtype",
      authority,
      delivery_lane AS "deliveryLane",
      correlation_status AS "correlationStatus",
      journey_stage AS "journeyStage",
      journey_state AS "journeyState",
      raw_event_ref AS "rawEventRef",
      observed_at AS "observedAt"
    FROM bridgeflow_evidence_fact
    WHERE run_id = ${runId}
    ORDER BY observed_at ASC
  `
  return {
    apiVersion: 'verdict-runtime.v1',
    runId,
    items: toJsonSafe(rows),
  }
}

export async function getLegacyRunSummary(runId: string): Promise<WorkflowRunApi | null> {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT
      wr.id,
      wr.status,
      wr."createdAt" AS "createdAt",
      wr."workflowId" AS "workflowId",
      wr."versionId" AS "versionId",
      wr."yamlContent" AS "yamlContent",
      wr."maestroOutput" AS "maestroOutput",
      NULL::text AS "engineType"
    FROM workflow_runs wr
    WHERE wr.id = ${runId}
    LIMIT 1
  `
  const first = rows[0]
  return first ? toWorkflowRunApi(first) : null
}

export async function getDeviceReadiness(deviceId: string): Promise<Record<string, unknown>> {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT id, "deviceId", "adbDeviceId", "modelName", product, "transportId", label, "updatedAt"
    FROM mobile_devices
    WHERE id = ${deviceId} OR "deviceId" = ${deviceId} OR "adbDeviceId" = ${deviceId}
    LIMIT 1
  `
  const device = rows[0] ? toJsonSafe(rows[0]) : null
  return {
    apiVersion: 'verdict-runtime.v1',
    device,
    readiness: device ? 'KNOWN_DEVICE' : 'UNKNOWN_DEVICE',
    bridgeflowRuntime: {
      mutationAdmission: 'SINGLE_MUTATION_PER_DEVICE',
      waitRuntime: 'BOUNDED_WAIT_ANY',
    },
  }
}

export async function getWorkflowCatalog(limit = 50): Promise<Record<string, unknown>> {
  const rows = await prisma.$queryRaw<Row[]>`
    SELECT
      w.id,
      w.slug,
      w.name,
      w.description,
      w.status,
      w.category,
      w.icon,
      w."iconClassName" AS "iconClassName",
      w."currentVersionId" AS "currentVersionId",
      w."createdAt" AS "createdAt",
      w."updatedAt" AS "updatedAt",
      lv.id AS "latestVersionId",
      lv.version AS "latestVersionNumber",
      lv."createdAt" AS "latestVersionCreatedAt",
      lr.id AS "lastRunId",
      lr.status AS "lastRunStatus",
      lr."createdAt" AS "lastRunCreatedAt",
      lr.duration AS "lastRunDuration"
    FROM workflows w
    LEFT JOIN LATERAL (
      SELECT id, version, "createdAt"
      FROM workflow_versions
      WHERE "workflowId" = w.id
      ORDER BY version DESC
      LIMIT 1
    ) lv ON true
    LEFT JOIN LATERAL (
      SELECT id, status, "createdAt", duration
      FROM workflow_runs
      WHERE "workflowId" = w.id
      ORDER BY "createdAt" DESC
      LIMIT 1
    ) lr ON true
    ORDER BY w."updatedAt" DESC
    LIMIT ${clampLimit(limit)}
  `
  return {
    apiVersion: 'verdict-runtime.v1',
    items: rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description ?? null,
      status: row.status,
      category: row.category ?? null,
      icon: row.icon ?? 'Workflow',
      iconClassName: row.iconClassName ?? '',
      currentVersionId: row.currentVersionId ?? null,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      latestVersion:
        row.latestVersionId !== undefined && row.latestVersionId !== null
          ? {
              id: row.latestVersionId,
              version: row.latestVersionNumber,
              createdAt: row.latestVersionCreatedAt,
            }
          : null,
      lastRun:
        row.lastRunId !== undefined && row.lastRunId !== null
          ? {
              id: row.lastRunId,
              status: row.lastRunStatus,
              createdAt: row.lastRunCreatedAt,
              duration: row.lastRunDuration ?? null,
            }
          : null,
    })),
  }
}

export function getTestProfileCatalog(): Record<string, unknown> {
  return {
    apiVersion: 'verdict-runtime.v1',
    items: [],
    partial: true,
    blockedReason: 'Domain Pack profile registry read model is Phase 6 UI/API work; Phase 5 pins profile snapshots at run start.',
  }
}

export function getTestCampaignResult(campaignId: string): Record<string, unknown> {
  return {
    apiVersion: 'verdict-runtime.v1',
    campaignId,
    items: [],
    partial: true,
    blockedReason: 'Campaign aggregate cannot PASS/FAIL without real BridgeFlow run/evidence summaries.',
  }
}

export function toWorkflowRunApi(row: Row): WorkflowRunApi {
  const runId = String(row.id)
  const rawEngineType = row.engineType ?? row.engine_type
  const engineType = typeof rawEngineType === 'string' ? rawEngineType : 'MAESTRO_LEGACY'
  const runtimeFieldAliases: Readonly<Record<string, readonly string[]>> = {
    engineType: ['engineType', 'engine_type'],
    compiledPlanRef: ['compiledPlanRef', 'compiled_plan_ref'],
    compiledPlanHash: ['compiledPlanHash', 'compiled_plan_hash'],
    domainPackKey: ['domainPackKey', 'domain_pack_key'],
    domainPackVersion: ['domainPackVersion', 'domain_pack_version'],
    domainPackDigest: ['domainPackDigest', 'domain_pack_digest'],
    workflowIrSchemaVersion: ['workflowIrSchemaVersion', 'workflow_ir_schema_version'],
    compilerVersion: ['compilerVersion', 'compiler_version'],
    bridgeProtocolVersion: ['bridgeProtocolVersion', 'bridge_protocol_version'],
    sdkProtocolVersion: ['sdkProtocolVersion', 'sdk_protocol_version'],
    runSessionId: ['runSessionId', 'run_session_id'],
    runEpochMs: ['runEpochMs', 'run_epoch_ms'],
    runEpochUnit: ['runEpochUnit', 'run_epoch_unit'],
    profileSnapshot: ['profileSnapshot', 'profile_snapshot'],
    lifecycle: ['lifecycle'],
    productVerdict: ['productVerdict', 'product_verdict'],
    evaluationFailureClass: ['evaluationFailureClass', 'evaluation_failure_class'],
    terminationReason: ['terminationReason', 'termination_reason'],
    cleanupResult: ['cleanupResult', 'cleanup_result'],
    resourceReleaseResult: ['resourceReleaseResult', 'resource_release_result'],
    schedulerDisposition: ['schedulerDisposition', 'scheduler_disposition'],
    operationalDisposition: ['operationalDisposition', 'operational_disposition'],
  }
  const runtimeEntries = Object.entries(runtimeFieldAliases).flatMap(([outputKey, aliases]) => {
    const alias = aliases.find((candidate) => row[candidate] !== undefined && row[candidate] !== null)
    return alias ? [[outputKey, toJsonSafe(row[alias])]] : []
  })
  const runtime = Object.fromEntries(runtimeEntries)
  return {
    apiVersion: 'verdict-runtime.v1',
    run: toJsonSafe(row),
    runtime: Object.keys(runtime).length > 0 ? runtime : null,
    partial: engineType === 'MAESTRO_LEGACY',
    ...(engineType === 'MAESTRO_LEGACY'
      ? { blockedReason: 'Legacy Maestro run: BridgeFlow occurrence/oracle tables do not apply.' }
      : {}),
    correlation: {
      runId,
      engineType,
    },
  }
}

export function toJsonSafe<T>(value: T): T {
  if (typeof value === 'bigint') return value.toString() as T
  if (Array.isArray(value)) return value.map((item) => toJsonSafe(item)) as T
  if (value instanceof Date) return value
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, toJsonSafe(item)]),
    ) as T
  }
  return value
}

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit)) return 50
  return Math.min(100, Math.max(1, Math.trunc(limit)))
}
