'use client'

import { ProductPage } from '@/components/product'
import {
  AutomationHistoryPageShimmer,
  AutomationHistoryTableShimmer,
} from '@/components/automation/automation-history-page-shimmer'
import { RunHistoryHeader } from '@/components/automation/run-history/RunHistoryHeader'
import { RunHistoryTable } from '@/components/automation/run-history/RunHistoryTable'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { deleteRun, deleteRuns, type WorkflowRun } from '@/services/automation-api'
import { fetchVerdictRunHistory } from '@/lib/verdict-runtime/client'
import { workflowRunApiToHistoryRow } from '@/lib/verdict-runtime/adapters'
import { toast } from 'sonner'
import {
  countRunHistoryStatuses,
  filterRunsByQuery,
  isVisibleHistoryRun,
  runMatchesStatusFilter,
  type RunHistoryStatusFilter,
} from '@/lib/automation/run-history-filters'

export default function AutomationHistoryPage() {
  const [runs, setRuns] = useState<WorkflowRun[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<RunHistoryStatusFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'created-desc' | 'created-asc'>('created-desc')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const loadRuns = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetchVerdictRunHistory({ limit: 200, offset: 0 })
      setRuns(response.items.map(workflowRunApiToHistoryRow))
    } catch (err) {
      console.error('Failed to load run history:', err)
      toast.error('Run history could not be loaded.')
      setRuns([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRuns()
  }, [loadRuns])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
      const target = event.target
      if (
        target instanceof HTMLElement &&
        (target.closest('input, textarea, select, [contenteditable="true"]') ||
          target.isContentEditable)
      ) {
        return
      }
      event.preventDefault()
      searchInputRef.current?.focus()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const visibleRuns = useMemo(() => runs.filter(isVisibleHistoryRun), [runs])

  const statusCounts = useMemo(() => countRunHistoryStatuses(visibleRuns), [visibleRuns])

  const passRate = useMemo(() => {
    const total = visibleRuns.length
    if (!total) return null
    return Math.round((statusCounts.success / total) * 100)
  }, [visibleRuns.length, statusCounts.success])

  const searchedRuns = useMemo(
    () => filterRunsByQuery(visibleRuns, searchQuery),
    [visibleRuns, searchQuery],
  )

  const filteredRuns = useMemo(
    () => searchedRuns.filter((run) => runMatchesStatusFilter(run, statusFilter)),
    [searchedRuns, statusFilter],
  )

  const hasFilters = statusFilter !== 'all' || Boolean(searchQuery.trim())

  const clearSearch = () => setSearchQuery('')

  const clearFilters = () => {
    setStatusFilter('all')
    clearSearch()
  }

  const handleDeleteRun = async (workflowId: string, runId: string) => {
    try {
      await deleteRun(workflowId, runId)
      setRuns((prev) => prev.filter((r) => r.id !== runId))
      toast.success('Run removed from history.')
    } catch (err) {
      console.error('Failed to delete run:', err)
      toast.error('Failed to delete run.')
    }
  }

  const handleBulkDeleteRuns = async (
    targets: Array<{ workflowId: string; runId: string }>,
  ) => {
    if (targets.length === 0) return

    try {
      const { deleted, failed } = await deleteRuns(targets)
      if (deleted.length > 0) {
        const deletedSet = new Set(deleted)
        setRuns((prev) => prev.filter((run) => !deletedSet.has(run.id)))
      }

      if (failed.length === 0) {
        toast.success(
          deleted.length === 1
            ? 'Run removed from history.'
            : `${deleted.length} runs removed from history.`,
        )
      } else if (deleted.length > 0) {
        toast.warning(`${deleted.length} runs deleted, ${failed.length} could not be removed.`)
      } else {
        toast.error('Failed to delete selected runs.')
      }
    } catch (err) {
      console.error('Failed to bulk delete runs:', err)
      toast.error('Failed to delete selected runs.')
    }
  }

  const reloadShimmerRows = Math.min(Math.max(visibleRuns.length, 1), 5)

  return (
    <ProductPage path="/automation/history" hideToolbar>
      <div className="space-y-5">
        {loading && runs.length === 0 ? (
          <AutomationHistoryPageShimmer />
        ) : (
          <>
            <RunHistoryHeader
              totalCount={visibleRuns.length}
              filteredCount={filteredRuns.length}
              statusCounts={statusCounts}
              passRate={passRate}
              statusFilter={statusFilter}
              onStatusChange={setStatusFilter}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onClearSearch={clearSearch}
              sortBy={sortBy}
              onSortChange={setSortBy}
              onRefresh={() => void loadRuns()}
              onClearFilters={clearFilters}
              hasFilters={hasFilters}
              isRefreshing={loading}
              searchInputRef={searchInputRef}
            />

            {loading ? (
              <AutomationHistoryTableShimmer rowCount={reloadShimmerRows} />
            ) : (
              <RunHistoryTable
                runs={filteredRuns}
                allRunsCount={visibleRuns.length}
                sortBy={sortBy}
                onClearFilters={clearFilters}
                onDeleteRun={handleDeleteRun}
                onBulkDeleteRuns={handleBulkDeleteRuns}
              />
            )}
          </>
        )}
      </div>
    </ProductPage>
  )
}
