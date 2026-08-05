# Phase 2 RUN_PLAY — Durable Event Runtime ve Host waitEvent

```yaml
runPlayId: verdict-cockpit-phase-2-run-play
phase: 2
phaseName: "Durable Event Runtime ve Host waitEvent"
status: COMPLETED
recoveryState: COMPLETED
createdAt: "2026-08-04 23:31:40 +03"
startedAt: "2026-08-05 00:05:00 +03"
completedAt: "2026-08-05 06:20:00 +03"
lastUpdatedAt: "2026-08-05 06:20:00 +03"
timezone: "Europe/Istanbul"
masterPlanPath: "docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md"
masterPlanVersion: "v1.1.2"
masterPlanDigest: "sha256:5e7deff018a61b71eb215d2406615dae3304fb63080005e1130297401f15fa01"
verifyMasterPlanCommand: "pnpm verdict:verify-master-plan"
previousPhaseResult: "docs/verdict/run-playbooks/phase-1/RESULT.md"
resultFile: "docs/verdict/run-playbooks/phase-2/RESULT.md"
phase1Readiness: "READY_WITH_BLOCKERS"
phase2Readiness: "NOT_EVALUATED"
blockingPreflight:
  - id: "B-4"
    status: "IMPLEMENTED_UNVERIFIED"
    meaning: "PostgreSQL integration CI job yazıldı ama gerçek CI koşusunda henüz kanıtlanmadı."
  - id: "B-8"
    status: "OPEN_NON_BLOCKING"
    meaning: "Repo-wide lint hâlâ ESLint v9 flat-config borcu nedeniyle blocking gate değil."
```

## 1. Şu an hangi kısımdayız?

Phase 0 baseline alındı. Phase 1 review edildi ve kabul edilebilir şekilde kapandı:

```text
Phase 0: COMPLETED / READY_WITH_BLOCKERS
Phase 1: COMPLETED / REVIEW_PASS
Current: Phase 2 hazırlığı
Next executable phase: Phase 2 — Durable Event Runtime ve Host waitEvent
```

Phase 2'ye geçilebilir. Ancak Phase 2'ye başlayan agent ilk iş olarak Phase 1'den
devreden B-4 durumunu doğrulamalıdır. B-4, local geliştirmeyi tamamen durdurmaz; fakat
durable runtime kabul kriterlerinin gerçek PostgreSQL üzerinde kanıtlanması gerektiği
için Phase 2 kapanışında `IMPLEMENTED_UNVERIFIED` olarak kalamaz.

Bu faz SDK mutual-HMAC implementasyonu değildir. Bu faz Bridge host client fazı da
değildir. Phase 2'nin merkezi Cockpit/API tarafındaki durable event delivery runtime,
subscriber API, host `waitEvent`, restart recovery, poison/lag görünürlüğü ve
synchronous sink cutover hazırlığıdır.

## 2. Amaç

Phase 2'nin amacı, host tarafından durable kabul edilmiş bir SDK event'inin process
restart, consumer crash, duplicate delivery, gap, poison row ve subscriber cancel
senaryolarında kaybolmadan doğru kanıt hattına ulaşmasını sağlamaktır.

Master planın bu fazdaki ana ayrımı:

```text
DurableReceiptBus
  → commit edilmiş inbox row üzerinden düşük gecikmeli readiness / Continue Gate

OrderedEvidenceBus
  → contiguous sıra, idempotent reducer, Final Oracle, audit, replay ve diagnostics
```

Bu iki lane aynı şey değildir. Receipt lane, commit edilmiş event'i gap arkasında
bekletmeden readiness için görünür kılar. Ordered lane ise sıra, gap, poison ve audit
doğruluğunu korur.

Phase 2 sonunda executor ve sonraki fazlar şuna güvenebilmelidir:

```text
SDK event emitted
  → host inbox commit
  → ACK only after commit
  → receipt-safe subscriber can wake Continue Gate
  → ordered subscriber can drive Oracle/audit/replay
  → process restart does not lose committed evidence
  → sync sink no longer required as primary production path
```

## 3. Neden bu sırada?

