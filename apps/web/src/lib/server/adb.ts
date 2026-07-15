// ============================================================================
// Server-side ADB bridge
// ============================================================================
// Used by Next.js route handlers — lists connected devices via local machine's adb
// binary and collects live runtime snapshot from selected device.
// Only runs on the server (child_process).

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { homedir, tmpdir } from 'node:os'
import { existsSync } from 'node:fs'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type {
  ConnectedDevice,
  DeviceStatus,
} from '@/data/engineering/device-lab/device-lab-types'
import type { CellularInfo, DbTableInfo, OsInfo, RequestRow, WifiInfo } from '@/data/debug-view/types'
import type {
  LiveAppInfo,
  LiveBatteryInfo,
  LiveDatabaseSnapshot,
  LiveDatabaseTableData,
  LiveDeviceRuntime,
  LiveFirebaseSnapshot,
  LivePingSample,
} from '@/data/debug-view/live-types'

const execFileAsync = promisify(execFile)

/** NesyMobile package candidates — first found on device is used. */
const PACKAGE_CANDIDATES = [
  'com.arasdigital.nesymobile.test',
  'com.arasdigital.nesymobile',
]

/** Runtime permissions shown in Overview (same list as mock). */
const TRACKED_PERMISSIONS = [
  'ACCESS_FINE_LOCATION',
  'ACCESS_BACKGROUND_LOCATION',
  'CAMERA',
  'READ_CALL_LOG',
  'POST_NOTIFICATIONS',
  'RECORD_AUDIO',
  'FOREGROUND_SERVICE_LOCATION',
]

const PING_TARGET = '8.8.8.8'

// ---------------------------------------------------------------------------
// adb binary resolution + exec
// ---------------------------------------------------------------------------

let cachedAdbPath: string | null | undefined

export function resolveAdbPath(): string | null {
  if (cachedAdbPath !== undefined) return cachedAdbPath
  const candidates = [
    process.env.ADB_PATH,
    `${homedir()}/Library/Android/sdk/platform-tools/adb`,
    '/opt/homebrew/bin/adb',
    '/usr/local/bin/adb',
    '/usr/bin/adb',
  ].filter((p): p is string => Boolean(p))
  cachedAdbPath = candidates.find((p) => existsSync(p)) ?? null
  return cachedAdbPath
}

async function adb(args: string[], timeoutMs = 10_000): Promise<string> {
  const bin = resolveAdbPath()
  if (!bin) throw new Error('adb binary not found (can specify via ADB_PATH env)')
  const { stdout } = await execFileAsync(bin, args, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 })
  return stdout
}

/** Binary-safe adb execution, used when pulling SQLite files with exec-out. */
async function adbBuffer(args: string[], timeoutMs = 20_000): Promise<Buffer> {
  const bin = resolveAdbPath()
  if (!bin) throw new Error('adb binary not found (can specify via ADB_PATH env)')

  return new Promise((resolve, reject) => {
    execFile(
      bin,
      args,
      { timeout: timeoutMs, maxBuffer: 128 * 1024 * 1024, encoding: 'buffer' },
      (error, stdout, stderr) => {
        if (error) {
          const detail = Buffer.isBuffer(stderr) ? stderr.toString('utf8').trim() : String(stderr).trim()
          reject(new Error(detail || error.message))
          return
        }
        resolve(Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout))
      },
    )
  })
}

function shell(serial: string, cmd: string, timeoutMs = 10_000): Promise<string> {
  return adb(['-s', serial, 'shell', cmd], timeoutMs)
}

/** Safe shell returning null on error — for best-effort fields. */
async function tryShell(serial: string, cmd: string, timeoutMs = 10_000): Promise<string | null> {
  try {
    return await shell(serial, cmd, timeoutMs)
  } catch {
    return null
  }
}

const firstMatch = (text: string | null, re: RegExp): string | null => text?.match(re)?.[1] ?? null

const toNum = (v: string | null): number | null => {
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// ---------------------------------------------------------------------------
// Device list
// ---------------------------------------------------------------------------

interface RawDevice {
  serial: string
  state: string
  isUsb: boolean
}

function parseDevicesList(raw: string): RawDevice[] {
  return raw
    .split('\n')
    .slice(1)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('*'))
    .map((line) => {
      const [serial = '', state = ''] = line.split(/\s+/)
      return {
        serial,
        state,
        isUsb: /\busb:/.test(line) && !serial.includes(':'),
      }
    })
    .filter((d) => d.serial.length > 0 && d.state.length > 0)
}

function mapStatus(state: string, appInstalled: boolean): DeviceStatus {
  if (state === 'unauthorized') return 'unauthorized'
  if (state !== 'device') return 'offline'
  return appInstalled ? 'connected' : 'app-not-installed'
}

/** Finds NesyMobile package installed on device (null if not found). */
async function findNesyPackage(serial: string): Promise<string | null> {
  const out = await tryShell(serial, 'pm list packages com.arasdigital.nesymobile')
  if (!out) return null
  const installed = out
    .split('\n')
    .map((l) => l.trim().replace(/^package:/, ''))
    .filter(Boolean)
  return PACKAGE_CANDIDATES.find((p) => installed.includes(p)) ?? installed[0] ?? null
}

