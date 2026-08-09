# Verdict Mobile Track — Progress Board

```yaml
trackId: verdict-mobile-run-playbooks
ssotFor: "Mobile M0–M9 playbook completion (not Cockpit FAZ YAML / not Mobile verdict-status bridge_b2 cutover)"
lastUpdatedAt: "2026-08-09 19:05:00 +03"
timezone: "Europe/Istanbul"
masterPlanPointer: "docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md § Mobile playbook track"
```

Bu dosya **Mobile run-playbook** ilerlemesinin tek bakışlık tablosudur.
Kaynak gerçek: her fazın `RESULT.md` `resultState` alanı. Çelişki halinde RESULT kazanır.

## Önemli ayrım

| Track | Ne ölçer | Bu board ile karıştırma |
|---|---|---|
| **Mobile M\*** | `mobile-run-playbooks/phase-*/RESULT.md` | ← bu dosya |
| **Cockpit FAZ / CP\*** | `run-playbooks/phase-*/RESULT.md` + master plan `todos: faz-*` | ayrı |
| **Mobile SSOT checkpoints** | `NesyMobile/verdict-status.json` (örn. `bridge_b2` = compiler/courier) | protokol M3 ≠ `bridge_b2=passed` |

Master plan üstündeki `faz-0…faz-9` YAML status alanları **Cockpit program fazlarıdır**.
Mobile `M0` tamamlandı diye `faz-0: completed` yazılmaz.

## Board

| Faz | Ad | resultState | RESULT | Not |
|---|---|---|---|---|
| **M0** | Baseline + envanter + gap | `COMPLETED` | [phase-0/RESULT.md](./phase-0/RESULT.md) | Inventory / gap matrix |
| **M1** | SDK auth / session fixture | `COMPLETED` | [phase-1/RESULT.md](./phase-1/RESULT.md) | Auth fixtures/tests |
| **M2** | EmitOutcome + WAL/ACK diagnostic | `COMPLETED` | [phase-2/RESULT.md](./phase-2/RESULT.md) | Diagnostic query surface |
| **M3** | Bridge B2 protocol | `COMPLETED` | [phase-3/RESULT.md](./phase-3/RESULT.md) | wait_any/cancel/capabilities; SSOT `bridge_b2` hâlâ not_started |
| **M4A** | Core-contract thin gate | `COMPLETED` | [phase-4a/RESULT.md](./phase-4a/RESULT.md) | Bridge domain leakage 0 |
| **M4B** | Nesy App Adapter production | `COMPLETED` | [phase-4b/RESULT.md](./phase-4b/RESULT.md) | Adapter ops + queries |
| **M4C** | Pack ↔ adapter ↔ Bridge uyumu | `COMPLETED` | [phase-4c/RESULT.md](./phase-4c/RESULT.md) | Contract flip + fixtures |
| **M5** | Correlation + recovery | `COMPLETED` | [phase-5/RESULT.md](./phase-5/RESULT.md) | |
| **M6** | Inspector destek | `COMPLETED` | [phase-6/RESULT.md](./phase-6/RESULT.md) | |
| **M7** | Gerçek akış + release isolation | `READY_WITH_EXTERNAL_BLOCKERS` | [phase-7/RESULT.md](./phase-7/RESULT.md) | Carry → M8 |
| **M8** | DUT fault kabulü | `BLOCKED_EXTERNAL` | [phase-8/RESULT.md](./phase-8/RESULT.md) | Offline matrix PASS; CP3-DUT held |
| **M9** | Legacy temizliği | `NOT_STARTED` | [phase-9/RESULT.md](./phase-9/RESULT.md) | cutover sonrası |

## Summary

```text
Completed: M0, M1, M2, M3, M4A, M4B, M4C, M5, M6
Ready w/ external: M7
Blocked external: M8 (CP3-DUT; carry noted)
Remaining: M8 DUT fault → M9
```

## Update rule

Bir Mobile faz `COMPLETED` / `FAILED` / `IN_PROGRESS` olduğunda aynı commit/çalışmada:

1. Faz `RESULT.md` + `RUN_PLAY.md` güncellenir
2. Bu `PROGRESS.md` board satırı güncellenir
3. İsteğe bağlı: master plan § Mobile playbook track özeti yenilenir (+ digest)
