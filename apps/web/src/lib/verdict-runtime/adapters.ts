import type { WorkflowListItem, WorkflowRun } from '@/services/automation-api'
import type { WorkflowCatalogItemApi, WorkflowRunApi } from './types'

/** Map WorkflowCatalogQuery items onto the existing library card shape. */
export function catalogItemToWorkflowListItem(item: WorkflowCatalogItemApi): WorkflowListItem {
  return {
    id: item.id,
    slug: item.slug,
    name: item.name,
    description: item.description,
    status: item.status,
    category: item.category,
    icon: item.icon,
    iconClassName: item.iconClassName,
    currentVersionId: item.currentVersionId,
    createdAt: String(item.createdAt),
    updatedAt: String(item.updatedAt),
    latestVersion: item.latestVersion
      ? {
          id: String(item.latestVersion.id),
          version: Number(item.latestVersion.version),
          createdAt: String(item.latestVersion.createdAt),
        }
      : null,
    lastRun: item.lastRun
      ? {
          id: String(item.lastRun.id),
          status: String(item.lastRun.status),
          createdAt: String(item.lastRun.createdAt),
          duration:
            item.lastRun.duration === null || item.lastRun.duration === undefined
              ? null
              : Number(item.lastRun.duration),
        }
      : null,
  }
}

export function resolveRunDurationMs(run: Record<string, unknown>): number | null {
  if (run.duration !== undefined && run.duration !== null && run.duration !== '') {
    const explicit = Number(run.duration)
    if (Number.isFinite(explicit) && explicit >= 0) return explicit
  }
  const start = timestampMs(run.startedAt) ?? timestampMs(run.createdAt)
  const end = timestampMs(run.completedAt)
  if (start === null || end === null || end < start) return null
  return end - start
}

function historyDeviceOf(run: Record<string, unknown>): WorkflowRun['device'] {
  const label = run.deviceLabel === undefined || run.deviceLabel === null ? null : String(run.deviceLabel)
  const modelName =
    run.deviceModelName === undefined || run.deviceModelName === null
      ? null
      : String(run.deviceModelName)
  if (!label && !modelName) return null
  return {
    modelName: modelName ?? label ?? '',
    label,
  }
}

function historyVersionOf(run: Record<string, unknown>): WorkflowRun['version'] {
  if (run.workflowVersion === undefined || run.workflowVersion === null || run.workflowVersion === '') {
    return undefined
  }
  const version = Number(run.workflowVersion)
  return Number.isFinite(version) ? { version } : undefined
}

export function formatRunEnvironmentLabel(run: Pick<WorkflowRun, 'country' | 'environment'>): string | null {
  const country = run.country?.trim().toUpperCase() ?? ''
  const environment = normalizeEnvironmentLabel(run.environment)
  if (country && environment) return `${country}-${environment}`
  if (country) return country
  if (environment) return environment
  return null
}

function normalizeEnvironmentLabel(value: string | null | undefined): string | null {
  const raw = value?.trim().toLowerCase() ?? ''
  if (!raw) return null
  if (raw === 'test' || raw === 'staging') return 'STAGE'
  return raw.toUpperCase()
}

function textOrNull(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null
  return String(value)
}

function timestampMs(value: unknown): number | null {
  if (value instanceof Date) {
    const ms = value.getTime()
    return Number.isFinite(ms) ? ms : null
  }
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

/** Map RunHistoryQuery items onto the existing history table shape. */
export function workflowRunApiToHistoryRow(item: WorkflowRunApi): WorkflowRun {
  const run = item.run ?? {}
  const runtime = item.runtime ?? {}
  const id = String(run.id ?? item.correlation.runId)
  const workflowId = String(run.workflowId ?? '')
  const slug = String(run.workflowSlug ?? workflowId)
  const name = String(run.workflowName ?? slug)
  return {
    id,
    workflowId,
    versionId: String(run.versionId ?? ''),
    status: String(run.status ?? 'pending'),
    mode: String(run.mode ?? 'full'),
    targetStepId: null,
    deviceId: run.deviceId === undefined || run.deviceId === null ? null : String(run.deviceId),
    device: historyDeviceOf(run),
    version: historyVersionOf(run),
    country: textOrNull(run.country) ?? textOrNull(run.launchCountry) ?? 'RS',
    environment: textOrNull(run.environment) ?? textOrNull(run.launchEnvironment) ?? 'stage',
    startedAt: run.startedAt === undefined || run.startedAt === null ? null : String(run.startedAt),
    completedAt:
      run.completedAt === undefined || run.completedAt === null ? null : String(run.completedAt),
    duration: resolveRunDurationMs(run),
    createdAt: String(run.createdAt ?? ''),
    workflow: {
      id: workflowId,
      slug,
      name,
    },
    // Preserve engine/verdict for optional columns without inventing outcomes.
    ...(runtime.engineType !== undefined
      ? { engineType: String(runtime.engineType) }
      : { engineType: item.correlation.engineType }),
  } as WorkflowRun
}
