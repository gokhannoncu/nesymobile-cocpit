# Phase 4C RUN_PLAY — Domain-aware BridgeFlowCompiler

```yaml
runPlayId: verdict-cockpit-phase-4c-run-play
phase: "4C"
phaseName: "Domain-aware BridgeFlowCompiler + UiWaitPlan Compilation"
status: NOT_STARTED
recoveryState: READY_TO_START
createdAt: "2026-08-05 14:18:43 +03"
startedAt: null
completedAt: null
lastUpdatedAt: "2026-08-05 14:18:43 +03"
timezone: "Europe/Istanbul"
masterPlanPath: "docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:76024d898cb152fe4d885fb18e798cb24b6c3df31715eac546c64383ed5c2bd0"
verifyMasterPlanCommand: "pnpm verdict:verify-master-plan"
previousPhaseResult: "docs/verdict/run-playbooks/phase-4b/RESULT.md"
resultFile: "docs/verdict/run-playbooks/phase-4c/RESULT.md"
phase4BStatusRequired: "COMPLETED"
phase4CTarget: "CHECKPOINT_4C"
phase5ReadinessTarget: "READY_WITH_EXTERNAL_BLOCKERS"
blockingPreflight:
  - id: "CP3-DUT"
    status: "OPEN_EXTERNAL"
    meaning: "Real DUT mutation acceptance hâlâ external; Phase 4C compiler cihaz action çalıştırmadığı için bloklamaz. Phase 5+ executor/cutover öncesi kapanmalı."
  - id: "B-12"
    status: "OPEN_EXTERNAL"
    meaning: "Production cihaz smoke handshake flaky; compiler işi değil, Phase 5/real DUT gate için taşınır."
  - id: "B-14"
    status: "OPEN_LOW"
    meaning: "runEpoch birimi Bridge protocol v2 içinde açık yazılmalı; UiWaitPlan/BridgeFlowPlan DTO'sunda epoch field varsa açık birim yazılmalı."
  - id: "B-8"
    status: "OPEN_NON_BLOCKING"
    meaning: "Repo-wide lint ESLint v9 flat-config borcu; yeni compiler paketi kendi lint/typecheck/test gate'lerinden geçmelidir."
```

## 1. Şu an hangi kısımdayız?

Phase 4A shared WorkflowIR v2 contract'ını dondurdu. Phase 4B Domain Pack
contract'ını ve Nesy Courier reference pack'i tamamladı. Phase 4C artık semantic
Domain Pack node'larını deterministic, device-action-free compiler hattıyla
generic BridgeFlowPlan'a çevirebilir.

```text
Phase 4A: WorkflowIR v2 + Condition Engine COMPLETE
Phase 4B: Domain Pack Contracts + Nesy Courier Reference Pack COMPLETE
Phase 4C: Domain-aware BridgeFlowCompiler READY_TO_START
Next after 4C: Phase 5 BridgeFlowExecutor + Oracle v2 + Persistence
```

Bu fazın işi **compile etmek**tir. Çalıştırmak, cihaza dokunmak, durable run
state'i yazmak veya Maestro cutover yapmak Phase 5+ işidir.

## 1.1 AI agent'a verilecek başlangıç metni

Aşağıdaki prompt başka bir AI agent'a doğrudan verilebilir. Prompt, Phase 4C
sınırını korumak için özellikle uzun tutuldu.

