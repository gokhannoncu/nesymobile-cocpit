# Phase 0 RESULT — Doğrulanabilir Baseline ve SSOT

```yaml
runPlayId: verdict-cockpit-phase-0-run-play
phase: 0
phaseName: "Doğrulanabilir Baseline ve SSOT"
resultState: COMPLETED
createdAt: "2026-08-04 21:54:00 +03"
startedAt: "2026-08-04 21:57:00 +03"
completedAt: "2026-08-04 22:06:00 +03"
lastUpdatedAt: "2026-08-04 22:06:00 +03"
masterPlanVersion: "v1.1.2"
masterPlanDigest: "sha256:5e7deff018a61b71eb215d2406615dae3304fb63080005e1130297401f15fa01"
phase1Readiness: READY_WITH_BLOCKERS
```

## 1. Executive result

Baseline çıkarıldı ve kanıtlandı. Master plan digest doğrulandı, worktree temizdi
(sadece bu run playbook klasörü untracked), lockfile drift yok, test suite tamamen
yeşil (273 passed / 27 skipped).

İki gerçek borç bulundu, ikisi de **typecheck** tarafında:

- `@nesy/api`: **15 TS hatası** (6 dosya) — hepsi `cp2-*` / `checkpoint4-*` spike
  entry point'lerinde. `rootDir` ihlali + `src`↔`dist` çift `Secret` nominal tipi
  kök nedeni.
- `@nesy/web`: **2 TS hatası** (1 test dosyası) — `noUncheckedIndexedAccess` kaynaklı.

Phase 0'ın kuralı gereği bunlar düzeltilmedi; sınıflandırılıp owner adayıyla
raporlandı. Kırmızı typecheck Phase 0 failure değil, ancak **CP0 `COMPLETED`
sayılamaz** — Phase 1'e `READY_WITH_BLOCKERS` ile geçilir.

Diğer bulgular: gerçek PostgreSQL integration `OPTIONAL` (env-gated, CI'da hiç
koşmuyor), CI'da yalnız `contract` job var, Mobile SSOT okunabilir durumda ve
Cockpit planıyla **çelişki yok**, 13 `YENİ` automation route'unun tamamı henüz yok
(beklenen — Phase 4+ işi), performans baseline script'i **yok**.

## 2. Current recovery state

| Alan | Değer |
|---|---|
| Current phase | `0` |
| Current step | `0.14` (bitti) |
| Result state | `COMPLETED` |
| Last successful step | `0.14` |
| Last attempted step | `0.14` |
| Recovery instruction | `Phase 0 baseline tamam. Sıradaki iş Phase 1 RUN_PLAY oluşturmak. Phase 1'e girmeden önce B-1 (api typecheck) ve B-2 (web typecheck) blocker'larının owner'ı atanmalı.` |

## 3. Commands executed

| Command | Result | Evidence / Notes |
|---|---|---|
| `pnpm verdict:verify-master-plan` | `PASS` | `Master plan digest OK: sha256:5e7deff0…f15fa01` — RUN_PLAY digest'i ile birebir aynı |
| `git status --short` | `PASS` | Tek satır: `?? docs/verdict/run-playbooks/` (bu playbook sistemi, untracked) |
| `git branch --show-current` | `PASS` | `production` |
| `git rev-parse --show-toplevel` | `PASS` | `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobileCocpit` |
| `node --version` | `PASS` | `v20.13.1` (engines: `>=20.0.0`) |
| `pnpm --version` | `PASS` | `9.15.4` (packageManager pin ile aynı; upstream 11.20.0 mevcut, yükseltilmedi) |
| `pnpm exec turbo --version` | `PASS` | `2.10.4` |
| `pnpm install --frozen-lockfile` | `PASS` | `Lockfile is up to date… Already up to date` — 12 workspace projesi, drift yok |
| `pnpm typecheck` | `FAIL` | 5/7 task cached-success, `@nesy/api#typecheck` exit 2, `@nesy/web#typecheck` exit 129 (turbo interrupt) |
| `pnpm --filter @nesy/api typecheck` | `FAIL` | 15 `error TS` |
| `pnpm --filter @nesy/web typecheck` | `FAIL` | 2 `error TS` |
| `pnpm test` | `PASS` | 8/8 turbo task; api 144 passed/27 skipped, web 129 passed |
| `git submodule status` | `PASS` | `af203dc… verdict-contract-fixtures (heads/main)` — `contract-fixtures.lock` ile aynı sha |

