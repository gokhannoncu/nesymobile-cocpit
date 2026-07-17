'use client'

import {
  BadgeCheck,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleX,
  ClipboardCheck,
  Loader2,
  Network,
  Play,
  Search,
} from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@nesy/metronic/components/ui/alert-dialog'
import { ProductPage } from '@/components/product'
import {
  AutomationHistoryStatCardsShimmer,
  AutomationHistoryTableShimmer,
} from '@/components/automation/automation-history-page-shimmer'
import { cn } from '@nesy/metronic/lib/utils'
import { AUTOMATION_LIST_PATH } from '@nesy/metronic/config/layout-21.config'
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ComponentType, ReactNode, SVGProps } from 'react'
import { deleteRun, fetchAllRuns, type WorkflowRun } from '@/services/automation-api'
import Link from 'next/link'
import { toast } from 'sonner'

type Icon = ComponentType<SVGProps<SVGSVGElement>>

import {
  formatRunShare,
  runMatchesStatusFilter,
  type RunHistoryStatusFilter,
} from '@/lib/automation/run-history-filters'

type StatCardFilter = 'all' | 'success' | 'failed' | 'active'

const statCardDefinitions: Array<{
  label: string
  caption: string
  icon: Icon
  tone: string
  filter: StatCardFilter
}> = [
  {
    label: 'Total runs',
    caption: 'All time',
    icon: Network,
    tone: 'bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400',
    filter: 'all',
  },
  {
    label: 'Successful',
    caption: 'Completed OK',
    icon: BadgeCheck,
    tone: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400',
    filter: 'success',
  },
  {
    label: 'In progress',
    caption: 'Running or pending',
    icon: ClipboardCheck,
    tone: 'bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400',
    filter: 'active',
  },
  {
    label: 'Failed',
    caption: 'Ended with error',
    icon: CircleX,
    tone: 'bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400',
    filter: 'failed',
  },
]

function formatDuration(ms: number | null | undefined): string {
  if (!ms) return '—'
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

function runStatusClassName(status: string): string {
  if (status === 'success') return 'bg-emerald-50 text-emerald-700 ring-emerald-100 dark:bg-emerald-950 dark:text-emerald-400 dark:ring-emerald-800'
  if (status === 'failed') return 'bg-rose-50 text-rose-700 ring-rose-100 dark:bg-rose-950 dark:text-rose-400 dark:ring-rose-800'
  if (status === 'running') return 'bg-blue-50 text-blue-700 ring-blue-100 dark:bg-blue-950 dark:text-blue-400 dark:ring-blue-800'
  if (status === 'pending') return 'bg-amber-50 text-amber-700 ring-amber-100 dark:bg-amber-950 dark:text-amber-400 dark:ring-amber-800'
  if (status === 'cancelled') return 'bg-muted text-muted-foreground ring-border'
  return 'bg-muted text-muted-foreground ring-border'
}

export default function AutomationHistoryPage() {
  const [runs, setRuns] = useState<WorkflowRun[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<RunHistoryStatusFilter>('all')

  const loadRuns = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetchAllRuns({ limit: 200 })
      setRuns(response.data)
    } catch (err) {
      console.error('Failed to load run history:', err)
      toast.error('Run history could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRuns()
  }, [loadRuns])

  const stats = useMemo(() => {
    const total = runs.length
    const success = runs.filter((r) => r.status === 'success').length
    const active = runs.filter((r) => r.status === 'running' || r.status === 'pending').length
    const failed = runs.filter((r) => r.status === 'failed').length
    const passRate = total ? Math.round((success / total) * 100) : null

    const captions: Record<StatCardFilter, string> = {
      all: total
        ? `${passRate}% pass rate · tap to show all`
        : 'Run a workflow to populate history',
      success: formatRunShare(success, total),
      active: formatRunShare(active, total),
      failed: formatRunShare(failed, total),
    }

    const values: Record<StatCardFilter, number> = {
      all: total,
      success,
      active,
      failed,
    }

    return statCardDefinitions.map((card) => ({
      ...card,
      value: values[card.filter],
      caption: captions[card.filter],
      selected:
        statusFilter === card.filter ||
        (card.filter === 'active' && (statusFilter === 'running' || statusFilter === 'pending')),
    }))
  }, [runs, statusFilter])

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

  return (
    <ProductPage path="/automation/history">
      <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {loading ? (
          <AutomationHistoryStatCardsShimmer />
        ) : (
          stats.map((card) => (
            <StatCard
              key={card.label}
              {...card}
              onSelect={() => {
                setStatusFilter((current) => {
                  if (card.filter === 'active') {
                    const activeSelected =
                      current === 'active' || current === 'running' || current === 'pending'
                    return activeSelected ? 'all' : 'active'
                  }
                  return current === card.filter ? 'all' : card.filter
                })
              }}
            />
          ))
        )}
      </section>
      {loading ? (
        <AutomationHistoryTableShimmer />
      ) : (
        <RunHistoryTable
          runs={runs}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          onDeleteRun={handleDeleteRun}
        />
      )}
    </ProductPage>
  )
}

function StatCard({
  label,
  value,
  caption,
  icon: IconComponent,
  tone,
  selected,
  onSelect,
}: {
  label: string
  value: number
  caption: string
  icon: Icon
  tone: string
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'rounded-md border border-border bg-card px-4 py-2.5 text-left shadow-xs transition-colors',
        'hover:border-nesy-muted hover:bg-nesy-soft/15 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-nesy-soft',
        selected && 'border-nesy-muted bg-nesy-soft/25 ring-2 ring-nesy/25',
      )}
    >
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex size-11 shrink-0 items-center justify-center rounded-md',
            tone,
          )}
        >
          <IconComponent className="size-6" strokeWidth={2.2} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
          <p className="mt-0.5 text-2xl font-semibold leading-none tracking-[-0.03em] text-foreground">
            {value}
          </p>
          <p className="mt-1 text-[11px] leading-tight text-muted-foreground">{caption}</p>
        </div>
      </div>
    </button>
  )
}

