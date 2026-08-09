# Phase M8 RUN_PLAY — DUT Fault Matrix + Bridge Hardening Acceptance

```yaml
runPlayId: verdict-mobile-phase-8-run-play
phase: "8"
phaseName: "DUT Fault Matrix + Bridge Hardening Acceptance"
status: BLOCKED_EXTERNAL
recoveryState: BLOCKED_ON_CP3_DUT
createdAt: "2026-08-06 03:58:00 +03"
startedAt: "2026-08-09 18:54:00 +03"
completedAt: "2026-08-09 19:05:00 +03"
lastUpdatedAt: "2026-08-09 19:05:00 +03"
timezone: "Europe/Istanbul"
masterPlanPath: "docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md"
masterPlanVersion: "v1.1.4"
masterPlanDigest: "sha256:22c26fd21b1616b196de0136c2d1c66b24d99e4736869bf108afe3c2d5b64a4e"
verifyMasterPlanCommand: "pnpm verdict:verify-master-plan"
cockpitPhaseResult: "docs/verdict/run-playbooks/phase-8/RESULT.md"
previousPhaseResult: "docs/verdict/mobile-run-playbooks/phase-7/RESULT.md"
resultFile: "docs/verdict/mobile-run-playbooks/phase-8/RESULT.md"
mobileRepoRoot: "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile"
mobileSsot: "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-status.json"
evidenceDir: "docs/verdict/mobile-run-playbooks/phase-8/evidence/"
```

## 1. Amaç

Process kill / reboot / scanner-payment-fiscal DUT + Bridge fencing / IME /
foreign-window / manual-touch / process-death kabulü.

**Carry:** M7 residuals noted in `evidence/CARRIED_BLOCKERS.md` — COMPLETED yok.

## 2. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `M8` |
| Current step | `8.7` |
| Current state | `BLOCKED_ON_CP3_DUT` |
| Recovery instruction | `userdebug/eng DUT gelince 8.2–8.6’yı çalıştır. Offline matrix zaten PASS.` |

## 7. Step checklist

| Step | Status |
|---|---|
| 8.0–8.1 | `DONE` |
| 8.2 Lab DUT policy | `BLOCKED_EXTERNAL` |
| 8.3–8.4 DUT matrix | `BLOCKED_EXTERNAL` |
| 8.5–8.6 | `PARTIAL` (unit only) |
| 8.7 Verification | `DONE` |

## 8. Verification commands

```bash
cd NesyMobile/verdict-bridge && ./gradlew :app:testDebugUnitTest --tests '*M8Hardening*'
```

## 10. Next phase handoff

`phase9Readiness: HELD_UNTIL_CP3_DUT` — see RESULT.md.
