# Phase 5 RUN_PLAY — BridgeFlowExecutor, Oracle v2 and Durable Runtime

```yaml
runPlayId: verdict-cockpit-phase-5-run-play
phase: "5"
phaseName: "BridgeFlowExecutor + Continue Gate + Final Oracle v2 + Persistence"
status: NOT_STARTED
recoveryState: WAITING_FOR_PHASE_4C_COMPLETION
createdAt: "2026-08-05 14:34:57 +03"
startedAt: null
completedAt: null
lastUpdatedAt: "2026-08-05 14:34:57 +03"
timezone: "Europe/Istanbul"
masterPlanPath: "docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:76024d898cb152fe4d885fb18e798cb24b6c3df31715eac546c64383ed5c2bd0"
verifyMasterPlanCommand: "pnpm verdict:verify-master-plan"
previousPhaseResult: "docs/verdict/run-playbooks/phase-4c/RESULT.md"
resultFile: "docs/verdict/run-playbooks/phase-5/RESULT.md"
phase4CStatusRequired: "COMPLETED"
phase4CReadinessRequired: "READY_WITH_EXTERNAL_BLOCKERS"
phase5Target: "CHECKPOINT_5"
phase6ReadinessTarget: "READY_WITH_EXTERNAL_BLOCKERS"
blockingPreflight:
  - id: "PHASE_4C_NOT_COMPLETE"
    status: "BLOCKING"
    meaning: "Phase 5 başlamadan önce Phase 4C compiler output'ları gerçek kanıtla COMPLETED olmalı."
  - id: "CP3-DUT"
    status: "OPEN_EXTERNAL"
    meaning: "Real DUT mutation acceptance external. Phase 5 unit/integration runtime kurulabilir; gerçek cihaz mutation/cutover acceptance external blocker olarak taşınır."
  - id: "B-12"
    status: "OPEN_EXTERNAL"
    meaning: "Production cihaz smoke handshake flaky. Executor gerçek cihaz smoke testleri için blocker olabilir; local deterministic runtime testlerini bloklamaz."
  - id: "B-14"
    status: "OPEN_LOW"
    meaning: "runEpoch birimi Bridge protocol v2 içinde açık yazılmalı; executor correlation/persistence alanlarında belirsiz bırakılmamalı."
  - id: "B-8"
    status: "OPEN_NON_BLOCKING"
    meaning: "Repo-wide lint ESLint v9 flat-config borcu; Phase 5 yeni paketleri kendi lint/typecheck/test gate'lerinden geçmelidir."
```

## 1. Şu an hangi kısımdayız?

Phase 4A WorkflowIR v2 contract'ını dondurdu. Phase 4B Domain Pack contract'ını
ve Nesy Courier reference pack'i tamamladı. Phase 4C Domain-aware
BridgeFlowCompiler'ı üretir ve compiled `BridgeFlowPlan`, `UiWaitPlan`,
provenance, capability ve evidence binding çıktısını verir.

Phase 5, bu compiled output'u gerçek runtime'a bağlayan ilk fazdır.

```text
Phase 4A: WorkflowIR v2 + Condition Engine COMPLETE
Phase 4B: Domain Pack Contracts + Nesy Courier Reference Pack COMPLETE
Phase 4C: Domain-aware BridgeFlowCompiler MUST_BE_COMPLETED_FIRST
Phase 5: BridgeFlowExecutor + Oracle v2 + Durable Persistence READY_TO_PREPARE
Next after 5: Phase 6 Cockpit UI surfaces and Run Detail
```

Bu fazın işi **compiled plan'i güvenli, kalıcı, restart-safe ve kanıt odaklı
şekilde yürütmek**tir.

Bu fazın işi değildir:

- Maestro cutover yapmak.
- Eski Maestro engine'i kaldırmak.
- Phase 6 Cockpit UI ekranlarını yeniden tasarlamak.
- Domain Pack authoring UI yazmak.
- Nesy mobile repository içinde yeni SDK/Bridge business logic'i yazmak.
- CP3-DUT external blocker kapanmadan production cihaz release kabulü vermek.

## 1.1 AI agent'a verilecek başlangıç metni

Aşağıdaki prompt başka bir AI agent'a doğrudan verilebilir. Bu prompt Phase 5'in
büyük kapsamını yönetmek için bilerek ayrıntılıdır ve agent'ın Phase 4C bitmeden
yanlışlıkla runtime'a başlamasını engeller.

