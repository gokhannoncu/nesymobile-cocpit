// Performance Intelligence — commentary, narrative, trends and action layer.
// Raw metrics: ./performance.ts (Firebase Performance · CW27 2026).
// This file interprets the numbers: confidence level, business impact, prioritisation and action.
// CW22–CW26 trend values compiled from the weekly bulletin archive.

import type { PerfCountryId } from './performance'
import type { EvidenceLevel } from '@/components/product'

export type HealthStatus = 'on-target' | 'near-target' | 'watch' | 'action' | 'validate' | 'nodata'

export const HEALTH_LABELS: Record<HealthStatus, string> = {
  'on-target': 'On Target',
  'near-target': 'Near Target',
  watch: 'Under Watch',
  action: 'Action Recommended',
  validate: 'Data Validation Required',
  nodata: 'Insufficient Data',
}

// ═══ 1 · Executive Brief ═════════════════════════════════════════════════════

export const PI_META = {
  title: 'Performance Intelligence',
  subtitle: 'Country-level user experience, service health, trends and priority improvement areas.',
  period: 'CW27 · 2026',
  periodRange: '24–30 June 2026',
  environment: 'Production',
  percentile: 'P90',
  dataTimestamp: '30 June 2026 · 09:23',
  releases: 'HR v0.260 · BA v0.29 · SI v0.174 · RS v0.68',
  confidence: 'Medium — BA and SI carry low sample sizes',
  source: 'Firebase Performance · Weekly Bulletin Issue 03',
}

export const PI_BRIEF = {
  headline: 'Weekly performance overview — CW27 · 2026',
  summary:
    'Two of four countries meet the app start target; Bosnia-Herzegovina and Slovenia remain above ' +
    'the target startup time. Service success rates are generally stable, but some measurements require data ' +
    'validation. Rendering telemetry is not at a decision-making level in any of the four countries.',
  overallStatus: 'Manageable — 2 areas under watch',
  overallTone: 'amber' as const,
  statusBullets: [
    '2 countries on target (HR, RS)',
    '2 countries under watch (BA, SI)',
    '1 metric with data gap (rendering)',
    '3 priority actions this week',
  ],
}

// ═══ 2 · KPI Strip ═══════════════════════════════════════════════════════════

export type KpiTone = 'green' | 'blue' | 'amber' | 'gray' | 'red'

export interface PiKpi {
  label: string
  value: string
  secondary: string
  tone: KpiTone
}

export const PI_KPIS: PiKpi[] = [
  { label: 'App Start P90', value: '1.25–2.34 s', secondary: '2/4 countries on target (< 2.0 s)', tone: 'amber' },
  { label: 'Network Success', value: '>= 99.8%', secondary: 'Task/Info signal being validated (BA)', tone: 'blue' },
  { label: 'P90 Latency', value: '43 / 156', secondary: 'Endpoints above 600 ms · 4 countries total', tone: 'amber' },
  { label: 'Crash-free Users', value: '96.0–100%', secondary: 'HR -2.6 points · SI 100%', tone: 'green' },
  { label: 'Data Coverage', value: 'Limited', secondary: 'Rendering data missing in all 4 countries', tone: 'gray' },
]

// ═══ 3 · Executive narrative ═══════════════════════════════════════════════════

export const PI_NARRATIVE = {
  whatHappened:
    'App start improved in HR (1.49 s, -21%). BA and SI remained above target. On the RS side, a decline ' +
    'in CreateFiscalInvoice success was observed but overall service success is stable. The Task/Info ' +
    'signal in BA is producing anomalous values; measurement is being validated.',
  whyItMatters:
    'Startup time affects the speed of the first transaction at shift start. High-latency endpoints may ' +
    'create a sense of waiting in the field, especially in PickupFailed and DeliveryFailed flows. The fiscal flow ' +
    'in RS carries legal obligation, so its success rate is closely monitored.',
  whatWeAreDoing:
    'The 26 June spike in BA is being investigated by version. PickupFailed and DeliveryFailed traces will ' +
    'be profiled. The Task/Info measurement anomaly and Rendering SDK coverage will be validated.',
}

// ═══ 4 · Country Health Overview ═════════════════════════════════════════════

export interface CountryScore {
  id: PerfCountryId
  name: string
  domain: string
  status: HealthStatus
  appStart: string
  appStartDeltaPct: number
  network: string
  networkNote?: string
  latency: string
  crashFree: string
  samples: string
  confidence: 'High' | 'Medium' | 'Low'
  direction: 'Improving' | 'Stable' | 'Declining'
  sentence: string
}

