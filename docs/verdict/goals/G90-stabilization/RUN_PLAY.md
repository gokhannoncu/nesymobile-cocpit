# G90 RUN_PLAY — 90 gün sınıflı stabilizasyon

```yaml
goalId: G90-stabilization
runPlayId: verdict-goal-g90-stabilization
goalName: "90-day classified stabilization"
northStar: "known failure modes, measured reliability, bounded recovery, explainable unknown states, repeatable business verification"
status: IN_PROGRESS
recoveryState: D30_COMPLETED
createdAt: "2026-08-13 15:25:00 +03"
openedAt: "2026-08-13 15:25:00 +03"
startedAt: "2026-08-15 14:27:28 +03"
completedAt: null
lastUpdatedAt: "2026-08-15 16:50:00 +03"
timezone: "Europe/Istanbul"
windowStart: "2026-08-13"
windowEnd: "2026-11-11"
d30End: "2026-09-12"
d60End: "2026-10-12"
d90End: "2026-11-11"
nextStep: G90.10_BD3_LIVE_QUAL
nextStepFile: "docs/verdict/goals/G90-stabilization/RUN_PLAY.md"
d60Implementation: G90.10_BD3_IMPLEMENTED
d60CampaignStatus: NOT_STARTED
d60CampaignWindow: "2026-09-13 → 2026-10-12 — formal matrix not opened early"
d14Gate: "G90.2b + G90.3 closed 2026-08-15"
resultFile: "docs/verdict/goals/G90-stabilization/RESULT.md"
acceptanceFile: "docs/verdict/goals/G90-stabilization/ACCEPTANCE.md"
readinessFile: "docs/verdict/goals/G90-stabilization/READINESS.md"
joinFile: "docs/verdict/goals/G90-stabilization/JOIN.md"
criticalPath: D60_BAD_DAY
d30Status: COMPLETED
internallyStable: SPEC_LOCKED
masterPlanPath: "docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md"
operatingModel: "docs/verdict/OPERATING_MODEL.md"
relatedLab: "SM-A346E R6CW400BC8N user (not userdebug)"
d30Slice: "nesy.macro.login / nesy.launch.cold-real-login / PIN path"
d30Campaign: "100 consecutive classified runs"
d30CampaignGate: "3-5 consecutive PRODUCT_PASS, then 20 classified, then 100; not from first PASS"
d60Status: SPEC_LOCKED
d60Campaign: "controlled bad-day matrix; injected fault → expected class"
d60Faults:
  - process-kill
  - network-disconnect
  - backend-timeout
  - dialog-overlay
  - duplicate-callback
  - offline-queue
d90Status: SPEC_LOCKED
d90Campaign: "3-5 business workflows + device variation + soak; six metric families + M2b environment companion; then pilot-stable may be claimed"
d90Workflows:
  - nesy.macro.login
  - nesy.macro.select-route
  - nesy.macro.process-parcel
  - nesy.macro.complete-delivery
d90OptionalFifth: nesy.macro.tour-approval-lifecycle
d90Metrics:
  - execution_time_p50_p95
  - automation_failure_rate
  - environment_interruption_rate
  - evidence_closure_latency
  - unknown_effect_rate
  - recovery_success_rate
  - repeatability
```

## 1. Hedef (kilitli)

```text
Bilinen failure modes,
ölçülmüş reliability,
bounded recovery,
açıklanabilir unknown states,
repeatable business verification.
```

Bu beş madde G90’ın **ürün cümlesidir**. D30 / D60 / D90 ona hizmet eden
pencerelerdir. Yeşil oran, “artık flaky değil”, Phase 7 fixture veya
`pilot-stable` sloganı bu cümlenin yerine geçmez.

| Madde | Ne kanıtlar | Nerede kilitli |
|---|---|---|
| Bilinen failure modes | Kapalı `class` sözlüğü; `UNCLASSIFIED=0`; D60 köşegeni | §5, §16, §17 |
| Ölçülmüş reliability | Altı metric family + M2b environment companion, n ile; uydurma SLO yok | §21 |
| Bounded recovery | Sınıf başına tavan 1; gesture auto-retry yok | §6.2, §18, M5 |
| Açıklanabilir unknown states | `UNKNOWN_EFFECT` / `INCONCLUSIVE` / `PENDING_REMOTE` yıksız torba değil; kök koşul yazılı | §4, §16, M4 |
| Repeatable business verification | Aynı plan hash + girdi → aynı sınıf dağılımı; Final Oracle iş hükmü | §4 D30, M6, §20 |

Pencereler (araç, hedef değil):

- **D30** — bir golden slice’ta her koşunun nedeni bilinir (failure modes + business verification’ın tohumu).
- **D60** — aynı sınıflandırıcı bilinçli kırılır; bounded recovery ve unknown’lar isimlendirilir.
- **D90** — 3–5 workflow + cihaz + soak; reliability ölçülür; `pilot-stable` yalnız bu beş madde RESULT’ta duruyorsa söylenir.

G90 `COMPLETED` = beş madde kanıtlı. Üç pencere tikli ama unknown hâlâ `TIMEOUT` ise hedef kapanmamıştır.

“Artık gerçekten stabil” G90 / `pilot-stable` **değildir**. Internal acceptance
yedili kapı: [`ACCEPTANCE.md`](./ACCEPTANCE.md) (`internallyStable`).
`pilot-stable` daha erken; `internallyStable=YES` 3 device family, ≥%97
completion, overnight soak ve false PASS=0 ister.

## 1.1 Sahada bozulma beklenir

Bu tip üründe “bazen işler beklediğim gibi gitmiyor” **kaçınılmazdır**.
Şaşırtıcı olan ilk tasarımın sahada bozulması değil; bozulmayı yoksayıp
sleep / yeni jest / yeni zeki mekanizma eklemektir.

Kâğıt:

```text
tap → event → backend → assert
```

Saha — her ok bir failure boundary:

```text
tap
  → accessibility race
  → UI transition
  → app main thread load
  → network request
  → process lifecycle
  → Room transaction
  → event transport
  → backend async worker
  → eventual state
  → correlation
  → oracle
```

