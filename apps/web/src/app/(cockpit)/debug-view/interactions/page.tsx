'use client'

// Debug View - User Interaction Timeline
// User interaction history on the device: app open -> login -> click -> screen
// open -> scan -> network request, chronological flow.

import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Activity,
  AlertCircle,
  Download,
  Keyboard,
  MonitorSmartphone,
  MousePointerClick,
  MousePointer2,
  Radio,
  ScanLine,
  Smartphone,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { ProductPage, PageSection, EASE, toneCard, toneIcon, toneIconBox, toneText, type Tone } from '@/components/product'
import { DebugHeader, DebugCrossLinks, NoDeviceState } from '@/components/debug-view/shared'
import { useDebugView } from '@/components/debug-view/debug-context'
import {
  MAX_STORED_INTERACTIONS,
  useInteractionCapture,
  type InteractionStreamState,
} from '@/components/debug-view/interaction-capture-context'
import { INTERACTION_KIND_META } from '@/data/debug-view/mock-interactions'
import type { InteractionKind, InteractionEvent } from '@/data/debug-view/types'
import {
  buildInteractionExport,
  filterInteractions,
  filterInteractionsForCounts,
  interactionExportFilename,
  type InteractionFilterState,
} from '@/lib/debug-view/filter-interactions'
import {
  fetchVerdictInteractions,
  fetchVerdictRunHistory,
} from '@/lib/verdict-runtime/client'
import type { WorkflowRunApi } from '@/lib/verdict-runtime/types'

function durableItemToInteractionEvent(
  item: Record<string, unknown>,
  index: number,
  baseMs: number,
): InteractionEvent {
  const occurredAtMs =
    typeof item.occurredAtMs === 'number' ? item.occurredAtMs : baseMs + index * 10
  const origin = typeof item.origin === 'string' ? item.origin : 'UNKNOWN'
  const summary = typeof item.summary === 'string' ? item.summary : origin
  const confidence =
    typeof item.confidence === 'number' ? item.confidence : undefined
  return {
    id: String(item.eventId ?? item.id ?? `durable-${index}`),
    timestamp: new Date(occurredAtMs).toISOString(),
    offsetMs: Math.max(0, occurredAtMs - baseMs),
    kind: origin === 'BRIDGE_INJECTED' ? 'click' : origin === 'MANUAL' ? 'click' : 'system',
    screen: 'durable-subscription',
    label: summary,
    detail: [
      `origin=${origin}`,
      confidence !== undefined ? `confidence=${confidence}` : null,
      typeof item.revision === 'number' ? `rev=${item.revision}` : null,
    ]
      .filter(Boolean)
      .join(' · '),
    analyticsEvent: null,
  }
}

/** Nesy Mobile / Debug View brand accent — matches overview, network, schedule pages. */
const PAGE_TONE = 'orange' as const satisfies Tone

const KIND_ICON: Record<InteractionKind, typeof Zap> = {
  app: Zap,
  screen: MonitorSmartphone,
  click: MousePointer2,
  input: Keyboard,
  scan: ScanLine,
  network: Radio,
  system: Smartphone,
  error: AlertCircle,
}

function fmtOffset(ms: number): string {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const rem = s % 60
  return m > 0 ? `+${m}m ${rem}s` : `+${rem}s`
}

const EMPTY_FILTERS: InteractionFilterState = {
  kind: 'all',
  from: '',
  to: '',
  search: '',
}

function hasActiveFilters(filters: InteractionFilterState): boolean {
  return filters.kind !== 'all' || Boolean(filters.from.trim()) || Boolean(filters.to.trim()) || Boolean(filters.search.trim())
}

function downloadInteractionJson(payload: ReturnType<typeof buildInteractionExport>, serial: string) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = interactionExportFilename(serial, new Date(payload.exportedAt))
  anchor.click()
  URL.revokeObjectURL(url)
}

