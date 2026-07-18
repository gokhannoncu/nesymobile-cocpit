// POST /api/adb/scenarios/run — execute an allowlisted ADB scenario.
// Streams Server-Sent Events: step / done / error.

import type { NextRequest } from 'next/server'
import { resolveAdbPath } from '@/lib/server/adb'
import { executeScenario, isScenarioExecutable } from '@/lib/server/adb-scenario-executor'
import { getAdbResolutionHint } from '@/lib/server/adb-path'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RunBody = {
  scenarioId?: string
  serial?: string
  params?: Record<string, unknown>
}

export async function POST(req: NextRequest) {
  if (!resolveAdbPath()) {
    return Response.json(
      { error: `adb binary not found. ${getAdbResolutionHint()}.` },
      { status: 503 },
    )
  }

  let body: RunBody
  try {
    body = (await req.json()) as RunBody
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const scenarioId = body.scenarioId?.trim()
  const serial = body.serial?.trim()
  if (!scenarioId || !isScenarioExecutable(scenarioId)) {
    return Response.json({ error: 'Unknown or missing scenarioId' }, { status: 400 })
  }
  if (!serial || !/^[\w.:-]+$/.test(serial)) {
    return Response.json({ error: 'Valid serial is required' }, { status: 400 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
      }
      try {
        for await (const event of executeScenario({
          scenarioId,
          serial,
          params: body.params ?? {},
        })) {
          send(event)
          if (event.type === 'error' || event.type === 'done') break
        }
      } catch (err) {
        send({
          type: 'error',
          message: err instanceof Error ? err.message : 'Scenario execution failed',
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
