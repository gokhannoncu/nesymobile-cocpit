# NESY_COURIER_DOMAIN_PACK_REFERENCE_V1

```yaml
artifactKey: NESY_COURIER_DOMAIN_PACK_REFERENCE_V1
version: 1
packKey: nesy.courier
packVersion: 1.0.0
schemaVersion: 1
publicationState: DRAFT
phase: "4B"
snapshotAuthoring: HAND
compilerStatus: NOT_STARTED
source: domain-packs/nesy-courier/src/reference.ts
fixtures: domain-packs/nesy-courier/fixtures/
```

## 0. Ne olduğu ve ne olmadığı

Bu artifact, Nesy Courier Domain Pack'inin **reviewed-ready reference** hâlidir.
Bir kuryenin bir günü altı vertical slice olarak modellenmiştir.

| Bu artifact | Bu artifact değil |
|---|---|
| Business meaning + evidence sözleşmesi | Production compiler çıktısı |
| Hand-authored Generic IR snapshot (`authoredBy: HAND`) | Phase 4C `BridgeFlowCompiler` output'u |
| Review + regression referansı | Execution planı (RunManifest/queue/lease yok) |
| Registry ve capability referansı | Cockpit UI / Domain Pack manager |

Snapshot'lar `validateWorkflowIrV2` ile doğrulanır (test-bound), yani **şekli
kanıtlanmıştır**; ancak macro → step eşlemesi hâlâ insan kararıdır. Phase 4C
compiler yazıldığında `authoredBy` alanı `COMPILER` olacak ve snapshot'lar
regression baseline'ı olarak kullanılacaktır.

## 1. Slice sırası neden bu

Alfabetik değil, kuryenin günü:

```text
COURIER_LOGIN            → oturum üç plane'de var
  ↓
SELECT_ROUTE             → rota app + backend'de atanmış
  ↓
OPEN_STOP                → doğru stop açık (canonical slice)
  ↓
PROCESS_PARCEL           → parça okutuldu ve işlendi
  ↓
COMPLETE_DELIVERY        → teslim backend'de onaylandı (online veya queue)
  ↓
TOUR_APPROVAL_LIFECYCLE  → kurye ister, dispatcher onaylar
```

Her slice'ın precondition'ları önceki slice'ın output fact'leridir. Bu yüzden
artifact tek bir yolculuk olarak okunabilir.

## 2. Registry özeti

| Registry | Sayı | İçerik |
|---|---|---|
| Application | 1 | `nesy.courier.mobile` (Android, `com.nesy.courier`, minVersionCode 41200) |
| Screen | 7 | `nesy.auth.login`, `nesy.route.stop-list`, `nesy.stop.task-list`, `nesy.delivery.flow`, `nesy.pickup.flow`, `nesy.vehicle-loading`, `nesy.end-of-day` |
| Surface | 8 | `nesy.route.selection-dialog`, `nesy.mandatory-update-dialog`, `nesy.session-expired-dialog`, `nesy.permission-dialog`, `nesy.network-dialog`, `nesy.scanner.surface`, `nesy.payment.surface`, `nesy.fiscal.surface` |
| Entity | 7 | `ROUTE`, `STOP`, `TASK`, `SHIPMENT`, `PARCEL`, `PENDING_OPERATION`, `TOUR_APPROVAL_REQUEST` |
| Target | 10 | login alanları, `nesy.target.route-row`, `nesy.target.stop-row`, `nesy.target.task-row`, scan trigger, delivery complete, tour approval request |
| Evidence source | 35 | UI 16, APP 10, LOCAL 4, REMOTE 5 (biri `transportSuccessOnly`) |
| Derived fact | 4 | `APP.LOGIN_SUCCEEDED`, `APP.ACTIVE_STOP_MATCHES`, `REMOTE.DELIVERY_CONFIRMED`, `REMOTE.TOUR_APPROVAL_CONFIRMED` |
| Semantic action | 8 | 6 slice + 2 interrupt handler |
| Macro | 8 | 6 slice macro + `grant-permission`, `recover-network` |
| Launch profile | 4 | `cold-real-login`, `prepared-session`, `direct-state`, `reuse-session` |
| Test profile | 4 | `release-core`, `preview-smoke`, `bad-day`, `differential-baseline` |
| Campaign | 1 | `nesy.campaign.release-gate` |
| Feature blueprint | 3 | stop-handling, delivery-completion, tour-approval |
| Capability | 16 | `verdict.core` 6, `nesy` 9, `mackolik` 1 |
| Remote adapter | 1 | `nesy.backoffice`, 9 allowlisted operation |

