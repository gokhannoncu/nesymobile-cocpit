# Phase 6 DEBT RESULT

```yaml
runPlayId: verdict-cockpit-phase-6-debt-run-play
debtOf: "6"
resultState: IN_PROGRESS
createdAt: "2026-08-06 09:30:00 +03"
startedAt: "2026-08-06 19:21:00 +03"
completedAt: null
lastUpdatedAt: "2026-08-06 21:15:00 +03"
timezone: "Europe/Istanbul"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:76024d898cb152fe4d885fb18e798cb24b6c3df31715eac546c64383ed5c2bd0"
verifiedMasterPlanDigest: "sha256:5c7e2f6c7da582b5bc6064a6c866476a7adb8e1d4a8a065e0be5067248644771"
runPlayFile: "docs/verdict/run-playbooks/phase-6-debt/RUN_PLAY.md"
originalResult: "docs/verdict/run-playbooks/phase-6/RESULT.md"
dependsOn: "docs/verdict/run-playbooks/phase-5-debt/RESULT.md"
phase7Readiness: "NOT_EVALUATED"
priority: P1
```

## 1. Executive result

`IN_PROGRESS`. 6D.1a–f bağlandı. Sıradaki: 6D.2 Surface Registry manager.

```text
6D.1a–f: DONE
Sıradaki: 6D.2 Surface Registry manager (yeni sayfa)
```

## 2. Recovery state

| Alan | Değer |
|---|---|
| Current debt | `phase-6-debt` |
| Current step | `6D.2` |
| Current state | `IN_PROGRESS` |
| Last successful step | `6D.1f` |
| Recovery instruction | `6D.2'den devam: Application/Screen/Surface Registry manager sayfasını ekle.` |

## 3. Precondition gate

| Gate | Required | Current |
|---|---|---|
| `phase-5-debt` | `COMPLETED` | `PASS` — RESULT `COMPLETED`, `phase6DebtReadiness: READY` |
| Evidence Source API | available | `PASS` — `GET /runtime/evidence-sources` |
| Target Resolution API | available | `PASS` — pack-scoped + validate |
| Launch Profile API | available | `PASS` — pack-scoped + validate (kısmi girdi → `MISSING_FIELD` 422) |
| Entity Binding API | available | `PASS` — `GET …/entity-bindings` (6D.1d) |
| Semantic Action API | available | `PASS` — pack-scoped + `capabilityStatus` |
| `next build` | yeşil | `PASS` |
| Seed'li runtime | dolu | `PASS` |
| Domain Pack API | available | `PASS` |

```text
implementationStart: ALLOWED
```

## 4. Kanıtlanmış boşluk (2026-08-06)

| Komponent | API çağrısı | İçerik |
|---|---|---|
| `EvidenceSourceRegistry.tsx` | `fetchVerdictEvidenceSources` | **bağlandı** (6D.1a) |
| `TargetResolutionPanel.tsx` | `fetchVerdictTargetResolution` | **bağlandı** (6D.1b) |
| `LaunchProfileBuilder.tsx` | launch-profiles + validate | **bağlandı** (6D.1c) |
| `EntityBindingEditor.tsx` | `fetchVerdictEntityBindings` | **bağlandı** (6D.1d) |
| `SemanticActionPalette.tsx` | `fetchVerdictSemanticActions` | **bağlandı** (6D.1e) |
| `workflow-registry.ts` (sol palet) | pack primary + legacy badge | **bağlandı** (6D.1f); Maestro subtitle temiz |
| Surface Registry manager | — | **dosya yok** |

`VerdictEditorToolbar` mount edildi; paneller hâlâ maket — 6D.1 kapsamı.

## 5. Step execution log

