// ============================================================================
// OkHttp logcat parser
// ============================================================================
// NesyMobile logs full OkHttp traffic (HttpLoggingInterceptor, level BODY)
// under the `OkHttpLog` tag. This stateful parser consumes `logcat -v epoch`
// lines and reconstructs complete request/response transactions, correlating
// request and response blocks by thread id (OkHttp logs both on the caller
// thread).
//
// Log block shape:
//   --> POST https://host/path[/]        ← request start
//   Header: value                        ← request headers
//   (blank)
//   {json body}                          ← request body (optional)
//   --> END POST (216-byte body)         ← request end
//   <-- 200 https://host/path (1488ms)   ← response start
//   header: value                        ← response headers
//   (blank)
//   {json body}                          ← response body
//   <-- END HTTP (1738-byte body)        ← response end
//   <-- HTTP FAILED: java.io.IOException ← failure instead of response

import type { HttpMethod, NetworkTransaction } from '@/data/debug-view/types'

const MAX_BODY_CHARS = 16_384
const SENSITIVE_HEADERS = new Set([
  'cookie',
  'proxy-authorization',
  'set-cookie',
  'x-api-key',
])

const STATUS_TEXT: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  204: 'No Content',
  301: 'Moved Permanently',
  302: 'Found',
  304: 'Not Modified',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  408: 'Request Timeout',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout',
}

// `-v epoch` line: "  1784122887.660 14985 15997 D OkHttpLog: <message>"
const LINE_RE = /^\s*(\d+\.\d+)\s+(\d+)\s+(\d+)\s+[VDIWEF]\s+OkHttpLog\s*:\s?(.*)$/

