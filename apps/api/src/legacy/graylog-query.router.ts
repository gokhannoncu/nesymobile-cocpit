import { Router, type Router as RouterType } from 'express'
import { prisma, type Prisma } from '@nesy/db'
import {
  getFieldsPayload,
  getGraylogFields,
  GRAYLOG_IDENTIFIER_FIELD_MAP,
  GRAYLOG_MOBILE_REQUEST_TOKENS,
} from '../data/graylog-fields.js'
import { listGraylogClusters } from '../graylog-env.js'
import { ClaudeCliError, extractJsonObject, runClaudePrompt } from '../lib/claude-cli.js'
import { executeGraylogSearch, GraylogClientError } from '../lib/graylog-client.js'
import {
  assertSearchOnlyQuery,
  buildQuality,
  deriveStatus,
  ensureValidationChecks,
  UnsafeGraylogQueryError,
} from '../lib/graylog-query-guardrails.js'

const router: RouterType = Router()

type GeneratedPayload = {
  name?: string
  query?: string
  summary?: string
  explanation?: string[]
  validation?: Array<{ id?: string; label?: string; detail?: string; status?: string }>
  quality?: { verdict?: string; explanation?: string }
  expectedSignals?: string[]
}

function buildPrompt(input: {
  naturalLanguage: string
  environment: string
  country: string
  application: string
  service: string
  logLevel: string
  timeRange: string
  device: string
  appVersion: string
  identifiers: Record<string, string>
  sources: string[]
}): string {
  const fieldLines = getGraylogFields()
    .map((f) => `- ${f.field}: ${f.meaning}; example ${f.example}; source ${f.source}`)
    .join('\n')

  const idLines = Object.entries(input.identifiers)
    .filter(([, v]) => String(v ?? '').trim())
    .map(([k, v]) => {
      const mapHint = GRAYLOG_IDENTIFIER_FIELD_MAP[k] ?? 'message:"<value>"'
      return `- UI key ${k}=${v} → Lucene: ${mapHint.replace(/<value>/g, v)}`
    })
    .join('\n')

  return [
    'You are a Graylog Lucene search query generator for NESY logistics (mobile, backend, fiscal, D4Me).',
    'Return ONLY a single JSON object (no markdown) with keys:',
    'name, query, summary, explanation (string[]), validation (array of {id,label,detail,status:pass|warn}),',
    'quality ({verdict:strong|broad, explanation}), expectedSignals (string[], optional).',
    'Rules:',
    '- Search-only Lucene / Graylog query string. Never delete streams, drop indexes, or remove messages.',
    '- ONLY use fields from the dictionary below. Invented fields (barcode, requestName, X-Channel, country, shipmentId, courierId, scheduleId, deviceId, appVersion, username) are REJECTED by Graylog.',
    '- Country is selected by which Graylog cluster runs the query — NEVER emit country: in Lucene.',
    '- Mobile APIs: prefer To:DeliverParcels / From:… / message:"Task/DeliverParcels" — never requestName:.',
    '- Terminal channel: Channel:Terminal or Log_Request_Channel:Terminal — never X-Channel:.',
    '- Barcodes: Log_Data_Barcode:"…" or message:"…" — never barcode:.',
    '- Shipments: Log_ShipmentId / Log_Data_ShipmentId / message:"…" — never shipmentId:.',
    '- Schedules: Log_ScheduleId — never scheduleId:.',
    '- App version: ClientVersion — never appVersion:.',
    '- Avoid bare wildcards on analyzed text fields (*token*) — prefer exact To:Name or quoted message:"…".',
    '- Sensitive values (tokens, passwords, full PII) must not appear unmasked in the query.',
    `- Environment: ${input.environment}`,
    `- Country cluster context (do NOT put in query): ${input.country}`,
    `- Application (context only unless expressible via source/message): ${input.application}`,
    `- Service (context): ${input.service}`,
    `- Log level: prefer stringLevel:${input.logLevel === 'any' ? '…' : input.logLevel} when filtering`,
    `- Time range hint (Graylog UI / API timerange, not Lucene): ${input.timeRange}`,
    `- Device (search in message if needed; no deviceId field): ${input.device}`,
    `- App version → ClientVersion when filtering: ${input.appVersion}`,
    '',
    'Known identifiers (map UI keys to real fields):',
    idLines || '- (none)',
    '',
    'Field dictionary (ONLY these field names are valid):',
    fieldLines,
    '',
    'Known mobile / terminal request patterns:',
    ...GRAYLOG_MOBILE_REQUEST_TOKENS.map((t) => `- ${t}`),
    '',
    'User request:',
    input.naturalLanguage,
  ].join('\n')
}

function asStringArray(value: Prisma.JsonValue | null | undefined): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === 'string')
}

function asStringRecord(value: Prisma.JsonValue | null | undefined): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === 'string') out[k] = v
  }
  return out
}