```text
Verdict Cockpit Phase 5'i uygula.

Önce şu dosyayı tamamen oku:
docs/verdict/run-playbooks/phase-5/RUN_PLAY.md

Sonra şu dosyayı oku:
docs/verdict/run-playbooks/phase-5/RESULT.md

Çalışmaya başlamadan önce Phase 4C gate'ini doğrula:
docs/verdict/run-playbooks/phase-4c/RESULT.md

Phase 4C RESULT içinde şu iki koşul yoksa Phase 5 implementasyonuna BAŞLAMA:
- resultState: COMPLETED
- phase5Readiness: READY_WITH_EXTERNAL_BLOCKERS

Bu koşullar yoksa sadece RESULT.md içinde BLOCKED_PRECONDITION olarak raporla,
hangi Phase 4C output'larının eksik olduğunu yaz ve dur.

Master planda özellikle şu bölümleri oku:
- D.8 BridgeFlowExecutor
- D.9 Oracle Engine v2
- D.10 Persistence ve API
- D.22 Domain Pack Contracts and Runtime
- D.24 Screen/Surface Registry UI/API dependency sınırları
- D.25 Launch Profile/Test Profile runtime dependency sınırları
- FAZ 5 — BridgeFlowExecutor, Oracle v2 ve Kalıcılık
- CHECKPOINT 5
- B.8 sonuç eksenleri
- B.10D wait_any / UiWaitPlan lifecycle
- B.16 Evidence Journey
- B.19 Continue Gate vs Final Oracle
- B.20 Evidence Source Registry and Local Reducer
- B.21 Target Resolution Provider Chain

Input contract'ları:
- packages/workflow-contract
- packages/domain-pack-contracts
- packages/bridgeflow-compiler
- packages/control-contract
- packages/bridge-contract
- domain-packs/nesy-courier
- apps/api Prisma schema/services/routes
- apps/web sadece compile/runtime DTO tüketimi için; Phase 6 UI redesign yapma

Phase 5'in hedefi:
Compiled BridgeFlowPlan'i step-by-step yürüten, occurrence/state/evidence/recovery
bilgisini kalıcılaştıran, Continue Gate ile Final Oracle'ı ayıran ve runtime
sonucunu lifecycle/business verdict/termination/cleanup/operational disposition
eksenlerinde üreten BridgeFlow runtime foundation'ını kur.

Temel çıktı:
- BridgeFlowExecutor contract/runtime
- Run/step occurrence persistence
- Attempt/request/epoch/event correlation
- UiWaitPlan → wait_any/cancel_request routing
- Durable waitEvent binding
- Continue Gate evaluator
- Final Oracle v2 evaluator
- Evidence Source/normalization runtime foundation
- Evidence Journey stage classifier/read model foundation
- Additive Prisma migration
- Engine-neutral API DTO'ları
- Test Profile/Campaign execution parameter persistence foundation
- TestExecutionQueue/TestDataBroker contract foundation
- Remote action idempotency/correlation policy foundation

Kesin yasaklar:
- Maestro YAML üretme.
- Maestro executor'ı kaldırma veya cutover yapma.
- Executor içine Nesy business command ekleme. Örnek yasak command: OPEN_STOP, COURIER_LOGIN, SELECT_ROUTE.
- Bridge'e business command gönderme.
- HTTP 2xx sonucunu business PASS sayma.
- UI yeşilini tek başına PASS sayma.
- Fixed sleep/wait kullanma.
- Unknown physical effect veya unknown remote effect durumunda kör retry yapma.
- Cleanup failure ile business verdict'i overwrite etme.
- Queue'yu ayrı evidence plane yapma; Local subtype olarak modelle.
- APP_STATE'i ayrı evidence plane yapma; App source/subtype olarak modelle.
- Event yokluğunu kanıtsız SDK failure'a hard-code etme.
- Full accessibility dump polling'i runtime hot path kabul etme.
- Domain Pack version/digest/registry değişimini aktif run'a hot reload etme.

Yapılacaklar:

1. Preflight:
   - pnpm verdict:verify-master-plan
   - git status --short --branch
   - Phase 4C RESULT gate doğrulaması
   - pnpm typecheck
   - pnpm test
   - Phase 4C compiler package testleri

2. Inventory:
   - Mevcut WorkflowRunner/MaestroExecutor yolunu oku.
   - Mevcut durable event bus/read model altyapısını oku.
   - Mevcut Prisma run/workflow/evidence modellerini çıkar.
   - Mevcut API route/DTO'ları çıkar.
   - Mevcut Bridge client/wait command yüzeyini çıkar.

3. Package/sınır kararı:
   - BridgeFlowExecutor ayrı package/service olmalı.
   - Execution/orchestration contract domain-pack-contracts içine taşınmamalı.
   - Gerekirse packages/execution-contract oluştur.
   - Domain-specific kavramlar Core/Bridge/Executor union'larına girmemeli.

4. Persistence:
   - Additive Prisma migration yaz.
   - Mevcut tarihi veriyi kırma.
   - Engine-neutral run/step occurrence/attempt/evidence/action transition/oracle/cleanup/result alanlarını ekle.
   - yamlContent/maestroOutput eski run artifact'i olarak korunmalı; yeni BridgeFlow run için zorunlu olmamalı.

5. Run/step state machine:
   - Lifecycle ayrı: PENDING, READY, LEASED, RUNNING, TERMINAL.
   - ProductVerdict ayrı: PASS, FAIL, INCONCLUSIVE, NOT_EVALUATED vb.
   - SchedulerDisposition ayrı: COMPLETED, RETRYABLE, BLOCKED, SKIPPED, CANCELLED, ORPHANED vb.
   - TerminationReason ayrı: NORMAL, ASSERTION_FAILED, WORKER_LOST, DEVICE_LOST, RESOURCE_UNAVAILABLE, DEPENDENCY_FAILED, OPERATOR_CANCELLED, TIMEOUT, UNKNOWN_EFFECT vb.
   - CleanupResult ayrı.
   - OperationalDisposition ayrı.

6. Action lifecycle:
   - RECEIVED → TARGET_RESOLVED → GESTURE_DISPATCHED → GESTURE_COMPLETED → EFFECT_VERIFIED transition'larını persist et.
   - Effect verification olmadan step success üretme.
   - Per-attempt requestId üret.
   - process death/reconnect response-loss durumunda exactly-once varsayma.
   - UNKNOWN_EFFECT recovery state üret.

7. Device Command Admission:
   - Tek cihazda aynı anda tek mutation.
   - Observation/wait/read bounded ve fair olmalı.
   - Backpressure ve cancellation race testleri yaz.
   - In-flight wait/action run bitince cleanup edilmeli.

8. UiWaitPlan runtime:
   - UiWaitPlan'ı correlated wait_any request'ine çevir.
   - expected/interrupt/ambiguous/timeout/cancel sonuçlarını occurrence'a route et.
   - Step/run bitişinde cancel_request gönder.
   - match-timeout-cancel race'inde tek terminal sonuç persist et.

9. Continue Gate:
   - Continue Gate Final Oracle'dan ayrı evaluator/state olarak persist edilmeli.
   - Gate hazır olduğunda deadline dolmasını beklemeden ilerlemeli.
   - Receipt-safe facts DurableReceiptBus üzerinden düşük latency ile gate'i uyandırabilir.
   - Ordered-required facts OrderedEvidenceBus olmadan gate'i geçmemeli.
   - Neden ilerledi evidence'i saklanmalı.

10. Final Oracle v2:
   - Four-plane model korunmalı: UI, APP, LOCAL, REMOTE.
   - QUEUE_OFFLINE Local subtype + PASS_QUEUED_OFFLINE policy olmalı.
   - APP_STATE App source/subtype olmalı.
   - Required/warning/optional/not-applicable ve immediate/eventual/not-measured ayrılmalı.
   - Eventual deadline/onTimeout deterministik uygulanmalı.
   - HTTP transport success business success değildir.
   - Evidence primary/confirmatory/fallback authority, freshness ve conflict gate uygulanmalı.
   - Stale veya yanlış occurrence fact Oracle PASS üretmemeli.

11. Evidence Source/normalization:
   - Raw technical evidence durable audit olarak korunmalı.
   - Domain normalized fact derivation trace saklanmalı.
   - Reducer idempotent olmalı.
   - Derived fact DAG cycle reject etmeli.
   - Pinned reducer/graph digest aktif run boyunca değişmemeli.

12. Evidence Journey:
   - emit → WAL → transport → inbox → receipt → ordered → normalization → correlation → evaluation stage'lerini ayrı modelle.
   - NOT_OBSERVED/UNKNOWN/PENDING/BLOCKED durumlarını kanıtsız FAILED yapma.
   - Explicit SDK diagnostic outcome yoksa EmitOutcome tahmin etme.

13. Test Profile/Campaign foundation:
   - Run başlangıcında profileKey/version, campaignId, buildRef, datasetRef, device cell, repetition index, fault plan, telemetry policy ve releaseGate flag pinlenmeli.
   - Campaign cell sonucu gerçek run/evidence summary olmadan PASS/FAIL üretmemeli.
   - Preview profile sonucu business verdict/release gate'i overwrite etmemeli.

14. TestExecutionQueue/TestDataBroker foundation:
   - TestExecution lifecycle/verdict/disposition/recovery eksenleri ayrı olmalı.
   - LEASE_EXPIRED, UNKNOWN_EFFECT, RECONCILIATION_REQUIRED ve ORPHANED ayrılmalı.
   - Resource pool/lease/conflict group modeli yaz.
   - CLEAN/DIRTY/QUARANTINED/RECONCILIATION_REQUIRED/MANUAL_RELEASE_REQUIRED resource state'leri ayrılmalı.
   - Reconciliation gereken resource havuza hemen dönmemeli.

15. Remote action runtime foundation:
   - REMOTE_ACTION allowlisted adapter operation lookup ile çalışmalı.
   - Idempotency key, timeout, cancel, occurrence/entity correlation persist edilmeli.
   - Non-idempotent veya unknown-effect remote mutation otomatik retry edilmemeli.
   - Partial failure durumunda resource reconciliation/disposition üretilmeli.

16. API/read models:
   - WorkflowRunApi versioned DTO.
   - RunHistoryQuery, RunDetailQuery, LegacyRunSummaryQuery.
   - DeviceReadinessQuery, DurableInteractionSubscription, WorkflowCatalogQuery.
   - EvidenceJourneyQuery.
   - TestProfileCatalog/Detail/Validation.
   - TestCampaignStart/Query/Result.
   - Pagination, partial/blocked state, capability snapshot ve correlation metadata.

17. Tests:
   - Unit testleri.
   - Prisma/migration testleri mümkünse PostgreSQL üzerinde.
   - Process restart recovery fixture.
   - Duplicate action prevention fixture.
   - Unknown effect fixture.
   - UI pass + app/remote missing fixture.
   - PASS_QUEUED_OFFLINE fixture.
   - wait_any interrupt/timeout/cancel race fixture.
   - Evidence conflict/stale/wrong occurrence fixture.
   - Cleanup failure business PASS overwrite etmez fixture.
   - Legacy Maestro run read model fixture.

18. Verification:
   - pnpm verdict:verify-master-plan
   - pnpm typecheck
   - pnpm test
   - package-level tests for new runtime/execution packages
   - Prisma generate/migrate verification
   - git diff --check
   - git diff --cached --check

Kapanış:
- RESULT.md'yi COMPLETED, READY_WITH_BLOCKERS veya BLOCKED olarak güncelle.
- CHECKPOINT 5 acceptance checklist'ini kanıtlarla doldur.
- Phase 6 readiness kararını yaz.
- Gerçek cihaz/DUT acceptance yapılamadıysa bunu external blocker olarak açık bırak; local deterministic runtime tamamlandı diye production rollout GO deme.
```

