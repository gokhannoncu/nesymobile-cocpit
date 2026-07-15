// Field Ticket Intelligence — data layer.
// Tickets do not generate their own root cause text: each ticket links to a canonical
// ROOT_CAUSE record, and root causes link to permanent ACTION records (Ticket → Symptom →
// Screen → Root Cause → Intervention → Permanent Fix → Verification → Recurrence Risk chain).
// Ticket records are generated from NesyArchitectureReport/tickets.json (field-ticket-records.ts).

import type { Tone } from '@/components/product'
import { FIELD_TICKET_RECORDS } from './field-ticket-records'

// ── Types ────────────────────────────────────────────────────────

export type TicketSeverity = 'critical' | 'high' | 'medium'
export type TicketStatus = 'open' | 'closed'
export type RepeatRisk = 'high' | 'medium' | 'low'
export type FixType = 'none' | 'workaround' | 'permanent'

export interface FieldTicket {
  id: string // GH-4575
  ghId: number
  customerTicket: string // UAT-HR#2504
  title: string
  type: string // bug | enhancement | feature
  severity: TicketSeverity
  status: TicketStatus
  country: string // HR | RS | CEE | General
  date: string
  group: string // Finance & Payment, Barcode & Scan…
  screen: string
  symptom: string // behavior observed by the user/operations
  location: string // in-code location
  rootCause: string // canonical RC-xx
  contributing: string[] // other contributing RCs
  rootNote: string // root cause note specific to this ticket
  confidence: number // 0-100 — confidence in root cause diagnosis
  repeatRisk: RepeatRisk
  pastAttempt: string // what was tried (workaround / past fix)
  whyInsufficient: string // why it was insufficient / current state
  fix: string // proposed permanent fix
  fixType: FixType // ticket closure type
  detectability: string | null // low | medium | high (from story)
  edgeCases: string[]
  ghUrl: string
}

export type RootCauseStatus =
  | 'hypothesis'
  | 'investigating'
  | 'probable'
  | 'confirmed'
  | 'mitigated'
  | 'fixed'
  | 'verified'
  | 'accepted-risk'

export interface RootCause {
  id: string // RC-01
  title: string
  family: string // State & Race, Finance & Payment…
  mechanism: string // failure mechanism short label
  status: RootCauseStatus
  confidence: 'low' | 'medium' | 'high' | 'verified'
  repeatRisk: RepeatRisk
  summary: string // canonical technical description
  amplifiedBy: string[] // contributing factors (text)
  actions: string[] // ACT-xx
  edgeCases: string[]
  adrRefs: string[] // ADR / NESY-ARCH document references
}

export type ActionStatus =
  | 'proposed'
  | 'planned'
  | 'in-progress'
  | 'verification'
  | 'completed'
  | 'accepted-risk'

export interface ArchAction {
  id: string // ACT-01
  title: string
  type:
    | 'architecture'
    | 'code-fix'
    | 'instrumentation'
    | 'test-coverage'
    | 'monitoring'
    | 'process'
  status: ActionStatus
  rootCauses: string[] // RC-xx
  summary: string
  verification: string // verification criteria
  ref: string // ADR / NESY-ARCH reference
}

// ── Meta maps ───────────────────────────────────────────────────────

export const SEVERITY_META: Record<TicketSeverity, { label: string; tone: Tone; rank: number }> = {
  critical: { label: 'Critical', tone: 'red', rank: 0 },
  high: { label: 'High', tone: 'orange', rank: 1 },
  medium: { label: 'Medium', tone: 'amber', rank: 2 },
}

export const RISK_META: Record<RepeatRisk, { label: string; tone: Tone; rank: number }> = {
  high: { label: 'High', tone: 'red', rank: 0 },
  medium: { label: 'Medium', tone: 'amber', rank: 1 },
  low: { label: 'Low', tone: 'green', rank: 2 },
}

export const FIX_TYPE_META: Record<FixType, { label: string; tone: Tone }> = {
  none: { label: 'No fix', tone: 'red' },
  workaround: { label: 'Workaround', tone: 'amber' },
  permanent: { label: 'Permanent', tone: 'green' },
}

export const RC_STATUS_META: Record<RootCauseStatus, { label: string; tone: Tone }> = {
  hypothesis: { label: 'Hypothesis', tone: 'gray' },
  investigating: { label: 'Under Investigation', tone: 'blue' },
  probable: { label: 'Probable', tone: 'indigo' },
  confirmed: { label: 'Confirmed', tone: 'orange' },
  mitigated: { label: 'Mitigated', tone: 'amber' },
  fixed: { label: 'Fixed', tone: 'teal' },
  verified: { label: 'Verified', tone: 'green' },
  'accepted-risk': { label: 'Accepted Risk', tone: 'purple' },
}

