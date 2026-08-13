# NesyMobile otomasyon analizi — güncel kod denetimi

**Tarih:** 2026-08-12  
**Kaynak analiz:** Kullanıcıda dolaşan “NesyMobile Test Automation Code — Comprehensive Analysis” (ADB receivers + `AutomationBridge` dönemi)  
**Denetlenen repo:** `Consultants/NesyMobile` (yerel checkout)  
**SSOT:** `NesyMobile/verdict-status.json` · `NesyMobile/VERDICT_START.md` · `app/src/automation/java/.../verdict/`  
**İlgili Cockpit anlatı:** [`OPERATING_MODEL.md`](./OPERATING_MODEL.md) · [`semantic-actions/HOW_IT_WORKS.md`](./semantic-actions/HOW_IT_WORKS.md)

---

## 0. TL;DR — hüküm

| Kullanıcı analizinin iddiası | Güncel kod gerçeği |
|---|---|
| Merkez `app/.../adb/` + `automation/AutomationBridge` | **Eski mimari.** Legacy ADB receiver’lar silinmiş; olay/komut omurgası **Verdict SDK modülleri** + `app/src/automation/` |
| “Mobilde Maestro’ya özel kod sıfır → silinecek bir şey yok” | Maestro-özel mobil kod hâlâ pratikte sıfır — ama **“hiçbir şey değişmez” yanlış**. Büyük migrasyon **zaten yapılmış**; kalan iş silme değil, **iş event gürültüsü + adapter derinliği** |
| Gelecek = `WsCommandProcessor`’a login/route ekle | Komutlar zaten `NesyCommands` + Verdict `CommandHandler` üzerinden kayıtlı |
| SDK “1 satır drop-in” vizyonu | **Kısmen gerçek:** `VerdictBootstrap` + `automationRelease` source set; iş event’leri hâlâ fragment’larda helper emit |
| `qa` buildType önerisi | Gerçek isim: **`automationRelease`** (+ `debug` aynı automation kaynağını paylaşır) |

**Sonuç:** Analizin “genel amaçlı / Maestro’dan bağımsız” tezi doğru kalır. Dosya haritası, silme/kalma listesi ve “sadece WsCommandProcessor genişlet” planı **bayat**. Aşağıdaki eksikler yatırımcı/ürün kararını değiştirir.

---

## 1. Analizin doğru kalan kısımları

1. **Maestro-özel mobil kod yok** — `NESY_STEP` / YAML marker’ları Cockpit tarafında; mobil wire event’leri domain olayları.  
2. **Transport runner-agnostic** — WS + (gerekirse) logcat; kim dinlerse dinlesin.  
3. **Release’e SDK sokmama hedefi** — compile-time isolation (`src/automation` yalnız debug/automationRelease).  
4. **İş event’leri otomatik yakalanamaz** — delivery/payment gibi domain olayları hâlâ bilinçli emit ister.  
5. **Telemetri / RecyclerView / debuggable tartışmaları** yön olarak hâlâ geçerli tasarım notlarıdır — fakat “henüz yapılacak SDK” değil, mevcut modüllerle örtüşen parçalar var.

---

## 2. Kritik sapmalar (eksik / yanlış)

### 2.1 Dosya haritası artık geçersiz

| Analizde | Gerçek (2026-08) |
|---|---|
| `app/.../adb/TestNavigationReceiver.kt` | **Yok** (Faz 4–6 migrasyonunda kaldırıldı; spike RESULT’larda belgelenmiş) |
| `app/.../adb/ProtectedRequestKeyReceiver.kt` | **Yok** |
| `app/.../automation/AutomationBridge.kt` | **Yok** (yerine `verdict-api` / `VerdictEngine` / `VerdictSdk`) |
| `WebSocketTestEventSink` / `WsCommandProcessor` / `EventBuffer` / `BridgeStateSnapshot` | Mantık **taşındı**: `verdict-transport-okhttp` (`OkHttpWalTransport`), command API, `NesyStateProvider` vb. |

