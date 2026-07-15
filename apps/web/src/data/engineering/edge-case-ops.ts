// Edge Case Intelligence — operational layer.
// Adds test status, incident history, mitigation status, lifecycle,
// and risk metrics on top of the EDGE_CASES catalog (edge-cases.ts).
// Reference release: 8.4.60 · Acceptance date: 2026-07-12 · Stale threshold: 90 days.

import { EDGE_CASES, type EdgeCase, type Severity } from './edge-cases'

// ── Types ────────────────────────────────────────────────────────

export type Likelihood = 'frequent' | 'likely' | 'rare'

export type Lifecycle =
  | 'discovered'
  | 'triaged'
  | 'test-design-needed'
  | 'test-ready'
  | 'validated'
  | 'covered'
  | 'monitoring'
  | 'resolved'
  | 'accepted-risk'
  | 'reopened'

export type TestStatus = 'passed' | 'failed' | 'untested'
export type AutomationLevel = 'unit' | 'integration' | 'e2e'
export type MitigationStatus = 'yes' | 'partial' | 'no'

export type EnvKey =
  | 'online'
  | 'offline'
  | 'flaky'
  | 'restart'
  | 'rotation'
  | 'background'
  | 'upgrade'

export type EnvCoverage = 'pass' | 'warn' | 'fail' | 'none'

export interface EdgeOps {
  /** Flow pool — Login, Delivery, Fiscal, End of Day... */
  flow: string
  likelihood: Likelihood
  /** How many users/countries could be affected? */
  exposure: string
  status: Lifecycle
  testStatus: TestStatus
  /** Empty array = no automation. */
  automation: AutomationLevel[]
  mitigationStatus: MitigationStatus
  /** Number of linked incidents. */
  incidents: number
  /** Last verification date (ISO) — null = never verified. */
  lastVerified: string | null
  owner: string | null
  /** Affected by 8.4.60 release changes? */
  releaseRisk: boolean
  /** 1 = very hard to detect · 5 = immediately visible. */
  detectability: 1 | 2 | 3 | 4 | 5
  /** 1 = irreversible · 5 = easy recovery. */
  recoverability: 1 | 2 | 3 | 4 | 5
  /** Failure mechanism pool memberships. */
  mechanisms: string[]
  /** Environment pool memberships. */
  environments: string[]
  /** Environment-based coverage matrix — unspecified environments default to 'none'. */
  envCoverage?: Partial<Record<EnvKey, EnvCoverage>>
  /** Expected vs Actual distinction — required for critical entries. */
  expected?: string
  actual?: string
  /** Reproduce reliability 1-5 (race conditions do not occur on every attempt). */
  reproduceReliability?: number
  reproduceSteps?: string[]
  /** Separate from mitigation: how to recover affected records/devices? */
  recovery?: string
  /** Permanent fix note / target. */
  permanentFix?: string
}

// ── Operational data (E1-E33) ────────────────────────────────────

