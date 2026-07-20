const { execSync } = require('child_process');
const fs = require('fs');
const SERIAL = 'R6CW400BC8N';
const APP = 'com.arasdigital.nesymobile.rstest';
const DUMP = '.tmp-e2e/uidump-cur.xml';

function sh(cmd, timeout = 60000) {
  return execSync(cmd, { encoding: 'utf8', timeout, stdio: ['ignore', 'pipe', 'pipe'] });
}
function adb(args, timeout = 30000) {
  return sh(`adb -s ${SERIAL} ${args}`, timeout);
}
function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}
function dump() {
  try { adb('shell uiautomator dump /sdcard/uidump.xml'); } catch {}
  try { adb(`pull /sdcard/uidump.xml ${DUMP}`); } catch {}
  return fs.existsSync(DUMP) ? fs.readFileSync(DUMP, 'utf8') : '';
}
function texts(raw) {
  return [...raw.matchAll(/text="([^"]{1,120})"/g)].map((m) => m[1]);
}
function findBounds(raw, resourceId) {
  const esc = resourceId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let m = raw.match(new RegExp(`resource-id="${esc}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`));
  if (!m) m = raw.match(new RegExp(`bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"[^>]*resource-id="${esc}"`));
  if (!m) return null;
  return { cx: Math.floor((+m[1] + +m[3]) / 2), cy: Math.floor((+m[2] + +m[4]) / 2) };
}
function findTextBounds(raw, text) {
  const esc = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let m = raw.match(new RegExp(`text="${esc}"[^>]*bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"`));
  if (!m) m = raw.match(new RegExp(`bounds="\\[(\\d+),(\\d+)\\]\\[(\\d+),(\\d+)\\]"[^>]*text="${esc}"`));
  if (!m) return null;
  return { cx: Math.floor((+m[1] + +m[3]) / 2), cy: Math.floor((+m[2] + +m[4]) / 2) };
}
function tap(x, y) { adb(`shell input tap ${x} ${y}`); }
function tapId(raw, id) {
  const b = findBounds(raw, id);
  if (!b) return false;
  console.log('tap', id, b.cx, b.cy);
  tap(b.cx, b.cy);
  return true;
}
function tapText(raw, text) {
  const b = findTextBounds(raw, text);
  if (!b) return false;
  console.log('tapText', text, b.cx, b.cy);
  tap(b.cx, b.cy);
  return true;
}
function recover() {
  let raw = dump();
  for (let i = 0; i < 8; i++) {
    if (raw.includes('Stop List') && raw.includes(`${APP}:id/manuel_input`)) return raw;
    if (raw.includes('PRINT') || raw.includes('tvInvoiceSummary')) {
      adb('shell input keyevent KEYCODE_BACK');
      sleep(800);
      raw = dump();
      continue;
    }
    if (raw.includes('rv_notifications')) {
      adb(`shell am force-stop ${APP}`);
      sleep(1500);
      adb(`shell am start -n ${APP}/com.arasdigital.nesymobile.SplashActivity`);
      sleep(7000);
      raw = dump();
      continue;
    }
    adb('shell input keyevent KEYCODE_BACK');
    sleep(700);
    raw = dump();
  }
  if (!(raw.includes('Stop List') && raw.includes('manuel_input'))) {
    adb(`shell am force-stop ${APP}`);
    sleep(1500);
    adb(`shell am start -n ${APP}/com.arasdigital.nesymobile.SplashActivity`);
    sleep(7000);
    raw = dump();
  }
  return raw;
}
function snapMap() {
  sh(`curl.exe -s -m 60 "http://127.0.0.1:4002/api/adb/schedule?serial=${SERIAL}" -o .tmp-e2e/sched-loop.json`);
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
              waybill: sh.waybillNumber,
            };
          }
        }
      }
    }
  }
  return map;
}

