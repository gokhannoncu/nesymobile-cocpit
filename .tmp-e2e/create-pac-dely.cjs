/**
 * Create + unload DELY for customer 1000 (CASH) — scan into Stop 12 PAC.
 * Do NOT load to van (PAC rejects barcodes already on any stop).
 */
const fs = require('fs')
const API = process.env.API_BASE ?? 'http://localhost:4001/api'
const COUNTRY = 'RS'
const ENV = 'stage'
const CUSTOMER_ID = '1000'
const CUSTOMER_CENTER = '1'

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(
      `${path} ${res.status}: ${json.message ?? json.error ?? JSON.stringify(json).slice(0, 300)}`,
    )
  }
  return json
}

function pickAddress(details) {
  const list = Array.isArray(details.addresses) ? details.addresses : []
  return list.find((a) => a.addressType === 0) ?? list[0]
}

function buildShipper(details, addr) {
  const phone = details.phone || addr.phone || '4607-000'
  return {
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
      customerCenter: String(details.hubId ?? CUSTOMER_CENTER),
    },
  }
}

function buildConsignee(details) {
  return {
    mode: 'newaddress',
    isInternational: false,
    saveAddress: false,
    address: {
      addressType: 0,
      name: 'PAC DELY Consignee',
      street: 'TERAZIJE',
      city: 'BEOGRAD',
      zipCode: '11000',
      countryCode: 'RS',
      houseNumber: '1',
      latitude: 44.8125,
      longitude: 20.4612,
    },
    contact: {
      name: 'PAC DELY Consignee',
      phone: '067000099',
      gsm: '067000099',
      email: 'pac-dely@test.nesy.local',
      customerId: details.customerId,
      customerCenter: String(details.hubId ?? CUSTOMER_CENTER),
    },
  }
}

function buildParties(details, shipper, consignee) {
  const payer = pickAddress(details)
  return {
    customer: {
      customerId: details.customerId,
      customerCenter: String(details.hubId ?? CUSTOMER_CENTER),
      name: details.name,
      phone: details.phone || '4607-000',
      gsm: details.gsm || details.phone || '4607-000',
      email: details.email ?? null,
      customerPreferences: details.customerPreferences,
      customerAlphanumericId: details.customerAlphanumericId ?? null,
      payerAddress: {
        addressType: payer.addressType ?? 0,
        name: payer.name,
        street: payer.street,
        city: payer.city,
        zipCode: payer.zipCode,
        countryCode: payer.countryCode || payer.country || 'RS',
        houseNumber: payer.houseNumber ?? null,
        doorNumber: payer.doorNumber ?? null,
        addressText: payer.addressText,
      },
    },
    shipper,
    consignee,
  }
}

function extractParcels(data) {
  const parcels = data?.parcels ?? data?.Parcels ?? []
  return parcels
    .map((p) => ({
      barcode: p.barcode ?? p.Barcode,
      legacy: p.legacySystemBarcode ?? p.LegacySystemBarcode,
      short: p.shortBarcode ?? p.ShortBarcode,
      seq: p.sequenceNumber ?? p.SequenceNumber,
    }))
    .filter((p) => p.barcode)
}

;(async () => {
  const login = await post('/nesy/auth/login', { country: COUNTRY, environment: ENV })
  const token = login.result.payload.token

  const detailsRes = await post('/customers/details', {
    token,
    country: COUNTRY,
    environment: ENV,
    customerId: CUSTOMER_ID,
    customerCenter: CUSTOMER_CENTER,
  })
  const details = detailsRes.data
  const addr = pickAddress(details)
  if (!addr) throw new Error('No customer address')

  const shipper = buildShipper(details, addr)
  const consignee = buildConsignee(details)
  const parties = buildParties(details, shipper, consignee)

  const created = await post('/shipments/create', {
    token,
    country: COUNTRY,
    environment: ENV,
    parcelCount: 1,
    shipmentType: 'standard',
    parties,
  })

  const record = created.data
  const shipmentId = record.data?.shipmentId ?? record.data?.ShipmentId
  const parcels = extractParcels(record.data)
  if (!shipmentId || parcels.length === 0) {
    console.log(JSON.stringify(record, null, 2).slice(0, 2500))
    throw new Error('Missing shipmentId or barcodes')
  }

  for (let j = 0; j < parcels.length; j++) {
    await post(`/shipments/${record.id}/unload`, {
      token,
      country: COUNTRY,
      environment: ENV,
      barcode: parcels[j].barcode,
      isLastParcel: j === parcels.length - 1,
      weight: '5',
    })
  }

  const primary = parcels[0]
  const legacyShort =
    primary.short ||
    (typeof primary.legacy === 'string' && primary.legacy.match(/68800\d{10}/)?.[0]) ||
    (primary.seq ? `688005${String(primary.seq).padStart(10, '0')}` : null)

  const out = {
    dbId: record.id,
    shipmentId,
    customerId: details.customerId,
    customerName: details.name,
    barcode: primary.barcode,
    legacy: primary.legacy,
    legacyShort,
    seq: primary.seq,
  }
  fs.writeFileSync('.tmp-e2e/pac-dely.json', JSON.stringify(out, null, 2))
  console.log(JSON.stringify(out, null, 2))
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
