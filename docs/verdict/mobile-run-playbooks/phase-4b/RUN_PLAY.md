# Phase M4b RUN_PLAY — Nesy App Adapter Production

```yaml
runPlayId: verdict-mobile-phase-4b-run-play
phase: "4b"
phaseName: "Nesy App Adapter Production"
status: NOT_STARTED
recoveryState: WAITING_FOR_PHASE_M0_AND_COCKPIT_4B
createdAt: "2026-08-06 03:58:00 +03"
startedAt: null
completedAt: null
lastUpdatedAt: "2026-08-06 03:58:00 +03"
timezone: "Europe/Istanbul"
masterPlanPath: "docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:5c7e2f6c7da582b5bc6064a6c866476a7adb8e1d4a8a065e0be5067248644771"
verifyMasterPlanCommand: "pnpm verdict:verify-master-plan"
cockpitPhaseResult: "docs/verdict/run-playbooks/phase-4b/RESULT.md"
previousPhaseResult: "docs/verdict/mobile-run-playbooks/phase-4a/RESULT.md"
resultFile: "docs/verdict/mobile-run-playbooks/phase-4b/RESULT.md"
mobileRepoRoot: "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile"
mobileSsot: "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-status.json"
```

## 1. Amaç

Phase M4B, Nesy Mobile'daki en kritik teslimdir: mevcut automation seam'lerini
versioned Nesy Automation App Adapter altında toplamak ve Cockpit Domain Pack'in
beklediği named query / evidence / scanner / launch capability'lerini sağlamak.

İkinci paralel adapter yazılmaz. NesyCommands / NesyStateProvider / roomQueries /
structured events refactor edilir.

**Başlama:** M0 inventory + Cockpit Phase 4B contract COMPLETED (şu an açık). M4A thin gate önerilir.

## 1.1 AI agent'a verilecek başlangıç metni

```text
Verdict Mobile Phase M4b uygula.

Önce şu dosyayı tamamen oku:
docs/verdict/mobile-run-playbooks/phase-4b/RUN_PLAY.md

Sonra şu dosyayı oku:
docs/verdict/mobile-run-playbooks/phase-4b/RESULT.md

Cockpit karşılığını oku:
docs/verdict/run-playbooks/phase-4b/RESULT.md

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

İkinci adapter yazma. Production'a DIRECT_STATE/scanner injection sızdırma. Named query allowlist dışına çıkma. Pack ref isimlerini koru (nesy.availableStops vb.). Setup launch'ı login PASS sayma.

Kapanışta RESULT.md içine changed files, commands, tests, blockers ve next-phase
readiness yaz.
```

## 2. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `M4b` |
| Current step | `4b.0` |
| Current state | `WAITING_FOR_PHASE_M0_AND_COCKPIT_4B` |
| Last successful step | `4b.0` |
| Last attempted step | `4b.0` |
| Last update | `2026-08-06 03:58:00 +03` |
| Recovery instruction | `Phase M4b henüz başlamadı. RUN_PLAY §1.1 prompt ile başla. Önkoşulları RESULT precondition gate'inde doğrula.` |

## 3. Kapsam

1. App Adapter package/source-set sınırları (automation / automationRelease)
2. Named queries: availableStops, stopState, taskState, parcelState, pendingOperation, sessionState, routeState
3. Entity target binding provider
4. Critical evidence hooks (yalnız başka yolla gözlenemeyenler)
5. Scanner REAL/INJECTED/MANUAL (injected yalnız automation build)
6. Launch: FULL_JOURNEY / PREPARED_SESSION / DIRECT_STATE + cleanup/audit
7. Compatibility manifest + capability handshake
8. Release isolation: production sızıntı yok assert
9. Fault/recovery observation query yüzeyi

## 4. Kapsam dışı

- Bridge wait_any (M3)
- Cockpit Domain Pack yeniden yazımı
- Core/Bridge içine business type
- Maestro YAML üretimi
- Arbitrary SQL

## 5. Owned paths

- `docs/verdict/mobile-run-playbooks/phase-4b/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/app/src/automation/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/app/src/automationRelease/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/app/src/main/**  # yalnız zorunlu seam wiring`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-api/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-sdk/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/docs/**`

## 6. Read-only context paths

- `docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md`
- `docs/verdict/run-playbooks/phase-4b/**`
- `domain-packs/nesy-courier/**`
- `packages/domain-pack-contracts/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/app/src/production/**`

## 7. Step checklist

### 4b.0 Playbook oluşturma

- Status: `DONE`
- Evidence: RESULT.md step log

### 4b.1 M0 + Cockpit 4B gate doğrulama

- Status: `PENDING`
- Evidence: RESULT.md step log

### 4b.2 Existing seam → adapter mapping planı

- Status: `PENDING`
- Evidence: RESULT.md step log

### 4b.3 Adapter scaffold + capability manifest

- Status: `PENDING`
- Evidence: RESULT.md step log

### 4b.4 Named query allowlist implementasyonu

- Status: `PENDING`
- Evidence: RESULT.md step log

### 4b.5 Entity binding + state projection

- Status: `PENDING`
- Evidence: RESULT.md step log

### 4b.6 Critical evidence hooks (bounded)

- Status: `PENDING`
- Evidence: RESULT.md step log

### 4b.7 Scanner modes + release guard

- Status: `PENDING`
- Evidence: RESULT.md step log

### 4b.8 Launch profiles + cleanup/audit

- Status: `PENDING`
- Evidence: RESULT.md step log

### 4b.9 Recovery observation queries

- Status: `PENDING`
- Evidence: RESULT.md step log

### 4b.10 Release isolation tests

- Status: `PENDING`
- Evidence: RESULT.md step log

### 4b.11 Verification + M4C handoff

- Status: `PENDING`
- Evidence: RESULT.md step log


## 8. Verification commands

- `pnpm verdict:verify-master-plan`
- `cd "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile" && ./gradlew :app:assembleAutomationRelease :app:assembleProduction --quiet`

## 9. Hard bans

- Production APK automation leakage
- Arbitrary SQL query surface
- Event-absence ⇒ SDK failure guessing
- wait_any full-dump polling
- Auto-retry after UNKNOWN_EFFECT
- Silent Cockpit code edits from Mobile playbook

## 10. Next phase handoff

Bu faz kapanınca RESULT.md içinde `phase4cReadiness` alanını doldur.
Cockpit playbook'taki ilgili external blocker (B-12/B-13/CP3-DUT vb.) güncellenmeliyse
handoff notu yaz.
