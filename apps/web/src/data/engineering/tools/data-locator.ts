// Data Locator mock data — "Where does this data live?"
// Data sources catalog, search intents, lineage chains,
// investigation recipes and guardrail texts in a single file.

import type { Tone } from '@/components/product'

// ── Classifications ─────────────────────────────────────────────

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

/** Role of the source in the result list — card top badge. */
export type ResultRole = 'primary' | 'supporting' | 'log' | 'cache' | 'external'

export const TRUTH_META: Record<TruthLevel, { label: string; tone: Tone; hint: string }> = {
  authoritative: {
    label: 'Authoritative',
    tone: 'green',
    hint: 'This is the final record of this data; in case of discrepancy, this source wins.',
  },
  operational: {
    label: 'Operational',
    tone: 'blue',
    hint: 'The current record where daily operations run; workflows read and write from here.',
  },
  cached: {
    label: 'Cached copy',
    tone: 'amber',
    hint: 'Copy of another source; may fall behind due to sync delay.',
  },
  derived: {
    label: 'Derived',
    tone: 'teal',
    hint: 'Derived from other records; cannot be fixed directly, its source is fixed.',
  },
  temporary: {
    label: 'Temporary state',
    tone: 'orange',
    hint: 'Process/session scoped temporary state; not a permanent record.',
  },
  audit: {
    label: 'Audit-log only',
    tone: 'gray',
    hint: 'Used to understand what happened; not used for operational validation.',
  },
}

export const ROLE_META: Record<ResultRole, { label: string; tone: Tone }> = {
  primary: { label: 'Primary source', tone: 'blue' },
  supporting: { label: 'Supporting source', tone: 'teal' },
  log: { label: 'Log source', tone: 'gray' },
  cache: { label: 'Local cache', tone: 'amber' },
  external: { label: 'External system', tone: 'purple' },
}

// Filter rail options
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

// ── Data source catalog ────────────────────────────────────────

export interface KeyField {
  name: string
  type: string
  meaning: string
}

