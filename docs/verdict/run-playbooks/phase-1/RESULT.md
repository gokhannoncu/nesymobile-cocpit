# Phase 1 RESULT — CP0 Blocker Cleanup ve CI Gate

```yaml
runPlayId: verdict-cockpit-phase-1-run-play
phase: 1
phaseName: "CP0 Blocker Cleanup ve CI Gate"
resultState: COMPLETED
createdAt: "2026-08-04 22:35:52 +03"
startedAt: "2026-08-04 22:38:00 +03"
completedAt: "2026-08-04 22:49:07 +03"
lastUpdatedAt: "2026-08-04 22:49:07 +03"
masterPlanVersion: "v1.1.2"
masterPlanDigest: "sha256:5e7deff018a61b71eb215d2406615dae3304fb63080005e1130297401f15fa01"
phase2Readiness: READY_WITH_BLOCKERS
```

## 1. Executive result

Phase 0'ın dört blocker'ından **üçü tam kapandı**, biri **CI'a bağlandı ama bu
makinede doğrulanamadı**.

- **B-1 `CLOSED`** — `@nesy/api` 15 TS hatası → **0**. Phase 0'ın tahmini
  doğrulandı: C-1 (rootDir) düzeltilince C-2 (çift nominal `Secret`) kendiliğinden
  düştü. Beş hata tek bir import düzeltmesiyle gitti.
- **B-2 `CLOSED`** — `@nesy/web` 2 TS hatası → **0**.
- **B-3 `CLOSED`** — `.github/workflows/cockpit-ci.yml` eklendi; typecheck + test
  bloklayıcı gate olarak koşuyor. Lint bilinçli olarak **non-blocking**; gerekçesi
  aşağıda ve workflow dosyasının içinde yazılı (yeni blocker **B-8**).
- **B-4 `IMPLEMENTED_UNVERIFIED`** — `postgres:16` service'li integration job
  yazıldı. Bu makinede **doğrulanamadı**: Docker kapalı ve erişilebilir tek
  `DATABASE_URL` paylaşımlı bir **uzak production-benzeri DB**
  (`46.225.55.110:5432/aras_db`). Yazma yapan 26 integration testini o veritabanına
  karşı koşmak kabul edilemez olduğu için koşulmadı. İlk CI çalışmasında
  doğrulanmalı.

Repo-level `pnpm typecheck` artık **yeşil** (7/7 task). Test suite Phase 0 ile
**birebir aynı**: 273 passed / 27 skipped — typecheck düzeltmeleri hiçbir testi
kırmadı.

Kapsam dışı bırakılanlara dokunulmadı: SDK mutual-HMAC, durable event runtime,
Bridge host client, WorkflowIR v2, Domain Pack, Maestro/YAML söküm, dependency
upgrade. `as any` kullanılmadı, `rootDir` genişletilmedi, hiçbir test gevşetilmedi
veya silinmedi.

## 2. Current recovery state

| Alan | Değer |
|---|---|
| Current phase | `1` |
| Current step | `1.11` (bitti) |
| Result state | `COMPLETED` |
| Last successful step | `1.11` |
| Last attempted step | `1.11` |
| Recovery instruction | `Phase 1 kapandı. Sıradaki iş Phase 2 RUN_PLAY oluşturmak. Phase 2'ye girmeden önce ilk CI koşusunda integration job'ın gerçekten yeşil olduğu (B-4) doğrulanmalı.` |

## 3. Phase 0 blocker carry-over

| ID | Giriş | Çıkış | Kanıt |
|---|---|---|---|
| B-1 | `OPEN` | `CLOSED` | §6 — `pnpm --filter @nesy/api typecheck` yeşil |
| B-2 | `OPEN` | `CLOSED` | §7 — `pnpm --filter @nesy/web typecheck` yeşil |
| B-3 | `OPEN` | `CLOSED` | §8 — `cockpit-ci.yml` `quality` job'ı |
| B-4 | `OPEN` | `IMPLEMENTED_UNVERIFIED` | §9 — `integration` job'ı yazıldı, lokalde koşulamadı |
| B-5 | `OPTIONAL` | `DEFERRED_TO_PHASE_1B` | §12 |
| B-6 | `DEFERRED` | `DEFERRED` | Phase 1 kapsamına alınmadı |
| B-7 | `DEFERRED` | `DEFERRED` | Phase 2+ |
| **B-8** | — | **`NEW / OPEN`** | §8.1 — `@nesy/db` + `@nesy/metronic` ESLint v9 flat config yok |

