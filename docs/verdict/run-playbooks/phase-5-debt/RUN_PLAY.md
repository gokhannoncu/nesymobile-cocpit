# Phase 5 DEBT RUN_PLAY — Missing Read APIs, Stub Compiler, In-Process Admission

```yaml
runPlayId: verdict-cockpit-phase-5-debt-run-play
debtOf: "5"
phaseName: "Phase 5 carried debt: Phase 6 input contracts that were never exposed"
createdAt: "2026-08-06 09:30:00 +03"
timezone: "Europe/Istanbul"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:76024d898cb152fe4d885fb18e798cb24b6c3df31715eac546c64383ed5c2bd0"
originalRunPlay: "docs/verdict/run-playbooks/phase-5/RUN_PLAY.md"
originalResult: "docs/verdict/run-playbooks/phase-5/RESULT.md"
blocks: "docs/verdict/run-playbooks/phase-6-debt/RUN_PLAY.md"
priority: P0
```

## 1. Why this debt exists

Phase 5 closed as `COMPLETED` with `phase6Readiness: READY_WITH_EXTERNAL_BLOCKERS`,
and its §9 item 45 records **“Phase 6 DTO targets — `PASS`”**.

That claim is false for four surfaces. Phase 5 built the runtime for them and
never exposed a read API, so Phase 6 had nothing to bind to and shipped static
mockups instead. The mockups then passed every unit test and typecheck, which is
why the gap survived two checkpoint closures.

Verified on `2026-08-06` against the running API — the complete route list is:

```text
/runtime/catalog/workflows          /runtime/domain-packs (+/draft /publish /:packKey/:version)
/runtime/compile                    /runtime/test-profiles (+/validate /:profileKey/:version)
/runtime/runs (+/:runId ...)        /runtime/test-campaigns (+/:campaignId)
/runtime/devices/:deviceId/readiness
```

No endpoint exists for Evidence Sources, Semantic Actions, Target Resolution or
Launch Profiles.

## 2. AI agent starting prompt

```text
Verdict Cockpit Phase 5 DEBT'i uygula.

Önce şu dosyaları tamamen oku:
docs/verdict/run-playbooks/phase-5-debt/RUN_PLAY.md
docs/verdict/run-playbooks/phase-5-debt/RESULT.md
docs/verdict/run-playbooks/phase-5/RESULT.md   (§9 madde 45'in neden yanlış olduğunu gör)

Master planda şu bölümleri oku:
- B.20 Evidence Source Registry and Local Reducer
- B.21 Target Resolution Provider Chain
- D.25 Launch Profile/Test Profile runtime dependency sınırları
- D.11B target DTO adapters
- "Registry merkezli hedef akış" (Cockpit Editor → Domain Pack Registry →
  Semantic Actions → WorkflowIR v2 → BridgeFlowCompiler)

Semantic action'lar için özel not: tanımlama/listeleme mobil beklemez, yalnız
performAction ile çalıştırma yetenek gerektirir. capabilityStatus alanıyla bu
ayrımı API'de görünür kıl; action'ı gizleme, bloklu döndür.

Görev: Phase 6 UI'ının bağlanabilmesi için eksik okuma API'lerini aç, üretim
rotasına bağlı stub compiler'ı karara bağla, device command admission'ı
dayanıklı hale getir.

Kesin kurallar:
- Var olan DTO şekillerini DEĞİŞTİRME. apps/api/src/services/phase6-input-contracts.test.ts
  üç read-model DTO'sunun anahtar kümesini sabitliyor; yenilerini de aynı
  şekilde sabitle.
- Uydurma veri döndürme. Veri yoksa boş liste + açık `partial`/`blockedReason` dön.
- Fail-closed: doğrulanamayan girdi 4xx döner, asla sessizce 200 dönmez.
- Servisleri route modülünde singleton olarak kurma; store'u constructor'dan geçir
  (phase6-prisma-stores.ts desenini izle).
- Route handler'larında `try` içinde `await` KULLAN. Awaitsiz `return` promise'i
  catch'in dışına kaçırır ve 409 yerine 500 döndürür — bu hata bir kez yapıldı.
- Her uç için apps/web/src/lib/verdict-runtime/types.ts içindeki mirror tipi
  aynı commit'te güncelle.

Bitince docs/verdict/run-playbooks/phase-5-debt/RESULT.md'yi kanıtlarla doldur ve
docs/verdict/run-playbooks/phase-5/RESULT.md §9 madde 45'i düzelt.
```

