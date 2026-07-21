#!/usr/bin/env node
/**
 * Manual zimmet probe: START → scan one barcode → dump UI + recent logcat.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";

const DEVICE = "R6CW400BC8N";
const APP = "com.arasdigital.nesymobile.rstest";
const API = "http://localhost:4001/api";
const barcode = JSON.parse(fs.readFileSync(".tmp-e2e/test-data.json", "utf8"))["11-cod-cash"].barcode;

const sh = (cmd) => {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    return String(e.stdout || e.stderr || e.message || "");
  }
};

async function j(path, init) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  return res.json();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log("barcode", barcode);
sh(`adb -s ${DEVICE} logcat -c`);
sh(`adb -s ${DEVICE} shell am force-stop ${APP}`);
sh(`adb -s ${DEVICE} shell am start -n ${APP}/com.arasdigital.nesymobile.SplashActivity`);
await sleep(4000);

const list = await j("/workflows?search=" + encodeURIComponent("00 · START"));
const wf = list.data.find((w) => w.name.includes("00 · START"));
const started = await j(`/workflows/${wf.id}/run`, {
  method: "POST",
  body: JSON.stringify({ selectedDeviceId: DEVICE, country: "RS", environment: "stage" }),
});
const runId = started.data.runId;
for (let i = 0; i < 36; i++) {
  await sleep(5000);
  const s = await j(`/workflows/runs/${runId}/status`);
  if (!["running", "pending", "queued"].includes(s.runStatus)) {
    console.log("START", s.runStatus);
    break;
  }
}

// Write probe yaml
const yaml = `appId: ${APP}
---
- runFlow:
    when:
      visible:
        id: ${APP}:id/rv_notifications
    commands:
      - tapOn:
          id: ${APP}:id/btn_exit
- extendedWaitUntil:
    visible:
      id: ${APP}:id/manuel_input
    timeout: 20000
- tapOn:
    id: ${APP}:id/manuel_input
- tapOn:
    id: ${APP}:id/et_input_dialog_barcode_number
- eraseText: 40
- inputText: "${barcode}"
- tapOn:
    id: ${APP}:id/btn_ok
- extendedWaitUntil:
    visible:
      id: nesy_probe_never
    timeout: 8000
    optional: true
`;
fs.writeFileSync(".tmp-e2e/probe-load.yaml", yaml);
console.log(sh(`maestro --device ${DEVICE} test .tmp-e2e/probe-load.yaml`));
sh(`adb -s ${DEVICE} shell uiautomator dump /sdcard/ud.xml`);
sh(`adb -s ${DEVICE} pull /sdcard/ud.xml .tmp-e2e/ud-load-probe.xml`);
console.log(sh("node .tmp-e2e/parse-ud.mjs .tmp-e2e/ud-load-probe.xml"));

const log = sh(`adb -s ${DEVICE} logcat -d -t 200`);
const interesting = log
  .split("\n")
  .filter((l) =>
    /SCAN|FETCH_SHIPMENT|CREATE_TASK|Barcode|zimmet|Load|GENERIC|ERROR|ArasDialog|Time Range|hub|HUB/i.test(l),
  )
  .slice(-80);
fs.writeFileSync(".tmp-e2e/load-probe-logcat.txt", interesting.join("\n"));
console.log("logcat hits", interesting.length);
console.log(interesting.slice(-40).join("\n"));
