# Phase 8 RUN_PLAY — Bridge B1 Physical Acceptance and Maestro Cutover Gate

```yaml
runPlayId: verdict-cockpit-phase-8-run-play
phase: "8"
phaseName: "Bridge B1 Physical Acceptance + Golden Dual-Run + Cutover Decision Gate"
status: NOT_STARTED
recoveryState: WAITING_FOR_PHASE_7_COMPLETION
createdAt: "2026-08-05 14:49:14 +03"
startedAt: null
completedAt: null
lastUpdatedAt: "2026-08-05 14:49:14 +03"
timezone: "Europe/Istanbul"
masterPlanPath: "docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:76024d898cb152fe4d885fb18e798cb24b6c3df31715eac546c64383ed5c2bd0"
verifyMasterPlanCommand: "pnpm verdict:verify-master-plan"
previousPhaseResult: "docs/verdict/run-playbooks/phase-7/RESULT.md"
resultFile: "docs/verdict/run-playbooks/phase-8/RESULT.md"
phase7StatusRequired: "COMPLETED"
phase7ReadinessRequired: "READY_WITH_EXTERNAL_BLOCKERS"
phase8Target: "CHECKPOINT_8"
phase9ReadinessTarget: "READY_WITH_SIGNED_CUTOVER_DECISION"
blockingPreflight:
  - id: "PHASE_7_NOT_COMPLETE"
    status: "BLOCKING"
    meaning: "Phase 8, Phase 7 Nesy real workflow/Test Profile evidence çıktısına bağlıdır."
  - id: "REAL_DUT_REQUIRED"
    status: "BLOCKING_EXTERNAL_FOR_FULL_PASS"
    meaning: "Bridge physical acceptance ve golden dual-run için gerçek DUT/lab device şarttır. Yoksa CHECKPOINT 8 full PASS verilemez."
  - id: "GOLDEN_RUNNER_REQUIRED"
    status: "BLOCKING_FOR_CUTOVER_DECISION"
    meaning: "BridgeFlow correctness/false-pass/artifact completeness, Maestro/golden runner karşılaştırması olmadan cutover kararı üretilemez."
  - id: "PERFORMANCE_BUDGET_V1_REQUIRED"
    status: "BLOCKING_FOR_CUTOVER_DECISION"
    meaning: "Cihaz/build/thermal profili, percentile ve sample tanımı pinli PerformanceBudget v1 olmadan performans gate'i geçilemez."
  - id: "CP3-DUT"
    status: "OPEN_EXTERNAL"
    meaning: "CP3-DUT hâlâ açıksa Phase 8 physical acceptance gerçek cihaz maddeleri BLOCKED_EXTERNAL kalır."
  - id: "B-12"
    status: "OPEN_EXTERNAL"
    meaning: "Production cihaz smoke handshake flaky ise Bridge physical acceptance/parity koşuları etkilenir."
```

## 1. Şu an hangi kısımdayız?

Phase 8, yeni BridgeFlow yolunun fiziksel cihaz koşullarında Maestro/golden runner'a
karşı ölçüldüğü cutover gate fazıdır.

```text
Phase 7: Nesy real workflows + Test Profile catalog COMPLETE_REQUIRED
Phase 8: Bridge B1 physical acceptance + measured cutover gate READY_TO_PREPARE
Next after 8: Phase 9 Maestro complete removal and production operations
```

Bu faz Maestro'yu silmez. Bu fazın çıktısı, Maestro'nun silinip silinmeyeceği için
kanıtlı ve imzalı karar üretmektir.

```text
CHECKPOINT 8 geçmeden Maestro DELETE yoktur.
Başarısız Bridge run için sessiz Maestro fallback yoktur.
Dual-run yalnız ölçüm harness'ıdır.
```

## 1.1 AI agent'a verilecek başlangıç metni

Aşağıdaki prompt başka bir AI agent'a doğrudan verilebilir.