export const EDGE_OPS: Record<string, EdgeOps> = {
  E1: {
    flow: 'Schedule Download', likelihood: 'likely', exposure: 'All countries',
    status: 'test-design-needed', testStatus: 'untested', automation: [], mitigationStatus: 'no',
    incidents: 1, lastVerified: null, owner: 'Data & Sync', releaseRisk: true,
    detectability: 2, recoverability: 2,
    mechanisms: ['Race condition', 'Lost state'], environments: ['Flaky network'],
    envCoverage: { online: 'none', offline: 'none', flaky: 'none' },
    expected: 'When FCM refresh and local delivery write conflict on the same chunk, both changes should be preserved.',
    actual: 'Last writer wins; delivery record may silently disappear.',
    reproduceReliability: 2,
    recovery: 'Lost deliveries are restored by diffing CompletedRequest records against the schedule chunk.',
    permanentFix: 'Chunk to relational row model (Modernization Phase 1).',
  },
  E2: {
    flow: 'Schedule Download', likelihood: 'rare', exposure: 'All countries',
    status: 'triaged', testStatus: 'untested', automation: [], mitigationStatus: 'no',
    incidents: 0, lastVerified: null, owner: 'Data & Sync', releaseRisk: false,
    detectability: 3, recoverability: 2,
    mechanisms: ['Data corruption', 'Partial success'], environments: ['Process killed', 'Low memory'],
  },
  E3: {
    flow: 'Schedule Download', likelihood: 'rare', exposure: 'All devices receiving upgrades',
    status: 'test-ready', testStatus: 'failed', automation: ['unit'], mitigationStatus: 'partial',
    incidents: 1, lastVerified: '2026-05-19', owner: 'Data & Sync', releaseRisk: true,
    detectability: 4, recoverability: 1,
    mechanisms: ['Migration failure', 'Data corruption'], environments: ['Version upgrade'],
    envCoverage: { upgrade: 'fail' },
    expected: 'Missing migrations should be caught at compile/CI stage; production data should not be deleted.',
    actual: 'fallbackToDestructiveMigration() deletes all local data (including pending queue).',
    reproduceReliability: 5,
    reproduceSteps: [
      'Install a migration-less v241 build on a device with v240 schema.',
      'Open the app — Room destructive fallback triggers.',
      'Verify that Schedule and PendingRequest tables are emptied.',
    ],
    recovery: 'Schedule is re-downloaded from the server; unsent offline events cannot be recovered.',
    permanentFix: 'Remove destructive fallback + add migration test suite (Phase 0).',
  },
  E4: {
    flow: 'Stop List', likelihood: 'likely', exposure: 'Routes with 200+ stops',
    status: 'validated', testStatus: 'passed', automation: ['integration'], mitigationStatus: 'partial',
    incidents: 2, lastVerified: '2026-06-21', owner: 'Mobile Core', releaseRisk: false,
    detectability: 5, recoverability: 5,
    mechanisms: ['Timeout'], environments: ['Low memory'],
    envCoverage: { online: 'pass', offline: 'pass' },
  },
  E5: {
    flow: 'Delivery', likelihood: 'likely', exposure: 'All countries using POS',
    status: 'test-design-needed', testStatus: 'untested', automation: [], mitigationStatus: 'no',
    incidents: 2, lastVerified: null, owner: 'Payments', releaseRisk: true,
    detectability: 1, recoverability: 2,
    mechanisms: ['Lost state', 'Process death'], environments: ['Process killed', 'Restart'],
    envCoverage: { restart: 'none' },
    expected: 'Payment status is persistent; shipment appears "paid" after restart.',
    actual: 'paidShipments only in memory — payment flow reopens after restart.',
    reproduceReliability: 5,
    recovery: 'Shipment list is reconciled with POS provider records; double charges are refunded.',
    permanentFix: 'Payment state machine is moved to Room (with E30).',
  },
  E6: {
    flow: 'Schedule Download', likelihood: 'likely', exposure: 'All countries',
    status: 'triaged', testStatus: 'untested', automation: [], mitigationStatus: 'no',
    incidents: 1, lastVerified: null, owner: 'Data & Sync', releaseRisk: false,
    detectability: 2, recoverability: 3,
    mechanisms: ['Stale state'], environments: ['Restart'],
  },
  E7: {
    flow: 'End of Day', likelihood: 'likely', exposure: 'Weak coverage areas',
    status: 'validated', testStatus: 'passed', automation: ['integration'], mitigationStatus: 'yes',
    incidents: 3, lastVerified: '2026-06-30', owner: 'Data & Sync', releaseRisk: true,
    detectability: 3, recoverability: 4,
    mechanisms: ['Stale state', 'Silent failure'], environments: ['Offline', 'Flaky network'],
    envCoverage: { online: 'pass', offline: 'pass', flaky: 'warn' },
  },
  E8: {
    flow: 'Delivery', likelihood: 'likely', exposure: 'All countries',
    status: 'test-ready', testStatus: 'failed', automation: ['unit'], mitigationStatus: 'partial',
    incidents: 4, lastVerified: '2026-06-14', owner: 'Data & Sync', releaseRisk: true,
    detectability: 2, recoverability: 3,
    mechanisms: ['Lost state', 'Process death', 'Retry failure'], environments: ['Process killed', 'Doze'],
    envCoverage: { online: 'pass', restart: 'fail', background: 'warn' },
    expected: 'Even if the service dies, a record being processed should not remain locked; the queue self-recovers.',
    actual: 'isProcessing=true persists; the queue is permanently stuck.',
    reproduceReliability: 4,
    recovery: 'Stale isProcessing records are manually reset on the device (support procedure SOP-12).',
  },
  E9: {
    flow: 'Delivery', likelihood: 'likely', exposure: 'All countries · financial events',
    status: 'test-design-needed', testStatus: 'untested', automation: [], mitigationStatus: 'no',
    incidents: 2, lastVerified: null, owner: 'Payments', releaseRisk: true,
    detectability: 2, recoverability: 2,
    mechanisms: ['Duplicate event', 'Idempotency failure', 'Retry failure'], environments: ['Flaky network'],
    envCoverage: { flaky: 'none' },
    expected: 'Regardless of how many times the same delivery/collection event is sent, it is processed once on the server.',
    actual: 'No server-side idempotency; retry can produce duplicate transaction.',
    reproduceReliability: 3,
    reproduceSteps: [
      'Send delivery event; disconnect before response returns (timeout).',
      'Wait for retry mechanism to resend the same event.',
      'Verify that two transaction records are created for the same shipment in backoffice.',
    ],
    recovery: 'Duplicate events are deduplicated via uniqueKey and reversed in backoffice.',
    permanentFix: 'End-to-end idempotency key (backend collaboration, Phase 1).',
  },
  E10: {
    flow: 'Delivery', likelihood: 'likely', exposure: 'All countries',
    status: 'triaged', testStatus: 'untested', automation: [], mitigationStatus: 'no',
    incidents: 1, lastVerified: null, owner: 'Data & Sync', releaseRisk: true,
    detectability: 2, recoverability: 3,
    mechanisms: ['Out-of-order event'], environments: ['Offline', 'Flaky network'],
  },
  E11: {
    flow: 'End of Day', likelihood: 'frequent', exposure: 'Entire fleet simultaneously',
    status: 'validated', testStatus: 'passed', automation: ['integration'], mitigationStatus: 'partial',
    incidents: 1, lastVerified: '2026-04-02', owner: 'Data & Sync', releaseRisk: false,
    detectability: 4, recoverability: 4,
    mechanisms: ['Retry failure', 'Silent failure'], environments: ['Flaky network'],
    envCoverage: { online: 'pass', flaky: 'warn' },
  },
  E12: {
    flow: 'End of Day', likelihood: 'likely', exposure: 'Android 14+ devices',
    status: 'triaged', testStatus: 'untested', automation: [], mitigationStatus: 'no',
    incidents: 0, lastVerified: null, owner: 'Mobile Core', releaseRisk: false,
    detectability: 3, recoverability: 4,
    mechanisms: ['Silent failure', 'Timeout'], environments: ['Doze', 'Battery saver', 'Background'],
  },
  E13: {
    flow: 'Stop List', likelihood: 'likely', exposure: 'All countries',
    status: 'test-design-needed', testStatus: 'untested', automation: [], mitigationStatus: 'no',
    incidents: 2, lastVerified: null, owner: 'Mobile Core', releaseRisk: false,
    detectability: 2, recoverability: 3,
    mechanisms: ['Stale state', 'Lost state'], environments: ['Offline'],
    expected: 'Server cancellation reflects on courier screen in all conditions.',
    actual: 'Offline delivery queue hides cancellation during refresh; courier goes to cancelled package.',
    reproduceReliability: 3,
    recovery: 'Dispatch calls and redirects courier; package is put into return flow.',
  },
  E14: {
    flow: 'Delivery', likelihood: 'rare', exposure: 'All countries',
    status: 'triaged', testStatus: 'untested', automation: [], mitigationStatus: 'no',
    incidents: 1, lastVerified: null, owner: 'Data & Sync', releaseRisk: false,
    detectability: 3, recoverability: 4,
    mechanisms: ['Out-of-order event', 'Stale state'], environments: ['Flaky network'],
  },
  E15: {
    flow: 'Delivery', likelihood: 'likely', exposure: 'Routes receiving heavy push',
    status: 'test-design-needed', testStatus: 'untested', automation: [], mitigationStatus: 'no',
    incidents: 1, lastVerified: null, owner: 'Mobile Core', releaseRisk: false,
    detectability: 2, recoverability: 3,
    mechanisms: ['Race condition', 'Lost state'], environments: ['Online'],
  },
  E16: {
    flow: 'Fiscal', likelihood: 'likely', exposure: 'RS · BA (fiscal countries)',
    status: 'test-ready', testStatus: 'failed', automation: [], mitigationStatus: 'partial',
    incidents: 2, lastVerified: '2026-06-08', owner: 'Payments', releaseRisk: true,
    detectability: 3, recoverability: 2,
    mechanisms: ['Lifecycle duplication', 'Duplicate event', 'Idempotency failure'],
    environments: ['Rotation'],
    envCoverage: { rotation: 'fail', online: 'pass' },
    expected: 'Rotation does not retrigger fiscal request; request runs exactly once.',
    actual: 'Observer reconnects, createFiscalInvoice runs second time → double fiscal record.',
    reproduceReliability: 4,
    reproduceSteps: [
      'Rotate device while fiscal dialog is open.',
      'Verify two requests for the same collection in fiscal service logs.',
    ],
    recovery: 'void/SSC compensation flow runs for second fiscal record.',
    permanentFix: 'Transition to SingleLiveEvent/Flow + fiscal idempotency key.',
  },
  E17: {
    flow: 'Delivery', likelihood: 'rare', exposure: 'All countries',
    status: 'test-design-needed', testStatus: 'untested', automation: [], mitigationStatus: 'no',
    incidents: 1, lastVerified: null, owner: 'Mobile Core', releaseRisk: false,
    detectability: 2, recoverability: 2,
    mechanisms: ['Stale state', 'Lifecycle duplication'], environments: ['Rotation', 'Restart'],
    expected: 'Active task is always verified at screen entry; flow does not work with old task.',
    actual: 'If currentTask is not cleared, delivery confirmation can be taken with old task at another stop.',
    reproduceReliability: 2,
    recovery: 'Incorrect delivery record is fixed from backoffice; correct shipment is reopened.',
  },
  E18: {
    flow: 'Delivery Failed', likelihood: 'likely', exposure: 'All countries',
    status: 'covered', testStatus: 'passed', automation: ['unit', 'integration'], mitigationStatus: 'yes',
    incidents: 1, lastVerified: '2026-06-25', owner: 'Mobile Core', releaseRisk: false,
    detectability: 5, recoverability: 5,
    mechanisms: ['Lifecycle duplication', 'Timeout'], environments: ['Background', 'Rotation'],
    envCoverage: { rotation: 'pass', background: 'pass' },
  },
  E19: {
    flow: 'Delivery', likelihood: 'rare', exposure: 'Devices with call permission',
    status: 'covered', testStatus: 'passed', automation: ['unit'], mitigationStatus: 'yes',
    incidents: 0, lastVerified: '2026-05-30', owner: 'Mobile Core', releaseRisk: false,
    detectability: 3, recoverability: 4,
    mechanisms: ['Lifecycle duplication', 'Duplicate event'], environments: ['Background'],
    envCoverage: { background: 'pass' },
  },
  E20: {
    flow: 'Login', likelihood: 'frequent', exposure: 'All countries · long shifts',
    status: 'reopened', testStatus: 'failed', automation: ['integration'], mitigationStatus: 'partial',
    incidents: 5, lastVerified: '2026-07-03', owner: 'Platform', releaseRisk: true,
    detectability: 4, recoverability: 3,
    mechanisms: ['Silent failure', 'Permission change'], environments: ['Online', 'Offline'],
    envCoverage: { online: 'pass', offline: 'fail', flaky: 'warn' },
    expected: 'Session silently refreshes when token expires; queued requests are not left without token.',
    actual: 'User is silently logged out after 401; half delivery and tokenless queue remain.',
    reproduceReliability: 5,
    reproduceSteps: [
      'Shorten token TTL (test backend).',
      'Make any call in middle of shift — 401 → silent logout.',
      'Verify offline queue is left without token.',
    ],
    recovery: 'Queue is flushed with new token after re-login; half flows are completed manually.',
    permanentFix: 'Refresh token flow (Phase 0 — in scope of this release).',
  },
  E21: {
    flow: 'Login', likelihood: 'rare', exposure: 'All countries · security',
    status: 'accepted-risk', testStatus: 'untested', automation: [], mitigationStatus: 'partial',
    incidents: 0, lastVerified: null, owner: 'Platform', releaseRisk: false,
    detectability: 1, recoverability: 2,
    mechanisms: ['Silent failure'], environments: ['Online'],
    permanentFix: 'Host allowlist + TrustAllCerts removal — in security sprint (acceptance: 2026-Q3 end).',
  },
  E22: {
    flow: 'Schedule Download', likelihood: 'rare', exposure: 'Flows using signed endpoint',
    status: 'triaged', testStatus: 'untested', automation: [], mitigationStatus: 'no',
    incidents: 1, lastVerified: null, owner: 'Platform', releaseRisk: false,
    detectability: 2, recoverability: 4,
    mechanisms: ['Silent failure'], environments: ['Online'],
  },
  E23: {
    flow: 'Shipment Tracking', likelihood: 'rare', exposure: 'Weak network areas',
    status: 'triaged', testStatus: 'untested', automation: [], mitigationStatus: 'no',
    incidents: 0, lastVerified: null, owner: 'Mobile Core', releaseRisk: false,
    detectability: 3, recoverability: 4,
    mechanisms: ['Silent failure'], environments: ['Offline'],
  },
  E24: {
    flow: 'Shipment Tracking', likelihood: 'likely', exposure: 'Entire fleet',
    status: 'validated', testStatus: 'passed', automation: ['unit'], mitigationStatus: 'partial',
    incidents: 1, lastVerified: '2026-03-18', owner: 'Mobile Core', releaseRisk: false,
    detectability: 3, recoverability: 5,
    mechanisms: ['Lost state', 'Process death'], environments: ['Process killed'],
    envCoverage: { restart: 'warn' },
  },
  E25: {
    flow: 'Shipment Tracking', likelihood: 'likely', exposure: 'Entire fleet',
    status: 'test-ready', testStatus: 'untested', automation: [], mitigationStatus: 'no',
    incidents: 1, lastVerified: null, owner: 'Mobile Core', releaseRisk: false,
    detectability: 2, recoverability: 5,
    mechanisms: ['Permission change', 'Silent failure'], environments: ['Background'],
  },
  E26: {
    flow: 'Shipment Tracking', likelihood: 'likely', exposure: 'Reporting · all countries',
    status: 'triaged', testStatus: 'untested', automation: [], mitigationStatus: 'no',
    incidents: 0, lastVerified: null, owner: 'Data & Sync', releaseRisk: false,
    detectability: 2, recoverability: 3,
    mechanisms: ['Data corruption'], environments: ['Online'],
  },
  E27: {
    flow: 'Delivery', likelihood: 'likely', exposure: 'All countries using POS · financial',
    status: 'test-design-needed', testStatus: 'untested', automation: [], mitigationStatus: 'partial',
    incidents: 2, lastVerified: null, owner: 'Payments', releaseRisk: true,
    detectability: 1, recoverability: 2,
    mechanisms: ['Partial success', 'Process death'], environments: ['Process killed', 'Restart'],
    envCoverage: { online: 'pass', offline: 'pass', flaky: 'warn', restart: 'none', background: 'warn' },
    expected: 'If payment is successful, delivery state and fiscal record match atomically.',
    actual: 'If process dies after POS success, delivery record is not created; system does not know the payment.',
    reproduceReliability: 3,
    reproduceSteps: [
      'Complete POS payment (right before success callback returns).',
      'Kill process before handleDelivery() is called (adb shell am kill).',
      'Open app: shipment appears "unpaid"; verify divergence with POS record.',
    ],
    recovery: 'POS records are reconciled with delivery records; double charges are refunded.',
    permanentFix: '"Payment received / pending delivery" intermediate state is atomically written to Room (Phase 0).',
  },
  E28: {
    flow: 'Fiscal', likelihood: 'likely', exposure: 'RS · BA (legal audit)',
    status: 'test-design-needed', testStatus: 'untested', automation: [], mitigationStatus: 'no',
    incidents: 1, lastVerified: null, owner: 'Payments', releaseRisk: true,
    detectability: 1, recoverability: 1,
    mechanisms: ['Partial success', 'Silent failure'], environments: ['Flaky network', 'Process killed'],
    expected: 'Fiscal record is created only dependent on delivery confirmation; no unbacked invoice remains.',
    actual: 'If delivery fails, orphaned invoice remains in fiscal system — no crash, no signal.',
    reproduceReliability: 3,
    recovery: 'Fiscal records are reconciled daily with delivery records; void/SSC applied to orphaned invoices.',
    permanentFix: 'Binding fiscal to delivery confirmation + compensation flow (Phase 0).',
  },
  E29: {
    flow: 'Fiscal', likelihood: 'likely', exposure: 'RS · BA',
    status: 'test-ready', testStatus: 'failed', automation: [], mitigationStatus: 'partial',
    incidents: 1, lastVerified: '2026-06-08', owner: 'Payments', releaseRisk: true,
    detectability: 3, recoverability: 2,
    mechanisms: ['Lifecycle duplication', 'Idempotency failure'], environments: ['Rotation'],
    envCoverage: { rotation: 'fail', restart: 'warn', background: 'pass' },
    recovery: 'Double fiscal record is voided (shared with E16 compensation flow).',
  },
  E30: {
    flow: 'Delivery', likelihood: 'likely', exposure: 'All countries using POS',
    status: 'test-design-needed', testStatus: 'untested', automation: [], mitigationStatus: 'no',
    incidents: 2, lastVerified: null, owner: 'Payments', releaseRisk: true,
    detectability: 1, recoverability: 2,
    mechanisms: ['Lost state', 'Process death'], environments: ['Restart', 'Process killed'],
    expected: 'Payment status is restored from persistent storage after restart.',
    actual: 'Payment info is in memory/callback — shipment appears "unpaid" after restart.',
    reproduceReliability: 5,
    recovery: 'Reconcile with POS provider records (shared procedure with E5/E27).',
    permanentFix: 'Payment state machine is moved to Room (Phase 0).',
  },
  E31: {
    flow: 'Stop List', likelihood: 'likely', exposure: 'Devices with hardware scanner',
    status: 'test-ready', testStatus: 'passed', automation: ['unit'], mitigationStatus: 'partial',
    incidents: 2, lastVerified: '2026-06-27', owner: 'Mobile Core', releaseRisk: false,
    detectability: 3, recoverability: 4,
    mechanisms: ['Race condition', 'Out-of-order event'], environments: ['Scanner device'],
    envCoverage: { online: 'pass', offline: 'warn', flaky: 'pass' },
  },
  E32: {
    flow: 'Delivery', likelihood: 'frequent', exposure: 'All countries',
    status: 'validated', testStatus: 'passed', automation: ['unit'], mitigationStatus: 'partial',
    incidents: 3, lastVerified: '2026-07-01', owner: 'Mobile Core', releaseRisk: false,
    detectability: 4, recoverability: 5,
    mechanisms: ['Idempotency failure'], environments: ['Scanner device', 'Camera scanner'],
    envCoverage: { online: 'pass' },
  },
  E33: {
    flow: 'Pick Up', likelihood: 'likely', exposure: 'Devices logged in for a long time',
    status: 'triaged', testStatus: 'untested', automation: [], mitigationStatus: 'no',
    incidents: 1, lastVerified: null, owner: null, releaseRisk: false,
    detectability: 3, recoverability: 4,
    mechanisms: ['Stale state'], environments: ['Restart'],
  },
}

