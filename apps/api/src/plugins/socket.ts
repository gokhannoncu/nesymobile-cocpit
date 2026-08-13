import type { Server as HttpServer } from 'node:http'
import { Server, type Socket } from 'socket.io'
import type { Env } from '../env.js'
import { getRunLiveHub, type RunLiveEvent } from '../services/run-live-hub.js'
import { startRunLiveWatcher, stopRunLiveWatcher } from '../services/run-live-watcher.js'

export type AppSocketServer = Server

/** Run ids are `run_<uuid>`; anything else must not become a room name. */
const RUN_ID_PATTERN = /^[\w.:-]{1,128}$/

function runRoom(runId: string): string {
  return `run:${runId}`
}

export function createSocketServer(httpServer: HttpServer, env: Env): AppSocketServer {
  const io = new Server(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
      methods: ['GET', 'POST'],
    },
  })

  io.on('connection', (socket) => {
    appLogger(socket.id, 'connected')
    attachRunLiveSubscriptions(socket)

    socket.on('ping', () => {
      socket.emit('pong', { at: new Date().toISOString() })
    })

    socket.on('disconnect', () => {
      appLogger(socket.id, 'disconnected')
    })
  })

  // One bridge for the whole server: the hub knows nothing about rooms, and the
  // room is the only thing that keeps one run's stream out of another's page.
  getRunLiveHub().onEvent((event: RunLiveEvent) => {
    io.to(runRoom(event.runId)).emit('run:event', event)
  })

  return io
}

/**
 * `run:subscribe` / `run:unsubscribe` for one socket.
 *
 * Replay is answered from the hub's buffer before any live event can arrive, so
 * a page that opens mid-run starts from the run's recent history rather than
 * from whatever happened to be emitted next. `afterSeq` makes a reconnect
 * resume instead of duplicating.
 *
 * Subscriptions are tracked per socket rather than read back off the room,
 * because a disconnect has to release exactly what this socket took — the DB
 * watcher is ref-counted, and a leaked reference means an API that polls a
 * finished run forever.
 */
function attachRunLiveSubscriptions(socket: Socket): void {
  const hub = getRunLiveHub()
  const subscribed = new Set<string>()

  const release = (runId: string): void => {
    if (!subscribed.delete(runId)) return
    void socket.leave(runRoom(runId))
    if (hub.removeSubscriber(runId) === 0) stopRunLiveWatcher(runId)
  }

  socket.on('run:subscribe', (payload: unknown) => {
    const runId = readRunId(payload)
    if (runId === null) {
      socket.emit('run:error', { detail: 'run:subscribe requires a valid runId' })
      return
    }
    const afterSeq = readAfterSeq(payload)

    if (!subscribed.has(runId)) {
      subscribed.add(runId)
      void socket.join(runRoom(runId))
      hub.addSubscriber(runId)
      startRunLiveWatcher(runId)
    }

    socket.emit('run:subscribed', {
      runId,
      latestSeq: hub.latestSeq(runId),
      events: hub.replay(runId, afterSeq),
    })
  })

  socket.on('run:unsubscribe', (payload: unknown) => {
    const runId = readRunId(payload)
    if (runId !== null) release(runId)
  })

  socket.on('disconnect', () => {
    for (const runId of [...subscribed]) release(runId)
  })
}

function readRunId(payload: unknown): string | null {
  const raw =
    typeof payload === 'string'
      ? payload
      : typeof payload === 'object' && payload !== null
        ? (payload as { runId?: unknown }).runId
        : undefined
  if (typeof raw !== 'string') return null
  const runId = raw.trim()
  return RUN_ID_PATTERN.test(runId) ? runId : null
}

function readAfterSeq(payload: unknown): number {
  if (typeof payload !== 'object' || payload === null) return 0
  const raw = (payload as { afterSeq?: unknown }).afterSeq
  return typeof raw === 'number' && Number.isFinite(raw) && raw >= 0 ? Math.trunc(raw) : 0
}

function appLogger(socketId: string, event: string) {
  console.log(`[socket.io] ${socketId} ${event}`)
}
