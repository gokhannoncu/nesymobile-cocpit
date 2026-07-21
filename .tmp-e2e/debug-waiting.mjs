import fs from "node:fs";
const API = "http://localhost:4001/api";
const login = await (await fetch(`${API}/nesy/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ country: "RS", environment: "stage" }),
})).json();
const token = login.result?.payload?.token;
const env = fs.readFileSync("apps/api/.env", "utf8");
const base = (env.match(/^NESY_RS_STAGE_BASE_URL=(.+)$/m) || [])[1]?.trim().replace(/["']/g, "");
console.log("base", base, "user", login.result?.payload?.user?.username);

const today = new Date();
const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

const bodies = [
  { StartDate: ymd, EndDate: ymd, HubIds: ["11"] },
  { StartDate: ymd, EndDate: ymd },
  { StartDate: iso, EndDate: iso, HubIds: ["11"] },
  { StartDate: iso, EndDate: iso },
  { startDate: iso, endDate: iso, hubIds: ["11"] },
];

for (const body of bodies) {
  const res = await fetch(`${base}/Task/GetWaitingLeavingRequests`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  const payload = json.payload ?? json.Payload;
  const arr = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.Items)
        ? payload.Items
        : null;
  console.log("\nbody", JSON.stringify(body), "http", res.status, "resultCode", json.resultCode);
  console.log("payload type", Array.isArray(payload) ? `array(${payload.length})` : typeof payload);
  if (arr?.length) console.log("first", JSON.stringify(arr[0]).slice(0, 500));
  else console.log("raw", JSON.stringify(json).slice(0, 400));
}

// Also check today's schedule for zone 36
const sched = await fetch(`${base}/Task/GetTodayScheduleByCourierZone`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify("36"),
}).then((r) => r.json());
console.log("\nGetTodayScheduleByCourierZone", JSON.stringify(sched).slice(0, 800));
