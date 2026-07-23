#!/usr/bin/env node
/**
 * Faz 5 — Load & Tour E2E via wizard-equivalent API call.
 * Uses .tmp-e2e/test-data.json barcodes + one pickup.
 */
import fs from "node:fs";

const API = process.env.COCKPIT_API ?? "http://localhost:4001/api";
const DEVICE = process.env.DEVICE_ID ?? "R6CW400BC8N";
const data = JSON.parse(fs.readFileSync(".tmp-e2e/test-data.json", "utf8"));

const deliveryBarcodes = Object.values(data)
  .filter((v) => v.route === "delivery" && !v.error)
  .flatMap((v) => v.allBarcodes ?? [v.barcode])
  .filter(Boolean);

const pickup = Object.values(data).find((v) => v.route === "pickup" && v.dbId && !v.error);

const runInput = {
  barcode: deliveryBarcodes.join(","),
  ...(pickup ? { pickupDbIds: pickup.dbId } : {}),
};

async function j(path, init) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log("Selections:");
console.log("  barcodes:", deliveryBarcodes.length, deliveryBarcodes.join(", "));
console.log("  pickupDbIds:", pickup?.dbId ?? "(none)");

const started = await j(`/workflows/01-load-tour-flow/run`, {
  method: "POST",
  body: JSON.stringify({
    selectedDeviceId: DEVICE,
    country: "RS",
    environment: "stage",
    runInput,
  }),
});
const runId = started?.data?.runId;
if (!runId) throw new Error(`run failed: ${JSON.stringify(started)}`);
console.log(`RUNID=${runId}`);
console.log(`Detail: http://localhost:4002/automation/01-load-tour-flow/runs/${runId}`);

let last = null;
for (let i = 0; i < 180; i++) {
  await sleep(5000);
  last = await j(`/workflows/runs/${runId}/status`);
  const status = last?.runStatus ?? "?";
  process.stdout.write(`\r[${i + 1}] ${status}   `);
  if (!["running", "pending", "queued"].includes(status)) break;
}

console.log(`\n\nFinal: ${last?.runStatus}`);
for (const st of last?.steps ?? []) {
  const err = st.errorMessage ? ` — ${String(st.errorMessage).slice(0, 160)}` : "";
  console.log(`  ${String(st.nodeType).padEnd(22)} ${st.status}${err}`);
}

// Post GET_STATE
const { execFileSync } = await import("node:child_process");
try {
  const out = execFileSync(
    "adb",
    [
      "-s",
      DEVICE,
      "shell",
      "am",
      "broadcast",
      "-a",
      "com.arasdigital.nesymobile.GET_STATE",
      "-n",
      "com.arasdigital.nesymobile.rstest/com.arasdigital.nesymobile.adb.ProtectedRequestKeyReceiver",
    ],
    { encoding: "utf8" },
  );
  const m = out.match(/data="([\s\S]*)"/);
  if (m?.[1]) console.log("\nGET_STATE:", m[1]);
} catch (e) {
  console.warn("GET_STATE failed:", e.message);
}

if (last?.runStatus !== "success") process.exitCode = 2;