## 2. Phase 5 hedef mimarisi

Phase 5, compiler output'unu runtime'a çevirir.

```text
BridgeFlowPlan
  ↓
BridgeFlowExecutor
  ├── Run/Step/Attempt State Machine
  ├── Device Command Admission
  ├── Bridge wait_any / action routing
  ├── SDK Control / durable events
  ├── Local / Remote validators
  ├── Continue Gate evaluator
  ├── Final Oracle v2 evaluator
  ├── Evidence Source normalization
  ├── Evidence Journey classifier
  ├── TestExecutionQueue foundation
  └── TestDataBroker foundation
  ↓
Engine-neutral Run Detail / History API
```

Phase 5 tamamlanınca Cockpit UI hâlâ eski ekranda olabilir. Bu kabul edilebilir;
çünkü Phase 6 UI layer'ı Phase 5'in DTO/read model çıktısını tüketecektir.

## 3. Başlama gate'i

Phase 5 agent'ı başlamadan önce şu koşulları doğrulamalıdır:

```text
docs/verdict/run-playbooks/phase-4c/RESULT.md
  resultState: COMPLETED
  phase5Readiness: READY_WITH_EXTERNAL_BLOCKERS
```

Bu iki koşul yoksa:

- Kod yazılmayacak.
- Migration yazılmayacak.
- Executor scaffold edilmeyecek.
- `RESULT.md` `BLOCKED_PRECONDITION` olarak güncellenecek.
- Eksik Phase 4C output listesi yazılacak.

