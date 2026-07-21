#!/usr/bin/env node
/**
 * After API zimmet: sync device + run delivery/pickup/EOD happy-path flows.
 */
import fs from "node:fs";
import { execSync } from "node:child_process";

const API = "http://localhost:4001/api";
const DEVICE = "R6CW400BC8N";
const APP = "com.arasdigital.nesymobile.rstest";
const RECEIVER = `${APP}/com.arasdigital.nesymobile.adb.ProtectedRequestKeyReceiver`;

async function j(path, init) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const t = await res.text();
  let json = null;
  try {
    json = t ? JSON.parse(t) : null;
  } catch {
    json = t;
  }
  if (!res.ok) throw new Error(`${path} ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
  return json;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    return String(e.stdout || e.message || "");
  }
};

function prepDevice({ hard = false } = {}) {
  sh("adb forward --remove-all");
  if (hard) {
    sh(`adb -s ${DEVICE} shell am force-stop ${APP}`);
    sh(`adb -s ${DEVICE} shell am start -n ${APP}/com.arasdigital.nesymobile.SplashActivity`);
  }
  sh(
    `adb -s ${DEVICE} shell am broadcast -a com.arasdigital.nesymobile.SET_RUN -n ${RECEIVER} --es run_id phase3 --es skip_delivery_wait true`,
  );
  sh(
    `adb -s ${DEVICE} shell am broadcast -a com.arasdigital.nesymobile.NAV_TO -n ${APP}/com.arasdigital.nesymobile.adb.TestNavigationReceiver --es destination stops`,
  );
}

async function findWf(part) {
  const list = await j(`/workflows?search=${encodeURIComponent(part)}`);
  return (list?.data ?? []).find((w) => w.name.includes(part)) ?? (list?.data ?? [])[0];
}

async function poll(runId, timeoutMs = 10 * 60_000) {
  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    await sleep(5000);
    last = await j(`/workflows/runs/${runId}/status`);
    process.stdout.write(".");
    if (!["running", "pending", "queued"].includes(last.runStatus)) break;
  }
  console.log(`\n  → ${last?.runStatus}`);
  for (const st of last?.steps ?? []) {
    console.log(
      `    ${String(st.nodeType).padEnd(28)} ${st.status}${st.errorMessage ? " - " + String(st.errorMessage).slice(0, 160) : ""}`,
    );
  }
  return last;
}

async function runWf(namePart, runInput, { hard = false, timeoutMs = 10 * 60_000 } = {}) {
  prepDevice({ hard });
  await sleep(hard ? 5000 : 1500);
  const wf = await findWf(namePart);
  console.log(`\n▶ ${wf.name} ${JSON.stringify(runInput ?? {})}`);
  const started = await j(`/workflows/${wf.id}/run`, {
    method: "POST",
    body: JSON.stringify({
      selectedDeviceId: DEVICE,
      country: "RS",
      environment: "stage",
      ...(runInput ? { runInput } : {}),
    }),
  });
  return poll(started.data.runId, timeoutMs);
}

const data = JSON.parse(fs.readFileSync(".tmp-e2e/test-data.json", "utf8"));
const results = {};

console.log("== START (sync after API zimmet) ==");
results.start = await runWf("00 · START", undefined, { hard: true, timeoutMs: 3 * 60_000 });

// Verify schedule has pending deliveries
const sched = await fetch(`http://localhost:4002/api/adb/schedule?serial=${DEVICE}`).then((r) => r.json());
const want = new Set();
for (const v of Object.values(data)) {
  if (v?.barcode) want.add(v.barcode);
  for (const b of v?.allBarcodes || []) want.add(b);
}
let pendingDel = 0;
for (const stop of sched.schedule?.stops || []) {
  for (const task of stop.taskList || []) {
    for (const ship of task.shipmentList || []) {
      for (const item of ship.shipmentItemList || []) {
        if (want.has(item.legacySystemShortBarcode) && task.taskType === 2 && item.shipmentItemStatus !== 6) {
          pendingDel++;
          console.log("DEVICE PENDING", item.legacySystemShortBarcode, "item", item.shipmentItemStatus, "loc", item.itemCurrentLocation);
        }
      }
    }
  }
}
console.log("device pending deliveries", pendingDel, "stops", sched.schedule?.stops?.length);

const plan = [
  { key: "11-cod-cash", name: "11 · COD" },
  { key: "10-standard", name: "10 · Standard" },
  { key: "12-cc", name: "12 · Credit" },
  { key: "13-multicolli", name: "13 · Multicolli" },
  { key: "14-deps", name: "14 · DEPS" },
  { key: "17-delivery-failed", name: "17 · Delivery Failed", extra: { failReason: "15" } },
];

for (const step of plan) {
  const item = data[step.key];
  if (!item?.barcode) {
    results[step.key] = { runStatus: "skipped" };
    continue;
  }
  let r = await runWf(step.name, { barcode: item.barcode, ...(step.extra || {}) }, { hard: true });
  if (r?.runStatus !== "success") {
    console.log("  retry once…");
    r = await runWf(step.name, { barcode: item.barcode, ...(step.extra || {}) }, { hard: true });
  }
  results[step.key] = r;
}

try {
  execSync("node .tmp-e2e/assign-pickups.mjs", { stdio: "inherit" });
} catch {}
const fresh = JSON.parse(fs.readFileSync(".tmp-e2e/test-data.json", "utf8"));
for (const step of [
  { key: "18-pickup", name: "18 · Pickup" },
  { key: "19-remote-pickup", name: "19 · Remote" },
  { key: "21-pickup-failed", name: "21 · Pickup Failed", extra: { failReason: "43" } },
]) {
  const item = fresh[step.key];
  if (!item?.barcode) {
    results[step.key] = { runStatus: "skipped" };
    continue;
  }
  results[step.key] = await runWf(step.name, { barcode: item.barcode, ...(step.extra || {}) }, { hard: true });
}

results.eod = await runWf("99 · END", undefined, { hard: true, timeoutMs: 5 * 60_000 });

fs.writeFileSync(".tmp-e2e/phase3-results.json", JSON.stringify(results, null, 2));
console.log("\n========== PHASE 3 SUMMARY ==========");
for (const [k, v] of Object.entries(results)) {
  console.log(`  ${k.padEnd(28)} ${v?.runStatus ?? "?"}`);
}
process.exitCode = Object.values(results).some(
  (v) => v?.runStatus && !["success", "skipped"].includes(v.runStatus),
)
  ? 2
  : 0;