```text
Verdict Cockpit Phase 8'i uygula.

Önce şu dosyayı tamamen oku:
docs/verdict/run-playbooks/phase-8/RUN_PLAY.md

Sonra şu dosyayı oku:
docs/verdict/run-playbooks/phase-8/RESULT.md

Çalışmaya başlamadan önce Phase 7 gate'ini doğrula:
docs/verdict/run-playbooks/phase-7/RESULT.md

Phase 7 RESULT içinde şu iki koşul yoksa Phase 8 implementasyonuna BAŞLAMA:
- resultState: COMPLETED
- phase8Readiness: READY_WITH_EXTERNAL_BLOCKERS

Bu koşullar yoksa sadece Phase 8 RESULT.md içinde BLOCKED_PRECONDITION olarak
raporla, hangi Phase 7 real workflow/Test Profile/diagnostic/security evidence
çıktılarının eksik olduğunu yaz ve dur.

Master planda özellikle şu bölümleri oku:
- FAZ 8 — Bridge B1 Fiziksel Kabul ve Maestro Cutover Gate
- CHECKPOINT 8
- D.18 ve D.19 ölçüm/cutover karar işleri
- D.16 Diagnostics, Metrics ve Retention
- D.17 Güvenlik ve RBAC
- D.8 BridgeFlowExecutor unknown-effect/action lifecycle maddeleri
- D.12 Live Inspector physical action safeguards
- D.13 Device Lab operational readiness
- Risk matrisi: R6, R8, R9, R15, R19, R21, R22, R27, R35, R36, R38, R39, R40, R41

Phase 8'in hedefi:
BridgeFlow'un gerçek cihaz fiziksel arıza modlarında güvenli olduğunu ve golden
runner/Maestro karşısında correctness, false-pass, artifact completeness ve
performance budget açısından cutover'a hazır olup olmadığını ölç. Sonuç olarak
imzalanabilir bir cutover decision report üret.

Kesin yasaklar:
- Maestro'yu silme.
- Maestro dependency/config/DB/UI cleanup yapma; bu Phase 9 işidir.
- Başarısız Bridge run'da sessiz Maestro fallback kurma.
- Dual-run sonucunu production fallback gibi kullanma; sadece ölçüm harness'i.
- Gerçek DUT olmadan CHECKPOINT 8 full PASS verme.
- Golden runner/parity ölçümü olmadan cutover GO üretme.
- PerformanceBudget v1 pinlenmeden performans kabulü verme.
- Hot path full-tree dump örneklerini cutover'a rağmen kabul etme.
- Profile dışı/ölçülmemiş tekil örnekleri cutover gerekçesi yapma.
- Unknown physical effect durumunda sessiz retry/green üretme.
- Cross-run/stale command action uygulamasına izin verme.
- Manual touch/foreign window/IME obstruction sinyalini görmezden gelme.

Yapılacaklar:

1. Preflight:
   - pnpm verdict:verify-master-plan
   - git status --short --branch
   - Phase 7 RESULT gate doğrulaması
   - pnpm typecheck
   - pnpm test
   - real DUT/lab device inventory
   - SDK/Bridge/app build/version/protocol snapshot
   - device/build/thermal profile inventory

2. Command fencing:
   - Her command run/session/epoch fenced olmalı.
   - Eski/cross-run command action uygulamadan reddedilmeli.
   - Reboot/session/epoch değişiminde stale command fail-closed olmalı.
   - requestId/attempt/occurrence correlation Result.md'ye kanıt olarak yazılmalı.

3. Physical action duplicate/unknown-effect:
   - Process death duplicate physical action fixture.
   - Bridge reconnect response-loss fixture.
   - Host crash after dispatch before response fixture.
   - Outcome: duplicate action yok veya explicit UNKNOWN_EFFECT/reconciliation stop.

4. Physical obstruction fixtures:
   - IME obstruction.
   - Foreign window.
   - Same-app z-order.
   - Manual touch contamination.
   - Obscured/contaminated evidence Run Detail/Evidence Journey'de görünmeli.

5. Tree freshness and invalidation:
   - Same-app z-order ve SCREEN_READY invalidation.
   - treeGen stale tap engeli.
   - Mutation sonrası active wait scoped reevaluation.
   - Hot path full dump yok.

6. WakeLock/thermal/power:
   - WakeLock bounded.
   - Thermal/power profile ölçümleri.
   - Device/build/thermal profile pinlenmeli.
   - Ölçüm koşulları RESULT.md'de açık yazılmalı.

7. PerformanceBudget v1:
   - CP0 baseline'ından üretilmiş budget kullan.
   - Cihaz/build/thermal profili pinli.
   - Percentile/sample tanımı pinli.
   - Command latency, wait latency, receipt lag, ordered lag, Bridge CPU/power,
     hot-path dump count ve artifact capture budget'ları açık.
   - Budget yoksa cutover GO yok.

8. Golden dual-run harness:
   - Maestro/golden runner ve BridgeFlow aynı workflow/input/build/device matrix ile koşmalı.
   - Sessiz fallback değil; yan yana ölçüm.
   - Plan/run/domain pack/app build/device/version provenance pinlenmeli.
   - Başarısız Bridge run Maestro ile otomatik tamamlanmamalı.

9. Correctness comparison:
   - Tam kurye workflow.
   - Field Login.
   - Load Tour.
   - Barcode loop.
   - Offline queue.
   - Backend confirmation.
   - Tour Approval Lifecycle.
   - Expected result: BridgeFlow correctness golden runner'dan düşük değil.

10. False-pass/false-fail comparison:
   - UI-only pass false positive.
   - HTTP 2xx false positive.
   - Backend approved but mobile missing.
   - Unknown dialog.
   - Offline queued.
   - Manual contamination.
   - Evidence stale/correlation miss.
   - BridgeFlow false-pass artışı yok.

11. Artifact/evidence completeness:
   - Run Detail.
   - Evidence Journey.
   - Repro package.
   - Action lifecycle.
   - wait_any expected/interrupt/cancel/timeout.
   - Origin/confidence.
   - Clock uncertainty.
   - Artifact completeness acceptance.

12. Hot path dump gate:
   - Normal happy path full-tree dump count zero.
   - Explicit diagnostic scoped capture ayrı sayılmalı.
   - Hot path violation varsa cutover NO_GO.

13. Cutover report:
   - Inputs.
   - Device/build/environment matrix.
   - Golden runner vs BridgeFlow comparison.
   - Correctness.
   - False-pass/fail.
   - PerformanceBudget v1.
   - Evidence/artifact completeness.
   - Known blockers.
   - Rollback/cutover recommendation.
   - Signed decision fields.

14. Verification:
   - pnpm verdict:verify-master-plan
   - pnpm typecheck
   - pnpm test
   - targeted Bridge/SDK/runtime/API/web tests
   - real DUT physical acceptance commands
   - dual-run/parity command outputs
   - performance budget report generation
   - git diff --check
   - git diff --cached --check

Kapanış:
- RESULT.md'yi COMPLETED, READY_WITH_BLOCKERS, BLOCKED_PRECONDITION,
  BLOCKED_EXTERNAL veya FAILED olarak güncelle.
- CHECKPOINT 8 acceptance checklist'ini kanıtlarla doldur.
- `cutoverDecision` alanını GO, NO_GO veya BLOCKED_EXTERNAL yap.
- GO yalnız gerçek DUT + golden dual-run + PerformanceBudget v1 + artifact completeness
  kanıtıyla verilebilir.
- Phase 9 readiness kararını yaz.
```

