# Phase 4B RESULT — Domain Pack Contracts + Nesy Courier Reference Pack

```yaml
runPlayId: verdict-cockpit-phase-4b-run-play
phase: "4B"
phaseName: "Domain Pack Contracts + Nesy Courier Domain Pack + App Adapter Contracts"
resultState: COMPLETED
createdAt: "2026-08-05 12:34:03 +03"
startedAt: "2026-08-05 12:49:05 +03"
completedAt: "2026-08-05 13:45:26 +03"
lastUpdatedAt: "2026-08-05 14:13:49 +03"
timezone: "Europe/Istanbul"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:76024d898cb152fe4d885fb18e798cb24b6c3df31715eac546c64383ed5c2bd0"
runPlayFile: "docs/verdict/run-playbooks/phase-4b/RUN_PLAY.md"
previousPhaseResult: "docs/verdict/run-playbooks/phase-4a/RESULT.md"
targetPackage: "@nesy/domain-pack-contracts"
targetDomainPack: "@nesy/nesy-courier-domain-pack"
phase4CReadiness: "READY_WITH_EXTERNAL_BLOCKERS"
```

## 1. Executive result

Phase 4B implementation tamamlandı. CP4B-Core acceptance checklist'inin 40/40
maddesi gerçek kanıtla geçti.

İki yeni paket kuruldu:

```text
packages/domain-pack-contracts   (@nesy/domain-pack-contracts)      124 test
domain-packs/nesy-courier        (@nesy/nesy-courier-domain-pack)    83 test
```

`NESY_COURIER_DOMAIN_PACK_REFERENCE_V1` altı vertical slice ile oluşturuldu ve
fixture/test'lere bağlandı. Altı slice'ın Generic IR snapshot'ı
`validateWorkflowIrV2` ile doğrulanıyor — yani hand-authored olmaları
"kontrolsüz" anlamına gelmiyor; şekil kanıtlı, eşleme hâlâ insan kararı.

```text
Phase 4B implementation: COMPLETED
CP4B-Core acceptance (40/40): PASSED
Phase 4C compiler: BAŞLAMADI (kural gereği; export surface testiyle korunuyor)
Phase 5 executor/queue/lease: BAŞLAMADI
Phase 6 Domain Pack manager UI: BAŞLAMADI
Maestro removal / live cutover: YAPILMADI
Mobile repo: DOKUNULMADI
```

Hedeflenen kapsam:

```text
CP4B-Core: Domain Pack contract + Nesy Courier reference pack   ✅
Compiler: BAŞLAMAYACAK                                          ✅ başlamadı
Executor/runtime queue: BAŞLAMAYACAK                            ✅ başlamadı
Cockpit UI manager: BAŞLAMAYACAK                                ✅ başlamadı
```

## 2. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `4B` |
| Current step | `4B.20` |
| Current state | `COMPLETED` |
| Last successful step | `4B.20` |
| Last attempted step | `4B.20` |
| Last update | `2026-08-05 14:13:49 +03` |
| Recovery instruction | `Phase 4B bitti, tüm suite yeşil (17/17 task). packages/domain-pack-contracts + domain-packs/nesy-courier commit edilmeye hazır (staged). Sıradaki iş Phase 4C RUN_PLAY: Domain macro → Generic WorkflowIR v2 → BridgeFlowPlan compiler. §11'deki input listesi tüketilecek.` |

## 3. Inherited blockers / constraints

| ID | Severity | Description | Owner | Status | Phase 4B etkisi |
|---|---|---|---|---|---|
| CP3-DUT | HIGH/EXTERNAL | CP3 full mutation acceptance için userdebug/eng lab cihaz gerekiyor. | Device/Mobile owner | `OPEN_EXTERNAL` | CP4B-Core contract işini bloklamaz; Phase 5+ executor/cutover öncesi kapanmalı. |
| B-12 | MEDIUM | Production cihazda arka arkaya smoke handshake flaky. | Mobile owner | `OPEN` | Domain Pack contract işini bloklamaz; device smoke/release isolation doğrulamalarında taşınır. |
| B-14 | LOW | `runEpoch` birimi Bridge protocol v2'de açık yazılmalı. | Contract owner | `OPEN_LOW` | Phase 4B için not; Bridge protocol işi. |
| B-8 | MEDIUM | Repo-wide lint ESLint v9 flat-config borcu. | Platform owner | `OPEN_NON_BLOCKING` | Yeni package lint'i yeşil olmalı; repo-wide lint blocking olmayabilir. |

## 4. Step execution log

