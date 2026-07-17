import { API_BASE } from '@/services/api'

export type MongoCatalogField = {
  field: string
  type: string
  description: string
  example: string
}

export type MongoCatalogExample = { label: string; text: string }

export type MongoPredefinedQuery = {
  id: number
  label: string
  text: string
  database: string
  collection: string
  category: string
  reason: string
  priority: 'P0' | 'P1' | 'P2' | string
}

export type MongoCatalogCollection = {
  database: string
  collection: string
  service: string
  keyFields: MongoCatalogField[]
  examplePrompts: MongoCatalogExample[]
}

export type MongoCatalogPayload = {
  databases: string[]
  collections: MongoCatalogCollection[]
  predefinedQueries?: MongoPredefinedQuery[]
}

export type MongoValidationCheck = {
  id?: string
  label?: string
  detail?: string
  status?: 'pass' | 'warn' | string
}

export type MongoQueryRun = {
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
  explanation: string[]
  validation: MongoValidationCheck[]
  estimatedScope: {
    documents?: string
    index?: string | null
    response?: string
    summary?: string
    noIndexWarning?: string
  } | null
  safetyToggles?: Record<string, boolean> | null
  model?: string | null
  createdBy: string
  owner?: string | null
  relatedTicket?: string | null
  relatedIncident?: string | null
  createdAt: string
  lastUsedAt: string
  summary?: string
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string; details?: string; error?: string }
    return [body.message, body.details, body.error].filter(Boolean).join(' — ') || res.statusText
  } catch {
    return res.statusText
  }
}

export async function fetchMongoCatalog(): Promise<MongoCatalogPayload> {
  const res = await fetch(`${API_BASE}/mongo-query/catalog`)
  if (!res.ok) throw new Error(await readError(res))
  const json = (await res.json()) as { data: MongoCatalogPayload }
  return json.data
}

export async function fetchRecentMongoQueries(limit = 50): Promise<MongoQueryRun[]> {
  const res = await fetch(`${API_BASE}/mongo-query/recent?limit=${limit}`)
  if (!res.ok) throw new Error(await readError(res))
  const json = (await res.json()) as { data: MongoQueryRun[] }
  return json.data.map(normalizeRun)
}

export async function generateMongoQuery(input: {
  naturalLanguage: string
  environment: string
  database: string
  collection: string
  queryType: string
  country: string
  timeRange: string
  toggles: Record<string, boolean>
}): Promise<MongoQueryRun> {
  const res = await fetch(`${API_BASE}/mongo-query/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw new Error(await readError(res))
  const json = (await res.json()) as { data: MongoQueryRun }
  return normalizeRun(json.data)
}

export async function reuseMongoQuery(id: string): Promise<MongoQueryRun> {
  const res = await fetch(`${API_BASE}/mongo-query/recent/${id}/reuse`, { method: 'POST' })
  if (!res.ok) throw new Error(await readError(res))
  const json = (await res.json()) as { data: MongoQueryRun }
  return normalizeRun(json.data)
}

export async function deleteMongoQuery(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/mongo-query/recent/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await readError(res))
}

function normalizeRun(run: MongoQueryRun): MongoQueryRun {
  return {
    ...run,
    explanation: Array.isArray(run.explanation) ? run.explanation : [],
    validation: Array.isArray(run.validation) ? run.validation : [],
  }
}
