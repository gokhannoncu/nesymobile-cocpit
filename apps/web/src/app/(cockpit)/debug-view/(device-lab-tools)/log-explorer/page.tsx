'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ScrollText,
  Radio,
  History,
  BookmarkCheck,
  Share2,
  HardDriveDownload,
  Loader2,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { Button } from '@nesy/metronic/components/ui/button'
import { ProductPage, EASE } from '@/components/product'
import { ToolHeader } from '@/components/engineering/tools/shared'
import { useDeviceLab } from '@/components/engineering/device-lab/device-lab-context'
import { EmptyPanelState } from '@/components/engineering/device-lab/device-lab-shared'
import { useLogCapture, type CaptureState } from '@/components/engineering/device-lab/use-log-capture'
import { CaptureSetup } from './capture-setup'
import { LogTimeline } from './log-timeline'
import { InsightDrawer } from './insight-drawer'
import { SavedSessions } from './saved-sessions'
import { SharedBundles } from './shared-bundles'
import { ShareBundleDialog } from './share-bundle'
import type {
  LogEvent,
  LogMarker,
  CapturePreset,
  LogSource,
  LogLevel,
  CaptureMode,
  TimeRange,
  LogCaptureConfig,
  SessionDeviceInfo,
  StoredLogSession,
  StoredLogBundle,
  BundleFormat,
  PrivacyRule,
} from '@/data/engineering/device-lab/device-lab-types'
import {
  getAllSessions,
  getAllBundles,
  getSession,
  getSessionEvents,
  deleteSession,
  deleteBundle,
  getBundle,
  putBundle,
  reconcileInterruptedSessions,
  pruneOlderThan,
  estimateStorage,
  pruneOldestSessions,
  type StorageEstimateResult,
} from '@/lib/log-store'
import { buildBundle, downloadBundle } from '@/lib/log-bundle'

const MAIN_TABS = [
  { key: 'live' as const, label: 'Live Capture', icon: Radio },
  { key: 'history' as const, label: 'Device History', icon: History },
  { key: 'saved' as const, label: 'Saved Sessions', icon: BookmarkCheck },
  { key: 'shared' as const, label: 'Diagnostic Bundles', icon: Share2 },
]
type MainTab = (typeof MAIN_TABS)[number]['key']

const HISTORY_RANGES: { value: TimeRange; label: string }[] = [
  { value: 'last-5m', label: 'Last 5 min' },
  { value: 'last-15m', label: 'Last 15 min' },
  { value: 'last-30m', label: 'Last 30 min' },
  { value: 'last-1h', label: 'Last 1 hour' },
]

/** Maps the rich capture state machine onto the narrow prop union the panels use. */
function narrowState(state: CaptureState): 'idle' | 'capturing' | 'paused' | 'stopped' {
  switch (state) {
    case 'connecting':
    case 'capturing':
    case 'stopping':
      return 'capturing'
    case 'view-paused':
      return 'paused'
    case 'stopped':
    case 'interrupted':
    case 'error':
      return 'stopped'
    default:
      return 'idle'
  }
}

function minutesForRange(range: TimeRange): number | null {
  switch (range) {
    case 'last-5m': return 5
    case 'last-15m': return 15
    case 'last-30m': return 30
    case 'last-1h': return 60
    case 'now': return 0
    default: return null
  }
}

function localInputToIso(value: string): string | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

