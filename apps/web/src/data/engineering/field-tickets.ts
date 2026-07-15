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

// ── Permanent action pool ────────────────────────────────────────

export const ACTIONS: ArchAction[] = [
  {
    id: 'ACT-01',
    title: 'NESY-ARCH-001 — Normalize shipment schema (ShipmentItemEntity + barcode index)',
    type: 'architecture',
    status: 'planned',
    rootCauses: ['RC-01', 'RC-02', 'RC-03', 'RC-15'],
    summary:
      'JSON chunk → relational structure. O(log n) query with barcode UNIQUE INDEX, normalized columns for shipment.sender and stop.latitude/longitude.',
    verification: 'Large schedule (500+ stops) scan benchmark + ANR metrics; code audit to verify field-based queries do not contain JSON parsing.',
    ref: 'NESY-ARCH-001',
  },
  {
    id: 'ACT-02',
    title: 'NESY-ARCH-002 — ScheduleIngestor atomic replace',
    type: 'architecture',
    status: 'planned',
    rootCauses: ['RC-06'],
    summary: 'Schedule writing with atomic replace in a single transaction; partial writing and chunk/SP stale value combinations are eliminated.',
    verification: 'Route change regression test: verification that the old route does not remain in any source (Room/SP/memory).',
    ref: 'NESY-ARCH-002',
  },
  {
    id: 'ACT-03',
    title: 'NESY-ARCH-003 — Room SSoT + reactive DAO + app_config',
    type: 'architecture',
    status: 'in-progress',
    rootCauses: ['RC-06', 'RC-07', 'RC-12', 'RC-18'],
    summary:
      "UI is fed reactively from a single source (DAO Flow<List<T>>); memory state (currentTask etc.) is removed, reason set/config is moved to app_config table.",
    verification: 'Tracking screen consistency test after DELY; state restore test after process death.',
    ref: 'NESY-ARCH-003',
  },
  {
    id: 'ACT-04',
    title: 'NESY-ARCH-004 — Outbox + SyncWorker + idempotency key',
    type: 'architecture',
    status: 'planned',
    rootCauses: ['RC-04', 'RC-05', 'RC-08', 'RC-10', 'RC-11', 'RC-17'],
    summary:
      "Every event is written to OutboxEventEntity with a UUID idempotency_key; SyncWorker sends FIFO. Events are not lost even if the phone turns off, duplicate submissions are structurally prevented.",
    verification: 'App-kill / airplane-mode tests: event loss 0; single event on the backend side in duplicate FCM/retry test.',
    ref: 'NESY-ARCH-004',
  },
  {
    id: 'ACT-05',
    title: 'NESY-ARCH-005 — FCM processing serialized with WorkManager',
    type: 'architecture',
    status: 'planned',
    rootCauses: ['RC-05'],
    summary: 'FCM refresh operations run sequentially in a single worker queue; concurrent write collision with UI mutation is eliminated.',
    verification: 'Duplicate FCM + concurrent UI action race test; negative reproduction of double TOUR.',
    ref: 'NESY-ARCH-005',
  },
  {
    id: 'ACT-06',
    title: 'ADR-05 — ScanCoordinator: single scan entry point',
    type: 'architecture',
    status: 'proposed',
    rootCauses: ['RC-01', 'RC-04'],
    summary:
      'All barcode events are distributed to screen-scoped BarcodeHandlers via a single coordinator; restart = clean start with coordinator-scoped in-memory dedup set (ADR-09).',
    verification: 'Scan test during screen transition (stop list → delivery); scan loss / wrong screen dispatch rate 0.',
    ref: 'ADR-05 / ADR-09',
  },
  {
    id: 'ACT-07',
    title: 'ADR-07 — Outbox FIFO event chain (LCR→DDSP sequence guarantee)',
    type: 'architecture',
    status: 'proposed',
    rootCauses: ['RC-08', 'RC-09'],
    summary: 'Dependent event pairs (LCR→DDSP, CODC→CASH, DELY→fiscal) are sent in the outbox with sequence guarantee.',
    verification: 'Parallel event generation test: arrival sequence to backend is preserved under all conditions.',
    ref: 'ADR-07',
  },
  {
    id: 'ACT-08',
    title: 'ADR-08 — Locker/D4Me policy: Validator + Strategy',
    type: 'code-fix',
    status: 'proposed',
    rootCauses: ['RC-13'],
    summary:
      'LockerProviderPolicy (Strategy) + LockerCapacityValidator + separate GSM validator: RDOC block, multicolli size control, and GSM rules in one place.',
    verification: 'Parametric unit tests over service combination matrix (RDOC × multicolli × GSM).',
    ref: 'ADR-08',
  },
  {
    id: 'ACT-09',
    title: 'ADR-02 — God Object breakdown: ViewModel per screen',
    type: 'architecture',
    status: 'proposed',
    rootCauses: ['RC-05', 'RC-07', 'RC-13'],
    summary: 'SharedViewModel/DeliveryFragment responsibilities are divided into screen-based ViewModel + UseCase layers; one-shot effects via UiEffect Channel.',
    verification: 'Scan crash reproduction after notification is negative; state leak (stale task) regression suite.',
    ref: 'ADR-02',
  },
  {
    id: 'ACT-10',
    title: 'Fiscal FSM — delivery → collection → fiscal sequence machine',
    type: 'architecture',
    status: 'proposed',
    rootCauses: ['RC-09', 'RC-10'],
    summary:
      'Fiscal generation is bound to a state machine: fiscal is not generated without delivery confirmation, grouped on a stop basis, each receipt produces a single effect with DB lock + idempotency. Time window rules are replaced with a sequence guarantee.',
    verification: "Event log audit in partial delivery, cancellation (cancel fiscal), multi pickup, and reprint scenarios: 'VPFR exists but no DELY' inconsistency 0.",
    ref: 'NESY-ARCH-004 / RS fiscal',
  },
  {
    id: 'ACT-11',
    title: 'Payment FSM — pre-POS persist + recovery',
    type: 'architecture',
    status: 'proposed',
    rootCauses: ['RC-11', 'RC-12'],
    summary:
      "Payment is written to DB before being sent to POS; incomplete payments are finalized at app startup. CODC→CASH pair goes sequentially via outbox; payment type is read from a normalized source.",
    verification: 'App-kill test after POS confirmation: payment loss 0, double collection 0; end-of-day reconciliation difference metric.',
    ref: 'NESY-ARCH-004',
  },
  {
    id: 'ACT-12',
    title: 'Notification content UseCase + UiEffect + structured logging',
    type: 'code-fix',
    status: 'proposed',
    rootCauses: ['RC-14'],
    summary:
      'Notification content is generated in a single UseCase, navigation is done with a one-shot UiEffect (deep-link to stop details), content errors are made visible with structured log/metrics.',
    verification: 'Content template snapshot tests + notification click → correct stop details E2E test.',
    ref: 'NESY-ARCH-004F',
  },
  {
    id: 'ACT-13',
    title: 'ADR-10 — Location OutlierFilter + normalize coordinates',
    type: 'code-fix',
    status: 'proposed',
    rootCauses: ['RC-15'],
    summary: 'Speed+distance+accuracy based outlier filter; 0.0/invalid coordinates are filtered out, stop.latitude/longitude is read from normalized column.',
    verification: 'Invalid coordinate rate 0 in navigation intent tests; field GPS log sampling audit.',
    ref: 'ADR-10',
  },
  {
    id: 'ACT-14',
    title: 'ADR-13 — PermissionWatcher: runtime permission/service monitoring',
    type: 'monitoring',
    status: 'proposed',
    rootCauses: ['RC-16'],
    summary: 'Location service/permission status is monitored at runtime; in case of disabled/revoke, UI warning + re-request flow.',
    verification: 'UI test showing warning in permission revoke + service disabled scenarios.',
    ref: 'ADR-13',
  },
  {
    id: 'ACT-15',
    title: 'Event UseCase konsolidasyonu — CompleteDelivery / CompletePickup',
    type: 'code-fix',
    status: 'proposed',
    rootCauses: ['RC-03', 'RC-17'],
    summary:
      'TOUR/PTOU/DELY event generation is moved out of screen code to single UseCase points (with outbox.enqueue); flows like postpone are separated from event generation.',
    verification: 'Pickup → PTOU, delivery → DELY event type unit tests; validation that TOUR is not generated in postpone scenario.',
    ref: 'NESY-ARCH-004',
  },
]

