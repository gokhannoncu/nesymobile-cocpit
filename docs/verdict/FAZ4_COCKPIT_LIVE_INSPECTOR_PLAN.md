# Faz 4 — Cockpit / Live Inspector planı

> **Üst küme plan:** [`COCKPIT_SDK_BRIDGE_COMPAT_PLAN.md`](./COCKPIT_SDK_BRIDGE_COMPAT_PLAN.md)  
> (Faz 0→8 + **tüm** workspace ekranları + ADB/SDK/Bridge sınıflandırması).  
> Bu dosya Faz 4 / Live Inspection özetidir.

**Tarih:** 2026-07-29  
**Durum:** CHECKPOINT 3 koşullu kapalı; Mobile Faz 4 başlıyor. Bu dosya **yalnız Cockpit** tarafını kapsar.  
**Kaynaklar:** Verdict plan C.9 / C.9a / C.11 / C.13–C.14 · FULL plan FAZ 4 · Mobile `VERDICT_START.md` İz B · mevcut kod envanteri (`@nesy/control-channels`, Debug View, DeviceWorker).

---

## 1. Amaç

Mobile Faz 4 komut düzlemini (`VerdictControlReceiver`, HMAC, `set_run` secret, …) kurarken Cockpit’in:

1. **Kontrol kanalını** `LegacyReceiverChannel` → `VerdictChannel` (+ `detectChannel`) ile taşıması,
2. **Live Inspection / Debug View** menülerinde neyin bozulup bozulmayacağını netleştirmesi,
3. **ADB’de kalan**, **Verdict kanalına geçen**, **Bridge’e geçen** (Maestro **Cockpit’ten tamamen kaldırılacak** — yedek değil) yolları ayırması,

için tek okunur plan.

**İz ayrımı (bağlayıcı):**

| İz | Ne | Cockpit etkisi |
|---|---|---|
| **İz A — Verdict SDK komut düzlemi** | `set_run`, `get_state`, `seed_*`, `navigate`, `get_request_key`, … | Bu planın Faz 4 kapısı |
| **İz B — UI eylem (bridge)** | `tap` / `scroll` / `input_text` / Live Inspector “tıkla” | **SDK’ya girmez**; ayrı Accessibility APK. Faz 3–8’i bloklamaz |
| **ADB framework** | `dumpsys`, `logcat`, `run-as` kopya, wifi/battery | **Kalıcı**; SDK migrate etmez |

`tap`/`scroll`’u `VerdictChannel` komutu yapmak **REDDEDİLDİ** (C.12 / İz B). Live Inspector’da tıklama gelirse yolu **bridge**’tir, Faz 4 komut düzlemi değil.

---

## 2. Bugünkü yapı (kod gerçeği)

### 2.1 Navigasyon — “Live Inspector” nedir?

Menü grubu adı **Live Inspection** (`packages/metronic/.../layout-21.config.tsx`). Ayrı bir “Live Inspector” uygulaması yok.

| Menü | Route | Grup |
|---|---|---|
| Device Overview | `/debug-view/overview` | Debug View |
| Operational Readiness | `/debug-view/operational-health` | Debug View |
| **Screen State** | `/debug-view/screen-state` | **Live Inspection** |
| **User Interactions** | `/debug-view/interactions` | **Live Inspection** |
| **Network Inspector** | `/debug-view/network-inspector` | **Live Inspection** |
| Schedule Explorer | `/debug-view/schedule` | On-Device Data |
| Database Access | `/debug-view/database` | On-Device Data |
| ADB Scenario Runner | `/debug-view/.../adb-scenarios` | Device Tools |
| Device Log Explorer | `/debug-view/.../log-explorer` | Device Tools |
| Screen Map | `/product/screen-map` | **Product** (Debug View değil) |

### 2.2 Kontrol düzlemi

| Parça | Durum |
|---|---|
| `packages/control-contract` | ✅ Typed `ControlOperation` |
| `LegacyReceiverChannel` | ✅ Tek çalışan kanal |
| `LegacyActivityDumpChannel` | ✅ `get_screen_state` |
| `detectChannel()` | ⚠️ Stub — her zaman `"legacy"` |
| `VerdictChannel` | ❌ Yok (`channelFor("verdict")` throw) |
| Contract suite | ✅ Legacy’de yeşil; Faz 4’te **aynı suite** Verdict’te de koşacak |

### 2.3 Kim ne çalıştırıyor?