## 2. Phase 8 hedef mimarisi

Phase 8 bir “silme” fazı değildir; ölçüm ve karar fazıdır.

```text
Nesy real workflows / Test Profiles
  ↓
Golden Dual-Run Harness
  ├── Maestro/golden runner
  └── BridgeFlow runtime
      ↓
Comparison
  ├── correctness
  ├── false-pass / false-fail
  ├── artifact completeness
  ├── evidence journey completeness
  ├── physical safety fixtures
  └── PerformanceBudget v1
      ↓
Signed Cutover Decision
  ├── GO
  ├── NO_GO
  └── BLOCKED_EXTERNAL
```

Maestro bu fazda production fallback olarak kullanılmaz. Sadece ölçüm harness'i
içinde kıyas kaynağıdır.

## 3. Başlama gate'i

Phase 8 agent'ı başlamadan önce şu koşulları doğrulamalıdır:

```text
docs/verdict/run-playbooks/phase-7/RESULT.md
  resultState: COMPLETED
  phase8Readiness: READY_WITH_EXTERNAL_BLOCKERS
```

Bu iki koşul yoksa:

- Kod yazılmayacak.
- Physical acceptance başlatılmayacak.
- Dual-run harness başlatılmayacak.
- `RESULT.md` `BLOCKED_PRECONDITION` olarak güncellenecek.
- Eksik Phase 7 evidence listesi yazılacak.

## 4. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `8` |
| Current step | `8.0` |
| Current state | `WAITING_FOR_PHASE_7_COMPLETION` |
| Last successful step | `7.0` |
| Last attempted step | `8.0` |
| Last update | `2026-08-05 14:49:14 +03` |
| Recovery instruction | `Phase 8 playbook hazır. Phase 7 RESULT COMPLETED + phase8Readiness READY_WITH_EXTERNAL_BLOCKERS olmadan implementation/acceptance başlatma. Gerçek DUT, golden dual-run ve PerformanceBudget v1 yoksa cutover GO verme.` |

