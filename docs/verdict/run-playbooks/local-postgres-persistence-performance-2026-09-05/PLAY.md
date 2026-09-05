# Local PostgreSQL + persistence iyileştirmesi — PLAY

Bu dosya Cursor'ın uygulama sırasıdır. Her faz sonunda [RESULT.md](RESULT.md)'yi güncelle. Başlangıç kuralları ve kapsam [RUN.md](RUN.md)'dedir.

## P00 — Envanter ve ölçümü sabitle

1. Uygulanabilir repository talimatlarını oku. `git -c core.fsmonitor=false status --short` ile kullanıcı değişikliklerini kaydet; çalışma ağacını resetleme. Gerekirse `codex/` önekli çalışma branch'i kullan, kullanıcı commit'lerini değiştirme.
2. API/UI PID'leri, command line, portlar, DB URL'nin güvenli özeti, profiler kurulum PID'si ve package build kimliklerini tespit et. `DATABASE_URL` değerini terminale basma. API, web, CLI/profiler, migration ve background worker'ların hangi kaynaktan DB seçtiğini çıkar.
3. `packages/db/src/index.ts` API `.env` dosyasına fallback yapabilir; Prisma client process içinde cache'lenir. Sadece shell'de env değiştirmek çalışan process'i değiştirmez. Runner da `apps/api/.env` yükler. Local ölçümde tüm süreçlerin aynı local instance/DB'ye bağlandığını kimlik sorgusuyla doğrula.
4. Ölçüm dosyalarını doğrula: `scripts/profile-live-workflow.mjs`, `scripts/analyze-live-profile.py`, `scripts/analyze-android-profile.sql` ve API `services/diagnostics/*`. Profiler monkey-patch metot isimlerine bağlıdır; yeni toplu persistence/outbox yollarını da kapsayacak şekilde güncelle.
5. Profiler'ı gerekiyorsa tüm kollara aynı biçimde geliştir: tarihsel run girdilerini sessizce değiştirmeyen açık girdi dosyası/DB config desteği, build/plan kimliği, DB kolu, capture kalitesi ve worker export ölçümleri. Bunları A baseline'ından önce yap. Hassas değerleri loglama.
6. `packages/bridgeflow-executor` API tarafından `dist/index.js` üzerinden yükleniyor. Kaynak değişince paketi build et; kaynakta değişiklik olup çalışan dist'in eski kalmasını başarı sanma. Aktif cihaz koşusu sırasında API/watch process restart etme.

Çıktı: `environment.json` (sansürlü), başlangıç diff listesi, process/DB seçim haritası, ölçüm şeması ve kod kimliği. Tüm kol artifact'leri `artifacts/live-profile/local-postgres-campaign/<campaign-id>/` altında; sırları içeren geçici config/input dosyaları bunun içinde ayrı private dizinde ve Git dışında tutulur.

## P01 — Geçerli, karşılaştırılabilir workload hazırla

### Mevcut fixture açığı

`run.input.consignmentNumber` eksikliği biliniyor. Derlenmiş plandaki input referanslarını ve upstream çıktıları kontrol et; `proofLookupId` dahil diğer alanların gerçekten hangi dalda gerekli olduğunu belirle. `scanValue` ile `consignmentNumber` aynı olabilir diye tahmin etme. Geçerli değerleri mevcut test fixture'ı/uygulama verisi veya kullanıcıdan al. Gerekirse ayrı yeni baseline oluştur; eski run kaydını güncelleme.

Preflight input validation gerekiyorsa A öncesinde tüm kollara ortak uygulanır. Koşullu dalda kullanılmayan alanı bütün akış için gereksiz zorunlu hale getirme. Geçerli tam akış verisi yoksa safe prefix ölçümünü ayrı profil olarak tanımlayabilirsin; aynı prefix tüm kollarda aynı olmalı, **FULL_WORKFLOW_VALIDATED** sayılamaz.

### Eş iş yükü

