# Phase M7 RESULT — Real Nesy Flows + Fault/Recovery + Release Isolation

```yaml
runPlayId: verdict-mobile-phase-7-run-play
phase: "7"
phaseName: "Real Nesy Flows + Fault/Recovery + Release Isolation"
resultState: READY_WITH_EXTERNAL_BLOCKERS
createdAt: "2026-08-06 03:58:00 +03"
startedAt: "2026-08-09 16:41:00 +03"
completedAt: "2026-08-09 17:05:00 +03"
lastUpdatedAt: "2026-08-09 17:05:00 +03"
timezone: "Europe/Istanbul"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:PENDING_DIGEST_BUMP"
runPlayFile: "docs/verdict/mobile-run-playbooks/phase-7/RUN_PLAY.md"
cockpitPhaseResult: "docs/verdict/run-playbooks/phase-7/RESULT.md"
previousPhaseResult: "docs/verdict/mobile-run-playbooks/phase-6/RESULT.md"
phase8Readiness: "HELD_UNTIL_DUT_AND_COCKPIT_P7"
mobileRepoRoot: "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile"
evidenceDir: "docs/verdict/mobile-run-playbooks/phase-7/evidence/"
```

## 1. Executive result

Mobile M7 offline + partial device isolation evidence is packaged.
**Not COMPLETED** — Field Login / Load Tour / kill-recovery full PASS and
signed production DEX negative scan remain blocked.

```text
CHECKPOINT M7: READY_WITH_EXTERNAL_BLOCKERS
Offline matrix: NesyM7AcceptanceMatrixTest PASS
Automation APK DEX markers: PASS (host script)
SdkAbsenceTest on SM-A346E tstrsDebug: PASS
Signed tstrsRelease package: BLOCKED_LOCAL (storeFile)
Courier E2E / kill→recovery: BLOCKED_EXTERNAL (CP3-DUT userdebug + product flows)
Cockpit Phase 7: NOT_STARTED (joint acceptance held)
phase8Readiness: HELD_UNTIL_DUT_AND_COCKPIT_P7
```

## 2. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `M7` |
| Current step | `7.7` |
| Current state | `CLOSED_READY_WITH_EXTERNAL` |
| Last successful step | `7.7` |
| Last attempted step | `7.7` |
| Last update | `2026-08-09 17:05:00 +03` |
| Recovery instruction | `M7 closed partial. Unblock: storeFile for release DEX negative; userdebug DUT + Cockpit P7 for full courier/kill evidence. Do not start M8 as FULL PASS.` |

## 3. Precondition gate

| Gate | Required | Current evidence |
|---|---|---|
| M4B/M5/M6 | COMPLETED | `PASS` |
| Cockpit Phase 7 | preferred for joint DUT | `NOT_STARTED` — Mobile proceeds with Mobile-side pack only |
| Master digest | verified at close | `PASS` |
| Mobile repo | available | `PASS` |
| DUT | for full PASS | `user` SM-A346E present; **not** userdebug |

## 4. Inherited / known blockers

| ID | Severity | Description | Status |
|---|---|---|---|
| CP3-DUT | HIGH/EXT | Lab userdebug/eng required for mutation / full courier | `OPEN_EXTERNAL` |
| B-12 | MEDIUM | Bridge smoke handshake flaky | `OPEN` |
| SIGNING_STORE | LOCAL | `assembleTstrsRelease` missing `storeFile` | `BLOCKED_LOCAL` |
| COCKPIT_P7 | MEDIUM | Cockpit Phase 7 NOT_STARTED — joint pack held | `OPEN` |
| FLOW_E2E | HIGH/EXT | Field Login / Load Tour live evidence not run | `OPEN_EXTERNAL` |
| KILL_RECOVERY | HIGH/EXT | Process-kill → `nesy.recovery.*` not run | `OPEN_EXTERNAL` |

## 5. Step execution log

| Step | Status | Evidence |
|---|---|---|
| 7.0 Playbook | `DONE` | scaffold |
| 7.1 Gate | `DONE` | M4B–M6 PASS; Cockpit P7 NOT_STARTED noted |
| 7.2 Device/build baseline | `DONE` | SM-A346E user; automationRelease APK built |
| 7.3 Real flow evidence packs | `PARTIAL` | seams packaged; live courier E2E not run |
| 7.4 Scanner/launch isolation | `PARTIAL` | unit + automation DEX + SdkAbsence debug PASS; release negative BLOCKED_LOCAL |
| 7.5 Fault/recovery observation | `PARTIAL` | query allowlist proven offline; kill harness not run |
| 7.6 Release isolation final gate | `PARTIAL` | automation positive PASS; production negative BLOCKED_LOCAL |
| 7.7 Verification + M8 handoff | `DONE` | see §7 / §9 |

## 6. Changed files

### NesyMobile

| File | Change |
|---|---|
| `scripts/assert-release-isolation-apk.sh` | **new** host DEX marker scanner |
| `app/src/test/.../NesyM7AcceptanceMatrixTest.kt` | **new** offline M7 matrix |

### Cockpit

| File | Change |
|---|---|
| `docs/verdict/mobile-run-playbooks/phase-7/RESULT.md` | this file |
| `docs/verdict/mobile-run-playbooks/phase-7/RUN_PLAY.md` | recovery |
| `docs/verdict/mobile-run-playbooks/phase-7/evidence/README.md` | **new** pack |
| `docs/verdict/mobile-run-playbooks/PROGRESS.md` | board |
| master plan Mobile table | digest |

## 7. Verification results

| Check | Result | Notes |
|---|---|---|
| `NesyM7AcceptanceMatrixTest` | `PASS` | |
| `assembleTstrsAutomationRelease` | `PASS` | |
| Host isolation scan (expect true) | `PASS` | markers found |
| `assembleTstrsRelease` | `BLOCKED_LOCAL` | storeFile |
| `SdkAbsenceTest` connected tstrsDebug | `PASS` | SM-A346E, 0 failures |
| Field Login / Load Tour DUT | `SKIPPED` | external |
| Kill → recovery DUT | `SKIPPED` | external |

## 8. Skipped / deferred

- Signed production APK negative DEX scan
- Full courier DUT acceptance + Cockpit P7 joint packaging
- Process-death recovery observation harness on eng/userdebug

## 9. Next phase handoff

```text
phase8Readiness: HELD_UNTIL_DUT_AND_COCKPIT_P7
Next Mobile: M8 only after M7 external blockers clear enough for fault DUT
Do not flip Cockpit faz-* YAML from this Mobile close.
Do not mark Mobile SSOT bridge_b2=passed from this pack.
```
