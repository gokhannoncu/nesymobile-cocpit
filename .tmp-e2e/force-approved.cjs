const fs = require('fs')
const { execSync } = require('child_process')

function sh(cmd) {
  return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

// 1) Pull prefs and set scheduleStatus=2
const prefs = sh(
  'adb -s R6CW400BC8N exec-out run-as com.arasdigital.nesymobile.rstest cat shared_prefs/com.arasdigital.nesymobile.rstest_preferences.xml',
)
const before = (prefs.match(/name="scheduleStatus" value="(\d+)"/) || [])[1]
const edited = prefs.replace(/name="scheduleStatus" value="\d+"/, 'name="scheduleStatus" value="2"')
fs.writeFileSync('./.tmp-e2e/prefs-edit.xml', edited)
console.log('prefs', before, '-> 2')

execSync('adb -s R6CW400BC8N push .tmp-e2e/prefs-edit.xml /data/local/tmp/prefs-edit.xml')
sh(
  'adb -s R6CW400BC8N shell run-as com.arasdigital.nesymobile.rstest cp /data/local/tmp/prefs-edit.xml shared_prefs/com.arasdigital.nesymobile.rstest_preferences.xml',
)

// 2) Pull Room DB, update schedule status in JSON if present
const tmp = './.tmp-e2e/force-db'
fs.mkdirSync(tmp, { recursive: true })
try {
  sh(
    'adb -s R6CW400BC8N exec-out run-as com.arasdigital.nesymobile.rstest cat databases/aras_kurye > .tmp-e2e/force-db/aras_kurye',
  )
} catch {}

// Prefer sqlite3 if available
const sqlite =
  'C:\\\\Users\\\\Developer\\\\AppData\\\\Local\\\\Microsoft\\\\WinGet\\\\Packages\\\\Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe\\\\platform-tools\\\\sqlite3.exe'
try {
  // checkpoint via device copy using cockpit method is heavy; try direct query first
  const tables = sh(`"${sqlite}" .tmp-e2e/force-db/aras_kurye ".tables"`)
  console.log('tables', tables.trim())
} catch (e) {
  console.log('sqlite open failed (likely WAL):', String(e.message || e).slice(0, 200))
}

// 3) Restart app
sh('adb -s R6CW400BC8N shell am force-stop com.arasdigital.nesymobile.rstest')
sh(
  'adb -s R6CW400BC8N shell monkey -p com.arasdigital.nesymobile.rstest -c android.intent.category.LAUNCHER 1',
)

setTimeout(() => {
  const after = sh(
    'adb -s R6CW400BC8N exec-out run-as com.arasdigital.nesymobile.rstest cat shared_prefs/com.arasdigital.nesymobile.rstest_preferences.xml',
  )
  const st = (after.match(/name="scheduleStatus" value="(\d+)"/) || [])[1]
  console.log('prefs after relaunch', st)
}, 5000)