## 5. Owned paths

Beklenen owned paths:

```text
apps/api/src/services/bridge-*.ts
apps/api/src/services/bridgeflow-*.ts
apps/api/src/services/device-*.ts
apps/api/src/services/performance-*.ts
apps/api/src/services/cutover-*.ts
apps/api/src/routes/verdict-*.ts
apps/web/src/lib/verdict-runtime/**
apps/web/src/lib/device-lab/**
apps/web/src/lib/cutover/**
apps/web/src/app/**/engineering/**
apps/web/src/app/**/debug-view/**
docs/verdict/run-playbooks/phase-8/**
docs/verdict/reports/cutover/**
package.json
pnpm-lock.yaml
turbo.json
```

Koşullu olarak okunabilir ama gereksiz yazılmamalı:

```text
packages/bridgeflow-executor/**
packages/oracle-engine/**
packages/execution-contract/**
packages/bridge-contract/**
packages/bridge-client/**
packages/control-contract/**
domain-packs/nesy-courier/**
```

Mobile repo değişikliği gerekirse bu playbook varsayılan olarak yazma izni vermez.
RESULT.md içinde `BLOCKED_MOBILE_CHANGE_REQUIRED` veya açık owner handoff yazılmalıdır.

## 6. Step plan

| Step | Status | Açıklama | Output |
|---|---|---|---|
| 8.0 Playbook oluşturma | `DONE` | `RUN_PLAY.md` + `RESULT.md` oluşturuldu. | Phase 8 hazır ama gated |
| 8.1 Phase 7 gate doğrulama | `PENDING` | Phase 7 `COMPLETED` ve `phase8Readiness` doğrula. | Gate evidence |
| 8.2 Preflight/device matrix | `PENDING` | Digest, branch, tests, DUT/build/protocol/thermal snapshot. | Baseline |
| 8.3 Command fencing acceptance | `PENDING` | run/session/epoch fencing, stale/cross-run reject. | Fencing evidence |
| 8.4 Process-death duplicate action | `PENDING` | duplicate physical action yok veya UNKNOWN_EFFECT. | Physical fixture |
| 8.5 Bridge reconnect unknown-effect | `PENDING` | response-loss/reconnect policy. | Recovery fixture |
| 8.6 IME obstruction | `PENDING` | fail/recover evidence. | Obstruction fixture |
| 8.7 Foreign window / obscured tap | `PENDING` | tap block + obscuredBy evidence. | Obstruction fixture |
| 8.8 Manual touch contamination | `PENDING` | contamination origin evidence. | Manual fixture |
| 8.9 Tree freshness/invalidation | `PENDING` | stale tree/tap reject, mutation scoped reevaluation. | Freshness fixture |
| 8.10 WakeLock/thermal/power | `PENDING` | bounded WakeLock and profile metrics. | Device metrics |
| 8.11 PerformanceBudget v1 | `PENDING` | pinned budget from CP0 baseline. | Budget artifact |
| 8.12 Golden dual-run harness | `PENDING` | Maestro/golden vs BridgeFlow side-by-side. | Harness |
| 8.13 Correctness comparison | `PENDING` | Field/Login/Load/Full/Barcode/Queue/Tour workflows. | Correctness report |
| 8.14 False-pass/fail comparison | `PENDING` | false positive/negative diff. | Quality report |
| 8.15 Artifact/evidence completeness | `PENDING` | Run Detail/Evidence/Repro completeness. | Artifact report |
| 8.16 Hot path full-dump gate | `PENDING` | normal happy path dump count zero. | Performance/safety gate |
| 8.17 Cutover report | `PENDING` | signed GO/NO_GO/BLOCKED decision draft. | Report |
| 8.18 Verification | `PENDING` | digest/typecheck/test/DUT/parity/budget/diff checks. | Verification |
| 8.19 RESULT closure | `PENDING` | CHECKPOINT 8 checklist + Phase 9 readiness. | Handoff |

## 7. Physical fixture matrix

Minimum fixture set:

```text
command fencing: stale run/session/epoch
process death after dispatch
process death before effect verification
Bridge reconnect after response loss
IME obstruction
foreign window obstruction
same-app z-order change
manual touch contamination
stale treeGen tap attempt
SCREEN_READY invalidation
WakeLock/thermal/power long run
hot-path full-dump detection
```

