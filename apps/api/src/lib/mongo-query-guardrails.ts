const WRITE_PATTERNS: RegExp[] = [
  /\.update(?:One|Many)?\s*\(/i,
  /\.delete(?:One|Many)?\s*\(/i,
  /\.insert(?:One|Many)?\s*\(/i,
  /\.replaceOne\s*\(/i,
  /\.findAndModify\s*\(/i,
  /\.bulkWrite\s*\(/i,
  /\.drop\s*\(/i,
  /\.remove\s*\(/i,
  /\$out\b/i,
  /\$merge\b/i,
]

export class WriteQueryError extends Error {
  constructor(message = 'Generated query contains write operators and was rejected.') {
    super(message)
    this.name = 'WriteQueryError'
  }
}

export function assertReadOnlyQuery(query: string): void {
  const text = query.trim()
  for (const pattern of WRITE_PATTERNS) {
    if (pattern.test(text)) {
      throw new WriteQueryError(`Write operator matched: ${pattern}`)
    }
  }
}

/** Append limit when missing and safety toggle is on. */
export function ensureLimit(query: string, queryType: string): string {
  const text = query.trim()
  if (/\.limit\s*\(/i.test(text) || /\$limit\b/i.test(text)) {
    return text
  }

  const type = queryType.toLowerCase()
  if (type === 'aggregate') {
    if (text.endsWith('])')) {
      return text.replace(/\]\)$/, ', { $limit: 100 }\n])')
    }
    if (text.endsWith(']')) {
      return `${text.slice(0, -1)}, { $limit: 100 }\n]`
    }
    return text
  }

  if (type === 'count' || type === 'distinct') {
    return text
  }

  // Find (default): append .limit(100) before trailing semicolon if any
  if (text.endsWith(';')) {
    return `${text.slice(0, -1)}.limit(100);`
  }
  return `${text}\n.limit(100)`
}

export function deriveStatus(
  validation: Array<{ status?: string }>,
): 'validated' | 'warning' {
  return validation.some((v) => v.status === 'warn') ? 'warning' : 'validated'
}
