// Performance Intelligence — yorum, anlatı, trend ve aksiyon katmanı.
// Ham metrikler: ./performance.ts (Firebase Performance · CW27 2026).
// Bu dosya rakamı yorumlar: güven seviyesi, iş etkisi, önceliklendirme ve aksiyon.
// CW22–CW26 trend değerleri haftalık bülten arşivinden derlenmiştir.

import type { PerfCountryId } from './performance'
import type { EvidenceLevel } from '@/components/product'

export type HealthStatus = 'on-target' | 'near-target' | 'watch' | 'action' | 'validate' | 'nodata'

export const HEALTH_LABELS: Record<HealthStatus, string> = {
  'on-target': 'Hedefte',
  'near-target': 'Hedefe yakın',
  watch: 'Takipte',
  action: 'Aksiyon öneriliyor',
  validate: 'Veri doğrulaması gerekli',
  nodata: 'Veri yetersiz',
}

// ═══ 1 · Executive Brief ═════════════════════════════════════════════════════

export const PI_META = {
  title: 'Performance Intelligence',
  subtitle: 'Ülke bazlı kullanıcı deneyimi, servis sağlığı, eğilimler ve öncelikli iyileştirme alanları.',
  period: 'CW27 · 2026',
  periodRange: '24–30 Haziran 2026',
  environment: 'Production',
  percentile: 'P90',
  dataTimestamp: '30 Haziran 2026 · 09:23',
  releases: 'HR v0.260 · BA v0.29 · SI v0.174 · RS v0.68',
  confidence: 'Orta — BA ve SI düşük örneklem taşıyor',
  source: 'Firebase Performance · Haftalık Bülten Sayı 03',
}