## 4. Commands executed

| Command | Result | Evidence / Notes |
|---|---|---|
| `pnpm verdict:verify-master-plan` | `PASS` (×2, başta ve sonda) | `Master plan digest OK: sha256:5e7deff0…f15fa01` — değişmedi |
| `git status --short` | `PASS` | Başlangıç: tek satır `?? docs/verdict/run-playbooks/phase-1/` |
| `git branch --show-current` | `PASS` | `production` |
| `git rev-parse --show-toplevel` | `PASS` | `…/NesyMobileCocpit` |
| `pnpm --filter @nesy/api typecheck` | `FAIL → PASS` | 15 hata → 10 → 4 → **0** |
| `pnpm --filter @nesy/web typecheck` | `FAIL → PASS` | 2 hata → **0** |
| `pnpm typecheck` | `PASS` | `Tasks: 7 successful, 7 total` |
| `pnpm test` | `PASS` | 8/8 turbo task; **273 passed / 27 skipped** |
| `pnpm lint` | `FAIL` | 2 paket exit 2 (`@nesy/db`, `@nesy/metronic`); 4 paket exit 129 (turbo interrupt) — §8.1 |
| `pnpm --filter @nesy/api lint` | `PASS` | 88 problem, **0 error** (hepsi warning) |
| `pnpm --filter @nesy/web lint` | `PASS` | yalnız warning |
| `node -e "import('@nesy/control-channels')…"` | `PASS` | Üç entrypoint de runtime'da çözülüyor, §6.2 |
| `python3 -c "yaml.safe_load(cockpit-ci.yml)"` | `PASS` | `jobs: quality, lint, integration` |
| `git diff --check` | `PASS` | temiz |

## 5. Changed files

Hepsi Phase 1 owned paths içinde. Owned paths dışına **çıkılmadı** —
`packages/control-channels/*` ve `packages/control-contract/*` (RUN_PLAY §5'in
koşullu izin verdiği alan) **değiştirilmedi**, çünkü import path düzeltmesi yetti.

| File | Change | Reason |
|---|---|---|
| `apps/api/src/checkpoint4-device-gate.ts` | edit (3 import) | C-1 — relative `packages/*/src/*` → workspace entrypoint |
| `apps/api/src/checkpoint4-recovery-security.ts` | edit (3 import) | C-1 + C-2 |
| `apps/api/src/checkpoint4-unauth-peer.ts` | edit (3 import + narrowing) | C-1 + C-2 + C-3 |
| `apps/api/src/cp2-fanout.ts` | edit | C-3 — argv guard + guarded pairwise scan |
| `apps/api/src/cp2-gapwatermark.ts` | edit | C-3 — guarded pairwise scan |
| `apps/api/src/cp2-ws-host.ts` | edit | C-3 — guarded pairwise scan |
| `apps/web/src/lib/debug-view/filter-interactions.test.ts` | edit | B-2 — `sampleAt()` fixture accessor |
| `.github/workflows/cockpit-ci.yml` | **new** | B-3 + B-4 |
| `docs/verdict/run-playbooks/phase-1/RESULT.md` | update | bu dosya |
| `docs/verdict/run-playbooks/phase-1/RUN_PLAY.md` | update | recovery state + status |

## 6. B-1 API typecheck result

`CLOSED` — 15 → 0.

### 6.1 C-1 + C-2: tek kök neden, tek düzeltme

Üç `checkpoint4-*.ts` dosyası paketleri **kaynak dosyadan, relative path ile**
import ediyordu:

```ts
// önce
import { VerdictChannel } from "../../../packages/control-channels/src/index.js";
import { createNodeAdbRunner } from "../../../packages/control-channels/src/node-executor.js";
import { asSecret } from "../../../packages/control-contract/src/index.js";

// sonra
import { VerdictChannel } from "@nesy/control-channels";
import { createNodeAdbRunner } from "@nesy/control-channels/node";
import { asSecret } from "@nesy/control-contract";
```

Bu tek değişiklik iki hata sınıfını birden kapattı:

- **C-1 / `TS6059` ×3** — `packages/*/src/*` artık `apps/api` programına
  girmiyor, yani `rootDir` ihlali ortadan kalktı. `rootDir` **genişletilmedi**.
- **C-2 / `TS2322` ×2** — `Secret` brand'i artık tek bir declaration'dan
  (`dist/index.d.ts`) geliyor. `src` ↔ `dist` çift `unique symbol` karışımı
  yapısal olarak imkânsız hale geldi.