| Yetenek | Web UI | Gerçek yürütücü |
|---|---|---|
| Screen dump / hierarchy | Screen State | `adb.ts` → dumpsys + `get_screen_state` |
| Interactions timeline | Interactions | SSE → `logcat -s InteractionEvent:D` |
| Network | Network Inspector | SSE → `OkHttpLog` |
| Overview / health / DB / schedule | ilgili sayfalar | ADB `dumpsys` / `run-as` kopya |
| `get_device_id` / `get_request_key` | ADB Scenarios (allowlist) | `LegacyReceiverChannel` |
| `set_run` / seed / navigate | **Debug UI’da buton yok** | `test-event-bridge` + DeviceWorker (+ bugün Maestro; hedef BridgeFlow) |
| `tap` | **Yok** (Faz 4) | Bugün Maestro YAML (**geçici**); kalıcı **Bridge** — Cockpit Maestro **silinir** (üst plan §9) |

---

## 3. Menü × Faz 4 etkisi (Live Inspector odaklı)

C.11 matrisi + güncel kod. **“Faz 4’te UI değişir mi?”** ≠ **“veri yolu kırılır mı?”**

| Ekran | Veri yolu bugün | Faz 4’te UI | Ne çalışır / kırılır | ADB ile devam? |
|---|---|---|---|---|
| **Screen State** | ① `dumpsys activity top` ② `--nesy-state` / `NESY_SCREEN_STATE` | Çoğunlukla **aynı UI** | ① kalır. ② Mobile’da DumpProvider’a geçene kadar (plan: **Faz 5 / C.11.4**) kırılma riski; Faz 4’te henüz zorunlu değil. Cockpit: `detectChannel` desenli fallback **Faz 5** işi | ① **Evet kalıcı**. ② kanal değişir, ADB `content`/dump provider |
| **User Interactions** | `InteractionEvent` logcat | **UI değişmez** (Faz 3.4b dual-emit) | Mobile’da SDK tek wrap + legacy satır; Cockpit tag dinlemeye devam. Structured’a geçiş **Faz 8** | Logcat yolu **Faz 8’e kadar ADB/logcat** |
| **Network Inspector** | `OkHttpLog` logcat | Değişmez | Etkilenmez (koruma: body yakalama SDK’ya eklenmez) | **Evet** |
| Device Overview | framework dumpsys | Değişmez | Etkilenmez | **Evet** |
| Operational Readiness | dumpsys + prefs/DB kopya | Değişmez | Etkilenmez | **Evet** |
| Schedule / Database | host’a kopya + sqlite | Değişmez | `sql_named` bunların yerini **almaz** | **Evet** |
| ADB Scenario Runner | allowlist + preview | Preview satırları `ControlOperation` kalır; kanal altta değişir | `GET_KEY`/`GET_DEVICE_ID` Verdict’e geçer. Chaos senaryoları zaten drift (C.11.6) — “SDK bozdu” sanılmasın | Framework adımlar **ADB**; control ops **kanal** |
| Log Explorer | ham logcat | Kozmetik tag haritası | Etkilenmez (harita eskir) | **Evet** |
| Screen Map (Product) | statik katalog | Faz 4’te zorunlu değil | İz B Live Inspector “tıkla→node” ile **sonra** zenginleşebilir | N/A |
| Workflows / DeviceWorker | WS 8765 + Maestro (geçici) + bridge | Operatör UI az değişir | `broadcastSetRun` → `set_run.secret` + HMAC sonrası **VerdictChannel**; UI actions → **BridgeFlow** (Maestro DELETE — üst plan §9) | Reverse/logcat **ADB**; komut **kanal**; dokunma **Bridge** |

### Live Inspection özeti

```
Screen State ........ ADB dumpsys KALIR | instrumented panel → sonra Verdict dump (Faz 5)
Interactions ........ Faz 4'te DOKUNMA | logcat legacy KALIR (Faz 8'e kadar)
Network ............. ADB/logcat KALIR | değişiklik yok
```

**Faz 4’te Live Inspection sayfalarının React ağacını yeniden yazmak GEREKMİYOR.** Asıl iş `control-channels` + API/web executor + DeviceWorker/`test-event-bridge`.

---

## 4. Ne ADB ile devam eder? (kalıcı sınıf)

Plan C.11.2 — **9 menünün 7’si ADB’de kalır**, app’te Kotlin tutulmaz:

1. Device Overview  
2. Operational Readiness (framework + dosya kopya kısmı)  
3. Network Inspector  
4. Schedule Explorer  
5. Database Access  
6. Device Log Explorer  
7. Chaos / saf shell senaryoları  

Ayrıca DeviceWorker’ın:

- `adb reverse tcp:8765 tcp:8765`
- logcat sniffer
- paket install / force-stop / sysprop (`debug.nesy.*`)

yolları **ADB kalır**.

---

## 5. Ne VerdictChannel’a geçer? (Faz 4 Cockpit kapısı)

Mobile 4.3b + Cockpit adım 6–8 (C.9) birlikte:

| `ControlOperation` | Legacy bugün | Faz 4 sonrası |
|---|---|---|
| `set_run` (+ **secret**) | `SET_RUN` broadcast — **secret yok** | VerdictControlReceiver; secret RAM; WS’ten **yasak** |
| `end_run` | Legacy’de `UNKNOWN` | Built-in; Cockpit run kapanışı |
| `get_state` / `get_run` / `get_health` / `get_device_id` | ProtectedRequestKeyReceiver | Yeni kanal |
| `get_request_key` | `GET_KEY` | Aynı semantik; provider yoksa `PROVIDER_MISSING` |
| `reset_state` | legacy | + `completion: async` / `get_command_result` poll |
| `seed_*` / `navigate` | TestNavigationReceiver | `NesyCommands` + `installNavigation` (Mobile 4.0) — Cockpit aynı `ControlOperation` üretir |
| `get_command_result` | Yok | DumpProvider/receiver poll (WS kapalıyken) |
| `get_screen_state` | LegacyActivityDumpChannel | Faz 5’te DumpProvider hizası; Faz 4’te legacy dump **tutulabilir** |

**Silme kuralı (pazarlık yok):** Contract suite **iki kanalda** yeşil + saha login E2E → **ancak sonra** Mobile’da iki eski receiver silinir. Cockpit `LegacyReceiverChannel` **Faz 8’e kadar** kodda kalır (C.9 adım 9).

---

## 6. Ne çalışMAYACAK / yanıltıcı olacak?

| Durum | Ne zaman | Belirti | Ne yapılmaz |
|---|---|---|---|
| Mobile receiver silindi, `VerdictChannel` yok | Sıra bozulursa | Seed/NAV/SET_RUN ölür | Erken silme |
| `detectChannel` stub kalır | Faz 4 yarım | Hep legacy; secret’lı `set_run` asla gitmez | “Deploy ettik” sanmak |
| HMAC yokken WS komut | | `NOT_AUTHORIZED` / event yok | Secret’ı WS’ten göndermek |
| Live Inspector’dan tap beklemek | İz B yokken | Buton yok / Maestro şart | `tap`’ı SDK komutu yapmak |
| Chaos senaryoları boş | Bugün de drift | “SDK bozdu” | Faz 4 scope’una almak (C.11.6) |
| Interactions boş | Dual-emit kırılırsa | Tag yok | InteractionStreamer clone (çift hit-test) |
| Database’i `sql_named`’e çevirmek | | Threat model delinir | C.11.2 yasağı |

---

## 7. Cockpit iş paketleri (önerilen sıra)

Mobile ile kilit noktalar senkron; Cockpit kendi PR’larını atabilir.

### CP-F4.0 — Hazırlık (Mobile 4.0 ile paralel, UI yok)

- [ ] Envanter: `test-event-bridge` / `field-courier-login-orchestrator` / `adb-scenario-executor` / `adb.ts` call-site listesi (hangi op hangi dosya)
- [ ] `set_run` için secret alanı taşıma tasarımı (legacy hâlâ secret göndermez; Verdict path zorunlu)
- [ ] DeviceWorker: kanal cache + hata invalidate (C.9 detect)

### CP-F4.1 — `VerdictChannel` + `detectChannel` (Mobile 4.3 hazır olunca)

- [ ] `packages/control-channels`: `VerdictChannel` (explicit component, nonce’lı ordered result)
- [ ] `detectChannel`: nonce ping → verdict | legacy
- [ ] `runControlChannelContract("VerdictChannel", …)` yeşil
- [ ] Legacy suite regresyon yeşil kalır

### CP-F4.2 — Yürütücü bağlama

- [ ] `apps/api` executor: `detectChannel` + secret’lı `set_run` yalnız verdict
- [ ] `apps/web` `adb.ts` / scenario executor: aynı seçim
- [ ] `test-event-bridge.broadcastSetRun` → ControlOperation + kanal
- [ ] `end_run` / `get_command_result` wiring (async mutasyon)

### CP-F4.3 — HMAC / host tarafı

- [ ] WS secret registry (device/run eşlemesi) — Mobile `VERDICT_START` açık madde
- [ ] Host karşı-imza; auth öncesi event sızıntısı yok (C.2a testleri host’ta da)
- [ ] `cp2-ws-host` / `TestEventWsServer` ACK yolu bozulmadan

### CP-F4.4 — Saha gate (CHECKPOINT 4 Cockpit yarısı)

- [ ] `field-courier-login-orchestrator` uçtan uca **VerdictChannel** ile
- [ ] ADB Scenario Runner preview’ları hâlâ doğru satır üretir (kanal değişse de)
- [ ] Release notu: Chaos drift (C.11.6) — “SDK bozdu” değil

### CP-F4.5 — Live Inspection (bilinçli az dokunuş)

