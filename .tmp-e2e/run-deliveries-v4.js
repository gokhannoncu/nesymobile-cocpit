const fs = require('fs');
const { execSync } = require('child_process');
const SERIAL = 'R6CW400BC8N';
const APP = 'com.arasdigital.nesymobile.rstest';
const tpl = fs.readFileSync('.tmp-e2e/deliver-v4.yaml', 'utf8');
const pending = JSON.parse(fs.readFileSync('.tmp-e2e/pending-deliveries.json', 'utf8'));
const results = [];

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
function sh(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
}
function dump() {
  try {
    sh(`adb -s ${SERIAL} shell uiautomator dump /sdcard/uidump.xml`);
    sh(`adb -s ${SERIAL} pull /sdcard/uidump.xml .tmp-e2e/uidump-cur.xml`);
    return fs.readFileSync('.tmp-e2e/uidump-cur.xml', 'utf8');
  } catch {
    return '';
  }
}
function snap() {
  sh(`curl.exe -s -m 60 "http://127.0.0.1:4002/api/adb/schedule?serial=${SERIAL}" -o .tmp-e2e/sched-loop.json`);
  const s = JSON.parse(fs.readFileSync('.tmp-e2e/sched-loop.json', 'utf8')).schedule;
  const map = {};
  for (const stop of s.stops || []) {
    for (const t of stop.taskList || []) {
      for (const ship of t.shipmentList || []) {
        for (const it of ship.shipmentItemList || []) {
          if (it.legacySystemShortBarcode) {
            map[it.legacySystemShortBarcode] = {
              stop: stop.stopOrder,
              type: t.taskType,
              taskStatus: t.taskStatus,
              itemStatus: it.shipmentItemStatus,
              party: t.taskParty,
            };
          }
        }
      }
    }
  }
  return map;
}
function hardRecover() {
  let raw = dump();
  for (let i = 0; i < 8; i++) {
    if (raw.includes('manuel_input') && raw.includes('Stop List')) return true;
    if (raw.includes('et_pin') || raw.includes('Login') || raw.includes('tv_login')) {
      try {
        sh(`adb -s ${SERIAL} forward --remove-all`);
      } catch {}
      try {
        sh(`maestro --device ${SERIAL} test .tmp-e2e/login-3680.yaml`, { timeout: 120000 });
      } catch {}
      sleep(2000);
      raw = dump();
      continue;
    }
    sh(`adb -s ${SERIAL} shell input keyevent KEYCODE_BACK`);
    sleep(700);
    raw = dump();
  }
  // relaunch app
  sh(`adb -s ${SERIAL} shell am force-stop ${APP}`);
  sleep(1200);
  sh(`adb -s ${SERIAL} shell am start -n ${APP}/com.arasdigital.nesymobile.SplashActivity`);
  sleep(7000);
  raw = dump();
  if (raw.includes('et_pin') || raw.includes('Login') || !raw.includes('manuel_input')) {
    try {
      sh(`adb -s ${SERIAL} forward --remove-all`);
    } catch {}
    try {
      sh(`maestro --device ${SERIAL} test .tmp-e2e/login-3680.yaml`, { timeout: 120000 });
    } catch {}
    sleep(2000);
  }
  return dump().includes('manuel_input');
}

for (const code of pending) {
  hardRecover();
  const before = snap()[code];
  if (before && before.taskStatus !== 1) {
    console.log('SKIP', code, before);
    results.push({ code, skipped: true, before, after: before, ok: true });
    continue;
  }
  let ok = false;
  let lastExit = 1;
  let lastOut = '';
  for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
    hardRecover();
    const path = `.tmp-e2e/d4-${code.slice(-4)}-a${attempt}.yaml`;
    fs.writeFileSync(path, tpl.replace(/SCANCODE/g, code));
    console.log(`===== RUN ${code} attempt ${attempt} =====`);
    try {
      sh(`adb -s ${SERIAL} forward --remove-all`);
    } catch {}
    try {
      lastOut = sh(`maestro --device ${SERIAL} test ${path}`, { timeout: 200000 });
      lastExit = 0;
    } catch (e) {
      lastExit = e.status || 1;
      lastOut = (e.stdout || '') + (e.stderr || '');
    }
    console.log(lastOut.split(/\r?\n/).slice(-10).join('\n'));
    console.log('EXIT', lastExit);
    hardRecover();
    const after = snap()[code];
    console.log('AFTER', after);
    ok = !!(after && after.taskStatus !== 1);
    if (ok) results.push({ code, exit: lastExit, attempt, before, after, ok: true });
  }
  if (!ok) results.push({ code, exit: lastExit, before, after: snap()[code], ok: false });
}
fs.writeFileSync('.tmp-e2e/delivery-results-v4.json', JSON.stringify(results, null, 2));
console.log('SUMMARY', JSON.stringify(results, null, 2));
