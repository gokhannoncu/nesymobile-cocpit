#!/usr/bin/env node
import fs from "node:fs";
import { execSync } from "node:child_process";

const API = "http://localhost:4001/api";
const DEVICE = "R6CW400BC8N";
const APP = "com.arasdigital.nesymobile.rstest";

async function j(path, init) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const t = await res.text();
  let json = null;
  try { json = t ? JSON.parse(t) : null; } catch { json = t; }
  if (!res.ok) throw new Error(`${path} ${res.status}: ${JSON.stringify(json).slice(0, 300)}`);
  return json;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => {
  try { return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
  catch (e) { return String(e.stdout || e.message || ""); }
};

async function findWf(part) {
  const list = await j(`/workflows?search=${encodeURIComponent(part)}`);
  return (list?.data ?? []).find((w) => w.name.includes(part)) ?? (list?.data ?? [])[0];
}

async function poll(runId, timeoutMs) {
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
    console.log(`    ${String(st.nodeType).padEnd(24)} ${st.status}${st.errorMessage ? " - " + String(st.errorMessage).slice(0, 120) : ""}`);
  }
  return last;
}

async function runWf(namePart, runInput, soft = true) {
  sh("adb forward --remove-all");
  if (!soft) {
    sh(`adb -s ${DEVICE} shell am force-stop ${APP}`);
    sh(`adb -s ${DEVICE} shell am start -n ${APP}/com.arasdigital.nesymobile.SplashActivity`);
    await sleep(3500);
  }
  // keep skip flag
  sh(`adb -s ${DEVICE} shell am broadcast -a com.arasdigital.nesymobile.SET_RUN -n ${APP}/com.arasdigital.nesymobile.adb.ProtectedRequestKeyReceiver --es run_id phase3 --es skip_delivery_wait true`);
  const wf = await findWf(namePart);
  console.log(`\n▶ ${wf.name} ${JSON.stringify(runInput ?? {})}`);
  const started = await j(`/workflows/${wf.id}/run`, {
    method: "POST",
    body: JSON.stringify({ selectedDeviceId: DEVICE, country: "RS", environment: "stage", ...(runInput ? { runInput } : {}) }),
  });
  return poll(started.data.runId, 10 * 60_000);
}

async function loadBarcodes(barcodes) {
  const wf = await findWf("01 · LOAD");
  const detail = await j(`/workflows/${wf.id}`);
  const ver = detail?.data?.currentVersion ?? detail?.data?.versions?.[0];
  const nodes = ver?.nodes ?? [];
  const loadNode = nodes.find((n) => n.type === "LOAD_TO_VEHICLE");
  console.log(`\n▶ LOAD step ${barcodes.length} barcodes`);
  sh("adb forward --remove-all");
  sh(`adb -s ${DEVICE} shell am broadcast -a com.arasdigital.nesymobile.SET_RUN -n ${APP}/com.arasdigital.nesymobile.adb.ProtectedRequestKeyReceiver --es run_id phase3-load --es skip_delivery_wait true`);
  const started = await j(`/workflows/${wf.id}/run-step`, {
    method: "POST",
    body: JSON.stringify({
      nodeId: loadNode.id,
      selectedDeviceId: DEVICE,
      country: "RS",
      environment: "stage",
      runInput: { barcode: barcodes.join(",") },
    }),
  });
  return poll(started.data.runId, 25 * 60_000);
}

const data = JSON.parse(fs.readFileSync(".tmp-e2e/test-data.json", "utf8"));
const results = {};

// Load remaining (COD already on schedule)
const already = new Set(["6880051000268419"]);
const deliveryKeys = ["10-standard", "11-cod-cash", "12-cc", "13-multicolli", "14-deps", "17-delivery-failed"];
const remaining = [];
for (const k of deliveryKeys) {
  const item = data[k];
  if (!item?.barcode) continue;
  for (const b of item.allBarcodes?.length ? item.allBarcodes : [item.barcode]) {
    if (b && !already.has(b)) remaining.push(b);
  }
}

results.load = await loadBarcodes(remaining);

// Pull refresh via START (soft)
results.sync = await runWf("00 · START", undefined, false);

const plan = [
  { key: "10-standard", name: "10 · Standard" },
  { key: "11-cod-cash", name: "11 · COD" },
  { key: "12-cc", name: "12 · Credit" },
  { key: "13-multicolli", name: "13 · Multicolli" },
  { key: "14-deps", name: "14 · DEPS" },
  { key: "17-delivery-failed", name: "17 · Delivery Failed", extra: { failReason: "15" } },
];

for (const step of plan) {
  const item = data[step.key];
  if (!item?.barcode) { results[step.key] = { runStatus: "skipped" }; continue; }
  let r = await runWf(step.name, { barcode: item.barcode, ...(step.extra || {}) }, true);
  if (r?.runStatus !== "success") {
    r = await runWf(step.name, { barcode: item.barcode, ...(step.extra || {}) }, false);
  }
  results[step.key] = r;
}

// Pickups
try { execSync("node .tmp-e2e/assign-pickups.mjs", { stdio: "inherit" }); } catch {}
const fresh = JSON.parse(fs.readFileSync(".tmp-e2e/test-data.json", "utf8"));
for (const step of [
  { key: "18-pickup", name: "18 · Pickup" },
  { key: "19-remote-pickup", name: "19 · Remote" },
  { key: "21-pickup-failed", name: "21 · Pickup Failed", extra: { failReason: "43" } },
]) {
  const item = fresh[step.key];
  if (!item?.barcode || item.assigned === false) { results[step.key] = { runStatus: "skipped" }; continue; }
  let r = await runWf(step.name, { barcode: item.barcode, ...(step.extra || {}) }, true);
  if (r?.runStatus !== "success") r = await runWf(step.name, { barcode: item.barcode, ...(step.extra || {}) }, false);
  results[step.key] = r;
}

results.eod = await runWf("99 · END", undefined, false);

fs.writeFileSync(".tmp-e2e/phase3-results.json", JSON.stringify(results, null, 2));
console.log("\n========== SUMMARY ==========");
for (const [k, v] of Object.entries(results)) {
  console.log(`  ${k.padEnd(28)} ${v?.runStatus ?? "?"}`);
}
process.exitCode = Object.values(results).some((v) => v?.runStatus && !["success", "skipped"].includes(v.runStatus)) ? 2 : 0;
