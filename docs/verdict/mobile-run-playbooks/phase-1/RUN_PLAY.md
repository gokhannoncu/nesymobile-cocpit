# Phase M1 RUN_PLAY — SDK Auth + Session Lifecycle Fixture Alignment

```yaml
runPlayId: verdict-mobile-phase-1-run-play
phase: "1"
phaseName: "SDK Auth + Session Lifecycle Fixture Alignment"
status: NOT_STARTED
recoveryState: WAITING_FOR_PHASE_M0
createdAt: "2026-08-06 03:58:00 +03"
startedAt: null
completedAt: null
lastUpdatedAt: "2026-08-06 03:58:00 +03"
timezone: "Europe/Istanbul"
masterPlanPath: "docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:76024d898cb152fe4d885fb18e798cb24b6c3df31715eac546c64383ed5c2bd0"
verifyMasterPlanCommand: "pnpm verdict:verify-master-plan"
cockpitPhaseResult: "docs/verdict/run-playbooks/phase-1/RESULT.md"
previousPhaseResult: "docs/verdict/mobile-run-playbooks/phase-0/RESULT.md"
resultFile: "docs/verdict/mobile-run-playbooks/phase-1/RESULT.md"
mobileRepoRoot: "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile"
mobileSsot: "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-status.json"
```

## 1. Amaç

Phase M1, Mobile SDK'nın Cockpit host ile auth/session lifecycle sözleşmesini
fixture düzeyinde doğrular ve eksik uyumu tamamlar.

Mutual-HMAC probleminin büyük kısmı Cockpit host tarafındadır. Bu faz Mobile'ın
yeniden auth yazması değildir; SDK'nın talep ettiği hello/auth, set_run/end_run,
secret rotation ve session fencing fixture'larının Cockpit contract'larıyla
hizalanmasıdır.

**Başlama:** M0 COMPLETED veya READY_WITH_BLOCKERS sonrası. Sınırlı fixture işi M0 ile paralel planlanabilir.

## 1.1 AI agent'a verilecek başlangıç metni

```text
Verdict Mobile Phase M1 uygula.

Önce şu dosyayı tamamen oku:
docs/verdict/mobile-run-playbooks/phase-1/RUN_PLAY.md

Sonra şu dosyayı oku:
docs/verdict/mobile-run-playbooks/phase-1/RESULT.md

Cockpit karşılığını oku:
docs/verdict/run-playbooks/phase-1/RESULT.md

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

Auth'u sıfırdan yazma. Cockpit host bug'ını Mobile'da çözülmüş sayma. Fixture/contract uyumunu kanıtla. Production WS host değişikliği Cockpit playbook'a handoff.

Kapanışta RESULT.md içine changed files, commands, tests, blockers ve next-phase
readiness yaz.
```

## 2. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `M1` |
| Current step | `1.0` |
| Current state | `WAITING_FOR_PHASE_M0` |
| Last successful step | `1.0` |
| Last attempted step | `1.0` |
| Last update | `2026-08-06 03:58:00 +03` |
| Recovery instruction | `Phase M1 henüz başlamadı. RUN_PLAY §1.1 prompt ile başla. Önkoşulları RESULT precondition gate'inde doğrula.` |

## 3. Kapsam

1. SDK hello/auth fixture ve beklenen hata kodları
2. set_run / end_run / run fencing session lifecycle
3. Secret rotation ve stale secret reject
4. Cockpit auth contract fixture çapraz doğrulama
5. Unauthenticated / wrong-HMAC negatif testler
6. M2 handoff: EmitOutcome diagnostic ihtiyacı netleştirme

## 4. Kapsam dışı

- Cockpit TestEventWsServer production fix (Cockpit Phase 1 owner)
- App Adapter entity query (M4B)
- Bridge wait_any (M3)
- Public SDK Maven publication

## 5. Owned paths

- `docs/verdict/mobile-run-playbooks/phase-1/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-api/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-sdk/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-core/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-contract-fixtures/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/app/src/androidTest/**/verdict*/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-spike/**  # yalnız auth/session fixture spike`

## 6. Read-only context paths

- `docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md`
- `docs/verdict/run-playbooks/phase-1/**`
- `packages/control-contract/**`
- `packages/control-channels/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-status.json`

## 7. Step checklist

### 1.0 Playbook oluşturma

- Status: `DONE`
- Evidence: RESULT.md step log

### 1.1 M0 gate + Cockpit Phase 1 RESULT okuma

- Status: `PENDING`
- Evidence: RESULT.md step log

### 1.2 Mevcut auth/session fixture envanteri

- Status: `PENDING`
- Evidence: RESULT.md step log

### 1.3 hello/auth mutual-HMAC fixture alignment

- Status: `PENDING`
- Evidence: RESULT.md step log

### 1.4 set_run/end_run/secret rotation fixture

- Status: `PENDING`
- Evidence: RESULT.md step log

### 1.5 Negatif auth/fencing testleri

- Status: `PENDING`
- Evidence: RESULT.md step log

### 1.6 Verification + M2 readiness

- Status: `PENDING`
- Evidence: RESULT.md step log


## 8. Verification commands

- `pnpm verdict:verify-master-plan`
- `cd "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile" && ./gradlew :verdict-sdk:test :verdict-core:test --quiet`

## 9. Hard bans

- Production APK automation leakage
- Arbitrary SQL query surface
- Event-absence ⇒ SDK failure guessing
- wait_any full-dump polling
- Auto-retry after UNKNOWN_EFFECT
- Silent Cockpit code edits from Mobile playbook

## 10. Next phase handoff

Bu faz kapanınca RESULT.md içinde `phase2Readiness` alanını doldur.
Cockpit playbook'taki ilgili external blocker (B-12/B-13/CP3-DUT vb.) güncellenmeliyse
handoff notu yaz.
