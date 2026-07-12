// Nesy Mobile ülke bazlı performans raporları — tek gerçek kaynak.
// Kaynak: Firebase Performance "Performance Intelligence Report" · Haftalık Bülten Sayı 03 · CW27 2026.
// Tüm değerler P90, Production ortamı. Yayın: 30 Haziran 2026, Performans Ekibi.

export type PerfCountryId = 'hr' | 'ba' | 'si' | 'rs'

export type PerfStatus = 'healthy' | 'good' | 'watch' | 'low' | 'critical' | 'nodata'

export interface PerfEndpoint {
  name: string
  responseP90: string
  success: string
  volume?: string
  note?: string
  /** true = regresyon, false = iyileşme, undefined = nötr */
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
  window: '24 saat' | '7 gün'
  headline: string
  dataTimestamp: string
  appStart: {
    value: string
    deltaPct: number // + = yavaşladı, - = hızlandı
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
  networkSuccess: '> %99',
  latencyThreshold: '600 ms üzeri endpoint sayısı = 0',
  rendering: 'slow frame < %5 · frozen frame < %0.1',
}

export const PERF_REPORTS: CountryPerfReport[] = [
  {
    id: 'hr',
    country: 'Hırvatistan',
    domain: 'overseas.hr',
    period: '29–30 Haziran 2026',
    window: '24 saat',
    headline: 'App start iyileşti — izlenecek wildcard API gecikmeleri var.',
    dataTimestamp: '30 Haz 2026 · 09:19',
    appStart: {
      value: '1.49 s',
      deltaPct: -21,
      vsTarget: 'Hedefin 510 ms altında (%25.5)',
      belowTarget: true,
      dominantVersion: 'v0.260',
      versionShare: '%97',
      versionValue: '1.61 s',
      samples: '599',
      spikeNote: '29 Haziran akşamı v0.260 üzerinde 4 sn+ spike gözlendi.',
    },
    networkSuccess: { status: 'healthy', minValue: '%100', detail: 'Görünen tüm endpoint’ler %100 (46 trace).' },
    networkLatency: { status: 'watch', overThreshold: '15 / 46', slowest: '*/* wildcard · 3.12 s' },
    screenRendering: { status: 'nodata', detail: 'Slow/frozen frame kaydı yok.' },
    customTraces: [
      { name: '_app_in_foreground', value: '3.8 dk', delta: '+22%' },
      { name: '_app_in_background', value: '7.3 dk', delta: '+47%' },
      { name: '_app_start', value: '1.49 s', delta: '−21%' },
    ],
    topEndpoints: [
      { name: '*/* (wildcard)', responseP90: '3.12 s', success: '%100', note: 'En yavaş trace', regression: true },
      { name: 'Task/RequestLeavingPermission', responseP90: '2.87 s', success: '%100', note: '+383% regresyon · düşük hacim', regression: true },
      { name: 'History/SaveShipmentCallInformation', responseP90: '2.54 s', success: '%100', note: 'Yüksek hacim' },
      { name: 'HubCompanion/ProcessAndLogEventParcels', responseP90: '2.21 s', success: '%100', note: 'Operasyonel hub akışı' },
      { name: 'Shipment/RaiPayAuthToken', responseP90: '1.98 s', success: '%100', volume: '343', note: 'Ödeme akışı' },
    ],
    findings: [
      'Task/DeliverParcels 958 ms — %65 iyileşme (31K istek).',
      'Geçen haftaki CheckHasCourierTodaySchedule düşüşü bu pencerede gözlenmedi.',
      'Task/f/SaveImageFile artık top-5 listesinde değil.',
      'Saatlik 243 aktif kullanıcı.',
    ],
    crashlytics: '7 günde 24 crash / 23 kullanıcı · %95.99 crash-free (−2.6 puan) · 29 Haziran’da 9 crash.',
    recommendations: [
      { priority: 'P1', text: 'RequestLeavingPermission (2.87 s, +383%) ve */* wildcard (3.12 s) profillenmeli.' },
      { priority: 'P2', text: '29 Haziran crash spike’ının kök nedeni bulunmalı (9 crash).' },
      { priority: 'P3', text: 'Screen Rendering SDK kapsaması doğrulanmalı.' },
    ],
  },
  {
    id: 'ba',
    country: 'Bosna Hersek',
    domain: 'expressone.ba',
    period: '24–30 Haziran 2026',
    window: '7 gün',
    headline: 'PickupFailed outlier — app start regresyonu, düşük örneklem.',
    dataTimestamp: '30 Haz 2026 · 09:23',
    appStart: {
      value: '2.22 s',
      deltaPct: 56,
      vsTarget: 'Hedefin 220 ms üstünde',
      belowTarget: false,
      dominantVersion: 'v0.29',
      versionShare: '%99.5',
      versionValue: '2.22 s',
      samples: '318',
      lowSample: true,
      spikeNote: '26 Haziran’da ~8 sn spike; alert aktif.',
    },
    networkSuccess: {
      status: 'critical',
      minValue: '%0',
      detail: 'Task/Info %0 başarı (1.7M örnek) · /** wildcard %23.37 (−77 puan).',
    },
    networkLatency: { status: 'watch', overThreshold: '5 / 33', slowest: 'Task/PickupFailed · 30.50 s' },
    screenRendering: { status: 'nodata', detail: 'Düşük örneklem (~5 oturum); frame verisi yok.' },
    customTraces: [
      { name: '_app_in_foreground', value: '2.7 dk', delta: '−8%' },
      { name: '_app_in_background', value: '9.3 dk', delta: '−3%' },
      { name: '_app_start', value: '2.22 s', delta: '+56%' },
    ],
    topEndpoints: [
      { name: 'Task/PickupFailed', responseP90: '30.50 s', success: '%100', volume: '220', note: '+5046% regresyon', regression: true },
      { name: 'Task/GetPickupShipmentDetails', responseP90: '1.27 s', success: '%100', volume: '1K', note: '+269% regresyon', regression: true },
      { name: 'Auth/LoginDevice', responseP90: '1.01 s', success: '%100', volume: '419', note: '+27%', regression: true },
      { name: 'Auth/*', responseP90: '980 ms', success: '%100', volume: '200', note: '+53%', regression: true },
      { name: '*/* (wildcard)', responseP90: '615 ms', success: '%100', volume: '22K', note: '+268%', regression: true },
    ],
    findings: [
      'Task/Info %0 başarı — 1.7M örnek; muhtemel istemci/SDK ölçüm sorunu veya gerçek kesinti, kök neden zorunlu.',
      'Shipment/* %99.97 — en düşük operasyonel trace.',
      'Operasyonel Task endpoint’lerinin çoğu artık 600 ms altında.',
    ],
    recommendations: [
      { priority: 'P1', text: 'PickupFailed (30.50 s, +5046%, 220 örnek) profillenmeli.' },
      { priority: 'P2', text: 'Task/Info %0 başarı (1.7M örnek) ve /** %23.37 kök nedeni bulunmalı.' },
      { priority: 'P3', text: '26 Haziran ~8 sn app start spike’ı analiz edilmeli (v0.29).' },
    ],
  },
  {
    id: 'si',
    country: 'Slovenya',
    domain: 'expressone.si',
    period: '24–30 Haziran 2026',
    window: '7 gün',
    headline: 'App start toparlandı — hedef üstü regresyon sürüyor.',
    dataTimestamp: '30 Haz 2026 · 09:21',
    appStart: {
      value: '2.34 s',
      deltaPct: 36,
      vsTarget: 'Hedefin 340 ms üstünde',
      belowTarget: false,
      dominantVersion: 'v0.174',
      versionShare: '%85',
      versionValue: '2.40 s',
      samples: '312',
      lowSample: true,
      spikeNote: 'Geçen haftaki 7.09 sn spike toparlandı; 27 Haziran’da ~4.4 sn spike.',
    },
    networkSuccess: { status: 'good', minValue: '%99.82', detail: 'Çoğu endpoint %100; en düşük DeliverParcels %99.82.' },
    networkLatency: { status: 'watch', overThreshold: '11 / 36', slowest: 'Task/DeliveryFailed · 3.49 s' },
    screenRendering: { status: 'nodata', detail: 'Frame verisi yok.' },
    customTraces: [
      { name: '_app_in_foreground', value: '4.0 dk', delta: '+3%' },
      { name: '_app_in_background', value: '4.6 dk', delta: '−5%' },
      { name: '_app_start', value: '2.34 s', delta: '+36%' },
    ],
    topEndpoints: [
      { name: 'Task/DeliveryFailed', responseP90: '3.49 s', success: '%100', volume: '540', note: '−94% iyileşme', regression: false },
      { name: 'Shipment/GetCollectionsFromShipment', responseP90: '2.17 s', success: '%100', volume: '148K', note: '−13% iyileşme', regression: false },
      { name: 'Task/f/SaveImageFile', responseP90: '1.71 s', success: '%100', volume: '31K', note: '+35% regresyon', regression: true },
      { name: 'History/SaveShipmentCallInformation', responseP90: '1.49 s', success: '%100', volume: '12K', note: '−63% iyileşme', regression: false },
      { name: 'Task/CreateD4MReservation', responseP90: '1.43 s', success: '%100', volume: '5.7K', note: '+27%', regression: true },
    ],
    findings: [
      'Task/PickupFailed +160% regresyon (817 ms, 434 örnek).',
      'GetAvailableWorkingDays outlier’ı kaldırıldı (188 ms).',
    ],
    crashlytics: '7 günde %100 crash-free kullanıcı ve oturum · yalnızca 24 Haziran’da 1 crash.',
    recommendations: [
      { priority: 'P1', text: 'DeliveryFailed (3.49 s) ve SaveImageFile (1.71 s, +35%) profillenmeli.' },
      { priority: 'P2', text: 'App start +36% haftalık regresyon ve 27 Haziran ~4.4 sn spike analiz edilmeli.' },
      { priority: 'P3', text: 'PickupFailed +160% (817 ms, 434 örnek) izlenmeli.' },
    ],
  },
  {
    id: 'rs',
    country: 'Sırbistan',
    domain: 'cityexpress.rs',
    period: '24–30 Haziran 2026',
    window: '7 gün',
    headline: 'DeliveryFailed outlier — app start hedef altı, %8 regresyon.',
    dataTimestamp: '30 Haz 2026 · 09:22',
    appStart: {
      value: '1.25 s',
      deltaPct: 8,
      vsTarget: 'Hedefin 750 ms altında',
      belowTarget: true,
      dominantVersion: 'v0.68',
      versionShare: '%100',
      versionValue: '1.25 s',
      samples: '3K',
    },
    networkSuccess: {
      status: 'low',
      minValue: '%92.86',
      detail: 'CreateFiscalInvoice %92.86 (−7 puan, %99 hedefinin altında).',
    },
    networkLatency: { status: 'watch', overThreshold: '12 / 41', slowest: 'Task/DeliveryFailed · 9.74 s' },
    screenRendering: { status: 'nodata', detail: 'Frame verisi yok (2 örnek · düşük).' },
    customTraces: [
      { name: '_app_in_foreground', value: '3.5 dk', delta: '−2%' },
      { name: '_app_in_background', value: '4.7 dk', delta: '−8%' },
      { name: '_app_start', value: '1.25 s', delta: '+8%' },
    ],
    topEndpoints: [
      { name: 'Task/DeliveryFailed', responseP90: '9.74 s', success: '%100', volume: '6.5K', note: '+4919% regresyon', regression: true },
      { name: 'Task/DeliverParcels', responseP90: '1.87 s', success: '%100', volume: '49K', note: '+82%', regression: true },
      { name: 'Task/DeliverParcelsFromParcelShop', responseP90: '1.75 s', success: '%100', volume: '2.4K', note: '−93% iyileşme (önceki outlier 47.07 s)', regression: false },
      { name: 'Shipment/GetCollectionsFromShipment', responseP90: '1.65 s', success: '%99.87', volume: '520K', note: '−42% iyileşme', regression: false },
      { name: 'Task/CreateD4MReservation', responseP90: '1.40 s', success: '%100', volume: '570', note: '−8% iyileşme', regression: false },
    ],
    findings: [
      'RequestLeavingPermission +388% ve SaveImageFile +332% regresyon.',
      'CreateFiscalInvoice %92.86 başarı — fiscal akışı için kritik izleme konusu.',
      'GetCollectionsFromShipment %99.87 (iyileşiyor, 520K istek).',
    ],
    recommendations: [
      { priority: 'P1', text: 'DeliveryFailed (9.74 s, +4919%, 6.5K istek) profillenmeli.' },
      { priority: 'P2', text: 'RequestLeavingPermission (+388%), SaveImageFile (+332%) ve DeliverParcels (1.87 s, +82%) analiz edilmeli.' },
      { priority: 'P3', text: 'CreateFiscalInvoice %92.86 başarı (−7 puan) kök nedeni bulunmalı.' },
    ],
  },
]

/** Kalıcı, ülkeler arası desenler — rapor sentezi. */
export const PERF_CROSS_FINDINGS = [
  'Screen rendering (slow/frozen frame) verisi dört ülkede de boş — SDK kapsaması doğrulanmalı.',
  '"Failed" task endpoint’leri (PickupFailed, DeliveryFailed) BA ve RS’de aşırı outlier üretiyor (30.5 s / 9.74 s).',
  'RequestLeavingPermission birden fazla ülkede regrese oluyor (HR +383%, RS +388%).',
  'BA ve SI düşük örneklem uyarısı taşıyor (318 / 312 app start örneği) — sonuçlar temkinli okunmalı.',
  'App start hedefi (<2.0 s) yalnızca HR ve RS’de tutuyor; BA ve SI hedef üstü.',
]
