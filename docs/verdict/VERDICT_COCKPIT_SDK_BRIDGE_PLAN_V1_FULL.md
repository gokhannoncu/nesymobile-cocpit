---
name: Verdict Cockpit SDK + Bridge plan v1
overview: NesyMobileCocpit'i mevcut Maestro merkezli otomasyon koşucusundan; Verdict SDK kontrol ve event düzlemi, Verdict Accessibility Bridge fiziksel UI eylem düzlemi, kalıcı event fan-out'u, BridgeFlowCompiler/Executor, dört katmanlı oracle ve ölçümlü Maestro silme kapısı bulunan app-agnostic bir test ve operasyon platformuna dönüştüren bağlayıcı master plan. Plan; mevcut doğru parçaları korur, production WebSocket mutual-HMAC boşluğunu, durable consumer/recovery boşluğunu, Bridge host client ve device gate eksikliğini, Workflow IR/Condition Engine/BridgeFlow runtime ihtiyacını, veri modeli ve UI dönüşümünü, fiziksel DUT kapılarını, güvenlik/retention kurallarını ve Cockpit ürün kabuğu borçlarını tek yerde toplar.
todos:
  - id: faz-0
    content: "FAZ 0 — Doğrulanabilir baseline ve SSOT: repo-level typecheck yeşil; checkpoint script'leri ayrı harness; gerçek PostgreSQL ingest testleri CI'da; Mobile verdict-status.json ile Cockpit durum tablosu eşlenir; eski Cockpit dokümanlarındaki VerdictChannel/detectChannel/legacy drift'i düzeltilir; golden workflow ve ölçüm fixture'ları SHA-pinned hale gelir. CHECKPOINT 0 geçmeden güvenlik veya runtime cutover yapılmaz."
    status: pending
  - id: faz-1
    content: "FAZ 1 — Güvenli SDK run session ve mutual-HMAC WS host: RunSecretRegistry, run/device/app bağlama, set_run ile aynı typed secret, app->host doğrulama, host->app karşı imza, 5 saniye auth timeout, pre-auth event/ACK yasağı, nonce replay/time-skew/rotation/end_run testleri ve çoklu cihaz izolasyonu. CHECKPOINT 1: kimliksiz peer 0 metadata/event görür; gerçek cihaz authenticated WS üzerinden event üretir."
    status: pending
  - id: faz-2
    content: "FAZ 2 — Durable event runtime: commit-sonrası ACK korunur; ordered fan-out gerçek consumer'a bağlanır; processed_at/retry/dead-letter/consumer lag; restart recovery; run-scoped subscription ve host waitEvent; synchronous sink ile paralel eşitlik; ölçüm sonrası synchronous oracle yolu kaldırılır. CHECKPOINT 2: process kill sonrası event bir kez ve sırayla oracle'a ulaşır, WAL ACK/gap semantiği korunur."
    status: pending
  - id: faz-3
    content: "FAZ 3 — Bridge host temeli ve cihaz kapısı: packages/bridge-contract + bridge-client; NDJSON framing, handshake, typed command/result, requestId idempotency, timeout/cancel/reconnect, screenshot artifact; cihaz başına dinamik host port -> sabit device 9876; Bridge APK/version/hash/accessibility/capability/ping preflight; lab allowlist ve production deny. CHECKPOINT 3: gerçek DUT'ta scoped dump/find/tap/input/swipe/back/screenshot/wait_node ve hata sözleşmesi geçer."
    status: pending
  - id: faz-4
    content: "FAZ 4 — Workflow beyni: paylaşılan workflow-contract, Workflow IR v2, güvenli Condition Engine AST, true/false/unknown, compile-time/runtime ayrımı, FOR_EACH/SWITCH/RETRY/DIALOG_POLICY/WAIT_EVENT/CAPTURE/CLEANUP node'ları ve deterministik BridgeFlowCompiler. CHECKPOINT 4: unsupported/ambiguous/unbounded/risky planlar cihazdan önce fail; aynı input aynı plan hash'ini üretir."
    status: pending
  - id: faz-5
    content: "FAZ 5 — BridgeFlowExecutor + dört katmanlı Oracle + yeni kalıcılık modeli: step occurrence/iteration/requestId/treeGen, SDK/Bridge/local/remote evidence, completion policy, cancellation/recovery/cleanup, stuck-run detection; additive Prisma migrasyonu ve eski Maestro run'ları read-only uyumluluğu. CHECKPOINT 5: process restart ve duplicate action senaryoları deterministik, ekran yeşili tek başına başarı üretmez."
    status: pending
  - id: faz-6
    content: "FAZ 6 — Cockpit UI dönüşümü: YAML Preview yerine BridgeFlow Plan Preview; selector builder; Live Inspector Observe/Act; ADB/SDK Control/SDK Event/Accessibility Bridge ayrı sağlık durumları; run detail'de UI/App/Local/Remote rozetleri, occurrence/iteration timeline, missing-event teşhisi ve copy-repro paketi. CHECKPOINT 6: operatör YAML veya Maestro bilmeden workflow yazıp kanıtı açıklayabilir."
    status: pending
  - id: faz-7
    content: "FAZ 7 — Gerçek iş akışları ve teşhis: Field Login ve Load Tour tek executor'a taşınır; tam kurye turu, 20 barkod FOR_EACH, QUEUE_OFFLINE, backend confirmation ve dialog policy; D1/D2/D3 CapturePolicy, redaction, retention, RBAC/audit, heartbeat/stuck-run ve transport/Bridge metrikleri. CHECKPOINT 7: referans kurye akışı tüm evidence katmanlarıyla gerçek DUT'ta yeşil."
    status: pending
  - id: faz-8
    content: "FAZ 8 — Fiziksel kabul ve ölçümlü Maestro cutover: Bridge B1 runId/sessionId/epoch fencing, process-death duplicate action, IME obstruction, foreign window ve manual touch contamination; golden runner dual-run; correctness, false-pass, süre ve artifact karşılaştırması. CHECKPOINT 8 geçmeden Maestro kapatılmaz."
    status: pending
  - id: faz-9
    content: "FAZ 9 — Ürünleştirme ve DELETE: Maestro executor/driver/YAML compiler/UI/CLI/fallback kaldırılır; v1 compatibility telemetry gate; run/artifact operasyon politikaları; çoklu cihaz, düşük disk, USB/power kaybı ve soak; doküman/terminoloji temizliği; kalan product-shell placeholder işleri ayrı ürün backlog'una devredilir. CHECKPOINT 9: yeni run yolunda Maestro referansı sıfır, güvenlik/durability/release kapıları yeşil."
    status: pending
isProject: false
---

# Verdict Cockpit — SDK + Bridge Tam İmplementasyon Planı

**Sürüm:** v1  
**Tarih:** 2026-08-01  
**Durum:** Bağlayıcı master plan; uygulama ve kabul kapıları tamamlanmamıştır.  
**Kapsam:** `/NesyMobileCocpit` içindeki API, Web, workspace paketleri, veritabanı, cihaz işçileri, otomasyon editörü, runtime, oracle, artifact, teşhis, güvenlik ve geçiş kodları.  
**Mobile SSOT:** `/NesyMobile/verdict-status.json`  
**Kaynak SDK planı:** `/Users/gokhanoncu/Desktop/Verdict_Dev/plan/verdict_sdk_plan_v3_FULL.md`

> **Bu doküman kendi kendine yeterlidir.** Cockpit için kapsam, hedef mimari,
> yapılacaklar, yapılmayacaklar, sıralama, bağımlılıklar, fiziksel cihaz kapıları,
> test stratejisi ve bitiş ölçütleri burada tanımlanır.
>
> `COCKPIT_SDK_BRIDGE_COMPAT_PLAN.md`, `CONDITION_ENGINE_AND_BRIDGEFLOW.md`,
> `FAZ4_COCKPIT_LIVE_INSPECTOR_PLAN.md`, `FAZ8_V1_COMPAT_GATE.md` ve
> `SISTEM_NASIL_CALISIR.md` destekleyici/dar dokümanlardır. Çelişki halinde bu
> master plan ve Mobile `verdict-status.json` kazanır.
>
> **Zaman tahmini yoktur.** İlerleme takvimle değil checkpoint ile ölçülür.
> Bir checkpoint geçmeden onu izleyen ve geri dönüşü zorlaştıran cutover adımına
> geçilmez.

---

## Denetim Turu 1 — Kod ve plan karşılaştırmasında bulunanlar

Bu plan yalnız eski dokümanların birleştirilmesi değildir. Mobile SDK, Bridge APK,
Cockpit API/Web/runtime, Prisma modeli, testler ve mevcut Cockpit verdict
dokümanları kaynak seviyesinde karşılaştırılmıştır.

| Öncelik | Bulgu | Bu planda kapandığı yer |
|---|---|---|
| **P0** | Production `TestEventWsServer`, SDK'nın zorunlu mutual-HMAC `hello/auth` akışını tamamlamıyor. `broadcastSetRun` caller secret vermediğinde secret üretip cihaza gönderiyor fakat host registry'de tutmuyor. Bu kod yolunda authenticated SDK event socket'i açılamaz; logcat fallback sorunu maskeleyebilir. | Faz 1 · B.4 · D.1 |
| **P0** | Durable ingest ve commit-sonrası ACK var; fakat kabul edilen event'i restart-safe biçimde oracle/workflow'a dağıtan kalıcı consumer baseline'da yoktu. Working tree'de fan-out consumer çalışması başlamış olsa da checkpoint geçmeden tamamlanmış sayılmaz. | Faz 2 · B.5 · D.2 |
| **P0** | Cockpit'te Verdict Bridge TCP host client yok: handshake, NDJSON framing, typed command, request correlation, treeGen, DumpScope, screenshot artifact ve hata taksonomisi uygulanmamış. | Faz 3 · B.6 · D.3 |
| **P0** | DeviceWorker yalnız ADB/logcat, SDK WS reverse ve Maestro driver hazırlıyor; Bridge APK/service/forward/ping/capability/device-policy gate'i yok. | Faz 3 · D.4 |
| **P0** | Workflow runtime hâlâ Maestro YAML üretip tek Maestro prosesi çalıştırıyor. BridgeFlowCompiler ve BridgeFlowExecutor yok. Mobile SSOT `bridge_b2=not_started` diyor. | Faz 4–5 · D.7–D.8 |
| **P0** | Repo-level typecheck kırmızıydı; unit suite'lerin yeşil olması release baseline'ı için yeterli değil. Gerçek PostgreSQL ve fiziksel DUT testlerinin bir bölümü opt-in/skip. | Faz 0 · G.2 |
| **P1** | Mevcut Workflow IR ve editor node modeli FOR_EACH, typed condition, retry, dialog policy, waitEvent, occurrence ve evidence policy taşımıyor. | Faz 4 · D.5–D.6 |
| **P1** | Oracle structured event alabiliyor fakat Bridge UI kanıtı, durable waitEvent, occurrence/iteration correlation ve dört katmanlı completion policy tam değil. | Faz 5 · D.9 |
| **P1** | Prisma run modeli `yamlContent` ve `maestroOutput` merkezli; protocol/capability/plan/occurrence/evidence/recovery alanları yok. | Faz 5 · D.10 |
| **P1** | Cockpit UI'da YAML/Maestro dili, ADB'yi “Bridge” sanmaya yol açan durum etiketleri ve polling tabanlı sınırlı Screen State bulunuyor. | Faz 6 · D.11–D.13 |
| **P1** | Field Login ve Load Tour ayrı Maestro'ya özel yollar taşıyor; aynı compiler/executor/oracle omurgasını kullanmıyor. | Faz 7 · D.14 |
| **P1** | Bridge B1 conditional: run fencing, process-death duplicate action ve üç fiziksel DUT vakası açık. | Faz 8 · D.18 |
| **P2** | Home placeholder'ları, Screen Manual, Settings route'u, PM Calendar/Roadmap gibi ürün kabuğu borçları var; SDK/Bridge release yolunu bloke etmemeli. | D.20 · Faz 9 sonrası ürün backlog'u |

