# Phase 6 RUN_PLAY — Cockpit UI, Route Cutover, Live Inspector and Run Detail

```yaml
runPlayId: verdict-cockpit-phase-6-run-play
phase: "6"
phaseName: "Cockpit UI + PageMigrationManifest + Live Inspector + Run Detail + Test Profile/Campaign UI"
status: NOT_STARTED
recoveryState: WAITING_FOR_PHASE_5_COMPLETION
createdAt: "2026-08-05 14:39:38 +03"
startedAt: null
completedAt: null
lastUpdatedAt: "2026-08-05 14:39:38 +03"
timezone: "Europe/Istanbul"
masterPlanPath: "docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:76024d898cb152fe4d885fb18e798cb24b6c3df31715eac546c64383ed5c2bd0"
verifyMasterPlanCommand: "pnpm verdict:verify-master-plan"
previousPhaseResult: "docs/verdict/run-playbooks/phase-5/RESULT.md"
resultFile: "docs/verdict/run-playbooks/phase-6/RESULT.md"
phase5StatusRequired: "COMPLETED"
phase5ReadinessRequired: "READY_WITH_EXTERNAL_BLOCKERS"
phase6Target: "CHECKPOINT_6"
phase7ReadinessTarget: "READY_WITH_EXTERNAL_BLOCKERS"
blockingPreflight:
  - id: "PHASE_5_NOT_COMPLETE"
    status: "BLOCKING"
    meaning: "Phase 6 UI, Phase 5 runtime/read-model DTO'larına dayanır. Phase 5 tamamlanmadan UI kendi runtime davranışını icat edemez."
  - id: "CP3-DUT"
    status: "OPEN_EXTERNAL"
    meaning: "Real DUT mutation acceptance external. Phase 6 UI read/preview/blocked state kurulabilir; production Act/release acceptance için external blocker taşınır."
  - id: "B-12"
    status: "OPEN_EXTERNAL"
    meaning: "Production cihaz smoke handshake flaky. Device Lab real-device durum kartlarında blocker/remediation olarak gösterilmeli."
  - id: "B-8"
    status: "OPEN_NON_BLOCKING"
    meaning: "Repo-wide lint ESLint v9 flat-config borcu; Phase 6 touched web/API surfaces kendi targeted lint/typecheck/test gate'lerinden geçmelidir."
```

## 1. Şu an hangi kısımdayız?

Phase 6, artık compiler/runtime çalışmasının kullanıcıya görünen Cockpit ürün
yüzeyine taşındığı fazdır.

```text
Phase 4A: WorkflowIR v2 + Condition Engine COMPLETE
Phase 4B: Domain Pack Contracts + Nesy Courier Reference Pack COMPLETE
Phase 4C: BridgeFlowCompiler MUST_BE_COMPLETED_FIRST
Phase 5: BridgeFlowExecutor + Oracle v2 + Persistence MUST_BE_COMPLETED_FIRST
Phase 6: Cockpit UI / Route Cutover / Run Detail / Live Inspector READY_TO_PREPARE
Next after 6: Phase 7 Nesy real workflows and Test Profile catalog acceptance
```

Bu fazın hedefi, yeni runtime'ı operatörün güvenle kullanacağı UI ve API
yüzeylerine dönüştürmektir.

Bu fazda UI kendi truth modelini icat etmez. Phase 5'te kabul edilmiş
`RunDetailQuery`, `EvidenceJourneyQuery`, `DeviceReadinessQuery`,
`WorkflowCompileApi`, `DomainPackAdminApi`, `TestProfile*` ve `TestCampaign*`
DTO/read model'lerini tüketir.

## 1.1 AI agent'a verilecek başlangıç metni

Aşağıdaki prompt başka bir AI agent'a doğrudan verilebilir. Prompt özellikle
uzundur; çünkü Phase 6, route/UI yüzeyi geniş olan ve yanlış yapılırsa eski
Maestro/YAML dilini gizlice yaşatabilecek bir fazdır.

