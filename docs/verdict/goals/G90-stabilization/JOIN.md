# JOIN — occurrence altında birleşme (bugünkü asıl risk)

```yaml
specId: verdict-join-closure
status: LOCKED
createdAt: "2026-08-13 15:45:00 +03"
lastUpdatedAt: "2026-08-14 18:27:00 +03"
parentGoal: G90-stabilization
nextStep: G90.3
g90_3: "parent = 3a + 3b; after G90.2b"
baselineRun: run_c5b41c62-0b3b-4e1a-a7ac-f5b7e7f09c14
relatedReadiness: "docs/verdict/goals/G90-stabilization/READINESS.md"
namingNote: "J0–J5 independent evidence boundaries ≠ ACCEPTANCE.md G1–G7; not a cumulative ladder"
```

Ana risk artık “bu teknoloji yapılabilir mi?” değil.

```text
Bağımsız çalışan alt sistemleri güvenilir bir E2E contract
altında birleştirebilir miyiz?
```

Bu, mimari icat aşaması değil. **Join gap** aşaması.

---

## 1. Ölçü: component değil, invariant boundary

`0/10 joined` eski mental model. Asıl soru “hangi invariant kapandı?”

```text
Readiness Boundary
Evidence Boundary
Oracle Boundary
Recovery Boundary
Reliability Boundary
```

`0/10` hâlâ şöyle okunur (ürün %0 değil):

> **0/10 full golden-qualified; 9/10 subsystems implemented or lab-observed.**

13 Ağustos 2026 skoru:

| Küme | n | Anlam |
|---|---|---|
| Lab’de gerçekten çalışıyor | 3 | Bridge / UI / transport temel lab |
| Kod veya fixture var, golden join kapanmamış | 6 | Oracle, local DB, remote, reset, AOT, occurrence |
| Live hiç koşmamış | 1 | process-kill / recovery |

Tek başına `0/10` göstermek tehlikelidir. Join henüz kapanmadı; omurga yok değil.

### 1.1 Mühendislik olgunluğu (13 Aug 2026 okuması)

```text
Architecture / contracts       █████████░  çok ileri
Bridge execution               █████████░  olgun
SDK / transport                ████████░░  olgun
Workflow / compiler            ████████░░  olgun
Oracle engine                  ████████░░  kodda güçlü
Fixtures / reset               █████░░░░░  eksik join
Real DUT qualification         ████░░░░░░  erken
Golden E2E integration         ██░░░░░░░░  henüz kapanmadı
```

---

## 2. Evidence boundaries (J0–J5) — ladder değil

G0→G7 cumulative ladder **değil**. Remote OPTIONAL iken `J5 ✅` ve `J4 N/A`
aynı anda olabilir. Oracle, o workflow’da **REQUIRED** işaretli düzlemleri
ister; numarayı değil.

| ID | Boundary | Ne | 14 Aug |
|---|---|---|---|
| **J0** | Transport | Bridge + SDK + host | ✅ lab |
| **J1** | Interaction | Canonical `INTERACTION_READY` ([`READINESS.md`](./READINESS.md)) | 🟡 code-wired; live DUT qualification G90.3'te |
| **J2** | App fact | `ROUTE_LIST_READY` / `LOGIN_REJECTED` | 🟡 live observed değil |
| **J3** | Local | Room / `nesy.db.session` | — exercised değil |
| **J4** | Remote | Backend fact | N/A login (OPTIONAL) |
| **J5** | Oracle | REQUIRED planes → PASS / FAIL; INCONCLUSIVE değil | — |

`ACCEPTANCE.md` G1–G7 `internallyStable` kapılarıdır. Karıştırılmaz.
Recovery / full courier D60 / D90; J-ladder’a eklenmez.

### 2.1 Login REQUIRED / OPTIONAL

```text
APP     REQUIRED
LOCAL   REQUIRED
REMOTE  OPTIONAL   → J4 = N/A
```

J5 PASS / FAIL:

```text
all evidence planes marked REQUIRED for this workflow
```

Login kapanışı: `J2 ✅  J3 ✅  J4 N/A  J5 ✅`.
`J5 ✅` + `J3 —` **imkânsız** (LOCAL REQUIRED).

```text
J0 ✅
J1 🟡  canonical code-wired / live DUT qualification pending
J2 🟡
J3 —
J4 N/A
J5 —
```

`wait-login-ready` historical evidence. Canonical J1 qualification değil.

---

## 3. Login artık UI automation problemi değil

Baseline: `run_c5b41c62` · `product_verdict=INCONCLUSIVE` · `AUTOMATION_FAILURE` · `ABORTED`

```text
wait-login-ready      ✅
tap-submit            başladı
Continue Gate         ❌  still waiting for facts
Final Oracle          çalışmadı
ProductVerdict        INCONCLUSIVE
Evaluation            AUTOMATION_FAILURE
Run                   ABORTED
```

