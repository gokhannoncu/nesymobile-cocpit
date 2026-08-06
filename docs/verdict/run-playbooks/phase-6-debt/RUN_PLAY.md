# Phase 6 DEBT RUN_PLAY — Unbound Editor Panels, Missing Surface Registry, Unfinished CHECKPOINT Sweep

```yaml
runPlayId: verdict-cockpit-phase-6-debt-run-play
debtOf: "6"
phaseName: "Phase 6 carried debt: UI shells that were recorded as DONE"
createdAt: "2026-08-06 09:30:00 +03"
timezone: "Europe/Istanbul"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:76024d898cb152fe4d885fb18e798cb24b6c3df31715eac546c64383ed5c2bd0"
originalRunPlay: "docs/verdict/run-playbooks/phase-6/RUN_PLAY.md"
originalResult: "docs/verdict/run-playbooks/phase-6/RESULT.md"
dependsOn: "docs/verdict/run-playbooks/phase-5-debt/RUN_PLAY.md"
priority: P1
```

## 1. Why this debt exists

Phase 6 §5 records steps 6.10, 6.11 and 6.12 as `DONE`. They are not. The
components were written, typechecked and unit-tested, but:

- `VerdictEditorToolbar` was **mounted on no route** until `2026-08-06` — the
  entire authoring surface was unreachable in the running app.
- After mounting, five of its panels turned out to be **static mockups**:
  `EvidenceSourceRegistry`, `TargetResolutionPanel`, `LaunchProfileBuilder`,
  `EntityBindingEditor`, `SemanticActionPalette` contain zero calls to
  `verdict-runtime/client`; each renders a hardcoded array.
- The Application/Screen/Surface Registry manager (CHECKPOINT items 20–21) was
  never built at all.
- CHECKPOINT 6 has 85 acceptance items; roughly 28 have still not been walked.

Phase 6's own precondition gate (§3) lists ten APIs and does **not** include
EvidenceSourceQuery, TargetResolutionQuery or LaunchProfileApi — so the gate
never noticed they were missing and no `BLOCKED_PRECONDITION` was raised.

## 2. AI agent starting prompt

```text
Verdict Cockpit Phase 6 DEBT'i uygula.

Önce şu dosyaları tamamen oku:
docs/verdict/run-playbooks/phase-6-debt/RUN_PLAY.md
docs/verdict/run-playbooks/phase-6-debt/RESULT.md
docs/verdict/run-playbooks/phase-6/RESULT.md    (§18 ve §19'daki bulgular)
docs/verdict/run-playbooks/phase-5-debt/RESULT.md

BAŞLAMADAN ÖNCE phase-5-debt gate'ini doğrula:
phase-5-debt/RESULT.md içinde resultState: COMPLETED yoksa BAŞLAMA.
Sadece phase-6-debt/RESULT.md'ye BLOCKED_PRECONDITION yaz ve dur.
Sebep: 6D.1'in bağlanacağı API'ler phase-5-debt'te açılıyor.

Görev: maket panelleri gerçek runtime'a bağla, Surface Registry'yi yaz,
CHECKPOINT 6'nın kalan maddelerini cockpit üzerinde yürüt, 6.30'u kapat.

Kesin kurallar:
- SABİT VERİ YASAK. Bir sayfa VERDICT_RUNTIME kaynağı ilan ediyorsa gerçekten
  client'ı çağıracak. src/test/page-acceptance.test.ts bunu zorluyor.
- Boş liste ile hata ayrı gösterilecek. Fetch hatasını boş tabloya çevirmek yasak.
- Kanıtsız PASS yazma. Her CHECKPOINT maddesi için ekran görüntüsü, HTTP yanıtı
  veya test adı ver. Yürütülemeyen madde BLOCKED_EXTERNAL veya FAIL yazılır.
- İki sayfa aynı route'a çözülmeyecek — next build bunu reddeder ve bir kez
  reddetti. src/test/route-non-regression.test.ts guard'ı var.
- Yeni rota eklersen page-migration-manifest.ts'e ekle ve acceptanceTestRef ver.
- Gerçek cihaz bağlı olabilir (SM-A346E). Ama ro.build.type=user olduğu için
  CP3 mutation acceptance YAPILAMAZ; o maddeleri BLOCKED_EXTERNAL yaz.

Bitince phase-6/RESULT.md §5'teki 6.10/6.11/6.12 satırlarını gerçeğe göre düzelt.
```

