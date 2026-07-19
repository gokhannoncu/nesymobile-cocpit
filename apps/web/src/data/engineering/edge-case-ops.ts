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
    flow: 'Schedule Download', likelihood: 'likely', exposure: 'Tüm ülkeler',
    status: 'test-design-needed', testStatus: 'untested', automation: [], mitigationStatus: 'no',
    incidents: 1, lastVerified: null, owner: 'Data & Sync', releaseRisk: true,
    detectability: 2, recoverability: 2,
    mechanisms: ['Race condition', 'Lost state'], environments: ['Flaky network'],
    envCoverage: { online: 'none', offline: 'none', flaky: 'none' },
    expected: 'FCM refresh ve yerel delivery yazımı aynı chunk\'ta çakıştığında her iki değişiklik de korunmalı.',
    actual: 'Son yazan kazanır; delivery kaydı sessizce kaybolabilir.',
    reproduceReliability: 2,
    recovery: 'Kayıp delivery\'ler CompletedRequest kayıtları schedule chunk ile diff edilerek geri yüklenir.',
    permanentFix: 'Chunk\'tan ilişkisel satır modeline geçiş (Modernization Phase 1).',
  },
  E2: {
    flow: 'Schedule Download', likelihood: 'rare', exposure: 'Tüm ülkeler',
    status: 'triaged', testStatus: 'untested', automation: [], mitigationStatus: 'no',
    incidents: 0, lastVerified: null, owner: 'Data & Sync', releaseRisk: false,
    detectability: 3, recoverability: 2,
    mechanisms: ['Data corruption', 'Partial success'], environments: ['Process killed', 'Low memory'],
  },
  E3: {
    flow: 'Schedule Download', likelihood: 'rare', exposure: 'Güncelleme alan tüm cihazlar',
    status: 'test-ready', testStatus: 'failed', automation: ['unit'], mitigationStatus: 'partial',
    incidents: 1, lastVerified: '2026-05-19', owner: 'Data & Sync', releaseRisk: true,
    detectability: 4, recoverability: 1,
    mechanisms: ['Migration failure', 'Data corruption'], environments: ['Version upgrade'],
    envCoverage: { upgrade: 'fail' },
    expected: 'Eksik migration\'lar compile/CI aşamasında yakalanmalı; production verisi silinmemeli.',
    actual: 'fallbackToDestructiveMigration() tüm yerel veriyi siler (bekleyen kuyruk dahil).',
    reproduceReliability: 5,
    reproduceSteps: [
      'v240 schema\'lı cihaza migration\'sız v241 build kur.',
      'Uygulamayı aç — Room destructive fallback tetiklenir.',
      'Schedule ve PendingRequest tablolarının boşaldığını doğrula.',
    ],
    recovery: 'Schedule server\'dan yeniden indirilir; gönderilmemiş offline event\'ler kurtarılamaz.',
    permanentFix: 'Destructive fallback kaldır + migration test suite ekle (Phase 0).',
  },
  E4: {
    flow: 'Stop List', likelihood: 'likely', exposure: '200+ duraklı rotalar',
    status: 'validated', testStatus: 'passed', automation: ['integration'], mitigationStatus: 'partial',
    incidents: 2, lastVerified: '2026-06-21', owner: 'Mobile Core', releaseRisk: false,
    detectability: 5, recoverability: 5,
    mechanisms: ['Timeout'], environments: ['Low memory'],
    envCoverage: { online: 'pass', offline: 'pass' },
  },
  E5: {
    flow: 'Delivery', likelihood: 'likely', exposure: 'POS kullanan tüm ülkeler',
    status: 'test-design-needed', testStatus: 'untested', automation: [], mitigationStatus: 'no',
    incidents: 2, lastVerified: null, owner: 'Payments', releaseRisk: true,
    detectability: 1, recoverability: 2,
    mechanisms: ['Lost state', 'Process death'], environments: ['Process killed', 'Restart'],
    envCoverage: { restart: 'none' },
    expected: 'Payment durumu kalıcıdır; restart sonrası shipment "paid" görünür.',
    actual: 'paidShipments yalnızca bellekte — restart sonrası payment akışı yeniden açılır.',
    reproduceReliability: 5,
    recovery: 'Shipment listesi POS provider kayıtları ile uzlaştırılır; çift tahsilatlar iade edilir.',
    permanentFix: 'Payment state machine Room\'a taşınır (E30 ile birlikte).',
  },
  E6: {
    flow: 'Schedule Download', likelihood: 'likely', exposure: 'Tüm ülkeler',
    status: 'triaged', testStatus: 'untested', automation: [], mitigationStatus: 'no',
    incidents: 1, lastVerified: null, owner: 'Data & Sync', releaseRisk: false,
    detectability: 2, recoverability: 3,
    mechanisms: ['Stale state'], environments: ['Restart'],
  },
  E7: {
    flow: 'End of Day', likelihood: 'likely', exposure: 'Zayıf kapsama alanları',
    status: 'validated', testStatus: 'passed', automation: ['integration'], mitigationStatus: 'yes',
    incidents: 3, lastVerified: '2026-06-30', owner: 'Data & Sync', releaseRisk: true,
    detectability: 3, recoverability: 4,
    mechanisms: ['Stale state', 'Silent failure'], environments: ['Offline', 'Flaky network'],
    envCoverage: { online: 'pass', offline: 'pass', flaky: 'warn' },
  },
  E8: {
    flow: 'Delivery', likelihood: 'likely', exposure: 'Tüm ülkeler',
    status: 'test-ready', testStatus: 'failed', automation: ['unit'], mitigationStatus: 'partial',
    incidents: 4, lastVerified: '2026-06-14', owner: 'Data & Sync', releaseRisk: true,
    detectability: 2, recoverability: 3,
    mechanisms: ['Lost state', 'Process death', 'Retry failure'], environments: ['Process killed', 'Doze'],
    envCoverage: { online: 'pass', restart: 'fail', background: 'warn' },
    expected: 'Service ölse bile işlenen kayıt kilitli kalmamalı; kuyruk kendini toparlamalı.',
    actual: 'isProcessing=true kalıcı; kuyruk kalıcı olarak takılır.',
    reproduceReliability: 4,
    recovery: 'Stale isProcessing kayıtları cihazda manuel sıfırlanır (destek prosedürü SOP-12).',
  },
  E9: {
    flow: 'Delivery', likelihood: 'likely', exposure: 'Tüm ülkeler · finansal event\'ler',
    status: 'test-design-needed', testStatus: 'untested', automation: [], mitigationStatus: 'no',
    incidents: 2, lastVerified: null, owner: 'Payments', releaseRisk: true,
    detectability: 2, recoverability: 2,
    mechanisms: ['Duplicate event', 'Idempotency failure', 'Retry failure'], environments: ['Flaky network'],
    envCoverage: { flaky: 'none' },
    expected: 'Aynı delivery/collection event kaç kez gönderilirse gönderilsin server\'da bir kez işlenmeli.',
    actual: 'Server-side idempotency yok; retry çift transaction üretebilir.',
    reproduceReliability: 3,
    reproduceSteps: [
      'Delivery event gönder; response dönmeden bağlantıyı kes (timeout).',
      'Retry mekanizmasının aynı event\'i yeniden göndermesini bekle.',
      'Backoffice\'te aynı shipment için iki transaction kaydı oluştuğunu doğrula.',
    ],
    recovery: 'Çift event\'ler uniqueKey ile dedup edilir ve backoffice\'te tersine çevrilir.',
    permanentFix: 'Uçtan uca idempotency key (backend iş birliği, Phase 1).',
  },
  E10: {
    flow: 'Delivery', likelihood: 'likely', exposure: 'Tüm ülkeler',
    status: 'triaged', testStatus: 'untested', automation: [], mitigationStatus: 'no',
    incidents: 1, lastVerified: null, owner: 'Data & Sync', releaseRisk: true,
    detectability: 2, recoverability: 3,
    mechanisms: ['Out-of-order event'], environments: ['Offline', 'Flaky network'],
  },
  E11: {
    flow: 'End of Day', likelihood: 'frequent', exposure: 'Tüm filo eşzamanlı',
    status: 'validated', testStatus: 'passed', automation: ['integration'], mitigationStatus: 'partial',
    incidents: 1, lastVerified: '2026-04-02', owner: 'Data & Sync', releaseRisk: false,
    detectability: 4, recoverability: 4,
    mechanisms: ['Retry failure', 'Silent failure'], environments: ['Flaky network'],
    envCoverage: { online: 'pass', flaky: 'warn' },
  },
  E12: {
    flow: 'End of Day', likelihood: 'likely', exposure: 'Android 14+ cihazlar',
    status: 'triaged', testStatus: 'untested', automation: [], mitigationStatus: 'no',
    incidents: 0, lastVerified: null, owner: 'Mobile Core', releaseRisk: false,
    detectability: 3, recoverability: 4,
    mechanisms: ['Silent failure', 'Timeout'], environments: ['Doze', 'Battery saver', 'Background'],
  },
  E13: {
    flow: 'Stop List', likelihood: 'likely', exposure: 'Tüm ülkeler',
    status: 'test-design-needed', testStatus: 'untested', automation: [], mitigationStatus: 'no',
    incidents: 2, lastVerified: null, owner: 'Mobile Core', releaseRisk: false,
    detectability: 2, recoverability: 3,
    mechanisms: ['Stale state', 'Lost state'], environments: ['Offline'],
    expected: 'Server iptali tüm koşullarda kurye ekranına yansır.',
    actual: 'Offline delivery kuyruğu refresh sırasında iptali gizler; kurye iptal edilmiş pakete gider.',
    reproduceReliability: 3,
    recovery: 'Dispatch arar ve kuryeyi yönlendirir; paket return akışına alınır.',
  },
  E14: {
    flow: 'Delivery', likelihood: 'rare', exposure: 'Tüm ülkeler',
    status: 'triaged', testStatus: 'untested', automation: [], mitigationStatus: 'no',
    incidents: 1, lastVerified: null, owner: 'Data & Sync', releaseRisk: false,
    detectability: 3, recoverability: 4,
    mechanisms: ['Out-of-order event', 'Stale state'], environments: ['Flaky network'],
  },
  E15: {
    flow: 'Delivery', likelihood: 'likely', exposure: 'Yoğun push alan rotalar',
    status: 'test-design-needed', testStatus: 'untested', automation: [], mitigationStatus: 'no',
    incidents: 1, lastVerified: null, owner: 'Mobile Core', releaseRisk: false,
    detectability: 2, recoverability: 3,
    mechanisms: ['Race condition', 'Lost state'], environments: ['Online'],
  },
  E16: {
    flow: 'Fiscal', likelihood: 'likely', exposure: 'RS · BA (fiscal ülkeler)',
    status: 'test-ready', testStatus: 'failed', automation: [], mitigationStatus: 'partial',
    incidents: 2, lastVerified: '2026-06-08', owner: 'Payments', releaseRisk: true,
    detectability: 3, recoverability: 2,
    mechanisms: ['Lifecycle duplication', 'Duplicate event', 'Idempotency failure'],
    environments: ['Rotation'],
    envCoverage: { rotation: 'fail', online: 'pass' },
    expected: 'Rotation fiscal request\'i yeniden tetiklemez; request tam bir kez çalışır.',
    actual: 'Observer yeniden bağlanır, createFiscalInvoice ikinci kez çalışır → çift fiscal kayıt.',
    reproduceReliability: 4,
    reproduceSteps: [
      'Fiscal dialog açıkken cihazı döndür.',
      'Fiscal service loglarında aynı collection için iki request olduğunu doğrula.',
    ],
    recovery: 'İkinci fiscal kayıt için void/SSC compensation akışı çalıştırılır.',
    permanentFix: 'SingleLiveEvent/Flow\'a geçiş + fiscal idempotency key.',
  },
  E17: {
    flow: 'Delivery', likelihood: 'rare', exposure: 'Tüm ülkeler',
    status: 'test-design-needed', testStatus: 'untested', automation: [], mitigationStatus: 'no',
    incidents: 1, lastVerified: null, owner: 'Mobile Core', releaseRisk: false,
    detectability: 2, recoverability: 2,
    mechanisms: ['Stale state', 'Lifecycle duplication'], environments: ['Rotation', 'Restart'],
    expected: 'Aktif task ekran girişinde her zaman doğrulanır; akış eski task ile çalışmaz.',
    actual: 'currentTask temizlenmezse başka durakta eski task ile delivery confirmation alınabilir.',
    reproduceReliability: 2,
    recovery: 'Hatalı delivery kaydı backoffice\'ten düzeltilir; doğru shipment yeniden açılır.',
  },
  E18: {
    flow: 'Delivery Failed', likelihood: 'likely', exposure: 'Tüm ülkeler',
    status: 'covered', testStatus: 'passed', automation: ['unit', 'integration'], mitigationStatus: 'yes',
    incidents: 1, lastVerified: '2026-06-25', owner: 'Mobile Core', releaseRisk: false,
    detectability: 5, recoverability: 5,
    mechanisms: ['Lifecycle duplication', 'Timeout'], environments: ['Background', 'Rotation'],
    envCoverage: { rotation: 'pass', background: 'pass' },
  },
  E19: {
    flow: 'Delivery', likelihood: 'rare', exposure: 'Call permission\'lı cihazlar',
    status: 'covered', testStatus: 'passed', automation: ['unit'], mitigationStatus: 'yes',
    incidents: 0, lastVerified: '2026-05-30', owner: 'Mobile Core', releaseRisk: false,
    detectability: 3, recoverability: 4,
    mechanisms: ['Lifecycle duplication', 'Duplicate event'], environments: ['Background'],
    envCoverage: { background: 'pass' },
  },
  E20: {
    flow: 'Login', likelihood: 'frequent', exposure: 'Tüm ülkeler · uzun vardiyalar',
    status: 'reopened', testStatus: 'failed', automation: ['integration'], mitigationStatus: 'partial',
    incidents: 5, lastVerified: '2026-07-03', owner: 'Platform', releaseRisk: true,
    detectability: 4, recoverability: 3,
    mechanisms: ['Silent failure', 'Permission change'], environments: ['Online', 'Offline'],
    envCoverage: { online: 'pass', offline: 'fail', flaky: 'warn' },
    expected: 'Token süresi dolduğunda session sessizce yenilenir; kuyruktaki request\'ler tokensız kalmaz.',
    actual: '401 sonrası kullanıcı sessizce logout olur; yarım delivery ve tokensız kuyruk kalır.',
    reproduceReliability: 5,
    reproduceSteps: [
      'Token TTL\'yi kısalt (test backend).',
      'Vardiya ortasında herhangi bir çağrı yap — 401 → sessiz logout.',
      'Offline kuyruğun tokensız kaldığını doğrula.',
    ],
    recovery: 'Yeniden login sonrası kuyruk yeni token ile flush edilir; yarım akışlar manuel tamamlanır.',
    permanentFix: 'Refresh token flow (Phase 0 — bu release kapsamında).',
  },
  E21: {
    flow: 'Login', likelihood: 'rare', exposure: 'Tüm ülkeler · güvenlik',
    status: 'accepted-risk', testStatus: 'untested', automation: [], mitigationStatus: 'partial',
    incidents: 0, lastVerified: null, owner: 'Platform', releaseRisk: false,
    detectability: 1, recoverability: 2,
    mechanisms: ['Silent failure'], environments: ['Online'],
    permanentFix: 'Host allowlist + TrustAllCerts kaldırma — security sprint\'te (kabul: 2026-Q3 sonu).',
  },
  E22: {
    flow: 'Schedule Download', likelihood: 'rare', exposure: 'İmzalı endpoint kullanan akışlar',
    status: 'triaged', testStatus: 'untested', automation: [], mitigationStatus: 'no',
    incidents: 1, lastVerified: null, owner: 'Platform', releaseRisk: false,
    detectability: 2, recoverability: 4,
    mechanisms: ['Silent failure'], environments: ['Online'],
  },
  E23: {
    flow: 'Shipment Tracking', likelihood: 'rare', exposure: 'Zayıf ağ alanları',
    status: 'triaged', testStatus: 'untested', automation: [], mitigationStatus: 'no',
    incidents: 0, lastVerified: null, owner: 'Mobile Core', releaseRisk: false,
    detectability: 3, recoverability: 4,
    mechanisms: ['Silent failure'], environments: ['Offline'],
  },
  E24: {
    flow: 'Shipment Tracking', likelihood: 'likely', exposure: 'Tüm filo',
    status: 'validated', testStatus: 'passed', automation: ['unit'], mitigationStatus: 'partial',
    incidents: 1, lastVerified: '2026-03-18', owner: 'Mobile Core', releaseRisk: false,
    detectability: 3, recoverability: 5,
    mechanisms: ['Lost state', 'Process death'], environments: ['Process killed'],
    envCoverage: { restart: 'warn' },
  },
  E25: {
    flow: 'Shipment Tracking', likelihood: 'likely', exposure: 'Tüm filo',
    status: 'test-ready', testStatus: 'untested', automation: [], mitigationStatus: 'no',
    incidents: 1, lastVerified: null, owner: 'Mobile Core', releaseRisk: false,
    detectability: 2, recoverability: 5,
    mechanisms: ['Permission change', 'Silent failure'], environments: ['Background'],
  },
  E26: {
    flow: 'Shipment Tracking', likelihood: 'likely', exposure: 'Raporlama · tüm ülkeler',
    status: 'triaged', testStatus: 'untested', automation: [], mitigationStatus: 'no',
    incidents: 0, lastVerified: null, owner: 'Data & Sync', releaseRisk: false,
    detectability: 2, recoverability: 3,
    mechanisms: ['Data corruption'], environments: ['Online'],
  },
  E27: {
    flow: 'Delivery', likelihood: 'likely', exposure: 'POS kullanan tüm ülkeler · finansal',
    status: 'test-design-needed', testStatus: 'untested', automation: [], mitigationStatus: 'partial',
    incidents: 2, lastVerified: null, owner: 'Payments', releaseRisk: true,
    detectability: 1, recoverability: 2,
    mechanisms: ['Partial success', 'Process death'], environments: ['Process killed', 'Restart'],
    envCoverage: { online: 'pass', offline: 'pass', flaky: 'warn', restart: 'none', background: 'warn' },
    expected: 'Payment başarılıysa delivery state ve fiscal kayıt atomik olarak eşleşmeli.',
    actual: 'POS success sonrası process ölürse delivery kaydı oluşmaz; sistem ödemeyi bilmez.',
    reproduceReliability: 3,
    reproduceSteps: [
      'POS payment tamamla (success callback dönmeden hemen önce).',
      'handleDelivery() çağrılmadan process\'i öldür (adb shell am kill).',
      'Uygulamayı aç: shipment "unpaid" görünür; POS kaydı ile sapmayı doğrula.',
    ],
    recovery: 'POS kayıtları delivery kayıtları ile uzlaştırılır; çift tahsilatlar iade edilir.',
    permanentFix: '"Payment received / pending delivery" ara durumu atomik olarak Room\'a yazılır (Phase 0).',
  },
  E28: {
    flow: 'Fiscal', likelihood: 'likely', exposure: 'RS · BA (yasal denetim)',
    status: 'test-design-needed', testStatus: 'untested', automation: [], mitigationStatus: 'no',
    incidents: 1, lastVerified: null, owner: 'Payments', releaseRisk: true,
    detectability: 1, recoverability: 1,
    mechanisms: ['Partial success', 'Silent failure'], environments: ['Flaky network', 'Process killed'],
    expected: 'Fiscal kayıt yalnızca delivery confirmation\'a bağlı oluşturulmalı; desteksiz invoice kalmamalı.',
    actual: 'Delivery başarısız olursa fiscal sistemde yetim invoice kalır — crash yok, sinyal yok.',
    reproduceReliability: 3,
    recovery: 'Fiscal kayıtlar günlük delivery kayıtları ile uzlaştırılır; yetim invoice\'lara void/SSC uygulanır.',
    permanentFix: 'Fiscal\'i delivery confirmation\'a bağlama + compensation akışı (Phase 0).',
  },
  E29: {
    flow: 'Fiscal', likelihood: 'likely', exposure: 'RS · BA',
    status: 'test-ready', testStatus: 'failed', automation: [], mitigationStatus: 'partial',
    incidents: 1, lastVerified: '2026-06-08', owner: 'Payments', releaseRisk: true,
    detectability: 3, recoverability: 2,
    mechanisms: ['Lifecycle duplication', 'Idempotency failure'], environments: ['Rotation'],
    envCoverage: { rotation: 'fail', restart: 'warn', background: 'pass' },
    recovery: 'Çift fiscal kayıt iptal edilir (E16 compensation akışı ile paylaşımlı).',
  },
  E30: {
    flow: 'Delivery', likelihood: 'likely', exposure: 'POS kullanan tüm ülkeler',
    status: 'test-design-needed', testStatus: 'untested', automation: [], mitigationStatus: 'no',
    incidents: 2, lastVerified: null, owner: 'Payments', releaseRisk: true,
    detectability: 1, recoverability: 2,
    mechanisms: ['Lost state', 'Process death'], environments: ['Restart', 'Process killed'],
    expected: 'Restart sonrası payment durumu kalıcı depolamadan geri yüklenir.',
    actual: 'Payment bilgisi bellek/callback\'te — restart sonrası shipment "unpaid" görünür.',
    reproduceReliability: 5,
    recovery: 'POS provider kayıtları ile uzlaştırma (E5/E27 ile paylaşımlı prosedür).',
    permanentFix: 'Payment state machine Room\'a taşınır (Phase 0).',
  },
  E31: {
    flow: 'Stop List', likelihood: 'likely', exposure: 'Hardware scanner\'lı cihazlar',
    status: 'test-ready', testStatus: 'passed', automation: ['unit'], mitigationStatus: 'partial',
    incidents: 2, lastVerified: '2026-06-27', owner: 'Mobile Core', releaseRisk: false,
    detectability: 3, recoverability: 4,
    mechanisms: ['Race condition', 'Out-of-order event'], environments: ['Scanner device'],
    envCoverage: { online: 'pass', offline: 'warn', flaky: 'pass' },
  },
  E32: {
    flow: 'Delivery', likelihood: 'frequent', exposure: 'Tüm ülkeler',
    status: 'validated', testStatus: 'passed', automation: ['unit'], mitigationStatus: 'partial',
    incidents: 3, lastVerified: '2026-07-01', owner: 'Mobile Core', releaseRisk: false,
    detectability: 4, recoverability: 5,
    mechanisms: ['Idempotency failure'], environments: ['Scanner device', 'Camera scanner'],
    envCoverage: { online: 'pass' },
  },
  E33: {
    flow: 'Pick Up', likelihood: 'likely', exposure: 'Uzun süre oturum açık cihazlar',
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
  frequent: { label: 'Sık', order: 3 },
  likely: { label: 'Muhtemel', order: 2 },
  rare: { label: 'Nadir', order: 1 },
}

