// ============================================================================
// Debug View — Shared Types
// ============================================================================
// These types represent instant debugging data modeled as if read
// from the selected device (via ADB / Nesy Device Bridge). Field names
// are exactly compatible with NesyMobile (Kotlin) source models.

import type { Tone } from '@/components/product'

// ---------------------------------------------------------------------------
// Runtime / Overview
// ---------------------------------------------------------------------------

export type NetworkTransport = 'wifi' | 'cellular' | 'ethernet' | 'offline'
export type CellularGeneration = '5G' | '4G/LTE' | '3G' | '2G' | null

/** WiFi connection instant state (dumpsys wifi + ConnectivityManager). */
export interface WifiInfo {
  connected: boolean
  ssid: string | null
  bssid: string | null
  ipAddress: string | null
  gateway: string | null
  linkSpeedMbps: number | null
  frequencyMhz: number | null
  rssiDbm: number | null
  signalLevel: 0 | 1 | 2 | 3 | 4
  security: string | null
}

/** Cellular/mobile data state (TelephonyManager). */
export interface CellularInfo {
  connected: boolean
  carrier: string | null
  generation: CellularGeneration
  signalDbm: number | null
  roaming: boolean
  dataState: 'connected' | 'disconnected' | 'suspended'
}

/** Internet speed/bandwidth measurement (ping + throughput on bridge side). */
export interface ThroughputSample {
  downloadMbps: number
  uploadMbps: number
  latencyMs: number
  jitterMs: number
  packetLossPct: number
  measuredAt: string
  endpoint: string
}

/** Operating system and hardware ID (Build.* + dumpsys). */
export interface OsInfo {
  manufacturer: string
  model: string
  androidVersion: string
  apiLevel: number
  securityPatch: string
  buildFingerprint: string
  kernelVersion: string
  cpuAbi: string
  totalRamMb: number
  availableRamMb: number
  storageTotalGb: number
  storageFreeGb: number
  uptime: string
  locale: string
  timezone: string
}

/**
 * Firebase state — services used in NesyMobile: Analytics, Crashlytics, FCM.
 * (Remote Config is NOT integrated — state is shown separately on purpose.)
 */
export interface FirebaseSnapshot {
  appInstanceId: string
  fcmToken: string
  fcmTokenStoredAt: string
  analyticsCollectionEnabled: boolean
  sessionId: string
  lastAnalyticsEvents: { name: string; at: string }[]
  crashlyticsUserId: string | null
  crashlyticsCustomKeys: { key: string; value: string }[]
  lastCrashAt: string | null
  lastNonFatalAt: string | null
  crashFreeSessionsPct: number
  remoteConfigIntegrated: boolean
}

/** Application process state (dumpsys package + activity). */
export interface AppProcessInfo {
  packageName: string
  versionName: string
  versionCode: number
  buildType: 'debug' | 'internal' | 'release'
  flavor: string
  installer: string | null
  firstInstall: string
  lastUpdate: string
  processId: number
  processImportance: string
  memoryUsageMb: number
  batteryOptimized: boolean
  foreground: boolean
}

/** Root object feeding the entire Overview screen. */
export interface DeviceRuntime {
  deviceId: string
  capturedAt: string
  network: NetworkTransport
  wifi: WifiInfo
  cellular: CellularInfo
  throughput: ThroughputSample
  os: OsInfo
  firebase: FirebaseSnapshot
  app: AppProcessInfo
  permissions: { name: string; granted: boolean }[]
}

// ---------------------------------------------------------------------------
// Network Inspector (Fiddler-like)
// ---------------------------------------------------------------------------

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export interface NetworkTiming {
  dnsMs: number
  connectMs: number
  tlsMs: number
  requestMs: number
  waitingMs: number
  responseMs: number
  totalMs: number
}

export interface NetworkTransaction {
  id: string
  startedAt: string
  method: HttpMethod
  scheme: 'https' | 'http'
  host: string
  path: string
  fullUrl: string
  remoteIp: string
  status: number | null
  statusText: string
  fromCache: boolean
  requestSizeBytes: number
  responseSizeBytes: number
  protocol: 'h2' | 'http/1.1'
  contentType: string
  timing: NetworkTiming
  requestHeaders: Record<string, string>
  responseHeaders: Record<string, string>
  requestBody: string | null
  responseBody: string | null
  correlationId: string
  initiator: string
  error: string | null
  retryOf: string | null
}

// ---------------------------------------------------------------------------
// Database Access + Request table
// ---------------------------------------------------------------------------

export type DbAccessDifficulty = 'easy' | 'moderate' | 'hard' | 'blocked'

