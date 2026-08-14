# G90 RESULT — 90 gün sınıflı stabilizasyon

```yaml
goalId: G90-stabilization
runPlayId: verdict-goal-g90-stabilization
goalName: "90-day classified stabilization"
northStar: "known failure modes, measured reliability, bounded recovery, explainable unknown states, repeatable business verification"
resultState: NOT_STARTED
currentWindow: D30
createdAt: "2026-08-13 15:25:00 +03"
openedAt: "2026-08-13 15:25:00 +03"
startedAt: null
completedAt: null
lastUpdatedAt: "2026-08-14 18:27:00 +03"
timezone: "Europe/Istanbul"
runPlayFile: "docs/verdict/goals/G90-stabilization/RUN_PLAY.md"
readinessFile: "docs/verdict/goals/G90-stabilization/READINESS.md"
joinFile: "docs/verdict/goals/G90-stabilization/JOIN.md"
nextStep: G90.3
d14Gate: "G90.2b + G90.3 close by 2026-08-27 or D30 100-run campaign compresses"
joinBoundaries: "J0✅ J1🟡code-wired/live-pending J2🟡 J3— J4 N/A J5—"
d30Slice: "nesy.macro.login / nesy.launch.cold-real-login / PIN path"
d30Campaign: "100 consecutive classified runs"
d30CampaignGate: "3-5 consecutive PRODUCT_PASS, then 20 classified, then 100"
d60Status: SPEC_LOCKED
d60Campaign: "controlled bad-day matrix"
d90Status: SPEC_LOCKED
d90Campaign: "3-5 workflows + device variation + soak; M1-M6; pilot-stable"
pilotStable: null
internallyStable: null
acceptanceFile: "docs/verdict/goals/G90-stabilization/ACCEPTANCE.md"
unclassifiedCount: null
productPassCount: null
```

## 1. Executive result

Hedef **açıldı**. North star kilitli:

```text
bilinen failure modes
ölçülmüş reliability
bounded recovery
açıklanabilir unknown states
repeatable business verification
```

Kâğıt `tap → event → backend → assert` sahada on failure boundary’den geçer
(`RUN_PLAY` §1.1). İlk tasarımın bozulması beklenir; asıl iş failure → invariant.

D30 slice, D60 bad-day, D90 soak / `pilot-stable` spec kilitli. Kampanyalar henüz başlamadı.

```text
G90: READY (goal open) / RESULT NOT_STARTED
D30 window: 2026-08-13 → 2026-09-12  — campaign NOT_STARTED
D60 window: 2026-09-13 → 2026-10-12  — SPEC_LOCKED, campaign gated on D30 COMPLETED
D90 window: 2026-10-13 → 2026-11-11  — SPEC_LOCKED, campaign gated on D60 COMPLETED
D30 acceptance: 100/100 classified; UNCLASSIFIED=0
D60 acceptance: 6 injected faults → expected class; confusion matrix; UNCLASSIFIED=0
D90 acceptance: 3–5 workflows × ≥2 DUT soak; six metric families + M2b companion published; UNCLASSIFIED=0
pilotStable: not claimable yet
Baseline live login: run_c5b41c62 INCONCLUSIVE / AUTOMATION_FAILURE / ABORTED
  (legacy wait-login-ready = J1 🟡; continue gate waiting = J2 open)
Phase 10: fact plumbing CODE_WIRED. G90: ROUTE_LIST_READY / LOGIN_REJECTED
  not live-observed on a login occurrence. implemented ≠ live observed ≠ golden.
Framing: J0–J5 independent boundaries (not a ladder). J1 🟡 canonical code-wired, live DUT qualification pending.
  Timeout uzatılmaz. G90.3 = 3a ∧ 3b (1× positive PASS + 1× expected-rejection PASS). 100: 3–5 PASS → 20 → 100.
```

D30 `COMPLETED` yazılmaz: sınıflı 100’lük kampanya + start invariant kanıtı yok.
G90 `COMPLETED` yazılmaz: §1 beş maddesi kanıtsızsa. Pencereler tikli, unknown
hâlâ yıksız `TIMEOUT` ise hedef kapanmamıştır.
D60 kampanyası D30 kapanmadan başlamaz. D90 kampanyası D60 kapanmadan başlamaz.
`pilot-stable` D90 RESULT alanı olmadan söylenmez.
“Artık gerçekten stabil” [`ACCEPTANCE.md`](./ACCEPTANCE.md) olmadan söylenmez
(`internallyStable`; 3 family, ≥%97 completion, overnight, false PASS=0).