**Güncel Nesy uygulama yüzeyi:**

```text
app/src/automation/java/com/arasdigital/nesymobile/verdict/
  VerdictBootstrap.kt          ← install giriş noktası
  NesyCommands.kt              ← login / select_route / open_* (eski SEED_STATE)
  NesyAppAdapterManifest.kt    ← named query + capability handshake
  NesyAppAdapterCommands.kt
  NesyAppAdapterQueryCapability.kt
  NesyStateProvider.kt
  NesyResetProvider.kt
  NesyRequestKeyProvider.kt
  NesyScreenClassifier.kt
  NesyPreparedSessionSetup.kt / NesyDirectStateSetup.kt / NesyScannerInjectSetup.kt
  NesyEntityBindingStore.kt / NesyCorrelationContext.kt
  NesyCriticalEventCatalog.kt / NesyScheduleLookup.kt
  AutomationDeliveryHelper.kt / AutomationOperationHelper.kt / …Helpers
  TestEvent.kt / AutomationAction.kt / AutomationStatus.kt
```

Release stub’ları: `app/src/release/java/.../verdict/` (no-op helper’lar).

### 2.2 Verdict SDK — analizde neredeyse hiç yok

`settings.gradle` fiziksel modüller:

```text
verdict-api
verdict-api-okhttp
verdict-core          ← VerdictEngine, WAL, heartbeat, ACK
verdict-fragment
verdict-navigation
verdict-room
verdict-transport-okhttp
verdict-sdk
verdict-sample-minimal / verdict-sample-full
```

`verdict-status.json`: **evidence_core_integration = GO**, **cockpit_functional_e2e = GO**, **public_sdk_release = NO_GO**.

Analizde eksik olan ürün-kritik parçalar:

| Parça | Neden önemli |
|---|---|
| **WAL + ACK + gap/recovery** | Event kaybı / reconnect — “ring buffer 256” seviyesinin üstünde |
| **Heartbeat** | Bridge/SDK yaşam sinyali |
| **Fragment / navigation / room installers** | Capture + named query + reset |
| **CommandKind / ExecutionContext** | ACTION/MAIN vs IO ayrımı |
| **EmitOutcome** | Structured emit sözleşmesi |
| **Sample apps** | App-agnostic SDK kanıtı |

### 2.3 Ayrı Bridge APK — analizde “gelecek” gibi; kodda var

`NesyMobile/verdict-bridge/` **bağımsız Gradle uygulaması** (root `include` değil):

- `BridgeAccessibilityService`
- `dispatchGesture` varsayılan dokunma (`UiActions.kt`)
- Protocol: handshake, dump/find, tap/input/swipe, `collection_info`, `scroll_to_item`, `wait_node`, screenshot, vb.

Analizin “scroll/click’i WsCommandProcessor’a ekle (veya Bridge yapar)” cümlesi: **Bridge tarafı büyük ölçüde yazılmış**; Nesy WS komutları da `NesyCommands` ile var. Eksik olan “hiç yok” değil, **Cockpit↔Bridge↔SDK E2E + DUT kabulü**.

### 2.4 Nesy App Adapter — en büyük boşluk

Analiz bunu hiç saymıyor. Güncel merkez:

`NesyAppAdapterManifest` — Cockpit Domain Pack `nesy.courier.app-adapter` ile hizalı:

- Named queries: `nesy.availableStops`, `stopState`, `taskState`, `parcelState`, `pendingOperation`, `sessionState`, `routeState`, …
- Recovery queries: queue / delivery / payment / fiscal / restore  
- Setup (automation-only): prepared-session, direct-state, scanner-inject  
- Capabilities: NAMED_QUERY, STATE_PROJECTION, CRITICAL_EVENT_STREAM, SESSION_PREPARATION, SCANNER_INJECTION, ENTITY_TARGET_BINDING, RELEASE_ISOLATION_ASSERTION, CORRELATION_CONTEXT, …

