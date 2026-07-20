#!/usr/bin/env node
/**
 * RS STAGE — create 1 of each shipment type, Distinct stops + Unload.
 * Ready for multi-stop load / courier use.
 *
 * Usage: node scripts/create-ready-rs-shipments.mjs
 */
const API = process.env.API_BASE ?? 'http://localhost:4001/api'
const COUNTRY = 'RS'
const ENV = 'stage'
const CUSTOMER_ID = '1000'
const CUSTOMER_CENTER = '1'

/** Belgrade-metro + nearby — same idea as multi-stop-addresses STOP_LOCATION_POOL_RS */
const RS_STOPS = [
  { city: 'BEOGRAD', zipCode: '11000', street: 'KNEZA MILOSA', houseNumber: 10, latitude: 44.8055, longitude: 20.4649 },
  { city: 'BEOGRAD', zipCode: '11070', street: 'BULEVAR MIHAJLA PUPINA', houseNumber: 20, latitude: 44.8142, longitude: 20.4214 },
  { city: 'ZEMUN', zipCode: '11080', street: 'GLAVNA', houseNumber: 30, latitude: 44.8456, longitude: 20.4012 },
  { city: 'SURCIN', zipCode: '11271', street: 'VOJVODE STEPE', houseNumber: 40, latitude: 44.7921, longitude: 20.2789 },
  { city: 'BEOGRAD', zipCode: '11060', street: 'BULEVAR KRALJA ALEKSANDRA', houseNumber: 50, latitude: 44.7948, longitude: 20.5021 },
  { city: 'PANCEVO', zipCode: '26000', street: 'VOJVODE RADOMIRA PUTNIKA', houseNumber: 12, latitude: 44.8708, longitude: 20.6403 },
  { city: 'SMEDEREVO', zipCode: '11300', street: 'KARADJORDJEVA', houseNumber: 22, latitude: 44.6644, longitude: 20.9276 },
  { city: 'NOVI SAD', zipCode: '21000', street: 'BULEVAR OSLOBODJENJA', houseNumber: 32, latitude: 45.2551, longitude: 19.8452 },
]

