# Phase 9 RESULT — Post-Removal Production Operations

```yaml
runPlayId: verdict-cockpit-phase-9-run-play
phase: "9"
phaseName: "Post-Removal Production Operations + Hardening"
resultState: IN_PROGRESS
createdAt: "2026-08-09 18:14:00 +03"
startedAt: "2026-08-09 21:12:00 +03"
completedAt: null
lastUpdatedAt: "2026-08-09 21:20:00 +03"
timezone: "Europe/Istanbul"
masterPlanVersion: "v1.1.4"
masterPlanDigest: "sha256:b2af8c455dc9a74495bd937112756a6f4c5aaf3f0a5ee292d95294e564c687ef"
runPlayFile: "docs/verdict/run-playbooks/phase-9/RUN_PLAY.md"
previousPhaseResult: "docs/verdict/run-playbooks/phase-8/RESULT.md"
targetAcceptance: "BridgeFlow-only production operations"
```

## 1. Executive result

Phase 9 implementation has started. Its Phase 8 precondition is met, and the
runtime stubs Phase 8 left behind (stub compiler, stub Bridge port, no condition
context) have since been replaced with real wiring — see §2.1. The previous HIGH
runtime lanes are now code-wired; remaining proof is migration deployment,
environment credentials and physical/mobile acceptance.

## 2. Precondition gate

| Gate | Required | Current evidence |
|---|---|---|
| Phase 8 result state | `COMPLETED` | `PASS` — `docs/verdict/run-playbooks/phase-8/RESULT.md` |
| Maestro removal | `COMPLETED` | `PASS` — executor/generator/runner deleted, residual guards green |
| BridgeFlow execution | `BRIDGEFLOW_ONLY` | `PASS` — real compiler + Bridge ports wired (see §2.1) |
| Residual active source scan | `PASS` | `PASS` — API/web Phase 8 residual tests |
| Phase 9 readiness | `READY_FOR_PRODUCTION_OPS` | `PARTIAL` — code wiring done; external/runtime acceptance remains |

### 2.1 Runtime wiring status

Phase 8 removed the old engine but left the new one wired to stubs. Those are
now real, and the lanes that are still open are named rather than implied.

| Lane | State | Evidence |
|---|---|---|
| Compile | `REAL` | `bridgeflow-compile-adapter.ts` — `compilerKind: BRIDGEFLOW`, pack pinned by digest |
| Condition / SWITCH branching | `REAL` | `bridgeflow-run-context.ts` supplies the `ConditionEvaluationContext` |
| BRIDGE_ACTION / wait | `REAL` | `bridgeflow-device-ports.ts` → `BridgeDeviceManager` |
| RESOLVE_TARGET | `REAL` | target registry → fingerprint → device resolve |
| Continue gate / final oracle | `REAL` | `OracleEvaluationWorker` + Prisma revision store |
| Run identity (`workflow_runs` row) | `REAL` | `verdict-run-row.ts` — created at run start; status mirrored by the queue |
| REMOTE_ACTION / EXTERNAL_ACTION | `REAL` | `nesy-backoffice-adapter.ts` + `nesy-backoffice-endpoints.ts` — all 9 allowlisted operations mapped to real Nesy endpoints; needs `NESY_BACKOFFICE_BASE_URL` / `NESY_BACKOFFICE_TOKEN` |
| Remote evidence publication | `REAL` | `bridgeflow-remote-steps.ts` publishes `outputFactBindings` into the run's `ORDERED_REQUIRED` lane |
| SDK_QUERY | `CODE_WIRED` | `control-contract`/`control-channels` expose `sql_named`; `bridgeflow-device-ports.ts` executes SDK_QUERY through Verdict control channel |
| Evidence publication into a run | `CODE_WIRED` | `test-event-ws-server.ts` publishes receipt/ordered facts into `BridgeFlowEvidenceRuntime` after authenticated run/session match |
| Compiled plan persistence | `CODE_WIRED` | `verdict_compiled_plan` + `PrismaCompiledPlanStore` make previewed plans restart-safe |
| SDK run-session auth | `CODE_WIRED` | `RunSecretRegistry` + WS hello/auth HMAC gate + `set_run` bootstrap |

## 3. Step execution log

| Step | Status | Evidence |
|---|---|---|
| 9.1 Phase 8 gate | `DONE` | Phase 8 result remains `COMPLETED` |
| 9.2 Operational soak | `PENDING` | requires deployed migration + live environment |
| 9.3 Recovery hardening | `PARTIAL` | durable compiled plan store added; physical restart acceptance pending |
| 9.4 Security and retention | `PARTIAL` | mutual-HMAC host gate added; cross-repo/mobile acceptance pending |
| 9.5 Compatibility sunset | `PENDING` | — |
| 9.6 Runbooks | `PENDING` | — |
| 9.7 Verification + closure | `PENDING` | — |

## 4. Changed files