| Step | Status | Evidence |
|---|---|---|
| 4B.0 Playbook oluşturma | `DONE` | `RUN_PLAY.md` + `RESULT.md` |
| 4B.1 Preflight ve Phase 4A gate doğrulama | `DONE` | §5; digest OK, Phase 4A `COMPLETED`, `pnpm typecheck` 13/13, `pnpm test` 14/14, branch `production`, staged = yalnız phase-4b docs |
| 4B.2 Existing domain/app-adapter inventory | `DONE` | §5 "Existing Nesy Mobile automation seams": legacy vocabulary `yaml-generator.ts` / `logcat-sniffer.ts` / `workflow-ir-v2.ts` mapping tablosunda; dokunulmadı |
| 4B.3 Package boundary kararı | `DONE` | `pnpm-workspace.yaml`'a `domain-packs/*` glob'u eklendi; contract `packages/`, tenant içeriği `domain-packs/` |
| 4B.4 `packages/domain-pack-contracts` scaffold | `DONE` | 12 src dosyası + package/tsconfig/eslint/vitest; 0 runtime dependency dışında yalnız `@nesy/workflow-contract` |
| 4B.5 Manifest/Application compatibility contract | `DONE` | `manifest.ts` + `application.ts`; `MISSING_APP_COMPATIBILITY`, `FORBIDDEN_ADAPTER_CAPABILITY`, `ADAPTER_SEAM_NOT_ISOLATED`, `PUBLISHED_WITHOUT_PROVENANCE`, `THIRD_PARTY_RELEASE_GATE`; 10 test |
| 4B.6 Screen/Surface Registry contract | `DONE` | `screen-surface.ts`; 6 runtime implementation kind, 6 surface kind, `DIALOG_DECLARED_AS_SCREEN`, `SURFACE_PARENT_INCOMPATIBLE`, `compareSurfacePriority` deterministik tie-break; 7 test |
| 4B.7 Entity/Target Resolution Provider Chain contract | `DONE` | `entity-target.ts`; 6 strategy, `ROW_INDEX_AS_IDENTITY` / `ROW_INDEX_NOT_LAST` / `NO_IDENTITY_PROVIDER`, `AmbiguityPolicy`'de `FIRST_MATCH` yok, default `FAIL`; 10 test |
| 4B.8 Semantic Action/Macro + source-map contract | `DONE` | `semantic-action.ts`; `MacroExpansionSnapshot` (`authoredBy: HAND\|COMPILER`), `DomainSourceMap`, `BridgeFlowPlanSnapshot`, fragment/independent-workflow ayrımı; 11 test |
| 4B.9 Evidence Source Registry + normalized fact derivation contract | `DONE` | `evidence-source.ts`; 4 plane + `FORBIDDEN_EVIDENCE_PLANES`, `ALLOWED_SOURCE_KINDS_BY_PLANE`, `TRANSPORT_SUCCESS_AS_BUSINESS_FACT`, DAG cycle/self/undefined-input reddi; 15 test |
| 4B.10 LaunchProfile/TestProfile/Campaign contract | `DONE` | `profile.ts`; `SETUP_LAUNCH_PRODUCES_VERDICT`, `PREVIEW_PROFILE_GATES_RELEASE`, `GATING_PROFILE_SAMPLES_EVIDENCE`, fault correlation, differential baseline; 17 test |
| 4B.11 Feature Blueprint + Capability Contract boundary | `DONE` | `feature-capability.ts`; digest yalnız `FeatureExecutableContract` üzerinden, `AUTHORING_FIELD_IN_EXECUTABLE`, `AI_INVARIANT_GATES_RELEASE`, 3 katmanlı katalog; 13 test |
| 4B.12 Deterministic bundle/digest/immutability validation | `DONE` | `canonical.ts` + `bundle.ts`; SHA-256 canonical digest, `publishBundle` deep-freeze, `ActiveRunPinnedBundleRef`, `findRuntimeCodeViolations`; 17 test |
| 4B.13 Execution/impact leakage negative tests | `DONE` | `validate.ts`; `FORBIDDEN_EXECUTION_TYPE_NAMES` + segment-bazlı `LEASE`, 11 modülün export surface taraması 0 hit, `compile*`/`expandMacro*` export yasağı; 9 test |
| 4B.14 `domain-packs/nesy-courier` scaffold | `DONE` | 22 src dosyası, `docs/`, `fixtures/`, `scripts/write-fixtures.mjs` |
| 4B.15 Nesy registries and capability catalog | `DONE` | 1 app / 7 screen / 8 surface / 7 entity / 10 target / 35 evidence source / 4 derived fact / 8 action / 8 macro / 4 launch / 4 test profile / 1 campaign / 3 feature / 16 capability; sayılar teste bağlı |
| 4B.16 Nesy App Adapter contract/ref mapping | `DONE` | `registries/application.ts` 8 adapter capability + 7 named query; `adapters/backoffice.ts` 9 allowlisted typed audited operation |
| 4B.17 `NESY_COURIER_DOMAIN_PACK_REFERENCE_V1` artifact | `DONE` | `src/reference.ts` + `docs/NESY_COURIER_DOMAIN_PACK_REFERENCE_V1.md` (348 satır) |
| 4B.18 Six vertical-slice fixtures/snapshots | `DONE` | 6 reference + 4 negative fixture; `src/fixtures.test.ts` 11 test (drift + negatif doğrulama) |
| 4B.19 Domain-neutral leakage scans | `DONE` | §7 scan çıktıları; Core/Bridge'de yalnız guard tanımı + `*_MISMATCH`, Domain Pack'te yalnız guard listesi/doküman/test |
| 4B.20 Verification/result/handoff | `DONE` | §7 komut çıktıları |

## 5. Baseline inventory (4B.1 / 4B.2)

Preflight `2026-08-05 12:45–12:49 +03` arasında alındı.

