// Nesy Mobile country-based performance reports — single source of truth.
// Source: Firebase Performance "Performance Intelligence Report" · Weekly Bulletin Issue 03 · CW27 2026.
// All values are P90, Production environment. Published: June 30, 2026, Performance Team.

export type PerfCountryId = 'hr' | 'ba' | 'si' | 'rs'

export type PerfStatus = 'healthy' | 'good' | 'watch' | 'low' | 'critical' | 'nodata'

export interface PerfEndpoint {
  name: string
  responseP90: string
  success: string
  volume?: string
  note?: string
  /** true = regression, false = improvement, undefined = neutral */
  regression?: boolean
}

export interface PerfRecommendation {
  priority: 'P1' | 'P2' | 'P3'
  text: string
}

export interface CountryPerfReport {
  id: PerfCountryId
  country: string
  domain: string
  period: string
  window: '24 hours' | '7 days'
  headline: string
  dataTimestamp: string
  appStart: {
    value: string
    deltaPct: number // + = slowed down, - = sped up
    vsTarget: string
    belowTarget: boolean
    dominantVersion: string
    versionShare: string
    versionValue: string
    samples: string
    lowSample?: boolean
    spikeNote?: string
  }
  networkSuccess: {
    status: PerfStatus
    minValue: string
    detail: string
  }
  networkLatency: {
    status: PerfStatus
    overThreshold: string // "15 / 46"
    slowest: string
  }
  screenRendering: { status: PerfStatus; detail: string }
  customTraces: { name: string; value: string; delta: string }[]
  topEndpoints: PerfEndpoint[]
  findings: string[]
  crashlytics?: string
  recommendations: PerfRecommendation[]
}

export const PERF_TARGETS = {
  appStart: '< 2.0 s (P90 cold start)',
  networkSuccess: '> 99%',
  latencyThreshold: 'Number of endpoints above 600 ms = 0',
  rendering: 'slow frame < 5% · frozen frame < 0.1%',
}

