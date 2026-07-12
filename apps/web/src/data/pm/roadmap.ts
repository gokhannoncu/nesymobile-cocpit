// ─── Project Management — Roadmap Data ───────────────────────────────────────
// NesyArchitectureReport roadmapData.ts'den uyarlanmış.

import type { RoadmapPhase } from './types'

// ═══ Yeni Mimariye Geçiş — 6 Faz, 12 ay, 3-4 kişi ═════════════════════════

export const newArchPhases: RoadmapPhase[] = [
  {
    id: 'phase-0',
    phase: 0,
    title: 'Acil Müdahale',
    subtitle: 'Kritik bug fix + stabilizasyon',
    duration: '2 hafta',
    months: 'Hafta 1-2',
    riskLevel: 'critical',
    objectives: [
      'Crashlytics OOM hatalarını sıfıra indirmek',
      'Çift ödeme bug\'ını ortadan kaldırmak',
      'observeForever memory leak\'lerini temizlemek',
    ],
    deliverables: [
      { title: 'Memory Leak Fix', description: 'observeForever → observe(viewLifecycleOwner) geçişi', effort: 'S', priority: 'P0', status: 'done' },
      { title: 'Payment Idempotency', description: 'Ödeme butonuna debounce + idempotency key', effort: 'S', priority: 'P0', status: 'done' },
      { title: 'LeakCanary CI', description: 'LeakCanary entegrasyonu + CI pipeline', effort: 'XS', priority: 'P1', status: 'ready' },
    ],
    dependencies: [],
    metrics: [
      { label: 'OOM Crash/gün', current: '15-20', target: '0' },
      { label: 'Çift ödeme/ay', current: '12', target: '0' },
    ],
    teams: ['Android Dev', 'QA'],
  },
  {
    id: 'phase-1',
    phase: 1,
    title: 'Data Layer Modernizasyonu',
    subtitle: 'JSON blob → normalized DB + ScanCoordinator',
    duration: '2 ay',
    months: 'Ay 1-2',
    riskLevel: 'high',
    objectives: [
      'Barkod tarama performansını O(n⁴) → O(1) düşürmek',
      'ScanCoordinator ile merkezi barkod dispatcher oluşturmak',
      'Room DB migration + normalized tablo yapısı',
    ],
    deliverables: [
      { title: 'Barcode DB Migration', description: 'JSON blob → normalized table + index', effort: 'L', priority: 'P0', status: 'planned' },
      { title: 'ScanCoordinator', description: 'Merkezi barkod dispatch + validation', effort: 'XL', priority: 'P0', status: 'planned' },
      { title: 'Cross-tour Validation', description: 'Tur eşleştirme kontrolü', effort: 'M', priority: 'P1', status: 'planned' },
    ],
    dependencies: ['phase-0'],
    metrics: [
      { label: 'Barkod tarama süresi', current: '8-12s', target: '<200ms' },
      { label: 'ANR oranı', current: '%3', target: '<%0.1' },
    ],
    teams: ['Android Dev', 'Backend Dev', 'QA'],
  },
  {
    id: 'phase-2',
    phase: 2,
    title: 'ViewModel Decomposition',
    subtitle: 'SharedViewModel → feature-based ViewModel\'ler',
    duration: '3 ay',
    months: 'Ay 2-4',
    riskLevel: 'high',
    objectives: [
      'SharedViewModel\'i 8+ feature ViewModel\'e bölmek',
      'Fragment bağımlılıklarını yeniden yapılandırmak',
      'Init süresini 800ms→200ms\'ye düşürmek',
    ],
    deliverables: [
      { title: 'DeliveryViewModel', description: 'Teslimat akışı state yönetimi', effort: 'L', priority: 'P0', status: 'planned' },
      { title: 'ScanViewModel', description: 'Barkod tarama state yönetimi', effort: 'L', priority: 'P0', status: 'planned' },
      { title: 'PaymentViewModel', description: 'Ödeme akışı state yönetimi', effort: 'L', priority: 'P0', status: 'planned' },
      { title: 'TourViewModel', description: 'Tur/durak yönetimi state', effort: 'M', priority: 'P1', status: 'planned' },
    ],
    dependencies: ['phase-1'],
    metrics: [
      { label: 'SharedVM satır sayısı', current: '3602', target: '0 (silinecek)' },
      { label: 'Init süresi', current: '800ms+', target: '<200ms' },
    ],
    teams: ['Android Dev (2+)', 'QA'],
  },
  {
    id: 'phase-3',
    phase: 3,
    title: 'Fragment Modularizasyonu',
    subtitle: 'Monster fragment\'ları parçalama',
    duration: '2 ay',
    months: 'Ay 4-6',
    riskLevel: 'medium',
    objectives: [
      'StopListFragment\'ı 7059 satırdan <500 satıra düşürmek',
      'Feature module sınırlarını oluşturmak',
      'Navigation component geçişi',
    ],
    deliverables: [
      { title: 'StopList Decomposition', description: 'Liste, detay, filtre ayrı fragment\'lar', effort: 'XL', priority: 'P0', status: 'planned' },
      { title: 'Navigation Component', description: 'Fragment-based → NavGraph geçişi', effort: 'L', priority: 'P1', status: 'planned' },
    ],
    dependencies: ['phase-2'],
    metrics: [
      { label: 'StopListFragment satır', current: '7059', target: '<500' },
      { label: 'Mutable field sayısı', current: '30+', target: '<5' },
    ],
    teams: ['Android Dev (2+)', 'UX', 'QA'],
  },
  {
    id: 'phase-4',
    phase: 4,
    title: 'Country Config Sistemi',
    subtitle: 'if/else branching → configuration-driven',
    duration: '2 ay',
    months: 'Ay 6-8',
    riskLevel: 'medium',
    objectives: [
      '20+ ülke if/else zincirini config sistemiyle değiştirmek',
      'Yeni ülke eklemeyi 2 hafta → 2 güne düşürmek',
    ],
    deliverables: [
      { title: 'Country Config Module', description: 'JSON/YAML config + runtime resolver', effort: 'L', priority: 'P1', status: 'planned' },
      { title: 'Feature Flag System', description: 'Ülke bazlı feature toggle', effort: 'M', priority: 'P1', status: 'planned' },
    ],
    dependencies: ['phase-3'],
    metrics: [
      { label: 'Ülke if/else sayısı', current: '20+', target: '0' },
      { label: 'Yeni ülke ekleme süresi', current: '2 hafta', target: '2 gün' },
    ],
    teams: ['Android Dev', 'Backend Dev'],
  },
  {
    id: 'phase-5',
    phase: 5,
    title: 'Compose UI Migration',
    subtitle: 'Fragment XML → Jetpack Compose',
    duration: '4 ay',
    months: 'Ay 8-12',
    riskLevel: 'medium',
    objectives: [
      'Tüm UI\'ı Jetpack Compose\'a taşımak',
      'Tema ve component library oluşturmak',
      'Accessibility uyumluluğu sağlamak',
    ],
    deliverables: [
      { title: 'Design System', description: 'Compose theme + component library', effort: 'L', priority: 'P1', status: 'planned' },
      { title: 'Screen Migration', description: '46 ekranın Compose geçişi', effort: 'XL', priority: 'P1', status: 'planned' },
    ],
    dependencies: ['phase-3', 'phase-4'],
    metrics: [
      { label: 'Compose coverage', current: '%0', target: '%100' },
      { label: 'Accessibility score', current: 'N/A', target: 'AA' },
    ],
    teams: ['Android Dev (3+)', 'UX Designer', 'QA'],
  },
]

