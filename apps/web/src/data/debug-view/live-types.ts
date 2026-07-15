// ============================================================================
// Debug View — Live ADB Types
// ============================================================================
// /api/adb/* route handler'larının döndürdüğü gerçek cihaz verisi tipleri.
// mock types.ts'teki DeviceRuntime'ın canlı karşılığı: ADB üzerinden
// okunamayan alanlar null olabilir (ör. release build'de Firebase prefs).

import type { NetworkTransport, WifiInfo, CellularInfo, OsInfo } from './types'

/** Ping tabanlı canlı ölçüm — throughput (Mbps) cihaz üzerinden ölçülemez. */
export interface LivePingSample {
  latencyMs: number | null
  jitterMs: number | null
  packetLossPct: number | null
  measuredAt: string
  endpoint: string
}

/** dumpsys battery çıktısından okunan anlık batarya durumu. */
export interface LiveBatteryInfo {
  level: number
  charging: boolean
  temperatureC: number | null
  voltageMv: number | null
  technology: string | null
}

/** dumpsys package + pidof + /proc üzerinden uygulama süreci. */
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
 * run-as ile shared_prefs'ten okunan Firebase kimlikleri.
 * Yalnızca debuggable build'lerde erişilebilir; değilse available=false.
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

/** /api/adb/runtime yanıtı — Overview ekranını besleyen canlı kök nesne. */
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

/** /api/adb/devices yanıt zarfı. */
export interface AdbDevicesResponse {
  adbAvailable: boolean
  adbPath: string | null
  error: string | null
  devices: import('@/data/engineering/device-lab/device-lab-types').ConnectedDevice[]
}
