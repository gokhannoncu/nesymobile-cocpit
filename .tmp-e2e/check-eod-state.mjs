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
const p = sched.payload;
console.log({
  scheduleStatus: p?.scheduleStatus,
  endofDayRequestTime: p?.endofDayRequestTime,
  stops: p?.stopList?.length,
});

const list = await (await fetch("http://localhost:4001/api/workflows?limit=100")).json();
for (const part of ["19 · Remote", "21 · Pickup Failed", "14 · DEPS", "17 · Delivery Failed"]) {
  const wf = list.data.find((w) => w.name.includes(part));
  if (!wf) continue;
  const runs = await (await fetch(`http://localhost:4001/api/workflows/${wf.id}/runs?limit=1`)).json();
  const run = runs.data[0];
  console.log("\n===", part, run?.status);
  console.log((run?.maestroOutput || "").split("\n").slice(-28).join("\n"));
}
