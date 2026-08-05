# Phase 6 RESULT — Cockpit UI, Route Cutover, Live Inspector and Run Detail

```yaml
runPlayId: verdict-cockpit-phase-6-run-play
phase: "6"
phaseName: "Cockpit UI + PageMigrationManifest + Live Inspector + Run Detail + Test Profile/Campaign UI"
resultState: NOT_STARTED
createdAt: "2026-08-05 14:39:38 +03"
startedAt: null
completedAt: null
lastUpdatedAt: "2026-08-05 14:39:38 +03"
timezone: "Europe/Istanbul"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:76024d898cb152fe4d885fb18e798cb24b6c3df31715eac546c64383ed5c2bd0"
runPlayFile: "docs/verdict/run-playbooks/phase-6/RUN_PLAY.md"
previousPhaseResult: "docs/verdict/run-playbooks/phase-5/RESULT.md"
targetWorkspace: "apps/web"
targetApiSurface: "Phase 5 runtime/read-model DTOs"
phase7Readiness: "NOT_EVALUATED"
```

## 1. Executive result

Phase 6 henüz başlamadı.

Bu dosya Phase 6 agent'ı tarafından çalışma başladığında `IN_PROGRESS`, kapanışta
ise `COMPLETED`, `READY_WITH_BLOCKERS`, `BLOCKED_PRECONDITION`,
`BLOCKED_EXTERNAL` veya `FAILED` olarak güncellenecektir.

Beklenen hedef:

```text
CHECKPOINT 6: Cockpit UI + Route Cutover + Live Inspector + Run Detail
Runtime/API source: Phase 5'ten tüketilecek
Cockpit UI: YAZILACAK/DÖNÜŞTÜRÜLECEK
Maestro cutover/removal: YAPILMAYACAK
Nesy real DUT workflow acceptance: Phase 7'ye bırakılacak
```

## 2. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `6` |
| Current step | `6.0` |
| Current state | `WAITING_FOR_PHASE_5_COMPLETION` |
| Last successful step | `5.0` |
| Last attempted step | `6.0` |
| Last update | `2026-08-05 14:39:38 +03` |
| Recovery instruction | `Phase 6 başlamadı. Önce Phase 5 RESULT içinde resultState COMPLETED ve phase6Readiness READY_WITH_EXTERNAL_BLOCKERS doğrulanmalı. Gate yoksa BLOCKED_PRECONDITION yaz ve dur.` |

## 3. Precondition gate

Phase 6 implementation başlamadan önce:

| Gate | Required | Current evidence |
|---|---|---|
| Phase 5 result state | `COMPLETED` | `PENDING` |
| Phase 5 readiness | `READY_WITH_EXTERNAL_BLOCKERS` | `PENDING` |
| WorkflowCompileApi | available | `PENDING` |
| WorkflowRunApi | available | `PENDING` |
| RunHistoryQuery | available | `PENDING` |
| RunDetailQuery | available | `PENDING` |
| EvidenceJourneyQuery | available | `PENDING` |
| DeviceReadinessQuery | available | `PENDING` |
| DomainPackAdminApi | available | `PENDING` |
| TestProfile/TestCampaign APIs | available | `PENDING` |

Başlangıç kararı:

```text
implementationStart: BLOCKED_UNTIL_PHASE_5_COMPLETES
```

## 4. Inherited blockers / constraints

| ID | Severity | Description | Owner | Status | Phase 6 etkisi |
|---|---|---|---|---|---|
| PHASE_5_NOT_COMPLETE | HIGH | Phase 6, Phase 5 runtime/read-model DTO'larına bağlıdır. | Runtime owner | `BLOCKING` | Phase 5 tamamlanmadan UI implementation başlamaz. |
| CP3-DUT | HIGH/EXTERNAL | Real DUT mutation acceptance için userdebug/eng lab cihaz gerekiyor. | Device/Mobile owner | `OPEN_EXTERNAL` | UI read/blocked state kurulabilir; production Act/release acceptance external kalır. |
| B-12 | MEDIUM | Production cihazda arka arkaya smoke handshake flaky. | Mobile owner | `OPEN` | Device Lab'de blocker/remediation olarak gösterilmeli. |
| B-8 | MEDIUM | Repo-wide lint ESLint v9 flat-config borcu. | Platform owner | `OPEN_NON_BLOCKING` | Touched web/API tests yeşil olmalı; repo-wide debt ayrı kalabilir. |

## 5. Step execution log