SSOT 1–3 kilitli. 14 Aug 17:04: AUTH/bootstrap **post-action**; J0–J5 ladder değil;
G90.3 = 3a∧3b + 1×positive PASS+1×expected-rejection PASS; M2a ENV hariç; pilotAcceptance D90 öncesi freeze.

## 1.1 Phase 10 plumbing ≠ G90 live golden

Çelişki yok. İki iz, iki iddia:

| İz | İddia | Durum |
|---|---|---|
| Phase 10 [`run-playbooks/phase-10/RUN_PLAY.md`](../../run-playbooks/phase-10/RUN_PLAY.md) §3.2 | Cihaz olayı → fact üç halkası **kuruldu** (host correlation, device attach, host source registry). Pack’in bildirdiği fact için host üretici **kodda** var. | plumbing / `CODE_WIRED` |
| G90 `LOGIN_CONTINUE_GATE_FACTS` | Real login occurrence üzerinde `ROUTE_LIST_READY` / `LOGIN_REJECTED` **live observed** | `OPEN` — `run_c5b41c62` continue gate still waiting |

```text
implemented  ≠  live observed  ≠  golden accepted
```

Phase 10 “fact pipeline düzeldi” = kod hattı var. G90 OPEN = o hattın login
golden occurrence’ında Continue Gate’i kapatan fact henüz görülmedi.

## 2. Recovery state

| Alan | Değer |
|---|---|
| Current window | `D30` |
| Current step | `G90.3` |
| Current state | `READY` / campaign `NOT_STARTED` |
| Last successful step | `G90.2b` code + unit/integration regressions; kalıcı readiness trace migration |
| Last attempted step | `G90.2b` |
| Last update | `2026-08-14 18:27:00 +03` |
| Recovery instruction | `NEXT = G90.3: ROUTE_LIST_READY + LOGIN_REJECTED 12-stage fact journey; sonra 1 positive PASS + 1 expected-rejection PASS. ≤2026-08-27.` |

## 2.1 North star (beş madde)

| Madde | Kanıt | Durum |
|---|---|---|
| Bilinen failure modes | kapalı sınıf + `UNCLASSIFIED=0` | `NOT_STARTED` |
| Ölçülmüş reliability | Altı metric family + M2b companion + n | `NOT_STARTED` |
| Bounded recovery | tavan 1 + M5 | `NOT_STARTED` |
| Açıklanabilir unknown states | `UNKNOWN_EFFECT` / `INCONCLUSIVE` yıksız değil | `NOT_STARTED` |
| Repeatable business verification | D30 oracle + M6 | `NOT_STARTED` |

## 3. Precondition (açılış anı)

| Gate | Durum | Not |
|---|---|---|
| Cockpit Phase 7 | `COMPLETED` / DUT blockers | Omurga var; golden live yok |
| Mobile M7 / M8 | external blockers | Kill/recovery D30 dışı |
| Lab DUT | SM-A346E `user` | Track A. userdebug = Track B; login J5’i bloklemez |
| Login slice pack | var | Phase 10 üretici wired; live occurrence fact görmedi |
| Start invariant | `CODE_COMPLETE`; live qualification pending | [`READINESS.md`](./READINESS.md). Kalıcı trace + canonical class; J1 G90.3 live run'da doğrulanır |
| Continue Gate facts | **OPEN** (live) | Phase 10 plumbing wired. Live login occurrence henüz fact görmedi. **G90.3** |

## 4. D30 kampanya tablosu

Kampanya başlayınca doldurulur. Şablon:

| class | n | runId örnekleri | root condition |
|---|---|---|---|
| `PRODUCT_PASS` | — | | |
| `PRODUCT_FAIL` | — | | |
| `ENV_FAILURE` | — | | |
| `FORCE_STOP_NOT_CONFIRMED` | — | | |
| `PROCESS_NOT_STARTED` | — | | |
| `COLD_START_OS_SUSPEND` | — | | |
| `APP_NOT_READY` | — | | |
| `A11Y_SYNC_PENDING` | — | | |
| `UI_NOT_ACTIONABLE` | — | | |
| `SDK_NOT_READY` | — | | |
| `AUTH_PENDING` (post-action) | — | | |
| `BACKEND_BOOTSTRAP_PENDING` (post-action) | — | | |
| `EVIDENCE_TIMEOUT` | — | | |
| `TEST_DATA_CONTAMINATION` | — | | |
| `UNCLASSIFIED` | **hedef 0** | | |