Phase 4C tamamlandıktan sonra Phase 5'in tüketmesi gereken minimum artifact'ler:

```text
BridgeFlowPlan
UiWaitPlan
Compile provenance/hash
Capability manifest
Evidence manifest
Source-map
Continue Gate bindings
Final Oracle bindings
Derived graph/reducer digest
Resource/dependency refs
Compiler package verification results
Nesy six-slice compile fixtures
Negative compile fixtures
```

## 4. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `5` |
| Current step | `5.0` |
| Current state | `WAITING_FOR_PHASE_4C_COMPLETION` |
| Last successful step | `4B.20` |
| Last attempted step | `5.0` |
| Last update | `2026-08-05 14:34:57 +03` |
| Recovery instruction | `Phase 5 playbook hazır. Phase 4C RESULT COMPLETED + phase5Readiness READY_WITH_EXTERNAL_BLOCKERS olmadan implementation başlatma.` |

## 5. Owned paths

Agent bu fazda yalnız ihtiyaç duyduğu kadar dosyaya dokunmalıdır.

Beklenen owned paths:

```text
packages/execution-contract/**
packages/bridgeflow-executor/**
packages/oracle-engine/**
apps/api/prisma/**
apps/api/src/services/bridgeflow-*.ts
apps/api/src/services/oracle-*.ts
apps/api/src/services/evidence-*.ts
apps/api/src/services/test-execution-*.ts
apps/api/src/services/test-data-broker-*.ts
apps/api/src/routes/verdict-*.ts
apps/api/src/app.ts
apps/web/src/lib/verdict-runtime/**
apps/web/src/lib/verdict-api/**
docs/verdict/run-playbooks/phase-5/**
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
turbo.json
```