async function enrichDevice(rawDev: RawDevice): Promise<ConnectedDevice> {
  const { serial, state, isUsb } = rawDev
  const base: ConnectedDevice = {
    id: serial,
    name: serial,
    serial,
    isPhysical: !serial.startsWith('emulator-'),
    androidVersion: '?',
    apiLevel: 0,
    appInstalled: false,
    appVersion: null,
    isDebuggable: false,
    status: mapStatus(state, false),
    transport: isUsb ? 'usb' : 'wifi',
    buildType: null,
    configType: null,
    batteryLevel: 0,
    lastUsed: new Date().toISOString(),
    country: null,
  }
  if (state !== 'device') return base

  const [props, batteryOut, pkg] = await Promise.all([
    tryShell(
      serial,
      'getprop ro.product.manufacturer; getprop ro.product.model; getprop ro.build.version.release; getprop ro.build.version.sdk; getprop ro.kernel.qemu',
    ),
    tryShell(serial, 'dumpsys battery | grep -m1 level'),
    findNesyPackage(serial),
  ])

  const lines = (props ?? '').split('\n').map((l) => l.trim())
  const [manufacturer = '', model = '', release = '?', sdk = '0', qemu = '0'] = lines
  base.name = [capitalize(manufacturer), model].filter(Boolean).join(' ') || serial
  base.androidVersion = release
  base.apiLevel = toNum(sdk) ?? 0
  base.isPhysical = base.isPhysical && qemu !== '1'
  base.batteryLevel = toNum(firstMatch(batteryOut, /level:\s*(\d+)/)) ?? 0

  if (pkg) {
    const dump = await tryShell(serial, `dumpsys package ${pkg} | grep -E 'versionName|versionCode|flags='`)
    base.appInstalled = true
    base.appVersion = firstMatch(dump, /versionName=(\S+)/)
    base.isDebuggable = /\bDEBUGGABLE\b/.test(dump ?? '')
    base.buildType = base.isDebuggable ? 'debug' : pkg.endsWith('.test') ? 'internal' : 'release'
    base.status = 'connected'
  } else {
    base.status = 'app-not-installed'
  }
  return base
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

export async function listConnectedDevices(): Promise<ConnectedDevice[]> {
  const raw = await adb(['devices', '-l'])
  const rawDevices = parseDevicesList(raw)
  return Promise.all(rawDevices.map(enrichDevice))
}

// ---------------------------------------------------------------------------
// Runtime snapshot parts
// ---------------------------------------------------------------------------

function signalLevelFromRssi(rssi: number | null): WifiInfo['signalLevel'] {
  if (rssi == null) return 0
  if (rssi >= -55) return 4
  if (rssi >= -66) return 3
  if (rssi >= -77) return 2
  if (rssi >= -88) return 1
  return 0
}

const WIFI_SECURITY_LABELS: Record<string, string> = {
  '0': 'Open',
  '1': 'WEP',
  '2': 'WPA2-PSK',
  '3': 'WPA2-Enterprise',
  '4': 'WPA3-SAE',
  '5': 'WPA3-Enterprise 192-bit',
  '6': 'OWE',
  '9': 'WPA3-Enterprise',
}

async function readWifi(serial: string): Promise<WifiInfo> {
  const empty: WifiInfo = {
    connected: false,
    ssid: null,
    bssid: null,
    ipAddress: null,
    gateway: null,
    linkSpeedMbps: null,
    frequencyMhz: null,
    rssiDbm: null,
    signalLevel: 0,
    security: null,
  }
  const status = await tryShell(serial, 'cmd wifi status')
  if (!status || !/Wifi is connected/.test(status)) return empty

  const rssi = toNum(firstMatch(status, /RSSI:\s*(-?\d+)/))
  const securityCode = firstMatch(status, /Security type:\s*(\d+)/)
  const gatewayOut = await tryShell(
    serial,
    `ip route show table all | grep 'default via' | grep wlan0 | head -1`,
  )
  return {
    connected: true,
    ssid: firstMatch(status, /Wifi is connected to "([^"]*)"/),
    bssid: firstMatch(status, /BSSID:\s*([0-9a-f:]+)/i),
    ipAddress: firstMatch(status, /IP:\s*\/?([0-9.]+)/),
    gateway: firstMatch(gatewayOut, /default via ([0-9.]+)/),
    linkSpeedMbps: toNum(firstMatch(status, /(?<!Tx |Rx )Link speed:\s*(\d+)Mbps/)),
    frequencyMhz: toNum(firstMatch(status, /Frequency:\s*(\d+)MHz/)),
    rssiDbm: rssi,
    signalLevel: signalLevelFromRssi(rssi),
    security: securityCode ? (WIFI_SECURITY_LABELS[securityCode] ?? `Type ${securityCode}`) : null,
  }
}

