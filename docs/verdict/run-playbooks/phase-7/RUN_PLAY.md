# Phase 7 RUN_PLAY — Nesy Reference Workflows, Diagnostics and Security

```yaml
runPlayId: verdict-cockpit-phase-7-run-play
phase: "7"
phaseName: "Nesy Real Workflows + Test Profile Catalog + Diagnostics + Security Acceptance"
status: READY_TO_START
recoveryState: READY_TO_START
createdAt: "2026-08-05 14:44:28 +03"
startedAt: null
completedAt: null
lastUpdatedAt: "2026-08-09 16:42:00 +03"
timezone: "Europe/Istanbul"
masterPlanPath: "docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:b81631396044cab7f83f6b6efea2f47ff4b4bda4b177b2d7a2ad705535b660b2"
verifyMasterPlanCommand: "pnpm verdict:verify-master-plan"
previousPhaseResult: "docs/verdict/run-playbooks/phase-6/RESULT.md"
resultFile: "docs/verdict/run-playbooks/phase-7/RESULT.md"
phase6StatusRequired: "COMPLETED"
phase6ReadinessRequired: "READY_WITH_EXTERNAL_BLOCKERS"
phase7Target: "CHECKPOINT_7"
phase8ReadinessTarget: "READY_WITH_EXTERNAL_BLOCKERS"
operatorNote: "2026-08-09: CP3-DUT + B-12 deferred (lab/DUT test, not coding). Phase 7 may start; full Act Mode/DUT PASS later."
blockingPreflight:
  - id: "PHASE_6_NOT_COMPLETE"
    status: "RESOLVED"
    meaning: "Phase 6 COMPLETED + READY_WITH_EXTERNAL_BLOCKERS (2026-08-09)."
  - id: "REAL_DUT_REQUIRED"
    status: "BLOCKING_EXTERNAL_FOR_FULL_PASS"
    meaning: "Phase 7 gerçek Nesy workflow ve Test Profile kabulü için en az bir gerçek DUT gerekir. Yoksa code/test-double çalışması yapılabilir ama CHECKPOINT 7 full PASS verilemez."
  - id: "CP3-DUT"
    status: "OPEN_EXTERNAL_DEFERRED"
    meaning: "Operator 2026-08-09: lab later (userdebug/eng DUT). Not a Phase 7 start blocker; real mutation acceptance stays BLOCKED_EXTERNAL until cleared."
  - id: "B-12"
    status: "OPEN_EXTERNAL_DEFERRED"
    meaning: "Operator 2026-08-09: 30× Device Lab smoke later. Not a Phase 7 start blocker; DUT smoke acceptance may stay blocked until cleared."
  - id: "B-8"
    status: "OPEN_NON_BLOCKING"
    meaning: "Repo-wide lint ESLint v9 flat-config borcu; touched packages/routes targeted lint/typecheck/test gate'lerinden geçmelidir."
```

## 1. Şu an hangi kısımdayız?

Phase 7, platformun gerçek Nesy kurye iş akışlarıyla ispatlandığı fazdır.

```text
Phase 4A: WorkflowIR v2 + Condition Engine COMPLETE
Phase 4B: Domain Pack Contracts + Nesy Courier Reference Pack COMPLETE
Phase 4C: BridgeFlowCompiler COMPLETE_REQUIRED
Phase 5: BridgeFlowExecutor + Oracle v2 + Persistence COMPLETE_REQUIRED
Phase 6: Cockpit UI + Route Cutover COMPLETE_REQUIRED
Phase 7: Nesy real workflows + diagnostics/security acceptance READY_TO_PREPARE
Next after 7: Phase 8 Bridge physical acceptance and Maestro cutover gate
```

Bu fazda hedef, “runtime teorik olarak çalışıyor” demek değildir. Hedef, gerçek
Nesy Mobile / Cockpit / SDK / Bridge / Backend entegrasyonunda:

- Field Login,
- Load Tour,
- tam kurye workflow,
- barcode loop,
- offline queue,
- backend confirmation,
- dialog policy,
- Tour Approval Lifecycle,
- Test Profile Catalog,
- diagnostics,
- security/retention

başlıklarının kanıtlı biçimde çalıştığını göstermektir.

## 1.1 AI agent'a verilecek başlangıç metni

Aşağıdaki prompt başka bir AI agent'a doğrudan verilebilir. Phase 7 gerçek cihaz
ve gerçek iş akışı fazı olduğu için prompt açık blocker ve fake-pass yasağı taşır.

