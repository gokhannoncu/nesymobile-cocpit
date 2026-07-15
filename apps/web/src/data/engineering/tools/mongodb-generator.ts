// MongoDB Query Generator — mock data and constants.
// Page is completely simulated: generated query, explanation, validation and
// recent query records are fed from this file.

import type { Tone } from '@/components/product'

// ── Form options ─────────────────────────────────────────────

export const ENVIRONMENTS = ['Development', 'Test', 'UAT', 'Production'] as const
export type Environment = (typeof ENVIRONMENTS)[number]

export const DATABASES = ['nesy-delivery', 'nesy-fiscal', 'nesy-courier', 'nesy-sync'] as const

export const COLLECTIONS = [
  'deliveryRequests',
  'shipments',
  'offlineQueue',
  'fiscalRecords',
  'courierSchedules',
] as const

export const QUERY_TYPES = ['Find', 'Aggregate', 'Count', 'Distinct'] as const
export type QueryType = (typeof QUERY_TYPES)[number]

export const COUNTRIES = ['HR', 'SI', 'RS', 'BA', 'MK', 'All'] as const

export const TIME_RANGES = ['Last 1 hour', 'Last 24 hours', 'Last 7 days', 'Last 30 days', 'Custom'] as const

// ── Example requests (chips) ────────────────────────────────────

export type ExamplePrompt = { label: string; text: string }

export const EXAMPLE_PROMPTS: ExamplePrompt[] = [
  {
    label: 'Recent failed deliveries',
    text: 'Show delivery requests that failed in the HR country in the last 24 hours and have not yet been retried.',
  },
  {
    label: 'Specific shipment history',
    text: 'Get all status transitions and last update times of shipment SHP-2026-118442 in chronological order.',
  },
  {
    label: 'Pending offline requests',
    text: 'List offline requests waiting in the queue for more than 2 hours that are unsynchronized, with courier info.',
  },
  {
    label: 'Deliveries without fiscal record',
    text: 'Get completed deliveries in the last 7 days that do not have a corresponding fiscal record, grouped by country.',
  },
  {
    label: 'Last schedule record of a courier',
    text: 'Show the most up-to-date schedule record and assigned route information for courier COU-4471.',
  },
]

// ── Schema info (mock rows) ─────────────────────────────────

export type SchemaRow = { field: string; type: string; description: string; example: string }

export const SCHEMA_ROWS: SchemaRow[] = [
  {
    field: 'countryCode',
    type: 'string',
    description: 'ISO country code — queries are separated by country',
    example: '"HR"',
  },
  {
    field: 'status',
    type: 'string (enum)',
    description: 'Request status: PENDING · SENT · FAILED · COMPLETED',
    example: '"FAILED"',
  },
  {
    field: 'updatedAt',
    type: 'ISODate',
    description: 'Last status change time — the last field of the index',
    example: 'ISODate("2026-07-11T14:32:05Z")',
  },
]

// ── Security toggles ─────────────────────────────────────────

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

// ── Generated query (mock result) ──────────────────────────────────

export const GENERATED_QUERY = {
  code: `db.deliveryRequests.find({
  countryCode: "HR",
  status: "FAILED",
  isWaiting: false,
  updatedAt: {
    $gte: ISODate("2026-07-11T00:00:00Z")
  }
})
.sort({ updatedAt: -1 })
.limit(100)`,
  summary: 'Collection: deliveryRequests · Filter: 4 conditions · Sort: updatedAt DESC · Limit: 100',
}

export const EXPLANATION_STEPS: string[] = [
  'In the deliveryRequests collection, only records belonging to the HR country are checked (countryCode: "HR").',
  'Requests with status FAILED are filtered — successful or pending records are excluded.',
  'Records waiting in the retry queue are excluded with the isWaiting: false condition; only those not yet retried remain.',
  'The updatedAt field is narrowed to the last 24 hours (>= 11 Jul 2026 00:00 UTC) — time range guardrail is applied.',
  'Results are sorted descending by the updatedAt field: the newest failure appears at the top.',
  'The query returns a maximum of 100 documents — result limit guardrail is applied.',
]

