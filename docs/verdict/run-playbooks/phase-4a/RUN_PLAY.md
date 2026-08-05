# Phase 4A RUN_PLAY — WorkflowIR v2 Tamamlama Kapısı

```yaml
runPlayId: verdict-cockpit-phase-4a-run-play
phase: "4A"
phaseName: "WorkflowIR v2 + Condition Engine + Core Outcome Contracts"
status: COMPLETED
recoveryState: COMPLETED
createdAt: "2026-08-05 11:12:25 +03"
startedAt: "2026-08-05 11:41:28 +03"
completedAt: "2026-08-05 12:10:10 +03"
lastUpdatedAt: "2026-08-05 12:35:00 +03"
timezone: "Europe/Istanbul"
masterPlanPath: "docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:76024d898cb152fe4d885fb18e798cb24b6c3df31715eac546c64383ed5c2bd0"
verifyMasterPlanCommand: "pnpm verdict:verify-master-plan"
previousPhaseResult: "docs/verdict/run-playbooks/phase-3/RESULT.md"
resultFile: "docs/verdict/run-playbooks/phase-4a/RESULT.md"
phase3Implementation: "IMPLEMENTATION_COMPLETE"
cp3FullAcceptance: "BLOCKED_EXTERNAL_DUT"
phase4AReadiness: "ACCEPTANCE_22_OF_22_PASSED"
phase4BReadiness: "READY_WITH_EXTERNAL_BLOCKERS"
blockingPreflight:
  - id: "CP3-DUT"
    status: "OPEN_EXTERNAL"
    meaning: "Phase 3 mutation smoke için userdebug/eng lab cihaz gerekiyor; Phase 4A core contract çalışmasını bloklamaz."
  - id: "B-12"
    status: "OPEN_EXTERNAL"
    meaning: "Gerçek production cihazda arka arkaya smoke handshake flaky; Mobile/Bridge device-side investigation."
  - id: "B-13"
    status: "OPEN_CONTRACT_CONSTRAINT"
    meaning: "Bridge v1 cihazında wait_any/cancel_request/capabilities yok; WorkflowIR/Condition/Wait policy bunu capability constraint olarak taşımalı."
  - id: "B-14"
    status: "OPEN_LOW"
    meaning: "runEpoch birimi v2 protokolde açık yazılmalı; host şimdilik millisecond epoch üretir."
  - id: "B-8"
    status: "OPEN_NON_BLOCKING"
    meaning: "Repo-wide lint hâlâ ESLint v9 flat-config borcu nedeniyle blocking gate değil."
```

## 1. Şu an hangi kısımdayız?

Phase 0, Phase 1, Phase 2, Phase 2B ve Phase 3 implementation tamamlandı.

```text
Phase 0: baseline ve blocker inventory
Phase 1: typecheck + CI gate
Phase 2: durable event runtime
Phase 2B: Prisma baseline migration repair
Phase 3: Bridge Host Client + Device Preflight implementation
Phase 4A: WorkflowIR v2 implementation COMPLETE (22/22 acceptance)
Next executable phase: 4B Domain Pack
```

Phase 3 tam checkpoint olarak kapanmadı; sebep kod değil, fiziksel cihaz sınıfı:
bağlı cihaz production build (`ro.build.type=user`) olduğu için mutation smoke
policy gereği reddedildi. Bu Phase 4A'yı bloklamaz. Phase 4A'nın işi device
mutation acceptance değil, shared Core workflow contract'ını dondurmaktır.

## 1.1 AI agent'a verilecek başlangıç metni

Başka bir AI agent'a Phase 4A'yı yaptırırken aşağıdaki metin tek başına başlangıç
komutu olarak verilebilir. Agent yine de repo içindeki `RUN_PLAY.md`, `RESULT.md`,
master plan ve ilgili kod dosyalarını okuyarak çalışmalıdır.

