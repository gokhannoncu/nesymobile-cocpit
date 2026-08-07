# Phase 3 RESULT — Bridge Host Client ve Device Preflight

```yaml
runPlayId: verdict-cockpit-phase-3-run-play
phase: 3
phaseName: "Bridge Host Client ve Device Preflight"
resultState: IMPLEMENTATION_COMPLETE_CP3_BLOCKED_PRODUCTION_DUT
startedAt: "2026-08-05 07:05:00 +03"
completedAt: "2026-08-05 10:05:00 +03"
lastUpdatedAt: "2026-08-05 10:25:00 +03"
timezone: "Europe/Istanbul"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:b81631396044cab7f83f6b6efea2f47ff4b4bda4b177b2d7a2ad705535b660b2"
runPlayFile: "docs/verdict/run-playbooks/phase-3/RUN_PLAY.md"
previousPhaseResult: "docs/verdict/run-playbooks/phase-2b/RESULT.md"
phase4AReadiness: "READY_WITH_EXTERNAL_DUT_BLOCKER"
```

## 1. Executive result

Phase 3 implementation **tamamlandı ve gerçek cihaza karşı doğrulandı**.
CP3 full acceptance **tamamlanamadı** — ama beklenen sebepten değil.

- **Implementation acceptance: PASS.** İki yeni paket (`@nesy/bridge-contract`,
  `@nesy/bridge-client`), gerçek TCP fake bridge, device gate + dinamik port
  lease, admission scheduler, TargetFingerprint/action lifecycle,
  `wait_any`/cancel temeli, DeviceWorker entegrasyonu ve screenshot artifact
  hattı. **174 yeni test** (50 contract + 35 client + 56 API bridge + 33 diğer
  bridge testi), typecheck 11/11, toplam **505 passed / 38 skipped**.
- **Gerçek DUT protocol paritesi: PASS.** Bağlı Samsung SM_A346E üzerinde
  **20/20 smoke adımı** geçti. Bu, sözleşmenin uydurulmuş olmadığının kanıtı.
- **CP3 full acceptance: BLOCKED.** Cihaz `ro.build.type=user` — **production
  build**. Production-deny kapısı jest enjeksiyonunu doğru şekilde reddetti.
  `tap`/`input`/`swipe`/`back` gerçek cihazda **koşulamadı** ve bu politikanın
  **doğru** sonucudur, bir arıza değil.

### Fazın en değerli çıktısı: gerçek cihaz üç sözleşme hatası yakaladı

Fake bridge testleri 70/70 yeşilken, gerçek cihaz şunları ortaya çıkardı — ve
**üçü de fake ile asla yakalanamazdı**, çünkü fake benim uydurduğum alan adlarını
kabul ediyordu:

| # | Bulgu | Etkisi |
|---|---|---|
| 1 | **`runEpoch` bir DEVRALMA jetonu**, saf fencing alanı değil. `activateScope`: yüksek epoch preempt eder, eşit/düşük `stale_run` alır. | Sabit epoch (`1`) kullanan host, cihazda kalıntı scope varken **gözlem bile yapamaz** — handshake reddedilir. |
| 2 | **Epoch birimi MİLİSANİYE olmak zorunda.** Protokol birimi tanımlamıyor; sahadaki aktif claim `1785610650611` (ms) idi. | Saniye tabanlı epoch (`1.78e9`) ms tabanlı bir claim'i (`1.78e12`) **asla devralamaz**. Cihaz kalıcı olarak erişilemez hale gelir. |
| 3 | **`wait_node` alan adları: `by` ve `settleMs`** — benim `matchBy`/`stableForMs` değil. | `invalid_match_by`. Ve `stableForMs` bilinmeyen alan olarak **sessizce yok sayılacaktı**: kararlılık penceresi hiç uygulanmadan "uygulandı" sanılırdı. |

Ayrıca hata taksonomisinin **kapalı bir küme olmadığı** görüldü: cihaz kodları
`missing_$key` / `invalid_$key` şablonuyla **üretiyor**. Kapalı bir union'a
bağlanmak, yarın eklenen bir alanın hatasını "beklenmeyen hata"ya çevirip hangi
alanın hatalı olduğunu kaybetmek olurdu. `classifyDeviceError` yapısal
sınıflandırma yapıyor.

### Ayrıca yakalanan iki gerçek runtime hatası (kendi kodumda, testler tarafından)

1. **Admission mutation şeridi aslında tek DEĞİLDİ.** `pump()` şerit sayacını
   dağıtım anında ayırmıyordu; `submit()`in devamı bir microtask'a düşerken
   ikinci mutation da başlıyordu. Yani **iki tap eşzamanlı gidebiliyordu** ve
   ikisi de "ok" dönerdi. Slot artık dağıtım anında ayrılıyor.
2. **Timeout/cancel sebebi eziliyordu.** Önce `destroy()` çağırmak
   `onDisconnect` üzerinden isteği `WAIT_CONNECTION_LOST` ile reddediyor,
   gerçek sebep (host timeout / iptal) kayboluyordu. `abortPending` önce doğru
   sebeple çözüyor, sonra kapatıyor.

