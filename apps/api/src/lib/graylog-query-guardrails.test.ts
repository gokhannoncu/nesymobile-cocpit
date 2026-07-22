import { describe, expect, it } from 'vitest'
import {
  assertSearchOnlyQuery,
  buildQuality,
  deriveStatus,
  ensureValidationChecks,
  hasIdentifier,
  materializeGraylogQueryIdentifiers,
  queryHasAnglePlaceholders,
  sanitizeQueryForKnownFields,
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

  it('materializes <SHIPMENT_ID> / <BARCODE> from form identifiers', () => {
    const raw =
      '(Channel:Terminal OR Log_Request_Channel:Terminal) AND (Log_ShipmentId:"<SHIPMENT_ID>" OR Log_Data_ShipmentId:"<SHIPMENT_ID>" OR Log_Data_Barcode:"<BARCODE>" OR message:"<SHIPMENT_ID>" OR message:"<BARCODE>")'
    const out = materializeGraylogQueryIdentifiers(raw, {
      shipmentId: '84806074705579',
    })
    expect(out).toContain('Log_ShipmentId:"84806074705579"')
    expect(out).toContain('message:"84806074705579"')
    expect(queryHasAnglePlaceholders(out)).toBe(false)
    expect(out).not.toMatch(/BARCODE|SHIPMENT_ID/)
  })

  it('fills both shipment and barcode when provided', () => {
    const out = materializeGraylogQueryIdentifiers(
      'Log_ShipmentId:"<SHIPMENT_ID>" OR Log_Data_Barcode:"<BARCODE>"',
      {
        shipmentId: '84806074705579',
        barcode: '6880051000268310',
      },
    )
    expect(out).toBe(
      'Log_ShipmentId:"84806074705579" OR Log_Data_Barcode:"6880051000268310"',
    )
  })

  it('strips stale placeholder validation after materialize', () => {
    const query =
      '(Channel:Terminal) AND (Log_ShipmentId:"84806074705579" OR message:"84806074705579")'
    const checks = ensureValidationChecks({
      validation: [
        {
          id: 'placeholders',
          label: 'Placeholders require actual values',
          detail: 'Replace <SHIPMENT_ID>…',
          status: 'warn',
        },
      ],
      query,
      timeRange: '24h',
      identifiers: { shipmentId: '84806074705579' },
      environment: 'production',
    })
    expect(checks.some((c) => /placeholder/i.test(c.label))).toBe(false)
    expect(checks.some((c) => c.id === 'literals' && c.status === 'pass')).toBe(true)
  })

  it('marks broad quality when placeholders remain', () => {
    const q = buildQuality({
      identifiers: { shipmentId: '84806074705579' },
      timeRange: '24h',
      environment: 'production',
      query: 'Log_ShipmentId:"<SHIPMENT_ID>"',
      llmQuality: { verdict: 'strong', explanation: 'looks fine' },
    })
    expect(q.verdict).toBe('broad')
  })

  it('rewrites Log_ShipmentId → Log_Data_ShipmentId when missing on cluster', () => {
    const known = new Set([
      'Log_Data_ShipmentId',
      'Channel',
      'message',
      'To',
    ])
    const { query, rewrittenFields, removedFields } = sanitizeQueryForKnownFields(
      '(Log_ShipmentId:"84806074705579" OR message:"84806074705579") AND Channel:Terminal AND To:DeliverParcels',
      known,
    )
    expect(query).toContain('Log_Data_ShipmentId:"84806074705579"')
    expect(query).not.toContain('Log_ShipmentId')
    expect(rewrittenFields).toEqual([{ from: 'Log_ShipmentId', to: 'Log_Data_ShipmentId' }])
    expect(removedFields).toEqual([])
  })
})
