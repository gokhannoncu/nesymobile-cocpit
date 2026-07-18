import type { WorkflowRun } from '@/services/automation-api'
import { isHiddenSystemWorkflow } from './system-workflows'

export type RunHistoryStatusFilter =
  | 'all'
  | 'success'
  | 'failed'
  | 'active'
  | 'running'
  | 'pending'
  | 'cancelled'

export function isVisibleHistoryRun(
  run: Pick<WorkflowRun, 'workflow'>,
): boolean {
  return !isHiddenSystemWorkflow(run.workflow?.slug)
}

export function runMatchesStatusFilter(
  run: WorkflowRun,
  filter: RunHistoryStatusFilter,
): boolean {
  if (filter === 'all') return true
  if (filter === 'active') {
    return run.status === 'running' || run.status === 'pending'
  }
  return run.status === filter
}

export function formatRunShare(count: number, total: number): string {
  if (total === 0) return 'No runs yet'
  return `${((count / total) * 100).toFixed(1)}% of total`
}