Toplam: `— / 100`. `UNCLASSIFIED > 0` ise pencere kapanmaz.

## 4.1 D60 karışıklık matrisi (şablon)

Kampanya D30 `COMPLETED` sonrası. Köşegen beklenen. Köşegen dışı = senaryo fail.

| injected \ observed | PROCESS_DEATH | NETWORK_PARTITION | BACKEND_TIMEOUT | DIALOG_INTERRUPT | DUPLICATE_SUPPRESSED | OFFLINE_QUEUED | diğer / UNCLASSIFIED |
|---|---|---|---|---|---|---|---|
| BD.1 process-kill | — | | | | | | |
| BD.2 network-disconnect | | — | | | | | |
| BD.3 backend-timeout | | | — | | | | |
| BD.4 dialog-overlay | | | | — | | | |
| BD.5 duplicate-callback | | | | | — | | |
| BD.6 offline-queue | | | | | | — | |

Hedef: köşegen ≥5, diğer hücre 0, `UNCLASSIFIED` 0.

## 4.2 D90 metrik tablosu (şablon)

Kampanya D60 `COMPLETED` sonrası. `injectedFault=null`.

| workflow | serial | n eval | M1 p50/p95 | M2a auto-fail | M2b env | M3 evid. | M4 UE | M5 rec. | M6 TV |
|---|---|---|---|---|---|---|---|---|---|
| login | | | | | | | | | |
| select-route | | | | | | | | | |
| process-parcel | | | | | | | | | |
| complete-delivery | | | | | | | | | |
| tour-approval (opt) | | | | | | | | | |

`pilotStable`: `—` (YES: RUN_PLAY §22 **ve** §22.1 freeze).
`pilotAcceptance`: `NOT_FROZEN` (D90 başlamadan doldurulur).

## 4.3 Internal acceptance (şablon)

SSOT: [`ACCEPTANCE.md`](./ACCEPTANCE.md). `internallyStable`: `—`
(ACCEPTANCE G1–G7 ≠ JOIN J0–J5. J-ladder yok.)

| Kapı | Eşik | Durum |
|---|---|---|
| G1 Golden completion | ≥ %97 aggregate; ≥20/workflow; none < %90 | `NOT_STARTED` |
| G2 Failure attribution | > %95 sınıflı | `NOT_STARTED` |
| G3 Unexplained missing fact | 0 | `NOT_STARTED` |
| G4 Recovery → business state | kill / offline / reconnect / backend timeout | `NOT_STARTED` |
| G5 False PASS | category coverage (≥2 each) + 0 | `NOT_STARTED` |
| G6 Device families | ≥ 3 | `NOT_STARTED` (lab=1, SM-A346E) |
| G7 Overnight soak | ≥ 8h, contamination 0 | `NOT_STARTED` |

## 5. Step log

| Step | Status | Evidence |
|---|---|---|
| G90.0 Hedef izi + D30 kilidi | `DONE` | bu dosya + `RUN_PLAY.md` |
| G90.1 Sınıf + readiness izi | `MERGED_INTO_G90.2b` | Aynı implementasyon ve kalıcı trace teslimi |
| G90.2 Readiness Core spec | `DONE` | yedili + pre/post split 14 Aug 17:04 |
| JOIN J0–J5 | `DONE` (spec) | ladder değil; J1 🟡 code-wired/live-pending |
| G90.2b SM implementasyonu | `DONE` | yedili + `INTERACTION_READY`; kalıcı JSON trace/class; eski wait kaldırıldı; live J1 G90.3'te |
| G90.3 Login evidence (parent) | `NOT_STARTED` | = 3a ∧ 3b |
| G90.3a Continue Gate | `NOT_STARTED` | her iki path |
| G90.3b Final Oracle | `NOT_STARTED` | 1× positive PASS + 1× expected-rejection PASS carrying `LOGIN_REJECTED`; J3 3b içinde |
| G90.3c automationRelease golden | `NOT_STARTED` | P1 |
| G90.3e Remote login evidence | `NOT_STARTED` | J4 N/A / P2 |
| G90.4 Isolation / contamination | `NOT_STARTED` | G5 sonrası P1 |
| G90.5 100 koşu | `NOT_STARTED` | 3–5 PASS → 20 → 100 |
| G90.6 Sınıf regresyonları | `NOT_STARTED` | |
| G90.7 D30 kapanış | `NOT_STARTED` | |
| G90.8 D60 spec kilidi | `DONE` | `RUN_PLAY.md` §15–18 |
| G90.9 injectedFault alanı | `NOT_STARTED` | |
| G90.10 Altı enjektör | `NOT_STARTED` | |
| G90.11 D60 matrisi | `NOT_STARTED` | |
| G90.12 D60 kapanış | `NOT_STARTED` | |
| G90.13 D90 spec kilidi | `DONE` | `RUN_PLAY.md` §19–22 |
| G90.14 Metrik enstrümantasyonu | `NOT_STARTED` | |
| G90.15 D90 soak | `NOT_STARTED` | |
| G90.16 D90 kapanış / pilotStable | `NOT_STARTED` | |
| G90.17 Internal acceptance G1–G7 | `NOT_STARTED` | `ACCEPTANCE.md` |

