# Semantic Actions — Domain Pack’ten palete, yetenekten cihaza

**Tarih:** 2026-08-12  
**Durum:** Bağlayıcı mimari notu (hedef akış + bugünkü kod gerçeği).  
**Üst plan:** [`../CONDITION_ENGINE_AND_BRIDGEFLOW.md`](../CONDITION_ENGINE_AND_BRIDGEFLOW.md) · [`../COCKPIT_SDK_BRIDGE_COMPAT_PLAN.md`](../COCKPIT_SDK_BRIDGE_COMPAT_PLAN.md)  
**Borç izi:** [`../run-playbooks/DEBT_INDEX.md`](../run-playbooks/DEBT_INDEX.md) · `phase-5-debt` (5D.1b) · `phase-6-debt` (6D.1e–f)  
**Sözleşme:** `packages/domain-pack-contracts/src/semantic-action.ts`

---

## 0. TL;DR

| Soru | Cevap |
|---|---|
| Sol paletteki iş düğümleri nereden gelir? | **Domain Pack Registry → `semanticActions`**. Kodda sabit liste yazmak geçici/legacy yoldur. |
| Yeni bir semantic action nasıl oluşur? | Pack bundle’ına kayıt girilir; editör kodu yeniden derlenmez. |
| Mobil SDK bitmeden action tanımlanabilir mi? | **Evet.** Tanımlama, publish, palete düşme ve derleme mobil beklemez. |
| Ne zaman mobil gerekir? | Yalnız cihazda **`performAction`** — `requiredCapabilityRefs` karşılanmalı. |
| Yetenek yokken palet ne yapar? | Action **gizlenmez**; `capabilityStatus.satisfied: false` ile **bloklu** gösterilir. |

```text
Cockpit Workflow Editor
  → Domain Pack Registry
      ├── Application / Screen / Surface
      ├── Entity / Target
      ├── Evidence Source
      ├── Semantic Actions        ← palet buradan beslenir
      ├── Macros
      └── Oracle Templates / Launch Profiles
  → WorkflowIR v2 validation
  → BridgeFlowCompiler → BridgeFlowPlan
      └── Capability Requirements
```

---

## 1. Katmanlar — karıştırılmaması gereken üç şey

| Katman | Ne | Nerede |
|---|---|---|
| **A. Tanım** | İş anlamı olan en küçük birim (`SemanticActionDefinition`) | Pack bundle `registries.semanticActions` |
| **B. Genişleme** | Action’ın çalıştırılabilir hali (`MacroDefinition` → generic IR) | Aynı pack; macro `actionRef` ile action’a bağlanır |
| **C. Yürütme** | Cihazda dokunma / adapter / kanıt | Bridge + SDK; `requiredCapabilityRefs` ile kapı |

**RED:** Semantic action’ı Core `WorkflowIR` step kind’ı yapmak.  
Macro **Core union’a genişler**; Core’u genişletmez. Aksi halde ikinci domain Core redesign ister — Phase 4A/4B’nin engellediği borç budur.

**RED:** Yeteneksiz action’ı paletten gizlemek. Fail-closed davranış **görünür + disabled**’dır; operatör “neden yok?” değil “hangi capability eksik?” sorusunu sorar.

**RED:** Paleti `workflow-registry.ts` içinde Maestro komut listesi olarak tutmak. CHECKPOINT madde 2 (“operatör Maestro/YAML bilmeden workflow oluşturabiliyor”) ancak pack beslemesiyle gerçekten sağlanır.

---

## 2. Sözleşme — `SemanticActionDefinition`

Kaynak: `packages/domain-pack-contracts/src/semantic-action.ts`

```ts
SemanticActionDefinition {
  actionKey                 // "nesy.action.open-stop"
  applicationRef
  displayName
  businessMeaning           // ne yapar
  notResponsibleFor         // neyi YAPMAZ — kapsam sınırı (zorunlu)
  screenRefs, surfaceRefs
  entityTypeRefs, targetRefs
  requiredCapabilityRefs    // ← mobil / Bridge bağı burada
}
```

### Alanların yükü

| Alan | Neden var |
|---|---|
| `businessMeaning` | Operatör ve derleyici aynı cümleyi görür; “ne iş?” sorusu proza kaçmaz. |
| `notResponsibleFor` | Yalnız pozitif kapsam yazmak “her şeyi kapsar” okunur. Sınır zorunlu. |
| `screenRefs` / `surfaceRefs` / `targetRefs` | Action’ın hangi UI bağlamında anlamlı olduğu. Palet gruplaması ve macro allowlist buradan beslenir. |
| `requiredCapabilityRefs` | Compile-time gereksinim listesi + palette gating + runtime admission. Bağ **eylem başına yetenek**tir; “mobil bitsin sonra hepsi açılır” değildir. |

Macro tarafı (`MacroDefinition`) aynı pack’te yaşar: input/output şeması, precondition’lar, interrupt policy, oracle template, isteğe bağlı `expansionSnapshot` / `bridgeFlowPlanSnapshot`. Snapshot bir derleyici değildir — review + regresyon fikstürüdür; gerçek derleme `BridgeFlowCompiler` yolundadır.