```text
Verdict Cockpit Phase 7'yi uygula.

Önce şu dosyayı tamamen oku:
docs/verdict/run-playbooks/phase-7/RUN_PLAY.md

Sonra şu dosyayı oku:
docs/verdict/run-playbooks/phase-7/RESULT.md

Çalışmaya başlamadan önce Phase 6 gate'ini doğrula:
docs/verdict/run-playbooks/phase-6/RESULT.md

Phase 6 RESULT içinde şu iki koşul yoksa Phase 7 implementasyonuna BAŞLAMA:
- resultState: COMPLETED
- phase7Readiness: READY_WITH_EXTERNAL_BLOCKERS

Bu koşullar yoksa sadece Phase 7 RESULT.md içinde BLOCKED_PRECONDITION olarak
raporla, hangi Phase 6 route/UI/read-model acceptance çıktılarının eksik olduğunu
yaz ve dur.

Master planda özellikle şu bölümleri oku:
- D.14 Nesy Courier Reference Domain Pack E2E
- D.16 Diagnostics, Metrics ve Retention
- D.17 Güvenlik ve RBAC
- D.24 Test Profile Catalog ve Campaign Runtime
- FAZ 7 — Referans İş Akışları, Diagnostics ve Güvenlik
- CHECKPOINT 7
- B.10D wait_any expected/interrupt lifecycle
- B.16 Evidence Journey
- B.19 Continue Gate vs Final Oracle
- B.20 Evidence Source Registry and Local Reducer
- B.21 Target Resolution Provider Chain
- Nesy Tour Approval Lifecycle ekleri

Input contract'ları ve sistemler:
- domain-packs/nesy-courier
- packages/domain-pack-contracts
- packages/workflow-contract
- packages/bridgeflow-compiler
- packages/bridgeflow-executor
- packages/oracle-engine
- packages/execution-contract
- apps/api Verdict runtime services
- apps/web Phase 6 Cockpit UI routes
- NesyMobile SDK/App Adapter capabilities
- Verdict Accessibility Bridge
- Nesy backend/backoffice adapter capability
- Real DUT/lab device availability

Phase 7'nin hedefi:
Nesy Courier Domain Pack üstündeki gerçek referans workflow'ları ve Nesy v1 Test
Profile kataloğunu aynı BridgeFlowExecutor/Oracle/Evidence Journey runtime hattında
çalıştır. Field Login ve Load Tour özel Maestro/orchestrator yolu olmadan generic
WorkflowRunApi + Domain Pack ile çalışmalı. Full courier golden workflow, barcode
loop, offline queue, backend confirmation, dialog/interrupt policy, Tour Approval
Lifecycle, diagnostics, security, retention ve campaign acceptance kanıtlanmalı.

Kesin yasaklar:
- Maestro orchestrator'ı yeni geçiş yolu olarak kullanma.
- Field Login veya Load Tour için özel API/orchestrator çağrısı bırakma.
- Core/Bridge/Executor içine STOP/PARCEL/ROUTE/DELIVERY/TOUR_APPROVAL business type ekleme.
- 20 barcode için statik 20 node çoğaltma yapma; runtime entity query + FOR_EACH kullanılmalı.
- UI başarıyı tek başına business PASS sayma.
- HTTP 2xx sonucunu backend business success sayma.
- Backend approved state'i mobile notification/app state/UI approved surface gelmeden full PASS sayma.
- Offline queue'yu failure yapma veya ayrı evidence plane yapma.
- Setup login/precondition approval sonucunu gerçek ürün PASS'i gibi raporlama.
- Unknown dialog/effect için sessiz retry/green üretme.
- Normal happy path'te sürekli/full accessibility dump üretme.
- Scanner injection veya DIRECT_STATE'i release build'e açık bırakma.
- D3 capture'ı explicit approval/RBAC olmadan çalıştırma.
- Secret/PIN/token veya sensitive artifact'i export/audit içine yazma.
- Preview Accessibility/Smart Explorer profilini release gate sonucunu değiştirecek şekilde kullanma.

Yapılacaklar:

1. Preflight:
   - pnpm verdict:verify-master-plan
   - git status --short --branch
   - Phase 6 RESULT gate doğrulaması
   - pnpm typecheck
   - pnpm test
   - real DUT/device availability check
   - Nesy app build/variant/SDK/Bridge/App Adapter capability snapshot

2. Nesy reference workflow inventory:
   - Field Login eski özel route/service/orchestrator yolunu çıkar.
   - Load Tour eski özel route/service/orchestrator yolunu çıkar.
   - Nesy Courier Domain Pack vertical slice'larını çıkar.
   - App Adapter named query/session/scanner/local/remote capability durumunu çıkar.

3. Field Login cutover:
   - `/automation/field-login` generic WorkflowRunApi + Nesy Courier Domain Pack kullanmalı.
   - Setup login ile gerçek UI login ayrı raporlanmalı.
   - Real login E2E UI/App/Local/Remote evidence ile PASS/FAIL vermeli.
   - Seed/prepared session gerçek login PASS'i üretmemeli.

4. Load Tour cutover:
   - `/automation/01-load-tour-flow` generic WorkflowRunApi + Nesy Courier Domain Pack kullanmalı.
   - Route selection, route dialog, session/update/network interrupt policy.
   - Continue Gate erken ilerlemeli; Final Oracle eventual backend/profile/config kanıtlarını ayrı izlemeli.

5. Full Courier golden workflow:
   - Start → Courier Login → Select Route → Query Stops → FOR_EACH Stop → Open Stop → Query Tasks → FOR_EACH Task → Process Parcel → Complete Delivery → Verify Queue/Reconciliation → End.
   - Semantic node'lar Domain Pack içinde kalmalı.
   - Generic IR/BridgeFlowPlan/Runtime occurrence source-map zinciri Run Detail'de görünmeli.
   - STOP/PARCEL/ROUTE/DELIVERY Core/Bridge union'larına sızmamalı.

6. Barcode loop:
   - 20 barcode static node duplication değil.
   - Runtime entity discovery + nested FOR_EACH.
   - Her barcode/task/shipment occurrence stable entity key ile bağlı.
   - Wrong occurrence/iteration evidence yazılamamalı.

7. Offline/online/backend:
   - Offline delivery queued local evidence ile PASS_QUEUED_OFFLINE üretebilmeli.
   - Queue Local subtype olmalı; ayrı evidence plane değil.
   - Online flush backend confirmation correct node/iteration/entity correlation ile bağlanmalı.
   - HTTP transport success backend business success yerine geçmemeli.

8. Dialog/surface policy:
   - Route selection expected surface.
   - Mandatory update/session expired/network/permission unknown dialog interrupt.
   - Unknown dialog STOP + screenshot + scoped dump.
   - wait_any expected/interrupt/ambiguous/timeout/cancel event'leri occurrence timeline'a bağlanmalı.

9. Tour Approval Lifecycle:
   - Real mode: kurye Mobile UI'da tur onayı ister.
   - Nesy Backoffice Adapter iki remote servis çağrısını idempotent/correlated çalıştırır.
   - Backend entity approved state, push/notification dispatch, mobile receive/app state ve UI approved surface ayrı fact authority olarak saklanır.
   - Continue Gate ve Final Oracle ayrı değerlendirir.
   - Backend approved ama mobile notification/app state yoksa test devam etmemeli; boundary remote→mobile notification/app sync olarak raporlanmalı.
   - Setup/precondition mode controlled remote approval ve refresh/direct sync kullanabilir ama tur onayı product PASS'i üretmez.
   - Partial mutation/timeout/unknown remote effect durumunda account/tour resource TestDataBroker tarafından RECONCILIATION_REQUIRED veya QUARANTINED yapılmalı.

10. Scanner modes:
   - Real scanner.
   - Injected scanner.
   - Manual/unknown input.
   - Scanner injection ve DIRECT_STATE yalnız automation build/capability ile çalışmalı.
   - Release build isolation testinde automation seam leak NO_GO üretmeli.

11. Launch Profiles:
   - FULL_JOURNEY.
   - PREPARED_SESSION.
   - DIRECT_STATE.
   - Logged-in courier + active route + stop list direct entry.
   - Readiness/cleanup failure ayrı raporlanmalı.

12. Evidence Journey real DUT fixtures:
   - SDK explicit failure.
   - Transport/auth failure.
   - Host commit.
   - Ordered gap.
   - Normalization failure.
   - Correlation miss.
   - Evidence conflict/stale fact.
   - Missing event kanıtsız SDK failure olmamalı.

13. Interaction origin:
   - Bridge injected action BRIDGE_INJECTED.
   - Operator contamination MANUAL.
   - Ayrıştırılamayan SDK click UNKNOWN.
   - Human metric baseline automation injection ile şişmemeli.

14. Capture/diagnostics:
   - D1/D2/D3 capture policy.
   - D3 role + explicit approval.
   - Ambiguity/timeout/unknown dialog/unknown effect failure-triggered scoped repro capture.
   - Normal happy path full-dump-free.
   - Capture quota/redaction/RBAC/retention.
   - NOT_CAPTURED açık gösterilmeli; retrospective full dump iddiası yok.

15. Security/RBAC/retention:
   - Actor/device/run/command/result audit.
   - Secret/PIN/token redaction.
   - Sensitive artifact purge SLA.
   - Production Act Mode restrictions.
   - Release APK automation seam isolation.
   - Backend credential handling.

16. Nesy v1 Test Profile catalog:
   - nesy.smoke.core
   - nesy.regression.critical
   - nesy.regression.differential
   - nesy.recovery.payment-process-kill
   - nesy.recovery.fiscal-process-kill
   - nesy.recovery.queue-flush
   - nesy.bad-day.state-aware-short
   - nesy.contract.consistency
   - nesy.load.normal-60-stop
   - nesy.load.busy-120-stop
   - nesy.compatibility.field-devices
   - nesy.security.release-isolation
   - nesy.soak.short

17. Preview profiles:
   - Basic Accessibility Audit sadece Bridge'in güvenilir gözlemlediği accessibility metadata ile sınırlı.
   - Smart Explorer Preview crash/ANR/unexpected surface sinyali üretir.
   - İkisi de release gate/Final Oracle authority değildir.

18. Campaign schedules:
   - PR.
   - Nightly.
   - Weekly.
   - Release.
   - En az fake fixture ve bir gerçek DUT fixture ile schedule/cell/deep-link acceptance.
   - Campaign matrix cell gerçek Run Detail/Evidence summary olmadan PASS/FAIL üretmemeli.

19. Workflow provenance chain:
   - Workflow list → editor → run → run detail → history deep-link zinciri.
   - Aynı workflow/plan/run/domain-pack provenance çözülmeli.
   - Preview hash/executed hash/source-map Run Detail'de görünmeli.

20. Verification:
   - pnpm verdict:verify-master-plan
   - pnpm typecheck
   - pnpm test
   - targeted API/runtime/domain-pack tests
   - targeted web route tests
   - real DUT smoke/full workflow commands varsa çalıştır
   - git diff --check
   - git diff --cached --check

Kapanış:
- RESULT.md'yi COMPLETED, READY_WITH_BLOCKERS, BLOCKED_PRECONDITION,
  BLOCKED_EXTERNAL veya FAILED olarak güncelle.
- CHECKPOINT 7 acceptance checklist'ini kanıtlarla doldur.
- Gerçek DUT yoksa full CP7 PASS verme; external blocker açık yaz.
- Phase 8 readiness kararını yaz.
```

