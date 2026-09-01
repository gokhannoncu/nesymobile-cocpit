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
  Workflow,
} from 'lucide-react'
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
const thClass = cn('px-3 py-2', cellGrid)
const tdClass = cn('px-3 py-2 align-middle', cellGrid)

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
        'inline-flex h-6 max-w-[11rem] items-center gap-1 rounded-full px-2.5 text-[10px] font-semibold uppercase tracking-wide',
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
        'inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-[10px] font-bold uppercase tracking-wide',
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
    <span className="inline-flex h-6 items-center rounded-full border border-border/70 bg-background/90 px-2.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
      {engineType}
    </span>
  )
}

export function ExecutionQueueTable({
  rows,
  allRowsCount,
  sortBy,
  onClearFilters,
}: {
  rows: ExecutionQueueRow[]
  allRowsCount: number
  sortBy: 'updated-desc' | 'updated-asc'
  onClearFilters: () => void
}) {
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
    <article className="overflow-hidden rounded-lg border border-border bg-card shadow-xs ring-1 ring-border/40">
      <div className="flex flex-col gap-1 border-b border-border bg-muted/15 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight text-foreground">BridgeFlow pipeline</p>
          <p className="text-[11px] leading-tight text-muted-foreground">
            {sortedRows.length === 0
              ? 'No executions in this view'
              : sortedRows.length === allRowsCount
                ? `${allRowsCount} execution${allRowsCount === 1 ? '' : 's'} tracked`
                : `${sortedRows.length} of ${allRowsCount} match filters`}
            {liveCount > 0 ? ` · ${liveCount} active` : ''}
            {blockedCount > 0 ? ` · ${blockedCount} blocked` : ''}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto border-t border-border">
        <table className="min-w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted/25 text-left text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
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
              <ExecutionQueueRowView key={row.runId} row={row} index={index} nowMs={nowMs} />
            ))}
            {paginatedRows.length === 0 ? (
              <tr>
                <td className="border-b border-border px-5 py-12 text-center" colSpan={9}>
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
    </article>
  )
}

function ExecutionQueueRowView({
  row,
  index,
  nowMs,
}: {
  row: ExecutionQueueRow
  index: number
  nowMs: number
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
        blocked
          ? 'bg-amber-50/35 hover:bg-amber-50/50 dark:bg-amber-950/15 dark:hover:bg-amber-950/25'
          : active
            ? 'bg-sky-50/40 hover:bg-sky-50/55 dark:bg-sky-950/20 dark:hover:bg-sky-950/30'
            : index % 2 === 1
              ? 'bg-muted/50 hover:bg-muted/65'
              : 'bg-card hover:bg-muted/35',
      )}
    >
      <td className={cn('hidden lg:table-cell', tdClass)}>
        <code
          className="inline-flex max-w-full truncate rounded-lg border border-border/60 bg-background/90 px-1.5 py-0.5 font-mono text-[10px] text-foreground"
          title={row.runId}
        >
          {truncateRunId(row.runId, 12)}
        </code>
      </td>
      <td className={tdClass}>
        <div className="flex min-w-0 items-center gap-2">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-teal-50 ring-1 ring-teal-100 dark:bg-teal-950/30 dark:ring-teal-900/50">
            <Workflow className="size-3.5 text-teal-700 dark:text-teal-400" strokeWidth={2.2} />
          </span>
          <div className="min-w-0">
            <Link
              href={`/automation/${row.workflowSlug}`}
              className="block truncate text-xs font-semibold leading-tight text-foreground outline-none transition-colors group-hover:text-nesy-ink focus-visible:ring-2 focus-visible:ring-nesy-soft rounded-lg"
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
          className="inline-flex h-6 max-w-[11rem] items-center gap-1 truncate rounded-full border border-border/60 bg-muted/30 px-2 text-[10px] font-medium text-muted-foreground"
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
        <div className="flex justify-end">
          <Link
            href={runHref}
            className="inline-flex w-12 items-center justify-end gap-0.5 rounded-lg py-0.5 text-[11px] font-semibold text-nesy-ink transition hover:bg-nesy-soft/40"
          >
            Open
            <ChevronRight className="size-3 shrink-0" />
          </Link>
        </div>
      </td>
    </tr>
  )
}
