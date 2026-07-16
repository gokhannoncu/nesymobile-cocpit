// Device Lab — Log capture presets, mock data and helper functions.
// Reference release: 8.4.60 · Date: 2026-07-12

import type {
  CapturePreset,
  LogEvent,
  LogLevel,
  LogSource,
  CorrelationRule,
  PrivacyRule,
  CaptureMode,
  TimeRange,
} from './device-lab-types'
import type { Tone } from '@/components/product'

// ── LOG_SOURCE_META ─────────────────────────────────────────────────

export const LOG_SOURCE_META: Record<
  LogSource,
  { label: string; tone: Tone; description: string; tags: string[] }
> = {
  app: {
    label: 'App Process',
    tone: 'blue',
    description: 'NesyMobile main app logs',
    tags: ['NesyApp', 'MainActivity', 'ViewModel'],
  },
  system: {
    label: 'System',
    tone: 'gray',
    description: 'Android system logs',
    tags: ['System', 'ActivityManager', 'WindowManager'],
  },
  network: {
    label: 'Network',
    tone: 'teal',
    description: 'Network requests and responses',
    tags: ['Retrofit', 'NetworkInterceptor'],
  },
  okhttp: {
    label: 'OkHttp',
    tone: 'teal',
    description: 'HTTP client logs',
    tags: ['OkHttp', 'HttpLogging'],
  },
  'offline-queue': {
    label: 'Offline Queue',
    tone: 'amber',
    description: 'Offline queue operations',
    tags: ['RequestSender', 'QueueManager', 'OfflineSync'],
  },
  fiscal: {
    label: 'Fiscal',
    tone: 'purple',
    description: 'Fiscalization operations',
    tags: ['FiscalService', 'FiscalManager'],
  },
  scanner: {
    label: 'Scanner',
    tone: 'indigo',
    description: 'Barcode scanner events',
    tags: ['BarcodeScanner', 'CameraScanner'],
  },
  location: {
    label: 'Location',
    tone: 'green',
    description: 'Location service logs',
    tags: ['LocationService', 'GPSProvider'],
  },
  payment: {
    label: 'Payment',
    tone: 'orange',
    description: 'Payment operation logs',
    tags: ['PaymentManager', 'PaymentProvider'],
  },
  crash: {
    label: 'Crash',
    tone: 'red',
    description: 'Crash and ANR logs',
    tags: ['AndroidRuntime', 'FATAL', 'ANR'],
  },
  workmanager: {
    label: 'WorkManager',
    tone: 'blue',
    description: 'Background work manager',
    tags: ['WorkManager', 'ScheduledWork'],
  },
  firebase: {
    label: 'Firebase',
    tone: 'amber',
    description: 'Firebase and FCM logs',
    tags: ['FirebaseMessaging', 'FCM'],
  },
  room: {
    label: 'Room DB',
    tone: 'purple',
    description: 'Database operation logs',
    tags: ['RoomDatabase', 'SQLite'],
  },
}

// ── LOG_LEVEL_META ──────────────────────────────────────────────────

export const LOG_LEVEL_META: Record<
  LogLevel,
  { label: string; tone: Tone; shortLabel: string }
> = {
  verbose: { label: 'Verbose', tone: 'gray', shortLabel: 'V' },
  debug: { label: 'Debug', tone: 'blue', shortLabel: 'D' },
  info: { label: 'Info', tone: 'green', shortLabel: 'I' },
  warn: { label: 'Warning', tone: 'amber', shortLabel: 'W' },
  error: { label: 'Error', tone: 'red', shortLabel: 'E' },
  fatal: { label: 'Fatal', tone: 'red', shortLabel: 'F' },
}

// ── CAPTURE_MODE_META ───────────────────────────────────────────────

const ALL_SOURCES: LogSource[] = [
  'app', 'system', 'network', 'okhttp', 'offline-queue', 'fiscal',
  'scanner', 'location', 'payment', 'crash', 'workmanager', 'firebase', 'room',
]

export const CAPTURE_MODE_META: Record<
  CaptureMode,
  { label: string; description: string; icon: string; defaultSources: LogSource[] }
