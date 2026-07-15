// Graylog Query Generator — all mock data and constants.
// UI texts and technical terms are in English; query contents are in Graylog syntax.

import type { Tone } from '@/components/product'

// ── Scenario chips ────────────────────────────────────────────

export type ScenarioChip = {
  id: string
  label: string
  /** Natural language request placed in textarea when chip is clicked. */
  text: string
}

export const SCENARIO_CHIPS: ScenarioChip[] = [
  {
    id: 'shipment-flow',
    label: 'Track shipment flow',
    text: 'Show delivery, fiscal, and retry logs generated in the last 2 hours for Shipment 45-40-20251224-1.',
  },
  {
    id: 'courier-login',
    label: 'Courier login problem',
    text: 'List this morning\'s login attempts and authentication errors for Courier 3021; include token refresh logs.',
  },
  {
    label: 'Search fiscal error code',
    id: 'fiscal-error',
    text: 'Show fiscal service logs generating FISCAL_TIMEOUT or FISCAL_DUPLICATE error code in the last 6 hours for Croatia.',
  },
  {
    id: 'offline-queue',
    label: 'Offline queue requests',
    text: 'Get offline request logs waiting or falling into retry status in RequestSenderService queue for the last 1 hour.',
  },
  {
    id: 'barcode-scan',
    label: 'Barcode scan logs',
    text: 'Show barcode scan events and errors occurring after scan on Device NX-4412 for the last 15 minutes.',
  },
  {
    id: 'd4me-callback',
    label: 'D4Me callback chain',
    text: 'Show D4Me locker callback chain for Shipment 45-40-20251218-7; match callback_received and callback_processed events.',
  },
  {
    id: 'device-crash',
    label: 'Pre-crash logs on specific device',
    text: 'Get all application logs in chronological order for the 10 minutes before the last crash on Device NX-2087.',
  },
  {
    id: 'api-401',
    label: 'API 401 and logout flow',
    text: 'Group API calls returning 401 and immediately following logout events by courier in the last 1 hour.',
  },
]

// ── Query context options ────────────────────────────────────

export type SelectOption = { value: string; label: string }

export const ENVIRONMENTS: SelectOption[] = [
  { value: 'uat', label: 'UAT' },
  { value: 'production', label: 'Production' },
]

export const COUNTRIES: SelectOption[] = [
  { value: 'HR', label: 'HR — Croatia' },
  { value: 'SI', label: 'SI — Slovenia' },
  { value: 'RS', label: 'RS — Serbia' },
  { value: 'BA', label: 'BA — Bosnia and Herzegovina' },
  { value: 'ME', label: 'ME — Montenegro' },
]

export const APPLICATIONS: SelectOption[] = [
  { value: 'nesy-mobile', label: 'nesy-mobile' },
  { value: 'nesy-backend', label: 'nesy-backend' },
  { value: 'nesy-fiscal', label: 'nesy-fiscal' },
  { value: 'nesy-d4me', label: 'nesy-d4me' },
]

export const SERVICES: SelectOption[] = [
  { value: 'any', label: 'All' },
  { value: 'RequestSenderService', label: 'RequestSenderService' },
  { value: 'DeliveryService', label: 'DeliveryService' },
  { value: 'FiscalService', label: 'FiscalService' },
  { value: 'AuthService', label: 'AuthService' },
  { value: 'LocationService', label: 'LocationService' },
  { value: 'NotificationService', label: 'NotificationService' },
]

export const LOG_LEVELS: SelectOption[] = [
  { value: 'any', label: 'All' },
  { value: 'error', label: 'ERROR' },
  { value: 'warn', label: 'WARN' },
  { value: 'info', label: 'INFO' },
  { value: 'debug', label: 'DEBUG' },
]

export const TIME_RANGES: SelectOption[] = [
  { value: '15m', label: 'Last 15 minutes' },
  { value: '1h', label: 'Last 1 hour' },
  { value: '6h', label: 'Last 6 hours' },
  { value: '24h', label: 'Last 24 hours' },
  { value: 'custom', label: 'Custom' },
]

/** Default time range in Production — limits broad search costs. */
export const PRODUCTION_DEFAULT_TIME_RANGE = '1h'

export const DEVICES: SelectOption[] = [
  { value: 'any', label: 'All' },
  { value: 'NX-4412', label: 'NX-4412' },
  { value: 'NX-2087', label: 'NX-2087' },
  { value: 'NX-3155', label: 'NX-3155' },
]

export const APP_VERSIONS: SelectOption[] = [
  { value: 'any', label: 'All' },
  { value: '4.12.0', label: '4.12.0' },
  { value: '4.11.2', label: '4.11.2' },
  { value: '4.10.5', label: '4.10.5' },
]

// ── Known identifiers ────────────────────────────────────────────

