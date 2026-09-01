'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import {
  CheckCircle2,
  ChevronRight,
  CircleX,
  Clock3,
  Loader2,
  MinusCircle,
  Smartphone,
  Trash2,
  Workflow,
} from 'lucide-react'
import { Button } from '@nesy/metronic/components/ui/button'
import { Checkbox } from '@nesy/metronic/components/ui/checkbox'
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@nesy/metronic/components/ui/tooltip'
import { TablePaginationFooter } from '@/components/automation/TablePaginationFooter'
import { cn } from '@nesy/metronic/lib/utils'
import { AUTOMATION_LIST_PATH } from '@nesy/metronic/config/layout-21.config'
import { type Tone, toneIcon, toneIconBox, toneText } from '@/components/product/tones'
import { formatRunEnvironmentLabel } from '@/lib/verdict-runtime/adapters'
import type { WorkflowRun } from '@/services/automation-api'

const cellGrid = 'border-b border-r border-border last:border-r-0'
const thClass = cn('px-2.5 py-1.5', cellGrid)
const tdClass = cn('px-2.5 py-1.5 align-middle', cellGrid)

const STATUS_META: Record<
  string,
  { label: string; tone: Tone; icon: typeof CheckCircle2; spin?: boolean }
> = {
  success: { label: 'Success', tone: 'teal', icon: CheckCircle2 },
  failed: { label: 'Failed', tone: 'red', icon: CircleX },
  running: { label: 'Running', tone: 'nesy', icon: Loader2, spin: true },
  pending: { label: 'Pending', tone: 'orange', icon: Clock3 },
  cancelled: { label: 'Cancelled', tone: 'gray', icon: MinusCircle },
}

function deviceChipLabel(run: WorkflowRun): string {
  const named = run.device?.label?.trim() || run.device?.modelName?.trim()
  if (named) return named
  if (run.deviceId) return run.deviceId
  return 'No device'
}

function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '—'
  if (ms < 1000) return `${ms}ms`
  const seconds = Math.floor(ms / 1000)
  const minutes = Math.floor(seconds / 60)
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}

function formatStartedAt(value: string): { date: string; time: string } {
  const parsed = new Date(value)
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

function isActiveRun(status: string): boolean {
  return status === 'running' || status === 'pending'
}

function RunStatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? {
    label: status.charAt(0).toUpperCase() + status.slice(1),
    tone: 'gray' as Tone,
    icon: MinusCircle,
  }
  const Icon = meta.icon

  return (
    <span
      className={cn(
        'inline-flex h-6 items-center gap-1 rounded-md px-1.5 text-[10px] font-semibold uppercase tracking-wide',
        toneIconBox[meta.tone],
        toneText[meta.tone],
      )}
    >
      <Icon className={cn('size-3.5 shrink-0', toneIcon[meta.tone], meta.spin && 'animate-spin')} />
      {meta.label}
    </span>
  )
}

function ModeBadge({ mode }: { mode: string }) {
  return (
    <span className="inline-flex rounded-md border border-border bg-background px-1.5 py-px text-[10px] font-semibold capitalize text-muted-foreground">
      {mode}
    </span>
  )
}

function MetaChip({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <span
      title={title}
      className="inline-flex max-w-[10rem] truncate rounded border border-border bg-muted/40 px-1.5 py-[3px] font-mono text-[10px] font-medium text-muted-foreground"
    >
      {children}
    </span>
  )
}