## 3. Precondition gate

| Gate | Required | Nasıl doğrulanır |
|---|---|---|
| Phase 5 RESULT | `COMPLETED` | dosya başlığı |
| PostgreSQL | erişilebilir, 18/18 migration | `prisma migrate status` |
| API + cockpit ayağa kalkıyor | evet | `preview_start` api / web |
| Domain pack persistence | çalışıyor | `GET /runtime/domain-packs` restart sonrası dolu |

## 4. Forbidden

- Mevcut `/runtime/*` uçlarının yanıt şeklini değiştirmek.
- `bridgeflow_run_runtime` gibi FK'li tabloları uygun olmayan amaçla kullanmak
  (bu hata bir kez yapıldı; `verdict_run_start` bu yüzden ayrı tablo).
- Üretim datasource URL'ini `--shadow-database-url` olarak vermek — veriyi siler.
- Evidence/target/launch verisi için örnek sabit kayıt yazmak.

## 5. Görevler

### 5D.1 — EvidenceSourceQuery API

**Şu an ne var:** `apps/api/src/services/evidence-source-resolver.ts`
- `EvidenceSourceDefinition { sourceEvent, factKey, plane, subtype, authority, deliveryLanes[], freshnessMaxAgeMs, valueField, confidence? }`
- `EvidenceSourceRegistry` / `StaticEvidenceSourceResolver` — `resolve(sourceEvent)` ile tekil çözüm yapıyor, dışarıya listeleme yok.
- Tüketiciler: `bridgeflow-durable-evidence-ingest.ts`, `evidence-journey-writer.ts`, `test-event-ws-server.ts`.

**Ne eksik:** kayıt defterini **listeleyen** bir okuma yolu ve HTTP ucu.

**Yapılacak:**
1. `EvidenceSourceResolver` arayüzüne `list(): readonly EvidenceSourceDefinition[]` ekle; her iki implementasyona uygula.
2. Route: `GET /runtime/evidence-sources`
   ```jsonc
   {
     "apiVersion": "verdict-runtime.v1",
     "partial": false,
     "items": [{
       "sourceEvent": "SCREEN_READY",
       "factKey": "ui.screen_ready",
       "plane": "UI",
       "subtype": "SCREEN_STATE",
       "authority": "PRIMARY",
       "deliveryLanes": ["ORDERED_BUS"],
       "freshnessMaxAgeMs": 5000,
       "valueField": "screenId",
       "confidence": 1
     }]
   }
   ```
3. Route: `GET /runtime/runs/:runId/evidence-sources` — o run'da **gerçekten**
   gözlenen kaynaklar + conflict durumu. Conflict yoksa `conflicts: []`; veri
   yoksa `partial: true` ve boş liste. Uydurma satır yok.
4. Web mirror: `types.ts` içine `EvidenceSourceApi` / `EvidenceSourceCatalogApi`.
5. DTO anahtar kümesini `phase6-input-contracts.test.ts` içinde sabitle.

**Kabul:** conflict/freshness/authority/lane alanları runtime'dan gelir; kayıt
yoksa UI'ın `partial` görebileceği açık bir sinyal döner.

### 5D.1b — SemanticActionQuery API

**Neden kritik:** Workflow editörünün sol paleti bugün
`apps/web/src/app/(automation-editor)/automation/[id]/workflow-registry.ts`
içinde **660 satırlık elle yazılmış sabit registry**. Girdiler hâlâ
`subtitle: "Maestro Command"` diyor. Master plan'ın hedef akışı ise paletin
Domain Pack Registry'den beslenmesi:

```text
Cockpit Workflow Editor → Domain Pack Registry → Semantic Actions / Macros
  → WorkflowIR v2 validation → BridgeFlowCompiler → Capability Requirements
```

CHECKPOINT 6 madde 2 ("operatör Maestro/YAML bilmeden workflow oluşturabiliyor")
ancak palet pack'ten beslendiğinde gerçekten sağlanır. Bugün sağlanmış
görünüyor çünkü palet var — ama içeriği Maestro dönemi sabit listesi.

