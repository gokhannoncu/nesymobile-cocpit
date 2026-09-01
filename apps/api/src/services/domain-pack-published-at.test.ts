import { describe, expect, it } from 'vitest'
import {
  isMeaningfulPublishedTimestamp,
  resolveCatalogPublishedAt,
} from './domain-pack-published-at.js'

describe('domain-pack-published-at', () => {
  it('rejects epoch placeholder timestamps', () => {
    expect(isMeaningfulPublishedTimestamp('1970-01-01T00:00:00.000Z')).toBe(false)
    expect(isMeaningfulPublishedTimestamp(undefined)).toBe(false)
  })

  it('falls back to immutableAt then createdAt for published rows', () => {
    expect(
      resolveCatalogPublishedAt({
        publicationState: 'PUBLISHED',
        publishedAt: '1970-01-01T00:00:00.000Z',
        immutableAt: new Date('2026-03-15T10:30:00.000Z'),
        createdAt: new Date('2026-03-14T08:00:00.000Z'),
      }),
    ).toBe('2026-03-15T10:30:00.000Z')

    expect(
      resolveCatalogPublishedAt({
        publicationState: 'PUBLISHED',
        publishedAt: null,
        immutableAt: null,
        createdAt: new Date('2026-03-14T08:00:00.000Z'),
      }),
    ).toBe('2026-03-14T08:00:00.000Z')
  })

  it('returns undefined for non-published rows', () => {
    expect(
      resolveCatalogPublishedAt({
        publicationState: 'DRAFT',
        createdAt: new Date('2026-03-14T08:00:00.000Z'),
      }),
    ).toBeUndefined()
  })
})
