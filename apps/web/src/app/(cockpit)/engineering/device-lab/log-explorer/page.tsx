'use client'

import { useState, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  ScrollText,
  Radio,
  History,
  BookmarkCheck,
  Share2,
} from 'lucide-react'
import { cn } from '@nesy/metronic/lib/utils'
import { ProductPage } from '@/components/product'
import { EASE } from '@/components/product'
import { ToolHeader } from '@/components/engineering/tools/shared'
import { useDeviceLab } from '@/components/engineering/device-lab/device-lab-context'
import { EmptyPanelState } from '@/components/engineering/device-lab/device-lab-shared'
import { CaptureSetup } from './capture-setup'
import { LogTimeline } from './log-timeline'
import { InsightDrawer } from './insight-drawer'
import { SavedSessions } from './saved-sessions'
import type {
  LogEvent,
  LogMarker,
  CapturePreset,
  LogSource,
  LogLevel,
  CaptureMode,
} from '@/data/engineering/device-lab/device-lab-types'
import {
  MOCK_LOG_EVENTS,
  MOCK_SESSIONS,
} from '@/data/engineering/device-lab/log-presets'

/* ──────────────────────────── Tab definition ──────────────────────── */

const MAIN_TABS = [
  { key: 'live' as const, label: 'Live Capture', icon: Radio },
  { key: 'history' as const, label: 'Device History', icon: History },
  { key: 'saved' as const, label: 'Saved Sessions', icon: BookmarkCheck },
  { key: 'shared' as const, label: 'Shared Bundles', icon: Share2 },
]

type MainTab = (typeof MAIN_TABS)[number]['key']

/* ─────────────────────────── Page Component ──────────────────────── */

export default function LogExplorerPage() {
  const { selectedDevice, activeRunId } = useDeviceLab()

  /* ── Top-level tabs ─────────────────────────────────────────────── */
  const [mainTab, setMainTab] = useState<MainTab>('live')

  /* ── Capture state ──────────────────────────────────────────────── */
  const [captureState, setCaptureState] = useState<
    'idle' | 'capturing' | 'paused' | 'stopped'
  >('idle')
  const [selectedPreset, setSelectedPreset] = useState<CapturePreset | null>(
    null,
  )
  const [selectedSources, setSelectedSources] = useState<LogSource[]>([
    'app',
    'network',
    'crash',
  ])
  const [selectedLevels, setSelectedLevels] = useState<LogLevel[]>([
    'info',
    'warn',
    'error',
    'fatal',
  ])
  const [captureMode, setCaptureMode] = useState<CaptureMode>('quick')

  /* ── Log display state ──────────────────────────────────────────── */
  const [events, setEvents] = useState<LogEvent[]>([])
  const [selectedEvent, setSelectedEvent] = useState<LogEvent | null>(null)
  const [markers, setMarkers] = useState<LogMarker[]>([])
  const [logView, setLogView] = useState<'timeline' | 'raw'>('timeline')
  const [searchQuery, setSearchQuery] = useState('')
  const [contextFields, setContextFields] = useState<
    Record<string, string>
  >({})

  /* ── Session info ───────────────────────────────────────────────── */
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [, setSessionStartTime] = useState<string | null>(null)

  /* ── Handlers ───────────────────────────────────────────────────── */

  const handleStartCapture = useCallback(() => {
    const now = new Date()
    const id = `SESSION-2026-0712-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
    setSessionId(id)
    setSessionStartTime(now.toISOString())
    setCaptureState('capturing')
    setEvents(MOCK_LOG_EVENTS)

    // If there's an active ADB run, add automatic marker
    if (activeRunId) {
      setMarkers([
        {
          id: 'marker-auto-1',
          timestamp: now.toISOString(),
          label: `${activeRunId} linked`,
          type: 'adb-run',
          linkedRunId: activeRunId,
        },
      ])
    }
  }, [activeRunId])

  const handleStopCapture = useCallback(() => {
    setCaptureState('stopped')
  }, [])

  const handlePauseCapture = useCallback(() => {
    setCaptureState((prev) =>
      prev === 'paused' ? 'capturing' : 'paused',
    )
  }, [])

  const handleAddMarker = useCallback((label: string) => {
    setMarkers((prev) => [
      ...prev,
      {
        id: `marker-${Date.now()}`,
        timestamp: new Date().toISOString(),
        label,
        type: 'user' as const,
      },
    ])
  }, [])

  const handlePresetSelect = useCallback((preset: CapturePreset) => {
    setSelectedPreset(preset)
    setSelectedSources(preset.sources)
    setSelectedLevels(['info', 'warn', 'error', 'fatal'])
  }, [])

  /* ── Filtered events (memoised) ─────────────────────────────────── */
  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (selectedSources.length > 0 && !selectedSources.includes(e.source))
        return false
      if (selectedLevels.length > 0 && !selectedLevels.includes(e.level))
        return false
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
  }, [events, selectedSources, selectedLevels, searchQuery])

  /* ── Render ─────────────────────────────────────────────────────── */

  return (
    <ProductPage path="/engineering/device-lab/log-explorer">
      <ToolHeader
        path="/engineering/device-lab/log-explorer"
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

      {/* ── Top tab bar ──────────────────────────────────────────── */}
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
                active
                  ? 'bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon
                className={cn(
                  'size-3.5 transition-colors',
                  active
                    ? 'text-purple-600 dark:text-purple-400'
                    : 'text-muted-foreground',
                )}
              />
              {tab.label}
            </button>
          )
        })}
      </motion.div>

      {/* ── Live Capture: 3-column layout ────────────────────────── */}
      {mainTab === 'live' && (
        <motion.div
          className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[26fr_50fr_24fr]"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: EASE }}
        >
          <CaptureSetup
            captureState={captureState}
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
            onStartCapture={handleStartCapture}
            onStopCapture={handleStopCapture}
          />
          <LogTimeline
            events={filteredEvents}
            markers={markers}
            captureState={captureState}
            sessionId={sessionId}
            logView={logView}
            onLogView={setLogView}
            searchQuery={searchQuery}
            onSearch={setSearchQuery}
            selectedEvent={selectedEvent}
            onSelectEvent={setSelectedEvent}
            onAddMarker={handleAddMarker}
            onPause={handlePauseCapture}
            onStop={handleStopCapture}
            selectedSources={selectedSources}
            selectedLevels={selectedLevels}
            deviceName={selectedDevice?.name ?? ''}
            appVersion={selectedDevice?.appVersion ?? ''}
            presetName={(selectedPreset as any)?.label ?? selectedPreset?.name ?? null}
          />
          <InsightDrawer
            event={selectedEvent}
            events={events}
            onClose={() => setSelectedEvent(null)}
          />
        </motion.div>
      )}

      {/* ── Saved Sessions tab ───────────────────────────────────── */}
      {mainTab === 'saved' && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: EASE }}
        >
          <SavedSessions sessions={MOCK_SESSIONS} />
        </motion.div>
      )}

      {/* ── History / Shared placeholders ─────────────────────────── */}
      {(mainTab === 'history' || mainTab === 'shared') && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, ease: EASE }}
          className="rounded-xl border bg-card p-8"
        >
          <EmptyPanelState
            icon={mainTab === 'history' ? History : Share2}
            title={
              mainTab === 'history' ? 'Device History' : 'Shared Bundles'
            }
            description={
              mainTab === 'history'
                ? "Device logcat buffer and application log files are displayed here."
                : "Diagnostic packages sent to ticket or incident are listed here."
            }
          />
        </motion.div>
      )}
    </ProductPage>
  )
}
