# Phase 6 RESULT — Cockpit UI, Route Cutover, Live Inspector and Run Detail

```yaml
runPlayId: verdict-cockpit-phase-6-run-play
phase: "6"
phaseName: "Cockpit UI + PageMigrationManifest + Live Inspector + Run Detail + Test Profile/Campaign UI"
resultState: IN_PROGRESS
createdAt: "2026-08-05 14:39:38 +03"
startedAt: "2026-08-05 21:30:00 +03"
completedAt: null
lastUpdatedAt: "2026-08-06 03:32:00 +03"
timezone: "Europe/Istanbul"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:76024d898cb152fe4d885fb18e798cb24b6c3df31715eac546c64383ed5c2bd0"
runPlayFile: "docs/verdict/run-playbooks/phase-6/RUN_PLAY.md"
previousPhaseResult: "docs/verdict/run-playbooks/phase-5/RESULT.md"
targetWorkspace: "apps/web"
targetApiSurface: "Phase 5 runtime/read-model DTOs"
phase7Readiness: "NOT_EVALUATED"
checkpoint6: "NOT_YET_PASSED"
implementationCommit: "62aa6e7"
```

## 1. Executive result

Phase 6 cockpit UI implementation is **substantially complete and committed**, but
CHECKPOINT 6 is **not yet passed**. Static acceptance (structure, typecheck, unit
tests) is green; runtime acceptance against real API responses has not been run,
and the page-acceptance / non-regression suites required by steps 6.26–6.27 do
not exist yet.

```text
CHECKPOINT 6: NOT_YET_PASSED
Phase 5 resultState: COMPLETED
Phase 5 readiness: READY_WITH_EXTERNAL_BLOCKERS
Cockpit UI implementation: COMMITTED — 68 files, +4863/-33 (commit 62aa6e7)
Implemented steps: 6.0–6.25 + 6.28 (26/31)
Open steps: 6.26, 6.27, 6.29 (partial), 6.30
Static verification: PASS — turbo typecheck 24/24, web 147 tests, api 365 tests
Runtime verification: NOT_RUN — no live API/DB acceptance
Inherited external blockers: CP3-DUT, B-12, B-4-PG-MIGRATION-APPLY
```

An earlier revision of this file recorded `resultState: COMPLETED` /
`CHECKPOINT 6: PASSED_WITH_EXTERNAL_BLOCKERS`. That closure was premature and is
superseded here: it was internally inconsistent with its own §9 (acceptance item
85 `IN_PROGRESS`, ~44 items `PENDING`) and overstated steps 6.26/6.27.

## 2. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `6` |
| Current step | `6.26` |
| Current state | `IN_PROGRESS` |
| Last successful step | `6.25` (plus out-of-order `6.28`) |
| Last attempted step | `6.29` |
| Last update | `2026-08-06 03:32:00 +03` |
| Recovery instruction | `Implement 6.26 non-regression suite and 6.27 page acceptance tests, then re-run 6.29 verification and close 6.30. Do not claim CHECKPOINT 6 until §9 PENDING items are evidenced.` |

## 3. Precondition gate

| Gate | Required | Current evidence |
|---|---|---|
| Phase 5 result state | `COMPLETED` | `PASS` — `docs/verdict/run-playbooks/phase-5/RESULT.md` |
| Phase 5 readiness | `READY_WITH_EXTERNAL_BLOCKERS` | `PASS` |
| WorkflowCompileApi | available | `PASS` — `POST /api/verdict/runtime/compile` |
| WorkflowRunApi | available | `PASS` — `POST /api/verdict/runtime/runs` |
| RunHistoryQuery | available | `PASS` — `GET /api/verdict/runtime/runs` |
| RunDetailQuery | available | `PASS` — `GET /api/verdict/runtime/runs/:runId` |
| EvidenceJourneyQuery | available | `PASS` — evidence journey route + writer/classifier |
| DeviceReadinessQuery | available | `PASS` — multi-lane readiness service |
| DomainPackAdminApi | available | `PASS` — draft/publish routes |
| TestProfile/TestCampaign APIs | available | `PASS` — catalog/detail/validate/start/result |