BridgeFlowExecutor ve WorkflowIR v2 ileride event bekleyecek. Event bekleme hâlâ
synchronous sink'e, process ömrüne veya in-memory callback'e bağlıysa:

- login sonrası route readiness kaybolabilir,
- app event geldiği halde workflow timeout olabilir,
- process restart sonrası Oracle eksik evidence ile hüküm verebilir,
- duplicate/replay iki ayrı logical fact üretebilir,
- ordered gap bütün readiness akışını gereksiz bloke edebilir,
- “event görünmedi” hatası kanıtsız şekilde SDK failure diye etiketlenebilir.

Bu yüzden Phase 2, Bridge Host Client ve WorkflowIR production cutover'dan önce gelir.

## 4. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `2` |
| Current step | `2.11` (bitti) |
| Current state | `COMPLETED` |
| Last successful step | `2.11` |
| Last attempted step | `2.11` |
| Last update | `2026-08-05 06:20:00 +03` |
| Recovery instruction | `Phase 2 KAPANDI. Unit 202 passed / 38 skipped; integration 37/37 gerçek postgres:16 üzerinde yeşil, 0 skip, 5 ardışık sıralı koşu kararlı. 18/18 acceptance PASS. Açık iş Phase 2'nin ürünü değil: B-10 migration geçmişi eksik (22 tablodan 13'ü hiçbir migration'da yok) → CI integration job'ı yeşile dönemez; release gate öncesi baseline migration ile kapatılmalı. Detay RESULT.md §13/§16.` |

Step sonuçları başlangıçta:

| Step | Sonuç |
|---|---|
| 2.0 Playbook oluşturma | `DONE` — dosya hazır |
| 2.1 Preflight ve inherited blocker check | `DONE` |
| 2.2 Existing durable ingest/fan-out baseline | `DONE` |
| 2.3 Contract ve DB model gap analysis | `DONE` |
| 2.4 DurableReceiptBus contract/runtime | `DONE` |
| 2.5 OrderedEvidenceBus contract/runtime | `DONE` |
| 2.6 waitEvent API/filter/cancel/timeout | `DONE` |
| 2.7 Restart/resume bootstrap scanner | `DONE` |
| 2.8 Poison/dead-letter/retry/lag/metrics | `DONE` |
| 2.9 Sync-vs-durable comparison mode | `DONE` |
| 2.10 Integration and regression tests | `DONE` — unit yeşil, PostgreSQL suite 37/37 yeşil |
| 2.11 Documentation/result/handoff | `DONE` |

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

1. Bu dosyada `Current step`, `Last successful step`, `Last attempted step` ve
   `lastUpdatedAt` güncellenir.
2. `RESULT.md` içine ara durum, komut çıktıları ve recovery instruction yazılır.
3. Eğer DB migration veya runtime davranışı değiştiyse rollback/replay notu açıkça
   yazılır.
4. Owned paths dışına çıkıldıysa neden ve kapsam `RESULT.md` içinde kanıtlanır.

## 5. Phase 2 scope

Phase 2 şunları kapsar:

1. Phase 1 RESULT ve B-4/B-8 durumunu doğrulama.
2. Master plan digest doğrulama.
3. Mevcut durable ingest, inbox, stream, fan-out, cp2 spike dosyalarını envanterleme.
4. `DurableReceiptBus` ve `OrderedEvidenceBus` contract ayrımını kod seviyesinde
   kurma.
5. Receipt lane'i committed immutable inbox row identity/cursor üzerinden çalıştırma.
6. Ordered lane'i contiguous stream semantics ve idempotent processing ile çalıştırma.
7. `waitEvent` API'sinde lane enforcement, filter, cancel, timeout ve recovery
   davranışını kurma.
8. Process restart bootstrap scan ve committed-but-undispatched row recovery.
9. Duplicate/replay idempotency.
10. Burst tail, nudge coalescing ve subscriber leak testleri.
11. Poison row, retry/dead-letter, last error, attempt ve lag visibility.
12. Closed-run late event policy.
13. Sync-vs-durable comparison mode.
14. Golden equality raporu: sync sink ile durable bus aynı logical evidence sonucunu
    üretmeli.
15. Synchronous oracle yolunu production primary path olmaktan çıkaracak feature flag
    ve rollback notu.
