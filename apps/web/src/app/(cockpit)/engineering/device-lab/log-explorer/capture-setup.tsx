'use client'

import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Zap,
  AppWindow,
  GitBranch,
  Bug,
  Scan,
  Settings,
  Play,
  Square,
  Timer,
  Package,
  User,
  Calendar,
  Send,
  Receipt,
  AlertTriangle,
  Ticket,
  Siren,
  ChevronDown,
  ChevronRight,
  HardDriveDownload,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Button } from '@nesy/metronic/components/ui/button'
import { Badge } from '@nesy/metronic/components/ui/badge'
import { Checkbox } from '@nesy/metronic/components/ui/checkbox'
import { Input } from '@nesy/metronic/components/ui/input'
import { ScrollArea } from '@nesy/metronic/components/ui/scroll-area'
import { Separator } from '@nesy/metronic/components/ui/separator'
import { EASE, toneIcon } from '@/components/product'
import type {
  CapturePreset,
  LogSource,
  LogLevel,
  CaptureMode,
} from '@/data/engineering/device-lab/device-lab-types'
import {
  CAPTURE_PRESETS,
  CAPTURE_MODE_META,
  LOG_SOURCE_META,
  LOG_LEVEL_META,
  TIME_RANGE_OPTIONS,
  INVESTIGATION_CONTEXT_FIELDS,
} from '@/data/engineering/device-lab/log-presets'

/* ─────────────────── Icon map for capture modes ──────────────────── */

const MODE_ICON: Record<CaptureMode, LucideIcon> = {
  quick: Zap,
  'app-session': AppWindow,
  'specific-flow': GitBranch,
  'crash-anr': Bug,
  'full-diagnostic': Scan,
  custom: Settings,
}

/* ─────────────────── Icon map for context fields ─────────────────── */

const CONTEXT_ICON: Record<string, LucideIcon> = {
  Package,
  User,
  Calendar,
  Send,
  Receipt,
  AlertTriangle,
  Ticket,
  Siren,
}

/* ──────────────────────────── Props ──────────────────────────────── */

interface CaptureSetupProps {
  captureState: 'idle' | 'capturing' | 'paused' | 'stopped'
  captureMode: CaptureMode
  onCaptureMode: (mode: CaptureMode) => void
  selectedSources: LogSource[]
  onSources: (sources: LogSource[]) => void
  selectedLevels: LogLevel[]
  onLevels: (levels: LogLevel[]) => void
  selectedPreset: CapturePreset | null
  onPresetSelect: (preset: CapturePreset) => void
  contextFields: Record<string, string>
  onContextFields: (fields: Record<string, string>) => void
  onStartCapture: () => void
  onStopCapture: () => void
}

/* ─────────────────── Elapsed Timer Hook ──────────────────────────── */

function useElapsedTimer(active: boolean) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!active) {
      setElapsed(0)
      return
    }
    const start = Date.now()
    const iv = setInterval(() => setElapsed(Date.now() - start), 1000)
    return () => clearInterval(iv)
  }, [active])

  const mins = Math.floor(elapsed / 60000)
  const secs = Math.floor((elapsed % 60000) / 1000)
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

/* ──────────────────── Collapsible Section ────────────────────────── */

