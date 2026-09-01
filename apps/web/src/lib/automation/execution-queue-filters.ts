import { resolveRunDurationMs } from '@/lib/verdict-runtime/adapters'
import type { WorkflowRunApi } from '@/lib/verdict-runtime/types'

export type ExecutionQueueFilter = 'all' | 'queued' | 'running' | 'terminal'

export type ExecutionQueueRow = {
  runId: string
  workflowId: string
  workflowSlug: string
  workflowName: string
  status: string
  engineType: string
  deviceId: string | null
  deviceLabel: string | null
  deviceModelName: string | null
  partial: boolean
  blockedReason: string | null
  createdAt: string | null
  startedAt: string | null
  completedAt: string | null
  duration: number | null
}

export function normalizeQueueStatus(status: unknown): string {
  return String(status ?? 'unknown').toLowerCase()
}

export function workflowRunApiToQueueRow(item: WorkflowRunApi): ExecutionQueueRow {
  const run = item.run ?? {}
  const runId = String(run.id ?? item.correlation.runId)
  const workflowId = String(run.workflowId ?? '')
  const workflowSlug = String(run.workflowSlug ?? workflowId)
  const workflowName = String(run.workflowName ?? workflowSlug)

  return {
    runId,
    workflowId,
    workflowSlug,
    workflowName,
    status: String(run.status ?? 'unknown'),
    engineType: String(item.correlation.engineType ?? 'BRIDGEFLOW'),
    deviceId:
      run.deviceId === undefined || run.deviceId === null ? null : String(run.deviceId),
    deviceLabel: textOrNull(run.deviceLabel),
    deviceModelName: textOrNull(run.deviceModelName),
    partial: Boolean(item.partial),
    blockedReason: item.blockedReason ?? null,
    createdAt:
      run.createdAt === undefined || run.createdAt === null ? null : String(run.createdAt),
    startedAt:
      run.startedAt === undefined || run.startedAt === null ? null : String(run.startedAt),
    completedAt:
      run.completedAt === undefined || run.completedAt === null ? null : String(run.completedAt),
    duration: resolveRunDurationMs(run),
  }
}

export function queueRowDurationMs(row: ExecutionQueueRow, nowMs = Date.now()): number | null {
  if (row.duration != null && Number.isFinite(row.duration) && row.duration >= 0) {
    return row.duration
  }
  const start = timestampMs(row.startedAt) ?? timestampMs(row.createdAt)
  const end = timestampMs(row.completedAt)
  if (start !== null && end !== null && end >= start) return end - start
  if (start !== null && isRunningQueueStatus(row.status) && nowMs >= start) return nowMs - start
  return null
}

function timestampMs(value: string | null): number | null {
  if (!value) return null
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function isQueuedQueueStatus(status: string): boolean {
  const normalized = normalizeQueueStatus(status)
  return normalized.includes('queued') || normalized === 'pending'
}

export function isRunningQueueStatus(status: string): boolean {
  return normalizeQueueStatus(status).includes('running')
}

export function isTerminalQueueRow(row: ExecutionQueueRow): boolean {
  return !isQueuedQueueStatus(row.status) && !isRunningQueueStatus(row.status)
}

export function isBlockedQueueRow(row: ExecutionQueueRow): boolean {
  return (
    Boolean(row.blockedReason) || normalizeQueueStatus(row.status) === 'blocked'
  )
}

export function queueRowMatchesFilter(
  row: ExecutionQueueRow,
  filter: ExecutionQueueFilter,
): boolean {
  if (filter === 'all') return true
  if (filter === 'queued') return isQueuedQueueStatus(row.status)
  if (filter === 'running') return isRunningQueueStatus(row.status)
  return isTerminalQueueRow(row)
}

export function filterQueueRowsByQuery(
  rows: ExecutionQueueRow[],
  query: string,
): ExecutionQueueRow[] {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return rows

  return rows.filter((row) => {
    const haystack = [
      row.runId,
      row.workflowName,
      row.workflowSlug,
      row.status,
      row.engineType,
      row.deviceId ?? '',
      row.deviceLabel ?? '',
      row.deviceModelName ?? '',
      row.blockedReason ?? '',
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(normalizedQuery)
  })
}

export function countExecutionQueueStatuses(rows: ExecutionQueueRow[]): {
  queued: number
  running: number
  terminal: number
  blocked: number
  partial: number
} {
  let queued = 0
  let running = 0
  let terminal = 0
  let blocked = 0
  let partial = 0

  for (const row of rows) {
    if (isQueuedQueueStatus(row.status)) queued += 1
    if (isRunningQueueStatus(row.status)) running += 1
    if (isTerminalQueueRow(row)) terminal += 1
    if (isBlockedQueueRow(row)) blocked += 1
    if (row.partial) partial += 1
  }

  return { queued, running, terminal, blocked, partial }
}

export function formatQueueShare(count: number, total: number): string {
  if (total === 0) return 'No executions yet'
  return `${((count / total) * 100).toFixed(1)}% of pipeline`
}

export function truncateRunId(runId: string, visible = 10): string {
  if (runId.length <= visible + 3) return runId
  return `${runId.slice(0, visible)}…`
}

export function queueDeviceChipLabel(row: Pick<ExecutionQueueRow, 'deviceId' | 'deviceLabel' | 'deviceModelName'>): string {
  const named = row.deviceLabel?.trim() || row.deviceModelName?.trim()
  if (named) return named
  if (row.deviceId) return row.deviceId
  return 'No device'
}

function textOrNull(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null
  return String(value)
}
