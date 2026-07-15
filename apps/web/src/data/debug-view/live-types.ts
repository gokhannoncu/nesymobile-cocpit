// ============================================================================
// Debug View — Live ADB Types
// ============================================================================
// Real device data types returned by /api/adb/* route handlers.
// Live equivalent of DeviceRuntime in mock types.ts: fields that cannot be
// read via ADB can be null (e.g. Firebase prefs in release build).

import type { NetworkTransport, WifiInfo, CellularInfo, OsInfo } from './types'

/** Ping-based live measurement — throughput (Mbps) cannot be measured on device. */
export interface LivePingSample {
  latencyMs: number | null
  jitterMs: number | null
  packetLossPct: number | null
  measuredAt: string
  endpoint: string
}

/** Instant battery state read from dumpsys battery output. */
export interface LiveBatteryInfo {
  level: number
  charging: boolean
  temperatureC: number | null
  voltageMv: number | null
  technology: string | null
}

/** Application process via dumpsys package + pidof + /proc. */
export interface LiveAppInfo {
  installed: boolean
  packageName: string | null
  versionName: string | null
  versionCode: number | null
  debuggable: boolean
  firstInstall: string | null
  lastUpdate: string | null
  installer: string | null
  processId: number | null
  memoryUsageMb: number | null
  foreground: boolean | null
  batteryOptimized: boolean | null
}

/**
 * Firebase IDs read from shared_prefs with run-as.
 * Only accessible in debuggable builds; otherwise available=false.
 */
export interface LiveFirebaseSnapshot {
  available: boolean
  reason: string | null
  gmpAppId: string | null
  appInstanceId: string | null
  sessionId: string | null
  fcmToken: string | null
  fcmTokenStoredAt: string | null
  analyticsCollectionEnabled: boolean | null
  firebaseInstallationId: string | null
  crashlyticsInstallationId: string | null
}

/** /api/adb/runtime response — live root object feeding the Overview screen. */
export interface LiveDeviceRuntime {
  serial: string
  capturedAt: string
  network: NetworkTransport
  wifi: WifiInfo
  cellular: CellularInfo
  ping: LivePingSample
  os: OsInfo
  battery: LiveBatteryInfo
  app: LiveAppInfo
  firebase: LiveFirebaseSnapshot
  permissions: { name: string; granted: boolean }[]
}

/** /api/adb/devices response envelope. */
export interface AdbDevicesResponse {
  adbAvailable: boolean
  adbPath: string | null
  error: string | null
  devices: import('@/data/engineering/device-lab/device-lab-types').ConnectedDevice[]
}