```text
Verdict Cockpit Phase 4A'yı uygula.

Önce şu dosyayı oku:
docs/verdict/run-playbooks/phase-4a/RUN_PLAY.md

Sonra şu dosyayı oku ve çalışma durumunu IN_PROGRESS olarak güncelle:
docs/verdict/run-playbooks/phase-4a/RESULT.md

Ayrıca önceki faz sonucunu oku:
docs/verdict/run-playbooks/phase-3/RESULT.md

Master planda özellikle şu bölümleri oku:
- WorkflowIR v2 kabul kapısı ve sıralama
- B.10 Condition Engine sözleşmesi
- B.10E Continue Gate ve Final Oracle ayrımı
- D.6 Condition Engine
- D.6A WorkflowIR v2 tamamlama kapısı
- FAZ 4A ve CHECKPOINT 4A

Bu fazın hedefi Domain Pack'ten önce shared, generic ve domain-neutral WorkflowIR
v2 contract'ını tamamlamaktır. Web/API aynı shared package'i kullanmalı. Generic
IR v2 schema, version migration, Condition AST, TRUE/FALSE/UNKNOWN semantiği,
FOR_EACH/SWITCH/WAIT_EVENT/retry/cleanup union'ları, Continue Gate/Final Oracle
typed policy ayrımı, occurrence/iteration/entity/event correlation, unified
OracleRequirement, orthogonal outcome axes ve typed allowlisted REMOTE_ACTION /
EXTERNAL_ACTION primitive'i kurulacak.

Başlamadan önce mutlaka:
- pnpm verdict:verify-master-plan
- git status --short
- pnpm typecheck
- pnpm test
komutlarını çalıştır.

Kurallar:
- CP4A geçmeden Domain Pack implementation yazma.
- Nesy-specific veya başka gerçek müşteriye/domain'e özel business type shared IR'a sokma.
- STOP, PARCEL, TOUR, COURIER, OPEN_STOP, APPROVE_TOUR,
  COURIER_LOGIN gibi domain semantic type/command shared workflow contract'ta
  bulunamaz.
- Condition expression serbest JavaScript/eval/function constructor kullanamaz.
- UNKNOWN condition sonucu açık policy olmadan branch/gate geçiremez.
- Continue Gate ile Final Oracle aynı success/verdict alanına sıkıştırılamaz.
- Final Oracle required/eventual paralel string listeleri yasak; unified
  OracleRequirement içinde obligation + timing + deadline + onTimeout taşınmalı.
- REMOTE_ACTION / EXTERNAL_ACTION domain-neutral olmalı; endpoint adı veya Nesy
  business operation adı shared IR union'ına giremez. adapterRef/operationRef
  allowlist, idempotency, effect, reconciliation ve output fact binding taşır.
- B-13'ü tasarım kısıtı olarak taşı: Bridge v1 wait_any/cancel_request bilmez;
  UiWaitPlan planları bounded leg count ve HOST_ONLY cancel gerçekliğini
  modellemeli.
- Fixed wait/sleep primitive'i Core IR'a ekleme. Deadline event-driven
  evaluation'ın üst sınırıdır.

Kapanışta RESULT.md dosyasına changed files, commands, test evidence, acceptance
durumu, blocker listesi ve Phase 4B readiness kararını yaz. Son doğrulamada en az:
- pnpm verdict:verify-master-plan
- pnpm typecheck
- pnpm test
- ilgili package typecheck/test
- git diff --check
- git diff --cached --check
çalıştır.
```

## 2. Amaç

Phase 4A'nın amacı, Cockpit'in Maestro/YAML sonrası beynini Domain Pack'ten önce
generic ve deterministik şekilde dondurmaktır:

```text
Shared Workflow Contract
  → WorkflowIR v2 schema/version/migration

Condition Engine
  → typed AST, TRUE/FALSE/UNKNOWN, operand snapshot

Control Flow
  → CONDITION, SWITCH, FOR_EACH, WAIT_EVENT, retry, cleanup

Evidence-driven Step Policy
  → Continue Gate ayrı, Final Oracle ayrı

Outcome Contract
  → lifecycle/verdict/failure/termination/cleanup/disposition eksenleri ayrı

External Action Primitive
  → typed allowlisted REMOTE_ACTION / EXTERNAL_ACTION
```

Bu faz Domain Pack implementation fazı değildir. Courier, stop, parcel, tour
gibi kavramlar yalnız acceptance fixture adı veya test açıklaması olabilir;
shared IR union, runtime schema veya package export'u içinde business type olarak
bulunamaz. İkinci domain örnekleri gerçek müşteri adıyla değil synthetic fixture
olarak yazılmalıdır.

## 3. Neden bu sırada?

Master planın bağlayıcı sırası:

```text
4A WorkflowIR v2
  → 4B Domain Pack contracts + Nesy App Adapter
  → 4C Domain-aware BridgeFlowCompiler
```

Domain Pack mevcut sınırlı IR'a göre yazılırsa geçici Nesy tipleri kalıcı Core
contract'a sızar. Sonra ikinci domain geldiğinde Core yeniden tasarlanır.
Phase 4A bu riski kapatır: önce generic union ve policy alanları
dondurulur, sonra Domain Pack bu contract'ın tüketicisi olur.

