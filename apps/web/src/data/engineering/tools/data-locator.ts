// Data Locator mock verisi — "Where does this data live?"
// Veri kaynakları kataloğu, arama intent'leri, lineage zincirleri,
// investigation recipe'leri ve guardrail metinleri tek dosyada.

import type { Tone } from '@/components/product'

// ── Sınıflandırmalar ─────────────────────────────────────────────

export type SourceType =
  | 'MongoDB Collection'
  | 'SQL Table'
  | 'Android Room'
  | 'SharedPreferences'
  | 'Memory State'
  | 'Graylog Stream'
  | 'API Endpoint'
  | 'External Provider'

export type TruthLevel =
  | 'authoritative'
  | 'operational'
  | 'cached'
  | 'derived'
  | 'temporary'
  | 'audit'

export type DataDomain =
  | 'Shipment'
  | 'Delivery'
  | 'Payment'
  | 'Fiscal'
  | 'Schedule'
  | 'Courier'
  | 'Barcode'
  | 'Offline Queue'
  | 'Notification'
  | 'Location'
  | 'D4Me'
  | 'Authentication'

export type SourceEnvironment = 'Mobile local' | 'Backend' | 'Fiscal system' | 'UAT' | 'Production'
export type SourceCountry = 'HR' | 'BA' | 'SI' | 'RS' | 'General'

/** Sonuç listesindeki kaynağın rolü — kart üst rozeti. */
export type ResultRole = 'primary' | 'supporting' | 'log' | 'cache' | 'external'

export const TRUTH_META: Record<TruthLevel, { label: string; tone: Tone; hint: string }> = {
  authoritative: {
    label: 'Authoritative',
    tone: 'green',
    hint: 'Bu verinin nihai kaydı burasıdır; uyuşmazlıkta bu kaynak kazanır.',
  },
  operational: {
    label: 'Operational',
    tone: 'blue',
    hint: 'Günlük operasyonun çalıştığı güncel kayıt; iş akışları buradan okur ve yazar.',
  },
  cached: {
    label: 'Cached copy',
    tone: 'amber',
    hint: 'Başka bir kaynağın kopyası; sync gecikmesiyle geride kalabilir.',
  },
  derived: {
    label: 'Derived',
    tone: 'teal',
    hint: 'Başka kayıtlardan türetilir; kendisi düzeltilmez, kaynağı düzeltilir.',
  },
  temporary: {
    label: 'Temporary state',
    tone: 'orange',
    hint: 'Process/oturum ömürlü geçici durum; kalıcı kayıt değildir.',
  },
  audit: {
    label: 'Audit-log only',
    tone: 'gray',
    hint: 'Ne olduğunu anlamak içindir; operasyonel doğrulama için kullanılmaz.',
  },
}

export const ROLE_META: Record<ResultRole, { label: string; tone: Tone }> = {
  primary: { label: 'Primary source', tone: 'blue' },
  supporting: { label: 'Supporting source', tone: 'teal' },
  log: { label: 'Log source', tone: 'gray' },
  cache: { label: 'Local cache', tone: 'amber' },
  external: { label: 'External system', tone: 'purple' },
}

// Filtre rail seçenekleri
export const ALL_DOMAINS: DataDomain[] = [
  'Shipment', 'Delivery', 'Payment', 'Fiscal', 'Schedule', 'Courier',
  'Barcode', 'Offline Queue', 'Notification', 'Location', 'D4Me', 'Authentication',
]
export const ALL_SOURCE_TYPES: SourceType[] = [
  'MongoDB Collection', 'SQL Table', 'Android Room', 'SharedPreferences',
  'Memory State', 'Graylog Stream', 'API Endpoint', 'External Provider',
]
export const ALL_ENVIRONMENTS: SourceEnvironment[] = [
  'Mobile local', 'Backend', 'Fiscal system', 'UAT', 'Production',
]
export const ALL_COUNTRIES: SourceCountry[] = ['HR', 'BA', 'SI', 'RS', 'General']

// ── Veri kaynağı kataloğu ────────────────────────────────────────

export interface KeyField {
  name: string
  type: string
  meaning: string
}

export interface DataSource {
  id: string
  /** Teknik ad — ör. "shipments". */
  name: string
  /** İnsan-okur sistem adı — ör. "Backend MongoDB". */
  system: string
  sourceType: SourceType
  domains: DataDomain[]
  truth: TruthLevel
  owner: string
  freshness: string
  retention: string
  updateFrequency: string
  environments: SourceEnvironment[]
  countries: SourceCountry[]
  lastSchemaUpdate: string
  /** Ne için kullanılır. */
  purpose: string
  /** Ne için KULLANILMAMALIDIR. */
  notFor: string
  keyFields: KeyField[]
  commonQuestions: string[]
  exampleQuery: { label: string; code: string }
  /** id listesi — detay panelinde chip olarak gösterilir. */
  relatedSources: string[]
  caveats: string[]
}