16. SDK `EmitOutcome` diagnostic için recursive event üretmeyen bounded query yüzeyi
    tasarımını veya minimum host adapter sözleşmesini netleştirme.
17. Typecheck/test/integration regression.

## 6. Kapsam dışı

Phase 2'de aşağıdakiler yapılmaz:

- Bridge Host Client implementasyonu.
- Accessibility Bridge protocol v1 runtime değişikliği.
- WorkflowIR v2 production schema merge.
- Domain Pack contract/runtime üretimi.
- Cockpit UI route migration.
- Maestro/YAML sökümü.
- Mobile SDK mutual-HMAC production implementation.
- Mobile repo içinde business adapter değişikliği.
- Large-scale test campaign scheduler.
- Evidence Journey full UI drawer.
- Pricing, LTV, investor narrative veya commercial validation işi.

Not: SDK diagnostic query için shared contract veya host adapter gerekirse minimal ve
bounded eklenebilir. Fakat Phase 2, Mobile SDK içine büyük business event reducer
gömme fazı değildir.

## 7. Owned paths

Phase 2 agent'ı aşağıdaki alanlarda değişiklik yapabilir:

```text
docs/verdict/run-playbooks/phase-2/RUN_PLAY.md
docs/verdict/run-playbooks/phase-2/RESULT.md
apps/api/src/services/verdict-ingest.ts
apps/api/src/services/verdict-fanout.ts
apps/api/src/services/verdict-contiguous.ts
apps/api/src/services/verdict-stream-order.ts
apps/api/src/services/test-event-ws-server.ts
apps/api/src/services/verdict-ingest.integration.test.ts
apps/api/src/services/test-event-ws-server.integration.test.ts
apps/api/src/cp2-*.ts
apps/api/src/routes/**
apps/api/src/lib/**
apps/api/src/types/**
packages/db/prisma/schema.prisma
packages/db/prisma/migrations/**
packages/control-contract/src/**
packages/control-contract/package.json
.github/workflows/**
```

Gerekirse yeni API service/test dosyaları şu namespace'lerde oluşturulabilir:

```text
apps/api/src/services/verdict-receipt-bus.ts
apps/api/src/services/verdict-ordered-evidence-bus.ts
apps/api/src/services/verdict-wait-event.ts
apps/api/src/services/verdict-durable-runtime.ts
apps/api/src/services/verdict-durable-runtime.test.ts
apps/api/src/services/verdict-durable-runtime.integration.test.ts
apps/api/src/routes/verdict-events.routes.ts
```

Yeni shared contract gerekiyorsa önce mevcut `packages/control-contract` export
yapısı incelenir. Contract sadece domain-neutral event delivery, lane, cursor,
waitEvent ve diagnostic outcome tiplerini taşımalıdır. `STOP`, `PARCEL`, `MATCH`,
`BETTING`, `COURIER_LOGIN`, `OPEN_STOP` gibi domain kavramları Phase 2 contract'ına
giremez.

## 8. Read-only context paths

Başlamadan önce okunacak dosyalar:

```text
docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md
docs/verdict/run-playbooks/README.md
docs/verdict/run-playbooks/phase-0/RESULT.md
docs/verdict/run-playbooks/phase-1/RUN_PLAY.md
docs/verdict/run-playbooks/phase-1/RESULT.md
docs/verdict/run-playbooks/phase-2/RUN_PLAY.md
docs/verdict/run-playbooks/phase-2/RESULT.md
package.json
pnpm-workspace.yaml
turbo.json
apps/api/package.json
apps/api/tsconfig.json
packages/db/prisma/schema.prisma
packages/control-contract/package.json
packages/control-contract/src/**
.github/workflows/**
```

Mobile SSOT read-only kontrol:

```text
/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-status.json
```

## 9. Ön koşullar

Phase 2 başlamadan önce:

