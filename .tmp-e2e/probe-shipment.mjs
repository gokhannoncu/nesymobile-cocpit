#!/usr/bin/env node
import fs from "node:fs";

const data = JSON.parse(fs.readFileSync(".tmp-e2e/test-data.json", "utf8"));
const item = data["11-cod-cash"] || data["10-standard"];
const env = fs.readFileSync("apps/api/.env", "utf8");
const base = (env.match(/^NESY_RS_STAGE_BASE_URL=(.+)$/m) || [])[1]?.trim().replace(/["']/g, "");

const login = await (
  await fetch("http://localhost:4001/api/nesy/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ country: "RS", environment: "stage" }),
  })
).json();
const token = login.result?.payload?.token;

async function tryPost(path, body) {
  const r = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  return { status: r.status, j };
}

console.log("probing", item);

// Common detail endpoints
for (const [path, body] of [
  ["/Shipment/GetShipmentByTrackingNumber", item.shipmentId],
  ["/Shipment/GetShipmentDetailByWaybillNumber", item.shipmentId],
  ["/Integration/GetShipmentDetailByWaybillNumber", { WaybillNumber: item.shipmentId }],
  ["/Shipment/FilterShipment", { Barcode: item.barcode }],
  ["/Shipment/FilterShipment", { TrackingNumber: item.shipmentId }],
]) {
  try {
    const { status, j } = await tryPost(path, body);
    const s = JSON.stringify(j);
    console.log("\n==", path, status, "len", s.length);
    console.log(s.slice(0, 600));
  } catch (e) {
    console.log(path, e.message);
  }
}

// Cockpit shipment events with token
const ev = await fetch("http://localhost:4001/api/shipments/events", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ token, country: "RS", environment: "stage", shipmentId: item.shipmentId }),
}).then((r) => r.json());
console.log("\nevents", JSON.stringify(ev).slice(0, 800));

// Schedule shape
const sched = await tryPost("/Task/GetTodayScheduleByCourierZone", "36");
console.log("\nsched keys", Object.keys(sched.j || {}));
console.log("payload type", typeof sched.j?.payload, Array.isArray(sched.j?.payload));
if (sched.j?.payload && typeof sched.j.payload === "object") {
  console.log("payload keys", Object.keys(sched.j.payload));
  console.log("status", sched.j.payload.status ?? sched.j.payload.Status);
  console.log("stops", (sched.j.payload.stops || sched.j.payload.Stops || []).length);
}
