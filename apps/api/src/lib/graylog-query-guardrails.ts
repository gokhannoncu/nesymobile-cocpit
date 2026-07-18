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

export function buildQuality(input: {
  identifiers: Record<string, string>
  timeRange: string
  environment: string
  llmQuality?: { verdict?: string; explanation?: string } | null
}): { verdict: 'strong' | 'broad'; explanation: string } {
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
  const identified = hasIdentifier(input.identifiers)
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

  return base
}