export const DATA_SOURCES: DataSource[] = [
  {
    id: 'shipments',
    name: 'shipments',
    system: 'Backend MongoDB',
    sourceType: 'MongoDB Collection',
    domains: ['Shipment', 'Delivery', 'Payment'],
    truth: 'operational',
    owner: 'Backend Core Team',
    freshness: 'Gerçek zamanlı (event-driven yazım)',
    retention: '18 ay aktif · sonrası soğuk arşiv',
    updateFrequency: 'Her status/payment event\'inde',
    environments: ['Backend', 'Production', 'UAT'],
    countries: ['General'],
    lastSchemaUpdate: '2026-05-28',
    purpose:
      'Bir shipment\'ın güncel operasyonel durumu: teslimat statüsü, payment durumu, kurye ve schedule ataması. Payment + delivery sorularının ilk bakılacak yeri.',
    notFor:
      'Fiscal uygunluk kanıtı (FiscalInvoiceData\'ya bakılır) ve tarihsel olay sırası analizi (deliveryEvents / Graylog kullanılır).',
    keyFields: [
      { name: 'shipmentId', type: 'String', meaning: 'Shipment\'ın benzersiz iş kimliği; tüm sistemlerde ortak identifier.' },
      { name: 'status', type: 'Enum', meaning: 'Operasyonel teslimat durumu (CREATED, IN_DELIVERY, DELIVERED, RETURNED...).' },
      { name: 'courierId', type: 'String', meaning: 'Shipment\'ın atandığı kurye.' },
      { name: 'scheduleId', type: 'String', meaning: 'Bağlı olduğu günlük tur/schedule kaydı.' },
      { name: 'paymentStatus', type: 'Enum', meaning: 'Tahsilat durumu (PENDING, PAID, FAILED, REFUNDED).' },
      { name: 'updatedAt', type: 'Date', meaning: 'Son event\'in backend\'e işlendiği an.' },
    ],
    commonQuestions: [
      'Bu shipment şu anda hangi durumda?',
      'Payment tamamlandı mı, hangi kanaldan?',
      'Shipment hangi kuryeye ve hangi schedule\'a bağlı?',
      'Mobil ekrandaki durum backend ile aynı mı?',
    ],
    exampleQuery: {
      label: 'mongodb',
      code: 'db.shipments.findOne({\n  shipmentId: "<SHIPMENT_ID>"\n})',
    },
    relatedSources: ['fiscal-invoice-data', 'delivery-events', 'request-sender-queue', 'schedule-stop-chunks', 'paid-shipments'],
    caveats: [
      'Mobile Room kaydı backend state\'inden geçici olarak geri kalabilir.',
      'paymentStatus fiscal onayı garanti etmez; fiscal uygunluk için FiscalInvoiceData karşılaştırılmalıdır.',
    ],
  },
  {
    id: 'schedules',
    name: 'schedules',
    system: 'Backend MongoDB',
    sourceType: 'MongoDB Collection',
    domains: ['Schedule', 'Courier'],
    truth: 'authoritative',
    owner: 'Backend Core Team',
    freshness: 'Gerçek zamanlı; gün başında toplu üretim',
    retention: '12 ay',
    updateFrequency: 'Planlama servisinden; gün içi TOUR event\'lerinde',
    environments: ['Backend', 'Production', 'UAT'],
    countries: ['General'],
    lastSchemaUpdate: '2026-04-14',
    purpose:
      'Kuryenin günlük turunun (schedule) ana kaydı: stop sırası, atanan shipment\'lar ve tur durumu. Mobil taraftaki schedule verisinin tek gerçek kaynağı.',
    notFor:
      'Kuryenin ekranda o an ne gördüğünü anlamak (mobil Room kopyasına bakılır) veya anlık konum takibi (LiveLocation).',
    keyFields: [
      { name: 'scheduleId', type: 'String', meaning: 'Günlük tur kimliği.' },
      { name: 'courierId', type: 'String', meaning: 'Turun sahibi kurye.' },
      { name: 'date', type: 'Date', meaning: 'Turun operasyon günü.' },
      { name: 'stops', type: 'Array', meaning: 'Sıralı stop listesi; her stop shipment referansları taşır.' },
      { name: 'state', type: 'Enum', meaning: 'Tur durumu (PLANNED, ACTIVE, COMPLETED).' },
    ],
    commonQuestions: [
      'Kuryenin bugünkü turunda hangi stop\'lar var?',
      'Shipment hangi schedule\'a atanmış?',
      'Tur backend\'de aktif görünüyor mu?',
    ],
    exampleQuery: {
      label: 'mongodb',
      code: 'db.schedules.find({\n  courierId: "<COURIER_ID>",\n  date: ISODate("<YYYY-MM-DD>")\n})',
    },
    relatedSources: ['schedule-stop-chunks', 'shipments', 'delivery-events'],
    caveats: [
      'Gün içi re-planlama sonrası mobil kopya FCM refresh gelene kadar eski sırayı gösterebilir.',
    ],
  },
  {
    id: 'schedule-stop-chunks',
    name: 'scheduleStopChunks',
    system: 'Mobile Room DB',
    sourceType: 'Android Room',
    domains: ['Schedule', 'Shipment', 'Delivery'],
    truth: 'cached',
    owner: 'Mobile Team',
    freshness: 'Son başarılı sync anı; FCM ile tetiklenir',
    retention: 'Cihazda gün sonuna kadar; logout\'ta temizlenir',
    updateFrequency: 'Schedule sync + her lokal işlemde',
    environments: ['Mobile local', 'Production', 'UAT'],
    countries: ['General'],
    lastSchemaUpdate: '2026-06-02',
    purpose:
      'Backend schedule\'ının cihazdaki parça parça (chunk) kopyası; stop listesi ekranı ve offline çalışma buradan beslenir.',
    notFor:
      'Operasyonel doğrulama — backend ile uyuşmazlıkta backend kaydı esas alınır. Payment durumunun nihai okunması.',
    keyFields: [
      { name: 'chunkId', type: 'String', meaning: 'Chunk kimliği; schedule + sıra aralığından türetilir.' },
      { name: 'scheduleId', type: 'String', meaning: 'Bağlı backend schedule kaydı.' },
      { name: 'stopsJson', type: 'String (JSON)', meaning: 'Stop ve shipment listesinin serileştirilmiş kopyası.' },
      { name: 'syncedAt', type: 'Long (epoch)', meaning: 'Chunk\'ın en son backend\'den çekildiği an.' },
      { name: 'dirty', type: 'Boolean', meaning: 'Lokal değişiklik var, backend\'e henüz gönderilmedi.' },
    ],
    commonQuestions: [
      'Kurye ekranında shipment neden eski durumda görünüyor?',
      'Cihaz en son ne zaman sync oldu?',
      'Offline yapılan işlem lokalde kaydedilmiş mi?',
    ],
    exampleQuery: {
      label: 'sql (room)',
      code: "SELECT * FROM schedule_stop_chunks\nWHERE scheduleId = '<SCHEDULE_ID>'\nORDER BY syncedAt DESC;",
    },
    relatedSources: ['schedules', 'shipments', 'request-sender-queue'],
    caveats: [
      'Mobile Room kaydı backend state\'inden geçici olarak geri kalabilir.',
      'dirty=true satırlar offline queue boşalana kadar backend\'de görünmez.',
    ],
  },
  {
    id: 'request-sender-queue',
    name: 'RequestSender queue',
    system: 'Mobile Room DB (RequestSenderService)',
    sourceType: 'Android Room',
    domains: ['Offline Queue', 'Shipment', 'Delivery', 'Payment'],
    truth: 'temporary',
    owner: 'Mobile Team',
    freshness: 'Anlık — kuyruk cihazda canlı işlenir',
    retention: 'Başarılı gönderimde silinir; max 7 gün',
    updateFrequency: 'Her offline işlemde insert; bağlantıda drain',
    environments: ['Mobile local', 'Production', 'UAT'],
    countries: ['General'],
    lastSchemaUpdate: '2026-03-19',
    purpose:
      'Offline yapılan teslimat/tahsilat işlemlerinin backend\'e gönderilmeyi bekleyen kuyruğu. "İşlem yapıldı ama backend\'de yok" sorularının ilk bakılacak yeri.',
    notFor:
      'Kalıcı işlem geçmişi — kayıtlar gönderim sonrası silinir. Backend durumunun okunması.',
    keyFields: [
      { name: 'requestId', type: 'String', meaning: 'Kuyruk kaydının benzersiz kimliği; idempotency anahtarı.' },
      { name: 'endpoint', type: 'String', meaning: 'Hedef backend endpoint\'i.' },
      { name: 'payloadJson', type: 'String (JSON)', meaning: 'Gönderilecek işlem gövdesi (shipmentId dahil).' },
      { name: 'isProcessing', type: 'Boolean', meaning: 'Kuyruk elemanı şu an gönderim döngüsünde mi.' },
      { name: 'retryCount', type: 'Int', meaning: 'Deneme sayısı; artıyorsa gönderim başarısız oluyor.' },
      { name: 'createdAt', type: 'Long (epoch)', meaning: 'İşlemin cihazda yapıldığı an.' },
    ],
    commonQuestions: [
      'Kuryenin işlemi backend\'e neden ulaşmadı?',
      'Kuyrukta bekleyen kaç istek var?',
      'isProcessing takılı kalmış mı?',
    ],
    exampleQuery: {
      label: 'sql (room)',
      code: 'SELECT requestId, endpoint, retryCount, isProcessing\nFROM request_queue\nORDER BY createdAt ASC;',
    },
    relatedSources: ['schedule-stop-chunks', 'shipments', 'delivery-events'],
    caveats: [
      'Kuyruk sadece cihazda görülebilir; uzaktan teşhis için Graylog gönderim loglarına bakılır.',
      'isProcessing=true takılı kalırsa kuyruk drain olmaz — bilinen edge case.',
    ],
  },
  {
    id: 'fiscal-invoice-data',
    name: 'FiscalInvoiceData',
    system: 'Fiscal SQL DB',
    sourceType: 'SQL Table',
    domains: ['Fiscal', 'Payment'],
    truth: 'authoritative',
    owner: 'Fiscal Integration Team',
    freshness: 'Fiscalization callback anında',
    retention: 'Yasal saklama — 11 yıl (ülkeye göre değişir)',
    updateFrequency: 'Her fiscalization denemesinde',
    environments: ['Fiscal system', 'Backend', 'Production'],
    countries: ['HR', 'BA', 'SI', 'RS'],
    lastSchemaUpdate: '2026-01-30',
    purpose:
      'Tahsilatın resmi fiscal kaydı: fatura numarası, fiscal onay kodu (JIR/ZKI benzeri) ve fiscalization sonucu. Payment uyuşmazlıklarında karşılaştırma kaynağı.',
    notFor:
      'Operasyonel teslimat durumu okuma. Fiscal kaydın varlığı teslimatın tamamlandığını göstermez.',
    keyFields: [
      { name: 'invoiceNo', type: 'String', meaning: 'Resmi fatura numarası.' },
      { name: 'shipmentId', type: 'String', meaning: 'Bağlı shipment — shipments ile join anahtarı.' },
      { name: 'fiscalCode', type: 'String', meaning: 'Vergi otoritesi onay kodu; boşsa fiscalization tamamlanmamış.' },
      { name: 'amount', type: 'Decimal', meaning: 'Tahsil edilen tutar.' },
      { name: 'fiscalizedAt', type: 'DateTime', meaning: 'Fiscal onayın alındığı an.' },
      { name: 'status', type: 'Enum', meaning: 'Fiscal süreç durumu (PENDING, CONFIRMED, FAILED).' },
    ],
    commonQuestions: [
      'Bu tahsilatın fiscal kaydı oluştu mu?',
      'Fiscal tutar ile shipment paymentStatus tutarlı mı?',
      'Fiscalization neden FAILED durumda?',
    ],
    exampleQuery: {
      label: 'sql',
      code: "SELECT invoiceNo, fiscalCode, amount, status\nFROM FiscalInvoiceData\nWHERE shipmentId = '<SHIPMENT_ID>';",
    },
    relatedSources: ['shipments', 'paid-shipments', 'delivery-events'],
    caveats: [
      'Aynı isimli status alanı burada fiscal state modelini temsil eder; shipments.status ile karıştırılmamalıdır.',
      'Fiscal callback gecikmesi nedeniyle kayıt shipments\'tan dakikalar sonra oluşabilir.',
    ],
  },
  {
    id: 'notification-info',
    name: 'NotificationInfo',
    system: 'Mobile Room DB',
    sourceType: 'Android Room',
    domains: ['Notification', 'Schedule', 'Shipment'],
    truth: 'derived',
    owner: 'Mobile Team',
    freshness: 'FCM mesajı geldiği an',
    retention: 'Cihazda 14 gün',
    updateFrequency: 'Her push notification\'da',
    environments: ['Mobile local', 'Production', 'UAT'],
    countries: ['General'],
    lastSchemaUpdate: '2025-11-08',
    purpose:
      'Cihaza gelen FCM mesajlarının (schedule refresh, shipment update tetikleri) lokal kaydı. "Push geldi mi, işlendi mi?" sorusuna bakılır.',
    notFor:
      'İş verisinin kendisi — payload sadece tetiktir; gerçek veri backend\'den sync ile çekilir.',
    keyFields: [
      { name: 'messageId', type: 'String', meaning: 'FCM mesaj kimliği.' },
      { name: 'type', type: 'Enum', meaning: 'Tetik tipi (SCHEDULE_REFRESH, SHIPMENT_UPDATE, TOUR_CHANGE).' },
      { name: 'payloadJson', type: 'String (JSON)', meaning: 'Gelen tetik verisi.' },
      { name: 'receivedAt', type: 'Long (epoch)', meaning: 'Cihaza ulaşma anı.' },
      { name: 'handled', type: 'Boolean', meaning: 'Sync tetiği çalıştırıldı mı.' },
    ],
    commonQuestions: [
      'Schedule değişikliği push\'u cihaza ulaştı mı?',
      'Push geldi ama sync neden çalışmadı?',
    ],
    exampleQuery: {
      label: 'sql (room)',
      code: "SELECT * FROM notification_info\nWHERE type = 'SCHEDULE_REFRESH'\nORDER BY receivedAt DESC LIMIT 20;",
    },
    relatedSources: ['schedule-stop-chunks', 'schedules', 'delivery-events'],
    caveats: [
      'FCM teslimi garanti değildir; push yokluğu backend\'de event olmadığı anlamına gelmez.',
    ],
  },
  {
    id: 'live-location',
    name: 'LiveLocation',
    system: 'Backend API (in-memory + son konum kaydı)',
    sourceType: 'API Endpoint',
    domains: ['Location', 'Courier'],
    truth: 'derived',
    owner: 'Backend Tracking Team',
    freshness: '~30 sn — cihaz heartbeat aralığı',
    retention: 'Sadece son konum; geçmiş 48 saat',
    updateFrequency: 'Cihazdan periyodik heartbeat',
    environments: ['Backend', 'Production'],
    countries: ['General'],
    lastSchemaUpdate: '2025-12-12',
    purpose:
      'Kuryenin son bilinen konumu; dispatcher haritası ve D4Me ETA hesabı buradan okur.',
    notFor:
      'Teslimat kanıtı veya rota geçmişi analizi — konum verisi türetilmiş anlık görüntüdür.',
    keyFields: [
      { name: 'courierId', type: 'String', meaning: 'Konumun sahibi kurye.' },
      { name: 'lat / lng', type: 'Double', meaning: 'Son bilinen koordinat.' },
      { name: 'accuracy', type: 'Float', meaning: 'GPS doğruluk yarıçapı (metre).' },
      { name: 'reportedAt', type: 'DateTime', meaning: 'Cihazın konumu gönderdiği an.' },
    ],
    commonQuestions: [
      'Kurye şu an nerede görünüyor?',
      'Konum verisi ne kadar eski?',
      'Cihaz heartbeat göndermeyi ne zaman kesti?',
    ],
    exampleQuery: {
      label: 'http',
      code: 'GET /api/v2/couriers/<COURIER_ID>/live-location\nAuthorization: Bearer <TOKEN>',
    },
    relatedSources: ['schedules', 'd4me-reservation'],
    caveats: [
      'Cihaz arka plandayken heartbeat seyrekleşir; "konum donması" çoğunlukla OS kısıtıdır.',
    ],
  },
  {
    id: 'paid-shipments',
    name: 'paidShipments',
    system: 'Mobile SharedViewModel (memory)',
    sourceType: 'Memory State',
    domains: ['Payment', 'Shipment'],
    truth: 'temporary',
    owner: 'Mobile Team',
    freshness: 'Anlık — UI oturumu içinde',
    retention: 'Process ömrü; restart\'ta kaybolur',
    updateFrequency: 'POS sonucu döndüğünde',
    environments: ['Mobile local'],
    countries: ['General'],
    lastSchemaUpdate: '2026-02-21',
    purpose:
      'POS cihazından dönen tahsilat sonucunun ekranlar arası taşındığı geçici in-memory liste; teslimat ekranı "ödendi" rozetini buradan gösterir.',
    notFor:
      'Herhangi bir doğrulama veya kalıcı kayıt. Payment gerçekleşti mi sorusunun cevabı backend + fiscal kayıttır.',
    keyFields: [
      { name: 'shipmentId', type: 'String', meaning: 'Ödendi işaretlenen shipment.' },
      { name: 'posResultCode', type: 'String', meaning: 'POS sağlayıcısından dönen sonuç kodu.' },
      { name: 'paidAt', type: 'Long (epoch)', meaning: 'POS onayının UI\'a ulaştığı an.' },
    ],
    commonQuestions: [
      'Ekran "ödendi" gösteriyor ama backend PENDING — neden?',
      'POS sonucu UI\'a ulaştı mı?',
    ],
    exampleQuery: {
      label: 'kotlin',
      code: '// Debug — SharedViewModel içeriği\nsharedViewModel.paidShipments.value\n  ?.firstOrNull { it.shipmentId == shipmentId }',
    },
    relatedSources: ['shipments', 'fiscal-invoice-data', 'request-sender-queue'],
    caveats: [
      'paidShipments yalnızca memory\'de tutulduğu için process restart sonrası kaybolabilir.',
      'UI "ödendi" gösterirken backend event\'i offline queue\'da bekliyor olabilir.',
    ],
  },
  {
    id: 'force-loaded-barcodes',
    name: 'forceLoadedBarcodeList',
    system: 'Mobile SharedPreferences',
    sourceType: 'SharedPreferences',
    domains: ['Barcode', 'Shipment'],
    truth: 'cached',
    owner: 'Mobile Team',
    freshness: 'Son force-load işlemi anı',
    retention: 'Cihazda kalıcı; manuel temizlenene kadar',
    updateFrequency: 'Kurye force-load yaptığında',
    environments: ['Mobile local', 'Production'],
    countries: ['General'],
    lastSchemaUpdate: '2025-09-17',
    purpose:
      'Kuryenin zorla (force) yüklediği barkodların lokal geçmişi; mükerrer yükleme uyarıları ve destek incelemeleri buradan okur.',
    notFor:
      'Resmi barkod okuma geçmişi — backend event zinciri (Graylog + shipments) esas kayıttır.',
    keyFields: [
      { name: 'barcode', type: 'String', meaning: 'Force-load edilen barkod değeri.' },
      { name: 'shipmentId', type: 'String', meaning: 'Eşleşen shipment (varsa).' },
      { name: 'loadedAt', type: 'Long (epoch)', meaning: 'Force-load anı.' },
      { name: 'reason', type: 'String', meaning: 'Kuryenin seçtiği zorlama nedeni.' },
    ],
    commonQuestions: [
      'Bu barkod cihazda daha önce force-load edilmiş mi?',
      'Kurye hangi gerekçeyle zorla yükledi?',
    ],
    exampleQuery: {
      label: 'kotlin',
      code: 'prefs.getString("force_loaded_barcode_list", "[]")\n// JSON array — barcode, shipmentId, loadedAt, reason',
    },
    relatedSources: ['shipments', 'delivery-events'],
    caveats: [
      'SharedPreferences cihaza özeldir; kurye cihaz değiştirirse geçmiş taşınmaz.',
    ],
  },
  {
    id: 'd4me-reservation',
    name: 'D4MeReservation',
    system: 'D4Me Provider API',
    sourceType: 'External Provider',
    domains: ['D4Me', 'Delivery', 'Shipment'],
    truth: 'authoritative',
    owner: 'D4Me Integration (External)',
    freshness: 'Provider tarafında gerçek zamanlı',
    retention: 'Provider politikası — min. 24 ay',
    updateFrequency: 'Müşteri rezervasyon değiştirdiğinde',
    environments: ['Backend', 'Production'],
    countries: ['HR', 'SI'],
    lastSchemaUpdate: '2026-03-05',
    purpose:
      'Müşterinin D4Me (Deliver4Me) teslimat noktası/zaman penceresi rezervasyonunun ana kaydı. Rezervasyon uyuşmazlıklarında provider kaydı esas alınır.',
    notFor:
      'Shipment operasyonel durumu — rezervasyon teslimatın kendisi değildir.',
    keyFields: [
      { name: 'reservationId', type: 'String', meaning: 'Provider tarafındaki rezervasyon kimliği.' },
      { name: 'shipmentId', type: 'String', meaning: 'Bizim sistemdeki shipment eşlemesi.' },
      { name: 'slot', type: 'Object', meaning: 'Seçilen teslimat zaman penceresi.' },
      { name: 'pickupPointId', type: 'String', meaning: 'Seçilen teslimat noktası (varsa).' },
      { name: 'status', type: 'Enum', meaning: 'Rezervasyon durumu (ACTIVE, CHANGED, CANCELLED).' },
    ],
    commonQuestions: [
      'Müşterinin aktif D4Me rezervasyonu var mı?',
      'Rezervasyon değişikliği bizim tarafa yansıdı mı?',
    ],
    exampleQuery: {
      label: 'http',
      code: 'GET https://api.d4me.example/v1/reservations\n  ?shipmentId=<SHIPMENT_ID>\nX-Api-Key: <PROVIDER_KEY>',
    },
    relatedSources: ['shipments', 'notification-info', 'live-location'],
    caveats: [
      'Provider webhooks gecikirse bizim kopya eski slot\'u gösterebilir; uyuşmazlıkta provider kaydı kazanır.',
      'UAT ortamında provider sandbox\'ı ayrı veri seti kullanır.',
    ],
  },
  {
    id: 'delivery-events',
    name: 'deliveryEvents',
    system: 'Graylog (event stream)',
    sourceType: 'Graylog Stream',
    domains: ['Delivery', 'Shipment', 'Payment', 'Offline Queue'],
    truth: 'audit',
    owner: 'Platform / Observability',
    freshness: 'Saniyeler içinde (log pipeline)',
    retention: '90 gün sıcak · 12 ay arşiv',
    updateFrequency: 'Her TOUR/DELY/PAY event\'inde',
    environments: ['Backend', 'Production', 'UAT'],
    countries: ['General'],
    lastSchemaUpdate: '2026-05-10',
    purpose:
      'Shipment yaşam döngüsündeki tüm olayların (TOUR, DELY, PAY, sync denemeleri) zaman sıralı akışı. "Ne, ne zaman, hangi sırayla oldu?" sorularının kaynağı.',
    notFor:
      'Operasyonel doğrulama — log kaydı, database state\'inin yerine geçmez.',
    keyFields: [
      { name: 'timestamp', type: 'DateTime', meaning: 'Olay anı (pipeline damgası).' },
      { name: 'event_type', type: 'String', meaning: 'Olay kodu (TOUR_START, DELY_DONE, PAY_RESULT...).' },
      { name: 'shipment_id', type: 'String', meaning: 'İlgili shipment.' },
      { name: 'courier_id', type: 'String', meaning: 'İşlemi yapan kurye.' },
      { name: 'source', type: 'String', meaning: 'Olayı üreten servis (mobile, backend, fiscal-bridge).' },
    ],
    commonQuestions: [
      'Bu shipment için event zinciri hangi sırada aktı?',
      'Payment event\'i backend\'e ulaştı mı, kaç kez denendi?',
      'Duplicate event var mı?',
    ],
    exampleQuery: {
      label: 'graylog',
      code: 'shipment_id:"<SHIPMENT_ID>" AND\n(event_type:PAY_* OR event_type:DELY_*)',
    },
    relatedSources: ['shipments', 'request-sender-queue', 'fiscal-invoice-data'],
    caveats: [
      'Graylog kayıtları audit ve teşhis içindir; source of truth değildir.',
      'Log pipeline gecikmesi olay sırasını milisaniye düzeyinde bozabilir; sıralama için event payload timestamp\'i kullanılır.',
    ],
  },
]