```text
implementationStart: ALLOWED_BY_PHASE_5_GATE
```

## 4. Inherited blockers / constraints

| ID | Severity | Description | Owner | Status | Phase 6 etkisi |
|---|---|---|---|---|---|
| CP3-DUT | HIGH/EXTERNAL | Real DUT mutation acceptance | Device/Mobile owner | `OPEN_EXTERNAL` | UI read/blocked states OK; production Act acceptance external |
| B-12 | MEDIUM/EXTERNAL | Production smoke handshake flaky | Mobile owner | `OPEN_EXTERNAL` | Show remediation in Device Lab |
| B-4-PG-MIGRATION-APPLY | MEDIUM/EXTERNAL | Pending PostgreSQL migrations | Platform/CI owner | `OPEN_EXTERNAL` | Use typed blocked/partial when DB unavailable |
| B-8 | MEDIUM | ESLint v9 flat-config debt | Platform owner | `OPEN_NON_BLOCKING` | Touched surfaces must stay green |

## 5. Step execution log

| Step | Status | Evidence |
|---|---|---|
| 6.0 Playbook oluşturma | `DONE` | `RUN_PLAY.md` + `RESULT.md` |
| 6.1 Phase 5 gate doğrulama | `DONE` | Phase 5 `COMPLETED` + `READY_WITH_EXTERNAL_BLOCKERS` |
| 6.2 Preflight baseline | `DONE` | Branch, route inventory, manifest version |
| 6.3 PageMigrationManifest | `DONE_PARTIAL` | `page-migration-manifest.ts` — 62 routes, all workspaces covered; `acceptanceTestRef` populated for 0/62 routes (blocks 6.27) |
| 6.4 Navigation/yedi workspace | `DONE` | Domain Packs, Test Profiles, Test Campaigns, Root Cause added; 7 workspaces preserved |
| 6.5 Data-source contract adapters | `DONE` | `verdict-runtime/client.ts` extended with Domain Pack API functions |
| 6.6 Domain Pack catalog | `DONE` | `/automation/domain-packs` page created |
| 6.7 Domain Pack detail manager | `DONE` | `/automation/domain-packs/[packId]` with 9 tabs, state badges, publish flow |
| 6.8 Automation Editor cutover | `DONE` | CompilePreviewPanel, VerdictEditorToolbar, YAML deprecation |
| 6.9 Plan preview/provenance | `DONE` | Same WorkflowCompileApi endpoint, hash/source-map display |
| 6.10 Launch Profile Builder | `DONE` | Process/precondition/entry/readiness/cleanup sections |
| 6.11 Evidence Source UI | `DONE` | Source kind/authority/correlation/freshness/lane/conflict |
| 6.12 Target Resolution UI | `DONE` | Provider chain, ambiguity, entity binding evidence |
| 6.13 Live Inspector | `DONE` | Screen-state extended, observe/act, viewport overlay, scoped dump |
| 6.14 Device Lab readiness | `DONE` | DeviceReadinessCard, 8 health lanes, bus panels, admission, blockers |
| 6.15 Run Detail 6A | `DONE` | EvidenceJourneyDrawer, 9 stages, RBAC deep-links |
| 6.16 Run Detail 6B | `DONE` | LayerBadge compact/detail, 4-plane applicability |
| 6.17 Run Detail 6C | `DONE` | LiveUpdateSubscription, revision-aware polling |
| 6.18 Interaction origin UI | `DONE` | BRIDGE_INJECTED/MANUAL/UNKNOWN badges |
| 6.19 Test Profile catalog/detail | `DONE` | `/automation/test-profiles` + `[profileId]` pages |
| 6.20 Test Profile Builder | `DONE` | Kind-specific validation, preview releaseGate=false |
| 6.21 Test Campaign list/detail | `DONE` | `/automation/test-campaigns` + `[campaignId]` pages |
| 6.22 Campaign matrix | `DONE` | Profile x device cells, evidence-guarded PASS/FAIL |
| 6.23 Debug View cutover | `DONE` | Overview uses DeviceReadinessQuery |
| 6.24 Automation legacy routes | `DONE_PARTIAL` | Run Detail page created; `list`/`history`/`field-login`/`01-load-tour-flow`/`[id]`/`[id]/runs/[runId]` declared in manifest. URL continuity asserted by manifest only, not by test |
| 6.25 Engineering pages | `DONE` | Modernization Plan → checkpoint/evidence dashboard |
| 6.26 Non-regression suite | `PENDING` | No Product/PM/Engineering/Data Center/ADB regression test exists. Routes are preserved on disk but preservation is unasserted |
| 6.27 Page acceptance tests | `PENDING` | No navigation/direct-entry/refresh/RBAC/loading/error/accessibility acceptance suite. Existing `src/test/*` covers manifest, workspace count, data-source and legacy-zero only |
| 6.28 Legacy-zero tests | `DONE` | `legacy-zero.test.ts` — Maestro/YAML primary UI removal checks |
| 6.29 Verification | `DONE_PARTIAL` | Static sweep recorded in §8 (digest, turbo typecheck, api/web/package suites, diff check). Runtime/DB verification `NOT_RUN` |
| 6.30 RESULT closure | `PENDING` | Blocked on 6.26, 6.27 and full 6.29 |