// ── Validation checks ───────────────────────────────────────

export type ValidationStatus = 'pass' | 'warn'

export type ValidationCheck = {
  id: string
  label: string
  detail: string
  status: ValidationStatus
}

export const VALIDATION_CHECKS: ValidationCheck[] = [
  {
    id: 'syntax',
    label: 'Syntax valid',
    detail: 'Query is compatible with MongoDB 6.x syntax; no parse error.',
    status: 'pass',
  },
  {
    id: 'collection',
    label: 'Collection found',
    detail: 'deliveryRequests exists in nesy-delivery database (last schema sync: 12 Jul 2026).',
    status: 'pass',
  },
  {
    id: 'fields',
    label: 'Fields matched',
    detail:
      'isWaiting field is present in only 62% of collection records. Missing fields might be excluded from the query.',
    status: 'warn',
  },
  {
    id: 'readonly',
    label: 'Read-only',
    detail: 'Query does not modify data; no write operator included.',
    status: 'pass',
  },
  {
    id: 'timeRange',
    label: 'Time range applied',
    detail: 'updatedAt filter is limited to the last 24 hours.',
    status: 'pass',
  },
  {
    id: 'limit',
    label: 'Limit applied',
    detail: '.limit(100) added — result set is limited.',
    status: 'pass',
  },
]

// ── Estimated Scope ──────────────────────────────────────────────

export type EstimatedScope = {
  documents: string
  index: string | null
  response: string
  /** Amber message to display when no index is found. */
  noIndexWarning: string
}

export const ESTIMATED_SCOPE: EstimatedScope = {
  documents: '12.4K',
  index: 'countryCode_1_status_1_updatedAt_-1',
  response: '< 800 ms',
  noIndexWarning: 'No suitable index found for this filter combination.',
}

// ── Guardrail messages ──────────────────────────────────────────

export const PRODUCTION_NOTICE =
  'Production queries are generated read-only. Result limit and time range are automatically applied.'

export const WRITE_INTENT_NOTICE =
  'This tool only generates read-only queries. The approved database operations process must be used for update and delete operations.'

/** Is there write intent (update/delete/etc) in the natural language text? */
export function hasWriteIntent(text: string): boolean {
  return /(update|delete|remove|drop\\b)/i.test(
    text.toLocaleLowerCase('en-US'),
  )
}

// ── Recent Queries ───────────────────────────────────────────────

export type RecentQueryStatus = 'validated' | 'warning'

export const RECENT_STATUS_META: Record<RecentQueryStatus, { label: string; tone: Tone }> = {
  validated: { label: 'Validated', tone: 'green' },
  warning: { label: 'Warning', tone: 'amber' },
}

export type RecentQuery = {
  id: string
  name: string
  collection: string
  environment: Environment
  queryType: QueryType
  createdBy: string
  lastUsed: string
  status: RecentQueryStatus
  naturalLanguage: string
  query: string
  explanation: string[]
  validationHistory: { date: string; result: string; status: RecentQueryStatus }[]
  relatedTicket: string | null
  relatedIncident: string | null
  owner: string
}

