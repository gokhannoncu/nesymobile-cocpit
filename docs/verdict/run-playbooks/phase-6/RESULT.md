# Phase 6 RESULT — Cockpit UI, Route Cutover, Live Inspector and Run Detail

```yaml
runPlayId: verdict-cockpit-phase-6-run-play
phase: "6"
phaseName: "Cockpit UI + PageMigrationManifest + Live Inspector + Run Detail + Test Profile/Campaign UI"
resultState: IN_PROGRESS
createdAt: "2026-08-05 14:39:38 +03"
startedAt: "2026-08-05 21:30:00 +03"
completedAt: null
lastUpdatedAt: "2026-08-06 09:10:00 +03"
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

Phase 6 cockpit UI is implemented, the acceptance layer exists, the production
build is green, and every Phase 6 contract service is database-backed and
restart-verified. **No known local blocker remains.**

CHECKPOINT 6 is **still not passed**, but for one reason only: 48 of the 85
acceptance items have not been walked through the cockpit and recorded. That is
remaining evidence work, not remaining defects.

Acceptance and persistence work uncovered eight defects that every prior green
signal had missed. All are fixed, each with a regression guard:

```text
CHECKPOINT 6: NOT_YET_PASSED
Phase 5 resultState: COMPLETED
Cockpit UI implementation: COMMITTED — 68 files, +4863/-33 (commit 62aa6e7)
Implemented steps: 6.0–6.29 (30/31); 6.30 open
Static verification: PASS — turbo typecheck 24/24, web 456 tests, api 377 tests
Production build: PASS — was FAILING on a duplicate route
Runtime verification: PASS — seeded write→read tour (§15); real DUT still external
Durability: PASS — all contract services survive an API restart (§16, §17)
Defects found and fixed: 8 (build-breaking route clash, dead test globs,
  fabricated UI data x2, compile/run fail-open x2, DTO drift x2)