---

## 3. Yaşam döngüsü — mobil ne zaman girer?

| Aşama | Mobil gerekir mi | Not |
|---|---|---|
| Semantic action tanımlama (pack’e yazma) | **Hayır** | Bundle / admin yüzey |
| Pack publish | **Hayır** | Domain Pack admin |
| Palete düşme | **Hayır** | `GET …/semantic-actions` |
| WorkflowIR validate + BridgeFlow compile | **Hayır** | Capability requirement **çıkarılır**, cihazda doğrulanmaz |
| Palette’te capability durumu gösterme | **Hayır*** | *Gösterim host’ta; yeşile dönmesi negotiation’a bağlı |
| Cihazda `performAction` | **Evet** | Mobil Faz 3 (Bridge B2 `capabilities`) + Faz 4b (App Adapter) |

`performAction` yalnız contract allowlist’indeki semantic action için açılır. Eksik yetenek → gizleme değil, blok + gerekçe.

---

## 4. Okuma yolu — pack’ten palete

### 4.1 HTTP read model

```http
GET /runtime/domain-packs/:packKey/:version/semantic-actions
```

Uygulama: `apps/api/src/services/domain-pack-read-models.service.ts` → `listSemanticActions`  
Route: `apps/api/src/routes/verdict-phase6-contracts.routes.ts`

Yanıt şekli (özet):

```jsonc
{
  "apiVersion": "verdict-runtime.v1",
  "packKey": "nesy-courier",
  "packVersion": "1.0.0",
  "partial": false,
  "items": [{
    "actionKey": "nesy.action.open-stop",
    "displayName": "Open Stop",
    "businessMeaning": "...",
    "notResponsibleFor": ["..."],
    "applicationRef": "nesy.app.courier",
    "screenRefs": ["nesy.screen.tour"],
    "requiredCapabilityRefs": ["verdict.core.bridge.tap"],
    "capabilityStatus": {
      "satisfied": false,
      "missing": ["verdict.core.bridge.tap"],
      "reason": "Bridge B2 capability negotiation requires a deviceId"
    }
  }],
  "macros": [ /* özet + capabilityStatus */ ]
}
```

Web mirror tipleri: `SemanticActionApi`, `SemanticActionCatalogApi`  
(`apps/web/src/lib/verdict-runtime/types.ts`)

Client: `fetchVerdictSemanticActions(packKey, version)`  
(`apps/web/src/lib/verdict-runtime/client.ts`)

### 4.2 Sol palet (asıl editör yüzeyi)

| Dosya | Rol |
|---|---|
| `…/automation/[id]/workflow-editor.tsx` | Yayınlanmış pack’i pin’ler, catalog çeker, palette source’u kurar |
| `…/automation/[id]/pack-palette.ts` | `buildPackPaletteGroups` — action → `PaletteItem`; capability fail → `paletteDisabled` |
| `…/automation/[id]/workflow-registry.ts` | Yapısal/scaffold node tanımları + tone; **Courier Actions artık pack primary değil** |

Gruplama kuralı: `applicationRef` → (varsa) `screenRefs` alt başlıkları.  
Scaffolding (`LAUNCH_APP` vb.) pack’ten gelmez; `buildEditorScaffoldingGroups()` ile yan yana durur.

### 4.3 Verdict paneli paleti

`SemanticActionPalette.tsx` aynı read model’i kullanır (`fetchVerdictDomainPacks` + `fetchVerdictSemanticActions`). Sol paletten ayrı UI; kaynak sözleşmesi aynıdır.

### 4.4 Capability gating (fail-closed)

`capabilityStatusFor` (`domain-pack-read-models.service.ts`):

1. `requiredCapabilityRefs` boş → `satisfied: true`
2. `deviceId` yok / negotiation yok → refs doluysa `satisfied: false`, reason açık
3. `deviceId` var → host baseline (`deriveCapabilityManifest` / negotiated set) ile diff; eksikler `missing[]`

UI (`paletteItemFromSemanticAction`): `satisfied === false` → item görünür, drop/disable gerekçeli.

Live BridgeDeviceManager handshake ile cihazın gerçek capability setinin sürekli güncellenmesi mobil Faz 3 tamamına bağlıdır; host tarafı bugün fail-closed baseline ile çalışır.

---

## 5. Yazma yolu — pack’e nasıl girer?

Hedef yazım yüzeyi:

```text
/automation/domain-packs/[packId]  →  "Semantic Actions & Macros" sekmesi
```

Bundle alanı: `registries.semanticActions`  
(`packages/domain-pack-contracts/src/bundle.ts`)

Referans pack örneği: `domain-packs/nesy-courier` — action’lar TypeScript bundle’da tanımlanır, publish ile runtime store’a iner.

### Bugünkü UI gerçeği

