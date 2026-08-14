# Verdict internal acceptance — “artık gerçekten stabil”

```yaml
gateId: verdict-internal-stable
status: SPEC_LOCKED
createdAt: "2026-08-13 15:34:00 +03"
lastUpdatedAt: "2026-08-14 17:04:00 +03"
parentGoal: G90-stabilization
resultField: internallyStable
values: "YES | NO | PILOT_ONLY"
industryStandard: false
classVocabulary: canonical
classSsot: "docs/verdict/goals/G90-stabilization/READINESS.md"
legacyAggregates: forbidden
```

Bu kapılar **endüstri standardı değildir**. Verdict için kilitlenmiş internal
acceptance’tır. `pilot-stable` (RUN_PLAY §22) daha erken, daha dar bir iddiadır.
“Artık gerçekten stabil” yalnız bu dosyanın yedisi de kanıtlanınca söylenir.

```text
internallyStable: YES | NO | PILOT_ONLY
```

`PILOT_ONLY` = D90 `pilotStable=YES`, bu kapılardan biri açık. O zaman
`stabil` / `production-stable` / “artık gerçekten stabil” yazılmaz.

D30 disiplini durur: tek slice’ta `UNCLASSIFIED=0` ve “94 sınıflı / 6 nedeni
bilinen” hâlâ D30 başarısıdır. Bu dosya o disiplini **geçersiz kılmaz**; daha
büyük golden corpus + cihaz + soak için sayısal kapı ekler.

G1–G7, kâğıt `tap → assert` zincirinin sahada bozulmayacağını varsaymaz.
Boundary’ler ([`RUN_PLAY.md` §1.1](./RUN_PLAY.md)) durur; kapı, onları
sınıflayıp invariant’a bağladığımızı ölçer. %97 completion “ilk tasarım
doğruydu” demez.

Bu G1–G7, JOIN **J0–J5** evidence boundaries ile aynı merdiven değildir.
ACCEPTANCE G2 = failure attribution; JOIN J2 = app fact. Karıştırılmaz.

**Sınıf kilidi (A):** canonical only. Pre-action yedili
([`READINESS.md`](./READINESS.md)) + post-action `AUTH_PENDING` /
`BACKEND_BOOTSTRAP_PENDING` + [`RUN_PLAY.md`](./RUN_PLAY.md) §5.
Eski aggregate isimler `class` değildir; basılırsa `UNCLASSIFIED`.

---

## G1 — Golden flow automation completion

**Kapı:** 100–200 ardışık golden koşuda automation completion **≥ %97**.
**Hedef bant:** %97–%98. Kapanış tabanı **%97.0** (`n ≥ 100`). `%98.0` ve
`n ≥ 200` stretch’tir, zorunlu değildir.

**Automation completion ≠ `PRODUCT_PASS`.**

Tamamlanmış sayılır: plan sınıflı bir **nihai** terminale ulaştı —

- `PRODUCT_PASS`
- `PRODUCT_FAIL` (oracle işi yargıladı)
- `OFFLINE_QUEUED` (politika; remote yok diye fail değil)
- beklenen `DIALOG_INTERRUPT` (pack interrupt, plan durdu)

Tamamlanmamış (orana aleyhine) — canonical `class` yalnızca:

| `class` | Kaynak |
|---|---|
| `FORCE_STOP_NOT_CONFIRMED` | READINESS |
| `PROCESS_NOT_STARTED` | READINESS |
| `COLD_START_OS_SUSPEND` | READINESS |
| `APP_NOT_READY` | READINESS |
| `A11Y_SYNC_PENDING` | READINESS |
| `UI_NOT_ACTIONABLE` | READINESS |
| `SDK_NOT_READY` | READINESS pre-action |
| `AUTH_PENDING` | post-action (SM dışı) |
| `BACKEND_BOOTSTRAP_PENDING` | post-action (SM dışı) |
| `EVIDENCE_TIMEOUT` | workflow fact lane |
| `TEST_DATA_CONTAMINATION` | isolation |
| `UNCLASSIFIED` | yıksız |
| yıksız `ABORTED` / `TIMEOUT` | yıksız |

`COLD_START_OS_SUSPEND` `APP_NOT_READY` değildir.

`ENV_FAILURE` paydaya **girmez** ve ardışıklığı **kırar** (pencere o koşudan
sonra yeniden başlar). Lab USB’yi %97’ye gömmek yasaktır.

Corpus: `injectedFault=null`, kilitli golden set (D90 §20, en az login +
select-route + process-parcel + complete-delivery). Ardışık = aynı kampanya
zinciri, araya debug/reinstall yok.

**Dağılım (aggregate maskelemesin):**

```text
n >= 20 evaluable per locked workflow
aggregate completion >= 97%
no workflow completion below 90%
```

95 login + 5 diğer ile %97 **yetmez**. Delivery bozukken login maskelemez.

## G2 — Failure attribution

**Kapı:** başarısız koşuların **>%95**’inde neden otomatik sınıflı
(`class ≠ UNCLASSIFIED`).

Başarısız = G1’de tamamlanmamış. `PRODUCT_FAIL` buraya girmez (otomasyon
bitmiş, ürün hükmü olumsuz).

