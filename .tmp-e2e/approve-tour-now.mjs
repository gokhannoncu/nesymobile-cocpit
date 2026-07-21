import fs from "node:fs";
const API = "http://localhost:4001/api";
const login = await (
  await fetch(`${API}/nesy/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ country: "RS", environment: "stage" }),
  })
).json();
const token = login.result?.payload?.token;
const env = fs.readFileSync("apps/api/.env", "utf8");
const base = (env.match(/^NESY_RS_STAGE_BASE_URL=(.+)$/m) || [])[1]?.trim().replace(/["']/g, "");
const today = new Date();
const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

const waiting = await (
  await fetch(`${base}/Task/GetWaitingLeavingRequests`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ StartDate: iso, EndDate: iso, HubIds: ["11"] }),
  })
).json();
const list = waiting.payload || [];
console.log(
  "waiting",
  list.length,
  list.map((x) => ({ scheduleId: x.scheduleId, zone: x.courierZoneCode, status: x.scheduleStatus })),
);

const match = list.find((x) => x.courierZoneCode === "36") || list[0];
if (!match) {
  console.log("nothing to approve");
  process.exit(0);
}

const sched = await (
  await fetch(`${base}/Task/GetTodayScheduleByCourierZone`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify("36"),
  })
).json();
const username = sched.payload?.courierUsername || "G.ONCU";
const scheduleId = match.scheduleId;

// Proven shape from earlier e2e (PascalCase + EventLocation required)
const body = {
  TimeSpan: new Date().toISOString(),
  CourierUserNames: [{ ScheduleId: scheduleId, CourierUserName: username }],
  EventLocation: { Longitude: 20.4489, Accuracy: 10, Latitude: 44.7866 },
  ScheduleIds: [scheduleId],
};
console.log("approving", JSON.stringify(body));

const approve = await fetch(`${base}/Task/ApproveLeavingPermission`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
const aj = await approve.json();
console.log("approve", approve.status, JSON.stringify(aj).slice(0, 500));