export const SOURCE_BY_ID = new Map(DATA_SOURCES.map((s) => [s.id, s]))

// ── Arama intent'leri (mock semantic search) ─────────────────────

export interface SearchIntent {
  id: string
  /** Popüler soru chip'i etiketi — boşsa chip gösterilmez. */
  chipLabel?: string
  /** Serbest metin eşleme anahtarları (lowercase includes). */
  keywords: string[]
  guidance: {
    /** "Where should I look first?" başlığı — ör. "Önce shipments collection'ına bak." */
    headline: string
    detail: string
  }
  results: { sourceId: string; role: ResultRole }[]
}

export const SEARCH_INTENTS: SearchIntent[] = [
  {
    id: 'payment-and-delivery',
    keywords: ['payment ve delivery', 'payment ve teslimat', 'birlikte', 'ödeme ve teslimat', 'payment durumu ile delivery'],
    guidance: {
      headline: 'Tek bir kaynak yeterli değil — shipments ile FiscalInvoiceData birlikte okunmalı.',
      detail:
        'Payment ve delivery durumunun operasyonel karşılığı shipments collection\'ında tutuluyor; fiscal doğrulama için FiscalInvoiceData kaydını ikinci kaynak olarak karşılaştır. Olay sırası şüphesi varsa Graylog event zinciri üçüncü adımdır.',
    },
    results: [
      { sourceId: 'shipments', role: 'primary' },
      { sourceId: 'fiscal-invoice-data', role: 'supporting' },
      { sourceId: 'schedule-stop-chunks', role: 'cache' },
      { sourceId: 'delivery-events', role: 'log' },
      { sourceId: 'paid-shipments', role: 'cache' },
    ],
  },
  {
    id: 'shipment-location',
    chipLabel: 'Shipment nerede tutulur?',
    keywords: ['shipment nerede', 'shipment kayd', 'gönderi nerede', 'shipment tutul'],
    guidance: {
      headline: 'Önce shipments collection\'ına bak.',
      detail:
        'Shipment\'ın güncel operasyonel kaydı backend MongoDB shipments collection\'ındadır. Mobil ekranda görünen kopya scheduleStopChunks üzerinden gelir ve geçici olarak geride kalabilir.',
    },
    results: [
      { sourceId: 'shipments', role: 'primary' },
      { sourceId: 'schedule-stop-chunks', role: 'cache' },
      { sourceId: 'delivery-events', role: 'log' },
    ],
  },
  {
    id: 'payment-status',
    chipLabel: 'Payment durumu nereden okunur?',
    keywords: ['payment', 'ödeme', 'tahsilat', 'pos', 'paid'],
    guidance: {
      headline: 'Önce shipments collection\'ına bak.',
      detail:
        'Payment ve delivery durumunun operasyonel karşılığı burada tutuluyor. Fiscal uyumsuzluğu araştırıyorsan FiscalInvoiceData kaydını ikinci kaynak olarak karşılaştır.',
    },
    results: [
      { sourceId: 'shipments', role: 'primary' },
      { sourceId: 'fiscal-invoice-data', role: 'supporting' },
      { sourceId: 'schedule-stop-chunks', role: 'cache' },
      { sourceId: 'delivery-events', role: 'log' },
      { sourceId: 'paid-shipments', role: 'cache' },
    ],
  },
  {
    id: 'fiscal-record',
    chipLabel: 'Fiscal kayıt nasıl bulunur?',
    keywords: ['fiscal', 'fatura', 'invoice', 'jir', 'zki', 'fiscalization'],
    guidance: {
      headline: 'Fiscal kaydın ana kaynağı FiscalInvoiceData tablosudur.',
      detail:
        'shipmentId ile join ederek shipments kaydıyla karşılaştır. fiscalCode boşsa fiscalization tamamlanmamıştır; olay geçmişi için Graylog PAY event\'lerine bak.',
    },
    results: [
      { sourceId: 'fiscal-invoice-data', role: 'primary' },
      { sourceId: 'shipments', role: 'supporting' },
      { sourceId: 'delivery-events', role: 'log' },
    ],
  },
  {
    id: 'offline-queue',
    chipLabel: 'Offline queue nerede?',
    keywords: ['offline', 'queue', 'kuyruk', 'requestsender', 'sync bekle', 'gönderilmedi'],
    guidance: {
      headline: 'Offline işlemler RequestSender queue\'sunda bekler.',
      detail:
        'Cihazdaki Room tabanlı kuyruk backend\'e ulaşmamış işlemleri tutar. Uzaktan teşhis için Graylog gönderim loglarını, sonucu doğrulamak için shipments kaydını kullan.',
    },
    results: [
      { sourceId: 'request-sender-queue', role: 'primary' },
      { sourceId: 'schedule-stop-chunks', role: 'cache' },
      { sourceId: 'delivery-events', role: 'log' },
      { sourceId: 'shipments', role: 'supporting' },
    ],
  },
  {
    id: 'schedule-data',
    chipLabel: 'Schedule verisi nerede?',
    keywords: ['schedule', 'tur', 'stop list', 'rota', 'plan'],
    guidance: {
      headline: 'Schedule\'ın tek gerçek kaynağı backend schedules collection\'ıdır.',
      detail:
        'Kuryenin ekranda gördüğü liste scheduleStopChunks kopyasından gelir. "Ekran eski" şikayetlerinde önce backend kaydını, sonra cihazdaki chunk\'ın syncedAt değerini karşılaştır.',
    },
    results: [
      { sourceId: 'schedules', role: 'primary' },
      { sourceId: 'schedule-stop-chunks', role: 'cache' },
      { sourceId: 'notification-info', role: 'supporting' },
      { sourceId: 'delivery-events', role: 'log' },
    ],
  },
  {
    id: 'courier-location',
    chipLabel: 'Courier location nerede?',
    keywords: ['location', 'konum', 'courier nerede', 'kurye nerede', 'gps', 'harita'],
    guidance: {
      headline: 'Son bilinen konum LiveLocation endpoint\'inden okunur.',
      detail:
        'Konum türetilmiş anlık veridir — teslimat kanıtı değildir. reportedAt eskiyse cihaz heartbeat göndermeyi kesmiştir; schedule durumuyla birlikte değerlendir.',
    },
    results: [
      { sourceId: 'live-location', role: 'primary' },
      { sourceId: 'schedules', role: 'supporting' },
      { sourceId: 'delivery-events', role: 'log' },
    ],
  },
  {
    id: 'barcode-history',
    chipLabel: 'Barcode geçmişi nerede?',
    keywords: ['barcode', 'barkod', 'force load', 'okutma', 'scan'],
    guidance: {
      headline: 'Force-load geçmişi cihazdaki forceLoadedBarcodeList\'te tutulur.',
      detail:
        'SharedPreferences kaydı cihaza özeldir ve lokal kopyadır. Resmi okuma zinciri için Graylog event\'lerine, shipment eşleşmesi için shipments kaydına bak.',
    },
    results: [
      { sourceId: 'force-loaded-barcodes', role: 'cache' },
      { sourceId: 'delivery-events', role: 'log' },
      { sourceId: 'shipments', role: 'supporting' },
    ],
  },
  {
    id: 'd4me-reservation',
    chipLabel: 'D4Me rezervasyonu nerede?',
    keywords: ['d4me', 'rezervasyon', 'reservation', 'deliver4me', 'slot', 'pickup point'],
    guidance: {
      headline: 'Rezervasyonun ana kaydı D4Me provider API\'sindedir.',
      detail:
        'Bizim taraftaki kopya webhook ile beslenir ve gecikebilir; uyuşmazlıkta provider kaydı esas alınır. Shipment eşlemesi için shipments, tetik geçmişi için NotificationInfo kullanılır.',
    },
    results: [
      { sourceId: 'd4me-reservation', role: 'external' },
      { sourceId: 'shipments', role: 'supporting' },
      { sourceId: 'notification-info', role: 'supporting' },
    ],
  },
]