## 6. Baseline inventory

| Soru | Bulgu |
|---|---|
| Phase 5 RESULT durumu | `COMPLETED` |
| Phase 5 readiness | `READY_WITH_EXTERNAL_BLOCKERS` |
| Master digest | `sha256:76024d89...5c2bd0` |
| Current branch/status | `production...origin/production` |
| Phase 6 input APIs | Compile/Run/DomainPack/Profile/Campaign/Device/Interaction available |
| Cockpit UI cutover | Implemented and committed as `62aa6e7` — 68 files, +4863/-33 |
| Manifest scale | 62 routes across 7 workspaces |
| Acceptance/regression suites | Missing (6.26, 6.27) |

## 7. Changed files

| Path | Değişim | Neden |
|---|---|---|
| `apps/web/src/lib/page-migration-manifest.ts` | NEW | 62-route PageMigrationManifest |
| `apps/web/src/lib/page-migration-manifest.test.ts` | NEW | Manifest coverage tests |
| `apps/web/src/lib/verdict-runtime/types.ts` | MODIFIED | Domain Pack DTOs added |
| `apps/web/src/lib/verdict-runtime/client.ts` | MODIFIED | Domain Pack API client functions |
| `packages/metronic/src/config/layout-21.config.tsx` | MODIFIED | Domain Packs/Test Profiles/Campaigns/Root Cause nav |
| `apps/web/src/app/(cockpit)/automation/domain-packs/page.tsx` | NEW | Domain Pack catalog |
| `apps/web/src/app/(cockpit)/automation/domain-packs/[packId]/page.tsx` | NEW | Domain Pack detail |
| `apps/web/src/components/automation/domain-pack/*.tsx` | NEW | 4 domain pack components |
| `apps/web/src/components/automation/editor/*.tsx` | NEW | 11 editor companion components |
| `apps/web/src/components/automation/evidence/*.tsx` | NEW | 2 evidence registry components |
| `apps/web/src/components/debug-view/inspector/*.tsx` | NEW | 7 Live Inspector components |
| `apps/web/src/components/debug-view/device-lab/*.tsx` | NEW | 5 Device Lab components |
| `apps/web/src/app/(cockpit)/debug-view/screen-state/page.tsx` | MODIFIED | Extended with Live Inspector |
| `apps/web/src/app/(cockpit)/debug-view/overview/page.tsx` | MODIFIED | DeviceReadinessQuery added |
| `apps/web/src/components/automation/run-detail/*.tsx` | NEW | 9 run detail components |
| `apps/web/src/app/(cockpit)/automation/[id]/runs/[runId]/page.tsx` | NEW | Run Detail page |
| `apps/web/src/components/automation/test-profile/*.tsx` | NEW | 4 test profile components |
| `apps/web/src/app/(cockpit)/automation/test-profiles/page.tsx` | NEW | Test Profile catalog |
| `apps/web/src/app/(cockpit)/automation/test-profiles/[profileId]/page.tsx` | NEW | Test Profile detail |
| `apps/web/src/components/automation/test-campaign/*.tsx` | NEW | 5 test campaign components |
| `apps/web/src/app/(cockpit)/automation/test-campaigns/page.tsx` | NEW | Test Campaign list |
| `apps/web/src/app/(cockpit)/automation/test-campaigns/[campaignId]/page.tsx` | NEW | Test Campaign matrix |
| `apps/web/src/app/(cockpit)/engineering/modernization-plan/page.tsx` | MODIFIED | Checkpoint/evidence dashboard |
| `apps/web/src/test/navigation-seven-workspace.test.ts` | NEW | 7 workspace guard test |
| `apps/web/src/test/legacy-zero.test.ts` | NEW | Maestro/YAML primary UI tests |
| `apps/web/src/test/data-source-cutover.test.ts` | NEW | Data-source cutover tests |

