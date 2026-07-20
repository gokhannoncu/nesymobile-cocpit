const fs = require('fs')
const { execSync, spawnSync } = require('child_process')
const SERIAL = 'R6CW400BC8N'
const APP = 'com.arasdigital.nesymobile.rstest'
const barcodes = JSON.parse(fs.readFileSync('./.tmp-e2e/task-inventory.json', 'utf8'))
  .filter((r) => r.type === 'DELIVERY')
  .map((r) => r.items[0]?.legacy)
  .filter(Boolean)

const results = []

function dump(name) {
  try {
    execSync(`adb -s ${SERIAL} shell uiautomator dump /sdcard/uidump.xml`, { stdio: 'ignore' })
    execSync(`adb -s ${SERIAL} pull /sdcard/uidump.xml .tmp-e2e/${name}.xml`, { stdio: 'ignore' })
  } catch {}
  return fs.existsSync(`./.tmp-e2e/${name}.xml`)
    ? fs.readFileSync(`./.tmp-e2e/${name}.xml`, 'utf8')
    : ''
}

function has(xml, re) {
  return re.test(xml)
}

function back() {
  execSync(`adb -s ${SERIAL} shell input keyevent 4`)
}

function ensureStopList() {
  for (let i = 0; i < 5; i++) {
    const xml = dump('nav')
    if (has(xml, /text="Stop List"/) && has(xml, /manuel_input/)) return true
    if (has(xml, /text="Login"/)) {
      spawnSync('maestro', ['--device', SERIAL, 'test', '.tmp-e2e/login-3680.yaml'], {
        encoding: 'utf8',
      })
      continue
    }
    back()
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 800)
  }
  return false
}

function writeFlow(bc) {
  const yaml = `appId: ${APP}
---
- extendedWaitUntil:
    visible:
      id: "${APP}:id/manuel_input"
    timeout: 12000
- tapOn:
    id: "${APP}:id/manuel_input"
- extendedWaitUntil:
    visible:
      id: "${APP}:id/et_input_dialog_barcode_number"
    timeout: 5000
- tapOn:
    id: "${APP}:id/et_input_dialog_barcode_number"
- eraseText: 80
- inputText: "${bc}"
- tapOn:
    id: "${APP}:id/btn_ok"
- extendedWaitUntil:
    visible:
      id: "${APP}:id/btnDelivery"
    timeout: 12000
    optional: true
- runFlow:
    when:
      visible:
        id: "${APP}:id/btnDelivery"
    commands:
      - tapOn:
          id: "${APP}:id/btnDelivery"
- extendedWaitUntil:
    visible:
      id: "${APP}:id/tie_delivery_name"
    timeout: 20000
- tapOn:
    id: "${APP}:id/tie_delivery_name"
- inputText: "Test Receiver"
- pressKey: Enter
- hideKeyboard
- scrollUntilVisible:
    element:
      id: "${APP}:id/btn_deliver"
    direction: DOWN
    timeout: 15000
- swipe:
    start: "25%, 78%"
    end: "75%, 78%"
    duration: 500
- tapOn:
    id: "${APP}:id/btn_deliver"
- runFlow:
    when:
      visible:
        id: "${APP}:id/btnDely"
    commands:
      - tapOn:
          id: "${APP}:id/btnDely"
- runFlow:
    when:
      visible:
        id: "${APP}:id/btn_arasDg_positive_button"
    commands:
      - tapOn:
          id: "${APP}:id/btn_arasDg_positive_button"
- runFlow:
    when:
      visible:
        id: "${APP}:id/btn_arasDg_positive_button"
    commands:
      - tapOn:
          id: "${APP}:id/btn_arasDg_positive_button"
- extendedWaitUntil:
    visible: "Stop List"
    timeout: 40000
    optional: true
`
  const p = `.tmp-e2e/run-del-${bc}.yaml`
  fs.writeFileSync(p, yaml)
  return p
}

console.log('delivery barcodes', barcodes.length)

for (const bc of barcodes) {
  ensureStopList()
  const flow = writeFlow(bc)
  console.log('=== DELIVER', bc, '===')
  const r = spawnSync('maestro', ['--device', SERIAL, 'test', flow], {
    encoding: 'utf8',
    timeout: 180000,
  })
  const ok = r.status === 0
  console.log((r.stdout || '').slice(-500))
  if (!ok) console.log((r.stderr || '').slice(-300))
  results.push({ barcode: bc, ok, exit: r.status })
  // recover
  back()
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000)
}

fs.writeFileSync('./.tmp-e2e/delivery-results.json', JSON.stringify(results, null, 2))
console.log(JSON.stringify(results, null, 2))
