# Phase 0 RUN_PLAY — Doğrulanabilir Baseline ve SSOT

```yaml
runPlayId: verdict-cockpit-phase-0-run-play
phase: 0
phaseName: "Doğrulanabilir Baseline ve SSOT"
status: COMPLETED
recoveryState: COMPLETED
createdAt: "2026-08-04 21:54:00 +03"
startedAt: "2026-08-04 21:57:00 +03"
completedAt: "2026-08-04 22:06:00 +03"
lastUpdatedAt: "2026-08-04 22:06:00 +03"
timezone: "Europe/Istanbul"
masterPlanPath: "docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md"
masterPlanVersion: "v1.1.2"
masterPlanDigest: "sha256:5e7deff018a61b71eb215d2406615dae3304fb63080005e1130297401f15fa01"
verifyMasterPlanCommand: "pnpm verdict:verify-master-plan"
resultFile: "docs/verdict/run-playbooks/phase-0/RESULT.md"
```

## 1. Amaç

Phase 0'ın amacı yeni SDK/Bridge/Cockpit runtime geliştirmesine başlamadan önce repo,
CI, SSOT, fixture, typecheck, test ve mevcut durum baseline'ını güvenilir hale
getirmektir.

Bu fazda hedef “yeni özellik geliştirmek” değildir. Hedef, sonraki fazlarda yapılacak
güvenlik, durable event, Bridge client, WorkflowIR v2 ve Cockpit UI cutover işlerinin
başarı/başarısızlık sinyalini mevcut borçtan ayırabilecek sağlam ölçüm zemini
kurmaktır.

Phase 0 tamamlanmadan şu işler `DONE` sayılamaz:

- production mutual-HMAC SDK socket işi
- durable event consumer cutover
- Bridge host client/device gate
- WorkflowIR v2 production merge
- Domain Pack production implementation
- BridgeFlowCompiler/Executor
- Maestro cutover veya removal

## 2. Recovery state

Bu dosya fazın nerede kaldığını tutar. Bir agent devam edeceği zaman önce bu tabloyu
okumalıdır.

| Alan | Değer |
|---|---|
| Current phase | `0` |
| Current step | `0.14` (bitti) |
| Current state | `COMPLETED` |
| Last successful step | `0.14` |
| Last attempted step | `0.14` |
| Last update | `2026-08-04 22:06:00 +03` |
| Recovery instruction | `Phase 0 baseline tamamlandı; sonuç ve blocker'lar RESULT.md içinde. Bu repoda Phase 0 adına yapılacak iş kalmadı. Sıradaki iş phase-1/RUN_PLAY.md oluşturmak; ilk üç step B-1/B-2/B-3 (api typecheck, web typecheck, CI gate) olmalı. Phase 1 readiness: READY_WITH_BLOCKERS.` |

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

Bir agent çalışmayı yarıda bırakırsa:

1. `Current step` güncellenir.
2. `Last successful step` güncellenir.
3. `Last attempted step` güncellenir.
4. `lastUpdatedAt` güncellenir.
5. `RESULT.md` içine ara durum yazılır.

## 3. Phase 0 kapsamı

Phase 0 aşağıdaki işleri kapsar:

1. Master plan digest doğrulaması.
2. Git/worktree baseline.
3. Node/pnpm/turbo/env baseline.
4. Package install/lockfile health kontrolü.
5. Repo-level typecheck baseline.
6. API typecheck baseline.
7. Web typecheck baseline.
8. Unit/integration test envanteri.
9. Gerçek PostgreSQL integration ihtiyacı ve CI job taslağı.
10. Mobile SSOT dosyasının okunması ve Cockpit planıyla uyuşmazlıkların listelenmesi.
11. Mevcut Cockpit route/page/data-source envanteri.
12. Mevcut Maestro/YAML/legacy automation referanslarının baseline listesi.
13. Golden workflow/input/evidence fixture ihtiyaçlarının çıkarılması.
14. Performans baseline ölçüm alanlarının belirlenmesi.
15. Phase 1'e geçiş için blocker/ready kararının yazılması.

## 4. Kapsam dışı

Phase 0'da aşağıdakiler yapılmaz:

- SDK mutual-HMAC implementasyonu.
- Durable event consumer implementasyonu.
- Bridge host client implementasyonu.
- WorkflowIR v2 schema değişikliği.
- Domain Pack üretimi.
- App Adapter refactor.
- Cockpit UI route migration.
- Maestro removal.
- Production DB migration.
- Gerçek cihaz üzerinde action lifecycle implementasyonu.

