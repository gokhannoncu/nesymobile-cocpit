# G90 RESULT — 90 gün sınıflı stabilizasyon

```yaml
goalId: G90-stabilization
runPlayId: verdict-goal-g90-stabilization
goalName: "90-day classified stabilization"
northStar: "known failure modes, measured reliability, bounded recovery, explainable unknown states, repeatable business verification"
resultState: IN_PROGRESS
d30Status: COMPLETED
d30ClosedAt: "2026-08-15 16:15:00 +03"
currentWindow: D60
createdAt: "2026-08-13 15:25:00 +03"
openedAt: "2026-08-13 15:25:00 +03"
startedAt: "2026-08-15 14:27:28 +03"
completedAt: null
lastUpdatedAt: "2026-08-15 21:40:00 +03"
timezone: "Europe/Istanbul"
runPlayFile: "docs/verdict/goals/G90-stabilization/RUN_PLAY.md"
readinessFile: "docs/verdict/goals/G90-stabilization/READINESS.md"
joinFile: "docs/verdict/goals/G90-stabilization/JOIN.md"
nextStep: G90.10_BD6
d60Implementation: G90.10_BD2_LIVE_QUALIFIED
g90_10Bd2LiveSmoke: "docs/verdict/goals/G90-10-bd2-live-smoke-2026-08-151759.json"
g90_10Bd3LiveSmoke: "docs/verdict/goals/G90-10-bd3-live-smoke-2026-08-151626.json"
g90_10Bd6LiveSmoke: "docs/verdict/goals/G90-10-bd6-live-smoke-2026-08-151836.json"
g90_9LiveSmoke: "docs/verdict/goals/G90-9-live-smoke-2026-08-151329.json"
d60CampaignStatus: NOT_STARTED
d14Gate: "G90.2b + G90.3 closed 2026-08-15 (ahead of 2026-08-27)"
joinBoundaries: "J0✅ J1✅ J2✅ J3✅ J4 N/A J5✅"
d30Slice: "nesy.macro.login / nesy.launch.cold-real-login / PIN path"
d30Campaign: "100 consecutive classified runs"
d30CampaignGate: "3-5 consecutive PRODUCT_PASS, then 20 classified, then 100"
d30CampaignArtifact: "docs/verdict/goals/D30-100-rerun-2026-08-151127.close.json"
d60Status: SPEC_LOCKED
d60CampaignWindow: "2026-09-13 → 2026-10-12"
d60Campaign: "controlled bad-day matrix"
d90Status: SPEC_LOCKED
d90Campaign: "3-5 workflows + device variation + soak; M1-M6; pilot-stable"
pilotStable: null
internallyStable: null
acceptanceFile: "docs/verdict/goals/G90-stabilization/ACCEPTANCE.md"
unclassifiedCount: 0
productPassCount: 99
envFailureCount: 1
reliabilityClaim: "D30 measured reliability established for the login slice."
```

## 1. Executive result

D30 login slice **COMPLETED**. G90 hedefi açık; D60 henüz başlamadı.

Kapanış iddiası:

```text
D30 measured reliability established for the login slice.
```

**Söylenmeyenler:** `RELIABILITY_PROVEN`, `pilot-stable`, `internallyStable`,
G90 `COMPLETED`. Üretim reliability kanıtı değildir. Login slice için
sınıflı bir baseline vardır.

```text
G90.2b
READINESS_LIVE_QUALIFIED              ✅

G90.3
BUSINESS_E2E                          ✅
POSITIVE_SEMANTICS                    ✅
NEGATIVE_SEMANTICS                    ✅
EVIDENCE_CLOSURE                      ✅
CLEANUP_ISOLATION                     ✅
SMALL_SAMPLE_REPEATABILITY            ✅

D30
100_CLASSIFIED_CAMPAIGN_EXECUTED      ✅
UNCLASSIFIED_ZERO                     ✅
CLASSIFICATION_COVERAGE               100%
PRODUCT_PASS                          99/100
ENV_FAILURE                           1/100
SECONDARY_CONTAMINATION               0
D30_COMPLETED                         ✅
```

Kampanya (kapanış artefaktı
[`D30-100-rerun-2026-08-151127.close.json`](../D30-100-rerun-2026-08-151127.close.json)):

```text
100 attempts   DUT R6CW400BC8N   pack nesy.courier@1.30.0
99 PRODUCT_PASS
 1 ENV_FAILURE

UNCLASSIFIED       0
INCONCLUSIVE       0
INTERACTION_READY  100/100
cleanup            100/100 SUCCEEDED
contamination      0
```

D30 acceptance 100/100 `PRODUCT_PASS` değildir. Locked RUN_PLAY: 100/100
sınıflı + `UNCLASSIFIED=0`. 99 PASS + 1 sınıflı ENV, açıklamasız timeout’tan
daha değerlidir.