export const PI_COUNTRIES: CountryScore[] = [
  {
    id: 'hr',
    name: 'Croatia',
    domain: 'overseas.hr',
    status: 'on-target',
    appStart: '1.49 s',
    appStartDeltaPct: -21,
    network: '100%',
    latency: '15/46 endpoints > 600 ms',
    crashFree: '95.99%',
    samples: '599 sessions',
    confidence: 'High',
    direction: 'Improving',
    sentence:
      'Startup time improved; 15 slow endpoints continue to be monitored. The 9-crash concentration on 29 June is being investigated.',
  },
  {
    id: 'ba',
    name: 'Bosnia-Herzegovina',
    domain: 'expressone.ba',
    status: 'watch',
    appStart: '2.22 s',
    appStartDeltaPct: 56,
    network: 'Being validated',
    networkNote: 'Inconsistency in Task/Info signal',
    latency: '5/33 endpoints > 600 ms',
    crashFree: '—',
    samples: '318 sessions',
    confidence: 'Low',
    direction: 'Declining',
    sentence:
      'App start is 220 ms above target. Network success signal inconsistency is being validated; operational outage not yet confirmed.',
  },
  {
    id: 'si',
    name: 'Slovenia',
    domain: 'expressone.si',
    status: 'watch',
    appStart: '2.34 s',
    appStartDeltaPct: 36,
    network: '99.82%',
    latency: '11/36 endpoints > 600 ms',
    crashFree: '100%',
    samples: '312 sessions',
    confidence: 'Low',
    direction: 'Stable',
    sentence:
      'Last week\'s spike has recovered but P90 remains 340 ms above target. Sample size is limited; change percentages should be read cautiously.',
  },
  {
    id: 'rs',
    name: 'Serbia',
    domain: 'cityexpress.rs',
    status: 'on-target',
    appStart: '1.25 s',
    appStartDeltaPct: 8,
    network: '99.6%',
    networkNote: 'CreateFiscalInvoice 92.86% — being monitored',
    latency: '12/41 endpoints > 600 ms',
    crashFree: '97.4%',
    samples: '3K sessions',
    confidence: 'High',
    direction: 'Stable',
    sentence:
      'Startup is below target and stable. DeliveryFailed latency and fiscal invoice success decline are this week\'s monitoring topics.',
  },
]

// ═══ 6 · Performance Trends ══════════════════════════════════════════════════

/** App start P90 (seconds) — per-country weekly series. */
export interface AppStartWeek {
  week: string
  hr: number
  ba: number
  si: number
  rs: number
  /** Release / event annotation */
  note?: string
}

export const PI_APP_START_TREND: AppStartWeek[] = [
  { week: 'CW22', hr: 2.1, ba: 1.58, si: 1.94, rs: 1.35 },
  { week: 'CW23', hr: 1.92, ba: 1.66, si: 2.02, rs: 1.28 },
  { week: 'CW24', hr: 1.86, ba: 1.71, si: 1.88, rs: 1.3 },
  { week: 'CW25', hr: 2.05, ba: 1.6, si: 1.95, rs: 1.22 },
  { week: 'CW26', hr: 1.89, ba: 1.42, si: 1.72, rs: 1.16, note: 'HR v0.260 release' },
  { week: 'CW27', hr: 1.49, ba: 2.22, si: 2.34, rs: 1.25, note: 'BA 26 Jun spike' },
]

export const PI_APP_START_TARGET = 2.0

export const PI_TREND_NOTES = {
  appStartTitle: 'App start is on target in two countries; BA and SI are above the target line in the last week.',
  appStartFoot:
    'The rise in BA is primarily driven by the 26 June spike. BA and SI sample sizes are lower than other countries (318 / 312 sessions).',
  networkTitle: 'Service success is stable regardless of volume; latency is concentrated in a few endpoints.',
  networkFoot:
    'Bar height represents volume, lines show success rate and P90 latency. High regression in a low-volume endpoint vs. real user impact in a high-volume endpoint are distinguished in this view.',
  scatterTitle: 'Upper right quadrant = high volume + high latency; prioritisation starts here.',
  scatterFoot:
    'Bubble size indicates weekly change. PickupFailed (30.5 s) carries only 220 samples while GetCollectionsFromShipment receives 520K requests — percentage regression alone does not determine priority.',
}

