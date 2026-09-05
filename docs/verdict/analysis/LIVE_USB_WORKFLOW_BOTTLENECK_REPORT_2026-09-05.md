# USB cihazda gerçek workflow ölçümü — 5 Eylül 2026

**Sonuç: bu koşuda asıl darboğaz Cockpit/host persistence zinciri.** Ölçülen 245,81 saniyelik queue çalışma aralığının 210,88 saniyesi (%85,79) DB çağrılarının veya transaction'larının içinde geçiyor. Gerçek Bridge isteklerinin tamamı 3,47 saniye. SDK kontrol çağrıları toplam 4,17 saniye; bunun 4,15 saniyesi kendi ADB alt çağrılarında. Bunlar iç içe aralıklar olduğundan kategoriler toplanmamalı.

Kullanıcının istediği adım bazında hızlı UI sürüşü yapılabilir. Ancak **sadece “kanıt bekleme” checkbox'ı eklemek mevcut seri DB maliyetini ortadan kaldırmaz**. Kanıt politikası ile kayıt/dispatch maliyeti ayrı çözülmeli. Bu ölçüm, önceki konuşmadaki “SDK değil, büyük ihtimalle business gate” açıklamasını da daraltıyor: bu koşuda gate dışındaki sıradan adımlar bile çoğunlukla DB bekliyor; gate süresinin içinde de DB işlemleri baskın.

## 1. Gerçekte ne çalıştırıldı?

| Alan | Değer |
|---|---|
| Workflow | `nesy.workflow.full-courier-day` |
| Cihaz | USB `R6CW400BC8N`, Samsung SM_A346E |
| Uygulama | `com.arasdigital.nesymobile.rstest` |
| Bridge APK | `com.verdict.bridge` |
| Referans | `run_3ef0e142-003b-4537-98c1-3939144f3feb` |
| Ayrıntılı ölçülen yeni koşu | `run_1129ab94-bf0c-4528-ae90-5c417af425eb` |
| Plan hash | `sha256:52964e45dbf7b0f24ef9d27d38f79172d080eb60ddb1ddea941bdfee5a0a0abe` |
| History başlangıcı | 07:16:31,537 Türkiye saati |
| History bitişi | 07:20:28,591 Türkiye saati |
| History süresi | **237,054 saniye** |
| Queue execute ölçüm süresi | **245,809 saniye** |
| Çalıştırılan occurrence | **70** |
| Host span | **4.042**, dropped=0, writeError=false |
| Android izi | **250,103 saniye**, yaklaşık 114 MB |
| Sonuç | `INCONCLUSIVE / AUTOMATION_FAILURE / ABORTED` |
| Temizlik | `SUCCEEDED`, scheduler `RELEASED` |

