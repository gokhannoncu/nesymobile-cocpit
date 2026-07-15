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

export type TimeRange = 'now' | '5min' | '15min' | '1hour' | 'app-start' | 'custom'

/**
 * Represents a single log line captured from Logcat.
 * Includes process/thread info, correlation IDs, and raw text.
 */
export interface LogEvent {
  id: string
  timestamp: string
  source: LogSource
  level: LogLevel
  tag: string
  message: string
  processId: number
  threadId: number
  threadName: string
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
 * Predefined log capture preset for a specific flow or error type.
 * Includes source filters, expected events, and anomaly hints.
 */
export interface CapturePreset {
  id: string
  name: string
  description: string
  sources: LogSource[]
  tags: string[]
  levels: LogLevel[]
  expectedEvents: string[]
  anomalyHints: string[]
  systemDumps: string[]
  icon: string
}

/**
 * Log capture session started from a device.
 * Covers start/end times, event count, markers, and sharing info.
 */
export interface LogSession {
  id: string
  deviceId: string
  deviceName: string
  presetId: string | null
  presetName: string | null
  status: SessionStatus
  startedAt: string
  stoppedAt: string | null
  /** Session duration (seconds) */
  duration: number
  eventCount: number
  createdBy: string
  markers: LogMarker[]
  context: Record<string, string>
  sharedTo: string | null
}

/**
 * Rule definition used to correlate multiple log events within a workflow.
 * Includes expected events and analysis template.
 */
export interface CorrelationRule {
  id: string
  name: string
  flow: string
  expectedEvents: { event: string; required: boolean }[]
  analysisTemplate: string
}

/**
 * Privacy rule used for masking sensitive data during log sharing.
 */
export interface PrivacyRule {
  id: string
  field: string
  pattern: string
  replacement: string
  description: string
}

/**
 * Export and sharing configuration of the log session.
 * Includes settings like format, access level, and time limit.
 */
export interface ShareConfig {
  contents: string[]
  format: 'link' | 'zip' | 'plaintext' | 'ticket' | 'incident'
  access: 'internal' | 'team' | 'public'
  expiryDays: 7 | 30 | null
  auditEnabled: boolean
}