## 4. Changed files

Read-only alanlara (`apps/api`, `apps/web`, `packages/**`, `packages/db`,
`domain-packs`) **hiç dokunulmadı**. Owned paths dışına çıkılmadı. Kod, fixture,
`package.json` ve script değişikliği gerekmedi.

| File | Change | Reason |
|---|---|---|
| `docs/verdict/run-playbooks/phase-0/RESULT.md` | update | Phase 0 baseline sonucu ve evidence |
| `docs/verdict/run-playbooks/phase-0/RUN_PLAY.md` | update | recovery state + status + `completedAt` |

## 5. Typecheck result

### 5.1 Repo-level (`pnpm typecheck`)

`RED`. 7 turbo task'ından 5'i başarılı/cached; iki uygulama paketi kırmızı.
Not: repo-level koşuda `@nesy/web` exit 129 ile düştü (turbo, api hatası üzerine
task'ı kesti) — bu **web'in ayrı hatası değil**; 0.6'daki izole koşu gerçek
sayıyı verdi. RUN_PLAY 0.6'nın "tek repo-level hata altında gömülmez" kuralı bu
yüzden geçerli ve uygulanmıştır.

### 5.2 `@nesy/api` — 15 hata / 6 dosya

| Dosya | Hata sayısı |
|---|---|
| `apps/api/src/checkpoint4-unauth-peer.ts` | 5 |
| `apps/api/src/cp2-fanout.ts` | 3 |
| `apps/api/src/cp2-gapwatermark.ts` | 2 |
| `apps/api/src/checkpoint4-recovery-security.ts` | 2 |
| `apps/api/src/checkpoint4-device-gate.ts` | 2 |
| `apps/api/src/cp2-ws-host.ts` | 1 |

Hata kodu dağılımı: `TS2532` ×5, `TS2339` ×4, `TS6059` ×3, `TS2322` ×2, `TS2345` ×1.

Üç sınıfa ayrılıyor:

| Sınıf | Kod | Kök neden | Önerilen owner | Önerilen faz |
|---|---|---|---|---|
| **C-1 rootDir ihlali** | `TS6059` | `checkpoint4-*.ts` dosyaları `packages/control-channels/src/*` ve `packages/control-contract/src/*`'i **relative path** ile import ediyor; `apps/api` `rootDir=apps/api/src`. Paket girişini `dist`/workspace alias yerine kaynaktan çekme sorunu. | API/build owner | Phase 1 (baseline temizliği) |
| **C-2 çift nominal `Secret`** | `TS2322` | Aynı brand tipi hem `control-contract/src/index` hem `control-contract/dist/index` üzerinden geliyor; `unique symbol` iki ayrı declaration olduğu için atanamıyor. C-1'in doğrudan türevi — C-1 çözülünce büyük olasılıkla düşer. | API/build owner | Phase 1 |
| **C-3 strict index/narrowing** | `TS2532`, `TS2339`, `TS2345` | `noUncheckedIndexedAccess` altında guard'sız index erişimi ve `never`'a daralan union (`checkpoint4-unauth-peer.ts:170,173`). Yerel, dosya bazlı düzeltme. | CP2/CP4 spike yazarı | Phase 1 |

Önemli bağlam: kırmızı olan altı dosyanın tamamı **CP2/CP4 spike entry point'i**
(`cp2-*`, `checkpoint4-*`), production route/servis kodu değil. Yani hata yüzeyi
production runtime'da değil, doğrulama harness'ında. Yine de `pnpm typecheck`
gate'i kırmızı olduğu için sonraki fazların sinyali bulanık kalır — bu nedenle
blocker sayılır.

### 5.3 `@nesy/web` — 2 hata / 1 dosya

```text
src/lib/debug-view/filter-interactions.test.ts(127,16): error TS2322
src/lib/debug-view/filter-interactions.test.ts(127,27): error TS2322
  Type 'InteractionEvent | undefined' is not assignable to type 'InteractionEvent'
```

Sınıf: C-3 ile aynı (`noUncheckedIndexedAccess`). Tek satır, tek dosya, sadece
test kodu. Önerilen owner: Debug View owner. Önerilen faz: Phase 1.
**Not:** bu dosya `pnpm test` içinde geçiyor (vitest transpile-only), yani
typecheck ile test arasında bir sinyal boşluğu var.

## 6. Test result

`GREEN`

| Paket | Test files | Tests | Skipped |
|---|---|---|---|
| `@nesy/api` | 22 passed / 2 skipped (24) | 144 passed | 27 |
| `@nesy/web` | 29 passed (29) | 129 passed | 0 |
| **Toplam** | 51 passed / 2 skipped | **273 passed** | **27** |

Süre: api 2.04s, web 1.78s (turbo toplam 4.3s; 5/8 task cached).

### 6.1 Skipped / opt-in envanteri

Hiçbiri "kırık test" değil; hepsi bilinçli env-gate. Ancak **hiçbiri de varsayılan
olarak koşmuyor** — yani bu alanların gerçek kanıtı şu an yok.

| Test | Gate | Durum |
|---|---|---|
| `apps/api/src/services/verdict-ingest.integration.test.ts` (16 test) | `VERDICT_DB_IT=1` **ve** `DATABASE_URL` | Tamamı skipped |
| `apps/api/src/services/test-event-ws-server.integration.test.ts` | `VERDICT_DB_IT=1` **ve** `DATABASE_URL` | Tamamı skipped |
| `apps/api/src/services/contract-fixtures.test.ts` | `VERDICT_FIXTURES_DIR` / corpus varlığı | `it.skip("legacy + structured fixtures (corpus not present)")` fallback'i mevcut |
| `apps/api/src/services/test-event-compat-gate.test.ts` | `VERDICT_V1_GATE_CAPTURE` (+ `VERDICT_V1_GATE_EXPECT`) | 1 skipped — gerçek cihaz capture gerektirir |
| `apps/api/src/services/diagnostics/CapturePolicyEngine.test.ts` | — | Dosyada skip bulunamadı; turbo raporundaki 2. skipped file adayı, tekil doğrulama Phase 1'e bırakıldı |

Flaky/environment-dependent: `health.routes.test.ts` (100ms) ve
`nesy-env.routes.test.ts` (101ms) gerçek server bind ediyor; port çakışmasına
duyarlı olabilir. Bu koşuda ikisi de geçti.

## 7. PostgreSQL integration status

`OPTIONAL`

Kanıt:

- `packages/db/prisma/schema.prisma`: `provider = "postgresql"`, `url = env("DATABASE_URL")`.
  Yani şema **gerçekten** PostgreSQL; SQLite/mock ile değiştirilmiş değil.
- `apps/api/src/services/verdict-ingest.integration.test.ts:24`:
  `const ENABLED = process.env.VERDICT_DB_IT === "1" && Boolean(process.env.DATABASE_URL)`
- `.github/workflows/` altında **tek** dosya: `contract-fixtures.yml`.
  İçinde ne PostgreSQL `services:` bloğu, ne `DATABASE_URL`, ne `VERDICT_DB_IT` var.
  Koştuğu tek suite: `pnpm --filter @nesy/api test -- src/services/contract-fixtures.test.ts`.

Sonuç: ingest integration testi gerçek PostgreSQL'e karşı **yazılmış** ama
**CI'da hiç koşmuyor** ve lokalde de varsayılan olarak skipped. Bu, testin
mock ile "yeşil geçmesi" durumundan farklı ve daha iyi bir konumdur — eksik olan
job, test değil.

CI genel durumu: Cockpit repo'sunda typecheck/test/lint job'ı **yok**.
`contract-fixtures.yml` kendi başlığında bunu zaten kabul ediyor
(*"Wiring the rest of the Cockpit CI is a separate piece of work"*).

Phase 0 kapsamında `.github/workflows/**` altında **edit yapılmadı** (RUN_PLAY 0.8
gereği plan yazıldı, migration yapılmadı). Taslak job önerisi:

```yaml
# öneri — Phase 1'de eklenecek, Phase 0'da eklenmedi
jobs:
  api-integration:
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_PASSWORD: postgres }
        options: >-
          --health-cmd pg_isready --health-interval 10s
          --health-timeout 5s --health-retries 5
        ports: ['5432:5432']
    env:
      DATABASE_URL: postgresql://postgres:postgres@localhost:5432/verdict_test
      VERDICT_DB_IT: '1'
    steps:
      - run: pnpm --filter @nesy/db exec prisma migrate deploy
      - run: pnpm --filter @nesy/api test
```

Ayrıca `contract-fixtures.yml` içinde plan tarafından **kabul edilmiş iki gap**
yorum olarak duruyor, Phase 0 bunları teyit eder:

1. Job, Bölüm G'nin istediği gibi nötr `verdict-contract-fixtures` repo'sundan
   `workflow_call` ile çağrılmıyor; iki repo'da **elle tutulan kopya**.
2. `secrets.PEER_LOCK_TOKEN` gerçekte `pull_requests: read` istiyor; Bölüm G
   erişim tablosu yalnız `contents: read` diyor. Plan gap'i olarak işaretli.

## 8. Mobile SSOT status

`PRESENT_AND_PARSED`

Kaynak: `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-status.json`
— 21.125 byte, `schemaVersion: 1`, `updatedAt: "2026-08-01"`, JSON olarak sorunsuz parse edildi.
Authority: `sole-machine-readable-source` (narrative planlar bunu override etmez).

### 8.1 Scope kararları

| Scope | Decision |
|---|---|
| `evidence_core_integration` | `go` |
| `cockpit_functional_e2e` | `go` |
| `bridge_b1_pilot` | `conditional` |
| `verdict_platform_release` | `no_go` |
| `production_rollout` | `no_go` |
| `public_sdk_release` | `no_go` |

### 8.2 Checkpoint durumu

| ID | Status | Owner | Blockers |
|---|---|---|---|
| `cp0` | conditional | shared | 2 |
| `cp1` | passed | mobile | 0 |
| `cp2` | passed | shared | 0 |
| `cp3` | conditional | mobile | 2 |
| `cp4` | passed | shared | 0 |
| `cp5` | conditional | shared | 4 |
| `cp6` | conditional | shared | 3 |
| `cp7` | conditional | shared | 4 |
| `cp8` | conditional | shared | 7 |
| `integration_vertical_slice` | passed | shared | 0 |
| `bridge_b1` | conditional | bridge | 2 |
| `bridge_b2` | not_started | product | 2 |

### 8.3 Cockpit master planı ile çelişki

**Çelişki bulunmadı.** SSOT ile Cockpit RUN_PLAY'in "Phase 0 tamamlanmadan `DONE`
sayılamaz" listesi aynı yöne bakıyor:

| Cockpit RUN_PLAY §1 iddiası | SSOT karşılığı | Uyum |
|---|---|---|
| production mutual-HMAC SDK socket açık | `cp0.blockers[cp0_security_api_matrix]`, `production_rollout: no_go` | ✅ |
| durable event consumer cutover açık | `cp5` conditional (4 blocker) | ✅ |
| Bridge host client/device gate açık | `bridge_b1` conditional | ✅ |
| WorkflowIR v2 production merge açık | `bridge_b2` not_started | ✅ |
| Domain Pack production implementation açık | `bridge_b2` not_started | ✅ |
| BridgeFlowCompiler/Executor açık | `verdict_platform_release: no_go` — rationale'da adı geçiyor | ✅ |
| Maestro cutover veya removal açık | `verdict_platform_release: no_go` — *"measured Maestro cutover are not implemented"* | ✅ |

SSOT'un `cp0` blocker'ları (security API matrix API 23/26/33 + dört performans
baseline'ı) **mobile/emülatör/fiziksel cihaz** işi. Bu Cockpit repo'sunun Phase 0
kapsamında değil — ama SSOT `cp0`'ı `conditional` tuttuğu için Cockpit tarafında
da CP0 `passed` denemez. Bu iki tarafın **tutarlı** olduğu anlamına gelir, çelişki
değil.

Tek dikkat noktası (çelişki değil, drift riski): SSOT `updatedAt: 2026-08-01`,
Cockpit master plan digest'i bugünkü (`2026-08-04`) durumu yansıtıyor. Aradaki
üç günde mobil tarafta değişiklik olduysa SSOT henüz taşımıyor olabilir.

## 9. Cockpit route/page/data-source baseline

Envanter (`apps/web/src/app` altında): **47 `page.tsx`**, **13 `route.ts`**.
`apps/web/src/config` klasörü **yok** — navigasyon SSOT'u
`packages/metronic/src/config/layout-21.config.tsx` (+ `menu-utils.ts`).

### 9.1 Mevcut route dağılımı

| Workspace | Route sayısı |
|---|---|
| `(cockpit)/product` | 8 (`[slugName]` dynamic dahil) |
| `(cockpit)/pm` | 6 |
| `(cockpit)/engineering` | 10 (3'ü `tools/*`) |
| `(cockpit)/debug-view` | 9 (2'si `(device-lab-tools)` grubunda) |
| `(cockpit)/data-center` | 5 |
| `(cockpit)/automation` | 5 |
| `(automation-editor)` | 2 (`[id]`, `[id]/runs/[runId]`) |
| kök | 2 (`(cockpit)/page.tsx`, `(cockpit)/[...slug]/page.tsx`) |

### 9.2 Placeholder / broken / redirect / dynamic / auth ayrımı

- **Bilinçli placeholder (broken route DEĞİL):** 10 `/home/*` route'u.
  Fiziksel `page.tsx` yok; `(cockpit)/[...slug]/page.tsx` catch-all'ı
  `findWorkspaceMenuItem(path)` ile menüden karşılıyor, bulunamazsa `notFound()`.
  `layout-21.config.tsx` içinde 9 `/home/*` girdisi doğrulandı. Notion linki olan
  bir placeholder shell render ediliyor. H.5.1'in `BACKLOG` + *"broken-route olarak
  raporlanmaz"* hükmüyle **uyumlu**.
- **Dynamic route:** 3 — `product/feature-library/[slugName]`, `automation/[id]`,
  `automation/[id]/runs/[runId]`, artı `[...slug]` catch-all.
- **Redirect:** `/product` → `/product/domain-glossary` (H.5.2 `KORUNUR`).
- **Auth/RBAC:** `apps/web/src` altında **`middleware.ts` yok** → route seviyesinde
  merkezi auth gate yok. Auth layout bazlı ve iki workspace'e sınırlı:
  `(cockpit)/automation/layout.tsx` ve `(cockpit)/data-center/layout.tsx`
  (`contexts/nesy-auth-context.tsx`). Diğer workspace'ler auth'suz.
- **Broken route:** tespit edilmedi.

### 9.3 H.5 matrisiyle gap listesi

| Gap | Detay |
|---|---|
| **G-1 — 13 `YENİ` automation route'u yok** | `/automation/domain-packs`, `…/domain-packs/[packId]`, `/automation/test-profiles`, `…/[profileId]`, `/automation/test-campaigns`, `…/[campaignId]`, `/automation/features`, `…/[featureId]`, `/automation/components`, `/automation/capabilities`, `/automation/workflow-library`, `/automation/test-suites`, `/automation/run-planner`, `/automation/execution-queue`, `/automation/coverage-graph`. Beklenen gap — Phase 4+ işi, Phase 0 blocker'ı değil. |
| **G-2 — `/pm/root-cause` navigasyonda yok** | Sayfa mevcut ve çalışıyor (`(cockpit)/pm/root-cause/page.tsx`), ama `layout-21.config.tsx` içinde `root-cause` girdisi bulunamadı. H.5.3'ün `NAV FIX` satırı **doğrulandı**: yalnız direct link ile erişilebilir durumda. |
| **G-3 — `DÖNÜŞÜR` route'ları hâlâ mevcut halinde** | `/debug-view/overview`, `/debug-view/operational-health`, `/debug-view/screen-state`, `/debug-view/interactions`, `/automation/list`, `/automation/history`, `/automation/field-login`, `/automation/01-load-tour-flow`, `/automation/[id]`, `/automation/[id]/runs/[runId]`, `/engineering/current-architecture`, `/engineering/modernization-plan`. Beklenen — dönüşüm sonraki fazların işi. |
| **G-4 — auth kapsamı H.5'te tanımsız** | H.5 matrisi route başına auth/RBAC hedefi vermiyor; mevcut durumda yalnız 2 workspace korumalı. Karar gerektiren gap. |

`/debug-view/adb-scenarios` ve `/debug-view/log-explorer` `(device-lab-tools)`
route group'u içinde; URL'de segment üretmedikleri için H.5.5'teki düz path'lerle
**eşleşiyor** — gap değil.

## 10. Maestro/YAML legacy baseline

`PRESENT — INVENTORY ONLY` (hiçbir referans silinmedi)

`rg -c -i "maestro|yamlContent|maestroOutput"` → **48 dosya**.

### 10.1 Runtime-critical (söküm riski yüksek — Phase 9 evidence)

| Dosya | Hit |
|---|---|
| `apps/api/src/services/workflow-runner.ts` | 51 |
| `apps/api/src/services/maestro-executor.ts` | 25 |
| `apps/api/src/services/maestro-executor.test.ts` | 23 |
| `apps/api/src/services/device-worker.ts` | 23 |
| `apps/api/src/services/yaml-generator.ts` | 21 |
| `apps/api/src/lib/field-courier-login-orchestrator.ts` | 14 |
| `apps/api/src/services/run-store.ts` | 9 |
| `apps/api/src/services/oracle-engine.ts` | 9 |
| `apps/api/src/legacy/workflows.router.ts` | 5 |
| `apps/api/src/services/test-event-bridge.ts` | 3 |
| `apps/api/src/services/backend-validation-lane.ts` | 3 |

### 10.2 Persistence / schema

| Dosya | Hit |
|---|---|
| `packages/db/prisma/schema.prisma` | 4 |
| `packages/db/prisma/manual-migrations/20260519_yaml_to_db.sql` | 2 |

Bu ikisi ayrı işaretlenir: söküm **veri migration'ı** gerektirir, kod silmekle bitmez.

### 10.3 UI

`apps/web/src/app/(automation-editor)/automation/[id]/runs/[runId]/page.tsx` (9),
`.../yaml-registry.ts` (2), `.../workflow-node-config.ts` (2),
`components/automation/load-tour-flow-workspace.tsx` (3),
`services/field-courier-login.ts` (2), `services/automation-api.ts` (2),
`(cockpit)/automation/field-login/page.tsx` (2).

### 10.4 Docs (söküm riski yok)

Master planın kendisi (81), `COCKPIT_SDK_BRIDGE_COMPAT_PLAN.md` (53),
`CONDITION_ENGINE_AND_BRIDGEFLOW.md` (37), `FAZ4_COCKPIT_LIVE_INSPECTOR_PLAN.md` (8),
`SISTEM_NASIL_CALISIR.md` (7), 4 `docs/superpowers/**` spec/plan dosyası.

Söküm sırası önerisi (Phase 9 girişi): UI → `legacy/workflows.router.ts` →
`yaml-generator` → `maestro-executor` → `workflow-runner`/`device-worker` →
prisma schema/data migration. `maestro-executor.test.ts` (5 test) şu an yeşil ve
cutover için regresyon ağı görevi görüyor; **cutover kanıtı alınmadan silinmemeli**.

## 11. Fixture baseline

`PRESENT — LOCK IN SYNC`

- `contract-fixtures.lock`: `sha=af203dc534aeebe65ae6d2d5f913c346339bdb5c`
- `git submodule status`: `af203dc534aeebe65ae6d2d5f913c346339bdb5c verdict-contract-fixtures (heads/main)` — **eşleşiyor**, drift yok
- Corpus checkout edilmiş; içerik: `legacy-lines/`, `structured/`, `expected-parse/`,
  `control-plane/`, `tools/`, `manifest.json`, `README.md`
- `scripts/check-fixture-lock.mjs` + `check-fixture-lock.test.mjs` mevcut; CI job'ı
  gate'i kullanmadan **önce** validator testlerini koşuyor (`node --test`)

`manifest.json` sayıları:

| Bucket | Count |
|---|---|
| `legacyLines` | 83 |
| `legacyMatrix` | 72 (12 AutomationAction × 6 AutomationStatus) |
| `structured` | 55 |
| `wireNames` | 49 (40 TestEvent-generated + 9 spec-authored) |
| `controlPlane` | 12 |
| `expectedParse` | 83 |

### 11.1 Fixture gap'leri

| Gap | Sınıf | Detay |
|---|---|---|
| **F-1** | `MISSING_FIXTURE` | `manifest.pendingSdkWireNames` — 9 isim SDK tarafında henüz emit edilmiyor, fixture'ı yok: `SPAN_STARTED`, `SPAN_ENDED`, `MEMORY_PRESSURE_DETECTED`, `DIAGNOSTIC_MARKER`, `FLAG_CHANGED`, `SCREEN_EXITED`, `RUN_ENDED`, `ANR_RISK_DETECTED`, `ANR_LIKELY` |
| **F-2** | `MISSING_FIXTURE` | **Golden workflow fixture yok.** Corpus wire-contract (event/control line) düzeyinde; WorkflowIR/Plan girdi-çıktı golden'ı içermiyor. WorkflowIR v2 (Phase 4+) için gerekli. |
| **F-3** | `MISSING_FIXTURE` | **Golden evidence/oracle fixture yok.** `oracle-engine`/four-layer evidence çıktısının donmuş beklenen hali yok; Run Detail dönüşümü regresyon ağı olmadan yapılamaz. |
| **F-4** | `INFRA_GAP` | `contract-fixtures.test.ts` corpus yoksa `it.skip` ile sessizce düşüyor. Lokalde yanlış-yeşil riski; CI'da `VERDICT_FIXTURES_DIR` set edildiği için orada gerçek koşuyor. |

## 12. Performance baseline

`MISSING_PERFORMANCE_BASELINE_SCRIPT`

`scripts/` altındaki tek ölçüm aracı `nav-benchmark.mjs` — Cockpit **navigasyon**
ölçümü, Verdict runtime latency'si değil. Ek olarak `apps/api/src/cp2-ingest-perf.ts`
bir CP2 spike ölçüm entry point'i olarak mevcut (WS ingest tarafını kısmen kapsıyor).

RUN_PLAY 0.13'teki 8 ölçüm alanının durumu:

| Ölçüm alanı | Script | Durum |
|---|---|---|
| WS ingest/ACK latency | `apps/api/src/cp2-ingest-perf.ts` | `PARTIAL` — spike var, baseline sayısı kayıtlı değil |
| commit→receipt latency | — | `MISSING` |
| commit→ordered-consumer latency | — | `MISSING` |
| Bridge observation latency | — | `MISSING` |
| Bridge mutation latency | — | `MISSING` |
| wait/cancel latency | — | `MISSING` |
| scoped dump maliyeti | — | `MISSING` |
| workflow duration | — | `MISSING` |

Ayrıca SSOT `cp0.blockers[cp0_performance_baselines]` mobil tarafta dört ayrı
performans baseline'ını (Stop List FPS, API latency, interaction volume, touch
UI-thread cost) `requiresDevice: physical` olarak açık tutuyor. Yani performans
baseline boşluğu **iki taraflı**.

Phase 0 gerçek benchmark koşmadı (RUN_PLAY 0.13 bunu zorunlu tutmuyor);
ölçüm alanları ve eksik script'ler yukarıda netleştirildi.

## 13. Blockers

| ID | Severity | Blocker | Kanıt | Önerilen owner | Faz |
|---|---|---|---|---|---|
| **B-1** | HIGH | `@nesy/api typecheck` 15 hata (6 dosya). `pnpm typecheck` gate'i kırmızı → sonraki fazların pass/fail sinyali mevcut borçtan ayrılamıyor. | §5.2 | API/build owner | Phase 1 |
| **B-2** | MEDIUM | `@nesy/web typecheck` 2 hata (`filter-interactions.test.ts:127`). Test **çalışıyor** ama typecheck kırmızı → test/typecheck sinyal boşluğu. | §5.3 | Debug View owner | Phase 1 |
| **B-3** | MEDIUM | Cockpit CI'da typecheck/test/lint job'ı yok; tek job `contract`. Kırmızı typecheck'i hiçbir gate yakalamıyor. | §7 | Platform/CI owner | Phase 1 |
| **B-4** | MEDIUM | Gerçek PostgreSQL ingest integration (16+ test) hiçbir yerde koşmuyor — CI'da job, lokalde varsayılan env yok. | §7 | API owner | Phase 1 |
| **B-5** | LOW | `contract` job'ı nötr repo'dan `workflow_call` ile değil, elle tutulan kopya olarak çalışıyor; `PEER_LOCK_TOKEN` gerçekte `pull_requests: read` istiyor ama Bölüm G tablosu `contents: read` diyor. | §7 | Platform/CI owner | Phase 1 (plan düzeltmesi) |
| **B-6** | LOW | Performans baseline script'i yok (8 alanın 7'si `MISSING`). | §12 | Platform owner | Phase 1/2 |
| **B-7** | LOW | Golden workflow (F-2) ve evidence (F-3) fixture'ı yok; WorkflowIR v2 ve Run Detail dönüşümü regresyon ağsız. | §11.1 | Contract owner | Phase 2+ |

Phase 0'ı **`FAILED` yapan** hiçbir blocker yok: master digest doğrulandı, tüm
baseline adımları kanıtla kapandı. B-1…B-7 Phase 0'ın *çıktısı*, engeli değil.

## 14. Deferred work

Phase 0 bilinçli olarak yapmadı, uygun faza aktarıldı:

| Deferred iş | Neden | Hedef faz |
|---|---|---|
| B-1/B-2 typecheck düzeltmeleri | `apps/api` ve `apps/web` Phase 0'da read-only; RUN_PLAY §10 "hemen düzeltmeye atlama" diyor | Phase 1 |
| CI typecheck/test/lint job'ı ekleme | `.github/workflows/**` edit'i Phase 0'da plan olarak yazılır, uygulanmaz (0.8) | Phase 1 |
| PostgreSQL integration job'ı (taslak §7'de) | Aynı gerekçe; ayrıca migration Phase 0 kapsamı dışı | Phase 1 |
| `/pm/root-cause` NAV FIX (G-2) | `packages/metronic` read-only | CP6 / route fazı |
| `pnpm` 9.15.4 → 11.20.0 | RUN_PLAY 0.4: otomatik dependency upgrade yasak | ayrı karar |
| Gerçek performans benchmark koşusu | 0.13 zorunlu tutmuyor; script'ler zaten yok | Phase 1/2 |
| Maestro/YAML söküm (48 dosya) | Phase 0'da silme yasak; inventory çıkarıldı | Phase 9 |
| 13 `YENİ` automation route'u (G-1) | Cockpit UI implementation Phase 0 kapsamı dışı | Phase 4+ |
| Golden workflow/evidence fixture üretimi (F-2/F-3) | Contract işi | Phase 2+ |
| `CapturePolicyEngine.test.ts` skip kaynağının tekil doğrulaması | Küçük belirsizlik, baseline'ı etkilemiyor | Phase 1 |

## 15. Phase 1 readiness decision

`READY_WITH_BLOCKERS`

Gerekçe:

**Hazır olan taraf** — master plan digest doğrulandı; worktree temiz ve user'ın
değişikliği yok; toolchain sürümleri `engines` ile uyumlu; lockfile drift yok;
273 test yeşil; fixture lock ile submodule sha'sı eşleşiyor; Mobile SSOT okunabilir
ve Cockpit planıyla çelişmiyor; route/legacy/fixture/performans envanteri kanıtla
çıkarıldı.

**Blocker'lı olan taraf** — `pnpm typecheck` kırmızı (B-1, B-2) ve bunu yakalayacak
CI gate'i yok (B-3). Phase 1 çalışmasına **başlanabilir**, çünkü kırmızı yüzey
CP2/CP4 spike entry point'lerine ve bir test dosyasına sınırlı; production route
kodunda değil. Ama Phase 1'in ilk işi B-1/B-2/B-3 olmalı — aksi halde sonraki
fazlarda "typecheck kırmızı" ayırt edilemez bir arka plan gürültüsü olur.

**CP0 `COMPLETED` değildir.** Phase 0 baseline *çalışması* tamamlandı; CP0
*acceptance*'ı hem bu repo'daki B-1…B-4'e hem SSOT'un cihaz gerektiren
`cp0_security_api_matrix` / `cp0_performance_baselines` blocker'larına bağlı.

RUN_PLAY §1'deki yedi iş — production mutual-HMAC SDK socket, durable event
consumer cutover, Bridge host client/device gate, WorkflowIR v2 production merge,
Domain Pack production implementation, BridgeFlowCompiler/Executor, Maestro
cutover/removal — **hiçbiri `DONE` değildir** ve bu Phase 0 sonucu onları
`DONE` yapmaz.

## 16. Handoff

Bir sonraki agent şu sırayla devam etmeli:

1. `docs/verdict/run-playbooks/phase-0/RESULT.md` (bu dosya) — özellikle §5, §7, §13.
2. `pnpm verdict:verify-master-plan` — digest hâlâ
   `sha256:5e7deff018a61b71eb215d2406615dae3304fb63080005e1130297401f15fa01` olmalı.
   Değiştiyse master plan güncellenmiş; Phase 0 bulguları yeniden doğrulanmalı.
3. `git status --short` — bu run'dan sonra beklenen: `?? docs/verdict/run-playbooks/`
   (playbook sistemi hâlâ untracked; commit kararı user'ın).
4. `docs/verdict/run-playbooks/phase-1/RUN_PLAY.md` oluştur. Phase 1'in ilk üç
   step'i B-1, B-2, B-3 olmalı; owned paths'e `apps/api/src/cp2-*.ts`,
   `apps/api/src/checkpoint4-*.ts`,
   `apps/web/src/lib/debug-view/filter-interactions.test.ts` ve
   `.github/workflows/**` dahil edilmeli.
5. B-1'e girerken C-1 (`TS6059` rootDir) ile başla — C-2 (`TS2322` çift `Secret`)
   büyük olasılıkla onun türevi ve kendiliğinden düşer. C-3'ü en sona bırak.
6. Mobile SSOT'u tekrar oku (`updatedAt` 2026-08-01'den ilerlediyse §8.3 gap
   tablosunu yenile).

Phase 0 kapsamı kapandı. Bu repo'da Phase 0 adına yapılacak başka iş yok.