[Gerçek koşu history](http://localhost:4002/automation/nesy.workflow.full-courier-day/runs/run_1129ab94-bf0c-4528-ae90-5c417af425eb).

Run history saati ile profiler saati aynı kapsamı ölçmüyor. Queue ölçümü history başlangıcından yaklaşık **7,403 saniye önce** başlıyor; history bitişinden **1,352 saniye sonra** kapanıyor. Bu farkı “tıklama süresi” veya doğrudan “SDK bootstrap” diye etiketlemedim. API POST/admission öncesi zaman bu queue span'ının dışında.

Referansın sabitlenmiş planı ve kayıtlı girdileri tekrar kullanıldı; idempotency nedeniyle eski koşuyu döndürmemesi için yeni sessionCorrelationId üretildi. Test planı, kanıt kuralları, timeout'lar ve retry davranışı değiştirilmedi. Mobil/SDK/Bridge APK'ları yeniden derlenmedi. Bu çalışma hızlandırma uygulaması değil, çalışan sistemi gerçek çağrı sınırlarından ölçen teşhis altyapısıdır.

### Koşu neden tamamını geçmedi?

`deliver-type-barcode` adımı şu mevcut hata ile durdu:

```text
bridgeflow:unresolved-value-ref:run.input.consignmentNumber
```

Kayıtlı girdilerde `consignmentNumber` bulunmuyor. Bu adımda **gerçek Bridge input komutu gönderilmedi**. Buna rağmen adım toplam 4,137 saniye sürdü; 4,022 saniyesi DB işlemleri, 106 ms'si SDK korelasyon kontrolüydü. Eksik girdinin geç fark edilmesi de gereksiz çalışma yaratıyor.

Sonuç “workflow başarılı” değildir. Workflow kendi hata dalından kapanmış ve temizlik tamamlanmıştır. Barkod değerini tahmin ederek, başka alandan sessizce eşleyerek veya gate atlayarak başarı üretilmedi. İkinci koşuda dört back-office remote operasyonu başarılıydı; buradaki duruş back-office oturumundan kaynaklanmadı.

### İlk deneme ve karşılaştırma sınırı

Önce `run_06f551e8-5702-4439-8d8c-099797cb7bb7` çalıştırıldı. Çalışan eski API process'i dosya değişikliklerini yüklememişti; bu yüzden host ölçümü bağlanmadı. Koşu kesilmeden referans olarak tamamlandı: **192,818 saniye**, `INCONCLUSIVE`; back-office oturumu bulunmadığı için izin kaydı kontrolünde durdu. İlk Android kaydı yaklaşık 181 saniyeyle ve eski 128 MB sınırıyla kısmi kaldı.

İlk koşu kapandıktan sonra API yeniden başlatıldı. Runner'a, profil kodunu yükleyen PID ile API portunu dinleyen PID'nin eşleşmesini zorunlu tutan kontrol eklendi. İkinci koşu gerçekten 4.042 host span üretti. Android sınırı ikinci koşuda 512 MB olarak ayarlandı.

Eski 316,146 saniyelik history, ilk deneme ve ikinci deneme farklı adımlarda durmuş/farklı dalları çalıştırmıştır. Bu üç toplamdan **hızlanma yüzdesi çıkarılamaz**. Bu rapordaki darboğaz sonucu, ikinci koşunun kendi içindeki gerçek zaman ayrıştırmasına dayanır.

## 2. Katmanların ölçülen payı

Her satır kendi kategorisindeki örtüşen aralıkların birleşimidir. DB transaction kendi sorgularını zaten içerir; oracle DB'yi, SDK kontrolü ADB'yi içerebilir.

| Katman | Kapsanan süre | Doğru yorum |
|---|---:|---|
| DB/transaction | **210,877 sn** | Host persistence beklemesi; network/Prisma/transaction/lock dahil |
| Oracle continue + final | 13,108 sn | İçindeki DB işlemleri dahil |
| Remote port | 7,747 sn | Remote runtime portu; saf HTTP değil |
| SDK control | 4,166 sn | Host → uygulama kontrol protokolü |
| SDK control içindeki ADB | 4,150 sn | Üstteki SDK süresinin alt kümesi |
| Bridge client | **3,470 sn** | Pool/transport/cihaz yanıtı dahil gerçek Bridge istekleri |

Ölçülen kategorilerin toplam birleşimi 226,307 saniye; yaklaşık 19,501 saniye bu kategorilerin dışında. Bunun içinde genel host akışı, hedef araması arasındaki beklemeler ve ölçülmeyen hazırlık/kapanış işi bulunabilir. Bu kalan süre saf CPU veya tek bir bileşenin süresi değildir.

### Gerçek Bridge komutları

| Komut | Adet | Toplam | Medyan | En büyük |
|---|---:|---:|---:|---:|
| `find_id` | 70 | 2.314,8 ms | **34,0 ms** | 87,9 ms |
| `input_text` | 4 | 231,2 ms | **60,9 ms** | 74,7 ms |
| `tap_id` | 9 | 778,7 ms | **88,8 ms** | 99,6 ms |
| `find_text` | 2 | 86,1 ms | 43,0 ms | 63,6 ms |
| `tap_text` | 1 | 59,4 ms | 59,4 ms | 59,4 ms |

Bu koşuda Bridge client hattında **full dump veya screenshot komutu kaydedilmedi**. Bu ifade, başka background süreçlerin hiç görüntü/ağaç okumadığı iddiası değildir; ölçülen run bağlamının kapsamıdır.

Önceki konuşmadaki `find_id ≈5–6 ms` gibi değerler bu cihaz/koşu için doğru ölçüm değildir: burada medyan 34 ms. Yine de bu değer, kullanıcıya yansıyan 2–5 saniyelik sıradan adımlardan çok küçüktür. Sadece 50 ms gesture süresini kısaltmak toplam darboğazı çözmez.

### SDK kontrol protokolü

| İşlem | Adet | Toplam | Medyan |
|---|---:|---:|---:|
| `sql_named` | 14 | 1.953,4 ms | 142,1 ms |
| `seed / nesy.binding.correlation` | 16 | 1.893,6 ms | 123,2 ms |
| `reset_state` | 1 | 318,4 ms | 318,4 ms |

Bu 31 üst çağrının altında 32 ADB çağrısı kaydedildi. SDK korelasyonu hızlı UI adımlarında kaldırılabilecek/koşullu hale getirilebilecek bir maliyet olabilir; fakat bu koşuda tüm korelasyonların toplamı yaklaşık **1,89 saniye**. Yaklaşık 211 saniyelik DB kapsamından önce SDK'yı kapatmaya odaklanmak öncelik sırasını ters çevirir.

## 3. DB tarafında ne oluyor?

423 callback transaction kaydedildi. Toplamları 207,881 saniye; transaction medyanı **470,65 ms**, p95 **658,68 ms**. Transaction dışında yapılan DB çağrılarıyla toplam kapsanan DB aralığı 210,877 saniyeye çıkıyor.

Profiler **1.455 Prisma metot çağrısı** gördü; bu sayı PostgreSQL wire seviyesinde kesin SQL statement sayısı değildir. Bir ORM çağrısı birden fazla SQL üretebilir. Transaction başlangıç/commit yaşam döngüsü de ayrıca sorgu sayısı olarak loglanmıyor.

| Prisma çağrısı | Adet | Medyan |
|---|---:|---:|
| `bridgeFlowRunRuntime.findUnique` | 563 | 87,66 ms |
| `$queryRaw` — bu persistence yolundaki fence row lock | 423 | 86,01 ms |
| `bridgeFlowRunRuntime.updateMany` | 141 | 98,46 ms |
| `bridgeFlowStepOccurrence.upsert` | 140 | 90,54 ms |
| `bridgeFlowActionTransition.upsert` | 116 | 88,92 ms |

Mevcut [withFence uygulaması](</Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobileCocpit/apps/api/src/services/bridgeflow-prisma-persistence.ts:867>) her kayıt için şu yolu izliyor:

```text
transaction aç
  → run satırını SELECT ... FOR UPDATE ile kilitle
  → fence token/epoch/expiry oku ve doğrula
  → occurrence / checkpoint / transition yaz
transaction commit
```

Tek bir action'ın çevresinde bu işlem defalarca seri bekleniyor. Buradan “PostgreSQL CPU'su yavaş” sonucu çıkmaz. İstemci/server mesafesi, transaction başlatma/commit, havuz ve kilit beklemeleri ayrı server/network ölçümü ister. Ancak **Cockpit'in çok sayıda seri persistence turu yürüttüğü ve bu turların duvar saatini tükettiği doğrudan ölçülmüş durumda**.

Transaction span'larının çocuk sorgular dışında kalan toplam self süresi 72,85 saniye. Bunu “72,85 saniye commit” diye etiketlemiyorum; başlangıç/commit/havuz/istemci/diğer callback boşlukları ayrıştırılmış değil.

## 4. Bir PIN yazmanın gerçek zaman çizelgesi

`auth-enter-pin`: toplam **4.361,4 ms**; DB **4.117,6 ms**; gerçek Bridge **116,9 ms**; SDK control **116,6 ms**; oracle **0 ms**.

| Sıra | İş | Yaklaşık süre |
|---|---|---:|
| 1 | Başlangıç occurrence kaydı | 407 ms |
| 2 | Recovery checkpoint | 509 ms |
| 3 | `RECEIVED` kaydı | 423 ms |
| 4 | `TARGET_RESOLVED` kaydı | 446 ms |
| 5 | `GESTURE_DISPATCHED` kaydı | 440 ms |
| 6 | `GESTURE_COMPLETED` kaydı | 419 ms |
| 7 | SDK korelasyon kontrolü | 117 ms |
| 8 | Gerçek Bridge `find_id` | 42 ms |
| 9 | Gerçek Bridge `input_text` | 75 ms |
| 10 | `EFFECT_VERIFIED` kaydı | 487 ms |
| 11 | Recovery checkpoint | 558 ms |
| 12 | Bitiş occurrence kaydı | 434 ms |

Bu adım **zaten business gate beklemiyor**. “Kanıtsız hızlı geç” işaretlense fakat aynı 9 transaction kalsa, hızlanmanın büyük bölümü gerçekleşmez.

Önemli history sorunu: [executor pre-effect transition döngüsü](</Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobileCocpit/packages/bridgeflow-executor/src/index.ts:1242>), `GESTURE_COMPLETED` dahil kayıtları **bridge.act çağrısından önce** yazıyor. Yeni trace bunu gerçek sıralamayla doğruladı. Bu kayıtların `atMs` değerleri cihaz callback zamanı olarak kullanılamaz. Raporda Bridge timing doğrudan `BridgeClient.send` üzerinden alındı.

## 5. Kanıt yoğunluğundan bağımsız yavaş adımlar

| Adım | Toplam | DB | Bridge | Oracle |
|---|---:|---:|---:|---:|
| `auth-resolve-pin-field` | 2.804,8 ms | 2.747,8 ms | 47,5 ms | 0 |
| `auth-enter-pin` | 4.361,4 ms | 4.117,6 ms | 116,9 ms | 0 |
| `route-check-already-selected` | 1.863,7 ms | 1.860,8 ms | 0 | 0 |
| `auth-tap-submit` | 9.243,7 ms | 9.006,7 ms | 91,6 ms | 4.647,2 ms |
| `deliver-type-barcode` — eksik girdi | 4.136,9 ms | 4.021,7 ms | 0 | 0 |

`auth-tap-submit` satırındaki DB ve oracle toplanmaz: 4.647 ms oracle süresinin yaklaşık **4.633 ms'si DB aralıklarıyla örtüşüyor**. Bu koşu için “login 4,6 saniye boyunca backend fact'ini bekledi” demek yanıltıcı olur. Gate worker'ın persistence çalışması da gate latency'si olarak görünüyor.

İkinci büyük hedef: `visit-resolve-search-toggle`, **14,249 saniye**. Bunun 3,647 saniyesi DB; generic target-resolution portu 10,599 saniye. Trace, art arda `find_id` çağrılarından sonra bir `tap_id` ve yeni aramaları gösteriyor. Bu, kod analizinde görülen ilk arama deadline'ından sonra overlay müdahalesi yoluyla uyumlu. Her `find_id` yavaş değil; **aranan yüzey mevcut değilken polling/deadline davranışı** büyük süre üretiyor.

## 6. Android tarafı: SDK için hâlâ bakılacak yer var mı?

Evet. Native scheduler izinde:

| Process/thread | Scheduled CPU |
|---|---:|
| Ana uygulama process'i | 37,160 CPU saniyesi |
| Önceki uygulama process'inin kısa kalan bölümü | 0,162 CPU saniyesi |
| Bridge process'i | 1,940 CPU saniyesi |
| Uygulama ana thread'i | 10,954 CPU saniyesi |
| `verdict-wal-fsy` thread'i | **7,723 CPU saniyesi** |
| `verdict-acks-wr` thread'i | 0,692 CPU saniyesi |

Thread satırları process satırlarının alt kümesidir. CPU süreleri çekirdekler üzerinde toplanır; bunları workflow duvar saatine eklemeyin. `verdict-wal-fsy`, kaynakta [FsyncWorker'ın `verdict-wal-fsync` thread'i](</Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-core/src/main/kotlin/com/verdict/sdk/core/FsyncWorker.kt:225>) ile eşleşiyor. Thread yalnız disk fsync sistem çağrısını çalıştırmadığı için 7,723 saniyeyi “disk fsync bekleme” diye yorumlamıyorum.

Bu gözlem SDK'nin ücretsiz olduğu iddiasını desteklemiyor. WAL worker CPU maliyeti, event hacmi, ACK/gap işlemleri ve wake-up sayısı ayrıca incelenmeli. Fakat bu ölçüm, WAL worker'ın her UI adımına saniyeler eklediğini veya ana thread'i bloke ettiğini kanıtlamıyor. Önce DB/dispatch yolu, sonra bağımsız WAL CPU incelemesi doğru sıra.

Android trace parser'da sorgulanan lost/drop/overrun/parse_error sayaçlarında pozitif kayıt çıkmadı. Bu, tanımlanan sayaçlar için kontrol sonucudur; bütün olası veri eksikliği türlerine garanti değildir. İkinci Android kaydı süre ve dosya boyutu açısından koşuyu kapsadı; host ve Android monoton saatleri senkron kabul edilmedi.

## 7. Sistemi bozmadan hızlandırma sırası

Bu bölüm **öneridir; performans değişiklikleri henüz uygulanmadı ve kazançları ölçülmedi**.

### P0 — Eksik girdiyi cihazda işe başlamadan bul

Derlenmiş plandaki gerekli `run.input.*` referanslarını, branch/koşullu gereklilikleri de gözeterek run admission/preflight aşamasında doğrula. `consignmentNumber` eksikse kullanıcıya tam alan adı ve ilgili adımı göster. Planın yalnız erişilebilir bölümünde zorunlu olan girdiyi her koşuda zorunlu sayma.

Kazanç: hatalı girdiye sahip bu tip koşuların dakikalar çalışıp en sonunda durmasını önlemek. Bu hız kazanımı normal geçerli koşudaki tap'i hızlandırmakla aynı değildir.

### P1 — Fence güvenliğini koruyarak persistence tur sayısını azalt

Adımın aynı dayanıklılık sınırına ait kayıtlarını tek fenced transaction içinde yazmayı tasarla. Özellikle occurrence/checkpoint ve birbirinden ayrı commit gerektirmeyen transition kayıtları birlikte ele alınmalı. Bir transaction içinde birden fazla ORM çağrısı hâlâ birden fazla network turu yaratabilir; toplu insert/koşullu update veya DB tarafında birleştirme ayrıca ölçülmeli.

Korunması gerekenler: gerçek dispatch öncesi execution ownership, token/epoch/expiry kontrolü, crash sonrası recovery davranışı, idempotency, cleanup ve final verdict'in kalıcı kayıtla tutarlılığı. DB transaction'ını gesture veya uzun fact beklemesi boyunca açık tutma; satır kilidiyle cihaz/remote bekleme. Fence'leri toptan kaldırmak veya bütün kayıtları fire-and-forget yapmak güvenli hızlandırma değildir.

PIN adımında 9 transaction var. Aynı ortalama maliyetle 9 → 3 sınırına inmek yalnız kaba aritmetikle yaklaşık 2,7 saniyelik transaction süresini hedefleyebilir. **Bu bir ölçülmüş kazanç veya 3 transaction'ın yeterli olduğuna ilişkin tasarım kararı değildir.** Hangi kayıtların atomikleşebileceği recovery invariants ile doğrulanmalı.

### P1 — DB gecikmesinin kaynağını ayrı ölç

Cockpit ile DB'nin yerleşimini, transport gecikmesini ve connection pool/transaction/row-lock payını ölç. 86–99 ms medyan sorgu çağrıları bu kadar sık seri beklenince pahalılaşıyor. Aynı kodu farklı DB yerleşiminde karşılaştırmak, ağ maliyeti ile sorgu/lock maliyetini ayırır. Bu rapor tek başına hangi DB deployment değişikliğinin doğru olduğunu belirlemiyor.

### P1 — Gerçek transition zamanı ve oracle persistence

`GESTURE_DISPATCHED/COMPLETED` kayıtları gerçek olay sınırlarına taşınmalı veya açıkça niyet/sentetik kayıt olarak yeniden adlandırılmalı. İşlem bittikten sonra geçmişi gerçekte oluşmamış zamanlarla doldurmak teşhisi bozar.

Oracle'da aynı gözlemi yeni revision gibi tekrar kalıcılaştırma, değişmeyen `UNKNOWN` değerlendirmelerinin yazım sıklığı ve read-after-write turları incelenmeli. Terminal karar ve gerekli kanıtın dayanıklılığı korunmalı. Sadece polling aralığını büyütmek yazı sayısını azaltabilir ama gerçek hazır oluşa tepkiyi yavaşlatabilir; hedef değişiklik odaklı değerlendirme ve kontrollü kayıt birleştirmesi.

### P2 — UI hedef çözümleme ve overlay politikası

Bilinen overlay türlerinde hızlı, dar kapsamlı kontrolü ilk 10 saniyelik başarısız aramadan önce veya ilk birkaç başarısız okumadan sonra değerlendir. Genel “her popup'ı kapat” davranışı uygulama hatasını gizleyebilir; dismiss işlemi ve nedeni history'de kalmalı.

Önceden çözülmüş target ile action arasında gereksiz yeniden aramayı azaltmak için kısa ömürlü target handle/epoch düşün. Stale node, bounds, enabled/actionable güvenliğini koru. Bu koşuda toplam arama komut maliyeti küçük; 10 saniyelik yanlış yüzey beklemesi daha öncelikli.

### P2 — Kullanıcının istediği adım seçeneği

Tek bir “kanıtı kapat” boolean'ı yerine adımda şu çalışma politikasını görünür kıl:

| Mod | İlerleme koşulu | İş kanıtı | Rapor |
|---|---|---|---|
| İşlemi kanıtla | Kontratın continuation ve gerekli oracle koşulları | Gerekli APP/LOCAL/REMOTE | Yalnız ispatlanan kapsamda ürün hükmü |
| Hızlı UI kontrolü | Dar UI hedefi/sonuç node'u | Bu adım için beklenmez | UI sonucu |
| Yalnız aksiyonu gönder | Dispatch/transport sonucu; hedef yüzey assertion'ı yok | Beklenmez | `DISPATCHED_UNVERIFIED` benzeri açık sonuç |

Üçüncü seçenek kullanıcıya verilebilir. “Kanıtsız sürüş yapılamaz” teknik bir zorunluluk değildir. Fakat komutun kabulünü login/teslimat başarısı diye raporlamak doğru olmaz. Bu mod testin ara navigasyon adımlarında kullanılabilir; sonraki bağımlı adımın kendi gerekli yüzey/güvenlik koşulu yine gerekir. Yanlış yüzeyde kalan bir akışın sonraki hatası kullanıcıya gösterilmeli.

Örneğin login bölümünde yalnız submit checkbox'ını değiştirmek, sonraki `auth-read-app-session`, `auth-read-local-session`, `auth-verify-backend-session`, `auth-assert-login` adımlarını kaldırmaz. Kullanıcıya **login doğrulama grubunu** hızlı UI modunda çalıştırma seçeneği sunulacaksa bu bağımlı adımların hangilerinin kapsam dışı kaldığı compiler/plan preview'de görünmeli. PIN alanını bulma, PIN girme ve gereken minimum giriş ekranı senkronizasyonu kalır.

Sonraki teslimat adımı iş kanıtı istiyorsa SDK/WAL'ı ekran bazında açıp kapatmak gerekmez. Seçenek bekleme ve assertion politikasını değiştirir. SDK'sız UI-only müşteri de desteklenebilir; o durumda queue readiness ve kontrol/query adımlarının SDK zorunluluğu capability bazında çözülmeli. “Checkbox = bütün sistemde SDK_READY atla” uygulanmamalı.

Release gate'in sabit zorunlu kontrolleri sessizce gevşetilemez. Keşif/UI koşusunda doğrulama kapsamını değiştirmek serbest olabilir; bunun ürettiği sonuç seçilen kapsamı açıkça taşımalı. İş kanıtı azaltılan eski workflow'a aynı kapsamda `PRODUCT_PASS` yazılmaz. Karma koşuda adım/grup bazında proof coverage gösterilir.

### P3 — SDK/WAL ve korelasyon

UI-only ve hiçbir downstream tüketicisi olmayan korelasyon yazımlarının koşullu yapılması değerlendirilebilir. İş kanıtına geçmeden gerekli bağlam kurulmalı; eski occurrence fact'lerinin yeni adıma taşınması engellenmeli. WAL worker CPU incelemesi event türü/üretim hacmi ve worker işlevleriyle yapılmalı; thread adı tek başına root cause değildir.

## 8. Kurulan ölçüm sistemi

Kullanım: [LIVE_WORKFLOW_PROFILING.md](</Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobileCocpit/scripts/LIVE_WORKFLOW_PROFILING.md>).

```sh
node scripts/profile-live-workflow.mjs \
  --baseline-run run_3ef0e142-003b-4537-98c1-3939144f3feb \
  --device R6CW400BC8N \
  --output artifacts/live-profile/yeni-olcum

python3 scripts/analyze-live-profile.py artifacts/live-profile/yeni-olcum/run_YENI_ID
```

Bu komut gerçek yeni workflow çalıştırır. Salt analiz için mevcut artifact klasöründe yalnız ikinci komut kullanılabilir. Bir sonraki tam teslimat tekrarında gerekli girdiler önce mevcut ürün akışından düzeltilmeli; runner baseline girdisini sessizce değiştirmez.

Ölçüm varsayılan kapalı; tek kullanımlık device/workflow eşleşen arm ile açılır. AsyncLocalStorage üzerinden gerçek metot çağrıları parent/step ilişkisiyle izlenir. PIN, SQL parametreleri, remote request/response gövdeleri kaydedilmez. JSONL, özet JSON ve Chrome/Perfetto host timeline üretilir. Android trace ayrı alınır. Tanısal başlangıç/export hatalarının workflow sonucunu değiştirmemesi için koruma vardır.

Bu sürüm mevcut prototip metotlarına hook bağlayan teşhis aracıdır. Metotlar değiştiğinde güncellenmelidir. Kalıcı ürün telemetry katmanında açık observer portları tercih edilmeli. Background worker'lar run async context dışında kalabilir; bu işleri tamamen ölçtüğü iddia edilmiyor. Trace toplamanın ek yükü vardır; tekrarlı eş koşullu A/B olmadan profiler overhead yüzdesi verilmedi.

## 9. Artifact'ler ve doğrulama

- [Adım ve komut süre tablosu](</Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobileCocpit/artifacts/live-profile/2026-09-05-usb-instrumented/run_1129ab94-bf0c-4528-ae90-5c417af425eb/TIMINGS.md>)
- [Ham host olayları](</Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobileCocpit/artifacts/live-profile/2026-09-05-usb-instrumented/run_1129ab94-bf0c-4528-ae90-5c417af425eb/events.jsonl>)
- [Host timeline](</Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobileCocpit/artifacts/live-profile/2026-09-05-usb-instrumented/run_1129ab94-bf0c-4528-ae90-5c417af425eb/trace.json>)
- [Android CPU/scheduler analizi](</Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobileCocpit/artifacts/live-profile/2026-09-05-usb-instrumented/android-analysis.csv>)
- [Android sistem izi](</Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobileCocpit/artifacts/live-profile/2026-09-05-usb-instrumented/android.pftrace>)
- [Run sonuç snapshot'ı](</Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobileCocpit/artifacts/live-profile/2026-09-05-usb-instrumented/run-snapshot.json>)

Doğrulama: API TypeScript kontrolü başarılı; profiler'ın 4 testi başarılı. Testler kapalıyken orijinal promise'in korunmasını, örtüşen span'larda doğru self hesabını, nested callback transaction/this davranışını, exception kimliğinin korunmasını, gizli parametrelerin kaydedilmemesini, eşleşen arm'ın tüketilmesini ve output başlatılamadığında workflow'un yine çalışmasını kapsıyor. Runner JavaScript syntax kontrolü başarılı. Android SQL analizi gerçek dosya üzerinde çalıştırıldı. Cihazda gerçek yeni run ve host trace üretimi ayrıca doğrulandı.

Performans optimizasyonu uygulanmadı; mevcut workflow'un duruş nedeni düzeltilmedi. Ölçüm sistemi ve analiz hazır. Bir sonraki değişikliğin başarısı aynı girdi/plan/cihaz koşullarında, gereken proof ve recovery davranışı korunarak ölçülmeli.
