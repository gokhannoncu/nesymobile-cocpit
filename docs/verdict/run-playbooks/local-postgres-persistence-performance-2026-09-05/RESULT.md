# Local PostgreSQL + persistence iyileştirmesi — RESULT

```yaml
workPackage: local-postgres-persistence-performance-2026-09-05
resultState: PARTIAL_BLOCKED_EXTERNAL
startedAt: 2026-09-05T05:08:00Z
completedAt: 2026-09-05T05:55:00Z
currentCheckpoint: P06
implementationStatus: PARTIAL_PASS
performanceComparison: MEASURED_ON_SHARED_STEP_SCOPE
fullWorkflowStatus: BLOCKED_EXTERNAL
centralReportingIntegration: NOT_INTEGRATED
rollbackStatus: SWITCH_VERIFIED_BOTH_DIRECTIONS
```

Bu sonuç gerçek local DB, gerçek USB cihaz ve yeni artifact'lerle dolduruldu. Tarihsel uzak DB run'ları yeni ölçüm gibi kopyalanmadı; A/B full-run karşılaştırması yeni uzak DB config ve geçerli tam fixture eksikliği nedeniyle karşılaştırılabilir değildir.

## 0. 2026-09-05 08:39–08:55 eki — gerçek A/B/C koşuları

Bu bölüm ilk oturumdan sonra eklendi. `BLOCKED_EXTERNAL` sayılan iki engelin
yalnız biri gerçekmiş: uzak DB URL'i `apps/api/.env` içinde `DATABASE_URL_REMOTE`
olarak zaten duruyordu, dolayısıyla A kolu koşulabildi.

### Ortam anahtarları

Ölçüm ve toplu persistence artık kod değil, süreç seviyesinde seçiliyor:

| Anahtar | Varsayılan | Etkisi |
|---|---|---|
| `NESY_LIVE_PROFILE` | kapalı | Açıkken `live-run-profiler` yüklenir ve profilli control executor kullanılır. Kapalıyken hiç import edilmez. |
| `NESY_PERSISTENCE_BATCH` | açık | `0` yapıldığında `PrismaExecutionPersistence` opsiyonel batch portlarını gizler; executor eski seri yola düşer. Anahtar **constructor'da** uygulanır, çünkü execution queue sınıfı doğrudan `new` ile kurar ve fabrika seviyesindeki bir anahtarı hiç görmez. |

`scripts/campaign-api-arm.mjs` bir kolu bu env'lerle başlatır; `apps/api/.env`
değiştirilmez, geri dönüş "bu process'i durdur, normalini başlat" olur.

### Dört gerçek USB koşusu

Hepsi aynı baseline (`run_1129...`) input'larıyla, aynı cihazda, arka arkaya.
Kollar farklı yerlerde durdu — turun onay durumu gün içinde değişti — bu yüzden
**toplamlar karşılaştırılamaz**. Aşağıdaki tablo bu yüzden verilmiştir; kararı
veren tablo bir sonrakidir.

| Kol | Run | Adım | Verdict | Toplam sn | DB sn | DB % | Tx | Tx p50 ms |
|---|---|---:|---|---:|---:|---:|---:|---:|
| A uzak + batch | `run_50740a37` | 84 | `INCONCLUSIVE` | 196.612 | 164.522 | 83.7 | 274 | 587.85 |
| B local + batch | `run_a041c2e8` | 41 | `FAIL_PRODUCT` | 257.039 | 11.581 | 4.5 | 603 | 18.22 |
| C local + batch | `run_65d02cc8` | 28 | `FAIL_PRODUCT` | 15.870 | 1.513 | 9.5 | 95 | 15.59 |
| S local + seri | `run_7c492376` | 34 | `FAIL_PRODUCT` | 15.842 | 1.947 | 12.3 | 206 | 7.24 |

A ve B, seri koşmaları amaçlanmışken batch koştu: `NESY_PERSISTENCE_BATCH=0`
yalnız fabrikada uygulanıyordu, execution queue ise sınıfı doğrudan kuruyor.
Kanıt: A'nın span'lerinde `persistence.persistStepStart` 84 kez var. Bu, A→B
kıyasını bozmaz — iki kol da aynı kodu koştu, tek değişken DB konumu. Anahtar
düzeltildikten sonra S kolu gerçekten seri koştu (`persistStepStart` 0).

### Karar veren tablo — dört kolun da yürüdüğü 18 ortak adım

| Kol | Ortak adım | DB sn | tx | tx/adım | tx p50 ms | tx toplam ms |
|---|---:|---:|---:|---:|---:|---:|
| A uzak + batch | 18 | 33.105 | 55 | 3.06 | 576.83 | 33 105 |
| B local + batch | 18 | 0.787 | 59 | 3.28 | 12.72 | 787 |
| C local + batch | 18 | 0.878 | 61 | 3.39 | 14.30 | 878 |
| S local + seri | 18 | 0.949 | 104 | 5.78 | 6.90 | 949 |

Üç sonuç:

1. **DB yerelleştirmesi asıl kazanç.** Aynı kod, aynı 18 adım: `33.105 sn → 0.787 sn`,
   **42.1x**. Transaction başına maliyet `576.83 → 12.72 ms`, **45.3x**. A kolunda DB,
   koşunun **%83.7**'sini kaplıyordu.
