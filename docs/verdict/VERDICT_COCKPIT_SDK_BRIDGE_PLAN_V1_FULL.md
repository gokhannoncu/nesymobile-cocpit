---
name: Verdict Cockpit SDK + Bridge plan v1.1.3
overview: NesyMobileCocpit'i mevcut Maestro merkezli otomasyon koşucusundan; Verdict SDK kontrol ve canonical evidence düzlemi, Verdict Accessibility Bridge fiziksel UI eylem düzlemi, kalıcı event fan-out'u, WorkflowIR v2 sonrasında kurulan versioned Domain Pack/App Adapter ve Application/Screen/Surface/Launch/Evidence Source/Test Profile registry'leri, event-driven Continue Gate, request-response UiWaitPlan/wait_any, BridgeFlowCompiler/Executor, Evidence Journey teşhisi, dört katmanlı Final Oracle ve Nesy Cockpit v1 için Smoke/Regression/Recovery/Bad Day/Load/Compatibility/Security test profilleri bulunan app-agnostic bir test ve operasyon platformuna dönüştüren bağlayıcı master plan. Planın ürün tezi “yalnız test sonucu değil, uygulanabilir kanıtlarla ispat” ilkesidir; beachhead pazar Android saha/offline operasyon uygulamalarıdır fakat Core mimari bu pazara daraltılmaz. Geçiş sonunda Maestro yalnız devre dışı bırakılmaz; runtime, driver, CLI, dependency, YAML üretimi, feature flag, API/DB alanı, UI, script, test, fixture ve aktif doküman yapısıyla birlikte Cockpit projesinden tamamen sökülür. Plan; mevcut doğru parçaları korur, production WebSocket mutual-HMAC boşluğunu, durable consumer/recovery boşluğunu, Bridge host client ve device gate eksikliğini, Workflow IR/Condition Engine/Domain Pack/BridgeFlow runtime ihtiyacını, Test Profile Catalog ve Test Campaign ürün katmanını, yedi-workspace route/PageDataSource cutover ve ekran kabul matrisini, veri modelini, fiziksel DUT kapılarını, güvenlik/retention kurallarını, Cockpit ürün kabuğu borçlarını ve teknik checkpoint'lerden ayrı izlenecek Business Validation Gate'lerini tek yerde toplar.
todos:
  - id: faz-0
    content: "FAZ 0 — Doğrulanabilir baseline ve SSOT: repo-level typecheck yeşil; checkpoint script'leri ayrı harness; gerçek PostgreSQL ingest testleri CI'da; Mobile verdict-status.json ile Cockpit durum tablosu eşlenir; eski Cockpit dokümanlarındaki VerdictChannel/detectChannel/legacy drift'i düzeltilir; golden workflow ve ölçüm fixture'ları SHA-pinned hale gelir. CHECKPOINT 0 geçmeden güvenlik veya runtime cutover yapılmaz."
    status: in_progress
  - id: faz-1
    content: "FAZ 1 — Güvenli SDK run session ve mutual-HMAC WS host: RunSecretRegistry, run/device/app bağlama, set_run ile aynı typed secret, app->host doğrulama, host->app karşı imza, 5 saniye auth timeout, pre-auth event/ACK yasağı, nonce replay/time-skew/rotation/end_run testleri ve çoklu cihaz izolasyonu. CHECKPOINT 1: kimliksiz peer 0 metadata/event görür; gerçek cihaz authenticated WS üzerinden event üretir."
    status: pending
  - id: faz-2
    content: "FAZ 2 — Durable event runtime: commit-sonrası ACK korunur; receipt-safe ve ordered fan-out gerçek consumer'lara bağlanır; processed_at/retry/dead-letter/consumer lag; restart recovery; run-scoped subscription ve host waitEvent; SDK'da recursive event üretmeyen bounded EmitOutcome diagnostic query; synchronous sink ile paralel eşitlik; ölçüm sonrası synchronous oracle yolu kaldırılır. CHECKPOINT 2: process kill sonrası event doğru lane'de oracle'a ulaşır, WAL ACK/gap semantiği korunur ve kanıtsız outcome tahmin edilmez."
    status: pending
  - id: faz-3
    content: "FAZ 3 — Bridge host temeli ve cihaz kapısı: packages/bridge-contract + bridge-client; NDJSON framing, handshake, typed command/result, semantic TargetFingerprint ve Target Resolution Provider Chain, requestId idempotency, injected gesture interval/origin evidence taşıyan fiziksel aksiyon yaşam döngüsü, event-driven wait_any + cancel_request, timeout/cancel/reconnect ve screenshot artifact; cihaz başına dinamik host port -> sabit device 9876; Bridge APK/version/hash/accessibility/capability/ping preflight; lab allowlist ve production deny. İlk B2'de persistent register_watch/unsolicited push yoktur. CHECKPOINT 3: gerçek DUT'ta scoped dump/find/tap/input/swipe/back/screenshot/wait_node/wait_any, cancellation race, ambiguity/stale-tree ve action lifecycle sözleşmesi geçer."
    status: pending
  - id: faz-4
    content: "FAZ 4 — Zorunlu üç sıralı kapı: 4A'da shared workflow-contract + WorkflowIR v2 + Condition Engine + typed allowlisted REMOTE_ACTION primitive'i tamamlanır ve kabul edilir; 4A geçmeden 4B Domain Pack implementasyonu başlamaz. 4B'de Control Plane Domain Pack contract'ı, Application/Screen/Surface/Launch/Evidence Source/Test Profile registry'leri, Nesy Courier Domain Pack ve automationRelease App Adapter mevcut NesyCommands/NesyStateProvider/named-query/event temeli refactor edilerek kurulur; Nesy tur onayı lifecycle'ı Domain Pack reference slice olarak tanımlanır. 4B geçmeden 4C tam Domain Pack expansion + BridgeFlowCompiler yapılmaz. 4C semantic macro/entity/query/surface/oracle/test-profile tanımlarını generic IR v2 ve UiWaitPlan'a deterministik derler. CHECKPOINT 4: aynı input aynı plan hash'ini üretir; unsupported/ambiguous/unbounded/risky plan, eksik pack/adapter/evidence capability, yanlış test profile policy'si ve hot-path full dump cihazdan önce fail eder."
    status: pending
  - id: faz-5
    content: "FAZ 5 — BridgeFlowExecutor + Continue Gate + dört katmanlı Final Oracle + Evidence Source/normalization + Evidence Journey runtime + Test Profile/Campaign execution parametreleri + yeni kalıcılık modeli: step occurrence/iteration/entity/requestId/treeGen/eventSeq, expected/interrupt wait_any lifecycle, SDK/Bridge/local/remote evidence applicability ve fact authority/freshness/correlation, orthogonal business verdict/evaluation/layer root-cause/termination sonuçları, Remote business doğrulaması, CLOCK_BOOTTIME host-device korelasyonu, cancellation/recovery/cleanup, repetition/fault/device/telemetry policy ve stuck-run detection; eski engine'e ait run verileri engine-neutral arşiv modeline taşınır. CHECKPOINT 5: readiness sağlanınca kör deadline beklenmez, eventual Oracle ayrı tamamlanır, event yokluğu kanıtsız SDK failure yapılmaz, process restart ve duplicate action deterministik, transport success business success sayılmaz, ekran yeşili tek başına başarı üretmez, Test Profile yeni motor açmadan aynı BridgeFlow runtime'ına derlenir."
    status: pending
  - id: faz-6
    content: "FAZ 6 — Cockpit UI ve route dönüşümü: yedi workspace korunur; Automation altında Domain Pack catalog/detail manager, Test Profile catalog/detail ve Test Campaign route'ları eklenir; PageMigrationManifest ve PageDataSourceContract bütün mevcut route'ları hedef kaynak/checkpoint/availability/RBAC/legacy-cleanup/test ile bağlar. YAML Preview yerine Domain Pack/Test Profile provenance taşıyan BridgeFlow Plan Preview; semantic macro/entity binding/Launch Profile Builder; Test Profile Builder; Live Inspector Screen/Surface mapping ve Expected/Interrupt Wait; ayrık cihaz kanal sağlıkları; drawer-first Evidence Journey + exact repro, occurrence-applicable layer rozetleri, injected/manual/unknown interaction origin ve Continue Gate/Final Oracle Run Detail; current-architecture ve modernization checkpoint sayfaları; route/deep-link/non-regression/legacy-zero suite'i tamamlanır. CHECKPOINT 6: hedef route'ların tamamı doğru data source ve page acceptance ile çalışır; Test Profile/Campaign UI'sı ayrı motor iddiası üretmeden çalışır; bilinçli placeholder'lar ayrı backlog olarak raporlanır."
    status: pending
  - id: faz-7
    content: "FAZ 7 — Gerçek iş akışları, Nesy v1 Test Profile kataloğu ve teşhis: Field Login ve Load Tour tek executor'a taşınır; tam kurye turu, 20 barkod FOR_EACH, PASS_QUEUED_OFFLINE, backend business confirmation ve dialog policy; Smoke, Critical Regression, Differential Regression, Recovery, State-Aware Bad Day, Business Contract/Consistency, Load, Compatibility Certification, Short Soak ve Security/Release Isolation profilleri Nesy Courier Domain Pack üstünde tanımlanır; gerçek DUT Evidence Journey/origin matrisi; failure-triggered scoped D1/D2/D3 CapturePolicy, redaction, retention, RBAC/audit, heartbeat/stuck-run ve transport/Bridge metrikleri. AI Design Audit, basic accessibility audit, Smart Explorer Preview ve post-run LLM açıklaması ayrı opsiyonel/preview izlerdir, runtime hükmünü değiştirmez ve checkpoint'i bloklamaz. CHECKPOINT 7: referans kurye akışı ve v1 core Test Profile kataloğu yalnız ilgili evidence katmanlarıyla gerçek DUT'ta yeşil."
    status: pending
  - id: faz-8
    content: "FAZ 8 — Fiziksel kabul ve ölçümlü Maestro cutover: Bridge B1 runId/sessionId/epoch fencing, process-death duplicate action, IME obstruction, foreign window ve manual touch contamination; golden runner dual-run; correctness, false-pass, süre ve artifact karşılaştırması. CHECKPOINT 8 geçmeden Maestro kapatılmaz."
    status: pending
  - id: faz-9
    content: "FAZ 9 — Ürünleştirme ve TAM SÖKÜM: Maestro executor/driver/YAML compiler/UI/CLI/fallback yanında dependency, env/config, feature flag, API DTO, Prisma alanı, migration baseline, script, test, fixture, route, çeviri ve aktif doküman yapısı da projeden kaldırılır; eski run verisi önceden engine-neutral arşive taşınır, özel historical renderer bırakılmaz. CHECKPOINT 9: aktif Cockpit projesinde Maestro yapısı ve çalıştırılabilir referansı sıfır, güvenlik/durability/release kapıları yeşil."
    status: pending
isProject: false
---

# Verdict Cockpit — SDK + Bridge Tam İmplementasyon Planı

**Sürüm:** v1.1.3
**Tarih:** 2026-08-05
**FrozenAt:** 2026-08-05
**MasterDigest:** `sha256:b81631396044cab7f83f6b6efea2f47ff4b4bda4b177b2d7a2ad705535b660b2`
**Digest Policy:** UTF-8 oku; CRLF/CR line ending'leri LF yap; dosya final newline ile biter; `**MasterDigest:**` ile başlayan satırı tamamen çıkar; başka whitespace normalization uygulama; kalan metnin SHA-256 değerini hesapla.
**Verify Command:** `pnpm verdict:verify-master-plan`
**DecisionIndexVersion:** `decision-index-v1.1.3`
**Durum:** Bağlayıcı master plan; uygulama ve kabul kapıları tamamlanmamıştır.  
**Kapsam:** `/NesyMobileCocpit` içindeki API, Web, workspace paketleri, veritabanı, cihaz işçileri, otomasyon editörü, runtime, oracle, artifact, teşhis, güvenlik ve geçiş kodları.  
**Mobile SSOT:** `/NesyMobile/verdict-status.json`  
**Mobile playbook track:** `docs/verdict/mobile-run-playbooks/PROGRESS.md`  
**Kaynak SDK planı:** `/Users/gokhanoncu/Desktop/Verdict_Dev/plan/verdict_sdk_plan_v3_FULL.md`

### Mobile playbook track (M\* — ayrı iz)

Bu bölüm master plan `todos: faz-*` YAML status’unun yerine geçmez. `faz-0…faz-9`
Cockpit program fazlarıdır. Mobile agent işi `mobile-run-playbooks/` altında M0–M9
olarak izlenir; canlı board:

```text
docs/verdict/mobile-run-playbooks/PROGRESS.md
```

| Mobile faz | Durum (2026-08-06) | Kanıt |
|---|---|---|
| M0 Baseline / gap | `COMPLETED` | `mobile-run-playbooks/phase-0/RESULT.md` |
| M1 SDK auth fixture | `COMPLETED` | `mobile-run-playbooks/phase-1/RESULT.md` |
| M2 EmitOutcome diagnostic | `COMPLETED` | `mobile-run-playbooks/phase-2/RESULT.md` |
| M3 Bridge B2 protocol | `COMPLETED` | `mobile-run-playbooks/phase-3/RESULT.md` (SSOT `bridge_b2` hâlâ not_started) |
| M4A Core-contract thin gate | `COMPLETED` | `mobile-run-playbooks/phase-4a/RESULT.md` |
| M4B App Adapter production | `COMPLETED` | `mobile-run-playbooks/phase-4b/RESULT.md` |
| M4C Compatibility fixtures | `COMPLETED` | `mobile-run-playbooks/phase-4c/RESULT.md` |
| M5 Correlation + recovery | `COMPLETED` | `mobile-run-playbooks/phase-5/RESULT.md` (M6 READY_WITH_EXTERNAL) |
| M6…M9 | `NOT_STARTED` | ilgili `phase-*/RESULT.md` (sonraki: M6) |

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

## Denetim Turu 2 — Ürün çalışma modeli ve açıklanabilirlik ekleri

Ürünün kullanıcıya görünen uçtan uca anlatımı teknik master planla
karşılaştırıldı. Ana mimari değişmedi; aşağıdaki eksik sözleşmeler eklendi:

| Öncelik | Ekleme | Plandaki yeri |
|---|---|---|
| P1 | Teknik Faz 0–9 ile beş ürün katmanının isim ayrımı | A.10 |
| P1 | SDK/Bridge `CLOCK_BOOTTIME` + host ping/marker/uncertainty korelasyonu | B.15 · D.9 |
| P1 | Versioned semantic `TargetFingerprint`, stable `rowKey`, rowIndex yalnız hint | B.7 · D.3 · D.12 |
| P1 | Physical action lifecycle ve process-death unknown-effect semantiği | B.7 · D.8 |
| P1 | `dispatchGesture` primary, allowlisted semantic action, fixed koordinat yasağı | B.7 · C.22 |
| P1 | Evidence layer applicability ve ayrı rozet durumları | B.12 · D.9 |
| P1 | Online/offline/pending/layer-fail/inconclusive sonuç taksonomisi | B.12 · D.9 |
| P1 | HTTP transport sonucu ile Remote business doğruluğunun ayrılması | B.12 · D.9 |
| P1 | Normalize command→gesture→app→local→remote diagnostic waterfall | D.15 |
| P1 | Versioned, redacted ve clock-aware genişletilmiş repro paketi | D.15 |
| P1 | SDK otomatik teknik telemetri ile app business event/query sınırı | C.20 · D.7 |
| P2 | AI Design Audit ve post-run explanation, non-blocking opsiyonel İz C | C.21 · D.21 |

Eklenmeyen iddialar: Bridge için sabit boyut hedefi, tüm Room write'larının
otomatik yakalanması, her node'da dört layer zorunluluğu, HTTP 200'ün doğrudan
business success olması, requestId'nin mutlak exactly-once garantisi ve runtime
LLM hükmü.

## Denetim Turu 3 — Domain Pack, event-driven gate ve Bridge wait düzeltmeleri

NesyMobile SDK, App Adapter kaynak seti, Accessibility Bridge ve Cockpit'in
mevcut Maestro/Oracle çalışma yolu; Domain Pack, dört boyutlu çalışma modeli ve
Bridge wait/watch önerileriyle tekrar karşılaştırılmıştır. Bağlayıcı sonuç şudur:

> Sistem sıfır değildir; SDK evidence/control omurgası ve Bridge B1 generic action
> temeli vardır. Ancak bunlar henüz versioned Domain Pack, Bridge-driven runtime,
> Continue Gate ve occurrence-bazlı dört katmanlı Final Oracle olarak birleşmemiştir.

| Katman | Bugün doğrulanan temel | Eksik hedef | Plan kararı |
|---|---|---|---|
| SDK Core | Control, event, WAL/ACK/replay, safe named-query ve app state temeli | Domain-neutral fact/evidence contract'ın runtime'a bağlanması | Korunur ve genişletilir; yeniden yazılmaz |
| Nesy App Adapter | `login`, `select_route`, `open_delivery`, `open_task_list`, `open_vehicle_loading`, state provider ve `pending_request_count` | Entity query set'i, scanner injection, fixture/session prep, launch profile ve compatibility manifest | Mevcut kod refactor edilir; ikinci paralel adapter yazılmaz |
| Bridge | Generic command set, explicit scoped dump, `wait_node`, tree generation ve run fencing | `wait_any`/`cancel_request`, expected+interrupt local race, changed-subtree evaluation ve diagnostic artifact kanalı | İlk B2 request-response kalır; business anlamı Bridge'e girmez |
| Cockpit | Hardcoded kurye node'ları, sınırlı IR, tek Maestro prosesi ve `ui/mobileEvent/backend` Oracle | Domain Pack compiler, formal registry'ler, WorkflowIR v2, Continue Gate, UiWaitPlan, BridgeFlow runtime ve 4D Final Oracle | Faz 4–5'te tamamlanır |
| Dinamik kurye akışı | Bilinen input/barcode ile statik veya hardcoded akış | Runtime stop/task/shipment/parcel discovery, nested `FOR_EACH`, entity/occurrence correlation | Domain Pack ve IR v2 sonrasında yapılır |
| Accessibility dump | Bridge explicit istekle `full/depth/subtree/match` dump döndürüyor; sürekli WS dump yok | Hot path'te küçük correlated `wait_any` sonucu; full dump yalnız tanı/Inspector | Var olmayan “sürekli dump'ı kapatma” işi yazılmaz; geleceğe dönük yasak korunur |

Bugünkü gerçek execution yolu hâlâ şöyledir:

```text
Cockpit hardcoded kurye node'ları
  → sınırlı WorkflowIR
  → Maestro YAML
  → tek Maestro prosesi ve UI polling
  → SDK structured event/WAL/WS ingest
  → ui/mobileEvent/backend Oracle
  → run/step sonucu

Cockpit workflow runtime ──X── Accessibility Bridge
```

Bridge APK vardır; fakat Cockpit workflow runtime henüz BridgeFlowCompiler/Executor
ile onu execution motoru olarak kullanmamaktadır.

### Senaryo bazlı mevcut yetenek baseline'ı

| İşlem | Denetim anındaki durum | Hedef iş |
|---|---|---|
| Login | Maestro ve SDK command ile mümkün | Domain action + generic IR/BridgeFlow |
| Route seçimi | `select_route` var | Versioned semantic action + surface readiness |
| Stop'u ID/shipment ile açma | `open_task_list` mevcut | Entity binding + `OPEN_STOP` macro |
| Delivery ekranını shipment ile açma | `open_delivery` mevcut | Launch profile/capability-gated action |
| Bilinen barcode ile delivery | Maestro ağırlıklı mümkün | Domain macro + Bridge/SDK primitives |
| Pending request sayısı | Safe state/query temeli var | `nesy.pendingOperation` typed contract |
| UI/local/backend event üretimi | Structured event temeli var | Raw evidence + domain fact + 4D Oracle |
| Durable SDK event'i Cockpit'e taşıma | Kontrollü fiziksel dikey dilim geçti | Production auth/recovery kapılarıyla kalıcılaştırma |
| Cockpit workflow'yu Bridge ile yürütme | Yok | BridgeFlowCompiler/Executor |
| Runtime stop/task/parcel loop | Yok | Entity query + nested `FOR_EACH` |
| Domain Pack yükleme/sürümleme | Yok | Pack registry/migration/compatibility |
| Screen/Surface Registry | Yok | Nesy Courier Domain Pack |
| Target mapping/fingerprint fallback | Tam domain mapping olarak yok | Versioned Target Registry |
| Continue Gate | Yok | Blocking readiness evaluator |
| 4D Final Oracle template | Yok | Domain Oracle + eventual validation |
| Offline queued formal sonuç | Event temeli var; policy eksik | `PASS_QUEUED_OFFLINE` |
| Scanner mode/injection | Standart contract yok | automation-only real/injected/manual modes |
| Expected/interrupt wait | Yok | Generic `UiWaitPlan → wait_any` runtime |
| Sürekli full dump stream | Yok ve eklenmeyecek | Yalnız explicit diagnostic artifact |

### Düzeltilmiş uygulama kararları

1. Domain Pack mevcut sınırlı IR'a değil, **tamamlanmış ve kabul edilmiş
   WorkflowIR v2** sözleşmesine compile edilir.
2. Sıra bağlayıcıdır:
   `WorkflowIR v2 acceptance → Domain Pack contracts → Nesy Courier Domain Pack +
   App Adapter → Domain expansion → BridgeFlowCompiler → Executor/Oracle`.
3. `NesyCommands`, `NesyStateProvider`, `roomQueries` ve structured event'ler App
   Adapter'ın başlangıç implementasyonudur; kopyalanmaz veya çöpe atılmaz.
4. Domain fact üretimi ham evidence'i yok etmez. Raw event, `eventSeq` ve kaynak
   metadata audit/repro için korunur; domain reducer öncelikle host/Domain Pack
   tarafında çalışır.
5. ASM/presenter instrumentation ilk çözüm değildir. Explicit adapter hook,
   Fragment lifecycle, named query, storage observer ve network observer önce gelir.
6. Bridge için WebSocket zorunlu değildir. İlk B2 mevcut TCP/NDJSON üzerinde
   correlated `wait_any + cancel_request` kullanır; unsolicited watch registry/push
   ancak ölçülmüş ihtiyaçla sonraki protocol major'a girer.
7. Timeout yasak değildir; koşulsuz sleep yasaktır. Timeout, condition/readiness
   deadline'ıdır. `nesy_wait_never_matches` benzeri sahte selector beklemeleri
   cutover'da tamamen kaldırılır.
8. Dynamic loop'tan önce `occurrenceId + iterationPath + entityType + entityId +
   attempt + requestId + eventSeq` correlation tamamlanır.
9. Scanner injection ve `DIRECT_STATE` yalnız automation build'de, release isolation
   ve audit kapılarıyla bulunabilir.
10. Domain Pack Bridge'e “route dialog” veya “parcel” gibi business isimleri
    göndermez; generic selector, target fingerprint ve `UiWaitPlan` üretir.

## Denetim Turu 4 — Formal registry, evidence authority ve sade B2 wait kararı

Son mimari değerlendirme planı aşağıdaki bağlayıcı düzeltmelerle netleştirmiştir:

| Konu | Bağlayıcı karar | Plandaki yeri |
|---|---|---|
| Queue/App State | Queue ayrı evidence plane değildir; Local subtype ve sonuç policy'sidir. App State, App plane source'udur. | B.10F · B.12 · D.9 |
| Raw callback/fact | Raw callback, canonical technical evidence ve normalized domain fact ayrıdır; Core SDK domain reducer taşımaz. | B.10C · D.6E |
| Bridge B2 wait | İlk B2 kalıcı Watch Registry değil, tek correlated `wait_any + cancel_request` request-response modelidir. | B.7 · B.10D · D.3–D.6D |
| Cancellation | Aynı socket'te cancel için reader bloke olamaz; cancellable worker ve serialized writer zorunludur. | B.10D · D.4 · D.6D |
| Screen/Surface | Logical screen ile dialog/overlay/scanner gibi surface ayrı formal registry'lerdir. | B.10A · D.6B |
| Launch | Hızlı test girişi process/precondition/entry/readiness/cleanup taşıyan formal Launch Profile'dır. | B.10A · D.6B · D.11 |
| Evidence source | Fact source'u plane, authority, correlation, freshness, redaction ve fallback ile versioned registry'de tanımlanır. | B.10F · D.6E |
| HTTP/business | HTTP başarı transport fact'idir; doğrulamasız business fact/PASS üretemez. | B.10F · D.9 |
| Source tercihi | Explicit app business event varsayılan son seçenektir; fakat başka türlü gözlenemeyen kritik transition için gerekçeli primary olabilir. | B.10F |
| Target çözme | Accessibility ID → bounded entity binding → Inspector mapping → structural fingerprint; rowIndex yalnız hint. | B.7 · D.6C |
| Gate/Oracle | İlerleme için Continue Gate ayrıdır; Final Oracle fact-bazlı obligation/timing/deadline policy'siyle nihai hükmü verir. | B.10E · D.9 |
| Sıralama | Production Domain Pack implementation'ı CP4A/WorkflowIR v2'den sonra başlar; CP4A öncesi yalnız cross-domain Core fixture'ı yazılabilir. | C.24 · D.6A · Faz 4 |

## Denetim Turu 5 — Yedi workspace ve ekran-bazlı cutover kararı

Mevcut Next.js App Router route envanteri, `WORKSPACES` navigasyonu ve planın UI
hedefleri route bazında karşılaştırılmıştır. Sonuç: mimari kabiliyetler tanımlı olsa
da her sayfanın veri kaynağı, açılma checkpoint'i, legacy temizliği ve kabul kriteri
bağlayıcı değildi. Bu tur aşağıdaki kararları plana ekler:

| Konu | Bağlayıcı karar | Plandaki yeri |
|---|---|---|
| Workspace sayısı | Home, Product, PM, Engineering, Debug View, Data Center ve Automation olmak üzere yedi workspace korunur; SDK/Bridge için sekizinci workspace açılmaz. | A.11 · B.14 · H.5 |
| Domain Pack yönetimi | Yeni yönetim yüzeyi Automation altında `/automation/domain-packs` ve `/automation/domain-packs/[packId]` route'larına yerleşir. | B.14 · D.11A |
| Mevcut URL'ler | Workflow list/history/editor/run detail, Field Login, Load Tour ve Debug View URL'leri korunur; motor ve data source değişir. | D.11A · H.5 |
| API cutover | Page doğrudan legacy kaynağa sessiz fallback yapmaz; hedef service/DTO ve geçici compatibility adapter açıkça tanımlanır. | D.11B |
| Availability | Her sayfa/checkpoint için available/read-only/blocked/measurement-only/removed durumu server capability snapshot'ından türetilir. | B.14 · D.11C |
| Page acceptance | Route smoke, auth/RBAC, loading/empty/error, deep-link, data-source ve legacy-zero kontrolleri CP6/CP7/CP9'a bağlanır. | D.11C · G.1–G.2 |
| Korunan yüzeyler | Product/PM/Engineering Tools/Data Center ve kalıcı ADB sayfaları non-regression suite ile korunur. | D.11A · G.1 |
| Placeholder'lar | Home alt sayfaları, Calendar, Roadmap ve Screen Manual platform DoD'sine girmez; tamamlanmış Cockpit sayılmaz ve ayrı backlog'da kalır. | D.20 · H.5 |

## Denetim Turu 6 — Düşük gecikmeli evidence, sonuç eksenleri ve runtime güvenliği

Durability, fiziksel cihaz concurrency'si ve Domain Pack çalıştırma modeli yeniden
incelenmiştir. Önceki mimari yön korunmuş; aşağıdaki sözleşmeler checkpoint'lerden
önce bağlayıcı hale getirilmiştir:

| Konu | Bağlayıcı karar | Plandaki yeri |
|---|---|---|
| Çift evidence hattı | Commit edilmiş receipt-safe fact'ler gap arkasında kalmadan `DurableReceiptBus` üzerinden Continue Gate'i uyandırabilir; sıra bağımlı reducer, Final Oracle, audit ve replay `OrderedEvidenceBus` kullanır. | B.5 · D.2 · CP2 |
| Lane güvenliği | Her source/fact `RECEIPT_SAFE` veya `ORDERED_REQUIRED` ilan eder; order-sensitive derivation receipt hattında çalışamaz. | B.5 · B.10F · D.6E |
| Run sonucu | Lifecycle, business verdict, termination reason, cleanup result ve operational disposition ayrı eksenlerdir; cleanup failure business PASS'i ezmez. | B.8 · B.13 · D.8–D.10 |
| Komut admission | Control, observation, wait ve mutation lane'leri cihaz başına bounded admission, tek mutation ve invalidation kurallarıyla yönetilir. | B.7 · D.3–D.4 · CP3 |
| Wait liveness | `wait_any` ilk scoped evaluation + event-driven reevaluation + bounded/adaptive scoped safety rescan kullanır; full-tree polling yasak kalır. | B.10D · D.6D · G.4 |
| Oracle şeması | Zorunluluk ve zamanlama paralel string listeleriyle değil fact-bazlı `OracleRequirement` ile modellenir. | B.10E · D.5 · D.9 |
| Derived fact | Dependency DAG, cycle rejection, provenance, reducer idempotency ve active-run bundle pinning zorunludur. | B.10F · D.6E · CP4B |
| Pack güveni | V1 pack'i CI/publish sırasında doğrulanan, immutable ve SHA-256 pinli bundle'dır; runtime arbitrary TypeScript çalıştırmaz. | B.10A · D.6B · C.46 |
| Performans bütçesi | CP0 baseline'ından sonra cihaz/profil-bazlı `PerformanceBudget v1` dondurulur; ölçülmemiş örnek eşikler master kararı olmaz. | G.6 · CP0 · CP8 |
| İş paketleri | Checkpoint çalışma paketleri master plan version/hash'ine bağlıdır; sözleşme veya kapsam için ikinci SSOT oluşturamaz. | G.8 |

## Denetim Turu 7 — Evidence teşhisi, ekran semantiği ve güvenilir repro

SDK emit sonucu, durable transport, host ingest, normalization/correlation ve Cockpit
sunumu birlikte incelenmiştir. “Event görünmedi” ifadesinin tek başına SDK arızası
olmadığı; compact rozetlerin runtime applicability bilgisinden türemesi ve otomasyon
dokunuşunun manuel kullanıcı etkileşimi gibi raporlanmaması gerektiği bağlayıcı hale
getirilmiştir:

| Konu | Bağlayıcı karar | Plandaki yeri |
|---|---|---|
| Evidence Journey | Emit attempt'ten Oracle evaluation'a kadar dokuz aşama ayrı izlenir; `NOT_OBSERVED` hiçbir aşamada otomatik `FAILED` değildir. | B.16 · D.22 · CP5 |
| EmitOutcome görünürlüğü | SDK `EmitOutcome` yerel dönüş değeridir; çağıran raporlamadıkça veya bounded diagnostic state ile kanıtlanmadıkça host yokluktan sonucu tahmin etmez. | B.16 · C.48 |
| Katman sunumu | Compact node yalnız uygulanabilir UI/App/Local/Remote rozetlerini; detay dört katmanın tamamını explicit applicability state'iyle gösterir. Runtime authority compiled occurrence snapshot'ıdır. | B.17 · D.23 · CP6 |
| Rozet zamanı | UI/App/Local/Remote sıralı animasyonla sahte chronology üretmez; her rozet kendi evidence transition'ında güncellenir, gerçek sıra waterfall'da gösterilir. | B.17 · C.50 |
| Interaction origin | Etkileşim `BRIDGE_INJECTED`, `MANUAL` veya `UNKNOWN` olur; korelasyonsuz SDK click otomatik manuel sayılmaz. | B.17 · D.23 · CP6–CP7 |
| Repro doğruluğu | Repro yalnız gerçekten yakalanmış command/response/evidence/artifact'i taşır; geçmiş full dump sonradan varmış gibi üretilemez. Failure'da bounded scoped capture uygulanır. | B.17 · D.15–D.16 |
| UI uygulama sırası | Önce read model + Evidence Journey drawer + repro, sonra static applicable badges, en son live subscription/animation yapılır. | D.23 · Faz 6 |

## Denetim Turu 8 — Nesy Cockpit v1 Test Profile Catalog kararı

Nesy'ye sunulacak gerçek Cockpit v1'in yalnız “tek workflow doğru çalıştı mı?”
sorusunu cevaplaması yeterli değildir. Nesy'nin günlük kalite operasyonu şu daha
geniş soruları da aynı kanıt modeliyle cevaplamak zorundadır:

```text
Uygulama temel olarak çalışıyor mu?
Yeni build eski davranışı bozdu mu?
Process kill sonrasında işlem kurtuldu mu?
Offline queue düzgün temizlendi mi?
Payment/fiscal duplicate oluştu mu?
120 stopta performans bozuluyor mu?
Datecs, Urovo ve farklı Android cihazlarda çalışıyor mu?
API değişikliği mobile zarar verdi mi?
Release APK'da automation yüzeyi sızdı mı?
```

Bu ihtiyaçlar 11 ayrı test motoru anlamına gelmez. Bağlayıcı karar şudur:

> **Cockpit v1, tek deterministic WorkflowIR + Domain Pack + BridgeFlow + Final
> Oracle runtime'ı üzerinde çalışan versioned ve declarative Test Profile Catalog
> sunar. Smoke, Regression, Recovery, Bad Day, Load, Soak, Compatibility ve Security
> ayrı altyapılar değil; aynı workflow/evidence/oracle motorunun veri seti, tekrar,
> fault, cihaz matrisi, telemetry ve schedule politikasıyla paketlenmiş profilleridir.**

### Launch Profile ile Test Profile ayrımı

Launch Profile testin nereden ve hangi başlangıç koşuluyla başlayacağını tanımlar:

```text
FULL_JOURNEY
PREPARED_SESSION
DIRECT_STATE
```

Test Profile ise şu daha üst seviyedeki operasyonel koşum sözleşmesidir:

```text
Hangi workflow?
Hangi launch profile?
Hangi dataset?
Kaç tekrar?
Hangi cihaz/build/env matrisi?
Hangi network/fault politikası?
Hangi telemetry bütçesi?
Hangi Continue Gate ve Final Oracle template'i?
Hangi schedule class: PR, nightly, weekly, release?
```

Bu ayrım korunmazsa Cockpit v1 iki hatadan birine düşer:

1. Her metodoloji için ayrı runner/engine eklenir ve platform tekrar parçalanır.
2. Launch Profile'a test amacı, cihaz matrisi, fault ve release policy yüklenir;
   başlangıç sözleşmesi ile kampanya sözleşmesi birbirine karışır.

### V1 core kapsamına girecek profiller

V1 core profilleri Nesy Courier Domain Pack içinde first-party ve versioned tanımlar
olarak bulunur. Bunlar ürün sonrası lüks değil, Nesy'nin gerçek saha kalite kapısıdır.

| Profil | V1 amacı | Ana kanıt |
|---|---|---|
| Smoke | Her APK/PR/release candidate sonrası temel kurye yolunun çalıştığını göstermek | UI/App/Local/Remote readiness + crash/ANR yokluğu |
| Critical Regression | En kritik business akışlarının yeni build'de bozulmadığını göstermek | Önceki build ile yeni build evidence/fact farkı |
| Differential Regression | “PASS ama farklı davranış” sınıfını yakalamak | Build A/B fact sequence ve Oracle requirement diff |
| Recovery | Process kill, force stop, token expire, offline/online geçiş sonrası tutarlılığı göstermek | Local/Remote/Queue consistency, duplicate yokluğu |
| State-Aware Bad Day | Rastgele fault değil, business fact oluştuğu anda kontrollü fault enjekte etmek | Fault trigger evidence + sonrası Oracle |
| Business Contract & Consistency | HTTP schema + app usage + local state + remote business outcome'u beraber doğrulamak | Contract violation, consistency failure |
| Normal/Busy Load | 60/120 stop veri profiliyle performans ve jank riskini ölçmek | Readiness latency, memory, Room query, queue flush |
| Compatibility Certification | Datecs/Urovo/Samsung/CI emulator ve Android/capability matrisini sertifikalamak | Smoke + scanner/payment/fiscal/offline subset |
| Short Soak | 30-60 dakika tekrar eden gerçek kullanımda sızıntı ve drift aramak | Memory slope, thread/fd trend, queue residual |
| Security / Release Isolation | Automation yüzeyinin release'e sızmadığını ve komutların fail-closed olduğunu göstermek | HMAC, allowlist, redaction, named-query ve Bridge scope |

Bu liste Cockpit içine “on ayrı product” olarak yerleşmez. Operator için ayrı
profil kartları ve kampanya koşumları görünür; runtime tarafında hepsi aynı
BridgeFlowPlan, Evidence Journey ve Final Oracle altyapısını kullanır.

### Smoke Profile

Smoke profile her APK, PR veya release candidate sonrasında çalıştırılacak en kısa
güven kapısıdır. Örnek akış:

```text
App aç
→ login
→ schedule/route yükle
→ stop list aç
→ shipment aç
→ delivery başlat
→ geri dön
```

Bu yalnız ekran varlığı testi değildir. Smoke başarı sayılması için:

```text
UI hazır
APP state doğru
Local veri oluştu
Remote gerekli ise doğrulandı
Crash/ANR yok
Unknown blocking surface yok
```

olmalıdır. Smoke Profile'ın amacı bütün business varyasyonlarını kapsamak değil,
build'in temel kurye kullanımını bozmadığını hızlı ve açıklanabilir şekilde
göstermektir.

### Critical ve Differential Regression

V1'de tüm olası akışlar değil, Nesy'nin kritik business akışları profile edilir:

```text
Login ve session
Route/schedule
Normal delivery
COD delivery
Multicolli
Partial/refuse
Offline delivery
Queue flush
Payment
Fiscal
Scanner
Pickup
Tour başlangıç/bitiş
```

Klasik regression yalnız “aynı workflow PASS mi?” sorusunu cevaplar. Differential
Regression ise önceki build ile yeni build'in evidence/fact davranışını karşılaştırır:

```text
Build A:
PAYMENT_COMPLETED → FISCAL_CREATED → DELIVERY_PERSISTED

Build B:
PAYMENT_COMPLETED → DELIVERY_PERSISTED
FISCAL_CREATED eksik
```

Build B teknik olarak ekranı yeşile boyasa bile Differential Regression bu kaybı
ürün riski olarak gösterir. Karşılaştırma screenshot diff'e veya selector davranışına
değil, versioned normalized fact sequence, Final Oracle requirement ve Evidence
Journey stage farklarına dayanır.

### Recovery Profile

Recovery, Nesy için en kritik v1 profillerinden biridir. Testin başarısı uygulamanın
yeniden açılması değildir; business state'in tutarlı ve duplicate üretmeden devam
edebilmesidir.

V1 minimum recovery senaryoları:

```text
Payment sırasında process kill
Fiscal sırasında process kill
Delivery persist öncesi kill
Queue flush sırasında kill
Token expire
Offline → online recovery
Room write sırasında restart
Bridge/action response kaybı
```

Başarı koşulları:

```text
UI doğru yerde veya güvenli recovery yüzeyinde
Local state tutarlı
Remote state tutarlı
Queue recoverable veya boş
Duplicate payment yok
Duplicate fiscal yok
Orphan delivery yok
Unknown action effect sahte retry ile gizlenmiyor
```

Bu profil Verdict'in Maestro karşısındaki ana ticari ayrışmalarından biridir; çünkü
yalnız element beklemek değil, evidence ve Oracle ile state kurtarma doğrulanır.

### State-Aware Bad Day Profile

Tam autonomous resilience discovery v1'e girmez; ancak kontrollü Bad Day profilinin
v1'de olması gerekir. Fault rastgele saniyede uygulanmaz. Fault bir business fact,
UI surface, local state veya network operation oluştuğunda tetiklenir.

İlk fault seti:

```text
Network disconnect/reconnect
Latency/timeout
Process kill
Force stop
Token expire
Duplicate callback
Backend 500/timeout
Permission revoke
Clock/timezone değişimi
Düşük storage uyarısı
```

Doğru tetikleme örnekleri:

```text
PAYMENT_REQUEST_SENT oluşunca ağı kes
QUEUE_FLUSHING başladığında process kill uygula
FISCAL_REQUEST_SENT sonrası backend timeout ver
LOCAL.DELIVERY_PERSISTING sırasında app process'i öldür
```

Bu nedenle `FaultPlan`, WorkflowIR içine yeni özel business node eklemez; Test Profile
tarafında fact/surface/source trigger olarak tanımlanır ve runtime bunu aynı
BridgeFlowExecutor içinde uygular.

### Business Contract & Consistency Profile

Bu profil yalnız API schema testi değildir. Nesy'deki silent failure sınıflarını
yakalamak için dört şeyi birlikte doğrular:

```text
API schema
+ uygulamanın kullandığı alan
+ local state
+ business outcome
```

Örnekler:

```text
HTTP 200 ama deliveryId yok
→ FAIL_REMOTE / business contract violation

Backend DELIVERED ama Room ASSIGNED
→ consistency failure

Remote route var ama UI route listesinde görünmüyor
→ UI/APP/LOCAL/REMOTE conflict
```

Transport success business success değildir. Bu profil B.10F Evidence Source
Registry ve B.10E Final Oracle requirement modelini v1 ürünü olarak görünür kılar.

### Load Profile

V1'de tam breaking-point laboratuvarı hedeflenmez. Ancak kurye uygulaması olduğu için
normal ve yoğun veri profilleri zorunludur:

```text
NORMAL: 60 stop / 300 shipment
BUSY:   120 stop / 600 shipment
PEAK:   250 stop / 1200 shipment
```

V1 core kapsamı `NORMAL` ve `BUSY` profilleridir. `PEAK` weekly/release veya v1.1
genişleme olarak ölçülebilir. Ölçümler:

```text
Route yükleme
Stop list readiness
Scroll/jank
Search/filter
Delivery süresi
Memory peak ve geri dönüş
Room query süreleri
Queue flush süresi
Bridge wait/action latency
SDK observation payload bütçesi
```

Performance sayıları CP0/CP3/CP8 ölçümleriyle profile-specific budget olarak
dondurulur; ölçülmemiş örnek değerler release gate olamaz.

### Compatibility Certification Profile

Nesy saha cihazları nedeniyle v1'de minimum certification matrisi bulunmalıdır:

```text
Datecs
Urovo
Temsilci Samsung düşük segment
CI emülatörü
Desteklenen minimum Android
Desteklenen güncel Android
Scanner/printer/payment/fiscal capability varyantları
```

Her kombinasyonda full regression çalıştırmak v1 için gerçekçi değildir. Minimum
sertifikasyon:

```text
Smoke
+ kritik payment/fiscal
+ scanner
+ offline/recovery
+ release isolation
```

olmalıdır. Certification sonucu Run Detail'den ayrı bir Campaign summary ile
sunulur; tek cihazdaki PASS bütün cihaz matrisini PASS yapmaz.

### Security / Release Isolation Profile

Verdict SDK ve Accessibility Bridge kullandığı için bu profil enterprise satış ve
production güvenliği için v1 core kapsamındadır. Kontroller:

```text
Release APK'da automation SDK yok
Automation receiver/provider dışarı açık değil
HMAC'siz komut reddediliyor
Eski run secret tekrar kullanılamıyor
Screenshot/dump redaction uygulanıyor
Named query allowlist dışına çıkamıyor
Bridge farklı uygulama/window üzerinde action yapmıyor
PIN/token/log sızıntısı yok
Scanner injection ve DIRECT_STATE release build'de yok
```

Bu profil yalnız güvenlik test listesi değildir; release candidate için GO/NO_GO
kanıtı üretir.

### V1 preview ve v1 sonrası sınırları

V1 preview olarak sınırlı iki alan kabul edilir:

```text
Basic Accessibility Audit
Coverage-guided Smart Explorer Preview
```

Basic Accessibility Audit yalnız Bridge'in güvenilir biçimde görebildiği konularla
sınırlıdır:

```text
Labelsız clickable node
Eksik content description
Küçük touch target
Focusable metadata
Basit focus order sorunları
```

Renk kontrastı, büyük font overflow ve tam screen-reader deneyimi v1 core iddiası
değildir; bunlar screenshot/visual analysis ve varyant koşumları gerektirir.

Smart Explorer Preview da release gate değildir. Pilot davranış şudur:

```text
Bridge görünür geçerli aksiyonları çıkarır
→ daha önce görülmemiş screen/transition'a öncelik verir
→ crash/ANR/unexpected surface arar
```

V1 dışında kalacaklar:

```text
Tam persona monkey sistemi
RL tabanlı autonomous explorer
Otomatik failure minimization
Tam 3-wise/çoklu chaos optimizasyonu
Self-learning Oracle
AI exploratory pilot'un bağımsız karar vermesi
Tam görsel accessibility/design audit
Otomatik breaking-point keşfi
Cross-platform test metodoloji motoru
```

Bu sınırların amacı değeri azaltmak değil, Cockpit v1'i kullanılabilir ve
deterministik tutmaktır. V1'in ürün mesajı şudur:

> **Verdict, Nesy'nin smoke, regression, recovery, resilience, performance ve
> compatibility testlerini ayrı araçlarda çalıştırmaz; hepsini aynı business evidence
> ve Oracle modeli üzerinde doğrular.**

### Nightly, weekly ve release campaign politikası

Her şeyi her gece arka arkaya çalıştırmak cihaz kapasitesini tüketir ve sinyal/gürültü
oranını düşürür. V1 campaign schedule sınıfları şunlardır:

| Schedule | Çalışacak kapsam |
|---|---|
| PR | Impact-selected Smoke, kritik business invariants, contract check, kısa differential regression |
| Nightly | Critical regression, recovery set, Bad Day short set, 60/120-stop load, short soak, compatibility smoke |
| Weekly | Extended chaos, 250-stop peak, 4-8 saat soak, geniş cihaz matrisi, accessibility/design preview, explorer preview |
| Release candidate | Country/device certification, payment/fiscal recovery, full local/remote reconciliation, security gate, Oracle mutation score |

Schedule policy profile'ın parçasıdır; runtime'ın farklı engine seçmesi anlamına
gelmez. Aynı Test Profile farklı schedule class altında farklı dataset, repeat ve
device matrix ile çalışabilir.

## Denetim Turu 9 — Core + Domain Pack node sözleşmesi kararı

Core + Domain Pack mimarisi bu planda gerçek anlamda vardır: paket sınırları,
registry'ler, compiler sırası, App Adapter, editor, runtime ve checkpoint acceptance
zinciriyle tanımlanmıştır. Ancak mimarinin doğru olması, Nesy semantic node'larının
geliştirici yorumuna açık bırakılabileceği anlamına gelmez.

Bu denetimde verilen net hüküm şudur:

> **Plan, `OPEN_STOP`, `COURIER_LOGIN`, `SELECT_ROUTE`, `PROCESS_PARCEL` ve
> `COMPLETE_DELIVERY` gibi Nesy node'larının hangi mimari parçalar kullanılarak
> oluşturulacağını tanımlar; fakat Faz 4B başlamadan bu node'ların canonical örnek
> sözleşmeleri `NESY_COURIER_DOMAIN_PACK_REFERENCE_V1` olarak dondurulmalıdır.**

Bu yeni runtime requirement değildir. Bu, mevcut Domain Pack kararının uygulanabilir
referans sözleşmesidir. Amaç, aynı mimariyi okuyan iki geliştiricinin `OPEN_STOP`
ve `COURIER_LOGIN` gibi semantic macro'ları farklı şekillerde yorumlamasını önlemektir.

Bağlayıcı node seviyesi ayrımı:

| Seviye | Kim görür? | Örnek | Sorumluluk |
|---|---|---|---|
| Domain Authoring Node | Cockpit kullanıcısı | `Courier Login`, `Open Stop`, `Complete Delivery` | Nesy Courier Domain Pack iş dilidir |
| Generic WorkflowIR Step | Compiler/runtime | `SDK_QUERY`, `RESOLVE_TARGET`, `BRIDGE_ACTION`, `WAIT_ANY`, `ASSERT_FACT` | Verdict Core'un app-agnostic çalışma modelidir |
| Runtime Occurrence | Executor/Run Detail | `OPEN_STOP occurrence stop-042 attempt 1` | Entity, iteration, evidence ve Oracle korelasyonudur |

Kural:

```text
Cockpit kullanıcısı scroll_to_item + tap + wait_any + assert activeStop görmez.
Cockpit kullanıcısı Open Stop görür.

Verdict Core ise hiçbir zaman Open Stop bilmez.
Core yalnız Open Stop'un derlendiği generic adımları çalıştırır.
```

Bu nedenle Bridge'e şu tür business komut gönderilmesi yasaktır:

```json
{
  "command": "OPEN_STOP",
  "stopId": "42"
}
```

Bridge'e yalnız generic, scoped ve correlated UI komutları gider:

```text
resolve/find
scroll_to_target
activate/tap
input
wait_any
screenshot/capture
```

`STOP`, `PARCEL`, `ROUTE`, `DELIVERY`, `MATCH`, `BETTING` gibi business kavramları
Core veya Bridge protocol içine sızmaz. Bunlar Domain Pack, App Adapter, Test Profile
ve workflow authoring katmanında kalır.

Faz 4B'nin ilk teslimlerinden biri `NESY_COURIER_DOMAIN_PACK_REFERENCE_V1` olmalıdır.
Bu referans spec en az altı vertical slice içerir:

```text
COURIER_LOGIN
SELECT_ROUTE
OPEN_STOP
PROCESS_PARCEL
COMPLETE_DELIVERY
TOUR_APPROVAL_LIFECYCLE
```

Her vertical slice için zorunlu alanlar:

```text
Business anlamı
Input schema
Output schema
Preconditions
Screen/surface contract
Entity binding
Target resolution policy
Macro expansion
Continue Gate
Final Oracle
Error/interrupt policy
Required capabilities
Generic IR snapshot
BridgeFlowPlan snapshot
Editor palette görünümü
Source-map/provenance örneği
```

Bu spec olmadan D.6C implementation “tamamlandı” sayılamaz. Macro'nun yalnız isminin
bulunması yeterli değildir; compiler expansion ve runtime occurrence davranışı
kanıtlanmalıdır.

`TOUR_APPROVAL_LIFECYCLE` özel bir Core veya Bridge komutu değildir. Bu slice,
kurye aktörünün Mobile UI üzerinden tur onayı istemesi ile dispatcher/supervisor
aktörünün Nesy Backoffice/Backend adapter üzerinden turu onaylamasını aynı workflow
occurrence'ında koordine eden **multi-actor Domain Pack reference** örneğidir.

Bu slice'ın canonical expansion'ı generic primitive'lere açılır:

```text
BRIDGE_ACTION
WAIT_FACT
REMOTE_ACTION
ASSERT_REMOTE
WAIT_ANY
ASSERT_APP
ASSERT_UI
```

Core'un bildiği şey `REMOTE_ACTION`, adapterRef, operationRef, typed input,
idempotency, correlation, resource requirement ve output fact binding'dir. Core ve
Bridge `APPROVE_TOUR`, `TOUR`, `DISPATCHER` veya Nesy backoffice endpoint adlarını
bilmez.

Bu slice iki ayrı kullanım modunu zorunlu olarak ayırır:

| Mod | Amaç | Ürün verdict'i üretir mi? |
|---|---|---|
| Gerçek tur onayı testi | Backend approval + push/notification + app state + UI zincirini kanıtlamak | Evet |
| Precondition / fixture setup | Başka delivery/payment/tur adımı için remote state hazırlamak | Hayır; setup PASS'i tur onayı ürün PASS'i olamaz |

Gerçek tur onayı testinde Continue Gate minimum şu kanıtlarla açılır:

```text
REMOTE.TOUR_STATUS_APPROVED
AND APP.TOUR_APPROVED
AND UI.TOUR_APPROVED_MESSAGE_VISIBLE
```

Push/bildirim gerçekten test ediliyorsa `REMOTE.APPROVAL_NOTIFICATION_DISPATCHED`
ve mobile receive/app state kanıtı zorunludur. Amaç yalnız sonraki testi hazırlamaksa
kontrollü refresh/direct synchronization kullanılabilir; fakat bu koşum “push
başarıyla geldi” veya “tur onayı UI entegrasyonu doğru” hükmü üretemez.

## Denetim Turu 10 — Feature Blueprint, Capability Contract ve Run Plan kararı

Maçkolik gibi yüzlerce feature, yüzlerce ekran, çok sayıda component instance'ı ve
binlerce test senaryosu taşıyan ürünlerde doğru model “3000 adımlı tek test” değildir.
Doğru model, bağımsız çalışabilen küçük test workflow'larının immutable Run Manifest
altında planlandığı, lease/resume ile dağıtıldığı, resource izolasyonu ile birbirini
kirletmediği ve reusable capability contract'larla ölçeklendiği kalıcı bir Run Plan
modelidir.

Bu karar yalnız Maçkolik için geçerli değildir. Nesy'de de 120 stop, çoklu parcel,
payment/fiscal recovery, offline queue flush, scanner, printer ve device matrix
senaryoları aynı ölçekleme riskini taşır. Tek uzun workflow veya tek shared user/device
state'i, 67. adımda veya 1200. testte koptuğunda bütün suite'i yeniden başlatan,
root-cause'ı bulanıklaştıran ve veri çakışması üreten bir yapıya dönüşür.

Bağlayıcı ayrım:

| Kavram | Amaç | Verdict sonucu üretir mi? |
|---|---|---|
| Reusable Flow Fragment | Login, consent dismiss, open match detail, reset app gibi tekrar kullanılabilir küçük setup/yardımcı akış | Hayır; tek başına ürün verdict'i değildir |
| Independent Test Workflow | `TransferCardCanBeLikedOnce`, `BettingTabLoadsWithoutWebViewError`, `CompleteDeliveryPersistsLocalAndRemote` gibi bağımsız hüküm üreten test | Evet |
| Test Suite / Run Plan | Hangi workflow'ların hangi build, device, fixture, schedule ve resource ile çalışacağını belirler | Campaign/suite sonucu üretir |
| Run Manifest | Bir campaign/suite başladığında dondurulan test execution listesi, version ve resource planı | Execution SSOT'tur |
| Test Data Broker | Account, backend fixture, app state ve external resource lease/cleanup yönetir | Hayır; precondition ve isolation sağlar |

Kural:

```text
Login bozuksa:
  Login testi FAILED olur.
  Login'e bağımlı testler FAILED değil BLOCKED olur.
  Public haber listesi gibi login gerektirmeyen testler çalışmaya devam eder.
```

Verdict “kaçıncı testte kaldım?” diye düşünmez. Verdict DB'den “hangi test execution
terminal state'e ulaşmadı, hangisinin lease'i doldu, hangisi dependency nedeniyle
blocked?” diye bakar.

Durable execution sonucu tek status alanı değildir. Ayrı eksenler:

```text
ExecutionLifecycle:
  PENDING / READY / LEASED / RUNNING / TERMINAL

ProductVerdict:
  NOT_EVALUATED / PASS_ONLINE / PASS_QUEUED_OFFLINE / FAIL_PRODUCT /
  INCONCLUSIVE

EvaluationFailureClass:
  NONE / AUTOMATION_FAILURE / ENVIRONMENT_FAILURE / EVIDENCE_INSUFFICIENT

SchedulerDisposition:
  COMPLETED / RETRYABLE / BLOCKED / SKIPPED / CANCELLED / ORPHANED /
  RECONCILIATION_REQUIRED

TerminationReason:
  NORMAL / ASSERTION_FAILED / WORKER_LOST / DEVICE_LOST / RESOURCE_UNAVAILABLE /
  DEPENDENCY_FAILED / OPERATOR_CANCELLED / TIMEOUT / UNKNOWN_EFFECT
```

Worker ölürse `RUNNING` execution otomatik “başarısız test” olmaz. Fiziksel etki
başlamamışsa `RETRYABLE`, dispatch sonrası cevap kaybolmuşsa
`RECONCILIATION_REQUIRED`, sahipliği kopmuş artifact/execution varsa `ORPHANED`
olarak ayrılır. Suite baştan başlamaz; fakat bilinmeyen fiziksel etki sessizce tekrar
edilmez.

Ölçeklenebilir domain bilgi modeli üç seviyelidir:

| Seviye | Kim bilir? | Örnek |
|---|---|---|
| Universal UI Semantics | Verdict Core | Button, Text, Image, Modal, Tab, List, Carousel, WebView, Input, Loading, Error |
| Reusable Capability Contract | Domain Pack / shared capability catalog | HorizontalCarousel, SingleChoiceReaction, OneTimeAction, AsyncConversation, PaginatedFeed, SubscriptionGate |
| Feature Business Contract | Product/domain owner onaylı Feature Blueprint | Transfer kartında yalnız bir reaksiyon, reaction persistence, remote success olmadan kesin success göstermeme |

Core ekrana nasıl dokunacağını bilir. Capability Contract component sınıfının genel
davranışını bilir. Feature Blueprint ilgili özelliğin business invariants set'ini
bilir. Workflow yolu izler. Oracle sonucu değerlendirir. Run Planner neyin, nerede,
ne zaman ve hangi kaynakla paralel çalışacağını belirler.

AI bu modelde business kural uydurmaz. AI ekranı keşfedebilir, component/capability
önerisi yapabilir, Feature Blueprint taslağı çıkarabilir ve eksik invariant'ları soru
olarak sunabilir. Authoritative Feature Business Contract ürün ekibi veya domain owner
onayı olmadan aktif olmaz.

Bu kararın sonucu:

```text
Az sayıda reusable capability
+ feature'a özel deklaratif business contract
+ bağımsız workflow execution
+ durable run manifest / resource lease
= Maçkolik ve Nesy gibi büyük domain'lerde yönetilebilir automation işletim modeli
```

## Denetim Turu 11 — Package boundary, execution axis ve scale critical-path düzeltmesi

Feature Blueprint + Capability Contract + Run Plan katmanı doğru yöndür; ancak ilk
eklemede execution/orchestration kavramları Domain Pack contract paketi içine fazla
yaklaşmıştır. Bu planın v1.1.0 düzeltmesi şu kararları bağlayıcı hale getirir:

1. `packages/domain-pack-contracts` Domain Pack authoring ve executable domain
   contract'larını taşır; lease, worker heartbeat, TestExecution lifecycle ve scheduler
   state machine burada bulunmaz.
2. Execution kavramları ayrı `packages/execution-contract` paketine taşınır:
   `RunManifest`, `TestExecution`, `ExecutionLifecycle`, `ProductVerdict`,
   `EvaluationFailureClass`, `SchedulerDisposition`, `TerminationReason`,
   `WorkflowCleanupResult`, `ResourceReleaseResult`, `Lease`, `ResourceRequirement`,
   `ResourceLease` ve `SchedulerPolicy`.
3. Impact/coverage seçimi Domain Pack metadata'sı olarak referanslanabilir; ancak
   `ImpactGraph`, `ChangeReference`, `CoverageReference` ve `SelectionReason` ayrı
   `packages/impact-contract` sınırında tutulur. Başlangıçta fiziksel paket ayrımı
   küçük görünse bile Domain Pack paketine konulmaz.
4. Test execution sonucu tek `PASSED/FAILED/BLOCKED` alanına sıkıştırılmaz. Planın
   önceki doğru prensibi korunur: lifecycle, business verdict, scheduler disposition,
   termination reason, cleanup result ve operational disposition ayrı eksenlerdir.
5. `ORPHANED` otomatik retry anlamına gelmez. Lease süresi dolmuş ama fiziksel etki
   başlamamış işler `RETRYABLE` olabilir; dispatch sonrası cevabı kaybolmuş işler
   `UNKNOWN_EFFECT/RECONCILIATION_REQUIRED` olur ve Local/Remote reconciliation
   yapılmadan tekrar çalıştırılamaz.
6. Test Data Broker sadece reset servisi değildir. Kaynak lifecycle'ı `CLEAN`,
   `DIRTY`, `QUARANTINED`, `RECONCILIATION_REQUIRED` ve
   `MANUAL_RELEASE_REQUIRED` state'lerini taşıyabilir.
7. Run Manifest exact reproduction için yalnız workflow ve pack digest'i pinlemez;
   App Adapter, Launch Profile, Test Profile, dataset/fixture, fault plan, Oracle
   template, Evidence Source Registry, Performance Budget, remote environment snapshot,
   device capability snapshot, resource plan, compiler, WorkflowIR, Bridge protocol ve
   SDK protocol version'larını da pinler.
8. CP4B critical path sadece Nesy vertical slice için zorunlu Domain Pack çekirdeğini
   kapsar. Run Manifest/Execution Queue/Test Data Broker CP5-scale işidir; full
   Impact Graph/Coverage Graph/Component Registry ve Maçkolik geniş katalog CP6/CP7
   scale işidir.
9. Capability Catalog katmanlıdır: `verdict.capabilities.core`,
   `nesy.capabilities` ve `mackolik.capabilities`. Ortaklaşan capability daha sonra
   kanıtla core/shared kataloğa terfi ettirilir; ilk günden sahte abstraction
   yapılmaz.
10. Feature Blueprint iki parçaya ayrılır: `FeatureAuthoringMetadata` ve
    `FeatureExecutableContract`. Owner/description/risk gibi authoring metadata
    değişiklikleri executable plan hash'ini gereksiz değiştirmez.

Bu amendment CP4B ve CP5 başlamadan uygulanması gereken P0 mimari sınır düzeltmesidir.

## Denetim Turu 12 — Multi-actor Remote Action ve Nesy tur onayı kararı

Nesy tur onayı gibi senaryolarda test yalnız cihazdaki kurye aktöründen ibaret
değildir. Gerçek ürün akışında ikinci aktör vardır: dispatcher/supervisor/backoffice
operatörü. Verdict bu ikinci aktörü görünmeyen script veya rastgele HTTP çağrısı
olarak değil, typed, allowlisted, effect-aware ve audited `REMOTE_ACTION` primitive'i
ile modeller.

Bağlayıcı karar:

```text
Courier Actor
  → Mobile UI / Bridge action / App evidence

Dispatcher Actor
  → Nesy Backoffice Adapter / Remote business mutation / Remote validation
```

`REMOTE_ACTION` WorkflowIR v2 içinde domain-neutral primitive'dir. En az şu alanları
taşır:

```ts
interface RemoteActionStep {
  kind: "REMOTE_ACTION";
  adapterRef: string;
  operationRef: string;
  inputBindings: Record<string, ValueExpression>;
  idempotency: {
    class: "READ_ONLY" | "IDEMPOTENT" | "IDEMPOTENCY_KEY_REQUIRED" | "NON_IDEMPOTENT";
    keyExpression?: ValueExpression;
  };
  correlation: {
    runId: true;
    occurrenceId: true;
    entityBindings: string[];
  };
  timeoutPolicy: TimeoutPolicy;
  resourceRequirements: ResourceRequirementRef[];
  outputFactBindings: FactBinding[];
  reconciliationPolicy?: ReconciliationPolicyRef;
}
```

Nesy tur onayı özelinde Domain Pack şu semantic node'ları tanımlayabilir:

```text
REQUEST_TOUR_APPROVAL
APPROVE_TOUR_AS_DISPATCHER
WAIT_FOR_TOUR_APPROVAL
```

veya editörde tek macro:

```text
COMPLETE_TOUR_APPROVAL
```

Ancak compiler bu macro'yu generic IR adımlarına açar; Bridge veya Core'a
`APPROVE_TOUR` business komutu gitmez.

Nesy Backoffice Adapter iki backend çağrısını ve remote doğrulamasını typed/audited
şekilde taşır:

```text
nesy.backoffice.approve-tour.request
nesy.backoffice.approve-tour.confirm
nesy.backoffice.approve-tour.status
```

HTTP 2xx transport başarısı business success değildir. Minimum remote fact'ler:

```text
REMOTE.TOUR_APPROVAL_CALL_1_ACCEPTED
REMOTE.TOUR_APPROVAL_CALL_2_ACCEPTED
REMOTE.TOUR_STATUS_APPROVED
REMOTE.APPROVAL_NOTIFICATION_DISPATCHED   // push gerçekten test ediliyorsa
```

Her remote mutation `workflowRunId`, `testExecutionId`, `occurrenceId`, `tourId`,
`courierId`, `requestId`, `idempotencyKey`, `environment` ve `serviceOperation`
correlation'ı taşır. Önerilen idempotency key:

```text
tour-approval:{workflowRunId}:{occurrenceId}:{tourId}
```

Partial mutation politikası:

```text
Servis 1 başarılı, Servis 2 başarısız
  → kör retry yok
  → remote state sorgula
  → idempotency durumunu kontrol et
  → resource RECONCILIATION_REQUIRED veya QUARANTINED
```

Bu karar master planın genel Core + Domain Pack modelini değiştirmez; yalnız CP4A,
CP4B, CP5 ve CP7 work-package'larında unutulmaması gereken acceptance maddelerini
bağlayıcı hale getirir.

## Decision Index v1.1.3

Bu index master plan içindeki bağlayıcı kararların hızlı denetimi içindir. Yeni fikirler
doğrudan master plana eklenmez; yalnız P0 güvenlik/correctness açığı, contract
çelişkisi veya acceptance eksikliği amendment olarak işlenir.

| Decision ID | Başlık | Bağlayıcı karar | Kaynak bölüm | Effective | Applies | Supersedes |
|---|---|---|---|---|---|---|
| DEC-001 | Maestro tam söküm | Maestro runtime, YAML, CLI, driver, dependency, flag, DTO, DB alanı, UI ve aktif doküman referansı sıfırlanır. | Son bağlayıcı karar · Faz 9 · H.8 | v1.0.0 | CP8, CP9 | Yok |
| DEC-010 | Core business type bilmez | `STOP`, `PARCEL`, `MATCH`, `BETTING`, `OPEN_STOP` gibi domain semantic type/command Core ve Bridge contract'larına sızamaz. | B.10A · C.56 · CP4A/CP4B | v1.0.0 | CP4A, CP4B, CP4C | Yok |
| DEC-020 | WorkflowIR v2 önce gelir | Domain Pack production implementation CP4A tamamlanmadan merge edilemez. | Faz 4A | v1.0.0 | CP4A, CP4B | Yok |
| DEC-030 | Four-plane Oracle | Evidence plane sayısı UI/App/Local/Remote olarak kalır; queue Local subtype, app state App source'tur. | B.11 · C.57 · H.8 | v1.0.0 | CP5, CP6, CP7 | Yok |
| DEC-031 | Continue Gate / Final Oracle ayrımı | Step ilerleme readiness'i ile final ürün hükmü ayrı evaluator ve evidence policy kullanır. | B.18 · Faz 5 | v1.0.0 | CP4A, CP5 | Yok |
| DEC-040 | Feature Blueprint modeli | Domain business invariant'ları Product/domain owner authority'li Feature Blueprint executable contract içinde kalır. | Denetim Turu 10 · B.19 · D.25 | v1.1.0 | CP4B, CP6, CP7 | Yok |
| DEC-041 | Execution contracts Domain Pack'ten ayrılır | RunManifest, TestExecution, lease, resource lease ve scheduler state `execution-contract` sınırındadır; Domain Pack bunları taşımaz. | Denetim Turu 11 · B.19 · D.25 · H.6 | v1.1.0 | CP4B, CP5 | DEC-040 initial package placement |
| DEC-042 | Impact contract ayrıdır | ImpactGraph ve coverage/selection tipleri `impact-contract` içinde tutulur; Domain Pack yalnız impact refs beyan eder. | Denetim Turu 11 · B.19 · D.25 · H.6 | v1.1.0 | CP6, CP7 | DEC-040 initial package placement |
| DEC-043 | Test execution çok eksenli sonuç taşır | Lifecycle, ProductVerdict, EvaluationFailureClass, SchedulerDisposition, TerminationReason, WorkflowCleanupResult, ResourceReleaseResult ve OperationalDisposition ayrı tutulur. | Denetim Turu 11 · B.8 · B.19 · D.25 | v1.1.1 | CP4A, CP5, CP6 | DEC-041 old BusinessVerdict/CleanupResult naming |
| DEC-044 | Effect-aware retry | `ORPHANED` otomatik retry değildir; unknown physical effect reconciliation olmadan tekrar çalıştırılamaz. | Denetim Turu 11 · B.19 · D.25 · CP5 | v1.1.0 | CP5, CP7 | Yok |
| DEC-045 | Resource release state ayrı | Resource cleanup/release sonucu workflow cleanup'tan ayrıdır; quarantine/manual release desteklenir. | Denetim Turu 11 · B.19 · D.25 | v1.1.1 | CP5, CP7 | DEC-041 old CleanupResult naming |
| DEC-046 | Feature blueprint canonical format | Canonical Feature Blueprint `{ metadata, executable }` nested formdur; shorthand yalnız publish compiler tarafından normalize edilir. | B.19 | v1.1.1 | CP4B, CP6 | DEC-040 flat YAML example |
| DEC-047 | CP5-Scale ayrı checkpoint değildir | Scale işleri mevcut CP5/CP6/CP7 acceptance maddelerine bağlanır; formal olmayan CP5-Scale adı kullanılmaz. | Faz 4B · Faz 5 · Faz 6 | v1.1.1 | CP5, CP6, CP7 | DEC-041 CP5-Scale wording |
| DEC-048 | Master digest executable policy | MasterDigest satırı çıkarılarak LF/final-newline normalizasyonuyla SHA-256 hesaplanır; doğrulama komutu `pnpm verdict:verify-master-plan` olur. | Header · Decision Index | v1.1.1 | CP0, release docs | v1.1.0 digest policy |
| DEC-049 | Oracle taxonomy ProductVerdict ile hizalandı | `FAIL_AUTOMATION` ve `FAIL_ENVIRONMENT` ProductVerdict değildir; automation/environment/evidence sorunları EvaluationFailureClass ekseninde saklanır. | Oracle sonuç taksonomisi · CP5 | v1.1.2 | CP4A, CP5, CP6 | DEC-043 stale Oracle taxonomy wording |
| DEC-050 | Feature Blueprint canonical örneği schema ile hizalandı | Transfer Agenda YAML örneği nested canonical schema ile birebir uyumludur: uppercase risk, components/capabilityRef/targetRef, oracleTemplateRef, dependencies ve impactRefs içerir. | B.19 | v1.1.2 | CP4B, CP6 | DEC-046 incomplete canonical example |
| DEC-051 | Multi-actor remote action domain içinde kalır | Backend/backoffice aktörü typed allowlisted `REMOTE_ACTION` primitive'iyle modellenir; Nesy `TOUR_APPROVAL_LIFECYCLE` Domain Pack reference slice'tır, Core/Bridge `APPROVE_TOUR` bilmez; fixture setup tur onayı ürün PASS'i üretemez. | Denetim Turu 12 · CP4A · CP4B · CP5 · CP7 | v1.1.3 | CP4A, CP4B, CP5, CP7 | Yok |

---

# BÖLÜM A — BAĞLAM, KAPSAM VE MEVCUT DURUM

## A.0 Product Thesis — Don't just test it, prove it

Verdict bir AI test generation veya yalnızca UI automation ürünü değildir.

Verdict'in temel amacı, bir mobil aksiyonun yalnızca ekranda gerçekleştiğini değil,
o aksiyon için uygulanabilir olan ürün ve iş sonuçlarının gerçekten oluştuğunu,
korelasyonlu ve yeniden incelenebilir kanıtlarla göstermektir.

Bir çalışma yalnızca “element bulundu”, “butona basıldı”, “ekran yeşil göründü” veya
“HTTP 2xx döndü” gerekçesiyle business success üretmez. Bu sinyaller değerli olabilir,
fakat tek başlarına iş sonucunun oluştuğunu kanıtlamazlar. Verdict'in ürün farkı,
UI otomasyonunu uygulama içi, local ve remote kanıtlarla gerektiği yerde birleştirip
kanıta dayalı hüküm üretmesidir.

Bu tez mutlak bir “her testte bütün katmanlar zorunludur” iddiası değildir. Bazı
testlerin sözleşmesi yalnızca UI navigasyonu, görsel doğruluk, accessibility,
performans, jank, crash/ANR veya teknik kalite sinyali olabilir. Bu durumda App,
Local veya Remote düzlemleri `NOT_APPLICABLE` olarak kalabilir ve doğru davranış budur.
Verdict yalnızca occurrence sözleşmesinde uygulanabilir olan kanıt düzlemleri üzerinden
hüküm verir.

Occurrence'ın sözleşmesine göre uygulanabilir kanıtlar şunlardan oluşabilir:

- UI sonucu: beklenen ekran, surface, dialog, list row, input state, visual veya
  accessibility predicate'i.
- Uygulama içi state veya business event: SDK event, SDK state provider, derived fact,
  business signal veya teknik lifecycle sinyali.
- Local sonuç: database row, named query, SharedPreferences, file/cache, offline queue
  item state veya local reconciliation.
- Remote business state: backend operation, remote validator, business confirmation,
  fiscal/payment/delivery gibi harici sistem sonucu.
- Teknik kalite sinyalleri: crash, ANR, memory, jank, latency, timeout, retry, recovery
  veya soak göstergeleri.

Uygulanmayan katmanlar `NOT_APPLICABLE`'dır; bütün testlerde dört katmanın tamamı
zorunlu değildir. Bu ayrım, Verdict Core'un hem Nesy gibi offline/business-transaction
ağırlıklı saha uygulamalarını hem Maçkolik gibi UI/performance/interaction ağırlıklı
uygulamaları aynı mimariyle kapsamasını sağlar.

Verdict'in ürün çıktısı yalnız PASS/FAIL değildir. Bir run veya campaign sonucu
mümkün olduğunda şu kanıt bileşenlerini taşır:

- evidence-backed verdict
- kanıt kaynağı ve authority
- occurrence ve entity correlation
- failure boundary
- local/remote consistency durumu
- interaction origin
- reproducibility
- açıklanabilir release disposition

Bu nedenle “Don't just test it, prove it” yalnız pazarlama cümlesi değildir. Cockpit'in
UI kararını, veri modelini, Oracle contract'ını, Evidence Journey tasarımını ve release
kanıt paketini bağlayan ürün ilkesidir.

## A.0A Beachhead Market ve İlk ICP

Verdict Core app-agnostic olarak tasarlanır. İlk ürünleşme ve ticari doğrulama odağı
ise yüksek hata maliyeti taşıyan mobil saha ve operasyon sistemleridir.

İlk beachhead pazar:

- Android tabanlı saha ve operasyon uygulamaları.
- Kurye, teslimat, depo, saha satış ve servis uygulamaları.
- Offline-first veya zaman zaman bağlantısız çalışan iş akışları.
- Scanner, printer, POS, payment ve fiscal cihaz entegrasyonları.
- Local queue, uygulama state'i ve backend state'i arasında tutarlılığın kritik olduğu
  işlemler.
- Process kill, restart, duplicate operation, partial completion ve recovery riski
  taşıyan akışlar.
- Gerçek cihaz, firmware, peripheral ve ülke/konfigürasyon matrisi nedeniyle klasik
  UI automation araçlarının eksik kaldığı release doğrulamaları.

İlk ICP:

- Operasyonel mobil uygulaması şirket gelirini, fiziksel teslimatı, ödeme/fiscal
  sonucunu veya saha operasyonunu doğrudan etkileyen ekipler.
- Sessiz hata maliyeti yüksek olan, yani ekran başarılı görünse bile backend/local
  tutarsızlığı nedeniyle gerçek operasyon zararı oluşabilen ürünler.
- Gerçek cihaz ve özel donanım matrisi yöneten mobil ekipler.
- UI testlerinin ötesinde business outcome kanıtına ihtiyaç duyan QA, platform,
  release ve operasyon ekipleri.
- Release doğrulaması uzun, manuel, kişiye bağımlı ve reproduce edilmesi zor olan
  mobil ürün organizasyonları.

Bu bölüm Core mimarisine domain-specific type veya runtime requirement eklemez.
Beachhead Market, Verdict Core'un teknik kapsamını sınırlamaz; ilk ürünleşme, demo,
pilot, test profile katalogu, sales narrative ve ticari doğrulama önceliğini tanımlar.

Bu ayrım bağlayıcıdır. Core içine `courier`, `parcel`, `payment`, `fiscal`, `betting`,
`match` veya başka domain-specific business type sızdırılamaz. Bu kavramlar Domain
Pack, App Adapter, Test Profile veya müşteri özelindeki integration layer içinde kalır.
Core; WorkflowIR v2, BridgeFlow runtime, Evidence Source Registry, Final Oracle,
Evidence Journey ve Campaign mekanizmasını app-agnostic tutar.

## A.0B Enterprise Trust Principle

Verdict'in çekirdek doğrulama sistemi AI servisi olmadan da eksiksiz çalışmalıdır.

Bu ilke enterprise güveninin temelidir. Bir kurumsal müşteri release kararını,
modelin yorumu veya probabilistic önerisi üzerine değil; deterministic execution,
versioned policy, immutable evidence, provenance, replay ve açıklanabilir Oracle
hükmü üzerine kurabilmelidir.

Bağlayıcı ilkeler:

- Workflow execution deterministiktir.
- Continue Gate typed evidence ve versioned policy ile karar verir.
- Final Oracle versioned requirement, applicability, timing, deadline ve authority
  kurallarıyla hüküm üretir.
- AI runtime kararına, retry mekanizmasına, step sonucu veya release verdict'ine
  doğrudan müdahale edemez.
- AI yalnız authoring önerisi, exploratory insight, taslak rule, failure explanation
  ve post-run açıklama üretir.
- AI tarafından önerilen bağlayıcı kurallar schema validation, policy gate ve insan
  onayı olmadan aktif olamaz.
- AI servisinin unavailable olması test sonucunu değiştirmez; yalnız opsiyonel
  açıklama veya öneri yüzeyi eksik kalır.
- AI input/output redaction, tenant policy, retention ve audit kurallarına tabidir.

Enterprise güveni modelin yorumundan değil; kanıt zinciri, provenance, deterministik
replay, immutable bundle, active-run pinning ve açıklanabilir Oracle kararından gelir.

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
9. Maestro'yu ölçümlü kapıdan sonra yalnız kapatmak değil, bütün yapısıyla projeden sökmek.
10. Eski run verisini engine-neutral arşive taşımak; özel Maestro alanı veya renderer bırakmamak.
11. WorkflowIR v2 tamamlandıktan sonra app-agnostic Domain Pack contract'ını ve
    Nesy Courier Domain Pack'i kurmak.
12. Stop/task/shipment/parcel gibi dinamik entity'leri runtime query ve nested
    `FOR_EACH` ile occurrence-bazlı çalıştırmak.
13. Continue Gate ile adımın ne zaman ilerleyeceğini, Final Oracle ile işlemin
    nihai doğruluğunu birbirinden ayırmak.
14. Bridge'te sürekli full dump yerine expected/interrupt predicate'lerini yerelde
    yarıştıran bounded `wait_any` ve küçük correlated sonuç kullanmak.
15. Application, Screen, Surface, Launch Profile ve Evidence Source tanımlarını formal,
    versioned ve app-version uyumlu registry'ler haline getirmek.
16. Raw callback, canonical technical evidence ve normalized domain fact ayrımını;
    correlation/freshness/authority zinciriyle audit edilebilir kılmak.
17. Yedi workspace'i koruyarak her mevcut route'un hedef data source, availability,
    faz, legacy cleanup ve page-level kabul kriterini bağlamak.
18. Dönüşmeyen Product/PM/Engineering Tools/Data Center/ADB sayfalarını regression
    gate ile korumak; bilinçli placeholder'ları platform DoD'den ayırmak.
19. Bir evidence'ın SDK çağrısından Oracle hükmüne kadar hangi aşamada doğrulandığını,
    beklediğini, bloke olduğunu veya hiç gözlenemediğini kanıta dayalı göstermek.
20. Compact ve detay layer sunumunu compiled applicability snapshot'ından üretmek;
    UI animasyonunu olay sırası veya runtime authority yerine koymamak.
21. Bridge-enjekte, manuel ve kaynağı bilinmeyen etkileşimleri korelasyon gücüne göre
    ayırmak; insan etkileşim metriğini otomasyon trafiğiyle kirletmemek.
22. Repro paketine yalnız gerçekten yakalanmış ve retention/redaction policy'sinden
    geçmiş artifact'leri eklemek; failure'da bounded scoped capture kullanmak.
23. Nesy Cockpit v1 için Test Profile Catalog ve Test Campaign katmanını eklemek;
    smoke, regression, recovery, bad day, load, compatibility, soak ve security
    koşumlarını ayrı motorlar olarak değil, aynı WorkflowIR + Domain Pack + BridgeFlow
    + Oracle runtime'ının versioned veri seti, fault, tekrar, cihaz matrisi,
    telemetry ve schedule politikaları olarak çalıştırmak.
24. Teknik platform readiness ile commercial product validation sonucunu birbirinden
    ayırmak; CP0–CP9 teknik checkpoint'leri tamamlanmış olsa bile müşteri değeri,
    ikinci uygulama taşınabilirliği ve ücretli/design-partner doğrulamasını ayrı
    Business Validation Gate'leriyle izlemek.

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
| `NesyCommands` automation adapter komutları | ✅ temel | Nesy App Adapter'a refactor edilir; paralel implementasyon yazılmaz |
| `NesyStateProvider` ve safe `roomQueries` | ✅ temel | Versioned entity/query contract ile genişletilir |
| `SCREEN_READY`, `DELIVERY_PERSISTED`, `QUEUE_OFFLINE` ve benzeri structured event'ler | ✅ temel | Raw evidence olarak korunur; Domain Pack fact/oracle katmanına bağlanır |
| Bridge scoped dump ve `wait_node` | ✅ temel | `wait_any + cancel_request` ile tamamlanır; sürekli full dump yoluna çevrilmez |

## A.6 Mevcut Cockpit çalışma yolları

| Yüzey | Bugünkü yürütücü | Hedef |
|---|---|---|
| Workflow editor | Node/edge + Maestro odaklı config | Shared typed workflow contract |
| Preview | YAML preview/download | BridgeFlowPlan + operator plan preview |
| Workflow run | `WorkflowRunner` → Maestro YAML → `MaestroExecutor` | Orchestrator → BridgeFlowExecutor |
| App control | VerdictChannel + bazı legacy adlar | VerdictChannel only |
| App events | WS/logcat dual path | Authenticated WS → durable ordered bus |
| UI action | Maestro | Verdict Bridge |
| UI observation | ADB/SDK dump; sınırlı polling | Live Inspector + scoped Bridge query + event-driven expected/interrupt `wait_any` |
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
- Ölçümlü cutover ve Maestro'nun kod, paket, veri modeli, UI, script, test ve aktif doküman dahil tam sökümü.
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

## A.10 Ürün çalışma modeli ile teknik fazların ayrımı

Bu dokümandaki **Faz 0–9**, implementasyon ve kabul sırasıdır. Kullanıcının
üründe gördüğü uçtan uca akış aynı isimlerle anlatılmaz; aksi halde örneğin
“Faz 4” ifadesi compiler fazı mı Oracle katmanı mı belirsizleşir.

Ürün anlatımında şu beş katman kullanılır:

| Ürün katmanı | Kullanıcının gördüğü | Teknik karşılığı |
|---|---|---|
| **Entegrasyon Katmanı** | Cihaz, uygulama, SDK event ve Bridge hazır mı? | ADB, SDK Control/Event, auth, durable ingest, Bridge preflight |
| **Test Tasarım Katmanı** | Test nasıl oluşturulur? | Domain Pack semantic macro/entity, Editor, Live Inspector, selector/fingerprint, condition, plan preview |
| **Koşum Katmanı** | Hangi adım çalışıyor? | Domain expansion, WorkflowIR v2, BridgeFlowCompiler/Executor, SDK/Bridge/host step'leri |
| **Kanıt ve Oracle Katmanı** | Ne zaman ilerler ve gerçekten doğru mu? | Continue Gate + UI/App/Local/Remote Final Oracle policy |
| **Teşhis ve Raporlama Katmanı** | Neden geçti/kaldı, nasıl tekrar edilir? | Waterfall, artifact, repro, optional post-run explanation |

Bu katmanlar teknik checkpoint adlarını değiştirmez; yalnız ürün anlatımının
SSOT terminolojisidir.

## A.11 Yedi workspace ve route sürekliliği

Cockpit'in top-level bilgi mimarisi korunur:

1. Home
2. Product
3. Proje Yönetimi
4. Engineering
5. Debug View
6. Data Center
7. Automation

SDK/Bridge/Domain Pack dönüşümü için sekizinci top-level workspace oluşturulmaz.
Yeni yönetim yüzeyleri Automation altında, canlı cihaz inceleme yüzeyleri Debug View
altında konumlanır. Aşağıdaki route sürekliliği bağlayıcıdır:

- `/automation/list`, `/automation/history`, `/automation/field-login`,
  `/automation/01-load-tour-flow`, `/automation/[id]` ve
  `/automation/[id]/runs/[runId]` URL'leri korunur; arka motor değiştirilir.
- `/automation/overview` → `/automation/list` redirect'i korunur.
- `/debug-view/screen-state` URL'si korunur fakat ürün rolü Live Inspector'a genişler.
- Product, PM, Engineering knowledge/tools ve Data Center route'ları runtime
  migration nedeniyle yeniden adlandırılmaz.
- Yeni Domain Pack yönetimi `/automation/domain-packs` catalog route'u ve
  `/automation/domain-packs/[packId]` detay route'u altında yapılır.
- Eski deep link'ler route değişmeden çalışır. Zorunlu route değişimi doğarsa kalıcı
  redirect, telemetry ve sunset checkpoint'i olmadan silinemez.
- Route'un render olması “çalışıyor” sayılmaz; hedef data source, authorization,
  loading/empty/error state ve page acceptance kriterleri geçmelidir.

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
  DomainPackRegistry ---- DomainPackCompiler
  ConditionEngine ------- BridgeFlowCompiler
  BridgeFlowExecutor ---- Durable Event Bus
  OracleEngine ---------- Local/Remote Validators
  ArtifactService ------- DiagnosticCapturePolicy
        |
        +---- packages/workflow-contract
        +---- packages/domain-pack-contracts
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

### `packages/domain-pack-contracts`

- Versioned Domain Pack manifest ve compatibility range.
- Application, screen, surface, entity, target, semantic action ve macro tipleri.
- Named query, launch profile, scanner mode, fixture ve capability referansları.
- Continue Gate ve Domain Oracle template contract'ları.
- Evidence Source Registry, fact authority/correlation/freshness ve normalization
  contract'ları.
- Target Resolution Provider Chain ve bounded entity-target binding contract'ı.
- Pack validation, migration ve source-map tipleri.
- Domain tanımlarını generic WorkflowIR v2 adımlarına açan compiler seam'i.
- Verdict Core, Bridge transport veya app sınıflarını sahiplenmez.

### `domain-packs/nesy-courier`

- Cockpit/API tarafındaki Nesy Courier Control Plane Domain Pack.
- TypeScript source; YAML runtime artifact değildir.
- Nesy screen/surface/entity/target/action/macro/oracle/query/launch-profile tanımları.
- Pack fixture, contract test, migration ve application-version compatibility matrisi.
- Mobile `automationRelease` App Adapter ile manifest/capability handshake.

### `apps/api`

- Güvenlik ve secret sahipliği.
- Compiler ve executor.
- Device worker lifecycle.
- Durable event subscription.
- Oracle, persistence ve server-side validation.
- Domain Pack registry, validation, expansion ve compatibility gate.
- Generic `UiWaitPlan` üretimi, correlated `wait_any` sonucu ve cancellation yönetimi.

### `apps/web`

- Yalnız authoring, gözlem, operatör aksiyonu ve sonuç sunumu.
- Kendi compiler'ını veya YAML fallback'ini çalıştırmaz.
- Domain Pack catalog, mapping/compatibility ve semantic macro authoring yüzeylerini sunar.

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
  -> DB transaction: immutable inbox + gap/stream state
  -> COMMIT
  -> event_ack/gap_ack
      ├── post-commit nudge + inbox receipt cursor
      │     -> DurableReceiptBus
      │     -> receipt-safe run-scoped waitEvent / Continue Gate
      └── ordered stream consumer lease
            -> contiguous sequence + ordered reducer
            -> OrderedEvidenceBus
            -> Final Oracle + audit + replay + diagnostics
            -> processed_at
```

`DurableReceiptBus`, commit edilmiş inbox row'unu gap/poison arkasında bekletmeden
düşük gecikmeli readiness tüketicilerine açar. Bu bus yalnız RAM içi publish değildir:
post-commit nudge kaçarsa veya process commit ile publish arasında ölürse subscriber,
kalıcı inbox receipt cursor'ından resume eder. `OrderedEvidenceBus` ise stream
contiguous sırasını, deterministic reducer state'ini ve canonical replay'i korur.

```ts
type EvidenceDeliveryLane = "RECEIPT_SAFE" | "ORDERED_REQUIRED";

interface EvidenceDeliveryContract {
  factKey: string;
  lane: EvidenceDeliveryLane;
  idempotencyKey: "INBOX_EVENT_ID" | "DERIVATION_ID";
  orderingReason?: string;
}
```

`RECEIPT_SAFE`, “DB'ye commit edilmiş bu fact bağımsız olarak readiness sağlar”
anlamına gelir. Önceki event'lerin reducer state'ine, sequence sırasına veya eksik
bir transition'a bağlı fact `ORDERED_REQUIRED` olmak zorundadır. Compiler ve registry
validator order-sensitive fact'i Receipt Bus subscriber'ına bağlamayı reddeder.

### Invariants

- ACK commit'ten önce gönderilmez.
- Aynı `(runId, sessionId, seq)` idempotency anahtarıdır.
- Aynı stream'de seq sırası bozulmaz.
- Gap çözülmeden contiguous cursor körlemesine ilerlemez.
- Gap veya poison row yalnız ordered hattı durdurabilir; bağımsız receipt-safe fact'in
  commit-safe Continue Gate bildirimini durduramaz.
- Receipt hattı canonical ordering, Final Oracle veya audit authority'si değildir.
- Receipt subscriber yalnız immutable committed inbox row'u görür; transaction içi
  veya doğrulanmamış socket frame'i publish edilemez.
- Receipt dispatch process crash sonrasında inbox cursor ile replay edilebilir ve
  aynı inbox event identity'siyle idempotenttir.
- Order-sensitive reducer/fact `ORDERED_REQUIRED` lane dışında çalıştırılamaz.
- Consumer crash olduğunda işlenmemiş row kalır.
- Subscriber başarısızlığı row'u sessizce processed yapmaz.
- Poison event retry bütçesinden sonra görünür dead-letter durumuna geçer.
- `waitEvent` SDK komutu değildir; host subscription'dır ve fact delivery contract'ına
  göre Receipt veya Ordered lane'e bağlanır.
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
- `wait_any` — B2 ilk sürümde expected ve interrupt predicate'lerini tek bounded
  request içinde yarış ettiren cancellable bekleme.
- `cancel_request` — yalnız aynı authenticated/fenced session'daki devam eden
  `wait_any` request'ini iptal eder.

`wait_node` backward-compatible tek-predicate primitive olarak korunur;
BridgeFlow'un yeni readiness yolu `wait_any` kullanır. Uzun ömürlü
`register_watch/unregister_watch` ve bağımsız unsolicited push protokolü ilk B2
checkpoint'inin parçası değildir; gerçek paralel/global watch ihtiyacı ölçülürse
ayrı capability ve protocol version olarak eklenebilir.

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
- `wait_any` aynı `requestId/runId/sessionId/epoch/occurrenceId` scope'unda
  çalışır; result normal correlated response'tur, unsolicited frame değildir.
- `cancel_request`, target request'i ve aynı fencing scope'unu taşır.
- Uzun wait socket reader'ı bloke etmez: request cancellable worker'a devredilir,
  reader yeni `cancel_request` frame'ini almaya devam eder ve response writer
  serialized kalır.
- Wait worker leak etmez; timeout, cancellation, socket/session close, run end ve
  epoch rotation terminal cleanup üretir.

### Device Command Admission ve fiziksel concurrency

Socket reader/writer concurrency'si tek başına fiziksel cihaz güvenliği değildir.
BridgeClient, DeviceWorker ve Bridge aynı command sınıflandırmasını uygular:

```ts
type DeviceCommandLane = "CONTROL" | "OBSERVATION" | "WAIT" | "MUTATION";

interface DeviceAdmissionPolicy {
  maxConcurrentObservations: number;
  maxConcurrentHeavyObservations: number;
  maxConcurrentWaits: number;
  maxConcurrentMutations: 1;
  activeRunInspectorMutation: "DENY";
  manualTouchPolicy: "CONTAMINATE_AND_STOP" | "CONTAMINATE_AND_ATTEND";
}
```

| Lane | Komut örnekleri | Admission davranışı |
|---|---|---|
| `CONTROL` | `cancel_request`, heartbeat, emergency abort | Mutation/read kuyruğunun arkasında kalmayan bounded yüksek öncelik |
| `OBSERVATION` | `ping`, `find_*`, scoped `dump`, `collection_info`, `screenshot` | Bounded read concurrency; screenshot/heavy dump ayrı quota |
| `WAIT` | `wait_any`, `wait_node` | Cancellable predicate worker; ordinary read slot'unu veya mutation lane'ini süresiz tutmaz |
| `MUTATION` | `tap_*`, `input_text`, `swipe`, `back`, `activate_id`, `scroll_to_item` | Cihaz başına tek serialized fiziksel etki |

Bağlayıcı kurallar:

1. Aynı device serial üzerinde en fazla bir mutation dispatch edilir; farklı run,
   Inspector ve background tool bu limiti aşamaz.
2. Admission run/session/epoch fencing, fairness, queue deadline ve backpressure
   taşır. Sonsuz kuyruk veya kontrol komutunun starvation'ı yoktur.
3. Mutation commit/dispatch anında tree generation artırılır; eski `nodeRef`, bounds,
   selector result ve observation lease'leri invalidate edilir.
4. Mutation aktif wait'leri iptal etmez; predicate index'i invalidate edilir ve yeni
   generation üzerinde immediate scoped reevaluation tetiklenir.
5. Uzun `wait_any` bir read/write lock'u tutup kendisini tamamlatacak mutation'ı
   engelleyemez.
6. Aktif automated run sırasında Inspector `Act` ve başka external mutation fail-closed
   reddedilir. Operatör ancak audit edilen explicit takeover ile run'ı pause/cancel
   ettikten sonra action gönderebilir.
7. Manuel fiziksel dokunma action/evidence timeline'ını `CONTAMINATED` yapar; policy'ye
   göre run durur veya `NEEDS_ATTENTION` olur. Sessizce devam edip PASS üretemez.
8. Observation sonucu generation değişmişse action girdisi olamaz; yeniden resolve
   gerekir.

### `TargetFingerprint` — kalıcı semantic hedef sözleşmesi

`resourceId`, text veya `rowIndex` tek başına kalıcı hedef değildir. Editor,
Live Inspector, compiler, BridgeClient ve repro paketi aynı versioned fingerprint
sözleşmesini kullanır:

```ts
interface TargetFingerprint {
  screen?: string;
  packageName?: string;
  role?: string;
  resourceId?: string;
  textPattern?: string;
  contentDescriptionPattern?: string;
  ancestor?: TargetFingerprint;
  collectionRoot?: string;
  rowKey?: Record<string, string>;
  rowIndexHint?: number;
}
```

Bağlayıcı çözüm kuralları:

- Stable resource ID ve business `rowKey` mümkün olduğunda tercih edilir.
- `shipmentId`, stop ID veya barcode gibi `rowKey` gerçek satır kimliğidir.
- `rowIndexHint` yalnız ambiguity giderici ipucudur; ana kimlik değildir.
- `nodes[0]`, “ilk eşleşen” ve kör text tap yasaktır.
- Birden fazla eşleşme action üretmez.
- Fingerprint'in hangi alanlarla çözüldüğü evidence olarak kaydedilir.
- Hassas text değerleri log, artifact ve repro'da redakte edilir.
- App sürümü değişiminde fingerprint drift ölçülür ve selector health'e yansır.

### Target Resolution Provider Chain

`TargetFingerprint` tek başına row/business entity çözüm algoritması değildir.
Compiler ve runtime aynı versioned provider chain'i kullanır:

```ts
type TargetResolutionStrategy =
  | "ACCESSIBILITY_ID"
  | "ENTITY_BINDING"
  | "INSPECTOR_MAPPING"
  | "STRUCTURAL_FINGERPRINT";

interface TargetResolutionPolicy {
  strategies: TargetResolutionStrategy[];
  ambiguityPolicy: "FAIL";
  requiredFreshness: "CURRENT_TREE";
  allowRowIndexHint: boolean;
}
```

Bağlayıcı çözüm sırası:

1. Stable accessibility/resource/content identity.
2. Automation-only App Adapter `EntityTargetBindingProvider` sonucu.
3. App-version uyumlu ve operatör onaylı Live Inspector mapping'i.
4. Versioned structural fingerprint.
5. `rowIndexHint` yalnız yukarıdaki aynı fingerprint içindeki son ambiguity
   yardımcısıdır; tek başına provider değildir.

Her provider denemesi `attemptedStrategy`, input fingerprint/version,
candidate count, rejection reason, seçilen strategy, `treeGen` ve mapping version
ile evidence üretir. `ENTITY_BINDING`, bütün listeyi stream etmez; yalnız seçilen
`entityType/entityId` ile runtime row target arasındaki bounded bağı döndürür.

### Fiziksel aksiyon yaşam döngüsü

Bir `requestId` yalnız duplicate suppression anahtarı değildir; aksiyonun hangi
aşamada kaldığı kalıcı olarak bilinmelidir:

```text
RECEIVED
  -> TARGET_RESOLVED
  -> GESTURE_DISPATCHED
  -> GESTURE_COMPLETED
  -> EFFECT_VERIFIED
```

Terminal hata durumları:

- `TARGET_NOT_FOUND`
- `AMBIGUOUS`
- `OBSCURED`
- `STALE_TREE`
- `DISPATCH_REJECTED`
- `GESTURE_FAILED`
- `UNKNOWN_EFFECT`
- `EFFECT_NOT_OBSERVED`

Her transition `runId`, `sessionId`, `epoch`, `requestId`, `occurrenceId`,
fingerprint, `treeGen` ve `monoTs` taşır. Bridge process'i gesture sonrasında
ama response öncesinde ölürse Cockpit exactly-once varsaymaz; kalıcı transition
ve idempotency kanıtına göre recover eder veya `UNKNOWN_EFFECT` ile durur.

### Dokunma yöntemi

- Normal fiziksel dokunmanın birincil yolu `dispatchGesture`'dır.
- `performAction` yalnız contract'ta allowlist edilmiş semantic action için
  kontrollü kaçış yolu olabilir.
- Sabit ekran koordinatı kalıcı hedef veya workflow girdisi olamaz.
- Kullanılan yöntem (`dispatchGesture`, `performAction`, semantic scroll) UI
  evidence içinde görünür.
- Safe point fresh bounds/tree üzerinden hesaplanır; foreign-window obstruction
  varsa input dispatch edilmez.

## B.8 Run lifecycle, verdict ve cleanup eksenleri

Tek enum içinde “run şu an nerede”, “business sonucu ne”, “neden kapandı” ve
“cleanup başarılı mı” tutulmaz. Hedef model orthogonal ve ayrı persist edilen
eksenlerden oluşur:

```ts
type RunLifecycleState =
  | "PENDING"
  | "QUEUED"
  | "PREFLIGHT"
  | "AUTHENTICATING"
  | "COMPILING"
  | "RUNNING"
  | "WAITING_EVIDENCE"
  | "RECOVERING_HOST"
  | "RECOVERING_BRIDGE"
  | "RECOVERING_DEVICE"
  | "CLEANING_UP"
  | "CLOSED";

type ProductVerdict =
  | "NOT_EVALUATED"
  | "PASS_ONLINE"
  | "PASS_QUEUED_OFFLINE"
  | "FAIL_PRODUCT"
  | "INCONCLUSIVE";

type EvaluationFailureClass =
  | "NONE"
  | "AUTOMATION_FAILURE"
  | "ENVIRONMENT_FAILURE"
  | "EVIDENCE_INSUFFICIENT";

type RunTerminationReason =
  | "NOT_TERMINATED"
  | "COMPLETED"
  | "CANCELLED"
  | "ABORTED"
  | "PROCESS_CRASH"
  | "DEVICE_DISCONNECTED"
  | "UNKNOWN_ACTION_EFFECT"
  | "STUCK";

type WorkflowCleanupResult =
  | "NOT_STARTED"
  | "PENDING"
  | "SUCCEEDED"
  | "PARTIAL"
  | "FAILED";

type OperationalDisposition = "OK" | "NEEDS_ATTENTION";
```

Normal lifecycle `PENDING → QUEUED → PREFLIGHT → AUTHENTICATING → COMPILING →
RUNNING/WAITING_EVIDENCE → CLEANING_UP → CLOSED` akışıdır. Recovery state'leri
lifecycle içindedir; `CANCELLED` business verdict değil termination reason,
`NEEDS_ATTENTION` lifecycle değil operational disposition'dır.

Bağlayıcı invariants:

1. Final Oracle business verdict'i üretir; cleanup sonucu verdict'i overwrite etmez.
2. Business PASS + cleanup FAILED şu şekilde saklanır: `CLOSED`, `PASS_*`,
   `COMPLETED`, `FAILED`, `NEEDS_ATTENTION`.
3. Cleanup terminal olmadan lifecycle `CLOSED` yapılamaz; bounded cleanup deadline
   sonunda `PARTIAL/FAILED` ile kapanabilir ve attention üretir.
4. Cancel/abort henüz değerlendirilmemiş occurrence'a sahte FAIL/PASS yazmaz;
   `NOT_EVALUATED` veya kanıta göre `INCONCLUSIVE` korunur.
5. Verdict ilk terminal Final Oracle kararından sonra immutable'dır; ancak versioned,
   audit edilen explicit re-evaluation yeni verdict revision'ı üretebilir.
6. Her eksen transition'ı atomik ve audit edilebilirdir. Process restart sonrası DB
   state'i kaynak kabul edilir; yalnız bellek state'i kullanılmaz.

Step occurrence da tek `status` ile modellenmez:

```ts
interface StepOutcomeAxes {
  actionResult: string;
  continueGateResult: string;
  finalOracleResult: string;
  cleanupResult: WorkflowCleanupResult;
}
```

Bridge action yaşam döngüsü `actionResult` altındadır. Step business olarak
tamamlanmadan önce action terminal state'i, Continue Gate kararı ve gerekli effect
evidence'i kalıcı olmalıdır; eventual Final Oracle ayrı state olarak izlenebilir.

## B.9 Workflow IR v2

```ts
type IRStep =
  | SdkCommandStep
  | SdkQueryStep
  | BridgeActionStep
  | WaitNodeStep
  | WaitEventStep
  | AssertUiStep
  | AssertAppStep
  | AssertLocalStep
  | AssertRemoteStep
  | ConditionStep
  | ForEachStep
  | SwitchStep
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
- `continueGate`
- `finalOraclePolicy`
- `artifactPolicy`
- `redactionPolicy`
- optional `domainSourceRef`
- optional `entityBinding`
- optional `uiWaitRequirement`

Runtime'da ayrıca:

- `occurrenceId`
- `iterationPath`
- `attempt`
- `requestId`
- `entityType`
- `entityId`
- `eventSeqRange`
- `startedMonoTs`
- `completedMonoTs`

üretilir.

`completionPolicy` geriye dönük tek alan gibi yorumlanmaz. V2'de iki ayrı karar
vardır:

- `continueGate`: executor'ın bir sonraki occurrence'a ne zaman geçebileceği.
- `finalOraclePolicy`: occurrence/run kapanırken hangi eventual kanıtların terminal
  hüküm üreteceği.

Domain Pack bu union'a business-specific step eklemez. Örneğin `DELIVER_STOP`
authoring macro'su pack expansion sırasında `SdkQueryStep + ForEachStep +
BridgeActionStep + WaitEventStep + AssertLocalStep + AssertRemoteStep` gibi generic
IR v2 adımlarına açılır. Böylece IR, “stop” veya “parcel” anlamını Verdict Core'a
taşımaz.

### WorkflowIR v2 kabul kapısı ve sıralama

WorkflowIR v2 aşağıdakiler tamamlanmadan kabul edilmiş sayılmaz:

1. Shared Web/API contract ve version migration.
2. Generic step union ve runtime schema validation.
3. Typed Condition AST ve `TRUE/FALSE/UNKNOWN` semantiği.
4. `FOR_EACH` scope, iteration limit ve occurrence correlation.
5. Continue Gate/Final Oracle ayrımı.
6. Retry/idempotency/capability/evidence/artifact/redaction policy'leri.
7. Deterministik serialization, source map ve golden fixture'lar.

**Bağlayıcı bağımlılık:** Bu kabul kapısı geçmeden Domain Pack implementation'ı
başlamaz. Domain Pack contract'ı IR v2'yi tüketir; IR v2 Domain Pack'e göre geçici
veya Nesy-specific biçimde şekillendirilmez.

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

## B.10A Domain Pack çalışma modeli

Domain Pack iki fiziksel parçadan oluşur:

1. **Control Plane Domain Pack:** Cockpit/API tarafında business dilini ve mapping
   sözleşmesini tanımlar.
2. **App Adapter:** NesyMobile `automationRelease` varyantında dışarıdan güvenilir
   biçimde gözlenemeyen sınırlı state/query/injection/capability seam'lerini sağlar.

Domain Pack'in sorumluluğu Verdict Core'u Nesy'ye dönüştürmek değil; Nesy business
niyetini generic WorkflowIR v2, target, UI wait ve oracle primitive'lerine çevirmektir.

### Control Plane Domain Pack içeriği

```text
domain-packs/nesy-courier
├── manifest
├── applications
├── screens
├── surfaces
├── entities
├── targets
├── actions
├── macros
├── oracles
├── queries
├── launch-profiles
├── test-profiles
├── fixtures
├── migrations
└── tests
```

Zorunlu tanımlar:

- **Application Registry:** package/application identity, app version aralığı,
  platform, environment ve runtime compatibility sözleşmesi.
- **Screen Registry:** login, stop list, task list, delivery, pickup, vehicle
  loading, end-of-day gibi logical screen contract'ları, runtime implementation,
  entry/readiness ve desteklenen action/surface tanımları.
- **Surface Registry:** dialog, bottom sheet, overlay, scanner, WebView, payment ve
  interrupt yüzeyleri; surface screen değildir ve parent screen'den bağımsız bir
  lifecycle taşır.
- **Entity Registry:** `ROUTE`, `STOP`, `TASK`, `SHIPMENT`, `PARCEL`, `PAYMENT`,
  `PENDING_OPERATION`; 120 stop 120 registry kaydı değildir.
- **Target Registry:** B.7'deki formal Target Resolution Provider Chain ve versioned
  `TargetFingerprint` fallback sırası.
- **Semantic actions/macros:** `OPEN_STOP`, `PROCESS_PARCEL`, `COMPLETE_DELIVERY`,
  `DELIVER_STOP` ve benzeri business niyetleri.
- **Oracle templates:** UI/App/Local/Remote layer applicability, Continue Gate ve
  eventual Final Oracle kuralları.
- **Named query contracts:** parametre, projection, row/size limit, redaction ve
  required adapter capability.
- **Launch profiles:** `FULL_JOURNEY`, `PREPARED_SESSION`, `DIRECT_STATE`.
- **Test profiles:** smoke, regression, differential, recovery, bad-day, load, soak,
  compatibility, security ve preview profilleri; workflow, launch profile, dataset,
  repetition, fault, device matrix, telemetry, Oracle ve schedule policy tanımları.
- **Compatibility:** pack version, app id/version range, platform, SDK/Bridge
  protocol ve App Adapter capability matrisi.

### Application Registry contract'ı

```ts
interface ApplicationDefinition {
  key: string;
  displayName: string;
  platform: "ANDROID";

  packageNames: string[];
  validAppVersions: string;
  validBuildVariants?: string[];
  environments: string[];

  requiredSdkProtocol: string;
  requiredBridgeProtocol: string;
  requiredAdapterCapabilities: string[];

  defaultLaunchProfile?: string;
  compatibilityPolicy: "FAIL_CLOSED";
}
```

`packageNames` runtime'da gözlenen package ile doğrulanır. App version, pack,
SDK/Bridge protocol veya adapter capability uyuşmazlığı action başladıktan sonra
değil preflight'ta terminal `INCOMPATIBLE_APPLICATION` üretir.

### Screen Registry contract'ı

```ts
type ScreenImplementation =
  | { kind: "ACTIVITY"; classPattern: string }
  | { kind: "FRAGMENT"; classPattern: string; hostActivity?: string }
  | { kind: "COMPOSE_DESTINATION"; routePattern: string }
  | { kind: "WEBVIEW"; urlPattern?: string; hostPattern?: string };

type EntryStrategy =
  | { kind: "UI_NAVIGATION"; macroRef: string }
  | { kind: "DEEP_LINK"; uriTemplate: string }
  | { kind: "TEST_GATEWAY"; commandRef: string; automationBuildOnly: true }
  | { kind: "WORKFLOW"; workflowRef: string };

interface DesignContract {
  sourceRef?: string;
  sourceVersion?: string;
  requiredRoles?: string[];
  layoutAssertions?: string[];
  accessibilityAssertions?: string[];
  visualBaselineRef?: string;
  enforcement: "INFO" | "WARNING" | "FAIL";
}

interface ScreenDefinition {
  key: string;
  applicationKeys: string[];
  implementations: ScreenImplementation[];

  entryStrategies: EntryStrategy[];
  readinessContract: EvidencePolicy;
  supportedSurfaceKeys: string[];
  supportedActions: string[];
  designContract?: DesignContract;

  validAppVersions?: string;
  requiredCapabilities?: string[];
}
```

Kurallar:

1. `screen.key` global ve stable'dır; `nesy.auth.login`, `nesy.tour.stop-list`,
   `nesy.stop.detail`, `nesy.delivery` gibi namespace taşır.
2. Activity/Fragment/Compose route/class adı workflow'a sızmaz; yalnız runtime
   implementation mapping'inde bulunur.
3. `readinessContract`, yalnız “screen class görüldü” kontrolü değildir; gerekli UI,
   App, Local ve Remote fact'lerin applicability/policy birleşimini tanımlar.
4. Screen detection belirsizse key tahmin edilmez; `UNKNOWN_SCREEN` veya ambiguity
   sonucu üretilir ve diagnostic policy uygulanır.
5. Screen Registry versioned ve migration'lıdır. App sürümü değiştiğinde workflow
   değil implementation/readiness mapping'i güncellenir.

### Surface Registry contract'ı

```ts
type SurfaceKind =
  | "DIALOG"
  | "BOTTOM_SHEET"
  | "SYSTEM_OVERLAY"
  | "SCANNER"
  | "WEBVIEW_OVERLAY"
  | "POPUP";

interface SurfaceDefinition {
  key: string;
  kind: SurfaceKind;
  applicationKeys: string[];
  validParentScreens: string[];

  detectionContract: UiPredicate;
  readinessContract?: EvidencePolicy;
  supportedActions?: string[];
  defaultPolicy: "HANDLE" | "IGNORE" | "FAIL" | "OPERATOR_ATTENTION";

  priority?: number;
  validAppVersions?: string;
  requiredCapabilities?: string[];
}
```

Runtime aynı anda bir logical screen ve sıfır/birden çok active surface taşıyabilir:

```text
currentScreen = nesy.auth.login
activeSurfaces = [nesy.route.selection-dialog]
```

Rota seçimi, mandatory update, session expiry, permission, barkod girişi ve POS
dialog'ları screen değildir. `validParentScreens` parent ilişkisini, `defaultPolicy`
ise yüzey beklenmediği anda nasıl davranılacağını tanımlar. Selector benzerliği bu
iki yüzeyi aynı business anlamına getiremez.

### Launch Profile contract'ı

```ts
interface LaunchPrecondition {
  key: string;
  evidence: EvidencePolicy;
  prepareRef?: string;
  ownership: "RUN_OWNED" | "EXTERNAL_READ_ONLY";
}

interface CleanupPolicy {
  strategy: "RESTORE" | "DELETE_RUN_OWNED" | "KEEP";
  cleanupRef?: string;
  verify: EvidencePolicy;
}

interface LaunchProfile {
  key: string;
  applicationKey: string;
  processPolicy: "COLD_START" | "WARM_START" | "REUSE_SESSION";

  preconditions: LaunchPrecondition[];
  entry: EntryStrategy;
  expectedScreen: string;
  expectedSurface?: string;
  readinessContract: EvidencePolicy;
  cleanupPolicy: CleanupPolicy;

  validAppVersions?: string;
  requiredCapabilities?: string[];
  automationBuildOnly?: boolean;
}
```

Launch Profile bütün journey'yi zorunlu olarak replay etmeden deterministik test
girişi sağlar. `FULL_JOURNEY`, `PREPARED_SESSION` ve `DIRECT_STATE` şu sınırları
korur:

- `FULL_JOURNEY` gerçek kullanıcı girişini ve tüm business precondition'ları yürütür.
- `PREPARED_SESSION` allowlisted fixture/session hazırlığından sonra tanımlı screen'e
  workflow/deep link ile gider.
- `DIRECT_STATE` yalnız `automationRelease` içinde test gateway/fixture seam'i
  üzerinden çalışır; production build'de capability hiç ilan edilmez.
- Her profile expected screen/surface ve readiness evidence'iyle doğrulanır. Giriş
  komutunun başarıyla dönmesi tek başına profile PASS değildir.
- Cleanup, seeded state ve session ownership'i açıkça tanımlar; başka run'ın state'i
  sessizce reuse edilmez.

### Test Profile Catalog contract'ı

Test Profile, Launch Profile'ın üstünde duran ürün koşum sözleşmesidir. Launch Profile
“teste nereden başlanır?” sorusunu cevaplar; Test Profile “hangi amaçla, hangi veri
seti, fault, cihaz matrisi, tekrar, telemetry ve Oracle politikasıyla çalıştırılır?”
sorusunu cevaplar. Bu iki kavram tek şemada eritilmez.

```ts
type TestProfileKind =
  | "SMOKE"
  | "CRITICAL_REGRESSION"
  | "DIFFERENTIAL_REGRESSION"
  | "RECOVERY"
  | "STATE_AWARE_BAD_DAY"
  | "BUSINESS_CONTRACT_CONSISTENCY"
  | "LOAD"
  | "COMPATIBILITY_CERTIFICATION"
  | "SOAK"
  | "SECURITY_RELEASE_ISOLATION"
  | "BASIC_ACCESSIBILITY_PREVIEW"
  | "SMART_EXPLORER_PREVIEW";

type ScheduleClass = "PR" | "NIGHTLY" | "WEEKLY" | "RELEASE";

interface RepetitionPolicy {
  mode: "ONCE" | "FIXED_COUNT" | "UNTIL_DEADLINE" | "SOAK";
  count?: number;
  durationMs?: number;
  stopOnFirstFailure: boolean;
  maxConsecutiveFailures?: number;
}

interface DatasetPolicy {
  datasetRef: string;
  sizeClass?: "SMALL" | "NORMAL" | "BUSY" | "PEAK";
  seedPolicy: "PINNED" | "GENERATED_FROM_FIXTURE" | "EXTERNAL_READ_ONLY";
  dataOwnership: "RUN_OWNED" | "SHARED_READ_ONLY";
}

interface DeviceMatrixPolicy {
  requiredDeviceRefs?: string[];
  deviceClassRefs?: string[];
  androidApiRange?: string;
  capabilityRefs?: string[];
  minimumPassingCells: "ALL" | { atLeast: number };
  failurePolicy: "FAIL_PROFILE" | "MARK_CELL_FAILED";
}

interface FaultTrigger {
  triggerRef:
    | { kind: "FACT"; factKey: string }
    | { kind: "SURFACE"; surfaceKey: string }
    | { kind: "STEP_OCCURRENCE"; stepKey: string }
    | { kind: "NETWORK_OPERATION"; sourceRef: string };
  when: "BEFORE" | "ON_OBSERVED" | "AFTER";
  delayMs?: number;
  correlationRequired: boolean;
}

interface FaultAction {
  kind:
    | "NETWORK_DISCONNECT"
    | "NETWORK_RECONNECT"
    | "NETWORK_LATENCY"
    | "BACKEND_500"
    | "BACKEND_TIMEOUT"
    | "PROCESS_KILL"
    | "FORCE_STOP"
    | "TOKEN_EXPIRE"
    | "PERMISSION_REVOKE"
    | "CLOCK_TIMEZONE_CHANGE"
    | "LOW_STORAGE"
    | "DUPLICATE_CALLBACK";
  parameters?: Record<string, unknown>;
}

interface FaultPlan {
  key: string;
  triggers: Array<{
    trigger: FaultTrigger;
    action: FaultAction;
    maxApplicationsPerRun: number;
  }>;
  safetyPolicy: "FAIL_CLOSED" | "OPERATOR_APPROVAL_REQUIRED";
}

interface TelemetryPolicy {
  captureLevel: "MINIMAL" | "STANDARD" | "EXTENDED" | "SOAK";
  requireEvidenceJourney: boolean;
  requirePerformanceBudget?: string;
  collectDeviceMetrics: boolean;
  collectSdkObservationMetrics: boolean;
  collectBridgeMetrics: boolean;
  artifactPolicyRef: string;
}

interface DifferentialPolicy {
  baselineBuildRef: string;
  compare:
    | "FACT_SEQUENCE"
    | "ORACLE_REQUIREMENTS"
    | "EVIDENCE_JOURNEY"
    | "PERFORMANCE_BUDGET";
  allowedDiffRefs?: string[];
  failOnMissingCriticalFact: boolean;
}

interface TestProfileDefinition {
  key: string;
  displayName: string;
  kind: TestProfileKind;
  applicationKey: string;

  workflowRef: string;
  launchProfileRef: string;
  dataset?: DatasetPolicy;

  repetitionPolicy: RepetitionPolicy;
  deviceMatrix?: DeviceMatrixPolicy;
  networkProfileRef?: string;
  faultPlan?: FaultPlan;
  telemetryPolicy: TelemetryPolicy;
  finalOracleRef: string;
  cleanupPolicy: CleanupPolicy;
  differentialPolicy?: DifferentialPolicy;

  scheduleClasses: ScheduleClass[];
  severity: "BLOCKER" | "HIGH" | "MEDIUM" | "LOW" | "PREVIEW";
  releaseGate: boolean;
  previewOnly?: boolean;

  validAppVersions?: string;
  requiredCapabilities?: string[];
}
```

Kurallar:

1. Test Profile ayrı runtime motoru tanımlamaz; `workflowRef` ve `launchProfileRef`
   üzerinden generic WorkflowIR v2 + BridgeFlowCompiler hattına derlenir.
2. Fault, repeat, dataset, device matrix ve telemetry yalnız plan parametreleridir.
   Bunlar Core IR'a `PAYMENT_KILL_TEST` gibi yeni business node ekleyemez.
3. `faultPlan` business fact/surface/source trigger'ına bağlıysa correlation zorunludur;
   rastgele saniye tabanlı fault v1 core için varsayılan değildir.
4. Differential Regression screenshot veya selector diff'iyle hüküm vermez; normalized
   fact sequence, Oracle requirement, Evidence Journey ve PerformanceBudget farkını
   kullanır.
5. Compatibility Certification'da tek cihaz PASS'i bütün profile PASS'i değildir.
   Sonuç campaign cell bazında saklanır.
6. Preview profile release gate olamaz. `BASIC_ACCESSIBILITY_PREVIEW` ve
   `SMART_EXPLORER_PREVIEW` üretim hükmünü değiştiremez.
7. Security/Release Isolation profile fail-closed'dur; release APK'da automation
   capability ilanı veya hmac/allowlist/redaction ihlali profile failure üretir.
8. Load/Soak profile'ları CP0/CP3/CP8 ölçümlerinden türeyen versioned
   `PerformanceBudget` referansı olmadan release gate sayılmaz.
9. Test Profile publish edildiğinde Domain Pack bundle digest'ine dahil olur. Aktif run
   sırasında profile hot reload uygulanmaz; yeni profile version yalnız yeni campaign
   veya yeni run için geçerlidir.

### Test Campaign contract'ı

Test Campaign, bir veya daha fazla Test Profile'ın belirli build, environment, device
matrix ve schedule altında koşulmasıdır. Campaign v1'de ayrı engine değildir; profile
run'larını üretir, izler ve özetler.

```ts
interface TestCampaignDefinition {
  key: string;
  displayName: string;
  scheduleClass: ScheduleClass;
  applicationKey: string;
  buildRef: string;
  environmentKey: string;
  profileRefs: string[];
  deviceMatrixOverride?: DeviceMatrixPolicy;
  datasetOverrideRefs?: string[];
  startedBy: "USER" | "CI" | "SCHEDULE";
  releaseCandidate?: boolean;
  stopPolicy: "STOP_ON_BLOCKER" | "RUN_ALL_PROFILES";
}

interface TestCampaignResult {
  campaignId: string;
  profileResults: Array<{
    profileKey: string;
    runIds: string[];
    result: "PASSED" | "FAILED" | "INCONCLUSIVE" | "BLOCKED" | "PREVIEW_ONLY";
    failedCells?: string[];
    evidenceSummaryRef: string;
  }>;
  releaseGateResult: "GO" | "NO_GO" | "NEEDS_ATTENTION" | "NOT_A_RELEASE_GATE";
}
```

Campaign özet ekranı Run Detail'in yerini almaz. Her cell/run kendi occurrence,
Evidence Journey, Oracle ve artifact'ine deep-link verir. Campaign yalnız “bu build
bu cihaz/veri/profil matrisinde ne yaptı?” sorusunu yanıtlar.

### Registry merkezli hedef akış

```text
Cockpit Workflow Editor
  → Domain Pack Registry
      ├── Application Registry
      ├── Screen Registry
      ├── Surface Registry
      ├── Entity/Target Registry
      ├── Evidence Source Registry
      ├── Semantic Actions
      ├── Macros
      ├── Oracle Templates
      ├── Launch Profiles
      └── Test Profiles
  → WorkflowIR v2 validation/expansion
  → BridgeFlowCompiler
  → BridgeFlowPlan
      ├── Continue Gates
      ├── Final Oracle Policies
      ├── UiWaitPlans (expected + interrupts)
      ├── Capability Requirements
      └── Source Map / Provenance
  → BridgeFlowExecutor
      ├── Bridge TCP wait/action
      ├── SDK Control
      ├── SDK Durable Canonical Evidence
      ├── Named Local Queries
      └── Remote Validators
```

App Adapter yalnız named query, scanner injection, fixture/session preparation,
opsiyonel entity-target binding ve minimum kritik business event seam'lerini sağlar.
Verdict Core hiçbir aşamada `STOP`, `PARCEL`, `MATCH` veya `BETTING` bilmez.

### Domain Pack derleme sınırı

```text
Domain authoring node/macro
  → pack manifest + compatibility validation
  → entity/query binding
  → semantic macro expansion
  → generic WorkflowIR v2
  → BridgeFlowCompiler
  → BridgeFlowPlan + generic UiWaitPlan
```

Domain Pack doğrudan Bridge socket komutu çalıştırmaz, raw SQL taşımaz, app class
adıyla Bridge'i yönlendirmez ve Oracle terminal hükmünü runtime dışında vermez.

### Nesy Courier Domain Pack Reference Specification

`NESY_COURIER_DOMAIN_PACK_REFERENCE_V1`, Faz 4B'de Nesy Courier Domain Pack'in
yorum farkı olmadan uygulanabilmesi için bağlayıcı reference specification olarak
üretilir. Bu doküman ikinci master plan değildir; bu master plandaki Domain Pack
contract'ının Nesy için canonical vertical-slice örnekleridir.

Reference spec şu soruya cevap verir:

```text
Cockpit canvas'ındaki bir Nesy semantic node'u
hangi input/output, screen/surface, entity, target, evidence, macro expansion,
Continue Gate, Final Oracle ve source-map ile generic WorkflowIR'a açılacak?
```

Zorunlu vertical slice set'i:

```text
COURIER_LOGIN
SELECT_ROUTE
OPEN_STOP
PROCESS_PARCEL
COMPLETE_DELIVERY
```

Her slice şu template'i doldurur:

```yaml
id: nesy.macro.<macro-key>
version: 1
title: Human readable title

businessMeaning: >
  Bu semantic node'un Nesy iş dilindeki amacı.

notResponsibleFor:
  - Bu node'un özellikle yapmadığı işler.

inputs:
  <inputName>:
    type: <entity | scalar | secret-reference | fixture-ref>
    required: true

outputs:
  <outputName>:
    type: <entity | fact | context>

preconditions:
  - fact: UI.<SCREEN_OR_SURFACE_READY>
  - capability: <required.capability>
  - queryContains:
      query: <named-query>
      entity: "{{inputs.entity}}"

screenSurfaceContract:
  requiredScreen: nesy.screen.<screen>
  possibleSurfaces:
    - nesy.surface.<surface>

entityBinding:
  entityType: <ENTITY>
  stableKey: "{{inputs.entity.stableKey}}"
  target: nesy.target.<target-key>
  ambiguityPolicy: FAIL

targetResolutionPolicy:
  strategies:
    - ACCESSIBILITY_ID
    - ENTITY_BINDING
    - INSPECTOR_MAPPING
    - STRUCTURAL_FINGERPRINT
  rowIndexHintOnly: true

expansion:
  - type: <generic WorkflowIR step>

continueGate:
  allOf: []

finalOracle:
  requirements: []

interruptPolicy:
  surfaces: []

requiredCapabilities: []

sourceMap:
  domainNode: <domain macro id>
  genericSteps: []
  bridgeFlowPlanRefs: []
```

#### `OPEN_STOP` reference macro

Nesy domain'inde `OPEN_STOP` şu business niyetidir:

> Belirli bir `STOP` entity'sini stop listesinden bulup seçmek ve o stop'a ait task
> veya delivery çalışma bağlamına geçmek.

`OPEN_STOP` şu anlama gelmez:

- Teslimatı tamamlamak.
- Barkodu okutmak.
- Payment başlatmak.
- Stop'u backend'de kapatmak.
- Stop'un tamamlandığını kanıtlamak.

Sadece doğru stop'un çalışma bağlamını açar.

Canonical örnek:

```yaml
id: nesy.macro.open-stop
version: 1
title: Open Stop

inputs:
  stop:
    entityType: STOP
    required: true

outputs:
  activeStop:
    entityType: STOP

preconditions:
  - fact: UI.STOP_LIST_READY
  - queryContains:
      query: nesy.availableStops
      entity: "{{inputs.stop}}"
  - noBlockingSurface:
      surfaces:
        - nesy.surface.session-expired
        - nesy.surface.update-required
        - nesy.surface.network-blocking-error

expansion:
  - type: ASSERT_SCREEN
    screen: nesy.screen.stop-list

  - type: SDK_QUERY
    query: nesy.availableStops
    output: availableStops

  - type: ASSERT_ENTITY_PRESENT
    collection: "{{step.availableStops}}"
    entity: "{{inputs.stop}}"

  - type: RESOLVE_ENTITY_TARGET
    entity: "{{inputs.stop}}"
    target: nesy.target.stop-row
    output: resolvedStopRow
    ambiguityPolicy: FAIL

  - type: BRIDGE_SCROLL_TO_TARGET
    target: "{{step.resolvedStopRow}}"

  - type: BRIDGE_ACTIVATE
    target: "{{step.resolvedStopRow}}"
    idempotency: AT_MOST_ONCE

  - type: WAIT_UI
    waitPlan:
      expected:
        - screen: nesy.screen.task-list
        - screen: nesy.screen.delivery
      interrupts:
        - surface: nesy.surface.session-expired
        - surface: nesy.surface.update-required
        - surface: nesy.surface.network-blocking-error
      stableForMs: 150

continueGate:
  allOf:
    - fact: UI.STOP_CONTEXT_READY
    - fact: APP.ACTIVE_STOP_MATCHES
      entity: "{{inputs.stop}}"

finalOracle:
  requirements:
    - fact: UI.STOP_CONTEXT_READY
      plane: UI
      obligation: REQUIRED
      timing: IMMEDIATE
    - fact: APP.ACTIVE_STOP_MATCHES
      plane: APP
      obligation: REQUIRED
      timing: IMMEDIATE
      entity: "{{inputs.stop}}"
    - fact: LOCAL.STOP_CONTEXT_AVAILABLE
      plane: LOCAL
      obligation: OPTIONAL
      timing: EVENTUAL

outputs:
  activeStop: "{{inputs.stop}}"
```

Runtime occurrence örneği:

```text
nodeId: open-stop
entityType: STOP
entityId: stop-042
iterationPath: stops[41]
attempt: 1
```

Runtime davranışı:

```text
1. Executor mevcut screen'i kontrol eder.
2. Domain Pack target binding çalışır.
3. Bridge doğru satırı çözer.
4. Satır görünür değilse scroll eder.
5. Tek ve güvenli eşleşmeyse dokunur.
6. wait_any başlatılır.
7. Expected: TASK_LIST_READY veya DELIVERY_READY.
8. Interrupt: SESSION_EXPIRED, UPDATE_REQUIRED, NETWORK_BLOCKING_ERROR.
9. App evidence activeStopId = stop-042 üretir.
10. Continue Gate açılır.
11. Workflow sonraki node'a geçer.
12. Final Oracle gerekiyorsa eventual evidence'ı ayrıca tamamlar.
```

Yanlış satır açılırsa yalnız “bir ekran açıldı” diye PASS üretilemez:

```text
İstenen stop: stop-042
Aktif stop: stop-017
Sonuç: FAIL_APP veya EVIDENCE_CONFLICT
```

#### Stop satırı target resolution modeli

UI'da backend `stopId` görünmeyebilir. Bu durumda App Adapter bütün stop modelini
stream etmez; yalnız bounded projection döndürür:

```json
[
  {
    "entityId": "stop-042",
    "stableKey": "route-8:sequence-42",
    "displayHints": {
      "shipmentNumber": "32562939073268",
      "addressSummary": "Knez Mihailova 12"
    },
    "state": "ASSIGNED"
  }
]
```

Target resolver bu projection'ı ekrandaki satırla bounded şekilde eşleştirir:

```text
shipment number eşleşti mi?
adres özeti eşleşti mi?
satır doğru collection içinde mi?
tek eşleşme mi?
```

İki eşleşme varsa sonuç `AMBIGUOUS` olur ve Bridge hiçbir yere dokunmaz. `rowIndex`
yalnız son yardımcı ipucudur; business identity veya tek başına selector değildir.

#### `COURIER_LOGIN` reference macro

Login için iki ayrı kullanım karıştırılmaz:

1. Gerçek login testi.
2. Başka workflow için hazırlanmış session setup'ı.

Gerçek login testi business workflow node'udur:

```yaml
id: nesy.macro.courier-login
version: 1
title: Courier Login

inputs:
  credentialRef:
    type: secret-reference
    required: true

notResponsibleFor:
  - Route seçmek.
  - Delivery başlatmak.
  - Test başlangıç fixture'ı üretmek.

preconditions:
  - fact: UI.LOGIN_READY
  - capability: bridge.input.v1
  - capability: sdk.events.v2

expansion:
  - type: ASSERT_SCREEN
    screen: nesy.screen.login

  - type: BRIDGE_INPUT
    target: nesy.target.login-pin
    valueFromSecret: "{{inputs.credentialRef}}"

  - type: BRIDGE_ACTIVATE
    target: nesy.target.login-submit
    idempotency: AT_MOST_ONCE

  - type: WAIT_UI
    waitPlan:
      expected:
        - screen: nesy.screen.route-selection
        - screen: nesy.screen.home
      interrupts:
        - surface: nesy.surface.invalid-pin
        - surface: nesy.surface.network-error
        - surface: nesy.surface.update-required
      stableForMs: 150

continueGate:
  allOf:
    - fact: APP.USER_SESSION_AVAILABLE
    - anyOf:
        - fact: UI.ROUTE_SELECTION_READY
        - fact: UI.HOME_READY

finalOracle:
  requirements:
    - fact: APP.USER_SESSION_AVAILABLE
      plane: APP
      obligation: REQUIRED
      timing: IMMEDIATE
    - fact: LOCAL.USER_SESSION_AVAILABLE
      plane: LOCAL
      obligation: REQUIRED
      timing: IMMEDIATE
    - fact: REMOTE.AUTH_ACCEPTED
      plane: REMOTE
      obligation: REQUIRED
      timing: EVENTUAL
      deadlineMs: 15000
```

Login butonunun tıklanması PASS değildir. PASS için session, local persistence ve
uygulanabilir remote auth kanıtı gerekir.

Setup login ise `LaunchProfile` sorumluluğudur:

```text
Launch Profile: PREPARED_SESSION
Amaç: Test başlangıç koşulunu hazırlamak.
Sonuç: Login testi geçti anlamına gelmez.
```

Delivery recovery gibi testlerde `PREPARED_SESSION` veya automation-only
`DIRECT_STATE` kullanılabilir. Login'in kendisi test edilecekse `FULL_JOURNEY` ve
`COURIER_LOGIN` semantic macro'su kullanılır.

### Domain Pack publish, bundle ve trust modeli

V1 Domain Pack authoring kaynağı first-party TypeScript olabilir; production
runtime bu source'u doğrudan import veya execute etmez. Publish hattı şöyledir:

```text
First-party TypeScript source
  → CI/publish compiler
  → schema + compatibility + DAG + capability validation
  → deterministic declarative runtime bundle
  → canonical serialization
  → SHA-256 digest + provenance
  → immutable published Domain Pack version
  → run-start pin + read-only runtime load
```

Bağlayıcı kurallar:

1. Runtime DB'den, upload'dan veya mutable çalışma dizininden arbitrary TypeScript/
   JavaScript yükleyip çalıştırmaz.
2. Macro, normalization ve reducer tanımları generic IR, declarative expression veya
   allowlisted deterministic reducer artifact'ına compile edilir.
3. Published bundle immutable'dır; değişiklik yeni draft/version, validation,
   review ve publish gerektirir.
4. Run başlangıcında pack id/version, bundle digest, registry digest, derived-fact
   graph digest ve reducer version set'i pinlenir. Hot reload yalnız yeni run'ları
   etkiler.
5. Bundle load sırasında digest/schema/protocol/app compatibility uyuşmazlığı
   fail-closed preflight üretir.
6. V1 third-party/untrusted pack çalıştırmaz. İleride açılırsa signature, tenant
   ownership, capability allowlist, sandbox ve file/network/process erişim yasağı
   ayrı protocol/security checkpoint'i olmadan etkinleştirilemez.

## B.10B Nesy App Adapter sözleşmesi

App Adapter sıfırdan ikinci bir otomasyon katmanı olarak yazılmaz. Aşağıdaki mevcut
parçalar tek adapter altında refactor edilir:

- `NesyCommands`: login, route selection, delivery/task-list/vehicle-loading
  navigation.
- `NesyStateProvider`: login, route, schedule, current screen, pending request ve
  active task state'i.
- `roomQueries`: safe, allowlisted ve bounded named-query motoru.
- Structured Verdict events: UI completion, local persistence, queue, network ve
  backend response evidence'i.

İlk zorunlu query/capability set'i:

- `nesy.availableStops`
- `nesy.stopState`
- `nesy.taskState`
- `nesy.parcelState`
- `nesy.pendingOperation`
- scanner capability: `real`, `injected`, `manual_dialog`
- fixture/session preparation capability
- launch-profile capability

Kurallar:

1. Projection küçük, typed, bounded ve redacted olur; arbitrary SQL yoktur.
2. Scanner injection ve `DIRECT_STATE` yalnız automation build'de bulunur.
3. Production/release build izolasyon testi fail-closed'dur.
4. App Adapter yalnız dışarıdan güvenilir görülemeyen gerçeği sağlar; fiziksel UI
   eylemi Bridge'in, business planı Cockpit'in sorumluluğudur.
5. Pack/adapter version ve capability uyuşmazlığı cihaz action'ından önce fail eder.
6. UI, network veya local state'ten güvenilir biçimde çıkarılabilen transition için
   sırf kolaylık olsun diye duplicate explicit business event eklenmez.
7. Existing structured event'lerin her biri Evidence Source Registry'de fact,
   authority, correlation, freshness ve redaction gerekçesiyle allowlist edilir.

Örneğin rota dialog'u için zorunlu `Verdict.emit("ROUTE_DIALOG_OPENED")` eklemek
yerine `REMOTE.AUTH_ACCEPTED + LOCAL.USER_SESSION_AVAILABLE +
REMOTE.ROUTES_AVAILABLE + UI.ROUTE_DIALOG_READY` kullanılabilir. App event ancak
bu kaynaklarla güvenilir çıkarılamayan kritik/private transition için minimum
payload ve açık capability ile eklenir.

## B.10C Event normalization ve raw evidence politikası

Android callback'i, Cockpit'e taşınacak audit event'i ve workflow'un kullanacağı
semantic fact aynı şey değildir. Bağlayıcı pipeline şöyledir:

```text
Raw platform/app callback
  → SDK Local Observation Bus
  → sampling / deduplication / coalescing / redaction / payload budget
  → canonical technical evidence
  → SDK WAL
  → authenticated transport
  → durable host inbox
      ├── immutable/auditable technical evidence
      ├── DurableReceiptBus
      │     └── yalnız order-independent receipt-safe normalization/gate
      └── OrderedEvidenceBus
            └── Domain Pack reducer
                  → normalized domain fact + derivation provenance
```

Receipt lane canonical raw kanıtı veya ordered reducer sonucunu atlamaz. Bir
receipt-safe normalized fact ancak definition'ın order-independent olduğu publish
validation'ında kanıtlanmışsa üretilebilir; diğer bütün derivation ordered lane'dedir.

Örnek ayrım:

- Raw callback/observation: interceptor callback, state-provider invalidation,
  lifecycle callback, preference mutation bildirimi.
- Canonical technical evidence: `HTTP_RESPONSE_RECEIVED`,
  `SESSION_STORE_WRITE`, `DIALOG_WINDOW_CREATED`.
- Normalized domain fact: `AUTH_ACCEPTED`, `USER_SESSION_AVAILABLE`,
  `ROUTES_AVAILABLE`, `ROUTE_SELECTION_READY`.

Canonical technical evidence `eventSeq`, run/session/epoch, monotonic timestamp,
entity/correlation metadata, schema version, source ve redaction durumu ile WAL ve
durable inbox'ta korunur. Cockpit UI varsayılan olarak normalized fact gösterir;
raw/technical evidence yalnız audit ve diagnostic drill-down'da açılır.

SDK Local Observation Bus kuralları:

1. Aynı state transition olmadan tekrar tekrar emit edilmez; state/event semantiği
   ayrıdır.
2. Her source için rate limit, minimum interval/debounce, coalescing ve maksimum
   payload bütçesi manifestte tanımlanır.
3. Büyük collection veya business object stream edilmez; count, delta, stable id ve
   bounded projection kullanılır.
4. Query sonucu event stream'e dönüştürülmez; yalnız named query ile on-demand ve
   bounded döner.
5. Coalesced/dropped observation sayısı metric olarak korunur; audit boşluğu sessiz
   kalmaz.
6. Event fırtınası UI action latency'sini ve test sonucunu etkileyemez; backpressure
   ve overload davranışı contract test ile doğrulanır.
7. On-device reducer yalnız generic teknik canonicalization yapar. `STOP`, `PARCEL`,
   `MATCH`, `BETTING`, `AUTH_ACCEPTED` veya `ROUTES_AVAILABLE` gibi domain fact'ler
   Verdict Core SDK'ya gömülmez.
8. Privacy nedeniyle raw callback payload'ının tutulamadığı durumda hash/metadata,
   redaction reason ve policy version saklanır; “raw korunur” ilkesi hassas body'nin
   kopyalanması anlamına gelmez.

`DELIVERY_PERSISTED`, `DELIVERY_REQUEST_SENT`, `DELIVERY_RESPONSE_RECEIVED` ve
`QUEUE_OFFLINE` ayrı teknik/business anlamlarını korur; tek bir belirsiz “delivery
succeeded” event'inde eritilmez. Endpoint/class/preference adı değişikliği workflow'u
değil Domain Pack/App Adapter mapping'ini değiştirir.

## B.10D Bridge UiWaitPlan, `wait_any` ve dump politikası

Bridge business-agnostic kalır. Domain Pack screen/surface/target contract'ları
BridgeFlowCompiler tarafından generic `UiWaitPlan`'a çevrilir. `UiWaitPlan` host
tarafındaki logical plan'dır; ilk Bridge B2 protokolünde kalıcı/push tabanlı bir watch
registration değildir.

```ts
interface UiPredicate {
  selector: Selector | TargetFingerprint;
  condition: "APPEARS" | "DISAPPEARS" | "MATCH_COUNT" | "READY";
  expectedPackage?: string;
  expectedWindow?: string;
  minMatches?: number;
  maxMatches?: number;
  requireVisible?: boolean;
  requireUnobscured?: boolean;
}

interface UiWaitTarget {
  key: string;
  predicate: UiPredicate;
}

interface UiInterruptTarget extends UiWaitTarget {
  priority: number;
}

interface UiWaitEvaluationPolicy {
  initialEvaluation: true;
  primaryMode: "ACCESSIBILITY_EVENT_DRIVEN";
  safetyRescan: {
    enabled: true;
    scope: "ACTIVE_WINDOWS_OR_CHANGED_SUBTREES";
    minIntervalMs: number;
    maxIntervalMs: number;
    maxEvaluationsPerSecond: number;
    backoffPolicy: "ADAPTIVE";
  };
}

interface UiWaitPlan {
  expected: UiWaitTarget[];
  interrupts: UiInterruptTarget[];
  timeoutMs: number;
  stableForMs: number;
  ambiguityPolicy: "FAIL" | "REQUEST_DIAGNOSTIC";
  evaluationPolicy: UiWaitEvaluationPolicy;
}

interface WaitAnyRequest {
  command: "wait_any";
  requestId: string;
  runId: string;
  sessionId: string;
  epoch: number;
  occurrenceId: string;
  expected: UiWaitTarget[];
  interrupts: UiInterruptTarget[];
  timeoutMs: number;
  stableForMs: number;
  ambiguityPolicy: "FAIL" | "REQUEST_DIAGNOSTIC";
  evaluationPolicy: UiWaitEvaluationPolicy;
}

interface CancelRequest {
  command: "cancel_request";
  requestId: string;
  targetRequestId: string;
  runId: string;
  sessionId: string;
  epoch: number;
  occurrenceId: string;
}

type WaitAnyResult =
  | { status: "EXPECTED_MATCH"; targetKey: string; nodeRef: string; monoTs: number }
  | { status: "INTERRUPT_MATCH"; surfaceKey: string; nodeRef: string; monoTs: number }
  | { status: "AMBIGUOUS"; candidates: Candidate[]; monoTs: number }
  | { status: "TIMEOUT"; monoTs: number }
  | { status: "CANCELLED"; monoTs: number };

interface WaitAnyResponseEnvelope {
  requestId: string;
  runId: string;
  sessionId: string;
  epoch: number;
  occurrenceId: string;
  treeGen: number;
  result: WaitAnyResult;
}
```

`nodeRef` yalnız geçerli tree generation içinde kullanılabilen opaque ve kısa ömürlü
bir referanstır; stable business/entity id yerine geçmez. `Candidate[]` bounded ve
redacted'dır; tam accessibility ağacı içermez.

### İlk B2 execution modeli

- Expected target'lar ve possible interrupt'lar aynı bounded `wait_any` komutunda
  yarışır. İlk stable match tek correlated response olarak döner.
- Interrupt priority yalnız aynı evaluation generation'da birden çok interrupt
  eşleşirse deterministic tie-break sağlar; business policy Bridge'e taşınmaz.
- İlk B2'de unsolicited `WATCH_*` event bus, `register_watch`, `unregister_watch`,
  reconnect sonrası watch registry restore veya global sürekli watch yoktur.
- Cockpit UI “Expected Wait” ve “Interrupt Wait” ayrımını gösterebilir; bunlar wire
  seviyesinde ayrı registration değildir.
- Diagnostic capture bekleme sonucundan ayrıdır. `AMBIGUOUS`, `TIMEOUT` veya policy
  isteği sonrasında explicit scoped `dump`/artifact komutu çalıştırılır.

### Cancellation ve TCP concurrency contract'ı

`cancel_request`, aynı authenticated Bridge session'ında `targetRequestId`, run,
session ve epoch scope'u ile gönderilir. Bunun gerçekten çalışabilmesi için:

1. TCP/NDJSON reader loop uzun `wait_any` değerlendirmesinde bloke edilmez.
2. `wait_any`, `requestId` ile anahtarlanan cancellable worker/job'a dispatch edilir.
3. Reader yeni `cancel_request` frame'ini okuyup ilgili cancellation token'ı tetikler.
4. Socket writer tek serialized queue üzerinden response yazar; interleaved/bozuk
   NDJSON üretilemez.
5. Match/timeout/cancel yarışı idempotent “first terminal result wins” kuralıyla
   kapanır. Sonradan gelen cancel güvenli `ALREADY_TERMINAL` acknowledgement alır.
6. Socket close, run cancel, session/epoch değişimi ve timeout bütün worker/index
   state'ini temizler; orphan wait bırakılamaz.

### Event-driven local evaluation

Bridge request'i kabul ettiği anda, Accessibility event gelmesini beklemeden ilk
bounded scoped evaluation'ı yapar ve gerekli window/subtree index'ini kurar. Sonra:

```text
TYPE_WINDOW_STATE_CHANGED
TYPE_WINDOWS_CHANGED
TYPE_WINDOW_CONTENT_CHANGED
TYPE_VIEW_SCROLLED
  → ilgili window/subtree generation'ını güncelle
  → yalnız etkilenebilecek UiPredicate'leri yeniden değerlendir
  → stable/ambiguity durumunu güncelle
  → terminal durumda küçük WaitAnyResult döndür
```

Accessibility event primary trigger'dır. Buna ek olarak event'in hiç gelmemesi,
OEM event suppression, coalescing veya tree/index invalidation nedeniyle liveness
kaybını önlemek için evaluation policy'deki bounded scoped safety rescan çalışır.
Safety rescan:

- Yalnız active window veya değişmiş/ilgili subtree scope'unda çalışır.
- Ölçümlü min/max interval içinde adaptive backoff uygular.
- `maxEvaluationsPerSecond`, node/candidate ve CPU bütçesini aşamaz.
- Mutation, window generation değişimi veya event-loss signal'ında backoff'u sıfırlar
  ve immediate scoped reevaluation ister.
- Çalışma reason'ını (`INITIAL`, `ACCESSIBILITY_EVENT`, `MUTATION_INVALIDATION`,
  `SAFETY_RESCAN`, `EVENT_LOSS_RECOVERY`) metric/audit'e yazar.
- Deadline, cancellation ve fencing'i her evaluation öncesi doğrular.

`wait_any` implementasyonu 500 ms'de bir full tree dump/poll yapamaz. Sabit ve bütün
cihazlara uydurulmuş rescan sayıları master contract değildir; interval/rate değerleri
CP0/CP3 fiziksel ölçümünden sonra device/profile budget'ında dondurulur. Yerel node
index opsiyonel hızlandırmadır, doğruluk kaynağı değildir ve generation değişiminde
invalidate edilir.

**Mevcut durum düzeltmesi:** Bridge bugün sürekli full accessibility dump'ını
WebSocket üzerinden göndermemektedir; localhost TCP/NDJSON request-response ve
explicit `dump` scope kullanır. Planın işi var olmayan stream'i kapatmak değil,
gelecekte hot path'e sokulmasını engellemek ve `wait_any` runtime'ını eklemektir.
Transport WebSocket olmak zorunda değildir.

Birden çok paralel ve uzun ömürlü global observation ihtiyacı gerçek cihaz
telemetrisiyle kanıtlanırsa sonraki protocol major'da `register_watch` + push event
capability'si ayrıca tasarlanabilir. Bu gelecekteki capability ilk B2 DoD'sine dahil
değildir ve `wait_any` wire contract'ını sessizce değiştiremez.

## B.10E Continue Gate ve Final Oracle ayrımı

Her business occurrence iki ayrı değerlendirme taşır:

### Continue Gate

Executor'ın bir sonraki adıma geçebilmesi için gereken minimum blocking gerçektir.
Örnek: delivery surface hazır, hedef görünür ve engellenmemiş, gerekli app state
yüklenmiş. Koşul sağlandığı anda ilerler; deadline sabit uyku değildir.

### Final Oracle

Occurrence/run kapanmadan önce eventual olarak doğrulanacak nihai business
gerçeğidir. Local persistence, offline queue, payment, request dispatch ve remote
business state gibi kanıtların zorunluluğu ve zamanlaması birbirinden bağımsız,
fact-bazlı requirement olarak sınıflanır.

```ts
interface EvidencePolicy {
  allOf?: string[];
  anyOf?: string[];
  noneOf?: string[];
  deadlineMs: number;
  stableForMs?: number;
  unknownPolicy: "FAIL" | "RETRY" | "OPERATOR_ATTENTION";
}

interface EvidenceExpression {
  allOf?: string[];
  anyOf?: string[];
  noneOf?: string[];
}

interface OracleRequirement {
  factKey: string;
  obligation: "REQUIRED" | "WARNING" | "OPTIONAL" | "NOT_APPLICABLE";
  timing: "IMMEDIATE" | "EVENTUAL";
  deadlineMs?: number;
  onTimeout: "FAIL" | "INCONCLUSIVE" | "WARNING";
  applicabilityCondition?: EvidenceExpression;
}

interface FinalOraclePolicy {
  requirements: OracleRequirement[];
  completionExpression?: EvidenceExpression;
}

interface EvidenceDrivenStepPolicy {
  continueGate: EvidencePolicy;
  finalOraclePolicy: FinalOraclePolicy;
}
```

Fact referansları Evidence Source Registry'de resolve edilir. Deadline bulunması
fixed wait anlamına gelmez; koşul event-driven değerlendirilir ve sağlandığı anda
gate kapanır.

Örnek sözleşme:

```json
{
  "continueGate": {
    "allOf": ["ui.delivery_surface_ready", "app.delivery_started"],
    "deadlineMs": 10000,
    "stableForMs": 250
  },
  "finalOraclePolicy": {
    "requirements": [
      {
        "factKey": "local.delivery_persisted",
        "obligation": "REQUIRED",
        "timing": "IMMEDIATE",
        "onTimeout": "FAIL"
      },
      {
        "factKey": "remote.delivery_confirmed",
        "obligation": "REQUIRED",
        "timing": "EVENTUAL",
        "deadlineMs": 120000,
        "onTimeout": "INCONCLUSIVE"
      },
      {
        "factKey": "remote.config_resolved",
        "obligation": "WARNING",
        "timing": "EVENTUAL",
        "deadlineMs": 30000,
        "onTimeout": "WARNING"
      }
    ]
  }
}
```

Login/bootstrap örneğinde evidence rolleri:

| Gerçek | Continue Gate | Final Oracle |
|---|---|---|
| `REMOTE.AUTH_ACCEPTED` | Required | Required |
| `LOCAL.USER_SESSION_AVAILABLE` | Required | Required |
| `REMOTE.ROUTES_AVAILABLE` | Required | Required |
| `REMOTE.COURIER_PROFILE_AVAILABLE` | Optional | Required/Eventual |
| `REMOTE.CONFIG_RESOLVED` | Optional | Warning/Eventual |
| `APP.PUSH_REGISTRATION_COMPLETED` | Not applicable | Optional |

Bu tablo statik Verdict Core kuralı değildir; Nesy Courier Domain Pack oracle
template'inin versioned örneğidir. `APP` kanıtı güvenilir biçimde gerekmiyorsa sırf
dört rozet dolsun diye explicit business event eklenmez ve katman
`NOT_APPLICABLE` olabilir.

`REQUIRED/EVENTUAL` gibi iki boyutlu durumlar aynı requirement içinde taşınır;
aynı fact'in paralel `required[]` ve `eventual[]` listelerinde tekrar edilmesi yasaktır.
`completionExpression`, `allOf/anyOf` gibi business kompozisyon gerektiğinde fact
requirement'larının kimliğini ve deadline politikasını kaybetmeden kullanılır.

Timeout koşulun üst sınırıdır. `sleep(15000)` veya hiç eşleşmeyecek sahte selector
ile fixed wait yasaktır. Final Oracle'ın pending olması Continue Gate politikasına
göre akışı durdurmayabilir; fakat run terminal sonucu eventual validation bitmeden
yanlış biçimde yeşil olmaz.

## B.10F Evidence Source Registry ve fact authority

Workflow endpoint, table, preference, callback veya Android class adı beklemez;
versioned normalized fact bekler. Fact'in hangi observation'dan ve hangi güven
seviyesiyle üretildiğini Domain Pack Evidence Source Registry tanımlar.

```ts
type EvidencePlane = "UI" | "APP" | "LOCAL" | "REMOTE";

type EvidenceSourceKind =
  | "BRIDGE_WAIT"
  | "NETWORK_OPERATION"
  | "SDK_EVENT"
  | "SDK_STATE_PROVIDER"
  | "NAMED_QUERY"
  | "DATABASE_VERIFIER"
  | "REMOTE_VERIFIER"
  | "DERIVED_FACT";

interface EvidenceSourceDefinition {
  factKey: string;
  plane: EvidencePlane;
  sourceKind: EvidenceSourceKind;
  sourceRef: string;
  authority: "PRIMARY" | "CONFIRMATORY" | "FALLBACK";
  deliveryLane: "RECEIPT_SAFE" | "ORDERED_REQUIRED";

  correlation: CorrelationDefinition;
  freshness: FreshnessPolicy;
  normalization: NormalizationRule;
  redactionPolicy: string;
  requiredCapabilities: string[];
  fallbackSourceRefs?: string[];
}

interface DerivedFactDefinition {
  factKey: string;
  dependsOn: string[];
  reducerKey: string;
  reducerVersion: string;
  outputSchemaVersion: string;
  deliveryLane: "RECEIPT_SAFE" | "ORDERED_REQUIRED";
  idempotencyPolicy: "INPUT_FACT_SET_AND_REDUCER_VERSION";
  maxInputFacts?: number;
}
```

`deliveryLane`, SDK inbox kaynaklarında hangi durable bus'ın kullanılacağını;
Bridge wait/named query/remote verifier gibi doğrudan probe kaynaklarında ise fact'in
sequence ordering gerektirip gerektirmediğini belirtir. Doğrudan probe'yu yapay bir
SDK Receipt Bus event'ine çevirmek zorunlu değildir; sonuç yine canonical evidence
store'a yazılmadan Final Oracle authority'si olamaz.

Kurallar:

1. Source seçimi tek bir global öncelik listesiyle değil **fact bazında** yapılır.
   UI readiness için Bridge, remote transport için network observation, persisted
   local gerçek için named query/DB verifier doğal primary olabilir.
2. Authoring varsayılanı: dışarıdan güvenilir observation → network/local source →
   mevcut SDK telemetry → derived fact → explicit app business event. Explicit app
   event son tercihtir; ancak dışarıdan gözlenemeyen kritik/private transition için
   açık gerekçeyle primary source olabilir.
3. Transport success ile business success aynı değildir. Örneğin HTTP `2xx` tek
   başına `ROUTES_AVAILABLE` üretmeyebilir; önce `ROUTES_REQUEST_SUCCEEDED` teknik
   fact'i oluşur, business fact response projection, app state, local persistence
   veya remote verifier ile doğrulanır.
4. `correlation` en az run/session/epoch ve gerektiğinde occurrence/entity/request
   bağını tanımlar. Correlation kurulamayan evidence başka occurrence'ı geçiremez.
5. `freshness`, run başlangıcından önceki stale state'in yeni başarı sayılmasını
   engeller; snapshot fact ile transition fact açıkça ayrılır.
6. Aynı fact için birden çok source varsa conflict policy fail-closed'dur. Primary ve
   confirmatory kaynak çelişirse sessiz fallback yapılmaz; `EVIDENCE_CONFLICT`
   üretilir.
7. Registry compile-time capability gate üretir. Gerekli source capability yoksa
   runtime'a eksik oracle ile başlanmaz.
8. `deliveryLane` zorunludur. Bağımsız commit edilmiş receipt ile doğrulanabilen fact
   `RECEIPT_SAFE`; sequence/reducer state'ine bağımlı fact `ORDERED_REQUIRED` olur.
   Receipt-safe olmayan fact düşük gecikmeli bus'a bağlanamaz.
9. Derived fact tanımları tek versioned dependency graph oluşturur. Publish/compiler
   graph'ı DAG olarak doğrular; cycle, self-dependency, undefined input, limit aşımı
   ve topological sırası üretilemeyen pack fail-fast reddedilir.
10. Derived output idempotency anahtarı exact input fact identity set'i + reducer
    version + output schema version'dır. Replay duplicate logical fact üretmez.
11. Derived fact provenance'ı input fact/event identity'lerini, authority/lane'i,
    reducer key/version'ını, pack bundle digest'ini ve evaluation timestamp'ini taşır.
12. Run exact Evidence Source Registry ve derived graph digest'ini başlangıçta pinler;
    pack hot reload, reducer veya mapping değişikliği aktif run'a uygulanmaz.

Örnek:

```json
{
  "factKey": "REMOTE.ROUTES_AVAILABLE",
  "plane": "REMOTE",
  "sourceKind": "REMOTE_VERIFIER",
  "sourceRef": "nesy.remote.routes-for-courier",
  "authority": "PRIMARY",
  "deliveryLane": "RECEIPT_SAFE",
  "correlation": { "keys": ["runId", "courierId"] },
  "freshness": { "maxAgeMs": 30000, "afterRunStart": true },
  "normalization": { "schema": "routes-available/v2" },
  "redactionPolicy": "nesy.route-summary/v1",
  "requiredCapabilities": ["remote_verifier.routes.v2"],
  "fallbackSourceRefs": ["nesy.local.available-routes"]
}
```

Fallback örnekte otomatik equivalence anlamına gelmez; `LOCAL` fallback kullanılırsa
plane/result policy bunu `REMOTE` doğrulanmış gibi boyayamaz. Queue da ayrı beşinci
plane değildir: `LOCAL.PENDING_OPERATION_WAITING` local fact'i ve
`PASS_QUEUED_OFFLINE` terminal sonuç politikasıdır.

## B.11 BridgeFlowPlan ve compiler

Compiler:

1. Workflow version + run input + Domain Pack/version alır.
2. Shared WorkflowIR v2 ve Domain Pack contract'larıyla doğrular.
3. Pack/adapter/application compatibility ve capability gate'ini çalıştırır.
4. Semantic macro/entity/query tanımlarını generic IR v2'ye açar.
5. Compile-time condition'ları çözer.
6. Runtime probe ve generic `UiWaitPlan` sözleşmesini planlar.
7. Loop, occurrence ve branch sınırlarını doğrular.
8. Capability manifest üretir.
9. Continue Gate ve unified OracleRequirement/evidence applicability politikalarını
   bağlar.
10. Her fact/source için receipt-safe veya ordered-required delivery lane'ini
    doğrular ve plana yazar.
11. Derived fact DAG/reducer set'i ile immutable Domain Pack bundle digest'ini pinler.
12. Deterministik plan, source map ve hash üretir.

Compiler cihazda action çalıştırmaz. Preflight'a ihtiyaç duyduğu capability ve
runtime probe listesini verir.

## B.12 Dört katmanlı evidence modeli

| Katman | Kaynak | Örnek |
|---|---|---|
| UI | Bridge | Node görünür, engellenmemiş, action applied, tree değişti |
| App | SDK event/state | DELIVERY_STARTED, SCREEN_READY, state field |
| Local | Host ADB/run-as, safe provider veya named query | SQLite entity/queue/persistence durumu |
| Remote | Backend verifier | Request/response ve server entity durumu |

`QUEUE` beşinci bağımsız ana layer değildir; Local layer'ın açık evidence subtype'ı
ve App event'leriyle korele edilen business durumudur. Benzer biçimde `APP_STATE`
App layer altında kalır. UI/App/Local/Remote dört ana boyutu korunur.

Completion policy örnekleri:

- `UI_ONLY`
- `UI_AND_APP`
- `APP_AND_REMOTE`
- `UI_AND_LOCAL_AND_REMOTE`
- `QUEUE_OFFLINE_ACCEPTED`
- `ANY_OF`
- `ALL_OF`

Ekranın yeşil görünmesi tek başına business success sayılmaz.

Continue Gate yalnız blocking evidence'i, Final Oracle ise policy'deki blocking +
eventual evidence'i değerlendirir. Aynı evidence iki kararda farklı applicability
taşıyabilir; bu ayrım plan/occurrence kaydında açıkça persist edilir.

### Katman uygulanabilirliği

Her node'da dört katmanın tamamı zorunlu değildir. Compile-time plan katman
applicability/obligation'ını; her fact için B.10E `OracleRequirement` ise ayrı olarak
`obligation`, `timing`, deadline ve timeout kararını açıkça belirtir:

```json
{
  "layerApplicability": {
    "ui": { "obligation": "REQUIRED" },
    "app": { "obligation": "REQUIRED" },
    "local": { "obligation": "REQUIRED" },
    "remote": { "obligation": "OPTIONAL" }
  },
  "finalOraclePolicy": {
    "requirements": [
      {
        "factKey": "LOCAL.DELIVERY_PERSISTED",
        "obligation": "REQUIRED",
        "timing": "IMMEDIATE",
        "onTimeout": "FAIL"
      },
      {
        "factKey": "REMOTE.DELIVERY_CONFIRMED",
        "obligation": "REQUIRED",
        "timing": "EVENTUAL",
        "deadlineMs": 15000,
        "onTimeout": "INCONCLUSIVE"
      },
      {
        "factKey": "REMOTE.CONFIG_RESOLVED",
        "obligation": "WARNING",
        "timing": "EVENTUAL",
        "deadlineMs": 5000,
        "onTimeout": "WARNING"
      }
    ]
  }
}
```

`layerApplicability` editör/plan özetidir; Final Oracle'ın normatif kararı B.10E'deki
fact-bazlı `OracleRequirement` kayıtlarından üretilir. Eski `required[]`,
`eventual[]`, `warning[]` paralel listeleri yeni contract'a yazılmaz. Bir fact'in
zorunluluğu, zamanlaması, deadline'ı ve timeout kararı tek requirement içindedir.

Her layer'ın durumu:

- `REQUIRED_PENDING`
- `PASSED`
- `FAILED`
- `WARNING`
- `NOT_APPLICABLE`
- `NOT_MEASURED`
- `INCONCLUSIVE`

UI'da `NOT_APPLICABLE`, `NOT_MEASURED` ve `REQUIRED_PENDING` aynı gri rozetle
anlam kaybına uğratılmaz.

### Oracle sonuç taksonomisi

Node ve run sonucu yalnız kırmızı/yeşil değildir; fakat farklı eksenler de tek enum'a
karıştırılmaz:

- Terminal product verdict B.8'deki `PASS_ONLINE`, `PASS_QUEUED_OFFLINE`,
  `FAIL_PRODUCT` veya `INCONCLUSIVE` olur.
- `NOT_EVALUATED` henüz ürün hükmü verilmediğini ifade eder.
- Automation veya environment kaynaklı değerlendirme sorunları ProductVerdict üretmez;
  `EvaluationFailureClass.AUTOMATION_FAILURE` veya
  `EvaluationFailureClass.ENVIRONMENT_FAILURE` olarak ayrı eksende saklanır.
- `EVIDENCE_INSUFFICIENT`, ürünün başarısız olduğunu kanıtlamaz; kanıt yetersizliği
  nedeniyle değerlendirme yapılamadığını gösterir.
- `PENDING_REMOTE`, Final Oracle'ın terminal olmayan evaluation state'idir.
- `FAIL_UI`, `FAIL_APP`, `FAIL_LOCAL` ve `FAIL_REMOTE` business verdict değil,
  per-layer result/root-cause classification'dır.
- `CANCELLED` yalnız `RunTerminationReason`; `UNKNOWN_ACTION_EFFECT` action sonucu
  ve/veya termination reason'dır. Bunlar business Oracle hükmü yerine kullanılmaz.

`Local=PASSED + offlineQueue=PASSED + remote yok` otomatik failure değildir;
node politikasına göre `PASS_QUEUED_OFFLINE` veya `PENDING_REMOTE` olur.

### Remote business doğruluğu

`HTTP 2xx` transport başarısıdır; tek başına business success değildir. Remote
Oracle mümkün olduğunda şunları birleştirir:

- HTTP status.
- Response business result/code.
- Backend entity/query sonucu.
- Dispatcher veya queue state.
- Backend correlation/request ID.
- SDK/host request correlation.
- Entity version/state.
- Eventual-consistency deadline.

Örnek olarak `HTTP 200 + business rejection` fail; `HTTP 202` pending;
`HTTP 500 + doğru offline queue` queued-offline pass; `HTTP 200 + değişmeyen
backend entity` fail veya deadline'a kadar pending olabilir.

## B.13 Veri modeli hedefi

### Run alanları

- engine type
- plan version/hash/compiled plan
- workflow contract version
- SDK/control contract version
- Bridge protocol/app version
- capability snapshot
- Domain Pack/application/registry/launch-profile version, immutable bundle hash ve
  derived-fact graph/reducer version snapshot'ı
- Evidence Source Registry version/hash ve delivery-lane snapshot'ı
- run/session/epoch
- auth state
- last seq/ACK/gap
- lifecycle state, business verdict ve verdict revision
- termination reason, cleanup result ve operational disposition
- recovery/cancel state
- artifact manifest
- security/audit references

### Step occurrence alanları

- source node, compiled step, occurrence ve iteration
- attempt/requestId
- uiWaitRequestId ve expected/interrupt result
- selector/treeGen
- monotonic ve wall timestamps
- actionResult, continueGateResult, finalOracleResult ve cleanupResult
- error/termination/operational taxonomy
- UI/App/Local/Remote evidence refs
- fact source/authority/correlation/freshness/delivery lane ve derivation DAG refs
- condition/dialog decision
- retry/cancel/recovery bilgisi

Geçiş migrasyonu önce additive yapılır: eski engine'e ait gerekli tarihsel veri
generic `legacyExecutionArtifact`/artifact export modeline taşınır ve engine-neutral
Run Detail üzerinden okunur. Taşıma doğrulandıktan sonra `yamlContent`,
`maestroOutput` ve diğer engine-specific kolon/DTO/type/renderer'lar drop edilir.
Nihai şemada veya UI'da Maestro'ya özel read model kalmaz.

## B.14 Cockpit UI hedefi

### Route ve bilgi mimarisi

```text
Automation
├── /automation/list
├── /automation/history
├── /automation/domain-packs
├── /automation/domain-packs/[packId]
│   ├── Manifest & Compatibility
│   ├── Applications
│   ├── Screens
│   ├── Surfaces
│   ├── Entities & Targets
│   ├── Evidence Sources
│   ├── Semantic Actions & Macros
│   ├── Oracle Templates
│   ├── Launch Profiles
│   ├── Test Profiles
│   └── Migrations & Validation
├── /automation/test-profiles
├── /automation/test-profiles/[profileId]
├── /automation/test-campaigns
├── /automation/test-campaigns/[campaignId]
├── /automation/field-login
├── /automation/01-load-tour-flow
├── /automation/[id]
└── /automation/[id]/runs/[runId]

Debug View
├── /debug-view/overview
├── /debug-view/operational-health
├── /debug-view/screen-state        # Live Inspector rolü
├── /debug-view/interactions
├── /debug-view/network-inspector
├── /debug-view/schedule
├── /debug-view/database
├── /debug-view/adb-scenarios
└── /debug-view/log-explorer
```

`/automation/domain-packs/[packId]` tek SSOT manager'dır; aynı registry için dağınık
ve birbirinden kopuk ayrı editör route'ları oluşturulmaz. Workflow Editor yalnız
seçilen published/draft pack referansını kullanır ve gerekli manager tab'ına deep-link
verir. Live Inspector mapping kaydettiğinde pack draft/DB override hedefini açıkça
seçtirir; sessizce production pack'i mutate etmez.

`/automation/test-profiles` ve `/automation/test-campaigns` aynı Automation workspace
altında kalır. Bunlar yeni top-level Verdict workspace oluşturmaz ve Domain Pack
manager'ın yerine geçmez. Test Profile catalog kullanıcıya smoke/regression/recovery/
load/security gibi ürün niyetlerini gösterir; detay route'u ise profile'ın hangi
published Domain Pack version'ına, workflow'a, launch profile'a, dataset'e, fault
planına, cihaz matrisine, telemetry ve Oracle politikasına bağlı olduğunu gösterir.
Campaign route'u profile run'larını build/environment/device matrix altında gruplar ve
her profile cell'inden gerçek Run Detail'e deep-link verir.

Automation layout'taki `NesyAuthProvider`, platform authoring authorization'ının
yerine geçmez. Domain Pack catalog/manager, workflow list/history ve read-only editor
Cockpit platform RBAC ile açılabilir; Nesy Dashboard session yalnız backend fixture,
remote operation veya ilgili run precondition'ı gerçekten gerektiriyorsa istenir.
Data Center auth ile SDK run-session auth aynı badge/gate altında birleştirilmez.

### Page availability state'i

Her dinamik sayfa server tarafından üretilen capability/checkpoint snapshot'ından
aşağıdaki state'lerden birini türetir:

- `AVAILABLE`: hedef data source ve zorunlu capability'ler hazır.
- `READ_ONLY`: gözlem yapılabilir; mutation/Act Mode policy veya environment nedeniyle
  kapalı.
- `BLOCKED_PRECONDITION`: auth, device, Bridge, Domain Pack, Evidence Source veya
  compatibility eksik; açık reason/action gösterilir.
- `MIGRATION_REQUIRED`: workflow/pack/run eski schema'da; migrate/legacy-summary yolu
  gösterilir.
- `MEASUREMENT_ONLY`: yalnız CP8 izole dual-run karşılaştırmasında kullanılabilir.
- `REMOVED`: legacy Maestro/YAML işlevi artık sunulmaz; fallback yoktur.

Kalıcı environment feature flag'i page doğruluğunun kaynağı olamaz. Geçici cutover
flag'i owner, expiry, telemetry ve removal checkpoint'i taşır. UI capability eksikken
butonu yalnız gizlemez; kullanıcıya neden ve hangi güvenli aksiyonun gerektiğini
gösterir.

### Automation Editor

- Domain Pack/application/version seçimi ve compatibility sonucu.
- Application/Screen/Surface Registry manager ve validation sonucu.
- Semantic action/macro palette'i; generic IR primitive'leri gerektiğinde advanced görünüm.
- Entity/query binding, Target Resolution Provider Chain ve Launch Profile Builder.
- Test Profile Builder: workflow, launch profile, dataset, repetition, device matrix,
  fault trigger, telemetry, finalOracle, cleanup ve schedule class.
- Test Campaign Builder: buildRef, environment, profile selection, matrix override,
  PR/nightly/weekly/release policy ve release gate sonucu.
- Evidence Source Registry; fact authority/delivery-lane/correlation/freshness ve
  derived dependency DAG editörü.
- Typed node forms.
- Selector Builder.
- Condition builder.
- Continue Gate ve unified OracleRequirement/evidence policy editörü.
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
- Screen/Surface Registry mapping oluşturma; mapping source'a yazma veya versioned DB override kararı.
- Current Screen ile Active Surface'leri ayrı gösterme.
- Çalışan Expected/Interrupt `wait_any` hedefleri ve son result/treeGen görünümü.
- Production read-only policy.

### Run Detail

- Compact görünümde occurrence-applicable, detail'de explicit state taşıyan dört
  UI/App/Local/Remote katman sunumu.
- Occurrence/iteration timeline.
- Event sequence ve ACK/gap görünümü.
- Emit→WAL→transport→inbox→receipt→ordered→normalization→correlation→evaluation
  Evidence Journey drawer'ı ve raw evidence deep-link'leri.
- Condition/dialog kararları.
- Continue Gate'in neden/ne zaman geçtiği ve eventual Final Oracle durumu.
- Lifecycle, business verdict, termination, cleanup ve operational disposition ile
  step action/gate/oracle/cleanup sonuçlarının ayrı görünümü.
- Fact receipt/ordered lane ve pinned pack/graph/reducer provenance'ı.
- Wait expected-match/ambiguity/interrupt/timeout/cancel timeline'ı.
- Retry/recovery.
- Bridge-injected/manual/unknown interaction origin ve confidence.
- Exact capture manifest'li Copy repro; yakalanmayan artifact için `NOT_CAPTURED`.

### Device Lab

Tek “Bridge” etiketi yerine:

- ADB Host
- SDK Control
- SDK Event/Auth
- Durable Ingest — Receipt Bus ve Ordered Bus health ayrı
- Accessibility Bridge
- Command Admission — active/queued control, observation, wait ve mutation
- Backend Credentials
- Local DB Access
- Active Run

## B.15 Ortak zaman ekseni ve host-device korelasyonu

SDK ve Bridge ayrı process'ler olsa da aynı Android cihazında
`SystemClock.elapsedRealtime()` / `CLOCK_BOOTTIME` eksenini paylaşır. Cockpit
host'un monotonic saati ise farklı bir eksendir ve doğrudan device `monoTs` gibi
yorumlanamaz.

```text
SDK monoTs -----┐
Bridge monoTs --┼-- device CLOCK_BOOTTIME
                │
Host event -----┴-- ping offset + capture marker ile hizalanır
```

### Persist edilecek korelasyon alanları

- SDK/Bridge `deviceMonoTs`.
- Host receive monotonic time.
- Ping send/receive zamanları ve round-trip.
- Tahmin edilen host-device offset.
- Offset uncertainty/error bound.
- Capture başlangıç/bitiş marker'ları.
- Device boot identity.
- Calibration version ve oluşturulma zamanı.

### Bağlayıcı kurallar

- Wall clock/NTP run sıralamasının ana kaynağı değildir.
- Reboot sonrası eski calibration kullanılamaz.
- Timestamp taşımayan host ölçümü en yakın marker aralığına yerleştirilir;
  sahte device kesinliğiyle gösterilmez.
- Diagnostic waterfall belirsizliği kullanıcıya gösterir.
- Oracle ordering, yalnız tanımlı aynı-domain veya kalibrasyonlu karşılaştırma yapar.
- Repro paketi kullanılan clock anchor ve uncertainty bilgisini taşır.

## B.16 Evidence Journey ve Missing Evidence Diagnostic

“Cockpit'te event görünmedi” tek bir arıza sınıfı değildir. Bir observation'ın SDK
çağrısından Oracle kararına kadar geçtiği aşamalar ayrı modellenir; teşhis yalnız
doğrudan evidence veya sınırları belirtilmiş inference ile yapılır.

```ts
type EvidenceJourneyStage =
  | "EMIT_ATTEMPT"
  | "WAL_ACCEPTANCE"
  | "TRANSPORT"
  | "INBOX_COMMIT"
  | "RECEIPT_DELIVERY"
  | "ORDERED_PROCESSING"
  | "NORMALIZATION"
  | "CORRELATION"
  | "EVALUATION";

type EvidenceJourneyState =
  | "CONFIRMED"
  | "FAILED"
  | "PENDING"
  | "BLOCKED"
  | "NOT_OBSERVED"
  | "NOT_APPLICABLE"
  | "UNKNOWN";

type DiagnosticAuthority = "DIRECT" | "DERIVED" | "INFERRED";
type DiagnosticConfidence = "CERTAIN" | "BOUNDED_INFERENCE" | "UNKNOWN";

interface EvidenceJourneyEntry {
  journeyId: string;
  runId: string;
  sessionId: string;
  epoch: number;
  occurrenceId: string;
  factKey?: string;
  stage: EvidenceJourneyStage;
  state: EvidenceJourneyState;
  reasonCode?: string;
  authority: DiagnosticAuthority;
  confidence: DiagnosticConfidence;
  sourceRef?: string;
  eventSeq?: number;
  requestId?: string;
  deviceMonoTs?: number;
  hostMonoTs?: number;
  clockCalibrationId?: string;
  evidenceRefs: string[];
}
```

### Aşama anlamları

1. `EMIT_ATTEMPT`: App/SDK emit çağrısının gerçekten yapıldığı ve yerel sonucun
   gözlendiği aşama. Çağrının yokluğu veya caller'ın dönüş değerini kullanmaması bu
   aşamayı otomatik `FAILED` yapmaz.
2. `WAL_ACCEPTANCE`: Observation'ın durable WAL'a append edildiği veya açıkça
   `SKIPPED`, `NO_SPACE`, `WRITE_FAILED` sonucu aldığı aşama.
3. `TRANSPORT`: Authenticated socket seçimi, frame gönderimi ve host'a ulaşma
   teşhisi. Socket yok/auth fail/backpressure burada sınıflanır.
4. `INBOX_COMMIT`: Host durable inbox transaction'ının commit edildiği aşama. ACK
   yalnız ilgili durable contract sağlandıktan sonra anlamlıdır.
5. `RECEIPT_DELIVERY`: Commit edilmiş receipt-safe evidence'ın receipt cursor ile
   subscriber'a ulaştığı aşama.
6. `ORDERED_PROCESSING`: Contiguous ordered cursor/reducer işleme aşaması. Gap veya
   poison event nedeniyle `BLOCKED` olabilir; bu sırada receipt delivery doğrulanmış
   kalabilir.
7. `NORMALIZATION`: Canonical technical evidence'ın Domain Pack reducer ile
   normalized fact'e dönüşmesi.
8. `CORRELATION`: Fact'in doğru run/session/epoch/occurrence/entity/attempt ile ve
   freshness policy'si içinde eşleşmesi.
9. `EVALUATION`: Continue Gate veya Final Oracle requirement'ının fact'i kabul,
   reject, pending ya da timeout kararıyla değerlendirmesi.

### Negatif evidence ve authority kuralları

- `NOT_OBSERVED != FAILED`. Bir stage ancak o stage'e ait doğrudan hata kaydı veya
  contract'ın izin verdiği bounded inference varsa `FAILED` olur.
- SDK `EmitOutcome` (`APPENDED`, `SKIPPED`, `NO_SPACE`, `WRITE_FAILED` vb.) yerel
  Kotlin dönüş değeridir. Caller sonucu explicit raporlamadıysa ve bounded SDK
  diagnostic state/query bu sonucu taşımıyorsa Cockpit event yokluğundan exact
  `EmitOutcome` çıkaramaz.
- WAL'da event bulunması `WAL_ACCEPTANCE=CONFIRMED` için güçlü kanıttır; ancak event
  bulunmaması “emit hiç çağrılmadı” ile “append başarısız” seçeneklerini tek başına
  ayıramaz.
- Her emit sonucunu yeni durable event olarak stream etmek recursion/event fırtınası
  riski nedeniyle yasaktır. SDK diagnostic provider bounded counter/last-outcome,
  reason histogramı veya explicit caller-reported result sunabilir; sorgu on-demand,
  redacted ve rate-limited olur.
- `DIRECT` kayıt gerçek WAL row, inbox row, cursor, reducer output, Oracle decision
  veya açık SDK diagnostic sonucuna dayanır. `DERIVED` deterministic kuralın input
  evidence'larını; `INFERRED` ise inference sınırı ve confidence'ını taşır.
- Çelişen stage kayıtları sessizce overwrite edilmez; `EVIDENCE_STAGE_CONFLICT`
  üretir ve iki evidence ref'i de korunur.
- Geçmiş bir ölçüm veya eski host rejection oranı runtime'da güncel stage sonucu
  gibi hard-code edilmez. Yalnız versioned benchmark artifact'i olarak gösterilir.

Örnek reason code'lar: `SDK_SKIPPED`, `WAL_NO_SPACE`, `WAL_WRITE_FAILED`,
`TRANSPORT_AUTH_FAILED`, `INGEST_REJECTED`, `RECEIPT_DISPATCH_FAILED`, `GAP_BLOCKED`,
`ORDERED_DEAD_LETTER`, `NORMALIZATION_FAILED`, `CORRELATION_MISS`, `EVIDENCE_STALE`
ve `ORACLE_DEADLINE`.

### Diagnostic karar matrisi

| Gözlenen kanıt | Güvenli teşhis | Söylenmeyecek iddia |
|---|---|---|
| Explicit `EmitOutcome.NO_SPACE` | WAL acceptance failed / no space | Transport veya host reject oldu |
| WAL row var, inbox row yok | WAL confirmed; transport/ingest henüz ayrıştırılamadı | SDK emit edilmedi |
| Inbox commit var, receipt cursor ilerledi, ordered gap var | Receipt confirmed; ordered processing blocked | Event tamamen kayıp |
| Ordered row var, fact yok, reducer error var | Normalization failed | Correlation veya Oracle kesin hatalı |
| Fact var, occurrence eşleşmiyor | Correlation failed | SDK/WAL hatalı |
| Fact doğru, requirement deadline açık | Evaluation pending | Remote/application failed |
| Hiçbir doğrudan kayıt yok | Unknown/not observed | Kesin SDK failure |

Evidence Journey read model'i source-specific ham verileri silmez; stage özetinden
ham WAL/inbox/cursor/reducer/fact/Oracle evidence ref'lerine gidilebilir. Receipt ve
ordered aşamaları tek “host received” rozeti altında eritilmez.

## B.17 Layer Presentation, Interaction Origin ve Repro Capture

### Layer presentation authority

Applicability ve presentation authority zinciri şöyledir:

```text
Domain Pack Oracle Template
  → WorkflowIR v2
  → BridgeFlowPlan
  → occurrence layer-applicability snapshot
  → Run Detail / Editor / History presentation
```

```ts
type EvidencePlane = "UI" | "APP" | "LOCAL" | "REMOTE";
type LayerObligation = "REQUIRED" | "OPTIONAL" | "NOT_APPLICABLE";
type LayerPresentationState =
  | "REQUIRED_PENDING"
  | "PASSED"
  | "FAILED"
  | "WARNING"
  | "NOT_APPLICABLE"
  | "NOT_MEASURED"
  | "INCONCLUSIVE";

interface OccurrenceLayerApplicabilitySnapshot {
  snapshotId: string;
  planHash: string;
  occurrenceId: string;
  planes: Record<
    EvidencePlane,
    {
      obligation: LayerObligation;
      state: LayerPresentationState;
      evidenceRevision: number;
      evidenceRefs: string[];
    }
  >;
}
```

`workflow-registry.ts` veya web component içindeki liste yalnız authoring default'u
olabilir; runtime gerçeğinin SSOT'u olamaz. Plan execution başladığında occurrence
snapshot'ı immutable persist edilir ve geçmiş run yeni pack/editör değişikliğinden
etkilenmez.

Sunum kuralları:

1. Compact canvas/run node yalnız o occurrence için applicable katmanları gösterir.
2. Detail drawer UI/App/Local/Remote katmanlarının dördünü de gösterir; ilgisiz veya
   ölçülmeyen katmanları `NOT_APPLICABLE`/`NOT_MEASURED`, bekleyen zorunlu katmanı
   `REQUIRED_PENDING` olarak açık yazar.
3. Dört ana plane dışında `QUEUE` veya `APP_STATE` rozeti üretilmez; bunlar sırasıyla
   Local evidence subtype ve App source'dur.
4. Badge'ler UI→App→Local→Remote sırasıyla dekoratif olarak “yakılmaz”. Her badge
   kendi persisted evidence transition'ında bağımsız güncellenir. Olay chronology'si
   yalnız calibrated waterfall/Evidence Journey üzerinde gösterilir.
5. Live subscription reconnect veya out-of-order UI delivery, persisted version/
   revision'dan eski state'i geri yazamaz.

### Interaction origin

```ts
type InteractionOrigin = "BRIDGE_INJECTED" | "MANUAL" | "UNKNOWN";

interface InteractionOriginEvidence {
  origin: InteractionOrigin;
  confidence: DiagnosticConfidence;
  runId?: string;
  sessionId?: string;
  epoch?: number;
  occurrenceId?: string;
  requestId?: string;
  targetFingerprintHash?: string;
  gestureStartedDeviceMonoTs?: number;
  gestureCompletedDeviceMonoTs?: number;
  sourceRefs: string[];
}
```

- `BRIDGE_INJECTED` için primary authority Bridge action lifecycle/requestId ve
  injected gesture monotonic interval'ıdır.
- Aktif otomasyon aralığı dışında güvenilir accessibility touch/gesture observation'ı
  ve contamination policy ile eşleşen etkileşim `MANUAL` olabilir.
- SDK `InteractionCapture` tarafından üretilen generic click, güçlü request/target/
  device-mono correlation yoksa `UNKNOWN` kalır; otomatik olarak manual sayılmaz.
- Origin resolver tolerans penceresi clock uncertainty'yi hesaba katar. Birden fazla
  aday veya yetersiz timestamp sahte kesinlik üretmez.
- İnsan etkileşim hacmi/baseline metriği aktif automated run dışından alınır veya
  origin'e göre ayrı serilere bölünür. `BRIDGE_INJECTED` human baseline'a katılmaz;
  `UNKNOWN` ayrı raporlanır.
- Bu model yeni domain business event adı gerektirmez. Exact origin için gerekirse
  App Adapter/SDK diagnostic metadata additive ve automation-safe eklenir; Core
  public business API'sine Nesy-specific contract sokulmaz.

Sorumluluk dağılımı:

| Bileşen | Üreteceği/koruyacağı kanıt | Yapmayacağı yorum |
|---|---|---|
| SDK/App Adapter | Canonical observation, WAL/EmitOutcome bounded diagnostic, SDK interaction timestamp/target metadata varsa onu | Host'ta neden görünmediğini veya click'in kesin manuel olduğunu tahmin etmez |
| Accessibility Bridge | Action lifecycle, requestId, target, injected gesture monotonic interval, manual-touch contamination ve scoped capture | Domain business fact veya Final Oracle kararı üretmez |
| Cockpit durable runtime | Inbox/receipt/ordered stage, normalization/correlation/evaluation provenance | Absence'i kanıtsız SDK failure'a çeviremez |
| Domain Pack | Canonical evidence → normalized fact reducer/mapping'i | Runtime UI gesture uygulamaz ve SDK Core'a Nesy reducer gömmez |
| Cockpit Web | Persisted applicability/origin/Journey/repro read model'ini sunar | Component default'u, animasyon veya eksik artifact ile yeni gerçek icat etmez |

### Repro capture policy

```ts
type ReproCaptureMode =
  | "NORMAL_MINIMAL"
  | "ON_FAILURE_SCOPED"
  | "EXPLICIT_FULL_DIAGNOSTIC";

interface ReproCaptureManifest {
  mode: ReproCaptureMode;
  reason: string;
  scope?: "WINDOW" | "SUBTREE" | "FULL_EXPLICIT";
  captured: boolean;
  capturedAt?: string;
  artifactRefs: string[];
  redactionPolicy: string;
  retentionPolicy: string;
  unavailableReason?: string;
}
```

1. `NORMAL_MINIMAL` redacted command/response, requestId, target fingerprint,
   treeGen, action lifecycle, clock anchor, evidence refs ve mevcut küçük sonuçları
   taşır; her başarılı step için dump almaz.
2. `ON_FAILURE_SCOPED`, ambiguity/timeout/unknown dialog/unknown action effect/policy
   failure anında quota, cooldown, redaction, RBAC ve retention altında hedef window/
   subtree için dump ve gerekiyorsa screenshot yakalar.
3. `EXPLICIT_FULL_DIAGNOSTIC` yalnız yetkili kullanıcı/policy ile D2/D3 artifact
   kanalında çalışır; hot execution path'e veya her-step varsayılanına dönüşmez.
4. Repro manifest'i `captured=true/false`, capture mode, scope, timestamp, reason,
   artifact hash ve retention'ı yazar. Yakalanmamış historical dump için
   “reconstructed” veya tahmini artifact üretilmez.
5. Copy repro, exact command/response mevcutsa exact redacted payload'ı; yoksa
   `NOT_CAPTURED` işaretini taşır. UI eksik artifact'i sessizce atlayıp paket tam
   görünümü vermez.

### Drawer-first ürün uygulama sırası

Run Detail dönüşümü üç bağımlı increment'tir:

1. Persisted read model + Evidence Journey/detail drawer + exact repro export.
2. Aynı read model'den static applicable compact badge ve dört-layer detail özeti.
3. Reconnect/version/race testleri geçtikten sonra live subscription ve bağımsız
   state transition animasyonu.

Bu sıra UI'ın henüz authority/read model yokken dekoratif badge davranışını ürün
gerçeği haline getirmesini engeller.

## B.18 Proof Presentation Principle

Cockpit yalnız test sonucu veya log listesi gösteren bir arayüz değildir. Cockpit'in
ürün sorumluluğu, Verdict'in ürettiği hükmün hangi kanıt zincirinden çıktığını
operatöre, QA mühendisine, mobil geliştiriciye, release owner'a ve gerektiğinde
enterprise müşteri temsilcisine açıklanabilir şekilde göstermektir.

Bu ilke özellikle Run Detail, Campaign Matrix, Test Profile Detail, Evidence Journey
drawer, Release kanıt paketi ve failure repro yüzeyleri için bağlayıcıdır. Compact
ekranlar hızlı özet sunabilir; ancak verdict'in kanıt zincirine erişim kaybedilemez.

Her terminal verdict mümkün olduğunda şu soruları cevaplamalıdır:

1. Ne yapıldı?
2. Hangi workflow, step, iteration, occurrence ve entity üzerinde yapıldı?
3. UI'da ne gözlendi?
4. Uygulama içinde ne gözlendi?
5. Local state nasıl değişti?
6. Offline queue uygulanabilirse hangi state'te kaldı?
7. Remote business sonucu oluştu mu?
8. Hangi kanıt authoritative, hangisi confirmatory veya diagnostic idi?
9. Continue Gate hangi kanıtlarla ilerledi?
10. Final Oracle hangi requirement'tan hüküm üretti?
11. Sonuç tekrar üretilebilir mi?
12. Repro için hangi command/response/artifact gerçekten yakalandı?
13. Kanıt eksikse eksiklik hangi aşamada oluştu?
14. Hangi eksiklik `NOT_APPLICABLE`, hangisi `NOT_MEASURED`, hangisi `PENDING`,
    hangisi gerçek failure'dır?

Bu sorular bütün testlerde aynı genişlikte gösterilmek zorunda değildir. Örneğin
yalnız accessibility audit koşumunda Local veya Remote düzlemi uygulanmayabilir.
Fakat ekranda görünen PASS/FAIL sonucu, occurrence contract'ına göre uygulanabilir
olan kanıtların hangilerinden geldiğini kaybetmemelidir.

UI tasarım kararları:

- Run listesi hızlı özet verebilir; Run Detail evidence authority'yi göstermek zorundadır.
- Campaign Matrix cell'i gerçek run/evidence summary deep-link'i olmadan PASS gösteremez.
- Layer badge animasyonu chronology veya authority yerine geçemez.
- Raw log listesi kanıt zinciri değildir; kanıt normalized fact, source, correlation,
  freshness, authority ve Oracle requirement ile bağlanmalıdır.
- Eksik artifact sessizce atlanamaz; `NOT_CAPTURED`, `REDACTED`, `EXPIRED` veya
  `UNAVAILABLE` olarak açıklanır.
- UI yalnız “yeşil ekran” üzerinden business success iddiası kuramaz.
- Operator-friendly summary, canonical evidence modelinin yerine geçemez; yalnız onun
  açıklanabilir sunumudur.

Bu prensip, Cockpit'in sıradan dashboard'a veya log viewer'a dönüşmesini engeller.
Verdict'in ürün değeri “test koşuldu” bilgisinden değil, “bu sonuç şu kanıtlarla
ispatlandı veya şu kanıt eksik olduğu için ispatlanamadı” bilgisinden gelir.

## B.19 Feature Blueprint, Capability Contract ve Durable Run Plan

Bu bölüm Maçkolik Domain Pack genişlemesi için zorunlu, Nesy için de geçerli olan
ölçekleme modelidir. Amaç her özelliğe özel imperative test motoru yazmak değil;
domain-specific business bilgisini deklaratif Feature Blueprint içinde tutmak, tekrar
kullanılabilir component davranışlarını Capability Contract olarak tanımlamak ve
binlerce bağımsız test workflow'unu durable Run Plan ile güvenli çalıştırmaktır.

### Hiyerarşik kapsam modeli

Domain Pack testleri sıraya değil hiyerarşiye bağlar:

```text
Product
  └── Domain
      └── Feature
          └── Screen
              └── Component
                  └── Capability
                      └── Scenario
                          └── Independent Test Workflow
```

Maçkolik örneği:

```text
Maçkolik
├── Authentication
├── Match
├── News
├── AI
├── Monetization
└── Platform
```

Nesy örneği:

```text
Nesy Courier
├── Session
├── Tour
├── Stop
├── Parcel
├── Payment/Fiscal
├── Offline Queue
└── Device/Peripheral
```

Bu hiyerarşi Core'a business type eklemez. Core yalnız generic workflow, execution,
lease, evidence ve oracle contract'larını bilir.

### Package boundary kuralı

Bu katman üç ayrı contract sınırına bölünür:

```text
packages/domain-pack-contracts
├── FeatureAuthoringMetadata
├── FeatureExecutableContract
├── FeatureInvariant
├── ComponentDefinition
├── CapabilityContract
├── SemanticAction
├── MacroDefinition
├── DomainDependencyRef
└── DomainImpactRef
```

```text
packages/execution-contract
├── RunManifest
├── TestExecution
├── ExecutionLifecycle
├── ProductVerdict
├── EvaluationFailureClass
├── SchedulerDisposition
├── TerminationReason
├── WorkflowCleanupResult
├── ResourceReleaseResult
├── OperationalDisposition
├── Lease
├── ResourceRequirement
├── ResourceLease
└── SchedulerPolicy
```

```text
packages/impact-contract
├── ImpactGraph
├── ChangeReference
├── CoverageReference
└── SelectionReason
```

`packages/domain-pack-contracts`, bütün platform tiplerinin atıldığı bir `common`
paketi değildir. Domain Pack authoring ve executable domain contract'ları burada
kalır; worker lease, execution queue, scheduler disposition ve resource allocation
execution plane'e aittir. Domain Pack yalnız ihtiyaçlarını `ResourceRequirementRef`,
`DependencyRef` ve `ImpactRef` olarak beyan eder.

### Capability Contract

Capability Contract, birçok feature ve hatta birçok application domain içinde tekrar
kullanılabilen component davranışı sözleşmesidir. Örnekler:

```text
verdict.capabilities.core
├── HorizontalCarousel
├── PaginatedFeed
├── DeepLinkNavigation
├── RetryableContent
└── LiveUpdatingList

nesy.capabilities
├── OfflineQueueAction
├── ScannerInput
├── PaymentConfirmation
└── FiscalConfirmation

mackolik.capabilities
├── SingleChoiceReaction
├── AsyncConversation
├── SubscriptionGate
├── AdSlot
└── BettingWebView
```

İlk günden bütün müşteri capability'leri core/shared sayılmaz. Bir capability ancak
iki veya daha fazla domain'de aynı generic semantics ve aynı evidence sınırıyla
kanıtlandığında core/shared kataloğa terfi eder. Aksi halde domain capability olarak
kalır.

Örnek contract:

```ts
interface CapabilityContract {
  key: string;
  version: number;
  componentKind: string;

  inputs: Record<string, unknown>;
  supportedSurfaces: string[];
  genericScenarios: string[];
  defaultEvidencePolicy: EvidencePolicy;
  performanceBudgetRef?: string;

  requiredTargets: string[];
  requiredEvidenceSources: string[];
  failureModes: string[];

  generatedWorkflowTemplates: string[];
}
```

`HorizontalCarousel` bir kere tanımlanır; Transfer Gündemi, Öne Çıkan Haberler,
Popüler Ligler, Maç Önerileri veya Video Haberler aynı capability contract'ı farklı
Feature Blueprint içinde kullanabilir. Capability component'in genel davranışını
bilir; feature business invariant'ını uydurmaz.

### Feature Blueprint

Feature Blueprint, ürün/domain owner tarafından onaylanan business contract'tır.
Component/capability bilgisini, fixtures, invariants, workflows ve dependencies ile
birleştirir. Blueprint iki parçaya ayrılır:

- `FeatureAuthoringMetadata`: owner, açıklama, risk, labels, roadmap ve dokümantasyon
  gibi authoring/ürün bilgileri.
- `FeatureExecutableContract`: execution planını etkileyen business invariants,
  capability refs, workflow refs, fixture refs, evidence policy, target bindings ve
  Oracle template refs.

Run manifest yalnız executable contract digest'ini plan hash'e bağlar. Authoring
metadata snapshot olarak saklanabilir; owner veya açıklama değişikliği execution plan
hash'ini değiştirmez.

```ts
interface FeatureAuthoringMetadata {
  id: string;
  product: string;
  domain: string;
  owner: string;
  risk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  description?: string;
  labels?: string[];
  documentationRefs?: string[];
}

interface FeatureExecutableContract {
  id: string;
  executableVersion: number;
  entryPoints: string[];
  fixtures: string[];
  screens: string[];

  components: Array<{
    key: string;
    capabilityRef: string;
    targetRef: string;
    entityType?: string;
  }>;

  invariants: Array<{
    id: string;
    description: string;
    authority: "PRODUCT_APPROVED" | "TECHNICAL_DEFAULT" | "AI_SUGGESTED";
    oracleTemplateRef: string;
  }>;

  workflows: string[];
  dependencies: DependencyRef[];
  impactRefs: ImpactRef[];
}

interface FeatureBlueprint {
  metadata: FeatureAuthoringMetadata;
  executable: FeatureExecutableContract;
}
```

Maçkolik Transfer Gündemi örneği:

```yaml
metadata:
  id: transfer-agenda
  product: mackolik
  domain: news
  owner: news-team
  risk: HIGH
  description: Transfer agenda card and reaction behavior.

executable:
  id: transfer-agenda
  executableVersion: 1

  entryPoints:
    - home.transferAgenda
    - deeplink://transfer-agenda

  fixtures:
    - authenticated_user
    - unreacted_transfer_cards

  screens:
    - transfer-agenda-widget
    - transfer-detail

  components:
    - key: transfer-carousel
      capabilityRef: verdict.capabilities.core.horizontal-carousel
      targetRef: mackolik.target.transfer-agenda-carousel
      entityType: TRANSFER
    - key: transfer-reaction
      capabilityRef: mackolik.capabilities.single-choice-reaction
      targetRef: mackolik.target.transfer-card-reaction
      entityType: TRANSFER

  invariants:
    - id: only-one-reaction
      authority: PRODUCT_APPROVED
      description: A user can react only once to a transfer card.
      oracleTemplateRef: mackolik.oracle.single-reaction-v1
    - id: persist-reaction
      authority: PRODUCT_APPROVED
      description: Reaction survives process restart.
      oracleTemplateRef: mackolik.oracle.reaction-persistence-v1

  workflows:
    - transfer-agenda-smoke
    - like-transfer
    - dislike-transfer
    - duplicate-reaction
    - process-recreation
    - offline-reaction

  dependencies: []

  impactRefs:
    - mackolik.impact.transfer-agenda-card
    - mackolik.api.transfer-reactions
```

Authoring UI düz YAML shorthand kabul edebilir; ancak publish compiler bu shorthand'i
tek canonical nested `FeatureBlueprint { metadata, executable }` formuna normalize
eder ve executable digest'i yalnız `executable` ağacından üretir. İki serializer veya
iki canonical format yoktur.

AI-generated blueprint veya invariant `AI_SUGGESTED` olarak kalır. Product/domain owner
onayı olmadan `PRODUCT_APPROVED` authority kazanamaz ve release gate Oracle'ına
bağlanamaz.

### Independent Test Workflow ve Reusable Flow Fragment ayrımı

Reusable Flow Fragment:

```text
LoginWithTestUser
OpenMatchDetail
DismissConsentPopup
WaitForHomeReady
ResetApplication
```

Bu fragment'lar setup veya navigation sağlar; tek başına feature verdict'i üretmez.

Independent Test Workflow:

```text
TransferCardCanBeLikedOnce
AIResponseAppearsWithinTimeout
BettingTabLoadsWithoutWebViewError
NewsDetailSurvivesProcessRecreation
CompleteDeliveryPersistsLocalAndRemote
QueueFlushSurvivesProcessKill
```

Bu workflow'lar kendi occurrence, evidence, Continue Gate, Final Oracle ve terminal
verdict'ine sahiptir.

### Run Manifest ve Execution Queue

Suite veya campaign başladığında immutable Run Manifest üretilir:

```ts
interface RunManifest {
  campaignId: string;
  manifestId: string;
  application: string;
  buildRef: string;
  environment: string;
  suiteRef: string;
  manifestHash: string;

  testCount: number;
  deviceMatrix: string[];

  workflowVersions: Record<string, number>;
  domainPackDigest: string;
  capabilityCatalogDigest: string;
  featureExecutableContractDigest: string;

  appAdapterDigest: string;
  launchProfileVersion: string;
  testProfileVersion: string;
  datasetVersion: string;
  fixtureVersion: string;
  faultPlanVersion?: string;
  oracleTemplateDigest: string;
  evidenceSourceRegistryDigest: string;
  performanceBudgetVersion: string;
  remoteEnvironmentSnapshotRef: string;
  deviceCapabilitySnapshotRef: string;
  resourcePlanDigest: string;
  compilerVersion: string;
  workflowIrSchemaVersion: string;
  bridgeProtocolVersion: string;
  sdkProtocolVersion: string;
}

type ExecutionLifecycle =
  | "PENDING"
  | "READY"
  | "LEASED"
  | "RUNNING"
  | "TERMINAL";

type ProductVerdict =
  | "NOT_EVALUATED"
  | "PASS_ONLINE"
  | "PASS_QUEUED_OFFLINE"
  | "FAIL_PRODUCT"
  | "INCONCLUSIVE";

type EvaluationFailureClass =
  | "NONE"
  | "AUTOMATION_FAILURE"
  | "ENVIRONMENT_FAILURE"
  | "EVIDENCE_INSUFFICIENT";

type SchedulerDisposition =
  | "COMPLETED"
  | "RETRYABLE"
  | "BLOCKED"
  | "SKIPPED"
  | "CANCELLED"
  | "ORPHANED"
  | "RECONCILIATION_REQUIRED";

type TerminationReason =
  | "NORMAL"
  | "ASSERTION_FAILED"
  | "WORKER_LOST"
  | "DEVICE_LOST"
  | "RESOURCE_UNAVAILABLE"
  | "DEPENDENCY_FAILED"
  | "OPERATOR_CANCELLED"
  | "TIMEOUT"
  | "UNKNOWN_EFFECT";

type ResourceReleaseResult =
  | "NOT_REQUIRED"
  | "CLEAN"
  | "FAILED"
  | "QUARANTINED"
  | "MANUAL_RELEASE_REQUIRED";

interface TestExecution {
  testExecutionId: string;
  campaignId: string;
  manifestId: string;
  workflowRunId?: string;
  workflowRef: string;
  featureRef?: string;
  capabilityRefs: string[];
  lifecycle: ExecutionLifecycle;
  productVerdict: ProductVerdict;
  evaluationFailureClass: EvaluationFailureClass;
  schedulerDisposition?: SchedulerDisposition;
  terminationReason?: TerminationReason;
  resourceReleaseResult?: ResourceReleaseResult;
  operationalDisposition: OperationalDisposition;

  priority: number;
  dependencies: string[];
  requiredResources: ResourceRequirement[];
  lease?: {
    workerId: string;
    leasedAt: string;
    expiresAt: string;
  };
}
```

ID'ler birbirine karıştırılmaz:

```text
campaignId
manifestId
testExecutionId
workflowRunId
occurrenceId
```

Worker ölürse otomatik sonuç tek değildir:

```text
LEASE_EXPIRED
  → fiziksel etki başlamadıysa schedulerDisposition=RETRYABLE

UNKNOWN_EFFECT
  → fiziksel action dispatch edildi fakat terminal cevap kaybolduysa
     schedulerDisposition=RECONCILIATION_REQUIRED

ORPHANED
  → parent campaign/run ile bağı kopmuş veya sahipliği belirsiz execution/artifact
```

Payment, fiscal, delivery completion veya remote mutation gibi non-idempotent
aksiyonlarda `ORPHANED → READY` otomatik geçişi yasaktır. Önce Local/Remote
reconciliation yapılır; sonuç kesinleşmeden retry veya resource release yapılmaz.
Bu modelde 1200. testte kopma bütün suite'i baştan başlatmaz, fakat bilinmeyen fiziksel
etki de sessizce tekrar edilmez.

### Test Data Broker ve izolasyon seviyeleri

Test Data Broker account, app data, backend fixture, remote config, payment/fiscal
fixture, ad state, premium/subscription user ve benzeri paylaşımlı kaynakları lease
eder.

```ts
type IsolationLevel = "L0" | "L1" | "L2" | "L3" | "L4" | "L5";

interface ResourceRequirement {
  type:
    | "ACCOUNT"
    | "APP_DATA"
    | "BACKEND_FIXTURE"
    | "REMOTE_CONFIG"
    | "DEVICE"
    | "PERIPHERAL"
    | "PAYMENT_FIXTURE"
    | "AD_STATE";
  mode: "SHARED_READONLY" | "EXCLUSIVE" | "EPHEMERAL";
  isolationLevel: IsolationLevel;
  cleanupPolicy:
    | "NONE"
    | "APP_RESET"
    | "BACKEND_RESET"
    | "DESTROY"
    | "RECONCILE_BEFORE_RELEASE"
    | "MANUAL_RELEASE";
}

type ResourceState =
  | "CLEAN"
  | "DIRTY"
  | "QUARANTINED"
  | "RECONCILIATION_REQUIRED"
  | "MANUAL_RELEASE_REQUIRED";

interface ResourceLease {
  leaseId: string;
  resourceRef: string;
  ownerTestExecutionId: string;
  state: ResourceState;
  acquiredAt: string;
  expiresAt?: string;
  releasePolicy: ResourceRequirement["cleanupPolicy"];
  reconciliationRef?: string;
}
```

İzolasyon seviyeleri:

| Seviye | Anlam |
|---|---|
| L0 | Aynı uygulama state'iyle devam edebilir |
| L1 | Activity/navigation reset gerekir |
| L2 | App data clear + restart gerekir |
| L3 | Ayrı test hesabı gerekir |
| L4 | Backend fixture reset gerekir |
| L5 | Tam izole backend/environment gerekir |

Run Planner uyumlu kaynak kullanan testleri paralel çalıştırır; çakışan kaynak
kullananları otomatik sıralar. Aynı user ile iki reaction mutation veya aynı courier
route üzerinde iki delivery mutation paralel çalıştırılamaz.

Test Data Broker yalnız reset servisi değildir. Bazı kaynaklarda reset veya destroy
mümkün değildir:

- payment/fiscal transaction
- üçüncü taraf POS/peripheral sonucu
- reklam frekans state'i
- tüketilmiş tek kullanımlık reaction
- remote mutation sonucu bilinmeyen backend fixture

Örneğin payment request dispatch edildikten sonra worker ölürse hesap veya fixture
havuza dönmez. Resource state `RECONCILIATION_REQUIRED` veya `QUARANTINED` olur.
Remote validator/local named query sonucu kesinleştirene kadar aynı kaynak yeni teste
verilmez.

### Dependency Graph ve BLOCKED semantiği

Dependency graph test sonuçlarını zincirleme sahte failure'a çevirmek için değil,
precondition ve fixture hazırlığını açık yönetmek için kullanılır.

```text
AppInstalled
  → ConsentHandled
  → AuthenticatedSession
  → TransferAgendaOpened
  → ReactionExecuted
  → ReactionPersisted
```

`AuthenticatedSession` kurulamazsa login'e bağımlı testler `BLOCKED` olur; public
testler çalışabilir. `BLOCKED`, product failure ile aynı değildir. Run Detail ve
Campaign Matrix bu farkı ayrı gösterir.

### Impact Graph

Her workflow ve Feature Blueprint şu ilişkilere bağlanabilir:

```text
Feature
Screen
Component
Capability
API
Module
Repository Path
Analytics Event
Remote Config
Evidence Source
```

PR veya build değişikliği geldiğinde Run Planner doğrudan ve dolaylı etkileri seçer:

```text
PR Gate: 30–200 test
Feature Regression: 100–500 test
Release Gate: 1000–3000 test
Nightly Full Matrix: 3000+ test × cihaz
Weekly Resilience: chaos/performance/device matrix
```

Bu selection ikinci engine değildir; aynı Test Profile/Campaign runtime'ına hangi
execution'ların ekleneceğini belirleyen planlama katmanıdır.

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

## C.5 Maestro fallback veya devre dışı kalıntı olmayacak

Bridge preflight, compiler veya executor hatasında run Maestro'ya düşmez. Açık
hata kodu üretir. Maestro yalnız ölçümlü geçiş boyunca, silme kararını üretmek
için izole dual-run harness'ında geçici olarak yaşar. Checkpoint 8 sonrasında bu
harness da dahil bütün yapı Checkpoint 9'da projeden sökülür. Disabled kod,
feature flag, “ileride lazım olur” dependency'si veya gizli CLI yolu bırakılmaz.

## C.6 Kalıcı YAML execution artifact'i olmayacak

YAML preview, download ve local fallback geçiş sonunda silinir. Kalıcı execution
artifact'i versioned `BridgeFlowPlan` JSON'dur.

## C.7 Hot path'te full dump olmayacak

Tek node aramak için match/find, dialog için subtree, sınırlı keşif için depth
kullanılır. Full yalnız Inspector veya bilinmeyen hata artifact'i için bilinçli
ve ölçülü çalışır. Bridge'in bugün sürekli full dump stream etmediği mevcut durum
olarak kaydedilir; yeni UI wait runtime hiçbir zaman bu davranışı dolaylı olarak
oluşturmaz. Full dump küçük `wait_any` response'unun WS/TCP payload'ına gömülmez;
artifact kanalına yazılır.

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

## C.18 Eski run verisi engine-neutral taşınacak; özel renderer bırakılmayacak

Önce doğrulanmış export/migration ile korunması gereken tarihsel özet, log ve
artifact generic alanlara taşınır. Sonra engine-specific kolonlar, DTO'lar,
enum değerleri, UI bileşenleri ve renderer silinir. Eski run gerekiyorsa yalnız
engine-neutral “legacy external execution” görünümünde açılır; proje içinde
Maestro'ya özel kod yolu kalmaz.

## C.19 General product-shell işi kritik runtime yoluna karıştırılmayacak

Home, PM, Settings ve statik içerik borçları ayrıca izlenir. Bunlar SDK/Bridge
güvenlik ve correctness kapılarını geciktirecek şekilde aynı faza konmaz.

## C.20 SDK bütün business veya Room değişikliklerini otomatik üretmiş sayılmayacak

SDK otomatik teknik telemetri sağlayabilir:

- Screen lifecycle.
- Interaction metadata.
- Network metadata ve süre/byte bilgileri.
- Crash ve ANR riski.
- Memory pressure.
- Span/run context.

Uygulamaya özgü business doğruluğu ise açık contract gerektirir:

- Typed business event.
- App-registered state provider.
- Önceden kayıtlı ve allowlist'li named query.
- Business correlation ID.
- Host tarafına kopyalanan DB'nin doğrulanması.

Compiler, zorunlu app/local evidence için gerekli event/provider/query capability
yoksa planı fail-fast reddeder. Cockpit, SDK bütün Room write'larını otomatik
dinliyormuş gibi event beklemez.

## C.21 AI runtime hükmü vermez

- AI/LLM raw log'dan pass/fail üretemez.
- BridgeFlow execution veya retry kararı LLM'e bağlanamaz.
- Oracle sonucu LLM tarafından değiştirilemez.
- AI Design Audit çıktısı doğrudan çalıştırılmaz; typed deterministic rule'a
  çevrilir ve insan onayı alır.
- Post-run LLM yalnız deterministic evidence'i açıklayan opsiyonel katmandır.
- AI servisi unavailable olduğunda run sonucu ve checkpoint etkilenmez.
- Hassas artifact açık policy/approval olmadan model girdisine eklenmez.

## C.22 Sabit koordinat kalıcı workflow hedefi olmayacak

Koordinat yalnız fresh semantic node bounds'undan çalışma anında türetilen safe
point olabilir. Editor'a kalıcı `x/y` test hedefi kaydedilmez. Orientation,
resolution veya inset değişiminde eski koordinat yeniden kullanılmaz.

## C.23 `rowIndex` business kimliği olmayacak

Collection satırı mümkünse shipment/stop/barcode gibi stable `rowKey` ile
çözülür. `rowIndexHint` yalnız aynı fingerprint için son ambiguity ipucudur;
liste sırası değişince başka entity'ye kör tap yapılamaz.

## C.24 Domain Pack, WorkflowIR v2'den önce yapılmayacak

Domain Pack'i mevcut sınırlı `macro/runtime-condition` IR'ına göre tasarlamak yasaktır.
Önce shared WorkflowIR v2 ve Condition Engine kabul kapısı geçer; sonra Domain Pack
contract'ı ve Nesy pack implementasyonu başlar. Geçici Nesy-specific IR type'ı
eklenmez. CP4A sırasında yalnız `courier` ve başka bir örnek domain için generic IR
acceptance fixture'ı yazılabilir; manifest/registry/reducer/runtime içeren production
Domain Pack implementasyonu başlatılamaz.

## C.25 Raw evidence reducer nedeniyle kaybedilmeyecek

Raw platform callback'in tamamının taşınması zorunlu değildir; policy ile canonical
technical evidence'e dönüştürülür. Canonical event sequence, correlation metadata,
coalescing/drop marker'ı ve redaction durumu retention policy içinde korunur. Host
Domain Pack reducer normalized fact üretebilir; Verdict Core'a Nesy-specific reducer
gömülmez.

## C.26 Koşulsuz fixed wait olmayacak

Timeout/deadline vardır; `sleep`, sabit 15 saniye veya hiçbir zaman eşleşmeyecek
selector üzerinden bekleme yoktur. Her wait görünür bir UI/App/Local/Remote
condition'a, cancellation'a ve timeout error taxonomy'sine bağlıdır.

## C.27 Bridge business domain bilmeyecek

Bridge “route dialog”, “stop”, “parcel” veya “delivery complete” kavramlarını
yorumlamaz. Domain Pack bu anlamları generic TargetFingerprint, selector, action ve
`UiWaitPlan`'a çevirir.

## C.28 Automation-only adapter yüzeyi release'e sızmayacak

Scanner injection, fixture/session preparation ve `DIRECT_STATE` launch profile
yalnız automation build'de bulunur. Release classpath/resource/manifest/command
surface isolation testi zorunludur.

## C.29 WebSocket Bridge için zorunlu transport değildir

`UiWaitPlan` host içinde transport-neutral'dır. İlk B2 wire contract'ı mevcut
localhost TCP/NDJSON üzerinde correlated `wait_any + cancel_request` olarak kalır;
sırf bekleme gereksinimi nedeniyle ikinci bir kontrolsüz WebSocket veya unsolicited
push katmanı kurulmaz.

## C.30 ASM/presenter instrumentation ilk çözüm olmayacak

Önce explicit adapter hook, Fragment lifecycle, named query, storage observer ve
network observer kullanılır. ASM yalnız ölçülmüş bir visibility boşluğu kalırsa,
version/obfuscation/device testleri ve açık güvenlik kararıyla değerlendirilir.

## C.31 Queue veya App State yeni evidence plane olmayacak

Ana dört plane `UI/APP/LOCAL/REMOTE` olarak kalır. Offline queue; database,
SharedPreferences ve file/cache gibi Local source/evidence subtype'ıdır. App state
provider ise SDK event/derived business signal gibi App source'udur. UI'da beşinci
`QUEUE` veya ayrı `APP_STATE` rozeti üretilmez.

## C.32 HTTP 2xx doğrudan domain fact üretmeyecek

Network observer en fazla transport/operation fact'i üretir. `ROUTES_AVAILABLE`,
`DELIVERY_CONFIRMED` veya benzeri business fact; Evidence Source Registry'deki
normalization, projection, correlation ve gerekiyorsa confirmatory source kuralı
sağlanmadan emit edilmez. Endpoint adı workflow'a yazılmaz.

## C.33 Evidence source seçimi kör global sıra olmayacak

“UI her zaman önce” veya “explicit event her zaman son” gibi fact'ten bağımsız mutlak
bir sıra uygulanmaz. Her fact primary/confirmatory/fallback authority'sini taşır.
Explicit app business event varsayılan olarak son seçenektir; başka source ile
güvenilir biçimde gözlenemeyen kritik/private transition için gerekçeli primary
olabilir.

## C.34 İlk B2'de persistent Watch Registry olmayacak

`register_watch`, `unregister_watch`, reconnect restore ve unsolicited `WATCH_*`
event bus ilk B2 kapsamına girmez. `UiWaitPlan`, tek bounded `wait_any` request'ine
compile edilir. Kalıcı/global watch ancak gerçek cihaz telemetrisi ve eşzamanlı watch
ihtiyacıyla sonraki protocol major capability'si olarak kabul edilebilir.

## C.35 Full-tree polling ile `wait_any` uygulanmayacak

Bridge Accessibility event'leriyle changed window/subtree index'ini günceller ve
ilgili predicate'leri yeniden değerlendirir. Periyodik 500 ms full dump yasaktır.
İlk scoped evaluation ve event gelmemesine karşı bounded/adaptive scoped safety
rescan kullanılabilir; her kullanım reason, rate/CPU budget ve metric üretir.

## C.36 SDK/Bridge için sekizinci workspace açılmayacak

Yeni Domain Pack/Registry authoring Automation altında, canlı cihaz observation ve
action Debug View altında bulunur. Aynı capability için paralel top-level workspace
ve duplicate page state'i oluşturulmaz.

## C.37 Sayfa sessiz legacy data-source fallback yapmayacak

Target `PageDataSourceContract` unavailable olduğunda page stale mock, ADB/logcat,
eski özel orchestrator veya Maestro lane'ine sessizce düşmez. Yalnız açıkça izinli
`READ_ONLY_LEGACY_SUMMARY` eski run okuma yolu istisnadır; mutation/replay yapamaz.

## C.38 Component render olması page DONE sayılmayacak

Navigation/direct-link, target data source, auth/RBAC, availability, loading/empty/
error, observability, redaction ve page acceptance geçmeden route tamamlanmış değildir.
Placeholder shell ile çalışan ürün sayfası aynı raporlanmaz.

## C.39 Published Domain Pack yerinde değiştirilmeyecek

Published pack version immutable'dır. UI düzenlemesi yeni draft/version üretir;
optimistic concurrency, migration, validation, review/publish ve audit olmadan
runtime mapping değişmez.

## C.40 Continue Gate ordered gap arkasında koşulsuz bekletilmeyecek

Commit edilmiş ve registry'de `RECEIPT_SAFE` ilan edilmiş bağımsız fact,
`DurableReceiptBus` üzerinden Continue Gate'i uyandırabilir. Buna karşılık Final
Oracle, deterministic reducer, audit ve sıra bağımlı fact `OrderedEvidenceBus`
authority'sini atlayamaz.

## C.41 Cleanup sonucu business verdict'i ezmeyecek

Lifecycle, verdict, termination, cleanup ve operational disposition ayrı persist
edilir. Cleanup failure, geçmiş business PASS'i FAIL'e çeviremez; run'ı
`NEEDS_ATTENTION` yapar ve cleanup sonucu ayrıca gösterilir.

## C.42 Aynı cihazda paralel mutation yapılmayacak

Automated run, Inspector veya başka tool fark etmeksizin cihaz başına tek mutation
lane vardır. Observation/wait concurrency bounded'dır; aktif run sırasında external
Inspector Act açık takeover olmadan reddedilir.

## C.43 Safety rescan full-tree polling'e dönüşmeyecek

İlk scoped evaluation ve adaptive scoped safety rescan wait liveness içindir. Sabit
aralıkla full accessibility dump almak, safety scan adı altında da olsa yasaktır.

## C.44 Final Oracle paralel rol/zaman listeleri kullanmayacak

Bir fact'in zorunluluğu ve timing'i tek `OracleRequirement` içinde tanımlanır.
`required[]` ile `eventual[]` gibi kesişebilen string listeleri yeni WorkflowIR v2
şemasında kalıcı contract değildir.

## C.45 Derived fact graph cycle veya hot-reload drift kabul etmeyecek

Derived dependency graph DAG olmak zorundadır. Run başlangıcında pack/graph/reducer
digest'i pinlenir; aktif run published pack reload'u veya yeni reducer sürümüyle
sessizce davranış değiştiremez.

## C.46 Runtime arbitrary Domain Pack TypeScript çalıştırmayacak

V1 runtime yalnız CI/publish hattında doğrulanmış, deterministic, immutable ve hash
pinli bundle yükler. Third-party code execution, imza/sandbox/capability güvenlik
programı olmadan kapsam dışıdır.

## C.47 Ölçülmemiş performans örnekleri release eşiği olmayacak

Mutlak doğruluk invariants dışında latency/CPU/heap/workflow-duration eşikleri CP0
baseline ve fiziksel cihaz profili görülmeden dondurulmaz. Örnek sayı master kararı
veya CP8 geçiş gerekçesi sayılamaz.

## C.48 Event yokluğu doğrudan SDK failure sayılmayacak

Host'ta evidence görülmemesi; emit'in hiç çağrılmaması, caller'ın `EmitOutcome`'u
raporlamaması, WAL acceptance, transport/auth, inbox commit, receipt/ordered
processing, normalization, correlation veya evaluation aşamalarından herhangi biri
olabilir. B.16 Evidence Journey kanıtı olmadan belirli stage/root cause atanmaz;
`NOT_OBSERVED` ve `UNKNOWN`, `FAILED` ile eşitlenmez.

## C.49 Her `EmitOutcome` yeni durable event olarak yayınlanmayacak

Diagnostic event kendi emit sonucunu tekrar event'e çevirerek recursion, WAL basıncı
ve event fırtınası üretemez. Gereken visibility bounded counter/last outcome,
on-demand SDK diagnostic state/query veya explicit caller report ile sağlanır.

## C.50 Badge animasyonu chronology veya authority olmayacak

UI/App/Local/Remote rozetleri sabit sırayla animasyonla tamamlanmış gösterilmez.
Runtime authority compiled occurrence applicability snapshot ve persisted evidence
revision'ıdır; chronology calibrated waterfall/Evidence Journey'de gösterilir.

## C.51 Workflow web registry runtime applicability SSOT'u olmayacak

Web tarafındaki workflow registry/default listeleri authoring kolaylığıdır. Pack,
WorkflowIR v2, compiled plan ve occurrence snapshot'ıyla çelişirse runtime ve geçmiş
run sunumu occurrence snapshot'ını kullanır; component içi varsayım yeni layer veya
obligation icat edemez.

## C.52 Korelasyonsuz SDK click manuel etkileşim sayılmayacak

Bridge action lifecycle ile kanıtlanan etkileşim `BRIDGE_INJECTED`; güvenilir fiziksel
contamination observation'ı `MANUAL`; ayrıştırılamayan kayıt `UNKNOWN` olur. Human
interaction metriği automation injection ve unknown trafiğini ayrı tutar.

## C.53 Her step için full dump alınmayacak ve geçmiş dump uydurulmayacak

Normal happy path minimal correlated response/evidence kullanır. Dump/screenshot
failure-triggered scoped policy veya explicit yetkili diagnostic ile yakalanır.
Yakalanmamış historical tree sonradan exact repro artifact'i gibi üretilemez.

## C.54 Test Profile yeni execution engine olmayacak

Smoke, Regression, Recovery, Bad Day, Load, Soak, Compatibility ve Security için ayrı
runner, ayrı queue, ayrı Oracle veya ayrı Bridge command path'i açılmaz. Test Profile
yalnız versioned Domain Pack contract'ı içinde workflow, launch profile, dataset,
fault, repeat, device matrix, telemetry ve schedule policy tanımlar. Runtime aynı
WorkflowIR v2, BridgeFlowCompiler, BridgeFlowExecutor, Evidence Journey ve Final Oracle
omurgasını kullanır. “Profile PASS” gerçek run/occurrence evidence'ına ve campaign
cell sonuçlarına deep-link vermeden üretilemez.

## C.55 Preview explorer veya accessibility audit release hükmü vermez

`BASIC_ACCESSIBILITY_PREVIEW` ve `SMART_EXPLORER_PREVIEW` v1 core release gate değildir.
Bu profiller crash/ANR, labelsız node veya unexpected surface gibi sinyal üretebilir;
ancak kendi başına business verdict'i, Final Oracle sonucunu veya release GO/NO_GO
kararını overwrite edemez. Tam persona monkey, RL explorer, self-learning Oracle,
full visual accessibility/design audit ve otomatik breaking-point keşfi v1 kapsamına
sessizce alınamaz.

## C.56 Core veya Bridge business semantic command bilmeyecek

`OPEN_STOP`, `COURIER_LOGIN`, `SELECT_ROUTE`, `PROCESS_PARCEL`, `COMPLETE_DELIVERY`,
`STOP`, `PARCEL`, `DELIVERY`, `MATCH` veya `BETTING` gibi domain kavramları Verdict
Core shared contract'ına, Bridge protocol'üne veya generic executor branch'lerine
eklenemez. Bu kavramlar Domain Pack semantic macro/action, App Adapter capability,
workflow authoring ve Test Profile katmanında kalır.

Bridge'e `{"command":"OPEN_STOP","stopId":"42"}` gibi business command gitmez.
Bridge yalnız scoped, correlated ve generic UI primitive'leri çalıştırır:
`find/resolve`, `scroll_to_target`, `activate`, `input`, `wait_any`, `screenshot`
ve bounded capture. Domain Pack bu primitive'lere derlenecek planı üretir; Bridge
business anlamı yorumlamaz.

Faz 4B'de `NESY_COURIER_DOMAIN_PACK_REFERENCE_V1` olmadan semantic node implementasyonu
DONE sayılamaz. Macro'nun palette'te görünmesi yeterli değildir; Generic IR snapshot,
BridgeFlowPlan snapshot, Continue Gate, Final Oracle ve source-map kanıtı gerekir.

## C.57 Büyük suite tek sıralı test listesi olmayacak

Maçkolik veya Nesy gibi büyük domain'lerde 1000–5000 test, tek uzun workflow veya
tek sıralı imperative test listesi olarak çalıştırılamaz. Suite/campaign immutable
Run Manifest üretir; her Independent Test Workflow ayrı `TestExecution` state'i,
lease'i, dependency'leri, resource gereksinimleri ve terminal verdict'iyle yönetilir.

Worker ölümü, 1200. testte process crash veya cihaz kopması bütün suite'i baştan
başlatmaz. Lease timeout sonrası ilgili execution `RETRYABLE/READY` olur; terminal
state'e ulaşmış işler tekrar çalıştırılmaz.

Reusable Flow Fragment'lar test verdict'i yerine geçmez. Örneğin login fixture'ı
kurulamazsa:

```text
Login testi FAILED
Login'e bağımlı testler BLOCKED
Login gerektirmeyen testler READY/RUNNING olabilir
```

Bu ayrım yapılmadan “login bozuk, 3000 test failed” gibi zincirleme sahte failure
raporu üretilemez.

## C.58 Paylaşımlı test kaynağı izolasyonsuz paralel mutation yapmayacak

Run Planner, Test Data Broker'dan resource lease almadan mutation yapan workflow
başlatamaz. Aynı account, backend fixture, payment/fiscal fixture, ad state, courier
route, transfer card reaction veya subscription state üzerinde iki conflict eden test
paralel koşamaz.

`L0–L5` isolation seviyesi compile/runtime planında görünür olmalıdır. Test authoring
“hepsini paralel çalıştır” diyemez; sistem uyumlu kaynakları paralelleştirir, çakışan
kaynakları sıraya alır veya açık `BLOCKED_RESOURCE` üretir.

## C.59 AI business invariant'ı onaysız authoritative yapmayacak

AI ekran keşfi, component/capability önerisi, Feature Blueprint taslağı ve eksik
business invariant soruları üretebilir. Ancak `only-one-reaction`, `payment duplicate
yasak`, `queue flush sonrası remote/local consistency` gibi business invariant'lar
domain/product owner onayı olmadan `PRODUCT_APPROVED` authority kazanamaz ve release
gate Final Oracle requirement'ına bağlanamaz.

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

1. Commit sonrası iki ayrı durable delivery lane kurmak:
   `DurableReceiptBus` ve `OrderedEvidenceBus`.
2. Receipt bus'ı immutable inbox row identity/cursor'ına bağlamak; yalnız in-memory
   publish kullanmamak.
3. Commit→post-commit nudge crash penceresi için restart/resume scan'i.
4. Ordered consumer callback'ini `OrderedEvidenceBus`'a bağlamak.
5. Stream lease/advisory lock davranışını doğrulamak.
6. Receipt ve ordered lane için ayrı burst nudge coalescing.
7. `receipt_dispatched_at`, `processed_at`, attempt, last error ve retry schedule.
8. Poison row ve dead-letter görünürlüğü; receipt-safe lane'in bağımsız ilerlemesi.
9. Ordered consumer lag/oldest-unprocessed ve receipt dispatch latency metriği.
10. `DurableReceiptBus.subscribe(run/session/filter/cursor)` ve
    `OrderedEvidenceBus.subscribe(run/session/filter/cursor)` API'leri.
11. `waitEvent` filter'ında `RECEIPT_SAFE/ORDERED_REQUIRED` lane enforcement.
12. Continue Gate receipt-safe subscriber'ları; Final Oracle, audit, replay ve
    diagnostics ordered subscriber'ları.
13. `waitEvent` timeout/cancel/recovery.
14. Process restart bootstrap scan.
15. Late event ve closed run politikası.
16. Gap sırasında her iki lane'in açıkça farklı subscriber davranışı.
17. Receipt duplicate/replay idempotency ve inbox cursor checkpoint'i.
18. Sync-vs-durable comparison mode.
19. Eşitlik gate'i sonrası sync sink kaldırma.
20. DB unavailable olduğunda açık NO_GO; ACK veya receipt publish yok.
21. WAL release, ACK, receipt ve ordered-processing evidence UI verisi.

### Not

Working tree'de durable row'u aynı sink seam'ine veren consumer geliştirmesi
başlamıştır. Bu plan o işi kabul edilmiş saymaz; restart, poison row, subscriber,
auth, dual-lane separation ve sync-cutover kriterleri tamamlanmalıdır.

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
13. Versioned `TargetFingerprint` ve resolution evidence şeması.
14. Stable `rowKey` + optional `rowIndexHint` semantiği.
15. Action lifecycle transition ve terminal-state şeması.
16. `dispatchGesture` / allowlisted `performAction` method evidence'i.
17. `UiWaitPlan`, `UiWaitTarget`, `UiInterruptTarget` ve `UiPredicate` şemaları.
18. `wait_any` request ile `EXPECTED_MATCH/INTERRUPT_MATCH/AMBIGUOUS/TIMEOUT/
    CANCELLED` response discriminated union'ları.
19. `cancel_request` request/ack ve `ALREADY_TERMINAL` idempotency semantiği.
20. Wait fencing: run/session/epoch/occurrence/requestId ve stale-result rejection.
21. `stableForMs`, deadline, interrupt priority, ambiguity policy ve bounded candidate
    limitleri.
22. `nodeRef` generation/freshness ve bounded lifetime contract'ı.
23. Reader-loop/cancellable-worker/serialized-writer concurrency contract'ı.
24. Accessibility event-driven reevaluation ve scoped recovery-scan contract'ı.
25. Full dump'un `wait_any` request/response payload'ına girmediğini doğrulayan
    schema/size gate.
26. İlk B2 dışında bırakılan `register_watch`/unsolicited push capability'sinin
    protocol-major feature gate'i.
27. `UiWaitEvaluationPolicy`: initial evaluation, adaptive scoped safety rescan,
    min/max interval, max evaluation rate ve reason taxonomy.
28. `CONTROL/OBSERVATION/WAIT/MUTATION` command lane ve admission envelope şeması.
29. Mutation invalidation/tree-generation ve active-run Inspector denial error'ları.

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
11. Correlated `wait_any` result parser ve typed client API'si.
12. Aynı session'da `cancel_request` gönderebilen, reader'ı bloke etmeyen pending
    request lifecycle'ı.
13. Socket loss/reconnect'te in-flight wait'i `UNKNOWN_EFFECT` değil açık
    `WAIT_CONNECTION_LOST` olarak kapatma ve executor recovery kararı.
14. Late/duplicate terminal result, bounded candidate ve response-size politikası.
15. İlk B2'de unsolicited frame/watch subscriber kabul etmeyen fail-closed parser.
16. Device-bazlı command admission scheduler; control priority, bounded observation,
    ayrı heavy-observation quota, wait registry ve tek mutation lane.
17. Fairness, queue deadline, backpressure ve cancellation starvation testleri.
18. Mutation sonrası stale read/nodeRef invalidation ve wait immediate reevaluation.
19. Aktif run sırasında external Inspector Act fail-closed; explicit takeover audit'i.

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
15. `wait_any`, `cancel_request`, supported `UiPredicate`, max-target ve payload
    capability/version preflight'ı.
16. Active run bitişinde bütün in-flight wait worker'larının cancel/cleanup edildiğinin
    doğrulanması.
17. Admission policy/capability snapshot ve cihaz başına concurrency limit preflight'ı.
18. Manuel touch contamination'ın action lane ve run outcome'a bağlanması.

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
13. Shared TargetFingerprint ve fingerprint version.
14. Layer applicability/result taxonomy.
15. Clock calibration reference ve action lifecycle evidence tipleri.
16. `SdkQueryStep`, `SwitchStep` ve entity-binding contract'ları.
17. Continue Gate ile Final Oracle policy'sini ayrı typed alanlar yapmak.
18. Domain source-map referansı ve pack/version provenance.
19. UI wait requirement ve generic `UiWaitPlan` compilation seam'i.
20. `entityType`, `entityId`, `eventSeqRange` occurrence correlation alanları.
21. `OracleRequirement`: obligation/timing/deadline/onTimeout/applicability contract'ı.
22. Paralel `required[]/eventual[]` şemasından requirement listesine versioned
    migration ve ambiguity rejection.
23. Run lifecycle, business verdict, termination reason, cleanup result ve operational
    disposition ortak tipleri.
24. Step `actionResult/continueGateResult/finalOracleResult/cleanupResult` tipleri.

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

## D.6A WorkflowIR v2 tamamlama kapısı — Domain Pack önkoşulu

Bu kapı D.5 ve D.6 tamamlandıktan sonra bağımsız kabul edilir. Aşağıdakilerin tamamı
geçmeden D.6B/D.6C Domain Pack implementasyonu başlamaz:

1. Web/API aynı shared workflow contract paketini tüketiyor.
2. IR v2 runtime schema ve version migration testleri yeşil.
3. Condition/FOR_EACH/SWITCH/WAIT_EVENT/retry/cleanup union'ları tamam.
4. Continue Gate ve Final Oracle policy ayrımı typed ve serialize edilebilir.
5. Occurrence/iteration/entity/request/event correlation tanımlı.
6. Aynı generic IR fixture'ı deterministik serialize/hash ediliyor.
7. Nesy-specific type veya app class adı shared IR'a sızmıyor.
8. Legacy workflow reader migration sonucu source map üretiyor.
9. En az iki farklı domain adına ait generic acceptance fixture'ı aynı IR union'larıyla
   serialize/validate ediliyor; bu fixture'lar production Domain Pack implementation'ı
   değildir ve yalnız Core'un domain-neutral olduğunu kanıtlar.

## D.6B Domain Pack contract ve registry

1. `packages/domain-pack-contracts` package'i.
2. Formal `ApplicationDefinition`, versioned manifest ve application compatibility
   range.
3. Formal `ScreenDefinition`: logical key, runtime implementation union, entry,
   readiness, action/surface, design ve app-version contract'ı.
4. Formal `SurfaceDefinition`: kind, parent screen, detection/readiness, priority ve
   default handle/ignore/fail/operator policy'si.
5. Entity Registry ve B.7 Target Resolution Provider Chain contract'ları.
6. Semantic action/macro ve domain source-map contract'ları.
7. Named query projection/limit/redaction/capability contract'ı.
8. Formal Evidence Source Registry; plane/source kind/authority/correlation/freshness/
   normalization/redaction/fallback contract'ı.
9. Continue Gate ve fact-bazlı `OracleRequirement` Domain Oracle template
   contract'ları; obligation ile timing aynı requirement'ta taşınır.
10. Formal `LaunchProfile`: process policy, precondition, entry, expected
    screen/surface, readiness, cleanup ve automation-only contract'ı.
11. Formal `TestProfileDefinition`: kind, workflowRef, launchProfileRef, dataset,
    repetition, device matrix, network profile, fault plan, telemetry, finalOracle,
    cleanup, differential policy, schedule class, severity ve releaseGate contract'ı.
12. Formal `TestCampaignDefinition` ve `TestCampaignResult`: buildRef, environment,
    profileRefs, device/dataset override, startedBy, stopPolicy, releaseGateResult ve
    run/cell evidence deep-link contract'ı.
13. `FaultPlan`, `FaultTrigger`, `FaultAction`, `TelemetryPolicy`,
    `RepetitionPolicy`, `DatasetPolicy`, `DeviceMatrixPolicy` ve `DifferentialPolicy`
    shared schema'ları.
14. Scanner mode ve fixture/session prep contract'ları.
15. Pack validation, migration ve deterministic serialization.
16. First-party source → deterministic declarative bundle publish compiler'ı;
    canonical serialization, SHA-256 digest ve immutable version.
17. DB override Inspector mapping'i ile source mapping precedence/versioning.
18. Pack ↔ App Adapter compatibility ve preflight DTO'su.
19. Transport fact/business fact ayrımı ve conflict/fallback policy contract'ları.
20. Pack contract golden fixtures ve fuzz/property testleri.
21. Test Profile fixture'ları: PR smoke, nightly regression/recovery, weekly soak ve
    release certification contract validation.
22. Runtime arbitrary TypeScript/JavaScript execution negative testleri.
23. Run-start bundle/registry/derived-graph/reducer/test-profile digest pinning ve active-run
    hot-reload isolation contract'ı.
24. V1 third-party pack yasağı; gelecekteki signature/tenant/sandbox/capability
    gereksinimlerinin explicit feature gate'i.

## D.6C Nesy Courier Domain Pack ve App Adapter

1. `domain-packs/nesy-courier` TypeScript pack iskeleti.
2. Application/version/country/capability manifest'i.
3. Login, Stop List, Task List, Delivery, Pickup, Vehicle Loading ve End-of-Day
   Screen Registry tanımları.
4. Route dialog, options sheet, scanner, payment, network/session/update dialog ve
   diğer interrupt Surface Registry tanımları.
5. `ROUTE/STOP/TASK/SHIPMENT/PARCEL/PENDING_OPERATION` entity tanımları.
6. Stable business key + TargetFingerprint mapping'leri.
7. Accessibility identity → bounded entity binding → Inspector mapping → structural
   fingerprint resolution provider'ları; `rowIndexHint` yalnız son yardımcı ipucu.
8. `OPEN_STOP`, `PROCESS_PARCEL`, `COMPLETE_DELIVERY`, `DELIVER_STOP` semantic
   action/macro'ları.
9. Nested runtime entity query ve bounded `FOR_EACH` expansion fixture'ları.
10. Delivery/pickup/route/offline queue Domain Oracle template'leri.
11. `FULL_JOURNEY`, `PREPARED_SESSION`, `DIRECT_STATE` formal launch profile'ları.
12. V1 core Test Profile tanımları:
    - `nesy.smoke.core`
    - `nesy.regression.critical`
    - `nesy.regression.differential`
    - `nesy.recovery.payment-process-kill`
    - `nesy.recovery.fiscal-process-kill`
    - `nesy.recovery.queue-flush`
    - `nesy.bad-day.state-aware-short`
    - `nesy.contract.consistency`
    - `nesy.load.normal-60-stop`
    - `nesy.load.busy-120-stop`
    - `nesy.compatibility.field-devices`
    - `nesy.security.release-isolation`
    - `nesy.soak.short`
13. V1 preview Test Profile tanımları:
    - `nesy.accessibility.basic-preview`
    - `nesy.explorer.smart-preview`
14. Profile dataset/fixture tanımları: NORMAL 60 stop/300 shipment, BUSY 120 stop/600
    shipment, PEAK 250 stop/1200 shipment weekly/release genişleme profili.
15. Recovery/fault trigger mapping'leri: `PAYMENT_REQUEST_SENT`, `FISCAL_REQUEST_SENT`,
    `QUEUE_FLUSHING`, `LOCAL.DELIVERY_PERSISTING`, token expire ve offline/online.
16. Compatibility device matrix: Datecs, Urovo, temsilci düşük segment Samsung, CI
    emulator, minimum/güncel Android ve scanner/printer/payment/fiscal capability'leri.
17. Security/release isolation assertions: automation SDK yüzeyi, receiver/provider,
    HMAC, old secret replay, redaction, named query allowlist, Bridge package/window
    scope ve token/PIN/log sızıntısı.
18. Existing `NesyCommands`'ı App Adapter command set'ine refactor etmek.
19. Existing `NesyStateProvider`, `roomQueries` ve structured events'i adapter
    manifest'ine bağlamak.
20. `nesy.availableStops`, `nesy.stopState`, `nesy.taskState`, `nesy.parcelState`,
    `nesy.pendingOperation` bounded query'leri.
21. `real/injected/manual_dialog` scanner capability'leri.
22. Fixture/session preparation ve cleanup.
23. Automation-only surface release isolation testi.
24. Canonical technical evidence preservation ve host-side domain fact reducer.
25. Fact bazlı Evidence Source tanımları; HTTP transport fact ile business fact'in
    ayrılması.
26. Observation bus rate/payload/coalescing bütçe manifest'i ve event-storm testleri.
27. Pack/app-version/profile migration ve backward-compatibility testleri.
28. `NESY_COURIER_DOMAIN_PACK_REFERENCE_V1` artifact'i:
    `COURIER_LOGIN`, `SELECT_ROUTE`, `OPEN_STOP`, `PROCESS_PARCEL` ve
    `COMPLETE_DELIVERY` vertical slice'larını canonical örnek sözleşme olarak taşır;
    v1.1.3 itibarıyla `TOUR_APPROVAL_LIFECYCLE` altıncı multi-actor reference
    slice olarak eklenir.
29. Her reference slice için business meaning, notResponsibleFor, input/output,
    precondition, screen/surface, entity binding, target resolution, macro expansion,
    Continue Gate, Final Oracle, interrupt policy, required capability, source-map,
    Generic IR snapshot ve BridgeFlowPlan snapshot.
30. `OPEN_STOP` reference macro'su:
    - `STOP` input entity'sini alır,
    - `nesy.availableStops` içinde hedef entity'nin varlığını doğrular,
    - `nesy.target.stop-row` için Target Resolution Provider Chain kullanır,
    - ambiguous target'ta hiçbir dokunuş yapmadan fail eder,
    - `TASK_LIST` veya `DELIVERY` readiness'ini bekler,
    - `APP.ACTIVE_STOP_MATCHES` ile yanlış satır açılmasını yakalar.
31. `COURIER_LOGIN` reference macro'su:
    - secret-reference credential kullanır,
    - PIN'i Bridge input ile girer,
    - Route Selection veya Home readiness'i bekler,
    - `APP.USER_SESSION_AVAILABLE`, `LOCAL.USER_SESSION_AVAILABLE` ve
      `REMOTE.AUTH_ACCEPTED` kanıtlarını doğru timing/obligation ile ayırır.
32. `TOUR_APPROVAL_LIFECYCLE` reference slice'ı:
    - kurye aktörünün Mobile UI'da tur onayı istemesini Bridge action ve
      `APP.TOUR_APPROVAL_REQUESTED` kanıtıyla başlatır,
    - dispatcher/supervisor aktörünü `REMOTE_ACTION` üzerinden Nesy Backoffice
      Adapter'a bağlar,
    - iki backend servis çağrısını ayrı remote evidence fact olarak taşır,
    - HTTP 2xx'i business success saymaz; backend entity status ve correlation
      doğrulaması ister,
    - gerçek tur onayı testi ile precondition/fixture setup modunu ayırır,
    - setup modu tur onayı ürün PASS'i veya push başarı hükmü üretemez,
    - idempotency key, resource lease, partial mutation ve reconciliation policy
      taşır,
    - Continue Gate ve Final Oracle'da remote/app/UI/push kanıt yükümlülüklerini
      açıkça ayırır.
33. Setup login ile gerçek login testi ayrımı:
    `PREPARED_SESSION` veya `DIRECT_STATE` launch profile'ı login testi PASS'i
    üretmez; yalnız başlangıç koşulu hazırlar.
34. Editor palette üretim contract'ı:
    Domain Pack semantic node'ları Cockpit palette'inde iş diliyle görünür; Advanced
    generic node'lar ayrı gruptadır ve Core business macro ismi bilmez.
34. Domain node → Generic WorkflowIR → BridgeFlowPlan source-map golden snapshot'ları;
    macro adı, generic step id'leri, occurrence/entity correlation ve wait/action refs
    trace edilebilir.
35. Bridge protocol'a `OPEN_STOP`, `COURIER_LOGIN`, `STOP`, `PARCEL`, `DELIVERY` gibi
    business command/type sızmadığını gösteren contract testleri.

## D.6D Bridge `wait_any` Runtime

Bu iş generic olduğundan Bridge contract/client temeliyle hazırlanabilir; ancak
Nesy mapping'i D.6C sonrasında pack'ten üretilir.

1. Bridge APK `wait_any` command handler ve cancellable worker registry'si.
2. Expected target ve interrupt target'ların tek evaluation içinde yarıştırılması.
3. Same-generation interrupt priority ve deterministic tie-break.
4. Accessibility event → changed-window/subtree reevaluation.
5. `stableForMs`, appear/disappear/count/readiness evaluator.
6. Optional local node index ve treeGen invalidation.
7. Bounded `EXPECTED_MATCH/INTERRUPT_MATCH/AMBIGUOUS/TIMEOUT/CANCELLED` response'u.
8. TCP reader'ı açık tutan dispatch, serialized writer ve `cancel_request` handling.
9. Deadline, max target/candidate, rate ve memory/CPU budget.
10. Run/session/epoch/occurrence/request fencing.
11. Socket close/process-death stale-worker/index cleanup.
12. Full dump yalnız explicit diagnostic capture/artifact yolu; recovery scan scoped,
    rate-limited ve metric'li.
13. `wait_node` backward compatibility ve `wait_any` capability negotiation.
14. `register_watch`/unsolicited push protokolünün ilk B2'de bulunmadığını doğrulayan
    negative contract testleri.
15. Real DUT performance, cancellation race ve event-storm testleri.
16. Request başlangıcında event beklemeden initial bounded scoped evaluation.
17. Accessibility event gelmediğinde adaptive scoped safety-rescan liveness'i.
18. Initial/event/mutation/safety/event-loss evaluation reason metric'leri.
19. Mutation generation invalidation'ının active wait'i immediate reevaluate etmesi.
20. Safety scan'in full-tree polling'e dönüşmediğini doğrulayan scope/rate/CPU gate'i.

## D.6E Evidence Source Registry ve Normalization Runtime

1. Domain Pack Evidence Source Registry loader/validator.
2. Source kind adapter'ları: Bridge wait, network operation, SDK event/state, named
   query, DB verifier, remote verifier ve derived fact.
3. Fact-specific primary/confirmatory/fallback authority çözümleme.
4. Correlation/freshness gate ve stale snapshot/transition ayrımı.
5. Canonical technical evidence → normalized fact derivation trace'i.
6. Primary-confirmatory conflict ve `EVIDENCE_CONFLICT` terminal policy'si.
7. HTTP/transport success ile domain business success ayrımı.
8. Generic SDK Local Observation Bus için dedupe/coalescing/rate/payload/redaction
   budget enforcement.
9. Dropped/coalesced observation metric ve audit marker'ları.
10. Large collection stream yasağı ve named-query-only on-demand projection.
11. Capability preflight ve missing-source compile error mapping'i.
12. Restart/replay/idempotency, fuzz ve high-volume event-storm testleri.
13. `RECEIPT_SAFE/ORDERED_REQUIRED` source/fact lane validator'ı ve subscriber
    binding enforcement.
14. Receipt-safe fact'i committed inbox identity üzerinden düşük gecikmeli üretme;
    ordered-dependent derivation'ı receipt lane'de reddetme.
15. Derived Fact Dependency DAG loader, topological order ve cycle/self/undefined
    dependency validation.
16. Reducer key/version/output-schema ve input-fact-set bazlı idempotency.
17. Input evidence identity, authority, lane, reducer ve bundle digest'ini taşıyan
    derived provenance.
18. Active run graph/reducer pinning; hot reload yalnız yeni run'a uygulanır.

## D.7 BridgeFlowCompiler

1. Workflow graph validation.
2. Deterministik traversal.
3. Compile-time branch resolution.
4. Runtime condition step üretimi.
5. Domain Pack validation ve semantic macro expansion'ı.
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
21. TargetFingerprint strength, ambiguity ve drift validation.
22. Fixed-coordinate target rejection.
23. Required business event/state/query capability validation.
24. Required/eventual/warning/optional/not-applicable evidence role/layer compilation.
25. Pack/app/adapter compatibility ve provenance validation.
26. Dynamic entity query + binding + nested iteration planı.
27. Continue Gate ve Final Oracle template binding.
28. Surface/target contract'tan generic expected/interrupt `UiWaitPlan` üretimi.
29. `wait_any` deadline/limit/cancellation planı ve full-dump hot-path rejection.
30. Domain Pack expansion'ın generic IR v2 dışına çıkmadığını doğrulama.
31. Screen/Surface/Launch Profile registry referanslarının serbest string olmadığını
    ve app-version compatibility'sini doğrulama.
32. Evidence Source Registry authority/correlation/freshness requirement'larını
    capability manifest'e bağlama.
33. Source/fact delivery lane'ini plana yazma ve ordered-required fact'i receipt-only
    gate'e bağlamayı compile error yapma.
34. Oracle paralel string listelerini reddedip unified `OracleRequirement` üretme.
35. Derived graph ve reducer digest'ini plan hash/provenance'a dahil etme.
36. Test Profile expansion: profile'ın workflowRef, launchProfileRef, dataset, repeat,
    device matrix, fault, telemetry, differential ve schedule policy'sini aynı
    BridgeFlowPlan/run input modeline deterministik yazma.
37. Test Profile'ın yeni engine/runner istemesini compile-time reddetme; profile yalnız
    existing IR/BridgeFlow primitive'lerine açılabilir.
38. Fault trigger'larını fact/surface/source correlation requirement'larıyla plana yazma;
    correlation kurulamıyorsa profile compile/preflight fail.
39. Differential Regression için baseline build/fact-sequence/oracle/evidence journey
    comparison source-map'ini plana ekleme.

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
21. `RECEIVED → TARGET_RESOLVED → GESTURE_DISPATCHED → GESTURE_COMPLETED → EFFECT_VERIFIED` transition persistence.
22. Action response kaybında exactly-once varsaymadan `UNKNOWN_EFFECT` recovery.
23. Clock calibration oluşturma/yenileme ve reboot invalidation.
24. Effect verification tamamlanmadan step success üretmeme.
25. Continue Gate evaluator; blocking condition sağlanınca deadline dolmadan ilerleme.
26. Eventual Final Oracle work item'ını occurrence kapanışına kadar izleme.
27. `UiWaitPlan`'ı tek correlated `wait_any` request'ine çevirme, result routing ve
    gerektiğinde `cancel_request` gönderme.
28. Wait ambiguity/interrupt/timeout/cancel sonucunu step state machine'e bağlama.
29. Koşulsuz fixed-wait step'ini runtime'da reddetme.
30. Socket reader/worker/writer concurrency ve match-timeout-cancel race'inde tek
    terminal sonucu persist etme.
31. Device Command Admission üzerinden control/observation/wait/mutation dispatch;
    tek mutation, bounded reads/waits ve fairness/backpressure.
32. Mutation/treeGen invalidation ve active wait immediate scoped reevaluation.
33. Continue Gate wait filter'ını registry lane'e göre `DurableReceiptBus` veya
    `OrderedEvidenceBus` subscriber'ına bağlama.
34. Lifecycle, business verdict, termination reason, cleanup result ve operational
    disposition transition'larını ayrı ve atomik persist etme.
35. Cleanup failure'ın terminal business verdict'i overwrite etmemesi; attention ve
    cleanup retry/escalation üretmesi.
36. Step action/gate/oracle/cleanup sonuç eksenlerini ayrı izleme.
37. Run-start immutable Domain Pack/registry/derived-graph/reducer digest pinning ve
    aktif run hot-reload isolation.
38. Test Profile/Campaign execution parametrelerini run başlangıcında pinleme:
    profileKey/version, campaignId, buildRef, datasetRef, device cell, repetition index,
    fault application state, telemetry policy ve releaseGate flag.
39. Repetition/soak loop'unu yeni engine açmadan occurrence/run modeline bağlama;
    stopOnFirstFailure, maxConsecutiveFailures ve soak deadline davranışını persist etme.
40. State-aware fault tetikleyicilerini Evidence Source/Surface/Step occurrence
    correlation üzerinden uygulama; random-timer fault'u v1 core varsayılanı yapmama.
41. Campaign cell result üretme ve her cell'i gerçek runId/Evidence Journey/Oracle
    summary'sine deep-link ile bağlama.
42. Preview profile sonucunu business verdict/release gate üzerine overwrite etmeme.

## D.9 Oracle Engine v2

1. Evidence key: run/session/epoch/occurrence/iteration.
2. UI evidence adapter.
3. SDK durable event adapter.
4. SDK state adapter.
5. Local DB adapter.
6. Remote backend adapter.
7. Completion policy evaluator.
8. Pending/partial/pass/fail/unknown states.
9. Local layer altında `QUEUE_OFFLINE` evidence subtype ve result policy.
10. Missing-event root cause sınıflandırması.
11. Duplicate/replayed evidence idempotency.
12. Late evidence policy.
13. Common monotonic timeline.
14. Backend/Bridge/SDK clock anchor metadata.
15. Repeated node ve loop testleri.
16. Final verdict explanation DTO.
17. Layer applicability ve fact-bazlı Oracle obligation/timing:
    required/warning/optional/not-applicable + immediate/eventual/not-measured.
18. B.8'e uygun ayrık sonuç eksenleri: terminal `ProductVerdict`,
    `EvaluationFailureClass`, non-terminal `PENDING_REMOTE` evaluation state'i,
    layer-specific result/root cause, termination ve action outcome.
19. Remote business adapter: HTTP + business result + backend entity + dispatcher + correlation.
20. Eventual-consistency deadline ve pending→terminal transition.
21. Clock offset/uncertainty-aware evidence ordering.
22. Continue Gate ve Final Oracle'ı ayrı evaluator/state olarak persist etme.
23. `LOCAL_QUERY` ve queue evidence subtype'larını Local layer altında modelleme.
24. Domain Oracle template resolution ve pack/version provenance.
25. Canonical technical evidence → semantic fact derivation trace'i; durable audit
    evidence'i koruma.
26. `runId/stepId/occurrenceId/entityType/entityId/attempt/eventSeq` zorunlu
    correlation; node-type fan-out yasağı.
27. `DELIVERY_PERSISTED` ve `QUEUE_OFFLINE` dahil offline queued terminal policy.
28. Evidence Source Registry resolver ve primary/confirmatory/fallback authority.
29. Correlation/freshness/conflict gate; stale veya başka occurrence'a ait fact'in
    Oracle'ı geçirmesini engelleme.
30. Transport fact → domain fact derivation kuralı; HTTP 2xx'nin otomatik business
    PASS olmaması.
31. Continue Gate evaluator'ın yalnız blocking expression'ı, Final Oracle evaluator'ın
    unified `OracleRequirement` obligation/timing/deadline/onTimeout alanlarını işlemesi.
32. Requirement başına eventual deadline ve timeout→fail/inconclusive/warning
    politikasını deterministik uygulama.
33. Final business verdict ile cleanup/termination/operational disposition'ı ayrı
    üretme; cleanup failure ile verdict overwrite etmeme.
34. Receipt Bus'ın yalnız receipt-safe gate için latency yolu olması; Final Oracle,
    audit ve order-sensitive derived fact authority'sinin Ordered Bus'ta kalması.
35. Derived fact DAG provenance, reducer version ve pinned bundle/graph digest'ini
    final verdict explanation'a bağlama.
36. B.16 Evidence Journey classifier: emit attempt, WAL, transport, inbox, receipt,
    ordered, normalization, correlation ve evaluation aşamalarını ayrı üretme.
37. Negative evidence policy: `NOT_OBSERVED/UNKNOWN/PENDING/BLOCKED` durumlarını
    kanıtsız `FAILED` yapmama; authority/confidence/source/evidence ref taşıma.
38. Explicit SDK diagnostic outcome, WAL/inbox/cursor/reducer/fact/Oracle kayıtlarını
    stage evidence'ına dönüştürme; stage conflict'i overwrite etmeden saklama.
39. Receipt confirmed + ordered gap, normalized fact + correlation miss ve fact +
    Oracle deadline gibi ayrık durumları açıklama DTO'sunda doğru sınıflandırma.

## D.10 Persistence ve API

1. Additive Prisma migration.
2. Engine type ve plan alanları.
3. Protocol/capability snapshot.
4. Run/session/epoch/auth state.
5. Step occurrence tablosu veya mevcut tablonun güvenli genişletilmesi.
6. Attempt ve request correlation.
7. Evidence ve artifact ilişkileri.
8. Condition/dialog decisions.
9. Lifecycle state, business verdict/revision, termination reason, cleanup result ve
   operational disposition alanları; recovery/cancel marker'ları.
10. Event subscription/checkpoint state.
11. Audit ilişkileri.
12. Retention/purge state.
13. Eski engine verisini generic legacy execution artifact modeline taşıma.
14. Eski `yamlContent`/`maestroOutput` verisi için sayım, checksum ve export doğrulaması.
15. Engine-specific Prisma kolonları ve DTO'ları drop etmeye hazırlayan iki aşamalı migration.
16. Engine-neutral legacy run summary; özel renderer yok.
17. API DTO versioning.
18. Pagination ve büyük artifact ayrımı.
19. Target fingerprint ve resolution evidence alanları.
20. Physical action transition tablosu/JSON modeli.
21. Per-layer applicability ve verdict result taxonomy.
22. Clock calibration/anchor/uncertainty modeli.
23. Diagnostic waterfall stage ve correlation alanları.
24. Domain Pack/version/application compatibility ve manifest provenance.
25. Screen/Surface/Entity/Target mapping ve migration modeli.
26. Continue Gate ile Final Oracle state/deadline/result alanları.
27. `wait_any` request/result/cancel ve diagnostic capture referansları.
28. Canonical technical evidence → semantic fact derivation ilişkisi.
29. Application/Screen/Surface/Launch Profile versioned registry snapshot'ları.
30. Evidence Source Registry source/authority/correlation/freshness ve conflict
    kayıtları.
31. Observation coalescing/drop/budget audit marker'ları.
32. Domain Pack draft/published/archive version, optimistic concurrency, reviewer ve
    migration audit modeli.
33. Page data-source/DTO version, compatibility adapter/expiry ve availability reason
    audit snapshot'ı; normal render için gereksiz DB write üretmeden yalnız mutation/
    run/release evidence'ına bağlanır.
34. Receipt cursor/dispatch/idempotency ve ordered cursor/processed/dead-letter
    state'lerini birbirinden ayıran event runtime modeli.
35. Evidence delivery lane ve subscriber checkpoint snapshot'ı.
36. Derived dependency graph/reducer/output-schema/input fact provenance modeli.
37. Domain Pack immutable runtime bundle digest/publish provenance ve active-run
    pin snapshot'ı.
38. Step action/gate/oracle/cleanup sonuç eksenleri ve verdict'ten bağımsız cleanup
    retry/escalation modeli.
39. Evidence Journey stage/state/reason/authority/confidence/source ve evidence-ref
    modeli; raw kayıtlar için referans, summary için versioned read model.
40. Occurrence layer-applicability immutable snapshot'ı ve compact/detail
    presentation revision alanları.
41. Interaction origin/evidence/confidence ve injected gesture monotonic interval
    korelasyon modeli; `UNKNOWN` origin'in korunması.
42. Repro capture manifest'i: mode/scope/reason/capturedAt/hash/redaction/retention ve
    yakalanmamış artifact için explicit `NOT_CAPTURED` state'i.
43. Test Profile registry snapshot'ı: profileKey/version/kind, workflowRef,
    launchProfileRef, dataset, repetition, deviceMatrix, faultPlan, telemetryPolicy,
    differentialPolicy, scheduleClasses, severity ve releaseGate alanları.
44. Test Campaign modeli: campaignId, buildRef, environmentKey, scheduleClass,
    profileRefs, device cell, dataset override, startedBy, stopPolicy ve
    releaseGateResult.
45. Campaign cell/result read model'i: profileKey, runIds, failedCells,
    evidenceSummaryRef, blocked/precondition reason ve Run Detail deep-link'leri.

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
19. `TargetFingerprint` formu ve fingerprint strength/drift göstergesi.
20. Business `rowKey` seçimi; `rowIndexHint` kullanımında uyarı.
21. OracleRequirement obligation/timing/deadline/onTimeout ve layer applicability
    editörü; aynı fact için paralel role/time listesi üretmeme.
22. Domain Pack/application/version selector ve compatibility sonucu.
23. Semantic action/macro palette'i ve entity/query binding formu.
24. Launch profile ve scanner mode seçimi.
25. Continue Gate ile Final Oracle policy'sini ayrı editörler olarak sunma.
26. Pack/source-map/compiled generic IR provenance görünümü.
27. Application, Screen ve Surface Registry manager/editor ekranları.
28. Surface parent-screen, kind, detection/readiness ve default interrupt policy
    editörü.
29. Formal Launch Profile Builder: process, precondition, entry, expected
    screen/surface, readiness ve cleanup.
30. Evidence Source Registry manager: fact, plane, source kind, authority, delivery
    lane, correlation, freshness, redaction, fallback ve derived dependency DAG.
31. Target Resolution Provider Chain görünümü; hangi provider'ın hangi evidence ile
    target çözdüğünü gösterme.
32. Expected/Interrupt Wait Preview; wire seviyesinde registration varmış gibi
    lifecycle göstermeme.
33. Published immutable bundle/registry/derived graph/reducer digest ve active-run
    pin provenance görünümü.
34. Compact layer preview'ı component/workflow-registry default'undan değil compiler
    applicability snapshot'ından üretme; detail'de dört plane explicit state preview.
35. Formal Test Profile Builder: workflow, launch profile, dataset, repetition, device
    matrix, fault trigger/action, telemetry, differential policy, finalOracle, cleanup,
    schedule class, severity ve releaseGate alanlarını tek formda sunma.
36. Test Campaign Builder: buildRef, environment, profile selection, matrix override,
    PR/nightly/weekly/release policy, stopPolicy ve release gate sonucunu oluşturma.
37. Profile catalog'da core/preview ayrımı, releaseGate badge'i, required capability,
    last campaign result ve blocked reason gösterme.
38. Campaign runs ekranında profile cell → run detail deep-link, failedCells, evidence
    summary, campaign-level GO/NO_GO/NEEDS_ATTENTION sonucunu gösterme.

## D.11A Yedi workspace route migrasyonu ve bilgi mimarisi

1. `WORKSPACES` SSOT'unda yedi top-level workspace'i korumak; sekizinci Verdict
   workspace eklememek.
2. Automation navigasyonuna `Domain Packs` girişi eklemek.
3. `/automation/domain-packs` catalog/list/create/import/validate route'u.
4. `/automation/domain-packs/[packId]` tab'li manager route'u:
   - manifest/compatibility,
   - applications,
   - screens,
   - surfaces,
   - entities/targets,
   - evidence sources,
   - semantic actions/macros,
   - oracle templates,
   - launch profiles,
   - test profiles,
   - migrations/validation.
5. Domain Pack draft/published/archived state, optimistic concurrency ve immutable
   published version davranışı.
6. Automation navigasyonuna `Test Profiles` ve `Test Campaigns` girişleri eklemek.
7. `/automation/test-profiles` catalog/list/filter/core-preview/releaseGate route'u.
8. `/automation/test-profiles/[profileId]` detay route'u: profile definition,
   workflow/launch/dataset/fault/device/telemetry/oracle/schedule ve last-campaign
   provenance.
9. `/automation/test-campaigns` campaign list/schedule/release-candidate route'u.
10. `/automation/test-campaigns/[campaignId]` campaign matrix/result/deep-link route'u.
11. Workflow Editor, Live Inspector, Test Profile ve Campaign ekranlarından ilgili
    pack/tab'a stable deep-link.
12. `/automation/list`, `/automation/history`, `/automation/field-login`,
   `/automation/01-load-tour-flow`, `/automation/[id]` ve run-detail URL sürekliliği.
13. `/automation/overview` redirect regression testi.
14. `/debug-view/screen-state` route'unu koruyup Live Inspector rolüne genişletmek;
   ikinci paralel Inspector route'u üretmemek.
15. `/pm/root-cause` sayfasını `Ticket Management` altında navigasyona eklemek veya
    route'u kaldırmak için product kararı almak; CP6 kabulünde orphan bırakılamaz.
    Bu planın varsayılan kararı navigasyona **Root Cause Intelligence** olarak
    eklemektir.
16. `/engineering/current-architecture` içeriğini hedef ve geçiş mimarisiyle
    güncellemek; aktif Maestro execution diyagramı bırakmamak.
17. `/engineering/modernization-plan` boş shell'ini CP0–CP9 checkpoint, owner,
    blocker ve evidence-link dashboard'una dönüştürmek. Bu sayfa status'u elle
    kopyalamaz; release evidence/checkpoint read modelini tüketir.
18. `/product/screen-map` ürün haritasını korumak; runtime Screen/Surface Registry'nin
    editörü veya SSOT'u yapmamak. Opsiyonel registry/drift overlay yalnız read-only
    provenance ile gösterilir.
19. Product, PM release/version, Engineering knowledge/tools ve Data Center route'ları
    için no-regression ownership listesi.
20. Home placeholder'ları, PM Calendar/Roadmap, Screen Manual ve Settings route
    borcunu D.20'de tutmak; platform page-acceptance sayımına dahil etmemek.
21. Route rename gerektiğinde permanent redirect, old-link telemetry, owner ve sunset
    checkpoint'i zorunlu kılmak.
17. `apps/web` için versioned `PageMigrationManifest` üretmek; route, current/target
    source, phase, availability, role, legacy cleanup ve acceptance test referansı
    taşımak.
18. Her route'un navigation, direct URL ve browser refresh/deep-link davranışını
    ayrı test etmek.
19. Automation layout auth ayrımı: platform RBAC, Nesy Dashboard auth ve SDK run
    auth state'lerini ayrı context/gate olarak modellemek; pack/list/history/read-only
    authoring'i gereksiz Nesy login'e bağlamamak.

## D.11B Page data-source ve API cutover contract'ı

Sayfalar transport ayrıntısını component içine gömmez. Versioned web service/BFF
adapter'ı kullanır:

```ts
interface PageDataSourceContract {
  routePattern: string;
  currentSource: string;
  targetSource: string;
  targetDtoVersion: string;
  cutoverCheckpoint: string;
  compatibilityAdapter?: string;
  compatibilityExpiry?: string;
  fallbackPolicy: "NONE" | "READ_ONLY_LEGACY_SUMMARY";
}
```

Bağlayıcı cutover'lar:

1. `/debug-view/overview`: ADB runtime korunur; SDK Control/Event, durable ingest,
   Bridge ve active-run health `DeviceReadinessQuery` ile birleşir.
2. `/debug-view/operational-health`: `/api/adb/health` tek kaynak olmaktan çıkar;
   `DeviceReadinessQuery` app/SDK/Bridge/pack/evidence capability ve remediation
   DTO'sunu döndürür.
3. `/debug-view/screen-state`: legacy ADB/SDK snapshot geçici observe adapter'ıdır;
   hedef `LiveInspectorSession` + Bridge scoped snapshot/action contract'ıdır.
4. `/debug-view/interactions`: ADB interaction SSE primary olmaktan çıkar;
   authenticated WS → durable bus → run/device-scoped
   `DurableInteractionSubscription` hedef kaynaktır.
5. `/debug-view/network-inspector`: mevcut network/logcat kaynağı korunur; Bridge'e
   veya response-body capture'a taşınmaz.
6. `/debug-view/schedule` ve `/debug-view/database`: ADB/run-as read-only kaynakları
   korunur; automation named-query ile değiştirilmez.
7. `/debug-view/adb-scenarios`: ADB device operation + VerdictChannel typed control
   kullanır; UI action gerekiyorsa ayrı Bridge command contract'ı çağırır.
8. `/debug-view/log-explorer`: ADB logcat teşhis kaynağı olarak kalır; Oracle primary
   evidence kaynağı sayılmaz.
9. `/automation/list`: `WorkflowCatalogQuery` shared WorkflowIR/pack/compatibility/
   compile-state DTO'suna geçer.
10. `/automation/history`: `RunHistoryQuery` engine-neutral run/result/provenance
    DTO'suna geçer.
11. `/automation/domain-packs*`: `DomainPackAdminApi` draft/version/validation/
    migration/compatibility DTO'larını kullanır.
12. `/automation/test-profiles*`: `TestProfileCatalogQuery`, `TestProfileDetailQuery`
    ve `TestProfileValidationApi` kullanır; profile source'u published/draft Domain
    Pack bundle'ına, workflowRef/launchProfileRef/datasetRef/faultPlan/telemetryPolicy
    provenance'ına bağlıdır.
13. `/automation/test-campaigns*`: `TestCampaignQuery`, `TestCampaignStartApi` ve
    `TestCampaignResultQuery` kullanır; campaign cell'leri gerçek `runId` ve
    `RunDetailQuery` deep-link'i olmadan PASS/FAIL göstermez.
14. `/automation/[id]`: tek API `WorkflowCompileApi` preview ve execution için aynı
    compiled plan hash'ini üretir; web local compiler/YAML fallback yoktur.
15. `/automation/[id]/runs/[runId]`: `RunDetailQuery` occurrence/Evidence Journey/
    wait/gate/oracle/layer-applicability/interaction-origin/repro/artifact/clock
    DTO'sunu kullanır.
16. `/automation/field-login` ve `/automation/01-load-tour-flow`: özel orchestrator
    API'leri yerine generic `WorkflowRunApi` + Nesy Courier Domain Pack kullanır.
17. Eski run yalnız `LegacyRunSummaryQuery` ile read-only açılabilir; engine-specific
    renderer veya replay yoktur.
16. Data Center `NesyAuthProvider` ve shipment/pickup/happy-path/users servisleri SDK
    run authentication'ına taşınmaz; regression contract ile korunur.
17. API/DTO değişimi additive version ile başlar. Compatibility adapter owner, metric,
    expiry ve removal checkpoint'i olmadan kalıcılaşamaz.
18. Target source unavailable ise page stale mock veya başka lane'e sessiz düşmez;
    typed `BLOCKED_PRECONDITION`/error state gösterir.

## D.11C Page availability, acceptance ve regression gate'i

Her production route için `PageAcceptanceDefinition` tutulur:

```ts
interface PageAcceptanceDefinition {
  routePattern: string;
  owner: string;
  phase: string;
  requiredCapabilities: string[];
  allowedAvailabilityStates: string[];
  authPolicy: string;
  dataSourceContractRef: string;
  legacyZeroPatterns: string[];
  tests: string[];
}
```

Zorunlu kabul sınıfları:

1. Navigation ve direct/deep-link route smoke.
2. Browser refresh ve dynamic route parameter validation.
3. Loading, empty, partial, disconnected, blocked, stale ve error state'leri.
4. Auth/RBAC; Domain Pack publish/migrate, Inspector Act ve artifact erişimi ayrı
   yetkilerdir.
5. Automation platform sayfaları Nesy Dashboard session olmadan tanımlı read-only/
   authoring rollerinde açılır; yalnız Nesy backend gerektiren mutation/run precondition
   ister.
6. Production device'ta Inspector `READ_ONLY`; action kontrolü yalnız buton gizleme
   değil API fail-closed gate'iyle uygulanır.
7. Capability/app-version/pack mismatch reason ve güvenli remediation gösterimi.
8. Preview plan hash ile executed plan hash eşitliği.
9. Run/session/occurrence isolation; başka run evidence'ı gösterilememe.
10. Responsive layout, klavye erişimi, screen-reader label ve focus restoration.
11. Secret/PIN/token ve redaction kontrolleri.
12. Page render, data fetch, blocked reason, mutation, compile/run ve artifact action
    için correlation/observability.
13. Legacy-zero: Maestro/YAML label, button, import, service call, DTO veya renderer
    bulunmaması.
14. Korunan Product/PM/Engineering/Data Center/ADB route'larında non-regression smoke.
15. Placeholder route'un bilinçli backlog state'i ile gerçek broken route'un ayrı
    raporlanması.
16. CP6'da bütün hedef route'lar UI/contract seviyesinde, CP7'de Field Login/Load Tour
    gerçek workflow seviyesinde, CP9'da legacy-zero seviyesinde kabul edilir.
17. Run Detail compact/detail layer state'i compiled occurrence snapshot'ıyla aynı;
    workflow web registry runtime authority veya silent fallback değildir.
18. Evidence Journey ve repro artifact availability state'i loading/partial/expired/
    not-captured durumlarını kanıtsız failure'a çevirmeden gösterir.

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
17. Seçilen node'dan versioned `TargetFingerprint` üretme.
18. Fingerprint'in resolve ettiği alanları ve match count'u gösterme.
19. `rowKey` ile collection satırı seçme; `rowIndex`i yalnız hint olarak kullanma.
20. Kullanılan physical action method'unu (`dispatchGesture`/semantic action) gösterme.
21. Selector drift ve app-version uyumluluk uyarısı.
22. Screen/Surface Registry mapping oluşturma ve versioned override/source kararı.
23. O occurrence için çalışan Expected/Interrupt `wait_any` hedefleri, deadline,
    match count ve treeGen görünümü.
24. Wait ambiguity/timeout/interrupt/cancel evidence'ını occurrence'a bağlama.
25. Full dump'u yalnız explicit diagnostic capture olarak başlatma.
26. Screen ve active Surface detection sonucunu aynı anda, ayrı registry key'leriyle
    gösterme.
27. Target provider sonucu, ambiguity candidate'ları ve bounded entity-binding
    evidence'ını gösterme.

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
13. Application/app-version/Domain Pack/App Adapter compatibility.
14. Required Evidence Source, Launch Profile ve `wait_any` capability readiness.
15. `DeviceReadinessQuery` target DTO ve page availability/reason/remediation mapping'i.
16. Receipt Bus ile Ordered Bus health/lag/cursor/dead-letter durumlarını ayrı gösterme.
17. Device command admission: active control/observation/wait/mutation sayısı, queue,
    current mutation owner ve Inspector Act block reason.

## D.14 Nesy Courier Reference Domain Pack E2E

Bu bölüm Verdict Core'a özel kurye yolları eklemez. D.6C'deki Nesy Courier Domain
Pack'in, App Adapter'ın ve generic Core runtime'ın uçtan uca referans
implementation/acceptance paketidir.

1. Özel Maestro orchestrator'ları kaldırmadan önce Domain Pack semantic workflow'una
   taşımak.
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
14. Workflow yalnız Nesy Courier Domain Pack semantic macro'larını authoring yüzeyinde kullanır.
15. Runtime stop/task/shipment/parcel entity discovery ve nested `FOR_EACH`.
16. Her entity occurrence için stable key ve correlation.
17. Route/scanner/payment/session/update surface'leri için expected/interrupt
    `UiWaitPlan` ve `wait_any` execution'ı.
18. Continue Gate ve eventual Final Oracle'ın ayrı kanıtlanması.
19. `FULL_JOURNEY`, `PREPARED_SESSION`, `DIRECT_STATE` profile testleri.
20. Application/Screen/Surface Registry ve app-version compatibility acceptance.
21. Evidence Source Registry fact authority/correlation/freshness acceptance.
22. SDK canonical evidence → host Domain Pack reducer → normalized fact derivation
    trace'i.
23. UI'da görünmeyen stop id için bounded entity-target binding acceptance; bütün stop
    datasını stream etmeme.
24. Core package'larında `STOP/PARCEL/ROUTE/DELIVERY` type/branch bulunmadığını
    architectural test ile doğrulama.
25. Nesy v1 core Test Profile acceptance:
    - `nesy.smoke.core`
    - `nesy.regression.critical`
    - `nesy.regression.differential`
    - `nesy.recovery.payment-process-kill`
    - `nesy.recovery.fiscal-process-kill`
    - `nesy.recovery.queue-flush`
    - `nesy.bad-day.state-aware-short`
    - `nesy.contract.consistency`
    - `nesy.load.normal-60-stop`
    - `nesy.load.busy-120-stop`
    - `nesy.compatibility.field-devices`
    - `nesy.security.release-isolation`
    - `nesy.soak.short`
26. Preview profile acceptance:
    - Basic Accessibility Audit yalnız Bridge'in güvenilir gözlemlediği accessibility
      metadata ile sınırlı kalır.
    - Smart Explorer Preview crash/ANR/unexpected surface sinyali üretir, release gate
      veya Final Oracle authority olmaz.
27. Test Campaign acceptance: PR/nightly/weekly/release schedule class'ları, campaign
    cell sonuçları, failedCells, evidenceSummaryRef ve Run Detail deep-link'leri gerçek
    koşumdan üretilir.
28. Recovery/Bad Day profilleri random timer yerine business fact/surface/source
    trigger'ı kullanır; trigger correlation yoksa profile fail-closed olur.

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
10. Normalize diagnostic waterfall:
    - `COMMAND_CREATED`
    - `COMMAND_SENT`
    - `COMMAND_RECEIVED`
    - `TARGET_RESOLVED`
    - `GESTURE_DISPATCHED`
    - `GESTURE_COMPLETED`
    - `EFFECT_VERIFIED`
    - `APP_EVENT_RECEIVED`
    - `LOCAL_STATE_CONFIRMED`
    - `HTTP_REQUEST_STARTED`
    - `HTTP_RESPONSE_RECEIVED`
    - `REMOTE_STATE_CONFIRMED`
    - `QUEUE_OFFLINE_CONFIRMED`
    - `STEP_COMPLETED`
11. Waterfall satırında source, device/host mono time, offset uncertainty,
    correlation ID, evidence link ve redacted detail.
12. Copy repro paketi:
    - app version/build variant
    - SDK ve Bridge version/protocol
    - workflow version ve plan hash
    - device model/API/orientation/resolution/capabilities
    - screen
    - redacted command
    - target fingerprint ve resolution evidence
    - requestId ve action lifecycle
    - run/session/epoch/occurrence/iteration
    - treeGen
    - sanitized run input
    - expected/actual events ve layer evidence
    - clock calibration/offset/uncertainty
    - yalnız gerçekten capture edildiyse scoped dump/screenshot ref ve artifact hash;
      aksi halde explicit `NOT_CAPTURED`
    - retention/expiry metadata
13. Repro paketi immutable ve versioned olur; production Act Mode'u otomatik açmaz.
14. `NOT_APPLICABLE`, `NOT_MEASURED`, `REQUIRED_PENDING` rozetlerini ayrı anlatma.
15. Domain Pack/version, semantic macro ve entity binding provenance.
16. Continue Gate satisfied nedeni/zamanı ve Final Oracle pending/terminal timeline'ı.
17. Expected/interrupt wait request/match/ambiguity/timeout/cancel timeline'ı.
18. Canonical technical evidence ile derived domain fact arasındaki trace.
19. Lifecycle, business verdict, termination reason, cleanup result ve operational
    disposition'ı ayrı alan/rozetlerle gösterme; cleanup failure business PASS'i
    görsel olarak overwrite etmez.
20. Step action/gate/oracle/cleanup sonuçlarını ayrı timeline ve failure reason ile
    sunma.
21. Fact delivery lane, receipt/ordered cursor, derived DAG/reducer version ve pinned
    pack bundle digest provenance'ı.
22. Evidence source kind/authority/correlation/freshness/conflict görünümü.
23. Application/Screen/Surface/Launch Profile version ve provenance görünümü.
24. B.16 Evidence Journey drawer: dokuz stage, state/reason, authority/confidence ve
    WAL/inbox/cursor/reducer/fact/Oracle raw evidence deep-link'leri.
25. Compact görünümde yalnız occurrence-applicable plane badge'leri; detail'de dört
    plane ve explicit `NOT_APPLICABLE/NOT_MEASURED/REQUIRED_PENDING` sunumu.
26. Badge transition'larını birbirinden bağımsız persisted revision'dan üretme;
    dekoratif UI→App→Local→Remote sıralı animasyon kullanmama.
27. Interaction origin'i `BRIDGE_INJECTED/MANUAL/UNKNOWN`, confidence ve source
    evidence ile gösterme; origin filtresi ve human/automation ayrımı.
28. Exact repro semantiği: command/response/artifact gerçekten yakalanmışsa ekleme,
    yoksa `NOT_CAPTURED`; historical full dump reconstruction iddiası yapmama.
29. Failure-triggered scoped dump/screenshot nedeni, scope'u, quota/redaction/RBAC ve
    retention sonucunu repro manifest'inde gösterme.

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
15. `wait_any` active worker/request, cancel/match/ambiguity/timeout/interrupt,
    evaluation/event-rate ve recovery-scan metriği.
16. Full-dump diagnostic sayısı/boyutu; hot-path full-dump violation alarmı.
17. Continue Gate latency ile Final Oracle latency'yi ayrı ölçme.
18. SDK observation received/canonicalized/coalesced/dropped/rate-limited ve payload
    budget metriği.
19. Evidence source conflict/stale/correlation-miss/fallback kullanım metriği.
20. Domain Pack load/compatibility/migration/compile error metrikleri.
21. Page route/render/data-source latency, availability/blocked reason ve target DTO
    error metrikleri.
22. Compatibility adapter kullanım oranı, owner/expiry ve legacy-source violation
    alarmı.
23. Navigation/deep-link/404, auth-context mismatch ve page acceptance trend'i.
24. Receipt dispatch/lag/cursor ile ordered processing/lag/dead-letter metriklerini
    ayrı izleme.
25. Command admission lane active/queued/rejected/starvation/queue-age ve mutation
    owner metrikleri.
26. Initial/event/mutation/safety/event-loss wait evaluation reason, safety-rescan
    interval/rate/CPU ve budget violation metrikleri.
27. Cleanup failure/verdict ayrımı, operational attention ve cleanup retry metriği.
28. Derived DAG/reducer replay/cycle, active-run pin mismatch ve bundle integrity
    metrik/alarmı.
29. Evidence Journey stage latency/state/reason dağılımı; `NOT_OBSERVED` ile `FAILED`
    metriklerini ayrı tutma ve unsupported root-cause inference alarmı.
30. SDK diagnostic outcome query rate/size/age; WAL no-space/write-failure sayaçları
    ile host absence metriğini birbirine karıştırmama.
31. Interaction origin/confidence, injected/manual/unknown hacmi ve human baseline
    exclusion metriği.
32. Repro capture requested/captured/skipped/failed, scope/size/quota/redaction ve
    `NOT_CAPTURED` oranı; hot-path full-dump ihlaliyle birlikte izleme.

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
11. Domain Pack bundle integrity, immutable publish ve active-run digest pinning.
12. Runtime arbitrary pack code execution deny; future third-party capability kapalı.
13. Inspector takeover/manual-touch audit ve device mutation ownership.
14. Bridge response/frame fuzz.
15. Dependency/security scan ve threat model.
16. Platform RBAC, Nesy Dashboard auth ve SDK run-session auth context'lerini ayrı
    policy/badge/audit alanlarıyla uygulamak.
17. Domain Pack read/edit/validate/publish/migrate/archive permission'larını ayırmak.
18. Page mutation endpoint'lerinde UI gizlemesinden bağımsız server-side authorization.

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
11. İki eşzamanlı mutation/Inspector Act admission ve fairness DUT testi.
12. Mutation sırasında active wait generation invalidation/re-evaluation DUT testi.
13. Accessibility event suppression + scoped safety-rescan liveness/CPU DUT testi.

## D.19 Maestro Ölçümü ve Projeden Tam Söküm

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
16. Runtime feature flag, fallback branch ve environment variable'ları silme.
17. Package manifest, lockfile ve container/image kurulumlarından dependency'yi silme.
18. API route, DTO, type, enum, serializer ve response alanlarını silme.
19. `yamlContent` ve `maestroOutput` dahil Prisma alanlarını drop etme.
20. Korunacak eski run verisini engine-neutral artifact/archive modeline taşıma.
21. Engine-specific historical renderer'ı silme; generic legacy summary kullanma.
22. Test, mock, snapshot, fixture ve test helper'larını silme veya BridgeFlow'a dönüştürme.
23. Script, CI job, shell command, env örneği ve runbook talimatlarını silme.
24. Translation, label, icon, route ve kullanıcı metinlerini silme.
25. Aktif Cockpit dokümanlarındaki eski mimari/yürütme talimatlarını kaldırma;
    bu master plan yalnız karar geçmişini ve söküm kanıtını taşır.
26. Prisma migration geçmişi için güvenli baseline/squash planı:
    - tüm ortamlar drop migration'ını uygulamış olmalı,
    - DB backup ve row/checksum kanıtı alınmalı,
    - DB owner onayı olmadan migration geçmişi yeniden baselane edilmemeli,
    - tamamlandığında aktif migration zinciri engine-specific kolon yaratmamalı.
27. `rg`, dependency graph, lockfile, generated Prisma client, build output ve container
    taramasıyla repo-wide zero-structure gate.
28. Binary/process testi: Cockpit host'ta eski CLI bulunmasa dahi tüm suite yeşil.

### “Tamamen kaldırıldı” tanımı

Geçiş sonunda aşağıdakilerin hiçbiri bulunamaz:

- Çalıştırılabilir kod veya import.
- Executor/adapter/driver.
- CLI binary çağrısı veya PATH varsayımı.
- NPM/package/lockfile/container dependency'si.
- Feature flag, fallback veya environment variable.
- YAML compiler, preview, download veya generated artifact.
- API route/DTO/type/enum.
- Prisma model alanı veya yeni aktif migration'da engine-specific kolon.
- UI component, label, menu, icon veya yardım metni.
- Field Login/Load Tour özel orchestrator'ı.
- Test helper, mock, fixture veya snapshot.
- CI job, script veya operasyon runbook'u.
- Engine-specific historical run renderer.

Bu plan dosyasındaki ad, söküm kararını ve tarihsel gerekçeyi belgelemek içindir;
canlı proje yapısı veya uyumluluk istisnası değildir.

### Zero-structure gate

Checkpoint 9'da aşağıdaki sınıfların tamamı taranır:

```sh
# Canlı uygulama, paket, script, config, CI, test ve schema içinde sıfır eşleşme.
git ls-files -z -- apps packages scripts .github package.json pnpm-lock.yaml \
  turbo.json 'Dockerfile*' 'docker-compose*.yml' \
  | xargs -0 rg -n -i \
      'maestro|MAESTRO_HOME|yamlContent|maestroOutput|no-reinstall-driver'

# Dosya/dizin adında sıfır eşleşme.
git ls-files | rg -i 'maestro'

# Aktif dokümanlarda eski kullanım talimatı sıfır; bu master plan karar geçmişi
# olduğu için denetim raporunda ayrı sınıflanır, uygulama istisnası sayılmaz.
find docs -type f ! -name 'VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md' -print0 \
  | xargs -0 rg -n -i 'maestro'
```

Bu komutların başarısı tek başına yeterli değildir. Ayrıca:

- Lockfile/dependency graph eski paketi transitif olarak taşımamalı.
- Build image ve host PATH'inde eski CLI'ya ihtiyaç olmamalı.
- Generated Prisma client eski alanları taşımamalı.
- Production DB şeması eski kolonları taşımamalı.
- UI route/translation bundle'ında eski isim bulunmamalı.
- BridgeFlow unit/integration/device suite'i eski CLI sistemde kurulu değilken geçmeli.
- Engine-neutral arşive taşınan row/artifact sayısı kaynak sayıyla checksum üzerinden eşleşmeli.

## D.20 Product-shell borcu — ayrı backlog

SDK/Bridge platformu dışında:

- `home/*` dokuz placeholder route.
- `engineering/screen-manual` zayıf/placeholder.
- Settings dropdown var, route yok.
- PM Calendar boş hero.
- Roadmap boş hero.
- D.11A ile açıkça çözülmeyen diğer nav/page drift'leri.

Bu kalemler envanterde tutulur fakat Faz 0–8 correctness/security gate'lerini
bloke etmez. Faz 9 sonunda ayrı ürün roadmap'ine atanır.

`/engineering/modernization-plan` artık bu backlog'a dahil değildir; D.11A kapsamında
checkpoint/evidence dashboard'u olarak uygulanır. `/pm/root-cause` orphan durumu da
D.11A kapsamında navigasyona eklenerek çözülür.

**Kapsam ayrımı:** Platform CP0–CP9 DONE olabilirken yukarıdaki placeholder ürün
sayfaları tamamlanmamış olabilir. “Platform tamamlandı” ifadesi “Cockpit'teki bütün
ürün sayfaları tamamlandı” anlamına gelmez; release raporu bu iki sonucu ayrı verir.

## D.21 Opsiyonel İz C — AI Design Audit ve Post-run Açıklama

Bu iz BridgeFlow v1, CP0–CP9 veya platform release için blocker değildir.

### AI Design Audit

Hedef akış:

```text
Figma/Zeplin veya design source
  + Bridge hierarchy/fingerprint
  + source-code metadata
  + veri şeması
  -> LLM rule önerisi
  -> schema validation
  -> insan review/onayı
  -> versioned deterministic expected_rules
```

Kurallar:

1. LLM çıktısı doğrudan workflow/runtime'a girmez.
2. Çıktı typed `expected_rules` sözleşmesine çevrilir.
3. Rule source provenance, confidence, model/version ve reviewer taşır.
4. İnsan onayı olmadan paylaşılan test library'ye publish edilmez.
5. Runtime yalnız deterministic rule'u çalıştırır.
6. Design/source erişimi tenant ve RBAC ile sınırlandırılır.
7. Üretilen selector `TargetFingerprint` kurallarını geçmek zorundadır.

### Post-run LLM açıklaması

```text
Deterministic Oracle result
  -> redacted structured evidence
  -> optional LLM explanation
```

Kurallar:

1. LLM hükmü veya result code'u değiştiremez.
2. Raw log yerine allowlist'li structured evidence kullanır.
3. Her teşhis iddiası evidence link'i ve confidence taşır.
4. Model, prompt version, tenant policy ve üretim zamanı audit edilir.
5. AI unavailable olduğunda run sonucu değişmez.
6. Screenshot, dump veya D3 artifact explicit policy olmadan prompt'a girmez.
7. Açıklama “AI-generated, non-authoritative” olarak işaretlenir.

### İz C kabul kriteri

- Deterministic result öncesi veya sırasında model çağrısı yok.
- Aynı evidence olmadan LLM yeni pass/fail iddiası üretemiyor.
- Evidence link'leri gerçek artifact/step occurrence'a çözülüyor.
- Redaction ve tenant isolation testleri yeşil.
- İz C tamamen kapalıyken CP0–CP9 davranışı değişmiyor.

## D.22 Evidence Journey Diagnostic Runtime

Amaç, “beklenen evidence gelmedi” durumunu source sınırlarını aşmadan ve kanıtsız
kök neden üretmeden açıklamaktır.

### Contract ve persistence

1. B.16 `EvidenceJourneyStage/State/Entry` shared contract'ı ve schema versioning.
2. Journey identity'nin run/session/epoch/occurrence/fact ile deterministik bağlanması.
3. Stage entry'lerinin append-only evidence ref ve revision ile persist edilmesi.
4. `DIRECT/DERIVED/INFERRED` authority ve `CERTAIN/BOUNDED_INFERENCE/UNKNOWN`
   confidence validasyonları.
5. `NOT_OBSERVED`, `UNKNOWN`, `PENDING`, `BLOCKED` ve `FAILED` state'lerini birbirine
   dönüştüren izinli transition tablosu.
6. Aynı stage için çelişen direct evidence'da `EVIDENCE_STAGE_CONFLICT`; eski kaydı
   overwrite etmeyen conflict set'i.
7. Evidence retention sona erdiğinde stage'i sahte failure yapmadan
   `source_expired` provenance'ıyla sunma.

### Source adapter'ları

8. SDK explicit caller-reported outcome ve bounded diagnostic state/query adapter'ı.
9. SDK WAL append/skip/no-space/write-failure counter ve last-outcome snapshot'ı;
   query rate/payload/redaction bütçesi.
10. Authenticated transport/session/socket diagnostic adapter'ı.
11. Durable inbox commit/ACK record adapter'ı.
12. Receipt cursor/dispatch ve Ordered cursor/gap/dead-letter adapter'larını ayrı
    stage'lere bağlama.
13. Domain Pack normalization input/output/error ve reducer provenance adapter'ı.
14. Correlation/freshness/conflict resolver decision adapter'ı.
15. Continue Gate/Final Oracle requirement evaluation/deadline adapter'ı.

### Classifier ve read model

16. Stage classifier yalnız kayıtlı rule + evidence ref ile karar verir; global
    “event missing → SDK failed” fallback'i yoktur.
17. Bir sonraki stage confirmed iken önceki stage kaydı eksikse, yalnız contract
    mantıksal olarak garanti ediyorsa bounded `DERIVED` confirmation üretir.
18. Receipt confirmed/ordered blocked, ordered confirmed/normalization failed,
    normalized/correlation miss ve correlated/evaluation pending kararlarını ayrı
    açıklama kodlarıyla üretme.
19. “En son kesin doğrulanan stage”, “ilk kanıtlı failure/blocker” ve “bilinmeyen
    aralık” alanlarını döndüren versioned `EvidenceJourneyQuery`.
20. Stage summary'den raw WAL/inbox/cursor/reducer/fact/Oracle evidence'ına RBAC'li
    deep-link.
21. Historical benchmark veya oranı current journey diagnosis içine katmama.
22. Journey recomputation'ın versioned classifier ile deterministic olması; eski
    run'da kullanılan classifier version/provenance'ın korunması.

### Kabul kriterleri

- Host'ta event olmayan fixture kesin SDK failure üretmiyor.
- Explicit `NO_SPACE` yalnız WAL acceptance stage'ini fail ediyor.
- WAL row + inbox yok senaryosu transport/ingest aralığını unresolved gösteriyor.
- Inbox/receipt confirmed + ordered gap senaryosu evidence kaybı değil blocked
  ordered processing olarak görünüyor.
- Correlation miss, SDK/WAL failure diye etiketlenmiyor.
- Caller raporlamıyorsa exact `EmitOutcome` uydurulmuyor.
- Diagnostic query event recursion veya observation budget ihlali üretmiyor.

## D.23 Evidence Presentation, Interaction Origin ve Repro

Bu iş paketi B.17'nin API ve ekran uygulamasıdır. D.22 read model'i olmadan live
badge/animation tamamlandı sayılamaz.

### Layer presentation

1. WorkflowIR v2/BridgeFlowPlan'dan occurrence layer-applicability snapshot üretme
   ve immutable persist etme.
2. `RunDetailQuery`/history/editor preview DTO'larına applicability obligation,
   layer state, evidence revision ve source provenance ekleme.
3. Compact node'da yalnız applicable UI/App/Local/Remote badge'leri.
4. Detail drawer'da dört katmanın tamamı ve `NOT_APPLICABLE`, `NOT_MEASURED`,
   `REQUIRED_PENDING`, `PASSED`, `FAILED`, `WARNING`, `INCONCLUSIVE` açıklaması.
5. Queue'yu Local subtype, App State'i App source olarak alt detayda gösterme; yeni
   plane/badge üretmeme.
6. Component default'u ile compiled snapshot çeliştiğinde snapshot'ı authority kabul
   eden contract/browser testi.
7. Badge state'ini persisted revision üzerinden bağımsız güncelleme; stale reconnect
   payload'ının yeni state'i geri alamaması.
8. Badge animation'ın chronology iddiası taşımaması; gerçek sıranın clock uncertainty
   ile waterfall/Evidence Journey'de gösterilmesi.

### Interaction origin

9. Bridge action lifecycle/requestId/target/device monotonic interval adapter'ı.
10. Accessibility/manual-touch contamination evidence adapter'ı.
11. SDK InteractionCapture click'leri için correlation resolver; strong match yoksa
    `UNKNOWN`, ambiguous match'te confidence düşürme.
12. Origin ve confidence'ın Run Detail, Debug View Interactions, metric ve export'ta
    aynı contract ile sunulması.
13. Human interaction baseline/query'de active-run `BRIDGE_INJECTED` kayıtlarını
    hariç tutma; `UNKNOWN` için ayrı seri/filtre.
14. Exact per-event origin gerekiyorsa additive App Adapter/SDK diagnostic metadata
    capability'si; capability yoksa fail-open tahmin yerine `UNKNOWN`.

### Repro ve capture

15. Versioned `ReproCaptureManifest` ve `NORMAL_MINIMAL/ON_FAILURE_SCOPED/
    EXPLICIT_FULL_DIAGNOSTIC` policy evaluator.
16. Minimal pakette redacted exact command/response, requestId, target, treeGen,
    action lifecycle, clock, plan/pack/app version ve evidence ref'leri.
17. Ambiguity, timeout, unknown dialog/effect ve policy failure'da bounded scoped
    dump/screenshot trigger'ı; quota/cooldown/RBAC/redaction/retention sonucu.
18. Artifact yakalanmadıysa `NOT_CAPTURED`; capture başarısızsa reason; hiçbir
    durumda historical full-tree reconstruction iddiası yok.
19. Repro manifest/artifact hash immutability ve expiry sonrası tombstone/provenance.
20. Secret/PIN/token, full network body ve gereksiz bulk business data'nın export'a
    girmediği security testleri.

### Drawer-first teslim sırası

21. Increment 6A: D.22-backed Evidence Journey/detail drawer ve exact repro export.
22. Increment 6B: aynı read model'den static compact/detail layer badge'leri.
23. Increment 6C: live subscription, revision/reconnect/race testleri ve yalnız state
    transition'ını belirten bağımsız animasyon.
24. 6A kabul edilmeden 6B; 6B race/static acceptance geçmeden 6C release edilmez.

### Kabul kriterleri

- Compact ve detail görünüm aynı occurrence snapshot'ından tutarlı sonuç üretiyor.
- UI/App/Local/Remote arrival sırası değişse de badge yanlış chronology göstermiyor.
- Bridge action click'i manual sayılmıyor; korelasyonsuz SDK click `UNKNOWN` kalıyor.
- Human baseline automation injection ile şişmiyor.
- Normal successful step full dump üretmiyor.
- Failure scoped capture mevcutsa repro'ya hash/ref ile giriyor; yoksa açık
  `NOT_CAPTURED` görünüyor.
- Drawer ham evidence deep-link'lerinden kanıtsız kök neden metni üretmiyor.

## D.24 Test Profile Catalog ve Campaign Runtime

Bu iş paketi Nesy Cockpit v1'in günlük kalite operasyonunu ürünleştirir. Amaç yeni bir
test motoru yazmak değildir; aynı deterministic runtime'ı profillenmiş koşumlara
dönüştürmektir.

### Contract ve registry işleri

1. `packages/domain-pack-contracts` içine `TestProfileDefinition`,
   `TestCampaignDefinition`, `RepetitionPolicy`, `DatasetPolicy`, `DeviceMatrixPolicy`,
   `FaultPlan`, `TelemetryPolicy` ve `DifferentialPolicy` tiplerini eklemek.
2. Domain Pack publish validator'ının test profile referanslarını doğrulaması:
   workflowRef, launchProfileRef, finalOracleRef, datasetRef, deviceMatrixRef,
   requiredCapabilities ve scheduleClasses.
3. Profile kind bazlı policy validation:
   - `SMOKE` kısa, deterministic ve release-safe olmalı.
   - `DIFFERENTIAL_REGRESSION` baselineBuildRef taşımadan publish edilemez.
   - `RECOVERY` ve `STATE_AWARE_BAD_DAY` faultPlan taşır; trigger correlation zorunludur.
   - `LOAD` ve `SOAK` PerformanceBudget referansı olmadan release gate olamaz.
   - `BASIC_ACCESSIBILITY_PREVIEW` ve `SMART_EXPLORER_PREVIEW` releaseGate=false olmak
     zorundadır.
4. Profile bundle digest'ini Domain Pack immutable bundle hash'ine dahil etmek.
5. Active run ve campaign başlangıcında profile version/digest pinlemek; hot reload'ın
   aktif koşuma etki etmemesini sağlamak.

### Runtime işleri

6. `TestProfileExpansionService`: profile'ı existing WorkflowIR/BridgeFlow run input'una
   çevirir; ayrı engine/runner path'i oluşturmaz.
7. `TestCampaignService`: build/environment/schedule/profile matrix'ten run request'leri
   üretir, stopPolicy uygular ve campaign cell state'lerini persist eder.
8. Repetition ve soak state machine'i: repetition index, failure streak, duration
   deadline, stopOnFirstFailure ve maxConsecutiveFailures.
9. State-aware fault executor: fact/surface/source/step occurrence trigger'ı gözler,
   correlation doğrular ve fault action'ı run policy içinde uygular.
10. Differential comparator: baseline ve candidate run'ların fact sequence, Oracle
    requirement, Evidence Journey ve PerformanceBudget farklarını açık diff modeliyle
    üretir.
11. Compatibility matrix evaluator: device cell bazında PASS/FAIL/BLOCKED/INCONCLUSIVE
    üretir; tek cihaz sonucunu bütün matrise yaymaz.
12. Campaign releaseGateResult hesaplayıcı:
    - core release profile failure → `NO_GO`,
    - preview failure → `NEEDS_ATTENTION` veya `PREVIEW_ONLY`,
    - blocked prerequisite → `NEEDS_ATTENTION`/`NO_GO` policy'ye göre.

### Cockpit UI işleri

13. `/automation/test-profiles` catalog: kind, core/preview, releaseGate, last result,
    required capabilities, owner, pack version ve blocked reason.
14. `/automation/test-profiles/[profileId]` detail: workflow, launch profile, dataset,
    repetition, fault, device matrix, telemetry, Oracle, schedule, validation ve
    provenance.
15. `/automation/test-campaigns` list: PR/nightly/weekly/release campaign geçmişi,
    buildRef, environment, status ve releaseGateResult.
16. `/automation/test-campaigns/[campaignId]` matrix: profile x device/dataset cell,
    failedCells, evidenceSummaryRef ve run detail deep-link'leri.
17. Domain Pack manager içinde `Test Profiles` tab'i: draft/published profile listesi,
    validation, migration ve immutable publish davranışı.
18. Workflow Editor'da “Run as profile” seçimi: operator aynı workflow'u ad-hoc run veya
    Test Profile policy'siyle çalıştırabilir; preview profile release gate gibi
    gösterilmez.

### Nesy v1 profile içerikleri

19. `nesy.smoke.core`: app aç, login, route/schedule, stop list, shipment, delivery
    başlat/geri dön; UI/App/Local/Remote readiness + crash/ANR yokluğu.
20. `nesy.regression.critical`: login/session, route/schedule, normal delivery, COD,
    multicolli, partial/refuse, offline delivery, queue flush, payment, fiscal, scanner,
    pickup ve tour start/end.
21. `nesy.regression.differential`: previous build ve candidate build arasında critical
    fact sequence, Oracle requirement ve Evidence Journey diff.
22. `nesy.recovery.*`: payment/fiscal/process kill, delivery persist öncesi kill, queue
    flush kill, token expire, offline→online recovery ve Room write restart.
23. `nesy.bad-day.state-aware-short`: network disconnect/reconnect, latency/timeout,
    backend 500/timeout, permission revoke, timezone ve low storage fault'ları.
24. `nesy.contract.consistency`: HTTP schema + used fields + local state + remote
    business outcome consistency.
25. `nesy.load.normal-60-stop` ve `nesy.load.busy-120-stop`: route load, stop list
    readiness, scroll/jank, search/filter, delivery duration, memory, Room query ve
    queue flush.
26. `nesy.compatibility.field-devices`: Datecs, Urovo, Samsung low segment, emulator,
    Android min/current ve scanner/printer/payment/fiscal capability matrix.
27. `nesy.security.release-isolation`: release APK automation SDK/provider/receiver,
    HMAC, secret replay, redaction, named-query allowlist, Bridge scope ve PIN/token/log
    leak kontrolleri.
28. `nesy.soak.short`: 30-60 dakika tekrar eden delivery/payment/queue döngüsü; memory
    slope, thread/fd trend, queue residual, crash/ANR ve business consistency.

### Kabul kriterleri

- Core v1 profilleri published Nesy Courier Domain Pack bundle'ında versioned ve valid.
- Test Profile compilation aynı workflow/input ile deterministic plan hash üretir.
- Profile yeni engine/runner/service path'i açmadan `WorkflowRunApi` ve
  BridgeFlowExecutor üzerinden çalışır.
- Fault trigger correlation yoksa Recovery/Bad Day profile fail-closed olur.
- Differential Regression missing critical fact'i UI yeşil olsa bile failure/attention
  olarak raporlar.
- Campaign matrix her cell için gerçek run/evidence deep-link'i taşır.
- Preview profile release GO/NO_GO sonucunu değiştirmez.
- Security/Release Isolation profile release candidate için fail-closed çalışır.

## D.25 Feature Blueprint, Capability Contract, Run Planner ve Test Data Broker

Bu iş paketi Maçkolik Domain Pack genişlemesi için zorunlu hazırlıktır; Nesy'deki
yüksek hacimli kurye/parcel/payment/offline queue senaryolarını da aynı modelle
ölçekler.

### Contract ve registry işleri

1. `packages/domain-pack-contracts` içine yalnız Domain Pack authoring/executable
   contract tiplerini eklemek:
   `FeatureAuthoringMetadata`, `FeatureExecutableContract`, `FeatureBlueprint`,
   `FeatureInvariant`, `ComponentDefinition`, `CapabilityContract`,
   `IndependentTestWorkflowDefinition`, `ReusableFlowFragmentDefinition`,
   `SemanticAction`, `MacroDefinition`, `DomainDependencyRef` ve `DomainImpactRef`.
2. `packages/execution-contract` içine execution/orchestration tiplerini eklemek:
   `RunManifest`, `TestExecution`, `ExecutionLifecycle`, `ProductVerdict`,
   `EvaluationFailureClass`, `SchedulerDisposition`, `TerminationReason`,
   `WorkflowCleanupResult`, `ResourceReleaseResult`, `OperationalDisposition`,
   `Lease`, `ResourceRequirement`, `IsolationLevel`, `ResourceLease`,
   `ResourceState`, `DependencyExecutionState` ve `SchedulerPolicy`.
3. `packages/impact-contract` içine impact/coverage selection tiplerini eklemek:
   `ImpactGraph`, `ChangeReference`, `CoverageReference`, `SelectionReason`,
   `ImpactedWorkflowRef` ve `CoverageNodeRef`.
4. Domain Pack manifest'ine `features`, `components`, `capabilities`,
   `testWorkflows`, `flowFragments`, `resourcePools` ve `impactRefs` bölümlerini
   additive eklemek; `resourcePools` executable lease state değil, yalnız resource
   ihtiyacı ve domain fixture referansı taşır.
5. Capability Contract catalog v1 katmanları:
   - `verdict.capabilities.core`: `HorizontalCarousel`, `PaginatedFeed`,
     `DeepLinkNavigation`, `RetryableContent`, `LiveUpdatingList`.
   - `nesy.capabilities`: `OfflineQueueAction`, `ScannerInput`,
     `PaymentConfirmation`, `FiscalConfirmation`, `LocalRemoteConsistency`.
   - `mackolik.capabilities`: `SingleChoiceReaction`, `AsyncConversation`,
     `SubscriptionGate`, `AdSlot`, `BettingWebView`.
6. Capability promotion kuralı:
   domain capability ancak iki bağımsız domain'de aynı semantics/evidence sınırıyla
   ispatlanırsa core/shared kataloğa terfi eder.
7. Feature Blueprint schema iki parçalıdır:
   `FeatureAuthoringMetadata` owner/risk/açıklama/labels/doc refs taşır;
   `FeatureExecutableContract` entry point, fixture, screen, component, capability,
   invariant, workflow, evidence policy, target binding ve oracle refs taşır.
8. Run manifest yalnız `FeatureExecutableContract` digest'ini pinler; authoring
   metadata değişikliği execution plan hash'ini değiştirmez.
9. AI-suggested invariant authority modeli:
   `AI_SUGGESTED` release gate'e bağlanamaz; `PRODUCT_APPROVED` veya
   `TECHNICAL_DEFAULT` olmalıdır.
10. Reusable Flow Fragment ile Independent Test Workflow ayrımını typed contract'a
   eklemek; fragment terminal product verdict üretemez.
11. Test Workflow dependency contract'ı:
   prerequisite failure → dependent workflow `BLOCKED`, sahte `FAILED` değil.
12. Domain Pack executable contract yalnız `ResourceRequirementRef` ve
   `DomainDependencyRef` beyan eder; lease, heartbeat, retry ve scheduler state
   execution contract'tadır.
13. Impact Graph refs:
   feature/screen/component/capability/API/module/repository path/analytics event/
   remote config/evidence source.

### Runtime işleri

14. `RunManifestService`: Test Suite/Campaign başladığında immutable manifest üretir;
    campaignId, manifestId, workflow versions, pack digest, executable blueprint
    digest, App Adapter digest, launch/test profile version, dataset/fixture version,
    fault plan version, Oracle template digest, Evidence Source Registry digest,
    Performance Budget version, remote environment snapshot, device capability
    snapshot, resource plan digest, compiler version, WorkflowIR schema version,
    Bridge protocol version ve SDK protocol version'ı pinler.
15. `TestExecutionQueue`: tek `status` union'ı yerine ayrı eksenler kullanır:
    `ExecutionLifecycle`, `ProductVerdict`, `EvaluationFailureClass`,
    `SchedulerDisposition`, `TerminationReason`, `WorkflowCleanupResult`,
    `ResourceReleaseResult` ve `OperationalDisposition`.
16. Lease/heartbeat/timeout/retry:
    worker ölümü veya API restart sonrası non-terminal execution recovery.
17. `LEASE_EXPIRED`, `UNKNOWN_EFFECT`, `RECONCILIATION_REQUIRED` ve `ORPHANED`
    ayrımı; non-idempotent fiziksel action sonrası otomatik retry yasağı.
18. Dependency evaluator:
    prerequisite terminal failure, missing resource veya fixture hazırlanamaması
    durumunda doğru `BLOCKED_*` reason üretir.
19. `TestDataBroker`: account, app data, backend fixture, remote config, payment/fiscal,
    ad state, premium/subscription, courier route/stop veya transfer card reaction
    gibi kaynakları lease eder.
20. Resource lifecycle:
    `CLEAN`, `DIRTY`, `QUARANTINED`, `RECONCILIATION_REQUIRED`,
    `MANUAL_RELEASE_REQUIRED`.
21. Conflict scheduler:
    aynı exclusive resource üzerinde iki mutation'ı paralel başlatmaz.
22. Cleanup/release:
    leased resource success/failure/cancel sonrası reset, quarantine veya destroy
    policy'siyle kapanır.
23. Impact selection:
    PR/build değişikliklerinden doğrudan/dolaylı feature workflow selection üretir;
    bu selection Test Profile/Campaign runtime'ına ek execution listesi olarak girer.
24. Long workflow checkpoint resume guard:
    checkpoint'ten devam yalnız user/build/screen/entity/backend fixture/session
    doğrulanabiliyorsa yapılır; değilse küçük test baştan koşar.

### Cockpit UI işleri

25. Automation altında `Feature Registry` route'u:
    feature/domain/owner/risk, coverage, health, last failure ve impacted workflow listesi.
26. `Component Registry`:
    component instance, screen, capability ref, target ref ve visual/performance baseline.
27. `Capability Contracts`:
    reusable contract catalog, generated scenario list, required targets/evidence ve
    failure modes.
28. `Workflow Library`:
    Independent Test Workflow ve Reusable Flow Fragment ayrımı; fragment'lar verdict
    gibi gösterilmez.
29. `Test Suites`:
    suite/run plan composition, dependency graph, schedule, profile ve device matrix.
30. `Run Planner`:
    manifest preview, selected tests, skipped/blocked reason, resource conflicts,
    parallelization plan ve impact selection açıklaması.
31. `Execution Queue`:
    execution state, lease owner, retryable/orphaned işler, heartbeat ve recovery action.
32. `Coverage Graph`:
    product/domain/feature/screen/component/capability/test/evidence coverage.

### Maçkolik hazırlık işleri

33. `MACKOLIK_DOMAIN_PACK_REFERENCE_V1` içinde ilk feature blueprint set'i:
    onboarding, transfer agenda, match detail, betting tab, Maçkolik AI, news detail,
    ad/subscription ve push/deeplink platform feature'ları.
34. Transfer Agenda vertical slice:
    `HorizontalCarousel + SingleChoiceReaction + RemotePersistence` capability set'i,
    `only-one-reaction` ve `persist-reaction` business invariants.
35. Maçkolik AI vertical slice:
    `Modal + AsyncConversation` capability set'i, deterministic UI/session/timeout
    oracle ve opsiyonel semantic evaluation boundary.
36. Onboarding workbook'ten Feature Blueprint authoring:
    Splash, onboarding selection, personalization, notification permission, home
    preference impact feature'ları.

### Nesy genelleme işleri

37. Nesy Stop/Parcel/Payment/Queue feature blueprint'leri:
    `OfflineQueueAction`, `ScannerInput`, `PaymentConfirmation`,
    `LocalRemoteConsistency` capability contract'ları.
38. 120 stop veya çoklu parcel koşumları tek uzun suite değil, bağımsız occurrence
    workflow ve resource-aware run plan olarak modellenir.
39. Aynı courier account/route/payment fixture üzerinde conflict eden mutation'lar
    Test Data Broker lease'i olmadan paralel koşamaz.

### Kabul kriterleri

- Maçkolik ve Nesy için Feature Blueprint executable contract modeli aynı Core
  contract sınırını kullanıyor; metadata değişikliği executable digest'i oynatmıyor.
- Capability Contract catalog katmanlı; domain capability kanıtsız biçimde core/shared
  kataloğa terfi etmiyor.
- `domain-pack-contracts`, `execution-contract` ve `impact-contract` package sınırları
  contract testleriyle korunuyor; Domain Pack paketi execution queue common paketine
  dönüşmüyor.
- Run Manifest immutable; active suite/campaign sırasında workflow/profile/pack,
  executable blueprint, adapter, fixture, oracle, evidence source, device capability,
  resource plan ve protocol digest/version'ları değişmiyor.
- Execution Queue worker ölümü sonrası terminal olmayan işi etki durumuna göre
  `RETRYABLE`, `RECONCILIATION_REQUIRED` veya `ORPHANED` yapıyor; suite baştan
  başlamıyor ve non-idempotent action otomatik tekrarlanmıyor.
- Login/setup failure dependent workflow'ları `BLOCKED` yapıyor; independent public
  workflow'lar çalışmaya devam edebiliyor.
- Test Data Broker exclusive resource conflict'lerini engelliyor; reset edilemeyen
  resource'ları `QUARANTINED` veya `MANUAL_RELEASE_REQUIRED` yapabiliyor.
- AI-suggested invariant owner onayı olmadan release gate Oracle'ına bağlanamıyor.

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
    - commit→receipt ve commit→ordered-consumer latency
    - Bridge observation/mutation/wait/cancel latency
    - scoped dump maliyeti
    - workflow duration
14. Dirty worktree/branch state'ini checkpoint artifact'inde kaydet.
15. Mevcut `WORKSPACES`, App Router route, page data-source/API, redirect, placeholder,
    orphan ve auth-provider envanterini SHA-pinned baseline olarak üret.
16. Device model/API/build variant/thermal state/sample size/percentile metadata'sıyla
    `PerformanceBudget v1` draft'ını oluştur; eşikleri baseline görülmeden dondurma.
17. G.8 checkpoint work-package template'ini master plan version/hash doğrulamasıyla
    oluştur ve CP0–CP9 paket sahiplerini ata.

### CHECKPOINT 0

- `pnpm typecheck` yeşil.
- API ve web typecheck bağımsız yeşil.
- Control-channel, API ve web unit suite'leri yeşil.
- PostgreSQL ingest integration CI'da koşmuş ve yeşil.
- Skip edilen her test gerekçe/owner/gate taşır.
- Cockpit durum tablosu Mobile SSOT ile çelişmiyor.
- Bridge/workflow fixture hash'i kaydedilmiş.
- Yedi-workspace route/data-source baseline'i ve placeholder/orphan listesi
  `PageMigrationManifest` başlangıç fixture'ı olarak kaydedilmiş.
- Performance baseline ham ölçümleri profil/cihaz/sample metadata'sıyla kayıtlı;
  ölçülmemiş örnek sayı release eşiği yapılmamış.
- Checkpoint work-package template'i master plan hash drift'inde fail ediyor.
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

Durable kabul edilen event'in restart sonrası dahi hem commit-safe düşük gecikmeli
readiness hattından hem de sıralı/idempotent Oracle-audit hattından gözlemlenebilir
biçimde workflow'a ulaşmasını sağlamak.

### Neden bu sırada

BridgeFlowExecutor event bekleyecektir. Kalıcı subscriber olmadan executor
process yaşamına ve synchronous sink'e bağlı kalır.

### Yapılacaklar

1. D.2 işlerinin tamamı.
2. Commit-safe fan-out'u `DurableReceiptBus`, contiguous fan-out'u
   `OrderedEvidenceBus` olarak ayır.
3. Continue Gate receipt-safe adapter'ını ve Oracle ordered adapter'ını sync yoluyla
   karşılaştırmalı çalıştır.
4. Event equality/correlation report üret.
5. Restart bootstrap scanner.
6. Receipt dispatch ve ordered consumer lag/cursor health endpoint'leri.
7. Lane-aware `waitEvent` filter/cancel/timeout API'si.
8. Closed-run late event policy.
9. Poison event admin görünürlüğü.
10. Sync sink disable feature flag ve rollback prosedürü.
11. SDK tarafında recursive event üretmeyen bounded `EmitOutcome` diagnostic yüzeyi:
    append/skip/no-space/write-failure counter'ları, redacted last-outcome snapshot'ı
    ve rate-limited on-demand query/capability.

### CHECKPOINT 2

- Event DB commit edilmeden ACK yok.
- Process commit sonrası öldüğünde event restart'ta işleniyor.
- Process commit ile receipt publish arasında öldüğünde committed row receipt cursor
  üzerinden bulunuyor ve Continue Gate kaybetmiyor.
- Duplicate event tek logical evidence üretiyor.
- Burst sonunda unprocessed tail kalmıyor.
- Seq sırası korunuyor; gap körlemesine aşılmıyor.
- `waitEvent` process restart sonrası tamamlanabiliyor.
- Subscriber cancel memory/lease sızıntısı bırakmıyor.
- Poison row görünür ve cursor sessizce atlamıyor.
- Ordered gap/poison bağımsız `RECEIPT_SAFE` gate'i bloke etmiyor; aynı fact Final
  Oracle/audit authority'sini receipt lane'den almıyor.
- `ORDERED_REQUIRED` fact receipt subscriber'ına bağlanamıyor.
- Sync ve durable oracle sonucu golden suite'te eşit.
- Flag ile synchronous oracle yolu kapalıyken suite yeşil.
- Explicit SDK diagnostic query gerçek `EmitOutcome` varsa gösteriyor; caller sonucu
  raporlamamış ve WAL kaydı yoksa “kesin failure” yerine `NOT_OBSERVED/UNKNOWN` dönüyor.
- Diagnostic outcome görünürlüğü yeni durable outcome event'iyle recursion veya WAL
  basıncı üretmiyor; query rate/payload bütçesi geçiliyor.

**Checkpoint 2 sonrası:** synchronous sink production yolundan kaldırılabilir;
rollback yalnız açık feature flag ile ve süreli olabilir.

## FAZ 3 — Bridge Host Client ve Device Preflight

### Amaç

Cockpit'in Verdict Bridge protocol v1 ile güvenli ve typed biçimde konuşmasını,
çoklu cihazı hazırlamasını ve lab-only politikasını zorlamasını sağlamak.

### Neden bu sırada

Compiler/executor, doğrulanmış bir action primitive'i olmadan tasarlanmamalıdır.

### Yapılacaklar

1. D.3, D.4 ve generic Bridge tarafı için D.6D işlerinin tamamı.
2. Fake TCP Bridge server test harness.
3. Mobile Bridge fixture parity.
4. DeviceWorker BridgeDeviceManager entegrasyonu.
5. Dinamik host port lease store.
6. UI readiness DTO.
7. Gerçek DUT smoke script.
8. Bridge process kill/reconnect testi.
9. Screenshot artifact ve redaction.
10. Production deny testi.
11. TargetFingerprint resolution ve business rowKey fixture'ları.
12. Action lifecycle transition persistence.
13. `dispatchGesture` primary / allowlisted semantic action acceptance.
14. Generic `UiWaitPlan`, `wait_any` ve `cancel_request` protocol/client foundation.
15. Fake server ile long-wait sırasında aynı socket'te cancel, serialized writer,
    deadline/match/cancel race ve reconnect testleri.
16. Accessibility event-driven reevaluation; full-poll yasağı ve scoped recovery-scan
    ölçümü.
17. `register_watch`/unsolicited push'ın ilk B2 capability manifestinde bulunmadığını
    doğrulayan negative test.
18. Device Command Admission scheduler: control priority, bounded observation/heavy
    observation/wait ve tek mutation lane.
19. Initial wait evaluation, event gelmeyen safety-rescan, mutation invalidation ve
    active-run Inspector Act denial testleri.
20. Bridge action lifecycle'a injected gesture başlangıç/bitiş device monotonic
    marker'ları, requestId ve target fingerprint evidence'ı ekleme; manual-touch
    contamination evidence'ını injected interval'dan ayrı tutma.

### CHECKPOINT 3

- Protocol fixture parity yeşil.
- Partial/multiple/malformed/oversized NDJSON frame testleri yeşil.
- Her yeni connection handshake yapıyor.
- Aynı requestId aynı action'ı fiziksel olarak bir kez uyguluyor.
- Farklı payload aynı requestId ile conflict.
- Scoped dump eksikse full'a düşmeden fail.
- Ambiguous selector tap yapmıyor.
- Stale tree action yapmadan reddediliyor.
- `rowIndexHint` tek başına kalıcı hedef kabul edilmiyor; stable rowKey doğru satırı çözüyor.
- Her action terminal state'e kadar lifecycle transition üretiyor.
- Bridge response kaybında sonuç exactly-once varsayılmadan `UNKNOWN_EFFECT` oluyor.
- Sabit koordinat workflow'u reddediliyor; kullanılan dispatch yöntemi evidence'ta görünüyor.
- Screenshot artifact oluşuyor ve hassas log sızmıyor.
- İki cihaz aynı anda farklı host portlarıyla READY.
- Production device Act Mode kesin reddediliyor.
- Gerçek DUT command set smoke'u yeşil.
- `wait_any` capability handshake, expected/interrupt match ve `cancel_request`
  smoke'u yeşil.
- Uzun `wait_any` reader loop'u bloke etmiyor; cancel aynı socket'te zamanında
  işleniyor ve writer bozuk/interleaved NDJSON üretmiyor.
- Wait response küçük typed payload'dır; full dump taşımıyor.
- Hedef request başında zaten hazırsa Accessibility event beklemeden initial
  evaluation ile match oluyor.
- Event gelmese bile bounded scoped safety rescan hedefi buluyor; full-tree polling,
  rate/CPU budget ihlali veya sabit global interval yok.
- Aynı cihazda iki mutation paralel dispatch edilmiyor; control/cancel starvation
  yaşamıyor ve bounded observation limiti aşılamıyor.
- Mutation eski nodeRef/read sonucunu invalidate ediyor ve active wait'i yeni
  generation üzerinde reevaluate ediyor.
- Aktif automated run sırasında Inspector Act açık takeover olmadan reddediliyor.
- Run/socket kapanınca stale worker/index state'i kalmıyor.
- İlk B2 unsolicited `WATCH_*` frame veya persistent registration üretmiyor.
- Bridge-enjekte action response'u requestId/target/gesture interval taşıyor;
  manual-touch contamination aynı origin'e sessizce dönüştürülmüyor.

## FAZ 4 — WorkflowIR v2 → Domain Pack → Compiler

### Amaç

Maestro YAML'dan bağımsız, typed, açıklanabilir ve deterministik Cockpit beynini;
önce generic WorkflowIR v2, sonra Domain Pack, en son Domain-aware compiler sırasıyla
kurmak.

### Neden bu sırada

Domain Pack mevcut sınırlı IR'a göre yazılırsa Nesy-specific geçici tipler kalıcı
contract'a sızar. Bu nedenle önce generic WorkflowIR v2 tamamlanır ve kabul edilir;
sonra Domain Pack bu sabit contract'ın tüketicisi olarak yazılır. Compiler ancak
pack expansion ve compatibility sözleşmesi kabul edildikten sonra tamamlanır.

### FAZ 4A — WorkflowIR v2 tamamlama kapısı

1. D.5 ve D.6 işlerinin tamamı.
2. D.6A acceptance gate'inin tamamı.
3. Eski workflow config migration reader ve source map.
4. Generic IR golden serialization/hash snapshot'ları.
5. Continue Gate/Final Oracle typed policy ayrımı.
6. Occurrence/iteration/entity/event correlation contract'ı.
7. Courier ve ikinci bağımsız domain adına ait generic IR acceptance fixture'ları;
   production Domain Pack kodu olmadan domain-neutral union kanıtı.
8. Final Oracle için unified `OracleRequirement` ve eski paralel listelerden migration.
9. Run/step outcome eksenlerinin shared typed contract'ı.
10. Typed, allowlisted ve effect-aware `REMOTE_ACTION` / `EXTERNAL_ACTION` primitive'i:
    adapterRef, operationRef, input binding, idempotency class/key, occurrence/entity
    correlation, timeout policy, resource requirement, output fact binding ve
    reconciliation policy taşır. Primitive domain-neutral'dır; `Tour`, `Courier`,
    `ApproveTour` veya endpoint adı shared IR union'ına girmez.

**Kural:** Checkpoint 4A geçmeden Faz 4B Domain Pack implementation PR'ı merge
edilemez. Contract spike yapılabilir; production pack kodu ve Nesy-specific shared
IR type'ı yazılamaz.

### FAZ 4B — Domain Pack ve Nesy App Adapter

Faz 4B'nin critical path'i **CP4B-Core** olarak yorumlanır. Bu kapı Nesy vertical
slice için zorunlu Domain Pack çekirdeğini kapsar:

```text
Domain Pack manifest
Application/Screen/Surface/Entity/Target Registry
Semantic macro
Evidence Source Registry
Launch Profile
Minimal FeatureExecutableContract
Minimal CapabilityContract
Nesy reference spec
App Adapter
```

Şu scale işleri CP4B'yi bloklamaz:

```text
Run Manifest
Execution Queue
Lease/resume scheduler
Test Data Broker
Full Impact Graph
Full Coverage Graph
Full Component Registry
Cross-feature Maçkolik capability catalog
PR impact selection
```

Bu scale işleri ayrı hayali checkpoint adıyla izlenmez:

- Run Manifest, Execution Queue, lease/resume scheduler ve Test Data Broker mevcut
  CHECKPOINT 5 acceptance maddelerine bağlıdır.
- Full Impact Graph, full Coverage Graph, full Component Registry ve Maçkolik geniş
  capability catalog mevcut CHECKPOINT 6/7 acceptance maddelerine bağlıdır.

1. D.6B ve D.6C işlerinin tamamı.
2. `NESY_COURIER_DOMAIN_PACK_REFERENCE_V1` canonical vertical-slice spec'inin
   review edilmesi; `COURIER_LOGIN`, `SELECT_ROUTE`, `OPEN_STOP`, `PROCESS_PARCEL`,
   `COMPLETE_DELIVERY` ve `TOUR_APPROVAL_LIFECYCLE` için source-map, Generic IR ve
   BridgeFlowPlan snapshot'ları.
3. Control Plane Domain Pack registry/manifest/migration.
4. Formal Application/Screen/Surface/Entity/Target Registry.
5. Semantic action/macro, Domain Oracle, Evidence Source Registry ve formal Launch
   Profile tanımları.
6. Existing Mobile automation code'un App Adapter'a refactor edilmesi.
7. Named entity query, scanner mode ve fixture/session capability'leri.
8. Pack/app/adapter compatibility ve release-isolation kapıları.
9. Canonical technical evidence preservation + host-side semantic fact derivation.
10. Fact-specific authority/correlation/freshness, conflict ve HTTP transport/business
   fact ayrımı.
11. Target Resolution Provider Chain ve bounded entity-target binding.
12. SDK observation rate/payload/coalescing bütçesi ve release isolation testleri.
13. `DomainPackAdminApi` draft/version/validate/publish/migrate/compatibility DTO ve
    RBAC contract'ı; Phase 6 manager UI'nın tek backend kaynağı.
14. CI/publish compiler ile deterministic declarative bundle, canonical serialization,
    SHA-256 digest ve immutable published version.
15. Evidence source delivery lane validator ve Derived Fact DAG/cycle/idempotency/
    provenance contract'ı.
16. Run-start pack/registry/graph/reducer pinning ve active-run hot-reload isolation.
17. Test Profile contract, Test Campaign contract ve PR/nightly/weekly/release schedule
    class validation fixture'ları.
18. V1 core/preview profile policy validation: releaseGate, previewOnly, fault
    correlation, differential baseline ve performance budget requirement.
19. Nesy vertical slice için minimal FeatureExecutableContract, CapabilityContract,
    Independent Test Workflow ve Reusable Flow Fragment validation fixture'ları.
20. Domain Pack yalnız `ResourceRequirementRef`, `DomainDependencyRef` ve
    `DomainImpactRef` beyan eder; execution lease/scheduler state veya full
    ImpactGraph publish etmeye çalışırsa contract validation fail eder.
21. Nesy Backoffice Adapter contract'ı `nesy.backoffice.approve-tour.*`
    operationRef'lerini allowlist, typed input/output, audit, idempotency key,
    environment ve remote validator sözleşmesiyle taşır; raw HTTP script'i veya
    görünmeyen setup hook'u kabul edilmez.
22. `TOUR_APPROVAL_LIFECYCLE` için resource requirement:
    exclusive courier/account, exclusive backend tour fixture, mutation conflict
    group ve `RECONCILE_BEFORE_RELEASE` cleanup policy'si taşır.

**Kural:** Checkpoint 4B geçmeden tam Domain Pack expansion kullanan
BridgeFlowCompiler ve referans kurye planı kabul edilmez.

### FAZ 4C — Domain-aware BridgeFlowCompiler

1. D.7 işlerinin tamamı.
2. Domain macro → generic IR v2 expansion.
3. Generic IR v2 → BridgeFlowPlan + `UiWaitPlan` compilation.
4. Editor compile API, capability-aware errors ve human-readable preview.
5. Plan hash/source map ve pack/version provenance.
6. Tam kurye workflow'unu compile edecek node set'i.
7. TargetFingerprint strength/ambiguity/drift validation.
8. Typed business event/state/query capability validation.
9. Evidence required/optional/not-applicable ve Continue/Final policy compilation.
10. Application/Screen/Surface/Launch registry key ve app-version validation.
11. Evidence source authority/correlation/freshness capability compilation.
12. Fact delivery lane ve derived graph/reducer digest compilation.
13. Unified Oracle requirement compilation; paralel role/timing listesi rejection.
14. Test Profile → BridgeFlowPlan/run input expansion; profile yeni engine yaratmadan
    existing compiler path'ine açılır.
15. Fault trigger, differential policy, repetition ve telemetry source-map compilation.
16. Feature Blueprint/Capability Contract kaynaklı workflow selection ve generated
    scenario source-map compilation.
17. ResourceRequirementRef ve DomainDependencyRef compilation; exclusive resource
    ihtiyacı, unbounded dependency veya verdict üreten reusable fragment cihazdan
    önce reddedilir. Fiili lease/scheduling kararı CP5 execution-contract runtime'ına
    aittir.

### CHECKPOINT 4A — WorkflowIR v2 tamamlandı

- API ve Web aynı workflow type paketini kullanıyor.
- IR v2 schema/version/migration suite yeşil.
- Continue Gate ve Final Oracle ayrı typed policy.
- Final Oracle obligation/timing/deadline/onTimeout'u tek `OracleRequirement` içinde
  taşıyor; paralel required/eventual listeleri migration sonrası reddediliyor.
- Lifecycle/verdict/termination/cleanup/operational disposition ile step action/gate/
  oracle/cleanup outcome tipleri ortak contract'ta ayrı.
- Occurrence/iteration/entity/event correlation generic contract'ta mevcut.
- WorkflowIR v2 typed `REMOTE_ACTION` primitive'i içeriyor; primitive allowlisted
  adapter operation, effect/idempotency, correlation, resource requirement,
  output fact binding ve reconciliation policy taşırken shared IR'a Nesy business
  command/type sızdırmıyor.
- Shared IR'da Nesy-specific business type veya app class adı yok.
- Condition `eval` kullanmıyor; fuzz suite güvenli.
- TRUE/FALSE/UNKNOWN kararları kanıtla persist edilebilir DTO üretiyor.
- Generic 20-item `FOR_EACH` fixture'ı doğru iteration scope taşıyor.
- En az iki domain fixture'ı aynı generic IR union'larını kullanıyor; shared pakette
  `STOP/PARCEL/MATCH/BETTING` type'ı yok.

### CHECKPOINT 4B — Domain Pack tamamlandı

- Nesy Courier Domain Pack manifest/registry/migration suite yeşil.
- `NESY_COURIER_DOMAIN_PACK_REFERENCE_V1` mevcut, reviewed ve bundle testlerine bağlı;
  altı vertical slice canonical input/output, expansion, gates, oracle ve snapshots
  taşıyor: `COURIER_LOGIN`, `SELECT_ROUTE`, `OPEN_STOP`, `PROCESS_PARCEL`,
  `COMPLETE_DELIVERY`, `TOUR_APPROVAL_LIFECYCLE`.
- Application/Screen/Surface/Entity/Target kayıtları formal contract ve app-version
  compatibility taşıyor.
- Existing `NesyCommands`/state/query/event kodu tek App Adapter altında.
- Zorunlu entity query'leri bounded/redacted ve capability-gated.
- Scanner injection ve `DIRECT_STATE` release build'e sızmıyor.
- Domain macro'ları generic IR v2 dışına çıkmıyor.
- `OPEN_STOP` ve `COURIER_LOGIN` macro'ları reference spec'teki canonical expansion,
  Continue Gate, Final Oracle ve source-map snapshot'larıyla uyumlu.
- `TOUR_APPROVAL_LIFECYCLE` gerçek tur onayı testi ile precondition/setup modunu
  ayırıyor; setup modu push/UI/tur-onayı ürün PASS'i üretemiyor.
- Nesy Backoffice Adapter operation'ları typed/allowlisted/audited; iki servis çağrısı
  ve backend status validation ayrı remote fact olarak izleniyor.
- Bridge protocol veya Core shared package'ında `OPEN_STOP/COURIER_LOGIN/STOP/PARCEL/
  DELIVERY` gibi business command/type yok.
- Setup login ile gerçek `COURIER_LOGIN` ayrılmış; prepared/direct launch profile'ları
  login testi PASS'i üretmiyor.
- Raw evidence reducer nedeniyle kaybolmuyor.
- Canonical technical evidence ve normalized fact ayrı; derivation trace audit
  edilebiliyor.
- Evidence Source Registry primary/confirmatory/fallback authority, correlation ve
  freshness validation'ından geçiyor.
- HTTP 2xx tek başına business fact üretmiyor.
- Launch Profile giriş komutu expected screen/surface readiness olmadan PASS değil.
- Target Resolution Provider Chain ambiguity'de fail ediyor; rowIndex tek başına
  entity seçmiyor.
- Observation rate/payload/coalescing bütçesi event fırtınasında korunuyor.
- `DomainPackAdminApi` published version'ı immutable tutuyor; concurrent draft
  değişikliği conflict ve audit üretiyor.
- Pack/adapter mismatch cihaz action'ından önce fail.
- Published pack deterministic bundle ve SHA-256 digest taşıyor; runtime arbitrary
  TypeScript/JavaScript çalıştırmıyor.
- Derived fact dependency cycle/self/undefined input publish'i reddediyor; replay
  reducer-version bazlı idempotent provenance üretiyor.
- Aktif run pinned bundle/graph/reducer digest'iyle devam ediyor; hot reload yalnız
  yeni run'da etkili.
- Test Profile contract'ları Domain Pack bundle'ında versioned ve immutable.
- Preview profile releaseGate=false; Security/Release Isolation fail-closed.
- Recovery/Bad Day fault trigger correlation olmadan publish/preflight geçmiyor.
- Differential profile baseline build ve critical fact diff policy taşımadan publish
  edilemiyor.
- Feature Blueprint business invariant'ları authority taşıyor; `AI_SUGGESTED`
  invariant owner onayı olmadan release gate'e bağlanamıyor.
- Reusable Flow Fragment terminal feature verdict'i üretemiyor; Independent Test
  Workflow ayrı occurrence/evidence/oracle snapshot'ı taşıyor.
- FeatureAuthoringMetadata değişikliği executable bundle digest'ini değiştirmiyor;
  FeatureExecutableContract değişikliği deterministik digest değişikliği üretiyor.
- CP4B-Core, Run Manifest/Execution Queue/Test Data Broker/full ImpactGraph/full
  CoverageGraph tamamlanmadığı için fail edilmiyor; ancak Domain Pack bu kavramların
  execution state'ini kendi manifest'ine gömmeye çalışırsa fail ediyor.
- `packages/domain-pack-contracts` içinde `RunManifest`, `TestExecution`, `Lease`,
  `ResourceLease`, `SchedulerDisposition` veya full `ImpactGraph` tipi bulunmuyor.

### CHECKPOINT 4C — Compiler tamamlandı

- Aynı workflow/input iki çalışmada aynı plan/hash'i üretiyor.
- Aynı pack/version provenance plana deterministik yazılıyor.
- Unknown node fail-fast.
- Ambiguous selector compile error.
- Sınırsız loop/wait reddediliyor.
- Non-idempotent unsafe retry reddediliyor.
- Missing evidence policy kritik node'u reddediyor.
- SDK'nın otomatik üretmediği zorunlu business evidence capability'si yoksa compile fail.
- `rowIndexHint` veya text-only zayıf selector policy'ye göre warning/error üretiyor.
- Required/optional/not-applicable layer'lar plana deterministik yazılıyor.
- 20 barkod Nesy `FOR_EACH` planı doğru entity/iteration/occurrence scope taşıyor.
- Dialog policy compiled plana ekleniyor.
- Expected ve interrupt surface contract'ları generic `UiWaitPlan` ve tek bounded
  `wait_any` request'ine dönüşüyor.
- Wait hot path'i full dump üretmiyor.
- Continue Gate ve Final Oracle plan içinde ayrı ve uygulanabilir.
- Receipt-safe/ordered-required lane plana deterministik yazılıyor; order-sensitive
  fact receipt-only gate'e bağlanırsa compile fail.
- Oracle requirement obligation/timing/deadline/onTimeout alanları ve derived graph/
  reducer digest'i plan hash/provenance'a dahil.
- Test Profile expansion aynı inputta deterministik profile/run plan hash'i üretiyor.
- Profile yeni runner/engine/Oracle path'i istemiyor; isterse compile fail.
- Fault, repetition, device matrix, telemetry ve differential policy plana source-map
  ile yazılıyor.
- Feature Blueprint ve Capability Contract source-map'i deterministic; Core shared IR
  yeni app-specific feature/component type almıyor.
- Resource conflict ve prerequisite failure compile/runtime planında `BLOCKED` olarak
  modelleniyor; zincirleme sahte `FAILED` üretilmiyor.
- Compiler hiçbir cihaz action'ı çalıştırmıyor.

## FAZ 5 — BridgeFlowExecutor, Oracle v2 ve Kalıcılık

### Amaç

Compiled plan'i step-by-step yürütmek; her occurrence'ı kanıt, recovery ve
idempotency bilgisiyle kalıcılaştırmak.

### Neden bu sırada

UI dönüşümünün güvenilir API ve sonuç modeline ihtiyacı vardır. Önce runtime
correctness kurulmalıdır.

### Yapılacaklar

1. D.6E, D.8, D.9, D.10, D.22, D.24 ve D.25 runtime/API işlerinin tamamı.
2. WorkflowRunner'ı engine-agnostic orchestrator'a indirgeme.
3. BridgeFlow executor seçimi.
4. Per-step transaction ve lease.
5. Host crash recovery.
6. Bridge reconnect/unknown-effect politikası.
7. Four-layer oracle.
8. Additive DB migration ve engine-neutral history export/read model.
9. Engine-specific eski kolon/DTO/renderer drop hazırlığı.
10. API DTO ve pagination.
11. Device/host clock calibration ve capture marker servisi.
12. Action lifecycle ve per-layer applicability persistence.
13. Remote business result/correlation adapter'ları.
14. Continue Gate runtime evaluator ve “neden ilerledi” evidence'i.
15. Final Oracle eventual validation scheduler.
16. `wait_any` request/result/interrupt/cancel routing.
17. Fixed-wait rejection ve deadline-based readiness.
18. Raw→fact derivation provenance ve Domain Oracle resolution.
19. Evidence Source Registry adapter'ları, fact authority/conflict ve freshness gate.
20. SDK Local Observation Bus budget metric/audit ingest'i.
21. D.11B için versioned `DeviceReadinessQuery`, `DurableInteractionSubscription`,
    `WorkflowCatalogQuery`, `RunHistoryQuery`, `RunDetailQuery`,
    `LegacyRunSummaryQuery` ve generic `WorkflowRunApi` read/write modelleri.
22. Page DTO'larında pagination, partial/blocked state, capability snapshot ve
    correlation metadata.
23. Receipt-safe Continue Gate ve ordered Final Oracle subscriber routing'i.
24. Lifecycle/verdict/termination/cleanup/operational disposition migration ve
    atomic transition service'i.
25. Step action/gate/oracle/cleanup outcome persistence ve Run Detail DTO'su.
26. Fact-bazlı Oracle requirement deadline/onTimeout evaluator'ı.
27. Active-run pack/graph/reducer pinning ve hot-reload isolation.
28. Evidence Journey stage classifier, source adapter'ları ve versioned
    `EvidenceJourneyQuery` read model'i.
29. Layer applicability occurrence snapshot, interaction-origin evidence ve repro
    capture manifest persistence/API foundation'ı.
30. Test Profile/Campaign persistence ve API:
    `TestProfileCatalogQuery`, `TestProfileDetailQuery`, `TestProfileValidationApi`,
    `TestCampaignQuery`, `TestCampaignStartApi` ve `TestCampaignResultQuery`.
31. Campaign cell/result persistence: profileKey, runIds, result, failedCells,
    evidenceSummaryRef, releaseGateResult ve blocked reason.
32. Repetition/soak/fault state persistence: repetition index, fault applied count,
    duration deadline, failure streak ve stopPolicy.
33. Run Manifest persistence/API: `campaignId`, `manifestId`, `manifestHash`,
    workflowVersions, domainPackDigest, capabilityCatalogDigest,
    featureExecutableContractDigest, appAdapterDigest, launchProfileVersion,
    testProfileVersion, dataset/fixture version, faultPlanVersion, oracleTemplateDigest,
    evidenceSourceRegistryDigest, performanceBudgetVersion, remoteEnvironmentSnapshotRef,
    deviceCapabilitySnapshotRef, resourcePlanDigest, compilerVersion,
    workflowIrSchemaVersion, bridgeProtocolVersion ve sdkProtocolVersion.
34. TestExecutionQueue persistence/API: `testExecutionId`, `workflowRunId`,
    `ExecutionLifecycle`, `ProductVerdict`, `EvaluationFailureClass`,
    `SchedulerDisposition`, `TerminationReason`, `WorkflowCleanupResult`,
    `ResourceReleaseResult`, `OperationalDisposition`, lease owner, heartbeat,
    `LEASE_EXPIRED/UNKNOWN_EFFECT/RECONCILIATION_REQUIRED/ORPHANED` recovery ve
    blocked reason.
35. TestDataBroker persistence/API: resource pool, resource lease, conflict group,
    `CLEAN/DIRTY/QUARANTINED/RECONCILIATION_REQUIRED/MANUAL_RELEASE_REQUIRED`
    resource state, cleanup/quarantine/destroy/manual release ve reconciliation ref.
36. Dependency/Impact evaluator read model'i: prerequisite blocked/failed ayrımı ve
    PR/build impact selection sonucu.
37. `REMOTE_ACTION` executor runtime'ı: allowlisted adapter operation lookup,
    effect/idempotency enforcement, idempotency key persistence, timeout/cancel,
    run/occurrence/entity correlation, output fact binding ve audit kaydı.
38. Remote mutation partial failure policy: ilk servis başarılı ikinci servis
    başarısız, timeout sonrası unknown remote effect veya idempotency conflict
    durumunda kör retry yapılmaz; Test Data Broker ilgili account/backend fixture
    kaynağını `RECONCILIATION_REQUIRED` veya `QUARANTINED` durumuna alır.
39. Nesy Backoffice Adapter execution path'i: HTTP transport result, business response,
    backend entity state, push/notification dispatch ve mobile/app/UI receive kanıtları
    ayrı fact authority olarak saklanır; HTTP 2xx business success yerine geçmez.

### CHECKPOINT 5

- Run lifecycle, business verdict, termination, cleanup ve operational disposition
  transition'ları DB'de ayrı ve atomik.
- Tek cihazda iki run aynı anda action uygulamıyor.
- Aynı editor node'un 20 occurrence'ı ayrı kaydediliyor.
- Process restart completed occurrence'ı tekrar uygulamıyor.
- Unknown physical effect sessiz retry/green üretmiyor.
- UI pass fakat app/remote missing ise completion policy fail/pending veriyor.
- `NOT_APPLICABLE`, `NOT_MEASURED` ve `REQUIRED_PENDING` birbirinden ayrılıyor.
- `PASS_ONLINE`, `PASS_QUEUED_OFFLINE`, `FAIL_PRODUCT` ve `INCONCLUSIVE`
  ProductVerdict değerleri; `AUTOMATION_FAILURE`, `ENVIRONMENT_FAILURE` ve
  `EVIDENCE_INSUFFICIENT` EvaluationFailureClass değerleri; `PENDING_REMOTE`
  evaluation state'i, layer-specific failure/root cause ve termination/action
  sonuçları kendi eksenlerinde deterministik üretiliyor.
- HTTP 2xx tek başına business success üretmiyor; backend state/correlation politikası uygulanıyor.
- QUEUE_OFFLINE ayrı plane/rozet değil, Local subtype + `PASS_QUEUED_OFFLINE` policy
  sonucu üretiyor.
- SDK ve Bridge event'leri aynı device CLOCK_BOOTTIME ekseninde; host evidence'i
  offset/marker/uncertainty ile hizalanıyor.
- Reboot eski clock calibration'ı geçersiz kılıyor.
- Event yanlış iteration'a yazılmıyor.
- Node type tek başına correlation anahtarı olarak kullanılmıyor.
- Continue Gate hazır olduğu anda ilerliyor; deadline dolana kadar kör beklemiyor.
- Commit edilmiş receipt-safe fact ordered gap arkasında kalmadan Continue Gate'i
  uyandırıyor; ordered-required fact bu kısa yolu kullanamıyor.
- Final Oracle eventual local/remote sonucu occurrence kapanışına kadar izliyor.
- Required+eventual fact tek requirement olarak deadline/onTimeout politikasını
  uyguluyor; aynı fact paralel listelerde belirsizleşmiyor.
- `DELIVERY_PERSISTED` ve `QUEUE_OFFLINE` doğru Local/queue subtype'ında değerlendiriliyor.
- `REMOTE_ACTION` step'i idempotency/correlation/resource lease olmadan çalışmıyor;
  non-idempotent veya unknown-effect remote mutation otomatik retry edilmiyor.
- Remote mutation partial failure kaynakları `FAILED` test sonucu üretmeden önce
  reconciliation/disposition ekseninde ayrılıyor; dependent workflow'lar gerekirse
  `BLOCKED` oluyor.
- Nesy tur onayı setup modu fixture/precondition sonucu üretirken gerçek tur onayı
  ürün PASS'i, push başarı hükmü veya UI integration PASS'i üretmiyor.
- Expected/interrupt `wait_any` sonucu doğru occurrence'a route ediliyor ve step/run
  bitince in-flight request cancel/cleanup ediliyor.
- Match/timeout/cancel aynı anda yarıştığında yalnız bir terminal sonuç persist
  ediliyor.
- Evidence primary ve confirmatory source çelişirse `EVIDENCE_CONFLICT`; stale veya
  yanlış correlation'lı fact Oracle PASS üretmiyor.
- Canonical technical evidence replay edildiğinde normalized fact idempotent ve
  derivation trace tek logical occurrence'a bağlı.
- Derived fact graph cycle içermiyor; reducer replay tek logical fact üretiyor ve
  pinned bundle/graph digest'i aktif run boyunca değişmiyor.
- Business PASS + cleanup failure, verdict'i PASS tutup cleanup FAILED ve operational
  `NEEDS_ATTENTION` üretiyor; step sonuç eksenleri birbirini overwrite etmiyor.
- Koşulsuz fixed wait runtime planında bulunmuyor.
- Cancel cleanup/end_run/secret/socket/subscriber release ediyor.
- Eski run gerekli tarihsel özet ve artifact'leri engine-neutral görünümde açılıyor;
  Maestro'ya özel renderer veya DTO kullanılmıyor.
- Yeni BridgeFlow run `yamlContent/maestroOutput` olmadan tamamlanıyor.
- Phase 6 sayfalarının tüketeceği D.11B target DTO'ları contract/integration testinden
  geçiyor; component'in legacy tablo/transport şekline bağımlılığı gerekmiyor.
- Evidence Journey emit→WAL→transport→inbox→receipt→ordered→normalization→correlation→
  evaluation aşamalarını ayrı gösteriyor; host'ta event yokluğu SDK failure'a
  hard-code edilmiyor.
- Receipt confirmed + ordered gap, normalization failure, correlation miss ve Oracle
  pending fixture'ları farklı stage/state/reason üretiyor.
- SDK `EmitOutcome` yalnız explicit caller/diagnostic evidence varsa exact gösteriliyor;
  kanıtsız outcome tahmin edilmiyor.
- Occurrence layer-applicability snapshot'ı compiled plan'dan immutable persist
  ediliyor; web registry runtime authority olarak kullanılmıyor.
- Test Profile/Campaign run parametreleri run başında pinned: profile version, campaign,
  buildRef, dataset, device cell, repetition index, fault state ve telemetry policy.
- Campaign cell sonucu gerçek run/evidence summary olmadan PASS/FAIL üretmiyor.
- Preview profile sonucu business verdict veya release GO/NO_GO kararını overwrite etmiyor.
- Repetition/soak/fault state process restart sonrası devam edebiliyor veya açık
  `INCONCLUSIVE/BLOCKED` nedeni üretiyor.
- Run Manifest immutable; worker/API restart sonrası terminal olmayan execution'lar
  lease/effect durumuna göre `RETRYABLE`, `RECONCILIATION_REQUIRED` veya `ORPHANED`
  oluyor, suite baştan başlamıyor ve unknown-effect sessiz retry edilmiyor.
- Login/setup/resource failure dependent workflow'ları `BLOCKED` yapıyor; independent
  workflow'lar çalışmaya devam edebiliyor.
- TestDataBroker aynı exclusive account/backend fixture/payment/ad/reaction/route
  kaynağında paralel mutation'ı engelliyor; reconciliation gereken resource'u havuza
  hemen döndürmüyor.

## FAZ 6 — Editor, Live Inspector, Device Lab ve Run Detail

### Amaç

Yeni runtime'ı operatörün anlayacağı ve güvenle kullanacağı ürün yüzeyine
dönüştürmek.

### Neden bu sırada

UI, kabul edilmiş compiler/runtime DTO'larına dayanmalıdır; kendi davranışını
icat etmemelidir.

### Yapılacaklar

1. D.11, D.11A, D.11B, D.11C, D.12, D.13, D.15, D.23, D.24 ve D.25 UI işlerinin tamamı.
2. YAML preview'ı deprecate et.
3. Plan preview'ı aynı compiler endpoint'ine bağla.
4. Selector Builder + live test.
5. Observe/Act permission.
6. Screenshot overlay coordinate testleri.
7. Run detail evidence drawer.
8. Repro export redaction.
9. Responsive/empty/error/loading/accessibility UI.
10. Engine-neutral eski run summary compatibility; engine-specific renderer yok.
11. Diagnostic waterfall stage ve clock uncertainty UI.
12. Genişletilmiş immutable/versioned repro export.
13. Domain Pack catalog/Application/Screen/Surface/Evidence Source Registry manager.
14. Semantic macro/entity binding ve formal Launch Profile Builder.
15. Screen/Surface mapping ve Expected/Interrupt Wait Inspector UI.
16. Continue Gate ve Final Oracle'ın ayrı Run Detail sunumu.
17. Target Resolution Provider Chain evidence/ambiguity görünümü.
18. Raw technical evidence → normalized fact derivation drawer'ı.
19. `PageMigrationManifest` ile H.5'teki bütün production route'ları kapsama.
20. Yedi-workspace navigation regression'ı; Domain Packs ve Root Cause Intelligence
    menü girişleri.
21. `/automation/domain-packs` catalog ve `/automation/domain-packs/[packId]` tab'li
    manager implementasyonu.
22. `/automation/test-profiles`, `/automation/test-profiles/[profileId]`,
    `/automation/test-campaigns` ve `/automation/test-campaigns/[campaignId]`
    implementasyonu.
23. Test Profile Builder ve Test Campaign Builder UI'ı; core/preview, releaseGate,
    schedule class, device matrix, fault trigger ve differential policy görünümü.
24. Campaign matrix UI: profile x device/dataset cell, failedCells, evidence summary ve
    Run Detail deep-link.
25. Debug View ve Automation için D.11B target data-source cutover'ları.
26. `/engineering/current-architecture` içerik dönüşümü ve
    `/engineering/modernization-plan` checkpoint/evidence dashboard'u.
27. Product/PM/Engineering Tools/Data Center/kalıcı ADB route non-regression suite'i.
28. Route availability/reason/remediation ve transition flag expiry görünümü.
29. Run lifecycle/verdict/termination/cleanup/operational disposition ve step outcome
    eksenlerini ayrı UI state/rozet/timeline olarak gösterme.
30. Device Lab'de receipt/ordered bus health ve command admission lane görünümü.
31. Aktif run Inspector Act block/takeover reason ve manual-touch contamination UI'sı.
32. Domain Pack detail'de immutable bundle/graph/reducer/test-profile digest ve active-run pinned
    version görünümü.
33. Increment 6A: Evidence Journey/detail drawer ve exact/`NOT_CAPTURED` repro export.
34. Increment 6B: occurrence snapshot'ından static compact applicable badge ve
    dört-layer detail presentation.
35. Increment 6C: revision-aware live subscription ve reconnect/race testlerinden
    sonra bağımsız badge transition'ları; sabit sıralı chronology animasyonu yok.
36. Debug View Interactions ve Run Detail'de `BRIDGE_INJECTED/MANUAL/UNKNOWN` origin,
    confidence, correlation source ve human/automation filtreleri.
37. Feature Registry, Component Registry, Capability Contracts, Workflow Library,
    Test Suites, Run Planner, Execution Queue ve Coverage Graph UI route'ları.
38. Run Planner manifest preview: selected/skipped/blocked tests, resource conflicts,
    dependency graph, impact selection ve parallelization plan.
39. Execution Queue ekranı: lifecycle, business verdict, scheduler disposition,
    termination reason, cleanup result, lease owner, heartbeat ve recovery actions.
40. Feature detail ekranı: health, coverage, screens, components, business invariants,
    workflows, last failures, compatibility, visual/performance baseline ve dependencies.

### CHECKPOINT 6

- Operatör Maestro/YAML bilmeden workflow oluşturuyor.
- Preview ile executed plan hash'i aynı.
- Compile error doğru canvas node'una bağlanıyor.
- Inspector node overlay orientation/inset ile doğru.
- Ambiguous node UI'da açık ve action disabled.
- Production device Act Mode kapalı.
- Device kartı ADB, SDK Control, SDK Event/Auth, Durable Ingest, Accessibility
  Bridge, Backend Credentials, Local DB ve Active Run durumlarını ayrı gösteriyor.
- Run detail occurrence/iteration/retry'yi ayırıyor.
- UI/App/Local/Remote evidence açıklanabilir.
- `NOT_APPLICABLE`, `NOT_MEASURED` ve `REQUIRED_PENDING` rozetleri farklı anlamlarla gösteriliyor.
- Waterfall command→gesture→app→local→remote zincirini ortak zaman ekseninde gösteriyor.
- Host-device clock uncertainty görünür; sahte milisaniye kesinliği yok.
- Copy repro secret/PIN/token içermiyor.
- Repro app/SDK/Bridge/workflow/device/fingerprint/action-lifecycle/clock/artifact metadata'sını taşıyor.
- Repro production Act Mode'u otomatik açmıyor.
- Operatör Nesy semantic macro'sunu seçebiliyor; generic IR/plan preview aynı API compiler'ından geliyor.
- Pack/app/adapter mismatch açık ve eylem önerili görünüyor.
- Continue Gate ile Final Oracle aynı “success” rozeti altında birleşmiyor.
- Cleanup failure business PASS'i kırmızı business FAIL'e dönüştürmüyor; lifecycle,
  verdict, termination, cleanup ve attention ayrı ve açıklanabilir.
- Step action/gate/oracle/cleanup sonuçları tek belirsiz status altında birleşmiyor.
- Wait expected-match/ambiguity/interrupt/timeout/cancel occurrence timeline'ında
  görünür; persistent registration varmış gibi yanlış state gösterilmez.
- Current Screen ve Active Surface ayrı registry key'leriyle aynı anda görülebilir.
- Launch Profile Builder process/precondition/entry/readiness/cleanup alanlarını
  eksiksiz doğrular.
- Evidence Source UI source kind/authority/correlation/freshness/conflict'i açıklar.
- Evidence Source UI delivery lane'i; Device Lab receipt/ordered health ve active
  command admission lane/owner bilgisini gösterir.
- Aktif run sırasında Inspector Act blocked reason gösterir ve API denial ile uyumludur.
- Domain Pack manager published bundle hash/derived graph/reducer set'ini gösterir;
  active run hot reload ile version değiştirmez.
- Eski run'ın korunması gereken özeti generic legacy görünümde açılıyor;
  engine-specific UI yapısı taşınmıyor.
- Top-level workspace sayısı yedi; yeni Verdict workspace yok.
- Domain Pack catalog/detail route'ları navigation, direct link ve browser refresh ile
  açılıyor; publish/migrate RBAC fail-closed.
- Test Profile catalog/detail ve Test Campaign list/detail route'ları navigation, direct
  link ve browser refresh ile açılıyor; profile/campaign DTO'ları target data source
  kullanıyor.
- Test Profile Builder profile kind'e göre required alanları ve preview/releaseGate
  kısıtlarını doğruluyor.
- Test Campaign matrix her cell'den gerçek Run Detail'e deep-link veriyor; cell evidence
  olmadan campaign PASS üretilmiyor.
- `PageMigrationManifest` H.5'teki production route'ların tamamını owner, source,
  phase, availability ve acceptance ref ile kapsıyor.
- `/pm/root-cause` navigasyonda ve direct link'te erişilebilir; orphan route yok.
- `/engineering/current-architecture` target/geçiş mimarisini doğru gösteriyor.
- `/engineering/modernization-plan` gerçek checkpoint/evidence read modelini
  kullanıyor; boş shell veya elle kopyalanmış status değil.
- Debug View interactions/screen-state/operational-health hedef data source'a geçmiş;
  legacy adapter kullanımı metric ve expiry taşımadan kalıcı değil.
- Product, PM, Engineering Tools, Data Center, Schedule, Database, Network Inspector
  ve Log Explorer non-regression suite'i yeşil.
- Navigation/direct-link/refresh, loading/empty/error/disconnected/blocked ve RBAC
  page acceptance matrisi yeşil.
- Bilinçli placeholder sayfalar `BACKLOG` olarak ayrı raporlanıyor; broken route veya
  platform DONE sayılmıyor.
- Evidence Journey drawer raw WAL/inbox/cursor/reducer/fact/Oracle kayıtlarına
  evidence ref ile iner; kanıtsız SDK/root-cause iddiası üretmez.
- Compact node yalnız applicable layer badge'lerini, detail drawer dört plane'i
  explicit applicability state'leriyle aynı occurrence snapshot'ından gösterir.
- UI/App/Local/Remote evidence farklı sırada geldiğinde badge'ler kendi revision'ıyla
  güncellenir; görsel sıra chronology gibi sunulmaz.
- Bridge-enjekte click `MANUAL` görünmez; korelasyonsuz SDK InteractionCapture click'i
  `UNKNOWN` kalır ve human baseline'a sessizce katılmaz.
- Normal başarılı step full dump üretmez. Failure scoped artifact yakalanmışsa repro
  hash/ref taşır; yakalanmamışsa açık `NOT_CAPTURED` gösterir.
- Drawer-first sırası kanıtlanmıştır: 6A read model/drawer/repro → 6B static badges →
  6C live updates; önceki increment kabul edilmeden sonraki release edilmemiştir.
- Feature Registry, Component Registry, Capability Contracts, Workflow Library,
  Test Suites, Run Planner, Execution Queue ve Coverage Graph route'ları H.5 matrisi,
  PageMigrationManifest, target DTO, RBAC ve page acceptance suite'iyle kapsanmıştır.
- Run Planner manifest preview'ı immutable `RunManifest` hash'i, selected/skipped/
  blocked execution listesi, resource conflict'leri, dependency graph'i, impact
  selection nedeni ve paralel koşum planını göstermeden campaign başlatamaz.
- Execution Queue worker lease owner, heartbeat, retry/orphan recovery action ve
  `BLOCKED_*` reason'larını açıklanabilir gösterir; suite restart gerektirmeden
  tek execution recovery kanıtlanmıştır.
- Feature detail ekranı business invariant authority'sini gösterir; `AI_SUGGESTED`
  invariant release gate'e bağlanmışsa fail-closed validation verir.
- Workflow Library'de Reusable Flow Fragment terminal feature verdict üretmez;
  Independent Test Workflow kendi source-map, manifest entry ve result detail'ine
  sahiptir.

## FAZ 7 — Referans İş Akışları, Diagnostics ve Güvenlik

### Amaç

Platformu gerçek Nesy kurye akışıyla ispatlamak ve operasyon/güvenlik
politikasını tamamlamak.

### Neden bu sırada

Generic runtime gerçek business akışında denenmeden ve artifact politikası
kurulmadan cutover ölçümü yapılamaz.

### Yapılacaklar

1. D.14, D.16, D.17 ve D.24 Nesy profile acceptance işlerinin tamamı.
2. Field Login'i ortak workflow'a taşı.
3. Load Tour'u ortak workflow'a taşı.
4. Tam kurye golden workflow.
5. 20 barcode loop.
6. Offline/online/backend senaryoları.
7. Dialog policy.
8. D1/D2/D3 capture ve approval.
9. Stuck-run ve alert.
10. PII/artifact retention audit.
11. Nesy Courier Domain Pack ile runtime entity discovery.
12. Screen/Surface/Target mapping drift senaryoları.
13. Real/injected/manual scanner mode senaryoları.
14. Continue Gate erken ilerleme ve eventual Final Oracle senaryoları.
15. Expected/interrupt `wait_any` ve diagnostic dump escalation senaryoları.
16. Evidence conflict/stale correlation ve transport-success/business-failure
    senaryoları.
17. Launch Profile hızlı giriş ve readiness/cleanup failure senaryoları.
18. `/automation/field-login` ve `/automation/01-load-tour-flow` page-level gerçek
    DUT acceptance; özel API/orchestrator import ve çağrısı sıfır.
19. Workflow list → editor → run → run detail → history deep-link zinciri ve aynı
    plan/run provenance acceptance.
20. Evidence Journey gerçek DUT fixture'ları: SDK explicit failure, transport/auth
    failure, host commit, ordered gap, normalization ve correlation miss.
21. Bridge injected/manual/unknown interaction-origin cihaz testleri ve human metric
    isolation acceptance.
22. Ambiguity/timeout/unknown dialog/unknown effect failure-triggered scoped repro
    capture; normal happy-path full-dump-free doğrulaması.
23. Nesy v1 core Test Profile kataloğunu gerçek DUT'ta çalıştırma: smoke, critical
    regression, differential, recovery, bad day, contract/consistency, load,
    compatibility, security ve short soak.
24. Basic Accessibility Audit ve Smart Explorer Preview'u release gate dışında, açık
    preview etiketiyle çalıştırma.
25. PR/nightly/weekly/release campaign schedule sınıflarını en az fake ve bir gerçek
    DUT fixture'ıyla doğrulama.
26. `TOUR_APPROVAL_LIFECYCLE` gerçek DUT vertical slice'ı:
    kurye Mobile UI'da tur onayı ister; Nesy Backoffice Adapter iki remote servis
    çağrısını idempotent/correlated çalıştırır; backend entity approved state'i,
    push/notification dispatch, mobile receive/app state ve UI approved surface
    kanıtları Continue Gate ve Final Oracle'da ayrı değerlendirilir.

Opsiyonel D.21 İz C bu fazdan sonra veya paralel başlayabilir; AI Design Audit
ve post-run explanation kapalıyken checkpoint davranışı aynı kalır.

### CHECKPOINT 7

- Field Login ve Load Tour özel Maestro orchestrator olmadan çalışıyor.
- Setup login ile gerçek login E2E ayrımı görünür.
- Tam kurye workflow gerçek DUT'ta tamamlanıyor.
- 20 barcode occurrence/evidence doğru.
- 20 barcode statik node çoğaltmasıyla değil runtime entity query + `FOR_EACH` ile çalışıyor.
- Stop/task/shipment/parcel stable entity key'leri doğru occurrence'a bağlı.
- Offline queue false failure üretmiyor.
- Backend confirmation doğru node/iteration'a bağlanıyor.
- `TOUR_APPROVAL_LIFECYCLE` gerçek tur onayı modunda backend approved + push/mobile
  receive + app state + UI surface zinciriyle geçiyor; backend approved ama mobile
  notification/app state gelmezse test devam etmiyor ve failure boundary remote→mobile
  notification/app sync olarak raporlanıyor.
- `TOUR_APPROVAL_LIFECYCLE` setup/precondition modunda controlled remote approval ve
  refresh/direct sync kullanabiliyor; ancak push/UI integration veya tur onayı ürün
  PASS'i üretmiyor.
- Tur onayı partial mutation, timeout veya unknown remote effect durumunda account/tour
  fixture Test Data Broker tarafından `RECONCILIATION_REQUIRED`/`QUARANTINED` yapılıyor.
- Unknown dialog STOP + screenshot + scoped dump üretiyor.
- `wait_any` beklenen surface'te küçük correlated match sonucu döndürüyor; aynı
  beklemedeki interrupt predicate session/update yüzeyini kesiyor.
- Normal happy path'te sürekli veya per-poll full accessibility dump yok.
- Continue Gate readiness sağlanır sağlanmaz ilerliyor; Final Oracle eventual kanıtı ayrı tamamlıyor.
- Scanner injection ve `DIRECT_STATE` yalnız automation build'de çalışıyor.
- D3 yalnız rol + explicit approval ile çalışıyor.
- Sensitive artifact purge SLA içinde.
- Stuck run heartbeat ve consumer/Bridge health ile sınıflanıyor.
- Audit kaydı actor/device/run/command/result taşıyor, secret taşımıyor.
- Zorunlu business event/state/query entegrasyonu olmayan workflow compile/preflight'ta açık fail ediyor.
- Nesy reference implementation Core'a kurye-specific IR/action type'ı eklemiyor.
- UI'da görünmeyen stop identity bounded entity-target binding ile çözülüyor; bütün
  stop collection SDK event stream'ine taşınmıyor.
- Field Login ve Load Tour route'ları generic `WorkflowRunApi` kullanıyor; eski özel
  service/orchestrator çağrısı yok.
- Workflow Library, Editor, Run Detail ve History aynı workflow/plan/run/domain-pack
  provenance'ına deep-link ile çözülebiliyor.
- Gerçek DUT'ta Bridge action `BRIDGE_INJECTED`, operatör contamination'ı `MANUAL`,
  ayrıştırılamayan SDK click `UNKNOWN` olarak kanıtlanıyor.
- Missing evidence root cause'u yalnız doğrulanan Journey stage'e atanıyor; “event
  görünmedi” tek başına SDK failure üretmiyor.
- Failure-triggered scoped capture quota/redaction/RBAC/retention altında çalışıyor;
  yakalanmayan tree için retrospective dump iddiası yok.
- Nesy core Test Profile kataloğu published pack version'ında mevcut ve profile run'ları
  aynı BridgeFlowExecutor/Oracle yolunu kullanıyor.
- Recovery/Bad Day profilleri business fact/surface/source trigger ile fault uyguluyor;
  correlation yoksa fail-closed.
- Differential Regression kritik fact kaybını build-to-build diff'te gösteriyor.
- Security/Release Isolation profile release APK automation yüzeyi sızıntısında NO_GO
  üretiyor.
- Preview accessibility/explorer profilleri release gate sonucunu değiştirmiyor.

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
10. CP0 baseline'ından üretilmiş, cihaz/build/thermal profili ve percentile/sample
    tanımı pinli `PerformanceBudget v1` regression/release gate'i.

### CHECKPOINT 8

- Her command run/session/epoch fenced.
- Eski/cross-run command action uygulamadan reddediliyor.
- Process death duplicate physical action üretmiyor veya açık unknown-effect ile duruyor.
- IME obstruction beklendiği gibi fail/recover.
- Foreign window tap'i engelliyor ve `obscuredBy` kanıtı var.
- Manual touch contamination işaretleniyor.
- WakeLock bounded; thermal/power ve command/wait/receipt/ordered latency bütçeleri
  pinli `PerformanceBudget v1` içinde kabulde.
- Tam kurye BridgeFlow correctness'i golden runner'dan düşük değil.
- False-pass artışı yok.
- Hot path full-tree dump sayısı sıfır; profil dışı ölçülmemiş örnek eşik cutover
  gerekçesi yapılmıyor.
- Artifact/evidence completeness kabul kriterini geçiyor.
- Cutover kararı kayıt altına alınmış.

**Checkpoint 8 geçmeden Maestro DELETE yoktur.** Ancak başarısız Bridge run'ın
sessiz Maestro fallback'i yine yoktur; dual-run yalnız ölçüm harness'ıdır.

## FAZ 9 — Ürünleştirme, Maestro'nun Projeden Tam Sökümü ve Operasyon

### Amaç

Geçiş kodunu ve eski engine'e ait bütün proje yapısını kaldırmak, yeni runtime'ı
tek production Cockpit yolu yapmak ve uzun süreli operasyon kapılarını tamamlamak.

### Neden en sonda

Compatibility, historical run ve rollback ihtiyaçları ancak measured cutover
sonrası güvenle daraltılabilir.

### Yapılacaklar

1. D.19 tam söküm listesinin tamamı.
2. Repo-wide kod/package/config/schema/UI/test/doc/migration envanteri.
3. Eski run verisinin engine-neutral export/migration sayım ve checksum doğrulaması.
4. Engine-specific DB kolon, DTO ve renderer drop migration'ı.
5. Legacy UI metin, route, translation ve asset temizliği.
6. DeviceWorker driver/preinstall kodunu sil.
7. API executor/compiler/script/feature-flag/env temizliği.
8. Package manifest, lockfile, image ve CI dependency temizliği.
9. Test/mock/fixture/snapshot temizliği veya BridgeFlow dönüşümü.
10. Aktif doküman/runbook talimatlarını yeni mimariye geçir.
11. Güvenli DB baseline koşulları sağlanırsa eski migration zincirini yeniden baseline et.
12. V1 event telemetry observation window.
13. V1 parser sunset veya bilinçli device sunset.
14. Multi-device concurrency.
15. Low disk.
16. USB disconnect.
17. Power/process loss.
18. 8 saat soak ve uzun retention/purge.
19. Dependency/security scan.
20. Runbook, operator guide ve incident playbook.
21. Eski dar dokümanları yeni mimariye göre güncelle; geçersiz olanları repo dışı
    tarihsel arşive taşı veya sil.
22. Product-shell borcunu ayrı backlog'a taşı.
23. `PageMigrationManifest` legacy-zero pattern'larının tamamını repo/build çıktısında
    doğrula; expiry'si dolmuş compatibility adapter ve transition flag'lerini sil.
24. H.5 hedef route'larında final navigation/direct-link/non-regression suite'ini
    eski CLI ve Maestro package'i kurulu değilken çalıştır.

### CHECKPOINT 9

- Maestro CLI/executor/driver/YAML compiler/preview/download yok.
- Package, lockfile, container, CI, env ve config dependency'si yok.
- Runtime fallback, feature flag, adapter veya disabled dead-code yok.
- API route/DTO/type/enum ve Prisma alanı yok.
- Engine-specific test, fixture, mock, snapshot ve script yok.
- Engine-specific UI, label, translation, icon ve özel renderer yok.
- Korunması gereken eski run verisi engine-neutral arşiv/summary olarak açılıyor.
- Aktif migration baseline engine-specific kolon oluşturmuyor; drop/export kanıtı var.
- Eski CLI sistemde kurulu değilken build, test ve gerçek run yeşil.
- Aktif uygulama/build/config/schema/test/UI ağacında repo-wide Maestro yapısı sıfır.
- Aktif v1 event/device oranı sıfır veya kalan cihazlar bilinçli sunset edilmiş.
- Çoklu cihaz port/session izolasyonu yeşil.
- Low disk/USB/process loss recovery beklendiği gibi.
- Soak kriteri geçiyor; unprocessed inbox/lease/socket/forward sızıntısı yok.
- Security, retention ve audit kapıları yeşil.
- Mobile `verdict-status.json` platform release kararını GO'ya taşıyabilecek kanıt hazır.
- H.5 hedef route'larında Maestro/YAML buton, label, service request, DTO veya renderer
  yok; placeholder backlog route'ları ayrı raporda.
- Page compatibility adapter/transition flag envanterinde owner/expiry'siz veya süresi
  dolmuş kalıntı yok.

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
| R20 | Maestro'nun disabled kodu, dependency'si, DB alanı veya historical renderer'ı kalır | İki runtime drift/borç ve tamamlanmamış söküm | CP9 zero-structure gate | CP9 |
| R21 | Accessibility service enable başka servisleri ezer | Cihaz bozulur | Read/merge/verify enabled-service list | CP3 |
| R22 | Full dump hot path performansı bozar | Yavaşlık/ANR/power | Scope policy + metrics | CP3/CP8 |
| R23 | Heartbeat var ama alarm yok | Stuck run fark edilmez | Liveness policy + executor watchdog | CP5/CP7 |
| R24 | Typecheck/test skip borcu yeni hatayı gizler | Release regresyonu | CP0 baseline | CP0 |
| R25 | Host zamanı device `monoTs` gibi yorumlanır | Yanlış olay sırası/kök neden | CLOCK_BOOTTIME + ping offset + marker + uncertainty | CP5/CP6 |
| R26 | `rowIndex` kalıcı kimlik yapılır | Liste değişince yanlış teslimata tap | TargetFingerprint + stable rowKey | CP3/CP4 |
| R27 | RequestId exactly-once sanılır | Process death sonrası duplicate fiziksel etki | Kalıcı action lifecycle + unknown-effect | CP3/CP5/CP8 |
| R28 | Dört rozet her node'da zorunlu veya gri durumlar eşit sanılır | False fail / açıklanamayan sonuç | Layer applicability state modeli | CP4/CP5/CP6 |
| R29 | HTTP 2xx business success sayılır | False pass | Remote business result + backend entity/correlation | CP5/CP7 |
| R30 | SDK bütün Room/business event'lerini otomatik üretmiş varsayılır | Sonsuz bekleme/missing evidence | Capability-aware compiler/preflight | CP4/CP7 |
| R31 | LLM runtime hükmünü değiştirir veya hassas kanıt sızdırır | Non-determinism/veri ihlali | Opsiyonel İz C, deterministic oracle, redacted input | İz C |
| R32 | Domain Pack mevcut sınırlı IR'a göre erken yazılır | Nesy-specific geçici contract ve yeniden çalışma | CP4A tamamlanmadan Domain Pack merge yasağı | CP4A/CP4B |
| R33 | Reducer canonical technical evidence'i yok eder | Audit/repro ve kök neden kaybı | Durable canonical evidence + derivation trace | CP4B/CP5 |
| R34 | Continue Gate ile Final Oracle tek policy kalır | Gereksiz bekleme veya erken false-pass | Ayrı blocking/eventual evaluator/state | CP4A/CP5 |
| R35 | `wait_any` runtime sürekli/full dump polling'e dönüşür | Trafik, CPU, power ve performans testi bozulması | Accessibility event reevaluation + scoped recovery/artifact + size gate | CP3/CP4C/CP7 |
| R36 | Wait sonucu başka run/occurrence'a sızar | Yanlış interrupt veya false readiness | run/session/epoch/occurrence/request fencing + cancel/cleanup | CP3/CP5 |
| R37 | App Adapter ikinci kez paralel yazılır | Drift ve iki business otomasyon yüzeyi | Existing NesyCommands/state/query/event refactor | CP4B |
| R38 | Scanner injection veya DIRECT_STATE release'e sızar | Güvenlik/production davranış ihlali | automation-only source set + release isolation gate | CP4B/CP7 |
| R39 | Sahte selector fixed wait yaşamaya devam eder | Yavaş ve nondeterministic run | Condition deadline + compiler/runtime rejection | CP4C/CP5/CP9 |
| R40 | Uzun `wait_any` socket reader'ı bloke eder | `cancel_request` okunamaz, run timeout'a kadar takılır | Cancellable worker dispatch + non-blocking reader + race test | CP3 |
| R41 | Paralel writer'lar NDJSON response'u interleave eder | Protocol corruption ve yanlış request correlation | Tek serialized writer queue + stress test | CP3 |
| R42 | Screen ile dialog/surface aynı registry'de eritilir | Update/session dialog'u yanlış ekran/action policy'si alır | Ayrı formal Screen/Surface contract + parent/priority testleri | CP4B/CP6 |
| R43 | Evidence source stale veya yanlış occurrence'a bağlanır | False pass | Authority + correlation + freshness gate | CP4B/CP5 |
| R44 | SDK reducer domain business kuralı taşır | Core Nesy'ye bağlanır ve pack taşınamaz | Generic canonicalization on-device, domain reducer host/pack tarafında | CP4B/CP5 |
| R45 | Observation/event fırtınası bütün callback'leri stream eder | WAL/WS/CPU yükü ve test gecikmesi | Dedupe/coalescing/rate/payload budget + metric | CP4B/CP5/CP7 |
| R46 | Entity binding bütün collection verisini Cockpit'e stream eder | PII, trafik ve coupling | Seçili entity için bounded id→node binding; on-demand query | CP4B/CP7 |
| R47 | Launch command success readiness sanılır | Yanlış screen/state'te test başlar | Expected screen/surface + evidence readiness + cleanup contract | CP4B/CP6/CP7 |
| R48 | Persistent Watch Registry ilk B2'ye erken eklenir | Gereksiz protocol/reconnect/backpressure karmaşıklığı | `wait_any` request-response scope; sonraki major için ölçüm gate'i | CP3 |
| R49 | Domain Pack ekranları dağınık route'lara bölünür | Aynı registry için farklı state/validation ve operatör karmaşası | Tek `/automation/domain-packs/[packId]` tab'li manager + shared API | CP6 |
| R50 | Sayfa yeni görünür fakat legacy data source kullanır | Sahte cutover ve iki doğruluk kaynağı | PageDataSourceContract + source telemetry + expiry | CP5/CP6/CP9 |
| R51 | Runtime değişikliği Product/PM/Data Center/ADB sayfalarını bozar | Cockpit'in mevcut operasyon kabiliyeti kaybolur | H.5 non-regression suite | CP6/CP9 |
| R52 | Route rename/deep-link kırılır veya orphan sayfa kalır | Kullanıcı geçmiş workflow/run'a ulaşamaz | PageMigrationManifest + redirect/nav/direct-link testleri | CP6 |
| R53 | Capability eksikliği yalnız buton gizlenerek maskelenir | Kullanıcı neden çalışmadığını anlayamaz; policy API'de bypass edilir | Typed availability/reason/remediation + server fail-closed gate | CP6 |
| R54 | Placeholder route platform DONE sayılır | Eksik ürün sayfaları tamamlanmış raporlanır | BACKLOG state ve platform-vs-product ayrı release sonucu | CP6/CP9 |
| R55 | Modernization sayfası elle kopyalanmış status gösterir | SSOT drift ve yanlış yönetim kararı | Checkpoint/evidence read model + no-manual-status test | CP6 |
| R56 | Published Domain Pack UI'dan yerinde mutate edilir | Reproducibility ve plan hash bozulur | Immutable publish, new version, optimistic concurrency ve audit | CP4B/CP6 |
| R57 | Nesy Dashboard auth, platform RBAC ve SDK run auth tek gate olur | Authoring gereksiz bloklanır veya yetki sınırı aşılır | Ayrı auth context/state/badge ve page-level policy testleri | CP6 |
| R58 | Ordered gap/poison bütün Continue Gate'leri durdurur | Hazır UI/business step gereksiz timeout olur | Commit-safe Receipt Bus + fact lane validation | CP2/CP5 |
| R59 | Receipt Bus order-sensitive fact'i erken geçirir | Out-of-order false readiness/PASS | `RECEIPT_SAFE/ORDERED_REQUIRED` compile/runtime enforcement; Oracle ordered authority | CP2/CP4C/CP5 |
| R60 | Cleanup failure business PASS'i overwrite eder | Yanlış ürün hükmü ve kayıp operasyon alarmı | Orthogonal lifecycle/verdict/termination/cleanup/disposition modeli | CP4A/CP5/CP6 |
| R61 | Inspector ve runner aynı cihazda paralel mutation yapar | Yanlış tap/state contamination | Device Command Admission + tek mutation + takeover gate | CP3/CP6/CP8 |
| R62 | Accessibility event hiç gelmez | `wait_any` hedef hazır olsa da timeout olur | Initial evaluation + bounded adaptive scoped safety rescan | CP3/CP7 |
| R63 | Derived fact dependency cycle/replay duplicate üretir | Stuck reducer veya tutarsız Oracle | DAG validation + reducer-version idempotency + provenance | CP4B/CP5 |
| R64 | Active run hot reload ile yeni pack/reducer'a geçer | Aynı plan hash altında nondeterministic davranış | Bundle/graph/reducer digest run-start pinning | CP4B/CP5 |
| R65 | Runtime arbitrary Domain Pack kodu çalıştırır | RCE, tenant/veri sınırı ihlali ve reproducibility kaybı | CI-compiled declarative immutable bundle; V1 third-party deny | CP4B/CP6 |
| R66 | Ölçülmemiş örnek performans sayısı release gate olur | Yanlış GO/NO_GO ve cihaz-profili yanlılığı | CP0 baseline + versioned profile-specific PerformanceBudget | CP0/CP8 |
| R67 | Host'ta event yokluğu doğrudan SDK failure sayılır | Yanlış kök neden, yanlış ekip ownership ve gerçek transport/ingest hatasının saklanması | Evidence Journey + negative-evidence authority/confidence | CP5/CP6 |
| R68 | Her EmitOutcome diagnostic event olarak yayınlanır | Recursive emit, WAL basıncı ve event fırtınası | Bounded on-demand SDK diagnostic state/query | CP2/CP5 |
| R69 | Web workflow registry runtime layer authority olur | Pack/plan ile UI drift'i ve geçmiş run'ın değişmesi | Immutable occurrence applicability snapshot | CP4C/CP5/CP6 |
| R70 | Badge'ler sabit UI→App→Local→Remote sırasıyla animasyon yapar | Gerçek concurrency/chronology hakkında yanıltıcı teşhis | Independent revision state + calibrated waterfall | CP6 |
| R71 | Her step full dump alır | CPU/power/latency ve PII/retention riski | Minimal happy path + failure-triggered scoped capture | CP3/CP6/CP7 |
| R72 | Yakalanmamış historical dump repro'da varmış gibi sunulur | Kanıt bütünlüğü ve audit güveni bozulur | `NOT_CAPTURED` manifest + immutable artifact hash | CP6 |
| R73 | SDK generic click manuel kullanıcı etkileşimi sayılır | Human baseline kirlenir ve false contamination oluşur | Injected/manual/unknown origin + strong correlation | CP6/CP7 |
| R74 | Eski benchmark/host rejection oranı güncel teşhise hard-code edilir | Değişen sürüm/ortamda yanlış runtime kararı | Versioned benchmark artifact; runtime Journey evidence authority | CP0/CP5 |

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
- TargetFingerprint resolution/ranking/drift.
- Action lifecycle state machine.
- Layer applicability ve verdict result taxonomy.
- Clock offset/uncertainty hesaplama ve reboot invalidation.
- Remote transport-vs-business kararları.
- WorkflowIR v2 migration/serialization ve Domain Pack expansion.
- Pack/application/adapter compatibility resolution.
- Continue Gate ve Final Oracle evaluator ayrımı.
- Receipt/Ordered lane classification, cursor idempotency ve subscriber enforcement.
- Orthogonal run/step outcome transition invariants ve cleanup-verdict isolation.
- Device Command Admission fairness/limits ve mutation invalidation.
- Unified OracleRequirement obligation/timing/deadline/onTimeout evaluator.
- Derived Fact DAG topological sort/cycle rejection/reducer idempotency.
- Domain Pack bundle canonical serialization/digest ve active-run pin resolution.
- `UiWaitPlan` validation, fencing, expected/interrupt priority, stableForMs,
  deadline ve bounded candidate.
- Canonical technical evidence → semantic fact derivation trace.
- Application/Screen/Surface/Launch Profile registry validation ve compatibility.
- Evidence Source authority/correlation/freshness/conflict/fallback resolution.
- Target Resolution Provider Chain ve bounded entity binding ambiguity.
- Observation dedupe/coalescing/rate/payload budget.
- `PageMigrationManifest` route uniqueness/coverage/phase/owner/expiry validation.
- Page availability state ve capability→reason/remediation resolution.
- Evidence Journey stage classifier, allowed transition, negative-evidence ve
  authority/confidence kuralları.
- Layer compact/detail presentation policy ve occurrence snapshot authority.
- Interaction origin resolver: injected interval match, manual contamination,
  ambiguous/insufficient evidence → `UNKNOWN`.
- Repro capture mode/scope/`NOT_CAPTURED` manifest ve artifact completeness.

### Contract

- Mobile SDK hello/auth fixture ↔ Cockpit.
- Control channel suite.
- Bridge APK v1 fixture ↔ bridge-contract/client.
- Workflow contract API ↔ Web.
- DB migration/read model.
- SDK/Bridge `CLOCK_BOOTTIME` fixture ve host calibration contract'ı.
- TargetFingerprint ve action-lifecycle wire/persistence contract'ı.
- Domain Pack manifest/registry/migration ↔ WorkflowIR v2 contract'ı.
- Nesy App Adapter capability/named-query/scanner/launch-profile manifest'i.
- Generic `UiWaitPlan`, `wait_any`/`cancel_request` wire ve persistence contract'ı.
- İlk B2 unsolicited `WATCH_*`/persistent registration negative contract fixture'ı.
- Application/Screen/Surface/Launch/Evidence Source registry golden fixture'ları.
- `PageDataSourceContract`, `DomainPackAdminApi`, page target DTO version ve
  compatibility-expiry contract'ları.
- H.5 route pattern'ları ↔ `PageMigrationManifest` coverage contract'ı.
- Receipt/Ordered bus, EvidenceDeliveryLane ve lane-aware waitEvent contract'ı.
- Device admission/evaluation policy, run outcome axes ve OracleRequirement
  wire/persistence contract'ları.
- Immutable Domain Pack bundle, derived graph/reducer digest ve no-arbitrary-code
  negative fixture'ları.
- Evidence Journey DTO/persistence/query ve SDK bounded diagnostic snapshot fixture'ı.
- Occurrence layer-applicability snapshot, interaction-origin evidence ve
  `ReproCaptureManifest` wire/API contract'ları.

### Integration

- Real PostgreSQL ingest/ACK/fan-out.
- Fake WS client auth/replay/gap.
- Fake TCP Bridge partial frame/timeout/reconnect.
- Executor + durable bus + oracle.
- API + Web compile/preview hash.
- Host/device clock marker alignment.
- Remote HTTP/business/backend entity ayrışma fixture'ları.
- Optional LLM adapter disabled/unavailable isolation testi.
- Domain macro → generic IR v2 → BridgeFlowPlan determinism.
- Fake Bridge `wait_any` expected/interrupt/ambiguity/timeout/cancel/reconnect;
  blocked-reader ve interleaved-writer race testleri.
- Continue Gate early-advance + Final Oracle eventual completion.
- Raw evidence korunurken host-side fact/oracle derivation.
- Evidence Source primary/confirmatory conflict, stale fact ve cross-occurrence
  correlation rejection.
- HTTP transport success + business rejection/unchanged entity ayrımı.
- Debug View target data-source cutover; legacy adapter usage/expiry telemetry.
- Workflow list/editor/run-detail/history provenance ve deep-link zinciri.
- Domain Pack draft/publish/version/concurrency/RBAC API entegrasyonu.
- Commit→receipt crash recovery, ordered gap/poison isolation ve lane mismatch reject.
- Business PASS + cleanup failure persistence/API/UI outcome isolation.
- Active run hot reload sırasında pinned bundle/graph/reducer isolation.
- Explicit EmitOutcome, WAL-only, inbox/receipt+ordered-gap, normalization-error,
  correlation-miss ve evaluation-pending Journey fixture'ları.
- Evidence yokluğunda SDK failure üretmeyen negative diagnostic integration testi.
- Bridge action lifecycle + SDK InteractionCapture korelasyonunda injected/manual/
  unknown origin ayrımı ve human-metric isolation.
- Failure scoped capture + quota/redaction/retention ve successful-step no-dump
  integration testi.

### Page/browser

- Yedi workspace icon rail ve secondary navigation snapshot/interaction testi.
- H.5'teki bütün target route'lar için navigation + direct URL + browser refresh.
- Dynamic `/product/feature-library/[slugName]`, `/automation/[id]`,
  `/automation/[id]/runs/[runId]` ve `/automation/domain-packs/[packId]` parametre/
  not-found testi.
- `/automation/overview` redirect ve eski korunmuş deep-link testleri.
- Domain Pack catalog/detail tab, unsaved change, conflict, publish/migrate ve RBAC.
- Platform RBAC/Nesy Dashboard auth/SDK run-auth state ayrımı; pack/list/history
  sayfalarının gereksiz Nesy login ile bloklanmaması.
- Live Inspector Observe/Act; production read-only ve API-side deny.
- Loading, empty, partial, disconnected, blocked, stale ve terminal error state'leri.
- Capability/app-version/pack mismatch reason ve remediation.
- Workflow preview hash = executed plan hash.
- Run/occurrence isolation ve başka run evidence'ına erişememe.
- Current Architecture ve Modernization checkpoint/evidence page acceptance.
- Product/PM/Engineering Tools/Data Center/ADB kalıcı sayfa regression suite'i.
- Placeholder `BACKLOG` ile unexpected broken route ayrımı.
- Maestro/YAML UI label/button/request/renderer legacy-zero browser scan'i.
- Responsive, keyboard, screen-reader ve focus restoration testi.
- Drawer-first acceptance: Evidence Journey/repro read model'i olmadan live badge
  release edilmemesi; 6A→6B→6C dependency testi.
- Compact applicable badge ile dört-plane detail snapshot tutarlılığı.
- Out-of-order/reconnect evidence revision'ında bağımsız badge state ve sahte
  sequential chronology animation olmaması.
- Interaction origin/confidence filtresi ve missing artifact `NOT_CAPTURED` görünümü.

### Device

- SDK authenticated vertical slice.
- Bridge command smoke.
- Multi-device port isolation.
- Full courier workflow.
- Process death.
- IME/foreign-window/manual touch.
- Stable rowKey ile değişen liste sırasını doğru çözme.
- Action response öncesi Bridge process death ve unknown-effect recovery.
- Device reboot sonrası clock calibration yenileme.
- Runtime stop/task/shipment/parcel entity discovery ve nested FOR_EACH.
- Expected/interrupt `wait_any` event-storm, cancellation ve full-dump-free happy path.
- Wait başında already-ready initial match ve event-siz bounded safety-rescan match.
- Command admission tek mutation, bounded observation/wait, control fairness ve
  mutation→wait/treeGen invalidation.
- Real/injected/manual scanner mode; automation-release isolation.
- FULL_JOURNEY/PREPARED_SESSION/DIRECT_STATE profile matrisi.
- Logical Screen + active Surface concurrent detection matrisi.
- UI'da görünmeyen stable entity id için bounded target binding; bulk collection
  stream edilmediğinin doğrulanması.
- Bridge action injected interval, operatör manual contamination ve korelasyonsuz SDK
  click için `BRIDGE_INJECTED/MANUAL/UNKNOWN` cihaz matrisi.
- Ambiguity/timeout/unknown effect failure scoped capture ve normal successful step
  full-dump-free cihaz doğrulaması.

### Durability/soak

- API kill/restart.
- Bridge kill/restart.
- App kill -9/force-stop.
- ADB disconnect/reconnect.
- Low disk.
- Host DB temporary outage.
- Commit ile receipt publish arasındaki host crash ve receipt cursor resume.
- Ordered poison/gap varken bağımsız receipt-safe Continue Gate.
- Power/USB loss.
- `wait_any` worker/index leak, cancel/timeout/reconnect ve event-storm soak.
- SDK observation coalescing/rate/payload budget soak.
- Domain Pack hot reload/cache invalidation/migration soak.
- Aktif run pinned bundle/derived graph/reducer ile hot-reload isolation soak.
- Cleanup retry/failure sırasında business verdict immutability soak.
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
- WorkflowIR v2 completion gate ve Domain Pack contract suite.
- Release build App Adapter/scanner/direct-state isolation gate.
- `wait_any` payload size ve hot-path full-dump prohibition gate.
- Evidence Source/registry schema, HTTP transport-vs-business ve observation budget
  contract gate'leri.
- Receipt/Ordered lane schema, order-sensitive binding rejection ve restart-resume
  integration gate'i.
- Device Command Admission concurrency/fairness ve initial/safety wait gate'i.
- Unified OracleRequirement, orthogonal run outcome ve cleanup-verdict isolation gate'i.
- Derived Fact DAG/cycle/idempotency, immutable bundle integrity ve active-run
  hot-reload isolation gate'i.
- `PageMigrationManifest` full H.5 coverage, unique route, owner, target source,
  checkpoint, acceptance ref ve transition-expiry gate'i.
- Page/browser route, dynamic deep-link, RBAC, availability ve non-regression suite'i.
- Domain Pack manager published-immutability/concurrency/RBAC suite'i.
- UI build/snapshot/request scan'inde Maestro/YAML legacy-zero gate'i.
- Evidence Journey/negative-evidence, origin resolver ve repro capture manifest
  unit/contract gate'leri.
- Occurrence applicability snapshot authority ve compact/detail presentation browser
  gate'i; workflow web registry runtime override edemiyor.
- Successful-step full-dump prohibition ve failure scoped-capture policy gate'i.

Protected integration job:

- Disposable PostgreSQL.
- WS ingest/fan-out/restart.
- Commit→receipt crash window, receipt cursor resume, ordered gap/poison lane isolation.
- Fake Bridge integration.
- Command admission/mutation invalidation/Inspector denial integration.
- Old run read compatibility.
- Page target DTO + Debug/Automation data-source cutover integration.
- Domain Pack Admin API ve Modernization checkpoint read-model integration.

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
| Aynı text, farklı business rowKey | Yalnız doğru satır çözülür |
| `rowIndexHint` fakat sıra değişmiş | Kör tap yok; fingerprint yeniden çözülür |
| Gesture sonrası response öncesi process death | Persisted lifecycle veya `UNKNOWN_EFFECT` |
| Sabit koordinat workflow'u | Compile/runtime reject |
| `performAction` allowlist dışı | Reject |
| `wait_any` expected match | Küçük correlated `EXPECTED_MATCH`, dump payload yok |
| Aynı evaluation'da birden fazla target | `AMBIGUOUS`, action/continue yok |
| `wait_any` interrupt match | `INTERRUPT_MATCH`; doğru run/occurrence kesilir ve evidence oluşur |
| Run/session/epoch mismatch wait | Reject/drop + audit |
| Long wait sırasında `cancel_request` | Reader cancel'ı okur; tek `CANCELLED` terminal sonucu |
| Match/timeout/cancel race | First terminal wins; duplicate terminal persist edilmez |
| Cancel terminal sonuçtan sonra | İdempotent `ALREADY_TERMINAL` ack |
| Socket close/run end | In-flight worker ve index cleanup; sonradan result yok |
| Aynı anda response yazan worker'lar | Serialized, parse edilebilir NDJSON |
| Accessibility event storm | Bounded evaluation/rate; process veya run bozulmaz |
| Hedef wait başlarken zaten hazır | Initial scoped evaluation ile event beklemeden match |
| Accessibility event hiç gelmiyor | Bounded scoped safety rescan match; full-tree polling yok |
| Mutation sırasında active wait | Eski generation invalidate; yeni scoped evaluation; wait mutation'ı bloke etmez |
| İki paralel mutation | İkincisi admission kuyruğunda/reject; aynı anda fiziksel dispatch yok |
| Control/cancel yoğun observation altında | Priority/fairness ile starvation olmadan işlenir |
| Observation limiti/heavy screenshot fırtınası | Bounded quota/backpressure; mutation ve control bozulmaz |
| Aktif run sırasında Inspector Act | API/Bridge fail-closed deny; yalnız explicit takeover sonrası izin |
| Manuel fiziksel dokunma | Contamination evidence + stop/attention policy; sessiz PASS yok |
| İlk B2 unsolicited frame/register komutu | Capability/protocol reject |
| Diagnostic full dump | Yalnız açık capture/Inspector artifact kanalında |

## G.5 Workflow/oracle test matrisi

- Aynı node tek occurrence.
- Aynı node retry attempt'leri.
- Aynı node 20 loop occurrence'ı.
- İki aynı type node; event yalnız doğru occurrence'a gider.
- UI pass + App missing.
- App pass + Remote fail.
- Offline queue accepted.
- UI-only node'da diğer katmanlar `NOT_APPLICABLE`.
- Required katman pending ile not-measured ayrımı.
- HTTP 200 + business reject → `FAIL_REMOTE`.
- HTTP 202 + entity pending → `PENDING_REMOTE`.
- HTTP 500 + local offline queue → `PASS_QUEUED_OFFLINE`.
- HTTP 200 + backend entity değişmedi → deadline'a kadar pending, sonra fail.
- Late event.
- Duplicate/replayed event.
- Branch TRUE/FALSE/UNKNOWN.
- Loop max exceeded.
- Unknown dialog.
- Cancel while waiting event.
- Cancel while Bridge action uncertain.
- Host restart between action and evidence.
- Aynı evidence'in farklı clock domain'lerde marker/uncertainty ile sıralanması.
- Reboot sonrası eski offset'in reddedilmesi.
- Optional LLM açıklamasının deterministic result'u değiştirememesi.
- WorkflowIR v2 tamamlanmadan Domain Pack compatibility suite'in fail etmesi.
- Domain macro'nun generic IR v2 adımlarına deterministik expansion'ı.
- Runtime entity query'nin bounded olması ve 20 item için ayrı occurrence üretmesi.
- Continue Gate hazır olduğunda deadline beklemeden ilerleme.
- Final Oracle local/remote eventual evidence'i terminal sonuca bağlama.
- Raw event ile derived fact'in aynı provenance zincirinde görünmesi.
- Canonical technical evidence replay'inin tek idempotent normalized fact üretmesi.
- Primary/confirmatory evidence conflict'in `EVIDENCE_CONFLICT` üretmesi.
- Stale veya başka occurrence'a ait fact'in Continue Gate/Final Oracle'ı geçirememesi.
- HTTP 2xx transport fact'inin tek başına `ROUTES_AVAILABLE` üretmemesi.
- Queue'nun Local subtype olarak kalması ve ayrı evidence plane/rozet üretmemesi.
- App State'in App source'u olması ve ayrı plane oluşturmaması.
- Launch Profile entry başarı + readiness failure → launch fail.
- Current logical screen ile active dialog/surface'in birlikte bulunabilmesi.
- Node-type fan-out'un repeated delivery occurrence'larında kesin reddi.
- Fixed sleep/sahte never-match selector compile rejection.
- Commit edilmiş receipt-safe fact'in ordered gap/poison arkasında kalmadan Continue
  Gate'i uyandırması.
- Ordered-required fact'in Receipt Bus subscriber'ına bağlanmasının compile/runtime
  rejection'ı.
- Commit sonrası receipt publish öncesi process crash ve inbox cursor resume.
- Business PASS + cleanup FAILED → PASS korunur, cleanup FAILED ve
  `NEEDS_ATTENTION` ayrı sonuçlanır.
- Cancelled/aborted run'ın business verdict yerine termination reason üretmesi.
- Oracle requirement'ta REQUIRED+EVENTUAL ve deadline timeout→INCONCLUSIVE kuralı.
- Derived fact cycle/self/undefined dependency publish rejection.
- Derived reducer replay'inin input set + reducer version ile idempotent olması.
- Aktif run sırasında Domain Pack hot reload: pinned bundle/graph/reducer değişmez;
  yeni version yalnız yeni run'da kullanılır.
- Runtime'ın arbitrary TypeScript/JavaScript Domain Pack yüklemesini reddetmesi.
- Event görünmedi fakat emit outcome/WAL kanıtı yok → `UNKNOWN/NOT_OBSERVED`, SDK fail değil.
- Explicit `NO_SPACE` → WAL acceptance fail; transport/host stage'leri kanıtsız fail değil.
- WAL confirmed + inbox yok → transport/ingest aralığı unresolved; “emit edilmedi” değil.
- Inbox/receipt confirmed + ordered gap → ordered `BLOCKED`; receipt kayıp değil.
- Normalization error ve correlation miss ayrı Journey stage/reason üretiyor.
- Fact present + Oracle deadline açık → evaluation `PENDING`; erken failure değil.
- Compact görünüm yalnız applicable layer'ları; detail dört plane'i explicit state ile
  aynı occurrence snapshot'ından gösteriyor.
- Farklı evidence arrival sıraları badge animasyon sırasına çevrilmiyor; waterfall
  gerçek calibrated chronology'yi gösteriyor.
- Bridge injected click manual sayılmıyor; korelasyonsuz SDK click `UNKNOWN` kalıyor.
- Normal step repro'sunda dump yok; failure scoped capture varsa exact hash/ref,
  yoksa `NOT_CAPTURED` var.
- Test Profile yeni engine/runner oluşturmadan aynı WorkflowIR/BridgeFlow runtime'ına
  compile ediliyor.
- Recovery/Bad Day fault trigger correlation yoksa fail-closed oluyor.
- Differential Regression baseline build'deki critical fact sequence ile candidate
  build farkını evidence/fact/oracle seviyesinde yakalıyor.
- Campaign cell sonucu gerçek run/evidence summary olmadan PASS/FAIL göstermiyor.
- Preview accessibility/explorer profilleri release gate sonucunu değiştirmiyor.

## G.6 Performans bütçeleri

Baseline CP0'da ölçülür; sabit sayılar ölçüm olmadan uydurulmaz. CP0 sonunda draft,
CP3 fiziksel Bridge ölçümünden sonra command/wait bölümü, CP8 öncesinde cutover
bölümü dondurulmuş `PerformanceBudget v1` olur. Her budget şu boyutları taşır:

- Device model/API, build variant ve SDK/Bridge/Cockpit version.
- Lab/CI ortamı, network profili, battery/thermal başlangıç durumu ve power policy.
- Sample size, warm-up, p50/p95/p99, confidence/outlier politikası.
- Absolute safety limiti, baseline'a göre regression limiti ve release limiti.
- Measurement command/script, raw artifact hash'i, owner, approvedAt ve expiry.

En az şu trendler ve bütçeler izlenir:

- WS auth süresi.
- Event commit-to-ACK.
- Commit-to-receipt dispatch ve receipt subscriber wake latency.
- Commit-to-ordered-consumer ve ordered reducer latency.
- Receipt/ordered cursor lag ve restart catch-up süresi.
- Receipt-safe ve ordered-required `waitEvent` latency.
- Bridge ping/action/wait_node/wait_any ve cancellation latency.
- Scoped dump node sayısı ve süre.
- Screenshot süre/boyut.
- Compiler süre ve plan boyutu.
- Executor overhead.
- Full courier toplam süre.
- Device CPU/thermal/WakeLock.
- Clock calibration round-trip, offset uncertainty ve calibration yaşı.
- TargetFingerprint resolution latency ve drift rate.
- Command→effect verification waterfall latency.
- Predicate reevaluation, scoped recovery-scan sıklığı ve hot-path full-dump violation.
- Observation received/canonicalized/coalesced/dropped rate ve payload budget.
- Evidence source resolution/normalization ve Continue Gate/Final Oracle ayrı latency.
- Evidence Journey stage latency, pending/blocked/not-observed/failed dağılımı ve
  classifier conflict oranı.
- SDK bounded diagnostic query rate/payload/age; explicit EmitOutcome availability.
- Interaction origin injected/manual/unknown dağılımı ve human-baseline exclusion.
- Repro capture requested/captured/skipped/failed oranı, scoped artifact size ve
  successful-step dump violation sayısı.
- Test Profile compile/run latency ve profile expansion plan size.
- Campaign cell duration, blocked/precondition oranı, failedCells ve evidence summary
  üretim süresi.
- Recovery/Bad Day fault trigger observed→applied latency ve correlation miss oranı.
- Differential Regression comparison latency, missing critical fact count ve accepted
  allowed-diff count.
- Compatibility matrix device-cell pass/fail/blocked dağılımı.
- Load/Soak profile memory slope, thread/fd trend, queue residual ve crash/ANR oranı.

Ölçümden bağımsız mutlak correctness kapıları:

- Hot execution path full-tree dump sayısı `0`.
- Golden suite false-pass artışı `0`.
- Receipt/ordered lane ayrımı nedeniyle event veya audit kaybı `0`.
- Aynı cihazda eşzamanlı fiziksel mutation sayısı en fazla `1`.
- Active run hot reload ile bundle/graph/reducer değişimi `0`.
- Kanıtsız event yokluğundan türetilen kesin SDK failure sayısı `0`.
- Successful normal step'te otomatik full-tree dump sayısı `0`.
- Test Profile nedeniyle açılan ikinci execution engine/runner sayısı `0`.
- Preview profile'ın release GO/NO_GO sonucunu overwrite ettiği durum sayısı `0`.
- Campaign cell'in run/evidence deep-link'i olmadan PASS gösterdiği durum sayısı `0`.

`p95 250 ms`, `SDK CPU %2`, `heap 10 MB` veya “Maestro süresinin %70'i” gibi
değerler ölçüm öncesi yalnız örnek olabilir; profile-specific artifact ve onay olmadan
master release eşiği sayılmaz. Budget değişikliği versioned amendment ve yeniden
baseline ister; geçmiş checkpoint kanıtı yerinde değiştirilmez.

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
- Test Profile/Campaign kanıtı gerekiyorsa profileKey/version, campaignId, buildRef,
  scheduleClass, device cell, datasetRef, faultPlanRef, telemetryPolicy ve
  evidenceSummaryRef.

## G.7A Nesy v1 Test Profile kabul matrisi

V1 Test Profile kabulü, genel test piramidinin yerine geçmez; Nesy'ye sunulacak ürün
kataloğunun gerçekten çalıştığını gösteren profile-level acceptance katmanıdır.

| Profile sınıfı | Minimum kabul |
|---|---|
| Smoke | PR veya RC build için temel kurye yolu UI/App/Local/Remote evidence ile PASS |
| Critical Regression | Kritik business akışları aynı Domain Pack ve Oracle üzerinden koşar |
| Differential Regression | Missing critical fact veya Oracle requirement farkı raporlanır |
| Recovery | Process kill/force stop/token/offline recovery duplicate üretmeden açıklanır |
| State-Aware Bad Day | Fault business fact/surface/source trigger ile uygulanır |
| Contract/Consistency | HTTP schema, used field, local state ve remote outcome birlikte doğrulanır |
| Load | NORMAL/BUSY veri profilleri PerformanceBudget ile ölçülür |
| Compatibility | Device/capability cell bazında PASS/FAIL/BLOCKED sonucu üretir |
| Short Soak | Memory/thread/fd/queue residual ve crash/ANR izlenir |
| Security/Release Isolation | Release APK automation yüzeyi sızıntısında fail-closed |
| Preview Accessibility/Explorer | Sinyal üretir, release gate veya Final Oracle authority olmaz |

## G.8 Checkpoint work-package standardı

Master plan mimari karar, kapsam, faz sırası ve DoD için tek SSOT'tur. Uygulamanın
günlük yürütülmesi için her checkpoint versioned çalışma paketi üretir; paket master
contract'ı kopyalayıp değiştiren ikinci plan değildir.

Önerilen dosyalar:

```text
docs/verdict/work-packages/
├── CP0_BASELINE.md
├── CP1_AUTH_EXECUTION.md
├── CP2_EVENT_LANES.md
├── CP3_BRIDGE_ADMISSION_WAIT.md
├── CP4A_WORKFLOW_IR_V2.md
├── CP4B_DOMAIN_PACK.md
├── CP4C_COMPILER.md
├── CP5_RUNTIME_ORACLE_PERSISTENCE.md
├── CP6_COCKPIT_UI.md
├── CP7_NESY_REFERENCE_E2E.md
├── CP8_PHYSICAL_CUTOVER.md
└── CP9_MAESTRO_REMOVAL.md
```

Her work package zorunlu olarak şunları taşır:

1. `masterPlanPath`, master plan version ve SHA-256 digest.
2. Checkpoint ID, owner/reviewer, durum ve hedef tarih.
3. Kapsam, kapsam dışı ve bağımlı checkpoint'ler.
4. Yalnız referans verilen dondurulmuş contract/karar ID'leri; farklılaştırılan
   contract metni değil.
5. Değiştirilecek tahmini paket/dosya sınırları.
6. Uygulama adımları, migration ve rollback/recovery notları.
7. Unit/contract/integration/device/soak test listesi ve exact komutlar.
8. Beklenen evidence/artifact, hash, metric ve exit criteria.
9. Açık risk/blocker, owner ve NO_GO koşulu.
10. Uygulama sonunda commit/branch/dirty state ve gerçek değişiklik özeti.

Published work-package revision immutable'dır; düzeltme yeni revision/amendment
oluşturur. Master digest uyuşmazsa paket `STALE` olur ve execution/release kanıtı
olarak kullanılamaz. Work package master plandaki faz sırasını, P0 kararı veya
“yapılmayacaklar” hükmünü sessizce override edemez.

## G.9 Business Validation Gates

Bu kapılar CP0–CP9 teknik checkpoint'lerinden ayrıdır.

CP0–CP9 şu sorulara cevap verir:

- Platform doğru çalışıyor mu?
- Security, durability ve device acceptance kapıları geçildi mi?
- WorkflowIR v2, Domain Pack, BridgeFlowExecutor, Final Oracle ve Evidence Journey
  teknik olarak kabul edildi mi?
- Maestro cutover ölçümlü ve güvenli mi?
- Cockpit UI hedef route'ları, data source'ları ve DoD kriterleriyle tamamlandı mı?

Business Validation Gates ise farklı sorulara cevap verir:

- Ürün gerçek müşteri değeri üretiyor mu?
- Nesy dışındaki ikinci bir uygulamaya taşınabiliyor mu?
- Domain Pack ürünleşmiş bir contract mı, yoksa her müşteri için sıfırdan danışmanlık
  işi mi gerektiriyor?
- Onboarding maliyeti ve tekrar kullanılabilirlik ölçülebilir mi?
- Müşteri veya design partner Verdict çıktısını gerçek mühendislik, QA veya release
  kararında kullanıyor mu?
- Ticari talep ücretli pilot, yazılı taahhüt veya bütçeli design partnership ile
  doğrulandı mı?

Bu iki eksen ayrı raporlanır:

```text
Technical Platform Readiness
Commercial Product Validation
```

Teknik platform DONE olabilirken commercial validation henüz tamamlanmamış olabilir.
Tersi de mümkündür: güçlü müşteri ilgisi veya design partner sinyali, CP0–CP9 teknik
kapılarını bypass ettiremez. Release, yatırımcı raporu ve roadmap iletişiminde bu iki
sonuç birbirinin yerine kullanılmaz.

### BVG-1 — Nesy Hero Workflow

Gerçek DUT üzerinde en az bir kritik kurye akışı tekrar edilebilir biçimde tamamlanır.

Minimum kabul:

- Workflow published Domain Pack ve active Test Profile üzerinden çalışır.
- UI/App/Local/Remote düzlemlerinden occurrence contract'ına göre uygulanabilir olan
  kanıtlar gösterilir.
- Aynı seed, fixture, build, device capability snapshot ve launch profile ile tekrar
  koşulabilir.
- Failure durumunda Evidence Journey ve repro paketi üretilebilir.
- Run Detail sonucunda hangi kanıtın authoritative, hangi kanıtın confirmatory olduğu
  görülebilir.
- Offline queue, local persistence, route/session state veya remote confirmation gibi
  Nesy için kritik iş sonucu katmanları uygulanabilirse açıkça doğrulanır.

Bu kapı demo akışının “bir kez çalışması” değildir. Tekrar edilebilirlik, kanıt
zinciri, failure açıklaması ve reproducibility paketinin birlikte üretilmesi gerekir.

### BVG-2 — Ölçülmüş Değer

En az bir gerçek problem veya operasyonel iyileşme sayısal olarak gösterilmelidir.

Ölçülebilecek alanlar:

- Regression süresi.
- Manual QA süresi.
- Hata yeniden üretme süresi.
- False-pass sayısı.
- Silent inconsistency detection.
- Recovery defect detection.
- Release decision süresi.
- Campaign inceleme süresi.
- Device/capability matrix coverage.

Örnek ölçüm biçimi:

```text
Önce: 2 gün manuel doğrulama
Sonra: 3 saat campaign + 20 dakika inceleme

Önce: Hata 4 saatte reproduce ediliyor
Sonra: 12 dakikada exact repro
```

Bu rakamlar önceden uydurulmaz ve master plana sabit performans eşiği olarak yazılmaz.
Pilot veya design partner koşumunda ölçülür, evidence artifact ile saklanır ve
versioned raporda belirtilir.

### BVG-3 — İkinci Uygulama Taşınabilirliği

İkinci uygulama doğrulaması yalnız “başka uygulamada bir demo çalıştı” anlamına gelmez.
Amaç, Verdict Core'un app-specific branch almadan taşınabildiğini kanıtlamaktır.

Başarı kriterleri:

```text
Core runtime değişmeden yeni Domain Pack yüklendi.
Bridge protocol değişmedi.
WorkflowIR union genişlemedi.
Final Oracle engine'e app-specific branch eklenmedi.
Nesy kaynakları ikinci uygulama için kopyalanmadı.
Yeni domain kavramları Core içine sızmadı.
```

Ölçülmesi gerekenler:

```text
Core değişiklik oranı
Domain Pack geliştirme süresi
Reusable capability oranı
App-specific adapter LOC
Onboarding sırasında gereken manuel mapping sayısı
Yeni evidence source ihtiyacı
Yeni semantic action sayısı
```

Maçkolik gibi UI/performance/interaction ağırlıklı bir ikinci domain burada değerlidir,
çünkü Nesy'nin offline kurye/transaction karakterinden farklı bir doğrulama profili
oluşturur. Bu test, Core'un Nesy'ye daralmadığını gösterir.

### BVG-4 — Domain Pack Ürünleşmesi

Domain Pack yaklaşımı her müşteri için sıfırdan yazılan danışmanlık işine dönüşmemelidir.
İlk ürünleşme hedefi, yeni uygulama onboarding'inin büyük bölümünün generic contract,
registry ve capability'lerle yapılabilmesidir.

Başlangıç hedefi:

```text
Domain Pack'in en az %70–80'i
mevcut generic contract ve capability'lerle kurulabilmeli.
```

Yeni uygulama onboarding'inde:

```text
- yeni runtime yazılmamalı
- yeni executor yazılmamalı
- yeni Oracle engine branch'i yazılmamalı
- Bridge protocol app'e göre değiştirilmemeli
- app-specific code Core'a eklenmemeli
- mümkün olan yerlerde Screen/Surface/Evidence/Launch/Test Profile registry authoring
  kullanılmalı
```

Bu yüzdeler ilk ölçümlerden sonra revize edilebilir. Başta bağlayıcı performans eşiği
veya yatırımcı iddiası yapılmaz; BVG raporu gerçek onboarding verisiyle üretilir.

### BVG-5 — Design Partner Validation

En az bir müşteri veya design partner Verdict çıktısını gerçek bir karar sürecinde
kullanmalıdır.

Minimum kabul:

```text
Design partner gerçek workflow seçer.
Acceptance criteria'yı onaylar.
Campaign sonucunu inceler.
Bulgu üzerinden mühendislik, QA, operasyon veya release kararı verir.
```

“Demo beğenildi”, “sunum etkileyici bulundu” veya “pilot konuşuluyor” yeterli değildir.
Ürün gerçek bir kararın parçası olmalıdır. Verdict'in değeri ancak müşterinin kendi
release, regression, recovery veya incident sürecinde kanıt üretince doğrulanır.

### BVG-6 — Commercial Validation

Commercial validation teknik completion criterion değildir; ticari olgunluk kriteridir.

Minimum sinyallerden en az biri gerekir:

```text
Ücretli pilot
veya
yazılı pilot taahhüdü
veya
ölçülebilir bütçeli design partnership
```

Bu kapı teknik release'i otomatik durdurmaz. Ancak yatırım, satış, fiyatlandırma,
market positioning ve şirketleşme anlatısında teknik readiness'ten ayrı gösterilir.

## G.10 Future Intelligence Direction — Non-binding

Toplanan versioned execution, evidence, failure ve reproduction verileri gelecekte daha
akıllı ürün katmanlarını besleyebilir.

Olası yönler:

- failure similarity
- historical execution memory
- cross-build risk prediction
- change impact learning
- failure boundary minimization
- generative investigation workspace
- Failure Genome
- Verified Execution Memory
- uzun vadeli Proof Loop zekâsı
- autonomous failure minimization
- self-learning Oracle önerileri

Bu yönler CP0–CP9, Nesy v1, Maestro cutover veya Cockpit v1 için requirement veya
blocker değildir. DGX, özel GPU altyapısı, tamamen otonom explorer veya generative
investigation'ın tam kapsamı master planın zorunlu implementasyon sırasına eklenmez.

Bu katmanlar ancak şu koşullardan sonra bağlayıcı roadmap'e alınabilir:

1. Core deterministic runtime gerçek DUT üzerinde kabul edilmiştir.
2. Evidence Journey ve repro paketleri güvenilir şekilde üretilmektedir.
3. Test Profile/Campaign verileri versioned ve karşılaştırılabilir hale gelmiştir.
4. AI çıktısının deterministic Oracle hükmünü değiştirmeyeceği güvenlik ve ürün
   ilkeleri korunmaktadır.
5. Veri redaction, retention, tenant isolation ve audit politikaları hazırdır.

Bu bölüm yön gösterir; teknik checkpoint'i, release gate'i veya müşteri teslim
kapsamını genişletmez.

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
- `RECEIPT_DISPATCH_RETRYING`
- `RECEIPT_CURSOR_STALE`
- `EVIDENCE_DELIVERY_LANE_MISMATCH`
- `EVENT_WAIT_TIMEOUT`
- `EVENT_CORRELATION_MISS`
- `EVIDENCE_EMIT_OUTCOME_UNOBSERVED`
- `EVIDENCE_JOURNEY_INCOMPLETE`
- `EVIDENCE_STAGE_CONFLICT`

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
- `BRIDGE_TARGET_NOT_FOUND`
- `BRIDGE_DISPATCH_REJECTED`
- `BRIDGE_GESTURE_FAILED`
- `BRIDGE_EFFECT_NOT_OBSERVED`
- `BRIDGE_PRODUCTION_DENIED`
- `BRIDGE_WAIT_UNSUPPORTED`
- `BRIDGE_WAIT_TARGET_LIMIT_EXCEEDED`
- `BRIDGE_WAIT_AMBIGUOUS`
- `BRIDGE_WAIT_TIMEOUT`
- `BRIDGE_WAIT_CANCELLED`
- `BRIDGE_WAIT_CONNECTION_LOST`
- `BRIDGE_WAIT_STALE`
- `BRIDGE_WAIT_FENCING_MISMATCH`
- `BRIDGE_WAIT_RESPONSE_TOO_LARGE`
- `BRIDGE_CANCEL_TARGET_NOT_FOUND`
- `BRIDGE_HOT_PATH_FULL_DUMP_REJECTED`
- `BRIDGE_ADMISSION_LIMIT_EXCEEDED`
- `BRIDGE_MUTATION_CONFLICT`
- `BRIDGE_OBSERVATION_BACKPRESSURE`
- `BRIDGE_INSPECTOR_ACT_DURING_RUN`
- `BRIDGE_WAIT_RESCAN_BUDGET_EXCEEDED`

### Workflow

- `COMPILE_INVALID_GRAPH`
- `COMPILE_UNSUPPORTED_NODE`
- `COMPILE_UNBOUNDED_LOOP`
- `COMPILE_UNSAFE_RETRY`
- `COMPILE_DOMAIN_PACK_MISSING`
- `COMPILE_DOMAIN_PACK_INCOMPATIBLE`
- `COMPILE_APPLICATION_INCOMPATIBLE`
- `COMPILE_SCREEN_DEFINITION_MISSING`
- `COMPILE_SURFACE_DEFINITION_MISSING`
- `COMPILE_LAUNCH_PROFILE_INCOMPATIBLE`
- `COMPILE_TEST_PROFILE_INVALID`
- `COMPILE_TEST_PROFILE_ENGINE_FORBIDDEN`
- `COMPILE_TEST_PROFILE_BASELINE_MISSING`
- `COMPILE_TEST_PROFILE_FAULT_UNCORRELATED`
- `COMPILE_TEST_PROFILE_PREVIEW_RELEASE_GATE`
- `COMPILE_APP_ADAPTER_CAPABILITY_MISSING`
- `COMPILE_EVIDENCE_SOURCE_MISSING`
- `COMPILE_EVIDENCE_SOURCE_INCOMPATIBLE`
- `COMPILE_DOMAIN_EXPANSION_INVALID`
- `COMPILE_DERIVED_FACT_CYCLE`
- `COMPILE_DERIVED_FACT_DEPENDENCY_MISSING`
- `COMPILE_EVIDENCE_DELIVERY_LANE_INVALID`
- `COMPILE_ORACLE_REQUIREMENT_INVALID`
- `DOMAIN_PACK_BUNDLE_INTEGRITY_FAILED`
- `DOMAIN_PACK_ACTIVE_RUN_PIN_MISMATCH`
- `COMPILE_FIXED_WAIT_FORBIDDEN`
- `CONDITION_UNKNOWN`
- `CONTINUE_GATE_TIMEOUT`
- `FINAL_ORACLE_PENDING`
- `FINAL_ORACLE_TIMEOUT`
- `ENTITY_QUERY_LIMIT_EXCEEDED`
- `ENTITY_CORRELATION_MISS`
- `STEP_TIMEOUT`
- `EVIDENCE_MISSING`
- `EVIDENCE_CONFLICT`
- `EVIDENCE_STALE`
- `EVIDENCE_NORMALIZATION_FAILED`
- `EVIDENCE_SOURCE_CORRELATION_MISS`
- `OBSERVATION_BUDGET_EXCEEDED`
- `LOCAL_ASSERTION_FAILED`
- `REMOTE_ASSERTION_FAILED`
- `REMOTE_BUSINESS_REJECTED`
- `REMOTE_CONFIRMATION_PENDING`
- `CLOCK_CALIBRATION_STALE`
- `CLOCK_DOMAIN_UNALIGNED`
- `RUN_STUCK`
- `CLEANUP_FAILED`
- `CAMPAIGN_CELL_BLOCKED`
- `CAMPAIGN_EVIDENCE_SUMMARY_MISSING`
- `DIFFERENTIAL_CRITICAL_FACT_MISSING`
- `SECURITY_RELEASE_ISOLATION_FAILED`

### Page/UI

- `PAGE_ROUTE_NOT_MAPPED`
- `PAGE_TARGET_SOURCE_UNAVAILABLE`
- `PAGE_TARGET_DTO_INCOMPATIBLE`
- `PAGE_CAPABILITY_BLOCKED`
- `PAGE_MIGRATION_REQUIRED`
- `PAGE_LEGACY_ADAPTER_EXPIRED`
- `PAGE_AUTH_CONTEXT_MISMATCH`
- `PAGE_DEEP_LINK_INVALID`
- `DOMAIN_PACK_VERSION_CONFLICT`
- `DOMAIN_PACK_PUBLISHED_IMMUTABLE`
- `DOMAIN_PACK_PUBLISH_FORBIDDEN`
- `INSPECTOR_ACT_FORBIDDEN`
- `INTERACTION_ORIGIN_UNKNOWN`
- `REPRO_CAPTURE_NOT_AVAILABLE`

`EVIDENCE_EMIT_OUTCOME_UNOBSERVED`, `EVIDENCE_JOURNEY_INCOMPLETE`,
`INTERACTION_ORIGIN_UNKNOWN` ve `REPRO_CAPTURE_NOT_AVAILABLE` tek başına failure
verdict'i değildir; diagnostic state/reason olarak authority ve confidence ile
sunulur. Ancak ilgili workflow requirement açıkça bu kanıtı zorunlu kılıyorsa policy
deadline'ı üzerinden terminal karara katkı yapabilir.

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
- target fingerprint version/hash
- action lifecycle state
- device monotonic timestamp/domain
- host monotonic timestamp
- clock calibration ID/offset/uncertainty
- domainPackId/version/hash
- appAdapterVersion/capabilityHash
- entityType/entityId
- eventSeq veya eventSeqRange
- evidenceDeliveryLane/receiptCursor/orderedCursor
- continueGate state/satisfiedAt/reason
- finalOracle requirement/obligation/timing/deadline/onTimeout/result
- lifecycleState/businessVerdict/verdictRevision/terminationReason
- cleanupResult/operationalDisposition
- stepActionResult/stepGateResult/stepOracleResult/stepCleanupResult
- uiWaitRequestId/waitState/expectedOrInterrupt/matchedKey/treeGen
- waitEvaluationReason/safetyRescanCount/admissionLane/admissionQueueAge
- evidenceFactKey/sourceKind/sourceRef/authority/freshness/conflict
- derivedGraphDigest/reducerKey/reducerVersion/inputFactIds
- domainPackBundleDigest/pinnedAt
- applicationKey/screenKey/activeSurfaceKeys/launchProfileKey
- routePattern/pageName/pageAvailability
- pageDataSourceRef/targetDtoVersion/compatibilityAdapter/adapterExpiry
- platformActorRole/nesyAuthState/sdkRunAuthState
- evidenceJourneyId/stage/state/reasonCode/authority/confidence/classifierVersion
- emitOutcome/emitOutcomeObservationSource/diagnosticSnapshotAge
- layerApplicabilitySnapshotId/layerPresentationState/evidenceRevision
- interactionOrigin/originConfidence/gestureStartedDeviceMonoTs/
  gestureCompletedDeviceMonoTs/originSourceRefs
- reproCaptureMode/reproCaptureReason/reproCaptureScope/reproCapturedAt/
  reproArtifactState

Secret, PIN, token ve hassas input değeri taşımaz.

## H.3 Artifact sınıfları

| Sınıf | Örnek | Varsayılan politika |
|---|---|---|
| Normal | Plan, redacted response, metrics | Run retention |
| UI-sensitive | Screenshot, hierarchy dump | RBAC + kısa retention |
| Diagnostic | Perfetto, meminfo | Restricted |
| Highly sensitive | Heap dump | Explicit D3 approval, 24 saat purge, rapora otomatik eklenmez |
| AI input/output | Redacted evidence + optional explanation | Tenant policy, audit, kısa retention; hüküm değildir |

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
| User Interactions | Structured durable event + Bridge action lifecycle | Legacy/logcat sunset sonrası durable primary; injected/manual/unknown origin ayrı |
| Network Inspector | ADB logcat / mevcut network event | Bridge'e taşınmaz |
| Schedule Explorer | ADB run-as | Kalıcı |
| Database Access | ADB run-as/host SQLite | Kalıcı; sql_named ile değiştirme |
| ADB Scenario Runner | ADB + VerdictChannel | Typed control; Bridge UI action ayrı |
| Device Log Explorer | ADB logcat | Kalıcı |
| Automation Editor | Workflow contract/compiler | YAML yerine Plan |
| Test Profile Catalog | Domain Pack TestProfile registry | Smoke/regression/recovery/load/security profilleri |
| Test Campaigns | Campaign/read model + run deep-link | Build/device/profile matrix ve release gate sonucu |
| Field Login | BridgeFlow + VerdictChannel | Özel Maestro yolunu kaldır |
| Load Tour | BridgeFlow | Özel Maestro yolunu kaldır |
| Run Detail | Oracle/evidence/artifact | Dört katman + occurrence + Evidence Journey + exact repro |
| Product Screen Map | Statik + opsiyonel Bridge | Kritik yol değil |
| Version Tracker | Host + ADB install | Kalıcı ADB |

### H.5.1 Home route'ları

| Route | Hedef | Hedef çalışma modeli | Faz/kabul |
|---|---|---|---|
| `/` | KORUNUR | Yedi workspace launcher; runtime bağımlılığı yok | CP6 navigation smoke |
| `/home/this-week` | BACKLOG | Bilinçli placeholder; platform DoD dışında | D.20, broken-route olarak raporlanmaz |
| `/home/quick-actions` | BACKLOG | Bilinçli placeholder | D.20 |
| `/home/strategic-priorities` | BACKLOG | Bilinçli placeholder | D.20 |
| `/home/upcoming-milestones` | BACKLOG | Bilinçli placeholder | D.20 |
| `/home/open-risks-and-blockers` | BACKLOG | Bilinçli placeholder | D.20 |
| `/home/recent-decisions` | BACKLOG | Bilinçli placeholder | D.20 |
| `/home/recent-activity` | BACKLOG | Bilinçli placeholder | D.20 |
| `/home/recent-documents` | BACKLOG | Bilinçli placeholder | D.20 |
| `/home/upcoming-meetings` | BACKLOG | Bilinçli placeholder | D.20 |

### H.5.2 Product route'ları

| Route | Hedef | Hedef çalışma modeli | Faz/kabul |
|---|---|---|---|
| `/product` | KORUNUR | `/product/domain-glossary` redirect | CP6 route regression |
| `/product/domain-glossary` | KORUNUR | Statik ürün/domain bilgi kaynağı; runtime registry değildir | CP6 non-regression |
| `/product/domain-model` | KORUNUR | Split-view ürün modeli; Domain Pack Entity Registry ile zorunlu coupling yok | CP6 non-regression |
| `/product/screen-map` | KORUNUR/HAFİF DÖNÜŞÜR | Statik ürün screen graph; opsiyonel read-only registry/drift provenance overlay | CP6, runtime SSOT olmadığı test edilir |
| `/product/feature-library` | KORUNUR | Feature catalog | CP6 non-regression |
| `/product/feature-library/[slugName]` | KORUNUR | Dynamic feature detail ve invalid-slug state | CP6 deep-link/404 testi |
| `/product/country-matrix` | KORUNUR | Country/feature bilgi matrisi | CP6 non-regression |
| `/product/country-profiles` | KORUNUR | Country profile bilgisi | CP6 non-regression |

### H.5.3 Proje Yönetimi route'ları

| Route | Hedef | Hedef çalışma modeli | Faz/kabul |
|---|---|---|---|
| `/pm/tickets` | KORUNUR | Ticket board; opsiyonel Verdict error/evidence link'i | CP6 non-regression |
| `/pm/releases` | KORUNUR | Production release geçmişi | CP6 non-regression |
| `/pm/versions` | KORUNUR/HAFİF DÖNÜŞÜR | Host + ADB install kalıcı; app/SDK/Bridge/pack compatibility read-only eklenebilir | CP6 version/install regression |
| `/pm/calendar` | BACKLOG | Boş hero; runtime programının dışında | D.20 |
| `/pm/roadmap` | BACKLOG | Boş hero; runtime programının dışında | D.20 |
| `/pm/root-cause` | NAV FIX | Mevcut çalışan sayfa `Ticket Management > Root Cause Intelligence` olarak navigasyona eklenir | CP6 nav/direct-link smoke |

### H.5.4 Engineering route'ları

| Route | Hedef | Hedef çalışma modeli | Faz/kabul |
|---|---|---|---|
| `/engineering/incident-playbook` | KORUNUR | Incident API/session; Verdict error taxonomy link'leri opsiyonel | CP6 non-regression |
| `/engineering/edge-case-map` | KORUNUR | Edge-case pool; Bridge/evidence riskleri data olarak eklenebilir | CP6 non-regression |
| `/engineering/field-tickets` | KORUNUR | Ticket/root-cause/edge-case intelligence | CP6 non-regression |
| `/engineering/current-architecture` | DÖNÜŞÜR | Mevcut, geçiş ve hedef SDK/Bridge/Domain Pack/BridgeFlow diyagramları; active Maestro mimarisi CP9'da yok | CP6 içerik, CP9 legacy-zero |
| `/engineering/modernization-plan` | DÖNÜŞÜR | Boş shell yerine CP0–CP9 checkpoint/owner/blocker/evidence dashboard'u | CP6 real data + empty/error state |
| `/engineering/backend-handbook` | KORUNUR | Backend knowledge; Evidence Source/transport-vs-business link'i opsiyonel | CP6 non-regression |
| `/engineering/screen-manual` | BACKLOG | Placeholder; platform DoD dışında | D.20 |
| `/engineering/mobile-service-atlas` | KORUNUR/HAFİF DÖNÜŞÜR | Service atlas korunur; operation fact → domain fact provenance read-only eklenebilir | CP6 non-regression |
| `/engineering/tools/data-locator` | KORUNUR | Mevcut API catalog/search | CP6 API smoke |
| `/engineering/tools/mongodb-query-generator` | KORUNUR | Mevcut Mongo query API | CP6 API smoke |
| `/engineering/tools/graylog-query-generator` | KORUNUR | Mevcut Graylog query API | CP6 API smoke |

### H.5.5 Debug View route'ları

| Route | Hedef | Hedef çalışma modeli | Faz/kabul |
|---|---|---|---|
| `/debug-view/overview` | DÖNÜŞÜR | ADB runtime + ayrı SDK Control/Event, durable ingest, Bridge, compatibility ve active-run health | CP6 channel-health acceptance |
| `/debug-view/operational-health` | DÖNÜŞÜR | `DeviceReadinessQuery`; preflight reason/remediation ve fail-closed capability gate | CP6 readiness matrix |
| `/debug-view/screen-state` | DÖNÜŞÜR | `LiveInspectorSession`; scoped Bridge observation/action, fingerprint, Screen/Surface mapping, wait state | CP6 Inspector acceptance, production read-only |
| `/debug-view/interactions` | DÖNÜŞÜR | Durable canonical event/fact timeline + injected/manual/unknown origin; ADB SSE primary değildir | CP6 seq/ACK/gap/correlation/origin acceptance |
| `/debug-view/network-inspector` | KORUNUR | Network/logcat telemetry; Bridge'e/body capture'a taşınmaz | CP6 non-regression/security |
| `/debug-view/schedule` | KORUNUR | ADB run-as read-only schedule | CP6 non-regression |
| `/debug-view/database` | KORUNUR | ADB/run-as host SQLite; named query ile değiştirilmez | CP6 non-regression |
| `/debug-view/adb-scenarios` | HAFİF DÖNÜŞÜR | ADB device operation + VerdictChannel typed control; UI action ayrı Bridge command | CP6 typed-action/audit acceptance |
| `/debug-view/log-explorer` | KORUNUR | ADB logcat diagnostic; Oracle primary evidence değildir | CP6 SSE/session regression |

### H.5.6 Data Center route'ları

| Route | Hedef | Hedef çalışma modeli | Faz/kabul |
|---|---|---|---|
| `/data-center/connection` | KORUNUR/KOŞULLU | `NesyAuthProvider`; SDK run auth ile birleştirilmez | CP6 auth/session regression |
| `/data-center/shipment` | KORUNUR/KOŞULLU | Mevcut shipment service ve Nesy auth | CP6 CRUD/auth smoke |
| `/data-center/pickup` | KORUNUR/KOŞULLU | Mevcut pickup service ve Nesy auth | CP6 CRUD/auth smoke |
| `/data-center/happy-path` | KORUNUR/KOŞULLU | Backend fixture/happy-path operasyonu; executor yerine geçmez | CP6 CRUD/auth smoke |
| `/data-center/users` | KORUNUR/KOŞULLU | User/device/PIN/wallet operasyonu; secret redaction | CP6 auth/redaction smoke |

### H.5.7 Automation route'ları

| Route | Hedef | Hedef çalışma modeli | Faz/kabul |
|---|---|---|---|
| `/automation/overview` | KORUNUR | `/automation/list` redirect | CP6 redirect smoke |
| `/automation/list` | DÖNÜŞÜR | WorkflowIR/pack/application/compatibility/compile-state catalog | CP4C API, CP6 UI |
| `/automation/history` | DÖNÜŞÜR | Engine-neutral run history/result/provenance; legacy read-only summary | CP5 API, CP6 UI, CP9 legacy-zero |
| `/automation/domain-packs` | YENİ | Pack catalog/create/import/validate/version state | CP4B API, CP6 UI |
| `/automation/domain-packs/[packId]` | YENİ | Tek tab'li registry/action/oracle/profile/migration manager | CP4B API, CP6 UI/RBAC |
| `/automation/test-profiles` | YENİ | Test Profile catalog: core/preview/releaseGate, validation, last campaign state | D.24, CP6 UI |
| `/automation/test-profiles/[profileId]` | YENİ | Profile detail: workflow/launch/dataset/fault/device/telemetry/oracle/schedule provenance | D.24, CP6 UI/RBAC |
| `/automation/test-campaigns` | YENİ | Campaign list: PR/nightly/weekly/release, build/env/status/releaseGateResult | D.24, CP6 UI |
| `/automation/test-campaigns/[campaignId]` | YENİ | Campaign matrix: profile x device/dataset cell, failedCells, evidence summary, run deep-link | D.24, CP6 UI |
| `/automation/features` | YENİ | Feature Registry: product/domain/owner/risk, coverage, health, last failure, impacted workflow | D.25, CP6 UI |
| `/automation/features/[featureId]` | YENİ | Feature detail: screens/components/capabilities/invariants/workflows/dependencies/baseline | D.25, CP6 UI |
| `/automation/components` | YENİ | Component Registry: component instance, screen, capability ref, target ref, visual/perf baseline | D.25, CP6 UI |
| `/automation/capabilities` | YENİ | Capability Contract catalog: reusable semantics, required targets/evidence, generated scenarios | D.25, CP6 UI |
| `/automation/workflow-library` | YENİ | Independent Test Workflow ve Reusable Flow Fragment catalog; fragment terminal verdict üretmez | D.25, CP6 UI |
| `/automation/test-suites` | YENİ | Suite/run-plan composition, dependency graph, schedule, profile ve device matrix | D.25, CP6 UI |
| `/automation/run-planner` | YENİ | Immutable manifest preview, selected/skipped/blocked tests, resource conflicts, impact selection | D.25, CP6 UI |
| `/automation/execution-queue` | YENİ | Queue state, lease owner, heartbeat, retry/orphan recovery ve blocked reason görünümü | D.25, CP6 UI |
| `/automation/coverage-graph` | YENİ | Product/domain/feature/screen/component/capability/test/evidence coverage graph | D.25, CP6 UI |
| `/automation/field-login` | DÖNÜŞÜR | Generic `WorkflowRunApi` + Nesy Courier Domain Pack; özel orchestrator yok | CP7 real DUT |
| `/automation/01-load-tour-flow` | DÖNÜŞÜR | Generic workflow, runtime entity query, nested FOR_EACH, scanner/queue policy | CP7 real DUT |
| `/automation/[id]` | DÖNÜŞÜR | WorkflowIR v2 authoring + Domain Pack + single compiler + BridgeFlowPlan Preview; YAML yok | CP4C compiler, CP6 UI |
| `/automation/[id]/runs/[runId]` | DÖNÜŞÜR | Occurrence/evidence journey/wait/gate/oracle/layer/origin/repro/artifact/clock Run Detail | CP5 API, CP6 UI |

### H.5.8 Route tamamlanma kuralı

Bir route ancak aşağıdakilerin tamamı sağlandığında `DONE` olabilir:

1. Navigation ve direct/deep-link açılıyor.
2. Hedef `PageDataSourceContract` kullanılıyor.
3. Auth/RBAC ve environment policy fail-closed.
4. Loading/empty/error/disconnected/blocked state'leri uygulanmış.
5. Page-level acceptance ve non-regression suite yeşil.
6. Gerekli Maestro/YAML/legacy service/UI kalıntısı sıfır.
7. Observability ve redaction alanları mevcut.
8. Route H.5 matrisindeki checkpoint kanıtına bağlı.
9. Route'un bağlı olduğu manifest/registry/source-map varsa route read modelinde
   immutable digest ve acceptance ref görünür.
10. Route sadece shell render ettiği için `DONE` olmaz; ilgili workflow/run/registry
    state'iyle end-to-end kabul kanıtı taşır.

## H.6 Dosya/paket hedef haritası

| Hedef | Rol |
|---|---|
| `packages/bridge-contract` | Wire/schema/capability/error |
| `packages/bridge-client` | TCP client/lifecycle |
| `packages/workflow-contract` | Editor/IR/plan/evidence shared types |
| `packages/domain-pack-contracts` | Manifest/application/screen/surface/entity/target/action/macro/oracle/evidence-source/query/profile + feature executable/capability/fragment contract'ları; execution queue tipi içermez |
| `packages/execution-contract` | RunManifest, TestExecution, lifecycle, ProductVerdict, EvaluationFailureClass, scheduler disposition, termination, workflow cleanup, resource release, operational disposition, lease, resource requirement/lease/state ve scheduler policy |
| `packages/impact-contract` | ImpactGraph, ChangeReference, CoverageReference, SelectionReason ve impacted workflow/coverage refs |
| `domain-packs/nesy-courier` | Nesy Courier Control Plane Domain Pack |
| `apps/api/src/services/run-secret-registry.ts` | Secret lifecycle |
| `apps/api/src/services/verdict-ws-auth.ts` | Mutual HMAC socket gate |
| `apps/api/src/services/verdict-event-bus.ts` | Durable subscription/waitEvent |
| `apps/api/src/services/bridge-device-manager.ts` | Port/preflight/client ownership |
| `apps/api/src/services/clock-correlation.ts` | Device/host marker, offset ve uncertainty |
| `apps/api/src/services/condition-engine.ts` | Typed condition |
| `apps/api/src/services/domain-pack-registry.ts` | Pack load/version/compatibility/migration |
| `apps/api/src/services/domain-pack-compiler.ts` | Semantic macro/entity/query → generic IR v2 |
| `apps/api/src/services/test-profile-catalog.ts` | Test Profile load/validation/profile detail |
| `apps/api/src/services/test-campaign-service.ts` | Campaign start/matrix/cell result/read model |
| `apps/api/src/services/feature-blueprint-registry.ts` | Feature Blueprint load/validation/owner authority |
| `apps/api/src/services/capability-contract-registry.ts` | Reusable capability contract catalog ve scenario generation |
| `apps/api/src/services/run-manifest-service.ts` | Immutable run manifest, digest pinning ve plan preview |
| `apps/api/src/services/test-execution-queue.ts` | Execution state machine, lease, heartbeat, retry/orphan recovery |
| `apps/api/src/services/test-data-broker.ts` | Resource pool/lease/conflict/cleanup/quarantine yönetimi |
| `apps/api/src/services/dependency-impact-evaluator.ts` | Dependency graph, blocked reason ve PR/build impact selection |
| `apps/api/src/services/evidence-source-registry.ts` | Fact source/authority/correlation/freshness resolution |
| `apps/api/src/services/evidence-normalizer.ts` | Canonical technical evidence → normalized domain fact |
| `apps/api/src/services/evidence-journey.ts` | Emit→WAL→host→fact→Oracle stage classifier/read model |
| `apps/api/src/services/interaction-origin-resolver.ts` | Bridge lifecycle/manual touch/SDK click origin korelasyonu |
| `apps/api/src/services/repro-capture-policy.ts` | Minimal/scoped/explicit capture policy ve manifest |
| `apps/api/src/services/bridge-flow-compiler.ts` | IR → plan |
| `apps/api/src/services/bridge-flow-executor.ts` | Plan runtime |
| `apps/api/src/services/bridge-ui-wait-runtime.ts` | UiWaitPlan/wait_any/result/cancel routing |
| `apps/api/src/services/workflow-runner.ts` | Engine-agnostic orchestrator |
| `apps/api/src/services/oracle-engine.ts` | Evidence fusion |
| `packages/db/prisma/schema.prisma` | Run/occurrence/evidence persistence |
| `packages/metronic/src/config/layout-21.config.tsx` | Yedi workspace SSOT; Domain Packs ve Root Cause nav ekleri |
| `apps/web/src/config/page-migration-manifest.ts` | Route/source/phase/availability/acceptance SSOT |
| `apps/web/src/app/(cockpit)/automation/domain-packs/page.tsx` | Domain Pack catalog |
| `apps/web/src/app/(cockpit)/automation/domain-packs/[packId]/page.tsx` | Tab'li Domain Pack manager |
| `apps/web/src/app/(cockpit)/automation/test-profiles/page.tsx` | Test Profile catalog |
| `apps/web/src/app/(cockpit)/automation/test-profiles/[profileId]/page.tsx` | Test Profile detail |
| `apps/web/src/app/(cockpit)/automation/test-campaigns/page.tsx` | Test Campaign list |
| `apps/web/src/app/(cockpit)/automation/test-campaigns/[campaignId]/page.tsx` | Campaign matrix/detail |
| `apps/web/src/app/(cockpit)/automation/features/page.tsx` | Feature Registry |
| `apps/web/src/app/(cockpit)/automation/features/[featureId]/page.tsx` | Feature detail |
| `apps/web/src/app/(cockpit)/automation/components/page.tsx` | Component Registry |
| `apps/web/src/app/(cockpit)/automation/capabilities/page.tsx` | Capability Contracts |
| `apps/web/src/app/(cockpit)/automation/workflow-library/page.tsx` | Workflow Library |
| `apps/web/src/app/(cockpit)/automation/test-suites/page.tsx` | Test Suites |
| `apps/web/src/app/(cockpit)/automation/run-planner/page.tsx` | Run Planner |
| `apps/web/src/app/(cockpit)/automation/execution-queue/page.tsx` | Execution Queue |
| `apps/web/src/app/(cockpit)/automation/coverage-graph/page.tsx` | Coverage Graph |
| Automation Web components | WorkflowIR v2 authoring/BridgeFlowPlan preview |
| Debug View Screen State | Live Inspector; mevcut route korunur |
| Run result/detail components | Occurrence/evidence/wait/gate/oracle/repro |
| `apps/web` page-service adapter'ları | PageDataSourceContract ve target DTO versioning |
| `apps/web` route acceptance suite'i | H.5 navigation/deep-link/data-source/legacy-zero testleri |
| NesyMobile `app/src/automation/.../verdict` | Existing komut/state/query/event temelinden App Adapter |
| Opsiyonel AI Design Audit adapter'ları | İz C rule suggestion; runtime dışında |
| Opsiyonel post-run explanation adapter'ı | Redacted evidence açıklaması; hüküm değiştirmez |

Dosya adları implementasyon sırasında repo konvansiyonuna göre küçük ölçüde
değişebilir; paket ve sorumluluk sınırları bağlayıcıdır.

## H.7 Traceability — Mobile blocker → Cockpit işi

| Mobile/Bridge durumu | Cockpit karşılığı |
|---|---|
| `bridge_b1_run_fencing` | Contract/client/executor command envelope ve rejection UI |
| `bridge_b1_process_death_action` | Persisted request/unknown-effect/recovery suite |
| `bridge_b1_c15_device_cases` | Device lab fault harness ve evidence UI |
| SDK `EmitOutcome`/WAL diagnostic görünürlüğü | Faz 2 bounded diagnostic query + D.22 Evidence Journey |
| Bridge injected gesture lifecycle/manual contamination | Faz 3 action marker'ları + D.23 Interaction Origin |
| `bridge_b2_compiler_runtime` | Faz 4A WorkflowIR v2 → 4B Domain Pack → 4C Compiler → Faz 5 runtime |
| `bridge_b2_courier_workflow` | Faz 7–8 |
| Nesy Cockpit v1 profile catalog | D.24 Test Profile Catalog + Faz 7 profile acceptance |
| Maçkolik'e taşınabilir feature/workflow ölçekleme | D.25 Feature Blueprint + Capability Contract + Run Planner + Test Data Broker |
| Nesy semantic node canonical spec | B.10A Reference Specification + D.6C + CP4B |
| Core/Bridge business command sızıntı yasağı | C.56 + CP4A/CP4B contract tests |
| Verdict product thesis / beachhead / trust principle | A.0, A.0A, A.0B |
| Proof presentation ve commercial validation | B.18 + G.9 |
| Cockpit Run Detail evidence/origin/repro | D.22 read model → D.23 drawer-first 6A/6B/6C |
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
8. WorkflowIR v2 kabulü Domain Pack'ten önce tamamlanmış; versioned Domain Pack ve
   Nesy App Adapter compatibility kapıları yeşil.
9. Application/Screen/Surface/Entity/Target/Evidence Source Registry ve semantic
   macro/query/formal Launch Profile/Test Profile contract'ları tam kurye workflow'unda
   ve Nesy v1 profile catalog'unda kullanılıyor.
10. Oracle occurrence bazlı dört kanıt katmanı kullanıyor; Continue Gate ve Final
    Oracle ayrı state/evaluator.
11. Expected/interrupt `UiWaitPlan → wait_any` generic, correlated, fenced ve
    cancellable çalışıyor; normal hot path'te sürekli full dump yok.
12. Canonical technical evidence sequence korunuyor; domain fact derivation trace
    edilebilir ve SDK Core domain business reducer taşımıyor.
13. Yeni run modeli engine-specific eski alanlara bağımlı değil; bu alanlar drop edilmiş.
14. Editor/Inspector/Run Detail yeni runtime'ı eksiksiz sunuyor.
15. Field Login/Load Tour/tam kurye tek omurgada.
16. Security/RBAC/audit/retention kapıları yeşil.
17. Golden cutover BridgeFlow lehine kabul edilmiş.
18. Maestro runtime, driver, CLI, dependency, YAML yolu, feature flag, API/DB alanı,
    UI, script, test, fixture ve aktif doküman yapısıyla projeden tamamen sökülmüş.
19. Korunması gereken eski run verisi yalnız engine-neutral arşiv/summary üzerinden açılıyor;
    özel renderer bulunmuyor.
20. Typecheck/test/integration/device/soak kapıları yeşil.
21. SSOT ve dar dokümanlar çelişmiyor.
22. Selector'lar versioned TargetFingerprint kullanıyor; stable rowKey ve ambiguity
    kuralları gerçek collection senaryolarında kanıtlanmış.
23. Fiziksel action lifecycle kalıcı ve process-death unknown-effect davranışı açıklanabilir.
24. Oracle layer applicability ve ayrıntılı sonuç taksonomisini deterministik uyguluyor.
25. Remote transport sonucu business success yerine geçmiyor; backend state/correlation kanıtı var.
26. SDK/Bridge/host evidence'i kalibre edilmiş clock domain ve uncertainty ile hizalanıyor.
27. Diagnostic waterfall ve versioned/redacted repro paketi aynı occurrence kanıtına çözülüyor.
28. SDK'nın otomatik teknik telemetrisi ile app'in açık business event/query sorumluluğu
    compiler/preflight capability gate'inde ayrılmış.
29. Scanner injection ve `DIRECT_STATE` automation-only isolation gate'i yeşil.
30. Fixed sleep/sahte never-match wait bulunmuyor; timeout'lar condition deadline'ı.
31. Opsiyonel İz C kapalı veya unavailable olduğunda platform sonucu ve CP0–CP9 değişmiyor.
32. İlk Bridge B2'de persistent Watch Registry/unsolicited `WATCH_*` push yok; sonraki
    protocol major'a ait capability yanlışlıkla ilan edilmiyor.
33. `cancel_request` uzun wait sırasında aynı socket'te çalışıyor; reader bloke değil,
    writer serialized ve race yalnız bir terminal sonuç üretiyor.
34. Queue Local subtype, App State App source olarak kalıyor; ayrı evidence plane/rozet
    oluşturulmuyor.
35. Evidence Source authority/correlation/freshness/conflict policy'si yanlış veya
    stale fact'in PASS üretmesini engelliyor.
36. Launch Profile expected screen/surface readiness ve cleanup ile doğrulanıyor;
    entry command success tek başına PASS değil.
37. Target Resolution Provider Chain gerçek listede stable entity'yi çözüyor;
    bounded entity binding bulk business data stream etmiyor.
38. SDK observation dedupe/coalescing/rate/payload bütçeleri event-storm ve soak
    kapılarında kanıtlanmış.
39. Top-level bilgi mimarisi yedi workspace olarak korunmuş; sekizinci Verdict
    workspace veya duplicate Live Inspector/registry yüzeyi yok.
40. `/automation/domain-packs` ve `/automation/domain-packs/[packId]` catalog/manager
    route'ları draft/version/publish/migrate/compatibility/RBAC ile çalışıyor.
41. `/automation/test-profiles`, `/automation/test-profiles/[profileId]`,
     `/automation/test-campaigns` ve `/automation/test-campaigns/[campaignId]`
     route'ları target DTO, RBAC, deep-link, blocked state ve page acceptance ile
     çalışıyor.
42. H.5 target route'larının tamamı `PageMigrationManifest` içinde owner, target
    source, checkpoint, availability, legacy cleanup ve acceptance ref taşıyor.
43. Debug View ve Automation dönüşen sayfaları D.11B target data source'larını
    kullanıyor; expiry/metric'siz legacy adapter yok.
44. Navigation/direct-link/refresh, dynamic route, loading/empty/error/blocked,
    auth/RBAC, responsive/accessibility page acceptance suite'i yeşil.
45. Product/PM/Engineering Tools/Data Center ve kalıcı ADB sayfaları non-regression
    suite'inde yeşil.
46. `/pm/root-cause` orphan değil; `/engineering/current-architecture` güncel ve
    `/engineering/modernization-plan` checkpoint/evidence read modeline bağlı.
47. Page availability capability snapshot ve server fail-closed policy ile
    açıklanıyor; sessiz fallback veya yalnız UI'da gizlenen güvenlik kararı yok.
48. Bilinçli placeholder/product-shell backlog'u platform DoD ve tamamlanmış Cockpit
    sonucundan ayrı raporlanıyor.
49. H.5 ekran matrisi ile release kanıtı route bazında izlenebilir; “component render
    oldu” tek başına sayfa DONE değildir.
50. DurableReceiptBus ve OrderedEvidenceBus restart-safe ve idempotent çalışıyor;
    receipt-safe gate gap arkasında kalmaz, Final Oracle ordered authority'yi atlamaz.
51. Her fact delivery lane taşıyor; ordered-dependent derivation receipt lane'e
    compile/runtime'da bağlanamıyor.
52. Lifecycle, business verdict, termination reason, cleanup result ve operational
    disposition ayrı persist/UI eksenleri; cleanup failure business PASS'i ezmiyor.
53. Device Command Admission control/observation/wait/mutation lane'lerini bounded
    yönetiyor; tek mutation, takeover ve manual contamination kapıları yeşil.
54. `wait_any` initial evaluation ve event-driven + adaptive scoped safety rescan ile
    event kaybında liveness sağlıyor; full-tree polling yapmıyor.
55. Final Oracle unified `OracleRequirement` obligation/timing/deadline/onTimeout
    şemasını kullanıyor; paralel role/time string listeleri yok.
56. Derived fact graph DAG, cycle-safe, reducer-version idempotent ve tam provenance'lı;
    active run pinned bundle/graph/reducer digest'iyle değişmeden devam ediyor.
57. Production runtime arbitrary Domain Pack source code çalıştırmıyor; immutable
    validated bundle ve integrity digest'i fail-closed doğrulanıyor.
58. CP0–CP8 performans kararları versioned profile-specific PerformanceBudget ve raw
    ölçüm kanıtına dayanıyor; hot-path full dump ve false-pass artışı sıfır.
59. Checkpoint work-package'leri master version/hash'e bağlı; stale veya ikinci SSOT
    haline gelmiş paket release kanıtı sayılmıyor.
60. Evidence Journey dokuz stage'i source evidence/authority/confidence ile ayırıyor;
    `NOT_OBSERVED` veya event yokluğu kanıtsız SDK failure'a dönüşmüyor.
61. SDK exact `EmitOutcome` yalnız caller/diagnostic evidence varsa gösteriliyor;
    bounded on-demand diagnostic yüzeyi recursive durable event üretmiyor.
62. Compact layer presentation yalnız applicable plane'leri, detail dört plane'i
    explicit state'lerle immutable occurrence snapshot'ından gösteriyor; web registry
    runtime SSOT'u değil.
63. Badge'ler persisted evidence revision'ında bağımsız değişiyor; sabit sıralı
    animasyon chronology iddiası taşımıyor ve gerçek sıra waterfall'da.
64. Interaction origin `BRIDGE_INJECTED/MANUAL/UNKNOWN` olarak strong correlation ve
    confidence ile sınıflanıyor; automation injection human baseline'a katılmıyor.
65. Repro yalnız gerçekten yakalanmış command/response/artifact'i taşıyor; normal
    step full dump almıyor, failure scoped capture policy'li ve eksik artifact
    `NOT_CAPTURED` olarak açık.
66. Faz 6 ekran teslimi drawer-first 6A→6B→6C sırasını geçmiş; read model/repro
    olmadan live/dekoratif badge release edilmemiş.
67. Nesy v1 core Test Profile Catalog published Domain Pack bundle'ında versioned:
    Smoke, Critical Regression, Differential Regression, Recovery, State-Aware Bad Day,
    Business Contract/Consistency, Load, Compatibility, Short Soak ve
    Security/Release Isolation profilleri çalışıyor.
68. Test Profile yeni execution engine/runner/Oracle path'i açmıyor; bütün profile run'ları
    WorkflowIR v2 → BridgeFlowCompiler/Executor → Evidence Journey → Final Oracle
    omurgasını kullanıyor.
69. Test Campaign matrix her cell için gerçek run/evidenceSummaryRef deep-link'i taşıyor;
    preview profile release GO/NO_GO sonucunu değiştirmiyor.
70. Security/Release Isolation profile release candidate için fail-closed; automation
    SDK/provider/receiver/HMAC/redaction/named-query/Bridge scope sızıntısı NO_GO üretiyor.
71. Technical Platform Readiness ile Commercial Product Validation ayrı sonuç eksenleri
    olarak raporlanıyor; BVG kapıları CP0–CP9'u bypass etmiyor ve ücretli müşteri veya
    design partner sinyali teknik platform DONE yerine geçmiyor.
72. `NESY_COURIER_DOMAIN_PACK_REFERENCE_V1` reviewed ve test-bound artifact olarak
    mevcut; `COURIER_LOGIN`, `SELECT_ROUTE`, `OPEN_STOP`, `PROCESS_PARCEL` ve
    `COMPLETE_DELIVERY` için canonical macro contract, Generic IR snapshot,
    BridgeFlowPlan snapshot, Continue Gate, Final Oracle ve source-map içeriyor.
73. Core shared package ve Bridge protocol contract scan'i domain semantic command/type
    sızıntısı göstermiyor; semantic node'lar yalnız Domain Pack'ten generic IR'a
    derleniyor.
74. Feature Blueprint, Capability Contract, Independent Test Workflow ve Reusable Flow
    Fragment `packages/domain-pack-contracts`; Run Manifest, Test Execution Queue,
    ResourceRequirement, IsolationLevel ve scheduler tipleri `packages/execution-contract`;
    ImpactGraph ve coverage/selection tipleri `packages/impact-contract` içinde
    versioned ve validation fixture'lıdır.
75. Büyük suite tek sıralı 3000 adımlık workflow olarak koşmuyor; Run Manifest altında
    bağımsız test execution'lar lease/retry/blocked semantics ile yönetiliyor.
76. Worker/API/device crash sonrası non-terminal execution tekil olarak effect-aware
    `RETRYABLE`, `RECONCILIATION_REQUIRED` veya `ORPHANED` disposition'a geçiyor;
    bütün suite baştan başlamıyor ve payment/fiscal gibi non-idempotent action otomatik
    tekrar edilmiyor.
77. Login/setup/fixture/resource failure bağımlı workflow'ları `BLOCKED` yapıyor;
    bağımsız public veya fixture gerektirmeyen workflow'lar çalışmaya devam ediyor.
78. Test Data Broker exclusive account, backend fixture, payment/fiscal, ad/reaction,
    route/stop ve subscription resource'larında paralel mutation conflict'ini
    fail-closed engelliyor; `QUARANTINED` ve `MANUAL_RELEASE_REQUIRED` resource
    state'lerini destekliyor.
79. Capability Contract reusable UI/interaction semantics'i taşır; feature business
    invariant'ı ayrı authority/owner approval taşımadan release gate'e bağlanamaz.
80. Maçkolik Domain Pack başlamadan `MACKOLIK_DOMAIN_PACK_REFERENCE_V1` için en az
    onboarding, transfer agenda, match detail, betting tab, Maçkolik AI, news detail,
    ad/subscription ve push/deeplink feature blueprint taslakları hazırdır.
81. Nesy Stop/Parcel/Payment/Queue akışları da aynı Feature Blueprint + Capability
    Contract + Resource Isolation modeliyle tanımlanır; Nesy'ye özel runner veya
    ikinci queue modeli oluşmaz.
82. Nesy `TOUR_APPROVAL_LIFECYCLE`, multi-actor remote action modeliyle tanımlanır:
    Core/Bridge `APPROVE_TOUR` bilmez; Domain Pack semantic node generic
    `REMOTE_ACTION` + evidence/assertion adımlarına açılır; gerçek test ile setup
    modu ayrı verdict semantics taşır.

## H.9 İlk uygulanacak iş sırası — kısa özet

1. Typecheck ve gerçek DB CI baseline.
2. RunSecretRegistry + production WS mutual-HMAC.
3. Durable Receipt/Ordered event lane'leri, lane-aware waitEvent ve sync cutover.
4. Bridge contract/client, Device Command Admission, initial/safety wait ve device preflight.
5. **WorkflowIR v2 + Condition Engine tamamlama ve CP4A kabulü.**
6. **CP4A sonrasında** immutable bundle/trust, Derived Fact DAG ve Domain Pack
   contract/registry + Feature Blueprint/Capability Contract + Test Profile/Campaign
   contract.
7. `NESY_COURIER_DOMAIN_PACK_REFERENCE_V1` canonical vertical slice spec'i; altıncı
   `TOUR_APPROVAL_LIFECYCLE` multi-actor slice dahil; ardından
   Nesy Courier Domain Pack + mevcut Mobile kodundan App Adapter + Nesy Feature
   Blueprint set'i + Nesy v1 Test Profile definitions ve CP4B kabulü.
8. **CP4B sonrasında** Domain expansion + BridgeFlowCompiler + `UiWaitPlan` ve CP4C.
9. Evidence Source/normalization runtime + BridgeFlowExecutor + typed `REMOTE_ACTION`
   executor + receipt-safe Continue
   Gate + unified OracleRequirement + orthogonal run outcomes + Evidence Journey
   classifier/read model + Run Manifest/Test Execution Queue/Test Data Broker +
   Test Profile/Campaign persistence.
10. PageDataSourceContract read modelleri + occurrence applicability/origin/repro
    manifest + Feature/Capability/Run Planner UI read modelleri + PageMigrationManifest
    + yedi-workspace navigation/route IA.
11. Run Detail Increment 6A: Evidence Journey/detail drawer + exact repro export.
12. Run Detail Increment 6B: static applicable badges; Increment 6C: revision-aware
    live updates/race acceptance. Ardından Domain Pack catalog/manager + Editor/Live
    Inspector + Launch Profile/Test Profile/Expected-Interrupt Wait UI + Feature
    Registry/Capability Contracts/Run Planner/Execution Queue/Coverage Graph +
    page acceptance.
13. Nesy Courier Reference Domain Pack E2E + Field Login/Load Tour +
    `TOUR_APPROVAL_LIFECYCLE` gerçek DUT slice + v1 core Test
    Profile Catalog + interaction origin ve failure-scoped capture cihaz acceptance +
    diagnostics/security/campaign matrix.
14. Maçkolik Domain Pack'e başlamadan `MACKOLIK_DOMAIN_PACK_REFERENCE_V1` blueprint
    set'i ve seçili onboarding workbook tabanlı authoring Excel'i dondurulur.
15. Physical B1 matrix + golden comparison.
16. Maestro DELETE + route/UI/API legacy-zero + productization.
17. Opsiyonel İz C: AI Design Audit ve post-run evidence explanation.

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
`Domain authoring → tamamlanmış WorkflowIR v2 contract → versioned Domain Pack
immutable bundle + Launch/Test Profile Catalog → BridgeFlowPlan + UiWaitPlan/wait_any
→ Device Command Admission + BridgeFlowExecutor → receipt-safe Continue Gate →
ordered Final Oracle v2 → Evidence Journey → orthogonal verdict/cleanup sonucu →
Test Campaign matrix/release gate summary` olmalıdır.
