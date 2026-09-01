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

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

export function formatPackPublishedAt(value?: string | Date | null): string | null {
  if (value === undefined || value === null || value === '') return null
  const ms = value instanceof Date ? value.getTime() : Date.parse(String(value))
  if (!Number.isFinite(ms) || ms < 86_400_000) return null
  const date = new Date(ms)
  return `${pad2(date.getDate())}.${pad2(date.getMonth() + 1)}.${date.getFullYear()} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

export function truncateDigest(digest: string, head = 10, tail = 8): string {
  if (digest.length <= head + tail + 3) return digest
  return `${digest.slice(0, head)}…${digest.slice(-tail)}`
}