| Boundary | Bu labda görülen / beklenen | Invariant veya sınıf (yeni mekanizma değil) |
|---|---|---|
| accessibility race | splash/stale tree, `treeGen`, PIN tab ambiguity | `BRIDGE_READY`; `DIALOG_INTERRUPT`; ambiguity FAIL |
| UI transition | `SCREEN_READY` ≠ actionable; PIN 2.4s / 3.9s | `EXPECTED_SURFACE_READY`; Continue Gate ≠ Final Oracle |
| app main thread | splash, `onCreate`, ART `run-from-apk` | `APP_READY` |
| network request | kesilme, 2xx ≠ iş | `NETWORK_PARTITION`; HTTP 2xx yasak |
| process lifecycle | force-stop doğrulanamadı | `FORCE_STOP_NOT_CONFIRMED` → `NOT_EVALUATED` |
| process lifecycle | OEM park (`S`, CPU tick 0) | `COLD_START_OS_SUSPEND` — `APP_NOT_READY` değil ([`READINESS.md`](./READINESS.md)) |
| process lifecycle | koşu içi kill | `PROCESS_DEATH` (D60); `UNKNOWN_EFFECT`; auto-retry yok |
| Room transaction | prepared session ≠ DB satırı | LOCAL REQUIRED; `TEST_DATA_CONTAMINATION` |
| event transport | WAL/WS, occurrence host’ta | `SDK_READY`; fact producer yoksa `EVIDENCE_TIMEOUT` + `factKey` |
| backend async worker | admin token ≠ kurye; timeout | `BACKEND_TIMEOUT`; login remote OPTIONAL |
| eventual state | continue gate “waiting for facts” | EVENTUAL + deadline; yıksız `INCONCLUSIVE` yok |
| correlation | reset sonrası eski occurrence | isolation; `NesyCorrelationContext.clear` |
| oracle | false PASS, HTTP’yi iş sanmak | Final Oracle dört düzlem; G5 defect set |

Asıl mühendislik ilk tasarımın doğru çıkması **değil**. Sıradaki iş:

```text
gerçek failure → classification → root condition → invariant
  → bounded recovery → metric → regression
```

Her yeni ok için yeni beyin yok. Boundary, kapalı sınıfa ve mevcut
invariant’a bağlanır. Bağlanamıyorsa `UNCLASSIFIED` — o D30 fail’dir, “flaky”
değil.

Son login (`run_c5b41c62`) kâğıt `tap → assert`’in koptuğu yer: jest yolu
işledi, correlation/eventual/oracle kapanmadı. Beklenen saha, sürpriz değil.

Ana risk “teknoloji yapılabilir mi?” değil: bağımsız alt sistemlerin **aynı
occurrence altında** kapanması. Ölçü: Readiness / Evidence / Oracle /
Recovery / Reliability boundary. `0/10` ≠ ürün %0. SSOT: [`JOIN.md`](./JOIN.md).

Phase 10 fact plumbing `CODE_WIRED` ≠ G90 live golden fact
([`RESULT.md`](./RESULT.md) §1.1).

Cold start tek adım değil: [`READINESS.md`](./READINESS.md) — pre-action
yedili, `INTERACTION_READY`; AUTH/bootstrap action **sonrası**. G90.2b
`READINESS_LIVE_QUALIFIED`; G90.3 = 3a ∧ 3b `DONE` (2026-08-15).
D30 `COMPLETED`. G90.9 `LIVE_QUALIFIED` (fresh prod `3770d2a`, Smoke A/B).
G90.10 BD.3 **implemented**, not live-qualified. **NEXT = Host B live qual
on a new prod PID** (55798 G90.9 lineage). Formal D60 kampanyası 13 Eylül’e
kadar açılmaz. İkinci workflow D30’a girmez.

## 2. Neden bu iz ayrı?

Cockpit Phase 7 `COMPLETED` / `PASSED_WITH_EXTERNAL_DUT_BLOCKERS`. Mobile M7
`READY_WITH_EXTERNAL_BLOCKERS`, M8 `BLOCKED_EXTERNAL`. Son canlı login
(`run_c5b41c62`, 2026-08-12/13) `product_verdict=INCONCLUSIVE`,
`AUTOMATION_FAILURE`, `ABORTED` — `wait-login-ready` geçti, continue gate
“still waiting for facts”.

Faz playbook’u omurgayı teslim etti. Bu hedef omurganın **birleşmesini** ölçer.

## 3. D30 vertical slice (kilitli)

| Alan | Değer |
|---|---|
| Slice | Courier PIN login, gerçek UI |
| Pack | `nesy.courier` · `nesy.macro.login` |
| Launch | `nesy.launch.cold-real-login` (`COLD_START`, `REAL_UI_LOGIN`) |
| APK | `tstrsAutomationRelease` (ölçüm referansı; debug ile karıştırılmaz) |
| DUT | Aynı cihaz, aynı AOT politikası, kayıtlı serial |
| Kampanya | 100 ardışık koşu, aynı pin/fixture sözleşmesi. Açılış: 3–5 ardışık PASS → 20 → 100. İlk PASS’te 100 yok. |
| Ürün hükmü | Yalnız bu slice `producesProductVerdict: true` |

İkinci workflow (select-route, full-courier-golden, kill-recovery) D30
acceptance’a **giremez**. Login kapanmadan genişlemek, sınıflı metriği torbaya
çevirir.

## 4. D30 başarı tanımı — %100 yeşil değil

Yasak sonuç:

```text
94 PASS
6 FAIL
```

Kabul edilen biçim (sayılar örnek; sınıflar zorunlu):

```text
94 PRODUCT_PASS
2  ENV_FAILURE
1  COLD_START_OS_SUSPEND
1  A11Y_SYNC_PENDING
1  EVIDENCE_TIMEOUT
1  TEST_DATA_CONTAMINATION
```

**100 koşunun 100’ünün nedeni bilinir.** Bu, %100 `PRODUCT_PASS`’ten daha
değerli bir D30 kapanışıdır.

`UNCLASSIFIED`, `TIMEOUT` (yıksız), `INCONCLUSIVE` (yıksız) veya `ABORTED`
(nedeni yok) kalan **tek bir koşu** D30’u `FAILED` yapar — yeşil oranı %99 olsa
bile.

## 5. Kapalı sınıf sözlüğü (D30)

Ürün / harness sınıfları aşağıda. Pre-action **yedili**
[`READINESS.md`](./READINESS.md) **SSOT**. `AUTH_PENDING` /
`BACKEND_BOOTSTRAP_PENDING` jest **sonrası** (SM dışı).