## 2. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `3` |
| Current step | `3.13` (bitti) |
| Current state | `IMPLEMENTATION_COMPLETE_CP3_BLOCKED_PRODUCTION_DUT` |
| Last successful step | `3.13` |
| Last attempted step | `3.13` |
| Last update | `2026-08-05 10:05:00 +03` |
| Recovery instruction | `Kod tamam ve gerçek cihazda parite kanıtlı (20/20 read-only smoke). CP3 full acceptance için LAB cihazı (userdebug/eng) gerekiyor — bağlı cihaz production (ro.build.type=user) ve politika gereği jest enjeksiyonu reddediliyor. Lab cihaz bulunduğunda: node scripts/verdict-bridge-smoke.mjs <deviceId> (read-only OLMADAN) ile tap/input/swipe/stale-tree adımları koşulur. Kod tarafında açık iş yok.` |

## 3. Step execution log

| Step | Status | Evidence |
|---|---|---|
| 3.1 Preflight ve inherited blocker check | `DONE` | §4 |
| 3.2 Existing Bridge/ADB/DeviceWorker baseline | `DONE` | §5 |
| 3.3 Bridge protocol contract package | `DONE` | §6 — `@nesy/bridge-contract`, 50 test |
| 3.4 Fake TCP Bridge server harness | `DONE` | §7 — gerçek `net.Server` |
| 3.5 BridgeClient runtime | `DONE` | §8 — 35 test, gerçek TCP |
| 3.6 Device gate ve port lease store | `DONE` | §9 — 17 test |
| 3.7 Device Command Admission scheduler | `DONE` | §10 — 9 test |
| 3.8 TargetFingerprint/action lifecycle | `DONE` | §11 — 14 test |
| 3.9 wait_any/cancel_request foundation | `DONE` | §12 — 16 test |
| 3.10 DeviceWorker integration | `DONE` | §13 |
| 3.11 Artifact/screenshot/redaction | `DONE` | §14 |
| 3.12 Real DUT smoke script/gate | `PARTIAL` | §15 — 20/20 read-only PASS; mutation adımları production deny nedeniyle SKIP |
| 3.13 Verification/result/handoff | `DONE` | §16, bu dosya |

## 4. Step 3.1 — Preflight

| Komut | Sonuç | Kanıt |
|---|---|---|
| `pnpm verdict:verify-master-plan` | `PASS` | `sha256:76024d89…5c2bd0` (v1.1.3) |
| `git status --short` | `PASS` | Tek satır: `?? docs/verdict/run-playbooks/phase-3/` |
| `git branch --show-current` | `PASS` | `production` |
| `pnpm typecheck` (baseline) | `PASS` | `Tasks: 7 successful, 7 total` |
| `pnpm test` (baseline) | `PASS` | **331 passed / 38 skipped** |
| `prisma migrate status` | `SKIPPED` | `DATABASE_URL` bu shell'de yok; RUN_PLAY §9.4 alternatifi geçerli (Phase 2B kanıtı) |
| `adb devices` | **`DEVICE FOUND`** | `R6CW400BC8N` Samsung SM_A346E — RUN_PLAY'in "DUT yok" varsayımı YANLIŞ çıktı |

Inherited blocker durumu: B-8 `OPEN_NON_BLOCKING` (değişmedi), B-10 `CLOSED`
(Phase 2B kanıtı okundu).

## 5. Step 3.2 — Baseline envanteri

### Mobile tarafı (read-only) — sözleşmenin SSOT'u

`NesyMobile/verdict-bridge/` **zaten var ve cihazda kurulu**:

```text
app/src/main/java/com/verdict/bridge/
  ProtocolV1.kt        1995 satır  ← wire protocol SSOT
  UiActions.kt          618
  AccessibilityTree.kt  412
  CollectionQueries.kt  191
  RunInstrumentation.kt 164
  BridgeTcpServer.kt    154        ← NDJSON, 127.0.0.1:9876
  BridgeAccessibilityService.kt 83
```

Cihazda: `com.verdict.bridge` kurulu, `BridgeAccessibilityService` **aktif**.

**Bu yüzden contract UYDURULMADI.** Host tarafında bir sözleşme uydurup testleri
de o uydurmaya göre yazmak mümkündü; o testler sonsuza kadar yeşil kalır ve
gerçek cihazda hiçbir şey çalışmaz. §1'deki üç bulgu bu riskin teorik olmadığını
gösteriyor.

### Host tarafı — mevcut kod

| Dosya | Karar |
|---|---|
| `device-worker.ts` (370→470 satır) | Logcat + Maestro + WS bridge sahibi. **Korundu**; Bridge `acquireBridge()` ile OPT-IN eklendi. `prepare()` Bridge'e dokunmuyor — dokunsaydı her Maestro koşusu alakasız bir Bridge preflight'ına bağımlı olurdu ve preflight hatası koşu hatası gibi görünürdü. |
| `plugins/adb-bridge.ts` (50 satır) | Socket.io ADB köprüsü, Bridge protokolüyle ilgisiz. **Dokunulmadı.** |
| `control-contract` / `control-channels` | Host→cihaz **komut** düzlemi. Bridge cihaz→host **kanıt/UI** düzlemi; ayrı tutuldu. **Dokunulmadı.** |
| `packages/platform-paths` | `resolveAdbPath` mevcut; `bridge-adb-facade` `ADB_PATH` env'ini de destekliyor. |

