# Readiness Core — cold start is a state machine

```yaml
specId: verdict-readiness-core
status: SPEC_LOCKED
createdAt: "2026-08-13 15:37:00 +03"
lastUpdatedAt: "2026-08-15 16:15:00 +03"
parentGoal: G90-stabilization
nextStep: G90.10
implementationStep: G90.2b
implementationStatus: READINESS_LIVE_QUALIFIED
implementationPriority: P0
d14Gate: "G90.2b + G90.3 by 2026-08-27"
circularDepFix: "AUTH / BUSINESS_BOOTSTRAP are post-action workflow facts, not pre-action SM"
supersedes: "single wait-login-ready / 4-conjunct bag / COLD_START_TIMEOUT as class / AUTH_READY+BUSINESS_BOOTSTRAP before first BRIDGE_ACTION"
```

Cold start **tek test adımı değildir.** Problem timeout’un kaç saniye olduğu değil;
deadline geldiğinde **pre-action** state machine’de sağlanmamış ilk zorunlu
invariant.

Lab kanıtı (SM-A346E, 12–13 Aug 2026): insan gözüyle PIN, Activity resume,
a11y target resolve, session fact **aynı an değil**. 2.4s vs 3.9s tek “yavaş
cold start” değil. SDK A/B ~74 ms ana neden değil — envelope olarak tutulur
(constant değil).

`COLD_START_OS_SUSPEND`, `UI_VISIBLE ≠ UI_ACTIONABLE`,
`FORCE_STOP_NOT_CONFIRMED` sonradan timeout’tan sökülmez.

**14 Aug kilit:** `AUTH_READY` / `BUSINESS_BOOTSTRAP_READY` pre-action
cold-start’ın **içinde değildir**. Login PIN/submit Bridge action ister;
action `INTERACTION_READY` ister. Session fact action’dan **sonra** gelir.
Aksi circular:

```text
login için Bridge action
  → action için COLD_START_READY
  → COLD_START_READY için AUTH_READY
  → AUTH_READY için login
```

---

## 1. Yasak model

```text
wait-login-ready timeout: 5000ms
COLD_START_TIMEOUT          ← root class olamaz
BRIDGE_TREE_STALE           ← readiness class olamaz
APP_READY ∧ SDK_READY ∧ BRIDGE_READY ∧ SURFACE_READY
AUTH_READY / BUSINESS_BOOTSTRAP_READY before first BRIDGE_ACTION
```

`COLD_START_TIMEOUT` / `INTERACTION_NOT_READY` yalnız **termination reason**.
Root class = deadline’da false kalan ilk zorunlu **pre-action** state.

`STALE_TREE` Bridge **observation** (tap reddi, fence). Readiness sınıfı değil.

```text
A11Y_SYNC_PENDING     ağaç henüz bu window/generation’a geçmedi
UI_NOT_ACTIONABLE     ağaç taze; target enabled/bounds/obscured/overlay değil
```

Timeout yalnız deadline. Sınıflandırma kriteri değil.

---

## 2. İki makine (karışmaz)

### 2.1 Launch / interaction readiness (pre-action)

İlk `BRIDGE_ACTION` ancak `INTERACTION_READY` sonra.

```text
FORCE_STOP_REQUESTED
        ↓
PROCESS_TERMINATED          ← yoksa NOT_EVALUATED / FORCE_STOP_NOT_CONFIRMED
        ↓
LAUNCH_REQUESTED
        ↓
PROCESS_CREATED
        ↓
OS_SCHEDULED
        ↓
APP_LIFECYCLE_READY
        ↓
UI_VISIBLE
        ↓
A11Y_SYNCHRONIZED
        ↓
UI_ACTIONABLE
        ↓
SDK_READY
        ↓
INTERACTION_READY           ← ilk BRIDGE_ACTION ancak burada
```

`AUTH_*` ve `BUSINESS_BOOTSTRAP_*` bu zincirde **yok**.

### 2.2 Post-action business (workflow facts)

```text
BRIDGE_ACTION
  → PIN / SUBMIT
        ↓
LOGIN_REJECTED
  veya
AUTH_SESSION_READY
        ↓
BUSINESS_BOOTSTRAP_READY
        ↓
ROUTE_LIST_READY
```

