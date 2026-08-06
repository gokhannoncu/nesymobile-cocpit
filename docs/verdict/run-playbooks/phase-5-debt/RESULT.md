# Phase 5 DEBT RESULT

```yaml
runPlayId: verdict-cockpit-phase-5-debt-run-play
debtOf: "5"
resultState: COMPLETED
createdAt: "2026-08-06 09:30:00 +03"
startedAt: "2026-08-06 17:54:00 +03"
completedAt: "2026-08-06 18:05:00 +03"
lastUpdatedAt: "2026-08-06 18:25:00 +03"
timezone: "Europe/Istanbul"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:76024d898cb152fe4d885fb18e798cb24b6c3df31715eac546c64383ed5c2bd0"
verifiedMasterPlanDigest: "sha256:5c7e2f6c7da582b5bc6064a6c866476a7adb8e1d4a8a065e0be5067248644771"
runPlayFile: "docs/verdict/run-playbooks/phase-5-debt/RUN_PLAY.md"
originalResult: "docs/verdict/run-playbooks/phase-5/RESULT.md"
phase6DebtReadiness: "READY"
priority: P0
```

## 1. Executive result

Phase 5 DEBT kapandı. Phase 6'nın bağlanacağı dört okuma yüzeyi HTTP'de açıldı,
compile stub açıkça işaretlendi, device-command admission dayanıklı lease
store'a taşındı. Madde 60 (`CP3-DUT`) dışarıda kaldı — diğer adımları engellemez.

```text
Kapsam: Phase 5'in Phase 6'ya söz verdiği ama açmadığı okuma API'leri
Kritik yol: EVET — phase-6-debt artık başlayabilir
Harici bağımlılık: yalnız madde 60 (CP3-DUT) — OPEN_EXTERNAL, taşındı
Compiler kararı: (B) stub kalsın + compilerKind:"STUB" + UI uyarısı
```

## 2. Recovery state

| Alan | Değer |
|---|---|
| Current debt | `phase-5-debt` |
| Current step | `5D.5` |
| Current state | `COMPLETED` |
| Last successful step | `5D.5` |
| Last attempted step | `5D.5` |
| Recovery instruction | `phase-6-debt 6D.1a'dan başla. 5D.6 / CP3-DUT dışarıda izlenir.` |

## 3. Precondition gate

| Gate | Required | Evidence |
|---|---|---|
| Phase 5 RESULT | `COMPLETED` | `PASS` |
| PostgreSQL migration | applied | `PASS` — `20260806153900_add_resource_lease_expires_at` deploy 2026-08-06 |
| Domain pack persistence | restart-safe | `PASS` — `GET /runtime/domain-packs` → `nesy-courier@2.0.0` |
| API + cockpit çalışıyor | evet | `PASS` — runtime curl + `next build` |

## 4. Kanıtlanmış boşluk (kapanış)

| Yüzey | Runtime | HTTP ucu | Not |
|---|---|---|---|
| Evidence Source Registry | `evidence-source-resolver.ts` + `list()` | `GET /runtime/evidence-sources` (+ run-scoped) | Registry boşsa `partial: true` |
| Semantic Actions | pack `registries.semanticActions` | `GET .../semantic-actions` | `capabilityStatus` her action'da |
| Target Resolution Provider Chain | pack `registries.targets` | `GET .../target-resolution` + validate | ihlalde `422` |
| Launch Profile | pack `registries.launchProfiles` | `GET .../launch-profiles` + validate | `DIRECT_STATE` release'de fail-closed |

## 5. Step execution log

| Step | Status | Evidence |
|---|---|---|
| 5D.1 EvidenceSourceQuery API | `DONE` | `EvidenceSourceQueryService` + routes; curl `partial:true` boş registry |
| 5D.1b SemanticActionQuery API | `DONE` | pack-scoped GET + `capabilityStatus`; 404 missing pack |
| 5D.2 TargetResolutionQuery API | `DONE` | pack-scoped GET + `POST .../validate` → 422 EMPTY_CHAIN |
| 5D.3 LaunchProfile API | `DONE` | pack-scoped GET + validate; DIRECT_STATE release → 422 + `blockedReason` |
| 5D.4 Stub compiler kararı | `DONE` | **Karar (B):** stub + `compilerKind:"STUB"` + `STUB_COMPILER` warning + UI banner |
| 5D.5 Admission durable lease | `DONE` | `DeviceMutationLeaseStore` + Prisma/`verdict_resource_lease` + TTL; restart testi |
| 5D.6 Madde 60 gerçek DUT | `BLOCKED_EXTERNAL` | `CP3-DUT` — yapılmadı, taşındı |

### 5D.4 karar kaydı

