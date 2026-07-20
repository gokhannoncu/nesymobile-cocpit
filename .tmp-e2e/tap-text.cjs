const fs = require('fs')
const { execSync } = require('child_process')
const SERIAL = 'R6CW400BC8N'
const label = process.argv[2]
if (!label) {
  console.error('usage: node tap-text.cjs LABEL')
  process.exit(1)
}

try {
  execSync(`adb -s ${SERIAL} shell uiautomator dump /sdcard/uidump.xml`, { stdio: 'ignore' })
  execSync(`adb -s ${SERIAL} pull /sdcard/uidump.xml .tmp-e2e/uidump-ops.xml`, { stdio: 'ignore' })
} catch {}

const xml = fs.readFileSync('./.tmp-e2e/uidump-ops.xml', 'utf8')
let target = null
for (const n of xml.matchAll(/<node [^>]+>/g)) {
  const s = n[0]
  const text = (s.match(/text="([^"]*)"/) || [])[1] || ''
  const b = (s.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/) || []).slice(1).map(Number)
  if (text === label && b.length === 4) {
    target = { x: Math.round((b[0] + b[2]) / 2), y: Math.round((b[1] + b[3]) / 2), text }
    break
  }
}
console.log(JSON.stringify(target))
if (!target) process.exit(2)
execSync(`adb -s ${SERIAL} shell input tap ${target.x} ${target.y}`)