1. `pnpm verdict:verify-master-plan` PASS olmalı.
2. `pnpm typecheck` PASS olmalı.
3. `pnpm test` PASS olmalı.
4. Phase 1 RESULT, B-1/B-2/B-3 için CLOSED veya eşdeğer kanıt taşımalı.
5. B-4 durumu kontrol edilmeli:
   - Eğer ilk CI integration job yeşil koştuysa `CLOSED` yaz.
   - Koşmadıysa `IMPLEMENTED_UNVERIFIED` olarak bırak ama Phase 2 kapanış blocker'ı
     olarak işaretle.
   - Kırmızı koştuysa Phase 2'nin ilk işi integration job'ı gerçek PostgreSQL üzerinde
     düzeltmek olmalı.
6. Worktree'de kullanıcıya ait unrelated değişiklik varsa dokunulmaz.

## 10. Work package sırası

### 2.1 Preflight ve inherited blocker check

Komutlar:

```bash
pnpm verdict:verify-master-plan
git status --short
git branch --show-current
pnpm typecheck
pnpm test
```

Kontrol:

```bash
gh run list --workflow cockpit-ci.yml --limit 5
```

`gh` yoksa veya GitHub erişimi yoksa bunu blocker değil, `UNVERIFIED_EXTERNAL` olarak
RESULT'a yaz.

Acceptance:

- Master digest doğru.
- Phase 1 RESULT okunmuş.
- B-4/B-8 güncel durum yazılmış.
- Phase 2 RESULT `IN_PROGRESS` olarak güncellenmiş.

### 2.2 Existing durable ingest/fan-out baseline

Okunacak ana dosyalar:

```text
apps/api/src/services/verdict-ingest.ts
apps/api/src/services/verdict-fanout.ts
apps/api/src/services/verdict-contiguous.ts
apps/api/src/services/verdict-stream-order.ts
apps/api/src/services/test-event-ws-server.ts
apps/api/src/cp2-*.ts
packages/db/prisma/schema.prisma
packages/db/prisma/migrations/20260727210000_add_verdict_ingest/migration.sql
```

Amaç:

- Mevcut inbox/stream/processed_at yapısını dokümante et.
- Hangi davranışın production-ready, hangisinin spike olduğunu ayır.
- Synchronous sink seam'inin nerede kullanıldığını bul.
- Consumer'ın restart-safe kabul kriterlerini karşılayıp karşılamadığını kanıtla.

Acceptance:

- RESULT içinde “existing baseline” bölümü var.
- Yeni runtime tasarımı mevcut kodu gereksiz yeniden yazmadan nereye bağlanacağını
  gösteriyor.

### 2.3 Contract ve DB model gap analysis

Kontrol edilecek kavramlar:

```text
DeliveryLane:
  - RECEIPT_SAFE
  - ORDERED_REQUIRED

Cursor:
  - runId
  - sessionId
  - inbox identity
  - seq
  - lane

Dispatch state:
  - receiptDispatchedAt
  - processedAt
  - attempt
  - lastError
  - nextRetryAt
  - deadLetteredAt / poison state
```

Acceptance:

- DB migration gerekiyorsa minimal, backwards-compatible ve testli olmalı.
- Migration gerekmiyorsa neden gerekmediği RESULT'ta yazılmalı.
- `processed_at` ordered lane için korunmalı; receipt lane için ayrı cursor/state
  gereksinimi açıkça karara bağlanmalı.

### 2.4 DurableReceiptBus contract/runtime

Amaç:

Commit edilmiş immutable inbox row'u üzerinden düşük gecikmeli, receipt-safe
subscriber hattı kurmak.

Minimum API:

```ts
type EvidenceDeliveryLane = "RECEIPT_SAFE" | "ORDERED_REQUIRED";

interface DurableReceiptBusSubscribeRequest {
  runId: string;
  sessionId?: string;
  cursor?: string;
  filter?: DurableEventFilter;
  signal?: AbortSignal;
}

interface DurableReceiptBus {
  subscribe(request: DurableReceiptBusSubscribeRequest): AsyncIterable<DurableReceipt>;
  waitEvent(request: WaitEventRequest): Promise<WaitEventResult>;
}
```

Kurallar:

- Receipt subscriber yalnız committed inbox row görür.
- Transaction içi veya commit edilmemiş event publish edilmez.
- Receipt cursor process restart sonrası resume edilebilir.
- Duplicate/replay aynı inbox identity ile idempotenttir.
- Ordered gap receipt-safe lane'i otomatik bloke etmez.
- Receipt lane, `ORDERED_REQUIRED` fact için authority olamaz.

