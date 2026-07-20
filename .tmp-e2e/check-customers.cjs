const https = require('https')
const fs = require('fs')
const http = require('http')

function req(method, url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url)
    const data = body ? JSON.stringify(body) : null
    const lib = u.protocol === 'https:' ? https : http
    const r = lib.request(
      {
        hostname: u.hostname,
        port: u.port || (u.protocol === 'https:' ? 443 : 80),
        path: u.pathname + u.search,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
          ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let b = ''
        res.on('data', (c) => (b += c))
        res.on('end', () => resolve({ status: res.statusCode, body: b }))
      },
    )
    r.on('error', reject)
    if (data) r.write(data)
    r.end()
  })
}

;(async () => {
  const login = JSON.parse(
    (await req('POST', 'http://127.0.0.1:4001/api/nesy/auth/login', { country: 'RS', environment: 'stage' })).body,
  )
  const token = login.result.payload.token
  const base = 'https://nesy-staging-api.cityexpress.rs'
  for (const wb of ['74901237799972', '36502571298539', '94643876527895']) {
    const res = await req(
      'POST',
      base + '/Shipment/SearchShipment',
      { ShipmentIds: [wb] },
      { Authorization: 'Bearer ' + token },
    )
    const item = JSON.parse(res.body).payload?.items?.[0]
    console.log(
      '====',
      wb,
      JSON.stringify({
        status: item?.shipmentStatus,
        parcelCount: item?.parcelCount,
        shipperId: item?.shipper?.customerId ?? item?.shipperCustomerId,
        shipperName: item?.shipper?.name ?? item?.shipperName,
        consigneeId: item?.consignee?.customerId,
        parcels: (item?.parcels || []).map((p) => ({
          barcode: p.barcode,
          legacy: p.legacySystemBarcode,
          short: p.shortBarcode,
          seq: p.sequenceNumber,
          status: p.status,
        })),
      }),
    )
  }

  // Try GetShipperCustomerByBarcode style endpoints
  const barcode = JSON.parse(fs.readFileSync('.tmp-e2e/pac-dely.json', 'utf8')).barcode
  for (const [ep, body] of [
    ['Shipment/GetShipperCustomerByBarcode', { Barcode: barcode }],
    ['Shipment/GetShipperCustomerByBarcode', { barcode }],
    ['Shipment/GetShipperCustomerByBarcode', { Barcode: `'${barcode}'` }],
    ['Integration/GetShipperCustomerByBarcode', { Barcode: barcode }],
  ]) {
    const res = await req('POST', base + '/' + ep, body, { Authorization: 'Bearer ' + token })
    console.log(ep, JSON.stringify(body).slice(0, 80), res.status, res.body.slice(0, 300))
  }
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