### Denetimin ana sonucu

Cockpit'in doğru mevcut tanımı:

> SDK kontrol kanalını kullanabilen, structured event ingest temeli bulunan,
> fakat güvenli event session'ı ve kalıcı event runtime'ı kabul edilmemiş,
> execution motoru hâlâ Maestro olan geçiş dönemi Cockpit'i.

Hedef tanımı:

> Verdict SDK'yı uygulama içi kontrol ve semantik kanıt, Verdict Bridge'i
> fiziksel/görsel UI eylemi, ADB'yi cihaz operasyonu için kullanan; güvenli,
> kalıcı, tekrar başlatılabilir, açıklanabilir ve dört katmanlı oracle ile
> doğrulanan Maestro'suz workflow platformu.

---

# BÖLÜM A — BAĞLAM, KAPSAM VE MEVCUT DURUM

## A.1 Amaç

Bu planın amacı Cockpit'i aşağıdaki yeteneklere ulaştırmaktır:

1. Her run için güvenli SDK session kurmak.
2. SDK event'lerini WAL/ACK sözleşmesini bozmadan kalıcı ve sıralı tüketmek.
3. Verdict Bridge ile gerçek UI eylemleri yürütmek.
4. Workflow grafını typed, versioned ve deterministik bir plana derlemek.
5. Condition, loop, retry ve dialog kararlarını açıklanabilir biçimde vermek.
6. UI, app, local ve remote kanıtları aynı occurrence altında birleştirmek.
7. API/UI process restart ve cihaz/Bridge kopmalarında güvenli recovery yapmak.
8. Operatöre selector, plan, evidence ve repro araçlarını sunmak.
9. Maestro'yu ölçümlü kapıdan sonra tamamen kaldırmak.
10. Eski run'ları okunabilir tutarken yeni run modelini engine-agnostic yapmak.

## A.2 Tek kaynak ve öncelik sırası

Durum ve kararlar şu sırayla yorumlanır:

1. Mobile `verdict-status.json`: SDK/Bridge checkpoint ve release kararlarının SSOT'u.
2. Bu dosya: Cockpit hedefi, kapsamı, fazları ve Cockpit checkpoint'leri.
3. Wire fixture ve package contract testleri.
4. Dar Cockpit verdict dokümanları.
5. Kod yorumları ve tarihi README ifadeleri.

Bir çalışma dalındaki veya dirty worktree'deki kod, ilgili checkpoint'in bütün
kriterleri geçmeden “tamamlandı” sayılmaz.

## A.3 Durum gösterimi

| İşaret | Anlam |
|---|---|
| ✅ | Baseline'da mevcut ve ilgili test/kanıtla doğrulanmış |
| 🟡 | Kısmi, conditional, working tree'de veya kabul kapısı eksik |
| ❌ | Uygulama yok ya da hedef davranışı karşılamıyor |
| ⛔ | Bilinçli NO_GO / yasak davranış |
| ➜ | Başka repo veya fiziksel cihaz bağımlılığı |

## A.4 Bugünkü karar tablosu

| Karar | Durum | Gerekçe |
|---|---|---|
| SDK evidence-core integration | ✅ GO | Control/event/WAL temeli uygulanmış ve yerel kanıt var |
| Controlled Cockpit functional E2E | 🟡 GO | Disposable PostgreSQL ve run-scoped WS authentication şartlı |
| Bridge B1 pilot | 🟡 CONDITIONAL | Fencing, process-death ve üç DUT vakası açık |
| Verdict platform release | ⛔ NO_GO | BridgeFlowCompiler/runtime ve measured cutover yok |
| Production rollout | ⛔ NO_GO | Security, durability, device acceptance borcu var |
| Public SDK release | ⛔ NO_GO | Mobile publication/external consumer/security kapıları açık |

## A.5 Zaten doğru olanlar — yeniden yazılmayacak

| Parça | Durum | Plan kararı |
|---|---|---|
| `packages/control-contract` typed operation'ları | ✅ | Genişletilir; kırılarak yeniden yazılmaz |
| `VerdictChannel` | ✅ | SDK kontrol düzleminin kalıcı kanalıdır |
| Nonce tabanlı fail-closed `detectChannel` | ✅ | Korunur; exit code tek sinyal yapılmaz |
| Secret/PIN'in private sidecar stdin ile taşınması | ✅ | argv/log'a geri döndürülmez |
| `get_command_result`, `end_run`, DumpProvider çağrıları | ✅ | Executor'a bağlanır |
| Screen State'te Verdict dump önceliği + legacy fallback | ✅ geçiş | Fallback sunset gate sonrası kaldırılır |
| Structured event parser ve v1/v2 additive toleransı | ✅ | Telemetry gate tamamlanana kadar korunur |
| Durable inbox/gap/stream şeması ve commit-sonrası ACK | ✅ temel | Consumer/recovery ile tamamlanır |
| DeviceWorker FIFO cihaz kuyruğu | ✅ | Engine-agnostic hale getirilir |
| Oracle'ın app/backend evidence fikri | ✅ temel | Dört katmana ve occurrence correlation'a genişler |
| Bridge APK protocol v1 action set'i | ✅ B1 temel | Cockpit client yazılır; Mobile guard'ları korunur |
| ADB device/logcat/run-as/install yolları | ✅ | Kalıcıdır; SDK veya Bridge'e zorla taşınmaz |

## A.6 Mevcut Cockpit çalışma yolları

| Yüzey | Bugünkü yürütücü | Hedef |
|---|---|---|
| Workflow editor | Node/edge + Maestro odaklı config | Shared typed workflow contract |
| Preview | YAML preview/download | BridgeFlowPlan + operator plan preview |
| Workflow run | `WorkflowRunner` → Maestro YAML → `MaestroExecutor` | Orchestrator → BridgeFlowExecutor |
| App control | VerdictChannel + bazı legacy adlar | VerdictChannel only |
| App events | WS/logcat dual path | Authenticated WS → durable ordered bus |
| UI action | Maestro | Verdict Bridge |
| UI observation | ADB/SDK dump; sınırlı polling | Live Inspector + scoped Bridge query |
| Business oracle | SDK/logcat + backend lane | UI/App/Local/Remote evidence fusion |
| Run persistence | YAML/Maestro output + node result | Plan/occurrence/evidence/recovery modeli |
| Device preparation | ADB reverse + Maestro driver | SDK session + Bridge preflight; Maestro silinir |

## A.7 Doğrulanmış kalite baseline'ı

Denetim anındaki sonuçlar:

| Kontrol | Sonuç |
|---|---|
| `@nesy/control-channels` testleri | 36/36 geçti |
| API testleri | 144 geçti, 25 skip |
| Web testleri | 129/129 geçti |
| Repo/API typecheck | Kırmızı |
| Bağımsız web typecheck | Kırmızı; load-tour generic ve interaction fixture undefined sorunları gözlendi |
| Gerçek PostgreSQL integration | Opt-in; zorunlu CI kanıtı değil |
| Bridge fiziksel DUT matrisi | 3/6; conditional |

Working tree'deki sonradan yapılan düzeltmeler bu tabloyu ancak Faz 0 checkpoint'i
yeniden çalıştırılıp kanıt üretildiğinde değiştirir.

## A.8 Cockpit kapsamına dahil olanlar

- `apps/api` workflow, device, WS, ingest, oracle, artifact ve API servisleri.
- `apps/web` automation editor, Device Lab, Live Inspector, Run Detail ve ilgili BFF yüzeyleri.
- `packages/control-contract` ve `packages/control-channels` entegrasyonu.
- Yeni Bridge ve workflow contract paketleri.
- Prisma modelleri ve additive migration'lar.
- Test harness, fixture, CI gate ve fiziksel cihaz script'leri.
- Field Login, Load Tour ve tam kurye referans workflow'u.
- Diagnostic capture, retention, RBAC ve audit.
- Maestro cutover ve silme.
- Cockpit dokümanlarının SSOT uyumu.

## A.9 Cockpit kritik kapsamının dışında olanlar

- Verdict SDK'nın Mobile iç implementasyonunu Cockpit'ten yeniden yazmak.
- Bridge APK'yı production uygulamasının içine gömmek.
- Nesy backend iş kurallarını değiştirmek.
- Cockpit'in tüm statik Product/Engineering içeriklerini Bridge'e bağlamak.
- ADB logcat, dumpsys, run-as, APK install ve force-stop yeteneklerini kaldırmak.
- Response body capture'ı SDK/Bridge yoluna eklemek.
- SDK içinde `waitEvent` komutu tasarlamak; bekleme host runtime işidir.
- Genel Home/PM/Settings placeholder'larını SDK/Bridge release kapısına sokmak.
- Kalıcı Maestro fallback bırakmak.

---

# BÖLÜM B — HEDEF MİMARİ VE SÖZLEŞMELER

## B.1 Katman ilkesi — dört düzlem karıştırılmaz

| Düzlem | Sahibi | Ne yapar | Ne yapmaz |
|---|---|---|---|
| **ADB cihaz operasyonu** | DeviceWorker/host | discovery, install, reverse/forward, logcat, dumpsys, run-as, force-stop | Business karar veya semantic tap yapmaz |
| **SDK kontrol** | VerdictChannel | set/end run, seed, navigate, state, request key, named safe operation | Ekrana fiziksel dokunmaz |
| **SDK event** | Authenticated WS + durable bus | event, heartbeat, gap, replay, app evidence | Workflow dalı seçmez, UI aksiyonu yapmaz |
| **Accessibility Bridge** | BridgeClient + Bridge APK | find/dump/wait/tap/input/swipe/back/screenshot | Business oracle veya backend doğrulaması yapmaz |

