// Nesy Mobile current architecture & technical debt data — single source of truth.
// Source: Architecture Health Scan (June 2026) + Codebase Report (46 screens x 15 categories).

export const INFRA_METRICS = [
  { label: 'Module count', value: '1 (app)', hint: 'No boundaries; everything can see everything', tone: 'red' as const },
  { label: 'Kotlin files / LOC', value: '515 / ~68K', hint: 'Unmanageable size for a single module', tone: 'orange' as const },
  { label: 'Test files', value: '0', hint: 'junit/espresso dependencies present but unused', tone: 'red' as const },
  { label: 'Room schema version', value: '240', hint: 'fallbackToDestructiveMigration() enabled → field data deleted on migration error', tone: 'red' as const },
  { label: 'UI surface', value: '53 Fragment · 138 XML', hint: '36 adapters · 0 Compose · business logic in adapters', tone: 'orange' as const },
  { label: 'API', value: '527 endpoints / 1 interface', hint: 'Single APIService — interface segregation violation', tone: 'orange' as const },
  { label: 'Flavor', value: '11 variants / 5 countries', hint: 'HR, RS, SI, BA, ME — behavior differences embedded in BuildConfig flags', tone: 'amber' as const },
  { label: 'allowMainThreadQueries()', value: 'Enabled', hint: 'ANR risk; admission that SSoT is not reactive', tone: 'red' as const },
]

export const GOD_OBJECTS = [
  { name: 'StopListFragment', lines: 7059, note: 'Largest file in the project · 15+ responsibilities · 30+ mutable fields · O(n4) matching' },
  { name: 'TaskListFragment', lines: 5864, note: '5 payment methods in a single fragment · whenBarcodeDetect() 200+ lines' },
  { name: 'DeliveryFragment', lines: 4113, note: 'Lowest health score (1.9/10) · deliverShipment() 160 lines, 5 levels deep' },
  { name: 'SharedViewModel', lines: 3602, note: 'GOD OBJECT · ~100+ functions · 8+ responsibilities · no cleanup contract' },
  { name: 'StopViewModel', lines: 2482, note: 'Second god object · ~70+ functions' },
  { name: 'ExtensionMethods', lines: 2419, note: '~50% is dead code commented out' },
]

export const LAYER_MAP = [
  { name: 'Application', desc: 'Single-module Android shell — MainActivity/SplashActivity, Hilt entry, 10 flavor wiring', tone: 'blue' as const },
  { name: 'Presentation', desc: '53 Fragments, 36 adapters, custom views — business rules scattered across fragment/adapter/dialog', tone: 'green' as const },
  { name: 'Business', desc: 'SharedViewModel (3,450+ lines), ScanProcessor/Coordinator/QueueGuard, feature logic folders', tone: 'teal' as const },
  { name: 'Data', desc: 'Room v240 (11 tables), MainRepository (136 pass-through), APIService (527 endpoints)', tone: 'red' as const },
  { name: 'Common', desc: 'Constants/BuildConfig/flavor config, AuthInterceptor/CertificatePinner, FCM/NetworkModule', tone: 'purple' as const },
  { name: 'Remote & Peripheral', desc: 'Firebase (Analytics/FCM/Crashlytics), WorkManager, Zebra DataWedge/ML Kit, RaiPay/WSPay/SoftPOS, Bluetooth printer', tone: 'gray' as const },
]

