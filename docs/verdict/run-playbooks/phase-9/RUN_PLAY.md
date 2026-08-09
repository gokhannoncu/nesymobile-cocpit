# Phase 9 RUN_PLAY — Post-Removal Production Operations

```yaml
runPlayId: verdict-cockpit-phase-9-run-play
phase: "9"
phaseName: "Post-Removal Production Operations + Hardening"
status: NOT_STARTED
recoveryState: WAITING_FOR_PHASE_8_COMPLETION
createdAt: "2026-08-09 18:14:00 +03"
startedAt: null
completedAt: null
lastUpdatedAt: "2026-08-09 18:14:00 +03"
timezone: "Europe/Istanbul"
masterPlanPath: "docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md"
masterPlanVersion: "v1.1.4"
masterPlanDigest: "sha256:b2af8c455dc9a74495bd937112756a6f4c5aaf3f0a5ee292d95294e564c687ef"
verifyMasterPlanCommand: "pnpm verdict:verify-master-plan"
previousPhaseResult: "docs/verdict/run-playbooks/phase-8/RESULT.md"
resultFile: "docs/verdict/run-playbooks/phase-9/RESULT.md"
phase8StatusRequired: "COMPLETED"
phase8ReadinessRequired: "READY_FOR_PRODUCTION_OPS"
phase9Target: "CHECKPOINT_9_PRODUCTION_OPS"
```

## 1. Amaç

Phase 9, Maestro silme fazı değildir. Maestro/YAML runtime ve aktif referanslar
Phase 8 sonunda kaldırılmış olmalıdır. Bu fazın görevi BridgeFlow-only Cockpit'in
production operasyon kabulünü, soak/hardening ve release runbook'larını kapatmaktır.

## 2. Başlama gate'i

Phase 9 başlamadan önce Phase 8 RESULT içinde:

```text
resultState: COMPLETED
maestroRemovalStatus: COMPLETED
bridgeflowExecutionStatus: BRIDGEFLOW_ONLY
residualMaestroScan: PASS
phase9Readiness: READY_FOR_PRODUCTION_OPS
```

Bu koşullar yoksa Phase 9 implementation başlatılmaz.

## 3. Scope

1. Multi-device queue and mutation-admission soak.
2. USB/device reconnect, power loss, low disk and process restart recovery.
3. BridgeFlow recovery worker and oracle-evaluation worker operational hardening.
4. Security/RBAC/audit/retention release checks.
5. v1 parser/compatibility sunset decision.
6. Production runbooks, alerting, rollback and support handoff.
7. Long-running observation window for BridgeFlow-only Cockpit.

## 4. Out of scope

- Maestro/YAML direct removal.
- Maestro dual-run/parity harness.
- Benchmarking against Maestro.
- Reintroducing legacy fallback.

## 5. Owned paths

```text
docs/verdict/run-playbooks/phase-9/**
docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md
apps/api/src/services/bridgeflow-*.ts
apps/api/src/services/oracle-evaluation-worker.ts
apps/api/src/services/diagnostics/**
apps/api/src/routes/verdict-*.ts
apps/web/src/app/(cockpit)/**
apps/web/src/components/automation/run-detail/**
```

## 6. Step checklist

| Step | Status | Açıklama | Output |
|---|---|---|---|
| 9.1 Phase 8 gate | `PENDING` | Phase 8 removal + residual scan doğrula. | Gate evidence |
| 9.2 Operational soak | `PENDING` | Multi-device and long-run observation. | Soak report |
| 9.3 Recovery hardening | `PENDING` | Restart/reconnect/low disk/power loss. | Recovery evidence |
| 9.4 Security and retention | `PENDING` | RBAC/audit/retention release checks. | Security evidence |
| 9.5 Compatibility sunset | `PENDING` | v1 parser/legacy compatibility decision. | Sunset decision |
| 9.6 Runbooks | `PENDING` | Production support docs and rollback path. | Ops runbook |
| 9.7 Verification + closure | `PENDING` | Full test/build/release gate. | CHECKPOINT 9 |

## 7. Verification commands

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

Phase 9 agents must also run the actual soak/recovery commands available in the
environment and record their outputs in RESULT.md.