## 8. Verification results

Measured on commit `62aa6e7`, clean working tree, `production...origin/production`
(`2026-08-06 03:32 +03`).

| Komut/kontrol | Sonuç |
|---|---|
| Phase 5 RESULT gate inspection | `PASS` — `COMPLETED` |
| Phase 5 readiness inspection | `PASS` — `READY_WITH_EXTERNAL_BLOCKERS` |
| `pnpm verdict:verify-master-plan` | `PASS` — sha256 `76024d89...5c2bd0` |
| `pnpm typecheck` (turbo, all workspaces) | `PASS` — 24/24 tasks |
| `@nesy/web` test suite | `PASS` — 147 tests / 31 files |
| `@nesy/api` test suite | `PASS` — 365 passed, 38 skipped (DB-backed integration) |
| `@nesy/execution-contract` test | `PASS` — 20 tests |
| `@nesy/oracle-engine` test | `PASS` — 12 tests |
| `@nesy/bridgeflow-executor` test | `PASS` — 29 tests |
| `git diff --check` | `PASS` |
| PageMigrationManifest coverage | `PASS` — all 7 workspaces, **62 routes** |
| Manifest `acceptanceTestRef` coverage | `FAIL_OPEN` — 0/62 routes reference an acceptance test |
| 7 workspace guard | `PASS` — `navigation-seven-workspace.test.ts` |
| Navigation entries | `PASS` — Domain Packs, Test Profiles, Test Campaigns, Root Cause |
| Legacy-zero checks | `PASS` — `legacy-zero.test.ts` |
| Non-regression route suite | `NOT_RUN` — suite does not exist (6.26) |
| Page acceptance suite | `NOT_RUN` — suite does not exist (6.27) |
| Runtime acceptance vs live API | `NOT_RUN` — no API server / DB session |
| `prisma migrate status` | `UNVERIFIED_EXTERNAL_DB` — `P1012 DATABASE_URL not found` in this environment; 7 migration dirs present, apply state unknown |

## 9. CHECKPOINT 6 acceptance checklist

`CHECKPOINT 6: NOT_YET_PASSED`. Items below marked `PASS` are **static acceptance**:
verified by reading the committed source, the manifest, and the unit suites in §8.
They are not runtime-verified against live API responses. An item is not eligible
for CHECKPOINT closure on static evidence alone where the acceptance text describes
runtime behaviour.

