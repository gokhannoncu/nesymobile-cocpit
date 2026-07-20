#!/usr/bin/env node
/**
 * Faz 3 · Test verisi — her happy-path workflow için shipment/pickup üretir,
 * teslim shipment'larını hub'a unload eder, barkodları toplar.
 *
 * Kanıtlanmış reçete (.tmp-e2e/create-pac-dely.mjs): RS customer 1000 (CASH),
 * /nesy/auth/login → token, /customers/details → parties, /shipments/create,
 * /shipments/:dbId/unload. Mobil tarama kuralı (PATH-NOTES): legacySystemShortBarcode.
 *
 * Çıktı: .tmp-e2e/test-data.json  → { <workflowKey>: { barcode, shipmentId, dbId, ... } }
 *
 * Kullanım: node .tmp-e2e/create-test-shipments.mjs
 */
import fs from "node:fs";
const API = process.env.COCKPIT_API ?? "http://localhost:4001/api";
const COUNTRY = "RS";
const ENV = "stage";
const CUSTOMER_ID = "1000";
const CUSTOMER_CENTER = "1";

async function post(path, body) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(`${path} ${res.status}: ${json.message ?? json.error ?? JSON.stringify(json).slice(0, 300)}`);
  }
  return json;
}

const pickAddress = (d) => {
  const list = Array.isArray(d.addresses) ? d.addresses : [];
  return list.find((a) => a.addressType === 0) ?? list[0];
};

function buildShipper(details, addr) {
  const phone = details.phone || addr.phone || "4607-000";
  return {
    mode: "existing",
    address: {
      addressType: addr.addressType ?? 0,
      name: addr.name || details.name,
      street: addr.street,
      city: addr.city,
      zipCode: addr.zipCode,
      countryCode: addr.countryCode || addr.country || "RS",
      houseNumber: addr.houseNumber ?? null,
      doorNumber: addr.doorNumber ?? null,
      addressText: addr.addressText,
      latitude: addr.latitude,
      longitude: addr.longitude,
    },
    contact: {
      name: details.name,
      phone,
      gsm: details.gsm || phone,
      email: details.email ?? null,
      customerId: details.customerId,
      customerCenter: String(details.hubId ?? CUSTOMER_CENTER),
    },
  };
}

const buildConsignee = () => ({
  mode: "newaddress",
  isInternational: false,
  saveAddress: false,
  address: {
    addressType: 0,
    name: "HappyPath Consignee",
    street: "TERAZIJE",
    city: "BEOGRAD",
    zipCode: "11000",
    countryCode: "RS",
    houseNumber: "1",
    latitude: 44.8125,
    longitude: 20.4612,
  },
  contact: {
    name: "HappyPath Consignee",
    phone: "067000099",
    gsm: "067000099",
    email: "happypath@test.nesy.local",
  },
});

function buildParties(details, shipper, consignee) {
  const payer = pickAddress(details);
  return {
    customer: {
      customerId: details.customerId,
      customerCenter: String(details.hubId ?? CUSTOMER_CENTER),
      name: details.name,
      phone: details.phone || "4607-000",
      gsm: details.gsm || details.phone || "4607-000",
      email: details.email ?? null,
      customerPreferences: details.customerPreferences,
      customerAlphanumericId: details.customerAlphanumericId ?? null,
      payerAddress: {
        addressType: payer.addressType ?? 0,
        name: payer.name,
        street: payer.street,
        city: payer.city,
        zipCode: payer.zipCode,
        countryCode: payer.countryCode || payer.country || "RS",
        houseNumber: payer.houseNumber ?? null,
        doorNumber: payer.doorNumber ?? null,
        addressText: payer.addressText,
      },
    },
    shipper,
    consignee,
  };
}

function extractParcels(data) {
  const parcels = data?.parcels ?? data?.Parcels ?? [];
  return parcels
    .map((p) => ({
      barcode: p.barcode ?? p.Barcode,
      legacy: p.legacySystemBarcode ?? p.LegacySystemBarcode,
      // Zimmet/scan barkodu bu alanda gelir (16 haneli, "688005..."); shortBarcode
      // genelde null olduğu için doğrudan legacySystemShortBarcode kullanılmalı.
      short: p.legacySystemShortBarcode ?? p.LegacySystemShortBarcode ?? p.shortBarcode ?? p.ShortBarcode,
      seq: p.sequenceNumber ?? p.SequenceNumber,
    }))
    .filter((p) => p.barcode);
}

const legacyShortOf = (p) => p.short || (typeof p.legacy === "string" && p.legacy.match(/688005\d{10}/)?.[0]) || null;

// Teslim shipment'ları — hepsi bir mağaza (customer 1000) → BEOGRAD teslim.
const DELIVERY_SPECS = [
  { key: "10-standard", label: "Standard Delivery", shipmentType: "standard", parcelCount: 1 },
  { key: "11-cod-cash", label: "COD / Cash", shipmentType: "cod", parcelCount: 1, codAmount: 10, codCurrency: "EUR" },
  { key: "12-cc", label: "Credit Card", shipmentType: "cod", parcelCount: 1, codAmount: 15, codCurrency: "EUR" },
  { key: "13-multicolli", label: "Multicolli (3)", shipmentType: "standard", parcelCount: 3 },
  { key: "14-deps", label: "DEPS", shipmentType: "standard", parcelCount: 1 },
  { key: "17-delivery-failed", label: "Delivery Failed", shipmentType: "standard", parcelCount: 1 },
];