`COLD_START_OS_SUSPEND` D30 histogram kodudur. `APP_NOT_READY` altına
yazılmaz. `AUTH_PENDING` ilk action’dan önce yazılmaz.

Yeni sınıf eklemek yeni mekanizma eklemekle aynı tuzaktır. D60 eki bölüm 16’da.

**Kilit A:** `class` yalnız canonical. Eski aggregate isimler
(`APP_READINESS_TIMEOUT`, `SDK_READINESS_FAILURE`,
`BRIDGE_READINESS_FAILURE`, `SURFACE_NOT_READY`, `COLD_START_TIMEOUT`)
reporting parent **değildir**. Üretici basarsa satır `UNCLASSIFIED`.
Remap tablosu yok. `STALE_TREE` observation, class değil.

| Kod | Ne | Ürün hükmü mü? |
|---|---|---|
| `PRODUCT_PASS` | Final Oracle işi doğru buldu (app + local; remote login’de OPTIONAL) | Evet |
| `PRODUCT_FAIL` | Final Oracle ürün davranışını test beklentisine aykırı buldu | Evet |
| `ENV_FAILURE` | Cihaz, USB, AOT, host process, disk, lab ağı — ürün değil | Hayır |
| `FORCE_STOP_NOT_CONFIRMED` | Cold başlamadı; `NOT_EVALUATED` | Hayır |
| `PROCESS_NOT_STARTED` | Launch, process yok | Hayır |
| `COLD_START_OS_SUSPEND` | Process `S`, CPU tick 0 (OEM park). `APP_NOT_READY` değil | Hayır |
| `APP_NOT_READY` | Lifecycle hazır değil | Hayır |
| `A11Y_SYNC_PENDING` | treeGen/window senkron değil | Hayır |
| `UI_NOT_ACTIONABLE` | Görünür, action değil | Hayır |
| `SDK_NOT_READY` | Control/WAL/runId yok (pre-action) | Hayır |
| `AUTH_PENDING` | Submit **sonrası** session fact yok — pre-action değil | Hayır |
| `BACKEND_BOOTSTRAP_PENDING` | Session var, iş verisi yok — pre-action değil | Hayır |
| `EVIDENCE_TIMEOUT` | Jest sonrası continue gate / fact lane | Hayır |
| `TEST_DATA_CONTAMINATION` | Önceki koşunun session/DB/SP kalıntısı; isolation assertion kırıldı | Hayır |
| `UNCLASSIFIED` | Sözlükte yok / yıksız. D30’u `FAILED` yapar | Hayır |

Her `class` tam **bir** satır. Duplicate satır spec fail’dir; metric pipeline bu tabloyu 1:1 okur. D60 kodları (§16) bu tabloya eklenmez.

İki eksen bilinçli ayrı durur. Persisted eval axis
(`evaluationFailureClass`): `NONE` | `AUTOMATION_FAILURE` |
`ENVIRONMENT_FAILURE` | `EVIDENCE_INSUFFICIENT`. Histogram `class`
(`d30Class`) bu tablodur. Tek izinli remap `toD30HistogramClass`:
`ENVIRONMENT_FAILURE` → `ENV_FAILURE`; `EVIDENCE_INSUFFICIENT` →
`EVIDENCE_TIMEOUT`; readiness class, ürün değerlendirilmediyse histogram
sınıfıdır. Prisma kodları `failureDetail` üzerindedir.

`LOGIN_REJECTED` bir **business fact**'tir; ProductVerdict değildir. Kontrollü
wrong-PIN testinde beklenti `LOGIN_REJECTED=true` olur. Final Oracle bu fact'i
beklenen occurrence üzerinde doğrularsa test sonucu `PRODUCT_PASS`; reddin
gelmemesi veya yanlış occurrence'a bağlanması `PRODUCT_FAIL` / kanıt eksikse
`INCONCLUSIVE` olur. Business outcome polarity ile test correctness aynı axis'e
sıkıştırılmaz.

## 6. Yöntem — failure’a mekanizma eklenmez

```text
failure
  → classification
  → root condition (ölçülen observable)
  → invariant
  → bounded recovery policy
  → metric
  → regression test
```

Yasak kalıp:

```text
failure → workaround → başka failure → başka mekanizma
```

§1.1’deki her ok bu döngüye girer. İlk tasarımın sahada bozulması döngüyü
başlatır; kapatmaz. Kapanış: aynı boundary’nin ikinci kez `UNCLASSIFIED`
veya yeni waiter üretmemesi.

Özellikle yasak: `sleep(N)`, timeout şişirme (1.5s → 20s), yeni tap/activate
yolu, parked `wait_node`’u “hız” diye satmak, her sınıfa ayrı zeki waiter.

### 6.1 Readiness state machine (jestten önce)

Eski dört conjunct torba (`APP ∧ SDK ∧ BRIDGE ∧ SURFACE`) **kaldırıldı**.
Yerine [`READINESS.md`](./READINESS.md):

- force-stop confirmed değilse `NOT_EVALUATED`
- `INTERACTION_READY` olmadan `BRIDGE_ACTION` yok
- `AUTH_*` / bootstrap pre-action **yok**
- timeout = deadline; class = ilk unmet zorunlu state
- `UI_ACTIONABLE(PIN)` platform readiness; continue gate ayrı katman
- `STALE_TREE` observation, `A11Y_SYNC_PENDING` ≠ `UI_NOT_ACTIONABLE`

Admission (cihazı sürebilir miyiz?) durur, SM’den önce.

Continue Gate jestten **sonra** kalır. Final Oracle iş hükmüdür. Üçünü bir
`WAIT_EVENT`’te eritmek yasak. `wait-login-ready` tek fact torbası yasak.

### 6.2 Bounded recovery

Sınıf başına en fazla **bir** politika, deneme tavanı sabit. Yetmezse aynı
sınıfla FAIL. Bridge karar vermez.

## 7. Metrik (D30 kampanyası)

Her koşu satırı en az:

- `runId`
- `class` (bölüm 5)
- `rootCondition` (kısa, ölçülen)
- start invariant conjunct `monoTs` (true olduğu an veya false kalan)
- `recoveryUsed` (0/1)
- `productVerdict` (`PASS` / `FAIL` / `NOT_APPLICABLE`)
- `harnessVerdict` (sınıf)

