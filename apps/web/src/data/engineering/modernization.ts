// Nesy Mobile modernizasyon planı — tek gerçek kaynak.
// Kaynak: Yeni Mimari Planı (6 faz, ~12 ay) + Refactor alternatifi (6 faz, 6 ay).

export interface PhaseMetric {
  label: string
  current: string
  target: string
}

export interface Phase {
  id: string
  name: string
  duration: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  status: 'done' | 'active' | 'next'
  objectives: string[]
  metrics: PhaseMetric[]
  team: string
}

export const NEW_ARCH_PHASES: Phase[] = [
  {
    id: 'faz-0',
    name: 'Acil Müdahale & Stabilizasyon',
    duration: '2 hafta',
    priority: 'critical',
    status: 'active',
    objectives: [
      '6 kritik bug düzeltilir (AnswerFragment, Splash guard, @AndroidEntryPoint eksikleri, ManuelRouting dialog, Map typo)',
      '3 güvenlik açığı kapatılır (WebView debug, Chucker release, TrustAllCerts)',
      '4 memory leak durdurulur (observeForever’lar)',
      'Ölü kod temizliği (ExtensionMethods ~%50 yorumlu kod)',
    ],
    metrics: [
      { label: 'Kritik bug', current: '6', target: '0' },
      { label: 'Güvenlik açığı', current: '3', target: '0' },
      { label: 'Memory leak', current: '4', target: '0' },
    ],
    team: '1 Android Senior',
  },
  {
    id: 'faz-1',
    name: 'Test Altyapısı & CI',
    duration: '2 ay',
    priority: 'high',
    status: 'next',
    objectives: [
      'JUnit5 + MockK + Turbine + Robolectric kurulumu',
      'CI’a test + lint kapısı (PR bazlı) — bugün PR/push’ta hiçbir kapı yok',
      'SonarQube quality gate’leri devreye alınır',
      'Kritik akışlara (ödeme, teslim, scan) karakterizasyon testleri',
    ],
    metrics: [
      { label: 'Test coverage', current: '%0', target: '%20' },
      { label: 'Test dosyası', current: '0', target: '30+' },
    ],
    team: '2 Android + 1 QA',
  },
  {
    id: 'faz-2',
    name: 'Domain Layer & İş Mantığı Ayrıştırma',
    duration: '3 ay',
    priority: 'high',
    status: 'next',
    objectives: [
      'UseCase + Repository interface’leri; fragment’lardan iş mantığı çıkarılır',
      'MainRepository (136 pass-through) 5+ zengin repository’ye bölünür',
      'CountryStrategy — 163 COUNTRY_CODE dallanması merkezi konfige iner',
      'Barcode eşleştirme tek Matcher’a toplanır (7+ kopya → 1)',
    ],
    metrics: [
      { label: 'UseCase', current: '0', target: '15+' },
      { label: 'Ülke if-else', current: '100+', target: '<10' },
      { label: 'Duplication', current: '7+ dosya', target: '1' },
    ],
    team: '3 Android + 1 Architect',
  },
  {
    id: 'faz-3',
    name: 'God Object Decomposition',
    duration: '3 ay',
    priority: 'critical',
    status: 'next',
    objectives: [
      'SharedViewModel (3.602) → 6 odaklı ViewModel',
      'StopListFragment (7.059) → 6 fragment’a bölme',
      'TaskList / Delivery küçültme — hedef fragment başına <1.000 satır',
      'Ödeme state makinesi kalıcı depoya taşınır (E27/E30 kapanır)',
    ],
    metrics: [
      { label: 'En büyük fragment', current: '7.059', target: '<1.000' },
      { label: 'En büyük VM', current: '3.602', target: '<500' },
      { label: 'God object', current: '4', target: '0' },
    ],
    team: '3-4 Android + 1 QA',
  },
  {
    id: 'faz-4',
    name: 'Navigation, DI & Altyapı',
    duration: '3 ay',
    priority: 'medium',
    status: 'next',
    objectives: [
      'Navigation Component + ActivityResult API geçişi',
      'RequestSenderService → WorkManager Outbox (backoff + jitter, idempotencyKey)',
      'Hilt modül reorganizasyonu',
      'Room JSON chunk → normalize şema (@Transaction/@Relation); destructive migration kapatılır',
    ],
    metrics: [
      { label: 'Deprecated API', current: '15+', target: '0' },
      { label: 'Handler polling', current: '1', target: '0' },
    ],
    team: '2 Android',
  },
  {
    id: 'faz-5',
    name: 'UI Modernizasyon & Performans',
    duration: '4 ay',
    priority: 'low',
    status: 'next',
    objectives: [
      'DiffUtil/ListAdapter geçişi (notifyDataSetChanged 10+ → 0)',
      'ViewBinding standardizasyonu, adapter konsolidasyonu',
      'Compose pilotu (3+ ekran) — MVI (UiState/UiAction/UiEffect)',
    ],
    metrics: [
      { label: 'notifyDataSetChanged', current: '10+', target: '0' },
      { label: 'Compose ekran', current: '0', target: '3+' },
      { label: 'Render', current: '—', target: '<16ms/frame' },
    ],
    team: '2 Android',
  },
]