D30 tek-slice `UNCLASSIFIED=0` daha sıkı kalır. G2, 100–200’lük çok-flow
corpus’ta tabandır. Stretch hâlâ `UNCLASSIFIED=0`.

## G3 — Evidence: unexplained missing fact

**Kapı:** açıklanamayan eksik fact **acceptance penceresinde 0**.

Eksik fact açıklanmış sayılır ancak şunların hepsi varsa: `factKey`, producer
(UI / APP / LOCAL / REMOTE), neden (`not_emitted` / `stale` / `deadline` /
`optional_skipped`). Yıksız `EVIDENCE_TIMEOUT` veya “still waiting for facts”
açıklanmamış sayılır — G3 fail.

“Neredeyse yok” = bu pencerede 0; yeni bir missing-fact sınıfı uydurarak 0’a
çekmek yasak.

## G4 — Recovery → beklenen business state

**Kapı:** şu senaryolarda sınıflı **ve** beklenen iş durumuna kontrollü dönüş.
Sınıf doğru, iş durumu yanlışsa kapı fail (D60 köşegeni yetmez).

| Senaryo | Beklenen iş durumu (özet) | Yasak |
|---|---|---|
| Process kill | Yeni pid; eski occurrence sızmaz; mutation `UNKNOWN_EFFECT` ise PRODUCT_PASS yok; start invariant yeniden | Gesture auto-retry; stale session PASS |
| Offline | LOCAL kuyruk fact; oracle `OFFLINE_QUEUED` / `PASS_QUEUED_OFFLINE` | Remote yok diye `PRODUCT_FAIL`; kuyruksuz PASS |
| Reconnect | Partition sonrası tek bounded dönüş: resume **veya** sınıflı yeniden start invariant; çift teslimat yok | Sleep + ikinci tap; sessiz çift onay |
| Backend timeout | Adapter `UNKNOWN_EFFECT` / `PENDING_REMOTE`; HTTP 2xx ≠ iş | `PRODUCT_FAIL` (iş yanlışmış gibi); 2xx PASS |

Reconnect D60 `NETWORK_PARTITION`’ın dönüş bacağıdır. STABLE’da ayrıca
koşulur; D60 kampanyasını genişletmez.

Her senaryo: ≥5 eşleşen koşu, `UNCLASSIFIED=0`, beklenen state assertion
(SDK query / Room / isolation fact).

## G5 — False PASS

**Kapı:** kilitli defect dataset’te false PASS **0**.

False PASS = kontrollü kusur varken Final Oracle `PRODUCT_PASS`.

Dataset bu RESULT’a pinlenir (plan hash + kusur + beklenen `PRODUCT_FAIL`
veya `LOGIN_REJECTED`). Boş dataset G5’i geçirmez.

**Minimum category coverage** (her satırda ≥2 kontrollü kusur; n=1 yetmez):

```text
UI
APP
LOCAL
REMOTE          ← login’de OPTIONAL; coverage başka REQUIRED-remote workflow’dan
CORRELATION
RECOVERY
DUPLICATE / REPLAY
```

Sonra false PASS = 0. Tek defect ile kapı kapanmaz. Set büyüdükçe kapı
yeniden ölçülür; geçmiş 0 silinmez.

## G6 — Device families

**Kapı:** **en az 3 gerçek device family.**

Family ≠ üç aynı Samsung A serisi serial. Family = kayıtlı OEM + soC/sınıf
(ör. Samsung Exynos A34, ikinci OEM, üçüncü form-factor veya Android major
farkı). Aynı family’den iki serial G6’yı doldurmaz.

Bugünkü lab (SM-A346E) = **1 family**. `pilotStable` 2 serial isteyebilir;
`internallyStable` 3 family ister.

## G7 — Overnight soak, contamination yok

**Kapı:** **≥ 8 saat** (overnight) golden kampanya. Birkaç saat yetmez.

Pencere boyunca:

- `TEST_DATA_CONTAMINATION = 0`
- `SESSION_ISOLATION_ASSERTED` kırılmaz
- occurrence / runId / Room session bir koşudan ötekine sızmaz
- G1 tamamlanmamışları G2’de sınıflı

---

## `internallyStable=YES` (hepsi)

1. `pilotStable=YES` (2 DUT yetmez; G6 ayrıca 3 family)
2. G1 ≥ %97, `n ∈ [100, 200]` ardışık
3. G2 > %95 attribution
4. G3 unexplained missing fact = 0
5. G4 dört recovery senaryosu, beklenen business state
6. G5 defect set pinli, false PASS = 0
7. G6 ≥ 3 device family
8. G7 ≥ 8h soak, contamination 0

Eksik kapı = `NO`. Pilot var, G6/G7 yok = `PILOT_ONLY`.

Yasak: G1’i `PRODUCT_PASS` oranı diye satmak; ENV’i paydaye gömmek; 3 serial
aynı family’yi 3 family saymak; 3 saatlik soak’u overnight saymak; defect
setsiz “false PASS yok” demek; `pilot-stable` ile “gerçekten stabil”i eşitlemek.