> = {
  quick: {
    label: 'Quick Diagnostic',
    description: 'Quick diagnostic — main app and error logs',
    icon: 'Zap',
    defaultSources: ['app', 'crash'],
  },
  'app-session': {
    label: 'App Session',
    description: 'Full app session capture',
    icon: 'AppWindow',
    defaultSources: ['app', 'network', 'okhttp', 'room'],
  },
  'specific-flow': {
    label: 'Specific Flow',
    description: 'Monitor specific workflow',
    icon: 'GitBranch',
    defaultSources: ['app', 'network'],
  },
  'crash-anr': {
    label: 'Crash & ANR',
    description: 'Crash and unresponsive analysis',
    icon: 'Bug',
    defaultSources: ['crash', 'system', 'app'],
  },
  'full-diagnostic': {
    label: 'Full Device Diagnostic',
    description: 'Full diagnostic covering all sources',
    icon: 'Scan',
    defaultSources: [...ALL_SOURCES],
  },
  custom: {
    label: 'Custom',
    description: 'Custom source and filter selection',
    icon: 'Settings',
    defaultSources: [],
  },
}

// ── TIME_RANGE_OPTIONS ──────────────────────────────────────────────

export const TIME_RANGE_OPTIONS: { value: TimeRange; label: string }[] = [
  { value: 'now', label: 'Now (live)' },
  { value: 'last-5m', label: 'Last 5 minutes' },
  { value: 'last-15m', label: 'Last 15 minutes' },
  { value: 'last-30m', label: 'Last 30 minutes' },
  { value: 'last-1h', label: 'Last 1 hour' },
  { value: 'custom', label: 'Custom range…' },
]

// ── CAPTURE_PRESETS ─────────────────────────────────────────────────

export const CAPTURE_PRESETS: CapturePreset[] = [
  {
    id: 'startup-login',
    label: 'Startup & Login',
    description: 'App startup, token verification and login flow logs',
    icon: 'LogIn',
    sources: ['app', 'network', 'okhttp'],
    levels: ['debug', 'info', 'warn', 'error', 'fatal'],
    tags: ['TokenManager', 'LoginActivity', 'AuthInterceptor', 'HostSelector'],
    expectedEvents: ['app_start', 'token_check', 'login_api', 'host_selection', 'session_created'],
    captureMode: 'specific-flow',
    bufferSizeKb: 2048,
    maxDurationMin: 5,
  },
  {
    id: 'schedule-stoplist',
    label: 'Schedule & Stop List',
    description: 'Route schedule download, stop list and FCM trigger logs',
    icon: 'CalendarDays',
    sources: ['app', 'network', 'room'],
    levels: ['debug', 'info', 'warn', 'error', 'fatal'],
    tags: ['ScheduleRepository', 'RoomDao', 'JsonParser', 'FCMHandler'],
    expectedEvents: ['fcm_received', 'schedule_api', 'json_parse', 'room_write', 'ui_update'],
    captureMode: 'specific-flow',
    bufferSizeKb: 4096,
    maxDurationMin: 10,
  },
  {
    id: 'delivery-flow',
    label: 'Delivery Flow',
    description: 'Complete delivery flow — including payment, fiscalization, offline queue',
    icon: 'Truck',
    sources: ['app', 'network', 'payment', 'fiscal', 'offline-queue', 'room'],
    levels: ['debug', 'info', 'warn', 'error', 'fatal'],
    tags: [
      'DeliveryViewModel', 'PaymentManager', 'FiscalService',
      'RequestSenderService', 'RoomDao', 'NetworkInterceptor',
    ],
    expectedEvents: [
      'delivery_started', 'shipment_loaded', 'payment_initiated',
      'payment_completed', 'fiscal_created', 'fiscal_completed',
      'delivery_saved', 'request_enqueued', 'request_completed',
    ],
    captureMode: 'specific-flow',
    bufferSizeKb: 8192,
    maxDurationMin: 15,
  },
  {
    id: 'payment-fiscal',
    label: 'Payment & Fiscal',
    description: 'Payment provider and fiscalization integration logs',
    icon: 'CreditCard',
    sources: ['payment', 'fiscal', 'network'],
    levels: ['debug', 'info', 'warn', 'error', 'fatal'],
    tags: ['PaymentManager', 'PaymentProvider', 'FiscalService', 'FiscalManager'],
    expectedEvents: [
      'payment_initiated', 'provider_callback', 'payment_completed',
      'fiscal_create', 'fiscal_sign', 'fiscal_completed',
    ],
    captureMode: 'specific-flow',
    bufferSizeKb: 4096,
    maxDurationMin: 10,
  },
  {
    id: 'offline-queue',
    label: 'Offline Queue',
    description: 'Offline request queue, network transition and synchronization logs',
    icon: 'CloudOff',
    sources: ['offline-queue', 'network', 'room'],
    levels: ['debug', 'info', 'warn', 'error', 'fatal'],
    tags: ['RequestSenderService', 'QueueManager', 'OfflineSync', 'NetworkCallback'],
    expectedEvents: [
      'request_enqueued', 'network_available', 'request_started',
      'request_completed', 'queue_drained',
    ],
    captureMode: 'specific-flow',
    bufferSizeKb: 4096,
    maxDurationMin: 30,
  },
  {
    id: 'barcode-scan',
    label: 'Barcode & Scan',
    description: 'Barcode scanner hardware events and app response logs',
    icon: 'ScanBarcode',
    sources: ['scanner', 'app'],
    levels: ['debug', 'info', 'warn', 'error', 'fatal'],
    tags: ['BarcodeScanner', 'CameraScanner', 'ScannerManager', 'HardwareScanner'],
    expectedEvents: ['scanner_init', 'scan_triggered', 'barcode_decoded', 'scan_result_handled'],
    captureMode: 'specific-flow',
    bufferSizeKb: 2048,
    maxDurationMin: 5,
  },
  {
    id: 'd4me-locker',
    label: 'D4Me / Locker',
    description: 'D4Me locker integration and BLE communication logs',
    icon: 'Lock',
    sources: ['app', 'network'],
    levels: ['debug', 'info', 'warn', 'error', 'fatal'],
    tags: ['D4MeManager', 'LockerService', 'BLEConnector', 'LockerAPI'],
    expectedEvents: ['locker_search', 'ble_connect', 'locker_open', 'delivery_confirm'],
    captureMode: 'specific-flow',
    bufferSizeKb: 2048,
    maxDurationMin: 10,
  },
  {
    id: 'location',
    label: 'Location',
    description: 'Location service, GPS provider and geofence logs',
    icon: 'MapPin',
    sources: ['location', 'system'],
    levels: ['debug', 'info', 'warn', 'error', 'fatal'],
    tags: ['LocationService', 'GPSProvider', 'FusedLocation', 'GeofenceManager'],
    expectedEvents: ['location_update', 'provider_switch', 'geofence_enter', 'geofence_exit'],
    captureMode: 'specific-flow',
    bufferSizeKb: 2048,
    maxDurationMin: 30,
  },
  {
    id: 'crash-anr',
    label: 'Crash / ANR',
    description: 'Crash, ANR and critical error logs — including stack trace',
    icon: 'Bug',
    sources: ['crash', 'system', 'app'],
    levels: ['warn', 'error', 'fatal'],
    tags: ['AndroidRuntime', 'FATAL', 'ANR', 'UncaughtExceptionHandler'],
    expectedEvents: ['anr_detected', 'crash_captured', 'stack_trace_logged', 'crash_report_sent'],
    captureMode: 'crash-anr',
    bufferSizeKb: 16384,
    maxDurationMin: 5,
  },
  {
    id: 'full-investigation',
    label: 'Full Investigation',
    description:
      'Full investigation mode covering all sources — high data volume warning: ' +
      'can produce 50,000+ events per hour',
    icon: 'SearchCode',
    sources: [...ALL_SOURCES],
    levels: ['verbose', 'debug', 'info', 'warn', 'error', 'fatal'],
    tags: [],
    expectedEvents: [],
    captureMode: 'full-diagnostic',
    bufferSizeKb: 65536,
    maxDurationMin: 60,
  },
]

