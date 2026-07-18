import { API_BASE } from '@/services/api'
import { formatApiNetworkError } from '@/services/api-errors'

export type GraylogField = {
  field: string
  meaning: string
  example: string
  source: string
}

export type GraylogPredefinedQuery = {
  id: number
  label: string
  text: string
  application: string
  service: string
  category: string
  reason: string
  priority: 'P0' | 'P1' | 'P2' | string
  timeRange?: string
  device?: string
  appVersion?: string
  identifiers?: Record<string, string>
  sources?: string[]
}

export type GraylogValidationCheck = {
  id?: string
  label?: string
  detail?: string
  status?: 'pass' | 'warn' | string
}

export type GraylogQuality = {
  verdict?: 'strong' | 'broad' | string
  explanation?: string
} | null

export type GraylogQueryRun = {
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
  identifiers: Record<string, string> | null
  sources: string[] | null
  status: string
  explanation: string[]
  validation: GraylogValidationCheck[]
  quality: GraylogQuality
  expectedSignals?: string[] | null
  summary?: string | null
  model?: string | null
  createdBy: string
  relatedIncident?: string | null
  createdAt: string
  lastUsedAt: string
}

export type GenerateGraylogInput = {
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
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string; details?: string; error?: string }
    return [body.message, body.details, body.error].filter(Boolean).join(' — ') || res.statusText
  } catch {
    return res.statusText
  }
}

function normalizeRun(run: GraylogQueryRun): GraylogQueryRun {
  return {
    ...run,
    explanation: Array.isArray(run.explanation) ? run.explanation : [],
    validation: Array.isArray(run.validation) ? run.validation : [],
    sources: Array.isArray(run.sources) ? run.sources : [],
    expectedSignals: Array.isArray(run.expectedSignals) ? run.expectedSignals : [],
  }
}

export async function fetchGraylogFields(): Promise<GraylogField[]> {
  try {
    const res = await fetch(`${API_BASE}/graylog-query/fields`)
    if (!res.ok) throw new Error(await readError(res))
    const json = (await res.json()) as { data: { fields: GraylogField[] } }
    return Array.isArray(json.data?.fields) ? json.data.fields : []
  } catch (e) {
    throw new Error(formatApiNetworkError(e, 'Failed to load Graylog fields'))
  }
}

export async function fetchGraylogPredefinedQueries(): Promise<GraylogPredefinedQuery[]> {
  try {
    const res = await fetch(`${API_BASE}/graylog-query/fields`)
    if (!res.ok) throw new Error(await readError(res))
    const json = (await res.json()) as {
      data: { fields?: GraylogField[]; predefinedQueries?: GraylogPredefinedQuery[] }
    }
    return Array.isArray(json.data?.predefinedQueries) ? json.data.predefinedQueries : []
  } catch (e) {
    throw new Error(formatApiNetworkError(e, 'Failed to load Graylog predefined queries'))
  }
}

export async function fetchRecentGraylogQueries(limit = 50): Promise<GraylogQueryRun[]> {
  try {
    const res = await fetch(`${API_BASE}/graylog-query/recent?limit=${limit}`)
    if (!res.ok) throw new Error(await readError(res))
    const json = (await res.json()) as { data: GraylogQueryRun[] }
    const rows = Array.isArray(json.data) ? json.data : []
    return rows.map(normalizeRun)
  } catch (e) {
    throw new Error(formatApiNetworkError(e, 'Failed to load recent Graylog queries'))
  }
}

export async function generateGraylogQuery(input: GenerateGraylogInput): Promise<GraylogQueryRun> {
  try {
    const res = await fetch(`${API_BASE}/graylog-query/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok) throw new Error(await readError(res))
    const json = (await res.json()) as { data: GraylogQueryRun }
    return normalizeRun(json.data)
  } catch (e) {
    throw new Error(formatApiNetworkError(e, 'Failed to generate Graylog query'))
  }
}

export async function reuseGraylogQuery(id: string): Promise<GraylogQueryRun> {
  try {
    const res = await fetch(`${API_BASE}/graylog-query/recent/${id}/reuse`, { method: 'POST' })
    if (!res.ok) throw new Error(await readError(res))
    const json = (await res.json()) as { data: GraylogQueryRun }
    return normalizeRun(json.data)
  } catch (e) {
    throw new Error(formatApiNetworkError(e, 'Failed to reuse Graylog query'))
  }
}

export async function deleteGraylogQuery(id: string): Promise<void> {
  try {
    const res = await fetch(`${API_BASE}/graylog-query/recent/${id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(await readError(res))
  } catch (e) {
    throw new Error(formatApiNetworkError(e, 'Failed to delete Graylog query'))
  }
}

export type GraylogCluster = {
  country: string
  baseUrl: string
  configured: boolean
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
  country: string
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

export type ExecuteGraylogInput = {
  query: string
  country: string
  timeRange: string
  limit?: number
}

export async function fetchGraylogClusters(): Promise<GraylogCluster[]> {
  try {
    const res = await fetch(`${API_BASE}/graylog-query/clusters`)
    if (!res.ok) throw new Error(await readError(res))
    const json = (await res.json()) as { data: GraylogCluster[] }
    return Array.isArray(json.data) ? json.data : []
  } catch (e) {
    throw new Error(formatApiNetworkError(e, 'Failed to load Graylog clusters'))
  }
}

export async function executeGraylogQuery(input: ExecuteGraylogInput): Promise<GraylogExecuteResult> {
  try {
    const res = await fetch(`${API_BASE}/graylog-query/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok) throw new Error(await readError(res))
    const json = (await res.json()) as { data: GraylogExecuteResult }
    return {
      ...json.data,
      messages: Array.isArray(json.data?.messages) ? json.data.messages : [],
    }
  } catch (e) {
    throw new Error(formatApiNetworkError(e, 'Failed to execute Graylog query'))
  }
}