export const LIFECYCLE_META: Record<Lifecycle, { label: string; tone: 'red' | 'orange' | 'amber' | 'blue' | 'teal' | 'green' | 'gray' | 'purple' }> = {
  discovered: { label: 'Keşfedildi', tone: 'purple' },
  triaged: { label: 'Triyajlandı', tone: 'blue' },
  'test-design-needed': { label: 'Test Tasarımı Gerekli', tone: 'orange' },
  'test-ready': { label: 'Test Hazır', tone: 'amber' },
  validated: { label: 'Doğrulandı', tone: 'teal' },
  covered: { label: 'Kapsandı', tone: 'green' },
  monitoring: { label: 'İzleniyor', tone: 'blue' },
  resolved: { label: 'Çözüldü', tone: 'green' },
  'accepted-risk': { label: 'Kabul Edilen Risk', tone: 'gray' },
  reopened: { label: 'Yeniden Açıldı', tone: 'red' },
}

export const TEST_STATUS_META: Record<TestStatus, { label: string; symbol: string; cls: string }> = {
  passed: { label: 'Geçti', symbol: '✓', cls: 'text-green-600 dark:text-green-400' },
  failed: { label: 'Başarısız', symbol: '×', cls: 'text-red-600 dark:text-red-400' },
  untested: { label: 'Test Edilmedi', symbol: '○', cls: 'text-muted-foreground' },
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
  E27: 'POS success sonrası process\'i öldür; uygulamayı aç ve payment/delivery state uzlaşmasını kontrol et.',
  E9: 'Timeout ile kesilen delivery event\'ini retry et; server\'da tek transaction kaydı oluştuğunu doğrula.',
  E5: 'Payment sonrası uygulama restart; shipment\'ın "paid" kaldığını doğrula.',
  E30: 'Payment callback sonrası restart; POS akışının yeniden başlatılamadığını doğrula.',
  E28: 'Delivery\'yi kasıtlı başarısız bırak; fiscal sistemde yetim invoice kalmadığını doğrula.',
  E20: 'Token TTL\'yi kısalt; vardiya ortası 401 sonrası session\'ın sessizce yenilendiğini ve kuyruğun aktığını doğrula.',
  E16: 'Fiscal dialog açıkken rotation; fiscal request\'in tam bir kez tetiklendiğini doğrula.',
  E29: 'Fiscal dialog açıkken rotation + restart kombinasyonu; idempotency key\'i doğrula.',
  E1: 'FCM refresh ile yerel delivery yazımını aynı chunk\'ta yarıştır; her iki değişikliğin korunduğunu doğrula.',
  E8: 'Transaction ortasında service\'i öldür; restart\'ta stale isProcessing kilidinin temizlendiğini doğrula.',
  E13: 'Offline delivery kuyruktayken shipment\'ı server\'da iptal et; refresh sonrası iptalin görünür kaldığını doğrula.',
}