Her fixture gerçek DUT üzerinde koşturulmalı veya `BLOCKED_EXTERNAL_REAL_DUT`
olarak açık kalmalıdır.

## 8. Golden dual-run scope

Minimum karşılaştırılacak workflow/profile seti:

```text
Field Login
Load Tour
Full Courier Golden Workflow
20 Barcode Processing
Offline Delivery + Queue Flush
Backend Confirmation
Tour Approval Lifecycle
nesy.smoke.core
nesy.regression.critical representative subset
nesy.recovery.queue-flush representative subset
```

Karşılaştırma ölçümleri:

```text
product correctness
business verdict consistency
false-pass rate
false-fail rate
artifact completeness
evidence completeness
runtime duration
command latency
wait latency
receipt lag
ordered lag
Bridge CPU/power
WakeLock duration
hot-path dump count
```

## 9. PerformanceBudget v1

Budget şu bilgileri pinlemelidir:

```text
budgetId
budgetVersion
sourceBaseline: CP0
device model/API/build
app build/version
SDK version/protocol
Bridge version/protocol
host machine/OS
thermal profile
power mode
sample count
percentile policy
workflow/profile set
latency thresholds
power/thermal thresholds
dump/artifact thresholds
known exclusions
```

Ölçülmemiş veya profile dışı örnek cutover gerekçesi yapılamaz.

## 10. Cutover decision taxonomy

```text
GO
  - CHECKPOINT 8 acceptance pass
  - real DUT evidence complete
  - golden dual-run parity acceptable
  - PerformanceBudget v1 pass
  - artifact/evidence completeness pass
  - signed decision present

NO_GO
  - correctness regression
  - false-pass increase
  - hot-path full dump
  - unknown-effect unsafe retry
  - performance budget fail
  - artifact/evidence completeness fail

BLOCKED_EXTERNAL
  - real DUT unavailable
  - golden runner unavailable
  - required backend/device lab unavailable
  - signed decision owner unavailable
```

## 11. Safety blockers

Şu durumlardan biri görülürse Phase 8 fail/block edilmelidir:

- Phase 7 completed değil.
- Gerçek DUT olmadan full CHECKPOINT 8 PASS veriliyor.
- Golden dual-run olmadan cutover GO veriliyor.
- PerformanceBudget v1 yok.
- Bridge failure sessiz Maestro fallback ile tamamlanıyor.
- Cross-run/stale command action uyguluyor.
- Process death duplicate physical action üretiyor.
- Unknown-effect green/retry oluyor.
- Foreign window tap engellenmiyor.
- Manual touch contamination işaretlenmiyor.
- Hot path full-tree dump count sıfır değil.
- False-pass artışı var.
- Artifact/evidence completeness kabul kriterini geçmiyor.
- Cutover kararı kayıt altına alınmamış.

## 12. Minimum verification commands

Agent kapanışta en az şunları çalıştırmalıdır:

```bash
pnpm verdict:verify-master-plan
pnpm typecheck
pnpm test
pnpm --filter @nesy/api typecheck
pnpm --filter @nesy/api test
pnpm --filter @nesy/web typecheck
pnpm --filter @nesy/web test
git diff --check
git diff --cached --check
```

Gerçek DUT, golden dual-run ve performance budget komutları ortamdan ortama
değişebilir. Agent gerçekten çalıştırdığı komutları RESULT.md içine tam olarak
yazmalıdır.

## 13. CHECKPOINT 8 acceptance checklist

Phase 8 kapanmadan aşağıdaki maddeler `PASS`, `FAIL`, `BLOCKED_EXTERNAL` veya
`DEFERRED_WITH_REASON` olarak RESULT.md'ye işlenmelidir.