**Bağlayıcı cümle:** Bridge görür ve dokunur; SDK içeride ne olduğunu bildirir;
Cockpit planlar ve karar verir; ADB cihazı işletir.

## B.2 Hedef bileşen topolojisi

```text
apps/web
  Automation Editor
  Plan Preview
  Device Lab
  Live Inspector
  Run Detail / Evidence Drawer
        |
        v
apps/api
  Workflow API / Run Orchestrator
  RunSessionRegistry ---- Verdict WS Auth Host
  BridgeDeviceManager --- BridgeClient
  ConditionEngine ------- BridgeFlowCompiler
  BridgeFlowExecutor ---- Durable Event Bus
  OracleEngine ---------- Local/Remote Validators
  ArtifactService ------- DiagnosticCapturePolicy
        |
        +---- packages/workflow-contract
        +---- packages/bridge-contract
        +---- packages/bridge-client
        +---- packages/control-contract
        +---- packages/control-channels
        +---- packages/db
```

## B.3 Yeni ve değişecek package sınırları

### `packages/bridge-contract`

- Protocol version.
- Command ve response discriminated union'ları.
- Runtime schema validation.
- DumpScope, selector, node, bounds ve collection tipleri.
- Capability manifest.
- Error taxonomy.
- Golden request/response fixture'ları.
- Secret veya socket yönetmez.

### `packages/bridge-client`

- TCP/NDJSON transport.
- Per-connection handshake.
- Request correlation ve timeout.
- Idempotent retry.
- Cancellation/reconnect.
- Screenshot decode/artifact seam.
- Metrics ve redacted logs.
- Workflow kararı vermez.

### `packages/workflow-contract`

- Editor node config tipleri.
- Workflow IR v2.
- BridgeFlowPlan.
- Completion/evidence policy.
- Condition AST.
- Capability requirement.
- Version ve migration helper'ları.
- API/Web arasındaki duplicate type'ların tek kaynağı.

### `apps/api`

- Güvenlik ve secret sahipliği.
- Compiler ve executor.
- Device worker lifecycle.
- Durable event subscription.
- Oracle, persistence ve server-side validation.

### `apps/web`

- Yalnız authoring, gözlem, operatör aksiyonu ve sonuç sunumu.
- Kendi compiler'ını veya YAML fallback'ini çalıştırmaz.

## B.4 Run session ve mutual-HMAC sözleşmesi

Run güven kökü host'ta doğar.

```text
create run
  -> random 32-byte secret
  -> RunSecretRegistry.register(runId, deviceId, appId, expiry)
  -> VerdictChannel.set_run(same secret)
  -> SDK opens WS and sends signed reduced hello
  -> host verifies app->host signature + run/device binding + skew + nonce
  -> host sends host->app counter-signature
  -> both sides mark socket authenticated
  -> hello_full / gap / replay / event / heartbeat
  -> durable commit
  -> ACK
  -> end_run / rotate / zero secret
```

### Zorunlu invariants

- Registry secret'ın tek host sahibidir.
- `broadcastSetRun` kendi başına kayıtsız secret üretmez.
- Secret DB'ye plain text yazılmaz.
- Authentication öncesi reduced hello dışında metadata kabul edilmez.
- Authentication öncesi event/gap/heartbeat/ACK yoktur.
- Run, device ve app binding zorunludur.
- Nonce tek kullanımlıdır.
- Beş saniye auth timeout uygulanır.
- Rotation eski socket'i geçersiz kılar.
- `end_run` secret'ı ve session binding'i temizler.
- Log/artifact/error mesajı secret içermez.

## B.5 Durable event pipeline sözleşmesi

```text
SDK WAL
  -> authenticated WS frame
  -> validate protocol/auth/stream
  -> DB transaction: inbox/gap/stream contiguous state
  -> COMMIT
  -> event_ack/gap_ack
  -> ordered stream consumer lease
  -> durable event bus
  -> run-scoped waitEvent + Oracle + diagnostics subscribers
  -> processed_at
```

### Invariants

- ACK commit'ten önce gönderilmez.
- Aynı `(runId, sessionId, seq)` idempotency anahtarıdır.
- Aynı stream'de seq sırası bozulmaz.
- Gap çözülmeden contiguous cursor körlemesine ilerlemez.
- Consumer crash olduğunda işlenmemiş row kalır.
- Subscriber başarısızlığı row'u sessizce processed yapmaz.
- Poison event retry bütçesinden sonra görünür dead-letter durumuna geçer.
- `waitEvent` SDK komutu değildir; host subscription'dır.
- Heartbeat test event'i veya WAL event'i değildir; liveness kanalında işlenir.
- Synchronous sink yalnız karşılaştırmalı geçişte bulunabilir.

## B.6 Bridge bağlantı ve port sözleşmesi

| Kanal | Yön | Device port | Host port |
|---|---|---:|---:|
| SDK event WS | device → host, `adb reverse` | 8765 | 8765/shared host server |
| Verdict Bridge TCP | host → device, `adb forward` | 9876 sabit | device başına dinamik lease |

Bridge cihazda yalnız loopback `127.0.0.1:9876` dinler. Çoklu cihazda host
portu device serial bazında ayrılır. Port collision sessiz fallback yapmaz.

### BridgeClient connection state

```text
DISCONNECTED
  -> FORWARD_READY
  -> TCP_CONNECTED
  -> HANDSHAKING
  -> READY
  -> DEGRADED | RECONNECTING | CLOSED
```

READY olmadan action gönderilmez. Yeni TCP bağlantısı yeni handshake yapar.

## B.7 Bridge command sözleşmesi

Desteklenecek v1 yüzeyi:

- `handshake`
- `ping`
- `dump`
- `find_id`
- `find_text`
- `tap_id`
- `tap_text`
- `input_text`
- `swipe`
- `back`
- `screenshot`
- `activate_id`
- `collection_info`
- `scroll_to_item`
- `wait_node`

### Zorunlu kurallar

- Her command unique `requestId` taşır.
- Mutating retry aynı payload + aynı requestId ile yapılır.
- Aynı requestId farklı payload ile kullanılırsa conflict'tir.
- DumpScope zorunludur; sessiz full fallback yoktur.
- Riskli action mümkünse fresh `treeGen`/`expectTreeGen` taşır.
- Ambiguous selector tap üretmez.
- `visible=false` veya foreign `obscuredBy` action'ı politikaya göre fail/retry eder.
- Timeout, TCP kopması ve unknown effect ayrı hata sınıflarıdır.
- Run fencing Mobile B1 tamamlanınca her command'da doğrulanır.

## B.8 Run state machine

```text
PENDING
  -> QUEUED
  -> PREFLIGHT
  -> AUTHENTICATING
  -> COMPILING
  -> RUNNING
  -> WAITING_EVIDENCE
  -> SUCCEEDED | FAILED | CANCELLED | NEEDS_ATTENTION
  -> CLEANING_UP
  -> CLOSED
```

Ek recovery state'leri:

- `RECOVERING_HOST`
- `RECOVERING_BRIDGE`
- `RECOVERING_DEVICE`
- `UNKNOWN_ACTION_EFFECT`
- `STUCK`

State transition atomik ve audit edilebilir olmalıdır. Process restart sonrası
DB state'i üzerinden devam edilir; yalnız bellek içi run state'i kaynak değildir.

## B.9 Workflow IR v2

```ts
type IRStep =
  | SdkCommandStep
  | BridgeActionStep
  | WaitNodeStep
  | WaitEventStep
  | AssertUiStep
  | AssertAppStep
  | AssertLocalStep
  | AssertRemoteStep
  | ConditionStep
  | ForEachStep
  | ServerStep
  | CaptureStep
  | CleanupStep;
```

Her step en az şunları taşır:

- `planStepId`
- `sourceNodeId`
- `kind`
- `timeout`
- `retryPolicy`
- `idempotencyClass`
- `capabilityRequirements`
- `completionPolicy`
- `evidenceRequirements`
- `artifactPolicy`
- `redactionPolicy`

Runtime'da ayrıca:

- `occurrenceId`
- `iterationPath`
- `attempt`
- `requestId`
- `startedMonoTs`
- `completedMonoTs`

üretilir.

## B.10 Condition Engine sözleşmesi

Condition expression serbest JavaScript değildir. Typed AST kullanır.

### Operand kaynakları

- `run.input.*`
- `device.capability.*`
- `sdk.state.*`
- `sdk.event.*`
- `bridge.node.*`
- `bridge.visible`
- `bridge.obscuredBy`
- `step.output.*`
- `loop.item.*`
- `local.result.*`
- `remote.result.*`
- `environment`
- `country`

### Sonuç

- `TRUE`
- `FALSE`
- `UNKNOWN`

`UNKNOWN` için açık politika gerekir: fail, retry, branch veya operator attention.
Her condition kararı operand snapshot ve kaynak kanıtıyla persist edilir.

## B.11 BridgeFlowPlan ve compiler

Compiler:

1. Workflow version + run input alır.
2. Shared contract ile doğrular.
3. Compile-time condition'ları çözer.
4. Runtime probe sözleşmesini planlar.
5. Loop ve branch sınırlarını doğrular.
6. Capability manifest üretir.
7. Completion/evidence politikalarını bağlar.
8. Deterministik plan ve hash üretir.

Compiler cihazda action çalıştırmaz. Preflight'a ihtiyaç duyduğu capability ve
runtime probe listesini verir.

## B.12 Dört katmanlı evidence modeli

| Katman | Kaynak | Örnek |
|---|---|---|
| UI | Bridge | Node görünür, engellenmemiş, action applied, tree değişti |
| App | SDK event/state | DELIVERY_STARTED, SCREEN_READY, state field |
| Local | Host ADB/run-as veya safe provider | SQLite queue/entity durumu |
| Remote | Backend verifier | Request/response ve server entity durumu |

Completion policy örnekleri:

- `UI_ONLY`
- `UI_AND_APP`
- `APP_AND_REMOTE`
- `UI_AND_LOCAL_AND_REMOTE`
- `QUEUE_OFFLINE_ACCEPTED`
- `ANY_OF`
- `ALL_OF`

Ekranın yeşil görünmesi tek başına business success sayılmaz.

## B.13 Veri modeli hedefi

### Run alanları

- engine type
- plan version/hash/compiled plan
- workflow contract version
- SDK/control contract version
- Bridge protocol/app version
- capability snapshot
- run/session/epoch
- auth state
- last seq/ACK/gap
- recovery/cancel/cleanup state
- artifact manifest
- security/audit references

### Step occurrence alanları

- source node, compiled step, occurrence ve iteration
- attempt/requestId
- selector/treeGen
- monotonic ve wall timestamps
- action/result/error taxonomy
- UI/App/Local/Remote evidence refs
- condition/dialog decision
- retry/cancel/recovery bilgisi

Migration additive yapılır. Eski Maestro run'ları read-only render edilir.

## B.14 Cockpit UI hedefi

### Automation Editor