### 2.1 Screen / Surface ayrımı neden zorunlu

Dialog'u screen olarak tanımlamak bir otomasyon suite'ini bakımsız hâle getiren
en yaygın hatadır:

- "session-expired dialog'una navigate et" diye bir şey yoktur → entry strategy
  uydurulur.
- Dialog screen ise, her akış onu **ayrı ayrı** handle etmek zorundadır; ilk
  unutan akış planlanmamış bir dialog üzerinde timeout verir ve hata alakasız bir
  step'te raporlanır.

Surface olarak (`parentScreenRefs: ["*"]`) bir kere policy ile handle edilir.
`validateDomainPackBundle` bir `screenKey` içinde surface kind segmenti görürse
`DIALOG_DECLARED_AS_SCREEN` üretir.

### 2.2 Evidence plane sayısı dört

`UI` / `APP` / `LOCAL` / `REMOTE`. Offline queue **ayrı plane değildir**;
`LOCAL` plane içinde `OFFLINE_QUEUE_WATCH` source kind'ıdır. SDK state de ayrı
plane değildir; `APP` içinde `SDK_STATE`'tir. Mekanizma başına plane açmak, her
yeni mekanizmanın Core değişikliği istemesine ve plane ekseninin "bunu kim
gözlemledi?" sorusuna cevap vermemesine yol açar. `FORBIDDEN_EVIDENCE_PLANES`
bunu test-bound yapar.

## 3. Altı slice

Her slice `NesyReferenceSlice` şeklindedir ve şu alanları **zorunlu** taşır:
`businessMeaning`, `notResponsibleFor`, `inputSchema`, `outputSchema`,
`preconditions`, `screenRefs`, `surfaceRefs`, `entityBindings`,
`targetResolutionRefs`, `semanticMacroRef`, `macroExpansion`,
`genericIrSnapshot`, `bridgeFlowPlanSnapshot`, `oracle` (Continue Gate + Final
Oracle ayrı), `interruptPolicy`, `requiredCapabilityRefs`, `releaseIsolation`,
`negativeCases`.