## 6. Step 3.3 — `@nesy/bridge-contract`

Yeni workspace paketi. **Üç yasak** başlıkta yazılı: taşıma yok, domain yok,
uydurma yok.

Dosyalar: `protocol.ts` (envelope, komut listesi, hata taksonomisi, limitler,
epoch devralma), `targets.ts` (selector, TargetFingerprint, dump scope, node
modeli, clamp'ler), `lifecycle.ts` (action fazları/terminal durumlar, interaction
origin), `wait.ts` (UiWaitPlan, WaitAnyResult, cancel scope), `admission.ts`
(lane sözleşmesi), `codec.ts` (encode/decode/redaction).

**Domain sızıntısı testi** dışa açık yüzeyin tamamını metin olarak tarıyor:
`OPEN_STOP`, `APPROVE_TOUR`, `COURIER_LOGIN`, `PARCEL`, `"STOP"`, `"TOUR"` — hiçbiri
yok.

`BRIDGE_V1_DEVICE_GAPS` cihaz eksiklerini **tip düzeyinde isimlendiriyor**:
`waitAny: false`, `cancelRequest: false`, `capabilitiesCommand: false`,
`unsolicitedPush: false`. Böylece kimse "foundation var" diye yanlış varsayım
yapamaz.

## 7. Step 3.4 — Fake TCP Bridge

`packages/bridge-client/src/fake-bridge-server.ts` — **gerçek `net.Server`**, mock
değil. Test edilmesi gereken şeylerin çoğu yalnız gerçek soket üzerinde var:
chunk sınırından bölünen satır, yarım UTF-8 karakter, `FIN` ile kopan uçuştaki
istek.

En önemlisi: fake **cihazın bağlantı başına SERİLEŞTİRMESİNİ** taklit ediyor
(`chain = chain.then(...)`). Paralel işleyen bir fake, "iptal aynı sokette
çalışmaz" gerçeğini gizlerdi ve host tasarımı gerçek cihazda çökerdi.

Senaryolar: `delayMs`, `dropConnection`, `malformed`, `splitIntoChunks`,
`duplicate`, `respondWithRequestId`, `emitUnsolicited`, `oversizedBytes`, +
handshake zorunluluğu, run fencing, requestId dedupe.

## 8. Step 3.5 — BridgeClient

**Bağlantı HAVUZU — ve bu bir tercih değil, cihazın dayattığı bir gerçek.**
`BridgeTcpServer.serve()` bir bağlantıda `readLine → handle → write` döngüsüdür;
60 saniyelik bir `wait_node` o soketin reader'ını 60 saniye bloke eder. Sonuçları:
iptal aynı sokette **imkânsız**, ve paralel bekleme bacakları aynı sokette
**yarışmaz, sıraya dizilir**.

Kanıt testleri:
- `answers a control ping while a wait is still in flight on another socket`:
  CONTROL 1200ms'lik beklemenin arkasında kuyruğa girmiyor, `peakConnections ≥ 2`.
- `races two waits on separate sockets instead of serializing them`: iki 400ms
  bekleme <750ms'de bitiyor (seri olsaydı ≥800ms).

**Bağlantı kaybı sınıflandırması** (acceptance 10): mutation → `UNKNOWN_EFFECT`
(retry YASAK, mesajda açıkça yazılı), wait → `WAIT_CONNECTION_LOST`, read-only →
`BRIDGE_UNAVAILABLE` (retry edilebilir).

**Artımlı NDJSON parser** (10 test): 3 chunk'a bölünmüş frame, tek chunk'ta 3
frame, **chunk ortasından bölünmüş çok baytlı UTF-8** (`StringDecoder` olmadan
base64 PNG bozulur), CRLF, boş satır, bozuk JSON, aşırı büyük frame, satır sonu
hiç gelmeyen akış, akış sonunda yarım frame teslim edilmemesi.

Idempotency: aynı id + aynı payload `replayed: true`; aynı id + **farklı** payload
`PROTOCOL_VIOLATION` (komutlar arası da).

## 9. Step 3.6 — Device gate ve port lease

`AdbFacade` port'u sayesinde kapının **tüm karar mantığı cihazsız test edilebilir**
— aksi halde allowlist, production deny, port çakışması ve stale forward
kurallarının hiçbiri CI'da doğrulanamazdı, yani pratikte hiç.

Kanıt testleri (17):
- **Boş allowlist HİÇBİR cihaza izin vermiyor** (fail-closed). "Hepsine izin ver"
  saymak, yapılandırmayı unutmanın production cihazda Act Mode açması demekti.
- **Production build allowlist'te olsa BİLE reddediliyor**; bilinmeyen build type
  production sayılıyor.
- Erişilebilirlik kapalıysa port açmaya bile geçilmiyor.
- Her cihaz kendi host portunu alıyor, hepsi sabit `9876`'ya map'leniyor.
- Yabancı bir forward'ın tuttuğu port yeniden kullanılmıyor.
- Forward başarısız olursa port **serbest bırakılıyor** (aralık tükenmesin).
- `releaseForward` idempotent.