```text
Verdict Cockpit Phase 4C'yi uygula.

Önce şu dosyayı tamamen oku:
docs/verdict/run-playbooks/phase-4c/RUN_PLAY.md

Sonra şu dosyayı oku ve çalışmaya başlarken YAML frontmatter/result alanlarını
IN_PROGRESS olarak güncelle:
docs/verdict/run-playbooks/phase-4c/RESULT.md

Önceki faz sonucunu oku:
docs/verdict/run-playbooks/phase-4b/RESULT.md

Master planda özellikle şu bölümleri oku:
- D.7 BridgeFlowCompiler
- B.10D Bridge UiWaitPlan, wait_any ve dump politikası
- FAZ 4C — Domain-aware BridgeFlowCompiler
- CHECKPOINT 4C — Compiler tamamlandı
- H.9 İlk uygulanacak iş sırası

Input contract'ları ve kaynak paketleri:
- packages/workflow-contract
- packages/domain-pack-contracts
- domain-packs/nesy-courier
- packages/bridge-contract
- packages/bridge-client sadece contract okumak için; business command ekleme

Bu fazın hedefi:
- Domain Pack macro/action/reference input'larını generic WorkflowIR v2 üzerinden deterministic BridgeFlowPlan'a compile eden bir compiler paketi/seam'i oluştur.
- Önerilen paket adı: packages/bridgeflow-compiler (@nesy/bridgeflow-compiler).
- Compiler hiçbir cihaz action'ı çalıştırmayacak.
- Compiler runtime executor, run queue, lease, Test Data Broker veya Oracle scheduler yazmayacak.
- Compiler Maestro YAML üretmeyecek ve Maestro cutover yapmayacak.

Yapılacaklar:
1. Preflight:
   - pnpm verdict:verify-master-plan
   - git status --short --branch
   - pnpm typecheck
   - pnpm test
   - Phase 4B RESULT'ın resultState COMPLETED olduğunu doğrula.

2. BridgeFlow compiler contract:
   - BridgeFlowPlan
   - BridgeFlowPlanStep
   - BridgeFlowPlanHash
   - CompileInput
   - CompileResult
   - CompileIssue
   - CompilePreviewDto
   - CompileProvenance
   - CapabilityManifest
   - UiWaitPlan
   - UiWaitTarget
   - UiInterruptTarget
   - UiPredicate
   - FactDeliveryLane
   - CompiledEvidenceRequirement
   - CompiledResourceRequirementRef
   - CompiledDomainDependencyRef

3. Deterministic traversal/hash:
   - Aynı input aynı BridgeFlowPlan hash üretmeli.
   - Aynı Domain Pack version/digest/provenance plana yazılmalı.
   - Source-map domain node → macro → generic IR step → BridgeFlow step zincirini taşımalı.
   - Sort/order policy explicit olmalı; object key sırası hash'i oynatmamalı.

4. Domain macro → generic IR v2:
   - Phase 4B'deki hand-authored expansion snapshots input olarak doğrulanabilir.
   - Production compiler semantic macro input'larını registry refs, typed entity binding ve capability manifest ile validate etmeli.
   - Unknown macro/action/node fail-fast.
   - Domain macro generic IR v2 dışına çıkarsa compile fail.
   - Compiler Core IR union'ına business step eklemeye çalışmamalı.

5. Generic IR v2 → BridgeFlowPlan:
   - CONDITION, SWITCH, FOR_EACH, WAIT_EVENT, WAIT_ANY, REMOTE_ACTION/EXTERNAL_ACTION, CLEANUP, ASSERT_FACT vb. generic step'ler compile edilmeli.
   - FOR_EACH bounded olmalı; unbounded loop compile fail.
   - Runtime condition step üretimi olmalı; unsafe compile-time branch assumption yapılmamalı.
   - Non-idempotent unsafe retry compile fail.
   - Fixed wait/sleep hot path compile fail.

6. UiWaitPlan:
   - Expected surfaces/targets ve interrupt surfaces tek generic UiWaitPlan içinde temsil edilmeli.
   - wait_any request'e dönüşebilecek bounded plan üretilmeli.
   - stableForMs, deadlineMs, maxLegs, candidate limit, ambiguity policy, hostOnlyCancel ve capability fallback taşınmalı.
   - Full dump hot path yasak. Diagnostic capture ayrı artifact yolu olarak kalmalı.
   - wait_any/cancel_request capability yoksa B-13 modeline uygun fallback veya compile issue üret.

7. Registry compatibility:
   - Application/Screen/Surface/LaunchProfile refs serbest string gibi geçmemeli.
   - App version compatibility ve App Adapter compatibility preflight issue üretmeli.
   - Pack/app/adapter mismatch cihaz action'ından önce fail.
   - TargetFingerprint strength/ambiguity/drift validation olmalı.
   - rowIndexHint/text-only weak target warning/error policy üretmeli.

8. Evidence compilation:
   - Continue Gate ve Final Oracle planda ayrı kalmalı.
   - Evidence required/optional/not-applicable/applicability plane'leri deterministik yazılmalı.
   - Unified OracleRequirement kullanılmalı; paralel required/eventual string listeleri reddedilmeli.
   - Evidence Source Registry authority/correlation/freshness plana yazılmalı.
   - HTTP transport success business success sayılmamalı.
   - Derived fact graph/reducer digest plan hash/provenance'a dahil edilmeli.
   - Fact delivery lane: RECEIPT_SAFE / ORDERED_REQUIRED deterministik yazılmalı.
   - ORDERED_REQUIRED fact receipt-only gate'e bağlanırsa compile fail.

9. Test Profile expansion:
   - TestProfile workflowRef, launchProfileRef, dataset, repetition, device matrix, fault plan, telemetry, differential ve schedule policy aynı compiler path'ine açılmalı.
   - Profile yeni runner/engine/Oracle path'i isteyemez; isterse compile fail.
   - Fault trigger correlation yoksa compile/preflight fail.
   - Differential baseline build/fact-sequence/oracle/evidence journey comparison source-map'i plana yazılmalı.
   - Reusable Flow Fragment terminal product verdict üretemez; compile fail.
   - ResourceRequirementRef ve DomainDependencyRef compile edilmeli; gerçek lease/scheduling Phase 5 işidir.
   - Dependency failure sahte FAILED değil BLOCKED olarak modellenmeli.

10. API/Web seam:
   - API tarafında compile service/DTO seam eklenebilir: apps/api/src/services/bridgeflow-compiler*.ts.
   - Web tarafında compile preview client/model seam eklenebilir: apps/web/src/lib/bridgeflow-compiler*.ts.
   - UI route/page yazmak zorunlu değil; Phase 6 işi.
   - Existing workflow-runner, maestro-executor, yaml-generator cutover yapılmayacak.

11. Nesy acceptance:
   - NESY_COURIER_DOMAIN_PACK_REFERENCE_V1 içindeki 6 vertical slice compile input olarak test edilmeli:
     COURIER_LOGIN, SELECT_ROUTE, OPEN_STOP, PROCESS_PARCEL, COMPLETE_DELIVERY, TOUR_APPROVAL_LIFECYCLE.
   - OPEN_STOP planı entity/iteration/target resolution/source-map/APP.ACTIVE_STOP_MATCHES gate taşımalı.
   - COURIER_LOGIN setup login ile gerçek login'i ayırmalı; PREPARED_SESSION/DIRECT_STATE login PASS üretememeli.
   - TOUR_APPROVAL_LIFECYCLE multi-actor remote action, idempotency, reconciliation, two-service remote facts ve push confirmatory/warning semantics taşımalı.
   - 20 item FOR_EACH fixture doğru iteration/occurrence/entity scope taşımalı.

Kesin yasaklar:
- Cihaz action dispatch etme.
- BridgeFlowExecutor yazma.
- run queue, lease, Test Data Broker, scheduler runtime yazma.
- Maestro YAML üretimini değiştirme veya cutover yapma.
- packages/workflow-contract veya bridge packages içine OPEN_STOP/COURIER_LOGIN/STOP/PARCEL/DELIVERY gibi business type/command ekleme.
- Domain Pack içine execution runtime state gömme.
- Fixed sleep/wait primitive üretme.
- Full accessibility dump hot path planı üretme.
- HTTP 2xx'i business success sayma.

Önerilen owned paths:
- packages/bridgeflow-compiler/**
- apps/api/src/services/bridgeflow-compiler*.ts
- apps/api/src/services/bridgeflow-compiler*.test.ts
- apps/web/src/lib/bridgeflow-compiler*.ts
- apps/web/src/lib/bridgeflow-compiler*.test.ts
- docs/verdict/run-playbooks/phase-4c/**
- package.json / pnpm-lock.yaml / turbo config gerekiyorsa

Okunacak ama business sızıntısı yapılmayacak path'ler:
- packages/workflow-contract/**
- packages/domain-pack-contracts/**
- domain-packs/nesy-courier/**
- packages/bridge-contract/**
- packages/bridge-client/**

Kapanışta RESULT.md dosyasına:
- changed files
- komut çıktıları
- test evidence
- acceptance checklist
- blocker listesi
- Phase 5 readiness kararı
yaz.

Son doğrulamada en az:
- pnpm verdict:verify-master-plan
- pnpm typecheck
- pnpm test
- pnpm --filter @nesy/bridgeflow-compiler typecheck
- pnpm --filter @nesy/bridgeflow-compiler test
- pnpm --filter @nesy/bridgeflow-compiler lint
- pnpm --filter @nesy/bridgeflow-compiler build
- varsa API/Web targeted tests
- git diff --check
- git diff --cached --check
çalıştır.
```