export const PI_BRIEF = {
  headline: 'Haftalık performans görünümü — CW27 · 2026',
  summary:
    'Dört ülkenin ikisinde uygulama açılış hedefi korunuyor; Bosna Hersek ve Slovenya’da başlangıç ' +
    'süresi hedefin üzerinde. Servis başarı oranları genel olarak stabil, ancak bazı ölçümlerde veri ' +
    'doğrulaması gerekiyor. Rendering telemetrisi dört ülkede de karar üretecek seviyede değil.',
  overallStatus: 'Yönetilebilir — 2 alan takipte',
  overallTone: 'amber' as const,
  statusBullets: [
    '2 ülke hedefte (HR, RS)',
    '2 ülke takipte (BA, SI)',
    '1 metrikte veri boşluğu (rendering)',
    '3 öncelikli aksiyon bu hafta',
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
  { label: 'App Start P90', value: '1.25–2.34 s', secondary: '2/4 ülke hedefte (< 2.0 s)', tone: 'amber' },
  { label: 'Network Success', value: '≥ %99.8', secondary: 'Task/Info sinyali doğrulanıyor (BA)', tone: 'blue' },
  { label: 'P90 Latency', value: '43 / 156', secondary: '600 ms üzeri endpoint · 4 ülke toplamı', tone: 'amber' },
  { label: 'Crash-free Users', value: '%96.0–100', secondary: 'HR −2.6 puan · SI %100', tone: 'green' },
  { label: 'Data Coverage', value: 'Kısıtlı', secondary: 'Rendering verisi 4 ülkede de eksik', tone: 'gray' },
]

// ═══ 3 · Yönetici anlatısı ═══════════════════════════════════════════════════

export const PI_NARRATIVE = {
  whatHappened:
    'Uygulama başlangıcı HR’de iyileşti (1.49 s, −%21). BA ve SI hedefin üzerinde kaldı. RS tarafında ' +
    'CreateFiscalInvoice başarısında düşüş gözlendi ancak toplam servis başarısı stabil. BA’daki Task/Info ' +
    'sinyali sıra dışı değer üretiyor; ölçüm doğrulanıyor.',
  whyItMatters:
    'Açılış süresi vardiya başlangıcındaki ilk işlem hızını etkiliyor. Yüksek gecikmeli endpoint’ler ise ' +
    'özellikle PickupFailed ve DeliveryFailed akışlarında sahada bekleme hissi yaratabilir. Fiscal akışı ' +
    'RS’de yasal zorunluluk taşıdığı için başarı oranı yakından izleniyor.',
  whatWeAreDoing:
    'BA’daki 26 Haziran spike’ı sürüm bazında inceleniyor. PickupFailed ve DeliveryFailed trace’leri ' +
    'profillenecek. Task/Info ölçüm anomalisi ve Rendering SDK kapsamı doğrulanacak.',
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
  confidence: 'Yüksek' | 'Orta' | 'Düşük'
  direction: 'İyileşiyor' | 'Stabil' | 'Geriliyor'
  sentence: string
}

export const PI_COUNTRIES: CountryScore[] = [
  {
    id: 'hr',
    name: 'Hırvatistan',
    domain: 'overseas.hr',
    status: 'on-target',
    appStart: '1.49 s',
    appStartDeltaPct: -21,
    network: '%100',
    latency: '15/46 endpoint > 600 ms',
    crashFree: '%95.99',
    samples: '599 oturum',
    confidence: 'Yüksek',
    direction: 'İyileşiyor',
    sentence:
      'Başlangıç süresi iyileşti; 15 yavaş endpoint takip edilmeye devam ediyor. 29 Haziran’daki 9 crash’lik yoğunlaşma inceleniyor.',
  },
  {
    id: 'ba',
    name: 'Bosna Hersek',
    domain: 'expressone.ba',
    status: 'watch',
    appStart: '2.22 s',
    appStartDeltaPct: 56,
    network: 'Doğrulanıyor',
    networkNote: 'Task/Info sinyalinde tutarsızlık',
    latency: '5/33 endpoint > 600 ms',
    crashFree: '—',
    samples: '318 oturum',
    confidence: 'Düşük',
    direction: 'Geriliyor',
    sentence:
      'Uygulama başlangıcı hedefin 220 ms üzerinde. Network success sinyalindeki tutarsızlık doğrulanıyor; operasyonel kesinti henüz doğrulanmadı.',
  },
  {
    id: 'si',
    name: 'Slovenya',
    domain: 'expressone.si',
    status: 'watch',
    appStart: '2.34 s',
    appStartDeltaPct: 36,
    network: '%99.82',
    latency: '11/36 endpoint > 600 ms',
    crashFree: '%100',
    samples: '312 oturum',
    confidence: 'Düşük',
    direction: 'Stabil',
    sentence:
      'Geçen haftaki spike toparlandı ancak P90 hedefin 340 ms üzerinde. Örneklem sınırlı; değişim yüzdeleri temkinli okunmalı.',
  },
  {
    id: 'rs',
    name: 'Sırbistan',
    domain: 'cityexpress.rs',
    status: 'on-target',
    appStart: '1.25 s',
    appStartDeltaPct: 8,
    network: '%99.6',
    networkNote: 'CreateFiscalInvoice %92.86 — izleniyor',
    latency: '12/41 endpoint > 600 ms',
    crashFree: '%97.4',
    samples: '3K oturum',
    confidence: 'Yüksek',
    direction: 'Stabil',
    sentence:
      'Başlangıç hedef altında ve stabil. DeliveryFailed gecikmesi ve fiscal invoice başarısındaki düşüş bu haftanın izleme konuları.',
  },
]

// ═══ 6 · Performance Trends ══════════════════════════════════════════════════

/** App start P90 (saniye) — ülke başına haftalık seri. */
export interface AppStartWeek {
  week: string
  hr: number
  ba: number
  si: number
  rs: number
  /** Release / olay annotation'ı */
  note?: string
}

export const PI_APP_START_TREND: AppStartWeek[] = [
  { week: 'CW22', hr: 2.1, ba: 1.58, si: 1.94, rs: 1.35 },
  { week: 'CW23', hr: 1.92, ba: 1.66, si: 2.02, rs: 1.28 },
  { week: 'CW24', hr: 1.86, ba: 1.71, si: 1.88, rs: 1.3 },
  { week: 'CW25', hr: 2.05, ba: 1.6, si: 1.95, rs: 1.22 },
  { week: 'CW26', hr: 1.89, ba: 1.42, si: 1.72, rs: 1.16, note: 'HR v0.260 yayını' },
  { week: 'CW27', hr: 1.49, ba: 2.22, si: 2.34, rs: 1.25, note: 'BA 26 Haz spike' },
]

export const PI_APP_START_TARGET = 2.0

export const PI_TREND_NOTES = {
  appStartTitle: 'App start iki ülkede hedefte; BA ve SI son haftada hedef çizgisinin üzerinde.',
  appStartFoot:
    'BA’daki yükseliş ağırlıklı olarak 26 Haziran spike’ından kaynaklanıyor. BA ve SI örneklemi diğer ülkelere göre düşük (318 / 312 oturum).',
  networkTitle: 'Servis başarısı hacimden bağımsız stabil; gecikme birkaç endpoint’te yoğunlaşıyor.',
  networkFoot:
    'Bar hacmi, çizgiler başarı oranı ile P90 gecikmeyi gösterir. Düşük hacimli bir endpoint’teki yüksek regresyon ile yüksek hacimli gerçek kullanıcı etkisi bu görünümde ayrışır.',
  scatterTitle: 'Sağ üst bölge = yüksek hacim + yüksek gecikme; önceliklendirme burada başlar.',
  scatterFoot:
    'Baloncuk boyutu haftalık değişimi gösterir. PickupFailed (30.5 s) yalnızca 220 örnek taşırken GetCollectionsFromShipment 520K istek alıyor — yüzde regresyon tek başına önceliği belirlemez.',
}

/** Network stabilite — hacim (bar) + başarı ve gecikme (line). */
export interface NetworkWeek {
  week: string
  volumeM: number // milyon istek
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

/** Endpoint impact scatter — X gecikme, Y hacim, boyut regresyon. */
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
  { name: '*/* (wildcard)', country: 'HR', flow: 'Karışık', p90s: 3.12, volume: 4800, changePct: 40, confidence: 'needs-validation' },
  { name: 'Task/RequestLeavingPermission', country: 'HR', flow: 'İzin', p90s: 2.87, volume: 150, changePct: 383, confidence: 'needs-validation' },
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
  /** Yalnızca Engineering görünümünde gösterilen ek metrikler */
  engineeringMetrics?: PillarMetric[]
}

export const PI_PILLARS: Pillar[] = [
  {
    key: 'startup',
    title: 'Startup Experience',
    status: 'near-target',
    metrics: [
      { label: 'P90 aralığı', value: '1.25 – 2.34 s' },
      { label: 'Hedef', value: '< 2.0 s' },
      { label: 'Hedefte', value: '2/4 ülke' },
      { label: 'Haftalık yön', value: 'HR ↓ · BA/SI ↑' },
    ],
    engineeringMetrics: [
      { label: 'HR v0.260 (%97 pay)', value: '1.61 s' },
      { label: 'BA v0.29 (%99.5 pay)', value: '2.22 s' },
      { label: 'SI v0.174 (%85 pay)', value: '2.40 s' },
      { label: 'RS v0.68 (%100 pay)', value: '1.25 s' },
    ],
    sentence:
      'Kullanıcıların çoğu uygulamaya hedef sürede giriyor; BA ve SI’da P90 iyileştirme alanı bulunuyor.',
  },
  {
    key: 'reliability',
    title: 'Network Reliability',
    status: 'validate',
    metrics: [
      { label: 'Success rate', value: '≥ %99.8' },
      { label: 'En düşük', value: 'CreateFiscalInvoice %92.86 (RS)' },
      { label: 'Doğrulanan sinyal', value: 'Task/Info (BA)' },
      { label: 'Data confidence', value: 'Orta' },
    ],
    engineeringMetrics: [
      { label: 'Task/Info (BA)', value: '%0 · 1.7M örnek — instrumentation şüphesi' },
      { label: '/** wildcard (BA)', value: '%23.37 · −77 puan' },
      { label: 'Shipment/* (BA)', value: '%99.97' },
      { label: 'DeliverParcels (SI)', value: '%99.82' },
    ],
    sentence:
      'Genel servis başarısı stabil. Task/Info sinyalindeki sıra dışı değer instrumentation açısından inceleniyor.',
  },
  {
    key: 'latency',
    title: 'Network Latency',
    status: 'watch',
    metrics: [
      { label: '> 600 ms endpoint', value: '43 / 156' },
      { label: 'En yavaş', value: 'PickupFailed 30.5 s (BA)' },
      { label: 'En yüksek hacimli yavaş', value: 'GetCollectionsFromShipment 1.65 s · 520K' },
      { label: 'Haftalık yön', value: 'Karışık' },
    ],
    engineeringMetrics: [
      { label: 'DeliveryFailed (RS)', value: '9.74 s · 6.5K istek' },
      { label: 'DeliveryFailed (SI)', value: '3.49 s · −94% iyileşme' },
      { label: 'RequestLeavingPermission', value: 'HR +383% · RS +388%' },
      { label: 'SaveImageFile (SI)', value: '1.71 s · +35%' },
    ],
    sentence:
      'Gecikme birkaç endpoint’te yoğunlaşıyor; sistem geneline yayılan bir yavaşlama görünmüyor.',
  },
  {
    key: 'rendering',
    title: 'Rendering Quality',
    status: 'nodata',
    metrics: [
      { label: 'Slow frames', value: 'Veri yok' },
      { label: 'Frozen frames', value: 'Veri yok' },
      { label: 'Kapsam', value: '4 ülkede de eksik' },
      { label: 'SDK durumu', value: 'Doğrulanacak' },
    ],
    sentence:
      'Rendering verisi karar vermek için yeterli değil. SDK kapsamının doğrulanması gerekiyor — bu, iyi performans anlamına gelmez.',
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
    businessImpact: 'Başarısız pickup akışında operasyonel bekleme',
    confidence: 'needs-validation',
    action: 'Trace profille',
    detail: {
      countries: 'BA ağırlıklı · SI’da +160% (817 ms, 434 örnek)',
      versions: 'v0.29 (%99.5 pay)',
      owner: 'Mobil Performans',
      status: 'Bu hafta planlandı',
      notes: 'Yanıtların tamamı başarılı işaretli — request completion / instrumentation davranışı incelenmeli.',
    },
  },
  {
    endpoint: 'Task/DeliveryFailed',
    country: 'RS',
    flow: 'Delivery',
    p90: '9.74 s',
    volume: '6.5K',
    change: '+4919%',
    businessImpact: 'Başarısız teslimat kaydında bekleme',
    confidence: 'confirmed',
    action: 'Backend span incele',
    detail: {
      countries: 'RS 9.74 s · SI 3.49 s (−94% iyileşme)',
      versions: 'v0.68 (%100 pay)',
      owner: 'Backend',
      status: 'Bu hafta planlandı',
      notes: 'SI’daki iyileşme deseninin RS’ye taşınabilirliği kontrol edilecek.',
    },
  },
  {
    endpoint: 'History/SaveShipmentCallInformation',
    country: 'HR',
    flow: 'Delivery',
    p90: '2.54 s',
    volume: 'Yüksek (12K)',
    change: '+18%',
    businessImpact: 'Teslimat kaydı — yüksek hacim',
    confidence: 'confirmed',
    action: 'Backend span incele',
    detail: {
      countries: 'HR 2.54 s · SI 1.49 s (−63% iyileşme)',
      versions: 'v0.260',
      owner: 'Backend',
      status: 'Araştırılıyor',
      notes: 'SI’da iyileşme var; HR farkının kaynağı (ağ mı, backend mi) ayrıştırılacak.',
    },
  },
  {
    endpoint: 'Task/RequestLeavingPermission',
    country: 'HR · RS',
    flow: 'İzin',
    p90: '2.87 s',
    volume: 'Düşük (150)',
    change: '+383% / +388%',
    businessImpact: 'Kurye izin akışı',
    confidence: 'needs-validation',
    action: 'Trace profille',
    detail: {
      countries: 'HR +383% · RS +388% — çok ülkeli desen',
      versions: 'v0.260 / v0.68',
      owner: 'Mobil Performans',
      status: 'Araştırılıyor',
      notes: 'İki ülkede eşzamanlı regresyon ortak (backend/SDK) neden ihtimalini güçlendiriyor; hacim düşük.',
    },
  },
  {
    endpoint: 'Shipment/RaiPayAuthToken',
    country: 'HR',
    flow: 'Payment',
    p90: '1.98 s',
    volume: '343',
    change: '+9%',
    businessImpact: 'Ödeme başlangıcı',
    confidence: 'confirmed',
    action: 'P95 izle',
    detail: {
      countries: 'Yalnızca HR',
      versions: 'v0.260',
      owner: 'Mobil Performans',
      status: 'İzleniyor',
      notes: 'Değişim küçük; ödeme akışı kritik olduğu için P95 eşiği ile izlemede.',
    },
  },
  {
    endpoint: 'Shipment/CreateFiscalInvoice',
    country: 'RS',
    flow: 'Fiscal',
    p90: '—',
    volume: 'Orta',
    change: '−7 puan başarı',
    businessImpact: 'Yasal fiscal zorunluluğu',
    confidence: 'confirmed',
    action: 'Kök neden analizi',
    detail: {
      countries: 'Yalnızca RS · %92.86 başarı (%99 hedefi)',
      versions: 'v0.68',
      owner: 'Backend',
      status: 'Araştırılıyor',
      notes: 'Fiscal akışı yasal zorunluluk — başarı düşüşü gecikmeden önce ele alınmalı.',
    },
  },
]

// ═══ 10 · Metric → Action akışı ══════════════════════════════════════════════

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
    validation: '220 örnek · BA ağırlıklı · %100 response success',
    impact: 'Başarısız pickup akışında uzun bekleme',
    action: 'Trace profiling + backend span incelemesi',
    successCriteria: 'P90 < 2.5 s ve yeni timeout görülmemesi',
  },
  {
    signal: 'Task/Info success %0 (BA · 1.7M örnek)',
    validation: 'Sinyal tutarsız — /** wildcard aynı dönemde %23.37; kullanıcı şikâyeti yok',
    impact: 'Doğrulanırsa görev bilgi akışında kesinti; instrumentation hatası ihtimali yüksek',
    action: 'SDK trace sınıflandırması + sunucu erişim logu karşılaştırması',
    successCriteria: 'Sinyalin kaynağı sınıflandırıldı (gerçek kesinti / ölçüm hatası)',
  },
  {
    signal: 'BA app start P90 2.22 s (+%56)',
    validation: '318 oturum · 26 Haziran ~8 sn spike değişimin önemli bölümünü açıklıyor',
    impact: 'Vardiya başlangıcında ilk işlem gecikmesi',
    action: '26 Haziran spike’ının v0.29 sürüm penceresiyle korelasyonu',
    successCriteria: 'CW28’de P90 < 2.0 s ve spike tekrarı yok',
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
    title: 'BA app start hedefin üzerinde',
    body: 'P90 app start 2.22 saniye. Haftalık değişim +%56; ancak örneklem 318 oturum ile sınırlı ve 26 Haziran spike’ı değişimin önemli bölümünü açıklıyor.',
    comment: 'Takip edilmeli, fakat tek başına release blocker olarak değerlendirilmemeli.',
    scope: 'Bosna Hersek · v0.29',
    evidence: 'Firebase Performance · CW27 · 318 oturum',
    level: 'needs-validation',
  },
  {
    title: 'PickupFailed endpoint’i sıra dışı gecikme üretiyor',
    body: 'P90 30.5 saniye. 220 örnek bulunuyor ve yanıtların tamamı başarılı olarak işaretlenmiş.',
    comment: 'Hata oranından çok request completion veya instrumentation davranışı incelenmeli.',
    scope: 'BA · Task/PickupFailed',
    evidence: 'BA / Task/PickupFailed · 220 örnek',
    level: 'needs-validation',
  },
  {
    title: 'Task/Info başarı sinyali doğrulanıyor',
    body: 'Trace %0 başarı gösteriyor (1.7M örnek) ancak kullanıcı etkisi veya gerçek servis kesintisi henüz doğrulanmadı; aynı dönemde operasyonel trace’ler stabil.',
    comment: 'Instrumentation veya wildcard sınıflandırma problemi ihtimali yüksek; kök neden zorunlu.',
    scope: 'BA · Task/Info',
    evidence: 'Firebase trace · 1.7M örnek · tek sinyal',
    level: 'needs-validation',
  },
  {
    title: '"Failed" task endpoint’leri çok ülkeli outlier üretiyor',
    body: 'PickupFailed (BA 30.5 s) ve DeliveryFailed (RS 9.74 s, SI 3.49 s) aynı desende. RequestLeavingPermission da iki ülkede eşzamanlı regrese oluyor (HR +383%, RS +388%).',
    comment: 'Çok ülkeli tekrar, ortak backend veya SDK nedenini işaret ediyor; tek ülke gürültüsü değil.',
    scope: 'BA · RS · SI · HR',
    evidence: 'Firebase Performance · 4 ülke · CW26–CW27 tekrarı',
    level: 'confirmed',
  },
  {
    title: 'Rendering görünürlüğü yetersiz',
    body: 'Dört ülkede de slow/frozen frame verisi karar üretmek için yeterli değil.',
    comment: 'Bu durum iyi rendering performansı anlamına gelmez; telemetry kapsamı tamamlanmalıdır.',
    scope: 'Tüm ülkeler',
    evidence: 'Rendering SDK coverage · 4/4 ülke',
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
    owner: 'Mobil Performans',
    due: '4 Tem 2026',
    countries: 'BA · SI',
    expected: 'P90 < 2.5 s, timeout deseni sınıflandırıldı',
    evidence: '30.5 s · 220 örnek',
    level: 'needs-validation',
  },
  {
    column: 'this-week',
    title: 'BA 26 Haziran spike analizi',
    priority: 'P2',
    owner: 'Mobil Performans',
    due: '4 Tem 2026',
    countries: 'BA',
    expected: 'Spike’ın sürüm/altyapı korelasyonu raporlandı',
    evidence: '~8 sn spike · v0.29',
    level: 'needs-validation',
  },
  {
    column: 'this-week',
    title: 'Rendering SDK coverage doğrulaması',
    priority: 'P2',
    owner: 'Mobil Platform',
    due: '7 Tem 2026',
    countries: 'Tümü',
    expected: 'Slow/frozen frame verisi CW29’dan itibaren akıyor',
    evidence: '4/4 ülkede veri yok',
    level: 'confirmed',
  },
  {
    column: 'investigating',
    title: 'Task/Info success-rate ölçüm anomalisi',
    priority: 'P1',
    owner: 'Backend + Mobil',
    due: '9 Tem 2026',
    countries: 'BA',
    expected: 'Gerçek kesinti / ölçüm hatası ayrımı netleşti',
    evidence: '%0 sinyal · 1.7M örnek',
    level: 'needs-validation',
  },
  {
    column: 'investigating',
    title: 'Wildcard trace sınıflandırması',
    priority: 'P3',
    owner: 'Mobil Platform',
    due: '11 Tem 2026',
    countries: 'HR · BA',
    expected: '*/* trace’leri gerçek endpoint’lere ayrıştı',
    evidence: 'HR 3.12 s · BA %23.37',
    level: 'needs-validation',
  },
  {
    column: 'investigating',
    title: 'CreateFiscalInvoice başarı düşüşü',
    priority: 'P2',
    owner: 'Backend',
    due: '9 Tem 2026',
    countries: 'RS',
    expected: 'Başarı ≥ %99 hedefine dönüş',
    evidence: '%92.86 · −7 puan',
    level: 'confirmed',
  },
  {
    column: 'done',
    title: 'Task/DeliverParcels optimizasyonu',
    priority: 'P1',
    owner: 'Backend',
    due: 'CW26',
    countries: 'HR',
    expected: '958 ms · %65 iyileşme (31K istek) — doğrulandı',
    evidence: '31K istek · çok haftalı',
    level: 'confirmed',
  },
  {
    column: 'done',
    title: 'CheckHasCourierTodaySchedule düşüşü',
    priority: 'P2',
    owner: 'Backend',
    due: 'CW26',
    countries: 'HR',
    expected: 'Bu pencerede tekrar gözlenmedi — kapatıldı',
    evidence: 'CW27 penceresi temiz',
    level: 'confirmed',
  },
]

