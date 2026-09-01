'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  CircleX,
  Clock3,
  Loader2,
  MinusCircle,
  ShieldAlert,
  Smartphone,
  Trash2,
  Workflow,
} from 'lucide-react'
import { Button } from '@nesy/metronic/components/ui/button'
import { Checkbox } from '@nesy/metronic/components/ui/checkbox'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@nesy/metronic/components/ui/alert-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@nesy/metronic/components/ui/tooltip'
import { TablePaginationFooter } from '@/components/automation/TablePaginationFooter'
import { cn } from '@nesy/metronic/lib/utils'
import { AUTOMATION_RUN_PLANNER_PATH } from '@nesy/metronic/config/layout-21.config'
import { type Tone, toneIcon, toneIconBox, toneText } from '@/components/product/tones'
import {
  isBlockedQueueRow,
  isQueuedQueueStatus,
  isRunningQueueStatus,
  normalizeQueueStatus,
  queueDeviceChipLabel,
  queueRowDurationMs,
  truncateRunId,
  type ExecutionQueueRow,
} from '@/lib/automation/execution-queue-filters'

const cellGrid = 'border-b border-r border-border last:border-r-0'
const thClass = cn('px-2.5 py-2', cellGrid)
const tdClass = cn('px-2.5 py-2 align-middle', cellGrid)

const STATUS_META: Record<
  string,
  { label: string; tone: Tone; icon: typeof CheckCircle2; spin?: boolean }
> = {
  success: { label: 'Success', tone: 'green', icon: CheckCircle2 },
  failed: { label: 'Failed', tone: 'red', icon: CircleX },
  blocked: { label: 'Blocked', tone: 'amber', icon: ShieldAlert },
  running: { label: 'Running', tone: 'blue', icon: Loader2, spin: true },
  queued: { label: 'Queued', tone: 'amber', icon: Clock3 },
  pending: { label: 'Pending', tone: 'amber', icon: Clock3 },
  cancelled: { label: 'Cancelled', tone: 'gray', icon: MinusCircle },
}

function formatTimestamp(value: string | null): { date: string; time: string } {
  if (!value) return { date: '—', time: '' }
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return { date: '—', time: '' }
  return {
    date: parsed.toLocaleDateString(undefined, {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }),
    time: parsed.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }),
  }
}

function formatDuration(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '—'
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

function QueueStatusBadge({ status, blockedReason }: { status: string; blockedReason: string | null }) {
  const normalized = normalizeQueueStatus(status)
  const meta =
    STATUS_META[normalized] ??
    (normalized.includes('queued')
      ? STATUS_META.queued
      : normalized.includes('running')
        ? STATUS_META.running
        : {
            label: status.charAt(0).toUpperCase() + status.slice(1),
            tone: 'gray' as Tone,
            icon: MinusCircle,
          })
  const Icon = meta.icon

  return (
    <span
      title={blockedReason ?? undefined}
      className={cn(
        'inline-flex h-6 max-w-[11rem] items-center gap-1 rounded-[4px] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        toneIconBox[meta.tone],
        toneText[meta.tone],
      )}
    >
      <Icon className={cn('size-3 shrink-0', toneIcon[meta.tone], meta.spin && 'animate-spin')} />
      <span className="truncate">{meta.label}</span>
    </span>
  )
}

function ReadModelBadge({ partial }: { partial: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-[4px] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide',
        partial
          ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/60'
          : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/60',
      )}
    >
      {partial ? (
        <>
          <AlertTriangle className="size-3 shrink-0" />
          Partial
        </>
      ) : (
        <>
          <CheckCircle2 className="size-3 shrink-0" />
          Complete
        </>
      )}
    </span>
  )
}

function EngineBadge({ engineType }: { engineType: string }) {
  return (
    <span className="inline-flex rounded-[4px] border border-border/70 bg-muted/30 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      {engineType}
    </span>
  )
}

function summarizeWorkflowExecutions(
  rows: ExecutionQueueRow[],
): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>()
  for (const row of rows) {
    const name = row.workflowName ?? 'Unknown workflow'
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
}

