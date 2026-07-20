const https = require("https");
const fs = require("fs");
const path = require("path");

function loadEnv() {
  const env = {};
  for (const line of fs.readFileSync("apps/api/.env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)="?(.*?)"?$/);
    if (m) env[m[1]] = m[2];
  }
  return env;
}
function req(method, url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const data = body ? JSON.stringify(body) : null;
    const r = https.request(
      {
        hostname: u.hostname,
        path: u.pathname + u.search,
        method,
        headers: {
          "Content-Type": "application/json",
          ...headers,
          ...(data ? { "Content-Length": Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let b = "";
        res.on("data", (c) => (b += c));
        res.on("end", () => resolve({ status: res.statusCode, body: b }));
      }
    );
    r.on("error", reject);
    if (data) r.write(data);
    r.end();
  });
}
(async () => {
  const env = loadEnv();
  const base = env.NESY_RS_STAGE_BASE_URL;
  const login = await req("POST", base + "/Auth/LoginDashboard", {
    Username: env.NESY_RS_STAGE_USERNAME,
    Password: env.NESY_RS_STAGE_PASSWORD,
  });
  console.log("login", login.status);
  const j = JSON.parse(login.body);
  const token = j?.payload?.token || j?.result?.payload?.token;
  if (!token) {
    console.log(login.body.slice(0, 400));
    process.exit(1);
  }
  const sched = JSON.parse(fs.readFileSync(".tmp-e2e/sched-final.json", "utf8")).schedule;
  const seen = new Set();
  const wbs = [];
  for (const st of sched.stops || [])
    for (const t of st.taskList || []) {
      if (seen.has(t.taskId)) continue;
      seen.add(t.taskId);
      for (const sh of t.shipmentList || []) wbs.push(sh.waybillNumber);
    }
  const uniq = [...new Set(wbs)];
  const backend = [];
  for (const wb of uniq) {
    const res = await req(
      "POST",
      base + "/Shipment/SearchShipment",
      { ShipmentIds: [wb] },
      { Authorization: "Bearer " + token }
    );
    const item = JSON.parse(res.body).payload?.items?.[0];
    backend.push({
      wb,
      status: item?.shipmentStatus,
      parcelCount: item?.parcelCount,
      cod: (item?.collections || [])
        .filter((c) => c.collectionAmount > 0)
        .map((c) => ({ amount: c.collectionAmount, status: c.collectionStatus, service: c.serviceType })),
    });
  }
  fs.writeFileSync(".tmp-e2e/backend-verify.json", JSON.stringify(backend, null, 2));
  const by = {};
  for (const b of backend) by[b.status] = (by[b.status] || 0) + 1;
  console.log("statusCounts", by);
  console.log(JSON.stringify(backend, null, 2));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