/** Serbest metni intent'e çözer — en çok anahtar kelime isabeti kazanır. */
export function resolveIntent(query: string): SearchIntent | null {
  const q = query.trim().toLowerCase()
  if (!q) return null
  let best: SearchIntent | null = null
  let bestScore = 0
  for (const intent of SEARCH_INTENTS) {
    const score = intent.keywords.filter((k) => q.includes(k)).length
    if (score > bestScore) {
      best = intent
      bestScore = score
    }
  }
  return best
}

// ── Lineage zincirleri ───────────────────────────────────────────

export interface LineageNode {
  label: string
  /** Katalogda karşılığı varsa — tıklanınca detay paneli açılır. */
  sourceId?: string
}

export interface LineageChain {
  id: string
  title: string
  description: string
  nodes: LineageNode[]
}

export const LINEAGE_CHAINS: LineageChain[] = [
  {
    id: 'payment-flow',
    title: 'Payment → Delivery veri akışı',
    description: 'Bir tahsilatın POS cihazından mobil cache\'e kadar izlediği yol.',
    nodes: [
      { label: 'POS Provider' },
      { label: 'Payment Callback' },
      { label: 'Backend Shipment', sourceId: 'shipments' },
      { label: 'Fiscal Invoice', sourceId: 'fiscal-invoice-data' },
      { label: 'Delivery State', sourceId: 'delivery-events' },
      { label: 'Mobile Room Cache', sourceId: 'schedule-stop-chunks' },
    ],
  },
  {
    id: 'schedule-flow',
    title: 'Schedule → Backend event akışı',
    description: 'Planlanan turun cihaza inip offline işlemle backend\'e geri dönüşü.',
    nodes: [
      { label: 'Backend Schedule', sourceId: 'schedules' },
      { label: 'Room Schedule', sourceId: 'schedule-stop-chunks' },
      { label: 'Stop List UI' },
      { label: 'Offline Request Queue', sourceId: 'request-sender-queue' },
      { label: 'Backend Event', sourceId: 'delivery-events' },
    ],
  },
]