function ExecutionQueueDeleteDialog({
  open,
  onOpenChange,
  count,
  workflowName,
  workflowSummary = [],
  confirming,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  count: number
  workflowName?: string
  workflowSummary?: Array<{ name: string; count: number }>
  confirming: boolean
  onConfirm: () => void | Promise<void>
}) {
  const isBulk = count > 1
  const preview = workflowSummary.slice(0, 4)
  const hiddenCount = Math.max(0, workflowSummary.length - preview.length)
  const actionLabel = confirming
    ? 'Removing…'
    : isBulk
      ? `Remove ${count} executions`
      : 'Remove execution'

  return (
    <AlertDialog open={open} onOpenChange={(next) => !confirming && onOpenChange(next)}>
      <AlertDialogContent className="max-w-md gap-0 overflow-hidden rounded-[8px] border border-border p-0 shadow-lg">
        <AlertDialogHeader className="space-y-3 border-b border-border px-5 py-4 text-left">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-[8px] bg-red-50 text-red-600 ring-1 ring-red-100 dark:bg-red-950/40 dark:text-red-400 dark:ring-red-900/40">
              <Trash2 className="size-4" strokeWidth={2.2} />
            </span>
            <div className="min-w-0 space-y-1">
              <AlertDialogTitle className="text-base font-semibold leading-snug text-foreground">
                Remove from queue?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-sm leading-relaxed text-muted-foreground">
                {isBulk ? (
                  <>
                    You selected{' '}
                    <span className="font-semibold text-foreground">
                      {count} execution{count === 1 ? '' : 's'}
                    </span>{' '}
                    to remove from the BridgeFlow pipeline.
                  </>
                ) : (
                  <>
                    Remove the execution record for{' '}
                    <span className="font-semibold text-foreground">
                      {workflowName ?? 'this workflow'}
                    </span>
                    .
                  </>
                )}
              </AlertDialogDescription>
            </div>
          </div>
        </AlertDialogHeader>

        <div className="space-y-3 px-5 py-4">
          <div className="rounded-[8px] border border-border/70 bg-muted/20 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
            <p className="font-medium text-foreground">Workflows stay intact</p>
            <p className="mt-1">
              Only queue records are removed. Workflow definitions and future runs are not
              affected.
            </p>
          </div>

          {isBulk && preview.length > 0 ? (
            <div className="rounded-[8px] border border-border/70 bg-background px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Affected workflows
              </p>
              <ul className="mt-2 space-y-1.5">
                {preview.map((item) => (
                  <li
                    key={item.name}
                    className="flex items-center justify-between gap-3 text-xs text-foreground"
                  >
                    <span className="min-w-0 truncate">{item.name}</span>
                    <span className="shrink-0 rounded-[4px] border border-border/70 bg-muted/30 px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-muted-foreground">
                      ×{item.count}
                    </span>
                  </li>
                ))}
              </ul>
              {hiddenCount > 0 ? (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  +{hiddenCount} more workflow{hiddenCount === 1 ? '' : 's'}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <AlertDialogFooter className="gap-2 border-t border-border bg-muted/10 px-5 py-4 sm:space-x-0">
          <AlertDialogCancel
            disabled={confirming}
            className="h-9 rounded-[8px] border-border bg-background px-4"
          >
            Keep executions
          </AlertDialogCancel>
          <Button
            type="button"
            variant="outline"
            disabled={confirming}
            onClick={() => void onConfirm()}
            className="h-9 gap-1.5 rounded-[8px] border-red-200 bg-background px-4 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            {confirming ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : null}
            {actionLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

export function ExecutionQueueTable({
  rows,
  allRowsCount,
  sortBy,
  onClearFilters,
  onDeleteRun,
  onBulkDeleteRuns,
}: {
  rows: ExecutionQueueRow[]
  allRowsCount: number
  sortBy: 'updated-desc' | 'updated-asc'
  onClearFilters: () => void
  onDeleteRun: (workflowId: string, runId: string) => void
  onBulkDeleteRuns: (targets: Array<{ workflowId: string; runId: string }>) => Promise<void>
}) {
  const [selectedRunIds, setSelectedRunIds] = useState<Set<string>>(() => new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{
    workflowId: string
    runId: string
    label: string
  } | null>(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  const sortedRows = useMemo(() => {
    const sorted = [...rows]
    sorted.sort((left, right) => {
      const leftTime = new Date(left.startedAt ?? left.createdAt ?? 0).getTime()
      const rightTime = new Date(right.startedAt ?? right.createdAt ?? 0).getTime()
      return sortBy === 'updated-asc' ? leftTime - rightTime : rightTime - leftTime
    })
    return sorted
  }, [rows, sortBy])

  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize))
  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return sortedRows.slice(startIndex, startIndex + pageSize)
  }, [sortedRows, currentPage, pageSize])

  const rangeStart = sortedRows.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const rangeEnd = Math.min(currentPage * pageSize, sortedRows.length)

  useEffect(() => {
    setCurrentPage(1)
  }, [sortBy, pageSize, rows.length])

  useEffect(() => {
    setCurrentPage((current) => Math.min(current, totalPages))
  }, [totalPages])

  const visibleRunIds = useMemo(() => new Set(rows.map((row) => row.runId)), [rows])

  useEffect(() => {
    setSelectedRunIds((current) => {
      const next = new Set([...current].filter((id) => visibleRunIds.has(id)))
      return next.size === current.size ? current : next
    })
  }, [visibleRunIds])

  const selectedCount = selectedRunIds.size
  const paginatedRunIds = useMemo(() => paginatedRows.map((row) => row.runId), [paginatedRows])
  const allPageSelected =
    paginatedRunIds.length > 0 && paginatedRunIds.every((id) => selectedRunIds.has(id))
  const somePageSelected =
    paginatedRunIds.some((id) => selectedRunIds.has(id)) && !allPageSelected

  const toggleRunSelection = (runId: string, checked: boolean) => {
    setSelectedRunIds((current) => {
      const next = new Set(current)
      if (checked) next.add(runId)
      else next.delete(runId)
      return next
    })
  }

  const togglePageSelection = (checked: boolean) => {
    setSelectedRunIds((current) => {
      const next = new Set(current)
      paginatedRows.forEach((row) => {
        if (checked) next.add(row.runId)
        else next.delete(row.runId)
      })
      return next
    })
  }

  const selectedRows = useMemo(
    () => rows.filter((row) => selectedRunIds.has(row.runId)),
    [rows, selectedRunIds],
  )

  const selectedDeleteTargets = useMemo(
    () =>
      selectedRows
        .filter((row) => row.workflowId)
        .map((row) => ({ workflowId: row.workflowId, runId: row.runId })),
    [selectedRows],
  )

  const bulkWorkflowSummary = useMemo(
    () => summarizeWorkflowExecutions(selectedRows),
    [selectedRows],
  )

  const confirmDelete = () => {
    if (!deleteTarget) return
    onDeleteRun(deleteTarget.workflowId, deleteTarget.runId)
    setSelectedRunIds((current) => {
      if (!current.has(deleteTarget.runId)) return current
      const next = new Set(current)
      next.delete(deleteTarget.runId)
      return next
    })
    setDeleteTarget(null)
  }

  const confirmBulkDelete = async () => {
    if (selectedDeleteTargets.length === 0) return
    setBulkDeleting(true)
    try {
      await onBulkDeleteRuns(selectedDeleteTargets)
      setSelectedRunIds(new Set())
      setBulkDeleteOpen(false)
    } finally {
      setBulkDeleting(false)
    }
  }

  const liveCount = rows.filter(
    (row) => isQueuedQueueStatus(row.status) || isRunningQueueStatus(row.status),
  ).length
  const blockedCount = rows.filter(isBlockedQueueRow).length
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    if (liveCount === 0) return
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [liveCount])

  return (
    <article className="overflow-hidden rounded-[8px] border border-border bg-card">
      <div className="border-b border-border bg-muted/10 px-3 py-2.5 sm:px-4">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">BridgeFlow pipeline</p>
          <p className="text-xs text-muted-foreground">
            {sortedRows.length === 0
              ? 'No executions in this view'
              : sortedRows.length === allRowsCount
                ? `${allRowsCount} execution${allRowsCount === 1 ? '' : 's'} tracked`
                : `${sortedRows.length} of ${allRowsCount} match filters`}
            {liveCount > 0 ? ` · ${liveCount} active` : ''}
            {blockedCount > 0 ? ` · ${blockedCount} blocked` : ''}
            {sortedRows.length > 0 && totalPages > 1
              ? ` · Page ${currentPage} of ${totalPages}`
              : null}
          </p>
        </div>
      </div>

      {selectedCount > 0 ? (
        <div className="flex flex-col gap-2 border-b border-nesy/20 bg-nesy-soft/35 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-[8px] border border-nesy/20 bg-background/80 px-2.5 py-1">
              <span className="rounded-[4px] bg-nesy px-1.5 py-px text-[10px] font-bold tabular-nums text-white">
                {selectedCount}
              </span>
              <span className="text-xs font-semibold text-foreground">
                execution{selectedCount === 1 ? '' : 's'} selected
              </span>
            </span>
            {paginatedRunIds.length > 0 && !allPageSelected ? (
              <button
                type="button"
                disabled={bulkDeleting}
                onClick={() => togglePageSelection(true)}
                className="text-xs font-semibold text-nesy-ink underline-offset-2 transition hover:underline disabled:pointer-events-none disabled:opacity-50"
              >
                Select page ({paginatedRunIds.length})
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={bulkDeleting}
              onClick={() => setSelectedRunIds(new Set())}
              className="h-8 rounded-[8px]"
            >
              Clear selection
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={bulkDeleting}
              onClick={() => setBulkDeleteOpen(true)}
              className="h-8 gap-1.5 rounded-[8px] border-red-200 bg-background text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-950/30"
            >
              <Trash2 className="size-3.5" />
              {bulkDeleting ? 'Deleting…' : 'Delete selected'}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="overflow-x-auto border-t border-border">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted/40 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className={cn('w-10', thClass)}>
                <Checkbox
                  aria-label="Select all executions on this page"
                  checked={allPageSelected ? true : somePageSelected ? 'indeterminate' : false}
                  onCheckedChange={(checked) => togglePageSelection(checked === true)}
                  disabled={paginatedRows.length === 0 || bulkDeleting}
                />
              </th>
              <th className={cn('hidden w-28 lg:table-cell', thClass)}>Run ID</th>
              <th className={cn('min-w-[200px]', thClass)}>Workflow</th>
              <th className={cn('w-28', thClass)}>Status</th>
              <th className={cn('hidden w-24 md:table-cell', thClass)}>Engine</th>
              <th className={cn('hidden w-24 sm:table-cell', thClass)}>Read model</th>
              <th className={cn('hidden w-40 xl:table-cell', thClass)}>Device</th>
              <th className={cn('w-36', thClass)}>Updated</th>
              <th className={cn('w-20', thClass)}>Duration</th>
              <th className={cn('w-16 text-right', thClass)}>Open</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRows.map((row, index) => (
              <ExecutionQueueRowView
                key={row.runId}
                row={row}
                index={index}
                nowMs={nowMs}
                selected={selectedRunIds.has(row.runId)}
                bulkDeleting={bulkDeleting}
                onToggleSelect={(checked) => toggleRunSelection(row.runId, checked)}
                onDelete={() =>
                  setDeleteTarget({
                    workflowId: row.workflowId,
                    runId: row.runId,
                    label: row.workflowName,
                  })
                }
              />
            ))}
            {paginatedRows.length === 0 ? (
              <tr>
                <td className="border-b border-border px-5 py-12 text-center" colSpan={10}>
                  {allRowsCount === 0 ? (
                    <div className="mx-auto flex max-w-md flex-col items-center gap-3">
                      <p className="text-sm font-medium text-foreground">No BridgeFlow executions yet</p>
                      <p className="text-sm text-muted-foreground">
                        Pin a workflow, pack, and profile in Run Planner — queued runs will appear here
                        with lifecycle-accurate status.
                      </p>
                      <Link
                        href={AUTOMATION_RUN_PLANNER_PATH}
                        className="inline-flex h-9 items-center rounded-lg border border-nesy-muted bg-nesy-soft px-4 text-sm font-semibold text-nesy-ink transition hover:bg-nesy-soft/80"
                      >
                        Open Run Planner
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">No executions match this view</p>
                      <p className="text-sm text-muted-foreground">
                        Try another pipeline stage or clear your search query.
                      </p>
                      <button
                        type="button"
                        onClick={onClearFilters}
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

      {sortedRows.length > 0 ? (
        <TablePaginationFooter
          totalItems={sortedRows.length}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          pageSizeOptions={[5, 10, 20, 50]}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemLabel="execution"
          ariaLabel="Execution queue pages"
          idPrefix="execution-queue"
        />
      ) : null}

      <ExecutionQueueDeleteDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        count={1}
        workflowName={deleteTarget?.label}
        confirming={false}
        onConfirm={confirmDelete}
      />

      <ExecutionQueueDeleteDialog
        open={bulkDeleteOpen}
        onOpenChange={setBulkDeleteOpen}
        count={selectedCount}
        workflowSummary={bulkWorkflowSummary}
        confirming={bulkDeleting}
        onConfirm={confirmBulkDelete}
      />
    </article>
  )
}

function ExecutionQueueRowView({
  row,
  index,
  nowMs,
  selected,
  bulkDeleting,
  onToggleSelect,
  onDelete,
}: {
  row: ExecutionQueueRow
  index: number
  nowMs: number
  selected: boolean
  bulkDeleting: boolean
  onToggleSelect: (checked: boolean) => void
  onDelete: () => void
}) {
  const runHref = `/automation/${row.workflowSlug}/runs/${row.runId}`
  const updatedAt = formatTimestamp(row.startedAt ?? row.createdAt)
  const duration = formatDuration(queueRowDurationMs(row, nowMs))
  const active = isQueuedQueueStatus(row.status) || isRunningQueueStatus(row.status)
  const blocked = isBlockedQueueRow(row)

  return (
    <tr
      className={cn(
        'group transition-colors',
        selected
          ? 'bg-nesy-soft/15 hover:bg-nesy-soft/20'
          : blocked
            ? 'bg-amber-50/35 hover:bg-amber-50/50 dark:bg-amber-950/15 dark:hover:bg-amber-950/25'
            : active
              ? 'bg-sky-50/40 hover:bg-sky-50/55 dark:bg-sky-950/20 dark:hover:bg-sky-950/30'
              : index % 2 === 1
                ? 'bg-muted/50 hover:bg-muted/65'
                : 'bg-card hover:bg-muted/35',
      )}
    >
      <td className={tdClass}>
        <Checkbox
          aria-label={`Select run ${row.runId}`}
          checked={selected}
          onCheckedChange={(checked) => onToggleSelect(checked === true)}
          disabled={bulkDeleting}
        />
      </td>
      <td className={cn('hidden lg:table-cell', tdClass)}>
        <code
          className="inline-flex max-w-full truncate rounded-[4px] border border-border/70 bg-muted/30 px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground"
          title={row.runId}
        >
          {truncateRunId(row.runId, 12)}
        </code>
      </td>
      <td className={tdClass}>
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-[8px] bg-nesy-soft/70 ring-1 ring-nesy/10">
            <Workflow className="size-3.5 text-nesy-ink" strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <Link
              href={`/automation/${row.workflowSlug}`}
              className="block truncate text-xs font-semibold leading-tight text-foreground outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
            >
              {row.workflowName}
            </Link>
            <p className="mt-0.5 truncate font-mono text-[10px] leading-none text-muted-foreground lg:hidden" title={row.runId}>
              {truncateRunId(row.runId, 8)}
            </p>
          </div>
        </div>
      </td>
      <td className={tdClass}>
        <QueueStatusBadge status={row.status} blockedReason={row.blockedReason} />
      </td>
      <td className={cn('hidden md:table-cell', tdClass)}>
        <EngineBadge engineType={row.engineType} />
      </td>
      <td className={cn('hidden sm:table-cell', tdClass)}>
        <ReadModelBadge partial={row.partial} />
      </td>
      <td className={cn('hidden xl:table-cell', tdClass)}>
        <span
          className="inline-flex h-6 max-w-[11rem] items-center gap-1 truncate rounded-[4px] border border-border/70 bg-muted/30 px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
          title={row.deviceId ?? undefined}
        >
          <Smartphone className="size-2.5 shrink-0" aria-hidden />
          {queueDeviceChipLabel(row)}
        </span>
      </td>
      <td className={tdClass}>
        <div className="flex flex-col gap-0.5 tabular-nums leading-tight">
          <span className="text-xs text-foreground">{updatedAt.date}</span>
          {updatedAt.time ? (
            <span className="text-[10px] text-muted-foreground">{updatedAt.time}</span>
          ) : null}
        </div>
      </td>
      <td className={tdClass}>
        <span
          className={cn(
            'text-xs tabular-nums leading-none',
            duration === '—' ? 'text-muted-foreground/60' : 'font-medium text-foreground',
          )}
        >
          {duration}
        </span>
      </td>
      <td className={tdClass}>
        <div className="flex items-center justify-end gap-0.5">
          <Link
            href={runHref}
            className="inline-flex w-12 items-center justify-end gap-0.5 rounded-[8px] py-0.5 text-[11px] font-semibold text-nesy-ink transition hover:bg-nesy-soft/40"
          >
            Open
            <ChevronRight className="size-3 shrink-0" />
          </Link>
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-7 rounded-[8px] text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                  onClick={onDelete}
                  disabled={bulkDeleting || !row.workflowId}
                  aria-label={`Delete run for ${row.workflowName}`}
                >
                  <Trash2 className="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Remove from queue
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </td>
    </tr>
  )
}