function CollapsibleSection({
  title,
  defaultOpen = true,
  children,
}: {
  title: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-1.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
      >
        {open ? (
          <ChevronDown className="size-3" />
        ) : (
          <ChevronRight className="size-3" />
        )}
        {title}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="pt-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ──────────────────────── Main Component ─────────────────────────── */

export function CaptureSetup({
  captureState,
  captureMode,
  onCaptureMode,
  selectedSources,
  onSources,
  selectedLevels,
  onLevels,
  selectedPreset,
  onPresetSelect,
  contextFields,
  onContextFields,
  onStartCapture,
  onStopCapture,
}: CaptureSetupProps) {
  const isCapturing =
    captureState === 'capturing' || captureState === 'paused'
  const elapsed = useElapsedTimer(captureState === 'capturing')

  const allSources = useMemo(
    () => Object.keys(LOG_SOURCE_META) as LogSource[],
    [],
  )
  const allLevels = useMemo(
    () => Object.keys(LOG_LEVEL_META) as LogLevel[],
    [],
  )

  const toggleSource = (s: LogSource) => {
    if (isCapturing) return
    onSources(
      selectedSources.includes(s)
        ? selectedSources.filter((x) => x !== s)
        : [...selectedSources, s],
    )
  }

  const toggleLevel = (l: LogLevel) => {
    onLevels(
      selectedLevels.includes(l)
        ? selectedLevels.filter((x) => x !== l)
        : [...selectedLevels, l],
    )
  }

  const updateContextField = (key: string, value: string) => {
    onContextFields({ ...contextFields, [key]: value })
  }

  return (
    <motion.aside
      className="space-y-3"
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4, delay: 0.15, ease: EASE }}
    >
      {/* ── Capture status indicator ─────────────────────────────── */}
      {isCapturing && (
        <motion.div
          className="flex items-center gap-3 rounded-xl border border-purple-200 bg-purple-50/60 p-3 dark:border-purple-900 dark:bg-purple-950/30"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: EASE }}
        >
          <span className="relative flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-purple-500 opacity-50" />
            <span className="relative inline-flex size-2.5 rounded-full bg-purple-600" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-purple-800 dark:text-purple-200">
              {captureState === 'paused' ? 'Paused' : 'Capture Active'}
            </p>
            <p className="text-[10px] text-purple-600 dark:text-purple-400">
              Elapsed time: {elapsed}
            </p>
          </div>
          <Timer className="size-4 text-purple-500" />
        </motion.div>
      )}

      {/* ── Panel card ───────────────────────────────────────────── */}
      <div className="rounded-xl border bg-card">
        <ScrollArea className="h-[calc(100vh-220px)]">
          <div className="space-y-4 p-4">
            {/* ── Capture Mode ───────────────────────────────────── */}
            <CollapsibleSection title="Capture Mode">
              <div className="grid grid-cols-2 gap-1.5">
                {(Object.keys(CAPTURE_MODE_META) as CaptureMode[]).map(
                  (mode) => {
                    const meta = CAPTURE_MODE_META[mode]
                    const Icon = MODE_ICON[mode]
                    const active = captureMode === mode
                    return (
                      <button
                        key={mode}
                        disabled={isCapturing}
                        onClick={() => onCaptureMode(mode)}
                        className={cn(
                          'flex flex-col items-start gap-1 rounded-lg border p-2.5 text-left transition-all',
                          active
                            ? 'border-purple-300 bg-purple-50/70 dark:border-purple-800 dark:bg-purple-950/40'
                            : 'border-transparent bg-muted/40 hover:bg-muted/70',
                          isCapturing && 'opacity-50 cursor-not-allowed',
                        )}
                      >
                        <Icon
                          className={cn(
                            'size-3.5',
                            active
                              ? 'text-purple-600 dark:text-purple-400'
                              : 'text-muted-foreground',
                          )}
                        />
                        <span
                          className={cn(
                            'text-[11px] font-semibold leading-tight',
                            active
                              ? 'text-purple-800 dark:text-purple-200'
                              : 'text-foreground/80',
                          )}
                        >
                          {meta.label}
                        </span>
                        <span className="text-[10px] leading-tight text-muted-foreground line-clamp-2">
                          {meta.description}
                        </span>
                      </button>
                    )
                  },
                )}
              </div>
            </CollapsibleSection>

            <Separator />

            {/* ── Time Range ─────────────────────────────────────── */}
            <CollapsibleSection title="Time Range" defaultOpen={false}>
              <div className="flex flex-wrap gap-1.5">
                {TIME_RANGE_OPTIONS.map((opt) => (
                  <Badge
                    key={opt.value}
                    variant="secondary"
                    appearance="outline"
                    size="sm"
                    className="cursor-pointer hover:bg-muted/80 transition-colors"
                  >
                    {opt.label}
                  </Badge>
                ))}
              </div>
            </CollapsibleSection>

            <Separator />

            {/* ── Source Selection ────────────────────────────────── */}
            <CollapsibleSection title="Log Sources">
              <div className="space-y-1">
                {allSources.map((source) => {
                  const meta = LOG_SOURCE_META[source]
                  const checked = selectedSources.includes(source)
                  return (
                    <label
                      key={source}
                      className={cn(
                        'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors cursor-pointer',
                        checked
                          ? 'bg-muted/60'
                          : 'hover:bg-muted/30',
                        isCapturing && 'opacity-60 pointer-events-none',
                      )}
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleSource(source)}
                        disabled={isCapturing}
                        className="size-3.5"
                      />
                      <span
                        className={cn(
                          'size-2 rounded-full',
                          {
                            'bg-blue-500': meta.tone === 'blue',
                            'bg-gray-400': meta.tone === 'gray',
                            'bg-teal-500': meta.tone === 'teal',
                            'bg-amber-500': meta.tone === 'amber',
                            'bg-purple-500': meta.tone === 'purple',
                            'bg-indigo-500': meta.tone === 'indigo',
                            'bg-green-500': meta.tone === 'green',
                            'bg-orange-500': meta.tone === 'orange',
                            'bg-red-500': meta.tone === 'red',
                          },
                        )}
                      />
                      <span className="text-foreground/80 flex-1">
                        {meta.label}
                      </span>
                      {checked && (
                        <span className="text-[10px] text-muted-foreground">
                          ✓
                        </span>
                      )}
                    </label>
                  )
                })}
              </div>
            </CollapsibleSection>

            <Separator />

            {/* ── Log Level Filter ───────────────────────────────── */}
            <CollapsibleSection title="Log Level">
              <div className="flex flex-wrap gap-1.5">
                {allLevels.map((level) => {
                  const meta = LOG_LEVEL_META[level]
                  const checked = selectedLevels.includes(level)
                  return (
                    <button
                      key={level}
                      onClick={() => toggleLevel(level)}
                      className={cn(
                        'flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-all',
                        checked
                          ? 'border-purple-300 bg-purple-50/60 text-purple-800 dark:border-purple-800 dark:bg-purple-950/40 dark:text-purple-200'
                          : 'border-transparent bg-muted/40 text-muted-foreground hover:bg-muted/70',
                      )}
                    >
                      <span
                        className={cn('text-[10px] font-bold', toneIcon[meta.tone])}
                      >
                        {meta.shortLabel}
                      </span>
                      {meta.label}
                    </button>
                  )
                })}
              </div>
            </CollapsibleSection>

            <Separator />

            {/* ── Capture Presets ─────────────────────────────────── */}
            <CollapsibleSection title="Capture Presets">
              <div className="space-y-1.5">
                {CAPTURE_PRESETS.map((preset) => {
                  const active = selectedPreset?.id === preset.id
                  return (
                    <button
                      key={preset.id}
                      disabled={isCapturing}
                      onClick={() => onPresetSelect(preset)}
                      className={cn(
                        'flex w-full items-start gap-2.5 rounded-lg border p-2.5 text-left transition-all',
                        active
                          ? 'border-purple-300 bg-purple-50/50 dark:border-purple-800 dark:bg-purple-950/30'
                          : 'border-transparent bg-muted/30 hover:bg-muted/60',
                        isCapturing && 'opacity-50 cursor-not-allowed',
                      )}
                    >
                      <div
                        className={cn(
                          'flex size-7 shrink-0 items-center justify-center rounded-lg mt-0.5',
                          active
                            ? 'bg-purple-100 dark:bg-purple-900/50'
                            : 'bg-muted',
                        )}
                      >
                        <span className="text-xs">
                          {preset.icon === 'LogIn'
                            ? '🔐'
                            : preset.icon === 'CalendarDays'
                              ? '📅'
                              : preset.icon === 'Truck'
                                ? '🚚'
                                : preset.icon === 'CreditCard'
                                  ? '💳'
                                  : preset.icon === 'CloudOff'
                                    ? '☁️'
                                    : preset.icon === 'ScanBarcode'
                                      ? '📱'
                                      : preset.icon === 'Lock'
                                        ? '🔒'
                                        : preset.icon === 'MapPin'
                                          ? '📍'
                                          : preset.icon === 'Bug'
                                            ? '🐛'
                                            : '🔍'}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'text-xs font-semibold leading-tight',
                            active
                              ? 'text-purple-800 dark:text-purple-200'
                              : 'text-foreground/80',
                          )}
                        >
                          {(preset as any).label ?? preset.name ?? preset.id}
                        </p>
                        <p className="mt-0.5 text-[10px] leading-snug text-muted-foreground line-clamp-2">
                          {preset.description}
                        </p>
                        <div className="mt-1 flex flex-wrap gap-0.5">
                          {preset.sources.slice(0, 3).map((s) => (
                            <Badge
                              key={s}
                              variant="secondary"
                              appearance="outline"
                              size="xs"
                              className="text-[9px]"
                            >
                              {LOG_SOURCE_META[s]?.label ?? s}
                            </Badge>
                          ))}
                          {preset.sources.length > 3 && (
                            <Badge
                              variant="secondary"
                              appearance="outline"
                              size="xs"
                              className="text-[9px]"
                            >
                              +{preset.sources.length - 3}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </CollapsibleSection>

            <Separator />

            {/* ── Investigation Context ──────────────────────────── */}
            <CollapsibleSection
              title="Investigation Context"
              defaultOpen={false}
            >
              <div className="space-y-2">
                {INVESTIGATION_CONTEXT_FIELDS.map((field) => {
                  const Icon = CONTEXT_ICON[field.icon] ?? Package
                  return (
                    <div key={field.key} className="flex items-center gap-2">
                      <Icon className="size-3.5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <label className="text-[10px] font-medium text-muted-foreground">
                          {field.label}
                        </label>
                        <Input
                          value={contextFields[field.key] ?? ''}
                          onChange={(e) =>
                            updateContextField(field.key, e.target.value)
                          }
                          placeholder={field.placeholder}
                          className="h-7 text-xs"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </CollapsibleSection>
          </div>
        </ScrollArea>

        {/* ── CTA Buttons ──────────────────────────────────────── */}
        <div className="border-t p-4 space-y-2">
          {isCapturing ? (
            <Button
              size="sm"
              variant="destructive"
              className="w-full gap-2"
              onClick={onStopCapture}
            >
              <Square className="size-3.5" />
              Stop Capture
            </Button>
          ) : (
            <Button
              size="sm"
              className="w-full gap-2 bg-purple-600 hover:bg-purple-700 text-white"
              onClick={onStartCapture}
            >
              <Play className="size-3.5" />
              Start Log Capture
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="w-full gap-2"
            disabled={isCapturing}
          >
            <HardDriveDownload className="size-3.5" />
            Fetch Device Buffer
          </Button>
        </div>
      </div>
    </motion.aside>
  )
}