export const RECENT_QUERIES: RecentQuery[] = [
  {
    id: 'q-failed-hr',
    name: 'Failed HR deliveries',
    collection: 'deliveryRequests',
    environment: 'Production',
    queryType: 'Find',
    createdBy: 'B. Kovačević',
    lastUsed: '12 Jul 2026 · 09:41',
    status: 'validated',
    naturalLanguage:
      'Show delivery requests that failed in the HR country in the last 24 hours and have not yet been retried.',
    query: GENERATED_QUERY.code,
    explanation: [
      'Requests in FAILED status in HR country are filtered.',
      'Those waiting in the retry queue (isWaiting: true) are excluded.',
      'Last 24 hours window and 100 record limit are automatically applied.',
    ],
    validationHistory: [
      { date: '12 Jul 2026', result: '6/6 checks passed — with isWaiting scope warning', status: 'validated' },
      { date: '08 Jul 2026', result: 'Index suggestion updated (updatedAt added)', status: 'validated' },
    ],
    relatedTicket: 'FT-0142 · HR delivery retry loop',
    relatedIncident: 'INC-2036 · HR delivery backlog',
    owner: 'Delivery Ops',
  },
  {
    id: 'q-offline-queue',
    name: 'Pending offline queue',
    collection: 'offlineQueue',
    environment: 'Production',
    queryType: 'Find',
    createdBy: 'G. Oncu',
    lastUsed: '11 Jul 2026 · 17:05',
    status: 'warning',
    naturalLanguage:
      'List offline requests waiting in the queue for more than 2 hours that are unsynchronized, with courier info.',
    query: `db.offlineQueue.find({
  syncStatus: "PENDING",
  enqueuedAt: {
    $lte: ISODate("2026-07-11T15:00:00Z")
  }
})
.sort({ enqueuedAt: 1 })
.limit(100)`,
    explanation: [
      'Enqueued records with sync status PENDING are filtered.',
      '2-hour threshold is calculated over enqueuedAt; oldest waiting at the top.',
      'Courier info requires separate lookup — only courierId returns in Find version.',
    ],
    validationHistory: [
      {
        date: '11 Jul 2026',
        result: 'No index for enqueuedAt — COLLSCAN warning given',
        status: 'warning',
      },
    ],
    relatedTicket: 'FT-0137 · Offline queue swelling',
    relatedIncident: null,
    owner: 'Sync Platform',
  },
  {
    id: 'q-fiscal-recon',
    name: 'Shipment fiscal reconciliation',
    collection: 'fiscalRecords',
    environment: 'UAT',
    queryType: 'Aggregate',
    createdBy: 'M. Jurić',
    lastUsed: '10 Jul 2026 · 14:22',
    status: 'validated',
    naturalLanguage:
      'Get completed deliveries in the last 7 days that do not have a corresponding fiscal record, grouped by country.',
    query: `db.shipments.aggregate([
  { $match: {
      status: "COMPLETED",
      completedAt: { $gte: ISODate("2026-07-05T00:00:00Z") }
  } },
  { $lookup: {
      from: "fiscalRecords",
      localField: "shipmentId",
      foreignField: "shipmentId",
      as: "fiscal"
  } },
  { $match: { fiscal: { $size: 0 } } },
  { $group: { _id: "$countryCode", missing: { $sum: 1 } } },
  { $sort: { missing: -1 } },
  { $limit: 100 }
])`,
    explanation: [
      'Shipments completed in the last 7 days are matched with fiscalRecords.',
      'Those without fiscal equivalent ($size: 0) are grouped by country.',
      'The country with the most missing records is listed at the top.',
    ],
    validationHistory: [
      { date: '10 Jul 2026', result: '6/6 checks passed — lookup cost is acceptable', status: 'validated' },
    ],
    relatedTicket: 'FT-0129 · Fiscal record silently skipped',
    relatedIncident: 'INC-2031 · SI fiscal reconciliation difference',
    owner: 'Fiscal Integrations',
  },
  {
    id: 'q-courier-schedule',
    name: 'Courier schedule lookup',
    collection: 'courierSchedules',
    environment: 'Test',
    queryType: 'Find',
    createdBy: 'A. Petrović',
    lastUsed: '09 Jul 2026 · 08:55',
    status: 'validated',
    naturalLanguage: 'Show the most up-to-date schedule record and assigned route information for courier COU-4471.',
    query: `db.courierSchedules.find({
  courierId: "COU-4471"
})
.sort({ effectiveFrom: -1 })
.limit(1)`,
    explanation: [
      'Narrowed down to a single courier with courierId match.',
      'effectiveFrom sorted descending; only the most up-to-date record returns with .limit(1).',
    ],
    validationHistory: [
      { date: '09 Jul 2026', result: '6/6 checks passed — covered query', status: 'validated' },
    ],
    relatedTicket: null,
    relatedIncident: null,
    owner: 'Courier Ops',
  },
]