// ── CORRELATION_RULES ───────────────────────────────────────────────

export const CORRELATION_RULES: CorrelationRule[] = [
  {
    id: 'delivery-flow',
    label: 'Delivery Flow',
    description: 'Verifies all steps of delivery flow with correlation',
    expectedEvents: [
      { event: 'delivery_started', required: true },
      { event: 'payment_completed', required: true },
      { event: 'fiscal_created', required: true },
      { event: 'delivery_saved', required: true },
      { event: 'request_completed', required: true },
    ],
    analysisTemplate:
      'Delivery flow analysis: {found}/{total} expected events found. {missing_events}',
  },
  {
    id: 'login-flow',
    label: 'Login Flow',
    description: 'Verifies all steps of login flow with correlation',
    expectedEvents: [
      { event: 'app_start', required: true },
      { event: 'token_check', required: true },
      { event: 'login_api', required: true },
      { event: 'host_selection', required: false },
      { event: 'session_created', required: true },
    ],
    analysisTemplate:
      'Login flow analysis: {found}/{total} expected events found. {missing_events}',
  },
  {
    id: 'offline-sync',
    label: 'Offline Sync',
    description: 'Monitors all steps of offline synchronization loop',
    expectedEvents: [
      { event: 'request_enqueued', required: true },
      { event: 'network_available', required: true },
      { event: 'request_started', required: true },
      { event: 'request_completed', required: true },
    ],
    analysisTemplate:
      'Offline synchronization analysis: {found}/{total} expected events found. {missing_events}',
  },
  {
    id: 'payment-flow',
    label: 'Payment Flow',
    description: 'Verifies payment and fiscalization flow with correlation',
    expectedEvents: [
      { event: 'payment_initiated', required: true },
      { event: 'provider_callback', required: true },
      { event: 'payment_completed', required: true },
      { event: 'fiscal_create', required: true },
    ],
    analysisTemplate:
      'Payment flow analysis: {found}/{total} expected events found. {missing_events}',
  },
  {
    id: 'schedule-refresh',
    label: 'Schedule Refresh',
    description: 'Monitors all steps of route schedule update flow',
    expectedEvents: [
      { event: 'fcm_received', required: true },
      { event: 'schedule_api', required: true },
      { event: 'room_write', required: true },
      { event: 'ui_update', required: true },
    ],
    analysisTemplate:
      'Schedule update analysis: {found}/{total} expected events found. {missing_events}',
  },
]