```text
G90: IN_PROGRESS — D30 COMPLETED; G90.9 LIVE_QUALIFIED; G90.10 BD.3+BD.2 LIVE_QUALIFIED
Formal D60 campaign window unchanged: 2026-09-13 → 2026-10-12
D30 window: 2026-08-13 → 2026-09-12  — COMPLETED 2026-08-15
D60 window: 2026-09-13 → 2026-10-12  — SPEC_LOCKED; BD.3+BD.2 LIVE_QUALIFIED; campaign NOT_STARTED
D90 window: 2026-10-13 → 2026-11-11  — SPEC_LOCKED, gated on D60 COMPLETED
Observed product/test success   99%
Classification coverage        100%
Environment interruption        1/100 observed
Automation-class failure        0
Unexplained outcome             0
Cleanup success               100%
```

G90 `COMPLETED` yazılmaz: §1 beş maddesinin D60/D90 kanıtı yok.
D90 kampanyası D60 kapanmadan başlamaz.
`pilot-stable` D90 RESULT alanı olmadan söylenmez.
“Artık gerçekten stabil” [`ACCEPTANCE.md`](./ACCEPTANCE.md) olmadan söylenmez.

### 1.1 Class axes — bilinçli hiza

İki sözlük, iki alan. Remap yalnız `toD30HistogramClass`.

| Alan | Sözlük | #9 örneği |
|---|---|---|
| `evaluationFailureClass` | persisted eval axis: `NONE` \| `AUTOMATION_FAILURE` \| `ENVIRONMENT_FAILURE` \| `EVIDENCE_INSUFFICIENT` | `ENVIRONMENT_FAILURE` |
| `d30Class` | RUN_PLAY §5 histogram | `ENV_FAILURE` |

Prisma kodları (`P1017`, …) `failureDetail` üzerindedir; yeni histogram sınıfı
değildir. `DB_CONNECTION_LOST` uydurulmaz.

### 1.1b G90.9 injectedFault contract

```text
injectedFault   input    null | PROCESS_KILL | NETWORK_DISCONNECT |
                         BACKEND_TIMEOUT | DIALOG_OVERLAY |
                         DUPLICATE_CALLBACK | OFFLINE_QUEUE
observedClass   output   null while uninjected;
                         D60 six + D30 histogram when injected
expectedClass   derived  locked map from injectedFault
```

Uninjected D30/D90 satırları `injectedFault = null` kalır ve karışıklık
matrisine girmez. Formal D60 kampanyası bu implementasyonla **başlamadı**.

Live qualification 2026-08-15 16:29 +03, fresh prod `3770d2a` /
`node dist/server.js` PID 55798
([`G90-9-live-smoke-2026-08-151329.json`](../G90-9-live-smoke-2026-08-151329.json)):

| Smoke | injectedFault | observedClass | productVerdict | cleanup |
|---|---|---|---|---|
| A uninjected | `null` | `null` | `PASS_ONLINE` | `SUCCEEDED` |
| B metadata | persist/readback `BACKEND_TIMEOUT` | `null` (not copied from input) | `PASS_ONLINE` | `SUCCEEDED` |

`injectedFault` test girdisi; `observedClass` ölçüm çıktısı. Smoke B BD.3
enjektör kalifikasyonu değildir.

### 1.1c G90.10 BD.3 injector (LIVE_QUALIFIED)

`observeInjectedClass` `injectedFault` kabul etmez. `BACKEND_TIMEOUT` yalnız
şunlar birlikte doğruysa yazılır: `UNKNOWN_EFFECT` + injector
`EFFECT_OBSERVED` + `abortKind=DEADLINE` + `ADAPTER_DEADLINE_ABORT`.

READ_ONLY / login remote arm olmaz — G90.9 Smoke B davranışı korunur.
Host B mutation remote arm olur.

BD.3 tanımı: **controlled adapter-deadline injection representing BD.3
BACKEND_TIMEOUT**. Wire dispatch bilinçli olarak tutulur; mevcut
`AbortController` yolu `UNKNOWN_EFFECT` üretir. “Backend isteği aldı ve
timeout oldu” iddiası değildir. `UNKNOWN_EFFECT` muhafazakâr kalır —
injector wire’a gitmediğini bilse bile runtime `NO_EFFECT`e çevrilmez.

`PRODUCT_FAIL` yok; executor `UNKNOWN_ACTION_EFFECT` → `INCONCLUSIVE`.
Formal D60 kampanyası başlamadı.

Host B fixture (product path, no fake-success seam) 2026-08-15 17:51 +03
([`G90-10-host-b-fixture-2026-08-151451.json`](../G90-10-host-b-fixture-2026-08-151451.json)):

```text
create+unload shipment 80542975390576 / scan 6880051000291615
load-to-vehicle run_3dc5c70a PASS_ONLINE
schedule 11-31-20260815-1 = BeginningOfDay + 1 stop
btn_out = Request Tour Start
```

Live attempt on PID 21508 / `0465eca` binary 2026-08-15 18:00 +03:

```text
uninjected Host B  run_ba55354b  PASS_ONLINE
  injectedFault=null  observedClass=null
  dispatcher-approves reached
  cleanup NOT_STARTED (success path ends at assert-approved)

BD.3              run_1a7f59cd  INCONCLUSIVE / UNKNOWN_ACTION_EFFECT
  injectedFault=expectedClass=observedClass=BACKEND_TIMEOUT
  provenance REQUESTED→ARMED→TRIGGERED→EFFECT_OBSERVED
  actuallyFired=true  abortKind=DEADLINE
  triggerPoint=REMOTE_ACTION:approve-tour-request@dispatcher-approves
  classifier independence OK (no injectedFault)
  cleanup FAILED — release-approval-fixture has no spec
```

`LIVE_QUALIFIED` yazılmazdı: injection gözlendi, isolation bar
(`cleanup=SUCCEEDED`) tutulmadı. PID 21508 = kapalı LIVE_INJECTION lineage.

Cleanup contract `nesy.courier@1.31.0` + host reconcile
(`RejectLeavingPermission` sonra `GetWaitingLeavingRequests`; hâlâ
WaitingForApproval ise cleanup FAILED). Live qualification 2026-08-15 19:26 +03,
fresh prod `291553b` / `node dist/server.js` PID 29171
([`G90-10-bd3-live-smoke-2026-08-151626.json`](../G90-10-bd3-live-smoke-2026-08-151626.json)):

```text
uninjected Host B  run_63a9a223  PASS_ONLINE
  injectedFault=null  observedClass=null
  cleanup NOT_STARTED  (success path; NOT_REQUIRED)

BD.3              run_4c8bed03  INCONCLUSIVE / UNKNOWN_ACTION_EFFECT
  injectedFault=expectedClass=observedClass=BACKEND_TIMEOUT
  provenance REQUESTED→ARMED→TRIGGERED→EFFECT_OBSERVED
  actuallyFired=true  abortKind=DEADLINE
  triggerPoint=REMOTE_ACTION:approve-tour-request@dispatcher-approves
  classifier independence OK (no injectedFault)
  cleanup SUCCEEDED — reject-tour-request + waiting-list reconcile

post-cleanup
  immediate: Room status=1, notification list open (reject FCM)
  settled: dismiss btn_exit only — no second reject
  then BeginningOfDay + 1 stop + Request Tour Start
```

```text
BD.3 LIVE_INJECTION   ✅
BD.3 CLEANUP          ✅
BD.3 ISOLATION        ✅
BD.3 LIVE_QUALIFIED   ✅
```

Injector kodu değişmedi. Formal D60 kampanyası başlamadı.
PID 29171’e bu binary için ekstra kanıt için dokunulmaz.

### 1.1d G90.10 BD.2 injector (LIVE_QUALIFIED)

Spec amendment first (RUN_PLAY §16–17). Host B mutation-capable remote;
initial live qual host `tour-approval` / `approve-tour-request@dispatcher-approves`.
Injection model: **controlled host-side transport cut representing BD.2
NETWORK_DISCONNECT**. G4 reconnect is not a bar. Formal D60 campaign
`NOT_STARTED`.

Requested pin was PID 64978 / `cb87d98`. That process was already dead.
Qualification ran without restart on the current same-lab runtime
`94a9acf` / PID 95043 (`node dist/server.js`).
Artifact: [`G90-10-bd2-live-smoke-2026-08-151759.json`](../G90-10-bd2-live-smoke-2026-08-151759.json).

```text
uninjected Host B  run_bf130541  PASS_ONLINE
  injectedFault=null  observedClass=null
  cleanup NOT_REQUIRED  (success path; not owed)

BD.2              run_0c1a0dd2  INCONCLUSIVE / UNKNOWN_ACTION_EFFECT
  injectedFault=NETWORK_DISCONNECT
  expectedClass=observedClass=NETWORK_PARTITION
  provenance REQUESTED→ARMED→TRIGGERED→EFFECT_OBSERVED
  actuallyFired=true  abortKind=TRANSPORT  effectKind=HOST_TRANSPORT_CUT
  triggerPoint=REMOTE_ACTION:approve-tour-request@dispatcher-approves
  classifier independence OK (no injectedFault)
  cleanup SUCCEEDED
  PRODUCT_FAIL false

post-cleanup
  immediate: schedule status=1, notification list open
  settled: dismiss btn_exit only
  then BeginningOfDay + 1 stop + Request Tour Start
```

```text
BD.2 LIVE_INJECTION   ✅
BD.2 CLEANUP          ✅
BD.2 ISOLATION        ✅
BD.2 LIVE_QUALIFIED   ✅
```

PID 64978 / 38870 / 29171 this claim’e bağlanmaz. NEXT = BD.6.

### 1.1d G90.10 BD.6 — process-parcel HOST_NOT_CAPABLE, not LIVE_QUALIFIED

BD.2/BD.3 remote-mutation `UNKNOWN_EFFECT` ailesinde kalır. Classifier
gevşetilmedi. Fresh prod lineage:

```text
commit             = eb48304
apiPid             = 25062
apiCommand         = node dist/server.js
pack               = nesy.courier@1.32.0
digest             = sha256:e227bcf1599f45aedaf912b551f80493fb795936907783852b038cfa76aeae02
artifact           = docs/verdict/goals/G90-10-bd6-live-smoke-2026-08-151836.json
```

