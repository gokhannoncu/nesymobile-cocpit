# Phase M5 RUN_PLAY — Correlation, Clock, Recovery Observation + Bridge Lifecycle

```yaml
runPlayId: verdict-mobile-phase-5-run-play
phase: "5"
phaseName: "Correlation, Clock, Recovery Observation + Bridge Lifecycle"
status: COMPLETED
recoveryState: CLOSED
createdAt: "2026-08-06 03:58:00 +03"
startedAt: "2026-08-06 22:28:00 +03"
completedAt: "2026-08-06 22:40:00 +03"
lastUpdatedAt: "2026-08-06 22:40:00 +03"
timezone: "Europe/Istanbul"
masterPlanPath: "docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:b81631396044cab7f83f6b6efea2f47ff4b4bda4b177b2d7a2ad705535b660b2"
verifyMasterPlanCommand: "pnpm verdict:verify-master-plan"
cockpitPhaseResult: "docs/verdict/run-playbooks/phase-5/RESULT.md"
previousPhaseResult: "docs/verdict/mobile-run-playbooks/phase-4c/RESULT.md"
resultFile: "docs/verdict/mobile-run-playbooks/phase-5/RESULT.md"
mobileRepoRoot: "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile"
mobileSsot: "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-status.json"
```

## 1. Amaç

Phase M5, Mobile evidence'ın doğru occurrence'a bağlanması, CLOCK_BOOTTIME
monoTs uyumu, recovery observation ve Bridge cancellation/unknown-effect yaşam
döngüsünün cihaz tarafını tamamlar.

**Başlama:** M3 + M4B temeli. Cockpit Phase 5 ile paralel/ardışık.

## 1.1 AI agent'a verilecek başlangıç metni

```text
(Phase CLOSED — see RESULT.md. Next: M6.)
```

## 2. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `M5` |
| Current step | `5.6` |
| Current state | `CLOSED` |
| Last successful step | `5.6` |
| Last attempted step | `5.6` |
| Last update | `2026-08-06 22:40:00 +03` |
| Recovery instruction | `M5 COMPLETED. Start M6 Inspector. External DUT/B-12 remain open.` |

## 3. Kapsam

1. Correlation metadata contract (runId, occurrenceId, iterationPath, entity*, attempt, requestId, eventSeq, monoTs)
2. CLOCK_BOOTTIME + reboot/calibration/uncertainty markers
3. Recovery observation queries (delivery/queue/payment/fiscal/restore)
4. Bridge cancel race + UNKNOWN_EFFECT reconciliation hooks
5. Host enrichment vs app-produced field ayrımı dokümantasyonu

## 4. Kapsam dışı

- Cockpit Continue Gate / Oracle engine kodu
- Inspector UI (Cockpit Phase 6 / Mobile M6)
- Full courier DUT (M7)

## 5. Owned paths

- `docs/verdict/mobile-run-playbooks/phase-5/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-api/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-sdk/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-core/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-bridge/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/app/src/automation/**`

## 6. Read-only context paths

- `docs/verdict/run-playbooks/phase-5/**`
- `packages/bridgeflow-executor/**`
- `packages/oracle-engine/**`

## 7. Step checklist

### 5.0 Playbook oluşturma

- Status: `DONE`

### 5.1 M3/M4B/M4C + Cockpit Phase 5 gate

- Status: `DONE`

### 5.2 Correlation metadata implementasyon

- Status: `DONE`

### 5.3 monoTs / clock markers

- Status: `DONE`

### 5.4 Recovery observation queries

- Status: `DONE`

### 5.5 Bridge cancel/unknown-effect cihaz kanıtı

- Status: `DONE` (unit/fake-host; DUT external)

### 5.6 Verification + M6 handoff

- Status: `DONE`


## 8. Verification commands

- `pnpm verdict:verify-master-plan`
- `cd NesyMobile && ./gradlew :verdict-core:testDebugUnitTest --tests com.verdict.sdk.core.VerdictEngineTest`
- `cd NesyMobile/verdict-bridge && ./gradlew :app:testDebugUnitTest --tests com.verdict.bridge.ProtocolV1WaitAnyTest`
- `cd NesyMobile && ./gradlew :app:testTstrsDebugUnitTest --tests …NesyAppAdapterManifestTest --tests …NesyCorrelationContextTest`

## 9. Hard bans

- Production APK automation leakage
- Arbitrary SQL query surface
- Event-absence ⇒ SDK failure guessing
- wait_any full-dump polling
- Auto-retry after UNKNOWN_EFFECT
- Silent Cockpit code edits from Mobile playbook

## 10. Next phase handoff

`phase6Readiness: READY_WITH_EXTERNAL_BLOCKERS` — see RESULT.md.
