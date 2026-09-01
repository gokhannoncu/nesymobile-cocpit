import type { DomainPackSummary } from './types'
import { comparePackVersions } from './select-published-pack'

export type DomainPackGroup = {
  packKey: string
  versions: DomainPackSummary[]
  latestPublished?: DomainPackSummary
}

export function groupDomainPackCatalog(items: readonly DomainPackSummary[]): DomainPackGroup[] {
  const byKey = new Map<string, DomainPackSummary[]>()

  for (const item of items) {
    const bucket = byKey.get(item.packKey) ?? []
    bucket.push(item)
    byKey.set(item.packKey, bucket)
  }

  return [...byKey.entries()]
    .map(([packKey, versions]) => {
      const sorted = [...versions].sort((left, right) =>
        comparePackVersions(right.version, left.version),
      )
      return {
        packKey,
        versions: sorted,
        latestPublished: sorted.find((item) => item.publicationState === 'PUBLISHED'),
      }
    })
    .sort((left, right) => left.packKey.localeCompare(right.packKey))
}

export function formatPackPublishedAt(value?: string): string | null {
  if (!value) return null
  const ms = Date.parse(value)
  if (!Number.isFinite(ms) || ms < 86_400_000) return null
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(ms)
}

export function truncateDigest(digest: string, head = 10, tail = 8): string {
  if (digest.length <= head + tail + 3) return digest
  return `${digest.slice(0, head)}…${digest.slice(-tail)}`
}
