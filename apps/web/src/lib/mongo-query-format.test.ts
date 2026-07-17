import { describe, expect, it } from 'vitest'
import {
  extractMongoPayload,
  formatMongoShell,
  mongoLiteralToJson,
  toCompassPasteText,
} from './mongo-query-format'

describe('formatMongoShell', () => {
  it('pretty-prints a single-line find query', () => {
    const raw =
      "db.Schedule.find({ CourierUsername: 'courier01', ScheduleDate: { $gte: ISODate('2026-07-18T00:00:00Z'), $lt: ISODate('2026-07-19T00:00:00Z') } }).limit(100)"
    const pretty = formatMongoShell(raw)
    expect(pretty).toContain('db.Schedule.find(')
    expect(pretty).toContain('CourierUsername:')
    expect(pretty.split('\n').length).toBeGreaterThan(3)
    expect(pretty).toMatch(/\.limit\(\s*100\s*\)/)
  })
})

describe('extractMongoPayload', () => {
  it('extracts find filter as JSON', () => {
    const q = formatMongoShell(
      `db.Shipment.find({ ShipmentId: "HR123", ShipmentStatus: "Delivered" }).limit(1)`,
    )
    const payload = extractMongoPayload(q)
    expect(payload?.kind).toBe('filter')
    expect(payload?.json).toEqual({
      ShipmentId: 'HR123',
      ShipmentStatus: 'Delivered',
    })
  })

  it('extracts aggregate pipeline', () => {
    const q = `db.Shipment.aggregate([{ $match: { ShipmentStatus: "Delivered" } }, { $limit: 100 }])`
    const payload = extractMongoPayload(q)
    expect(payload?.kind).toBe('pipeline')
    expect(Array.isArray(payload?.json)).toBe(true)
  })
})

describe('mongoLiteralToJson', () => {
  it('converts ISODate wrappers to Extended JSON', () => {
    const json = mongoLiteralToJson(
      `{ ScheduleDate: { $gte: ISODate("2026-07-18T00:00:00Z") } }`,
    )
    expect(json).toEqual({
      ScheduleDate: { $gte: { $date: '2026-07-18T00:00:00Z' } },
    })
  })
})

describe('toCompassPasteText', () => {
  it('returns filter MQL without db.collection.find wrapper', () => {
    const paste = toCompassPasteText(
      'db.Schedule.find({ ScheduleId: "552-18-20260630-1" }).limit(100)',
    )
    expect(paste).toBeTruthy()
    expect(paste).not.toMatch(/db\./)
    expect(paste).toContain('ScheduleId:')
    expect(paste).toContain('"552-18-20260630-1"')
  })

  it('uses ISODate() for Atlas Filter date ranges (not nested $date EJSON)', () => {
    const paste = toCompassPasteText(
      'db.Schedule.find({ CourierName: "Frano Milostić", ScheduleDate: { $gte: ISODate("2026-07-16T22:00:00.000Z"), $lt: ISODate("2026-07-17T22:00:00.000Z") } }).limit(100)',
    )
    expect(paste).toContain('ISODate("2026-07-16T22:00:00.000Z")')
    expect(paste).toContain('ISODate("2026-07-17T22:00:00.000Z")')
    expect(paste).not.toMatch(/"\$date"/)
    expect(paste).toContain('CourierName:')
  })
})
