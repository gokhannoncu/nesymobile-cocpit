// ============================================================================
// Debug View — Live ADB Types
// ============================================================================
// Real device data types returned by /api/adb/* route handlers.
// Live equivalent of DeviceRuntime in mock types.ts: fields that cannot be
// read via ADB can be null (e.g. Firebase prefs in release build).

import type {
  CellularInfo,
  DbTableInfo,
  DbgSchedule,
  NetworkTransport,
  OsInfo,
  RequestRow,
  WifiInfo,
} from './types'

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
  /** null when dumpsys did not return a level; an unreadable value must never look like 0%. */
  level: number | null
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

// ============================================================================
// Operational Readiness (/api/adb/health)
// ============================================================================
// A decision-oriented health snapshot that answers "is the courier app ready to
// work right now, and is there data-loss risk?" — composed from the runtime,
// schedule and database reads plus a few dedicated ADB probes.

/** Traffic-light verdict for a single signal, a card, or the whole device. */
export type HealthVerdict = 'ready' | 'attention' | 'blocked' | 'unknown'

/** One measured (or not-measured) fact inside a decision card. */
export interface HealthSignal {
  id: string
  label: string
  /** Human-readable value; use '—' style when unmeasured. */
  value: string
  verdict: HealthVerdict
  hint: string | null
  /** false when the value could not be read over ADB (shown as "Not measured"). */
  measured: boolean
}

export type HealthCardId =
  | 'environment'
  | 'session'
  | 'sync'
  | 'location'
  | 'backend'

/** A single decision card in the readiness grid. */
export interface HealthCard {
  id: HealthCardId
  title: string
  verdict: HealthVerdict
  /** One-line summary shown under the title. */
  headline: string
  signals: HealthSignal[]
}

/** A top-of-screen blocker/warning surfaced from the worst signals. */
export interface HealthBlocker {
  card: HealthCardId
  severity: 'blocked' | 'attention'
  message: string
}

/** Root object feeding the Operational Readiness screen. */
export interface OperationalHealthSnapshot {
  serial: string
  packageName: string | null
  capturedAt: string
  /** true only when the selected capture mode explicitly stopped the app. */
  appStopped: boolean
  overall: HealthVerdict
  blockers: HealthBlocker[]
  cards: HealthCard[]
  /** Environment banner details (also mirrored inside the environment card). */
  meta: {
    versionName: string | null
    versionCode: number | null
    flavor: string | null
    environment: string | null
    apiHost: string | null
    debuggable: boolean
    androidVersion: string
    apiLevel: number
  }
  warnings: string[]
}

/** /api/adb/devices response envelope. */
export interface AdbDevicesResponse {
  adbAvailable: boolean
  adbPath: string | null
  error: string | null
  devices: import('@/data/engineering/device-lab/device-lab-types').ConnectedDevice[]
}

export type LiveDatabaseValue = string | number | null

export interface LiveDatabaseColumn {
  cid: number
  name: string
  type: string
  notNull: boolean
  defaultValue: string | null
  primaryKeyPosition: number
}

export interface LiveDatabaseTableData {
  tableName: string
  columns: LiveDatabaseColumn[]
  rows: Record<string, LiveDatabaseValue>[]
  totalRows: number
  limit: number
  truncated: boolean
}

/**
 * A read-only Room database snapshot pulled from a debuggable app with adb
 * run-as. The main database and its WAL sidecars are queried together so the
 * response includes writes that have not been checkpointed yet.
 */
export interface LiveDatabaseSnapshot {
  serial: string
  packageName: string
  capturedAt: string
  databaseName: string
  databasePath: string
  version: number
  journalMode: string
  sizeBytes: number
  walSizeBytes: number
  shmSizeBytes: number
  tables: DbTableInfo[]
  tableData: LiveDatabaseTableData | null
  requestRows: RequestRow[]
  completedRequestCount: number
}

// ---------------------------------------------------------------------------
// Live Screen State — what fragment is on screen right now
// ---------------------------------------------------------------------------

/** Coarse androidx Fragment lifecycle bucket derived from the numeric mState. */
export type FragmentLifecycle =
  | 'RESUMED'
  | 'STARTED'
  | 'VIEW_CREATED'
  | 'CREATED'
  | 'ATTACHED'
  | 'INITIALIZING'
  | 'UNKNOWN'

/** One fragment parsed from the MainActivity FragmentManager dump. */
export interface LiveFragmentNode {
  /** Class name, e.g. "StopListFragment". */
  className: string
  /** Fragment UUID (mWho) — stable identity across a poll cycle. */
  who: string
  /** mTag when the fragment was added with a tag. */
  tag: string | null
  /** Coarse lifecycle bucket. */
  lifecycle: FragmentLifecycle
  /** Raw androidx mState (7 = RESUMED). */
  stateCode: number
  /** DialogFragment / BottomSheet overlay rather than a full nav destination. */
  isDialog: boolean
  /** Document order under the NavHost — used as a rough back-stack depth. */
  order: number
}

/**
 * One in-memory state field read from the app's debug dump hook. `value` keeps
 * the raw JSON shape — scalars are shown inline, while objects and arrays keep
 * their full structure so the UI can expand them into pretty-printed JSON.
 */
export interface LiveScreenField {
  name: string
  value: unknown
  /** JSON type of the value, driving inline vs. expandable rendering. */
  kind: 'string' | 'number' | 'boolean' | 'null' | 'object' | 'array'
  /** Item/key count for array/object values (for a collapsed preview). */
  count: number | null
  /** `shared` = activity-scoped SharedViewModel; `screen` = the fragment's own state. */
  group: 'shared' | 'screen'
}

/**
 * The live "what screen is open right now" snapshot, parsed from
 * `dumpsys activity top`. Framework state (fragment, lifecycle, controls,
 * services) is always present. The in-memory `fields` are populated only when
 * the installed build exposes the debug dump hook (`stateInstrumented`).
 */
export interface LiveScreenState {
  serial: string
  packageName: string | null
  capturedAt: string
  /** NesyMobile is the resumed (top) app on the device. */
  appForeground: boolean
  /** Single-activity host, e.g. "MainActivity". */
  activityName: string | null
  /** Resource entry name of the nav host container, e.g. "nav_host". */
  navHostId: string | null
  /** Active screen: the top-most resumed nav destination fragment. */
  current: LiveFragmentNode | null
  /** Dialog / bottom-sheet fragment overlaid on top of `current`, if any. */
  overlay: LiveFragmentNode | null
  /** All app fragments parsed from the dump, in document order. */
  fragments: LiveFragmentNode[]
  /** Interactive view resource-entry names visible in MainActivity's hierarchy. */
  visibleControls: string[]
  /** NesyMobile foreground/background services currently running. */
  runningServices: string[]
  /** True when the installed build exposed its in-memory state via the dump hook. */
  stateInstrumented: boolean
  /** Live in-memory ViewModel/screen fields (empty unless `stateInstrumented`). */
  fields: LiveScreenField[]
  /** Populated when `current` is null (app backgrounded, no NavHost, etc.). */
  reason: string | null
}

/** Parsed Schedule + ScheduleStopChunk tree from one live Room DB/WAL/SHM copy. */
export interface LiveScheduleSnapshot {
  serial: string
  packageName: string
  capturedAt: string
  databaseName: string
  databasePath: string
  sizeBytes: number
  walSizeBytes: number
  shmSizeBytes: number
  scheduleRowCount: number
  stopChunkCount: number
  schedule: DbgSchedule | null
  warnings: string[]
}
