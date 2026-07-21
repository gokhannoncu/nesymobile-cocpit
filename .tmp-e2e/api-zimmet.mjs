#!/usr/bin/env node
/**
 * Bypass silent mobile matchedItem-null: call GetShipmentCreateInstantTask + CreateInstanceTask
 * for each delivery barcode, then courier can refresh schedule.
 */
import fs from "node:fs";

const API = "http://localhost:4001/api";
const env = fs.readFileSync("apps/api/.env", "utf8");
const base = (env.match(/^NESY_RS_STAGE_BASE_URL=(.+)$/m) || [])[1]?.trim().replace(/["']/g, "");
const data = JSON.parse(fs.readFileSync(".tmp-e2e/test-data.json", "utf8"));

const login = await (
  await fetch(`${API}/nesy/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ country: "RS", environment: "stage" }),
  })
).json();
const token = login.result?.payload?.token;

function parsePayload(p) {
  if (typeof p === "string") return JSON.parse(p);
  if (p && typeof p === "object" && p["0"] !== undefined) {
    return JSON.parse(
      Object.keys(p)
        .sort((a, b) => Number(a) - Number(b))
        .map((k) => p[k])
        .join(""),
    );
  }
  return p;
}

async function zimmet(barcode) {
  const fetchBody = {
    barcodeList: [barcode],
    courierZoneCode: "36",
    courierName: "GOKHAN ONCU",
    courierUserId: "6889e5bdf06d7b29960cfa23",
    branchId: 11,
    channelType: "Terminal",
  };
  const fr = await fetch(`${base}/Shipment/GetShipmentCreateInstantTaskServiceData`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(fetchBody),
  });
  const fj = await fr.json();
  const payload = parsePayload(fj.payload);
  if (!payload?.IsSuccess && payload?.Message) {
    return { barcode, ok: false, stage: "fetch", message: payload.Message };
  }
  const req = payload?.CreateInstantTaskRequestData;
  if (!req) return { barcode, ok: false, stage: "fetch", message: "no CreateInstantTaskRequestData" };

  // Align courier zone on request (shipment may geocode to 63)
  req.CourierZoneCode = "36";
  req.CourierUserId = "6889e5bdf06d7b29960cfa23";
  req.CourierName = "GOKHAN ONCU";
  req.HubId = req.HubId || "11";
  req.SendNotification = req.SendNotification ?? true;
  // Ensure time window present
  for (const item of req.RawShipmentItemModelList || []) {
    if (!item.TimeWindow) item.TimeWindow = "07:00-09:00";
    item.CourierZoneCode = "36";
  }

  const ep = "/Task/CreateInstantTask";
  const cr = await fetch(`${base}${ep}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  const text = await cr.text();
  let cj;
  try {
    cj = JSON.parse(text);
  } catch {
    cj = { raw: text.slice(0, 300) };
  }
  return {
    barcode,
    ok: cr.ok && cj.resultCode === 200,
    stage: "create",
    endpoint: ep,
    status: cr.status,
    resultCode: cj.resultCode,
    message: cj.resultMessage,
    stops: cj.payload?.stops?.length ?? cj.payload?.Stops?.length ?? cj.payload?.stopList?.length,
    body: JSON.stringify(cj).slice(0, 500),
  };
}

const keys = ["10-standard", "11-cod-cash", "12-cc", "13-multicolli", "14-deps", "17-delivery-failed"];
const results = [];
for (const key of keys) {
  const item = data[key];
  if (!item) continue;
  const barcodes = item.allBarcodes?.length ? item.allBarcodes : [item.barcode];
  for (const b of barcodes) {
    const r = await zimmet(b);
    console.log(JSON.stringify(r));
    results.push(r);
  }
}
fs.writeFileSync(".tmp-e2e/api-zimmet-results.json", JSON.stringify(results, null, 2));
console.log("done", results.filter((r) => r.ok).length, "/", results.length);