- [ ] Screen State / Interactions / Network: **UI refactor yok** (Faz 4)
- [ ] Interactions: dual-emit hâlâ `InteractionEvent` basıyor mu diye tek duman testi
- [ ] Screen State instrumented panel: kırılırsa fallback notu; asıl fix Mobile Faz 5 DumpProvider + `adb.ts` detect

### CP-F4.6 — İz B (Live Inspector “eylem” + Maestro’suz E2E) — ayrı ray

- [ ] Ayrı bridge APK protokolü (`requestId`, idempotent `tap`, `visible`/`obscuredBy`)
- [ ] Cockpit UI: Screen State / Screen Map üzerinde semantik hedef + gesture
- [ ] **BridgeFlowCompiler** (`workflow-ir` → Bridge+SDK zinciri); sabit koordinat yok
- [ ] Dual-run ölçüm (VERDICT_START #14) → Maestro **cutover + Cockpit’ten DELETE** (üst plan §9 M4–M5)
- [ ] Bu paket Faz 4 CHECKPOINT’ini **bloklamaz**; ama Automation E2E’nin kalıcı yolu budur

---

## 8. Mobile ↔ Cockpit senkron kapıları

```
Mobile 4.0 bootstrap (nav + NesyCommands)     ↔  Cockpit hâlâ legacy seed/nav (paralel OK)
Mobile 4.1–4.3 ControlReceiver + Dump        ↔  CP-F4.1 VerdictChannel yazılabilir
Mobile 4.4 HMAC + 4.5 redact                 ↔  CP-F4.3 host secret registry
İkisi de contract yeşil                      →  Mobile eski receiver SİL
Cockpit LegacyReceiverChannel kaldırma       →  Faz 8 (erken değil)
```

**Erken silme = Device Lab + saha login ölümü.**

---

## 9. Live Inspector — operatör beklentisi (kısa)

| Beklenti | Faz 4 sonunda | Sonra |
|---|---|---|
| Ekranı gör (hierarchy / state) | Evet (ADB + mevcut dump) | DumpProvider ile daha temiz |
| Dokunuş timeline | Evet (aynı logcat tag) | Faz 8 structured |
| Network | Evet | — |
| Cockpit’ten PIN/login/seed | Workflow/API (kanal altta Verdict) | Debug UI’ya buton **zorunlu değil** |
| Cockpit’ten “şu id’ye tıkla” | **Hayır** (İz B) | Bridge + Live Inspector UI |
| Maestro’suz E2E | Kısmen (komut düzlemi; Maestro hâlâ tap) | **Zorunlu:** BridgeFlow; Cockpit’te Maestro **0** |

---

## 10. Bilinçli kapsam dışı

- Debug View React redesign / Overview UX yeniden yazımı  
- Screen Map ürün kataloğu içerik işi  
- `sql_named` ↔ Database Access birleştirme  
- Engineering menüsündeki “faz-4” (Navigation/DI modernizasyon) — **Verdict Faz 4 değil**  
- Mobile `longRunning=true` for `set_run` — **REDDEDİLDİ** (Mobile `VERDICT_START`)

---

## 11. Dosya haritası (hızlı referans)

| Alan | Path |
|---|---|
| Kanallar | `packages/control-channels/src/index.ts` |
| Contract suite | `packages/control-channels/src/contract-suite.ts` |
| Contract tipleri | `packages/control-contract/src/index.ts` |
| Web ADB | `apps/web/src/lib/server/adb.ts` |
| Senaryo | `apps/web/src/lib/server/adb-scenario-executor.ts` |
| Bridge/set_run | `apps/api/src/services/test-event-bridge.ts` |
| DeviceWorker | `apps/api/src/services/device-worker.ts` |
| WS ingest | `apps/api/src/services/test-event-ws-server.ts` |
| Live Inspection pages | `apps/web/src/app/(cockpit)/debug-view/{screen-state,interactions,network-inspector}/` |
| Nav config | `packages/metronic/src/config/layout-21.config.tsx` |
| Fixtures | `verdict-contract-fixtures/control-plane/` |
| Plan (Verdict_Dev) | `plan/sections/C9_cockpit_control.md`, `C11_debug_view.md`, FULL FAZ 4 |

---

## 12. İlk somut PR (Cockpit)

Mobile `set_run` süre ölçümü (adım 0) ve 4.0 bootstrap ile çakışmadan:

1. **Dokümantasyon:** bu dosya (merge).  
2. **CP-F4.0 envanter PR:** call-site tablosu + `broadcastSetRun` secret gap notu (kod değişmeden).  
3. Mobile ControlReceiver land olunca **CP-F4.1 `VerdictChannel` iskeleti** + contract suite ikinci koşum.

Live Inspector UI’ya Faz 4’te dokunulmaz; dokunulacak yer **kanal ve workflow köprüsü**.
