// GET /api/adb/network/stream?serial=XXX — Server-Sent Events stream of live
// OkHttp transactions parsed from `adb logcat`. Starts with a short backfill
// (last ~800 OkHttpLog lines) and then follows new traffic in real time.

import { spawn } from 'node:child_process'
import type { NextRequest } from 'next/server'
import { resolveAdbPath } from '@/lib/server/adb'
import { createOkHttpLogParser } from '@/lib/server/okhttp-log-parser'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const HEARTBEAT_MS = 15_000

export async function GET(req: NextRequest) {
  const serial = req.nextUrl.searchParams.get('serial')
  if (!serial || !/^[\w.:-]+$/.test(serial)) {
    return Response.json({ error: 'Valid serial parameter is required' }, { status: 400 })
  }
  const bin = resolveAdbPath()
  if (!bin) {
    return Response.json({ error: 'adb binary not found' }, { status: 503 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false
      const child = spawn(bin, [
        '-s',
        serial,
        'logcat',
        '-v',
        'epoch',
        '-T',
        '800',
        'OkHttpLog:D',
        '*:S',
      ])

      const send = (payload: string) => {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(payload))
        } catch {
          closed = true
        }
      }

      const parser = createOkHttpLogParser((txn) => {
        send(`data: ${JSON.stringify(txn)}\n\n`)
      })

      let buffer = ''
      child.stdout.on('data', (chunk: Buffer) => {
        buffer += chunk.toString('utf8')
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) parser.feed(line)
      })

      const heartbeat = setInterval(() => send(': heartbeat\n\n'), HEARTBEAT_MS)

      const shutdown = () => {
        if (closed) return
        closed = true
        clearInterval(heartbeat)
        child.kill('SIGTERM')
        try {
          controller.close()
        } catch {
          // already closed by the runtime
        }
      }

      child.on('close', shutdown)
      child.on('error', shutdown)
      req.signal.addEventListener('abort', shutdown)
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
