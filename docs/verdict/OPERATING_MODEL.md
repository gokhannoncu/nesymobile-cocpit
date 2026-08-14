# Verdict — Beş fazlı işletim modeli (dürüst anlatım)

**Tarih:** 2026-08-12  
**Durum:** Operasyonel anlatı — **hedef mimari** ile **bugünkü teslim** ayrılmıştır.  
**Üst plan:** [`CONDITION_ENGINE_AND_BRIDGEFLOW.md`](./CONDITION_ENGINE_AND_BRIDGEFLOW.md) · [`COCKPIT_SDK_BRIDGE_COMPAT_PLAN.md`](./COCKPIT_SDK_BRIDGE_COMPAT_PLAN.md) · [`SISTEM_NASIL_CALISIR.md`](./SISTEM_NASIL_CALISIR.md)
**90 gün hedef:** [`goals/G90-stabilization/RUN_PLAY.md`](./goals/G90-stabilization/RUN_PLAY.md) — north star beş madde. G90.2b `CODE_COMPLETE`; **NEXT = G90.3** ([`goals/G90-stabilization/JOIN.md`](./goals/G90-stabilization/JOIN.md)). Phase 10 plumbing ≠ live golden: [`goals/G90-stabilization/RESULT.md`](./goals/G90-stabilization/RESULT.md) §1.1. “Gerçekten stabil”: [`goals/G90-stabilization/ACCEPTANCE.md`](./goals/G90-stabilization/ACCEPTANCE.md) (`pilotStable` ≠ `internallyStable`). İz: [`goals/README.md`](./goals/README.md).
**Paketleme:** [`brand/PRODUCT_PACKAGING_AND_LTV_REVISIONS.md`](./brand/PRODUCT_PACKAGING_AND_LTV_REVISIONS.md)  
**NesyMobile kod denetimi (eski AutomationBridge analizi vs güncel SDK):** [`NESYMOBILE_CODE_AUDIT.md`](./NESYMOBILE_CODE_AUDIT.md)

---

## 0. TL;DR

Üç oyuncu:

| Oyuncu | İş | Kural |
|---|---|---|
| **Bridge** (ayrı Accessibility APK) | Gör · dokun · kaydır | Karar vermez |
| **SDK** (uygulama içinde) | Olay · local · ağ sinyali | Dokunmaz |
| **Cockpit** | Plan · bekle · hükmet | Tek beyin |

**Runtime’da AI yok.** AI yalnızca (opsiyonel) build-time / post-run yardımcı katmanlarda planlanır — koşumun PASS/FAIL otoritesi değildir.

| Bugün kabaca | Henüz hedef / kısmi |
|---|---|
| Domain Pack, WorkflowIR v2, BridgeFlow derleme/yürütme omurgası, Continue Gate ≠ Final Oracle, Evidence Journey, offline-aware sonuçlar (Cockpit Phase 7 kanıtları) | Canlı cihazda Bridge dokunma + Maestro’suz E2E’nin lab DUT engelleri; Live Inspector olgunluğu; telemetri çekmecesinin nihai UX; Design Audit (İz C) |
| Mobile M0–M6 tamam; M7 dış engelli; M8 DUT blocked | Production GO / tam platform release |

---

## Faz 1 — Görünmez entegrasyon (sıfır yük hedefi)

Geliştirici iş akışını kirletmeden Verdict yüzeyinin pakete girmesi.

### 1.1 SDK enjeksiyonu

**Hedef:** Compile-time’da Verdict SDK yalnız `debug` ve `automationRelease` (veya eşdeğer automation) varyantlarına girer. Production `release` APK’sına SDK **bayt sokulmaz** — Domain Pack tarafında `automationRelease=false` release guard’ları bu sözleşmeyle hizalıdır.

**Bugün:** Nesy / App Adapter tarafında release isolation ve automation guard’lar plan + pack registry’de tanımlı; her müşteri uygulamasında aynı Gradle wiring’inin “sıfır bayt production” kanıtı ayrı entegrasyon işidir. Mobil M7 “release isolation” dış engellerle `READY_WITH_EXTERNAL_BLOCKERS`.

### 1.2 Bridge kurulumu

Test cihazına ana uygulamanın **yanına** ayrı **Bridge APK** (`AccessibilityService`) kurulur. Bridge uygulama process’inden izoledir; karar vermez.

**YASAK iddia:** “~100 KB mikro-sunucu.” Plan bunu **bağlayıcı boyut hedefi değil** diye bilinçli kapsam dışı bırakmıştır ([`CONDITION_ENGINE` §14.3](./CONDITION_ENGINE_AND_BRIDGEFLOW.md)). Bağlayıcı olan: işlevsel kapılar (dump scope, tap/scroll, wait, capabilities).