Acceptance:

- Unit test: committed row gelir, uncommitted row gelmez.
- Unit/integration test: duplicate row tek logical receipt üretir.
- Restart/resume test: process veya bus yeniden kurulduğunda cursor'dan devam eder.
- Cancel test: subscriber leak bırakmaz.

### 2.5 OrderedEvidenceBus contract/runtime

Amaç:

Contiguous seq, gap, poison, retry ve audit doğruluğunu koruyan ordered consumer hattı.

Kurallar:

- `seq <= contiguous_seq` dışındaki event ordered lane'e geçmez.
- Gap körlemesine aşılmaz.
- Consumer callback idempotent olmalı.
- `processed_at` yalnız ordered consumer başarılı callback sonrası set edilir.
- Poison row sessizce atlanmaz.
- Retry/attempt/lastError görünür olur.
- Ordered subscriber Final Oracle, audit, replay ve diagnostics için authority'dir.

Acceptance:

- Gap test: seq boşluğu varken later seq ordered lane'e geçmez.
- Burst test: burst sonunda unprocessed tail kalmaz.
- Worker failure test: callback sonrası/öncesi crash davranışı net ve testli.
- Poison test: bad row görünür olur, cursor sessizce atlamaz.

### 2.6 Host waitEvent API/filter/cancel/timeout

Amaç:

Workflow runtime'ın process ömrüne bağlı kalmadan event bekleyebilmesi.

Minimum contract:

```ts
interface WaitEventRequest {
  runId: string;
  sessionId?: string;
  lane: "RECEIPT_SAFE" | "ORDERED_REQUIRED";
  filter: DurableEventFilter;
  timeoutMs: number;
  cursor?: string;
  correlation?: {
    occurrenceId?: string;
    entityKey?: string;
    stepKey?: string;
  };
}

type WaitEventResult =
  | { status: "MATCHED"; lane: EvidenceDeliveryLane; cursor: string; eventRef: string }
  | { status: "TIMEOUT"; lane: EvidenceDeliveryLane; cursor?: string }
  | { status: "CANCELLED"; lane: EvidenceDeliveryLane; cursor?: string }
  | { status: "CLOSED_RUN"; lane: EvidenceDeliveryLane; cursor?: string }
  | { status: "POISON_BLOCKED"; lane: "ORDERED_REQUIRED"; cursor?: string; eventRef: string };
```

Kurallar:

- `RECEIPT_SAFE` bekleme ordered gap yüzünden timeout olmamalı.
- `ORDERED_REQUIRED` bekleme receipt lane event'iyle tamamlanmamalı.
- Cancel sonrası timer/listener/lease sızıntısı kalmamalı.
- Timeout result kanıtsız failure üretmemeli.
- Closed run late event policy açık olmalı.

Acceptance:

- waitEvent matched/cancel/timeout/closed-run testleri var.
- Restart sonrası waitEvent tamamlanabiliyor veya deterministic recovery state veriyor.
- Lane enforcement testleri var.

### 2.7 Restart/resume bootstrap scanner

Amaç:

Process commit sonrası, receipt publish öncesi veya ordered callback öncesi ölürse
committed inbox row'un restart'ta tekrar bulunması.

Acceptance:

- Startup scanner pending receipt/ordered state'i buluyor.
- Idempotent; aynı row iki logical evidence üretmiyor.
- Büyük inbox'ta O(n²) davranış üretmiyor.
- Scanner health/log metric var.

### 2.8 Poison/dead-letter/retry/lag/metrics

Amaç:

Durable runtime'ın sessizce takılmasını engellemek.

Minimum görünürlük:

```text
receipt dispatch latency
ordered consumer lag
oldest unprocessed age
retry attempt count
last error
poison/dead-letter count
subscriber count
cancelled subscriber count
closed-run late event count
```

Acceptance:

- API/read model veya service-level query ile health okunabilir.
- Testlerde poison row ve retry schedule gözlenir.
- `RESULT.md` hangi endpoint/read model eklendiğini açıkça yazar.

### 2.9 Sync-vs-durable comparison mode

Amaç:

Synchronous sink ile durable path'in aynı logical evidence sonucunu ürettiğini
kanıtlamak ve sync path'i primary production yol olmaktan çıkarma kararını güvenli
hale getirmek.

Kurallar:

- Comparison mode production default davranışı değiştirmemeli.
- Equality report event identity, lane, correlation ve logical fact düzeyinde olmalı.
- Mismatch varsa sync sink kaldırılmaz.

Acceptance:

- Golden veya mevcut integration suite içinde comparison raporu var.
- Sync ve durable sonucu eşit değilse Phase 2 `COMPLETED` olamaz.

### 2.10 Integration and regression tests

Komutlar:

```bash
pnpm verdict:verify-master-plan
pnpm typecheck
pnpm test
pnpm --filter @nesy/api typecheck
pnpm --filter @nesy/api test
```

Gerçek PostgreSQL varsa:

```bash
VERDICT_DB_IT=1 pnpm --filter @nesy/api vitest run src/services/verdict-ingest.integration.test.ts src/services/test-event-ws-server.integration.test.ts
```

Acceptance:

- Typecheck green.
- Unit suite green.
- Integration suite gerçek PostgreSQL üzerinde green veya `BLOCKED_EXTERNAL` olarak
  açık kanıtla yazılmış.
- Skip edilen testler gerekçe/owner/gate taşıyor.

### 2.11 Documentation/result/handoff

Phase sonunda `RESULT.md` içinde şunlar olmalı:

- Executed steps.
- Changed files.
- DB migration var/yok kararı.
- DurableReceiptBus davranışı.
- OrderedEvidenceBus davranışı.
- waitEvent contract ve test kanıtı.
- Restart/recovery kanıtı.
- Poison/lag visibility kanıtı.
- Sync-vs-durable equality sonucu.
- B-4/B-8 güncel durumu.
- Phase 3 readiness kararı.

## 11. Expected file changes

Beklenen değişiklik sınıfları:

```text
apps/api/src/services/verdict-*.ts
apps/api/src/services/*.test.ts
apps/api/src/services/*.integration.test.ts
apps/api/src/routes/verdict-*.ts
packages/db/prisma/schema.prisma
packages/db/prisma/migrations/**
packages/control-contract/src/**
.github/workflows/cockpit-ci.yml
docs/verdict/run-playbooks/phase-2/RUN_PLAY.md
docs/verdict/run-playbooks/phase-2/RESULT.md
```

Bu fazda `apps/web` değişikliği normalde beklenmez. Web tarafında sadece health/debug
route için zorunlu küçük read-only consumer gerekiyorsa önce gerekçe yazılır. Cockpit
UI ürün ekranları Phase 6 kapsamındadır.

## 12. Verification commands

Minimum kapanış komutları:

```bash
pnpm verdict:verify-master-plan
pnpm typecheck
pnpm test
git diff --check
git diff --cached --check
```

API özel:

```bash
pnpm --filter @nesy/api typecheck
pnpm --filter @nesy/api test
```

Integration:

```bash
VERDICT_DB_IT=1 pnpm --filter @nesy/api vitest run src/services/verdict-ingest.integration.test.ts src/services/test-event-ws-server.integration.test.ts
```

CI:

```bash
gh run list --workflow cockpit-ci.yml --limit 5
```

Eğer `gh`, Docker veya disposable PostgreSQL yoksa bu durum result'ta net yazılır.
Paylaşımlı remote DB'ye destructive integration/migration testi koşulmaz.

## 13. Acceptance criteria

Phase 2 ancak şu kriterlerle `COMPLETED` olabilir:

1. Event DB commit edilmeden ACK üretilmiyor.
2. Commit edilmiş event process restart sonrası tekrar bulunuyor.
3. Commit ile receipt publish arasındaki crash penceresi cursor/resume ile kapanıyor.
4. `DurableReceiptBus` ve `OrderedEvidenceBus` ayrı contract/runtime olarak mevcut.
5. Receipt-safe lane ordered gap yüzünden bloke olmuyor.
6. Ordered-required fact receipt lane ile tamamlanamıyor.
7. Duplicate event tek logical evidence üretiyor.
8. Burst sonunda unprocessed tail kalmıyor.
9. Gap körlemesine aşılmıyor.
10. waitEvent matched/cancel/timeout/restart/closed-run davranışları testli.
11. Subscriber cancel memory/lease sızıntısı bırakmıyor.
12. Poison row görünür; cursor sessizce atlamıyor.
13. Ordered consumer lag ve receipt dispatch latency görülebilir.
14. Sync ve durable oracle/evidence sonucu golden suite'te eşit.
15. Synchronous sink primary production path olmaktan kaldırılabilir hale geliyor veya
    kalan blocker açıkça yazılıyor.