- Plan hash, paket digest/sürümü, workflow sürümü, profil, uygulama build'i, cihaz ayarları, telemetry yoğunluğu ve girdi fixture sürümü sabitlenir.
- Her run ayrı ID/correlation alır; iş verisi aynı mantıksal başlangıç durumuna getirilir. Teslimat, izin onayı, offline kuyruk gibi durumlar ardışık tekrarları farklılaştırabilir. Yalnız DB kopyasını geri almak cihaz/remote backend etkisini geri almaz.
- Tercih: ayrılmış test fixture'ı ve mevcut desteklenen reset/seed mekanizması. Reset mümkün değilse eş semantikte taze iş verisi kullan; farklılaşan backend durumunu belirt. Remote veriyi doğrudan SQL ile geri sarma veya gerçek müşteri işlemini tekrar tekrar üretme.
- İş fixture'ı resetlenemiyorsa güvenli tekrarlanabilir UI prefix ve DB mikrobenchmark tamamlanabilir; tam akış kıyası BLOCKED_EXTERNAL/NOT_COMPARABLE olur.
- Başlangıç cold/warm türünü açıkça seç. Auth önbelleği, ilk backend admin oturumu, SDK/app session, rota seçimi ve overlay başlangıcı eş olmalı. Bir kolda zaten seçilmiş rotayı atlayıp diğerinde seçmek karşılaştırmayı bozar.

Çıktı: fixture manifest'i (değerleri değil alan adı/sürüm/güvenli fingerprint), plan kimliği, expected step/dal kapsamı, reset talimatı ve yeni geçerli baseline ID.

## P02 — Local PostgreSQL'i izole hazırla

### Instance ve config

1. Mevcut server major sürümünü, encoding/collation/timezone ve gerekli extension'ları salt okuma ile tespit et. Yerelde uyumlu sürüm seç; görüntü/sürümünü sabitle ve raporla. Kurulu PostgreSQL/Docker kapasitesini önce kontrol et. Kurulum yöntemini ortamına göre seç; port/volume çakışmasını önle.
2. Yalnız loopback'e bağlı ayrılmış local port ve ayrı database/volume kullan. Örnek isim `nesy_perf_local`; örnek port `55432`, ancak boş olduğunu doğrula. Ayrı yerel test kimliği kullan; üretim secret'larını compose/commit içine koyma.
3. `fsync`, `synchronous_commit` ve `full_page_writes` gibi dayanıklılık ayarlarını hız uğruna kapatma. A/B'deki farklı ayarları manifest'e yaz. Local disk ve DB sürüm değişimi varsa sonucu yalnız saf ağ etkisi olarak adlandırma.
4. Eklenen DB seçim aracı mevcut `.env`'yi kalıcı biçimde ezmemeli. Ayrı env dosyası/process injection ile seç; yalnız güvenli bağlantı özeti göster. Mevcut root `pnpm dev` öncesi port öldüren script'ler çalıştırabiliyor; aktif koşu olmadığı doğrulanmadan kullanma.

### Şema ve gerekli veriler

5. Kaynak şema yalnız Prisma schema dosyasına eşit varsayılmamalı: `packages/db/prisma/migrations` ve `manual-migrations` bulunuyor. Gerçek kaynak şeması, migration geçmişi ve gereken extension/index/constraint'leri karşılaştır. Yerel boş DB'ye doğrulanmış schema snapshot veya kontrollü migration sırası uygula; uzak DB'ye migration çalıştırma.
6. Referans workflow, version, compiled plan, domain pack, profil/dataset ve baseline run/input ilişkilerini ID/FK tutarlılığıyla kopyala. En küçük bağımlılık kapanışını kullan; gereken kayıtları tahmin ederek yeniden üretme. Dump gerekiyorsa yalnız yetkili test kapsamını salt okuma snapshot ile al; bağlantı parolası command line/log'a yazılmasın. Dump ve ham input'lar Git'e girmez.
7. Kopyalanmış queue/recovery/lease/outbox/job kayıtları **başlatılmadan önce** envanterlenir. Çalışan/queued eski işleri kopyadan otomatik dispatch edecek worker'ları kapalı tut. Gerekli tarihsel baseline satırlarını koruyarak, yalnız local kopyada restore/provenance kaydıyla scheduler işlerini karantinaya al. Hangi tabloların worker tetiklediği koddan bulunmadan API'yi açma. Eski terminal verdict'leri keyfi biçimde PASS/FAIL'e çevirme.
8. Şifreli app/back-office token'ları varsa gerekli uygulama anahtarlarının ve cache davranışının yerelde çalıştığını doğrula; token'ı plaintext export etme. Uzak sistemle yeniden login gereksinimi varsa mevcut desteklenen akışı kullan; kaptçaya yol açacak kör retry üretme.
9. DB restore'dan sonra gerekli indeksler, row count/ID bağları, plan hash, input keys ve migration uyumluluğunu kontrol et; ölçüm öncesi DB istatistiklerini eş biçimde hazırla. Kaynak ve local row-count farklarının beklenen kısmını kaydet.

