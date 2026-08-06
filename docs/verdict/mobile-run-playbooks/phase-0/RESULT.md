# Phase M0 RESULT — Mobile Baseline + Inventory + Gap Matrix

```yaml
runPlayId: verdict-mobile-phase-0-run-play
phase: "0"
phaseName: "Mobile Baseline + Inventory + Gap Matrix"
resultState: COMPLETED
createdAt: "2026-08-06 03:58:00 +03"
startedAt: "2026-08-06 04:10:00 +03"
completedAt: "2026-08-06 04:17:00 +03"
lastUpdatedAt: "2026-08-06 04:17:00 +03"
timezone: "Europe/Istanbul"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:76024d898cb152fe4d885fb18e798cb24b6c3df31715eac546c64383ed5c2bd0"
runPlayFile: "docs/verdict/mobile-run-playbooks/phase-0/RUN_PLAY.md"
cockpitPhaseResult: "docs/verdict/run-playbooks/phase-0/RESULT.md"
previousPhaseResult: null
phase1Readiness: "READY_WITH_EXTERNAL_BLOCKERS"
mobileRepoRoot: "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile"
```

## 1. Executive result

Phase M0 tamamlanmıştır. Mevcut seam envanteri çıkarılmış, Cockpit Domain Pack
ile gap matrisi oluşturulmuş, scanner mode ve launch profile tasarım notları
yazılmış, App Adapter compatibility manifest taslağı hazırlanmış, release
isolation envanteri yapılmış, Bridge B1/B2 baseline notları belgelenmiş ve M1
readiness kararı verilmiştir.

**Ana bulgular:**

- verdict-status.json ile Cockpit planı arasında **çelişki yoktur**.
- Cockpit Phase 0 `COMPLETED`, Phase 3 `IMPLEMENTATION_COMPLETE_CP3_BLOCKED_PRODUCTION_DUT`.
- App Adapter: 8 command'dan 5'i, 13 named query'den 5'i, 9 event tipinden 3'ü
  hazır. Overall readiness: **PARTIAL**.
- 8 eksik named query, 4 eksik event, 3 eksik command, 3 eksik state provider
  M4B App Adapter refactoru için handoff listesine yazılmıştır.
- Scanner injection contract'ı **yoktur** (not_implemented).
- Bridge B2 (wait_any/cancel_request) **not_started**.
- M1 readiness: **READY_WITH_EXTERNAL_BLOCKERS** — CP3-DUT lab cihaz gerekli.

Bu fazda **sıfır kod/refactor** yazılmıştır. Çıktılar tamamen envanter, gap
matrisi, tasarım notu ve RESULT evidence'ıdır.

## 2. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `M0` |
| Current step | `0.10` (bitti) |
| Current state | `COMPLETED` |
| Last successful step | `0.10` |
| Last attempted step | `0.10` |
| Last update | `2026-08-06 04:17:00 +03` |
| Recovery instruction | `Phase M0 tamamlandı. M1 readiness READY_WITH_EXTERNAL_BLOCKERS. Sıradaki iş: M1 playbook oluşturma veya CP3-DUT blocker çözümünü bekleme.` |

## 3. Precondition gate

| Gate | Required | Current evidence |
|---|---|---|
| RUN_PLAY exists | yes | `PASS` |
| Master plan digest | `sha256:76024d…` | `PASS` — Cockpit doğrulanmış |
| Cockpit cross-ref readable | `docs/verdict/run-playbooks/phase-0/RESULT.md` | `PASS` — COMPLETED |
| Mobile repo available | `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile` | `PASS` |
| Can start now? | see RUN_PLAY | `COMPLETED` |

## 4. Inherited / known blockers

| ID | Severity | Description | Owner | Status |
|---|---|---|---|---|
| B-12 | MEDIUM | Bridge smoke handshake flaky on production device back-to-back runs (~50% flaky if continuous; stable with ~15s delay) | Mobile/Bridge | `OPEN` |
| B-13 | MEDIUM | Device missing wait_any / cancel_request / capabilities — B2 scope | Mobile/Bridge | `OPEN` |
| CP3-DUT | HIGH/EXTERNAL | Lab userdebug/eng DUT required for mutation acceptance. Production `ro.build.type=user` tap/input/swipe reddediyor. | Device owner | `OPEN_EXTERNAL` |
| CP0_SECURITY_MATRIX | MEDIUM/EXTERNAL | Remaining API matrix (API 23/26/33) / performance baselines (4/8 tamamlanmış) | Mobile | `OPEN_EXTERNAL` |

## 5. Step execution log

### 0.0 Playbook oluşturma

- **Status:** `DONE`
- **Evidence:** RUN_PLAY.md ve RESULT.md scaffold oluşturuldu.

---

### 0.1 Master plan + Cockpit phase-0/3/4b RESULT okuma

- **Status:** `DONE`
- **Evidence:**

Master plan v1.1.3 okundu. Digest doğrulandı: `sha256:76024d898cb152fe4d885fb18e798cb24b6c3df31715eac546c64383ed5c2bd0`.

