// Graylog Query Generator — tüm mock veri ve sabitler.
// UI metinleri Türkçe, teknik terimler İngilizce; sorgu içerikleri Graylog syntax'ında.

import type { Tone } from '@/components/product'

// ── Senaryo chip'leri ────────────────────────────────────────────

export type ScenarioChip = {
  id: string
  label: string
  /** Chip tıklanınca textarea'ya yerleşen doğal dil isteği. */
  text: string
}

export const SCENARIO_CHIPS: ScenarioChip[] = [
  {
    id: 'shipment-flow',
    label: 'Shipment akışını takip et',
    text: 'Shipment 45-40-20251224-1 için son 2 saatte oluşan delivery, fiscal ve retry loglarını göster.',
  },
  {
    id: 'courier-login',
    label: 'Courier login problemi',
    text: 'Courier 3021 için bu sabahki login denemelerini ve authentication hatalarını listele; token refresh loglarını da dahil et.',
  },
  {
    id: 'fiscal-error',
    label: 'Fiscal hata kodu ara',
    text: 'Son 6 saatte FISCAL_TIMEOUT veya FISCAL_DUPLICATE hata kodu üreten fiscal service loglarını Hırvatistan için göster.',
  },
  {
    id: 'offline-queue',
    label: 'Offline queue request\'leri',
    text: 'RequestSenderService kuyruğunda bekleyen veya retry durumuna düşen offline request loglarını son 1 saat için getir.',
  },
  {
    id: 'barcode-scan',
    label: 'Barcode scan logları',
    text: 'Device NX-4412 üzerinde barcode scan eventlerini ve scan sonrası oluşan hataları son 15 dakika için göster.',
  },
  {
    id: 'd4me-callback',
    label: 'D4Me callback zinciri',
    text: 'Shipment 45-40-20251218-7 için D4Me locker callback zincirini göster; callback_received ve callback_processed eventlerini eşleştir.',
  },
  {
    id: 'device-crash',
    label: 'Belirli cihazdaki crash öncesi loglar',
    text: 'Device NX-2087 üzerinde son crash öncesindeki 10 dakikalık tüm application loglarını kronolojik sırayla getir.',
  },
  {
    id: 'api-401',
    label: 'API 401 ve logout akışı',
    text: 'Son 1 saatte 401 dönen API çağrılarını ve hemen ardından gelen logout eventlerini courier bazında grupla.',
  },
]

// ── Query context seçenekleri ────────────────────────────────────

export type SelectOption = { value: string; label: string }

export const ENVIRONMENTS: SelectOption[] = [
  { value: 'uat', label: 'UAT' },
  { value: 'production', label: 'Production' },
]

export const COUNTRIES: SelectOption[] = [
  { value: 'HR', label: 'HR — Hırvatistan' },
  { value: 'SI', label: 'SI — Slovenya' },
  { value: 'RS', label: 'RS — Sırbistan' },
  { value: 'BA', label: 'BA — Bosna Hersek' },
  { value: 'ME', label: 'ME — Karadağ' },
]

export const APPLICATIONS: SelectOption[] = [
  { value: 'nesy-mobile', label: 'nesy-mobile' },
  { value: 'nesy-backend', label: 'nesy-backend' },
  { value: 'nesy-fiscal', label: 'nesy-fiscal' },
  { value: 'nesy-d4me', label: 'nesy-d4me' },
]

export const SERVICES: SelectOption[] = [
  { value: 'any', label: 'Tümü' },
  { value: 'RequestSenderService', label: 'RequestSenderService' },
  { value: 'DeliveryService', label: 'DeliveryService' },
  { value: 'FiscalService', label: 'FiscalService' },
  { value: 'AuthService', label: 'AuthService' },
  { value: 'LocationService', label: 'LocationService' },
  { value: 'NotificationService', label: 'NotificationService' },
]