export type IdentifierField = {
  key: string
  label: string
  placeholder: string
}

export const IDENTIFIER_FIELDS: IdentifierField[] = [
  { key: 'shipmentId', label: 'Shipment ID', placeholder: '45-40-20251224-1' },
  { key: 'courierId', label: 'Courier ID', placeholder: '3021' },
  { key: 'scheduleId', label: 'Schedule ID', placeholder: 'SCH-2025-8841' },
  { key: 'requestId', label: 'Request ID', placeholder: 'req_9f3c1a72' },
  { key: 'deviceId', label: 'Device ID', placeholder: 'NX-4412' },
  { key: 'fiscalId', label: 'Fiscal ID', placeholder: 'FIS-HR-338291' },
  { key: 'errorCode', label: 'Error code', placeholder: 'FISCAL_TIMEOUT' },
  { key: 'customerTicketId', label: 'Customer ticket ID', placeholder: 'CT-10592' },
]

// ── Log sources ───────────────────────────────────────────────

export type LogSource = { id: string; label: string }

export const LOG_SOURCES: LogSource[] = [
  { id: 'mobile', label: 'Mobile application' },
  { id: 'backend', label: 'Backend API' },
  { id: 'fiscal', label: 'Fiscal service' },
  { id: 'd4me', label: 'D4Me / Locker' },
  { id: 'notification', label: 'Notification' },
  { id: 'location', label: 'Location service' },
  { id: 'offline-queue', label: 'Offline queue' },
  { id: 'auth', label: 'Authentication' },
]

// ── Guardrail messages ──────────────────────────────────────────

export const GUARDRAIL_BROAD_SCOPE =
  'This search can generate a very broad log volume. Narrow the scope by adding a service, country, or identifier.'

export const GUARDRAIL_SOFT_HINTS = [
  'The query can work, but it looks very broad.',
  'For faster results, add one of the shipmentId, requestId, or service fields.',
]

// ── Generated query (mock) ────────────────────────────────────────

export const GENERATED_QUERY = `application:nesy-mobile
AND country:HR
AND shipmentId:"45-40-20251224-1"
AND (
  event:delivery
  OR event:fiscal
  OR service:RequestSenderService
)`

export type QueryBreakdownRow = {
  part: string
  explanation: string
  tone: Tone
}

export const QUERY_BREAKDOWN: QueryBreakdownRow[] = [
  {
    part: 'application:nesy-mobile',
    explanation: 'Limits to logs coming from Nesy Mobile application.',
    tone: 'blue',
  },
  {
    part: 'country:HR',
    explanation: 'Returns only Croatia records.',
    tone: 'teal',
  },
  {
    part: 'shipmentId:"45-40-20251224-1"',
    explanation: 'Searches all associated logs of a specific shipment.',
    tone: 'indigo',
  },
  {
    part: '(event:delivery OR event:fiscal OR service:RequestSenderService)',
    explanation: 'Shows the delivery, fiscal, and offline retry chain together.',
    tone: 'orange',
  },
]

// ── Expected signals ─────────────────────────────────────────────

export const EXPECTED_EVENT_SEQUENCE: string[] = [
  'delivery_started',
  'payment_completed',
  'fiscal_created',
  'delivery_saved',
  'request_completed',
]

export type AnomalyExample = {
  title: string
  description: string
}

export const ANOMALY_EXAMPLES: AnomalyExample[] = [
  {
    title: 'payment_completed exists, delivery_saved does not',
    description:
      'Payment completed but delivery record not created — check the possibility of offline queue or isProcessing lock.',
  },
  {
    title: 'request_started exists, request_completed does not',
    description:
      'Request chain left half-way; same requestId should be searched in RequestSenderService retry logs.',
  },
  {
    title: 'Same fiscal_created twice',
    description:
      'Duplicate fiscal record — retry mechanism trying again without idempotency is typical reason.',
  },
  {
    title: 'Logout after 401',
    description:
      'When token expires, user silently drops from session; match with AuthService refresh logs.',
  },
  {
    title: 'isProcessing remained true',
    description:
      'Transaction flag not reset; all subsequent transactions might be silently blocked — check the last event before crash.',
  },
]

// ── Query quality ────────────────────────────────────────────────

export type QualityCheck = {
  label: string
  value: string
  tone: Tone
}

export const QUALITY_CHECKS: QualityCheck[] = [
  { label: 'Syntax valid', value: 'Graylog syntax verified', tone: 'green' },
  { label: 'Time range valid', value: 'Last 1 hour — acceptable', tone: 'green' },
  { label: 'Search scope', value: 'Single application · single country', tone: 'green' },
  { label: 'Identifier strength', value: 'shipmentId — strong narrower', tone: 'green' },
  { label: 'Expected volume', value: '~150-400 rows', tone: 'blue' },
  { label: 'Sensitive data', value: 'PII fields masked', tone: 'gray' },
]