export function RunHistoryTable({
  runs,
  allRunsCount,
  sortBy,
  onClearFilters,
  onDeleteRun,
  onBulkDeleteRuns,
}: {
  runs: WorkflowRun[]
  allRunsCount: number
  sortBy: 'created-desc' | 'created-asc'
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

  const sortedRuns = useMemo(() => {
    const sorted = [...runs]
    if (sortBy === 'created-asc') {
      sorted.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    } else {
      sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }
    return sorted
  }, [runs, sortBy])

  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(sortedRuns.length / pageSize))
  const paginatedRuns = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return sortedRuns.slice(startIndex, startIndex + pageSize)
  }, [sortedRuns, currentPage, pageSize])

  const rangeStart = sortedRuns.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const rangeEnd = Math.min(currentPage * pageSize, sortedRuns.length)

  useEffect(() => {
    setCurrentPage(1)
  }, [sortBy, pageSize, runs.length])

  useEffect(() => {
    setCurrentPage((current) => Math.min(current, totalPages))
  }, [totalPages])

  const visibleRunIds = useMemo(() => new Set(runs.map((run) => run.id)), [runs])

  useEffect(() => {
    setSelectedRunIds((current) => {
      const next = new Set([...current].filter((id) => visibleRunIds.has(id)))
      return next.size === current.size ? current : next
    })
  }, [visibleRunIds])

  const selectedCount = selectedRunIds.size
  const paginatedRunIds = useMemo(() => paginatedRuns.map((run) => run.id), [paginatedRuns])
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
      paginatedRuns.forEach((run) => {
        if (checked) next.add(run.id)
        else next.delete(run.id)
      })
      return next
    })
  }

  const selectedDeleteTargets = useMemo(
    () =>
      runs
        .filter((run) => selectedRunIds.has(run.id))
        .map((run) => ({ workflowId: run.workflowId, runId: run.id })),
    [runs, selectedRunIds],
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

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-card shadow-xs ring-1 ring-border/40">
      <div className="flex flex-col gap-2 border-b border-border bg-muted/15 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">Execution log</p>
          <p className="text-xs text-muted-foreground">
            {sortedRuns.length === 0
              ? 'No runs in this view'
              : sortedRuns.length === allRunsCount
                ? `${allRunsCount} run${allRunsCount === 1 ? '' : 's'} recorded`
                : `${sortedRuns.length} of ${allRunsCount} runs match filters`}
            {sortedRuns.length > 0 && totalPages > 1
              ? ` · Page ${currentPage} of ${totalPages}`
              : null}
          </p>
        </div>
        {selectedCount > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-foreground">
              {selectedCount} selected
            </span>
            <Button
              variant="destructive"
              size="sm"
              disabled={bulkDeleting}
              onClick={() => setBulkDeleteOpen(true)}
              className="h-8 gap-1.5"
            >
              <Trash2 className="size-3.5" />
              {bulkDeleting ? 'Deleting…' : 'Delete selected'}
            </Button>
            <button
              type="button"
              disabled={bulkDeleting}
              onClick={() => setSelectedRunIds(new Set())}
              className="text-xs font-semibold text-muted-foreground underline-offset-2 transition hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-50"
            >
              Clear
            </button>
          </div>
        ) : null}
      </div>

      <div className="overflow-x-auto border-t border-border">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted/40 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <th className={cn('w-10', thClass)}>
                <Checkbox
                  aria-label="Select all runs on this page"
                  checked={allPageSelected ? true : somePageSelected ? 'indeterminate' : false}
                  onCheckedChange={(checked) => togglePageSelection(checked === true)}
                  disabled={paginatedRuns.length === 0 || bulkDeleting}
                />
              </th>
              <th className={cn('min-w-[220px]', thClass)}>Workflow</th>
              <th className={cn('w-28', thClass)}>Status</th>
              <th className={cn('hidden w-20 sm:table-cell', thClass)}>Mode</th>
              <th className={cn('w-32', thClass)}>Started</th>
              <th className={cn('hidden w-20 md:table-cell', thClass)}>Duration</th>
              <th className={cn('w-16 text-right', thClass)}>Open</th>
            </tr>
          </thead>
          <tbody>
            {paginatedRuns.map((run, index) => (
              <RunHistoryRow
                key={run.id}
                run={run}
                index={index}
                selected={selectedRunIds.has(run.id)}
                bulkDeleting={bulkDeleting}
                onToggleSelect={(checked) => toggleRunSelection(run.id, checked)}
                onDelete={() =>
                  setDeleteTarget({
                    workflowId: run.workflowId,
                    runId: run.id,
                    label: run.workflow?.name ?? 'Unknown workflow',
                  })
                }
              />
            ))}
            {paginatedRuns.length === 0 ? (
              <tr>
                <td className="border-b border-border px-5 py-10 text-center" colSpan={7}>
                  {allRunsCount === 0 ? (
                    <div className="mx-auto flex max-w-md flex-col items-center gap-3">
                      <p className="text-sm font-medium text-foreground">No runs recorded yet</p>
                      <p className="text-sm text-muted-foreground">
                        Execute a workflow from the library and completed runs will appear here with
                        status, duration, and replay links.
                      </p>
                      <Link
                        href={AUTOMATION_LIST_PATH}
                        className="inline-flex h-9 items-center rounded-lg border border-nesy-muted bg-nesy-soft px-4 text-sm font-semibold text-nesy-ink transition hover:bg-nesy-soft/80"
                      >
                        Open Workflow Library
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-foreground">No runs match this view</p>
                      <p className="text-sm text-muted-foreground">
                        Try clearing search or choose another status filter.
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

      {sortedRuns.length > 0 ? (
        <TablePaginationFooter
          totalItems={sortedRuns.length}
          rangeStart={rangeStart}
          rangeEnd={rangeEnd}
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          pageSizeOptions={[5, 10, 20, 50]}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
          itemLabel="run"
          ariaLabel="Run history pages"
          idPrefix="run-history"
        />
      ) : null}

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="rounded-lg border border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Delete run?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the run record from history. The workflow &quot;{deleteTarget?.label}
              &quot; will not be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete run
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => !bulkDeleting && setBulkDeleteOpen(open)}
      >
        <AlertDialogContent className="rounded-lg border border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">
              Delete {selectedCount} run{selectedCount === 1 ? '' : 's'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the selected run records from history. The workflows themselves will not
              be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-lg" disabled={bulkDeleting}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault()
                void confirmBulkDelete()
              }}
              disabled={bulkDeleting}
              className="rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleting ? 'Deleting…' : `Delete ${selectedCount} run${selectedCount === 1 ? '' : 's'}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </article>
  )
}