16. SDK EmitOutcome diagnostic görünürlüğü recursive durable event üretmiyor.
17. Typecheck ve testler green.
18. Gerçek PostgreSQL integration job'ı ya green kanıtlı ya da Phase 2 kapanışında
    açık external blocker olarak işaretli. Eğer durable runtime correctness bu kanıta
    bağlıysa Phase 2 `COMPLETED` değil `BLOCKED_EXTERNAL` olmalı.

## 14. Rollback ve recovery notları

DB migration varsa:

- Migration adı ve rollback stratejisi RESULT'a yazılır.
- Destructive migration yapılmaz.
- Existing `verdict_inbox` ve `verdict_stream` semantics bozulmaz.

Runtime feature flag varsa:

- Sync sink kaldırma veya disable etme flag arkasında yapılır.
- Default davranış RESULT içinde belirtilir.
- Rollback için hangi env/flag değişeceği yazılır.

Consumer crash/restart testlerinde:

- Test database disposable olmalı.
- Shared remote DB kullanılmamalı.
- Test data run/session scoped cleanup taşımalı.

## 15. Agent çalışma kuralları

Bu fazı alan AI agent:

1. Hemen kod yazmaya başlamaz; önce Phase 1 result ve mevcut durable kodu okur.
2. Mevcut spike'ı production-ready saymaz.
3. `rootDir` veya tsconfig genişleterek typecheck'i susturmaz.
4. `as any`, kör `!`, test skip veya assertion gevşetmesi kullanmaz.
5. Domain kavramlarını core durable contract'a sokmaz.
6. Mobile repo'yu değiştirmez.
7. Shared remote PostgreSQL üzerinde write-heavy test çalıştırmaz.
8. Owned paths dışına çıkması gerekiyorsa önce result'a gerekçe yazar.
9. Her ara kapanışta RUN_PLAY recovery state'i günceller.
10. Phase tamamlandı demeden önce verification komutlarını çalıştırır.

## 16. Agent'a verilecek uzun semantic prompt

Aşağıdaki prompt tek başına Phase 2 işini başlatmak için kullanılabilir. Agent'a
master planın tamamını vermek zorunda değilsin; fakat bu `RUN_PLAY.md`, Phase 1
`RESULT.md` ve ilgili repo dosyaları verilmelidir. Agent repo erişimine sahip değilse
bu işi yapamaz.