Phase 0'ın "C-2 büyük olasılıkla C-1'in türevidir ve kendiliğinden düşer"
tahmini **doğrulandı**. `@nesy/api` zaten her iki paketi de `workspace:*`
dependency olarak tutuyordu; kullanılan entrypoint'ler `package.json`
`exports` alanında tanımlı.

### 6.2 Runtime doğrulaması

Import değişikliği derleme dışında bir şeyi bozmadığını göstermek için üç
entrypoint `apps/api` içinden gerçekten yüklendi:

```text
control-channels: VerdictChannel, channelFor, detectChannel, invalidateDetectedChannel,
                  parseBroadcastPayload, parseResultCode, parseVerdictPendingResult, previewCommand
node-executor:    createControlExecutor, createNodeAdbRunner, resolveAdbPath
control-contract: EVENT_ALIAS, NO_SECRET, asSecret, newRequestId, redact, resolveEventName
```

Spike'ların ithal ettiği üç sembolün (`VerdictChannel`, `createNodeAdbRunner`,
`asSecret`) hepsi mevcut.

⚠️ **Davranış notu:** spike'lar artık paket **kaynağını** değil `dist`'ini
kullanıyor. Bu, çift nominal tipi kaldıran şeyin ta kendisi, ama şu bedeli
getiriyor: `checkpoint4-*` script'lerini çalıştırmadan önce paketler **build
edilmiş olmalı**. `dist/` şu an mevcut ve günceldir. Paket kaynağını
değiştirdikten sonra spike koşacak biri önce şunu çalıştırmalı:

```bash
pnpm --filter @nesy/control-channels build
```

### 6.3 C-3: strict index/narrowing

`noUncheckedIndexedAccess` altındaki 10 hata. Hiçbirinde `!` non-null assertion
kullanılmadı; hepsi explicit guard.

| Dosya | Hata | Düzeltme |
|---|---|---|
| `cp2-fanout.ts:14` | `TS2345` argv `string \| undefined` | Kullanım öncesi `undefined` kontrolü + usage mesajıyla `process.exit(1)`. Runtime davranışı iyileşti: eksik argümanla artık anlaşılmaz bir Prisma hatası yerine net bir mesaj veriyor. |
| `cp2-fanout.ts:19`, `cp2-gapwatermark.ts:44` | `TS2532` ×4 | `seen[i] <= seen[i-1]` tek satır taraması, `prev`/`cur` local const + guard'lı bloğa açıldı |
| `cp2-ws-host.ts:108` | `TS2532` | aynı desen (`seqs[i] !== seqs[i-1] + 1`) |
| `checkpoint4-unauth-peer.ts:170,173` | `TS2339` ×4 (`never`) | Aşağıya bakın |

`never` hatası bir CFA tuzağıydı: `helloIdentity` doğru tiplenmişti
(`{ runId; sessionId } | null`) ama **yalnız socket callback'i içinde** atanıyor,
bu yüzden TS top-level okumada onu initializer'a — `null`'a — daraltıyor;
`identity === null ? … : identity` dalında geriye `never` kalıyordu.

Sadece annotation eklemek **yetmedi** (`const identity: T | null = helloIdentity`
hâlâ `null`'a daraldı, koşuldu ve doğrulandı). Çözüm: okumayı bir fonksiyon
üzerinden yapmak, böylece CFA declared type'ı kullanıyor:

```ts
const readHelloIdentity = (): HelloIdentity | null => helloIdentity;
const identity = readHelloIdentity();
```

Test semantiği korundu: `forgedAckAccepted` hâlâ tam olarak aynı iki koşulu
değerlendiriyor.

## 7. B-2 Web typecheck result

`CLOSED` — 2 → 0.

`filter-interactions.test.ts:127` `[sample[2], sample[0]]`'i tipli bir `events`
parametresine veriyordu; `noUncheckedIndexedAccess` altında bunlar
`InteractionEvent | undefined`.

Test intent'i korundu (belirli fixture'ları belirli sırada vermek). `as any`
veya assertion kullanılmadı; bunun yerine sesli patlayan bir accessor:

```ts
function sampleAt(index: number): InteractionEvent {
  const event = sample[index]
  if (!event) throw new Error(`sample fixture missing at index ${index}`)
  return event
}
```

Bu tipi susturmaktan **daha güçlü**: fixture dizisi ileride kısalırsa test
sessizce `undefined` geçirmek yerine net bir mesajla düşer. Test hâlâ geçiyor
(web 129/129).

