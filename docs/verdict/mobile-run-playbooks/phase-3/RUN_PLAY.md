# Phase M3 RUN_PLAY — Bridge B2 Protocol (wait_any / cancel / capabilities)

```yaml
runPlayId: verdict-mobile-phase-3-run-play
phase: "3"
phaseName: "Bridge B2 Protocol (wait_any / cancel / capabilities)"
status: NOT_STARTED
recoveryState: READY_TO_START
createdAt: "2026-08-06 03:58:00 +03"
startedAt: null
completedAt: null
lastUpdatedAt: "2026-08-06 07:42:00 +03"
timezone: "Europe/Istanbul"
masterPlanPath: "docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:5c7e2f6c7da582b5bc6064a6c866476a7adb8e1d4a8a065e0be5067248644771"
verifyMasterPlanCommand: "pnpm verdict:verify-master-plan"
cockpitPhaseResult: "docs/verdict/run-playbooks/phase-3/RESULT.md"
previousPhaseResult: "docs/verdict/mobile-run-playbooks/phase-2/RESULT.md"
resultFile: "docs/verdict/mobile-run-playbooks/phase-3/RESULT.md"
mobileRepoRoot: "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile"
mobileSsot: "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-status.json"
```

## 1. Amaç

Phase M3, Bridge APK üzerindeki ana B2 işidir.

Cockpit Phase 3 host foundation kurulmuştur; cihazda wait_any / cancel_request /
capabilities yoktur (B-13). Bu faz Bridge APK + contract fixture + fake host client
ile paralel ilerler.

**Başlama:** Hemen. Cockpit Phase 3 host foundation mevcut. M0/M1/M2 soft bağımlılık.

## 1.1 AI agent'a verilecek başlangıç metni

```text
Verdict Mobile Phase M3 uygula.

Önce şu dosyayı tamamen oku:
docs/verdict/mobile-run-playbooks/phase-3/RUN_PLAY.md

Sonra şu dosyayı oku:
docs/verdict/mobile-run-playbooks/phase-3/RESULT.md

Cockpit karşılığını oku:
docs/verdict/run-playbooks/phase-3/RESULT.md

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

B-13'ü kapatmak bu fazın ana teslimidir. wait_any full dump polling yapmasın. Process death'te otomatik retry yazma. Cockpit apps/** değiştirme. Fake host ile kanıtlanmayan acceptance'ı COMPLETED yazma; DUT ayrı işaretle.

Kapanışta RESULT.md içine changed files, commands, tests, blockers ve next-phase
readiness yaz.
```

## 2. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `M3` |
| Current step | `3.0` |
| Current state | `READY_TO_START` |
| Last successful step | `3.0` |
| Last attempted step | `3.0` |
| Last update | `2026-08-06 07:42:00 +03` |
| Recovery instruction | `M2 COMPLETED. M3 READY_TO_START — Bridge B2 (wait_any/cancel/capabilities) fake host ile başlayabilir.` |

## 3. Kapsam

1. Bridge capabilities / preflight (version, protocol, a11y, commands, ping, monoTs)
2. wait_any expected vs interrupt local race
3. cancel_request + cancellable worker + request registry + serialized writer
4. Event-driven reevaluation; hot-path full dump yasak
5. TargetFingerprint + ambiguity/stale/foreign-window fail-closed
6. Request idempotency + request_id_conflict
7. Action lifecycle metadata
8. Process-death → UNKNOWN_EFFECT / RECONCILIATION_REQUIRED (otomatik retry yok)
9. B-12 smoke handshake flake izolasyonu
10. Fake host client acceptance suite

## 4. Kapsam dışı

- Cockpit bridge-client yeniden yazımı
- Domain business types in Bridge
- Persistent register_watch / unsolicited push
- App Adapter entity queries (M4B)
- Maestro cutover (M8/M9)

## 5. Owned paths

- `docs/verdict/mobile-run-playbooks/phase-3/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-bridge/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-contract-fixtures/**`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-spike/**  # bridge B2 spike/harness`
- `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-status.json  # bridge_b2 evidence ile`

## 6. Read-only context paths

- `docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md`
- `docs/verdict/run-playbooks/phase-3/**`
- `packages/bridge-contract/**`
- `packages/bridge-client/**`
- `apps/api/src/services/**/bridge*`

## 7. Step checklist

### 3.0 Playbook oluşturma

- Status: `DONE`
- Evidence: RESULT.md step log

### 3.1 Cockpit Phase 3 RESULT + B-12/B-13 okuma

- Status: `PENDING`
- Evidence: RESULT.md step log

### 3.2 Mevcut Bridge command set envanteri

- Status: `PENDING`
- Evidence: RESULT.md step log

### 3.3 capabilities/preflight

- Status: `PENDING`
- Evidence: RESULT.md step log

### 3.4 wait_any expected/interrupt

- Status: `PENDING`
- Evidence: RESULT.md step log

### 3.5 cancel_request + request registry

- Status: `PENDING`
- Evidence: RESULT.md step log

### 3.6 Event-driven reevaluation + bounded rescan

- Status: `PENDING`
- Evidence: RESULT.md step log

### 3.7 TargetFingerprint ambiguity fail-closed

- Status: `PENDING`
- Evidence: RESULT.md step log

### 3.8 Idempotency + request_id_conflict

- Status: `PENDING`
- Evidence: RESULT.md step log

### 3.9 Action lifecycle + process-death UNKNOWN_EFFECT

- Status: `PENDING`
- Evidence: RESULT.md step log

### 3.10 B-12 handshake flake fix/kanıt

- Status: `PENDING`
- Evidence: RESULT.md step log

### 3.11 Fake host suite + optional lab DUT smoke

- Status: `PENDING`
- Evidence: RESULT.md step log

### 3.12 Verification + M4/M5 handoff

- Status: `PENDING`
- Evidence: RESULT.md step log


## 8. Verification commands

- `pnpm verdict:verify-master-plan`
- `cd "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile" && ./gradlew :verdict-bridge:test --quiet`
- `node "/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/scripts/check-verdict-status.mjs" --summary || true`

## 9. Hard bans

- Production APK automation leakage
- Arbitrary SQL query surface
- Event-absence ⇒ SDK failure guessing
- wait_any full-dump polling
- Auto-retry after UNKNOWN_EFFECT
- Silent Cockpit code edits from Mobile playbook

## 10. Next phase handoff

Bu faz kapanınca RESULT.md içinde `phase4aReadiness` alanını doldur.
Cockpit playbook'taki ilgili external blocker (B-12/B-13/CP3-DUT vb.) güncellenmeliyse
handoff notu yaz.