## 2. Phase 7 hedef mimarisi

Phase 7, generic Verdict platformunun Nesy Courier Domain Pack ile gerçek iş
akışında çalıştığını kanıtlar.

```text
Nesy Courier Domain Pack
  ├── Field Login
  ├── Select Route
  ├── Open Stop
  ├── Process Parcel
  ├── Complete Delivery
  ├── Tour Approval Lifecycle
  └── Test Profiles
      ↓
WorkflowIR v2 / BridgeFlowPlan
      ↓
BridgeFlowExecutor
      ├── SDK Control
      ├── Accessibility Bridge
      ├── Local Named Queries
      ├── Remote/Backoffice Adapter
      ├── Continue Gate
      ├── Final Oracle v2
      └── Evidence Journey
      ↓
Cockpit Run Detail / History / Campaign Matrix
```

Core runtime hiçbir yerde Nesy business type'ı bilmez. Nesy business anlamı
Domain Pack, App Adapter ve Evidence Source Registry içinde kalır.

## 3. Başlama gate'i

Phase 7 agent'ı başlamadan önce şu koşulları doğrulamalıdır:

```text
docs/verdict/run-playbooks/phase-6/RESULT.md
  resultState: COMPLETED
  phase7Readiness: READY_WITH_EXTERNAL_BLOCKERS
```