## 4. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `4A` |
| Current step | `4A.14` |
| Current state | `COMPLETED` |
| Last successful step | `4A.14` |
| Last attempted step | `4A.14` |
| Last update | `2026-08-05 12:35:00 +03` |
| Recovery instruction | `4A.1–4A.14 DONE. packages/workflow-contract kuruldu; API+Web aynı paketi tüketiyor; 22/22 acceptance PASS; B-16 post-review'da kapandı ve fixture'lar ana repo içindeki packages/workflow-contract/fixtures/workflow-ir-v2/ altına taşındı. Phase 4B RUN_PLAY hazırlanabilir.` |

Step sonuçları başlangıçta:

| Step | Sonuç |
|---|---|
| 4A.0 Playbook oluşturma | `DONE` |
| 4A.1 Preflight ve inherited blocker check | `DONE` |
| 4A.2 Existing workflow/oracle/runner baseline | `DONE` |
| 4A.3 Shared workflow contract package kararı | `DONE` |
| 4A.4 WorkflowIR v2 schema + runtime validation | `DONE` |
| 4A.5 Version migration + legacy reader source-map | `DONE` |
| 4A.6 Condition Engine typed AST | `DONE` |
| 4A.7 FOR_EACH/SWITCH/WAIT_EVENT/retry/cleanup union | `DONE` |
| 4A.8 Continue Gate / Final Oracle typed policy | `DONE` |
| 4A.9 Unified OracleRequirement migration guard | `DONE` |
| 4A.10 Occurrence/entity/iteration/event correlation | `DONE` |
| 4A.11 Orthogonal outcome axes contract | `DONE` |
| 4A.12 REMOTE_ACTION / EXTERNAL_ACTION primitive | `DONE` |
| 4A.13 Golden fixtures + domain-neutral leakage guard | `DONE` |
| 4A.14 Verification/result/handoff | `DONE` |

## 5. Phase 4A scope

Phase 4A şunları kapsar:

1. Master plan v1.1.3 digest doğrulama.
2. Phase 3 RESULT ve açık blocker'ların devralınması.
3. Mevcut `apps/api/src/services/workflow-ir.ts`, `workflow-runner.ts` ve
   `oracle-engine.ts` baseline envanteri.
4. Web/API tarafından tüketilecek shared workflow contract package'i:
   önerilen isim `packages/workflow-contract`.
5. WorkflowIR v2 root schema:
   `schemaVersion`, `workflowId`, `workflowVersion`, `source`, `inputs`,
   `variables`, `steps`, `policies`, `capabilityRequirements`, `sourceMap`.
6. Generic step union:
   `SDK_QUERY`, `RESOLVE_TARGET`, `BRIDGE_ACTION`, `WAIT_ANY`, `ASSERT_FACT`,
   `CONDITION`, `SWITCH`, `FOR_EACH`, `WAIT_EVENT`, `REMOTE_ACTION`,
   `EXTERNAL_ACTION`, `CLEANUP`, `ANNOTATE`, `NOOP`.
7. Runtime schema validation ve safe parse API.
8. Version migration:
   legacy workflow config → IR v2 DTO + source map.
9. Deterministic canonical serialization + plan hash.
10. Condition AST:
    operands, operators, literal typing, comparison, boolean composition,
    existence checks, list checks, unknown propagation.
11. `TRUE/FALSE/UNKNOWN` evaluator.
12. UNKNOWN policy:
    `FAIL`, `RETRY`, `BRANCH`, `OPERATOR_ATTENTION`, `INCONCLUSIVE`.
13. Evidence snapshot DTO:
    operand source, resolved value, missing/invalid reason, timestamp/correlation.
14. `FOR_EACH`:
    item source, max iteration, index/item scope, occurrence correlation,
    unbounded loop rejection.
15. `SWITCH`:
    mutually visible branches, default policy, branch coverage validation.
16. `WAIT_EVENT`:
    fact/event reference, timeout, stableFor, source lane constraint.
17. Retry/idempotency/cleanup policy:
    effect-aware retry, max attempts, backoff, cleanup action, unknown effect guard.
18. Continue Gate vs Final Oracle policy:
    `EvidencePolicy` for gate, `FinalOraclePolicy` for final.