```text
Verdict Cockpit Phase 6'yı uygula.

Önce şu dosyayı tamamen oku:
docs/verdict/run-playbooks/phase-6/RUN_PLAY.md

Sonra şu dosyayı oku:
docs/verdict/run-playbooks/phase-6/RESULT.md

Çalışmaya başlamadan önce Phase 5 gate'ini doğrula:
docs/verdict/run-playbooks/phase-5/RESULT.md

Phase 5 RESULT içinde şu iki koşul yoksa Phase 6 implementasyonuna BAŞLAMA:
- resultState: COMPLETED
- phase6Readiness: READY_WITH_EXTERNAL_BLOCKERS

Bu koşullar yoksa sadece Phase 6 RESULT.md içinde BLOCKED_PRECONDITION olarak
raporla, hangi Phase 5 DTO/read-model/runtime output'larının eksik olduğunu yaz
ve dur.

Master planda özellikle şu bölümleri oku:
- D.11 Automation Editor
- D.11A Yedi workspace route migrasyonu ve bilgi mimarisi
- D.11B Page data-source ve API cutover contract'ı
- D.11C Page availability, acceptance ve regression gate'i
- D.12 Live Inspector
- D.13 Device Lab ve Operational Readiness
- D.15 Run Detail ve Repro
- D.22 Evidence Journey Diagnostic Runtime
- D.23 Evidence Presentation, Interaction Origin ve Repro
- D.24 Test Profile Catalog ve Campaign Runtime
- D.25 ilgili Launch/Profile UI/runtime contract bölümleri
- FAZ 6 — Editor, Live Inspector, Device Lab ve Run Detail
- CHECKPOINT 6
- H.5 route/page dönüşüm kararları
- H.9 uygulanacak iş sırası

Input contract'ları:
- Phase 5 output DTO/read models
- packages/workflow-contract
- packages/domain-pack-contracts
- packages/bridgeflow-compiler
- packages/bridgeflow-executor
- packages/oracle-engine
- packages/execution-contract
- apps/api route/services for Verdict runtime
- apps/web App Router routes/components

Phase 6'nın hedefi:
Cockpit web yüzeyini yeni Verdict runtime'a bağla. Operatör Maestro/YAML bilmeden
workflow author edebilmeli, Domain Pack/Test Profile/Test Campaign yönetebilmeli,
Live Inspector ile Screen/Surface/Target mapping yapabilmeli, Run Detail'de
occurrence/evidence/oracle/repro'yu anlayabilmeli ve bütün production route'lar
PageMigrationManifest acceptance ile korunmalı.

Kesin yasaklar:
- UI içinde local compiler fallback yazma.
- YAML/Maestro preview'ı yeni primary yüzey gibi yaşatma.
- Eski Maestro-specific renderer/DTO'yu yeni BridgeFlow run detail için kullanma.
- Yeni top-level Verdict workspace ekleme; yedi workspace korunur.
- `/debug-view/screen-state` yanında ikinci paralel Inspector route'u açma; mevcut route Live Inspector rolüne genişler.
- Sayfayı legacy kaynağa sessiz fallback yaptırma.
- Mock/stale data'yı gerçek runtime sonucu gibi gösterme.
- Campaign cell'e gerçek run/evidence summary olmadan PASS/FAIL yazma.
- Preview profile sonucunu release gate/business verdict gibi gösterme.
- Continue Gate ve Final Oracle'ı tek success rozeti altında birleştirme.
- Cleanup failure'ı business FAIL'e dönüştürme.
- Compact badge'leri component default'undan üretme; compiled occurrence applicability snapshot authority'dir.
- Badge animation'ı gerçek chronology gibi sunma.
- Normal successful step için full dump üretme.
- Kanıtsız “event gelmedi → SDK failed” root-cause metni üretme.
- Production device Act Mode'u yalnız buton gizleme ile koruma; API fail-closed olmalı.

Yapılacaklar:

1. Preflight:
   - pnpm verdict:verify-master-plan
   - git status --short --branch
   - Phase 5 RESULT gate doğrulaması
   - pnpm typecheck
   - pnpm test
   - existing web route/test inventory

2. PageMigrationManifest:
   - apps/web için versioned PageMigrationManifest oluştur.
   - Her production route için routePattern, owner, currentSource, targetSource,
     targetDtoVersion, cutoverCheckpoint, availability, RBAC, legacy cleanup ve
     acceptance test ref taşı.
   - H.5/D.11A kapsamındaki bütün route'ları kapsa.
   - Bilinçli placeholder ile broken route'u ayrı raporla.

3. Yedi workspace navigation:
   - Top-level workspace sayısı yedi kalmalı.
   - Automation altına Domain Packs, Test Profiles, Test Campaigns ekle.
   - `/pm/root-cause` orphan kalmamalı; varsayılan karar Ticket Management altında
     Root Cause Intelligence olarak navigasyona eklemek.
   - `/engineering/current-architecture` hedef/geçiş mimarisini göstermeli.
   - `/engineering/modernization-plan` checkpoint/evidence dashboard'a dönüşmeli.

4. Domain Pack UI:
   - `/automation/domain-packs`
   - `/automation/domain-packs/[packId]`
   - Manifest/compatibility, applications, screens, surfaces, entities/targets,
     evidence sources, semantic actions/macros, oracle templates, launch profiles,
     test profiles, migrations/validation tab'leri.
   - Draft/published/archived state, optimistic concurrency ve immutable published
     version davranışı.
   - Published bundle hash, derived graph/reducer/test-profile digest ve active-run
     pinned version görünümü.

5. Automation Editor:
   - Shared contract form'ları.
   - Semantic action/macro palette.
   - Entity/query binding.
   - TargetFingerprint formu, fingerprint strength/drift.
   - rowKey primary, rowIndexHint warning.
   - OracleRequirement obligation/timing/deadline/onTimeout editor.
   - Continue Gate ve Final Oracle ayrı editörler.
   - Launch Profile/scanner mode seçimi.
   - Plan preview aynı WorkflowCompileApi/compiler endpoint'inden gelmeli.
   - Compile error canvas node'una source-map ile bağlanmalı.
   - YAML/Maestro dili deprecated/hidden olmalı; new primary UX olmamalı.

6. Live Inspector:
   - `/debug-view/screen-state` route'u Live Inspector rolüne genişlet.
   - Observe/Act permission ayrımı.
   - Production read-only + API-side fail-closed.
   - Screenshot viewport, orientation/inset/scale coordinate mapping.
   - Semantic node overlay.
   - Scoped dump/find; full dump yalnız explicit diagnostic capture.
   - TargetFingerprint üretimi ve match count.
   - Screen ve Active Surface aynı anda ayrı registry key'leriyle gösterilmeli.
   - Expected/Interrupt wait preview; persistent registration varmış gibi yanlış state gösterme.
   - Ambiguity/timeout/interrupt/cancel evidence occurrence'a bağlanmalı.
   - Target provider chain, ambiguity candidate ve bounded entity binding evidence gösterilmeli.

7. Device Lab:
   - DeviceReadinessQuery hedef DTO kullanılmalı.
   - ADB, SDK Control, SDK Event/Auth, Durable Ingest, Bridge, Backend Credentials,
     Local DB, Active Run ayrı health kartları.
   - Receipt Bus ve Ordered Bus health/lag/cursor/dead-letter ayrı gösterilmeli.
   - Command admission lane: active control/observation/wait/mutation count,
     queue, current mutation owner ve blocked reason.
   - B-12/CP3-DUT gibi external blocker'lar remediation ile görünmeli.

8. Run Detail / Evidence Journey / Repro:
   - RunDetailQuery ve EvidenceJourneyQuery target DTO'ları kullanılmalı.
   - Occurrence/iteration/retry tree.
   - UI/App/Local/Remote compact/detail badge.
   - Compact sadece applicable layer badge'lerini göstermeli.
   - Detail dört plane'i ve NOT_APPLICABLE/NOT_MEASURED/REQUIRED_PENDING açıklamalarını göstermeli.
   - Continue Gate ve Final Oracle ayrı timeline/state olarak gösterilmeli.
   - Action/gate/oracle/cleanup outcome ayrı olmalı.
   - Lifecycle/business verdict/termination/cleanup/operational disposition ayrı rozet/alan.
   - Evidence Journey dokuz stage'i: emit, WAL, transport, inbox, receipt, ordered,
     normalization, correlation, evaluation.
   - Raw WAL/inbox/cursor/reducer/fact/Oracle evidence deep-link'leri RBAC ile.
   - Interaction origin: BRIDGE_INJECTED/MANUAL/UNKNOWN + confidence + source evidence.
   - Exact repro export: yakalandıysa artifact hash/ref, yoksa NOT_CAPTURED.
   - Secret/PIN/token redaction.

9. Test Profile UI:
   - `/automation/test-profiles`
   - `/automation/test-profiles/[profileId]`
   - Profile kind, core/preview, releaseGate, last result, required capability,
     owner, pack version ve blocked reason.
   - Profile detail: workflow, launch profile, dataset, repetition, fault, device
     matrix, telemetry, Oracle, schedule, validation ve provenance.
   - Builder kind'e göre required alanları doğrulamalı.
   - Preview profile releaseGate=false olmak zorunda.

10. Test Campaign UI:
   - `/automation/test-campaigns`
   - `/automation/test-campaigns/[campaignId]`
   - PR/nightly/weekly/release campaign listesi.
   - Campaign matrix: profile x device/dataset cell, failedCells, evidenceSummaryRef,
     Run Detail deep-link.
   - Campaign cell gerçek run/evidence summary olmadan PASS/FAIL göstermemeli.
   - ReleaseGateResult policy açık görünmeli.

11. Page data-source cutover:
   - `/debug-view/overview`
   - `/debug-view/operational-health`
   - `/debug-view/screen-state`
   - `/debug-view/interactions`
   - `/automation/list`
   - `/automation/history`
   - `/automation/[id]`
   - `/automation/[id]/runs/[runId]`
   - `/automation/field-login`
   - `/automation/01-load-tour-flow`
   - Domain Pack/Test Profile/Test Campaign routes
   - Legacy adapter varsa owner, metric, expiry ve removal checkpoint şart.

12. Non-regression:
   - Product/PM/Engineering Tools/Data Center korunmalı.
   - Debug View network/log explorer/schedule/database kaynakları bilinçli korunmalı.
   - Data Center NesyAuthProvider SDK run auth'a taşınmamalı.

13. Page acceptance:
   - navigation smoke
   - direct/deep-link
   - browser refresh
   - dynamic param validation
   - loading/empty/partial/disconnected/blocked/error
   - auth/RBAC
   - responsive layout
   - keyboard accessibility/focus restoration
   - secret redaction
   - data-source contract
   - legacy-zero patterns

14. Tests:
   - PageMigrationManifest coverage test.
   - Route smoke/deep-link/refresh tests.
   - Data-source cutover tests.
   - Legacy-zero tests for Maestro/YAML primary UI.
   - Run Detail occurrence/applicability/Evidence Journey tests.
   - Repro redaction tests.
   - Inspector production Act denied tests.
   - Campaign cell no-evidence no-PASS tests.
   - Navigation seven-workspace test.

15. Verification:
   - pnpm verdict:verify-master-plan
   - pnpm typecheck
   - pnpm test
   - targeted web tests
   - targeted API DTO tests
   - git diff --check
   - git diff --cached --check

Kapanış:
- RESULT.md'yi COMPLETED, READY_WITH_BLOCKERS, BLOCKED_PRECONDITION,
  BLOCKED_EXTERNAL veya FAILED olarak güncelle.
- CHECKPOINT 6 acceptance checklist'ini kanıtlarla doldur.
- Bilinçli placeholder'ları BACKLOG olarak ayrı raporla.
- Phase 7 readiness kararını yaz.
- Real DUT/production Act acceptance yapılamadıysa external blocker olarak açık bırak.
```

