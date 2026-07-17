import { describe, expect, it } from 'vitest'
import {
  assertReadOnlyQuery,
  deriveStatus,
  ensureLimit,
  WriteQueryError,
} from './mongo-query-guardrails.js'

describe('mongo-query-guardrails', () => {
  it('rejects write operators', () => {
    expect(() => assertReadOnlyQuery('db.Shipment.updateOne({}, {})')).toThrow(WriteQueryError)
    expect(() => assertReadOnlyQuery('db.Shipment.deleteMany({})')).toThrow(WriteQueryError)
    expect(() => assertReadOnlyQuery('db.x.aggregate([{ $out: "y" }])')).toThrow(WriteQueryError)
  })

  it('allows find queries', () => {
    expect(() =>
      assertReadOnlyQuery('db.Shipment.find({ ShipmentStatus: "Delivered" }).limit(100)'),
    ).not.toThrow()
  })

  it('appends limit for find when missing', () => {
    const out = ensureLimit('db.Shipment.find({})', 'Find')
    expect(out).toContain('.limit(100)')
  })

  it('does not double-append limit', () => {
    const q = 'db.Shipment.find({}).limit(50)'
    expect(ensureLimit(q, 'Find')).toBe(q)
  })

  it('derives warning status', () => {
    expect(deriveStatus([{ status: 'pass' }, { status: 'warn' }])).toBe('warning')
    expect(deriveStatus([{ status: 'pass' }])).toBe('validated')
  })
})
