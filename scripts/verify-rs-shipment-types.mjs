#!/usr/bin/env node
/**
 * RS STAGE: Customer 1000 ile tum shipment tiplerini olusturur ve API uzerinden dogrular.
 * Usage: node scripts/verify-rs-shipment-types.mjs
 */
const API = process.env.API_BASE ?? 'http://localhost:4001/api'
const COUNTRY = 'RS'
const ENV = 'stage'

const CUSTOMER = {
  customerId: 1000,
  customerCenter: '1',
  name: 'CASH',
  phone: '4607-000',
  gsm: '4607-000',
  email: null,
  addressStreet: 'SVETOG SAVE 36',
  addressCity: 'SURCIN',
  addressZipCode: '11271',
  addressCountry: 'RS',
  addressTitle: 'CITY EXPRESS DOO BEOGRAD-SURCIN',
}

const TYPES = [
  {
    id: 'standard',
    shipmentType: 'standard',
    expect: (s) => ({
      ok: hasService(s, { legacy: '1', name: 'Standard' }),
      note: 'Standard service (legacy 1)',
    }),
  },
  {
    id: 'cod',
    shipmentType: 'cod',
    extra: { codAmount: 1500, codCurrency: 'RSD', iban: 'RS35260005604011337977', bicSwift: '' },
    expect: (s) => ({
      ok: hasService(s, { legacy: '8', type: 20, name: 'Cash on Delivery' }),
      note: 'COD service legacy 8, amount > 0',
      amount: servicePrice(s, '8'),
    }),
  },
  {
    id: 'exw',
    shipmentType: 'exw',
    extra: { billingOption: 'EXWORKS in cash', payerType: 1 },
    expect: (s) => ({
      ok:
        hasService(s, { type: 22 }) &&
        String(s.billingOption ?? '').toLowerCase().includes('exwork'),
      note: 'Exwork service type 22 + billingOption exworks',
      billingOption: s.billingOption,
      exworkService: findService(s, { type: 22 })?.serviceName,
    }),
  },
  {
    id: 'deps',
    shipmentType: 'deps',
    needsOoh: true,
    expect: (s) => ({
      ok: hasService(s, { legacy: '30', type: 30 }) || hasParcelShopConsignee(s),
      note: 'Parcel Shop Delivery legacy 30 or parcel shop consignee',
    }),
  },
  {
    id: 'multicolli',
    shipmentType: 'multicolli',
    extra: { parcelCount: 3, integrationCode1: 'VERIFY-MC-001' },
    expect: (s) => ({
      ok:
        hasService(s, { legacy: '46', type: 46 }) &&
        Array.isArray(s.parcels) &&
        s.parcels.length >= 2,
      note: 'MultiColli service + >=2 parcels',
      parcelCount: s.parcels?.length,
    }),
  },
  {
    id: 'rdoc',
    shipmentType: 'return-document',
    expect: (s) => ({
      ok: hasService(s, { legacy: '64', type: 27 }),
      note: 'Document Collection legacy 64',
    }),
  },
  {
    id: 'delivery-pick',
    shipmentType: 'delivery-pick',
    extra: {
      receiverName: 'Test Receiver VERIFY',
      billingOption: 'CPP on invoice',
    },
    expect: (s) => ({
      ok: hasService(s, { legacy: '36', type: 36 }),
      note: 'Personal Delivery legacy 36',
    }),
  },
  {
    id: 'doco',
    shipmentType: 'doco',
    expect: (s) => ({
      ok: hasService(s, { legacy: '64', type: 27 }),
      note: 'Document Collection legacy 64 + cash prepayed',
    }),
  },
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

function servicesOf(shipment) {
  const list = shipment?.services ?? shipment?.filteredServices ?? shipment?.Services ?? []
  return Array.isArray(list) ? list : []
}

function findService(shipment, { legacy, type, name }) {
  return servicesOf(shipment).find((s) => {
    if (legacy && String(s.legacySystemServiceId ?? s.LegacySystemServiceId) === legacy) return true
    if (type != null && (s.serviceType === type || s.ServiceType === type)) return true
    if (name && String(s.serviceName ?? s.ServiceName).includes(name)) return true
    return false
  })
}

function hasService(shipment, criteria) {
  return Boolean(findService(shipment, criteria))
}

function servicePrice(shipment, legacy) {
  const s = findService(shipment, { legacy })
  return s?.servicePrice ?? s?.ServicePrice ?? s?.amount ?? 0
}

function hasParcelShopConsignee(shipment) {
  const c = shipment?.consignee?.address ?? shipment?.Consignee?.Address
  const t = c?.counterLocationType ?? c?.CounterLocationType
  return t === 10 || t === '10'
}

async function login() {
  const { result } = await post('/nesy/auth/login', { country: COUNTRY, environment: ENV })
  return result.payload.token
}

async function fetchOohId(token) {
  const { data } = await post('/shipments/ooh/by-zip', {
    token,
    country: COUNTRY,
    environment: ENV,
    zipCode: '11271',
  })
  const first = Array.isArray(data) ? data[0] : null
  // Backend looks up by OOHID (oohid), not MongoDB id
  const oohKey = first?.oohid ?? first?.OOHID ?? first?.name ?? first?.id
  if (!oohKey) throw new Error('No OOH point found for zip 11271')
  return String(oohKey)
}

async function createShipment(token, typeDef, oohId) {
  const body = {
    token,
    country: COUNTRY,
    environment: ENV,
    parcelCount: typeDef.extra?.parcelCount ?? 1,
    shipmentType: typeDef.shipmentType,
    customer: CUSTOMER,
    ...typeDef.extra,
  }
  if (typeDef.needsOoh && oohId) {
    body.counterLocationConsigneeId = oohId
  }
  const { data } = await post('/shipments/create', body)
  const shipmentId = data?.data?.shipmentId ?? data?.data?.ShipmentId
  return { dbId: data.id, shipmentId, raw: data.data }
}

async function getDetails(token, shipmentId) {
  const { data } = await post('/shipments/details', {
    token,
    country: COUNTRY,
    environment: ENV,
    shipmentId,
  })
  return data
}

async function main() {
  console.log(`\n=== RS STAGE Shipment Type Verification (Customer 1000) ===\n`)
  const token = await login()
  console.log('Login OK\n')

  let oohId
  try {
    oohId = await fetchOohId(token)
    console.log(`OOH for DEPS: ${oohId}\n`)
  } catch (e) {
    console.warn(`OOH fetch failed: ${e.message}\n`)
  }

  const results = []

  for (const typeDef of TYPES) {
    process.stdout.write(`Creating ${typeDef.id}... `)
    try {
      const created = await createShipment(token, typeDef, oohId)
      const shipmentId = created.shipmentId ?? extractId(created.raw)
      if (!shipmentId) throw new Error('No shipmentId returned')

      const details = await getDetails(token, String(shipmentId))
      const check = typeDef.expect(details)
      const status = check.ok ? 'PASS' : 'FAIL'
      console.log(`${status} (${shipmentId})`)
      results.push({
        type: typeDef.id,
        status,
        shipmentId,
        dbId: created.dbId,
        check,
        services: servicesOf(details).map((s) => ({
          name: s.serviceName ?? s.ServiceName,
          type: s.serviceType ?? s.ServiceType,
          legacy: s.legacySystemServiceId ?? s.LegacySystemServiceId,
          price: s.servicePrice ?? s.ServicePrice,
        })),
        billingOption: details.billingOption,
        payingParty: details.payingParty ?? details.payerType,
        collections: details.collections?.length ?? 0,
      })
    } catch (err) {
      console.log(`ERROR: ${err.message}`)
      results.push({ type: typeDef.id, status: 'ERROR', error: err.message })
    }
  }

  console.log('\n--- Summary ---\n')
  for (const r of results) {
    if (r.status === 'ERROR') {
      console.log(`[ERROR] ${r.type}: ${r.error}`)
      continue
    }
    console.log(`[${r.status}] ${r.type} → ${r.shipmentId}`)
    console.log(`  Expected: ${r.check.note}`)
    if (r.check.billingOption) console.log(`  billingOption: ${r.check.billingOption}`)
    if (r.check.exworkService) console.log(`  exworkService: ${r.check.exworkService}`)
    if (r.check.amount != null) console.log(`  codAmount: ${r.check.amount}`)
    if (r.check.parcelCount != null) console.log(`  parcels: ${r.check.parcelCount}`)
    console.log(`  services: ${r.services.map((s) => `${s.name}(L${s.legacy})`).join(', ')}`)
    console.log(`  collections: ${r.collections}`)
    if (r.status === 'FAIL') console.log(`  ⚠ Requirement not fully met`)
    console.log('')
  }

  // EXW: unload then re-check pricing (MissingParcelWeight clears after INIT)
  const exw = results.find((r) => r.type === 'exw' && r.status === 'PASS')
  if (exw?.dbId && exw?.shipmentId) {
    console.log('\n--- EXW unload + pricing check ---\n')
    try {
      const details = await getDetails(token, String(exw.shipmentId))
      const barcode = details?.parcels?.[0]?.barcode
      if (!barcode) throw new Error('No barcode on EXW shipment')

      await post(`/shipments/${exw.dbId}/unload`, {
        token,
        country: COUNTRY,
        environment: ENV,
        barcode,
        isLastParcel: true,
        weight: '5',
      })
      console.log(`Unload OK for ${exw.shipmentId} (${barcode.slice(0, 24)}…)`)

      await new Promise((r) => setTimeout(r, 1500))

      const pricing = await post('/shipments/pricing', {
        token,
        country: COUNTRY,
        environment: ENV,
        shipmentId: String(exw.shipmentId),
      })
      const payload = pricing.data?.payload ?? pricing.data?.Payload ?? pricing.data
      const fees = payload?.shippingFees ?? payload?.ShippingFees ?? []
      const fee = Array.isArray(fees) ? fees[0] : null
      const price = fee?.price ?? fee?.Price
      const totalWithTax =
        payload?.totalFreightCostWithTax ?? payload?.TotalFreightCostWithTax
      const err = fee?.priceCalculationError ?? fee?.PriceCalculationError
      console.log(
        `Pricing after unload: fee=${price} totalWithTax=${totalWithTax} error=${err ?? 'none'}`,
      )
      console.log(
        `tariff=${fee?.tariffName ?? fee?.TariffName} offer=${fee?.offerName ?? fee?.OfferName}`,
      )

      const after = await getDetails(token, String(exw.shipmentId))
      const exwork = findService(after, { type: 22 })
      const col = (after.collections ?? [])[0]
      console.log(
        `EXW servicePrice=${exwork?.servicePrice ?? exwork?.ServicePrice} collectionAmount=${col?.collectionAmount ?? col?.CollectionAmount}`,
      )
    } catch (e) {
      console.log(`EXW unload/pricing ERROR: ${e.message}`)
      results.push({ type: 'exw-unload-pricing', status: 'ERROR', error: e.message })
    }
  }

  const failed = results.filter((r) => r.status !== 'PASS')
  process.exit(failed.length > 0 ? 1 : 0)
}

function extractId(data) {
  return data?.shipmentId ?? data?.ShipmentId ?? data?.legacySystemCargoId
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