function mapRow(row: {
  id: string
  name: string
  naturalLanguage: string
  query: string
  environment: string
  country: string | null
  application: string
  service: string | null
  logLevel: string | null
  timeRange: string
  device: string | null
  appVersion: string | null
  identifiers: Prisma.JsonValue | null
  sources: Prisma.JsonValue | null
  status: string
  explanation: Prisma.JsonValue
  validation: Prisma.JsonValue
  quality: Prisma.JsonValue | null
  expectedSignals: Prisma.JsonValue | null
  summary: string | null
  model: string | null
  createdBy: string
  relatedIncident: string | null
  createdAt: Date
  lastUsedAt: Date
}) {
  const quality =
    row.quality && typeof row.quality === 'object' && !Array.isArray(row.quality)
      ? (row.quality as { verdict?: string; explanation?: string })
      : null

  return {
    id: row.id,
    name: row.name,
    naturalLanguage: row.naturalLanguage,
    query: row.query,
    environment: row.environment,
    country: row.country,
    application: row.application,
    service: row.service,
    logLevel: row.logLevel,
    timeRange: row.timeRange,
    device: row.device,
    appVersion: row.appVersion,
    identifiers: asStringRecord(row.identifiers),
    sources: asStringArray(row.sources),
    status: row.status,
    explanation: asStringArray(row.explanation),
    validation: Array.isArray(row.validation) ? row.validation : [],
    quality,
    expectedSignals: asStringArray(row.expectedSignals),
    summary: row.summary,
    model: row.model,
    createdBy: row.createdBy,
    relatedIncident: row.relatedIncident,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt.toISOString(),
  }
}

router.get('/fields', (_req, res) => {
  res.json({ data: getFieldsPayload() })
})

router.get('/clusters', (_req, res) => {
  const clusters = listGraylogClusters().map(({ country, baseUrl, configured }) => ({
    country,
    baseUrl,
    configured,
  }))
  res.json({ data: clusters })
})

