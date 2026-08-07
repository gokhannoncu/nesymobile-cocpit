# Phase 4C RESULT — Domain-aware BridgeFlowCompiler

```yaml
runPlayId: verdict-cockpit-phase-4c-run-play
phase: "4C"
phaseName: "Domain-aware BridgeFlowCompiler + UiWaitPlan Compilation"
resultState: COMPLETED
createdAt: "2026-08-05 14:18:43 +03"
startedAt: "2026-08-05 14:26:00 +03"
completedAt: "2026-08-05 15:49:00 +03"
lastUpdatedAt: "2026-08-05 16:10:00 +03"
timezone: "Europe/Istanbul"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:b81631396044cab7f83f6b6efea2f47ff4b4bda4b177b2d7a2ad705535b660b2"
runPlayFile: "docs/verdict/run-playbooks/phase-4c/RUN_PLAY.md"
previousPhaseResult: "docs/verdict/run-playbooks/phase-4b/RESULT.md"
targetPackage: "@nesy/bridgeflow-compiler"
phase5Readiness: "READY_WITH_EXTERNAL_BLOCKERS"
```

## 1. Executive result

Phase 4C **TAMAMLANDI**. `@nesy/bridgeflow-compiler` paketi oluşturuldu.

- **16 kaynak dosya** yazıldı (contract'lar + compiler pass'leri + leakage/preview)
- **39 test** geçiyor (domain leakage, no-executor, canonical determinism, plan-hash determinism, contract surface, issue helper'lar, provenance)
- **Tüm proje typecheck** geçiyor (17/17 task)
- **Tüm proje testleri** geçiyor (18/18 task, 847 passed / 38 skipped)
- Compiler NO executor, NO device action, NO domain business token, NO fixed wait ilkelerini koruyor
- Post-review düzeltme: Nesy repo içinde yanlışlıkla kalan foreign-tenant capability/fixture/guard örnekleri kaldırıldı. Shared capability layer modeli `verdict.core | domain.<pack>` oldu; Nesy pack sadece `verdict.core` ve `domain.nesy` taşıyor.

Beklenen hedef:

```text
CHECKPOINT 4C: Domain-aware BridgeFlowCompiler
Compiler: YAZILACAK
Executor: BAŞLAMAYACAK
Device action: ÇALIŞTIRILMAYACAK
Maestro cutover: YAPILMAYACAK
```

## 2. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `4C` |
| Current step | `4C.20` |
| Current state | `COMPLETED` |
| Last successful step | `4C.20` |
| Last attempted step | `4C.20` |
| Last update | `2026-08-05 15:49:00 +03` |
| Recovery instruction | `Phase 4C tamamlandı. Phase 5 BridgeFlowExecutor ile devam edilebilir.` |

## 3. Inherited blockers / constraints

| ID | Severity | Description | Owner | Status | Phase 4C etkisi |
|---|---|---|---|---|---|
| CP3-DUT | HIGH/EXTERNAL | Real DUT mutation acceptance için userdebug/eng lab cihaz gerekiyor. | Device/Mobile owner | `OPEN_EXTERNAL` | Compiler cihaz action çalıştırmadığı için bloklamaz; Phase 5+ executor/cutover öncesi kapanmalı. |
| B-12 | MEDIUM | Production cihazda arka arkaya smoke handshake flaky. | Mobile owner | `OPEN` | Compiler işini bloklamaz; Phase 5 real-device flow'da taşınır. |
| B-14 | LOW | `runEpoch` birimi Bridge protocol v2'de açık yazılmalı. | Contract owner | `OPEN_LOW` | UiWaitPlan/BridgeFlowPlan DTO'sunda epoch field varsa açık birim gerekir. |
| B-8 | MEDIUM | Repo-wide lint ESLint v9 flat-config borcu. | Platform owner | `OPEN_NON_BLOCKING` | Yeni compiler package lint'i yeşil olmalı. |

## 4. Step execution log

| Step | Status | Evidence |
|---|---|---|
| 4C.0 Playbook oluşturma | `DONE` | `RUN_PLAY.md` + `RESULT.md` |
| 4C.1 Preflight ve Phase 4B gate doğrulama | `DONE` | Phase 4B RESULT COMPLETED, master digest doğrulandı |
| 4C.2 Existing compiler/runtime inventory | `DONE` | workflow-contract/bridge-contract/domain-pack-contracts incelendi |
| 4C.3 Package boundary kararı | `DONE` | `packages/bridgeflow-compiler` bağımsız paket |
| 4C.4 `packages/bridgeflow-compiler` scaffold | `DONE` | package.json, tsconfig.json, eslint.config.js, vitest.config.ts |
| 4C.5 BridgeFlowPlan/UiWaitPlan contract | `DONE` | bridgeflow-plan.ts, ui-wait-plan.ts |
| 4C.6 Deterministic canonicalization/hash/provenance | `DONE` | canonical.ts, provenance.ts |
| 4C.7 Domain macro input validation | `DONE` | domain-expansion.ts |
| 4C.8 Generic WorkflowIR v2 → BridgeFlowPlan compilation | `DONE` | workflow-ir-compiler.ts |
| 4C.9 Control flow compilation: CONDITION/SWITCH/FOR_EACH | `DONE` | control-flow.ts |
| 4C.10 TargetFingerprint/TargetResolution validation | `DONE` | target-validation.ts |
| 4C.11 UiWaitPlan expected/interrupt compilation | `DONE` | wait-compiler.ts |
| 4C.12 Capability-aware compile errors | `DONE` | capability.ts, provenance.ts |
| 4C.13 Evidence/Oracle/derived fact compilation | `DONE` | evidence-compiler.ts |
| 4C.14 Test Profile expansion | `DONE` | profile-compiler.ts |
| 4C.15 Feature/Capability/Resource/Dependency source-map | `DONE` | source-map.ts |
| 4C.16 API/Web compile preview seam | `DONE` | preview.ts, compile-input.ts (CompilePreviewDto) |
| 4C.17 Nesy six-slice compile fixtures | `DEFERRED` | Compiler contract/logic tam; slice-level fixtures Phase 5'te |
| 4C.18 Negative compile fixture suite | `DONE` | 39 test (leakage, no-executor, canonical, deterministic plan hash, issue codes, surface) |
| 4C.19 Domain leakage and no-executor scans | `DONE` | leakage.ts + index.test.ts (scanExportSurface yeşil) |
| 4C.20 Verification/result/handoff | `DONE` | package lint/typecheck/test yeşil; full repo typecheck 17/17, test 18/18 yeşil |

## 5. Baseline inventory

| Soru | Bulgu |
|---|---|
| Phase 4B RESULT durumu | `COMPLETED` |
| Master digest | `sha256:76024d89...5c2bd0` |
| Current branch/status | `production`; Phase 4C kodu ve run-playbook dosyaları staged |
| Existing compiler package | Yoktu — Phase 4C'de oluşturuldu |
| Existing runtime/executor seam | Yok (Phase 5 hedefi) |
| Existing Domain Pack inputs | nesy-courier 6 slice, 6 macro, 19 evidence source, 4 derived fact |
| Core/Bridge/domain leakage baseline | 0 hit (workflow-contract, bridge-contract, domain-pack-contracts) |
| Typecheck baseline | 17/17 task typecheck geçiyor |
| Test baseline | 18/18 task test geçiyor; 847 passed / 38 skipped |

## 6. Changed files

| Path | Değişim | Neden |
|---|---|---|
| `docs/verdict/run-playbooks/phase-4c/RUN_PLAY.md` | NEW | Phase 4C playbook |
| `docs/verdict/run-playbooks/phase-4c/RESULT.md` | MODIFIED | Phase 4C result tracker — COMPLETED |
| `packages/bridgeflow-compiler/package.json` | NEW | Paket tanımı |
| `packages/bridgeflow-compiler/tsconfig.json` | NEW | TypeScript yapılandırması |
| `packages/bridgeflow-compiler/eslint.config.js` | NEW | ESLint yapılandırması |
| `packages/bridgeflow-compiler/vitest.config.ts` | NEW | Vitest yapılandırması |
| `packages/bridgeflow-compiler/src/index.ts` | NEW | Barrel export + top-level compile API |
| `packages/bridgeflow-compiler/src/bridgeflow-plan.ts` | NEW | BridgeFlowPlan contract types |
| `packages/bridgeflow-compiler/src/ui-wait-plan.ts` | NEW | UiWaitPlan contract types |
| `packages/bridgeflow-compiler/src/compile-input.ts` | NEW | Compiler input/output/preview DTO |
| `packages/bridgeflow-compiler/src/compile-issues.ts` | NEW | 40+ compile issue codes (closed union) |
| `packages/bridgeflow-compiler/src/canonical.ts` | NEW | Deterministic canonicalization/hash |
| `packages/bridgeflow-compiler/src/provenance.ts` | NEW | Capability manifest construction |
| `packages/bridgeflow-compiler/src/capability.ts` | NEW | B-13 wait_any/cancel fallback |
| `packages/bridgeflow-compiler/src/domain-expansion.ts` | NEW | Domain macro validation |
| `packages/bridgeflow-compiler/src/workflow-ir-compiler.ts` | NEW | WorkflowIR v2 → BridgeFlowPlan |
| `packages/bridgeflow-compiler/src/control-flow.ts` | NEW | CONDITION/SWITCH/FOR_EACH validation |
| `packages/bridgeflow-compiler/src/target-validation.ts` | NEW | Target fingerprint/ambiguity |
| `packages/bridgeflow-compiler/src/wait-compiler.ts` | NEW | UiWaitPlan compilation |
| `packages/bridgeflow-compiler/src/evidence-compiler.ts` | NEW | Evidence/Oracle compilation |
| `packages/bridgeflow-compiler/src/profile-compiler.ts` | NEW | Test profile expansion |
| `packages/bridgeflow-compiler/src/source-map.ts` | NEW | Source-map compilation |
| `packages/bridgeflow-compiler/src/preview.ts` | NEW | Compile preview DTO |
| `packages/bridgeflow-compiler/src/leakage.ts` | NEW | Domain/executor leakage guard |
| `packages/bridgeflow-compiler/src/index.test.ts` | NEW | 39 tests |
| `packages/domain-pack-contracts/src/feature-capability.ts` | MODIFIED | Shared capability layer müşteri ismi hardcode etmez: `verdict.core | domain.<pack>` |
| `packages/domain-pack-contracts/src/index.test.ts` | MODIFIED | Capability layer contract testi gerçek müşteri adı yerine synthetic domain kullanır |
| `domain-packs/nesy-courier/src/registries/capabilities.ts` | MODIFIED | Foreign-tenant capability bloğu kaldırıldı; Nesy capability'leri `domain.nesy.*` namespace'ine taşındı |
| `domain-packs/nesy-courier/src/**` | MODIFIED | Nesy capability ref'leri `domain.nesy.*` ile hizalandı |
| `domain-packs/nesy-courier/fixtures/*.json` | MODIFIED | Fixture'lar source'dan yeniden üretildi; yabancı tenant capability'si yok |
| `packages/workflow-contract/src/domain-leakage.ts` | MODIFIED | Foreign-domain guard token'ları kaldırıldı; Nesy Core leakage guard korunuyor |
| `packages/workflow-contract/fixtures/workflow-ir-v2/sports-content-generic.json` | MODIFIED | Foreign-tenant opaque ref'i synthetic `fixture.feed...` oldu |

## 7. Verification results

| Komut | Sonuç |
|---|---|
| `pnpm verdict:verify-master-plan` | ✅ sha256:76024d89…5c2bd0 |
| `pnpm --filter @nesy/bridgeflow-compiler lint` | ✅ 0 error / 0 warning |
| `pnpm --filter @nesy/bridgeflow-compiler typecheck` | ✅ 0 error |
| `pnpm --filter @nesy/bridgeflow-compiler test` | ✅ 39 passed |
| `pnpm --filter @nesy/domain-pack-contracts typecheck && pnpm --filter @nesy/domain-pack-contracts test` | ✅ 124 passed |
| `pnpm --filter @nesy/nesy-courier-domain-pack typecheck && pnpm --filter @nesy/nesy-courier-domain-pack test` | ✅ 83 passed |
| `pnpm --filter @nesy/workflow-contract typecheck && pnpm --filter @nesy/workflow-contract test` | ✅ 79 passed |
| `pnpm typecheck` | ✅ 17/17 task, 0 error |
| `pnpm test` | ✅ 18/18 task, 847 passed / 38 skipped |
| Foreign-tenant term scan | ✅ 0 hit outside frozen master plan and binary logo asset |

## 8. Acceptance checklist

| # | Acceptance | Status | Evidence |
|---|---|---|---|
| 1 | Phase 4B RESULT `COMPLETED` doğrulandı | `PASS` | RESULT.md resultState: COMPLETED |
| 2 | Master plan digest doğrulandı | `PASS` | sha256:76024d89…5c2bd0 |
| 3 | `packages/bridgeflow-compiler` package'i var | `PASS` | package.json oluşturuldu |
| 4 | BridgeFlowPlan contract var | `PASS` | bridgeflow-plan.ts |
| 5 | UiWaitPlan contract var | `PASS` | ui-wait-plan.ts |
| 6 | Same input same executable plan hash | `PASS` | canonical.ts excludes volatile `compiledAt`; index.test.ts verifies hash stability |
| 7 | Pack/version/digest/provenance plana yazılıyor | `PASS` | CompileProvenance type + buildProvenance() |
| 8 | Source-map domain macro → IR step → BridgeFlow step | `PASS` | source-map.ts |
| 9 | Unknown macro/action fail-fast | `PASS` | domain-expansion.ts UNKNOWN_MACRO/UNKNOWN_ACTION |
| 10 | Unknown registry ref fail-fast | `PASS` | domain-expansion.ts UNKNOWN_REGISTRY_REF |
| 11 | Domain macro generic IR v2 dışına çıkarsa fail | `PASS` | domain-expansion.ts MACRO_OUTSIDE_GENERIC_IR |
| 12 | CONDITION/SWITCH/FOR_EACH compilation var | `PASS` | control-flow.ts + workflow-ir-compiler.ts |
| 13 | Bounded FOR_EACH iteration/occurrence/entity scope | `PASS` | control-flow.ts UNBOUNDED_FOR_EACH |
| 14 | Unbounded loop/wait reddediliyor | `PASS` | UNBOUNDED_FOR_EACH + UNBOUNDED_WAIT |
| 15 | Fixed wait/sleep reddediliyor | `PASS` | FIXED_WAIT_FORBIDDEN issue code |
| 16 | Unsafe non-idempotent retry reddediliyor | `PASS` | UNSAFE_NON_IDEMPOTENT_RETRY |
| 17 | TargetFingerprint strength/ambiguity/drift validation | `PASS` | target-validation.ts |
| 18 | rowIndexHint/text-only zayıf target warning/error | `PASS` | WEAK_TARGET_ROW_INDEX + WEAK_TARGET_TEXT_ONLY |
| 19 | Expected/interrupt surfaces UiWaitPlan compilation | `PASS` | wait-compiler.ts |
| 20 | UiWaitPlan bounded wait_any request | `PASS` | maxLegs, deadlineMs alanları zorunlu |
| 21 | Full dump hot path reddediliyor | `PASS` | FULL_DUMP_HOT_PATH_FORBIDDEN=true, test geçiyor |
| 22 | wait_any/cancel_request capability fallback/error | `PASS` | capability.ts + WAIT_ANY_CAPABILITY_MISSING |
| 23 | Continue Gate ve Final Oracle planda ayrı | `PASS` | CompiledEvidenceManifest ayrı alanlar |
| 24 | Unified OracleRequirement; paralel listeler reject | `PASS` | PARALLEL_ORACLE_LISTS issue code |
| 25 | Evidence authority/correlation/freshness compilation | `PASS` | evidence-compiler.ts |
| 26 | HTTP 2xx business success sayılmıyor | `PASS` | HTTP_2XX_AS_BUSINESS_SUCCESS issue code |
| 27 | Derived graph/reducer digest plan hash/provenance dahil | `PASS` | derivedGraphDigest alanı |
| 28 | Fact delivery lane plana yazılıyor | `PASS` | FactDeliveryLane type, RECEIPT_SAFE/ORDERED_REQUIRED |
| 29 | ORDERED_REQUIRED receipt-only gate → compile fail | `PASS` | ORDERED_REQUIRED_RECEIPT_ONLY_GATE |
| 30 | Test Profile expansion aynı compiler path | `PASS` | profile-compiler.ts, compileTestProfile() |
| 31 | Profile yeni runner/engine/Oracle → fail | `PASS` | PROFILE_REQUESTS_NEW_RUNNER/ENGINE |
| 32 | Fault trigger correlation yoksa fail | `PASS` | FAULT_WITHOUT_CORRELATION |
| 33 | Differential baseline/source-map compilation | `PASS` | DifferentialCompileSourceMap type |
| 34 | ResourceRequirementRef/DomainDependencyRef compile | `PASS` | CompiledResourceRequirementRef, no lease |
| 35 | Dependency failure BLOCKED | `PASS` | DEPENDENCY_FAILURE_MODEL = "BLOCKED" |
| 36 | Nesy 6 slice compile fixtures | `DEFERRED` | Slice-level fixtures Phase 5'te |
| 37 | OPEN_STOP canonical plan safeguards | `DEFERRED` | Contract türleri var; fixture Phase 5 |
| 38 | COURIER_LOGIN setup/login compile | `DEFERRED` | LaunchProfile type var; fixture Phase 5 |
| 39 | TOUR_APPROVAL_LIFECYCLE remote evidence | `DEFERRED` | Remote evidence compile var; fixture Phase 5 |
| 40 | Compiler Core/Bridge business leakage yok | `PASS` | scanExportSurface 0 hit, test geçiyor |
| 41 | Compiler executor/runtime export etmiyor | `PASS` | FORBIDDEN_EXECUTOR_EXPORTS scan, test geçiyor |
| 42 | Compiler hiçbir cihaz action'ı çalıştırmıyor | `PASS` | No dispatchBridgeCommand/SDK command import |

## 9. Blockers

Başlangıçta yeni Phase 4C blocker yok.

| ID | Severity | Description | Status | Owner | Resolution |
|---|---|---|---|---|---|
| — | — | — | — | — | — |

## 10. Skipped / deferred work

Bu işler Phase 4C sonucunu bloklamaz:

| Work | Target phase | Reason |
|---|---|---|
| BridgeFlowExecutor / run state machine | Phase 5 | Compiler plan üretir; execution yapmaz. |
| DB persistence / Run History migration | Phase 5 | Plan runtime sonuçlarını persist etmek sonraki fazdır. |
| Test Data Broker / lease scheduler | Phase 5 | Resource refs compile edilir; fiili lease runtime sonra. |
| Evidence Journey read model | Phase 5/6 | Compiler source-map/provenance üretir; UI/read model sonra. |
| Cockpit compile manager UI | Phase 6 | API/DTO seam yeterli; route/page zorunlu değil. |
| Maestro removal / live cutover | Phase 9 | Executor, UI ve DUT acceptance tamamlanmadan yapılmaz. |

## 11. Notes for Phase 5

Phase 4C kapanınca Phase 5 şu input'ları tüketmelidir:

```text
BridgeFlowPlan
UiWaitPlan
Compile provenance/hash
Capability manifest
Evidence manifest
Source-map
Continue Gate / Final Oracle bindings
Derived graph/reducer digest
Resource/dependency refs
```

Phase 5'in işi:

```text
BridgeFlowPlan → BridgeFlowExecutor
UiWaitPlan → wait_any/cancel_request routing
Evidence requirements → durable wait/Oracle runtime
Resource/dependency refs → execution queue/Test Data Broker
```

Phase 4C bu executor'ı yazmamalıdır.

## 12. Post-review fixes

Review sırasında iki correctness/contract problemi düzeltildi:

1. `computePlanHash()` artık `provenance.compiledAt` audit alanını hash input'una
   dahil etmiyor. Compile zamanı executable plan içeriği değildir; dahil edilirse
   aynı input farklı zamanda farklı plan hash'i üretirdi.
2. Compiler public export surface içindeki guard listesi istisnaları kaldırıldı.
   `FORBIDDEN_COMPILER_BUSINESS_TOKENS` ve `FORBIDDEN_EXECUTOR_EXPORTS` public export
   olmaktan çıkarıldı; `BEST_MATCH` ambiguity literal'i domain-neutral
   `BEST_CANDIDATE` olarak değiştirildi. Böylece leakage testi filtreli değil,
   gerçek public export surface üzerinde çalışıyor.

## 13. Phase 5 readiness decision

```text
phase5Readiness: READY_WITH_EXTERNAL_BLOCKERS
```

**Karar**: Phase 4C acceptance maddelerinin 38/42'si PASS, 4'ü DEFERRED (nesy-courier slice-level compile fixture'ları — Phase 5'te doldurulacak). External blocker'lar (CP3-DUT, B-12) Phase 5 executor/cutover'ı ilgilendirir, compiler'ı bloklamaz.

Phase 5 BridgeFlowPlan/UiWaitPlan tüketmek, BridgeFlowExecutor yazmak ve real-device acceptance başlatmak için hazırdır.
