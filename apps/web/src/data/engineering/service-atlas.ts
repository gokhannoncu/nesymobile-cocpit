// Mobile Service Atlas — screen → user action → mobile call chain → endpoint → response mapping.
// Extracted from the real NESY Mobile Android codebase (com.arasdigital.nesymobile, versionName 0.1157).
// Source of truth: app/src/main/java/com/arasdigital/nesymobile/network/APIService.kt (122 endpoints),
// di/AuthInterceptor.kt (common headers), services/RequestSenderService.kt (offline queue).
// Exemplar-first: a handful of contracts are fully documented (request fields, response mapping,
// errors, offline behaviour); the rest are "detected" rows waiting for documentation passes.

import type { Tone } from '@/components/product'

export const ATLAS_APP_VERSION = '0.1157'
export const ATLAS_DB_VERSION = 240
export const ATLAS_SCAN_DATE = '18 Tem 2026'
export const ATLAS_TOTAL_DETECTED = 122
export const ATLAS_COUNTRIES = ['HR', 'BA', 'SI', 'RS', 'BG', 'AZ', 'ME'] as const

// ─── Journeys & screens ─────────────────────────────────────────────────────

export type AtlasJourney =
  | 'entry'
  | 'daily'
  | 'shipment-ops'
  | 'payment-fiscal'
  | 'additional'
  | 'shift-end'

export const JOURNEY_META: Record<AtlasJourney, { label: string; order: number }> = {
  entry: { label: 'Application Entry', order: 0 },
  daily: { label: 'Daily Operation', order: 1 },
  'shipment-ops': { label: 'Shipment Operations', order: 2 },
  'payment-fiscal': { label: 'Payment & Fiscal', order: 3 },
  additional: { label: 'Additional Operations', order: 4 },
  'shift-end': { label: 'Shift Completion', order: 5 },
}

export type AtlasScreen = {
  id: string
  label: string
  journey: AtlasJourney
  /** Main Fragment/Activity file (relative to package root). */
  file?: string
  viewModel?: string
  desc?: string
}

export const ATLAS_SCREENS: AtlasScreen[] = [
  // Application Entry
  {
    id: 'login',
    label: 'Login',
    journey: 'entry',
    file: 'login/LoginFragment.kt',
    viewModel: 'SharedViewModel',
    desc: 'Kullanıcı/cihaz girişi, host seçimi (URL/port/scheme), versiyon ve consent kontrolleri.',
  },
  {
    id: 'account-settings',
    label: 'Account Settings',
    journey: 'entry',
    file: 'accountSettings/AccountSettingsFragment.kt',
    desc: 'Şifre değişikliği ve host konfigürasyonu.',
  },
  // Daily Operation
  {
    id: 'stop-list',
    label: 'Stop List',
    journey: 'daily',
    file: 'stop_list/StopListFragment.kt',
    viewModel: 'StopViewModel',
    desc: 'Günün schedule’ı; offline kuyruk merge’i ile Room’a yazılır.',
  },
  {
    id: 'task-list',
    label: 'Task List',
    journey: 'daily',
    file: 'task_list/TaskListFragment.kt',
    desc: 'Bir stop içindeki görevler; shipment detayları ve remark akışları.',
  },
  {
    id: 'barcode-routing',
    label: 'Barcode Routing / Vehicle Load',
    journey: 'daily',
    file: 'barcoderouting/BarcodeRoutingFragment.kt',
    viewModel: 'BarcodeRoutingViewModel',
    desc: 'Barkod okutarak araca yükleme / araçtan indirme.',
  },
  {
    id: 'manuel-routing',
    label: 'Manual Routing',
    journey: 'daily',
    file: 'manuelRouting/ManuelRoutingFragment.kt',
    desc: 'Manuel rota, stop sıralama, merge/split stop.',
  },
  {
    id: 'linehaul',
    label: 'Linehaul Load',
    journey: 'daily',
    file: 'linehaul/LinehaulLoadFragment.kt',
    desc: 'Linehaul yükleme/boşaltma operasyonu.',
  },
  {
    id: 'vehicle-welcome',
    label: 'Vehicle Welcome',
    journey: 'daily',
    file: 'handTransaction/…',
    desc: 'Araç karşılama, cargo transaction, sürücü/zone atamaları.',
  },
  // Shipment Operations
  {
    id: 'delivery',
    label: 'Delivery',
    journey: 'shipment-ops',
    file: 'delivery/DeliveryFragment.kt',
    viewModel: 'SharedViewModel',
    desc: 'Teslimat + ödeme + fiscal orkestrasyon merkezi (~2000 satır).',
  },
  {
    id: 'delivery-failed',
    label: 'Delivery Failed',
    journey: 'shipment-ops',
    file: 'deliveryFailed/DeliveryFailedFragment.kt',
    desc: 'Teslim edilemedi akışı; neden seçimi ve offline kuyruk.',
  },
  {
    id: 'pickup',
    label: 'Pick Up',
    journey: 'shipment-ops',
    file: 'pickup/PickUpFragment.kt',
    desc: 'Pickup parseli araca alma; duplicate-pickup korumalı.',
  },
  {
    id: 'pickup-failed',
    label: 'Pickup Failed',
    journey: 'shipment-ops',
    file: 'pickupFailed/PickupFailedFragment.kt',
    desc: 'Pickup başarısız akışı.',
  },
  {
    id: 'parcel-release',
    label: 'Parcel Release',
    journey: 'shipment-ops',
    file: 'parcelRelease/ParcelReleaseFragment.kt',
    desc: 'Parsel bırakma ve counter lokasyona devir.',
  },
  {
    id: 'shipment-tracking',
    label: 'Shipment Tracking',
    journey: 'shipment-ops',
    file: 'shipmentTracking/ShipmentTrackingFragment.kt',
    desc: 'Waybill sorgulama, hareket geçmişi, fatura görüntüleme.',
  },
  {
    id: 'damage',
    label: 'Damage / Case Detection',
    journey: 'shipment-ops',
    file: 'others/damage/DamageFragment.kt',
    desc: 'Hasar kaydı ve durum tespit dokümanı.',
  },
  {
    id: 'ktf',
    label: 'KTF',
    journey: 'shipment-ops',
    file: 'others/CreateKTFFragment.kt',
    desc: 'E-KTF oluşturma.',
  },
  // Payment & Fiscal (all orchestrated inside DeliveryFragment)
  {
    id: 'payment-collection',
    label: 'Payment & Collection',
    journey: 'payment-fiscal',
    file: 'delivery/DeliveryFragment.kt',
    desc: 'Cash / SoftPOS / RaiPay / WSPay-VPos rayları; DeliveryFragment içinde orkestre edilir.',
  },
  {
    id: 'fiscal-invoice',
    label: 'Fiscal Invoice',
    journey: 'payment-fiscal',
    file: 'delivery/DeliveryFragment.kt',
    desc: 'Fiscal create/retry/refund; sonuç Room FiscalInvoiceData tablosuna yazılır.',
  },
  {
    id: 'signature',
    label: 'Signature',
    journey: 'payment-fiscal',
    file: 'signaturepad/…',
    desc: 'İmza yakalama ve gönderimi.',
  },
  {
    id: 'gray-label',
    label: 'Gray Label / Price Calc',
    journey: 'payment-fiscal',
    file: 'grayLabel/GrayLabelCalculatorFragment.kt',
    desc: 'Fiyat hesaplama ve red/grey label shipment oluşturma.',
  },
  // Additional Operations
  {
    id: 'd4me-locker',
    label: 'D4Me / Locker',
    journey: 'additional',
    file: 'leanlocker/LeanLockerTaskListFragment.kt',
    desc: 'D4M counter/locker rezervasyon ve tamamlama akışları.',
  },
  {
    id: 'map',
    label: 'Map / Geocode',
    journey: 'additional',
    file: 'map/MapFragment.kt',
    desc: 'Harita, adres geocode güncelleme, hub listesi, konum takibi.',
  },
  {
    id: 'hub-companion',
    label: 'Hub Companion',
    journey: 'additional',
    file: 'hubcompanion/scanparcel/ScanParcelFragment.kt',
    viewModel: 'ScanParcelViewModel',
    desc: 'Hub içi tarama, event işleme ve log görüntüleme.',
  },
  {
    id: 'ask-question',
    label: 'Ask Question / Chat',
    journey: 'additional',
    file: 'askQuestion/AskQuestionFragment.kt',
    desc: 'Soru-cevap ve mesajlaşma akışı.',
  },
  // Shift Completion
  {
    id: 'end-of-day',
    label: 'End of Day',
    journey: 'shift-end',
    file: 'schedule/stop/endofday/EndOfDayFragment.kt',
    desc: 'Gün sonu kapanışı, cash desk teslimi ve envanter senkronu.',
  },
]

// ─── Domains ────────────────────────────────────────────────────────────────

export type AtlasDomain =
  | 'auth'
  | 'schedule'
  | 'routing'
  | 'shipment'
  | 'delivery'
  | 'pickup'
  | 'payment'
  | 'fiscal'
  | 'locker'
  | 'hubcompanion'
  | 'tracking'
  | 'system'

export const DOMAIN_META: Record<AtlasDomain, { label: string; tone: Tone; desc: string }> = {
  auth: { label: 'Auth', tone: 'indigo', desc: 'Login, cihaz girişi, şifre, rol/permission.' },
  schedule: { label: 'Schedule', tone: 'blue', desc: 'Günlük schedule, stop listesi, gün durumu.' },
  routing: { label: 'Routing', tone: 'teal', desc: 'Manuel rota, sıralama, merge/split, mesafe.' },
  shipment: { label: 'Shipment', tone: 'orange', desc: 'Shipment detayı, arama, tracking, linehaul.' },
  delivery: { label: 'Delivery', tone: 'green', desc: 'Teslimat tamamlama/başarısız, remark, release.' },
  pickup: { label: 'Pickup', tone: 'amber', desc: 'Pickup alma/başarısız, pickup task üretimi.' },
  payment: { label: 'Payment', tone: 'purple', desc: 'Collection status, RaiPay/SoftPOS/WSPay rayları.' },
  fiscal: { label: 'Fiscal', tone: 'red', desc: 'Fiscal invoice create/retry/refund/detail.' },
  locker: { label: 'D4Me / Locker', tone: 'nesy', desc: 'D4M counter ve locker rezervasyonları.' },
  hubcompanion: { label: 'Hub Companion', tone: 'teal', desc: 'Hub içi tarama ve event işleme.' },
  tracking: { label: 'Tracking', tone: 'blue', desc: 'Kurye konumu ve cihaz bilgisi telemetrisi.' },
  system: { label: 'System', tone: 'gray', desc: 'Versiyon, consent, diagnostik, dead-letter.' },
}

export const DOMAIN_ORDER: AtlasDomain[] = [
  'auth', 'schedule', 'routing', 'shipment', 'delivery', 'pickup',
  'payment', 'fiscal', 'locker', 'hubcompanion', 'tracking', 'system',
]

// ─── Contract model ─────────────────────────────────────────────────────────

export type ContractStatus =
  | 'verified'
  | 'reviewed'
  | 'draft'
  | 'detected'
  | 'mismatch'
  | 'deprecated'

