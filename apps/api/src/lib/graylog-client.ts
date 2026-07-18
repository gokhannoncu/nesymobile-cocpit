import {
  isGraylogCountry,
  resolveGraylogBaseUrl,
  resolveGraylogToken,
  type GraylogCountry,
} from '../graylog-env.js'

const DEFAULT_LIMIT = 100
const MAX_LIMIT = 500

const TIME_RANGE_SECONDS: Record<string, number> = {
  '15m': 15 * 60,
  '1h': 60 * 60,
  '6h': 6 * 60 * 60,
  '24h': 24 * 60 * 60,
}

export class GraylogClientError extends Error {
  status: number
  details?: string

  constructor(message: string, status = 502, details?: string) {
    super(message)
    this.name = 'GraylogClientError'
    this.status = status
    this.details = details
  }
}

export type GraylogExecuteMessage = {
  id: string
  timestamp: string
  source: string
  message: string
  index: string
  fields: Record<string, unknown>
}

export type GraylogExecuteResult = {
  country: GraylogCountry
  baseUrl: string
  query: string
  timerangeSeconds: number
  limit: number
  totalResults: number
  durationMs: number
  executedAt: string
  effectiveFrom: string | null
  effectiveTo: string | null
  messages: GraylogExecuteMessage[]
}

export function mapTimeRangeToSeconds(timeRange: string): number {
  const key = timeRange.trim()
  if (key === 'custom') {
    throw new GraylogClientError(
      'Custom time range is not supported for Run yet. Choose 15m, 1h, 6h, or 24h.',
      400,
    )
  }
  const seconds = TIME_RANGE_SECONDS[key]
  if (!seconds) {
    throw new GraylogClientError(
      `Unsupported timeRange "${timeRange}". Use 15m, 1h, 6h, or 24h.`,
      400,
    )
  }
  return seconds
}

export function clampLimit(limit?: number): number {
  if (limit == null || !Number.isFinite(limit)) return DEFAULT_LIMIT
  return Math.min(Math.max(Math.floor(limit), 1), MAX_LIMIT)
}

function basicAuthHeader(token: string): string {
  return `Basic ${Buffer.from(`${token}:token`, 'utf8').toString('base64')}`
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function pickString(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = obj[key]
    if (typeof v === 'string' && v.trim()) return v
  }
  return ''
}

function parseMessages(payload: unknown): {
  messages: GraylogExecuteMessage[]
  totalResults: number
  durationMs: number
  effectiveFrom: string | null
  effectiveTo: string | null
} {
  const root = asRecord(payload)
  if (!root) {
    throw new GraylogClientError('Graylog returned an unexpected response shape.', 502)
  }

  const results = asRecord(root.results)
  const queryResult = results ? asRecord(Object.values(results)[0]) : null
  const searchTypes = queryResult ? asRecord(queryResult.search_types) : null
  const messagesBlock = searchTypes ? asRecord(Object.values(searchTypes)[0]) : null

  const rawMessages = Array.isArray(messagesBlock?.messages) ? messagesBlock.messages : []
  const totalResults =
    typeof messagesBlock?.total_results === 'number'
      ? messagesBlock.total_results
      : rawMessages.length

  const execStats = queryResult ? asRecord(queryResult.execution_stats) : null
  const durationMs = typeof execStats?.duration === 'number' ? execStats.duration : 0
  const effective = execStats ? asRecord(execStats.effective_timerange) : null
  const effectiveFrom =
    typeof effective?.from === 'string'
      ? effective.from
      : typeof messagesBlock?.effective_timerange === 'object' &&
          messagesBlock.effective_timerange &&
          typeof (messagesBlock.effective_timerange as { from?: string }).from === 'string'
        ? (messagesBlock.effective_timerange as { from: string }).from
        : null
  const effectiveTo =
    typeof effective?.to === 'string'
      ? effective.to
      : typeof messagesBlock?.effective_timerange === 'object' &&
          messagesBlock.effective_timerange &&
          typeof (messagesBlock.effective_timerange as { to?: string }).to === 'string'
        ? (messagesBlock.effective_timerange as { to: string }).to
        : null

  const messages: GraylogExecuteMessage[] = rawMessages.map((entry, index) => {
    const row = asRecord(entry)
    const messageObj = row ? asRecord(row.message) : null
    const fields = messageObj ? { ...messageObj } : {}
    const id =
      pickString(fields, '_id', 'gl2_message_id') ||
      (typeof row?.id === 'string' ? row.id : '') ||
      `msg-${index}`
    const timestamp = pickString(fields, 'timestamp') || ''
    const source = pickString(fields, 'source') || ''
    const message = pickString(fields, 'message') || ''
    const indexName =
      (typeof row?.index === 'string' ? row.index : '') || pickString(fields, 'gl2_source_input')

    return {
      id,
      timestamp,
      source,
      message,
      index: indexName,
      fields,
    }
  })

  return { messages, totalResults, durationMs, effectiveFrom, effectiveTo }
}

