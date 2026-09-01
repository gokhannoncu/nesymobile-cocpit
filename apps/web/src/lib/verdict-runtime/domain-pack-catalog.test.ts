import { describe, expect, it } from 'vitest'
import type { DomainPackSummary } from './types'
import {
  formatPackPublishedAt,
  formatPackPublishedAtParts,
  groupDomainPackCatalog,
  truncateDigest,
} from './domain-pack-catalog'

const pack = (
  partial: Partial<DomainPackSummary> & Pick<DomainPackSummary, 'packKey' | 'version'>,
): DomainPackSummary => ({
  bundleDigest: 'sha256:abc',
  publicationState: 'PUBLISHED',
  revision: 1,
  ...partial,
})

describe('groupDomainPackCatalog', () => {
  it('groups versions under packKey and sorts newest first', () => {
    const groups = groupDomainPackCatalog([
      pack({ packKey: 'nesy.courier', version: '1.34.0' }),
      pack({ packKey: 'acme.demo', version: '1.0.0' }),
      pack({ packKey: 'nesy.courier', version: '1.36.0' }),
      pack({ packKey: 'nesy.courier', version: '1.35.0' }),
    ])

    expect(groups).toHaveLength(2)
    expect(groups[0]?.packKey).toBe('acme.demo')
    expect(groups[1]?.packKey).toBe('nesy.courier')
    expect(groups[1]?.versions.map((item) => item.version)).toEqual([
      '1.36.0',
      '1.35.0',
      '1.34.0',
    ])
  })
})

describe('formatPackPublishedAt', () => {
  it('returns null for missing or epoch-like timestamps', () => {
    expect(formatPackPublishedAt(undefined)).toBeNull()
    expect(formatPackPublishedAt('1970-01-01T00:00:00.000Z')).toBeNull()
  })

  it('formats a real publish timestamp as a compact local date', () => {
    const label = formatPackPublishedAt('2026-09-01T20:07:34.276Z')
    expect(label).toMatch(/^\d{2}\.\d{2}\.2026 \d{2}:\d{2}$/)
  })
})

describe('formatPackPublishedAtParts', () => {
  it('returns stacked date and time parts', () => {
    const parts = formatPackPublishedAtParts('2026-09-01T20:07:34.276Z')
    expect(parts).not.toBeNull()
    expect(parts?.date).toMatch(/^\d{2}\.\d{2}\.2026$/)
    expect(parts?.time).toMatch(/^\d{2}:\d{2}$/)
    expect(formatPackPublishedAt('2026-09-01T20:07:34.276Z')).toBe(`${parts?.date} ${parts?.time}`)
  })
})

describe('truncateDigest', () => {
  it('shortens long digests', () => {
    expect(truncateDigest('sha256:0123456789abcdef')).toMatch(/…/)
  })
})