| Soru | Bulgu |
|---|---|
| Phase 4A RESULT durumu | `COMPLETED` — `resultState: COMPLETED`, `phase4BReadiness: READY_WITH_EXTERNAL_BLOCKERS`, CP4A 22/22 |
| Master digest | `pnpm verdict:verify-master-plan` → `Master plan digest OK: sha256:76024d898cb152fe4d885fb18e798cb24b6c3df31715eac546c64383ed5c2bd0` (RUN_PLAY frontmatter ile aynı) |
| Current branch/status | `## production...origin/production`; staged: yalnız `docs/verdict/run-playbooks/phase-4b/RESULT.md` + `RUN_PLAY.md` (`A`). Başka kullanıcı değişikliği yok, hiçbir şey ezilmedi. |
| Existing package count | `packages/` altında 12 paket: `bridge-client`, `bridge-contract`, `control-channels`, `control-contract`, `db`, `eslint-config`, `metronic`, `platform-paths`, `types`, `typescript-config`, `ui`, `workflow-contract`. `pnpm-workspace.yaml` = `apps/*` + `packages/*`. |
| Existing Domain Pack package | **Yok.** Ne `packages/domain-pack-contracts` ne `domain-packs/` var. `domain-packs/*` workspace glob'u da yok → Phase 4B eklemeli. |
| Existing Nesy Mobile automation seams | Cockpit tarafındaki mevcut Nesy business vocabulary **legacy** katmanda: `apps/api/src/services/yaml-generator.ts` (`OPEN_STOP`, `VALIDATE_STOPLIST`, `DELIVERY_OPERATION`, `SCAN_PARCEL`, `SEARCH_STOP`, `OPEN_PARCEL`, `DELIVERY_FAIL_OPERATION`, `CANCEL_DELIVERY_OPERATION`), `apps/api/src/services/logcat-sniffer.ts` (aynı action isimleri logcat event olarak), `apps/api/src/services/workflow-ir-v2.ts` legacy node mapping tablosu. Bunlar Maestro/legacy yol; Phase 4B bunlara **dokunmadı**, Domain Pack registry'sini bunların yerine değil yanına kurdu. |
| Core/Bridge leakage baseline | `rg -n "OPEN_STOP\|COURIER_LOGIN\|STOP\|PARCEL\|DELIVERY\|TOUR_APPROVAL" packages/workflow-contract packages/bridge-contract packages/bridge-client apps/api/src/services` → contract paketlerindeki tüm hit'ler **yasak-listesi tanımı, doc yorumu veya guard testi**; hiçbiri type/union/command değil. `apps/api/src/services` hit'leri legacy yaml-generator/logcat-sniffer. Yeni business type yok. |
| Typecheck baseline | `pnpm typecheck` → `Tasks: 13 successful, 13 total`, exit 0 |
| Test baseline | `pnpm test` → `Tasks: 14 successful, 14 total`, exit 0 (turbo cache hit; Phase 4A kayıtlı sayılar: bridge-contract 50, control-channels 36, bridge-client 35, workflow-contract 79, web 134, api 267 passed/38 skipped) |

## 6. Changed files

68 dosya: 66 NEW, 2 MOD. Tamamı final review sonrası stage'e alınmalıdır.

### 6.1 Workspace

| Path | Değişim | Neden |
|---|---|---|
| `pnpm-workspace.yaml` | MOD | `domain-packs/*` glob'u eklendi. Ayrı glob, çünkü "shared contract" ile "bir tenant'ın business içeriği" görünür biçimde farklı şeyler olmalı. |
| `pnpm-lock.yaml` | MOD | İki yeni workspace paketi + workspace link'leri (beklenen) |

### 6.2 `packages/domain-pack-contracts` (NEW, 17 dosya)

| Path | Neden |
|---|---|
| `package.json` / `tsconfig.json` / `eslint.config.js` / `vitest.config.ts` | Paket scaffold; `@nesy/workflow-contract` dışında runtime dependency yok |
| `src/index.ts` | Export surface + dört yasak (execution plane / runtime code / compiler / transport) |
| `src/manifest.ts` | `DomainPackManifest`, `DomainPackVersion`, `PublishedBundleProvenance`, `DomainDependencyRef`, `DomainImpactRef`, `ResourceRequirementRef` (4B.5) |
| `src/application.ts` | `ApplicationDefinition`, `AppVersionCompatibility`, `AppAdapterCompatibility`, 8 izinli + 6 yasak adapter capability kind (4B.5) |
| `src/screen-surface.ts` | `ScreenDefinition`, `ScreenRuntimeImplementation`, `ScreenEntryStrategy`, `ReadinessContract`, `SurfaceDefinition`, `compareSurfacePriority` (4B.6) |
| `src/entity-target.ts` | `EntityDefinition`, `TargetDefinition`, `TargetResolutionPolicy` + provider chain validation (4B.7) |
| `src/semantic-action.ts` | `SemanticActionDefinition`, `MacroDefinition`, `DomainOracleTemplate`, `MacroExpansionSnapshot`, `BridgeFlowPlanSnapshot`, `DomainSourceMap`, fragment/workflow ayrımı (4B.8) |
| `src/evidence-source.ts` | `EvidenceSourceDefinition`, 4 plane, 9 source kind, `DerivedFactDefinition`, `ReducerProvenance`, DAG validation (4B.9) |
| `src/profile.ts` | `LaunchProfile`, `TestProfileDefinition`, `TestCampaignDefinition`, `FaultPlan`, `DifferentialPolicy`, `ReleaseIsolationContract` (4B.10) |
| `src/feature-capability.ts` | `FeatureAuthoringMetadata` / `FeatureExecutableContract` digest ayrımı, `FeatureInvariant`, `CapabilityContract` 3 katman (4B.11) |
| `src/remote-adapter.ts` | `RemoteAdapterDefinition` + allowlisted/typed/audited operation validation |
| `src/canonical.ts` | Canonical serialization + SHA-256 digest (workflow-contract ile aynı kural) |
| `src/bundle.ts` | `DomainPackBundle`, `computeBundleDigest`, `publishBundle`, `freezeBundle`, `ActiveRunPinnedBundleRef`, `findRuntimeCodeViolations` (4B.12) |
| `src/validate.ts` | `validateDomainPackBundle` 24 issue code + execution-plane guard (4B.13) |
| `src/index.test.ts` | 124 test, CP4B-Core acceptance suite + malformed JSON safe-parse guard |

### 6.3 `domain-packs/nesy-courier` (NEW, 39 dosya)

