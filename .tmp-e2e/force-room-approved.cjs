const fs = require('fs')
const { execSync, spawnSync } = require('child_process')
const path = require('path')

const SERIAL = 'R6CW400BC8N'
const PKG = 'com.arasdigital.nesymobile.rstest'
const SQLITE =
  'C:\\Users\\Developer\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Google.PlatformTools_Microsoft.Winget.Source_8wekyb3d8bbwe\\platform-tools\\sqlite3.exe'
const dir = path.resolve('.tmp-e2e/force-db2')
fs.mkdirSync(dir, { recursive: true })

function adb(args, opts = {}) {
  const r = spawnSync('adb', ['-s', SERIAL, ...args], {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
    ...opts,
  })
  if (r.status !== 0) throw new Error(`adb ${args.join(' ')} failed: ${r.stderr || r.stdout}`)
  return r.stdout
}

// Stop app so WAL settles
adb(['shell', 'am', 'force-stop', PKG])

// Pull db + wal + shm via run-as to local
function pullDbFile(name) {
  const out = path.join(dir, name)
  const fd = fs.openSync(out, 'w')
  try {
    const r = spawnSync(
      'adb',
      ['-s', SERIAL, 'exec-out', 'run-as', PKG, 'cat', `databases/${name}`],
      { stdio: ['ignore', fd, 'pipe'], maxBuffer: 50 * 1024 * 1024 },
    )
    fs.closeSync(fd)
    if (r.status !== 0) {
      try {
        fs.unlinkSync(out)
      } catch {}
      return null
    }
    return out
  } catch (e) {
    try {
      fs.closeSync(fd)
    } catch {}
    throw e
  }
}

pullDbFile('aras_kurye')
pullDbFile('aras_kurye-wal')
pullDbFile('aras_kurye-shm')

const dbPath = path.join(dir, 'aras_kurye')
if (!fs.existsSync(dbPath) || fs.statSync(dbPath).size < 1000) {
  console.error('DB pull failed/size', fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0)
  process.exit(1)
}

// Checkpoint WAL into main
spawnSync(SQLITE, [dbPath, 'PRAGMA wal_checkpoint(TRUNCATE);'], { encoding: 'utf8' })

const schema = spawnSync(SQLITE, [dbPath, '.schema Schedule'], { encoding: 'utf8' }).stdout
console.log('schema', schema.slice(0, 800))

const cols = spawnSync(SQLITE, [dbPath, 'PRAGMA table_info(Schedule);'], { encoding: 'utf8' }).stdout
console.log('cols', cols)

const row = spawnSync(SQLITE, [dbPath, 'SELECT * FROM Schedule LIMIT 1;'], { encoding: 'utf8' }).stdout
console.log('row sample', row.slice(0, 500))

// Try common column names
const colNames = cols
  .split('\n')
  .map((l) => l.split('|')[1])
  .filter(Boolean)
console.log('colNames', colNames)

let updated = false
for (const candidate of ['scheduleStatus', 'schedule_status', 'status']) {
  if (colNames.includes(candidate)) {
    const sql = `UPDATE Schedule SET ${candidate}=2;`
    const r = spawnSync(SQLITE, [dbPath, sql], { encoding: 'utf8' })
    console.log('update', candidate, r.stdout, r.stderr)
    updated = true
  }
}

// Also patch JSON blobs that contain scheduleStatus
for (const c of colNames) {
  if (!/json|meta|payload|body|data/i.test(c)) continue
  const val = spawnSync(SQLITE, [dbPath, `SELECT ${c} FROM Schedule LIMIT 1;`], { encoding: 'utf8' })
    .stdout
  if (!val || !val.includes('scheduleStatus')) continue
  const patched = val.replace(/"scheduleStatus"\s*:\s*1/, '"scheduleStatus":2')
  if (patched === val) continue
  const tmp = path.join(dir, 'patch.json')
  fs.writeFileSync(tmp, patched.replace(/\r?\n$/, ''))
  // Use bind via sqlite - write escaped
  const escaped = patched.replace(/'/g, "''").replace(/\r?\n/g, '')
  const sql = `UPDATE Schedule SET ${c}='${escaped}';`
  const r = spawnSync(SQLITE, [dbPath, sql], { encoding: 'utf8' })
  console.log('patched json col', c, 'err', r.stderr)
  updated = true
}

if (!updated) {
  console.log('No direct status column update path found')
}

// Push DB back
adb(['push', dbPath, '/data/local/tmp/aras_kurye'])
adb([
  'shell',
  `run-as ${PKG} cp /data/local/tmp/aras_kurye databases/aras_kurye`,
])
// clear wal/shm on device
try {
  adb(['shell', `run-as ${PKG} rm databases/aras_kurye-wal`])
} catch {}
try {
  adb(['shell', `run-as ${PKG} rm databases/aras_kurye-shm`])
} catch {}

// prefs too
const prefs = adb([
  'exec-out',
  'run-as',
  PKG,
  'cat',
  'shared_prefs/com.arasdigital.nesymobile.rstest_preferences.xml',
])
fs.writeFileSync(
  path.join(dir, 'prefs.xml'),
  prefs.replace(/name="scheduleStatus" value="\d+"/, 'name="scheduleStatus" value="2"'),
)
adb(['push', path.join(dir, 'prefs.xml'), '/data/local/tmp/prefs.xml'])
adb([
  'shell',
  `run-as ${PKG} cp /data/local/tmp/prefs.xml shared_prefs/com.arasdigital.nesymobile.rstest_preferences.xml`,
])

adb(['shell', `monkey -p ${PKG} -c android.intent.category.LAUNCHER 1`])
console.log('done')
