#!/usr/bin/env node
/**
 * RS STAGE — Customer 1000:
 *  1) Create 1 of every Create Shipment type
 *  2) Create 1 Remote + 1 PAC pickup
 *
 * Usage: node scripts/create-all-rs-types.mjs
 */
const API = process.env.API_BASE ?? 'http://localhost:4001/api'
/** RS stage WebAPI — ActiveLocker / ActiveD4M (GetOOH* returns parcel shops only) */
const NESY_API = process.env.NESY_RS_STAGE_BASE_URL ?? 'https://nesy-staging-api.cityexpress.rs'
const COUNTRY = 'RS'
const ENV = 'stage'
const CUSTOMER_ID = '1000'
const CUSTOMER_CENTER = '1'

const RS_STOPS = [
  { city: 'BEOGRAD', zipCode: '11000', street: 'KNEZA MILOSA', houseNumber: 10, latitude: 44.8055, longitude: 20.4649 },
  { city: 'BEOGRAD', zipCode: '11070', street: 'BULEVAR MIHAJLA PUPINA', houseNumber: 20, latitude: 44.8142, longitude: 20.4214 },
  { city: 'ZEMUN', zipCode: '11080', street: 'GLAVNA', houseNumber: 30, latitude: 44.8456, longitude: 20.4012 },
  { city: 'SURCIN', zipCode: '11271', street: 'VOJVODE STEPE', houseNumber: 40, latitude: 44.7921, longitude: 20.2789 },
  { city: 'BEOGRAD', zipCode: '11060', street: 'BULEVAR KRALJA ALEKSANDRA', houseNumber: 50, latitude: 44.7948, longitude: 20.5021 },
  { city: 'PANCEVO', zipCode: '26000', street: 'VOJVODE RADOMIRA PUTNIKA', houseNumber: 12, latitude: 44.8708, longitude: 20.6403 },
  { city: 'SMEDEREVO', zipCode: '11300', street: 'KARADJORDJEVA', houseNumber: 22, latitude: 44.6644, longitude: 20.9276 },
  { city: 'NOVI SAD', zipCode: '21000', street: 'BULEVAR OSLOBODJENJA', houseNumber: 32, latitude: 45.2551, longitude: 19.8452 },
  { city: 'BEOGRAD', zipCode: '11000', street: 'TERAZIJE', houseNumber: 5, latitude: 44.8128, longitude: 20.4612 },
  { city: 'BEOGRAD', zipCode: '11000', street: 'KNEZ MIHAILOVA', houseNumber: 15, latitude: 44.8176, longitude: 20.4581 },
  { city: 'OBRENOVAC', zipCode: '11500', street: 'VOJVODE MISICA', houseNumber: 8, latitude: 44.6548, longitude: 20.2002 },
  { city: 'LAZAREVAC', zipCode: '11550', street: 'KARADJORDJEVA', houseNumber: 18, latitude: 44.385, longitude: 20.2556 },
]

/** Matches Create Shipment UI type list */
const SHIPMENT_TYPES = [
  { id: 'standard', shipmentType: 'standard', parcelCount: 1, unload: true },
  {
    id: 'cod',
    shipmentType: 'cod',
    parcelCount: 1,
    unload: true,
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
    unload: true,
    extra: { billingOption: 'EXWORKS in cash', payerType: 1 },
  },
  { id: 'deps', shipmentType: 'deps', parcelCount: 1, unload: true, needsOoh: 'parcelshop' },
  { id: 'd4me', shipmentType: 'd4me', parcelCount: 1, unload: true, needsOoh: 'locker' },
  {
    id: 'multicolli',
    shipmentType: 'multicolli',
    parcelCount: 3,
    unload: true,
    extra: { integrationCode1: 'ALL-MC-001' },
  },
  { id: 'rdoc', shipmentType: 'return-document', parcelCount: 1, unload: true },
  {
    id: 'delivery-pick',
    shipmentType: 'delivery-pick',
    parcelCount: 1,
    unload: true,
    extra: { receiverName: 'Test Receiver ALL', billingOption: 'CPP on invoice' },
  },
  { id: 'doco', shipmentType: 'doco', parcelCount: 1, unload: true },
  {
    id: 'cpp',
    shipmentType: 'standard',
    parcelCount: 1,
    unload: true,
    extra: { billingOption: 'CPP in cash', payerType: 2 },
  },
  {
    id: 'ovsz',
    shipmentType: 'standard',
    parcelCount: 1,
    unload: true,
    isOversize: true,
  },
  { id: 'ddef', shipmentType: 'standard', parcelCount: 1, unload: false },
]

