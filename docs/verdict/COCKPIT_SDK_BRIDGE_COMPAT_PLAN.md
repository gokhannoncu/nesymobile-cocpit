# Cockpit × Verdict SDK × Bridge — tam uyum planı (Faz 0 → 8)

**Tarih:** 2026-07-29  
**Kapsam:** NesyMobile Cockpit’teki **tüm workspace ekranları** + cihaz/otomasyon yolları.  
**Amaç:** SDK ve Bridge ile uyumlu çalışmak için Cockpit’te **faz faz ne yapılacak**; her ekranın **ADB / SDK (VerdictChannel) / Bridge / Host-API / Statik** hangisiyle yaşayacağı.

**Kaynaklar:** `layout-21.config.tsx` (nav SSOT) · 47× `page.tsx` · 13× `app/api/**/route.ts` · Verdict plan C.9 / C.11 / C.12 / FAZ 0–8 · Mobile `VERDICT_START.md` İz B · `@nesy/control-channels` / `control-contract`.

**İlgili dar dosya:** `docs/verdict/FAZ4_COCKPIT_LIVE_INSPECTOR_PLAN.md` (Faz 4 Live Inspection özeti). **Bu dosya üst kümedir.**  
**Koşul motoru / IR / BridgeFlow beyni:** [`CONDITION_ENGINE_AND_BRIDGEFLOW.md`](./CONDITION_ENGINE_AND_BRIDGEFLOW.md) (YAML builder değil; Maestro sonrası mimari).  
**Nasıl çalışır (diyagramlı, az teknik):** [`SISTEM_NASIL_CALISIR.md`](./SISTEM_NASIL_CALISIR.md).  

**Çapraz kontrol (2026-07-29):** Development Flow PDF + AI Architecture PDF + `VERDICT_START` → eksikler CONDITION §14’e işlendi (çekmece/3’lü event teşhisi/repro/layers/FOR_EACH; AI Design Audit = İz C).

**Envanter doğrulama (2026-07-29):** paralel codebase taramaları — tüm nav/route’lar + faz matrisi bu dosyaya işlendi.

---

## 0. Üç ray (karıştırılmaz)

| Ray | Ne taşır | Tipik yüzey | SDK’ya girer mi? |
|---|---|---|---|
| **ADB (framework / host kopya)** | `dumpsys`, `logcat`, `run-as` dosya kopyası, `adb reverse`, install/force-stop, sysprop | Overview, DB/Schedule kopya, Network/Log Explorer, DeviceWorker reverse | **Hayır** — kalıcı |
| **SDK komut düzlemi (`VerdictChannel`)** | `set_run`(+secret), `end_run`, `get_state`, `get_request_key`, `seed_*`, `navigate`, `reset_state`, `get_command_result`, … | Automation workflows, field-login, scenario control ops, bridge `broadcastSetRun` | **Evet** — Faz 4+ |
| **Bridge (Accessibility APK — İz B)** | `dump` (**DumpScope:** full/subtree/depth/match — hot path’te full yok), `tap` / `scroll` / `input_text`, `wait_node`, `visible`/`obscuredBy` | Live Inspector “tıkla”, **tüm E2E dokunma** (Maestro yerine) | **Hayır** — ayrı APK; Faz 3–8’i bloklamaz |

**RED:** `tap`/`scroll`’u `ControlOperation` / SDK komutu yapmak.  
**RED:** Database Access’i `sql_named` ile değiştirmek.  
**RED:** `set_run` → `longRunning=true` (Mobile kararı; Cockpit async sanmasın).  
**RED (yeni — bağlayıcı):** Cockpit’te Maestro’yu “kalıcı yedek” veya “opsiyonel azaltma” olarak bırakmak. **Hedef: Cockpit üzerinden Maestro tamamen kaldırılır** (CLI + executor + YAML derleyici + UI metinleri + field-login adımı). Geçiş ölçümlü; kalıcı dual-stack yok.

---

---

## 1. Faz faz — Cockpit’te yapılacaklar (0 → 8)

### Faz 0 — Control-plane katmanlama *(çoğu YAPILDI)*

| # | Cockpit deliverable | Durum | Not |
|---|---|---|---|
| 0.1 | `packages/control-contract` | ✅ | Typed ops |
| 0.2 | `packages/control-channels` + `LegacyReceiverChannel` | ✅ | Tek çalışan kanal |
| 0.3 | Kanal-agnostik contract suite | ✅ | Faz 4’te Verdict ile **aynı suite** |
| 0.4 | Generator’lar typed op üretir (`adb-scenarios`, yaml) | ✅ / sürdür | Kanal çağırmaz |
| 0.5 | Web/API `ControlExecutor` iskeleti | ✅ legacy | `detectChannel` hâlâ stub |
| 0.6 | WS ingest / ACK / host (`TestEventWsServer`) | ✅ | DeviceWorker reverse |
| 0.7 | Deploy + saha legacy ile çalışır | ✅ | |