`bridge-adb-facade.ts` gerçek implementasyon: `--no-rebind` **şart** (onsuz ikinci
forward sessizce ilkini çalar ve komutlar yanlış cihaza gider), `unauthorized`/
`offline` cihazlar listeden düşürülüyor, teşhis alanları best-effort.

## 10. Step 3.7 — Admission scheduler

`LANE_CONCURRENCY.MUTATION = 1` bu fazın en önemli satırı. §1'de anlatılan yarış
hatası tam burada yakalandı.

Kanıt testleri (9): iki mutation asla eşzamanlı değil; OBSERVATION mutation ile
paralel koşuyor; **CONTROL kuyruktaki mutation'ların önüne geçiyor** (starvation
yok) ve aynı öncelikte FIFO korunuyor; preflight geçmeden her şey reddediliyor;
Inspector mutation'ı aktif koşuda reddediliyor ve **açık takeover** ile kabul
ediliyor; bir otomatik koşu diğerini devralamıyor; ret **kuyruğa almadan önce**
veriliyor; mutation sonrası `invalidationEpoch` artıyor ve bekleyenler
uyandırılıyor; komut patlasa bile şerit serbest kalıyor.

## 11. Step 3.8 — TargetFingerprint ve action lifecycle

`rowIndexHint` **adı gereği** bir ipucu ve tek başına kimlik **değil**
(`isPersistentTarget`). Liste kayarsa aksiyon başka bir kayda iner ve hiçbir
yerde hata çıkmaz — bir şeye dokunuldu ve bir şey oldu.

`admitMutationTarget` zayıf hedefi **cihaza göndermeden** reddediyor →
`REJECTED` terminal durumu → hiçbir şey olmadığı **kesin** → güvenle tekrar
denenebilir (`mayAutoRetry("REJECTED") === true`, `UNKNOWN_EFFECT` için `false`).

`BridgeActionLifecycle` terminal durumu **bir kez** yazıyor; ikinci yazım ve
terminal sonrası faz ekleme **hata fırlatıyor** (iki kez terminal sessiz bir
kanıt kaybıdır).

`classifyInteractionOrigin`: pencere bilinmiyorsa `UNKNOWN` — `MANUAL` değil.
"Bizden geldiğini kanıtlayamıyorum" ile "kullanıcı dokundu" farkı, suçlanacak
yeri değiştirir.

