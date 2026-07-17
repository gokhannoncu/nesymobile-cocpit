// MongoDB Query Generator — UI constants and presentation helpers.
// Catalog + recent queries come from /api/mongo-query (real NESY collections).

import type { Tone } from '@/components/product'

export const ENVIRONMENTS = ['Development', 'Test', 'UAT', 'Production'] as const
export type Environment = (typeof ENVIRONMENTS)[number]

export const QUERY_TYPES = ['Find', 'Aggregate', 'Count', 'Distinct'] as const
export type QueryType = (typeof QUERY_TYPES)[number]

export const COUNTRIES = ['HR', 'SI', 'RS', 'BA', 'MK', 'All'] as const

export const TIME_RANGES = ['Last 1 hour', 'Last 24 hours', 'Last 7 days', 'Last 30 days', 'Custom'] as const

export type SafetyToggle = { id: string; label: string; description: string }

export const SAFETY_TOGGLES: SafetyToggle[] = [
  {
    id: 'limit',
    label: 'Automatically add result limit',
    description: '.limit(100) is added to every query — prevents large collection scans.',
  },
  {
    id: 'mask',
    label: 'Mask sensitive fields',
    description: 'PII fields (phone, address) are automatically removed from projection.',
  },
  {
    id: 'timeRange',
    label: 'Force time range',
    description: 'Queries without time filter are narrowed down to the last 24 hours.',
  },
  {
    id: 'explain',
    label: 'Generate query explanation',
    description: 'Explains step by step what the query does in natural language.',
  },
]

export const PRODUCTION_NOTICE =
  'Production queries are generated read-only. Result limit and time range are automatically applied.'

export const WRITE_INTENT_NOTICE =
  'This tool only generates read-only queries. The approved database operations process must be used for update and delete operations.'

/** Is there write intent (update/delete/etc) in the natural language text? */
export function hasWriteIntent(text: string): boolean {
  return /(update|delete|remove|drop\b)/i.test(text.toLocaleLowerCase('en-US'))
}

export type RecentQueryStatus = 'validated' | 'warning'

export const RECENT_STATUS_META: Record<RecentQueryStatus, { label: string; tone: Tone }> = {
  validated: { label: 'Validated', tone: 'green' },
  warning: { label: 'Warning', tone: 'amber' },
}

export function normalizeRecentStatus(status: string): RecentQueryStatus {
  return status === 'warning' ? 'warning' : 'validated'
}

export function formatLastUsed(iso: string): string {
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}