**Eksik bırakılan (Faz 0’da kasıtlı):** `VerdictChannel`, gerçek `detectChannel`, `set_run.secret` taşıma.

### Faz 1 — API freeze *(Cockpit az iş)*

| # | İş | Durum |
|---|---|---|
| 1.1 | Wire / fixture lock peer (Mobile↔Cockpit) | ✅ corpus |
| 1.2 | UI değişikliği yok | — |

### Faz 2 — Transport / dual-emit köprüsü

| # | İş | Cockpit |
|---|---|---|
| 2.1 | Structured + legacy event ingest | WS + logcat sniffer |
| 2.2 | Heartbeat host dalı (ingest’e sokma) | ✅ uygulandı |
| 2.3 | Debug View Interactions **UI değişmez** | Dual-emit Mobile Faz 3.4b |
| 2.4 | `broadcastSetRun` hâlâ secret’siz | Faz 4’e borç |

### Faz 3 — Capture *(Cockpit UI çoğunlukla dokunulmaz)*

| # | İş | Ekran etkisi |
|---|---|---|
| 3.1 | Screen State instrumented panel | Hâlâ `--nesy-state`; DumpProvider **Faz 5** |
| 3.2 | Interactions | `InteractionEvent` tag — **değişmez** (dual-emit) |
| 3.3 | Network | `OkHttpLog` — **değişmez** |
| 3.4 | CP3 device gate | Host ACK şart (DeviceWorker reverse) |

### Faz 4 — Komut düzlemi **(Cockpit ana iş burası)**

| # | Cockpit paketi | Bağımlılık (Mobile) | Gate |
|---|---|---|---|
| **4.0** | Call-site envanter; `broadcastSetRun` secret tasarımı | Mobile 4.0 nav+commands | — |
| **4.1** | `VerdictChannel` + nonce `detectChannel` | ControlReceiver + Dump | Contract suite 2 kanal |
| **4.2** | API/Web executor kanal seçimi; scenario + field-login + bridge | 4.1 | |
| **4.3** | Host HMAC secret registry; auth öncesi event sızıntı testleri | Mobile 4.4 | |
| **4.4** | `end_run` / `get_command_result` wiring | Built-ins | |
| **4.5** | Saha: `field-courier-login` E2E Verdict kanalı | Receiver silme **öncesi** yeşil | **CHECKPOINT 4** |
| **4.6** | Release notu: Chaos drift ≠ SDK bozdu | — | |
| **4.7** | Live Inspection React **yeniden yazılmaz** | — | |

**Silme:** Mobile eski receiver’lar ancak 4.5 yeşilinden sonra. Cockpit `LegacyReceiverChannel` **Faz 8’e kadar kalır**.

### Faz 5 — Jenerik yetenekler / Dump hizası

| # | Cockpit | Ekran |
|---|---|---|
| 5.1 | `adb.ts` screen: `detectChannel` + VerdictDumpProvider fallback | **Screen State** panel ② |
| 5.2 | `get_screen_state` LegacyActivityDump → Verdict dump | Screen State |
| 5.3 | `sql_named` UI’ya **bağlanmaz** | Database Access ADB kalır |

### Faz 6 — App migrasyon / eski köprü silme (Mobile ağır)

| # | Cockpit | Risk |
|---|---|---|
| 6.1 | Interactions hâlâ dual-emit legacy satır | Tag kaybolursa sayfa ölür — Mobile dual-emit zorunlu |
| 6.2 | Scenario preview’lar receiver action adı taşımaz | Zaten ControlOperation |
| 6.3 | Automation seed/nav yalnız VerdictChannel | Legacy silindiyse |

### Faz 7 — Akış motoru (Maestro’suz derleyici) **zorunlu**