19. Unified `OracleRequirement`:
    `factKey`, `obligation`, `timing`, `deadlineMs`, `onTimeout`,
    `applicabilityCondition`.
20. Eski `required[]` + `eventual[]` paralel listelerini reddeden migration/test.
21. Occurrence correlation:
    `workflowRunId`, `stepId`, `occurrenceId`, `attempt`, `entityRef`,
    `iterationPath`, `requestId`, `eventSeq`, `treeGen`.
22. Orthogonal outcome axes:
    lifecycle, product verdict, evaluation failure class, scheduler disposition,
    termination reason, cleanup result, resource release result, operational
    disposition.
23. Typed allowlisted `REMOTE_ACTION` / `EXTERNAL_ACTION` primitive:
    `adapterRef`, `operationRef`, input binding, idempotency class/key, effect
    class, timeout, resource requirement refs, output fact binding,
    reconciliation policy.
24. Two-domain generic fixtures:
    courier-like fixture and sports/content-like fixture. Bunlar production
    Domain Pack değildir; yalnız Core union'ın domain-neutral olduğunu kanıtlar.
25. Domain leakage guard:
    shared workflow package export/text surface içinde forbidden business words yok.
26. Golden serialization/hash snapshot'ları.

## 6. Kapsam dışı

Phase 4A'da aşağıdakiler yapılmaz:

- `packages/domain-pack-contracts` production implementation.
- Nesy Courier Domain Pack implementation.
- Başka müşteri/domain pack implementation.
- Nesy App Adapter veya Mobile `automationRelease` refactor.
- BridgeFlowCompiler.
- BridgeFlowExecutor.
- Cockpit UI route cutover.
- Maestro sökümü.
- Final Oracle runtime evaluator'ın production persistence entegrasyonu.
- Test Campaign execution queue, lease/scheduler veya Test Data Broker.
- Real backend/Nesy backoffice remote action implementation.

Bu faz sadece typed shared contract, validation, migration seam ve domain-neutral
acceptance fixtures üretir.

## 7. Owned paths

Phase 4A agent'ı aşağıdaki alanlarda değişiklik yapabilir:

```text
docs/verdict/run-playbooks/phase-4a/RUN_PLAY.md
docs/verdict/run-playbooks/phase-4a/RESULT.md
packages/workflow-contract/**
packages/control-contract/src/**
apps/api/src/services/workflow-ir.ts
apps/api/src/services/workflow-ir.test.ts
apps/api/src/services/workflow-runner.ts
apps/api/src/services/workflow-runner.test.ts
apps/api/src/services/oracle-engine.ts
apps/api/src/services/oracle-engine*.test.ts
apps/api/src/services/workflow-ir-v2*.ts
apps/api/src/services/condition-engine*.ts
apps/api/src/services/legacy-workflow*.ts
apps/api/src/services/fixtures/workflow-ir-v2/**
packages/workflow-contract/fixtures/workflow-ir-v2/**
apps/web/src/lib/workflow-*.ts
apps/web/src/lib/automation/workflow-*.ts
package.json
pnpm-workspace.yaml
turbo.json
pnpm-lock.yaml
.github/workflows/**
scripts/**
```

Yeni shared package eklenirse `pnpm-lock.yaml` değişmesi normaldir; RESULT içinde
gerekçesi yazılır. DB migration bu fazda ancak typed contract'ın persisted read
modeli için zorunluysa yapılır; sırf test state'i için Prisma büyütülmez.

## 8. Read-only context paths

Başlamadan önce okunacak dosyalar:

```text
docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md
docs/verdict/run-playbooks/README.md
docs/verdict/run-playbooks/phase-3/RESULT.md
docs/verdict/run-playbooks/phase-4a/RUN_PLAY.md
docs/verdict/run-playbooks/phase-4a/RESULT.md
package.json
pnpm-workspace.yaml
turbo.json
apps/api/package.json
apps/api/tsconfig.json
apps/api/src/services/workflow-ir.ts
apps/api/src/services/workflow-runner.ts
apps/api/src/services/oracle-engine.ts
apps/api/src/services/oracle-engine.parallel-validation.test.ts
apps/api/src/services/contract-fixtures.test.ts
packages/bridge-contract/src/index.ts
packages/control-contract/src/index.ts
packages/control-contract/src/durable-events.ts
packages/bridge-client/src/index.ts
```

Phase 4A sırasında Mobile repo read-only context olabilir, fakat yazılmaz.

## 9. Ön koşullar

Phase 4A başlamadan önce:

