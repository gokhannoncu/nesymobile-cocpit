import type { WorkflowListItem } from '@/services/automation-api'
import { isHiddenSystemWorkflow } from './system-workflows'

export type WorkflowLibraryStatusFilter = 'all' | 'active' | 'draft' | 'archived'

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
  return workflow.status === filter
}

export function formatWorkflowShare(count: number, total: number): string {
  if (total === 0) return 'No workflows yet'
  return `${((count / total) * 100).toFixed(1)}% of total`
}