const TYPES = [
  { id: 'standard', shipmentType: 'standard', parcelCount: 1 },
  {
    id: 'cod',
    shipmentType: 'cod',
    parcelCount: 1,
    extra: {
      codAmount: 1500,
      codCurrency: 'RSD',
      iban: 'RS35260005604011337977',
      bicSwift: '',
    },
  },
  {
    id: 'exw',
    shipmentType: 'exw',
    parcelCount: 1,
    extra: { billingOption: 'EXWORKS in cash', payerType: 1 },
  },
  { id: 'deps', shipmentType: 'deps', parcelCount: 1, needsOoh: true },
  {
    id: 'multicolli',
    shipmentType: 'multicolli',
    parcelCount: 3,
    extra: { integrationCode1: 'READY-MC-001' },
  },
  { id: 'rdoc', shipmentType: 'return-document', parcelCount: 1 },
  {
    id: 'delivery-pick',
    shipmentType: 'delivery-pick',
    parcelCount: 1,
    extra: { receiverName: 'Test Receiver READY', billingOption: 'CPP on invoice' },
  },
  { id: 'doco', shipmentType: 'doco', parcelCount: 1 },
]

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(json.message ?? json.error ?? `${path} failed ${res.status}`)
  }
  return json
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function pickAddress(details) {
  const list = Array.isArray(details.addresses) ? details.addresses : []
  const standard = list.find((a) => a.addressType === 0) ?? list[0]
  if (!standard) throw new Error('Customer has no addresses')
  return standard
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

function buildDistinctConsignee(index, details) {
  const base = RS_STOPS[index % RS_STOPS.length]
  const seq = index + 1
  const label = `Stop Test ${pad2(seq)}`
  const phone = `06${String(7_000_000 + seq).slice(-7)}`
  return {
    mode: 'newaddress',
    isInternational: false,
    saveAddress: false,
    address: {
      addressType: 0,
      name: label,
      street: base.street,
      city: base.city,
      zipCode: base.zipCode,
      countryCode: 'RS',
      houseNumber: String(base.houseNumber + index),
      latitude: base.latitude + index * 0.0015,
      longitude: base.longitude + index * 0.0012,
    },
    contact: {
      name: label,
      phone,
      gsm: phone,
      email: `stop${pad2(seq)}@test.nesy.local`,
      customerId: details.customerId,
      customerCenter: String(details.hubId ?? CUSTOMER_CENTER),
    },
  }
}

function buildDepsConsignee(details, ooh) {
  const addr = ooh.address ?? {}
  return {
    mode: 'parcelshop',
    parcelShop: {
      oohId: ooh.oohid ?? ooh.OOHID ?? ooh.name,
      oohType: 'parcelshop',
      name: ooh.name ?? 'OOH Point',
      address: {
        addressType: 10,
        street: addr.street ?? '',
        city: addr.city ?? '',
        zipCode: addr.zipCode ?? '',
        countryCode: addr.countryPrefix ?? addr.country ?? 'RS',
        houseNumber: addr.houseNumber ?? null,
        addressText: addr.addressText,
        latitude: addr.lat != null ? Number(addr.lat) : undefined,
        longitude: addr.long != null ? Number(addr.long) : undefined,
      },
    },
    address: {
      addressType: 10,
      street: addr.street ?? '',
      city: addr.city ?? '',
      zipCode: addr.zipCode ?? '',
      countryCode: 'RS',
    },
    contact: {
      name: ooh.name ?? 'OOH Point',
      phone: '4607-000',
      gsm: '4607-000',
      email: null,
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

function extractBarcodes(data) {
  const parcels = data?.parcels
  if (!Array.isArray(parcels)) return []
  return parcels
    .map((p) => p.barcode)
    .filter((b) => typeof b === 'string' && b.length > 0)
}

async function main() {
  console.log('\n=== Create READY shipments (Distinct + Unload) — RS STAGE / Customer 1000 ===\n')

  const login = await post('/nesy/auth/login', { country: COUNTRY, environment: ENV })
  const token = login.result.payload.token
  console.log('Login OK')

  const detailsRes = await post('/customers/details', {
    token,
    country: COUNTRY,
    environment: ENV,
    customerId: CUSTOMER_ID,
    customerCenter: CUSTOMER_CENTER,
  })
  const details = detailsRes.data
  const shipperAddr = pickAddress(details)
  const shipper = buildShipper(details, shipperAddr)
  console.log(`Customer ${details.customerId} ${details.name} — shipper ${shipperAddr.city}\n`)

  let ooh = null
  try {
    const oohRes = await post('/shipments/ooh/by-zip', {
      token,
      country: COUNTRY,
      environment: ENV,
      zipCode: '11271',
    })
    ooh = Array.isArray(oohRes.data) ? oohRes.data[0] : null
    if (ooh) console.log(`OOH for DEPS: ${ooh.oohid ?? ooh.name}\n`)
  } catch (e) {
    console.warn(`OOH fetch failed: ${e.message}\n`)
  }

  const results = []

  for (let i = 0; i < TYPES.length; i++) {
    const typeDef = TYPES[i]
    process.stdout.write(`[${i + 1}/8] ${typeDef.id} create… `)
    try {
      const consignee =
        typeDef.needsOoh && ooh
          ? buildDepsConsignee(details, ooh)
          : buildDistinctConsignee(i, details)

      const parties = buildParties(details, shipper, consignee)
      const stopLabel =
        typeDef.needsOoh && ooh
          ? `OOH:${ooh.oohid ?? ooh.name}`
          : `${consignee.address.city} ${consignee.address.street}`

      const body = {
        token,
        country: COUNTRY,
        environment: ENV,
        parcelCount: typeDef.parcelCount,
        shipmentType: typeDef.shipmentType,
        parties,
        ...(typeDef.extra ?? {}),
      }
      if (typeDef.needsOoh && ooh) {
        body.counterLocationConsigneeId = String(ooh.oohid ?? ooh.OOHID ?? ooh.name)
      }

      const { data: record } = await post('/shipments/create', body)
      const shipmentId = record.data?.shipmentId ?? record.data?.ShipmentId
      const barcodes = extractBarcodes(record.data)
      if (!shipmentId || barcodes.length === 0) {
        throw new Error('Missing shipmentId or barcodes')
      }

      process.stdout.write(`OK ${shipmentId} → unload… `)

      for (let j = 0; j < barcodes.length; j++) {
        await post(`/shipments/${record.id}/unload`, {
          token,
          country: COUNTRY,
          environment: ENV,
          barcode: barcodes[j],
          isLastParcel: j === barcodes.length - 1,
          weight: '5',
        })
      }

      console.log(`UNLOADED (${barcodes.length}p) stop=${stopLabel}`)
      results.push({
        type: typeDef.id,
        status: 'READY',
        shipmentId,
        dbId: record.id,
        parcels: barcodes.length,
        stop: stopLabel,
      })
    } catch (err) {
      console.log(`FAIL: ${err.message}`)
      results.push({ type: typeDef.id, status: 'FAIL', error: err.message })
    }
  }

  console.log('\n--- Ready summary ---\n')
  for (const r of results) {
    if (r.status === 'READY') {
      console.log(`[READY] ${r.type.padEnd(14)} ${r.shipmentId}  parcels=${r.parcels}  stop=${r.stop}`)
    } else {
      console.log(`[FAIL]  ${r.type.padEnd(14)} ${r.error}`)
    }
  }

  const failed = results.filter((r) => r.status !== 'READY')
  console.log(
    `\n${results.length - failed.length}/${results.length} ready (created + unloaded, distinct stops)\n`,
  )
  process.exit(failed.length > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
