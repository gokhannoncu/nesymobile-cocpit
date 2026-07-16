// ============================================================================
// Device Lab – Shared Types
// ============================================================================

// === Device Types ===

export type DeviceStatus =
  | 'connected'
  | 'unauthorized'
  | 'offline'
  | 'app-not-installed'
  | 'incompatible-build'
  | 'busy'

export type TransportType = 'usb' | 'wifi'

export type BuildType = 'debug' | 'internal' | 'release' | 'production'

export type ConfigType = 'production' | 'staging' | 'development'

/**
 * Represents the current status information of an Android device
 * connected via ADB or previously connected. Physical devices and emulators
 * are represented with the same structure.
 */
export interface ConnectedDevice {
  id: string
  name: string
  serial: string
  isPhysical: boolean
  androidVersion: string
  apiLevel: number
  appInstalled: boolean
  appVersion: string | null
  isDebuggable: boolean
  status: DeviceStatus
  transport: TransportType
  buildType: BuildType | null
  configType: ConfigType | null
  batteryLevel: number
  lastUsed: string
  country: string | null
}

// === Scenario Types ===

export type RiskLevel = 'safe' | 'caution' | 'destructive'

export type BuildCompatibility = 'debug' | 'internal' | 'any' | 'root'

export type DeviceRequirement = 'any' | 'physical' | 'emulator'

export type ScenarioCategory =
  | 'schedule'
  | 'auth'
  | 'shared-prefs'
  | 'room-db'
  | 'offline-sync'
  | 'lifecycle'
  | 'permission'
  | 'diagnostic'

export type ParamType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'select'
  | 'multiselect'

/**
 * Represents a parameter definition to be obtained from the user before
 * running the scenario. The `options` field is required for `select` and
 * `multiselect` types.
 */
export interface ScenarioParam {
  key: string
  label: string
  type: ParamType
  required: boolean
  defaultValue: any
  options?: { label: string; value: string }[]
  hint?: string
}

/**
 * Pre-check step to be performed before running the scenario.
 * Represents conditions such as "is the app installed on the device?" or
 * "is it a debug build?".
 */
export interface PreflightCheck {
  id: string
  label: string
  description: string
  required: boolean
}

/**
 * A single command step to be executed via ADB or shell.
 * The `command` field contains the actual terminal command.
 */
export interface ScenarioCommand {
  step: number
  label: string
  command: string
  description: string
}

/**
 * Verification step to check the change after the scenario is completed.
 * It can optionally include a query.
 */
export interface VerificationStep {
  step: number
  label: string
  description: string
  query?: string
}

/**
 * Step to be used to revert the change made.
 * Every scenario must include at least one rollback step.
 */
export interface RollbackStep {
  label: string
  command: string
  description: string
}

/**
 * Main structure that covers the entire definition of a single ADB scenario.
 * It contains parameters, commands, verification steps, and rollback instructions together.
 */
export interface ScenarioPackage {
  id: string
  name: string
  description: string
  category: ScenarioCategory
  riskLevel: RiskLevel
  buildCompatibility: BuildCompatibility
  deviceRequirement: DeviceRequirement
  requiresRoot: boolean
  supportedPackages: string[]
  supportedAndroidVersions: string
  parameters: ScenarioParam[]
  preflightChecks: string[]
  commands: ScenarioCommand[]
  verificationSteps: VerificationStep[]
  rollbackSteps: RollbackStep[]
  /** Estimated execution time (seconds) */
  estimatedDuration: number
  lastVerifiedVersion: string
  lastVerifiedAt: string
  owner: string
  reviewer: string
  version: string
  isFavorite: boolean
  executionCount: number
  tags: string[]
}

/**
 * Meta information required for displaying the scenario category in the UI
 * (icon, label, description, scenario count).
 */
export interface CategoryInfo {
  id: ScenarioCategory
  label: string
  description: string
  icon: string
  scenarioCount: number
}

// === Run Types ===

export type RunStatus = 'pending' | 'running' | 'success' | 'partial' | 'failed'

export type StepStatus = 'waiting' | 'running' | 'completed' | 'failed' | 'skipped'

/**
 * Used to track the current status and output of each command step
 * while the scenario is running.
 */
export interface RunStep {
  step: number
  label: string
  status: StepStatus
  output?: string
  startedAt?: string
  completedAt?: string
}

/**
 * Holds all record information of a completed or ongoing scenario run.
 * Includes parameter values, previous/new values, terminal output,
 * and rollback status.
 */
export interface ExecutionRecord {
  id: string
  scenarioId: string
  scenarioName: string
  deviceId: string
  deviceName: string
  user: string
  startedAt: string
  completedAt: string | null
  status: RunStatus
  steps: RunStep[]
  parameters: Record<string, any>
  previousValues: Record<string, any>
  newValues: Record<string, any>
  terminalOutput: string
  linkedSessionId: string | null
  rollbackAvailable: boolean
}

// === Log Types ===

export type LogLevel = 'verbose' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export type LogSource =
  | 'app'
  | 'system'
  | 'network'
  | 'okhttp'
  | 'offline-queue'
  | 'fiscal'
  | 'scanner'
  | 'location'
  | 'payment'
  | 'crash'
  | 'workmanager'
  | 'firebase'
  | 'room'