## 2. Phase 6 hedef mimarisi

Phase 6, Phase 5 read model ve DTO'larını Cockpit ekranlarına bağlar.

```text
Phase 5 Runtime APIs
  ├── WorkflowCompileApi
  ├── WorkflowRunApi
  ├── RunHistoryQuery
  ├── RunDetailQuery
  ├── EvidenceJourneyQuery
  ├── DeviceReadinessQuery
  ├── DomainPackAdminApi
  ├── TestProfileCatalogQuery
  ├── TestCampaignQuery
  └── TestCampaignResultQuery
      ↓
Cockpit Web
  ├── Automation Editor
  ├── Domain Pack Manager
  ├── Test Profile Builder
  ├── Test Campaign Matrix
  ├── Live Inspector
  ├── Device Lab
  ├── Run Detail / Evidence Journey
  └── PageMigrationManifest / route acceptance
```

UI, runtime kararlarını yeniden hesaplamaz. UI'nın görevi:

- doğru DTO'yu tüketmek,
- blocked/partial/expired/not-captured durumlarını açık göstermek,
- operator action'larını RBAC/capability ile sınırlamak,
- evidence ve provenance'ı anlaşılır hâle getirmektir.

## 3. Başlama gate'i

Phase 6 agent'ı başlamadan önce şu koşulları doğrulamalıdır:

```text
docs/verdict/run-playbooks/phase-5/RESULT.md
  resultState: COMPLETED
  phase6Readiness: READY_WITH_EXTERNAL_BLOCKERS
```

Bu iki koşul yoksa:

- Kod yazılmayacak.
- UI route scaffold edilmeyecek.
- Existing UI component'leri değiştirilmeden bırakılacak.
- `RESULT.md` `BLOCKED_PRECONDITION` olarak güncellenecek.
- Eksik Phase 5 DTO/read-model listesi yazılacak.

Phase 5 tamamlandıktan sonra Phase 6'nın tüketmesi gereken minimum artifact'ler:

```text
WorkflowCompileApi
WorkflowRunApi
RunHistoryQuery
RunDetailQuery
EvidenceJourneyQuery
DeviceReadinessQuery
LegacyRunSummaryQuery
DomainPackAdminApi
TestProfileCatalogQuery
TestProfileDetailQuery
TestProfileValidationApi
TestCampaignQuery
TestCampaignStartApi
TestCampaignResultQuery
Run lifecycle/result taxonomy
Occurrence applicability snapshot
Interaction origin contract
ReproCaptureManifest contract
Page DTO versioning contract
```

## 4. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `6` |
| Current step | `6.0` |
| Current state | `WAITING_FOR_PHASE_5_COMPLETION` |
| Last successful step | `5.0` |
| Last attempted step | `6.0` |
| Last update | `2026-08-05 14:39:38 +03` |
| Recovery instruction | `Phase 6 playbook hazır. Phase 5 RESULT COMPLETED + phase6Readiness READY_WITH_EXTERNAL_BLOCKERS olmadan implementation başlatma.` |