### Cihaz sahipliği ve geri dönüş

10. Mevcut run ve cleanup bitmeden konfigürasyon değiştirme. Eski API ve device-owning worker'ları kontrollü durdur; local API, UI ve runner'ı aynı config ile aç. Diğer DB'ye bağlı scheduler'ın da cihazı yönetmediğini doğrula. Ayrı process'ler yalnız farklı portlarda çalışıyor diye güvenli kabul etme.
11. Salt okuma DB kimlik sorgusuyla her süreçte local hedefi doğrula. Mevcut runner'ın profiler PID kontrolünü geçir. Canary olarak DB/readiness erişimini doğrula; hemen tam run başlatma.
12. Rollback komutu/işlemi yaz: local queue idle → outbox durumunu koru → local process'leri durdur → önceki env/process ayarını geri yükle → mevcut uzak API/UI sağlığını doğrula. Local volume/outbox'u deney sonunda silme; aksi açıkça istenmedikçe inceleme için koru.

Çıktı: tekrarlanabilir local kurulum/seed/seçim/rollback araçları, private veri dışındaki config örneği ve güvenli restore raporu. Bu araçları Cursor uygular; bu PLAY dosyası uygulanmış araç iddiasında bulunmaz.

## P03 — A/B ölçümü: yalnız DB yerleşimi

### DB mikrobenchmark

Uzak ve local DB'de aynı sürücü/Prisma sürümü ve bağlantı ayarlarıyla:

- İlk bağlantı maliyetini ayrı ölç; sonra warm-up yap.
- En az 30 sıcak `SELECT 1` çağrısı ve en az 20 adet üç seri `SELECT 1` callback transaction'ı ölç. Medyan/p95 ve ham örnekleri sakla.
- `EXPLAIN (ANALYZE, FORMAT JSON) SELECT 1` server execution/planning değerini ayrı kaydet. Client süresinden çıkarılan farkı saf ağ RTT diye sunma; driver/pool dahil olabilir.
- Uzak shared DB'de yalnız salt okuma. Yazma/checkpoint mikrobenchmark'ını ayrılmış fixture/test tablolarında yürüt; gerçek run satırını lock ederek normal işleri bozma. Yeni remote fixture/schema yetkisi yoksa o ölçümü atla ve belirt.
- Gerçek Prisma çağrı adedi SQL statement adedi değildir. Yeni atomic SQL/çoklu işlem çözümünde gözlenen metot sayısını gerçek network turuyla karıştırma.

### Gerçek workflow