export default function InteractionsPage() {
  const { selectedDevice } = useDebugView()
  const { events: adbEvents, streamState, clear: clearInteractions } = useInteractionCapture()
  const [filters, setFilters] = useState<InteractionFilterState>(EMPTY_FILTERS)
  const [runOptions, setRunOptions] = useState<WorkflowRunApi[]>([])
  const [selectedRunId, setSelectedRunId] = useState<string>('')
  const [durableEvents, setDurableEvents] = useState<InteractionEvent[]>([])
  const [durableError, setDurableError] = useState<string | null>(null)
  const [durableRevision, setDurableRevision] = useState(0)
  const [sourceMode, setSourceMode] = useState<'durable' | 'adb-diagnostic'>('durable')

  useEffect(() => {
    let cancelled = false
    void fetchVerdictRunHistory({ limit: 40, offset: 0 })
      .then((history) => {
        if (cancelled) return
        setRunOptions(history.items)
        if (!selectedRunId && history.items[0]) {
          setSelectedRunId(history.items[0].correlation.runId)
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setDurableError(
            error instanceof Error ? error.message : 'Run history unavailable for durable feed',
          )
        }
      })
    return () => {
      cancelled = true
    }
    // Intentionally once on mount; selectedRunId seeded from first item.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (sourceMode !== 'durable' || !selectedRunId) return
    let cancelled = false
    const pull = async () => {
      try {
        const page = await fetchVerdictInteractions(selectedRunId, 0)
        if (cancelled) return
        setDurableRevision(page.latestRevision)
        setDurableError(null)
        const origin = page.items[0] as Record<string, unknown> | undefined
        const originMs =
          origin && typeof origin.occurredAtMs === 'number'
            ? Number(origin.occurredAtMs)
            : Date.now()
        setDurableEvents(
          page.items.map((item, index) =>
            durableItemToInteractionEvent(item as Record<string, unknown>, index, originMs),
          ),
        )
      } catch (error) {
        if (!cancelled) {
          setDurableError(
            error instanceof Error ? error.message : 'DurableInteractionSubscription failed',
          )
        }
      }
    }
    void pull()
    const timer = setInterval(() => void pull(), 4000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [selectedRunId, sourceMode])

  const handleClearHistory = () => {
    if (sourceMode === 'durable') {
      setDurableEvents([])
      setDurableRevision(0)
      return
    }
    clearInteractions()
  }

  const clearFilters = () => setFilters(EMPTY_FILTERS)

  const allEvents = sourceMode === 'durable' ? durableEvents : adbEvents

  const countBase = useMemo(
    () => filterInteractionsForCounts(allEvents, filters),
    [allEvents, filters],
  )

  const events = useMemo(() => filterInteractions(allEvents, filters), [allEvents, filters])

  const kinds = Object.keys(INTERACTION_KIND_META) as InteractionKind[]
  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const e of countBase) c[e.kind] = (c[e.kind] ?? 0) + 1
    return c
  }, [countBase])

  type DisplayEvent = InteractionEvent & { repeatCount?: number }

  const displayEvents = useMemo(() => {
    const grouped: DisplayEvent[] = []

    for (const ev of events) {
      const last = grouped[grouped.length - 1]

      // If consecutive events have the same kind and label, group them
      if (last && last.kind === ev.kind && last.label === ev.label && last.screen === ev.screen) {
        last.repeatCount = (last.repeatCount || 1) + 1
      } else {
        grouped.push({ ...ev, repeatCount: 1 })
      }
    }

    return grouped
  }, [events])

  const handleExport = () => {
    if (events.length === 0) return
    const serial =
      sourceMode === 'durable'
        ? selectedRunId || 'durable-run'
        : selectedDevice?.serial || 'unknown-device'
    const payload = buildInteractionExport({
      events,
      filters,
      device: {
        serial,
        name:
          sourceMode === 'durable'
            ? `run:${selectedRunId}`
            : selectedDevice?.name || serial,
      },
    })
    downloadInteractionJson(payload, serial)
  }

  return (
    <ProductPage path="/debug-view/interactions">
      <DebugHeader
        icon={MousePointerClick}
        title="User Interaction Timeline"
        lead="Primary feed is DurableInteractionSubscription (run-scoped). ADB stream remains a diagnostic secondary source."
        tone={PAGE_TONE}
        badges={[
          { label: 'DurableInteractionSubscription', tone: PAGE_TONE },
          { label: 'Run-scoped', tone: PAGE_TONE },
          { label: 'ADB diagnostic', tone: 'gray' },
        ]}
        actions={<DebugCrossLinks currentPath="/debug-view/interactions" />}
      />

      <div className="mb-4 space-y-2 rounded-xl border border-border/80 bg-card px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium border',
              sourceMode === 'durable'
                ? 'bg-orange-100 border-orange-300 text-orange-900'
                : 'bg-muted border-transparent text-muted-foreground',
            )}
            onClick={() => setSourceMode('durable')}
          >
            Durable (Verdict)
          </button>
          <button
            type="button"
            className={cn(
              'rounded-md px-2.5 py-1 text-xs font-medium border',
              sourceMode === 'adb-diagnostic'
                ? 'bg-orange-100 border-orange-300 text-orange-900'
                : 'bg-muted border-transparent text-muted-foreground',
            )}
            onClick={() => setSourceMode('adb-diagnostic')}
          >
            ADB diagnostic
          </button>
          {sourceMode === 'durable' ? (
            <select
              className="ml-auto min-w-[16rem] rounded-md border bg-background px-2 py-1 text-xs font-mono"
              value={selectedRunId}
              onChange={(e) => setSelectedRunId(e.target.value)}
            >
              <option value="">Select run…</option>
              {runOptions.map((run) => (
                <option key={run.correlation.runId} value={run.correlation.runId}>
                  {run.correlation.runId} · {String(run.run?.status ?? '—')} ·{' '}
                  {run.correlation.engineType}
                </option>
              ))}
            </select>
          ) : null}
        </div>
        {sourceMode === 'durable' ? (
          <p className="text-[11px] text-muted-foreground font-mono">
            {selectedRunId
              ? `GET /verdict/runtime/runs/${selectedRunId}/interactions · rev ${durableRevision}`
              : 'Pick a run to subscribe'}
          </p>
        ) : (
          <p className="text-[11px] text-amber-800">
            ADB EventSource is diagnostic only — not the DurableInteractionSubscription target.
          </p>
        )}
        {durableError ? (
          <p className="text-[11px] text-red-700">{durableError}</p>
        ) : null}
      </div>

      {sourceMode === 'adb-diagnostic' && !selectedDevice ? (
        <NoDeviceState />
      ) : sourceMode === 'durable' && !selectedRunId ? (
        <div className="rounded-xl border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
          Select a run to load DurableInteractionSubscription events.
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="space-y-3 rounded-xl border border-border/80 bg-orange-50/30 px-4 py-3 dark:bg-orange-950/10">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap gap-1.5">
                <FilterChip
                  label="All"
                  active={filters.kind === 'all'}
                  onClick={() => setFilters((prev) => ({ ...prev, kind: 'all' }))}
                  count={countBase.length}
                  tone={PAGE_TONE}
                />
                {kinds.map((k) => (
                  <FilterChip
                    key={k}
                    label={INTERACTION_KIND_META[k].label}
                    active={filters.kind === k}
                    onClick={() => setFilters((prev) => ({ ...prev, kind: k }))}
                    count={counts[k] ?? 0}
                    tone={INTERACTION_KIND_META[k].tone}
                  />
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Badge
                  variant="secondary"
                  appearance="outline"
                  size="sm"
                  className={cn(
                    'gap-1.5',
                    sourceMode === 'durable'
                      ? toneText.green
                      : streamState === 'live'
                        ? toneText.green
                        : streamState === 'reconnecting'
                          ? toneText.amber
                          : toneText.gray,
                  )}
                >
                  <span
                    className={cn(
                      'size-1.5 rounded-full',
                      sourceMode === 'durable'
                        ? 'bg-green-500'
                        : streamState === 'live'
                          ? 'bg-green-500'
                          : streamState === 'reconnecting'
                            ? 'bg-amber-500'
                            : 'bg-muted-foreground/50',
                    )}
                  />
                  {sourceMode === 'durable'
                    ? 'Durable live'
                    : streamState === 'live'
                      ? 'ADB live'
                      : streamState === 'reconnecting'
                        ? 'Reconnecting'
                        : 'Connecting'}
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {events.length}/{allEvents.length} shown · {allEvents.length}/{MAX_STORED_INTERACTIONS} retained
                </span>
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={events.length === 0}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-orange-500/30 hover:bg-orange-500/5 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                >
                  <Download className="size-3" />
                  Export JSON
                </button>
                <button
                  type="button"
                  onClick={handleClearHistory}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-orange-500/30 hover:bg-orange-500/5 hover:text-foreground"
                >
                  <Trash2 className="size-3" />
                  Clear
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-2">
              <label className="flex min-w-[10rem] flex-1 flex-col gap-1">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">From</span>
                <input
                  type="datetime-local"
                  value={filters.from}
                  onChange={(e) => setFilters((prev) => ({ ...prev, from: e.target.value }))}
                  className="h-8 rounded-lg border border-border bg-card px-2 font-mono text-[11px] text-foreground outline-none focus:border-orange-500/40"
                />
              </label>
              <label className="flex min-w-[10rem] flex-1 flex-col gap-1">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">To</span>
                <input
                  type="datetime-local"
                  value={filters.to}
                  onChange={(e) => setFilters((prev) => ({ ...prev, to: e.target.value }))}
                  className="h-8 rounded-lg border border-border bg-card px-2 font-mono text-[11px] text-foreground outline-none focus:border-orange-500/40"
                />
              </label>
              <label className="flex min-w-[12rem] flex-[2] flex-col gap-1">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Search</span>
                <input
                  type="search"
                  value={filters.search}
                  onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                  placeholder="Label, screen, detail, analytics…"
                  className="h-8 rounded-lg border border-border bg-card px-2.5 text-[11px] text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-orange-500/40"
                />
              </label>
              {hasActiveFilters(filters) ? (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mb-0.5 flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-orange-500/30 hover:bg-orange-500/5 hover:text-foreground"
                >
                  <X className="size-3" />
                  Clear filters
                </button>
              ) : null}
            </div>
          </div>

          {/* Timeline */}
          <PageSection eyebrow="Session" title="Interaction Flow" icon={MousePointerClick} tone={PAGE_TONE}>
            <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              {displayEvents.length === 0 ? (
                <InteractionTimelineEmptyState
                  streamState={streamState}
                  filters={filters}
                  filteredCount={events.length}
                  totalEvents={allEvents.length}
                  deviceName={selectedDevice.name}
                  onClearFilters={clearFilters}
                />
              ) : (
                <div className="relative p-5">
                  <div className="absolute bottom-5 left-[42px] top-5 w-px bg-orange-200 dark:bg-orange-900/50" />
                  <div className="space-y-1">
                    {displayEvents.map((ev, i) => {
                  const meta = INTERACTION_KIND_META[ev.kind]
                  const Icon = KIND_ICON[ev.kind]
                  return (
                    <motion.div
                      key={ev.id}
                      className="relative flex gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-orange-500/5"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.28, delay: i * 0.03, ease: EASE }}
                    >
                      <span className={cn('z-10 flex size-7 shrink-0 items-center justify-center rounded-full border-2 border-background', toneCard[meta.tone])}>
                        <Icon className={cn('size-3.5', toneIcon[meta.tone])} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-foreground">{ev.label}</span>

                          {ev.repeatCount && ev.repeatCount > 1 && (
                            <Badge variant="secondary" size="xs" className="bg-amber-500/10 text-amber-500 hover:bg-amber-500/20">
                              {ev.repeatCount}x
                            </Badge>
                          )}

                          <Badge variant="secondary" appearance="outline" size="xs" className={cn(toneText[meta.tone])}>
                            {ev.screen}
                          </Badge>
                          {ev.analyticsEvent && (
                            <Badge variant="secondary" size="xs" className="gap-1 font-mono text-[9px]">
                              <Zap className="size-2.5" />
                              {ev.analyticsEvent}
                            </Badge>
                          )}
                          <span className="ms-auto shrink-0 font-mono text-[10px] text-muted-foreground">
                            {new Date(ev.timestamp).toLocaleTimeString('en-US')} * {fmtOffset(ev.offsetMs)}
                          </span>
                        </div>
                        {ev.detail && <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{ev.detail}</p>}
                      </div>
                    </motion.div>
                  )
                })}
                  </div>
                </div>
              )}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              Capture runs from the shared Debug View layout, so it continues on Overview, Screen State, Network and
              Database pages. Returning later also backfills the selected device&apos;s InteractionEvent log history; the
              latest {MAX_STORED_INTERACTIONS.toLocaleString('en-US')} unique events are retained per device.
            </p>
          </PageSection>
        </>
      )}
    </ProductPage>
  )
}

