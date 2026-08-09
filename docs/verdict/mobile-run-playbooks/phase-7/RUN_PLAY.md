# Phase M7 RUN_PLAY — Real Nesy Flows + Fault/Recovery + Release Isolation

```yaml
runPlayId: verdict-mobile-phase-7-run-play
phase: "7"
phaseName: "Real Nesy Flows + Fault/Recovery + Release Isolation"
status: READY_WITH_EXTERNAL_BLOCKERS
recoveryState: CLOSED_PARTIAL
createdAt: "2026-08-06 03:58:00 +03"
startedAt: "2026-08-09 16:41:00 +03"
completedAt: "2026-08-09 17:05:00 +03"
lastUpdatedAt: "2026-08-09 17:05:00 +03"
timezone: "Europe/Istanbul"
masterPlanPath: "docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:38800dbbf65ef935159108e76fca506474205e4f1168a950089436ae5138d51b"
verifyMasterPlanCommand: "pnpm verdict:verify-master-plan"
cockpitPhaseResult: "docs/verdict/run-playbooks/phase-7/RESULT.md"
previousPhaseResult: "docs/verdict/mobile-run-playbooks/phase-6/RESULT.md"
resultFile: "docs/verdict/mobile-run-playbooks/phase-7/RESULT.md"
mobileRepoRoot: "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile"
mobileSsot: "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-status.json"
evidenceDir: "docs/verdict/mobile-run-playbooks/phase-7/evidence/"
```

## 1. Amaç

Gerçek Nesy akışlarında App Adapter + SDK + Bridge kanıtı, fault/recovery
observation ve production release isolation.

## 2. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `M7` |
| Current step | `7.7` |
| Current state | `CLOSED_PARTIAL` |
| Recovery instruction | `See RESULT.md. Full PASS blocked on storeFile + userdebug DUT + Cockpit P7.` |

## 7. Step checklist

| Step | Status |
|---|---|
| 7.0 Playbook | `DONE` |
| 7.1 Gate | `DONE` |
| 7.2 Baseline | `DONE` |
| 7.3 Real flow packs | `PARTIAL` |
| 7.4 Scanner/launch isolation | `PARTIAL` |
| 7.5 Fault/recovery | `PARTIAL` |
| 7.6 Release isolation | `PARTIAL` |
| 7.7 Verification | `DONE` |

## 8. Verification commands

```bash
pnpm verdict:verify-master-plan
cd NesyMobile && ./gradlew :app:testTstrsDebugUnitTest --tests …NesyM7AcceptanceMatrixTest
./gradlew :app:assembleTstrsAutomationRelease
./scripts/assert-release-isolation-apk.sh app/build/outputs/apk/tstrs/automationRelease/*.apk true
./gradlew :app:connectedTstrsDebugAndroidTest \
  -Pandroid.testInstrumentationRunnerArguments.class=com.arasdigital.nesymobile.verdictfaz7.SdkAbsenceTest
```

## 10. Next phase handoff

`phase8Readiness: HELD_UNTIL_DUT_AND_COCKPIT_P7` — see RESULT.md.