| Step | Status | Evidence |
|---|---|---|
| 6.0 Playbook oluşturma | `DONE` | `RUN_PLAY.md` + `RESULT.md` |
| 6.1 Phase 5 gate doğrulama | `PENDING` | — |
| 6.2 Preflight baseline | `PENDING` | — |
| 6.3 PageMigrationManifest | `PENDING` | — |
| 6.4 Navigation/yedi workspace | `PENDING` | — |
| 6.5 Data-source contract adapters | `PENDING` | — |
| 6.6 Domain Pack catalog | `PENDING` | — |
| 6.7 Domain Pack detail manager | `PENDING` | — |
| 6.8 Automation Editor cutover | `PENDING` | — |
| 6.9 Plan preview/provenance | `PENDING` | — |
| 6.10 Launch Profile Builder | `PENDING` | — |
| 6.11 Evidence Source UI | `PENDING` | — |
| 6.12 Target Resolution UI | `PENDING` | — |
| 6.13 Live Inspector | `PENDING` | — |
| 6.14 Device Lab readiness | `PENDING` | — |
| 6.15 Run Detail 6A | `PENDING` | — |
| 6.16 Run Detail 6B | `PENDING` | — |
| 6.17 Run Detail 6C | `PENDING` | — |
| 6.18 Interaction origin UI | `PENDING` | — |
| 6.19 Test Profile catalog/detail | `PENDING` | — |
| 6.20 Test Profile Builder | `PENDING` | — |
| 6.21 Test Campaign list/detail | `PENDING` | — |
| 6.22 Campaign matrix | `PENDING` | — |
| 6.23 Debug View cutover | `PENDING` | — |
| 6.24 Automation legacy routes | `PENDING` | — |
| 6.25 Engineering pages | `PENDING` | — |
| 6.26 Non-regression suite | `PENDING` | — |
| 6.27 Page acceptance tests | `PENDING` | — |
| 6.28 Legacy-zero tests | `PENDING` | — |
| 6.29 Verification | `PENDING` | — |
| 6.30 RESULT closure | `PENDING` | — |

## 6. Baseline inventory

Bu bölüm çalışma başladığında doldurulacaktır.

| Soru | Bulgu |
|---|---|
| Phase 5 RESULT durumu | `PENDING` |
| Phase 5 readiness | `PENDING` |
| Master digest | `PENDING` |
| Current branch/status | `PENDING` |
| Existing workspace/nav structure | `PENDING` |
| Existing automation routes | `PENDING` |
| Existing debug-view routes | `PENDING` |
| Existing Run Detail source | `PENDING` |
| Existing YAML/Maestro UI surface | `PENDING` |
| Existing Domain Pack/Test Profile/Campaign routes | `PENDING` |
| Existing page tests | `PENDING` |
| Typecheck baseline | `PENDING` |
| Test baseline | `PENDING` |

## 7. Changed files

Bu bölüm kapanışta doldurulacaktır.

| Path | Değişim | Neden |
|---|---|---|
| `docs/verdict/run-playbooks/phase-6/RUN_PLAY.md` | NEW | Phase 6 playbook |
| `docs/verdict/run-playbooks/phase-6/RESULT.md` | NEW | Phase 6 result tracker |

## 8. Verification results

Bu bölüm kapanışta gerçek komut çıktılarıyla doldurulacaktır.

Beklenen minimum komut seti:

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

Gerçek komutlar agent tarafından güncellenecektir.

## 9. CHECKPOINT 6 acceptance checklist