- Typed node forms.
- Selector Builder.
- Condition builder.
- Completion/evidence policy.
- Retry/timeout.
- FOR_EACH ve dialog policy.
- Capability validation.
- BridgeFlow Plan Preview.

### Live Inspector

- Observe ve Act modu.
- Screenshot + semantic overlay.
- Scoped query.
- Node detail.
- Fresh tree action guard.
- Selector'a dönüştürme.
- Production read-only policy.

### Run Detail

- UI/App/Local/Remote rozetleri.
- Occurrence/iteration timeline.
- Event sequence ve ACK/gap görünümü.
- Condition/dialog kararları.
- Retry/recovery.
- Copy repro paketi.

### Device Lab

Tek “Bridge” etiketi yerine:

- ADB Host
- SDK Control
- SDK Event/Auth
- Durable Ingest
- Accessibility Bridge
- Backend Credentials
- Local DB Access
- Active Run

---

# BÖLÜM C — BAĞLAYICI KARARLAR VE YAPILMAYACAKLAR

## C.1 SDK'ya tap/scroll/input eklenmeyecek

Fiziksel/görsel UI eylemi Verdict Bridge'in sorumluluğudur. SDK control operation
olarak tap eklemek güvenlik sınırını ve test semantiğini bozar.

## C.2 ADB kaldırılmayacak

ADB şu işler için kalıcıdır:

- Device discovery ve metadata.
- `adb reverse` / `adb forward`.
- Logcat.
- Dumpsys.
- `run-as` dosya/DB kopyası.
- APK install.
- Force-stop/cold-start.
- Power, thermal ve sistem ölçümü.

## C.3 Database Access `sql_named` ile değiştirilmeyecek

Cockpit Database Access host'a kopyalanan DB'yi inceler. SDK named-query başka
bir güvenlik ve ürün yüzeyidir. İkisi birbirinin yerine geçirilmez.

## C.4 Bridge production cihaza kurulmayacak

Bridge lab-only uygulamadır. Production device veya production allowlist dışı
device üzerinde Act Mode fail-closed olur.

## C.5 Sessiz Maestro fallback olmayacak

Bridge preflight, compiler veya executor hatasında run Maestro'ya düşmez. Açık
hata kodu üretir. Maestro yalnız ölçümlü geçiş boyunca bilinçli dual-run'da yaşar.

## C.6 Kalıcı YAML execution artifact'i olmayacak

YAML preview, download ve local fallback geçiş sonunda silinir. Kalıcı execution
artifact'i versioned `BridgeFlowPlan` JSON'dur.

## C.7 Hot path'te full dump olmayacak

Tek node aramak için match/find, dialog için subtree, sınırlı keşif için depth
kullanılır. Full yalnız Inspector veya bilinmeyen hata artifact'i için bilinçli
ve ölçülü çalışır.

## C.8 Ambiguous selector ile dokunulmayacak

Birden çok eşleşme varsa compiler/runtime action üretmez. Row index, parent
scope, ID veya ek predicate ister.

## C.9 Bayat ağaçla action yapılmayacak

Riskli action fresh tree snapshot'a ve mümkünse `expectTreeGen` guard'ına bağlanır.
Stale-tree yeni probe gerektirir; kör retry yapılmaz.

## C.10 Condition için `eval` kullanılmayacak

Expression string doğrudan kod olarak çalıştırılmaz. Typed AST ve allowlisted
operator kullanılır.

## C.11 Node type event correlation anahtarı olmayacak

Aynı tipte veya loop içindeki node'lar için event yalnız type adıyla dağıtılmaz.
Occurrence/iteration/correlation anahtarı zorunludur.

## C.12 Secret ve PIN hiçbir artifact'te bulunmayacak

- argv yok.
- Plain DB yok.
- Structured log yok.
- Screenshot annotation yok.
- Copy repro'da değer yok.
- Error detail'de yok.

## C.13 UI kendi compiler'ını çalıştırmayacak

Web local YAML/plan generator fallback'i tutulmaz. Preview ve execution aynı API
compiler'ından beslenir; aksi halde preview/execution drift oluşur.

## C.14 `waitEvent` SDK komutu olmayacak

Event bekleme durable host event bus subscription'ıdır. SDK thread/coroutine
tutan bir bekleme komutu edinmez.

## C.15 Response body capture eklenmeyecek

Network body kopyalama performans ve hassas veri riski taşır. Mevcut host/logcat
ve header/status/byte ölçümleri yeterli kabul edilir; özel ihtiyaç ayrı güvenlik
kararı gerektirir.

## C.16 Bilinmeyen dialog sessizce kapatılmayacak

Unknown dialog davranışı: STOP, screenshot, scoped dump, policy/audit kaydı.

## C.17 Tek “Bridge connected” durumu kullanılmayacak

ADB, SDK Control, SDK Event ve Accessibility Bridge farklı sağlık durumlarıdır.

## C.18 Eski run verisi silinmeyecek

Migration additive olur. Eski Maestro run'ları read-only görünür; yeni runtime
eski alanlara bağımlı olmaz.

## C.19 General product-shell işi kritik runtime yoluna karıştırılmayacak

Home, PM, Settings ve statik içerik borçları ayrıca izlenir. Bunlar SDK/Bridge
güvenlik ve correctness kapılarını geciktirecek şekilde aynı faza konmaz.

---

# BÖLÜM D — TAM İŞ ENVANTERİ

## D.1 Secure Run Session ve WS Authentication

### Yapılacaklar

1. `RunSecretRegistry` interface ve production implementasyonu.
2. Secret üretme, sahiplik, expiry, rotation ve zeroization.
3. `runId + deviceId + appId` binding.
4. Session açıldığında `sessionId` binding.
5. `broadcastSetRun` API'sinin registry tarafından üretilen secret'ı zorunlu alması.
6. `hello` frame parser ve schema validation.
7. `app->host` canonical HMAC doğrulaması.
8. `host->app` counter-signature frame'i.
9. Per-socket auth state machine.
10. 5 saniye timeout.
11. Pre-auth metadata/event/heartbeat/gap/ACK yasağı.
12. Nonce replay cache ve timestamp skew.
13. Rotation'da eski socket'in kapanması.
14. `end_run` cleanup.
15. Metrics: accepted/rejected/timeout/replay/skew/unknown-run.
16. Secret redaction testleri.
17. Fake host ve fake client adversarial suite.
18. Çoklu cihaz/run isolation testi.

### Teslimatlar

- `apps/api/src/services/run-secret-registry.ts`
- `apps/api/src/services/verdict-ws-auth.ts`
- TestEventWsServer auth entegrasyonu.
- Auth fixture ve contract testleri.
- Device checkpoint kanıtı.

## D.2 Durable Event Runtime

### Yapılacaklar

1. Ordered consumer callback'i gerçek event bus'a bağlamak.
2. Stream lease/advisory lock davranışını doğrulamak.
3. Burst nudge coalescing.
4. `processed_at`, attempt, last error ve retry schedule.
5. Poison row ve dead-letter görünürlüğü.
6. Consumer lag ve oldest-unprocessed metriği.
7. `DurableEventBus.subscribe(run/session/filter)` API'si.
8. `waitEvent` timeout/cancel/recovery.
9. Oracle ve diagnostics subscriber'ları.
10. Process restart bootstrap scan.
11. Late event ve closed run politikası.
12. Gap sırasında subscriber davranışı.
13. Sync-vs-durable comparison mode.
14. Eşitlik gate'i sonrası sync sink kaldırma.
15. DB unavailable olduğunda açık NO_GO; ACK yok.
16. WAL release ve ACK evidence UI verisi.

### Not

Working tree'de durable row'u aynı sink seam'ine veren consumer geliştirmesi
başlamıştır. Bu plan o işi kabul edilmiş saymaz; restart, poison row, subscriber,
auth ve sync-cutover kriterleri tamamlanmalıdır.

## D.3 Bridge Contract

### Yapılacaklar

1. Tüm protocol v1 command ve response şemalarını çıkarmak.
2. Exact wire fixtures'i Mobile Bridge ile eşlemek.
3. Unknown additive field toleransı.
4. Protocol mismatch fail-fast.
5. `DumpScope` union.
6. Selector union.
7. Node/bounds/window/collection modeli.
8. `visible`, `obscuredBy`, `treeGen` modeli.
9. Action settlement ve contamination metadata.
10. Error taxonomy.
11. Capability manifest.
12. Schema fuzz/property testleri.

## D.4 BridgeClient ve Device Gate

### Client

1. NDJSON incremental parser; partial/multi-line frame.
2. Line/frame size limit.
3. TCP lifecycle ve handshake.
4. Pending request map.
5. Timeout ve AbortSignal.
6. Same-requestId idempotent retry.
7. Unknown-effect sınıflandırması.
8. Connection loss recovery.
9. Screenshot decode ve artifact stream.
10. Metrics/redacted logging.

### Device gate

1. Lab device allowlist.
2. Production deny.
3. Package installed check.
4. Version/hash/protocol check.
5. Accessibility service enabled check.
6. Mevcut enabled-service listesini koruyan enable prosedürü.
7. Device `9876` listen/bind kontrolü.
8. Per-device host port allocator.
9. `adb forward --no-rebind` ve stale lease cleanup.
10. Handshake/ping/capability check.
11. Battery optimization/freecess/foreground tanısı.
12. DeviceWorker dispose'da socket/forward cleanup.
13. UI sağlık durumu.
14. Preflight failure reason/action önerisi.

## D.5 Shared Workflow Contract ve IR v2

1. Web ve API duplicate workflow tiplerini tek pakete taşımak.
2. Versioned node config migration.
3. Step union'larını tanımlamak.
4. Completion/evidence policy.
5. Retry ve timeout policy.
6. Idempotency class.
7. Capability requirement.
8. Artifact/redaction policy.
9. Source map.
10. Occurrence/iteration model.
11. Validation error path ve editor mapping.
12. Eski workflow version reader/migrator.

## D.6 Condition Engine

1. Typed AST ve operator allowlist.
2. Parser/serializer.
3. Compile-time resolver.
4. Runtime evaluator.
5. `TRUE/FALSE/UNKNOWN` semantiği.
6. Operand source adapter'ları.
7. Missing/invalid value politikası.
8. Evidence snapshot.
9. Short-circuit'in audit edilebilirliği.
10. FOR_EACH item/index scope.
11. Max iteration/nesting/time.
12. Switch ve branch coverage validation.
13. Property/fuzz testleri.

## D.7 BridgeFlowCompiler

1. Workflow graph validation.
2. Deterministik traversal.
3. Compile-time branch resolution.
4. Runtime condition step üretimi.
5. Macro expansion.
6. FOR_EACH planı.
7. SDK command step üretimi.
8. Bridge action/wait step üretimi.
9. Host server/local/remote step üretimi.
10. Dialog policy injection.
11. Cleanup planı.
12. Capability manifest.
13. Unsupported node error.
14. Ambiguous selector error.
15. Unbounded loop/wait error.
16. Unsafe retry error.
17. Full-dump hot-path warning/error.
18. Missing evidence policy error.
19. Plan version/hash.
20. Human-readable preview DTO.

