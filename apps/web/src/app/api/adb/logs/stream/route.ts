// GET /api/adb/logs/stream — Server-Sent Events stream of parsed logcat events.
//
// Query params:
//   serial   (required)  device serial, whitelisted /^[\w.:-]+$/
//   mode     live|buffer live follows new lines; buffer dumps a window & closes
//   from     ISO         backfill/window start (omit for live-only)
//   to       ISO         window end for a custom buffer read (buffer mode)
//   sources  csv         LogSource filter (omit = all)
//   levels   csv         LogLevel filter (omit = all)
//
// Emits typed LogStreamEnvelope objects on the default SSE channel. Never runs
// `logcat -c`; the child process is killed on client abort or device detach.

import { spawn } from 'node:child_process'
import type { NextRequest } from 'next/server'
import { resolveAdbPath, getAppIdentity } from '@/lib/server/adb'
import {
  createLogcatParser,
  minLevelLetter,
} from '@/lib/server/logcat-log-parser'
import type {
  LogLevel,
  LogSource,
  LogStreamEnvelope,
} from '@/data/engineering/device-lab/device-lab-types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const HEARTBEAT_MS = 15_000

const VALID_SOURCES: ReadonlySet<string> = new Set<LogSource>([
  'app', 'system', 'network', 'okhttp', 'offline-queue', 'fiscal', 'scanner',
  'location', 'payment', 'crash', 'workmanager', 'firebase', 'room',
])
const VALID_LEVELS: ReadonlySet<string> = new Set<LogLevel>([
  'verbose', 'debug', 'info', 'warn', 'error', 'fatal',
])

/** Parses a whitelisted CSV enum param. Unknown values are dropped. */
function csvEnum(raw: string | null, valid: ReadonlySet<string>): string[] {
  if (!raw) return []
  return raw.split(',').map((s) => s.trim()).filter((s) => valid.has(s))
}

/** ISO → logcat `-T` time spec ("MM-DD HH:MM:SS.mmm", device-local). */
function isoToLogcatTime(iso: string): string | null {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const p = (n: number, w = 2) => String(n).padStart(w, '0')
  return (
    `${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`
  )
}

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams
  const serial = sp.get('serial')
  if (!serial || !/^[\w.:-]+$/.test(serial)) {
    return Response.json({ error: 'Valid serial parameter is required' }, { status: 400 })
  }
  const bin = resolveAdbPath()
  if (!bin) {
    return Response.json({ error: 'adb binary not found' }, { status: 503 })
  }

  const mode = sp.get('mode') === 'buffer' ? 'buffer' : 'live'
  const fromIso = sp.get('from')
  const toIso = sp.get('to')
  const sources = csvEnum(sp.get('sources'), VALID_SOURCES) as LogSource[]
  const levels = csvEnum(sp.get('levels'), VALID_LEVELS) as LogLevel[]
  const toMs = toIso ? new Date(toIso).getTime() : null

  // `-T` spec: a time when a start is given, otherwise "1" (tail, live-only).
  const fromSpec = fromIso ? isoToLogcatTime(fromIso) : null
  const tSpec = fromSpec ?? '1'
  const levelLetter = minLevelLetter(levels)

  const args = ['-s', serial, 'logcat', '-v', 'epoch,uid', '-T', tSpec]
  if (mode === 'buffer') args.push('-d') // dump then exit
  args.push(`*:${levelLetter}`)

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false
      let total = 0
      let lastTimestamp: string | null = null

      const send = (envelope: LogStreamEnvelope) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(envelope)}\n\n`))
        } catch {
          closed = true
        }
      }
      const sendComment = (c: string) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`: ${c}\n\n`))
        } catch {
          closed = true
        }
      }

      // Resolve app identity first so the parser can classify by uid.
      let appUid: number | null = null
      let packageName: string | null = null
      try {
        const id = await getAppIdentity(serial)
        appUid = id.uid
        packageName = id.packageName
      } catch {
        // Non-fatal: without the uid, app lines fall back to `system`.
      }

      send({ type: 'ready', serial, packageName, uid: appUid, startedAt: new Date().toISOString() })

      const parser = createLogcatParser(
        { appUid, packageName, sources, levels },
        (event) => {
          if (toMs != null && event.epochMs > toMs) return
          total += 1
          lastTimestamp = event.timestamp
          send({ type: 'log', event })
        },
      )

      const child = spawn(bin, args)

      let buffer = ''
      child.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf8')
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) parser.feed(line)
      })

      let stderr = ''
      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString('utf8')
      })

      const heartbeat = setInterval(() => sendComment('heartbeat'), HEARTBEAT_MS)

      const shutdown = (reason: string, isError = false) => {
        if (closed) return
        clearInterval(heartbeat)
        // Flush the trailing partial line and any buffered crash event.
        if (buffer.trim()) parser.feed(buffer)
        parser.flush()
        if (isError) {
          send({
            type: 'error',
            code: 'stream_failed',
            message: stderr.trim() || reason,
            retryable: true,
          })
        } else {
          send({ type: 'complete', reason, total, lastTimestamp })
        }
        closed = true
        child.kill('SIGTERM')
        try {
          controller.close()
        } catch {
          // already closed by the runtime
        }
      }

      child.on('close', () => shutdown(mode === 'buffer' ? 'buffer-complete' : 'process-exit'))
      child.on('error', () => shutdown('spawn-error', true))
      req.signal.addEventListener('abort', () => {
        if (closed) return
        clearInterval(heartbeat)
        closed = true
        child.kill('SIGTERM')
        try {
          controller.close()
        } catch {
          // client already gone
        }
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