**Şu an ne var:** `packages/domain-pack-contracts/src/semantic-action.ts`
```ts
SemanticActionDefinition {
  actionKey            // "nesy.action.open-stop"
  applicationRef, displayName
  businessMeaning
  notResponsibleFor: string[]      // kapsam sınırı — UI'da gösterilmeli
  screenRefs, surfaceRefs, entityTypeRefs, targetRefs: string[]
  requiredCapabilityRefs: string[] // cihaz yeteneği bağı
}
MacroDefinition { macroKey, actionRef, input, output, preconditions,
                  allowedRegistryRefs, oracleTemplate, interruptPolicy,
                  requiredCapabilityRefs, expansionSnapshot?, ... }
```
`bundle.ts` içinde `semanticActions: readonly SemanticActionDefinition[]` olarak
pack bundle'ının parçası. Doğrulayıcılar (`validateSemanticAction*`) mevcut.

**Ne eksik:** HTTP ucu. Domain Pack detay sayfası bugün yalnız **sayı**
gösteriyor (`CountView title="Semantic Actions"`), liste bile dönmüyor.

**Yapılacak:**
1. `GET /runtime/domain-packs/:packKey/:version/semantic-actions`
   ```jsonc
   {
     "apiVersion": "verdict-runtime.v1",
     "packKey": "nesy-courier", "packVersion": "1.0.0",
     "items": [{
       "actionKey": "nesy.action.open-stop",
       "displayName": "Open Stop",
       "businessMeaning": "Kuryenin durak detayını açması",
       "notResponsibleFor": ["stop tamamlama", "rota değiştirme"],
       "applicationRef": "nesy.app.courier",
       "screenRefs": ["nesy.screen.tour"],
       "surfaceRefs": ["nesy.surface.stop-list"],
       "entityTypeRefs": ["stop"],
       "targetRefs": ["nesy.target.stop-row"],
       "requiredCapabilityRefs": ["verdict.capability.semantic-action"]
     }],
     "macros": [ /* MacroDefinition özeti */ ]
   }
   ```
2. `GET /runtime/semantic-actions?packKey=&packVersion=` — palet için düz liste
   (editör tek pack'e pin'lendiği için pack-scoped uç da yeterli olabilir;
   ikisinden birini seç, ikisini birden açma).
3. **Capability gating alanı ekle.** Her action için, verilen `deviceId` bağlamında
   yeteneğin karşılanıp karşılanmadığını dönen bir alan:
   ```jsonc
   "capabilityStatus": {
     "satisfied": false,
     "missing": ["verdict.capability.semantic-action"],
     "reason": "Bridge B2 capability negotiation not available on this device"
   }
   ```
   Yetenek yoksa action **gizlenmez**, bloklu döner. Bu, mobil Faz 3 (Bridge B2
   capabilities) ve Faz 4b (Nesy App Adapter) tamamlanmadan da paletin
   çalışmasını sağlar — sadece ilgili action'lar disabled görünür.
4. Web mirror: `SemanticActionApi`, `SemanticActionCatalogApi`.
5. DTO anahtar kümesini `phase6-input-contracts.test.ts` içinde sabitle.

**Mobil bağımlılık — açıkça:** action **tanımlama, listeleme ve palete düşme**
mobil beklemez. Yalnız `performAction` ile **çalıştırma** yetenek gerektirir.
Bu ayrımı API seviyesinde `capabilityStatus` ile görünür kıl; UI'ın tahmin
etmesine bırakma.

**Kabul:** yayınlanmış pack'in semantic action'ları API'den okunabiliyor ve her
biri için yetenek durumu açık.

### 5D.2 — TargetResolutionQuery API

**Şu an ne var:** `packages/domain-pack-contracts/src/entity-target.ts`
- `TargetResolutionStrategyKind`, `TargetResolutionStrategy`, `TargetResolutionPolicy`
- `AmbiguityPolicy = FAIL | OPERATOR_ATTENTION | REQUIRE_ADDITIONAL_STRATEGY`
- `NotFoundPolicy = FAIL | OPERATOR_ATTENTION | TREAT_AS_ABSENT`
- `validateTargetResolutionPolicy(policy, path)` → `TargetResolutionViolation[]`
- `EntityDefinition`, `EntityBindingDefinition`