## D.8 BridgeFlowExecutor

1. Run lease ve DeviceWorker queue entegrasyonu.
2. Preflight orchestration.
3. SDK session/auth bekleme.
4. Bridge READY bekleme.
5. Step state machine.
6. Per-attempt requestId.
7. Idempotency-aware retry.
8. Bridge command dispatch.
9. SDK command dispatch/get_command_result.
10. Durable waitEvent.
11. Local/remote server step.
12. Runtime condition ve loop.
13. Cancellation.
14. Process restart recovery.
15. Bridge reconnect recovery.
16. Unknown action effect handling.
17. Heartbeat/stuck run.
18. Cleanup/end_run/secret/socket/forward/subscriber release.
19. Per-step metrics.
20. Artifact manifest finalization.

## D.9 Oracle Engine v2

1. Evidence key: run/session/epoch/occurrence/iteration.
2. UI evidence adapter.
3. SDK durable event adapter.
4. SDK state adapter.
5. Local DB adapter.
6. Remote backend adapter.
7. Completion policy evaluator.
8. Pending/partial/pass/fail/unknown states.
9. QUEUE_OFFLINE semantic state.
10. Missing-event root cause sınıflandırması.
11. Duplicate/replayed evidence idempotency.
12. Late evidence policy.
13. Common monotonic timeline.
14. Backend/Bridge/SDK clock anchor metadata.
15. Repeated node ve loop testleri.
16. Final verdict explanation DTO.

## D.10 Persistence ve API

1. Additive Prisma migration.
2. Engine type ve plan alanları.
3. Protocol/capability snapshot.
4. Run/session/epoch/auth state.
5. Step occurrence tablosu veya mevcut tablonun güvenli genişletilmesi.
6. Attempt ve request correlation.
7. Evidence ve artifact ilişkileri.
8. Condition/dialog decisions.
9. Recovery/cancel/cleanup markers.
10. Event subscription/checkpoint state.
11. Audit ilişkileri.
12. Retention/purge state.
13. Eski Maestro run read model.
14. API DTO versioning.
15. Pagination ve büyük artifact ayrımı.

## D.11 Automation Editor

1. Shared contract formları.
2. SDK Command node.
3. Bridge action node'ları.
4. Wait Node/Event.
5. UI/App/Local/Remote assertion node'ları.
6. FOR_EACH.
7. Switch/Condition.
8. Retry Boundary.
9. Dialog Policy.
10. Capture/Cleanup.
11. Selector Builder.
12. Timeout/retry/idempotency UI.
13. Evidence completion UI.
14. Capability warnings.
15. Compile errors'i canvas node'una bağlama.
16. Plan preview.
17. YAML/Maestro dilini deprecate etme ve silme.
18. Web local compiler fallback'ini silme.

## D.12 Live Inspector

1. Observe/Act permission separation.
2. Screenshot viewport.
3. Semantic node overlay.
4. Scale/orientation/inset coordinate mapping.
5. Scoped dump/find.
6. Node details.
7. Visibility/obscuration.
8. Collection/row context.
9. treeGen freshness.
10. Guarded tap/input/swipe/back/scroll.
11. Ambiguity UI.
12. Selector'a dönüştürme.
13. Screenshot/dump artifact.
14. Production read-only.
15. Audit.
16. Polling/backpressure ve disconnected state.

## D.13 Device Lab ve Operational Readiness

1. ADB status.
2. SDK Control capability.
3. SDK Event authentication/liveness.
4. Durable ingest/consumer health.
5. Bridge install/enable/handshake/capability.
6. Backend credentials.
7. Local DB access.
8. Active run/session/epoch.
9. Last event/ACK/gap/WAL.
10. Bridge latency/error/stale tree.
11. Tek tıkla güvenli re-preflight.
12. Action gerektiren hata önerileri.

## D.14 Field Login, Load Tour ve Referans Kurye Akışı

1. Özel Maestro orchestrator'ları kaldırmadan önce ortak workflow'a taşımak.
2. Setup seed login ile gerçek UI login semantiğini ayırmak.
3. Route selection.
4. Stop list readiness.
5. 20 barcode FOR_EACH.
6. Delivery/pickup action'ları.
7. Local queue evidence.
8. QUEUE_OFFLINE accepted policy.
9. Backend confirmation.
10. Bilinen dialog policy.
11. Unknown dialog STOP + screenshot + scoped dump.
12. Run cleanup.
13. Golden input/expected evidence fixture.

## D.15 Run Detail ve Repro

1. UI/App/Local/Remote badge'leri.
2. Step occurrence ve iteration tree.
3. Attempt/retry timeline.
4. RequestId/selector/treeGen görünümü.
5. Event seq/ACK/gap timeline.
6. Missing-event sınıflandırması.
7. Condition operand snapshot.
8. Dialog decision.
9. Artifact gallery.
10. Copy repro paketi:
    - plan hash
    - device/capability
    - redacted command
    - selector
    - requestId
    - run/session/epoch
    - scoped dump/screenshot ref
    - expected/actual evidence

## D.16 Diagnostics, Metrics ve Retention

1. Durable diagnostic subscriber.
2. CapturePolicy Engine.
3. D1/D2/D3 escalation.
4. Cooldown/quota/critical-span guard.
5. Disk preflight.
6. Mapping/symbolization.
7. Sensitive artifact class.
8. 24 saat purge ve configurable retention.
9. D3 explicit approval ve role.
10. Capture audit success/skip/failure.
11. SDK auth/seq/ACK/gap/WAL metrics.
12. Bridge latency/error/dump/stale/ambiguity/contamination metrics.
13. Executor step/retry/recovery/stuck metrics.
14. Dashboard ve alert threshold.

## D.17 Güvenlik ve RBAC

1. Lab device allowlist.
2. Environment policy.
3. Observe/Act ayrı permission.
4. APK install/force-stop/seed/local-write/D3 role'leri.
5. Actor/device/run/command/result audit.
6. Secret/PIN/token redaction.
7. Artifact access ve download audit.
8. Arbitrary shell UI yasağı.
9. Screenshot/dump PII policy.
10. Fake host/replay/skew/rotation adversarial testleri.
11. Bridge response/frame fuzz.
12. Dependency/security scan ve threat model.

## D.18 Bridge B1 fiziksel blokajları

➜ Mobile/Bridge ile ortak işler:

1. Her Bridge command'a `runId`, `sessionId`, `epoch` fencing.
2. Eski veya başka run command'ını fail-closed reddetmek.
3. Bridge process death boyunca duplicate action politikasını tanımlamak.
4. Host reconnect/forward EOF davranışını çözmek.
5. IME obstruction DUT testi.
6. Foreign window obstruction DUT testi.
7. Manual touch contamination DUT testi.
8. Same-app z-order.
9. `SCREEN_READY` invalidation.
10. Workflow-lifetime WakeLock ve thermal etkisi.

## D.19 Maestro Ölçümü ve DELETE

1. Golden workflow listesi.
2. Aynı input/device/build ile Maestro ve BridgeFlow run.
3. Correctness karşılaştırması.
4. False-pass/false-fail.
5. Run duration ve step latency.
6. Ambiguity/obstruction davranışı.
7. Event correlation ve artifact completeness.
8. Recovery/cancel.
9. Cutover kararı ve kayıt.
10. `maestro-executor` silme.
11. DeviceWorker driver preinstall silme.
12. YAML execution/preview/download silme.
13. Maestro CLI/dependency/script silme.
14. UI metinleri silme.
15. Field flow özel Maestro yolları silme.
16. Yeni run DB yazımından Maestro alanlarını kaldırma.
17. Eski run renderer'ını read-only bırakma.
18. Repo-wide zero-reference gate.

## D.20 Product-shell borcu — ayrı backlog

SDK/Bridge platformu dışında:

- `home/*` dokuz placeholder route.
- `engineering/screen-manual` zayıf/placeholder.
- Settings dropdown var, route yok.
- PM Calendar boş hero.
- Roadmap boş hero.
- Bazı nav/page drift'leri.

Bu kalemler envanterde tutulur fakat Faz 0–8 correctness/security gate'lerini
bloke etmez. Faz 9 sonunda ayrı ürün roadmap'ine atanır.

---

# BÖLÜM E — FAZLAR VE CHECKPOINT'LER

## FAZ 0 — Doğrulanabilir Baseline ve SSOT

### Amaç

Cockpit geliştirmesinin ilerlemesini ölçebilecek temiz, tekrarlanabilir ve
tek-kaynaklı bir başlangıç noktası kurmak.

### Neden ilk sırada

Typecheck kırıkken veya DB/physical testler skip iken yeni Bridge runtime'ın
regresyonunu eski borçtan ayırmak mümkün değildir. Eski dokümanlar da mevcut
VerdictChannel durumunu yanlış anlattığı için iş envanteri sapabilir.

### Yapılacaklar

1. API ve web typecheck hatalarını kapat.
2. Checkpoint script'lerini production API `tsconfig` rootDir'ından ayır.
3. Workspace package import'larını public export üzerinden yap.
4. Secret nominal type duplicate'ini kaldır.
5. CP2 checkpoint strict undefined sorunlarını kapat.
6. Gerçek PostgreSQL test job'u oluştur.
7. Migration deploy + ingest integration'ı zorunlu yap.
8. Unit/integration/device test sınıflarını ayrı raporla.
9. `verdict-status.json` snapshot/reader ekle; elle kopyalanmış status azalt.
10. Eski Cockpit planındaki VerdictChannel/detectChannel/legacy drift'ini işaretle.
11. Bridge v1 wire fixture'larını pinle.
12. Tam kurye golden workflow/input/evidence fixture'ını tanımla.
13. Baseline performans ölçümlerini kaydet:
    - WS ingest/ACK latency
    - consumer latency
    - Bridge command latency
    - scoped dump maliyeti
    - workflow duration
14. Dirty worktree/branch state'ini checkpoint artifact'inde kaydet.

### CHECKPOINT 0

- `pnpm typecheck` yeşil.
- API ve web typecheck bağımsız yeşil.
- Control-channel, API ve web unit suite'leri yeşil.
- PostgreSQL ingest integration CI'da koşmuş ve yeşil.
- Skip edilen her test gerekçe/owner/gate taşır.
- Cockpit durum tablosu Mobile SSOT ile çelişmiyor.
- Bridge/workflow fixture hash'i kaydedilmiş.
- Hiçbir kullanıcı değişikliği plan çalışması tarafından ezilmemiş.

**Checkpoint 0 geçmeden:** auth cutover, sync sink silme veya Maestro kapatma yok.

## FAZ 1 — Güvenli SDK Session ve WebSocket Authentication

### Amaç