export type CaptureMode =
  | 'quick'
  | 'app-session'
  | 'specific-flow'
  | 'crash-anr'
  | 'full-diagnostic'
  | 'custom'

export type SessionStatus = 'capturing' | 'paused' | 'stopped' | 'saved'

export type TimeRange = 'now' | 'last-5m' | 'last-15m' | 'last-30m' | 'last-1h' | 'custom'

/** Logcat ring buffer a line came from. */
export type LogBuffer = 'main' | 'system' | 'crash' | 'radio' | 'events' | 'kernel'

/**
 * A single parsed logcat line. Produced by the server-side logcat parser
 * (`epoch,uid` format), streamed to the client, and persisted verbatim.
 */
export interface LogEvent {
  id: string
  /** ISO timestamp derived from the logcat epoch. */
  timestamp: string
  /** Epoch milliseconds — used for ordering, dedup and time-range queries. */
  epochMs: number
  source: LogSource
  level: LogLevel
  tag: string
  message: string
  processId: number
  threadId: number
  /** Linux uid of the emitting process (null when logcat reports a symbolic uid). */
  uid: number | null
  /** Resolved package name when the uid maps to the NesyMobile app. */
  packageName: string | null
  /** Ring buffer the line came from. */
  buffer: LogBuffer
  threadName?: string
  correlationId?: string
  shipmentId?: string
  requestId?: string
  fiscalId?: string
  stackTrace?: string
  raw: string
}

/**
 * Timestamp marker added to the log stream. Can be added by the user
 * or automatically; can be associated with an ADB run.
 */
export interface LogMarker {
  id: string
  timestamp: string
  label: string
  type: 'user' | 'auto' | 'adb-run'
  linkedRunId?: string
}

/**
 * Predefined capture preset. Field names match the CAPTURE_PRESETS fixture
 * exactly so components consume it without casts.
 */
export interface CapturePreset {
  id: string
  label: string
  description: string
  icon: string
  sources: LogSource[]
  levels: LogLevel[]
  tags: string[]
  expectedEvents: string[]
  captureMode: CaptureMode
  bufferSizeKb: number
  maxDurationMin: number
}

/** Correlation rule — matches the CORRELATION_RULES fixture shape. */
export interface CorrelationRule {
  id: string
  label: string
  description: string
  expectedEvents: { event: string; required: boolean }[]
  analysisTemplate: string
}

/** Privacy redaction rule — matches the PRIVACY_RULES fixture shape. */
export interface PrivacyRule {
  id: string
  label: string
  /** Source regex applied (global, case-insensitive) to text during export. */
  pattern: string
  replacement: string
  enabled: boolean
}

// === Capture / stream / storage contract ===

/** What a capture run asks the logcat stream for. */
export interface LogCaptureConfig {
  serial: string
  /** `live` follows new lines; `buffer` reads a bounded window then completes. */
  mode: 'live' | 'buffer'
  sources: LogSource[]
  levels: LogLevel[]
  timeRange: TimeRange
  /** ISO start for backfill/custom (null = live only). */
  from: string | null
  /** ISO end for a custom buffer read (null = open-ended / live). */
  to: string | null
  captureMode: CaptureMode
  presetId: string | null
}

/** Discriminated SSE payload sent on the default message channel. */
export type LogStreamEnvelope =
  | { type: 'ready'; serial: string; packageName: string | null; uid: number | null; startedAt: string }
  | { type: 'log'; event: LogEvent }
  | { type: 'complete'; reason: string; total: number; lastTimestamp: string | null }
  | { type: 'error'; code: string; message: string; retryable: boolean }

export type StoredSessionStatus = 'capturing' | 'stopped' | 'interrupted' | 'saved'

/** Device identity snapshot embedded in a stored session. */
export interface SessionDeviceInfo {
  serial: string
  name: string
  androidVersion: string
  appVersion: string | null
  packageName: string | null
}

/** IndexedDB `sessions` record — metadata only; events live in chunks. */
export interface StoredLogSession {
  id: string
  device: SessionDeviceInfo
  config: LogCaptureConfig
  status: StoredSessionStatus
  startedAt: string
  stoppedAt: string | null
  eventCount: number
  markers: LogMarker[]
  context: Record<string, string>
  presetId: string | null
  presetLabel: string | null
  linkedRunId: string | null
}

/** IndexedDB `eventChunks` record — up to 500 events keyed by [sessionId, chunkIndex]. */
export interface StoredEventChunk {
  sessionId: string
  chunkIndex: number
  events: LogEvent[]
}

/** Manifest entry describing one privacy rule's effect during export. */
export interface MaskManifestEntry {
  ruleId: string
  label: string
  hits: number
}

export type BundleFormat = 'zip' | 'json' | 'txt'

/** IndexedDB `bundles` record — a locally generated diagnostic package. */
export interface StoredLogBundle {
  id: string
  sessionId: string
  createdAt: string
  format: BundleFormat
  filename: string
  sizeBytes: number
  eventCount: number
  deviceName: string
  blob: Blob
  maskManifest: MaskManifestEntry[]
}
