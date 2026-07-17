// Data Locator — presentation helpers / types (catalog data comes from API).

import type { Tone } from '@/components/product'

export type SourceType =
  | 'MongoDB Collection'
  | 'Android Room'
  | 'SharedPreferences'
  | 'Memory State'

export type TruthLevel =
  | 'authoritative'
  | 'operational'
  | 'cached'
  | 'derived'
  | 'temporary'
  | 'audit'

export type DataDomain =
  | 'Shipment'
  | 'Delivery'
  | 'Payment'
  | 'Fiscal'
  | 'Schedule'
  | 'Courier'
  | 'Barcode'
  | 'Offline Queue'
  | 'Notification'
  | 'Location'
  | 'Authentication'
  | 'Customer'
  | 'Transfer'
  | 'Inventory'
  | 'Routing'

export type SourceEnvironment = 'Mobile local' | 'Backend' | 'UAT' | 'Production'
export type SourceCountry = 'HR' | 'BA' | 'SI' | 'RS' | 'General'
export type ResultRole = 'primary' | 'supporting' | 'log' | 'cache' | 'external'
export type SourceKind = 'mongo' | 'mobile'

export interface KeyField {
  name: string
  type: string
  meaning: string
}

export interface DataSource {
  id: string
  kind: SourceKind
  name: string
  system: string
  sourceType: SourceType
  database?: string
  collection?: string
  service?: string
  domains: DataDomain[]
  truth: TruthLevel
  owner: string
  freshness: string
  retention: string
  updateFrequency: string
  environments: SourceEnvironment[]
  countries: SourceCountry[]
  lastSchemaUpdate: string
  purpose: string
  notFor: string
  keyFields: KeyField[]
  commonQuestions: string[]
  exampleQuery: { label: string; code: string }
  relatedSources: string[]
  caveats: string[]
}

export interface SearchIntent {
  id: string
  chipLabel?: string
  keywords: string[]
  guidance: {
    headline: string
    detail: string
  }
  results: { sourceId: string; role: ResultRole }[]
}

export interface LineageChain {
  id: string
  title: string
  description: string
  nodes: { label: string; sourceId?: string }[]
}

export interface InvestigationRecipe {
  id: string
  title: string
  purpose: string
  checkOrder: string[]
  identifier: string
  cta: { label: string; href: string }
}

export interface Guardrail {
  title: string
  body: string
  tone: Tone
}

export const TRUTH_META: Record<TruthLevel, { label: string; tone: Tone; hint: string }> = {
  authoritative: {
    label: 'Authoritative',
    tone: 'green',
    hint: 'This is the final record of this data; in case of discrepancy, this source wins.',
  },
  operational: {
    label: 'Operational',
    tone: 'blue',
    hint: 'The current record where daily operations run; workflows read and write from here.',
  },
  cached: {
    label: 'Cached copy',
    tone: 'amber',
    hint: 'Copy of another source; may fall behind due to sync delay.',
  },
  derived: {
    label: 'Derived',
    tone: 'teal',
    hint: 'Derived from other records; cannot be fixed directly, its source is fixed.',
  },
  temporary: {
    label: 'Temporary state',
    tone: 'orange',
    hint: 'Process/session scoped temporary state; not a permanent record.',
  },
  audit: {
    label: 'Audit-log only',
    tone: 'gray',
    hint: 'Used to understand what happened; not used for operational validation.',
  },
}

export const ROLE_META: Record<ResultRole, { label: string; tone: Tone }> = {
  primary: { label: 'Primary source', tone: 'blue' },
  supporting: { label: 'Supporting source', tone: 'teal' },
  log: { label: 'Log source', tone: 'gray' },
  cache: { label: 'Local cache', tone: 'amber' },
  external: { label: 'External system', tone: 'purple' },
}

export function mongoGeneratorHref(source: DataSource): string | null {
  if (source.kind !== 'mongo' || !source.database || !source.collection) return null
  const params = new URLSearchParams({
    database: source.database,
    collection: source.collection,
  })
  return `/engineering/tools/mongodb-query-generator?${params.toString()}`
}
