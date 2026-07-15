'use client'

import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Search,
  Pause,
  Play,
  Square,
  Flag,
  ChevronDown,
  ChevronRight,
  AlignLeft,
  Rows3,
  WrapText,
  ArrowDown,
  X,
  Smartphone,
  Clock,
  Hash,
  Check,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Button } from '@nesy/metronic/components/ui/button'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Input } from '@nesy/metronic/components/ui/input'
import { ScrollArea } from '@nesy/metronic/components/ui/scroll-area'
import { Switch } from '@nesy/metronic/components/ui/switch'
import { EASE, toneIcon } from '@/components/product'
import { RunIdBadge } from '@/components/engineering/device-lab/device-lab-shared'
import type {
  LogEvent,
  LogMarker,
  LogSource,
  LogLevel,
} from '@/data/engineering/device-lab/device-lab-types'
import {
  LOG_SOURCE_META,
  LOG_LEVEL_META,
  MOCK_RAW_LOGS,
  CORRELATION_RULES,
  matchCorrelation,
} from '@/data/engineering/device-lab/log-presets'

/* ──────────────────────────── Props ──────────────────────────────── */

interface LogTimelineProps {
  events: LogEvent[]
  markers: LogMarker[]
  captureState: 'idle' | 'capturing' | 'paused' | 'stopped'
  sessionId: string | null
  logView: 'timeline' | 'raw'
  onLogView: (v: 'timeline' | 'raw') => void
  searchQuery: string
  onSearch: (q: string) => void
  selectedEvent: LogEvent | null
  onSelectEvent: (e: LogEvent | null) => void
  onAddMarker: (label: string) => void
  onPause: () => void
  onStop: () => void
  selectedSources: LogSource[]
  selectedLevels: LogLevel[]
  deviceName: string
  appVersion: string
  presetName: string | null
}

/* ──────────────────── Level style helpers ─────────────────────────── */

const LEVEL_ROW_BG: Partial<Record<LogLevel, string>> = {
  error:
    'bg-red-50/60 border-red-200/60 dark:bg-red-950/20 dark:border-red-900/40',
  fatal:
    'bg-red-100/60 border-red-300/60 dark:bg-red-950/30 dark:border-red-800/50',
  warn: 'bg-amber-50/40 border-amber-200/40 dark:bg-amber-950/15 dark:border-amber-900/30',
}

const SOURCE_DOT_CLASS: Record<string, string> = {
  blue: 'bg-blue-500',
  gray: 'bg-gray-400',
  teal: 'bg-teal-500',
  amber: 'bg-amber-500',
  purple: 'bg-purple-500',
  indigo: 'bg-indigo-500',
  green: 'bg-green-500',
  orange: 'bg-orange-500',
  red: 'bg-red-500',
}

/* ──────────────────── Elapsed Timer ──────────────────────────────── */