function InteractionTimelineEmptyState({
  streamState,
  filters,
  filteredCount,
  totalEvents,
  deviceName,
  onClearFilters,
}: {
  streamState: InteractionStreamState
  filters: InteractionFilterState
  filteredCount: number
  totalEvents: number
  deviceName: string
  onClearFilters: () => void
}) {
  const isFilteredEmpty = totalEvents > 0 && filteredCount === 0 && hasActiveFilters(filters)
  const kindMeta = filters.kind !== 'all' ? INTERACTION_KIND_META[filters.kind] : null

  if (isFilteredEmpty) {
    const title =
      filters.kind !== 'all' && kindMeta && !filters.from.trim() && !filters.to.trim() && !filters.search.trim()
        ? `No ${kindMeta.label.toLowerCase()} events`
        : 'No matching interactions'

    return (
      <div className="flex flex-col items-center px-6 py-12 text-center">
        <span
          className={cn(
            'flex size-12 items-center justify-center rounded-2xl',
            toneIconBox[kindMeta?.tone ?? PAGE_TONE],
          )}
        >
          {filters.kind !== 'all' ? (
            (() => {
              const Icon = KIND_ICON[filters.kind]
              return <Icon className={cn('size-6', toneIcon[kindMeta!.tone])} />
            })()
          ) : (
            <MousePointerClick className={cn('size-6', toneIcon[PAGE_TONE])} />
          )}
        </span>
        <h3 className="mt-4 text-base font-bold text-foreground">{title}</h3>
        <p className="mt-1.5 max-w-md text-sm text-muted-foreground">
          {totalEvents} interaction{totalEvents === 1 ? '' : 's'} captured, but none match the current filters.
        </p>
        <button
          type="button"
          onClick={onClearFilters}
          className={cn(
            'mt-4 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
            toneCard[PAGE_TONE],
            toneText[PAGE_TONE],
            'border-current/25 hover:bg-orange-500/10',
          )}
        >
          Clear filters
        </button>
      </div>
    )
  }

  const steps = [
    {
      step: '1',
      icon: Radio,
      title: 'Capture is active',
      desc: 'InteractionEvent logs stream from the device via adb logcat while Debug View is open.',
    },
    {
      step: '2',
      icon: Smartphone,
      title: `Use ${deviceName}`,
      desc: 'Tap buttons, scan parcels, navigate screens, or trigger API calls on the device.',
    },
    {
      step: '3',
      icon: MousePointerClick,
      title: 'Watch the flow',
      desc: 'Each action appears here in order with screen, detail and analytics tags.',
    },
  ]

  const exampleKinds: InteractionKind[] = ['click', 'screen', 'scan', 'network']

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-orange-50/40 px-4 py-3 dark:bg-orange-950/15">
        <div className="flex items-center gap-2">
          <span className={cn('flex size-8 items-center justify-center rounded-lg border border-orange-500/20', toneIconBox[PAGE_TONE])}>
            <Activity className="size-4 text-orange-600 dark:text-orange-400" />
          </span>
          <div>
            <div className="text-sm font-semibold text-foreground">
              {streamState === 'reconnecting'
                ? 'Reconnecting to device stream'
                : streamState === 'connecting'
                  ? 'Connecting capture stream'
                  : 'Waiting for interactions'}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {streamState === 'live'
                ? 'Listening on InteractionEvent logcat tag'
                : streamState === 'reconnecting'
                  ? 'Stored events stay available while the stream recovers'
                  : 'Use an instrumented NesyMobile build on the connected device'}
            </div>
          </div>
        </div>
        <Badge
          variant="secondary"
          appearance="outline"
          size="sm"
          className={cn(
            'gap-1.5',
            streamState === 'live'
              ? toneText.green
              : streamState === 'reconnecting'
                ? toneText.amber
                : toneText.gray,
          )}
        >
          <span
            className={cn(
              'size-1.5 rounded-full',
              streamState === 'live'
                ? 'animate-pulse bg-green-500'
                : streamState === 'reconnecting'
                  ? 'bg-amber-500'
                  : 'bg-muted-foreground/50',
            )}
          />
          {streamState === 'live'
            ? 'ADB live'
            : streamState === 'reconnecting'
              ? 'Reconnecting'
              : streamState === 'connecting'
                ? 'Connecting'
                : 'Idle'}
        </Badge>
      </div>

      <div className="flex flex-col items-center px-6 py-12 text-center lg:py-14">
        <div className="relative">
          <span className="flex size-16 items-center justify-center rounded-3xl border border-orange-500/25 bg-orange-500/8">
            <MousePointerClick className="size-8 text-orange-600 dark:text-orange-400" />
          </span>
          {streamState === 'live' ? (
            <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-green-500 ring-2 ring-card">
              <span className="size-2 animate-pulse rounded-full bg-white" />
            </span>
          ) : null}
        </div>

        <h3 className="mt-5 text-lg font-bold text-foreground">No interactions captured yet</h3>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">
          Capture runs in the background across Debug View pages. Interact with NesyMobile on{' '}
          <span className="font-medium text-foreground">{deviceName}</span> and the timeline will populate
          automatically.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {exampleKinds.map((kind) => {
            const meta = INTERACTION_KIND_META[kind]
            const Icon = KIND_ICON[kind]
            return (
              <span
                key={kind}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium',
                  toneCard[meta.tone],
                  toneText[meta.tone],
                )}
              >
                <Icon className="size-3" />
                {meta.label}
              </span>
            )
          })}
        </div>

        <div className="mt-8 grid w-full max-w-3xl grid-cols-1 gap-3 text-left sm:grid-cols-3">
          {steps.map((item) => (
            <div key={item.step} className="rounded-xl border border-border/70 bg-muted/15 px-4 py-3.5">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-md bg-orange-500/10 font-mono text-[11px] font-bold text-orange-700 dark:text-orange-300">
                  {item.step}
                </span>
                <item.icon className="size-4 text-orange-600 dark:text-orange-400" />
                <span className="text-sm font-semibold text-foreground">{item.title}</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </motion.div>
  )
}

function FilterChip({
  label,
  active,
  onClick,
  count,
  tone = 'gray',
}: {
  label: string
  active: boolean
  onClick: () => void
  count: number
  tone?: Tone
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors',
        active ? cn(toneCard[tone], toneText[tone], 'border-current/30') : 'border-border bg-card text-muted-foreground hover:border-orange-500/25 hover:bg-orange-500/5',
      )}
    >
      {label}
      <span className={cn('rounded px-1 text-[10px]', active ? 'bg-background/60' : 'bg-muted')}>{count}</span>
    </button>
  )
}