export const PERF_REPORTS: CountryPerfReport[] = [
  {
    id: 'hr',
    country: 'Croatia',
    domain: 'overseas.hr',
    period: 'June 29-30, 2026',
    window: '24 hours',
    headline: 'App start improved — wildcard API latencies to monitor.',
    dataTimestamp: 'Jun 30, 2026 · 09:19',
    appStart: {
      value: '1.49 s',
      deltaPct: -21,
      vsTarget: '510 ms below target (25.5%)',
      belowTarget: true,
      dominantVersion: 'v0.260',
      versionShare: '97%',
      versionValue: '1.61 s',
      samples: '599',
      spikeNote: '4 s+ spike observed on v0.260 during the evening of June 29.',
    },
    networkSuccess: { status: 'healthy', minValue: '100%', detail: 'All visible endpoints at 100% (46 traces).' },
    networkLatency: { status: 'watch', overThreshold: '15 / 46', slowest: '*/* wildcard · 3.12 s' },
    screenRendering: { status: 'nodata', detail: 'No slow/frozen frame records.' },
    customTraces: [
      { name: '_app_in_foreground', value: '3.8 min', delta: '+22%' },
      { name: '_app_in_background', value: '7.3 min', delta: '+47%' },
      { name: '_app_start', value: '1.49 s', delta: '-21%' },
    ],
    topEndpoints: [
      { name: '*/* (wildcard)', responseP90: '3.12 s', success: '100%', note: 'Slowest trace', regression: true },
      { name: 'Task/RequestLeavingPermission', responseP90: '2.87 s', success: '100%', note: '+383% regression · low volume', regression: true },
      { name: 'History/SaveShipmentCallInformation', responseP90: '2.54 s', success: '100%', note: 'High volume' },
      { name: 'HubCompanion/ProcessAndLogEventParcels', responseP90: '2.21 s', success: '100%', note: 'Operational hub flow' },
      { name: 'Shipment/RaiPayAuthToken', responseP90: '1.98 s', success: '100%', volume: '343', note: 'Payment flow' },
    ],
    findings: [
      'Task/DeliverParcels 958 ms — 65% improvement (31K requests).',
      'Last week\'s CheckHasCourierTodaySchedule drop not observed in this window.',
      'Task/f/SaveImageFile is no longer in the top-5 list.',
      '243 active users per hour.',
    ],
    crashlytics: '24 crashes / 23 users in 7 days · 95.99% crash-free (-2.6 points) · 9 crashes on June 29.',
    recommendations: [
      { priority: 'P1', text: 'RequestLeavingPermission (2.87 s, +383%) and */* wildcard (3.12 s) should be profiled.' },
      { priority: 'P2', text: 'Root cause of June 29 crash spike should be found (9 crashes).' },
      { priority: 'P3', text: 'Screen Rendering SDK coverage should be verified.' },
    ],
  },
  {
    id: 'ba',
    country: 'Bosnia and Herzegovina',
    domain: 'expressone.ba',
    period: 'June 24-30, 2026',
    window: '7 days',
    headline: 'PickupFailed outlier — app start regression, low sample size.',
    dataTimestamp: 'Jun 30, 2026 · 09:23',
    appStart: {
      value: '2.22 s',
      deltaPct: 56,
      vsTarget: '220 ms above target',
      belowTarget: false,
      dominantVersion: 'v0.29',
      versionShare: '99.5%',
      versionValue: '2.22 s',
      samples: '318',
      lowSample: true,
      spikeNote: '~8 s spike on June 26; alert active.',
    },
    networkSuccess: {
      status: 'critical',
      minValue: '0%',
      detail: 'Task/Info 0% success (1.7M samples) · /** wildcard 23.37% (-77 points).',
    },
    networkLatency: { status: 'watch', overThreshold: '5 / 33', slowest: 'Task/PickupFailed · 30.50 s' },
    screenRendering: { status: 'nodata', detail: 'Low sample size (~5 sessions); no frame data.' },
    customTraces: [
      { name: '_app_in_foreground', value: '2.7 min', delta: '-8%' },
      { name: '_app_in_background', value: '9.3 min', delta: '-3%' },
      { name: '_app_start', value: '2.22 s', delta: '+56%' },
    ],
    topEndpoints: [
      { name: 'Task/PickupFailed', responseP90: '30.50 s', success: '100%', volume: '220', note: '+5046% regression', regression: true },
      { name: 'Task/GetPickupShipmentDetails', responseP90: '1.27 s', success: '100%', volume: '1K', note: '+269% regression', regression: true },
      { name: 'Auth/LoginDevice', responseP90: '1.01 s', success: '100%', volume: '419', note: '+27%', regression: true },
      { name: 'Auth/*', responseP90: '980 ms', success: '100%', volume: '200', note: '+53%', regression: true },
      { name: '*/* (wildcard)', responseP90: '615 ms', success: '100%', volume: '22K', note: '+268%', regression: true },
    ],
    findings: [
      'Task/Info 0% success — 1.7M samples; probable client/SDK measurement issue or actual outage, root cause mandatory.',
      'Shipment/* 99.97% — lowest operational trace.',
      'Most operational Task endpoints are now below 600 ms.',
    ],
    recommendations: [
      { priority: 'P1', text: 'PickupFailed (30.50 s, +5046%, 220 samples) should be profiled.' },
      { priority: 'P2', text: 'Task/Info 0% success (1.7M samples) and /** 23.37% root cause must be found.' },
      { priority: 'P3', text: 'June 26 ~8 s app start spike should be analyzed (v0.29).' },
    ],
  },
  {
    id: 'si',
    country: 'Slovenia',
    domain: 'expressone.si',
    period: 'June 24-30, 2026',
    window: '7 days',
    headline: 'App start recovered — above-target regression persists.',
    dataTimestamp: 'Jun 30, 2026 · 09:21',
    appStart: {
      value: '2.34 s',
      deltaPct: 36,
      vsTarget: '340 ms above target',
      belowTarget: false,
      dominantVersion: 'v0.174',
      versionShare: '85%',
      versionValue: '2.40 s',
      samples: '312',
      lowSample: true,
      spikeNote: 'Last week\'s 7.09 s spike recovered; ~4.4 s spike on June 27.',
    },
    networkSuccess: { status: 'good', minValue: '99.82%', detail: 'Most endpoints at 100%; lowest DeliverParcels 99.82%.' },
    networkLatency: { status: 'watch', overThreshold: '11 / 36', slowest: 'Task/DeliveryFailed · 3.49 s' },
    screenRendering: { status: 'nodata', detail: 'No frame data.' },
    customTraces: [
      { name: '_app_in_foreground', value: '4.0 min', delta: '+3%' },
      { name: '_app_in_background', value: '4.6 min', delta: '-5%' },
      { name: '_app_start', value: '2.34 s', delta: '+36%' },
    ],
    topEndpoints: [
      { name: 'Task/DeliveryFailed', responseP90: '3.49 s', success: '100%', volume: '540', note: '-94% improvement', regression: false },
      { name: 'Shipment/GetCollectionsFromShipment', responseP90: '2.17 s', success: '100%', volume: '148K', note: '-13% improvement', regression: false },
      { name: 'Task/f/SaveImageFile', responseP90: '1.71 s', success: '100%', volume: '31K', note: '+35% regression', regression: true },
      { name: 'History/SaveShipmentCallInformation', responseP90: '1.49 s', success: '100%', volume: '12K', note: '-63% improvement', regression: false },
      { name: 'Task/CreateD4MReservation', responseP90: '1.43 s', success: '100%', volume: '5.7K', note: '+27%', regression: true },
    ],
    findings: [
      'Task/PickupFailed +160% regression (817 ms, 434 samples).',
      'GetAvailableWorkingDays outlier removed (188 ms).',
    ],
    crashlytics: '100% crash-free users and sessions in 7 days · only 1 crash on June 24.',
    recommendations: [
      { priority: 'P1', text: 'DeliveryFailed (3.49 s) and SaveImageFile (1.71 s, +35%) should be profiled.' },
      { priority: 'P2', text: 'App start +36% weekly regression and June 27 ~4.4 s spike should be analyzed.' },
      { priority: 'P3', text: 'PickupFailed +160% (817 ms, 434 samples) should be monitored.' },
    ],
  },
  {
    id: 'rs',
    country: 'Serbia',
    domain: 'cityexpress.rs',
    period: 'June 24-30, 2026',
    window: '7 days',
    headline: 'DeliveryFailed outlier — app start below target, 8% regression.',
    dataTimestamp: 'Jun 30, 2026 · 09:22',
    appStart: {
      value: '1.25 s',
      deltaPct: 8,
      vsTarget: '750 ms below target',
      belowTarget: true,
      dominantVersion: 'v0.68',
      versionShare: '100%',
      versionValue: '1.25 s',
      samples: '3K',
    },
    networkSuccess: {
      status: 'low',
      minValue: '92.86%',
      detail: 'CreateFiscalInvoice 92.86% (-7 points, below 99% target).',
    },
    networkLatency: { status: 'watch', overThreshold: '12 / 41', slowest: 'Task/DeliveryFailed · 9.74 s' },
    screenRendering: { status: 'nodata', detail: 'No frame data (2 samples · low).' },
    customTraces: [
      { name: '_app_in_foreground', value: '3.5 min', delta: '-2%' },
      { name: '_app_in_background', value: '4.7 min', delta: '-8%' },
      { name: '_app_start', value: '1.25 s', delta: '+8%' },
    ],
    topEndpoints: [
      { name: 'Task/DeliveryFailed', responseP90: '9.74 s', success: '100%', volume: '6.5K', note: '+4919% regression', regression: true },
      { name: 'Task/DeliverParcels', responseP90: '1.87 s', success: '100%', volume: '49K', note: '+82%', regression: true },
      { name: 'Task/DeliverParcelsFromParcelShop', responseP90: '1.75 s', success: '100%', volume: '2.4K', note: '-93% improvement (previous outlier 47.07 s)', regression: false },
      { name: 'Shipment/GetCollectionsFromShipment', responseP90: '1.65 s', success: '99.87%', volume: '520K', note: '-42% improvement', regression: false },
      { name: 'Task/CreateD4MReservation', responseP90: '1.40 s', success: '100%', volume: '570', note: '-8% improvement', regression: false },
    ],
    findings: [
      'RequestLeavingPermission +388% and SaveImageFile +332% regression.',
      'CreateFiscalInvoice 92.86% success — critical monitoring item for fiscal flow.',
      'GetCollectionsFromShipment 99.87% (improving, 520K requests).',
    ],
    recommendations: [
      { priority: 'P1', text: 'DeliveryFailed (9.74 s, +4919%, 6.5K requests) should be profiled.' },
      { priority: 'P2', text: 'RequestLeavingPermission (+388%), SaveImageFile (+332%), and DeliverParcels (1.87 s, +82%) should be analyzed.' },
      { priority: 'P3', text: 'CreateFiscalInvoice 92.86% success (-7 points) root cause must be found.' },
    ],
  },
]

/** Persistent, cross-country patterns — report synthesis. */
export const PERF_CROSS_FINDINGS = [
  'Screen rendering (slow/frozen frame) data is empty across all four countries — SDK coverage should be verified.',
  '"Failed" task endpoints (PickupFailed, DeliveryFailed) are producing extreme outliers in BA and RS (30.5 s / 9.74 s).',
  'RequestLeavingPermission is regressing in multiple countries (HR +383%, RS +388%).',
  'BA and SI carry low sample size warnings (318 / 312 app start samples) — results should be interpreted with caution.',
  'App start target (< 2.0 s) is only met in HR and RS; BA and SI are above target.',
]