| Path | Neden |
|---|---|
| `package.json` / `tsconfig.json` / `eslint.config.js` / `vitest.config.ts` | Paket scaffold |
| `src/index.ts` | Export surface; business vocabulary'nin yaşamasına izin verilen tek yer |
| `src/slice.ts` | `NesyReferenceSlice` şekli (18 zorunlu alan) |
| `src/registries/facts.ts` | 38 plane-prefixed normalized fact key |
| `src/registries/application.ts` | `nesy.courier.mobile` + App Adapter beyanı (7 named query, 8 capability) |
| `src/registries/screens.ts` | 7 screen + screen/surface/action key sabitleri |
| `src/registries/surfaces.ts` | 8 surface, 4'ü global (`parentScreenRefs: ["*"]`) |
| `src/registries/entities.ts` | 7 entity, her biri business key + redaction + freshness ile |
| `src/registries/targets.ts` | 10 target; `nesy.target.stop-row` canonical 4 aşamalı provider chain |
| `src/registries/actions.ts` | 8 semantic action |
| `src/registries/capabilities.ts` | 16 capability, 3 katman (`verdict.core` 6 / `nesy` 9 / `mackolik` 1) |
| `src/registries/features.ts` | 3 feature blueprint; digest yalnız executable half'tan |
| `src/evidence/sources.ts` | 35 evidence source (UI 16 / APP 10 / LOCAL 4 / REMOTE 5) |
| `src/evidence/derived.ts` | 4 derived fact, hepsi correlated + `preserveInputs` |
| `src/adapters/backoffice.ts` | `nesy.backoffice`, 9 allowlisted typed audited operation |
| `src/macros/ir-authoring.ts` | Snapshot boilerplate helper'ı — expansion logic YOK (compiler değil) |
| `src/macros/common.ts` | Paylaşılan interrupt policy + release isolation sabitleri |
| `src/macros/login.ts` | COURIER_LOGIN slice + macro (10 IR step) |
| `src/macros/select-route.ts` | SELECT_ROUTE slice + macro (10 IR step) |
| `src/macros/open-stop.ts` | OPEN_STOP canonical slice + macro (7 IR step, 6 safeguard) |
| `src/macros/process-parcel.ts` | PROCESS_PARCEL slice + macro (7 IR step) |
| `src/macros/complete-delivery.ts` | COMPLETE_DELIVERY slice + macro (7 IR step, online/queued SWITCH) |
| `src/macros/tour-approval-lifecycle.ts` | TOUR_APPROVAL_LIFECYCLE slice + macro (9 IR step, multi-actor) |
| `src/macros/interrupt-handlers.ts` | HANDLE-policy surface'lerin handler macro'ları |
| `src/profiles/launch.ts` | 4 launch profile; yalnız `cold-real-login` verdict üretir |
| `src/profiles/workflows.ts` | 1 reusable fragment + 6 independent test workflow |
| `src/profiles/test-profiles.ts` | 4 test profile + 1 campaign |
| `src/reference.ts` | `NESY_COURIER_DOMAIN_PACK_REFERENCE_V1` + artifact digest |
| `src/bundle.ts` | Manifest + `buildNesyCourierBundle()` |
| `src/index.test.ts` | 72 test (bundle, registry, target, evidence, profile, feature, adapter, runtime-code, reference, OPEN_STOP, COURIER_LOGIN, TOUR_APPROVAL) |
| `src/fixtures.test.ts` | 11 test (fixture drift + 4 negatif fixture doğrulaması) |
| `scripts/write-fixtures.mjs` | Fixture'ları pack'in kendi tanımından üretir |
| `fixtures/*.json` (10) | 6 reference + 4 negative |
| `docs/NESY_COURIER_DOMAIN_PACK_REFERENCE_V1.md` | Reviewed-ready artifact dokümanı |

### 6.4 Docs

| Path | Değişim | Neden |
|---|---|---|
| `docs/verdict/run-playbooks/phase-4b/RUN_PLAY.md` | NEW/UPDATED | Playbook + post-review recovery state |
| `docs/verdict/run-playbooks/phase-4b/RESULT.md` | NEW/UPDATED | Result tracker + acceptance evidence |

### 6.5 Dokunulmayanlar (bilinçli)

```text
packages/workflow-contract/**        (yalnız okundu; import/compat için bile değişiklik gerekmedi)
packages/bridge-contract/**          (dokunulmadı)
packages/bridge-client/**            (dokunulmadı)
apps/api/src/services/workflow-runner.ts, maestro-executor.ts, yaml-generator.ts,
  logcat-sniffer.ts, oracle-engine.ts, workflow-ir.ts   (legacy yol; cutover yok)
apps/web/**                          (dokunulmadı)
Prisma schema/migration              (yeni contract persisted read modeli gerektirmedi)
/Users/gokhanoncu/.../NesyMobile/    (Mobile repo: yazılmadı — §10.2)
```

## 7. Verification results

Tüm komutlar `2026-08-05 13:38–13:45 +03` arasında çalıştırıldı.

```bash
pnpm verdict:verify-master-plan
# Master plan digest OK: sha256:76024d898cb152fe4d885fb18e798cb24b6c3df31715eac546c64383ed5c2bd0

pnpm typecheck
# Tasks: 16 successful, 16 total   (exit 0)

pnpm test
# @nesy/workflow-contract          79 passed (79)
# @nesy/control-channels           36 passed (36)
# @nesy/web                       134 passed (134)
# @nesy/bridge-client              35 passed (35)
# @nesy/bridge-contract            50 passed (50)
# @nesy/api                       267 passed | 38 skipped (305)
# @nesy/domain-pack-contracts     124 passed (124)
# @nesy/nesy-courier-domain-pack   83 passed (83)
# Tasks: 17 successful, 17 total   (exit 0)

pnpm --filter @nesy/domain-pack-contracts typecheck    # exit 0
pnpm --filter @nesy/domain-pack-contracts test         # 124 passed (124)
pnpm --filter @nesy/domain-pack-contracts lint         # 0 error, 0 warning
pnpm --filter @nesy/domain-pack-contracts build        # exit 0

pnpm --filter @nesy/nesy-courier-domain-pack typecheck # exit 0
pnpm --filter @nesy/nesy-courier-domain-pack test      # 83 passed (83), 2 test file
pnpm --filter @nesy/nesy-courier-domain-pack lint      # 0 error, 0 warning
pnpm --filter @nesy/nesy-courier-domain-pack build     # exit 0

git diff --check           # clean
git diff --cached --check  # clean
git status --short --branch
# ## production...origin/production
# 66 A + 2 M (pnpm-lock.yaml, pnpm-workspace.yaml)
```

