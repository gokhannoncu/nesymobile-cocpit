# Phase 2 RESULT — Durable Event Runtime ve Host waitEvent

```yaml
runPlayId: verdict-cockpit-phase-2-run-play
phase: 2
phaseName: "Durable Event Runtime ve Host waitEvent"
resultState: COMPLETED
startedAt: "2026-08-05 00:05:00 +03"
completedAt: "2026-08-05 06:20:00 +03"
lastUpdatedAt: "2026-08-05 06:20:00 +03"
timezone: "Europe/Istanbul"
executedAgainstMasterPlanVersion: "v1.1.2"
executedAgainstMasterPlanDigest: "sha256:5e7deff018a61b71eb215d2406615dae3304fb63080005e1130297401f15fa01"
masterPlanVersionAtClose: "v1.1.3"
masterPlanDigestAtClose: "sha256:76024d898cb152fe4d885fb18e798cb24b6c3df31715eac546c64383ed5c2bd0"
runPlayFile: "docs/verdict/run-playbooks/phase-2/RUN_PLAY.md"
previousPhaseResult: "docs/verdict/run-playbooks/phase-1/RESULT.md"
phase3Readiness: "READY_WITH_NON_BLOCKING_DEBT"
```

> **Master plan sürüm notu.** Phase 2 **v1.1.2**'ye karşı yürütüldü. Faz devam
> ederken plan bu agent tarafından **değil**, başka bir eliyle **v1.1.3**'e
> güncellendi (239 satır; digest kendi içinde tutarlı). Diff Phase 2 kapsamına
> **dokunmuyor** — `durable`, `ReceiptBus`, `OrderedEvidence`, `waitEvent`
> terimlerinde **0 değişiklik**; eklemeler Faz 4'e ait (typed allowlisted
> `REMOTE_ACTION` primitive'i, Nesy tur onayı Domain Pack reference slice'ı).
> Bu yüzden Phase 2 sonuçları geçerli sayıldı; yeniden yürütme gerekmiyor.
> Phase 3 RUN_PLAY'i v1.1.3 digest'iyle açılmalı.

## 1. Executive result

Phase 2 **kanıtla tamamlandı**. Durable runtime gerçek PostgreSQL 16 üzerinde
doğrulandı: **37/37 integration testi yeşil, sıfır skip, üst üste 5 sıralı koşuda
kararlı.**

İki durable lane ayrı contract ve ayrı runtime olarak kuruldu, `waitEvent` host
subscription'ı beş sonuç durumuyla çalışıyor, restart recovery persisted state
üzerinden çalışıyor, poison/retry/dead-letter/lag görünür, sync-vs-durable eşitliği
**gerçek socket + gerçek veritabanı** üzerinde kanıtlandı ve sync sink kaldırma tek
env flag'ine indirildi. Toplam **58 yeni unit + 11 yeni integration testi**.

Kapanış kanıtı ilk raporda eksikti; bu turda Docker Desktop'ın **kurulu ama kapalı**
olduğu görülüp CI ile birebir aynı `postgres:16` image'ı atılabilir bir container'da
kaldırıldı ve suite koşuldu.

### Bu turda ortaya çıkan üç gerçek bulgu

1. **Migration geçmişi kırık bulundu (B-10, Phase 2 öncesinden) ve Phase 2B'de
   kapandı.** İlk bulgu doğruydu: `prisma migrate deploy` boş bir veritabanında
   `workflow_runs` yok diye patlıyordu. Bu, Phase 2 durable runtime'ın değil,
   geçmişte `db push` ile oluşmuş ama migration history'ye baseline olarak girmemiş
   legacy schema'nın sonucuydu. Phase 2B, eksik baseline migration'ı ve schema
   default alignment migration'ını ekleyerek boş `postgres:16` üzerinde
   `migrate deploy`, `migrate diff` ve 37/37 integration suite kanıtını aldı.

2. **Integration suite'i ~%50 flaky'di (B-11, düzeltildi).** Ölçüm: paralel
   koşuda 4 denemenin 2'si kırmızı; sıralı koşuda 5/5 yeşil. Kök neden **lease
   hatası değil** — tam tersine lease *doğru* çalışıyordu: üç suite tek
   veritabanını paylaşıyor ve `bootstrap()` tasarım gereği **tüm** stream'leri
   tarıyor, dolayısıyla bir dosyanın restart scan'i diğerinin stream'inin
   advisory lease'ini alıyor, diğeri doğru şekilde `skippedLocked` dönüyor ve
   assertion düşüyordu. Suite izole değildi. `--no-file-parallelism` ile
   düzeltildi ve gerekçe workflow'a yazıldı.

3. **Gerçek reordering bug'ı (önceki turda, test tarafından yakalandı).** Ordered
   work-queue sorgusu dead-letter'lı ve backoff'taki row'ları filtreliyordu; bu
   `seq N` bloke olduğunda `seq N+1`'i eligible yapıyordu — kalıcı sıra ihlali,
   hiçbir yerde hata üretmeden. Test gevşetilmedi, davranış düzeltildi.

### Fazın en önemli bulgusu: gerçek bir reordering bug'ı test tarafından yakalandı

İlk implementasyonda ordered lane'in work-queue sorgusu dead-letter'lanmış ve retry
backoff'unda bekleyen row'ları **filtreliyordu**. Bu, `seq N` bloke olduğunda
`seq N+1`'i **eligible yapıyordu** — consumer N+1'i N'den önce görüyordu, kalıcı
olarak, hiçbir yerde hata üretmeden. Bu tam olarak lane'in var olma nedeni olan
ihlal. İki test kırmızıya düştü, davranış düzeltildi (test gevşetilmedi), ve
regresyon için ayrı bir test eklendi.

Düzeltme: blocked row'u sorgudan çıkarmak yerine sorgu onu **döndürür**, lane seq
sırasında **durur**. Dead-letter artık *retry*'ı bitirir, *blocking*'i bitirmez.