function useSessionTimer(active: boolean) {
  const [seconds, setSeconds] = useState(0)
  useEffect(() => {
    if (!active) return
    const iv = setInterval(() => setSeconds((s) => s + 1), 1000)
    return () => clearInterval(iv)
  }, [active])
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/* ──────────────────── Format timestamp ───────────────────────────── */

function fmtTime(ts: string) {
  try {
    const d = new Date(ts)
    return d.toLocaleTimeString('tr-TR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    })
  } catch {
    return ts
  }
}

/* ──────────────────── Main Component ─────────────────────────────── */

export function LogTimeline({
  events,
  markers,
  captureState,
  sessionId,
  logView,
  onLogView,
  searchQuery,
  onSearch,
  selectedEvent,
  onSelectEvent,
  onAddMarker,
  onPause,
  onStop,
  selectedSources,
  selectedLevels,
  deviceName,
  appVersion,
  presetName,
}: LogTimelineProps) {
  const isCapturing =
    captureState === 'capturing' || captureState === 'paused'
  const elapsed = useSessionTimer(captureState === 'capturing')
  const [markerInput, setMarkerInput] = useState('')
  const [wrapRaw, setWrapRaw] = useState(false)
  const [followLive, setFollowLive] = useState(true)

  /* Merge events and markers for timeline */
  const timelineItems = useMemo(() => {
    const items: Array<
      { type: 'event'; data: LogEvent } | { type: 'marker'; data: LogMarker }
    > = events.map((e) => ({ type: 'event' as const, data: e }))

    markers.forEach((m) => {
      items.push({ type: 'marker', data: m })
    })

    items.sort((a, b) => {
      const tsA = a.data.timestamp
      const tsB = b.data.timestamp
      return tsA < tsB ? -1 : tsA > tsB ? 1 : 0
    })

    return items
  }, [events, markers])

  /* Correlation analysis */
  const correlationResults = useMemo(() => {
    if (events.length === 0) return []
    return CORRELATION_RULES.map((rule) => ({
      rule,
      results: matchCorrelation(events, rule),
    }))
  }, [events])

  /* Active filter chips */
  const activeFilters = useMemo(() => {
    const chips: { label: string; type: 'source' | 'level' | 'search' }[] = []
    selectedSources.forEach((s) =>
      chips.push({ label: LOG_SOURCE_META[s]?.label ?? s, type: 'source' }),
    )
    selectedLevels.forEach((l) =>
      chips.push({ label: LOG_LEVEL_META[l]?.label ?? l, type: 'level' }),
    )
    if (searchQuery) chips.push({ label: `"${searchQuery}"`, type: 'search' })
    return chips
  }, [selectedSources, selectedLevels, searchQuery])

  const handleAddMarkerSubmit = () => {
    if (!markerInput.trim()) return
    onAddMarker(markerInput.trim())
    setMarkerInput('')
  }

  /* ── Idle state ─────────────────────────────────────────────────── */
  if (captureState === 'idle') {
    return (
      <motion.div
        className="flex flex-col items-center justify-center gap-4 rounded-xl border bg-card p-12 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: EASE }}
      >
        <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
          <Rows3 className="size-6 text-muted-foreground" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            Waiting for Log Stream
          </h3>
          <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
            Select capture mode and sources from the left panel, then click &ldquo;Start Log Capture&rdquo;.
          </p>
        </div>
      </motion.div>
    )
  }

  return (
    <motion.div
      className="rounded-xl border bg-card overflow-hidden"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.12, ease: EASE }}
    >
      {/* ── Session header bar ──────────────────────────────────── */}
      <div className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
          {/* Session ID */}
          {sessionId && <RunIdBadge id={sessionId} type="session" />}

          {/* Device */}
          {deviceName && (
            <Badge
              variant="secondary"
              appearance="outline"
              size="xs"
              className="gap-1"
            >
              <Smartphone className="size-3" />
              {deviceName}
            </Badge>
          )}

          {/* Preset */}
          {presetName && (
            <Badge variant="secondary" appearance="outline" size="xs">
              {presetName}
            </Badge>
          )}

          <div className="flex-1" />

          {/* Event count */}
          <Badge
            variant="secondary"
            appearance="outline"
            size="xs"
            className="gap-1 font-mono"
          >
            <Hash className="size-3" />
            {events.length.toLocaleString('en-US')} events
          </Badge>

          {/* Elapsed */}
          {isCapturing && (
            <Badge
              variant="secondary"
              appearance="outline"
              size="xs"
              className="gap-1 font-mono"
            >
              <Clock className="size-3" />
              {elapsed}
            </Badge>
          )}

          {/* Controls */}
          {isCapturing && (
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                onClick={onPause}
                title={
                  captureState === 'paused' ? 'Resume' : 'Pause'
                }
              >
                {captureState === 'paused' ? (
                  <Play className="size-3.5 text-green-600" />
                ) : (
                  <Pause className="size-3.5 text-amber-600" />
                )}
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="size-7"
                onClick={onStop}
                title="Stop"
              >
                <Square className="size-3.5 text-red-600" />
              </Button>
            </div>
          )}
        </div>

        {/* ── Marker input ───────────────────────────────────────── */}
        {isCapturing && (
          <div className="flex items-center gap-2 border-t bg-muted/20 px-4 py-1.5">
            <Flag className="size-3.5 text-muted-foreground" />
            <Input
              value={markerInput}
              onChange={(e) => setMarkerInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAddMarkerSubmit()}
              placeholder="Marker label…"
              className="h-6 flex-1 text-xs border-0 bg-transparent shadow-none focus-visible:ring-0"
            />
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[11px]"
              onClick={handleAddMarkerSubmit}
              disabled={!markerInput.trim()}
            >
              Add Marker
            </Button>
          </div>
        )}

        {/* ── View tabs + search ──────────────────────────────────── */}
        <div className="flex items-center gap-2 border-t px-4 py-1.5">
          <div className="flex items-center gap-0.5 rounded-md bg-muted/50 p-0.5">
            <button
              onClick={() => onLogView('timeline')}
              className={cn(
                'rounded px-2 py-0.5 text-[11px] font-medium transition-colors',
                logView === 'timeline'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Rows3 className="inline size-3 mr-1" />
              Timeline
            </button>
            <button
              onClick={() => onLogView('raw')}
              className={cn(
                'rounded px-2 py-0.5 text-[11px] font-medium transition-colors',
                logView === 'raw'
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <AlignLeft className="inline size-3 mr-1" />
              Raw Logs
            </button>
          </div>

          <div className="flex-1" />

          <div className="relative">
            <Search className="absolute left-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search…"
              className="h-6 w-48 pl-7 text-xs"
            />
            {searchQuery && (
              <button
                onClick={() => onSearch('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2"
              >
                <X className="size-3 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* ── Filter chips ───────────────────────────────────────── */}
        {activeFilters.length > 0 && activeFilters.length <= 8 && (
          <div className="flex flex-wrap items-center gap-1 border-t px-4 py-1.5">
            <span className="text-[10px] text-muted-foreground mr-1">
              Filters:
            </span>
            {activeFilters.slice(0, 8).map((f, i) => (
              <Badge
                key={`${f.type}-${i}`}
                variant="secondary"
                appearance="outline"
                size="xs"
                className={cn(
                  'text-[9px]',
                  f.type === 'source' &&
                    'border-blue-200 dark:border-blue-800',
                  f.type === 'level' &&
                    'border-amber-200 dark:border-amber-800',
                  f.type === 'search' &&
                    'border-purple-200 dark:border-purple-800',
                )}
              >
                {f.label}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* ── Timeline View ────────────────────────────────────────── */}
      {logView === 'timeline' && (
        <ScrollArea className="h-[calc(100vh-420px)]">
          <div className="divide-y divide-border/50">
            {timelineItems.length === 0 && (
              <div className="flex items-center justify-center py-12 text-xs text-muted-foreground">
                No events match the filter.
              </div>
            )}
            {timelineItems.map((item, idx) => {
              if (item.type === 'marker') {
                const marker = item.data as LogMarker
                return (
                  <motion.div
                    key={marker.id}
                    className="flex items-center gap-2 bg-purple-50/40 px-4 py-1.5 dark:bg-purple-950/20"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.2, ease: EASE }}
                  >
                    <Flag className="size-3 text-purple-500" />
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {fmtTime(marker.timestamp)}
                    </span>
                    <span className="text-[11px] font-semibold text-purple-700 dark:text-purple-300">
                      {marker.label}
                    </span>
                    {marker.linkedRunId && (
                      <RunIdBadge id={marker.linkedRunId} />
                    )}
                  </motion.div>
                )
              }

              const event = item.data as LogEvent
              const levelMeta = LOG_LEVEL_META[event.level]
              const sourceMeta = LOG_SOURCE_META[event.source]
              const isSelected = selectedEvent?.id === event.id
              const rowBg = LEVEL_ROW_BG[event.level] ?? ''

              return (
                <motion.div
                  key={event.id}
                  onClick={() => onSelectEvent(event)}
                  className={cn(
                    'flex items-start gap-2 px-4 py-1.5 cursor-pointer transition-all hover:bg-muted/40',
                    rowBg,
                    isSelected &&
                      'ring-2 ring-purple-400 ring-inset bg-purple-50/40 dark:bg-purple-950/20',
                  )}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.15,
                    delay: Math.min(idx * 0.005, 0.3),
                    ease: EASE,
                  }}
                >
                  {/* Timestamp */}
                  <span className="w-24 shrink-0 font-mono text-[10px] text-muted-foreground pt-0.5">
                    {fmtTime(event.timestamp)}
                  </span>

                  {/* Source dot + badge */}
                  <span className="flex items-center gap-1 w-20 shrink-0 pt-0.5">
                    <span
                      className={cn(
                        'size-1.5 rounded-full shrink-0',
                        SOURCE_DOT_CLASS[sourceMeta?.tone ?? 'gray'],
                      )}
                    />
                    <span className="text-[10px] font-medium text-muted-foreground truncate">
                      {sourceMeta?.label ?? event.source}
                    </span>
                  </span>

                  {/* Level */}
                  <span
                    className={cn(
                      'w-6 shrink-0 text-center text-[10px] font-bold pt-0.5',
                      toneIcon[levelMeta?.tone ?? 'gray'],
                    )}
                  >
                    {levelMeta?.shortLabel ?? event.level[0].toUpperCase()}
                  </span>

                  {/* Tag */}
                  <span className="w-28 shrink-0 truncate text-[10px] font-medium text-foreground/60 pt-0.5">
                    {event.tag}
                  </span>

                  {/* Message */}
                  <span className="flex-1 min-w-0 text-[11px] text-foreground/80 truncate pt-0.5">
                    {event.message}
                  </span>

                  {/* Expand indicator */}
                  <ChevronRight
                    className={cn(
                      'size-3 shrink-0 text-muted-foreground/50 mt-0.5 transition-transform',
                      isSelected && 'rotate-90 text-purple-500',
                    )}
                  />
                </motion.div>
              )
            })}
          </div>
        </ScrollArea>
      )}

      {/* ── Raw Logs View ────────────────────────────────────────── */}
      {logView === 'raw' && (
        <div>
          <div className="flex items-center gap-3 border-b bg-muted/20 px-4 py-1.5">
            <div className="flex items-center gap-1.5">
              <WrapText className="size-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">
                Word Wrap
              </span>
              <Switch
                checked={wrapRaw}
                onCheckedChange={setWrapRaw}
                className="scale-75"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <ArrowDown className="size-3 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">
                Follow
              </span>
              <Switch
                checked={followLive}
                onCheckedChange={setFollowLive}
                className="scale-75"
              />
            </div>
          </div>
          <ScrollArea className="h-[calc(100vh-420px)]">
            <pre
              className={cn(
                'p-4 text-[11px] leading-relaxed font-mono text-foreground/80',
                wrapRaw ? 'whitespace-pre-wrap' : 'whitespace-pre',
              )}
            >
              {MOCK_RAW_LOGS.split('\n').map((line, i) => (
                <span key={i} className="block hover:bg-muted/30 transition-colors">
                  <span className="inline-block w-8 select-none text-right text-muted-foreground/40 mr-3">
                    {i + 1}
                  </span>
                  <span
                    className={cn(
                      searchQuery &&
                        line
                          .toLowerCase()
                          .includes(searchQuery.toLowerCase()) &&
                        'bg-yellow-200/60 dark:bg-yellow-900/40',
                    )}
                  >
                    {line}
                  </span>
                </span>
              ))}
            </pre>
          </ScrollArea>
        </div>
      )}

      {/* ── Event Correlation Section ────────────────────────────── */}
      {events.length > 0 && (
        <div className="border-t">
          <CorrelationSection results={correlationResults} />
        </div>
      )}
    </motion.div>
  )
}

/* ── Correlation Section Sub-Component ──────────────────────────── */

function CorrelationSection({
  results,
}: {
  results: {
    rule: (typeof CORRELATION_RULES)[number]
    results: { event: string; found: boolean }[]
  }[]
}) {
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="bg-muted/20">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-xs font-semibold text-foreground/80 hover:bg-muted/30 transition-colors"
      >
        {expanded ? (
          <ChevronDown className="size-3.5" />
        ) : (
          <ChevronRight className="size-3.5" />
        )}
        Event Correlation
        <Badge variant="secondary" appearance="outline" size="xs" className="ml-1">
          {results.length} rules
        </Badge>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="space-y-3 px-4 pb-4">
              {results.map(({ rule, results: matchResults }) => {
                const foundCount = matchResults.filter((r) => r.found).length
                const total = matchResults.length
                const allFound = foundCount === total
                return (
                  <div
                    key={rule.id}
                    className="rounded-lg border bg-card p-3 space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      {allFound ? (
                        <Check className="size-3.5 text-green-600" />
                      ) : (
                        <AlertCircle className="size-3.5 text-amber-600" />
                      )}
                      <span className="text-xs font-semibold text-foreground">
                        {(rule as any).label ?? rule.name}
                      </span>
                      <Badge
                        variant="secondary"
                        appearance="outline"
                        size="xs"
                        className={cn(
                          'ml-auto font-mono',
                          allFound
                            ? 'text-green-700 dark:text-green-400'
                            : 'text-amber-700 dark:text-amber-400',
                        )}
                      >
                        {foundCount}/{total}
                      </Badge>
                    </div>

                    {/* Flow diagram */}
                    <div className="flex flex-wrap items-center gap-1">
                      {matchResults.map((mr, i) => (
                        <span key={mr.event} className="flex items-center gap-1">
                          <span
                            className={cn(
                              'rounded px-1.5 py-0.5 text-[10px] font-mono',
                              mr.found
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300'
                                : 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
                            )}
                          >
                            {mr.found ? '✓' : '✕'} {mr.event}
                          </span>
                          {i < matchResults.length - 1 && (
                            <span className="text-[10px] text-muted-foreground">
                              →
                            </span>
                          )}
                        </span>
                      ))}
                    </div>

                    {/* Analysis text */}
                    <div className="rounded-md bg-muted/30 px-3 py-2">
                      <p className="text-[11px] leading-relaxed text-foreground/70">
                        {(rule as any).description ?? rule.flow}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">
                          Confidence:
                        </span>
                        <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                          <div
                            className={cn(
                              'h-full rounded-full transition-all',
                              allFound
                                ? 'bg-green-500'
                                : foundCount >= total / 2
                                  ? 'bg-amber-500'
                                  : 'bg-red-500',
                            )}
                            style={{
                              width: `${(foundCount / total) * 100}%`,
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-muted-foreground">
                          {Math.round((foundCount / total) * 100)}%
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