/** Network stability — volume (bar) + success and latency (line). */
export interface NetworkWeek {
  week: string
  volumeM: number // million requests
  successPct: number
  latencyMs: number
}

export const PI_NETWORK_TREND: NetworkWeek[] = [
  { week: 'CW22', volumeM: 2.9, successPct: 99.7, latencyMs: 690 },
  { week: 'CW23', volumeM: 3.1, successPct: 99.8, latencyMs: 655 },
  { week: 'CW24', volumeM: 3.0, successPct: 99.75, latencyMs: 710 },
  { week: 'CW25', volumeM: 3.3, successPct: 99.85, latencyMs: 640 },
  { week: 'CW26', volumeM: 3.2, successPct: 99.8, latencyMs: 625 },
  { week: 'CW27', volumeM: 3.4, successPct: 99.8, latencyMs: 648 },
]

/** Endpoint impact scatter — X latency, Y volume, size regression. */
export interface EndpointImpact {
  name: string
  country: string
  flow: string
  p90s: number
  volume: number
  changePct: number
  confidence: EvidenceLevel
}

export const PI_ENDPOINT_IMPACT: EndpointImpact[] = [
  { name: 'Task/PickupFailed', country: 'BA', flow: 'Pick Up', p90s: 30.5, volume: 220, changePct: 5046, confidence: 'needs-validation' },
  { name: 'Task/DeliveryFailed', country: 'RS', flow: 'Delivery', p90s: 9.74, volume: 6500, changePct: 4919, confidence: 'confirmed' },
  { name: 'Task/DeliveryFailed', country: 'SI', flow: 'Delivery', p90s: 3.49, volume: 540, changePct: -94, confidence: 'confirmed' },
  { name: '*/* (wildcard)', country: 'HR', flow: 'Mixed', p90s: 3.12, volume: 4800, changePct: 40, confidence: 'needs-validation' },
  { name: 'Task/RequestLeavingPermission', country: 'HR', flow: 'Leave', p90s: 2.87, volume: 150, changePct: 383, confidence: 'needs-validation' },
  { name: 'History/SaveShipmentCallInformation', country: 'HR', flow: 'Delivery', p90s: 2.54, volume: 12000, changePct: 18, confidence: 'confirmed' },
  { name: 'Shipment/GetCollectionsFromShipment', country: 'RS', flow: 'Shipment', p90s: 1.65, volume: 520000, changePct: -42, confidence: 'confirmed' },
  { name: 'Shipment/RaiPayAuthToken', country: 'HR', flow: 'Payment', p90s: 1.98, volume: 343, changePct: 9, confidence: 'confirmed' },
  { name: 'Task/DeliverParcels', country: 'RS', flow: 'Delivery', p90s: 1.87, volume: 49000, changePct: 82, confidence: 'confirmed' },
  { name: 'Task/f/SaveImageFile', country: 'SI', flow: 'Delivery', p90s: 1.71, volume: 31000, changePct: 35, confidence: 'confirmed' },
]

// ═══ 7 · Experience Pillars ══════════════════════════════════════════════════

export interface PillarMetric {
  label: string
  value: string
}

export interface Pillar {
  key: string
  title: string
  status: HealthStatus
  metrics: PillarMetric[]
  sentence: string
  /** Additional metrics shown only in the Engineering view */
  engineeringMetrics?: PillarMetric[]
}

