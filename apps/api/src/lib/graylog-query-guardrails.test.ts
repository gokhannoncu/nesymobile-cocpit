import { describe, expect, it } from 'vitest'
import {
  assertSearchOnlyQuery,
  buildQuality,
  deriveStatus,
  hasIdentifier,
  UnsafeGraylogQueryError,
} from './graylog-query-guardrails.js'

describe('graylog-query-guardrails', () => {
  it('rejects stream delete / indexer mutation syntax', () => {
    expect(() => assertSearchOnlyQuery('delete streams:abc')).toThrow(UnsafeGraylogQueryError)
    expect(() => assertSearchOnlyQuery('| delete')).toThrow(UnsafeGraylogQueryError)
  })

  it('allows Lucene using verified Graylog fields', () => {
    expect(() =>
      assertSearchOnlyQuery(
        'Channel:Terminal AND To:DeliverParcels AND Log_ScheduleId:"52-50-20260718-1"',
      ),
    ).not.toThrow()
  })

  it('rejects invented field aliases that Graylog does not index', () => {
    expect(() => assertSearchOnlyQuery('barcode:"N34B…" AND country:HR')).toThrow(
      UnsafeGraylogQueryError,
    )
    expect(() => assertSearchOnlyQuery('requestName:deliverParcels')).toThrow(
      UnsafeGraylogQueryError,
    )
    expect(() => assertSearchOnlyQuery('X-Channel:Terminal')).toThrow(UnsafeGraylogQueryError)
    expect(() => assertSearchOnlyQuery('shipmentId:"45-40-20251224-1"')).toThrow(
      UnsafeGraylogQueryError,
    )
  })

  it('detects identifiers', () => {
    expect(hasIdentifier({ shipmentId: 'x', courierId: '' })).toBe(true)
    expect(hasIdentifier({ shipmentId: '', courierId: '  ' })).toBe(false)
  })

  it('marks broad quality when 24h and no identifier', () => {
    const q = buildQuality({
      identifiers: {},
      timeRange: '24h',
      environment: 'production',
    })
    expect(q.verdict).toBe('broad')
  })

  it('marks strong when identifier present', () => {
    const q = buildQuality({
      identifiers: { shipmentId: '45-40-20251224-1' },
      timeRange: '1h',
      environment: 'production',
    })
    expect(q.verdict).toBe('strong')
  })

  it('derives warning status', () => {
    expect(deriveStatus([{ status: 'pass' }, { status: 'warn' }])).toBe('warning')
    expect(deriveStatus([{ status: 'pass' }])).toBe('validated')
  })
})