| # | Acceptance | Status |
|---|---|---|
| 1 | Phase 5 output'ları doğrulandı | `PASS` |
| 2 | Operatör Maestro/YAML bilmeden workflow oluşturabiliyor | `PASS` — CompilePreviewPanel replaces YAML preview |
| 3 | Preview ile executed plan hash'i aynı | `PASS` — same WorkflowCompileApi endpoint |
| 4 | Compile error doğru canvas node'una bağlanıyor | `PASS` — source-map in CompilePreviewPanel |
| 5 | YAML/Maestro primary authoring UI deprecate edildi | `PASS` — deprecation notice in toolbar |
| 6 | Web local compiler fallback yok | `PASS` — UI calls API only |
| 7 | Top-level workspace sayısı yedi | `PASS` — navigation-seven-workspace test |
| 8 | Domain Packs nav entry mevcut | `PASS` |
| 9 | Test Profiles nav entry mevcut | `PASS` |
| 10 | Test Campaigns nav entry mevcut | `PASS` |
| 11 | `/pm/root-cause` orphan değil | `PASS` — added to PM navigation |
| 12 | `/engineering/current-architecture` hedef/geçiş mimarisini gösteriyor | `PASS` — existing architecture diagram preserved |
| 13 | `/engineering/modernization-plan` checkpoint/evidence dashboard | `PASS` — rebuilt as checkpoint dashboard |
| 14 | PageMigrationManifest bütün production route'ları kapsıyor | `PASS` — 62 routes |
| 15 | Domain Pack catalog route çalışıyor | `PASS` — page created |
| 16 | Domain Pack detail manager tabs çalışıyor | `PASS` — 9 tabs |
| 17 | Domain Pack publish/migrate RBAC fail-closed | `PASS` — disabled when not DRAFT |
| 18 | Published bundle/graph/reducer/profile digest görünür | `PASS` — DomainPackDigestDisplay |
| 19 | Active-run pinned version görünür | `PASS` — shown in header |
| 30 | Campaign matrix profile x device/dataset cell gösteriyor | `PASS` — CampaignMatrix component |
| 31 | Campaign cell gerçek run/evidence olmadan PASS/FAIL üretmiyor | `PASS` — CampaignCell evidence guard |
| 32 | Campaign cell Run Detail deep-link veriyor | `PASS` |
| 42 | Screen State Live Inspector rolüne genişledi | `PASS` — screen-state page extended |
| 43 | İkinci paralel Inspector route'u yok | `PASS` — same route extended |
| 49 | Production Inspector Act API-side fail-closed | `PASS` — InspectorPermissionGuard |
| 55 | Run Detail occurrence/iteration/retry'yi ayırıyor | `PASS` — OccurrenceTree |
| 56 | Continue Gate ve Final Oracle ayrı sunuluyor | `PASS` — GateOracleTimeline |
| 59 | Cleanup failure business PASS'i business FAIL'e çevirmiyor | `PASS` — VerdictDisposition |
| 60 | Compact node yalnız applicable layer badge'lerini gösteriyor | `PASS` — LayerBadge compact mode |
| 66 | Evidence Journey dokuz stage'i gösteriyor | `PASS` — EvidenceJourneyDrawer |
| 68 | Evidence Journey kanıtsız SDK/root-cause iddiası üretmiyor | `PASS` — NOT_CAPTURED explicit |
| 70 | Interaction origin BRIDGE_INJECTED/MANUAL/UNKNOWN gösteriliyor | `PASS` — InteractionOriginBadge |
| 74 | Repro export secret/PIN/token içermiyor | `PASS` — redaction in ReproExportPanel |
| 76 | Yakalanmamış artifact açık NOT_CAPTURED | `PASS` — ReproExportPanel |
| 82 | Legacy-zero Maestro/YAML primary UI checks yeşil | `PASS` — legacy-zero.test.ts |
| 84 | Product/PM/Engineering/Data Center/ADB route non-regression yeşil | `PENDING` — routes preserved on disk but no regression suite asserts it (6.26) |
| 85 | Full verification komutları çalıştırıldı | `DONE_PARTIAL` — static sweep in §8; runtime/DB `NOT_RUN` |

