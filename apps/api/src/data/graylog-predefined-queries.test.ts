import { describe, expect, it } from 'vitest'
import { getFieldsPayload, getGraylogFields } from './graylog-fields.js'
import {
  GRAYLOG_PREDEFINED_QUERY_LIBRARY,
  type GraylogPredefinedQueryCategory,
} from './graylog-predefined-queries.js'

const VALID_APPLICATIONS = new Set([
  'nesy-mobile',
  'nesy-backend',
  'nesy-fiscal',
  'nesy-d4me',
])

const VALID_SERVICES = new Set([
  'any',
  'RequestSenderService',
  'DeliveryService',
  'FiscalService',
  'AuthService',
  'LocationService',
  'NotificationService',
])

const VALID_TIME_RANGES = new Set(['15m', '1h', '6h', '24h'])

const VALID_DEVICES = new Set(['any', 'NX-4412', 'NX-2087', 'NX-3155'])

const VALID_APP_VERSIONS = new Set(['any', '4.12.0', '4.11.2', '4.10.5'])

const VALID_SOURCES = new Set([
  'mobile',
  'backend',
  'fiscal',
  'd4me',
  'notification',
  'location',
  'offline-queue',
  'auth',
])

const VALID_IDENTIFIER_KEYS = new Set([
  'shipmentId',
  'courierId',
  'scheduleId',
  'requestId',
  'deviceId',
  'fiscalId',
  'errorCode',
  'customerTicketId',
])

const VALID_CATEGORIES: GraylogPredefinedQueryCategory[] = [
  'identity',
  'delivery',
  'terminal',
  'auth',
  'scan',
  'money',
  'locker',
  'support',
]

describe('GRAYLOG_PREDEFINED_QUERY_LIBRARY', () => {
  it('contains exactly 50 unique ops queries', () => {
    expect(GRAYLOG_PREDEFINED_QUERY_LIBRARY).toHaveLength(50)
    const ids = GRAYLOG_PREDEFINED_QUERY_LIBRARY.map((q) => q.id)
    expect(new Set(ids).size).toBe(50)
    expect(Math.min(...ids)).toBe(1)
    expect(Math.max(...ids)).toBe(50)
  })

  it('has every category non-empty and valid priorities', () => {
    for (const category of VALID_CATEGORIES) {
      const count = GRAYLOG_PREDEFINED_QUERY_LIBRARY.filter((q) => q.category === category).length
      expect(count, category).toBeGreaterThan(0)
    }
    for (const q of GRAYLOG_PREDEFINED_QUERY_LIBRARY) {
      expect(['P0', 'P1', 'P2']).toContain(q.priority)
      expect(VALID_CATEGORIES).toContain(q.category)
    }
  })

  it('uses only UI-compatible application/service/time/device/source values', () => {
    for (const q of GRAYLOG_PREDEFINED_QUERY_LIBRARY) {
      expect(VALID_APPLICATIONS.has(q.application), `${q.id} application`).toBe(true)
      expect(VALID_SERVICES.has(q.service), `${q.id} service`).toBe(true)
      if (q.timeRange) {
        expect(VALID_TIME_RANGES.has(q.timeRange), `${q.id} timeRange`).toBe(true)
      }
      if (q.device) {
        expect(VALID_DEVICES.has(q.device), `${q.id} device`).toBe(true)
      }
      if (q.appVersion) {
        expect(VALID_APP_VERSIONS.has(q.appVersion), `${q.id} appVersion`).toBe(true)
      }
      if (q.sources) {
        for (const s of q.sources) {
          expect(VALID_SOURCES.has(s), `${q.id} source ${s}`).toBe(true)
        }
      }
      if (q.identifiers) {
        for (const key of Object.keys(q.identifiers)) {
          expect(VALID_IDENTIFIER_KEYS.has(key), `${q.id} identifier ${key}`).toBe(true)
        }
      }
      expect(q.label.trim().length).toBeGreaterThan(0)
      expect(q.text.trim().length).toBeGreaterThan(20)
      expect(q.reason.trim().length).toBeGreaterThan(0)
    }
  })

  it('exposes predefinedQueries on fields payload', () => {
    const payload = getFieldsPayload()
    expect(payload.predefinedQueries).toHaveLength(50)
    expect(payload.fields.length).toBeGreaterThanOrEqual(12)
  })

  it('includes verified Graylog schema fields (not invented aliases)', () => {
    const fields = new Set(getGraylogFields().map((f) => f.field))
    for (const name of [
      'Log_Data_Barcode',
      'Log_ShipmentId',
      'Log_ScheduleId',
      'Channel',
      'To',
      'From',
      'ClientVersion',
      'Log_Request_User_Username',
      'message',
    ]) {
      expect(fields.has(name), name).toBe(true)
    }
    for (const bad of ['barcode', 'requestName', 'X-Channel', 'country', 'shipmentId']) {
      expect(fields.has(bad), bad).toBe(false)
    }
  })

  it('predefined NL texts avoid unknown Graylog field aliases', () => {
    const banned = [
      /\brequestName\b/i,
      /\bX-Channel\b/i,
      /\bcountry:\s*HR\b/i,
      /\bshipmentId:/i,
      /\bcourierId:/i,
      /\bscheduleId:/i,
      /\bbarcode:/i,
    ]
    for (const q of GRAYLOG_PREDEFINED_QUERY_LIBRARY) {
      for (const pattern of banned) {
        expect(pattern.test(q.text), `${q.id} ${pattern} in: ${q.text}`).toBe(false)
      }
    }
  })

  it('marks a solid P0 set for Top ops', () => {
    const p0 = GRAYLOG_PREDEFINED_QUERY_LIBRARY.filter((q) => q.priority === 'P0')
    expect(p0.length).toBeGreaterThanOrEqual(15)
    expect(p0.length).toBeLessThanOrEqual(22)
  })
})