1. `pnpm verdict:verify-master-plan` PASS olmalı.
2. `git status --short` beklenmeyen dirty state göstermemeli.
3. `pnpm typecheck` PASS olmalı.
4. `pnpm test` PASS olmalı.
5. Phase 3 RESULT okunmalı ve B-13 tasarım kısıtı olarak taşınmalı.
6. CP3-DUT external blocker olduğu için Phase 4A'yı bloklamamalı.

## 10. Work packages

### 4A.1 Preflight ve inherited blocker check

Komutlar:

```bash
pnpm verdict:verify-master-plan
git status --short
git branch --show-current
pnpm typecheck
pnpm test
```

Beklenen:

- master digest `sha256:76024d898cb152fe4d885fb18e798cb24b6c3df31715eac546c64383ed5c2bd0`
- Phase 3 commit sonrası worktree temiz veya yalnız Phase 4A playbook dosyaları
- typecheck/test yeşil

`RESULT.md` içinde `resultState: IN_PROGRESS` yapılır.

### 4A.2 Existing workflow/oracle/runner baseline

Mevcut dosyalar okunur ve RESULT'a baseline yazılır:

```text
apps/api/src/services/workflow-ir.ts
apps/api/src/services/workflow-runner.ts
apps/api/src/services/oracle-engine.ts
apps/api/src/services/oracle-engine.parallel-validation.test.ts
```

Şunlar özellikle sınıflandırılır:

- mevcut IR version/step union nedir?
- Maestro/YAML bağı nerede?
- Oracle sonucu hangi eksenleri karıştırıyor?
- Continue Gate / Final Oracle ayrımı var mı?
- legacy workflow config migration nerede yapılabilir?
- Web tarafı aynı type contract'ı tüketiyor mu?

### 4A.3 Shared workflow contract package kararı

Önerilen paket:

```text
packages/workflow-contract
```

Paket kuralları:

- transport bilmez;
- DB bilmez;
- domain bilmez;
- API/Web tarafından tüketilir;
- `@nesy/bridge-contract` ve `@nesy/control-contract` gibi shared contract
  paketlerine yalnız gerekiyorsa type-level bağımlı olur;
- API service implementation bu pakete bağımlı olabilir, tersi olamaz.

### 4A.4 WorkflowIR v2 schema + runtime validation

Minimum public surface:

```text
WorkflowIrV2
WorkflowStepV2
WorkflowIrVersion
WorkflowSourceMap
WorkflowCapabilityRequirement
parseWorkflowIrV2
validateWorkflowIrV2
canonicalizeWorkflowIrV2
hashWorkflowIrV2
```

Schema alanları:

```text
schemaVersion
workflowId
workflowVersion
name
source
inputs
variables
steps
policies
capabilityRequirements
sourceMap
```

Validation fail-fast olmalı:

- bilinmeyen step kind
- duplicate step id
- missing target step reference
- invalid timeout/deadline
- unbounded loop
- unsupported capability
- fixed wait/sleep primitive
- domain business type leakage

### 4A.5 Version migration + legacy reader source-map

Legacy workflow config okunup IR v2 DTO'ya dönüştürülebilir olmalı.

Bu migration production compiler değildir. Amacı:

- eski workflow'ları kaybetmemek;
- source map üretmek;
- YAML/Maestro bağımlılığını yeni contract'a taşımadan görünür kılmak.

Acceptance:

- v1/legacy fixture → v2 output snapshot;
- source-map legacy path/field/step id taşıyor;
- migration deterministic;
- unsupported legacy action explicit error üretiyor.

### 4A.6 Condition Engine typed AST

Condition expression serbest JS değildir.

Operand kaynakları:

```text
run.input.*
device.capability.*
sdk.state.*
sdk.event.*
bridge.node.*
bridge.visible
bridge.obscuredBy
step.output.*
loop.item.*
local.result.*
remote.result.*
environment
country
```

Operators:

```text
and/or/not
equals/notEquals
contains/notContains
exists/notExists
greaterThan/lessThan
in/notIn
matchesAllowlistedPattern
```

Sonuç:

```text
TRUE
FALSE
UNKNOWN
```

Unknown policy olmadan gate/branch ilerlemez.

### 4A.7 FOR_EACH/SWITCH/WAIT_EVENT/retry/cleanup union

`FOR_EACH`:

- bounded `maxIterations`;
- `itemRef`, `indexRef`, `iterationPath`;
- occurrence correlation;
- empty collection policy;
- per-item source map.

`SWITCH`:

