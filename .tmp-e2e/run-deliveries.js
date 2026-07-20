const fs = require('fs');
const { execSync } = require('child_process');
const tpl = fs.readFileSync('.tmp-e2e/deliver-v3.yaml', 'utf8');
const pending = JSON.parse(fs.readFileSync('.tmp-e2e/pending-deliveries.json', 'utf8'));
const results = [];

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
function sh(cmd, opts = {}) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts });
}
function snap() {
  sh('curl.exe -s -m 60 "http://127.0.0.1:4002/api/adb/schedule?serial=R6CW400BC8N" -o .tmp-e2e/sched-loop.json');
  const s = JSON.parse(fs.readFileSync('.tmp-e2e/sched-loop.json', 'utf8')).schedule;
  const map = {};
  for (const stop of s.stops) {
    for (const t of stop.taskList || []) {
      for (const sh of t.shipmentList || []) {
        for (const it of sh.shipmentItemList || []) {
          if (it.legacySystemShortBarcode) {
            map[it.legacySystemShortBarcode] = {
              stop: stop.stopOrder,
              type: t.taskType,
              taskStatus: t.taskStatus,
              itemStatus: it.shipmentItemStatus,
              doc: !!sh.isDocumentCollection,
            };
          }
        }
      }
    }
  }
  return map;
}
function dump() {
  try {
    sh('adb -s R6CW400BC8N shell uiautomator dump /sdcard/uidump.xml');
    sh('adb -s R6CW400BC8N pull /sdcard/uidump.xml .tmp-e2e/uidump-cur.xml');
    return fs.readFileSync('.tmp-e2e/uidump-cur.xml', 'utf8');
  } catch {
    return '';
  }
}
function recover() {
  let raw = dump();
  for (let i = 0; i < 6; i++) {
    if (raw.includes('Stop List') && raw.includes('manuel_input')) return;
    if (raw.includes('PRINT') || raw.includes('tvInvoiceSummary')) {
      sh('adb -s R6CW400BC8N shell input keyevent KEYCODE_BACK');
      sleep(800);
      raw = dump();
      continue;
    }
    if (raw.includes('rv_notifications')) {
      // restart app to escape sticky notification screen
      sh('adb -s R6CW400BC8N shell am force-stop com.arasdigital.nesymobile.rstest');
      sleep(1500);
      sh('adb -s R6CW400BC8N shell am start -n com.arasdigital.nesymobile.rstest/com.arasdigital.nesymobile.SplashActivity');
      sleep(6000);
      raw = dump();
      continue;
    }
    if (raw.includes('btn_arasDg_positive_button') || raw.includes('Write barcode')) {
      sh('adb -s R6CW400BC8N shell input keyevent KEYCODE_BACK');
      sleep(800);
      raw = dump();
      continue;
    }
    sh('adb -s R6CW400BC8N shell input keyevent KEYCODE_BACK');
    sleep(800);
    raw = dump();
  }
}

for (const code of pending) {
  recover();
  const before = snap()[code];
  if (before && before.taskStatus !== 1) {
    console.log('SKIP', code, before);
    results.push({ code, skipped: true, before, after: before, ok: true });
    continue;
  }
  const path = '.tmp-e2e/d-run-' + code.slice(-4) + '.yaml';
  fs.writeFileSync(path, tpl.replace(/SCANCODE/g, code));
  console.log('===== RUN', code, 'doc=', before && before.doc, '=====');
  try {
    sh('adb -s R6CW400BC8N forward --remove-all');
  } catch {}
  let exit = 1;
  let out = '';
  try {
    out = sh('maestro --device R6CW400BC8N test ' + path, { timeout: 180000 });
    exit = 0;
  } catch (e) {
    exit = e.status || 1;
    out = (e.stdout || '') + (e.stderr || '');
  }
  console.log(out.split(/\r?\n/).slice(-12).join('\n'));
  console.log('EXIT', exit);
  recover();
  const after = snap()[code];
  console.log('AFTER', after);
  results.push({ code, exit, before, after, ok: !!(after && after.taskStatus !== 1) });
}
fs.writeFileSync('.tmp-e2e/delivery-results-partial.json', JSON.stringify(results, null, 2));
console.log('SUMMARY', results);