export const CONTRACT_STATUS_META: Record<ContractStatus, { label: string; tone: Tone }> = {
  verified: { label: 'Verified', tone: 'green' },
  reviewed: { label: 'Reviewed', tone: 'teal' },
  draft: { label: 'Draft', tone: 'amber' },
  detected: { label: 'Detected', tone: 'gray' },
  mismatch: { label: 'Contract mismatch', tone: 'red' },
  deprecated: { label: 'Deprecated', tone: 'red' },
}

export type ChainLayer =
  | 'action'
  | 'ui'
  | 'viewmodel'
  | 'repository'
  | 'queue'
  | 'api'
  | 'external'
  | 'response'
  | 'db'
  | 'state'

export const CHAIN_LAYER_META: Record<ChainLayer, { label: string; tone: Tone }> = {
  action: { label: 'User action', tone: 'orange' },
  ui: { label: 'UI', tone: 'blue' },
  viewmodel: { label: 'ViewModel', tone: 'indigo' },
  repository: { label: 'Repository', tone: 'teal' },
  queue: { label: 'Offline queue', tone: 'amber' },
  api: { label: 'HTTP request', tone: 'purple' },
  external: { label: 'External provider', tone: 'red' },
  response: { label: 'Response', tone: 'green' },
  db: { label: 'Room / storage', tone: 'nesy' },
  state: { label: 'UI result', tone: 'gray' },
}

export type ChainStep = { layer: ChainLayer; label: string; detail?: string }

export type FieldSpec = {
  field: string
  type: string
  required: 'yes' | 'no' | 'conditional'
  /** Where the value comes from on the mobile side — the most important column. */
  source: string
  validation?: string
  sensitive?: boolean
}

export type ResponseMap = { field: string; destination: string; action: string }

export type ErrorRow = { status: string; backend: string; mobile: string; user: string }

export type CodeRef = { layer: string; file: string; method: string }

export type TestRow = { name: string; status: 'covered' | 'partial' | 'missing'; env?: string }

export type AtlasContract = {
  /** Kotlin function name in APIService.kt — unique, meaningful id. */
  id: string
  screen: string
  action: string
  trigger?: string
  method: 'POST' | 'MULTIPART'
  path: string
  domain: AtlasDomain
  requestModel: string
  responseModel: string
  auth: boolean
  /** Goes through the Room `Request` queue (RequestSenderService). */
  offline: boolean
  /** Inserted with isWaitingRequest=true — released after the 120 s undo window. */
  waiting?: boolean
  /** Receives the X-Protected-Request-Key anti-tamper header. */
  protectedKey?: boolean
  external?: string
  status: ContractStatus
  lastChecked?: string
  owner?: string
  summary?: string
  preconditions?: string[]
  postEffects?: string[]
  chain?: ChainStep[]
  codeRefs?: CodeRef[]
  requestFields?: FieldSpec[]
  requestExample?: string
  responseExample?: string
  responseMapping?: ResponseMap[]
  extraHeaders?: { header: string; usage: string }[]
  errors?: ErrorRow[]
  observability?: { logFields?: string[]; events?: string[]; note?: string }
  tests?: TestRow[]
  notes?: string
}

// ─── Common headers (di/AuthInterceptor.kt) ─────────────────────────────────

export const COMMON_HEADERS: {
  header: string
  source: string
  required: boolean
  example: string
}[] = [
  { header: 'Authorization', source: 'SP.token (secure storage)', required: true, example: 'Bearer ***' },
  { header: 'X-DeviceId', source: 'Settings.Secure.ANDROID_ID', required: true, example: 'Masked' },
  { header: 'X-Client-Request-Time', source: 'getDateTimeWithTimeZone()', required: true, example: '2026-07-18T09:42:11+02:00' },
  { header: 'X-Client-Request-Lat', source: 'SP.latestLatitute', required: true, example: '45.81' },
  { header: 'X-Client-Request-Long', source: 'SP.latestLongitude', required: true, example: '15.98' },
  { header: 'X-Channel', source: 'Static', required: true, example: 'Terminal' },
  { header: 'X-Client-Version', source: 'SP.versionCode', required: true, example: '1157' },
  { header: 'X-Device-Info', source: 'Manufacturer + model + Android + carrier', required: true, example: 'Zebra TC26 · Android 11' },
  { header: 'X-AppName', source: 'SP.appName', required: true, example: 'NesyMobile (GetLatestVersion hariç)' },
]

// ─── Backend topology (NesyMobileArchive) ───────────────────────────────────
// NESY.APIGateway (KrakenD 2.11 + Go router plugin) fronts .NET microservices.
// Routing convention: POST /{Service}/{topic} → {service}-webapi-service; topic =
// public method name on the service's Operation class. `f/` prefix = multipart.

export const GATEWAY_FACTS = {
  stack: 'KrakenD 2.11 + custom Go router plugin (NESY.APIGateway/router-plugin/plugin.go)',
  convention:
    'POST /{Service}/{topic} → ilgili mikroservise forward; topic = Operation sınıfındaki public metod adı, ilk parametre tipi = request body. f/{topic} = multipart.',
  authPipeline: [
    'Bearer JWT doğrulama (Authorization) — geçersizse 401 "Not valid JWT"',
    'JTI blacklist — Kafka BlacklistJTI topic’inden beslenen TTL cache; eşleşirse 401 "Logout required"',
    'Korunan endpoint’lerde X-Protected-Request-Key — RSA imza doğrulaması (MobileKeyValidator)',
    'X-AppName + X-Client-Version canlı versiyon haritasıyla karşılaştırılır (şu an log-only)',
  ],
  envelope: 'BaseResponse { ResultCode: int, ResultMessage: string, Payload: object }',
  tenants:
    'Ülke/ortam başına ayrı gateway config (ArasKargoProd, ExpressoneBAProd, CityexpressProd, StarexAZProd, …) — aynı endpoint’ler, farklı backend host’ları.',
}

export type BackendService = {
  name: string
  port?: number
  prefix: string[]
  desc: string
}

export const BACKEND_SERVICES: BackendService[] = [
  { name: 'UserWebAPI / IdentityService', port: 5001, prefix: ['Auth', 'User', 'Role', 'Permission'], desc: 'Login, OTP, PIN, cihazlar, consent, roller' },
  { name: 'TaskWebAPI', port: 5003, prefix: ['Task'], desc: 'Schedule, stop, delivery, pickup, end-of-day, D4Me — kurye iş akışının merkezi' },
  { name: 'ShipmentWebAPI', port: 5013, prefix: ['Shipment'], desc: 'Shipment, payment (RaiPay/WSPay/SoftPOS), fiscal, locker, cash desk, pricing' },
  { name: 'HistoryWebAPI', port: 5004, prefix: ['History'], desc: 'Audit/history olayları, dead-letter diagnostik' },
  { name: 'TrackingWebAPI', port: 5005, prefix: ['Tracking'], desc: 'Kurye konumu, delivery proof, cihaz telemetrisi' },
  { name: 'IntegrationWebAPI', port: 5006, prefix: ['Integration'], desc: 'Dış sistem entegrasyonu, dosya import/export' },
  { name: 'RoutingWebAPI', port: 5007, prefix: ['Routing'], desc: 'Rota optimizasyonu, mesafe, ETA (Google + custom optimizer)' },
  { name: 'NotificationWebAPI', port: 5008, prefix: ['Notification'], desc: 'Bildirim dağıtımı' },
  { name: 'EventTowerWebAPI', port: 5011, prefix: ['EventTower'], desc: 'Event orkestrasyonu' },
  { name: 'GeocodeWebAPI', port: 5015, prefix: ['Geocode'], desc: 'Geocoding, hub lokasyonları' },
  { name: 'VersioningWebAPI', port: 5016, prefix: ['Version'], desc: 'Mobil versiyon / forced-update linkleri' },
  { name: 'CustomerWebAPI', port: 5017, prefix: ['Customer'], desc: 'Müşteri, fiyatlama, adres defteri' },
  { name: 'HubCompanionWebAPI', port: 5018, prefix: ['HubCompanion'], desc: 'Hub tarama companion — foto, event log' },
]

export function backendServiceForPath(path: string): BackendService | undefined {
  const seg = path.split('/')[0] ?? ''
  return BACKEND_SERVICES.find((s) => s.prefix.includes(seg))
}

export const OFFLINE_QUEUE_FACTS = {
  entity: 'Request (database/Request.kt) — unique index: uniqueKey (dedup on insert, OnConflictStrategy.IGNORE)',
  service: 'services/RequestSenderService.kt (foreground service)',
  drainInterval: '3 sn (DEFAULT_SYNC_INTERVAL) — FIFO, single-flight (isProcessing transaction)',
  waitingWindow: '120 sn undo penceresi (isWaitingRequest=true, 1 sn tarama)',
  maxRetry: 3,
  retryPolicy:
    'tryCount < 3; network hataları (UnknownHost, SocketTimeout) tryCount artırmaz. 3. denemede CompletedRequest arşivine düşer ve History/SaveTerminalFailedRequests dead-letter isteği kuyruğa eklenir.',
  housekeeping: '7 günden eski completed request temizlenir; her yazım SharedRequestLogs/ dosyasına da loglanır.',
}

// ─── Contracts ──────────────────────────────────────────────────────────────