// ── Unified model ───────────────────────────────────────────────

export interface EdgeCaseFull extends EdgeCase, EdgeOps {}

export const EDGE_FULL: EdgeCaseFull[] = EDGE_CASES.map((e) => ({ ...e, ...EDGE_OPS[e.id]! }))

// ── Meta / labels ─────────────────────────────────────────────

export const RELEASE_VERSION = '8.4.60'
export const TODAY = '2026-07-12'
const STALE_BEFORE = '2026-04-13' // 90 days

export const LIKELIHOOD_META: Record<Likelihood, { label: string; order: number }> = {
  frequent: { label: 'Frequent', order: 3 },
  likely: { label: 'Likely', order: 2 },
  rare: { label: 'Rare', order: 1 },
}

export const LIFECYCLE_META: Record<Lifecycle, { label: string; tone: 'red' | 'orange' | 'amber' | 'blue' | 'teal' | 'green' | 'gray' | 'purple' }> = {
  discovered: { label: 'Discovered', tone: 'purple' },
  triaged: { label: 'Triaged', tone: 'blue' },
  'test-design-needed': { label: 'Test Design Needed', tone: 'orange' },
  'test-ready': { label: 'Test Ready', tone: 'amber' },
  validated: { label: 'Validated', tone: 'teal' },
  covered: { label: 'Covered', tone: 'green' },
  monitoring: { label: 'Monitoring', tone: 'blue' },
  resolved: { label: 'Resolved', tone: 'green' },
  'accepted-risk': { label: 'Accepted Risk', tone: 'gray' },
  reopened: { label: 'Reopened', tone: 'red' },
}