- typed conditions;
- explicit default policy;
- branch coverage metadata;
- overlapping branch audit.

`WAIT_EVENT`:

- fact/event key;
- lane/source constraint;
- timeout upper bound;
- stableFor;
- correlation filter.

Retry/cleanup:

- effect-aware retry;
- mutation unknown-effect auto-retry forbidden;
- cleanup result business verdict'i overwrite etmez.

### 4A.8 Continue Gate / Final Oracle typed policy

İki ayrı policy alanı:

```text
continueGate
finalOraclePolicy
```

Continue Gate:

- executor ilerleme readiness'i;
- blocking expression;
- deadline upper bound;
- stableFor;
- unknown policy;
- receipt-safe fact kullanabilir;
- fixed sleep değildir.

Final Oracle:

- occurrence/run kapanmadan nihai business validation;
- immediate/eventual requirement;
- warning/optional/not-applicable ayrımı;
- ordered evidence authority;
- terminal product verdict'i produce eder ama cleanup sonucu ile karışmaz.

### 4A.9 Unified OracleRequirement migration guard

Eski modeldeki:

```text
required[]
eventual[]
warning[]
optional[]
```

paralel role/timing listeleri yeni modelde yasaktır.

Yeni model:

```text
OracleRequirement {
  factKey
  obligation
  timing
  deadlineMs
  onTimeout
  applicabilityCondition
}
```

Aynı fact iki listede tekrarlanamaz. Migration bu eski şekli ya tek
requirement'a dönüştürür ya da ambiguous ise fail-fast eder.

### 4A.10 Occurrence/entity/iteration/event correlation

Typed correlation contract:

```text
workflowRunId
stepId
occurrenceId
attempt
entityRef
iterationPath
requestId
eventSeq
treeGen
sourceMapRef
```

Acceptance:

- nested FOR_EACH correlation deterministic;
- stale fact başka occurrence'ı geçiremez;
- requestId/treeGen/eventSeq source map'e bağlanır;
- entityRef domain-neutral string/object ref olarak kalır.

### 4A.11 Orthogonal outcome axes contract

Tek `FAILED` / `PASSED` union yeterli değildir. Ayrı eksenler:

```text
ExecutionLifecycle
ProductVerdict
EvaluationFailureClass
SchedulerDisposition
TerminationReason
WorkflowCleanupResult
ResourceReleaseResult
OperationalDisposition
StepActionOutcome
ContinueGateOutcome
FinalOracleOutcome
```

Acceptance:

- cleanup failure product PASS'i overwrite etmez;
- worker lost product FAIL değildir;
- evidence missing `INCONCLUSIVE` veya evaluation failure olarak ayrılır;
- environment/device failure product bug olarak raporlanmaz.

### 4A.12 REMOTE_ACTION / EXTERNAL_ACTION primitive

Domain-neutral primitive. Nesy tur onayı gibi işler ileride Domain Pack'ten bu
primitive'e açılır; Core `APPROVE_TOUR` bilmez.

Alanlar:

```text
adapterRef
operationRef
inputBinding
outputFactBinding
idempotencyClass
idempotencyKey
effectClass
timeoutPolicy
resourceRequirementRefs
correlation
reconciliationPolicy
auditPolicy
allowedEnvironments
```

Acceptance:

- raw endpoint veya HTTP script shared IR'a girmez;
- operationRef allowlisted adapter contract'a referans olur;
- non-idempotent action için retry policy fail-fast;
- setup remote action ürün PASS'i üretemez;
- output fact binding olmadan business success üretilemez.

### 4A.13 Golden fixtures + domain-neutral leakage guard

Fixture setleri:

```text
packages/workflow-contract/fixtures/workflow-ir-v2/courier-generic.json
packages/workflow-contract/fixtures/workflow-ir-v2/sports-content-generic.json
packages/workflow-contract/fixtures/workflow-ir-v2/legacy-migration-*.json
packages/workflow-contract/fixtures/workflow-ir-v2/invalid-*.json
```

Leakage guard:

```text
STOP
PARCEL
TOUR
COURIER
OPEN_STOP
APPROVE_TOUR
COURIER_LOGIN
```

Bu kelimeler shared package export surface, schema kind, primitive kind veya
runtime union içinde bulunamaz. Test fixture açıklamasında domain fixture adı
olarak kullanılacaksa bu bilinçli scope ile sınırlandırılır; contract export'a
sızması fail'dir.

### 4A.14 Verification/result/handoff

