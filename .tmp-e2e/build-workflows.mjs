#!/usr/bin/env node
/**
 * Faz 2 — Happy-path workflow'larını Cockpit API üzerinden oluşturur.
 *
 * Her workflow: POST /api/workflows  → POST /api/workflows/:id/versions
 * Kaydetmeden önce POST /api/workflows/yaml-preview ile derleme doğrulanır.
 *
 * İdempotent: aynı isimli workflow varsa yeni bir VERSION eklenir (yeni workflow
 * yaratılmaz). Barkod/shipmentId gibi çalışma-anı değerleri runInput ile
 * geçileceği için node config'lerinde {{barcode}} / {{shipmentId}} kullanılır.
 *
 * Kullanım:
 *   node .tmp-e2e/build-workflows.mjs            # doğrula + oluştur/güncelle
 *   node .tmp-e2e/build-workflows.mjs --dry-run  # sadece yaml-preview doğrulaması
 */

const API = process.env.COCKPIT_API ?? "http://localhost:4001/api";
const DRY_RUN = process.argv.includes("--dry-run");

// Sabitler (plan): PIN 3680, rota 36, RS/stage.
const COUNTRY = "RS";
const ENVIRONMENT = "stage";
const PIN = "3680";
// Rota etiketleri "36 *" gibi bir sonek taşıyor (* = schedule'lı rota). SELECT_ROUTE
// numarayı esnek eşliyor. 36 RS-stage'te açık ve PATH-NOTES'ta kurulu rota.
const ROUTE = "36";
const CATEGORY = "Happy Path";

// ─── Graph factory ───────────────────────────────────────────────────────────
let _seq = 0;
function nid(type) {
  _seq += 1;
  return `${type.toLowerCase()}_${_seq}`;
}
function node(type, config = {}, kind = "action") {
  return { id: nid(type), type, kind, position: { x: 0, y: 0 }, data: { title: type, config } };
}
function edge(source, target, sourceHandle = "default") {
  return {
    id: `${source.id}__${sourceHandle}__${target ? target.id : "end"}`,
    sourceNodeId: source.id,
    targetNodeId: target ? target.id : null,
    sourceHandle,
    targetHandle: target ? "top" : null,
  };
}
/** default-handle ile ardışık zincir. */
function chain(nodes) {
  const edges = [];
  for (let i = 0; i < nodes.length - 1; i++) edges.push(edge(nodes[i], nodes[i + 1]));
  return edges;
}
/** Node'lara okunur y konumu ver. */
function layout(nodes) {
  nodes.forEach((n, i) => (n.position = { x: 0, y: i * 160 }));
  return nodes;
}

const launch = (clearState = false) => node("LAUNCH_APP", { country: COUNTRY, environment: ENVIRONMENT, clearState });

// ─── Workflow tanımları ──────────────────────────────────────────────────────

function startFlow() {
  const nLaunch = launch(false);
  const nIfLogin = node("IF_LOGIN", {}, "condition");
  const nAuth = node("AUTH_LOGIN", { pinCode: PIN });
  const nCheckRoute = node("CHECK_ROUTE", {}, "condition");
  const nSelectRoute = node("SELECT_ROUTE", { routeNumber: ROUTE });
  const nValidate = node("VALIDATE_STOPLIST", {
    courierZoneCode: ROUTE,
    courierUsername: "G.ONCU",
  });

  const nodes = layout([nLaunch, nIfLogin, nAuth, nCheckRoute, nSelectRoute, nValidate]);
  const edges = [
    edge(nLaunch, nIfLogin),
    edge(nIfLogin, nCheckRoute, "true"), // zaten login → route kontrolüne
    edge(nIfLogin, nAuth, "false"), // login değil → PIN gir
    edge(nAuth, nCheckRoute), // sonra route kontrolü (convergence)
    edge(nCheckRoute, nValidate, "true"), // rota seçili → stop list doğrula
    edge(nCheckRoute, nSelectRoute, "false"), // rota yok → seç
    edge(nSelectRoute, nValidate),
  ];
  return { name: "00 · START FLOW", nodes, edges };
}