export const ACTION_STATUS_META: Record<ActionStatus, { label: string; tone: Tone }> = {
  proposed: { label: 'Proposed', tone: 'gray' },
  planned: { label: 'Planned', tone: 'blue' },
  'in-progress': { label: 'In Progress', tone: 'indigo' },
  verification: { label: 'Verification', tone: 'amber' },
  completed: { label: 'Completed', tone: 'green' },
  'accepted-risk': { label: 'Accepted Risk', tone: 'purple' },
}

export const ACTION_TYPE_LABEL: Record<ArchAction['type'], string> = {
  architecture: 'Architecture change',
  'code-fix': 'Code fix',
  instrumentation: 'Instrumentation',
  'test-coverage': 'Test coverage',
  monitoring: 'Monitoring',
  process: 'Operational process',
}

// ── Canonical Root Cause pool ────────────────────────────────────────
// Each record is the single true cause that multiple tickets link to.

export const ROOT_CAUSES: RootCause[] = [
  {
    id: 'RC-01',
    title: 'Scan dispatch ambiguity',
    family: 'Barcode & Scan',
    mechanism: 'Lifecycle race',
    status: 'confirmed',
    confidence: 'high',
    repeatRisk: 'high',
    summary:
      "When a barcode is scanned from the stop list, it is ambiguous which fragment will receive it via MainActivity.onNewIntent() during navigation transitions. When a scan event fires before the old fragment is destroyed, the event lands on the wrong/dying screen ('barcode empty', 'stop not found', DEPS→TOUR errors).",
    amplifiedBy: [
      'No fragment lifecycle timing guarantee',
      'Barcode stored inside ScheduleStopChunk JSON — no DB index',
      'No single entry point (coordinator) for scan',
    ],
    actions: ['ACT-06', 'ACT-01'],
    edgeCases: ['E31'],
    adrRefs: ['ADR-05', 'NESY-ARCH-001'],
  },
  {
    id: 'RC-02',
    title: 'JSON-chunk data structure — no normalized schema',
    family: 'Barcode & Scan',
    mechanism: 'Data model',
    status: 'confirmed',
    confidence: 'high',
    repeatRisk: 'high',
    summary:
      "Shipment/barcode data is stored as a JSON blob inside ScheduleStopChunk; there is no DB column or index. Every lookup requires O(n) linear JSON parsing — causing main thread freezes (ANR) on large schedules, and mandatory parsing for field-level displays (shipper name, etc.).",
    amplifiedBy: ['Parsing on the main thread', 'No field-level query capability'],
    actions: ['ACT-01'],
    edgeCases: ['E34'],
    adrRefs: ['NESY-ARCH-001'],
  },
  {
    id: 'RC-03',
    title: 'Barcode matching copies are inconsistent',
    family: 'Barcode & Scan',
    mechanism: 'Duplicated logic',
    status: 'confirmed',
    confidence: 'high',
    repeatRisk: 'medium',
    summary:
      "Barcode/stop matching logic lives as copies in 5+ different locations. Merged stop batch operations and RDOC/dely stop grouping behave inconsistently across copies; atomic batch updates cannot be performed.",
    amplifiedBy: ['Scattered flow inside God Object', 'Room transactions not used'],
    actions: ['ACT-01', 'ACT-15'],
    edgeCases: ['E32'],
    adrRefs: ['NESY-ARCH-001', 'NESY-ARCH-003'],
  },
  {
    id: 'RC-04',
    title: 'Scan dedup state is volatile — SharedPreferences goes stale',
    family: 'Barcode & Scan',
    mechanism: 'Volatile state',
    status: 'confirmed',
    confidence: 'high',
    repeatRisk: 'medium',
    summary:
      "The scanned barcode list is kept in SharedPreferences; it goes stale or is lost after a restart. When the same pickup barcode is scanned again, a duplicate parcel is created and the duplicate warning cannot be reliably displayed.",
    amplifiedBy: ['No UI debounce', 'No idempotency key'],
    actions: ['ACT-06', 'ACT-04'],
    edgeCases: ['E33'],
    adrRefs: ['ADR-09'],
  },
  {
    id: 'RC-05',
    title: 'FCM × UI race — non-atomic shipment state writes',
    family: 'State & Race',
    mechanism: 'Race condition',
    status: 'confirmed',
    confidence: 'high',
    repeatRisk: 'high',
    summary:
      "FCM refresh and a UI event update the same shipment state concurrently without a transaction; last-writer-wins produces duplicate TOUR/DELY events and scan crashes after notifications. Because last-trigger checks are not atomic, two threads can read the same stale state.",
    amplifiedBy: [
      'SharedViewModel (3.450 LOC) global mutable state',
      'Room transaction missing',
      'No event ordering guarantee',
      'No idempotency key',
    ],
    actions: ['ACT-05', 'ACT-04', 'ACT-09'],
    edgeCases: ['ES1', 'ES3', 'ES4'],
    adrRefs: ['NESY-ARCH-001', 'NESY-ARCH-005', 'ADR-02'],
  },
  {
    id: 'RC-06',
    title: 'Three sources of truth — Room / memory / SharedPreferences desync',
    family: 'State & Race',
    mechanism: 'No SSoT',
    status: 'confirmed',
    confidence: 'high',
    repeatRisk: 'high',
    summary:
      "The same data is independently updated in Room, memory, and SharedPreferences with no synchronization guarantee. When a route changes the old route remains on the courier, a delivered shipment shows as 'Not Delivered' in tracking, and the service type is read from the wrong source.",
    amplifiedBy: ['No reactive single source (DAO Flow)', 'ScheduleIngestor does not perform atomic replace'],
    actions: ['ACT-02', 'ACT-03'],
    edgeCases: ['ES1', 'ES2'],
    adrRefs: ['NESY-ARCH-002', 'NESY-ARCH-003'],
  },
  {
    id: 'RC-07',
    title: 'Stale in-memory state — currentTask not cleared',
    family: 'State & Race',
    mechanism: 'Stale state',
    status: 'confirmed',
    confidence: 'high',
    repeatRisk: 'medium',
    summary:
      "Because the completed task is not cleared from SharedViewModel._currentTask in memory, it continues to appear as 'unfinished' in the assign tab. Manual cleanup patches leave missing/forgotten points inside the God Object, causing recurrence.",
    amplifiedBy: ['God Object is the sole shared state', 'Reading from memory instead of DB'],
    actions: ['ACT-03', 'ACT-09'],
    edgeCases: ['ES7'],
    adrRefs: ['NESY-ARCH-003'],
  },
  {
    id: 'RC-08',
    title: 'No outbox — memory queue with no FIFO or idempotency guarantee',
    family: 'Event & Sync',
    mechanism: 'Unreliable delivery',
    status: 'confirmed',
    confidence: 'high',
    repeatRisk: 'high',
    summary:
      "Events (DELY, CASH, reservation…) wait in the RequestSenderService memory queue. They are lost on phone shutdown/app kill, ordering breaks under parallel events (DDSP→LCR), and duplicate submissions occur due to lack of idempotency.",
    amplifiedBy: ['Non-persisted queue', 'No event ordering guarantee', 'Retry produces duplicates'],
    actions: ['ACT-04', 'ACT-07'],
    edgeCases: ['E7', 'E9', 'E10', 'ED3'],
    adrRefs: ['NESY-ARCH-004', 'ADR-07'],
  },
  {
    id: 'RC-09',
    title: 'No fiscal ordering guarantee — delivery → collection → fiscal sequence not enforced',
    family: 'Finance & Payment',
    mechanism: 'Ordering',
    status: 'probable',
    confidence: 'medium',
    repeatRisk: 'high',
    summary:
      "Fiscal receipt generation can be triggered independently of/before delivery confirmation; ordering is managed through large if/else blocks and time-window rules (2 min). 'Receipt exists but no delivery', 'delivery exists but no receipt', and cancel-fiscal skipping in cancellation flows occur because of this.",
    amplifiedBy: ['Ordering embedded in code, no queue', 'Timing-based rules', 'Scattered flow inside God Object'],
    actions: ['ACT-10', 'ACT-07'],
    edgeCases: [],
    adrRefs: ['NESY-ARCH-004'],
  },
  {
    id: 'RC-10',
    title: 'Fiscal generation is not atomic/idempotent',
    family: 'Finance & Payment',
    mechanism: 'No idempotency',
    status: 'probable',
    confidence: 'medium',
    repeatRisk: 'medium',
    summary:
      "Fiscal receipt generation operates per shipment rather than with an atomic per-stop rule, with no re-trigger protection. Duplicate receipts on the same stop, missing shipments in multi-pickup, and a second reprint/cancel trigger on screen rotation are symptoms of this record.",
    amplifiedBy: ['No DB lock', 'Fiscal logic inside god object', 'Grouping rule is not atomic'],
    actions: ['ACT-10', 'ACT-04'],
    edgeCases: [],
    adrRefs: ['NESY-ARCH-004'],
  },
  {
    id: 'RC-11',
    title: 'Payment result not persisted — memory-only payment state',
    family: 'Finance & Payment',
    mechanism: 'Volatile state',
    status: 'probable',
    confidence: 'medium',
    repeatRisk: 'high',
    summary:
      "POS/RaiPay payment result is first written to memory and sent from there; no DB record is created before submission. On phone shutdown, app kill, or timing edge cases, the payment is never reflected in NESY — a silent loss that is only discovered during end-of-day reconciliation.",
    amplifiedBy: ['No outbox (RC-08)', 'CASH–CODC matching in volatile memory', 'Memory set that cannot disambiguate partial delivery state'],
    actions: ['ACT-11', 'ACT-04'],
    edgeCases: [],
    adrRefs: ['NESY-ARCH-004'],
  },
  {
    id: 'RC-12',
    title: 'Payment/service type not normalized — decision not made at a single point',
    family: 'Finance & Payment',
    mechanism: 'No SSoT',
    status: 'confirmed',
    confidence: 'medium',
    repeatRisk: 'medium',
    summary:
      "Service type (COD/Exworks), customer type (contracted/prepaid), and payment type (cash/card) are read from a memory+JSON mix; the collection decision is not made in a single business rule. Incorrect COD requests, requesting payment from contracted customers, and end-of-day cash/card mix-ups are symptoms of this record.",
    amplifiedBy: ['Three sources of truth (RC-06)', 'Decision logic scattered across screens'],
    actions: ['ACT-03', 'ACT-11'],
    edgeCases: [],
    adrRefs: ['NESY-ARCH-003'],
  },
  {
    id: 'RC-13',
    title: 'God Object — validation and branching scattered across 8+ files',
    family: 'Architecture',
    mechanism: 'God Object',
    status: 'confirmed',
    confidence: 'high',
    repeatRisk: 'medium',
    summary:
      "Validation/business rules are scattered via if/else chains inside DeliveryFragment (4,074 LOC) and SharedViewModel (3,450 LOC). Rules such as D4Me GSM validation, RDOC-locker blocking, and multicolli size checks behave inconsistently in edge cases.",
    amplifiedBy: ['No centralized policy/validator', 'No UI state machine'],
    actions: ['ACT-08', 'ACT-09'],
    edgeCases: ['ED2', 'ED6', 'ED8'],
    adrRefs: ['ADR-02', 'ADR-08'],
  },
  {
    id: 'RC-14',
    title: 'Notification content/navigation logic is not centralized',
    family: 'Notification',
    mechanism: 'Scattered logic',
    status: 'probable',
    confidence: 'medium',
    repeatRisk: 'medium',
    summary:
      "Notification content is not produced in a single UseCase; because trigger conditions are scattered, incorrect/missing content is generated and errors remain silent (no metrics). When notification → screen navigation is done via LiveData chain instead of a one-shot UiEffect, there is a risk of loss/misdirection.",
    amplifiedBy: ['No observability (E35)', 'Time frame selection closed to the courier'],
    actions: ['ACT-12'],
    edgeCases: ['ES6', 'E35'],
    adrRefs: ['NESY-ARCH-004F'],
  },
  {
    id: 'RC-15',
    title: 'Location data is unreliable — no outlier filter and no normalized column',
    family: 'Location & GPS',
    mechanism: 'Data quality',
    status: 'confirmed',
    confidence: 'high',
    repeatRisk: 'high',
    summary:
      "Location is kept memory-only with no outlier filter; 0.0/invalid coordinates are accepted as 'valid' and sent to navigation. Stop coordinates cannot be filtered because they are not in a normalized column.",
    amplifiedBy: ['LocationService in a single class (399 LOC)', 'No coordinate SSoT'],
    actions: ['ACT-13', 'ACT-01'],
    edgeCases: ['E25'],
    adrRefs: ['ADR-10'],
  },
  {
    id: 'RC-16',
    title: 'Permission/service state not monitored at runtime',
    family: 'Location & GPS',
    mechanism: 'Missing monitor',
    status: 'confirmed',
    confidence: 'high',
    repeatRisk: 'low',
    summary:
      'When the location service is disabled or the permission is revoked, the app remains silent; the courier is not informed and there is no re-permission request flow.',
    amplifiedBy: ['No PermissionWatcher'],
    actions: ['ACT-14'],
    edgeCases: ['KN-4'],
    adrRefs: ['ADR-13'],
  },
  {
    id: 'RC-17',
    title: 'Event generation not in a single UseCase — incorrect/premature event types',
    family: 'Event & Sync',
    mechanism: 'Scattered logic',
    status: 'confirmed',
    confidence: 'medium',
    repeatRisk: 'medium',
    summary:
      "Events like TOUR/PTOU are generated in screen code: assigning TOUR to pickups, and TOUR being atomically emitted at scan time making postpone scenarios impossible are caused by this. Event generation should be moved to single UseCase points like CompleteDelivery/CompletePickup.",
    amplifiedBy: ['Scan dispatch ambiguity (RC-01)', 'No outbox (RC-08)'],
    actions: ['ACT-15', 'ACT-04'],
    edgeCases: ['ES7', 'E31'],
    adrRefs: ['NESY-ARCH-004'],
  },
  {
    id: 'RC-18',
    title: 'Legacy UI / config gaps — non-architectural records',
    family: 'UI & Config',
    mechanism: 'Feature gap',
    status: 'confirmed',
    confidence: 'high',
    repeatRisk: 'low',
    summary:
      "Bucket for records with no architectural root cause: numeric keyboard not opening, missing search bar, inability to manage undelivery reason list from config, NLOC confirmation screen requirement. Fixes are local; however, config records should link to the NESY-ARCH-003 app_config table.",
    amplifiedBy: ['Reason set hardcoded in code', 'Confirmation state not persisted'],
    actions: ['ACT-03'],
    edgeCases: [],
    adrRefs: ['NESY-ARCH-003'],
  },
]

