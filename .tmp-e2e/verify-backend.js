const https = require('https');
const http = require('http');
const fs = require('fs');

function req(method, url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = body ? JSON.stringify(body) : null;
    const lib = u.protocol === 'https:' ? https : http;
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
        let b = '';
        res.on('data', (c) => (b += c));
        res.on('end', () => resolve({ status: res.statusCode, body: b }));
      }
    );
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function tokenFromLogin(login) {
  return (
    login?.result?.payload?.token ||
    login?.payload?.token ||
    login?.token ||
    login?.accessToken ||
    null
  );
}

(async () => {
  const schedRes = await req('GET', 'http://127.0.0.1:4002/api/adb/schedule?serial=R6CW400BC8N');
  fs.writeFileSync('.tmp-e2e/sched-final.json', schedRes.body);
  const s = JSON.parse(schedRes.body).schedule;
  const seen = new Set();
  const del = [];
  const pick = [];
  for (const st of s.stops || []) {
    for (const t of st.taskList || []) {
      if (seen.has(t.taskId)) continue;
      seen.add(t.taskId);
      const wbs = (t.shipmentList || []).map((sh) => sh.waybillNumber);
      const items = (t.shipmentList || []).flatMap((sh) =>
        (sh.shipmentItemList || []).map((i) => ({
          leg: i.legacySystemShortBarcode,
          st: i.shipmentItemStatus,
        }))
      );
      const row = { party: t.taskParty, type: t.taskType, status: t.taskStatus, wbs, items };
      if (t.taskType === 2) del.push(row);
      else if (t.taskType === 1) pick.push(row);
    }
  }
  console.log(
    'LOCAL',
    JSON.stringify(
      {
        scheduleStatus: s.status,
        scheduleId: s.scheduleId,
        delDone: del.filter((x) => x.status === 2).length,
        delTotal: del.length,
        pickDone: pick.filter((x) => x.status === 2).length,
        pickTotal: pick.length,
        pickPending: pick.filter((x) => x.status !== 2),
      },
      null,
      2
    )
  );

  const login = JSON.parse(
    (await req('POST', 'http://127.0.0.1:4001/api/nesy/auth/login', { country: 'RS', environment: 'stage' }))
      .body
  );
  const token = tokenFromLogin(login);
  if (!token) {
    console.log('no token', Object.keys(login));
    console.log(JSON.stringify(login).slice(0, 400));
    process.exit(1);
  }

  const waybills = [...new Set(del.concat(pick).flatMap((x) => x.wbs))];
  const backend = [];
  for (const wb of waybills) {
    const res = await req(
      'POST',
      'https://nesy-staging-api.cityexpress.rs/Shipment/SearchShipment',
      { ShipmentIds: [wb] },
      { Authorization: 'Bearer ' + token }
    );
    const j = JSON.parse(res.body);
    const item = j.payload?.items?.[0];
    backend.push({
      wb,
      status: item?.shipmentStatus,
      parcelCount: item?.parcelCount,
      cod: (item?.collections || [])
        .filter((c) => c.collectionAmount > 0)
        .map((c) => ({
          amount: c.collectionAmount,
          status: c.collectionStatus,
          service: c.serviceType,
          type: c.collectionType,
        })),
    });
  }
  fs.writeFileSync('.tmp-e2e/backend-verify.json', JSON.stringify({ local: { del, pick }, backend }, null, 2));
  const by = {};
  for (const b of backend) by[b.status] = (by[b.status] || 0) + 1;
  console.log('statusCounts', by);
  console.log(
    'all',
    JSON.stringify(
      backend.map((b) => ({ wb: b.wb, status: b.status, parcels: b.parcelCount, cod: b.cod })),
      null,
      2
    )
  );
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
