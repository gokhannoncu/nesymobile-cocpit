import { describe, expect, it } from 'vitest'
import type { InteractionEvent } from '@/data/debug-view/types'
import {
  buildInteractionExport,
  filterInteractions,
  filterInteractionsForCounts,
  interactionExportFilename,
} from './filter-interactions'

function evt(partial: Partial<InteractionEvent> & Pick<InteractionEvent, 'id' | 'kind' | 'timestamp'>): InteractionEvent {
  return {
    offsetMs: 0,
    screen: 'ScreenA',
    label: 'Label',
    detail: null,
    analyticsEvent: null,
    ...partial,
  }
}

// Fixture accessor: fails loudly instead of silently passing `undefined` into the
// export builder when an index is out of range (noUncheckedIndexedAccess).
function sampleAt(index: number): InteractionEvent {
  const event = sample[index]
  if (!event) throw new Error(`sample fixture missing at index ${index}`)
  return event
}

const sample: InteractionEvent[] = [
  evt({
    id: '1',
    kind: 'click',
    timestamp: '2026-07-22T10:00:00.000Z',
    screen: 'LoginFragment',
    label: 'Login clicked',
    detail: 'btnLogin',
  }),
  evt({
    id: '2',
    kind: 'scan',
    timestamp: '2026-07-22T11:00:00.000Z',
    screen: 'DeliveryFragment',
    label: 'Barcode scanned',
    detail: 'HR123',
    analyticsEvent: 'scanOk',
  }),
  evt({
    id: '3',
    kind: 'network',
    timestamp: '2026-07-22T12:00:00.000Z',
    screen: 'DeliveryFragment',
    label: 'DeliverParcels',
    detail: null,
  }),
]

describe('filterInteractions', () => {
  it('filters by kind', () => {
    expect(filterInteractions(sample, { kind: 'scan', from: '', to: '', search: '' }).map((e) => e.id)).toEqual([
      '2',
    ])
  })

  it('filters by date range (inclusive bounds)', () => {
    const filtered = filterInteractions(sample, {
      kind: 'all',
      from: '2026-07-22T10:30:00.000Z',
      to: '2026-07-22T11:30:00.000Z',
      search: '',
    })
    expect(filtered.map((e) => e.id)).toEqual(['2'])
  })

  it('returns empty when from > to', () => {
    expect(
      filterInteractions(sample, {
        kind: 'all',
        from: '2026-07-22T12:00:00.000Z',
        to: '2026-07-22T10:00:00.000Z',
        search: '',
      }),
    ).toEqual([])
  })

  it('searches label, detail, screen, analyticsEvent case-insensitively', () => {
    expect(filterInteractions(sample, { kind: 'all', from: '', to: '', search: 'hr123' }).map((e) => e.id)).toEqual([
      '2',
    ])
    expect(filterInteractions(sample, { kind: 'all', from: '', to: '', search: 'SCANOK' }).map((e) => e.id)).toEqual([
      '2',
    ])
    expect(
      filterInteractions(sample, { kind: 'all', from: '', to: '', search: 'loginfragment' }).map((e) => e.id),
    ).toEqual(['1'])
  })

  it('combines kind + search + date', () => {
    const filtered = filterInteractions(sample, {
      kind: 'network',
      from: '2026-07-22T11:30:00.000Z',
      to: '',
      search: 'deliver',
    })
    expect(filtered.map((e) => e.id)).toEqual(['3'])
  })

  it('count base ignores kind so chip counts stay useful', () => {
    const base = filterInteractionsForCounts(sample, { from: '', to: '', search: 'delivery' })
    expect(base.map((e) => e.id)).toEqual(['2', '3'])
  })
})

describe('buildInteractionExport', () => {
  it('builds chronological payload matching filter snapshot', () => {
    const filtered = filterInteractions(sample, { kind: 'all', from: '', to: '', search: '' })
    const payload = buildInteractionExport({
      events: filtered,
      filters: { kind: 'click', from: '2026-07-22T09:00', to: '', search: '  x  ' },
      device: { serial: 'R5CT123', name: 'Samsung SM-A346E' },
      exportedAt: '2026-07-22T13:56:00.000Z',
    })

    expect(payload).toEqual({
      exportedAt: '2026-07-22T13:56:00.000Z',
      device: { serial: 'R5CT123', name: 'Samsung SM-A346E' },
      filters: { kind: 'click', from: '2026-07-22T09:00', to: null, search: 'x' },
      count: 3,
      events: [sample[0], sample[1], sample[2]],
    })
    expect(payload.events.every((e) => !('repeatCount' in e))).toBe(true)
  })

  it('sorts newest-first input into ascending chronological order', () => {
    const payload = buildInteractionExport({
      events: [sampleAt(2), sampleAt(0)],
      filters: { kind: 'all', from: '', to: '', search: '' },
      device: { serial: 'a', name: 'b' },
      exportedAt: '2026-07-22T00:00:00.000Z',
    })
    expect(payload.events.map((e) => e.id)).toEqual(['1', '3'])
  })
})

describe('interactionExportFilename', () => {
  it('sanitizes serial and embeds ISO timestamp', () => {
    expect(interactionExportFilename('ab:cd/ef', new Date('2026-07-22T13:56:00.000Z'))).toBe(
      'interactions-ab_cd_ef-2026-07-22T13-56-00-000Z.json',
    )
  })
})
