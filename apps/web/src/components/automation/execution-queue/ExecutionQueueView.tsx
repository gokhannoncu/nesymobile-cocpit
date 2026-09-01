'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ExecutionQueueHeader } from '@/components/automation/execution-queue/ExecutionQueueHeader'
import { ExecutionQueueTable } from '@/components/automation/execution-queue/ExecutionQueueTable'
import { fetchVerdictRunHistory } from '@/lib/verdict-runtime/client'
import type { WorkflowRunApi } from '@/lib/verdict-runtime/types'
import {
  countExecutionQueueStatuses,
  filterQueueRowsByQuery,
  queueRowMatchesFilter,
  workflowRunApiToQueueRow,
  type ExecutionQueueFilter,
} from '@/lib/automation/execution-queue-filters'
import { deleteRun, deleteRuns } from '@/services/automation-api'
import { toast } from 'sonner'

function itemRunId(item: WorkflowRunApi): string {
  return String(item.run?.id ?? item.correlation.runId)
}

export function ExecutionQueueView({
  initialItems,
}: {
  initialItems: WorkflowRunApi[]
}) {
  const [items, setItems] = useState(initialItems)
  const [loading, setLoading] = useState(false)
  const [activeFilter, setActiveFilter] = useState<ExecutionQueueFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'updated-desc' | 'updated-asc'>('updated-desc')
  const searchInputRef = useRef<HTMLInputElement>(null)

  const rows = useMemo(
    () => items.map(workflowRunApiToQueueRow),
    [items],
  )

  const statusCounts = useMemo(() => countExecutionQueueStatuses(rows), [rows])

  const searchedRows = useMemo(
    () => filterQueueRowsByQuery(rows, searchQuery),
    [rows, searchQuery],
  )

  const filteredRows = useMemo(
    () => searchedRows.filter((row) => queueRowMatchesFilter(row, activeFilter)),
    [searchedRows, activeFilter],
  )

  const hasFilters = activeFilter !== 'all' || Boolean(searchQuery.trim())

  const clearSearch = () => setSearchQuery('')

  const clearFilters = () => {
    setActiveFilter('all')
    clearSearch()
  }

  const handleDeleteRun = async (workflowId: string, runId: string) => {
    try {
      await deleteRun(workflowId, runId)
      setItems((prev) => prev.filter((item) => itemRunId(item) !== runId))
      toast.success('Run removed from the queue.')
    } catch (error) {
      console.error('Failed to delete run:', error)
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
        setItems((prev) => prev.filter((item) => !deletedSet.has(itemRunId(item))))
      }

      if (failed.length === 0) {
        toast.success(
          deleted.length === 1
            ? 'Run removed from the queue.'
            : `${deleted.length} runs removed from the queue.`,
        )
      } else if (deleted.length > 0) {
        toast.warning(`${deleted.length} runs deleted, ${failed.length} could not be removed.`)
      } else {
        toast.error('Failed to delete selected runs.')
      }
    } catch (error) {
      console.error('Failed to bulk delete runs:', error)
      toast.error('Failed to delete selected runs.')
    }
  }

  const loadQueue = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetchVerdictRunHistory({ limit: 100, engineType: 'BRIDGEFLOW' })
      setItems(response.items)
    } catch (error) {
      console.error('Failed to refresh execution queue:', error)
      toast.error('Execution queue could not be refreshed.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadQueue()
  }, [loadQueue])

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

  return (
    <div className="space-y-5">
      <ExecutionQueueHeader
        totalCount={rows.length}
        filteredCount={filteredRows.length}
        statusCounts={statusCounts}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onClearSearch={clearSearch}
        sortBy={sortBy}
        onSortChange={setSortBy}
        onRefresh={() => void loadQueue()}
        onClearFilters={clearFilters}
        hasFilters={hasFilters}
        isRefreshing={loading}
        searchInputRef={searchInputRef}
      />

      <ExecutionQueueTable
        rows={filteredRows}
        allRowsCount={rows.length}
        sortBy={sortBy}
        onClearFilters={clearFilters}
        onDeleteRun={handleDeleteRun}
        onBulkDeleteRuns={handleBulkDeleteRuns}
      />
    </div>
  )
}