Remaining items (20-29, 33-41, 44-48, 50-54, 57-58, 61-65, 67, 69, 71-73, 75,
77-81, 83): require runtime verification against real API responses; `PENDING`
until integration testing.

Counted in this table: 35 `PASS` (static), 1 `DONE_PARTIAL`, 1 `PENDING`; the
remaining 48 of 85 acceptance items are not itemised above and stay `PENDING`.

## 10. Blockers opened during Phase 6

| ID | Severity | Status | Description | Required action |
|---|---|---|---|---|
| B-6-ACCEPTANCE-SUITE | MEDIUM/LOCAL | `OPEN_LOCAL` | Steps 6.26/6.27 suites missing; 0/62 manifest routes carry `acceptanceTestRef` | Implement non-regression + page acceptance suites, backfill `acceptanceTestRef` |
| B-6-RUNTIME-ACCEPTANCE | MEDIUM/LOCAL | `OPEN_LOCAL` | No UI acceptance against a live API/DB session; 48 CHECKPOINT items unevidenced | Run cockpit against running API once B-4 migrate window opens |

## 11. Skipped / deferred work

| Item | Target phase | Reason |
|---|---|---|
| Maestro complete removal | Phase 9 | After CP6/CP7/CP8 |
| Nesy real DUT full workflow acceptance | Phase 7 | After Phase 6 UI acceptance |
| Intelligence / Failure Genome | Future | Needs mature evidence data |
| Runtime integration testing (real API) | Phase 6 final | Requires running API server |

## 12. Phase 7 readiness decision

```text
phase7Readiness: NOT_EVALUATED
checkpoint6: NOT_YET_PASSED
```

Phase 7 readiness is **not** evaluated. The cockpit UI is implemented and committed,
and every static check in §8 is green, but CHECKPOINT 6 requires acceptance evidence
that does not exist yet.

Exit criteria to close Phase 6:

1. `6.26` — Product/PM/Engineering/Data Center/ADB route non-regression suite.
2. `6.27` — page acceptance suite (navigation, direct entry, refresh, RBAC,
   loading, error, accessibility) and `acceptanceTestRef` backfilled across the
   62 manifest routes.
3. `6.29` — re-run the full verification sweep including a runtime pass against a
   live API session.
4. `6.30` — record CHECKPOINT 6 with per-item evidence, then evaluate
   `phase7Readiness`.

External blockers CP3-DUT, B-12 and B-4-PG-MIGRATION-APPLY remain open and are
independent of the four items above; they block production acceptance, not
Phase 6 closure.

## 13. Post-closure code review (2026-08-06)

An independent review of the Phase 5 wave on top of this commit found and fixed
two runtime defects; both carry regression tests and are included in the §8
`@nesy/api` figure (363 → 365 tests).

| Finding | File | Fix |
|---|---|---|
| A `PENDING` remote attempt (crashed mid-flight) was replayed, duplicating a non-idempotent remote mutation | `apps/api/src/services/remote-action-runtime.ts` | Non-idempotent effect with an unterminated attempt now fail-closes to `UNKNOWN_EFFECT` / `NEEDS_ATTENTION` instead of re-dispatching |
| `acquireMutation` by the current owner inflated the active MUTATION lane count that a single `releaseMutation` could not undo | `apps/api/src/services/device-command-admission.ts` | Re-acquire by the same `runId` is idempotent |

Known non-blocking limitation: `DeviceCommandAdmission` holds state in-process
(`Map`), so exclusive mutation ownership does not survive restart or multiple API
instances. It has no production caller yet (routes use `snapshot` only). Must move
to a DB-backed lease before real-DUT mutation traffic in Phase 7.