export const PI_ACTION_COLUMNS: { key: ActionColumn; label: string; tone: 'blue' | 'amber' | 'green' }[] = [
  { key: 'this-week', label: 'Bu hafta', tone: 'blue' },
  { key: 'investigating', label: 'Araştırılıyor', tone: 'amber' },
  { key: 'done', label: 'Doğrulandı / tamamlandı', tone: 'green' },
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
  { date: '24 Haziran', title: 'HR v0.260 yayınlandı', desc: 'Rollout %97 paya ulaştı; app start v0.260 üzerinde 1.61 s.', tag: 'Release' },
  { date: '26 Haziran', title: 'BA app start spike', desc: 'v0.29 üzerinde ~8 saniyelik spike; alert aktif. Haftalık +%56’nın önemli bölümünü açıklıyor.', tag: 'Metric anomaly' },
  { date: '27 Haziran', title: 'Task/DeliverParcels optimizasyonu aktif', desc: 'HR’de 958 ms · %65 iyileşme (31K istek) doğrulandı.', tag: 'Config' },
  { date: '27 Haziran', title: 'SI app start spike', desc: '~4.4 sn spike; geçen haftaki 7.09 sn spike toparlandı.', tag: 'Metric anomaly' },
  { date: '29 Haziran', title: 'HR crash yoğunlaşması', desc: 'Tek günde 9 crash; 7 günlük crash-free %95.99’a geriledi. Kök neden aranıyor.', tag: 'Incident' },
  { date: '30 Haziran', title: 'CW27 raporu üretildi', desc: 'Firebase Performance verisi 09:19–09:23 arasında çekildi.', tag: 'Monitoring change' },
]

