# Phase M0 RUN_PLAY — Mobile Baseline + Inventory + Gap Matrix

```yaml
runPlayId: verdict-mobile-phase-0-run-play
phase: "0"
phaseName: "Mobile Baseline + Inventory + Gap Matrix"
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
cockpitPhaseResult: "docs/verdict/run-playbooks/phase-0/RESULT.md"
resultFile: "docs/verdict/mobile-run-playbooks/phase-0/RESULT.md"
mobileRepoRoot: "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile"
mobileSsot: "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-status.json"
```

## 1. Amaç

Phase M0, Mobile/Bridge production işine başlamadan önce mevcut seam envanterini,
named-query/evidence gap matrisini, release isolation baseline'ını ve Cockpit Domain Pack
contract referanslarıyla uyumu çıkarır.

Bu fazda hedef yeni adapter yazmak değildir. Hedef, M1–M8 işlerinin başarı/başarısızlık
sinyalini mevcut borçtan ayırabilecek ölçüm ve ihtiyaç listesi kurmaktır.

**Başlama:** Hemen. Cockpit kapısı yok.

## 1.1 AI agent'a verilecek başlangıç metni

```text
Verdict Mobile Phase M0 uygula.

Önce şu dosyayı tamamen oku:
docs/verdict/mobile-run-playbooks/phase-0/RUN_PLAY.md

Sonra şu dosyayı oku:
docs/verdict/mobile-run-playbooks/phase-0/RESULT.md

Cockpit karşılığını oku:
docs/verdict/run-playbooks/phase-0/RESULT.md

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

Sadece envanter, gap, tasarım ve baseline kanıtı üret. Kod/refactor yazma. Fake inventory uydurma; dosya yoksa gap yaz. Sonuçta M1/M3/M4B için net şimdi-yapılabilir handoff listesi bırak.

Kapanışta RESULT.md içine changed files, commands, tests, blockers ve next-phase
readiness yaz.
```

## 2. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `M0` |
| Current step | `0.0` |
| Current state | `READY_TO_START` |
| Last successful step | `0.0` |
| Last attempted step | `0.0` |
| Last update | `2026-08-06 03:58:00 +03` |
| Recovery instruction | `Phase M0 henüz başlamadı. RUN_PLAY §1.1 prompt ile başla. Önkoşulları RESULT precondition gate'inde doğrula.` |

## 3. Kapsam

1. Mobile `verdict-status.json` okuma ve Cockpit playbook blocker eşlemesi
2. Mevcut `NesyCommands` / `NesyStateProvider` / `roomQueries` / structured event envanteri
3. Cockpit `domain-packs/nesy-courier` adapter query/setup ref gap listesi
4. Eksik evidence matrisi (query/observer vs explicit event)
5. Scanner mode tasarım notu (REAL/INJECTED/MANUAL) + release gate
6. Launch Profile ayrımı notu (FULL_JOURNEY / PREPARED_SESSION / DIRECT_STATE)
7. App Adapter compatibility manifest taslağı
8. Release isolation inventory (exported surfaces, automation class leakage risk)
9. Bridge mevcut command set / B1 durumu / B-12/B-13 notları
10. M1 readiness kararını RESULT'a yazma

## 4. Kapsam dışı

- Production App Adapter refactor (M4B)
- Bridge wait_any implementasyonu (M3)
- EmitOutcome diagnostic query kodu (M2)
- Cockpit API/Web kod değişikliği
- Maestro removal
- Gerçek DUT mutation acceptance

## 5. Owned paths

- `docs/verdict/mobile-run-playbooks/phase-0/**`
- `docs/verdict/mobile-run-playbooks/README.md`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/docs/verdict/mobile-m0-inventory.md  # optional artifact`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-status.json  # yalnız kanıtlı güncelleme`

## 6. Read-only context paths

- `docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md`
- `docs/verdict/run-playbooks/**`
- `domain-packs/nesy-courier/**`
- `packages/domain-pack-contracts/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-status.json`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/app/src/automation/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-bridge/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-api/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-sdk/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-core/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/VERDICT_START.md`

## 7. Step checklist

### 0.0 Playbook oluşturma

- Status: `DONE`
- Evidence: RESULT.md step log

### 0.1 Master plan + Cockpit phase-0/3/4b RESULT okuma

- Status: `PENDING`
- Evidence: RESULT.md step log

### 0.2 Mobile git/worktree + verdict-status.json özeti

- Status: `PENDING`
- Evidence: RESULT.md step log

### 0.3 Automation seam envanteri (commands/state/query/event)

- Status: `PENDING`
- Evidence: RESULT.md step log

### 0.4 Named-query ihtiyaç vs Cockpit pack gap tablosu

- Status: `PENDING`
- Evidence: RESULT.md step log

### 0.5 Evidence matrisi (explicit event adayları)

- Status: `PENDING`
- Evidence: RESULT.md step log

### 0.6 Scanner + Launch Profile tasarım notu

- Status: `PENDING`
- Evidence: RESULT.md step log

### 0.7 App Adapter compatibility manifest taslağı

- Status: `PENDING`
- Evidence: RESULT.md step log

### 0.8 Release isolation inventory

- Status: `PENDING`
- Evidence: RESULT.md step log

### 0.9 Bridge B1/B2 + B-12/B-13 baseline notları

- Status: `PENDING`
- Evidence: RESULT.md step log

### 0.10 Verification + M1 readiness handoff

- Status: `PENDING`
- Evidence: RESULT.md step log


## 8. Verification commands

- `pnpm verdict:verify-master-plan`
- `node "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/scripts/check-verdict-status.mjs" --summary || true`
- `git -C "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile" status --short`
- `test -f docs/verdict/mobile-run-playbooks/phase-0/RESULT.md`

## 9. Hard bans

- Production APK automation leakage
- Arbitrary SQL query surface
- Event-absence ⇒ SDK failure guessing
- wait_any full-dump polling
- Auto-retry after UNKNOWN_EFFECT
- Silent Cockpit code edits from Mobile playbook

## 10. Next phase handoff

Bu faz kapanınca RESULT.md içinde `phase1Readiness` alanını doldur.
Cockpit playbook'taki ilgili external blocker (B-12/B-13/CP3-DUT vb.) güncellenmeliyse
handoff notu yaz.