export function testNextQueue(limit = 5): TestNextItem[] {
  const items = EDGE_FULL
    .filter((e) => e.status !== 'resolved' && e.status !== 'accepted-risk')
    .map((e) => {
      const reasons: string[] = []
      let score = SEV_W[e.severity] * LIKELIHOOD_META[e.likelihood].order

      if (e.severity === 'critical') reasons.push('Kritik etki')
      if (e.incidents > 0) {
        score += e.incidents * 2
        reasons.push(`${e.incidents} geçmiş incident`)
      }
      if (e.releaseRisk) {
        score += 4
        reasons.push(`${RELEASE_VERSION} kapsamında kod değişti`)
      }
      if (e.testStatus === 'untested') {
        score += 3
        reasons.push('Hiç test edilmedi')
      }
      if (e.testStatus === 'failed') {
        score += 4
        reasons.push('Son test başarısız')
      }
      if (e.automation.length === 0) {
        score += 2
        reasons.push('Otomatik regresyon yok')
      }
      if (e.mitigationStatus === 'no') {
        score += 2
        reasons.push('Mitigation yok')
      }
      if (e.detectability <= 2) {
        score += 2
        reasons.push('Düşük tespit edilebilirlik — sessiz hata')
      }
      return {
        edge: e,
        score,
        reasons,
        suggestedTest:
          SUGGESTED_TESTS[e.id] ?? `${e.flow} akışında ${e.trigger.replace(/\.$/, '')} senaryosunu yeniden üretin.`,
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
  { id: 'critical-untested', label: 'Kritik & test edilmemiş', match: (e) => e.severity === 'critical' && e.testStatus === 'untested' },
  { id: 'incident', label: 'Incident üretti', match: (e) => e.incidents > 0 },
  { id: 'no-mitigation', label: 'Mitigation yok', match: (e) => e.mitigationStatus === 'no' },
  { id: 'no-automation', label: 'Otomatik test yok', match: (e) => e.automation.length === 0 },
  { id: 'release-risk', label: `${RELEASE_VERSION} etkisi`, match: (e) => e.releaseRisk },
  { id: 'failed', label: 'Son test başarısız', match: (e) => e.testStatus === 'failed' },
  { id: 'no-owner', label: 'Sahip atanmamış', match: (e) => !e.owner },
  { id: 'stale', label: '90+ gündür doğrulanmadı', match: isStale },
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
    label: 'Release Blocker\'lar',
    desc: 'Kritik/yüksek + release kapsamında + test edilmemiş veya başarısız',
    match: (e) =>
      e.severity !== 'medium' && e.releaseRisk && e.testStatus !== 'passed',
  },
  {
    id: 'incident-candidates',
    label: 'Incident Adayları',
    desc: 'Incident geçmişi olan ve hâlâ korunmasız kayıtlar',
    match: (e) => e.incidents > 0 && e.status !== 'covered' && e.status !== 'resolved',
  },
  {
    id: 'coverage-gaps',
    label: 'Kapsam Boşlukları',
    desc: 'Otomasyon yok · eski doğrulama · sahip yok',
    match: (e) => e.automation.length === 0 || isStale(e) || !e.owner,
  },
  {
    id: 'financial-safety',
    label: 'Finansal Güvenlik',
    desc: 'Payment, fiscal, delivery state, idempotency',
    match: (e) =>
      e.category === 'payment' ||
      e.mechanisms.includes('Idempotency failure') ||
      e.flow === 'Fiscal',
  },
  {
    id: 'offline-reliability',
    label: 'Offline Güvenilirlik',
    desc: 'Kuyruk, retry, process death, ağ geçişleri',
    match: (e) =>
      e.category === 'offline' ||
      e.environments.some((env) => ['Offline', 'Flaky network', 'Doze', 'Process killed'].includes(env)),
  },
  {
    id: 'state-lifecycle',
    label: 'State & Lifecycle',
    desc: 'Rotation, observer, SharedViewModel, process yeniden oluşturma',
    match: (e) =>
      e.category === 'state' ||
      e.category === 'ui' ||
      e.mechanisms.includes('Lifecycle duplication'),
  },
  {
    id: 'accepted-risks',
    label: 'Kabul Edilen Riskler',
    desc: 'Kasıtlı olarak açık bırakılan kayıtlar',
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