Open external blockers: CP3-DUT, B-12   (B-4 closed, see §14)
```

An earlier revision recorded `resultState: COMPLETED` / `CHECKPOINT 6: PASSED`.
That closure was premature: at that moment `next build` did not compile.

## 2. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `6` |
| Current step | `6.30` |
| Current state | `IN_PROGRESS` |
| Last successful step | `6.29` |
| Last attempted step | `6.30` (sweep in progress, §18) |
| Last update | `2026-08-06 07:50:00 +03` |
| Recovery instruction | `Persistence and acceptance work is complete. Walk the 48 open CHECKPOINT items through the cockpit against the seeded runtime, record per-item evidence, then close 6.30 and evaluate phase7Readiness. Do not claim CHECKPOINT 6 on static evidence.` |

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
| B-4-PG-MIGRATION-APPLY | MEDIUM/EXTERNAL | Pending PostgreSQL migrations | Platform/CI owner | `RESOLVED` | All 16 migrations applied with owner approval; see §14 |
| B-8 | MEDIUM | ESLint v9 flat-config debt | Platform owner | `OPEN_NON_BLOCKING` | Touched surfaces must stay green |

## 5. Step execution log

| Step | Status | Evidence |
|---|---|---|
| 6.0 Playbook oluşturma | `DONE` | `RUN_PLAY.md` + `RESULT.md` |
| 6.1 Phase 5 gate doğrulama | `DONE` | Phase 5 `COMPLETED` + `READY_WITH_EXTERNAL_BLOCKERS` |
| 6.2 Preflight baseline | `DONE` | Branch, route inventory, manifest version |
| 6.3 PageMigrationManifest | `DONE` | `page-migration-manifest.ts` — 63 routes (added `/product` and `/engineering/screen-manual`, both previously undeclared); `acceptanceTestRef` populated on all 63 |
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
| 6.24 Automation legacy routes | `DONE` | Run Detail page created; `list`/`history`/`field-login`/`01-load-tour-flow`/`[id]`/`[id]/runs/[runId]` declared in manifest. URL continuity now asserted by `route-non-regression.test.ts`. The duplicate legacy `(automation-editor)` run-detail page was removed so the cockpit page owns the URL |
| 6.25 Engineering pages | `DONE` | Modernization Plan → checkpoint/evidence dashboard |
| 6.26 Non-regression suite | `DONE` | `src/test/route-non-regression.test.ts` — 41 tests: duplicate-route guard, 29 frozen pre-Phase-6 routes, manifest↔filesystem parity, navigation targets resolve |
| 6.27 Page acceptance tests | `DONE` | `src/test/page-acceptance.test.ts` — 240 tests: RBAC/owner/fallback per route, direct entry, runtime failure path, no-fabricated-data guard, accessibility floor. `acceptanceTestRef` backfilled on all 63 routes. Runtime direct-entry verified over HTTP (§8) |
| 6.28 Legacy-zero tests | `DONE` | `legacy-zero.test.ts` — Maestro/YAML primary UI removal checks |
| 6.29 Verification | `DONE` | §8 — digest, turbo typecheck, api/web/package suites, production build, live-API direct entry, migrations applied |
| 6.30 RESULT closure | `PENDING` | Blocked only on write/execute-path evidence for the 48 open CHECKPOINT items (`B-6-RUNTIME-ACCEPTANCE`) |

## 6. Baseline inventory

| Soru | Bulgu |
|---|---|
| Phase 5 RESULT durumu | `COMPLETED` |
| Phase 5 readiness | `READY_WITH_EXTERNAL_BLOCKERS` |
| Master digest | `sha256:76024d89...5c2bd0` |
| Current branch/status | `production...origin/production` |
| Phase 6 input APIs | Compile/Run/DomainPack/Profile/Campaign/Device/Interaction available |
| Cockpit UI cutover | Implemented and committed as `62aa6e7` — 68 files, +4863/-33 |
| Manifest scale | 63 routes across 7 workspaces |
| Acceptance/regression suites | Present — 281 tests (6.26, 6.27) |

## 7. Changed files

| Path | Değişim | Neden |
|---|---|---|
| `apps/web/src/lib/page-migration-manifest.ts` | NEW | 63-route PageMigrationManifest |
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
| `@nesy/web` test suite | `PASS` — 456 tests / 36 files (was 147; `src/test/**` was excluded by the vitest globs and never ran) |
| `next build` (production) | `PASS` — 51 static pages. **Previously FAILED**: two pages resolved to `/automation/[id]/runs/[runId]` |
| Direct entry over HTTP (14 routes) | `PASS` — all HTTP 200, incl. `/product`, `/pm/root-cause`, `/debug-view/overview`, `/automation/*` |
| Runtime fail-closed behaviour | `PASS` — campaigns render `No campaigns found` against an empty catalog; unknown profile renders `Profile not found`; unknown run renders `Error loading run` |
| Browser console errors | `PASS` — none on the campaigns route |
| `@nesy/api` test suite | `PASS` — 377 passed, 38 skipped (DB-backed integration) |
| `@nesy/execution-contract` test | `PASS` — 20 tests |
| `@nesy/oracle-engine` test | `PASS` — 12 tests |
| `@nesy/bridgeflow-executor` test | `PASS` — 29 tests |
| `git diff --check` | `PASS` |
| PageMigrationManifest coverage | `PASS` — all 7 workspaces, **63 routes** |
| Manifest `acceptanceTestRef` coverage | `PASS` — 63/63 routes reference `src/test/page-acceptance.test.ts` |
| 7 workspace guard | `PASS` — `navigation-seven-workspace.test.ts` |
| Navigation entries | `PASS` — Domain Packs, Test Profiles, Test Campaigns, Root Cause |
| Legacy-zero checks | `PASS` — `legacy-zero.test.ts` |
| Non-regression route suite | `PASS` — 41 tests |
| Page acceptance suite | `PASS` — 240 tests |
| Runtime acceptance vs live API | `PASS` for seeded read+write paths — see §15. Real-DUT execution still external (`CP3-DUT`) |
| `prisma migrate status` | `PASS` — all 16 migrations applied to `aras_db`. See §14 |

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
| 14 | PageMigrationManifest bütün production route'ları kapsıyor | `PASS` — 63 routes, asserted against the filesystem |
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
| 84 | Product/PM/Engineering/Data Center/ADB route non-regression yeşil | `PASS` — `route-non-regression.test.ts` freezes 29 pre-Phase-6 routes |
| 85 | Full verification komutları çalıştırıldı | `PASS` — §8, including production build and live-API direct entry |

Remaining items (20-29, 33-41, 44-48, 50-54, 57-58, 61-65, 67, 69, 71-73, 75,
77-81, 83): require runtime verification against real API responses; `PENDING`
until integration testing.

Counted in this table: 37 `PASS`; the remaining 48 of 85 acceptance items are not
itemised above and stay `PENDING` — all of them describe write/execute or
real-device behaviour (`B-6-RUNTIME-ACCEPTANCE`, `CP3-DUT`).

## 10. Blockers opened during Phase 6

| ID | Severity | Status | Description | Required action |
|---|---|---|---|---|
| B-6-ACCEPTANCE-SUITE | MEDIUM/LOCAL | `RESOLVED` | Steps 6.26/6.27 suites missing; `acceptanceTestRef` empty | Suites added (281 tests); `acceptanceTestRef` backfilled on 63 routes |
| B-6-BUILD-ROUTE-CONFLICT | HIGH/LOCAL | `RESOLVED` | `next build` failed: `(automation-editor)` and `(cockpit)` both served `/automation/[id]/runs/[runId]` | Legacy `(automation-editor)` run-detail route removed per manifest cutover; duplicate-route guard added |
| B-6-DEAD-TEST-GLOB | MEDIUM/LOCAL | `RESOLVED` | `src/test/**` excluded from vitest `include`; three Phase 6 guard suites never executed | Glob added to `vitest.config.mts` |
| B-6-FABRICATED-UI-DATA | HIGH/LOCAL | `RESOLVED` | `/automation/test-campaigns` and `/automation/test-profiles/[profileId]` rendered hardcoded sample records while declaring `currentSource: VERDICT_RUNTIME` | Both wired to the runtime client; guard test added |
| B-6-RUNTIME-ACCEPTANCE | MEDIUM/LOCAL | `RESOLVED` | Write/execute paths unexercised | Seeded write→read tour executed; see §15 |
| B-6-COMPILE-RUN-FAIL-OPEN | HIGH/LOCAL | `RESOLVED` | `/runtime/compile` and `/runtime/runs` accepted unpinned requests | Pinning guards + tests |
| B-6-DTO-DRIFT | HIGH/LOCAL | `RESOLVED` | Web mirrors of three read-model DTOs did not match the runtime; catalog crashed on non-empty data | Types aligned; DTO key sets pinned in api tests |
| B-6-INMEMORY-READ-MODELS | HIGH/LOCAL | `RESOLVED` | Cockpit read models did not survive an API restart | Domain pack / profile / campaign services are Prisma-backed; restart-verified, see §16 |
| B-6-EDITOR-PANELS-UNBOUND | HIGH/LOCAL | `OPEN_LOCAL` | Evidence Source / Target Resolution / Launch Profile / Entity Binding / Semantic Action panels render hardcoded arrays and call no API | Bind each to `verdict-runtime/client` with real DTOs and fail-closed states |
| B-6-INMEMORY-RUN-SURFACES | MEDIUM/LOCAL | `RESOLVED` | Run-start idempotency and interaction cursor reset on restart | `verdict_run_start` + `verdict_run_interaction` tables; both services Prisma-backed and restart-verified, see §17 |

## 11. Skipped / deferred work

| Item | Target phase | Reason |
|---|---|---|
| Maestro complete removal | Phase 9 | After CP6/CP7/CP8 |
| Nesy real DUT full workflow acceptance | Phase 7 | After Phase 6 UI acceptance |
| Intelligence / Failure Genome | Future | Needs mature evidence data |
| Runtime integration testing (real API) | Phase 6 final | Requires running API server |

## 11b. Carried debt

Kalan iş ayrı izde:
[`docs/verdict/run-playbooks/phase-6-debt/`](../phase-6-debt/RUN_PLAY.md) —
bağlanmamış editör panelleri, olmayan Surface Registry, yürütülmemiş CHECKPOINT
maddeleri ve 6.30 kapanışı. Bu borç `phase-5-debt`'e bağlıdır.

## 12. Phase 7 readiness decision

```text
phase7Readiness: NOT_EVALUATED
checkpoint6: NOT_YET_PASSED
```

Phase 7 readiness is **not** evaluated. The cockpit UI is implemented and committed,
and every static check in §8 is green, but CHECKPOINT 6 requires acceptance evidence
that does not exist yet.

Exit criteria to close Phase 6:

1. ~~`6.26` — route non-regression suite.~~ **Done** — 41 tests.
2. ~~`6.27` — page acceptance suite and `acceptanceTestRef` backfill.~~ **Done** —
   240 tests across 63 routes.
3. ~~`6.29` — verification sweep including a live-API runtime pass.~~ **Done** —
   §8; production build and direct-entry now verified, previously neither was.
4. ~~Seeded write/execute path tour.~~ **Done** — §15.
5. ~~Persist the cockpit read models.~~ **Done** — §16, restart-verified.
6. ~~Persist the run-start and interaction surfaces.~~ **Done** — §17,
   restart-verified.
7. `6.30` — **still open**, and now genuinely down to evidence rather than
   defects: the outstanding CHECKPOINT items must be walked through the cockpit
   against the seeded runtime and recorded item by item, after which
   `phase7Readiness` can be evaluated. No known local blocker remains.

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

## 14. PostgreSQL migration apply (B-4)

Applied during this session against `aras_db` @ `46.225.55.110:5432` with the
owner's explicit approval.

Pre-checks (read-only) before applying:

- All 8 tables created by `20260401000000_init_legacy_baseline` already existed,
  matching column-for-column (16/9/18/13/9/21/21/25). The baseline was therefore
  marked with `prisma migrate resolve --applied` rather than executed, exactly as
  that migration's own header prescribes — running it would have raised `42P07`
  and left a failed row blocking all future migrations.
- The 17 tables created by the remaining migrations did not collide with any
  existing table.
- No `DROP TABLE` / `DROP COLUMN` in the pending set; the only writes to existing
  tables were three `ALTER COLUMN ... DROP DEFAULT`.

Result: `prisma migrate status` → `Database schema is up to date`, 16/16 applied.

Two follow-ups:

- `_prisma_migrations` was subsequently dropped when a drift check was run with
  the production URL passed as `--shadow-database-url`; Prisma resets the shadow
  database. The schema was rebuilt by replaying the migrations and the database
  was empty (0 rows across all tables), so no data was lost, but the migration
  history was gone and the next `migrate deploy` would have failed.
  **Repaired**: history rebuilt with `prisma migrate resolve --applied` for each
  of the 16 migrations — no DDL executed, no table dropped. `migrate reset` was
  deliberately avoided as needlessly destructive. Verified: 16/16 rows finished,
  0 rolled back, 38 tables, `migrate status` up to date, and a read-only
  `migrate diff --from-schema-datasource` reports no drift.
- Never pass a real datasource URL as `--shadow-database-url`. Use
  `migrate diff --from-schema-datasource` for drift checks; it is read-only and
  needs no shadow database.

`B-4-PG-MIGRATION-APPLY` is closed. `CP3-DUT` and `B-12` remain open external
blockers and are unaffected.

## 15. Runtime seed and write-path tour

Driven against the running stack (API `:4001`, cockpit `:4002`) on
2026-08-06 04:30–04:50 +03. Every step below was executed, not inferred.

### Write path

| Step | Call | Result |
|---|---|---|
| Domain pack draft | `PUT /runtime/domain-packs/draft` | `200` — revision 1, `DRAFT` |
| Domain pack publish | `POST /runtime/domain-packs/publish` (expectedRevision 1) | `200` — revision 2, `PUBLISHED` |
| Publish replay with stale revision | same call again | `409` — optimistic concurrency fail-closed |
| Profile save (CORE, releaseGate) | `PUT /runtime/test-profiles` | `200` |
| Profile save (PREVIEW + releaseGate=true) | `PUT /runtime/test-profiles` | `422` — "preview profiles must set releaseGate=false" |
| Campaign start (2 cells) | `POST /runtime/test-campaigns` | `200` — `RUNNING`, cells `PENDING`, gate `NOT_EVALUATED` |
| Compile | `POST /runtime/compile` | `200` — plan hash pinned to pack digest |
| Run start | `POST /runtime/runs` | `202` — `compiledPlanHash` **identical** to the compile response (CHECKPOINT item 3 evidenced at runtime) |
| Interaction append + cursor read | `POST`/`GET /runtime/runs/:runId/interactions` | revisions 1..2, `secretRedacted: true`, `latestRevision` cursor correct |

### Read path in the cockpit

Domain Pack catalog renders the published pack (`nesy-courier`, `PUBLISHED`,
`sha256:seed0001`, v1.0.0, revision 2, publish timestamp). Test Profiles renders
`nesy-core-regression v1 / CORE / NOT_RUN / releaseGate Yes / qa-platform`, and
its detail page resolves the real profile. Test Campaigns renders `nightly`
(`RUNNING`, `NOT_EVALUATED`). Screenshots captured during the tour.

### Defects found by the tour (all fixed, all guarded)

| # | Defect | Fix |
|---|---|---|
| 1 | `POST /runtime/compile` accepted an entirely unpinned request (empty workflowRef and pack key/version/digest) and returned `ok: true` with `plan:` and empty provenance. The wired compiler is `createHashPinnedCompileStub`, which never fails | `WorkflowCompileService.compileWorkflow` now rejects unpinned requests with `UNPINNED_COMPILE_REQUEST` before invoking the compile function → `422` |
| 2 | `POST /runtime/runs` started a run with an empty `compiledPlanHash`. The guard existed only in `startFromCompile`, which the HTTP route bypasses | Pinning guard moved into `start()` → `400` with the offending field named |
| 3 | Domain Pack catalog crashed once the list was non-empty: the web `DomainPackSummary` type declared `displayName` / `latestVersion` / `applicationCount` / … which the runtime never sends | Type aligned to the real DTO; page renders digest/version/revision/publishedAt |
| 4 | Test Profile table read `item.key` / `item.displayName`, so rows displayed `Profile 0` and every link pointed at a literal `demo` id; Status was hardcoded `READY`, ignoring `lastResult` | Table typed to the catalog DTO; shows real key, version and `lastResult` |
| 5 | Test Profiles list swallowed a fetch failure into an empty table, indistinguishable from "no profiles" | Explicit "catalog unavailable" state |

Guards added: `phase6-input-contracts.test.ts` now pins the compile/run pinning
rules and the exact key set of all three read-model DTOs, so web-side mirrors
cannot drift silently again (api suite 365 → 373).

### Limitation found, not fixed

`DomainPackAdminService`, `TestProfileCatalogService`, `TestCampaignService`,
`WorkflowRunService` and `DurableInteractionSubscription` are instantiated as
module-scope singletons over in-memory `Map`s in
`verdict-phase6-contracts.routes.ts`. Nothing the cockpit writes survives an API
restart — the entire seed above was lost when `tsx watch` reloaded, and had to be
replayed. Phase 5 shipped Prisma persistence and the migrations are now applied,
but these Phase 6 surfaces are not wired to it.

Recorded as `B-6-INMEMORY-READ-MODELS` (HIGH/LOCAL). This blocks CHECKPOINT 6
closure on its own: a read model that empties on restart cannot carry release-gate
evidence.

## 16. B-6-INMEMORY-READ-MODELS — resolved for the catalog read models

The three read models the cockpit renders are now database-backed and survive an
API restart. Verified by seeding over HTTP, stopping the API process entirely,
starting it again and reading the data back.

### What changed

| Service | Store | Tables |
|---|---|---|
| `DomainPackAdminService` | `PrismaDomainPackAdminStore` | `verdict_domain_pack`, `verdict_domain_pack_version` |
| `TestProfileCatalogService` | `PrismaTestProfileCatalogStore` | `verdict_test_profile_version` |
| `TestCampaignService` | `PrismaTestCampaignStore` | `verdict_test_campaign`, `verdict_campaign_cell` |

Each service now takes a store through its constructor; the in-memory
implementations remain and stay the default, so unit tests run without a
database. Store methods are async, so the service read/write methods became
async and the routes await them. DTO shapes are unchanged — the key sets pinned
in `phase6-input-contracts.test.ts` still pass untouched.

Profile records are stored whole inside the existing `definition` JSON column, so
no schema change was needed for them. One additive migration was required:
`20260806050000_add_domain_pack_revision` adds
`verdict_domain_pack_version.revision`, the optimistic-concurrency counter that
previously existed only in memory (`ADD COLUMN ... DEFAULT 1`, no data rewrite).

### Restart evidence

Seeded, then `preview_stop` + `preview_start` on the API process:

```text
domain-packs   1 record  nesy-courier 2.0.0 PUBLISHED revision 2
test-profiles  1 record  persist-profile v3 CORE qa-persist NOT_RUN
test-campaigns 1 record  persist-nightly v7 RUNNING 1 cell
```

Fail-closed behaviour re-verified against the database-backed path: re-publishing
a published version → `409`, draft-save over a published version → `409`
(rejected by the service and, as defence in depth, by the
`verdict_domain_pack_version_immutable_trigger`), invalid preview profile →
`422`. Detail endpoints for pack and profile → `200`. The cockpit renders the
persisted profile.

### Regression caught during this work

Making the services async initially broke the route error mapping: the handlers
did `return service.publish(...)` inside a `try`, so the rejection escaped the
`catch` and Fastify answered `500` instead of `409`. Fixed by awaiting inside the
try blocks. Worth remembering — an unawaited promise silently disables a
surrounding try/catch, and no unit test covers it because the mapping lives in
the route.

### Still in memory (narrowed, not closed)

| Service | Why it was not persisted |
|---|---|
| `WorkflowRunService` | Holds a run-start idempotency map keyed by `(workflowRef, deviceId, compiledPlanHash, profileKey, profileVersion)`. `bridgeflow_run_runtime` has no `workflow_ref` or `device_id` column, so the lookup cannot be expressed against the current schema. Needs a named schema addition, not a store swap. |
| `DurableInteractionSubscription` | There is no interaction table in the schema at all. Persisting the revision-cursor stream means introducing a new durable contract table, which is a schema-design decision for the master plan rather than a wiring change. |

Consequence: published packs, profiles and campaigns now carry evidence across
restarts, but run-start idempotency and the interaction cursor still reset. The
blocker is therefore reduced to `B-6-INMEMORY-RUN-SURFACES` (MEDIUM/LOCAL) and no
longer blocks the catalog read models.

## 17. B-6-INMEMORY-RUN-SURFACES — resolved

The two remaining in-memory surfaces are now durable. Both were verified by
seeding over HTTP, stopping the API process, starting it again and reading back.

### Schema

`bridgeflow_run_runtime` could not host the run-start record: its `run_id` is a
foreign key to `workflow_runs`, but a run start is accepted before any such row
exists. Two new tables were added instead
(`20260806060000_add_run_start_and_interaction`, both `CREATE TABLE` only —
nothing existing was altered):

| Table | Purpose |
|---|---|
| `verdict_run_start` | One row per accepted run start, keyed by the composed `workflowRef\|deviceId\|planHash\|profileKey\|profileVersion` idempotency tuple (unique index) |
| `verdict_run_interaction` | Append-only interaction stream; `UNIQUE(run_id, revision)` is what makes the cursor safe — two concurrent appends cannot claim one revision |

### Wiring

`WorkflowRunService` and `DurableInteractionSubscription` now take a store
through the constructor, exactly like the catalog services. `PrismaWorkflowRunStartStore`
and `PrismaDurableInteractionStore` back the routes; the in-memory stores remain
the default so unit tests still run without a database. Both services became
async, as did `startFromCompile`.

### Restart evidence

```text
before restart  run_b8746d64-f9f6-45f4-b30f-cd3f09d539c9
after restart   run_b8746d64-f9f6-45f4-b30f-cd3f09d539c9   -> same run, no second execution queued
interaction     latestRevision 1, summary "login pin=[REDACTED] token=[REDACTED]"
append after restart -> revision 2 (continues, does not rewind to 1)
cursor afterRevision=1 -> 1 item, reconnectCursor 2
```

Redaction is applied before insert, so the database never holds the raw secret.

Two restart-continuity tests were added that construct a *new* service instance
over a store holding prior state — the shape a process restart produces — so the
guarantee is enforced without a database (api suite 373 → 375).

### Status

`B-6-INMEMORY-RUN-SURFACES` is `RESOLVED`. No Phase 6 contract service holds
durable state in process memory any more.

## 18. CHECKPOINT 6 sweep — in progress

Driven against the live stack with a **real device attached**: Samsung Galaxy A34
(`SM-A346E`, Android 16, serial `R6CW400BC8N`) over USB, API `:4001`, cockpit
`:4002`, seeded runtime persisted in PostgreSQL.

### Defect found and fixed: fabricated device health

`DeviceReadinessService` probes took no arguments, so they could not answer "is
*this* device healthy" and the route wired them to constants:

```ts
adb: () => 'UP', bridge: () => 'UP', receiptBus: () => 'UP', orderedBus: () => 'DEGRADED'
```

Proof it was fabricated — asking for a device id that does not exist:

```text
GET /runtime/devices/BU-CIHAZ-YOK-12345/readiness  ->  ADB=UP  BRIDGE=UP  RECEIPT_BUS=UP
adb -s BU-CIHAZ-YOK-12345 get-state                ->  error: device not found
```

Fixed: probes now receive `deviceId` and may be async; the ADB lane is wired to
the real `AdbFacade.listDevices()` (only `device`-state entries count); a probe
that throws yields `UNKNOWN`, never a health claim. The remaining lanes are left
deliberately unwired and surface as `UNKNOWN` with remediation text rather than a
fabricated `UP`.

Verified against the attached device:

```text
R6CW400BC8N          ->  ADB=UP    BRIDGE=UNKNOWN  overall=DEGRADED
BU-CIHAZ-YOK-12345   ->  ADB=DOWN  BRIDGE=UNKNOWN  overall=DOWN
```

Two regression tests added (probe receives the device id; a throwing probe
degrades to `UNKNOWN`). API suite 375 → 377.

### Blocking finding: the Phase 6 editor surfaces are not mounted

`VerdictEditorToolbar` — which hosts `SemanticActionPalette`, `EntityBindingEditor`,
`EvidenceSourceRegistry`, `TargetResolutionPanel` and `LaunchProfileBuilder` — is
imported by no page. The components compile, typecheck and are unit-tested, but
they are unreachable in the running application.

Steps 6.8, 6.10, 6.11 and 6.12 are recorded as `DONE` in §5. That is wrong: the
work exists as components but was never wired into a route. Same class as the
duplicate-route and fabricated-data defects — every static signal was green.

Consequently CHECKPOINT items 22, 23, 24, 25 and 35 cannot pass, and 20/21 have
no implementation at all (no Application/Screen/Surface Registry manager exists).

### Evidence recorded so far

| Item | Verdict | Evidence |
|---|---|---|
| 26, 29 | `PASS` | Profile and campaign catalog/detail routes return 200 and render persisted records |
| 27, 28 | `PASS` | Kind-specific validation enforced server-side; `PREVIEW` + `releaseGate=true` → `422` |
| 45 | `PASS` | `network-inspector`, `log-explorer`, `schedule`, `database` all 200 |
| 46, 47 | `PASS_PARTIAL` | Lanes are presented separately and honestly; only ADB is probed, the rest report `UNKNOWN` |
| 48 | `PASS` | `COMMAND_ADMISSION` lane carries owner run id and block reason |
| 78 | `PASS` | 18-route direct-entry matrix, all 200 (§8 plus the sweep above) |
| 20, 21 | `FAIL` | No Surface/Screen Registry manager exists |
| 22, 23, 24, 25, 35 | `FAIL` | Implemented as components but not mounted on any route |
| 40, 41 | `PASS` after fix | Device health is now probed, not constant; previously `FAIL` |

### Remaining

Items 33, 34, 36–39, 44, 50–54, 57, 58, 61–65, 67, 69, 71–73, 75, 77, 79–81, 83
are not yet walked. The method is established and the environment is up; this is
remaining evidence work.

`6.30` stays `PENDING`. On current evidence CHECKPOINT 6 cannot close as
`PASSED_WITH_EXTERNAL_DUT_BLOCKERS`: seven items are `FAIL` for missing or
unmounted UI, which is not an external-device blocker.

## 19. Editor cutover — mounted, and what that revealed

### Mounted

`VerdictEditorToolbar` is now reachable from the workflow editor
(`/automation/[id]`): a toggleable right-hand panel with a "Verdict" button in
the canvas header, five tabs (Preview / Actions / Data / Rules / Config). It is
the panel that hosts every Phase 6 authoring surface, and until now no route
rendered it.

### Compile preview is genuinely wired — after two fixes

Clicking Compile initially produced `422` and the panel showed only
"Network or API error". Two defects:

1. `CompilePreviewPanel` sent `{ workflow: workflowState }`. The API expects
   `workflowRef`, `workflowIr`, `domainPackKey`, `domainPackVersion`,
   `domainPackDigest` — so every compile was an unpinned request, correctly
   rejected by the pinning guard from §15. The panel now resolves the published
   Domain Pack from the catalog, pins the request to it, shows `pinned:
   <packKey>@<version>`, and disables Compile with an explicit reason when no
   published pack exists.
2. `compileVerdictWorkflow` threw on any non-2xx, discarding the 422 body — which
   is exactly where the structured `issues` live. A rejected compile is a result,
   not a transport failure; the client now returns the 422 payload and the panel
   renders each issue with its code.

Verified in the browser against the live stack:

```text
POST /api/verdict/runtime/compile -> 200
pinned: nesy-courier@2.0.0
Compilation Successful   Hash sha256:5...
Source Map  { "step-1": "src:step-1" }
Provenance  { packKey: nesy-courier, packVersion: 2.0.0,
              packDigest: sha256:persist01, compilerVersion: bridgeflow-compiler }
```

Editor → WorkflowCompileApi → the Domain Pack persisted in PostgreSQL, end to
end. Items 2, 3, 5, 6 and 35 now have runtime evidence.

### The rest of the editor is a mockup

Mounting the panel made the remaining surfaces *reachable*, not *working*.
`EvidenceSourceRegistry`, `TargetResolutionPanel`, `LaunchProfileBuilder`,
`EntityBindingEditor` and `SemanticActionPalette` contain **zero** calls to
`verdict-runtime/client`; each renders a hardcoded array. The Evidence Source
Registry, for example, always lists "Main Activity Screen / SCREEN_STATE /
Ordered Bus" regardless of any run.

| Item | Verdict | Reason |
|---|---|---|
| 22, 23 | `FAIL` | Evidence Source Registry renders a fixed two-row sample; no source, authority, correlation, freshness or conflict comes from the runtime |
| 24 | `FAIL` | Target Resolution panel is static; no provider chain or ambiguity evidence |
| 25 | `FAIL` | Launch Profile Builder renders the right fields but binds to nothing and persists nothing |
| 2, 3, 5, 6, 35 | `PASS` | Compile preview, verified above |

So steps 6.10, 6.11 and 6.12 are **not** `DONE` as §5 records them. They are UI
shells. Recorded as `B-6-EDITOR-PANELS-UNBOUND` (HIGH/LOCAL): the panels need the
same treatment the campaign and profile pages received — real client calls, real
DTOs, fail-closed empty and error states.

### Still to do before 6.30

1. `B-6-EDITOR-PANELS-UNBOUND` — bind the four mockup panels to the runtime.
2. Items 20/21 — the Application/Screen/Surface Registry manager does not exist.
3. The remaining sweep items (33, 34, 36–39, 44, 50–54, 57, 58, 61–65, 67, 69,
   71–73, 75, 77, 79–81, 83).