export const LOG_LEVELS: SelectOption[] = [
  { value: 'any', label: 'Tümü' },
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

/** Production'da varsayılan zaman aralığı — geniş arama maliyetini sınırlar. */
export const PRODUCTION_DEFAULT_TIME_RANGE = '1h'

export const DEVICES: SelectOption[] = [
  { value: 'any', label: 'Tümü' },
  { value: 'NX-4412', label: 'NX-4412' },
  { value: 'NX-2087', label: 'NX-2087' },
  { value: 'NX-3155', label: 'NX-3155' },
]

export const APP_VERSIONS: SelectOption[] = [
  { value: 'any', label: 'Tümü' },
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

// ── Log kaynakları ───────────────────────────────────────────────

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

// ── Guardrail mesajları ──────────────────────────────────────────

export const GUARDRAIL_BROAD_SCOPE =
  'Bu arama çok geniş bir log hacmi oluşturabilir. Servis, ülke veya identifier ekleyerek kapsamı daralt.'

export const GUARDRAIL_SOFT_HINTS = [
  'Sorgu çalışabilir, ancak çok geniş kapsamlı görünüyor.',
  'Daha hızlı sonuç için shipmentId, requestId veya service alanlarından birini ekle.',
]

// ── Üretilen sorgu (mock) ────────────────────────────────────────

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
    explanation: 'Nesy Mobile uygulamasından gelen loglarla sınırlar.',
    tone: 'blue',
  },
  {
    part: 'country:HR',
    explanation: 'Yalnızca Hırvatistan kayıtlarını getirir.',
    tone: 'teal',
  },
  {
    part: 'shipmentId:"45-40-20251224-1"',
    explanation: "Belirli shipment'ın tüm ilişkilendirilmiş loglarını arar.",
    tone: 'indigo',
  },
  {
    part: '(event:delivery OR event:fiscal OR service:RequestSenderService)',
    explanation: 'Delivery, fiscal ve offline retry zincirini birlikte gösterir.',
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
    title: 'payment_completed var, delivery_saved yok',
    description:
      'Ödeme tamamlanmış ama teslimat kaydı oluşmamış — offline queue veya isProcessing kilitlenmesi ihtimalini kontrol et.',
  },
  {
    title: 'request_started var, request_completed yok',
    description:
      'Request zinciri yarıda kalmış; RequestSenderService retry loglarında aynı requestId aranmalı.',
  },
  {
    title: 'Aynı fiscal_created iki kez',
    description:
      'Duplicate fiscal kaydı — retry mekanizmasının idempotency olmadan tekrar denemesi tipik nedendir.',
  },
  {
    title: '401 sonrası logout',
    description:
      'Token süresi dolduğunda kullanıcı sessizce oturumdan düşüyor; AuthService refresh loglarıyla eşleştir.',
  },
  {
    title: 'isProcessing true kalmış',
    description:
      'İşlem bayrağı sıfırlanmamış; sonraki tüm işlemler sessizce bloklanıyor olabilir — crash öncesi son event\'e bak.',
  },
]

// ── Query quality ────────────────────────────────────────────────

export type QualityCheck = {
  label: string
  value: string
  tone: Tone
}

export const QUALITY_CHECKS: QualityCheck[] = [
  { label: 'Syntax valid', value: 'Graylog syntax doğrulandı', tone: 'green' },
  { label: 'Time range valid', value: 'Last 1 hour — kabul edilebilir', tone: 'green' },
  { label: 'Search scope', value: 'Tek uygulama · tek ülke', tone: 'green' },
  { label: 'Identifier strength', value: 'shipmentId — güçlü daraltıcı', tone: 'green' },
  { label: 'Expected volume', value: '~150–400 satır', tone: 'blue' },
  { label: 'Sensitive data', value: 'PII alanları maskelendi', tone: 'gray' },
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
    'Shipment ID, country ve zaman aralığı birlikte kullanıldığı için arama kapsamı yeterince dar.',
}

export const QUALITY_VERDICT_BROAD: QualityVerdict = {
  label: 'Query quality: Broad',
  tone: 'amber',
  explanation: "Yalnızca 'error' kelimesi aranıyor. Servis veya identifier eklenmesi önerilir.",
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
