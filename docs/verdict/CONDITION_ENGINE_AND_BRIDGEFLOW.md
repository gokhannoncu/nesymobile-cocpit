# Koşul Motoru + IR + BridgeFlow — Cockpit beyin planı

**Tarih:** 2026-07-29  
**Durum:** Bağlayıcı mimari notu (uygulama henüz yok; Maestro hâlâ tek derleyici).  
**Üst plan:** [`COCKPIT_SDK_BRIDGE_COMPAT_PLAN.md`](./COCKPIT_SDK_BRIDGE_COMPAT_PLAN.md) §9 (Maestro DELETE) · Mobile `Consultants/NesyMobile/VERDICT_START.md` İz B #9–#14  
**Dar Faz 4 özeti:** [`FAZ4_COCKPIT_LIVE_INSPECTOR_PLAN.md`](./FAZ4_COCKPIT_LIVE_INSPECTOR_PLAN.md)  
**Operatör anlatımı + diyagramlar:** [`SISTEM_NASIL_CALISIR.md`](./SISTEM_NASIL_CALISIR.md) (login→tur senaryosu, az teknik)

---

## 0. TL;DR — soruların cevabı

| Soru | Cevap |
|---|---|
| YAML builder’ı bilmem gerekir mi? | **Hayır.** O sadece bugünkü `IR → Maestro YAML` adaptörü. Silinecek. |
| Koşul motoru IR mi üretecek? | **Hayır — koşul motoru IR’ın beyninin parçasıdır.** Graf + preflight + (gerekirse) runtime probe alır; `WorkflowIR` üretir / zenginleştirir. Ayrı bir “YAML üret” katmanı değildir. |
| Maestro gidince Cockpit’in beyni neresi? | **Editör (ne)** + **`workflow-ir` / koşul motoru (hangi sıra / hangi dal)** + **BridgeFlowCompiler + Executor (nasıl cihaza iner)** + **host waitEvent / oracle (iş kanıtı)**. |
| IR derleyici lazım mı? | **Evet.** Bugün tek derleyici Maestro (`yaml-generator`). Kalıcı derleyici: **`BridgeFlowCompiler`** (`WorkflowIR` → Bridge + VerdictChannel komut zinciri). Editör ve IR sözleşmesi değişmez. |

```text
                    ┌─────────────────────────┐
                    │  Editör (node/edge)     │  ← yazar / “ne”
                    └───────────┬─────────────┘
                                │
                    ┌───────────▼─────────────┐
                    │  KOŞUL MOTORU           │  ← planlama beyni
                    │  buildWorkflowIR(+)     │     (derleme + runtime karar sözleşmesi)
                    │  → WorkflowIR           │
                    └───────────┬─────────────┘
                                │
              ┌─────────────────┴─────────────────┐
              │                                   │
   ┌──────────▼──────────┐             ┌──────────▼──────────┐
   │ BridgeFlowCompiler  │  KALICI     │ yaml-generator      │  GEÇİCİ
   │ → BridgeFlowPlan    │             │ → Maestro YAML      │  → DELETE
   └──────────┬──────────┘             └──────────┬──────────┘
              │                                   │
   ┌──────────▼──────────┐             ┌──────────▼──────────┐
   │ BridgeFlowExecutor  │             │ MaestroExecutor     │  → DELETE
   │ + VerdictChannel    │             └─────────────────────┘
   │ + Bridge APK        │
   │ + host waitEvent    │
   └─────────────────────┘
```

---

## 1. Katmanlar — “beyin” dağılımı (karıştırılmaz)

| Katman | Path / yüzey | Sorumluluk | Maestro sonrası |
|---|---|---|---|
| **A. Yazarlık** | `apps/web/.../workflow-editor.tsx`, `workflow-registry.ts` | Node/edge graf, palette, UI | **Kalır** (değişmez sözleşme hedefi) |
| **B. Planlama / koşul** | `apps/api/.../workflow-ir.ts` (+ yeni `condition-engine.ts`) | Graf linearize; compile-time resolve; runtime-condition sözleşmesi | **Kalır ve güçlenir** — asıl “koşul motoru” burası |
| **C. Preflight** | `workflow-runner` + `getDeviceBridgeState` / `get_state` + `preflight-plan.ts` | `isLoggedIn`, `routeSelected` kanıtı | **Kalır**; F4’te VerdictChannel |
| **D. Derleyici** | Bugün `yaml-generator.ts` | IR → yürütülebilir artifact | **BridgeFlowCompiler** (yeni); Maestro yolu **DELETE** |
| **E. Yürütücü** | Bugün `maestro-executor.ts` | Artifact’ı çalıştır | **BridgeFlowExecutor** + DeviceWorker kuyruk |
| **F. Kanıt** | `logcat-sniffer` / WS ingest / `oracle-engine` | Event, backend, rozet | Host **waitEvent (ingest)**; Bridge **wait_node (UI)** |

