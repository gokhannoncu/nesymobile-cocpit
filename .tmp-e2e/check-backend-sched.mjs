#!/usr/bin/env node
import fs from "node:fs";

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
const sched = await (
  await fetch(`${base}/Task/GetTodayScheduleByCourierZone`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify("36"),
  })
).json();
fs.writeFileSync(".tmp-e2e/backend-sched-now.json", JSON.stringify(sched, null, 2));
const p = sched.payload;
console.log("status", p?.status, "scheduleId", p?.scheduleId, "stops", p?.stops?.length);
const data = JSON.parse(fs.readFileSync(".tmp-e2e/test-data.json", "utf8"));
const want = new Set();
for (const v of Object.values(data)) {
  if (v?.barcode) want.add(v.barcode);
  for (const b of v?.allBarcodes || []) want.add(b);
}
let found = 0;
for (const stop of p?.stops || []) {
  for (const task of stop.taskList || []) {
    for (const ship of task.shipmentList || []) {
      for (const item of ship.shipmentItemList || []) {
        const short = item.legacySystemShortBarcode;
        if (want.has(short)) {
          found++;
          console.log(
            "FOUND",
            short,
            "task",
            task.taskStatus,
            "item",
            item.shipmentItemStatus,
            "type",
            task.taskType,
            "loc",
            item.itemCurrentLocation,
          );
        }
      }
    }
  }
}
console.log("found", found, "of", want.size);
let pend = 0;
let total = 0;
for (const stop of p?.stops || []) {
  for (const task of stop.taskList || []) {
    for (const ship of task.shipmentList || []) {
      for (const item of ship.shipmentItemList || []) {
        total++;
        if (task.taskType === 2 && item.shipmentItemStatus !== 6) {
          pend++;
          console.log("PEND DEL", item.legacySystemShortBarcode, item.shipmentItemStatus, item.itemCurrentLocation);
        }
      }
    }
  }
}
console.log({ total, pendDel: pend });