Baseline karşılaştırması: mevcut hiçbir test değişmedi (workflow-contract 79,
web 134, api 267/38, bridge-contract 50, bridge-client 35, control-channels 36 —
Phase 4A sayılarıyla birebir aynı). Toplam **+207 yeni test**; hiçbir test
gevşetilmedi, `.skip`/`.only` eklenmedi.

### 7.1 Leakage taramaları (4B.19)

```bash
rg -n "OPEN_STOP|COURIER_LOGIN|SELECT_ROUTE|PROCESS_PARCEL|COMPLETE_DELIVERY|TOUR_APPROVAL|APPROVE_TOUR|STOP|PARCEL|SHIPMENT|DELIVERY|COURIER|ROUTE|MATCH|BETTING" \
  packages/workflow-contract/src packages/bridge-contract/src packages/bridge-client/src
```

Sonuç: **business type/command leakage YOK.** Bulunan hit'lerin tamamı üç
kategoriden:

1. `packages/workflow-contract/src/domain-leakage.ts` — guard'ın kendi yasak
   kelime listesi (`FORBIDDEN_DOMAIN_TOKENS`, `FORBIDDEN_DOMAIN_WORDS`).
2. `*_MISMATCH` identifier'ları (`PROTOCOL_VERSION_MISMATCH`,
   `ENTITY_MISMATCH`, `OPERAND_PATH_MISMATCH`, `EXPECTED_MATCH` …). Phase 4A'nın
   guard precision testi bunları bilinçli olarak temiz sayıyor: `MATCH` segment
   bazlı eşleşir, `MISMATCH` tek segmenttir.
3. Doc yorumlarındaki yasak açıklamaları.

```bash
rg -n "RunManifest|TestExecution|Lease|ResourceLease|SchedulerDisposition|WorkerHeartbeat|ExecutionLifecycle|ImpactGraph" \
  packages/domain-pack-contracts/src
```

Sonuç: **forbidden execution/scheduler type YOK.** Hit'ler yalnız
`FORBIDDEN_EXECUTION_TYPE_NAMES` listesi, dosya başlığı yorumları ve guard
testleri. `DomainImpactRef` / `ResourceRequirementRef` bilinçli olarak **ref**'tir
— pack coverage'a bir graph gömmeden işaret edebilsin diye.

Ayrıca programatik guard: `scanExportSurfaceForExecutionTypes` 11 modülün export
surface'ini tarıyor → 0 hit (test-bound, sadece scan değil).

### 7.2 Yasak pattern taraması

`packages/domain-pack-contracts/src/` ve `domain-packs/nesy-courier/src/`:
`as any`, `@ts-ignore`, `@ts-expect-error`, `.skip(`, `.only(`, `eval(`,
`new Function` → 0 gerçek kullanım. `as any`, `@ts-ignore`, `@ts-expect-error`,
`.skip(`, `.only(` için tek eşleşme yok. `eval(` / `new Function` yalnız 5 yerde
metin olarak geçiyor: `manifest.ts` başlık yorumundaki yasak açıklaması ve
testlerin negatif payload string'leri (`"eval('x')"`,
`"new Function('return 1')"`). Executable kullanım yok.

## 8. Acceptance checklist