`sample[…]`'in `toEqual(...)` içinde geçtiği satırlar (120) dokunulmadan
bırakıldı — `toEqual` `unknown` aldığı için orada hata yoktu ve gereksiz
değişiklik yapılmadı.

## 8. B-3 CI gate result

`CLOSED` — `.github/workflows/cockpit-ci.yml` eklendi.

Üç ayrı job, ki yeşil tik'in ne anlama geldiği belirsiz kalmasın:

| Job | Kapsam | Blocking |
|---|---|---|
| `quality` | `pnpm install --frozen-lockfile` → `pnpm typecheck` → `pnpm test` | **Evet** |
| `lint` | `pnpm lint` | **Hayır** — §8.1 |
| `integration` | PostgreSQL 16 + migrations + ingest suite | **Evet** — §9 |

Uygunluk: Node 20 (`engines: >=20.0.0`), `pnpm/action-setup@v4` version 9
(`packageManager: pnpm@9.15.4` ile uyumlu). Secret veya production credential
yazılmadı. `contract-fixtures.yml` **değiştirilmedi**; yeni workflow ayrı dosya,
ayrı `name:`, çakışma yok.

Typecheck ve test **ayrı step**: Phase 0 `pnpm typecheck` koşusunda `@nesy/web`'in
exit 129 ile düştüğünü ve bunun web'in kendi hatası olmadığını (turbo, api hatası
üzerine task'ı kesmiş) tespit etmişti. Tek step'te birleştirmek aynı yanıltıcı
sinyali CI'a taşırdı.

### 8.1 B-8 — lint neden non-blocking (YENİ BLOCKER)

`pnpm lint` şu an repo genelinde **kırmızı**, ama sebebi lint bulguları değil:

- `@nesy/db` ve `@nesy/metronic` paketlerinde **`eslint.config.js` yok**.
  ESLint v9 flat config bekliyor, bu iki paket hâlâ `.eslintrc` düzenindeymiş
  gibi davranıyor → eslint tek dosya bile lint etmeden **exit 2**.
- Diğer altı paket, `@nesy/api` ve `@nesy/web` **geçiyor** (yalnız warning:
  api 88 problem / 0 error).
- Turbo raporundaki diğer dört exit 129, bu iki gerçek hata üzerine gelen
  **interrupt** — ayrı arıza değil.

Bu iki paketi flat config'e taşımak Phase 1'in **read-only** tuttuğu paketleri
düzenlemek demek ve `pnpm lint`'i yeşile almak Phase 1 acceptance'ında yok. Bu
yüzden gizlenmedi, **B-8 olarak ayrı blocker'a çevrildi** ve job
`continue-on-error: true` ile eklendi.

Gerekçe workflow dosyasının içine de yazıldı: bloklayıcı bir lint job'ı, PR ile
ilgisi olmayan bir sebeple PR'ların **%100'ünü** kırardı — bu da bir gate'i
işlevsizleştirmenin en hızlı yolu. `continue-on-error` o iki config eklendiği
anda `false` yapılmalı; dosyada bu talimat açıkça duruyor.

## 9. B-4 PostgreSQL integration result

`IMPLEMENTED_UNVERIFIED`

Job yazıldı ve şunları içeriyor:

| Gereklilik | Durum |
|---|---|
| `postgres:16` service | ✅ |
| Healthcheck (`pg_isready`, 10s/5s/5) | ✅ |
| `DATABASE_URL` (ephemeral container) | ✅ |
| `VERDICT_DB_IT=1` | ✅ |
| Prisma client build (`prisma generate` via `prebuild`) | ✅ |
| `prisma migrate deploy` (10 committed migration) | ✅ — `migrate dev` **değil** |
| Unit testlerle karışmama | ✅ — ayrı job |

Ek olarak bir **fail-closed guard** konuldu. Bu job'ın var olma sebebi tam da
testlerin hiçbir yerde koşmuyor olmasıydı; env gate yanlış kurulursa suite'ler
yine `skip` eder ve job **yeşil** görünürdü — yani "integration doğrulandı"
diyen sahte bir tik. Guard, çıktıda skipped test görürse job'ı düşürüyor.

### 9.1 Neden lokalde doğrulanamadı

Dürüst olmak gerekirse bu job **bu makinede koşturulmadı**:

- `docker info` → **unavailable**. Lokal `postgres:16` service container'ı
  ayağa kaldırmak mümkün değil.