Uninjected twin `run_dfc36c82` — **passed**:

```text
injectedFault      = null
productVerdict     = PASS_ONLINE
observedClass      = null
LOCAL.OFFLINE_QUEUE_ITEM_WAITING = VIOLATED / absent
cleanup            = NOT_REQUIRED
```

Injected `run_578dcc5d` — **LIVE_INJECTION failed; anti-cheat held**:

```text
injectedFault      = OFFLINE_QUEUE
expectedClass      = OFFLINE_QUEUED
observedClass      = null
productVerdict     = PASS_ONLINE
provenance         = REQUESTED → ARMED → TRIGGERED
actuallyFired      = false
abortKind          = NONE
effectKind         = LOCAL_QUEUE_PERSIST
HOST_TRANSPORT_CUT absent
remoteActions      = 0
LOCAL.OFFLINE_QUEUE_ITEM_WAITING = VIOLATED / absent
WAN restore        = radios on, ADB alive
```

process-parcel / `tap-input-confirm` WAN kesilince bile delivery’yi açtı ve
`nesy.pendingOperation` satırı yazmadı. Ağ kapalı + kuyruk yok =
`OFFLINE_QUEUED` değil. `observeInjectedClass` input’tan sınıf yazmadı.

process-parcel = `HOST_NOT_CAPABLE` / negative live evidence. Classifier
gevşetilmedi. `observeInjectedClass` aynı.

**Host amend:** ilk LIVE_QUALIFIED host `complete-delivery` /
`tap-delivery-confirm`. Arm boundary oraya bağlanır; dört eksen aynı.
G4 flush / reconnect BD.6 barı değildir. Formal D60 `NOT_STARTED`.
Yeni qual PID `25062` / `eb48304` üzerine bağlanmaz.

## 1.2 Phase 10 plumbing + G90 live golden

| İz | İddia | Durum |
|---|---|---|
| Phase 10 [`run-playbooks/phase-10/RUN_PLAY.md`](../../run-playbooks/phase-10/RUN_PLAY.md) §3.2 | Cihaz olayı → fact üç halkası **kuruldu** | plumbing / `CODE_WIRED` |
| G90 `LOGIN_CONTINUE_GATE_FACTS` | Real login occurrence üzerinde `UI.ROUTE_LIST_READY` / `APP.LOGIN_REJECTED` **live observed** ve Continue Gate kapandı | `CLOSED` — 99 `PRODUCT_PASS` (50 invalid + 49 valid) |

```text
implemented  ≠  live observed  ≠  golden accepted
```

Phase 10 hattı vardı. G90.3 onu login golden occurrence’ında kapattı.

## 2. Recovery state

| Alan | Değer |
|---|---|
| Current window | `D60` |
| Current step | `G90.10` BD.6 |
| Current state | `IN_PROGRESS` / D30 `COMPLETED` |
| Last successful step | `G90.10` BD.2 LIVE_QUALIFIED (`94a9acf` / PID 95043 / `run_0c1a0dd2`) |
| Last attempted step | G90.10 BD.6 complete-delivery uninjected `run_80a055d2` FAIL_PRODUCT — local deliverParcels + Room delivered, GetShipmentDeliveryProof `[]`, SearchShipment still Loaded; classifier held |
| Last update | `2026-08-16 08:02:00 +03` |
| Recovery instruction | `NEXT = why RS staging does not persist deliverParcels (not observeInjectedClass). proofLookupId=waybill already used. Invoice customer 10330 still no remote proof. Do not bind qual to PID 25062. Formal D60 kampanyası 13 Eylül’e kadar açılmaz.` |

## 2.1 North star (beş madde)

| Madde | Kanıt | Durum |
|---|---|---|
| Bilinen failure modes | D30 histogram + `UNCLASSIFIED=0`; görülen sınıf `ENV_FAILURE` | `D30_CLOSED` — D60 köşegeni açık |
| Ölçülmüş reliability | Login slice baseline (99/100 product, 100% classified). Altı metric family D90 | `D30_LOGIN_BASELINE` — `RELIABILITY_PROVEN` değil |
| Bounded recovery | #9 cleanup `SUCCEEDED` + isolation recovery; sonraki occurrence PASS. M5 D90 | `D30_ISOLATION_PROVEN` |
| Açıklanabilir unknown states | `INCONCLUSIVE=0`, `UNCLASSIFIED=0`, yıksız `TIMEOUT=0` | `D30_CLOSED` |
| Repeatable business verification | valid + invalid `PRODUCT_PASS`; 20-gate clean. M6 D90 | `D30_ORACLE_BOTH_PATHS` |

## 3. Precondition (kapanış anı)