// ── Kalıcı aksiyon havuzu ────────────────────────────────────────

export const ACTIONS: ArchAction[] = [
  {
    id: 'ACT-01',
    title: 'NESY-ARCH-001 — Normalize shipment şeması (ShipmentItemEntity + barcode index)',
    type: 'architecture',
    status: 'planned',
    rootCauses: ['RC-01', 'RC-02', 'RC-03', 'RC-15'],
    summary:
      'JSON chunk → ilişkisel yapı. barcode UNIQUE INDEX ile O(log n) sorgu, shipment.sender ve stop.latitude/longitude normalize kolonları.',
    verification: 'Büyük schedule (500+ stop) scan benchmark + ANR metriği; alan bazlı sorguların JSON parse içermediğinin kod denetimi.',
    ref: 'NESY-ARCH-001',
  },
  {
    id: 'ACT-02',
    title: 'NESY-ARCH-002 — ScheduleIngestor atomik replace',
    type: 'architecture',
    status: 'planned',
    rootCauses: ['RC-06'],
    summary: 'Schedule yazımı tek transaction içinde atomik replace; kısmi yazım ve chunk/SP bayat değer kombinasyonu ortadan kalkar.',
    verification: 'Rota değişikliği regression testi: eski rotanın hiçbir kaynakta (Room/SP/bellek) kalmadığının doğrulanması.',
    ref: 'NESY-ARCH-002',
  },
  {
    id: 'ACT-03',
    title: 'NESY-ARCH-003 — Room SSoT + reactive DAO + app_config',
    type: 'architecture',
    status: 'in-progress',
    rootCauses: ['RC-06', 'RC-07', 'RC-12', 'RC-18'],
    summary:
      "UI tek kaynaktan (DAO Flow<List<T>>) reaktif beslenir; bellek state (currentTask vb.) kaldırılır, reason set/config app_config tablosuna taşınır.",
    verification: 'DELY sonrası tracking ekranı tutarlılık testi; process-death sonrası state restore testi.',
    ref: 'NESY-ARCH-003',
  },
  {
    id: 'ACT-04',
    title: 'NESY-ARCH-004 — Outbox + SyncWorker + idempotency key',
    type: 'architecture',
    status: 'planned',
    rootCauses: ['RC-04', 'RC-05', 'RC-08', 'RC-10', 'RC-11', 'RC-17'],
    summary:
      "Her event UUID idempotency_key ile OutboxEventEntity'ye yazılır; SyncWorker FIFO gönderir. Telefon kapansa da event kaybolmaz, mükerrer gönderim yapısal olarak engellenir.",
    verification: 'App-kill / airplane-mode testleri: event kaybı 0; duplicate FCM/retry testinde backend tarafında tek event.',
    ref: 'NESY-ARCH-004',
  },
  {
    id: 'ACT-05',
    title: 'NESY-ARCH-005 — FCM işleme WorkManager ile serialize',
    type: 'architecture',
    status: 'planned',
    rootCauses: ['RC-05'],
    summary: 'FCM refresh işlemleri tek worker kuyruğunda sıralı çalışır; UI mutasyonuyla eş zamanlı yazma çakışması kalkar.',
    verification: 'Duplicate FCM + eş zamanlı UI aksiyonu race testi; çift TOUR reprodüksiyonunun negatife dönmesi.',
    ref: 'NESY-ARCH-005',
  },
  {
    id: 'ACT-06',
    title: 'ADR-05 — ScanCoordinator: tek scan giriş noktası',
    type: 'architecture',
    status: 'proposed',
    rootCauses: ['RC-01', 'RC-04'],
    summary:
      'Tüm barkod eventleri tek coordinator üzerinden screen-scoped BarcodeHandler\'lara dağıtılır; coordinator-scoped in-memory dedup set (ADR-09) ile restart = temiz başlangıç.',
    verification: 'Ekran geçişi anında scan testi (stop list → delivery); scan kaybı/yanlış ekran dispatch oranı 0.',
    ref: 'ADR-05 / ADR-09',
  },
  {
    id: 'ACT-07',
    title: 'ADR-07 — Outbox FIFO event zinciri (LCR→DDSP sıra garantisi)',
    type: 'architecture',
    status: 'proposed',
    rootCauses: ['RC-08', 'RC-09'],
    summary: 'Bağımlı event çiftleri (LCR→DDSP, CODC→CASH, DELY→fiscal) outbox içinde sıra garantisiyle gönderilir.',
    verification: 'Paralel event üretim testi: backend\'e varış sırasının her koşulda korunması.',
    ref: 'ADR-07',
  },
  {
    id: 'ACT-08',
    title: 'ADR-08 — Locker/D4Me policy: Validator + Strategy',
    type: 'code-fix',
    status: 'proposed',
    rootCauses: ['RC-13'],
    summary:
      'LockerProviderPolicy (Strategy) + LockerCapacityValidator + ayrık GSM validator: RDOC engeli, multicolli boyut kontrolü ve GSM kuralları tek noktada.',
    verification: 'Servis kombinasyonu matrisi üzerinde parametrik unit testler (RDOC × multicolli × GSM).',
    ref: 'ADR-08',
  },
  {
    id: 'ACT-09',
    title: 'ADR-02 — God Object parçalama: ekran başına ViewModel',
    type: 'architecture',
    status: 'proposed',
    rootCauses: ['RC-05', 'RC-07', 'RC-13'],
    summary: 'SharedViewModel/DeliveryFragment sorumlulukları ekran bazlı ViewModel + UseCase katmanına bölünür; UiEffect Channel ile tek seferlik efektler.',
    verification: 'Bildirim sonrası scan crash reprodüksiyonu negatif; state sızıntısı (stale task) regression suite.',
    ref: 'ADR-02',
  },
  {
    id: 'ACT-10',
    title: 'Fiscal FSM — teslim → tahsilat → fiscal sıra makinesi',
    type: 'architecture',
    status: 'proposed',
    rootCauses: ['RC-09', 'RC-10'],
    summary:
      'Fiscal üretimi durum makinesine bağlanır: teslim onaylanmadan fiscal kesilmez, stop bazında gruplanır, her fiş DB kilidi + idempotency ile tek etki üretir. Zaman penceresi kuralları sıralama garantisiyle değiştirilir.',
    verification: "Kısmi teslim, iptal (cancel fiscal), çoklu pickup ve reprint senaryolarında event log denetimi: 'VPFR var ama DELY yok' tutarsızlığı 0.",
    ref: 'NESY-ARCH-004 / RS fiscal',
  },
  {
    id: 'ACT-11',
    title: 'Payment FSM — POS öncesi persist + recovery',
    type: 'architecture',
    status: 'proposed',
    rootCauses: ['RC-11', 'RC-12'],
    summary:
      "Ödeme POS'a gönderilmeden önce DB'ye yazılır; uygulama açılışında yarım kalan ödemeler tamamlanır. CODC→CASH ikilisi outbox üzerinden sıralı gider; ödeme tipi normalize kaynaktan okunur.",
    verification: 'POS onayı sonrası app-kill testi: ödeme kaybı 0, çift tahsilat 0; gün sonu mutabakat farkı metriği.',
    ref: 'NESY-ARCH-004',
  },
  {
    id: 'ACT-12',
    title: 'Notification içerik UseCase + UiEffect + structured logging',
    type: 'code-fix',
    status: 'proposed',
    rootCauses: ['RC-14'],
    summary:
      'Bildirim içeriği tek UseCase\'te üretilir, navigasyon tek seferlik UiEffect ile yapılır (stop detayına deep-link), içerik hataları structured log/metrik ile görünür kılınır.',
    verification: 'İçerik şablonu snapshot testleri + bildirim tıklama → doğru stop detayı E2E testi.',
    ref: 'NESY-ARCH-004F',
  },
  {
    id: 'ACT-13',
    title: 'ADR-10 — Konum OutlierFilter + koordinat normalize',
    type: 'code-fix',
    status: 'proposed',
    rootCauses: ['RC-15'],
    summary: 'Speed+distance+accuracy tabanlı outlier filtresi; 0.0/geçersiz koordinat ayıklanır, stop.latitude/longitude normalize kolondan okunur.',
    verification: 'Navigasyon intent testlerinde geçersiz koordinat oranı 0; saha GPS log örneklemi denetimi.',
    ref: 'ADR-10',
  },
  {
    id: 'ACT-14',
    title: 'ADR-13 — PermissionWatcher: runtime izin/servis izleme',
    type: 'monitoring',
    status: 'proposed',
    rootCauses: ['RC-16'],
    summary: 'Konum servisi/izin durumu runtime izlenir; kapalı/revoke durumunda UI uyarısı + yeniden talep akışı.',
    verification: 'İzin revoke + servis kapatma senaryolarında uyarının göründüğü UI testi.',
    ref: 'ADR-13',
  },
  {
    id: 'ACT-15',
    title: 'Event UseCase konsolidasyonu — CompleteDelivery / CompletePickup',
    type: 'code-fix',
    status: 'proposed',
    rootCauses: ['RC-03', 'RC-17'],
    summary:
      'TOUR/PTOU/DELY event üretimi ekran kodundan çıkarılıp tek UseCase noktalarına alınır (outbox.enqueue ile); erteleme gibi akışlar event üretiminden ayrışır.',
    verification: 'Pickup → PTOU, delivery → DELY event tipi unit testleri; postpone senaryosunda TOUR üretilmediğinin doğrulanması.',
    ref: 'NESY-ARCH-004',
  },
]