**Bugün:** Bridge B2 protokolü (wait_any / cancel / capabilities) mobile M3’te tamamlandı; gerçek DUT mutation kabulü M8’de harici engelli (`user` / `debuggable=0` cihaz).

### 1.3 Zaman çapasını sabitleme (`monoTs`)

Cihaz / SDK / Cockpit kanıtları rapor şelalesinde ortak zamana bağlanır. Sözleşme dili: **`monoTs`** (host/bridge yanıtlarında; boot-time monotonic saat modeli).

**Bugün:** Bridge yanıt ve evidence sözleşmelerinde `monoTs` alanları tanımlı; çekmece UX’inin nihai hali § Faz 5.

---

## Faz 2 — Senaryo hazırlığı (ne test edilecek?)

Koşumdan önce sistemin neyi doğrulayacağını bilmesi gerekir. **Üç yol** — olgunlukları farklıdır.

### Yol A — Build-time AI Design Audit (İz C — opsiyonel vizyon)

**Ne değildir:** V1 Core · BridgeFlow’u engelleyen kapı · runtime AI.

**Hedef akış (plan):**

1. Girdi: tasarım kaynağı (Figma vb.), Bridge dump, gerekirse kaynak bağlamı → Cockpit’teki LLM  
2. Smart matching: yalnız metin/renk değil; şema / ağaç topolojisi / uzamsal indeks ile semantic gap kapatma  
3. Çıktı: runtime’da kullanılacak **statik** `expected_rules.json` (veya eşdeğer kural seti)  
4. LLM’in işi burada biter — koşumda AI yok  

**Bugün:** Ürün olarak teslim edilmedi. Master plan **İz C**; CE/BridgeFlow v1 kapsamı dışı.

### Yol B — Live Inspector (“tıkla → node”)

**Hedef:** Cockpit’te canlı ayna; mühendis ekrandaki kontrole tıklar → Bridge dump’tan semantik hedef öğrenilir → canvas’a düğüm düşer.

**Bugün:** Inspector destekleri mobile M6’da; Cockpit Live Inspector eylem UI’si plan kapılarında (Faz 8.4 vb.) — “tam no-code tıkla-oluştur ürünü” diye satılmamalı. Hot path’te full dump yasak (`DumpScope`).

### Yol C — Domain Pack + Semantic Actions (asıl V1 yazarlık yolu)

**Bugün ve hedef:** Operatör Maestro/YAML bilmeden iş eylemi sürükler. Palet yayınlanmış pack’ten beslenir (`SemanticActionDefinition` → WorkflowIR v2 → BridgeFlow).  

Ayrıntı: [`semantic-actions/HOW_IT_WORKS.md`](./semantic-actions/HOW_IT_WORKS.md).

Bu yol, Yol A/B’den **önce** savunulabilir V1 authoring omurgasıdır.

---

## Faz 3 — Deterministik koşum (execution)

CI veya Cockpit run tetiklenir. **Burada AI kullanılmaz.**

### 3.1 Emir

Cockpit Workflow / BridgeFlow yürütücüsü Bridge’e komut gönderir. Hedef belirsizliği azaltmak için satır/kimlik bağlamı (plan dili: `@row`, semantik target, `requestId` ile idempotent komut).

**Bugün:** BridgeFlowExecutor + komut sözleşmesi Cockpit’te; cihaz tarafında tam E2E dokunma zinciri lab/DUT koşullarına bağlı.

### 3.2 Fiziksel dokunma

Bridge:

1. Hedefi çözer (`TargetFingerprint` / ambiguity → çoklu eşleşmede FAIL; `nodes[0]` yasak)  
2. Bounds’u güncel çözünürlüğe göre hesaplar  
3. Görünürlük / obscuring kontrolleri (`visible` / `obscuredBy`)  
4. Varsayılan dokunma: işletim sistemi **`dispatchGesture`** (gerçek parmak)  

**RED varsayılan:** UI otomasyonunda yalancı-yeşil üretebilen `performAction` (Accessibility performAction) — Bridge dokunma varsayılanı değildir.  
**Not:** Domain Pack semantic `performAction` (app adapter allowlist) **ayrı kavramdır** — SDK/adapter iş eylemi; Bridge gesture ile karıştırılmaz.

Lifecycle (bağlayıcı dil):

```text
RECEIVED
→ TARGET_RESOLVED
→ GESTURE_DISPATCHED
→ GESTURE_COMPLETED
→ UI_EFFECT_OBSERVED
→ ORACLE_EVALUATED
```

Bridge business hükmü vermez; business etki Final Oracle’dadır.

### 3.3 Evidence akışı

Dokunma / uygulama tepkisi sonrası SDK (ve host) kanıt üretir: app fact, local persistence/queue, remote adapter sonuçları. Cockpit bunları **aynı occurrence** altında birleştirir.

