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
import { toast } from 'sonner'

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
      />
    </div>
  )
}