## 3. Precondition gate

| Gate | Required | Nasıl doğrulanır |
|---|---|---|
| `phase-5-debt` | `COMPLETED` | RESULT başlığı |
| Evidence Source API | available | `GET /runtime/evidence-sources` → 200 |
| Target Resolution API | available | pack-scoped uç → 200 |
| Launch Profile API | available | pack-scoped uç → 200 |
| `next build` | yeşil | build çıktısı |
| Seed'li runtime | dolu | domain pack + profil + kampanya persist |

Bu koşullar yoksa `BLOCKED_PRECONDITION` yaz ve dur.

## 4. Forbidden

- Maket veriyi “şimdilik” bırakıp maddeyi `PASS` yazmak.
- Erişilemeyen bir komponenti “yazıldı” diye `DONE` işaretlemek.
- Fetch hatasını boş listeye çevirmek.
- Route çakışması yaratmak.
- Manifest'e `acceptanceTestRef` olmadan rota eklemek.

## 5. Görevler

### 6D.1 — Editör panellerini runtime'a bağla

Beşinin de bugünkü hali: `useState` içinde sabit dizi, sıfır API çağrısı.

#### 6D.1a `EvidenceSourceRegistry.tsx`
- **Şu an:** `{ id:1, name:'Main Activity Screen', kind:'SCREEN_STATE', authority:'PRIMARY', lane:'Ordered Bus' }` ve `{ id:2, name:'API Responses', ... }` sabit.
- **Olması gereken:** `fetchVerdictEvidenceSources()` ile katalog; her satırda
  `sourceEvent`, `factKey`, `plane`, `subtype`, `authority`, `deliveryLanes[]`,
  `freshnessMaxAgeMs`. Run bağlamı varsa run-scoped uçtan conflict durumu.
- **Durumlar:** yükleniyor / boş (“no evidence source registered”) / hata
  (“registry unavailable”) — üçü ayrı.
- **CHECKPOINT:** 22, 23.

#### 6D.1b `TargetResolutionPanel.tsx`
- **Olması gereken:** seçili pack'in provider chain'i, strateji sırası,
  `ambiguityPolicy`, `notFoundPolicy`, `validateTargetResolutionPolicy`
  ihlalleri. Ambiguity varsa açık uyarı; ilgili aksiyon **disabled**.
- **CHECKPOINT:** 24, 51.

#### 6D.1c `LaunchProfileBuilder.tsx`
- **Şu an:** App Package / Activity / Readiness / Deep Link / Cleanup alanları
  var ama hiçbir şeye bağlı değil, kaydetmiyor.
- **Olması gereken:** pack'ten launch profilleri oku; düzenlenen profili
  `POST /runtime/launch-profiles/validate` ile doğrula; ihlalleri alan bazında
  göster. `DIRECT_STATE` release'de seçilemez olmalı.
- **CHECKPOINT:** 25.

#### 6D.1d `EntityBindingEditor.tsx`
- **Olması gereken:** `EntityDefinition` / `EntityBindingDefinition` üzerinden
  gerçek entity listesi ve binding kanıtı.
- **CHECKPOINT:** 24 (entity binding evidence kısmı).

#### 6D.1e `SemanticActionPalette.tsx`
- **Olması gereken:** semantik aksiyonlar yayınlanmış domain pack bundle'ından
  gelmeli; pack yoksa palet boş + açık gerekçe.
- **CHECKPOINT:** 2.

### 6D.2 — Application / Screen / Surface Registry manager (yeni sayfa)

Hiç yok. Sıfırdan yazılacak.

- **Route:** `/automation/domain-packs/[packId]/surfaces` (pack detayının bir
  sekmesi olarak da bağlanabilir — ikinci paralel route açma).
- **Liste:** application → screen → surface hiyerarşisi.
- **Surface alanları (editlenebilir):** parent screen, `kind`, detection
  stratejisi, readiness politikası, default policy.
- **Kaydetme:** yayınlanmış pack **immutable** — düzenleme yalnız `DRAFT`
  sürümde mümkün; `PUBLISHED` üzerinde alanlar salt-okunur ve gerekçe görünür.