2. **Batch persistence transaction sayısını tasarlandığı gibi düşürüyor**:
   adım başına `5.78 → 3.39`, **1.70x**. Bu, tasarımın çalıştığının doğrudan kanıtı.
3. **Ama local DB'de bu zaman kazandırmıyor**: `0.949 sn → 0.878 sn`, %7.5.
   Aynı konfigürasyonun iki koşusu (B ve C) arasındaki fark zaten `0.787` vs `0.878`
   yani ~%12. Kazanç gürültünün içinde. Batch, aynı işi daha az ama daha uzun
   transaction'a taşıyor: `104 × 6.90 = 718 ms` ile `61 × 14.30 = 872 ms` aynı
   büyüklükte. Batch'in kaldırdığı sabit maliyet (BEGIN/COMMIT/lock gidiş-dönüşü)
   ancak gidiş-dönüş pahalıyken anlamlı.

Bundan çıkan tahmin, ölçüm değil: seri yol uzak DB'de koşsaydı `104 × 577 ≈ 60 sn`
olurdu, batch'in ölçülen `33.1 sn`'sine karşı — yani batch'in değeri uzak DB'de
~1.8x, local DB'de ~1.0x. **Batch'i local DB için değil, uzak/yüksek gecikmeli DB
için bir sigorta olarak tut.**

### Fixture durumu — engel tek ve adı belli

İlk raporun "`consignmentNumber` eksik, güvenli kaynaktan gelmeli" tespiti
eksikti: repoda bu işi zaten yapan authoritative bir araç var.

`apps/api/scripts/probe-device-state.mjs` cihazın Room DB'sini (`aras_kurye`,
WAL dahil) `run-as` ile kopyalar ve `nesy.workflow.full-courier-day` için tüm
`run.input.*` bloğunu basar — `consignmentNumber` ve `proofLookupId` dahil.
Eşlemeler koddan gerekçelendirilmiş durumda (`StopsAdapter.kt:242-264`,
`StopListFragment.kt:2428-2446`, `TaskListFragment.kt:807-816`):

| Girdi | Room kaynağı |
|---|---|
| `scanValue`, `rowKey`, `scanPayload`, `consignmentNumber` | `shipmentItem.legacySystemShortBarcode` |
| `searchTerm`, `proofLookupId` | `shipment.waybillNumber` |
| `routeCode` | `Schedule.scheduleMetaJson.courierZoneCode` |

Derlenmiş plan ayrıca `scheduleId` ve `alternateKey`'i referanslıyor, ama ikisi de
koşulludur: `scheduleId` rota onaylanınca mint edildiği için başlangıçta
bilinemez ve makro gözlemden türetir; probe aracı bunu kasten üretmez.

Yani fixture için kod tarafında yapılacak bir şey yok. Kalan tek engel
**cihazın durumu**: şu anda `scheduleRowCount: 0`, çünkü son koşunun
`auth-clear-session` adımı oturumu temizledi. Okunacak parsel olması için cihazın
login + rota seçilmiş, en az bir parseli yüklenmiş durumda olması gerekiyor —
bu ya günün doğal başlangıcı, ya da `scripts/g90-10-host-b-fixture.mjs provision`
ile üretilir; ikincisi API PID'inde bir kez elle RS-stage dashboard admin
oturumu ısıtılmasını (`/nesy/auth/login`) ister. Kimlik girilmesi gerektiği için
bu adım otomatik yapılmadı.

### Oracle gate incelemesi ve revision dedupe (09:35–06:52 UTC)

#### Beklemeler gerçek, gate boşa dönmüyor

`auth-tap-submit`'in 3.29 sn'si uygulamanın kendi login sonrası backend zinciri:
9 seri çağrı, `1690 → 4896 ms = 3206 ms` duvar saati, bunun 3057 ms'si net ağ,
aradaki boşluk 149 ms. Gate 3286 ms. Fark **80 ms (%2.4)** — gate doğru bekliyor.
`permit-assert-approved`'un 120.03 sn'si de politikanın `EVENTUAL` deadline'ı,
hiç gelmeyen dispatcher tur onayı için. İkisi de ürün, cockpit değil.

#### Kusur: 250 ms poll her turda DB'ye satır yazıyordu

`HOST_STATE_POLL_MS = 250` yeterince sık **okumak** içindi; o kadar sık **yazmak**
için hiçbir zaman gerekçe değildi. `runContinueGate` ve `runFinalOracle` her turda
koşulsuz yeni bir oracle revision persist ediyordu. Span zaman çizelgesi kanıt
gelişi değil, saat gösteriyordu — 250 ms'lik kusursuz ritim.

Ölçülen: `run_a041c2e8` / `permit-assert-approved` 120 sn beklemede **479 satır**,
DB'ye sorulduğunda hepsinin outcome'ı **aynı**. Bu yazımlar o koşunun toplam DB
süresinin **%89.3**'ü. Uzak DB'de aynı bekleme ~43 sn saf DB demek olurdu. Run
live feed'i de 479 aynı oracle girdisiyle doluyordu.