Phase 0 sırasında zorunlu olmayan büyük refactor yapılmaz. Bulunan eksikler result
dosyasına yazılır ve uygun faza aktarılır.

## 5. Owned paths

Phase 0 agent'ı aşağıdaki dosya ve klasörlerde değişiklik yapabilir:

```text
docs/verdict/run-playbooks/phase-0/RUN_PLAY.md
docs/verdict/run-playbooks/phase-0/RESULT.md
docs/verdict/run-playbooks/README.md
scripts/verify-master-plan.mjs
package.json
```

Şu dosyalar yalnız gerçekten Phase 0 acceptance için gerekiyorsa değiştirilebilir:

```text
scripts/check-fixture-lock.mjs
scripts/check-fixture-lock.test.mjs
contract-fixtures.lock
verdict-contract-fixtures/**
docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md
```

Şu alanlar Phase 0'da varsayılan olarak read-only kabul edilir:

```text
apps/api/**
apps/web/**
packages/**
packages/db/**
domain-packs/**
```

Bu read-only alanlarda değişiklik gerekiyorsa agent önce `RESULT.md` içinde gerekçe,
risk ve alternatifleri yazmalıdır.

## 6. Read-only context paths

Phase 0 agent'ı başlamadan önce şu kaynakları okumalıdır:

```text
docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md
docs/verdict/run-playbooks/README.md
docs/verdict/run-playbooks/phase-0/RUN_PLAY.md
docs/verdict/run-playbooks/phase-0/RESULT.md
package.json
pnpm-workspace.yaml
turbo.json
contract-fixtures.lock
```

Mobile SSOT için beklenen kaynak:

```text
/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-status.json
```

Dosya yoksa bu durum Phase 0 blocker veya gap olarak yazılır; dosya uydurulmaz.

## 7. Expected file changes

Phase 0 sırasında beklenen değişiklikler:

| Dosya | Değişiklik tipi | Gerekçe |
|---|---|---|
| `docs/verdict/run-playbooks/phase-0/RUN_PLAY.md` | update | recovery state ve last update güncellemesi |
| `docs/verdict/run-playbooks/phase-0/RESULT.md` | update | faz sonucu ve evidence kaydı |
| `package.json` | optional | baseline/doğrulama script eksikse script ekleme |
| `scripts/*.mjs` | optional | Phase 0 doğrulama veya envanter script'i gerekirse |
| `contract-fixtures.lock` | optional | fixture lock doğrulama baseline'ı gerekirse |

Phase 0 sonunda beklenen ana çıktı `RESULT.md` dosyasıdır. Kod değişikliği varsa
kanıtı ve gerekçesi result dosyasında açık olmalıdır.

## 8. Step checklist

### 0.1 Master plan doğrulaması

Komut:

```bash
pnpm verdict:verify-master-plan
```

Acceptance:

- Komut başarılı.
- Digest `RUN_PLAY.md` içindeki digest ile aynı.
- Başarısızsa Phase 0 `BLOCKED` olur; master plan altında sessiz çalışma yapılmaz.

### 0.2 Git/worktree baseline

Komutlar:

```bash
git status --short
git branch --show-current
git rev-parse --show-toplevel
```

Acceptance:

- Dirty worktree açıkça listelenir.
- User'a ait mevcut değişiklikler korunur.
- Phase 0 agent'ı kendi değişikliklerini unrelated değişikliklerle karıştırmaz.

### 0.3 Runtime/tooling baseline

Komutlar:

```bash
node --version
pnpm --version
pnpm exec turbo --version
```

Acceptance:

- Sürümler `RESULT.md` içine yazılır.
- Eksik komut varsa blocker olarak yazılır.

### 0.4 Workspace ve dependency baseline

Komutlar:

```bash
pnpm install --frozen-lockfile
pnpm list --depth 0
```

Acceptance:

- Lockfile drift varsa result'a yazılır.
- Otomatik dependency upgrade yapılmaz.

### 0.5 Repo-level typecheck

Komut:

```bash
pnpm typecheck
```

Acceptance:

- Yeşilse evidence yazılır.
- Kırmızıysa hata özeti, paket, dosya ve owner adayı yazılır.
- Kırmızı typecheck Phase 0 failure değildir; baseline tespiti olabilir. Ancak CP0
  tamamlandı sayılamaz.

### 0.6 API/Web typecheck ayrımı

Komutlar:

```bash
pnpm --filter @nesy/api typecheck
pnpm --filter @nesy/web typecheck
```

Acceptance:

- API ve Web ayrı raporlanır.
- Tek repo-level hata altında gömülmez.