router.post('/execute', async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>
    const query = typeof body.query === 'string' ? body.query.trim() : ''
    const country = typeof body.country === 'string' ? body.country.trim() : ''
    const timeRange = typeof body.timeRange === 'string' ? body.timeRange.trim() : '1h'
    const limitRaw = typeof body.limit === 'number' ? body.limit : Number(body.limit)

    if (!query) {
      res.status(400).json({ message: 'query is required.' })
      return
    }
    if (!country) {
      res.status(400).json({ message: 'country is required.' })
      return
    }

    assertSearchOnlyQuery(query)

    const result = await executeGraylogSearch({
      country,
      query,
      timeRange,
      limit: Number.isFinite(limitRaw) ? limitRaw : undefined,
    })

    res.json({ data: result })
  } catch (error) {
    if (error instanceof UnsafeGraylogQueryError) {
      res.status(422).json({ message: error.message })
      return
    }
    if (error instanceof GraylogClientError) {
      res.status(error.status).json({
        message: error.message,
        details: error.details,
      })
      return
    }
    res.status(500).json({
      message: 'Graylog query could not be executed.',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

router.get('/recent', async (req, res) => {
  try {
    const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : 50
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50
    const rows = await prisma.graylogQueryRun.findMany({
      orderBy: { lastUsedAt: 'desc' },
      take: limit,
    })
    res.json({ data: rows.map(mapRow) })
  } catch (error) {
    res.status(500).json({
      message: 'Recent Graylog queries could not be fetched.',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

router.get('/recent/:id', async (req, res) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id.trim() : ''
    if (!id) {
      res.status(400).json({ message: 'id is required.' })
      return
    }
    const row = await prisma.graylogQueryRun.findUnique({ where: { id } })
    if (!row) {
      res.status(404).json({ message: 'Query run not found.' })
      return
    }
    res.json({ data: mapRow(row) })
  } catch (error) {
    res.status(500).json({
      message: 'Graylog query run could not be fetched.',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

router.post('/generate', async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>
    const naturalLanguage =
      typeof body.naturalLanguage === 'string' ? body.naturalLanguage.trim() : ''
    const environment =
      typeof body.environment === 'string' ? body.environment.trim() : 'production'
    const country = typeof body.country === 'string' ? body.country.trim() : 'HR'
    const application =
      typeof body.application === 'string' ? body.application.trim() : 'nesy-mobile'
    const service = typeof body.service === 'string' ? body.service.trim() : 'any'
    const logLevel = typeof body.logLevel === 'string' ? body.logLevel.trim() : 'any'
    const timeRange = typeof body.timeRange === 'string' ? body.timeRange.trim() : '1h'
    const device = typeof body.device === 'string' ? body.device.trim() : 'any'
    const appVersion = typeof body.appVersion === 'string' ? body.appVersion.trim() : 'any'

    const identifiers: Record<string, string> =
      body.identifiers && typeof body.identifiers === 'object' && !Array.isArray(body.identifiers)
        ? Object.fromEntries(
            Object.entries(body.identifiers as Record<string, unknown>).map(([k, v]) => [
              k,
              typeof v === 'string' ? v : String(v ?? ''),
            ]),
          )
        : {}

    const sources = Array.isArray(body.sources)
      ? body.sources.filter((s): s is string => typeof s === 'string')
      : []

    if (!naturalLanguage) {
      res.status(400).json({ message: 'naturalLanguage is required.' })
      return
    }

    const prompt = buildPrompt({
      naturalLanguage,
      environment,
      country,
      application,
      service,
      logLevel,
      timeRange,
      device,
      appVersion,
      identifiers,
      sources,
    })

    const model =
      process.env.CLAUDE_GRAYLOG_QUERY_MODEL ??
      process.env.CLAUDE_MONGO_QUERY_MODEL ??
      'haiku'
    const timeoutMs = Number(
      process.env.CLAUDE_GRAYLOG_QUERY_TIMEOUT_MS ??
        process.env.CLAUDE_MONGO_QUERY_TIMEOUT_MS ??
        90_000,
    )

    const { resultText, model: usedModel } = await runClaudePrompt(prompt, {
      model,
      timeoutMs,
    })
    const parsed = extractJsonObject(resultText) as GeneratedPayload

    if (!parsed.query || typeof parsed.query !== 'string') {
      res.status(502).json({
        message: 'Claude response missing query field.',
        raw: resultText.slice(0, 1500),
      })
      return
    }

    const query = parsed.query.trim()
    assertSearchOnlyQuery(query)

    const explanation = Array.isArray(parsed.explanation)
      ? parsed.explanation.filter((s): s is string => typeof s === 'string')
      : []
    const validation = ensureValidationChecks({
      validation: Array.isArray(parsed.validation) ? parsed.validation : [],
      query,
      timeRange,
      identifiers,
      environment,
    })
    const quality = buildQuality({
      identifiers,
      timeRange,
      environment,
      llmQuality: parsed.quality ?? null,
    })
    const status = deriveStatus(validation)
    const name =
      typeof parsed.name === 'string' && parsed.name.trim()
        ? parsed.name.trim().slice(0, 120)
        : `${application} · ${timeRange}`
    const summary =
      typeof parsed.summary === 'string' && parsed.summary.trim()
        ? parsed.summary.trim()
        : `Search only · ${environment} · ${country} · ${timeRange}`
    const expectedSignals = Array.isArray(parsed.expectedSignals)
      ? parsed.expectedSignals.filter((s): s is string => typeof s === 'string')
      : []

    const row = await prisma.graylogQueryRun.create({
      data: {
        name,
        naturalLanguage,
        query,
        environment,
        country: country || null,
        application,
        service: service || null,
        logLevel: logLevel || null,
        timeRange,
        device: device || null,
        appVersion: appVersion || null,
        identifiers: identifiers as Prisma.InputJsonValue,
        sources: sources as Prisma.InputJsonValue,
        status,
        explanation,
        validation: validation as Prisma.InputJsonValue,
        quality: quality as Prisma.InputJsonValue,
        expectedSignals: expectedSignals as Prisma.InputJsonValue,
        summary,
        model: usedModel,
        createdBy: 'local',
      },
    })

    res.status(201).json({ data: mapRow(row) })
  } catch (error) {
    if (error instanceof UnsafeGraylogQueryError) {
      res.status(422).json({ message: error.message })
      return
    }
    if (error instanceof ClaudeCliError) {
      res.status(503).json({
        message: error.message,
        details: error.details,
      })
      return
    }
    res.status(500).json({
      message: 'Graylog query could not be generated.',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

router.post('/recent/:id/reuse', async (req, res) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id.trim() : ''
    if (!id) {
      res.status(400).json({ message: 'id is required.' })
      return
    }
    const row = await prisma.graylogQueryRun.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    })
    res.json({ data: mapRow(row) })
  } catch (error) {
    const err = error as { code?: string }
    if (err.code === 'P2025') {
      res.status(404).json({ message: 'Query run not found.' })
      return
    }
    res.status(500).json({
      message: 'Could not update lastUsedAt.',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

router.delete('/recent/:id', async (req, res) => {
  try {
    const id = typeof req.params.id === 'string' ? req.params.id.trim() : ''
    if (!id) {
      res.status(400).json({ message: 'id is required.' })
      return
    }

    const deleted = await prisma.graylogQueryRun.deleteMany({ where: { id } })
    if (deleted.count === 0) {
      res.status(404).json({ message: 'Query run not found.' })
      return
    }

    res.status(204).end()
  } catch (error) {
    res.status(500).json({
      message: 'Graylog query run could not be deleted.',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

export default router