Kapanış komutları:

```bash
pnpm verdict:verify-master-plan
pnpm typecheck
pnpm test
pnpm --filter @nesy/workflow-contract typecheck
pnpm --filter @nesy/workflow-contract test
git diff --check
git diff --cached --check
git status --short
```

Paket farklı adla açıldıysa komutlar RESULT'ta gerçek paket adıyla yazılır.

## 11. Acceptance checklist

Phase 4A tamamlandı demek için:

1. API ve Web aynı shared workflow type paketini kullanıyor.
2. IR v2 schema/version/migration suite yeşil.
3. Runtime validation unknown/invalid schema'yı fail-fast ediyor.
4. Deterministic canonical serialization/hash yeşil.
5. Condition Engine `eval`/Function kullanmıyor.
6. Condition sonucu `TRUE/FALSE/UNKNOWN`; UNKNOWN policy'siz ilerleme yok.
7. Condition kararları operand snapshot DTO'su üretiyor.
8. `FOR_EACH` bounded ve occurrence/iteration scope deterministic.
9. `SWITCH` branch/default/coverage validation taşıyor.
10. `WAIT_EVENT` event-driven readiness contract'ı taşıyor; fixed sleep yok.
11. Continue Gate ve Final Oracle ayrı typed policy.
12. Final Oracle unified `OracleRequirement`; role/timing paralel listeleri yok.
13. Outcome axes ayrı; cleanup failure product verdict'i overwrite etmiyor.
14. Occurrence/entity/request/event/treeGen correlation contract mevcut.
15. `REMOTE_ACTION` / `EXTERNAL_ACTION` domain-neutral ve allowlisted adapterRef/
    operationRef taşıyor.
16. Non-idempotent external action unsafe retry ile compile/validate edilemiyor.
17. Setup remote action ürün PASS'i üretemiyor.
18. En az iki generic domain fixture aynı IR union'larıyla validate/hash ediliyor.
19. Shared IR package surface içinde Nesy veya başka gerçek müşteri business type'ı yok.
20. Legacy workflow migration source-map üretiyor.
21. Phase 4B Domain Pack implementation'ı CP4A geçmeden başlamadı.
22. Typecheck/test green.

## 12. Blocker ve risk taşıma

Phase 4A'nın devraldığı ama bu fazda çözmeyeceği konular:

| ID | Taşıma şekli |
|---|---|
| CP3-DUT | Phase 5 executor cutover öncesi lab cihaz ile mutation smoke koşulmalı. |
| B-12 | Mobile owner/device-side Bridge stability investigation; Core IR schema'yı bloklamaz. |
| B-13 | Wait/cancel capability constraint olarak IR/wait policy ve compiler validation'a taşınır. |
| B-14 | `runEpoch` ms convention dokümante edilir; protocol v2 işi olarak kalır. |
| B-8 | Repo-wide lint non-blocking; yeni paket kendi lint'inde warning/error bırakmamalı. |

Yeni riskler:

- Shared contract paketi “her şey common” çöplüğüne dönmemeli.
- Domain fixture isimleri shared runtime union'a sızmamalı.
- Continue Gate ve Final Oracle tekrar tek `success` alanına sıkışmamalı.
- `REMOTE_ACTION` raw HTTP runner'a dönüşmemeli.
- Condition Engine ekspresyon kolaylığı bahanesiyle JS eval'a kaçmamalı.
- Golden hash'ler unstable object key order nedeniyle flaky olmamalı.

## 13. Rollback ve recovery notları

- Yeni package eklenirse package metadata ve lockfile birlikte kalmalı.
- IR migration additive olmalı; legacy workflow reader silinmez.
- Mevcut Maestro runner bu fazda sökülmez.
- Web UI cutover yapılmaz; yalnız type import/contract seam gerekiyorsa dokunulur.
- Failing tests schema hatası gösteriyorsa test gevşetilmez; schema/fixture/adapter
  ayrımı RESULT'a yazılır.
- `as any`, kör non-null assertion, `@ts-ignore`, `.skip`, `.only`, tsconfig
  gevşetmesi kullanılmaz.

## 14. Agent çalışma kuralları

Bu fazı alan AI agent:

1. Master plan digest doğrulamadan edit yapmaz.
2. Phase 3 RESULT §1, §15, §19 ve §21'i okur.
3. Domain Pack implementation'a başlamaz.
4. Shared IR'a business type sokmaz.
5. Condition için eval/function constructor kullanmaz.
6. Fixed wait/sleep primitive eklemez.
7. `REMOTE_ACTION`ı raw endpoint script'i yapmaz.
8. Outcome axes'i tek status union'a sıkıştırmaz.
9. Migration/source-map olmadan legacy config'i “destekleniyor” saymaz.
10. Kapanışta RESULT evidence ve Phase 4B readiness kararını yazar.

## 15. Agent'a verilecek uzun semantic prompt

```text
Sen Verdict Cockpit Phase 4A — WorkflowIR v2 tamamlama kapısı agent'ısın.
Görevin Domain Pack implementasyonundan önce shared, generic ve domain-neutral
WorkflowIR v2 contract'ını tamamlamak.

Önce şu dosyaları oku:
- docs/verdict/run-playbooks/phase-4a/RUN_PLAY.md
- docs/verdict/run-playbooks/phase-4a/RESULT.md
- docs/verdict/run-playbooks/phase-3/RESULT.md
- docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md içindeki WorkflowIR v2
  kabul kapısı, B.10, B.10E, D.6, D.6A, FAZ 4A ve CHECKPOINT 4A bölümleri
- apps/api/src/services/workflow-ir.ts
- apps/api/src/services/workflow-runner.ts
- apps/api/src/services/oracle-engine.ts
- packages/bridge-contract/src/index.ts
- packages/control-contract/src/index.ts

Başlamadan önce:
- pnpm verdict:verify-master-plan
- git status --short
- pnpm typecheck
- pnpm test
komutlarını çalıştır ve RESULT.md'i IN_PROGRESS yap.

Ana hedef:
Shared workflow contract package'i kur veya mevcut contract alanını doğru sınıra
çek. WorkflowIR v2 schema/runtime validation/version migration, typed Condition
AST, TRUE/FALSE/UNKNOWN evaluator, FOR_EACH/SWITCH/WAIT_EVENT/retry/cleanup
union'ları, Continue Gate/Final Oracle typed policy ayrımı, unified
OracleRequirement, occurrence/entity/iteration/event correlation, orthogonal
outcome axes ve typed allowlisted REMOTE_ACTION/EXTERNAL_ACTION primitive'i yaz.

Önemli kurallar:
- CP4A geçmeden Domain Pack implementation yok.
- Shared IR domain bilmez. STOP, PARCEL, TOUR, COURIER,
  OPEN_STOP, APPROVE_TOUR, COURIER_LOGIN gibi kavramlar shared IR union/type/export
  surface içinde bulunamaz.
- Condition engine eval, Function constructor veya arbitrary JS çalıştıramaz.
- UNKNOWN condition sonucu açık policy olmadan gate/branch geçiremez.
- Continue Gate executor readiness, Final Oracle nihai business validation'dır;
  ikisi tek success/verdict alanında birleşemez.
- OracleRequirement tek modeldir; required[]/eventual[] paralel listeleri migration
  sonrası reddedilir.
- REMOTE_ACTION / EXTERNAL_ACTION endpoint script'i değildir. adapterRef,
  operationRef, typed input/output binding, idempotency, effect, timeout, resource
  requirement ve reconciliation policy taşır.
- Non-idempotent external action unsafe retry ile validate edilemez.
- B-13 tasarım kısıtını taşı: Bridge v1 wait_any/cancel_request bilmez; wait plan
  bounded ve HOST_ONLY cancel gerçekliğine uygun olmalı.
- Fixed wait/sleep primitive'i ekleme; deadline event-driven evaluator'ın üst
  sınırıdır.

Kapanışta:
- RESULT.md içinde changed files, commands, acceptance, blockers ve Phase 4B
  readiness kararını yaz.
- pnpm verdict:verify-master-plan
- pnpm typecheck
- pnpm test
- workflow contract package typecheck/test
- git diff --check
- git diff --cached --check
çalıştır.
```

## 16. Agent'a verilecek kısa komut

```text
Bu repo içinde docs/verdict/run-playbooks/phase-4a/RUN_PLAY.md dosyasını oku ve Phase 4A'yı uygula.
Önce docs/verdict/run-playbooks/phase-4a/RESULT.md dosyasını IN_PROGRESS yap, recovery state'i güncelle, sonra RUN_PLAY sırasıyla ilerle.
Domain Pack implementation'a başlama. Shared WorkflowIR v2 contract'a Nesy veya başka gerçek müşteri business type'ı sokma. Kapanışta RESULT.md'e kanıtları ve Phase 4B readiness kararını yaz.
```