## 2. Amaç

Phase 4C'nin amacı, Domain Pack authoring layer'ı ile Phase 5 runtime'ı arasında
deterministik compiler kapısını kurmaktır:

```text
Domain Pack semantic macro/action/test profile
  ↓
Generic WorkflowIR v2 validation
  ↓
BridgeFlowCompiler
  ↓
BridgeFlowPlan
  ├── UiWaitPlan
  ├── Capability manifest
  ├── Evidence requirements
  ├── Continue Gate / Final Oracle bindings
  ├── Derived graph/reducer digest
  ├── Resource/dependency refs
  └── Source-map/provenance/hash
```

Bu fazın çıktısı çalıştırılabilir runtime değildir; Phase 5'in güvenle
çalıştıracağı deterministik plan contract'ıdır.

## 3. Neden bu sırada?

Phase 4B sonunda semantic node'lar ve registry'ler artık typed. Ancak runtime hâlâ
bu semantic modeli bilmiyor. Phase 4C compiler, semantic alanı Core/Bridge runtime'a
sızdırmadan generic BridgeFlowPlan'a indirger.

Yanlış sıra şu olurdu:

```text
Domain Pack → direkt executor
```

Bu, executor'ın Nesy business command bilmesine yol açar. Doğru sıra:

```text
Domain Pack → Compiler → Generic BridgeFlowPlan → Executor
```

