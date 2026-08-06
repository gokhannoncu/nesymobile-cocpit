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
    country: null,
    environment: null,
    startedAt: run.startedAt === undefined || run.startedAt === null ? null : String(run.startedAt),
    completedAt:
      run.completedAt === undefined || run.completedAt === null ? null : String(run.completedAt),
    duration:
      run.duration === undefined || run.duration === null ? null : Number(run.duration),
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