Yani sözleşme ve doğrulayıcı **var**; API yok.

**Yapılacak:**
1. `GET /runtime/domain-packs/:packKey/:version/target-resolution`
   — yayınlanmış pack bundle'ından provider chain'i çıkarır:
   ```jsonc
   {
     "apiVersion": "verdict-runtime.v1",
     "packKey": "nesy-courier", "packVersion": "1.0.0",
     "entities": [{
       "entityKey": "tour",
       "strategies": [
         { "order": 1, "kind": "SEMANTIC_ID", "ambiguityPolicy": "FAIL" },
         { "order": 2, "kind": "TEXT_MATCH", "ambiguityPolicy": "OPERATOR_ATTENTION" }
       ],
       "notFoundPolicy": "FAIL",
       "violations": []
     }]
   }
   ```
2. `POST /runtime/target-resolution/validate` — `validateTargetResolutionPolicy`
   çıktısını döner; ihlal varsa `422`.
3. `GET /runtime/runs/:runId/target-resolutions` — çalışan run'da hangi
   stratejinin eşleştiği, ambiguity yaşandı mı, hangi kanıtla. Veri yoksa boş.
4. Web mirror + DTO anahtar sabitleme.

**Kabul:** provider chain sırası, ambiguity politikası ve ihlaller pack'ten
türetilir; UI'ın sabit örnek göstermesine gerek kalmaz.

### 5D.3 — LaunchProfile API

**Şu an ne var:** `packages/domain-pack-contracts/src/profile.ts`
- `LaunchProfile`, `LaunchEntry`, `LaunchCleanupContract`
- `LaunchStartMode = COLD_START | WARM_START | REUSE_SESSION`
- `SessionPreparationMode = REAL_UI_LOGIN | PREPARED_SESSION | DIRECT_STATE`
- `ReleaseIsolationContract`, `FaultPlan`, `TelemetryPolicy`
- `packages/domain-pack-contracts/src/validate.ts` doğrulayıcıları

**Yapılacak:**
1. `GET /runtime/domain-packs/:packKey/:version/launch-profiles` — pack içindeki
   launch profilleri, her biri process/precondition/entry/readiness/cleanup
   alanlarıyla.
2. `POST /runtime/launch-profiles/validate` — `validate.ts` çağırır, ihlal → `422`.
3. **Güvenlik kuralı:** `DIRECT_STATE` ve scanner injection release build'de
   kapalı olmalı; API bunu `blockedReason` ile açıkça bildirmeli, sessizce
   kabul etmemeli.
4. Web mirror + DTO anahtar sabitleme.

**Kabul:** Launch Profile Builder gerçek profil okuyabilir ve doğrulama
sonucunu gösterebilir.

### 5D.4 — Stub compiler kararı

**Şu an ne var:** `/runtime/compile` → `createHashPinnedCompileStub()`
(`workflow-compile.service.ts`). Docstring'i açıkça *“Deterministic stub compile
used by local Phase 5/6 contract tests”* diyor ama üretim rotası bunu kullanıyor.
`2026-08-06`'da pinning doğrulaması eklendi (`UNPINNED_COMPILE_REQUEST` → 422),
ama pinlenmiş her girdi hâlâ koşulsuz `ok: true` dönüyor.