Bu iki koşul yoksa:

- Kod yazılmayacak.
- Real DUT test başlatılmayacak.
- Field Login/Load Tour route'ları değiştirilmeyecek.
- `RESULT.md` `BLOCKED_PRECONDITION` olarak güncellenecek.
- Eksik Phase 6 UI/API/read-model output listesi yazılacak.

Gerçek DUT yoksa:

- Code/test-double hazırlıkları yapılabilir.
- Fake fixture acceptance yazılabilir.
- Fakat CHECKPOINT 7 full PASS verilemez.
- Real workflow maddeleri `BLOCKED_EXTERNAL_REAL_DUT` olarak açık kalır.

## 4. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `7` |
| Current step | `7.1` |
| Current state | `READY_TO_START` |
| Last successful step | `7.0` |
| Last attempted step | `7.1` |
| Last update | `2026-08-09 16:42:00 +03` |
| Recovery instruction | `Gate open. Start Phase 7 from 7.1. CP3-DUT+B-12 DEFERRED (lab later). Real DUT yoksa full CP7 PASS verme.` |

## 5. Owned paths

Beklenen owned paths:

```text
domain-packs/nesy-courier/**
apps/api/src/services/nesy-*.ts
apps/api/src/services/verdict-*.ts
apps/api/src/services/test-profile-*.ts
apps/api/src/services/test-campaign-*.ts
apps/api/src/services/test-data-broker-*.ts
apps/api/src/routes/verdict-*.ts
apps/web/src/app/**/automation/field-login/**
apps/web/src/app/**/automation/01-load-tour-flow/**
apps/web/src/app/**/automation/test-profiles/**
apps/web/src/app/**/automation/test-campaigns/**
apps/web/src/app/**/automation/**/runs/**
apps/web/src/lib/verdict-runtime/**
apps/web/src/lib/nesy/**
docs/verdict/run-playbooks/phase-7/**
package.json
pnpm-lock.yaml
turbo.json
```