1. A ve B için birer warm-up ve **en az 3 karşılaştırılabilir ölçümlü koşu** hedefle. 3 örnekte güvenilir kuyruk p95 iddiası yerine ham değer, medyan, min/max ver. Ağ/iş fixture değişkenliği yüksekse tekrar gerekçesini kaydet.
2. A ve B kodu aynı olmalı. Fixture resetlenebiliyorsa sırayı dönüşümlü yap; her geçişte tek cihaz sahibi kontrolünü koru. Reset imkânı yoksa önceki koşunun yan etkisini belgelenmeden yok sayma.
3. Profiler/Perfetto kapsamı iki kolda aynı. UI'daki yoğun polling veya ekstra logcat gibi ek yükleri bir kola ekleme. Profiler export, startup/cleanup ve background upload sürelerini ayrı tut.
4. Her koşuda gerçek step occurrence listesi, action/gate/oracle sonuçları, HTTP/remote iş sayısı, runtime plan hash ve stop reason karşılaştırılır. Farklı branch/erken hata varsa o çift için tüm-run speedup hesaplama; yalnız eş prefix ve eş adım ölçümlerini ayrı sun.

Mevcut komut, repo kökünden; `<...>` alanlarını gerçek değerlerle doldur:

```sh
node scripts/profile-live-workflow.mjs \
  --baseline-run <GECERLI_YENI_BASELINE_RUN_ID> \
  --device R6CW400BC8N \
  --output artifacts/live-profile/local-postgres-campaign/<CAMPAIGN>/<A_VEYA_B>/<TEKRAR>

python3 scripts/analyze-live-profile.py \
  artifacts/live-profile/local-postgres-campaign/<CAMPAIGN>/<A_VEYA_B>/<TEKRAR>/<YENI_RUN_ID>
```

Runner baseline'a doğrudan Prisma ile ve HTTP API üzerinden erişiyor; ikisi farklı DB'ye bakmamalı. Mevcut komutta genel bir `--database-url` seçeneği olduğunu varsayma. Gerekli açık konfigürasyon desteğini önce ekle/test et; parolalı URL'yi komut argümanı yapma.

A/B çıkış kriteri: local lehine veya aleyhine gerçek ölçüm; plan/verdict/cleanup eşliği; güvenli rollback testi. Beklenen iyileşme çıkmazsa yanlış DB hedefi, eski API/dist, pooling, sorgu/lock, profiler kör noktası ve farklı workload'u araştır. Mongo'ya geçerek deney eksenini değiştirme.

## P04 — C: atomik persistence sınırlarını birleştir

### Önce çağrı ve dayanıklılık haritası

Şu yolları yeniden oku:

| Yol | İncelenecek bölüm |
|---|---|
| `packages/bridgeflow-executor/src/index.ts` | executeStep, executeBridgeAction, transition döngüsü, checkpoint/occurrence sırası |
| `apps/api/src/services/bridgeflow-prisma-persistence.ts` | withFence, lockFenceRow, assertFence, occurrence/checkpoint/oracle/final yazımları |
| `apps/api/src/services/oracle-evaluation-worker.ts` | oracle worker yazımları ve revision sahipliği |
| `packages/bridgeflow-executor/src/task3-recovery.test.ts` | recovery sözleşmesi |
| `apps/api/src/services/phase6-prisma-stores.ts` | diğer durable/fence store'ları |
| `apps/api/src/services/run-live-hub.ts` | commit sonrası live event yayımı |

Her yazı için tüketiciyi listele: executor mı, oracle mı, recovery mi, API/history mi? UI'ya ait görünen tablo recovery tarafından okunuyorsa raporlama diye arka plana taşıma.

### Tasarım sınırları