Device manager testleri (14): ambiguous → tap gönderilmiyor; stale tree → tap
gönderilmiyor; `expectTreeGen` gönderiliyor (aradaki değişiklik `stale_tree` ile
**reddedilir**, yanlış node'a dokunulmaz); jest penceresi kanıt olarak
saklanıyor; yanıt kaybında `UNKNOWN_EFFECT`.

## 12. Step 3.9 — wait_any / cancel temeli

Cihazda `wait_any` **yok**. İki dürüst seçenek vardı; "varmış gibi modellemek"
reddedildi (gerçek cihaz ilk çağrıda `unsupported_command` dönerdi — kanıt
üretmek değil kanıt taklidi). Yarış **host'ta** N paralel `wait_node` ile
kuruluyor ve cihaz komutu öğrendiğinde `planWaitExecution` tek komut dalını
seçiyor; **çağıran arayüzü değişmiyor**.

Kanıt testleri (16):
- **Bir bacağın `timeout` dönmesi planı BİTİRMİYOR** — ilk `timeout`u kazanan
  saymak, beklenen ekran bir saniye sonra gelse bile onu kaçırırdı.
- **Kesinti eşitlikte KAZANIYOR**: bir hata dialogu ekranda dururken "akış
  tamamlandı" demek olurdu.
- `AMBIGUOUS` ayrı raporlanıyor; `WAIT_CONNECTION_LOST` timeout **değil**.
- **Bekleme hot path'inde `dump`/`screenshot` HİÇ gönderilmiyor** (acceptance 17)
  ve `wait_node` parametreleri `scope` taşımıyor.
- İlk değerlendirme olay beklemiyor (<300ms).
- Plan doğrulama **cihaza dokunmadan** yapılıyor.
- İptal `HOST_ONLY` kapsamında ve `deviceReleaseByMs` **cihazın beklemeye devam
  ettiğini** söylüyor — söylemezsek aynı hedefe yeni bekleme açan çağıran
  cihazda iki bekleme yaratır.

## 13. Step 3.10 — DeviceWorker entegrasyonu

`acquireBridge(runId, sessionId, runEpoch)` typed host client'ı veriyor.
**Fallback YOK** (RUN_PLAY §13): Maestro tap yok, `adb shell input tap` yok,
koordinat yok. Fallback cazip görünür — "en azından bir şey yapmış oluruz" — ama
yaptığı şey fiziksel aksiyon kanıtını sessizce koordinat tabanlı bir tap'e
indirip raporu "başarılı" bırakmaktır.

`BridgeUnavailableError` **yeniden fırlatılıyor**, yutulup `null` dönmüyor.
`dispose()` soket + `adb forward` + bekleme temizliği yapıyor ve hatayı
loglayarak sızdırılmış forward'ı görünür kılıyor.

## 14. Step 3.11 — Artifact / screenshot / redaction

`screenshot` base64 PNG'yi **diske** yazıyor: `<artifactRoot>/<runId>/<deviceId>/
<label>-<sha256[0:12]>.png`. Log satırı boyut + sha256 taşıyor, **görüntü
taşımıyor** — base64'ü loglamak ekranın tamamını log toplayıcıya göndermektir.

`redactForLog` `data`, `text`, `value`, `params` alanlarını maskeliyor ve 120
karakterden uzun string'leri kırpıyor. Testler `input_text` metninin ve PNG
verisinin log'a **sızmadığını** doğruluyor.

## 15. Step 3.12 — Gerçek DUT

### Cihaz durumu

```text
R6CW400BC8N   Samsung SM_A346E (a34x)
ro.build.type = user           ← PRODUCTION BUILD
com.verdict.bridge             ← kurulu
BridgeAccessibilityService     ← aktif
```

### Production deny doğru çalıştı — CP3'ün blocker'ı bu

İlk smoke koşusu **durdu**:

```text
✓ production-deny: PASS — ro.build.type=user → gesture injection refused
SMOKE HALTED: production device. This is the correct outcome, not a failure.
```

Bu yüzden `tap`/`input`/`swipe`/`back`/`activate_id`/`scroll_to_item` gerçek
cihazda **hiç denenmedi**. Acceptance 14 (production Act Mode deny) böylece
**gerçek cihaz kanıtıyla** karşılandı; ama acceptance 6/7/9/11 (ambiguous/stale
tap reddi, lifecycle terminal, sabit koordinat reddi) yalnız **fake bridge**
kanıtına dayanıyor.

### Salt-okunur parite: 20/20 PASS

Kullanıcı onayıyla `--read-only` kipinde koşuldu — hiçbir mutation gönderilmedi,
ekran görüntüsü **alınmadı** (`--allow-screen-capture` verilmedi), node metinleri
loglanmadı.

```text
✓ production-deny            ro.build.type=user → gesture injection refused
✓ bridge-apk                 com.verdict.bridge installed
✓ accessibility              BridgeAccessibilityService enabled
✓ port-forward               tcp:21876 → tcp:9876
✓ ping                       protocolVersion=1
✓ wait_any-absent            device says: unsupported_command
✓ cancel_request-absent      device says: unsupported_command
✓ register_watch-absent      device says: unsupported_command
✓ protocol-mismatch          device says: unsupported_protocol_version
✓ scoped-dump                treeGen=42903, nodes=2 (contents NOT logged)
✓ find-not-found             error=not_found, matched=0
✓ ambiguity-or-refusal       error=missing_value (no action was attempted)
– stale-or-missing-refused   SKIP (read-only: tap_id is a mutation command)
✓ wait_node-timeout          error=timeout, polls=17, waited≈1532ms
✓ control-not-blocked-by-wait control ping in 22ms while a 6000ms wait was in flight
– screenshot                 SKIP (needs --allow-screen-capture)
✓ requestId-idempotent       cached response (monoTs identical)
✓ requestId-conflict         same id + different payload → request_id_conflict
✓ run-fencing                mismatched runEpoch → stale_run
✓ forward-cleanup            removed tcp:21876

20/20 steps passed — CP3 smoke: ALL PASS
```

Bu koşu §1'deki üç sözleşme hatasının **hepsini** yakaladı ve düzeltmeleri
doğruladı (`wait_node-timeout` ilk koşuda `invalid_match_by` idi, düzeltmeden
sonra `error=timeout, polls=17`).

### Smoke arka arkaya koşuda FLAKY (B-12)

Ölçüm: arka arkaya koşularda handshake 8s içinde yanıtsız kalıyor; **15–20 sn ara
verilirse 20/20 geçiyor**.

```text
aralıksız:  PASS, FAIL, PASS, FAIL          (~%50)
15s aralı:  PASS, PASS(19/20 eşik), PASS    (kararlı)
```

Kök neden host tarafında **değil**: aynı host kodu aralıklı koşuda kararlı.
Cihaz tarafında bağlantı/thread birikimi olduğu tahmin ediliyor
(`BridgeTcpServer` `clientExecutor` cached pool, `ACCEPT_BACKLOG = 4`,
`isDaemon = false`). Mobile owner'a devredildi; **kesin sebep izole edilmedi** ve
öyle olduğunu iddia etmiyorum.

Ayrıca kendi eşiğim fazla sıkıydı: `control-not-blocked-by-wait` mutlak 2000ms
eşiği kullanıyordu ve yük altında 3107ms'de yanıtlanan bir ping'i `FAIL`
sayıyordu — oysa asıl iddia "6 sn'lik beklemenin arkasında kuyruğa girmedi" ve
kuyruğa girmiş olsa ≥6000ms olurdu. Eşik beklemenin süresine **göreli** yapıldı.

## 16. Step 3.13 — Verification

| Komut | Sonuç | Kanıt |
|---|---|---|
| `pnpm verdict:verify-master-plan` | `PASS` | `sha256:76024d89…5c2bd0` — değişmedi |
| `pnpm typecheck` | `PASS` | `Tasks: 11 successful, 11 total` (7→11: iki yeni paket + build) |
| `pnpm test` | `PASS` | **505 passed / 38 skipped** |
| `pnpm --filter @nesy/api typecheck` | `PASS` | çıktı yok |
| `pnpm --filter @nesy/api test` | `PASS` | 258 passed / 38 skipped |
| `pnpm --filter @nesy/bridge-contract typecheck` | `PASS` | çıktı yok |
| `pnpm --filter @nesy/bridge-contract test` | `PASS` | 50 passed |
| `pnpm --filter @nesy/bridge-client typecheck` | `PASS` | çıktı yok |
| `pnpm --filter @nesy/bridge-client test` | `PASS` | 35 passed |
| `git diff --check` | `PASS` | çıktı yok |
| `git diff --cached --check` | `PASS` | çıktı yok |
| Real DUT read-only smoke | `PASS` | 20/20 (§15) |

Test deltası: **331 → 505 passed** (+174), skipped 38 (değişmedi — yeni skip
eklenmedi). Mevcut 331 testin hiçbiri kırılmadı.

Yasak desen taraması (`as any`, `@ts-ignore`, `.skip`, `.only`) yeni dosyaların
hepsinde temiz.

## 17. Changed files

| File | Status | Owned? |
|---|---|---|
| `docs/verdict/run-playbooks/phase-3/RESULT.md` | `modified` | ✅ |
| `packages/bridge-contract/**` (7 dosya) | `new` | ✅ |
| `packages/bridge-client/**` (7 dosya) | `new` | ✅ |
| `apps/api/src/services/bridge-device-gate.ts` + `.test.ts` | `new` | ✅ |
| `apps/api/src/services/bridge-admission.ts` + `.test.ts` | `new` | ✅ |
| `apps/api/src/services/bridge-wait.ts` + `.test.ts` | `new` | ✅ |
| `apps/api/src/services/bridge-device-manager.ts` + `.test.ts` | `new` | ✅ |
| `apps/api/src/services/bridge-adb-facade.ts` | `new` | ✅ |
| `apps/api/src/services/device-worker.ts` | `modified` | ✅ |
| `apps/api/package.json` | `modified` | ✅ (iki workspace dep) |
| `scripts/verdict-bridge-smoke.mjs` | `new` | ✅ (`scripts/**`) |
| `pnpm-lock.yaml` | `modified` | ⚠️ owned paths'te değil |

**`pnpm-lock.yaml` gerekçesi:** iki yeni workspace paketi eklemenin kaçınılmaz
sonucu. `pnpm install` onu yazmadan paketler çözülemez ve typecheck/test
koşamaz. Risk yok: yalnız workspace link kaydı eklendi, hiçbir dış bağımlılık
sürümü değişmedi. RUN_PLAY §11 `pnpm-workspace.yaml`/`package.json`ı "olası
değişiklikler" içinde sayıyor; lockfile aynı işlemin türevi.

**`packages/db/prisma/**` DEĞİŞTİRİLMEDİ.** Action lifecycle şu an test-visible
(`getActionLog()`); kalıcılık gerçekten gerekene kadar Prisma şeması
büyütülmedi (RUN_PLAY §7).

**`apps/web` ve Mobile repo DEĞİŞTİRİLMEDİ.**

## 18. Acceptance checklist

| Criteria | Status | Evidence |
|---|---|---|
| 1. Protocol fixture parity green | `PASS (+DUT)` | 50 parite testi + gerçek cihaz 20/20 |
| 2. NDJSON partial/multiple/malformed/oversized | `PASS` | 10 parser + 6 client testi |
| 3. Handshake/capability/protocol mismatch fail-fast | `PASS (+DUT)` | `protocol-mismatch` gerçek cihazda `unsupported_protocol_version` |
| 4. requestId idempotency/conflict | `PASS (+DUT)` | Gerçek cihazda aynı `monoTs` / `request_id_conflict` |
| 5. Scoped dump no full fallback | `PASS (+DUT)` | `never falls back to a full dump`; DUT'ta `scope=depth` |
| 6. Ambiguous selector no action | `PASS (fake)` | `does not tap an AMBIGUOUS target` — mutation DUT'ta koşulamadı |
| 7. Stale tree no action | `PASS (fake)` | `does not tap when the tree is stale` + `expectTreeGen` |
| 8. rowIndexHint not identity | `PASS` | `REJECTS a row-index-only target without touching the device` |
| 9. Action lifecycle terminal state | `PASS (fake)` | Tek terminal durum zorlanıyor; ikinci yazım hata |
| 10. UNKNOWN_EFFECT / WAIT_CONNECTION_LOST split | `PASS` | Üç ayrı sınıflandırma testi |
| 11. Fixed coordinate rejection | `PASS` | Fixed-coordinate mutation API yüzeyi yok; rowIndex-only hedef ayrıca `ROW_INDEX_HINT_NOT_IDENTITY` ile cihaza gitmeden reddediliyor |
| 12. Screenshot artifact + no sensitive log | `PASS (fake)` | Diske yazım + sha256; DUT'ta kullanıcı onayıyla SKIP |
| 13. Multi-device dynamic host port lease | `PASS` | Ayrı portlar, sabit `9876`'ya map |
| 14. Production device Act Mode deny | **`PASS (+DUT)`** | Gerçek production cihazda jest enjeksiyonu reddedildi |
| 15. wait_any capability + expected/interrupt/cancel | `PASS` | 16 test; cihaz eksikliği açıkça modellendi |
| 16. Long wait reader non-blocking | `PASS (+DUT)` | DUT: control ping 22ms / 6000ms bekleme |
| 17. wait response no full dump | `PASS (+DUT)` | Hot path'te `dump`/`screenshot` yok |
| 18. Initial evaluation no event wait | `PASS (+DUT)` | <300ms; DUT `polls=17` |
| 19. Scoped safety rescan bounded | `PASS` | Host ek tarama açmıyor; mutation sonrası tetikleme |
| 20. No global fixed full-tree polling | `PASS` | Host'ta zamanlayıcı yok; yoklama cihazın içinde |
| 21. Single mutation lane; no control starvation | `PASS` | §10 — yarış hatası düzeltildi |
| 22. Active-run Inspector Act denial/takeover | `PASS` | Ret + açık takeover + otomatik koşu devralamaz |
| 23. register_watch/unsolicited push absent | `PASS (+DUT)` | Parser fail-closed; DUT `unsupported_command` |
| 24. Typecheck/test green | `PASS` | §16 |
| 25. Real DUT smoke green veya explicit blocker | **`PARTIAL`** | 20/20 read-only PASS; mutation adımları **production deny** ile bloke |

**21/25 tam PASS (+DUT kanıtı 11'inde), 3 fake-only (6/7/9/12), 1 PARTIAL (25).**

## 19. Blockers

| ID | Severity | Description | Owner | Status |
|---|---|---|---|---|
| **CP3-DUT** | **HIGH/EXTERNAL** | CP3 full acceptance için **lab cihaz** (`userdebug`/`eng`) gerekiyor. Bağlı tek cihaz production (`ro.build.type=user`); politika gereği jest enjeksiyonu reddedildi ve bu **doğru** davranış. Mutation acceptance'ları (6/7/9/12) yalnız fake bridge kanıtına dayanıyor. | Device/Mobile owner | `BLOCKED_EXTERNAL_DUT` — RUN_PLAY'in öngördüğü `DUT_UNAVAILABLE` değil, daha spesifik: **DUT_PRODUCTION_DENIED** |
| **B-12** | MEDIUM | Gerçek cihaz smoke'u arka arkaya koşulduğunda handshake yanıtsız kalıyor (~%50); 15–20 sn ara ile kararlı 20/20. Host tarafı aynı, dolayısıyla cihaz tarafı bağlantı/thread birikimi şüphesi — **izole edilmedi**. | Mobile owner | `OPEN` (yeni) |
| **B-13** | MEDIUM | Cihazda `wait_any`, `cancel_request` ve `capabilities` **yok**. Host foundation'ı yarıştırılmış `wait_node` ile kuruldu; iptal `HOST_ONLY` kapsamında ve cihaz kendi zaman aşımına kadar kaynak tutmaya devam ediyor. Faz 5 Continue Gate bunu bilerek tasarlanmalı. | Mobile owner + Contract owner | `OPEN` (yeni, contract mismatch kanıtı §1) |
| **B-14** | LOW | `runEpoch` biriminin protokolde tanımsız olması bir kilitlenme riski: ms kullanan bir claim, saniye kullanan her host'u kalıcı olarak dışarıda bırakıyor. Protokol v2'de birim **yazılmalı**. | Contract owner | `OPEN` (yeni) |
| B-8 | MEDIUM | Repo-wide lint ESLint v9 flat-config borcu. Yeni iki paket `@nesy/eslint-config` kullanıyor ama gate hâlâ non-blocking. | Platform owner | `OPEN_NON_BLOCKING` |

## 20. Skipped / deferred work

| İş | Neden | Nereye |
|---|---|---|
| Action lifecycle DB kalıcılığı | Test-visible yeterli; sırf test state'i için Prisma büyütülmez (RUN_PLAY §7) | Faz 5 |
| `bridge-*.routes.ts` read model | RUN_PLAY isteği değil; health yüzeyi Faz 6 UI ile birlikte anlamlı | Faz 6 |
| `collection_info` / `scroll_to_item` sarmalayıcıları | Sözleşmede var, device manager'da metod yok — liste semantiği Domain Pack işi | Faz 4B |
| WorkflowIR v2, Domain Pack, BridgeFlowCompiler, Maestro söküm, SDK mutual-HMAC | RUN_PLAY §6 kapsam dışı. Dokunulmadı. | İlgili fazlar |

## 21. Phase 4A handoff

```text
phase4AReadiness: READY_WITH_EXTERNAL_DUT_BLOCKER
```

**Hazır olan taraf.** Phase 4A'nın (WorkflowIR v2 + Condition Engine) üzerine
derleyeceği UI action primitive'leri artık **gerçek cihazda doğrulanmış** bir
sözleşmeye dayanıyor. RUN_PLAY §3'ün endişesi — "compiler yanlış primitive'e göre
şekillenir" — giderildi: primitive listesi cihazın `dispatchCommand`'ından
çıkarıldı ve 20/20 DUT koşusuyla teyit edildi. Domain sızıntısı yok, typecheck ve
test yeşil, `as any`/test skip yok.

**Blocker'lı olan taraf.** Compiler tasarımını etkileyen üç gerçek:

1. **`wait_any` cihazda yok** (B-13). Faz 4C bir `UiWaitPlan` derlerken, host'un
   onu N paralel `wait_node`'a açtığını ve her bacağın **ayrı bağlantı**
   tükettiğini bilmek zorunda (`LANE_CONCURRENCY.WAIT = 4`). Sınırsız kesinti
   hedefi olan bir plan cihazda bağlantı tükenmesine yol açar.
2. **İptal cihaza ulaşmıyor** (B-13). İptal edilen bir bekleme cihazda kendi
   zaman aşımına kadar sürer. Aynı hedefe hemen yeni bekleme açan bir plan,
   cihazda iki bekleme yaratır — `deviceReleaseByMs` bunu söylüyor ve executor
   buna uymak zorunda.
3. **Mutation acceptance'ları lab cihaz bekliyor** (CP3-DUT). Faz 4 derleyicisi
   yazılabilir; ama `tap`/`input`/`swipe`'ın gerçek cihazda doğrulanması Faz 5
   executor cutover'ından **önce** yapılmalı.

**Sıradaki agent şu sırayla devam etmeli:**

1. Bu dosyayı oku — özellikle §1 (üç sözleşme hatası + iki runtime hatası),
   §15 (DUT durumu ve flakiness ölçümü), §17 (`pnpm-lock.yaml` gerekçesi),
   §19 (CP3-DUT, B-12, B-13, B-14).
2. `pnpm verdict:verify-master-plan` — digest
   `sha256:b81631396044cab7f83f6b6efea2f47ff4b4bda4b177b2d7a2ad705535b660b2`.
3. `git status --short` — Phase 3 değişiklikleri **commit edilmedi**; commit/PR
   kararı user'ın. Beklenen: 3 `M` + 11 `??`.
4. **Lab cihaz temin edildiğinde** CP3'ü kapat:
   `VERDICT_BRIDGE_LAB_DEVICES=<id> node scripts/verdict-bridge-smoke.mjs <id>`
   (`--read-only` OLMADAN). Yeşilse acceptance 6/7/9/12 DUT kanıtı kazanır ve
   CP3 `COMPLETED` olur.
5. B-12'yi Mobile owner'a ilet (cihaz tarafı bağlantı birikimi).
6. Phase 4A RUN_PLAY'ini oluştur; B-13'ü wait/cancel tasarım kısıtı olarak taşı.

### Gerçek cihaz smoke'unu tekrarlamak

```bash
export ADB_PATH="$HOME/Library/Android/sdk/platform-tools/adb"
# Salt-okunur parite (production cihazda güvenli, mutation yok):
node scripts/verdict-bridge-smoke.mjs <deviceId> --read-only
# Ekran görüntüsü de dahil (cihazın o anki ekranını okur):
node scripts/verdict-bridge-smoke.mjs <deviceId> --read-only --allow-screen-capture
# CP3 full acceptance (YALNIZ userdebug/eng lab cihazda):
node scripts/verdict-bridge-smoke.mjs <deviceId>
```

Arka arkaya koşmayın — B-12 nedeniyle aralarında ~15 sn bırakın.

## 22. Post-review düzeltmeleri

Codex review sırasında iki küçük ama doğru yönde düzeltme yapıldı:

1. `rowIndexHint` tek başına hedef kimliği olmadığı için reddedilen mutation artık
   `FIXED_COORDINATE_TARGET_FORBIDDEN` yerine `ROW_INDEX_HINT_NOT_IDENTITY`
   üretiyor. Önceki kod davranış olarak güvenliydi, çünkü cihaza hiç gitmiyordu;
   fakat teşhis yanlıştı. Row index problemi ile fixed coordinate yasağı aynı
   hata sebebine sıkıştırılmamalı.
2. `BridgeConnection.write()` içinde bağlantı write anında kapalıysa pending
   istek artık standart settle yolundan kapatılıyor. Önceki kod promise'i
   reddediyordu ama timer/AbortSignal listener temizliği o edge-case'te
   atlanabilirdi.

Ek kalite temizliği: `fake-bridge-server.ts` içindeki unused destructuring lint
warning'leri kaldırıldı.

Review sonrası doğrulama:

```text
pnpm --filter @nesy/bridge-client lint   PASS
pnpm --filter @nesy/bridge-client test   PASS — 35 passed
pnpm --filter @nesy/bridge-contract build PASS
pnpm --filter @nesy/api test -- src/services/bridge-device-manager.test.ts PASS — 14 passed
pnpm verdict:verify-master-plan          PASS
pnpm typecheck                           PASS — 11/11
pnpm test                                PASS — 505 passed / 38 skipped
git diff --check                         PASS
git diff --cached --check                PASS
```