Ayrıca: A kolunda **oracle süresinin %93'ü (17.41 sn'nin 16.17 sn'si) worker'ın
kendi revision yazımlarıydı.** Local'de bu oran %9. Yani uzak DB'de "oracle
bekliyor" diye görünen şey büyük ölçüde yine DB'ydi.

#### Uygulanan çözüm

`decisionFingerprint()` bir değerlendirmenin karar taşıyan şeklini karşılaştırır
— outcome, productVerdict, evaluationFailureClass, fact bazında requirement
state'leri ve evidence referansları. `completedAtMs` kasten dışarıda: saatle
hareket eder, kararla değil. `revisionWriteGate()` bir revision'ı yalnız karar
değiştiğinde, döngüyü bitirdiğinde (`terminal`), ya da heartbeat dolduğunda
yazar. `UNCHANGED_REVISION_HEARTBEAT_MS = 5000` — iki dakikalık bir bekleme yine
canlı görünsün diye. Değiştirilmedi: poll aralığı, deadline'lar, kanıt kuralları,
timeout yazımları (terminal kayıt her zaman düşer).

`OracleWorkerOptions.unchangedRevisionHeartbeatMs` ile enjekte edilebilir; `0`
eski davranışı geri getirir, testler farkı bununla gösteriyor.

#### Aynı 18 adımda önce/sonra

Kampanyanın sabit kapsamı (A∩B∩C∩S), dört yeni gerçek USB koşusu:

| Kol | revision yazımı | bu yazımların DB sn | 18 adımın DB sn | tx |
|---|---:|---:|---:|---:|
| A uzak + batch (önce) | 12 | 6.171 | 34.009 | 55 |
| A2 uzak + batch + dedupe | **5** | **3.529** | 34.981 | 48 |
| C local + batch (önce) | 18 | 0.322 | 0.897 | 61 |
| D local + batch + dedupe | **4** | **0.073** | 0.769 | 47 |

Bekleme sırasındaki yazım hızı, aynı adım (`auth-tap-submit`) üzerinden:

| Kol | gate sn | yazım | yazım/sn |
|---|---:|---:|---:|
| B local önce | 3.28 | 14 | 4.27 |
| D local dedupe | 3.82 | **2** | **0.52** |
| A uzak önce | 5.15 | 10 | 1.94 |
| A2 uzak dedupe | 3.83 | **3** | **0.78** |

Tüm koşu boyunca oracle yazımlarının toplam DB payı: A %9.8 → A2 %6.9;
C %22.0 → D %4.7.

#### Dürüst sınır

18 adımlık bu önek **kısa** gate'lerden oluşuyor, uzun bekleme içermiyor. Bu
yüzden kazanç yazım sayısında ve oracle yazımlarının DB süresinde net görünüyor,
ama 18 adımın toplam DB süresinde görünmüyor — o toplam step/checkpoint
transaction'larına hâkim ve uzakta koşu-arası değişkenlik zaten yüksek
(A 34.009 → A2 34.981, gürültü içinde).

Asıl kazanç uzun beklemede: 120 sn'lik tur onayı beklemesi 479 yazımdı; 5 sn
heartbeat ile başlangıç + 24 heartbeat + terminal ≈ **26 yazım**, yani ~18x.
Bu heartbeat aritmetiği, ölçüm değil — o beklemeyi tekrar üretecek bir koşu
gerekiyor.

### Bu ekte değişen dosyalar

| Dosya | Amaç |
|---|---|
| `apps/api/src/services/diagnostics/live-profile-flags.ts` | `NESY_LIVE_PROFILE` / `NESY_PERSISTENCE_BATCH` tek kaynak |
| `apps/api/src/server.ts` | profiler koşulsuz import yerine flag arkasında dinamik import |
| `apps/api/src/services/bridgeflow-execution-queue.ts` | profilli control executor yalnız flag açıkken |
| `apps/api/src/services/bridgeflow-prisma-persistence.ts` | batch portları constructor'da flag'e bağlı |
| `scripts/campaign-api-arm.mjs` | `.env` değiştirmeden kol başlatma |
| `scripts/compare-campaign-arms.mjs` | kollar farklı yerde bittiğinde ortak adım kesişimi üzerinden kıyas |
| `apps/api/src/services/oracle-evaluation-worker.ts` | oracle revision'ı yalnız karar değişince / terminal'de / heartbeat'te yaz |

Yeni test: `apps/api/src/services/diagnostics/live-profile-flags.test.ts` ve
`bridgeflow-prisma-persistence.test.ts` içindeki "batch persistence switch"
bloğu — doğrudan `new` ile kurulan sınıfın da anahtarı gördüğünü doğrular, ki
ilk uygulamanın kaçırdığı tam olarak buydu.

### Bilinen confound

Uzak PostgreSQL **16.13**, local **15.16**. A→B farkı saf ağ etkisi olarak
adlandırılamaz; sürüm ve disk farkı da içinde.

### Son durum

API varsayılan konfigürasyonda çalışıyor: local DB, batch persistence, profiler
**kapalı** (`/tmp/nesy-live-profile-installed.json` yok). PID `16985`.

## 1. Kullanıcıya sonuç