- Erişilebilir tek `DATABASE_URL` **paylaşımlı uzak bir veritabanı**
  (`postgresql://…@46.225.55.110:5432/aras_db`). Söz konusu 26 test ingest
  yazma testi ve `prisma migrate deploy` şema uygular. Bunu paylaşımlı/uzak bir
  DB'ye karşı koşmak kapsam dışı ve geri alınamaz bir eylem olurdu — bilinçli
  olarak yapılmadı.

**Kalan risk:** job'ın syntax'ı ve mantığı doğrulandı (YAML parse edildi, 7 step,
migration klasörü ve script isimleri repo'ya karşı kontrol edildi), ama uçtan uca
yeşil olduğu **görülmedi**. İlk CI koşusu bu job'ı özellikle izlemeli. En olası
ilk-koşu sürprizleri: `test-event-ws-server.integration.test.ts` port bind
davranışı (Phase 0 `health.routes.test.ts` / `nesy-env.routes.test.ts` için port
çakışması riski notu düşmüştü) ve vitest'in birden çok dosya filtresini kabul
etme biçimi.

## 10. Repo-level typecheck result

`GREEN`

```text
Tasks:    7 successful, 7 total
Cached:   5 cached, 7 total
```

Phase 0'da bu koşu `@nesy/api` exit 2 + `@nesy/web` exit 129 ile kırmızıydı.
Yeni blocker çıkmadı.

## 11. Test regression result

`GREEN — Phase 0 ile birebir aynı`

| Paket | Test files | Tests | Skipped |
|---|---|---|---|
| `@nesy/api` | 22 passed / 2 skipped (24) | 144 passed | 27 |
| `@nesy/web` | 29 passed (29) | 129 passed | 0 |
| **Toplam** | 51 passed / 2 skipped | **273 passed** | **27** |

Skipped sayısı **değişmedi** ve bu beklenen: 27 skip'in tamamı env-gated
(`VERDICT_DB_IT` + `DATABASE_URL`) ve Phase 1 lokal env'i değiştirmedi. Bu
sayının düşmesi ilk CI `integration` koşusunda görülmeli — orada 26'sı (16 ingest
+ 10 ws-server) koşacak.

Typecheck düzeltmeleri hiçbir testi kırmadı; `filter-interactions.test.ts` dahil
web suite'i tam yeşil.

## 12. Deferred work

| İş | Durum | Gerekçe | Hedef |
|---|---|---|---|
| **B-5** contract job `workflow_call` migration | `DEFERRED_TO_PHASE_1B` | Nötr `verdict-contract-fixtures` repo'sunda workflow yazmayı ve iki tüketici repo'yu birlikte değiştirmeyi gerektirir — bu repo'nun dışına çıkar. Mevcut gap zaten `contract-fixtures.yml` içinde açıkça belgeli; RUN_PLAY 1.9 bunu opsiyonel tutuyor. Dosyaya gereksiz kozmetik düzeltme yapılmadı. | Phase 1B |
| **B-5** `PEER_LOCK_TOKEN` permission drift | `DEFERRED_TO_PHASE_1B` | Düzeltilmesi gereken master plan Bölüm G tablosu; master plan digest'e dokunmak Phase 1 kapsamı dışı ve `verify-master-plan` gate'ini kırar. Gap `contract-fixtures.yml:46-49`'da yazılı. | Phase 1B / plan revizyonu |
| **B-6** performans baseline script'leri | `DEFERRED` | Phase 1 acceptance'ında yok | Phase 2 |
| **B-7** golden workflow/evidence fixture | `DEFERRED` | Contract işi | Phase 2+ |
| **B-8** `@nesy/db` + `@nesy/metronic` flat config | `OPEN` | Read-only paketler; §8.1 | Phase 1B |
| `CapturePolicyEngine.test.ts` skip kaynağı | `RESOLVED` | Phase 0'ın "2. skipped file adayı" belirsizliği çözüldü: iki skipped dosya `verdict-ingest.integration.test.ts` (16) ve `test-event-ws-server.integration.test.ts` (10); `CapturePolicyEngine` skip içermiyor. Kalan 1 skip `test-event-compat-gate.test.ts`. | — |

## 13. Blockers