// ── Türetilmiş koleksiyonlar ─────────────────────────────────────

export const FIELD_TICKETS: FieldTicket[] = FIELD_TICKET_RECORDS

export const RC_BY_ID = new Map(ROOT_CAUSES.map((rc) => [rc.id, rc]))
export const ACTION_BY_ID = new Map(ACTIONS.map((a) => [a.id, a]))

export function ticketsOf(rcId: string): FieldTicket[] {
  return FIELD_TICKETS.filter((t) => t.rootCause === rcId || t.contributing.includes(rcId))
}

export function primaryTicketsOf(rcId: string): FieldTicket[] {
  return FIELD_TICKETS.filter((t) => t.rootCause === rcId)
}

export function actionTickets(actionId: string): FieldTicket[] {
  const act = ACTION_BY_ID.get(actionId)
  if (!act) return []
  return FIELD_TICKETS.filter((t) => act.rootCauses.includes(t.rootCause))
}

// ── KPI'lar ──────────────────────────────────────────────────────

export function fieldTicketKpis() {
  const total = FIELD_TICKETS.length
  const open = FIELD_TICKETS.filter((t) => t.status === 'open').length
  const critical = FIELD_TICKETS.filter((t) => t.severity === 'critical').length
  const workaroundClosed = FIELD_TICKETS.filter(
    (t) => t.status === 'closed' && t.fixType === 'workaround',
  ).length
  const highRepeatRc = ROOT_CAUSES.filter((rc) => rc.repeatRisk === 'high').length
  const unclear = FIELD_TICKETS.filter((t) => t.confidence < 65).length
  const openActions = ACTIONS.filter(
    (a) => a.status !== 'completed' && a.status !== 'accepted-risk',
  ).length
  const linked = FIELD_TICKETS.filter(
    (t) => t.rootCause && t.edgeCases.length + (t.fix ? 1 : 0) > 0,
  ).length
  const coverage = Math.round((linked / total) * 100)
  return {
    total,
    open,
    critical,
    rootCauses: ROOT_CAUSES.length,
    families: new Set(FIELD_TICKETS.map((t) => t.group)).size,
    workaroundClosed,
    highRepeatRc,
    unclear,
    openActions,
    coverage,
  }
}