- Öneri: adım başlangıcı/dispatch öncesi gerekli durum ile adım sonucu/sonraki checkpoint'i ayrı atomik sınırlar olarak modelle. Hangi kayıtların beraber commit edilebileceğini mevcut recovery invariant'ları belirlesin; “9 → 3 transaction” önceden zorunlu sayı değildir.
- Aynı güvenli sınıra ait occurrence/checkpoint/transition kayıtlarını tek persistence portu/Unit of Work içinde birleştir. Transaction client'ını alt helper'lara geçir; her helper'ın yeniden `$transaction` başlatmasını önle.
- Tek transaction içinde çok sayıda seri Prisma çağrısı hâlâ pahalı olabilir. Fence row lock ile token/epoch/expiry okumasını tek sorguda birleştirmek, conditional update/returning veya toplu insert olasılıklarını mevcut protokol korunarak değerlendir. Erken optimizasyon için constraint/idempotency denetimini silme.
- Checkpoint revision tam +1 ve geçerli transition denetimini koru. Birleştirilmiş yol, commit failure veya lease değişiminde hiçbir kısmi görünür sonuç bırakmamalı. Worker/executor oracle revision yazımı ve replay/collision davranışı ayrıca korunmalı.
- Live UI event'i ancak ilgili commit başarılı olduktan sonra yayımla. Commit olmadan yeşil history üretme.
- Sahiplik son dispatch sınırında geçerli olmalı; DB işlemleri hızlılaştı diye lease denetimi tamamen kaldırılmaz. Ağ kesintisinde/timeout'ta commit sonucu belirsizse keyfi tekrar dispatch etme.
- Device/remote call transaction dışında kalmalı. Transaction kapandıktan sonraki crash penceresi mevcut durable request/idempotency/recovery modeliyle ele alınır; SQL atomikliği tek başına dış yan etkiye exactly-once sağlamaz.
- Mevcut sequential yolu geri dönüş için koruyan küçük, doğrulanmış bir seçenek veya ayrı geri alınabilir commit kullan. Public API'leri gereksiz yere kırma. Paket ve API'yi birlikte build et.

### Gerekli testler

Gerçek ayrılmış local PostgreSQL üzerinde en az:

1. Atomik batch'in ortasında hata → ilgili kayıtların hiçbiri commit olmaz; live event yok.
2. Yanlış/eski fence token, epoch veya expired lease → yazı ve dispatch reddedilir.
3. İki owner/recovery yarışır → yalnız geçerli sahip ilerler.
4. Aynı request replay → mükerrer action/evidence/transition yok; checkpoint revision yanlış ilerlemez.
5. Commit öncesi, commit sonrası-dispatch öncesi, dispatch sonrası-sonuç commit öncesi crash → mevcut recovery sözleşmesine uygun sonuç. Belirsiz yan etki kör yeniden denenmez.
6. Oracle worker + executor replay ve yeni revision → mevcut collision kuralları korunur.
7. Cancel, timeout ve cleanup yolları; fence kaybında stop/cleanup semantiği.

Gerçek cihaz üzerinde destructive crash deneyi yerine kontrollü action portu + gerçek DB ile crash sınırı testi yap; normal cihaz koşusu ayrı. Yalnız mock test ile persistence atomikliği kanıtlandı deme.

Sonra B ile aynı local kurulumda C koşularını yap. Transaction sayısı, query-call sayısı, DB birleşim süresi, PIN/resolve/gate adımları ve verdict farkını raporla. History transition semantiği düzeltilmişse ayrıca yaz; zamanları ölçmek için eski sentetik marker'lara geri dönme.

## P05 — D: dayanıklı yerel outbox ve toplu raporlama

### İki veri sınıfı

**Çalışmanın doğruluğu için gereken durum:** sahiplik/fence, request idempotency, recovery checkpoint, oracle'ın gerekli kanıtı ve kararına esas kayıtlar. Yerel authoritative DB'de gerekli atomik sınırda commit edilir. Bunlara “rapor” adı verilerek bekleme kaldırılmaz.

**Türetilmiş raporlama/projection:** dashboard akışı, merkezi history kopyası, tanısal ayrıntılar ve mevcut tüketici analizinin gerçekten kritik olmadığını gösterdiği kayıtlar. Bunların merkezde görünmesi workflow ilerlemesi için beklenmez. Yereldeki zorunlu terminal sonuç ile merkezdeki kopyasının görünürlüğü ayrı şeydir.

`publishRunLiveEvent` zaten process içi yayın olabilir; onu sırf adı event diye uzak DB yavaşlığının sebebi ilan etme. Mevcut sistemde ayrı merkezi rapor yazımı yoksa bunu açıkça kaydet. D yeni bir reporting yeteneği ekliyorsa C/D karşılaştırmasına sahte kazanç yazma.

### Minimum uygulanabilir akış