function RunHistoryRow({
  run,
  index,
  selected,
  bulkDeleting,
  onToggleSelect,
  onDelete,
}: {
  run: WorkflowRun
  index: number
  selected: boolean
  bulkDeleting: boolean
  onToggleSelect: (checked: boolean) => void
  onDelete: () => void
}) {
  const workflowSlug = run.workflow?.slug ?? run.workflowId
  const workflowName = run.workflow?.name ?? 'Unknown workflow'
  const startedAt = formatStartedAt(run.startedAt ?? run.createdAt)
  const runHref = `/automation/${workflowSlug}/runs/${run.id}`
  const active = isActiveRun(run.status)
  const duration = formatDuration(run.duration)
  const environmentLabel = formatRunEnvironmentLabel(run)

  return (
    <tr
      className={cn(
        'group transition-colors',
        selected
          ? 'bg-nesy-soft/15 hover:bg-nesy-soft/20'
          : active
            ? 'bg-sky-50/40 hover:bg-sky-50/55 dark:bg-sky-950/20 dark:hover:bg-sky-950/30'
            : index % 2 === 1
              ? 'bg-muted/50 hover:bg-muted/65'
              : 'bg-card hover:bg-muted/35',
      )}
    >
      <td className={tdClass}>
        <Checkbox
          aria-label={`Select run ${run.id}`}
          checked={selected}
          onCheckedChange={(checked) => onToggleSelect(checked === true)}
          disabled={bulkDeleting}
        />
      </td>
      <td className={tdClass}>
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-nesy-soft/70 ring-1 ring-nesy/10">
            <Workflow className="size-3.5 text-nesy-ink" strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <Link
              href={`/automation/${workflowSlug}`}
              className="block truncate text-xs font-semibold leading-tight text-foreground outline-none transition-colors group-hover:text-nesy-ink focus-visible:ring-2 focus-visible:ring-nesy-soft rounded-sm"
            >
              {workflowName}
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <MetaChip>v{run.version?.version ?? '—'}</MetaChip>
              {environmentLabel ? <MetaChip>{environmentLabel}</MetaChip> : null}
              <MetaChip title={run.deviceId ?? undefined}>
                <span className="inline-flex items-center gap-0.5">
                  <Smartphone className="size-2.5 shrink-0" aria-hidden />
                  {deviceChipLabel(run)}
                </span>
              </MetaChip>
            </div>
          </div>
        </div>
      </td>
      <td className={tdClass}>
        <RunStatusBadge status={run.status} />
      </td>
      <td className={cn('hidden sm:table-cell', tdClass)}>
        <ModeBadge mode={run.mode} />
      </td>
      <td className={tdClass}>
        <p className="text-xs font-medium tabular-nums leading-tight text-foreground">{startedAt.date}</p>
        <p className="mt-0.5 text-[10px] tabular-nums leading-none text-muted-foreground">{startedAt.time}</p>
      </td>
      <td className={cn('hidden md:table-cell', tdClass)}>
        <span
          className={cn(
            'text-xs tabular-nums',
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
            className="inline-flex w-12 items-center justify-end gap-0.5 rounded-md py-0.5 text-[11px] font-semibold text-nesy-ink transition hover:bg-nesy-soft/40"
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
                  className="size-6 rounded-md text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400"
                  onClick={onDelete}
                  aria-label={`Delete run for ${workflowName}`}
                >
                  <Trash2 className="size-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Remove from history
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </td>
    </tr>
  )
}
