'use client'

import { useMemo, useRef, useState, useEffect, useId } from 'react'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { cn } from '@nesy/metronic/lib/utils'
import {
  Activity,
  ArrowDownToLine,
  CheckCircle2,
  Cpu,
  Database,
  Gavel,
  MousePointerClick,
  Radio,
  Timer,
  XCircle,
} from 'lucide-react'
import type {
  RunLiveEvent,
  RunLiveEventKind,
  RunLiveEventLevel,
} from '@/lib/verdict-runtime/run-live-stream'

const KIND_META: Record<RunLiveEventKind, { label: string; icon: typeof Activity }> = {
  RUN_STATUS: { label: 'Run', icon: Activity },
  STEP: { label: 'Step', icon: Cpu },
  ACTION: { label: 'Action', icon: MousePointerClick },
  WAIT: { label: 'Wait', icon: Timer },
  ORACLE: { label: 'Oracle', icon: Gavel },
  EVIDENCE: { label: 'Evidence', icon: Database },
  DEVICE: { label: 'Device', icon: Radio },
  INTERACTION: { label: 'Interaction', icon: MousePointerClick },
  RUN_RESULT: { label: 'Result', icon: CheckCircle2 },
}

const LEVEL_CLASS: Record<RunLiveEventLevel, string> = {
  INFO: 'text-muted-foreground border-border',
  SUCCESS: 'text-green-700 border-green-200 bg-green-50',
  WARN: 'text-amber-700 border-amber-200 bg-amber-50',
  ERROR: 'text-red-700 border-red-200 bg-red-50',
}

const FILTERS: readonly (RunLiveEventKind | 'ALL')[] = [
  'ALL',
  'STEP',
  'ACTION',
  'WAIT',
  'ORACLE',
  'EVIDENCE',
  'DEVICE',
  'INTERACTION',
  'RUN_RESULT',
  'RUN_STATUS',
]

/**
 * The run's events in the order they arrived.
 *
 * Follow-the-tail is opt-out rather than absolute: an operator who scrolls up to
 * read the step that just failed must not be yanked back down by the next
 * evidence fact, so autoscroll switches itself off as soon as the list is not at
 * the bottom, and back on when it is.
 */
export function RunLiveFeed({ events }: { events: readonly RunLiveEvent[] }) {
  const [filter, setFilter] = useState<RunLiveEventKind | 'ALL'>('ALL')
  const [following, setFollowing] = useState(true)
  const listRef = useRef<HTMLDivElement | null>(null)

  const visible = useMemo(
    () => (filter === 'ALL' ? events : events.filter((event) => event.kind === filter)),
    [events, filter],
  )

  useEffect(() => {
    const list = listRef.current
    if (list === null || !following) return
    list.scrollTop = list.scrollHeight
  }, [visible, following])

  const counts = useMemo(() => {
    const byKind = new Map<RunLiveEventKind, number>()
    for (const event of events) byKind.set(event.kind, (byKind.get(event.kind) ?? 0) + 1)
    return byKind
  }, [events])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map((candidate) => {
          const count = candidate === 'ALL' ? events.length : (counts.get(candidate) ?? 0)
          return (
            <button
              key={candidate}
              type="button"
              onClick={() => setFilter(candidate)}
              aria-pressed={candidate === filter}
              className={cn(
                'rounded-md border px-2 py-1 text-[11px] font-mono transition-colors',
                candidate === filter
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border text-muted-foreground hover:bg-muted/60',
              )}
            >
              {candidate === 'ALL' ? 'all' : KIND_META[candidate].label.toLowerCase()} {count}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setFollowing((current) => !current)}
          className={cn(
            'ml-auto flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-mono transition-colors',
            following
              ? 'border-primary/40 bg-primary/10 text-primary'
              : 'border-border text-muted-foreground hover:bg-muted/60',
          )}
        >
          <ArrowDownToLine className="h-3 w-3" />
          {following ? 'following' : 'paused'}
        </button>
      </div>

      <div
        ref={listRef}
        onScroll={(scrollEvent) => {
          const element = scrollEvent.currentTarget
          const atBottom =
            element.scrollHeight - element.scrollTop - element.clientHeight < 24
          setFollowing(atBottom)
        }}
        className="max-h-[26rem] overflow-y-auto rounded-md border bg-muted/10 divide-y divide-border/60"
      >
        {visible.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">
            No live events yet. Steps, waits, oracle revisions, evidence facts and device events
            appear here as the run produces them.
          </p>
        ) : (
          visible.map((event) => <FeedRow key={event.seq} event={event} />)
        )}
      </div>
    </div>
  )
}

function FeedRow({ event }: { event: RunLiveEvent }) {
  const [expanded, setExpanded] = useState(false)
  const detailId = useId()
  const meta = KIND_META[event.kind]
  const Icon = event.level === 'ERROR' ? XCircle : meta.icon
  const detailEntries = Object.entries(event.detail).filter(
    ([, value]) => value !== null && value !== undefined && value !== '',
  )

  return (
    <div className="px-3 py-2">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="grid w-full grid-cols-[auto_auto_1fr] items-start gap-x-2 gap-y-1 text-left sm:flex"
        disabled={detailEntries.length === 0}
        aria-expanded={detailEntries.length > 0 ? expanded : undefined}
        aria-controls={detailEntries.length > 0 ? detailId : undefined}
      >
        <Icon
          className={cn(
            'mt-0.5 h-3.5 w-3.5 shrink-0',
            event.level === 'ERROR'
              ? 'text-destructive'
              : event.level === 'SUCCESS'
                ? 'text-green-600'
                : event.level === 'WARN'
                  ? 'text-amber-600'
                  : 'text-muted-foreground',
          )}
        />
        <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
          {formatClock(event.atMs)}
        </span>
        <Badge variant="outline" className={cn('gap-1 text-[10px]', LEVEL_CLASS[event.level])}>
          {meta.label}
        </Badge>
        <span className="col-span-3 min-w-0 break-words text-xs sm:col-span-1 sm:flex-1">
          {event.title}
        </span>
      </button>
      {expanded && detailEntries.length > 0 ? (
        <dl
          id={detailId}
          className="mt-2 grid grid-cols-1 gap-1 rounded-md bg-muted/30 p-2 font-mono text-[10px] sm:ml-6 sm:grid-cols-2"
        >
          {detailEntries.map(([key, value]) => (
            <div key={key} className="flex gap-1">
              <dt className="text-muted-foreground">{key}</dt>
              <dd className="min-w-0 break-all">{renderValue(value)}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  )
}

function formatClock(atMs: number): string {
  const date = new Date(atMs)
  if (Number.isNaN(date.getTime())) return '--:--:--'
  return date.toLocaleTimeString([], { hour12: false })
}

function renderValue(value: unknown): string {
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}