export const PI_PILLARS: Pillar[] = [
  {
    key: 'startup',
    title: 'Startup Experience',
    status: 'near-target',
    metrics: [
      { label: 'P90 range', value: '1.25 – 2.34 s' },
      { label: 'Target', value: '< 2.0 s' },
      { label: 'On target', value: '2/4 countries' },
      { label: 'Weekly direction', value: 'HR down · BA/SI up' },
    ],
    engineeringMetrics: [
      { label: 'HR v0.260 (97% share)', value: '1.61 s' },
      { label: 'BA v0.29 (99.5% share)', value: '2.22 s' },
      { label: 'SI v0.174 (85% share)', value: '2.40 s' },
      { label: 'RS v0.68 (100% share)', value: '1.25 s' },
    ],
    sentence:
      'Most users enter the app within the target time; BA and SI have P90 improvement opportunities.',
  },
  {
    key: 'reliability',
    title: 'Network Reliability',
    status: 'validate',
    metrics: [
      { label: 'Success rate', value: '>= 99.8%' },
      { label: 'Lowest', value: 'CreateFiscalInvoice 92.86% (RS)' },
      { label: 'Signal under validation', value: 'Task/Info (BA)' },
      { label: 'Data confidence', value: 'Medium' },
    ],
    engineeringMetrics: [
      { label: 'Task/Info (BA)', value: '0% · 1.7M samples — instrumentation suspected' },
      { label: '/** wildcard (BA)', value: '23.37% · -77 points' },
      { label: 'Shipment/* (BA)', value: '99.97%' },
      { label: 'DeliverParcels (SI)', value: '99.82%' },
    ],
    sentence:
      'Overall service success is stable. The anomalous Task/Info signal value is being investigated from an instrumentation perspective.',
  },
  {
    key: 'latency',
    title: 'Network Latency',
    status: 'watch',
    metrics: [
      { label: '> 600 ms endpoints', value: '43 / 156' },
      { label: 'Slowest', value: 'PickupFailed 30.5 s (BA)' },
      { label: 'Highest-volume slow', value: 'GetCollectionsFromShipment 1.65 s · 520K' },
      { label: 'Weekly direction', value: 'Mixed' },
    ],
    engineeringMetrics: [
      { label: 'DeliveryFailed (RS)', value: '9.74 s · 6.5K requests' },
      { label: 'DeliveryFailed (SI)', value: '3.49 s · -94% improvement' },
      { label: 'RequestLeavingPermission', value: 'HR +383% · RS +388%' },
      { label: 'SaveImageFile (SI)', value: '1.71 s · +35%' },
    ],
    sentence:
      'Latency is concentrated in a few endpoints; no system-wide slowdown is observed.',
  },
  {
    key: 'rendering',
    title: 'Rendering Quality',
    status: 'nodata',
    metrics: [
      { label: 'Slow frames', value: 'No data' },
      { label: 'Frozen frames', value: 'No data' },
      { label: 'Coverage', value: 'Missing in all 4 countries' },
      { label: 'SDK status', value: 'To be validated' },
    ],
    sentence:
      'Rendering data is insufficient for decision-making. SDK coverage needs to be validated — this does not imply good performance.',
  },
]

// ═══ 9 · Endpoint Priority Map ═══════════════════════════════════════════════

export interface PriorityEndpoint {
  endpoint: string
  country: string
  flow: string
  p90: string
  volume: string
  change: string
  businessImpact: string
  confidence: EvidenceLevel
  action: string
  detail: {
    countries: string
    versions: string
    owner: string
    status: string
    notes: string
  }
}