Bunlar Continue Gate / evidence plane ([`JOIN.md`](./JOIN.md) J2–J4).
Pre-action class **değil**.

```text
INTERACTION_READY     PIN basılabilir; session yok olabilir
Continue Gate         ROUTE_LIST_READY | LOGIN_REJECTED
Final Oracle          REQUIRED düzlemler (login: APP + LOCAL; REMOTE OPTIONAL)
```

`UI_ACTIONABLE ∧ SDK_READY` continue gate’i kapatmaz.

---

## 3. Pre-action failure class (yedili)

| Class | Ne | Primary observable | Policy (bounded, tavan 1) |
|---|---|---|---|
| `FORCE_STOP_NOT_CONFIRMED` | Koşu cold değil | önceki pid/UID hâlâ var | Launch yok. `NOT_EVALUATED`. |
| `PROCESS_NOT_STARTED` | Launch gitti, process yok | `/proc`, pid, cmdline | Launch retry bounded |
| `COLD_START_OS_SUSPEND` | Process var, OS schedule etmiyor | `state=S`, CPU tick 0, TCP accept edebilir | App timeout **uzatma**. |
| `APP_NOT_READY` | Process var, lifecycle değil | Application / Activity | App readiness bekle (deadline içi) |
| `A11Y_SYNC_PENDING` | UI var, a11y yeni state’te değil | `treeGen`, window/a11y events | Event-driven kısa resync; dump yok |
| `UI_NOT_ACTIONABLE` | Görünür, action değil | visible+enabled+bounds+!obscured+!blocker | Actionability bekle |
| `SDK_NOT_READY` | Control/evidence kanalı yok | capabilities, handshake, WAL, `runId` | SDK bounded recovery |

`OS_SUSPEND`’i `APP_NOT_READY` yazmak yasak.

ACCEPTANCE / D30 histogram pre-action fail’leri bu **yediliye** yazar
(**kilit A**). Eski aggregate isimler `class` değildir.

Deadline örneği: her şey ✓, `UI_ACTIONABLE` ✗ → `UI_NOT_ACTIONABLE`,
termination `INTERACTION_NOT_READY`. Asla `COLD_START_TIMEOUT`.
Asla `AUTH_PENDING` (henüz action yok).

### 3.1 Post-action histogram (SM dışı)

Jest sonrası, session/bootstrap beklenirken:

| Class | Ne | Ne değildir |
|---|---|---|
| `AUTH_PENDING` | Submit sonrası session fact yok / reddedilmedi | Pre-action readiness |
| `BACKEND_BOOTSTRAP_PENDING` | Session var, iş verisi (rota/config) yok | Pre-action readiness |
| `EVIDENCE_TIMEOUT` | Continue Gate fact lane kapanmadı | Readiness |

`AUTH_PENDING` login’den **önce** yazılmaz.

Canonical precedence (ilk eşleşen kazanır):

```text
App hâlâ authentication state'inde
ve producer-side terminal observation yok
→ AUTH_PENDING

AUTH_SESSION_READY var
ama required business bootstrap tamamlanmamış
→ BACKEND_BOOTSTRAP_PENDING

Producer-side terminal/business observation var
ama canonical → WAL → transport → normalize → gate zinciri kapanmıyor
→ EVIDENCE_TIMEOUT

Yukarıdaki ayrımı kuracak provenance yok
→ UNCLASSIFIED
```

Fact'in host görünümünde olmaması tek başına `AUTH_PENDING` kanıtı değildir;
producer'da oluşup transport veya normalization aşamasında kaybolmuş olabilir.

---

## 4. Precondition: force-stop gerçekten cold mu?

```text
am force-stop <pkg>
  → wait: previous pid absent, package process absent, UID state expected
  → record termination evidence
  → launch
```

Doğrulanamazsa: `NOT_EVALUATED` / `FORCE_STOP_NOT_CONFIRMED`.
Warm’ı cold dataset’ine sokmak p95’i kirletir. G1 completion paydasına girmez.

`force-stop` ≠ doğal process death. D60 provenance:
[`RUN_PLAY.md`](./RUN_PLAY.md) §16.

