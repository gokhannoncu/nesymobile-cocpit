#!/usr/bin/env node
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
}

async function findWf(part) {
  const list = await j(`/workflows?search=${encodeURIComponent(part)}`);
  return (list?.data ?? []).find((w) => w.name.includes(part)) ?? (list?.data ?? [])[0];
}

async function poll(runId, timeoutMs = 12 * 60_000) {
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
      `    ${String(st.nodeType).padEnd(28)} ${st.status}${st.errorMessage ? " - " + String(st.errorMessage).slice(0, 180) : ""}`,
    );
  }
  return last;
}

async function runWf(namePart, runInput, { hard = false, timeoutMs = 12 * 60_000 } = {}) {
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

async function eventCodes(shipmentId) {
  const login = await j("/nesy/auth/login", {
    method: "POST",
    body: JSON.stringify({ country: "RS", environment: "stage" }),
  });
  const token = login.result?.payload?.token;
  const ev = await j("/shipments/events", {
    method: "POST",
    body: JSON.stringify({ token, country: "RS", environment: "stage", shipmentId }),
  });
  return (ev?.data?.payload?.eventDetailList || []).map((e) => String(e.eventShortCode));
}

const data = JSON.parse(fs.readFileSync(".tmp-e2e/test-data.json", "utf8"));
const results = JSON.parse(fs.readFileSync(".tmp-e2e/phase3-results.json", "utf8"));

// Rebuild workflows so YAML/config updates land in DB versions
try {
  execSync("node .tmp-e2e/build-workflows.mjs", { stdio: "inherit" });
} catch (e) {
  console.warn("build-workflows warning", e.message);
}
// Give tsx-watch API a moment if yaml-generator was also edited mid-session
await sleep(8000);

console.log("== START ==");
results.start2 = await runWf("00 · START", undefined, { hard: true, timeoutMs: 3 * 60_000 });

const plan = [
  { key: "11-cod-cash", name: "11 · COD", need: ["40", "269"] },
  { key: "10-standard", name: "10 · Standard", need: ["40"] },
  { key: "12-cc", name: "12 · Credit", need: ["40", "269"] },
  { key: "13-multicolli", name: "13 · Multicolli", need: ["40"] },
  { key: "14-deps", name: "14 · DEPS", need: ["71"] },
  { key: "17-delivery-failed", name: "17 · Delivery Failed", need: ["131"], extra: { failReason: "15" } },
];

for (const step of plan) {
  const item = data[step.key];
  if (!item?.barcode) {
    results[step.key] = { runStatus: "skipped" };
    continue;
  }
  const codes = await eventCodes(item.shipmentId);
  const done = step.need.every((c) => codes.includes(c));
  console.log(`\n${step.key} events`, codes.join(","), done ? "ALREADY OK" : "NEED RUN");
  if (done) {
    results[step.key] = { runStatus: "success", note: "already had events", codes };
    continue;
  }
  let r = await runWf(step.name, { barcode: item.barcode, ...(step.extra || {}) }, { hard: true });
  if (r?.runStatus !== "success") {
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
