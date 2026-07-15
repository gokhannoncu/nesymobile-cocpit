// ─── Project Management — Roadmap Data ───────────────────────────────────────
// Adapted from NesyArchitectureReport roadmapData.ts.

import type { RoadmapPhase } from './types'

// ═══ New Architecture Migration — 6 Phases, 12 months, 3-4 people ═════════════════════════

export const newArchPhases: RoadmapPhase[] = [
  {
    id: 'phase-0',
    phase: 0,
    title: 'Emergency Intervention',
    subtitle: 'Critical bug fix + stabilization',
    duration: '2 weeks',
    months: 'Week 1-2',
    riskLevel: 'critical',
    objectives: [
      'Reduce Crashlytics OOM errors to zero',
      'Eliminate double payment bug',
      'Clean up observeForever memory leaks',
    ],
    deliverables: [
      { title: 'Memory Leak Fix', description: 'observeForever → observe(viewLifecycleOwner) migration', effort: 'S', priority: 'P0', status: 'done' },
      { title: 'Payment Idempotency', description: 'Debounce + idempotency key for payment button', effort: 'S', priority: 'P0', status: 'done' },
      { title: 'LeakCanary CI', description: 'LeakCanary integration + CI pipeline', effort: 'XS', priority: 'P1', status: 'ready' },
    ],
    dependencies: [],
    metrics: [
      { label: 'OOM Crash/day', current: '15-20', target: '0' },
      { label: 'Double payment/month', current: '12', target: '0' },
    ],
    teams: ['Android Dev', 'QA'],
  },
  {
    id: 'phase-1',
    phase: 1,
    title: 'Data Layer Modernization',
    subtitle: 'JSON blob → normalized DB + ScanCoordinator',
    duration: '2 months',
    months: 'Month 1-2',
    riskLevel: 'high',
    objectives: [
      'Reduce barcode scan performance from O(n⁴) → O(1)',
      'Create centralized barcode dispatcher with ScanCoordinator',
      'Room DB migration + normalized table structure',
    ],
    deliverables: [
      { title: 'Barcode DB Migration', description: 'JSON blob → normalized table + index', effort: 'L', priority: 'P0', status: 'planned' },
      { title: 'ScanCoordinator', description: 'Centralized barcode dispatch + validation', effort: 'XL', priority: 'P0', status: 'planned' },
      { title: 'Cross-tour Validation', description: 'Tour matching verification', effort: 'M', priority: 'P1', status: 'planned' },
    ],
    dependencies: ['phase-0'],
    metrics: [
      { label: 'Barcode scan time', current: '8-12s', target: '<200ms' },
      { label: 'ANR rate', current: '3%', target: '<0.1%' },
    ],
    teams: ['Android Dev', 'Backend Dev', 'QA'],
  },
  {
    id: 'phase-2',
    phase: 2,
    title: 'ViewModel Decomposition',
    subtitle: 'SharedViewModel → feature-based ViewModels',
    duration: '3 months',
    months: 'Month 2-4',
    riskLevel: 'high',
    objectives: [
      'Split SharedViewModel into 8+ feature ViewModels',
      'Restructure Fragment dependencies',
      'Reduce init time from 800ms → 200ms',
    ],
    deliverables: [
      { title: 'DeliveryViewModel', description: 'Delivery flow state management', effort: 'L', priority: 'P0', status: 'planned' },
      { title: 'ScanViewModel', description: 'Barcode scan state management', effort: 'L', priority: 'P0', status: 'planned' },
      { title: 'PaymentViewModel', description: 'Payment flow state management', effort: 'L', priority: 'P0', status: 'planned' },
      { title: 'TourViewModel', description: 'Tour/stop management state', effort: 'M', priority: 'P1', status: 'planned' },
    ],
    dependencies: ['phase-1'],
    metrics: [
      { label: 'SharedVM line count', current: '3602', target: '0 (to be deleted)' },
      { label: 'Init time', current: '800ms+', target: '<200ms' },
    ],
    teams: ['Android Dev (2+)', 'QA'],
  },
  {
    id: 'phase-3',
    phase: 3,
    title: 'Fragment Modularization',
    subtitle: 'Breaking down monster fragments',
    duration: '2 months',
    months: 'Month 4-6',
    riskLevel: 'medium',
    objectives: [
      'Reduce StopListFragment from 7059 lines to <500 lines',
      'Establish feature module boundaries',
      'Navigation component migration',
    ],
    deliverables: [
      { title: 'StopList Decomposition', description: 'Separate fragments for list, detail, filter', effort: 'XL', priority: 'P0', status: 'planned' },
      { title: 'Navigation Component', description: 'Fragment-based → NavGraph migration', effort: 'L', priority: 'P1', status: 'planned' },
    ],
    dependencies: ['phase-2'],
    metrics: [
      { label: 'StopListFragment lines', current: '7059', target: '<500' },
      { label: 'Mutable field count', current: '30+', target: '<5' },
    ],
    teams: ['Android Dev (2+)', 'UX', 'QA'],
  },
  {
    id: 'phase-4',
    phase: 4,
    title: 'Country Config System',
    subtitle: 'if/else branching → configuration-driven',
    duration: '2 months',
    months: 'Month 6-8',
    riskLevel: 'medium',
    objectives: [
      'Replace 20+ country if/else chains with config system',
      'Reduce new country onboarding from 2 weeks → 2 days',
    ],
    deliverables: [
      { title: 'Country Config Module', description: 'JSON/YAML config + runtime resolver', effort: 'L', priority: 'P1', status: 'planned' },
      { title: 'Feature Flag System', description: 'Country-based feature toggle', effort: 'M', priority: 'P1', status: 'planned' },
    ],
    dependencies: ['phase-3'],
    metrics: [
      { label: 'Country if/else count', current: '20+', target: '0' },
      { label: 'New country onboarding time', current: '2 weeks', target: '2 days' },
    ],
    teams: ['Android Dev', 'Backend Dev'],
  },
  {
    id: 'phase-5',
    phase: 5,
    title: 'Compose UI Migration',
    subtitle: 'Fragment XML → Jetpack Compose',
    duration: '4 months',
    months: 'Month 8-12',
    riskLevel: 'medium',
    objectives: [
      'Migrate entire UI to Jetpack Compose',
      'Build theme and component library',
      'Ensure accessibility compliance',
    ],
    deliverables: [
      { title: 'Design System', description: 'Compose theme + component library', effort: 'L', priority: 'P1', status: 'planned' },
      { title: 'Screen Migration', description: 'Compose migration for 46 screens', effort: 'XL', priority: 'P1', status: 'planned' },
    ],
    dependencies: ['phase-3', 'phase-4'],
    metrics: [
      { label: 'Compose coverage', current: '0%', target: '100%' },
      { label: 'Accessibility score', current: 'N/A', target: 'AA' },
    ],
    teams: ['Android Dev (3+)', 'UX Designer', 'QA'],
  },
]