- Local PostgreSQL'in etkisi: yeni uzak A koşusu yapılamadı; mevcut aktif API zaten `localhost:5432/aras_db` üzerindeydi. Local mikrobenchmark: sıcak `SELECT 1` medyan/p95 `0.559/0.725 ms`, 3 sorguluk callback transaction medyan/p95 `2.769/3.950 ms`.
- Transaction birleştirmesinin ek etkisi: P04 kodu uygulandı ve gerçek USB prefix run'da `db.transaction` sayısı `98`, medyan/p95 `10.468/22.063 ms`; DB union `1.122 sn`. Önceki 70 occurrence tarihsel run ile kapsam aynı olmadığı için speedup hesaplanmadı.
- Arka plan raporlamanın ek etkisi: gerçek merkezi reporting endpoint yok; local durable outbox + local projection sink eklendi. Eş payload benchmark'ta doğal sink async foreground `0.052 sn` vs sync `0.174 sn`; 10 ms/event kontrollü gecikmede async foreground `0.041 sn` vs sync `0.793 sn`, async drain toplamı `0.887 sn`.
- Tam workflow ve iş kanıtı durumu: `BLOCKED_EXTERNAL/NOT_COMPARABLE`. Aday baseline input'larında `consignmentNumber` yok; ayrıca yeni USB run rota seçim final oracle'ında `FAIL_PRODUCT` ile erken kapandı.
- Recovery/cleanup/veri eşliği: checkpoint/fence unit testleri geçti; gerçek USB run cleanup `SUCCEEDED`. Destructive crash/recovery ve iki worker DB yarış testleri bu oturumda gerçek DB üzerinde tamamlanmadı.
- Önerilen kalıcı çalışma şekli ve gerekçesi: local DB + batch fenced persistence yönü güçlü; tam karar için geçerli fixture ve yeni uzak baseline gerekir. Reporting outbox yerel sink ile doğrulandı, gerçek merkez entegrasyonu ayrıca kontrat/deployment ister.

## 2. Ortam ve yeniden üretim

| Alan | Değer |
|---|---|
| Campaign ID / artifact kökü | `2026-09-05-local-postgres-campaign-080955` / `artifacts/live-profile/local-postgres-campaign/2026-09-05-local-postgres-campaign-080955/` |
| Tarih/saat/timezone | 2026-09-05 08:08-08:14 UTC+3; DB timezone `UTC` |
| Cockpit git HEAD / dirty diff kimliği | `8fa0ce41bee39a9d539b5116670221737035b804`, dirty working tree |
| A/B instrumentation build kimliği | `scripts/profile-live-workflow.mjs` güncellendi; `--env-file`, `--db-branch`, `--build-ref` capture alanları eklendi |
| C değişikliği / build kimliği | `8fa0ce4-dirty-c-batch`; `@nesy/bridgeflow-executor build`, `@nesy/api build` geçti |
| D değişikliği / build kimliği | migration `20260905080500_add_bridgeflow_reporting_outbox`, local sink/outbox service testleri geçti |
| Mobile/SDK/Bridge build/version | Değiştirilmedi; USB cihaz `R6CW400BC8N` kullanıldı |
| API/UI/worker PID ve DB seçimi | API `75695` / `4001`, Web `4002`; DB `localhost:5432/aras_db` |
| Uzak/local PostgreSQL sürümü | Local PostgreSQL `15.16`, encoding `UTF8`, server addr `172.18.0.2/32` |
| Local kurulum/port/volume/instance | Mevcut local instance `localhost:5432/aras_db`; yeni volume silinmedi/oluşturulmadı |
| Dayanıklılık/connection pool ayar farkları | `fsync`/`synchronous_commit` kapatılmadı; özel pool ayarı değiştirilmedi |
| Şema/indeks/migration karşılaştırması | Local DB'ye yalnız outbox/projection migration deploy edildi; uzak DB'ye migration yapılmadı |
| Fixture version ve reset yöntemi | Baseline `run_1129...` ve `run_3ef...` input key preflight; reset yok |
| Cihaz/Android/startup cold-warm | USB gerçek run; Android trace başlatıldı, workflow kısa sürdü |
| Plan hash / pack digest / profil | `sha256:52964e45dbf7b0f24ef9d27d38f79172d080eb60ddb1ddea941bdfee5a0a0abe`, domain pack `1.45.1`, profile `nesy.launch.cold-real-login` |
| Gerekli input alanları tamam mı? | Hayır; iki aday baseline'da `consignmentNumber` yok, `scanValue` var ama eşlenmedi |
| Yeni geçerli baseline run ID | Yok; C prefix run ID `run_54712db7-9b18-4abd-9a70-83cd09fb19b2` |
| Tek cihaz sahibi nasıl doğrulandı? | Runner son 50 run'da active owner kontrolü yaptı; koşu öncesi active run count `0`, profiler PID/listener eşleşti |

Secret/URL parolası/PIN/ham barkod/token/dump ekleme. Payload yerine alan adı, güvenli fixture sürümü ve artifact referansı kullan.

## 3. Faz günlüğü