| Gate | Durum | Not |
|---|---|---|
| Cockpit Phase 7 | `COMPLETED` / DUT blockers | Omurga var |
| Mobile M7 / M8 | external blockers | Kill/recovery D60 BD.1 |
| Lab DUT | SM-A346E `user` `R6CW400BC8N` | Track A |
| Login slice pack | `nesy.courier@1.30.0` | digest `sha256:81b241227d3b9c720d97540e4820f0c21683142082d7b6e64ee3efd795a57ebb` |
| Start invariant | `READINESS_LIVE_QUALIFIED` | `INTERACTION_READY` 100/100 |
| Continue Gate facts | `CLOSED` | her iki path `PRODUCT_PASS` |

## 4. D30 kampanya tablosu

Kapanış kampanyası: `D30-100-rerun-2026-08-151127`
(önce 20-gate `D30-20-gate-2026-08-151127` = 20/20 `PRODUCT_PASS`, clean).

Kaynak kimliği: HEAD `d941aab`, working tree clean, plan
`bfp-nesy.reference.login-1` /
`bfp-nesy.reference.login-rejected-1`, API `node dist/server.js` PID `23314`
(2026-08-15 14:27:28 +03), seed `90320260815-rerun-lcg`.

| class | n | runId örnekleri | root condition |
|---|---|---|---|
| `PRODUCT_PASS` | 99 | `run_7d3a7139` (valid), `run_96e6ad43` (invalid) | Final Oracle her iki path’te işi doğru buldu |
| `PRODUCT_FAIL` | 0 | | |
| `ENV_FAILURE` | 1 | `run_ccb08e81-a0e0-45cf-8440-ceef85df9b8a` | Prisma persistence unavailable / DB disconnect; eval axis `ENVIRONMENT_FAILURE` |
| `FORCE_STOP_NOT_CONFIRMED` | 0 | | |
| `PROCESS_NOT_STARTED` | 0 | | |
| `COLD_START_OS_SUSPEND` | 0 | | |
| `APP_NOT_READY` | 0 | | |
| `A11Y_SYNC_PENDING` | 0 | | |
| `UI_NOT_ACTIONABLE` | 0 | | |
| `SDK_NOT_READY` | 0 | | |
| `AUTH_PENDING` (post-action) | 0 | | |
| `BACKEND_BOOTSTRAP_PENDING` (post-action) | 0 | | |
| `EVIDENCE_TIMEOUT` | 0 | | |
| `TEST_DATA_CONTAMINATION` | 0 | | |
| `UNCLASSIFIED` | **0** | | |

Toplam: `100 / 100` sınıflı. `UNCLASSIFIED = 0`.

Kampanya sayaçları: `dbDisconnect=1`, `emergencyReset=1`, `primaryFailures=1`,
`secondaryContamination=0`, `cleanupMissing=0`, `orderedMissing=0`,
`receiptMissing=0`, `duplicateLogical=0`, `failureClassNoneOnNonPass=0`,
`cleanupSucceeded=100`.

### 4.0 #9 known environment interruption (backlog)

Yeni 100-run gerekmez. Engineering backlog:

```text
Known environment interruption:
Prisma DB disconnect
runId: run_ccb08e81-a0e0-45cf-8440-ceef85df9b8a
evaluationFailureClass: ENVIRONMENT_FAILURE
d30Class: ENV_FAILURE
ProductVerdict: NOT_EVALUATED
Cleanup: SUCCEEDED
isolation recovery: successful
next occurrence: run_b7065ccb PASS_ONLINE  (blast radius yok)
regression: apps/api/src/services/execution-failure-class.test.ts
            apps/api/src/services/bridgeflow-runtime-wiring.test.ts
```

### 4.1 100 runId + class

Makine listesi:
[`D30-100-rerun-2026-08-151127.close.json`](../D30-100-rerun-2026-08-151127.close.json).
`class` = `d30Class` (canonical histogram).

