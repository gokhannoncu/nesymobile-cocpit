// Nesy Mobile edge-case map — single source of truth.
// Source: NesyMobile Architecture Health Scan (June 2026) E1–E33 catalogue.
// Each record: trigger condition, operational impact, and mitigation approach.

export type EdgeCategory =
  | 'data'
  | 'state'
  | 'offline'
  | 'conflict'
  | 'ui'
  | 'api'
  | 'location'
  | 'payment'
  | 'scan'

export type Severity = 'critical' | 'high' | 'medium'

export interface EdgeCase {
  id: string
  title: string
  category: EdgeCategory
  severity: Severity
  /** When / how is it triggered? */
  trigger: string
  /** What breaks in the field and in the data? */
  impact: string
  /** Brief mitigation / modernization approach. */
  mitigation: string
}

export const EDGE_CATEGORIES: Record<EdgeCategory, { label: string; desc: string }> = {
  data: { label: 'Data & DB', desc: 'Room JSON chunk structure and migration safeguards' },
  state: { label: 'State Copies', desc: 'Room / SharedViewModel / SharedPreferences divergence' },
  offline: { label: 'Offline Sync', desc: 'RequestSenderService queue and retry behaviour' },
  conflict: { label: 'Conflict Resolution', desc: 'Schedule refresh and merge rules' },
  ui: { label: 'Presentation Layer', desc: 'Fragment lifecycle and observer behaviour' },
  api: { label: 'API & Auth', desc: 'Token, host selection and TLS configuration' },
  location: { label: 'Location Tracking', desc: 'GPS sampling, batch upload and permissions' },
  payment: { label: 'Payment & Fiscal', desc: 'POS flows, idempotency and fiscal records' },
  scan: { label: 'Scan & Barcode', desc: 'Multi-input channel and dedup state' },
}