export const TEST_STATUS_META: Record<TestStatus, { label: string; symbol: string; cls: string }> = {
  passed: { label: 'Passed', symbol: '✓', cls: 'text-green-600 dark:text-green-400' },
  failed: { label: 'Failed', symbol: '×', cls: 'text-red-600 dark:text-red-400' },
  untested: { label: 'Untested', symbol: '○', cls: 'text-muted-foreground' },
}

export const ENV_COLUMNS: { key: EnvKey; label: string }[] = [
  { key: 'online', label: 'Online' },
  { key: 'offline', label: 'Offline' },
  { key: 'flaky', label: 'Flaky' },
  { key: 'restart', label: 'Restart' },
  { key: 'rotation', label: 'Rotation' },
  { key: 'background', label: 'Background' },
  { key: 'upgrade', label: 'Upgrade' },
]

export function isStale(e: EdgeCaseFull): boolean {
  return !e.lastVerified || e.lastVerified < STALE_BEFORE
}

// ── KPIs ──────────────────────────────────────────────────────

export function edgeKpis() {
  const releaseScope = EDGE_FULL.filter((e) => e.releaseRisk)
  const releaseTested = releaseScope.filter((e) => e.testStatus === 'passed')
  return {
    total: EDGE_FULL.length,
    critical: EDGE_FULL.filter((e) => e.severity === 'critical').length,
    untested: EDGE_FULL.filter((e) => e.testStatus === 'untested').length,
    noAutomation: EDGE_FULL.filter((e) => e.automation.length === 0).length,
    incidentLinked: EDGE_FULL.filter((e) => e.incidents > 0).length,
    noMitigationCritical: EDGE_FULL.filter((e) => e.severity === 'critical' && e.mitigationStatus === 'no').length,
    stale: EDGE_FULL.filter(isStale).length,
    releaseRisk: releaseScope.length,
    releaseReady: releaseScope.length
      ? Math.round((releaseTested.length / releaseScope.length) * 100)
      : 100,
  }
}