// ═══ Mevcut App Refactor — 6 ay, 1-2 kişi ══════════════════════════════════

export const refactorPhases: RoadmapPhase[] = [
  {
    id: 'ref-phase-1',
    phase: 1,
    title: 'Kritik Stabilizasyon',
    subtitle: 'Memory leak + crash fix + test coverage',
    duration: '6 hafta',
    months: 'Ay 1-1.5',
    riskLevel: 'high',
    objectives: [
      'Tüm observeForever leak\'leri temizlemek',
      'Crashlytics top 10 crash\'i düzeltmek',
      'Kritik akışlara unit test eklemek',
    ],
    deliverables: [
      { title: 'Leak Cleanup', description: 'Tüm observeForever → observe geçişi', effort: 'M', priority: 'P0', status: 'ready' },
      { title: 'Crash Fix Sprint', description: 'Top 10 crash düzeltmesi', effort: 'L', priority: 'P0', status: 'planned' },
      { title: 'Test Coverage', description: 'Ödeme + barkod unit test\'leri', effort: 'M', priority: 'P1', status: 'planned' },
    ],
    dependencies: [],
    metrics: [
      { label: 'Crash-free rate', current: '%96.5', target: '%99.5' },
      { label: 'Test coverage', current: '%8', target: '%35' },
    ],
    teams: ['Android Dev', 'QA'],
  },
  {
    id: 'ref-phase-2',
    phase: 2,
    title: 'Performans İyileştirme',
    subtitle: 'Barkod + liste + startup optimizasyonu',
    duration: '6 hafta',
    months: 'Ay 1.5-3',
    riskLevel: 'medium',
    objectives: [
      'Barkod tarama süresini %80 düşürmek',
      'RecyclerView performansını iyileştirmek',
      'App startup süresini azaltmak',
    ],
    deliverables: [
      { title: 'Barcode Index', description: 'JSON blob\'a DB index ekleme (full migration olmadan)', effort: 'M', priority: 'P0', status: 'planned' },
      { title: 'RecyclerView DiffUtil', description: 'Liste performans optimizasyonu', effort: 'S', priority: 'P1', status: 'planned' },
    ],
    dependencies: ['ref-phase-1'],
    metrics: [
      { label: 'Barkod tarama süresi', current: '8-12s', target: '<2s' },
      { label: 'Frame drop', current: '%15+', target: '<%2' },
    ],
    teams: ['Android Dev'],
  },
  {
    id: 'ref-phase-3',
    phase: 3,
    title: 'Incremental Refactoring',
    subtitle: 'SharedVM kısmi ayrım + code quality',
    duration: '3 ay',
    months: 'Ay 3-6',
    riskLevel: 'medium',
    objectives: [
      'SharedViewModel\'den 3 kritik ViewModel\'i ayırmak',
      'Kod kalitesi metriklerini iyileştirmek',
      'Documentation coverage artırmak',
    ],
    deliverables: [
      { title: 'PaymentVM Extraction', description: 'Ödeme state\'ini ayrı ViewModel\'e taşıma', effort: 'L', priority: 'P1', status: 'planned' },
      { title: 'ScanVM Extraction', description: 'Barkod state\'ini ayrı ViewModel\'e taşıma', effort: 'L', priority: 'P1', status: 'planned' },
      { title: 'Code Quality', description: 'Detekt/Lint kuralları + CI enforcements', effort: 'S', priority: 'P2', status: 'planned' },
    ],
    dependencies: ['ref-phase-2'],
    metrics: [
      { label: 'SharedVM satır', current: '3602', target: '<2000' },
      { label: 'Lint warning', current: '200+', target: '<50' },
    ],
    teams: ['Android Dev (1-2)'],
  },
]

// ═══ Summary ════════════════════════════════════════════════════════════════

export const roadmapSummary = {
  newArch: {
    totalPhases: newArchPhases.length,
    duration: '12 ay',
    teamSize: '3-4 kişi',
    risk: 'Yüksek — tam yeniden yazım',
    benefit: 'Temiz mimari, test edilebilirlik, sürdürülebilirlik',
  },
  refactor: {
    totalPhases: refactorPhases.length,
    duration: '6 ay',
    teamSize: '1-2 kişi',
    risk: 'Orta — incremental değişim',
    benefit: 'Hızlı stabilizasyon, düşük maliyet',
  },
}