export const ATLAS_CONTRACTS: AtlasContract[] = [
  // ═══ LOGIN ═════════════════════════════════════════════════════════════
  {
    id: 'login',
    screen: 'login',
    action: 'Sign In',
    trigger: 'Login butonu — kullanıcı adı/şifre girildikten sonra',
    method: 'POST',
    path: 'Auth/LoginMobile/',
    domain: 'auth',
    requestModel: 'LoginRequest',
    responseModel: 'LoginResponse',
    auth: false,
    offline: false,
    status: 'verified',
    lastChecked: '18 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Kullanıcıyı backend üzerinde doğrular ve oturum token’ını döner. Tüm sonraki isteklerin Authorization header’ı bu token ile kurulur.',
    preconditions: [
      'Host seçimi yapılmış (HostSelectionInterceptor — SP.alternativeURL)',
      'GetLatestVersion kontrolü geçilmiş',
    ],
    postEffects: [
      'SP.token güncellenir — AuthInterceptor sonraki tüm isteklere Bearer ekler',
      'SP.userName / fullName / unitName yazılır',
      'Rol izinleri için GetCurrentUserMobileCachedPermissions çağrılır',
    ],
    chain: [
      { layer: 'action', label: 'Sign In', detail: 'LoginFragment' },
      { layer: 'viewmodel', label: 'SharedViewModel.loginUser()', detail: 'main/SharedViewModel.kt:212' },
      { layer: 'repository', label: 'MainRepository.loginUser()' },
      { layer: 'api', label: 'POST Auth/LoginMobile/' },
      { layer: 'response', label: '200 LoginResponse' },
      { layer: 'db', label: 'SP.token = payload.token', detail: 'SharedPreferences (util/SP)' },
      { layer: 'state', label: 'Resource.success → Stop List’e yönlendirme' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'login/LoginFragment.kt', method: 'onLoginClicked()' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'loginUser() · :212' },
      { layer: 'Repository', file: 'main/MainRepository.kt', method: 'loginUser()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'login()' },
    ],
    requestFields: [
      { field: 'userName', type: 'String', required: 'yes', source: 'User input', validation: 'Non-empty' },
      { field: 'password', type: 'String', required: 'yes', source: 'User input', validation: 'Non-empty', sensitive: true },
      { field: 'deviceId', type: 'String', required: 'yes', source: 'Settings.Secure.ANDROID_ID', sensitive: true },
      { field: 'appVersion', type: 'String', required: 'yes', source: 'BuildConfig / SP.versionCode' },
    ],
    responseMapping: [
      { field: 'payload.token', destination: 'SP.token', action: 'AuthInterceptor Bearer kaynağı olur' },
      { field: 'payload.userName', destination: 'SP.userName', action: 'Kuyruk kullanıcı ayrımı (findNextPendingRequestForUser)' },
      { field: 'success', destination: 'ViewModel Resource', action: 'UI state — hata/başarı' },
    ],
    errors: [
      { status: '400/422', backend: 'Validation / wrong credentials', mobile: 'Resource.error', user: 'Hata mesajı — form korunur' },
      { status: '401', backend: 'Unauthorized', mobile: 'ErrorInterceptor → GlobalNavigator.logout', user: 'Login ekranında kalır' },
      { status: 'Version mismatch', backend: 'Özel kod', mobile: 'Zorunlu logout', user: '“Yeni versiyon gerekli” mesajı' },
    ],
    tests: [
      { name: 'Happy path', status: 'covered', env: 'Manual' },
      { name: 'Wrong password', status: 'covered', env: 'Manual' },
      { name: 'Version mismatch forced logout', status: 'missing' },
    ],
  },
  {
    id: 'loginDevice',
    screen: 'login',
    action: 'Sign In',
    method: 'POST',
    path: 'Auth/LoginDevice/',
    domain: 'auth',
    requestModel: 'LoginRequest',
    responseModel: 'LoginResponse',
    auth: false,
    offline: false,
    status: 'reviewed',
    summary: 'Cihaz bazlı giriş varyantı; SP.userName da bu akışta yazılır (SharedViewModel:267).',
  },
  {
    id: 'getLatestVersion',
    screen: 'login',
    action: 'Screen Open',
    method: 'POST',
    path: 'Version/GetLatestVersion/',
    domain: 'system',
    requestModel: 'GetLatestVersionRequest',
    responseModel: 'GetLatestVersionResponse',
    auth: false,
    offline: false,
    status: 'reviewed',
    summary:
      'Versiyon kontrolü. HostSelectionInterceptor ve X-AppName header’ı bu endpoint’i atlar — her zaman varsayılan host’a gider.',
  },
  {
    id: 'getCurrentUserMobileCachedPermissions',
    screen: 'login',
    action: 'Sign In',
    method: 'POST',
    path: 'Role/GetCurrentUserMobileCachedPermissions',
    domain: 'auth',
    requestModel: 'GetCurrentUserMobileCachedPermissionRequest',
    responseModel: 'GetUserRoleForDrawer',
    auth: true,
    offline: false,
    status: 'detected',
    summary: 'Drawer menü izinleri — login sonrası rol cache’i.',
  },
  {
    id: 'checkUserConsent',
    screen: 'login',
    action: 'Sign In',
    method: 'POST',
    path: 'User/CheckUserConsent/',
    domain: 'system',
    requestModel: 'String (userID)',
    responseModel: 'CheckUserConsentResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'saveUserConsent',
    screen: 'login',
    action: 'Accept Consent',
    method: 'POST',
    path: 'User/SaveUserConsent/',
    domain: 'system',
    requestModel: 'List<SaveUserConsentRequest>',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'checkHasCourierTodaySchedule',
    screen: 'login',
    action: 'Sign In',
    method: 'POST',
    path: 'Task/CheckHasCourierTodaySchedule/',
    domain: 'schedule',
    requestModel: 'String',
    responseModel: 'CheckHasCourierTodayScheduleBaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
    summary: 'Login sonrası bugünkü schedule var mı kontrolü.',
  },
  // ═══ ACCOUNT SETTINGS ══════════════════════════════════════════════════
  {
    id: 'loggedInUserChangeOwnPassword',
    screen: 'account-settings',
    action: 'Change Password',
    method: 'POST',
    path: 'Auth/LoggedInUserChangeOwnPassword/',
    domain: 'auth',
    requestModel: 'LoggedInUserChangeOwnPasswordRequest',
    responseModel: 'LoggedInUserChangeOwnPasswordResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'loggedOutUserChangePassword',
    screen: 'account-settings',
    action: 'Reset Password',
    method: 'POST',
    path: 'Auth/LoggedOutUserChangePassword/',
    domain: 'auth',
    requestModel: 'LoggedOutUserChangePasswordRequest',
    responseModel: 'AccountPswChangeResponse',
    auth: false,
    offline: false,
    status: 'detected',
  },
  // ═══ STOP LIST / SCHEDULE ══════════════════════════════════════════════
  {
    id: 'getMySchedule',
    screen: 'stop-list',
    action: 'Screen Open / Refresh',
    trigger: 'Stop List açılışı veya pull-to-refresh',
    method: 'POST',
    path: 'Task/GetMyScheduleByZoneCode/',
    domain: 'schedule',
    requestModel: 'GetMyScheduleRequest',
    responseModel: 'Schedule',
    auth: true,
    offline: false,
    protectedKey: true,
    status: 'verified',
    lastChecked: '18 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Günün schedule’ını çeker. Cevap Room’a yazılmadan önce kuyrukta bekleyen ve tamamlanmış offline istekler payload’a merge edilir — taze veri, henüz gönderilmemiş lokal işlemleri ezmez.',
    preconditions: ['Login tamamlanmış (Bearer token)', 'Zone/route seçimi yapılmış'],
    postEffects: [
      'updateScheduleWithPendingRequests() + updateScheduleWithCompletedRequests() merge',
      'ScheduleRepository.saveScheduleToLocal(payload) → Room schedule + scheduleStopChunk',
      'Stop List UI LiveData ile yeniden çizilir',
    ],
    chain: [
      { layer: 'action', label: 'Screen Open / Refresh', detail: 'StopListFragment' },
      { layer: 'viewmodel', label: 'SharedViewModel.getStops()', detail: 'main/SharedViewModel.kt:605' },
      { layer: 'repository', label: 'MainRepository.getMyAllSchedule()' },
      { layer: 'api', label: 'POST Task/GetMyScheduleByZoneCode/', detail: 'X-Protected-Request-Key imzalı' },
      { layer: 'response', label: '200 Schedule payload' },
      { layer: 'response', label: 'Pending/completed offline istekler merge edilir' },
      { layer: 'db', label: 'Room schedule + scheduleStopChunk', detail: 'ScheduleRepository.saveScheduleToLocal' },
      { layer: 'state', label: 'Stop List yeniden hesaplanır' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'stop_list/StopListFragment.kt', method: 'observe/refresh' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'getStops() · :605' },
      { layer: 'Repository', file: 'main/MainRepository.kt', method: 'getMyAllSchedule()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getMySchedule()' },
      { layer: 'DB', file: 'main/ScheduleRepository.kt', method: 'saveScheduleToLocal()' },
      { layer: 'DAO', file: 'database/schedule/ScheduleDao.kt', method: 'insert/replace' },
    ],
    extraHeaders: [
      { header: 'X-Protected-Request-Key', usage: 'encryptAppSignature(...) — anti-tamper imza (yalnız GetMySchedule + DeliverParcels)' },
    ],
    responseMapping: [
      { field: 'payload (Schedule)', destination: 'Room schedule / scheduleStopChunk', action: 'Lokal kaynak güncellenir' },
      { field: 'stops[].tasks[]', destination: 'Stop List UI', action: 'LiveData ile liste yeniden çizilir' },
      { field: 'scheduleId', destination: 'SP.scheduleId', action: 'Aktif schedule bağlamı' },
    ],
    errors: [
      { status: '401', backend: 'Token expired', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '5xx / timeout', backend: 'Server error', mobile: 'Resource.error — lokal Room verisi gösterilmeye devam eder', user: 'Eski liste + hata bildirimi' },
    ],
    observability: {
      logFields: ['scheduleId', 'zoneCode', 'responseCode', 'duration'],
      note: 'Schedule chunk’ları büyük payload’larda bölünür (ScheduleStopChunk).',
    },
    tests: [
      { name: 'Happy path', status: 'covered', env: 'Manual' },
      { name: 'Offline merge (pending request ezilmez)', status: 'partial', env: 'Manual' },
      { name: 'Büyük schedule chunk bölme', status: 'missing' },
    ],
  },
  {
    id: 'createEmptySchedule',
    screen: 'stop-list',
    action: 'Create Empty Schedule',
    method: 'POST',
    path: 'Task/CreateEmptyScheduleDocument/',
    domain: 'schedule',
    requestModel: 'CreateEmptyScheduleRequest',
    responseModel: 'Schedule',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'getTodaySelectedScheduleRouteList',
    screen: 'stop-list',
    action: 'Route Selection',
    method: 'POST',
    path: 'Task/GetTodaySelectedScheduleRouteList',
    domain: 'schedule',
    requestModel: 'String',
    responseModel: 'GetTodaySelectedScheduleRouteListBaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'rerouteSchedule',
    screen: 'stop-list',
    action: 'Reroute',
    method: 'POST',
    path: 'Task/RerouteSchedule/',
    domain: 'routing',
    requestModel: 'String',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'addUserIdToSchedule',
    screen: 'stop-list',
    action: 'Claim Schedule',
    method: 'POST',
    path: 'Task/AddUserIdToSchedule',
    domain: 'schedule',
    requestModel: 'AddUserIdToScheduleRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'removeUserIdFromSchedule',
    screen: 'stop-list',
    action: 'Release Schedule',
    method: 'POST',
    path: 'Task/RemoveUserIdFromSchedule',
    domain: 'schedule',
    requestModel: 'String ("{}")',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'scheduleStatusChange',
    screen: 'stop-list',
    action: 'Start / Pause Schedule',
    method: 'POST',
    path: 'Task/ScheduleStatusChange',
    domain: 'schedule',
    requestModel: 'AddUserIdToScheduleRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'setTaskToComeAgain',
    screen: 'stop-list',
    action: 'Come Again',
    method: 'POST',
    path: 'Task/SetTaskToComeAgain/',
    domain: 'schedule',
    requestModel: 'ComeAgainRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: true,
    status: 'draft',
    summary: 'Görevi stop listesinin sonuna taşır — kuyruk tipi MoveTaskToEndOfStopList.',
  },
  {
    id: 'orderStopList',
    screen: 'stop-list',
    action: 'Reorder Stops',
    method: 'POST',
    path: 'Task/OrderStopListFromTerminal/',
    domain: 'routing',
    requestModel: 'ManualRoutingReq',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  // ═══ TASK LIST ═════════════════════════════════════════════════════════
  {
    id: 'getShipmentDetails',
    screen: 'task-list',
    action: 'Open Task',
    method: 'POST',
    path: 'Shipment/GetShipmentDetails/',
    domain: 'shipment',
    requestModel: 'GetShipmentDetailsRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'draft',
    summary: 'Görev açılırken shipment detaylarını çeker.',
  },
  {
    id: 'updateDeliveryRemark',
    screen: 'task-list',
    action: 'Update Remark',
    method: 'POST',
    path: 'Task/UpdateDeliveryRemark/',
    domain: 'delivery',
    requestModel: 'UpdateDeliveryRemarkReq',
    responseModel: 'BaseResponse',
    auth: true,
    offline: true,
    status: 'draft',
    summary: 'Teslimat notu güncelleme — offline kuyruk destekli (UpdateDeliveryRemarkRequest tipi).',
  },
  {
    id: 'getNotificationMessagesByShipmentId',
    screen: 'task-list',
    action: 'Open Remarks',
    method: 'POST',
    path: 'Notification/GetNotificationMessagesByShipmentId',
    domain: 'shipment',
    requestModel: 'SearchNotificationMessageRequest',
    responseModel: 'RemarkMessageResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'createNotificationMessage',
    screen: 'task-list',
    action: 'Send Remark',
    method: 'POST',
    path: 'Notification/CreateNotificationMessage',
    domain: 'shipment',
    requestModel: 'NotificationMessageRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'restartTask',
    screen: 'task-list',
    action: 'Restore Task',
    method: 'POST',
    path: 'Task/RestoreTaskState',
    domain: 'schedule',
    requestModel: 'RestartTaskReq',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  // ═══ BARCODE ROUTING / VEHICLE LOAD ═══════════════════════════════════
  {
    id: 'loadParcelToCourierVehicle',
    screen: 'barcode-routing',
    action: 'Scan & Load',
    trigger: 'Barkod okutma — araca yükleme',
    method: 'POST',
    path: 'Task/LoadParcelToCourierVehicle/',
    domain: 'shipment',
    requestModel: 'List<String>',
    responseModel: 'BaseResponse',
    auth: true,
    offline: true,
    status: 'reviewed',
    summary:
      'Barkodları araca yükler. Kuyruk case’inde barkod bazlı dedup var; kuyruk tipi LOAD_PARCEL_TO_COURIER_VEHICLE (RequestSenderService:267).',
    chain: [
      { layer: 'action', label: 'Scan Barcode', detail: 'BarcodeRoutingFragment' },
      { layer: 'viewmodel', label: 'SharedViewModel.saveRequest(LOAD_PARCEL_TO_COURIER_VEHICLE)' },
      { layer: 'queue', label: 'Room Request satırı', detail: 'uniqueKey dedup' },
      { layer: 'api', label: 'POST Task/LoadParcelToCourierVehicle/' },
      { layer: 'db', label: 'Parcel cache + CompletedRequest arşivi' },
    ],
  },
  {
    id: 'unloadParcelFromCourierVehicle',
    screen: 'barcode-routing',
    action: 'Scan & Unload',
    method: 'POST',
    path: 'Task/UnloadParcelFromCourierVehicle/',
    domain: 'shipment',
    requestModel: 'UnloadFromCourierVehicleReq',
    responseModel: 'BaseResponse',
    auth: true,
    offline: true,
    status: 'draft',
  },
  {
    id: 'insertShipmentNotDeliveredControl',
    screen: 'barcode-routing',
    action: 'Not-Delivered Control',
    method: 'POST',
    path: 'Task/InsertShipmentNotDeliveredControl/',
    domain: 'shipment',
    requestModel: 'CargoBarcode',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'createCourierDailyBarcode',
    screen: 'barcode-routing',
    action: 'Create Daily Barcode',
    method: 'POST',
    path: 'Task/CreateCourierDailyBarcode',
    domain: 'shipment',
    requestModel: 'CreateCourierDailyBarcodeRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  // ═══ MANUAL ROUTING ════════════════════════════════════════════════════
  {
    id: 'manuelRoute',
    screen: 'manuel-routing',
    action: 'Calculate Route',
    method: 'POST',
    path: 'Routing/ManualRoute/',
    domain: 'routing',
    requestModel: 'ManuelRouteReq',
    responseModel: 'ManuelRouteResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'saveManuelRouting',
    screen: 'manuel-routing',
    action: 'Save Route',
    method: 'POST',
    path: 'Task/SaveManuelRouting/',
    domain: 'routing',
    requestModel: 'SaveManuelRoutingReq',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'calculateTotalDistance',
    screen: 'manuel-routing',
    action: 'Calculate Distance',
    method: 'POST',
    path: 'Routing/CalculateTotalDistance/',
    domain: 'routing',
    requestModel: 'CalculateTotalDistanceRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'manuelMergeStopsInSchedule',
    screen: 'manuel-routing',
    action: 'Merge Stops',
    method: 'POST',
    path: 'Task/ManuelMergeStopsInSchedule',
    domain: 'routing',
    requestModel: 'MergeAndSplitStopsRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'manuelSplitStopsInSchedule',
    screen: 'manuel-routing',
    action: 'Split Stops',
    method: 'POST',
    path: 'Task/ManuelSplitStopsInSchedule',
    domain: 'routing',
    requestModel: 'MergeAndSplitStopsRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'courierRouteChange',
    screen: 'manuel-routing',
    action: 'Change Route',
    method: 'POST',
    path: 'Task/CourierRouteChange/',
    domain: 'routing',
    requestModel: 'CourierRouteChangeReq',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  // ═══ LINEHAUL ══════════════════════════════════════════════════════════
  {
    id: 'getLinehaulAssignments',
    screen: 'linehaul',
    action: 'Screen Open',
    method: 'POST',
    path: 'Shipment/GetLinehaulAssignments/',
    domain: 'shipment',
    requestModel: 'GetLinehaulAssignmentsRequest',
    responseModel: 'GetLinehaulAssignmentsResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'loadToLineHaul',
    screen: 'linehaul',
    action: 'Load to Linehaul',
    method: 'POST',
    path: 'Shipment/LoadToLineHaul/',
    domain: 'shipment',
    requestModel: 'LoadToLinehaulRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'finishLoadToLinehaul',
    screen: 'linehaul',
    action: 'Finish Loading',
    method: 'POST',
    path: 'Shipment/FinishLoadtoLinehaul/',
    domain: 'shipment',
    requestModel: 'FinishLoadToLinehaulRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'getLoadedLinehaulDetails',
    screen: 'linehaul',
    action: 'Open Loaded Details',
    method: 'POST',
    path: 'Shipment/GetLoadedLinehaulDetails/',
    domain: 'shipment',
    requestModel: 'GetLoadedLinehaulDetailsRequest',
    responseModel: 'GetLinehaulDetailsResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'startUnloadFromLinehaul',
    screen: 'linehaul',
    action: 'Start Unload',
    method: 'POST',
    path: 'Shipment/StartUnloadFromLinehaul/',
    domain: 'shipment',
    requestModel: 'StartUnloadFromLinehaulRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'unloadFromLinehaul',
    screen: 'linehaul',
    action: 'Unload',
    method: 'POST',
    path: 'Shipment/Unload/',
    domain: 'shipment',
    requestModel: 'UnloadRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  // ═══ VEHICLE WELCOME ═══════════════════════════════════════════════════
  {
    id: 'getVehicleRouteForVehicleReception',
    screen: 'vehicle-welcome',
    action: 'Screen Open',
    method: 'POST',
    path: 'Integration/GetVehicleRouteForVehicleReception/',
    domain: 'shipment',
    requestModel: 'VehicleRouteForVehicleReceptionRequest',
    responseModel: 'VehicleWelcomeResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'insertVehicleReception',
    screen: 'vehicle-welcome',
    action: 'Confirm Reception',
    method: 'POST',
    path: 'Task/InsertVehicleReception/',
    domain: 'shipment',
    requestModel: 'VehicleRouteForVehicleReceptionRequest',
    responseModel: 'VehicleRouteForVehicleReceptionResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'sendVehicleLoading',
    screen: 'vehicle-welcome',
    action: 'Cargo Transaction',
    method: 'POST',
    path: 'Task/InsertCargoTransaction',
    domain: 'shipment',
    requestModel: 'VehicleLoadingRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'updateVehicleCourierZoneDriverName',
    screen: 'vehicle-welcome',
    action: 'Assign Driver',
    method: 'POST',
    path: 'Task/UpdateVehicleCourierZoneDriverName/',
    domain: 'schedule',
    requestModel: 'String',
    responseModel: 'VehicleCourierZoneDriverNameResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'getBranchEmployeesByUnitId',
    screen: 'vehicle-welcome',
    action: 'Pick Driver/Courier',
    method: 'POST',
    path: 'User/GetBranchEmployeesByUnitId/',
    domain: 'auth',
    requestModel: 'String',
    responseModel: 'DriverCourierResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  // ═══ DELIVERY ══════════════════════════════════════════════════════════
  {
    id: 'deliverParcels',
    screen: 'delivery',
    action: 'Complete Delivery',
    trigger: 'Complete butonu — zorunlu alanlar (reason, ödeme, fiscal) tamamlandıktan sonra',
    method: 'POST',
    path: 'Task/DeliverParcels/',
    domain: 'delivery',
    requestModel: 'DeliveryReq',
    responseModel: 'BaseResponse',
    auth: true,
    offline: true,
    waiting: true,
    protectedKey: true,
    status: 'verified',
    lastChecked: '18 Tem 2026',
    owner: 'Mobile Core · Backend Delivery',
    summary:
      'Teslimatı backend üzerinde tamamlar. İstek önce Room kuyruğuna isWaitingRequest=true ile yazılır — kuryeye 120 sn geri alma penceresi tanır. VPos ödemeli teslimatlar beklemeden gönderilir.',
    preconditions: [
      'Aktif shipment/task mevcut (currentTask)',
      'Ödeme gerekiyorsa tamamlanmış (Cash/SoftPOS/RaiPay/WSPay)',
      'Fiscal gerekiyorsa CreateFiscalInvoice sonucu alınmış (Request.fiscalInvoiceId bağlanır)',
      'Delivery reason ve gerekli barkod doğrulaması yapılmış',
    ],
    postEffects: [
      'Backend shipment state güncellenir',
      'Request → CompletedRequest arşivi; OriginalShipmentItem kopyası silinir',
      'AutomationBridge.emit(DELIVER_PARCEL, SUCCESS)',
      'Sonraki GetMySchedule merge’inde stop tamamlanmış görünür',
    ],
    chain: [
      { layer: 'action', label: 'Complete Delivery', detail: 'DeliveryFragment' },
      { layer: 'ui', label: 'getDeliveryRequest(...)', detail: 'DeliveryFragment.kt ~:1469-1541 — DeliveryReq kurulumu' },
      { layer: 'viewmodel', label: 'SharedViewModel.saveRequest(DELIVER_PARCELS, json)', detail: 'main/SharedViewModel.kt:1277' },
      { layer: 'queue', label: 'Room Request satırı', detail: 'isWaitingRequest=true → 120 sn undo penceresi (VPos hariç)' },
      { layer: 'queue', label: 'RequestSenderService.createRequestV2()', detail: 'services/RequestSenderService.kt:347 — 3 sn FIFO drain' },
      { layer: 'repository', label: 'MainRepository.deliverParcels()' },
      { layer: 'api', label: 'POST Task/DeliverParcels/', detail: 'X-Protected-Request-Key imzalı' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'db', label: 'CompletedRequest arşivi + OriginalShipmentItem temizliği' },
      { layer: 'state', label: 'Stop List refresh — currentTask kapanır' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'delivery/DeliveryFragment.kt', method: 'getDeliveryRequest() · ~:1469' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'saveRequest() · :1277' },
      { layer: 'Queue', file: 'services/RequestSenderService.kt', method: 'createRequestV2() DELIVER_PARCELS · :347' },
      { layer: 'Repository', file: 'main/MainRepository.kt', method: 'deliverParcels()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'deliverParcels()' },
      { layer: 'DB', file: 'database/RequestDao.kt', method: 'findNextPendingRequestForUser()' },
    ],
    requestFields: [
      { field: 'waybillNumbers', type: 'List<String>', required: 'yes', source: 'currentTask / taranan barkodlar', validation: 'Non-empty' },
      { field: 'deliveryReason', type: 'Enum', required: 'yes', source: 'User selection', validation: 'Allowed values' },
      { field: 'collectionType', type: 'Enum', required: 'conditional', source: 'Ödeme rayı sonucu', validation: 'None olmamalı — validateAndRecoverCollectionType() savunması var' },
      { field: 'amount', type: 'Decimal', required: 'conditional', source: 'Shipment COD tutarı', validation: '≥ 0', sensitive: true },
      { field: 'fiscalInvoiceId', type: 'String', required: 'conditional', source: 'CreateFiscalInvoice cevabı (Request satırına bağlanır)', validation: 'Country rule', sensitive: true },
      { field: 'latitude / longitude', type: 'Double', required: 'no', source: 'Device GPS (SP.latestLat/Long)', validation: 'Valid range', sensitive: true },
      { field: 'scanDateTime', type: 'DateTime', required: 'yes', source: 'Device clock', validation: 'ISO-8601 + timezone' },
      { field: 'signature / photo refs', type: 'String', required: 'conditional', source: 'SignaturePad / SaveImageFile multipart', sensitive: true },
    ],
    requestExample: `{
  "waybillNumbers": ["45-40-20260718-1234"],
  "deliveryReason": "DELIVERED",
  "collectionType": "Cash",
  "amount": 42.50,
  "scanDateTime": "2026-07-18T09:42:11+02:00",
  "latitude": 45.8144,
  "longitude": 15.9780,
  "fiscalInvoiceId": "HR-2026-78422"
}`,
    responseExample: `{
  "success": true,
  "message": null,
  "payload": { "processedWaybills": ["45-40-20260718-1234"] }
}`,
    responseMapping: [
      { field: 'success', destination: 'RequestSenderService success path', action: 'Request → CompletedRequest arşivi, satır silinir' },
      { field: 'success', destination: 'AutomationBridge', action: 'DELIVER_PARCEL SUCCESS event emit edilir' },
      { field: 'error message', destination: 'tryCount / dead-letter', action: '3. denemede SaveTerminalFailedRequests kuyruğa eklenir' },
    ],
    extraHeaders: [
      { header: 'X-Protected-Request-Key', usage: 'Anti-tamper imza — yalnız GetMySchedule + DeliverParcels alır' },
    ],
    errors: [
      { status: '400/422', backend: 'Validation / business rule', mobile: 'tryCount++ → 3’te dead-letter', user: 'Teslimat “gönderilemedi” olarak arşivlenir' },
      { status: '401', backend: 'Token expired', mobile: 'ErrorInterceptor → logout (tek seferlik AtomicBoolean)', user: 'Login ekranı' },
      { status: 'Network error', backend: '—', mobile: 'tryCount artmaz, kuyrukta kalır', user: 'Bağlantı gelince otomatik gönderim' },
      { status: 'Timeout (60 sn)', backend: 'İşlem tamamlanmış olabilir', mobile: 'Retry — uniqueKey dedup duplicate insert’i engeller ama backend idempotency ayrı konu', user: 'Reconciliation gerekebilir' },
    ],
    observability: {
      logFields: ['requestName', 'waybillNumbers', 'tryCount', 'responseCode', 'fiscalInvoiceId', 'userName'],
      events: [
        'delivery_started',
        'payment_completed',
        'fiscal_created',
        'delivery_request_sent',
        'delivery_response_received',
        'request_archived',
      ],
      note: 'Her kuyruk yazımı SharedRequestLogs/ dosyasına da düşer; CollectionType=None kurtarması Crashlytics’e loglanır.',
    },
    tests: [
      { name: 'Happy path', status: 'covered', env: 'Manual' },
      { name: 'Offline queue drain', status: 'covered', env: 'Manual' },
      { name: '120 sn undo penceresi', status: 'partial', env: 'Manual' },
      { name: 'Timeout after success (duplicate)', status: 'missing' },
      { name: 'Process kill kuyruk kurtarma', status: 'missing' },
      { name: 'CollectionType=None recovery', status: 'partial', env: 'Crashlytics' },
    ],
    notes:
      'CollectionType kurtarma mantığı hem DeliveryFragment hem RequestSenderService.validateAndRecoverCollectionType() içinde duplike — bilinçli savunma (CollectionType=None veri kaybı bug’ına karşı). Backend tarafında birincil topic TaskWebAPI.DeliverParcelsV2 (DeliveryModel) — mobil path’i "Task/DeliverParcels/" ile eşleşme gateway config’i üzerinden doğrulanmalı.',
  },
  {
    id: 'deliverParcelsFromParcelShop',
    screen: 'delivery',
    action: 'Complete Delivery (Parcel Shop)',
    method: 'POST',
    path: 'Task/DeliverParcelsFromParcelShop/',
    domain: 'delivery',
    requestModel: 'DeliveryReq',
    responseModel: 'BaseResponse',
    auth: true,
    offline: true,
    waiting: true,
    status: 'reviewed',
    summary: 'Parcel shop teslim varyantı — kuyruk case’i RequestSenderService:386.',
  },
  {
    id: 'getShipmentCollection',
    screen: 'payment-collection',
    action: 'Check Payment Status',
    method: 'POST',
    path: 'Shipment/GetShipmentCollectionStatus',
    domain: 'payment',
    requestModel: 'CheckPaymentRequest',
    responseModel: 'CheckPaymentResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    summary: 'Shipment’ın tahsilat/ödeme durumunu sorgular — ödeme rayı seçilmeden önce çağrılır.',
  },
  {
    id: 'getPaymentId',
    screen: 'payment-collection',
    action: 'Start Payment',
    method: 'POST',
    path: 'Shipment/GetPaymentId',
    domain: 'payment',
    requestModel: 'String',
    responseModel: 'PaymentIdResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'sendPaymentSmsAgain',
    screen: 'payment-collection',
    action: 'Resend Payment SMS',
    method: 'POST',
    path: 'Task/',
    domain: 'payment',
    requestModel: 'SendPaymentSmsRequest',
    responseModel: 'CheckPaymentResponse',
    auth: true,
    offline: false,
    status: 'mismatch',
    notes: 'Path yalnızca "Task/" — endpoint adı belirsiz; backend sözleşmesiyle doğrulanmalı.',
  },
  {
    id: 'deviceBindingRaiPay',
    screen: 'payment-collection',
    action: 'Bind POS Terminal',
    method: 'POST',
    path: 'Shipment/RaipayBindMobilDeviceToPaymentTerminal',
    domain: 'payment',
    requestModel: 'RaipayDeviceBindReq',
    responseModel: 'RaipayDeviceBindResponse',
    auth: true,
    offline: false,
    external: 'RaiPay',
    status: 'mismatch',
    summary: 'Cihazı RaiPay ödeme terminaline bağlar — RaiPay akışının ilk adımı.',
    notes:
      'Mobil path "RaipayBindMobilDeviceToPaymentTerminal", backend topic adı "RaipayBindMobileDeviceToPaymentTerminal" (Mobil vs Mobile) — yazım farkı contract doğrulaması gerektiriyor.',
  },
  {
    id: 'fetchShipmentRaiPayAuthToken',
    screen: 'payment-collection',
    action: 'Start Card Payment (RaiPay)',
    method: 'POST',
    path: 'Shipment/RaiPayAuthToken',
    domain: 'payment',
    requestModel: 'ShipmentRaiPayAuthTokenRequest',
    responseModel: 'ShipmentRaiPayAuthTokenResponse',
    auth: true,
    offline: false,
    external: 'RaiPay',
    status: 'reviewed',
    summary: 'RaiPay auth token alır (DeliveryFragment:2832) — ardından payment token istenir.',
  },
  {
    id: 'fetchShipmentRaiPayPaymentToken',
    screen: 'payment-collection',
    action: 'Start Card Payment (RaiPay)',
    method: 'POST',
    path: 'Shipment/GetRaiPayPaymentToken',
    domain: 'payment',
    requestModel: 'ShipmentRaiPayPaymentTokenRequest',
    responseModel: 'ShipmentRaiPayPaymentTokenResponse',
    auth: true,
    offline: false,
    external: 'RaiPay',
    status: 'reviewed',
    summary: 'Payment token alınır (DeliveryFragment:2853) ve RaiPay uygulaması intent ile başlatılır.',
  },
  {
    id: 'fetchPaymentStatus',
    screen: 'payment-collection',
    action: 'Poll Payment Result',
    trigger: 'RaiPay intent sonucu döndükten sonra polling',
    method: 'POST',
    path: 'Shipment/GetRaiPayPaymentStatus',
    domain: 'payment',
    requestModel: 'ShipmentRaiPayPaymentStatusRequest',
    responseModel: 'ShipmentRaiPayPaymentStatusResponse',
    auth: true,
    offline: false,
    external: 'RaiPay',
    status: 'verified',
    lastChecked: '18 Tem 2026',
    summary:
      'RaiPay ödeme sonucunu backend üzerinden doğrular. External intent sonucu tek başına güvenilmez — nihai otorite bu status sorgusudur.',
    chain: [
      { layer: 'action', label: 'Start Payment (Card / RaiPay)', detail: 'DeliveryFragment' },
      { layer: 'api', label: 'POST Shipment/RaipayBindMobilDeviceToPaymentTerminal', detail: 'cihaz-terminal bağlama' },
      { layer: 'api', label: 'POST Shipment/RaiPayAuthToken', detail: ':2832' },
      { layer: 'api', label: 'POST Shipment/GetRaiPayPaymentToken', detail: ':2853' },
      { layer: 'external', label: 'RaiPay app intent', detail: 'startForResultRaiPay — util/raipay/RaiPayIntentResult' },
      { layer: 'api', label: 'POST Shipment/GetRaiPayPaymentStatus (poll)' },
      { layer: 'response', label: 'Payment status = SUCCESS' },
      { layer: 'state', label: 'CollectionType=Card → Complete Delivery aktifleşir' },
    ],
    errors: [
      { status: 'Intent iptal', backend: '—', mobile: 'Status poll yine yapılır', user: 'Ödeme sonucu backend’den teyit edilir' },
      { status: 'Status pending', backend: 'İşlem sürüyor', mobile: 'Polling devam', user: 'Bekleme göstergesi' },
    ],
    tests: [
      { name: 'Happy path (card)', status: 'covered', env: 'Manual' },
      { name: 'Intent iptal + status teyidi', status: 'partial', env: 'Manual' },
      { name: 'Poll timeout senaryosu', status: 'missing' },
    ],
  },
  {
    id: 'saveSignature',
    screen: 'signature',
    action: 'Save Signature',
    method: 'POST',
    path: 'Shipment/SaveSignature',
    domain: 'delivery',
    requestModel: 'SaveSignatureRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'draft',
    summary: 'İmza verisini gönderir — signaturepad/ modülünden.',
  },
  {
    id: 'saveImageFile',
    screen: 'delivery',
    action: 'Upload Photo',
    method: 'MULTIPART',
    path: 'Task/f/SaveImageFile',
    domain: 'delivery',
    requestModel: 'MultipartBody.Part',
    responseModel: 'BaseResponse',
    auth: true,
    offline: true,
    waiting: true,
    status: 'draft',
    summary: 'Teslimat/POD fotoğrafı — multipart, offline kuyruk destekli (saveImageFile tipi).',
  },
  {
    id: 'getCollectionsFromShipment',
    screen: 'payment-collection',
    action: 'Load Collections',
    method: 'POST',
    path: 'Shipment/GetCollectionsFromShipment',
    domain: 'payment',
    requestModel: 'GetShipmentCollectionsRequest',
    responseModel: 'GetShipmentCollectionsBaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  // ═══ FISCAL ════════════════════════════════════════════════════════════
  {
    id: 'createFiscalInvoice',
    screen: 'fiscal-invoice',
    action: 'Create Fiscal',
    trigger: 'Ödeme tamamlandıktan sonra, Complete Delivery öncesi',
    method: 'POST',
    path: 'Shipment/CreateFiscalInvoice',
    domain: 'fiscal',
    requestModel: 'CreateFiscalInvoice',
    responseModel: 'RetryFiscalInvoiceResponseModel',
    auth: true,
    offline: false,
    status: 'verified',
    lastChecked: '18 Tem 2026',
    owner: 'Mobile Core · Backend Fiscal',
    summary:
      'Ülke kuralına göre fiscal invoice oluşturur. Sonuç Room FiscalInvoiceData tablosuna yazılır; fiscalInvoiceId kuyruktaki delivery Request satırına bağlanır (updateFiscalIdForRequest).',
    preconditions: ['Ödeme (COD) tamamlanmış', 'Ülke fiscal kuralı aktif (HR/RS/SI/BA…)'],
    postEffects: [
      'Room FiscalInvoiceData satırı yazılır',
      'RequestDao.updateFiscalIdForRequest — delivery isteğine fiscalInvoiceId bağlanır',
      'Başarısızsa RetryFiscalInvoice akışı devreye girer',
    ],
    chain: [
      { layer: 'action', label: 'Create Fiscal', detail: 'DeliveryFragment' },
      { layer: 'viewmodel', label: 'SharedViewModel.createFiscalInvoice()', detail: 'main/SharedViewModel.kt:2179' },
      { layer: 'repository', label: 'MainRepository.createFiscalInvoice()' },
      { layer: 'api', label: 'POST Shipment/CreateFiscalInvoice' },
      { layer: 'response', label: 'RetryFiscalInvoiceResponseModel' },
      { layer: 'db', label: 'Room FiscalInvoiceData + Request.fiscalInvoiceId', detail: 'database/fiscal/FiscalInvoiceDataDao.kt' },
      { layer: 'state', label: 'Fiscal sonucu ekranda — Complete Delivery aktifleşir' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'delivery/DeliveryFragment.kt', method: 'fiscal orchestration' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'createFiscalInvoice() · :2179' },
      { layer: 'API', file: 'network/APIService.kt', method: 'createFiscalInvoice()' },
      { layer: 'DB', file: 'database/fiscal/FiscalInvoiceDataDao.kt', method: 'insert()' },
      { layer: 'DB', file: 'database/RequestDao.kt', method: 'updateFiscalIdForRequest()' },
    ],
    responseMapping: [
      { field: 'fiscalInvoiceId', destination: 'Room FiscalInvoiceData', action: 'Fiscal kaydı persist edilir' },
      { field: 'fiscalInvoiceId', destination: 'Request.fiscalInvoiceId', action: 'Kuyruktaki delivery isteğine bağlanır' },
      { field: 'success', destination: 'DeliveryFragment state', action: 'Complete butonu aktifleşir / retry diyaloğu' },
    ],
    errors: [
      { status: '422', backend: 'Country fiscal rule', mobile: 'Retry diyaloğu → RetryFiscalInvoice', user: 'Fiscal tekrar denenir' },
      { status: 'Timeout', backend: 'Fiscal oluşmuş olabilir', mobile: 'RetryFiscalInvoice idempotent akışı', user: 'Duplicate fiscal riski — retry endpoint’i üzerinden ilerlenir' },
    ],
    tests: [
      { name: 'Happy path (HR)', status: 'covered', env: 'Manual' },
      { name: 'RS country rule', status: 'covered', env: 'Manual' },
      { name: 'Timeout → retry idempotency', status: 'missing' },
    ],
  },
  {
    id: 'retryFiscalInvoice',
    screen: 'fiscal-invoice',
    action: 'Retry Fiscal',
    method: 'POST',
    path: 'Shipment/RetryFiscalInvoice',
    domain: 'fiscal',
    requestModel: 'RetryFiscalInvoiceRequestModel',
    responseModel: 'RetryFiscalInvoiceResponseModel',
    auth: true,
    offline: false,
    status: 'reviewed',
    summary: 'Başarısız/belirsiz fiscal denemesini tekrarlar — create ile aynı response modeli.',
  },
  {
    id: 'refundFiscalInvoice',
    screen: 'fiscal-invoice',
    action: 'Refund Fiscal',
    method: 'POST',
    path: 'Shipment/RefundFiscalInvoice',
    domain: 'fiscal',
    requestModel: 'RefundFiscalizationReq',
    responseModel: 'RefundFiscalizationResponse',
    auth: true,
    offline: false,
    status: 'draft',
  },
  {
    id: 'getFiscalInvoice',
    screen: 'fiscal-invoice',
    action: 'Open Fiscal Detail',
    method: 'POST',
    path: 'Shipment/GetFiscalInvoiceDetail',
    domain: 'fiscal',
    requestModel: 'FiscalizationReq',
    responseModel: 'GetInvoiceDetailResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'updateFiscalInvoice',
    screen: 'fiscal-invoice',
    action: 'Update Fiscal',
    method: 'POST',
    path: 'Shipment/UpdateFiscalInvoice',
    domain: 'fiscal',
    requestModel: 'UpdateInvoiceRequest',
    responseModel: 'UpdateInvoiceResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  // ═══ DELIVERY FAILED ═══════════════════════════════════════════════════
  {
    id: 'deliveryFailed',
    screen: 'delivery-failed',
    action: 'Mark Delivery Failed',
    trigger: 'Neden seçimi + onay',
    method: 'POST',
    path: 'Task/DeliveryFailed/',
    domain: 'delivery',
    requestModel: 'DeliveryFailedRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: true,
    waiting: true,
    status: 'verified',
    lastChecked: '18 Tem 2026',
    summary:
      'Teslim edilemedi kaydını gönderir. Delivery ile aynı kuyruk disiplinine tabidir: 120 sn bekleme, 3 retry, dead-letter arşivi.',
    chain: [
      { layer: 'action', label: 'Mark Delivery Failed', detail: 'DeliveryFailedFragment' },
      { layer: 'viewmodel', label: 'SharedViewModel.deliveryFailed() / saveRequest(DELIVERY_FAILED)', detail: 'main/SharedViewModel.kt:933' },
      { layer: 'queue', label: 'Room Request satırı', detail: 'isWaitingRequest=true' },
      { layer: 'queue', label: 'RequestSenderService case DELIVERY_FAILED', detail: ':423' },
      { layer: 'repository', label: 'MainRepository.deliveryFailed()' },
      { layer: 'api', label: 'POST Task/DeliveryFailed/' },
      { layer: 'db', label: 'CompletedRequest arşivi' },
      { layer: 'state', label: 'Task failed olarak işaretlenir — Stop List refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'deliveryFailed/DeliveryFailedFragment.kt', method: 'onConfirm()' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'deliveryFailed() · :933' },
      { layer: 'Queue', file: 'services/RequestSenderService.kt', method: 'case DELIVERY_FAILED · :423' },
      { layer: 'API', file: 'network/APIService.kt', method: 'deliveryFailed()' },
    ],
    tests: [
      { name: 'Happy path', status: 'covered', env: 'Manual' },
      { name: 'Offline queue', status: 'covered', env: 'Manual' },
      { name: 'Failed → come-again etkileşimi', status: 'missing' },
    ],
  },
  // ═══ PICKUP ════════════════════════════════════════════════════════════
  {
    id: 'loadPickupParcelToCourierVehicle',
    screen: 'pickup',
    action: 'Complete Pickup',
    trigger: 'Pickup barkodları okutulup onaylandığında',
    method: 'POST',
    path: 'Task/PickupParcelToCourierVehicle/',
    domain: 'pickup',
    requestModel: 'LoadPickupParcelReq',
    responseModel: 'BaseResponse',
    auth: true,
    offline: true,
    status: 'verified',
    lastChecked: '18 Tem 2026',
    summary:
      'Pickup parselini araca alır. Kuyruk case’inde processedBarcodes ile dedup yapılır; backend “Pickup has already been made” dönerse istek silinip ArasDialog gösterilir.',
    chain: [
      { layer: 'action', label: 'Complete Pickup', detail: 'PickUpFragment' },
      { layer: 'viewmodel', label: 'saveRequest(LOAD_PICKUP_PARCEL_TO_COURIER_VEHICLE)' },
      { layer: 'queue', label: 'RequestSenderService case', detail: ':305 — processedBarcodes dedup' },
      { layer: 'repository', label: 'MainRepository.loadPickupParcelToCourierVehicle()' },
      { layer: 'api', label: 'POST Task/PickupParcelToCourierVehicle/' },
      { layer: 'response', label: '“Already been made” özel hatası → istek silinir + dialog' },
      { layer: 'db', label: 'CompletedRequest arşivi' },
    ],
    errors: [
      { status: '200 + business error', backend: 'Pickup has already been made', mobile: 'Request silinir, ArasDialog', user: 'Duplicate pickup engellenir' },
      { status: 'Network', backend: '—', mobile: 'Kuyrukta bekler, tryCount artmaz', user: 'Otomatik yeniden deneme' },
    ],
    tests: [
      { name: 'Happy path', status: 'covered', env: 'Manual' },
      { name: 'Duplicate pickup engeli', status: 'covered', env: 'Manual' },
      { name: 'Offline pickup + sonra online', status: 'partial', env: 'Manual' },
    ],
    notes:
      'Backend’de birincil topic TaskWebAPI.PickupParcelToCourierVehicleV2 (PickupParcelModel) — mobil path’in V2 ile eşleşmesi gateway config’i üzerinden doğrulanmalı.',
  },
  {
    id: 'getPickupShipmentDetails',
    screen: 'pickup',
    action: 'Open Pickup Detail',
    method: 'POST',
    path: 'Task/GetPickupShipmentDetails/',
    domain: 'pickup',
    requestModel: 'GetPickupShipmentDetailsRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: true,
    status: 'reviewed',
    summary: 'Pickup detayı — kuyruk üzerinden (case :498); HTTP 405 özel olarak ele alınır.',
  },
  {
    id: 'generatePickupTaskJob',
    screen: 'pickup',
    action: 'Generate Pickup Task',
    method: 'POST',
    path: 'Task/GeneratePickupTaskJobNew/',
    domain: 'pickup',
    requestModel: 'GeneratePickupTaskJobRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'confirmPickup',
    screen: 'gray-label',
    action: 'Confirm Pickup (Red/Grey Label)',
    method: 'POST',
    path: 'Shipment/CreateRedGreyLabelShipmentWithoutDetails',
    domain: 'pickup',
    requestModel: 'ConfirmPickupRequest',
    responseModel: 'ConfirmPickupResponse',
    auth: true,
    offline: false,
    status: 'draft',
  },
  {
    id: 'pickupFailed',
    screen: 'pickup-failed',
    action: 'Mark Pickup Failed',
    method: 'POST',
    path: 'Task/PickupFailed/',
    domain: 'pickup',
    requestModel: 'PickupFailedRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: true,
    status: 'reviewed',
    summary: 'Pickup başarısız — kuyruk case’i RequestSenderService:540.',
  },
  // ═══ GRAY LABEL / PRICE ════════════════════════════════════════════════
  {
    id: 'getShipperCustomerByBarcode',
    screen: 'gray-label',
    action: 'Scan Shipper Barcode',
    method: 'POST',
    path: 'Shipment/GetShipperCustomerByBarcode',
    domain: 'shipment',
    requestModel: 'String',
    responseModel: 'ShipperCustomerResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'getPriceCalculationRequestModel',
    screen: 'gray-label',
    action: 'Open Price Calculator',
    method: 'POST',
    path: 'Shipment/GetPriceCalculationRequestModel',
    domain: 'payment',
    requestModel: 'GetPriceCalculationRequestModel',
    responseModel: 'GetPriceCalculationResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'calculatePrice',
    screen: 'gray-label',
    action: 'Calculate Price',
    method: 'POST',
    path: 'Customer/CalculatePrice',
    domain: 'payment',
    requestModel: 'CalculatePriceRequest',
    responseModel: 'CalculatePriceResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'saveNoDataScanLog',
    screen: 'gray-label',
    action: 'Save No-Data Scan',
    method: 'POST',
    path: 'Shipment/SaveNoDataScanLog',
    domain: 'shipment',
    requestModel: 'SaveNoDataScanLogRequest',
    responseModel: 'SaveNoDataScanLogResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  // ═══ PARCEL RELEASE ════════════════════════════════════════════════════
  {
    id: 'releaseParcel',
    screen: 'parcel-release',
    action: 'Release Parcel',
    method: 'POST',
    path: 'Task/ReleaseParcel/',
    domain: 'delivery',
    requestModel: 'ReleaseParcelRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: true,
    status: 'draft',
    summary: 'Parsel bırakma — offline kuyruk destekli (ReleaseParcel tipi).',
  },
  {
    id: 'handOverParcelsToCounterLocation',
    screen: 'parcel-release',
    action: 'Hand Over to Counter',
    method: 'POST',
    path: 'Integration/ProcessHandOverParcelsToCounterLocation/',
    domain: 'delivery',
    requestModel: 'HandOverParcelsToCounterLocationRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: true,
    status: 'draft',
  },
  {
    id: 'checkLastShipmentLocationIsCounter',
    screen: 'parcel-release',
    action: 'Check Counter Location',
    method: 'POST',
    path: 'Integration/CheckLastShipmentLocationIsCounter/',
    domain: 'shipment',
    requestModel: 'String',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  // ═══ SHIPMENT TRACKING ═════════════════════════════════════════════════
  {
    id: 'getShipmentDetailByWaybillNumber',
    screen: 'shipment-tracking',
    action: 'Search Waybill',
    method: 'POST',
    path: 'Integration/GetShipmentDetailByWaybillNumber/',
    domain: 'shipment',
    requestModel: 'String',
    responseModel: 'ShipmentDetailResponse',
    auth: true,
    offline: false,
    status: 'draft',
  },
  {
    id: 'getShipments',
    screen: 'shipment-tracking',
    action: 'Load Shipments',
    method: 'POST',
    path: 'Shipment/GetShipments/',
    domain: 'shipment',
    requestModel: 'List<String>',
    responseModel: 'ShipmentDetailsRes',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'getShipmentsByFilter',
    screen: 'shipment-tracking',
    action: 'Filter Shipments',
    method: 'POST',
    path: 'Shipment/GetShipmentsByFilter/',
    domain: 'shipment',
    requestModel: 'List<FilterModel>',
    responseModel: 'ShipmentDetailsRes',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'getShipmentHistory',
    screen: 'shipment-tracking',
    action: 'Open Movement History',
    method: 'POST',
    path: 'Integration/GetShipmentHistory/',
    domain: 'shipment',
    requestModel: 'String',
    responseModel: 'ShipmentHistoryResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'searchShipment',
    screen: 'shipment-tracking',
    action: 'Search Shipment',
    method: 'POST',
    path: 'Shipment/SearchShipment',
    domain: 'shipment',
    requestModel: 'SearchShipmentRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'saveShipmentCallInformation',
    screen: 'shipment-tracking',
    action: 'Log Customer Call',
    method: 'POST',
    path: 'History/SaveShipmentCallInformation',
    domain: 'shipment',
    requestModel: 'SaveCallInformationRequestModel',
    responseModel: 'BaseResponse',
    auth: true,
    offline: true,
    status: 'detected',
    notes: 'Kuyruk tipi SaveCallLogs.',
  },
  // ═══ DAMAGE / CASE / KTF ═══════════════════════════════════════════════
  {
    id: 'saveDamageCargo',
    screen: 'damage',
    action: 'Save Damage Record',
    method: 'POST',
    path: 'Task/SaveDamageCargo',
    domain: 'shipment',
    requestModel: 'CargoDamageRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'sendCaseDetection',
    screen: 'damage',
    action: 'Save Case Detection',
    method: 'POST',
    path: 'Task/InsertSituationDetectionDocument',
    domain: 'shipment',
    requestModel: 'CaseDetectionRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'createEKTF',
    screen: 'ktf',
    action: 'Create E-KTF',
    method: 'POST',
    path: 'Task/EKTFCreate/',
    domain: 'shipment',
    requestModel: 'CreateEKTFReq',
    responseModel: 'KTFResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  // ═══ D4ME / LOCKER ═════════════════════════════════════════════════════
  {
    id: 'activeD4MCounterLocations',
    screen: 'd4me-locker',
    action: 'List D4M Counters',
    method: 'POST',
    path: 'Shipment/ActiveD4MCounterLocations',
    domain: 'locker',
    requestModel: 'ActiveD4MCounterReq',
    responseModel: 'ActiveD4MCounterRes',
    auth: true,
    offline: false,
    status: 'draft',
  },
  {
    id: 'activeLockerCounterLocations',
    screen: 'd4me-locker',
    action: 'List Locker Locations',
    method: 'POST',
    path: 'Shipment/ActiveLockerCounterLocations',
    domain: 'locker',
    requestModel: 'MakeLockerReservationRequestModel',
    responseModel: 'LockerCounterLocations',
    auth: true,
    offline: false,
    status: 'detected',
    notes: 'Aynı path iki fonksiyonda kullanılıyor (activeLockerCounterLocationsD4M farklı request/response ile) — contract doğrulaması gerekli.',
  },
  {
    id: 'createD4MReservation',
    screen: 'd4me-locker',
    action: 'Create D4M Reservation',
    method: 'POST',
    path: 'Task/CreateD4MReservation',
    domain: 'locker',
    requestModel: 'createD4MReservationReq',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'draft',
  },
  {
    id: 'deleteD4MReservation',
    screen: 'd4me-locker',
    action: 'Delete D4M Reservation',
    method: 'POST',
    path: 'Task/DeleteD4MReservation',
    domain: 'locker',
    requestModel: 'List<deleteD4MReservationReq>',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'completeD4MShipments',
    screen: 'd4me-locker',
    action: 'Complete D4M Shipments',
    method: 'POST',
    path: 'Task/CompleteD4MShipments',
    domain: 'locker',
    requestModel: 'CompleteD4MShipmentsReq',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'draft',
  },
  {
    id: 'makeLockerReservation',
    screen: 'd4me-locker',
    action: 'Make Locker Reservation',
    method: 'POST',
    path: 'Task/MakeLockerReservation',
    domain: 'locker',
    requestModel: 'MakeLockerReservationRequestModel',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'cancelLockerReservation',
    screen: 'd4me-locker',
    action: 'Cancel Locker Reservation',
    method: 'POST',
    path: 'Task/CancelLockerReservation',
    domain: 'locker',
    requestModel: 'CancelLockerReservationRequestModel',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'manuelLockerCompleteReservation',
    screen: 'd4me-locker',
    action: 'Complete Locker (Manual)',
    method: 'POST',
    path: 'Task/ManuelLockerCompleteReservation',
    domain: 'locker',
    requestModel: 'ManuelLockerCompleteReservationRequestModel',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  // ═══ MAP / GEOCODE / TRACKING ══════════════════════════════════════════
  {
    id: 'updateDeliveryAddress',
    screen: 'map',
    action: 'Update Address Geocode',
    method: 'POST',
    path: 'Geocode/UpdateAddressGeocode/',
    domain: 'tracking',
    requestModel: 'UpdateAddressReq',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'getAllHubs',
    screen: 'map',
    action: 'Load Hubs',
    method: 'POST',
    path: 'Geocode/GetAllHubs/',
    domain: 'tracking',
    requestModel: 'String',
    responseModel: 'GetAllHubsResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'getUserHub',
    screen: 'map',
    action: 'Load User Hub',
    method: 'POST',
    path: 'Geocode/GetUserHub/',
    domain: 'tracking',
    requestModel: 'String',
    responseModel: 'GetUserHubResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'isRouteAutoDeps',
    screen: 'map',
    action: 'Check Auto-Deps Route',
    method: 'POST',
    path: 'Geocode/IsRouteAutoDeps/',
    domain: 'tracking',
    requestModel: 'AutoDepsReq',
    responseModel: 'AutoDepsResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'saveCourierLocation',
    screen: 'map',
    action: 'Background Location Sync',
    trigger: 'RequestSenderService döngüsü — LiveLocation batch',
    method: 'POST',
    path: 'Tracking/SaveCourierLocation/',
    domain: 'tracking',
    requestModel: 'SaveCourierLocationRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: true,
    status: 'reviewed',
    summary:
      'Kurye konumu — LiveLocation Room tablosunda birikir, kuyruk döngüsünde batch gönderilir. SaveScheduleDistance_Callback ile birlikte çalışır.',
  },
  {
    id: 'saveScheduleDistance',
    screen: 'map',
    action: 'Background Distance Sync',
    method: 'POST',
    path: 'Task/SaveScheduleDistance_Callback/',
    domain: 'tracking',
    requestModel: 'SaveScheduleDistanceRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: true,
    status: 'detected',
  },
  {
    id: 'saveCourierDeviceInfo',
    screen: 'map',
    action: 'Device Telemetry',
    method: 'POST',
    path: 'Tracking/SaveCourierDeviceInfo/',
    domain: 'tracking',
    requestModel: 'SaveCourierDeviceInfoRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  // ═══ HUB COMPANION ═════════════════════════════════════════════════════
  {
    id: 'getEvents',
    screen: 'hub-companion',
    action: 'Load Events',
    method: 'POST',
    path: 'HubCompanion/GetEvents',
    domain: 'hubcompanion',
    requestModel: 'String ("{}")',
    responseModel: 'GetEventsResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'scanSpecial',
    screen: 'hub-companion',
    action: 'Scan Parcel',
    method: 'POST',
    path: 'HubCompanion/ScanSpecial',
    domain: 'hubcompanion',
    requestModel: 'List<ScanSpecialRequest>',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'draft',
  },
  {
    id: 'updateEventParcel',
    screen: 'hub-companion',
    action: 'Process Event Parcels',
    method: 'POST',
    path: 'HubCompanion/ProcessAndLogEventParcels',
    domain: 'hubcompanion',
    requestModel: 'List<UpdateEventParcel>',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'getHistory',
    screen: 'hub-companion',
    action: 'Open Event History',
    method: 'POST',
    path: 'HubCompanion/GetShipmentEventHistory',
    domain: 'hubcompanion',
    requestModel: 'EventRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'getLogsByUserName',
    screen: 'hub-companion',
    action: 'Open Logs',
    method: 'POST',
    path: 'HubCompanion/GetLogsByUserName',
    domain: 'hubcompanion',
    requestModel: 'String ("{}")',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'savePhoto',
    screen: 'hub-companion',
    action: 'Upload Photo',
    method: 'MULTIPART',
    path: 'HubCompanion/f/SaveImage',
    domain: 'hubcompanion',
    requestModel: 'MultipartBody.Part',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'getEventTypeList',
    screen: 'hub-companion',
    action: 'Load Event Types',
    method: 'POST',
    path: 'EventTower/GetEvents',
    domain: 'hubcompanion',
    requestModel: 'GetEventTypeListRequest',
    responseModel: 'GetEventTypeListResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  // ═══ ASK QUESTION / CHAT ═══════════════════════════════════════════════
  {
    id: 'getAskQuestion',
    screen: 'ask-question',
    action: 'Load Questions',
    method: 'POST',
    path: 'History/GetAskQuestion/',
    domain: 'system',
    requestModel: 'String',
    responseModel: 'GetAskQuestionResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'getAllSubject',
    screen: 'ask-question',
    action: 'Load Subjects',
    method: 'POST',
    path: 'History/GetAllSubject/',
    domain: 'system',
    requestModel: 'String',
    responseModel: 'AskQuestionSubjectResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  {
    id: 'sendAskQuestion',
    screen: 'ask-question',
    action: 'Send Question',
    method: 'POST',
    path: 'User/AskQuestion/',
    domain: 'system',
    requestModel: 'AskQuestionRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: true,
    status: 'detected',
    notes: 'Kuyruk tipi AskQuestion.',
  },
  {
    id: 'readingIncomingAnswer',
    screen: 'ask-question',
    action: 'Mark Answer Read',
    method: 'POST',
    path: 'History/ReadingIncomingAnswer/',
    domain: 'system',
    requestModel: 'String',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  // ═══ END OF DAY ════════════════════════════════════════════════════════
  {
    id: 'requestScheduleEndOfDay',
    screen: 'end-of-day',
    action: 'Close Day',
    trigger: 'End of Day onayı',
    method: 'POST',
    path: 'Task/RequestScheduleEndOfDay/',
    domain: 'schedule',
    requestModel: 'EndOfDayReq',
    responseModel: 'BaseResponse',
    auth: true,
    offline: true,
    status: 'verified',
    lastChecked: '18 Tem 2026',
    summary:
      'Gün sonu kapanışı — kuyruk üzerinden gönderilir (case :613). Kuyruktaki bekleyen teslimat istekleri tamamlanmadan kapanış tutarlılığı garanti edilmez.',
    chain: [
      { layer: 'action', label: 'Close Day', detail: 'EndOfDayFragment' },
      { layer: 'viewmodel', label: 'SharedViewModel.requestScheduleEndOfDay()', detail: 'main/SharedViewModel.kt:3576' },
      { layer: 'queue', label: 'saveRequest(REQUEST_SCHEDULE_END_OF_DAY)' },
      { layer: 'queue', label: 'RequestSenderService case', detail: ':613' },
      { layer: 'api', label: 'POST Task/RequestScheduleEndOfDay/' },
      { layer: 'state', label: 'Schedule kapanır — SP.scheduleStatus güncellenir' },
    ],
    tests: [
      { name: 'Happy path', status: 'covered', env: 'Manual' },
      { name: 'Kuyrukta bekleyen istek varken kapanış', status: 'missing' },
    ],
  },
  {
    id: 'saveCollectedShipmentListToCashDesk',
    screen: 'end-of-day',
    action: 'Hand Over to Cash Desk',
    method: 'POST',
    path: 'Shipment/SaveCollectedShipmentListToCashDesk/',
    domain: 'payment',
    requestModel: 'SaveCollectedShipmentListToCashDeskRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'draft',
  },
  {
    id: 'saveParcelListFromScheduleToInventory',
    screen: 'end-of-day',
    action: 'Sync Inventory',
    method: 'POST',
    path: 'Shipment/SaveParcelListFromScheduleToInventory/',
    domain: 'shipment',
    requestModel: 'SaveParcelListFromScheduleToInventoryRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
  // ═══ SYSTEM / DIAGNOSTICS ══════════════════════════════════════════════
  {
    id: 'saveTerminalFailedRequests',
    screen: 'map',
    action: 'Dead-letter Diagnostics',
    trigger: 'Bir kuyruk isteği 3 kez başarısız olduğunda otomatik',
    method: 'POST',
    path: 'History/SaveTerminalFailedRequests/',
    domain: 'system',
    requestModel: 'SaveTerminalFailedRequestsReq',
    responseModel: 'BaseResponse',
    auth: true,
    offline: true,
    status: 'reviewed',
    summary:
      'Dead-letter kanalı: 3 retry’ı tüketen isteğin gövdesi + trace backend’e diagnostik olarak gönderilir (handleRequestRetryCountPolicy).',
  },
  {
    id: 'saveTerminalRequestDbSnapshot',
    screen: 'map',
    action: 'DB Snapshot Diagnostics',
    method: 'POST',
    path: 'History/SaveTerminalRequestDbSnapshot/',
    domain: 'system',
    requestModel: 'SaveTerminalRequestDbSnapshotRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'detected',
  },
]

// ─── Derived helpers ────────────────────────────────────────────────────────

export function screenById(id: string): AtlasScreen | undefined {
  return ATLAS_SCREENS.find((s) => s.id === id)
}

export function contractsForScreen(screenId: string): AtlasContract[] {
  return ATLAS_CONTRACTS.filter((c) => c.screen === screenId)
}

export function atlasKpis() {
  const documented = ATLAS_CONTRACTS.length
  const verified = ATLAS_CONTRACTS.filter((c) => c.status === 'verified').length
  const offline = ATLAS_CONTRACTS.filter((c) => c.offline).length
  const mismatch = ATLAS_CONTRACTS.filter((c) => c.status === 'mismatch').length
  const detectedOnly = ATLAS_CONTRACTS.filter((c) => c.status === 'detected').length
  const domains = new Set(ATLAS_CONTRACTS.map((c) => c.domain)).size
  return {
    documented,
    verified,
    offline,
    mismatch,
    detectedOnly,
    domains,
    screens: ATLAS_SCREENS.length,
    totalDetected: ATLAS_TOTAL_DETECTED,
  }
}

/** Matrix: screen × domain → contract count. */
export function matrixCounts(): Map<string, Map<AtlasDomain, number>> {
  const m = new Map<string, Map<AtlasDomain, number>>()
  for (const c of ATLAS_CONTRACTS) {
    if (!m.has(c.screen)) m.set(c.screen, new Map())
    const row = m.get(c.screen)!
    row.set(c.domain, (row.get(c.domain) ?? 0) + 1)
  }
  return m
}

/**
 * Search with free text + command tokens:
 * screen:delivery method:POST domain:fiscal offline:true status:verified header:Authorization
 */
export function searchContracts(query: string, items: AtlasContract[]): AtlasContract[] {
  const raw = query.trim().toLowerCase()
  if (!raw) return items
  const tokens = raw.split(/\s+/)
  const free: string[] = []
  let result = items
  for (const t of tokens) {
    const [key, value] = t.includes(':') ? t.split(':', 2) : [null, t]
    if (!key || !value) {
      free.push(t)
      continue
    }
    switch (key) {
      case 'screen':
        result = result.filter(
          (c) =>
            c.screen.includes(value) ||
            (screenById(c.screen)?.label.toLowerCase().includes(value) ?? false),
        )
        break
      case 'method':
        result = result.filter((c) => c.method.toLowerCase().includes(value))
        break
      case 'domain':
        result = result.filter(
          (c) => c.domain.includes(value) || DOMAIN_META[c.domain].label.toLowerCase().includes(value),
        )
        break
      case 'offline':
        result = result.filter((c) => c.offline === (value === 'true' || value === 'yes'))
        break
      case 'status':
        result = result.filter((c) => c.status.includes(value))
        break
      case 'header':
        result = result.filter(
          (c) =>
            COMMON_HEADERS.some((h) => h.header.toLowerCase().includes(value)) ||
            (c.extraHeaders ?? []).some((h) => h.header.toLowerCase().includes(value)),
        )
        break
      case 'response':
        result = result.filter((c) => c.responseModel.toLowerCase().includes(value))
        break
      case 'request':
      case 'requestfield':
        result = result.filter(
          (c) =>
            c.requestModel.toLowerCase().includes(value) ||
            (c.requestFields ?? []).some((f) => f.field.toLowerCase().includes(value)),
        )
        break
      case 'provider':
        result = result.filter((c) => (c.external ?? '').toLowerCase().includes(value))
        break
      default:
        free.push(t)
    }
  }
  if (free.length > 0) {
    const q = free.join(' ')
    result = result.filter((c) => {
      const hay = [
        c.id,
        c.path,
        c.action,
        c.requestModel,
        c.responseModel,
        c.summary ?? '',
        c.notes ?? '',
        screenById(c.screen)?.label ?? '',
        DOMAIN_META[c.domain].label,
        ...(c.codeRefs ?? []).map((r) => `${r.file} ${r.method}`),
        ...(c.chain ?? []).map((s) => s.label),
      ]
        .join(' ')
        .toLowerCase()
      return q.split(' ').every((part) => hay.includes(part))
    })
  }
  return result
}

// ─── Quick filters ──────────────────────────────────────────────────────────

export const ATLAS_QUICK_FILTERS: { id: string; label: string; match: (c: AtlasContract) => boolean }[] = [
  { id: 'offline', label: 'Offline destekli', match: (c) => c.offline },
  { id: 'waiting', label: '120 sn undo penceresi', match: (c) => !!c.waiting },
  { id: 'external', label: 'External provider', match: (c) => !!c.external },
  { id: 'protected', label: 'Protected key', match: (c) => !!c.protectedKey },
  { id: 'undocumented', label: 'Dokümantasyon eksik', match: (c) => c.status === 'detected' },
  { id: 'mismatch', label: 'Contract riski', match: (c) => c.status === 'mismatch' || c.status === 'deprecated' },
  { id: 'multipart', label: 'Multipart', match: (c) => c.method === 'MULTIPART' },
  { id: 'verified', label: 'Verified', match: (c) => c.status === 'verified' },
]