```text
Seçenek: (B) Stub kalsın, açıkça işaretle
Neden: CompileInput gerçek derleyici için bundle/macros/deviceCapabilities ister;
       production BFF hâlâ hash-pinned stub kullanıyor. Sessiz stub yasak.
Uygulama:
  - WorkflowCompileResult.compilerKind: "STUB" | "BRIDGEFLOW"
  - createHashPinnedCompileStub() → compilerKind:"STUB" + STUB_COMPILER WARNING
  - CompilePreviewPanel stub uyarısı gösteriyor
  - CHECKPOINT 6 madde 4 (canvas error binding) → DEFERRED_WITH_REASON
```

### 5D.5 karar kaydı — VerdictResourceLease FK düşürme

```text
Seçenek: paylaşılan verdict_resource_lease üzerinde WorkflowRun FK'yı düşür + expires_at ekle
  (ayrı tablo açmak yerine)
Neden: BridgeFlow admission runId'leri workflow_runs satırı değil; FK, lease yazımını
       imkânsız kılıyordu. Aynı sınıf sorun daha önce bridgeflow_run_runtime ile
       yaşanmış ve verdict_run_start ayrı tabloya alınmıştı.
Trade-off: tablo artık tüm tüketiciler için referans bütünlüğü taşımıyor; runId
           opaque owner id. Alternatif (VerdictDeviceMutationLease ayrı tablo)
           daha dar yüzey verirdi ama playbook mevcut tabloyu işaret etti.
Kayıt: migration 20260806153900_add_resource_lease_expires_at
```

## 5b. Bağımsız doğrulama bulguları (2026-08-06 review)

| ID | Sev | Status | Bulgu |
|---|---|---|---|
| `F1-VALIDATE-PARTIAL` | HIGH | `FIXED` | Kısmi launch profile validate → TypeError/`400` sızıyordu. Shape guard + contract `MISSING_FIELD` → yapılandırılmış `422`. Test: `returns structured MISSING_FIELD…` |
| `F2-CAPABILITY-ALWAYS-BLOCKED` | MEDIUM | `RECORDED` | `capabilityStatus` negotiation bağlı değil; `requiredCapabilityRefs` doluysa daima `satisfied:false`. Fail-closed doğru; `deviceId` parametresi henüz etkisiz. → phase-6-debt follow-up: Bridge B2 negotiation bağla |
| `F3-LEASE-FK-DROP` | MEDIUM | `RECORDED` | Yukarıdaki 5D.5 karar kaydı |
| `F4-DIGEST-DRIFT` | MEDIUM/INVENTORY | `RECORDED` | `verdict:verify-master-plan` planın iç `MasterDigest` satırıyla karşılaştırır, playbook pin'leriyle değil. Plan `76024d89`→`5c7e2f6c`; 23 playbook eski pin'de. Kapı ağaç genelinde boş kontrol. Ayrı envanter işi: pin'leri yenile veya script'i playbook pin'lerine bağla |

## 6. Changed files

| Path | Değişim | Neden |
|---|---|---|
| `apps/api/src/services/evidence-source-resolver.ts` | MODIFIED | `list()` arayüz + impl |
| `apps/api/src/services/bridgeflow-evidence-source-registry.ts` | ADDED | WS'siz registry singleton |
| `apps/api/src/services/evidence-source-query.service.ts` | ADDED | catalog + run-scoped read |
| `apps/api/src/services/domain-pack-read-models.service.ts` | ADDED | semantic/target/launch reads |
| `apps/api/src/services/device-command-admission.ts` | MODIFIED | lease store + TTL + async |
| `apps/api/src/services/workflow-compile.service.ts` | MODIFIED | `compilerKind` + stub işaretleme |
| `apps/api/src/services/phase6-prisma-stores.ts` | MODIFIED | `PrismaDeviceMutationLeaseStore` |
| `apps/api/src/services/device-readiness.service.ts` | MODIFIED | await admission.snapshot |
| `apps/api/src/services/test-event-ws-server.ts` | MODIFIED | registry re-export |
| `apps/api/src/routes/verdict-runtime.routes.ts` | MODIFIED | evidence-sources + run target-resolutions |
| `apps/api/src/routes/verdict-phase6-contracts.routes.ts` | MODIFIED | pack-scoped reads + validates |
| `apps/api/src/services/phase6-input-contracts.test.ts` | MODIFIED | DTO pin + restart + DIRECT_STATE |
| `apps/api/src/services/device-command-admission.test.ts` | MODIFIED | async + TTL |
| `apps/api/package.json` / lockfile | MODIFIED | `@nesy/domain-pack-contracts` dep |
| `packages/db/prisma/schema.prisma` | MODIFIED | `expiresAt`; drop WorkflowRun FK |
| `packages/db/prisma/migrations/20260806153900_add_resource_lease_expires_at/` | ADDED | migration SQL |
| `apps/web/src/lib/verdict-runtime/types.ts` | MODIFIED | mirror DTOs + `compilerKind` |
| `apps/web/src/lib/verdict-runtime/client.ts` | MODIFIED | fetch helpers |
| `apps/web/src/components/automation/editor/CompilePreviewPanel.tsx` | MODIFIED | stub uyarısı |
| `docs/verdict/run-playbooks/phase-5/RESULT.md` | MODIFIED | §9 madde 45 düzeltildi |
| `docs/verdict/run-playbooks/phase-5-debt/RESULT.md` | MODIFIED | bu dosya |