// ── Priority queue — "What Should We Test Next?" ────────────────

const SEV_W: Record<Severity, number> = { critical: 3, high: 2, medium: 1 }

export interface TestNextItem {
  edge: EdgeCaseFull
  score: number
  reasons: string[]
  suggestedTest: string
}

const SUGGESTED_TESTS: Record<string, string> = {
  E27: 'Kill process after POS success; open app and check payment/delivery state reconciliation.',
  E9: 'Retry delivery event interrupted by timeout; verify single transaction record is created on server.',
  E5: 'App restart after payment; verify shipment remains "paid".',
  E30: 'Restart after payment callback; verify POS flow cannot be restarted.',
  E28: 'Intentionally fail delivery; verify no orphaned invoice remains in fiscal system.',
  E20: 'Shorten token TTL; verify session silently refreshes after mid-shift 401 and queue flows.',
  E16: 'Rotation while fiscal dialog is open; verify fiscal request is triggered exactly once.',
  E29: 'Rotation + restart combination while fiscal dialog is open; verify idempotency key.',
  E1: 'Race FCM refresh with local delivery write on the same chunk; verify both changes are preserved.',
  E8: 'Kill service mid-transaction; verify stale isProcessing lock is cleared on restart.',
  E13: 'Cancel shipment on server while offline delivery is queued; verify cancellation remains visible after refresh.',
}