export type QualityVerdict = {
  label: string
  tone: Tone
  explanation: string
}

export const QUALITY_VERDICT_STRONG: QualityVerdict = {
  label: 'Query quality: Strong',
  tone: 'green',
  explanation:
    'Search scope is narrow enough because Shipment ID, country, and time range are used together.',
}

export const QUALITY_VERDICT_BROAD: QualityVerdict = {
  label: 'Query quality: Broad',
  tone: 'amber',
  explanation: "Only 'error' word is searched. Adding a service or identifier is recommended.",
}

// ── Common Graylog fields ────────────────────────────────────────

export type GraylogField = {
  field: string
  meaning: string
  example: string
  source: string
}

export const GRAYLOG_FIELDS: GraylogField[] = [
  {
    field: 'shipmentId',
    meaning: "Gönderinin benzersiz kimliği — delivery, fiscal ve retry loglarını tek zincirde bağlar.",
    example: '45-40-20251224-1',
    source: 'Mobile · Backend · Fiscal',
  },
  {
    field: 'courierId',
    meaning: 'Kuryenin kimliği — login, vardiya ve teslimat loglarını kişi bazında filtreler.',
    example: '3021',
    source: 'Mobile · Authentication',
  },
  {
    field: 'scheduleId',
    meaning: 'Vardiya/rota planının kimliği — aynı vardiyadaki tüm shipment loglarını gruplar.',
    example: 'SCH-2025-8841',
    source: 'Backend',
  },
  {
    field: 'requestId',
    meaning: 'Offline queue request kimliği — retry zincirindeki her denemeyi eşleştirir.',
    example: 'req_9f3c1a72',
    source: 'Offline queue · Backend',
  },
  {
    field: 'fiscalId',
    meaning: 'Fiscal kaydın kimliği — duplicate fiscal ve timeout araştırmalarının anahtarı.',
    example: 'FIS-HR-338291',
    source: 'Fiscal service',
  },
  {
    field: 'errorCode',
    meaning: 'Standart hata kodu — hata ailesine göre filtreleme sağlar.',
    example: 'FISCAL_TIMEOUT',
    source: 'Tüm servisler',
  },
  {
    field: 'appVersion',
    meaning: 'Mobil uygulama sürümü — sürüm bazlı regresyon araştırmalarında kullanılır.',
    example: '4.12.0',
    source: 'Mobile',
  },
  {
    field: 'country',
    meaning: 'Operasyon ülkesi (ISO kodu) — log hacmini ülke bazında daraltır.',
    example: 'HR',
    source: 'Tüm servisler',
  },
]

// ── Saved investigations ─────────────────────────────────────────

export type SavedInvestigation = {
  id: string
  name: string
  purpose: string
  country: string
  timeRange: string
  relatedIncident: string
  createdBy: string
  lastUsed: string
  objective: string
  query: string
  expectedEventChain: string[]
  knownAnomalies: string[]
  relatedTickets: string[]
  rootCause: string
  edgeCase: string
}

