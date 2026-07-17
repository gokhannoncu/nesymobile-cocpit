import { describe, expect, it } from 'vitest'
import { getCatalogPayload, MONGO_CATALOG } from './mongo-catalog.js'
import {
  examplePromptsFor,
  PREDEFINED_QUERY_LIBRARY,
  SAMPLE_LOCAL_DAY_CEST_WINDOW,
} from './mongo-predefined-queries.js'

describe('PREDEFINED_QUERY_LIBRARY', () => {
  it('contains exactly 50 unique ops queries', () => {
    expect(PREDEFINED_QUERY_LIBRARY).toHaveLength(50)
    const ids = PREDEFINED_QUERY_LIBRARY.map((q) => q.id)
    expect(new Set(ids).size).toBe(50)
    expect(Math.min(...ids)).toBe(1)
    expect(Math.max(...ids)).toBe(50)
  })

  it('references only catalog databases/collections', () => {
    const keys = new Set(MONGO_CATALOG.map((c) => `${c.database}.${c.collection}`))
    for (const q of PREDEFINED_QUERY_LIBRARY) {
      expect(keys.has(`${q.database}.${q.collection}`), `${q.id} ${q.label}`).toBe(true)
    }
  })

  it('wires example prompts from the library onto catalog collections', () => {
    const shipmentPrompts = examplePromptsFor('NESY_ShipmentDB', 'Shipment')
    expect(shipmentPrompts.length).toBeGreaterThanOrEqual(5)
    const shipmentEntry = MONGO_CATALOG.find(
      (c) => c.database === 'NESY_ShipmentDB' && c.collection === 'Shipment',
    )
    expect(shipmentEntry?.examplePrompts).toEqual(shipmentPrompts)
  })

  it('exposes predefinedQueries on catalog payload', () => {
    const payload = getCatalogPayload()
    expect(payload.predefinedQueries).toHaveLength(50)
    expect(payload.collections.some((c) => c.collection === 'AddressRouteLookUp')).toBe(true)
    expect(payload.collections.some((c) => c.collection === 'VehicleCourierZone')).toBe(true)
    expect(payload.collections.some((c) => c.collection === 'WaitingApprovalRequest')).toBe(true)
    expect(payload.collections.some((c) => c.collection === 'Inventory')).toBe(true)
  })

  it('pins every date/"today"/last-Nh filter to CEST local-midnight bounds', () => {
    // Only intents that actually filter by day/range — not mere ScheduleDate projections
    const dateSensitive = PREDEFINED_QUERY_LIBRARY.filter((q) =>
      /\btoday\b|last 24|last 7 local|PickupDate is|ScheduleDate is|ScheduleDate \$|with ScheduleDate |EndofDayRequestTime is within|ApprovalUpdatedAt is within|LoginAt is within|CreatedAt is within|ModifiedAt or CreatedAt is within/i.test(
        `${q.label} ${q.text}`,
      ),
    )
    expect(dateSensitive.length).toBeGreaterThanOrEqual(15)
    for (const q of dateSensitive) {
      const ok =
        q.text.includes(SAMPLE_LOCAL_DAY_CEST_WINDOW) ||
        (/\$gte ISODate\("2026-07-\d{2}T22:00:00\.000Z"\)/.test(q.text) &&
          q.text.includes('$lt ISODate("2026-07-17T22:00:00.000Z")'))
      expect(ok, `${q.id} ${q.label}`).toBe(true)
      expect(q.text, `${q.id} ${q.label}`).not.toMatch(/2026-07-17T00:00:00/)
    }
  })

  it('uses corrected backend field names on drifted collections', () => {
    const zone = MONGO_CATALOG.find((c) => c.collection === 'CourierZone')
    expect(zone?.keyFields.some((f) => f.field === 'Code')).toBe(true)
    expect(zone?.keyFields.some((f) => f.field === 'CourierZoneCode')).toBe(false)

    const pickup = MONGO_CATALOG.find((c) => c.collection === 'Pickup')
    expect(pickup?.keyFields.some((f) => f.field === 'PickupStatus')).toBe(true)
    expect(pickup?.keyFields.some((f) => f.field === 'ReturnCode')).toBe(true)

    const approval = MONGO_CATALOG.find((c) => c.collection === 'Approval')
    expect(approval?.keyFields.some((f) => f.field === 'ApprovalState')).toBe(true)
    expect(approval?.keyFields.some((f) => f.field === 'ScheduleId')).toBe(false)

    const tracking = MONGO_CATALOG.find((c) => c.collection === 'TrackingData')
    expect(tracking?.keyFields.some((f) => f.field === 'ScheduleId')).toBe(true)
    expect(tracking?.keyFields.some((f) => f.field === 'TrackingShipmentList')).toBe(true)

    const user = MONGO_CATALOG.find((c) => c.collection === 'User')
    expect(user?.keyFields.some((f) => f.field === 'Username')).toBe(true)
    expect(user?.keyFields.some((f) => f.field === 'Role')).toBe(true)

    const login = MONGO_CATALOG.find((c) => c.collection === 'UserLoginLog')
    expect(login?.keyFields.some((f) => f.field === 'IsSuccessful')).toBe(true)
    expect(login?.keyFields.some((f) => f.field === 'LoginAt')).toBe(true)
  })
})