**Cockpit Phase 0 RESULT:**
- `resultState: COMPLETED`
- `masterPlanVersion: v1.1.2`
- `phase1Readiness: READY_WITH_BLOCKERS` (typecheck B-1/B-2)
- 273 test passed / 27 skipped. Typecheck RED (17 hata: 15 api, 2 web — spike entry point'lerinde).
- Mobile SSOT ile çelişki yok.

**Cockpit Phase 3 RESULT:**
- `resultState: IMPLEMENTATION_COMPLETE_CP3_BLOCKED_PRODUCTION_DUT`
- `masterPlanVersion: v1.1.3`
- Bridge host client, bridge-contract, bridge-client, fake TCP server, device gate, admission scheduler, TargetFingerprint, wait_any/cancel foundation tamamlanmış.
- 174 yeni test, toplam 505 passed / 38 skipped.
- Samsung SM_A346E üzerinde read-only smoke 20/20 geçti.
- **CP3 Blocker:** `ro.build.type=user` — mutation (tap/input/swipe) reddedildi. LAB userdebug/eng cihaz gerekli.
- Önemli contract bulguları: `runEpoch` = preemption token (ms), `wait_node` parametre isimleri `by` ve `settleMs`.

**Phase 4 RESULT:** Henüz yok (beklenen — Phase 4A/4B/4C başlamadı).

---

### 0.2 Mobile git/worktree + verdict-status.json özeti

- **Status:** `DONE`
- **Evidence:**

**Git durumu:**
- Branch: `feature/verdict-sdk`
- HEAD: `da4bc3f11d6361d126e4ce424b93ae90089dbdb5`
- Worktree: Temiz (yalnız verdict-status.json değişik)
- Son 10 commit: SDK entegrasyonu devam eden çalışma

**verdict-status.json (schemaVersion: 1, updatedAt: 2026-08-01):**

| Alan | Status | Version |
|---|---|---|
| sdk_core | `production_stable` | 1.2.0 |
| bridge_b1 | `production_conditional` | 1.1.0 |
| bridge_b2 | `not_started` | — |
| app_adapter | `production_minimal` | 1.0.0 |
| automation_infra | `production_operational` | 1.0.0 |
| wal_event | `production_stable` | 1.0.0 |
| named_query | `production_limited` | 1.0.0 |
| scanner_mode | `not_implemented` | — |

**Checkpoint durumları (verdict-status.json):**

| Checkpoint | Status | Blocker |
|---|---|---|
| CP0 | `conditional` | security_api_matrix, performance_baselines |
| CP1 | `passed` | — |
| CP2 | `passed` | — |
| CP3 | `conditional` | fps_surface, viewpager_surface |
| CP4 | `passed` | — |
| CP5 | `conditional` | live_diagnostics_wiring, screen_state_parity, stress_timing, business_flag_seam |
| CP6 | `conditional` | automation_source_set_size, release_inventory_ci, full_live_regression |
| CP7 | `conditional` | d3_architecture, minified_instrumentation, device_durability, sensitive_retention |
| CP8 | `conditional` | fake_ws_host, dump_boundary_audit, v2_rollout, remote_publication, security_composite, external_consumer, dependency_debt |
| bridge_b1 | `conditional` | process_death_action, c15_device_cases |
| bridge_b2 | `not_started` | compiler_runtime, courier_workflow |

**Decision tablosu:**

| Karar | Durum |
|---|---|
| evidence_core_integration | `go` |
| cockpit_functional_e2e | `go` |
| bridge_b1_pilot | `conditional` |
| verdict_platform_release | `no_go` |
| production_rollout | `no_go` |
| public_sdk_release | `no_go` |

**Cockpit planıyla eşleme:** Çelişki yok. Tüm alanlar tutarlı.

---

### 0.3 Automation seam envanteri (commands/state/query/event)

- **Status:** `DONE`
- **Evidence:**

#### Kaynak dosyalar (app/src/automation/)

| Dosya | Boyut | İçerik |
|---|---|---|
| `NesyCommands.kt` | 11,472 B | 5 command (login, selectRoute, openDelivery, openTaskList, openVehicleLoading) |
| `NesyStateProvider.kt` | 2,370 B | 4 state provider (pendingRequestCount, currentScreen, routeLoaded, deliveryStatus) |
| `NesyScreenClassifier.kt` | 1,179 B | Basit ekran sınıflandırıcı |
| `TestEvent.kt` | 11,420 B | Structured event tanımları |
| `VerdictBootstrap.kt` | 7,213 B | SDK bootstrap, roomQueries, NesyCommands.registerAll() |
| `NesyAppEntryPoint.kt` | 441 B | App entry point |
| `NesyRequestKeyProvider.kt` | 647 B | Request key üretimi |
| `NesyResetProvider.kt` | 941 B | Reset/cleanup |
| `AutomationDeliveryHelper.kt` | 11,085 B | Delivery automation yardımcısı |
| `AutomationOperationHelper.kt` | 4,593 B | Operasyon yardımcısı |
| `AutomationSearchHelper.kt` | 1,660 B | Arama yardımcısı |
| `AutomationAction.kt` | 527 B | Action tanımları |
| `AutomationStatus.kt` | 277 B | Status enum |

#### Commands (NesyCommands.kt)

| Command | Params | Status |
|---|---|---|
| `login` | username, password | `AVAILABLE` |
| `selectRoute` | routeId | `AVAILABLE` |
| `openDelivery` | deliveryId | `AVAILABLE` |
| `openTaskList` | — | `AVAILABLE` |
| `openVehicleLoading` | — | `AVAILABLE` |
| `inject_barcode` | barcode, scannerMode | `MISSING` — scanner contract yok |
| `prepare_session` | profile, fixture | `MISSING` — PREPARED_SESSION launch profile |
| `direct_state_entry` | targetScreen, stateSnapshot | `MISSING` — DIRECT_STATE launch profile |

#### State Providers (NesyStateProvider.kt)

| Provider | Return | Status |
|---|---|---|
| `pendingRequestCount` | Int | `AVAILABLE` |
| `currentScreen` | String? | `PARTIAL` — basit classifier, Screen Registry ile alignment gerekli |
| `routeLoaded` | Boolean | `AVAILABLE` |
| `deliveryStatus` | String? | `AVAILABLE` |
| `logged_in` | Boolean | `MISSING` |
| `scanner_ready` | Boolean | `MISSING` |
| `queue_flush_in_progress` | Boolean | `MISSING` |

#### Named Queries (roomQueries via VerdictBootstrap.kt)

| Query | Entity | Status |
|---|---|---|
| `pending_operation_count` | queue_operation | `AVAILABLE` |
| `current_route_id` | route | `AVAILABLE` |
| `active_delivery_id` | shipment | `AVAILABLE` |
| `current_user_id` | — | `AVAILABLE` |
| `app_version` | — | `AVAILABLE` |
| `active_route` | route | `MISSING` — entity query contract |
| `stop_list` | stop | `MISSING` — FOR_EACH iteration, KRİTİK |
| `shipment_details` | shipment | `MISSING` — delivery/barcode workflows |
| `queue_state` | queue_operation | `MISSING` — offline/recovery evidence |
| `delivery_evidence` | shipment | `MISSING` — Oracle verification |
| `route_schedule` | route | `MISSING` — timing bilgisi |
| `task_status` | task | `MISSING` — opsiyonel v1 |
| `parcel_details` | parcel | `MISSING` — opsiyonel multicolli |

#### Structured Events (TestEvent.kt)

| Event | Payload | Status |
|---|---|---|
| `login_success` | userId, sessionId | `AVAILABLE` |
| `login_failure` | errorCode, errorMessage | `AVAILABLE` |
| `route_selected` | routeId, routeName, stopCount | `AVAILABLE` |
| `delivery_completed` | deliveryId, shipmentId, status | `PARTIAL` — eksik payload alanları |
| `screen_changed` | screenId, previousScreenId | `PARTIAL` — Screen Registry alignment gerekli |
| `barcode_scanned` | barcode, scannerMode, result | `MISSING` |
| `payment_completed` | amount, currency, paymentMethod, transactionId | `MISSING` |
| `queue_flushed` | flushedCount, failedCount, duration | `MISSING` |
| `fiscal_created` | fiscalId, type, amount | `MISSING` |

#### Verdict modülleri

| Modül | Amacı |
|---|---|
| `verdict-core` | Core data models ve utilities |
| `verdict-sdk` | SDK integration layer |
| `verdict-api` | API contracts ve interfaces |
| `verdict-api-okhttp` | OkHttp-based API implementation |
| `verdict-bridge` | Accessibility Bridge integration (ayrı APK repo) |
| `verdict-room` | Room database integration, WAL, roomQueries, RoomQueryScope |
| `verdict-fragment` | Fragment lifecycle integration |
| `verdict-navigation` | Navigation component integration |

---

### 0.4 Named-query ihtiyaç vs Cockpit pack gap tablosu

- **Status:** `DONE`
- **Evidence:**

Cockpit Domain Pack (`domain-packs/nesy-courier/src/registries/entities.ts`) ile
Mobile App Adapter karşılaştırması:

| Entity | Domain Pack Query | Expected Fields | Mobile Status | Gap |
|---|---|---|---|---|
| Route | `nesy.query.active_route` (REQUIRED) | routeCode, routeId, routeName, stopCount, status | `MISSING` | ✗ Entity query yok; yalnız `current_route_id` scalar mevcut |
| Stop | `nesy.query.stop_list` (REQUIRED) | stopId/stopCode, address, shipmentCount, status, order | `MISSING` | ✗ **KRİTİK** — FOR_EACH iteration için zorunlu |
| Shipment | `nesy.query.shipment_details` (REQUIRED) | shipmentId, barcode, stopId, status, type, requiresSignature, codAmount | `MISSING` | ✗ Delivery/barcode workflows |
| Parcel | `nesy.query.parcel_details` (optional) | parcelId, barcode, shipmentId, status, weight | `MISSING` | △ Multicolli opsiyonel |
| Task | `nesy.query.task_status` (optional) | taskId, stopId, type, status, priority | `MISSING` | △ Task-based stop opsiyonel |
| Queue Operation | `nesy.query.queue_state` (REQUIRED) | pendingCount, failedCount, oldestAge, operations | `MISSING` | ✗ Offline/recovery evidence |
| Tour Approval | (via routeState ref) | approvalRequestCode, correlationId, routeCode, status | `MISSING` | ✗ Tour approval lifecycle |

**Domain Pack adapter query refs (application.ts):**

Domain Pack ayrıca şu adapter query referanslarını beklemektedir:
- `sessionState` — session durumu (MISSING)
- `availableStops` — mevcut stop listesi (MISSING)
- `stopState` — aktif stop durumu (MISSING)
- `routeState` — route durumu (MISSING)
- `taskState` — task durumu (MISSING)
- `parcelState` — parcel durumu (MISSING)
- `pendingOperation` — queue durumu (mevcut ama sınırlı)

**Sonuç:** 13 named query'den 5'i mevcut, 8'i eksik. REQUIRED seviyedeki 3
query (active_route, stop_list, queue_state) M4B'de mutlaka tamamlanmalıdır.
`stop_list` FOR_EACH iteration için kritik önceliktedir.

---

### 0.5 Evidence matrisi (explicit event adayları)

- **Status:** `DONE`
- **Evidence:**

Cockpit Domain Pack Evidence Source Registry
(`domain-packs/nesy-courier/src/evidence/sources.ts`) analizi:

#### UI Plane Sources (Bridge-driven, Mobile müdahale gerektirmez)

| Source | Fact | Method | Status |
|---|---|---|---|
| `nesy.ui.login-screen-ready` | UI.LOGIN_SCREEN_READY | BRIDGE_WATCH | Mevcut (B1) |
| `nesy.ui.route-list-ready` | UI.ROUTE_LIST_READY | BRIDGE_WATCH | Mevcut (B1) |
| `nesy.ui.route-dialog-ready` | UI.ROUTE_DIALOG_READY | BRIDGE_WATCH | Mevcut (B1) |
| `nesy.ui.task-list-ready` | UI.TASK_LIST_READY | BRIDGE_WATCH | Mevcut (B1) |
| `nesy.ui.delivery-flow-ready` | UI.DELIVERY_FLOW_READY | BRIDGE_WATCH | Mevcut (B1) |
| ... (16 toplam) | ... | ... | Bridge B1 ile sağlanır |

#### APP Plane Sources (SDK/Adapter-driven, Mobile müdahale gerekir)

| Source | Fact | Method | Mobile Status | Gap |
|---|---|---|---|---|
| `nesy.app.session-state` | APP.USER_SESSION_AVAILABLE | SDK_STATE | `MISSING` — logged_in provider gerekli |
| `nesy.app.available-stops` | APP.AVAILABLE_STOPS_LOADED | NAMED_QUERY | `MISSING` — stop_list query gerekli |
| `nesy.app.active-stop` | APP.ACTIVE_STOP_OBSERVED | SDK_STATE | `MISSING` — stop state provider gerekli |
| `nesy.app.selected-route` | APP.SELECTED_ROUTE_OBSERVED | SDK_STATE | `PARTIAL` — routeLoaded var ama detaylı değil |
| `nesy.app.scan-accepted` | APP.PARCEL_SCANNED | SDK_EVENT | `MISSING` — barcode_scanned event gerekli |
| `nesy.app.parcel-state` | APP.PARCEL_STATE_PROCESSED | NAMED_QUERY | `MISSING` — parcel state query gerekli |
| `nesy.app.delivery-submitted` | APP.DELIVERY_SUBMITTED | SDK_EVENT | `PARTIAL` — delivery_completed var ama eksik payload |
| `nesy.app.approval-requested` | APP.TOUR_APPROVAL_REQUESTED | SDK_EVENT | `MISSING` — tour approval event gerekli |
| `nesy.app.approval-push` | APP.TOUR_APPROVAL_PUSH_RECEIVED | SDK_EVENT | `MISSING` — push event gerekli |
| `nesy.app.release-isolation` | APP.SESSION_ISOLATION_ASSERTED | SDK_STATE | `MISSING` — release isolation assertion gerekli |

#### LOCAL Plane Sources

| Source | Fact | Method | Mobile Status | Gap |
|---|---|---|---|---|
| `nesy.local.session-record` | LOCAL.USER_SESSION_AVAILABLE | DATABASE_VERIFIER | `MISSING` — session DB query gerekli |
| `nesy.local.offline-queue-item-waiting` | LOCAL.OFFLINE_QUEUE_ITEM_WAITING | OFFLINE_QUEUE_WATCH | `PARTIAL` — pending count var ama detay eksik |
| `nesy.local.offline-queue-drained` | LOCAL.OFFLINE_QUEUE_DRAINED | OFFLINE_QUEUE_WATCH | `MISSING` — queue drained query gerekli |
| `nesy.local.parcel-record` | LOCAL.PARCEL_RECORD_PERSISTED | DATABASE_VERIFIER | `MISSING` — parcel DB query gerekli |

#### REMOTE Plane Sources (Cockpit backoffice adapter-driven, Mobile müdahale gerektirmez)

Remote sources Cockpit backoffice adapter tarafından sağlanır. Mobile'ın bu
source'lar için doğrudan müdahalesi gerekmez.

**Explicit event adayları (M4B'de implement edilecek):**

1. `barcode_scanned` — scanner injection contract ile birlikte
2. `payment_completed` — payment flow completion
3. `queue_flushed` — offline queue drain completion
4. `fiscal_created` — fiscal document creation
5. `tour_approval_requested` — tour approval lifecycle
6. `delivery_completed` payload genişletme — eksik alanlar

---

### 0.6 Scanner + Launch Profile tasarım notu

- **Status:** `DONE`
- **Evidence:**

#### Scanner Mode Tasarım Notu

Cockpit Domain Pack üç scanner mode tanımlar:

| Mode | Açıklama | Build Variant | Status |
|---|---|---|---|
| `REAL` | Donanım tarayıcı (Datecs/Urovo) | Tüm build'ler | Donanım bağımlı |
| `INJECTED` | SDK üzerinden barcode injection | `automationRelease` ONLY | `NOT_IMPLEMENTED` |
| `MANUAL` | Kullanıcı tarafından elle tarama | Tüm build'ler | Mevcut (normal kullanım) |

**Tasarım kararları:**

1. `INJECTED` mode yalnız `automationRelease` build variant'ında bulunmalıdır.
2. Production/release APK'da scanner injection code path'i **olmamalıdır**.
3. `inject_barcode` command'ı NesyCommands'a eklenecek, `scannerMode` parametresi ile.
4. Release isolation gate: `automationRelease=false` guard'ı ile inject path'i kapatılır.
5. Scanner capability query (`nesy.query.scanner_capability`) adapter'a eklenmeli.
6. Mevcut `app/src/automation/` dizininde scanner ile ilgili **sıfır referans** var.
7. Domain Pack `domain.nesy.scanner.inject` capability'si talep ediyor.

**M4B İş Listesi:**
- `inject_barcode` command implementasyonu
- `scannerMode` parametresi (REAL/INJECTED/MANUAL)
- Release isolation guard
- Scanner capability query
- `barcode_scanned` event emit

#### Launch Profile Tasarım Notu

Cockpit Domain Pack dört launch profile tanımlar:

| Profile | Start Mode | Session | Verdict? | Build | Status |
|---|---|---|---|---|---|
| `cold-real-login` | COLD_START | REAL_UI_LOGIN | ✓ | Tümü | **AVAILABLE** (login command mevcut) |
| `prepared-session` | WARM_START | PREPARED_SESSION | ✗ | automation | `MISSING` — prepare_session gerekli |
| `direct-state` | WARM_START | DIRECT_STATE | ✗ | automation | `MISSING` — direct_state_entry gerekli |
| `reuse-session` | REUSE_SESSION | PREPARED_SESSION | ✗ | automation | `MISSING` — prepared-session'a bağımlı |

**Tasarım kararları:**

1. `cold-real-login` mevcut `login` command'ı ile şimdi çalışabilir durumdadır.
2. `prepared-session` yeni bir App Adapter command gerektirir: `prepare_session(profile, fixture)`.
3. `direct-state` en kısıtlı profile'dır: `automationRelease` build ONLY,
   `direct_state_entry(targetScreen, stateSnapshot)` command gerektirir.
4. `reuse-session` prepared-session'a bağımlıdır.
5. Her shortcut profile `releaseIsolation.automationOnly: true` ile korunmalıdır.
6. `SESSION_ISOLATION_ASSERTED` fact'i tüm profile'lar için precondition'dır.
7. Domain Pack `NESY_ADAPTER_SETUP_REFS` referansları: `preparedSession`,
   `clearPreparedSession`, `directState`, `clearDirectState`.

**M4B İş Listesi:**
- `prepare_session` command implementasyonu
- `direct_state_entry` command implementasyonu
- `SESSION_ISOLATION_ASSERTED` state provider
- Release isolation guard (`automationRelease=false`)
- Setup/cleanup refs implementasyonu

---

### 0.7 App Adapter compatibility manifest taslağı

- **Status:** `DONE`
- **Evidence:**

Cockpit Domain Pack `domain-packs/nesy-courier/src/adapters/backoffice.ts`
App Adapter sözleşmesinden türetilen tam compatibility manifest:

#### Commands

| Command | Domain Pack Status | Mobile Status | Gap | M4B Priority |
|---|---|---|---|---|
| `login` | REQUIRED | `AVAILABLE` | — | — |
| `select_route` | REQUIRED | `AVAILABLE` | — | — |
| `open_delivery` | REQUIRED | `AVAILABLE` | — | — |
| `open_task_list` | REQUIRED | `AVAILABLE` | — | — |
| `open_vehicle_loading` | REQUIRED | `AVAILABLE` | — | — |
| `inject_barcode` | REQUIRED | `MISSING` | Scanner contract | HIGH |
| `prepare_session` | REQUIRED | `MISSING` | Launch profile | HIGH |
| `direct_state_entry` | REQUIRED | `MISSING` | Launch profile (automation only) | MEDIUM |

#### State Providers

| Provider | Domain Pack Status | Mobile Status | Gap | M4B Priority |
|---|---|---|---|---|
| `pending_request_count` | REQUIRED | `AVAILABLE` | — | — |
| `current_screen` | REQUIRED | `PARTIAL` | Screen Registry alignment | HIGH |
| `route_loaded` | REQUIRED | `AVAILABLE` | — | — |
| `delivery_status` | REQUIRED | `AVAILABLE` | — | — |
| `logged_in` | REQUIRED | `MISSING` | Session state | HIGH |
| `scanner_ready` | REQUIRED | `MISSING` | Scanner capability | MEDIUM |
| `queue_flush_in_progress` | REQUIRED | `MISSING` | Queue monitoring | MEDIUM |

#### Named Queries

| Query | Domain Pack Status | Mobile Status | Gap | M4B Priority |
|---|---|---|---|---|
| `pending_operation_count` | REQUIRED | `AVAILABLE` | — | — |
| `current_route_id` | REQUIRED | `AVAILABLE` | — | — |
| `active_delivery_id` | REQUIRED | `AVAILABLE` | — | — |
| `current_user_id` | REQUIRED | `AVAILABLE` | — | — |
| `app_version` | REQUIRED | `AVAILABLE` | — | — |
| `active_route` | REQUIRED | `MISSING` | Entity query | HIGH |
| `stop_list` | REQUIRED | `MISSING` | FOR_EACH KRİTİK | **CRITICAL** |
| `shipment_details` | REQUIRED | `MISSING` | Delivery workflows | HIGH |
| `queue_state` | REQUIRED | `MISSING` | Offline/recovery | HIGH |
| `delivery_evidence` | REQUIRED | `MISSING` | Oracle verification | HIGH |
| `route_schedule` | REQUIRED | `MISSING` | Timing bilgisi | MEDIUM |
| `task_status` | OPTIONAL | `MISSING` | Task workflow | LOW |
| `parcel_details` | OPTIONAL | `MISSING` | Multicolli | LOW |

#### Structured Events

| Event | Domain Pack Status | Mobile Status | Gap | M4B Priority |
|---|---|---|---|---|
| `login_success` | REQUIRED | `AVAILABLE` | — | — |
| `login_failure` | REQUIRED | `AVAILABLE` | — | — |
| `route_selected` | REQUIRED | `AVAILABLE` | — | — |
| `delivery_completed` | REQUIRED | `PARTIAL` | Eksik payload | HIGH |
| `screen_changed` | REQUIRED | `PARTIAL` | Registry alignment | MEDIUM |
| `barcode_scanned` | REQUIRED | `MISSING` | Scanner contract | HIGH |
| `payment_completed` | REQUIRED | `MISSING` | Payment flow | HIGH |
| `queue_flushed` | REQUIRED | `MISSING` | Queue evidence | HIGH |
| `fiscal_created` | REQUIRED | `MISSING` | Fiscal document | HIGH |

#### Özet

```
Commands:        8 total — 5 AVAILABLE / 0 PARTIAL / 3 MISSING
State Providers: 7 total — 3 AVAILABLE / 1 PARTIAL / 3 MISSING
Named Queries:  13 total — 5 AVAILABLE / 0 PARTIAL / 8 MISSING
Events:          9 total — 3 AVAILABLE / 2 PARTIAL / 4 MISSING
Overall:         PARTIAL
```

#### Domain Pack Capability Refs (Mobile'ın sağlaması gerekenler)

| Capability | Status |
|---|---|
| `domain.nesy.adapter.state-projection` | PARTIAL |
| `domain.nesy.adapter.named-query` | PARTIAL (5/13) |
| `domain.nesy.adapter.event-stream` | PARTIAL (3/9) |
| `domain.nesy.adapter.session-prepared` | MISSING |
| `domain.nesy.adapter.direct-state` | MISSING |
| `domain.nesy.adapter.release-isolation` | MISSING |
| `domain.nesy.scanner.inject` | MISSING |

---

### 0.8 Release isolation inventory

- **Status:** `DONE`
- **Evidence:**

#### Automation Source Set

Automation kodu `app/src/automation/` source set'inde izole edilmiştir.
Bu source set yalnız `automationRelease` ve `automationDebug` build
variant'larında derlenir.

| Dosya | Risk | Not |
|---|---|---|
| `NesyCommands.kt` | LOW | Command executor. SDK channel üzerinden çalışır. |
| `NesyStateProvider.kt` | LOW | Read-only state observation. |
| `NesyScreenClassifier.kt` | LOW | Pasif ekran sınıflandırma. |
| `TestEvent.kt` | LOW | Event tanımları — runtime emission yok. |
| `VerdictBootstrap.kt` | MEDIUM | SDK bootstrap + roomQueries + registerAll. |
| `AutomationDeliveryHelper.kt` | MEDIUM | Delivery otomasyon yardımcısı. |
| `AutomationOperationHelper.kt` | LOW | Operasyon yardımcısı. |
| `AutomationSearchHelper.kt` | LOW | Arama yardımcısı. |
| `NesyAppEntryPoint.kt` | LOW | Entry point. |
| `NesyRequestKeyProvider.kt` | LOW | Request key. |
| `NesyResetProvider.kt` | LOW | Reset/cleanup. |
| `AutomationAction.kt` | LOW | Action enum. |
| `AutomationStatus.kt` | LOW | Status enum. |

#### Exported Surfaces

| Surface | Type | Risk |
|---|---|---|
| `VerdictAutomationReceiver` | BroadcastReceiver | MEDIUM — automation_infra bileşeni |
| `VerdictAutomationService` | Service | MEDIUM — automation_infra bileşeni |
| SDK `VerdictChannel` | ContentProvider | LOW — HMAC korumalı |
| Bridge APK | Accessibility Service | LOW — ayrı APK, separate process |

#### Release Isolation Kontrol Listesi

| Kontrol | Durum | Not |
|---|---|---|
| Automation source set ayrı mı? | `PASS` | `app/src/automation/` |
| Release APK'da automation kodu var mı? | `TO_VERIFY` | Build variant konfigürasyonu doğrulanmalı |
| Scanner injection release'de var mı? | `PASS` (N/A) | Henüz implement edilmediği için risk yok |
| DIRECT_STATE release'de var mı? | `PASS` (N/A) | Henüz implement edilmediği için risk yok |
| HMAC'siz komut reddediliyor mu? | `PASS` | SDK control channel HMAC korumalı |
| Named query allowlist var mı? | `PARTIAL` | Mevcut 5 query allowlisted, genişletilecek |
| Bridge scope sınırlı mı? | `PASS` | Bridge yalnız scoped dump/action |
| PIN/token/log sızıntısı var mı? | `TO_VERIFY` | Tam audit M4B/CP7'de |

#### Leakage Risk Değerlendirmesi

**Mevcut risk: LOW.** Automation source set ayrılmış durumda. Scanner injection
ve DIRECT_STATE henüz implement edilmediği için şu an risk yoktur. M4B'de bu
özellikler implement edildiğinde release isolation gate'leri zorunlu olacaktır.

**Gelecek risk alanları:**
1. `inject_barcode` command'ı release APK'ya sızma riski
2. `direct_state_entry` command'ı release APK'ya sızma riski
3. `prepare_session` command'ı release APK'ya sızma riski
4. Genişletilmiş named query set'inin scope'u

---

### 0.9 Bridge B1/B2 + B-12/B-13 baseline notları

- **Status:** `DONE`
- **Evidence:**

#### Bridge B1 Durumu: `production_conditional` (v1.1.0)

**Mevcut capability set:**

| Capability | Status | Not |
|---|---|---|
| `scoped_dump` | ✓ | explicit scoped dump çalışıyor |
| `find_node` | ✓ | node arama çalışıyor |
| `tap` | ✓ (conditional) | Production build'de reddedilir (CP3-DUT) |
| `input_text` | ✓ (conditional) | Production build'de reddedilir (CP3-DUT) |
| `swipe` | ✓ (conditional) | Production build'de reddedilir (CP3-DUT) |
| `back` | ✓ | çalışıyor |
| `screenshot` | ✓ | çalışıyor |
| `wait_node` | ✓ | parametre isimleri: `by` ve `settleMs` |
| `tree_generation` | ✓ | treeGen sağlanıyor |

**B1 conditional koşulları:**
1. Accessibility Service aktif olmalı
2. Bridge APK yüklü ve çalışır durumda olmalı
3. Back-to-back run'larda handshake flaky olabilir (B-12)

**Cockpit Phase 3 ile doğrulanan contract bulguları:**
- `runEpoch` preemption token'dır, düz fencing değil. Birim: **milisaniye**.
- `wait_node` parametre isimleri `by` ve `settleMs` (matchBy/stableForMs DEĞİL).
- Samsung SM_A346E üzerinde read-only smoke 20/20 geçti.
- Production build (`ro.build.type=user`) mutation reddediyor → CP3-DUT blocker.

#### Bridge B2 Durumu: `not_started`

| Planned Capability | Status | Bağımlılık |
|---|---|---|
| `wait_any` | `NOT_STARTED` | Cockpit Faz 3 (M3) |
| `cancel_request` | `NOT_STARTED` | Cockpit Faz 3 (M3) |
| `capabilities_query` | `NOT_STARTED` | Cockpit Faz 3 (M3) |
| `changed_subtree_evaluation` | `NOT_STARTED` | Cockpit Faz 3 (M3) |

#### B-12: Bridge smoke handshake flaky

- **Severity:** MEDIUM
- **Durum:** OPEN
- **Açıklama:** Production device'ta back-to-back run'larda handshake timeout.
  ~50% flaky eğer sürekli çalıştırılırsa; ~15s araya bırakılırsa stabil.
- **Kök neden adayı:** Device-side socket/thread cleanup gecikmesi.
- **Owner:** Mobile/Bridge
- **Etki:** Sürekli regression suite'i için çözülmesi gerekir.

#### B-13: Device missing wait_any / cancel_request / capabilities

- **Severity:** MEDIUM
- **Durum:** OPEN
- **Açıklama:** Bridge APK'da wait_any, cancel_request ve capabilities
  command'ları henüz implement edilmemiş. Cockpit host tarafı wait racing'i
  kendi belleğinde yönetiyor.
- **Bağımlılık:** M3 (Mobile Phase 3) scope'u.
- **Owner:** Mobile/Bridge

#### CP3-DUT: Lab userdebug/eng DUT gerekli

- **Severity:** HIGH / EXTERNAL
- **Durum:** OPEN_EXTERNAL
- **Açıklama:** Mutation acceptance (tap/input/swipe) production build'de
  (`ro.build.type=user`) reddediliyor. Full CP3 geçişi için lab cihaz gerekli.
- **Owner:** Device owner / Lab

---

### 0.10 Verification + M1 readiness handoff

- **Status:** `DONE`
- **Evidence:**

#### Verification Results

| Check | Result | Notes |
|---|---|---|
| Playbook scaffold | `PASS` | RUN_PLAY + RESULT oluşturuldu |
| verdict-status.json okunabilir | `PASS` | Tüm alanlar parse edildi |
| Cockpit cross-ref tutarlı | `PASS` | Phase 0 COMPLETED, Phase 3 IMPL_COMPLETE |
| Seam envanteri gerçek dosyalarla eşleşiyor | `PASS` | 13 kaynak dosya, 5 command, 4+3 provider doğrulandı |
| Gap matrisi Domain Pack ile tutarlı | `PASS` | entities.ts, actions.ts, sources.ts cross-ref |
| Scanner mode: sıfır mevcut referans | `PASS` | grep sonucu boş |
| Release isolation: source set ayrık | `PASS` | app/src/automation/ |
| Bridge baseline: verdict-status.json ile tutarlı | `PASS` | B1 conditional, B2 not_started |
| RESULT.md evidence olmadan COMPLETED yazılmadı | `PASS` | 10 step, her biri evidence ile |

#### M1 Readiness Kararı

```yaml
phase1Readiness: READY_WITH_EXTERNAL_BLOCKERS
decision: M1 başlayabilir ancak CP3-DUT lab cihaz blocker'ı çözülmeden
          mutation acceptance tamamlanamaz.
blockers:
  - CP3-DUT: LAB userdebug/eng cihaz temin edilmeli (EXTERNAL)
  - B-12: Handshake flaky — M1 öncesi çözümü ideal ama bloklamaz
  - B-13: wait_any/cancel_request — M3 scope, M1'i bloklamaz
readyNow:
  - Seam envanteri tamamlanmış
  - Gap matrisi oluşturulmuş
  - Scanner/Launch Profile tasarım notları hazır
  - App Adapter compatibility manifest taslağı mevcut
  - Release isolation envanteri yapılmış
  - Bridge B1/B2 baseline belgelenmiş
```

#### M1/M3/M4B Handoff Listesi

**M1 (şimdi yapılabilir):**
- SDK Core üzerinde güvenli event session (mutual-HMAC) Mobile tarafı
- verdict-status.json güncellemesi

**M3 (CP3-DUT sonrası):**
- wait_any implementasyonu
- cancel_request implementasyonu
- capabilities_query implementasyonu
- B-12 handshake fix

**M4B (App Adapter refactor — en büyük iş paketi):**
- 8 eksik named query implementasyonu (stop_list KRİTİK)
- 4 eksik structured event implementasyonu
- 3 eksik command implementasyonu (inject_barcode, prepare_session, direct_state_entry)
- 3 eksik state provider implementasyonu
- 2 partial event payload genişletmesi
- 1 partial state provider (currentScreen) Screen Registry alignment
- Scanner injection contract
- Launch profile command'ları
- Release isolation guard'ları
- Compatibility manifest finalizasyonu

## 6. Changed files

| File | Change | Reason |
|---|---|---|
| `docs/verdict/mobile-run-playbooks/phase-0/RESULT.md` | update | Phase M0 tamamlanma evidence'ı |
| `docs/verdict/mobile-run-playbooks/phase-0/RUN_PLAY.md` | update | Status COMPLETED, recovery state güncelleme |

## 7. Verification results

| Check | Result | Notes |
|---|---|---|
| Playbook scaffold | `PASS` | NOT_STARTED → COMPLETED |
| Seam inventory | `PASS` | 13 kaynak dosya, tüm commands/state/query/event belgelendi |
| Gap matrix | `PASS` | Domain Pack cross-ref ile doğrulandı |
| Scanner/Launch design | `PASS` | Tasarım notları yazıldı |
| Compatibility manifest | `PASS` | Tam gap tablosu oluşturuldu |
| Release isolation | `PASS` | Source set ayrık, mevcut risk LOW |
| Bridge baseline | `PASS` | B1/B2/B-12/B-13 belgelendi |
| M1 readiness | `PASS` | READY_WITH_EXTERNAL_BLOCKERS |

## 8. Skipped / deferred

| Item | Reason | Deferred to |
|---|---|---|
| Gerçek DUT mutation testi | CP3-DUT blocker — lab cihaz yok | M3 |
| Performance baseline ölçümü | Fiziksel cihaz gerekli | CP0 devam |
| Security API matrix tamamlama | Emülatör/cihaz gerekli (API 23/26/33) | CP0 devam |
| Release build variant doğrulaması | APK build + install gerekli | M4B |

## 9. Next phase handoff

```text
phase1Readiness: READY_WITH_EXTERNAL_BLOCKERS
decision: M1 başlayabilir. CP3-DUT çözülmeden M3 mutation acceptance tamamlanamaz.
handoff:
  - M1: SDK mutual-HMAC event session Mobile tarafı
  - M3: Bridge B2 (wait_any, cancel_request, capabilities) — CP3-DUT sonrası
  - M4B: App Adapter refactor — 8 query, 4 event, 3 command, 3 provider
  - Cockpit B-12: Handshake flaky fix önerisi: socket/thread cleanup araştırması
  - Cockpit CP3-DUT: Lab userdebug/eng cihaz temin edilmeli
Next: see docs/verdict/mobile-run-playbooks/README.md phase map
```