export const EDGE_CASES: EdgeCase[] = [
  // ── Data & DB (JSON chunk risk) ─────────────────────────────
  {
    id: 'E1',
    title: 'Push refresh collision',
    category: 'data',
    severity: 'critical',
    trigger: 'FCM refresh and local delivery write update the same schedule chunk simultaneously.',
    impact: 'Without transaction / conflict management the last writer wins; delivery records may be lost.',
    mitigation: 'Relational row model + transactions instead of chunks; centralised conflict policy.',
  },
  {
    id: 'E2',
    title: 'Corrupt JSON chunk',
    category: 'data',
    severity: 'high',
    trigger: 'Chunk is left incomplete after a crash or cannot be parsed.',
    impact: 'Local changes may be skipped; work produced offline may be lost.',
    mitigation: 'Row-level schema + post-write validation; recovery procedure.',
  },
  {
    id: 'E3',
    title: 'Migration data loss',
    category: 'data',
    severity: 'critical',
    trigger: 'Schema v240; when v241 migration is missing, fallbackToDestructiveMigration() kicks in.',
    impact: 'All local data including schedule + pending request records may be wiped.',
    mitigation: 'Disable destructive fallback; migration test suite + version gate.',
  },
  {
    id: 'E4',
    title: 'Gson-induced ANR',
    category: 'data',
    severity: 'high',
    trigger: 'Hundreds of Gson parse/serialize calls on the main thread for a route with 200+ stops (allowMainThreadQueries enabled).',
    impact: 'UI freezes; the courier kills and restarts the app mid-day.',
    mitigation: 'Ban main thread queries; IO dispatcher + paginated queries.',
  },
  // ── State copies ──────────────────────────────────────────
  {
    id: 'E5',
    title: 'Paid status is volatile',
    category: 'state',
    severity: 'critical',
    trigger: 'paidShipments is held only in SharedViewModel memory, not persisted.',
    impact: 'Payment flow may reopen after restart — risk of double collection.',
    mitigation: 'Payment status is atomically written to Room; tied to delivery confirmation.',
  },
  {
    id: 'E6',
    title: 'Schedule mismatch',
    category: 'state',
    severity: 'high',
    trigger: 'DB carries the new schedule while SharedPreferences retains the old scheduleId.',
    impact: 'Requests proceed under the wrong schedule; operations reports diverge.',
    mitigation: 'Single source of truth (Room); scheduleId becomes a derived value.',
  },
  {
    id: 'E7',
    title: 'Offline mode stays locked',
    category: 'state',
    severity: 'high',
    trigger: 'When isOfflineMode remains true, RequestSenderService skips sending even when connectivity returns.',
    impact: 'Queue stalls for a long time; events reach the back-office late.',
    mitigation: 'Automatic mode reset via connectivity callback + monitoring metric.',
  },
  // ── Offline sync (RequestSenderService) ──────────────────────
  {
    id: 'E8',
    title: 'Zombie request',
    category: 'offline',
    severity: 'high',
    trigger: 'isProcessing is set to true and only reset to false in the error path; no recovery. If the service dies the record stays locked.',
    impact: 'Request queue is blocked; subsequent events cannot be sent.',
    mitigation: 'Lease/timeout for processing state; stale lock cleanup on start.',
  },
  {
    id: 'E9',
    title: 'Duplicate submission',
    category: 'offline',
    severity: 'critical',
    trigger: 'uniqueKey is only a local unique index; no server-side idempotency guarantee.',
    impact: 'The same delivery/collection event may be processed twice on the server.',
    mitigation: 'End-to-end idempotency key; server-side dedup.',
  },
  {
    id: 'E10',
    title: 'Order violation',
    category: 'offline',
    severity: 'high',
    trigger: 'No aggregate-level ordering; no order guarantee between events.',
    impact: 'Delivery may be processed before cancellation; state machine breaks.',
    mitigation: 'Per-shipment FIFO queue; sequence number.',
  },
  {
    id: 'E11',
    title: 'Retry storm',
    category: 'offline',
    severity: 'medium',
    trigger: 'No backoff/jitter; all devices load synchronously at a 3 s rhythm. After tryCount<3 the request is moved to CompletedRequest.',
    impact: 'Simultaneous load on the backend; failed request silently falls to "completed".',
    mitigation: 'Exponential backoff + jitter; dead-letter queue + alarm.',
  },
  {
    id: 'E12',
    title: 'FGS / Doze interruption',
    category: 'offline',
    severity: 'medium',
    trigger: 'As Android foreground service and Doze restrictions increase, the fixed polling model is disrupted.',
    impact: 'Queue is not processed; end-of-day data is incomplete.',
    mitigation: 'WorkManager-based scheduling; constraint-aware triggering.',
  },
  // ── Conflict resolution ──────────────────────────────────────
  {
    id: 'E13',
    title: 'Server cancellation is overwritten',
    category: 'conflict',
    severity: 'critical',
    trigger: 'While an offline delivery is queued, the shipment is CANCELLED on the server; during refresh the local list hides this.',
    impact: 'Courier goes to a cancelled parcel; field misdirection.',
    mitigation: 'Centralised conflict policy: server cancellation always remains visible.',
  },
  {
    id: 'E14',
    title: 'Delivery rollback view',
    category: 'conflict',
    severity: 'high',
    trigger: 'If an old replica response arrives right after a delivery is sent, the parcel appears open again on screen.',
    impact: 'Risk of the same parcel being processed twice; courier confusion.',
    mitigation: 'Timestamp/version comparison applied across all branches.',
  },
  {
    id: 'E15',
    title: 'Push race state loss',
    category: 'conflict',
    severity: 'high',
    trigger: 'FCM refresh races with item mutation on the delivery screen.',
    impact: 'Scanned item status may be lost.',
    mitigation: 'Screen-active mutations are included in the refresh merge.',
  },
  // ── Presentation layer ────────────────────────────────────────
  {
    id: 'E16',
    title: 'Double fiscal request on rotation',
    category: 'ui',
    severity: 'critical',
    trigger: 'Observer rebinds on rotation while the fiscal dialog is open; createFiscalInvoice fires again.',
    impact: 'Risk of duplicate fiscal record (legal audit finding in RS).',
    mitigation: 'One-shot event (SingleLiveEvent/Flow) + idempotency key.',
  },
  {
    id: 'E17',
    title: 'Wrong parcel delivered',
    category: 'ui',
    severity: 'critical',
    trigger: 'If SharedViewModel.currentTask is not cleared, the old task remains in memory; at another stop the flow runs with the wrong task.',
    impact: 'Wrong parcel delivery confirmation; operational chaos + dispute.',
    mitigation: 'Scoped state + task validation on screen entry.',
  },
  {
    id: 'E18',
    title: 'Ghost dialog',
    category: 'ui',
    severity: 'medium',
    trigger: 'A delayed response after fragment pause/back tries to open a dialog on an invalid view.',
    impact: 'Crash / ANR risk.',
    mitigation: 'Lifecycle-aware collect; view validity check.',
  },
  {
    id: 'E19',
    title: 'ContentObserver leak',
    category: 'ui',
    severity: 'medium',
    trigger: 'If the observer is not unregistered it accumulates; a single call-permission event triggers multiple observers.',
    impact: 'Multiple call log writes and repeated operations.',
    mitigation: 'Lifecycle-bound register/unregister; singleton observer.',
  },
  // ── API & Auth ───────────────────────────────────────────────
  {
    id: 'E20',
    title: 'Silent logout mid-shift',
    category: 'api',
    severity: 'critical',
    trigger: 'Token expires (no refresh); the next call gets 401, ErrorInterceptor silently logs the user out.',
    impact: 'Half-completed delivery, payment flow interrupted; queued offline requests are left without a token. Field crisis: "I completed the action but the system kicked me out".',
    mitigation: 'Refresh token flow; session renewal for the queue + user warning.',
  },
  {
    id: 'E21',
    title: 'Uncontrolled host redirect',
    category: 'api',
    severity: 'critical',
    trigger: 'alternativeURL/Port/Http prefs values are used without validation; no allowlist.',
    impact: 'Traffic may be redirected to an unexpected backend; TLS checks are also ineffective due to TrustAllCerts.',
    mitigation: 'Host allowlist + format validation; remove TrustAllCerts.',
  },
  {
    id: 'E22',
    title: 'Cipher/signature error undiagnosable',
    category: 'api',
    severity: 'high',
    trigger: 'Cipher/signature generation fails on signed requests like GetMySchedule, DeliverParcels.',
    impact: 'Error turns into a generic error; real cause is hidden, resolution time increases.',
    mitigation: 'Centralised error classification; dedicated diagnostic log for signature errors.',
  },
  // ── Location tracking ─────────────────────────────────────────
  {
    id: 'E23',
    title: 'Location table bloats on connectivity-less days',
    category: 'location',
    severity: 'medium',
    trigger: 'If upload continuously fails, the LiveLocation table grows without a retention/cleanup policy.',
    impact: 'Queries slow down, batch operations become heavy; ANR risk on older devices.',
    mitigation: 'Retention + max record policy; staged cleanup.',
  },
  {
    id: 'E24',
    title: '9-sample black hole',
    category: 'location',
    severity: 'medium',
    trigger: 'Batch threshold is 10 records; if the service dies with 5–9 records they cannot be sent until the next batch fills up.',
    impact: 'Courier "disappears" on the dispatch screen for a while.',
    mitigation: 'Time-based flush (threshold OR duration); drain on service shutdown.',
  },
  {
    id: 'E25',
    title: 'Revoked permission leaves service misleading',
    category: 'location',
    severity: 'high',
    trigger: 'User revokes location permission mid-day; SecurityException is caught and only logged.',
    impact: 'Service appears to be running; dispatch relies on stale/missing location. No clear warning to the user.',
    mitigation: 'Permission state is continuously monitored; user + dispatch are notified.',
  },
  {
    id: 'E26',
    title: 'GPS jump corrupts metrics',
    category: 'location',
    severity: 'medium',
    trigger: 'A single bad GPS fix creates a large jump; no outlier filter, the jump is added to distance.',
    impact: 'Route alignment, total distance and field reports are produced incorrectly.',
    mitigation: 'Outlier filtering + speed/distance plausibility check.',
  },
  // ── Payment & Fiscal ───────────────────────────────────────
  {
    id: 'E27',
    title: 'Payment collected, delivery record not created',
    category: 'payment',
    severity: 'critical',
    trigger: 'POS payment returns success; but the process dies before handleDelivery() is called. Payment is not persisted.',
    impact: 'System does not know payment was collected; flow may restart — double collection or cash discrepancy.',
    mitigation: '"Payment received / delivery pending" intermediate state is atomically written to DB.',
  },
  {
    id: 'E28',
    title: 'Orphan fiscal invoice',
    category: 'payment',
    severity: 'critical',
    trigger: 'Fiscal record is created before delivery; if delivery fails, an unmatched invoice remains in the fiscal system.',
    impact: 'Operational data and financial records diverge; legal audit risk in RS/BA.',
    mitigation: 'Fiscal is tied to delivery confirmation; compensation (void/SSC) flow is defined.',
  },
  {
    id: 'E29',
    title: 'Rotation-induced double fiscal record',
    category: 'payment',
    severity: 'high',
    trigger: 'Rotation occurs while the fiscal dialog is open; observer rebinds and the fiscal request may fire a second time.',
    impact: 'Without idempotency, two fiscal records may be created for the same collection.',
    mitigation: 'Idempotency key for fiscal request; one-shot event.',
  },
  {
    id: 'E30',
    title: 'Payment status lost after restart',
    category: 'payment',
    severity: 'critical',
    trigger: 'Payment info is held only in memory/callback; when the app restarts the shipment appears "unpaid".',
    impact: 'POS flow may restart — double collection or erroneous payment attempt.',
    mitigation: 'Payment state machine is moved to persistent storage (Room).',
  },
  // ── Scan & Barcode ────────────────────────────────────────
  {
    id: 'E31',
    title: 'Scan lost during screen transition',
    category: 'scan',
    severity: 'high',
    trigger: 'Hardware scan arrives during TaskList to Delivery transition; event is processed before the active screen is resolved.',
    impact: 'Barcode may be lost or interpreted in the context of the previous screen; wrong operation (custody, filtering) is triggered.',
    mitigation: 'Single Scan Orchestrator; event is safely routed to the active context.',
  },
  {
    id: 'E32',
    title: 'Cross-screen matching inconsistency',
    category: 'scan',
    severity: 'high',
    trigger: 'TaskList matches with the trim variant; if Delivery lacks the same trim check, a "barcode not matched" error is thrown.',
    impact: 'Courier falls back to manual entry; processing time increases, error rate rises.',
    mitigation: 'Centralised Barcode Matcher; rules managed from a single point.',
  },
  {
    id: 'E33',
    title: 'Stale dedup list rejects valid scan',
    category: 'scan',
    severity: 'medium',
    trigger: 'forceLoadedBarcodeList (SharedPreferences) grows over time without cleanup; a barcode scanned yesterday is counted as "duplicate" today.',
    impact: 'Valid parcel is rejected; operations are disrupted.',
    mitigation: 'Session-scoped dedup (in-memory) + retention policy.',
  },
]

export const SEVERITY_META: Record<Severity, { label: string; tone: 'red' | 'orange' | 'amber' }> = {
  critical: { label: 'Critical', tone: 'red' },
  high: { label: 'High', tone: 'orange' },
  medium: { label: 'Medium', tone: 'amber' },
}

export function edgeCasesByCategory(cat: EdgeCategory): EdgeCase[] {
  return EDGE_CASES.filter((e) => e.category === cat)
}

export const EDGE_STATS = {
  total: EDGE_CASES.length,
  critical: EDGE_CASES.filter((e) => e.severity === 'critical').length,
  high: EDGE_CASES.filter((e) => e.severity === 'high').length,
  medium: EDGE_CASES.filter((e) => e.severity === 'medium').length,
}