## 2. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `2` |
| Current step | `2.11` (bitti) |
| Current state | `COMPLETED` |
| Last successful step | `2.11` |
| Last attempted step | `2.11` |
| Last update | `2026-08-05 06:20:00 +03` |
| Recovery instruction | `Phase 2 kapandı: unit 202 passed / 38 skipped, integration 37/37 gerçek PostgreSQL 16'da yeşil (5 sıralı koşu kararlı). B-10 Phase 2B'de kapandı: boş postgres:16 üzerinde migrate deploy PASS, migrate diff empty, integration 37/37 PASS. Phase 3'e geçilebilir; kalanlar B-8 lint ve external DUT/SSOT borçlarıdır.` |

## 3. Step execution log

| Step | Status | Evidence |
|---|---|---|
| 2.1 Preflight ve inherited blocker check | `DONE` | §4 — digest OK, typecheck 7/7, test 273 passed / 27 skipped, branch `production`, worktree yalnız `?? docs/.../phase-2/` |
| 2.2 Existing durable ingest/fan-out baseline | `DONE` | §5 |
| 2.3 Contract ve DB model gap analysis | `DONE` | §6 — migration `20260805000000_add_verdict_durable_dispatch` |
| 2.4 DurableReceiptBus contract/runtime | `DONE` | §7 — `verdict-receipt-bus.ts`, 15 test |
| 2.5 OrderedEvidenceBus contract/runtime | `DONE` | §8 — `verdict-ordered-evidence-bus.ts`, 12 test |
| 2.6 waitEvent API/filter/cancel/timeout | `DONE` | §9 — 5 sonuç durumu, lane enforcement testleri |
| 2.7 Restart/resume bootstrap scanner | `DONE` | §10 |
| 2.8 Poison/dead-letter/retry/lag/metrics | `DONE` | §11 — `/api/verdict/events/health` |
| 2.9 Sync-vs-durable comparison mode | `DONE` | §12 — `VERDICT_COMPARE_MODE=1` |
| 2.10 Integration and regression tests | `DONE` | §13 — unit yeşil, integration **37/37 gerçek PostgreSQL 16'da yeşil** |
| 2.11 Documentation/result/handoff | `DONE` | Bu dosya |

## 4. Step 2.1 — Preflight

| Komut | Sonuç | Kanıt |
|---|---|---|
| `pnpm verdict:verify-master-plan` | `PASS` | `Master plan digest OK: sha256:5e7deff0…f15fa01` — Phase 1'den değişmedi |
| `git status --short` | `PASS` | Tek satır: `?? docs/verdict/run-playbooks/phase-2/` — kullanıcıya ait unrelated değişiklik yok |
| `git branch --show-current` | `PASS` | `production` |
| `pnpm typecheck` (baseline) | `PASS` | `Tasks: 7 successful, 7 total` |
| `pnpm test` (baseline) | `PASS` | api 144 passed / 27 skipped + web 129 passed = **273 passed / 27 skipped** — Phase 1 ile birebir |
| `gh run list --workflow cockpit-ci.yml` | `UNVERIFIED_EXTERNAL` | `gh not found`. GitHub CLI yok, CI koşusu görülemedi. |
| `docker info` | `UNAVAILABLE` | `DOCKER_UNAVAILABLE`. Disposable PostgreSQL kurulamıyor. |

**Inherited blocker durumu:**