## 4. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `4C` |
| Current step | `4C.0` |
| Current state | `READY_TO_START` |
| Last successful step | `4B.20` |
| Last attempted step | `4C.0` |
| Last update | `2026-08-05 14:18:43 +03` |
| Recovery instruction | `Phase 4C henüz başlamadı. Önce Phase 4B RESULT COMPLETED doğrulanmalı; sonra compiler package/seam scaffold, deterministic compile contract, UiWaitPlan compilation ve Nesy six-slice compile fixtures uygulanmalı.` |

Step sonuçları başlangıçta:

| Step | Sonuç |
|---|---|
| 4C.0 Playbook oluşturma | `DONE` |
| 4C.1 Preflight ve Phase 4B gate doğrulama | `PENDING` |
| 4C.2 Existing compiler/runtime inventory | `PENDING` |
| 4C.3 Package boundary kararı | `PENDING` |
| 4C.4 `packages/bridgeflow-compiler` scaffold | `PENDING` |
| 4C.5 BridgeFlowPlan/UiWaitPlan contract | `PENDING` |
| 4C.6 Deterministic canonicalization/hash/provenance | `PENDING` |
| 4C.7 Domain macro input validation | `PENDING` |
| 4C.8 Generic WorkflowIR v2 → BridgeFlowPlan compilation | `PENDING` |
| 4C.9 Control flow compilation: CONDITION/SWITCH/FOR_EACH | `PENDING` |
| 4C.10 TargetFingerprint/TargetResolution validation | `PENDING` |
| 4C.11 UiWaitPlan expected/interrupt compilation | `PENDING` |
| 4C.12 Capability-aware compile errors | `PENDING` |
| 4C.13 Evidence/Oracle/derived fact compilation | `PENDING` |
| 4C.14 Test Profile expansion | `PENDING` |
| 4C.15 Feature/Capability/Resource/Dependency source-map | `PENDING` |
| 4C.16 API/Web compile preview seam | `PENDING` |
| 4C.17 Nesy six-slice compile fixtures | `PENDING` |
| 4C.18 Negative compile fixture suite | `PENDING` |
| 4C.19 Domain leakage and no-executor scans | `PENDING` |
| 4C.20 Verification/result/handoff | `PENDING` |