| Step | Status | Evidence |
|---|---|---|
| 6D.1a Evidence Source binding | `DONE` | `EvidenceSourceRegistry.tsx` → client; test `src/test/evidence-source-registry.test.ts` |
| 6D.1b Target Resolution binding | `DONE` | pack chain + violations; `target-resolution-panel.test.ts` |
| 6D.1c Launch Profile binding | `DONE` | validate + DIRECT_STATE gate; `launch-profile-builder.test.ts` |
| 6D.1d Entity Binding | `DONE` | pack entities + bindings; `entity-binding-editor.test.ts` |
| 6D.1e Semantic Action Palette (Verdict paneli) | `DONE` | pack items + capabilityStatus; `semantic-action-palette.test.ts` |
| 6D.1f Sol palet cutover (pack'ten besleme) | `DONE` | pack primary + legacy badge; `left-palette-pack-cutover.test.ts` |
| 6D.2 Surface Registry manager | `PENDING` | domain pack API mevcut |
| 6D.3 Kalan 30 CHECKPOINT maddesi | `PENDING` | — |
| 6D.4 6.30 kapanışı | `PENDING` | — |

## 6. CHECKPOINT 6 durumu (devralınan)

| Sınıf | Sayı | Not |
|---|---|---|
| `PASS` (kanıtlı) | 37 | phase-6/RESULT §9, §18 |
| `FAIL` | 7 | 20, 21, 22, 23, 24, 25 + 35'in bir kısmı |
| Yürütülmemiş | ~30 | 6D.3 kapsamı |

35 numaralı madde (`editor WorkflowCompileApi kullanıyor`) `2026-08-06`'da
`PASS`'a döndü — compile preview gerçekten API'ye gidiyor; `compilerKind:"STUB"`
uyarısı görünür (phase-5-debt 5D.4B).

## 7. Changed files

| Path | Değişim | Neden |
|---|---|---|
| `apps/web/src/components/automation/evidence/EvidenceSourceRegistry.tsx` | MODIFIED | 6D.1a runtime binding |
| `apps/web/src/test/evidence-source-registry.test.ts` | ADDED | no-mock / state / field guards |
| `apps/web/src/components/automation/editor/VerdictEditorToolbar.tsx` | MODIFIED | optional `runId` → registry |
| `apps/web/src/components/automation/evidence/TargetResolutionPanel.tsx` | MODIFIED | 6D.1b pack chain binding |
| `apps/web/src/test/target-resolution-panel.test.ts` | ADDED | no-mock / ambiguity disable |
| `apps/web/src/components/automation/editor/LaunchProfileBuilder.tsx` | MODIFIED | 6D.1c pack + validate |
| `apps/web/src/lib/verdict-runtime/client.ts` | MODIFIED | `validateVerdictLaunchProfile` |
| `apps/web/src/lib/verdict-runtime/types.ts` | MODIFIED | `LaunchProfileValidateApi` |
| `apps/web/src/test/launch-profile-builder.test.ts` | ADDED | DIRECT_STATE + field errors |
| `apps/api/src/services/domain-pack-read-models.service.ts` | MODIFIED | `listEntityBindings` |
| `apps/api/src/routes/verdict-phase6-contracts.routes.ts` | MODIFIED | `GET …/entity-bindings` |
| `apps/api/src/services/phase6-input-contracts.test.ts` | MODIFIED | entity binding DTO pin |
| `apps/web/src/components/automation/editor/EntityBindingEditor.tsx` | MODIFIED | 6D.1d pack binding |
| `apps/web/src/lib/verdict-runtime/client.ts` | MODIFIED | `fetchVerdictEntityBindings` |
| `apps/web/src/lib/verdict-runtime/types.ts` | MODIFIED | entity binding catalog types |
| `apps/web/src/test/entity-binding-editor.test.ts` | ADDED | no-mock / evidence fields |
| `apps/web/src/components/automation/editor/SemanticActionPalette.tsx` | MODIFIED | 6D.1e pack binding |
| `apps/web/src/test/semantic-action-palette.test.ts` | ADDED | no-mock / empty-pack / capability |
| `apps/web/src/app/(automation-editor)/automation/[id]/pack-palette.ts` | ADDED | pack → PaletteItem mapper |
| `apps/web/src/app/(automation-editor)/automation/[id]/workflow-editor.tsx` | MODIFIED | sol palet pack primary + legacy badge |
| `apps/web/src/app/(automation-editor)/automation/[id]/workflow-registry.ts` | MODIFIED | Maestro subtitle strip; SEMANTIC_ACTION |
| `apps/web/src/app/(automation-editor)/automation/[id]/workflow-types.ts` | MODIFIED | SEMANTIC_ACTION + palette metadata |
| `apps/web/src/app/(automation-editor)/automation/[id]/workflow-node-config.ts` | MODIFIED | SEMANTIC_ACTION actionKey schema |
| `apps/web/src/lib/page-migration-manifest.ts` | MODIFIED | editor legacyCleanup + fallback |
| `apps/web/src/test/left-palette-pack-cutover.test.ts` | ADDED | 6D.1f cutover guards |
| `docs/verdict/run-playbooks/phase-6-debt/RESULT.md` | MODIFIED | bu dosya |

## 8. Verification results

| Kontrol | Sonuç |
|---|---|
| phase-5-debt gate | `PASS` |
| `pnpm --filter @nesy/web typecheck` | `PASS` (6D.1a sonrası) |
| `src/test/evidence-source-registry.test.ts` | `PASS` — 4 tests |
| `src/test/entity-binding-editor.test.ts` | `PASS` — 4 tests (6D.1d) |
| `src/test/semantic-action-palette.test.ts` | `PASS` — 3 tests (6D.1e) |
| `src/test/left-palette-pack-cutover.test.ts` | `PASS` — 4 tests (6D.1f) |
| Panel network kanıtı | `PARTIAL` — client wired; live Network tab henüz kaydedilmedi |
| Surface Registry rotası | `NOT_RUN` |
| Kalan CHECKPOINT taraması | `NOT_RUN` |

## 9. Acceptance checklist

| # | Madde | Status | Kanıt |
|---|---|---|---|
| 1 | Evidence Source paneli runtime'dan besleniyor | `PASS` | `evidence-source-registry.test.ts` |
| 2 | Target Resolution provider chain gerçek | `PASS` | `target-resolution-panel.test.ts` |
| 3 | Ambiguity'de aksiyon disabled | `PASS` | `ambiguityBlocksAction` + disabled button |
| 4 | Launch Profile doğrulama ihlali alan bazında | `PASS` | `groupViolationsByField` |
| 5 | `DIRECT_STATE` release'de seçilemiyor | `PASS` | option disabled + validate gated |
| 6 | Entity binding pack EntityDefinition / Binding kanıtı | `PASS` | `entity-binding-editor.test.ts` |
| 7 | Semantic Action Palette pack'ten; pack yoksa boş + gerekçe | `PASS` | `semantic-action-palette.test.ts` |
| 8 | Sol palet pack primary; capability disabled+gerekçe; legacy badge | `PASS` | `left-palette-pack-cutover.test.ts` |
| 9–14 | kalan | `PENDING` | RUN_PLAY §7 |

## 10. Blockers

| ID | Sev | Status | Açıklama |
|---|---|---|---|
| `PHASE-5-DEBT` | HIGH/LOCAL | `RESOLVED` | 2026-08-06 COMPLETED |
| `B-6-EDITOR-PANELS-UNBOUND` | HIGH/LOCAL | `RESOLVED` | 6D.1a–f pack binding + sol palet cutover |
| `CAPABILITY-NEGOTIATION` | MEDIUM/LOCAL | `OPEN_LOCAL` | phase-5-debt F2: `capabilityStatus` daima bloklu; Bridge B2 bağlanmalı |
| `MASTER-DIGEST-DRIFT` | MEDIUM/INVENTORY | `OPEN_LOCAL` | 23 playbook eski digest pinliyor; verify script playbook pin'lerine bakmıyor |
| `CP3-DUT` | HIGH/EXTERNAL | `OPEN_EXTERNAL` | 50, 52, 53, 54 ve Act Mode maddeleri |
| `B-12` | MEDIUM/EXTERNAL | `OPEN_EXTERNAL` | Device Lab remediation gösterimi |

## 11. Readiness decision

```text
phase7Readiness: NOT_EVALUATED
```

Faz 7 kapısı `resultState: COMPLETED` + `phase7Readiness: READY_WITH_EXTERNAL_BLOCKERS`
istiyor. Bu borç kapanmadan ikisi de yazılamaz. Uygulama başlangıcı: `ALLOWED`.