Kampanya özeti: 100 satır, `UNCLASSIFIED = 0`, sınıf histogramı, conjunct
süreleri (p50/p99).

## 8. 90 gün pencereleri

| Pencere | Tarih | Amaç | Acceptance (bu dosyada kilitli olan) |
|---|---|---|---|
| **D30** | 13 Aug → 12 Sep 2026 | Tek slice, 100 sınıflı koşu | Bölüm 4–7. `UNCLASSIFIED=0`. Readiness SM ([`READINESS.md`](./READINESS.md)) veya D30 `FAILED`. |
| **D60** | 13 Sep → 12 Oct 2026 | Controlled bad-day | Bölüm 15–18. Enjekte edilen 6 fault → beklenen sınıf. Karışıklık matrisi. D30 `COMPLETED` olmadan kampanya yok; **spec bugün kilitli**. |
| **D90** | 13 Oct → 11 Nov 2026 | 3–5 workflow + cihaz + soak | Bölüm 19–22. Altı metric family + M2b environment companion yayınlanır. `pilot-stable` yalnız o kapanışta. D60 `COMPLETED` olmadan kampanya yok; **spec bugün kilitli**. |

Üç pencerenin spec’i kilitli olmak D30 soak’unu genişletmez: D30 hâlâ tek slice,
D60 hâlâ yeni waiter yok, D90 hâlâ yeni sınıf sözlüğü yok.

## 9. Owned paths

Hedef dokümanı (bu iz):

```text
docs/verdict/goals/**
```

D30 işi başladığında kod (gerekçeli, ayrı commit/play):

```text
apps/api/src/services/bridgeflow-execution-queue.ts
apps/api/src/services/screen-readiness-observer.ts
packages/oracle-engine/**
domain-packs/nesy-courier/src/macros/login.ts
domain-packs/nesy-courier/src/profiles/launch.ts
```

D60 enjektör / sınıf (D30 `COMPLETED` sonrası; yeni waiter değil):

```text
apps/api/src/services/nesy-backoffice-adapter.ts
packages/bridgeflow-executor/**
domain-packs/nesy-courier/src/macros/complete-delivery.ts
domain-packs/nesy-courier/src/macros/process-parcel.ts
NesyMobile/app/src/automation/**/NesyResetProvider.kt
NesyMobile/app/src/automation/**/NesyAppAdapterQueryCapability.kt
```

D90 soak / metrik (D60 `COMPLETED` sonrası; yeni sınıf yok):

```text
domain-packs/nesy-courier/src/macros/select-route.ts
domain-packs/nesy-courier/src/macros/process-parcel.ts
domain-packs/nesy-courier/src/macros/complete-delivery.ts
domain-packs/nesy-courier/src/macros/tour-approval-lifecycle.ts
apps/api/src/services/oracle-evaluation-worker.ts
packages/bridgeflow-executor/**
```

Mobile (ayrı repo, ayrı agent; bu playbook yazmaz):

```text
NesyMobile/app/src/automation/**
NesyMobile/verdict-bridge/**
```

## 10. Out of scope (D30)

- İkinci Nesy workflow’u golden yapmak
- userdebug DUT / CP3-DUT kapatmak (ENV sınıfı olarak **sayılır**, lab değişimi D30 kapanışını bekletmez: sınıflı `ENV_FAILURE` geçerli sonuçtur)
- Live Inspector / Design Audit / İz C
- Yeni Bridge komutu veya yeni jest tipi
- Login remote düzlemini REQUIRED yapmak (backend courier login-log yok)
- `%100 PRODUCT_PASS` iddiası
- D60 fault enjeksiyonu (D30 soak’u kirletmez; `injectedFault` yoksa D30 satırıdır)

## 11. Step checklist

| Step | İş | Durum |
|---|---|---|
| G90.0 | Hedef izi aç, D30 slice kilitle | `DONE` (bu dosya) |
| G90.1 | Sınıf + readiness izi run kaydında (READINESS çıktı formatı) | `MERGED_INTO_G90.2b` |
| G90.2 | Readiness Core spec (yedili + pre/post split) | `DONE` — [`READINESS.md`](./READINESS.md) 14 Aug 17:04 |
| G90.2b | SM koda — `INTERACTION_READY`; AUTH/bootstrap pre-action **yok**. Kalıcı trace + canonical class. | `DONE` — live `READINESS_LIVE_QUALIFIED` 2026-08-15 |
| G90.3 | **Parent** login evidence closure = 3a ∧ 3b | `DONE` (2026-08-15) |
| G90.3a | Continue Gate fact journey (12 basamak, her iki path) | `DONE` — her iki path `PRODUCT_PASS` (gate kapandı) |
| G90.3b | Final Oracle: **1× positive-path PRODUCT_PASS + 1× expected-rejection PRODUCT_PASS** carrying `LOGIN_REJECTED` (LOCAL REQUIRED) | `DONE` — `run_7d3a7139` + `run_96e6ad43` |
| G90.3c | `tstrsAutomationRelease` golden | `NOT_STARTED` (3 sonrası P1) |
| G90.3e | Remote login evidence | `NOT_STARTED` (J4 N/A / P2) |
| G90.4 | Isolation reset / fixture determinism (`TEST_DATA_CONTAMINATION`) | `NOT_STARTED` (P1; D30 campaign isolation 0 contamination bunu kapatmaz) |
| G90.5 | 100 koşu: ancak 3–5 ardışık PASS + 20 sınıflı sonra; histogram + `UNCLASSIFIED=0` | `DONE` — 99 `PRODUCT_PASS` / 1 `ENV_FAILURE` / `UNCLASSIFIED=0` |
| G90.6 | Her görülen sınıfa bir regresyon (bağımsız kırılabilir) | `DONE` — `PRODUCT_PASS` + `ENV_FAILURE` |
| G90.7 | D30 RESULT kapat | `DONE` (2026-08-15) |
| G90.8 | D60 spec kilidi (bad-day matrisi) | `DONE` (bu dosya, 2026-08-13) |
| G90.9 | `injectedFault` alanı + D60 sınıf kodları run kaydında | `LIVE_QUALIFIED` (2026-08-15) — fresh prod `3770d2a` Smoke A/B; kampanya `NOT_STARTED` |
| G90.10 | Altı senaryo enjektörü (bölüm 16); yeni waiter yok | `IN_PROGRESS` — BD.3 code; live qual + diğer beş yok |
| G90.11 | D60 kampanyası: senaryo başına ≥5 eşleşen sınıf; karışıklık matrisi | `NOT_STARTED` |
| G90.12 | D60 RESULT kapat | `NOT_STARTED` |
| G90.13 | D90 spec kilidi (workflow set + altı metric family + M2b companion + pilot-stable) | `DONE` (bu dosya, 2026-08-13) |
| G90.14 | Metrik enstrümantasyonu (bölüm 21); sınıf alanı durur | `NOT_STARTED` |
| G90.15 | D90 soak: ≥2 DUT, 3–5 workflow, `injectedFault=null` | `NOT_STARTED` |
| G90.16 | D90 RESULT + `pilotStable` kararı | `NOT_STARTED` |
| G90.17 | Internal acceptance G1–G7 ([`ACCEPTANCE.md`](./ACCEPTANCE.md)) | `NOT_STARTED` (gate: `pilotStable=YES`) |

