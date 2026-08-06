# Phase M4a RUN_PLAY — Mobile Core-Contract Alignment (thin)

```yaml
runPlayId: verdict-mobile-phase-4a-run-play
phase: "4a"
phaseName: "Mobile Core-Contract Alignment (thin)"
status: NOT_STARTED
recoveryState: READY_TO_START
createdAt: "2026-08-06 03:58:00 +03"
startedAt: null
completedAt: null
lastUpdatedAt: "2026-08-06 03:58:00 +03"
timezone: "Europe/Istanbul"
masterPlanPath: "docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:76024d898cb152fe4d885fb18e798cb24b6c3df31715eac546c64383ed5c2bd0"
verifyMasterPlanCommand: "pnpm verdict:verify-master-plan"
cockpitPhaseResult: "docs/verdict/run-playbooks/phase-4a/RESULT.md"
previousPhaseResult: "docs/verdict/mobile-run-playbooks/phase-3/RESULT.md"
resultFile: "docs/verdict/mobile-run-playbooks/phase-4a/RESULT.md"
mobileRepoRoot: "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile"
mobileSsot: "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-status.json"
```

## 1. Amaç

Phase M4A, Mobile tarafında neredeyse iş üretmez.

Cockpit CP4A tamamlanmıştır. Bu faz yalnız Mobile/Bridge'in Core contract'a domain
type sızdırmadığını ve M4B'nin başlayabileceğini doğrulayan ince bir kapıdır.

**Başlama:** Cockpit Phase 4A COMPLETED (şu an açık). M3 soft.

## 1.1 AI agent'a verilecek başlangıç metni

```text
Verdict Mobile Phase M4a uygula.

Önce şu dosyayı tamamen oku:
docs/verdict/mobile-run-playbooks/phase-4a/RUN_PLAY.md

Sonra şu dosyayı oku:
docs/verdict/mobile-run-playbooks/phase-4a/RESULT.md

Cockpit karşılığını oku:
docs/verdict/run-playbooks/phase-4a/RESULT.md

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

Kod yazma zorunlu değil. Leakage varsa blocker yaz. M4B'yi bu kapı olmadan COMPLETED sayma.

Kapanışta RESULT.md içine changed files, commands, tests, blockers ve next-phase
readiness yaz.
```

## 2. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `M4a` |
| Current step | `4a.0` |
| Current state | `READY_TO_START` |
| Last successful step | `4a.0` |
| Last attempted step | `4a.0` |
| Last update | `2026-08-06 03:58:00 +03` |
| Recovery instruction | `Phase M4a henüz başlamadı. RUN_PLAY §1.1 prompt ile başla. Önkoşulları RESULT precondition gate'inde doğrula.` |

## 3. Kapsam

1. Cockpit CP4A RESULT okuma
2. Mobile/Bridge domain business type leakage tarama
3. M4B start gate kararını yazma

## 4. Kapsam dışı

- App Adapter production (M4B)
- WorkflowIR değişikliği
- Bridge wait_any (M3)

## 5. Owned paths

- `docs/verdict/mobile-run-playbooks/phase-4a/**`

## 6. Read-only context paths

- `docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md`
- `docs/verdict/run-playbooks/phase-4a/**`
- `packages/workflow-contract/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-bridge/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/app/src/automation/**`

## 7. Step checklist

### 4a.0 Playbook oluşturma

- Status: `DONE`
- Evidence: RESULT.md step log

### 4a.1 Cockpit CP4A RESULT doğrulama

- Status: `PENDING`
- Evidence: RESULT.md step log

### 4a.2 Mobile/Bridge domain leakage scan

- Status: `PENDING`
- Evidence: RESULT.md step log

### 4a.3 M4B readiness handoff

- Status: `PENDING`
- Evidence: RESULT.md step log


## 8. Verification commands

- `pnpm verdict:verify-master-plan`
- `rg -n "OPEN_STOP|APPROVE_TOUR|COURIER_LOGIN" "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-bridge" "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-api" || true`

## 9. Hard bans

- Production APK automation leakage
- Arbitrary SQL query surface
- Event-absence ⇒ SDK failure guessing
- wait_any full-dump polling
- Auto-retry after UNKNOWN_EFFECT
- Silent Cockpit code edits from Mobile playbook

## 10. Next phase handoff

Bu faz kapanınca RESULT.md içinde `phase4bReadiness` alanını doldur.
Cockpit playbook'taki ilgili external blocker (B-12/B-13/CP3-DUT vb.) güncellenmeliyse
handoff notu yaz.