**Bugün:** Evidence ingest, journey writer, oracle evaluation worker Cockpit’te; gerçek cihazdan uçtan uca “fırtına” demosu DUT/lab’e bağlı.

---

## Faz 4 — Mahkeme (Oracle)

Cockpit kanıtı kör kabul etmez. İki kapı:

| Kapı | Soru |
|---|---|
| **Continue Gate** | Akış güvenle ilerleyebilir mi? (readiness — ürün hükmü değil) |
| **Final Oracle** | İşlem business olarak doğru mu? |

Dört kanıt düzlemi (occurrence altında; rozet sırası animasyonu yok — sıra `monoTs` şelalesinin işi):

| Düzlem | Anlam (özet) |
|---|---|
| **UI** | Bridge: hedef çözüldü, dokunma/gesture tamam, görünürlük temiz |
| **App** | SDK: beklenen business/app fact (örn. delivery request) |
| **Local** | SDK: Room / queue / local persistence beklentisi |
| **Remote** | Host/adapter: backend entity / HTTP sonucu |

**Offline:** Remote yanmaz diye otomatik FAIL değil. Politika `PASS_QUEUED_OFFLINE`, `PENDING_REMOTE` vb. üretebilir — klasik kırmızı/yeşilden bilinçli sapma. (Cockpit Phase 7 oracle kanıtları.)

---

## Faz 5 — Teşhis (reporting)

Geleneksel “Element not found / Timeout” yerine occurrence + evidence journey.

### 5.1 Zaman hizalı şelale (`monoTs`)

UI dokunması, SDK olayı, remote yanıt — ortak `monoTs` ile waterfall. Gecikmenin hangi düzlemde koptuğu görünür.

**Bugün:** Run detail / Evidence Journey UI Phase 6–7 kabuklarında mevcut; “sağ çekmece X-Ray” nihai ürün dili plan §7 — mevcut spans/timeline üzerine oturmalı, sıfırdan uydurulmamalı.

### 5.2 Post-run LLM özeti (opsiyonel)

**Yalnız koşum sonrası.** Evidence ID’siz iddia yok. PASS/FAIL üretmez — açıklama / alternatif hipotez / önerilen deney.

**Bugün:** Opsiyonel İz C / AI Arch post-run; V1 Core değil.

### 5.3 Repro paketi

Hedef: Bridge komutu + `requestId` + o anki dump (+ artifact hash’leri) — “Repro kopyala”.

**Bugün:** Sözleşme ve plan maddesi; tek tuş UX her yüzeyde tamamlanmış sayılmaz. Exact reproduction / Evidence Journey fixture’ları Core yönünde ilerlemiştir.

---

## Faz özeti tablosu

| Faz | İş | Runtime AI? | Bugün özeti |
|---|---|---|---|
| 1 Entegrasyon | SDK varyant + Bridge APK + `monoTs` | Hayır | Sözleşme var; production sıfır-bayt ve DUT lab kısmi/engelli |
| 2 Hazırlık | Pack (asıl) · Inspector (hedef) · Design Audit (İz C) | Yalnız Yol A build-time | Pack cutover var; Audit yok; Inspector kısmi |
| 3 Koşum | BridgeFlow + `dispatchGesture` + evidence | **Hayır** | Derleyici/executor omurga; tam fiziksel E2E lab’e bağlı |
| 4 Oracle | Continue Gate + Final Oracle · 4 düzlem · offline taxonomy | Hayır | Cockpit Phase 7 güçlü |
| 5 Teşhis | Waterfall · opsiyonel post-run LLM · repro | Yalnız post-run opsiyonel | Journey/oracle var; çekmece UX olgunlaşacak |

---

## Tek cümle

> **Verdict, koşum anında AI ile değil; Bridge dokunuşu, SDK/local/remote kanıtı ve Cockpit Oracle’ı aynı occurrence altında birleştirerek kritik mobil işlemi hükme bağlar. AI varsa build-time kural üretimi veya post-run açıklama içindir — mahkeme değildir.**

---

## Checklist — bu anlatıyı sunarken

| OK | YASAK |
|---|---|
| Üç oyuncu + “Bridge karar vermez” | Bridge’e business hüküm yüklemek |
| Runtime’da AI yok demek | “Otonom koşumda LLM karar verir” |
| Design Audit = İz C / preview | Design Audit’i V1 Core diye satmak |
| Pack’i asıl authoring yolu göstermek | Yalnız Live Inspector varmış gibi anlatmak |
| `dispatchGesture` varsayılan Bridge dokunuşu | Bridge `performAction` varsayılan demek (semantic adapter ile karıştırma) |
| Offline → typed sonuç | Remote yok = FAIL |
| Bridge boyutu için işlevsel kapı | “100 KB Bridge” iddiası |
| HEDEF / BUGÜN ayrımı | Her şeyi “şimdi çalışıyor” diye yazmak |
