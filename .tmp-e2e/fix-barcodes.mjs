#!/usr/bin/env node
/** Mevcut test shipment'larının doğru legacySystemShortBarcode'unu backend'den çekip test-data.json'u düzeltir. */
import fs from "node:fs";
const API = process.env.COCKPIT_API ?? "http://localhost:4001/api";
const post = async (p, b) => (await fetch(API + p, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(b) })).json();

(async () => {
  const login = await post("/nesy/auth/login", { country: "RS", environment: "stage" });
  const token = login.result.payload.token;
  const data = JSON.parse(fs.readFileSync(".tmp-e2e/test-data.json", "utf8"));
  for (const [key, entry] of Object.entries(data)) {
    if (!entry.shipmentId || entry.error) continue;
    try {
      const det = await post("/shipments/details", { token, country: "RS", environment: "stage", shipmentId: entry.shipmentId });
      const d = det.data || det;
      const parcels = d.parcels || d.Parcels || [];
      const shorts = parcels.map((p) => p.legacySystemShortBarcode || p.LegacySystemShortBarcode).filter(Boolean);
      if (shorts.length) {
        entry.barcode = shorts[0];
        entry.allBarcodes = shorts;
        console.log(`  ✓ ${key}: ${shorts.join(", ")}`);
      } else {
        console.log(`  ? ${key}: parça short barkodu yok (parcels=${parcels.length})`);
      }
    } catch (e) {
      console.log(`  ✗ ${key}: ${e.message}`);
    }
  }
  fs.writeFileSync(".tmp-e2e/test-data.json", JSON.stringify(data, null, 2));
  console.log("test-data.json güncellendi.");
})().catch((e) => { console.error(e); process.exit(1); });