## 12. Verification

G90.2b kapanışı: yedili SM kodda; `INTERACTION_READY` ilk action kapısı;
`AUTH_*` pre-action yok; `wait-login-ready` torbası yok. Live 100/100
`INTERACTION_READY` (2026-08-15).
G90.3 kapanışı = 3a ∧ 3b ([`JOIN.md`](./JOIN.md) §11): 1× positive-path
PASS + 1× expected-rejection PASS;
`J2✅ J3✅ J4 N/A J5✅`. 2026-08-15 `DONE`.

D30 kapanışı için RESULT’ta bulunacak:

1. 100 `runId` listesi ve her birinin `class` değeri (açılış: 3–5 PASS → 20 → 100)
2. `UNCLASSIFIED = 0` kanıtı
3. Readiness SM kodda (yedili, `INTERACTION_READY`); `wait-login-ready` ve `COLD_START_TIMEOUT` root class yok
4. G90.3: 1× `PRODUCT_PASS` **ve** 1× `LOGIN_REJECTED` (yalnız negatif yetmez)
5. Sınıf başına en az bir regresyon testi veya replay fixture
6. Login boundaries: `J2✅ J3✅ J4 N/A J5✅`

D60 kapanışı için RESULT’ta bulunacak:

1. 6×N karışıklık matrisi (`injectedFault` × gözlenen `class`)
2. Her senaryoda beklenen sınıf = gözlenen sınıf, `UNCLASSIFIED = 0`
3. Yanlış hücre yok: özellikle `PRODUCT_PASS` (kanıt yeniden kurulmadan), `PRODUCT_FAIL` (iş yanlışmış gibi), yıksız `TIMEOUT`
4. Senaryo başına en az bir regresyon: aynı enjeksiyon, aynı sınıf
5. D30 sınıf sözlüğü duruyor; D60 kodları bölüm 16 dışında uydurulmamış

D90 kapanışı için RESULT’ta bulunacak:

1. 3–5 kilitli workflow, her biri için n ve sınıf histogramı, `UNCLASSIFIED=0`
2. ≥2 DUT serial (yoksa `pilotStable=SINGLE_DUT_SOAK`, kelime kullanılmaz)
3. Bölüm 21’deki altı metric family + M2b environment companion, n ve formül ile
4. Repeatability iki pencere kaydı
5. `pilotStable: YES | NO | SINGLE_DUT_SOAK` — slayt cümlesi değil, RESULT alanı

Kanıtsız `COMPLETED` yasak. `pilot-stable` bu alan olmadan söylenmez.

## 13. Rollback / recovery

Kampanya yarım kalırsa RESULT `PAUSED`, son `runId` + histogram yazılır. Sınıf
sözlüğü genişletilerek yeşile boyanmaz. Agent bu dosyanın owned path’i dışına
çıkmadan önce gerekçe yazar.

## 14. Agent başlangıç metni

```text
G90 north star: bilinen failure modes, ölçülmüş reliability, bounded recovery,
açıklanabilir unknown states, repeatable business verification. Ana risk join.
Ölçü: Readiness / Evidence / Oracle / Recovery / Reliability boundary.
Phase 10 plumbing ≠ live golden fact. D30 yalnız courier PIN login.
D30 COMPLETED 2026-08-15: 100 classified, 99 PRODUCT_PASS, 1 ENV_FAILURE,
UNCLASSIFIED=0. 94 PASS / 6 sınıflı failure, belirsiz timeout’tan değerli.
Timeout/sleep/jest yok. RELIABILITY_PROVEN değil.
G90.2b READINESS_LIVE_QUALIFIED. G90.3 DONE.
G90.9 LIVE_QUALIFIED: injectedFault ≠ observedClass. Formal D60 kampanya NOT_STARTED.
G90.10 BD.3 implemented (observeInjectedClass does not take injectedFault).
Injection model: controlled adapter-deadline injection representing BD.3 BACKEND_TIMEOUT.
NEXT = BD.3 Host B live qual on fresh prod; then BD.2 → BD.6 → BD.5 → BD.4 → BD.1.
Amaç her şeyi yeşil yapmak değil: enjekte edilen kırılım beklenen sınıfı üretmeli.
J0–J5 ladder değil. İkinci 100-run login yok.
pilotStable D90 öncesi freeze ister. Önce READINESS.md, JOIN.md, RESULT.md oku.
```

## 15. D60 amacı — controlled bad-day

D30 “mutlu günü sınıfla”dır. D60 “kötü günü sınıfla”dır.

Amaç sistemi kırılmaya karşı yalıtmak **değil**. Amaç: her kırılımın **beklenen
sınıfı** üretmesi. Yeşil oran D60 kapanış metriği değildir. Karışıklık matrisi
kapanış metriğidir.

```text
injectedFault = PROCESS_KILL
    → class = PROCESS_DEATH
    → productVerdict = NOT_APPLICABLE  (kanıt yeniden kurulmadan PASS yok)

injectedFault = BACKEND_TIMEOUT
    → class = BACKEND_TIMEOUT
    → productVerdict ≠ PRODUCT_FAIL     (iş yanlış değil; remote gelmedi)
    → HTTP 2xx ≠ PRODUCT_PASS
```