export function testNextQueue(limit = 5): TestNextItem[] {
  const items = EDGE_FULL
    .filter((e) => e.status !== 'resolved' && e.status !== 'accepted-risk')
    .map((e) => {
      const reasons: string[] = []
      let score = SEV_W[e.severity] * LIKELIHOOD_META[e.likelihood].order

      if (e.severity === 'critical') reasons.push('Critical impact')
      if (e.incidents > 0) {
        score += e.incidents * 2
        reasons.push(`${e.incidents} past incidents`)
      }
      if (e.releaseRisk) {
        score += 4
        reasons.push(`Code changed in ${RELEASE_VERSION} scope`)
      }
      if (e.testStatus === 'untested') {
        score += 3
        reasons.push('Never tested')
      }
      if (e.testStatus === 'failed') {
        score += 4
        reasons.push('Last test failed')
      }
      if (e.automation.length === 0) {
        score += 2
        reasons.push('No automatic regression')
      }
      if (e.mitigationStatus === 'no') {
        score += 2
        reasons.push('No mitigation')
      }
      if (e.detectability <= 2) {
        score += 2
        reasons.push('Low detectability — silent failure')
      }
      return {
        edge: e,
        score,
        reasons,
        suggestedTest:
          SUGGESTED_TESTS[e.id] ?? `Reproduce ${e.trigger.replace(/\.$/, '')} scenario in ${e.flow} flow.`,
      }
    })
    .sort((a, b) => b.score - a.score)
  return items.slice(0, limit)
}