const REQUEST_START_RE = /^--> ([A-Z]+) (https?:\/\/\S+)(?:\s+(\S+))?$/
const REQUEST_END_RE = /^--> END [A-Z]+(?:\s+\((\d+)-byte body\))?/
const RESPONSE_START_RE = /^<-- (\d{3})(?:\s+([A-Za-z][A-Za-z ]*?))?\s+(https?:\/\/\S+)\s+\((\d+)ms/
const RESPONSE_END_RE = /^<-- END HTTP(?:\s+\((\d+)-byte body\))?/
const FAILURE_RE = /^<-- HTTP FAILED:\s*(.*)$/

type Phase = 'request-headers' | 'request-body' | 'awaiting-response' | 'response-headers' | 'response-body'

interface PendingTxn {
  phase: Phase
  startedAtMs: number
  method: string
  fullUrl: string
  requestHeaders: Record<string, string>
  requestBodyLines: string[]
  requestSizeBytes: number
  status: number | null
  totalMs: number
  responseHeaders: Record<string, string>
  responseBodyLines: string[]
  responseSizeBytes: number
}

function newPending(startedAtMs: number, method: string, fullUrl: string): PendingTxn {
  return {
    phase: 'request-headers',
    startedAtMs,
    method,
    fullUrl,
    requestHeaders: {},
    requestBodyLines: [],
    requestSizeBytes: 0,
    status: null,
    totalMs: 0,
    responseHeaders: {},
    responseBodyLines: [],
    responseSizeBytes: 0,
  }
}

function capBody(lines: string[]): string | null {
  if (lines.length === 0) return null
  const joined = lines.join('\n')
  return joined.length > MAX_BODY_CHARS ? `${joined.slice(0, MAX_BODY_CHARS)}\n… (truncated)` : joined
}

function parseHeaderLine(msg: string, target: Record<string, string>): boolean {
  const idx = msg.indexOf(': ')
  if (idx <= 0) return false
  const name = msg.slice(0, idx)
  target[name] = SENSITIVE_HEADERS.has(name.toLowerCase()) ? '[REDACTED]' : msg.slice(idx + 2)
  return true
}

/**
 * Creates a stateful parser. Feed it raw logcat lines; it invokes `onTransaction`
 * every time a complete (or failed) transaction is reconstructed.
 */
export function createOkHttpLogParser(onTransaction: (txn: NetworkTransaction) => void) {
  // One in-flight transaction per thread id.
  const pendingByTid = new Map<string, PendingTxn>()
  let counter = 0

  function finalize(tid: string, p: PendingTxn, error: string | null) {
    pendingByTid.delete(tid)
    counter += 1

    let host = ''
    let path = ''
    let scheme: 'https' | 'http' = 'https'
    try {
      const u = new URL(p.fullUrl)
      host = u.host
      path = u.pathname.replace(/^\//, '') + u.search
      scheme = u.protocol === 'http:' ? 'http' : 'https'
    } catch {
      host = p.fullUrl
    }

    const contentType = p.responseHeaders['content-type'] ?? p.responseHeaders['Content-Type'] ?? ''
    const correlationId =
      p.requestHeaders['X-Correlation-ID'] ??
      p.requestHeaders['x-correlation-id'] ??
      p.requestHeaders['CorrelationId'] ??
      ''

    onTransaction({
      id: `txn-${p.startedAtMs}-${tid}-${counter}`,
      startedAt: new Date(p.startedAtMs).toISOString(),
      method: p.method as HttpMethod,
      scheme,
      host,
      path,
      fullUrl: p.fullUrl,
      remoteIp: '',
      status: p.status,
      statusText: p.status != null ? (STATUS_TEXT[p.status] ?? '') : '',
      fromCache: false,
      requestSizeBytes: p.requestSizeBytes,
      responseSizeBytes: p.responseSizeBytes,
      protocol: 'h2',
      contentType,
      // The interceptor only logs total duration — segment breakdown is unknown.
      timing: {
        dnsMs: 0,
        connectMs: 0,
        tlsMs: 0,
        requestMs: 0,
        waitingMs: 0,
        responseMs: 0,
        totalMs: p.totalMs,
      },
      requestHeaders: p.requestHeaders,
      responseHeaders: p.responseHeaders,
      requestBody: capBody(p.requestBodyLines),
      responseBody: capBody(p.responseBodyLines),
      correlationId,
      initiator: 'OkHttp',
      error,
      retryOf: null,
    })
  }

  function feed(rawLine: string) {
    const m = rawLine.match(LINE_RE)
    if (!m) return
    const [, epoch = '0', , tid = '?', msg = ''] = m
    const atMs = Math.round(Number(epoch) * 1000)

    const reqStart = msg.match(REQUEST_START_RE)
    if (reqStart) {
      // A new request on a thread that still has an unfinished one: drop the stale one.
      pendingByTid.set(tid, newPending(atMs, reqStart[1] ?? 'GET', reqStart[2] ?? ''))
      return
    }

    const p = pendingByTid.get(tid)
    if (!p) return

    if (REQUEST_END_RE.test(msg)) {
      p.requestSizeBytes = Number(msg.match(REQUEST_END_RE)?.[1] ?? 0)
      p.phase = 'awaiting-response'
      return
    }

    const respStart = msg.match(RESPONSE_START_RE)
    if (respStart) {
      p.status = Number(respStart[1])
      p.totalMs = Number(respStart[4] ?? 0)
      p.phase = 'response-headers'
      return
    }

    const failure = msg.match(FAILURE_RE)
    if (failure) {
      finalize(tid, p, failure[1] ?? 'HTTP FAILED')
      return
    }

    if (RESPONSE_END_RE.test(msg)) {
      p.responseSizeBytes = Number(msg.match(RESPONSE_END_RE)?.[1] ?? 0)
      finalize(tid, p, null)
      return
    }

    switch (p.phase) {
      case 'request-headers':
        if (msg === '') p.phase = 'request-body'
        else parseHeaderLine(msg, p.requestHeaders)
        break
      case 'request-body':
        p.requestBodyLines.push(msg)
        break
      case 'response-headers':
        if (msg === '') p.phase = 'response-body'
        else parseHeaderLine(msg, p.responseHeaders)
        break
      case 'response-body':
        p.responseBodyLines.push(msg)
        break
      case 'awaiting-response':
        // Interleaved noise between request end and response start — ignore.
        break
    }
  }

  return { feed }
}
