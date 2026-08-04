# Phase 1 RUN_PLAY — CP0 Blocker Cleanup ve CI Gate

```yaml
runPlayId: verdict-cockpit-phase-1-run-play
phase: 1
phaseName: "CP0 Blocker Cleanup ve CI Gate"
status: COMPLETED
recoveryState: COMPLETED
createdAt: "2026-08-04 22:35:52 +03"
startedAt: "2026-08-04 22:38:00 +03"
completedAt: "2026-08-04 22:49:07 +03"
lastUpdatedAt: "2026-08-04 22:49:07 +03"
timezone: "Europe/Istanbul"
masterPlanPath: "docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md"
masterPlanVersion: "v1.1.2"
masterPlanDigest: "sha256:5e7deff018a61b71eb215d2406615dae3304fb63080005e1130297401f15fa01"
verifyMasterPlanCommand: "pnpm verdict:verify-master-plan"
previousPhaseResult: "docs/verdict/run-playbooks/phase-0/RESULT.md"
resultFile: "docs/verdict/run-playbooks/phase-1/RESULT.md"
phase0Readiness: "READY_WITH_BLOCKERS"
phase2Readiness: "READY_WITH_BLOCKERS"
```

## 1. Amaç

Phase 1'in amacı Phase 0 baseline'ında bulunan CP0 blocker'larını kapatmak ve sonraki
SDK/Bridge/Cockpit runtime fazlarının üzerinde çalışabileceği temiz CI/typecheck/test
zeminini oluşturmaktır.

Bu faz, master plandaki production mutual-HMAC SDK runtime işine doğrudan başlama
fazı değildir. Önce Phase 0'ın B-1, B-2, B-3 ve B-4 blocker'ları kapatılır:

| ID | Hedef |
|---|---|
| B-1 | `@nesy/api` typecheck hatalarını kapatmak |
| B-2 | `@nesy/web` typecheck hatasını kapatmak |
| B-3 | Cockpit CI typecheck/test/lint gate'i eklemek |
| B-4 | Gerçek PostgreSQL integration job'ını CI'a bağlamak |

Bunlar kapanmadan Phase 1 güvenlik/runtime geliştirmesi `DONE` sayılamaz; çünkü
typecheck ve CI sinyali mevcut borçtan ayrılamaz.

## 2. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `1` |
| Current step | `1.11` (bitti) |
| Current state | `COMPLETED` |
| Last successful step | `1.11` |
| Last attempted step | `1.11` |
| Last update | `2026-08-04 22:49:07 +03` |
| Recovery instruction | `Phase 1 kapandı. B-1/B-2/B-3 CLOSED, B-4 IMPLEMENTED_UNVERIFIED (lokalde Docker yok), B-5 DEFERRED_TO_PHASE_1B, yeni B-8 açıldı. Detay için RESULT.md. Sıradaki iş: ilk CI koşusunda integration job'ı doğrula, sonra Phase 2 RUN_PLAY oluştur.` |

Step sonuçları:

| Step | Sonuç |
|---|---|
| 1.1 Preflight | `DONE` — digest OK, branch `production`, worktree temiz |
| 1.2 B-1 root cause | `DONE` — 15 hata doğrulandı |
| 1.3 B-1/C-1 import | `DONE` — C-1 (×3) + C-2 (×2) birlikte kapandı |
| 1.4 B-1/C-3 narrowing | `DONE` — 10 hata, `!` kullanılmadı |
| 1.5 B-2 web | `DONE` — `sampleAt()` accessor |
| 1.6 Repo typecheck | `DONE` — 7/7 yeşil |
| 1.7 B-3 CI gate | `DONE` — `cockpit-ci.yml`; lint non-blocking (B-8) |
| 1.8 B-4 PostgreSQL job | `DONE_UNVERIFIED` — lokalde koşulamadı |
| 1.9 B-5 contract gap | `DEFERRED_TO_PHASE_1B` |
| 1.10 Test regression | `DONE` — 273 passed / 27 skipped, baseline ile aynı |
| 1.11 Final verification | `DONE` — digest değişmedi, diff temiz, owned paths içinde |

State transition kuralları:

```text
READY_TO_START
  → IN_PROGRESS
  → PAUSED
  → IN_PROGRESS
  → COMPLETED

IN_PROGRESS
  → BLOCKED
  → IN_PROGRESS

IN_PROGRESS
  → FAILED
```

Bir agent yarıda kalırsa:

1. `Current step` güncellenir.
2. `Last successful step` güncellenir.
3. `Last attempted step` güncellenir.
4. `lastUpdatedAt` güncellenir.
5. `RESULT.md` içine ara durum ve recovery instruction yazılır.

## 3. Phase 1 scope

Phase 1 şunları kapsar:

1. Phase 0 sonucu ve blocker listesini doğrulama.
2. Master plan digest doğrulama.
3. Worktree baseline alma.
4. `@nesy/api` typecheck hatalarını düzeltme.
5. `@nesy/web` typecheck hatasını düzeltme.
6. Repo-level `pnpm typecheck` sonucunu yeşile alma.
7. Cockpit CI'a typecheck/test/lint gate'i ekleme veya mevcut CI gap'ini kapatma.
8. Gerçek PostgreSQL integration job'ını CI'a bağlama.
9. Contract fixture CI mevcut gap'lerini result'a bağlama; gerekiyorsa minimal düzeltme.
10. Test suite'i tekrar çalıştırma.
11. Phase 2 readiness kararını yazma.

## 4. Kapsam dışı

Phase 1'de aşağıdakiler yapılmaz:

- Production SDK mutual-HMAC protocol implementasyonu.
- Durable event consumer runtime implementasyonu.
- Bridge host client implementasyonu.
- WorkflowIR v2 schema tasarımı.
- Domain Pack üretimi.
- Cockpit UI route migration.
- Maestro/YAML sökümü.
- Büyük dependency upgrade.
- Prisma schema/data migration.
- Mobile repo değişikliği.

PostgreSQL CI job'ı için gerekli migration deploy komutu eklenebilir; ancak schema
değiştirilmez.

## 5. Owned paths

Phase 1 agent'ı aşağıdaki dosyalarda değişiklik yapabilir:

```text
docs/verdict/run-playbooks/phase-1/RUN_PLAY.md
docs/verdict/run-playbooks/phase-1/RESULT.md
apps/api/src/cp2-fanout.ts
apps/api/src/cp2-gapwatermark.ts
apps/api/src/cp2-ws-host.ts
apps/api/src/checkpoint4-device-gate.ts
apps/api/src/checkpoint4-recovery-security.ts
apps/api/src/checkpoint4-unauth-peer.ts
apps/web/src/lib/debug-view/filter-interactions.test.ts
.github/workflows/**
```

Gerekirse, import path düzeltmesi için şu package metadata dosyaları da değiştirilebilir:

```text
packages/control-channels/package.json
packages/control-contract/package.json
packages/control-channels/src/index.ts
packages/control-contract/src/index.ts
```

Bu package alanlarında değişiklik yapmadan önce agent root cause'u yazmalıdır. Eğer
API spike dosyalarındaki import path düzeltmesi yeterliyse package contract dosyalarına
dokunulmaz.

## 6. Read-only context paths

Başlamadan önce okunacak dosyalar:

```text
docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md
docs/verdict/run-playbooks/README.md
docs/verdict/run-playbooks/phase-0/RESULT.md
docs/verdict/run-playbooks/phase-1/RUN_PLAY.md
docs/verdict/run-playbooks/phase-1/RESULT.md
package.json
pnpm-workspace.yaml
turbo.json
apps/api/tsconfig.json
apps/web/tsconfig.json
.github/workflows/**
```

Mobile SSOT yalnız read-only kontrol içindir:

```text
/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-status.json
```

## 7. Work package sırası

### 1.1 Preflight

Komutlar:

```bash
pnpm verdict:verify-master-plan
git status --short
git branch --show-current
git rev-parse --show-toplevel
```

Acceptance:

- Master digest doğru.
- Worktree açıkça kaydedildi.
- Phase 0 RESULT hâlâ `COMPLETED`.
- Phase 1 RESULT `IN_PROGRESS` olarak güncellendi.

### 1.2 B-1 API typecheck root cause doğrulama

Komut:

```bash
pnpm --filter @nesy/api typecheck
```

Beklenen Phase 0 baseline:

- 15 TS hata.
- `TS6059` rootDir ihlali.
- `TS2322` çift nominal `Secret`.
- `TS2532/TS2339/TS2345` strict index/narrowing.

Acceptance:

- Hata listesi güncel olarak RESULT.md'ye yazılır.
- Önce C-1 rootDir/import path sorunu hedeflenir.

### 1.3 B-1/C-1 rootDir import düzeltmesi

Hedef:

