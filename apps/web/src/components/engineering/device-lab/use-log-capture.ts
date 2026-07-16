'use client'

// Live capture state machine for Device Log Explorer.
//
// Owns the SSE connection to /api/adb/logs/stream, the in-memory event ring
// (last 5000), chunked IndexedDB persistence (all events, 500 per chunk), the
// session lifecycle, markers, and bounded reconnection. "Pause view" pauses only
// the on-screen auto-follow — capture and persistence keep running.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  CHUNK_SIZE,
  patchSession,
  putChunk,
  putSession,
} from '@/lib/log-store'
import type {
  LogCaptureConfig,
  LogEvent,
  LogMarker,
  LogStreamEnvelope,
  SessionDeviceInfo,
  StoredLogSession,
} from '@/data/engineering/device-lab/device-lab-types'

export type CaptureState =
  | 'idle'
  | 'connecting'
  | 'capturing'
  | 'view-paused'
  | 'stopping'
  | 'stopped'
  | 'interrupted'
  | 'error'

/** Terminal states a capture can finalize into. */
type TerminalState = 'stopped' | 'interrupted' | 'error'

const MAX_MEMORY_EVENTS = 5000
const FLUSH_INTERVAL_MS = 1000
const RECONNECT_DELAYS = [1000, 2000, 5000]

export interface StartArgs {
  config: LogCaptureConfig
  device: SessionDeviceInfo
  presetLabel: string | null
  linkedRunId: string | null
  /** Optional initial marker (e.g. an ADB run link). */
  initialMarkers?: LogMarker[]
}

export interface LogCaptureApi {
  state: CaptureState
  events: LogEvent[]
  markers: LogMarker[]
  eventCount: number
  sessionId: string | null
  error: string | null
  reconnectAttempt: number
  start: (args: StartArgs) => Promise<void>
  stop: () => Promise<void>
  pauseView: () => void
  resumeView: () => void
  addMarker: (label: string) => void
  reset: () => void
}

function newSessionId(): string {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2)
  return `${Date.now()}-${uuid}`
}