`DomainPackTabs.tsx` bu sekmede hâlâ **`CountView`** kullanır — sayı gösterir, CRUD / alan düzenleme yoktur.  
Yani **okuma + palet cutover** çalışır; **Cockpit içinden authoring** henüz Surface Registry sınıfı bir borçtur (pack dosyasından / admin bundle yolundan yazılır).

---

## 6. Derleme yolu — paletten BridgeFlow’a

```text
Editör node (SEMANTIC_ACTION + actionKey)
  → koşul motoru / WorkflowIR v2
  → BridgeFlowCompiler (pack bundle.registries.semanticActions + macros)
  → BridgeFlowPlan + Capability Requirements
  → BridgeFlowExecutor + VerdictChannel + (cihazda) performAction
```

Compiler pack’teki semantic action / macro kayıtlarına bakar (`packages/bridgeflow-compiler`).  
Action’ın `requiredCapabilityRefs`’i planın capability setine yansır; admission ve preflight bu set üzerinden konuşur.

Kaynak haritası kuralı (sözleşme başlığı):  
**domain macro → generic IR step → runtime occurrence** zinciri kopmamalı. Operatör sorusu her zaman “hangi iş eylemi başarısız?”tır; IR step id yetmez.

---

## 7. Bugünkü durum özeti (kod gerçeği)

| Parça | Durum | Kanıt / path |
|---|---|---|
| Contract `SemanticActionDefinition` | Var | `packages/domain-pack-contracts/src/semantic-action.ts` |
| Pack bundle + validate | Var | `bundle.ts`, `validate.ts`; nesy-courier |
| SemanticActionQuery API + `capabilityStatus` | Var (5D.1b) | `domain-pack-read-models.service.ts` |
| Verdict `SemanticActionPalette` pack okuma | Var (6D.1e) | `SemanticActionPalette.tsx` |
| Sol palet pack primary cutover | Var (6D.1f) | `pack-palette.ts` + `workflow-editor.tsx` |
| Domain Pack detayında action CRUD | **Yok** — yalnız sayaç | `DomainPackTabs.tsx` → `CountView` |
| Live Bridge B2 negotiation → yeşil capability | **Kısmi / harici** | `deviceId` + baseline; tam cihaz handshake mobil Faz 3 |
| `performAction` cihaz yürütmesi | Mobil İz B | Faz 3 + Faz 4b |

`workflow-registry.ts` hâlâ yapısal node ve tone kaynağıdır; Maestro dönemi “Courier Actions” sabit listesi sol paletin **primary** kaynağı olmaktan çıkmıştır. Pack yoksa / catalog boşsa editör boş veya gerekçeli fallback gösterir — sessiz legacy palette yasaktır (6D.1f kabulü).

---

## 8. Eksik / sonraki iş (sınıflandırma)

Sıra bilinçli:

1. **Semantic action CRUD (Cockpit)** — Domain Pack detayında gerçek tanımlama/düzenleme. Bugün CountView. Surface Registry borç sınıfı.
2. **Capability yeşili** — Bridge B2 negotiation’ın `capabilityStatus`’e canlı bağlanması; `deviceId` parametresinin gerçek cihaz setiyle dolması.
3. **Runtime `performAction`** — allowlist + adapter; mobil Faz 3/4b.

1 mobil beklemez. 2’nin *gösterimi* vardır; *yeşile dönmesi* mobille kapanır. 3 tamamen cihaz yoludur.

Playbook çapraz referans:

- API + DTO: `docs/verdict/run-playbooks/phase-5-debt/RUN_PLAY.md` §5D.1b  
- Palette + cutover: `docs/verdict/run-playbooks/phase-6-debt/RUN_PLAY.md` §6D.1e–f  
- Kapanış kanıtı: ilgili `RESULT.md` dosyaları

---

## 9. Operatör için tek cümle

> Workflow’a sürüklediğin kutu bir Maestro komutu değil; yayınlanmış Domain Pack’teki bir **iş eylemidir**. Cihazda çalışıp çalışmayacağı, o eylemin istediği **yeteneklerin** Bridge/SDK tarafından karşılanmasına bağlıdır — yetenek yoksa kutu kaybolmaz, gerekçesiyle kilitli kalır.

---

## 10. İlgili path’ler (hızlı dizin)

```text
packages/domain-pack-contracts/src/semantic-action.ts   # sözleşme
packages/domain-pack-contracts/src/bundle.ts            # registries.semanticActions
packages/bridgeflow-compiler/src/index.ts               # derlemede action kullanımı
domain-packs/nesy-courier/                              # referans pack
apps/api/src/services/domain-pack-read-models.service.ts
apps/api/src/routes/verdict-phase6-contracts.routes.ts
apps/web/src/lib/verdict-runtime/{client,types}.ts
apps/web/src/app/(automation-editor)/automation/[id]/pack-palette.ts
apps/web/src/app/(automation-editor)/automation/[id]/workflow-editor.tsx
apps/web/src/components/automation/editor/SemanticActionPalette.tsx
apps/web/src/components/automation/domain-pack/DomainPackTabs.tsx
apps/web/src/test/left-palette-pack-cutover.test.ts
apps/web/src/test/semantic-action-palette.test.ts
```