export const SAVED_INVESTIGATIONS: SavedInvestigation[] = [
  {
    id: 'inv-double-fiscal',
    name: 'Double fiscal investigation',
    purpose: 'Aynı shipment için iki fiscal_created kaydının kaynağını bulmak',
    country: 'HR',
    timeRange: 'Last 6 hours',
    relatedIncident: 'INC-2025-114',
    createdBy: 'M. Kovačić',
    lastUsed: '2 gün önce',
    objective:
      'Retry mekanizmasının idempotency kontrolü olmadan fiscal isteğini tekrar gönderdiği durumları yakalamak. Aynı shipmentId altında birden fazla fiscal_created eventi arıyoruz.',
    query: `application:nesy-fiscal
AND country:HR
AND event:fiscal_created
AND shipmentId:*
| aggregate count by shipmentId having count > 1`,
    expectedEventChain: ['payment_completed', 'fiscal_requested', 'fiscal_created', 'fiscal_confirmed'],
    knownAnomalies: [
      'fiscal_created eventi aynı shipmentId için 2+ kez',
      'İkinci kayıt genelde retry sonrası 30–90 sn içinde',
    ],
    relatedTickets: ['FT-031', 'CT-10233'],
    rootCause: 'RequestSenderService retry\'ı fiscal isteğini idempotency key olmadan tekrar gönderiyor.',
    edgeCase: 'Zayıf sinyalde timeout süresi dolmadan yanıt gelirse hem orijinal hem retry başarılı sayılıyor.',
  },
  {
    id: 'inv-silent-logout',
    name: 'Silent logout during shift',
    purpose: 'Vardiya ortasında sessiz logout yaşayan kuryeleri tespit etmek',
    country: 'SI',
    timeRange: 'Last 24 hours',
    relatedIncident: 'INC-2025-098',
    createdBy: 'A. Novak',
    lastUsed: '5 saat önce',
    objective:
      '401 sonrası refresh denemesi olmadan logout\'a düşen oturumları bulmak. Kurye fark etmeden oturum kapandığı için teslimatlar offline kuyruğa yığılıyor.',
    query: `application:nesy-mobile
AND country:SI
AND (statusCode:401 OR event:logout)
AND courierId:*
| sort timestamp asc`,
    expectedEventChain: ['token_expired', 'token_refresh_attempted', 'token_refreshed'],
    knownAnomalies: ['401 sonrası token_refresh_attempted eventi yok', 'logout eventi vardiya saatleri içinde'],
    relatedTickets: ['FT-018', 'CT-10471'],
    rootCause: 'Refresh token mekanizması yok; access token süresi dolunca oturum sessizce düşüyor.',
    edgeCase: 'Cihaz saati kaymışsa token, sunucuya göre erken expire oluyor.',
  },
  {
    id: 'inv-zombie-queue',
    name: 'Zombie request queue',
    purpose: 'Kuyrukta başlamış ama hiç tamamlanmamış request zincirlerini bulmak',
    country: 'HR',
    timeRange: 'Last 24 hours',
    relatedIncident: 'INC-2025-121',
    createdBy: 'G. Öncü',
    lastUsed: 'Dün',
    objective:
      'request_started olup request_completed veya request_failed üretmeyen kayıtları tespit etmek. Bu zincirler kuyruğu sessizce bloklar ve sonraki teslimatlar gecikir.',
    query: `service:RequestSenderService
AND country:HR
AND event:request_started
NOT event:request_completed
| aggregate count by requestId`,
    expectedEventChain: ['request_queued', 'request_started', 'request_completed'],
    knownAnomalies: ['request_started sonrası 10+ dk sessizlik', 'isProcessing true kalmış kayıtlar'],
    relatedTickets: ['FT-027'],
    rootCause: 'İşlem sırasında crash olduğunda isProcessing bayrağı sıfırlanmıyor; kuyruk kilitleniyor.',
    edgeCase: 'Uygulama arka plandayken OS process\'i öldürürse finally bloğu hiç çalışmıyor.',
  },
  {
    id: 'inv-barcode-crash',
    name: 'Barcode scan crash',
    purpose: 'Scan ekranında crash öncesi log desenini çıkarmak',
    country: 'RS',
    timeRange: 'Last 6 hours',
    relatedIncident: 'INC-2025-107',
    createdBy: 'D. Petrović',
    lastUsed: '3 gün önce',
    objective:
      'Belirli cihaz modellerinde barcode scan sonrası gelen crash\'lerin öncesindeki son eventleri toplamak; kamera buffer hatası şüphesi doğrulanacak.',
    query: `application:nesy-mobile
AND country:RS
AND event:barcode_scan
AND deviceId:NX-2087
| sort timestamp desc | limit 200`,
    expectedEventChain: ['scan_opened', 'barcode_scan', 'scan_validated', 'shipment_loaded'],
    knownAnomalies: ['barcode_scan sonrası scan_validated gelmeden log kesiliyor', 'Aynı cihazda tekrarlayan desen'],
    relatedTickets: ['FT-035', 'CT-10518'],
    rootCause: 'Düşük bellekli cihazlarda kamera buffer\'ı serbest bırakılmadan ikinci scan açılıyor.',
    edgeCase: 'Arka arkaya hızlı çift scan (double tap) crash olasılığını belirgin artırıyor.',
  },
  {
    id: 'inv-d4me-mismatch',
    name: 'D4Me callback mismatch',
    purpose: 'Locker callback\'i ile shipment durumunun uyuşmadığı vakaları bulmak',
    country: 'HR',
    timeRange: 'Last 24 hours',
    relatedIncident: 'INC-2025-119',
    createdBy: 'M. Kovačić',
    lastUsed: '1 hafta önce',
    objective:
      'D4Me callback_received eventi geldiği halde shipment durumu güncellenmeyen kayıtları yakalamak; callback sıralaması veya duplicate delivery şüphesi var.',
    query: `application:nesy-d4me
AND country:HR
AND event:callback_received
NOT event:callback_processed
| aggregate count by shipmentId`,
    expectedEventChain: ['locker_reserved', 'parcel_deposited', 'callback_received', 'callback_processed'],
    knownAnomalies: ['callback_received var, callback_processed yok', 'Aynı shipment için farklı locker kodu'],
    relatedTickets: ['FT-022', 'CT-10390'],
    rootCause: 'Callback işleyicisi out-of-order mesajlarda erken return ediyor; durum makinesi güncellenmiyor.',
    edgeCase: 'Locker ağ bağlantısı koptuğunda callback\'ler toplu ve sırasız geliyor.',
  },
]