## 5. Owned paths

Beklenen owned paths:

```text
apps/web/src/app/**
apps/web/src/components/**
apps/web/src/lib/**
apps/web/src/services/**
apps/web/src/test/**
apps/api/src/routes/verdict-*.ts
apps/api/src/services/page-*.ts
apps/api/src/services/domain-pack-*.ts
apps/api/src/services/test-profile-*.ts
apps/api/src/services/test-campaign-*.ts
apps/api/src/services/run-detail-*.ts
apps/api/src/services/evidence-journey-*.ts
apps/api/src/app.ts
docs/verdict/run-playbooks/phase-6/**
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
domain-packs/nesy-courier/**
```

Contract eksiği çıkarsa önce `BLOCKED_UPSTREAM_CONTRACT` yazılmalıdır. UI içinde
duplicate local type/enum icat edilmemelidir.

## 6. Step plan

| Step | Status | Açıklama | Output |
|---|---|---|---|
| 6.0 Playbook oluşturma | `DONE` | `RUN_PLAY.md` + `RESULT.md` oluşturuldu. | Phase 6 hazır ama gated |
| 6.1 Phase 5 gate doğrulama | `PENDING` | Phase 5 `COMPLETED` ve `phase6Readiness` doğrula. | Gate evidence |
| 6.2 Preflight baseline | `PENDING` | Digest, branch, status, typecheck, test, web route inventory. | Baseline |
| 6.3 PageMigrationManifest | `PENDING` | Production route manifest ve acceptance refs. | Manifest |
| 6.4 Navigation/yedi workspace | `PENDING` | Domain Packs/Test Profiles/Test Campaigns/Root Cause nav. | Navigation |
| 6.5 Data-source contract adapters | `PENDING` | D.11B target DTO adapters. | Web/API service layer |
| 6.6 Domain Pack catalog | `PENDING` | `/automation/domain-packs`. | Catalog UI |
| 6.7 Domain Pack detail manager | `PENDING` | Tabs, draft/published, registry managers. | Manager UI |
| 6.8 Automation Editor cutover | `PENDING` | Semantic macro, entity binding, compile API preview. | Editor |
| 6.9 Plan preview/provenance | `PENDING` | Same compiler endpoint, hash/source-map. | Preview |
| 6.10 Launch Profile Builder | `PENDING` | process/precondition/entry/readiness/cleanup. | Builder |
| 6.11 Evidence Source UI | `PENDING` | source kind/authority/correlation/freshness/lane/conflict. | Registry UI |
| 6.12 Target Resolution UI | `PENDING` | provider chain, ambiguity, entity binding evidence. | Target UI |
| 6.13 Live Inspector | `PENDING` | observe/act, overlay, scoped find, wait preview. | Inspector |
| 6.14 Device Lab readiness | `PENDING` | DeviceReadinessQuery, bus health, command admission. | Device Lab |
| 6.15 Run Detail 6A | `PENDING` | Evidence Journey drawer + exact/NOT_CAPTURED repro. | Drawer-first |
| 6.16 Run Detail 6B | `PENDING` | Static occurrence-applicable badges/detail four-plane. | Layer presentation |
| 6.17 Run Detail 6C | `PENDING` | Revision-aware live updates/reconnect/race. | Live state |
| 6.18 Interaction origin UI | `PENDING` | BRIDGE_INJECTED/MANUAL/UNKNOWN filters/confidence. | Origin presentation |
| 6.19 Test Profile catalog/detail | `PENDING` | `/automation/test-profiles*`. | Profile UI |
| 6.20 Test Profile Builder | `PENDING` | kind-specific validation and releaseGate rules. | Builder |
| 6.21 Test Campaign list/detail | `PENDING` | `/automation/test-campaigns*`. | Campaign UI |
| 6.22 Campaign matrix | `PENDING` | cells, failedCells, evidence summary, run deep-links. | Matrix |
| 6.23 Debug View cutover | `PENDING` | overview/operational/screen/interactions target data sources. | Debug View |
| 6.24 Automation legacy routes | `PENDING` | list/history/editor/run detail/field-login/load-tour URL continuity. | Automation routes |
| 6.25 Engineering pages | `PENDING` | current-architecture + modernization checkpoint dashboard. | Engineering UI |
| 6.26 Non-regression suite | `PENDING` | Product/PM/Engineering/Data Center/ADB routes. | Regression |
| 6.27 Page acceptance tests | `PENDING` | navigation/direct/refresh/RBAC/loading/error/accessibility. | Acceptance |
| 6.28 Legacy-zero tests | `PENDING` | Maestro/YAML primary UI removal/expiry checks. | Legacy guard |
| 6.29 Verification | `PENDING` | digest/typecheck/test/diff checks. | Verification |
| 6.30 RESULT closure | `PENDING` | CHECKPOINT 6 checklist + Phase 7 readiness. | Handoff |