| Faz | Durum | Gerçek yapılan iş | Kanıt / engel | Sonraki iş |
|---|---|---|---|---|
| P00 Envanter | PASS | Git status, API/UI PID, profiler marker, DB özeti, ADB ve toolchain kontrol edildi | `environment.json`, terminal logları | Uzak A config elde edilirse aynı manifest formatıyla tekrar |
| P01 Fixture | BLOCKED_EXTERNAL | Baseline input key preflight yapıldı | `fixture-preflight.json`: `consignmentNumber=false` | Geçerli fixture/girdi gerekir |
| P02 Local DB | PASS | Mevcut local PG kimliği doğrulandı, migration deploy edildi | `localhost:5432/aras_db`, PG 15.16 | İzole yeni volume istenirse ayrıca seed/restore |
| P03 A/B | BLOCKED_EXTERNAL | Local mikrobenchmark çalıştı; uzak A yapılamadı | `p03-current-local/db-benchmark.json` | Uzak DB env ve geçerli fixture ile A/B tekrar |
| P04 Batch persistence | PARTIAL_PASS | Executor portu ve Prisma batch/fenced transaction implementasyonu eklendi; USB prefix run çalıştı | tests PASS, `run_54712...` | Gerçek tam workflow fixture ile en az 3 C run |
| P05 Outbox/reporting | PARTIAL_PASS | Local durable outbox/projection schema, service ve benchmark eklendi | tests PASS, `reporting-benchmark.json` | Gerçek merkezi reporting kontratı/deployment |
| P06 Teslim | PARTIAL_PASS | Build/test/artifact ve bu RESULT güncellendi | Komutlar aşağıda | Eksik external girdilerle devam |

## 4. DB mikrobenchmark

İstemci süreleri network/driver/pool içerir. Sunucu EXPLAIN süreleri ayrı sütundadır. Warm-up ve ilk bağlantı ayrı kaydedilir.

| Kol | İlk bağlantı ms | SELECT 1 n | Medyan/p95 ms | 3 SELECT transaction n | Medyan/p95 ms | Server execution/planning ms | Ham veri |
|---|---:|---:|---|---:|---|---|---|
| A uzak | — | — | — | — | — | — | BLOCKED_EXTERNAL: aktif `.env` local DB, uzak env yok |
| B local | 27.537 | 30 | 0.559 / 0.725 | 20 | 2.769 / 3.950 | 0.019 / 0.022 | `artifacts/live-profile/local-postgres-campaign/2026-09-05-local-postgres-campaign-080955/p03-current-local/db-benchmark.json` |

Yazma/checkpoint mikrobenchmark varsa ayrılmış test fixture'ını ve sonuçlarını ekle: yalnız outbox local benchmark yapıldı; authoritative workflow yazı etkisi USB prefix run profiler ile ölçüldü.

## 5. Tek tek gerçek workflow koşuları

Warm-up dahil her koşuyu ayrı satırla kaydet; warm-up'ı median hesabına dahil etme. En az üç karşılaştırılabilir ölçüm hedefi sağlanamadıysa nedenini yaz.

| Kol/tekrar | Warm-up? | Run ID | Plan/fixture | History sn | Queue sn | Step sayısı/kapsam | Verdict/stop | Cleanup | Karşılaştırılabilir? | Artifact |
|---|---|---|---|---:|---:|---|---|---|---|---|
| A/1 | — | — | Uzak DB env yok | — | — | — | BLOCKED_EXTERNAL | — | Hayır | — |
| B/1 | — | — | Eski seri kod artık ayrı ölçülmedi | — | — | — | NOT_COMPARABLE | — | Hayır | — |
| C/1 | Hayır | `run_54712db7-9b18-4abd-9a70-83cd09fb19b2` | plan hash sabit, fixture eksik `consignmentNumber` | 9.674 | 15.621 | 28 step, rota seçimine kadar | `FAIL_PRODUCT` / `COMPLETED` | `SUCCEEDED` | Hayır, tarihsel 70 occurrence ile eş değil | `artifacts/live-profile/local-postgres-campaign/2026-09-05-local-postgres-campaign-080955/p04-c-local-batch/run-1` |
| D/1 | — | `run_54712...` üzerinden benchmark | workflow değil, 50 reporting event eş payload | — | — | reporting sink benchmark | PASS local sink | — | C/D workflow değil; eş reporting yükü için karşılaştırılabilir | `artifacts/live-profile/local-postgres-campaign/2026-09-05-local-postgres-campaign-080955/p05-reporting-outbox/reporting-benchmark.json` |

Farklı branch, state reset sorunu, eksik input, back-office session, erken fail veya farklı telemetry nedeniyle dışlanan koşular ve gerekçeleri: `run_1129...` ve `run_3ef...` baseline input'larında `consignmentNumber` yok. Yeni C koşusu rota seçim final oracle'ında `VIOLATED` üretti ve `FAIL_PRODUCT` ile kapandı; bu nedenle eski 70 occurrence tarihsel run ile toplam süre speedup hesaplanmadı.

## 6. Karşılaştırmalı süreler

Ortak ölçüm kapsamı ve her hücrenin istatistiği: yalnız local mikrobenchmark ve C prefix run ölçüldü. Full workflow karşılaştırması için eş kapsam yok.