| ID | Giriş | Çıkış | Not |
|---|---|---|---|
| B-4 | `IMPLEMENTED_UNVERIFIED` | `IMPLEMENTED_UNVERIFIED` (**Phase 2 kapanış blocker'ı**) | Doğrulama yolu bu makinede kapalı: Docker yok, `gh` yok. Kapsam **büyüdü**: artık üç integration suite bu job'a bağlı. |
| B-8 | `OPEN_NON_BLOCKING` | `OPEN_NON_BLOCKING` | Değişmedi; Phase 2 kapsamına alınmadı, lint gate'i hâlâ bloklamıyor. |

## 5. Step 2.2 — Existing baseline

Mevcut kodun hangi kısmı production-ready, hangisi spike:

| Dosya | Sınıf | Karar |
|---|---|---|
| `verdict-ingest.ts` (330 satır) | **Production-ready** | Tek transaction + COMMIT sonrası ACK doğru. **Dokunulmadı.** Kriter 1 (ACK commit'ten önce yok) zaten sağlanıyordu. |
| `verdict-contiguous.ts` (211 satır) | **Production-ready**, pure | Incremental watermark aritmetiği. **Dokunulmadı.** |
| `verdict-stream-order.ts` (43 satır) | **Production-ready** | `StreamSerialiser` + `MonotoneStreamWatermarks`. **Dokunulmadı.** |
| `verdict-fanout.ts` (164 satır) | **Baseline / superseded** | Ordered drain'i vardı ama **cursor yok, retry budget yok, dead-letter yok, subscriber yok**. Poison row sonsuza retry ederdi ve asla "görünür şekilde takılmış" olmazdı. `OrderedEvidenceBus` yerine geçti; dosya **silinmedi** (CP2 spike'ları ve `verdict-ingest.integration.test.ts` onu baseline olarak koşuyor). Aynı advisory lock key'i kullandıkları için cutover sırasında çift işleme yapamazlar. Başlığa `⚠️ SUPERSEDED` notu eklendi. |
| `test-event-ws-server.ts` | **Dual-write seam** | Synchronous sink seam'i: `onEvent` içinde `sink.injectTestEvent(wsEvent)`. Durable path onun yanında koşuyordu. Phase 2 bunu flag arkasına aldı. |
| `cp2-*.ts` (8 dosya) | **Spike** | Production sayılmadı, değiştirilmedi. |

**Restart-safe miydi?** Kısmen. `resumeAllStreams()` ordered tarafı için vardı ama:
receipt lane hiç yoktu, `processed_at` tek sinyaldi, commit→publish penceresi için
ayrı state yoktu, ve poison row restart'ta attempt sayacını sıfırlıyordu.

## 6. Step 2.3 — Contract ve DB kararı

### Yeni shared contract

`packages/control-contract/src/durable-events.ts` (yeni, `index.ts`'den `export *`).
Domain-neutral: `STOP`, `PARCEL`, `MATCH`, `BETTING`, `COURIER_LOGIN`, `OPEN_STOP`
**yok**. Taşıdığı tipler: `EvidenceDeliveryLane`, `EvidenceDeliveryContract`,
`DurableEventRef`, `DurableEventCursor` (+ encode/decode), `DurableEventFilter`,
`DurableEventCorrelation`, `DurableReceipt`, `OrderedEvidence`, `WaitEventRequest`,
`WaitEventResult`, `DurableStreamHealth`, `DurableRuntimeHealth`,
`EmitOutcomeDiagnosticQuery/Result`, `SyncDurableEqualityReport`.

Lane cursor'ın **içine gömüldü** (`RECEIPT_SAFE#42`): receipt cursor'ını ordered
subscriber'a vermek sessizce yanlış yerden devam etmek olurdu; şimdi decode hatası.

### DB migration: GEREKLİ, yapıldı

`packages/db/prisma/migrations/20260805000000_add_verdict_durable_dispatch/`

Additive-only, backwards-compatible. Önceki kod bu şemaya karşı **aynen** çalışır
(`verdict-fanout.ts` yeni kolonlara hiç bakmaz), bu yüzden migration runtime'dan
önce deploy edilebilir.

`verdict_inbox` + 5 kolon:

| Kolon | Neden |
|---|---|
| `receipt_dispatched_at` | Commit→receipt publish penceresinin **tek** kalıcı kaydı. `processed_at` ile paylaşılamaz: receipt lane hole ÜSTÜNDEKİ row'u da publish eder, ordered lane etmez. Tek kolon olsa bu iki kuraldan biri kırılırdı. |
| `attempt` | In-memory sayaç restart'ta sıfırlanır → poison row sonsuza retry edilir ve **asla takılmış olarak raporlanmaz**. |
| `last_error` | Dead-letter'lanmış row'un tek teşhisi. |
| `next_retry_at` | Backoff. |
| `dead_lettered_at` | Retry bütçesi bittiğinde. Row **atlanmaz**, lane orada durur. |

+ `CHECK (attempt >= 0)`, + `verdict_inbox_receipt_pending_idx`,
+ partial `verdict_inbox_dead_lettered_idx WHERE dead_lettered_at IS NOT NULL`.

Yeni tablo `verdict_run_closure(run_id, session_id, closed_at, reason, late_event_count)`:
closed-run politikasının kalıcı cevabı. Restart sonrası "meşru gecikmiş event" ile
"saatler önce bitmiş run'ın event'i" ayırt edilemiyordu. `workflow_runs`'a FK
**bilinçli olarak konmadı** — durable runtime run lifecycle tablosunun şekline
bağımlı olmamalı.

`processed_at` semantiği **korundu**: yalnız ordered consumer başarılı callback
sonrası set edilir (`markProcessed` port'taki tek yol).

**Rollback:** additive olduğu için `DROP COLUMN` + `DROP TABLE` güvenli; hiçbir
mevcut kolon/constraint değişmedi, `verdict_inbox`/`verdict_stream` semantiği bozulmadı.
Destructive migration yok.

## 7. Step 2.4 — DurableReceiptBus

`apps/api/src/services/verdict-receipt-bus.ts`

Davranış:

- **Yalnız committed row görür.** Store port'unda transaction-içi row diye bir şey
  yok; `listReceiptReady` sadece kalıcı satırları okur.
- **In-memory emitter DEĞİL.** Subscriber committed row'lar üzerinde bir *cursor*'dır;
  nudge sadece *ne zaman bakacağını* belirler, *ne göreceğini* belirlemez. Process
  commit ile publish arasında ölse bile aynı row'lar bulunur.
- **Watermark ile sınırlanmaz** (C.40). Hole üstündeki row publish edilir.
- **Duplicate tek logical receipt.** Inbox PK absorbe eder;
  `markReceiptDispatched` first-write-wins (replay latency'yi yeniden ölçmez).
- **Cursor resume.** Yeni bus = yeni process; cursor'dan devam eder.
- **Cancel leak bırakmaz.** `AbortSignal` + generator `finally`; nudge hub waiter,
  timer ve subscriber sayacı sıfırlanır.
- **Filtrelenen row'da da cursor ilerler** — aksi halde her poll eşleşmeyen prefix'i
  baştan okur (O(n²)).

Test kanıtı (15): committed vs hiç commit edilmemiş; hole üstü teslim; duplicate;
ilk dispatch zamanı korunur; cursor resume; yanlış lane cursor reddi; filtreli
cursor ilerlemesi; latency kaydı; cancel-no-leak; waitEvent MATCHED/TIMEOUT/
CANCELLED/CLOSED_RUN; ORDERED_REQUIRED reddi.

## 8. Step 2.5 — OrderedEvidenceBus

`apps/api/src/services/verdict-ordered-evidence-bus.ts`

Davranış:

- `seq <= contiguous_seq` bound'u **store sorgusunda** — "gap körlemesine aşılmaz"
  kuralı unutulamayacağı yerde.
- Consumer hatası → lane **o seq'te durur**, row `attempt`/`last_error`/`next_retry_at`
  ile işaretlenir, sonraki seq consumer'a **hiç verilmez**.
- Retry budget dolunca `dead_lettered_at` set edilir; **stream orada bloke kalır**.
  Dead-letter *retry*'ı bitirir, *blocking*'i bitirmez.
- Backoff'ta bekleyen row da **bloke eder** (§1'deki bug fix).
- `processed_at` yalnız başarılı callback sonrası. Crash → tam bir event tekrar
  teslim edilir (at-least-once); consumer `(runId, sessionId, seq)` üzerinde
  idempotent olmak zorunda.
- Çoklu consumer: biri patlarsa row processed **yapılmaz** (patlayan consumer onu
  asla görmezdi).
- Burst coalescing: nudge kaybedilmez, lease yarışını kaybeden nudge hatırlanır.
- `retryScheduledFor` ayrı alan — backoff bir hata durumu değil.
- Backoff bittiğinde otomatik re-nudge (yoksa bir run'ın son event'i sonsuza
  backoff'ta kalır ve run kanıt varken timeout olur).

Test kanıtı (12): gap geçilmez; 120'lik burst'te tail kalmaz; `skippedLocked`;
failing row'da duruş; çoklu consumer kısmi başarı; dead-letter + blocking;
**backoff blocking regresyonu**; POISON_BLOCKED; idempotent tekrar drain;
callback sonrası crash replay; watermark altı MATCHED; RECEIPT_SAFE reddi;
cancel-no-leak.

## 9. Step 2.6 — Host waitEvent

`apps/api/src/services/verdict-wait-event.ts`

`waitEvent` **SDK komutu değil** (C.14): host subscription'ı. Beş sonuç:
`MATCHED`, `TIMEOUT`, `CANCELLED`, `CLOSED_RUN`, `POISON_BLOCKED`.

Kurallar ve kanıtları:

| Kural | Kanıt |
|---|---|
| `RECEIPT_SAFE` ordered gap yüzünden timeout olmaz | `delivers a row sitting ABOVE a hole` |
| `ORDERED_REQUIRED` receipt event'iyle tamamlanmaz | `refuses to serve a RECEIPT_SAFE wait` + `waitEvent MATCHED only below the watermark` |
| Lane karıştırılamaz | Her iki bus sahip olmadığı lane'i **reddeder**; `waitForFact` lane'i registry contract'ından alır, çağıran seçemez |
| Cancel sonrası sızıntı yok | `leaves no waiter, timer or subscriber behind when cancelled` |
| TIMEOUT kanıtsız failure üretmez | Sonuç tipi ayrı; `TIMEOUT ≠ FAILED` testte açıkça yazılı |
| Closed run politikası açık | `CLOSED_RUN` timeout yakmadan döner, late event **sayılır** (drop edilmez) |
| Restart sonrası tamamlanabilir | `finds a committed row the previous process never published` |

`assertDeliveryContractSound()`: `ORDERED_REQUIRED` + `orderingReason` yoksa reddeder
(gerekçesi yazılmayan ordering gereksinimini bir sonraki okuyan düşürür);
`RECEIPT_SAFE` + `DERIVATION_ID` reddeder (receipt lane türetilmiş fact'i dedupe
edemez).

## 10. Step 2.7 — Restart/resume bootstrap scanner

`VerdictDurableRuntime.bootstrap()`.

Kayıp niyeti replay etmez, **kalıcı state'i sorgular**:
`receipt_dispatched_at IS NULL` ve `processed_at IS NULL AND seq <= contiguous_seq`
üzerinde `SELECT DISTINCT run_id, session_id`. İki lane paralel taranır, sonuç
de-dupe edilir, stream başına **bir** nudge.

- **Idempotent:** tamamen dağıtılmış stream ikinci taramada bulunmaz
  (`bootstrap is idempotent` testi `{receiptStreams: 0, orderedStreams: 0}` doğrular).
- **O(n²) değil:** tarama pending row sayısına lineer; iki partial/composite index
  predicate'i sürüyor (`verdict_inbox_pending_idx`, `verdict_inbox_receipt_pending_idx`).
- **Health/log:** `[VerdictDurableRuntime] restart scan resumed N stream(s)` +
  `[TestEventWS] restart recovery: …`. WS server `checkIngestReady()` başarısından
  sonra çağırıyor.

## 11. Step 2.8 — Poison/dead-letter/retry/lag/metrics

**Eklenen okuma yüzeyi** (RUN_PLAY §2.8 bunu açıkça yazmayı istiyor):

| Endpoint | İçerik |
|---|---|
| `GET /api/verdict/events/health` | Yalnız **dikkat gerektiren** stream'ler (lag, dağıtılmamış receipt veya dead-letter) |
| `GET /api/verdict/events/health/:runId/:sessionId` | Tek stream, sağlıklı olsa da |
| `GET /api/verdict/events/emit-outcome?runId&sessionId&throughSeq` | SDK `EmitOutcome` diagnostic'i |

Route'lar **read-only** — bu bir kısıt, tesadüf değil: delivery state'i mutate
edebilen bir diagnostic yüzeyi eninde sonunda stream'i "elle kurtarmak" için
kullanılır, ki ordered evidence tam böyle sessizce atlanır. DB erişilemezse **503**
(`500` boş health payload'ını "sorun yok" diye okumaya davet ederdi).

Görünen metrikler: `receiptPending`, `orderedLag`, `oldestUnprocessedAgeMs`,
`lastReceiptDispatchLatencyMs`, `maxAttempt`, `lastError`, `deadLetteredCount`,
`lateEventCount`, `closedAt`, `activeSubscribers`, `cancelledSubscribers`,
`completedSubscribers`.

`orderedLag` **yalnız watermark altını** sayar: hole üstündeki row gecikmiş değil,
doğru bekliyor; onu lag saymak her gap'i takılmış consumer gibi gösterirdi ve o zaman
gerçek bir takılma normal gap davranışından ayırt edilemezdi.

**SDK EmitOutcome recursion:** `answerEmitOutcomeDiagnostic` port üzerinden yalnız
`getRow` + `getContiguousSeq` çağırabilir. Test store'un `writes` sayacıyla
**hiç yazma yapmadığını** assert ediyor. Dönüş tipinde `sideEffectFree: true`
literal — `false` yazan implementasyon derlenmez.

## 12. Step 2.9 — Sync-vs-durable comparison mode

`VERDICT_COMPARE_MODE=1` (default **OFF**). Production davranışını değiştirmez;
kapalı olmasının nedeni recorder'ın event başına observation biriktirmesi — uzun
ömürlü API process'inde her zaman açık bir recorder leak'tir.

Eşitlik `(runId, sessionId, seq)` kimliği + payload fingerprint üzerinde:

- `raw` alanı fingerprint'ten **çıkarılır** — iki path bilinçli olarak `WS|` vs `DB|`
  etiketliyor; dahil edilse her event mismatch raporlanır ve rapor değersizleşir.
- Key sırası **normalize edilir** — JSONB round-trip sırayı korumaz.
- Duplicate observation **tek** sayılır — at-least-once eşitsizlik değildir; aksi
  halde gate tasarımı gereği geçilemez olurdu.

Sync tarafı **kendi görüşünden** kaydedilir (DB'ye girmeden önce); durable row'un
yeniden okunmasıyla karşılaştırmak hiçbir şey kanıtlamazdı.

**Sync sink cutover:** `VERDICT_SYNC_SINK_DISABLED=1`. Default OFF ve bu default
rollback planının kendisi — cutover tek flag, rollback tek flag, iki yönde de kod
değişikliği ve migration yok. Eşitlik gösterilmeden flag çevrilmemeli.

**Eşitlik gate durumu:** pure fonksiyon seviyesinde 7 test yeşil (eşit / eksik /
payload mismatch / raw / key order / duplicate / recorder). **Uçtan uca gerçek
WS+PostgreSQL eşitlik koşusu yapılamadı** (Docker yok) — §14 blocker'ı.

## 13. Step 2.10 — Verification

### Kapanış komutları (hepsi bu makinede koşuldu)

| Komut | Sonuç | Kanıt |
|---|---|---|
| `pnpm verdict:verify-master-plan` | `PASS` | `Master plan digest OK: sha256:5e7deff0…f15fa01` — değişmedi |
| `pnpm typecheck` | `PASS` | `Tasks: 7 successful, 7 total` |
| `pnpm test` | `PASS` | api **202 passed / 38 skipped**, web 129 passed, control-channels 36 passed |
| `pnpm --filter @nesy/api typecheck` | `PASS` | `tsc --noEmit`, çıktı yok |
| `pnpm --filter @nesy/api test` | `PASS` | Yukarıdaki api satırı |
| `git diff --check` | `PASS` | Çıktı yok |
| `git diff --cached --check` | `PASS` | Çıktı yok |

Test sayısı deltası: **273 → 331 passed** (+58 yeni unit test), **27 → 38 skipped**
(+11 yeni integration test; DB'siz koşuda gate kapalı olduğu için skip, DB'yle
37/37 koşuyor).

### Integration suite — GREEN, gerçek PostgreSQL 16

**Ortam.** İlk raporda "Docker yok" yazıyordu; doğrusu **Docker Desktop kurulu ama
kapalıydı** (`/Applications/Docker.app` + `/usr/local/bin/docker`). Başlatıldı ve
CI'ın `integration` job'ıyla **birebir aynı `postgres:16` image'ı** atılabilir bir
container'da kaldırıldı:

```bash
docker run -d --name verdict-it-pg -p 55432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=verdict_test postgres:16
```

Port **55432** — 5432 değil. Paylaşımlı uzak DB'ye (Phase 1 §9.1) hiçbir aşamada
bağlanılmadı; `DATABASE_URL` her komutta satır içinde `127.0.0.1:55432` olarak
verildi. Container koşu sonunda silindi.

Yerel brew postgres denendi ve **kullanılamadı**: `postgresql@14` kırık
(`libicui18n.74.dylib` yok, yalnız `icu4c@78` kurulu). Düzeltmek paket kurulumu
gerektirirdi; Docker zaten CI'a daha sadık olduğu için o yol seçilmedi.

**Şema kurulumu — ve neden `migrate deploy` kullanılamadı.** İlk deneme:

```text
Applying migration `20260720000000_add_run_input`
Error: P3018 … relation "workflow_runs" does not exist
```

Bu Phase 2'nin değişikliğinden değil: **hiçbir migration `workflow_runs`'ı
yaratmıyor** (§16 B-10). Şema `prisma db push` ile kuruldu, ardından verdict
tabloları düşürülüp **migration SQL'lerinin kendisi** aynen uygulandı — çünkü
`db push` Prisma'nın ifade edemediği CHECK constraint'lerini ve partial index'leri
kurmaz, ve suite tam onları doğruluyor. Sonuç `\d verdict_inbox` ile teyit edildi:
5 yeni kolon, `verdict_inbox_attempt_non_negative`,
`verdict_inbox_receipt_pending_idx` ve partial `verdict_inbox_dead_lettered_idx`
yerinde.

**Koşu sonucu:**

```bash
DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55432/verdict_test' \
VERDICT_DB_IT=1 npx vitest run --no-file-parallelism \
  src/services/verdict-ingest.integration.test.ts \
  src/services/test-event-ws-server.integration.test.ts \
  src/services/verdict-durable-runtime.integration.test.ts
```

```text
Test Files  3 passed (3)
     Tests  37 passed (37)
```

**Sıfır skip** — yani `VERDICT_DB_IT`/`DATABASE_URL` gate'i gerçekten açıldı ve
CI'daki "skipped varsa job fail" guard'ı bu koşuda da tetiklenmezdi. Kararlılık
için **5 ardışık sıralı koşu: 5/5 yeşil.**

Dosya bazında: `verdict-ingest.integration.test.ts` 16 ✓,
`test-event-ws-server.integration.test.ts` 11 ✓,
`verdict-durable-runtime.integration.test.ts` 10 ✓.

Gerçek PostgreSQL üzerinde kanıtlananlar: migration kolonları ve
`CHECK (attempt >= 0)` (negatif attempt DB tarafından reddediliyor); receipt
lane'in watermark **üstü** teslimi; ordered lane'in watermark JOIN'iyle gap'te
durması; advisory lease'in gerçek DB objesi olması; attempt/`last_error`
kalıcılığı + sonraki seq'in bloke kalması + dead-letter + `POISON_BLOCKED`;
`DISTINCT` restart scan'lerinin commit edilmiş ama teslim edilmemiş row'u
bulması; `verdict_run_closure` first-close-wins + late event sayımı; closed-run'ın
timeout yakmadan yanıtlanması; health read model'in gerçek lag/age'i; **2^53 üstü
seq round-trip'i** (`9007199254740993n` komşusuna çökmüyor).

### Flakiness: ölçüldü, kök nedeni bulundu, düzeltildi (B-11)

İlk paralel koşularda testler **kararsızdı**:

| Koşu | Paralel | Sıralı |
|---|---|---|
| 1 | 3 failed / 34 passed | 37 passed |
| 2 | 37 passed | 37 passed |
| 3 | 37 passed | 37 passed |
| 4 | 3 failed / 34 passed | 37 passed |
| 5 | — | 37 passed |

Tüm hatalar `tryAcquireOrderedLease` → `false` üzerindeydi. İlk hipotez "Prisma
connection pool advisory lock'u sızdırıyor"du; **yanlış çıktı** — izole bir probe
8 ardışık acquire/release'te 0 sızıntı gösterdi (`distinct backend connections: 1`).

Gerçek neden: üç suite tek veritabanını paylaşıyor ve
`VerdictDurableRuntime.bootstrap()` tasarım gereği **tüm** stream'leri tarıyor
(production'da doğru: tek process recovery'nin sahibidir). Paralel koşuda bir
dosyanın restart scan'i diğerinin stream'ini bulup advisory lease'ini alıyor,
diğerinin drain'i doğru şekilde `skippedLocked` dönüyor ve assertion düşüyordu.
**Lease tam da yapması gerekeni yapıyordu; kusur suite izolasyonundaydı.**

Düzeltme: `--no-file-parallelism`, gerekçesi ve ölçümüyle birlikte
`.github/workflows/cockpit-ci.yml` içine yazıldı.

### Sync-vs-durable eşitliği artık uçtan uca kanıtlı (B-9 kapandı)

`VERDICT_COMPARE_MODE` module-load sabitiydi, bu yüzden test edilemiyordu (ESM
import'ları hoist edilir; test kendi import'undan önce env set edemez). Frame
başına okunan bir fonksiyona çevrildi ve WS integration suite'ine gerçek gate
eklendi: **gerçek socket + gerçek PostgreSQL** üzerinden 17 event iki path'ten de
geçirilip karşılaştırılıyor.

```text
✓ the synchronous sink and the durable lane produce identical logical evidence
```

`missingFromDurable: []`, `missingFromSync: []`, `payloadMismatches: []`,
`equal: true`, `durableCount === syncCount`. Boş recorder'ın da "equal" olacağı
için **vacuous pass koruması** var: `syncCount >= 17`. 17 çünkü suite seq 1–3 ve
7–20'yi event olarak gönderiyor; 4–6 gap aralığı ve gap bir test event'i değil —
ilk eşik hatalı yazılmıştı (20), eşitlik zaten geçiyordu, düzeltilen eşikti.

## 14. Changed files

| File | Status | Owned? | Reason |
|---|---|---|---|
| `docs/verdict/run-playbooks/phase-2/RUN_PLAY.md` | `modified` | ✅ | Recovery state |
| `docs/verdict/run-playbooks/phase-2/RESULT.md` | `modified` | ✅ | Bu dosya |
| `packages/control-contract/src/durable-events.ts` | `new` | ✅ | Domain-neutral delivery sözleşmesi |
| `packages/control-contract/src/index.ts` | `modified` | ✅ | `export * from "./durable-events.js"` |
| `packages/db/prisma/migrations/20260805000000_add_verdict_durable_dispatch/migration.sql` | `new` | ✅ | Dispatch state + closure tablosu |
| `packages/db/prisma/schema.prisma` | `modified` | ✅ | `VerdictInbox` +5 kolon +1 index, `VerdictRunClosure` |
| `apps/api/src/services/verdict-durable-runtime.ts` | `new` | ✅ | Store port + Prisma impl + retry policy + filter + nudge hub + health + EmitOutcome + equality |
| `apps/api/src/services/verdict-receipt-bus.ts` | `new` | ✅ | `DurableReceiptBus` |
| `apps/api/src/services/verdict-ordered-evidence-bus.ts` | `new` | ✅ | `OrderedEvidenceBus` |
| `apps/api/src/services/verdict-wait-event.ts` | `new` | ✅ | `waitEvent` router + composed runtime + bootstrap |
| `apps/api/src/services/verdict-durable-runtime.test.ts` | `new` | ✅ | 58 unit test + in-memory store double |
| `apps/api/src/services/verdict-durable-runtime.integration.test.ts` | `new` | ✅ | 10 PostgreSQL testi |
| `apps/api/src/routes/verdict-events.routes.ts` | `new` | ✅ | Read-only health/diagnostic read model |
| `apps/api/src/services/test-event-ws-server.ts` | `modified` | ✅ | Ordered lane cutover, iki lane nudge, restart scan, comparison mode (frame başına okunan flag) |
| `apps/api/src/services/test-event-ws-server.integration.test.ts` | `modified` | ✅ | Sync-vs-durable eşitlik gate'i (B-9) |
| `apps/api/src/services/verdict-fanout.ts` | `modified` | ✅ | Yalnız `⚠️ SUPERSEDED` başlık notu; davranış değişmedi |
| `.github/workflows/cockpit-ci.yml` | `modified` | ✅ | Üçüncü integration suite + `--no-file-parallelism` (B-11, ölçümüyle gerekçelendirildi) |
| **`apps/api/src/app.ts`** | `modified` | ❌ **owned paths dışı** | Aşağıda gerekçe |

### Owned paths dışına çıkma gerekçesi: `apps/api/src/app.ts`

RUN_PLAY §7 `apps/api/src/routes/**` içerir ama `apps/api/src/app.ts` içermez.
Değişiklik **iki satır**: bir import + bir `app.register(verdictEventsRoutes,
{ prefix: '/api/verdict' })`.

Gerekçe: RUN_PLAY §2.8 acceptance'ı "API/read model veya service-level query ile
health okunabilir" ve "`RESULT.md` hangi endpoint eklendiğini açıkça yazar" diyor.
Kaydedilmemiş bir Fastify plugin ölü koddur — endpoint eklendi diye raporlanır ama
hiçbir zaman cevap vermez. Alternatif (service-level query'yle yetinip route
eklememek) acceptance'ı daha zayıf karşılıyordu.

Risk: **düşük**. Ek route read-only, prefix'i yeni (`/api/verdict`) ve hiçbir
mevcut route ile çakışmıyor; runtime lazy (`getVerdictDurableRuntime()` ilk çağrıya
kadar Prisma'ya dokunmaz), dolayısıyla kayıt maliyeti sıfır. `apps/web`
değiştirilmedi (RUN_PLAY §11'e uygun). Mobile repo'ya dokunulmadı.

## 15. Acceptance checklist

| Criteria | Status | Evidence |
|---|---|---|
| Event DB commit edilmeden ACK yok | `PASS` | `verdict-ingest.ts` değişmedi; ACK `prisma.$transaction` COMMIT sonrası (`acceptDurable`) |
| Commit edilmiş event restart sonrası bulunuyor | `PASS (unit + PG)` | `finds a committed row the previous process never published` + `the restart scans find committed-but-undelivered rows through DISTINCT predicates` |
| Commit→receipt publish crash penceresi kapanıyor | `PASS (unit + PG)` | `receipt_dispatched_at IS NULL` + `bootstrap()`; aynı iki test |
| DurableReceiptBus mevcut ve testli | `PASS` | `verdict-receipt-bus.ts`, 15 test |
| OrderedEvidenceBus mevcut ve testli | `PASS` | `verdict-ordered-evidence-bus.ts`, 12 test |
| Receipt-safe lane ordered gap yüzünden bloke olmuyor | `PASS` | `delivers a row sitting ABOVE a hole` |
| ORDERED_REQUIRED fact receipt lane ile tamamlanamıyor | `PASS` | Her iki bus lane reddi + `waitForFact` registry routing |
| Duplicate event tek logical evidence üretiyor | `PASS` | `treats a re-delivered event as one logical receipt`, `is idempotent across repeated drains` |
| Burst sonunda unprocessed tail kalmıyor | `PASS` | `drains a burst with no unprocessed tail` (120 row) + nudge coalescer |
| Gap körlemesine aşılmıyor | `PASS` | `does not cross a gap` + backoff/dead-letter blocking testleri |
| waitEvent matched/cancel/timeout/restart/closed-run testli | `PASS` | 5 durum + restart testi |
| Subscriber cancel leak bırakmıyor | `PASS` | `waiterCount() === 0`, `activeSubscribers === 0` (iki lane) |
| Poison row görünür | `PASS` | `dead_lettered_at` + `POISON_BLOCKED` + health `deadLetteredCount`; cursor **sessizce atlamıyor** |
| Ordered lag ve receipt latency görülebilir | `PASS` | `orderedLag`, `oldestUnprocessedAgeMs`, `lastReceiptDispatchLatencyMs` + `/api/verdict/events/health` |
| Sync-vs-durable equality kanıtlandı | `PASS` | Pure fonksiyon 7 test + **uçtan uca gerçek socket/PG gate'i**: `the synchronous sink and the durable lane produce identical logical evidence` (17 event, sıfır mismatch, vacuous-pass koruması var) |
| SDK EmitOutcome diagnostic recursion üretmiyor | `PASS` | `answers from persisted state without writing anything` (`writes` sayacı sabit) + `sideEffectFree: true` literal |
| Typecheck/test green | `PASS` | §13 |
| PostgreSQL integration green veya external blocker net | **`PASS`** | §13 — `postgres:16` üzerinde **37/37 yeşil, 0 skip**, 5 ardışık koşu kararlı |

**18/18 `PASS`.** Kriter 18'in birinci şıkkı ("green kanıtlı") sağlandı: durable
runtime correctness artık yalnız lokal unit testlere dayanmıyor, gerçek PostgreSQL
kanıtı var. Bu yüzden `resultState: COMPLETED`.

Ayrım önemli: **kanıt** elde edildi, **CI otomasyonu** hâlâ kırık (B-10). Phase 2
kapanışı kanıta bağlıydı, CI job'ının yeşile dönmesine değil — ve B-10 Phase 2'nin
ürünü değil, Phase 2 öncesinden gelen bir migration geçmişi kusuru.

## 16. Blockers

| ID | Severity | Description | Owner | Status |
|---|---|---|---|---|
| **B-4** | — | Durable delivery'nin SQL katmanı (watermark JOIN, advisory lease, yeni kolonlar/constraint'ler, closure upsert, 2^53 üstü seq) **gerçek `postgres:16` üzerinde kanıtlandı**: 37/37, 0 skip, 5 ardışık koşu kararlı (§13). B-4'ün özü — "integration testleri gerçekten koştu mu" — kapandı. Geriye kalan **CI otomasyonu** kısmı B-10'a devredildi. | API owner | **`CLOSED`** (lokal gerçek-PG kanıtıyla) |
| **B-10** | — | **Migration geçmişi Phase 2B'de onarıldı.** `20260401000000_init_legacy_baseline` eksik legacy/core tabloları migration geçmişine aldı; `20260805010000_align_schema_defaults` schema drift'i sıfırladı. Boş `postgres:16` üzerinde `migrate deploy` PASS, `migrate status` up-to-date, `migrate diff` empty, integration 37/37 PASS. Existing shared DB'lerde baseline migration kör uygulanmaz; inspection sonrası `migrate resolve --applied 20260401000000_init_legacy_baseline` gerekir. | Platform/DB owner | **`CLOSED`** — Phase 2B |
| **B-11** | — | Integration suite'i paralel koşuda ~%50 flaky'di (4'te 2 kırmızı). Kök neden lease değil, **suite izolasyonu**: `bootstrap()` tüm stream'leri tarıyor ve dosyalar birbirinin lease'ini alıyordu. `--no-file-parallelism` ile düzeltildi; ölçüm ve gerekçe workflow'a yazıldı. Sıralı: 5/5 yeşil. | API owner | **`CLOSED`** (yeni, aynı turda kapandı) |
| **B-9** | — | Sync-vs-durable eşitliği artık **uçtan uca** kanıtlı (gerçek socket + gerçek PostgreSQL, 17 event, sıfır mismatch, vacuous-pass koruması). `VERDICT_SYNC_SINK_DISABLED=1` cutover'ı için kanıt engeli kalktı. | API owner | **`CLOSED`** |
| B-8 | MEDIUM | Repo-wide lint ESLint v9 flat-config borcu yüzünden blocking değil. | Platform owner | `OPEN_NON_BLOCKING` |
| B-6 | LOW | Performans baseline script'i yok; receipt dispatch latency/ordered lag için hedef eşik tanımlı değil (sayı görünür, bütçe yok). | Platform owner | `OPEN` |
| CP0 external DUT | — | Fiziksel cihaz/SSOT kapıları bu repoda kapanmaz. | Mobile owner | `OPEN/EXTERNAL` |

**Cutover notu.** B-9 kapandığı için `VERDICT_SYNC_SINK_DISABLED=1` artık kanıt
açısından meşru. Yine de bu turda **çevrilmedi**: eşitlik 17 event'lik bir fixture
üzerinde gösterildi, gerçek bir cihaz koşusunda değil. Flag'i çevirmek bir operasyon
kararıdır ve rollback'i de aynı flag'dir.

## 17. Skipped / deferred work

| İş | Neden | Nereye |
|---|---|---|
| `verdict-fanout.ts` silme | CP2 spike'ları ve `verdict-ingest.integration.test.ts` onu baseline olarak koşuyor; silmek kanıt hattını kaldırırdı. | Phase 3+ |
| Continue Gate'in gerçek receipt subscriber'ına bağlanması | Continue Gate ve WorkflowIR v2 Phase 4–5. Contract ve bus hazır (`waitForFact`). | Faz 4/5 |
| Final Oracle'ın ordered subscriber'a taşınması | Şu an ordered consumer mevcut sink seam'ini besliyor; Oracle cutover'ı Phase 5 işi. | Faz 5 |
| Evidence Journey UI / WAL-ACK-receipt UI verisi (D.2 madde 21) | Cockpit UI Phase 6; RUN_PLAY §11 `apps/web` değişikliği beklemiyor. | Faz 6 |
| Bridge host client, WorkflowIR v2, Domain Pack, Maestro söküm, SDK mutual-HMAC | RUN_PLAY §6 kapsam dışı. Dokunulmadı. | İlgili fazlar |

## 18. Phase 3 handoff

```text
phase3Readiness: READY_WITH_NON_BLOCKING_DEBT
```

**Hazır olan taraf.** Phase 3'ün üstüne inşa edeceği contract ve runtime yerinde ve
**gerçek veritabanı kanıtı var**: iki lane ayrı, `waitEvent` beş sonuçla ve lane
enforcement'la çalışıyor, restart recovery kalıcı state üzerinden, poison/lag
görünür, sync-vs-durable eşitliği uçtan uca kanıtlı, sync sink kaldırma tek flag'e
indi ve rollback aynı flag. Typecheck ve test yeşil, mevcut 273 testin hiçbiri
kırılmadı, `as any`/`rootDir` gevşetmesi/test skip'i yok.

**Phase 2B notu.** Bu dosyanın ilk kapanışında B-10 açıktı. Phase 2B'de baseline
migration repair tamamlandı: boş `postgres:16` üzerinde `migrate deploy` artık
geçiyor, migration-history/schema diff empty ve integration suite 37/37 yeşil.
Existing shared DB'ler için tek özel durum, baseline migration'ın kör uygulanmaması;
önce inspection, sonra gerekirse `migrate resolve --applied` yapılmasıdır.

**Değişmeyen gerçek:** master planın yedi ana işinden hiçbiri `DONE` değil. Phase 2
"durable event consumer cutover" işini **çalışır, testli ve gerçek PostgreSQL'de
kanıtlı** hale getirdi ama production cutover'ı hâlâ flag arkasında. CP0 hâlâ
`COMPLETED` değil (cihaz gerektiren Mobile SSOT blocker'ları bu repoda kapanmaz).

**Sıradaki agent şu sırayla devam etmeli:**

1. Bu dosyayı oku — özellikle §1 (üç bulgu), §13 (integration kanıtı + flakiness
   ölçümü), §14 (`app.ts` gerekçesi), §16 (B-10).
2. `pnpm verdict:verify-master-plan` — **digest artık
   `sha256:76024d898cb152fe4d885fb18e798cb24b6c3df31715eac546c64383ed5c2bd0`
   (v1.1.3)**. Phase 2 v1.1.2'ye karşı yürütüldü; diff Phase 2 kapsamına dokunmuyor
   (baştaki sürüm notu).
3. `git status --short` — Phase 2 kodu **commit edildi** (user tarafından, bu faz
   sırasında): `f4bb823 completed phase2 developments` (durable runtime, iki lane,
   contract, migration, route, testler) ve `d030756 continue to phase2 developments`
   (CI `--no-file-parallelism`, eşitlik gate'i, `compareModeEnabled`, master plan
   v1.1.3). Master plan v1.1.3 değişikliği **user'ındır**, bu agent'ın değil.
   Çalışma ağacında yalnız bu iki playbook dosyası kalır.
4. Phase 2B RESULT'u oku: `docs/verdict/run-playbooks/phase-2b/RESULT.md`.
5. Phase 3 RUN_PLAY'ini **v1.1.3 digest'iyle** oluştur.
6. Cutover kararı: `VERDICT_SYNC_SINK_DISABLED=1` artık kanıt açısından meşru;
   çevirmek operasyon kararı, rollback aynı flag.

### Integration suite'i lokalde tekrarlamak

```bash
open -a Docker
docker run -d --name verdict-it-pg -p 55432:5432 \
  -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=verdict_test postgres:16
DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55432/verdict_test' \
  pnpm --filter @nesy/db exec prisma migrate deploy
DATABASE_URL='postgresql://postgres:postgres@127.0.0.1:55432/verdict_test' \
  VERDICT_DB_IT=1 pnpm --filter @nesy/api test -- --no-file-parallelism \
    src/services/verdict-ingest.integration.test.ts \
    src/services/test-event-ws-server.integration.test.ts \
    src/services/verdict-durable-runtime.integration.test.ts
docker rm -f verdict-it-pg
```