// ── Derived collections ─────────────────────────────────────

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

// ── KPIs ──────────────────────────────────────────────────────

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

// ── Search (free text + key:value commands) ──────────────────

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
  // Extract "key:value" and "key:\"multi word\"" tokens
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

// ── Quick filters & Saved Views ────────────────────────────────

export interface TicketFilter {
  id: string
  label: string
  desc?: string
  match: (t: FieldTicket) => boolean
}

export const QUICK_FILTERS: TicketFilter[] = [
  { id: 'open', label: 'Open', match: (t) => t.status === 'open' },
  { id: 'crit', label: 'Critical / High', match: (t) => t.severity !== 'medium' },
  { id: 'repeat', label: 'High repeat risk', match: (t) => t.repeatRisk === 'high' },
  { id: 'wa', label: 'Closed with workaround', match: (t) => t.status === 'closed' && t.fixType === 'workaround' },
  { id: 'nofix', label: 'No permanent fix', match: (t) => t.fixType !== 'permanent' },
  { id: 'lowconf', label: 'Unclear root cause', match: (t) => t.confidence < 65 },
  { id: 'finance', label: 'Finance & Payment', match: (t) => t.group === 'Finance & Payment' },
]

export const SAVED_VIEWS: TicketFilter[] = [
  {
    id: 'exec-risk',
    label: 'Executive Risk',
    desc: 'Critical/high + high repeat risk — permanent action is open records',
    match: (t) => t.severity !== 'medium' && t.repeatRisk === 'high' && t.fixType !== 'permanent',
  },
  {
    id: 'rc-unknown',
    label: 'Root Cause Unknown',
    desc: 'Root cause diagnosis with low confidence (confidence < 65)',
    match: (t) => t.confidence < 65,
  },
  {
    id: 'wa-debt',
    label: 'Workaround Debt',
    desc: 'Ticket closed, has workaround, no permanent fix',
    match: (t) => t.status === 'closed' && t.fixType === 'workaround',
  },
  {
    id: 'repeat-offenders',
    label: 'Repeat Offenders',
    desc: '3+ tickets linked to the same canonical root cause',
    match: (t) => primaryTicketsOf(t.rootCause).length >= 3,
  },
  {
    id: 'financial-safety',
    label: 'Financial Safety',
    desc: 'Records affecting payment, fiscal, and reconciliation safety',
    match: (t) => ['RC-09', 'RC-10', 'RC-11', 'RC-12'].includes(t.rootCause) || t.group === 'Finance & Payment',
  },
  {
    id: 'verification-queue',
    label: 'Verification Queue',
    desc: 'Records with intervention applied but verification pending',
    match: (t) => t.pastAttempt !== '' && t.repeatRisk !== 'low',
  },
]

export const LAST_UPDATED = '2026-07-12'
export const DATA_SOURCES = 'GitHub (nesy-analysis) + UAT + Architecture Reports'
