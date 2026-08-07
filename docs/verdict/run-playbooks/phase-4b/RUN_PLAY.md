# Phase 4B RUN_PLAY — Domain Pack Contracts + Nesy Courier Reference Pack

```yaml
runPlayId: verdict-cockpit-phase-4b-run-play
phase: "4B"
phaseName: "Domain Pack Contracts + Nesy Courier Domain Pack + App Adapter Contracts"
status: COMPLETED
recoveryState: COMPLETED
createdAt: "2026-08-05 12:34:03 +03"
startedAt: "2026-08-05 12:49:05 +03"
completedAt: "2026-08-05 13:45:26 +03"
lastUpdatedAt: "2026-08-05 14:04:53 +03"
timezone: "Europe/Istanbul"
masterPlanPath: "docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:b81631396044cab7f83f6b6efea2f47ff4b4bda4b177b2d7a2ad705535b660b2"
verifyMasterPlanCommand: "pnpm verdict:verify-master-plan"
previousPhaseResult: "docs/verdict/run-playbooks/phase-4a/RESULT.md"
resultFile: "docs/verdict/run-playbooks/phase-4b/RESULT.md"
phase4AStatusRequired: "COMPLETED"
phase4BTarget: "CP4B-Core"
phase4CReadinessTarget: "READY_WITH_EXTERNAL_BLOCKERS"
blockingPreflight:
  - id: "CP3-DUT"
    status: "OPEN_EXTERNAL"
    meaning: "Phase 3 real DUT mutation acceptance hâlâ external; Phase 4B contract/domain pack işini bloklamaz, Phase 5+ executor/cutover öncesi kapanmalı."
  - id: "B-12"
    status: "OPEN_EXTERNAL"
    meaning: "Production cihaz smoke handshake flaky; Mobile/Bridge investigation olarak taşınır."
  - id: "B-14"
    status: "OPEN_LOW"
    meaning: "runEpoch birimi Bridge protocol v2 içinde açık yazılmalı; Phase 4B domain contract çalışmasını bloklamaz."
  - id: "B-8"
    status: "OPEN_NON_BLOCKING"
    meaning: "Repo-wide lint ESLint v9 flat-config borcu; yeni paketler kendi lint/typecheck/test gate'lerinden geçmelidir."
```

## 1. Şu an hangi kısımdayız?

Phase 0, Phase 1, Phase 2, Phase 2B, Phase 3 ve Phase 4A implementation tamamlandı.
Phase 4A sonunda shared, generic ve domain-neutral `@nesy/workflow-contract`
oluşturuldu. Artık Domain Pack contract ve Nesy Courier reference pack yazılabilir.

```text
Phase 0: baseline ve blocker inventory
Phase 1: typecheck + CI gate
Phase 2: durable event runtime
Phase 2B: Prisma baseline migration repair
Phase 3: Bridge Host Client + Device Preflight implementation
Phase 4A: WorkflowIR v2 + Condition Engine + Core Outcome Contracts COMPLETE
Phase 4B: Domain Pack Contracts + Nesy Courier Reference Pack COMPLETE
Next after 4B: Phase 4C Domain-aware BridgeFlowCompiler
```

Phase 4B'nin critical path'i master plana göre **CP4B-Core** olarak yürütülür.
Bu fazın amacı, Core'a veya Bridge'e Nesy business tipi sızdırmadan Domain Pack
modelini typed contract, deterministic bundle ve Nesy Courier reference
implementation seviyesine getirmektir.

## 1.1 AI agent'a verilecek başlangıç metni

Aşağıdaki prompt başka bir AI agent'a doğrudan verilebilir. Prompt bilinçli olarak
uzundur; agent'ın master planı komple context'e yapıştırmadan Phase 4B sınırlarını
doğru anlaması için yazılmıştır. Yine de agent repo içindeki ilgili dosyaları
okumadan kod yazmamalıdır.

