const UNSAFE_PATTERNS: RegExp[] = [
  /\bdelete\s+streams?\b/i,
  /\|\s*delete\b/i,
  /\bdrop\s+index/i,
  /\bremove\s+messages?\b/i,
]

/**
 * Fields that do NOT exist on NESY Graylog indices (verified HR prod).
 * Matching `field:` usage returns 0 / UI "Unknown field" warnings.
 */
const UNKNOWN_FIELD_PATTERNS: Array<{ field: string; pattern: RegExp; hint: string }> = [
  {
    field: 'barcode',
    pattern: /(^|[\s(])barcode\s*:/i,
    hint: 'Use Log_Data_Barcode / Log_Barcode / message:"…" instead of barcode:',
  },
  {
    field: 'requestName',
    pattern: /(^|[\s(])requestName\s*:/i,
    hint: 'Use To:DeliverParcels / From:… / message:"Task/…" instead of requestName:',
  },
  {
    field: 'X-Channel',
    pattern: /(^|[\s(])X-Channel\s*:/i,
    hint: 'Use Channel:Terminal or Log_Request_Channel:Terminal instead of X-Channel:',
  },
  {
    field: 'country',
    pattern: /(^|[\s(])country\s*:/i,
    hint: 'Do not filter country: — pick the country Graylog cluster (HR/SI/…).',
  },
  {
    field: 'shipmentId',
    pattern: /(^|[\s(])shipmentId\s*:/i,
    hint: 'Use Log_ShipmentId / Log_Data_ShipmentId / message:"…" instead of shipmentId:',
  },
  {
    field: 'courierId',
    pattern: /(^|[\s(])courierId\s*:/i,
    hint: 'Use Log_RequestData_CourierId / Log_CourierUserId / Log_Request_User_Username instead of courierId:',
  },
  {
    field: 'scheduleId',
    pattern: /(^|[\s(])scheduleId\s*:/i,
    hint: 'Use Log_ScheduleId instead of scheduleId:',
  },
  {
    field: 'deviceId',
    pattern: /(^|[\s(])deviceId\s*:/i,
    hint: 'No deviceId field — search message:"…" for the device token.',
  },
  {
    field: 'appVersion',
    pattern: /(^|[\s(])appVersion\s*:/i,
    hint: 'Use ClientVersion or Log_Request_LogProperties_ClientVersion instead of appVersion:',
  },
  {
    field: 'username',
    pattern: /(^|[\s(])username\s*:/i,
    hint: 'Use Log_Request_User_Username instead of username:',
  },
  {
    field: 'requestId',
    pattern: /(^|[\s(])requestId\s*:/i,
    hint: 'Use MessageId / Log_Request_MessageId / Log_CorrelationId instead of requestId:',
  },
  {
    field: 'fiscalId',
    pattern: /(^|[\s(])fiscalId\s*:/i,
    hint: 'No fiscalId field — search message:"…" or Log_ShipmentId.',
  },
  {
    field: 'errorCode',
    pattern: /(^|[\s(])errorCode\s*:/i,
    hint: 'Use Log_Code / ResultCode / message:"…" instead of errorCode:',
  },
]

export class UnsafeGraylogQueryError extends Error {
  constructor(message = 'Generated query contains unsafe Graylog operations and was rejected.') {
    super(message)
    this.name = 'UnsafeGraylogQueryError'
  }
}

export function assertSearchOnlyQuery(query: string): void {
  const text = query.trim()
  for (const pattern of UNSAFE_PATTERNS) {
    if (pattern.test(text)) {
      throw new UnsafeGraylogQueryError(`Unsafe operator matched: ${pattern}`)
    }
  }
  for (const item of UNKNOWN_FIELD_PATTERNS) {
    if (item.pattern.test(text)) {
      throw new UnsafeGraylogQueryError(
        `Unknown Graylog field "${item.field}:" — ${item.hint}`,
      )
    }
  }
}

export function deriveStatus(validation: Array<{ status?: string }>): 'validated' | 'warning' {
  return validation.some((v) => v.status === 'warn') ? 'warning' : 'validated'
}

export function hasIdentifier(
  identifiers: Record<string, string> | null | undefined,
): boolean {
  if (!identifiers) return false
  return Object.values(identifiers).some((v) => String(v ?? '').trim().length > 0)
}

/** UI identifier keys → angle-bracket / brace placeholder names Claude often emits. */
const IDENTIFIER_PLACEHOLDER_ALIASES: Record<string, string[]> = {
  shipmentId: ['SHIPMENT_ID', 'shipmentId', 'shipment_id', 'ShipmentId'],
  barcode: [
    'BARCODE',
    'barcode',
    'Barcode',
    'LEGACY_BARCODE',
    'SHORT_BARCODE',
    'FULL_BARCODE',
  ],
  scheduleId: ['SCHEDULE_ID', 'scheduleId', 'schedule_id', 'ScheduleId'],
  courierId: [
    'COURIER_ID',
    'courierId',
    'courier_id',
    'CourierId',
    'USERNAME',
    'username',
  ],
  deviceId: ['DEVICE_ID', 'deviceId', 'device_id', 'DeviceId'],
  requestId: ['REQUEST_ID', 'requestId', 'request_id', 'MESSAGE_ID', 'MessageId'],
  fiscalId: ['FISCAL_ID', 'fiscalId', 'fiscal_id'],
  errorCode: ['ERROR_CODE', 'errorCode', 'error_code'],
  customerTicketId: ['CUSTOMER_TICKET_ID', 'TICKET_ID', 'ticketId', 'TicketId'],
}

const ANGLE_PLACEHOLDER_RE = /<[A-Za-z][A-Za-z0-9_]*>/

/** True when Lucene still contains `<PLACEHOLDER>` tokens. */
export function queryHasAnglePlaceholders(query: string): boolean {
  return ANGLE_PLACEHOLDER_RE.test(query)
}

function cleanupLuceneAfterPlaceholderDrop(query: string): string {
  let out = query
  for (let i = 0; i < 6; i++) {
    const prev = out
    out = out.replace(/\(\s*\)/g, '')
    out = out.replace(/\(\s*(?:AND|OR)\s+/gi, '(')
    out = out.replace(/\s*(?:AND|OR)\s*\)/gi, ')')
    out = out.replace(/\b(?:AND|OR)(\s+(?:AND|OR))+/gi, '$1')
    out = out.replace(/^\s*(?:AND|OR)\s+/i, '')
    out = out.replace(/\s+(?:AND|OR)\s*$/i, '')
    out = out.replace(/\s{2,}/g, ' ').trim()
    if (out === prev) break
  }
  return out
}

/**
 * Replace Claude template tokens (`<SHIPMENT_ID>`, `{BARCODE}`, …) with the
 * concrete values from the form. Drop Lucene atoms that still reference
 * unfilled placeholders (e.g. barcode clause when only shipmentId was given).
 */
/**
 * Drop or rewrite Lucene field atoms that the target Graylog cluster does not
 * index (e.g. Log_ShipmentId exists on HR but not RS → rewrite to Log_Data_ShipmentId).
 */
export function sanitizeQueryForKnownFields(
  query: string,
  knownFields: Set<string> | Iterable<string> | null | undefined,
): { query: string; removedFields: string[]; rewrittenFields: Array<{ from: string; to: string }> } {
  const known = knownFields
    ? knownFields instanceof Set
      ? knownFields
      : new Set(knownFields)
    : null
  if (!known || known.size === 0) {
    return { query, removedFields: [], rewrittenFields: [] }
  }

  const removed = new Set<string>()
  const rewritten: Array<{ from: string; to: string }> = []
  let out = query

  // Prefer rewrite for common HR-only / alias drift before dropping.
  const rewrites: Array<{ from: string; to: string }> = [
    { from: 'Log_ShipmentId', to: 'Log_Data_ShipmentId' },
  ]
  for (const { from, to } of rewrites) {
    if (!known.has(from) && known.has(to)) {
      const re = new RegExp(`(^|[\\s(])${from}(\\s*:)`, 'g')
      if (re.test(out)) {
        out = out.replace(new RegExp(`(^|[\\s(])${from}(\\s*:)`, 'g'), `$1${to}$2`)
        rewritten.push({ from, to })
      }
    }
  }

  // Remove remaining unknown field:value atoms (keep message/source/builtins).
  const atomRe =
    /(?:\s*(?:AND|OR)\s+)?([A-Za-z_][\w.-]*)\s*:\s*(?:"[^"]*"|'[^']*'|[^\s)(]+)/g
  out = out.replace(atomRe, (full, field: string) => {
    if (known.has(field)) return full
    // Graylog builtins / analysis helpers sometimes absent from system/fields.
    if (field === 'message' || field === 'source' || field === 'timestamp' || field === '_id') {
      return full
    }
    removed.add(field)
    return ''
  })

  out = cleanupLuceneAfterPlaceholderDrop(out)
  return { query: out, removedFields: [...removed].sort(), rewrittenFields: rewritten }
}

export function materializeGraylogQueryIdentifiers(
  query: string,
  identifiers: Record<string, string> | null | undefined,
): string {
  let out = query
  const filled = Object.entries(identifiers ?? {})
    .map(([k, v]) => [k, String(v ?? '').trim()] as const)
    .filter(([, v]) => v.length > 0)

  for (const [key, value] of filled) {
    const names = IDENTIFIER_PLACEHOLDER_ALIASES[key] ?? [key, key.toUpperCase()]
    for (const name of names) {
      out = out.split(`<${name}>`).join(value)
      out = out.split(`{${name}}`).join(value)
    }
  }

  // Remove field:"…<STILL_EMPTY>…" and field:<STILL_EMPTY> atoms (incl. leading AND/OR).
  out = out.replace(
    /(?:\s*(?:AND|OR)\s+)?[A-Za-z_][\w.]*\s*:\s*"(?:[^"]*<[A-Za-z][A-Za-z0-9_]*>[^"]*)"/gi,
    '',
  )
  out = out.replace(
    /(?:\s*(?:AND|OR)\s+)?[A-Za-z_][\w.]*\s*:\s*<[A-Za-z][A-Za-z0-9_]*>/gi,
    '',
  )
  // Bare remaining placeholders in message text
  out = out.replace(/<[A-Za-z][A-Za-z0-9_]*>/g, '')

  return cleanupLuceneAfterPlaceholderDrop(out)
}

export function buildQuality(input: {
  identifiers: Record<string, string>
  timeRange: string
  environment: string
  query?: string
  llmQuality?: { verdict?: string; explanation?: string } | null
}): { verdict: 'strong' | 'broad'; explanation: string } {
  const identified = hasIdentifier(input.identifiers)
  const hasPlaceholders = input.query ? queryHasAnglePlaceholders(input.query) : false

  if (identified && !hasPlaceholders) {
    return {
      verdict: 'strong',
      explanation: 'Form identifiers are embedded as literal values in the Lucene query.',
    }
  }
  if (hasPlaceholders) {
    return {
      verdict: 'broad',
      explanation:
        'Query still has <PLACEHOLDER> tokens — replace them with form identifiers before running.',
    }
  }
  if (input.llmQuality?.verdict === 'strong' || input.llmQuality?.verdict === 'broad') {
    return {
      verdict: input.llmQuality.verdict,
      explanation:
        input.llmQuality.explanation?.trim() ||
        (input.llmQuality.verdict === 'strong'
          ? 'Search scope looks narrow enough.'
          : 'Search scope looks broad — add an identifier or shorten the time range.'),
    }
  }
  if (!identified && (input.timeRange === '24h' || input.timeRange === 'custom')) {
    return {
      verdict: 'broad',
      explanation:
        'No identifier with a wide time range. Add shipmentId, requestId, or a service filter.',
    }
  }
  if (identified) {
    return {
      verdict: 'strong',
      explanation: 'An identifier narrows the search scope.',
    }
  }
  return {
    verdict: 'broad',
    explanation: 'No strong identifier — results may be noisy.',
  }
}

export function ensureValidationChecks(input: {
  validation: Array<{ id?: string; label?: string; detail?: string; status?: string }>
  query: string
  timeRange: string
  identifiers: Record<string, string>
  environment: string
}): Array<{ id: string; label: string; detail: string; status: 'pass' | 'warn' }> {
  const base = input.validation
    .filter((v) => v && (v.label || v.id))
    .map((v, i) => ({
      id: String(v.id ?? `check-${i}`),
      label: String(v.label ?? 'Check'),
      detail: String(v.detail ?? ''),
      status: (v.status === 'warn' ? 'warn' : 'pass') as 'pass' | 'warn',
    }))

  const hasTimeHint =
    /\d+\s*(m|h|d)\b/i.test(input.query) ||
    /timestamp|from:|to:/i.test(input.query) ||
    Boolean(input.timeRange)
  if (!base.some((c) => c.id === 'time')) {
    base.push({
      id: 'time',
      label: 'Time range',
      detail: hasTimeHint
        ? `Context time range: ${input.timeRange}`
        : 'No explicit time filter in query string — rely on Graylog UI range.',
      status: input.timeRange ? 'pass' : 'warn',
    })
  }

  if (!hasIdentifier(input.identifiers) && input.timeRange === '24h') {
    if (!base.some((c) => c.id === 'scope')) {
      base.push({
        id: 'scope',
        label: 'Search scope',
        detail: '24h without identifier — broad volume risk.',
        status: 'warn',
      })
    }
  }

  // Drop LLM "fill the placeholders" warnings once literals are materialized.
  const cleaned = queryHasAnglePlaceholders(input.query)
    ? base
    : base.filter((c) => !/placeholder/i.test(`${c.label} ${c.detail}`))

  if (queryHasAnglePlaceholders(input.query) && !cleaned.some((c) => c.id === 'placeholders')) {
    cleaned.push({
      id: 'placeholders',
      label: 'Placeholders require actual values',
      detail:
        'Query still contains <PLACEHOLDER> tokens. Fill identifiers on the form and regenerate.',
      status: 'warn',
    })
  }

  // Prefer identifier-based scope once literals are in the query.
  if (
    hasIdentifier(input.identifiers) &&
    !queryHasAnglePlaceholders(input.query) &&
    !cleaned.some((c) => c.id === 'literals')
  ) {
    const used = Object.entries(input.identifiers)
      .filter(([, v]) => String(v ?? '').trim())
      .map(([k, v]) => `${k}=${String(v).trim()}`)
      .join(', ')
    cleaned.push({
      id: 'literals',
      label: 'Form identifiers embedded',
      detail: `Concrete values from the form are in the Lucene string (${used}).`,
      status: 'pass',
    })
  }

  return cleaned
}