`apps/api/src/checkpoint4-*.ts` dosyalarının `packages/*/src/*` relative importları
public workspace package entrypoint veya doğru compiled contract yoluna çekilir.

Öncelik:

1. Public package export/import kullan.
2. `src` ve `dist` nominal type karışımını ortadan kaldır.
3. `apps/api` `rootDir` kapsamı dışındaki source dosyalarını programa sokma.

Acceptance:

- `TS6059` hataları düşer.
- `TS2322` çift nominal `Secret` hataları düşer veya ayrı root cause olarak kalır.
- Değişiklik yalnız checkpoint/spike entry point importlarını etkiler.

### 1.4 B-1/C-3 strict index/narrowing düzeltmesi

Hedef dosyalar:

```text
apps/api/src/cp2-fanout.ts
apps/api/src/cp2-gapwatermark.ts
apps/api/src/cp2-ws-host.ts
apps/api/src/checkpoint4-unauth-peer.ts
```

Kurallar:

- Non-null assertion (`!`) yalnız invariant gerçekten kanıtlanabiliyorsa kullanılır.
- Tercih edilen çözüm: explicit guard, early throw, typed helper veya checked access.
- Runtime davranışı değiştirilmez; checkpoint script semantics korunur.

Acceptance:

- `pnpm --filter @nesy/api typecheck` yeşil.
- İlgili checkpoint scriptleri varsa test/compile smoke çalışır.

### 1.5 B-2 Web typecheck düzeltmesi

Hedef dosya:

```text
apps/web/src/lib/debug-view/filter-interactions.test.ts
```

Beklenen hata:

```text
Type 'InteractionEvent | undefined' is not assignable to type 'InteractionEvent'
```

Kurallar:

- Test intent korunur.
- Guard veya explicit expectation ile `noUncheckedIndexedAccess` uyumlu hale getirilir.
- Testi gevşetmek için `as any` kullanılmaz.

Acceptance:

- `pnpm --filter @nesy/web typecheck` yeşil.
- `pnpm --filter @nesy/web test -- src/lib/debug-view/filter-interactions.test.ts`
  veya uygun web test komutu yeşil.

### 1.6 Repo-level typecheck gate

Komut:

```bash
pnpm typecheck
```

Acceptance:

- Repo-level typecheck yeşil.
- Eğer yeni hata çıkarsa Phase 1 RESULT içinde yeni blocker olarak sınıflandırılır.

### 1.7 B-3 CI typecheck/test/lint gate

Hedef:

Cockpit CI'da en az şu job'lar olmalı:

```text
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm lint
```

Mevcut Phase 0 bulgusu:

- `.github/workflows/` altında sadece `contract-fixtures.yml` vardı.
- Genel typecheck/test/lint CI gate'i yoktu.

Beklenen dosya:

```text
.github/workflows/cockpit-ci.yml
```

Acceptance:

- Workflow pnpm 9.15.4 ile uyumlu.
- Node >=20 kullanır.
- Typecheck/test/lint ayrı step olarak görünür.
- Lint script yoksa ya eklenir ya da job açıklamasıyla fail/skip policy net yazılır.
- CI job PostgreSQL integration ile karıştırılmaz; PostgreSQL job ayrı veya ayrı step
  olarak açık seçilir.

### 1.8 B-4 PostgreSQL integration CI job

Hedef:

Gerçek PostgreSQL ile env-gated ingest integration testlerini CI'da çalıştırmak.

Beklenen environment:

```text
DATABASE_URL=postgresql://...
VERDICT_DB_IT=1
```

Beklenen servis:

```text
postgres:16
```

Acceptance:

- PostgreSQL service healthcheck var.
- Prisma migration deploy veya test DB hazırlığı açık.
- `verdict-ingest.integration.test.ts` ve `test-event-ws-server.integration.test.ts`
  artık CI'da skipped kalmayacak şekilde hedeflenir.
- Job default unit testlerle karıştırılıyorsa RESULT.md içinde risk yazılır.

### 1.9 B-5 contract fixture CI gap opsiyonel düzeltme

Bu adım Phase 1 için opsiyoneldir. B-1/B-4 tamamlanmadan yapılmaz.

Phase 0 gap'leri:

- contract job nötr repo `workflow_call` kullanmıyor.
- `PEER_LOCK_TOKEN` permission açıklaması plan tablosuyla drift taşıyor.

Acceptance:

- Ya minimal dokümantasyon/yorum düzeltmesi yapılır.
- Ya da `DEFERRED_TO_PHASE_1B` olarak RESULT.md'ye yazılır.