```text
Sen Verdict Cockpit Phase 2 agent'ısın. Görevin master plan v1.1.2 kapsamındaki
"Durable Event Runtime ve Host waitEvent" fazını güvenli, testli ve recovery-state
tutarak uygulamak.

Önce şu dosyaları oku:
- docs/verdict/run-playbooks/phase-2/RUN_PLAY.md
- docs/verdict/run-playbooks/phase-2/RESULT.md
- docs/verdict/run-playbooks/phase-1/RESULT.md
- docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md içindeki FAZ 2 ve D.2 bölümleri
- apps/api/src/services/verdict-ingest.ts
- apps/api/src/services/verdict-fanout.ts
- apps/api/src/services/verdict-contiguous.ts
- apps/api/src/services/verdict-stream-order.ts
- apps/api/src/services/test-event-ws-server.ts
- packages/db/prisma/schema.prisma

Başlamadan önce:
- pnpm verdict:verify-master-plan çalıştır.
- git status --short ile worktree durumunu kaydet.
- pnpm typecheck ve pnpm test baseline'ını al.
- Phase 1'den devreden B-4 PostgreSQL integration CI durumunu kontrol etmeye çalış.
  GitHub CLI veya CI erişimi yoksa bunu external unverified olarak yaz; localde shared
  remote DB'ye migration/integration testi koşma.

Ana hedef:
Durable event delivery runtime'ı iki ayrı lane olarak kur:
1. DurableReceiptBus: commit edilmiş immutable inbox row üzerinden düşük gecikmeli
   readiness/Continue Gate hattı.
2. OrderedEvidenceBus: contiguous ordered processing, Final Oracle, audit, replay ve
   diagnostics hattı.

Bu iki lane'i karıştırma. Receipt-safe event ordered gap yüzünden beklememeli.
ORDERED_REQUIRED fact receipt lane ile authority kazanamamalı. Ordered lane seq/gap,
poison, retry ve idempotency kurallarını korumalı.

Uygulama sırasında:
- Mevcut verdict-ingest/fanout/contiguous kodunu incele; gereksiz rewrite yapma.
- Gerekirse yeni service dosyaları oluştur:
  apps/api/src/services/verdict-receipt-bus.ts
  apps/api/src/services/verdict-ordered-evidence-bus.ts
  apps/api/src/services/verdict-wait-event.ts
  apps/api/src/services/verdict-durable-runtime.ts
- Contract gerekiyorsa domain-neutral shared tipleri packages/control-contract altına ekle.
- DB state gerekiyorsa migration minimal ve backward-compatible olsun.
- test skip, as any, non-null assertion veya tsconfig gevşetmesi yapma.

waitEvent için lane-aware filter/cancel/timeout/restart semantics kur:
- MATCHED
- TIMEOUT
- CANCELLED
- CLOSED_RUN
- POISON_BLOCKED

Restart/recovery:
- Commit sonrası receipt publish öncesi crash penceresi kapanmalı.
- Ordered callback öncesi/sonrası crash davranışı deterministic olmalı.
- Duplicate/replay tek logical evidence üretmeli.
- Subscriber cancel memory/lease leak bırakmamalı.

Visibility:
- receipt dispatch latency
- ordered consumer lag
- oldest unprocessed age
- retry attempt
- last error
- poison/dead-letter
- subscriber/cancel metrics
en az service/read model düzeyinde görülebilir olmalı.

Sync-vs-durable:
- Mevcut synchronous sink ile durable bus sonucunu karşılaştıran bir comparison mode
  veya equality test/report üret.
- Equality yoksa sync sink primary path kaldırılamaz; bunu RESULT'a blocker olarak yaz.

Faz boyunca:
- RUN_PLAY.md içindeki recovery state'i adım adım güncelle.
- RESULT.md içine yaptığın her önemli işi, değişen dosyaları, komut sonuçlarını ve
  kalan blocker'ları yaz.
- Owned paths dışına çıkma. Çıkman gerekiyorsa önce gerekçe ve risk yaz.

Kapanışta şu komutları çalıştır:
- pnpm verdict:verify-master-plan
- pnpm typecheck
- pnpm test
- pnpm --filter @nesy/api typecheck
- pnpm --filter @nesy/api test
- git diff --check
- git diff --cached --check

Disposable PostgreSQL varsa ayrıca:
- VERDICT_DB_IT=1 pnpm --filter @nesy/api vitest run src/services/verdict-ingest.integration.test.ts src/services/test-event-ws-server.integration.test.ts

Phase 2'yi ancak acceptance kriterleri kanıtlıysa COMPLETED yaz. Gerçek PostgreSQL
kanıtı eksikse veya durable correctness sadece local unit testlerle kalıyorsa
COMPLETED deme; READY_WITH_BLOCKERS veya BLOCKED_EXTERNAL olarak yaz.
```

## 17. Agent'a verilecek kısa komut

Kısa kullanım:

```text
Bu repo içinde docs/verdict/run-playbooks/phase-2/RUN_PLAY.md dosyasını oku ve Phase 2'yi uygula.
Önce RESULT.md'i IN_PROGRESS yap, recovery state'i güncelle, sonra RUN_PLAY sırasıyla ilerle.
Owned paths dışına çıkma. Kapanışta verification komutlarını çalıştır ve RESULT.md'i evidence ile doldur.
```

Bu kısa komut ancak agent repo dosyalarına erişebiliyorsa yeterlidir.