Koşullu olarak okunabilir ama yazılmamalı:

```text
domain-packs/nesy-courier/**
packages/domain-pack-contracts/**
packages/workflow-contract/**
packages/bridgeflow-compiler/**
packages/bridge-contract/**
packages/control-contract/**
```

Eğer bu paketlerde contract eksiği Phase 5'i blokluyorsa önce RESULT.md'ye
`BLOCKED_UPSTREAM_CONTRACT` yazılmalı; Phase 5 içinde kontrolsüz contract drift
yapılmamalı.

## 6. Step plan

| Step | Status | Açıklama | Output |
|---|---|---|---|
| 5.0 Playbook oluşturma | `DONE` | `RUN_PLAY.md` + `RESULT.md` oluşturuldu. | Phase 5 hazır ama gated |
| 5.1 Phase 4C gate doğrulama | `PENDING` | Phase 4C `COMPLETED` ve `phase5Readiness` doğrula. | Gate evidence |
| 5.2 Preflight baseline | `PENDING` | Digest, branch, status, typecheck, test. | Baseline |
| 5.3 Runtime inventory | `PENDING` | Maestro runner, durable events, Prisma, API, Bridge client envanteri. | Inventory |
| 5.4 Package boundary | `PENDING` | execution-contract / bridgeflow-executor / oracle package sınırları. | Boundary decision |
| 5.5 Execution contract | `PENDING` | Lifecycle/verdict/disposition/termination/cleanup/resource types. | `@nesy/execution-contract` |
| 5.6 Persistence migration | `PENDING` | Additive run/step/attempt/evidence/oracle/action/result tables/fields. | Prisma migration |
| 5.7 Engine-neutral API DTO | `PENDING` | WorkflowRunApi, RunHistory, RunDetail, LegacyRunSummary. | DTO contracts |
| 5.8 BridgeFlowExecutor scaffold | `PENDING` | Plan loader, state machine, scheduler entrypoint. | Executor package/service |
| 5.9 Run lease and step occurrence | `PENDING` | Per-step transaction, occurrence/iteration/entity/request correlation. | Durable occurrence state |
| 5.10 Device Command Admission | `PENDING` | Single mutation, bounded reads/waits, fairness/backpressure. | Admission service |
| 5.11 Action lifecycle | `PENDING` | RECEIVED→TARGET_RESOLVED→GESTURE_DISPATCHED→GESTURE_COMPLETED→EFFECT_VERIFIED. | Action transition persistence |
| 5.12 Unknown-effect recovery | `PENDING` | Process death/reconnect/response-loss policy. | Recovery states |
| 5.13 UiWaitPlan runtime | `PENDING` | wait_any/cancel routing, expected/interrupt/timeout/ambiguous handling. | Wait runtime |
| 5.14 Durable waitEvent binding | `PENDING` | Receipt vs ordered lane subscriber routing. | Gate/Oracle wait subscriptions |
| 5.15 Continue Gate evaluator | `PENDING` | Early progress, “neden ilerledi” evidence. | Gate evaluator |
| 5.16 Final Oracle v2 evaluator | `PENDING` | Four-plane, obligation/timing, eventual deadline, conflict/freshness. | Oracle engine |
| 5.17 Evidence normalization | `PENDING` | Raw audit → normalized fact, reducer trace, DAG digest. | Normalization runtime |
| 5.18 Evidence Journey | `PENDING` | stage/state/reason/authority/confidence/read model. | EvidenceJourneyQuery |
| 5.19 Result axes atomic transitions | `PENDING` | Lifecycle/verdict/termination/cleanup/disposition overwrite yasağı. | Result service |
| 5.20 Remote action foundation | `PENDING` | Allowlist, idempotency, partial failure, reconciliation. | REMOTE_ACTION runtime |
| 5.21 Test Profile/Campaign persistence | `PENDING` | Run manifest, profile/campaign/cell/repetition/fault/telemetry pinning. | Campaign foundation |
| 5.22 TestExecutionQueue | `PENDING` | Lease/heartbeat/retry/block/orphan/reconciliation states. | Queue foundation |
| 5.23 TestDataBroker | `PENDING` | Resource pool/lease/conflict/quarantine/release states. | Broker foundation |
| 5.24 Legacy Maestro run read model | `PENDING` | Engine-neutral legacy summary, artifact preservation. | Legacy compatibility |
| 5.25 API routes and pagination | `PENDING` | Versioned DTO, blocked/partial/correlation metadata. | API surface |
| 5.26 Unit/integration tests | `PENDING` | Runtime, Oracle, migration, queue, broker, wait race tests. | Test evidence |
| 5.27 Negative safety tests | `PENDING` | fixed wait, HTTP 2xx PASS, UI-only PASS, stale fact, unknown retry reject. | Safety evidence |
| 5.28 Verification | `PENDING` | Digest, typecheck, tests, package tests, diff checks. | Verification |
| 5.29 RESULT closure | `PENDING` | CHECKPOINT 5 checklist + Phase 6 readiness. | Final handoff |

