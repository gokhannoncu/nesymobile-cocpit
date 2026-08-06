# Phase M7 RUN_PLAY — Real Nesy Flows + Fault/Recovery + Release Isolation

```yaml
runPlayId: verdict-mobile-phase-7-run-play
phase: "7"
phaseName: "Real Nesy Flows + Fault/Recovery + Release Isolation"
status: NOT_STARTED
recoveryState: WAITING_FOR_PHASE_M4B_AND_M5
createdAt: "2026-08-06 03:58:00 +03"
startedAt: null
completedAt: null
lastUpdatedAt: "2026-08-06 03:58:00 +03"
timezone: "Europe/Istanbul"
masterPlanPath: "docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:76024d898cb152fe4d885fb18e798cb24b6c3df31715eac546c64383ed5c2bd0"
verifyMasterPlanCommand: "pnpm verdict:verify-master-plan"
cockpitPhaseResult: "docs/verdict/run-playbooks/phase-7/RESULT.md"
previousPhaseResult: "docs/verdict/mobile-run-playbooks/phase-6/RESULT.md"
resultFile: "docs/verdict/mobile-run-playbooks/phase-7/RESULT.md"
mobileRepoRoot: "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile"
mobileSsot: "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-status.json"
```

## 1. Amaç

Phase M7, gerçek Nesy akışlarında App Adapter + SDK + Bridge'in birlikte
çalıştığını, fault/recovery observation'ın işe yaradığını ve release isolation'ın
production APK'da tutulduğunu kanıtlar.

**Başlama:** M4B + M5. Full PASS için real DUT. Cockpit Phase 7 ile ortak acceptance.

## 1.1 AI agent'a verilecek başlangıç metni

```text
Verdict Mobile Phase M7 uygula.

Önce şu dosyayı tamamen oku:
docs/verdict/mobile-run-playbooks/phase-7/RUN_PLAY.md

Sonra şu dosyayı oku:
docs/verdict/mobile-run-playbooks/phase-7/RESULT.md

Cockpit karşılığını oku:
docs/verdict/run-playbooks/phase-7/RESULT.md

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

DUT yoksa FULL PASS yazma; BLOCKED_EXTERNAL. Setup launch'ı ürün PASS sayma. Release isolation fail ise M7 FAILED.

Kapanışta RESULT.md içine changed files, commands, tests, blockers ve next-phase
readiness yaz.
```

## 2. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `M7` |
| Current step | `7.0` |
| Current state | `WAITING_FOR_PHASE_M4B_AND_M5` |
| Last successful step | `7.0` |
| Last attempted step | `7.0` |
| Last update | `2026-08-06 03:58:00 +03` |
| Recovery instruction | `Phase M7 henüz başlamadı. RUN_PLAY §1.1 prompt ile başla. Önkoşulları RESULT precondition gate'inde doğrula.` |

## 3. Kapsam

1. Field Login / Load Tour / courier slice cihaz kanıtları (Mobile tarafı)
2. Scanner real/injected/manual origin raporlama
3. DIRECT_STATE / PREPARED_SESSION isolation asserts
4. Fault/recovery: process kill sonrası local/queue/payment/fiscal observation
5. Production APK automation yüzey sızıntı kapısı
6. Cockpit Phase 7 ile ortak DUT kanıt paketleme

## 4. Kapsam dışı

- Maestro orchestrator yolu
- Cockpit UI cutover kodu
- Public SDK publish

## 5. Owned paths

- `docs/verdict/mobile-run-playbooks/phase-7/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/app/src/automation/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/app/src/androidTest/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-bridge/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-status.json`

## 6. Read-only context paths

- `docs/verdict/run-playbooks/phase-7/**`
- `domain-packs/nesy-courier/**`

## 7. Step checklist

### 7.0 Playbook oluşturma

- Status: `DONE`
- Evidence: RESULT.md step log

### 7.1 M4B/M5/M6 + Cockpit Phase 7 gate

- Status: `PENDING`
- Evidence: RESULT.md step log

### 7.2 Device/build variant baseline

- Status: `PENDING`
- Evidence: RESULT.md step log

### 7.3 Real flow Mobile evidence paketleri

- Status: `PENDING`
- Evidence: RESULT.md step log

### 7.4 Scanner/launch isolation acceptance

- Status: `PENDING`
- Evidence: RESULT.md step log

### 7.5 Fault/recovery observation acceptance

- Status: `PENDING`
- Evidence: RESULT.md step log

### 7.6 Release isolation final gate

- Status: `PENDING`
- Evidence: RESULT.md step log

### 7.7 Verification + M8 handoff

- Status: `PENDING`
- Evidence: RESULT.md step log


## 8. Verification commands

- `pnpm verdict:verify-master-plan`
- `cd "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile" && ./gradlew :app:assembleProduction :app:assembleAutomationRelease --quiet`

## 9. Hard bans

- Production APK automation leakage
- Arbitrary SQL query surface
- Event-absence ⇒ SDK failure guessing
- wait_any full-dump polling
- Auto-retry after UNKNOWN_EFFECT
- Silent Cockpit code edits from Mobile playbook

## 10. Next phase handoff

Bu faz kapanınca RESULT.md içinde `phase8Readiness` alanını doldur.
Cockpit playbook'taki ilgili external blocker (B-12/B-13/CP3-DUT vb.) güncellenmeliyse
handoff notu yaz.