### 1.10 Test regression

Komutlar:

```bash
pnpm test
pnpm --filter @nesy/api test
pnpm --filter @nesy/web test
```

Acceptance:

- Testler yeşil.
- Skipped test sayısı Phase 0'a göre açıklanır.
- Typecheck düzeltmesi testleri kırmadı.

### 1.11 Final verification

Komutlar:

```bash
pnpm verdict:verify-master-plan
pnpm typecheck
pnpm test
git diff --check
git status --short
```

Acceptance:

- Master digest değişmedi.
- Typecheck yeşil.
- Test yeşil.
- Diff check temiz.
- Değişen dosyalar Phase 1 owned paths içinde.

## 8. Phase 1 completion gate

Phase 1 `COMPLETED` olabilmesi için:

- `@nesy/api typecheck` yeşil.
- `@nesy/web typecheck` yeşil.
- `pnpm typecheck` yeşil.
- `pnpm test` yeşil.
- CI typecheck/test/lint gate'i mevcut.
- PostgreSQL integration CI job'ı mevcut veya açık fail-closed blocker olarak yazılmış.
- RESULT.md B-1/B-4 durumlarını kapatmış veya owner/blocker ile netleştirmiş.
- Phase 2 readiness kararı verilmiş.

## 9. Phase 1 semantic AI prompt

```text
Sen Verdict Cockpit Phase 1 — CP0 Blocker Cleanup ve CI Gate üzerinde çalışan dikkatli
bir software engineering agent'sın.

Ana görevin yeni SDK/Bridge/Cockpit feature geliştirmek değil; Phase 0'da bulunan
typecheck ve CI blocker'larını kapatmak, repo baseline'ını sonraki fazlar için güvenilir
hale getirmek.

Önce şu dosyaları oku:

1. docs/verdict/run-playbooks/README.md
2. docs/verdict/run-playbooks/phase-0/RESULT.md
3. docs/verdict/run-playbooks/phase-1/RUN_PLAY.md
4. docs/verdict/run-playbooks/phase-1/RESULT.md
5. package.json
6. pnpm-workspace.yaml
7. turbo.json
8. apps/api/tsconfig.json
9. apps/web/tsconfig.json

Başlamadan önce şu komutları çalıştır:

- pnpm verdict:verify-master-plan
- git status --short
- git branch --show-current
- git rev-parse --show-toplevel

Kurallar:

- Master plan digest doğrulanmadan edit yapma.
- Phase 0 RESULT.md içindeki B-1, B-2, B-3, B-4 dışına çıkma.
- SDK mutual-HMAC, durable event, Bridge host client, WorkflowIR v2 veya Domain Pack
  implementasyonu yapma.
- Maestro/YAML referanslarını silme.
- Dependency upgrade yapma.
- `as any` veya typecheck'i susturan kaba cast kullanma.
- Root cause import path ise import path'i düzelt; tsconfig rootDir'i büyüterek
  sorunu saklama.
- Typecheck yeşile dönerken testleri kırma.
- CI job eklerken secret veya production credential yazma.
- PostgreSQL integration job'ında gerçek token/secret kullanma; yalnız test DB service
  ve env kullan.

Öncelik sırası:

1. B-1/C-1 API rootDir import ihlali.
2. B-1/C-2 çift nominal Secret; C-1 sonrası kalırsa ayrıca düzelt.
3. B-1/C-3 API strict index/narrowing.
4. B-2 Web strict index test hatası.
5. Repo-level pnpm typecheck.
6. B-3 CI typecheck/test/lint gate.
7. B-4 PostgreSQL integration CI job.
8. pnpm test regression.
9. RESULT.md ve RUN_PLAY recovery update.

Başarı kriteri:

- pnpm --filter @nesy/api typecheck yeşil.
- pnpm --filter @nesy/web typecheck yeşil.
- pnpm typecheck yeşil.
- pnpm test yeşil.
- CI gate dosyası eklenmiş veya net blocker olarak yazılmış.
- PostgreSQL integration job eklenmiş veya net blocker olarak yazılmış.
- RESULT.md güncellenmiş.

Yanlış başarı kriterleri:

- Typecheck'i `skipLibCheck`, `noEmit`, `rootDir` genişletme veya `as any` ile
  susturmak.
- Testi silmek veya assertion'ı anlamsızlaştırmak.
- apps/api production service davranışını spike typecheck'i için bozmak.
- Phase 1'i SDK runtime implementation fazına çevirmek.
```