// ═══ 14 · Guardrails ═════════════════════════════════════════════════════════

export interface Guardrail {
  title: string
  body: string
}

export const PI_GUARDRAILS: Guardrail[] = [
  {
    title: 'Performance Watch ≠ Incident',
    body: 'Bir metriğin hedef dışında olması tek başına aktif incident anlamına gelmez. Incident kararı kullanıcı etkisi, kapsam ve iş akışı kesintisiyle birlikte verilir.',
  },
  {
    title: 'Regression ≠ User Impact',
    body: 'Yüksek yüzde değişim düşük örneklemden kaynaklanabilir. Hacim, mutlak süre ve iş akışı önemi birlikte değerlendirilmelidir.',
  },
  {
    title: 'No Data ≠ Healthy',
    body: 'Rendering verisinin olmaması, rendering sorunu bulunmadığını göstermez. Bu alan telemetry boşluğu olarak takip edilir.',
  },
  {
    title: 'Success Rate ≠ Full Success',
    body: 'HTTP veya Firebase trace başarısı, işlemin iş kuralı açısından doğru tamamlandığını garanti etmez.',
  },
]

// ═══ 15 · Evidence & Data Quality ════════════════════════════════════════════

export interface DataQualityRow {
  country: string
  appStartSamples: string
  networkVolume: string
  rendering: string
  crash: string
  confidence: 'Yüksek' | 'Orta' | 'Düşük'
}