## 7. Execution package sınırları

Phase 5'te özellikle package sınırları korunmalıdır.

Doğru ayrım:

```text
packages/execution-contract
  ├── ExecutionLifecycle
  ├── ProductVerdict
  ├── EvaluationFailureClass
  ├── SchedulerDisposition
  ├── TerminationReason
  ├── WorkflowCleanupResult
  ├── ResourceReleaseResult
  ├── OperationalDisposition
  ├── RunManifest
  ├── TestExecution
  ├── ResourceRequirement
  ├── ResourceLease
  └── SchedulerPolicy

packages/bridgeflow-executor
  ├── plan runner
  ├── step state machine
  ├── action lifecycle
  ├── wait routing
  ├── recovery policy
  └── orchestration services

packages/oracle-engine
  ├── evidence requirement evaluator
  ├── Continue Gate evaluator
  ├── Final Oracle evaluator
  ├── conflict/freshness/correlation gate
  └── verdict explanation DTO

apps/api
  ├── persistence
  ├── routes
  ├── worker/service wiring
  └── read models
```

Yanlış ayrım:

```text
packages/domain-pack-contracts
  └── RunManifest / lease / worker heartbeat / queue state
```

Execution/orchestration kavramları Domain Pack contract paketine taşınmamalıdır.

## 8. Persistence ilkeleri

Migration additive olmalıdır.

Korunacaklar:

- Eski Maestro run history.
- Eski `yamlContent` / `maestroOutput` artifact'leri.
- Mevcut API consumer'ları.
- Mevcut fixture/test verisi.

Eklenmesi beklenen kavramlar:

```text
engineType
compiledPlanRef/hash
domainPackDigest
workflowIrSchemaVersion
compilerVersion
bridgeProtocolVersion
sdkProtocolVersion
runSession/epoch/auth state
stepOccurrence
iteration/entity correlation
attempt/requestId correlation
physical action transition
wait_any request/result/cancel
Continue Gate state
Final Oracle state
Evidence Journey stage
layer applicability snapshot
ProductVerdict
EvaluationFailureClass
ExecutionLifecycle
SchedulerDisposition
TerminationReason
WorkflowCleanupResult
OperationalDisposition
RunManifest
TestExecution
ResourceLease
TestDataBroker resource state
```

## 9. Result taxonomy

Tek `FAILED` alanına dönülmeyecek. Sonuç eksenleri ayrıdır:

```text
ExecutionLifecycle
ProductVerdict
EvaluationFailureClass
SchedulerDisposition
TerminationReason
WorkflowCleanupResult
ResourceReleaseResult
OperationalDisposition
```

Örnek doğru sonuç:

```text
lifecycle: TERMINAL
productVerdict: PASS
terminationReason: NORMAL
cleanupResult: FAILED
operationalDisposition: NEEDS_ATTENTION
```

Bu durumda ürün testi PASS kalır; cleanup failure ayrı attention üretir.

## 10. Continue Gate vs Final Oracle

Continue Gate runner'ın ne zaman ilerleyebileceğini belirler.

Final Oracle test sonucunu ve eventual doğrulamayı üretir.

```text
Continue Gate
  - blocking requirement hazır olunca ilerler
  - deadline dolmasını beklemez
  - receipt-safe lane ile düşük latency uyandırılabilir
  - “neden ilerledi” evidence'i saklar

Final Oracle
  - required/warning/optional/not-applicable obligation'ları değerlendirir
  - immediate/eventual/not-measured timing'i uygular
  - ordered evidence authority'sini korur
  - timeout/onTimeout sonucunu deterministik üretir
```

Bu ayrım bozulursa iki risk doğar:

- Tüm eventual servisler beklenir ve test gereksiz yavaşlar.
- UI hazır oldu diye arka plandaki kritik APP/LOCAL/REMOTE failure kaçırılır.

## 11. Evidence plane ilkeleri

Ana evidence plane sayısı dört kalır:

```text
UI
APP
LOCAL
REMOTE
```

`QUEUE_OFFLINE` ayrı plane değildir:

```text
LOCAL.queue subtype + PASS_QUEUED_OFFLINE policy
```

`APP_STATE` ayrı plane değildir:

```text
APP source/subtype
```

Ham teknik event ve normalized fact ayrılır:

```text
SDK/Bridge raw technical evidence
  ↓ durable audit
Domain reducer / Evidence Source resolver
  ↓ normalized semantic fact
Oracle requirement evaluator
```

Workflow teknik callback isimlerine bağlanmamalıdır.

## 12. Safety blockers

Şu durumlardan biri görülürse Phase 5 fail/block edilmelidir:

- Phase 4C completed değil.
- Compiler output deterministic değil.
- Business command Core/Bridge/Executor'a sızıyor.
- Executor fixed wait ile ilerliyor.
- UI-only pass test success üretiyor.
- HTTP 2xx business success sayılıyor.
- Unknown-effect otomatik retry ediliyor.
- Cleanup failure business verdict'i overwrite ediyor.
- Queue ayrı evidence plane olarak modelleniyor.
- `FAILED` tek sonuç alanı olarak geri geliyor.
- Active run Domain Pack hot reload'dan etkileniyor.
- Migration destructive.
- Legacy Maestro history kayboluyor.
- In-flight wait/action run bitince temizlenmiyor.
- Event wrong occurrence/iteration'a yazılabiliyor.
- Stale/correlation-miss fact Oracle PASS üretiyor.

## 13. Minimum verification commands

Agent kapanışta en az şunları çalıştırmalıdır:

```bash
pnpm verdict:verify-master-plan
pnpm typecheck
pnpm test
pnpm --filter @nesy/execution-contract typecheck
pnpm --filter @nesy/execution-contract test
pnpm --filter @nesy/bridgeflow-executor typecheck
pnpm --filter @nesy/bridgeflow-executor test
pnpm --filter @nesy/oracle-engine typecheck
pnpm --filter @nesy/oracle-engine test
git diff --check
git diff --cached --check
```

Eğer bazı package'lar farklı isimle oluşturulduysa RESULT.md içinde gerçek komutlar
yazılmalıdır.

PostgreSQL/Docker mevcutsa ayrıca:

```bash
pnpm prisma generate
pnpm prisma migrate status
pnpm test:integration
```

Docker yoksa veya yalnız shared remote DB varsa write-heavy integration test
koşulmayacak; RESULT.md içinde `IMPLEMENTED_UNVERIFIED_EXTERNAL_DB` yazılacaktır.

## 14. CHECKPOINT 5 acceptance checklist

Phase 5 kapanmadan aşağıdaki maddeler `PASS`, `FAIL`, `BLOCKED_EXTERNAL` veya
`DEFERRED_WITH_REASON` olarak RESULT.md'ye işlenmelidir.