// ═══ Current App Refactor — 6 months, 1-2 people ══════════════════════════════════

export const refactorPhases: RoadmapPhase[] = [
  {
    id: 'ref-phase-1',
    phase: 1,
    title: 'Critical Stabilization',
    subtitle: 'Memory leak + crash fix + test coverage',
    duration: '6 weeks',
    months: 'Month 1-1.5',
    riskLevel: 'high',
    objectives: [
      'Clean up all observeForever leaks',
      'Fix Crashlytics top 10 crashes',
      'Add unit tests for critical flows',
    ],
    deliverables: [
      { title: 'Leak Cleanup', description: 'All observeForever → observe migration', effort: 'M', priority: 'P0', status: 'ready' },
      { title: 'Crash Fix Sprint', description: 'Top 10 crash fixes', effort: 'L', priority: 'P0', status: 'planned' },
      { title: 'Test Coverage', description: 'Payment + barcode unit tests', effort: 'M', priority: 'P1', status: 'planned' },
    ],
    dependencies: [],
    metrics: [
      { label: 'Crash-free rate', current: '96.5%', target: '99.5%' },
      { label: 'Test coverage', current: '8%', target: '35%' },
    ],
    teams: ['Android Dev', 'QA'],
  },
  {
    id: 'ref-phase-2',
    phase: 2,
    title: 'Performance Improvement',
    subtitle: 'Barcode + list + startup optimization',
    duration: '6 weeks',
    months: 'Month 1.5-3',
    riskLevel: 'medium',
    objectives: [
      'Reduce barcode scan time by 80%',
      'Improve RecyclerView performance',
      'Reduce app startup time',
    ],
    deliverables: [
      { title: 'Barcode Index', description: 'Adding DB index to JSON blob (without full migration)', effort: 'M', priority: 'P0', status: 'planned' },
      { title: 'RecyclerView DiffUtil', description: 'List performance optimization', effort: 'S', priority: 'P1', status: 'planned' },
    ],
    dependencies: ['ref-phase-1'],
    metrics: [
      { label: 'Barcode scan time', current: '8-12s', target: '<2s' },
      { label: 'Frame drop', current: '15%+', target: '<2%' },
    ],
    teams: ['Android Dev'],
  },
  {
    id: 'ref-phase-3',
    phase: 3,
    title: 'Incremental Refactoring',
    subtitle: 'SharedVM partial separation + code quality',
    duration: '3 months',
    months: 'Month 3-6',
    riskLevel: 'medium',
    objectives: [
      'Extract 3 critical ViewModels from SharedViewModel',
      'Improve code quality metrics',
      'Increase documentation coverage',
    ],
    deliverables: [
      { title: 'PaymentVM Extraction', description: 'Move payment state to separate ViewModel', effort: 'L', priority: 'P1', status: 'planned' },
      { title: 'ScanVM Extraction', description: 'Move barcode state to separate ViewModel', effort: 'L', priority: 'P1', status: 'planned' },
      { title: 'Code Quality', description: 'Detekt/Lint rules + CI enforcements', effort: 'S', priority: 'P2', status: 'planned' },
    ],
    dependencies: ['ref-phase-2'],
    metrics: [
      { label: 'SharedVM lines', current: '3602', target: '<2000' },
      { label: 'Lint warning', current: '200+', target: '<50' },
    ],
    teams: ['Android Dev (1-2)'],
  },
]

// ═══ Summary ════════════════════════════════════════════════════════════════

export const roadmapSummary = {
  newArch: {
    totalPhases: newArchPhases.length,
    duration: '12 months',
    teamSize: '3-4 people',
    risk: 'High — full rewrite',
    benefit: 'Clean architecture, testability, maintainability',
  },
  refactor: {
    totalPhases: refactorPhases.length,
    duration: '6 months',
    teamSize: '1-2 people',
    risk: 'Medium — incremental change',
    benefit: 'Fast stabilization, low cost',
  },
}
