// Mobile Service Atlas — screen → user action → mobile call chain → endpoint → response mapping.
// Extracted from the real NESY Mobile Android codebase (com.arasdigital.nesymobile, versionName 0.1157).
// Source of truth: app/src/main/java/com/arasdigital/nesymobile/network/APIService.kt (127 methods),
// di/AuthInterceptor.kt (common headers), services/RequestSenderService.kt (offline queue).
// Contracts documented from NesyMobile APIService.kt + reqModel/model classes (19 Tem 2026 pass).
// Verified exemplars keep deep chains; reviewed rows include request fields, mapping, errors, and callers.

import type { Tone } from '@/components/product'

export const ATLAS_APP_VERSION = '0.1157'
export const ATLAS_DB_VERSION = 240
export const ATLAS_SCAN_DATE = '19 Tem 2026'
export const ATLAS_TOTAL_DETECTED = 127
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
    trigger: 'PIN ile cihaz girişi — PIN doğrulandıktan ve Firebase push token alındıktan sonra',
    method: 'POST',
    path: 'Auth/LoginDevice/',
    domain: 'auth',
    requestModel: 'LoginRequest',
    responseModel: 'LoginResponse',
    auth: false,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary: 'Cihaz bazlı giriş varyantı; SP.userName da bu akışta yazılır (SharedViewModel:267).',
    preconditions: [
      'Kullanıcı PIN girmiş olmalı',
      'Android device id ve Firebase PushRegistrationId hazır olmalı',
    ],
    postEffects: [
      'SP.token ve SP.userName LoginResponse payload’ından güncellenir',
      'Başarılı sonuç LoginFragment.onSuccess() ile versiyon kontrolüne devam eder',
    ],
    chain: [
      { layer: 'action', label: 'PIN Sign In', detail: 'login/LoginFragment.kt:521' },
      { layer: 'viewmodel', label: 'SharedViewModel.loginDevice()', detail: 'main/SharedViewModel.kt:267' },
      { layer: 'repository', label: 'MainRepository.loginDevice()' },
      { layer: 'api', label: 'POST Auth/LoginDevice/' },
      { layer: 'response', label: '200 LoginResponse' },
      { layer: 'db', label: 'SP.token + SP.userName' },
      { layer: 'state', label: 'LoginFragment.onSuccess() → version check' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'login/LoginFragment.kt', method: 'pinLogin() · :521' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'loginDevice() · :267' },
      { layer: 'Repository', file: 'main/MainRepository.kt', method: 'loginDevice() · :109' },
      { layer: 'Provider', file: 'network/ApiProvider.kt', method: 'makeLoginDevice() · :108' },
      { layer: 'API', file: 'network/APIService.kt', method: 'loginDevice() · :62' },
    ],
    requestFields: [
      { field: 'Username', type: 'String?', required: 'no', source: 'PIN login’de null; kullanıcı girişinde user input' },
      { field: 'Password', type: 'String?', required: 'no', source: 'PIN login’de null; kullanıcı girişinde user input', sensitive: true },
      { field: 'PushRegistrationId', type: 'String', required: 'yes', source: 'FirebaseMessaging token', sensitive: true },
      { field: 'DeviceCode', type: 'String?', required: 'yes', source: 'Settings.Secure.ANDROID_ID', sensitive: true },
      { field: 'PinCode', type: 'String?', required: 'yes', source: 'PIN input', sensitive: true },
    ],
    responseMapping: [
      { field: 'payload.token', destination: 'SP.token', action: 'Authorization Bearer kaynağı olur' },
      { field: 'payload.user.username', destination: 'SP.userName', action: 'Aktif kullanıcı ve kuyruk ayrımı güncellenir' },
      { field: 'resultCode', destination: 'Resource<LoginResponse>', action: 'SUCCESS → onSuccess; diğerleri → onError' },
    ],
    errors: [
      { status: 'Business error', backend: 'ResultCode != SUCCESS', mobile: 'Resource.error(LoginResponse)', user: 'PIN hata mesajı; SP.pin temizlenir' },
      { status: 'Network', backend: 'UnknownHost / NetworkErrorException', mobile: 'Resource.error', user: 'Bağlantı problemi gösterilir' },
      { status: 'Repeated failure', backend: 'Başarısız giriş', mobile: '5 denemede 5 dakika lokal blok', user: 'Giriş geçici olarak engellenir' },
    ],
    tests: [
      { name: 'Valid device + PIN login', status: 'partial', env: 'Manual' },
      { name: 'Wrong PIN / five-attempt local block', status: 'missing' },
      { name: 'Missing Firebase token / offline', status: 'missing' },
    ],
  },
  {
    id: 'getLatestVersion',
    screen: 'login',
    action: 'Screen Open',
    trigger: 'Başarılı login sonrasında veya login olmadan uygulama versiyonu kontrol edilirken',
    method: 'POST',
    path: 'Version/GetLatestVersion/',
    domain: 'system',
    requestModel: 'GetLatestVersionRequest',
    responseModel: 'GetLatestVersionResponse',
    auth: false,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Versiyon kontrolü. HostSelectionInterceptor ve X-AppName header’ı bu endpoint’i atlar — her zaman varsayılan host’a gider.',
    preconditions: ['BuildConfig.APP_NAME_TEST kullanılabilir olmalı'],
    postEffects: [
      'SP.latestVersion payload.versionNumber ile güncellenir',
      'Yeni sürüm zorunluysa payload.downloadUrl üzerinden APK indirme akışı başlar',
      'Güncel sürümde login success flow devam eder',
    ],
    chain: [
      { layer: 'action', label: 'Login sonrası version check', detail: 'LoginFragment.getVersionAndUpdateApp() · :648' },
      { layer: 'viewmodel', label: 'SharedViewModel.getLatestVersion()', detail: ':773' },
      { layer: 'repository', label: 'MainRepository.getLatestVersion()' },
      { layer: 'api', label: 'POST Version/GetLatestVersion/' },
      { layer: 'response', label: '200 GetLatestVersionResponse' },
      { layer: 'db', label: 'SP.latestVersion' },
      { layer: 'state', label: 'Download update veya successLoginFlow()' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'login/LoginFragment.kt', method: 'getVersionAndUpdateApp() · :648' },
      { layer: 'UI', file: 'login/LoginFragment.kt', method: 'getLatestVersionOnSuccess()' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'getLatestVersion() · :773' },
      { layer: 'Repository', file: 'main/MainRepository.kt', method: 'getLatestVersion() · :130' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getLatestVersion() · :212' },
    ],
    requestFields: [
      { field: 'AppName', type: 'String', required: 'yes', source: 'BuildConfig.APP_NAME_TEST; aynı değer SP.appName’e yazılır' },
    ],
    responseMapping: [
      { field: 'payload.versionNumber', destination: 'SP.latestVersion', action: 'BuildConfig.VERSION_CODE ile karşılaştırılır' },
      { field: 'payload.downloadUrl', destination: 'DownloadUtils', action: 'Yeni production sürümünde APK indirmeyi başlatır' },
      { field: 'payload.minimumRequiredVersionNumber', destination: 'Version policy', action: 'Minimum desteklenen sürüm bilgisini taşır' },
      { field: 'payload.buildNumber', destination: 'Version metadata', action: 'Build tanılama bilgisidir' },
    ],
    errors: [
      { status: 'Non-2xx', backend: 'HTTP error', mobile: 'Resource.error(response body/code)', user: 'Mevcut payload varsa akış onunla devam eder' },
      { status: 'Network/exception', backend: 'İstek ulaşılamadı', mobile: 'Resource.error(null)', user: 'Update service error; login payload varsa giriş devam eder' },
      { status: 'Empty payload', backend: 'Payload null', mobile: 'SP.latestVersion lokal build’e ayarlanır', user: '500 servis uyarısı gösterilir' },
    ],
    tests: [
      { name: 'App is up to date', status: 'partial', env: 'Manual' },
      { name: 'New version starts APK download', status: 'partial', env: 'Manual' },
      { name: 'Version service unavailable fallback', status: 'missing' },
    ],
    notes: 'AuthInterceptor bu endpoint için X-AppName eklemez; HostSelectionInterceptor da alternatif host yönlendirmesini atlar.',
  },
  {
    id: 'getCurrentUserMobileCachedPermissions',
    screen: 'login',
    action: 'Sign In',
    trigger: 'Login başarılı olduktan hemen sonra',
    method: 'POST',
    path: 'Role/GetCurrentUserMobileCachedPermissions',
    domain: 'auth',
    requestModel: 'GetCurrentUserMobileCachedPermissionRequest',
    responseModel: 'GetUserRoleForDrawer',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Login sonrası drawer menü izinlerini Role cache’ten çeker; UI menü görünürlüğü bu payload’a göre filtrelenir.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Drawer permission cache: Menü öğeleri izinlere göre gösterilir/gizlenir',
    ],
    chain: [
      { layer: 'action', label: 'Sign In', detail: 'login/LoginFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → getCurrentUserMobileCachedPermissions()' },
      { layer: 'repository', label: 'MainRepository.getCurrentUserMobileCachedPermissions()' },
      { layer: 'api', label: 'POST Role/GetCurrentUserMobileCachedPermissions' },
      { layer: 'response', label: '200 GetUserRoleForDrawer' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'getCurrentUserMobileCachedPermissions()' },
      { layer: 'Repository', file: 'main/MainRepository.kt', method: 'getCurrentUserMobileCachedPermissions()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getCurrentUserMobileCachedPermissions()' },
    ],
    requestFields: [
      { field: 'username', type: 'String', required: 'yes', source: 'User input / SP.userName' },
    ],
    responseMapping: [
      { field: 'payload', destination: 'Drawer permission cache', action: 'Menü öğeleri izinlere göre gösterilir/gizlenir' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'checkUserConsent',
    screen: 'login',
    action: 'Sign In',
    trigger: 'Login sonrası consent kontrolü (opsiyonel/feature-flag)',
    method: 'POST',
    path: 'User/CheckUserConsent/',
    domain: 'system',
    requestModel: 'String (userID)',
    responseModel: 'CheckUserConsentResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Kullanıcının KVKK/consent belgelerini kabul edip etmediğini kontrol eder. LoginFragment’te UI akışı şu an yorum satırında.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Consent UI state: Eksik consent varsa diyalog açılır',
    ],
    chain: [
      { layer: 'action', label: 'Sign In', detail: 'login/LoginFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → checkUserConsent()' },
      { layer: 'repository', label: 'MainRepository.checkUserConsent()' },
      { layer: 'api', label: 'POST User/CheckUserConsent/' },
      { layer: 'response', label: '200 CheckUserConsentResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'login/LoginFragment.kt', method: 'checkUserConsentSuccess()' },
      { layer: 'Repository', file: 'main/MainRepository.kt', method: 'checkUserConsent()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'checkUserConsent()' },
    ],
    requestFields: [
      { field: '(body)', type: 'String', required: 'yes', source: 'ApiProvider sends "{}"', validation: 'JSON object' },
    ],
    responseMapping: [
      { field: 'payload', destination: 'Consent UI state', action: 'Eksik consent varsa diyalog açılır' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'saveUserConsent',
    screen: 'login',
    action: 'Accept Consent',
    trigger: 'Consent diyalogunda Accept',
    method: 'POST',
    path: 'User/SaveUserConsent/',
    domain: 'system',
    requestModel: 'List<SaveUserConsentRequest>',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Kabul edilen KVKK belgelerini konum ve cihaz bilgisiyle birlikte kaydeder.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Login devam: Consent sonrası ana akışa geçilir',
    ],
    chain: [
      { layer: 'action', label: 'Accept Consent', detail: 'login/LoginFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → saveUserConsent()' },
      { layer: 'repository', label: 'MainRepository.saveUserConsent()' },
      { layer: 'api', label: 'POST User/SaveUserConsent/' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'login/LoginFragment.kt', method: 'saveUserConsent()' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'saveUserConsent()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'saveUserConsent()' },
    ],
    requestFields: [
      { field: '[]Username', type: 'String', required: 'yes', source: 'User input / SP.userName' },
      { field: '[]UserNameSurname', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: '[]Latitude', type: 'Double', required: 'yes', source: 'GPS' },
      { field: '[]Longitude', type: 'Double', required: 'yes', source: 'GPS' },
      { field: '[]KvkkDocument', type: 'KVKKDocumentModel', required: 'yes', source: 'Request model / ViewModel' },
      { field: '[]DeviceId', type: 'String', required: 'yes', source: 'Settings.Secure.ANDROID_ID', sensitive: true },
    ],
    responseMapping: [
      { field: 'success', destination: 'Login devam', action: 'Consent sonrası ana akışa geçilir' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'checkHasCourierTodaySchedule',
    screen: 'login',
    action: 'Sign In',
    trigger: 'Stop List açılışı / login sonrası schedule bootstrap',
    method: 'POST',
    path: 'Task/CheckHasCourierTodaySchedule/',
    domain: 'schedule',
    requestModel: 'String',
    responseModel: 'CheckHasCourierTodayScheduleBaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Kuryenin bugün için schedule’ı olup olmadığını kontrol eder; yoksa empty schedule / route seçim akışına yönlendirir.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'StopList bootstrap: Schedule yoksa CreateEmptySchedule / route list',
    ],
    chain: [
      { layer: 'action', label: 'Sign In', detail: 'login/LoginFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → checkHasCourierTodaySchedule()' },
      { layer: 'repository', label: 'MainRepository.checkHasCourierTodaySchedule()' },
      { layer: 'api', label: 'POST Task/CheckHasCourierTodaySchedule/' },
      { layer: 'response', label: '200 CheckHasCourierTodayScheduleBaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'stop_list/StopListFragment.kt', method: 'checkHasCourierTodaySchedule()' },
      { layer: 'ViewModel', file: 'stop_list/StopViewModel.kt', method: 'checkHasCourierTodaySchedule()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'checkHasCourierTodaySchedule()' },
    ],
    requestFields: [
      { field: '(body)', type: 'String', required: 'conditional', source: 'JSON string body — genelde "{}" veya serialized model', validation: 'JSON' },
    ],
    responseMapping: [
      { field: 'payload.hasSchedule', destination: 'StopList bootstrap', action: 'Schedule yoksa CreateEmptySchedule / route list' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  // ═══ ACCOUNT SETTINGS ══════════════════════════════════════════════════
  {
    id: 'loggedInUserChangeOwnPassword',
    screen: 'account-settings',
    action: 'Change Password',
    trigger: 'Account Settings → Change Password',
    method: 'POST',
    path: 'Auth/LoggedInUserChangeOwnPassword/',
    domain: 'auth',
    requestModel: 'LoggedInUserChangeOwnPasswordRequest',
    responseModel: 'LoggedInUserChangeOwnPasswordResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Oturum açıkken mevcut şifreyi doğrulayıp yeni şifreye geçirir.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Account Settings UI: Başarı toast / form reset',
    ],
    chain: [
      { layer: 'action', label: 'Change Password', detail: 'accountSettings/AccountSettingsFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → loggedInUserChangeOwnPassword()' },
      { layer: 'repository', label: 'MainRepository.loggedInUserChangeOwnPassword()' },
      { layer: 'api', label: 'POST Auth/LoggedInUserChangeOwnPassword/' },
      { layer: 'response', label: '200 LoggedInUserChangeOwnPasswordResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'accountSettings/AccountSettingsFragment.kt', method: 'changePassword' },
      { layer: 'API', file: 'network/APIService.kt', method: 'loggedInUserChangeOwnPassword()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'loggedInUserChangeOwnPassword()' },
    ],
    requestFields: [
      { field: 'CurrentPassword', type: 'String', required: 'yes', source: 'User input', sensitive: true },
      { field: 'NewPassword', type: 'String', required: 'yes', source: 'User input', sensitive: true },
    ],
    responseMapping: [
      { field: 'success', destination: 'Account Settings UI', action: 'Başarı toast / form reset' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'loggedOutUserChangePassword',
    screen: 'account-settings',
    action: 'Reset Password',
    trigger: 'Login ekranı / Account Settings → Reset Password',
    method: 'POST',
    path: 'Auth/LoggedOutUserChangePassword/',
    domain: 'auth',
    requestModel: 'LoggedOutUserChangePasswordRequest',
    responseModel: 'AccountPswChangeResponse',
    auth: false,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Oturum yokken kullanıcı adı + mevcut/yeni şifre ile şifre sıfırlama.',
    preconditions: [
      'Host seçimi yapılmış',
    ],
    postEffects: [
      'Login UI: Şifre değişti — tekrar giriş',
    ],
    chain: [
      { layer: 'action', label: 'Reset Password', detail: 'accountSettings/AccountSettingsFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → loggedOutUserChangePassword()' },
      { layer: 'repository', label: 'MainRepository.loggedOutUserChangePassword()' },
      { layer: 'api', label: 'POST Auth/LoggedOutUserChangePassword/' },
      { layer: 'response', label: '200 AccountPswChangeResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'accountSettings/AccountSettingsFragment.kt', method: 'resetPassword' },
      { layer: 'API', file: 'network/APIService.kt', method: 'loggedOutUserChangePassword()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'loggedOutUserChangePassword()' },
    ],
    requestFields: [
      { field: 'CurrentPassword', type: 'String', required: 'yes', source: 'User input', sensitive: true },
      { field: 'NewPassword', type: 'String', required: 'yes', source: 'User input', sensitive: true },
      { field: 'Username', type: 'String', required: 'yes', source: 'User input / SP.userName' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Login UI', action: 'Şifre değişti — tekrar giriş' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
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
    requestFields: [
      { field: 'courierZoneCode', type: 'String?', required: 'yes', source: 'SP.route / seçili kurye zone kodu', validation: 'Aktif schedule zone’u ile uyumlu olmalı' },
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
    trigger: 'Bugün schedule yokken Create Empty Schedule',
    method: 'POST',
    path: 'Task/CreateEmptyScheduleDocument/',
    domain: 'schedule',
    requestModel: 'CreateEmptyScheduleRequest',
    responseModel: 'Schedule',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Seçilen courier zone için boş schedule dokümanı oluşturur ve Schedule payload döner.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Room schedule: Yeni boş schedule lokal kaydedilir',
    ],
    chain: [
      { layer: 'action', label: 'Create Empty Schedule', detail: 'stop_list/StopListFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → createEmptySchedule()' },
      { layer: 'repository', label: 'MainRepository.createEmptySchedule()' },
      { layer: 'api', label: 'POST Task/CreateEmptyScheduleDocument/' },
      { layer: 'response', label: '200 Schedule' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'stop_list/StopListFragment.kt', method: 'createEmptySchedule()' },
      { layer: 'ViewModel', file: 'stop_list/StopViewModel.kt', method: 'createEmptySchedule()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'createEmptySchedule()' },
    ],
    requestFields: [
      { field: 'courierZone', type: 'String', required: 'yes', source: 'SP.courierZone / route selection' },
      { field: 'scheduleDate', type: 'String?', required: 'no', source: 'Current schedule context' },
    ],
    responseMapping: [
      { field: 'payload (Schedule)', destination: 'Room schedule', action: 'Yeni boş schedule lokal kaydedilir' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'getTodaySelectedScheduleRouteList',
    screen: 'stop-list',
    action: 'Route Selection',
    trigger: 'Route selection dialog açılışı',
    method: 'POST',
    path: 'Task/GetTodaySelectedScheduleRouteList',
    domain: 'schedule',
    requestModel: 'String',
    responseModel: 'GetTodaySelectedScheduleRouteListBaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Bugün için seçilebilir schedule route listesini getirir.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Route picker UI: Kurye rota seçer',
    ],
    chain: [
      { layer: 'action', label: 'Route Selection', detail: 'stop_list/StopListFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → getTodaySelectedScheduleRouteList()' },
      { layer: 'repository', label: 'MainRepository.getTodaySelectedScheduleRouteList()' },
      { layer: 'api', label: 'POST Task/GetTodaySelectedScheduleRouteList' },
      { layer: 'response', label: '200 GetTodaySelectedScheduleRouteListBaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'ViewModel', file: 'stop_list/StopViewModel.kt', method: 'getTodaySelectedScheduleRouteList()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getTodaySelectedScheduleRouteList()' },
    ],
    requestFields: [
      { field: '(body)', type: 'String', required: 'conditional', source: 'JSON string body — genelde "{}" veya serialized model', validation: 'JSON' },
    ],
    responseMapping: [
      { field: 'payload.routes', destination: 'Route picker UI', action: 'Kurye rota seçer' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'rerouteSchedule',
    screen: 'stop-list',
    action: 'Reroute',
    trigger: 'Manual Routing → Reroute',
    method: 'POST',
    path: 'Task/RerouteSchedule/',
    domain: 'routing',
    requestModel: 'String',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Mevcut schedule’ı yeniden route eder (optimizer/reroute).',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Stop order refresh: GetMySchedule ile liste yenilenir',
    ],
    chain: [
      { layer: 'action', label: 'Reroute', detail: 'stop_list/StopListFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → rerouteSchedule()' },
      { layer: 'repository', label: 'MainRepository.rerouteSchedule()' },
      { layer: 'api', label: 'POST Task/RerouteSchedule/' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'manuelRouting/ManuelRoutingFragment.kt', method: 'rerouteSchedule()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'rerouteSchedule()' },
    ],
    requestFields: [
      { field: '(body)', type: 'String', required: 'conditional', source: 'JSON string body — genelde "{}" veya serialized model', validation: 'JSON' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Stop order refresh', action: 'GetMySchedule ile liste yenilenir' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'addUserIdToSchedule',
    screen: 'stop-list',
    action: 'Claim Schedule',
    trigger: 'Schedule claim / start',
    method: 'POST',
    path: 'Task/AddUserIdToSchedule',
    domain: 'schedule',
    requestModel: 'AddUserIdToScheduleRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Aktif kullanıcıyı schedule’a claim eder (AddUserIdToSchedule).',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Schedule ownership: Kurye schedule’a bağlanır',
    ],
    chain: [
      { layer: 'action', label: 'Claim Schedule', detail: 'stop_list/StopListFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → addUserIdToSchedule()' },
      { layer: 'repository', label: 'MainRepository.addUserIdToSchedule()' },
      { layer: 'api', label: 'POST Task/AddUserIdToSchedule' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'API', file: 'network/APIService.kt', method: 'addUserIdToSchedule()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'addUserIdToSchedule()' },
    ],
    requestFields: [
      { field: 'ScheduleId', type: 'String', required: 'yes', source: 'SP.scheduleId / current Schedule' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Schedule ownership', action: 'Kurye schedule’a bağlanır' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
    notes: 'API yüzeyinde tanımlı; aktif UI çağıranı zayıf — orphan riski.',
  },
  {
    id: 'removeUserIdFromSchedule',
    screen: 'stop-list',
    action: 'Release Schedule',
    trigger: 'Release schedule',
    method: 'POST',
    path: 'Task/RemoveUserIdFromSchedule',
    domain: 'schedule',
    requestModel: 'String ("{}")',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Kullanıcıyı schedule’dan bırakır (release).',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Schedule ownership: Claim kaldırılır',
    ],
    chain: [
      { layer: 'action', label: 'Release Schedule', detail: 'stop_list/StopListFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → removeUserIdFromSchedule()' },
      { layer: 'repository', label: 'MainRepository.removeUserIdFromSchedule()' },
      { layer: 'api', label: 'POST Task/RemoveUserIdFromSchedule' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'API', file: 'network/APIService.kt', method: 'removeUserIdFromSchedule()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'removeUserIdFromSchedule()' },
    ],
    requestFields: [
      { field: '(body)', type: 'String', required: 'conditional', source: 'JSON string body — genelde "{}" veya serialized model', validation: 'JSON' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Schedule ownership', action: 'Claim kaldırılır' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
    notes: 'Body varsayılan "{}".',
  },
  {
    id: 'scheduleStatusChange',
    screen: 'stop-list',
    action: 'Start / Pause Schedule',
    trigger: 'Start / Pause Schedule',
    method: 'POST',
    path: 'Task/ScheduleStatusChange',
    domain: 'schedule',
    requestModel: 'AddUserIdToScheduleRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Schedule durumunu değiştirir (start/pause benzeri status transition).',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Schedule status: UI status badge güncellenir',
    ],
    chain: [
      { layer: 'action', label: 'Start / Pause Schedule', detail: 'stop_list/StopListFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → scheduleStatusChange()' },
      { layer: 'repository', label: 'MainRepository.scheduleStatusChange()' },
      { layer: 'api', label: 'POST Task/ScheduleStatusChange' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'API', file: 'network/APIService.kt', method: 'scheduleStatusChange()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'scheduleStatusChange()' },
    ],
    requestFields: [
      { field: 'ScheduleId', type: 'String', required: 'yes', source: 'SP.scheduleId / current Schedule' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Schedule status', action: 'UI status badge güncellenir' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'setTaskToComeAgain',
    screen: 'stop-list',
    action: 'Come Again',
    trigger: 'Come Again aksiyonu',
    method: 'POST',
    path: 'Task/SetTaskToComeAgain/',
    domain: 'schedule',
    requestModel: 'ComeAgainRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: true,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Görevi stop listesinin sonuna taşır; offline kuyruk tipi MoveTaskToEndOfStopList.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
      'RequestSenderService çalışıyor (offline yazımlar için)',
    ],
    postEffects: [
      'Room Request + local stop order: UI anında sona taşınır; sync sonra',
    ],
    chain: [
      { layer: 'action', label: 'Come Again', detail: 'stop_list/StopListFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → setTaskToComeAgain()' },
      { layer: 'repository', label: 'MainRepository.setTaskToComeAgain()' },
      { layer: 'queue', label: 'Room Request queue', detail: 'RequestSenderService drain' },
      { layer: 'api', label: 'POST Task/SetTaskToComeAgain/' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'stop_list/StopListFragment.kt', method: 'comeAgain' },
      { layer: 'Queue', file: 'services/RequestSenderService.kt', method: 'COME_AGAIN' },
      { layer: 'API', file: 'network/APIService.kt', method: 'setTaskToComeAgain()' },
    ],
    requestFields: [
      { field: 'taskId', type: 'String', required: 'yes', source: 'currentTask.taskId' },
      { field: 'courierZoneCode', type: 'String', required: 'yes', source: 'SP.courierZone' },
    ],
    responseMapping: [
      { field: 'queued request', destination: 'Room Request + local stop order', action: 'UI anında sona taşınır; sync sonra' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Kuyrukta kalır / retry (max 3)', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'orderStopList',
    screen: 'stop-list',
    action: 'Reorder Stops',
    trigger: 'Stop reorder kaydet',
    method: 'POST',
    path: 'Task/OrderStopListFromTerminal/',
    domain: 'routing',
    requestModel: 'ManualRoutingReq',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Terminal üzerinden stop sırasını kaydeder (drag-drop / manual order).',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Room stop order: Stop List sırası kalıcılaşır',
    ],
    chain: [
      { layer: 'action', label: 'Reorder Stops', detail: 'stop_list/StopListFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → orderStopList()' },
      { layer: 'repository', label: 'MainRepository.orderStopList()' },
      { layer: 'api', label: 'POST Task/OrderStopListFromTerminal/' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'ViewModel', file: 'stop_list/StopViewModel.kt', method: 'orderStopList' },
      { layer: 'API', file: 'network/APIService.kt', method: 'orderStopList()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'orderStopList()' },
    ],
    requestFields: [
      { field: 'StopOrderList', type: 'HashMap<String,Int>', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'ScheduleId', type: 'String', required: 'yes', source: 'SP.scheduleId / current Schedule' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Room stop order', action: 'Stop List sırası kalıcılaşır' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  // ═══ TASK LIST ═════════════════════════════════════════════════════════
  {
    id: 'getShipmentDetails',
    screen: 'task-list',
    action: 'Open Task',
    trigger: 'Task List → Open Task',
    method: 'POST',
    path: 'Shipment/GetShipmentDetails/',
    domain: 'shipment',
    requestModel: 'GetShipmentDetailsRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Görev açılırken barkod listesiyle shipment detaylarını çeker.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Task detail UI / currentShipment: Detay paneli dolar',
    ],
    chain: [
      { layer: 'action', label: 'Open Task', detail: 'task_list/TaskListFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → getShipmentDetails()' },
      { layer: 'repository', label: 'MainRepository.getShipmentDetails()' },
      { layer: 'api', label: 'POST Shipment/GetShipmentDetails/' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'task_list/TaskListFragment.kt', method: 'openTask' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'getShipmentDetails' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getShipmentDetails()' },
    ],
    requestFields: [
      { field: 'courierZoneCode', type: 'String', required: 'yes', source: 'SP.courierZone' },
      { field: 'barcodeList', type: 'List<String>', required: 'yes', source: 'Barcode scan list' },
      { field: 'channelType', type: 'ChannelType', required: 'yes', source: 'Request model / ViewModel' },
    ],
    responseMapping: [
      { field: 'payload', destination: 'Task detail UI / currentShipment', action: 'Detay paneli dolar' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'updateDeliveryRemark',
    screen: 'task-list',
    action: 'Update Remark',
    trigger: 'Task remark kaydet',
    method: 'POST',
    path: 'Task/UpdateDeliveryRemark/',
    domain: 'delivery',
    requestModel: 'UpdateDeliveryRemarkReq',
    responseModel: 'BaseResponse',
    auth: true,
    offline: true,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Teslimat notunu günceller — offline Request kuyruğu destekli.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
      'RequestSenderService çalışıyor (offline yazımlar için)',
    ],
    postEffects: [
      'Room Request + local remark: UI anında güncellenir',
    ],
    chain: [
      { layer: 'action', label: 'Update Remark', detail: 'task_list/TaskListFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → updateDeliveryRemark()' },
      { layer: 'repository', label: 'MainRepository.updateDeliveryRemark()' },
      { layer: 'queue', label: 'Room Request queue', detail: 'RequestSenderService drain' },
      { layer: 'api', label: 'POST Task/UpdateDeliveryRemark/' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'task_list/TaskListFragment.kt', method: 'updateRemark' },
      { layer: 'Queue', file: 'services/RequestSenderService.kt', method: 'UpdateDeliveryRemark' },
      { layer: 'API', file: 'network/APIService.kt', method: 'updateDeliveryRemark()' },
    ],
    requestFields: [
      { field: 'scheduleId', type: 'String', required: 'yes', source: 'SP.scheduleId / current Schedule' },
      { field: 'stopId', type: 'String', required: 'yes', source: 'currentStop.stopId' },
      { field: 'taskId', type: 'String', required: 'yes', source: 'currentTask.taskId' },
      { field: 'remarkText', type: 'String', required: 'yes', source: 'User input' },
    ],
    responseMapping: [
      { field: 'queued', destination: 'Room Request + local remark', action: 'UI anında güncellenir' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Kuyrukta kalır / retry (max 3)', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'getNotificationMessagesByShipmentId',
    screen: 'task-list',
    action: 'Open Remarks',
    trigger: 'Open Remarks',
    method: 'POST',
    path: 'Notification/GetNotificationMessagesByShipmentId',
    domain: 'shipment',
    requestModel: 'SearchNotificationMessageRequest',
    responseModel: 'RemarkMessageResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Shipment’a ait remark / notification mesajlarını listeler.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Remarks list UI: Mesaj thread çizilir',
    ],
    chain: [
      { layer: 'action', label: 'Open Remarks', detail: 'task_list/TaskListFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → getNotificationMessagesByShipmentId()' },
      { layer: 'repository', label: 'MainRepository.getNotificationMessagesByShipmentId()' },
      { layer: 'api', label: 'POST Notification/GetNotificationMessagesByShipmentId' },
      { layer: 'response', label: '200 RemarkMessageResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'task_list/TaskListFragment.kt', method: 'openRemarks' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getNotificationMessagesByShipmentId()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getNotificationMessagesByShipmentId()' },
    ],
    requestFields: [
      { field: 'shipmentId', type: 'String', required: 'yes', source: 'currentTask.shipmentId' },
      { field: 'messageType', type: 'Int', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'isUpdateRequired', type: 'Boolean?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'channel', type: 'Int', required: 'yes', source: 'Request model / ViewModel' },
    ],
    responseMapping: [
      { field: 'payload.messages', destination: 'Remarks list UI', action: 'Mesaj thread çizilir' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'createNotificationMessage',
    screen: 'task-list',
    action: 'Send Remark',
    trigger: 'Send Remark',
    method: 'POST',
    path: 'Notification/CreateNotificationMessage',
    domain: 'shipment',
    requestModel: 'NotificationMessageRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Shipment için yeni remark/notification mesajı oluşturur.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Remarks list: Yeni mesaj listeye eklenir',
    ],
    chain: [
      { layer: 'action', label: 'Send Remark', detail: 'task_list/TaskListFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → createNotificationMessage()' },
      { layer: 'repository', label: 'MainRepository.createNotificationMessage()' },
      { layer: 'api', label: 'POST Notification/CreateNotificationMessage' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'task_list/TaskListFragment.kt', method: 'sendRemark' },
      { layer: 'API', file: 'network/APIService.kt', method: 'createNotificationMessage()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'createNotificationMessage()' },
    ],
    requestFields: [
      { field: 'shipmentId', type: 'String?', required: 'no', source: 'currentTask.shipmentId' },
      { field: 'messageType', type: 'NotificationMessageType?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'messageContent', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'messageTime', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'channel', type: 'PermissionChannel?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'senderUserName', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'senderRole', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'senderFullName', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Remarks list', action: 'Yeni mesaj listeye eklenir' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'restartTask',
    screen: 'task-list',
    action: 'Restore Task',
    trigger: 'Restart Task',
    method: 'POST',
    path: 'Task/RestoreTaskState',
    domain: 'schedule',
    requestModel: 'RestartTaskReq',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Görevi RestoreTaskState ile önceki state’e döndürür / yeniden başlatır.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Task state: Görev tekrar actionable olur',
    ],
    chain: [
      { layer: 'action', label: 'Restore Task', detail: 'task_list/TaskListFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → restartTask()' },
      { layer: 'repository', label: 'MainRepository.restartTask()' },
      { layer: 'api', label: 'POST Task/RestoreTaskState' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'task_list/TaskListFragment.kt', method: 'restartTask' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'restartTask' },
      { layer: 'API', file: 'network/APIService.kt', method: 'restartTask()' },
    ],
    requestFields: [
      { field: 'RestoreTaskId', type: 'List<String>', required: 'yes', source: 'UI selection / scan list' },
      { field: 'ScheduleId', type: 'String', required: 'yes', source: 'SP.scheduleId / current Schedule' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Task state', action: 'Görev tekrar actionable olur' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
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
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Barkodları araca yükler. Kuyruk case’inde barkod bazlı dedup var; kuyruk tipi LOAD_PARCEL_TO_COURIER_VEHICLE (RequestSenderService:267).',
    preconditions: [
      'Barkod formatı ve desi/kg kontrolü geçilmiş olmalı',
      'RequestSenderService çalışıyor olmalı',
    ],
    postEffects: [
      'Başarılı istek CompletedRequest arşivine taşınır',
      'Barkodun araç yük durumu schedule/stop görünümüne yansır',
    ],
    chain: [
      { layer: 'action', label: 'Scan Barcode', detail: 'BarcodeRoutingFragment' },
      { layer: 'viewmodel', label: 'SharedViewModel.saveRequest(LOAD_PARCEL_TO_COURIER_VEHICLE)' },
      { layer: 'queue', label: 'Room Request satırı', detail: 'uniqueKey dedup' },
      { layer: 'queue', label: 'RequestSenderService dispatch', detail: ':267-285' },
      { layer: 'repository', label: 'MainRepository.loadParcelToCourierVehicle()' },
      { layer: 'api', label: 'POST Task/LoadParcelToCourierVehicle/' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'db', label: 'Parcel cache + CompletedRequest arşivi' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'barcoderouting/BarcodeRoutingViewModel.kt', method: 'scan/saveRequest() · :485-490' },
      { layer: 'Queue', file: 'services/RequestSenderService.kt', method: 'LOAD_PARCEL_TO_COURIER_VEHICLE · :267' },
      { layer: 'Repository', file: 'main/MainRepository.kt', method: 'loadParcelToCourierVehicle() · :117' },
      { layer: 'Provider', file: 'network/ApiProvider.kt', method: 'loadParcelToCourierVehicle() · :120' },
      { layer: 'API', file: 'network/APIService.kt', method: 'loadParcelToCourierVehicle() · :170' },
    ],
    requestFields: [
      { field: '[]', type: 'List<String>', required: 'yes', source: 'Tarayıcıdan alınan barcode listesi', validation: 'Boş olmamalı; uniqueKey sıralı barkodlardan üretilir' },
    ],
    responseMapping: [
      { field: 'resultCode', destination: 'RequestSenderService processApiCall', action: 'Başarıda request tamamlanır; hatada retry uygulanır' },
      { field: 'resultMessage', destination: 'Request.requestTrace', action: 'Hata/diagnostic mesajı olarak saklanır' },
    ],
    errors: [
      { status: 'Malformed JSON', backend: 'İstek gönderilmez', mobile: 'Request arşivlenir; requestTrace yazılır', user: 'Barkod yüklenmez' },
      { status: '4xx/business', backend: 'Validation veya mevcut araç durumu uyuşmazlığı', mobile: 'tryCount artırılır', user: 'Retry/uyarı' },
      { status: '5xx/network', backend: 'Server veya bağlantı hatası', mobile: 'Kuyrukta kalır; network hatası retry sayısını tüketmez', user: 'Offline akış devam eder' },
    ],
    tests: [
      { name: 'Single barcode load', status: 'partial', env: 'Manual' },
      { name: 'Duplicate barcode uniqueKey/dedup', status: 'partial', env: 'Manual' },
      { name: 'Malformed queue JSON and retry', status: 'missing' },
    ],
  },
  {
    id: 'unloadParcelFromCourierVehicle',
    screen: 'barcode-routing',
    action: 'Scan & Unload',
    trigger: 'Barcode Routing / unload scan',
    method: 'POST',
    path: 'Task/UnloadParcelFromCourierVehicle/',
    domain: 'shipment',
    requestModel: 'UnloadFromCourierVehicleReq',
    responseModel: 'BaseResponse',
    auth: true,
    offline: true,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Araca yüklenmiş parcel’ı araçtan indirir (unload from courier vehicle).',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
      'RequestSenderService çalışıyor (offline yazımlar için)',
    ],
    postEffects: [
      'Vehicle load state: Parcel araçtan düşülür',
    ],
    chain: [
      { layer: 'action', label: 'Scan & Unload', detail: 'barcoderouting/BarcodeRoutingFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → unloadParcelFromCourierVehicle()' },
      { layer: 'repository', label: 'MainRepository.unloadParcelFromCourierVehicle()' },
      { layer: 'queue', label: 'Room Request queue', detail: 'RequestSenderService drain' },
      { layer: 'api', label: 'POST Task/UnloadParcelFromCourierVehicle/' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'barcoderouting/BarcodeRoutingFragment.kt', method: 'unload' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'unloadParcel' },
      { layer: 'API', file: 'network/APIService.kt', method: 'unloadParcelFromCourierVehicle()' },
    ],
    requestFields: [
      { field: 'barcodeList', type: 'List<String>', required: 'yes', source: 'Barcode scan list' },
      { field: 'courierZoneCode', type: 'String', required: 'yes', source: 'SP.courierZone' },
      { field: 'TaskType', type: 'Int', required: 'yes', source: 'Request model / ViewModel' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Vehicle load state', action: 'Parcel araçtan düşülür' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Kuyrukta kalır / retry (max 3)', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'insertShipmentNotDeliveredControl',
    screen: 'barcode-routing',
    action: 'Not-Delivered Control',
    trigger: 'Not delivered control scan',
    method: 'POST',
    path: 'Task/InsertShipmentNotDeliveredControl/',
    domain: 'shipment',
    requestModel: 'CargoBarcode',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Teslim edilemeyen kargo için kontrol kaydı oluşturur (not-delivered control).',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Control log: Kontrol kaydı oluşur',
    ],
    chain: [
      { layer: 'action', label: 'Not-Delivered Control', detail: 'barcoderouting/BarcodeRoutingFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → insertShipmentNotDeliveredControl()' },
      { layer: 'repository', label: 'MainRepository.insertShipmentNotDeliveredControl()' },
      { layer: 'api', label: 'POST Task/InsertShipmentNotDeliveredControl/' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'insertShipmentNotDeliveredControl' },
      { layer: 'API', file: 'network/APIService.kt', method: 'insertShipmentNotDeliveredControl()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'insertShipmentNotDeliveredControl()' },
    ],
    requestFields: [
      { field: 'CargoBarcode', type: 'String', required: 'yes', source: 'Barcode scan' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Control log', action: 'Kontrol kaydı oluşur' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'createCourierDailyBarcode',
    screen: 'barcode-routing',
    action: 'Create Daily Barcode',
    trigger: 'Daily barcode create',
    method: 'POST',
    path: 'Task/CreateCourierDailyBarcode',
    domain: 'shipment',
    requestModel: 'CreateCourierDailyBarcodeRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Kurye günlük barkodunu oluşturur (daily barcode).',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Daily barcode UI: Barkod yazdırılır/gösterilir',
    ],
    chain: [
      { layer: 'action', label: 'Create Daily Barcode', detail: 'barcoderouting/BarcodeRoutingFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → createCourierDailyBarcode()' },
      { layer: 'repository', label: 'MainRepository.createCourierDailyBarcode()' },
      { layer: 'api', label: 'POST Task/CreateCourierDailyBarcode' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'createCourierDailyBarcode' },
      { layer: 'API', file: 'network/APIService.kt', method: 'createCourierDailyBarcode()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'createCourierDailyBarcode()' },
    ],
    requestFields: [
      { field: 'Username', type: 'String', required: 'yes', source: 'User input / SP.userName' },
    ],
    responseMapping: [
      { field: 'payload/success', destination: 'Daily barcode UI', action: 'Barkod yazdırılır/gösterilir' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  // ═══ MANUAL ROUTING ════════════════════════════════════════════════════
  {
    id: 'manuelRoute',
    screen: 'manuel-routing',
    action: 'Calculate Route',
    trigger: 'Manual Routing ekranı hesapla',
    method: 'POST',
    path: 'Routing/ManualRoute/',
    domain: 'routing',
    requestModel: 'ManuelRouteReq',
    responseModel: 'ManuelRouteResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Manuel rota simülasyonu / hesaplama — current→destination point list ile route önerir.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'ManuelRouting UI: Önerilen sıra çizilir',
    ],
    chain: [
      { layer: 'action', label: 'Calculate Route', detail: 'manuelRouting/ManuelRoutingFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → manuelRoute()' },
      { layer: 'repository', label: 'MainRepository.manuelRoute()' },
      { layer: 'api', label: 'POST Routing/ManualRoute/' },
      { layer: 'response', label: '200 ManuelRouteResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'manuelRouting/ManuelRoutingFragment.kt', method: 'manuelRoute()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'manuelRoute()' },
    ],
    requestFields: [
      { field: 'Id', type: 'String', required: 'yes', source: 'Current schedule/entity id' },
      { field: 'SimulationFlag', type: 'Boolean', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'Current', type: 'ManuelRoutingStopModel', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'Destination', type: 'ManuelRoutingStopModel', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'PointList', type: 'List<ManuelRoutingStopModel>', required: 'yes', source: 'UI selection / scan list' },
    ],
    responseMapping: [
      { field: 'payload route', destination: 'ManuelRouting UI', action: 'Önerilen sıra çizilir' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'saveManuelRouting',
    screen: 'manuel-routing',
    action: 'Save Route',
    trigger: 'Manual Routing / Barcode Routing → Save',
    method: 'POST',
    path: 'Task/SaveManuelRouting/',
    domain: 'routing',
    requestModel: 'SaveManuelRoutingReq',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Manuel / drag-drop stop sırasını schedule’a kaydeder.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Room stop order: Yeni sıra kalıcılaşır',
    ],
    chain: [
      { layer: 'action', label: 'Save Route', detail: 'manuelRouting/ManuelRoutingFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → saveManuelRouting()' },
      { layer: 'repository', label: 'MainRepository.saveManuelRouting()' },
      { layer: 'api', label: 'POST Task/SaveManuelRouting/' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'manuelRouting/ManuelRoutingFragment.kt', method: 'saveManuelRouting()' },
      { layer: 'ViewModel', file: 'barcoderouting/BarcodeRoutingViewModel.kt', method: 'saveManuelRouting()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'saveManuelRouting()' },
    ],
    requestFields: [
      { field: 'ScheduleId', type: 'String', required: 'yes', source: 'SP.scheduleId / current Schedule' },
      { field: 'StopList', type: 'List<ManuelRoutingStop>', required: 'yes', source: 'UI selection / scan list' },
      { field: 'IsFromAndroidManuelRouting', type: 'Boolean', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'IsCourierControlledRoute', type: 'Boolean', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'IsDragDropRouting', type: 'Boolean', required: 'yes', source: 'Request model / ViewModel' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Room stop order', action: 'Yeni sıra kalıcılaşır' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'calculateTotalDistance',
    screen: 'manuel-routing',
    action: 'Calculate Distance',
    trigger: 'Routing distance calculate',
    method: 'POST',
    path: 'Routing/CalculateTotalDistance/',
    domain: 'routing',
    requestModel: 'CalculateTotalDistanceRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Point list üzerinden toplam mesafe hesaplar.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Distance display: Mesafe UI’da gösterilir',
    ],
    chain: [
      { layer: 'action', label: 'Calculate Distance', detail: 'manuelRouting/ManuelRoutingFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → calculateTotalDistance()' },
      { layer: 'repository', label: 'MainRepository.calculateTotalDistance()' },
      { layer: 'api', label: 'POST Routing/CalculateTotalDistance/' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'API', file: 'network/APIService.kt', method: 'calculateTotalDistance()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'calculateTotalDistance()' },
    ],
    requestFields: [
      { field: 'ScheduleId', type: 'String', required: 'yes', source: 'SP.scheduleId / current Schedule' },
      { field: 'PointList', type: 'List<Point>', required: 'yes', source: 'UI selection / scan list' },
      { field: 'DistanceType', type: 'Int', required: 'yes', source: 'Fixed enum' },
    ],
    responseMapping: [
      { field: 'payload distance', destination: 'Distance display', action: 'Mesafe UI’da gösterilir' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
    notes: 'Orphan riski — UI çağıranı zayıf.',
  },
  {
    id: 'manuelMergeStopsInSchedule',
    screen: 'manuel-routing',
    action: 'Merge Stops',
    trigger: 'Merge Stops',
    method: 'POST',
    path: 'Task/ManuelMergeStopsInSchedule',
    domain: 'routing',
    requestModel: 'MergeAndSplitStopsRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Schedule içinde seçilen stop’ları manuel birleştirir.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Stop List refresh: Birleşik stop görünür',
    ],
    chain: [
      { layer: 'action', label: 'Merge Stops', detail: 'manuelRouting/ManuelRoutingFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → manuelMergeStopsInSchedule()' },
      { layer: 'repository', label: 'MainRepository.manuelMergeStopsInSchedule()' },
      { layer: 'api', label: 'POST Task/ManuelMergeStopsInSchedule' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'mergestops/', method: 'merge' },
      { layer: 'API', file: 'network/APIService.kt', method: 'manuelMergeStopsInSchedule()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'manuelMergeStopsInSchedule()' },
    ],
    requestFields: [
      { field: 'ScheduleId', type: 'String', required: 'yes', source: 'SP.scheduleId / current Schedule' },
      { field: 'MainStopId', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'ChildStopIds', type: 'List<String>', required: 'yes', source: 'UI selection / scan list' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Stop List refresh', action: 'Birleşik stop görünür' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'manuelSplitStopsInSchedule',
    screen: 'manuel-routing',
    action: 'Split Stops',
    trigger: 'Split Stops',
    method: 'POST',
    path: 'Task/ManuelSplitStopsInSchedule',
    domain: 'routing',
    requestModel: 'MergeAndSplitStopsRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Birleştirilmiş stop’ları manuel olarak ayırır.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Stop List refresh: Ayrılmış stop’lar görünür',
    ],
    chain: [
      { layer: 'action', label: 'Split Stops', detail: 'manuelRouting/ManuelRoutingFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → manuelSplitStopsInSchedule()' },
      { layer: 'repository', label: 'MainRepository.manuelSplitStopsInSchedule()' },
      { layer: 'api', label: 'POST Task/ManuelSplitStopsInSchedule' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'mergestops/', method: 'split' },
      { layer: 'API', file: 'network/APIService.kt', method: 'manuelSplitStopsInSchedule()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'manuelSplitStopsInSchedule()' },
    ],
    requestFields: [
      { field: 'ScheduleId', type: 'String', required: 'yes', source: 'SP.scheduleId / current Schedule' },
      { field: 'MainStopId', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'ChildStopIds', type: 'List<String>', required: 'yes', source: 'UI selection / scan list' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Stop List refresh', action: 'Ayrılmış stop’lar görünür' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'courierRouteChange',
    screen: 'manuel-routing',
    action: 'Change Route',
    trigger: 'Route change aksiyonu',
    method: 'POST',
    path: 'Task/CourierRouteChange/',
    domain: 'routing',
    requestModel: 'CourierRouteChangeReq',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Kurye rota değişikliğini kaydeder.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Schedule/route context: Yeni rota bağlanır',
    ],
    chain: [
      { layer: 'action', label: 'Change Route', detail: 'manuelRouting/ManuelRoutingFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → courierRouteChange()' },
      { layer: 'repository', label: 'MainRepository.courierRouteChange()' },
      { layer: 'api', label: 'POST Task/CourierRouteChange/' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'courierRouteChange' },
      { layer: 'API', file: 'network/APIService.kt', method: 'courierRouteChange()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'courierRouteChange()' },
    ],
    requestFields: [
      { field: 'CourierOldScheduleId', type: 'String', required: 'yes', source: 'Current schedule context' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Schedule/route context', action: 'Yeni rota bağlanır' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  // ═══ LINEHAUL ══════════════════════════════════════════════════════════
  {
    id: 'getLinehaulAssignments',
    screen: 'linehaul',
    action: 'Screen Open',
    trigger: 'Linehaul Load ekranı açılışı',
    method: 'POST',
    path: 'Shipment/GetLinehaulAssignments/',
    domain: 'shipment',
    requestModel: 'GetLinehaulAssignmentsRequest',
    responseModel: 'GetLinehaulAssignmentsResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Verilen status’e göre linehaul assignment listesini getirir.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Linehaul list UI: Yüklenecek seferler listelenir',
    ],
    chain: [
      { layer: 'action', label: 'Screen Open', detail: 'linehaul/LinehaulLoadFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → getLinehaulAssignments()' },
      { layer: 'repository', label: 'MainRepository.getLinehaulAssignments()' },
      { layer: 'api', label: 'POST Shipment/GetLinehaulAssignments/' },
      { layer: 'response', label: '200 GetLinehaulAssignmentsResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'linehaul/LinehaulLoadFragment.kt', method: 'getLinehaulAssignments()' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'getLinehaulAssignments()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getLinehaulAssignments()' },
    ],
    requestFields: [
      { field: 'status', type: 'Int', required: 'yes', source: 'UI selection' },
    ],
    responseMapping: [
      { field: 'payload.assignments', destination: 'Linehaul list UI', action: 'Yüklenecek seferler listelenir' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'loadToLineHaul',
    screen: 'linehaul',
    action: 'Load to Linehaul',
    trigger: 'Linehaul load scan',
    method: 'POST',
    path: 'Shipment/LoadToLineHaul/',
    domain: 'shipment',
    requestModel: 'LoadToLinehaulRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Barkod listesini seçili linehaul assignment’a yükler.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Loaded barcode list: Barkod yüklendi olarak işaretlenir',
    ],
    chain: [
      { layer: 'action', label: 'Load to Linehaul', detail: 'linehaul/LinehaulLoadFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → loadToLineHaul()' },
      { layer: 'repository', label: 'MainRepository.loadToLineHaul()' },
      { layer: 'api', label: 'POST Shipment/LoadToLineHaul/' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'linehaul/LinehaulLoadFragment.kt', method: 'load' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'loadToLineHaul' },
      { layer: 'API', file: 'network/APIService.kt', method: 'loadToLineHaul()' },
    ],
    requestFields: [
      { field: 'linehaulAssignmentId', type: 'Int', required: 'yes', source: 'Selected linehaul assignment' },
      { field: 'barcodeList', type: 'List<String>', required: 'yes', source: 'Barcode scan list' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Loaded barcode list', action: 'Barkod yüklendi olarak işaretlenir' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'finishLoadToLinehaul',
    screen: 'linehaul',
    action: 'Finish Loading',
    trigger: 'Finish load + seal entry',
    method: 'POST',
    path: 'Shipment/FinishLoadtoLinehaul/',
    domain: 'shipment',
    requestModel: 'FinishLoadToLinehaulRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Linehaul yüklemeyi seal numaralarıyla tamamlar.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Assignment status: Yükleme Completed',
    ],
    chain: [
      { layer: 'action', label: 'Finish Loading', detail: 'linehaul/LinehaulLoadFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → finishLoadToLinehaul()' },
      { layer: 'repository', label: 'MainRepository.finishLoadToLinehaul()' },
      { layer: 'api', label: 'POST Shipment/FinishLoadtoLinehaul/' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'linehaul/LinehaulLoadFragment.kt', method: 'finish' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'finishLoadToLinehaul' },
      { layer: 'API', file: 'network/APIService.kt', method: 'finishLoadToLinehaul()' },
    ],
    requestFields: [
      { field: 'linehaulAssignmentId', type: 'Int', required: 'yes', source: 'Selected linehaul assignment' },
      { field: 'sealNumbers', type: 'List<String>', required: 'yes', source: 'User seal input' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Assignment status', action: 'Yükleme Completed' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'getLoadedLinehaulDetails',
    screen: 'linehaul',
    action: 'Open Loaded Details',
    trigger: 'Linehaul detail / unload hazırlık',
    method: 'POST',
    path: 'Shipment/GetLoadedLinehaulDetails/',
    domain: 'shipment',
    requestModel: 'GetLoadedLinehaulDetailsRequest',
    responseModel: 'GetLinehaulDetailsResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Yüklenmiş linehaul detaylarını (barkodlar vb.) getirir.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Linehaul detail UI: Yüklü içerik listelenir',
    ],
    chain: [
      { layer: 'action', label: 'Open Loaded Details', detail: 'linehaul/LinehaulLoadFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → getLoadedLinehaulDetails()' },
      { layer: 'repository', label: 'MainRepository.getLoadedLinehaulDetails()' },
      { layer: 'api', label: 'POST Shipment/GetLoadedLinehaulDetails/' },
      { layer: 'response', label: '200 GetLinehaulDetailsResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'linehaul/', method: 'details' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'getLoadedLinehaulDetails' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getLoadedLinehaulDetails()' },
    ],
    requestFields: [
      { field: 'linehaulAssignmentId', type: 'Int', required: 'yes', source: 'Selected linehaul assignment' },
    ],
    responseMapping: [
      { field: 'payload', destination: 'Linehaul detail UI', action: 'Yüklü içerik listelenir' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'startUnloadFromLinehaul',
    screen: 'linehaul',
    action: 'Start Unload',
    trigger: 'Start unload',
    method: 'POST',
    path: 'Shipment/StartUnloadFromLinehaul/',
    domain: 'shipment',
    requestModel: 'StartUnloadFromLinehaulRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Linehaul boşaltma oturumunu başlatır.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Unload session: Boşaltma modu açılır',
    ],
    chain: [
      { layer: 'action', label: 'Start Unload', detail: 'linehaul/LinehaulLoadFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → startUnloadFromLinehaul()' },
      { layer: 'repository', label: 'MainRepository.startUnloadFromLinehaul()' },
      { layer: 'api', label: 'POST Shipment/StartUnloadFromLinehaul/' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'linehaul/', method: 'startUnload' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'startUnloadFromLinehaul' },
      { layer: 'API', file: 'network/APIService.kt', method: 'startUnloadFromLinehaul()' },
    ],
    requestFields: [
      { field: 'linehaulAssignmentId', type: 'Int', required: 'yes', source: 'Selected linehaul assignment' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Unload session', action: 'Boşaltma modu açılır' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'unloadFromLinehaul',
    screen: 'linehaul',
    action: 'Unload',
    trigger: 'Unload barcode scan',
    method: 'POST',
    path: 'Shipment/Unload/',
    domain: 'shipment',
    requestModel: 'UnloadRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Linehaul’dan tek barkod boşaltır (event location + weight ile).',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Unload progress: Barkod boşaltıldı',
    ],
    chain: [
      { layer: 'action', label: 'Unload', detail: 'linehaul/LinehaulLoadFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → unloadFromLinehaul()' },
      { layer: 'repository', label: 'MainRepository.unloadFromLinehaul()' },
      { layer: 'api', label: 'POST Shipment/Unload/' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'linehaul/', method: 'unloadScan' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'unloadFromLinehaul' },
      { layer: 'API', file: 'network/APIService.kt', method: 'unloadFromLinehaul()' },
    ],
    requestFields: [
      { field: 'barcode', type: 'String', required: 'yes', source: 'Barcode scan' },
      { field: 'channel', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'eventLocation', type: 'EventLocation', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'weight', type: 'Double', required: 'yes', source: 'Request model / ViewModel' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Unload progress', action: 'Barkod boşaltıldı' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  // ═══ VEHICLE WELCOME ═══════════════════════════════════════════════════
  {
    id: 'getVehicleRouteForVehicleReception',
    screen: 'vehicle-welcome',
    action: 'Screen Open',
    trigger: 'Vehicle welcome / reception scan',
    method: 'POST',
    path: 'Integration/GetVehicleRouteForVehicleReception/',
    domain: 'shipment',
    requestModel: 'VehicleRouteForVehicleReceptionRequest',
    responseModel: 'VehicleWelcomeResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Araç karşılama (vehicle reception) için plaka/TTI/seal ile rota bilgisini getirir.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Vehicle welcome UI: Rota/araç bilgisi gösterilir',
    ],
    chain: [
      { layer: 'action', label: 'Screen Open', detail: 'vehicle-welcome' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → getVehicleRouteForVehicleReception()' },
      { layer: 'repository', label: 'MainRepository.getVehicleRouteForVehicleReception()' },
      { layer: 'api', label: 'POST Integration/GetVehicleRouteForVehicleReception/' },
      { layer: 'response', label: '200 VehicleWelcomeResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'getVehicleRouteForVehicleReception' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getVehicleRouteForVehicleReception()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getVehicleRouteForVehicleReception()' },
    ],
    requestFields: [
      { field: 'PlateNumber', type: 'String', required: 'yes', source: 'User input / vehicle scan' },
      { field: 'TtiBarcode', type: 'String', required: 'yes', source: 'Barcode scan / currentTask' },
      { field: 'SealNumber1', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'SealNumber2', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'RouteCode', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
    ],
    responseMapping: [
      { field: 'payload', destination: 'Vehicle welcome UI', action: 'Rota/araç bilgisi gösterilir' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'insertVehicleReception',
    screen: 'vehicle-welcome',
    action: 'Confirm Reception',
    trigger: 'Confirm vehicle reception',
    method: 'POST',
    path: 'Task/InsertVehicleReception/',
    domain: 'shipment',
    requestModel: 'VehicleRouteForVehicleReceptionRequest',
    responseModel: 'VehicleRouteForVehicleReceptionResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Araç karşılama kaydını oluşturur.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Reception confirmation: Karşılama tamamlanır',
    ],
    chain: [
      { layer: 'action', label: 'Confirm Reception', detail: 'vehicle-welcome' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → insertVehicleReception()' },
      { layer: 'repository', label: 'MainRepository.insertVehicleReception()' },
      { layer: 'api', label: 'POST Task/InsertVehicleReception/' },
      { layer: 'response', label: '200 VehicleRouteForVehicleReceptionResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'insertVehicleReception' },
      { layer: 'API', file: 'network/APIService.kt', method: 'insertVehicleReception()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'insertVehicleReception()' },
    ],
    requestFields: [
      { field: 'PlateNumber', type: 'String', required: 'yes', source: 'User input / vehicle scan' },
      { field: 'TtiBarcode', type: 'String', required: 'yes', source: 'Barcode scan / currentTask' },
      { field: 'SealNumber1', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'SealNumber2', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'RouteCode', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
    ],
    responseMapping: [
      { field: 'payload', destination: 'Reception confirmation', action: 'Karşılama tamamlanır' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'sendVehicleLoading',
    screen: 'vehicle-welcome',
    action: 'Cargo Transaction',
    trigger: 'Vehicle loading barcode scan',
    method: 'POST',
    path: 'Task/InsertCargoTransaction',
    domain: 'shipment',
    requestModel: 'VehicleLoadingRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'InsertCargoTransaction ile araç yükleme hareketi gönderir.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Loading progress: Barkod transaction yazılır',
    ],
    chain: [
      { layer: 'action', label: 'Cargo Transaction', detail: 'vehicle-welcome' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → sendVehicleLoading()' },
      { layer: 'repository', label: 'MainRepository.sendVehicleLoading()' },
      { layer: 'api', label: 'POST Task/InsertCargoTransaction' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'sendVehicleLoading' },
      { layer: 'API', file: 'network/APIService.kt', method: 'sendVehicleLoading()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'sendVehicleLoading()' },
    ],
    requestFields: [
      { field: 'CargoBarcode', type: 'String', required: 'yes', source: 'Barcode scan' },
      { field: 'BarcodeTypeId', type: 'String', required: 'yes', source: 'Barcode scan / currentTask' },
      { field: 'TtiBarcode', type: 'String', required: 'yes', source: 'Barcode scan / currentTask' },
      { field: 'LovShipmentLineTransTypeId', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Loading progress', action: 'Barkod transaction yazılır' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'updateVehicleCourierZoneDriverName',
    screen: 'vehicle-welcome',
    action: 'Assign Driver',
    trigger: 'Driver/zone update',
    method: 'POST',
    path: 'Task/UpdateVehicleCourierZoneDriverName/',
    domain: 'schedule',
    requestModel: 'String',
    responseModel: 'VehicleCourierZoneDriverNameResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Araç-courier zone-sürücü adını günceller.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Driver/zone display: İsim güncellenir',
    ],
    chain: [
      { layer: 'action', label: 'Assign Driver', detail: 'vehicle-welcome' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → updateVehicleCourierZoneDriverName()' },
      { layer: 'repository', label: 'MainRepository.updateVehicleCourierZoneDriverName()' },
      { layer: 'api', label: 'POST Task/UpdateVehicleCourierZoneDriverName/' },
      { layer: 'response', label: '200 VehicleCourierZoneDriverNameResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'API', file: 'network/APIService.kt', method: 'updateVehicleCourierZoneDriverName()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'updateVehicleCourierZoneDriverName()' },
    ],
    requestFields: [
      { field: '(body)', type: 'String', required: 'conditional', source: 'JSON string body — genelde "{}" veya serialized model', validation: 'JSON' },
    ],
    responseMapping: [
      { field: 'payload', destination: 'Driver/zone display', action: 'İsim güncellenir' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
    notes: 'Orphan riski — aktif UI çağıranı zayıf.',
  },
  {
    id: 'getBranchEmployeesByUnitId',
    screen: 'vehicle-welcome',
    action: 'Pick Driver/Courier',
    trigger: 'Driver/courier picker',
    method: 'POST',
    path: 'User/GetBranchEmployeesByUnitId/',
    domain: 'auth',
    requestModel: 'String',
    responseModel: 'DriverCourierResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Şube birimine bağlı çalışan/sürücü listesini getirir.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Picker UI: Liste dolar',
    ],
    chain: [
      { layer: 'action', label: 'Pick Driver/Courier', detail: 'vehicle-welcome' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → getBranchEmployeesByUnitId()' },
      { layer: 'repository', label: 'MainRepository.getBranchEmployeesByUnitId()' },
      { layer: 'api', label: 'POST User/GetBranchEmployeesByUnitId/' },
      { layer: 'response', label: '200 DriverCourierResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'API', file: 'network/APIService.kt', method: 'getBranchEmployeesByUnitId()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getBranchEmployeesByUnitId()' },
    ],
    requestFields: [
      { field: '(body)', type: 'String', required: 'conditional', source: 'JSON string body — genelde "{}" veya serialized model', validation: 'JSON' },
    ],
    responseMapping: [
      { field: 'payload.employees', destination: 'Picker UI', action: 'Liste dolar' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
    notes: 'Orphan riski.',
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
    trigger: 'DEPS teslim tipi seçildiğinde veya parcel-shop görevi schedule üzerinden tamamlandığında',
    method: 'POST',
    path: 'Task/DeliverParcelsFromParcelShop/',
    domain: 'delivery',
    requestModel: 'DeliveryReq',
    responseModel: 'BaseResponse',
    auth: true,
    offline: true,
    waiting: true,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core · Backend Delivery',
    summary: 'Parcel shop teslim varyantı — kuyruk case’i RequestSenderService:386.',
    preconditions: [
      'Aktif parcel-shop delivery task ve en az bir barcode mevcut olmalı',
      'Teslimat request alanları DeliveryReq kurallarını sağlamalı',
      'RequestSenderService çalışıyor olmalı',
    ],
    postEffects: [
      'Başarılı request CompletedRequest arşivine taşınır',
      'Teslim edilen shipment item schedule merge sırasında completed görünür',
    ],
    chain: [
      { layer: 'action', label: 'Complete Parcel Shop Delivery', detail: 'DeliveryFragment.kt:1473 / TaskListFragment.kt:1892' },
      { layer: 'viewmodel', label: 'SharedViewModel.saveRequest(DELIVER_PARCEL_TO_PARCELSHOP)' },
      { layer: 'queue', label: 'Room Request', detail: 'Delivery türü için waiting/undo kuralı' },
      { layer: 'queue', label: 'RequestSenderService dispatch', detail: ':386-395' },
      { layer: 'repository', label: 'MainRepository.deliverParcelsFromParcelShop()' },
      { layer: 'api', label: 'POST Task/DeliverParcelsFromParcelShop/' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'db', label: 'CompletedRequest + schedule item state' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'delivery/DeliveryFragment.kt', method: 'getDeliveryRequest() · :1470-1474' },
      { layer: 'UI', file: 'task_list/TaskListFragment.kt', method: 'saveRequest() · :1891-1895' },
      { layer: 'Queue', file: 'services/RequestSenderService.kt', method: 'DELIVER_PARCEL_TO_PARCELSHOP · :386' },
      { layer: 'Repository', file: 'main/MainRepository.kt', method: 'deliverParcelsFromParcelShop() · :121' },
      { layer: 'Provider', file: 'network/ApiProvider.kt', method: 'deliverParcelsFromParcelShop() · :124' },
      { layer: 'API', file: 'network/APIService.kt', method: 'deliverParcelsFromParcelShop() · :176' },
    ],
    requestFields: [
      { field: 'BarcodeList', type: 'List<String>', required: 'yes', source: 'currentTask / taranan barkodlar', validation: 'Non-empty' },
      { field: 'DeliveryCode', type: 'String', required: 'yes', source: 'Teslimat nedeni/sonucu' },
      { field: 'AffinityType', type: 'Int', required: 'yes', source: 'Task/shipment affinity' },
      { field: 'PartyName', type: 'String', required: 'yes', source: 'Teslim alan kişi inputu' },
      { field: 'IdentityNumber', type: 'String', required: 'conditional', source: 'Teslim alan kişi kimlik inputu', sensitive: true },
      { field: 'ScanDateTime / TimeStamp', type: 'String', required: 'yes', source: 'Cihaz saati' },
      { field: 'CourierStopOrder', type: 'Int', required: 'yes', source: 'current stop sırası' },
      { field: 'Latitude / Longitude', type: 'Double', required: 'yes', source: 'Cihaz GPS', sensitive: true },
      { field: 'SignatureUrl', type: 'String', required: 'conditional', source: 'İmza/foto upload sonucu', sensitive: true },
      { field: 'EventLocation', type: 'EventLocation', required: 'yes', source: 'Cihaz konumu ve event metadata' },
      { field: 'CourierZoneCode', type: 'String', required: 'yes', source: 'SP.route / aktif courier zone' },
      { field: 'CollectionType', type: 'CollectionType', required: 'yes', source: 'Ödeme/tahsilat sonucu' },
      { field: 'FiscalIdentityNumber', type: 'String', required: 'conditional', source: 'Fiscal işlem kimliği', sensitive: true },
      { field: 'saveCollectedShipmentListToCashDeskRequest', type: 'SaveCollectedShipmentListToCashDeskRequest?', required: 'conditional', source: 'Cash/COD tahsilat akışı' },
      { field: 'isPaymentSkipped', type: 'Boolean?', required: 'no', source: 'Ödeme validasyonu sonucu' },
    ],
    responseMapping: [
      { field: 'resultCode', destination: 'RequestSenderService', action: 'Başarıda request’i arşivler; hata durumunda retry/dead-letter uygular' },
      { field: 'resultMessage', destination: 'deliveryReqFailedReason / requestTrace', action: 'HTTP/business hata detayını saklar' },
    ],
    errors: [
      { status: 'Malformed JSON', backend: 'Çağrı yapılmaz', mobile: 'Request silinir ve CompletedRequest’e hata ile arşivlenir', user: 'Teslimat gönderilmez' },
      { status: 'Non-200', backend: 'HTTP/business failure', mobile: 'deliveryReqFailedReason + retry', user: 'Offline retry/uyarı' },
      { status: 'Network/timeout', backend: 'Sonuç belirsiz olabilir', mobile: 'Kuyrukta kalır; idempotency reconciliation gerekir', user: 'Bağlantı gelince yeniden denenir' },
    ],
    tests: [
      { name: 'Parcel-shop delivery happy path', status: 'partial', env: 'Manual' },
      { name: 'Offline queue + undo', status: 'partial', env: 'Manual' },
      { name: 'Timeout after backend success', status: 'missing' },
    ],
  },
  {
    id: 'getShipmentCollection',
    screen: 'payment-collection',
    action: 'Check Payment Status',
    trigger: 'Delivery ödeme adımında shipment için collection durumu kontrol edilirken',
    method: 'POST',
    path: 'Shipment/GetShipmentCollectionStatus',
    domain: 'payment',
    requestModel: 'CheckPaymentRequest',
    responseModel: 'CheckPaymentResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core · Payments',
    summary: 'Shipment’ın tahsilat/ödeme durumunu sorgular — ödeme rayı seçilmeden önce çağrılır.',
    preconditions: ['Aktif shipment id mevcut olmalı', 'Cihaz online olmalı'],
    postEffects: [
      'CheckPaymentResponse payment/collection UI kararına verilir',
      'Ödeme tamamlandıysa delivery akışı devam eder; değilse ilgili payment rayı açılır',
    ],
    chain: [
      { layer: 'action', label: 'Check Shipment Collection', detail: 'delivery/DeliveryFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel.getShipmentCollection()' },
      { layer: 'repository', label: 'MainRepository.getShipmentCollection()' },
      { layer: 'api', label: 'POST Shipment/GetShipmentCollectionStatus' },
      { layer: 'response', label: '200 CheckPaymentResponse' },
      { layer: 'state', label: 'Payment state / delivery continuation' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'delivery/DeliveryFragment.kt', method: 'collection/payment observer' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'getShipmentCollection()' },
      { layer: 'Repository', file: 'main/MainRepository.kt', method: 'getShipmentCollection() · :185' },
      { layer: 'Provider', file: 'network/ApiProvider.kt', method: 'getShipmentCollection() · :184' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getShipmentCollection() · :305' },
    ],
    requestFields: [
      { field: 'ShipmentId', type: 'String', required: 'yes', source: 'currentTask.shipmentId', validation: 'Non-empty' },
    ],
    responseMapping: [
      { field: 'resultCode', destination: 'Resource<CheckPaymentResponse>', action: 'Başarı/hata UI state’ini belirler' },
      { field: 'payload', destination: 'Delivery payment state', action: 'Tahsilatın tamamlanıp tamamlanmadığını ve ödeme kararını besler' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx/business', backend: 'Shipment veya collection bulunamadı', mobile: 'Resource.error + ResultMessage', user: 'Ödeme durumu alınamadı' },
      { status: '5xx/network', backend: 'Servis ulaşılamadı', mobile: 'Resource.error', user: 'Online ödeme akışı ilerlemez' },
    ],
    tests: [
      { name: 'Collection already completed', status: 'partial', env: 'Manual' },
      { name: 'Collection pending opens payment flow', status: 'partial', env: 'Manual' },
      { name: 'Service unavailable', status: 'missing' },
    ],
  },
  {
    id: 'getPaymentId',
    screen: 'payment-collection',
    action: 'Start Payment',
    trigger: 'Payment start',
    method: 'POST',
    path: 'Shipment/GetPaymentId',
    domain: 'payment',
    requestModel: 'String',
    responseModel: 'PaymentIdResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Ödeme akışı için PaymentId üretir/döner.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Payment session: RaiPay/WSPay akışına verilir',
    ],
    chain: [
      { layer: 'action', label: 'Start Payment', detail: 'payment-collection' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → getPaymentId()' },
      { layer: 'repository', label: 'MainRepository.getPaymentId()' },
      { layer: 'api', label: 'POST Shipment/GetPaymentId' },
      { layer: 'response', label: '200 PaymentIdResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'API', file: 'network/APIService.kt', method: 'getPaymentId()' },
      { layer: 'Repository', file: 'main/MainRepository.kt', method: 'getPaymentId()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getPaymentId()' },
    ],
    requestFields: [
      { field: '(body)', type: 'String', required: 'conditional', source: 'JSON string body — genelde "{}" veya serialized model', validation: 'JSON' },
    ],
    responseMapping: [
      { field: 'payload.paymentId', destination: 'Payment session', action: 'RaiPay/WSPay akışına verilir' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'sendPaymentSmsAgain',
    screen: 'payment-collection',
    action: 'Resend Payment SMS',
    trigger: 'Delivery ekranında “Send SMS” butonuna basıldığında',
    method: 'POST',
    path: 'Task/',
    domain: 'payment',
    requestModel: 'SendPaymentSmsRequest',
    responseModel: 'CheckPaymentResponse',
    auth: true,
    offline: false,
    status: 'mismatch',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core · Payments',
    summary: 'Ödeme bağlantısı SMS’ini tekrar göndermeyi dener; mevcut mobil implementasyon boş barcode ve eksik Task topic’i kullanıyor.',
    preconditions: ['Cihaz online olmalı', 'Ödeme bekleyen shipment barcode’u mevcut olmalı'],
    postEffects: [
      'Başarıda SMS butonu disable edilir',
      'CheckPaymentResponse ödeme UI state’ine döner',
    ],
    chain: [
      { layer: 'action', label: 'Resend Payment SMS', detail: 'delivery/DeliveryFragment.kt:360-364' },
      { layer: 'viewmodel', label: 'SharedViewModel.sendPaymentSmsAgain(barcode)', detail: ':2417' },
      { layer: 'repository', label: 'MainRepository.sendPaymentSmsAgain()' },
      { layer: 'api', label: 'POST Task/', detail: 'Topic eksik — contract mismatch' },
      { layer: 'response', label: 'CheckPaymentResponse' },
      { layer: 'state', label: 'SMS button disabled on success' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'delivery/DeliveryFragment.kt', method: 'btnSendSms click · :360-368' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'sendPaymentSmsAgain() · :2417' },
      { layer: 'Repository', file: 'main/MainRepository.kt', method: 'sendPaymentSmsAgain() · :186' },
      { layer: 'Provider', file: 'network/ApiProvider.kt', method: 'sendPaymentSmsAgain() · :185' },
      { layer: 'API', file: 'network/APIService.kt', method: 'sendPaymentSmsAgain() · :308' },
    ],
    requestFields: [
      { field: 'barcode', type: 'String', required: 'yes', source: 'Delivery shipment barcode; mevcut çağrıda boş string gönderiliyor', validation: 'Non-empty olmalı' },
    ],
    responseMapping: [
      { field: 'payload.shipmentCollectionStatus', destination: 'Payment UI state', action: 'Tahsilat durumunu günceller' },
      { field: 'payload.shipmentId', destination: 'Active shipment context', action: 'Yanıtı shipment ile ilişkilendirir' },
      { field: 'resultCode', destination: 'Resource', action: 'Başarıda SMS butonunu disable eder' },
    ],
    errors: [
      { status: 'Contract mismatch', backend: 'Task topic adı yok', mobile: 'Yanlış/belirsiz route’a POST', user: 'SMS gönderilemez' },
      { status: 'Invalid request', backend: 'Boş barcode', mobile: 'Resource.error', user: 'SMS tekrar gönderilemez' },
      { status: 'Network', backend: 'Servise ulaşılamadı', mobile: 'Resource.error', user: 'Buton aktif kalır' },
    ],
    tests: [
      { name: 'Correct backend topic contract', status: 'missing' },
      { name: 'Non-empty barcode resend', status: 'missing' },
      { name: 'Successful resend disables button', status: 'missing' },
    ],
    notes: 'Path yalnızca "Task/" — endpoint adı belirsiz; backend sözleşmesiyle doğrulanmalı.',
  },
  {
    id: 'deviceBindingRaiPay',
    screen: 'payment-collection',
    action: 'Bind POS Terminal',
    trigger: 'RaiPay intent merchant_device_id döndürdükten sonra cihaz-terminal eşleşmesi yapılırken',
    method: 'POST',
    path: 'Shipment/RaipayBindMobilDeviceToPaymentTerminal',
    domain: 'payment',
    requestModel: 'RaipayDeviceBindReq',
    responseModel: 'RaipayDeviceBindResponse',
    auth: true,
    offline: false,
    external: 'RaiPay',
    status: 'mismatch',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core · Payments',
    summary: 'Cihazı RaiPay ödeme terminaline bağlar — RaiPay akışının ilk adımı.',
    preconditions: ['Cihaz online olmalı', 'RaiPay intent merchant_device_id sağlamış olmalı'],
    postEffects: [
      'Başarı veya hata durumunda openRaiPayPaymentIntent() çağrılır',
      'Backend token/expiry payload’ı response modeline deserialize edilir',
    ],
    chain: [
      { layer: 'external', label: 'RaiPay intent returns merchant_device_id' },
      { layer: 'ui', label: 'DeliveryFragment.deviceBindingForRaiPay()', detail: ':3570' },
      { layer: 'viewmodel', label: 'SharedViewModel.deviceBindingRaiPay()', detail: ':3069' },
      { layer: 'repository', label: 'MainRepository.deviceBindingRaiPay()' },
      { layer: 'api', label: 'POST Shipment/RaipayBindMobilDeviceToPaymentTerminal' },
      { layer: 'response', label: 'RaipayDeviceBindResponse' },
      { layer: 'state', label: 'openRaiPayPaymentIntent()' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'delivery/DeliveryFragment.kt', method: 'deviceBindingForRaiPay() · :3570' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'deviceBindingRaiPay() · :3069' },
      { layer: 'Provider', file: 'network/ApiProvider.kt', method: 'deviceBindingRaiPay() · :217' },
      { layer: 'API', file: 'network/APIService.kt', method: 'deviceBindingRaiPay() · :454' },
    ],
    requestFields: [
      { field: 'DeviceId', type: 'String', required: 'yes', source: 'RaiPay activity result merchant_device_id', sensitive: true },
    ],
    responseMapping: [
      { field: 'payload.token', destination: 'RaipayDeviceBindResponse', action: 'Bağlama token’ı deserialize edilir' },
      { field: 'payload.expired_time', destination: 'RaipayDeviceBindResponse', action: 'Token son kullanma bilgisini taşır' },
      { field: 'resultCode', destination: 'Resource', action: '200 başarı; mevcut UI hata durumunda da payment intent’i açar' },
    ],
    errors: [
      { status: 'Contract mismatch', backend: 'Topic “Mobile”, mobil path “Mobil” yazıyor', mobile: 'Gateway route doğrulaması bekleniyor', user: 'Terminal bağlama başarısız olabilir' },
      { status: 'Business/HTTP error', backend: 'Bind reddedildi', mobile: 'ERROR dalında yine openRaiPayPaymentIntent()', user: 'Bağlanmamış terminalle ödeme denemesi riski' },
      { status: 'Network', backend: 'Servis ulaşılamadı', mobile: 'Resource.error', user: 'Payment intent yine açılabilir' },
    ],
    tests: [
      { name: 'Gateway Mobil/Mobile topic resolution', status: 'missing' },
      { name: 'Valid merchant device bind', status: 'partial', env: 'Manual' },
      { name: 'Bind failure must block payment intent', status: 'missing' },
    ],
    notes:
      'Mobil path "RaipayBindMobilDeviceToPaymentTerminal", backend topic adı "RaipayBindMobileDeviceToPaymentTerminal" (Mobil vs Mobile) — yazım farkı contract doğrulaması gerektiriyor.',
  },
  {
    id: 'fetchShipmentRaiPayAuthToken',
    screen: 'payment-collection',
    action: 'Start Card Payment (RaiPay)',
    trigger: 'RaiPay ödeme zinciri başlatıldığında auth token callback’i istenirken',
    method: 'POST',
    path: 'Shipment/RaiPayAuthToken',
    domain: 'payment',
    requestModel: 'ShipmentRaiPayAuthTokenRequest',
    responseModel: 'ShipmentRaiPayAuthTokenResponse',
    auth: true,
    offline: false,
    external: 'RaiPay',
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core · Payments',
    summary: 'RaiPay auth token alır (DeliveryFragment:2832) — ardından payment token istenir.',
    preconditions: ['Cihaz online olmalı', 'RaiPay payment feature aktif olmalı'],
    postEffects: ['payload.token callback ile sonraki RaiPay adımına aktarılır'],
    chain: [
      { layer: 'action', label: 'Start RaiPay Card Payment', detail: 'delivery/DeliveryFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel.fetchShipmentRaiPayAuthToken()', detail: ':2832' },
      { layer: 'repository', label: 'MainRepository.fetchShipmentRaiPayAuthToken()' },
      { layer: 'api', label: 'POST Shipment/RaiPayAuthToken' },
      { layer: 'response', label: 'ShipmentRaiPayAuthTokenResponse' },
      { layer: 'state', label: 'authTokenCallback(payload.token)' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'delivery/DeliveryFragment.kt', method: 'fetchShipmentRaiPayAuthToken() · :3590' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'fetchShipmentRaiPayAuthToken() · :2832' },
      { layer: 'Provider', file: 'network/ApiProvider.kt', method: 'fetchShipmentRaiPayAuthToken() · :218' },
      { layer: 'API', file: 'network/APIService.kt', method: 'fetchShipmentRaiPayAuthToken() · :458' },
    ],
    requestFields: [
      { field: 'shipmentId', type: 'String', required: 'yes', source: 'Aktif shipment; mevcut DeliveryFragment çağrısı boş string gönderiyor', validation: 'Backend beklentisiyle doğrulanmalı' },
    ],
    responseMapping: [
      { field: 'payload.token', destination: 'authTokenCallback', action: 'RaiPay ödeme zincirinin sonraki adımına verilir' },
      { field: 'resultMessage', destination: 'Resource.error / toast', action: 'AuthToken Request Error gösterimine dönüşür' },
    ],
    errors: [
      { status: 'Empty shipmentId', backend: 'Validation riski', mobile: 'Boş token callback veya Resource.error', user: 'RaiPay başlatılamaz' },
      { status: 'Non-2xx/business', backend: 'Token üretilemedi', mobile: 'Resource.error', user: 'AuthToken Request Error' },
      { status: 'Network', backend: 'Servis ulaşılamadı', mobile: 'Resource.error', user: 'Ödeme akışı durur' },
    ],
    tests: [
      { name: 'Auth token happy path', status: 'partial', env: 'Manual' },
      { name: 'Empty shipmentId contract', status: 'missing' },
      { name: 'Expired/invalid auth token', status: 'missing' },
    ],
  },
  {
    id: 'fetchShipmentRaiPayPaymentToken',
    screen: 'payment-collection',
    action: 'Start Card Payment (RaiPay)',
    trigger: 'Auth token aşamasından sonra seçili shipment ve service type’lar için payment token istenirken',
    method: 'POST',
    path: 'Shipment/GetRaiPayPaymentToken',
    domain: 'payment',
    requestModel: 'ShipmentRaiPayPaymentTokenRequest',
    responseModel: 'ShipmentRaiPayPaymentTokenResponse',
    auth: true,
    offline: false,
    external: 'RaiPay',
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core · Payments',
    summary: 'Payment token alınır (DeliveryFragment:2853) ve RaiPay uygulaması intent ile başlatılır.',
    preconditions: ['Cihaz online olmalı', 'En az bir shipment id mevcut olmalı'],
    postEffects: [
      'payload.token paymentCallback’e aktarılır',
      'Token pending RaiPay state’e kaydedilip external intent açılır',
    ],
    chain: [
      { layer: 'ui', label: 'DeliveryFragment serviceTypes hesaplar', detail: ':3616-3631' },
      { layer: 'viewmodel', label: 'SharedViewModel.fetchShipmentRaiPayPaymentToken()', detail: ':2853' },
      { layer: 'repository', label: 'MainRepository.fetchShipmentRaiPayPaymentToken()' },
      { layer: 'api', label: 'POST Shipment/GetRaiPayPaymentToken' },
      { layer: 'response', label: 'ShipmentRaiPayPaymentTokenResponse' },
      { layer: 'state', label: 'paymentCallback(payload.token) → RaiPay intent' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'delivery/DeliveryFragment.kt', method: 'fetchShipmentRaiPayPaymentToken() · :3616' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'fetchShipmentRaiPayPaymentToken() · :2853' },
      { layer: 'Provider', file: 'network/ApiProvider.kt', method: 'fetchShipmentRaiPayPaymentToken() · :219' },
      { layer: 'API', file: 'network/APIService.kt', method: 'fetchShipmentRaiPayPaymentToken() · :462' },
    ],
    requestFields: [
      { field: 'shipmentIdList', type: 'List<String>', required: 'yes', source: 'Teslim edilecek shipment/waybill seçimleri', validation: 'Non-empty' },
      { field: 'PickupBarcode', type: 'String?', required: 'no', source: 'Pickup payment varyantı' },
      { field: 'ServiceTypes', type: 'List<Int>?', required: 'conditional', source: 'Shipment collections; CashPrepayed hariç distinct serviceType listesi' },
    ],
    responseMapping: [
      { field: 'payload.token', destination: 'paymentCallback', action: 'RaiPay external intent ve pending state için kullanılır' },
      { field: 'payload.status', destination: 'Payment token state', action: 'Token üretim durumunu taşır' },
    ],
    errors: [
      { status: 'Empty shipment list', backend: 'Validation', mobile: 'Resource.error', user: 'PaymentToken Request Error' },
      { status: 'Non-2xx/business', backend: 'Token üretilemedi', mobile: 'Resource.error', user: 'Ödeme uygulaması açılmaz' },
      { status: 'Network', backend: 'Servis ulaşılamadı', mobile: 'Resource.error', user: 'Ödeme akışı durur' },
    ],
    tests: [
      { name: 'Single shipment token', status: 'partial', env: 'Manual' },
      { name: 'Multiple shipments + distinct service types', status: 'missing' },
      { name: 'Empty/null token response', status: 'missing' },
    ],
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
    owner: 'Mobile Core · Payments',
    summary:
      'RaiPay ödeme sonucunu backend üzerinden doğrular. External intent sonucu tek başına güvenilmez — nihai otorite bu status sorgusudur.',
    preconditions: ['RaiPay payment token mevcut olmalı', 'Cihaz online olmalı'],
    postEffects: [
      'status_transaction == 1 ise pending RaiPay state temizlenir ve handleDelivery() çağrılır',
      'Başarısız/hatada CollectionType.None yapılır ve pending state temizlenir',
    ],
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
    codeRefs: [
      { layer: 'UI', file: 'delivery/DeliveryFragment.kt', method: 'fetchPaymentStatus() · :3659' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'fetchPaymentStatus() · :2874' },
      { layer: 'Provider', file: 'network/ApiProvider.kt', method: 'fetchPaymentStatus() · :220' },
      { layer: 'API', file: 'network/APIService.kt', method: 'fetchPaymentStatus() · :466' },
    ],
    requestFields: [
      { field: 'Token', type: 'String', required: 'yes', source: 'RaiPay payment token / pending RaiPay state', validation: 'Non-empty', sensitive: true },
    ],
    responseMapping: [
      { field: 'payload.status_transaction', destination: 'DeliveryFragment payment decision', action: '1 → handleDelivery(); diğerleri → CollectionType.None' },
      { field: 'resultCode', destination: 'Resource', action: 'Status doğrulama sonucunu taşır' },
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
    trigger: 'Signature pad → Save',
    method: 'POST',
    path: 'Shipment/SaveSignature',
    domain: 'delivery',
    requestModel: 'SaveSignatureRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Teslimat imzasını shipment’a kaydeder.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Delivery proof: İmza delivery kaydına bağlanır',
    ],
    chain: [
      { layer: 'action', label: 'Save Signature', detail: 'signature' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → saveSignature()' },
      { layer: 'repository', label: 'MainRepository.saveSignature()' },
      { layer: 'api', label: 'POST Shipment/SaveSignature' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'signaturepad/', method: 'save' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'saveSignature' },
      { layer: 'API', file: 'network/APIService.kt', method: 'saveSignature()' },
    ],
    requestFields: [
      { field: 'ShipmentId', type: 'String', required: 'yes', source: 'currentTask.shipmentId' },
      { field: 'Signature', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Delivery proof', action: 'İmza delivery kaydına bağlanır' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'saveImageFile',
    screen: 'delivery',
    action: 'Upload Photo',
    trigger: 'Photo capture after delivery/failed/etc.',
    method: 'MULTIPART',
    path: 'Task/f/SaveImageFile',
    domain: 'delivery',
    requestModel: 'MultipartBody.Part',
    responseModel: 'BaseResponse',
    auth: true,
    offline: true,
    waiting: true,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Task fotoğrafını multipart olarak Task/f/SaveImageFile’a yükler.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
      'RequestSenderService çalışıyor (offline yazımlar için)',
    ],
    postEffects: [
      'Proof image: Dosya adı sonraki request’e bağlanır',
    ],
    chain: [
      { layer: 'action', label: 'Upload Photo', detail: 'delivery/DeliveryFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → saveImageFile()' },
      { layer: 'repository', label: 'MainRepository.saveImageFile()' },
      { layer: 'queue', label: 'Room Request queue', detail: 'RequestSenderService drain' },
      { layer: 'api', label: 'MULTIPART Task/f/SaveImageFile' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'saveImageFile' },
      { layer: 'API', file: 'network/APIService.kt', method: 'saveImageFile()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'saveImageFile()' },
    ],
    requestFields: [
      { field: 'file', type: 'MultipartBody.Part', required: 'yes', source: 'Camera / file picker', validation: 'Non-null part' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Proof image', action: 'Dosya adı sonraki request’e bağlanır' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Kuyrukta kalır / retry (max 3)', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'getCollectionsFromShipment',
    screen: 'payment-collection',
    action: 'Load Collections',
    trigger: 'Payment / collection screen open',
    method: 'POST',
    path: 'Shipment/GetCollectionsFromShipment',
    domain: 'payment',
    requestModel: 'GetShipmentCollectionsRequest',
    responseModel: 'GetShipmentCollectionsBaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Shipment üzerindeki tahsilat (collection) kalemlerini getirir.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Collection UI: Tahsil edilecek tutarlar listelenir',
    ],
    chain: [
      { layer: 'action', label: 'Load Collections', detail: 'payment-collection' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → getCollectionsFromShipment()' },
      { layer: 'repository', label: 'MainRepository.getCollectionsFromShipment()' },
      { layer: 'api', label: 'POST Shipment/GetCollectionsFromShipment' },
      { layer: 'response', label: '200 GetShipmentCollectionsBaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'getCollectionsFromShipment' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getCollectionsFromShipment()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getCollectionsFromShipment()' },
    ],
    requestFields: [
      { field: 'ShipmentIds', type: 'List<String>', required: 'yes', source: 'UI selection / scan list' },
    ],
    responseMapping: [
      { field: 'payload.collections', destination: 'Collection UI', action: 'Tahsil edilecek tutarlar listelenir' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
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
    requestFields: [
      { field: 'ShipmentIds', type: 'List<String>?', required: 'conditional', source: 'Çoklu delivery/pickup shipment seçimi', validation: 'ShipmentId ile en az biri dolu olmalı' },
      { field: 'ShipmentId', type: 'String?', required: 'conditional', source: 'currentTask.shipmentId', validation: 'ShipmentIds ile en az biri dolu olmalı' },
      { field: 'VatNumber', type: 'String?', required: 'no', source: 'Fiscal identity/VAT user input', sensitive: true },
      { field: 'PakHeader', type: 'String', required: 'yes', source: 'SP.pakHeader / ülke fiscal konfigürasyonu' },
      { field: 'IsCpp', type: 'Boolean', required: 'yes', source: 'Pickup/CPP akış ayrımı; varsayılan false' },
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
    trigger: 'Invoice detayında retry aksiyonu veya create fiscal sonucu belirsiz/başarısız olduğunda',
    method: 'POST',
    path: 'Shipment/RetryFiscalInvoice',
    domain: 'fiscal',
    requestModel: 'RetryFiscalInvoiceRequestModel',
    responseModel: 'RetryFiscalInvoiceResponseModel',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core · Backend Fiscal',
    summary: 'Başarısız/belirsiz fiscal denemesini tekrarlar — create ile aynı response modeli.',
    preconditions: ['Mevcut fiscalInvoiceId olmalı', 'SP.pakHeader mevcut olmalı', 'Cihaz online olmalı'],
    postEffects: [
      'payload.invoiceDetailModel Invoice UI’a yansır',
      'Başarılı retry sonrası fiscal detay tekrar gösterilir',
    ],
    chain: [
      { layer: 'action', label: 'Retry Fiscal', detail: 'shipmentTracking/InvoiceFragment.kt:186' },
      { layer: 'viewmodel', label: 'SharedViewModel.retryFiscalInvoice()', detail: ':2217' },
      { layer: 'repository', label: 'MainRepository.retryFiscalInvoice()' },
      { layer: 'api', label: 'POST Shipment/RetryFiscalInvoice' },
      { layer: 'response', label: 'RetryFiscalInvoiceResponseModel' },
      { layer: 'state', label: 'Invoice detail refreshed' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'shipmentTracking/InvoiceFragment.kt', method: 'retryFiscal() · :186-190' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'retryFiscalInvoice() · :2217' },
      { layer: 'Repository', file: 'main/MainRepository.kt', method: 'retryFiscalInvoice() · :216' },
      { layer: 'Provider', file: 'network/ApiProvider.kt', method: 'retryFiscalInvoice() · :226' },
      { layer: 'API', file: 'network/APIService.kt', method: 'retryFiscalInvoice() · :430' },
    ],
    requestFields: [
      { field: 'FiscalInvoiceId', type: 'String', required: 'yes', source: 'InvoiceFragment.firstInvoiceDetail.id', validation: 'Non-empty' },
      { field: 'PakHeader', type: 'String', required: 'yes', source: 'SP.pakHeader / fiscal country config' },
    ],
    responseMapping: [
      { field: 'payload.invoiceDetailModel', destination: 'InvoiceFragment', action: 'Güncel fiscal invoice detayını gösterir' },
      { field: 'resultCode / resultMessage', destination: 'Resource', action: 'Başarı/hata UI state’ini belirler' },
    ],
    errors: [
      { status: 'Empty payload', backend: 'Response body boş', mobile: 'Exception → Resource.error("Unknown error")', user: 'Retry başarısız görünür' },
      { status: '4xx/business', backend: 'Fiscal retry reddedildi', mobile: 'Resource.error', user: 'Invoice yenilenmez' },
      { status: 'Network/timeout', backend: 'Sonuç belirsiz olabilir', mobile: 'Resource.error', user: 'Tekrar deneme gerekir; duplicate fiscal kontrol edilmeli' },
    ],
    tests: [
      { name: 'Retry returns invoice detail', status: 'partial', env: 'Manual' },
      { name: 'Empty payload handling', status: 'missing' },
      { name: 'Timeout/idempotency reconciliation', status: 'missing' },
    ],
  },
  {
    id: 'refundFiscalInvoice',
    screen: 'fiscal-invoice',
    action: 'Refund Fiscal',
    trigger: 'Fiscal refund aksiyonu',
    method: 'POST',
    path: 'Shipment/RefundFiscalInvoice',
    domain: 'fiscal',
    requestModel: 'RefundFiscalizationReq',
    responseModel: 'RefundFiscalizationResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Fiscal faturayı iade/refund eder.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Fiscal UI: İade sonucu gösterilir',
    ],
    chain: [
      { layer: 'action', label: 'Refund Fiscal', detail: 'fiscal-invoice' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → refundFiscalInvoice()' },
      { layer: 'repository', label: 'MainRepository.refundFiscalInvoice()' },
      { layer: 'api', label: 'POST Shipment/RefundFiscalInvoice' },
      { layer: 'response', label: '200 RefundFiscalizationResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'refundFiscalInvoice' },
      { layer: 'API', file: 'network/APIService.kt', method: 'refundFiscalInvoice()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'refundFiscalInvoice()' },
    ],
    requestFields: [
      { field: 'shipmentId', type: 'String?', required: 'no', source: 'currentTask.shipmentId' },
      { field: 'invoiceNumber', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'PakHeader', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'ShipmentIds', type: 'List<String>?', required: 'no', source: 'UI selection / scan list' },
    ],
    responseMapping: [
      { field: 'payload', destination: 'Fiscal UI', action: 'İade sonucu gösterilir' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'getFiscalInvoice',
    screen: 'fiscal-invoice',
    action: 'Open Fiscal Detail',
    trigger: 'Fiscal detail open',
    method: 'POST',
    path: 'Shipment/GetFiscalInvoiceDetail',
    domain: 'fiscal',
    requestModel: 'FiscalizationReq',
    responseModel: 'GetInvoiceDetailResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Fiscal fatura detayını getirir (status/transactionType ile).',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Invoice detail UI: Fatura alanları dolar',
    ],
    chain: [
      { layer: 'action', label: 'Open Fiscal Detail', detail: 'fiscal-invoice' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → getFiscalInvoice()' },
      { layer: 'repository', label: 'MainRepository.getFiscalInvoice()' },
      { layer: 'api', label: 'POST Shipment/GetFiscalInvoiceDetail' },
      { layer: 'response', label: '200 GetInvoiceDetailResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'getFiscalInvoice' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getFiscalInvoice()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getFiscalInvoice()' },
    ],
    requestFields: [
      { field: 'ShipmentId', type: 'String', required: 'yes', source: 'currentTask.shipmentId' },
      { field: 'status', type: 'String', required: 'yes', source: 'UI selection' },
      { field: 'transactionType', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
    ],
    responseMapping: [
      { field: 'payload', destination: 'Invoice detail UI', action: 'Fatura alanları dolar' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'updateFiscalInvoice',
    screen: 'fiscal-invoice',
    action: 'Update Fiscal',
    trigger: 'Fiscal edit → Save',
    method: 'POST',
    path: 'Shipment/UpdateFiscalInvoice',
    domain: 'fiscal',
    requestModel: 'UpdateInvoiceRequest',
    responseModel: 'UpdateInvoiceResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Fiscal fatura alanlarını günceller.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Invoice UI: Güncel fatura yansır',
    ],
    chain: [
      { layer: 'action', label: 'Update Fiscal', detail: 'fiscal-invoice' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → updateFiscalInvoice()' },
      { layer: 'repository', label: 'MainRepository.updateFiscalInvoice()' },
      { layer: 'api', label: 'POST Shipment/UpdateFiscalInvoice' },
      { layer: 'response', label: '200 UpdateInvoiceResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'updateFiscalInvoice' },
      { layer: 'API', file: 'network/APIService.kt', method: 'updateFiscalInvoice()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'updateFiscalInvoice()' },
    ],
    requestFields: [
      { field: 'FiscalIdentityNumber', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'ShipmentId', type: 'String?', required: 'no', source: 'currentTask.shipmentId' },
      { field: 'ShipmentIds', type: 'List<String>?', required: 'no', source: 'UI selection / scan list' },
      { field: 'InvoiceNumber', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'PakHeader', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
    ],
    responseMapping: [
      { field: 'payload', destination: 'Invoice UI', action: 'Güncel fatura yansır' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
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
    owner: 'Mobile Core · Backend Delivery',
    summary:
      'Teslim edilemedi kaydını gönderir. Delivery ile aynı kuyruk disiplinine tabidir: 120 sn bekleme, 3 retry, dead-letter arşivi.',
    preconditions: [
      'Aktif schedule/stop/task mevcut olmalı',
      'Failure reason ve etkilenen waybill/barcode listesi seçilmiş olmalı',
      'Foto zorunlu reason ise upload sonucu hazır olmalı',
    ],
    postEffects: [
      'Task ve shipment item’lar lokal schedule’da failed state’e geçirilir',
      'Başarılı gönderim CompletedRequest’e arşivlenir',
      '120 sn içinde undo edilirse lokal orijinal item state’i geri yüklenir',
    ],
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
    requestFields: [
      { field: 'ScheduleId', type: 'String', required: 'yes', source: 'Aktif Schedule.scheduleId / SP.scheduleId' },
      { field: 'StopId', type: 'String', required: 'yes', source: 'current stop' },
      { field: 'TaskId', type: 'String', required: 'yes', source: 'currentTask.taskId' },
      { field: 'WaybillNumbers', type: 'List<String>', required: 'yes', source: 'Task shipment listesi', validation: 'Non-empty' },
      { field: 'ShipmentStatus', type: 'Int', required: 'yes', source: 'Seçilen failure reason/status' },
      { field: 'DeliveryFailurePhotoUrl', type: 'String?', required: 'conditional', source: 'Camera/SaveImageFile sonucu', sensitive: true },
      { field: 'ScanDateTime / TimeStamp', type: 'String', required: 'yes', source: 'Cihaz saati' },
      { field: 'BarcodeModel', type: 'List<BarcodeModel>', required: 'yes', source: 'Shipment waybill/barcode eşlemeleri' },
      { field: 'Latitude / Longitude', type: 'Double', required: 'yes', source: 'Cihaz GPS', sensitive: true },
      { field: 'EventLocation', type: 'EventLocation', required: 'yes', source: 'Konum/event metadata' },
      { field: 'NextPlannedDeliveryDate', type: 'String?', required: 'conditional', source: 'Come-again tarih seçimi' },
      { field: 'CourierZoneCode', type: 'String', required: 'yes', source: 'SP.route / aktif courier zone' },
    ],
    responseMapping: [
      { field: 'resultCode', destination: 'RequestSenderService', action: 'Başarıda Request → CompletedRequest; hatada retry/dead-letter' },
      { field: 'resultMessage', destination: 'Request.requestTrace', action: 'Hata tanılama bilgisini saklar' },
    ],
    errors: [
      { status: 'Malformed JSON', backend: 'Çağrı yapılmaz', mobile: 'Request hata ile arşivlenir', user: 'Failed işlemi gönderilmez' },
      { status: '4xx/business', backend: 'Status/reason validation', mobile: 'tryCount artırılır', user: 'Retry/uyarı' },
      { status: 'Network/timeout', backend: 'Sonuç belirsiz olabilir', mobile: 'Kuyrukta kalır; network hatası tryCount tüketmez', user: 'Bağlantıda otomatik tekrar' },
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
    owner: 'Mobile Core · Backend Pickup',
    summary:
      'Pickup parselini araca alır. Kuyruk case’inde processedBarcodes ile dedup yapılır; backend “Pickup has already been made” dönerse istek silinip ArasDialog gösterilir.',
    preconditions: [
      'Pickup barcode listesi doğrulanmış olmalı',
      'Courier zone mevcut olmalı',
      'RequestSenderService çalışıyor olmalı',
    ],
    postEffects: [
      'Pickup shipment item lokal schedule’da picked-up state’e geçer',
      'Başarılı request CompletedRequest arşivine taşınır',
      'Duplicate pickup business mesajında request silinir ve dialog gösterilir',
    ],
    chain: [
      { layer: 'action', label: 'Complete Pickup', detail: 'PickUpFragment' },
      { layer: 'viewmodel', label: 'saveRequest(LOAD_PICKUP_PARCEL_TO_COURIER_VEHICLE)' },
      { layer: 'queue', label: 'RequestSenderService case', detail: ':305 — processedBarcodes dedup' },
      { layer: 'repository', label: 'MainRepository.loadPickupParcelToCourierVehicle()' },
      { layer: 'api', label: 'POST Task/PickupParcelToCourierVehicle/' },
      { layer: 'response', label: '“Already been made” özel hatası → istek silinir + dialog' },
      { layer: 'db', label: 'CompletedRequest arşivi' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'task_list/TaskListFragment.kt', method: 'saveRequest(LOAD_PICKUP...) · :1201 / :3272' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'saveRequest() / loadPickupParcelToCourierVehicle() · :405' },
      { layer: 'Queue', file: 'services/RequestSenderService.kt', method: 'LOAD_PICKUP_PARCEL_TO_COURIER_VEHICLE · :305' },
      { layer: 'Repository', file: 'main/MainRepository.kt', method: 'loadPickupParcelToCourierVehicle()' },
      { layer: 'Provider', file: 'network/ApiProvider.kt', method: 'loadPickupParcelToCourierVehicle() · :155' },
      { layer: 'API', file: 'network/APIService.kt', method: 'loadPickupParcelToCourierVehicle() · :147' },
    ],
    requestFields: [
      { field: 'courierZoneCode', type: 'String', required: 'yes', source: 'SP.route / aktif courier zone' },
      { field: 'barcodeList', type: 'List<String>', required: 'yes', source: 'Pickup barcode taramaları', validation: 'Non-empty; processedBarcodes ile dedup' },
      { field: 'CollectionType', type: 'CollectionType?', required: 'conditional', source: 'Pickup tahsilat sonucu' },
      { field: 'scanDateTime', type: 'String?', required: 'no', source: 'Cihaz saati' },
      { field: 'saveCollectedShipmentListToCashDeskRequest', type: 'SaveCollectedShipmentListToCashDeskRequest?', required: 'conditional', source: 'Cash/COD pickup akışı' },
      { field: 'IsSwitchToExworks', type: 'Boolean?', required: 'no', source: 'Exworks ödeme seçimi' },
      { field: 'shipmentId', type: 'String?', required: 'conditional', source: 'currentTask shipment veya labelless shipment id' },
    ],
    responseMapping: [
      { field: 'resultCode', destination: 'RequestSenderService', action: 'Başarıda request’i arşivler ve pickup state’i korur' },
      { field: 'resultMessage', destination: 'Duplicate pickup guard', action: '“Pickup has already been made” ise request silinir ve ArasDialog açılır' },
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
    trigger: 'Force pickup / ödeme dönüşümü sırasında pickup shipment detayları kuyruğa alınırken',
    method: 'POST',
    path: 'Task/GetPickupShipmentDetails/',
    domain: 'pickup',
    requestModel: 'GetPickupShipmentDetailsRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: true,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core · Backend Pickup',
    summary: 'Pickup detayı — kuyruk üzerinden (case :498); HTTP 405 özel olarak ele alınır.',
    preconditions: [
      'Courier zone, waybill ve en az bir barcode mevcut olmalı',
      'RequestSenderService çalışıyor olmalı',
    ],
    postEffects: [
      'Başarılı cevap queue request’ini tamamlar',
      '405 durumunda forceLoadedBarcodeList temizlenir ve load error dialog gösterilir',
      'Force pickup lokal schedule state’i korunur',
    ],
    chain: [
      { layer: 'action', label: 'Force Pickup Detail', detail: 'task_list/TaskListFragment.kt:4320-4335' },
      { layer: 'viewmodel', label: 'SharedViewModel.saveRequest(GET_PICKUP_SHIPMENT_DETAILS)' },
      { layer: 'queue', label: 'Room Request queue' },
      { layer: 'queue', label: 'RequestSenderService dispatch', detail: ':498-538' },
      { layer: 'repository', label: 'MainRepository.getPickupShipmentDetails()' },
      { layer: 'api', label: 'POST Task/GetPickupShipmentDetails/' },
      { layer: 'response', label: 'BaseResponse / HTTP 405 special case' },
      { layer: 'state', label: 'Force pickup state veya load error dialog' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'task_list/TaskListFragment.kt', method: 'force pickup request · :4320-4335' },
      { layer: 'Queue', file: 'services/RequestSenderService.kt', method: 'GET_PICKUP_SHIPMENT_DETAILS · :498' },
      { layer: 'Repository', file: 'main/MainRepository.kt', method: 'getPickupShipmentDetails() · :119' },
      { layer: 'Provider', file: 'network/ApiProvider.kt', method: 'getPickupShipmentDetails() · :122' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getPickupShipmentDetails() · :150' },
    ],
    requestFields: [
      { field: 'courierZoneCode', type: 'String', required: 'yes', source: 'SharedPreferences.route' },
      { field: 'barcodeList', type: 'List<String>', required: 'yes', source: 'Force-loaded pickup barcode listesi', validation: 'Non-empty' },
      { field: 'waybillNumber', type: 'String', required: 'yes', source: 'Aktif shipment waybill' },
      { field: 'saveCollectedShipmentListToCashDeskRequest', type: 'SaveCollectedShipmentListToCashDeskRequest?', required: 'conditional', source: 'Cash/COD pickup akışı' },
      { field: 'collections', type: 'List<Collection>?', required: 'conditional', source: 'Shipment collections mapping' },
      { field: 'itemShipmentId', type: 'String?', required: 'conditional', source: 'shipmentId veya internalShipmentId' },
      { field: 'IsSwitchToExworks', type: 'Boolean?', required: 'no', source: 'CPP → Exworks dönüşüm seçimi' },
    ],
    responseMapping: [
      { field: 'resultCode', destination: 'RequestSenderService processApiCall', action: 'Başarıda request tamamlanır' },
      { field: 'HTTP 405 + resultMessage', destination: 'forceLoadedBarcodeList / dialog', action: 'Barcode listeden çıkarılır ve kullanıcıya load error gösterilir' },
    ],
    errors: [
      { status: '405', backend: 'Pickup detail/load iş kuralı reddi', mobile: 'forceLoadedBarcodeList temizliği + showLoadErrorDialog', user: 'Pickup yükleme hatası gösterilir' },
      { status: 'Malformed JSON', backend: 'Çağrı yapılmaz', mobile: 'Request arşivlenir', user: 'Pickup detayı gönderilmez' },
      { status: 'Network/exception', backend: 'Servis ulaşılamadı', mobile: 'Request processing state ve trace güncellenir', user: 'Kuyruk retry bekler' },
    ],
    tests: [
      { name: 'Force pickup detail happy path', status: 'partial', env: 'Manual' },
      { name: 'HTTP 405 removes force-loaded barcode', status: 'missing' },
      { name: 'Offline queue recovery', status: 'missing' },
    ],
  },
  {
    id: 'generatePickupTaskJob',
    screen: 'pickup',
    action: 'Generate Pickup Task',
    trigger: 'Generate pickup job',
    method: 'POST',
    path: 'Task/GeneratePickupTaskJobNew/',
    domain: 'pickup',
    requestModel: 'GeneratePickupTaskJobRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Courier zone için pickup task job üretir (GeneratePickupTaskJobNew).',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Pickup tasks: Yeni pickup görevleri schedule’a düşer',
    ],
    chain: [
      { layer: 'action', label: 'Generate Pickup Task', detail: 'pickup' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → generatePickupTaskJob()' },
      { layer: 'repository', label: 'MainRepository.generatePickupTaskJob()' },
      { layer: 'api', label: 'POST Task/GeneratePickupTaskJobNew/' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'API', file: 'network/APIService.kt', method: 'generatePickupTaskJob()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'generatePickupTaskJob()' },
    ],
    requestFields: [
      { field: 'CourierZoneCode', type: 'String', required: 'yes', source: 'SP.courierZone' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Pickup tasks', action: 'Yeni pickup görevleri schedule’a düşer' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
    notes: 'Orphan riski.',
  },
  {
    id: 'confirmPickup',
    screen: 'gray-label',
    action: 'Confirm Pickup (Red/Grey Label)',
    trigger: 'Confirm pickup',
    method: 'POST',
    path: 'Shipment/CreateRedGreyLabelShipmentWithoutDetails',
    domain: 'pickup',
    requestModel: 'ConfirmPickupRequest',
    responseModel: 'ConfirmPickupResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Detaysız red/grey label shipment oluşturarak pickup’ı confirm eder.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Pickup result: Yeni shipment/label bilgisi',
    ],
    chain: [
      { layer: 'action', label: 'Confirm Pickup (Red/Grey Label)', detail: 'grayLabel/GrayLabelCalculatorFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → confirmPickup()' },
      { layer: 'repository', label: 'MainRepository.confirmPickup()' },
      { layer: 'api', label: 'POST Shipment/CreateRedGreyLabelShipmentWithoutDetails' },
      { layer: 'response', label: '200 ConfirmPickupResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'pickup/', method: 'confirm' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'confirmPickup' },
      { layer: 'API', file: 'network/APIService.kt', method: 'confirmPickup()' },
    ],
    requestFields: [
      { field: 'username', type: 'String', required: 'yes', source: 'User input / SP.userName' },
      { field: 'channel', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'customerId', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'customerCenter', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'barcodes', type: 'List<String>', required: 'yes', source: 'Barcode scan list' },
      { field: 'eventTime', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'weight', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'codAmount', type: 'Double', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'calculatedCppdAmount', type: 'Double', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'courierZoneCode', type: 'String', required: 'yes', source: 'SP.courierZone' },
      { field: 'shipmentId', type: 'String', required: 'yes', source: 'currentTask.shipmentId' },
      { field: 'recipientMobile', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'recipient', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'pib', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'collectionType', type: 'Int', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'IsSwitchToExworks', type: 'Boolean?', required: 'no', source: 'Request model / ViewModel' },
    ],
    responseMapping: [
      { field: 'payload', destination: 'Pickup result', action: 'Yeni shipment/label bilgisi' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'pickupFailed',
    screen: 'pickup-failed',
    action: 'Mark Pickup Failed',
    trigger: 'Pickup Failed ekranında neden/barcode seçimi onaylandığında',
    method: 'POST',
    path: 'Task/PickupFailed/',
    domain: 'pickup',
    requestModel: 'PickupFailedRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: true,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core · Backend Pickup',
    summary: 'Pickup başarısız — kuyruk case’i RequestSenderService:540.',
    preconditions: [
      'Aktif schedule/stop/pickup task mevcut olmalı',
      'Failure status ve etkilenen barcode/waybill listeleri seçilmiş olmalı',
      'Cihaz konumu ve courier zone hazır olmalı',
    ],
    postEffects: [
      'Güncellenmiş schedule payload önce Room’a kaydedilir',
      'PickupFailedRequest Room Request kuyruğuna yazılır',
      'UI Stop List’e dönüp task listesini refresh eder',
      'Return-document pickup varsa ilişkili originalShipmentId waybill listesine eklenir',
    ],
    chain: [
      { layer: 'action', label: 'Mark Pickup Failed', detail: 'pickupFailed/PickupFailedFragment.kt' },
      { layer: 'ui', label: 'getPickupFailedRequest()', detail: 'Request + updated schedule payload oluşturulur' },
      { layer: 'db', label: 'saveSchedulePayloadToLocalDbSuspendBlocking()', detail: ':465-466' },
      { layer: 'viewmodel', label: 'saveRequest(PICK_UP_FAILED)', detail: ':468-473' },
      { layer: 'queue', label: 'Room Request queue' },
      { layer: 'queue', label: 'RequestSenderService PICK_UP_FAILED', detail: ':540-549' },
      { layer: 'repository', label: 'MainRepository.pickupFailed()' },
      { layer: 'api', label: 'POST Task/PickupFailed/' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Stop List refresh / CompletedRequest' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'pickupFailed/PickupFailedFragment.kt', method: 'pickupFailed() · :443-480' },
      { layer: 'UI', file: 'pickupFailed/PickupFailedFragment.kt', method: 'getPickupFailedRequest()' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'saveRequest(PICK_UP_FAILED)' },
      { layer: 'Queue', file: 'services/RequestSenderService.kt', method: 'PICK_UP_FAILED · :540' },
      { layer: 'Repository', file: 'main/MainRepository.kt', method: 'pickupFailed() · :128' },
      { layer: 'Provider', file: 'network/ApiProvider.kt', method: 'pickupFailed() · :131' },
      { layer: 'API', file: 'network/APIService.kt', method: 'pickupFailed() · :119' },
    ],
    requestFields: [
      { field: 'ScheduleId', type: 'String', required: 'yes', source: 'Aktif Schedule.scheduleId / SP.scheduleId' },
      { field: 'StopId', type: 'String', required: 'yes', source: 'current stop id' },
      { field: 'TaskId', type: 'String', required: 'yes', source: 'pickup task.taskId' },
      { field: 'WaybillNumbers', type: 'List<String>', required: 'yes', source: 'Seçili pickup shipment’ları + return-document originalShipmentId', validation: 'Non-empty' },
      { field: 'ShipmentStatus', type: 'Int', required: 'yes', source: 'Seçilen pickup failure reason/status' },
      { field: 'ScanDateTime', type: 'String?', required: 'no', source: 'Cihaz saati' },
      { field: 'Latitude / Longitude', type: 'Double', required: 'yes', source: 'SP.latestLatitude / latestLongitude', sensitive: true },
      { field: 'CourierZoneCode', type: 'String', required: 'yes', source: 'SP.route' },
      { field: 'BarcodeList', type: 'List<String>', required: 'yes', source: 'PickupFailed UI seçili barcode listesi', validation: 'Non-empty' },
      { field: 'DeliveryFailurePhotoUrl', type: 'String?', required: 'conditional', source: 'Camera/SaveImageFile sonucu', sensitive: true },
      { field: 'LegacySystemShortBarcodeList', type: 'List<String>', required: 'yes', source: 'Seçili legacy short barcode listesi' },
      { field: 'IsAutoPickupFail', type: 'Boolean', required: 'yes', source: 'Otomatik/manual failure akışı; varsayılan false' },
    ],
    responseMapping: [
      { field: 'resultCode', destination: 'RequestSenderService processApiCall', action: 'Başarıda Request → CompletedRequest; hatada retry/dead-letter' },
      { field: 'resultMessage', destination: 'Request.requestTrace', action: 'Backend hata detayını tanılama için saklar' },
    ],
    errors: [
      { status: 'Malformed JSON', backend: 'Çağrı yapılmaz', mobile: 'Request hata ile CompletedRequest’e arşivlenir', user: 'Pickup failure gönderilmez' },
      { status: '4xx/business', backend: 'Status/task validation', mobile: 'tryCount artırılır', user: 'Kuyruk retry/uyarı' },
      { status: 'Network/timeout', backend: 'Sonuç belirsiz olabilir', mobile: 'Kuyrukta kalır; network hatası retry hakkını tüketmez', user: 'Bağlantıda otomatik gönderim' },
    ],
    tests: [
      { name: 'Pickup failed happy path', status: 'partial', env: 'Manual' },
      { name: 'Return-document original shipment linkage', status: 'missing' },
      { name: 'Offline queue + process restart', status: 'missing' },
      { name: 'Photo-required failure reason', status: 'missing' },
    ],
    notes: 'Bazı CameraFragment akışları ignoreWaitingRequest=true kullanır; RDoc pickup’larda ilişkili request/undo davranışı ayrıca kontrol edilmelidir.',
  },
  // ═══ GRAY LABEL / PRICE ════════════════════════════════════════════════
  {
    id: 'getShipperCustomerByBarcode',
    screen: 'gray-label',
    action: 'Scan Shipper Barcode',
    trigger: 'Gray label barcode scan',
    method: 'POST',
    path: 'Shipment/GetShipperCustomerByBarcode',
    domain: 'shipment',
    requestModel: 'String',
    responseModel: 'ShipperCustomerResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Barkoddan shipper müşteri bilgisini çözer (gray label / no-data akışı).',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Gray label form: Müşteri alanları dolar',
    ],
    chain: [
      { layer: 'action', label: 'Scan Shipper Barcode', detail: 'grayLabel/GrayLabelCalculatorFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → getShipperCustomerByBarcode()' },
      { layer: 'repository', label: 'MainRepository.getShipperCustomerByBarcode()' },
      { layer: 'api', label: 'POST Shipment/GetShipperCustomerByBarcode' },
      { layer: 'response', label: '200 ShipperCustomerResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'grayLabel/GrayLabelCalculatorFragment.kt', method: 'scan' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'getShipperCustomerByBarcode' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getShipperCustomerByBarcode()' },
    ],
    requestFields: [
      { field: '(body)', type: 'String', required: 'yes', source: 'Barcode / waybill string', validation: 'Non-empty' },
    ],
    responseMapping: [
      { field: 'payload.customer', destination: 'Gray label form', action: 'Müşteri alanları dolar' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'getPriceCalculationRequestModel',
    screen: 'gray-label',
    action: 'Open Price Calculator',
    trigger: 'Price calculator open',
    method: 'POST',
    path: 'Shipment/GetPriceCalculationRequestModel',
    domain: 'payment',
    requestModel: 'GetPriceCalculationRequestModel',
    responseModel: 'GetPriceCalculationResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Fiyat hesaplama için request model şablonunu/backend modelini getirir.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Calculator form defaults: Servis/parcel alanları hazırlanır',
    ],
    chain: [
      { layer: 'action', label: 'Open Price Calculator', detail: 'grayLabel/GrayLabelCalculatorFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → getPriceCalculationRequestModel()' },
      { layer: 'repository', label: 'MainRepository.getPriceCalculationRequestModel()' },
      { layer: 'api', label: 'POST Shipment/GetPriceCalculationRequestModel' },
      { layer: 'response', label: '200 GetPriceCalculationResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'grayLabel/GrayLabelCalculatorFragment.kt', method: 'loadModel' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'getPriceCalculationRequestModel' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getPriceCalculationRequestModel()' },
    ],
    requestFields: [
      { field: 'customerCustomer', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'customerCustomerId', type: 'Int', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'customerName', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'customerCustomerCenter', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'customerIdentityNumber', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'customerContactPerson', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'customerPhone', type: 'String?', required: 'no', source: 'Task consignee / user input' },
      { field: 'customerGsm', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'customerEmail', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'codReturnBankAccount', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'codReturnBankCode', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'customerAddressType', type: 'Int', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'customerAddressTitle', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'customerAddressText', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'customerAddressCountry', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'customerAddressStreet', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'customerAddressCity', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'customerAddressZipCode', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'customerHouseNumber', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'customerDoorNumber', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'customerSaveAddress', type: 'Boolean', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'counterLocationShipperId', type: 'Int', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'customerSaveAddressBookIndex', type: 'Int', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'shipperCustomer', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
    ],
    responseMapping: [
      { field: 'payload', destination: 'Calculator form defaults', action: 'Servis/parcel alanları hazırlanır' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'calculatePrice',
    screen: 'gray-label',
    action: 'Calculate Price',
    trigger: 'Gray Label → Calculate',
    method: 'POST',
    path: 'Customer/CalculatePrice',
    domain: 'payment',
    requestModel: 'CalculatePriceRequest',
    responseModel: 'CalculatePriceResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Customer/CalculatePrice ile fiyat hesaplar (services + parcels).',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Price result UI: Hesaplanan tutar gösterilir',
    ],
    chain: [
      { layer: 'action', label: 'Calculate Price', detail: 'grayLabel/GrayLabelCalculatorFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → calculatePrice()' },
      { layer: 'repository', label: 'MainRepository.calculatePrice()' },
      { layer: 'api', label: 'POST Customer/CalculatePrice' },
      { layer: 'response', label: '200 CalculatePriceResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'grayLabel/GrayLabelCalculatorFragment.kt', method: 'calculatePrice()' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'calculatePrice()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'calculatePrice()' },
    ],
    requestFields: [
      { field: 'isGetResponse', type: 'Boolean', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'isRecalculate', type: 'Boolean', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'services', type: 'List<ServiceModel>', required: 'yes', source: 'UI selection / scan list' },
      { field: 'parcels', type: 'List<ParcelModel>', required: 'yes', source: 'UI selection / scan list' },
      { field: 'shipmentId', type: 'String', required: 'yes', source: 'currentTask.shipmentId' },
      { field: 'pricingUnit', type: 'Int', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'tariffType', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'customerCustomerId', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'shipperCustomerId', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'consigneeCustomerId', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'destinationCountry', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'destinationZipCode', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'hasBeenParcelShopBefore', type: 'Boolean', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'payerType', type: 'Int', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'parcelShopZipCode', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'collections', type: 'List<CollectionModel>', required: 'yes', source: 'UI selection / scan list' },
      { field: 'codAmount', type: 'Double?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'insuranceAmount', type: 'Double?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'hasBeenParcelTerminalBefore', type: 'Boolean', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'createdDate', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'billingOption', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'isCalculateByActualWeight', type: 'Boolean', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'shipmentStatus', type: 'Int', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'isInvoiceable', type: 'Boolean', required: 'yes', source: 'Request model / ViewModel' },
    ],
    responseMapping: [
      { field: 'payload.price', destination: 'Price result UI', action: 'Hesaplanan tutar gösterilir' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'saveNoDataScanLog',
    screen: 'gray-label',
    action: 'Save No-Data Scan',
    trigger: 'No-data scan',
    method: 'POST',
    path: 'Shipment/SaveNoDataScanLog',
    domain: 'shipment',
    requestModel: 'SaveNoDataScanLogRequest',
    responseModel: 'SaveNoDataScanLogResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'No-data barkod tarama logunu kaydeder.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Scan log: Log kaydı oluşur',
    ],
    chain: [
      { layer: 'action', label: 'Save No-Data Scan', detail: 'grayLabel/GrayLabelCalculatorFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → saveNoDataScanLog()' },
      { layer: 'repository', label: 'MainRepository.saveNoDataScanLog()' },
      { layer: 'api', label: 'POST Shipment/SaveNoDataScanLog' },
      { layer: 'response', label: '200 SaveNoDataScanLogResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'saveNoDataScanLog' },
      { layer: 'API', file: 'network/APIService.kt', method: 'saveNoDataScanLog()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'saveNoDataScanLog()' },
    ],
    requestFields: [
      { field: 'CustomerId', type: 'Int?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'Barcode', type: 'String?', required: 'no', source: 'Barcode scan' },
      { field: 'EventTime', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
    ],
    responseMapping: [
      { field: 'payload', destination: 'Scan log', action: 'Log kaydı oluşur' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  // ═══ PARCEL RELEASE ════════════════════════════════════════════════════
  {
    id: 'releaseParcel',
    screen: 'parcel-release',
    action: 'Release Parcel',
    trigger: 'Parcel release confirm',
    method: 'POST',
    path: 'Task/ReleaseParcel/',
    domain: 'delivery',
    requestModel: 'ReleaseParcelRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: true,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Parcel release (teslim/serbest bırakma) işlemini gerçekleştirir.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
      'RequestSenderService çalışıyor (offline yazımlar için)',
    ],
    postEffects: [
      'Task/parcel state: Parcel released',
    ],
    chain: [
      { layer: 'action', label: 'Release Parcel', detail: 'parcel-release' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → releaseParcel()' },
      { layer: 'repository', label: 'MainRepository.releaseParcel()' },
      { layer: 'queue', label: 'Room Request queue', detail: 'RequestSenderService drain' },
      { layer: 'api', label: 'POST Task/ReleaseParcel/' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'parcelRelease/', method: 'release' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'releaseParcel' },
      { layer: 'API', file: 'network/APIService.kt', method: 'releaseParcel()' },
    ],
    requestFields: [
      { field: 'Barcode', type: 'String', required: 'yes', source: 'Barcode scan' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Task/parcel state', action: 'Parcel released' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Kuyrukta kalır / retry (max 3)', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'handOverParcelsToCounterLocation',
    screen: 'parcel-release',
    action: 'Hand Over to Counter',
    trigger: 'Hand over to counter',
    method: 'POST',
    path: 'Integration/ProcessHandOverParcelsToCounterLocation/',
    domain: 'delivery',
    requestModel: 'HandOverParcelsToCounterLocationRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: true,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Parcel’ları counter/locker lokasyonuna hand-over eder.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
      'RequestSenderService çalışıyor (offline yazımlar için)',
    ],
    postEffects: [
      'Task state: Counter hand-over tamamlanır',
    ],
    chain: [
      { layer: 'action', label: 'Hand Over to Counter', detail: 'parcel-release' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → handOverParcelsToCounterLocation()' },
      { layer: 'repository', label: 'MainRepository.handOverParcelsToCounterLocation()' },
      { layer: 'queue', label: 'Room Request queue', detail: 'RequestSenderService drain' },
      { layer: 'api', label: 'POST Integration/ProcessHandOverParcelsToCounterLocation/' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'handOverParcelsToCounterLocation' },
      { layer: 'API', file: 'network/APIService.kt', method: 'handOverParcelsToCounterLocation()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'handOverParcelsToCounterLocation()' },
    ],
    requestFields: [
      { field: 'ScheduleId', type: 'String', required: 'yes', source: 'SP.scheduleId / current Schedule' },
      { field: 'StopId', type: 'String', required: 'yes', source: 'currentStop.stopId' },
      { field: 'TaskId', type: 'String', required: 'yes', source: 'currentTask.taskId' },
      { field: 'WaybillNumberList', type: 'List<String>', required: 'yes', source: 'UI selection / scan list' },
      { field: 'BarcodeModel', type: 'List<HandOverBarcodeModel>', required: 'yes', source: 'Barcode scan / currentTask' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Task state', action: 'Counter hand-over tamamlanır' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Kuyrukta kalır / retry (max 3)', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'checkLastShipmentLocationIsCounter',
    screen: 'parcel-release',
    action: 'Check Counter Location',
    trigger: 'Hand-over / counter guard',
    method: 'POST',
    path: 'Integration/CheckLastShipmentLocationIsCounter/',
    domain: 'shipment',
    requestModel: 'String',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Shipment’ın son lokasyonunun counter olup olmadığını kontrol eder.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Guard decision: UI akışı izin/engelle',
    ],
    chain: [
      { layer: 'action', label: 'Check Counter Location', detail: 'parcel-release' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → checkLastShipmentLocationIsCounter()' },
      { layer: 'repository', label: 'MainRepository.checkLastShipmentLocationIsCounter()' },
      { layer: 'api', label: 'POST Integration/CheckLastShipmentLocationIsCounter/' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'checkLastShipmentLocationIsCounter' },
      { layer: 'API', file: 'network/APIService.kt', method: 'checkLastShipmentLocationIsCounter()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'checkLastShipmentLocationIsCounter()' },
    ],
    requestFields: [
      { field: '(body)', type: 'String', required: 'yes', source: 'Barcode / waybill string', validation: 'Non-empty' },
    ],
    responseMapping: [
      { field: 'payload/result', destination: 'Guard decision', action: 'UI akışı izin/engelle' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  // ═══ SHIPMENT TRACKING ═════════════════════════════════════════════════
  {
    id: 'getShipmentDetailByWaybillNumber',
    screen: 'shipment-tracking',
    action: 'Search Waybill',
    trigger: 'Waybill search',
    method: 'POST',
    path: 'Integration/GetShipmentDetailByWaybillNumber/',
    domain: 'shipment',
    requestModel: 'String',
    responseModel: 'ShipmentDetailResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Waybill numarasıyla shipment detayını Integration üzerinden çeker.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Shipment detail UI: Detay gösterilir',
    ],
    chain: [
      { layer: 'action', label: 'Search Waybill', detail: 'shipment-tracking' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → getShipmentDetailByWaybillNumber()' },
      { layer: 'repository', label: 'MainRepository.getShipmentDetailByWaybillNumber()' },
      { layer: 'api', label: 'POST Integration/GetShipmentDetailByWaybillNumber/' },
      { layer: 'response', label: '200 ShipmentDetailResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'getShipmentDetailByWaybillNumber' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getShipmentDetailByWaybillNumber()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getShipmentDetailByWaybillNumber()' },
    ],
    requestFields: [
      { field: '(body)', type: 'String', required: 'yes', source: 'Barcode / waybill string', validation: 'Non-empty' },
    ],
    responseMapping: [
      { field: 'payload', destination: 'Shipment detail UI', action: 'Detay gösterilir' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'getShipments',
    screen: 'shipment-tracking',
    action: 'Load Shipments',
    trigger: 'Multi-barcode lookup / hub companion',
    method: 'POST',
    path: 'Shipment/GetShipments/',
    domain: 'shipment',
    requestModel: 'List<String>',
    responseModel: 'ShipmentDetailsRes',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Barkod/ID listesiyle shipment detaylarını toplu çeker.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Shipment list UI: Detaylar listelenir',
    ],
    chain: [
      { layer: 'action', label: 'Load Shipments', detail: 'shipment-tracking' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → getShipments()' },
      { layer: 'repository', label: 'MainRepository.getShipments()' },
      { layer: 'api', label: 'POST Shipment/GetShipments/' },
      { layer: 'response', label: '200 ShipmentDetailsRes' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'getShipments' },
      { layer: 'Repository', file: 'main/MainRepository.kt', method: 'getShipments()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getShipments()' },
    ],
    requestFields: [
      { field: '[]', type: 'List<String>', required: 'yes', source: 'ViewModel list', validation: 'Non-empty list' },
    ],
    responseMapping: [
      { field: 'payload', destination: 'Shipment list UI', action: 'Detaylar listelenir' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'getShipmentsByFilter',
    screen: 'shipment-tracking',
    action: 'Filter Shipments',
    trigger: 'Hub Companion filter search',
    method: 'POST',
    path: 'Shipment/GetShipmentsByFilter/',
    domain: 'shipment',
    requestModel: 'List<FilterModel>',
    responseModel: 'ShipmentDetailsRes',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'FilterModel listesiyle shipment arar (hub companion filtreleri).',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Scan/search results: Eşleşen shipment’lar',
    ],
    chain: [
      { layer: 'action', label: 'Filter Shipments', detail: 'shipment-tracking' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → getShipmentsByFilter()' },
      { layer: 'repository', label: 'MainRepository.getShipmentsByFilter()' },
      { layer: 'api', label: 'POST Shipment/GetShipmentsByFilter/' },
      { layer: 'response', label: '200 ShipmentDetailsRes' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'ViewModel', file: 'hubcompanion/scanparcel/ScanParcelViewModel.kt', method: 'getShipmentsByFilter()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getShipmentsByFilter()' },
    ],
    requestFields: [
      { field: '[]value', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
    ],
    responseMapping: [
      { field: 'payload', destination: 'Scan/search results', action: 'Eşleşen shipment’lar' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'getShipmentHistory',
    screen: 'shipment-tracking',
    action: 'Open Movement History',
    trigger: 'Shipment history open',
    method: 'POST',
    path: 'Integration/GetShipmentHistory/',
    domain: 'shipment',
    requestModel: 'String',
    responseModel: 'ShipmentHistoryResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Integration üzerinden shipment history olaylarını getirir.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'History timeline UI: Olaylar listelenir',
    ],
    chain: [
      { layer: 'action', label: 'Open Movement History', detail: 'shipment-tracking' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → getShipmentHistory()' },
      { layer: 'repository', label: 'MainRepository.getShipmentHistory()' },
      { layer: 'api', label: 'POST Integration/GetShipmentHistory/' },
      { layer: 'response', label: '200 ShipmentHistoryResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'getShipmentHistory' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getShipmentHistory()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getShipmentHistory()' },
    ],
    requestFields: [
      { field: '(body)', type: 'String', required: 'yes', source: 'Barcode / waybill string', validation: 'Non-empty' },
    ],
    responseMapping: [
      { field: 'payload.events', destination: 'History timeline UI', action: 'Olaylar listelenir' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'searchShipment',
    screen: 'shipment-tracking',
    action: 'Search Shipment',
    trigger: 'Search shipment',
    method: 'POST',
    path: 'Shipment/SearchShipment',
    domain: 'shipment',
    requestModel: 'SearchShipmentRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Hub Companion SearchShipment ile shipment arar.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Search results: Sonuç listesi',
    ],
    chain: [
      { layer: 'action', label: 'Search Shipment', detail: 'shipment-tracking' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → searchShipment()' },
      { layer: 'repository', label: 'MainRepository.searchShipment()' },
      { layer: 'api', label: 'POST Shipment/SearchShipment' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'hubcompanion/', method: 'search' },
      { layer: 'ViewModel', file: 'hubcompanion/scanparcel/ScanParcelViewModel.kt', method: 'searchShipment' },
      { layer: 'API', file: 'network/APIService.kt', method: 'searchShipment()' },
    ],
    requestFields: [
      { field: 'barcodes', type: 'List<String>', required: 'yes', source: 'Barcode scan list' },
    ],
    responseMapping: [
      { field: 'payload', destination: 'Search results', action: 'Sonuç listesi' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'saveShipmentCallInformation',
    screen: 'shipment-tracking',
    action: 'Log Customer Call',
    trigger: 'Call log after phone call',
    method: 'POST',
    path: 'History/SaveShipmentCallInformation',
    domain: 'shipment',
    requestModel: 'SaveCallInformationRequestModel',
    responseModel: 'BaseResponse',
    auth: true,
    offline: true,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Müşteri arama logunu kaydeder; offline Request kuyruğu (SaveCallLogs) üzerinden gider.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
      'RequestSenderService çalışıyor (offline yazımlar için)',
    ],
    postEffects: [
      'Room Request: Call log sync edilir',
    ],
    chain: [
      { layer: 'action', label: 'Log Customer Call', detail: 'shipment-tracking' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → saveShipmentCallInformation()' },
      { layer: 'repository', label: 'MainRepository.saveShipmentCallInformation()' },
      { layer: 'queue', label: 'Room Request queue', detail: 'RequestSenderService drain' },
      { layer: 'api', label: 'POST History/SaveShipmentCallInformation' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'ViewModel', file: 'stop_list/StopViewModel.kt', method: 'enqueue call log' },
      { layer: 'Queue', file: 'services/RequestSenderService.kt', method: 'SAVE_CALL_LOGS' },
      { layer: 'API', file: 'network/APIService.kt', method: 'saveShipmentCallInformation()' },
    ],
    requestFields: [
      { field: 'ShipmentId', type: 'String', required: 'yes', source: 'currentTask.shipmentId' },
      { field: 'TrackingId', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'TaskId', type: 'String', required: 'yes', source: 'currentTask.taskId' },
      { field: 'HubId', type: 'String', required: 'yes', source: 'SP.hubId / GetUserHub' },
      { field: 'CourierFullName', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'ConsigneeFullName', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'ConsigneePhoneNumber', type: 'String', required: 'yes', source: 'Task consignee / user input' },
      { field: 'CallStatus', type: 'Int', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'CallDuration', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'CallStartTime', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'CallEndTime', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
    ],
    responseMapping: [
      { field: 'queued', destination: 'Room Request', action: 'Call log sync edilir' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Kuyrukta kalır / retry (max 3)', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
    notes: 'Kuyruk tipi SaveCallLogs.',
  },
  // ═══ DAMAGE / CASE / KTF ═══════════════════════════════════════════════
  {
    id: 'saveDamageCargo',
    screen: 'damage',
    action: 'Save Damage Record',
    trigger: 'Damage form submit',
    method: 'POST',
    path: 'Task/SaveDamageCargo',
    domain: 'shipment',
    requestModel: 'CargoDamageRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Hasarlı kargo bildirimini fotoğraf ve barkod listesiyle kaydeder.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Damage form: Kayıt tamam — form kapanır',
    ],
    chain: [
      { layer: 'action', label: 'Save Damage Record', detail: 'damage' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → saveDamageCargo()' },
      { layer: 'repository', label: 'MainRepository.saveDamageCargo()' },
      { layer: 'api', label: 'POST Task/SaveDamageCargo' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'others/damage/DamageFragment.kt', method: 'submit' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'sendCargoDamage' },
      { layer: 'API', file: 'network/APIService.kt', method: 'saveDamageCargo()' },
    ],
    requestFields: [
      { field: 'CargoBarcode', type: 'String', required: 'yes', source: 'Barcode scan' },
      { field: 'CourierName', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'DamageCargoPiece', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'DamageStatus', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'DriverName', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'ExistCargoPiece', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'ExistVolume', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'IsPackageDamaged', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'LovCargoDamageTypeId', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'LovServiceGroupTypeId', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'Picture', type: 'String', required: 'yes', source: 'Camera capture (base64)' },
      { field: 'PlateNumber', type: 'String', required: 'yes', source: 'User input / vehicle scan' },
      { field: 'CargoBarcodeList', type: 'ArrayList<BarcodeItem>', required: 'yes', source: 'Barcode scan / currentTask' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Damage form', action: 'Kayıt tamam — form kapanır' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'sendCaseDetection',
    screen: 'damage',
    action: 'Save Case Detection',
    trigger: 'Case detection submit',
    method: 'POST',
    path: 'Task/InsertSituationDetectionDocument',
    domain: 'shipment',
    requestModel: 'CaseDetectionRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Durum tespit (case detection) belgesi oluşturur; tazminat/talep bilgileriyle gönderilir.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Case form: Belge numarası/sonuç',
    ],
    chain: [
      { layer: 'action', label: 'Save Case Detection', detail: 'damage' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → sendCaseDetection()' },
      { layer: 'repository', label: 'MainRepository.sendCaseDetection()' },
      { layer: 'api', label: 'POST Task/InsertSituationDetectionDocument' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'others/caseDetection/CaseDetectionFragment.kt', method: 'submit' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'sendCaseDetection' },
      { layer: 'API', file: 'network/APIService.kt', method: 'sendCaseDetection()' },
    ],
    requestFields: [
      { field: 'CargoBarcodeList', type: 'ArrayList<BarcodeItem>', required: 'yes', source: 'Barcode scan / currentTask' },
      { field: 'DocumentNumber', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'Picture', type: 'String', required: 'yes', source: 'Camera capture (base64)' },
      { field: 'IndemnityRequest', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'IndemnityTypeId', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'MobilePhone', type: 'String', required: 'yes', source: 'Task consignee / user input' },
      { field: 'RequestPersonName', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'ServiceGroupTypeId', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'CustomerTypeId', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Case form', action: 'Belge numarası/sonuç' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'createEKTF',
    screen: 'ktf',
    action: 'Create E-KTF',
    trigger: 'Create KTF',
    method: 'POST',
    path: 'Task/EKTFCreate/',
    domain: 'shipment',
    requestModel: 'CreateEKTFReq',
    responseModel: 'KTFResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Seçilen debit/wave için e-KTF belgesi oluşturur.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'KTF result: Belge çıktısı',
    ],
    chain: [
      { layer: 'action', label: 'Create E-KTF', detail: 'ktf' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → createEKTF()' },
      { layer: 'repository', label: 'MainRepository.createEKTF()' },
      { layer: 'api', label: 'POST Task/EKTFCreate/' },
      { layer: 'response', label: '200 KTFResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'others/CreateKTFFragment.kt', method: 'create' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'createEKTF' },
      { layer: 'API', file: 'network/APIService.kt', method: 'createEKTF()' },
    ],
    requestFields: [
      { field: 'DebitNumber', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'RowCount', type: 'Int', required: 'yes', source: 'Request model / ViewModel' },
    ],
    responseMapping: [
      { field: 'payload', destination: 'KTF result', action: 'Belge çıktısı' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  // ═══ D4ME / LOCKER ═════════════════════════════════════════════════════
  {
    id: 'activeD4MCounterLocations',
    screen: 'd4me-locker',
    action: 'List D4M Counters',
    trigger: 'D4M location picker',
    method: 'POST',
    path: 'Shipment/ActiveD4MCounterLocations',
    domain: 'locker',
    requestModel: 'ActiveD4MCounterReq',
    responseModel: 'ActiveD4MCounterRes',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Konum + waybill ile aktif D4M counter lokasyonlarını listeler.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Counter picker: Lokasyon seçimi',
    ],
    chain: [
      { layer: 'action', label: 'List D4M Counters', detail: 'd4me-locker' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → activeD4MCounterLocations()' },
      { layer: 'repository', label: 'MainRepository.activeD4MCounterLocations()' },
      { layer: 'api', label: 'POST Shipment/ActiveD4MCounterLocations' },
      { layer: 'response', label: '200 ActiveD4MCounterRes' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'activeD4MCounterLocations' },
      { layer: 'API', file: 'network/APIService.kt', method: 'activeD4MCounterLocations()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'activeD4MCounterLocations()' },
    ],
    requestFields: [
      { field: 'latitude', type: 'Double', required: 'yes', source: 'GPS / SP.latestLatitute' },
      { field: 'longitude', type: 'Double', required: 'yes', source: 'GPS / SP.latestLongitude' },
      { field: 'waybillNumber', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
    ],
    responseMapping: [
      { field: 'payload.locations', destination: 'Counter picker', action: 'Lokasyon seçimi' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'activeLockerCounterLocations',
    screen: 'd4me-locker',
    action: 'List Locker Locations',
    trigger: 'Locker location list',
    method: 'POST',
    path: 'Shipment/ActiveLockerCounterLocations',
    domain: 'locker',
    requestModel: 'MakeLockerReservationRequestModel',
    responseModel: 'LockerCounterLocations',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Aktif locker counter lokasyonlarını listeler (MakeLockerReservationRequestModel overload). D4M sibling: ActiveLockerCounterReq.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Locker picker: Lokasyonlar listelenir',
    ],
    chain: [
      { layer: 'action', label: 'List Locker Locations', detail: 'd4me-locker' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → activeLockerCounterLocations()' },
      { layer: 'repository', label: 'MainRepository.activeLockerCounterLocations()' },
      { layer: 'api', label: 'POST Shipment/ActiveLockerCounterLocations' },
      { layer: 'response', label: '200 LockerCounterLocations' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'API', file: 'network/APIService.kt', method: 'activeLockerCounterLocations()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'activeLockerCounterLocations()' },
    ],
    requestFields: [
      { field: 'lockerStationId', type: 'Int?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'integrationCode', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'barcodes', type: 'List<String>?', required: 'no', source: 'Barcode scan list' },
      { field: 'channelType', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'countryCode', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'lockerProvider', type: 'Int?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'providerType', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'boxName', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'boxAddress', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'boxLatitude', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'boxLongitude', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'courierId', type: 'Int?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'recipientMsisdn', type: 'String?', required: 'no', source: 'Task consignee / user input' },
      { field: 'reservationFrom', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'reservationTo', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'postponedReservation', type: 'Boolean?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'shouldCreateDDSPEvent', type: 'Boolean?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'isFuptBoxFull', type: 'Boolean?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'isNesyShipment', type: 'Boolean?', required: 'no', source: 'Request model / ViewModel' },
    ],
    responseMapping: [
      { field: 'payload', destination: 'Locker picker', action: 'Lokasyonlar listelenir' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
    notes: 'UI daha çok D4M overload (activeLockerCounterLocationsD4M) kullanır.',
  },
  {
    id: 'createD4MReservation',
    screen: 'd4me-locker',
    action: 'Create D4M Reservation',
    trigger: 'Create D4M reservation',
    method: 'POST',
    path: 'Task/CreateD4MReservation',
    domain: 'locker',
    requestModel: 'createD4MReservationReq',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'D4M rezervasyonu oluşturur.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Task reservation state: Rezervasyon bağlanır',
    ],
    chain: [
      { layer: 'action', label: 'Create D4M Reservation', detail: 'd4me-locker' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → createD4MReservation()' },
      { layer: 'repository', label: 'MainRepository.createD4MReservation()' },
      { layer: 'api', label: 'POST Task/CreateD4MReservation' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'createD4MReservation' },
      { layer: 'API', file: 'network/APIService.kt', method: 'createD4MReservation()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'createD4MReservation()' },
    ],
    requestFields: [
      { field: 'legacySystemShortBarcode', type: 'String', required: 'yes', source: 'Barcode scan / currentTask' },
      { field: 'trackingNumber', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'companyId', type: 'Int', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'locationId', type: 'Int', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'deliveryContent', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'd4MRecipientInfo', type: 'd4MRecipientInfo', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'd4MReservationData', type: 'd4MReservationData', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'courierId', type: 'Int', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'boxName', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'boxAddress', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'boxLatitude', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'boxLongitude', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'channelType', type: 'Int', required: 'yes', source: 'Request model / ViewModel' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Task reservation state', action: 'Rezervasyon bağlanır' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'deleteD4MReservation',
    screen: 'd4me-locker',
    action: 'Delete D4M Reservation',
    trigger: 'Delete reservation',
    method: 'POST',
    path: 'Task/DeleteD4MReservation',
    domain: 'locker',
    requestModel: 'List<deleteD4MReservationReq>',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'D4M/LOS rezervasyonunu siler.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Task reservation state: Rezervasyon kaldırılır',
    ],
    chain: [
      { layer: 'action', label: 'Delete D4M Reservation', detail: 'd4me-locker' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → deleteD4MReservation()' },
      { layer: 'repository', label: 'MainRepository.deleteD4MReservation()' },
      { layer: 'api', label: 'POST Task/DeleteD4MReservation' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'task_list/TaskListFragment.kt', method: 'delete reservation' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'deleteD4MReservation' },
      { layer: 'API', file: 'network/APIService.kt', method: 'deleteD4MReservation()' },
    ],
    requestFields: [
      { field: '[]legacySystemShortBarcode', type: 'String', required: 'yes', source: 'Barcode scan / currentTask' },
      { field: '[]reservationId', type: 'Int', required: 'yes', source: 'Request model / ViewModel' },
      { field: '[]deliveryId', type: 'Int', required: 'yes', source: 'Request model / ViewModel' },
      { field: '[]d4MStatus', type: 'Int', required: 'yes', source: 'Request model / ViewModel' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Task reservation state', action: 'Rezervasyon kaldırılır' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'completeD4MShipments',
    screen: 'd4me-locker',
    action: 'Complete D4M Shipments',
    trigger: 'Complete D4M',
    method: 'POST',
    path: 'Task/CompleteD4MShipments',
    domain: 'locker',
    requestModel: 'CompleteD4MShipmentsReq',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'D4M shipment’larını complete eder.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Task state: D4M complete',
    ],
    chain: [
      { layer: 'action', label: 'Complete D4M Shipments', detail: 'd4me-locker' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → completeD4MShipments()' },
      { layer: 'repository', label: 'MainRepository.completeD4MShipments()' },
      { layer: 'api', label: 'POST Task/CompleteD4MShipments' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'completeD4MShipments' },
      { layer: 'API', file: 'network/APIService.kt', method: 'completeD4MShipments()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'completeD4MShipments()' },
    ],
    requestFields: [
      { field: 'legacySystemShortBarcode', type: 'String', required: 'yes', source: 'Barcode scan / currentTask' },
      { field: 'deliveryId', type: 'Int', required: 'yes', source: 'Request model / ViewModel' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Task state', action: 'D4M complete' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'makeLockerReservation',
    screen: 'd4me-locker',
    action: 'Make Locker Reservation',
    trigger: 'Make locker reservation',
    method: 'POST',
    path: 'Task/MakeLockerReservation',
    domain: 'locker',
    requestModel: 'MakeLockerReservationRequestModel',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Seçilen locker istasyonu için rezervasyon oluşturur (LOS/D4M).',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Task locker state: Rezervasyon aktif',
    ],
    chain: [
      { layer: 'action', label: 'Make Locker Reservation', detail: 'd4me-locker' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → makeLockerReservation()' },
      { layer: 'repository', label: 'MainRepository.makeLockerReservation()' },
      { layer: 'api', label: 'POST Task/MakeLockerReservation' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'stop_list/StopListFragment.kt', method: 'makeLockerReservation()' },
      { layer: 'UI', file: 'task_list/TaskListFragment.kt', method: 'makeLockerReservation()' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'makeLockerReservation()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'makeLockerReservation()' },
    ],
    requestFields: [
      { field: 'lockerStationId', type: 'Int?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'integrationCode', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'barcodes', type: 'List<String>?', required: 'no', source: 'Barcode scan list' },
      { field: 'channelType', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'countryCode', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'lockerProvider', type: 'Int?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'providerType', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'boxName', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'boxAddress', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'boxLatitude', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'boxLongitude', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'courierId', type: 'Int?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'recipientMsisdn', type: 'String?', required: 'no', source: 'Task consignee / user input' },
      { field: 'reservationFrom', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'reservationTo', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'postponedReservation', type: 'Boolean?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'shouldCreateDDSPEvent', type: 'Boolean?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'isFuptBoxFull', type: 'Boolean?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'isNesyShipment', type: 'Boolean?', required: 'no', source: 'Request model / ViewModel' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Task locker state', action: 'Rezervasyon aktif' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'cancelLockerReservation',
    screen: 'd4me-locker',
    action: 'Cancel Locker Reservation',
    trigger: 'Cancel locker reservation',
    method: 'POST',
    path: 'Task/CancelLockerReservation',
    domain: 'locker',
    requestModel: 'CancelLockerReservationRequestModel',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Mevcut locker rezervasyonunu iptal eder.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Task locker state: Rezervasyon iptal',
    ],
    chain: [
      { layer: 'action', label: 'Cancel Locker Reservation', detail: 'd4me-locker' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → cancelLockerReservation()' },
      { layer: 'repository', label: 'MainRepository.cancelLockerReservation()' },
      { layer: 'api', label: 'POST Task/CancelLockerReservation' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'task_list/TaskListFragment.kt', method: 'cancelLockerReservation()' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'cancelLockerReservation()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'cancelLockerReservation()' },
    ],
    requestFields: [
      { field: 'lockerProvider', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'lockerStationId', type: 'Int', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'integrationCode', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'status', type: 'Int?', required: 'no', source: 'UI selection' },
      { field: 'taskType', type: 'Int?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'deliveryId', type: 'Int?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'reservationId', type: 'Int?', required: 'no', source: 'Request model / ViewModel' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Task locker state', action: 'Rezervasyon iptal' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'manuelLockerCompleteReservation',
    screen: 'd4me-locker',
    action: 'Complete Locker (Manual)',
    trigger: 'Manuel locker complete',
    method: 'POST',
    path: 'Task/ManuelLockerCompleteReservation',
    domain: 'locker',
    requestModel: 'ManuelLockerCompleteReservationRequestModel',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Locker rezervasyonunu manuel tamamlar.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Task locker state: Rezervasyon completed',
    ],
    chain: [
      { layer: 'action', label: 'Complete Locker (Manual)', detail: 'd4me-locker' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → manuelLockerCompleteReservation()' },
      { layer: 'repository', label: 'MainRepository.manuelLockerCompleteReservation()' },
      { layer: 'api', label: 'POST Task/ManuelLockerCompleteReservation' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'task_list/TaskListFragment.kt', method: 'manuel complete' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'manuelLockerCompleteReservation' },
      { layer: 'API', file: 'network/APIService.kt', method: 'manuelLockerCompleteReservation()' },
    ],
    requestFields: [
      { field: 'username', type: 'String?', required: 'no', source: 'User input / SP.userName' },
      { field: 'lockerStationId', type: 'Int', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'integrationCode', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Task locker state', action: 'Rezervasyon completed' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  // ═══ MAP / GEOCODE / TRACKING ══════════════════════════════════════════
  {
    id: 'updateDeliveryAddress',
    screen: 'map',
    action: 'Update Address Geocode',
    trigger: 'Update delivery address',
    method: 'POST',
    path: 'Geocode/UpdateAddressGeocode/',
    domain: 'tracking',
    requestModel: 'UpdateAddressReq',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Teslimat adresini ve geocode bilgisini günceller (re-geocode dahil).',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Task address fields: Adres UI yenilenir',
    ],
    chain: [
      { layer: 'action', label: 'Update Address Geocode', detail: 'map' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → updateDeliveryAddress()' },
      { layer: 'repository', label: 'MainRepository.updateDeliveryAddress()' },
      { layer: 'api', label: 'POST Geocode/UpdateAddressGeocode/' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'task_list/TaskListFragment.kt', method: 'update address' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'updateDeliveryAddress' },
      { layer: 'API', file: 'network/APIService.kt', method: 'updateDeliveryAddress()' },
    ],
    requestFields: [
      { field: 'AddressText', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'AddressType', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'Country', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'EntityType', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'Id', type: 'String', required: 'yes', source: 'Current schedule/entity id' },
      { field: 'IsReGeocode', type: 'Boolean', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'Latitude', type: 'Int', required: 'yes', source: 'GPS' },
      { field: 'Longitude', type: 'Int', required: 'yes', source: 'GPS' },
      { field: 'TaskType', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'ZipCode', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'City', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'Street', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Task address fields', action: 'Adres UI yenilenir' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'getAllHubs',
    screen: 'map',
    action: 'Load Hubs',
    trigger: 'Hub/route selection',
    method: 'POST',
    path: 'Geocode/GetAllHubs/',
    domain: 'tracking',
    requestModel: 'String',
    responseModel: 'GetAllHubsResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Tüm hub listesini getirir; rota seçimi / schedule kurulumunda kullanılır. Body: WithoutPolygonList=true.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Hub picker: Hub listesi',
    ],
    chain: [
      { layer: 'action', label: 'Load Hubs', detail: 'map' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → getAllHubs()' },
      { layer: 'repository', label: 'MainRepository.getAllHubs()' },
      { layer: 'api', label: 'POST Geocode/GetAllHubs/' },
      { layer: 'response', label: '200 GetAllHubsResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'stop_list/StopListFragment.kt', method: 'getAllHubs' },
      { layer: 'ViewModel', file: 'stop_list/StopViewModel.kt', method: 'getAllHubs' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getAllHubs()' },
    ],
    requestFields: [
      { field: 'WithoutPolygonList', type: 'Boolean', required: 'yes', source: 'Static true (StopViewModel)', validation: 'true' },
    ],
    responseMapping: [
      { field: 'payload[]', destination: 'Hub picker', action: 'Hub listesi' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'getUserHub',
    screen: 'map',
    action: 'Load User Hub',
    trigger: 'Login sonrası / Stop List / Hub Companion',
    method: 'POST',
    path: 'Geocode/GetUserHub/',
    domain: 'tracking',
    requestModel: 'String',
    responseModel: 'GetUserHubResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Giriş yapan kullanıcının hub bilgisini getirir; login, stop list ve hub companion akışlarında kullanılır.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'SP / hub context: Aktif hub set edilir',
    ],
    chain: [
      { layer: 'action', label: 'Load User Hub', detail: 'map' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → getUserHub()' },
      { layer: 'repository', label: 'MainRepository.getUserHub()' },
      { layer: 'api', label: 'POST Geocode/GetUserHub/' },
      { layer: 'response', label: '200 GetUserHubResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'login/LoginFragment.kt', method: 'getUserHub' },
      { layer: 'ViewModel', file: 'stop_list/StopViewModel.kt', method: 'getUserHub' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'getUserHub' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getUserHub()' },
    ],
    requestFields: [
      { field: '(body)', type: 'String', required: 'conditional', source: 'JSON string body — genelde "{}" veya serialized model', validation: 'JSON' },
    ],
    responseMapping: [
      { field: 'payload', destination: 'SP / hub context', action: 'Aktif hub set edilir' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'isRouteAutoDeps',
    screen: 'map',
    action: 'Check Auto-Deps Route',
    trigger: 'Route selection validation',
    method: 'POST',
    path: 'Geocode/IsRouteAutoDeps/',
    domain: 'tracking',
    requestModel: 'AutoDepsReq',
    responseModel: 'AutoDepsResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Verilen rota numarasının AutoDeps (otomatik dağıtım) rotası olup olmadığını kontrol eder.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Route flags: AutoDeps UI davranışı',
    ],
    chain: [
      { layer: 'action', label: 'Check Auto-Deps Route', detail: 'map' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → isRouteAutoDeps()' },
      { layer: 'repository', label: 'MainRepository.isRouteAutoDeps()' },
      { layer: 'api', label: 'POST Geocode/IsRouteAutoDeps/' },
      { layer: 'response', label: '200 AutoDepsResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'ViewModel', file: 'stop_list/StopViewModel.kt', method: 'isRouteAutoDeps' },
      { layer: 'API', file: 'network/APIService.kt', method: 'isRouteAutoDeps()' },
    ],
    requestFields: [
      { field: 'RouteNumber', type: 'String', required: 'yes', source: 'Selected route' },
    ],
    responseMapping: [
      { field: 'payload.isAutoDeps', destination: 'Route flags', action: 'AutoDeps UI davranışı' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
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
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core · Tracking',
    summary:
      'Kurye konumu — LiveLocation Room tablosunda birikir, kuyruk döngüsünde batch gönderilir. SaveScheduleDistance_Callback ile birlikte çalışır.',
    preconditions: [
      'RequestSenderService ve LiveLocation DAO hazır olmalı',
      'Room’da en az 10 LiveLocation kaydı birikmiş olmalı',
      'Android device id erişilebilir olmalı',
    ],
    postEffects: [
      'Son iki LiveLocation noktası backend’e RoutePoints olarak gönderilir',
      'LiveLocation tablosu gönderim çağrısından hemen sonra temizlenir',
      'BaseResponse sonucu location sync Resource state’ine çevrilir',
    ],
    chain: [
      { layer: 'queue', label: 'RequestSenderService location loop', detail: 'sendLocationRequestsToServer() · :905' },
      { layer: 'db', label: 'LiveLocationDao.getAll()', detail: '>=10 kayıtta takeLast(2)' },
      { layer: 'ui', label: 'SaveCourierLocationRequest oluşturulur', detail: ':957-967' },
      { layer: 'repository', label: 'MainRepository.saveCourierLocation()' },
      { layer: 'api', label: 'POST Tracking/SaveCourierLocation/' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'db', label: 'LiveLocationDao.deleteAll()', detail: 'Çağrı başlatıldıktan sonra' },
    ],
    codeRefs: [
      { layer: 'Service', file: 'services/RequestSenderService.kt', method: 'sendLocationRequestsToServer() · :905' },
      { layer: 'Service', file: 'services/RequestSenderService.kt', method: 'saveCourierLocation() · :957' },
      { layer: 'Repository', file: 'main/MainRepository.kt', method: 'saveCourierLocation() · :124' },
      { layer: 'Provider', file: 'network/ApiProvider.kt', method: 'saveCourierLocation() · :127' },
      { layer: 'API', file: 'network/APIService.kt', method: 'saveCourierLocation() · :194' },
      { layer: 'DB', file: 'database/LiveLocationDao.kt', method: 'getAll() / deleteAll()' },
    ],
    requestFields: [
      { field: 'DeviceId', type: 'String', required: 'yes', source: 'Settings.Secure.ANDROID_ID', sensitive: true },
      { field: 'LogTimeStamp', type: 'String', required: 'yes', source: 'getDateTime() cihaz saati' },
      { field: 'RoutePoints[].TimeStamp', type: 'String', required: 'yes', source: 'LiveLocation.timeStamp' },
      { field: 'RoutePoints[].Latitude', type: 'Double', required: 'yes', source: 'LiveLocation.lat', sensitive: true },
      { field: 'RoutePoints[].Longitude', type: 'Double', required: 'yes', source: 'LiveLocation.lon', sensitive: true },
    ],
    responseMapping: [
      { field: 'resultCode', destination: 'processSaveCourierLocationResponse()', action: 'SUCCESS → Resource.success; diğerleri → Resource.error' },
      { field: 'resultMessage', destination: 'Resource message/data', action: 'Location sync sonucunu taşır' },
    ],
    errors: [
      { status: 'Business error', backend: 'ResultCode != SUCCESS', mobile: 'Resource.error', user: 'Arka planda görünmez; konum batch’i silinmiş olabilir' },
      { status: 'Network/exception', backend: 'Servis ulaşılamadı', mobile: 'Resource.error(request model)', user: 'Arka planda görünmez; LiveLocation deleteAll nedeniyle veri kaybı riski' },
      { status: 'Insufficient batch', backend: 'Çağrı yapılmaz', mobile: '<10 kayıtta Room’da birikmeye devam eder', user: 'Etkisiz' },
    ],
    tests: [
      { name: '10 locations sends last two points', status: 'missing' },
      { name: 'Network failure must retain LiveLocation rows', status: 'missing' },
      { name: 'Device id and coordinate masking in diagnostics', status: 'missing' },
    ],
    notes: 'LiveLocationDao.deleteAll() response doğrulanmadan çalışıyor; network hatasında konum noktalarının kaybolma riski vardır.',
  },
  {
    id: 'saveScheduleDistance',
    screen: 'map',
    action: 'Background Distance Sync',
    trigger: 'Periodic location loop (Approved schedule)',
    method: 'POST',
    path: 'Task/SaveScheduleDistance_Callback/',
    domain: 'tracking',
    requestModel: 'SaveScheduleDistanceRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: true,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Onaylı schedule için biriken gerçek mesafeyi arka planda sunucuya gönderir. RequestSenderService location loop’tan direkt çağrılır (Request DAO değil).',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
      'RequestSenderService çalışıyor (offline yazımlar için)',
    ],
    postEffects: [
      'Distance sync: Backend mesafe güncellenir',
    ],
    chain: [
      { layer: 'action', label: 'Background Distance Sync', detail: 'map' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → saveScheduleDistance()' },
      { layer: 'repository', label: 'MainRepository.saveScheduleDistance()' },
      { layer: 'queue', label: 'Room Request queue', detail: 'RequestSenderService drain' },
      { layer: 'api', label: 'POST Task/SaveScheduleDistance_Callback/' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'Service', file: 'services/RequestSenderService.kt', method: 'saveTotalDistance' },
      { layer: 'API', file: 'network/APIService.kt', method: 'saveScheduleDistance()' },
    ],
    requestFields: [
      { field: 'ScheduleId', type: 'String', required: 'yes', source: 'SP.scheduleId / current Schedule' },
      { field: 'TotalDistance', type: 'Float', required: 'yes', source: 'LocationService accumulated' },
      { field: 'DistanceType', type: 'Int', required: 'yes', source: 'Fixed enum' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Distance sync', action: 'Backend mesafe güncellenir' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Kuyrukta kalır / retry (max 3)', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'saveCourierDeviceInfo',
    screen: 'map',
    action: 'Device Telemetry',
    trigger: 'LocationService periodic device info',
    method: 'POST',
    path: 'Tracking/SaveCourierDeviceInfo/',
    domain: 'tracking',
    requestModel: 'SaveCourierDeviceInfoRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Cihaz kimliği, model, şarj ve app versiyonunu Tracking’e kaydeder.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Telemetry: Cihaz telemetrisi',
    ],
    chain: [
      { layer: 'action', label: 'Device Telemetry', detail: 'map' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → saveCourierDeviceInfo()' },
      { layer: 'repository', label: 'MainRepository.saveCourierDeviceInfo()' },
      { layer: 'api', label: 'POST Tracking/SaveCourierDeviceInfo/' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'Service', file: 'services/LocationService.kt', method: 'device info' },
      { layer: 'API', file: 'network/APIService.kt', method: 'saveCourierDeviceInfo()' },
    ],
    requestFields: [
      { field: 'DeviceId', type: 'String', required: 'yes', source: 'Settings.Secure.ANDROID_ID', sensitive: true },
      { field: 'DeviceModelName', type: 'String', required: 'yes', source: 'Build.MODEL' },
      { field: 'DeviceChargeStatus', type: 'String', required: 'yes', source: 'BatteryManager' },
      { field: 'DeviceApplicationVersion', type: 'String', required: 'yes', source: 'SP.versionCode / BuildConfig' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Telemetry', action: 'Cihaz telemetrisi' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  // ═══ HUB COMPANION ═════════════════════════════════════════════════════
  {
    id: 'getEvents',
    screen: 'hub-companion',
    action: 'Load Events',
    trigger: 'Scan Parcel screen open',
    method: 'POST',
    path: 'HubCompanion/GetEvents',
    domain: 'hubcompanion',
    requestModel: 'String ("{}")',
    responseModel: 'GetEventsResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Hub companion için kullanılabilir event tiplerini getirir.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Event picker: Event listesi',
    ],
    chain: [
      { layer: 'action', label: 'Load Events', detail: 'hubcompanion/scanparcel/ScanParcelFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → getEvents()' },
      { layer: 'repository', label: 'MainRepository.getEvents()' },
      { layer: 'api', label: 'POST HubCompanion/GetEvents' },
      { layer: 'response', label: '200 GetEventsResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'hubcompanion/scanparcel/ScanParcelFragment.kt', method: 'getEvents' },
      { layer: 'ViewModel', file: 'hubcompanion/scanparcel/ScanParcelViewModel.kt', method: 'getEvents' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getEvents()' },
    ],
    requestFields: [
      { field: '(body)', type: 'String', required: 'conditional', source: 'JSON string body — genelde "{}" veya serialized model', validation: 'JSON' },
    ],
    responseMapping: [
      { field: 'payload.events', destination: 'Event picker', action: 'Event listesi' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'scanSpecial',
    screen: 'hub-companion',
    action: 'Scan Parcel',
    trigger: 'Special scan submit',
    method: 'POST',
    path: 'HubCompanion/ScanSpecial',
    domain: 'hubcompanion',
    requestModel: 'List<ScanSpecialRequest>',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Hub companion özel scan event’lerini toplu işler.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Scan result: Special event loglanır',
    ],
    chain: [
      { layer: 'action', label: 'Scan Parcel', detail: 'hubcompanion/scanparcel/ScanParcelFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → scanSpecial()' },
      { layer: 'repository', label: 'MainRepository.scanSpecial()' },
      { layer: 'api', label: 'POST HubCompanion/ScanSpecial' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'ViewModel', file: 'hubcompanion/scanparcel/ScanParcelViewModel.kt', method: 'scanSpecial' },
      { layer: 'API', file: 'network/APIService.kt', method: 'scanSpecial()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'scanSpecial()' },
    ],
    requestFields: [
      { field: '[]barcode', type: 'String', required: 'yes', source: 'Barcode scan' },
      { field: '[]events', type: 'ArrayList<EventDetail>', required: 'yes', source: 'UI selection / scan list' },
      { field: '[]eventCode', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Scan result', action: 'Special event loglanır' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'updateEventParcel',
    screen: 'hub-companion',
    action: 'Process Event Parcels',
    trigger: 'Scan / photo capture process',
    method: 'POST',
    path: 'HubCompanion/ProcessAndLogEventParcels',
    domain: 'hubcompanion',
    requestModel: 'List<UpdateEventParcel>',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Hub companion parcel event’lerini (scan + opsiyonel foto) ProcessAndLogEventParcels ile işler.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Event log: Parcel event kaydı',
    ],
    chain: [
      { layer: 'action', label: 'Process Event Parcels', detail: 'hubcompanion/scanparcel/ScanParcelFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → updateEventParcel()' },
      { layer: 'repository', label: 'MainRepository.updateEventParcel()' },
      { layer: 'api', label: 'POST HubCompanion/ProcessAndLogEventParcels' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'hubcompanion/scanparcel/ScanParcelFragment.kt', method: 'process' },
      { layer: 'ViewModel', file: 'hubcompanion/scanparcel/ScanParcelViewModel.kt', method: 'updateEventParcel' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'updateEventParcel' },
      { layer: 'API', file: 'network/APIService.kt', method: 'updateEventParcel()' },
    ],
    requestFields: [
      { field: '[]shipmentId', type: 'String', required: 'yes', source: 'currentTask.shipmentId' },
      { field: '[]eventCode', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: '[]filterList', type: 'List<FilterList>', required: 'yes', source: 'UI selection / scan list' },
      { field: '[]scanDateTime', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: '[]eventLocation', type: 'EventLocation', required: 'yes', source: 'Request model / ViewModel' },
      { field: '[]legacySystemShortBarcode', type: 'String', required: 'yes', source: 'Barcode scan / currentTask' },
      { field: '[]eventType', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: '[]fileName', type: 'String?', required: 'no', source: 'Uploaded photo name' },
      { field: '[]imageType', type: 'ImageType', required: 'yes', source: 'Request model / ViewModel' },
      { field: '[]remark', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: '[]eventText', type: 'String?', required: 'no', source: 'Request model / ViewModel' },
      { field: '[]fileNameList', type: 'List<String>?', required: 'no', source: 'UI selection / scan list' },
      { field: '[]eventRouteNumber', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Event log', action: 'Parcel event kaydı' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'getHistory',
    screen: 'hub-companion',
    action: 'Open Event History',
    trigger: 'History tab',
    method: 'POST',
    path: 'HubCompanion/GetShipmentEventHistory',
    domain: 'hubcompanion',
    requestModel: 'EventRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Shipment için hub companion event geçmişini getirir.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'History timeline: Event geçmişi',
    ],
    chain: [
      { layer: 'action', label: 'Open Event History', detail: 'hubcompanion/scanparcel/ScanParcelFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → getHistory()' },
      { layer: 'repository', label: 'MainRepository.getHistory()' },
      { layer: 'api', label: 'POST HubCompanion/GetShipmentEventHistory' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'ViewModel', file: 'hubcompanion/scanparcel/ScanParcelViewModel.kt', method: 'getHistory' },
      { layer: 'UI', file: 'hubcompanion/', method: 'TrackParcelFragment' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getHistory()' },
    ],
    requestFields: [
      { field: 'shipmentId', type: 'String', required: 'yes', source: 'currentTask.shipmentId' },
    ],
    responseMapping: [
      { field: 'payload', destination: 'History timeline', action: 'Event geçmişi' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'getLogsByUserName',
    screen: 'hub-companion',
    action: 'Open Logs',
    trigger: 'Log screen open',
    method: 'POST',
    path: 'HubCompanion/GetLogsByUserName',
    domain: 'hubcompanion',
    requestModel: 'String ("{}")',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Kullanıcıya ait hub companion log kayıtlarını listeler.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Log list UI: Loglar listelenir',
    ],
    chain: [
      { layer: 'action', label: 'Open Logs', detail: 'hubcompanion/scanparcel/ScanParcelFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → getLogsByUserName()' },
      { layer: 'repository', label: 'MainRepository.getLogsByUserName()' },
      { layer: 'api', label: 'POST HubCompanion/GetLogsByUserName' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'hubcompanion/LogFragment.kt', method: 'load' },
      { layer: 'ViewModel', file: 'hubcompanion/LogViewModel.kt', method: 'getLogsByUserName' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getLogsByUserName()' },
    ],
    requestFields: [
      { field: '(body)', type: 'String', required: 'conditional', source: 'JSON string body — genelde "{}" veya serialized model', validation: 'JSON' },
    ],
    responseMapping: [
      { field: 'payload', destination: 'Log list UI', action: 'Loglar listelenir' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'savePhoto',
    screen: 'hub-companion',
    action: 'Upload Photo',
    trigger: 'PhotoCaptureBottomSheet upload',
    method: 'MULTIPART',
    path: 'HubCompanion/f/SaveImage',
    domain: 'hubcompanion',
    requestModel: 'MultipartBody.Part',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Hub companion event fotoğrafını multipart HubCompanion/f/SaveImage’a yükler.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'fileName for event: updateEventParcel’a fileName verilir',
    ],
    chain: [
      { layer: 'action', label: 'Upload Photo', detail: 'hubcompanion/scanparcel/ScanParcelFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → savePhoto()' },
      { layer: 'repository', label: 'MainRepository.savePhoto()' },
      { layer: 'api', label: 'MULTIPART HubCompanion/f/SaveImage' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'hubcompanion/PhotoCaptureBottomSheet.kt', method: 'upload' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'savePhoto' },
      { layer: 'API', file: 'network/APIService.kt', method: 'savePhoto()' },
    ],
    requestFields: [
      { field: 'file', type: 'MultipartBody.Part', required: 'yes', source: 'Camera / file picker', validation: 'Non-null part' },
    ],
    responseMapping: [
      { field: 'success', destination: 'fileName for event', action: 'updateEventParcel’a fileName verilir' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'getEventTypeList',
    screen: 'hub-companion',
    action: 'Load Event Types',
    trigger: 'Delivery / locker event check',
    method: 'POST',
    path: 'EventTower/GetEvents',
    domain: 'hubcompanion',
    requestModel: 'GetEventTypeListRequest',
    responseModel: 'GetEventTypeListResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'EventTower üzerinden shipment event detay listesini getirir; delivery/locker doğrulamada kullanılır.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Event validation UI: Event’ler doğrulanır',
    ],
    chain: [
      { layer: 'action', label: 'Load Event Types', detail: 'hubcompanion/scanparcel/ScanParcelFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → getEventTypeList()' },
      { layer: 'repository', label: 'MainRepository.getEventTypeList()' },
      { layer: 'api', label: 'POST EventTower/GetEvents' },
      { layer: 'response', label: '200 GetEventTypeListResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'delivery/DeliveryFragment.kt', method: 'events' },
      { layer: 'UI', file: 'stop_list/StopListFragment.kt', method: 'getEventTypeList' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'getEventTypeList' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getEventTypeList()' },
    ],
    requestFields: [
      { field: 'ShipmentId', type: 'String', required: 'yes', source: 'currentTask.shipmentId' },
    ],
    responseMapping: [
      { field: 'payload.eventDetailList', destination: 'Event validation UI', action: 'Event’ler doğrulanır' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  // ═══ ASK QUESTION / CHAT ═══════════════════════════════════════════════
  {
    id: 'getAskQuestion',
    screen: 'ask-question',
    action: 'Load Questions',
    trigger: 'Ask Question screen open',
    method: 'POST',
    path: 'History/GetAskQuestion/',
    domain: 'system',
    requestModel: 'String',
    responseModel: 'GetAskQuestionResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Kullanıcının soru-cevap (ask question) listesini getirir.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Q&A list: Sorular/cevaplar listelenir',
    ],
    chain: [
      { layer: 'action', label: 'Load Questions', detail: 'askQuestion/AskQuestionFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → getAskQuestion()' },
      { layer: 'repository', label: 'MainRepository.getAskQuestion()' },
      { layer: 'api', label: 'POST History/GetAskQuestion/' },
      { layer: 'response', label: '200 GetAskQuestionResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'askQuestion/AskQuestionFragment.kt', method: 'load' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'getAskQuestion' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getAskQuestion()' },
    ],
    requestFields: [
      { field: '(body)', type: 'String', required: 'conditional', source: 'JSON string body — genelde "{}" veya serialized model', validation: 'JSON' },
    ],
    responseMapping: [
      { field: 'payload[]', destination: 'Q&A list', action: 'Sorular/cevaplar listelenir' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'getAllSubject',
    screen: 'ask-question',
    action: 'Load Subjects',
    trigger: 'New question → subject picker',
    method: 'POST',
    path: 'History/GetAllSubject/',
    domain: 'system',
    requestModel: 'String',
    responseModel: 'AskQuestionSubjectResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Yeni soru için konu (subject) listesini getirir.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Subject picker: Konular dolar',
    ],
    chain: [
      { layer: 'action', label: 'Load Subjects', detail: 'askQuestion/AskQuestionFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → getAllSubject()' },
      { layer: 'repository', label: 'MainRepository.getAllSubject()' },
      { layer: 'api', label: 'POST History/GetAllSubject/' },
      { layer: 'response', label: '200 AskQuestionSubjectResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'askQuestion/QuestionFragment.kt', method: 'subjects' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'getAllSubject' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getAllSubject()' },
    ],
    requestFields: [
      { field: '(body)', type: 'String', required: 'conditional', source: 'JSON string body — genelde "{}" veya serialized model', validation: 'JSON' },
    ],
    responseMapping: [
      { field: 'payload[]', destination: 'Subject picker', action: 'Konular dolar' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'sendAskQuestion',
    screen: 'ask-question',
    action: 'Send Question',
    trigger: 'Send question',
    method: 'POST',
    path: 'User/AskQuestion/',
    domain: 'system',
    requestModel: 'AskQuestionRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: true,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Kullanıcı sorusunu gönderir; offline Request kuyruğu (AskQuestion) üzerinden işlenir.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
      'RequestSenderService çalışıyor (offline yazımlar için)',
    ],
    postEffects: [
      'Room Request: Soru sync edilir',
    ],
    chain: [
      { layer: 'action', label: 'Send Question', detail: 'askQuestion/AskQuestionFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → sendAskQuestion()' },
      { layer: 'repository', label: 'MainRepository.sendAskQuestion()' },
      { layer: 'queue', label: 'Room Request queue', detail: 'RequestSenderService drain' },
      { layer: 'api', label: 'POST User/AskQuestion/' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'ViewModel', file: 'stop_list/StopViewModel.kt', method: 'enqueue AskQuestion' },
      { layer: 'Queue', file: 'services/RequestSenderService.kt', method: 'SAVE_ASK_QUESTION_REQUEST' },
      { layer: 'API', file: 'network/APIService.kt', method: 'sendAskQuestion()' },
    ],
    requestFields: [
      { field: 'subject', type: 'String', required: 'yes', source: 'User input' },
      { field: 'askQuestion', type: 'String', required: 'yes', source: 'User input' },
      { field: 'gsm', type: 'String', required: 'yes', source: 'SP / user phone' },
    ],
    responseMapping: [
      { field: 'queued', destination: 'Room Request', action: 'Soru sync edilir' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Kuyrukta kalır / retry (max 3)', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
    notes: 'Kuyruk tipi AskQuestion.',
  },
  {
    id: 'readingIncomingAnswer',
    screen: 'ask-question',
    action: 'Mark Answer Read',
    trigger: 'Open answer / mark read',
    method: 'POST',
    path: 'History/ReadingIncomingAnswer/',
    domain: 'system',
    requestModel: 'String',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Gelen cevabı okundu olarak işaretler (ReadingIncomingAnswerRequest.id Gson ile String body).',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Q&A read state: isReadTheMessage=true',
    ],
    chain: [
      { layer: 'action', label: 'Mark Answer Read', detail: 'askQuestion/AskQuestionFragment.kt' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → readingIncomingAnswer()' },
      { layer: 'repository', label: 'MainRepository.readingIncomingAnswer()' },
      { layer: 'api', label: 'POST History/ReadingIncomingAnswer/' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'askQuestion/AnswerFragment.kt', method: 'mark read' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'readingIncomingAnswer' },
      { layer: 'API', file: 'network/APIService.kt', method: 'readingIncomingAnswer()' },
    ],
    requestFields: [
      { field: 'id', type: 'String', required: 'yes', source: 'AskQuestion payload.id', validation: 'Non-empty' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Q&A read state', action: 'isReadTheMessage=true' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
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
    owner: 'Mobile Core · Backend Schedule',
    summary:
      'Gün sonu kapanışı — kuyruk üzerinden gönderilir (case :613). Kuyruktaki bekleyen teslimat istekleri tamamlanmadan kapanış tutarlılığı garanti edilmez.',
    preconditions: [
      'Aktif schedule id mevcut olmalı',
      'End-of-day kullanıcı onayı alınmış olmalı',
      'Bekleyen kritik delivery/pickup request’leri kontrol edilmiş olmalı',
    ],
    postEffects: [
      'Başarılı cevap schedule kapanış state’ini günceller',
      'Kuyruk kaydı CompletedRequest’e arşivlenir',
      'Stop List / schedule status refresh edilir',
    ],
    chain: [
      { layer: 'action', label: 'Close Day', detail: 'EndOfDayFragment' },
      { layer: 'viewmodel', label: 'SharedViewModel.requestScheduleEndOfDay()', detail: 'main/SharedViewModel.kt:3576' },
      { layer: 'queue', label: 'saveRequest(REQUEST_SCHEDULE_END_OF_DAY)' },
      { layer: 'queue', label: 'RequestSenderService case', detail: ':613' },
      { layer: 'api', label: 'POST Task/RequestScheduleEndOfDay/' },
      { layer: 'state', label: 'Schedule kapanır — SP.scheduleStatus güncellenir' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'schedule/stop/endofday/EndOfDayFragment.kt', method: 'end-of-day confirm' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'requestScheduleEndOfDay() · :3576' },
      { layer: 'Queue', file: 'services/RequestSenderService.kt', method: 'REQUEST_SCHEDULE_END_OF_DAY · :613' },
      { layer: 'Repository', file: 'main/MainRepository.kt', method: 'requestScheduleEndOfDay()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'requestScheduleEndOfDay() · :133' },
    ],
    requestFields: [
      { field: 'ScheduleId', type: 'String', required: 'yes', source: 'Aktif schedule id / SP.scheduleId', validation: 'Non-empty' },
    ],
    responseMapping: [
      { field: 'resultCode', destination: 'Resource / RequestSenderService', action: 'SUCCESS → schedule kapanış state’i ve request arşivi' },
      { field: 'resultMessage', destination: 'UI message / requestTrace', action: 'Kapanış sonucu veya hata mesajı' },
    ],
    errors: [
      { status: 'Pending operations', backend: 'Schedule kapatma business rule reddi', mobile: 'Resource.error / queue retry', user: 'Gün sonu kapanmaz' },
      { status: 'Malformed JSON', backend: 'Çağrı yapılmaz', mobile: 'Request hata ile arşivlenir', user: 'Kapanış gönderilmez' },
      { status: 'Network/timeout', backend: 'Kapanış sonucu belirsiz olabilir', mobile: 'Kuyruk retry', user: 'Schedule status reconciliation gerekir' },
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
    trigger: 'Cash desk deposit / end collection',
    method: 'POST',
    path: 'Shipment/SaveCollectedShipmentListToCashDesk/',
    domain: 'payment',
    requestModel: 'SaveCollectedShipmentListToCashDeskRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Tahsil edilen shipment listesini cash desk’e kaydeder.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Cash desk state: Tahsilat kapatılır',
    ],
    chain: [
      { layer: 'action', label: 'Hand Over to Cash Desk', detail: 'end-of-day' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → saveCollectedShipmentListToCashDesk()' },
      { layer: 'repository', label: 'MainRepository.saveCollectedShipmentListToCashDesk()' },
      { layer: 'api', label: 'POST Shipment/SaveCollectedShipmentListToCashDesk/' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'saveCollectedShipmentListToCashDesk' },
      { layer: 'API', file: 'network/APIService.kt', method: 'saveCollectedShipmentListToCashDesk()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'saveCollectedShipmentListToCashDesk()' },
    ],
    requestFields: [
      { field: 'CourierUserId', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'CourierName', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'ScheduleId', type: 'String', required: 'yes', source: 'SP.scheduleId / current Schedule' },
      { field: 'HubId', type: 'Int', required: 'yes', source: 'SP.hubId / GetUserHub' },
      { field: 'CollectedShipmentList', type: 'List<CollectedShipment>', required: 'yes', source: 'UI selection / scan list' },
      { field: 'CollectionType', type: 'CollectionType?', required: 'no', source: 'Request model / ViewModel' },
      { field: 'ServiceTypes', type: 'List<Int>?', required: 'no', source: 'UI selection / scan list' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Cash desk state', action: 'Tahsilat kapatılır' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
  },
  {
    id: 'saveParcelListFromScheduleToInventory',
    screen: 'end-of-day',
    action: 'Sync Inventory',
    trigger: 'Inbound inventory save',
    method: 'POST',
    path: 'Shipment/SaveParcelListFromScheduleToInventory/',
    domain: 'shipment',
    requestModel: 'SaveParcelListFromScheduleToInventoryRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Schedule’daki inbound parcel listesini hub inventory’ye kaydeder.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Inventory: Inbound parcels kaydedilir',
    ],
    chain: [
      { layer: 'action', label: 'Sync Inventory', detail: 'end-of-day' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → saveParcelListFromScheduleToInventory()' },
      { layer: 'repository', label: 'MainRepository.saveParcelListFromScheduleToInventory()' },
      { layer: 'api', label: 'POST Shipment/SaveParcelListFromScheduleToInventory/' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'stop_list/StopListFragment.kt', method: 'inbound' },
      { layer: 'ViewModel', file: 'stop_list/StopViewModel.kt', method: 'saveParcelListFromScheduleToInventory' },
      { layer: 'API', file: 'network/APIService.kt', method: 'saveParcelListFromScheduleToInventory()' },
    ],
    requestFields: [
      { field: 'CourierUserId', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'CourierName', type: 'String', required: 'yes', source: 'Request model / ViewModel' },
      { field: 'ScheduleId', type: 'String', required: 'yes', source: 'SP.scheduleId / current Schedule' },
      { field: 'HubId', type: 'Int', required: 'yes', source: 'SP.hubId / GetUserHub' },
      { field: 'InboundParcelList', type: 'List<InboundParcel>', required: 'yes', source: 'UI selection / scan list' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Inventory', action: 'Inbound parcels kaydedilir' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
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
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core · Reliability',
    summary:
      'Dead-letter kanalı: 3 retry’ı tüketen isteğin gövdesi + trace backend’e diagnostik olarak gönderilir (handleRequestRetryCountPolicy).',
    preconditions: [
      'Orijinal Request.tryCount >= 3 olmalı',
      'Orijinal request adı SAVE_TERMINAL_FAILED_REQUESTS olmamalı (recursive dead-letter guard)',
      'Aktif userName ve mümkünse scheduleId mevcut olmalı',
    ],
    postEffects: [
      'Başarısız request adı, gövdesi ve response trace History servisine aktarılır',
      'Başarılı diagnostic request CompletedRequest’e arşivlenir',
      'Diagnostic isteğin kendisi başarısızsa recursive dead-letter üretilmez',
    ],
    chain: [
      { layer: 'queue', label: 'handleRequestRetryCountPolicy()', detail: 'RequestSenderService.kt:1099' },
      { layer: 'ui', label: 'SaveTerminalFailedRequestsReq oluşturulur', detail: 'Orijinal request + trace + scheduleId' },
      { layer: 'queue', label: 'Room Request(SAVE_TERMINAL_FAILED_REQUESTS)', detail: ':1120-1127' },
      { layer: 'queue', label: 'RequestSenderService dispatch', detail: ':581-611' },
      { layer: 'repository', label: 'MainRepository.saveTerminalFailedRequests()' },
      { layer: 'api', label: 'POST History/SaveTerminalFailedRequests/' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'db', label: 'Diagnostic request CompletedRequest arşivi' },
    ],
    codeRefs: [
      { layer: 'Retry', file: 'services/RequestSenderService.kt', method: 'handleRequestRetryCountPolicy() · :1099' },
      { layer: 'Queue', file: 'services/RequestSenderService.kt', method: 'SAVE_TERMINAL_FAILED_REQUESTS · :581' },
      { layer: 'Repository', file: 'main/MainRepository.kt', method: 'saveTerminalFailedRequests() · :132' },
      { layer: 'Provider', file: 'network/ApiProvider.kt', method: 'saveTerminalFailedRequests() · :135' },
      { layer: 'API', file: 'network/APIService.kt', method: 'saveTerminalFailedRequests() · :72' },
    ],
    requestFields: [
      { field: 'RequestName', type: 'String?', required: 'yes', source: 'Başarısız Request.requestName' },
      { field: 'RequestBody', type: 'String?', required: 'yes', source: 'Başarısız Request.requestJson', sensitive: true },
      { field: 'TimeStamp', type: 'String?', required: 'no', source: 'Başarısız Request.timeStamp' },
      { field: 'Response', type: 'String?', required: 'no', source: 'Başarısız Request.requestTrace' },
      { field: 'ScheduleId', type: 'String?', required: 'no', source: 'SP.scheduleId' },
    ],
    responseMapping: [
      { field: 'HTTP code / resultCode', destination: 'RequestSenderService processApiCall', action: 'Başarıda diagnostic request arşivlenir' },
      { field: 'HTTP message / resultMessage', destination: 'Request.requestTrace', action: 'Diagnostic iletim hatasını saklar' },
    ],
    errors: [
      { status: 'Malformed JSON', backend: 'Çağrı yapılmaz', mobile: 'Diagnostic request arşivlenir', user: 'Dead-letter backend’e ulaşmaz' },
      { status: 'Non-200', backend: 'History servisi reddi', mobile: 'processTime/isProcessing/requestTrace güncellenir', user: 'Arka planda görünmez' },
      { status: 'Exception/network', backend: 'Servis ulaşılamadı', mobile: 'Diagnostic request trace güncellenir; recursive dead-letter yok', user: 'Destek verisi kaybolabilir' },
    ],
    tests: [
      { name: 'Third failure creates one diagnostic request', status: 'missing' },
      { name: 'Diagnostic failure does not recurse', status: 'missing' },
      { name: 'Sensitive request body masking', status: 'missing' },
    ],
    notes: 'RequestBody ham JSON içerir; token/kimlik/konum gibi hassas alanlar backend loglama öncesi maskelenmelidir.',
  },
  {
    id: 'saveTerminalRequestDbSnapshot',
    screen: 'map',
    action: 'DB Snapshot Diagnostics',
    trigger: 'Diagnostic / support dump',
    method: 'POST',
    path: 'History/SaveTerminalRequestDbSnapshot/',
    domain: 'system',
    requestModel: 'SaveTerminalRequestDbSnapshotRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core',
    summary:
      'Terminal Request DB snapshot’ını diagnostik amaçlı History’ye gönderir. Aktif UI çağıranı bulunamadı (orphan API surface).',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
    ],
    postEffects: [
      'Diagnostics: Snapshot arşivlenir',
    ],
    chain: [
      { layer: 'action', label: 'DB Snapshot Diagnostics', detail: 'map' },
      { layer: 'viewmodel', label: 'SharedViewModel / screen VM → saveTerminalRequestDbSnapshot()' },
      { layer: 'repository', label: 'MainRepository.saveTerminalRequestDbSnapshot()' },
      { layer: 'api', label: 'POST History/SaveTerminalRequestDbSnapshot/' },
      { layer: 'response', label: '200 BaseResponse' },
      { layer: 'state', label: 'Resource → UI refresh' },
    ],
    codeRefs: [
      { layer: 'API', file: 'network/APIService.kt', method: 'saveTerminalRequestDbSnapshot()' },
      { layer: 'API', file: 'network/APIService.kt', method: 'saveTerminalRequestDbSnapshot()' },
    ],
    requestFields: [
      { field: 'ScheduleId', type: 'String?', required: 'no', source: 'SP.scheduleId / current Schedule' },
      { field: 'TerminalRequestList', type: 'List<TerminalRequest>', required: 'yes', source: 'UI selection / scan list' },
    ],
    responseMapping: [
      { field: 'success', destination: 'Diagnostics', action: 'Snapshot arşivlenir' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx', backend: 'Validation / business error (ResultCode)', mobile: 'Resource.error + ResultMessage', user: 'Hata mesajı gösterilir' },
      { status: '5xx / timeout', backend: 'Server / network', mobile: 'Resource.error; offline ise kuyruğa düşer', user: 'Retry / offline banner' },
    ],
    tests: [
      { name: 'Happy path', status: 'partial', env: 'Manual' },
      { name: 'Error / offline path', status: 'missing' },
    ],
    notes: 'Orphan — network katmanında tanımlı, UI çağıranı yok.',
  },
  // ═══ 19 TEM 2026 COVERAGE PASS — APIService'ten eksik 13 contract ═══════
  {
    id: 'updateVehicleCourierZoneCourierDriver',
    screen: 'vehicle-welcome',
    action: 'Assign Courier Driver',
    trigger: 'Repository yüzeyi çağrıldığında; aktif UI çağıranı bulunamadı',
    method: 'POST',
    path: 'Task/UpdateVehicleCourierZoneCourierDriver/',
    domain: 'schedule',
    requestModel: 'String (raw JSON)',
    responseModel: 'UpdateVehicleCourierZoneResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core · Vehicle Operations',
    summary:
      'Araç/kurye zone kaydına courier driver ataması yapar. APIService, ApiProvider ve MainRepository katmanları mevcut; aktif Fragment/ViewModel çağıranı bulunamadı.',
    preconditions: [
      'Login tamamlanmış (Bearer token)',
      'Backend’in beklediği driver/vehicle/zone alanlarını içeren geçerli JSON oluşturulmuş olmalı',
    ],
    postEffects: [
      'Başarıda araç–zone kaydının kurye sürücüsü backend’de güncellenir',
      'Payload.isConfirmationRequired UI tarafından ileride onay akışına bağlanabilir',
    ],
    chain: [
      { layer: 'repository', label: 'MainRepository.updateVehicleCourierZoneCourierDriver(rawJson)' },
      { layer: 'repository', label: 'ApiProvider.updateVehicleCourierZoneCourierDriver(rawJson)' },
      { layer: 'api', label: 'POST Task/UpdateVehicleCourierZoneCourierDriver/' },
      { layer: 'response', label: 'UpdateVehicleCourierZoneResponse' },
    ],
    codeRefs: [
      { layer: 'Repository', file: 'main/MainRepository.kt', method: 'updateVehicleCourierZoneCourierDriver() · :160' },
      { layer: 'Provider', file: 'network/ApiProvider.kt', method: 'updateVehicleCourierZoneCourierDriver() · :162' },
      { layer: 'API', file: 'network/APIService.kt', method: 'updateVehicleCourierZoneCourierDriver() · :113' },
    ],
    requestFields: [
      { field: 'raw JSON body', type: 'String', required: 'yes', source: 'Çağıran katman; typed request modeli yok', validation: 'Geçerli JSON olmalı' },
    ],
    responseMapping: [
      { field: 'ResultCode / ResultMessage', destination: 'Repository caller', action: 'İşlem sonucu ve hata mesajını taşır' },
      { field: 'Payload.isConfirmationRequired', destination: 'Repository caller', action: 'Ek onay gerekip gerekmediğini bildirir' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: '4xx / ResultCode', backend: 'JSON veya atama doğrulaması başarısız', mobile: 'Response çağırana döner', user: 'Aktif UI çağıranı yok' },
      { status: '5xx / network', backend: 'Servis ulaşılamadı', mobile: 'Exception çağırana yayılır', user: 'Aktif UI çağıranı yok' },
    ],
    tests: [
      { name: 'Valid raw JSON updates courier driver', status: 'missing' },
      { name: 'Confirmation-required response', status: 'missing' },
      { name: 'Malformed JSON rejection', status: 'missing' },
    ],
    notes: 'Orphan API surface: typed request modeli ve aktif UI/ViewModel çağıranı bulunmuyor.',
  },
  {
    id: 'requestLeavingPermission',
    screen: 'stop-list',
    action: 'Request Leaving Permission',
    trigger: 'Kurye schedule’dan ayrılmak istediğinde veya ayrılma fotoğrafı yüklendikten sonra',
    method: 'POST',
    path: 'Task/RequestLeavingPermission/',
    domain: 'schedule',
    requestModel: 'RequestLeavingPermissionRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core · Schedule',
    summary:
      'Aktif schedule için ayrılma izni ister; opsiyonel fotoğraf URL’si, güncel konum ve route yeniden hesaplama tercihini backend’e iletir.',
    preconditions: [
      'Aktif scheduleId mevcut olmalı',
      'Konum bilgisi alınmış veya bilinçli olarak 0.0/0.0 fallback’i seçilmiş olmalı',
      'Fotoğraflı akışta upload tamamlanmış ve URL üretilmiş olmalı',
    ],
    postEffects: [
      'Ayrılma izni isteği backend’e kaydedilir',
      'Başarı/başarısızlık Resource üzerinden Stop List veya Camera UI’a iletilir',
      'calculateRoute=true ise backend route’u yeniden hesaplayabilir',
    ],
    chain: [
      { layer: 'action', label: 'Leave schedule / upload evidence photo' },
      { layer: 'ui', label: 'StopListFragment veya CameraFragment' },
      { layer: 'viewmodel', label: 'SharedViewModel / StopViewModel.requestLeavingPermission()' },
      { layer: 'repository', label: 'MainRepository.requestLeavingPermission()' },
      { layer: 'api', label: 'POST Task/RequestLeavingPermission/' },
      { layer: 'response', label: 'BaseResponse → Resource' },
      { layer: 'state', label: 'İzin sonucu kullanıcıya gösterilir' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'stop_list/StopListFragment.kt', method: 'requestLeavingPermission · :4596' },
      { layer: 'UI', file: 'CameraFragment.kt', method: 'requestLeavingPermission · :738' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'requestLeavingPermission() · :2101' },
      { layer: 'ViewModel', file: 'stop_list/StopViewModel.kt', method: 'requestLeavingPermission() · :741' },
      { layer: 'Repository', file: 'main/MainRepository.kt', method: 'requestLeavingPermission() · :126' },
      { layer: 'Provider', file: 'network/ApiProvider.kt', method: 'requestLeavingPermission() · :129' },
      { layer: 'API', file: 'network/APIService.kt', method: 'requestLeavingPermission() · :179' },
    ],
    requestFields: [
      { field: 'LeavingPermissionPhotoUrl', type: 'String?', required: 'no', source: 'Camera upload sonucu; fotoğrafsız akışta null', sensitive: true },
      { field: 'LeavingRequestCurrentLocation.latitude', type: 'Double', required: 'yes', source: 'Current location; fallback 0.0' },
      { field: 'LeavingRequestCurrentLocation.longitude', type: 'Double', required: 'yes', source: 'Current location; fallback 0.0' },
      { field: 'scheduleId', type: 'String', required: 'yes', source: 'SP.scheduleId' },
      { field: 'calculateRoute', type: 'Boolean', required: 'yes', source: 'UI flow / route recalculation choice' },
    ],
    responseMapping: [
      { field: 'ResultCode', destination: 'Resource status', action: 'SUCCESS veya ERROR üretir' },
      { field: 'ResultMessage', destination: 'StopList/Camera UI', action: 'Sonuç mesajını gösterir' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: 'Business error', backend: 'Schedule/konum/izin reddi', mobile: 'Resource.error(ResultMessage)', user: 'İzin isteği hatası' },
      { status: 'Network / exception', backend: 'İstek ulaşmadı', mobile: 'Catch → Resource.error', user: 'Tekrar deneme mesajı' },
    ],
    tests: [
      { name: 'Photo-backed permission request', status: 'partial', env: 'Manual' },
      { name: 'No-photo 0.0 location fallback', status: 'missing' },
      { name: 'Route recalculation flag', status: 'missing' },
    ],
  },
  {
    id: 'isMissingMultiParcel',
    screen: 'stop-list',
    action: 'Check Missing Multi-Parcel',
    trigger: 'Repository yüzeyi çağrıldığında; aktif UI çağıranı bulunamadı',
    method: 'POST',
    path: 'Task/IsMissingMultiParcel',
    domain: 'schedule',
    requestModel: 'IsMissingMultiParcel',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core · Schedule',
    summary:
      'Schedule içinde eksik multi-parcel olup olmadığını backend kontrolüne gönderir. Ağ ve repository katmanları hazır, aktif UI/ViewModel çağıranı yoktur.',
    preconditions: ['Aktif ve geçerli scheduleId mevcut olmalı', 'Login tamamlanmış (Bearer token)'],
    postEffects: ['Backend eksik multi-parcel kontrolünü çalıştırır', 'BaseResponse çağıran repository tüketicisine döner'],
    chain: [
      { layer: 'repository', label: 'MainRepository.isMissingMultiParcel(request)' },
      { layer: 'repository', label: 'ApiProvider.isMissingMultiParcel(request)' },
      { layer: 'api', label: 'POST Task/IsMissingMultiParcel' },
      { layer: 'response', label: 'BaseResponse' },
    ],
    codeRefs: [
      { layer: 'Repository', file: 'main/MainRepository.kt', method: 'isMissingMultiParcel() · :192' },
      { layer: 'Provider', file: 'network/ApiProvider.kt', method: 'isMissingMultiParcel() · :191' },
      { layer: 'API', file: 'network/APIService.kt', method: 'isMissingMultiParcel() · :332' },
    ],
    requestFields: [
      { field: 'scheduleId', type: 'String', required: 'yes', source: 'Current Schedule / SP.scheduleId' },
    ],
    responseMapping: [
      { field: 'ResultCode / ResultMessage', destination: 'Repository caller', action: 'Eksik multi-parcel kontrol sonucunu taşır' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: 'Business error', backend: 'Schedule bulunamadı veya doğrulama hatası', mobile: 'BaseResponse çağırana döner', user: 'Aktif UI çağıranı yok' },
      { status: 'Network', backend: 'Servis ulaşılamadı', mobile: 'Exception çağırana yayılır', user: 'Aktif UI çağıranı yok' },
    ],
    tests: [
      { name: 'Schedule with missing parcel', status: 'missing' },
      { name: 'Complete schedule', status: 'missing' },
      { name: 'Unknown scheduleId', status: 'missing' },
    ],
    notes: 'Orphan API surface: yalnızca APIService → ApiProvider → MainRepository zinciri mevcut.',
  },
  {
    id: 'shipmentItemUpdate',
    screen: 'stop-list',
    action: 'Sync Shipment Items',
    trigger: 'Repository yüzeyi çağrıldığında; aktif UI çağıranı bulunamadı',
    method: 'POST',
    path: 'Task/UpdateShipmentItem',
    domain: 'shipment',
    requestModel: 'ShipmentItemUpdateReq',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core · Shipment',
    summary:
      'Bir schedule’ın stop listesindeki shipment item verilerini toplu olarak backend’e senkronlar. Aktif ekran çağıranı bulunmayan repository yüzeyidir.',
    preconditions: ['scheduleId mevcut olmalı', 'Gönderilecek Stop listesi oluşturulmuş olmalı', 'Login tamamlanmış olmalı'],
    postEffects: ['Stop içindeki shipment item kayıtları backend’de güncellenir', 'BaseResponse çağıran katmana döner'],
    chain: [
      { layer: 'repository', label: 'MainRepository.shipmentItemUpdate(request)' },
      { layer: 'repository', label: 'ApiProvider.shipmentItemUpdate(request)' },
      { layer: 'api', label: 'POST Task/UpdateShipmentItem' },
      { layer: 'response', label: 'BaseResponse' },
    ],
    codeRefs: [
      { layer: 'Repository', file: 'main/MainRepository.kt', method: 'shipmentItemUpdate() · :193' },
      { layer: 'Provider', file: 'network/ApiProvider.kt', method: 'shipmentItemUpdate() · :192' },
      { layer: 'API', file: 'network/APIService.kt', method: 'shipmentItemUpdate() · :336' },
    ],
    requestFields: [
      { field: 'stops', type: 'ArrayList<Stop>', required: 'yes', source: 'Schedule/Room stop state' },
      { field: 'scheduleId', type: 'String', required: 'yes', source: 'Current Schedule / SP.scheduleId' },
    ],
    responseMapping: [
      { field: 'ResultCode / ResultMessage', destination: 'Repository caller', action: 'Senkronizasyon sonucunu taşır' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: 'Validation', backend: 'Boş/geçersiz stop listesi veya schedule', mobile: 'BaseResponse çağırana döner', user: 'Aktif UI çağıranı yok' },
      { status: 'Network', backend: 'Servis ulaşılamadı', mobile: 'Exception çağırana yayılır', user: 'Aktif UI çağıranı yok' },
    ],
    tests: [
      { name: 'Valid stop list update', status: 'missing' },
      { name: 'Empty stop list rejection', status: 'missing' },
      { name: 'Stale schedule update', status: 'missing' },
    ],
    notes: 'Orphan API surface: yalnızca APIService → ApiProvider → MainRepository zinciri mevcut.',
  },
  {
    id: 'getAvailableWorkingDays',
    screen: 'delivery-failed',
    action: 'Load Available Working Days',
    trigger: 'Teslim edilememe için ileri tarih seçicisi açıldığında veya çalışma günleri yerel cache’e yenilendiğinde',
    method: 'POST',
    path: 'Shipment/GetAvailableWorkingDays',
    domain: 'shipment',
    requestModel: 'WorkingDayRequest',
    responseModel: 'WorkingDayResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core · Delivery',
    summary:
      'Başlangıç tarihi ve gün sayısına göre operasyonel çalışma günlerini getirir; date picker günlerini vurgular ve arka planda SharedPreferences cache’ini günceller.',
    preconditions: ['Geçerli timezone’lu startDate üretilmiş olmalı', 'dayCount pozitif olmalı', 'Online modda ağ erişimi olmalı'],
    postEffects: [
      'Payload.dayList teslim edilememe tarih seçicisinde highlightedDays olarak kullanılır',
      'Arka plan yenilemesinde dayList SP.availableWorkingDays alanına yazılır',
      'Payload.cutOff operasyonel kesim bilgisini taşır',
    ],
    chain: [
      { layer: 'action', label: 'Forward delivery date picker açılır' },
      { layer: 'ui', label: 'DeliveryFailedFragment.getAvailableWorkingDays()' },
      { layer: 'viewmodel', label: 'SharedViewModel.getAvailableWorkingDays()' },
      { layer: 'repository', label: 'MainRepository.getAvailableWorkingDays()' },
      { layer: 'api', label: 'POST Shipment/GetAvailableWorkingDays' },
      { layer: 'response', label: 'WorkingDayResponse.payload' },
      { layer: 'state', label: 'Date picker highlight / SP cache' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'deliveryFailed/DeliveryFailedFragment.kt', method: 'getAvailableWorkingDays() · :785' },
      { layer: 'UI', file: 'stop_list/StopListFragment.kt', method: 'getAvailableWorkingDays · :6134' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'getAvailableWorkingDays() · :2495' },
      { layer: 'Cache', file: 'main/SharedViewModel.kt', method: 'fetchWorkingDaysAndSaveToLocal() · :3431' },
      { layer: 'Repository', file: 'main/MainRepository.kt', method: 'getAvailableWorkingDays() · :194' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getAvailableWorkingDays() · :340' },
    ],
    requestFields: [
      { field: 'startDate', type: 'String', required: 'yes', source: 'getDateTimeWithTimeZone()', validation: 'Backend tarih formatı ve timezone içermeli' },
      { field: 'dayCount', type: 'Int', required: 'yes', source: 'UI date range; StopList akışında 7', validation: '> 0' },
    ],
    responseMapping: [
      { field: 'Payload.dayList', destination: 'DatePickerDialog.highlightedDays', action: 'Seçilebilir çalışma günlerini vurgular' },
      { field: 'Payload.dayList', destination: 'SP.availableWorkingDays', action: 'Offline/fallback kullanım için cache’ler' },
      { field: 'Payload.cutOff', destination: 'Working day flow', action: 'Operasyonel cut-off bilgisini sağlar' },
      { field: 'ResultMessage', destination: 'Resource.message', action: 'Hata/sonuç mesajını gösterir' },
    ],
    errors: [
      { status: 'Offline', backend: 'Çağrı yapılmaz', mobile: 'Cache’lenmiş availableWorkingDays kullanılır', user: 'Yerel günler gösterilir' },
      { status: 'Business error', backend: 'Geçersiz tarih/aralık', mobile: 'Resource.error', user: 'Tarih listesi yüklenemez' },
      { status: 'Network / exception', backend: 'Servis ulaşılamadı', mobile: 'Catch → Resource.error veya cache fallback', user: 'Tekrar deneme / mevcut liste' },
    ],
    tests: [
      { name: 'Seven-day working calendar', status: 'partial', env: 'Manual' },
      { name: 'Cut-off boundary', status: 'missing' },
      { name: 'Offline cached day list', status: 'missing' },
    ],
  },
  {
    id: 'activeLockerCounterLocationsD4M',
    screen: 'd4me-locker',
    action: 'Load LOS Locker Locations',
    trigger: 'D4M/locker lokasyonları açıldığında ve BuildConfig.isLosActive=true olduğunda',
    method: 'POST',
    path: 'Shipment/ActiveLockerCounterLocations',
    domain: 'locker',
    requestModel: 'ActiveLockerCounterReq',
    responseModel: 'ActiveD4MCounterRes',
    auth: true,
    offline: false,
    external: 'LOS locker provider',
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core · D4Me/Locker',
    summary:
      'LOS aktif ülkelerde mevcut locker/counter lokasyonlarını konum, waybill ve kurye zone’una göre getirir; sonucu standart D4M lokasyon listesine dönüştürür.',
    preconditions: [
      'BuildConfig.isLosActive=true olmalı',
      'Latitude/longitude ve waybillNumber mevcut olmalı',
      'SP.route courierZoneCode olarak kullanılabilir olmalı',
      'Online modda ağ erişimi olmalı',
    ],
    postEffects: [
      'LOS payload listesi ActiveD4MCounterRes olarak UI’a iletilir',
      'Boş liste Resource.error("No available locations") üretir',
      'Stop List / Task List uygun locker seçim ekranını açar',
    ],
    chain: [
      { layer: 'action', label: 'D4M location selection açılır' },
      { layer: 'ui', label: 'StopListFragment / TaskListFragment.activeD4MLocations()' },
      { layer: 'viewmodel', label: 'SharedViewModel.fetchLosLockerLocations()' },
      { layer: 'repository', label: 'MainRepository.activeLockerCounterLocationsD4M()' },
      { layer: 'api', label: 'POST Shipment/ActiveLockerCounterLocations' },
      { layer: 'external', label: 'LOS locker provider result' },
      { layer: 'response', label: 'ActiveD4MCounterRes.payload' },
      { layer: 'state', label: 'Locker lokasyonları listelenir' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'stop_list/StopListFragment.kt', method: 'activeD4MLocations() · :6590' },
      { layer: 'UI', file: 'task_list/TaskListFragment.kt', method: 'activeD4MLocations() · :2134' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'fetchLosLockerLocations() · :2593' },
      { layer: 'Repository', file: 'main/MainRepository.kt', method: 'activeLockerCounterLocationsD4M() · :197' },
      { layer: 'Provider', file: 'network/ApiProvider.kt', method: 'activeLockerCounterLocationsD4M() · :196' },
      { layer: 'API', file: 'network/APIService.kt', method: 'activeLockerCounterLocationsD4M() · :352' },
    ],
    requestFields: [
      { field: 'latitude', type: 'Double', required: 'yes', source: 'ActiveD4MCounterReq / current-stop location' },
      { field: 'longitude', type: 'Double', required: 'yes', source: 'ActiveD4MCounterReq / current-stop location' },
      { field: 'waybillNumber', type: 'String', required: 'yes', source: 'Selected shipment/task' },
      { field: 'lockerProvider', type: 'Int', required: 'yes', source: 'CounterLocationType.LOS.value' },
      { field: 'courierZoneCode', type: 'String', required: 'yes', source: 'SP.route' },
    ],
    responseMapping: [
      { field: 'Payload[]', destination: 'D4M location picker', action: 'LOS lokasyonlarını standart D4M listesi olarak gösterir' },
      { field: 'Payload[].oohid / name / address', destination: 'Location row', action: 'Lokasyon kimliği ve görünür bilgileri doldurur' },
      { field: 'Payload[].timetable / capacity / criteria', destination: 'Reservation validation', action: 'Uygunluk ve kapasite değerlendirmesine veri sağlar' },
      { field: 'ResultMessage', destination: 'Resource.message', action: 'Hata/sonuç mesajını iletir' },
    ],
    errors: [
      { status: 'Offline', backend: 'Çağrı yapılmaz', mobile: 'activeD4MLocations erken döner', user: 'Locker seçimi kullanılamaz' },
      { status: 'Empty payload', backend: 'Uygun LOS lokasyonu yok', mobile: 'Resource.error("No available locations")', user: 'Lokasyon bulunamadı' },
      { status: 'Network / exception', backend: 'LOS/servis ulaşılamadı', mobile: 'Catch → Resource.error', user: 'Hata mesajı' },
    ],
    tests: [
      { name: 'LOS-active location list', status: 'partial', env: 'Manual' },
      { name: 'Empty LOS result', status: 'missing' },
      { name: 'LOS inactive routes to D4M endpoint', status: 'missing' },
    ],
    notes: 'Aynı HTTP path, activeLockerCounterLocations metodunda farklı request/response modelleriyle de tanımlı; backend kontrat ayrımı regresyon testinde korunmalı.',
  },
  {
    id: 'getContractedCustomers',
    screen: 'login',
    action: 'Cache ID-Required Customers',
    trigger: 'Online login akışında host/versiyon hazırlığı sonrasında contracted customer listesi kaydedilirken',
    method: 'POST',
    path: 'Customer/GetIDRequiredCustomers',
    domain: 'auth',
    requestModel: 'String (default "{}")',
    responseModel: 'ContractedCustomerResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core · Login',
    summary:
      'Kimlik bilgisi zorunlu müşteri listesini login sırasında indirir ve yalnızca customerId değerlerini cihazda CONTRACTED_CUSTOMER_LIST olarak cache’ler.',
    preconditions: ['Online mod aktif olmalı', 'Login token’ı alınmış olmalı', 'Host seçimi tamamlanmış olmalı'],
    postEffects: [
      'Payload customerId değerleri SharedPreferences CONTRACTED_CUSTOMER_LIST alanına yazılır',
      'Başarı veya hata sonrası KVKK/consent kontrolü devam eder',
      'Offline modda çağrı atlanır ve mevcut cache korunur',
    ],
    chain: [
      { layer: 'ui', label: 'LoginFragment.saveContactedCustomerList()' },
      { layer: 'viewmodel', label: 'SharedViewModel.getContractedCustomers()' },
      { layer: 'repository', label: 'MainRepository.getContractedCustomers()' },
      { layer: 'api', label: 'POST Customer/GetIDRequiredCustomers' },
      { layer: 'response', label: 'ContractedCustomerResponse.payload[]' },
      { layer: 'state', label: 'SP.CONTRACTED_CUSTOMER_LIST + checkKVKK()' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'login/LoginFragment.kt', method: 'saveContactedCustomerList() · :344' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'getContractedCustomers() · :2529' },
      { layer: 'Repository', file: 'main/MainRepository.kt', method: 'getContractedCustomers() · :202' },
      { layer: 'Provider', file: 'network/ApiProvider.kt', method: 'getContractedCustomers() · :201' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getContractedCustomers() · :372' },
    ],
    requestFields: [
      { field: 'empty body', type: 'String', required: 'yes', source: 'APIService default "{}"', validation: 'JSON object' },
    ],
    responseMapping: [
      { field: 'Payload[].customerId', destination: 'SP.CONTRACTED_CUSTOMER_LIST', action: 'String listesine dönüştürüp kaydeder' },
      { field: 'Payload[].customerName / id', destination: 'Response only', action: 'Mobil şu anda persist etmez' },
      { field: 'ResultCode', destination: 'Login flow', action: 'SUCCESS/ERROR sonrası her iki durumda checkKVKK() ile devam eder' },
    ],
    errors: [
      { status: 'Offline', backend: 'Çağrı yapılmaz', mobile: 'saveContactedCustomerList bloğu atlanır', user: 'Mevcut yerel liste kullanılır' },
      { status: 'Business error', backend: 'Liste alınamadı', mobile: 'ERROR → hideLoading → checkKVKK', user: 'Login akışı devam eder' },
      { status: 'Network / exception', backend: 'Servis ulaşılamadı', mobile: 'Resource.error → checkKVKK', user: 'Login akışı mevcut cache ile sürer' },
    ],
    tests: [
      { name: 'Customer IDs cached after login', status: 'partial', env: 'Manual' },
      { name: 'Empty list clears or preserves cache', status: 'missing' },
      { name: 'Failure continues KVKK flow', status: 'missing' },
    ],
  },
  {
    id: 'getAddShipmentDemand',
    screen: 'stop-list',
    action: 'Create Shipment Notification',
    trigger: 'Stop List taramasında tanınmayan/kayıp barkod için kullanıcı shipment demand oluşturmayı onayladığında',
    method: 'POST',
    path: 'Shipment/CreateShipmentNotification',
    domain: 'shipment',
    requestModel: 'AddShipmentDemandRequest',
    responseModel: 'BaseResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core · Stop List',
    summary:
      'Stop List’te sisteme henüz düşmemiş barkodlar için kurye zone’u ve operation type ile shipment notification/demand oluşturur.',
    preconditions: ['Online modda ağ erişimi olmalı', 'Taranan barcode boş olmamalı', 'SP.route courier zone olarak mevcut olmalı'],
    postEffects: ['Backend shipment notification oluşturur', 'Başarıda kullanıcıya transaction_successful toast gösterilir', 'Loading göstergesi kapatılır'],
    chain: [
      { layer: 'action', label: 'Unknown/lost barcode demand onayı' },
      { layer: 'ui', label: 'StopListFragment.callAddShipmentDemand()' },
      { layer: 'viewmodel', label: 'StopViewModel.getAddShipmentDemandRequest()' },
      { layer: 'repository', label: 'MainRepository.getAddShipmentDemand()' },
      { layer: 'api', label: 'POST Shipment/CreateShipmentNotification' },
      { layer: 'response', label: 'BaseResponse → Resource' },
      { layer: 'state', label: 'Success/error toast' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'stop_list/StopListFragment.kt', method: 'callAddShipmentDemand() · :640' },
      { layer: 'UI', file: 'stop_list/StopListFragment.kt', method: 'lost shipment demand · :4075' },
      { layer: 'ViewModel', file: 'stop_list/StopViewModel.kt', method: 'getAddShipmentDemandRequest() · :1865' },
      { layer: 'Repository', file: 'main/MainRepository.kt', method: 'getAddShipmentDemand() · :203' },
      { layer: 'Provider', file: 'network/ApiProvider.kt', method: 'getAddShipmentDemand() · :202' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getAddShipmentDemand() · :376' },
    ],
    requestFields: [
      { field: 'CourierZoneCode', type: 'String?', required: 'yes', source: 'SharedPreferences.route' },
      { field: 'BarcodeList', type: 'List<String>', required: 'yes', source: 'Scan callback; mevcut akışta tek barkod', validation: 'En az bir geçerli barkod' },
      { field: 'OperationType', type: 'Int?', required: 'yes', source: 'UI akışında sabit 1' },
    ],
    responseMapping: [
      { field: 'ResultCode', destination: 'StopViewModel Resource', action: 'Çağrı tamamlanma durumunu taşır' },
      { field: 'ResultMessage', destination: 'Error toast/log', action: 'Backend hata ayrıntısını sağlar' },
      { field: 'Success', destination: 'StopListFragment', action: 'transaction_successful toast gösterir' },
    ],
    errors: [
      { status: 'Validation', backend: 'Zone, barcode veya operation type geçersiz', mobile: 'Resource/error callback', user: 'İşlem hatası toast’ı' },
      { status: 'Network', backend: 'Servis ulaşılamadı', mobile: 'Catch → Resource.error', user: 'Hata mesajı' },
      { status: 'Lifecycle', backend: 'Çağrı sonucu geldi', mobile: 'isAdded/view guard ile UI güncellemesi atlanır', user: 'Ekran kapandıysa mesaj gösterilmez' },
    ],
    tests: [
      { name: 'Unknown barcode creates notification', status: 'partial', env: 'Manual' },
      { name: 'Invalid barcode validation', status: 'missing' },
      { name: 'Fragment detached during response', status: 'missing' },
    ],
  },
  {
    id: 'getNoDataCustomerBySequence',
    screen: 'task-list',
    action: 'Resolve No-Data Customer',
    trigger: 'Legacy short barcode ile red/gray label süreci başlatıldığında',
    method: 'POST',
    path: 'Shipment/GetNoDataCustomerBySequence',
    domain: 'shipment',
    requestModel: 'CustomerSequenceRangeRequest',
    responseModel: 'CustomerSequenceRangeResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core · Gray Label',
    summary:
      'Legacy kısa barkoddan çıkarılan sequence ve center code ile no-data shipment’ın gönderici müşterisini çözer; sonucu gray/red label veya scan-log akışına taşır.',
    preconditions: ['Barkod tipi LegacySystemShortBarcode olmalı', 'Sequence ve centerCode barkoddan çıkarılabilmeli', 'Offline mod kapalı olmalı'],
    postEffects: [
      'RS ülkesinde shipperCustomerId ile gray label süreci başlatılır',
      'Diğer ülkelerde shipperCustomerId ile SaveNoDataScanLog akışı çalışır',
      'CustomerQueryResult müşteri/adres/pricing bağlamını sonraki ekrana aktarabilir',
    ],
    chain: [
      { layer: 'action', label: 'Legacy short barcode taranır' },
      { layer: 'ui', label: 'TaskListFragment.checkRedLabelProcess()' },
      { layer: 'viewmodel', label: 'SharedViewModel.getNoDataCustomerBySequence()' },
      { layer: 'repository', label: 'MainRepository.getNoDataCustomerBySequence()' },
      { layer: 'api', label: 'POST Shipment/GetNoDataCustomerBySequence' },
      { layer: 'response', label: 'CustomerSequenceRangeResponse.payload.customerQueryResult' },
      { layer: 'state', label: 'Gray label veya no-data scan log' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'task_list/TaskListFragment.kt', method: 'checkRedLabelProcess() · :4091' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'getNoDataCustomerBySequence() · :3218' },
      { layer: 'Repository', file: 'main/MainRepository.kt', method: 'getNoDataCustomerBySequence() · :233' },
      { layer: 'Provider', file: 'network/ApiProvider.kt', method: 'getNoDataCustomerBySequence() · :232' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getNoDataCustomerBySequence() · :494' },
    ],
    requestFields: [
      { field: 'Sequence', type: 'Long?', required: 'yes', source: 'BarcodeUtils.extractSequenceFromLegacyShortBarcode()' },
      { field: 'CenterCode', type: 'Int?', required: 'yes', source: 'BarcodeUtils.extractCenterCodeFromLegacyShortBarcode()' },
    ],
    responseMapping: [
      { field: 'Payload.customerQueryResult.shipperCustomerId', destination: 'Gray label / SaveNoDataScanLog', action: 'Müşteri yetki ve akış seçimini belirler' },
      { field: 'Payload.customerQueryResult customer/contact/address fields', destination: 'GrayLabel bundle', action: 'Müşteri bağlamını sonraki ekrana taşır' },
      { field: 'ResultCode', destination: 'SharedViewModel Resource', action: 'SUCCESS/ERROR üretir' },
    ],
    errors: [
      { status: 'Offline', backend: 'Çağrı yapılmaz', mobile: 'Sadece debug log yazılır', user: 'No-data akışı ilerlemez' },
      { status: 'Parse error', backend: 'Çağrı yapılmaz', mobile: 'Barcode type/sequence doğrulaması başarısız', user: 'Müşteri bilgisi alınamadı' },
      { status: 'Business/network error', backend: 'Müşteri bulunamadı veya servis hatası', mobile: 'Resource.error', user: 'error_while_receiving_shipper_customer toast’ı' },
    ],
    tests: [
      { name: 'RS legacy barcode starts gray label', status: 'partial', env: 'Manual' },
      { name: 'Non-RS legacy barcode saves scan log', status: 'missing' },
      { name: 'Offline and malformed barcode guards', status: 'missing' },
    ],
  },
  {
    id: 'getCustomerBySequence',
    screen: 'gray-label',
    action: 'Resolve Customer by Sequence',
    trigger: 'Repository yüzeyi çağrıldığında; aktif UI/ViewModel çağıranı bulunamadı',
    method: 'POST',
    path: 'Customer/GetCustomerBySequence',
    domain: 'shipment',
    requestModel: 'CustomerSequenceRangeRequest',
    responseModel: 'CustomerSequenceRangeResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core · Gray Label',
    summary:
      'Sequence ve center code ile Customer servisinden müşteri bağlamını çözer. No-data varyantıyla aynı response modelini kullanır; aktif UI/ViewModel çağıranı yoktur.',
    preconditions: ['Sequence ve CenterCode değerleri elde edilmiş olmalı', 'Login tamamlanmış (Bearer token)'],
    postEffects: ['CustomerQueryResult müşteri, iletişim, adres ve pricing bağlamını çağıran katmana döndürür'],
    chain: [
      { layer: 'repository', label: 'MainRepository.getCustomerBySequence(request)' },
      { layer: 'repository', label: 'ApiProvider.getCustomerBySequence(request)' },
      { layer: 'api', label: 'POST Customer/GetCustomerBySequence' },
      { layer: 'response', label: 'CustomerSequenceRangeResponse.payload.customerQueryResult' },
    ],
    codeRefs: [
      { layer: 'Repository', file: 'main/MainRepository.kt', method: 'getCustomerBySequence() · :234' },
      { layer: 'Provider', file: 'network/ApiProvider.kt', method: 'getCustomerBySequence() · :233' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getCustomerBySequence() · :498' },
    ],
    requestFields: [
      { field: 'Sequence', type: 'Long?', required: 'yes', source: 'Çağıran katman / barcode parser' },
      { field: 'CenterCode', type: 'Int?', required: 'yes', source: 'Çağıran katman / barcode parser' },
    ],
    responseMapping: [
      { field: 'Payload.customerQueryResult.shipperCustomerId', destination: 'Repository caller', action: 'Müşteriyi tanımlar' },
      { field: 'Payload.customerQueryResult customer/contact/address/default/pricing fields', destination: 'Repository caller', action: 'Gray-label ve müşteri bağlamını sağlar' },
      { field: 'ResultCode / ResultMessage', destination: 'Repository caller', action: 'Çözümleme sonucunu taşır' },
    ],
    errors: [
      { status: '401', backend: 'Unauthorized / JWT', mobile: 'ErrorInterceptor → logout', user: 'Login ekranı' },
      { status: 'Not found / validation', backend: 'Sequence-center eşleşmesi yok', mobile: 'Response çağırana döner', user: 'Aktif UI çağıranı yok' },
      { status: 'Network', backend: 'Customer servisi ulaşılamadı', mobile: 'Exception çağırana yayılır', user: 'Aktif UI çağıranı yok' },
    ],
    tests: [
      { name: 'Known sequence resolves customer', status: 'missing' },
      { name: 'Unknown sequence response', status: 'missing' },
      { name: 'Invalid center code', status: 'missing' },
    ],
    notes: 'Orphan API surface: APIService → ApiProvider → MainRepository dışında aktif tüketici bulunmuyor.',
  },
  {
    id: 'getShipmentCreateInstantTaskServiceData',
    screen: 'stop-list',
    action: 'Prepare Instant Task',
    trigger: 'Stop List’te schedule’a yeni barkod ekleme taraması işlendiğinde',
    method: 'POST',
    path: 'Shipment/GetShipmentCreateInstantTaskServiceData',
    domain: 'shipment',
    requestModel: 'GetShipmentCreateInstantTaskRequest',
    responseModel: 'GetShipmentCreateInstantTaskResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core · Scan Pipeline',
    summary:
      'Taranan barkodları schedule’a eklemeden önce shipment verisini ve CreateInstantTask için kullanılacak dinamik JsonObject request’ini hazırlar.',
    preconditions: [
      'En az bir barcode mevcut olmalı',
      'Courier zone, courier kimliği ve branch bilgisi login payload/SP’den alınmış olmalı',
      'ScanProcessor işlemi online çalışabilmeli',
    ],
    postEffects: [
      'Payload string GetShipmentCreateInstantTaskPayload modeline parse edilir',
      'createInstantTaskRequestData sonraki CreateInstantTask çağrısına aktarılır',
      'isSuccess=false ve message varsa scan pipeline Warning durumuna geçer',
      'ResultCode 405 durumunda legacy ViewModel forceLoadedBarcodeList kaydını temizler',
    ],
    chain: [
      { layer: 'action', label: 'Yeni shipment barkodu taranır' },
      { layer: 'ui', label: 'ScanProcessor.process → fetchShipmentData()' },
      { layer: 'viewmodel', label: 'ScanApiClient.fetchShipmentData()' },
      { layer: 'repository', label: 'MainRepository.getShipmentCreateInstantTaskService()' },
      { layer: 'api', label: 'POST Shipment/GetShipmentCreateInstantTaskServiceData' },
      { layer: 'response', label: 'Payload JSON → GetShipmentCreateInstantTaskPayload' },
      { layer: 'state', label: 'Success / Warning / Error scan state' },
    ],
    codeRefs: [
      { layer: 'Pipeline', file: 'scan/ScanProcessor.kt', method: 'fetchShipmentData() call · :111' },
      { layer: 'Client', file: 'scan/ScanApiClient.kt', method: 'fetchShipmentData() · :26' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'addShipmentToSchedule() · :2436' },
      { layer: 'ViewModel', file: 'stop_list/StopViewModel.kt', method: 'addShipmentToSchedule() · :1773' },
      { layer: 'Repository', file: 'main/MainRepository.kt', method: 'getShipmentCreateInstantTaskService() · :236' },
      { layer: 'Provider', file: 'network/ApiProvider.kt', method: 'getShipmentCreateInstantTaskService() · :235' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getShipmentCreateInstantTaskServiceData() · :506' },
    ],
    requestFields: [
      { field: 'barcodeList', type: 'List<String>', required: 'yes', source: 'Scan queue / GetShipmentDetailsRequest', validation: 'En az bir barkod' },
      { field: 'courierZoneCode', type: 'String', required: 'yes', source: 'Courier context / request.route' },
      { field: 'courierName', type: 'String', required: 'yes', source: 'Login payload.courierName' },
      { field: 'courierUserId', type: 'String', required: 'yes', source: 'Login payload.courierUserId', sensitive: true },
      { field: 'branchId', type: 'Int', required: 'yes', source: 'Login payload.branchId; fallback -1' },
      { field: 'channelType', type: 'String', required: 'yes', source: 'ChannelType.Terminal.name / "Terminal"' },
    ],
    responseMapping: [
      { field: 'Payload.createInstantTaskRequestData', destination: 'ScanProcessor CREATE_TASK step', action: 'CreateInstantTask body’si olarak kullanılır' },
      { field: 'Payload.isSuccess', destination: 'ShipmentDataResult', action: 'Success veya Warning dalını seçer' },
      { field: 'Payload.message', destination: 'Scan UI warning', action: 'Backend uyarısını kullanıcı kararına sunar' },
      { field: 'ResultCode / ResultMessage', destination: 'ShipmentDataResult.Error', action: 'Business hatasını pipeline’a iletir' },
    ],
    errors: [
      { status: 'Payload parse', backend: 'Payload string döndü', mobile: 'toObject başarısız → Error("Cannot parse payload")', user: 'Tarama tamamlanamaz' },
      { status: '405', backend: 'Barkod eklenemez', mobile: 'Legacy akış forceLoadedBarcodeList’ten barkodu çıkarır', user: 'Backend mesajı' },
      { status: 'Network / null', backend: 'Servis ulaşılamadı veya null response', mobile: 'ShipmentDataResult.Error(isNetwork)', user: 'Retry/scan hata durumu' },
    ],
    tests: [
      { name: 'Scan returns instant-task request data', status: 'partial', env: 'Manual' },
      { name: 'Business warning preserves task request', status: 'missing' },
      { name: 'Malformed payload and network classification', status: 'missing' },
    ],
  },
  {
    id: 'createInstanceTask',
    screen: 'stop-list',
    action: 'Create Instant Task',
    trigger: 'Prepare Instant Task çağrısı geçerli taskRequest ürettikten ve varsa uyarı onaylandıktan sonra',
    method: 'POST',
    path: 'Task/CreateInstantTask',
    domain: 'schedule',
    requestModel: 'JsonObject',
    responseModel: 'CreateInstanceTaskResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core · Scan Pipeline',
    summary:
      'Shipment servisinin hazırladığı dinamik request ile schedule üzerinde anlık task/stop oluşturur; dönen stop listesini seçili stop ve schedule yenileme akışına taşır.',
    preconditions: [
      'getShipmentCreateInstantTaskServiceData geçerli JsonObject üretmiş olmalı',
      'Scan warning varsa kullanıcı devam etmeyi onaylamış olmalı',
      'Aktif schedule/courier bağlamı request içinde bulunmalı',
    ],
    postEffects: [
      'Payload.stops scan pipeline’a CreateTaskResult.Success olarak döner',
      'Legacy akış ilk stopId’yi SP.selectedStopId alanına yazar',
      'Stop listesi server’dan yeniden çekilerek Room/UI güncellenir',
      'PerfTrace CREATE_INSTANT_REQ/RESP ve automation event’leri kaydedilir',
    ],
    chain: [
      { layer: 'action', label: 'Prepared instant task onaylanır' },
      { layer: 'ui', label: 'ScanProcessor CREATE_TASK step' },
      { layer: 'viewmodel', label: 'ScanApiClient.createInstantTask()' },
      { layer: 'repository', label: 'MainRepository.createInstanceTask()' },
      { layer: 'api', label: 'POST Task/CreateInstantTask' },
      { layer: 'response', label: 'CreateInstanceTaskResponse.payload.stops' },
      { layer: 'state', label: 'Schedule refresh / selectedStopId / next scan' },
    ],
    codeRefs: [
      { layer: 'Pipeline', file: 'scan/ScanProcessor.kt', method: 'createInstantTask() call · :356' },
      { layer: 'Client', file: 'scan/ScanApiClient.kt', method: 'createInstantTask() · :64' },
      { layer: 'Legacy UI', file: 'stop_list/StopListFragment.kt', method: 'createInstanceTaskAndThenContinue() · :4246' },
      { layer: 'ViewModel', file: 'stop_list/StopViewModel.kt', method: 'createInstanceTask() · :1834' },
      { layer: 'Repository', file: 'main/MainRepository.kt', method: 'createInstanceTask() · :237' },
      { layer: 'Provider', file: 'network/ApiProvider.kt', method: 'createInstanceTask() · :236' },
      { layer: 'API', file: 'network/APIService.kt', method: 'createInstanceTask() · :510' },
    ],
    requestFields: [
      { field: 'dynamic task request JSON', type: 'JsonObject', required: 'yes', source: 'GetShipmentCreateInstantTaskPayload.createInstantTaskRequestData', validation: 'Backend tarafından üretilen yapı bozulmadan iletilmeli', sensitive: true },
    ],
    responseMapping: [
      { field: 'Payload.stops[]', destination: 'ScanProcessor / Stop List', action: 'Yeni stopları döndürür ve schedule refresh’i tetikler' },
      { field: 'Payload.stops[0].stopId', destination: 'SP.selectedStopId (legacy)', action: 'Yeni oluşturulan stopu seçer' },
      { field: 'Payload.code / message', destination: 'CreateTaskResult / Resource', action: 'İş kuralı sonucunu taşır' },
      { field: 'Payload.expectedZoneCode / actualZoneCode', destination: 'Error context', action: 'Zone uyuşmazlığını açıklar' },
    ],
    errors: [
      { status: 'Business error', backend: 'Task oluşturulamadı / zone uyuşmazlığı', mobile: 'CreateTaskResult.Error veya Resource.error(code)', user: 'Backend hata mesajı' },
      { status: 'Null response', backend: 'Body alınamadı', mobile: 'Error("Null response", -1)', user: 'Tarama başarısız' },
      { status: 'Network / exception', backend: 'Task servisi ulaşılamadı', mobile: 'Error(isNetwork=true)', user: 'Retry/scan hata durumu' },
    ],
    tests: [
      { name: 'Instant task creates stops and refreshes schedule', status: 'partial', env: 'Manual' },
      { name: 'Zone mismatch exposes expected/actual zone', status: 'missing' },
      { name: 'Network retry does not duplicate task', status: 'missing' },
    ],
  },
  {
    id: 'getCustomersPreferences',
    screen: 'delivery',
    action: 'Resolve Card Payment Preference',
    trigger: 'Teslimat, task veya locker akışında müşteriye kredi kartı seçeneği gösterilmeden önce',
    method: 'POST',
    path: 'Customer/GetCustomersPreferences',
    domain: 'payment',
    requestModel: 'CustomerPreferencesRequest',
    responseModel: 'CustomerPreferencesResponse',
    auth: true,
    offline: false,
    status: 'reviewed',
    lastChecked: '19 Tem 2026',
    owner: 'Mobile Core · Payment',
    summary:
      'Müşteri bazlı kredi kartı ödeme iznini getirir; sonucu process-lifetime ConcurrentHashMap cache’inde saklayıp ödeme butonu ve locker uygunluk kararlarında kullanır.',
    preconditions: [
      'Geçerli sender customerId elde edilmiş olmalı',
      'ME ülkesi dışındaki desteklenen akışta olunmalı',
      'Aynı customerId için cache miss olmalı; cache hit’te API çağrılmaz',
    ],
    postEffects: [
      'isCreditCardPaymentEnabled boolean değeri customerCardPaymentCache’e yazılır',
      'true ise kredi kartı ödeme aksiyonu gösterilebilir',
      'Locker müşteri kontrollerinde tüm ilgili customerId’lerin kart tercihi doğrulanır',
      'Exception durumunda fail-closed olarak false cache’lenir',
    ],
    chain: [
      { layer: 'action', label: 'Payment/locker eligibility hesaplanır' },
      { layer: 'ui', label: 'DeliveryFragment / StopListFragment / TaskListFragment' },
      { layer: 'viewmodel', label: 'SharedViewModel.canCustomerPayByCard()' },
      { layer: 'repository', label: 'MainRepository.getCustomersPreferences()' },
      { layer: 'api', label: 'POST Customer/GetCustomersPreferences' },
      { layer: 'response', label: 'customerPreferences[].preferences.isCreditCardPaymentEnabled' },
      { layer: 'state', label: 'In-memory cache + payment/locker UI decision' },
    ],
    codeRefs: [
      { layer: 'UI', file: 'delivery/DeliveryFragment.kt', method: 'canCustomerPayByCard() call · :1749' },
      { layer: 'UI', file: 'stop_list/StopListFragment.kt', method: 'checkCustomerCardPreference() · :6793' },
      { layer: 'UI', file: 'task_list/TaskListFragment.kt', method: 'canCustomerPayByCard() calls · :2389/:3573/:3978/:4545' },
      { layer: 'ViewModel', file: 'main/SharedViewModel.kt', method: 'canCustomerPayByCard() · :3248' },
      { layer: 'Repository', file: 'main/MainRepository.kt', method: 'getCustomersPreferences() · :238' },
      { layer: 'Provider', file: 'network/ApiProvider.kt', method: 'getCustomersPreferences() · :237' },
      { layer: 'API', file: 'network/APIService.kt', method: 'getCustomersPreferences() · :514' },
    ],
    requestFields: [
      { field: 'customerIds', type: 'List<CustomerIdBlock>', required: 'yes', source: 'Shipment senderCustomerId list', validation: 'En az bir customerId' },
      { field: 'customerIds[].CustomerId', type: 'Long', required: 'yes', source: 'senderCustomerId.toLongOrNull()', sensitive: true },
    ],
    responseMapping: [
      { field: 'Payload.customerPreferences[].customerId', destination: 'Preference matcher', action: 'İstenen müşteri kaydını seçer' },
      { field: 'Payload.customerPreferences[].preferences.isCreditCardPaymentEnabled', destination: 'customerCardPaymentCache', action: 'Kart ödeme uygunluğunu cache’ler' },
      { field: 'Resolved boolean', destination: 'Delivery/Task/Locker UI', action: 'Kart butonu veya uygunluk akışını açar/kapatır' },
    ],
    errors: [
      { status: 'Cache hit', backend: 'Çağrı yapılmaz', mobile: 'ConcurrentHashMap değeri anında döner', user: 'Beklemeden karar verilir' },
      { status: 'Missing preference', backend: 'Müşteri kaydı/alan yok', mobile: '== true ifadesi false üretir ve cache’ler', user: 'Kart seçeneği gösterilmez' },
      { status: 'Network / exception', backend: 'Customer servisi ulaşılamadı', mobile: 'Catch → false cache + Resource.success(false)', user: 'Kart seçeneği fail-closed gizlenir' },
    ],
    tests: [
      { name: 'Enabled customer sees card option', status: 'partial', env: 'Manual' },
      { name: 'Cache prevents duplicate customer request', status: 'missing' },
      { name: 'Exception fails closed and caches false', status: 'missing' },
    ],
    notes: 'Exception Resource.error yerine success(false) üretir; ödeme kullanılabilirliği fail-closed tasarlanmıştır.',
  },
]

// ─── Derived helpers ────────────────────────────────────────────────────────

export function screenById(id: string): AtlasScreen | undefined {
  return ATLAS_SCREENS.find((s) => s.id === id)
}

export function contractsForScreen(screenId: string): AtlasContract[] {
  return ATLAS_CONTRACTS.filter((c) => c.screen === screenId)
}

/** Fields that drive visible drawer sections and therefore define documentation completeness. */
export function contractHasDocumentationGaps(c: AtlasContract): boolean {
  return (
    c.status === 'detected' ||
    c.status === 'draft' ||
    !c.summary ||
    !c.trigger ||
    !c.lastChecked ||
    !c.owner ||
    !c.preconditions?.length ||
    !c.postEffects?.length ||
    !c.chain?.length ||
    !c.codeRefs?.length ||
    !c.requestFields?.length ||
    !c.responseMapping?.length ||
    !c.errors?.length ||
    !c.tests?.length
  )
}

export function atlasKpis() {
  const documented = ATLAS_CONTRACTS.length
  const verified = ATLAS_CONTRACTS.filter((c) => c.status === 'verified').length
  const offline = ATLAS_CONTRACTS.filter((c) => c.offline).length
  const mismatch = ATLAS_CONTRACTS.filter((c) => c.status === 'mismatch').length
  const detectedOnly = ATLAS_CONTRACTS.filter(contractHasDocumentationGaps).length
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
  { id: 'undocumented', label: 'Dokümantasyon eksik', match: contractHasDocumentationGaps },
  { id: 'mismatch', label: 'Contract riski', match: (c) => c.status === 'mismatch' || c.status === 'deprecated' },
  { id: 'multipart', label: 'Multipart', match: (c) => c.method === 'MULTIPART' },
  { id: 'verified', label: 'Verified', match: (c) => c.status === 'verified' },
]
