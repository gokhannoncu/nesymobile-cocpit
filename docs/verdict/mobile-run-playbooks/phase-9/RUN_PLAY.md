# Phase M9 RUN_PLAY — Legacy Maestro / Test Cleanup (Mobile)

```yaml
runPlayId: verdict-mobile-phase-9-run-play
phase: "9"
phaseName: "Legacy Maestro / Test Cleanup (Mobile)"
status: NOT_STARTED
recoveryState: WAITING_FOR_PHASE_M8
createdAt: "2026-08-06 03:58:00 +03"
startedAt: null
completedAt: null
lastUpdatedAt: "2026-08-06 03:58:00 +03"
timezone: "Europe/Istanbul"
masterPlanPath: "docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:5c7e2f6c7da582b5bc6064a6c866476a7adb8e1d4a8a065e0be5067248644771"
verifyMasterPlanCommand: "pnpm verdict:verify-master-plan"
cockpitPhaseResult: "docs/verdict/run-playbooks/phase-8/RESULT.md"
previousPhaseResult: "docs/verdict/mobile-run-playbooks/phase-8/RESULT.md"
resultFile: "docs/verdict/mobile-run-playbooks/phase-9/RESULT.md"
mobileRepoRoot: "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile"
mobileSsot: "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-status.json"
```

## 1. Amaç

Phase M9, Mobile/Bridge tarafında kalan Maestro veya legacy test driver
kalıntılarını, measured cutover sonrası temizler.

**Başlama:** M8 acceptance sonrası. Erken cleanup yasak.

## 1.1 AI agent'a verilecek başlangıç metni

```text
Verdict Mobile Phase M9 uygula.

Önce şu dosyayı tamamen oku:
docs/verdict/mobile-run-playbooks/phase-9/RUN_PLAY.md

Sonra şu dosyayı oku:
docs/verdict/mobile-run-playbooks/phase-9/RESULT.md

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

Measured cutover olmadan legacy silme. Silinen her yüzey için residual scan kanıtı zorunlu.

Kapanışta RESULT.md içine changed files, commands, tests, blockers ve next-phase
readiness yaz.
```

## 2. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `M9` |
| Current step | `9.0` |
| Current state | `WAITING_FOR_PHASE_M8` |
| Last successful step | `9.0` |
| Last attempted step | `9.0` |
| Last update | `2026-08-06 03:58:00 +03` |
| Recovery instruction | `Phase M9 henüz başlamadı. RUN_PLAY §1.1 prompt ile başla. Önkoşulları RESULT precondition gate'inde doğrula.` |

## 3. Kapsam

1. Legacy Maestro/test driver envanteri
2. Kullanılmayan automation helper temizliği
3. Dokümantasyon/SSOT final güncelleme
4. Cutover sonrası residual scan

## 4. Kapsam dışı

- Cockpit Maestro runtime removal
- Yeni feature geliştirme

## 5. Owned paths

- `docs/verdict/mobile-run-playbooks/phase-9/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/app/src/automation/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/docs/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-status.json`

## 6. Read-only context paths

- `docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md`
- `docs/verdict/run-playbooks/**`

## 7. Step checklist

### 9.0 Playbook oluşturma

- Status: `DONE`
- Evidence: RESULT.md step log

### 9.1 M8 gate

- Status: `PENDING`
- Evidence: RESULT.md step log

### 9.2 Legacy inventory

- Status: `PENDING`
- Evidence: RESULT.md step log

### 9.3 Safe removal + residual scan

- Status: `PENDING`
- Evidence: RESULT.md step log

### 9.4 SSOT final + handoff

- Status: `PENDING`
- Evidence: RESULT.md step log


## 8. Verification commands

- `pnpm verdict:verify-master-plan`
- `rg -n "maestro|Maestro" "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/app/src/automation" "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-bridge" || true`

## 9. Hard bans

- Production APK automation leakage
- Arbitrary SQL query surface
- Event-absence ⇒ SDK failure guessing
- wait_any full-dump polling
- Auto-retry after UNKNOWN_EFFECT
- Silent Cockpit code edits from Mobile playbook

## 10. Next phase handoff

Bu faz kapanınca RESULT.md içinde `mobileCutoverReadiness` alanını doldur.
Cockpit playbook'taki ilgili external blocker (B-12/B-13/CP3-DUT vb.) güncellenmeliyse
handoff notu yaz.