export interface DataSource {
  id: string
  /** Technical name — e.g. "shipments". */
  name: string
  /** Human-readable system name — e.g. "Backend MongoDB". */
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
  /** What it is used for. */
  purpose: string
  /** What it should NOT be used for. */
  notFor: string
  keyFields: KeyField[]
  commonQuestions: string[]
  exampleQuery: { label: string; code: string }
  /** List of ids — displayed as chips in the detail panel. */
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
    freshness: 'Real-time (event-driven write)',
    retention: '18 months active · cold archive afterwards',
    updateFrequency: 'On every status/payment event',
    environments: ['Backend', 'Production', 'UAT'],
    countries: ['General'],
    lastSchemaUpdate: '2026-05-28',
    purpose:
      'The current operational state of a shipment: delivery status, payment status, courier and schedule assignment. The first place to look for payment + delivery questions.',
    notFor:
      'Proof of fiscal compliance (check FiscalInvoiceData) and historical event sequence analysis (use deliveryEvents / Graylog).',
    keyFields: [
      { name: 'shipmentId', type: 'String', meaning: 'Unique business ID of the shipment; common identifier across all systems.' },
      { name: 'status', type: 'Enum', meaning: 'Operational delivery status (CREATED, IN_DELIVERY, DELIVERED, RETURNED...).' },
      { name: 'courierId', type: 'String', meaning: 'Courier assigned to the shipment.' },
      { name: 'scheduleId', type: 'String', meaning: 'Daily tour/schedule record it belongs to.' },
      { name: 'paymentStatus', type: 'Enum', meaning: 'Collection status (PENDING, PAID, FAILED, REFUNDED).' },
      { name: 'updatedAt', type: 'Date', meaning: 'Moment the last event was processed in the backend.' },
    ],
    commonQuestions: [
      'What state is this shipment in right now?',
      'Is the payment completed, and through which channel?',
      'Which courier and schedule is the shipment assigned to?',
      'Is the status on the mobile screen identical to the backend?',
    ],
    exampleQuery: {
      label: 'mongodb',
      code: 'db.shipments.findOne({\n  shipmentId: "<SHIPMENT_ID>"\n})',
    },
    relatedSources: ['fiscal-invoice-data', 'delivery-events', 'request-sender-queue', 'schedule-stop-chunks', 'paid-shipments'],
    caveats: [
      'Mobile Room record might temporarily lag behind the backend state.',
      'paymentStatus does not guarantee fiscal approval; FiscalInvoiceData must be checked for fiscal compliance.',
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
    freshness: 'Real-time; batch generation at the start of the day',
    retention: '12 months',
    updateFrequency: 'From planning service; during intraday TOUR events',
    environments: ['Backend', 'Production', 'UAT'],
    countries: ['General'],
    lastSchemaUpdate: '2026-04-14',
    purpose:
      'The main record of the courier\'s daily tour (schedule): stop order, assigned shipments and tour status. The single source of truth for the schedule data on the mobile side.',
    notFor:
      'Understanding what the courier is seeing on the screen right now (look at mobile Room copy) or real-time location tracking (LiveLocation).',
    keyFields: [
      { name: 'scheduleId', type: 'String', meaning: 'Daily tour ID.' },
      { name: 'courierId', type: 'String', meaning: 'Owner courier of the tour.' },
      { name: 'date', type: 'Date', meaning: 'Operational day of the tour.' },
      { name: 'stops', type: 'Array', meaning: 'Sequential stop list; each stop carries shipment references.' },
      { name: 'state', type: 'Enum', meaning: 'Tour status (PLANNED, ACTIVE, COMPLETED).' },
    ],
    commonQuestions: [
      'Which stops are on the courier\'s tour today?',
      'Which schedule is the shipment assigned to?',
      'Is the tour active in the backend?',
    ],
    exampleQuery: {
      label: 'mongodb',
      code: 'db.schedules.find({\n  courierId: "<COURIER_ID>",\n  date: ISODate("<YYYY-MM-DD>")\n})',
    },
    relatedSources: ['schedule-stop-chunks', 'shipments', 'delivery-events'],
    caveats: [
      'After intraday replanning, the mobile copy might show the old order until FCM refresh arrives.',
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
    freshness: 'Last successful sync moment; triggered via FCM',
    retention: 'On device until end of day; cleared on logout',
    updateFrequency: 'Schedule sync + on every local action',
    environments: ['Mobile local', 'Production', 'UAT'],
    countries: ['General'],
    lastSchemaUpdate: '2026-06-02',
    purpose:
      'Fragmented (chunk) copy of the backend schedule on the device; powers the stop list screen and offline work.',
    notFor:
      'Operational validation — in case of discrepancy with the backend, backend record prevails. Final read of the payment status.',
    keyFields: [
      { name: 'chunkId', type: 'String', meaning: 'Chunk ID; derived from schedule + sequence range.' },
      { name: 'scheduleId', type: 'String', meaning: 'Associated backend schedule record.' },
      { name: 'stopsJson', type: 'String (JSON)', meaning: 'Serialized copy of stop and shipment list.' },
      { name: 'syncedAt', type: 'Long (epoch)', meaning: 'Moment the chunk was last pulled from the backend.' },
      { name: 'dirty', type: 'Boolean', meaning: 'Local changes exist, not yet sent to backend.' },
    ],
    commonQuestions: [
      'Why does the shipment appear in an old state on the courier screen?',
      'When was the device last synced?',
      'Are offline actions saved locally?',
    ],
    exampleQuery: {
      label: 'sql (room)',
      code: "SELECT * FROM schedule_stop_chunks\nWHERE scheduleId = '<SCHEDULE_ID>'\nORDER BY syncedAt DESC;",
    },
    relatedSources: ['schedules', 'shipments', 'request-sender-queue'],
    caveats: [
      'Mobile Room record might temporarily lag behind the backend state.',
      'Rows with dirty=true will not appear in the backend until offline queue is drained.',
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
    freshness: 'Instant — queue is processed live on the device',
    retention: 'Deleted on successful send; max 7 days',
    updateFrequency: 'Insert on every offline action; drain on connection',
    environments: ['Mobile local', 'Production', 'UAT'],
    countries: ['General'],
    lastSchemaUpdate: '2026-03-19',
    purpose:
      'The queue waiting to send offline delivery/collection actions to the backend. First place to look for "action performed but not in backend" questions.',
    notFor:
      'Permanent action history — records are deleted after sending. Reading backend state.',
    keyFields: [
      { name: 'requestId', type: 'String', meaning: 'Unique ID of the queue record; idempotency key.' },
      { name: 'endpoint', type: 'String', meaning: 'Target backend endpoint.' },
      { name: 'payloadJson', type: 'String (JSON)', meaning: 'Action body to be sent (includes shipmentId).' },
      { name: 'isProcessing', type: 'Boolean', meaning: 'Is the queue element currently in the send loop.' },
      { name: 'retryCount', type: 'Int', meaning: 'Retry count; if increasing, sending is failing.' },
      { name: 'createdAt', type: 'Long (epoch)', meaning: 'Moment the action was performed on the device.' },
    ],
    commonQuestions: [
      'Why did the courier\'s action not reach the backend?',
      'How many requests are waiting in the queue?',
      'Is isProcessing stuck?',
    ],
    exampleQuery: {
      label: 'sql (room)',
      code: 'SELECT requestId, endpoint, retryCount, isProcessing\nFROM request_queue\nORDER BY createdAt ASC;',
    },
    relatedSources: ['schedule-stop-chunks', 'shipments', 'delivery-events'],
    caveats: [
      'The queue is only visible on the device; for remote diagnosis, check Graylog sender logs.',
      'If isProcessing=true gets stuck, queue won\'t drain — a known edge case.',
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
    freshness: 'At the moment of fiscalization callback',
    retention: 'Legal retention — 11 years (varies by country)',
    updateFrequency: 'On every fiscalization attempt',
    environments: ['Fiscal system', 'Backend', 'Production'],
    countries: ['HR', 'BA', 'SI', 'RS'],
    lastSchemaUpdate: '2026-01-30',
    purpose:
      'Official fiscal record of the collection: invoice number, fiscal approval code (like JIR/ZKI) and fiscalization result. Comparison source for payment discrepancies.',
    notFor:
      'Reading operational delivery status. Existence of fiscal record does not mean delivery is complete.',
    keyFields: [
      { name: 'invoiceNo', type: 'String', meaning: 'Official invoice number.' },
      { name: 'shipmentId', type: 'String', meaning: 'Associated shipment — join key with shipments.' },
      { name: 'fiscalCode', type: 'String', meaning: 'Tax authority approval code; if empty, fiscalization is incomplete.' },
      { name: 'amount', type: 'Decimal', meaning: 'Collected amount.' },
      { name: 'fiscalizedAt', type: 'DateTime', meaning: 'Moment fiscal approval was received.' },
      { name: 'status', type: 'Enum', meaning: 'Fiscal process status (PENDING, CONFIRMED, FAILED).' },
    ],
    commonQuestions: [
      'Was the fiscal record created for this collection?',
      'Is the fiscal amount consistent with shipment paymentStatus?',
      'Why is fiscalization in FAILED status?',
    ],
    exampleQuery: {
      label: 'sql',
      code: "SELECT invoiceNo, fiscalCode, amount, status\nFROM FiscalInvoiceData\nWHERE shipmentId = '<SHIPMENT_ID>';",
    },
    relatedSources: ['shipments', 'paid-shipments', 'delivery-events'],
    caveats: [
      'The status field with the same name here represents the fiscal state model; not to be confused with shipments.status.',
      'Due to fiscal callback delay, the record may be created minutes after shipments.',
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
    freshness: 'At the moment FCM message arrives',
    retention: '14 days on device',
    updateFrequency: 'On every push notification',
    environments: ['Mobile local', 'Production', 'UAT'],
    countries: ['General'],
    lastSchemaUpdate: '2025-11-08',
    purpose:
      'Local record of FCM messages (schedule refresh, shipment update triggers) sent to the device. Checked for "Did the push arrive, was it processed?".',
    notFor:
      'Business data itself — payload is just a trigger; actual data is pulled from backend via sync.',
    keyFields: [
      { name: 'messageId', type: 'String', meaning: 'FCM message ID.' },
      { name: 'type', type: 'Enum', meaning: 'Trigger type (SCHEDULE_REFRESH, SHIPMENT_UPDATE, TOUR_CHANGE).' },
      { name: 'payloadJson', type: 'String (JSON)', meaning: 'Incoming trigger data.' },
      { name: 'receivedAt', type: 'Long (epoch)', meaning: 'Moment it reached the device.' },
      { name: 'handled', type: 'Boolean', meaning: 'Was the sync trigger executed.' },
    ],
    commonQuestions: [
      'Did the schedule change push reach the device?',
      'Push arrived but why didn\'t sync work?',
    ],
    exampleQuery: {
      label: 'sql (room)',
      code: "SELECT * FROM notification_info\nWHERE type = 'SCHEDULE_REFRESH'\nORDER BY receivedAt DESC LIMIT 20;",
    },
    relatedSources: ['schedule-stop-chunks', 'schedules', 'delivery-events'],
    caveats: [
      'FCM delivery is not guaranteed; absence of push does not mean there is no event in backend.',
    ],
  },
  {
    id: 'live-location',
    name: 'LiveLocation',
    system: 'Backend API (in-memory + last location record)',
    sourceType: 'API Endpoint',
    domains: ['Location', 'Courier'],
    truth: 'derived',
    owner: 'Backend Tracking Team',
    freshness: '~30 sec — device heartbeat interval',
    retention: 'Only last location; past 48 hours',
    updateFrequency: 'Periodic heartbeat from device',
    environments: ['Backend', 'Production'],
    countries: ['General'],
    lastSchemaUpdate: '2025-12-12',
    purpose:
      'Courier\'s last known location; dispatcher map and D4Me ETA calculation read from here.',
    notFor:
      'Proof of delivery or route history analysis — location data is a derived snapshot.',
    keyFields: [
      { name: 'courierId', type: 'String', meaning: 'Courier owning the location.' },
      { name: 'lat / lng', type: 'Double', meaning: 'Last known coordinate.' },
      { name: 'accuracy', type: 'Float', meaning: 'GPS accuracy radius (meters).' },
      { name: 'reportedAt', type: 'DateTime', meaning: 'Moment the device sent the location.' },
    ],
    commonQuestions: [
      'Where does the courier appear right now?',
      'How old is the location data?',
      'When did the device stop sending heartbeats?',
    ],
    exampleQuery: {
      label: 'http',
      code: 'GET /api/v2/couriers/<COURIER_ID>/live-location\nAuthorization: Bearer <TOKEN>',
    },
    relatedSources: ['schedules', 'd4me-reservation'],
    caveats: [
      'Heartbeats become sparse when the device is in the background; "frozen location" is mostly an OS restriction.',
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
    freshness: 'Instant — within UI session',
    retention: 'Process lifetime; lost on restart',
    updateFrequency: 'When POS result returns',
    environments: ['Mobile local'],
    countries: ['General'],
    lastSchemaUpdate: '2026-02-21',
    purpose:
      'Temporary in-memory list where the collection result from the POS device is carried between screens; the delivery screen shows the "paid" badge from here.',
    notFor:
      'Any validation or permanent record. The answer to whether Payment occurred is the backend + fiscal record.',
    keyFields: [
      { name: 'shipmentId', type: 'String', meaning: 'Ödendi işaretlenen shipment.' },
      { name: 'posResultCode', type: 'String', meaning: 'POS sağlayıcısından dönen sonuç kodu.' },
      { name: 'paidAt', type: 'Long (epoch)', meaning: 'POS onayının UI\'a ulaştığı an.' },
    ],
    commonQuestions: [
      'The screen shows "paid" but the backend is PENDING — why?',
      'Did the POS result reach the UI?',
    ],
    exampleQuery: {
      label: 'kotlin',
      code: '// Debug — SharedViewModel content\nsharedViewModel.paidShipments.value\n  ?.firstOrNull { it.shipmentId == shipmentId }',
    },
    relatedSources: ['shipments', 'fiscal-invoice-data', 'request-sender-queue'],
    caveats: [
      'Because paidShipments is only kept in memory, it can be lost after a process restart.',
      'While the UI shows "paid", the backend event might be waiting in the offline queue.',
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
