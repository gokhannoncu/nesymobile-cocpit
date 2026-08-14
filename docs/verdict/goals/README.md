# Verdict hedefleri

Bu klasör, faz playbook’larından **ayrı** bir izdir.

| İz | Path | Soru |
|---|---|---|
| Cockpit fazları | [`../run-playbooks/`](../run-playbooks/) | Bu fazın kodu nasıl kapanır? |
| Mobile fazları | [`../mobile-run-playbooks/`](../mobile-run-playbooks/) | SDK / Bridge / adapter bu fazda ne teslim eder? |
| **Hedefler** | `docs/verdict/goals/` | Zaman kutusunda ne kanıtlanacak? Hangi invariant? Hangi sınıflı metrik? |

Faz playbook’u “ne inşa edildi”yi kapatır. Hedef playbook’u şunu kapatır:

```text
bilinen failure modes · ölçülmüş reliability · bounded recovery ·
açıklanabilir unknown states · repeatable business verification
```

Phase 7 `COMPLETED` + `PASSED_WITH_EXTERNAL_DUT_BLOCKERS` bu hedefin yerine geçmez.

Kâğıt `tap → event → backend → assert` sahada on failure boundary’den geçer.
İlk tasarımın bozulması beklenir. Asıl iş: gerçek failure’ı genelleştirip
invariant’a çevirmek — yeni mekanizma yığmak değil. Ayrıntı:
[`G90-stabilization/RUN_PLAY.md`](./G90-stabilization/RUN_PLAY.md) §1.1.

**Bugünkü asıl risk join’dir.** J0–J5 **ladder değil**
([`JOIN.md`](./G90-stabilization/JOIN.md)). Pre-action yedili
`INTERACTION_READY`; AUTH/bootstrap action sonrası
([`READINESS.md`](./G90-stabilization/READINESS.md)).
**G90.2b CODE_COMPLETE** (eski 9-state kodlanmadı). **NEXT = G90.3** = 3a ∧ 3b
(1× positive-path PASS + 1× expected-rejection PASS). İkisi ≤ 2026-08-27.

## Klasör kuralı

Her hedef:

```text
docs/verdict/goals/<goal-id>/
├── RUN_PLAY.md     ← hedef, pencere, invariant, yasaklar
├── RESULT.md       ← kanıt, sınıflı sayımlar, blocker
├── JOIN.md         ← varsa: occurrence join + katmanlı golden (G90)
├── READINESS.md    ← varsa: cold-start state machine (G90 Core)
└── ACCEPTANCE.md   ← varsa: “gerçekten stabil” internal kapıları (G90)
```

`goal-id` biçimi: `G<gün>-<kısa-ad>` (ör. `G90-stabilization`).

State dili run playbook ile aynıdır: `NOT_STARTED` · `READY` · `IN_PROGRESS` · `PAUSED` · `BLOCKED` · `COMPLETED` · `FAILED` · `ABANDONED`.

## Açık hedefler

| ID | Ad | Pencere | Durum | Dosya |
|---|---|---|---|---|
| `G90-stabilization` | Bilinen failure modes, ölçülmüş reliability, bounded recovery, açıklanabilir unknown, repeatable verification | 2026-08-13 → 2026-11-11 | `READY` — G90.2b `CODE_COMPLETE`; **NEXT G90.3** fact journey + oracle; D60+D90 spec kilitli | [`G90-stabilization/RUN_PLAY.md`](./G90-stabilization/RUN_PLAY.md) |

## Kapanış kuralı

Bir hedef `COMPLETED` yazılmaz eğer:

1. her koşunun **sınıfı** yoksa (sınıfsız FAIL / timeout torbası),
2. invariant yoksa ve yerine sleep / yeni jest / yeni “zeki mekanizma” varsa,
3. metrik + regresyon yoksa.

`94 PASS / 6 FAIL` bu izde başarı değildir. D60’da “fault enjekte, yine yeşil”
de başarı değildir — beklenen sınıf köşegene düşmelidir. `pilot-stable` D90
RESULT alanı olmadan söylenmez (altı metric family + M2b environment companion +
≥2 DUT; tek cihaz = `SINGLE_DUT_SOAK`).
“Artık gerçekten stabil” [`G90-stabilization/ACCEPTANCE.md`](./G90-stabilization/ACCEPTANCE.md)
(`internallyStable`, G1–G7). Endüstri standardı değil.
