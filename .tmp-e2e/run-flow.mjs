#!/usr/bin/env node
/**
 * Bir workflow'u isimle tetikle + runInput geç + bitene kadar poll et.
 * Hata olursa ilgili adımın Maestro çıktısını yazdır.
 *
 * Kullanım:
 *   node .tmp-e2e/run-flow.mjs "<isim parçası>" '<runInput json>'
 *   node .tmp-e2e/run-flow.mjs "10 · Standard" '{"barcode":"688005100026721"}'
 */
const API = process.env.COCKPIT_API ?? "http://localhost:4001/api";
const DEVICE = process.env.DEVICE_ID ?? "R6CW400BC8N";
const COUNTRY = "RS";
const ENV = "stage";
const [, , namePart, runInputRaw] = process.argv;
const runInput = runInputRaw ? JSON.parse(runInputRaw) : undefined;

async function j(path, init) {
  const res = await fetch(`${API}${path}`, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
  const t = await res.text();
  return t ? JSON.parse(t) : null;
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const list = await j(`/workflows?search=${encodeURIComponent(namePart)}`);
  const wf = (list?.data ?? []).find((w) => w.name.includes(namePart)) ?? (list?.data ?? [])[0];
  if (!wf) throw new Error(`workflow bulunamadı: ${namePart}`);
  console.log(`▶ ${wf.name} (id=${wf.id}) runInput=${JSON.stringify(runInput ?? {})}`);

  const body = { selectedDeviceId: DEVICE, country: COUNTRY, environment: ENV, ...(runInput ? { runInput } : {}) };
  const started = await j(`/workflows/${wf.id}/run`, { method: "POST", body: JSON.stringify(body) });
  const runId = started?.data?.runId;
  if (!runId) throw new Error(`run başlatılamadı: ${JSON.stringify(started)}`);

  let last = null;
  for (let i = 0; i < 60; i++) {
    await sleep(5000);
    const s = await j(`/workflows/runs/${runId}/status`);
    last = s;
    if (!["running", "pending", "queued"].includes(s.runStatus)) break;
    process.stdout.write(".");
  }
  console.log(`\n${wf.name} → ${last.runStatus}`);
  for (const st of last.steps) {
    console.log("   ", st.nodeType.padEnd(22), st.status, st.errorMessage ? "- " + st.errorMessage.slice(0, 140) : "");
  }

  if (last.runStatus !== "success") {
    const detail = await j(`/workflows/${wf.id}/runs/${runId}`);
    const out = detail?.data?.maestroOutput ?? "";
    const failStep = last.steps.find((s) => s.status === "failed");
    const lines = out.split("\n");
    let idx = -1;
    if (failStep) idx = lines.findIndex((l) => l.includes(failStep.nodeType) || l.includes("FAILED"));
    console.log("\n--- Maestro tail ---");
    console.log(lines.slice(Math.max(0, (idx < 0 ? lines.length - 20 : idx - 2))).join("\n").slice(0, 1600));
    process.exitCode = 2;
  }
  console.log(`RUNID=${runId}`);
})().catch((e) => { console.error(e); process.exit(1); });
