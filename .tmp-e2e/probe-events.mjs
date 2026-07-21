#!/usr/bin/env node
import fs from "node:fs";

const data = JSON.parse(fs.readFileSync(".tmp-e2e/test-data.json", "utf8"));
const login = await (
  await fetch("http://localhost:4001/api/nesy/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ country: "RS", environment: "stage" }),
  })
).json();
const token = login.result?.payload?.token;

async function events(shipmentId) {
  const ev = await fetch("http://localhost:4001/api/shipments/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, country: "RS", environment: "stage", shipmentId }),
  }).then((r) => r.json());
  const list = ev?.data?.payload?.eventDetailList || [];
  return list.map((e) => ({
    code: e.eventShortCode,
    type: e.eventType,
    ts: e.timeStamp,
    hub: e.eventLocation?.hubId,
    loc: e.eventLocation?.location,
    user: e.userName,
    desc: e.eventDescription?.carrierCompanyEventDescription,
  }));
}

for (const key of ["10-standard", "11-cod-cash", "12-cc"]) {
  const item = data[key];
  const list = await events(item.shipmentId);
  console.log("\n==", key, item.shipmentId, item.barcode);
  for (const e of list) console.log(JSON.stringify(e));
}

// Also check how unload is done in cockpit
const env = fs.readFileSync("apps/api/.env", "utf8");
console.log("\nRS base", (env.match(/^NESY_RS_STAGE_BASE_URL=(.+)$/m) || [])[1]);