| # | Acceptance | Status | Evidence |
|---|---|---|---|
| 1 | Phase 4A RESULT `COMPLETED` doğrulandı | `PASS` | `docs/verdict/run-playbooks/phase-4a/RESULT.md` → `resultState: COMPLETED`, `phase4BReadiness: READY_WITH_EXTERNAL_BLOCKERS` |
| 2 | Master plan digest doğrulandı | `PASS` | `pnpm verdict:verify-master-plan` → `sha256:76024d89…5c2bd0`, RUN_PLAY frontmatter ile aynı |
| 3 | `packages/domain-pack-contracts` package'i var | `PASS` | 17 dosya; `pnpm --filter @nesy/domain-pack-contracts typecheck/test/lint/build` hepsi yeşil |
| 4 | Domain Pack manifest/version/app compatibility contract var | `PASS` | `manifest.ts` + `application.ts`; `MISSING_APP_COMPATIBILITY` (eksik/ters versiyon penceresi, eksik adapter compat), `PUBLISHED_WITHOUT_PROVENANCE`, `THIRD_PARTY_RELEASE_GATE` testleri |
| 5 | Screen Registry formal contract var | `PASS` | `ScreenDefinition` + 6 `ScreenRuntimeImplementation` kind + `ScreenEntryStrategy.provesUserPath` + `ReadinessContract`; entry-strategy'siz screen `MISSING_FIELD` |
| 6 | Surface Registry ayrı formal contract var | `PASS` | `SurfaceDefinition` 6 kind + 4 policy + `priority`; `DIALOG_DECLARED_AS_SCREEN` ve `SURFACE_PARENT_INCOMPATIBLE` testleri; `compareSurfacePriority` aynı-priority tie-break'i input sırasından bağımsız |
| 7 | Entity Registry formal contract var | `PASS` | `EntityDefinition` zorunlu `businessKeyPath` + correlation/freshness/redaction; Nesy tarafında 7 entity, testte hepsinin business key'i doğrulanıyor |
| 8 | Target Resolution Provider Chain contract var | `PASS` | `TargetResolutionPolicy.chain` 6 strategy; `nesy.target.stop-row` = ACCESSIBILITY_ID → ENTITY_BINDING → STRUCTURAL_FINGERPRINT → ROW_INDEX_HINT, teste bağlı |
| 9 | rowIndex primary identity olarak reddediliyor | `PASS` | `ROW_INDEX_AS_IDENTITY` + `ROW_INDEX_NOT_LAST` + `NO_IDENTITY_PROVIDER`; `invalid-row-index-primary-target.json` fixture'ı validator'dan geçirilip reddediliyor |
| 10 | Semantic Action/Macro contract ve source-map var | `PASS` | `SemanticActionDefinition`, `MacroDefinition`, `MacroExpansionSnapshot`, `DomainSourceMap`; "traces every domain source map entry to a real generic step" testi macro → step → sourceMapRef zincirini iki yönlü doğruluyor |
| 11 | Evidence Source Registry contract var | `PASS` | `EvidenceSourceDefinition` 4 plane × 9 source kind × 3 authority + `ALLOWED_SOURCE_KINDS_BY_PLANE`; plane/kind uyumsuzluğu `SOURCE_KIND_PLANE_MISMATCH` |
| 12 | Raw evidence ile normalized fact ayrımı var | `PASS` | `preservesRawEvidence` zorunlu true (`RAW_EVIDENCE_DISCARDED`), `DerivedFactDefinition.preserveInputs` zorunlu true (`DERIVED_INPUTS_NOT_PRESERVED`), `ReducerProvenance` derivation trace taşıyor |
| 13 | Derived Fact DAG cycle/self/undefined input reddediyor | `PASS` | `DERIVED_FACT_CYCLE` (DFS, iki-node cycle testi), `DERIVED_FACT_SELF_REFERENCE`, `DERIVED_FACT_UNDEFINED_INPUT`, `DERIVED_FACT_NO_INPUTS` |
| 14 | Continue Gate / Final Oracle Domain Oracle Template'te ayrı | `PASS` | `DomainOracleTemplate.continueGate` (`EvidencePolicy`) ve `.finalOracle` (`FinalOraclePolicy`) yapısal olarak ayrı alan; test gate'te `requirements`, oracle'da `unknownPolicy` olmadığını assert ediyor |
| 15 | LaunchProfile setup vs real product verdict ayrımını taşıyor | `PASS` | `SETUP_LAUNCH_PRODUCES_VERDICT` + `SETUP_LAUNCH_WITHOUT_ISOLATION` + `REAL_LOGIN_WITH_PREPARATION_OPS`; `invalid-setup-produces-verdict.json` fixture'ı reddediliyor |
| 16 | TestProfile preview/release/fault/differential policy validation var | `PASS` | `PREVIEW_PROFILE_GATES_RELEASE`, `GATING_PROFILE_SAMPLES_EVIDENCE`, `FAULT_WITHOUT_CORRELATION`, `FAULT_WITHOUT_EXPECTED_RECOVERY`, `DIFFERENTIAL_WITHOUT_BASELINE`, `DIFFERENTIAL_WITHOUT_CRITICAL_FACTS`; gating campaign'in gating profile içermesi de zorunlu |
| 17 | FeatureAuthoringMetadata ve FeatureExecutableContract digest ayrımı var | `PASS` | `computeFeatureExecutableDigest` yalnız executable half'ı alıyor; "computes the digest over the executable contract alone" testi description/tags/reviewNotes/lastEditedBy değişince digest'in **değişmediğini**, `contractVersion` değişince değiştiğini kanıtlıyor. `AUTHORING_FIELD_IN_EXECUTABLE` split'in tekrar bozulmasını engelliyor. |
| 18 | Capability catalog katmanlı | `PASS` | `CAPABILITY_LAYERS = [verdict.core, nesy, mackolik]`; `CAPABILITY_LAYER_PREFIX_MISMATCH`, `DOMAIN_CAPABILITY_CLAIMS_CORE` (promotion evidence'ı olmadan core'a terfi reddi), `UNDETECTED_RUNTIME_CAPABILITY`. Nesy pack 16 capability'yi 3 katmana dağıtıyor. |
| 19 | AI_SUGGESTED invariant release gate'e bağlanamıyor | `PASS` | `GATING_INVARIANT_AUTHORITIES = [PRODUCT_APPROVED, TECHNICAL_DEFAULT]`; `AI_INVARIANT_GATES_RELEASE`. Nesy pack'te gerçek bir AI_SUGGESTED invariant var (`queue-drains-within-five-minutes`) ve `bindsReleaseGate: false`; gate'e çevrilirse test kırmızı. |
| 20 | Reusable Flow Fragment terminal verdict üretemiyor | `PASS` | `producesTerminalVerdict: false` literal tipte + runtime `FRAGMENT_PRODUCES_VERDICT`; `FRAGMENT_HAS_FINAL_ORACLE` fragment'a oracle eklenmesini de reddediyor |
| 21 | Deterministic bundle serialization/digest var | `PASS` | `canonical.ts`; key sırası bağımsız, `undefined` düşer / `null` kalır, array sırası korunur, non-finite sayı reddedilir (`JSON.stringify(NaN)` → `null` tuzağı), digest `sha256:` prefixli. Aynı bundle iki kez → aynı digest; tek alan değişince farklı. |
| 22 | Published bundle immutable | `PASS` | `publishBundle` deep-freeze ediyor (nested registry array'leri dahil, mutasyon throw ediyor); `PUBLISHED_DIGEST_MISMATCH` yerinde düzenlenmiş published bundle'ı yakalıyor; `ActiveRunPinnedBundleRef` hot reload'da yeni versiyonu takip etmiyor (`pinnedBundleMatches` false) |
| 23 | Runtime arbitrary JS/TS execution negative test var | `PASS` | `findRuntimeCodeViolations`: 12 code-carrying field adı, 8 code-shaped regex (`eval(`, `new Function`, `require(`, `import(`, arrow/function body, `process.env`, `child_process`), function value (`NON_SERIALIZABLE_VALUE`), gevşetilmiş policy (`RUNTIME_CODE_POLICY_RELAXED`). `DerivedFactReducerKind`'da `CUSTOM` yok. |
| 24 | `packages/domain-pack-contracts` execution/scheduler type leakage göstermiyor | `PASS` | §7.1 rg taraması + `scanExportSurfaceForExecutionTypes` ile 11 modülün export surface'i taranıyor → 0 hit. Bundle field taraması da var: `resourceLease`/`schedulerDisposition`/`workerHeartbeat`/`runManifest`/`dependencyExecutionState` alanı `EXECUTION_PLANE_LEAKAGE` üretiyor, `impactRefs` üretmiyor. |
| 25 | Core/Bridge business command/type leakage göstermiyor | `PASS` | §7.1; Core/Bridge paketlerine hiç dokunulmadı, tarama yalnız guard listesi + `*_MISMATCH` + doc yorumu döndürüyor |
| 26 | `domain-packs/nesy-courier` package'i var | `PASS` | 39 dosya; `pnpm-workspace.yaml`'a `domain-packs/*` eklendi; typecheck/test/lint/build yeşil |
| 27 | Nesy application/screen/surface/entity/target registries var | `PASS` | 1 / 7 / 8 / 7 / 10; sayılar "matches the registry counts published in the reference document" testine bağlı |
| 28 | Nesy evidence source definitions var | `PASS` | 35 source (UI 16 / APP 10 / LOCAL 4 / REMOTE 5) + 4 derived fact; RUN_PLAY §8.2'nin 12 minimum fact'inin hepsi mevcut (test-bound) |
| 29 | Nesy launch/test profile definitions var | `PASS` | 4 launch profile (`cold-real-login`, `prepared-session`, `direct-state`, `reuse-session`) + 4 test profile (`release-core`, `preview-smoke`, `bad-day`, `differential-baseline`) + 1 campaign |
| 30 | Nesy App Adapter contract/ref mapping var | `PASS` | `nesy.availableStops`, `nesy.stopState`, `nesy.taskState`, `nesy.parcelState`, `nesy.pendingOperation`, `nesy.sessionState`, `nesy.routeState`; scanner real/injected/manual-entry; prepared session + direct state capability; `nesy.backoffice` approve-tour operasyonları |
| 31 | `NESY_COURIER_DOMAIN_PACK_REFERENCE_V1` artifact var | `PASS` | `src/reference.ts` + 348 satır doküman + 10 fixture; `referenceArtifactDigest()` deterministik |
| 32 | Altı vertical slice artifact içinde mevcut | `PASS` | `slices.map(s => s.sliceKey)` === `[COURIER_LOGIN, SELECT_ROUTE, OPEN_STOP, PROCESS_PARCEL, COMPLETE_DELIVERY, TOUR_APPROVAL_LIFECYCLE]`; 18 zorunlu alanın hepsi dolu (test-bound) |
| 33 | `OPEN_STOP` canonical expansion/spec uyumu test-bound | `PASS` | 7 test: typed STOP entity input; `nesy.availableStops` varlık kontrolü tap'ten **önce**; yoksa ANNOTATE + `next: null` (dokunmadan fail); `nesy.target.stop-row` provider chain; `WAIT_ANY` TASK_LIST **veya** DELIVERY (+ B-13 `optional`/`SEQUENTIAL_LEGS`); `APP.ACTIVE_STOP_MATCHES` REQUIRED/IMMEDIATE/FAIL; ambiguous target `FAIL` (union'da `FIRST_MATCH` yok) |
| 34 | `COURIER_LOGIN` setup/login ayrımı test-bound | `PASS` | 4 test: Final Oracle üç plane istiyor; `APP.LOGIN_SUCCEEDED` = `CORRELATED_ALL_OF(REMOTE.AUTH_ACCEPTED, APP+LOCAL session)`; session-expired dialog `fatalSurfaceRefs`'te (HANDLE değil); slice `cold-real-login` altında ve o tek verdict-bearing profil |
| 35 | `TOUR_APPROVAL_LIFECYCLE` multi-actor/remote/idempotency/reconciliation contract taşıyor | `PASS` | 6 test: kurye Bridge'de + dispatcher `actorRole: DISPATCHER` adapter'da; iki ayrı backend fact read (`read-tour-approval-request`, `read-tour-approval-status`); approve `role: SETUP` + `outputFactBindings: []` + `KEYED` + `RECONCILE_BEFORE_RELEASE` + `recordRequest`; `REMOTE.TOUR_APPROVAL_CONFIRMED` = 3 fact'in `CORRELATED_ALL_OF`'u; push `CONFIRMATORY`/`WARNING`; setup modu (`direct-state`) verdict üretemiyor |
| 36 | HTTP 2xx business success sayılmıyor | `PASS` | `transportSuccessOnly` → `TRANSPORT_SUCCESS_AS_BUSINESS_FACT` + `TRANSPORT_SUCCESS_PRIMARY`; adapter tarafında `TRANSPORT_SUCCESS_AS_VALIDATION` + `BUSINESS_FACT_WITHOUT_ENTITY_STATUS` (VALIDATION output'u hem entityStatusPath hem correlationPath ister); `invalid-http-2xx-business-success.json` fixture'ı reddediliyor |
| 37 | Queue ayrı evidence plane değil, LOCAL evidence türü | `PASS` | `EVIDENCE_PLANES` 4 üyeli kapalı union; `FORBIDDEN_EVIDENCE_PLANES` içinde `QUEUE` ve `APP_STATE`; `ALLOWED_SOURCE_KINDS_BY_PLANE.LOCAL` içinde `OFFLINE_QUEUE_WATCH`, UI'da değil; Nesy pack'te queue source'ları LOCAL (test-bound) |
| 38 | Scanner/DIRECT_STATE release isolation validation var | `PASS` | Mutating adapter capability zorunlu `automationOnly` + isimli `releaseGuard` (`ADAPTER_SEAM_NOT_ISOLATED`); PROCESS_PARCEL slice'ı `APP.SESSION_ISOLATION_ASSERTED`'ı REQUIRED oracle olarak taşıyor; setup launch profile'ları `automationOnly: true` (aksi hâlde `SETUP_LAUNCH_WITHOUT_ISOLATION`) |
| 39 | Domain macro'ları generic IR v2 dışına çıkmıyor | `PASS` | Altı snapshot `validateWorkflowIrV2` ile 0 issue; "never expands into a step kind outside the generic union" testi 14 üyeli allowlist'e karşı kontrol ediyor; `EXPANSION_NOT_GENERIC_IR` v2 dışı schema'yı reddediyor; her slice farklı deterministik `hashWorkflowIrV2` |
| 40 | Phase 4C compiler production implementation başlamadı | `PASS` | Her snapshot `authoredBy: "HAND"` (test-bound). `ir-authoring.ts` yalnız boilerplate dolduruyor, expansion logic yok. Export surface testi `compile*` / `expandMacro*` / `BridgeFlowCompiler` isimli export olmadığını assert ediyor. |

**40/40 PASS.**

## 9. Blockers

Başlangıçta yeni Phase 4B blocker yok.

| ID | Severity | Description | Status | Owner | Resolution |
|---|---|---|---|---|---|
| — | — | — | — | — | — |

## 10. Skipped / deferred work

Bu işler Phase 4B sonucunu bloklamaz; ilgili fazlara devredilecektir:

| Work | Target phase | Reason |
|---|---|---|
| BridgeFlowCompiler production implementation | Phase 4C | Domain Pack contract ve reference snapshots önce dondurulmalı. |
| BridgeFlowExecutor / Run Queue / Test Data Broker runtime | Phase 5 | Execution plane Phase 4B contract scope'u değildir. |
| Cockpit Domain Pack Manager UI | Phase 6 | API/contract olmadan UI premature olur. |
| Maestro removal / live cutover | Phase 9 | BridgeFlow runtime ve UI cutover tamamlanmadan yapılamaz. |
| Maçkolik production Domain Pack | Later CP6/CP7+ | Phase 4B Nesy reference ve shared Domain Pack modelini hazırlar; Maçkolik reference hazırlıkları future scope. |

## 11. Notes for Phase 4C

Phase 4B kapanınca Phase 4C şu input'ları tüketmelidir:

```text
DomainPackManifest
Application/Screen/Surface/Entity/Target Registry
SemanticAction/Macro definitions
EvidenceSourceRegistry
LaunchProfile/TestProfile definitions
NESY_COURIER_DOMAIN_PACK_REFERENCE_V1 snapshots
Bundle digest/provenance
App Adapter compatibility contract
```

Phase 4C'nin işi:

```text
Domain Macro → Generic WorkflowIR v2
Generic WorkflowIR v2 → BridgeFlowPlan + UiWaitPlan
Compile API + preview + capability-aware errors
```

Phase 4B bu compiler'ı production seviyesinde yazmamalıdır.

## 12. Phase 4C readiness decision

Başlangıç kararı:

```text
phase4CReadiness: NOT_EVALUATED
```

Beklenen kapanış:

```text
phase4CReadiness: READY_WITH_EXTERNAL_BLOCKERS
```

Bu karar ancak CP4B-Core acceptance maddeleri kanıtla geçerse verilebilir.

## 13. Post-review completion fixes

Root review sırasında kalan iki process tutarsızlığı kapatıldı:

1. `RUN_PLAY.md` hâlâ `READY_TO_START` / `PENDING` durumundaydı. Frontmatter,
   recovery state, step tablosu ve 40 maddelik acceptance checklist `COMPLETED` /
   `PASS` haline getirildi.
2. Changed-files özeti gerçek git durumuyla eşitlendi: final staged durum
   68 dosyadır; 66 yeni dosya ve `pnpm-lock.yaml` + `pnpm-workspace.yaml` olmak
   üzere 2 modifiye dosya.
3. `parseDomainPackBundle` "safe parse never throws" sözleşmesine rağmen malformed
   nested JSON'da throw edebiliyordu (`{ manifest: {}, registries: {} }` gibi).
   `validateBundleShape` structural guard'ı eklendi; manifest/registry array'leri,
   `derivedFacts.facts` ve `runtimeCodePolicy` yoksa artık throw yerine
   `MISSING_FIELD` issue döner. Regresyon testi eklendi; contract test sayısı
   123'ten 124'e çıktı.

Review sonrası tekrar doğrulanan komutlar:

```bash
pnpm verdict:verify-master-plan   # PASS
pnpm typecheck                    # 16/16 task PASS
pnpm test                         # 17/17 task PASS
pnpm --filter @nesy/domain-pack-contracts test # 124 passed
git diff --check                  # clean
git diff --cached --check         # clean
```