function generationFromNetworkType(type: string | null): CellularInfo['generation'] {
  if (!type) return null
  if (/NR/i.test(type)) return '5G'
  if (/LTE|IWLAN/i.test(type)) return '4G/LTE'
  if (/UMTS|HSPA|HSDPA|HSUPA|WCDMA/i.test(type)) return '3G'
  if (/EDGE|GPRS|GSM|CDMA/i.test(type)) return '2G'
  return null
}

async function readCellular(serial: string): Promise<CellularInfo> {
  const [alpha, netType, roamingProp, registry] = await Promise.all([
    tryShell(serial, 'getprop gsm.operator.alpha'),
    tryShell(serial, 'getprop gsm.network.type'),
    tryShell(serial, 'getprop gsm.operator.isroaming'),
    tryShell(serial, `dumpsys telephony.registry | grep -E 'mDataConnectionState|rsrp=' | head -4`),
  ])
  const carrier = alpha?.split(',')[0]?.trim() || null
  // TelephonyManager.DATA_*: 0=disconnected 1=connecting 2=connected 3=suspended
  const dataStateCode = firstMatch(registry, /mDataConnectionState=(\d)/)
  const dataState: CellularInfo['dataState'] =
    dataStateCode === '2' ? 'connected' : dataStateCode === '3' ? 'suspended' : 'disconnected'
  return {
    connected: Boolean(carrier),
    carrier,
    generation: generationFromNetworkType(netType?.split(',')[0] ?? null),
    signalDbm: toNum(firstMatch(registry, /rsrp=(-\d+)/)),
    roaming: /true/.test(roamingProp ?? ''),
    dataState,
  }
}

async function measurePing(serial: string): Promise<LivePingSample> {
  const sample: LivePingSample = {
    latencyMs: null,
    jitterMs: null,
    packetLossPct: null,
    measuredAt: new Date().toISOString(),
    endpoint: `${PING_TARGET} (ICMP)`,
  }
  const out = await tryShell(serial, `ping -c 4 -W 2 ${PING_TARGET}`, 15_000)
  if (!out) return sample
  const loss = firstMatch(out, /(\d+(?:\.\d+)?)% packet loss/)
  const rtt = out.match(/rtt min\/avg\/max\/mdev = [\d.]+\/([\d.]+)\/[\d.]+\/([\d.]+)/)
  sample.packetLossPct = toNum(loss)
  sample.latencyMs = rtt ? Math.round(Number(rtt[1])) : null
  sample.jitterMs = rtt ? Math.round(Number(rtt[2]) * 10) / 10 : null
  return sample
}

function formatUptime(totalSeconds: number): string {
  const d = Math.floor(totalSeconds / 86_400)
  const h = Math.floor((totalSeconds % 86_400) / 3_600)
  const m = Math.floor((totalSeconds % 3_600) / 60)
  return d > 0 ? `${d}d ${h}h ${String(m).padStart(2, '0')}m` : `${h}h ${String(m).padStart(2, '0')}m`
}

async function readOs(serial: string): Promise<OsInfo> {
  const [props, kernel, uptimeOut, memOut, dfOut] = await Promise.all([
    tryShell(
      serial,
      [
        'ro.product.manufacturer',
        'ro.product.model',
        'ro.build.version.release',
        'ro.build.version.sdk',
        'ro.build.version.security_patch',
        'ro.build.fingerprint',
        'ro.product.cpu.abi',
        'persist.sys.locale',
        'persist.sys.timezone',
      ]
        .map((p) => `getprop ${p}`)
        .join('; '),
    ),
    tryShell(serial, 'uname -r'),
    tryShell(serial, 'cat /proc/uptime'),
    tryShell(serial, `grep -E 'MemTotal|MemAvailable' /proc/meminfo`),
    tryShell(serial, 'df -k /data | tail -1'),
  ])
  const lines = (props ?? '').split('\n').map((l) => l.trim())
  const [
    manufacturer = '?',
    model = '?',
    release = '?',
    sdk = '0',
    patch = '?',
    fingerprint = '?',
    abi = '?',
    locale = '?',
    timezone = '?',
  ] = lines

  const totalKb = toNum(firstMatch(memOut, /MemTotal:\s*(\d+)/)) ?? 0
  const availKb = toNum(firstMatch(memOut, /MemAvailable:\s*(\d+)/)) ?? 0
  const dfCols = (dfOut ?? '').trim().split(/\s+/)
  const storageTotalKb = toNum(dfCols[1] ?? null) ?? 0
  const storageFreeKb = toNum(dfCols[3] ?? null) ?? 0
  const uptimeSec = toNum((uptimeOut ?? '').trim().split(/\s+/)[0] ?? null) ?? 0

  return {
    manufacturer: capitalize(manufacturer),
    model,
    androidVersion: release,
    apiLevel: toNum(sdk) ?? 0,
    securityPatch: patch,
    buildFingerprint: fingerprint,
    kernelVersion: (kernel ?? '?').trim(),
    cpuAbi: abi,
    totalRamMb: Math.round(totalKb / 1024),
    availableRamMb: Math.round(availKb / 1024),
    storageTotalGb: Math.round(storageTotalKb / 1024 / 1024),
    storageFreeGb: Math.round((storageFreeKb / 1024 / 1024) * 10) / 10,
    uptime: formatUptime(uptimeSec),
    locale: locale.replace('-', '_'),
    timezone,
  }
}