Sistem “login olmadı” demiyor. Şunu diyor:

> Fiziksel execution belirli noktaya kadar ilerledi ama gerekli business
> fact gelmediği için hüküm veremiyorum.

Bu, Verdict’in **olması gereken** davranıştır. Yanlış PASS mimari problem
olurdu; INCONCLUSIVE düzeltilebilir join problemidir.

Kırık yer Accessibility **değil** (legacy `wait-login-ready` geçti; J1
canonical hâlâ 🟡). Kırık zincir:

```text
Mobile/App
  → business event
  → SDK WAL
  → transport
  → host ingestion
  → normalization
  → occurrence correlation
  → Continue Gate
```

Bir yerde `ROUTE_LIST_READY` veya `LOGIN_REJECTED` kayboluyor, normalize
olmuyor, yanlış occurrence’a bağlanıyor veya gate’in `factKey`’i ile
uyuşmuyor.

**Timeout uzatılmaz.** Motor `still waiting for facts` diyorsa soru
“daha uzun bekleseydi gelir miydi?” değil. Soru: **fact lifecycle’ın
hangi aşamasında kayboldu?**

---

## 4. G90.3 — Fact journey (G90.2b sonrası; aynı 10–14 gün)

`ROUTE_LIST_READY` (ve yoksa `LOGIN_REJECTED`) için **tek trace**. Aşama
atlanmaz. Timeout ile oynanmaz.

| # | Aşama | Soru |
|---|---|---|
| 1 | App state | Route list state’e gerçekten geçti mi? |
| 2 | Raw observation | Observation oluştu mu? |
| 3 | Canonical | SDK canonical event üretti mi? |
| 4 | WAL | Append oldu mu? |
| 5 | seq | Atandı mı? |
| 6 | WS | Host’a gitti mi? |
| 7 | Host commit | Durable commit var mı? |
| 8 | ACK | Döndü mü? |
| 9 | Receipt bus | `DurableReceiptBus` gördü mü? |
| 10 | Normalize | Business fact üretildi mi? |
| 11 | Occurrence | `occurrenceId` doğru mu? |
| 12 | Gate key | Gate **aynı** `factKey`’i mi bekliyor? |

İlk kırmızı kutu = asıl bug. Sonraki kutular spekülasyon.

### 4.1 Fact Journey (ürün notu)

Aynı 12 basamak ileride Evidence Journey’nin operasyonel hali olabilir:

```text
ROUTE_LIST_READY
App observation        ✅
Canonical evidence     ✅
WAL append             ✅ seq=…
WS sent                ✅
Host committed         ✅
Receipt bus            ✅
Normalized             ❌   ← bugün burada durulabilir
Occurrence correlated  —
Continue Gate          WAITING
```

G90.3’te önce **tek fact için elle/trace**. UI ürünü G90.3’ü bloklamaz;
join kapanınca ayrı capability olarak speclenir.

Readiness çıktı formatı (deadline + ilk unmet + completed/pending) ileride
Cockpit **Readiness Journey**. G90.2b izi üretir; görsel G90.2b’yi bloklamaz.

### 4.2 Phase 10 ≠ G90.3

Phase 10 üç halkayı **kurdu** (`CODE_WIRED`). G90.3 `OPEN` çünkü login
occurrence’da `ROUTE_LIST_READY` / `LOGIN_REJECTED` **live observed değil**.

```text
implemented  ≠  live observed  ≠  golden accepted
```

---

## 5. Kritik path (öncelik kilidi)

14 Aug 2026 kilidi. Bunun önüne yeni Cockpit feature, AI, ikinci workflow,
process-kill, userdebug lab **konmaz**.

```text
G90.2b  Readiness SM implementation
          ↓
G90.3   ROUTE_LIST_READY / LOGIN_REJECTED fact journey
          ↓
G90.4   Isolation / contamination
          ↓
        3–5 clean manual golden
          ↓
        20 classified
          ↓
        taxonomy sanity
          ↓
        100 consecutive D30
```

İlk **10–14 gün** (≤ 2026-08-27): G90.2b **ve** G90.3 kapanır. Eylül başına
login fact pipeline hâlâ açıksa D30 100-run sıkışır.

Legacy `wait-login-ready` geçti: J2 düşüşü a11y **değil**. J1 canonical SM
G90.2b'de code-wired; live DUT qualification olmadan hâlâ 🟡. Kampanya SM'siz
başlamaz. READINESS split 14 Aug 17:04'te kilitlendi, implementasyon 18:27'de
code-complete oldu.

### 5.1 Bunun önüne konmaz