Yanlış D60 “başarısı”: fault enjekte edildi, koşu yine `PRODUCT_PASS` veya yine
yıksız `TIMEOUT`. O, sınıflandırıcının kör olduğudur.

Gate: D60 **kampanyası** ancak D30 `COMPLETED` (`UNCLASSIFIED=0`) sonra başlar.
Spec bugün kilitlidir; D30 bitmeden enjektör yazmak D30 soak’unu kirletir.

Yöntem D30 ile aynıdır (bölüm 6). D60’ta yeni waiter, yeni jest, sleep şişirme,
fault başına “zeki toparlanma motoru” yok. Fault bir **girdi**; `class` bir
**çıktı**. Bounded recovery D30’daki tavanı aşmaz. Gesture, process death
sonrası otomatik tekrar edilmez (`UNKNOWN_EFFECT` + reconciliation — Mobile
README yasağı).

## 16. D60 kapalı sınıf eki

D30 sözlüğü durur. Aşağıdaki kodlar yalnız `injectedFault != null` koşularda
kullanılır. Spontan D30 soak hatası bu kodlara **taşınmaz** (ör. rastgele USB
kopması `ENV_FAILURE` kalır, `NETWORK_PARTITION` olmaz).

| Kod | Enjekte edilen | Kök koşul (ölçülen) | Ürün hükmü |
|---|---|---|---|
| `PROCESS_DEATH` | process kill (histogram) | pid yok / WAL recovery | `NOT_APPLICABLE` ta ki REQUIRED planes yeniden |
| `NETWORK_PARTITION` | network disconnect | cihaz veya host connectivity kaybı (lab enjektörü kayıtlı) | Remote yok diye `PRODUCT_FAIL` yok |
| `BACKEND_TIMEOUT` | backend timeout | adapter deadline / `UNKNOWN_EFFECT` / EVENTUAL remote onTimeout | `PENDING_REMOTE` / `INCONCLUSIVE` remote; HTTP 2xx PASS değil |
| `DIALOG_INTERRUPT` | dialog / overlay | `wait_any` interrupt key veya beklenen surface | Jest hedefe gitmedi; overlay’i “buton” sanmadı |
| `DUPLICATE_SUPPRESSED` | duplicate callback | aynı seq/idempotency ikinci kez düştü; tek occurrence | Çift `PRODUCT_PASS` yok |
| `OFFLINE_QUEUED` | offline queue | LOCAL persist fact var; remote yok; oracle `PASS_QUEUED_OFFLINE` | Remote yok = `PRODUCT_FAIL` değil |

Oracle terminalleri sınıf **değildir**; eşleme:

| Oracle / executor terminal | D60 sınıfı (enjeksiyon varsa) |
|---|---|
| `UNKNOWN_EFFECT` + kill enjeksiyonu | `PROCESS_DEATH` + `deathProvenance` |
| `UNKNOWN_EFFECT` + backend enjeksiyonu | `BACKEND_TIMEOUT` |
| `PASS_QUEUED_OFFLINE` + offline enjeksiyonu | `OFFLINE_QUEUED` |
| `INTERRUPT_MATCH` + dialog enjeksiyonu | `DIALOG_INTERRUPT` |
| receipt-safe duplicate drop | `DUPLICATE_SUPPRESSED` |

Eşleme tutmazsa hücre `UNCLASSIFIED` veya yanlış sınıftır — D60 fail.

## 17. Senaryo matrisi (kilitli)

Login slice her fault’u taşımaz. Login remote’u OPTIONAL’dır; offline kuyruk
LOCAL delivery düzlemindedir. D60 bu yüzden **iki host** kullanır — ikinci
golden soak değil, fault’un yaşayabileceği tek yer.

| ID | Fault | Host slice | Enjeksiyon (lab) | Beklenen `class` | Bu olmamalı |
|---|---|---|---|---|---|
| BD.1 | Process kill | A — D30 login, jestten sonra / continue gate öncesi | `am force-stop <pkg>` (user). pid + `deathProvenance=PROCESS_DEATH_FORCE_STOP` zorunlu. | `PROCESS_DEATH` | Gesture auto-retry; sessiz `PRODUCT_PASS`; provenance’siz “process death test edildi” |
| BD.2 | Network disconnect | A — PIN submit civarı **veya** B — teslimat submit | Airplane / USB net / kayıtlı lab kesici; enjektör `injectedFault=NETWORK_DISCONNECT` | `NETWORK_PARTITION` | `PRODUCT_FAIL`; `ENV_FAILURE` torbası (enjeksiyon kaydı varken) |
| BD.3 | Backend timeout | B — mutation remote (`tour-approval` `approve-tour-request`). `complete-delivery` remotes `READ_ONLY`; arm olmaz. | **controlled adapter-deadline injection representing BD.3 BACKEND_TIMEOUT** — wire dispatch tutulur, mevcut `AbortController` yolu `UNKNOWN_EFFECT` üretir. “Backend isteği aldı ve timeout oldu” iddiası değildir. | `BACKEND_TIMEOUT` | HTTP 2xx `PRODUCT_PASS`; iş yanlışmış gibi `PRODUCT_FAIL`; injector bilgisinden `NO_EFFECT` remap |
| BD.4 | Dialog / overlay | A — launch `permissionDialog` veya koşu içi overlay | Sistem dialog / pack interrupt surface | `DIALOG_INTERRUPT` | Overlay’e tap; interrupt key varken `UI_NOT_ACTIONABLE`; 30s timeout |
| BD.5 | Duplicate callback | A — login fact **veya** B — delivery fact | Aynı WS event / seq tekrar; veya çift emit | `DUPLICATE_SUPPRESSED` | İki verdict; `TEST_DATA_CONTAMINATION` (bu o değil) |
| BD.6 | Offline queue | B — process-parcel / complete-delivery LOCAL queue | Ağ yok + kuyruk yazımı; `nesy.recovery.queue` okunabilir | `OFFLINE_QUEUED` | Remote yok diye `PRODUCT_FAIL`; kuyruk yokken `PRODUCT_PASS` |

**Host A:** `nesy.macro.login` / `cold-real-login` (D30 slice).  
**Host B:** prepared-session ile kuyruk/remote taşıyan **tek** macro (`process-parcel` veya `complete-delivery`). `producesProductVerdict: false` kalır. B, D30’u genişletmez; D60 fault hedefidir.

Her satır: `injectedFault`, `host`, `expectedClass`, `observedClass`, `rootCondition`, `runId`.