// ── Quick filters ──────────────────────────────────────────────

export interface QuickFilter {
  id: string
  label: string
  match: (e: EdgeCaseFull) => boolean
}

export const QUICK_FILTERS: QuickFilter[] = [
  { id: 'critical-untested', label: 'Critical & untested', match: (e) => e.severity === 'critical' && e.testStatus === 'untested' },
  { id: 'incident', label: 'Produced incident', match: (e) => e.incidents > 0 },
  { id: 'no-mitigation', label: 'No mitigation', match: (e) => e.mitigationStatus === 'no' },
  { id: 'no-automation', label: 'No automatic test', match: (e) => e.automation.length === 0 },
  { id: 'release-risk', label: `${RELEASE_VERSION} impact`, match: (e) => e.releaseRisk },
  { id: 'failed', label: 'Last test failed', match: (e) => e.testStatus === 'failed' },
  { id: 'no-owner', label: 'No owner assigned', match: (e) => !e.owner },
  { id: 'stale', label: 'Unverified for 90+ days', match: isStale },
]

// ── Saved views ──────────────────────────────────────────────────

export interface SavedView {
  id: string
  label: string
  desc: string
  match: (e: EdgeCaseFull) => boolean
}

export const SAVED_VIEWS: SavedView[] = [
  {
    id: 'release-blockers',
    label: 'Release Blockers',
    desc: 'Critical/high + in release scope + untested or failed',
    match: (e) =>
      e.severity !== 'medium' && e.releaseRisk && e.testStatus !== 'passed',
  },
  {
    id: 'incident-candidates',
    label: 'Incident Candidates',
    desc: 'Records with incident history and still unprotected',
    match: (e) => e.incidents > 0 && e.status !== 'covered' && e.status !== 'resolved',
  },
  {
    id: 'coverage-gaps',
    label: 'Coverage Gaps',
    desc: 'No automation · old verification · no owner',
    match: (e) => e.automation.length === 0 || isStale(e) || !e.owner,
  },
  {
    id: 'financial-safety',
    label: 'Financial Safety',
    desc: 'Payment, fiscal, delivery state, idempotency',
    match: (e) =>
      e.category === 'payment' ||
      e.mechanisms.includes('Idempotency failure') ||
      e.flow === 'Fiscal',
  },
  {
    id: 'offline-reliability',
    label: 'Offline Reliability',
    desc: 'Queue, retry, process death, network transitions',
    match: (e) =>
      e.category === 'offline' ||
      e.environments.some((env) => ['Offline', 'Flaky network', 'Doze', 'Process killed'].includes(env)),
  },
  {
    id: 'state-lifecycle',
    label: 'State & Lifecycle',
    desc: 'Rotation, observer, SharedViewModel, process recreation',
    match: (e) =>
      e.category === 'state' ||
      e.category === 'ui' ||
      e.mechanisms.includes('Lifecycle duplication'),
  },
  {
    id: 'accepted-risks',
    label: 'Accepted Risks',
    desc: 'Records left open intentionally',
    match: (e) => e.status === 'accepted-risk',
  },
]