```text
Yerel transaction:
  authoritative durum / sonuç
  + aynı commit'te gerekli outbox kaydı
          ↓ commit başarılı
  executor bir sonraki adıma ilerler

Ayrı worker:
  sınırlı batch claim → reporting sink'e gönder → kalıcı ACK sonrası delivered işaretle
```

- Gerekli olay için authoritative kayıt ile outbox aynı local transaction'da commit edilir. Bellekteki queue tek dayanıklılık katmanı olamaz.
- Kimlikler: stable event ID, origin/install ID, run/occurrence/request ilişkisi, schemaVersion ve anlamlı sequence/revision. Aynı event retry'da aynı kimliği taşır.
- Sink idempotent kabul eder: unique constraint/dedupe ve monotonic projection revision. Geç gelen eski event yeni sonucu geriye çeviremez. At-least-once teslim + idempotent tüketim hedeflenir; ağ üzerinde mutlak exactly-once iddiası yok.
- Worker claim/lease ve batch boyutunu sınırlı tutar; sink network çağrısı boyunca DB transaction/row lock tutmaz. Restart sonrası süresi geçmiş claim yeniden alınır.
- Retry/backoff, maksimum batch/byte, backpressure, disk bütçesi, oldest-pending age ve poison-event davranışı tanımlanır. Teslim edilmemiş zorunlu olay disk basıncında sessizce silinmez. Kapasite dolarsa başlangıç/ilerleme davranışı açık policy ile güvenli hata/degraded olur.
- Sink erişilemiyorsa yerel authoritative durum ve kapasite elverdiği sürece koşu devam eder; merkez UI `sync pending`/gecikme durumunu gösterir. `PRODUCT_PASS` ile `report synced` aynı alan değildir.
- Worker metrikleri: pending/inflight/delivered/retry/dead-letter, oldest age, batch boyutu, send/ACK süresi, DB zamanı, disk büyümesi. Run profiler ALS kapsamı background worker'ı görmeyebilir; worker için ayrı ölçüm ekle. İşi profiler dışına taşıyıp “süre kayboldu” deme.
- Sink'in authority'si yalnız raporlama; merkezi kopya local recovery'yi aynı cihaz için ikinci kez tetiklemez. İşlem durumu iki DB arasında çift yönlü kör replike edilmez.

### Merkezi hedef ve test sınırı

Mevcut desteklenen merkezi reporting endpoint/schema varsa kontratını incele. Yoksa ilk uygulamayı ayrı local reporting DB/service ile tamamla; mevcut uzak DB'ye deneysel tablo veya sink migration'ı uygulama. Gerçek merkez entegrasyonunu NOT_INTEGRATED olarak açıkça raporla. Yeni merkezi deployment/erişim olmadan onu tamamlanmış sayma.

Kontrollü eş yük deneyi: aynı report payload/event kapsamını (değerleri loglamadan) aynı ayrılmış sink'e iki modda gönder: synchronous reporting ve durable asynchronous reporting. Aynı plan ve aynı sink gecikme profiliyle karşılaştır. Gecikme enjeksiyonu yalnız bu reporting sink'ine uygulanır; global ağ/cihaz/iş backend'ine değil. Doğal gecikme ile enjekte edilmiş gecikme sonuçlarını ayrı tut.

Raporla: executor foreground süresi, son olayın merkeze ulaşmasına kadar toplam süre, worker CPU/DB yükü, backlog, veri eşliği. Foreground hızlanıp background tamamlanma süresi artabilir; ikisini de göster.

### Gerekli testler