```text
Verdict Cockpit Phase 4B'yi uygula.

Önce şu dosyayı tamamen oku:
docs/verdict/run-playbooks/phase-4b/RUN_PLAY.md

Sonra şu dosyayı oku ve çalışmaya başlarken YAML frontmatter/result alanlarını
IN_PROGRESS olarak güncelle:
docs/verdict/run-playbooks/phase-4b/RESULT.md

Önceki faz sonucunu oku:
docs/verdict/run-playbooks/phase-4a/RESULT.md

Master planda özellikle şu bölümleri oku:
- D.6B Domain Pack contract ve registry
- D.6C Nesy Courier Domain Pack ve App Adapter
- D.6E Evidence Source Registry ve Normalization Runtime, yalnız CP4B-Core için gerekli contract kısmı
- FAZ 4B — Domain Pack ve Nesy App Adapter
- CHECKPOINT 4B — Domain Pack tamamlandı
- H.9 İlk uygulanacak iş sırası

Bu fazın hedefi CP4B-Core'dur:
- packages/domain-pack-contracts package'i oluştur.
- Domain Pack manifest, Application/Screen/Surface/Entity/Target Registry contract'larını yaz.
- Target Resolution Provider Chain contract'ını yaz.
- Semantic Action/Macro contract'ını yaz.
- Evidence Source Registry contract'ını yaz.
- LaunchProfile, TestProfileDefinition ve minimal Campaign/Profile contract'larını yaz.
- FeatureAuthoringMetadata ile FeatureExecutableContract ayrımını yaz.
- CapabilityContract katmanlarını yaz: `verdict.core` ve generic `domain.<pack>`. Shared contract içinde gerçek müşteri/tenant adı hardcode etme.
- Domain Pack deterministic canonical serialization/digest/immutable bundle contract'ını yaz.
- Runtime arbitrary TypeScript/JavaScript execution'ını reddeden validation yaz.
- Domain Pack'in RunManifest/TestExecution/Lease/ResourceLease/SchedulerDisposition/full ImpactGraph gibi execution/scheduler tiplerini taşımadığını contract testleriyle koru.
- domain-packs/nesy-courier altında Nesy Courier reference Domain Pack iskeletini oluştur.
- NESY_COURIER_DOMAIN_PACK_REFERENCE_V1 artifact'ini oluştur ve bundle/test fixture'larına bağla.
- Reference artifact içinde altı vertical slice bulunmalı:
  1. COURIER_LOGIN
  2. SELECT_ROUTE
  3. OPEN_STOP
  4. PROCESS_PARCEL
  5. COMPLETE_DELIVERY
  6. TOUR_APPROVAL_LIFECYCLE
- Her slice için business meaning, notResponsibleFor, input/output schema, precondition, screen/surface, entity binding, target resolution, macro expansion, Continue Gate, Final Oracle, interrupt policy, required capability, source-map, Generic IR snapshot ve BridgeFlowPlan snapshot taşı.
- OPEN_STOP canonical macro'su STOP input entity almalı, hedef stop'un nesy.availableStops içinde varlığını doğrulamalı, nesy.target.stop-row Target Resolution Provider Chain kullanmalı, ambiguous target'ta dokunmadan fail etmeli, TASK_LIST veya DELIVERY readiness beklemeli ve APP.ACTIVE_STOP_MATCHES ile yanlış satır açılmasını yakalamalı.
- COURIER_LOGIN gerçek login testi ile PREPARED_SESSION/DIRECT_STATE setup girişlerini ayırmalı; setup/prepared launch profile login PASS'i üretemez.
- TOUR_APPROVAL_LIFECYCLE multi-actor model taşımalı: kurye Mobile UI'da tur onayı ister, dispatcher/supervisor Nesy Backoffice Adapter üzerinden typed REMOTE_ACTION ile iki backend servis/fact doğrulaması yapar. HTTP 2xx tek başına business success değildir; backend entity status + correlation gerekir. Gerçek tur onayı testi ile setup/precondition modu ayrı verdict semantics taşımalıdır.
- Nesy Backoffice Adapter operationRef'leri allowlisted/typed/audited olmalı; raw HTTP script'i veya görünmez setup hook'u kabul edilmemeli.
- Existing Mobile automation kavramlarını sadece App Adapter manifest/contract seviyesine bağla. Mobile repo'ya yazman gerekirse önce current state'i oku, yazılacak path'i RESULT'a yaz, automation-only/release-isolation kuralını koru ve ikinci business automation motoru oluşturma.

Başlamadan önce mutlaka:
- pnpm verdict:verify-master-plan
- git status --short --branch
- pnpm typecheck
- pnpm test
- rg -n "OPEN_STOP|COURIER_LOGIN|STOP|PARCEL|DELIVERY|TOUR_APPROVAL" packages/workflow-contract packages/bridge-contract packages/bridge-client apps/api/src/services
komutlarını çalıştır ve RESULT.md'ye baseline yaz.

Kesin kurallar:
- Phase 4C compiler yazma. Domain macro -> generic IR expansion snapshot olabilir, production compiler kabul edilmez.
- Phase 5 executor/run queue/Test Data Broker/lease runtime yazma. Bu fazda sadece CP4B-Core contract/ref alanı yazılır.
- Phase 6 Domain Pack manager UI yazma. API DTO/contract seam yazılabilir, UI route zorunlu değil.
- Maestro removal veya live Cockpit cutover yapma.
- packages/workflow-contract, packages/bridge-contract ve Bridge protocol içine Nesy business command/type sokma.
- packages/domain-pack-contracts içine RunManifest, TestExecution, Lease, ResourceLease, SchedulerDisposition veya full ImpactGraph tipi koyma.
- FeatureAuthoringMetadata değişikliği executable digest'i değiştirmemeli; FeatureExecutableContract değişikliği deterministik digest değiştirmeli.
- Reusable Flow Fragment terminal product verdict üretemez; Independent Test Workflow ayrı occurrence/evidence/oracle snapshot taşır.
- AI_SUGGESTED invariant release gate'e bağlanamaz; PRODUCT_APPROVED veya TECHNICAL_DEFAULT authority gerekir.
- HTTP 2xx tek başına business fact üretmez.
- rowIndex tek başına Target Resolution strategy olamaz; yalnız son hint olabilir.
- Queue ayrı evidence plane değildir; LOCAL plane içinde offline queue evidence türüdür.
- APP_STATE ayrı plane değildir; APP plane içinde SDK state/provider/derived fact kaynağıdır.
- Raw canonical evidence korunmalı; normalized fact derivation trace ile üretilmelidir.
- Runtime arbitrary Domain Pack TypeScript/JavaScript çalıştırmamalıdır; published bundle declarative ve deterministic olmalıdır.

Önerilen owned paths:
- packages/domain-pack-contracts/**
- domain-packs/nesy-courier/**
- apps/api/src/services/domain-pack-*.ts
- apps/api/src/services/domain-pack-*.test.ts
- apps/web/src/lib/domain-pack-*.ts
- apps/web/src/lib/domain-pack-*.test.ts
- docs/verdict/run-playbooks/phase-4b/**
- package.json / pnpm-lock.yaml / turbo config gerekiyorsa

Dokunulmaması gerekenler:
- packages/workflow-contract/** sadece import/compat test gerekiyorsa minimal okunur; business type eklenmez.
- packages/bridge-contract/** ve packages/bridge-client/** business command eklenmez.
- apps/api/src/services/workflow-runner.ts veya maestro-executor.ts cutover yapılmaz.
- Mobile repo'ya sadece açık App Adapter seam ihtiyacı varsa ve automation-only/release-isolation sınırı netse dokun.

Kapanışta RESULT.md dosyasına:
- changed files
- komut çıktıları
- test evidence
- acceptance checklist
- açık blocker listesi
- CP4B completed / ready_with_blockers kararı
- Phase 4C readiness kararı
yaz.

Son doğrulamada en az:
- pnpm verdict:verify-master-plan
- pnpm typecheck
- pnpm test
- pnpm --filter @nesy/domain-pack-contracts typecheck
- pnpm --filter @nesy/domain-pack-contracts test
- pnpm --filter @nesy/domain-pack-contracts lint
- ilgili domain pack test komutu
- git diff --check
- git diff --cached --check
çalıştır.
```