// ── Advanced search — `severity:critical automation:false` syntax ─

const SEARCH_KEYS = [
  'severity', 'domain', 'status', 'incident', 'automation',
  'mitigation', 'release', 'flow', 'owner', 'lifecycle',
] as const

export function searchEdgeCases(query: string, source: EdgeCaseFull[] = EDGE_FULL): EdgeCaseFull[] {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return source

  return source.filter((e) =>
    tokens.every((tok) => {
      const m = tok.match(/^([a-z]+):(.+)$/)
      if (m && m[1] && m[2] && (SEARCH_KEYS as readonly string[]).includes(m[1])) {
        const key = m[1]
        const val = m[2]
        switch (key) {
          case 'severity': return e.severity.startsWith(val)
          case 'domain': return e.category.includes(val)
          case 'status':
            return val === 'untested'
              ? e.testStatus === 'untested'
              : e.testStatus.startsWith(val)
          case 'incident': return val === 'true' ? e.incidents > 0 : e.incidents === 0
          case 'automation': return val === 'false' ? e.automation.length === 0 : e.automation.length > 0
          case 'mitigation': return e.mitigation === val || (val === 'false' && e.mitigationStatus === 'no')
          case 'release': return val === 'false' ? !e.releaseRisk : e.releaseRisk
          case 'flow': return e.flow.toLowerCase().includes(val)
          case 'owner': return val === 'none' ? !e.owner : (e.owner ?? '').toLowerCase().includes(val)
          case 'lifecycle': return e.status.includes(val)
          default: return true
        }
      }
      // Free text: ID, title, trigger, impact
      return (
        e.id.toLowerCase() === tok ||
        e.title.toLowerCase().includes(tok) ||
        e.trigger.toLowerCase().includes(tok) ||
        e.impact.toLowerCase().includes(tok) ||
        e.flow.toLowerCase().includes(tok)
      )
    }),
  )
}