**Sonuç:** CHECKPOINT 6 madde 4 (“Compile error doğru canvas node'una bağlanıyor”)
hiçbir zaman gerçekten sağlanamaz — derleyici hata üretmiyor.

**Yapılacak — iki seçenekten biri, kararı RESULT'a yaz:**
- **(A) Gerçek derleyiciyi bağla.** `packages/bridgeflow-compiler` kullan;
  `WorkflowCompileService` zaten compile fonksiyonunu constructor'dan alıyor,
  yani değişiklik route katmanında. Web IR'ını compiler'ın `compile-input.ts`
  şekline dönüştüren adapter gerekir.
- **(B) Stub kalsın, açıkça işaretle.** Yanıta `compilerKind: "STUB"` ekle, UI
  bunu görünür bir uyarı olarak göstersin, madde 4 `DEFERRED_WITH_REASON` yazılsın.

Sessizce stub bırakmak seçenek değil.

### 5D.5 — DeviceCommandAdmission dayanıklılığı

**Şu an ne var:** `device-command-admission.ts` — süreç-içi `Map`. Docstring'i
“Durable device command admission facade” diyor; değil. Üretim çağıranı henüz
yok (route yalnız `snapshot` kullanıyor).

**Risk:** gerçek cihaz mutation trafiği başladığında restart veya ikinci API
instance'ı exclusive ownership'i bozar — aynı cihaza iki run yazabilir.

**Yapılacak:**
1. `VerdictResourceLease` tablosu zaten var (`verdict_resource_lease`,
   `lease_id` unique). Admission'ı bu tabloya dayalı bir lease store'a taşı.
2. Lease TTL + yenileme; süresi dolan lease serbest kalır.
3. Restart continuity testi: yeni servis instance'ı önceki sahibi görmeli
   (phase6-input-contracts.test.ts'teki “restart continuity” desenini izle).
4. Docstring'i gerçeğe uydur.

### 5D.6 — Madde 60: gerçek DUT setup mode

`BLOCKED_EXTERNAL`. `CP3-DUT` kapanmadan yapılamaz — `phase-3-debt/` ve
`phase-4-debt/` ile birlikte izlenir. Bu playbook kapsamında **yapılmayacak**,
yalnız durumu taşınacak.

## 6. Verification

```bash
pnpm verdict:verify-master-plan
pnpm typecheck
pnpm --filter @nesy/api test
pnpm --filter @nesy/web test
pnpm --filter @nesy/web exec next build
```

Runtime doğrulama (API + cockpit ayakta):

```bash
curl -s localhost:4001/api/verdict/runtime/evidence-sources | jq
curl -s localhost:4001/api/verdict/runtime/domain-packs/nesy-courier/2.0.0/semantic-actions | jq
curl -s localhost:4001/api/verdict/runtime/domain-packs/nesy-courier/2.0.0/target-resolution | jq
curl -s localhost:4001/api/verdict/runtime/domain-packs/nesy-courier/2.0.0/launch-profiles | jq
```

Her uç için ayrıca **fail-closed** kanıtı gerekir: olmayan pack → `404`,
geçersiz policy → `422`.

## 7. Acceptance checklist

| # | Madde | Kanıt |
|---|---|---|
| 1 | `GET /runtime/evidence-sources` listeliyor | HTTP gövdesi |
| 2 | Run-scoped evidence sources conflict/freshness taşıyor | HTTP gövdesi |
| 2b | Semantic action listesi pack'ten dönüyor | HTTP gövdesi |
| 2c | Her action `capabilityStatus` taşıyor, eksik yetenek bloklu görünüyor | HTTP gövdesi |
| 2d | `notResponsibleFor` alanı yanıtta var (kapsam sınırı UI'da gösterilecek) | HTTP gövdesi |
| 3 | Target resolution provider chain pack'ten türüyor | HTTP gövdesi |
| 4 | Target resolution validate ihlalde 422 | HTTP kodu |
| 5 | Launch profile listesi beş alanı taşıyor | HTTP gövdesi |
| 6 | Launch profile validate ihlalde 422 | HTTP kodu |
| 7 | `DIRECT_STATE` release'de fail-closed | HTTP gövdesi `blockedReason` |
| 8 | Compile stub kararı verildi ve uygulandı | RESULT §karar |
| 9 | Admission DB lease'e taşındı, restart testi geçiyor | test adı |
| 10 | Üç yeni DTO anahtar kümesi sabitlendi | test adı |
| 11 | Web mirror tipleri güncel | typecheck + test |
| 12 | Phase 5 RESULT §9 madde 45 düzeltildi | diff |

## 8. Handoff

Bu playbook kapandığında `phase-6-debt/` başlayabilir. Kapanış hedefi:

```text
Phase 5 DEBT: COMPLETED
phase6DebtReadiness: READY
Reason: Evidence Source / Target Resolution / Launch Profile read APIs available;
compiler decision recorded; admission durable.
```