// ── Arama (serbest metin + key:value komutları) ──────────────────

const SEARCH_KEYS = [
  'severity', 'status', 'country', 'group', 'screen', 'rootcause', 'risk',
  'fix', 'confidence', 'edge', 'type', 'workaround', 'action',
] as const

function matchesToken(t: FieldTicket, key: string, value: string): boolean {
  const v = value.toLowerCase().replace(/^"|"$/g, '')
  const rc = RC_BY_ID.get(t.rootCause)
  switch (key) {
    case 'severity': return t.severity === v
    case 'status': return t.status === v
    case 'country': return t.country.toLowerCase() === v
    case 'group': return t.group.toLowerCase().includes(v)
    case 'screen': return t.screen.toLowerCase().includes(v)
    case 'rootcause':
      return (
        t.rootCause.toLowerCase() === v ||
        (rc ? rc.title.toLowerCase().includes(v) || rc.mechanism.toLowerCase().includes(v) : false)
      )
    case 'risk': return v === 'repeat' ? t.repeatRisk === 'high' : t.repeatRisk === v
    case 'fix': return v === 'false' || v === 'none' ? t.fixType !== 'permanent' : t.fixType === v
    case 'workaround': return (t.fixType === 'workaround') === (v === 'true')
    case 'confidence':
      return v === 'low' ? t.confidence < 65 : v === 'high' ? t.confidence >= 80 : t.confidence >= 65 && t.confidence < 80
    case 'edge': return t.edgeCases.some((e) => e.toLowerCase() === v)
    case 'type': return t.type === v
    case 'action': {
      if (!rc) return false
      const acts = ACTIONS.filter((a) => a.rootCauses.includes(rc.id))
      return v === 'open'
        ? acts.some((a) => a.status !== 'completed' && a.status !== 'accepted-risk')
        : acts.some((a) => a.id.toLowerCase() === v || a.status === v)
    }
    default: return true
  }
}