// Pickup shipment'ları — /pickups/create (assign hub 11 workaround PATH-NOTES'ta; burada best-effort).
const PICKUP_SPECS = [
  { key: "18-pickup", label: "Pickup", pickupType: "remote", shipmentCount: 1 },
  { key: "19-remote-pickup", label: "Remote Pickup", pickupType: "remote", shipmentCount: 1 },
  { key: "21-pickup-failed", label: "Pickup Failed", pickupType: "remote", shipmentCount: 1 },
];

(async () => {
  const login = await post("/nesy/auth/login", { country: COUNTRY, environment: ENV });
  const token = login.result?.payload?.token;
  if (!token) throw new Error("No admin token from /nesy/auth/login");

  const detailsRes = await post("/customers/details", {
    token, country: COUNTRY, environment: ENV, customerId: CUSTOMER_ID, customerCenter: CUSTOMER_CENTER,
  });
  const details = detailsRes.data;
  const addr = pickAddress(details);
  if (!addr) throw new Error("No customer address for 1000");
  const parties = buildParties(details, buildShipper(details, addr), buildConsignee());

  const out = {};

  // ── Deliveries: create + unload ──
  for (const spec of DELIVERY_SPECS) {
    try {
      const body = { token, country: COUNTRY, environment: ENV, parcelCount: spec.parcelCount, shipmentType: spec.shipmentType, parties };
      if (spec.shipmentType === "cod") {
        body.codAmount = spec.codAmount; body.codCurrency = spec.codCurrency; body.iban = ""; body.bicSwift = "";
      }
      const created = await post("/shipments/create", body);
      const record = created.data;
      const shipmentId = record.data?.shipmentId ?? record.data?.ShipmentId;
      const parcels = extractParcels(record.data);
      if (!shipmentId || parcels.length === 0) throw new Error("missing shipmentId/parcels");

      for (let j = 0; j < parcels.length; j++) {
        await post(`/shipments/${record.id}/unload`, {
          token, country: COUNTRY, environment: ENV, barcode: parcels[j].barcode, isLastParcel: j === parcels.length - 1, weight: "5",
        });
      }
      const primary = parcels[0];
      out[spec.key] = {
        label: spec.label,
        route: "delivery",
        dbId: record.id,
        shipmentId,
        barcode: legacyShortOf(primary) || primary.barcode,
        fullBarcode: primary.barcode,
        allBarcodes: parcels.map((p) => legacyShortOf(p) || p.barcode),
        parcelCount: parcels.length,
      };
      console.log(`  ✓ ${spec.label} → ${out[spec.key].barcode} (shipmentId=${shipmentId}, ${parcels.length} parça)`);
    } catch (err) {
      console.error(`  ✗ ${spec.label}: ${err instanceof Error ? err.message : err}`);
      out[spec.key] = { label: spec.label, route: "delivery", error: String(err instanceof Error ? err.message : err) };
    }
  }

  // ── Pickups: create (assign RS hub-100 blocker — best-effort) ──
  const bffCustomer = {
    customerId: details.customerId,
    customerCenter: String(details.hubId ?? CUSTOMER_CENTER),
    name: details.name,
    phone: details.phone || "4607-000",
    gsm: details.gsm || details.phone || "4607-000",
    email: details.email ?? null,
    address: {
      addressType: addr.addressType ?? 0,
      name: addr.name || details.name,
      street: addr.street,
      city: addr.city,
      zipCode: addr.zipCode,
      countryCode: addr.countryCode || addr.country || "RS",
      houseNumber: addr.houseNumber ?? null,
    },
  };
  for (const spec of PICKUP_SPECS) {
    try {
      const created = await post("/pickups/create", {
        token, country: COUNTRY, environment: ENV, pickupType: spec.pickupType, shipmentCount: spec.shipmentCount, happyPathOrigin: true, customer: bffCustomer,
      });
      const record = created.data;
      const shipmentId = record.data?.shipmentId ?? record.data?.ShipmentId ?? record.data?.waybillNumber;
      const parcels = extractParcels(record.data);
      const primary = parcels[0];
      out[spec.key] = {
        label: spec.label,
        route: "pickup",
        dbId: record.id,
        shipmentId,
        barcode: primary ? legacyShortOf(primary) || primary.barcode : null,
        fullBarcode: primary?.barcode ?? null,
        note: "Assign uses hubId 100 (RS blocker per PATH-NOTES) — may need hub-11 workaround before it appears on device.",
      };
      console.log(`  ✓ ${spec.label} → ${out[spec.key].barcode ?? "(no barcode)"} (shipmentId=${shipmentId})`);
    } catch (err) {
      console.error(`  ✗ ${spec.label}: ${err instanceof Error ? err.message : err}`);
      out[spec.key] = { label: spec.label, route: "pickup", error: String(err instanceof Error ? err.message : err) };
    }
  }

  fs.writeFileSync(".tmp-e2e/test-data.json", JSON.stringify(out, null, 2));
  const okCount = Object.values(out).filter((v) => !v.error).length;
  console.log(`\nBitti: ${okCount}/${Object.keys(out).length} → .tmp-e2e/test-data.json`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
