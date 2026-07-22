// POST /api/adb/install-latest — SSE progress: GetLatestVersion → download → adb install -r

import {
  InstallLatestError,
  installLatestForCountry,
  parseInstallLatestInput,
  type InstallLatestErrorCode,
} from '@/lib/server/adb-install-latest'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

function statusForCode(code: InstallLatestErrorCode): number {
  switch (code) {
    case 'INVALID_INPUT':
    case 'NO_DEVICE':
    case 'MULTIPLE_DEVICES':
      return 400
    case 'NO_ADB':
      return 503
    case 'VERSION_FETCH_FAILED':
    case 'NO_DOWNLOAD_URL':
    case 'DOWNLOAD_FAILED':
      return 502
    case 'INSTALL_FAILED':
      return 500
    default:
      return 500
  }
}

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return Response.json(
      { ok: false, code: 'INVALID_INPUT', message: 'Geçersiz JSON gövdesi' },
      { status: 400 },
    )
  }

  let input
  try {
    input = parseInstallLatestInput(body)
  } catch (err) {
    if (err instanceof InstallLatestError) {
      return Response.json(
        { ok: false, code: err.code, message: err.message },
        { status: statusForCode(err.code) },
      )
    }
    return Response.json(
      { ok: false, code: 'INVALID_INPUT', message: 'Geçersiz istek' },
      { status: 400 },
    )
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
      }
      try {
        const result = await installLatestForCountry(input, (event) => send(event))
        send({ type: 'done', result })
      } catch (err) {
        if (err instanceof InstallLatestError) {
          send({ type: 'error', code: err.code, message: err.message })
        } else {
          send({
            type: 'error',
            code: 'INSTALL_FAILED',
            message: err instanceof Error ? err.message : 'Kurulum başarısız',
          })
        }
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