// ── PRIVACY_RULES ───────────────────────────────────────────────────

export const PRIVACY_RULES: PrivacyRule[] = [
  {
    id: 'access_token',
    label: 'Access Token',
    pattern: 'Bearer [A-Za-z0-9\\-._~+/]+=*',
    replacement: 'Bearer ***REDACTED***',
    enabled: true,
  },
  {
    id: 'refresh_token',
    label: 'Refresh Token',
    pattern: '"refresh_token"\\s*:\\s*"[^"]+"',
    replacement: '"refresh_token": "***REDACTED***"',
    enabled: true,
  },
  {
    id: 'authorization_header',
    label: 'Authorization Header',
    pattern: 'Authorization:\\s*[^\\s]+',
    replacement: 'Authorization: ***REDACTED***',
    enabled: true,
  },
  {
    id: 'cookies',
    label: 'Cookies',
    pattern: 'Cookie:\\s*[^\\n]+',
    replacement: 'Cookie: ***REDACTED***',
    enabled: true,
  },
  {
    id: 'password',
    label: 'Password',
    pattern: '"password"\\s*:\\s*"[^"]+"',
    replacement: '"password": "***REDACTED***"',
    enabled: true,
  },
  {
    id: 'pin',
    label: 'PIN Code',
    pattern: '"pin"\\s*:\\s*"\\d{4,6}"',
    replacement: '"pin": "***REDACTED***"',
    enabled: true,
  },
  {
    id: 'address',
    label: 'Address',
    pattern: '"address"\\s*:\\s*"[^"]+"',
    replacement: '"address": "***REDACTED***"',
    enabled: true,
  },
  {
    id: 'phone_number',
    label: 'Phone Number',
    pattern: '\\+?90\\s?\\d{3}\\s?\\d{3}\\s?\\d{2}\\s?\\d{2}',
    replacement: '+90 *** *** ** **',
    enabled: true,
  },
  {
    id: 'recipient_name',
    label: 'Recipient Name',
    pattern: 'recipient=[A-Za-zÀ-ÿ]+\\s+[A-Za-zÀ-ÿ]+',
    replacement: 'recipient=***REDACTED***',
    enabled: true,
  },
  {
    id: 'card_data',
    label: 'Card Data',
    pattern: '\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}[\\s-]?\\d{4}',
    replacement: '**** **** **** ****',
    enabled: true,
  },
  {
    id: 'api_secret',
    label: 'API Secret',
    pattern: '"api_secret"\\s*:\\s*"[^"]+"',
    replacement: '"api_secret": "***REDACTED***"',
    enabled: true,
  },
  {
    id: 'device_imei',
    label: 'Device IMEI',
    pattern: 'IMEI[=:]\\s?\\d{15}',
    replacement: 'IMEI=***REDACTED***',
    enabled: true,
  },
]

// ── SYSTEM_DUMP_OPTIONS ─────────────────────────────────────────────