1. Outbox commit edildikten sonra process ölür → restart sonrası teslim edilir.
2. Sink kabul eder, ACK kaybolur → retry merkezi kaydı çoğaltmaz.
3. Sink offline → local run gereksiz yere beklemez; backlog kalıcı ve görünürdür; tekrar online olduğunda boşalır.
4. Worker claim sonrası ölür / iki worker yarışır → kayıp yok, mükerrer teslim idempotent.
5. Duplicate/out-of-order revision → merkezi durum geriye gitmez.
6. Poison record → diğer run'ları sonsuza kadar bloke etmez; kayıt kaybolmaz; hata görünürdür.
7. Local transaction rollback → orphan report/PASS yok.
8. Local disk/DB unavailable → sahte durable ACK veya sessiz veri kaybı yok.
9. Başarılı drain sonrası beklenen ve teslim edilen event ID kümeleri/payload hash'leri eş; terminal ve evidence reference ilişkileri tutarlı.
10. Mode rollback sırasında pending outbox korunur ve drain edilebilir; config geri alma veri silmez.

## P06 — Doğrulama, ölçüm kalitesi ve teslim

Kaynak/paket değişikliğine uygun komutları çalıştır; bunlar mevcut package script'lerinden doğrulandı:

```sh
pnpm --filter @nesy/bridgeflow-executor build
pnpm --filter @nesy/bridgeflow-executor typecheck
pnpm --filter @nesy/bridgeflow-executor test
pnpm --filter @nesy/api typecheck
pnpm --filter @nesy/api exec vitest run src/services/diagnostics/live-profile-recorder.test.ts
node --check scripts/profile-live-workflow.mjs
git -c core.fsmonitor=false diff --check
```

Yeni persistence/outbox/config testlerini ayrıca çalıştır ve gerçek dosya/komutu RESULT'a yaz. Schema değişiyorsa `@nesy/db` generate/build ve yalnız ayrılmış test DB'de migration doğrulaması gerekir. Tüm entegrasyon testlerini yanlışlıkla uzak shared `DATABASE_URL` ile çalıştırma. UI config/rapor gösterimi değişirse ilgili web typecheck/build/test'i de yap. Testin hiç koşmadığı durumu PASS sayma.

Her ölçümde:

- Monotonic host ölçümü ile history timestamp kapsamını ayrı tut; DB/SDK/ADB/oracle örtüşen süreleri toplama.
- `dropped`, `writeError`, profiler/PID, actual build, plan hash ve artifact dosyalarını kontrol et.
- Her kolun DB hedefini isim/port/instance kimliğiyle doğrula; secret veya müşteri dataset hash'i paylaşma. Girdi fingerprint'leri gerekiyorsa düşük entropili PIN'i tahmin edilebilir raw hash'e dönüştürme; yalnız fixture version veya özel anahtarlı güvenli karşılaştırma kullan.
- `summary.json`/`analysis.json` yeni batch yöntemlerini gerçekten görüyor mu doğrula. Profiler'ın eski `persist*` hook'larına takılmayan yeni yolunu sıfır süre sayma.
- A/B ve B/C için aynı plan/adım/sonuç eşliği sağlanıyorsa `speedup = median(before) / median(after)` ve `% azalma = 100 × (before-after) / before` hesapla. Eşlik yoksa NOT_COMPARABLE yaz.
- Artan duplicate, missing evidence, cleanup/recovery hatası varsa hızlı olması kabul değildir.

Teslim: değişen dosyalar/commit veya patch kimliği, doldurulmuş RESULT.md, sansürlü campaign manifest ve karşılaştırma CSV/JSON, her gerçek run'ın host/artifact dosyaları, test log'ları, rollback talimatı ve son process/DB durumu. Büyük Android trace ve dump'ları RESULT'a gömme; dosya yolunu ver. Başka makineye taşınacaksa yalnız gerekli sansürlü paketi hazırla.

## Önerilen faz checkpoint'leri

| Checkpoint | Sonuçta bulunmalı |
|---|---|
| P00 | Mevcut config/process/build ölçüm haritası |
| P01 | Geçerli fixture veya açık dış bağımlılık |
| P02 | İzole local DB + restore/rollback doğrulaması |
| P03 | A/B ham koşular ve karşılaştırılabilirlik |
| P04 | Atomiklik/fence/recovery testleri + B/C ölçümü |
| P05 | Outbox/sink hata testleri + eş reporting yükü ölçümü |
| P06 | Sonuç, artifact'ler, kalan sorunlar ve son çalışma modu |