1. Phase 7 output'ları doğrulandı.
2. Real DUT/device matrix alındı.
3. App/SDK/Bridge/protocol versions pinlendi.
4. Device/build/thermal profile pinlendi.
5. Her command run/session/epoch fenced.
6. Eski/cross-run command action uygulamadan reddediliyor.
7. Reboot/session/epoch değişiminde stale command fail-closed.
8. Process death duplicate physical action üretmiyor.
9. Process death explicit UNKNOWN_EFFECT ile duruyor veya güvenli reconciliation üretiyor.
10. Bridge reconnect response-loss unknown-effect policy üretiyor.
11. Host crash after dispatch fixture güvenli.
12. IME obstruction beklendiği gibi fail/recover.
13. Foreign window tap'i engelliyor.
14. `obscuredBy` evidence mevcut.
15. Same-app z-order stale target action'ı engelliyor.
16. Manual touch contamination işaretleniyor.
17. Manual contamination Run Detail/Evidence Journey'de görünüyor.
18. treeGen stale tap reject ediliyor.
19. SCREEN_READY invalidation çalışıyor.
20. Mutation sonrası active wait scoped reevaluation çalışıyor.
21. WakeLock bounded.
22. Thermal/power ölçümleri alındı.
23. Command latency budget içinde.
24. Wait latency budget içinde.
25. Receipt bus latency/lag budget içinde.
26. Ordered bus latency/lag budget içinde.
27. Bridge CPU/power budget içinde.
28. CP0 baseline'ından PerformanceBudget v1 üretildi.
29. PerformanceBudget v1 percentile/sample tanımı pinli.
30. PerformanceBudget v1 cihaz/build/thermal profili pinli.
31. Golden dual-run harness kuruldu.
32. Dual-run production fallback değil, measurement harness.
33. Failed Bridge run sessiz Maestro ile tamamlanmıyor.
34. Field Login dual-run karşılaştırıldı.
35. Load Tour dual-run karşılaştırıldı.
36. Full Courier dual-run karşılaştırıldı.
37. 20 Barcode dual-run karşılaştırıldı.
38. Offline Queue dual-run karşılaştırıldı.
39. Backend Confirmation dual-run karşılaştırıldı.
40. Tour Approval Lifecycle dual-run karşılaştırıldı.
41. Tam kurye BridgeFlow correctness golden runner'dan düşük değil.
42. Business verdict consistency kabul edildi.
43. False-pass artışı yok.
44. False-fail kabul eşiği içinde.
45. UI-only pass false positive yakalanıyor.
46. HTTP 2xx false positive yakalanıyor.
47. Backend approved/mobile missing false positive yakalanıyor.
48. Unknown dialog false green üretmiyor.
49. Offline queued false failure üretmiyor.
50. Manual contamination false pass üretmiyor.
51. Evidence stale/correlation miss false pass üretmiyor.
52. Artifact completeness kabul kriterini geçiyor.
53. Evidence completeness kabul kriterini geçiyor.
54. Run Detail completeness kabul kriterini geçiyor.
55. Evidence Journey completeness kabul kriterini geçiyor.
56. Repro package completeness kabul kriterini geçiyor.
57. Action lifecycle evidence complete.
58. wait_any expected/interrupt/cancel/timeout evidence complete.
59. Origin/confidence evidence complete.
60. Clock uncertainty evidence complete.
61. Hot path full-tree dump count zero.
62. Explicit diagnostic scoped capture hot path dump sayılmıyor.
63. Ölçülmemiş/profile dışı örnek cutover gerekçesi yapılmadı.
64. Cutover report üretildi.
65. Cutover report input/device/build/environment matrix taşıyor.
66. Cutover report correctness comparison taşıyor.
67. Cutover report false-pass/fail comparison taşıyor.
68. Cutover report PerformanceBudget v1 sonucu taşıyor.
69. Cutover report artifact/evidence completeness sonucu taşıyor.
70. Cutover report known blockers taşıyor.
71. Cutover decision GO/NO_GO/BLOCKED_EXTERNAL olarak açık.
72. Cutover decision owner/signature alanları mevcut.
73. CHECKPOINT 8 geçmeden Maestro DELETE yapılmadı.
74. Maestro dependency/config/UI/DB cleanup yapılmadı.
75. Full verification komutları çalıştırıldı ve RESULT.md'ye yazıldı.

## 14. Phase 9 handoff expectation

İdeal kapanış:

```text
Phase 8: COMPLETED
CHECKPOINT 8: PASSED
cutoverDecision: GO
Phase 9 readiness: READY_WITH_SIGNED_CUTOVER_DECISION
Reason: BridgeFlow physical acceptance and golden dual-run parity are measured; Maestro removal is now allowed but not yet performed.
```

Eğer gerçek DUT, golden runner veya imza eksikse:

```text
Phase 8: BLOCKED_EXTERNAL
cutoverDecision: BLOCKED_EXTERNAL
Phase 9 readiness: NOT_READY
```
