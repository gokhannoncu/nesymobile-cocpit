/** Ignore epoch / placeholder provenance timestamps (matches web catalog formatter). */
const MEANINGFUL_PUBLISHED_MS = 86_400_000

export function isMeaningfulPublishedTimestamp(value?: string | Date | null): boolean {
  if (value === undefined || value === null) return false
  const ms = value instanceof Date ? value.getTime() : Date.parse(value)
  return Number.isFinite(ms) && ms >= MEANINGFUL_PUBLISHED_MS
}

export function resolveCatalogPublishedAt(input: {
  publicationState: string
  publishedAt?: string | Date | null
  immutableAt?: Date | null
  createdAt?: Date | null
}): string | undefined {
  if (input.publicationState !== 'PUBLISHED') return undefined

  const candidates = [input.publishedAt, input.immutableAt, input.createdAt]
  for (const value of candidates) {
    if (value === undefined || value === null) continue
    const iso = value instanceof Date ? value.toISOString() : value
    if (isMeaningfulPublishedTimestamp(iso)) return iso
  }

  return undefined
}