/** Device database access method analysis over Release APK. */
export interface DbAccessMethod {
  id: string
  name: string
  tool: string
  requiresRoot: boolean
  worksOnRelease: boolean
  difficulty: DbAccessDifficulty
  summary: string
  steps: string[]
  commands: string[]
  caveats: string[]
  tone: Tone
}

/**
 * A row of NesyMobile Room `request` table (entity: Request).
 * Field names match the real @ColumnInfo names in AppDatabase v240 exactly.
 * Derived from queue state (isProcessing / isWaitingRequest / tryCount) combination.
 */
export interface RequestRow {
  id: number
  userName: string
  requestName: string
  requestJson: string
  timeStamp: string
  tryCount: number
  isProcessing: boolean
  isWaitingRequest: boolean
  createdAt: number
  waybillNumbers: string[]
  sendWithoutWaiting: boolean
  fiscalInvoiceId: string | null
  uniqueKey: string
  /** UI derived: queue state — calculated from three flags. */
  derivedState: 'pending' | 'waiting' | 'in-flight' | 'retrying' | 'dead'
}

export interface DbTableInfo {
  name: string
  rowCount: number
  sizeKb: number
  description: string
  primaryKey: string
}

// ---------------------------------------------------------------------------
// Schedule Explorer  (Schedule → Stop → Task → Shipment → ShipmentItem)
// ---------------------------------------------------------------------------

export interface DbgShipmentItem {
  barcode: string
  legacySystemShortBarcode: string | null
  deci: number
  weight: number
  itemCurrentLocation: number
  shipmentItemStatus: number
  deliveryFailureReason: number
  isOverSize: boolean
  lastStatusUpdatedAt: string | null
}

export interface DbgCollection {
  collectionAmount: number
  collectionStatus: number
  collectionType: number
  currency: string | null
  serviceType: number
  paymentTimeStamp: string
}

export interface DbgShipment {
  waybillNumber: string
  trackingNumber: string
  deliveryCode: string | null
  sender: string | null
  marketPlace: string | null
  packageType: number
  shipmentStatus: number
  shipmentType: number
  recipientType: number
  customerTypeId: number
  isDocumentCollection: boolean
  isRedirection: number
  shipmentItemCount: number
  activeShipmentItemCount: number
  deliveryRemark: string | null
  consigneeGsm: string | null
  collections: DbgCollection[]
  shipmentItemList: DbgShipmentItem[]
}

export interface DbgTask {
  taskId: string
  lastStopId: string | null
  taskStatus: number
  taskType: number
  taskParty: string | null
  taskAddress: string | null
  streetTag: string | null
  gsm: string | null
  consigneeEmail: string | null
  isConsigneeAtTheAddress: boolean
  isDropAtTheDoor: boolean
  waveNumber: number
  remarkText: string | null
  shipmentList: DbgShipment[]
}

export interface DbgTimeWindow {
  startTime: string
  endTime: string
}

export interface DbgStop {
  stopId: string
  stopOrder: number
  timeWindow: DbgTimeWindow
  estimatedTimeOfArrival: string
  latitude: number
  longitude: number
  orderChanged: boolean
  taskList: DbgTask[]
}

export interface DbgSchedule {
  id: number
  scheduleId: string
  timeStamp: string
  status: number
  courierName: string
  courierId: string
  vehiclePlate: string
  branchCode: string
  stops: DbgStop[]
}

// ---------------------------------------------------------------------------
// Screen State (DeliveryFragment vb.)
// ---------------------------------------------------------------------------

export interface ScreenStateField {
  name: string
  type: string
  value: string
  group: 'lifecycle' | 'viewmodel' | 'ui-state' | 'selection' | 'flags'
}

export interface ScreenEvent {
  id: string
  timestamp: string
  type: 'lifecycle' | 'user' | 'state' | 'network' | 'navigation'
  label: string
  detail: string | null
}

export interface ScreenSnapshot {
  fragmentName: string
  activityName: string
  viewModelName: string
  navGraphDestination: string
  lifecycleState: 'CREATED' | 'STARTED' | 'RESUMED' | 'PAUSED' | 'STOPPED'
  enteredAt: string
  timeOnScreenSec: number
  collectionType: string
  collectionTypeRaw: number
  fields: ScreenStateField[]
  recentEvents: ScreenEvent[]
}

// ---------------------------------------------------------------------------
// User Interaction Timeline
// ---------------------------------------------------------------------------

export type InteractionKind =
  | 'app'
  | 'screen'
  | 'click'
  | 'input'
  | 'scan'
  | 'network'
  | 'system'
  | 'error'

export interface InteractionEvent {
  id: string
  timestamp: string
  offsetMs: number
  kind: InteractionKind
  screen: string
  label: string
  detail: string | null
  analyticsEvent: string | null
}