Mobile SDK'nın mutual-HMAC sözleşmesini production Cockpit WS host'ta tam ve
fail-closed uygulamak.

### Neden bu sırada

Kimliksiz event kabul eden veya authenticated socket kuramayan host üzerinde
durability/oracle doğruluğu anlamsızdır.

### Yapılacaklar

1. D.1 işlerinin tamamı.
2. Registry ve WS auth state machine için unit suite.
3. Mobile canonical HMAC fixture karşılaştırması.
4. TestEventWsServer connection handler'ını auth gate'ine bağlama.
5. Event/gap/heartbeat route'unu authenticated state arkasına alma.
6. ACK send yolunu aynı gate'e alma.
7. DeviceWorker run session kurulumu.
8. Run cancel/end cleanup.
9. Multi-device ve overlapping run testi.
10. Secret sızıntı taraması.

### CHECKPOINT 1

- Gerçek SDK `hello` imzası host tarafından doğrulanıyor.
- Host counter-signature SDK tarafından kabul ediliyor.
- Beş saniye sonra unauth socket kapanıyor.
- Kimliksiz peer 0 event ve 0 identifying metadata görüyor.
- Fake `event_ack` veya `gap_ack` WAL state'ini değiştiremiyor.
- Replay nonce ve clock skew reddediliyor.
- Run rotation eski socket/secret'ı geçersiz kılıyor.
- Secret log/DB/artifact/argv'de bulunmuyor.
- Aynı hostta iki cihaz/run birbirine bağlanamıyor.
- Real-device authenticated WS vertical slice yeşil.

## FAZ 2 — Durable Event Runtime ve Host waitEvent

### Amaç

Durable kabul edilen event'in restart sonrası dahi sıralı, idempotent ve
gözlemlenebilir biçimde oracle/workflow'a ulaşmasını sağlamak.

### Neden bu sırada

BridgeFlowExecutor event bekleyecektir. Kalıcı subscriber olmadan executor
process yaşamına ve synchronous sink'e bağlı kalır.

### Yapılacaklar

1. D.2 işlerinin tamamı.
2. Fan-out consumer'ı DurableEventBus'a bağla.
3. Oracle adapter'ını sync ve durable paralel çalıştır.
4. Event equality/correlation report üret.
5. Restart bootstrap scanner.
6. Consumer lag health endpoint'i.
7. `waitEvent` filter/cancel/timeout API'si.
8. Closed-run late event policy.
9. Poison event admin görünürlüğü.
10. Sync sink disable feature flag ve rollback prosedürü.

### CHECKPOINT 2

- Event DB commit edilmeden ACK yok.
- Process commit sonrası öldüğünde event restart'ta işleniyor.
- Duplicate event tek logical evidence üretiyor.
- Burst sonunda unprocessed tail kalmıyor.
- Seq sırası korunuyor; gap körlemesine aşılmıyor.
- `waitEvent` process restart sonrası tamamlanabiliyor.
- Subscriber cancel memory/lease sızıntısı bırakmıyor.
- Poison row görünür ve cursor sessizce atlamıyor.
- Sync ve durable oracle sonucu golden suite'te eşit.
- Flag ile synchronous oracle yolu kapalıyken suite yeşil.

**Checkpoint 2 sonrası:** synchronous sink production yolundan kaldırılabilir;
rollback yalnız açık feature flag ile ve süreli olabilir.

## FAZ 3 — Bridge Host Client ve Device Preflight

### Amaç

Cockpit'in Verdict Bridge protocol v1 ile güvenli ve typed biçimde konuşmasını,
çoklu cihazı hazırlamasını ve lab-only politikasını zorlamasını sağlamak.

### Neden bu sırada

Compiler/executor, doğrulanmış bir action primitive'i olmadan tasarlanmamalıdır.

### Yapılacaklar

1. D.3 ve D.4 işlerinin tamamı.
2. Fake TCP Bridge server test harness.
3. Mobile Bridge fixture parity.
4. DeviceWorker BridgeDeviceManager entegrasyonu.
5. Dinamik host port lease store.
6. UI readiness DTO.
7. Gerçek DUT smoke script.
8. Bridge process kill/reconnect testi.
9. Screenshot artifact ve redaction.
10. Production deny testi.

### CHECKPOINT 3

- Protocol fixture parity yeşil.
- Partial/multiple/malformed/oversized NDJSON frame testleri yeşil.
- Her yeni connection handshake yapıyor.
- Aynı requestId aynı action'ı fiziksel olarak bir kez uyguluyor.
- Farklı payload aynı requestId ile conflict.
- Scoped dump eksikse full'a düşmeden fail.
- Ambiguous selector tap yapmıyor.
- Stale tree action yapmadan reddediliyor.
- Screenshot artifact oluşuyor ve hassas log sızmıyor.
- İki cihaz aynı anda farklı host portlarıyla READY.
- Production device Act Mode kesin reddediliyor.
- Gerçek DUT command set smoke'u yeşil.

## FAZ 4 — Workflow IR v2, Condition Engine ve Compiler

### Amaç

Maestro YAML'dan bağımsız, typed, açıklanabilir ve deterministik Cockpit beynini
kurmak.

### Neden bu sırada

Executor'ın hangi adımları çalıştıracağı ve hangi evidence'i bekleyeceği önce
versioned plan sözleşmesiyle sabitlenmelidir.

### Yapılacaklar

1. D.5, D.6 ve D.7 işlerinin tamamı.
2. Eski workflow config migration reader.
3. Golden plan snapshot'ları.
4. Editor compile API.
5. Capability-aware compile errors.
6. Plan hash/source map.
7. Human-readable preview.
8. Tam kurye workflow'unu compile edecek node set'i.

### CHECKPOINT 4

- API ve Web aynı workflow type paketini kullanıyor.
- Aynı workflow/input iki çalışmada aynı plan/hash'i üretiyor.
- Unknown node fail-fast.
- Ambiguous selector compile error.
- Sınırsız loop/wait reddediliyor.
- Non-idempotent unsafe retry reddediliyor.
- Missing evidence policy kritik node'u reddediyor.
- Condition `eval` kullanmıyor; fuzz suite güvenli.
- TRUE/FALSE/UNKNOWN kararları kanıtla persist edilebilir DTO üretiyor.
- 20 barkod FOR_EACH planı doğru iteration scope taşıyor.
- Dialog policy compiled plana ekleniyor.
- Compiler hiçbir cihaz action'ı çalıştırmıyor.

## FAZ 5 — BridgeFlowExecutor, Oracle v2 ve Kalıcılık

### Amaç

Compiled plan'i step-by-step yürütmek; her occurrence'ı kanıt, recovery ve
idempotency bilgisiyle kalıcılaştırmak.

### Neden bu sırada

UI dönüşümünün güvenilir API ve sonuç modeline ihtiyacı vardır. Önce runtime
correctness kurulmalıdır.

### Yapılacaklar

1. D.8, D.9 ve D.10 işlerinin tamamı.
2. WorkflowRunner'ı engine-agnostic orchestrator'a indirgeme.
3. BridgeFlow executor seçimi.
4. Per-step transaction ve lease.
5. Host crash recovery.
6. Bridge reconnect/unknown-effect politikası.
7. Four-layer oracle.
8. Additive DB migration.
9. Eski Maestro read model.
10. API DTO ve pagination.

### CHECKPOINT 5

- Run state transition'ları DB'de atomik.
- Tek cihazda iki run aynı anda action uygulamıyor.
- Aynı editor node'un 20 occurrence'ı ayrı kaydediliyor.
- Process restart completed occurrence'ı tekrar uygulamıyor.
- Unknown physical effect sessiz retry/green üretmiyor.
- UI pass fakat app/remote missing ise completion policy fail/pending veriyor.
- QUEUE_OFFLINE doğru ayrı state üretiyor.
- Event yanlış iteration'a yazılmıyor.
- Cancel cleanup/end_run/secret/socket/subscriber release ediyor.
- Eski Maestro run detail açılmaya devam ediyor.
- Yeni BridgeFlow run `yamlContent/maestroOutput` olmadan tamamlanıyor.

## FAZ 6 — Editor, Live Inspector, Device Lab ve Run Detail

### Amaç

Yeni runtime'ı operatörün anlayacağı ve güvenle kullanacağı ürün yüzeyine
dönüştürmek.

### Neden bu sırada

UI, kabul edilmiş compiler/runtime DTO'larına dayanmalıdır; kendi davranışını
icat etmemelidir.

### Yapılacaklar

1. D.11, D.12, D.13 ve D.15 işlerinin tamamı.
2. YAML preview'ı deprecate et.
3. Plan preview'ı aynı compiler endpoint'ine bağla.
4. Selector Builder + live test.
5. Observe/Act permission.
6. Screenshot overlay coordinate testleri.
7. Run detail evidence drawer.
8. Repro export redaction.
9. Responsive/empty/error/loading/accessibility UI.
10. Eski run rendering compatibility.

### CHECKPOINT 6

- Operatör Maestro/YAML bilmeden workflow oluşturuyor.
- Preview ile executed plan hash'i aynı.
- Compile error doğru canvas node'una bağlanıyor.
- Inspector node overlay orientation/inset ile doğru.
- Ambiguous node UI'da açık ve action disabled.
- Production device Act Mode kapalı.
- Device kartı dört ayrı kanal sağlığını gösteriyor.
- Run detail occurrence/iteration/retry'yi ayırıyor.
- UI/App/Local/Remote evidence açıklanabilir.
- Copy repro secret/PIN/token içermiyor.
- Eski run UI'sı bozulmuyor.

## FAZ 7 — Referans İş Akışları, Diagnostics ve Güvenlik

### Amaç

Platformu gerçek Nesy kurye akışıyla ispatlamak ve operasyon/güvenlik
politikasını tamamlamak.

### Neden bu sırada

Generic runtime gerçek business akışında denenmeden ve artifact politikası
kurulmadan cutover ölçümü yapılamaz.

### Yapılacaklar

1. D.14, D.16 ve D.17 işlerinin tamamı.
2. Field Login'i ortak workflow'a taşı.
3. Load Tour'u ortak workflow'a taşı.
4. Tam kurye golden workflow.
5. 20 barcode loop.
6. Offline/online/backend senaryoları.
7. Dialog policy.
8. D1/D2/D3 capture ve approval.
9. Stuck-run ve alert.
10. PII/artifact retention audit.

### CHECKPOINT 7

- Field Login ve Load Tour özel Maestro orchestrator olmadan çalışıyor.
- Setup login ile gerçek login E2E ayrımı görünür.
- Tam kurye workflow gerçek DUT'ta tamamlanıyor.
- 20 barcode occurrence/evidence doğru.
- Offline queue false failure üretmiyor.
- Backend confirmation doğru node/iteration'a bağlanıyor.
- Unknown dialog STOP + screenshot + scoped dump üretiyor.
- D3 yalnız rol + explicit approval ile çalışıyor.
- Sensitive artifact purge SLA içinde.
- Stuck run heartbeat ve consumer/Bridge health ile sınıflanıyor.
- Audit kaydı actor/device/run/command/result taşıyor, secret taşımıyor.

