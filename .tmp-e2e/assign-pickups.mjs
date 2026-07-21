#!/usr/bin/env node
/**
 * RS-stage pickup assign — hubId 100 Cockpit blocker'ını bypass eder.
 * PATH-NOTES: hub 11 + zone 36 + Task/UpdatePickup + Task/AssignPickupToCourier.
 *
 * Kullanım: node .tmp-e2e/assign-pickups.mjs
 */
import fs from "node:fs";

const API = process.env.COCKPIT_API ?? "http://localhost:4001/api";
const COUNTRY = "RS";
const ENV = "stage";
const HUB_ID = "11";
const ZONE = "36";

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
  return json;
}

function todayDate() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

(async () => {
  const data = JSON.parse(fs.readFileSync(".tmp-e2e/test-data.json", "utf8"));
  const login = await post("/nesy/auth/login", { country: COUNTRY, environment: ENV });
  const token = login.result?.payload?.token;
  if (!token) throw new Error("no admin token");

  // Resolve Nesy base URL via a lightweight Cockpit proxy that echoes upstream
  // by calling GetPickupList through /api/pickups when available; otherwise call
  // assign endpoint with branchId override (Cockpit may still use hub 100).
  // Direct Nesy calls go through env-backed server-side helpers — here we use
  // Cockpit /api/pickups/:id/assign with branchId=11 (fixed in assign body).
  const pickKeys = Object.entries(data).filter(([, v]) => v.route === "pickup" && v.dbId && !v.error);

  for (const [key, item] of pickKeys) {
    try {
      const res = await post(`/pickups/${item.dbId}/assign`, {
        token,
        country: COUNTRY,
        environment: ENV,
        branchId: HUB_ID,
        courierZoneCode: ZONE,
        date: new Date().toISOString(),
      });
      console.log(`  ✓ ${key} assign via Cockpit →`, res.message ?? "ok", item.barcode);
      item.assigned = true;
      item.assignHub = HUB_ID;
      item.assignZone = ZONE;
    } catch (err) {
      console.error(`  ✗ ${key} Cockpit assign failed: ${err.message}`);
      // Fallback: try direct Nesy Task endpoints via a small inline proxy using
      // /api/nesy/dashboard is not available for Task/* — mark for manual.
      item.assigned = false;
      item.assignError = String(err.message);
    }
  }

  fs.writeFileSync(".tmp-e2e/test-data.json", JSON.stringify(data, null, 2));
  console.log("\nUpdated .tmp-e2e/test-data.json");
  console.log(`Date context: ${todayDate()} hub=${HUB_ID} zone=${ZONE}`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