const PICKUP_TYPES = [
  { id: 'remote', pickupType: 'remote' },
  { id: 'customer', pickupType: 'customer' },
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

function oohId(ooh) {
  return String(ooh.oohid ?? ooh.OOHID ?? ooh.oohId ?? ooh.name ?? '')
}

function oohKindOf(ooh) {
  const t = String(
    ooh.oohType ?? ooh.OohType ?? ooh.type ?? ooh.Type ?? ooh.counterLocationType ?? '',
  ).toLowerCase()
  if (t.includes('locker') || t.includes('d4me') || t.includes('terminal')) return 'locker'
  if (t.includes('parcel') || t.includes('shop') || t.includes('pudo')) return 'parcelshop'
  const name = String(ooh.name ?? ooh.Name ?? '').toLowerCase()
  if (name.includes('locker') || name.includes('d4me')) return 'locker'
  return 'parcelshop'
}

function buildOohConsignee(details, ooh, kind) {
  const addr = ooh.address ?? {}
  return {
    mode: 'parcelshop',
    parcelShop: {
      oohId: oohId(ooh),
      oohType: kind,
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
  return parcels.map((p) => p.barcode).filter((b) => typeof b === 'string' && b.length > 0)
}

function buildBffCustomer(details) {
  const addr = pickAddress(details)
  return {
    customerId: Number(details.customerId) || 1000,
    customerCenter: String(details.hubId ?? CUSTOMER_CENTER),
    name: details.name,
    phone: details.phone || '4607-000',
    gsm: details.gsm || details.phone || '4607-000',
    email: details.email ?? null,
    addressStreet: addr.street || '',
    addressCity: addr.city || '',
    addressZipCode: addr.zipCode || '',
    addressCountry: addr.countryCode || addr.country || 'RS',
    addressTitle: addr.name || details.name,
    addressText: addr.addressText,
    customerPreferences: details.customerPreferences,
  }
}

async function fetchOohPool(token) {
  const zips = ['11271', '11000', '11070', '21000']
  const all = []
  for (const zipCode of zips) {
    try {
      const oohRes = await post('/shipments/ooh/by-zip', {
        token,
        country: COUNTRY,
        environment: ENV,
        zipCode,
      })
      const list = Array.isArray(oohRes.data) ? oohRes.data : []
      all.push(...list)
    } catch {
      /* try next zip */
    }
  }
  return all
}

async function fetchLockerPool(token) {
  const paths = [
    '/Shipment/ActiveLockerCounterLocations',
    '/Shipment/ActiveD4MCounterLocations',
  ]
  const all = []
  for (const path of paths) {
    try {
      const res = await fetch(`${NESY_API}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: '{}',
      })
      const json = await res.json().catch(() => ({}))
      const list = Array.isArray(json.payload) ? json.payload : []
      all.push(...list)
    } catch {
      /* try next */
    }
  }
  return all
}

function pickOoh(pool, kind) {
  if (kind === 'locker') {
    // Prefer RS lockers (ActiveLocker* often mixes countries)
    const rs = pool.find((o) => {
      const prefix = String(o.address?.countryPrefix ?? o.countryCode ?? '').toUpperCase()
      return oohId(o) && prefix === 'RS'
    })
    if (rs) return rs
    return (
      pool.find((o) => {
        const n = String(o.name ?? '').toLowerCase()
        return (
          oohId(o) &&
          (n.includes('rs ') || n.includes('beograd') || n.includes('d4m') || n.includes('direct4me'))
        )
      }) ??
      pool.find((o) => oohId(o)) ??
      null
    )
  }
  const match = pool.find((o) => oohKindOf(o) === kind && oohId(o))
  if (match) return match
  return pool.find((o) => oohId(o)) ?? null
}

async function main() {
  console.log('\n=== Create ALL types — RS STAGE / Customer 1000 ===\n')

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
  const bffCustomer = buildBffCustomer(details)
  console.log(`Customer ${details.customerId} ${details.name} — ${shipperAddr.city}`)

  console.log('Fetching OOH / locker pools…')
  const oohPool = await fetchOohPool(token)
  const lockerPool = await fetchLockerPool(token)
  const parcelshop = pickOoh(oohPool, 'parcelshop')
  const locker = pickOoh(lockerPool, 'locker')
  console.log(
    `  parcelshop: ${parcelshop ? oohId(parcelshop) : 'NONE'} | locker: ${locker ? `${oohId(locker)} (${locker.name})` : 'NONE'}\n`,
  )

  const shipmentResults = []

  console.log('--- Shipments ---\n')
  for (let i = 0; i < SHIPMENT_TYPES.length; i++) {
    const typeDef = SHIPMENT_TYPES[i]
    process.stdout.write(`[S ${i + 1}/${SHIPMENT_TYPES.length}] ${typeDef.id.padEnd(14)} `)
    try {
      let consignee
      let counterId
      if (typeDef.needsOoh === 'parcelshop') {
        if (!parcelshop) throw new Error('No parcelshop OOH available')
        consignee = buildOohConsignee(details, parcelshop, 'parcelshop')
        counterId = oohId(parcelshop)
      } else if (typeDef.needsOoh === 'locker') {
        if (!locker) throw new Error('No locker OOH available')
        consignee = buildOohConsignee(details, locker, 'locker')
        counterId = oohId(locker)
      } else {
        consignee = buildDistinctConsignee(i, details)
      }

      const parties = buildParties(details, shipper, consignee)
      const body = {
        token,
        country: COUNTRY,
        environment: ENV,
        parcelCount: typeDef.parcelCount,
        shipmentType: typeDef.shipmentType,
        parties,
        ...(typeDef.extra ?? {}),
      }
      if (counterId) body.counterLocationConsigneeId = counterId

      const { data: record } = await post('/shipments/create', body)
      const shipmentId = record.data?.shipmentId ?? record.data?.ShipmentId
      const barcodes = extractBarcodes(record.data)
      if (!shipmentId) throw new Error('Missing shipmentId')

      let unloadNote = 'no-unload'
      if (typeDef.unload) {
        if (barcodes.length === 0) throw new Error('No barcodes for unload')
        for (let j = 0; j < barcodes.length; j++) {
          await post(`/shipments/${record.id}/unload`, {
            token,
            country: COUNTRY,
            environment: ENV,
            barcode: barcodes[j],
            isLastParcel: j === barcodes.length - 1,
            weight: '5',
            ...(typeDef.isOversize ? { isOversize: true } : {}),
          })
        }
        unloadNote = typeDef.isOversize ? `OVSZ-unloaded(${barcodes.length})` : `unloaded(${barcodes.length})`
      }

      console.log(`OK ${shipmentId}  ${unloadNote}`)
      shipmentResults.push({
        type: typeDef.id,
        status: 'OK',
        shipmentId,
        dbId: record.id,
        note: unloadNote,
      })
    } catch (err) {
      console.log(`FAIL: ${err.message}`)
      shipmentResults.push({ type: typeDef.id, status: 'FAIL', error: err.message })
    }
  }

  const pickupResults = []
  console.log('\n--- Pickups ---\n')
  for (let i = 0; i < PICKUP_TYPES.length; i++) {
    const typeDef = PICKUP_TYPES[i]
    process.stdout.write(`[P ${i + 1}/${PICKUP_TYPES.length}] ${typeDef.id.padEnd(14)} `)
    try {
      const { data: record } = await post('/pickups/create', {
        token,
        country: COUNTRY,
        environment: ENV,
        pickupType: typeDef.pickupType,
        shipmentCount: 1,
        pickUpDateOffsetDays: 1,
        pickupEndTime: '17:00',
        parcelWeight: 5,
        customer: bffCustomer,
      })
      const shipmentId = record.shipmentId ?? record.data?.shipmentId
      const assignStatus = record.assignStatus ?? record.data?.assignStatus
      if (!shipmentId) throw new Error('Missing pickup shipmentId')
      console.log(`OK ${shipmentId}  assign=${assignStatus ?? '?'}`)
      pickupResults.push({
        type: typeDef.id,
        status: 'OK',
        shipmentId,
        assignStatus,
        dbId: record.id,
      })
    } catch (err) {
      console.log(`FAIL: ${err.message}`)
      pickupResults.push({ type: typeDef.id, status: 'FAIL', error: err.message })
    }
  }

  console.log('\n========== SUMMARY ==========\n')
  console.log('Shipments:')
  for (const r of shipmentResults) {
    if (r.status === 'OK') {
      console.log(`  [OK]   ${r.type.padEnd(14)} ${r.shipmentId}  ${r.note}`)
    } else {
      console.log(`  [FAIL] ${r.type.padEnd(14)} ${r.error}`)
    }
  }
  console.log('\nPickups:')
  for (const r of pickupResults) {
    if (r.status === 'OK') {
      console.log(`  [OK]   ${r.type.padEnd(14)} ${r.shipmentId}  assign=${r.assignStatus ?? '?'}`)
    } else {
      console.log(`  [FAIL] ${r.type.padEnd(14)} ${r.error}`)
    }
  }

  const all = [...shipmentResults, ...pickupResults]
  const failed = all.filter((r) => r.status !== 'OK')
  console.log(`\n${all.length - failed.length}/${all.length} succeeded\n`)
  process.exit(failed.length > 0 ? 1 : 0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