| # | path | runId | class | evaluationFailureClass | ProductVerdict | Cleanup |
|---|---|---|---|---|---|---|
|   1 | invalid | `run_96e6ad43-82d9-4752-820c-c41e73f7aed2` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|   2 | invalid | `run_59640f42-6304-4b8c-b43b-1a1402ed0b4b` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|   3 | valid   | `run_7d3a7139-7f2a-40c0-a3cd-32e6d5c21864` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|   4 | invalid | `run_34d98fe4-2558-4d1d-b76f-d183f7bf83ac` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|   5 | invalid | `run_b53e1335-093c-4259-a3a5-076ae257e559` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|   6 | invalid | `run_c7dbd425-1edd-4e64-9be1-b6ad5bf6a238` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|   7 | valid   | `run_5ade7ffa-66e6-4d22-bd21-50ff1deae756` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|   8 | invalid | `run_6653db19-35bc-42bf-8bf2-b5ea96e61afe` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|   9 | valid   | `run_ccb08e81-a0e0-45cf-8440-ceef85df9b8a` | `ENV_FAILURE` | `ENVIRONMENT_FAILURE` | `NOT_EVALUATED` | `SUCCEEDED` |
|  10 | valid   | `run_b7065ccb-6ab1-41d5-a138-79e5655dbd1a` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  11 | valid   | `run_d1ea17c6-935a-4ea4-97d6-40c0564d9d1b` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  12 | valid   | `run_a9b07bcb-e939-436c-9562-fcfe7ce86932` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  13 | valid   | `run_905b7d84-e603-47d6-baa6-779d79002f50` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  14 | valid   | `run_8ac478c2-3f78-48fd-adf8-2afe4b6233ea` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  15 | invalid | `run_c46d5368-4404-403f-b8f4-95fd3979a2a3` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  16 | valid   | `run_bdd51de7-49df-42f1-b182-8b179faf84e6` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  17 | valid   | `run_f52ed9ed-2cdc-4f97-bfd8-e17d2a2fa565` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  18 | invalid | `run_e27d3c42-671a-45bd-86eb-4ac00aed21fc` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  19 | valid   | `run_50279ecd-c27e-4e5c-ac3a-77f2ab4c56e3` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  20 | invalid | `run_85f050c7-14e8-40a9-8bf7-9955fe8adf25` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  21 | valid   | `run_806962f9-4324-4486-b50b-d3e9c57e0636` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  22 | invalid | `run_8c104ef5-8e7a-4639-baaa-1a42d0c94bb3` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  23 | invalid | `run_fed6c64d-cb26-42de-bf4f-a8199d420dbf` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  24 | invalid | `run_6298583d-ba5f-4fdc-a1b9-e5c2f15710c1` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  25 | valid   | `run_e89de0c5-dacd-4e29-aba3-cb9e86775440` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  26 | valid   | `run_8ef9970a-f796-4caa-973c-3f0f2dfa5cb9` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  27 | valid   | `run_d13401af-a1e9-4bb6-a4b2-ebf6486ba8c1` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  28 | invalid | `run_5577f9a6-245e-4da4-b15b-0eed61d19210` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  29 | invalid | `run_78a32458-e8db-46d5-8b5c-19a5e698733b` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  30 | valid   | `run_6dcef9d6-b0df-46ef-ae08-aa98cd4a01e3` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  31 | invalid | `run_f1c2d74d-6b90-4ba6-81aa-4ca5973c6c36` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  32 | valid   | `run_57830231-eb03-4519-a069-48bd7454ab16` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  33 | valid   | `run_286ce9d2-3e5d-4891-a00a-47d3fc25548f` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  34 | valid   | `run_80571727-ded5-4f72-a8b5-e373f5f97e8a` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  35 | invalid | `run_ef9de97b-f44f-41dd-8376-7186887be906` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  36 | valid   | `run_d30d1661-677d-47f7-b503-0d8869fbc357` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  37 | invalid | `run_316f63de-8ee6-406b-91e5-617348376ad7` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  38 | invalid | `run_c40e0f5e-d460-4704-8447-b3870c0903d7` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  39 | invalid | `run_c1fc2cab-4dbd-4ab2-9192-656de4c81de4` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  40 | invalid | `run_e5234904-bc46-447a-93b6-00eaccdf1725` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  41 | valid   | `run_fecfad9d-0d1a-495d-8a38-ac5fb45a4b7a` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  42 | valid   | `run_f828b12b-593f-4844-a7f1-802a08cb75b4` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  43 | valid   | `run_e1e32b1d-b3cf-40e4-a955-60245141614f` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  44 | invalid | `run_bc5861a0-3bd5-4bda-b406-760935a256e6` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  45 | invalid | `run_95f794ed-2020-4621-86d8-7d8e7f958b16` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  46 | invalid | `run_13a634fb-172c-456a-bd97-19e14f8c70d6` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  47 | invalid | `run_e1b0b722-90e2-4440-9d10-2782d1b9d98d` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  48 | valid   | `run_410b3f62-3b5c-4d8c-9544-9f0a72e3f459` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  49 | invalid | `run_55a63e16-7ad9-4876-a1bd-0f90ae616a1e` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  50 | valid   | `run_68d080dd-4b6c-4542-883f-f9298b25cb12` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  51 | invalid | `run_461cebc8-2265-4af1-aeb9-7ec777754ff8` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  52 | valid   | `run_54bb6370-4439-484f-8026-ecf6a26e5de3` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  53 | valid   | `run_d22d1817-8997-4cc7-90ea-bd838f6fd7aa` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  54 | valid   | `run_5a43d645-5d3f-423d-9044-ceca9de87806` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  55 | invalid | `run_38450750-e3e5-4460-bf70-f58f0b8ce9d0` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  56 | invalid | `run_bf847b04-eebb-42d6-92bf-dc13eb484b24` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  57 | invalid | `run_b0a6b059-bdc3-49ee-83b9-cfc450389743` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  58 | valid   | `run_0108179d-6b73-4797-9928-e94f60014b98` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  59 | valid   | `run_1f142aa0-9b50-4f67-9fcd-43d89d84ac74` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  60 | invalid | `run_7da6aa94-e3e2-4860-a5ce-87f10f6a5477` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  61 | valid   | `run_6f27929c-2df6-42a1-b6c3-3edb0bac0ad0` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  62 | invalid | `run_0c4626ff-7557-4cd3-b36c-9796fdca6e1e` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  63 | invalid | `run_abc7dfc3-635b-4294-954b-8a747baf1066` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  64 | valid   | `run_f40772fb-31aa-4a64-87bf-3f4640be0e50` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  65 | valid   | `run_bb301e84-c0e6-4a9b-b52e-6a6e30651f49` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  66 | valid   | `run_15a93c4c-6ab4-486d-bf8b-d845e18b44d8` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  67 | invalid | `run_2fdfc462-a743-43a2-8f03-266c644d87fd` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  68 | valid   | `run_159875b6-a158-453b-85ff-04f6ff5015a9` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  69 | valid   | `run_a69809e7-20f2-4e71-9faf-2c7574d3c504` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  70 | valid   | `run_c593d74e-04ac-4044-b6b9-4876f66c7c38` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  71 | invalid | `run_49a73f3a-8cdd-44c6-b1b2-16c59d9d8a38` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  72 | invalid | `run_5341c468-0196-4901-ab86-f6eb6771ce63` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  73 | valid   | `run_6d0b8cb9-2d4e-4b5d-812f-ac9815863ea6` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  74 | invalid | `run_207012d1-44e4-447c-a8e6-c5f9a1c8091b` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  75 | invalid | `run_2163c407-64a8-4988-bdba-df0cd891d091` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  76 | invalid | `run_0a34d187-398a-4379-a59b-300d45459a32` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  77 | invalid | `run_69782bc8-5bf0-4404-8d1a-2dd376df0182` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  78 | valid   | `run_d2ca9f48-fde6-4a37-97af-59b5f823c258` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  79 | invalid | `run_773ef3f2-5a7a-402b-9f87-827b5339cdc8` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  80 | valid   | `run_3c784537-0e21-4ded-91d7-6f9adf1a6729` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  81 | valid   | `run_51d7f549-e15e-4c47-9a1b-f88b1052d745` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  82 | valid   | `run_e8beb096-261c-4971-8c66-bbaa72762db7` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  83 | invalid | `run_f1423e4a-b320-41b4-8a26-6f458c51cbca` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  84 | valid   | `run_9ea7e2aa-a790-4656-873e-426a5c79751a` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  85 | valid   | `run_d9e5214a-026a-46c0-b624-ee47d791a2f4` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  86 | valid   | `run_a5c1f601-761d-42d3-b242-79ba3257046a` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  87 | valid   | `run_b66e07e9-81c8-43c1-b46a-1091aa93e758` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  88 | invalid | `run_af91ddf6-20db-4871-b55f-e3d50dd3b9fd` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  89 | valid   | `run_e1e39aae-ce4e-4c92-8932-56f177cdff85` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  90 | invalid | `run_cb93106e-7f9a-46c0-aa98-db2e40c22c91` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  91 | valid   | `run_6803c386-2b8b-4c92-a0cc-338e2f48cdeb` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  92 | invalid | `run_1f701337-dbc1-4dd4-b02d-bb2c102215b8` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  93 | invalid | `run_c62686aa-2fb8-4ed4-9fda-b0a4dc8acf6d` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  94 | valid   | `run_cba02509-98e0-4303-b94b-9ed2dfd47340` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  95 | invalid | `run_a9d39316-fbcd-4b1f-a823-0261ad1bfdeb` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  96 | valid   | `run_3ecfd72f-5cd5-4ddf-94b8-6bd974b00ac7` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  97 | invalid | `run_4ea40b04-1f81-49e6-b02b-a106564d7fe2` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  98 | invalid | `run_0ad1908e-60f5-4f98-874e-1398a07a498e` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
|  99 | invalid | `run_1d1083a1-5c44-4226-be6e-4838dea17484` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |
| 100 | invalid | `run_5d71b894-04d4-4922-bb8e-d186be709134` | `PRODUCT_PASS` | `NONE` | `PASS_ONLINE` | `SUCCEEDED` |

