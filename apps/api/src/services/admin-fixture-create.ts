/**
 * Builds one unpaid CPP-on-invoice singleton using the process-local admin
 * cache. The fixture never receives the bearer; only shipment identifiers.
 */

export interface InternalBffResponse {
  status: number
  body: Record<string, unknown>
}

export type InternalBffInvoke = (
  method: 'GET' | 'POST',
  path: string,
  body?: Record<string, unknown>,
) => Promise<InternalBffResponse>

export interface FixtureShipment {
  dbId: string
  shipmentId: string
  scanValue: string
  fullBarcode: string
  unloadStatus: unknown
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}

function extractParcels(data: unknown): Array<{ barcode: string; legacy?: string; short?: string }> {
  if (Array.isArray(data)) return data.flatMap((item) => extractParcels(item))
  if (data == null || typeof data !== 'object') return []
  const record = data as Record<string, unknown>
  const parcels = record.parcels ?? record.Parcels ?? record.parcelList ?? record.ParcelList ?? record.items ?? []
  const mapped = (Array.isArray(parcels) ? parcels : [])
    .map((parcel) => {
      const row = asRecord(parcel)
      return {
        barcode: String(row.barcode ?? row.Barcode ?? ''),
        legacy: typeof row.legacySystemBarcode === 'string' ? row.legacySystemBarcode : undefined,
        short:
          typeof row.legacySystemShortBarcode === 'string'
            ? row.legacySystemShortBarcode
            : typeof row.shortBarcode === 'string'
              ? row.shortBarcode
              : undefined,
      }
    })
    .filter((parcel) => parcel.barcode !== '')
  if (mapped.length > 0) return mapped
  if (record.data && record.data !== data) return extractParcels(record.data)
  return []
}

function legacyShortOf(parcel: { short?: string; legacy?: string }): string | null {
  if (parcel.short) return parcel.short
  const match = typeof parcel.legacy === 'string' ? parcel.legacy.match(/688005\d{10}/) : null
  return match ? match[0] : null
}

export async function createUnloadableInvoiceShipment(input: {
  customerId: string
  invokeBff: InternalBffInvoke
}): Promise<FixtureShipment> {
  const stamp = Date.now()
  const detailsRes = await input.invokeBff('POST', '/api/customers/details', {
    customerId: input.customerId,
    customerCenter: '1',
  })
  const details = asRecord(detailsRes.body.data)
  const addresses = Array.isArray(details.addresses) ? details.addresses : []
  const addr = asRecord(addresses.find((item) => asRecord(item).addressType === 0) ?? addresses[0])
  if (detailsRes.status >= 400 || Object.keys(addr).length === 0) {
    throw new Error('no customer address for fixture create')
  }

  const phone = String(details.phone || addr.phone || '4607-000')
  const created = await input.invokeBff('POST', '/api/shipments/create', {
    parcelCount: 1,
    shipmentType: 'standard',
    billingOption: 'CPP on invoice',
    parties: {
      customer: {
        customerId: details.customerId,
        customerCenter: String(details.hubId ?? '1'),
        name: details.name,
        phone,
        gsm: details.gsm || phone,
        email: details.email ?? null,
        customerPreferences: details.customerPreferences,
        customerAlphanumericId: details.customerAlphanumericId ?? null,
        payerAddress: {
          addressType: addr.addressType ?? 0,
          name: addr.name,
          street: addr.street,
          city: addr.city,
          zipCode: addr.zipCode,
          countryCode: addr.countryCode || addr.country || 'RS',
          houseNumber: addr.houseNumber ?? null,
          doorNumber: addr.doorNumber ?? null,
          addressText: addr.addressText,
        },
      },
      shipper: {
        mode: 'existing',
        address: {
          addressType: addr.addressType ?? 0,
          name: addr.name || details.name,
          street: addr.street,
          city: addr.city,
          zipCode: addr.zipCode,
          countryCode: addr.countryCode || addr.country || 'RS',
          houseNumber: addr.houseNumber ?? null,
          doorNumber: addr.doorNumber ?? null,
          addressText: addr.addressText,
          latitude: addr.latitude,
          longitude: addr.longitude,
        },
        contact: {
          name: details.name,
          phone,
          gsm: details.gsm || phone,
          email: details.email ?? null,
          customerId: details.customerId,
          customerCenter: String(details.hubId ?? '1'),
        },
      },
      consignee: {
        mode: 'newaddress',
        isInternational: false,
        saveAddress: false,
        address: {
          addressType: 0,
          name: `HostB Fixture Consignee ${stamp}`,
          street: 'TERAZIJE',
          city: 'BEOGRAD',
          zipCode: '11000',
          countryCode: 'RS',
          houseNumber: String(1 + (stamp % 80)),
          latitude: 44.8125 + (stamp % 17) * 0.0008,
          longitude: 20.4612 + (stamp % 13) * 0.0008,
        },
        contact: {
          name: `HostB Fixture Consignee ${stamp}`,
          phone: '067000099',
          gsm: '067000099',
          email: 'hostb-fixture@test.nesy.local',
        },
      },
    },
  })
  if (created.status >= 400) {
    throw new Error(`shipments/create ${created.status}`)
  }

  const record = asRecord(created.body.data ?? created.body)
  const inner = asRecord(record.data && typeof record.data === 'object' ? record.data : record)
  let shipmentId = String(
    inner.shipmentId ?? inner.ShipmentId ?? inner.waybillNumber ?? inner.WaybillNumber ?? record.shipmentId ?? '',
  )
  let parcels = extractParcels(created.body)
  if (parcels.length === 0) parcels = extractParcels(record)
  const dbId = String(record.id ?? '')
  if (parcels.length === 0 && dbId !== '') {
    const fetched = await input.invokeBff('GET', `/api/shipments/${dbId}`)
    parcels = extractParcels(fetched.body)
    shipmentId =
      shipmentId ||
      String(asRecord(fetched.body.data).shipmentId ?? fetched.body.shipmentId ?? '')
  }
  if (parcels.length === 0 && shipmentId !== '') {
    for (let attempt = 0; attempt < 5 && parcels.length === 0; attempt += 1) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 800 * attempt))
      const searched = await input.invokeBff('POST', '/api/shipments/details', { shipmentId })
      parcels = extractParcels(searched.body)
      if (parcels.length === 0) parcels = extractParcels(searched.body.data)
    }
  }
  if (shipmentId === '' || parcels.length === 0) {
    throw new Error('create returned no shipmentId/parcels')
  }

  const priced = await input.invokeBff('POST', '/api/shipments/details', { shipmentId })
  const pricedData = asRecord(priced.body.data)
  const collections = Array.isArray(pricedData.collections) ? pricedData.collections : []
  const cashCollect = collections.find((row) => {
    const item = asRecord(row)
    return Number(item.collectionAmount ?? 0) > 0 || Number(item.serviceType) === 39
  })
  if (cashCollect) {
    throw new Error(`fixture ${shipmentId} still has cash collection`)
  }

  const unload = await input.invokeBff('POST', `/api/shipments/${dbId}/unload`, {
    barcode: parcels[0]!.barcode,
    isLastParcel: true,
    weight: '5',
  })
  if (unload.status >= 400) {
    throw new Error(`shipments/unload ${unload.status}`)
  }

  const scanValue = legacyShortOf(parcels[0]!)
  if (!scanValue) throw new Error('create returned no legacySystemShortBarcode')
  return {
    dbId,
    shipmentId,
    scanValue,
    fullBarcode: parcels[0]!.barcode,
    unloadStatus: asRecord(unload.body.data).status ?? unload.body.status ?? unload.status,
  }
}