function loadTourFlow() {
  const nLaunch = launch(false);
  const nLoad = node("LOAD_TO_VEHICLE", { barcode: "{{barcode}}" });
  const nTour = node("REQUEST_TOUR_START", {});
  // Hub/zone cihazdan çözülür (hardcoded hubIds yok).
  const nApprove = node("TOUR_APPROVE", {});
  const nAssign = node("PICKUP_ASSIGN", { pickupDbIds: "{{pickupDbIds}}" });
  const nodes = layout([nLaunch, nLoad, nTour, nApprove, nAssign]);
  return { name: "01 · LOAD & TOUR FLOW", nodes, edges: chain(nodes) };
}

/**
 * Shipment-türü flow'u: LAUNCH(no-clear) → operasyon(verifyBackend).
 * Operasyon YAML'ı Stop List scan + options sheet girişini kendi içinde yapar
 * (PATH-NOTES); ayrı OPEN_SHIPMENT/OPEN_PARCEL gerekmez.
 */
function shipmentFlow({ name, opType, opConfig, codes, verifyDelayMs = 20000 }) {
  const nLaunch = launch(false);
  const nOp = node(opType, {
    barcode: "{{barcode}}",
    ...opConfig,
    verifyBackend: true,
    shipmentRef: "{{barcode}}",
    expectedEventCodes: codes,
    verifyDelayMs,
  });
  const nodes = layout([nLaunch, nOp]);
  return { name, nodes, edges: chain(nodes) };
}

function endOfDayFlow() {
  const nLaunch = launch(false);
  const nEod = node("END_OF_DAY", {}, "end");
  const nApprove = node("EOD_APPROVE", {});
  const nodes = layout([nLaunch, nEod, nApprove]);
  return { name: "99 · END OF DAY FLOW", nodes, edges: chain(nodes) };
}

// Event kodu referansı: DELY 40, PICK 44, DEPS 71, CODC 268, CODH 269, FDLY 131, NSYS 250.
const shipmentFlows = [
  shipmentFlow({ name: "10 · Standard Delivery", opType: "DELIVERY_OPERATION", opConfig: { personDelivered: "HappyPath Receiver" }, codes: [40] }),
  shipmentFlow({ name: "11 · COD / Cash Delivery", opType: "DELIVERY_OPERATION", opConfig: { codCash: true, personDelivered: "HappyPath Receiver" }, codes: [40, 269], verifyDelayMs: 35000 }),
  shipmentFlow({ name: "12 · Credit Card Delivery", opType: "DELIVERY_OPERATION", opConfig: { codCash: true, personDelivered: "HappyPath Receiver" }, codes: [40, 269], verifyDelayMs: 35000 }),
  shipmentFlow({ name: "13 · Multicolli Delivery", opType: "DELIVERY_OPERATION", opConfig: { personDelivered: "HappyPath Receiver" }, codes: [40] }),
  shipmentFlow({ name: "14 · DEPS", opType: "DEPS_OPERATION", opConfig: { personDelivered: "HappyPath Receiver" }, codes: [71] }),
  shipmentFlow({ name: "15 · D4ME / LOS", opType: "LOS_OPERATION", opConfig: {}, codes: [40] }),
  shipmentFlow({ name: "16 · Return Document (RDOC)", opType: "RDOC_OPERATION", opConfig: { rdocStatus: "Success", deliveryBarcode: "{{barcode}}", pickupBarcode: "{{pickupBarcode}}" }, codes: [44] }),
  shipmentFlow({ name: "17 · Delivery Failed", opType: "DELIVERY_FAIL_OPERATION", opConfig: { failReason: "15" }, codes: [131] }),
  shipmentFlow({ name: "18 · Pickup", opType: "PICKUP_OPERATION", opConfig: {}, codes: [44] }),
  shipmentFlow({ name: "19 · Remote Pickup", opType: "REMOTE_PICKUP_OPERATION", opConfig: {}, codes: [44] }),
  shipmentFlow({ name: "20 · Pickup At Customer (PAC)", opType: "PICKUP_AT_CUSTOMER_OPERATION", opConfig: {}, codes: [44] }),
  shipmentFlow({ name: "21 · Pickup Failed", opType: "PICKUP_FAIL_OPERATION", opConfig: { failReason: "43" }, codes: [250] }),
];

