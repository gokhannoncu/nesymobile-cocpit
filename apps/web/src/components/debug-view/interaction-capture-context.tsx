'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useDebugView } from './debug-context'
import type { InteractionEvent, InteractionKind } from '@/data/debug-view/types'

export type InteractionStreamState = 'idle' | 'connecting' | 'live' | 'reconnecting'

export const MAX_STORED_INTERACTIONS = 2_000
const STORAGE_PREFIX = 'nesy:debug-interactions:'
const CLEARED_AT_PREFIX = 'nesy:debug-interactions-cleared-at:'
const INTERACTION_KINDS = new Set<InteractionKind>([
  'app',
  'screen',
  'click',
  'input',
  'scan',
  'network',
  'system',
  'error',
])

interface InteractionCaptureContextValue {
  events: InteractionEvent[]
  streamState: InteractionStreamState
  clear: () => void
}

const InteractionCaptureContext = createContext<InteractionCaptureContextValue | null>(null)

function isInteractionEvent(value: unknown): value is InteractionEvent {
  if (typeof value !== 'object' || value == null) return false
  const event = value as Partial<InteractionEvent>
  return (
    typeof event.id === 'string' &&
    typeof event.timestamp === 'string' &&
    typeof event.kind === 'string' &&
    INTERACTION_KINDS.has(event.kind as InteractionKind) &&
    typeof event.screen === 'string' &&
    typeof event.label === 'string'
  )
}

function readStored(serial: string): InteractionEvent[] {
  try {
    const clearedAt = Number(localStorage.getItem(`${CLEARED_AT_PREFIX}${serial}`) ?? 0)
    const value = JSON.parse(localStorage.getItem(`${STORAGE_PREFIX}${serial}`) ?? '[]') as unknown
    return Array.isArray(value)
      ? value
          .filter(isInteractionEvent)
          .filter((event) => Date.parse(event.timestamp) > clearedAt)
          .slice(0, MAX_STORED_INTERACTIONS)
      : []
  } catch {
    return []
  }
}

function persist(serial: string, events: InteractionEvent[]) {
  try {
    localStorage.setItem(
      `${STORAGE_PREFIX}${serial}`,
      JSON.stringify(events.slice(0, MAX_STORED_INTERACTIONS)),
    )
  } catch {
    // Capture remains live if browser storage is unavailable or full.
  }
}

function merge(previous: InteractionEvent[], event: InteractionEvent): InteractionEvent[] {
  return [event, ...previous.filter((item) => item.id !== event.id)]
    .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    .slice(0, MAX_STORED_INTERACTIONS)
}

export function InteractionCaptureProvider({ children }: { children: ReactNode }) {
  const { selectedDevice } = useDebugView()
  const serial = selectedDevice?.serial ?? null
  const [events, setEvents] = useState<InteractionEvent[]>([])
  const [streamState, setStreamState] = useState<InteractionStreamState>('idle')
  const clearedAtRef = useRef(0)

  // This provider is mounted by the shared Debug View layout. Its EventSource
  // therefore survives navigation between Overview, Screen State, Network,
  // Database and the interaction timeline itself.
  useEffect(() => {
    if (!serial) {
      setEvents([])
      setStreamState('idle')
      return
    }

    let active = true
    clearedAtRef.current = Number(localStorage.getItem(`${CLEARED_AT_PREFIX}${serial}`) ?? 0)
    setEvents(readStored(serial))
    setStreamState('connecting')
    const source = new EventSource(
      `/api/adb/interactions/stream?serial=${encodeURIComponent(serial)}`,
    )
    source.onopen = () => {
      if (active) setStreamState('live')
    }
    source.onerror = () => {
      if (active) setStreamState('reconnecting')
    }
    source.onmessage = (message) => {
      if (!active) return
      try {
        const event = JSON.parse(message.data) as unknown
        if (!isInteractionEvent(event)) return
        if (Date.parse(event.timestamp) <= clearedAtRef.current) return
        setEvents((previous) => {
          const next = merge(previous, event)
          persist(serial, next)
          return next
        })
      } catch {
        // Ignore malformed events; EventSource continues receiving new lines.
      }
    }

    return () => {
      active = false
      source.close()
    }
  }, [serial])

  const clear = useCallback(() => {
    setEvents([])
    if (serial) {
      const clearedAt = Date.now()
      clearedAtRef.current = clearedAt
      localStorage.removeItem(`${STORAGE_PREFIX}${serial}`)
      localStorage.setItem(`${CLEARED_AT_PREFIX}${serial}`, String(clearedAt))
    }
  }, [serial])

  const value = useMemo(() => ({ events, streamState, clear }), [events, streamState, clear])

  return <InteractionCaptureContext.Provider value={value}>{children}</InteractionCaptureContext.Provider>
}

export function useInteractionCapture(): InteractionCaptureContextValue {
  const context = useContext(InteractionCaptureContext)
  if (!context) {
    throw new Error('useInteractionCapture must be used within InteractionCaptureProvider')
  }
  return context
}
