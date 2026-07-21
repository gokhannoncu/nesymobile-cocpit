#!/usr/bin/env node
/**
 * Faz 3 devam — START cihaz tarafında hazır (login/route/schedule).
 * LOAD&TOUR → assign pickups → sync → shipment flows → EOD
 */
import fs from "node:fs";
import { execSync } from "node:child_process";

const API = process.env.COCKPIT_API ?? "http://localhost:4001/api";
const DEVICE = process.env.DEVICE_ID ?? "R6CW400BC8N";
const COUNTRY = "RS";
const ENV = "stage";
const APP = "com.arasdigital.nesymobile.rstest";

async function j(path, init) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const t = await res.text();
  let json = null;
  try { json = t ? JSON.parse(t) : null; } catch { json = t; }
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path} → ${res.status}: ${typeof json === "string" ? json : JSON.stringify(json).slice(0, 400)}`);
  return json;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function sh(cmd) {
  try { return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
  catch (e) { return e.stdout || e.message || ""; }
}
function recoverDevice() {
  console.log("  … device recover");
  sh("adb forward --remove-all");
  // Don't force-stop if already logged in with schedule — just clear maestro forwards
}

async function findWf(namePart) {
  const list = await j(`/workflows?search=${encodeURIComponent(namePart)}`);
  const items = list?.data ?? [];
  return items.find((w) => w.name.includes(namePart)) ?? items[0] ?? null;
}

async function runWorkflow(namePart, runInput, { timeoutMs = 10 * 60_000, softStop = false } = {}) {
  if (!softStop) {
    sh("adb forward --remove-all");
    sh(`adb -s ${DEVICE} shell am force-stop ${APP}`);
    sh(`adb -s ${DEVICE} shell am start -n ${APP}/com.arasdigital.nesymobile.SplashActivity`);
    await sleep(3000);
  } else {
    sh("adb forward --remove-all");
    await sleep(1000);
  }
  const wf = await findWf(namePart);
  if (!wf) throw new Error(`workflow yok: ${namePart}`);
  console.log(`\n▶ ${wf.name} runInput=${JSON.stringify(runInput ?? {})}`);
  const started = await j(`/workflows/${wf.id}/run`, {
    method: "POST",
    body: JSON.stringify({
      selectedDeviceId: DEVICE,
      country: COUNTRY,
      environment: ENV,
      ...(runInput ? { runInput } : {}),
    }),
  });
  const runId = started?.data?.runId;
  if (!runId) throw new Error(`run başlamadı: ${JSON.stringify(started)}`);

  const deadline = Date.now() + timeoutMs;
  let last = null;
  while (Date.now() < deadline) {
    await sleep(5000);
    last = await j(`/workflows/runs/${runId}/status`);
    process.stdout.write(".");
    if (!["running", "pending", "queued"].includes(last.runStatus)) break;
  }
  console.log(`\n  → ${last?.runStatus} (runId=${runId})`);
  for (const st of last?.steps ?? []) {
    const err = st.errorMessage ? ` - ${String(st.errorMessage).slice(0, 160)}` : "";
    console.log(`    ${String(st.nodeType).padEnd(24)} ${st.status}${err}`);
  }
  return { runId, status: last?.runStatus, steps: last?.steps ?? [], wf };
}

(async () => {
  const data = JSON.parse(fs.readFileSync(".tmp-e2e/test-data.json", "utf8"));
  const results = { start: { status: "success", note: "device already ready (GET_STATE)" } };

  // Ensure START succeeds with fixed oracle (soft — keep session)
  console.log("== START (confirm ready) ==");
  results.startConfirm = await runWorkflow("00 · START", undefined, { timeoutMs: 3 * 60_000, softStop: false });

  const deliveryKeys = ["10-standard", "11-cod-cash", "12-cc", "13-multicolli", "14-deps", "17-delivery-failed"];
  const loadBarcodes = [];
  for (const k of deliveryKeys) {
    const item = data[k];
    if (!item || item.error) continue;
    const list = item.allBarcodes?.length ? item.allBarcodes : [item.barcode];
    for (const b of list) if (b) loadBarcodes.push(b);
  }

  console.log(`\n== LOAD & TOUR (${loadBarcodes.length} barcodes) ==`);
  results.loadTour = await runWorkflow("01 · LOAD", { barcode: loadBarcodes.join(",") }, { timeoutMs: 25 * 60_000, softStop: true });
  if (results.loadTour.status !== "success") {
    console.log("LOAD&TOUR retry…");
    results.loadTour = await runWorkflow("01 · LOAD", { barcode: loadBarcodes.join(",") }, { timeoutMs: 25 * 60_000, softStop: false });
  }

  console.log("\n== assign pickups ==");
  try { execSync("node .tmp-e2e/assign-pickups.mjs", { stdio: "inherit" }); }
  catch (e) { console.warn("assign failed:", e.message); }

  console.log("\n== post-tour sync ==");
  results.postTourSync = await runWorkflow("00 · START", undefined, { timeoutMs: 3 * 60_000, softStop: false });

  const shipmentPlan = [
    { key: "10-standard", name: "10 · Standard", input: (d) => ({ barcode: d.barcode }) },
    { key: "11-cod-cash", name: "11 · COD", input: (d) => ({ barcode: d.barcode }) },
    { key: "12-cc", name: "12 · Credit", input: (d) => ({ barcode: d.barcode }) },
    { key: "13-multicolli", name: "13 · Multicolli", input: (d) => ({ barcode: d.barcode }) },
    { key: "14-deps", name: "14 · DEPS", input: (d) => ({ barcode: d.barcode }) },
    { key: "17-delivery-failed", name: "17 · Delivery Failed", input: (d) => ({ barcode: d.barcode, failReason: "15" }) },
    { key: "18-pickup", name: "18 · Pickup", input: (d) => ({ barcode: d.barcode }) },
    { key: "19-remote-pickup", name: "19 · Remote", input: (d) => ({ barcode: d.barcode }) },
    { key: "21-pickup-failed", name: "21 · Pickup Failed", input: (d) => ({ barcode: d.barcode, failReason: "43" }) },
  ];

  const fresh = JSON.parse(fs.readFileSync(".tmp-e2e/test-data.json", "utf8"));
  for (const step of shipmentPlan) {
    const item = fresh[step.key];
    if (!item || item.error || !item.barcode) {
      results[step.key] = { status: "skipped", reason: "no data" };
      continue;
    }
    if (item.route === "pickup" && item.assigned === false) {
      results[step.key] = { status: "skipped", reason: "assign failed" };
      continue;
    }
    try {
      results[step.key] = await runWorkflow(step.name, step.input(item), { timeoutMs: 8 * 60_000, softStop: true });
      if (results[step.key].status !== "success") {
        // one hard recover retry
        results[step.key] = await runWorkflow(step.name, step.input(item), { timeoutMs: 8 * 60_000, softStop: false });
      }
    } catch (e) {
      results[step.key] = { status: "error", error: String(e.message || e) };
    }
  }

  console.log("\n== END OF DAY ==");
  results.eod = await runWorkflow("99 · END", undefined, { timeoutMs: 5 * 60_000, softStop: false });

  fs.writeFileSync(".tmp-e2e/phase3-results.json", JSON.stringify(results, null, 2));
  console.log("\n========== PHASE 3 SUMMARY ==========");
  for (const [k, v] of Object.entries(results)) {
    console.log(`  ${k.padEnd(28)} ${v.status ?? "?"}`);
  }
  const failed = Object.values(results).filter((v) => v.status && !["success", "skipped"].includes(v.status));
  process.exitCode = failed.length ? 2 : 0;
})().catch((e) => { console.error(e); process.exit(1); });
