// ============================================================================
// Server-side ADB bridge
// ============================================================================
// Used by Next.js route handlers — lists connected devices via local machine's adb
// binary and collects live runtime snapshot from selected device.
// Only runs on the server (child_process).

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { tmpdir } from 'node:os'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { resolveAdbPath, resolveSqlitePath } from '@/lib/server/adb-path'
import type {
  ConnectedDevice,
  DeviceStatus,
} from '@/data/engineering/device-lab/device-lab-types'
import type { CellularInfo, DbTableInfo, OsInfo, RequestRow, WifiInfo } from '@/data/debug-view/types'
import type {
  HealthCard,
  HealthVerdict,
  LiveAppInfo,
  LiveBatteryInfo,
  LiveDatabaseSnapshot,
  LiveDatabaseTableData,
  LiveDeviceRuntime,
  LiveFirebaseSnapshot,
  LiveFragmentNode,
  LivePingSample,
  LiveScheduleSnapshot,
  LiveScreenState,
  LiveScreenField,
  FragmentLifecycle,
  OperationalHealthSnapshot,
} from '@/data/debug-view/live-types'
import { parseDeviceSchedule } from '@/lib/server/schedule-parser'

const execFileAsync = promisify(execFile)

/** NesyMobile package candidates — first found on device is used. */
const PACKAGE_CANDIDATES = [
  'com.arasdigital.nesymobile.test',
  'com.arasdigital.nesymobile.rstest',
  'com.arasdigital.nesymobile.sitest',
  'com.arasdigital.nesymobile.batest',
  'com.arasdigital.nesymobile.metest',
  'com.arasdigital.nesymobile.aztest',
  'com.arasdigital.nesymobile.bgtest',
  'com.arasdigital.nesymobiledev',
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

export { resolveAdbPath } from '@/lib/server/adb-path'

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

/**
 * Resolves the installed NesyMobile package and its numeric Linux uid, used by
 * the logcat parser to classify `app` events by uid so the stream survives an
 * app restart (the pid changes, the uid does not).
 */
export async function getAppIdentity(
  serial: string,
): Promise<{ packageName: string | null; uid: number | null }> {
  const out = await tryShell(serial, 'pm list packages -U com.arasdigital.nesymobile')
  if (!out) return { packageName: null, uid: null }
  // Lines look like: "package:com.arasdigital.nesymobile.test uid:10723"
  const byPackage = new Map<string, number | null>()
  for (const line of out.split('\n')) {
    const m = line.match(/package:(\S+)\s+uid:(\d+)/)
    if (m?.[1]) byPackage.set(m[1], m[2] ? Number(m[2]) : null)
  }
  const packageName =
    PACKAGE_CANDIDATES.find((p) => byPackage.has(p)) ?? [...byPackage.keys()][0] ?? null
  return { packageName, uid: packageName ? byPackage.get(packageName) ?? null : null }
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
  // A transient ADB read failure used to become 0%, which looked like a real
  // critical battery condition. Retry once, then preserve "unmeasured" as null.
  let out = await tryShell(serial, 'dumpsys battery | head -20')
  if (!out) out = await tryShell(serial, 'dumpsys battery | head -20')
  const tempRaw = toNum(firstMatch(out, /temperature:\s*(\d+)/))
  return {
    level: toNum(firstMatch(out, /level:\s*(\d+)/)),
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
    firebaseInstallationId: firstMatch(
      crashlytics ?? '',
      /<string name="firebase.installation.id">([^<]+)</,
    ),
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

async function sqlite(databasePath: string, sql: string, json = false): Promise<string> {
  const bin = resolveSqlitePath()
  if (!bin) throw new Error('sqlite3 binary not found (can specify via SQLITE3_PATH env)')
  const args = ['-batch', '-readonly']
  if (json) args.push('-json')
  args.push(databasePath, sql)
  const { stdout } = await execFileAsync(bin, args, {
    timeout: 20_000,
    maxBuffer: 128 * 1024 * 1024,
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

interface DeviceDatabaseCopy<T> {
  serial: string
  packageName: string
  capturedAt: string
  databaseName: string
  databasePath: string
  sizeBytes: number
  walSizeBytes: number
  shmSizeBytes: number
  value: T
}

/**
 * Runs an inspector against one host-side copy of the device DB.
 *
 * The helper can force-stop the app when a caller explicitly requests a strict
 * point-in-time copy. Current Database, Schedule and Readiness endpoints pass
 * `forceStop: false`: the main/WAL/SHM files are pulled together and the WAL is
 * merged into the host copy while the app stays running, with a small risk of a
 * rare mid-write skew.
 */
async function withDeviceDatabaseCopy<T>(
  serial: string,
  inspect: (databasePath: string) => Promise<T>,
  { forceStop = false }: { forceStop?: boolean } = {},
): Promise<DeviceDatabaseCopy<T>> {
  const pkg = await findNesyPackage(serial)
  if (!pkg) throw new Error('NesyMobile is not installed on the selected device')

  const runAsRoot = await tryShell(serial, `run-as ${pkg} pwd`)
  if (!runAsRoot) {
    throw new Error(
      `Cannot access ${pkg} with adb run-as. Install a debuggable build or use an in-app database export.`,
    )
  }

  // Stopping the app makes the DB, WAL and SHM files a consistent point-in-time copy.
  if (forceStop) await shell(serial, `am force-stop ${pkg}`)

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

    const value = await inspect(localDatabasePath)
    const rootPath = runAsRoot.trim().split('\n')[0] || `/data/user/0/${pkg}`
    return {
      serial,
      packageName: pkg,
      capturedAt: new Date().toISOString(),
      databaseName: mainDatabase.name,
      databasePath: `${rootPath}/databases/${mainDatabase.name}`,
      sizeBytes: mainBytes.length,
      walSizeBytes: walBytes.length,
      shmSizeBytes: shmBytes.length,
      value,
    }
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
}

/** Pulls and inspects the selected device's primary Room DB without modifying it. */
export async function getDeviceDatabaseSnapshot(
  serial: string,
  requestedTable: string | null = null,
  rowLimit = 100,
): Promise<LiveDatabaseSnapshot> {
  const safeRowLimit = Math.min(Math.max(Math.trunc(rowLimit) || 100, 1), 1_000)
  const { value: inspected, ...copy } = await withDeviceDatabaseCopy(
    serial,
    (databasePath) => inspectDatabase(databasePath, requestedTable, safeRowLimit),
    { forceStop: false },
  )
  return {
    ...copy,
    version: inspected.version,
    journalMode: inspected.journalMode,
    tables: inspected.tables,
    tableData: inspected.tableData,
    requestRows: inspected.requestRows,
    completedRequestCount: inspected.completedRequestCount,
  }
}

interface SqliteNameRow {
  name: string
}

interface SqliteOnlyCountRow {
  rowCount: number
}

async function inspectScheduleDatabase(databasePath: string): Promise<{
  scheduleRowCount: number
  stopChunkCount: number
  schedule: LiveScheduleSnapshot['schedule']
  warnings: string[]
}> {
  const tableRows = await sqliteJson<SqliteNameRow>(
    databasePath,
    `SELECT name
     FROM sqlite_schema
     WHERE type = 'table'
       AND lower(name) IN ('schedule', 'schedulestopchunk');`,
  )
  const scheduleTable = tableRows.find((table) => table.name.toLowerCase() === 'schedule')?.name
  const chunkTable = tableRows.find((table) => table.name.toLowerCase() === 'schedulestopchunk')?.name
  if (!scheduleTable) {
    return {
      scheduleRowCount: 0,
      stopChunkCount: 0,
      schedule: null,
      warnings: ['Schedule table was not found in the Room database.'],
    }
  }

  const countRows = await sqliteJson<SqliteOnlyCountRow>(
    databasePath,
    `SELECT COUNT(*) AS rowCount FROM ${quoteIdentifier(scheduleTable)};`,
  )
  const scheduleRows = await sqliteJson<Record<string, unknown>>(
    databasePath,
    `SELECT * FROM ${quoteIdentifier(scheduleTable)} ORDER BY "id" DESC LIMIT 1;`,
  )
  const scheduleRow = scheduleRows[0] ?? null
  const scheduleId = scheduleRow ? asString(scheduleRow.scheduleId) : ''
  const chunkRows = chunkTable
    ? await sqliteJson<Record<string, unknown>>(
        databasePath,
        `SELECT *
         FROM ${quoteIdentifier(chunkTable)}
         ${scheduleId ? `WHERE "scheduleId" = ${quoteSqlString(scheduleId)}` : ''}
         ORDER BY "stopIndex", "id";`,
      )
    : []
  const parsed = parseDeviceSchedule(scheduleRow, chunkRows)
  const warnings = [...parsed.warnings]
  if (!chunkTable) warnings.push('ScheduleStopChunk table was not found in the Room database.')

  return {
    scheduleRowCount: Number(countRows[0]?.rowCount) || 0,
    stopChunkCount: chunkRows.length,
    schedule: parsed.schedule,
    warnings,
  }
}

/** Reads the current Schedule tree from Schedule + ScheduleStopChunk in one snapshot. */
export async function getDeviceScheduleSnapshot(serial: string): Promise<LiveScheduleSnapshot> {
  const { value: inspected, ...copy } = await withDeviceDatabaseCopy(serial, inspectScheduleDatabase, { forceStop: false })
  return {
    ...copy,
    scheduleRowCount: inspected.scheduleRowCount,
    stopChunkCount: inspected.stopChunkCount,
    schedule: inspected.schedule,
    warnings: inspected.warnings,
  }
}

// ---------------------------------------------------------------------------
// Operational Readiness — decision-oriented health snapshot
// ---------------------------------------------------------------------------

const SYNC_OLDEST_ATTENTION_MS = 5 * 60_000
const LOCATION_STALE_ATTENTION_MS = 3 * 60_000
const LOCATION_BACKLOG_ATTENTION = 50
const JWT_SOON_MINUTES = 60
const CLOCK_SKEW_ATTENTION_SEC = 60

/** blocked > attention > ready > unknown; unknown never downgrades a real verdict. */
function worstVerdict(verdicts: HealthVerdict[]): HealthVerdict {
  if (verdicts.includes('blocked')) return 'blocked'
  if (verdicts.includes('attention')) return 'attention'
  if (verdicts.includes('ready')) return 'ready'
  return 'unknown'
}

/** JWT `exp` claim (ms epoch) decoded from the middle segment, or null. */
function jwtExpiryMs(token: string | null): number | null {
  if (!token) return null
  const parts = token.split('.')
  if (parts.length < 2 || !parts[1]) return null
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8')) as { exp?: number }
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null
  } catch {
    return null
  }
}

function hostnameOf(url: string | null): string | null {
  if (!url) return null
  const m = url.match(/^https?:\/\/([^/:\s"<]+)/)
  return m?.[1] ?? null
}

interface RunningServices {
  /** null = could not be read (unmeasured). */
  requestSender: boolean | null
  location: boolean | null
}

async function readRunningServices(serial: string, pkg: string | null): Promise<RunningServices> {
  if (!pkg) return { requestSender: null, location: null }
  const out = await tryShell(serial, `dumpsys activity services ${pkg}`, 12_000)
  if (out == null) return { requestSender: null, location: null }
  const running = (className: string) => out.includes(className)
  return {
    requestSender: running('RequestSenderService'),
    location: running('LocationService'),
  }
}

interface SessionState {
  isLogin: boolean | null
  token: string | null
  jwtExpiryMs: number | null
  apiHost: string | null
}

interface RecentApiEvidence {
  host: string
  status: number
  durationMs: number
  observedAt: string
}

async function readSession(
  serial: string,
  pkg: string | null,
  debuggable: boolean,
): Promise<SessionState> {
  const empty: SessionState = { isLogin: null, token: null, jwtExpiryMs: null, apiHost: null }
  if (!pkg || !debuggable) return empty

  // One shot over every prefs file — avoids guessing the exact file name.
  const prefs = await tryShell(serial, `run-as ${pkg} sh -c 'cat shared_prefs/*.xml 2>/dev/null'`)
  if (!prefs) return empty

  const isLoginRaw = firstMatch(prefs, /<boolean name="isLogin" value="(true|false)"/)
  const tokenRaw =
    firstMatch(prefs, /<string name="(?:token|accessToken|access_token|jwt)">([^<]+)<\/string>/)
  const token = tokenRaw ? decodeXmlEntities(tokenRaw).trim() : null
  const apiHost = hostnameOf(firstMatch(prefs, /(https?:\/\/[^<\s"]+)/))

  return {
    isLogin: isLoginRaw == null ? null : isLoginRaw === 'true',
    token,
    jwtExpiryMs: jwtExpiryMs(token),
    apiHost,
  }
}

/**
 * Reads the same OkHttp log evidence used by Network Inspector, so readiness
 * does not report an unknown API host immediately after a captured request.
 */
async function readRecentApiEvidence(serial: string): Promise<RecentApiEvidence | null> {
  // ADB can briefly reject one of several concurrent debug-view probes. A
  // second immediate read prevents that transient from becoming "host unknown".
  for (let attempt = 0; attempt < 2; attempt += 1) {
    let output: string
    try {
      output = await adb(
        ['-s', serial, 'logcat', '-d', '-v', 'epoch', '-t', '1200', '-s', 'OkHttpLog:D', '*:S'],
        12_000,
      )
    } catch {
      continue
    }

    let latest: RecentApiEvidence | null = null
    for (const line of output.split('\n')) {
      const match = line.match(
        /^\s*(\d+\.\d+).*OkHttpLog\s*:\s*<--\s+(\d{3})(?:\s+[A-Za-z][A-Za-z ]*?)?\s+(https?:\/\/\S+)\s+\((\d+)ms\)/,
      )
      if (!match) continue
      const [, epoch, status, url, duration] = match
      const host = hostnameOf(url ?? null)
      const atMs = Number(epoch) * 1000
      if (!host || !Number.isFinite(atMs)) continue
      latest = {
        host,
        status: Number(status),
        durationMs: Number(duration),
        observedAt: new Date(atMs).toISOString(),
      }
    }
    if (latest) return latest
  }
  return null
}

/** Device clock minus host clock, in seconds. Positive = device ahead. */
async function readClockSkewSec(serial: string): Promise<number | null> {
  const out = await tryShell(serial, 'date +%s')
  const deviceEpoch = toNum((out ?? '').trim())
  if (deviceEpoch == null) return null
  return deviceEpoch - Math.floor(Date.now() / 1000)
}

async function readLocationEnabled(serial: string): Promise<boolean | null> {
  const enabled = await tryShell(serial, 'cmd location is-location-enabled')
  if (enabled != null) {
    const v = enabled.trim().toLowerCase()
    if (v.includes('true')) return true
    if (v.includes('false')) return false
  }
  const mode = await tryShell(serial, 'settings get secure location_mode')
  const n = toNum((mode ?? '').trim())
  return n == null ? null : n > 0
}

interface PeripheralState {
  scannerInstalled: boolean | null
  bluetoothOn: boolean | null
  siblingApps: string[]
}

interface ScannerCapabilityProfile {
  name: string
  dataWedgeRequired: boolean
}

function scannerCapabilityProfile(os: OsInfo): ScannerCapabilityProfile {
  const identity = `${os.manufacturer} ${os.model}`.toLowerCase()
  if (/zebra|symbol/.test(identity)) {
    return { name: 'Zebra / Symbol', dataWedgeRequired: true }
  }
  if (/urovo|honeywell|datalogic/.test(identity)) {
    return { name: 'OEM scanner', dataWedgeRequired: false }
  }
  return { name: `${os.manufacturer} generic Android`, dataWedgeRequired: false }
}

async function readPeripherals(serial: string): Promise<PeripheralState> {
  const [packages, bt] = await Promise.all([
    tryShell(serial, "pm list packages | grep -iE 'arasdigital|datawedge|symbol'"),
    tryShell(serial, 'settings get global bluetooth_on'),
  ])
  const list = (packages ?? '')
    .split('\n')
    .map((line) => line.replace('package:', '').trim())
    .filter(Boolean)
  const scannerInstalled =
    packages == null ? null : list.some((p) => /datawedge|symbol/i.test(p))
  const siblingApps = list.filter((p) => /arasdigital/i.test(p) && !p.includes('nesymobile'))
  const btNum = toNum((bt ?? '').trim())
  return {
    scannerInstalled,
    bluetoothOn: btNum == null ? null : btNum > 0,
    siblingApps,
  }
}

interface HealthDatabaseFacts {
  scheduleRowCount: number
  scheduleStatus: number | null
  scheduleStatusLabel: string
  stopCount: number
  taskCount: number
  shipmentCount: number
  queueByState: Record<RequestRow['derivedState'], number>
  queueTotal: number
  oldestQueuedAgeMs: number | null
  completedRequestCount: number
  locationPendingCount: number
  locationNewestAgeMs: number | null
  warnings: string[]
}

const EMPTY_QUEUE: Record<RequestRow['derivedState'], number> = {
  pending: 0,
  waiting: 0,
  'in-flight': 0,
  retrying: 0,
  dead: 0,
}

async function findTableName(databasePath: string, lowerName: string): Promise<string | null> {
  const rows = await sqliteJson<SqliteNameRow>(
    databasePath,
    `SELECT name FROM sqlite_schema WHERE type = 'table' AND lower(name) = ${quoteSqlString(lowerName)} LIMIT 1;`,
  )
  return rows[0]?.name ?? null
}

async function inspectHealthDatabase(databasePath: string): Promise<HealthDatabaseFacts> {
  const warnings: string[] = []

  // --- Schedule (same shape as inspectScheduleDatabase, summarised) ---
  const scheduleTable = await findTableName(databasePath, 'schedule')
  const chunkTable = await findTableName(databasePath, 'schedulestopchunk')
  let scheduleRowCount = 0
  let scheduleStatus: number | null = null
  let stopCount = 0
  let taskCount = 0
  let shipmentCount = 0
  if (scheduleTable) {
    const countRows = await sqliteJson<SqliteOnlyCountRow>(
      databasePath,
      `SELECT COUNT(*) AS rowCount FROM ${quoteIdentifier(scheduleTable)};`,
    )
    scheduleRowCount = Number(countRows[0]?.rowCount) || 0
    const scheduleRows = await sqliteJson<Record<string, unknown>>(
      databasePath,
      `SELECT * FROM ${quoteIdentifier(scheduleTable)} ORDER BY "id" DESC LIMIT 1;`,
    )
    const scheduleRow = scheduleRows[0] ?? null
    const scheduleId = scheduleRow ? asString(scheduleRow.scheduleId) : ''
    const chunkRows = chunkTable
      ? await sqliteJson<Record<string, unknown>>(
          databasePath,
          `SELECT * FROM ${quoteIdentifier(chunkTable)} ${scheduleId ? `WHERE "scheduleId" = ${quoteSqlString(scheduleId)}` : ''} ORDER BY "stopIndex", "id";`,
        )
      : []
    const parsed = parseDeviceSchedule(scheduleRow, chunkRows)
    warnings.push(...parsed.warnings)
    if (parsed.schedule) {
      scheduleStatus = parsed.schedule.status
      stopCount = parsed.schedule.stops.length
      for (const stop of parsed.schedule.stops) {
        taskCount += stop.taskList.length
        for (const task of stop.taskList) shipmentCount += task.shipmentList.length
      }
    }
  } else {
    warnings.push('Schedule table was not found in the Room database.')
  }

  // --- Offline request queue ---
  const requestTable = await findTableName(databasePath, 'request')
  const requestRows = await readRequestRows(databasePath, requestTable)
  const queueByState = { ...EMPTY_QUEUE }
  let oldestCreatedAt: number | null = null
  for (const row of requestRows) {
    queueByState[row.derivedState] += 1
    if (row.createdAt > 0) {
      oldestCreatedAt = oldestCreatedAt == null ? row.createdAt : Math.min(oldestCreatedAt, row.createdAt)
    }
  }
  const now = Date.now()
  const oldestQueuedAgeMs = oldestCreatedAt == null ? null : Math.max(0, now - oldestCreatedAt)

  const completedTable = await findTableName(databasePath, 'completedrequest')
  let completedRequestCount = 0
  if (completedTable) {
    const rows = await sqliteJson<SqliteOnlyCountRow>(
      databasePath,
      `SELECT COUNT(*) AS rowCount FROM ${quoteIdentifier(completedTable)};`,
    )
    completedRequestCount = Number(rows[0]?.rowCount) || 0
  }

  // --- Live-location backlog ---
  const locationTable = await findTableName(databasePath, 'livelocation')
  let locationPendingCount = 0
  let locationNewestAgeMs: number | null = null
  if (locationTable) {
    const countRows = await sqliteJson<SqliteOnlyCountRow>(
      databasePath,
      `SELECT COUNT(*) AS rowCount FROM ${quoteIdentifier(locationTable)};`,
    )
    locationPendingCount = Number(countRows[0]?.rowCount) || 0
    // Detect an epoch-ms time column and read its newest value for a "last fix" age.
    const columns = await sqliteJson<SqliteColumnRow>(
      databasePath,
      `SELECT name FROM pragma_table_info(${quoteSqlString(locationTable)});`,
    )
    const timeColumn = columns
      .map((c) => c.name)
      .find((name) => /time|date|created/i.test(name))
    if (timeColumn) {
      const maxRows = await sqliteJson<{ maxTime: number | null }>(
        databasePath,
        `SELECT MAX(${quoteIdentifier(timeColumn)}) AS maxTime FROM ${quoteIdentifier(locationTable)};`,
      )
      const maxTime = maxRows[0]?.maxTime
      // Only treat plausible epoch-ms values as a timestamp.
      if (typeof maxTime === 'number' && maxTime > 1_000_000_000_000) {
        locationNewestAgeMs = Math.max(0, now - maxTime)
      }
    }
  }

  return {
    scheduleRowCount,
    scheduleStatus,
    scheduleStatusLabel: scheduleStatus == null ? 'Unknown' : SCHEDULE_STATUS_LABELS[scheduleStatus] ?? `#${scheduleStatus}`,
    stopCount,
    taskCount,
    shipmentCount,
    queueByState,
    queueTotal: requestRows.length,
    oldestQueuedAgeMs,
    completedRequestCount,
    locationPendingCount,
    locationNewestAgeMs,
    warnings,
  }
}

/** Mirror of SCHEDULE_STATUS labels (kept server-side to avoid a UI-data import). */
const SCHEDULE_STATUS_LABELS: Record<number, string> = {
  0: 'Draft',
  1: 'Active',
  2: 'Completed',
  3: 'EndOfDayRequested',
}

function humanAge(ms: number | null): string {
  if (ms == null) return '—'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  return `${h}h ago`
}

/** Like humanAge but without the "ago" suffix — for a forward-looking duration. */
function humanDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  const remM = m % 60
  return remM > 0 ? `${h}h ${remM}m` : `${h}h`
}

/** Absolute date-time for an expiry moment — date is omitted when it falls today. */
function formatExpiry(ms: number): string {
  const date = new Date(ms)
  const sameDay = new Date().toDateString() === date.toDateString()
  const time = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  if (sameDay) return `Today ${time}`
  const day = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${day} ${time}`
}

/** Best-effort device-side reachability check for the real API host. */
async function pingApiHost(serial: string, host: string | null): Promise<number | null | 'unreachable'> {
  if (!host || !/^[\w.-]+$/.test(host)) return null
  const out = await tryShell(serial, `ping -c 3 -W 2 ${host}`, 12_000)
  if (out == null) return 'unreachable'
  const avg = firstMatch(out, /=\s*[\d.]+\/([\d.]+)\//)
  if (avg == null) return /0% packet loss/.test(out) ? null : 'unreachable'
  return Math.round(Number(avg))
}

/**
 * Aggregates a decision-oriented readiness snapshot using non-destructive ADB
 * probes and a live Room DB/WAL/SHM copy that leaves the application running.
 */
export async function getDeviceHealthSnapshot(serial: string): Promise<OperationalHealthSnapshot> {
  const pkg = await findNesyPackage(serial)

  // --- Phase 1: non-destructive runtime probes ---
  const runtime = await getDeviceRuntime(serial)
  const debuggable = runtime.app.debuggable
  const [services, session, recentApi, clockSkewSec, locationEnabled, peripherals] = await Promise.all([
    readRunningServices(serial, pkg),
    readSession(serial, pkg, debuggable),
    readRecentApiEvidence(serial),
    readClockSkewSec(serial),
    readLocationEnabled(serial),
    readPeripherals(serial),
  ])
  const apiHost = recentApi?.host ?? session.apiHost
  const recentApiAgeMs = recentApi ? Date.now() - new Date(recentApi.observedAt).getTime() : null
  const recentApiIsFresh = recentApiAgeMs != null && recentApiAgeMs >= 0 && recentApiAgeMs <= 30 * 60_000
  const apiHostPing =
    recentApiIsFresh && recentApi ? recentApi.durationMs : await pingApiHost(serial, apiHost)
  const apiHostSource = recentApi
    ? `OkHttp traffic · HTTP ${recentApi.status} · ${recentApi.durationMs} ms`
    : session.apiHost
      ? 'Application preferences'
      : null
  const scannerProfile = scannerCapabilityProfile(runtime.os)

  // --- Phase 2: live on-device DB copy (does NOT force-stop the app) ---
  // Readiness is meant to be re-run freely, so it never kills the app. The
  // Database and Schedule pages use the same non-disruptive capture mode.
  const warnings: string[] = []
  let db: HealthDatabaseFacts | null = null
  const appStopped = false
  if (pkg) {
    try {
      const { value } = await withDeviceDatabaseCopy(serial, inspectHealthDatabase, {
        forceStop: false,
      })
      db = value
      warnings.push(...value.warnings)
    } catch (error) {
      warnings.push(
        `On-device database could not be read: ${error instanceof Error ? error.message : 'unknown error'}`,
      )
    }
  }

  const permission = (name: string): boolean | null => {
    const found = runtime.permissions.find((p) => p.name === name)
    return found ? found.granted : null
  }
  const now = Date.now()

  const cards: HealthCard[] = []

  // --- Card: Environment & Version ---
  {
    const installed = runtime.app.installed
    const environment = pkg == null ? null : pkg.endsWith('.test') ? 'Test' : 'Production'
    const signals = [
      {
        id: 'app-version',
        label: 'App version',
        value: installed ? `${runtime.app.versionName ?? '?'} (${runtime.app.versionCode ?? '?'})` : 'Not installed',
        verdict: (installed ? 'ready' : 'blocked') as HealthVerdict,
        hint: null,
        measured: true,
      },
      {
        id: 'environment',
        label: 'Environment',
        value: environment ?? '—',
        verdict: (debuggable && environment === 'Production' ? 'attention' : 'ready') as HealthVerdict,
        hint: debuggable && environment === 'Production' ? 'Debuggable build on a production package' : null,
        measured: environment != null,
      },
      {
        id: 'flavor',
        label: 'Package',
        value: runtime.app.packageName ?? '—',
        verdict: 'ready' as HealthVerdict,
        hint: runtime.app.debuggable ? 'debuggable' : 'release',
        measured: runtime.app.packageName != null,
      },
      {
        id: 'api-host',
        label: 'API host',
        value: apiHost ?? 'Not measured',
        verdict: 'ready' as HealthVerdict,
        hint: apiHostSource ?? 'Not found in preferences or recent OkHttp traffic',
        measured: apiHost != null,
      },
      {
        id: 'android',
        label: 'Android',
        value: `${runtime.os.androidVersion} (API ${runtime.os.apiLevel})`,
        verdict: 'ready' as HealthVerdict,
        hint: null,
        measured: true,
      },
    ]
    cards.push({
      id: 'environment',
      title: 'Environment & Version',
      verdict: worstVerdict(signals.map((s) => s.verdict)),
      headline: installed
        ? `${runtime.app.versionName ?? '?'} · ${environment ?? 'Unknown env'} · Android ${runtime.os.androidVersion}`
        : 'NesyMobile is not installed',
      signals,
    })
  }

  // --- Card: Session & Schedule ---
  {
    const jwtMinutes =
      session.jwtExpiryMs == null ? null : Math.round((session.jwtExpiryMs - now) / 60_000)
    const jwtVerdict: HealthVerdict =
      session.jwtExpiryMs == null
        ? 'unknown'
        : jwtMinutes! <= 0
          ? 'blocked'
          : jwtMinutes! < JWT_SOON_MINUTES
            ? 'attention'
            : 'ready'
    const loggedIn = session.isLogin === true
    const stops = db?.stopCount ?? 0
    const clockOff = clockSkewSec != null && Math.abs(clockSkewSec) > CLOCK_SKEW_ATTENTION_SEC
    const signals = [
      {
        id: 'login',
        label: 'Login state',
        value: session.isLogin == null ? 'Not measured' : loggedIn ? 'Logged in' : 'Not logged in',
        verdict: (session.isLogin == null ? 'unknown' : loggedIn ? 'ready' : 'blocked') as HealthVerdict,
        hint: session.isLogin == null && !debuggable ? 'Release build — prefs not readable' : null,
        measured: session.isLogin != null,
      },
      {
        id: 'jwt',
        label: 'JWT expires at',
        value:
          session.jwtExpiryMs == null
            ? session.token
              ? 'Token present, no exp'
              : 'Not measured'
            : formatExpiry(session.jwtExpiryMs),
        verdict: jwtVerdict,
        hint:
          session.jwtExpiryMs == null
            ? null
            : jwtMinutes! <= 0
              ? `Expired ${humanAge(now - session.jwtExpiryMs)}`
              : `Expires in ${humanDuration(session.jwtExpiryMs - now)}`,
        measured: session.jwtExpiryMs != null,
      },
      {
        id: 'schedule-status',
        label: 'Schedule',
        value:
          db == null
            ? 'Not measured'
            : db.scheduleRowCount === 0
              ? 'No schedule on device'
              : db.scheduleStatusLabel,
        verdict: (db == null
          ? 'unknown'
          : db.scheduleRowCount === 0
            ? loggedIn
              ? 'attention'
              : 'ready'
            : 'ready') as HealthVerdict,
        hint: null,
        measured: db != null,
      },
      {
        id: 'schedule-load',
        label: 'Route load',
        value: db == null ? 'Not measured' : `${stops} stops · ${db.taskCount} tasks · ${db.shipmentCount} shipments`,
        verdict: (db == null ? 'unknown' : loggedIn && stops === 0 ? 'attention' : 'ready') as HealthVerdict,
        hint: loggedIn && stops === 0 ? 'Logged in but schedule has no stops' : null,
        measured: db != null,
      },
      {
        id: 'clock',
        label: 'Clock skew',
        value: clockSkewSec == null ? 'Not measured' : `${clockSkewSec > 0 ? '+' : ''}${clockSkewSec}s`,
        verdict: (clockSkewSec == null ? 'unknown' : clockOff ? 'attention' : 'ready') as HealthVerdict,
        hint: clockOff ? 'Device/server clock drift affects JWT & schedule dates' : null,
        measured: clockSkewSec != null,
      },
    ]
    cards.push({
      id: 'session',
      title: 'Session & Schedule',
      verdict: worstVerdict(signals.map((s) => s.verdict)),
      headline: !loggedIn
        ? session.isLogin == null
          ? 'Session state unavailable'
          : 'Courier is not logged in'
        : db == null
          ? 'Logged in · schedule unavailable'
          : `Logged in · ${stops} stops · ${db.scheduleStatusLabel}`,
      signals,
    })
  }

  // --- Card: Sync Queue ---
  {
    const q = db?.queueByState ?? EMPTY_QUEUE
    const active = q.pending + q.waiting + q['in-flight'] + q.retrying
    const dead = q.dead
    const oldestStale = db?.oldestQueuedAgeMs != null && db.oldestQueuedAgeMs > SYNC_OLDEST_ATTENTION_MS
    const senderRunning = services.requestSender
    const signals = [
      {
        id: 'queue-depth',
        label: 'Waiting to send',
        value: db == null ? 'Not measured' : `${active} request${active === 1 ? '' : 's'}`,
        verdict: (db == null ? 'unknown' : active === 0 ? 'ready' : oldestStale ? 'attention' : 'ready') as HealthVerdict,
        hint:
          db?.oldestQueuedAgeMs != null && active > 0
            ? `Oldest ${humanAge(db.oldestQueuedAgeMs)}`
            : null,
        measured: db != null,
      },
      {
        id: 'queue-dead',
        label: 'Archived after 3 retries',
        value: db == null ? 'Not measured' : `${dead}`,
        verdict: (db == null ? 'unknown' : dead > 0 ? 'blocked' : 'ready') as HealthVerdict,
        hint: dead > 0 ? 'Requests dropped after 3 failed attempts — data-loss risk' : null,
        measured: db != null,
      },
      {
        id: 'sender-service',
        label: 'RequestSenderService',
        value: senderRunning == null ? 'Not measured' : senderRunning ? 'Running' : 'Not running',
        verdict: (senderRunning == null
          ? 'unknown'
          : senderRunning
            ? 'ready'
            : active > 0
              ? 'attention'
              : 'ready') as HealthVerdict,
        hint: senderRunning === false && active > 0 ? 'Queue has items but sender is not running' : null,
        measured: senderRunning != null,
      },
      {
        id: 'queue-retry',
        label: 'Retrying',
        value: db == null ? 'Not measured' : `${q.retrying}`,
        verdict: (db == null ? 'unknown' : q.retrying > 0 ? 'attention' : 'ready') as HealthVerdict,
        hint: null,
        measured: db != null,
      },
      {
        id: 'queue-archive',
        label: 'Sent archive',
        value: db == null ? 'Not measured' : `${db.completedRequestCount}`,
        verdict: 'ready' as HealthVerdict,
        hint: null,
        measured: db != null,
      },
    ]
    cards.push({
      id: 'sync',
      title: 'Sync Queue',
      verdict: worstVerdict(signals.map((s) => s.verdict)),
      headline:
        db == null
          ? 'Offline queue unavailable'
          : dead > 0
            ? `${dead} request(s) archived after retries`
            : active === 0
              ? 'Queue empty'
              : `${active} request(s) waiting to send`,
      signals,
    })
  }

  // --- Card: Location Pipeline ---
  {
    const fine = permission('ACCESS_FINE_LOCATION')
    const background = permission('ACCESS_BACKGROUND_LOCATION')
    const locRunning = services.location
    const backlog = db?.locationPendingCount ?? 0
    const stale =
      db?.locationNewestAgeMs != null && db.locationNewestAgeMs > LOCATION_STALE_ATTENTION_MS
    const signals = [
      {
        id: 'gps',
        label: 'GPS / location',
        value: locationEnabled == null ? 'Not measured' : locationEnabled ? 'Enabled' : 'Disabled',
        verdict: (locationEnabled == null ? 'unknown' : locationEnabled ? 'ready' : 'blocked') as HealthVerdict,
        hint: locationEnabled === false ? 'Location is turned off on the device' : null,
        measured: locationEnabled != null,
      },
      {
        id: 'perm-fine',
        label: 'Foreground permission',
        value: fine == null ? 'Not measured' : fine ? 'Granted' : 'Denied',
        verdict: (fine == null ? 'unknown' : fine ? 'ready' : 'blocked') as HealthVerdict,
        hint: fine === false ? 'ACCESS_FINE_LOCATION not granted' : null,
        measured: fine != null,
      },
      {
        id: 'perm-background',
        label: 'Background permission',
        value: background == null ? 'Not measured' : background ? 'Granted' : 'Denied',
        verdict: (background == null ? 'unknown' : background ? 'ready' : 'attention') as HealthVerdict,
        hint: background === false ? 'ACCESS_BACKGROUND_LOCATION not granted' : null,
        measured: background != null,
      },
      {
        id: 'location-service',
        label: 'LocationService',
        value: locRunning == null ? 'Not measured' : locRunning ? 'Running' : 'Not running',
        verdict: (locRunning == null ? 'unknown' : locRunning ? 'ready' : 'attention') as HealthVerdict,
        hint: locRunning === false ? 'Location tracking service is not running' : null,
        measured: locRunning != null,
      },
      {
        id: 'location-backlog',
        label: 'Buffered fixes',
        value: db == null ? 'Not measured' : `${backlog}`,
        verdict: (db == null ? 'unknown' : backlog > LOCATION_BACKLOG_ATTENTION || stale ? 'attention' : 'ready') as HealthVerdict,
        hint:
          db?.locationNewestAgeMs != null
            ? `Newest ${humanAge(db.locationNewestAgeMs)}`
            : backlog > LOCATION_BACKLOG_ATTENTION
              ? 'Location upload backlog is growing'
              : null,
        measured: db != null,
      },
    ]
    cards.push({
      id: 'location',
      title: 'Location Pipeline',
      verdict: worstVerdict(signals.map((s) => s.verdict)),
      headline:
        fine === false
          ? 'Foreground location denied'
          : locationEnabled === false
            ? 'Location disabled on device'
            : locRunning === false
              ? 'LocationService not running'
              : `${backlog} buffered fix(es)`,
      signals,
    })
  }

  // --- Card: Backend & Peripherals ---
  {
    const offline = runtime.network === 'offline'
    const apiValue =
      apiHost == null
        ? 'Not measured'
        : recentApiIsFresh && recentApi
          ? `HTTP ${recentApi.status} · ${recentApi.durationMs} ms`
        : apiHostPing === 'unreachable'
          ? 'Unreachable'
          : apiHostPing == null
            ? 'Reachable'
            : `${apiHostPing} ms`
    const signals = [
      {
        id: 'transport',
        label: 'Connection',
        value: runtime.network === 'wifi' ? 'Wi-Fi' : runtime.network === 'cellular' ? 'Cellular' : 'Offline',
        verdict: (offline ? 'blocked' : 'ready') as HealthVerdict,
        hint: offline ? 'Device has no network transport' : null,
        measured: true,
      },
      {
        id: 'internet',
        label: 'Internet (ping)',
        value: runtime.ping.latencyMs == null ? 'No response' : `${runtime.ping.latencyMs} ms`,
        verdict: (runtime.ping.latencyMs == null ? 'attention' : 'ready') as HealthVerdict,
        hint: runtime.ping.latencyMs == null ? `${runtime.ping.endpoint} did not respond` : runtime.ping.endpoint,
        measured: true,
      },
      {
        id: 'api-host-reach',
        label: 'API host reachability',
        value: apiValue,
        verdict: (apiHost == null
          ? 'unknown'
          : apiHostPing === 'unreachable'
            ? 'blocked'
            : 'ready') as HealthVerdict,
        hint: apiHost ? `${apiHost}${apiHostSource ? ` · ${apiHostSource}` : ''}` : 'API host unknown',
        measured: apiHost != null,
      },
      {
        id: 'scanner',
        label: 'Scanner capability',
        value: peripherals.scannerInstalled
          ? 'DataWedge installed'
          : scannerProfile.dataWedgeRequired
            ? peripherals.scannerInstalled == null
              ? 'Not measured'
              : 'DataWedge missing'
            : 'DataWedge not required',
        verdict: (scannerProfile.dataWedgeRequired
          ? peripherals.scannerInstalled == null
            ? 'unknown'
            : peripherals.scannerInstalled
              ? 'ready'
              : 'attention'
          : 'ready') as HealthVerdict,
        hint: scannerProfile.dataWedgeRequired
          ? peripherals.scannerInstalled === false
            ? `${scannerProfile.name} profile requires DataWedge`
            : `${scannerProfile.name} capability profile`
          : `${scannerProfile.name} capability profile`,
        measured: !scannerProfile.dataWedgeRequired || peripherals.scannerInstalled != null,
      },
      {
        id: 'peripherals',
        label: 'Companion apps',
        value:
          peripherals.siblingApps.length > 0
            ? `${peripherals.siblingApps.length} installed`
            : peripherals.bluetoothOn == null
              ? 'Not measured'
              : 'None',
        verdict: 'ready' as HealthVerdict,
        hint:
          peripherals.bluetoothOn == null
            ? null
            : `Bluetooth ${peripherals.bluetoothOn ? 'on' : 'off'}${peripherals.siblingApps.length ? ` · ${peripherals.siblingApps.join(', ')}` : ''}`,
        measured: true,
      },
    ]
    cards.push({
      id: 'backend',
      title: 'Backend & Peripherals',
      verdict: worstVerdict(signals.map((s) => s.verdict)),
      headline: offline
        ? 'Device is offline'
        : apiHost && apiHostPing === 'unreachable'
          ? 'API host unreachable'
          : `${runtime.network === 'wifi' ? 'Wi-Fi' : runtime.network === 'cellular' ? 'Cellular' : 'Offline'} · ${runtime.ping.latencyMs ?? '—'} ms`,
      signals,
    })
  }

  // --- Overall verdict + top blockers ---
  const overall = worstVerdict(cards.map((c) => c.verdict))
  const blockers = cards
    .flatMap((card) =>
      card.signals
        .filter((s) => s.verdict === 'blocked' || s.verdict === 'attention')
        .map((s) => ({
          card: card.id,
          severity: s.verdict as 'blocked' | 'attention',
          message: s.hint ?? `${card.title}: ${s.label} — ${s.value}`,
        })),
    )
    .sort((a, b) => (a.severity === b.severity ? 0 : a.severity === 'blocked' ? -1 : 1))
    .slice(0, 3)

  return {
    serial,
    packageName: pkg,
    capturedAt: new Date().toISOString(),
    appStopped,
    overall,
    blockers,
    cards,
    meta: {
      versionName: runtime.app.versionName,
      versionCode: runtime.app.versionCode,
      flavor: runtime.app.packageName,
      environment: pkg == null ? null : pkg.endsWith('.test') ? 'Test' : 'Production',
      apiHost,
      debuggable,
      androidVersion: runtime.os.androidVersion,
      apiLevel: runtime.os.apiLevel,
    },
    warnings,
  }
}

// ---------------------------------------------------------------------------
// Live Screen State — current fragment on screen via `dumpsys activity top`
// ---------------------------------------------------------------------------

/** Framework / third-party fragments that are never the courier's "screen". */
const FRAMEWORK_FRAGMENTS = new Set([
  'ReportFragment',
  'NavHostFragment',
  'SupportMapFragment',
  'SupportRequestManagerFragment',
])

/** androidx.fragment.app.Fragment numeric state → coarse lifecycle bucket. */
function lifecycleFromState(state: number): FragmentLifecycle {
  if (state >= 7) return 'RESUMED'
  if (state >= 5) return 'STARTED'
  if (state >= 2) return 'VIEW_CREATED'
  if (state === 1) return 'CREATED'
  if (state === 0) return 'ATTACHED'
  if (state < 0) return 'INITIALIZING'
  return 'UNKNOWN'
}

/** Slices the dump to the block belonging to the NesyMobile MainActivity. */
function sliceMainActivity(dump: string, pkg: string): string | null {
  const lines = dump.split('\n')
  const start = lines.findIndex(
    (l) => /^\s*ACTIVITY\b/.test(l) && l.includes(pkg) && /MainActivity/.test(l),
  )
  if (start < 0) return null
  // Runs until the next task/activity boundary (each task is a separate app).
  let end = lines.length
  for (let i = start + 1; i < lines.length; i++) {
    if (/^TASK /.test(lines[i]!) || /^\s*ACTIVITY\b/.test(lines[i]!)) {
      end = i
      break
    }
  }
  return lines.slice(start, end).join('\n')
}

/**
 * Parses fragment declarations from a FragmentManager dump block. Each app
 * fragment is emitted once (deduped by mWho), in document order, with its
 * lifecycle state and dialog/nav-destination classification.
 */
function parseFragments(block: string): LiveFragmentNode[] {
  const nodes: LiveFragmentNode[] = []
  const seen = new Set<string>()
  // Matches e.g. "StopListFragment{30e5f54} (uuid id=0x.. tag=..)"
  const declRe = /([A-Za-z][A-Za-z0-9_]*Fragment)\{[0-9a-f]+\}\s*\(([^)]*)\)/g
  const lines = block.split('\n')
  let order = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    declRe.lastIndex = 0
    const m = declRe.exec(line)
    if (!m) continue
    const className = m[1]!
    if (FRAMEWORK_FRAGMENTS.has(className)) continue

    const attrs = m[2] ?? ''
    const who = /([0-9a-f-]{8,})/.exec(attrs)?.[1] ?? `${className}-${order}`
    if (seen.has(who)) continue
    seen.add(who)

    const tag = /tag=([^\s)]+)/.exec(attrs)?.[1] ?? null
    // mState / mCurState usually appears on the next couple of lines.
    let stateCode = -99
    for (let j = i; j < Math.min(i + 4, lines.length); j++) {
      const sm = /m(?:Cur)?State=(-?\d+)/.exec(lines[j]!)
      if (sm) {
        stateCode = Number(sm[1])
        break
      }
    }
    nodes.push({
      className,
      who,
      tag: tag && tag !== 'null' ? tag : null,
      lifecycle: stateCode === -99 ? 'UNKNOWN' : lifecycleFromState(stateCode),
      stateCode: stateCode === -99 ? -1 : stateCode,
      isDialog: /Dialog|BottomSheet/.test(className),
      order: order++,
    })
  }
  return nodes
}

/** Interactive view resource-entry names visible in the activity view hierarchy. */
function parseVisibleControls(block: string): string[] {
  const controls = new Set<string>()
  // View hierarchy runs from "View Hierarchy:" until the "Looper" section.
  const start = block.indexOf('View Hierarchy:')
  const hierarchy = start >= 0 ? block.slice(start, block.indexOf('Looper', start) + 1 || undefined) : block
  for (const m of hierarchy.matchAll(/app:id\/([A-Za-z0-9_]+)/g)) {
    const id = m[1]!
    // Nav-drawer menu entries are named after their destination fragment and
    // are present on every screen — not controls of the current screen.
    if (/Fragment$/.test(id)) continue
    // Framework container chrome and Material component internals.
    if (
      /^(action_bar|action_context_bar|content$|navigationBarBackground|statusBarBackground|decor|activity_main|nav_host|coordinatorLayout|rootLayout|navigation_header|design_|text_input|textinput_|text1$|image1$|close_search|search_button|search_layout)/.test(
        id,
      )
    )
      continue
    controls.add(id)
  }
  return [...controls].sort()
}

async function readAllNesyServices(serial: string, pkg: string): Promise<string[]> {
  const out = await tryShell(serial, `dumpsys activity services ${pkg}`, 12_000)
  if (!out) return []
  const set = new Set<string>()
  for (const m of out.matchAll(/ServiceRecord\{[^}]*\/([.\w]*\.(\w+Service))/g)) {
    const cls = m[2]
    if (cls) set.add(cls)
  }
  return [...set].sort()
}

function jsonKind(value: unknown): LiveScreenField['kind'] {
  if (value === null || value === undefined) return 'null'
  if (Array.isArray(value)) return 'array'
  if (typeof value === 'object') return 'object'
  if (typeof value === 'boolean') return 'boolean'
  if (typeof value === 'number') return 'number'
  return 'string'
}

function fieldValueCount(value: unknown): number | null {
  if (Array.isArray(value)) return value.length
  if (typeof value === 'object' && value != null) return Object.keys(value).length
  return null
}

/**
 * Parses the `NESY_SCREEN_STATE:{json}` line emitted by the app's debug dump
 * hook. Returns `instrumented: false` when the installed build predates the
 * hook (no marker), so the UI can prompt for an instrumented build.
 */
function parseScreenStateDump(dump: string | null): {
  instrumented: boolean
  fields: LiveScreenField[]
} {
  if (!dump) return { instrumented: false, fields: [] }
  const marker = dump.indexOf('NESY_SCREEN_STATE:')
  if (marker < 0) return { instrumented: false, fields: [] }

  const jsonStart = marker + 'NESY_SCREEN_STATE:'.length
  const line = dump.slice(jsonStart).split('\n')[0]?.trim() ?? ''
  let parsed: { shared?: Record<string, unknown>; screen?: Record<string, unknown> }
  try {
    parsed = JSON.parse(line) as typeof parsed
  } catch {
    return { instrumented: false, fields: [] }
  }

  const fields: LiveScreenField[] = []
  const collect = (obj: Record<string, unknown> | undefined, group: LiveScreenField['group']) => {
    if (!obj) return
    for (const [name, value] of Object.entries(obj)) {
      fields.push({ name, value, kind: jsonKind(value), count: fieldValueCount(value), group })
    }
  }
  collect(parsed.screen, 'screen')
  collect(parsed.shared, 'shared')
  return { instrumented: true, fields }
}

/**
 * Reads the live screen state of the selected device from `dumpsys activity
 * top` plus the app's debug dump hook. Reports the currently on-screen
 * fragment, its lifecycle, any overlaid dialog, the visible controls, running
 * services, and — when an instrumented build is installed — the live in-memory
 * ViewModel/screen field values.
 */
export async function getDeviceScreenState(serial: string): Promise<LiveScreenState> {
  const pkg = await findNesyPackage(serial)
  const base: LiveScreenState = {
    serial,
    packageName: pkg,
    capturedAt: new Date().toISOString(),
    appForeground: false,
    activityName: null,
    navHostId: null,
    current: null,
    overlay: null,
    fragments: [],
    visibleControls: [],
    runningServices: [],
    stateInstrumented: false,
    fields: [],
    reason: null,
  }
  if (!pkg) return { ...base, reason: 'NesyMobile is not installed on this device' }

  // The activity class package is fixed regardless of applicationId suffix (.test/.dev).
  const component = `${pkg}/com.arasdigital.nesymobile.main.MainActivity`
  const [activities, dump, services, stateDump] = await Promise.all([
    tryShell(serial, 'dumpsys activity activities | grep -E "ResumedActivity|topResumedActivity"', 8_000),
    tryShell(serial, 'dumpsys activity top', 15_000),
    readAllNesyServices(serial, pkg),
    tryShell(serial, `dumpsys activity ${component} --nesy-state`, 8_000),
  ])

  base.runningServices = services
  base.appForeground = Boolean(activities && activities.includes(pkg))

  const parsedState = parseScreenStateDump(stateDump)
  base.stateInstrumented = parsedState.instrumented
  base.fields = parsedState.fields

  if (!dump) return { ...base, reason: 'Could not read dumpsys activity top' }

  const block = sliceMainActivity(dump, pkg)
  if (!block) {
    return {
      ...base,
      reason: base.appForeground
        ? 'MainActivity is resumed but its view state was not in the dump'
        : 'NesyMobile is not in the foreground — bring the app to the front to inspect its screen',
    }
  }

  base.activityName = 'MainActivity'
  base.navHostId = /#[0-9a-f]+ app:id\/(\w*nav_host\w*)/.exec(block)?.[1] ?? 'nav_host'

  const fragments = parseFragments(block)
  base.fragments = fragments
  base.visibleControls = parseVisibleControls(block)

  const navDestinations = fragments.filter((f) => !f.isDialog)
  const dialogs = fragments.filter((f) => f.isDialog)
  // Active screen = the most-progressed, deepest (latest in document order)
  // nav destination. Ties on state resolve to the later-declared fragment.
  const current =
    [...navDestinations]
      .sort((a, b) => a.stateCode - b.stateCode || a.order - b.order)
      .at(-1) ?? null
  const overlay =
    [...dialogs].sort((a, b) => a.stateCode - b.stateCode || a.order - b.order).at(-1) ?? null

  base.current = current
  base.overlay = overlay
  if (!current && !overlay) {
    base.reason = 'No app fragment is currently added to the navigation host'
  }
  return base
}
