# Phase M5 RUN_PLAY — Correlation, Clock, Recovery Observation + Bridge Lifecycle

```yaml
runPlayId: verdict-mobile-phase-5-run-play
phase: "5"
phaseName: "Correlation, Clock, Recovery Observation + Bridge Lifecycle"
status: NOT_STARTED
recoveryState: WAITING_FOR_PHASE_M3_AND_M4B
createdAt: "2026-08-06 03:58:00 +03"
startedAt: null
completedAt: null
lastUpdatedAt: "2026-08-06 03:58:00 +03"
timezone: "Europe/Istanbul"
masterPlanPath: "docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:5c7e2f6c7da582b5bc6064a6c866476a7adb8e1d4a8a065e0be5067248644771"
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
Verdict Mobile Phase M5 uygula.

Önce şu dosyayı tamamen oku:
docs/verdict/mobile-run-playbooks/phase-5/RUN_PLAY.md

Sonra şu dosyayı oku:
docs/verdict/mobile-run-playbooks/phase-5/RESULT.md

Cockpit karşılığını oku:
docs/verdict/run-playbooks/phase-5/RESULT.md

Mobile SSOT:
/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-status.json

Master plan:
docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md

Kurallar:
- Owned paths dışına çıkma.
- Cockpit apps/** ve packages/** varsayılan read-only (contract handoff hariç).
- İkinci paralel App Adapter yazma.
- Production'a automation/scanner/DIRECT_STATE sızdırma.
- Core/Bridge içine STOP/PARCEL/OPEN_STOP business type sokma.
- Fake-pass yazma; DUT yoksa BLOCKED_EXTERNAL.
- RESULT.md evidence olmadan COMPLETED yazma.

Duvar saati ile sıralama yapma. Event yokluğunu failure sayma. Unknown effect'te auto-retry yok.

Kapanışta RESULT.md içine changed files, commands, tests, blockers ve next-phase
readiness yaz.
```

## 2. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `M5` |
| Current step | `5.0` |
| Current state | `WAITING_FOR_PHASE_M3_AND_M4B` |
| Last successful step | `5.0` |
| Last attempted step | `5.0` |
| Last update | `2026-08-06 03:58:00 +03` |
| Recovery instruction | `Phase M5 henüz başlamadı. RUN_PLAY §1.1 prompt ile başla. Önkoşulları RESULT precondition gate'inde doğrula.` |

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
- Evidence: RESULT.md step log

### 5.1 M3/M4B/M4C + Cockpit Phase 5 gate

- Status: `PENDING`
- Evidence: RESULT.md step log

### 5.2 Correlation metadata implementasyon

- Status: `PENDING`
- Evidence: RESULT.md step log

### 5.3 monoTs / clock markers

- Status: `PENDING`
- Evidence: RESULT.md step log

### 5.4 Recovery observation queries

- Status: `PENDING`
- Evidence: RESULT.md step log

### 5.5 Bridge cancel/unknown-effect cihaz kanıtı

- Status: `PENDING`
- Evidence: RESULT.md step log

### 5.6 Verification + M6 handoff

- Status: `PENDING`
- Evidence: RESULT.md step log


## 8. Verification commands

- `pnpm verdict:verify-master-plan`
- `cd "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile" && ./gradlew test --quiet`

## 9. Hard bans

- Production APK automation leakage
- Arbitrary SQL query surface
- Event-absence ⇒ SDK failure guessing
- wait_any full-dump polling
- Auto-retry after UNKNOWN_EFFECT
- Silent Cockpit code edits from Mobile playbook

## 10. Next phase handoff

Bu faz kapanınca RESULT.md içinde `phase6Readiness` alanını doldur.
Cockpit playbook'taki ilgili external blocker (B-12/B-13/CP3-DUT vb.) güncellenmeliyse
handoff notu yaz.