## 5. Phase 4C scope

### 5.1 Yapılacaklar

1. `packages/bridgeflow-compiler` package'i.
2. BridgeFlowPlan contract:
   - schema version
   - plan id/hash
   - provenance
   - domain pack digest/version
   - workflow/test profile refs
   - app/adapter compatibility refs
   - steps
   - UiWaitPlans
   - capability manifest
   - evidence manifest
   - source map
3. Generic `UiWaitPlan` contract:
   - expected targets
   - interrupt surfaces
   - predicates
   - priority/tie-break
   - stableForMs
   - deadlineMs
   - max candidates/legs
   - ambiguity policy
   - cancellation capability/fallback
   - no full dump hot path
4. Compile API:
   - `compileDomainWorkflow`
   - `compileMacroSnapshot`
   - `compileTestProfile`
   - `previewCompile`
   - issue collection, no first-error-only behavior
5. Deterministic hash:
   - same input same output
   - pack/provenance/source-map included
   - derived graph/reducer digest included
6. Domain macro validation:
   - unknown macro/action fail-fast
   - missing registry ref fail-fast
   - macro outside generic IR fail
7. Generic IR validation:
   - unknown step kind fail
   - unbounded loop/wait fail
   - unsafe retry fail
   - fixed wait fail
   - missing evidence policy fail
8. Registry validation:
   - screen/surface/target/launch/profile refs bounded
   - app-version compatibility checked
   - adapter compatibility checked
9. Evidence compilation:
   - Continue Gate and Final Oracle separate
   - unified OracleRequirement
   - authority/correlation/freshness
   - lane: RECEIPT_SAFE/ORDERED_REQUIRED
   - derived graph/reducer digest
10. Test Profile expansion:
    - launch profile
    - workflow refs
    - dataset/repetition/device/fault/telemetry/differential
    - resource/dependency refs
11. Human-readable preview DTO:
    - summary
    - warnings/errors
    - source-map breadcrumbs
    - expected waits/interrupts
    - evidence requirements
    - capability gaps
12. Nesy reference compile suite:
    - 6 vertical slice
    - 20 item FOR_EACH fixture
    - TOUR_APPROVAL_LIFECYCLE

### 5.2 Yapılmayacaklar

```text
BridgeFlowExecutor
DeviceWorker queue
Run lease / TestExecutionQueue
Test Data Broker
Oracle runtime scheduler
Evidence Journey read model
DB persistence migration
Cockpit manager UI
Maestro removal
Live Cockpit cutover
Mobile repo changes
```

Bu işler Phase 5+ kapsamıdır.

## 6. Owned paths

Phase 4C agent'ı aşağıdaki path'lerde değişiklik yapabilir:

```text
packages/bridgeflow-compiler/**
apps/api/src/services/bridgeflow-compiler*.ts
apps/api/src/services/bridgeflow-compiler*.test.ts
apps/web/src/lib/bridgeflow-compiler*.ts
apps/web/src/lib/bridgeflow-compiler*.test.ts
docs/verdict/run-playbooks/phase-4c/**
package.json
pnpm-lock.yaml
turbo.json
```

Okunacak ama dikkatli path'ler:

```text
packages/workflow-contract/**
packages/domain-pack-contracts/**
domain-packs/nesy-courier/**
packages/bridge-contract/**
packages/bridge-client/**
```

Bu paketlere business command/type eklemek yasaktır. Gerekirse yalnız type export
veya fixture uyumu için minimal değişiklik yapılır; gerekçe RESULT'a yazılır.

## 7. Compiler boundary rules

### 7.1 Compiler ne bilir?