Koşullu olarak okunabilir ama gereksiz yazılmamalı:

```text
packages/workflow-contract/**
packages/domain-pack-contracts/**
packages/bridgeflow-compiler/**
packages/bridgeflow-executor/**
packages/oracle-engine/**
packages/execution-contract/**
packages/bridge-contract/**
packages/control-contract/**
```

Core/Bridge contract eksiği çıkarsa `BLOCKED_UPSTREAM_CONTRACT` yazılmalıdır.
Nesy-specific type ekleyerek Core sınırı delinmemelidir.

Mobile repo yazma izni bu playbook içinde varsayılmaz. NesyMobile değişikliği
gerekiyorsa RESULT.md içinde `BLOCKED_MOBILE_CHANGE_REQUIRED` veya açık owner
handoff yazılmalıdır.

## 6. Step plan

| Step | Status | Açıklama | Output |
|---|---|---|---|
| 7.0 Playbook oluşturma | `DONE` | `RUN_PLAY.md` + `RESULT.md` oluşturuldu. | Phase 7 hazır ama gated |
| 7.1 Phase 6 gate doğrulama | `PENDING` | Phase 6 `COMPLETED` ve `phase7Readiness` doğrula. | Gate evidence |
| 7.2 Preflight/device baseline | `PENDING` | Digest, branch, tests, real DUT/capability snapshot. | Baseline |
| 7.3 Nesy workflow inventory | `PENDING` | Field Login/Load Tour/current special paths/domain pack. | Inventory |
| 7.4 Field Login cutover | `PENDING` | Generic WorkflowRunApi + Domain Pack. | Field Login |
| 7.5 Load Tour cutover | `PENDING` | Generic WorkflowRunApi + route readiness. | Load Tour |
| 7.6 Full courier golden workflow | `PENDING` | End-to-end semantic workflow. | Golden workflow |
| 7.7 Entity discovery/FOR_EACH | `PENDING` | Stop/task/shipment/parcel stable occurrence. | Entity runtime |
| 7.8 Barcode 20 loop | `PENDING` | Runtime nested FOR_EACH, no static duplication. | Barcode acceptance |
| 7.9 Offline queue | `PENDING` | PASS_QUEUED_OFFLINE, local subtype. | Queue evidence |
| 7.10 Backend confirmation | `PENDING` | Remote business confirmation/correlation. | Backend evidence |
| 7.11 Dialog/surface policy | `PENDING` | expected/interrupt/unknown dialog STOP. | Surface policy |
| 7.12 Tour Approval Lifecycle | `PENDING` | Real/setup modes, backoffice adapter, push/mobile/UI chain. | Tour approval |
| 7.13 Scanner modes | `PENDING` | real/injected/manual/unknown; release isolation. | Scanner acceptance |
| 7.14 Launch Profiles | `PENDING` | FULL_JOURNEY/PREPARED_SESSION/DIRECT_STATE. | Launch profiles |
| 7.15 Continue Gate vs Final Oracle | `PENDING` | early progress and eventual oracle real scenarios. | Oracle acceptance |
| 7.16 Evidence Journey real fixtures | `PENDING` | SDK/transport/ordered/normalization/correlation cases. | Diagnostics |
| 7.17 Interaction origin | `PENDING` | injected/manual/unknown and metrics isolation. | Origin evidence |
| 7.18 Capture policy | `PENDING` | D1/D2/D3, scoped failure capture, no happy full dump. | Capture acceptance |
| 7.19 Security/RBAC/retention | `PENDING` | audit, redaction, purge, production Act restrictions. | Security |
| 7.20 Nesy Test Profile catalog | `PENDING` | v1 core profiles in published pack. | Profile catalog |
| 7.21 Preview profiles | `PENDING` | accessibility/explorer release-gate isolation. | Preview acceptance |
| 7.22 Campaign schedules | `PENDING` | PR/nightly/weekly/release fake + real fixture. | Campaign acceptance |
| 7.23 Provenance/deep-links | `PENDING` | list→editor→run→detail→history consistency. | UI/API chain |
| 7.24 Negative safety tests | `PENDING` | no core leakage, no static barcode, no HTTP-only PASS, no fake preview GO. | Safety suite |
| 7.25 Verification | `PENDING` | digest/typecheck/test/DUT evidence/diff checks. | Verification |
| 7.26 RESULT closure | `PENDING` | CHECKPOINT 7 checklist + Phase 8 readiness. | Handoff |