## 4.2 D60 karışıklık matrisi (şablon)

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

## 4.3 D90 metrik tablosu (şablon)

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

## 4.4 Internal acceptance (şablon)

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
| JOIN J0–J5 | `DONE` (login) | `J0✅ J1✅ J2✅ J3✅ J4 N/A J5✅` |
| G90.2b SM implementasyonu | `DONE` | yedili + `INTERACTION_READY`; live 100/100 |
| G90.3 Login evidence (parent) | `DONE` | = 3a ∧ 3b; 2026-08-15 |
| G90.3a Continue Gate | `DONE` | her iki path `PRODUCT_PASS` (gate kapandı) |
| G90.3b Final Oracle | `DONE` | valid `run_7d3a7139` + invalid `run_96e6ad43` `LOGIN_REJECTED` |
| G90.3c automationRelease golden | `NOT_STARTED` | P1 |
| G90.3e Remote login evidence | `NOT_STARTED` | J4 N/A / P2 |
| G90.4 Isolation / contamination | `NOT_STARTED` | P1 fixture; kampanya isolation 0 contamination (G90.4’ü kapatmaz) |
| G90.5 100 koşu | `DONE` | 20-gate clean → 100 classified; `UNCLASSIFIED=0` |
| G90.6 Sınıf regresyonları | `DONE` | görülen: `PRODUCT_PASS` (live + pack oracle), `ENV_FAILURE` (`execution-failure-class.test.ts`, wiring) |
| G90.7 D30 kapanış | `DONE` | bu dosya; 2026-08-15 |
| G90.8 D60 spec kilidi | `DONE` | `RUN_PLAY.md` §15–18 |
| G90.9 injectedFault alanı | `LIVE_QUALIFIED` | 2026-08-15 fresh prod `3770d2a`; Smoke A/B; formal kampanya değil |
| G90.10 Altı enjektör | `IN_PROGRESS` | BD.3+BD.2 LIVE_QUALIFIED; BD.6 process-parcel HOST_NOT_CAPABLE; host amend complete-delivery / tap-delivery-confirm; BD.5/4/1 yok |
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
| `docs/verdict/goals/G90-stabilization/RESULT.md` | D30 COMPLETED; 100-run histogram + class list |
| `docs/verdict/goals/G90-stabilization/RUN_PLAY.md` | G90.3/5/6/7 DONE; recovery D30_COMPLETED |
| `docs/verdict/goals/G90-stabilization/JOIN.md` | J1–J5 login closed |
| `apps/api/src/services/execution-failure-class.ts` | persist `ENVIRONMENT_FAILURE`; histogram `toD30HistogramClass` → `ENV_FAILURE` |
| `scripts/d30-campaign-run.mjs` | `evaluationFailureClass` + `d30Class` export |
| `docs/verdict/goals/D30-100-rerun-2026-08-151127.close.json` | machine-readable close list |
| `packages/workflow-contract/src/injected-fault.ts` | G90.9 injectedFault ≠ observedClass |
| `packages/db/prisma/migrations/20260815163000_add_injected_fault_axes/migration.sql` | persist the two axes |