## 7. Verification results

| Komut | Sonuç |
|---|---|
| `pnpm verdict:verify-master-plan` | `PASS` — digest `sha256:5c7e2f6c…` (playbook pinned digest drift not blocking) |
| `pnpm --filter @nesy/api typecheck` | `PASS` |
| `pnpm --filter @nesy/web typecheck` | `PASS` |
| `pnpm --filter @nesy/api test` | `PASS` — 385 passed / 38 skipped |
| `pnpm --filter @nesy/web test` | `PASS` — 456 passed |
| `pnpm --filter @nesy/web exec next build` | `PASS` |
| Runtime uç doğrulaması | `PASS` — aşağıda |
| `prisma migrate deploy` | `PASS` — `20260806153900_add_resource_lease_expires_at` |

### Runtime curl (2026-08-06)

```text
GET  /api/verdict/runtime/evidence-sources
  → 200 { partial:true, items:[], blockedReason:"no evidence sources registered…" }

GET  /api/verdict/runtime/domain-packs/missing-pack/9.9.9/semantic-actions
  → 404 { status:"not_found" }

GET  /api/verdict/runtime/domain-packs/nesy-courier/2.0.0/semantic-actions
  → 200 { partial:true, items:[], … }  # seed pack registries boş; uydurma yok

POST /api/verdict/runtime/target-resolution/validate  (empty chain)
  → 422 { ok:false, violations:[{code:"EMPTY_CHAIN"}] }

POST /api/verdict/runtime/launch-profiles/validate  (DIRECT_STATE + releaseBuild)
  → 422 { ok:false, blockedReason:"DIRECT_STATE session preparation is blocked…" }

POST /api/verdict/runtime/compile  (pinned)
  → 200 { ok:true, compilerKind:"STUB", issues:[{code:"STUB_COMPILER"}] }
```

## 8. Acceptance checklist

| # | Madde | Status | Kanıt |
|---|---|---|---|
| 1 | `GET /runtime/evidence-sources` listeliyor | `PASS` | curl gövdesi |
| 2 | Run-scoped evidence sources conflict/freshness | `PASS` | boş run → `partial` + `conflicts:[]` |
| 2b | Semantic action listesi pack'ten | `PASS` | pack GET; seed boş → `partial` (uydurma yok) |
| 2c | Her action `capabilityStatus` | `PASS` | DTO pin testi + service |
| 2d | `notResponsibleFor` yanıtta | `PASS` | `SemanticActionApiItem` + pin test |
| 3 | Target resolution provider chain pack'ten | `PASS` | GET + pin test |
| 4 | Target resolution validate ihlalde 422 | `PASS` | curl 422 EMPTY_CHAIN |
| 5 | Launch profile listesi alanları | `PASS` | pin test (entry/cleanup/…) |
| 6 | Launch profile validate ihlalde 422 | `PASS` | curl 422 |
| 7 | `DIRECT_STATE` release'de fail-closed | `PASS` | `blockedReason` curl + unit |
| 8 | Compile stub kararı | `PASS` | §5D.4 karar (B) |
| 9 | Admission DB lease + restart | `PASS` | `keeps device mutation ownership across a new admission instance` |
| 10 | Yeni DTO anahtar kümeleri sabit | `PASS` | phase6-input-contracts.test.ts |
| 11 | Web mirror tipleri güncel | `PASS` | typecheck + client helpers |
| 12 | Phase 5 RESULT §9 madde 45 düzeltildi | `PASS` | diff |

## 9. Blockers

| ID | Sev | Status | Açıklama |
|---|---|---|---|
| `CP3-DUT` | HIGH/EXTERNAL | `OPEN_EXTERNAL` | Yalnız 5D.6; phase-3/4 debt ile izlenir |
| `STUB_COMPILER` | MEDIUM | `DEFERRED_WITH_REASON` | Gerçek BridgeFlowCompiler adapter'ı ayrı iş; UI uyarılı |
| `CAPABILITY-NEGOTIATION` | MEDIUM | `OPEN_LOCAL` | F2 — phase-6-debt'e taşındı |
| `MASTER-DIGEST-DRIFT` | MEDIUM/INVENTORY | `OPEN_LOCAL` | F4 — 23 playbook pin stale; ayrı envanter |

## 10. Readiness decision

```text
phase6DebtReadiness: READY
Reason: Evidence Source / Semantic Action / Target Resolution / Launch Profile
read APIs available; compiler decision recorded (STUB marked); admission durable
via verdict_resource_lease + TTL. CP3-DUT remains external and does not block
phase-6-debt UI binding.
```
