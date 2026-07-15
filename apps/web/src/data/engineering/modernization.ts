// Nesy Mobile modernization plan — single source of truth.
// Source: New Architecture Plan (6 phases, ~12 months) + Refactor alternative (6 phases, 6 months).

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
    name: 'Emergency Response & Stabilization',
    duration: '2 weeks',
    priority: 'critical',
    status: 'active',
    objectives: [
      '6 critical bugs are fixed (AnswerFragment, Splash guard, @AndroidEntryPoint gaps, ManuelRouting dialog, Map typo)',
      '3 security vulnerabilities are closed (WebView debug, Chucker release, TrustAllCerts)',
      '4 memory leaks are stopped (observeForever instances)',
      'Dead code cleanup (ExtensionMethods ~50% commented-out code)',
    ],
    metrics: [
      { label: 'Critical bug', current: '6', target: '0' },
      { label: 'Security vulnerability', current: '3', target: '0' },
      { label: 'Memory leak', current: '4', target: '0' },
    ],
    team: '1 Android Senior',
  },
  {
    id: 'faz-1',
    name: 'Test Infrastructure & CI',
    duration: '2 months',
    priority: 'high',
    status: 'next',
    objectives: [
      'JUnit5 + MockK + Turbine + Robolectric setup',
      'Test + lint gate added to CI (per-PR) — today no gate exists on PR/push',
      'SonarQube quality gates are activated',
      'Characterization tests for critical flows (payment, delivery, scan)',
    ],
    metrics: [
      { label: 'Test coverage', current: '%0', target: '%20' },
      { label: 'Test files', current: '0', target: '30+' },
    ],
    team: '2 Android + 1 QA',
  },
  {
    id: 'faz-2',
    name: 'Domain Layer & Business Logic Separation',
    duration: '3 months',
    priority: 'high',
    status: 'next',
    objectives: [
      'UseCase + Repository interfaces; business logic extracted from fragments',
      'MainRepository (136 pass-through) split into 5+ rich repositories',
      'CountryStrategy — 163 COUNTRY_CODE branches moved to centralized config',
      'Barcode matching consolidated into a single Matcher (7+ copies to 1)',
    ],
    metrics: [
      { label: 'UseCase', current: '0', target: '15+' },
      { label: 'Country if-else', current: '100+', target: '<10' },
      { label: 'Duplication', current: '7+ files', target: '1' },
    ],
    team: '3 Android + 1 Architect',
  },
  {
    id: 'faz-3',
    name: 'God Object Decomposition',
    duration: '3 months',
    priority: 'critical',
    status: 'next',
    objectives: [
      'SharedViewModel (3,602) split into 6 focused ViewModels',
      'StopListFragment (7,059) split into 6 fragments',
      'TaskList / Delivery size reduction — target <1,000 lines per fragment',
      'Payment state machine moved to persistent storage (E27/E30 closed)',
    ],
    metrics: [
      { label: 'Largest fragment', current: '7,059', target: '<1,000' },
      { label: 'Largest VM', current: '3,602', target: '<500' },
      { label: 'God object', current: '4', target: '0' },
    ],
    team: '3-4 Android + 1 QA',
  },
  {
    id: 'faz-4',
    name: 'Navigation, DI & Infrastructure',
    duration: '3 months',
    priority: 'medium',
    status: 'next',
    objectives: [
      'Navigation Component + ActivityResult API migration',
      'RequestSenderService to WorkManager Outbox (backoff + jitter, idempotencyKey)',
      'Hilt module reorganization',
      'Room JSON chunk to normalized schema (@Transaction/@Relation); destructive migration disabled',
    ],
    metrics: [
      { label: 'Deprecated API', current: '15+', target: '0' },
      { label: 'Handler polling', current: '1', target: '0' },
    ],
    team: '2 Android',
  },
  {
    id: 'faz-5',
    name: 'UI Modernization & Performance',
    duration: '4 months',
    priority: 'low',
    status: 'next',
    objectives: [
      'DiffUtil/ListAdapter migration (notifyDataSetChanged 10+ to 0)',
      'ViewBinding standardization, adapter consolidation',
      'Compose pilot (3+ screens) — MVI (UiState/UiAction/UiEffect)',
    ],
    metrics: [
      { label: 'notifyDataSetChanged', current: '10+', target: '0' },
      { label: 'Compose screens', current: '0', target: '3+' },
      { label: 'Render', current: '—', target: '<16ms/frame' },
    ],
    team: '2 Android',
  },
]

export const PLAN_RISKS = [
  { title: 'Bus factor = 1', detail: '94% of commits are from a single developer — the plan cannot depend on one person; knowledge transfer is mandatory starting from Phase 0.', severity: 'critical' as const },
  { title: 'God Object decomposition without tests', detail: 'If Phase 3 (decomposition) starts before Phase 1 (test) is completed, regression will be uncontrolled.', severity: 'critical' as const },
  { title: 'Feature-freeze requirement', detail: 'Parallel feature development during Phase 3 causes merge conflicts and behavior drift.', severity: 'high' as const },
  { title: 'Country branching', detail: 'During CountryStrategy migration, all 5 countries\' behaviors must be individually verified (Country Matrix reference).', severity: 'high' as const },
  { title: 'SharedViewModel dependencies', detail: 'Hidden dependencies (which screen reads what) must be mapped during decomposition.', severity: 'high' as const },
  { title: 'Release risk', detail: '5 countries x prod flavor — each phase exit requires country-based gradual rollout.', severity: 'medium' as const },
]

export const PLAN_SUMMARY = {
  totalDuration: '~12 months',
  team: '3-4 Android + 1 QA + 1 Architect',
  criticalPath: 'Phase 0 -> Phase 1 -> Phase 2 -> Phase 3 (Phase 4 and 5, parallel after Phase 3)',
  keyDecision: 'Phase 3 (God Object decomposition) must not start without Phase 1 (Test).',
}

export const REFACTOR_ALTERNATIVE = {
  name: 'Refactor Alternative (stay within the application)',
  duration: '6 months - 1-2 Android developers',
  phases: [
    'Phase 0 — Emergency bug fix & security (2 weeks)',
    'Phase 1 — Code hygiene & dead code: detekt + ktlint, TODO/FIXME audit, string resources (1 month)',
    'Phase 2 — Basic test infrastructure: 10-15% coverage (2 months)',
    'Phase 3 — Deprecated API migrations (2 months)',
    'Phase 4 — Copy-paste elimination: BarcodeValidator, BaseInspectionFragment, country config map (2 months)',
    'Phase 5 — Performance & UI: DiffUtil, WorkManager (2 months)',
  ],
  verdict:
    'Stabilizes the application but does NOT SOLVE architectural problems (God Object, monolith, JSON chunk). The permanent solution is the new architecture plan; the refactor plan should only be chosen as a temporary bridge when resources are constrained.',
}