export const PI_DATA_QUALITY: DataQualityRow[] = [
  { country: 'Hırvatistan', appStartSamples: '599 (24 saat)', networkVolume: '46 trace · 31K+ istek', rendering: 'Veri yok', crash: '7 gün · tam', confidence: 'Yüksek' },
  { country: 'Bosna Hersek', appStartSamples: '318 (7 gün)', networkVolume: '33 trace · 1.7M dahil', rendering: '~5 oturum · yetersiz', crash: 'Veri yok', confidence: 'Düşük' },
  { country: 'Slovenya', appStartSamples: '312 (7 gün)', networkVolume: '36 trace · 148K+ istek', rendering: 'Veri yok', crash: '7 gün · tam', confidence: 'Düşük' },
  { country: 'Sırbistan', appStartSamples: '3K (7 gün)', networkVolume: '41 trace · 520K+ istek', rendering: '2 örnek · yetersiz', crash: '7 gün · tam', confidence: 'Yüksek' },
]

export const PI_EVIDENCE_RULES = {
  strong: [
    'Yüksek örneklem',
    'Birden fazla haftada tekrar',
    'Birden fazla ülkede tutarlı',
    'Incident veya kullanıcı kaydı ile doğrulanmış',
  ],
  weak: [
    'Düşük örneklem',
    'Tek ülke veya tek gün spike',
    'Instrumentation şüphesi',
    'Hacim bilgisi eksik',
  ],
}