## 2. Amaç

Phase 4B'nin amacı, WorkflowIR v2 üzerine domain layer'ı güvenli biçimde oturtmaktır:

```text
WorkflowIR v2 Core Contract
  ↓
Domain Pack Contracts
  ↓
Nesy Courier Domain Pack Reference
  ↓
Canonical semantic macro snapshots
  ↓
Phase 4C compiler için hazır source-map ve registry input'ları
```

Bu faz, Nesy'ye özel node'ları Core'a ekleme fazı değildir. Nesy kavramları yalnız
Domain Pack içinde bulunur; Core/Bridge generic primitive çalıştırır.

## 3. Neden bu sırada?

Master planın bağlayıcı sırası:

```text
4A WorkflowIR v2
  → 4B Domain Pack contracts + Nesy App Adapter
  → 4C Domain-aware BridgeFlowCompiler
  → 5 BridgeFlowExecutor / Oracle Runtime
  → 6 Cockpit UI surfaces
```

Phase 4A shared IR'ı dondurdu. Phase 4B bu IR'ın üstüne Domain Pack sözleşmesini
kurar. Compiler Phase 4B'den önce yazılırsa semantic node expansion'ı eksik
registry'lere göre kodlanır ve Nesy-specific davranış compiler'a sızar.

## 4. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `4B` |
| Current step | `4B.20` |
| Current state | `COMPLETED` |
| Last successful step | `4B.20` |
| Last attempted step | `4B.20` |
| Last update | `2026-08-05 14:04:53 +03` |
| Recovery instruction | `Phase 4B bitti. RESULT.md 40/40 PASS ve Phase 4C readiness READY_WITH_EXTERNAL_BLOCKERS gösteriyor. Sıradaki iş Phase 4C RUN_PLAY: Domain macro → Generic WorkflowIR v2 → BridgeFlowPlan compiler.` |

Step sonuçları:

| Step | Sonuç |
|---|---|
| 4B.0 Playbook oluşturma | `DONE` |
| 4B.1 Preflight ve Phase 4A gate doğrulama | `DONE` |
| 4B.2 Existing domain/app-adapter inventory | `DONE` |
| 4B.3 Package boundary kararı | `DONE` |
| 4B.4 `packages/domain-pack-contracts` scaffold | `DONE` |
| 4B.5 Manifest/Application compatibility contract | `DONE` |
| 4B.6 Screen/Surface Registry contract | `DONE` |
| 4B.7 Entity/Target Resolution Provider Chain contract | `DONE` |
| 4B.8 Semantic Action/Macro + source-map contract | `DONE` |
| 4B.9 Evidence Source Registry + normalized fact derivation contract | `DONE` |
| 4B.10 LaunchProfile/TestProfile/Campaign contract | `DONE` |
| 4B.11 Feature Blueprint + Capability Contract boundary | `DONE` |
| 4B.12 Deterministic bundle/digest/immutability validation | `DONE` |
| 4B.13 Execution/impact leakage negative tests | `DONE` |
| 4B.14 `domain-packs/nesy-courier` scaffold | `DONE` |
| 4B.15 Nesy registries and capability catalog | `DONE` |
| 4B.16 Nesy App Adapter contract/ref mapping | `DONE` |
| 4B.17 `NESY_COURIER_DOMAIN_PACK_REFERENCE_V1` artifact | `DONE` |
| 4B.18 Six vertical-slice fixtures/snapshots | `DONE` |
| 4B.19 Domain-neutral leakage scans | `DONE` |
| 4B.20 Verification/result/handoff | `DONE` |

## 5. Phase 4B scope

### 5.1 CP4B-Core kapsamında yapılacaklar

1. `packages/domain-pack-contracts` oluşturulacak.
2. Formal Domain Pack manifest ve compatibility modeli yazılacak.
3. Application Registry:
   - application key
   - package/application identity
   - app-version compatibility range
   - adapter compatibility
   - capability requirements
