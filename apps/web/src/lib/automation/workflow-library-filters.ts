import type { WorkflowListItem } from '@/services/automation-api'
import { isHiddenSystemWorkflow } from './system-workflows'

export type WorkflowLibraryStatusFilter = 'all' | 'active' | 'draft' | 'archived'

export type WorkflowLibraryStatusBucket = Exclude<WorkflowLibraryStatusFilter, 'all'>

export function workflowLibraryStatusBucket(
  status: string,
): WorkflowLibraryStatusBucket | null {
  if (status === 'active' || status === 'published') return 'active'
  if (status === 'draft') return 'draft'
  if (status === 'archived') return 'archived'
  return null
}

export function isVisibleLibraryWorkflow(
  workflow: Pick<WorkflowListItem, 'slug'>,
): boolean {
  return !isHiddenSystemWorkflow(workflow.slug)
}

export function workflowMatchesStatusFilter(
  workflow: WorkflowListItem,
  filter: WorkflowLibraryStatusFilter,
): boolean {
  if (filter === 'all') return true
  return workflowLibraryStatusBucket(workflow.status) === filter
}

export function countWorkflowLibraryStatuses(
  workflows: Pick<WorkflowListItem, 'status'>[],
): Record<WorkflowLibraryStatusBucket, number> {
  const counts: Record<WorkflowLibraryStatusBucket, number> = {
    active: 0,
    draft: 0,
    archived: 0,
  }
  for (const workflow of workflows) {
    const bucket = workflowLibraryStatusBucket(workflow.status)
    if (bucket) counts[bucket] += 1
  }
  return counts
}

export function formatWorkflowShare(count: number, total: number): string {
  if (total === 0) return 'No workflows yet'
  if (count === 0) return 'None in this status'
  const pct = (count / total) * 100
  if (pct >= 10) return `${Math.round(pct)}% of library`
  return `${pct.toFixed(1)}% of library`
}