---

## 5. Actionability contract — `UI_ACTIONABLE`

`wait login screen` değil: `wait UI_ACTIONABLE(target=PIN)`.

```text
correct window
+ fresh treeGen
+ unique target
+ visible
+ enabled
+ valid measured bounds
+ not obscured
+ no higher-priority blocking surface
```

`UI_VISIBLE` alt küme. PIN’i görmek `UI_ACTIONABLE` değildir.

---

## 6. Koşu çıktısı (ürün)

```text
INTERACTION_NOT_READY
Boundary: UI_ACTIONABLE
Elapsed: 3.912s
Completed:
  ✓ PROCESS_TERMINATED     121ms
  ✓ PROCESS_CREATED        483ms
  ✓ APP_LIFECYCLE_READY    1.24s
  ✓ UI_VISIBLE             1.31s
  ✓ A11Y_SYNCHRONIZED      2.18s
  ✓ SDK_READY              1.37s
Pending:
  ✗ UI_ACTIONABLE
Supporting evidence:
  - PIN target visible (not enabled)
  - SDK healthy
  - treeGen=18
  - no session fact expected yet
```

`wait-login-ready timeout: 5000ms` ürün değildir.
`Boundary: AUTH_READY` pre-action çıktıda **yasak**.

---

## 7. Component latency envelope

Her build × device family × APK profili — **pre-action**:

| Component | Metrik |
|---|---|
| Kill confirmation | p50 / p95 / p99 |
| Process spawn | |
| OS scheduling | tick 0 → `COLD_START_OS_SUSPEND`, p95’e gömülmez |
| App lifecycle | |
| UI visibility | |
| A11y sync | |
| Actionability | |
| SDK readiness | 74 ms A/B baseline; constant değil |

Post-action (workflow, SM p95’ine gömülmez): auth session, business bootstrap.

Tek sayı yasak. `Cold start yavaşladı` yasak cümle.

---

## 8. Katmanlar

```text
Admission              cihazı sürebilir miyiz?
Force-stop confirm     PROCESS_TERMINATED
Interaction SM         INTERACTION_READY   (bu dosya, pre-action)
BRIDGE_ACTION          PIN / submit
Post-action facts      AUTH_SESSION_READY | LOGIN_REJECTED
                       BUSINESS_BOOTSTRAP_READY
Continue Gate          ROUTE_LIST_READY | LOGIN_REJECTED
Final Oracle           REQUIRED planes → PASS / FAIL
```

Yeni waiter / sleep / jest tipi yok. Yeni pre-action observable → yedili.
Sığmazsa `UNCLASSIFIED` — D30 fail.

---

## 9. G90.2b — kod (bu split kilitlendikten sonra)

14 Aug 17:04: circular-dep split **kilitli**. Eski 9-state SM
(`AUTH_READY` → `BUSINESS_BOOTSTRAP` → ilk action) **kodlanmaz**.

G90.2b bu dosyadaki **yedili + INTERACTION_READY**’i uygular.

1. Force-stop confirmation → `NOT_EVALUATED` / `FORCE_STOP_NOT_CONFIRMED`
2. 20s `get_state` / `wait-login-ready` tek fact kalkar; SM + deadline
3. `UI_ACTIONABLE(PIN)` + `SDK_READY` = `INTERACTION_READY`; continue gate ayrı
4. `AUTH_PENDING` / `BACKEND_BOOTSTRAP_PENDING` yalnız jest **sonrası**
5. `STALE_TREE` observation; `A11Y_SYNC_PENDING` ≠ `UI_NOT_ACTIONABLE`
6. Her koşuya madde 6 izi + component `monoTs`
7. SDK_READY p50/p95/p99 cihaz/profil/build
8. Her pre-action sınıf bağımsız üretilebilir; hata kodu o class, `TIMEOUT` değil

Kampanya SM’siz başlamaz. Warm-in-cold yok. Timeout G90.3’te uzatılmadı.
Live qualification: `INTERACTION_READY` 100/100 (2026-08-15).
Readiness Journey (Cockpit) madde 6 izinden; 2b’yi bloklamaz.