Bu olmadan “WS’ye login ekle” anlatısı **yanlış katmanda** kalır. Pack + Oracle local/remote evidence buradan beslenir.

### 2.5 “Silinecek sıfır satır / iş kodu temiz” — abartı

**Doğru:** Maestro’ya özel silinecek receiver yok (zaten silinmiş).  

**Yanlış / eksik:** İş kodu hâlâ otomasyonla kirli. `AutomationDeliveryHelper` / `AutomationOperationHelper` çağrıları `main` içinde yoğun (DeliveryFragment, StopListFragment, SharedViewModel, TaskListFragment, ScanProcessor, …).

Yani vizyondaki:

```text
VerdictSDK.install(this) → fragment'ta sıfır emit
```

**henüz tamamlanmamış.** Passive capture (fragment lifecycle vb.) bootstrap’ta kuruluyor; **kritik business wire’lar hâlâ manuel helper**.

### 2.6 Build variant isimlendirmesi

Analiz önerisi: `qa` (`debuggable false` + minify + SDK).  

Gerçek: **`automationRelease`** — release benzeri + automation source set + full Verdict bağımlılıkları. `release` / production flavor’larda SDK classpath’te yok.

`debuggable=true` gerekmez tezi **doğru yönde**; isim ve kanıt yolu `automationRelease`.

### 2.7 “Gelecek plan = yalnız WsCommandProcessor” — yanlış öncelik

| Analiz planı | Gerçek öncelik |
|---|---|
| WS’ye login/route/open ekle | **Zaten var** (`NesyCommands`) |
| click/scroll’u app WS’ye koy | **Bridge APK** fiziksel UI için doğru yer (zaten var) |
| — | App Adapter named query / recovery / correlation derinliği |
| — | Business emit’leri catalog + daha az gürültü |
| — | DUT / process-death / C.15 (bridge_b1_pilot conditional) |
| — | Public SDK release (NO_GO) — imza, dış consumer |

---

## 3. Güncel mimari (kısa)

```text
┌─────────────────────────────────────────────────────────┐
│  Nesy app (debug / automationRelease)                   │
│    VerdictBootstrap.install                             │
│      → VerdictSdk + WS transport :8765                  │
│      → fragment / navigation / room                     │
│      → NesyCommands + App Adapter queries/setup         │
│    main: DeliveryHelper / OperationHelper emits (hâlâ)  │
└───────────────────────────┬─────────────────────────────┘
                            │ WAL / events / commands
                            ▼
┌─────────────────────────────────────────────────────────┐
│  Cockpit Device Worker / BridgeFlow / Oracle            │
└───────────────────────────┬─────────────────────────────┘
                            │ physical UI
                            ▼
┌─────────────────────────────────────────────────────────┐
│  verdict-bridge APK (AccessibilityService, ayrı process)│
│    dump / tap / scroll_to_item / wait_node / …          │
└─────────────────────────────────────────────────────────┘
```

Maestro: Cockpit YAML marker yolu — mobil SDK’nın yerine geçmez; B planı olabilir.

---

## 4. Analiz bölümlerine tek tek not

| Bölüm | Durum |
|---|---|
| §1 ADB receivers | **Bayat** — silinmiş; işlev `NesyCommands` + providers |
| §2 AutomationBridge | **Bayat** — `Verdict` / `VerdictEngine` |
| §3 TestEvent | Kısmen — enum/helpers automation source set’te; wire catalog büyümüş |
| §4–7 WS / buffer / snapshot / processor | Mantık **modüllerde**; sınıf adları değişmiş; WAL eklendi |
| §8 package tree | **Yanlış ağaç** — yukarıdaki automation + SDK modülleri |
| §9 NESY_STEP | Hâlâ doğru (Cockpit YAML) |
| §10 debug.nesy.* | Kontrol et — kısmen sysprop/bootstrap; tam liste SSOT’ta |
| §11 Manifest receivers | Legacy kayıtlar kalkmış olmalı — Manifest’i eski analizle eşleme |
| “Silinecek yok” | **Migrasyon tamam → kalan = emit gürültüsü + release/public gaps** |
| SDK 4 katman vizyonu | Yön doğru; büyük kısmı **yazılmış**; business zero-touch değil |
| Telemetri paralel collector | Tasarım; `verdict-status` CP0 performance baselines hâlâ açık |
| RecyclerView / CollectionInfo | Bridge’de `collection_info` / `scroll_to_item` **var** — analiz “eklenecek” sanıyor |
| qa vs debuggable | `automationRelease` ile hizala |