export const PLAN_RISKS = [
  { title: 'Bus factor = 1', detail: 'Commit’lerin %94’ü tek geliştiricide — plan tek kişiye bağlı kalamaz; bilgi aktarımı Faz 0’dan itibaren zorunlu.', severity: 'critical' as const },
  { title: 'Testsiz God Object bölme', detail: 'Faz 1 (test) tamamlanmadan Faz 3 (decomposition) başlarsa regresyon kontrolsüz olur.', severity: 'critical' as const },
  { title: 'Feature-freeze ihtiyacı', detail: 'Faz 3 sırasında paralel feature geliştirme merge çatışması ve davranış kayması üretir.', severity: 'high' as const },
  { title: 'Ülke dallanması', detail: 'CountryStrategy’ye geçişte 5 ülkenin davranışı tek tek doğrulanmalı (Country Matrix referans).', severity: 'high' as const },
  { title: 'SharedViewModel bağımlılıkları', detail: 'Bölme sırasında gizli bağımlılıklar (hangi ekran ne okuyor) haritalanmalı.', severity: 'high' as const },
  { title: 'Release riski', detail: '5 ülke × prod flavor — her fazın çıkışı ülke bazlı kademeli rollout ister.', severity: 'medium' as const },
]

export const PLAN_SUMMARY = {
  totalDuration: '~12 ay',
  team: '3-4 Android + 1 QA + 1 Architect',
  criticalPath: 'Faz 0 → Faz 1 → Faz 2 → Faz 3 (Faz 4 ve 5, Faz 3 sonrası paralel)',
  keyDecision: 'Faz 1 (Test) olmadan Faz 3 (God Object bölme) başlamamalı.',
}

export const REFACTOR_ALTERNATIVE = {
  name: 'Refactor Alternatifi (uygulama içinde kal)',
  duration: '6 ay · 1-2 Android developer',
  phases: [
    'Faz 0 — Acil bug fix & güvenlik (2 hafta)',
    'Faz 1 — Kod hijyeni & dead code: detekt + ktlint, TODO/FIXME denetimi, string resources (1 ay)',
    'Faz 2 — Temel test altyapısı: %10-15 coverage (2 ay)',
    'Faz 3 — Deprecated API geçişleri (2 ay)',
    'Faz 4 — Copy-paste giderme: BarcodeValidator, BaseInspectionFragment, ülke config map (2 ay)',
    'Faz 5 — Performans & UI: DiffUtil, WorkManager (2 ay)',
  ],
  verdict:
    'Uygulamayı stabilize eder ancak mimari problemleri (God Object, monolit, JSON chunk) ÇÖZMEZ. Kalıcı çözüm yeni mimari planıdır; refactor planı ancak kaynak kısıtında geçici köprü olarak seçilmelidir.',
}
