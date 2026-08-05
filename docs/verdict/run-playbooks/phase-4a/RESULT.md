# Phase 4A RESULT — WorkflowIR v2 Tamamlama Kapısı

```yaml
runPlayId: verdict-cockpit-phase-4a-run-play
phase: "4A"
phaseName: "WorkflowIR v2 + Condition Engine + Core Outcome Contracts"
resultState: COMPLETED
createdAt: "2026-08-05 11:12:25 +03"
startedAt: "2026-08-05 11:41:28 +03"
completedAt: "2026-08-05 12:10:10 +03"
lastUpdatedAt: "2026-08-05 12:35:00 +03"
timezone: "Europe/Istanbul"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:76024d898cb152fe4d885fb18e798cb24b6c3df31715eac546c64383ed5c2bd0"
runPlayFile: "docs/verdict/run-playbooks/phase-4a/RUN_PLAY.md"
previousPhaseResult: "docs/verdict/run-playbooks/phase-3/RESULT.md"
sharedPackage: "@nesy/workflow-contract"
phase4BReadiness: "READY_WITH_EXTERNAL_BLOCKERS"
```

## 1. Executive result

Phase 4A implementation tamamlandı. Shared, generic ve domain-neutral WorkflowIR v2
contract'ı `packages/workflow-contract` altında kuruldu; API ve Web aynı paketi
tüketiyor. 22 acceptance kriterinin 22'si kanıtla karşılandı.

Post-review sırasında tek process blocker olan B-16 kapatıldı: golden fixture'lar
`verdict-contract-fixtures` submodule'ünden ana repo içindeki
`packages/workflow-contract/fixtures/workflow-ir-v2/` konumuna taşındı ve package/web
testleri bu konumu okumaya çevrildi. Böylece Phase 4A ana repo commit'i tek başına
CI için yeterli olur; submodule commit/push/gitlink bump gerekmiyor.

```text
Phase 4A implementation: COMPLETED
CP4A acceptance (22/22): PASSED
CP4A CI-safe: PASSED
CP3 full acceptance: BLOCKED_EXTERNAL_DUT (devralındı, Phase 4A'yı bloklamadı)
Domain Pack implementation: BAŞLAMADI (kural gereği)
```

## 2. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `4A` |
| Current step | `4A.14` |
| Current state | `COMPLETED` |
| Last successful step | `4A.14` |
| Last attempted step | `4A.14` |
| Last update | `2026-08-05 12:35:00 +03` |
| Recovery instruction | `Kod tarafı bitti ve tüm suite yeşil. B-16 post-review'da kapatıldı: golden fixture'lar ana repo içindeki packages/workflow-contract/fixtures/workflow-ir-v2/ altında. CP4A COMPLETED; Phase 4B RUN_PLAY hazırlanabilir.` |

## 3. Inherited blockers / constraints

| ID | Severity | Description | Owner | Status | Phase 4A sonucu |
|---|---|---|---|---|---|
| CP3-DUT | HIGH/EXTERNAL | CP3 full mutation acceptance için userdebug/eng lab cihaz gerekiyor. | Device/Mobile owner | `OPEN_EXTERNAL` | Phase 4A'yı bloklamadı. Phase 5 executor cutover öncesi kapanmalı. |
| B-12 | MEDIUM | Production cihazda arka arkaya smoke handshake flaky. | Mobile owner | `OPEN` | Core IR'ı bloklamadı; taşınıyor. |
| B-13 | MEDIUM | Bridge v1 cihazında `wait_any`, `cancel_request`, `capabilities` yok. | Mobile + Contract owner | `MODELLED_IN_CONTRACT` | **Tasarım kısıtı olarak uygulandı**: `WorkflowCapabilityRequirement.optional` + `fallback` (`SEQUENTIAL_LEGS`/`HOST_ONLY_CANCEL`), `WaitAnyStep.maxLegs` bounded, `WaitAnyStep.hostOnlyCancel` zorunlu explicit, `validateWorkflowIrV2({availableCapabilities})` hard-required eksik capability'yi reddediyor. 3 test. |
| B-14 | LOW | `runEpoch` birimi protocol v2'de açık yazılmalı. | Contract owner | `OPEN_LOW` | Bu fazda IR schema'ya girmedi (IR runEpoch taşımıyor). Protocol v2 işi olarak kalıyor. |
| B-8 | MEDIUM | Repo-wide lint ESLint v9 flat-config borcu. | Platform owner | `OPEN_NON_BLOCKING` | Yeni paket **0 error 0 warning**; §12 şartı karşılandı. |