export const PI_PRIORITY_ENDPOINTS: PriorityEndpoint[] = [
  {
    endpoint: 'Task/PickupFailed',
    country: 'BA',
    flow: 'Pick Up',
    p90: '30.5 s',
    volume: '220',
    change: '+5046%',
    businessImpact: 'Operational wait during failed pickup flow',
    confidence: 'needs-validation',
    action: 'Trace profiling',
    detail: {
      countries: 'BA-weighted · SI +160% (817 ms, 434 samples)',
      versions: 'v0.29 (99.5% share)',
      owner: 'Mobile Performance',
      status: 'Planned this week',
      notes: 'All responses marked as successful — request completion / instrumentation behaviour should be investigated.',
    },
  },
  {
    endpoint: 'Task/DeliveryFailed',
    country: 'RS',
    flow: 'Delivery',
    p90: '9.74 s',
    volume: '6.5K',
    change: '+4919%',
    businessImpact: 'Wait during failed delivery recording',
    confidence: 'confirmed',
    action: 'Inspect backend span',
    detail: {
      countries: 'RS 9.74 s · SI 3.49 s (-94% improvement)',
      versions: 'v0.68 (100% share)',
      owner: 'Backend',
      status: 'Planned this week',
      notes: 'Transferability of the SI improvement pattern to RS will be checked.',
    },
  },
  {
    endpoint: 'History/SaveShipmentCallInformation',
    country: 'HR',
    flow: 'Delivery',
    p90: '2.54 s',
    volume: 'High (12K)',
    change: '+18%',
    businessImpact: 'Delivery record — high volume',
    confidence: 'confirmed',
    action: 'Inspect backend span',
    detail: {
      countries: 'HR 2.54 s · SI 1.49 s (-63% improvement)',
      versions: 'v0.260',
      owner: 'Backend',
      status: 'Under investigation',
      notes: 'Improvement seen in SI; source of the HR difference (network vs. backend) will be isolated.',
    },
  },
  {
    endpoint: 'Task/RequestLeavingPermission',
    country: 'HR · RS',
    flow: 'Leave',
    p90: '2.87 s',
    volume: 'Low (150)',
    change: '+383% / +388%',
    businessImpact: 'Courier leave request flow',
    confidence: 'needs-validation',
    action: 'Trace profiling',
    detail: {
      countries: 'HR +383% · RS +388% — multi-country pattern',
      versions: 'v0.260 / v0.68',
      owner: 'Mobile Performance',
      status: 'Under investigation',
      notes: 'Simultaneous regression in two countries strengthens the likelihood of a common (backend/SDK) cause; volume is low.',
    },
  },
  {
    endpoint: 'Shipment/RaiPayAuthToken',
    country: 'HR',
    flow: 'Payment',
    p90: '1.98 s',
    volume: '343',
    change: '+9%',
    businessImpact: 'Payment initiation',
    confidence: 'confirmed',
    action: 'Monitor P95',
    detail: {
      countries: 'HR only',
      versions: 'v0.260',
      owner: 'Mobile Performance',
      status: 'Being monitored',
      notes: 'Change is small; since the payment flow is critical, it is being monitored with a P95 threshold.',
    },
  },
  {
    endpoint: 'Shipment/CreateFiscalInvoice',
    country: 'RS',
    flow: 'Fiscal',
    p90: '—',
    volume: 'Medium',
    change: '-7 points success',
    businessImpact: 'Legal fiscal obligation',
    confidence: 'confirmed',
    action: 'Root cause analysis',
    detail: {
      countries: 'RS only · 92.86% success (99% target)',
      versions: 'v0.68',
      owner: 'Backend',
      status: 'Under investigation',
      notes: 'Fiscal flow is a legal obligation — success decline must be addressed before latency.',
    },
  },
]

// ═══ 10 · Metric to Action flow ══════════════════════════════════════════════

export interface MetricFlow {
  signal: string
  validation: string
  impact: string
  action: string
  successCriteria: string
}

export const PI_METRIC_FLOWS: MetricFlow[] = [
  {
    signal: 'Task/PickupFailed P90 30.5 s (BA)',
    validation: '220 samples · BA-weighted · 100% response success',
    impact: 'Extended wait during failed pickup flow',
    action: 'Trace profiling + backend span inspection',
    successCriteria: 'P90 < 2.5 s and no new timeout observed',
  },
  {
    signal: 'Task/Info success 0% (BA · 1.7M samples)',
    validation: 'Signal inconsistent — /** wildcard at 23.37% in same period; no user complaints',
    impact: 'If confirmed, disruption in task information flow; instrumentation error likelihood is high',
    action: 'SDK trace classification + server access log comparison',
    successCriteria: 'Signal source classified (real outage / measurement error)',
  },
  {
    signal: 'BA app start P90 2.22 s (+56%)',
    validation: '318 sessions · 26 June ~8 s spike explains a significant portion of the change',
    impact: 'First transaction delay at shift start',
    action: 'Correlation of 26 June spike with v0.29 release window',
    successCriteria: 'P90 < 2.0 s in CW28 and no spike recurrence',
  },
]

// ═══ 11 · Key Findings ═══════════════════════════════════════════════════════

export interface KeyFinding {
  title: string
  body: string
  comment: string
  scope: string
  evidence: string
  level: EvidenceLevel
}