export default function LogExplorerPage() {
  const { selectedDevice, bridgeConnected, activeRunId, setActiveRunId } = useDeviceLab()
  const capture = useLogCapture()
  const searchParams = useSearchParams()

  const [mainTab, setMainTab] = useState<MainTab>('live')

  // Capture configuration.
  const [selectedPreset, setSelectedPreset] = useState<CapturePreset | null>(null)
  const [selectedSources, setSelectedSources] = useState<LogSource[]>(['app', 'network', 'crash'])
  const [selectedLevels, setSelectedLevels] = useState<LogLevel[]>(['info', 'warn', 'error', 'fatal'])
  const [captureMode, setCaptureMode] = useState<CaptureMode>('quick')
  const [timeRange, setTimeRange] = useState<TimeRange>('now')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [contextFields, setContextFields] = useState<Record<string, string>>({})

  // Timeline display / viewer.
  const [selectedEvent, setSelectedEvent] = useState<LogEvent | null>(null)
  const [logView, setLogView] = useState<'timeline' | 'raw'>('timeline')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewer, setViewer] = useState<{ session: StoredLogSession; events: LogEvent[] } | null>(null)

  // Persisted lists.
  const [sessions, setSessions] = useState<StoredLogSession[]>([])
  const [bundles, setBundles] = useState<StoredLogBundle[]>([])

  // Export dialog.
  const [shareOpen, setShareOpen] = useState(false)
  const [exportTarget, setExportTarget] = useState<{ session: StoredLogSession; events: LogEvent[] } | null>(null)

  // Storage pressure.
  const [storage, setStorage] = useState<StorageEstimateResult | null>(null)

  const runApplied = useRef(false)

  const refreshLists = useCallback(async () => {
    const [s, b, est] = await Promise.all([getAllSessions(), getAllBundles(), estimateStorage()])
    setSessions(s)
    setBundles(b)
    setStorage(est)
  }, [])

  // One-time boot: recover interrupted sessions, apply retention, load lists.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      await reconcileInterruptedSessions()
      await pruneOlderThan()
      if (!cancelled) await refreshLists()
    })()
    return () => { cancelled = true }
  }, [refreshLists])

  // Carry the ADB run id from the URL into the context once.
  useEffect(() => {
    const run = searchParams.get('run')
    if (run && !runApplied.current) {
      runApplied.current = true
      setActiveRunId(run)
    }
  }, [searchParams, setActiveRunId])

  // Refresh lists whenever a capture reaches a terminal state.
  useEffect(() => {
    if (['stopped', 'interrupted', 'error'].includes(capture.state)) void refreshLists()
  }, [capture.state, refreshLists])

  const deviceInfo = useCallback((): SessionDeviceInfo | null => {
    if (!selectedDevice) return null
    return {
      serial: selectedDevice.serial,
      name: selectedDevice.name,
      androidVersion: selectedDevice.androidVersion,
      appVersion: selectedDevice.appVersion,
      packageName: null,
    }
  }, [selectedDevice])

  const buildConfig = useCallback(
    (mode: 'live' | 'buffer', rangeOverride?: TimeRange): LogCaptureConfig => {
      const serial = selectedDevice?.serial ?? ''
      const range = rangeOverride ?? timeRange
      let from: string | null = null
      let to: string | null = null
      if (range === 'custom') {
        from = localInputToIso(customFrom)
        to = localInputToIso(customTo)
      } else {
        const mins = minutesForRange(range)
        if (mins && mins > 0) from = new Date(Date.now() - mins * 60_000).toISOString()
      }
      // A buffer read needs a window; default to 30 min when none was chosen.
      if (mode === 'buffer' && !from) from = new Date(Date.now() - 30 * 60_000).toISOString()
      return {
        serial,
        mode,
        sources: selectedSources,
        levels: selectedLevels,
        timeRange: range,
        from,
        to,
        captureMode,
        presetId: selectedPreset?.id ?? null,
      }
    },
    [selectedDevice, timeRange, customFrom, customTo, selectedSources, selectedLevels, captureMode, selectedPreset],
  )

  const initialMarkers = useCallback((): LogMarker[] => {
    if (!activeRunId) return []
    return [{
      id: `marker-run-${activeRunId}`,
      timestamp: new Date().toISOString(),
      label: `${activeRunId} linked`,
      type: 'adb-run',
      linkedRunId: activeRunId,
    }]
  }, [activeRunId])

  const startCapture = useCallback(
    async (mode: 'live' | 'buffer', rangeOverride?: TimeRange) => {
      const device = deviceInfo()
      if (!device) return
      setViewer(null)
      setSelectedEvent(null)
      await capture.start({
        config: buildConfig(mode, rangeOverride),
        device,
        presetLabel: selectedPreset?.label ?? null,
        linkedRunId: activeRunId,
        initialMarkers: initialMarkers(),
      })
      setMainTab('live')
    },
    [deviceInfo, capture, buildConfig, selectedPreset, activeRunId, initialMarkers],
  )

  const handlePresetSelect = useCallback((preset: CapturePreset) => {
    setSelectedPreset(preset)
    setSelectedSources(preset.sources)
    setSelectedLevels(preset.levels)
    setCaptureMode(preset.captureMode)
  }, [])

  const handleOpenSession = useCallback(async (id: string) => {
    const session = await getSession(id)
    if (!session) return
    const events = await getSessionEvents(id)
    setViewer({ session, events })
    setSelectedEvent(null)
    setMainTab('live')
  }, [])

  const handleDeleteSession = useCallback(async (id: string) => {
    await deleteSession(id)
    if (viewer?.session.id === id) setViewer(null)
    await refreshLists()
  }, [viewer, refreshLists])

  const openExport = useCallback(async (id: string) => {
    const session = await getSession(id)
    if (!session) return
    const events = await getSessionEvents(id)
    setExportTarget({ session, events })
    setShareOpen(true)
  }, [])

  const handleCreateBundle = useCallback(
    async ({ format, privacyRules }: { format: BundleFormat; privacyRules: PrivacyRule[] }) => {
      if (!exportTarget) return
      const id = `${Date.now()}-${crypto.randomUUID()}`
      const bundle = buildBundle({
        session: exportTarget.session,
        events: exportTarget.events,
        privacyRules,
        format,
        id,
        createdAt: new Date().toISOString(),
      })
      await putBundle(bundle)
      downloadBundle(bundle)
      await refreshLists()
    },
    [exportTarget, refreshLists],
  )

  const handleDownloadBundle = useCallback(async (id: string) => {
    const bundle = await getBundle(id)
    if (bundle) downloadBundle(bundle)
  }, [])

  const handleDeleteBundle = useCallback(async (id: string) => {
    await deleteBundle(id)
    await refreshLists()
  }, [refreshLists])

  const handlePruneOldest = useCallback(async () => {
    await pruneOldestSessions(5)
    await refreshLists()
  }, [refreshLists])

  // What the timeline shows: an opened saved session, else the live capture.
  const displayEvents = viewer?.events ?? capture.events ?? []
  const displayMarkers = viewer?.session.markers ?? capture.markers ?? []
  const displayState = viewer ? 'stopped' : narrowState(capture.state)
  const displaySessionId = viewer ? viewer.session.id : capture.sessionId
  const displayDevice = viewer ? viewer.session.device : deviceInfo()
  const displayPreset = viewer ? viewer.session.presetLabel : (selectedPreset?.label ?? null)

  const filteredEvents = useMemo(() => {
    return displayEvents.filter((e) => {
      if (selectedSources.length > 0 && !selectedSources.includes(e.source)) return false
      if (selectedLevels.length > 0 && !selectedLevels.includes(e.level)) return false
      if (searchQuery) {
        const q = searchQuery.toLowerCase()
        return (
          e.message.toLowerCase().includes(q) ||
          e.tag.toLowerCase().includes(q) ||
          e.id.toLowerCase().includes(q) ||
          (e.shipmentId?.toLowerCase().includes(q) ?? false) ||
          (e.requestId?.toLowerCase().includes(q) ?? false)
        )
      }
      return true
    })
  }, [displayEvents, selectedSources, selectedLevels, searchQuery])

  const deviceReady = Boolean(selectedDevice && selectedDevice.status === 'connected' && bridgeConnected)
  const startDisabledReason = !bridgeConnected
    ? 'ADB bridge unavailable — connect a device or check adb.'
    : !selectedDevice
      ? 'No device selected.'
      : selectedDevice.status !== 'connected'
        ? `Device is ${selectedDevice.status.replace('-', ' ')} — cannot capture.`
        : null

  const canExportCurrent = Boolean(displaySessionId) && displayEvents.length > 0

  return (
    <ProductPage path="/debug-view/log-explorer">
      <ToolHeader
        path="/debug-view/log-explorer"
        icon={ScrollText}
        title="Device Log Explorer"
        lead="Capture, correlate, and create a shareable diagnostic package of application, network, offline queue, process, and device logs in a single session."
        tone="purple"
        badges={[
          { label: 'Live capture' },
          { label: 'Event correlation' },
          { label: 'Privacy redaction' },
          { label: 'Diagnostic bundles' },
        ]}
      />

      {/* Storage-pressure banner */}
      {storage?.overWarnThreshold && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <span className="flex items-center gap-2">
            <AlertTriangle className="size-4" />
            Local storage is {Math.round(storage.ratio * 100)}% full. Consider clearing the oldest sessions.
          </span>
          <Button size="xs" variant="outline" onClick={handlePruneOldest}>
            Clear 5 oldest
          </Button>
        </div>
      )}

      {/* Tab bar */}
      <motion.div
        className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1"
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.08, ease: EASE }}
      >
        {MAIN_TABS.map((tab) => {
          const Icon = tab.icon
          const active = mainTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setMainTab(tab.key)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                active ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className={cn('size-3.5 transition-colors', active ? 'text-purple-600 dark:text-purple-400' : 'text-muted-foreground')} />
              {tab.label}
            </button>
          )
        })}
      </motion.div>

      {/* Live Capture */}
      {mainTab === 'live' && (
        <motion.div
          className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[26fr_50fr_24fr]"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: EASE }}
        >
          <CaptureSetup
            captureState={displayState}
            captureMode={captureMode}
            onCaptureMode={setCaptureMode}
            selectedSources={selectedSources}
            onSources={setSelectedSources}
            selectedLevels={selectedLevels}
            onLevels={setSelectedLevels}
            selectedPreset={selectedPreset}
            onPresetSelect={handlePresetSelect}
            contextFields={contextFields}
            onContextFields={setContextFields}
            onStartCapture={() => void startCapture('live')}
            onStopCapture={() => void capture.stop()}
            timeRange={timeRange}
            onTimeRange={setTimeRange}
            customFrom={customFrom}
            onCustomFrom={setCustomFrom}
            customTo={customTo}
            onCustomTo={setCustomTo}
            onFetchBuffer={() => void startCapture('buffer')}
            startDisabled={!deviceReady}
            startDisabledReason={startDisabledReason}
          />
          <div className="space-y-2">
            {capture.state === 'connecting' && (
              <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                {capture.reconnectAttempt > 0 ? `Reconnecting (attempt ${capture.reconnectAttempt}/3)…` : 'Connecting to device…'}
              </div>
            )}
            {capture.state === 'interrupted' && (
              <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-[11px] text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                <AlertTriangle className="size-3.5" />
                Capture interrupted after 3 reconnect attempts. Partial session was saved.
              </div>
            )}
            {capture.error && capture.state === 'error' && (
              <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-[11px] text-red-700 dark:border-red-800 dark:bg-red-950/30 dark:text-red-300">
                {capture.error}
              </div>
            )}
            {viewer && (
              <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground">
                <span>Viewing saved session {viewer.session.id.slice(0, 21)} ({(viewer.events ?? []).length} events)</span>
                <Button size="xs" variant="ghost" onClick={() => setViewer(null)}>Close</Button>
              </div>
            )}
            <LogTimeline
              events={filteredEvents}
              markers={displayMarkers}
              captureState={displayState}
              sessionId={displaySessionId}
              logView={logView}
              onLogView={setLogView}
              searchQuery={searchQuery}
              onSearch={setSearchQuery}
              selectedEvent={selectedEvent}
              onSelectEvent={setSelectedEvent}
              onAddMarker={capture.addMarker}
              onPause={() => (capture.state === 'view-paused' ? capture.resumeView() : capture.pauseView())}
              onStop={() => void capture.stop()}
              selectedSources={selectedSources}
              selectedLevels={selectedLevels}
              deviceName={displayDevice?.name ?? ''}
              appVersion={displayDevice?.appVersion ?? ''}
              presetName={displayPreset}
            />
            {canExportCurrent && (
              <Button
                size="sm"
                variant="outline"
                className="w-full gap-2"
                onClick={() => displaySessionId && void openExport(displaySessionId)}
              >
                <HardDriveDownload className="size-3.5" />
                Create diagnostic bundle from this session
              </Button>
            )}
          </div>
          <InsightDrawer event={selectedEvent} events={displayEvents} onClose={() => setSelectedEvent(null)} />
        </motion.div>
      )}

      {/* Device History */}
      {mainTab === 'history' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: EASE }}
          className="rounded-xl border bg-card p-6"
        >
          <h3 className="text-sm font-semibold">Device log buffer</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Read the connected device&apos;s existing logcat ring buffer for a time window. Results open in the
            Live Capture timeline and are saved as a session. This never clears the device buffer.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {HISTORY_RANGES.map((r) => (
              <Button
                key={r.value}
                size="sm"
                variant="outline"
                disabled={!deviceReady}
                onClick={() => void startCapture('buffer', r.value)}
              >
                {r.label}
              </Button>
            ))}
          </div>
          {!deviceReady && startDisabledReason && (
            <p className="mt-3 text-[11px] text-amber-600 dark:text-amber-400">{startDisabledReason}</p>
          )}
        </motion.div>
      )}

      {/* Saved Sessions */}
      {mainTab === 'saved' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: EASE }}
        >
          <SavedSessions
            sessions={sessions}
            onOpen={(id) => void handleOpenSession(id)}
            onExport={(id) => void openExport(id)}
            onDelete={(id) => void handleDeleteSession(id)}
          />
        </motion.div>
      )}

      {/* Diagnostic Bundles */}
      {mainTab === 'shared' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: EASE }}
        >
          {bundles.length === 0 ? (
            <div className="rounded-xl border bg-card p-8">
              <EmptyPanelState
                icon={Share2}
                title="Diagnostic Bundles"
                description="Locally generated diagnostic packages appear here. Open a session and create a bundle."
              />
            </div>
          ) : (
            <SharedBundles
              bundles={bundles}
              onDownload={(id) => void handleDownloadBundle(id)}
              onDelete={(id) => void handleDeleteBundle(id)}
            />
          )}
        </motion.div>
      )}

      <ShareBundleDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        sessionId={exportTarget?.session.id ?? null}
        eventCount={exportTarget?.events.length ?? 0}
        onCreate={handleCreateBundle}
      />
    </ProductPage>
  )
}
