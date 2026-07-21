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
  try { json = t ? JSON.parse(t) : null; } catch { json = t; }
  if (!res.ok) throw new Error(`${path} ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
  return json;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (cmd) => {
  try { return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
  catch (e) { return String(e.stdout || e.message || ""); }
};

function prepDevice({ hard = false } = {}) {
  sh("adb forward --remove-all");
  if (hard) {
    sh(`adb -s ${DEVICE} shell am force-stop ${APP}`);
    sh(`adb -s ${DEVICE} shell am start -n ${APP}/com.arasdigital.nesymobile.SplashActivity`);
  }
  sh(`adb -s ${DEVICE} shell am broadcast -a com.arasdigital.nesymobile.SET_RUN -n ${RECEIVER} --es run_id phase3 --es skip_delivery_wait true`);
  sh(`adb -s ${DEVICE} shell am broadcast -a com.arasdigital.nesymobile.NAV_TO -n ${APP}/com.arasdigital.nesymobile.adb.TestNavigationReceiver --es destination stops`);
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
    console.log(`    ${String(st.nodeType).padEnd(28)} ${st.status}${st.errorMessage ? " - " + String(st.errorMessage).slice(0, 160) : ""}`);
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

async function loadBarcodes(barcodes) {
  const wf = await findWf("01 · LOAD");
  const detail = await j(`/workflows/${wf.id}`);
  const nodes = detail?.data?.currentVersion?.nodes ?? [];
  const loadNode = nodes.find((n) => n.type === "LOAD_TO_VEHICLE");
  const outcomes = [];
  for (const barcode of barcodes) {
    prepDevice({ hard: false });
    await sleep(1500);
    console.log(`\n▶ LOAD single ${barcode}`);
    const started = await j(`/workflows/${wf.id}/run-step`, {
      method: "POST",
      body: JSON.stringify({
        nodeId: loadNode.id,
        selectedDeviceId: DEVICE,
        country: "RS",
        environment: "stage",
        runInput: { barcode },
      }),
    });
    const last = await poll(started.data.runId, 5 * 60_000);
    outcomes.push({ barcode, status: last?.runStatus });
    if (last?.runStatus !== "success") {
      prepDevice({ hard: true });
      await sleep(4000);
      await runWf("00 · START", undefined, { hard: false, timeoutMs: 3 * 60_000 });
    }
  }
  const ok = outcomes.filter((o) => o.status === "success").length;
  console.log(`LOAD done ${ok}/${outcomes.length}`);
  return { runStatus: ok === outcomes.length ? "success" : ok > 0 ? "partial" : "failed", outcomes };
}

const data = JSON.parse(fs.readFileSync(".tmp-e2e/test-data.json", "utf8"));
const results = {};

const deliveryKeys = ["10-standard", "11-cod-cash", "12-cc", "13-multicolli", "14-deps", "17-delivery-failed"];
const toLoad = [];
for (const k of deliveryKeys) {
  const item = data[k];
  if (!item?.barcode) continue;
  for (const b of item.allBarcodes?.length ? item.allBarcodes : [item.barcode]) {
    if (b) toLoad.push(b);
  }
}

console.log("== START ==");
results.start = await runWf("00 · START", undefined, { hard: true, timeoutMs: 3 * 60_000 });

console.log("\n== LOAD all fresh ==");
results.load = await loadBarcodes(toLoad);

// Request tour if waiting; approve via helper
console.log("\n== TOUR REQUEST (run-step if present) ==");
try {
  const wf = await findWf("01 · LOAD");
  const detail = await j(`/workflows/${wf.id}`);
  const nodes = detail?.data?.currentVersion?.nodes ?? [];
  const tourNode = nodes.find((n) => n.type === "REQUEST_TOUR");
  if (tourNode) {
    prepDevice({ hard: false });
    const started = await j(`/workflows/${wf.id}/run-step`, {
      method: "POST",
      body: JSON.stringify({
        nodeId: tourNode.id,
        selectedDeviceId: DEVICE,
        country: "RS",
        environment: "stage",
      }),
    });
    results.tourRequest = await poll(started.data.runId, 3 * 60_000);
  }
} catch (e) {
  console.log("tour request skip", e.message);
  results.tourRequest = { runStatus: "skipped", error: String(e.message) };
}

try {
  execSync("node .tmp-e2e/approve-tour-now.mjs", { stdio: "inherit" });
  results.tourApprove = { runStatus: "success" };
} catch {
  results.tourApprove = { runStatus: "skipped" };
}

// Re-login/sync after approve
results.startAfterTour = await runWf("00 · START", undefined, { hard: true, timeoutMs: 3 * 60_000 });

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
  if (!item?.barcode) { results[step.key] = { runStatus: "skipped" }; continue; }
  let r = await runWf(step.name, { barcode: item.barcode, ...(step.extra || {}) }, { hard: true });
  if (r?.runStatus !== "success") {
    console.log("  retry once…");
    r = await runWf(step.name, { barcode: item.barcode, ...(step.extra || {}) }, { hard: true });
  }
  results[step.key] = r;
}

try { execSync("node .tmp-e2e/assign-pickups.mjs", { stdio: "inherit" }); } catch {}
const fresh = JSON.parse(fs.readFileSync(".tmp-e2e/test-data.json", "utf8"));
for (const step of [
  { key: "18-pickup", name: "18 · Pickup" },
  { key: "19-remote-pickup", name: "19 · Remote" },
  { key: "21-pickup-failed", name: "21 · Pickup Failed", extra: { failReason: "43" } },
]) {
  const item = fresh[step.key];
  if (!item?.barcode) { results[step.key] = { runStatus: "skipped" }; continue; }
  results[step.key] = await runWf(step.name, { barcode: item.barcode, ...(step.extra || {}) }, { hard: true });
}

results.eod = await runWf("99 · END", undefined, { hard: true, timeoutMs: 5 * 60_000 });

fs.writeFileSync(".tmp-e2e/phase3-results.json", JSON.stringify(results, null, 2));
console.log("\n========== PHASE 3 SUMMARY ==========");
for (const [k, v] of Object.entries(results)) {
  console.log(`  ${k.padEnd(28)} ${v?.runStatus ?? "?"}`);
}
process.exitCode = Object.values(results).some((v) => v?.runStatus && !["success", "skipped"].includes(v.runStatus)) ? 2 : 0;
