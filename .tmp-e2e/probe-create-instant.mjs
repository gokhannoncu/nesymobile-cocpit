#!/usr/bin/env node
import fs from "node:fs";

const API = "http://localhost:4001/api";
const data = JSON.parse(fs.readFileSync(".tmp-e2e/test-data.json", "utf8"));
const barcode = data["11-cod-cash"].barcode;
const env = fs.readFileSync("apps/api/.env", "utf8");
const base = (env.match(/^NESY_RS_STAGE_BASE_URL=(.+)$/m) || [])[1]?.trim().replace(/["']/g, "");

// Try mobile login routes
const loginBodies = [
  { path: "/nesy/mobile/login", body: { country: "RS", environment: "stage", pinCode: "3680", deviceId: "c2a8055a018f2b92" } },
  { path: "/nesy-mobile/login", body: { country: "RS", environment: "stage", pinCode: "3680", deviceId: "c2a8055a018f2b92" } },
  { path: "/nesy/auth/mobile-login", body: { country: "RS", environment: "stage", pinCode: "3680", deviceId: "c2a8055a018f2b92" } },
];

let token = null;
for (const { path, body } of loginBodies) {
  const r = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  console.log(path, r.status, JSON.stringify(j).slice(0, 250));
  token =
    j?.result?.payload?.token ||
    j?.data?.token ||
    j?.token ||
    j?.result?.token ||
    null;
  if (token) break;
}

if (!token) {
  // Fallback: admin token (may fail authorization on mobile endpoint)
  const login = await (
    await fetch(`${API}/nesy/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country: "RS", environment: "stage" }),
    })
  ).json();
  token = login.result?.payload?.token;
  console.log("using admin token fallback", !!token);
}

const courierUserId = "6889e5bdf06d7b29960cfa23"; // from schedule
const body = {
  barcodeList: [barcode],
  courierZoneCode: "36",
  courierName: "GOKHAN ONCU",
  courierUserId,
  branchId: 11,
  channelType: "Terminal",
};
console.log("request", body);

const res = await fetch(`${base}/Shipment/GetShipmentCreateInstantTaskServiceData`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const j = await res.json().catch(() => ({}));
fs.writeFileSync(".tmp-e2e/create-instant-probe.json", JSON.stringify(j, null, 2));
console.log("status", res.status);
console.log("keys", Object.keys(j));
console.log("resultCode", j.resultCode, j.resultMessage);
const payload = j.payload;
if (payload) {
  console.log("payload keys", Object.keys(payload));
  const list =
    payload.rawShipmentItemModelList ||
    payload.RawShipmentItemModelList ||
    payload.createInstantTaskRequestData?.rawShipmentItemModelList ||
    [];
  console.log("items", Array.isArray(list) ? list.length : typeof list);
  if (Array.isArray(list) && list[0]) {
    const item = list[0];
    console.log("item keys", Object.keys(item));
    console.log({
      legacySystemShortBarcode: item.legacySystemShortBarcode || item.LegacySystemShortBarcode,
      legacySystemBarcode: item.legacySystemBarcode || item.LegacySystemBarcode,
      itemBarcode: item.itemBarcode || item.ItemBarcode || item.barcode || item.Barcode,
      legacySystemShortBarcodeTrim: item.legacySystemShortBarcodeTrim || item.LegacySystemShortBarcodeTrim,
      waybill: item.waybillNumber || item.WaybillNumber,
    });
  }
} else {
  console.log(JSON.stringify(j).slice(0, 1000));
}