Compiler şunları bilir:

```text
Domain Pack registry key/ref
Generic WorkflowIR v2 step kind
BridgeFlowPlan primitive
UiWaitPlan primitive
Evidence requirement
Capability requirement
Source-map/provenance
```

Compiler şunları çalıştırmaz:

```text
Bridge command
SDK command
Remote action
Named query
DB verifier
Test profile run
Device mutation
```

### 7.2 Business leakage yasağı

`packages/bridgeflow-compiler` generic compiler paketi olduğu için şu kelimeleri
type/union/command olarak export edemez:

```text
OPEN_STOP
COURIER_LOGIN
SELECT_ROUTE
PROCESS_PARCEL
COMPLETE_DELIVERY
TOUR_APPROVAL
APPROVE_TOUR
STOP
PARCEL
SHIPMENT
DELIVERY
COURIER
ROUTE
```

Bu kelimeler yalnız test fixture adı, explicit negative scan listesi veya
`domain-packs/nesy-courier` içinde bulunabilir.

### 7.3 No executor guard

Compiler package içinde şu type/function/export bulunamaz:

```text
BridgeFlowExecutor
executePlan
dispatchBridgeCommand
dispatchSdkCommand
DeviceWorker
RunLease
TestExecutionQueue
TestDataBroker
WorkerHeartbeat
```

## 8. Expected package structure

Önerilen yapı:

```text
packages/bridgeflow-compiler/
├── package.json
├── tsconfig.json
├── eslint.config.js
├── vitest.config.ts
└── src/
    ├── index.ts
    ├── bridgeflow-plan.ts
    ├── ui-wait-plan.ts
    ├── compile-input.ts
    ├── compile-issues.ts
    ├── canonical.ts
    ├── provenance.ts
    ├── capability.ts
    ├── domain-expansion.ts
    ├── workflow-ir-compiler.ts
    ├── evidence-compiler.ts
    ├── profile-compiler.ts
    ├── preview.ts
    ├── leakage.ts
    └── index.test.ts
```

API/Web seam opsiyonel:

```text
apps/api/src/services/bridgeflow-compiler.ts
apps/api/src/services/bridgeflow-compiler.test.ts
apps/web/src/lib/bridgeflow-compiler-client.ts
apps/web/src/lib/bridgeflow-compiler-client.test.ts
```

## 9. Negative fixtures

Minimum negatif testler:

```text
unknown-domain-macro
unknown-registry-ref
ambiguous-target
row-index-primary-or-text-only-weak-target
unbounded-for-each
unbounded-wait
fixed-sleep-step
unsafe-non-idempotent-retry
missing-required-evidence-source
missing-business-evidence-capability
parallel-oracle-role-timing-lists
receipt-only-ordered-required-fact
http-2xx-as-business-success
profile-requests-new-runner
fragment-produces-terminal-verdict
fault-trigger-without-correlation
domain-business-token-in-compiler-export
compiler-attempts-executor-export
full-dump-hot-path-plan
```

## 10. Acceptance checklist