export const PI_FINDINGS: KeyFinding[] = [
  {
    title: 'BA app start above target',
    body: 'P90 app start is 2.22 seconds. Weekly change is +56%; however, the sample is limited to 318 sessions and the 26 June spike explains a significant portion of the change.',
    comment: 'Should be monitored, but should not be evaluated as a release blocker on its own.',
    scope: 'Bosnia-Herzegovina · v0.29',
    evidence: 'Firebase Performance · CW27 · 318 sessions',
    level: 'needs-validation',
  },
  {
    title: 'PickupFailed endpoint producing anomalous latency',
    body: 'P90 is 30.5 seconds. There are 220 samples and all responses are marked as successful.',
    comment: 'Request completion or instrumentation behaviour should be investigated rather than the error rate.',
    scope: 'BA · Task/PickupFailed',
    evidence: 'BA / Task/PickupFailed · 220 samples',
    level: 'needs-validation',
  },
  {
    title: 'Task/Info success signal under validation',
    body: 'Trace shows 0% success (1.7M samples) but user impact or actual service outage has not been confirmed; operational traces in the same period are stable.',
    comment: 'Instrumentation or wildcard classification issue is highly likely; root cause analysis is mandatory.',
    scope: 'BA · Task/Info',
    evidence: 'Firebase trace · 1.7M samples · single signal',
    level: 'needs-validation',
  },
  {
    title: '"Failed" task endpoints producing multi-country outliers',
    body: 'PickupFailed (BA 30.5 s) and DeliveryFailed (RS 9.74 s, SI 3.49 s) follow the same pattern. RequestLeavingPermission is also simultaneously regressing in two countries (HR +383%, RS +388%).',
    comment: 'Multi-country recurrence points to a common backend or SDK cause; not single-country noise.',
    scope: 'BA · RS · SI · HR',
    evidence: 'Firebase Performance · 4 countries · CW26–CW27 recurrence',
    level: 'confirmed',
  },
  {
    title: 'Rendering visibility insufficient',
    body: 'Slow/frozen frame data is insufficient for decision-making in all four countries.',
    comment: 'This does not mean good rendering performance; telemetry coverage must be completed.',
    scope: 'All countries',
    evidence: 'Rendering SDK coverage · 4/4 countries',
    level: 'confirmed',
  },
]

// ═══ 12 · Action Tracker ═════════════════════════════════════════════════════

export type ActionColumn = 'this-week' | 'investigating' | 'done'

export interface PiAction {
  column: ActionColumn
  title: string
  priority: 'P1' | 'P2' | 'P3'
  owner: string
  due: string
  countries: string
  expected: string
  evidence: string
  level: EvidenceLevel
}

export const PI_ACTIONS: PiAction[] = [
  {
    column: 'this-week',
    title: 'PickupFailed trace profiling',
    priority: 'P1',
    owner: 'Mobile Performance',
    due: '4 Jul 2026',
    countries: 'BA · SI',
    expected: 'P90 < 2.5 s, timeout pattern classified',
    evidence: '30.5 s · 220 samples',
    level: 'needs-validation',
  },
  {
    column: 'this-week',
    title: 'BA 26 June spike analysis',
    priority: 'P2',
    owner: 'Mobile Performance',
    due: '4 Jul 2026',
    countries: 'BA',
    expected: 'Spike version/infrastructure correlation reported',
    evidence: '~8 s spike · v0.29',
    level: 'needs-validation',
  },
  {
    column: 'this-week',
    title: 'Rendering SDK coverage validation',
    priority: 'P2',
    owner: 'Mobile Platform',
    due: '7 Jul 2026',
    countries: 'All',
    expected: 'Slow/frozen frame data flowing from CW29 onwards',
    evidence: 'No data in 4/4 countries',
    level: 'confirmed',
  },
  {
    column: 'investigating',
    title: 'Task/Info success-rate measurement anomaly',
    priority: 'P1',
    owner: 'Backend + Mobile',
    due: '9 Jul 2026',
    countries: 'BA',
    expected: 'Real outage / measurement error distinction clarified',
    evidence: '0% signal · 1.7M samples',
    level: 'needs-validation',
  },
  {
    column: 'investigating',
    title: 'Wildcard trace classification',
    priority: 'P3',
    owner: 'Mobile Platform',
    due: '11 Jul 2026',
    countries: 'HR · BA',
    expected: '*/* traces resolved to actual endpoints',
    evidence: 'HR 3.12 s · BA 23.37%',
    level: 'needs-validation',
  },
  {
    column: 'investigating',
    title: 'CreateFiscalInvoice success decline',
    priority: 'P2',
    owner: 'Backend',
    due: '9 Jul 2026',
    countries: 'RS',
    expected: 'Return to >= 99% success target',
    evidence: '92.86% · -7 points',
    level: 'confirmed',
  },
  {
    column: 'done',
    title: 'Task/DeliverParcels optimisation',
    priority: 'P1',
    owner: 'Backend',
    due: 'CW26',
    countries: 'HR',
    expected: '958 ms · 65% improvement (31K requests) — confirmed',
    evidence: '31K requests · multi-week',
    level: 'confirmed',
  },
  {
    column: 'done',
    title: 'CheckHasCourierTodaySchedule regression',
    priority: 'P2',
    owner: 'Backend',
    due: 'CW26',
    countries: 'HR',
    expected: 'Not observed again in this window — closed',
    evidence: 'CW27 window clean',
    level: 'confirmed',
  },
]