## 6. Changed files

| Path | Değişim |
|---|---|
| `docs/verdict/goals/README.md` | **new** — hedef izi |
| `docs/verdict/goals/G90-stabilization/RUN_PLAY.md` | G90.0 new; G90.8 §15–18; G90.13 §19–22 |
| `docs/verdict/goals/G90-stabilization/READINESS.md` | **new** — 7 pre-action class + `INTERACTION_READY`; AUTH/bootstrap post-action; G90.2 spec |
| `docs/verdict/goals/G90-stabilization/JOIN.md` | J0–J5 independent boundaries; G90.3 = 3a∧3b |
| `apps/api/src/services/cold-start-readiness.ts` | G90.2b canonical tracker, first-unmet class, bounded deadline |
| `apps/api/src/services/bridgeflow-execution-queue.ts` | force-stop confirmation → SM → first Bridge action gate; durable trace |
| `packages/db/prisma/schema.prisma` | `readinessStatus` / `readinessClass` / `readinessTrace` |
| `domain-packs/nesy-courier/src/macros/login.ts` | legacy `wait-login-ready` kaldırıldı; entry = PIN resolve |

## 7. Skipped / deferred

- Login remote REQUIRED (G4; G5 sonrası soğan)
- Process-kill / G6 (normal login G5 yokken yüzey büyütülmez)
- Yeni Cockpit feature / AI / ikinci workflow / userdebug lab (2b+3 önüne geçmez)
- D60 / D90 **kampanyaları** (spec kilitli; sırayla D30 → D60 → D90 gate)
- `pilot-stable` iddiası (D90 RESULT alanı boş)
- `internallyStable` (ACCEPTANCE G1–G7; 3 family yok, defect set yok)

## 8. Blockers

| ID | Severity | Status | Not |
|---|---|---|---|
| LOGIN_CONTINUE_GATE_FACTS | HIGH | `OPEN` | **Live observed değil.** Phase 10 üç halka kuruldu (`CODE_WIRED`). `run_c5b41c62` gate hâlâ waiting. G90.3. |
| START_INVARIANT_MISSING | HIGH | `CLOSED_CODE` | G90.2b implementasyonu + kalıcı trace + regresyonlar var. Live J1 qualification G90.3'ün parçası. |
| LOCAL_DB_NOT_EXERCISED | HIGH | `OPEN` | Login LOCAL REQUIRED; 3b positive PASS’in parçası. |
| FIXTURE_NONDETERMINISM | MEDIUM | `OPEN` | Prepared session Room restore etmiyor. G90.4 P1 (J5 sonrası). |
| CP3-DUT | EXT | `DEFERRED` | Track B. Track A login J5’i bloklemez. BD.1 `deathProvenance=PROCESS_DEATH_FORCE_STOP`. |
| KILL_RECOVERY | EXT | `SPEC_LOCKED` | D60 BD.1; kampanya D30 sonrası |
| BAD_DAY_INJECTORS | HIGH | `SPEC_LOCKED` | G90.10; D30 soak’una karışmaz |
| SECOND_DUT | MEDIUM | `OPEN` | D90 `pilotStable=YES` için ≥2 serial; tek cihaz = `SINGLE_DUT_SOAK` |

## 9. Next window handoff

```text
D30 açık. Kampanya yok.
G90.2b CODE_COMPLETE — INTERACTION_READY yedili. AUTH/bootstrap pre-action yok.
NEXT: G90.3 = 3a ∧ 3b (1× positive PASS + 1× expected-rejection PASS). J0–J5 ladder değil.
İkisi ≤ 2026-08-27. Phase 10 plumbing ≠ live golden.
implemented ≠ live observed ≠ golden accepted.
```
