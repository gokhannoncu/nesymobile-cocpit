import { Router, type Router as RouterType } from 'express'
import { prisma, type Prisma } from '@nesy/db'
import { getCatalogPayload, getCollectionEntry } from '../data/mongo-catalog.js'
import { ClaudeCliError, extractJsonObject, runClaudePrompt } from '../lib/claude-cli.js'
import {
  assertReadOnlyQuery,
  deriveStatus,
  ensureLimit,
  WriteQueryError,
} from '../lib/mongo-query-guardrails.js'

const router: RouterType = Router()

type GeneratedPayload = {
  name?: string
  query?: string
  summary?: string
  explanation?: string[]
  validation?: Array<{ id?: string; label?: string; detail?: string; status?: string }>
  estimatedScope?: {
    documents?: string
    index?: string | null
    response?: string
  }
}

function buildPrompt(input: {
  naturalLanguage: string
  database: string
  collection: string
  queryType: string
  environment: string
  country: string
  timeRange: string
  toggles: Record<string, boolean>
  keyFields: Array<{ field: string; type: string; description: string; example: string }>
}): string {
  const schemaLines = input.keyFields
    .map((f) => `- ${f.field} (${f.type}): ${f.description}; example ${f.example}`)
    .join('\n')

  return [
    'You are a MongoDB shell query generator for NESY logistics backends.',
    'Return ONLY a single JSON object (no markdown) with keys:',
    'name, query, summary, explanation (string[]), validation (array of {id,label,detail,status:pass|warn}), estimatedScope ({documents,index,response}).',
    'Rules:',
    '- Read-only only: find / aggregate / count / distinct. Never update/delete/insert/drop/$out/$merge.',
    '- Use exact collection name and PascalCase field names from the schema ONLY.',
    '- Never invent fields. Forbidden examples: Username, UserName, CourierUsername (unless listed), camelCase variants.',
    '- For Schedule courier filters use CourierUserId and/or CourierName only.',
    '- Local calendar-day fields (critical): ScheduleDate and PickupDate store local midnight as UTC. CEST (UTC+2): local day D → (D-1)T22:00:00.000Z. Real example: ScheduleId 221-12-20260717-1 / CourierName "Frano Milostić" has ScheduleDate ISODate("2026-07-16T22:00:00.000Z"). Correct day filter: $gte ISODate("2026-07-16T22:00:00.000Z"), $lt ISODate("2026-07-17T22:00:00.000Z"). Wrong: $gte ISODate("2026-07-17T00:00:00Z") or $gte ISODate("2026-07-17T22:00:00Z") (misses that day). For "today" / last-N-days on event timestamps (CreatedAt, EndofDayRequestTime, ApprovalUpdatedAt, LoginAt) use the same CEST local-day bounds, not UTC midnight.',
    `- Database context: ${input.database}`,
    `- Collection: ${input.collection}`,
    `- Query type preference: ${input.queryType}`,
    `- Environment: ${input.environment}`,
    `- Country hint: ${input.country}`,
    `- Time range hint: ${input.timeRange}`,
    `- Safety toggles: ${JSON.stringify(input.toggles)}`,
    input.toggles.limit !== false ? '- Include .limit(100) or $limit:100 unless Count/Distinct.' : '',
    input.toggles.timeRange !== false
      ? '- Prefer a time filter matching the time range when a date field exists. For ScheduleDate / PickupDate and for "today"/last-N-days windows follow the CEST local-midnight rule above (not UTC midnight).'
      : '',
    '',
    'Schema fields:',
    schemaLines,
    '',
    'User request:',
    input.naturalLanguage,
  ]
    .filter(Boolean)
    .join('\n')
}

function mapRow(row: {
  id: string
  name: string
  naturalLanguage: string
  query: string
  database: string
  collection: string
  environment: string
  queryType: string
  country: string | null
  status: string
  explanation: Prisma.JsonValue
  validation: Prisma.JsonValue
  estimatedScope: Prisma.JsonValue | null
  safetyToggles: Prisma.JsonValue | null
  model: string | null
  createdBy: string
  owner: string | null
  relatedTicket: string | null
  relatedIncident: string | null
  createdAt: Date
  lastUsedAt: Date
}) {
  return {
    id: row.id,
    name: row.name,
    naturalLanguage: row.naturalLanguage,
    query: row.query,
    database: row.database,
    collection: row.collection,
    environment: row.environment,
    queryType: row.queryType,
    country: row.country,
    status: row.status,
    explanation: row.explanation,
    validation: row.validation,
    estimatedScope: row.estimatedScope,
    safetyToggles: row.safetyToggles,
    model: row.model,
    createdBy: row.createdBy,
    owner: row.owner,
    relatedTicket: row.relatedTicket,
    relatedIncident: row.relatedIncident,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt.toISOString(),
    summary:
      typeof row.estimatedScope === 'object' &&
      row.estimatedScope &&
      'summary' in (row.estimatedScope as object)
        ? String((row.estimatedScope as { summary?: string }).summary ?? '')
        : undefined,
  }
}