## 7. Route scope

Phase 6, yedi workspace yapısını korur. Yeni `Verdict` top-level workspace
eklenmez.

Automation altında eklenecek yeni route'lar:

```text
/automation/domain-packs
/automation/domain-packs/[packId]
/automation/test-profiles
/automation/test-profiles/[profileId]
/automation/test-campaigns
/automation/test-campaigns/[campaignId]
```

Korunacak mevcut route'lar:

```text
/automation/list
/automation/history
/automation/field-login
/automation/01-load-tour-flow
/automation/[id]
/automation/[id]/runs/[runId]
/automation/overview
/debug-view/overview
/debug-view/operational-health
/debug-view/screen-state
/debug-view/interactions
/debug-view/network-inspector
/debug-view/schedule
/debug-view/database
/debug-view/adb-scenarios
/debug-view/log-explorer
/pm/root-cause
/engineering/current-architecture
/engineering/modernization-plan
```

`/debug-view/screen-state` ikinci route'a taşınmaz; Live Inspector rolüne genişler.

## 8. Data-source ilkeleri

Her page component doğrudan legacy API shape'e bağlanmamalıdır. Versioned service/BFF
adapter kullanılmalıdır.

```ts
interface PageDataSourceContract {
  routePattern: string;
  currentSource: string;
  targetSource: string;
  targetDtoVersion: string;
  cutoverCheckpoint: string;
  compatibilityAdapter?: string;
  compatibilityExpiry?: string;
  fallbackPolicy: "NONE" | "READ_ONLY_LEGACY_SUMMARY";
}
```

Sessiz fallback yoktur.

Doğru blocked state:

```text
targetSource unavailable
  → typed BLOCKED_PRECONDITION / blocked reason / remediation
```

Yanlış model:

```text
targetSource unavailable
  → stale mock / legacy data / fake success
```

## 9. Increment sırası

Run Detail dönüşümü üç increment'tir:

```text
6A: Evidence Journey/detail drawer + exact/NOT_CAPTURED repro export
6B: Static occurrence-applicable compact/detail layer badges
6C: Revision-aware live subscription + reconnect/race acceptance
```

6A kabul edilmeden 6B tamamlandı sayılamaz. 6B race/static acceptance geçmeden
6C release edilmez.

## 10. Page acceptance sınıfları

Her hedef route için acceptance şu sınıfları kapsamalıdır:

- navigation smoke
- direct/deep-link
- browser refresh
- dynamic route parameter validation
- loading state
- empty state
- partial state
- disconnected state
- blocked/stale/error state
- auth/RBAC
- responsive layout
- keyboard/focus accessibility
- screen-reader label
- secret/PIN/token redaction
- page data-source contract
- compatibility adapter expiry
- legacy-zero patterns

## 11. Safety blockers

Şu durumlardan biri görülürse Phase 6 fail/block edilmelidir:

- Phase 5 completed değil.
- UI kendi compiler/runtime truth'unu icat ediyor.
- New top-level Verdict workspace ekleniyor.
- Existing route broken/orphan kalıyor.
- `/pm/root-cause` orphan kalıyor.
- Domain Pack/Test Profile/Campaign route'ları deep-link/refresh ile açılmıyor.
- Campaign cell evidence olmadan PASS/FAIL gösteriyor.
- Preview profile release gate gibi davranıyor.
- YAML/Maestro primary authoring dili olarak kalıyor.
- Legacy adapter expiry/owner olmadan kalıcılaşıyor.
- Run Detail engine-specific Maestro renderer kullanıyor.
- Continue Gate ve Final Oracle tek success durumuna indirgeniyor.
- Cleanup failure business verdict'i bozuyor.
- Evidence Journey kanıtsız root cause iddiası üretiyor.
- Production Inspector Act API-side deny olmadan yalnız UI hide ile korunuyor.
- Normal successful step full dump export ediyor.
- Exact repro yakalanmamış artifact'i varmış gibi gösteriyor.

## 12. Minimum verification commands

Agent kapanışta en az şunları çalıştırmalıdır:

```bash
pnpm verdict:verify-master-plan
pnpm typecheck
pnpm test
pnpm --filter @nesy/web typecheck
pnpm --filter @nesy/web test
pnpm --filter @nesy/api typecheck
pnpm --filter @nesy/api test
git diff --check
git diff --cached --check
```

Eğer web/API package isimleri farklıysa RESULT.md içinde gerçek komutlar
yazılmalıdır.

## 13. CHECKPOINT 6 acceptance checklist

Phase 6 kapanmadan aşağıdaki maddeler `PASS`, `FAIL`, `BLOCKED_EXTERNAL` veya
`DEFERRED_WITH_REASON` olarak RESULT.md'ye işlenmelidir.

