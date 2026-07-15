// Device Lab — Log capture presets, mock data and helper functions.
// Reference release: 8.4.60 · Date: 2026-07-12

import type {
  CapturePreset,
  LogEvent,
  LogSession,
  LogLevel,
  LogSource,
  CorrelationRule,
  PrivacyRule,
  LogMarker,
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

// ── MOCK_LOG_EVENTS ─────────────────────────────────────────────────
// Scenario: 5-minute slice of a delivery session (10:58–11:03).
// Courier Gokhan, DT50 device, SHP-442 shipment.

export const MOCK_LOG_EVENTS: LogEvent[] = [
  // ── 10:58:00-14 — Transition to delivery screen, loading shipment data ──
  { id: 'evt-001', timestamp: '2026-07-12T10:58:00.120+03:00', source: 'app', level: 'info', tag: 'NesyApp', message: 'Navigating to DeliveryFragment', processId: 12847, threadId: 12847, threadName: 'main', shipmentId: 'SHP-442', raw: '07-12 10:58:00.120 12847 12847 I NesyApp  : Navigating to DeliveryFragment' },
  { id: 'evt-002', timestamp: '2026-07-12T10:58:00.350+03:00', source: 'app', level: 'debug', tag: 'DeliveryViewModel', message: 'loadShipment(SHP-442) called', processId: 12847, threadId: 12847, threadName: 'main', shipmentId: 'SHP-442', raw: '07-12 10:58:00.350 12847 12847 D DeliveryViewModel: loadShipment(SHP-442) called' },
  { id: 'evt-003', timestamp: '2026-07-12T10:58:01.010+03:00', source: 'room', level: 'debug', tag: 'RoomDao', message: 'SELECT * FROM shipments WHERE id = "SHP-442"', processId: 12847, threadId: 12912, threadName: 'worker-1', shipmentId: 'SHP-442', raw: '07-12 10:58:01.010 12847 12912 D RoomDao  : SELECT * FROM shipments WHERE id = "SHP-442"' },
  { id: 'evt-004', timestamp: '2026-07-12T10:58:01.085+03:00', source: 'room', level: 'debug', tag: 'RoomDao', message: 'Query returned 1 row in 75ms', processId: 12847, threadId: 12912, threadName: 'worker-1', shipmentId: 'SHP-442', raw: '07-12 10:58:01.085 12847 12912 D RoomDao  : Query returned 1 row in 75ms' },
  { id: 'evt-005', timestamp: '2026-07-12T10:58:01.200+03:00', source: 'app', level: 'info', tag: 'DeliveryViewModel', message: 'Shipment SHP-442 loaded: 3 parcels, recipient=Ahmet Yilmaz', processId: 12847, threadId: 12847, threadName: 'main', shipmentId: 'SHP-442', raw: '07-12 10:58:01.200 12847 12847 I DeliveryViewModel: Shipment SHP-442 loaded: 3 parcels, recipient=Ahmet Yilmaz' },
  { id: 'evt-006', timestamp: '2026-07-12T10:58:02.500+03:00', source: 'app', level: 'debug', tag: 'DeliveryFragment', message: 'Rendering delivery UI for SHP-442', processId: 12847, threadId: 12847, threadName: 'main', shipmentId: 'SHP-442', raw: '07-12 10:58:02.500 12847 12847 D DeliveryFragment: Rendering delivery UI for SHP-442' },
  { id: 'evt-007', timestamp: '2026-07-12T10:58:03.100+03:00', source: 'location', level: 'info', tag: 'LocationService', message: 'Current position: 41.0082, 28.9784 accuracy=8.2m', processId: 12847, threadId: 12890, threadName: 'network-1', raw: '07-12 10:58:03.100 12847 12890 I LocationService: Current position: 41.0082, 28.9784 accuracy=8.2m' },
  { id: 'evt-008', timestamp: '2026-07-12T10:58:04.200+03:00', source: 'app', level: 'info', tag: 'NesyApp', message: 'Delivery screen opened', processId: 12847, threadId: 12847, threadName: 'main', shipmentId: 'SHP-442', raw: '07-12 10:58:04.200 12847 12847 I NesyApp  : Delivery screen opened' },
  { id: 'evt-009', timestamp: '2026-07-12T10:58:05.000+03:00', source: 'app', level: 'debug', tag: 'DeliveryViewModel', message: 'Checking delivery prerequisites for SHP-442', processId: 12847, threadId: 12847, threadName: 'main', shipmentId: 'SHP-442', raw: '07-12 10:58:05.000 12847 12847 D DeliveryViewModel: Checking delivery prerequisites for SHP-442' },
  { id: 'evt-010', timestamp: '2026-07-12T10:58:06.300+03:00', source: 'app', level: 'info', tag: 'DeliveryViewModel', message: 'All prerequisites met — delivery can proceed', processId: 12847, threadId: 12847, threadName: 'main', shipmentId: 'SHP-442', raw: '07-12 10:58:06.300 12847 12847 I DeliveryViewModel: All prerequisites met — delivery can proceed' },
  { id: 'evt-011', timestamp: '2026-07-12T10:58:08.000+03:00', source: 'system', level: 'verbose', tag: 'ActivityManager', message: 'Displayed com.nesymobile/.delivery.DeliveryActivity: +1s234ms', processId: 12847, threadId: 12847, threadName: 'main', raw: '07-12 10:58:08.000 12847 12847 V ActivityManager: Displayed com.nesymobile/.delivery.DeliveryActivity: +1s234ms' },
  { id: 'evt-012', timestamp: '2026-07-12T10:58:10.500+03:00', source: 'app', level: 'info', tag: 'DeliveryViewModel', message: 'User tapped "Start Delivery" for SHP-442', processId: 12847, threadId: 12847, threadName: 'main', shipmentId: 'SHP-442', correlationId: 'corr-del-442', raw: '07-12 10:58:10.500 12847 12847 I DeliveryViewModel: User tapped "Start Delivery" for SHP-442' },
  { id: 'evt-013', timestamp: '2026-07-12T10:58:11.200+03:00', source: 'app', level: 'debug', tag: 'DeliveryViewModel', message: 'delivery_started event emitted', processId: 12847, threadId: 12847, threadName: 'main', shipmentId: 'SHP-442', correlationId: 'corr-del-442', raw: '07-12 10:58:11.200 12847 12847 D DeliveryViewModel: delivery_started event emitted' },
  { id: 'evt-014', timestamp: '2026-07-12T10:58:14.230+03:00', source: 'app', level: 'info', tag: 'DeliveryViewModel', message: 'Signature captured, proceeding to payment', processId: 12847, threadId: 12847, threadName: 'main', shipmentId: 'SHP-442', correlationId: 'corr-del-442', raw: '07-12 10:58:14.230 12847 12847 I DeliveryViewModel: Signature captured, proceeding to payment' },

  // ── 10:58:15-20 — Shipment validation via network requests ──
  { id: 'evt-015', timestamp: '2026-07-12T10:58:15.100+03:00', source: 'network', level: 'info', tag: 'Retrofit', message: '--> POST https://api.nesymobile.com/v2/shipments/SHP-442/validate', processId: 12847, threadId: 12890, threadName: 'network-1', shipmentId: 'SHP-442', requestId: 'req-7801', correlationId: 'corr-del-442', raw: '07-12 10:58:15.100 12847 12890 I Retrofit : --> POST https://api.nesymobile.com/v2/shipments/SHP-442/validate' },
  { id: 'evt-016', timestamp: '2026-07-12T10:58:15.120+03:00', source: 'okhttp', level: 'debug', tag: 'OkHttp', message: 'Content-Type: application/json; charset=utf-8', processId: 12847, threadId: 12890, threadName: 'network-1', requestId: 'req-7801', raw: '07-12 10:58:15.120 12847 12890 D OkHttp   : Content-Type: application/json; charset=utf-8' },
  { id: 'evt-017', timestamp: '2026-07-12T10:58:15.130+03:00', source: 'okhttp', level: 'debug', tag: 'OkHttp', message: 'Authorization: Bearer eyJhbGciOiJSUz...REDACTED', processId: 12847, threadId: 12890, threadName: 'network-1', requestId: 'req-7801', raw: '07-12 10:58:15.130 12847 12890 D OkHttp   : Authorization: Bearer eyJhbGciOiJSUz...REDACTED' },
  { id: 'evt-018', timestamp: '2026-07-12T10:58:16.800+03:00', source: 'network', level: 'info', tag: 'Retrofit', message: '<-- 200 OK https://api.nesymobile.com/v2/shipments/SHP-442/validate (1698ms)', processId: 12847, threadId: 12890, threadName: 'network-1', shipmentId: 'SHP-442', requestId: 'req-7801', correlationId: 'corr-del-442', raw: '07-12 10:58:16.800 12847 12890 I Retrofit : <-- 200 OK https://api.nesymobile.com/v2/shipments/SHP-442/validate (1698ms)' },
  { id: 'evt-019', timestamp: '2026-07-12T10:58:17.050+03:00', source: 'app', level: 'info', tag: 'DeliveryViewModel', message: 'Shipment SHP-442 validated successfully', processId: 12847, threadId: 12847, threadName: 'main', shipmentId: 'SHP-442', correlationId: 'corr-del-442', raw: '07-12 10:58:17.050 12847 12847 I DeliveryViewModel: Shipment SHP-442 validated successfully' },
  { id: 'evt-020', timestamp: '2026-07-12T10:58:18.300+03:00', source: 'network', level: 'debug', tag: 'NetworkInterceptor', message: 'Response cached for /v2/shipments/SHP-442/validate', processId: 12847, threadId: 12890, threadName: 'network-1', requestId: 'req-7801', raw: '07-12 10:58:18.300 12847 12890 D NetworkInterceptor: Response cached for /v2/shipments/SHP-442/validate' },

  // ── 10:58:20-30 — Payment initiation and provider callback ──
  { id: 'evt-021', timestamp: '2026-07-12T10:58:20.100+03:00', source: 'payment', level: 'info', tag: 'PaymentManager', message: 'payment_initiated: amount=245.90 TRY, method=CASH, shipment=SHP-442', processId: 12847, threadId: 12847, threadName: 'main', shipmentId: 'SHP-442', correlationId: 'corr-del-442', raw: '07-12 10:58:20.100 12847 12847 I PaymentManager: payment_initiated: amount=245.90 TRY, method=CASH, shipment=SHP-442' },
  { id: 'evt-022', timestamp: '2026-07-12T10:58:20.500+03:00', source: 'payment', level: 'debug', tag: 'PaymentManager', message: 'Creating payment record in local DB', processId: 12847, threadId: 12847, threadName: 'main', shipmentId: 'SHP-442', correlationId: 'corr-del-442', raw: '07-12 10:58:20.500 12847 12847 D PaymentManager: Creating payment record in local DB' },
  { id: 'evt-023', timestamp: '2026-07-12T10:58:21.200+03:00', source: 'room', level: 'debug', tag: 'RoomDao', message: 'INSERT INTO payments (id, shipment_id, amount, method) VALUES ("PAY-1901", "SHP-442", 245.90, "CASH")', processId: 12847, threadId: 12912, threadName: 'worker-1', shipmentId: 'SHP-442', raw: '07-12 10:58:21.200 12847 12912 D RoomDao  : INSERT INTO payments (id, shipment_id, amount, method) VALUES ("PAY-1901", "SHP-442", 245.90, "CASH")' },
  { id: 'evt-024', timestamp: '2026-07-12T10:58:22.100+03:00', source: 'payment', level: 'info', tag: 'PaymentProvider', message: 'provider_callback received: status=APPROVED, ref=PAY-1901', processId: 12847, threadId: 12847, threadName: 'main', shipmentId: 'SHP-442', correlationId: 'corr-del-442', raw: '07-12 10:58:22.100 12847 12847 I PaymentProvider: provider_callback received: status=APPROVED, ref=PAY-1901' },
  { id: 'evt-025', timestamp: '2026-07-12T10:58:23.000+03:00', source: 'payment', level: 'info', tag: 'PaymentManager', message: 'payment_completed: PAY-1901 approved in 2900ms', processId: 12847, threadId: 12847, threadName: 'main', shipmentId: 'SHP-442', correlationId: 'corr-del-442', raw: '07-12 10:58:23.000 12847 12847 I PaymentManager: payment_completed: PAY-1901 approved in 2900ms' },
  { id: 'evt-026', timestamp: '2026-07-12T10:58:24.500+03:00', source: 'app', level: 'debug', tag: 'DeliveryViewModel', message: 'Payment step completed, transitioning to fiscal', processId: 12847, threadId: 12847, threadName: 'main', shipmentId: 'SHP-442', correlationId: 'corr-del-442', raw: '07-12 10:58:24.500 12847 12847 D DeliveryViewModel: Payment step completed, transitioning to fiscal' },
  { id: 'evt-027', timestamp: '2026-07-12T10:58:25.000+03:00', source: 'network', level: 'info', tag: 'Retrofit', message: '--> POST https://api.nesymobile.com/v2/payments/PAY-1901/confirm', processId: 12847, threadId: 12890, threadName: 'network-1', requestId: 'req-7802', correlationId: 'corr-del-442', raw: '07-12 10:58:25.000 12847 12890 I Retrofit : --> POST https://api.nesymobile.com/v2/payments/PAY-1901/confirm' },
  { id: 'evt-028', timestamp: '2026-07-12T10:58:26.800+03:00', source: 'network', level: 'info', tag: 'Retrofit', message: '<-- 200 OK https://api.nesymobile.com/v2/payments/PAY-1901/confirm (1800ms)', processId: 12847, threadId: 12890, threadName: 'network-1', requestId: 'req-7802', correlationId: 'corr-del-442', raw: '07-12 10:58:26.800 12847 12890 I Retrofit : <-- 200 OK https://api.nesymobile.com/v2/payments/PAY-1901/confirm (1800ms)' },

  // ── 10:58:30-40 — Fiscalization process ──
  { id: 'evt-029', timestamp: '2026-07-12T10:58:30.100+03:00', source: 'fiscal', level: 'info', tag: 'FiscalService', message: 'fiscal_create: starting fiscalization for SHP-442, amount=245.90', processId: 12847, threadId: 12847, threadName: 'main', shipmentId: 'SHP-442', correlationId: 'corr-del-442', raw: '07-12 10:58:30.100 12847 12847 I FiscalService: fiscal_create: starting fiscalization for SHP-442, amount=245.90' },
  { id: 'evt-030', timestamp: '2026-07-12T10:58:30.800+03:00', source: 'fiscal', level: 'debug', tag: 'FiscalManager', message: 'Preparing fiscal document: type=E_RECEIPT, vat=18%', processId: 12847, threadId: 12847, threadName: 'main', shipmentId: 'SHP-442', correlationId: 'corr-del-442', raw: '07-12 10:58:30.800 12847 12847 D FiscalManager: Preparing fiscal document: type=E_RECEIPT, vat=18%' },
  { id: 'evt-031', timestamp: '2026-07-12T10:58:31.500+03:00', source: 'fiscal', level: 'debug', tag: 'FiscalService', message: 'fiscal_sign: signing document with device certificate', processId: 12847, threadId: 12847, threadName: 'main', correlationId: 'corr-del-442', raw: '07-12 10:58:31.500 12847 12847 D FiscalService: fiscal_sign: signing document with device certificate' },
  { id: 'evt-032', timestamp: '2026-07-12T10:58:32.200+03:00', source: 'network', level: 'info', tag: 'Retrofit', message: '--> POST https://api.nesymobile.com/v2/fiscal/create', processId: 12847, threadId: 12890, threadName: 'network-1', requestId: 'req-7803', correlationId: 'corr-del-442', raw: '07-12 10:58:32.200 12847 12890 I Retrofit : --> POST https://api.nesymobile.com/v2/fiscal/create' },
  { id: 'evt-033', timestamp: '2026-07-12T10:58:34.100+03:00', source: 'network', level: 'info', tag: 'Retrofit', message: '<-- 201 Created https://api.nesymobile.com/v2/fiscal/create (1900ms)', processId: 12847, threadId: 12890, threadName: 'network-1', requestId: 'req-7803', correlationId: 'corr-del-442', raw: '07-12 10:58:34.100 12847 12890 I Retrofit : <-- 201 Created https://api.nesymobile.com/v2/fiscal/create (1900ms)' },
  { id: 'evt-034', timestamp: '2026-07-12T10:58:35.000+03:00', source: 'fiscal', level: 'info', tag: 'FiscalService', message: 'fiscal_completed: receipt=FSC-88201, ETTN generated', processId: 12847, threadId: 12847, threadName: 'main', shipmentId: 'SHP-442', correlationId: 'corr-del-442', raw: '07-12 10:58:35.000 12847 12847 I FiscalService: fiscal_completed: receipt=FSC-88201, ETTN generated' },
  { id: 'evt-035', timestamp: '2026-07-12T10:58:36.200+03:00', source: 'room', level: 'debug', tag: 'RoomDao', message: 'UPDATE shipments SET fiscal_id = "FSC-88201", status = "FISCALIZED" WHERE id = "SHP-442"', processId: 12847, threadId: 12912, threadName: 'worker-1', shipmentId: 'SHP-442', raw: '07-12 10:58:36.200 12847 12912 D RoomDao  : UPDATE shipments SET fiscal_id = "FSC-88201", status = "FISCALIZED" WHERE id = "SHP-442"' },
  { id: 'evt-036', timestamp: '2026-07-12T10:58:37.500+03:00', source: 'app', level: 'info', tag: 'DeliveryViewModel', message: 'Fiscal step completed, proceeding to save delivery', processId: 12847, threadId: 12847, threadName: 'main', shipmentId: 'SHP-442', correlationId: 'corr-del-442', raw: '07-12 10:58:37.500 12847 12847 I DeliveryViewModel: Fiscal step completed, proceeding to save delivery' },

  // ── 10:58:40-50 — Saving delivery and offline queue ──
  { id: 'evt-037', timestamp: '2026-07-12T10:58:40.100+03:00', source: 'app', level: 'info', tag: 'DeliveryViewModel', message: 'delivery_saved: SHP-442 marked as DELIVERED locally', processId: 12847, threadId: 12847, threadName: 'main', shipmentId: 'SHP-442', correlationId: 'corr-del-442', raw: '07-12 10:58:40.100 12847 12847 I DeliveryViewModel: delivery_saved: SHP-442 marked as DELIVERED locally' },
  { id: 'evt-038', timestamp: '2026-07-12T10:58:40.500+03:00', source: 'room', level: 'debug', tag: 'RoomDao', message: 'UPDATE shipments SET status = "DELIVERED", delivered_at = "2026-07-12T10:58:40" WHERE id = "SHP-442"', processId: 12847, threadId: 12912, threadName: 'worker-1', shipmentId: 'SHP-442', raw: '07-12 10:58:40.500 12847 12912 D RoomDao  : UPDATE shipments SET status = "DELIVERED", delivered_at = "2026-07-12T10:58:40" WHERE id = "SHP-442"' },
  { id: 'evt-039', timestamp: '2026-07-12T10:58:41.200+03:00', source: 'offline-queue', level: 'info', tag: 'RequestSenderService', message: 'request_enqueued: POST /v2/deliveries/SHP-442/complete → queue position 1', processId: 12847, threadId: 12912, threadName: 'worker-1', shipmentId: 'SHP-442', requestId: 'req-7804', correlationId: 'corr-del-442', raw: '07-12 10:58:41.200 12847 12912 I RequestSenderService: request_enqueued: POST /v2/deliveries/SHP-442/complete → queue position 1' },
  { id: 'evt-040', timestamp: '2026-07-12T10:58:42.000+03:00', source: 'offline-queue', level: 'debug', tag: 'QueueManager', message: 'Queue size: 1, network available: true, starting drain', processId: 12847, threadId: 12912, threadName: 'worker-1', raw: '07-12 10:58:42.000 12847 12912 D QueueManager: Queue size: 1, network available: true, starting drain' },
  { id: 'evt-041', timestamp: '2026-07-12T10:58:42.500+03:00', source: 'offline-queue', level: 'info', tag: 'RequestSenderService', message: 'request_started: req-7804, attempt 1/3', processId: 12847, threadId: 12912, threadName: 'worker-1', requestId: 'req-7804', correlationId: 'corr-del-442', raw: '07-12 10:58:42.500 12847 12912 I RequestSenderService: request_started: req-7804, attempt 1/3' },
  { id: 'evt-042', timestamp: '2026-07-12T10:58:43.100+03:00', source: 'network', level: 'info', tag: 'Retrofit', message: '--> POST https://api.nesymobile.com/v2/deliveries/SHP-442/complete', processId: 12847, threadId: 12890, threadName: 'network-1', requestId: 'req-7804', correlationId: 'corr-del-442', raw: '07-12 10:58:43.100 12847 12890 I Retrofit : --> POST https://api.nesymobile.com/v2/deliveries/SHP-442/complete' },
  { id: 'evt-043', timestamp: '2026-07-12T10:58:44.800+03:00', source: 'network', level: 'info', tag: 'Retrofit', message: '<-- 200 OK https://api.nesymobile.com/v2/deliveries/SHP-442/complete (1700ms)', processId: 12847, threadId: 12890, threadName: 'network-1', requestId: 'req-7804', correlationId: 'corr-del-442', raw: '07-12 10:58:44.800 12847 12890 I Retrofit : <-- 200 OK https://api.nesymobile.com/v2/deliveries/SHP-442/complete (1700ms)' },
  { id: 'evt-044', timestamp: '2026-07-12T10:58:45.200+03:00', source: 'offline-queue', level: 'info', tag: 'RequestSenderService', message: 'request_completed: req-7804 succeeded, removing from queue', processId: 12847, threadId: 12912, threadName: 'worker-1', requestId: 'req-7804', correlationId: 'corr-del-442', raw: '07-12 10:58:45.200 12847 12912 I RequestSenderService: request_completed: req-7804 succeeded, removing from queue' },
  { id: 'evt-045', timestamp: '2026-07-12T10:58:46.000+03:00', source: 'offline-queue', level: 'info', tag: 'QueueManager', message: 'Queue drained: 0 remaining items', processId: 12847, threadId: 12912, threadName: 'worker-1', raw: '07-12 10:58:46.000 12847 12912 I QueueManager: Queue drained: 0 remaining items' },
  { id: 'evt-046', timestamp: '2026-07-12T10:58:47.500+03:00', source: 'app', level: 'info', tag: 'DeliveryViewModel', message: 'Delivery SHP-442 fully synced to server', processId: 12847, threadId: 12847, threadName: 'main', shipmentId: 'SHP-442', correlationId: 'corr-del-442', raw: '07-12 10:58:47.500 12847 12847 I DeliveryViewModel: Delivery SHP-442 fully synced to server' },
  { id: 'evt-047', timestamp: '2026-07-12T10:58:48.000+03:00', source: 'firebase', level: 'debug', tag: 'FirebaseMessaging', message: 'Sending delivery completion event to analytics', processId: 12847, threadId: 12890, threadName: 'network-1', shipmentId: 'SHP-442', raw: '07-12 10:58:48.000 12847 12890 D FirebaseMessaging: Sending delivery completion event to analytics' },
  { id: 'evt-048', timestamp: '2026-07-12T10:58:49.200+03:00', source: 'app', level: 'info', tag: 'NesyApp', message: 'Navigating back to route list after delivery', processId: 12847, threadId: 12847, threadName: 'main', raw: '07-12 10:58:49.200 12847 12847 I NesyApp  : Navigating back to route list after delivery' },

  // ── 10:58:50-59:10 — Slow network warnings ──
  { id: 'evt-049', timestamp: '2026-07-12T10:58:50.000+03:00', source: 'network', level: 'warn', tag: 'NetworkInterceptor', message: 'Slow response detected: GET /v2/routes/active took 3200ms (threshold: 2000ms)', processId: 12847, threadId: 12890, threadName: 'network-1', raw: '07-12 10:58:50.000 12847 12890 W NetworkInterceptor: Slow response detected: GET /v2/routes/active took 3200ms (threshold: 2000ms)' },
  { id: 'evt-050', timestamp: '2026-07-12T10:58:52.300+03:00', source: 'network', level: 'info', tag: 'Retrofit', message: '--> GET https://api.nesymobile.com/v2/routes/active', processId: 12847, threadId: 12890, threadName: 'network-1', requestId: 'req-7805', raw: '07-12 10:58:52.300 12847 12890 I Retrofit : --> GET https://api.nesymobile.com/v2/routes/active' },
  { id: 'evt-051', timestamp: '2026-07-12T10:58:55.500+03:00', source: 'network', level: 'info', tag: 'Retrofit', message: '<-- 200 OK https://api.nesymobile.com/v2/routes/active (3200ms)', processId: 12847, threadId: 12890, threadName: 'network-1', requestId: 'req-7805', raw: '07-12 10:58:55.500 12847 12890 I Retrofit : <-- 200 OK https://api.nesymobile.com/v2/routes/active (3200ms)' },
  { id: 'evt-052', timestamp: '2026-07-12T10:58:56.800+03:00', source: 'app', level: 'debug', tag: 'RouteListViewModel', message: 'Route list refreshed: 14 remaining stops', processId: 12847, threadId: 12847, threadName: 'main', raw: '07-12 10:58:56.800 12847 12847 D RouteListViewModel: Route list refreshed: 14 remaining stops' },
  { id: 'evt-053', timestamp: '2026-07-12T10:58:58.000+03:00', source: 'network', level: 'warn', tag: 'NetworkInterceptor', message: 'Connection quality degraded: latency=1850ms, signal=-85dBm', processId: 12847, threadId: 12890, threadName: 'network-1', raw: '07-12 10:58:58.000 12847 12890 W NetworkInterceptor: Connection quality degraded: latency=1850ms, signal=-85dBm' },
  { id: 'evt-054', timestamp: '2026-07-12T10:59:00.500+03:00', source: 'system', level: 'info', tag: 'WindowManager', message: 'Screen brightness adjusted to 180/255', processId: 12847, threadId: 12847, threadName: 'main', raw: '07-12 10:59:00.500 12847 12847 I WindowManager: Screen brightness adjusted to 180/255' },
  { id: 'evt-055', timestamp: '2026-07-12T10:59:02.200+03:00', source: 'network', level: 'warn', tag: 'NetworkInterceptor', message: 'Slow response detected: GET /v2/notifications took 2800ms (threshold: 2000ms)', processId: 12847, threadId: 12890, threadName: 'network-1', raw: '07-12 10:59:02.200 12847 12890 W NetworkInterceptor: Slow response detected: GET /v2/notifications took 2800ms (threshold: 2000ms)' },
  { id: 'evt-056', timestamp: '2026-07-12T10:59:05.000+03:00', source: 'firebase', level: 'info', tag: 'FCM', message: 'Incoming push notification: type=ROUTE_UPDATE, id=NOTIF-3320', processId: 12847, threadId: 12890, threadName: 'network-1', raw: '07-12 10:59:05.000 12847 12890 I FCM      : Incoming push notification: type=ROUTE_UPDATE, id=NOTIF-3320' },
  { id: 'evt-057', timestamp: '2026-07-12T10:59:06.200+03:00', source: 'app', level: 'info', tag: 'FCMHandler', message: 'Route update notification received, scheduling refresh', processId: 12847, threadId: 12847, threadName: 'main', raw: '07-12 10:59:06.200 12847 12847 I FCMHandler: Route update notification received, scheduling refresh' },
  { id: 'evt-058', timestamp: '2026-07-12T10:59:08.000+03:00', source: 'network', level: 'debug', tag: 'NetworkInterceptor', message: 'Connection quality recovered: latency=420ms, signal=-62dBm', processId: 12847, threadId: 12890, threadName: 'network-1', raw: '07-12 10:59:08.000 12847 12890 D NetworkInterceptor: Connection quality recovered: latency=420ms, signal=-62dBm' },

  // ── 10:59:10-30 — Request retry and completion ──
  { id: 'evt-059', timestamp: '2026-07-12T10:59:10.100+03:00', source: 'network', level: 'info', tag: 'Retrofit', message: '--> GET https://api.nesymobile.com/v2/routes/active/refresh', processId: 12847, threadId: 12890, threadName: 'network-1', requestId: 'req-7806', raw: '07-12 10:59:10.100 12847 12890 I Retrofit : --> GET https://api.nesymobile.com/v2/routes/active/refresh' },
  { id: 'evt-060', timestamp: '2026-07-12T10:59:11.800+03:00', source: 'network', level: 'info', tag: 'Retrofit', message: '<-- 200 OK https://api.nesymobile.com/v2/routes/active/refresh (1700ms)', processId: 12847, threadId: 12890, threadName: 'network-1', requestId: 'req-7806', raw: '07-12 10:59:11.800 12847 12890 I Retrofit : <-- 200 OK https://api.nesymobile.com/v2/routes/active/refresh (1700ms)' },
  { id: 'evt-061', timestamp: '2026-07-12T10:59:12.500+03:00', source: 'room', level: 'debug', tag: 'RoomDao', message: 'BEGIN TRANSACTION — updating 3 route stops', processId: 12847, threadId: 12912, threadName: 'worker-1', raw: '07-12 10:59:12.500 12847 12912 D RoomDao  : BEGIN TRANSACTION — updating 3 route stops' },
  { id: 'evt-062', timestamp: '2026-07-12T10:59:13.200+03:00', source: 'room', level: 'debug', tag: 'RoomDao', message: 'COMMIT TRANSACTION — 3 stops updated in 700ms', processId: 12847, threadId: 12912, threadName: 'worker-1', raw: '07-12 10:59:13.200 12847 12912 D RoomDao  : COMMIT TRANSACTION — 3 stops updated in 700ms' },
  { id: 'evt-063', timestamp: '2026-07-12T10:59:14.000+03:00', source: 'app', level: 'info', tag: 'RouteListViewModel', message: 'Route list updated with 3 new stop assignments', processId: 12847, threadId: 12847, threadName: 'main', raw: '07-12 10:59:14.000 12847 12847 I RouteListViewModel: Route list updated with 3 new stop assignments' },
  { id: 'evt-064', timestamp: '2026-07-12T10:59:16.500+03:00', source: 'app', level: 'debug', tag: 'NesyApp', message: 'UI refreshed: route list now shows 17 stops', processId: 12847, threadId: 12847, threadName: 'main', raw: '07-12 10:59:16.500 12847 12847 D NesyApp  : UI refreshed: route list now shows 17 stops' },
  { id: 'evt-065', timestamp: '2026-07-12T10:59:18.200+03:00', source: 'network', level: 'info', tag: 'Retrofit', message: '--> POST https://api.nesymobile.com/v2/telemetry/batch', processId: 12847, threadId: 12890, threadName: 'network-1', requestId: 'req-7807', raw: '07-12 10:59:18.200 12847 12890 I Retrofit : --> POST https://api.nesymobile.com/v2/telemetry/batch' },
  { id: 'evt-066', timestamp: '2026-07-12T10:59:19.500+03:00', source: 'network', level: 'info', tag: 'Retrofit', message: '<-- 204 No Content https://api.nesymobile.com/v2/telemetry/batch (1300ms)', processId: 12847, threadId: 12890, threadName: 'network-1', requestId: 'req-7807', raw: '07-12 10:59:19.500 12847 12890 I Retrofit : <-- 204 No Content https://api.nesymobile.com/v2/telemetry/batch (1300ms)' },
  { id: 'evt-067', timestamp: '2026-07-12T10:59:22.000+03:00', source: 'app', level: 'verbose', tag: 'ViewModel', message: 'GC triggered: freed 2.4MB, 38% free heap', processId: 12847, threadId: 12847, threadName: 'main', raw: '07-12 10:59:22.000 12847 12847 V ViewModel: GC triggered: freed 2.4MB, 38% free heap' },
  { id: 'evt-068', timestamp: '2026-07-12T10:59:25.000+03:00', source: 'system', level: 'debug', tag: 'ActivityManager', message: 'Process com.nesymobile: pss=124MB, rss=186MB', processId: 12847, threadId: 12847, threadName: 'main', raw: '07-12 10:59:25.000 12847 12847 D ActivityManager: Process com.nesymobile: pss=124MB, rss=186MB' },

  // ── 10:59:30-11:00 — Location update batch ──
  { id: 'evt-069', timestamp: '2026-07-12T10:59:30.100+03:00', source: 'location', level: 'info', tag: 'LocationService', message: 'Location batch update: 5 points collected in last 120s', processId: 12847, threadId: 12890, threadName: 'network-1', raw: '07-12 10:59:30.100 12847 12890 I LocationService: Location batch update: 5 points collected in last 120s' },
  { id: 'evt-070', timestamp: '2026-07-12T10:59:31.500+03:00', source: 'location', level: 'debug', tag: 'GPSProvider', message: 'Fix acquired: 41.0091, 28.9792, alt=42m, speed=8.3m/s', processId: 12847, threadId: 12890, threadName: 'network-1', raw: '07-12 10:59:31.500 12847 12890 D GPSProvider: Fix acquired: 41.0091, 28.9792, alt=42m, speed=8.3m/s' },
  { id: 'evt-071', timestamp: '2026-07-12T10:59:33.000+03:00', source: 'location', level: 'debug', tag: 'FusedLocation', message: 'Fused provider: GPS priority, accuracy=6.1m', processId: 12847, threadId: 12890, threadName: 'network-1', raw: '07-12 10:59:33.000 12847 12890 D FusedLocation: Fused provider: GPS priority, accuracy=6.1m' },
  { id: 'evt-072', timestamp: '2026-07-12T10:59:35.800+03:00', source: 'network', level: 'info', tag: 'Retrofit', message: '--> POST https://api.nesymobile.com/v2/tracking/locations', processId: 12847, threadId: 12890, threadName: 'network-1', requestId: 'req-7808', raw: '07-12 10:59:35.800 12847 12890 I Retrofit : --> POST https://api.nesymobile.com/v2/tracking/locations' },
  { id: 'evt-073', timestamp: '2026-07-12T10:59:37.200+03:00', source: 'network', level: 'info', tag: 'Retrofit', message: '<-- 200 OK https://api.nesymobile.com/v2/tracking/locations (1400ms)', processId: 12847, threadId: 12890, threadName: 'network-1', requestId: 'req-7808', raw: '07-12 10:59:37.200 12847 12890 I Retrofit : <-- 200 OK https://api.nesymobile.com/v2/tracking/locations (1400ms)' },
  { id: 'evt-074', timestamp: '2026-07-12T10:59:40.000+03:00', source: 'location', level: 'info', tag: 'LocationService', message: 'Geofence check: next stop SHP-443 is 1.2km away', processId: 12847, threadId: 12890, threadName: 'network-1', raw: '07-12 10:59:40.000 12847 12890 I LocationService: Geofence check: next stop SHP-443 is 1.2km away' },
  { id: 'evt-075', timestamp: '2026-07-12T10:59:50.000+03:00', source: 'location', level: 'debug', tag: 'GPSProvider', message: 'Fix acquired: 41.0098, 28.9801, alt=38m, speed=12.1m/s', processId: 12847, threadId: 12890, threadName: 'network-1', raw: '07-12 10:59:50.000 12847 12890 D GPSProvider: Fix acquired: 41.0098, 28.9801, alt=38m, speed=12.1m/s' },

  // ── 11:00-11:01 — WorkManager background task ──
  { id: 'evt-076', timestamp: '2026-07-12T11:00:00.200+03:00', source: 'workmanager', level: 'info', tag: 'WorkManager', message: 'Periodic work "SyncScheduleWorker" starting', processId: 12847, threadId: 12912, threadName: 'worker-1', raw: '07-12 11:00:00.200 12847 12912 I WorkManager: Periodic work "SyncScheduleWorker" starting' },
  { id: 'evt-077', timestamp: '2026-07-12T11:00:01.500+03:00', source: 'workmanager', level: 'debug', tag: 'ScheduledWork', message: 'SyncScheduleWorker: checking for pending schedule updates', processId: 12847, threadId: 12912, threadName: 'worker-1', raw: '07-12 11:00:01.500 12847 12912 D ScheduledWork: SyncScheduleWorker: checking for pending schedule updates' },
  { id: 'evt-078', timestamp: '2026-07-12T11:00:03.000+03:00', source: 'network', level: 'info', tag: 'Retrofit', message: '--> GET https://api.nesymobile.com/v2/schedules/pending', processId: 12847, threadId: 12890, threadName: 'network-1', requestId: 'req-7809', raw: '07-12 11:00:03.000 12847 12890 I Retrofit : --> GET https://api.nesymobile.com/v2/schedules/pending' },
  { id: 'evt-079', timestamp: '2026-07-12T11:00:04.200+03:00', source: 'network', level: 'info', tag: 'Retrofit', message: '<-- 200 OK https://api.nesymobile.com/v2/schedules/pending (1200ms)', processId: 12847, threadId: 12890, threadName: 'network-1', requestId: 'req-7809', raw: '07-12 11:00:04.200 12847 12890 I Retrofit : <-- 200 OK https://api.nesymobile.com/v2/schedules/pending (1200ms)' },
  { id: 'evt-080', timestamp: '2026-07-12T11:00:05.500+03:00', source: 'workmanager', level: 'info', tag: 'ScheduledWork', message: 'SyncScheduleWorker: no pending updates, result=SUCCESS', processId: 12847, threadId: 12912, threadName: 'worker-1', raw: '07-12 11:00:05.500 12847 12912 I ScheduledWork: SyncScheduleWorker: no pending updates, result=SUCCESS' },
  { id: 'evt-081', timestamp: '2026-07-12T11:00:06.800+03:00', source: 'workmanager', level: 'debug', tag: 'WorkManager', message: 'Work "SyncScheduleWorker" finished: SUCCESS, next run in 15min', processId: 12847, threadId: 12912, threadName: 'worker-1', raw: '07-12 11:00:06.800 12847 12912 D WorkManager: Work "SyncScheduleWorker" finished: SUCCESS, next run in 15min' },
  { id: 'evt-082', timestamp: '2026-07-12T11:00:15.000+03:00', source: 'workmanager', level: 'info', tag: 'WorkManager', message: 'One-time work "ImageUploadWorker" starting (2 images queued)', processId: 12847, threadId: 12912, threadName: 'worker-1', raw: '07-12 11:00:15.000 12847 12912 I WorkManager: One-time work "ImageUploadWorker" starting (2 images queued)' },
  { id: 'evt-083', timestamp: '2026-07-12T11:00:20.000+03:00', source: 'network', level: 'info', tag: 'Retrofit', message: '--> POST https://api.nesymobile.com/v2/images/upload (multipart, 1.2MB)', processId: 12847, threadId: 12890, threadName: 'network-1', requestId: 'req-7810', raw: '07-12 11:00:20.000 12847 12890 I Retrofit : --> POST https://api.nesymobile.com/v2/images/upload (multipart, 1.2MB)' },
  { id: 'evt-084', timestamp: '2026-07-12T11:00:28.500+03:00', source: 'network', level: 'info', tag: 'Retrofit', message: '<-- 200 OK https://api.nesymobile.com/v2/images/upload (8500ms)', processId: 12847, threadId: 12890, threadName: 'network-1', requestId: 'req-7810', raw: '07-12 11:00:28.500 12847 12890 I Retrofit : <-- 200 OK https://api.nesymobile.com/v2/images/upload (8500ms)' },
  { id: 'evt-085', timestamp: '2026-07-12T11:00:30.000+03:00', source: 'workmanager', level: 'info', tag: 'WorkManager', message: 'Work "ImageUploadWorker" finished: SUCCESS', processId: 12847, threadId: 12912, threadName: 'worker-1', raw: '07-12 11:00:30.000 12847 12912 I WorkManager: Work "ImageUploadWorker" finished: SUCCESS' },

  // ── 11:01-11:02 — Next delivery start ──
  { id: 'evt-086', timestamp: '2026-07-12T11:01:00.200+03:00', source: 'location', level: 'info', tag: 'LocationService', message: 'Geofence entered: stop SHP-443 radius=200m', processId: 12847, threadId: 12890, threadName: 'network-1', raw: '07-12 11:01:00.200 12847 12890 I LocationService: Geofence entered: stop SHP-443 radius=200m' },
  { id: 'evt-087', timestamp: '2026-07-12T11:01:01.000+03:00', source: 'app', level: 'info', tag: 'NesyApp', message: 'Auto-navigating to next delivery: SHP-443', processId: 12847, threadId: 12847, threadName: 'main', shipmentId: 'SHP-443', raw: '07-12 11:01:01.000 12847 12847 I NesyApp  : Auto-navigating to next delivery: SHP-443' },
  { id: 'evt-088', timestamp: '2026-07-12T11:01:02.500+03:00', source: 'room', level: 'debug', tag: 'RoomDao', message: 'SELECT * FROM shipments WHERE id = "SHP-443"', processId: 12847, threadId: 12912, threadName: 'worker-1', shipmentId: 'SHP-443', raw: '07-12 11:01:02.500 12847 12912 D RoomDao  : SELECT * FROM shipments WHERE id = "SHP-443"' },
  { id: 'evt-089', timestamp: '2026-07-12T11:01:03.100+03:00', source: 'app', level: 'info', tag: 'DeliveryViewModel', message: 'Shipment SHP-443 loaded: 1 parcel, recipient=Mehmet Kara', processId: 12847, threadId: 12847, threadName: 'main', shipmentId: 'SHP-443', raw: '07-12 10:01:03.100 12847 12847 I DeliveryViewModel: Shipment SHP-443 loaded: 1 parcel, recipient=Mehmet Kara' },
  { id: 'evt-090', timestamp: '2026-07-12T11:01:10.000+03:00', source: 'app', level: 'info', tag: 'DeliveryViewModel', message: 'User tapped "Start Delivery" for SHP-443', processId: 12847, threadId: 12847, threadName: 'main', shipmentId: 'SHP-443', correlationId: 'corr-del-443', raw: '07-12 11:01:10.000 12847 12847 I DeliveryViewModel: User tapped "Start Delivery" for SHP-443' },
  { id: 'evt-091', timestamp: '2026-07-12T11:01:15.500+03:00', source: 'scanner', level: 'info', tag: 'BarcodeScanner', message: 'Hardware scanner initialized: Urovo DT50 built-in', processId: 12847, threadId: 12847, threadName: 'main', raw: '07-12 11:01:15.500 12847 12847 I BarcodeScanner: Hardware scanner initialized: Urovo DT50 built-in' },
  { id: 'evt-092', timestamp: '2026-07-12T11:01:18.000+03:00', source: 'scanner', level: 'info', tag: 'BarcodeScanner', message: 'Barcode scanned: "PKG-SHP443-001", format=CODE128', processId: 12847, threadId: 12847, threadName: 'main', shipmentId: 'SHP-443', raw: '07-12 11:01:18.000 12847 12847 I BarcodeScanner: Barcode scanned: "PKG-SHP443-001", format=CODE128' },
  { id: 'evt-093', timestamp: '2026-07-12T11:01:19.200+03:00', source: 'app', level: 'info', tag: 'DeliveryViewModel', message: 'Parcel PKG-SHP443-001 verified via barcode', processId: 12847, threadId: 12847, threadName: 'main', shipmentId: 'SHP-443', correlationId: 'corr-del-443', raw: '07-12 11:01:19.200 12847 12847 I DeliveryViewModel: Parcel PKG-SHP443-001 verified via barcode' },

  // ── 11:02-11:03 — Network timeout and offline queue fallback ──
  { id: 'evt-094', timestamp: '2026-07-12T11:02:00.100+03:00', source: 'payment', level: 'info', tag: 'PaymentManager', message: 'payment_initiated: amount=89.50 TRY, method=CASH, shipment=SHP-443', processId: 12847, threadId: 12847, threadName: 'main', shipmentId: 'SHP-443', correlationId: 'corr-del-443', raw: '07-12 11:02:00.100 12847 12847 I PaymentManager: payment_initiated: amount=89.50 TRY, method=CASH, shipment=SHP-443' },
  { id: 'evt-095', timestamp: '2026-07-12T11:02:01.500+03:00', source: 'payment', level: 'info', tag: 'PaymentProvider', message: 'provider_callback received: status=APPROVED, ref=PAY-1902', processId: 12847, threadId: 12847, threadName: 'main', shipmentId: 'SHP-443', correlationId: 'corr-del-443', raw: '07-12 11:02:01.500 12847 12847 I PaymentProvider: provider_callback received: status=APPROVED, ref=PAY-1902' },
  { id: 'evt-096', timestamp: '2026-07-12T11:02:02.800+03:00', source: 'network', level: 'info', tag: 'Retrofit', message: '--> POST https://api.nesymobile.com/v2/deliveries/SHP-443/complete', processId: 12847, threadId: 12890, threadName: 'network-1', requestId: 'req-7811', correlationId: 'corr-del-443', raw: '07-12 11:02:02.800 12847 12890 I Retrofit : --> POST https://api.nesymobile.com/v2/deliveries/SHP-443/complete' },
  { id: 'evt-097', timestamp: '2026-07-12T11:02:32.800+03:00', source: 'network', level: 'error', tag: 'Retrofit', message: '<-- HTTP FAILED: java.net.SocketTimeoutException: timeout after 30000ms', processId: 12847, threadId: 12890, threadName: 'network-1', requestId: 'req-7811', correlationId: 'corr-del-443', raw: '07-12 11:02:32.800 12847 12890 E Retrofit : <-- HTTP FAILED: java.net.SocketTimeoutException: timeout after 30000ms' },
  { id: 'evt-098', timestamp: '2026-07-12T11:02:33.500+03:00', source: 'app', level: 'warn', tag: 'DeliveryViewModel', message: 'Network request failed for SHP-443, falling back to offline queue', processId: 12847, threadId: 12847, threadName: 'main', shipmentId: 'SHP-443', correlationId: 'corr-del-443', raw: '07-12 11:02:33.500 12847 12847 W DeliveryViewModel: Network request failed for SHP-443, falling back to offline queue' },
  { id: 'evt-099', timestamp: '2026-07-12T11:02:34.200+03:00', source: 'offline-queue', level: 'info', tag: 'RequestSenderService', message: 'request_enqueued: POST /v2/deliveries/SHP-443/complete → queue position 1 (offline fallback)', processId: 12847, threadId: 12912, threadName: 'worker-1', shipmentId: 'SHP-443', requestId: 'req-7812', correlationId: 'corr-del-443', raw: '07-12 11:02:34.200 12847 12912 I RequestSenderService: request_enqueued: POST /v2/deliveries/SHP-443/complete → queue position 1 (offline fallback)' },
  { id: 'evt-100', timestamp: '2026-07-12T11:02:35.000+03:00', source: 'app', level: 'info', tag: 'DeliveryViewModel', message: 'delivery_saved: SHP-443 stored locally, will sync when network recovers', processId: 12847, threadId: 12847, threadName: 'main', shipmentId: 'SHP-443', correlationId: 'corr-del-443', raw: '07-12 11:02:35.000 12847 12847 I DeliveryViewModel: delivery_saved: SHP-443 stored locally, will sync when network recovers' },
]

// ── MOCK_RAW_LOGS ───────────────────────────────────────────────────

export const MOCK_RAW_LOGS = `\
07-12 10:58:00.120 12847 12847 I NesyApp  : Navigating to DeliveryFragment
07-12 10:58:00.350 12847 12847 D DeliveryViewModel: loadShipment(SHP-442) called
07-12 10:58:01.010 12847 12912 D RoomDao  : SELECT * FROM shipments WHERE id = "SHP-442"
07-12 10:58:01.085 12847 12912 D RoomDao  : Query returned 1 row in 75ms
07-12 10:58:01.200 12847 12847 I DeliveryViewModel: Shipment SHP-442 loaded: 3 parcels, recipient=Ahmet Yilmaz
07-12 10:58:02.500 12847 12847 D DeliveryFragment: Rendering delivery UI for SHP-442
07-12 10:58:03.100 12847 12890 I LocationService: Current position: 41.0082, 28.9784 accuracy=8.2m
07-12 10:58:04.200 12847 12847 I NesyApp  : Delivery screen opened
07-12 10:58:05.000 12847 12847 D DeliveryViewModel: Checking delivery prerequisites for SHP-442
07-12 10:58:06.300 12847 12847 I DeliveryViewModel: All prerequisites met — delivery can proceed
07-12 10:58:08.000 12847 12847 V ActivityManager: Displayed com.nesymobile/.delivery.DeliveryActivity: +1s234ms
07-12 10:58:10.500 12847 12847 I DeliveryViewModel: User tapped "Start Delivery" for SHP-442
07-12 10:58:11.200 12847 12847 D DeliveryViewModel: delivery_started event emitted
07-12 10:58:14.230 12847 12847 I DeliveryViewModel: Signature captured, proceeding to payment
07-12 10:58:15.100 12847 12890 I Retrofit : --> POST https://api.nesymobile.com/v2/shipments/SHP-442/validate
07-12 10:58:15.120 12847 12890 D OkHttp   : Content-Type: application/json; charset=utf-8
07-12 10:58:15.130 12847 12890 D OkHttp   : Authorization: Bearer eyJhbGciOiJSUz...REDACTED
07-12 10:58:16.800 12847 12890 I Retrofit : <-- 200 OK https://api.nesymobile.com/v2/shipments/SHP-442/validate (1698ms)
07-12 10:58:17.050 12847 12847 I DeliveryViewModel: Shipment SHP-442 validated successfully
07-12 10:58:18.300 12847 12890 D NetworkInterceptor: Response cached for /v2/shipments/SHP-442/validate
07-12 10:58:20.100 12847 12847 I PaymentManager: payment_initiated: amount=245.90 TRY, method=CASH, shipment=SHP-442
07-12 10:58:20.500 12847 12847 D PaymentManager: Creating payment record in local DB
07-12 10:58:21.200 12847 12912 D RoomDao  : INSERT INTO payments (id, shipment_id, amount, method) VALUES ("PAY-1901", "SHP-442", 245.90, "CASH")
07-12 10:58:22.100 12847 12847 I PaymentProvider: provider_callback received: status=APPROVED, ref=PAY-1901
07-12 10:58:23.000 12847 12847 I PaymentManager: payment_completed: PAY-1901 approved in 2900ms
07-12 10:58:24.500 12847 12847 D DeliveryViewModel: Payment step completed, transitioning to fiscal
07-12 10:58:25.000 12847 12890 I Retrofit : --> POST https://api.nesymobile.com/v2/payments/PAY-1901/confirm
07-12 10:58:26.800 12847 12890 I Retrofit : <-- 200 OK https://api.nesymobile.com/v2/payments/PAY-1901/confirm (1800ms)
07-12 10:58:30.100 12847 12847 I FiscalService: fiscal_create: starting fiscalization for SHP-442, amount=245.90
07-12 10:58:30.800 12847 12847 D FiscalManager: Preparing fiscal document: type=E_RECEIPT, vat=18%
07-12 10:58:31.500 12847 12847 D FiscalService: fiscal_sign: signing document with device certificate
07-12 10:58:32.200 12847 12890 I Retrofit : --> POST https://api.nesymobile.com/v2/fiscal/create
07-12 10:58:34.100 12847 12890 I Retrofit : <-- 201 Created https://api.nesymobile.com/v2/fiscal/create (1900ms)
07-12 10:58:35.000 12847 12847 I FiscalService: fiscal_completed: receipt=FSC-88201, ETTN generated
07-12 10:58:36.200 12847 12912 D RoomDao  : UPDATE shipments SET fiscal_id = "FSC-88201", status = "FISCALIZED" WHERE id = "SHP-442"
07-12 10:58:37.500 12847 12847 I DeliveryViewModel: Fiscal step completed, proceeding to save delivery
07-12 10:58:40.100 12847 12847 I DeliveryViewModel: delivery_saved: SHP-442 marked as DELIVERED locally
07-12 10:58:40.500 12847 12912 D RoomDao  : UPDATE shipments SET status = "DELIVERED", delivered_at = "2026-07-12T10:58:40" WHERE id = "SHP-442"
07-12 10:58:41.200 12847 12912 I RequestSenderService: request_enqueued: POST /v2/deliveries/SHP-442/complete → queue position 1
07-12 10:58:42.000 12847 12912 D QueueManager: Queue size: 1, network available: true, starting drain
07-12 10:58:42.500 12847 12912 I RequestSenderService: request_started: req-7804, attempt 1/3
07-12 10:58:43.100 12847 12890 I Retrofit : --> POST https://api.nesymobile.com/v2/deliveries/SHP-442/complete
07-12 10:58:44.800 12847 12890 I Retrofit : <-- 200 OK https://api.nesymobile.com/v2/deliveries/SHP-442/complete (1700ms)
07-12 10:58:45.200 12847 12912 I RequestSenderService: request_completed: req-7804 succeeded, removing from queue
07-12 10:58:46.000 12847 12912 I QueueManager: Queue drained: 0 remaining items
07-12 10:58:47.500 12847 12847 I DeliveryViewModel: Delivery SHP-442 fully synced to server
07-12 10:58:48.000 12847 12890 D FirebaseMessaging: Sending delivery completion event to analytics
07-12 10:58:49.200 12847 12847 I NesyApp  : Navigating back to route list after delivery
07-12 10:58:50.000 12847 12890 W NetworkInterceptor: Slow response detected: GET /v2/routes/active took 3200ms (threshold: 2000ms)
07-12 10:58:52.300 12847 12890 I Retrofit : --> GET https://api.nesymobile.com/v2/routes/active
07-12 10:58:55.500 12847 12890 I Retrofit : <-- 200 OK https://api.nesymobile.com/v2/routes/active (3200ms)
07-12 10:58:56.800 12847 12847 D RouteListViewModel: Route list refreshed: 14 remaining stops
07-12 10:58:58.000 12847 12890 W NetworkInterceptor: Connection quality degraded: latency=1850ms, signal=-85dBm
07-12 10:59:00.500 12847 12847 I WindowManager: Screen brightness adjusted to 180/255
07-12 10:59:02.200 12847 12890 W NetworkInterceptor: Slow response detected: GET /v2/notifications took 2800ms (threshold: 2000ms)
07-12 10:59:05.000 12847 12890 I FCM      : Incoming push notification: type=ROUTE_UPDATE, id=NOTIF-3320
07-12 10:59:06.200 12847 12847 I FCMHandler: Route update notification received, scheduling refresh
07-12 10:59:08.000 12847 12890 D NetworkInterceptor: Connection quality recovered: latency=420ms, signal=-62dBm
07-12 10:59:10.100 12847 12890 I Retrofit : --> GET https://api.nesymobile.com/v2/routes/active/refresh
07-12 10:59:11.800 12847 12890 I Retrofit : <-- 200 OK https://api.nesymobile.com/v2/routes/active/refresh (1700ms)
07-12 10:59:12.500 12847 12912 D RoomDao  : BEGIN TRANSACTION — updating 3 route stops
07-12 10:59:13.200 12847 12912 D RoomDao  : COMMIT TRANSACTION — 3 stops updated in 700ms
07-12 10:59:14.000 12847 12847 I RouteListViewModel: Route list updated with 3 new stop assignments
07-12 10:59:16.500 12847 12847 D NesyApp  : UI refreshed: route list now shows 17 stops
07-12 10:59:18.200 12847 12890 I Retrofit : --> POST https://api.nesymobile.com/v2/telemetry/batch
07-12 10:59:19.500 12847 12890 I Retrofit : <-- 204 No Content https://api.nesymobile.com/v2/telemetry/batch (1300ms)
07-12 10:59:22.000 12847 12847 V ViewModel: GC triggered: freed 2.4MB, 38% free heap
07-12 10:59:25.000 12847 12847 D ActivityManager: Process com.nesymobile: pss=124MB, rss=186MB
07-12 10:59:30.100 12847 12890 I LocationService: Location batch update: 5 points collected in last 120s
07-12 10:59:31.500 12847 12890 D GPSProvider: Fix acquired: 41.0091, 28.9792, alt=42m, speed=8.3m/s
07-12 10:59:33.000 12847 12890 D FusedLocation: Fused provider: GPS priority, accuracy=6.1m
07-12 10:59:35.800 12847 12890 I Retrofit : --> POST https://api.nesymobile.com/v2/tracking/locations
07-12 10:59:37.200 12847 12890 I Retrofit : <-- 200 OK https://api.nesymobile.com/v2/tracking/locations (1400ms)
07-12 10:59:40.000 12847 12890 I LocationService: Geofence check: next stop SHP-443 is 1.2km away
07-12 10:59:50.000 12847 12890 D GPSProvider: Fix acquired: 41.0098, 28.9801, alt=38m, speed=12.1m/s
07-12 11:00:00.200 12847 12912 I WorkManager: Periodic work "SyncScheduleWorker" starting
07-12 11:00:01.500 12847 12912 D ScheduledWork: SyncScheduleWorker: checking for pending schedule updates
07-12 11:00:03.000 12847 12890 I Retrofit : --> GET https://api.nesymobile.com/v2/schedules/pending
07-12 11:00:04.200 12847 12890 I Retrofit : <-- 200 OK https://api.nesymobile.com/v2/schedules/pending (1200ms)
07-12 11:00:05.500 12847 12912 I ScheduledWork: SyncScheduleWorker: no pending updates, result=SUCCESS
07-12 11:00:06.800 12847 12912 D WorkManager: Work "SyncScheduleWorker" finished: SUCCESS, next run in 15min
07-12 11:00:15.000 12847 12912 I WorkManager: One-time work "ImageUploadWorker" starting (2 images queued)
07-12 11:01:00.200 12847 12890 I LocationService: Geofence entered: stop SHP-443 radius=200m
07-12 11:01:01.000 12847 12847 I NesyApp  : Auto-navigating to next delivery: SHP-443
07-12 11:01:15.500 12847 12847 I BarcodeScanner: Hardware scanner initialized: Urovo DT50 built-in
07-12 11:01:18.000 12847 12847 I BarcodeScanner: Barcode scanned: "PKG-SHP443-001", format=CODE128
07-12 11:01:19.200 12847 12847 I DeliveryViewModel: Parcel PKG-SHP443-001 verified via barcode
07-12 11:02:00.100 12847 12847 I PaymentManager: payment_initiated: amount=89.50 TRY, method=CASH, shipment=SHP-443
07-12 11:02:02.800 12847 12890 I Retrofit : --> POST https://api.nesymobile.com/v2/deliveries/SHP-443/complete
07-12 11:02:32.800 12847 12890 E Retrofit : <-- HTTP FAILED: java.net.SocketTimeoutException: timeout after 30000ms
07-12 11:02:33.500 12847 12847 W DeliveryViewModel: Network request failed for SHP-443, falling back to offline queue
07-12 11:02:34.200 12847 12912 I RequestSenderService: request_enqueued: POST /v2/deliveries/SHP-443/complete → queue position 1 (offline fallback)
07-12 11:02:35.000 12847 12847 I DeliveryViewModel: delivery_saved: SHP-443 stored locally, will sync when network recovers
`

// ── MOCK_SESSIONS ───────────────────────────────────────────────────

export const MOCK_SESSIONS: LogSession[] = [
  {
    id: 'SESSION-2026-0712-1058',
    deviceName: 'Urovo DT50 — SN:DT50-A1842',
    presetLabel: 'Delivery Flow',
    presetId: 'delivery-flow',
    contextNote: 'SHP-442 delivery flow test — including payment, fiscalization and offline queue',
    startedAt: '2026-07-12T10:58:00+03:00',
    durationMin: 5,
    eventCount: 12482,
    owner: 'Gokhan',
    sharedTo: 'Ticket #TK-2290',
    sources: ['app', 'network', 'payment', 'fiscal', 'offline-queue', 'room'],
  },
  {
    id: 'SESSION-2026-0712-1012',
    deviceName: 'Android Emulator — Pixel 7 API 34',
    presetLabel: 'Startup & Login',
    presetId: 'startup-login',
    contextNote: '401 Unauthorized error again — token expire scenario',
    startedAt: '2026-07-12T10:12:00+03:00',
    durationMin: 2,
    eventCount: 3200,
    owner: 'QA',
    sources: ['app', 'network', 'okhttp'],
  },
  {
    id: 'SESSION-2026-0711-1630',
    deviceName: 'Samsung Galaxy A13 — SN:R58W40KXYZM',
    presetLabel: 'Offline Queue',
    presetId: 'offline-queue',
    contextNote: 'Offline queue synchronization — 48 request backlog test',
    startedAt: '2026-07-11T16:30:00+03:00',
    durationMin: 8,
    eventCount: 18500,
    owner: 'Emre',
    sources: ['offline-queue', 'network', 'room'],
  },
  {
    id: 'SESSION-2026-0711-0900',
    deviceName: 'Urovo DT50 — SN:DT50-A1790',
    presetLabel: 'Crash / ANR',
    presetId: 'crash-anr',
    contextNote: 'OOM crash — out of memory during schedule load',
    startedAt: '2026-07-11T09:00:00+03:00',
    durationMin: 1,
    eventCount: 850,
    owner: 'DevOps',
    sharedTo: 'Incident #INC-0087',
    sources: ['crash', 'system', 'app'],
  },
  {
    id: 'SESSION-2026-0710-1420',
    deviceName: 'Android Emulator — Pixel 7 API 34',
    presetLabel: 'Payment & Fiscal',
    presetId: 'payment-fiscal',
    contextNote: 'Credit card payment + e-invoice flow validation',
    startedAt: '2026-07-10T14:20:00+03:00',
    durationMin: 3,
    eventCount: 5200,
    owner: 'QA',
    sources: ['payment', 'fiscal', 'network'],
  },
  {
    id: 'SESSION-2026-0710-1100',
    deviceName: 'Samsung Galaxy A13 — SN:R58W40KXYZM',
    presetLabel: 'Schedule & Stop List',
    presetId: 'schedule-stoplist',
    contextNote: 'Route schedule update — FCM trigger and Room write performance',
    startedAt: '2026-07-10T11:00:00+03:00',
    durationMin: 4,
    eventCount: 7800,
    owner: 'Gokhan',
    sources: ['app', 'network', 'room'],
  },
  {
    id: 'SESSION-2026-0709-1545',
    deviceName: 'Urovo DT50 — SN:DT50-A1842',
    presetLabel: 'Full Investigation',
    presetId: 'full-investigation',
    contextNote: 'Field test — all sources on, full day monitoring experience',
    startedAt: '2026-07-09T15:45:00+03:00',
    durationMin: 15,
    eventCount: 45000,
    owner: 'Emre',
    sources: [...ALL_SOURCES],
  },
  {
    id: 'SESSION-2026-0709-0830',
    deviceName: 'Zebra TC21 — SN:TC21-Z4501',
    presetLabel: 'Barcode & Scan',
    presetId: 'barcode-scan',
    contextNote: 'Barcode scan performance — Zebra hardware scanner vs camera comparison',
    startedAt: '2026-07-09T08:30:00+03:00',
    durationMin: 2,
    eventCount: 2100,
    owner: 'QA',
    sources: ['scanner', 'app'],
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
