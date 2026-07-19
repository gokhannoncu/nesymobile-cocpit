import { describe, expect, it } from 'vitest'
import { resolveFeatureDetailSections } from './feature-detail-sections'

describe('resolveFeatureDetailSections', () => {
  it('returns overview + countries when detail is missing', () => {
    expect(resolveFeatureDetailSections({ hasDetail: false, hasDiagram: false }).map((s) => s.id)).toEqual([
      'overview',
      'countries',
    ])
  })

  it('omits flow when detail exists but diagram is empty', () => {
    expect(resolveFeatureDetailSections({ hasDetail: true, hasDiagram: false }).map((s) => s.id)).toEqual([
      'overview',
      'countries',
      'ops',
    ])
  })

  it('returns full ordered list when detail and diagram exist', () => {
    expect(resolveFeatureDetailSections({ hasDetail: true, hasDiagram: true }).map((s) => s.id)).toEqual([
      'overview',
      'flow',
      'countries',
      'ops',
    ])
  })

  it('uses stable labels', () => {
    const labels = resolveFeatureDetailSections({ hasDetail: true, hasDiagram: true }).map((s) => s.label)
    expect(labels).toEqual(['Genel bakış', 'İş akışı', 'Ülkeler', 'Saha notları'])
  })
})