- Timeout şişirme
- Process-kill / M7–M8 live
- İlk PASS’te 100 koşu
- Userdebug ile Track A login J5’i bekletmek
- `select-route` / ikinci workflow’u D30’a almak

### 5.2 G90.3 = 3a + 3b

```text
G90.3     Parent — Login evidence closure
G90.3a    Continue Gate fact journey
G90.3b    Final Oracle: 1× positive PRODUCT_PASS +
          1× controlled wrong-PIN PRODUCT_PASS carrying LOGIN_REJECTED fact
G90.3 = COMPLETED  iff  3a COMPLETED ∧ 3b COMPLETED
```

`G90.3 DONE` + `G90.3b NOT_STARTED` **imkânsız**.

3b login’de J2 + J3 REQUIRED (local `nesy.db.session` 3b içindedir, “sonra”
değil). J4 N/A. `LOGIN_REJECTED` business fact'tir; kontrollü wrong-PIN
beklentisi karşılandığında test correctness sonucu `PRODUCT_PASS` olur. Yalnız
negatif path ile 3b kapanmaz.

`automationRelease` golden 3 sonrası P1. Remote authoritative login P2
(OPTIONAL; `HTTP 2xx ≠ business success`).

Local için doğru cümle: **“Local DB çalışmıyor” değil** — henüz exercised
değil; 3b positive PASS onu ister.

---

## 6. İki DUT izi (birbirine bağlanmaz)

| İz | Cihaz | Ne kapanır |
|---|---|---|
| **Track A** | Mevcut `user` SM-A346E | Login J0–J5 (J4 N/A) |
| **Track B** | userdebug / eng DUT | Process-kill provenance, mutation, reboot (D60) |

“Cihazımız var” ≠ “acceptance DUT var”. SM-A346E ile Bridge, UI tree,
gesture, transport, basic lab ölçülür. Playbook `userdebug` istiyorsa o
**Track B blocker**’dır; Track A login J5’i bekletmez.

---

## 7. Reset / fixture = determinism

Prepared session Room schedule restore **etmiyor**. Bu, ileride flakiness
üretir: plan deterministik olsa bile initial state değilse sonuç değildir.

```text
Deterministic Run
  = Deterministic Plan
  + Known Device State
  + Known App State
  + Known Test Data
  + Known Backend State
  + Bounded External Variance
```

Reset setup convenience değil. J5 kapanınca P1 olarak güçlenir (G90.4).
G90.3’ün önüne alınmaz.

---

## 8. 100 koşu kapısı

D30 acceptance hâlâ 100 sınıflı koşudur. **Açılış sırası:**

```text
ilk canlı PASS
  → 3–5 ardışık PASS
  → 20 sınıflı (taxonomy anlamlı mı?)
  → 100
```

İlk PASS’te 100 açılmaz.

---

## 9. Takvim tahmini (garanti değil)

13 Ağustos 2026 telemetry varsayımı. Binding G90 penceresi değil.

| Çıktı | Tahmini bant |
|---|---|
| Login J5 (1× positive PASS + 1× expected-rejection PASS) | birkaç gün – 2 hafta (fact bug’ının doğasına bağlı) |
| Login + reset + automationRelease repeatable | 2–4 hafta |
| 3–5 real business flow | 4–8 hafta |
| Process kill / offline / recovery pilot-grade | 6–12 hafta |
| Full courier golden + birkaç DUT | 2–4 ay |
| Enterprise-grade V1 | 6–12 ay |

Nokta: “sistem neden çalışmıyor bilmiyoruz” değil. **Hangi join’in
kapanmadığını biliyoruz.**

---

## 10. INCONCLUSIVE ürün tezidir

Basit otomasyon: tap worked + screen changed → PASS.

Verdict: required fact missing → no business verdict → INCONCLUSIVE.

Problem “neden PASS vermedi?” değil. Problem: **required fact pipeline
neden kapanmadı?** Bu integration. Yanlış PASS mimari olurdu.

---

## 11. G90.3 kapanış

`G90.3 COMPLETED` = 3a ∧ 3b. RESULT’a:

**3a**

1. 12 basamaklı `ROUTE_LIST_READY` **ve** `LOGIN_REJECTED` trace (ilk kırmızı)
2. Timeout değiştirilmediği
3. Continue Gate her iki path’te de kapanmış

**3b**

4. **1×** `PRODUCT_PASS` (session + Room + route list — LOCAL REQUIRED)
5. **1×** kontrollü negatif: wrong-PIN beklentisi karşılanmış `PRODUCT_PASS` +
   `LOGIN_REJECTED` fact
6. INCONCLUSIVE / ABORTED ile kapanış **yok**
7. Boundaries: `J2 ✅  J3 ✅  J4 N/A  J5 ✅`

Yalnız FAIL / REJECTED ile parent kapanmaz. G90.2b önce; kampanya ikisi olmadan yok.