// ── Investigation recipe'leri ────────────────────────────────────

export interface InvestigationRecipe {
  id: string
  title: string
  purpose: string
  checkOrder: string[]
  identifier: string
  cta: { label: string; href: string }
}

export const INVESTIGATION_RECIPES: InvestigationRecipe[] = [
  {
    id: 'payment-completed-delivery-missing',
    title: 'Payment completed, delivery missing',
    purpose:
      'Tahsilat başarılı görünüyor ama teslimat kaydı yok. Kaynaklar arasında hangi halkanın koptuğunu sırayla daralt.',
    checkOrder: [
      'Backend shipment (shipments.paymentStatus + status)',
      'Payment provider result (POS callback kaydı)',
      'Fiscal invoice (FiscalInvoiceData.fiscalCode)',
      'Mobile offline queue (RequestSender bekleyen istek)',
      'Graylog event chain (PAY_* → DELY_* sırası)',
    ],
    identifier: 'shipmentId',
    cta: { label: 'Open investigation', href: '/engineering/tools/mongodb-query-generator' },
  },
  {
    id: 'shipment-appears-twice',
    title: 'Shipment appears twice',
    purpose:
      'Aynı shipment listede iki kez görünüyor. Duplicate\'in event mi, cache mi yoksa idempotency kaçağı mı olduğunu ayırt et.',
    checkOrder: [
      'Shipment state history (shipments.updatedAt zinciri)',
      'TOUR/DELY event chain (Graylog duplicate event taraması)',
      'FCM refresh (NotificationInfo mükerrer tetik)',
      'Local Room copy (scheduleStopChunks çift chunk)',
      'Idempotency record (RequestSender requestId tekrarı)',
    ],
    identifier: 'shipmentId + event_type',
    cta: { label: 'Open investigation', href: '/engineering/tools/graylog-query-generator' },
  },
  {
    id: 'courier-data-not-syncing',
    title: 'Courier data not syncing',
    purpose:
      'Kuryenin işlemleri backend\'e akmıyor. Kuyruktan ağa, ağdan backend sonucuna kadar sync zincirini doğrula.',
    checkOrder: [
      'RequestSenderService queue (bekleyen istek sayısı)',
      'isProcessing state (takılı kalmış işleme bayrağı)',
      'Network logs (gönderim denemeleri, HTTP sonuçları)',
      'Backend request result (kabul/ret + hata kodu)',
      'Local Room state (dirty chunk\'lar temizlendi mi)',
    ],
    identifier: 'courierId + requestId',
    cta: { label: 'Open investigation', href: '/engineering/tools/graylog-query-generator' },
  },
]