## 7. Nesy reference workflows

Minimum real workflow set:

```text
Field Login
Load Tour
Full Courier Golden Workflow
20 Barcode Processing
Offline Delivery + Queue Flush
Backend Confirmation
Tour Approval Lifecycle
Unknown Dialog / Interrupt Handling
Recovery / Bad Day smoke cases
```

Field Login ve Load Tour özel route olarak kalabilir; fakat özel executor veya
Maestro orchestrator çağırmamalıdır. Bu route'lar generic `WorkflowRunApi` +
Nesy Courier Domain Pack semantic workflow'una bağlanmalıdır.

## 8. Tour Approval Lifecycle contract

Bu senaryo Nesy entegrasyonunda özel olarak unutulmamalıdır.

Real mode:

```text
Courier Mobile UI requests tour approval
  ↓
Nesy Backoffice Adapter remote operation 1
  ↓
Nesy Backoffice Adapter remote operation 2
  ↓
Backend entity approved state
  ↓
Push/notification dispatch
  ↓
Mobile receive / app state
  ↓
UI approved surface
  ↓
Continue Gate + Final Oracle
```

Setup/precondition mode:

```text
Controlled remote approval / direct sync / refresh
  ↓
Prepared state for later test
  ↓
NO product PASS for real tour approval
  ↓
NO push/UI integration PASS
```

Partial/unknown remote effect:

```text
remote op partially succeeded OR timed out OR idempotency conflict
  ↓
TestDataBroker resource state:
    RECONCILIATION_REQUIRED
    or QUARANTINED
  ↓
dependent workflows BLOCKED if needed
```

## 9. Nesy v1 Test Profile catalog

Published Nesy Courier Domain Pack içinde minimum profile listesi:

```text
nesy.smoke.core
nesy.regression.critical
nesy.regression.differential
nesy.recovery.payment-process-kill
nesy.recovery.fiscal-process-kill
nesy.recovery.queue-flush
nesy.bad-day.state-aware-short
nesy.contract.consistency
nesy.load.normal-60-stop
nesy.load.busy-120-stop
nesy.compatibility.field-devices
nesy.security.release-isolation
nesy.soak.short
```

Preview profile listesi:

```text
nesy.preview.accessibility.basic
nesy.preview.smart-explorer
```

Preview profiller `releaseGate=false` olmalıdır.

## 10. Safety blockers

Şu durumlardan biri görülürse Phase 7 fail/block edilmelidir:

- Phase 6 completed değil.
- Real DUT yokken full CHECKPOINT 7 PASS veriliyor.
- Field Login/Load Tour özel Maestro orchestrator çağırıyor.
- Core/Bridge/Executor içine Nesy business type sızıyor.
- 20 barcode static node duplication ile çözülüyor.
- Offline queue failure veya ayrı evidence plane yapılıyor.
- Backend HTTP 2xx business success sayılıyor.
- Tour approval backend approved iken mobile notification/app state yoksa PASS veriliyor.
- Setup/precondition approval gerçek product PASS üretiyor.
- Unknown dialog/effect sessiz retry/green üretiyor.
- Scanner injection release build'de açık.
- D3 explicit approval/RBAC olmadan çalışıyor.
- Secret/PIN/token audit/export içine giriyor.
- Missing evidence kanıtsız SDK failure üretiyor.
- Preview profile release gate sonucunu değiştiriyor.
- Normal happy path full dump üretiyor.

## 11. Minimum verification commands

Agent kapanışta en az şunları çalıştırmalıdır:

```bash
pnpm verdict:verify-master-plan
pnpm typecheck
pnpm test
pnpm --filter @nesy/nesy-courier-domain-pack typecheck
pnpm --filter @nesy/nesy-courier-domain-pack test
pnpm --filter @nesy/api typecheck
pnpm --filter @nesy/api test
pnpm --filter @nesy/web typecheck
pnpm --filter @nesy/web test
git diff --check
git diff --cached --check
```

Gerçek DUT komutları ortamdan ortama değişebilir. Agent, gerçekten çalıştırdığı
DUT komutlarını RESULT.md içinde açık yazmalıdır. Cihaz yoksa:

```text
realDutAcceptance: BLOCKED_EXTERNAL_REAL_DUT
```

olarak bırakılmalıdır.

## 12. CHECKPOINT 7 acceptance checklist

Phase 7 kapanmadan aşağıdaki maddeler `PASS`, `FAIL`, `BLOCKED_EXTERNAL` veya
`DEFERRED_WITH_REASON` olarak RESULT.md'ye işlenmelidir.