## 7. Skipped / deferred

- Login remote REQUIRED (G4; G5 sonrası soğan)
- Process-kill / G6 (D60 BD.1)
- Yeni Cockpit feature / AI / ikinci workflow / userdebug lab
- D60 / D90 **kampanyaları** (D30 kapandı; D60 artık ungated)
- Aynı login slice’ı bir 100-run daha (marjinal bilgi)
- `RELIABILITY_PROVEN` / `pilot-stable` / `internallyStable`

## 8. Blockers

| ID | Severity | Status | Not |
|---|---|---|---|
| LOGIN_CONTINUE_GATE_FACTS | HIGH | `CLOSED` | Live observed; her iki path `PRODUCT_PASS` |
| START_INVARIANT_MISSING | HIGH | `CLOSED` | Code + live `INTERACTION_READY` 100/100 |
| LOCAL_DB_NOT_EXERCISED | HIGH | `CLOSED` | Positive-path `PRODUCT_PASS` LOCAL REQUIRED’ı taşıdı |
| FIXTURE_NONDETERMINISM | MEDIUM | `OPEN` | G90.4 P1 |
| D30_ENV_PRISMA_DISCONNECT | LOW | `BACKLOG` | #9; sınıflı; cleanup+isolation OK; 100/100 PASS peşinde değil |
| CP3-DUT | EXT | `DEFERRED` | Track B |
| KILL_RECOVERY | EXT | `SPEC_LOCKED` | D60 BD.1; kampanya artık ungated |
| BAD_DAY_INJECTORS | HIGH | `IN_PROGRESS` | BD.3+BD.2 LIVE_QUALIFIED; BD.6 process-parcel HOST_NOT_CAPABLE; complete-delivery arm; formal kampanya 13 Eylül |
| SECOND_DUT | MEDIUM | `OPEN` | D90 `pilotStable=YES` için ≥2 serial |

## 9. Next window handoff

```text
D30 COMPLETED. 100 classified. 99 PRODUCT_PASS. 1 ENV_FAILURE. UNCLASSIFIED=0.
D30 measured reliability established for the login slice.
RELIABILITY_PROVEN değil. G90 COMPLETED değil.
G90.9 LIVE_QUALIFIED. G90.10 BD.3+BD.2 LIVE_QUALIFIED.
BD.6 process-parcel HOST_NOT_CAPABLE (run_578dcc5d negative live). Classifier held.
complete-delivery uninjected `run_80a055d2` (PID 76781 / `06786f0` / pack 1.34.0):
APP.DELIVERY_SUBMITTED SATISFIED, queue absent, observedClass=null,
REMOTE proof [] while device itemStatus=6. LIVE_QUALIFIED değil.
NEXT = persist/observe deliverParcels on RS staging; do not loosen classifier.
injectedFault ≠ observedClass. Uninjected null. Do not bind qual to PID 25062.
Formal D60 campaign NOT_STARTED (window 13 Sep–12 Oct).
Not G90.4 / 3c / 3e.
Amaç her şeyi yeşil yapmak değil: enjekte edilen kırılım beklenen sınıfı üretmeli.
Aynı login’i 100 kez daha koşturma.
```
