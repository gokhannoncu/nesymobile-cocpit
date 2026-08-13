'use client'

/**
 * ===========================================================================
 *  RUN LIVE STREAM — the browser half of the API's run live hub.
 *
 *  ## Why a socket and not a poll
 *
 *  The run detail page used to be a server-rendered snapshot with a badge that
 *  polled an unrelated endpoint and updated nothing. Watching a run therefore
 *  meant reloading, and a step that failed twenty seconds in was indistinguishable
 *  from a page that had simply gone quiet. The API already had socket.io; the run
 *  events just had nowhere to go.
 *
 *  ## Why events and a refetch, not events alone
 *
 *  Two things must stay true at once: the feed shows WHEN something happened, and
 *  the panels show WHAT IS TRUE NOW. Reconstructing the second from a stream of
 *  deltas would mean re-implementing the read model in the browser, and it would
 *  drift the moment either side changed. So the socket says "something moved" and
 *  the page re-reads the run detail — debounced, because a burst of evidence facts
 *  is one change from the panels' point of view.
 * ===========================================================================
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { io, type Socket } from 'socket.io-client'
import { API_BASE } from '../../services/api'
import { fetchVerdictRunDetail } from './client'
import type { RunDetailResult } from './types'

export type RunLiveEventKind =
  | 'RUN_STATUS'
  | 'STEP'
  | 'ACTION'
  | 'WAIT'
  | 'ORACLE'
  | 'EVIDENCE'
  | 'DEVICE'
  | 'INTERACTION'
  | 'RUN_RESULT'

export type RunLiveEventLevel = 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR'

export interface RunLiveEvent {
  seq: number
  runId: string
  atMs: number
  kind: RunLiveEventKind
  level: RunLiveEventLevel
  title: string
  detail: Record<string, unknown>
}

export type RunLiveStatus = 'connecting' | 'live' | 'reconnecting' | 'offline'

/** Newest kept in the browser. The API's own buffer is the same order of size. */
const MAX_EVENTS = 500
/** A burst of evidence facts is one change as far as the panels are concerned. */
const REFETCH_DEBOUNCE_MS = 400

/**
 * socket.io is mounted on the API server root, while `API_BASE` points at its
 * `/api` prefix. Deriving the origin rather than adding a second env var keeps
 * the two from being configured to different hosts.
 */
export function resolveSocketOrigin(apiBase: string = API_BASE): string {
  try {
    const url = new URL(apiBase, typeof window === 'undefined' ? 'http://localhost' : window.location.href)
    return url.origin
  } catch {
    return apiBase.replace(/\/api\/?$/, '')
  }
}

export interface RunLiveStream {
  status: RunLiveStatus
  events: readonly RunLiveEvent[]
  /** Latest run detail — the server-rendered snapshot until the first refetch. */
  detail: RunDetailResult
  /** Highest `seq` seen, so the badge can show that the stream is moving. */
  latestSeq: number
  /** True while a snapshot refetch triggered by an event is in flight. */
  refreshing: boolean
  /** Set when the run detail could not be re-read; the feed keeps working. */
  error: string | null
  refresh: () => void
}

export function useRunLiveStream(runId: string, initialDetail: RunDetailResult): RunLiveStream {
  const [status, setStatus] = useState<RunLiveStatus>('connecting')
  const [events, setEvents] = useState<readonly RunLiveEvent[]>([])
  const [detail, setDetail] = useState<RunDetailResult>(initialDetail)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Resume point for a reconnect, kept in a ref rather than state on purpose: a
   * reconnect must not depend on React having re-rendered, and the socket effect
   * must not be torn down and rebuilt on every event.
   */
  const lastSeqRef = useRef(0)
  const mountedRef = useRef(true)
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const readDetail = useCallback(async () => {
    setRefreshing(true)
    try {
      const next = await fetchVerdictRunDetail(runId)
      if (!mountedRef.current) return
      setDetail(next)
      setError(null)
    } catch (err) {
      if (!mountedRef.current) return
      // The feed is still the live truth here, so this is a warning about the
      // panels being stale — not a reason to blank the page.
      setError(err instanceof Error ? err.message : 'Run detail could not be refreshed')
    } finally {
      if (mountedRef.current) setRefreshing(false)
    }
  }, [runId])

  const scheduleRefetch = useCallback(() => {
    if (refetchTimerRef.current !== null) clearTimeout(refetchTimerRef.current)
    refetchTimerRef.current = setTimeout(() => {
      refetchTimerRef.current = null
      void readDetail()
    }, REFETCH_DEBOUNCE_MS)
  }, [readDetail])

  useEffect(() => {
    mountedRef.current = true
    lastSeqRef.current = 0

    const socket: Socket = io(resolveSocketOrigin(), {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5_000,
    })

    const absorb = (incoming: readonly RunLiveEvent[]): void => {
      const fresh = incoming.filter((event) => event.seq > lastSeqRef.current)
      if (fresh.length === 0) return
      lastSeqRef.current = Math.max(lastSeqRef.current, ...fresh.map((event) => event.seq))
      setEvents((current) => {
        const merged = [...current, ...fresh]
        return merged.length > MAX_EVENTS ? merged.slice(merged.length - MAX_EVENTS) : merged
      })
      scheduleRefetch()
    }

    const subscribe = (): void => {
      socket.emit('run:subscribe', { runId, afterSeq: lastSeqRef.current })
    }

    socket.on('connect', () => {
      if (!mountedRef.current) return
      setStatus('live')
      subscribe()
    })

    socket.on('run:subscribed', (payload: { runId?: string; events?: RunLiveEvent[] }) => {
      if (!mountedRef.current || payload.runId !== runId) return
      absorb(payload.events ?? [])
    })

    socket.on('run:event', (event: RunLiveEvent) => {
      if (!mountedRef.current || event.runId !== runId) return
      absorb([event])
    })

    socket.on('disconnect', () => {
      if (mountedRef.current) setStatus('reconnecting')
    })

    socket.on('connect_error', () => {
      // Reported as offline rather than reconnecting: socket.io keeps retrying,
      // but an operator staring at a still page needs to know the stream is not
      // up rather than that it is "about to be".
      if (mountedRef.current) setStatus('offline')
    })

    return () => {
      mountedRef.current = false
      if (refetchTimerRef.current !== null) clearTimeout(refetchTimerRef.current)
      socket.emit('run:unsubscribe', { runId })
      socket.removeAllListeners()
      socket.disconnect()
    }
  }, [runId, scheduleRefetch])

  // Navigating to a different run must start from that run's server-rendered
  // snapshot. Keyed on the run id rather than the prop: the snapshot object gets
  // a new identity on every parent render, and adopting it then would throw away
  // everything this hook has since read.
  const shownRunIdRef = useRef(runId)
  useEffect(() => {
    if (shownRunIdRef.current === runId) return
    shownRunIdRef.current = runId
    setDetail(initialDetail)
    setEvents([])
  }, [runId, initialDetail])

  const latestSeq = useMemo(() => events.at(-1)?.seq ?? 0, [events])

  return {
    status,
    events,
    detail,
    latestSeq,
    refreshing,
    error,
    refresh: () => {
      void readDetail()
    },
  }
}