| ID | Severity | Blocker | Kanıt | Owner | Faz |
|---|---|---|---|---|---|
| **B-4** | MEDIUM | PostgreSQL integration job'ı yazıldı ama hiç koşmadı. Lokalde Docker yok, tek DB uzak/paylaşımlı. İlk CI koşusuna kadar "integration kanıtlandı" denemez. | §9.1 | API owner | Phase 2 girişinde doğrula |
| **B-8** | MEDIUM | `pnpm lint` iki pakette flat config eksikliğinden exit 2; lint gate bu yüzden non-blocking. | §8.1 | Platform/CI owner | Phase 1B |
| **B-5** | LOW | contract job elle tutulan kopya; `PEER_LOCK_TOKEN` permission drift'i plan tablosunda duruyor. | §12 | Platform/CI owner | Phase 1B |
| **B-6** | LOW | Performans baseline script'i yok. | Phase 0 §12 | Platform owner | Phase 2 |
| **B-7** | LOW | Golden workflow/evidence fixture yok. | Phase 0 §11.1 | Contract owner | Phase 2+ |

Phase 1'i `FAILED` yapan blocker yok. B-1/B-2/B-3 kanıtla kapandı; B-4 kod
olarak tamam, doğrulaması CI'a bağlı.

## 14. Phase 2 readiness decision

`READY_WITH_BLOCKERS`

**Hazır olan taraf.** Phase 1'in asıl amacı — sonraki fazların üstünde
çalışabileceği güvenilir bir sinyal zemini — sağlandı. `pnpm typecheck` yeşil,
`pnpm test` yeşil, ve ikisini de yakalayan bloklayıcı bir CI gate'i artık var.
Phase 0'ın "kırmızı typecheck sonraki fazlarda ayırt edilemez arka plan gürültüsü
olur" endişesi giderildi: bundan sonra çıkan her typecheck hatası **yeni**dir.
Master plan digest değişmedi, worktree temiz, tüm değişiklikler owned paths
içinde, test sayıları baseline ile birebir.

**Blocker'lı olan taraf.** İki açık nokta var ve ikisi de "yapılmadı" değil,
"doğrulanmadı/ertelendi" sınıfında:

1. **B-4** — integration job'ın gerçekten yeşil olduğu görülmedi (§9.1). Phase 2
   gerçek PostgreSQL kanıtına dayanacaksa, ilk iş bu job'ın ilk koşusunu
   izlemek olmalı.
2. **B-8** — lint gate'i henüz bloklamıyor. Typecheck ve test bloklarken lint'in
   bloklamıyor olması Phase 2 için kabul edilebilir bir denge, ama kalıcı hale
   gelmemeli.

**CP0 hâlâ `COMPLETED` değildir.** Bu repo'daki B-1…B-4 tarafı kapandı, ama
CP0 acceptance'ı Mobile SSOT'un cihaz gerektiren `cp0_security_api_matrix` ve
`cp0_performance_baselines` blocker'larına da bağlı — bunlar bu repo'nun işi
değil ve Phase 1 onları değiştirmedi.

Master planın yedi ana işi — production mutual-HMAC SDK socket, durable event
consumer cutover, Bridge host client/device gate, WorkflowIR v2 production merge,
Domain Pack production implementation, BridgeFlowCompiler/Executor, Maestro
cutover/removal — **hiçbiri `DONE` değildir**. Phase 1 bunların hiçbirine
başlamadı; bu bilinçli ve RUN_PLAY §4'e uygun.

## 15. Handoff

Bir sonraki agent şu sırayla devam etmeli:

1. Bu dosyayı oku — özellikle §6.2 (spike'lar artık `dist`'e bağlı), §9.1
   (B-4 doğrulanmadı) ve §8.1 (B-8).
2. `pnpm verdict:verify-master-plan` — digest hâlâ
   `sha256:5e7deff018a61b71eb215d2406615dae3304fb63080005e1130297401f15fa01` olmalı.
3. `git status --short` — Phase 1 değişiklikleri henüz **commit edilmedi**;
   commit/PR kararı user'ın. Beklenen: 7 `M` + `?? .github/workflows/cockpit-ci.yml`
   + `?? docs/verdict/run-playbooks/`.
4. **İlk CI koşusunu izle.** `integration` job'ı yeşilse B-4 `CLOSED` olur ve
   Phase 2 readiness `READY`'ye yükselir. Kırmızıysa hatayı Phase 2'nin ilk işi yap.
5. Phase 2 RUN_PLAY'i oluştur. B-8'i (flat config) ve B-6'yı (performans baseline)
   Phase 1B/2 kapsamında değerlendir.
6. Mobile SSOT'u tekrar oku (`updatedAt` 2026-08-01'den ilerlediyse Phase 0 §8.3
   gap tablosunu yenile).
