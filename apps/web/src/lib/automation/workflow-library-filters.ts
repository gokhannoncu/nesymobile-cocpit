import type { WorkflowListItem } from '@/services/automation-api'

export type WorkflowLibraryStatusFilter = 'all' | 'active' | 'draft' | 'archived'

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