function RunHistoryTable({
  runs,
  statusFilter,
  onStatusFilterChange,
  onDeleteRun,
}: {
  runs: WorkflowRun[]
  statusFilter: RunHistoryStatusFilter
  onStatusFilterChange: (filter: RunHistoryStatusFilter) => void
  onDeleteRun: (workflowId: string, runId: string) => void
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<'created-desc' | 'created-asc'>('created-desc')
  const [deleteTarget, setDeleteTarget] = useState<{
    workflowId: string
    runId: string
    label: string
  } | null>(null)

  const filteredRuns = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()
    const filtered = runs.filter((run) => {
      if (!runMatchesStatusFilter(run, statusFilter)) return false
      if (!normalizedQuery) return true

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

    const sorted = [...filtered]
    if (sortBy === 'created-asc') {
      sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    } else {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
    return sorted
  }, [runs, searchQuery, sortBy, statusFilter])

  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(filteredRuns.length / pageSize))
  const paginatedRuns = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filteredRuns.slice(startIndex, startIndex + pageSize)
  }, [filteredRuns, currentPage, pageSize])

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, statusFilter, sortBy, pageSize])

  useEffect(() => {
    setCurrentPage((current) => Math.min(current, totalPages))
  }, [totalPages])

  const confirmDelete = () => {
    if (!deleteTarget) return
    onDeleteRun(deleteTarget.workflowId, deleteTarget.runId)
    setDeleteTarget(null)
  }

  return (
    <section className="overflow-hidden rounded-md border border-border bg-card shadow-xs">
      <div className="grid gap-3 border-b border-border p-3 sm:grid-cols-2 lg:grid-cols-[1fr_220px_220px]">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="h-11 w-full rounded-md border border-border bg-card pl-10 pr-4 text-sm font-medium text-foreground outline-none transition placeholder:text-muted-foreground focus:border-nesy focus:ring-4 focus:ring-nesy-soft"
            placeholder="Search runs or workflows..."
            type="search"
          />
        </label>
        <SelectLike
          ariaLabel="Filter by status"
          value={statusFilter}
          onValueChange={(value) => onStatusFilterChange(value as RunHistoryStatusFilter)}
          options={[
            { value: 'all', label: 'All statuses' },
            { value: 'success', label: 'Success' },
            { value: 'failed', label: 'Failed' },
            { value: 'active', label: 'In progress' },
            { value: 'running', label: 'Running' },
            { value: 'pending', label: 'Pending' },
            { value: 'cancelled', label: 'Cancelled' },
          ]}
        />
        <SelectLike
          ariaLabel="Sort runs"
          value={sortBy}
          onValueChange={(value) => setSortBy(value as 'created-desc' | 'created-asc')}
          options={[
            { value: 'created-desc', label: 'Newest first' },
            { value: 'created-asc', label: 'Oldest first' },
          ]}
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border bg-card text-xs font-bold uppercase tracking-[0.02em] text-muted-foreground">
              <th className="w-[220px] px-5 py-5">Workflow</th>
              <th className="w-[120px] px-3 py-5">Status</th>
              <th className="w-[120px] px-3 py-5">Mode</th>
              <th className="w-[180px] px-3 py-5">Started</th>
              <th className="w-[100px] px-3 py-5">Duration</th>
              <th className="w-[120px] px-5 py-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRuns.map((run) => {
              const workflowSlug = run.workflow?.slug ?? run.workflowId
              const workflowName = run.workflow?.name ?? 'Unknown workflow'

              return (
                <tr
                  key={run.id}
                  className="border-b border-border bg-card text-sm last:border-b-0 hover:bg-muted/50"
                >
                  <td className="px-5 py-4 align-middle">
                    <Link href={`/automation/${workflowSlug}`} className="block">
                      <p className="font-semibold text-foreground">{workflowName}</p>
                      <p className="mt-1 text-xs font-medium text-muted-foreground">
                        v{run.version?.version ?? '—'} · {run.deviceId ?? 'No device'}
                      </p>
                    </Link>
                  </td>
                  <td className="px-3 py-4 align-middle">
                    <Badge className={runStatusClassName(run.status)}>
                      <span className="inline-flex items-center gap-1">
                        {run.status === 'success' ? <CheckCircle2 className="size-3.5" /> : null}
                        {run.status === 'failed' ? <CircleX className="size-3.5" /> : null}
                        {run.status === 'running' || run.status === 'pending' ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : null}
                        {run.status}
                      </span>
                    </Badge>
                  </td>
                  <td className="px-3 py-4 align-middle">
                    <span className="text-sm text-muted-foreground">{run.mode}</span>
                  </td>
                  <td className="px-3 py-4 align-middle">
                    <p className="font-semibold text-foreground">
                      {new Date(run.startedAt ?? run.createdAt).toLocaleString()}
                    </p>
                  </td>
                  <td className="px-3 py-4 align-middle">
                    <span className="text-sm text-muted-foreground">
                      {formatDuration(run.duration)}
                    </span>
                  </td>
                  <td className="px-5 py-4 align-middle text-right">
                    <div className="flex justify-end gap-2">
                      <Link
                        href={`/automation/${workflowSlug}/runs/${run.id}`}
                        className="flex size-9 items-center justify-center rounded-[4px] border border-border bg-card text-foreground transition hover:border-nesy-muted hover:bg-nesy-soft hover:text-nesy-ink"
                      >
                        <Play className="size-4" />
                      </Link>
                      <button
                        type="button"
                        onClick={() =>
                          setDeleteTarget({
                            workflowId: run.workflowId,
                            runId: run.id,
                            label: workflowName,
                          })
                        }
                        className="flex size-9 items-center justify-center rounded-[4px] border border-border bg-card text-red-500 transition hover:border-red-200 hover:bg-red-50 dark:hover:border-red-800 dark:hover:bg-red-950"
                      >
                        <CircleX className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
            {paginatedRuns.length === 0 ? (
              <tr>
                <td className="px-5 py-10 text-center" colSpan={6}>
                  {runs.length === 0 ? (
                    <div className="mx-auto flex max-w-md flex-col items-center gap-3">
                      <p className="text-sm font-medium text-foreground">No runs recorded yet</p>
                      <p className="text-sm text-muted-foreground">
                        Execute a workflow from the library and completed runs will appear here with
                        status, duration, and replay links.
                      </p>
                      <Link
                        href={AUTOMATION_LIST_PATH}
                        className="inline-flex h-9 items-center rounded-md border border-nesy-muted bg-nesy-soft px-4 text-sm font-semibold text-nesy-ink transition hover:bg-nesy-soft/80"
                      >
                        Open Workflow Library
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">No runs match this view</p>
                      <p className="text-sm text-muted-foreground">
                        Try clearing search or choose &quot;All statuses&quot; from the filter.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('')
                          onStatusFilterChange('all')
                        }}
                        className="text-sm font-semibold text-nesy-ink underline-offset-2 hover:underline"
                      >
                        Reset filters
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {filteredRuns.length > 0 ? (
        <Pagination
          totalItems={filteredRuns.length}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      ) : null}
      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <AlertDialogContent className="rounded-[4px] border border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete run?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the run record from history. The workflow &quot;{deleteTarget?.label}
              &quot; will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-[4px]">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="rounded-[4px] bg-nesy text-white hover:bg-nesy-hover"
            >
              Delete run
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

function SelectLike({
  value,
  onValueChange,
  options,
  ariaLabel,
}: {
  value: string
  onValueChange: (value: string) => void
  options: Array<{ value: string; label: string }>
  ariaLabel: string
}) {
  return (
    <div className="relative">
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        className="h-11 w-full appearance-none rounded-[4px] border border-border bg-card px-3.5 pr-9 text-left text-sm font-semibold text-foreground transition hover:bg-muted focus:border-nesy focus:outline-none focus:ring-4 focus:ring-nesy-soft"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  )
}

function Badge({ children, className }: { children: ReactNode; className: string }) {
  return (
    <span
      className={`inline-flex h-7 items-center rounded-[4px] px-3 text-xs font-semibold ring-1 ring-inset ${className}`}
    >
      {children}
    </span>
  )
}

function Pagination({
  totalItems,
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  totalItems: number
  currentPage: number
  totalPages: number
  pageSize: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}) {
  const startPage = Math.max(1, Math.min(currentPage - 1, totalPages - 2))
  const visiblePages = Array.from(
    { length: Math.min(3, totalPages) },
    (_, index) => startPage + index,
  ).filter((page) => page <= totalPages)

  return (
    <div className="flex flex-col gap-4 border-t border-border px-4 py-4 text-sm font-semibold text-muted-foreground lg:flex-row lg:items-center lg:justify-between">
      <p>{totalItems} runs total</p>
      <div className="flex items-center justify-center gap-2">
        <PageButton
          icon={ChevronLeft}
          label="Previous"
          disabled={currentPage <= 1}
          onClick={() => onPageChange(currentPage - 1)}
        />
        {visiblePages.map((page) => (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            className={`flex size-10 items-center justify-center rounded-[4px] border transition ${
              page === currentPage
                ? 'border-nesy bg-nesy-soft text-nesy-ink'
                : 'border-border bg-card text-foreground hover:bg-muted'
            }`}
          >
            {page}
          </button>
        ))}
        <PageButton
          icon={ChevronRight}
          label="Next"
          disabled={currentPage >= totalPages}
          onClick={() => onPageChange(currentPage + 1)}
        />
      </div>
      <div className="relative lg:w-36">
        <select
          aria-label="Rows per page"
          value={String(pageSize)}
          onChange={(event) => onPageSizeChange(Number(event.target.value))}
          className="h-10 w-full appearance-none rounded-[4px] border border-border bg-card px-4 pr-9 text-foreground transition hover:bg-muted focus:border-nesy focus:outline-none"
        >
          <option value="5">5 / page</option>
          <option value="10">10 / page</option>
          <option value="20">20 / page</option>
        </select>
        <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      </div>
    </div>
  )
}

function PageButton({
  icon: IconComponent,
  label,
  className = '',
  onClick,
  disabled = false,
}: {
  icon: Icon
  label: string
  className?: string
  onClick?: () => void
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex size-10 items-center justify-center rounded-[4px] border border-border bg-card text-foreground transition hover:bg-muted disabled:pointer-events-none disabled:opacity-40 ${className}`}
    >
      <IconComponent className="size-4" />
    </button>
  )
}
