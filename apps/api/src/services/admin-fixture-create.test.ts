import { describe, expect, it } from 'vitest'

import { createUnloadableInvoiceShipment, type InternalBffInvoke } from './admin-fixture-create.js'

function bff(replies: Record<string, { status: number; body: Record<string, unknown> }>): InternalBffInvoke {
  return async (_method, path) => {
    const hit = Object.entries(replies).find(([prefix]) => path.startsWith(prefix))
    if (!hit) throw new Error(`unexpected BFF path ${path}`)
    return hit[1]
  }
}

describe('createUnloadableInvoiceShipment', () => {
  it('returns identifiers and never asks the caller for a token', async () => {
    const shipment = await createUnloadableInvoiceShipment({
      customerId: '10330',
      invokeBff: bff({
        '/api/customers/details': {
          status: 200,
          body: {
            data: {
              customerId: '10330',
              hubId: '1',
              name: 'Fixture',
              phone: '1',
              addresses: [{ addressType: 0, name: 'A', street: 'S', city: 'BEOGRAD', zipCode: '11000', countryCode: 'RS' }],
            },
          },
        },
        '/api/shipments/create': {
          status: 200,
          body: {
            data: {
              id: 'db-1',
              shipmentId: '47446154448795',
              parcels: [{ barcode: 'N6880FULL', legacySystemShortBarcode: '6880051000294319' }],
            },
          },
        },
        '/api/shipments/details': {
          status: 200,
          body: { data: { billingOption: 'CPP on invoice', collections: [] } },
        },
        '/api/shipments/db-1/unload': {
          status: 200,
          body: { data: { status: 200 } },
        },
      }),
    })
    expect(shipment).toEqual({
      dbId: 'db-1',
      shipmentId: '47446154448795',
      scanValue: '6880051000294319',
      fullBarcode: 'N6880FULL',
      unloadStatus: 200,
    })
  })

  it('refuses a cash-collection fixture', async () => {
    await expect(
      createUnloadableInvoiceShipment({
        customerId: '10330',
        invokeBff: bff({
          '/api/customers/details': {
            status: 200,
            body: {
              data: {
                customerId: '10330',
                name: 'Fixture',
                addresses: [{ addressType: 0, street: 'S', city: 'BEOGRAD', zipCode: '11000' }],
              },
            },
          },
          '/api/shipments/create': {
            status: 200,
            body: {
              data: {
                id: 'db-1',
                shipmentId: '1',
                parcels: [{ barcode: 'N1', legacySystemShortBarcode: '6880051000294319' }],
              },
            },
          },
          '/api/shipments/details': {
            status: 200,
            body: { data: { collections: [{ serviceType: 39, collectionAmount: 650 }] } },
          },
        }),
      }),
    ).rejects.toThrow(/cash collection/)
  })
})