## 4. Step execution log

| Step | Status | Evidence |
|---|---|---|
| 4A.0 Playbook oluşturma | `DONE` | `RUN_PLAY.md` + `RESULT.md` |
| 4A.1 Preflight ve inherited blocker check | `DONE` | digest OK; `git status --short` = yalnız `?? docs/verdict/run-playbooks/phase-4a/`; branch `production`; `pnpm typecheck` exit 0; `pnpm test` 27 passed/3 skipped file, 258 passed/38 skipped test |
| 4A.2 Existing workflow/oracle/runner baseline | `DONE` | §5 baseline tablosu |
| 4A.3 Shared workflow contract package kararı | `DONE` | `packages/workflow-contract` (`@nesy/workflow-contract`), 0 runtime dependency, `node:crypto` dışında import yok |
| 4A.4 WorkflowIR v2 schema + runtime validation | `DONE` | `src/ir-v2.ts`, `src/validate.ts`; 27 issue code; 10 test |
| 4A.5 Version migration + legacy reader source-map | `DONE` | `src/legacy-migration.ts` + `apps/api/src/services/workflow-ir-v2.ts`; 6+9 test; deterministic hash |
| 4A.6 Condition Engine typed AST | `DONE` | `src/condition.ts`, `src/condition-evaluator.ts`; Kleene tablosu + snapshot; 11 test |
| 4A.7 FOR_EACH/SWITCH/WAIT_EVENT/retry/cleanup union | `DONE` | `src/ir-v2.ts` 14 step kind; bounded loop/branch/default/effect-aware retry testleri |
| 4A.8 Continue Gate / Final Oracle typed policy | `DONE` | `src/evidence-policy.ts` — `continueGate` ve `finalOraclePolicy` yapısal olarak ayrı alan |
| 4A.9 Unified OracleRequirement migration guard | `DONE` | `migrateLegacyOracleLists` + `ORACLE_PARALLEL_LISTS` / `ORACLE_DUPLICATE_FACT` reddi; 6 test |
| 4A.10 Occurrence/entity/iteration/event correlation | `DONE` | `src/correlation.ts`; nested `iterationPath`, `correlationMatches` 7 mismatch reason; 5 test |
| 4A.11 Orthogonal outcome axes contract | `DONE` | `src/outcome-axes.ts` 11 eksen + `validateRunOutcomeAxes` B.8 invariants; 7 test |
| 4A.12 REMOTE_ACTION / EXTERNAL_ACTION primitive | `DONE` | `src/remote-action.ts` + validator; transport field yasağı; 8 test |
| 4A.13 Golden fixtures + domain-neutral leakage guard | `DONE` | 8 fixture + `src/domain-leakage.ts`; export surface scan 0 hit; 6 test |
| 4A.14 Verification/result/handoff | `DONE` | §7 komut çıktıları |

## 5. Baseline envanteri (4A.2)

| Soru | Bulgu |
|---|---|
| Mevcut IR version/step union | `apps/api/src/services/workflow-ir.ts` (204 satır) versiyonsuz. `IRStep` = `macro` / `resolved-condition` / `runtime-condition` / `ui-condition`. Step union yok, node `type` serbest string. |
| Maestro/YAML bağı | `buildWorkflowIR` çıktısını `yaml-generator.generateWorkflowWorkspace` tüketiyor; `maestro-executor.ts` koşturuyor. IR bugün tek başına executable değil. |
| Oracle sonucu hangi eksenleri karıştırıyor | `oracle-engine.ts` (655 satır) tek `workflowStepResult.status` (`success`/`failed`/`running`) yazıyor. "UI geçti ama business event gelmedi" durumu `failed` + prose `errorMessage` olarak sıkışıyor — sorgulanamaz. Cleanup/scheduler/termination ekseni hiç yok. |
| Continue Gate / Final Oracle ayrımı | Yok. Tek `NodeCompletionPolicy.required: OracleKind[]` var; readiness ile nihai business validation aynı alanda. |
| Paralel role/timing listeleri | `DEFAULT_COMPLETION_POLICIES` içinde 13 node type için `required[]`; obligation/timing ayrımı yok. |
| Legacy migration noktası | Editor graph (`nodes`/`edges` + `sourceHandle`) tek giriş; migration seam'i graph walk seviyesinde kurulabilir. |
| Web aynı contract'ı tüketiyor mu | **Hayır.** Web tarafı `apps/web/src/app/(automation-editor)/automation/[id]/` altında kendi node/config tiplerini taşıyordu; API ile paylaşılan workflow tipi yoktu. Phase 4A bu seam'i açtı. |

