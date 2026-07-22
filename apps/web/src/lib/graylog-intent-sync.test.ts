import { describe, expect, it } from 'vitest'
import {
  syncIdentifierLiteralsInIntent,
  toIntentText,
} from '../data/engineering/tools/graylog-generator'

describe('syncIdentifierLiteralsInIntent', () => {
  it('rewrites shipment and barcode literals when boxes change', () => {
    const text =
      'For Log_Data_ShipmentId 84806074705579 or Log_Data_Barcode 6880051000268310 show Terminal actions'
    const out = syncIdentifierLiteralsInIntent(
      text,
      { shipmentId: '84806074705579', barcode: '6880051000268310' },
      { shipmentId: '111', barcode: '222' },
    )
    expect(out).toContain('Log_Data_ShipmentId 111')
    expect(out).toContain('Log_Data_Barcode 222')
    expect(out).not.toContain('84806074705579')
  })

  it('ignores empty or tiny previous values', () => {
    const text = 'courier 12 did DeliverParcels'
    expect(
      syncIdentifierLiteralsInIntent(text, { courierId: '12' }, { courierId: '9999' }),
    ).toBe(text)
  })

  it('removes barcode literal when the barcode box is cleared', () => {
    const text =
      'For Log_Data_ShipmentId 84806074705579 or Log_Data_LegacySystemShortBarcode / Log_Data_Barcode 6880051000268310 (also match message), show Terminal actions'
    const out = syncIdentifierLiteralsInIntent(
      text,
      { shipmentId: '84806074705579', barcode: '6880051000268310' },
      { shipmentId: '84806074705579', barcode: '' },
    )
    expect(out).toContain('84806074705579')
    expect(out).not.toContain('6880051000268310')
    expect(out).not.toMatch(/Log_Data_Barcode/i)
  })
})

describe('toIntentText', () => {
  it('strips last-N-hours phrases', () => {
    expect(toIntentText('Show logs in the last 24 hours for this shipment')).toBe(
      'Show logs for this shipment',
    )
  })
})