export async function executeGraylogSearch(input: {
  country: string
  query: string
  timeRange: string
  limit?: number
  timeoutMs?: number
}): Promise<GraylogExecuteResult> {
  const countryRaw = input.country.trim().toUpperCase()
  if (!isGraylogCountry(countryRaw)) {
    throw new GraylogClientError(
      `Unknown Graylog country "${input.country}". Supported: HR, SI, RS, SK, ME, BA, AZ, BG.`,
      400,
    )
  }

  const query = input.query.trim()
  if (!query) {
    throw new GraylogClientError('query is required.', 400)
  }

  const token = resolveGraylogToken(countryRaw)
  const baseUrl = resolveGraylogBaseUrl(countryRaw)
  if (!token) {
    throw new GraylogClientError(
      `Graylog cluster for ${countryRaw} is not configured (missing GRAYLOG_${countryRaw}_TOKEN).`,
      503,
    )
  }

  const timerangeSeconds = mapTimeRangeToSeconds(input.timeRange)
  const limit = clampLimit(input.limit)
  const timeoutMs = input.timeoutMs ?? 60_000

  const body = {
    queries: [
      {
        id: 'q1',
        query: { type: 'elasticsearch', query_string: query },
        timerange: { type: 'relative', range: timerangeSeconds },
        filter: null,
        search_types: [
          {
            id: 'm1',
            type: 'messages',
            limit,
            offset: 0,
            sort: [{ field: 'timestamp', order: 'DESC' }],
          },
        ],
      },
    ],
    parameters: [],
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  const executedAt = new Date().toISOString()

  try {
    const res = await fetch(`${baseUrl}/api/views/search/sync`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Requested-By': 'nesy-cockpit',
        Authorization: basicAuthHeader(token),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    const text = await res.text()
    let json: unknown
    try {
      json = text ? JSON.parse(text) : null
    } catch {
      throw new GraylogClientError(
        `Graylog ${countryRaw} returned non-JSON (${res.status}).`,
        502,
        text.slice(0, 500),
      )
    }

    if (!res.ok) {
      const errObj = asRecord(json)
      const message =
        (typeof errObj?.message === 'string' && errObj.message) ||
        `Graylog ${countryRaw} search failed (${res.status}).`
      throw new GraylogClientError(message, 502, text.slice(0, 800))
    }

    const parsed = parseMessages(json)
    return {
      country: countryRaw,
      baseUrl,
      query,
      timerangeSeconds,
      limit,
      totalResults: parsed.totalResults,
      durationMs: parsed.durationMs,
      executedAt,
      effectiveFrom: parsed.effectiveFrom,
      effectiveTo: parsed.effectiveTo,
      messages: parsed.messages,
    }
  } catch (error) {
    if (error instanceof GraylogClientError) throw error
    if (error instanceof Error && error.name === 'AbortError') {
      throw new GraylogClientError(`Graylog ${countryRaw} search timed out after ${timeoutMs}ms.`, 502)
    }
    throw new GraylogClientError(
      `Graylog ${countryRaw} request failed.`,
      502,
      error instanceof Error ? error.message : String(error),
    )
  } finally {
    clearTimeout(timer)
  }
}