1. Phase 4C output'ları doğrulandı.
2. BridgeFlowExecutor compiled plan tüketiyor.
3. Executor Maestro YAML üretmiyor.
4. Yeni BridgeFlow run `yamlContent/maestroOutput` zorunluluğu olmadan tamamlanıyor.
5. Run lifecycle ayrı persist ediliyor.
6. Business verdict ayrı persist ediliyor.
7. Termination reason ayrı persist ediliyor.
8. Cleanup result ayrı persist ediliyor.
9. Operational disposition ayrı persist ediliyor.
10. Cleanup failure business PASS'i overwrite etmiyor.
11. Tek cihazda iki run aynı anda mutation uygulamıyor.
12. Aynı editor node'un 20 occurrence'ı ayrı kaydediliyor.
13. Process restart completed occurrence'ı tekrar uygulamıyor.
14. Unknown physical effect sessiz retry/green üretmiyor.
15. Action lifecycle transition'ları persist ediliyor.
16. Effect verification olmadan step success üretilmiyor.
17. wait_any expected result doğru occurrence'a route ediliyor.
18. wait_any interrupt result doğru policy'ye route ediliyor.
19. wait_any timeout/cancel race tek terminal sonuç üretiyor.
20. In-flight wait/action cleanup ediliyor.
21. Continue Gate hazır olduğunda deadline beklemeden ilerliyor.
22. Continue Gate “neden ilerledi” evidence'i saklıyor.
23. Final Oracle eventual result occurrence kapanışına kadar izleniyor.
24. Required/eventual/onTimeout deterministik uygulanıyor.
25. UI pass + APP/LOCAL/REMOTE missing doğru fail/pending üretiyor.
26. HTTP 2xx tek başına business success üretmiyor.
27. Four-plane model korunuyor.
28. QUEUE_OFFLINE Local subtype olarak modelleniyor.
29. APP_STATE App source/subtype olarak modelleniyor.
30. NOT_APPLICABLE, NOT_MEASURED ve REQUIRED_PENDING ayrılıyor.
31. PASS_ONLINE ve PASS_QUEUED_OFFLINE ayrılıyor.
32. FAIL_PRODUCT, INCONCLUSIVE, AUTOMATION_FAILURE, ENVIRONMENT_FAILURE ve EVIDENCE_INSUFFICIENT ayrılıyor.
33. Evidence wrong iteration'a yazılmıyor.
34. Node type tek başına correlation key olarak kullanılmıyor.
35. Stale/correlation-miss fact Oracle PASS üretmiyor.
36. Evidence conflict `EVIDENCE_CONFLICT` üretiyor.
37. Raw technical evidence audit olarak korunuyor.
38. Normalized fact derivation trace saklanıyor.
39. Derived fact reducer replay idempotent.
40. Derived graph cycle reject ediliyor.
41. Active run pack/graph/reducer digest pinleniyor.
42. Evidence Journey stage'leri ayrı üretiliyor.
43. SDK EmitOutcome kanıtsız tahmin edilmiyor.
44. Legacy Maestro run engine-neutral read model'de açılıyor.
45. Phase 6 DTO target'ları contract testinden geçiyor.
46. Test Profile/Campaign params run başında pinleniyor.
47. Campaign cell gerçek run/evidence summary olmadan PASS/FAIL üretmiyor.
48. Preview profile business verdict/release gate'i overwrite etmiyor.
49. Repetition/soak/fault state restart sonrası deterministik.
50. Run Manifest immutable.
51. TestExecutionQueue worker loss/retry/block/orphan ayrımını yapıyor.
52. UNKNOWN_EFFECT ve RECONCILIATION_REQUIRED ayrılıyor.
53. Login/setup/resource failure dependent workflow'ları BLOCKED yapıyor.
54. Independent workflow'lar çalışmaya devam edebiliyor.
55. TestDataBroker exclusive resource parallel mutation'ı engelliyor.
56. Reconciliation gereken resource havuza hemen dönmüyor.
57. REMOTE_ACTION idempotency/correlation/resource lease olmadan çalışmıyor.
58. Non-idempotent remote mutation otomatik retry edilmiyor.
59. Remote partial failure reconciliation/disposition üretiyor.
60. Nesy tur onayı setup modu gerçek product PASS üretmiyor.
61. Fixed wait runtime planında yok.
62. Migration additive ve legacy data'yı kırmıyor.
63. API DTO versioning/pagination mevcut.
64. PostgreSQL integration sonucu ya PASS ya external blocker olarak açık.
65. Full verification komutları çalıştırıldı ve RESULT.md'ye yazıldı.

## 15. Phase 6 handoff expectation

İdeal kapanış:

```text
Phase 5: COMPLETED
CHECKPOINT 5: PASSED_WITH_EXTERNAL_DUT_BLOCKERS
Phase 6 readiness: READY_WITH_EXTERNAL_BLOCKERS
Reason: compiled BridgeFlow plans can be executed through durable executor, Continue Gate, Final Oracle v2 and engine-neutral persistence; real DUT/cutover blockers remain explicit.
```
