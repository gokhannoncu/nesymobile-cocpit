# Phase M2 RUN_PLAY — EmitOutcome Diagnostic + WAL/ACK Fixture

```yaml
runPlayId: verdict-mobile-phase-2-run-play
phase: "2"
phaseName: "EmitOutcome Diagnostic + WAL/ACK Fixture"
status: NOT_STARTED
recoveryState: WAITING_FOR_PHASE_M1
createdAt: "2026-08-06 03:58:00 +03"
startedAt: null
completedAt: null
lastUpdatedAt: "2026-08-06 03:58:00 +03"
timezone: "Europe/Istanbul"
masterPlanPath: "docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:5c7e2f6c7da582b5bc6064a6c866476a7adb8e1d4a8a065e0be5067248644771"
verifyMasterPlanCommand: "pnpm verdict:verify-master-plan"
cockpitPhaseResult: "docs/verdict/run-playbooks/phase-2/RESULT.md"
previousPhaseResult: "docs/verdict/mobile-run-playbooks/phase-1/RESULT.md"
resultFile: "docs/verdict/mobile-run-playbooks/phase-2/RESULT.md"
mobileRepoRoot: "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile"
mobileSsot: "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-status.json"
```

## 1. Amaç

Phase M2, host'un "event gelmedi = SDK gönderemedi" tahminini yasaklayan
bounded EmitOutcome diagnostic query'yi Mobile SDK'da tamamlar.

EmitOutcome yerel dönüş değeridir. Diagnostic sorgu yeni durable event üreterek
sonsuz döngü oluşturmamalıdır.

**Başlama:** M1 sonrası tercih; SDK-only diagnostic M1 ile sınırlı paralel olabilir.

## 1.1 AI agent'a verilecek başlangıç metni

```text
Verdict Mobile Phase M2 uygula.

Önce şu dosyayı tamamen oku:
docs/verdict/mobile-run-playbooks/phase-2/RUN_PLAY.md

Sonra şu dosyayı oku:
docs/verdict/mobile-run-playbooks/phase-2/RESULT.md

Cockpit karşılığını oku:
docs/verdict/run-playbooks/phase-2/RESULT.md

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

Diagnostic query yeni event yazmamalı. Cockpit host API'sini Mobile'dan değiştirme. Cockpit Phase 2 RESULT'taki EmitOutcomeDiagnostic sözleşmesine uy.

Kapanışta RESULT.md içine changed files, commands, tests, blockers ve next-phase
readiness yaz.
```

## 2. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `M2` |
| Current step | `2.0` |
| Current state | `WAITING_FOR_PHASE_M1` |
| Last successful step | `2.0` |
| Last attempted step | `2.0` |
| Last update | `2026-08-06 03:58:00 +03` |
| Recovery instruction | `Phase M2 henüz başlamadı. RUN_PLAY §1.1 prompt ile başla. Önkoşulları RESULT precondition gate'inde doğrula.` |

## 3. Kapsam

1. Bounded EmitOutcome diagnostic query (side-effect free)
2. Son emit attempt state: appended / rejected / no_space / write_failed / transport waiting
3. WAL/ACK fixture uyumu
4. Cockpit emit-outcome read model ile contract smoke
5. Recursive event üretmeme negatif test

## 4. Kapsam dışı

- Cockpit durable consumer implementasyonu
- App Adapter business events (M4B)
- Bridge protocol (M3)

## 5. Owned paths

- `docs/verdict/mobile-run-playbooks/phase-2/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-api/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-sdk/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-core/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/app/src/androidTest/**/verdict*/**`

## 6. Read-only context paths

- `docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md`
- `docs/verdict/run-playbooks/phase-2/**`
- `apps/api/src/services/verdict-durable-runtime.ts`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-api/src/main/kotlin/com/verdict/api/EmitOutcome.kt`

## 7. Step checklist

### 2.0 Playbook oluşturma

- Status: `DONE`
- Evidence: RESULT.md step log

### 2.1 M1 gate + Cockpit Phase 2 EmitOutcome port okuma

- Status: `PENDING`
- Evidence: RESULT.md step log

### 2.2 Mevcut EmitOutcome API envanteri

- Status: `PENDING`
- Evidence: RESULT.md step log

### 2.3 Bounded diagnostic query tasarım + implementasyon

- Status: `PENDING`
- Evidence: RESULT.md step log

### 2.4 WAL/ACK / no_space / write_failed fixture

- Status: `PENDING`
- Evidence: RESULT.md step log

### 2.5 Recursion/side-effect negatif test

- Status: `PENDING`
- Evidence: RESULT.md step log

### 2.6 Verification + M3/M5 handoff

- Status: `PENDING`
- Evidence: RESULT.md step log


## 8. Verification commands

- `pnpm verdict:verify-master-plan`
- `cd "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile" && ./gradlew :verdict-core:test :verdict-sdk:test --quiet`

## 9. Hard bans

- Production APK automation leakage
- Arbitrary SQL query surface
- Event-absence ⇒ SDK failure guessing
- wait_any full-dump polling
- Auto-retry after UNKNOWN_EFFECT
- Silent Cockpit code edits from Mobile playbook

## 10. Next phase handoff

Bu faz kapanınca RESULT.md içinde `phase3Readiness` alanını doldur.
Cockpit playbook'taki ilgili external blocker (B-12/B-13/CP3-DUT vb.) güncellenmeliyse
handoff notu yaz.