router.get('/catalog', (_req, res) => {
  res.json({ data: getCatalogPayload() })
})

router.get('/recent', async (req, res) => {
  try {
    const limitRaw = typeof req.query.limit === 'string' ? Number(req.query.limit) : 50
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50
    const rows = await prisma.mongoQueryRun.findMany({
      orderBy: { lastUsedAt: 'desc' },
      take: limit,
    })
    res.json({ data: rows.map(mapRow) })
  } catch (error) {
    res.status(500).json({
      message: 'Recent Mongo queries could not be fetched.',
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
    const row = await prisma.mongoQueryRun.findUnique({ where: { id } })
    if (!row) {
      res.status(404).json({ message: 'Query run not found.' })
      return
    }
    res.json({ data: mapRow(row) })
  } catch (error) {
    res.status(500).json({
      message: 'Mongo query run could not be fetched.',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

router.post('/generate', async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>
    const naturalLanguage =
      typeof body.naturalLanguage === 'string' ? body.naturalLanguage.trim() : ''
    const database = typeof body.database === 'string' ? body.database.trim() : ''
    const collection = typeof body.collection === 'string' ? body.collection.trim() : ''
    const environment =
      typeof body.environment === 'string' ? body.environment.trim() : 'Development'
    const queryType = typeof body.queryType === 'string' ? body.queryType.trim() : 'Find'
    const country = typeof body.country === 'string' ? body.country.trim() : 'All'
    const timeRange =
      typeof body.timeRange === 'string' ? body.timeRange.trim() : 'Last 24 hours'
    const toggles =
      body.toggles && typeof body.toggles === 'object' && !Array.isArray(body.toggles)
        ? (body.toggles as Record<string, boolean>)
        : { limit: true, mask: true, timeRange: true, explain: true }

    if (!naturalLanguage) {
      res.status(400).json({ message: 'naturalLanguage is required.' })
      return
    }

    const entry = getCollectionEntry(database, collection)
    if (!entry) {
      res.status(400).json({
        message: 'Unknown database/collection. Use GET /api/mongo-query/catalog.',
      })
      return
    }

    const prompt = buildPrompt({
      naturalLanguage,
      database,
      collection,
      queryType,
      environment,
      country,
      timeRange,
      toggles,
      keyFields: entry.keyFields,
    })

    const { resultText, model } = await runClaudePrompt(prompt)
    const parsed = extractJsonObject(resultText) as GeneratedPayload

    if (!parsed.query || typeof parsed.query !== 'string') {
      res.status(502).json({ message: 'Claude response missing query field.', raw: resultText.slice(0, 1500) })
      return
    }

    let query = parsed.query.trim()
    assertReadOnlyQuery(query)
    if (toggles.limit !== false) {
      query = ensureLimit(query, queryType)
    }

    const explanation = Array.isArray(parsed.explanation)
      ? parsed.explanation.filter((s): s is string => typeof s === 'string')
      : []
    const validation = Array.isArray(parsed.validation) ? parsed.validation : []
    const status = deriveStatus(validation)
    const name =
      typeof parsed.name === 'string' && parsed.name.trim()
        ? parsed.name.trim().slice(0, 120)
        : `${collection} ${queryType}`

    const estimatedScope = {
      documents: parsed.estimatedScope?.documents ?? 'unknown',
      index: parsed.estimatedScope?.index ?? null,
      response: parsed.estimatedScope?.response ?? 'unknown',
      summary:
        typeof parsed.summary === 'string'
          ? parsed.summary
          : `Collection: ${collection} · ${queryType}`,
      noIndexWarning: 'No suitable index found for this filter combination.',
    }

    const row = await prisma.mongoQueryRun.create({
      data: {
        name,
        naturalLanguage,
        query,
        database,
        collection,
        environment,
        queryType,
        country: country || null,
        status,
        explanation,
        validation: validation as Prisma.InputJsonValue,
        estimatedScope: estimatedScope as Prisma.InputJsonValue,
        safetyToggles: toggles as Prisma.InputJsonValue,
        model,
        createdBy: 'local',
      },
    })

    res.status(201).json({
      data: {
        ...mapRow(row),
        summary: estimatedScope.summary,
      },
    })
  } catch (error) {
    if (error instanceof WriteQueryError) {
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
      message: 'Mongo query could not be generated.',
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
    const row = await prisma.mongoQueryRun.update({
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

    const deleted = await prisma.mongoQueryRun.deleteMany({ where: { id } })
    if (deleted.count === 0) {
      res.status(404).json({ message: 'Query run not found.' })
      return
    }

    res.status(204).end()
  } catch (error) {
    res.status(500).json({
      message: 'Mongo query run could not be deleted.',
      error: error instanceof Error ? error.message : 'Unknown error',
    })
  }
})

export default router