export function searchFieldTickets(query: string, items: FieldTicket[]): FieldTicket[] {
  const q = query.trim()
  if (!q) return items
  // "key:value" ve "key:\"çok kelime\"" token'larını ayıkla
  const tokenRe = /(\w+):("([^"]*)"|\S+)/g
  const tokens: Array<[string, string]> = []
  let rest = q
  let m: RegExpExecArray | null
  while ((m = tokenRe.exec(q)) !== null) {
    const key = (m[1] ?? '').toLowerCase()
    if ((SEARCH_KEYS as readonly string[]).includes(key)) {
      tokens.push([key, m[3] ?? m[2] ?? ''])
      rest = rest.replace(m[0], ' ')
    }
  }
  const free = rest.trim().toLowerCase()
  return items.filter((t) => {
    for (const [k, v] of tokens) if (!matchesToken(t, k, v)) return false
    if (!free) return true
    const rc = RC_BY_ID.get(t.rootCause)
    const hay = [
      t.id, t.customerTicket, t.title, t.symptom, t.rootNote, t.location,
      t.screen, t.group, t.country, t.fix, t.pastAttempt,
      rc?.id ?? '', rc?.title ?? '', ...t.edgeCases,
    ].join(' ').toLowerCase()
    return free.split(/\s+/).every((w) => hay.includes(w))
  })
}