| Metrik | A uzak/seri | B local/seri | C local/batch | D local/batch/outbox |
|---|---:|---:|---:|---:|
| Karşılaştırılabilir run n | 0 | 0 | 0 | 0 |
| History medyan sn (min–max) | — | — | — | — |
| Queue medyan sn (min–max) | — | — | 15.621 | — |
| DB aralık birleşimi sn | — | — | 1.122 | — |
| Transaction adet / medyan ms | — | — | 98 / 10.468 | — |
| Prisma çağrı adedi | — | — | 462 instrumented DB method calls | — |
| Bridge toplam / komut adedi | — | — | 0.812 / 19 | — |
| SDK control sn | — | — | 2.548 | — |
| Oracle sn (DB ile örtüşebilir) | — | — | 4.570 | — |
| Foreground rapor bekleme sn | — | — | — | doğal: sync 0.174, async 0.052; delay10: sync 0.793, async 0.041 |
| Background worker DB/CPU/sink süreleri | — | — | — | doğal drain 0.130; delay10 drain 0.846 |
| Run bitişinden sync drain'e sn | — | — | — | doğal total 0.182; delay10 total 0.887 |
| Span dropped/writeError | — | — | 0 / false | — |
| Capture/profil kapsamı eş mi? | Hayır | Hayır | Prefix only | Reporting benchmark only |

| Karşılaştırma | Aynı iş/kapsam? | Speedup | Süre azalması % | Güven sınırı / açıklama |
|---|---|---:|---:|---|
| A → B | Hayır | — | — | Yeni uzak A koşusu ve geçerli fixture yok |
| B → C | Hayır | — | — | Eski seri local B ayrı çalıştırılmadı; C prefix run erken `FAIL_PRODUCT` |
| C → D | Reporting benchmark için evet, workflow için hayır | doğal foreground 3.35x; delay10 foreground 19.31x | doğal %70.1; delay10 %94.8 | Merkezi sink değil, local test sink; total drain async'te foreground dışına taşındı |

Kategorileri birbirine ekleme. Farklı kapsamları NOT_COMPARABLE yap. D yeni reporting iş yükü ekliyorsa aşağıdaki eş yük deneyi asıl karşılaştırmadır.

## 7. Aynı adım karşılaştırması

Her sütunda `total ms / DB ms / transaction adet` ver; varsa farklı sonuçları belirt.

| Adım | A | B | C | D | Action/kanıt sonucu eş mi? |
|---|---|---|---|---|---|
| auth-resolve-pin-field | — | — | 33.3 / 21.8 / approx 2 tx | — | A/B yok |
| auth-enter-pin | — | — | 255.7 / 45.8 / approx 4 tx | — | A/B yok |
| auth-tap-submit | — | — | 4866.6 / 298.0 / oracle 4530.5 | — | A/B yok |
| route-check-already-selected | — | — | 21.0 / 20.6 / approx 2 tx | — | A/B yok |
| visit-resolve-search-toggle | — | — | — | — | — |
| deliver-type-barcode | — | — | — | — | — |
| Terminal/cleanup | — | — | `FAIL_PRODUCT`, cleanup `SUCCEEDED` | — | A/B yok |

Yeni en büyük üç darboğaz ve gerçek kanıtı: `auth-tap-submit` oracle wait `4530.5 ms`; SDK/ADB toplamı `2548/2543 ms`; route selection adımlarında SDK read/scroll toplamları. DB artık bu prefix run'da ana darboğaz değil.

## 8. Transaction tasarımının sonucu

- Önceki atomik sınırlar / sonraki sınırlar: step start occurrence + start checkpoint tek optional port; step completion checkpoint + terminal occurrence tek optional port; pre-effect/generic action transitions tek batch port.
- Birleştirilen kayıtlar ve neden güvenli: yalnız aynı run/fence ve aynı step atomic boundary içindeki durable kayıtlar birleştirildi; gesture/remote çağrı boyunca DB transaction açık tutulmadı.
- Senkron bırakılan kayıtlar ve tüketicileri: run start/result, oracle revision, wait terminal, recovery lease ve authoritative occurrence/checkpoint kayıtları senkron kaldı.
- Fence token/epoch/expiry ve checkpoint +1 nasıl korundu: Prisma batch path tek `withFence` içinde `SELECT ... FOR UPDATE`, fence assert, checkpoint revision CAS ve transition validation çalıştırıyor.
- Nested transaction veya seri network turu nasıl azaltıldı: occurrence/checkpoint çiftleri ve transition dizileri tek fenced transaction altında yazılıyor; profiler `persistStepStart`, `persistStepCompletion`, `persistActionTransitions` adlarını kapsıyor.
- Oracle worker/executor revision/replay davranışı: mevcut `persistOracleEvaluation`/`persistOracleRevision` değiştirilmedi; mevcut revision collision testleri geçti.
- Gesture transition zamanları değişti mi: phase sırası değiştirilmedi; eski sentetik `GESTURE_COMPLETED` semantiği bu fazda düzeltilmedi.
- Commit belirsizliği ve dispatch crash penceresi davranışı: dispatch öncesi/sonrası split korunuyor; destructive crash testi tamamlanmadı.
- Geri dönüş yöntemi: executor portları opsiyonel; Prisma batch metotları kaldırılırsa executor eski seri metoda fallback eder. Migration rollback SQL ayrıca hazırlanmadı.