Kampanya büyüklüğü: senaryo başına **en az 5** ardışık beklenen-sınıf koşu (önerilen 10). D30’daki 100’lük soak değil. Toplam ≥30 sınıflı enjeksiyon. `UNCLASSIFIED = 0`. Yanlış hücre = o senaryo `FAILED`.

CP3-DUT / userdebug: BD.1 için `force-stop` user build’de geçerlidir. Eng-only
kill D60’ı bloklemez; yapılamazsa `ENV_FAILURE` — sahte `PROCESS_DEATH` yok.

`am force-stop` ≠ doğal process death (LMK / OEM / crash). Histogram sınıfı
`PROCESS_DEATH` kalır; her satırda `deathProvenance` zorunlu:

```text
PROCESS_DEATH_FORCE_STOP   ← BD.1 user build (bugünkü lab)
PROCESS_DEATH_KILL         ← eng/userdebug kill
PROCESS_DEATH_OEM          ← OEM/LMK (Track B)
```

Yalnız force-stop kanıtı “process death test edildi” iddiası **değildir**.

## 18. D60 invariant, recovery, metrik, regresyon

Start invariant (bölüm 6.1 / [`READINESS.md`](./READINESS.md)) ve Continue Gate / Final Oracle ayrımı durur. Fault
onları iptal etmez; onları **sınar**.

| Fault | Invariant (kırılınca sınıf) | Bounded recovery (tavan 1) | Yasak recovery |
|---|---|---|---|
| BD.1 | Jest sırasında pid kararlı değilse mutation tamamlanmış sayılmaz | Yok. `UNKNOWN_EFFECT`. Restart sonrası start invariant yeniden. | Otomatik ikinci gesture |
| BD.2 | Remote fact yokken Final PASS yok | Politika `PENDING_REMOTE` / queue; tek deadline | Sleep + tekrar tap |
| BD.3 | Controlled adapter-deadline = remote yok, iş fail değil. `UNKNOWN_EFFECT` muhafazakâr kalır. | Tek retry yok (`UNKNOWN_EFFECT` çift onay riski) | HTTP 2xx’i iş sanmak; injector wire’a gitmedi diye `NO_EFFECT` |
| BD.4 | Beklenen interrupt, beklenen hedefi ezmez | Interrupt key ile dur; pack politikası | Overlay merkezine tap |
| BD.5 | Aynı occurrence’a ikinci fact oy vermez | Drop + sayaç | Yeni reducer / yeni event adı |
| BD.6 | LOCAL queue fact varsa remote yokken `OFFLINE_QUEUED` | Yok; kuyruk zaten politika | Remote gelene kadar wait şişirme |

Metrik: D30 satırına ek `injectedFault` (`null` \| `PROCESS_KILL` \|
`NETWORK_DISCONNECT` \| `BACKEND_TIMEOUT` \| `DIALOG_OVERLAY` \|
`DUPLICATE_CALLBACK` \| `OFFLINE_QUEUE`). `observedClass` ayrı alandır
(altı D60 kodu + D30 histogram). D60 özeti bir **karışıklık matrisi**dir
(satır = enjekte, sütun = gözlenen sınıf). Köşegen dışı hücre kapanışı
reddeder. `injectedFault = null` satırlar matrise girmez.

G90.9 kodu 15 Aug 2026’da yazıldı ve aynı gün fresh prod’da
`LIVE_QUALIFIED` oldu (`3770d2a`, Smoke A null + Smoke B metadata).
Formal D60 kampanya penceresi **13 Eylül–12 Ekim 2026** duruyor —
implementation ≠ campaign start.

Regresyon: altı senaryonun her biri için tekrarlanabilir enjektör + beklenen
`class` assert. Enjektör yoksa “bir gün USB çıktı” D60 kanıtı değildir.

## 19. D90 amacı — workflow set + cihaz + soak + pilot-stable

D30 bir slice’ı sınıflar. D60 o sınıflandırıcıyı kırar. D90 **ölçeği** açar:
3–5 iş workflow’u, birden fazla cihaz, soak. Sınıf sözlüğü genişlemez. Yeni
waiter, yeni jest, p95’i düzeltmek için sleep yok.

Bundan sonra `pilot-stable` ancak D90 RESULT alanı olarak kullanılır. Production
GO, yatırımcı “platform hazır”, `%100 PASS` değildir.

Gate: D90 kampanyası D60 `COMPLETED` ister (köşegen, `UNCLASSIFIED=0`). Spec
bugün kilitlidir.

## 20. Kilitli workflow seti ve cihaz varyasyonu

3–5 arası. Aşağıdaki **dört** zorunlu; beşinci isteğe bağlı. Pack’te olmayan
macro D90’a alınmaz.

| # | Macro | Launch / not | D90 rolü |
|---|---|---|---|
| 1 | `nesy.macro.login` | `cold-real-login` | D30 slice; soak’ta kalır |
| 2 | `nesy.macro.select-route` | prepared-session (setup) | iş fragment |
| 3 | `nesy.macro.process-parcel` | prepared-session | kuyruk / scan yüzeyi |
| 4 | `nesy.macro.complete-delivery` | prepared-session | remote + LOCAL |
| 5 | `nesy.macro.tour-approval-lifecycle` | isteğe bağlı | beşinci; D90 başında RESULT’ta “dahil / değil” yazılır |

`nesy.macro.full-courier-day` / golden **ayrı altıncı ürün** değildir. Dört
(veya beş) fragment’in zincir soak’u istenirse aynı plan hash’iyle ayrıca
raporlanır; seti gizlice altıya çıkarmaz.

Her workflow: `injectedFault=null`, sınıflı, `UNCLASSIFIED=0`. Downstream
fragment login’i D30’da kanıtlanmış prepared-session ile kurar — login’i her
satırda yeniden golden’lamak D90 soak’unu D30’a geri çevirir. Login workflow’u
kendi soak satırında hâlâ `cold-real-login` ile koşar.

### Cihaz varyasyonu

| Gerek | Anlam |
|---|---|
| ≥2 `serial` | Farklı fiziksel DUT. Tek telefonda orientation/AOT “varyasyon” sayılmaz. |
| Kayıt | OEM, `ro.build.type`, Android major, AOT `speed` evet/hayır |
| Aynı APK ailesi | `tstrsAutomationRelease` her ikisinde |