function deliver(code) {
  console.log('==== DELIVER', code, '====');
  let raw = recover();
  if (!tapId(raw, `${APP}:id/manuel_input`)) throw new Error('no manuel');
  sleep(1500);
  raw = dump();
  // if dialog not open, retry
  if (!raw.includes('et_input_dialog_barcode_number')) {
    tapId(raw, `${APP}:id/manuel_input`);
    sleep(1500);
    raw = dump();
  }
  if (!tapId(raw, `${APP}:id/et_input_dialog_barcode_number`)) throw new Error('no field');
  sleep(400);
  // clear + type via adb (use KEYCODE)
  for (let i = 0; i < 30; i++) adb('shell input keyevent 67'); // DEL
  // input text char by char more reliable? use input text
  adb(`shell input text ${code}`);
  sleep(500);
  // tap title to dismiss keyboard then OK
  tap(540, 420);
  sleep(400);
  raw = dump();
  if (!tapId(raw, `${APP}:id/btn_ok`)) {
    if (!tapText(raw, 'OK')) adb('shell input keyevent 66');
  }
  sleep(2000);
  raw = dump();
  console.log('postScan', texts(raw).slice(0, 15));

  // handle attention / options repeatedly
  for (let i = 0; i < 5; i++) {
    if (raw.includes('btn_arasDg_positive_button')) {
      tapId(raw, `${APP}:id/btn_arasDg_positive_button`);
      sleep(1200);
      raw = dump();
      continue;
    }
    if (raw.includes('btnDelivery')) {
      tapId(raw, `${APP}:id/btnDelivery`);
      sleep(1500);
      raw = dump();
      continue;
    }
    break;
  }

  if (!raw.includes('tie_delivery_name')) {
    sleep(3000);
    raw = dump();
    if (raw.includes('btn_arasDg_positive_button')) {
      tapId(raw, `${APP}:id/btn_arasDg_positive_button`);
      sleep(1200);
      raw = dump();
    }
    if (raw.includes('btnDelivery')) {
      tapId(raw, `${APP}:id/btnDelivery`);
      sleep(1500);
      raw = dump();
    }
  }

  if (!raw.includes('tie_delivery_name')) {
    console.log('FAIL no form', texts(raw).slice(0, 25));
    return { ok: false, reason: 'no_form', texts: texts(raw).slice(0, 30) };
  }

  tapId(raw, `${APP}:id/tie_delivery_name`);
  sleep(300);
  for (let i = 0; i < 25; i++) adb('shell input keyevent 67');
  adb('shell input text TestReceiver');
  adb('shell input keyevent 66');
  sleep(500);
  adb('shell input keyevent KEYCODE_BACK'); // hide kb
  sleep(400);

  // scroll + signature
  adb('shell input swipe 540 1900 540 700 350');
  sleep(350);
  adb('shell input swipe 540 1900 540 700 350');
  sleep(350);
  adb('shell input swipe 180 1850 900 1850 650');
  sleep(300);
  adb('shell input swipe 220 1750 860 1750 500');
  sleep(400);
  raw = dump();

  if (!tapId(raw, `${APP}:id/btn_deliver`)) {
    // maybe need more scroll
    adb('shell input swipe 540 1900 540 600 350');
    sleep(400);
    raw = dump();
    if (!tapId(raw, `${APP}:id/btn_deliver`)) {
      console.log('FAIL no btn_deliver', texts(raw).slice(0, 30));
      console.log(
        'ids',
        [...raw.matchAll(/resource-id="([^"]+)"/g)].map((m) => m[1]).filter((x) => /btn|sign|deliver|photo|document/i.test(x))
      );
      return { ok: false, reason: 'no_btn_deliver', texts: texts(raw).slice(0, 30) };
    }
  }

  sleep(1500);
  raw = dump();
  for (let i = 0; i < 8; i++) {
    if (raw.includes('btnDely') && tapId(raw, `${APP}:id/btnDely`)) {
      sleep(1000);
      raw = dump();
      continue;
    }
    if ((raw.includes('>Cash<') || texts(raw).includes('Cash')) && (tapText(raw, 'Cash') || tapText(raw, 'CASH'))) {
      sleep(1200);
      raw = dump();
      continue;
    }
    if (raw.includes('btn_arasDg_positive_button') && tapId(raw, `${APP}:id/btn_arasDg_positive_button`)) {
      sleep(1000);
      raw = dump();
      continue;
    }
    if (raw.includes('PRINT') || raw.includes('tvInvoiceSummary')) {
      adb('shell input keyevent KEYCODE_BACK');
      sleep(1000);
      raw = dump();
      continue;
    }
    if (raw.includes('Stop List')) break;
    if (raw.includes('btnDelivery') && !raw.includes('tie_delivery_name')) {
      adb('shell input keyevent KEYCODE_BACK');
      sleep(800);
      raw = dump();
      continue;
    }
    break;
  }

  recover();
  const after = snapMap()[code];
  const ok = after && after.taskStatus !== 1;
  console.log('AFTER', after, 'ok', ok);
  return { ok, after, texts: texts(raw).slice(0, 20) };
}

const codes = process.argv.slice(2);
const results = [];
for (const code of codes) {
  const before = snapMap()[code];
  if (before && before.taskStatus !== 1) {
    results.push({ code, skipped: true, ok: true, before });
    continue;
  }
  try {
    const r = deliver(code);
    results.push({ code, ...r, before });
  } catch (e) {
    console.log('ERR', e.message);
    results.push({ code, ok: false, error: e.message, before });
    recover();
  }
}
fs.writeFileSync('.tmp-e2e/delivery-adb-results.json', JSON.stringify(results, null, 2));
console.log('SUMMARY', results.map((r) => ({ code: r.code, ok: r.ok, reason: r.reason, st: r.after && r.after.taskStatus })));
process.exit(results.every((r) => r.ok) ? 0 : 1);
