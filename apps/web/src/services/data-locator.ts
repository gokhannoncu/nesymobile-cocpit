import { API_BASE } from '@/services/api'
import type {
  DataSource,
  Guardrail,
  InvestigationRecipe,
  LineageChain,
  ResultRole,
  SearchIntent,
} from '@/data/engineering/tools/data-locator'

export type DataLocatorCatalogPayload = {
  sources: DataSource[]
  intents: SearchIntent[]
  lineage: LineageChain[]
  recipes: InvestigationRecipe[]
  guardrails: Guardrail[]
  noResult: {
    title: string
    suggestions: string[]
  }
  filterOptions: {
    domains: string[]
    sourceTypes: string[]
    environments: string[]
    countries: string[]
  }
}

export type DataLocatorSearchResult = {
  query: string
  intent: {
    id: string
    chipLabel?: string
    guidance: { headline: string; detail: string }
  } | null
  results: Array<{ role: ResultRole; source: DataSource }>
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string; error?: string }
    return body.message || body.error || res.statusText
  } catch {
    return res.statusText
  }
}

export async function fetchDataLocatorCatalog(): Promise<DataLocatorCatalogPayload> {
  const res = await fetch(`${API_BASE}/data-locator/catalog`)
  if (!res.ok) throw new Error(await readError(res))
  return res.json() as Promise<DataLocatorCatalogPayload>
}

export async function searchDataLocator(query: string): Promise<DataLocatorSearchResult> {
  const res = await fetch(`${API_BASE}/data-locator/search?q=${encodeURIComponent(query)}`)
  if (!res.ok) throw new Error(await readError(res))
  return res.json() as Promise<DataLocatorSearchResult>
}