## FAZ 8 — Bridge B1 Fiziksel Kabul ve Maestro Cutover Gate

### Amaç

Bridge'in OS seviyesindeki arıza modlarını ve BridgeFlow'un Maestro'ya göre
correctness/performansını ölçerek silme izni üretmek.

### Neden bu sırada

Maestro silme geri dönüşü pahalıdır. Fiziksel guard ve measured parity olmadan
yalnız happy-path demo yeterli değildir.

### Yapılacaklar

1. D.18 ve D.19'un ölçüm kısmı.
2. Mobile ile command fencing contract update.
3. Process death duplicate action fixture.
4. IME/foreign-window/manual-touch DUT.
5. Same-app z-order ve SCREEN_READY invalidation.
6. WakeLock/thermal ölçümü.
7. Golden runner dual-run.
8. False-pass/fail ve artifact karşılaştırması.
9. Cutover raporu ve imzalı karar.

### CHECKPOINT 8

- Her command run/session/epoch fenced.
- Eski/cross-run command action uygulamadan reddediliyor.
- Process death duplicate physical action üretmiyor veya açık unknown-effect ile duruyor.
- IME obstruction beklendiği gibi fail/recover.
- Foreign window tap'i engelliyor ve `obscuredBy` kanıtı var.
- Manual touch contamination işaretleniyor.
- WakeLock bounded; thermal/power bütçesi kabulde.
- Tam kurye BridgeFlow correctness'i golden runner'dan düşük değil.
- False-pass artışı yok.
- Artifact/evidence completeness kabul kriterini geçiyor.
- Cutover kararı kayıt altına alınmış.

**Checkpoint 8 geçmeden Maestro DELETE yoktur.** Ancak başarısız Bridge run'ın
sessiz Maestro fallback'i yine yoktur; dual-run yalnız ölçüm harness'ıdır.

## FAZ 9 — Ürünleştirme, Maestro DELETE ve Operasyon

### Amaç

Geçiş kodunu kaldırmak, yeni runtime'ı tek production Cockpit yolu yapmak ve
uzun süreli operasyon kapılarını tamamlamak.

### Neden en sonda

Compatibility, historical run ve rollback ihtiyaçları ancak measured cutover
sonrası güvenle daraltılabilir.

### Yapılacaklar

1. D.19 DELETE listesi.
2. Repo-wide Maestro/YAML execution referans envanteri.
3. Legacy UI metin ve route temizliği.
4. DeviceWorker Maestro driver kodunu sil.
5. API executor/compiler/script/dependency temizliği.
6. Yeni run yazımından Maestro alanlarını çıkar.
7. v1 event telemetry observation window.
8. V1 parser sunset veya bilinçli device sunset.
9. Multi-device concurrency.
10. Low disk.
11. USB disconnect.
12. Power/process loss.
13. 8 saat soak ve uzun retention/purge.
14. Dependency/security scan.
15. Runbook, operator guide ve incident playbook.
16. Eski dar dokümanları bu master plana bağla/arsivle.
17. Product-shell borcunu ayrı backlog'a taşı.

### CHECKPOINT 9

- Yeni execution yolunda Maestro CLI/executor/driver/YAML compiler yok.
- Repo-wide allowlisted historical renderer dışında Maestro execution referansı sıfır.
- Yeni run Maestro alanı yazmıyor.
- Eski run read-only açılıyor.
- Aktif v1 event/device oranı sıfır veya kalan cihazlar bilinçli sunset edilmiş.
- Çoklu cihaz port/session izolasyonu yeşil.
- Low disk/USB/process loss recovery beklendiği gibi.
- Soak kriteri geçiyor; unprocessed inbox/lease/socket/forward sızıntısı yok.
- Security, retention ve audit kapıları yeşil.
- Mobile `verdict-status.json` platform release kararını GO'ya taşıyabilecek kanıt hazır.

---

# BÖLÜM F — RİSK MATRİSİ

| ID | Risk | Etki | Önleme | Yakalanacağı checkpoint |
|---|---|---|---|---|
| R1 | Host secret'ı kaybeder veya yanlış run'a bağlar | SDK event socket açılmaz/cross-run risk | Registry ownership + binding + rotation tests | CP1 |
| R2 | Auth öncesi event/ACK kabul edilir | Veri sızıntısı veya WAL kaybı | Per-socket gate + adversarial suite | CP1 |
| R3 | DB commit var fakat consumer yok/öldü | ACK verilmiş event oracle'a ulaşmaz | Durable worker + restart scan | CP2 |
| R4 | Fan-out burst tail'i kalır | Run sonsuza kadar bekler | Nudge coalescing + lag alarm | CP2 |
| R5 | Gap körlemesine atlanır | Sıra/correctness bozulur | Contiguous invariant + gap tests | CP2 |
| R6 | Çoklu cihaz aynı host 9876'yı ister | Yanlış cihaza command/collision | Per-device dynamic host port lease | CP3 |
| R7 | Bridge production cihazda aktif olur | Güvenlik/operasyon ihlali | Lab allowlist + hard deny | CP3/CP7 |
| R8 | TCP kopmasında action etkisi bilinmez | Duplicate teslim/tap | requestId + unknown-effect state | CP3/CP5/CP8 |
| R9 | Bayat tree ile tap | Yanlış hedef | expectTreeGen + fresh probe | CP3 |
| R10 | Ambiguous text selector | Yanlış satır | Compile/runtime ambiguity fail | CP3/CP4 |
| R11 | Condition `eval` güvenlik açığı | Kod çalıştırma | Typed AST | CP4 |
| R12 | Loop sınırsız | Stuck run/device tüketimi | Max iteration/time/nesting | CP4 |
| R13 | Aynı node type event'leri karışır | False pass | occurrence/iteration correlation | CP5 |
| R14 | Ekran yeşili business success sayılır | False pass | Four-layer completion policy | CP5 |
| R15 | Host restart action'ı tekrarlar | Duplicate physical effect | Persisted step/attempt/request state | CP5/CP8 |
| R16 | UI preview execution'dan farklı | Operatör yanılır | Tek API compiler + plan hash | CP6 |
| R17 | Screenshot/dump PII sızdırır | Veri ihlali | Redaction, RBAC, retention | CP6/CP7 |
| R18 | Unknown dialog kör kapatılır | Bug gizlenir | STOP + artifact policy | CP7 |
| R19 | Maestro erken silinir | Workflow kaybı | Measured dual-run gate | CP8 |
| R20 | Maestro kalıcı fallback kalır | İki runtime drift/borç | CP9 zero-reference gate | CP9 |
| R21 | Accessibility service enable başka servisleri ezer | Cihaz bozulur | Read/merge/verify enabled-service list | CP3 |
| R22 | Full dump hot path performansı bozar | Yavaşlık/ANR/power | Scope policy + metrics | CP3/CP8 |
| R23 | Heartbeat var ama alarm yok | Stuck run fark edilmez | Liveness policy + executor watchdog | CP5/CP7 |
| R24 | Typecheck/test skip borcu yeni hatayı gizler | Release regresyonu | CP0 baseline | CP0 |

---

# BÖLÜM G — TEST STRATEJİSİ

## G.1 Test piramidi

### Unit

- HMAC canonicalization/verification.
- Registry lifecycle.
- NDJSON parser.
- Bridge schemas/error taxonomy.
- Condition AST/evaluator.
- Compiler determinism.
- Completion policy.
- State transition.
- Redaction.

### Contract

- Mobile SDK hello/auth fixture ↔ Cockpit.
- Control channel suite.
- Bridge APK v1 fixture ↔ bridge-contract/client.
- Workflow contract API ↔ Web.
- DB migration/read model.

### Integration

- Real PostgreSQL ingest/ACK/fan-out.
- Fake WS client auth/replay/gap.
- Fake TCP Bridge partial frame/timeout/reconnect.
- Executor + durable bus + oracle.
- API + Web compile/preview hash.

### Device

- SDK authenticated vertical slice.
- Bridge command smoke.
- Multi-device port isolation.
- Full courier workflow.
- Process death.
- IME/foreign-window/manual touch.

### Durability/soak

- API kill/restart.
- Bridge kill/restart.
- App kill -9/force-stop.
- ADB disconnect/reconnect.
- Low disk.
- Host DB temporary outage.
- Power/USB loss.
- 8 saat soak.

## G.2 CI zorunlu kapıları

Her PR:

- Format/lint.
- API/Web/package typecheck.
- Unit suite.
- Contract fixture suite.
- Prisma generate/migration validation.
- No-secret fixture scan.
- Compiler snapshot determinism.

Protected integration job:

- Disposable PostgreSQL.
- WS ingest/fan-out/restart.
- Fake Bridge integration.
- Old run read compatibility.

Scheduled device lab:

- SDK auth vertical slice.
- Bridge smoke.
- Golden courier.
- Fault matrix.
- Performance trend.

## G.3 Auth test matrisi

| Vaka | Beklenen |
|---|---|
| Doğru run/device/app/secret | Authenticated |
| Yanlış secret | Close, 0 event |
| Bilinmeyen run | Close |
| Başka device binding | Close |
| Replay nonce | Close |
| Timestamp skew | Close |
| Timeout | Close |
| Eski secret rotation sonrası | Close |
| Auth öncesi event | Reject, ACK yok |
| Sahte ACK/gap ACK | State değişmez |

## G.4 Bridge test matrisi

| Vaka | Beklenen |
|---|---|
| Handshake yokken command | Reject |
| Duplicate same request | Aynı response, tek fiziksel etki |
| Same requestId different payload | `request_id_conflict` |
| Missing dump scope | `missing_dump_scope` |
| Multiple matches | Ambiguous, tap yok |
| Stale tree | `stale_tree`, input yok |
| Foreign obscuration | visible false / action blocked |
| Partial frame | Buffer + doğru parse |
| Oversized frame | Protocol reject/close |
| TCP loss during action | Unknown-effect/idempotent recovery |
| Process death | B1 politikası |
| Two devices | Ayrı host port/session |

## G.5 Workflow/oracle test matrisi

- Aynı node tek occurrence.
- Aynı node retry attempt'leri.
- Aynı node 20 loop occurrence'ı.
- İki aynı type node; event yalnız doğru occurrence'a gider.
- UI pass + App missing.
- App pass + Remote fail.
- Offline queue accepted.
- Late event.
- Duplicate/replayed event.
- Branch TRUE/FALSE/UNKNOWN.
- Loop max exceeded.
- Unknown dialog.
- Cancel while waiting event.
- Cancel while Bridge action uncertain.
- Host restart between action and evidence.

## G.6 Performans bütçeleri

Baseline CP0'da ölçülür; sabit sayılar ölçüm olmadan uydurulmaz. En az şu trendler
regression gate olur:

- WS auth süresi.
- Event commit-to-ACK.
- Commit-to-consumer.
- waitEvent latency.
- Bridge ping/action/wait_node.
- Scoped dump node sayısı ve süre.
- Screenshot süre/boyut.
- Compiler süre ve plan boyutu.
- Executor overhead.
- Full courier toplam süre.
- Device CPU/thermal/WakeLock.

## G.7 Release kanıt paketi

Her checkpoint şunları üretir:

- Commit SHA/branch/dirty state.
- Mobile build/SDK/Bridge version.
- Device serial/model/API.
- DB migration version.
- Protocol/capability snapshot.
- Çalıştırılan komutlar.
- Test sonuçları ve skip listesi.
- Artifact hash'leri.
- Başarı/NO_GO kararı.
- Açık blocker ve owner.

---

# BÖLÜM H — OPERASYON, REFERANS VE İZLENEBİLİRLİK

## H.1 Hata taksonomisi

### Session/Auth

- `UNKNOWN_RUN`
- `DEVICE_BINDING_MISMATCH`
- `APP_BINDING_MISMATCH`
- `AUTH_INVALID_SIGNATURE`
- `AUTH_REPLAY`
- `AUTH_CLOCK_SKEW`
- `AUTH_TIMEOUT`
- `AUTH_ROTATED`

### Durable event

- `INGEST_UNAVAILABLE`
- `PROTOCOL_VIOLATION`
- `SEQUENCE_GAP`
- `CONSUMER_RETRYING`
- `CONSUMER_DEAD_LETTER`
- `EVENT_WAIT_TIMEOUT`
- `EVENT_CORRELATION_MISS`

### Bridge

- `BRIDGE_NOT_INSTALLED`
- `BRIDGE_SERVICE_DISABLED`
- `BRIDGE_FORWARD_FAILED`
- `BRIDGE_HANDSHAKE_FAILED`
- `BRIDGE_PROTOCOL_MISMATCH`
- `BRIDGE_CAPABILITY_MISSING`
- `BRIDGE_TIMEOUT`
- `BRIDGE_DISCONNECTED`
- `BRIDGE_UNKNOWN_EFFECT`
- `BRIDGE_REQUEST_ID_CONFLICT`
- `BRIDGE_STALE_TREE`
- `BRIDGE_AMBIGUOUS_SELECTOR`
- `BRIDGE_OBSCURED`
- `BRIDGE_CONTAMINATED`
- `BRIDGE_PRODUCTION_DENIED`

### Workflow

- `COMPILE_INVALID_GRAPH`
- `COMPILE_UNSUPPORTED_NODE`
- `COMPILE_UNBOUNDED_LOOP`
- `COMPILE_UNSAFE_RETRY`
- `CONDITION_UNKNOWN`
- `STEP_TIMEOUT`
- `EVIDENCE_MISSING`
- `LOCAL_ASSERTION_FAILED`
- `REMOTE_ASSERTION_FAILED`
- `RUN_STUCK`
- `CLEANUP_FAILED`

## H.2 Observability alanları

Her log/metric/span mümkün olduğunda şunları taşır:

- runId
- sessionId
- epoch
- deviceId
- workflowId/versionId
- planHash
- sourceNodeId
- planStepId
- occurrenceId
- iterationPath
- attempt
- requestId
- protocolVersion
- monotonic timestamp

Secret, PIN, token ve hassas input değeri taşımaz.

## H.3 Artifact sınıfları

| Sınıf | Örnek | Varsayılan politika |
|---|---|---|
| Normal | Plan, redacted response, metrics | Run retention |
| UI-sensitive | Screenshot, hierarchy dump | RBAC + kısa retention |
| Diagnostic | Perfetto, meminfo | Restricted |
| Highly sensitive | Heap dump | Explicit D3 approval, 24 saat purge, rapora otomatik eklenmez |

## H.4 Port ve process runbook'u

### SDK event

- Host server `127.0.0.1:8765/nesy`.
- Device `adb reverse tcp:8765 tcp:8765`.
- Shared server, stream identity run/session ile ayrılır.

### Verdict Bridge

- Device sabit `127.0.0.1:9876`.
- Host device başına dinamik port.
- `adb forward --no-rebind tcp:<lease> tcp:9876`.
- Worker dispose/end durumunda lease ve forward temizliği.

## H.5 Ekran/yüzey geçiş matrisi

| Ekran/yüzey | Kalıcı taşıyıcı | Cockpit işi |
|---|---|---|
| Device Overview | ADB | Kanal sağlıklarını ayır |
| Operational Readiness | ADB + SDK/Bridge health | Auth/consumer/Bridge gate ekle |
| Screen State | SDK dump + Bridge Inspector + ADB host | Live Inspector'a genişlet |
| User Interactions | Structured durable event | Legacy/logcat sunset sonrası durable primary |
| Network Inspector | ADB logcat / mevcut network event | Bridge'e taşınmaz |
| Schedule Explorer | ADB run-as | Kalıcı |
| Database Access | ADB run-as/host SQLite | Kalıcı; sql_named ile değiştirme |
| ADB Scenario Runner | ADB + VerdictChannel | Typed control; Bridge UI action ayrı |
| Device Log Explorer | ADB logcat | Kalıcı |
| Automation Editor | Workflow contract/compiler | YAML yerine Plan |
| Field Login | BridgeFlow + VerdictChannel | Özel Maestro yolunu kaldır |
| Load Tour | BridgeFlow | Özel Maestro yolunu kaldır |
| Run Detail | Oracle/evidence/artifact | Dört katman + occurrence |
| Product Screen Map | Statik + opsiyonel Bridge | Kritik yol değil |
| Version Tracker | Host + ADB install | Kalıcı ADB |

## H.6 Dosya/paket hedef haritası

| Hedef | Rol |
|---|---|
| `packages/bridge-contract` | Wire/schema/capability/error |
| `packages/bridge-client` | TCP client/lifecycle |
| `packages/workflow-contract` | Editor/IR/plan/evidence shared types |
| `apps/api/src/services/run-secret-registry.ts` | Secret lifecycle |
| `apps/api/src/services/verdict-ws-auth.ts` | Mutual HMAC socket gate |
| `apps/api/src/services/verdict-event-bus.ts` | Durable subscription/waitEvent |
| `apps/api/src/services/bridge-device-manager.ts` | Port/preflight/client ownership |
| `apps/api/src/services/condition-engine.ts` | Typed condition |
| `apps/api/src/services/bridge-flow-compiler.ts` | IR → plan |
| `apps/api/src/services/bridge-flow-executor.ts` | Plan runtime |
| `apps/api/src/services/workflow-runner.ts` | Engine-agnostic orchestrator |
| `apps/api/src/services/oracle-engine.ts` | Evidence fusion |
| `packages/db/prisma/schema.prisma` | Run/occurrence/evidence persistence |
| Automation Web components | Authoring/preview |
| Debug View Screen State | Live Inspector |
| Run result/detail components | Evidence/repro |

Dosya adları implementasyon sırasında repo konvansiyonuna göre küçük ölçüde
değişebilir; paket ve sorumluluk sınırları bağlayıcıdır.

## H.7 Traceability — Mobile blocker → Cockpit işi

| Mobile/Bridge durumu | Cockpit karşılığı |
|---|---|
| `bridge_b1_run_fencing` | Contract/client/executor command envelope ve rejection UI |
| `bridge_b1_process_death_action` | Persisted request/unknown-effect/recovery suite |
| `bridge_b1_c15_device_cases` | Device lab fault harness ve evidence UI |
| `bridge_b2_compiler_runtime` | Faz 4–5 |
| `bridge_b2_courier_workflow` | Faz 7–8 |
| CP5 live diagnostics | Durable subscriber + CapturePolicy |
| CP5 screen-state parity | Inspector/dump sunset gate |
| CP6 final inventory | CP9 zero-reference/inventory |
| CP7 durability/soak | Faz 9 fault/soak |
| CP8 v2 rollout | V1 telemetry/sunset gate |

## H.8 Definition of Done — platform

Platform ancak aşağıdakilerin tamamında “DONE” sayılır:

1. CP0–CP9 kanıtları yeşil.
2. Mobile Bridge B1 koşulları kapanmış.
3. Bridge B2 compiler/runtime ve tam kurye workflow tamamlanmış.
4. Production SDK WS mutual-HMAC ile çalışıyor.
5. Durable event consumer restart-safe ve synchronous fallback kapalı.
6. Bridge host client/device gate çoklu cihazda çalışıyor.
7. Workflow IR/Condition/Compiler/Executor typed ve versioned.
8. Oracle occurrence bazlı dört kanıt katmanı kullanıyor.
9. Yeni run modeli Maestro alanlarına bağımlı değil.
10. Editor/Inspector/Run Detail yeni runtime'ı eksiksiz sunuyor.
11. Field Login/Load Tour/tam kurye tek omurgada.
12. Security/RBAC/audit/retention kapıları yeşil.
13. Golden cutover BridgeFlow lehine kabul edilmiş.
14. Maestro execution kodu, driver, YAML yolu ve UI dili silinmiş.
15. Eski run'lar read-only açılabiliyor.
16. Typecheck/test/integration/device/soak kapıları yeşil.
17. SSOT ve dar dokümanlar çelişmiyor.

## H.9 İlk uygulanacak iş sırası — kısa özet

1. Typecheck ve gerçek DB CI baseline.
2. RunSecretRegistry + production WS mutual-HMAC.
3. Durable consumer/event bus/waitEvent ve sync cutover.
4. Bridge contract/client/device preflight.
5. Shared workflow contract + IR v2 + Condition Engine.
6. BridgeFlowCompiler.
7. BridgeFlowExecutor + Oracle v2 + persistence.
8. Editor/Live Inspector/Run Detail.
9. Field Login/Load Tour/tam kurye + diagnostics/security.
10. Physical B1 matrix + golden comparison.
11. Maestro DELETE + productization.

---

# Son bağlayıcı karar

Bu programın başarı ölçütü “Cockpit bir Bridge komutu gönderebiliyor” değildir.
Başarı; güvenli session, kalıcı event, deterministik plan, idempotent action,
restart recovery, occurrence bazlı dört katmanlı evidence, operatör açıklanabilirliği
ve measured cutover'ın birlikte sağlanmasıdır.

Bu nedenle:

- Bridge pilot başarısı platform release başarısı değildir.
- Unit test başarısı durability/device acceptance değildir.
- Yeşil ekran business success değildir.
- ADB bağlantısı Accessibility Bridge bağlantısı değildir.
- Working tree'deki bir implementasyon checkpoint kanıtı değildir.
- Maestro fallback tamamlanmış geçiş değildir.

**Nihai hedef:** Cockpit'te yeni workflow run'larının tek kalıcı execution yolu
`WorkflowIR v2 → BridgeFlowPlan → BridgeFlowExecutor → Oracle v2` olmalıdır.
