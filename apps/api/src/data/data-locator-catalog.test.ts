import { describe, expect, it } from 'vitest'
import { MONGO_CATALOG } from './mongo-catalog.js'
import {
  DATA_LOCATOR_IDS,
  getCatalogPayload,
  getSourceById,
  listSources,
  resolveIntent,
} from './data-locator-catalog.js'

describe('data-locator-catalog', () => {
  it('exposes a mongo source for every MONGO_CATALOG entry', () => {
    const sources = listSources()
    for (const entry of MONGO_CATALOG) {
      const id = `mongo:${entry.database}:${entry.collection}`
      const source = sources.find((s) => s.id === id)
      expect(source, id).toBeTruthy()
      expect(source!.keyFields.length).toBeGreaterThan(0)
      expect(source!.keyFields[0]?.name).toBe(entry.keyFields[0]?.field)
    }
  })

  it('includes verified mobile sources', () => {
    expect(getSourceById(DATA_LOCATOR_IDS.MOBILE_CHUNK)?.name).toBe('ScheduleStopChunk')
    expect(getSourceById(DATA_LOCATOR_IDS.MOBILE_REQUEST)?.name).toBe('Request')
    expect(getSourceById(DATA_LOCATOR_IDS.MOBILE_FORCE)?.name).toBe('forceLoadBarcodeList')
    expect(getSourceById(DATA_LOCATOR_IDS.MOBILE_PAID)?.sourceType).toBe('Memory State')
  })

  it('resolves shipment intent to Shipment primary', () => {
    const intent = resolveIntent('Shipment nerede tutulur?')
    expect(intent?.id).toBe('shipment-location')
    expect(intent?.results[0]?.sourceId).toBe(DATA_LOCATOR_IDS.SHIPMENT)
  })

  it('resolves offline queue intent to Request entity', () => {
    const intent = resolveIntent('offline queue RequestSender')
    expect(intent?.id).toBe('offline-queue')
    expect(intent?.results[0]?.sourceId).toBe(DATA_LOCATOR_IDS.MOBILE_REQUEST)
  })

  it('catalog payload includes filter options and intents', () => {
    const payload = getCatalogPayload()
    expect(payload.sources.length).toBeGreaterThan(20)
    expect(payload.intents.some((i) => i.chipLabel)).toBe(true)
    expect(payload.filterOptions.domains.length).toBeGreaterThan(0)
    expect(payload.recipes).toHaveLength(3)
  })
})