**RED:** Koşul motorunu SDK’ya koymak.  
**RED:** Koşul motorunun Maestro/YAML üretmesi.  
**RED:** `tap`/`scroll`’u `ControlOperation` yapmak (koşul sonucu dal seçer; dokunma Bridge’de).  
**RED:** Sessiz “preflight yok → her şeyi Maestro’ya bırak” kalıcı davranış — BridgeFlow’da probe başarısızlığı **yüksek sesle fail** (VERDICT_START #16).

---

## 2. Bugünkü kod gerçeği (doğrulanmış)

### 2.1 IR zaten var

Dosya: `apps/api/src/services/workflow-ir.ts`

```ts
export type IRStep =
  | { kind: "macro"; node: IRNode }
  | { kind: "resolved-condition"; node; decision: "skip_branch" | "take_branch"; evidence; branch; skippedNodeIds }
  | { kind: "runtime-condition"; node; branch: IRNode[] }
  | { kind: "ui-condition"; node: IRNode };

export interface WorkflowIR {
  steps: IRStep[];
  skippedNodeIds: string[];
}
```

`buildWorkflowIR(nodes, edges, preflight?)`:

- Başlangıç: `LAUNCH_APP` veya ilk node.
- `IF_LOGIN` / `CHECK_ROUTE`: preflight ile resolve; aksi halde `runtime-condition`.
- `CONDITION`: her zaman `ui-condition` (generic).
- Diğerleri: `macro`.

**Önemli semantik (mevcut):**  
`IF_LOGIN` / `CHECK_ROUTE` için **false dalı** “yapılması gereken iş” (login / select route); **true dalı** convergence (zaten login / rota seçili).  
`CHECK_ROUTE` için yalnızca `routeSelected === true` compile-time `true` sayılır; `false`/unknown → **runtime UI probe** (flavor’lar rota istemeyebilir).

### 2.2 Tek derleyici = Maestro

`yaml-generator.generateWorkflowWorkspace`:

1. `buildWorkflowIR(...)`
2. `macro` / `resolved-condition.branch` → subflow YAML + `runFlow: file:`
3. `runtime-condition` → `extendedWaitUntil` + `runFlow when: visible: id:`
4. `ui-condition` → `generateConditionalYaml` (Maestro `when:` / `notVisible`)

Yorum satırı (kodda): *“Today the only compiler is the Maestro workspace compiler”*.

### 2.3 Preflight kim sağlar?

`workflow-runner.ts` + `preflight-plan.ts`:

- `getDeviceBridgeState` → `isLoggedIn`, `routeSelected`, `currentScreen`
- Evidence string DB/UI’ya yazılır (`conditionDecisions`)
- Preflight yoksa IR `runtime-condition` üretir; Maestro UI fallback’e düşer

**`planPreflight` kuralları (koşul motoruna taşınmalı — kritik):**

| Durum | Plan | Anlam |
|---|---|---|
| `LAUNCH_APP` + `clearState: true` | `force_logged_out` | Compile-time logged-out varsay |
| `LAUNCH_APP` var (clear değil) | **`defer_to_runtime`** | Pre-launch `GET_STATE` bayat olabilir (StopList görünüp PIN’e düşme) — IF_LOGIN/CHECK_ROUTE **runtime probe** |
| LAUNCH_APP yok | `pull_now` | Hemen `get_state` |

Bu kural olmadan koşul motoru “yanlış compile-time skip” üretir. BridgeFlow’da da aynı kapı zorunlu.

### 2.4 Editör koşul node’ları

`workflow-registry.ts` (özet):

| Type | Kind | Branches | Not |
|---|---|---|---|
| `IF_LOGIN` | condition | true/false | defaultConfig: login button id |
| `CHECK_ROUTE` | condition | true/false | expectedRoute |
| `CONDITION` | condition | true/false | defaultConfig.expression (şimdilik zayıf / UI-visibility’e düşüyor) |
| Action macros | `AUTH_LOGIN`, `SELECT_ROUTE`, … | — | false dallarında yaşar |

---

## 3. Koşul motoru — tanım (yazılacak iş)

### 3.1 Ne değildir?

- YAML builder değildir.
- Maestro executor değildir.
- Bridge APK değildir.
- Oracle / backend validator değildir (onlar kanıt katmanı).

### 3.2 Nedir?

**Koşul motoru = planlama + runtime karar sözleşmesi.**

İki faz:

| Faz | Ad | Girdi | Çıktı |
|---|---|---|---|
| **Compile** | `planConditions` / `buildWorkflowIR` | graf, edges, `IRPreflight`, (opsiyonel) policy | `WorkflowIR` + `ConditionDecision[]` |
| **Runtime** | `evaluateRuntimeCondition` | IR step (`runtime-condition` \| `ui-condition`), Bridge probe sonucu, host event (isteğe bağlı) | `take_branch` \| `skip_branch` \| `fail` + evidence |

Compile fazı **IR üretir**. Runtime fazı **IR tüketir**; yeni IR üretmez (karar log’a / run store’a yazılır).

### 3.3 Önerilen modül sınırları

| Dosya | Rol |
|---|---|
| `workflow-ir.ts` | IR tipleri + graf walk (kalır; ince kalmalı) |
| **`condition-engine.ts`** *(yeni)* | Resolve kuralları, probe seçimi, policy, `ConditionDecision`, runtime evaluate API |
| `preflight-plan.ts` | Hangi koşulun preflight istediği (mevcut; engine’e bağlanır) |
| **`bridge-flow-compiler.ts`** *(yeni)* | `WorkflowIR` → `BridgeFlowPlan` |
| **`bridge-flow-executor.ts`** *(yeni)* | Planı çalıştırır; runtime’da `condition-engine.evaluateRuntimeCondition` çağırır |
| `yaml-generator.ts` | Geçici; M5’te silinir veya BridgeFlow’a dönüştürülür (Maestro emit yok) |

---

## 4. API yüzeyi (bağlayıcı sözleşme)

### 4.1 Compile

```ts
interface ConditionPlanInput {
  nodes: GraphNode[];
  edges: IREdge[];
  preflight: IRPreflight | null;
  /** Workflow-level dialog / probe policy (canvas dışı). */
  policy?: ConditionPolicy;
  appId: string;
  country?: string;
  environment?: string;
}

interface ConditionPlanResult {
  ir: WorkflowIR;
  decisions: ConditionDecision[];
  /** Runtime’da lazım olacak probe tanımları (derleyiciye ipucu). */
  runtimeProbes: RuntimeProbeSpec[];
}

interface ConditionDecision {
  nodeId: string;
  nodeType: string;
  decision: "skip_branch" | "take_branch" | "runtime_fallback" | "fail";
  evidence: string;
  /** monoTs host saati — rapor şelalesi için. */
  decidedAtMonoTs?: number;
}

function planConditions(input: ConditionPlanInput): ConditionPlanResult;
// Mevcut buildWorkflowIR bunun çekirdeği olabilir; karar kuralları condition-engine’e taşınır.
```

### 4.2 Runtime

```ts
type ProbeResult =
  | { status: "visible"; target: string; monoTs: number; obscuredBy?: string | null }
  | { status: "not_visible"; target: string; monoTs: number }
  | { status: "ambiguous"; count: number; monoTs: number }  // FAIL — nodes[0] YASAK
  | { status: "error"; code: string; message: string; monoTs: number };

interface RuntimeEvalInput {
  step: Extract<IRStep, { kind: "runtime-condition" | "ui-condition" }>;
  probe: ProbeResult;
  /** İsteğe bağlı: host ingest’ten gelen iş event’i (dal seçimi nadiren; genelde wait ayrı). */
  hostHint?: { eventName: string; monoTs: number };
}

interface RuntimeEvalResult {
  decision: "take_branch" | "skip_branch" | "fail";
  evidence: string;
  /** Rozet UI katmanı için. */
  uiLayer: "pass" | "fail" | "unmeasured";
}

function evaluateRuntimeCondition(input: RuntimeEvalInput): RuntimeEvalResult;
```

### 4.3 Probe spec (derleyiciye / Bridge’e)

```ts
interface RuntimeProbeSpec {
  conditionNodeId: string;
  conditionType: "IF_LOGIN" | "CHECK_ROUTE" | "CONDITION" | string;
  /** Bridge find/wait hedefi — sabit koordinat YOK. */
  probe:
    | { kind: "id"; resourceId: string; timeoutMs: number }
    | { kind: "text"; text: string; exact: true; timeoutMs: number }
    | { kind: "config"; fromNodeConfigKey: string; timeoutMs: number };
  /** true görünürse hangi handle? Mevcut: IF_LOGIN btn_login visible → false branch (login gerekir). */
  visibleMeans: "take_branch" | "skip_branch";
}
```

**Mevcut probe eşlemesi (korunacak, Bridge’e taşınacak):**

| Node | Probe (appId’li resource) | Timeout (bugün) | visible ⇒ |
|---|---|---|---|
| `IF_LOGIN` | `{appId}:id/btn_login` | 5000 ms | **take_branch** (false edge: AUTH_LOGIN) |
| `CHECK_ROUTE` | `{appId}:id/dialog_spinner` | 15000 ms | **take_branch** (false edge: SELECT_ROUTE) |
| `CONDITION` | node config (`elementId` / expression→UI) | config | generateConditionalYaml semantiği → Bridge `wait_node` |

> Not: Mevcut “true edge = convergence” modeli dokunulmadan BridgeFlow’a taşınır. Graf semantiği değiştirmek ayrı breaking change olur.

---

## 5. BridgeFlowPlan — IR derleyicisinin çıktısı

Maestro YAML’ın yerine geçen **nötr yürütme planı** (JSON/TS object; dosya artifact opsiyonel).

```ts
type BridgeFlowOp =
  | { op: "sdk"; control: ControlOperation; /* set_run, seed, navigate, get_state, ... */ }
  | {
      op: "bridge";
      bridge: BridgeCommand;
      /** tap_id / tap_text / wait_node / input_text / swipe / scroll_to_item /
       *  collection_info / dump / back / screenshot / activate_id (kaçış; method:"semantic") */
      /** Belirsizlik kapsamı: @row=N (CollectionItemInfo.rowIndex) — nodes[0] YASAK */
      rowIndex?: number;
      requestId: string; // idempotent
    }
  | { op: "host_wait_event"; eventName: string; timeoutMs: number; /* ingest — C.12.2; fan-out DEĞİL */ }
  | { op: "condition_runtime"; spec: RuntimeProbeSpec; branch: BridgeFlowOp[]; onSkip: BridgeFlowOp[] }
  | { op: "macro_markers"; nodeId: string; phase: "start" | "done" }
  | { op: "server_step"; /* mevcut post-Maestro server-steps karşılığı */ };

interface BridgeFlowPlan {
  runId: string;
  appId: string;
  steps: BridgeFlowOp[];
  skippedNodeIds: string[];
  decisions: ConditionDecision[];
  compiler: "bridge-flow";
  irVersion: 1;
}
```

**Derleme kuralları:**

| IR step | BridgeFlowOp |
|---|---|
| `macro` (örn. AUTH_LOGIN) | Önce mümkünse **SDK `seed` login**; UI PIN yolu varsa Bridge `input_text`+`tap_*` (field-login ile aynı disiplin). Marker start/done. |
| `macro` (SELECT_ROUTE) | SDK `seed` select_route tercih; UI gerekirse Bridge. |
| `macro` (LAUNCH_APP vb.) | Bridge/ADB launch politikası (ayrı); marker. |
| `resolved-condition` + skip | Sadece decision kaydı; branch boş. |
| `resolved-condition` + take | `branch` macro’ları derlenir. |
| `runtime-condition` | `condition_runtime` + probe spec + branch ops. |
| `ui-condition` | `condition_runtime` (generic) veya iki yönlü branch planı. |

**Bekleme ayrımı (VERDICT_START #9 — bağlayıcı):**

| Ne bekleniyor? | Nerede? |
|---|---|
| Ekran / node görünürlüğü | **Bridge** `wait_node` (tek round-trip) |
| İş event’i (`STATE_LOGIN`, `ROUTE_SELECTED`, …) | **Host** `waitEvent` — **ingest** akışından; fan-out worker’dan **değil** |

### 5.1 Sınırlandırılmış ekran okuma — `DumpScope` (VERDICT_START C19)

**Sorun:** Tek buton ararken yüzlerce elementlik tam hiyerarşi dump’ı cihazı ve host’u yorar.  
**Kural:** Hot path’te **tam dump yok**. Tek hedef → `wait_node` / `find_id` / `tap_id`. `dump` ancak bilinçli scope ile.

```ts
/** Bridge `dump` isteği — scope ZORUNLU; yoksa protokol hatası (full'a sessiz düşülmez). */
type DumpScope =
  | { scope: "full" }
  | { scope: "subtree"; rootId: string; maxDepth?: number }
  | { scope: "depth"; maxDepth: number }
  | {
      scope: "match";
      by: "id" | "text";
      value: string;
      exact?: boolean; // text için varsayılan true (C6)
      rowIndex?: number; // @row=N — yokken 2+ eşleşme = ambiguous
    };

type DumpRequest = {
  op: "dump";
  requestId: string;
  scope: DumpScope;
};

type DumpNode = {
  id?: string;
  text?: string;
  bounds: { l: number; t: number; r: number; b: number };
  visible: boolean | "unmeasured";
  obscuredBy: string | null | "unmeasured";
  children?: DumpNode[];
};

type DumpResponse = {
  requestId: string;
  monoTs: number;
  scope: DumpScope;
  /** full/subtree/depth → ağaç; match → düz liste (0..N) */
  roots?: DumpNode[];
  matches?: DumpNode[];
  error?: "not_found" | "ambiguous" | "not_ready" | "protocol";
  ambiguousCount?: number;
};
```

| Kullanım | Scope | Kim çağırır |
|---|---|---|
| Koşul probe / tap hedefi | Dump **yok** → `wait_node` / `find_*` / `tap_*` | BridgeFlowExecutor |
| Dialog içi (kök = dialog id) | `subtree` + `rootId` | Macro / SELECT_ROUTE iç adımları |
| Global dialog politikası (sığ) | `depth`, `maxDepth: 3` (önerilen varsayılan) | Her adım öncesi policy turu |
| Live Inspector ayna / Screen Map | `full` | Operatör UI — pahalı, seyrek |
| Tanınmayan dialog / repro kopyala | `full` (+ screenshot) | Fail path — bilinçli |

**Derleyici kuralı:** `BridgeFlowCompiler` asla koşul/tap için `dump.full` emit etmez.  
**RED:** `scope` yokken full’a düşmek · `match`’te `nodes[0]` seçmek · depth’siz “hafif dump” iddiası.

### 5.2 Liste: “şu shipment id’yi bul ve içine gir” (Brain + Live Inspector)

Operatör anlatımı: [`SISTEM_NASIL_CALISIR.md`](./SISTEM_NASIL_CALISIR.md) §3.1.

**Yazma (Live Inspector, bir kez):** Operatör aynada satıra tıklar → Cockpit semantik hedefi (liste kökü + satır eşleştirme anahtarı) öğrenir → canvas’ta tek macro node (`OPEN_LIST_ITEM` / `OPEN_SHIPMENT`). Aranan değer sabit veya `{{shipmentId}}` run input.

**Koşma (BridgeFlow — hot path’te `dump.full` yok):**

```ts
// Derleyicinin ürettiği öz (şematik)
type OpenShipmentOps = [
  { op: "bridge"; bridge: { cmd: "collection_info"; listId: string }; requestId: string },
  // görünür değilse tekrarlanır:
  { op: "bridge"; bridge: {
      cmd: "scroll_to_item";
      listId: string;
      match: { by: "text" | "id"; value: string; exact: true }; // value = resolved {{shipmentId}}
    }; requestId: string },
  { op: "bridge"; bridge: {
      cmd: "tap_text" | "tap_id";
      value: string;
      rowIndex?: number; // CollectionItemInfo.rowIndex — belirsizlikte zorunlu
    }; requestId: string },
  { op: "host_wait_event"; eventName: string; timeoutMs: number }, // örn. stop/parcel opened
];
```

| Adım | Bridge komutu | Cockpit (brain) kararı |
|---|---|---|
| 1 | `collection_info` | `rowCount`, görünen aralık; hedef aralıkta mı? |
| 2 | `scroll_to_item` | Görünmüyorsa kaydır; max scroll aşımı → **fail not_found** |
| 3 | `tap_*` + opsiyonel `@row` | 0 eşleşme → fail; 2+ ve row yok → **ambiguous, dokunma** |
| 4 | — | Host `waitEvent` (SDK) — içerik açıldı mı? |

**DumpScope ilişkisi:** Liste taramasında varsayılan dump **yok**. Gerekirse yalnızca `match` (tek satır metadata) veya dialog için `subtree` — asla her scroll’da `full`.

**RED:** Görünen ilk benzer satıra bas (`nodes[0]`) · her adımda full dump · shipment başına ayrı canvas node (FOR_EACH / run input kullan).

---

## 6. Dialog politikası (koşul motorunun kardeşi)

Koşul motoru **node dallarını** yönetir. Dialog’lar (VERDICT_START / C.14):

| Tür | Motor |
|---|---|
| Akışın parçası (rota dialog, PIN, barkod) | **Node içi** / koşul+macro — canvas’ta tek kutu |
| Bilinen beklenmedik (ağ, oturum, Samsung) | **GLOBAL policy** — her adımdan önce; koşul node’u değil |
| Tanınmayan | **DUR** — screenshot + **`dump` scope:`full`** + rapor; kapatmaya çalışma |

`ConditionPolicy` içinde `globalDialogs[]` tutulur; BridgeFlowExecutor her Bridge op öncesi policy’yi uygular. Bu, `CONDITION` node spam’ını önler.

---

## 7. Dört rozet × koşul × çekmece (Development Flow + AI Arch)

### 7.1 Rozet kuralları (bağlayıcı — PDF C11–C12 / RED D6–D7)

| Kural | Detay |
|---|---|
| Katmanlar | 👆 **UI** · ⚡ **App** · 💾 **Local** · ☁ **Remote** — tek “Data” **YASAK** |
| Node başına bildirim | `workflow-registry.ts` her node tipinin hangi katmanları taşıdığını ilan eder (WAIT→hiç/az, ASSERT_VISIBLE→UI, CHECK_BACKEND→Remote, …). Sabit 4 rozet her node’da **yok**. |
| Bağımsız yanma | Kanıt gelince yanar; sıra animasyonu **yok** (sıra şelalenin `monoTs` işi) |
| `QUEUE_OFFLINE` | Remote yanmaması = **hata değil**; Local+kuyruk sonucu (AI Arch Faz 4 notu) |
| `ölçülmedi` ≠ `temiz` | Bridge `obscuredBy`/`visible` yoksa gri “ölçülmedi”; asla “Temiz” |

### 7.2 Koşul × rozet

| Karar kaynağı | Rozet etkisi |
|---|---|
| Preflight `get_state` | App (state) + evidence |
| Bridge `visible`/`obscuredBy` | **UI** |
| Host event sonrası | App / Local / Remote ilgili wire’a göre bağımsız |
| Ambiguous / obscured tap | UI **fail**; `nodes[0]` yok |

### 7.3 “Event gelmedi” — üç neden (Development Flow madde 3) **EKSİKTİ → burada zorunlu**

Turuncu/kırmızı “event yok” **tek suçlu uygulama sanılmayacak**. Çekmece ayırır:

| Neden | Suçlu | Kanıt |
|---|---|---|
| Cihaz hiç yayınlamadı | Uygulama | `EmitOutcome` yok, WAL’da kayıt yok |
| Cihaz yayınladı, host reddetti/geç kaldı | Host | `EmitOutcome: Appended`, WAL var, `lastContiguousSeq` ilerlemedi |
| Geldi ama assertion penceresinden sonra | Zamanlama | `monoTs` farkı |

Veri zaten var (6 durumlu `EmitOutcome`, WAL, host watermark) — yeni wire adı yok.

### 7.4 Çekmece önce, rozet sonra (C18) + repro

| Öncelik | İş | Not |
|---|---|---|
| **1** | Telemetri çekmecesi: şelale (`monoTs` join: bridge + SDK + Oracle) | Değerin %80’i; `runs/[runId]/page.tsx` spans/timeline **önce oku**, sıfırdan yazma |
| **2** | “Repro kopyala”: Bridge komutu + `requestId` + o anki dump | AI Arch Faz 5.3 |
| **3** | Node rozetleri (canlı animasyon en son) | Cila |
| Opsiyonel | Post-run LLM özeti (çekmece üstü teşhis) | AI Arch Faz 5.2 — **runtime’da AI yok**; sadece post-run. Koşul motoru kapsamı dışı, Reporting izi |

---

## 8. Maestro’dan taşıma matrisi (koşul odaklı)

| Bugün (Maestro) | Yarın (BridgeFlow) |
|---|---|
| `buildWorkflowIR` | Aynı + `condition-engine` extract |
| `extendedWaitUntil` + `runFlow when: visible` | Bridge `wait_node` + host-side branch |
| `generateConditionalYaml` | `condition_runtime` ops |
| `conditionDecisions` in workspace | `BridgeFlowPlan.decisions` + run store |
| `NESY_STEP::` stdout markers | Host marker / structured span (mevcut run UI’ya bağlanır) |
| `NESY_SELECT_ROUTE` / `NESY_LOGIN` Maestro evalScript | Doğrudan SDK `seed` (zaten bridge’te kısmen var) — koşul sonrası macro |
| Tek Maestro process | Tek BridgeFlowExecutor process (DeviceWorker kuyruğunda) |

---

## 9. Uygulama sırası (koşul motoru + derleyici)

Faz 4 VerdictChannel ile **paralel** başlar; M5 Maestro DELETE önkoşulu.

| Adım | İş | Gate |
|---|---|---|
| **CE-0** | Bu doküman + call-site listesi | — |
| **CE-1** | `condition-engine.ts`: kuralları `workflow-ir` / yaml’dan taşı; unit test (mevcut `yaml-generator.test` IR kararlarını buraya taşı) | JVM/unit yeşil |
| **CE-2** | `RuntimeProbeSpec` üretimi; Maestro compiler geçici olarak bundan beslensin (davranış değişmez) | Golden YAML bit-exact veya karar listesi eşit |
| **CE-3** | `BridgeFlowCompiler` v0: sadece `resolved-condition` + `macro` (seed-heavy flows) | field-login / select_route E2E’siz duman |
| **CE-4** | Runtime evaluate + Bridge `wait_node` | IF_LOGIN / CHECK_ROUTE runtime path |
| **CE-5** | `ui-condition` + **global dialog policy** (sekme: workflow ayarı, canvas kirletmez) | CONDITION + bilinmeyen dialog → DUR |
| **CE-5b** | Editör: `workflow-registry` **layers[]** bildirimi + `FOR_EACH` node (IR `loop` additive) | Rozet gri dekorasyon olmasın; 20 barkod = 1 döngü |
| **CE-6** | Dual-run ölçüm (#14) | BridgeFlow ≥ Maestro doğrulama |
| **CE-7** | Cutover + Maestro DELETE (üst plan M4–M5) | `rg maestro` ≈ 0 |
| **RP-1** *(Reporting, paralel)* | Çekmece şelale + 3’lü “event gelmedi” + repro kopyala | Rozet animasyonundan **önce** |
| **RP-2** *(Reporting)* | Node rozetleri (registry layers) | RP-1 sonrası |
| **RP-3** *(opsiyonel)* | Post-run LLM özeti | Runtime AI **yok** |

**Editör / IR breaking change yok** hedefi: CE-1…CE-5 boyunca `WorkflowIR` shape korunur; gerekirse additive field.

---

## 10. Test planı (yazılmadan merge edilmez)

### 10.1 Unit — koşul motoru

| Case | Preflight | Beklenen IR |
|---|---|---|
| IF_LOGIN + logged in | `isLoggedIn: true` | `resolved-condition` skip_branch; AUTH_LOGIN skipped |
| IF_LOGIN + logged out | `isLoggedIn: false` | `resolved-condition` take_branch; AUTH_LOGIN in branch |
| IF_LOGIN + no preflight | null | `runtime-condition` + btn_login probe |
| CHECK_ROUTE + route selected | `routeSelected: true` | skip_branch |
| CHECK_ROUTE + not selected | `routeSelected: false` | **runtime-condition** (bugünkü semantik — false compile-time resolve değil) |
| CHECK_ROUTE + unknown | null | runtime-condition |
| CONDITION | any | ui-condition |

### 10.2 Unit — runtime evaluate

| Probe | visibleMeans take | Sonuç |
|---|---|---|
| visible | take_branch | take_branch |
| not_visible | take_branch | skip_branch |
| ambiguous | any | **fail** |
| obscuredBy set | take_branch | policy: fail veya unmeasured+fail (varsayılan: **fail** — overlay altında tıklama yok) |

### 10.3 Entegrasyon

- Aynı golden workflow: Maestro plan decisions ≡ BridgeFlow decisions (CE-2/CE-6).
- Host waitEvent: fan-out’a bağlı timeout **olmaması** (ingest path).
- InteractionCapture: Bridge tap’ları insan hacminden ayrılır (CP3 notu; raporlama).

---

## 11. Dosya / sahiplik haritası

| Alan | Path |
|---|---|
| IR | `apps/api/src/services/workflow-ir.ts` |
| Koşul motoru (yeni) | `apps/api/src/services/condition-engine.ts` |
| Preflight plan | `apps/api/src/services/preflight-plan.ts` |
| Maestro derleyici (ölüm sırası) | `apps/api/src/services/yaml-generator.ts` |
| BridgeFlow derleyici (yeni) | `apps/api/src/services/bridge-flow-compiler.ts` |
| BridgeFlow yürütücü (yeni) | `apps/api/src/services/bridge-flow-executor.ts` |
| Runner orkestrasyon | `apps/api/src/services/workflow-runner.ts` |
| Device kuyruk | `apps/api/src/services/device-worker.ts` |
| SDK komut | `packages/control-contract`, `packages/control-channels`, `test-event-bridge.ts` |
| Editör | `apps/web/.../workflow-editor.tsx`, `workflow-registry.ts` |
| Üst Maestro DELETE | `docs/verdict/COCKPIT_SDK_BRIDGE_COMPAT_PLAN.md` §9 |

---

## 12. Operatör / geliştirici FAQ

**Q: Koşul motoru yazmak için YAML öğrenmem lazım mı?**  
A: Hayır. IR step + probe + Bridge komut sözleşmesi yeterli.

**Q: IR’ı kim üretir?**  
A: Compile fazında koşul motoru / `buildWorkflowIR`. Editör IR üretmez; graf üretir.

**Q: Runtime’da tekrar IR mı build edilir?**  
A: Hayır. Run başında bir kez planlanır; runtime sadece `runtime-condition` / `ui-condition` adımlarını evaluate eder.

**Q: `navigate` ControlOperation?**  
A: Contract’ta var; Cockpit production’da henüz caller yok. Koşul sonrası ekran geçişi çoğunlukla Bridge `wait_node` + action macro; SDK `navigate` Mobile 4.0+ ile eklenebilir — koşul motorundan bağımsız.

**Q: FOR_EACH?**  
A: Editör eksik node (VERDICT_START). Koşul motoru v1 scope dışı; IR’a sonra `loop` step eklenebilir (additive).

---

## 13. Codex / uygulama prompt’u (kopyala-yapıştır)

Aşağıdaki prompt, **CE-1** için Codex’e verilebilir (sandbox’ta Cockpit repo root):

```text
Repo: NesyMobileCocpit

Task CE-1 — Extract condition engine WITHOUT changing Maestro behavior.

1. Read apps/api/src/services/workflow-ir.ts and the generateWorkflowWorkspace
   condition paths in yaml-generator.ts (resolved / runtime / ui-condition).
2. Create apps/api/src/services/condition-engine.ts that owns:
   - planConditions({ nodes, edges, preflight, appId }) → { ir, decisions, runtimeProbes }
   - probe specs for IF_LOGIN (btn_login) and CHECK_ROUTE (dialog_spinner)
     matching current timeouts and visibleMeans semantics
   - evaluateRuntimeCondition() pure function for ProbeResult → take|skip|fail
3. Refactor buildWorkflowIR / generateWorkflowWorkspace to call planConditions
   so Maestro output and conditionDecisions stay identical (bit-exact or
   decision-list equal). Keep workflow-ir types stable.
4. Move/adapt tests from yaml-generator.test.ts condition cases into
   condition-engine.test.ts; keep a thin yaml-generator regression test.
5. Do NOT delete Maestro. Do NOT implement BridgeFlowCompiler yet.
6. Write a short RESULT note under docs/verdict/ or verdict-spike if present.

Constraints from docs/verdict/CONDITION_ENGINE_AND_BRIDGEFLOW.md:
- Condition engine does not emit YAML
- ambiguous probe → fail (no nodes[0])
- CHECK_ROUTE: only routeSelected===true is compile-time true
```

**CE-3+ için ayrı prompt** ancak CE-1 yeşil + Bridge host istemci (M1) hazır olduktan sonra.

---

## 14. Çapraz kontrol — Development Flow PDF + AI Architecture PDF + VERDICT_START

Kaynaklar: `Development_Flow.pdf` (C/D/B + sıra) · `18._ai_architecture.pdf` (5 faz vizyon) · `VERDICT_START.md` İz B.

### 14.1 Zaten kapalı (dokümanlarda yazılı)

| Madde | Nerede |
|---|---|
| Bridge eylem / SDK komut ayrımı; tap SDK’ya girmez | VERDICT_START B3, C1; üst plan üç ray |
| Scoped dump (`full`/`subtree`/`depth`/`match`); hot path’te full yok | VERDICT_START C19; bu dosya §5.1 |
| Semantik hedef, `dispatchGesture`, `activate_id`, ambiguous, exact text | VERDICT_START C2–C6 |
| `visible`/`obscuredBy`, ölçülmedi≠temiz | C7–C8; bu dosya §7 |
| waitEvent host ingest / wait_node bridge | C9; bu dosya §5 |
| requestId + idempotent | C10; BridgeFlowOp |
| 4 rozet UI/App/Local/Remote; sabit 3 RED | C11–C12; §7 |
| monoTs şelale; bridge yanıtına monoTs | C13; B1 |
| Maestro ölçülebilir silme + Cockpit DELETE | C14; üst plan §9 |
| Prod’a bridge yok; sessiz fallback yok | C15–C16 |
| Live Inspector tıkla→node; Screen Map app sürümü | C17; üst plan İz B |
| sdk.waitEvent / performAction default / extractItemData / L2 PSS / nodes[0] RED | VERDICT_START D |
| InteractionCapture sentetik≠insan | VERDICT_START B2 |
| IR 2. derleyici; YAML bilmek şart değil | Bu dosya §0–§3 |
| Dialog 3 tür; SELECT_ROUTE tek kutu | VERDICT_START C.14 |
| `QUEUE_OFFLINE` ≠ hata | VERDICT_START; §7.1 |

### 14.2 Eksikti → bu turda plana işlendi

| Boşluk | Kaynak | Plan kaydı |
|---|---|---|
| “Event gelmedi” 3’lü teşhis (app / host / timing) | Dev Flow #3 | §7.3 |
| Çekmece **rozetlerden önce** + mevcut `runs/[runId]` reuse | Dev Flow #4 tavsiye + C18 | §7.4 RP-1 |
| Repro kopyala (cmd + requestId + dump) | Dev Flow + AI Arch Faz 5 | §7.4 |
| `workflow-registry` node **layers[]** | Dev Flow #1 | CE-5b |
| `FOR_EACH` + dialog politikası **sekmesi** | VERDICT_START editör eksikleri | CE-5 / CE-5b |
| BridgeFlow’da `@row=N`, `activate_id`, tam C.14 komut seti | Dev Flow C5 + VERDICT C.14 | §5 BridgeFlowOp |
| Post-run LLM (runtime AI yok) | AI Arch Faz 5.2 | RP-3 opsiyonel |

### 14.3 Bilinçli kapsam dışı / sonra (vizyon)

| Madde | Kaynak | Karar |
|---|---|---|
| **Yol A — Build-time AI Design Audit** → `expected_rules.json` (Figma+dump+kod → LLM → statik kurallar) | AI Arch Faz 2 Yol A | **İz C (AI)** — BridgeFlow/koşul motorunu **bloklamaz**. Runtime’da AI yok (AI Arch Faz 3). Yol B (Live Inspector) İz B’de. |
| Design Audit Smart Matching (regex / topoloji / uzamsal indeks) | AI Arch Faz 2 | İz C; CE/BridgeFlow v1 değil |
| Bridge APK “~100KB mikro-sunucu” iddiası | AI Arch Faz 1 | Boyut hedefi değil; işlevsel kapılar (C15–C16) bağlayıcı |
| Second-domain bridge port | Dev Flow E | **Sıfırdan** (VERDICT_START); referans only |

### 14.4 Sıra (PDF F ile hizalı — değişmedi)

```
Faz 3 ✅ (koşullu) → Faz 4 (SDK komut) ∥ İz B (Bridge eylem)
                 → CE / BridgeFlow (IR 2. derleyici)
                 → ölçüm → Maestro DELETE
                 → RP çekmece/rozet (C18: çekmece önce)
                 → İz C AI Design Audit (opsiyonel, paralel)
```

---

## 15. Sonuç — tek cümle

Cockpit’in Maestro sonrası beyni **YAML değil**; **editör grafı → koşul motoru / IR → BridgeFlow → SDK + Bridge + host kanıt + çekmece (4 rozet / 3’lü event teşhisi)**. PDF’lerden gelen rozet/çekmece/repro/`@row`/FOR_EACH boşlukları §7 ve CE-5b/RP ile kapatıldı; **build-time AI Design Audit** ayrı İz C’de bırakıldı.
