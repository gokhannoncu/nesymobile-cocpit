# Phase M8 RUN_PLAY — DUT Fault Matrix + Bridge Hardening Acceptance

```yaml
runPlayId: verdict-mobile-phase-8-run-play
phase: "8"
phaseName: "DUT Fault Matrix + Bridge Hardening Acceptance"
status: NOT_STARTED
recoveryState: WAITING_FOR_PHASE_M7
createdAt: "2026-08-06 03:58:00 +03"
startedAt: null
completedAt: null
lastUpdatedAt: "2026-08-06 03:58:00 +03"
timezone: "Europe/Istanbul"
masterPlanPath: "docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:76024d898cb152fe4d885fb18e798cb24b6c3df31715eac546c64383ed5c2bd0"
verifyMasterPlanCommand: "pnpm verdict:verify-master-plan"
cockpitPhaseResult: "docs/verdict/run-playbooks/phase-8/RESULT.md"
previousPhaseResult: "docs/verdict/mobile-run-playbooks/phase-7/RESULT.md"
resultFile: "docs/verdict/mobile-run-playbooks/phase-8/RESULT.md"
mobileRepoRoot: "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile"
mobileSsot: "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-status.json"
```

## 1. Amaç

Phase M8, process kill, reboot, scanner/payment/fiscal DUT testleri ile
Bridge fencing, IME, foreign-window, manual-touch ve process-death kabulünü kapatır.

**Başlama:** M3 + M7. Lab userdebug/eng DUT şart (CP3-DUT).

## 1.1 AI agent'a verilecek başlangıç metni

```text
Verdict Mobile Phase M8 uygula.

Önce şu dosyayı tamamen oku:
docs/verdict/mobile-run-playbooks/phase-8/RUN_PLAY.md

Sonra şu dosyayı oku:
docs/verdict/mobile-run-playbooks/phase-8/RESULT.md

Cockpit karşılığını oku:
docs/verdict/run-playbooks/phase-8/RESULT.md

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

Production user build üzerinde jest injection ile PASS uydurma. CP3-DUT kapanmadan M8 COMPLETED yazma.

Kapanışta RESULT.md içine changed files, commands, tests, blockers ve next-phase
readiness yaz.
```

## 2. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `M8` |
| Current step | `8.0` |
| Current state | `WAITING_FOR_PHASE_M7` |
| Last successful step | `8.0` |
| Last attempted step | `8.0` |
| Last update | `2026-08-06 03:58:00 +03` |
| Recovery instruction | `Phase M8 henüz başlamadı. RUN_PLAY §1.1 prompt ile başla. Önkoşulları RESULT precondition gate'inde doğrula.` |

## 3. Kapsam

1. Process kill during payment/fiscal/queue/delivery
2. Reboot / cold start recovery observation
3. Scanner/payment/fiscal DUT matrix
4. Bridge fencing + IME obstruction
5. Foreign-window fail-closed
6. Manual-touch contamination (MANUAL vs UNKNOWN)
7. Process-death unknown-effect acceptance
8. Lab allowlist / production deny

## 4. Kapsam dışı

- Maestro removal final (M9)
- Cockpit cutover GO kararı tek başına

## 5. Owned paths

- `docs/verdict/mobile-run-playbooks/phase-8/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-bridge/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/app/src/androidTest/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-status.json`

## 6. Read-only context paths

- `docs/verdict/run-playbooks/phase-8/**`

## 7. Step checklist

### 8.0 Playbook oluşturma

- Status: `DONE`
- Evidence: RESULT.md step log

### 8.1 M7 + Cockpit Phase 8 gate

- Status: `PENDING`
- Evidence: RESULT.md step log

### 8.2 Lab DUT policy doğrulama

- Status: `PENDING`
- Evidence: RESULT.md step log

### 8.3 Process kill / reboot matrix

- Status: `PENDING`
- Evidence: RESULT.md step log

### 8.4 Scanner/payment/fiscal DUT

- Status: `PENDING`
- Evidence: RESULT.md step log

### 8.5 IME / foreign-window / manual-touch

- Status: `PENDING`
- Evidence: RESULT.md step log

### 8.6 Process-death unknown-effect

- Status: `PENDING`
- Evidence: RESULT.md step log

### 8.7 Verification + M9 handoff

- Status: `PENDING`
- Evidence: RESULT.md step log


## 8. Verification commands

- `pnpm verdict:verify-master-plan`
- `node "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/scripts/check-verdict-status.mjs" --summary || true`

## 9. Hard bans

- Production APK automation leakage
- Arbitrary SQL query surface
- Event-absence ⇒ SDK failure guessing
- wait_any full-dump polling
- Auto-retry after UNKNOWN_EFFECT
- Silent Cockpit code edits from Mobile playbook

## 10. Next phase handoff

Bu faz kapanınca RESULT.md içinde `phase9Readiness` alanını doldur.
Cockpit playbook'taki ilgili external blocker (B-12/B-13/CP3-DUT vb.) güncellenmeliyse
handoff notu yaz.