| Path | Change | Reason |
|---|---|---|
| `packages/db/prisma/schema.prisma` + `20260809211000_add_compiled_plan_store` | add `verdict_compiled_plan` | durable compiled plan persistence |
| `apps/api/src/services/phase6-prisma-stores.ts` | add Prisma compiled plan + remote attempt stores | remove in-memory plan/remote-attempt gaps |
| `apps/api/src/routes/verdict-phase6-contracts.routes.ts` | use durable plan store + real SDK readiness probes | restart-safe compile/run and non-fabricated readiness |
| `packages/control-contract/src/index.ts` / `packages/control-channels/src/index.ts` | add `sql_named` operation | host-side SDK_QUERY lane |
| `apps/api/src/services/bridgeflow-device-ports.ts` | execute `SDK_QUERY` via Verdict control channel | named query output reaches BridgeFlow variables |
| `apps/api/src/services/bridgeflow-execution-queue.ts` | set_run bootstrap + remote runtime attempt store | establish SDK run session and execute remote actions |
| `apps/api/src/services/run-secret-registry.ts` | new | run secret issue/verify/counter-signature |
| `apps/api/src/services/test-event-bridge.ts` / `test-event-ws-server.ts` | shared secret + authenticated WS gate | pre-auth evidence rejected; frames scoped by run/session |
| `apps/api/src/services/*integration.test.ts` + `db-integration-env.ts` | DB-backed integration tests mandatory | removed `VERDICT_DB_IT` skip gate; load only `DATABASE_URL` fallback |
| `packages/db/src/index.ts` | DATABASE_URL fallback | Prisma client can see `apps/api/.env` without loading unrelated secrets |

## 5. Verification results

```text
pnpm --filter @nesy/db generate
→ PASS

pnpm --filter @nesy/control-contract build
→ PASS

pnpm --filter @nesy/control-channels build
→ PASS

pnpm --filter @nesy/control-channels test
→ 2 files / 36 tests PASS

pnpm --filter @nesy/api typecheck
→ PASS

pnpm --filter @nesy/api exec vitest run src/services/run-secret-registry.test.ts src/services/test-event-ws-server.test.ts src/services/remote-action-runtime.test.ts src/services/nesy-backoffice-adapter.test.ts src/services/bridgeflow-runtime-wiring.test.ts
→ 5 files / 44 tests PASS

pnpm --filter @nesy/api test
→ prior unit suite PASS; DB-backed integration tests are no longer skipped

pnpm --filter @nesy/api exec vitest run src/services/verdict-ingest.integration.test.ts src/services/verdict-durable-runtime.integration.test.ts src/services/test-event-ws-server.integration.test.ts
→ 3 files / 37 tests PASS against PostgreSQL
```

## 6. Blockers

| ID | Severity | Status | Description | Required action |
|---|---|---|---|---|
| BACKOFFICE_CREDENTIALS_ABSENT | HIGH | `OPEN` | The adapter and all 9 endpoint mappings exist, but `NESY_BACKOFFICE_BASE_URL` / `NESY_BACKOFFICE_TOKEN` are unset, so every remote operation fails closed naming that. | Set both for the target country/environment, then run the tour-approval workflow end to end. |
| BACKOFFICE_INFERRED_ENDPOINTS | MEDIUM | `PARTIAL` | Only `read-session` → `User/GetMyInfo` remains `INFERRED`; `read-delivery-status` now uses verified `Tracking/GetShipmentDeliveryProof`. Backend exposes no read for `UserLoginLog`. | Confirm session evidence against a live environment or add a dedicated login-log read endpoint. |
| SDK_QUERY_LANE_ABSENT | HIGH | `RESOLVED_CODE` | `SDK_QUERY` now maps to Verdict control `sql_named` and stores output variables for later steps. | Run against automation build with App Adapter named-query capability. |
| EVIDENCE_PRODUCER_ABSENT | HIGH | `RESOLVED_CODE` | Durable WS receipt/ordered evidence producer publishes into `BridgeFlowEvidenceRuntime` after authenticated run/session match. | Run DB-backed ingest integration with migrations applied. |
| PLAN_STORE_IN_MEMORY | HIGH | `RESOLVED_CODE` | Compiled plans now persist in `verdict_compiled_plan` and are fetched by planRef + planHash. | Deploy migration before multi-process runs. |
| DB_BACKED_INTEGRATION_UNREACHABLE | HIGH | `RESOLVED` | DB-backed integration tests are mandatory and now pass against PostgreSQL. | Keep these three files in required CI, not skipped. |
| CROSS_REPO_HMAC_ACCEPTANCE | MEDIUM | `OPEN_EXTERNAL` | Host HMAC canonical implementation added; bit-identical mobile fixture/DUT test still must run in `/NesyMobile`. | Run mobile fixture + physical SDK WS auth acceptance. |

## 7. Final readiness

Initial state:

```text
productionOpsReadiness: NOT_EVALUATED
```