- **Manifest:** yeni rotayı `page-migration-manifest.ts`'e ekle,
  `acceptanceTestRef` ver, navigasyona bağla (yedi workspace kuralı bozulmayacak).
- **CHECKPOINT:** 20, 21.

### 6D.3 — Kalan CHECKPOINT taraması

Yürütülmemiş maddeler:

```text
33, 34, 36, 37, 38, 39, 44, 50, 51, 52, 53, 54, 57, 58,
61, 62, 63, 64, 65, 67, 69, 71, 72, 73, 75, 77, 79, 80, 81, 83
```

Sınıflandırma ve kanıt biçimi:

| Grup | Maddeler | Kanıt |
|---|---|---|
| DTO cutover | 33, 34, 36, 37, 38, 39, 44 | network isteği + render edilen gerçek kayıt |
| Run Detail sunumu | 57, 58, 61–65 | ekran görüntüsü; applicability state'leri ayrı |
| Evidence Journey | 67, 69 | RBAC deep-link davranışı + raw→normalized trace |
| Interaction origin | 71, 72, 73 | seed'li interaction ile origin/confidence |
| Repro | 75, 77 | export içeriği; Act Mode otomatik açılmıyor |
| Sayfa kabulü | 79, 80, 81 | loading/empty/error/disconnected/blocked, RBAC, klavye/odak |
| Inspector / cihaz | 50, 52, 53, 54 | gerçek cihaz (SM-A346E) üzerinde |
| Placeholder raporu | 83 | BACKLOG listesi |

**Cihaz notu:** bağlı cihaz `ro.build.type=user`. Ekran durumu, overlay ve
interaction gözlemi yapılabilir; **mutation/Act Mode acceptance yapılamaz** →
ilgili maddeler `BLOCKED_EXTERNAL` (`CP3-DUT`).

### 6D.4 — 6.30 kapanışı

1. 85 maddenin tamamını verdict + kanıt ile `phase-6/RESULT.md` §9'a yaz.
2. `phase-6/RESULT.md` §5'te 6.10 / 6.11 / 6.12 satırlarını düzelt.
3. `checkpoint6` değerini kanıta göre belirle:
   - FAIL yoksa ve yalnız cihaz maddeleri açıksa →
     `PASSED_WITH_EXTERNAL_DUT_BLOCKERS`
   - FAIL varsa → `NOT_PASSED` + eksik listesi. Uydurma kapanış yasak.
4. `phase7Readiness` değerlendir.

## 6. Verification

```bash
pnpm typecheck
pnpm --filter @nesy/web test
pnpm --filter @nesy/api test
pnpm --filter @nesy/web exec next build
```

Runtime:
- 63+ rota direct-entry matrisi (yeni Surface rotası dahil)
- her düzeltilen panel için network isteği kanıtı
- konsol hatası yok

## 7. Acceptance checklist

| # | Madde | Kanıt |
|---|---|---|
| 1 | Evidence Source paneli runtime'dan besleniyor | network + ekran |
| 2 | Target Resolution provider chain gerçek | network + ekran |
| 3 | Ambiguity'de aksiyon disabled | ekran |
| 4 | Launch Profile doğrulama ihlali alan bazında gösteriliyor | ekran |
| 5 | `DIRECT_STATE` release'de seçilemiyor | ekran |
| 6 | Entity binding gerçek entity listesi | network |
| 7 | Semantic palette pack'ten geliyor | network |
| 8 | Surface Registry rotası açılıyor | HTTP 200 + ekran |
| 9 | Published pack'te surface alanları salt-okunur | ekran |
| 10 | Yeni rota manifest + nav + acceptanceTestRef | test |
| 11 | Kalan 30 madde verdict + kanıtla yazıldı | RESULT §9 |
| 12 | 6.10/6.11/6.12 satırları düzeltildi | diff |
| 13 | `checkpoint6` kanıta göre belirlendi | RESULT |
| 14 | Route çakışması yok, build yeşil | build |

## 8. Handoff

```text
Phase 6 DEBT: COMPLETED
CHECKPOINT 6: <kanıta göre>
phase7Readiness: <değerlendirildi>
```