1. Phase 5 output'ları doğrulandı.
2. Operatör Maestro/YAML bilmeden workflow oluşturabiliyor.
3. Preview ile executed plan hash'i aynı.
4. Compile error doğru canvas node'una bağlanıyor.
5. YAML/Maestro primary authoring UI deprecate edildi.
6. Web local compiler fallback yok.
7. Top-level workspace sayısı yedi.
8. Domain Packs nav entry mevcut.
9. Test Profiles nav entry mevcut.
10. Test Campaigns nav entry mevcut.
11. `/pm/root-cause` orphan değil.
12. `/engineering/current-architecture` hedef/geçiş mimarisini gösteriyor.
13. `/engineering/modernization-plan` checkpoint/evidence dashboard.
14. PageMigrationManifest bütün production route'ları kapsıyor.
15. Domain Pack catalog route navigation/direct/refresh ile açılıyor.
16. Domain Pack detail manager tabs çalışıyor.
17. Domain Pack publish/migrate RBAC fail-closed.
18. Published bundle/graph/reducer/profile digest görünür.
19. Active-run pinned version görünür.
20. Application/Screen/Surface Registry manager mevcut.
21. Surface parent-screen/kind/detection/readiness/default policy editlenebilir.
22. Evidence Source Registry source/authority/correlation/freshness/conflict gösteriyor.
23. Evidence Source delivery lane gösteriliyor.
24. Target Resolution Provider Chain evidence/ambiguity gösteriyor.
25. Launch Profile Builder process/precondition/entry/readiness/cleanup doğruluyor.
26. Test Profile catalog/detail route'ları çalışıyor.
27. Test Profile Builder kind-specific required alanları doğruluyor.
28. Preview profile releaseGate=false constraint uygulanıyor.
29. Test Campaign list/detail route'ları çalışıyor.
30. Campaign matrix profile x device/dataset cell gösteriyor.
31. Campaign cell gerçek run/evidence olmadan PASS/FAIL üretmiyor.
32. Campaign cell Run Detail deep-link veriyor.
33. Automation list WorkflowCatalogQuery target DTO'ya geçti.
34. Automation history RunHistoryQuery target DTO'ya geçti.
35. Automation editor WorkflowCompileApi kullanıyor.
36. Automation run detail RunDetailQuery kullanıyor.
37. Field Login generic WorkflowRunApi + Nesy Courier Domain Pack'e yönleniyor.
38. Load Tour generic WorkflowRunApi + Nesy Courier Domain Pack'e yönleniyor.
39. Legacy run yalnız LegacyRunSummaryQuery ile read-only açılıyor.
40. Debug overview DeviceReadinessQuery ile birleşik health gösteriyor.
41. Operational health ADB-only kaynak değil.
42. Screen State Live Inspector rolüne genişledi.
43. İkinci paralel Inspector route'u yok.
44. Interactions DurableInteractionSubscription target source kullanıyor.
45. Network Inspector/log explorer/schedule/database non-regression korunuyor.
46. Device kartı ADB/SDK Control/SDK Event/Auth/Durable Ingest/Bridge/Backend/Local DB/Active Run ayrımı gösteriyor.
47. Receipt Bus ve Ordered Bus health ayrı görünüyor.
48. Command admission lane/owner/block reason görünüyor.
49. Production Inspector Act API-side fail-closed.
50. Inspector overlay orientation/inset coordinate testleri geçiyor.
51. Ambiguous node UI'da açık ve action disabled.
52. Full dump yalnız explicit diagnostic capture.
53. Current Screen ve Active Surface ayrı registry key'leriyle aynı anda görünüyor.
54. Expected/Interrupt wait preview lifecycle doğru; persistent registration yanılsaması yok.
55. Run Detail occurrence/iteration/retry'yi ayırıyor.
56. Continue Gate ve Final Oracle ayrı sunuluyor.
57. Action/gate/oracle/cleanup outcomes ayrı sunuluyor.
58. Lifecycle/verdict/termination/cleanup/operational disposition ayrı sunuluyor.
59. Cleanup failure business PASS'i business FAIL'e çevirmiyor.
60. Compact node yalnız applicable layer badge'lerini gösteriyor.
61. Detail drawer dört plane'i explicit applicability state'leriyle gösteriyor.
62. NOT_APPLICABLE, NOT_MEASURED ve REQUIRED_PENDING ayrı anlamlarla görünüyor.
63. UI/App/Local/Remote badge state'i persisted revision'dan geliyor.
64. Badge animation chronology iddiası taşımıyor.
65. Waterfall clock uncertainty gösteriyor.
66. Evidence Journey dokuz stage'i gösteriyor.
67. Evidence Journey raw evidence deep-link'leri RBAC'li.
68. Evidence Journey kanıtsız SDK/root-cause iddiası üretmiyor.
69. Raw technical evidence → normalized fact trace görünür.
70. Interaction origin BRIDGE_INJECTED/MANUAL/UNKNOWN gösteriliyor.
71. Bridge-injected click manual görünmüyor.
72. Korelasyonsuz SDK click UNKNOWN kalıyor.
73. Human baseline automation injection ile şişmiyor.
74. Repro export secret/PIN/token içermiyor.
75. Repro metadata app/SDK/Bridge/workflow/device/fingerprint/action/clock/artifact kapsıyor.
76. Yakalanmamış artifact açık NOT_CAPTURED.
77. Repro production Act Mode'u otomatik açmıyor.
78. Route navigation/direct-link/refresh matrix yeşil.
79. Loading/empty/error/disconnected/blocked states test edildi.
80. Auth/RBAC page acceptance yeşil.
81. Responsive/keyboard/focus accessibility smoke yeşil.
82. Legacy-zero Maestro/YAML primary UI checks yeşil.
83. Bilinçli placeholder'lar BACKLOG olarak ayrı raporlandı.
84. Product/PM/Engineering/Data Center/ADB route non-regression yeşil.
85. Full verification komutları çalıştırıldı ve RESULT.md'ye yazıldı.

## 14. Phase 7 handoff expectation

İdeal kapanış:

```text
Phase 6: COMPLETED
CHECKPOINT 6: PASSED_WITH_EXTERNAL_DUT_BLOCKERS
Phase 7 readiness: READY_WITH_EXTERNAL_BLOCKERS
Reason: Cockpit UI consumes accepted runtime DTOs, routes have PageMigrationManifest acceptance, Run Detail/Evidence Journey/Live Inspector are usable without Maestro/YAML authoring; real Nesy DUT workflow acceptance remains Phase 7.
```