// ── Hızlı filtreler & Saved Views ────────────────────────────────

export interface TicketFilter {
  id: string
  label: string
  desc?: string
  match: (t: FieldTicket) => boolean
}

export const QUICK_FILTERS: TicketFilter[] = [
  { id: 'open', label: 'Açık', match: (t) => t.status === 'open' },
  { id: 'crit', label: 'Kritik / Yüksek', match: (t) => t.severity !== 'medium' },
  { id: 'repeat', label: 'Yüksek tekrar riski', match: (t) => t.repeatRisk === 'high' },
  { id: 'wa', label: 'Workaround ile kapalı', match: (t) => t.status === 'closed' && t.fixType === 'workaround' },
  { id: 'nofix', label: 'Kalıcı çözüm yok', match: (t) => t.fixType !== 'permanent' },
  { id: 'lowconf', label: 'Kök nedeni belirsiz', match: (t) => t.confidence < 65 },
  { id: 'finance', label: 'Finans & Ödeme', match: (t) => t.group === 'Finans & Ödeme' },
]

export const SAVED_VIEWS: TicketFilter[] = [
  {
    id: 'exec-risk',
    label: 'Executive Risk',
    desc: 'Kritik/yüksek + yüksek tekrar riski — kalıcı aksiyonu açık kayıtlar',
    match: (t) => t.severity !== 'medium' && t.repeatRisk === 'high' && t.fixType !== 'permanent',
  },
  {
    id: 'rc-unknown',
    label: 'Root Cause Unknown',
    desc: 'Kök neden teşhisi düşük güvenli (confidence < 65)',
    match: (t) => t.confidence < 65,
  },
  {
    id: 'wa-debt',
    label: 'Workaround Debt',
    desc: 'Ticket kapalı, workaround var, kalıcı çözüm yok',
    match: (t) => t.status === 'closed' && t.fixType === 'workaround',
  },
  {
    id: 'repeat-offenders',
    label: 'Repeat Offenders',
    desc: 'Aynı kanonik kök nedene bağlı 3+ ticket',
    match: (t) => primaryTicketsOf(t.rootCause).length >= 3,
  },
  {
    id: 'financial-safety',
    label: 'Financial Safety',
    desc: 'Ödeme, fiscal ve mutabakat güvenliğini etkileyen kayıtlar',
    match: (t) => ['RC-09', 'RC-10', 'RC-11', 'RC-12'].includes(t.rootCause) || t.group === 'Finans & Ödeme',
  },
  {
    id: 'verification-queue',
    label: 'Verification Queue',
    desc: 'Müdahale uygulanmış ancak doğrulaması yapılmamış kayıtlar',
    match: (t) => t.pastAttempt !== '' && t.repeatRisk !== 'low',
  },
]

export const LAST_UPDATED = '2026-07-12'
export const DATA_SOURCES = 'GitHub (nesy-analysis) + UAT + Architecture Reports'