Test suite (`src/index.test.ts` → "gives every slice the complete required field
set") bu alanların hepsinin dolu olduğunu doğrular.

### 3.1 COURIER_LOGIN

| Alan | Değer |
|---|---|
| Macro | `nesy.macro.login` |
| Screen | `nesy.auth.login` → `nesy.route.stop-list` |
| Launch profile | `nesy.launch.cold-real-login` (**tek** verdict üretebilen profil) |
| Continue Gate | `allOf [UI.ROUTE_LIST_READY]`, `noneOf [UI.SESSION_EXPIRED_DIALOG_PRESENT]` |
| Final Oracle | `APP.LOGIN_SUCCEEDED` (REQUIRED/IMMEDIATE), `REMOTE.AUTH_ACCEPTED` (REQUIRED/IMMEDIATE), `LOCAL.USER_SESSION_AVAILABLE` (REQUIRED/EVENTUAL 30s → INCONCLUSIVE) |
| IR steps | 10 (wait → 3×resolve/setText/tap → REMOTE_ACTION → ASSERT_FACT → CLEANUP) |

**Setup ile gerçek login ayrımı.** Diğer slice'lar hızlı olsun diye
`PREPARED_SESSION` kullanır — doğrudur. Tehlike, login testinin de kullanmaya
başlamasıdır: her test hızlanır, login testi de hızlanır ve artık **hiç login
olmadan** PASS verir. Production'da login bozulur, suite yeşil kalır.

İki mekanizma bunu engeller:

1. `validateLaunchProfile` → `PREPARED_SESSION`/`DIRECT_STATE` +
   `producesProductVerdict: true` = `SETUP_LAUNCH_PRODUCES_VERDICT`.
2. `APP.LOGIN_SUCCEEDED`, üç plane'in `CORRELATED_ALL_OF` derivation'ıdır.
   Prepared session yalnız APP plane fact'ini karşılar, diğer ikisini asla.

`nesy.session-expired-dialog` bu slice'ta `fatalSurfaceRefs` içindedir. HANDLE
edilse gerçek bir session regresyonu "biraz daha yavaş yeşil koşu"ya dönerdi.

### 3.2 SELECT_ROUTE

| Alan | Değer |
|---|---|
| Macro | `nesy.macro.select-route` |
| Surface | `nesy.route.selection-dialog` (HANDLE policy, handler = bu macro) |
| Entity binding | `ROUTE` → `nesy.target.route-row` (`routeCode` business key) |
| Final Oracle | `APP.SELECTED_ROUTE_OBSERVED` (REQUIRED/IMMEDIATE), `REMOTE.ROUTE_ASSIGNED` (REQUIRED/EVENTUAL 60s), `REMOTE.ROUTES_AVAILABLE` (**WARNING**) |
| IR steps | 10, bir `CONDITION` branch'i |

Boş route dialog'u UI defect'i gibi görünür; genelde değildir — backend o hesaba
bugün hiçbir şey sunmuyordur. `CONDITION` istenen rotanın projection'da olup
olmadığını kontrol eder, yoksa `ANNOTATE` + `next: null` ile **hiçbir şeye
dokunmadan** durur. `REMOTE.ROUTES_AVAILABLE` teşhis için WARNING'dir; seçim
çalıştı mı sorusuna karar vermez.

### 3.3 OPEN_STOP — canonical slice

| Alan | Değer |
|---|---|
| Macro | `nesy.macro.open-stop` |
| Input | `stop: entityRef<STOP>` (**index değil**) |
| Target | `nesy.target.stop-row` |
| Continue Gate | `anyOf [UI.TASK_LIST_READY, UI.DELIVERY_FLOW_READY]`, `noneOf [UI.LOADING_BLOCKER_PRESENT]` |
| Final Oracle | `APP.ACTIVE_STOP_MATCHES` (REQUIRED/IMMEDIATE/FAIL), `APP.ACTIVE_STOP_OBSERVED`, `APP.AVAILABLE_STOPS_LOADED` |
| IR steps | 7 |

**Önlenmeye çalışılan hata.** Plan "3. satırı aç" der. Liste okunduktan sonra
arka plan sync'i listeyi yeniden sıralar. Run başka birinin stop'unu açar, oraya
parçayı **başarıyla** teslim eder, bütün oracle'lar geçer. Rapor yeşildir. Müşterinin
parçası yanlış adrestedir ve kimsenin fark etmemesinin sebebi suite'tir.

Altı safeguard, IR'daki sırasıyla:

| # | Safeguard | Nerede | Bozulursa ne fail eder |
|---|---|---|---|
| 1 | Typed `STOP` entity input | `macro.input.fields[0]` | `MACRO_ENTITY_INPUT_UNTYPED` |
| 2 | `nesy.availableStops` içinde varlık kontrolü, **dokunmadan önce** | `read-available` → `check-present` | `unknownPolicy: FAIL`; yoksa `report-absent` (ANNOTATE, `next: null`) |
| 3 | Provider chain, index değil | `nesy.target.stop-row` | `ROW_INDEX_AS_IDENTITY`, `ROW_INDEX_NOT_LAST`, `NO_IDENTITY_PROVIDER` |
| 4 | Ambiguous target'ta fail-closed | `ambiguityPolicy: FAIL` | `AmbiguityPolicy` union'ında `FIRST_MATCH` **yok** |
| 5 | TASK_LIST **veya** DELIVERY readiness | `await-destination` (`WAIT_ANY`) | tek leg beklenirse single-task stop'ta sebepsiz timeout |
| 6 | Açılan satır doğru mu | `assert-correct-item` (`APP.ACTIVE_STOP_MATCHES`) | REQUIRED/IMMEDIATE/FAIL |

Provider chain sırası:

```text
ACCESSIBILITY_ID        establishesIdentity: true   (app'in kendi test id'si)
ENTITY_BINDING          establishesIdentity: true   (stopCode business key)
STRUCTURAL_FINGERPRINT  establishesIdentity: true   (container içi shape)
ROW_INDEX_HINT          establishesIdentity: FALSE  (yalnız daraltma, EN SON)
```

`reverifyBeforeAction: true` — resolve ile tap arasındaki pencere tam olarak
yanlış-satır hatasının yaşadığı yerdir.

`APP.ACTIVE_STOP_MATCHES` bir derived fact'tir: `ENTITY_STATUS_EQUALS`,
`requiresCorrelation: true`, `preserveInputs: true`. Yani 1–5 safeguard'ının
hepsi aynı anda başarısız olsa bile slice yeşil veremez.

### 3.4 PROCESS_PARCEL

| Alan | Değer |
|---|---|
| Macro | `nesy.macro.process-parcel` |
| Seam | `nesy.setup.scanner-inject` (automation-only, `nesy.scanner.inject`) |
| Final Oracle | `APP.PARCEL_STATE_PROCESSED`, `APP.PARCEL_SCANNED`, `LOCAL.PARCEL_RECORD_PERSISTED` (EVENTUAL 30s), `APP.SESSION_ISOLATION_ASSERTED` |
| Release isolation | `automationOnly: true`, `releaseGuard: automationRelease=false` |
| IR steps | 7 |

Kamera test host'undan sürülemez, bu yüzden scan payload App Adapter seam'i ile
enjekte edilir. Bu, pack'teki en tehlikeli seam'dir: çağırana "şu barkodu
okudun" dedirtir. Shipped build'de kalırsa hiç yapılmamış bir okutmayı herkes
iddia edebilir.

Enjeksiyon step'i `role: SETUP` ve `outputFactBindings: []`'dir — **kendi kanıtını
üretemez**. Kanıt, ürünün kendi reaksiyonudur: `APP.PARCEL_SCANNED` (critical
event) ve `APP.PARCEL_STATE_PROCESSED` (state projection).

### 3.5 COMPLETE_DELIVERY

| Alan | Değer |
|---|---|
| Macro | `nesy.macro.complete-delivery` |
| Final Oracle | `REMOTE.DELIVERY_CONFIRMED` (REQUIRED/EVENTUAL 120s → **INCONCLUSIVE**), `REMOTE.DELIVERY_STATUS_COMPLETED` (EVENTUAL 120s), `APP.DELIVERY_SUBMITTED` (IMMEDIATE/FAIL), `LOCAL.OFFLINE_QUEUE_ITEM_WAITING` (OPTIONAL) |
| IR steps | 7, bir `SWITCH` (online/queued) |

Kuryeler sinyalin olmadığı yerde çalışır. İki yanlış modelleme:

1. Queue'yu ayrı plane yapmak → her yeni local mekanizma Core değişikliği ister.
   Burada `LOCAL` + `OFFLINE_QUEUE_WATCH`.
2. Backend henüz onaylamadı diye FAIL vermek → suite tam olarak kuryenin
   çalıştığı koşullarda kullanılamaz hâle gelir. Burada EVENTUAL + `INCONCLUSIVE`:
   onaylanmamış teslim **çözümsüzdür**, başarısız değildir.

**HTTP 2xx yine teslim değildir.** `nesy.remote.delivery-transport-ack`
`transportSuccessOnly: true`, `authority: FALLBACK`, `factKey` **yok** — raw
response arşivlenir, sonuç çıkarılmaz. Karar `REMOTE.DELIVERY_CONFIRMED`'dir:
backend status + app'in submit event'inin `CORRELATED_ALL_OF`'u.

`SWITCH`'in `default: GOTO` olması zorunludur; default'suz bir switch sessizce
atlanan bir step'tir ve her raporda başarı gibi okunur (`MISSING_SWITCH_DEFAULT`).

### 3.6 TOUR_APPROVAL_LIFECYCLE — multi-actor

| Alan | Değer |
|---|---|
| Macro | `nesy.macro.tour-approval-lifecycle` |
| Actor 1 | Kurye, `nesy.end-of-day` ekranı, gerçek UI, Bridge |
| Actor 2 | Dispatcher, `nesy.backoffice` adapter, typed REMOTE_ACTION, `actorRole: DISPATCHER` |
| Final Oracle | `REMOTE.TOUR_APPROVAL_CONFIRMED` (EVENTUAL 180s), `REMOTE.TOUR_APPROVAL_REQUEST_CREATED` (EVENTUAL 60s), `REMOTE.TOUR_APPROVAL_STATUS_APPROVED` (EVENTUAL 120s), `APP.TOUR_APPROVAL_REQUESTED` (IMMEDIATE/FAIL), `APP.TOUR_APPROVAL_PUSH_RECEIVED` (**WARNING**) |
| IR steps | 9 (3 REMOTE_ACTION + CLEANUP) |

Süreç tam olarak **devretmedir**; yalnız telefonu süren bir test butonun
çalıştığını kanıtlar, iş sürecini kanıtlamaz.

**HTTP 2xx onay değildir.** `nesy.backoffice.approve-tour-request`
`transportSuccessOnly: true` ve `outputs: []`. Çağrının kabul edilmesi kaydın
onaylanması değildir: istek kuyruğa girebilir, downstream bir kural reddedebilir,
ya da başka bir kayda uygulanabilir.

Business success üç gözlem ister:

```text
APP.TOUR_APPROVAL_REQUESTED            kurye gerçekten istedi
REMOTE.TOUR_APPROVAL_REQUEST_CREATED   kayıt gerçekten oluştu      (backend fact 1)
REMOTE.TOUR_APPROVAL_STATUS_APPROVED   o kayıt gerçekten APPROVED  (backend fact 2)
    ↓ CORRELATED_ALL_OF (approvalRequestCode)
REMOTE.TOUR_APPROVAL_CONFIRMED
```

Correlation, dünkü koşudan ya da başka bir kuryeden kalan bir onayın bugünün
oracle'ını karşılamasını engeller.

Push `CONFIRMATORY`'dir ve wait `onTimeout: CONTINUE` kullanır. Push teslimi
meşru olarak güvenilmezdir; REQUIRED gate olsa suite ürün hakkında değil bildirim
altyapısı hakkında kırmızı verirdi.

**Setup modu ayrı bir testtir.** Başka slice'lar precondition olarak onaylı tur
isteyebilir: bu `nesy.launch.direct-state`, `producesProductVerdict: false`. Bir
onayı ayarlamak, onaylamanın çalıştığının kanıtı değildir.

**Adapter sınırı.** `nesy.backoffice` operasyonlarının tamamı allowlisted, typed
ve audited'dır. `url`/`method`/`headers`/`body`/`script` gibi bir alan **hiçbir
yerde yoktur** (`FORBIDDEN_REMOTE_OPERATION_FIELDS`), her mutation
`recordRequest: true` ve `allowedEnvironments` taşır, `approve-tour-request`
`KEYED` idempotency + `RECONCILE_BEFORE_RELEASE` ile çift onayı engeller.

## 4. Nesy App Adapter sınırı

| Adapter yapabilir | Adapter yapamaz |
|---|---|
| `NAMED_QUERY` (bounded projection) | workflow branch engine |
| `STATE_PROJECTION` | UI action executor |
| `CRITICAL_EVENT_STREAM` | business decision runner |
| `SESSION_PREPARATION` | görünmez backend mutation hook |
| `DIRECT_STATE_PREPARATION` | raw HTTP / script runner |
| `SCANNER_INJECTION` | ikinci otomasyon motoru |
| `ENTITY_TARGET_BINDING` | |
| `RELEASE_ISOLATION_ASSERTION` | |

Sağ kolon `FORBIDDEN_APP_ADAPTER_CAPABILITY_KINDS` olarak veri hâlindedir ve
`FORBIDDEN_ADAPTER_CAPABILITY` issue'su üretir. Adapter branch alabilseydi, ürünün
içinde Cockpit'te görünmeyen, app ile versiyonlanan ve tam iş karmaşıklaştığında
Cockpit ile anlaşmazlığa düşen ikinci bir motor olurdu.

Named query ref'leri: `nesy.availableStops`, `nesy.stopState`, `nesy.taskState`,
`nesy.parcelState`, `nesy.pendingOperation`, `nesy.sessionState`,
`nesy.routeState`.

Mutating her seam `automationOnly: true` + isimli `releaseGuard` taşır
(`ADAPTER_SEAM_NOT_ISOLATED` aksi hâlde). `RELEASE_ISOLATION_ASSERTION`
bilinçli olarak automation-only **değildir**: shipped build'de çağrılabilmezse
diğer seam'lerin gitmiş olduğunu kanıtlayamaz.

## 5. Fixture'lar

`domain-packs/nesy-courier/fixtures/` — `scripts/write-fixtures.mjs` tarafından
pack'in kendi tanımlarından üretilir, `src/fixtures.test.ts` tarafından geri
okunup karşılaştırılır. Drift eden bir fixture CI'da kırmızı verir; sessizce
artık var olmayan bir pack'i belgelemez.

| Fixture | Rol |
|---|---|
| `courier-login.reference.json` | COURIER_LOGIN slice |
| `select-route.reference.json` | SELECT_ROUTE slice |
| `open-stop.reference.json` | OPEN_STOP slice |
| `process-parcel.reference.json` | PROCESS_PARCEL slice |
| `complete-delivery.reference.json` | COMPLETE_DELIVERY slice |
| `tour-approval-lifecycle.reference.json` | TOUR_APPROVAL_LIFECYCLE slice |
| `invalid-setup-produces-verdict.json` | `SETUP_LAUNCH_PRODUCES_VERDICT` |
| `invalid-row-index-primary-target.json` | `ROW_INDEX_AS_IDENTITY` |
| `invalid-http-2xx-business-success.json` | `TRANSPORT_SUCCESS_AS_BUSINESS_FACT` + `TRANSPORT_SUCCESS_PRIMARY` |
| `invalid-domain-execution-leakage.json` | `EXECUTION_PLANE_LEAKAGE` |

Negatif fixture'ların dördü de validator'dan geçirilir — kontrol edilmeyen bir
negatif fixture test değil, dosyadır.

## 6. Phase 4C'ye devredilen

```text
Domain macro → Generic WorkflowIR v2 production compiler
Generic WorkflowIR v2 → BridgeFlowPlan + UiWaitPlan
Compile API + preview + capability-aware error
```

Phase 4C tüketecekleri:

- `DomainPackManifest` + registry'ler (`buildNesyCourierBundle()`)
- 8 `MacroDefinition`, 6'sı `expansionSnapshot` + `bridgeFlowPlanSnapshot` ile
- `EvidenceSourceDefinition` × 35 + `DerivedFactGraph` × 4
- `LaunchProfile` × 4, `TestProfileDefinition` × 4
- Bundle digest / provenance (`computeBundleDigest`, `publishBundle`)
- `AppAdapterCompatibility` + `AppAdapterCapabilityDeclaration`

Compiler yazıldığında `MacroExpansionSnapshot.authoredBy` `COMPILER` olur ve bu
dosyadaki snapshot'lar regression baseline'ı hâline gelir.