const ALL = [startFlow(), loadTourFlow(), ...shipmentFlows, endOfDayFlow()];
const ONLY = (() => {
  const idx = process.argv.indexOf("--only");
  return idx >= 0 ? String(process.argv[idx + 1] || "").trim() : "";
})();
const SELECTED = ONLY ? ALL.filter((w) => w.name.includes(ONLY)) : ALL;

// ─── API yardımcıları ────────────────────────────────────────────────────────
async function api(pathname, init) {
  const res = await fetch(`${API}${pathname}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok) {
    throw new Error(`${init?.method ?? "GET"} ${pathname} → HTTP ${res.status}: ${typeof json === "string" ? json : JSON.stringify(json)}`);
  }
  return json;
}

async function preview(wf) {
  const out = await api("/workflows/yaml-preview", {
    method: "POST",
    body: JSON.stringify({ nodes: wf.nodes, edges: wf.edges, config: {}, country: COUNTRY, environment: ENVIRONMENT }),
  });
  // Derleme hatası varsa 500 döner (yukarıda yakalanır). Yine de yaml boş mu bak.
  const yaml = out?.data?.yaml ?? "";
  if (!yaml || yaml.includes("UNSUPPORTED")) {
    const bad = [...yaml.matchAll(/NESY_STEP::UNSUPPORTED::([^:]+)::(\w+)/g)].map((m) => `${m[2]}(${m[1]})`);
    if (bad.length) throw new Error(`${wf.name}: desteklenmeyen node(lar): ${bad.join(", ")}`);
  }
  return yaml;
}

async function findWorkflowByName(name) {
  const list = await api(`/workflows?search=${encodeURIComponent(name)}`);
  const items = list?.data ?? [];
  return items.find((w) => w.name === name) ?? null;
}

async function upsert(wf) {
  const yaml = await preview(wf);
  const stepCount = (yaml.match(/NESY_STEP::START/g) ?? []).length;
  if (DRY_RUN) {
    console.log(`  ✓ [dry-run] ${wf.name} — derlendi (${stepCount} adım)`);
    return;
  }
  let existing = await findWorkflowByName(wf.name);
  let id;
  if (existing) {
    id = existing.id;
  } else {
    const created = await api("/workflows", { method: "POST", body: JSON.stringify({ name: wf.name, category: CATEGORY }) });
    id = created.data.id;
  }
  const version = await api(`/workflows/${id}/versions`, {
    method: "POST",
    body: JSON.stringify({ nodes: wf.nodes, edges: wf.edges, config: {}, changelog: "Faz 2 happy-path" }),
  });
  console.log(`  ✓ ${wf.name} — ${existing ? "yeni versiyon" : "oluşturuldu"} (id=${id}, v${version.data.version}, ${stepCount} adım)`);
}

// ─── Main ────────────────────────────────────────────────────────────────────
(async () => {
  if (ONLY && SELECTED.length === 0) {
    console.error(`--only ${ONLY}: eşleşen workflow yok`);
    process.exit(1);
  }
  console.log(
    `Faz 2 — ${SELECTED.length} workflow ${DRY_RUN ? "(dry-run)" : `→ ${API}`}${ONLY ? ` (only: ${ONLY})` : ""}\n`,
  );
  let ok = 0;
  for (const wf of SELECTED) {
    try {
      await upsert(wf);
      ok += 1;
    } catch (err) {
      console.error(`  ✗ ${wf.name}: ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(`\nBitti: ${ok}/${SELECTED.length} başarılı.`);
  if (ok < SELECTED.length) process.exit(1);
})();
