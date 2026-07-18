const UNSAFE_PATTERNS: RegExp[] = [
  /\bdelete\s+streams?\b/i,
  /\|\s*delete\b/i,
  /\bdrop\s+index/i,
  /\bremove\s+messages?\b/i,
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