### 0.7 Test baseline

Komutlar:

```bash
pnpm test
pnpm --filter @nesy/api test
pnpm --filter @nesy/web test
```

Acceptance:

- Unit, integration, skipped, opt-in testler ayrı listelenir.
- Flaky veya environment-dependent test varsa result'a yazılır.

### 0.8 Gerçek PostgreSQL integration baseline

Kontrol:

- Mevcut CI workflow var mı?
- Gerçek PostgreSQL ile ingest integration koşuyor mu?
- Test SQLite/mock/opt-in ile mi geçiyor?

Beklenen olası dosyalar:

```text
.github/workflows/**
apps/api/**
packages/db/**
```

Phase 0'da bu dosyalara edit gerekiyorsa önce result'a plan yazılır. Büyük migration
yapılmaz.

Acceptance:

- PostgreSQL integration job durumu `PRESENT`, `MISSING`, `OPTIONAL`, `BROKEN` olarak
  yazılır.

### 0.9 Mobile SSOT baseline

Kaynak:

```text
/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-status.json
```

Acceptance:

- Dosya okunur.
- Cockpit master planındaki current-state iddialarıyla çelişki varsa listelenir.
- Dosya yoksa veya parse edilemiyorsa uydurma status yazılmaz.

### 0.10 Cockpit route/page/data-source baseline

Kontrol alanları:

```text
apps/web/src/app/**
apps/web/src/config/**
packages/metronic/**
```

Acceptance:

- Mevcut workspace/route listesi çıkarılır.
- Placeholder, broken route, redirect, dynamic route ve auth/RBAC durumu ayrılır.
- H.5 route matrisiyle gap listesi result'a yazılır.

### 0.11 Maestro/YAML/legacy automation reference baseline

Komut örnekleri:

```bash
rg -n "maestro|yamlContent|maestroOutput|Maestro|YAML" apps packages docs scripts
```

Acceptance:

- Referanslar silinmez.
- Söküm listesi Phase 9'a evidence olarak hazırlanır.
- Runtime-critical legacy alanlar ayrı işaretlenir.

### 0.12 Golden fixture ve evidence fixture baseline

Kontrol:

```text
contract-fixtures.lock
verdict-contract-fixtures/**
```

Acceptance:

- Golden workflow/input/evidence fixture ihtiyacı listelenir.
- Eksik fixture varsa `MISSING_FIXTURE` olarak result'a yazılır.

### 0.13 Performance baseline alanları

Phase 0'da gerçek benchmark koşmak zorunlu olmayabilir; ancak ölçüm alanları net
olmalıdır:

- WS ingest/ACK latency
- commit→receipt latency
- commit→ordered-consumer latency
- Bridge observation latency
- Bridge mutation latency
- wait/cancel latency
- scoped dump maliyeti
- workflow duration

Acceptance:

- Ölçüm script'i varsa listelenir.
- Yoksa `MISSING_PERFORMANCE_BASELINE_SCRIPT` olarak yazılır.

### 0.14 Result ve handoff

Phase sonunda:

1. `RESULT.md` doldurulur.
2. Phase state `COMPLETED`, `BLOCKED` veya `FAILED` yapılır.
3. Sonraki faz için net handoff yazılır.
4. Faz tamamlanmadıysa “kalan en küçük iş” belirtilir.

## 9. Verification commands

Minimum doğrulama:

```bash
pnpm verdict:verify-master-plan
git diff --check -- docs/verdict/run-playbooks/phase-0/RUN_PLAY.md docs/verdict/run-playbooks/phase-0/RESULT.md docs/verdict/run-playbooks/README.md
```

Kapsamlı Phase 0 doğrulama:

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm --filter @nesy/api typecheck
pnpm --filter @nesy/web typecheck
pnpm test
```

Bu komutların kırmızı olması dosyaları sessizce düzeltme yetkisi vermez. Önce result'a
kanıt ve sınıflandırma yazılır.

## 10. AI agent çalışma prompt'u

Aşağıdaki prompt Phase 0 üzerinde çalışacak AI agent'a doğrudan verilebilir.

```text
Sen Verdict Cockpit master planının Phase 0 — Doğrulanabilir Baseline ve SSOT fazını
işleten dikkatli bir software engineering agent'sın.

Ana görevin yeni feature geliştirmek değil; repo, CI, typecheck, test, fixture,
Mobile SSOT, route inventory ve legacy Maestro baseline'ını kanıtlı şekilde çıkarmak.

Önce şu dosyaları oku:

1. docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md
2. docs/verdict/run-playbooks/README.md
3. docs/verdict/run-playbooks/phase-0/RUN_PLAY.md
4. docs/verdict/run-playbooks/phase-0/RESULT.md
5. package.json
6. pnpm-workspace.yaml
7. turbo.json
8. contract-fixtures.lock

Başlamadan önce şu komutları çalıştır:

- pnpm verdict:verify-master-plan
- git status --short
- git branch --show-current
- git rev-parse --show-toplevel

Kurallar:

- Master plan digest doğrulanmadan hiçbir Phase 0 sonucu yazma.
- Dirty worktree varsa kullanıcıya ait değişiklikleri koru; unrelated dosyalara dokunma.
- Phase 0 kapsamında SDK, Bridge, WorkflowIR, Domain Pack veya Cockpit UI feature
  implementasyonu yapma.
- Büyük refactor yapma.
- Typecheck veya test kırmızıysa hemen düzeltmeye atlama; önce RESULT.md içine
  hatayı, paketi, dosyayı, sınıflandırmayı ve önerilen owner'ı yaz.
- apps/api, apps/web, packages ve packages/db varsayılan read-only kabul edilir.
  Bu alanlarda edit gerekiyorsa önce RESULT.md içinde gerekçe yaz.
- Maestro/YAML referanslarını Phase 0'da silme. Sadece baseline inventory çıkar.
- Mobile SSOT dosyası yoksa veya parse edilemiyorsa status uydurma; blocker/gap yaz.
- Phase 0 acceptance kanıtı olmadan Phase 1'e geçildiğini söyleme.

Çalışma sırası:

1. RUN_PLAY recovery state'i oku.
2. Master plan digest doğrula.
3. Git/worktree baseline al.
4. Runtime/tooling version baseline al.
5. Dependency/lockfile health kontrol et.
6. Repo-level typecheck çalıştır.
7. API ve Web typecheck'i ayrı çalıştır.
8. Test baseline'ı çıkar.
9. PostgreSQL integration job durumunu incele.
10. Mobile SSOT verdict-status.json dosyasını oku ve Cockpit planıyla gap çıkar.
11. Cockpit route/page/data-source inventory çıkar.
12. Maestro/YAML/legacy automation referanslarını listele.
13. Golden fixture/evidence fixture durumunu çıkar.
14. Performance baseline script/ölçüm alanlarını çıkar.
15. RESULT.md dosyasını doldur.

RESULT.md içinde şu başlıkları kesin doldur:

- Executive result
- Phase state
- Start/completion timestamps
- Commands executed
- Changed files
- Typecheck result
- Test result
- PostgreSQL integration status
- Mobile SSOT status
- Route/page inventory status
- Maestro/YAML legacy baseline
- Fixture baseline
- Performance baseline
- Blockers
- Deferred work
- Phase 1 readiness decision

Başarı kriteri:

Phase 0 ancak baseline sonuçları kanıtla yazıldıysa, master digest doğrulandıysa,
dirty worktree ayrıştırıldıysa, typecheck/test/CI/SSOT/route/legacy/fixture/performance
durumu açıkça raporlandıysa tamamlandı sayılır.

Yanlış başarı kriterleri:

- Sadece birkaç komut koşup yeşil demek.
- Typecheck kırmızı iken bunu gizlemek.
- Mobile SSOT okumadan Cockpit durumunu varsaymak.
- Maestro referanslarını silip Phase 9 işini erkene almak.
- apps/api veya apps/web altında büyük refactor yaparak Phase 0'ı implementation fazına
  çevirmek.

Çalışmayı bitirdiğinde RESULT.md'yi güncelle, RUN_PLAY recovery state'ini son duruma
çek ve hangi faz/adımda kalındığını açık yaz.
```

## 11. Phase 0 completion gate

Phase 0 `COMPLETED` olabilmesi için:

- Master plan digest doğrulanmış olmalı.
- Git/worktree baseline yazılmış olmalı.
- Tooling version baseline yazılmış olmalı.
- Repo/API/Web typecheck sonucu yazılmış olmalı.
- Test baseline sonucu yazılmış olmalı.
- PostgreSQL integration durumu yazılmış olmalı.
- Mobile SSOT durumu yazılmış olmalı.
- Cockpit route/page/data-source baseline yazılmış olmalı.
- Maestro/YAML legacy reference baseline yazılmış olmalı.
- Fixture ve performance baseline gap'leri yazılmış olmalı.
- Phase 1 için `READY`, `READY_WITH_BLOCKERS` veya `NOT_READY` kararı verilmiş olmalı.

