const fs = require('fs')
const { execSync } = require('child_process')
const SERIAL = 'R6CW400BC8N'

execSync(`adb -s ${SERIAL} shell uiautomator dump /sdcard/uidump.xml`)
execSync(`adb -s ${SERIAL} pull /sdcard/uidump.xml .tmp-e2e/uidump-ops.xml`)
const xml = fs.readFileSync('./.tmp-e2e/uidump-ops.xml', 'utf8')

function find(label) {
  for (const n of xml.matchAll(/<node [^>]+>/g)) {
    const s = n[0]
    const text = (s.match(/text="([^"]*)"/) || [])[1] || ''
    const b = (s.match(/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/) || []).slice(1).map(Number)
    if (text === label && b.length === 4) {
      return { x: Math.round((b[0] + b[2]) / 2), y: Math.round((b[1] + b[3]) / 2), text }
    }
  }
  return null
}

const target = find('DELIVERY')
console.log('target', target)
if (!target) process.exit(2)
execSync(`adb -s ${SERIAL} shell input tap ${target.x} ${target.y}`)
console.log('tapped')