4. Screen Registry:
   - logical screen key
   - Activity/Fragment/Compose/WebView/runtime implementation union
   - entry strategies
   - readiness contract
   - supported surfaces/actions
   - design/app-version compatibility
5. Surface Registry:
   - DIALOG / BOTTOM_SHEET / SYSTEM_OVERLAY / SCANNER / WEBVIEW_OVERLAY / POPUP
   - parent screen relation
   - detection/readiness contract
   - priority
   - default policy: HANDLE / IGNORE / FAIL / OPERATOR_ATTENTION
6. Entity Registry:
   - typed business entity definitions
   - stable business key
   - identity/correlation/freshness/redaction policy
7. Target Resolution Provider Chain:
   - ACCESSIBILITY_ID
   - ENTITY_BINDING
   - INSPECTOR_MAPPING
   - STRUCTURAL_FINGERPRINT
   - rowIndexHint only as final hint, never primary identity
   - ambiguity policy fail-closed
8. Semantic action/macro contract:
   - domain authoring node
   - generic WorkflowIR v2 expansion
   - source map
   - capability requirements
   - input/output validation
   - allowed registry refs
9. Evidence Source Registry:
   - plane: UI / APP / LOCAL / REMOTE
   - source kind: bridge watch, SDK event/state, named query, network operation,
     database verifier, remote validator, derived fact
   - authority: primary / confirmatory / fallback
   - correlation/freshness/redaction/normalization
   - raw evidence preservation and normalized fact derivation trace
10. Domain Oracle Template:
    - Continue Gate
    - Final Oracle
    - unified OracleRequirement
    - eventual/warning/onTimeout semantics
11. Launch Profile:
    - COLD_START / WARM_START / REUSE_SESSION
    - preconditions
    - deep link / test gateway / workflow entry
    - expected screen/surface readiness
    - cleanup and automation-only contract
12. Test Profile/Campaign contract:
    - versioned profile definitions
    - release gate semantics
    - preview profile cannot affect release GO/NO_GO
    - fault plan correlation requirement
    - differential baseline requirement
13. Feature Blueprint/Capability Contract:
    - authoring metadata vs executable contract digest split
    - capability catalog layers
    - AI_SUGGESTED invariant cannot bind release gate
    - reusable fragment vs independent test workflow
14. Deterministic bundle:
    - canonical serialization
    - SHA-256 digest
    - immutable published version
    - active-run hot reload isolation contract
    - no arbitrary JS/TS runtime execution
15. Nesy Courier pack:
    - manifest
    - Application/Screen/Surface/Entity/Target definitions
    - capabilities
    - evidence sources
    - launch/test profiles
    - App Adapter refs
    - canonical reference artifact and fixtures

### 5.2 CP4B'de yapılmayacaklar

Şu işler önemli ama bu fazın blocking scope'u değildir:

```text
Run Manifest runtime
Execution Queue runtime
Lease/heartbeat scheduler
Test Data Broker runtime
Full Impact Graph runtime
Full Coverage Graph runtime
Full Component Registry UI
Cross-feature second-domain production catalog
PR impact selection runtime
BridgeFlowCompiler production implementation
BridgeFlowExecutor production implementation
Cockpit Domain Pack Manager UI
Maestro removal
Live workflow cutover
```

Bu işler sırasıyla Phase 4C, Phase 5, Phase 6 ve Phase 7+ kapılarına bağlıdır.

## 6. Owned paths

Phase 4B agent'ı aşağıdaki path'lerde değişiklik yapabilir:

```text
packages/domain-pack-contracts/**
domain-packs/nesy-courier/**
apps/api/src/services/domain-pack-*.ts
apps/api/src/services/domain-pack-*.test.ts
apps/web/src/lib/domain-pack-*.ts
apps/web/src/lib/domain-pack-*.test.ts
docs/verdict/run-playbooks/phase-4b/**
package.json
pnpm-lock.yaml
turbo.json
```

Koşullu ve dikkatli path'ler:

```text
packages/workflow-contract/**
packages/bridge-contract/**
packages/bridge-client/**
apps/api/src/services/workflow-ir-v2.ts
apps/web/src/lib/workflow-ir-v2-client.ts
```

Bu path'lerde yalnız compatibility import/test eklenebilir. Business type/command
eklemek yasaktır.

Mobile repo:

```text
/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/
```

Mobile repo'ya yazmak Phase 4B'de otomatik yetki değildir. Gerekirse önce mevcut
`NesyCommands`, state provider, room query, structured event ve automation-only
source set inventory çıkarılmalı; sonra App Adapter seam'i bounded ve release
isolation kurallarıyla yazılmalıdır. Mobile tarafında business runner, workflow
engine veya ikinci otomasyon motoru kurulamaz.

## 7. Package boundary rules

### 7.1 `packages/domain-pack-contracts`

Bu paket yalnız Domain Pack authoring/executable contract tiplerini taşır:

