# Phase M6 RUN_PLAY — Inspector Mapping + Bridge Diagnostic Artifacts

```yaml
runPlayId: verdict-mobile-phase-6-run-play
phase: "6"
phaseName: "Inspector Mapping + Bridge Diagnostic Artifacts"
status: NOT_STARTED
recoveryState: WAITING_FOR_PHASE_M5
createdAt: "2026-08-06 03:58:00 +03"
startedAt: null
completedAt: null
lastUpdatedAt: "2026-08-06 03:58:00 +03"
timezone: "Europe/Istanbul"
masterPlanPath: "docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:76024d898cb152fe4d885fb18e798cb24b6c3df31715eac546c64383ed5c2bd0"
verifyMasterPlanCommand: "pnpm verdict:verify-master-plan"
cockpitPhaseResult: "docs/verdict/run-playbooks/phase-6/RESULT.md"
previousPhaseResult: "docs/verdict/mobile-run-playbooks/phase-5/RESULT.md"
resultFile: "docs/verdict/mobile-run-playbooks/phase-6/RESULT.md"
mobileRepoRoot: "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile"
mobileSsot: "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-status.json"
```

## 1. Amaç

Phase M6, Cockpit Live Inspector için Mobile/Bridge mapping, scoped dump,
screenshot ve redaction desteğini tamamlar.

**Başlama:** M3 + M5 kısmi. Cockpit Phase 6 UI ile paralel olabilir.

## 1.1 AI agent'a verilecek başlangıç metni

```text
Verdict Mobile Phase M6 uygula.

Önce şu dosyayı tamamen oku:
docs/verdict/mobile-run-playbooks/phase-6/RUN_PLAY.md

Sonra şu dosyayı oku:
docs/verdict/mobile-run-playbooks/phase-6/RESULT.md

Cockpit karşılığını oku:
docs/verdict/run-playbooks/phase-6/RESULT.md

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

Sensitive data redaction olmadan screenshot/dump acceptance yazma. Inspector Act admission Cockpit işi.

Kapanışta RESULT.md içine changed files, commands, tests, blockers ve next-phase
readiness yaz.
```

## 2. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `M6` |
| Current step | `6.0` |
| Current state | `WAITING_FOR_PHASE_M5` |
| Last successful step | `6.0` |
| Last attempted step | `6.0` |
| Last update | `2026-08-06 03:58:00 +03` |
| Recovery instruction | `Phase M6 henüz başlamadı. RUN_PLAY §1.1 prompt ile başla. Önkoşulları RESULT precondition gate'inde doğrula.` |

## 3. Kapsam

1. Inspector mapping/evidence destek yüzeyleri
2. Scoped dump / matched subtree / target resolution trace
3. Screenshot artifact + PIN/token/PII/barcode/payment redaction
4. Ambiguity candidate diagnostic (action üretmeden)

## 4. Kapsam dışı

- Cockpit Inspector UI route implementasyonu
- Full dump hot-path wait
- Act mutation without admission

## 5. Owned paths

- `docs/verdict/mobile-run-playbooks/phase-6/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-bridge/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/app/src/automation/**  # mapping/evidence gerekirse`

## 6. Read-only context paths

- `docs/verdict/run-playbooks/phase-6/**`
- `apps/web/src/components/debug-view/inspector/**`

## 7. Step checklist

### 6.0 Playbook oluşturma

- Status: `DONE`
- Evidence: RESULT.md step log

### 6.1 M5 + Cockpit Phase 6 gate

- Status: `PENDING`
- Evidence: RESULT.md step log

### 6.2 Dump/screenshot capability

- Status: `PENDING`
- Evidence: RESULT.md step log

### 6.3 Redaction policy tests

- Status: `PENDING`
- Evidence: RESULT.md step log

### 6.4 Target resolution trace artifact

- Status: `PENDING`
- Evidence: RESULT.md step log

### 6.5 Verification + M7 handoff

- Status: `PENDING`
- Evidence: RESULT.md step log


## 8. Verification commands

- `pnpm verdict:verify-master-plan`
- `cd "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile" && ./gradlew :verdict-bridge:test --quiet`

## 9. Hard bans

- Production APK automation leakage
- Arbitrary SQL query surface
- Event-absence ⇒ SDK failure guessing
- wait_any full-dump polling
- Auto-retry after UNKNOWN_EFFECT
- Silent Cockpit code edits from Mobile playbook

## 10. Next phase handoff

Bu faz kapanınca RESULT.md içinde `phase7Readiness` alanını doldur.
Cockpit playbook'taki ilgili external blocker (B-12/B-13/CP3-DUT vb.) güncellenmeliyse
handoff notu yaz.