| # | Acceptance | Status | Evidence |
|---|---|---|---|
| 1 | Phase 5 output'ları doğrulandı. | `PENDING` | — |
| 2 | Operatör Maestro/YAML bilmeden workflow oluşturabiliyor. | `PENDING` | — |
| 3 | Preview ile executed plan hash'i aynı. | `PENDING` | — |
| 4 | Compile error doğru canvas node'una bağlanıyor. | `PENDING` | — |
| 5 | YAML/Maestro primary authoring UI deprecate edildi. | `PENDING` | — |
| 6 | Web local compiler fallback yok. | `PENDING` | — |
| 7 | Top-level workspace sayısı yedi. | `PENDING` | — |
| 8 | Domain Packs nav entry mevcut. | `PENDING` | — |
| 9 | Test Profiles nav entry mevcut. | `PENDING` | — |
| 10 | Test Campaigns nav entry mevcut. | `PENDING` | — |
| 11 | `/pm/root-cause` orphan değil. | `PENDING` | — |
| 12 | `/engineering/current-architecture` hedef/geçiş mimarisini gösteriyor. | `PENDING` | — |
| 13 | `/engineering/modernization-plan` checkpoint/evidence dashboard. | `PENDING` | — |
| 14 | PageMigrationManifest bütün production route'ları kapsıyor. | `PENDING` | — |
| 15 | Domain Pack catalog route navigation/direct/refresh ile açılıyor. | `PENDING` | — |
| 16 | Domain Pack detail manager tabs çalışıyor. | `PENDING` | — |
| 17 | Domain Pack publish/migrate RBAC fail-closed. | `PENDING` | — |
| 18 | Published bundle/graph/reducer/profile digest görünür. | `PENDING` | — |
| 19 | Active-run pinned version görünür. | `PENDING` | — |
| 20 | Application/Screen/Surface Registry manager mevcut. | `PENDING` | — |
| 21 | Surface parent-screen/kind/detection/readiness/default policy editlenebilir. | `PENDING` | — |
| 22 | Evidence Source Registry source/authority/correlation/freshness/conflict gösteriyor. | `PENDING` | — |
| 23 | Evidence Source delivery lane gösteriliyor. | `PENDING` | — |
| 24 | Target Resolution Provider Chain evidence/ambiguity gösteriyor. | `PENDING` | — |
| 25 | Launch Profile Builder process/precondition/entry/readiness/cleanup doğruluyor. | `PENDING` | — |
| 26 | Test Profile catalog/detail route'ları çalışıyor. | `PENDING` | — |
| 27 | Test Profile Builder kind-specific required alanları doğruluyor. | `PENDING` | — |
| 28 | Preview profile releaseGate=false constraint uygulanıyor. | `PENDING` | — |
| 29 | Test Campaign list/detail route'ları çalışıyor. | `PENDING` | — |
| 30 | Campaign matrix profile x device/dataset cell gösteriyor. | `PENDING` | — |
| 31 | Campaign cell gerçek run/evidence olmadan PASS/FAIL üretmiyor. | `PENDING` | — |
| 32 | Campaign cell Run Detail deep-link veriyor. | `PENDING` | — |
| 33 | Automation list WorkflowCatalogQuery target DTO'ya geçti. | `PENDING` | — |
| 34 | Automation history RunHistoryQuery target DTO'ya geçti. | `PENDING` | — |
| 35 | Automation editor WorkflowCompileApi kullanıyor. | `PENDING` | — |
| 36 | Automation run detail RunDetailQuery kullanıyor. | `PENDING` | — |
| 37 | Field Login generic WorkflowRunApi + Nesy Courier Domain Pack'e yönleniyor. | `PENDING` | — |
| 38 | Load Tour generic WorkflowRunApi + Nesy Courier Domain Pack'e yönleniyor. | `PENDING` | — |
| 39 | Legacy run yalnız LegacyRunSummaryQuery ile read-only açılıyor. | `PENDING` | — |
| 40 | Debug overview DeviceReadinessQuery ile birleşik health gösteriyor. | `PENDING` | — |
| 41 | Operational health ADB-only kaynak değil. | `PENDING` | — |
| 42 | Screen State Live Inspector rolüne genişledi. | `PENDING` | — |
| 43 | İkinci paralel Inspector route'u yok. | `PENDING` | — |
| 44 | Interactions DurableInteractionSubscription target source kullanıyor. | `PENDING` | — |
| 45 | Network Inspector/log explorer/schedule/database non-regression korunuyor. | `PENDING` | — |
| 46 | Device kartı ADB/SDK Control/SDK Event/Auth/Durable Ingest/Bridge/Backend/Local DB/Active Run ayrımı gösteriyor. | `PENDING` | — |
| 47 | Receipt Bus ve Ordered Bus health ayrı görünüyor. | `PENDING` | — |
| 48 | Command admission lane/owner/block reason görünüyor. | `PENDING` | — |
| 49 | Production Inspector Act API-side fail-closed. | `PENDING` | — |
| 50 | Inspector overlay orientation/inset coordinate testleri geçiyor. | `PENDING` | — |
| 51 | Ambiguous node UI'da açık ve action disabled. | `PENDING` | — |
| 52 | Full dump yalnız explicit diagnostic capture. | `PENDING` | — |
| 53 | Current Screen ve Active Surface ayrı registry key'leriyle aynı anda görünüyor. | `PENDING` | — |
| 54 | Expected/Interrupt wait preview lifecycle doğru; persistent registration yanılsaması yok. | `PENDING` | — |
| 55 | Run Detail occurrence/iteration/retry'yi ayırıyor. | `PENDING` | — |
| 56 | Continue Gate ve Final Oracle ayrı sunuluyor. | `PENDING` | — |
| 57 | Action/gate/oracle/cleanup outcomes ayrı sunuluyor. | `PENDING` | — |
| 58 | Lifecycle/verdict/termination/cleanup/operational disposition ayrı sunuluyor. | `PENDING` | — |
| 59 | Cleanup failure business PASS'i business FAIL'e çevirmiyor. | `PENDING` | — |
| 60 | Compact node yalnız applicable layer badge'lerini gösteriyor. | `PENDING` | — |
| 61 | Detail drawer dört plane'i explicit applicability state'leriyle gösteriyor. | `PENDING` | — |
| 62 | NOT_APPLICABLE, NOT_MEASURED ve REQUIRED_PENDING ayrı anlamlarla görünüyor. | `PENDING` | — |
| 63 | UI/App/Local/Remote badge state'i persisted revision'dan geliyor. | `PENDING` | — |
| 64 | Badge animation chronology iddiası taşımıyor. | `PENDING` | — |
| 65 | Waterfall clock uncertainty gösteriyor. | `PENDING` | — |
| 66 | Evidence Journey dokuz stage'i gösteriyor. | `PENDING` | — |
| 67 | Evidence Journey raw evidence deep-link'leri RBAC'li. | `PENDING` | — |
| 68 | Evidence Journey kanıtsız SDK/root-cause iddiası üretmiyor. | `PENDING` | — |
| 69 | Raw technical evidence → normalized fact trace görünür. | `PENDING` | — |
| 70 | Interaction origin BRIDGE_INJECTED/MANUAL/UNKNOWN gösteriliyor. | `PENDING` | — |
| 71 | Bridge-injected click manual görünmüyor. | `PENDING` | — |
| 72 | Korelasyonsuz SDK click UNKNOWN kalıyor. | `PENDING` | — |
| 73 | Human baseline automation injection ile şişmiyor. | `PENDING` | — |
| 74 | Repro export secret/PIN/token içermiyor. | `PENDING` | — |
| 75 | Repro metadata app/SDK/Bridge/workflow/device/fingerprint/action/clock/artifact kapsıyor. | `PENDING` | — |
| 76 | Yakalanmamış artifact açık NOT_CAPTURED. | `PENDING` | — |
| 77 | Repro production Act Mode'u otomatik açmıyor. | `PENDING` | — |
| 78 | Route navigation/direct-link/refresh matrix yeşil. | `PENDING` | — |
| 79 | Loading/empty/error/disconnected/blocked states test edildi. | `PENDING` | — |
| 80 | Auth/RBAC page acceptance yeşil. | `PENDING` | — |
| 81 | Responsive/keyboard/focus accessibility smoke yeşil. | `PENDING` | — |
| 82 | Legacy-zero Maestro/YAML primary UI checks yeşil. | `PENDING` | — |
| 83 | Bilinçli placeholder'lar BACKLOG olarak ayrı raporlandı. | `PENDING` | — |
| 84 | Product/PM/Engineering/Data Center/ADB route non-regression yeşil. | `PENDING` | — |
| 85 | Full verification komutları çalıştırıldı ve RESULT.md'ye yazıldı. | `PENDING` | — |

## 10. Blockers opened during Phase 6

Bu bölüm çalışma sırasında doldurulacaktır.

| ID | Severity | Status | Description | Required action |
|---|---|---|---|---|
| — | — | — | — | — |

## 11. Skipped / deferred work

| Item | Target phase | Reason |
|---|---|---|
| Maestro complete removal | Phase 9 | CP6 UI cutover, CP7 real workflows, CP8 production hardening sonrası. |
| Nesy real DUT full workflow acceptance | Phase 7 | Phase 6 UI/read model acceptance sonrası yapılır. |
| Intelligence / Failure Genome | Future | Evidence data olgunlaştıktan sonra. |
| Business/commercial validation | Separate gate | Teknik CP6 ile karıştırılmaz. |

## 12. Phase 7 readiness decision

Başlangıç kararı:

```text
phase7Readiness: NOT_EVALUATED
```

Beklenen kapanış:

```text
phase7Readiness: READY_WITH_EXTERNAL_BLOCKERS
```

Bu karar ancak CHECKPOINT 6 acceptance maddeleri kanıtla geçerse verilebilir.