```text
DomainPackManifest
ApplicationDefinition
ScreenDefinition
SurfaceDefinition
EntityDefinition
TargetDefinition
TargetResolutionPolicy
EvidenceSourceDefinition
DerivedFactDefinition
SemanticActionDefinition
MacroDefinition
DomainOracleTemplate
LaunchProfile
TestProfileDefinition
TestCampaignDefinition
FeatureAuthoringMetadata
FeatureExecutableContract
FeatureBlueprint
CapabilityContract
ReusableFlowFragmentDefinition
IndependentTestWorkflowDefinition
ResourceRequirementRef
DomainDependencyRef
DomainImpactRef
```

### 7.2 Yasak tipler

`packages/domain-pack-contracts` içine şunlar giremez:

```text
RunManifest
TestExecution
Lease
ResourceLease
SchedulerDisposition
ExecutionLifecycle
WorkerHeartbeat
DependencyExecutionState
Full ImpactGraph
CoverageGraph runtime state
```

Bunlar Phase 5/6 execution/impact packages veya runtime işidir.

### 7.3 Core/Bridge leakage yasağı

Şu kelimeler `packages/workflow-contract`, `packages/bridge-contract`,
`packages/bridge-client` ve generic runtime contract yüzeyine business type/command
olarak sızamaz:

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
PAYMENT
FISCAL
```

Bu kelimeler yalnız Domain Pack ve reference fixture/artifact içinde bulunabilir.

## 8. Nesy Courier Reference Pack minimum içerik

### 8.1 Registries

Nesy Courier pack en az şunları tanımlamalıdır:

```text
Application:
  nesy.courier.mobile

Screens:
  nesy.auth.login
  nesy.route.stop-list
  nesy.stop.task-list
  nesy.delivery.flow
  nesy.pickup.flow
  nesy.vehicle-loading
  nesy.end-of-day

Surfaces:
  nesy.route.selection-dialog
  nesy.mandatory-update-dialog
  nesy.session-expired-dialog
  nesy.permission-dialog
  nesy.network-dialog
  nesy.scanner.surface
  nesy.payment.surface
  nesy.fiscal.surface

Entities:
  ROUTE
  STOP
  TASK
  SHIPMENT
  PARCEL
  PENDING_OPERATION
  TOUR_APPROVAL_REQUEST