export const ANTI_PATTERNS = [
  { title: 'God Object', detail: 'SharedViewModel 3,602 + StopViewModel 2,482 lines — centralized state god objects.', severity: 'critical' as const },
  { title: 'Zero test coverage', detail: 'test/ and androidTest/ empty; 0 regression tests despite 140 bug-fix commits.', severity: 'critical' as const },
  { title: 'Massive duplication', detail: 'Barcode utils duplicated across 7+ files; printInvoice in 3 places; Damage/CaseDetection 70% identical.', severity: 'high' as const },
  { title: 'God Fragment', detail: 'StopList 7,059 / TaskList 5,864 / Delivery 4,113 lines.', severity: 'critical' as const },
  { title: 'Country-code branching', detail: 'BuildConfig.COUNTRY_CODE 163 usages; BuildConfig.* 269 — no strategy pattern.', severity: 'high' as const },
  { title: 'WebView debug open in prod', detail: 'setWebContentsDebuggingEnabled(true) — ManuelRouting + Map.', severity: 'high' as const },
  { title: 'observeForever leaks', detail: 'Camera, Damage, CaseDetection, PudoLocker — unregistered observers.', severity: 'high' as const },
  { title: 'Anemic repository', detail: 'MainRepository 136 pass-through functions (243 lines) — carries no business logic.', severity: 'medium' as const },
  { title: 'Handler polling', detail: 'RequestSenderService 3 sec polling (1,190 lines) — no backoff/jitter.', severity: 'high' as const },
  { title: 'Deprecated APIs', detail: 'onActivityResult, startActivityForResult, onBackPressed, getParcelable, setHasOptionsMenu...', severity: 'medium' as const },
]

export const CRITICAL_BUGS = [
  { id: 'CB1', where: 'AnswerFragment L89', what: '.askQuestion should be used instead of .answer — answers are never displayed.', severity: 'critical' as const },
  { id: 'CB2', where: 'SplashActivity L39', what: 'animationStarted is an immutable val(false) — guard never triggers; finish() is also never called.', severity: 'critical' as const },
  { id: 'CB3', where: 'QuestionFragment & AskQuestionFragment', what: '@Inject var but no @AndroidEntryPoint → runtime crash.', severity: 'critical' as const },
  { id: 'CB4', where: 'ManuelRoutingFragment L467-513', what: 'AlertDialog show() is never called → manual routing cannot be saved.', severity: 'critical' as const },
  { id: 'CB5', where: 'MapFragment L362', what: 'getElementsById typo (should be getElementById) → CSS injection never works.', severity: 'critical' as const },
  { id: 'CB6', where: 'ManuelRouting + Map', what: 'WebView remote debug is open in production.', severity: 'high' as const },
  { id: 'CB7', where: 'CameraFragment L735 · Damage L124/L214', what: 'observeForever memory leak.', severity: 'high' as const },
  { id: 'CB8', where: 'PickUpFragment L325-372', what: '5 barcode helpers defined but unused (dead code) + commented-out API call.', severity: 'medium' as const },
  { id: 'CB9', where: 'CreateKTF & LeanLocker', what: 'Incorrect Crashlytics constant — logs are written to the wrong screen.', severity: 'medium' as const },
]

/** Riskiest screens (from 46 screens x 15 health categories analysis). */
export const SCREEN_HEALTH = [
  { rank: 1, name: 'StopListFragment', lines: 7059, score: 2.2, module: 'stop_list', finding: 'O(n4) nested forEach · barcode utils duplicated across 5 files · notifyDataSetChanged instead of DiffUtil' },
  { rank: 2, name: 'TaskListFragment', lines: 5864, score: 2.3, module: 'task_list', finding: 'No ViewModel · RaiPay intents duplicated 3x · hardcoded user messages' },
  { rank: 3, name: 'DeliveryFragment', lines: 4113, score: 1.9, module: 'delivery', finding: 'Mock flow in production · 5 sec non-lifecycle polling · CollectionType mismatch silently logged' },
  { rank: 4, name: 'MainActivity (+SharedViewModel)', lines: 2053, score: 2.4, module: 'main', finding: 'onBackPressed 150 lines/20+ branches · onBarcodeRead 130 lines is-check chain · >500KB bundle cleanup' },
  { rank: 5, name: 'DeliveryFailedFragment', lines: 1576, score: 2.6, module: 'deliveryFailed', finding: 'showDeliveryFailedMenu 240 lines · country-code reason ID repeated 5x · binding!! usage' },
  { rank: 7, name: 'LoginFragment', lines: 1081, score: 3.9, module: 'login', finding: 'Healthiest among large screens — login block (5 attempts/5 min) and Crashlytics keys are good' },
]

export const HEALTH_SCORE_NOTE =
  '46 screens (44 Fragments + 2 Activities), scored 1-10 across 15 health categories (code structure, architecture, complexity, state, testability, security...). Cleanest screen is HandTransactionFragment (5.1/10) — no screen in the codebase scores above 7.'
