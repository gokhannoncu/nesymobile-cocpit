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

export function countRunHistoryStatuses(
  runs: Array<Pick<WorkflowRun, 'status'>>,
): { success: number; active: number; failed: number } {
  let success = 0
  let active = 0
  let failed = 0
  for (const run of runs) {
    if (run.status === 'success') success += 1
    else if (run.status === 'running' || run.status === 'pending') active += 1
    else if (run.status === 'failed') failed += 1
  }
  return { success, active, failed }
}

export function filterRunsByQuery(
  runs: WorkflowRun[],
  query: string,
): WorkflowRun[] {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return runs

  return runs.filter((run) => {
    const haystack = [
      run.workflow?.name ?? '',
      run.workflow?.slug ?? '',
      run.status,
      run.mode,
      run.deviceId ?? '',
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(normalizedQuery)
  })
}