```

### 8.2 Evidence facts

Minimum normalized facts:

```text
REMOTE.AUTH_ACCEPTED
LOCAL.USER_SESSION_AVAILABLE
APP.USER_SESSION_AVAILABLE
REMOTE.ROUTES_AVAILABLE
UI.ROUTE_DIALOG_READY
APP.ACTIVE_STOP_MATCHES
LOCAL.OFFLINE_QUEUE_ITEM_WAITING
REMOTE.DELIVERY_CONFIRMED
APP.TOUR_APPROVAL_REQUESTED
REMOTE.TOUR_APPROVAL_REQUEST_CREATED
REMOTE.TOUR_APPROVAL_STATUS_APPROVED
APP.TOUR_APPROVAL_PUSH_RECEIVED
```

Queue ayrı evidence plane değildir. Offline queue, `LOCAL` plane içinde evidence
türüdür.

### 8.3 Reference vertical slices

`NESY_COURIER_DOMAIN_PACK_REFERENCE_V1` altı slice taşır:

1. `COURIER_LOGIN`
2. `SELECT_ROUTE`
3. `OPEN_STOP`
4. `PROCESS_PARCEL`
5. `COMPLETE_DELIVERY`
6. `TOUR_APPROVAL_LIFECYCLE`

Her slice için minimum alanlar:

```text
businessMeaning
notResponsibleFor
inputSchema
outputSchema
preconditions
screenRefs
surfaceRefs
entityBindings
targetResolution
semanticMacro
genericIrSnapshot
bridgeFlowPlanSnapshot
continueGate
finalOracle
interruptPolicy
requiredCapabilities
sourceMap
releaseIsolation
negativeCases
```

## 9. Nesy App Adapter sınırı

App Adapter şunları yapabilir:

```text
bounded named query
session/fixture preparation
scanner injection capability declaration
state projection
critical event seam
selected entity → UI target binding
release-isolation assertion
```

App Adapter şunları yapamaz:

```text
workflow branch engine
UI action executor
business decision runner
open stop imperative motoru
delivery orchestration motoru
hidden backend mutation hook
raw HTTP script runner
second Maestro replacement
```

UI action Bridge'de, semantic expansion Domain Pack'te, karar Cockpit runtime'da,
durable evidence SDK/Bridge/Cockpit evidence pipeline'ında kalır.

## 10. Step plan

### 4B.1 Preflight ve Phase 4A gate doğrulama

Komutlar:

```bash
pnpm verdict:verify-master-plan
git status --short --branch
pnpm typecheck
pnpm test
```

Kontroller:

- Phase 4A RESULT `COMPLETED`.
- Master digest `sha256:b81631396044cab7f83f6b6efea2f47ff4b4bda4b177b2d7a2ad705535b660b2`.
- `packages/workflow-contract` mevcut ve testleri yeşil.
- Existing staged/unstaged değişiklikler not edilir, kullanıcı değişikliği ezilmez.

### 4B.2 Existing domain/app-adapter inventory

Okunacak alanlar:

```text
apps/api/src/services/workflow-ir-v2.ts
apps/web/src/lib/workflow-ir-v2-client.ts
packages/workflow-contract/src/**
verdict-contract-fixtures/**
/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/  (read-only inventory)
```

Amaç:

- Mevcut Nesy command/state/query/event isimleri çıkarılır.
- Bunların hangisinin Domain Pack fact/source/action/adapter ref olacağı belirlenir.
- Mobile repo'ya yazmadan önce release-isolation riski listelenir.

### 4B.3 Package boundary kararı

Karar:

```text
packages/domain-pack-contracts = authoring/executable contract
domain-packs/nesy-courier = first-party Nesy pack
execution runtime = Phase 5+
impact/coverage runtime = Phase 6+
compiler = Phase 4C
```

### 4B.4 `packages/domain-pack-contracts` scaffold

Beklenen dosyalar:

```text
packages/domain-pack-contracts/package.json
packages/domain-pack-contracts/tsconfig.json
packages/domain-pack-contracts/eslint.config.js
packages/domain-pack-contracts/vitest.config.ts
packages/domain-pack-contracts/src/index.ts
packages/domain-pack-contracts/src/*.ts
packages/domain-pack-contracts/src/index.test.ts
packages/domain-pack-contracts/fixtures/**
```

### 4B.5 Manifest/Application compatibility contract

Contract:

```text
DomainPackManifest
DomainPackVersion
ApplicationDefinition
AppAdapterCompatibility
AppVersionCompatibility
DomainPackCapabilityRequirement
PublishedBundleProvenance
```

Acceptance:

- Missing app compatibility fail.
- Unsupported app version fail.
- Published bundle mutable metadata fail.
- Third-party/runtime-code feature gate fail.

### 4B.6 Screen/Surface Registry contract

Contract:

```text
ScreenDefinition
RuntimeImplementation union
EntryStrategy
ReadinessContract
SurfaceDefinition
SurfaceKind
SurfacePolicy
```

Acceptance:

- Dialog/surface screen olarak tanımlanırsa fail.
- Surface parent screen compatibility yoksa fail.
- Same-priority interrupt tie-break deterministic.

### 4B.7 Entity/Target Resolution Provider Chain contract

Contract:

```text
EntityDefinition
TargetDefinition
TargetResolutionPolicy
TargetResolutionStrategy
AmbiguityPolicy
EntityBindingDefinition
```

Acceptance:

- rowIndex primary identity olarak kullanılırsa fail.
- ambiguity policy default `FAIL`.
- selected entity binding bounded ve redacted.

### 4B.8 Semantic Action/Macro + source-map contract

Contract:

```text
SemanticActionDefinition
MacroDefinition
MacroInputSchema
MacroOutputSchema
MacroExpansionSnapshot
DomainSourceMap
```

Acceptance:

- Macro generic WorkflowIR v2 dışına çıkamaz.
- Macro source-map domain node → generic step → runtime occurrence zincirini taşır.
- Reusable fragment terminal product verdict üretemez.

### 4B.9 Evidence Source Registry + normalized fact derivation contract

Contract:

```text
EvidenceSourceDefinition
EvidencePlane
EvidenceSourceKind
EvidenceAuthority
FreshnessPolicy
CorrelationPolicy
RedactionPolicy
DerivedFactDefinition
DerivedFactGraph
ReducerProvenance
```

Acceptance:

- HTTP 2xx tek başına business success fact üretemez.
- Raw canonical evidence silinmez; normalized fact derivation trace taşır.
- Derived fact cycle/self/undefined input fail.
- Queue ayrı plane değildir; `LOCAL` evidence source türüdür.

### 4B.10 LaunchProfile/TestProfile/Campaign contract

Contract:

```text
LaunchProfile
TestProfileDefinition
TestCampaignDefinition
FaultPlan
TelemetryPolicy
DifferentialPolicy
PerformanceBudgetRef
```

Acceptance:

- PREPARED_SESSION/DIRECT_STATE product PASS üretemez.
- Preview profile releaseGate=false olmak zorunda.
- Recovery/Bad Day fault trigger correlation yoksa fail.
- Differential profile baseline build ve critical fact diff policy olmadan fail.

### 4B.11 Feature Blueprint + Capability Contract boundary

Contract:

```text
FeatureAuthoringMetadata
FeatureExecutableContract
FeatureBlueprint
FeatureInvariant
CapabilityContract
IndependentTestWorkflowDefinition
ReusableFlowFragmentDefinition
```

Acceptance:

- Authoring metadata değişikliği executable digest'i değiştirmez.
- Executable contract değişikliği deterministic digest değiştirir.
- AI_SUGGESTED invariant release gate'e bağlanırsa fail.
- Domain capability kanıtsız core/shared kataloğa terfi edemez.

### 4B.12 Deterministic bundle/digest/immutability validation

Contract:

```text
DomainPackBundle
BundleDigest
CanonicalSerialization
PublishedVersion
ActiveRunPinnedBundleRef
RuntimeCodePolicy
```

Acceptance:

- Same input same SHA-256 digest.
- Published bundle mutate edilemez.
- Arbitrary JS/TS source/runtime eval/function string fail.
- Active run pinned bundle hot reload ile değişmez.

### 4B.13 Execution/impact leakage negative tests

Acceptance:

- `packages/domain-pack-contracts` içinde yasak execution/scheduler tipleri yok.
- Domain Pack manifest execution lease state taşımaz.
- `packages/workflow-contract` ve Bridge packages içinde business command/type yok.
- Full ImpactGraph runtime state Domain Pack package'ına girmez.

### 4B.14 `domain-packs/nesy-courier` scaffold

Beklenen dosyalar:

```text
domain-packs/nesy-courier/package.json
domain-packs/nesy-courier/tsconfig.json
domain-packs/nesy-courier/eslint.config.js
domain-packs/nesy-courier/vitest.config.ts
domain-packs/nesy-courier/src/index.ts
domain-packs/nesy-courier/src/manifest.ts
domain-packs/nesy-courier/src/registries/*.ts
domain-packs/nesy-courier/src/macros/*.ts
domain-packs/nesy-courier/src/evidence/*.ts
domain-packs/nesy-courier/src/profiles/*.ts
domain-packs/nesy-courier/docs/NESY_COURIER_DOMAIN_PACK_REFERENCE_V1.md
domain-packs/nesy-courier/fixtures/**
```

### 4B.15 Nesy registries and capability catalog

Nesy definitions:

- application manifest
- seven minimum screens
- eight minimum surfaces
- entity registry
- target refs
- evidence facts
- capability refs

### 4B.16 Nesy App Adapter contract/ref mapping

Minimum:

```text
nesy.availableStops
nesy.stopState
nesy.taskState
nesy.parcelState
nesy.pendingOperation
scanner capability: real / injected / manual_dialog
prepared session capability
direct state capability
backoffice approve-tour adapter operations
```

### 4B.17 `NESY_COURIER_DOMAIN_PACK_REFERENCE_V1` artifact

Artifact reviewed-ready olmalıdır. Snapshot'lar elle yazılmış örnek olabilir; Phase
4C compiler gelene kadar production compiler output'u beklenmez. Ancak snapshot'lar
generic WorkflowIR v2 shape'ine uymalı ve source-map trace etmelidir.

### 4B.18 Six vertical-slice fixtures/snapshots

Fixture'lar:

```text
courier-login.reference.json
select-route.reference.json
open-stop.reference.json
process-parcel.reference.json
complete-delivery.reference.json
tour-approval-lifecycle.reference.json
invalid-setup-produces-verdict.json
invalid-row-index-primary-target.json
invalid-http-2xx-business-success.json
invalid-domain-execution-leakage.json
```

### 4B.19 Domain-neutral leakage scans

Minimum taramalar:

```bash
rg -n "OPEN_STOP|COURIER_LOGIN|SELECT_ROUTE|PROCESS_PARCEL|COMPLETE_DELIVERY|TOUR_APPROVAL|APPROVE_TOUR|STOP|PARCEL|SHIPMENT|DELIVERY|COURIER|ROUTE" packages/workflow-contract packages/bridge-contract packages/bridge-client
rg -n "RunManifest|TestExecution|Lease|ResourceLease|SchedulerDisposition|WorkerHeartbeat|ExecutionLifecycle|ImpactGraph" packages/domain-pack-contracts/src
```

Beklenen:

- Core/Bridge taraması business leakage göstermemeli.
- Domain Pack contract taraması forbidden execution/scheduler type göstermemeli.

### 4B.20 Verification/result/handoff

Minimum komutlar:

```bash
pnpm verdict:verify-master-plan
pnpm typecheck
pnpm test
pnpm --filter @nesy/domain-pack-contracts typecheck
pnpm --filter @nesy/domain-pack-contracts test
pnpm --filter @nesy/domain-pack-contracts lint
pnpm --filter @nesy/nesy-courier-domain-pack typecheck
pnpm --filter @nesy/nesy-courier-domain-pack test
pnpm --filter @nesy/nesy-courier-domain-pack lint
git diff --check
git diff --cached --check
```

## 11. Acceptance checklist

| # | Acceptance | Status |
|---|---|---|
| 1 | Phase 4A RESULT `COMPLETED` doğrulandı | `PASS` |
| 2 | Master plan digest doğrulandı | `PASS` |
| 3 | `packages/domain-pack-contracts` package'i var | `PASS` |
| 4 | Domain Pack manifest/version/app compatibility contract var | `PASS` |
| 5 | Screen Registry formal contract var | `PASS` |
| 6 | Surface Registry ayrı formal contract var | `PASS` |
| 7 | Entity Registry formal contract var | `PASS` |
| 8 | Target Resolution Provider Chain contract var | `PASS` |
| 9 | rowIndex primary identity olarak reddediliyor | `PASS` |
| 10 | Semantic Action/Macro contract ve source-map var | `PASS` |
| 11 | Evidence Source Registry contract var | `PASS` |
| 12 | Raw evidence ile normalized fact ayrımı var | `PASS` |
| 13 | Derived Fact DAG cycle/self/undefined input reddediyor | `PASS` |
| 14 | Continue Gate / Final Oracle Domain Oracle Template'te ayrı | `PASS` |
| 15 | LaunchProfile setup vs real product verdict ayrımını taşıyor | `PASS` |
| 16 | TestProfile preview/release/fault/differential policy validation var | `PASS` |
| 17 | FeatureAuthoringMetadata ve FeatureExecutableContract digest ayrımı var | `PASS` |
| 18 | Capability catalog katmanlı | `PASS` |
| 19 | AI_SUGGESTED invariant release gate'e bağlanamıyor | `PASS` |
| 20 | Reusable Flow Fragment terminal verdict üretemiyor | `PASS` |
| 21 | Deterministic bundle serialization/digest var | `PASS` |
| 22 | Published bundle immutable | `PASS` |
| 23 | Runtime arbitrary JS/TS execution negative test var | `PASS` |
| 24 | `packages/domain-pack-contracts` execution/scheduler type leakage göstermiyor | `PASS` |
| 25 | Core/Bridge business command/type leakage göstermiyor | `PASS` |
| 26 | `domain-packs/nesy-courier` package'i var | `PASS` |
| 27 | Nesy application/screen/surface/entity/target registries var | `PASS` |
| 28 | Nesy evidence source definitions var | `PASS` |
| 29 | Nesy launch/test profile definitions var | `PASS` |
| 30 | Nesy App Adapter contract/ref mapping var | `PASS` |
| 31 | `NESY_COURIER_DOMAIN_PACK_REFERENCE_V1` artifact var | `PASS` |
| 32 | Altı vertical slice artifact içinde mevcut | `PASS` |
| 33 | `OPEN_STOP` canonical expansion/spec uyumu test-bound | `PASS` |
| 34 | `COURIER_LOGIN` setup/login ayrımı test-bound | `PASS` |
| 35 | `TOUR_APPROVAL_LIFECYCLE` multi-actor/remote/idempotency/reconciliation contract taşıyor | `PASS` |
| 36 | HTTP 2xx business success sayılmıyor | `PASS` |
| 37 | Queue ayrı evidence plane değil, LOCAL evidence türü | `PASS` |
| 38 | Scanner/DIRECT_STATE release isolation validation var | `PASS` |
| 39 | Domain macro'ları generic IR v2 dışına çıkmıyor | `PASS` |
| 40 | Phase 4C compiler production implementation başlamadı | `PASS` |

## 12. Expected changed files

Tahmini değişiklik listesi:

```text
package.json
pnpm-lock.yaml
packages/domain-pack-contracts/package.json
packages/domain-pack-contracts/tsconfig.json
packages/domain-pack-contracts/eslint.config.js
packages/domain-pack-contracts/vitest.config.ts
packages/domain-pack-contracts/src/index.ts
packages/domain-pack-contracts/src/manifest.ts
packages/domain-pack-contracts/src/application.ts
packages/domain-pack-contracts/src/screen-surface.ts
packages/domain-pack-contracts/src/entity-target.ts
packages/domain-pack-contracts/src/semantic-action.ts
packages/domain-pack-contracts/src/evidence-source.ts
packages/domain-pack-contracts/src/profile.ts
packages/domain-pack-contracts/src/feature-capability.ts
packages/domain-pack-contracts/src/bundle.ts
packages/domain-pack-contracts/src/validate.ts
packages/domain-pack-contracts/src/index.test.ts
packages/domain-pack-contracts/fixtures/**
domain-packs/nesy-courier/package.json
domain-packs/nesy-courier/tsconfig.json
domain-packs/nesy-courier/eslint.config.js
domain-packs/nesy-courier/vitest.config.ts
domain-packs/nesy-courier/src/**
domain-packs/nesy-courier/docs/NESY_COURIER_DOMAIN_PACK_REFERENCE_V1.md
domain-packs/nesy-courier/fixtures/**
apps/api/src/services/domain-pack-admin-contract.ts
apps/api/src/services/domain-pack-admin-contract.test.ts
apps/web/src/lib/domain-pack-contract-client.ts
apps/web/src/lib/domain-pack-contract-client.test.ts
docs/verdict/run-playbooks/phase-4b/RUN_PLAY.md
docs/verdict/run-playbooks/phase-4b/RESULT.md
```

Bu liste bağlayıcı hedef değildir; agent repo yapısına göre sadeleştirebilir.
Ancak kapsam daraltırsa RESULT.md içinde nedenini yazmalıdır.

## 13. Blocker policy

Phase 4B şu durumlarda `COMPLETED` olamaz:

- Phase 4A incomplete veya digest mismatch.
- `packages/domain-pack-contracts` yok.
- `domain-packs/nesy-courier` yok.
- Reference artifact altı vertical slice taşımıyor.
- Core/Bridge business leakage var.
- `packages/domain-pack-contracts` execution/scheduler leakage var.
- Bundle digest deterministic değil.
- Published bundle immutable değil.
- Setup/prepared launch profile product PASS üretebiliyor.
- HTTP 2xx business success olarak normalize edilebiliyor.
- Target rowIndex primary identity olarak geçebiliyor.
- Tests/typecheck kırmızı.

Şu durumlar Phase 4B'yi otomatik fail etmez, ama RESULT'a external/deferred olarak
yazılmalıdır:

- CP3-DUT real device acceptance açık.
- B-12 production DUT smoke flaky.
- Phase 4C compiler henüz yok.
- Phase 5 execution queue/Test Data Broker henüz yok.
- Phase 6 Domain Pack manager UI henüz yok.

## 14. Final handoff expectation

Phase 4B sonunda beklenen karar:

```text
phase4BResult: COMPLETED | READY_WITH_BLOCKERS | BLOCKED
phase4CReadiness: READY | READY_WITH_EXTERNAL_BLOCKERS | NOT_READY
```

İdeal kapanış:

```text
Phase 4B: COMPLETED
CP4B-Core: PASSED
Phase 4C readiness: READY_WITH_EXTERNAL_BLOCKERS
Reason: CP3-DUT/B-12 external device blockers inherited; compiler work can start because Domain Pack contract/reference pack is ready.
```