## 6. Changed files

| Path | Değişim | Neden |
|---|---|---|
| `packages/workflow-contract/package.json` | NEW | Shared contract paketi metadata |
| `packages/workflow-contract/tsconfig.json` | NEW | `../typescript-config/node.json` |
| `packages/workflow-contract/eslint.config.js` | NEW | Repo lint konvansiyonu |
| `packages/workflow-contract/vitest.config.ts` | NEW | `src/**/*.test.ts` |
| `packages/workflow-contract/src/index.ts` | NEW | Export surface + 3 yasak |
| `packages/workflow-contract/src/ir-v2.ts` | NEW | IR v2 root schema + 14 step kind (4A.4, 4A.7) |
| `packages/workflow-contract/src/validate.ts` | NEW | Runtime validation, 27 issue code, safe parse (4A.4) |
| `packages/workflow-contract/src/condition.ts` | NEW | Typed Condition AST + operand allowlist (4A.6) |
| `packages/workflow-contract/src/condition-evaluator.ts` | NEW | Kleene evaluator + operand snapshot + UNKNOWN policy (4A.6) |
| `packages/workflow-contract/src/evidence-policy.ts` | NEW | Continue Gate / Final Oracle / unified OracleRequirement (4A.8, 4A.9) |
| `packages/workflow-contract/src/correlation.ts` | NEW | Occurrence/iteration/entity/event correlation (4A.10) |
| `packages/workflow-contract/src/outcome-axes.ts` | NEW | Orthogonal outcome axes + B.8 invariants (4A.11) |
| `packages/workflow-contract/src/remote-action.ts` | NEW | Allowlisted external action primitive (4A.12) |
| `packages/workflow-contract/src/canonicalize.ts` | NEW | Canonical serialization + plan hash |
| `packages/workflow-contract/src/legacy-migration.ts` | NEW | Domain-agnostic legacy graph migration engine (4A.5) |
| `packages/workflow-contract/src/domain-leakage.ts` | NEW | Leakage guard (4A.13) |
| `packages/workflow-contract/src/index.test.ts` | NEW | 78 test, CP4A acceptance suite |
| `packages/workflow-contract/fixtures/workflow-ir-v2/*.json` | NEW (8) | Golden fixtures — ana repo içinde, CI-safe |
| `apps/api/src/services/workflow-ir-v2.ts` | NEW | Host seam + legacy node mapping tablosu (Nesy vocabulary Core'un dışında) |
| `apps/api/src/services/workflow-ir-v2.test.ts` | NEW | 9 test |
| `apps/web/src/lib/workflow-ir-v2-client.ts` | NEW | Editor seam; aynı shared paketi tüketiyor |
| `apps/web/src/lib/workflow-ir-v2-client.test.ts` | NEW | 5 test |
| `apps/api/package.json` | MOD | `@nesy/workflow-contract: workspace:*` |
| `apps/web/package.json` | MOD | `@nesy/workflow-contract: workspace:*` |
| `pnpm-lock.yaml` | MOD | Yeni workspace paketi + iki app'e link (beklenen; RUN_PLAY §7) |
| `docs/verdict/run-playbooks/phase-4a/RUN_PLAY.md` | MOD | Recovery state |
| `docs/verdict/run-playbooks/phase-4a/RESULT.md` | MOD | Bu dosya |

Dokunulmayanlar (bilinçli): `workflow-ir.ts`, `workflow-runner.ts`, `oracle-engine.ts`,
`yaml-generator.ts`, `maestro-executor.ts`, Prisma schema/migration, Cockpit UI route'ları.
IR migration additive; Maestro runner sökülmedi (RUN_PLAY §13).

### Fixture envanteri

| Fixture | Rol | Plan hash |
|---|---|---|
| `courier-generic.json` | Domain #1; `SDK_QUERY`+`FOR_EACH`+`RESOLVE_TARGET`+`BRIDGE_ACTION`+`WAIT_EVENT`+`ASSERT_FACT`+`REMOTE_ACTION`+`CLEANUP` | `sha256:19fa07a2d041a1f69ac28a028ca878f7e2ef0512582a507de6e1d1e9f705efb7` |
| `sports-content-generic.json` | Domain #2; `SWITCH`+`WAIT_ANY`+`CONDITION(BRANCH)`+`EXTERNAL_ACTION`+`ANNOTATE`+`NOOP` | `sha256:e8a7bf9414512275d47d85aa92e659bfd7ac6081318abe5a9bf3cda7f0bad1e1` |
| `minimal-valid.json` | Invalid fixture'ların temeli | `sha256:3784c386977f462ff29e45945947abd19f90e0367085b7c23a5e7fde73851e0a` |
| `invalid-fixed-wait.json` | `FIXED_WAIT_FORBIDDEN` | — |
| `invalid-unbounded-loop.json` | `UNBOUNDED_LOOP` | — |
| `invalid-parallel-oracle-lists.json` | `ORACLE_PARALLEL_LISTS` | — |
| `invalid-unsafe-retry.json` | `UNSAFE_RETRY` + `EXTERNAL_ACTION_INVALID` | — |
| `legacy-migration-input.json` | Legacy graph → v2 + source map + unsupported action | — |

## 7. Verification results

```bash
pnpm verdict:verify-master-plan
# Master plan digest OK: sha256:76024d898cb152fe4d885fb18e798cb24b6c3df31715eac546c64383ed5c2bd0

pnpm typecheck
# Tasks: 13 successful, 13 total  (0 error TS)

pnpm test
# @nesy/bridge-contract   50 passed
# @nesy/control-channels  36 passed
# @nesy/bridge-client     35 passed
# @nesy/workflow-contract 79 passed
# @nesy/web              134 passed
# @nesy/api              267 passed | 38 skipped
# Tasks: 14 successful, 14 total

pnpm --filter @nesy/workflow-contract typecheck   # exit 0
pnpm --filter @nesy/workflow-contract test        # 79 passed (79)
pnpm --filter @nesy/workflow-contract lint        # 0 error, 0 warning
pnpm --filter @nesy/workflow-contract build       # exit 0

git diff --check          # clean
git diff --cached --check  # clean
```

Baseline karşılaştırması: API 258 → 267 test (+9), Web 129 → 134 (+5), yeni paket +79.
Toplam +93 test; hiçbir mevcut test gevşetilmedi, `.skip`/`.only` eklenmedi.

Yasak pattern taraması (`packages/workflow-contract/src/`): `as any`, `@ts-ignore`,
`@ts-expect-error`, `.skip(`, `.only(`, `eval(`, `new Function` — 0 gerçek kullanım
(tek eşleşme `condition.ts` başlık yorumundaki yasak açıklaması).

## 8. Acceptance checklist

| Criteria | Status | Evidence |
|---|---|---|
| 1. API ve Web aynı shared workflow type paketini kullanıyor | `PASS` | Her iki `package.json`'da `@nesy/workflow-contract`; `apps/api/src/services/workflow-ir-v2.ts` + `apps/web/src/lib/workflow-ir-v2-client.ts` aynı paketten import ediyor; web testi import'u assert ediyor |
| 2. IR v2 schema/version/migration suite yeşil | `PASS` | 78 + 9 + 5 test |
| 3. Runtime validation unknown/invalid schema'yı fail-fast ediyor | `PASS` | 27 issue code; `UNSUPPORTED_SCHEMA_VERSION`, `UNKNOWN_STEP_KIND`, `DUPLICATE_STEP_ID`, `MISSING_STEP_REFERENCE`, `UNREACHABLE_STEP`, `INVALID_TIMEOUT` testleri; `parseWorkflowIrV2` hostile input'ta throw etmiyor |
| 4. Deterministic canonical serialization/hash yeşil | `PASS` | Deep key-reverse aynı hash; içerik değişince hash değişiyor; `undefined` düşüyor, `null` kalıyor; non-finite sayı reddediliyor |
| 5. Condition Engine `eval`/Function kullanmıyor | `PASS` | Kaynak dosya taraması testi (`condition-evaluator.ts` gövdesinde `eval(`/`new Function` yok) |
| 6. Condition sonucu `TRUE/FALSE/UNKNOWN`; UNKNOWN policy'siz ilerleme yok | `PASS` | Kleene tablosu testi (`UNKNOWN and FALSE = FALSE`, `UNKNOWN and TRUE = UNKNOWN`, `UNKNOWN or TRUE = TRUE`, `not UNKNOWN = UNKNOWN`); `unknownPolicy` her CONDITION/SWITCH/ASSERT_FACT'te zorunlu (`INVALID_UNKNOWN_POLICY`); `BRANCH` + `onUnknown` yoksa `MISSING_UNKNOWN_BRANCH` |
| 7. Condition kararları operand snapshot DTO'su üretiyor | `PASS` | `OperandSnapshot` (source/path/value/unresolvedReason/origin/observedAtMs) + `shortCircuited` + `trace`; throwing resolver `NOT_OBSERVED` üretiyor, crash değil |
| 8. `FOR_EACH` bounded ve occurrence/iteration scope deterministic | `PASS` | `maxIterations` default'suz zorunlu (`UNBOUNDED_LOOP`); `emptyPolicy` explicit; `deriveOccurrenceId` + nested `iterationPath` deterministic testi |
| 9. `SWITCH` branch/default/coverage validation taşıyor | `PASS` | `default` zorunlu (`MISSING_SWITCH_DEFAULT`), duplicate branchId reddi (`OVERLAPPING_BRANCHES`), `overlapAudited` metadata |
| 10. `WAIT_EVENT` event-driven readiness contract'ı taşıyor; fixed sleep yok | `PASS` | Step kind union'da SLEEP/DELAY/PAUSE yok; `sleepMs`/`waitMs`/`delayMs`/`pauseMs` field'ları `FIXED_WAIT_FORBIDDEN`; fact'siz Continue Gate de reddediliyor |
| 11. Continue Gate ve Final Oracle ayrı typed policy | `PASS` | `WorkflowStepBase.continueGate: EvidencePolicy` ve `.finalOraclePolicy: FinalOraclePolicy` yapısal olarak ayrı; gate'te obligation vocabulary yok (test); gate'te `BRANCH` policy reddediliyor |
| 12. Final Oracle unified `OracleRequirement`; role/timing paralel listeleri yok | `PASS` | `required`/`eventual`/`warning`/`optional` alanları `ORACLE_PARALLEL_LISTS` ile reddediliyor; aynı fact iki requirement'ta `ORACLE_DUPLICATE_FACT`; `migrateLegacyOracleLists` ambiguity'de fail-fast |
| 13. Outcome axes ayrı; cleanup failure product verdict'i overwrite etmiyor | `PASS` | 11 ayrı eksen; `PASS_ONLINE` + `cleanup FAILED` + `NEEDS_ATTENTION` geçerli tuple (B.8.2); `WORKER_LOST` → `FAIL_PRODUCT` reddi; `EVIDENCE_INSUFFICIENT` → `INCONCLUSIVE` ayrımı; `CANCELLED` + passing verdict reddi |
| 14. Occurrence/entity/request/event/treeGen correlation contract mevcut | `PASS` | `OccurrenceCorrelation` 10 alan; `correlationMatches` stale iteration/entity/seq'i reddediyor |
| 15. `REMOTE_ACTION` / `EXTERNAL_ACTION` domain-neutral allowlisted adapter primitive | `PASS` | `adapterRef`/`operationRef` + 13 alan; `url`/`endpoint`/`method`/`headers`/`body`/`host`/`path`/`script`/`query` field'ları `EXTERNAL_ACTION_INVALID` |
| 16. Non-idempotent external action unsafe retry ile validate edilemiyor | `PASS` | `UNSAFE_RETRY` (non-idempotent + keyed değil, ve `UNKNOWN` effect); step-level `retryPolicy` için de aynı kural |
| 17. Setup remote action ürün PASS'i üretemiyor | `PASS` | `SETUP_PRODUCES_VERDICT`; ayrıca `VALIDATION` + output fact yoksa `MISSING_OUTPUT_FACT` |
| 18. En az iki generic domain fixture aynı IR union'larıyla validate/hash ediliyor | `PASS` | `courier-generic` + `sports-content-generic`; ikisi birlikte `FOR_EACH/SWITCH/CONDITION/WAIT_EVENT/WAIT_ANY/REMOTE_ACTION/EXTERNAL_ACTION/CLEANUP` kapsıyor (test assert ediyor); farklı deterministic hash |
| 19. Shared IR package surface içinde Nesy/Maçkolik business type yok | `PASS` | 10 modülün export surface'i `scanExportSurface` ile taranıyor → 0 hit; guard precision testleri (`matchesAllowlistedPattern`, `correlationMatches`, `STOPPED` false-positive üretmiyor); `legacy-migration.ts` gövdesinde 0 hit |
| 20. Legacy workflow migration source-map üretiyor | `PASS` | Her step için `sourceMapRef` → `ref`/`sourceNodeId`/`legacyPath`; deterministic hash; unmapped node type `UNSUPPORTED_LEGACY_ACTION` (drop yok) |
| 21. Phase 4B Domain Pack implementation'ı CP4A geçmeden başlamadı | `PASS` | `packages/domain-pack-contracts` yok; App Adapter/BridgeFlowCompiler/Executor yok; Mobile repo'ya yazılmadı |
| 22. Typecheck/test green | `PASS` | §7 |

## 9. Blockers

| ID | Severity | Description | Owner | Action |
|---|---|---|---|---|
| B-17 | LOW / FLAKE | `apps/api/src/services/verdict-durable-runtime.test.ts > waitEvent TIMEOUT when the event never arrives` tam suite'in bir koşusunda `CANCELLED` döndü (beklenen `TIMEOUT`). İzole 3/3 ve tam suite 3/3 yeşil. Phase 4A değişikliğiyle ilgisiz (timeout/cancel yarışı), yük altında intermittent. | Verdict runtime owner | Timeout-vs-cancel yarışını deterministik hale getirmek; blocking değil. |

Devralınan CP3-DUT / B-12 / B-13 / B-14 / B-8 durumları §3'te.

## 10. Skipped / deferred work

Bilinçli olarak yapılmadı (RUN_PLAY §6 kapsam dışı):

- `packages/domain-pack-contracts` ve Nesy/Maçkolik Domain Pack implementation.
- Nesy App Adapter, Mobile `automationRelease` refactor.
- BridgeFlowCompiler / BridgeFlowExecutor.
- Cockpit UI route cutover, Maestro sökümü.
- Final Oracle runtime evaluator'ın production persistence entegrasyonu
  (contract var, evaluator runtime'ı Phase 5).
- Test Campaign queue / lease-scheduler / Test Data Broker.
- Prisma migration: yeni typed contract persisted read modeli gerektirmediği için
  DB'ye dokunulmadı (RUN_PLAY §7).

Kapsam içinde ama bilinçli sınırlanan:

- Legacy migration bir **skeleton** üreticisi. Node başına Maestro komut dizisi
  çevrilmiyor; bu 4C BridgeFlowCompiler işi. Fonksiyon adı
  `migrateLegacyGraphToIrV2Skeleton` bunu çağıran tarafa açıkça söylüyor —
  runnable plan sanılırsa hiçbir şey yapmayıp yeşil raporlardı.
- `apps/api` legacy node mapping tablosu 15 mevcut node type'ı kapsıyor;
  domain vocabulary bilinçli olarak Core paketinin **dışında**.

## 11. Design notes (Phase 4B'nin bilmesi gerekenler)

1. **Domain seam nerede:** business dili yalnız opaque ref'lerde taşınır —
   `factKey`, `queryRef`, `targetRef`, `adapterRef`, `operationRef`,
   `entityRef.type`. Leakage guard bunları **bilinçli olarak taramaz**; Core
   identifier'larını (variable name, capability id, bridge verb) tarar. Bu ayrım
   guard'ın içeriğidir: her şeyi taramak ya anlamsız fixture ya devre dışı test
   üretirdi.
2. **Leakage guard katılığı:** `STOP`/`MATCH`/`STOPS`/`TOURS` segment bazlı
   eşleşir (`openStop`, `OPEN_STOP`, `open-stop`, `stop.count` → ihlal;
   `STOPPED`, `matchesAllowlistedPattern`, `mismatch` → temiz). Core identifier'ı
   kendi segmenti olarak `stop` istiyorsa başka kelime seçmek zorunda.
3. **B-13 modeli:** capability `optional: false` ise ve target'ta yoksa
   `UNSUPPORTED_CAPABILITY`. Domain Pack `wait_any`/`cancel_request` isterse
   `optional: true` + `fallback` beyan etmeli.
4. **Cleanup asla verdict yazmaz.** `WorkflowCleanupResult` ayrı eksen;
   `validateRunOutcomeAxes` B.8.2'yi zorluyor.
5. **`ANNOTATE`/`NOOP` neden var:** her branch'in beyan edilmiş bir hedefi olsun.
   Hedefsiz branch sessizce atlanır ve raporda başarı gibi okunur.

## 12. Phase 4B readiness decision

```text
phase4BReadiness: READY_WITH_EXTERNAL_BLOCKERS
```

Gerekçe:

- CP4A acceptance checklist'inin 22/22 maddesi gerçek kanıtla geçti; contract
  donduruldu, Domain Pack artık tüketici olarak yazılabilir.
- Devralınan CP3-DUT ve B-12 external/device-side; Domain Pack contract işini
  bloklamıyor. Phase 5 executor cutover öncesi CP3-DUT kapanmalı.
- B-16 post-review'da kapandı. Phase 4B artık submodule fixture commit/push
  beklemeden başlayabilir.

Bir sonraki agent için sıra:

```text
1. Ana repoda pnpm typecheck + pnpm test'i temiz checkout üzerinde doğrula.
2. Phase 4B RUN_PLAY'ini yaz; D.6B/D.6C scope'unu CP4B-Core ile sınırla.
```

## 13. Post-review B-16 fix

Review sırasında B-16 kalıcı biçimde kapatıldı.

Değişiklik:

```text
FROM: verdict-contract-fixtures/workflow-ir-v2/*.json
TO:   packages/workflow-contract/fixtures/workflow-ir-v2/*.json
```

Gerekçe: `verdict-contract-fixtures` git submodule olduğu için oraya yazılan yeni
fixture'lar ana repo commit'iyle taşınmaz. Bu durum yerelde yeşil, CI'da kırmızı
bir baseline üretirdi. Fixture'ların workflow contract paketi içinde tutulması daha
doğru sınırdır: bu fixture'lar CP4A contract acceptance'ına aittir, global external
fixture corpus'una değil.

Test path'leri güncellendi:

```text
packages/workflow-contract/src/index.test.ts
apps/web/src/lib/workflow-ir-v2-client.test.ts
```

Submodule working tree'i temizlendi; ana repo artık submodule gitlink bump veya
submodule push gerektirmez.

## 14. Post-review setup evidence contract fix

Review sırasında ikinci küçük ama önemli contract açığı kapatıldı.

Önceki validator davranışı:

```text
SETUP + outputFactBindings + READ_ONLY
→ kabul edilebiliyordu
```

Bu, planın "setup/preparation action ürün PASS'i üretemez" kuralını zayıflatırdı.
Bir hazırlık sorgusu read-only olsa bile `Final Oracle` tarafından tüketilecek
business fact üretmemelidir; aksi hâlde test, uygulamanın davranışı yerine kendi
fixture hazırlığını kanıt olarak kullanabilir.

Yeni davranış:

```text
SETUP + outputFactBindings
→ SETUP_PRODUCES_VERDICT
```

Eklenen regresyon testi:

```text
packages/workflow-contract/src/index.test.ts
→ refuses a read-only setup action that binds business evidence
```

Bu değişiklikten sonra `@nesy/workflow-contract` testi 78'den 79'a çıktı.