---

## 5. Önemli eksikler — öncelik sırası

1. **App Adapter + Domain Pack sözleşmesi** — analizde yok; Oracle/local evidence için şart.  
2. **WAL/ACK/durable evidence** — “ring buffer yeter” anlatısını geçersiz kılar.  
3. **Ayrı Bridge APK gerçekliği** — click/scroll’u app komutuna yığma.  
4. **Business emit debt** — “SDK gürültüsüz” iddiasını yatırımcıya satmadan önce dürüstçe “kritik wire’lar hâlâ explicit”.  
5. **GO / NO_GO ayrımı** — evidence core GO; public SDK + production rollout NO_GO; bridge B1 conditional.  
6. **Performans telemetrisi** — vizyon güçlü; CP0 baseline’lar açık → “zaten gölge mühendis var” deme.  
7. **İkinci uygulama / sample apps** — `verdict-sample-*` var; Nesy dışı customer proof henüz public release değil.

---

## 6. Revize edilmiş “ne kalır / ne değişir” (2026-08)

```text
KALIR / ZATEN TAŞINMIŞ
  Verdict SDK modül grafı
  VerdictBootstrap + automationRelease isolation
  NesyCommands (eski seed fiilleri)
  App Adapter named queries / setup / recovery surface
  verdict-bridge APK (dispatchGesture)
  Critical event catalog + helper emit’ler (şimdilik)

HÂLÂ İŞ
  main içindeki Automation*Helper çağrılarını azalt / catalog’a sıkı bağla
  Adapter query coverage + Cockpit pack hizası
  Bridge B1 açık DUT / process-death politikası
  Performance baseline ölçümü (CP0)
  Public SDK imza + dış consumer (NO_GO)

SİLİNECEK (Maestro için)
  Mobilde ek Maestro-only silme yok
  Cockpit YAML generator yolu ayrı (mobil repo dışı)
```

---

## 7. Tek cümlelik denetim hükmü

> Eski analiz, NesyMobile’ın **pre-SDK / ADB-receiver** dönemini doğru tarif ediyor; bugünkü repo ise **modüler Verdict SDK + App Adapter + ayrı Bridge APK** aşamasındadır. “Maestro’ya bağımlı mobil kod yok” tezi durur; “hiçbir şey silinmez / sadece WsCommandProcessor genişler / SDK henüz yok” sonuçları **yanlış veya eksik**tir.

---

## 8. Checklist — bu analizi kullanırken

| OK | YASAK |
|---|---|
| Güncel path: `app/src/automation/.../verdict` + `verdict-*` modüller | `adb/TestNavigationReceiver` varmış gibi plan yapmak |
| Komutlar = `NesyCommands` | “WS’ye login ekleyeceğiz” demek |
| UI gesture = `verdict-bridge` | App içi `performClick`ı Bridge yerine koymak |
| Adapter manifest’i pack ile konuşturmak | Yalnız event emit ile Oracle’ı bitmiş saymak |
| `automationRelease` demek | Olmayan `qa` buildType’ı gerçek sanmak |
| Explicit business emit borcunu kabul etmek | “Fragment’larda sıfır satır” diye satmak |
| `verdict-status.json` GO/NO_GO | Her şey production-ready demek |