| # | Cockpit | Not |
|---|---|---|
| **7.0** | Bridge host istemcisi + cihaz hazırlık kapısı (servis/port/sürüm; sessiz fallback yok) | İz B B.1 |
| **7.1** | `workflow-ir` → **2. derleyici** (`BridgeFlowCompiler`) — Maestro YAML üretimi **değil** | Editör/IR değişmez |
| **7.2** | `workflow-runner`: `MaestroExecutor` yerine Bridge komut zinciri + oracle/waitEvent (host ingest) | |
| **7.3** | Field-login / load-tour / editor Run: tek yürütücü = Bridge+SDK | Maestro feature-flag **off** |
| **7.4** | Port modeli dokümantasyon (8765 tek) | |
| **7.5 GATE** | Karşılaştırmalı ölçüm yeşil (VERDICT_START #14) → **M5 silme** açılır | “Daha hızlı” yetmez |

### Faz 8 — Sunset (legacy + **Maestro silme**)

| # | Cockpit |
|---|---|
| **8.0 BLOCKER** | `oracle-engine.ts`: 9 legacy sniffer channel → structured WS/WAL; **then** drop `NESY_AUTO_BRIDGE` |
| **8.0b MAESTRO DELETE** | `maestro-executor` + Maestro YAML workspace yolu + DeviceWorker Maestro driver pre-install + UI “Maestro” metinleri **repo’dan silinir** (§9). Dual-run/benchmark gate yoktur. |
| 8.1 | Wire v2 + Interactions structured/WAL UI |
| 8.1b | `LegacyReceiverChannel` kaldır (VerdictChannel-only) |
| 8.3 | LegacyAdapter / dual-emit sunset ile senkron |
| 8.4 | Bridge Live Inspector eylem UI olgun |

### İz B — Bridge (paralel; **Maestro’nun tek yedeği değil, yerine geçen**)

| # | Cockpit |
|---|---|
| B.1 | Bridge protokol istemcisi (`requestId`, idempotent `tap`) |
| B.2 | Screen State / Screen Map: semantik tap UI |
| B.3 | BridgeFlowCompiler + BridgeFlow-only execution wiring → **Maestro direct removal** |
| B.4 | Production cihaza bridge kurulmaz (kapı) |
| B.5 | Cockpit’te Maestro bağımlılığı = **0** (Faz 8.0b) |

---

## 2. Sınıflandırma sütunları (ekran tablolarında)

| Sütun | Anlam |
|---|---|
| **Kalıcı taşıyıcı** | Bu ekranın uzun vadede beslenme yolu |
| **Bugün** | Şu anki implementasyon |
| **Kırılma riski** | Hangi fazda / hangi hata ile bozulur |
| **Cockpit işi** | Bu ekran için yapılacak iş (yok / Faz N) |
| **Operatör notu** | Ne çalışmaz sanılmamalı |

---

## 3. EKSİKSİZ ekran envanteri (nav SSOT + page.tsx)

Nav kaynağı: `packages/metronic/src/config/layout-21.config.tsx`.  
`*` = nav’da var, özel `page.tsx` yok → `(cockpit)/[...slug]` placeholder.

---

### 3.1 Ana Sayfa (`home`) — cihaz yok

| Ekran | Route | Kalıcı taşıyıcı | Bugün | Kırılma / SDK / Bridge | Cockpit işi |
|---|---|---|---|---|---|
| Overview (Command Center) | `/` | Host-API / statik | Dashboard | Cihaz yolu yok | Yok (Verdict dışı) |
| This Week | `/home/this-week` * | Statik/placeholder | Placeholder | — | Yok |
| Quick Actions | `/home/quick-actions` * | Statik/placeholder | Placeholder | — | Yok |
| Strategic Priorities | `/home/strategic-priorities` * | Statik/placeholder | Placeholder | — | Yok |
| Upcoming Milestones | `/home/upcoming-milestones` * | Statik/placeholder | Placeholder | — | Yok |
| Open Risks & Blockers | `/home/open-risks-and-blockers` * | Statik/placeholder | Placeholder | — | Yok |
| Recent Decisions | `/home/recent-decisions` * | Statik/placeholder | Placeholder | — | Yok |
| Recent Activity | `/home/recent-activity` * | Statik/placeholder | Placeholder | — | Yok |
| Recent Documents | `/home/recent-documents` * | Statik/placeholder | Placeholder | — | Yok |
| Upcoming Meetings | `/home/upcoming-meetings` * | Statik/placeholder | Placeholder | — | Yok |

**Özet:** SDK/Bridge/ADB ile **ilişkisiz**. Uyum planına dahil değil (bilinçli kapsam dışı).

---

### 3.2 Product — cihaz yok (Screen Map hariç İz B adayı)

| Ekran | Route | Kalıcı taşıyıcı | Bugün | Kırılma / SDK / Bridge | Cockpit işi |
|---|---|---|---|---|---|
| Domain Glossary | `/product/domain-glossary` | Statik CMS | İçerik | — | Yok |
| Domain Model | `/product/domain-model` | Statik | İçerik | — | Yok |
| **Screen Map** | `/product/screen-map` | Statik katalog → **İz B’de bridge zenginleşir** | Explorer UI | SDK komut değil; tap yok | **Faz 8 / İz B:** tıkla→node (opsiyonel) |
| Feature Library | `/product/feature-library` (+ `[slug]`) | Statik | İçerik | — | Yok |
| Country Matrix | `/product/country-matrix` | Statik | İçerik | — | Yok |
| Country Profiles | `/product/country-profiles` | Statik | İçerik | — | Yok |

---

### 3.3 Proje Yönetimi (`pm`) — cihaz yok

| Ekran | Route | Kalıcı taşıyıcı | Bugün | SDK/Bridge/ADB | Cockpit işi |
|---|---|---|---|---|---|
| Ticket Board | `/pm/tickets` | Host PM API | Tickets | — | Yok |
| Release History | `/pm/releases` | Host | — | — | Yok |
| Version Tracker | `/pm/versions` | Host + **ADB install** | Statik katalog + `/api/versions/latest` + `/api/versions/download-link` + **`/api/adb/install-latest`** | Install yolu **ADB kalıcı**; SDK/Bridge değil | APK install akışını koru (Faz bağımsız) |
| Sprint Calendar | `/pm/calendar` | Host | Boş hero | — | Yok |
| Roadmap | `/pm/roadmap` | Host | Boş hero | — | Yok |
| Root Cause | `/pm/root-cause` | Host | page var; **nav’da yok** | — | Yok |

---

### 3.4 Engineering — çoğunlukla dokümantasyon

| Ekran | Route | Kalıcı taşıyıcı | Bugün | Not |
|---|---|---|---|---|
| Incident Komuta Merkezi | `/engineering/incident-playbook` | Statik/runbook | İçerik | Cihaz yok |
| Edge Case Map | `/engineering/edge-case-map` | Statik | İçerik | — |
| Field Ticket Intelligence | `/engineering/field-tickets` | Host/PM | — | — |
| Current Architecture | `/engineering/current-architecture` | Statik | — | — |
| Modernization Plan | `/engineering/modernization-plan` | Statik | **“faz-4” burada Navigation/DI — Verdict Faz 4 değil** | İsim çakışması uyarısı |
| Backend Handbook | `/engineering/backend-handbook` | Statik | — | — |
| Screen Manual | `/engineering/screen-manual` * | Statik/placeholder | Nav var, page zayıf | — |
| Mobile Service Atlas | `/engineering/mobile-service-atlas` | Statik | — | — |

**Engineering Tools** (Debug View menüsünden de linklenir) → §3.5 altında.

---

### 3.5 Debug View — cihaz yüzeyi (ASİL UYUM MATRİSİ)

#### 3.5.1 Device Overview

| | |
|---|---|
| Route | `/debug-view/overview` |
| **Kalıcı taşıyıcı** | **ADB** (dumpsys wifi/telephony/battery/package, getprop, ping) |
| Bugün | `adb.ts` / `/api/adb/devices|health|runtime` |
| Kırılma | SDK migrate **edilmez**; app çökmüşken de çalışmalı |
| SDK? | Hayır |
| Bridge? | Hayır |
| Cockpit işi | Yok (koru) |

#### 3.5.2 Operational Readiness

| | |
|---|---|
| Route | `/debug-view/operational-health` |
| **Kalıcı taşıyıcı** | **ADB** + host’a prefs/DB kopya |
| Bugün | Overview + `run-as` + servis probe |
| Kırılma | SDK’ya taşınmaz |
| Cockpit işi | Yok |

#### 3.5.3 Screen State *(Live Inspection)*

| | |
|---|---|
| Route | `/debug-view/screen-state` |
| **Kalıcı taşıyıcı** | ① **ADB** `dumpsys activity top` **kalıcı** · ② instrumented `NESY_SCREEN_STATE` → **SDK DumpProvider (Faz 5)** |
| Bugün | ①+② `adb.ts` + `LegacyActivityDumpChannel` / `--nesy-state` |
| Kırılma | ② Mobile `MainActivity.dump` silinirse (Faz 6) **panel boşalır** — C.11.4; fallback `detectChannel` + DumpProvider **Faz 5 Cockpit işi** |
| SDK? | Yalnız panel ② (Faz 5+) |
| Bridge? | İsteğe bağlı zengin dump / tap (İz B) — **ayrı** |
| Cockpit işi | **Faz 5:** dump kanal fallback. **İz B:** tıklama UI (Faz 4 checkpoint dışı) |
| Operatör | Faz 4’te hierarchy (①) çalışır; instrumented JSON ② bozulursa “SDK bozdu” değil Dump migrasyonu |

#### 3.5.4 User Interactions *(Live Inspection)*

| | |
|---|---|
| Route | `/debug-view/interactions` |
| **Kalıcı taşıyıcı** | Faz 3–7: **ADB/logcat** `InteractionEvent` · Faz 8: structured/WAL UI |
| Bugün | SSE `/api/adb/interactions/stream` |
| Kırılma | Dual-emit olmazsa Faz 6.3’te **kalıcı boş** |
| SDK? | Üretim SDK’da; Cockpit Faz 8’e kadar legacy tag |
| Bridge? | Hayır (gözlem ≠ eylem) |
| Cockpit işi | Faz 3–7: **UI değiştirme**. Faz 8: structured geçiş |

#### 3.5.5 Network Inspector *(Live Inspection)*

| | |
|---|---|
| Route | `/debug-view/network-inspector` |
| **Kalıcı taşıyıcı** | **ADB/logcat** `OkHttpLog` |
| Bugün | SSE network stream |
| Kırılma | Body’yi SDK interceptor’a taşımak **RED** (C.12) |
| SDK? | Hayır (metadata zaten SDK’da ayrı) |
| Cockpit işi | Yok — koru |

#### 3.5.6 Schedule Explorer

| | |
|---|---|
| Route | `/debug-view/schedule` |
| **Kalıcı taşıyıcı** | **ADB** `run-as`/`exec-out` → **host sqlite** |
| Bugün | `/api/adb/schedule` |
| Kırılma | `sql_named` ile değiştirmek tehdit modelini deler |
| SDK? | Hayır |
| Cockpit işi | Yok |

#### 3.5.7 Database Access

| | |
|---|---|
| Route | `/debug-view/database` |
| **Kalıcı taşıyıcı** | **ADB** host kopya + keyfi SQL **host’ta** |
| Bugün | `/api/adb/database` |
| SDK? | Hayır (`sql_named` yan yana, UI değil) |
| Cockpit işi | Yok |

#### 3.5.8 ADB Scenario Runner

| | |
|---|---|
| Route | `/debug-view/adb-scenarios` |
| **Kalıcı taşıyıcı** | Karışık: **ADB shell** adımlar + **SDK VerdictChannel** control ops |
| Bugün | Allowlist; control çoğunlukla `get_device_id` / `get_request_key`; preview `previewCommand` |
| Kırılma | Receiver silinince preview/action drift; Chaos senaryoları **zaten ölü** (C.11.6) |
| SDK? | Control op’lar Faz 4+ VerdictChannel |
| Bridge? | Senaryoya tap eklemek → **İz B Bridge** (Maestro yok) |
| Cockpit işi | **Faz 4.2** kanal bağlama · **Faz 4.6** Chaos release notu · preview’ların op-typed kalması |

#### 3.5.9 Device Log Explorer

| | |
|---|---|
| Route | `/debug-view/log-explorer` |
| **Kalıcı taşıyıcı** | **ADB** ham logcat |
| Bugün | stream + tag haritası |
| Kırılma | Tag haritası eskir (kozmetik); dual-emit ring’i hızlandırır |
| Cockpit işi | Faz 8’de tag haritası güncelle |

#### 3.5.10 Engineering Tools (Debug menü altı)

| Ekran | Route | Kalıcı taşıyıcı | SDK/Bridge/ADB | Cockpit işi |
|---|---|---|---|---|
| Data Locator | `/engineering/tools/data-locator` | Host katalog / statik | Cihaz yok | Yok |
| MongoDB Query Generator | `/engineering/tools/mongodb-query-generator` | Host | Cihaz yok | Yok |
| Graylog Query Generator | `/engineering/tools/graylog-query-generator` | Host | Cihaz yok | Yok |

---

### 3.6 Data Center — Nesy backend (cihaz SDK değil)

| Ekran | Route | Kalıcı taşıyıcı | Bugün | Not |
|---|---|---|---|---|
| Connection | `/data-center/connection` | Host Nesy auth/API | Bağlantı | Cihaz Verdict değil |
| Shipment Operations | `/data-center/shipment` | Host API (`requiresNesyAuth`) | — | — |
| Pickup Operations | `/data-center/pickup` | Host API | — | — |
| Happy Path Operations | `/data-center/happy-path` | Host API | — | — |
| User Operations | `/data-center/users` | Host API | — | — |

**Özet:** ADB/SDK/Bridge uyum planının **dışında** (courier backend). Field-login **cihaz** tarafı Automation’da.

---

### 3.7 Automation — cihaz + kontrol düzlemi + **Bridge E2E** **(yüksek etki)**

| Ekran | Route | Kalıcı taşıyıcı | Bugün (geçici) | Kırılma | Cockpit işi |
|---|---|---|---|---|---|
| Workflow Library | `/automation/list` | Host + DeviceWorker | Liste | — | Faz 7 BridgeFlow |
| Run History | `/automation/history` | Host DB | — | — | Ingest/`end_run` (F4); Maestro artifact UI kaldır |
| **Field Courier Login** | `/automation/field-login` | **SDK VerdictChannel** + **Bridge tap** | Orchestrator + Maestro login adımı | Receiver erken silinirse ölür; Maestro silinince BridgeFlow worker yoksa ölür | **F4.2–4.5** + **F8 Maestro direct removal** |
| **Load & Tour Flow** | `/automation/01-load-tour-flow` | SDK seed/nav + **Bridge** | Workflow + Maestro YAML | Aynı | **F4** + **F7 BridgeFlow** |
| Automation Overview | `/automation/overview` | Host | page var | — | — |
| **Workflow Editor** | `/automation/[id]` | IR + BridgeFlowRunner | Editor + Maestro workspace derleyici | set_run/seed kanal; YAML preview Maestro’ya bağlı | **F4** kanal + **F7** IR→Bridge; Maestro YAML preview **sil** |
| **Run detail** | `/automation/[id]/runs/[runId]` | WS ingest + logcat | Run view (+ Maestro video) | HMAC kesilirse boş | **F4.3**; media yolu Bridge/screenshot’a kayar |

**Dokunma (tap):** Bugün Maestro (**geçici**). **Kalıcı ve tek yol: Bridge (İz B).** SDK’ya tap girmez. Cockpit’te Maestro **kalmaz**.

---

## 4. Tek bakışta: cihazı ilgilendiren ekranlar

| Ekran | ADB kalıcı | SDK (VerdictChannel) | Bridge (İz B) | Host WS/API |
|---|:---:|:---:|:---:|:---:|
| Device Overview | ✅ | — | — | — |
| Operational Readiness | ✅ | — | — | — |
| Screen State (hierarchy) | ✅ | — | opsiyonel | — |
| Screen State (instrumented JSON) | geçiş | ✅ Faz 5+ | opsiyonel | — |
| User Interactions | ✅ logcat → Faz 8 | üretci SDK | — | Faz 8 UI |
| Network Inspector | ✅ | — | — | — |
| Schedule Explorer | ✅ | — | — | — |
| Database Access | ✅ | — | — | — |
| ADB Scenario Runner | ✅ shell | ✅ control ops F4 | opsiyonel | — |
| Device Log Explorer | ✅ | — | — | — |
| Field Courier Login | reverse/props | ✅ F4 | ✅ tap (Maestro silinir) | — |
| Load & Tour / Workflows | reverse | ✅ F4 | ✅ BridgeFlow (Maestro silinir) | ingest |
| Screen Map | — | — | ✅ UI sonra | statik |

---

## 5. “Artık çalışMAYACAK” — operatör checklist

| Sanı | Gerçek |
|---|---|
| Faz 4’ten sonra Overview bozulur | **Hayır** — ADB |
| Interactions boşaldı = SDK bug | Önce dual-emit / tag kontrol et |
| Screen State JSON yok = SDK bug | DumpProvider migrasyonu (Faz 5) |
| Chaos senaryo fail = SDK bug | **Önceden de ölü** (C.11.6) |
| Database’i sql_named’e alalım | **Yasak** |
| Live Inspector’dan tıklayamıyorum | Faz 4 kapsamı değil → **Bridge** |
| set_run WS’ten | **NOT_AUTHORIZED** (güvenlik) |
| Field login kırıldı | VerdictChannel + suite yeşil olmadan receiver silindi mi? |
| Maestro kalır / yedek olur | **Hayır** — Cockpit’ten **tamamen silinir** (§9); kalıcı dual-stack yok |

---

## 6. Backend / automation yüzeyleri (ekran değil, ekranı besler)

**Migration legend:** Keep ADB · VerdictChannel · Bridge (E2E UI — Maestro yerine) · WS ingest · **Delete Maestro** · Deprecate legacy (F8).

### 6.1 Core API services

| Yüzey | Path | UI / caller | Migration |
|---|---|---|---|
| **device-worker** | `apps/api/src/services/device-worker.ts` | `POST .../workflows/:id/run` | **Keep ADB** reverse/logcat · **WS ingest** · **sil:** Maestro driver pre-install |
| **test-event-bridge** | `.../test-event-bridge.ts` | workflow-runner (UI buton yok) | `set_run`(+secret)/`seed`/`get_state` → **VerdictChannel** |
| **workflow-runner** | `.../workflow-runner.ts` | Tüm automation Run | Orchestrator **kalır**; `MaestroExecutor` → **BridgeFlowExecutor** |
| **maestro-executor** | `.../maestro-executor.ts` (+ `.test.ts`) | Editor / load-tour / field-login | **DELETE** (M5 / Faz 8.0b) |
| **yaml-generator** | `.../yaml-generator.ts` | runner + yaml-preview | Maestro workspace derleyici **DELETE**; yerine **BridgeFlowCompiler** |
| **workflow-ir** | `.../workflow-ir.ts` | bugün yaml-generator | **Keep** — nötr IR; tek kalıcı derleyici Bridge |
| **field-courier-login-orchestrator** | `.../field-courier-login-orchestrator.ts` | `/automation/field-login` | F4 VerdictChannel; F7 `maestro_login` → Bridge login; Maestro run **DELETE** |
| TestEventWsServer | `.../test-event-ws-server.ts` | DeviceWorker | **WS ingest** |
| verdict-ingest / fanout | `.../verdict-ingest.ts`, `verdict-fanout.ts` | Sniffer / oracle | **WS ingest** |
| logcat-sniffer | `.../logcat-sniffer.ts` | Workflow runs | → **Faz 8** `NESY_AUTO_BRIDGE` sunset |
| adb.ts | `apps/web/src/lib/server/adb.ts` | `/api/adb/*` | Keep ADB; screen → F5 |
| adb-scenario-executor | `apps/web/.../adb-scenario-executor.ts` | adb-scenarios | Shell Keep ADB; control → VerdictChannel |
| control-channels | `packages/control-channels` | bridge + adb + field-login | VerdictChannel F4; Legacy → F8 sil |
| nesy-mobile-auth | `apps/api/.../nesy-mobile-auth.router.ts` | users LoginDevice | GET_KEY → VerdictChannel |
| device-courier-auth | `apps/api/.../device-courier-auth.ts` | server-steps | GET_KEY → VerdictChannel |

### 6.2 UI → set_run / seed / GET_KEY / E2E dokunma

| UI | Route / file | Ops triggered | Migration |
|---|---|---|---|
| Workflow editor Run | `/automation/[id]` → `POST .../run` | set_run, seed, get_state, UI actions | F4 VerdictChannel + **F7 BridgeFlow** |
| Load & Tour Flow | `/automation/01-load-tour-flow` | same | same |
| Field Courier Login | `/automation/field-login` | get_device_id + login UI | F4 + **Bridge login**; Maestro step **sil** |
| YAML / Maestro preview | `WorkflowYamlPreviewModal` | Maestro YAML | **DELETE** veya BridgeFlow preview |
| ADB Scenario Runner | `/debug-view/adb-scenarios` | get_device_id, get_request_key | VerdictChannel |
| User ops LoginDevice | `/data-center/users` | get_device_id, get_request_key | VerdictChannel |
| Version Tracker install | `/pm/versions` | adb install-latest | **Keep ADB** |
| Debug View live pages | `/debug-view/*` | dumpsys/logcat/run-as | Keep ADB; Interactions F8 |

**Gaps:** Manual Debug `set_run`/`seed`/`navigate` yok. `navigate` contract-only. `run-step` / `device-workers` UI’siz. Interactions = Next SSE (`adb-bridge` Socket.IO legacy).

---

## 7. Önerilen Cockpit teslim sırası (özet)

```
F0–F3:  Debug View UI’ya dokunma; dual-emit + ingest koru
F4:     VerdictChannel + secret/HMAC + field-login kanal gate
F5:     Screen State dump fallback
İz B∥:  Bridge APK protokolü + host istemci (F4’ü bloklamaz)
F7:     BridgeFlowCompiler + runner cutover (Maestro flag OFF)
F7.5:   Retired — dual-run/benchmark gate kaldırıldı
F8.0:   Oracle structured
F8.0b:  Maestro kod/UI/CLI = 0 (DELETE)  ← Cockpit’ten tamamen kaldır
F8.1b:  LegacyReceiverChannel sil
```

---

## 8. Envanter doğrulama

| Kaynak | Sayı |
|---|---|
| Nav path (`layout-21`) | 40 |
| `page.tsx` | 47 |
| Next `app/api` route | **13** (11 ADB + 2 versions) |
| Nav’da olup özel page zayıf/placeholder | home/* (9) + `screen-manual` |
| Auth UI | `/data-center/connection` (ayrı `/auth` yok) |
| Settings | Metronic dropdown stub — **route yok** |
| Cihaz-kritik Debug View menü | 9 (+ 3 engineering tools BFF) |
| Automation cihaz-kritik | field-login, load-tour, editor, run detail |
| PM cihaz yüzeyi | **Version Tracker** (`adb install-latest`) |

Bu dosya nav SSOT + C.11 + mevcut kanal kodu ile üretilmiştir. Yeni menü eklenince **bu tabloya satır eklemek zorunlu**.

### 8.1 Next.js `app/api` (cihazla ilgili)

| Route | Rol | Taşıyıcı |
|---|---|---|
| `/api/adb/devices` | Cihaz listesi | ADB |
| `/api/adb/runtime` | Overview | ADB |
| `/api/adb/health` | Operational readiness | ADB |
| `/api/adb/screen` | Screen State | ADB + control-channels |
| `/api/adb/schedule` | Schedule | ADB run-as |
| `/api/adb/database` | Database Access | ADB run-as |
| `/api/adb/network/stream` | Network Inspector | ADB logcat |
| `/api/adb/interactions/stream` | Interactions | ADB logcat |
| `/api/adb/logs/stream` | Log Explorer | ADB logcat |
| `/api/adb/scenarios/run` | Scenario Runner | ADB + control → **F4 VerdictChannel** |
| `/api/adb/install-latest` | Version Tracker install | ADB |
| `/api/versions/latest` | Sürüm sorgusu | Host/Nesy HTTP |
| `/api/versions/download-link` | SAS URL | Host |

Diğer canlı veri çoğunlukla BFF `:4001` / `/automation-api` (Next `app/api` dışında).

### 8.2 Auth / Settings

| Yüzey | Route | Not |
|---|---|---|
| Nesy login | `/data-center/connection` | Birincil auth UI |
| Gated Data Center | shipment/pickup/happy-path/users | `requiresNesyAuth` |
| Field device login | `/automation/field-login` | **SDK F4** + **Bridge tap** (Maestro adımı silinecek) |
| Profile Settings / Preferences / Security | *(yok)* | Sidebar stub, `href` yok |

---

## 9. Maestro — Cockpit’ten tamamen kaldırma (bağlayıcı)

**Hedef:** Operatör ve CI, Cockpit üzerinden **hiç Maestro kullanmaz**. Kalıcı “yedek Maestro” yok. Phase 8'de doğrudan kod yolu **Delete** edilir; dual-run/benchmark gate yoktur.

**Yerine geçen yığın (üç parça, karıştırılmaz):**

| Parça | Rol |
|---|---|
| **VerdictChannel (SDK)** | `set_run`, `seed`, `navigate`, `get_state`, `get_request_key`, … |
| **Bridge (İz B)** | `tap` / `scroll` / `input_text` / `wait_node` / `dump` (+ `visible`/`obscuredBy`) |
| **BridgeFlowCompiler** | `workflow-ir` → Bridge+SDK komut zinciri (bugünkü Maestro YAML derleyicisinin **ikinci / sonra tek** tüketicisi) |
| **Koşul motoru** | Graf + preflight → `WorkflowIR` / runtime evaluate — detay: [`CONDITION_ENGINE_AND_BRIDGEFLOW.md`](./CONDITION_ENGINE_AND_BRIDGEFLOW.md) |

**Ölçüm kapısı (silmeden önce — VERDICT_START #14):** BridgeFlow, aynı golden workflow’larda Maestro’ya göre **daha çok şey doğruluyor** (`visible:false`, `obscuredBy`, event gecikmesi, dört rozet). “Daha hızlı” tek başına yetmez.

### 9.1 Adımlar (M0 → M5)

| # | İş | Çıktı |
|---|---|---|
| **M0** | Call-site envanter (bu § + §6) | Maestro’ya bağımlı her UI/API listesi |
| **M1** | Bridge host istemcisi + cihaz hazırlık kapısı | Sessiz fallback yok; prod’a bridge kurulmaz |
| **M2** | `BridgeFlowCompiler` + `BridgeFlowExecutor` | IR’dan ikinci derleyici; editör/IR aynı |
| **M3** | BridgeFlow execution wiring | Verdict runtime gerçek executor/queue yoluna bağlı |
| **M4** | Cutover: runner + field-login + load-tour + editor Run | Tek yürütücü BridgeFlow |
| **M5** | **DELETE** | Aşağıdaki dosya/bağlar repo’dan çıkar; `rg -i maestro` = 0 (docs hariç arşiv notu) |

### 9.2 Silinecek / değiştirilecek Cockpit yüzeyleri

| Path / yüzey | Aksiyon |
|---|---|
| `apps/api/src/services/maestro-executor.ts` (+ test) | **DELETE** |
| `apps/api/src/services/yaml-generator.ts` Maestro workspace derleyici | **DELETE veya BridgeFlow’a dönüştür** (Maestro YAML emit yok) |
| `workflow-runner.ts` → Maestro spawn / stdout parse | BridgeFlowExecutor |
| `device-worker.ts` Maestro driver pre-install | **REMOVE** |
| `field-courier-login-orchestrator.ts` `maestro_login` / `ensureAndRunMaestroLogin` | Bridge login adımı; Maestro HTTP run yok |
| `WorkflowYamlPreviewModal` / `POST .../yaml-preview` | BridgeFlow preview veya kaldır |
| Run detail Maestro video/artifact varsayımları | Bridge screenshot / host media |
| UI metinleri (“Maestro Command”, “Login on device (Maestro)”) | Bridge / Flow diline çevir |
| CI / docs / scripts `maestro test` çağrıları | BridgeFlow / host runner |
| Opsiyonel host `maestro` CLI bağımlılığı | paket/dokümanlardan çıkar |

**Kalır:** `workflow-ir.ts`, workflow editör canvas, DeviceWorker kuyruk, WS ingest, oracle (F8’de structured), ADB dumpsys/logcat menüleri.

### 9.3 Sıra kısıtı

```
F4 VerdictChannel yeşil (seed/login kanalı)
    ∥ İz B Bridge APK + host istemci
        → M2 BridgeFlowCompiler
        → M3 BridgeFlow execution wiring
        → M4 BridgeFlow-only cutover
        → M5 / Faz 8.0b DELETE
```

Faz 4 CHECKPOINT’i Maestro silmeyi **bekletmez**; ama **M5, BridgeFlow olmadan yapılamaz**. Erken Maestro silme = field-login + load-tour + editor Run ölümü.

---

## 10. Sonraki PR’lar (Cockpit)

1. Bu planın merge’i (Maestro **tam kaldırma** kararı dahil).  
2. `docs/verdict/CALL_SITES.md` — her `ControlOperation` → dosya:satır.  
3. Mobile ControlReceiver land → `VerdictChannel` iskeleti PR.  
4. İz B: Bridge host istemci iskeleti (M1) — F4 ile paralel.  
5. M2+ : `BridgeFlowCompiler` PR’ları; M5 ancak ölçüm gate sonrası.
