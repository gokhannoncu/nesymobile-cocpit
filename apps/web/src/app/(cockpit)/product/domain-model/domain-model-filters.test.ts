import { describe, expect, it } from 'vitest'
import type { DomainEntity, EntityCategory } from '@/data/product/domain-glossary'
import {
  entityMatchesCategory,
  filterEntities,
  resolveSelection,
} from './domain-model-filters'

function stub(partial: Partial<DomainEntity> & Pick<DomainEntity, 'id' | 'name'>): DomainEntity {
  return {
    turkishName: partial.name,
    aliases: [],
    level: 0,
    parentId: null,
    childIds: [],
    icon: 'Package',
    color: 'gray',
    definition: '',
    businessContext: '',
    technicalContext: '',
    cardinality: '1:N',
    cardinalityDesc: '',
    screens: [],
    antiPatterns: [],
    statuses: [],
    transitions: [],
    keyAttributes: [],
    relatedEntities: [],
    prerequisiteIds: [],
    ...partial,
  }
}

const categoryOf = (e: DomainEntity): EntityCategory =>
  e.id === 'hub' ? 'transfer' : e.id === 'schedule' ? 'planning' : 'delivery'

const matchesQuery = (e: DomainEntity, q: string) =>
  !q || e.name.toLowerCase().includes(q.toLowerCase())

describe('entityMatchesCategory', () => {
  it('allows all categories when filter is all', () => {
    expect(entityMatchesCategory(stub({ id: 'hub', name: 'Hub' }), 'all', categoryOf)).toBe(true)
  })

  it('matches only the selected category', () => {
    expect(entityMatchesCategory(stub({ id: 'hub', name: 'Hub' }), 'transfer', categoryOf)).toBe(true)
    expect(entityMatchesCategory(stub({ id: 'schedule', name: 'Schedule' }), 'transfer', categoryOf)).toBe(false)
  })
})

describe('filterEntities', () => {
  const list = [
    stub({ id: 'schedule', name: 'Schedule' }),
    stub({ id: 'hub', name: 'Hub' }),
    stub({ id: 'shipment', name: 'Shipment' }),
  ]

  it('applies search and category together', () => {
    const result = filterEntities(list, 'hu', 'transfer', matchesQuery, categoryOf)
    expect(result.map((e) => e.id)).toEqual(['hub'])
  })

  it('returns empty when nothing matches', () => {
    expect(filterEntities(list, 'zzz', 'all', matchesQuery, categoryOf)).toEqual([])
  })
})

describe('resolveSelection', () => {
  const schedule = stub({ id: 'schedule', name: 'Schedule' })
  const hub = stub({ id: 'hub', name: 'Hub' })

  it('keeps selection when still visible', () => {
    expect(resolveSelection('hub', [schedule], [hub])).toBe('hub')
  })

  it('falls back to first chain then first cross-cutting', () => {
    expect(resolveSelection('missing', [schedule], [hub])).toBe('schedule')
    expect(resolveSelection('missing', [], [hub])).toBe('hub')
  })

  it('returns null when nothing visible', () => {
    expect(resolveSelection('schedule', [], [])).toBe(null)
  })
})