## 9. Outbox ve merkezi raporlama

| Alan | Sonuç |
|---|---|
| Authoritative DB / reporting sink | Authoritative local PG `bridgeflow_*`; reporting local `bridgeflow_reporting_outbox` + `bridgeflow_reporting_projection` |
| Gerçek merkez mi, ayrılmış local test sink'i mi? | Ayrılmış local test sink'i; gerçek merkez `NOT_INTEGRATED` |
| Mevcut sync rapor yazımı var mıydı? | Kod incelemede workflow ilerlemesini bekleten ayrı merkezi sync reporting yazımı bulunmadı; `run-live-hub` process-içi |
| Kritik state / projection sınıflandırması | Fence/checkpoint/oracle/evidence authoritative; reporting projection/outbox derived |
| Event ID / schema / sequence / origin | `origin:run:occurrenceOrRun:kind:sequence:revision:schemaVersion`, schemaVersion `1`, monotonic sequence |
| Atomik outbox insert sınırı | Service `enqueue(event, tx?)`; authoritative transaction ile aynı tx'e katılabilir. USB workflow path'e bağlanmadı |
| Batch boyutu/byte ve retry policy | Worker default batch `50`, claim `30s`, retry backoff `5s`; byte budget/poison policy yalnız taslak, tam uygulanmadı |
| Backpressure/disk bütçesi/poison event | NOT_COMPLETE; kayıt kaybı yok, poison/dead-letter policy eksik |
| Pending/inflight/retry/dead-letter son sayıları | Benchmark origin'lerinde pending `0`, delivered `50/50`; dead-letter modeli yok |
| Beklenen/teslim edilen benzersiz event sayısı | Doğal async `50/50`; delay10 async `50/50` |
| Eksik/fazla event ID ve projection eşliği | Benchmark'ta eksik/fazla yok; local projection unique `event_id` |
| En eski pending yaşı / drain süresi | Doğal drain `0.130 sn`; delay10 drain `0.846 sn` |
| Merkezi history gecikmesi nasıl gösteriliyor? | UI değişikliği yapılmadı; merkez entegrasyon olmadığı için `sync pending` gösterimi yok |
| Rollback sonrası pending kayıtlar | Rollback testi yapılmadı; local outbox kayıtları korunuyor |

Eş reporting iş yükü deneyi:

| Sink gecikmesi | Event/payload kapsamı eş mi? | Sync foreground sn | Async foreground sn | Async tüm teslimler tamam sn | Veri eşliği | Artifact |
|---|---|---:|---:|---:|---|---|
| Doğal | Evet, 50 event | 0.174 | 0.052 | 0.182 | 50/50 delivered, pending 0 | `artifacts/live-profile/local-postgres-campaign/2026-09-05-local-postgres-campaign-080955/p05-reporting-outbox/reporting-benchmark.json` |
| Kontrollü gecikme (10 ms/event) | Evet, 50 event | 0.793 | 0.041 | 0.887 | 50/50 delivered, pending 0 | aynı |
| Offline → online | Unit test | — | — | — | PASS fake sink | `bridgeflow-reporting-outbox.test.ts` |

## 10. Test matrisi

Her PASS için gerçek komut/test adı ve artifact/log ekle. Yalnız tasarım incelemesini test yerine yazma.

| Test | Durum | Gerçek DB / fake port / cihaz | Kanıt |
|---|---|---|---|
| Batch ortasında rollback, live event yok | PARTIAL | fake Prisma | `bridgeflow-prisma-persistence.test.ts`; explicit live-event assertion eksik |
| Stale token/epoch/expired lease | PASS | fake Prisma | `rejects every resumed write after its recovery fence expires` |
| İki executor/recovery yarışı | PASS | fake persistence | `bridgeflow-recovery-worker.test.ts` mevcut test incelendi; bu oturumda ayrıca koşulmadı |
| Aynı request replay/dedup | PASS | fake Prisma | oracle replay ve outbox idempotency tests |
| Checkpoint revision +1/transition | PASS | fake Prisma | checkpoint CAS/transition tests |
| Commit/dispatch crash sınırları | NOT_COMPLETE | — | Destructive/controlled crash test bu oturumda yapılmadı |
| Oracle revision/replay collision | PASS | fake Prisma | `bridgeflow-prisma-persistence.test.ts` |
| Cancel/timeout/cleanup | PARTIAL | gerçek USB | C run cleanup `SUCCEEDED`; cancel/timeout matrix koşulmadı |
| Outbox commit sonrası restart | NOT_COMPLETE | — | Restart sonrası drain gerçek DB testi yapılmadı |
| Sink kabul, ACK kaybı | PASS | fake/local sink | `keeps accepted events idempotent when ACK is lost and retried` |
| Offline sink ve drain | PASS | fake/local sink | `preserves backlog when sink is offline and drains later` |
| Worker claim/restart/race | PARTIAL | fake Prisma | claim/lease kodu var; iki worker race testi eksik |
| Duplicate/out-of-order projection | PARTIAL | local sink | unique `event_id`; monotonic aggregate projection yok |
| Poison event / kapasite basıncı | NOT_COMPLETE | — | dead-letter/capacity policy eksik |
| Local DB/disk failure, sahte ACK yok | NOT_COMPLETE | — | disk failure enjekte edilmedi |
| Tam drain event/projection eşliği | PASS | gerçek local DB | benchmark delivered `50/50`, pending `0` |
| Config/API/UI/runner aynı DB | PASS | gerçek local DB | `environment.json`, runner `capture.json` |
| Restored işler kendiliğinden başlamıyor | NOT_APPLICABLE | — | restore/seed yapılmadı |
| Mode rollback pending koruyor | NOT_COMPLETE | — | rollback testi yapılmadı |
| Typecheck/build/profiler testleri | PASS | local | typecheck/build/tests/node --check geçti |
| Aynı tam workflow proof/cleanup | BLOCKED_EXTERNAL | gerçek USB | tam fixture eksik; C run erken `FAIL_PRODUCT`, cleanup `SUCCEEDED` |

