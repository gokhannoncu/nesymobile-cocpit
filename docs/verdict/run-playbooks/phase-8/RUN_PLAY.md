# Phase 8 RUN_PLAY — Cockpit Maestro Direct Removal

```yaml
runPlayId: verdict-cockpit-phase-8-run-play
phase: "8"
phaseName: "BridgeFlow-Only Cockpit + Maestro Complete Removal"
status: IN_PROGRESS
recoveryState: PHASE_8_DIRECT_REMOVAL
createdAt: "2026-08-05 14:49:14 +03"
startedAt: "2026-08-09 18:14:00 +03"
completedAt: null
lastUpdatedAt: "2026-08-09 18:14:00 +03"
timezone: "Europe/Istanbul"
masterPlanPath: "docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md"
masterPlanVersion: "v1.1.4"
masterPlanDigest: "sha256:b2af8c455dc9a74495bd937112756a6f4c5aaf3f0a5ee292d95294e564c687ef"
verifyMasterPlanCommand: "pnpm verdict:verify-master-plan"
previousPhaseResult: "docs/verdict/run-playbooks/phase-7/RESULT.md"
resultFile: "docs/verdict/run-playbooks/phase-8/RESULT.md"
phase7StatusRequired: "COMPLETED"
phase7ReadinessRequired: "READY_WITH_EXTERNAL_BLOCKERS"
phase8Target: "CHECKPOINT_8_MAESTRO_ZERO_STRUCTURE"
phase9ReadinessTarget: "READY_FOR_PRODUCTION_OPS"
maestroRemovalPolicy: "DIRECT_REMOVE_NO_DUAL_RUN_NO_BENCHMARK"
blockingPreflight:
  - id: "PHASE_7_NOT_COMPLETE"
    status: "RESOLVED"
    meaning: "Phase 7 COMPLETED + phase8Readiness READY_WITH_EXTERNAL_BLOCKERS doğrulandı."
  - id: "BRIDGEFLOW_EXECUTION_REQUIRED"
    status: "BLOCKING"
    meaning: "Maestro runner silinmeden önce Verdict runtime start gerçek BridgeFlow executor/queue yoluna bağlı olmalıdır."
  - id: "REAL_DUT_REQUIRED"
    status: "OPEN_EXTERNAL_FOR_FULL_PHYSICAL_PASS"
    meaning: "Physical B1 kabulü için gerçek DUT/lab device gerekir; yoksa fiziksel kabul maddeleri BLOCKED_EXTERNAL kalır."
  - id: "CP3-DUT"
    status: "OPEN_EXTERNAL"
    meaning: "Lab/userdebug DUT kabulü ayrıca kapanmalıdır."
  - id: "B-12"
    status: "OPEN_EXTERNAL"
    meaning: "Production cihaz smoke handshake flakiness Bridge/device kabulünü etkileyebilir."
```

## 1. Şu an hangi kısımdayız?

Phase 8 artık ölçüm/cutover kararı fazı değildir. Bu fazın hedefi Cockpit içinde
Maestro/YAML tabanlı aktif yürütme yüzeyini kaldırmak ve BridgeFlow/Verdict runtime
yolunu tek yürütme yolu yapmaktır.

```text
Phase 7: Nesy real workflows + Test Profile catalog COMPLETED
Phase 8: Cockpit Maestro direct removal + BridgeFlow-only execution IN_PROGRESS
Next after 8: Phase 9 production operations, soak and hardening
```

Bu fazda yapılmayacaklar:

```text
Maestro vs BridgeFlow benchmark yoktur.
Golden dual-run/parity harness yoktur.
Başarısız BridgeFlow run için sessiz Maestro fallback yoktur.
Cutover GO/NO_GO karar raporu yoktur.
```

## 1.1 AI agent'a verilecek başlangıç metni