| # | Acceptance | Status |
|---|---|---|
| 1 | Phase 4B RESULT `COMPLETED` doğrulandı | `PENDING` |
| 2 | Master plan digest doğrulandı | `PENDING` |
| 3 | `packages/bridgeflow-compiler` package'i var | `PENDING` |
| 4 | BridgeFlowPlan contract var | `PENDING` |
| 5 | UiWaitPlan contract var | `PENDING` |
| 6 | Same input same plan/hash | `PENDING` |
| 7 | Pack/version/digest/provenance plana yazılıyor | `PENDING` |
| 8 | Source-map domain macro → IR step → BridgeFlow step zincirini taşıyor | `PENDING` |
| 9 | Unknown macro/action fail-fast | `PENDING` |
| 10 | Unknown registry ref fail-fast | `PENDING` |
| 11 | Domain macro generic IR v2 dışına çıkarsa fail | `PENDING` |
| 12 | CONDITION/SWITCH/FOR_EACH compilation var | `PENDING` |
| 13 | Bounded FOR_EACH iteration/occurrence/entity scope taşıyor | `PENDING` |
| 14 | Unbounded loop/wait reddediliyor | `PENDING` |
| 15 | Fixed wait/sleep reddediliyor | `PENDING` |
| 16 | Unsafe non-idempotent retry reddediliyor | `PENDING` |
| 17 | TargetFingerprint strength/ambiguity/drift validation var | `PENDING` |
| 18 | rowIndexHint/text-only zayıf target warning/error üretiyor | `PENDING` |
| 19 | Expected/interrupt surfaces UiWaitPlan'a compile ediliyor | `PENDING` |
| 20 | UiWaitPlan bounded wait_any request'e dönüşebilir | `PENDING` |
| 21 | Full dump hot path reddediliyor | `PENDING` |
| 22 | wait_any/cancel_request capability fallback veya error üretiyor | `PENDING` |
| 23 | Continue Gate ve Final Oracle planda ayrı | `PENDING` |
| 24 | Unified OracleRequirement kullanılıyor; paralel string listeler reddediliyor | `PENDING` |
| 25 | Evidence authority/correlation/freshness compilation var | `PENDING` |
| 26 | HTTP 2xx business success sayılmıyor | `PENDING` |
| 27 | Derived graph/reducer digest plan hash/provenance'a dahil | `PENDING` |
| 28 | Fact delivery lane plana yazılıyor | `PENDING` |
| 29 | ORDERED_REQUIRED fact receipt-only gate'e bağlanırsa compile fail | `PENDING` |
| 30 | Test Profile expansion aynı compiler path'ini kullanıyor | `PENDING` |
| 31 | Profile yeni runner/engine/Oracle path'i isterse fail | `PENDING` |
| 32 | Fault trigger correlation yoksa fail | `PENDING` |
| 33 | Differential baseline/source-map compilation var | `PENDING` |
| 34 | ResourceRequirementRef/DomainDependencyRef compile ediliyor; lease runtime yok | `PENDING` |
| 35 | Dependency failure BLOCKED olarak modelleniyor; sahte FAILED yok | `PENDING` |
| 36 | Nesy 6 vertical slice compile fixture'ları var | `PENDING` |
| 37 | OPEN_STOP canonical plan safeguards taşır | `PENDING` |
| 38 | COURIER_LOGIN setup/login ayrımı compile edilir | `PENDING` |
| 39 | TOUR_APPROVAL_LIFECYCLE multi-actor remote evidence planı taşır | `PENDING` |
| 40 | Compiler package Core/Bridge business leakage göstermiyor | `PENDING` |
| 41 | Compiler executor/runtime export etmiyor | `PENDING` |
| 42 | Compiler hiçbir cihaz action'ı çalıştırmıyor | `PENDING` |

## 11. Blocker policy

Phase 4C şu durumlarda `COMPLETED` olamaz:

- Phase 4B incomplete.
- Compiler paketi yok.
- Plan hash nondeterministic.
- Source-map kırık.
- UiWaitPlan yok veya full-dump hot path üretiyor.
- Domain macro business primitive olarak BridgeFlowPlan'a sızıyor.
- Unbounded loop/wait veya unsafe retry geçiyor.
- Continue Gate/Final Oracle birleşiyor.
- Test Profile yeni runner/engine istiyor ve compiler bunu kabul ediyor.
- Compiler executor/device action çağırıyor.
- Typecheck/test/lint/build kırmızı.

Şu durumlar Phase 4C'yi otomatik fail etmez:

- CP3-DUT/B-12 external device blocker açık.
- Phase 5 executor/persistence yok.
- Phase 6 UI yok.
- Maestro hâlâ aktif runtime ise, çünkü cutover Phase 9 işi.

## 12. Final handoff expectation

İdeal kapanış:

```text
Phase 4C: COMPLETED
CHECKPOINT 4C: PASSED
Phase 5 readiness: READY_WITH_EXTERNAL_BLOCKERS
Reason: compiler deterministic, source-mapped, capability-aware and device-action-free; external DUT blockers remain for executor/cutover.
```
