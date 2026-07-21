#!/usr/bin/env node
/**
 * Tur onaylandıktan sonra: START sync → kalan barkodları yükle → shipment flows → EOD
 */
import fs from "node:fs";
import { execSync } from "node:child_process";

const API = process.env.COCKPIT_API ?? "http://localhost:4001/api";
const DEVICE = process.env.DEVICE_ID ?? "R6CW400BC8N";
const APP = "com.arasdigital.nesymobile.rstest";

async function j(path, init) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const t = await res.text();
  let json = null;
  try { json = t ? JSON.parse(t) : null; } catch { json = t; }
  if (!res.ok) throw new Error(`${path} ${res.status}: ${typeof json === "string" ? json : JSON.stringify(json).slice(0, 300)}`);
  return json;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function sh(cmd) {
  try { return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }); }
  catch (e) { return String(e.stdout || e.message || ""); }
}

async function findWf(part) {
  const list = await j(`/workflows?search=${encodeURIComponent(part)}`);
  return (list?.data ?? []).find((w) => w.name.includes(part)) ?? (list?.data ?? [])[0];
}

async function runWorkflow(namePart, runInput, { soft = false, timeoutMs = 8 * 60_000 } = {}) {
  sh("adb forward --remove-all");
  if (!soft) {
    sh(`adb -s ${DEVICE} shell am force-stop ${APP}`);
    sh(`adb -s ${DEVICE} shell am start -n ${APP}/com.arasdigital.nesymobile.SplashActivity`);
    await sleep(3000);
  }
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
  const runId = started?.data?.runId;
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
    console.log(`    ${String(st.nodeType).padEnd(24)} ${st.status}${st.errorMessage ? " - " + String(st.errorMessage).slice(0, 140) : ""}`);
  }
  return { status: last?.runStatus, runId, steps: last?.steps ?? [] };
}

async function runLoadStep(barcodes) {
  const wf = await findWf("01 · LOAD");
  const detail = await j(`/workflows/${wf.id}`);
  const nodes = detail?.data?.currentVersion?.nodes ?? detail?.data?.versions?.[0]?.nodes ?? [];
  const loadNode = nodes.find((n) => n.type === "LOAD_TO_VEHICLE");
  if (!loadNode) throw new Error("LOAD_TO_VEHICLE node not found");
  console.log(`\n▶ LOAD step-only barcodes=${barcodes.length}`);
  sh("adb forward --remove-all");
  const started = await j(`/workflows/${wf.id}/run-step`, {
    method: "POST",
    body: JSON.stringify({
      nodeId: loadNode.id,
      selectedDeviceId: DEVICE,
      runInput: { barcode: barcodes.join(",") },
    }),
  });
  const runId = started?.data?.runId;
  const deadline = Date.now() + 20 * 60_000;
  let last = null;
  while (Date.now() < deadline) {
    await sleep(5000);
    last = await j(`/workflows/runs/${runId}/status`);
    process.stdout.write(".");
    if (!["running", "pending", "queued"].includes(last.runStatus)) break;
  }
  console.log(`\n  → ${last?.runStatus}`);
  for (const st of last?.steps ?? []) {
    console.log(`    ${String(st.nodeType).padEnd(24)} ${st.status}${st.errorMessage ? " - " + String(st.errorMessage).slice(0, 140) : ""}`);
  }
  return last;
}

(async () => {
  const data = JSON.parse(fs.readFileSync(".tmp-e2e/test-data.json", "utf8"));
  const results = { tourApproved: { status: "success" } };

  console.log("== START sync (Approved) ==");
  results.sync = await runWorkflow("00 · START", undefined, { soft: false, timeoutMs: 3 * 60_000 });

  // Remaining delivery barcodes (skip already-loaded COD 6880051000268419)
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
  console.log(`\n== LOAD remaining (${remaining.length}) ==`);
  if (remaining.length) {
    results.loadRemaining = await runLoadStep(remaining);
  }

  try {
    execSync("node .tmp-e2e/assign-pickups.mjs", { stdio: "inherit" });
  } catch (e) {
    console.warn("assign:", e.message);
  }

  // Soft sync after assign
  results.sync2 = await runWorkflow("00 · START", undefined, { soft: false, timeoutMs: 3 * 60_000 });

  const plan = [
    { key: "10-standard", name: "10 · Standard" },
    { key: "11-cod-cash", name: "11 · COD" },
    { key: "12-cc", name: "12 · Credit" },
    { key: "13-multicolli", name: "13 · Multicolli" },
    { key: "14-deps", name: "14 · DEPS" },
    { key: "17-delivery-failed", name: "17 · Delivery Failed", extra: { failReason: "15" } },
    { key: "18-pickup", name: "18 · Pickup" },
    { key: "19-remote-pickup", name: "19 · Remote" },
    { key: "21-pickup-failed", name: "21 · Pickup Failed", extra: { failReason: "43" } },
  ];

  const fresh = JSON.parse(fs.readFileSync(".tmp-e2e/test-data.json", "utf8"));
  for (const step of plan) {
    const item = fresh[step.key];
    if (!item?.barcode) {
      results[step.key] = { status: "skipped" };
      continue;
    }
    if (item.route === "pickup" && item.assigned === false) {
      results[step.key] = { status: "skipped", reason: "assign failed" };
      continue;
    }
    const input = { barcode: item.barcode, ...(step.extra || {}) };
    let r = await runWorkflow(step.name, input, { soft: true, timeoutMs: 8 * 60_000 });
    if (r.status !== "success") {
      r = await runWorkflow(step.name, input, { soft: false, timeoutMs: 8 * 60_000 });
    }
    results[step.key] = r;
  }

  console.log("\n== END OF DAY ==");
  results.eod = await runWorkflow("99 · END", undefined, { soft: false, timeoutMs: 5 * 60_000 });

  fs.writeFileSync(".tmp-e2e/phase3-results.json", JSON.stringify(results, null, 2));
  console.log("\n========== SUMMARY ==========");
  for (const [k, v] of Object.entries(results)) {
    console.log(`  ${k.padEnd(28)} ${v.status ?? v.runStatus ?? "?"}`);
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