```text
Verdict Cockpit Phase 8'i uygula.

Önce şu dosyaları oku:
- docs/verdict/run-playbooks/phase-8/RUN_PLAY.md
- docs/verdict/run-playbooks/phase-8/RESULT.md
- docs/verdict/run-playbooks/phase-7/RESULT.md
- docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md

Phase 7 gate'i:
- resultState: COMPLETED
- phase8Readiness: READY_WITH_EXTERNAL_BLOCKERS

Phase 8 hedefi:
Cockpit içinde Maestro executor, driver hazırlığı, YAML compiler/preview/download,
Maestro CLI/env/config/dependency, legacy DTO/read-model, Prisma alanı, UI kopyası,
test fixture ve aktif doküman referanslarını kaldır. BridgeFlow/Verdict runtime
tek yürütme yolu olmalıdır.

Kesin yasaklar:
- Maestro ile karşılaştırma, benchmark veya golden dual-run ekleme.
- Maestro fallback bırakma.
- Disabled ama çalıştırılabilir Maestro path'i bırakma.
- `MAESTRO_PATH`, `MAESTRO_HOME`, `~/.maestro/bin` bağımlılığı bırakma.
- `/api/workflows/*` legacy run yolunun Maestro çalıştırmasına izin verme.
- YAML preview/download/import yüzeyi bırakma.
- Eski run verisi için Maestro'ya özel renderer bırakma.
- Plan dışı Mobile repo değişikliği yapma.

Kapanışta RESULT.md içinde:
- `maestroRemovalStatus`
- `bridgeflowExecutionStatus`
- `residualMaestroScan`
- changed files
- verification commands
- blockers
- Phase 9 readiness
alanlarını kanıtla doldur.
```

## 2. Owned paths

```text
docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md
docs/verdict/run-playbooks/phase-7/**
docs/verdict/run-playbooks/phase-8/**
docs/verdict/run-playbooks/phase-9/**
docs/verdict/COCKPIT_SDK_BRIDGE_COMPAT_PLAN.md
docs/verdict/CONDITION_ENGINE_AND_BRIDGEFLOW.md
apps/api/src/**
apps/web/src/**
packages/db/prisma/**
packages/execution-contract/**
packages/bridgeflow-executor/**
packages/bridgeflow-compiler/**
packages/workflow-contract/**
domain-packs/nesy-courier/**
package.json
```

Mobile repo değişikliği bu fazın varsayılan kapsamı değildir.

## 3. Step plan

| Step | Status | Açıklama | Output |
|---|---|---|---|
| 8.1 Phase 7 gate doğrulama | `DONE` | Phase 7 `COMPLETED` + `READY_WITH_EXTERNAL_BLOCKERS`. | Gate açık |
| 8.2 Master plan realignment | `IN_PROGRESS` | Phase 8 direct removal, Phase 9 ops. | v1.1.4 |
| 8.3 BridgeFlow execution wiring | `PENDING` | Verdict runtime start gerçek executor/queue yoluna bağlanır. | BridgeFlow-only start |
| 8.4 API Maestro runner removal | `PENDING` | executor, YAML generator, DeviceWorker driver prep ve legacy routes temizlenir. | No runnable API Maestro |
| 8.5 DB/read-model migration | `PENDING` | Maestro/YAML fields neutral archive sonrası kaldırılır. | Neutral runtime DTO |
| 8.6 Web YAML/Maestro UI removal | `PENDING` | preview, import, legacy run view ve copy kaldırılır. | BridgeFlow-only UI |
| 8.7 Residual guard tests | `PENDING` | Active tree scan + targeted tests. | Zero runnable Maestro guard |
| 8.8 Verification + RESULT closure | `PENDING` | Typecheck/test/digest/diff gates. | CHECKPOINT 8 evidence |

## 4. Acceptance checklist

Phase 8 kapanmadan aşağıdaki maddeler `PASS`, `FAIL`, `BLOCKED_EXTERNAL` veya
`DEFERRED_WITH_REASON` olarak RESULT.md'ye işlenmelidir.

1. Phase 7 output'ları doğrulandı.
2. Master plan Phase 8/9 ayrımı yeni karara göre hizalandı.
3. Cockpit Phase 9 playbook'u post-removal ops olarak oluşturuldu.
4. `POST /api/verdict/runtime/runs` gerçek BridgeFlow execution yoluna bağlı.
5. `BridgeFlowExecutor` production queue/worker tarafından çağrılıyor.
6. Legacy `/api/workflows/*` run path Maestro çalıştırmıyor.
7. `maestro-executor` aktif source'dan kaldırıldı.
8. `yaml-generator` aktif source'dan kaldırıldı veya non-runnable archive dışına alındı.
9. DeviceWorker Maestro driver/JAR/APK hazırlığı yapmıyor.
10. `RunStore` Maestro process type veya kill path taşımıyor.
11. Field Courier Login hidden Maestro orchestrator path'i kaldırıldı.
12. YAML preview/download/import endpoint'leri kaldırıldı veya hard-closed.
13. Web editor `Run test` Verdict compile/start yolunu kullanıyor.
14. YAML preview modal/card/panel isimleri ve emitters kaldırıldı.
15. Live node properties schema YAML registry'den ayrıldı.
16. Run Detail legacy Maestro branch'i kaldırıldı.
17. `MAESTRO_LEGACY` aktif DTO behavior'ı yok.
18. Prisma Maestro/YAML field'ları neutral archive/migration sonrası kaldırıldı.
19. Eski run verisi Maestro-specific renderer gerektirmiyor.
20. Active source residual scan runnable Maestro/YAML yüzeyi bulmuyor.
21. Test suite Maestro CLI kurulu olmadan çalışabiliyor.
22. Gerçek DUT fiziksel kabul maddeleri kanıtlandı veya açık external blocker yazıldı.

## 5. Verification commands

Minimum verification:

```bash
pnpm verdict:verify-master-plan
pnpm --filter @nesy/api typecheck
pnpm --filter @nesy/api test
pnpm --filter @nesy/web typecheck
pnpm --filter @nesy/web test
pnpm --filter @nesy/db generate
pnpm typecheck
pnpm test
git diff --check
git diff --cached --check
```

Residual scan komutları RESULT.md'ye gerçek çıktılarıyla yazılmalıdır. Docs içindeki
tarihsel açıklamalar residual fail sayılmaz; aktif source, route, script, package,
schema ve UI yüzeyleri fail sayılır.

## 6. Phase 9 handoff expectation

Başarılı kapanış:

```text
Phase 8: COMPLETED
CHECKPOINT 8: PASSED_WITH_EXTERNAL_BLOCKERS
maestroRemovalStatus: COMPLETED
bridgeflowExecutionStatus: BRIDGEFLOW_ONLY
residualMaestroScan: PASS
Phase 9 readiness: READY_FOR_PRODUCTION_OPS
```

Phase 9 artık Maestro silme fazı değildir. Phase 9 kapsamı soak, multi-device
operasyon, security/durability hardening, v1 parser sunset, runbook ve release
operasyonudur.
