# Phase M8 RESULT — DUT Fault Matrix + Bridge Hardening Acceptance

```yaml
runPlayId: verdict-mobile-phase-8-run-play
phase: "8"
phaseName: "DUT Fault Matrix + Bridge Hardening Acceptance"
resultState: BLOCKED_EXTERNAL
createdAt: "2026-08-06 03:58:00 +03"
startedAt: "2026-08-09 18:54:00 +03"
completedAt: "2026-08-09 19:05:00 +03"
lastUpdatedAt: "2026-08-09 19:05:00 +03"
timezone: "Europe/Istanbul"
masterPlanVersion: "v1.1.4"
masterPlanDigest: "sha256:22c26fd21b1616b196de0136c2d1c66b24d99e4736869bf108afe3c2d5b64a4e"
runPlayFile: "docs/verdict/mobile-run-playbooks/phase-8/RUN_PLAY.md"
cockpitPhaseResult: "docs/verdict/run-playbooks/phase-8/RESULT.md"
previousPhaseResult: "docs/verdict/mobile-run-playbooks/phase-7/RESULT.md"
phase9Readiness: "HELD_UNTIL_CP3_DUT"
mobileRepoRoot: "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile"
evidenceDir: "docs/verdict/mobile-run-playbooks/phase-8/evidence/"
carryDecision: "M7 residuals noted; proceed without claiming DUT COMPLETED"
```

## 1. Executive result

M8 started with **explicit carry** of M7 residuals. Offline Bridge hardening
matrix PASS. Lab DUT fault matrix **not runnable** on attached `user` device →
**`BLOCKED_EXTERNAL`**. No COMPLETED claim.

```text
CHECKPOINT M8: BLOCKED_EXTERNAL
Carry note: evidence/CARRIED_BLOCKERS.md
Offline: ProtocolV1M8HardeningMatrixTest 3/3 PASS
  - foreign_window fail-closed
  - cancel / no auto-retry after wait
  - stale_tree fencing
DUT: SM-A346E ro.build.type=user (CP3-DUT OPEN)
Cockpit Phase 8: COMPLETED (Maestro removal; separate track)
phase9Readiness: HELD_UNTIL_CP3_DUT
```

## 2. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `M8` |
| Current step | `8.7` |
| Current state | `BLOCKED_EXTERNAL` |
| Last successful step | `8.1` (gate/offline) |
| Last attempted step | `8.2` |
| Last update | `2026-08-09 19:05:00 +03` |
| Recovery instruction | `Attach userdebug/eng DUT; re-run 8.2–8.6 fault matrix. Do not COMPLETED on user build.` |

## 3. Precondition gate

| Gate | Required | Current evidence |
|---|---|---|
| M7 Mobile | READY_WITH_EXTERNAL (carry OK) | `PASS` with carry note |
| Cockpit Phase 8 | readable | `COMPLETED` (Maestro removal) |
| CP3-DUT userdebug/eng | for COMPLETED | `FAIL` — attached device is `user` |
| Can complete now? | no | `BLOCKED_EXTERNAL` |

## 4. Inherited / carried blockers

| ID | Tür | Status | M8 notu |
|---|---|---|---|
| CP3-DUT | Lab ortam | `OPEN_EXTERNAL` | Hard gate — COMPLETED yasak |
| KILL_RECOVERY | Acceptance | `OPEN_EXTERNAL` | M8 scope; DUT şart |
| FLOW_E2E | Acceptance | `OPEN_EXTERNAL` | Carry from M7 |
| SIGNING_STORE | Lokal config | `BLOCKED_LOCAL` | Carry; not M8 primary |
| B-12 | Smoke flake | `OPEN` | inherited |
| B-13 | Protocol gaps | `CLOSED` | M3/M4C |

## 5. Step execution log

| Step | Status | Evidence |
|---|---|---|
| 8.0 Playbook | `DONE` | scaffold |
| 8.1 M7 + Cockpit P8 gate | `DONE` | M7 carry + Cockpit P8 COMPLETED |
| 8.2 Lab DUT policy | `BLOCKED_EXTERNAL` | `user` / debuggable=0 |
| 8.3 Process kill / reboot | `BLOCKED_EXTERNAL` | not run |
| 8.4 Scanner/payment/fiscal DUT | `BLOCKED_EXTERNAL` | not run |
| 8.5 IME / foreign-window / manual-touch | `PARTIAL` | foreign-window unit PASS; IME/manual DUT not run |
| 8.6 Process-death unknown-effect | `PARTIAL` | cancel/no-retry unit PASS; DUT death not run |
| 8.7 Verification + M9 handoff | `DONE` | offline PASS; DUT held |

## 6. Changed files

| File | Change |
|---|---|
| `verdict-bridge/.../ProtocolV1M8HardeningMatrixTest.kt` | **new** offline matrix |
| `docs/.../phase-8/evidence/CARRIED_BLOCKERS.md` | **new** carry note |
| `docs/.../phase-8/RESULT.md` / `RUN_PLAY.md` | this close |
| `PROGRESS.md` / master Mobile table | board |

## 7. Verification results

| Check | Result | Notes |
|---|---|---|
| `ProtocolV1M8HardeningMatrixTest` | `PASS` | 3 tests |
| Lab DUT fault matrix | `BLOCKED_EXTERNAL` | user build |
| Production user jest PASS | `BANNED` | not attempted |

## 8. Skipped / deferred

- All CP3-DUT fault cases (kill/reboot/payment/fiscal/IME/manual-touch live)
- M9 Maestro cleanup until M8 DUT clears enough

## 9. Next phase handoff

```text
phase9Readiness: HELD_UNTIL_CP3_DUT
Carry file: docs/verdict/mobile-run-playbooks/phase-8/evidence/CARRIED_BLOCKERS.md
M9 may scaffold later but must not claim DUT acceptance from this close.
```