export function useLogCapture(): LogCaptureApi {
  const [state, setState] = useState<CaptureState>('idle')
  const [events, setEvents] = useState<LogEvent[]>([])
  const [markers, setMarkers] = useState<LogMarker[]>([])
  const [eventCount, setEventCount] = useState(0)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reconnectAttempt, setReconnectAttempt] = useState(0)

  // Streaming internals kept in refs so they survive re-renders.
  const esRef = useRef<EventSource | null>(null)
  const sessionRef = useRef<StoredLogSession | null>(null)
  const seenIds = useRef<Set<string>>(new Set())
  const pendingChunk = useRef<LogEvent[]>([])
  const chunkIndex = useRef(0)
  const totalCount = useRef(0)
  const lastTimestamp = useRef<string | null>(null)
  const flushTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attempts = useRef(0)
  const markersRef = useRef<LogMarker[]>([])
  const stoppingRef = useRef(false)

  const persistChunk = useCallback(async () => {
    const sess = sessionRef.current
    if (!sess || pendingChunk.current.length === 0) return
    const idx = chunkIndex.current
    const events = pendingChunk.current.slice()
    await putChunk({ sessionId: sess.id, chunkIndex: idx, events })
    if (events.length >= CHUNK_SIZE) {
      chunkIndex.current += 1
      pendingChunk.current = []
    }
    await patchSession(sess.id, { eventCount: totalCount.current })
  }, [])

  const clearTimers = useCallback(() => {
    if (flushTimer.current) {
      clearInterval(flushTimer.current)
      flushTimer.current = null
    }
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current)
      reconnectTimer.current = null
    }
  }, [])

  const ingest = useCallback((event: LogEvent) => {
    if (seenIds.current.has(event.id)) return // reconnect dedup
    seenIds.current.add(event.id)
    totalCount.current += 1
    lastTimestamp.current = event.timestamp
    pendingChunk.current.push(event)
    if (pendingChunk.current.length >= CHUNK_SIZE) void persistChunk()
    setEvents((prev) => {
      const next = prev.length >= MAX_MEMORY_EVENTS ? prev.slice(prev.length - MAX_MEMORY_EVENTS + 1) : prev
      return [...next, event]
    })
    setEventCount(totalCount.current)
  }, [persistChunk])

  // Opens (or reopens) the SSE connection. `resume` reconnects from the last
  // seen timestamp instead of the configured start.
  const openStream = useCallback(
    (config: LogCaptureConfig, resume: boolean) => {
      const params = new URLSearchParams({ serial: config.serial, mode: config.mode })
      const from = resume && lastTimestamp.current ? lastTimestamp.current : config.from
      if (from) params.set('from', from)
      if (config.to) params.set('to', config.to)
      if (config.sources.length) params.set('sources', config.sources.join(','))
      if (config.levels.length) params.set('levels', config.levels.join(','))

      const es = new EventSource(`/api/adb/logs/stream?${params.toString()}`)
      esRef.current = es

      es.onmessage = (msg) => {
        let envelope: LogStreamEnvelope
        try {
          envelope = JSON.parse(msg.data) as LogStreamEnvelope
        } catch {
          return
        }
        switch (envelope.type) {
          case 'ready':
            attempts.current = 0
            setReconnectAttempt(0)
            setState((s) => (s === 'view-paused' ? s : 'capturing'))
            break
          case 'log':
            ingest(envelope.event)
            break
          case 'complete':
            void finalize('stopped')
            break
          case 'error':
            setError(envelope.message)
            if (!envelope.retryable) void finalize('error')
            break
        }
      }

      es.onerror = () => {
        es.close()
        esRef.current = null
        if (stoppingRef.current) return
        // Buffer mode completes via `complete`; an error there is terminal.
        if (config.mode === 'buffer') {
          void finalize('stopped')
          return
        }
        if (attempts.current >= RECONNECT_DELAYS.length) {
          void finalize('interrupted')
          return
        }
        const delay = RECONNECT_DELAYS[attempts.current] ?? 5000
        attempts.current += 1
        setReconnectAttempt(attempts.current)
        setState('connecting')
        reconnectTimer.current = setTimeout(() => openStream(config, true), delay)
      }
    },
    // finalize is declared below; it is stable via ref usage.
    [ingest],
  )

  const finalizeRef = useRef<(terminal: TerminalState) => Promise<void>>(undefined)

  const finalize = useCallback(async (terminal: TerminalState) => {
    return finalizeRef.current?.(terminal)
  }, [])

  finalizeRef.current = async (terminal: TerminalState) => {
    clearTimers()
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }
    await persistChunk()
    const sess = sessionRef.current
    if (sess) {
      await patchSession(sess.id, {
        // A crash/error mid-capture leaves the partial data as `interrupted`.
        status: terminal === 'stopped' ? 'stopped' : 'interrupted',
        stoppedAt: new Date().toISOString(),
        eventCount: totalCount.current,
        markers: markersRef.current,
      })
    }
    setState(terminal)
  }

  const start = useCallback(
    async (args: StartArgs) => {
      // Reset all streaming state.
      clearTimers()
      seenIds.current = new Set()
      pendingChunk.current = []
      chunkIndex.current = 0
      totalCount.current = 0
      lastTimestamp.current = null
      attempts.current = 0
      stoppingRef.current = false
      setEvents([])
      setEventCount(0)
      setError(null)
      setReconnectAttempt(0)

      const id = newSessionId()
      const startedAt = new Date().toISOString()
      const initialMarkers = args.initialMarkers ?? []
      const session: StoredLogSession = {
        id,
        device: args.device,
        config: args.config,
        status: 'capturing',
        startedAt,
        stoppedAt: null,
        eventCount: 0,
        markers: initialMarkers,
        context: {},
        presetId: args.config.presetId,
        presetLabel: args.presetLabel,
        linkedRunId: args.linkedRunId,
      }
      sessionRef.current = session
      markersRef.current = initialMarkers
      setMarkers(initialMarkers)
      setSessionId(id)
      await putSession(session)

      setState('connecting')
      flushTimer.current = setInterval(() => void persistChunk(), FLUSH_INTERVAL_MS)
      openStream(args.config, false)
    },
    [clearTimers, openStream, persistChunk],
  )

  const stop = useCallback(async () => {
    stoppingRef.current = true
    setState('stopping')
    await finalize('stopped')
  }, [finalize])

  const pauseView = useCallback(() => setState((s) => (s === 'capturing' ? 'view-paused' : s)), [])
  const resumeView = useCallback(() => setState((s) => (s === 'view-paused' ? 'capturing' : s)), [])

  const addMarker = useCallback((label: string) => {
    const marker: LogMarker = {
      id: `marker-${Date.now()}`,
      timestamp: lastTimestamp.current ?? new Date().toISOString(),
      label,
      type: 'user',
    }
    markersRef.current = [...markersRef.current, marker]
    setMarkers(markersRef.current)
    const sess = sessionRef.current
    if (sess) void patchSession(sess.id, { markers: markersRef.current })
  }, [])

  const reset = useCallback(() => {
    clearTimers()
    if (esRef.current) {
      esRef.current.close()
      esRef.current = null
    }
    stoppingRef.current = false
    sessionRef.current = null
    seenIds.current = new Set()
    pendingChunk.current = []
    chunkIndex.current = 0
    totalCount.current = 0
    lastTimestamp.current = null
    markersRef.current = []
    setEvents([])
    setMarkers([])
    setEventCount(0)
    setSessionId(null)
    setError(null)
    setReconnectAttempt(0)
    setState('idle')
  }, [clearTimers])

  // Clean up the stream on unmount.
  useEffect(() => {
    return () => {
      clearTimers()
      esRef.current?.close()
      esRef.current = null
    }
  }, [clearTimers])

  return {
    state,
    events,
    markers,
    eventCount,
    sessionId,
    error,
    reconnectAttempt,
    start,
    stop,
    pauseView,
    resumeView,
    addMarker,
    reset,
  }
}