async function readBattery(serial: string): Promise<LiveBatteryInfo> {
  const out = await tryShell(serial, 'dumpsys battery | head -20')
  const tempRaw = toNum(firstMatch(out, /temperature:\s*(\d+)/))
  return {
    level: toNum(firstMatch(out, /level:\s*(\d+)/)) ?? 0,
    // BatteryManager.BATTERY_STATUS_CHARGING=2, FULL=5 considered charging
    charging: ['2', '5'].includes(firstMatch(out, /status:\s*(\d+)/) ?? ''),
    temperatureC: tempRaw != null ? tempRaw / 10 : null,
    voltageMv: toNum(firstMatch(out, /voltage:\s*(\d+)/)),
    technology: firstMatch(out, /technology:\s*(\S+)/),
  }
}

/** "2026-07-15 16:39:56" (device local) → ISO string. */
function dumpsysDateToIso(v: string | null): string | null {
  if (!v) return null
  const parsed = new Date(v.replace(' ', 'T'))
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

async function readApp(serial: string, pkg: string | null): Promise<LiveAppInfo> {
  const empty: LiveAppInfo = {
    installed: false,
    packageName: null,
    versionName: null,
    versionCode: null,
    debuggable: false,
    firstInstall: null,
    lastUpdate: null,
    installer: null,
    processId: null,
    memoryUsageMb: null,
    foreground: null,
    batteryOptimized: null,
  }
  if (!pkg) return empty

  const [dump, pidOut, whitelist] = await Promise.all([
    tryShell(
      serial,
      `dumpsys package ${pkg} | grep -E 'versionName|versionCode|firstInstallTime|lastUpdateTime|installerPackageName|flags=' | head -10`,
    ),
    tryShell(serial, `pidof ${pkg}`),
    tryShell(serial, `dumpsys deviceidle whitelist | grep ${pkg}`),
  ])

  const pid = toNum((pidOut ?? '').trim().split(/\s+/)[0] || null)
  let memoryUsageMb: number | null = null
  let foreground: boolean | null = null
  if (pid) {
    const [memOut, oomOut] = await Promise.all([
      tryShell(serial, `dumpsys meminfo ${pkg} | grep 'TOTAL PSS' | head -1`, 15_000),
      tryShell(serial, `cat /proc/${pid}/oom_score_adj`),
    ])
    const pssKb = toNum(firstMatch(memOut, /TOTAL PSS:\s*(\d+)/))
    memoryUsageMb = pssKb != null ? Math.round(pssKb / 1024) : null
    const oom = toNum((oomOut ?? '').trim())
    foreground = oom != null ? oom <= 0 : null
  }

  const installerRaw = firstMatch(dump, /installerPackageName=(\S+)/)
  return {
    installed: true,
    packageName: pkg,
    versionName: firstMatch(dump, /versionName=(\S+)/),
    versionCode: toNum(firstMatch(dump, /versionCode=(\d+)/)),
    debuggable: /\bDEBUGGABLE\b/.test(dump ?? ''),
    firstInstall: dumpsysDateToIso(firstMatch(dump, /firstInstallTime=([\d-]+ [\d:]+)/)),
    lastUpdate: dumpsysDateToIso(firstMatch(dump, /lastUpdateTime=([\d-]+ [\d:]+)/)),
    installer: installerRaw === 'null' ? null : installerRaw,
    processId: pid,
    memoryUsageMb,
    foreground,
    // If not in deviceidle whitelist, Android applies battery optimization
    batteryOptimized: whitelist == null ? null : whitelist.trim().length === 0,
  }
}

async function readPermissions(
  serial: string,
  pkg: string | null,
): Promise<{ name: string; granted: boolean }[]> {
  if (!pkg) return []
  const out = await tryShell(
    serial,
    `dumpsys package ${pkg} | grep -E 'android.permission.(${TRACKED_PERMISSIONS.join('|')}): granted'`,
  )
  if (!out) return []
  const seen = new Map<string, boolean>()
  for (const m of out.matchAll(/android\.permission\.(\w+):\s*granted=(true|false)/g)) {
    const [, name, granted] = m
    if (!name) continue
    // Same permission may appear in multiple sections of dump — granted=true takes precedence
    seen.set(name, seen.get(name) === true || granted === 'true')
  }
  return TRACKED_PERMISSIONS.filter((p) => seen.has(p)).map((p) => ({
    name: p,
    granted: seen.get(p) ?? false,
  }))
}

/** Decodes XML entities (sufficient subset for shared_prefs content). */
function decodeXmlEntities(s: string): string {
  return s
    .replaceAll('&quot;', '"')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
}

async function readFirebase(
  serial: string,
  pkg: string | null,
  debuggable: boolean,
): Promise<LiveFirebaseSnapshot> {
  const empty: LiveFirebaseSnapshot = {
    available: false,
    reason: null,
    gmpAppId: null,
    appInstanceId: null,
    sessionId: null,
    fcmToken: null,
    fcmTokenStoredAt: null,
    analyticsCollectionEnabled: null,
    firebaseInstallationId: null,
    crashlyticsInstallationId: null,
  }
  if (!pkg) return { ...empty, reason: 'NesyMobile not installed on device' }
  if (!debuggable)
    return { ...empty, reason: 'Release build — cannot read shared_prefs via run-as' }

  const [measurement, appid, crashlytics] = await Promise.all([
    tryShell(serial, `run-as ${pkg} cat shared_prefs/com.google.android.gms.measurement.prefs.xml`),
    tryShell(serial, `run-as ${pkg} cat shared_prefs/com.google.android.gms.appid.xml`),
    tryShell(serial, `run-as ${pkg} cat shared_prefs/com.google.firebase.crashlytics.xml`),
  ])
  if (!measurement && !appid && !crashlytics)
    return { ...empty, reason: 'Could not read Firebase shared_prefs files' }

  const tokenJson = firstMatch(appid ?? '', /<string name="\|T\|[^"]*">([^<]+)<\/string>/)
  let fcmToken: string | null = null
  let fcmTokenStoredAt: string | null = null
  if (tokenJson) {
    try {
      const parsed = JSON.parse(decodeXmlEntities(tokenJson)) as { token?: string; timestamp?: number }
      fcmToken = parsed.token ?? null
      fcmTokenStoredAt = parsed.timestamp ? new Date(parsed.timestamp).toISOString() : null
    } catch {
      // token JSON is in unexpected format — fields remain null
    }
  }

  const deferred = firstMatch(
    measurement ?? '',
    /<boolean name="deferred_analytics_collection" value="(true|false)"/,
  )
  const sessionId = firstMatch(measurement ?? '', /<long name="session_id" value="(\d+)"/)

  return {
    available: true,
    reason: null,
    gmpAppId: firstMatch(measurement ?? '', /<string name="gmp_app_id">([^<]+)</),
    appInstanceId: firstMatch(measurement ?? '', /<string name="app_instance_id">([^<]+)</),
    sessionId,
    fcmToken,
    fcmTokenStoredAt,
    analyticsCollectionEnabled: deferred != null ? deferred === 'false' : null,
    firebaseInstallationId: firstMatch(crashlytics ?? '', /<string name="firebase.installation.id">([^<]+)</),
    crashlyticsInstallationId: firstMatch(
      crashlytics ?? '',
      /<string name="crashlytics.installation.id">([^<]+)</,
    ),
  }
}

// ---------------------------------------------------------------------------
// Runtime snapshot (root)
// ---------------------------------------------------------------------------

export async function getDeviceRuntime(serial: string): Promise<LiveDeviceRuntime> {
  const pkg = await findNesyPackage(serial)

  const [wifi, cellular, ping, os, battery, app, permissions] = await Promise.all([
    readWifi(serial),
    readCellular(serial),
    measurePing(serial),
    readOs(serial),
    readBattery(serial),
    readApp(serial, pkg),
    readPermissions(serial, pkg),
  ])
  const firebase = await readFirebase(serial, pkg, app.debuggable)

  return {
    serial,
    capturedAt: new Date().toISOString(),
    network: wifi.connected ? 'wifi' : cellular.dataState === 'connected' ? 'cellular' : 'offline',
    wifi,
    cellular,
    ping,
    os,
    battery,
    app,
    firebase,
    permissions,
  }
}

// ---------------------------------------------------------------------------
// Read-only Room database snapshot
// ---------------------------------------------------------------------------

interface DeviceDatabaseFile {
  name: string
  sizeBytes: number
}

interface SqliteTableRow {
  name: string
  primaryKey: string | null
}

interface SqliteCountRow {
  name: string
  rowCount: number
}

interface SqliteSizeRow {
  name: string
  sizeBytes: number
}

interface SqliteColumnRow {
  name: string
}

interface SqliteDetailedColumnRow {
  cid: number
  name: string
  type: string
  notNull: number
  defaultValue: string | null
  primaryKeyPosition: number
}

type RawRequestRow = Record<string, unknown>

const DATABASE_NAME_PREFERENCE = ['aras_kurye', 'nesy.db', 'nesy']

const DATABASE_TABLE_DESCRIPTIONS: Record<string, string> = {
  completedrequest: 'Successfully sent request archive',
  fiscalinvoicedata: 'Fiscal invoice payloads awaiting or completing processing',
  livelocation: 'Courier live-location samples',
  logininfo: 'Current authenticated courier/session details',
  manuelrouting: 'Locally stored manual routing data',
  notificationinfo: 'Notification records cached on device',
  originalshipmentitems: 'Original shipment item snapshots',
  parcel: 'Locally cached parcel records',
  request: 'Offline request queue waiting to be sent',
  schedule: 'Active schedule payload',
  schedulestopchunk: 'Chunked schedule/stop payloads',
}

let cachedSqlitePath: string | null | undefined

function resolveSqlitePath(): string | null {
  if (cachedSqlitePath !== undefined) return cachedSqlitePath
  const candidates = [
    process.env.SQLITE3_PATH,
    '/usr/bin/sqlite3',
    '/opt/homebrew/bin/sqlite3',
    '/usr/local/bin/sqlite3',
  ].filter((p): p is string => Boolean(p))
  cachedSqlitePath = candidates.find((p) => existsSync(p)) ?? null
  return cachedSqlitePath
}

async function sqlite(databasePath: string, sql: string, json = false): Promise<string> {
  const bin = resolveSqlitePath()
  if (!bin) throw new Error('sqlite3 binary not found (can specify via SQLITE3_PATH env)')
  const args = ['-batch', '-readonly']
  if (json) args.push('-json')
  args.push(databasePath, sql)
  const { stdout } = await execFileAsync(bin, args, {
    timeout: 20_000,
    maxBuffer: 32 * 1024 * 1024,
  })
  return stdout.trim()
}

async function sqliteWritable(databasePath: string, sql: string): Promise<string> {
  const bin = resolveSqlitePath()
  if (!bin) throw new Error('sqlite3 binary not found (can specify via SQLITE3_PATH env)')
  const { stdout } = await execFileAsync(bin, ['-batch', databasePath, sql], {
    timeout: 20_000,
    maxBuffer: 32 * 1024 * 1024,
  })
  return stdout.trim()
}

async function sqliteJson<T>(databasePath: string, sql: string): Promise<T[]> {
  const out = await sqlite(databasePath, sql, true)
  if (!out) return []
  return JSON.parse(out) as T[]
}

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

function quoteSqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`
}

function parseDatabaseListing(raw: string): DeviceDatabaseFile[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('-'))
    .flatMap((line) => {
      const parts = line.split(/\s+/)
      const name = parts.at(-1)
      const sizeBytes = Number(parts[4])
      return name && Number.isFinite(sizeBytes) ? [{ name, sizeBytes }] : []
    })
}

function selectMainDatabase(files: DeviceDatabaseFile[]): DeviceDatabaseFile | null {
  const candidates = files.filter(
    (file) =>
      !/-(?:wal|shm|journal)$/.test(file.name) &&
      !file.name.startsWith('com.google.') &&
      !file.name.startsWith('google_'),
  )
  if (candidates.length === 0) return null

  return candidates.sort((a, b) => {
    const aPreference = DATABASE_NAME_PREFERENCE.indexOf(a.name)
    const bPreference = DATABASE_NAME_PREFERENCE.indexOf(b.name)
    if (aPreference >= 0 || bPreference >= 0) {
      if (aPreference < 0) return 1
      if (bPreference < 0) return -1
      return aPreference - bPreference
    }
    return b.sizeBytes - a.sizeBytes
  })[0] ?? null
}

function tableDescription(name: string): string {
  return DATABASE_TABLE_DESCRIPTIONS[name.toLowerCase()] ?? 'Room database table'
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : value == null ? fallback : String(value)
}

function asNumber(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function asBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 'true'
}

function parseWaybillNumbers(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => asString(item)).filter(Boolean)
  const raw = asString(value).trim()
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as unknown
    if (Array.isArray(parsed)) return parsed.map((item) => asString(item)).filter(Boolean)
  } catch {
    // Older converters may store a comma-separated string instead of JSON.
  }
  return raw.split(',').map((item) => item.trim()).filter(Boolean)
}

function deriveRequestState(
  tryCount: number,
  isProcessing: boolean,
  isWaitingRequest: boolean,
): RequestRow['derivedState'] {
  if (tryCount >= 3) return 'dead'
  if (isProcessing) return 'in-flight'
  if (isWaitingRequest) return 'waiting'
  if (tryCount > 0) return 'retrying'
  return 'pending'
}

async function readRequestRows(
  databasePath: string,
  tableName: string | null,
): Promise<RequestRow[]> {
  if (!tableName) return []

  const columns = await sqliteJson<SqliteColumnRow>(
    databasePath,
    `SELECT name FROM pragma_table_info(${quoteSqlString(tableName)});`,
  )
  const byLowerName = new Map(columns.map((column) => [column.name.toLowerCase(), column.name]))
  const selectColumn = (name: string, fallback: string) => {
    const actual = byLowerName.get(name.toLowerCase())
    return `${actual ? quoteIdentifier(actual) : fallback} AS ${quoteIdentifier(name)}`
  }

  const select = [
    selectColumn('id', '0'),
    selectColumn('userName', "''"),
    selectColumn('requestName', "''"),
    selectColumn('requestJson', "'{}'"),
    selectColumn('timeStamp', "''"),
    selectColumn('tryCount', '0'),
    selectColumn('isProcessing', '0'),
    selectColumn('isWaitingRequest', '0'),
    selectColumn('createdAt', '0'),
    selectColumn('waybillNumbers', "'[]'"),
    selectColumn('sendWithoutWaiting', '0'),
    selectColumn('fiscalInvoiceId', 'NULL'),
    selectColumn('uniqueKey', "''"),
  ].join(', ')
  const idColumn = byLowerName.get('id')
  const orderBy = idColumn ? ` ORDER BY ${quoteIdentifier(idColumn)} DESC` : ''
  const rawRows = await sqliteJson<RawRequestRow>(
    databasePath,
    `SELECT ${select} FROM ${quoteIdentifier(tableName)}${orderBy} LIMIT 500;`,
  )

  return rawRows.map((raw) => {
    const tryCount = asNumber(raw.tryCount)
    const isProcessing = asBoolean(raw.isProcessing)
    const isWaitingRequest = asBoolean(raw.isWaitingRequest)
    const fiscalInvoiceId = raw.fiscalInvoiceId == null ? null : asString(raw.fiscalInvoiceId) || null
    return {
      id: asNumber(raw.id),
      userName: asString(raw.userName),
      requestName: asString(raw.requestName),
      requestJson: asString(raw.requestJson, '{}'),
      timeStamp: asString(raw.timeStamp),
      tryCount,
      isProcessing,
      isWaitingRequest,
      createdAt: asNumber(raw.createdAt),
      waybillNumbers: parseWaybillNumbers(raw.waybillNumbers),
      sendWithoutWaiting: asBoolean(raw.sendWithoutWaiting),
      fiscalInvoiceId,
      uniqueKey: asString(raw.uniqueKey),
      derivedState: deriveRequestState(tryCount, isProcessing, isWaitingRequest),
    }
  })
}

async function readTableData(
  databasePath: string,
  tableName: string,
  totalRows: number,
  limit: number,
): Promise<LiveDatabaseTableData> {
  const rawColumns = await sqliteJson<SqliteDetailedColumnRow>(
    databasePath,
    `SELECT cid,
      name,
      type,
      "notnull" AS "notNull",
      dflt_value AS "defaultValue",
      pk AS "primaryKeyPosition"
     FROM pragma_table_info(${quoteSqlString(tableName)})
     ORDER BY cid;`,
  )
  const columns = rawColumns.map((column) => ({
    cid: Number(column.cid),
    name: column.name,
    type: column.type || 'ANY',
    notNull: Boolean(column.notNull),
    defaultValue: column.defaultValue,
    primaryKeyPosition: Number(column.primaryKeyPosition),
  }))

  // Keep arbitrary binary and very large JSON/text fields safe for the JSON API.
  const select = columns
    .map((column) => {
      const identifier = quoteIdentifier(column.name)
      return `CASE
        WHEN typeof(${identifier}) = 'blob'
          THEN '[BLOB ' || length(${identifier}) || ' bytes] ' || substr(hex(${identifier}), 1, 128)
        WHEN typeof(${identifier}) = 'text' AND length(${identifier}) > 20000
          THEN substr(${identifier}, 1, 20000) || char(10) || '... [truncated, ' || length(${identifier}) || ' chars total]'
        ELSE ${identifier}
      END AS ${identifier}`
    })
    .join(', ')
  const idColumn = columns.find((column) => column.name.toLowerCase() === 'id')
  const primaryKeyColumns = columns
    .filter((column) => column.primaryKeyPosition > 0)
    .sort((a, b) => a.primaryKeyPosition - b.primaryKeyPosition)
  const orderColumn = idColumn ?? primaryKeyColumns[0]
  const orderBy = orderColumn ? ` ORDER BY ${quoteIdentifier(orderColumn.name)} DESC` : ''
  const rows = select
    ? await sqliteJson<Record<string, string | number | null>>(
        databasePath,
        `SELECT ${select} FROM ${quoteIdentifier(tableName)}${orderBy} LIMIT ${limit};`,
      )
    : []

  return {
    tableName,
    columns,
    rows,
    totalRows,
    limit,
    truncated: totalRows > rows.length,
  }
}

async function inspectDatabase(
  databasePath: string,
  requestedTable: string | null,
  rowLimit: number,
): Promise<{
  version: number
  journalMode: string
  tables: DbTableInfo[]
  requestRows: RequestRow[]
  completedRequestCount: number
  tableData: LiveDatabaseTableData | null
}> {
  const tableRows = await sqliteJson<SqliteTableRow>(
    databasePath,
    `SELECT m.name AS name,
      COALESCE(group_concat(CASE WHEN p.pk > 0 THEN p.name END, ', '), '') AS primaryKey
     FROM sqlite_schema AS m
     LEFT JOIN pragma_table_info(m.name) AS p ON true
     WHERE m.type = 'table'
       AND m.name NOT LIKE 'sqlite_%'
       AND m.name NOT IN ('android_metadata', 'room_master_table')
     GROUP BY m.name
     ORDER BY m.name;`,
  )

  const countSql = tableRows
    .map(
      (table) =>
        `SELECT ${quoteSqlString(table.name)} AS name, COUNT(*) AS rowCount FROM ${quoteIdentifier(table.name)}`,
    )
    .join(' UNION ALL ')
  const countRows = countSql ? await sqliteJson<SqliteCountRow>(databasePath, `${countSql};`) : []
  let sizeRows: SqliteSizeRow[] = []
  try {
    sizeRows = await sqliteJson<SqliteSizeRow>(
      databasePath,
      'SELECT name, SUM(pgsize) AS sizeBytes FROM dbstat GROUP BY name;',
    )
  } catch {
    // dbstat is optional; row data remains usable when the local sqlite lacks it.
  }

  const countByName = new Map(countRows.map((row) => [row.name, Number(row.rowCount)]))
  const sizeByName = new Map(sizeRows.map((row) => [row.name, Number(row.sizeBytes)]))
  const tables: DbTableInfo[] = tableRows.map((table) => ({
    name: table.name,
    rowCount: countByName.get(table.name) ?? 0,
    sizeKb: Math.ceil((sizeByName.get(table.name) ?? 0) / 1024),
    description: tableDescription(table.name),
    primaryKey: table.primaryKey || '-',
  }))

  const requestTable = tableRows.find((table) => table.name.toLowerCase() === 'request')?.name ?? null
  const completedRequestCount =
    tables.find((table) => table.name.toLowerCase() === 'completedrequest')?.rowCount ?? 0
  const versionRaw = await sqlite(databasePath, 'PRAGMA user_version;')
  const journalMode = await sqlite(databasePath, 'PRAGMA journal_mode;')
  const requestRows = await readRequestRows(databasePath, requestTable)
  const selectedTable = (requestedTable
    ? tables.find((table) => table.name.toLowerCase() === requestedTable.toLowerCase())
    : undefined)
    ?? tables.find((table) => table.name.toLowerCase() === 'schedule')
    ?? tables.find((table) => table.name.toLowerCase() === 'request')
    ?? tables[0]
  const tableData = selectedTable
    ? await readTableData(databasePath, selectedTable.name, selectedTable.rowCount, rowLimit)
    : null

  return {
    version: Number(versionRaw) || 0,
    journalMode: journalMode.toUpperCase() || 'UNKNOWN',
    tables,
    requestRows,
    completedRequestCount,
    tableData,
  }
}

/** Pulls and inspects the selected device's primary Room DB without modifying it. */
export async function getDeviceDatabaseSnapshot(
  serial: string,
  requestedTable: string | null = null,
  rowLimit = 100,
): Promise<LiveDatabaseSnapshot> {
  const pkg = await findNesyPackage(serial)
  if (!pkg) throw new Error('NesyMobile is not installed on the selected device')

  const runAsRoot = await tryShell(serial, `run-as ${pkg} pwd`)
  if (!runAsRoot) {
    throw new Error(
      `Cannot access ${pkg} with adb run-as. Install a debuggable build or use an in-app database export.`,
    )
  }

  // Stopping the app makes the DB, WAL and SHM files a consistent point-in-time copy.
  await shell(serial, `am force-stop ${pkg}`)

  const listing = await tryShell(serial, `run-as ${pkg} ls -ln databases`)
  if (!listing) throw new Error(`Could not list the ${pkg} databases directory via adb run-as`)
  const files = parseDatabaseListing(listing)
  const mainDatabase = selectMainDatabase(files)
  if (!mainDatabase) throw new Error('No NesyMobile Room database file was found on the selected device')

  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'nesy-adb-db-'))
  const localDatabasePath = join(temporaryDirectory, 'database.sqlite')
  let mainBytes = Buffer.alloc(0)
  let walBytes = Buffer.alloc(0)
  let shmBytes = Buffer.alloc(0)
  try {
    mainBytes = await adbBuffer([
      '-s',
      serial,
      'exec-out',
      'run-as',
      pkg,
      'cat',
      `databases/${mainDatabase.name}`,
    ])
    await writeFile(localDatabasePath, mainBytes, { mode: 0o600 })

    const walName = `${mainDatabase.name}-wal`
    if (files.some((file) => file.name === walName)) {
      walBytes = await adbBuffer([
        '-s',
        serial,
        'exec-out',
        'run-as',
        pkg,
        'cat',
        `databases/${walName}`,
      ])
      await writeFile(`${localDatabasePath}-wal`, walBytes, { mode: 0o600 })
    }

    const shmName = `${mainDatabase.name}-shm`
    if (files.some((file) => file.name === shmName)) {
      shmBytes = await adbBuffer([
        '-s',
        serial,
        'exec-out',
        'run-as',
        pkg,
        'cat',
        `databases/${shmName}`,
      ])
      await writeFile(`${localDatabasePath}-shm`, shmBytes, { mode: 0o600 })
    }

    // Merge the copied WAL into the temporary main file. This mutates only the
    // host-side snapshot; the database on the Android device remains untouched.
    await sqliteWritable(localDatabasePath, 'PRAGMA wal_checkpoint(TRUNCATE);')

    const inspected = await inspectDatabase(localDatabasePath, requestedTable, rowLimit)
    const rootPath = runAsRoot.trim().split('\n')[0] || `/data/user/0/${pkg}`
    return {
      serial,
      packageName: pkg,
      capturedAt: new Date().toISOString(),
      databaseName: mainDatabase.name,
      databasePath: `${rootPath}/databases/${mainDatabase.name}`,
      version: inspected.version,
      journalMode: inspected.journalMode,
      sizeBytes: mainBytes.length,
      walSizeBytes: walBytes.length,
      shmSizeBytes: shmBytes.length,
      tables: inspected.tables,
      tableData: inspected.tableData,
      requestRows: inspected.requestRows,
      completedRequestCount: inspected.completedRequestCount,
    }
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
}
