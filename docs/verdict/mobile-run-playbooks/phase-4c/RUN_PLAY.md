# Phase M4c RUN_PLAY — Mobile Compatibility + Contract Fixtures

```yaml
runPlayId: verdict-mobile-phase-4c-run-play
phase: "4c"
phaseName: "Mobile Compatibility + Contract Fixtures"
status: NOT_STARTED
recoveryState: WAITING_FOR_PHASE_M4B
createdAt: "2026-08-06 03:58:00 +03"
startedAt: null
completedAt: null
lastUpdatedAt: "2026-08-06 03:58:00 +03"
timezone: "Europe/Istanbul"
masterPlanPath: "docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:5c7e2f6c7da582b5bc6064a6c866476a7adb8e1d4a8a065e0be5067248644771"
verifyMasterPlanCommand: "pnpm verdict:verify-master-plan"
cockpitPhaseResult: "docs/verdict/run-playbooks/phase-4c/RESULT.md"
previousPhaseResult: "docs/verdict/mobile-run-playbooks/phase-4b/RESULT.md"
resultFile: "docs/verdict/mobile-run-playbooks/phase-4c/RESULT.md"
mobileRepoRoot: "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile"
mobileSsot: "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-status.json"
```

## 1. Amaç

Phase M4C, App Adapter + Bridge capability'lerinin Cockpit BridgeFlowCompiler /
UiWaitPlan / Domain Pack beklentileriyle uyum fixture'larını kilitler.

**Başlama:** M4B sonrası. Cockpit 4C COMPLETED tercih.

## 1.1 AI agent'a verilecek başlangıç metni

```text
Verdict Mobile Phase M4c uygula.

Önce şu dosyayı tamamen oku:
docs/verdict/mobile-run-playbooks/phase-4c/RUN_PLAY.md

Sonra şu dosyayı oku:
docs/verdict/mobile-run-playbooks/phase-4c/RESULT.md

Cockpit karşılığını oku:
docs/verdict/run-playbooks/phase-4c/RESULT.md

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

Cockpit compiler'ı Mobile'dan değiştirme. Contract drift varsa her iki repo lock/fixture owner'ını RESULT'ta ayır.

Kapanışta RESULT.md içine changed files, commands, tests, blockers ve next-phase
readiness yaz.
```

## 2. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `M4c` |
| Current step | `4c.0` |
| Current state | `WAITING_FOR_PHASE_M4B` |
| Last successful step | `4c.0` |
| Last attempted step | `4c.0` |
| Last update | `2026-08-06 03:58:00 +03` |
| Recovery instruction | `Phase M4c henüz başlamadı. RUN_PLAY §1.1 prompt ile başla. Önkoşulları RESULT precondition gate'inde doğrula.` |

## 3. Kapsam

1. Pack ↔ adapter capability compatibility fixtures
2. UiWaitPlan / wait_any command contract uyumu
3. Unsupported capability fail-closed testleri
4. SHA-pinned contract fixture güncellemesi (gerekirse)

## 4. Kapsam dışı

- Compiler implementasyonu (Cockpit)
- Executor (Cockpit Phase 5)
- Yeni business macro

## 5. Owned paths

- `docs/verdict/mobile-run-playbooks/phase-4c/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-contract-fixtures/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/app/src/androidTest/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-bridge/**  # yalnız contract uyum fix`

## 6. Read-only context paths

- `docs/verdict/run-playbooks/phase-4c/**`
- `packages/bridgeflow-compiler/**`
- `domain-packs/nesy-courier/**`

## 7. Step checklist

### 4c.0 Playbook oluşturma

- Status: `DONE`
- Evidence: RESULT.md step log

### 4c.1 M4B + Cockpit 4C gate

- Status: `PENDING`
- Evidence: RESULT.md step log

### 4c.2 Capability matrix fixture

- Status: `PENDING`
- Evidence: RESULT.md step log

### 4c.3 wait_any/cancel contract uyum testleri

- Status: `PENDING`
- Evidence: RESULT.md step log

### 4c.4 Negative unsupported/ambiguous fixtures

- Status: `PENDING`
- Evidence: RESULT.md step log

### 4c.5 Verification + M5 handoff

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

Bu faz kapanınca RESULT.md içinde `phase5Readiness` alanını doldur.
Cockpit playbook'taki ilgili external blocker (B-12/B-13/CP3-DUT vb.) güncellenmeliyse
handoff notu yaz.