export const SYSTEM_DUMP_OPTIONS: {
  id: string
  label: string
  command: string
  description: string
  heavy: boolean
}[] = [
  {
    id: 'dumpsys-package',
    label: 'Package Info',
    command: 'dumpsys package com.nesymobile',
    description: 'App package info, permissions and version details',
    heavy: false,
  },
  {
    id: 'dumpsys-activity-stack',
    label: 'Activity Stack',
    command: 'dumpsys activity activities | grep -A 20 com.nesymobile',
    description: 'Current activity stack and task state',
    heavy: false,
  },
  {
    id: 'dumpsys-meminfo',
    label: 'Memory Info',
    command: 'dumpsys meminfo com.nesymobile',
    description: 'Memory usage details (PSS, private dirty, heap)',
    heavy: false,
  },
  {
    id: 'dumpsys-battery',
    label: 'Battery Stats',
    command: 'dumpsys batterystats --charged com.nesymobile',
    description: 'Battery consumption statistics',
    heavy: true,
  },
  {
    id: 'dumpsys-netstats',
    label: 'Network Stats',
    command: 'dumpsys netstats detail | grep -A 10 com.nesymobile',
    description: 'Network usage statistics (mobile/Wi-Fi)',
    heavy: false,
  },
  {
    id: 'dumpsys-jobscheduler',
    label: 'Job Scheduler',
    command: 'dumpsys jobscheduler | grep -A 5 com.nesymobile',
    description: 'Scheduled job states and constraints',
    heavy: false,
  },
  {
    id: 'dumpsys-alarm',
    label: 'Alarm Manager',
    command: 'dumpsys alarm | grep -A 5 com.nesymobile',
    description: 'Alarm and timer records',
    heavy: false,
  },
  {
    id: 'dumpsys-connectivity',
    label: 'Connectivity',
    command: 'dumpsys connectivity',
    description: 'Connection status and network capabilities',
    heavy: false,
  },
  {
    id: 'dumpsys-location',
    label: 'Location Provider',
    command: 'dumpsys location',
    description: 'Location provider status and last known location',
    heavy: false,
  },
  {
    id: 'dumpsys-gfxinfo',
    label: 'Graphics Info',
    command: 'dumpsys gfxinfo com.nesymobile framestats',
    description: 'Frame render times and jank statistics',
    heavy: true,
  },
  {
    id: 'bugreport',
    label: 'Full Bug Report',
    command: 'bugreportz',
    description: 'Full system bug report (ZIP) — heavy, may take 2-5 minutes',
    heavy: true,
  },
  {
    id: 'logcat-crash',
    label: 'Crash Buffer',
    command: 'logcat -b crash -d',
    description: 'Crash buffer logs (only crash buffer)',
    heavy: false,
  },
]

// ── INVESTIGATION_CONTEXT_FIELDS ────────────────────────────────────

export const INVESTIGATION_CONTEXT_FIELDS: {
  key: string
  label: string
  placeholder: string
  icon: string
}[] = [
  { key: 'shipmentId', label: 'Shipment ID', placeholder: 'SHP-442', icon: 'Package' },
  { key: 'courierId', label: 'Courier ID', placeholder: 'CRR-1001', icon: 'User' },
  { key: 'scheduleId', label: 'Schedule ID', placeholder: 'SCH-20260712', icon: 'Calendar' },
  { key: 'requestId', label: 'Request ID', placeholder: 'req-7801', icon: 'Send' },
  { key: 'fiscalId', label: 'Receipt ID', placeholder: 'FSC-88201', icon: 'Receipt' },
  { key: 'errorCode', label: 'Error Code', placeholder: 'ERR_TIMEOUT', icon: 'AlertTriangle' },
  { key: 'ticketId', label: 'Ticket ID', placeholder: 'TK-2290', icon: 'Ticket' },
  { key: 'incidentId', label: 'Incident ID', placeholder: 'INC-0087', icon: 'Siren' },
]

// ── Helper Functions ────────────────────────────────────────────────

export function filterLogEvents(
  events: LogEvent[],
  opts: { levels?: LogLevel[]; sources?: LogSource[]; search?: string },
): LogEvent[] {
  return events.filter((e) => {
    if (opts.levels && opts.levels.length > 0 && !opts.levels.includes(e.level)) return false
    if (opts.sources && opts.sources.length > 0 && !opts.sources.includes(e.source)) return false
    if (opts.search) {
      const q = opts.search.toLowerCase()
      return (
        e.message.toLowerCase().includes(q) ||
        e.tag.toLowerCase().includes(q) ||
        e.id.toLowerCase().includes(q) ||
        (e.shipmentId?.toLowerCase().includes(q) ?? false) ||
        (e.requestId?.toLowerCase().includes(q) ?? false)
      )
    }
    return true
  })
}

export function getPresetById(id: string): CapturePreset | undefined {
  return CAPTURE_PRESETS.find((p) => p.id === id)
}

export function matchCorrelation(
  events: LogEvent[],
  rule: CorrelationRule,
): { event: string; found: boolean }[] {
  const messages = events.map((e) => e.message.toLowerCase())
  return rule.expectedEvents.map((expected) => ({
    event: expected.event,
    found: messages.some((m) => m.includes(expected.event.replace(/_/g, ' ')) || m.includes(expected.event)),
  }))
}