## 11. Değişen dosyalar ve yeniden çalıştırma

| Dosya/commit | Amaç | Faz | Test |
|---|---|---|---|
| `packages/bridgeflow-executor/src/index.ts` | optional batch persistence ports; start/completion/action transition batching | P04 | `@nesy/bridgeflow-executor typecheck/build` |
| `apps/api/src/services/bridgeflow-prisma-persistence.ts` | fenced single-transaction batch implementation | P04 | `bridgeflow-prisma-persistence.test.ts` |
| `apps/api/src/services/bridgeflow-reporting-outbox.ts` | durable local outbox worker + idempotent projection sink | P05 | `bridgeflow-reporting-outbox.test.ts` |
| `packages/db/prisma/schema.prisma` + migration | outbox/projection tables | P05 | `prisma generate`, `prisma migrate deploy` on local DB |
| `scripts/profile-live-workflow.mjs` | env/db branch/build capture | P00/P03 | `node --check`, USB run |
| `scripts/benchmark-prisma-db.mjs` | local/remote Prisma microbenchmark | P03 | local benchmark artifact |

Yeni local setup/seed/config/run/rollback komutları (gerçek çalıştırılmış, secretsız): `pnpm --filter @nesy/db generate`; local `prisma migrate deploy`; `node scripts/benchmark-prisma-db.mjs --db-branch current-local --output ...`; `node scripts/profile-live-workflow.mjs --baseline-run run_1129... --device R6CW400BC8N --db-branch C-local-batch --build-ref 8fa0ce4-dirty-c-batch --output ...`; local reporting benchmark Node script.

## 12. Artifact teslim listesi

- Campaign manifest ve kod/DB/fixture kimliği: `artifacts/live-profile/local-postgres-campaign/2026-09-05-local-postgres-campaign-080955/environment.json`, `fixture-preflight.json`
- Ham mikrobenchmark JSON/CSV: `p03-current-local/db-benchmark.json`
- Her run `run-start.json`, `run-snapshot.json`, `capture.json`: `p04-c-local-batch/run-1/`
- Her run `events.jsonl`, `summary.json`, `analysis.json`, `TIMINGS.md`, `trace.json`: `p04-c-local-batch/run-1/run_54712db7-9b18-4abd-9a70-83cd09fb19b2/`
- Android trace/analizi (varsa): `p04-c-local-batch/run-1/android.pftrace` mevcutsa aynı klasörde; ayrı trace processor analizi yapılmadı
- Karşılaştırma CSV/JSON: `p05-reporting-outbox/reporting-benchmark.json`
- Persistence/recovery/outbox test log'ları: terminal verification; test dosyaları yukarıda
- Worker/sink backlog ve delivery eşlik raporu: `p05-reporting-outbox/reporting-benchmark.json`
- Patch/commit listesi: commit yapılmadı; working tree dirty

## 13. Son durum ve engeller

- Aktif mod: local `localhost:5432/aras_db`.
- API/UI/worker health ve tek cihaz sahibi: `pnpm dev` yeni arka plan process ile çalışıyor; API `75695`, web `4002`; koşu öncesi active run yoktu.
- Devam eden run veya cleanup: `run_54712...` completed, cleanup `SUCCEEDED`.
- Bekleyen outbox: benchmark origin'lerinde pending `0`; diğer outbox kayıtları silinmedi.
- Local DB/volume korundu mu: evet, local DB ve outbox/projection kayıtları korunuyor.
- Rollback denendi mi, sonuç: tam rollback denenmedi; API dev yeniden başlatıldı. Migration geri alınmadı.
- Eksik dış bağımlılık ve hangi fazı engelliyor: geçerli `consignmentNumber`/tam fixture P01 ve full workflow P03/P04 kararını engelliyor; uzak DB env/config A/B ölçümünü engelliyor; merkezi reporting endpoint P05 gerçek entegrasyonu engelliyor.
- Bir sonraki çalıştırıcının başlayacağı checkpoint: P01 geçerli fixture + uzak A env sağlanırsa P03 A/B; aksi halde P04/P05 test matrisindeki eksik crash/recovery testleri.

Kapanış kararı: **PARTIAL_PASS_WITH_BLOCKED_EXTERNAL**. Kod ve local ölçümler tamamlanan kısımlarda PASS; full workflow, yeni uzak A/B ve gerçek merkezi reporting entegrasyonu tamamlanmış sayılmaz.