// ── No-result durumu ─────────────────────────────────────────────

export const NO_RESULT = {
  title: 'Doğrudan eşleşen bir veri kaynağı bulunamadı.',
  suggestions: [
    'Daha genel bir iş kavramı kullan — ör. "payment" yerine "tahsilat durumu".',
    'Shipment ID veya ekran adı ekle; bağlam eşleşmeyi güçlendirir.',
    'Backend veya mobile source filtresi seçerek alanı daralt.',
    'Hâlâ bulamıyorsan yeni data mapping talebi oluştur.',
  ],
  ctaLabel: 'Data Mapping Talebi Oluştur',
}

// ── Guardrail'ler ────────────────────────────────────────────────

export interface Guardrail {
  title: string
  body: string
  tone: Tone
}

export const GUARDRAILS: Guardrail[] = [
  {
    title: 'Cache ≠ Source of Truth',
    body: 'Mobil cache, SharedPreferences veya memory state ana operasyonel kayıt olarak değerlendirilmemelidir.',
    tone: 'amber',
  },
  {
    title: 'Log ≠ Business Record',
    body: 'Graylog olay akışını anlamak için kullanılır; operasyonel veri doğrulaması için ilgili database kaydı kontrol edilmelidir.',
    tone: 'amber',
  },
  {
    title: 'Same Field ≠ Same Meaning',
    body: 'Aynı isimli status alanları mobil, backend ve fiscal sistemlerde farklı state modellerini temsil edebilir.',
    tone: 'gray',
  },
  {
    title: 'Freshness matters',
    body: 'Lokal ve backend kayıtları sync gecikmesi nedeniyle kısa süreli olarak ayrışabilir.',
    tone: 'gray',
  },
]