1. Phase 6 output'ları doğrulandı.
2. Real DUT/device capability snapshot alındı veya external blocker yazıldı.
3. Field Login özel Maestro orchestrator olmadan çalışıyor.
4. Load Tour özel Maestro orchestrator olmadan çalışıyor.
5. Field Login generic WorkflowRunApi kullanıyor.
6. Load Tour generic WorkflowRunApi kullanıyor.
7. Setup login ile gerçek login E2E ayrımı görünür.
8. Setup login gerçek login PASS'i üretmiyor.
9. Tam kurye workflow gerçek DUT'ta tamamlanıyor veya real-DUT blocker açık.
10. Full workflow source-map/provenance Run Detail'de görünüyor.
11. Core package'larda STOP/PARCEL/ROUTE/DELIVERY type/branch yok.
12. Bridge business command almıyor.
13. Executor business command bilmiyor.
14. 20 barcode occurrence/evidence doğru.
15. 20 barcode runtime entity query + FOR_EACH ile çalışıyor.
16. 20 barcode statik node çoğaltması yok.
17. Stop/task/shipment/parcel stable entity key'leri occurrence'a bağlı.
18. UI'da görünmeyen stop identity bounded entity-target binding ile çözülüyor.
19. Bütün stop collection SDK event stream'ine taşınmıyor.
20. Offline queue false failure üretmiyor.
21. Queue Local subtype olarak değerlendiriliyor.
22. PASS_QUEUED_OFFLINE doğru üretiliyor.
23. Backend confirmation doğru node/iteration/entity correlation ile bağlı.
24. HTTP 2xx business success sayılmıyor.
25. Dialog policy route/session/update/network/permission yüzeylerini ayırıyor.
26. Unknown dialog STOP + screenshot + scoped dump üretiyor.
27. wait_any expected match küçük correlated result döndürüyor.
28. wait_any interrupt aynı beklemede expected'ı kesebiliyor.
29. Normal happy path'te sürekli/per-poll full dump yok.
30. Continue Gate readiness sağlanır sağlanmaz ilerliyor.
31. Final Oracle eventual kanıtı ayrı tamamlıyor.
32. Tour Approval Lifecycle real mode backend approved + push/mobile receive + app state + UI surface zinciriyle geçiyor.
33. Tour Approval backend approved ama mobile notification/app state yoksa devam etmiyor.
34. Tour Approval failure boundary remote→mobile notification/app sync olarak raporlanıyor.
35. Tour Approval setup/precondition mode product PASS üretmiyor.
36. Tour Approval partial/timeout/unknown remote effect resource'u reconciliation/quarantine yapıyor.
37. Scanner injection yalnız automation build/capability ile çalışıyor.
38. DIRECT_STATE release build'de kapalı.
39. Real scanner senaryosu çalışıyor veya external blocker açık.
40. Manual/unknown scanner/input origin doğru raporlanıyor.
41. FULL_JOURNEY Launch Profile çalışıyor.
42. PREPARED_SESSION Launch Profile setup-only sonucunu doğru raporluyor.
43. DIRECT_STATE Launch Profile release isolation'a uyuyor.
44. Launch readiness failure ayrı raporlanıyor.
45. Cleanup failure business verdict'i overwrite etmiyor.
46. Evidence Journey SDK explicit failure fixture'ı doğru stage'e bağlanıyor.
47. Evidence Journey transport/auth failure fixture'ı doğru stage'e bağlanıyor.
48. Evidence Journey host commit fixture'ı doğru stage'e bağlanıyor.
49. Evidence Journey ordered gap fixture'ı ordered processing blocked gösteriyor.
50. Evidence Journey normalization failure SDK failure sayılmıyor.
51. Evidence Journey correlation miss SDK/WAL failure sayılmıyor.
52. Missing event kanıtsız SDK failure üretmiyor.
53. Evidence conflict/stale fact Oracle PASS üretmiyor.
54. Bridge injected action BRIDGE_INJECTED görünüyor.
55. Operator contamination MANUAL görünüyor.
56. Ayrıştırılamayan SDK click UNKNOWN kalıyor.
57. Human metric baseline automation injection ile şişmiyor.
58. D1/D2/D3 capture policy uygulanıyor.
59. D3 role + explicit approval gerektiriyor.
60. Failure-triggered scoped capture quota/redaction/RBAC/retention altında çalışıyor.
61. Yakalanmayan tree için retrospective dump iddiası yok.
62. Repro NOT_CAPTURED state'i açık gösteriyor.
63. Sensitive artifact purge SLA içinde.
64. Audit actor/device/run/command/result taşıyor.
65. Audit secret/PIN/token taşımıyor.
66. Zorunlu event/state/query capability yoksa compile/preflight fail-fast ediyor.
67. `nesy.smoke.core` profile published pack içinde mevcut.
68. `nesy.regression.critical` profile published pack içinde mevcut.
69. `nesy.regression.differential` profile published pack içinde mevcut.
70. Recovery profiles published pack içinde mevcut.
71. Bad Day profile business fact/surface/source trigger kullanıyor.
72. Contract/Consistency profile HTTP/local/remote consistency kontrol ediyor.
73. Load 60/120 stop profile'ları mevcut.
74. Compatibility field-devices profile mevcut.
75. Security release-isolation profile automation seam leak'te NO_GO üretiyor.
76. Short soak profile restart/resume state'i doğru yönetiyor.
77. Preview accessibility profile release gate'i değiştirmiyor.
78. Smart Explorer Preview release gate'i değiştirmiyor.
79. PR campaign schedule fake fixture ile doğrulandı.
80. Nightly campaign schedule fake fixture ile doğrulandı.
81. Weekly campaign schedule fake fixture ile doğrulandı.
82. Release campaign schedule fake fixture ile doğrulandı.
83. En az bir real DUT campaign cell çalıştı veya external blocker açık.
84. Campaign matrix cell gerçek Run Detail/Evidence summary olmadan PASS/FAIL üretmiyor.
85. Workflow list → editor → run → run detail → history deep-link zinciri çalışıyor.
86. Same workflow/plan/run/domain-pack provenance zinciri tutarlı.
87. Differential Regression critical fact loss'u build-to-build diff'te gösteriyor.
88. Recovery/Bad Day trigger correlation yoksa fail-closed.
89. Basic Accessibility Audit yalnız güvenilir Bridge metadata ile sınırlı.
90. Smart Explorer crash/ANR/unexpected surface sinyali preview olarak etiketli.
91. Full verification komutları çalıştırıldı ve RESULT.md'ye yazıldı.

## 13. Phase 8 handoff expectation

İdeal kapanış:

```text
Phase 7: COMPLETED
CHECKPOINT 7: PASSED_WITH_EXTERNAL_DUT_BLOCKERS if lab coverage incomplete, otherwise PASSED
Phase 8 readiness: READY_WITH_EXTERNAL_BLOCKERS
Reason: Nesy reference workflows and v1 Test Profile catalog run on generic BridgeFlowExecutor/Oracle path; physical Bridge B1 acceptance and Maestro cutover measurement remain Phase 8.
```