Lab bugün tek SM-A346E. İkinci DUT yoksa soak tek cihazda yapılabilir; o zaman
`pilotStable=SINGLE_DUT_SOAK` ve **`pilot-stable` kelimesi kullanılmaz.**

Soak hacmi (uninjected): workflow başına, cihaz başına **en az 20** **evaluable**
koşu (`ENV_FAILURE` hariç). 4 workflow × 2 cihaz × 20 = 160 evaluable alt sınır.
`ENV_FAILURE` M2b’de sayılır; M2a paydasına **girmez** (lab kötüleşince
automation “iyileşmez”).

## 21. Operasyon metrikleri (formül kilitli)

Sayı uydurulmaz. Gözlenen değer D90 RESULT’ta yayınlanır. `pilotStable=YES`
için eşikler **D90 kampanyası başlamadan** §22.1’de freeze edilir
(D30/D60 kanıtından). Uydurma SLO yok; freeze’siz `YES` yok.

`UNCLASSIFIED` D90’ı düşürür; metrik onu gizleyemez.

| ID | Metrik | Tanım | Payda | Not |
|---|---|---|---|---|
| M1 | Execution time p50 / p95 | Admission geçti → Final Oracle (veya sınıflı harness terminal) duvar saati, ms | `injectedFault=null` **evaluable** (`ENV_FAILURE` hariç) | Start invariant ayrı sütun. App-açılışı ≠ SDK hızı. |
| M2a | Automation failure rate | Harness fail / evaluable: pre-action yedili + post-action `AUTH_PENDING` / `BACKEND_BOOTSTRAP_PENDING` + `EVIDENCE_TIMEOUT` + `TEST_DATA_CONTAMINATION` | uninjected, `class ≠ ENV_FAILURE` | `PRODUCT_FAIL` girmez. `ENV_FAILURE` paydaya **girmez**. |
| M2b | Environment interruption rate | `ENV_FAILURE` / tüm uninjected denemeler | tüm uninjected (ENV dahil) | Lab kötüleşince M2a güzelleşmez. |
| M3 | Evidence closure latency p50 / p95 | `GESTURE_COMPLETED` / aksiyon terminali → continue gate SATISFY veya fact admission, ms (`monoTs`) | mutation içeren uninjected adımlar | Gate kapanmadan oracle yoksa satır `EVIDENCE_TIMEOUT`; latency “sonsuz” diye p95’e sokulmaz, sınıfa gider. |
| M4 | Unknown-effect rate | `UNKNOWN_EFFECT` terminal / mutation denemesi | uninjected mutation’lar | D60 enjekte satırlar **ayrı** sütun; soak M4’üne karışmaz. |
| M5 | Recovery success rate | Bounded recovery kullanılan koşularda: start invariant yeniden + sınıflı ürün veya beklenen harness sınıfı | `recoveryUsed=1` uninjected (veya D90 içinde bilinçli tek kill-soak örneği, ayrı n) | Gesture auto-retry başarı sayılmaz. Recovery yoksa M5 `n=0` yazılır, uydurulmaz. |
| M6 | Repeatability | Aynı `planHash` + aynı cihaz sınıfı + aynı girdi: iki ardışık ≥10’luk pencerede sınıf histogramı | pencere çiftleri, workflow başına | Mesafe: total variation ≤ 0.20 **veya** `PRODUCT_PASS` oranı ≤ 10 puan fark. Aşımı M6 fail; “flaky” cümlesi değil. |

Her metrik satırı: `workflowRef`, `deviceSerial`, `n`, değer, formül ID
(M1–M6; M2b M2 family environment companion).

## 22. `pilot-stable` — ne zaman söylenir

RESULT alanı, slayt değil:

```text
pilotStable: YES | NO | SINGLE_DUT_SOAK
```

`YES` yalnız hepsi doğruysa:

1. §1 beş maddesi RESULT’ta kanıtlı
2. D30 `COMPLETED` (`UNCLASSIFIED=0`, start invariant var)
3. D60 `COMPLETED` (köşegen, yanlış hücre 0)
4. D90: 3–5 kilitli workflow soak’u, `UNCLASSIFIED=0`
5. ≥2 DUT serial kayıtlı
6. M1–M6 **ve M2b** yayınlı, n>0 (M5: en az bir gerçek recovery; D60 BD.1 taşınabilir)
7. M6 pencereleri kayıtlı ve eşik içinde
8. §22.1 `pilotAcceptance` **D90 başlamadan freeze**; ölçülen değerler eşiği karşılar

Freeze yoksa veya eşik aşılırsa `NO`. “M1–M6 yayınlandı” tek başına `YES` değildir.
Measured reliability ≠ acceptable reliability.

### 22.1 `pilotAcceptance` freeze (D90 kampanyasından önce)

D60 `COMPLETED` sonrası, D90 soak **öncesi** RESULT’a yazılır. D90 sayıları
görülmeden kilitlenir. Şablon (sayılar D30/D60’tan gerekçeyle doldurulur):

```text
pilotAcceptance:
  frozenAt:            <iso>          # D90 campaign start’tan önce
  automationCompletion: >= ?          # evaluable; ENV paydaya girmez
  unexplainedMissingFact: 0
  falsePass:            0
  recoverySuccess:      >= ?          # M5
  unknownEffect:        <= ?          # M4
  automationFailure:    <= ?          # M2a
  environmentInterruption: <= ?       # M2b; pilot operasyon kapısı
```

`?` D90 başlamadan sayı olmak zorunda. Bu satırlar boşken `pilotStable=YES`
yazılmaz. Endüstri SLO’su uydurulmaz; bu Verdict’in kendi freeze’idir.

Aksi: `NO`. Tek cihaz: `SINGLE_DUT_SOAK`. Bu üç değer dışında `pilot-stable`
yazılmaz.

`pilot-stable` ≠ “artık gerçekten stabil”. O iddia
[`ACCEPTANCE.md`](./ACCEPTANCE.md) `internallyStable=YES` kapısıdır (G1–G7).

Yasak: p95’i düşürmek için timeout şişirme, ikinci jest tipi, sınıf sözlüğüne
`FLAKY` eklemek, `full-courier-golden`’ı ölçmeden “beş workflow” saymak,
Phase 7 fixture yeşilini D90 saymak.