export const PI_ACTION_COLUMNS: { key: ActionColumn; label: string; tone: 'blue' | 'amber' | 'green' }[] = [
  { key: 'this-week', label: 'This Week', tone: 'blue' },
  { key: 'investigating', label: 'Under Investigation', tone: 'amber' },
  { key: 'done', label: 'Verified / Completed', tone: 'green' },
]

// ═══ 13 · Change Timeline ════════════════════════════════════════════════════

export type TimelineTag = 'Release' | 'Config' | 'Incident' | 'Metric anomaly' | 'Monitoring change'

export interface PiTimelineEvent {
  date: string
  title: string
  desc: string
  tag: TimelineTag
}

export const PI_TIMELINE: PiTimelineEvent[] = [
  { date: '24 June', title: 'HR v0.260 released', desc: 'Rollout reached 97% share; app start on v0.260 is 1.61 s.', tag: 'Release' },
  { date: '26 June', title: 'BA app start spike', desc: '~8 second spike on v0.29; alert active. Explains a significant portion of the weekly +56%.', tag: 'Metric anomaly' },
  { date: '27 June', title: 'Task/DeliverParcels optimisation active', desc: '958 ms · 65% improvement (31K requests) confirmed in HR.', tag: 'Config' },
  { date: '27 June', title: 'SI app start spike', desc: '~4.4 s spike; last week\'s 7.09 s spike has recovered.', tag: 'Metric anomaly' },
  { date: '29 June', title: 'HR crash concentration', desc: '9 crashes in a single day; 7-day crash-free dropped to 95.99%. Root cause being investigated.', tag: 'Incident' },
  { date: '30 June', title: 'CW27 report generated', desc: 'Firebase Performance data pulled between 09:19–09:23.', tag: 'Monitoring change' },
]

// ═══ 14 · Guardrails ═════════════════════════════════════════════════════════

export interface Guardrail {
  title: string
  body: string
}

export const PI_GUARDRAILS: Guardrail[] = [
  {
    title: 'Performance Watch != Incident',
    body: 'A metric being off-target does not in itself mean an active incident. The incident decision is made together with user impact, scope and workflow disruption.',
  },
  {
    title: 'Regression != User Impact',
    body: 'A high percentage change may stem from a low sample size. Volume, absolute duration and business flow importance must be evaluated together.',
  },
  {
    title: 'No Data != Healthy',
    body: 'The absence of rendering data does not indicate that there are no rendering issues. This area is tracked as a telemetry gap.',
  },
  {
    title: 'Success Rate != Full Success',
    body: 'HTTP or Firebase trace success does not guarantee that the operation completed correctly from a business rule perspective.',
  },
]

// ═══ 15 · Evidence & Data Quality ════════════════════════════════════════════

export interface DataQualityRow {
  country: string
  appStartSamples: string
  networkVolume: string
  rendering: string
  crash: string
  confidence: 'High' | 'Medium' | 'Low'
}

export const PI_DATA_QUALITY: DataQualityRow[] = [
  { country: 'Croatia', appStartSamples: '599 (24 hours)', networkVolume: '46 traces · 31K+ requests', rendering: 'No data', crash: '7 days · complete', confidence: 'High' },
  { country: 'Bosnia-Herzegovina', appStartSamples: '318 (7 days)', networkVolume: '33 traces · incl. 1.7M', rendering: '~5 sessions · insufficient', crash: 'No data', confidence: 'Low' },
  { country: 'Slovenia', appStartSamples: '312 (7 days)', networkVolume: '36 traces · 148K+ requests', rendering: 'No data', crash: '7 days · complete', confidence: 'Low' },
  { country: 'Serbia', appStartSamples: '3K (7 days)', networkVolume: '41 traces · 520K+ requests', rendering: '2 samples · insufficient', crash: '7 days · complete', confidence: 'High' },
]

export const PI_EVIDENCE_RULES = {
  strong: [
    'High sample size',
    'Recurrence across multiple weeks',
    'Consistent across multiple countries',
    'Confirmed by incident or user report',
  ],
  weak: [
    'Low sample size',
    'Single-country or single-day spike',
    'Instrumentation suspected',
    'Volume information missing',
  ],
}
