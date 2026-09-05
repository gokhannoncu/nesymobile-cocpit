# Adım bazında hızlı sürüş, seçilebilir doğrulama ve performans dönüşümü

**Tarih:** 5 Eylül 2026  
**Kapsam:** NesyMobile, uygulama içi Verdict SDK, Verdict Bridge, NesyMobileCocpit, yayınlanmış Nesy Courier paketi ve çalışan sistemin koşu kayıtları.  
**Çalışma türü:** Kod ve kayıt analizi; önerilen tasarım ve uygulama sırası. Uygulama kodu, workflow, paket, veritabanı şeması ve çalışan servisler değiştirilmedi. Yeni cihaz koşusu başlatılmadı.

## 1. Karar: Evet, bazı adımlar doğrulamasız çalışabilmeli

İstediğin özellik yapılabilir ve ürünün iş kanıtı yeteneğini ortadan kaldırmaz. Bir workflow içinde login yalnız hazırlık olabilir; aynı workflow içindeki teslimat ise ayrıntılı doğrulanabilir. Kullanıcı login ekranlarını gerçekten sürüp login'in APP/LOCAL/REMOTE doğrulamalarını beklememeyi seçebilmelidir.

**Önerim, aynı motor içinde üç açık seçenek sunmak:**

1. **İş doğrulaması:** Akışın tanımlı iş koşullarını doğrula.
2. **Yalnız UI doğrulaması:** Seçilmiş ekran/node beklentisini doğrula.
3. **Yalnız aksiyon:** Komutu uygula, o aksiyonun UI veya iş sonucuna ayrıca assertion çalıştırma.

Üçüncü seçenek gerçek bir ihtiyaçtır; zorunlu bir UI assertion'ını farklı isimle geri getirerek bu isteği karşılamış olmayız. Komutun tamamlanma cevabı, doğru hedefe yönelme ve sonraki komutun uygulanabilir olması yürütmenin ihtiyaçlarıdır. Bunlar “login başarılı oldu” iddiası değildir.

**Ancak yalnız checkbox eklemek hızı çözmeyecek.** Örnek koşuda ağır iş doğrulaması bulunmayan basit adımlar da saniyeler sürüyor. En yüksek öncelikli ortak sorun, host tarafındaki çok sayıdaki ardışık kalıcı kayıt ve kontrol turudur. Hız dönüşümünü iki ayrı ama birlikte teslim edilen iş olarak ele almak gerekir:

- Kullanıcının istemediği doğrulamaları ve yalnız o doğrulamaları besleyen işleri çalıştırmamak.
- Kanıtlı/kanıtsız bütün adımların ortak yürütme maliyetini azaltmak.

SDK'yı ekran bazında kapatmak bu iki işin yerine geçmez. SDK'sız UI testi ayrıca desteklenebilir; mevcut koşu başlangıcı ve kontrol bağımlılıkları bunun için plan bazında ayrıştırılmalıdır.

## 2. İncelemenin dayanağı ve sınırları

### 2.1 Okunan sistemler

| Sistem | İncelenen yer |
|---|---|
| Cockpit | NesyMobileCocpit: editor, compiler, workflow sözleşmesi, executor, Prisma persistence, readiness, oracle worker, run read model |
| Mobile | NesyMobile: automation bootstrap, SDK facade/engine kurulumu, App Adapter sorguları ve kritik olay üreticileri |
| Bridge | NesyMobile/verdict-bridge: Android accessibility aksiyonları, protokol, node bekleme ve hedef doğrulama |
| Yayınlanmış paket | API'den nesy.courier@1.45.1; makro genişletmeleri ve oracle tanımları |
| Çalıştırılmış plan | Koşunun tam plan hash'iyle, veritabanından salt okunur alınan 102 adımlı compiled plan |

İnceleme anındaki checkout referansları:

- Cockpit: production — 3dc961fec471a45c35b654a1d0c08e75db280b0f.
- Mobile/Bridge: feature/verdict-sdk — 78d5fbaf094d0c7ffa0e51cf0f10181d3d196028.

Bunlar inceleme anındaki HEAD referanslarıdır; koşudaki kurulu APK'ların bu commit'lerle üretildiğini kanıtlamaz. Koşuda buildRef boş, protokol sürümleri 1. Tarihsel süreleri API'den; mevcut davranışın açıklamasını checkout'taki koddan aldım. Kaynak kod ile kurulu APK arasında tam binary eşlemesi yapılmadı.

### 2.2 Kullanılan salt okunur erişimler

API tabanı: http://localhost:4001/api/verdict

- GET /runtime/runs?limit=20
- GET /runtime/runs/run_3ef0e142-003b-4537-98c1-3939144f3feb
- Aynı koşunun /telemetry, /evidence-journey ve /target-resolutions uçları.
- GET /runtime/domain-packs/nesy.courier/1.45.1
- Veritabanında planHash ile VerdictCompiledPlan.findUnique.
- Mevcut bağlantı gecikmesini görmek için altı adet SELECT 1.

HTTP body metinleri istenmedi; telemetri cevabında withheld durumunda bırakıldı. Rapora PIN, token, müşteri payload'ı veya gönderi bilgisi aktarılmadı.

Koşu listesi bu sorguda **bir kayıt** döndürdü. Buradaki sonuçlar çok koşulu p95/p99 veya A/B performans testi değildir.

### 2.3 Bulguları nasıl okumalı?

- **Ölçülen:** Kayıtların zaman farkları, adetleri, durumları, güncel SELECT 1 ölçümü.
- **Kodda doğrulanan:** Kaydın nasıl yazıldığı, hangi bağımlılığın çağrıldığı, compiler'ın davranışı.
- **Güçlü çıkarım:** Kayıt gecikmeleri ile senkron persistence yolunun yavaşlığa önemli katkı yaptığı.
- **Öneri/hedef:** Yeni modlar, optimizasyonlar ve kabul bütçeleri. Bunlar henüz uygulanmış veya ölçülmüş kazanç değildir.

Önceki konuşmadaki mimari görüşler bu analiz için bağlayıcı talimat kabul edilmedi. Özellikle “kanıtsız sürüş olmamalı” ve “genel testte mutlaka yavaş kalırsın” sonuçlarını mevcut ihtiyacın ve kodun yerine koymadım.

## 3. Örnek koşunun gerçek durumu

[Koşuyu Cockpit'te aç](http://localhost:4002/automation/nesy.workflow.full-courier-day/runs/run_3ef0e142-003b-4537-98c1-3939144f3feb)

| Alan | Değer |
|---|---|
| Workflow | Full Courier Day, editör sürümü 11 |
| Paket | nesy.courier@1.45.1 |
| Plan hash | sha256:52964e45dbf7b0f24ef9d27d38f79172d080eb60ddb1ddea941bdfee5a0a0abe |
| Paket digest | sha256:97d8e63627d8819735c64aa81029ef78cae5ce818a85a398100ee0b18254e9a2 |
| Compiled at | 2026-09-03 08:29:11.876 UTC |
| WorkflowRun oluşturulma | 08:29:12.873 UTC |
| WorkflowRun startedAt | 08:29:19.930 UTC |
| WorkflowRun completedAt | 08:34:36.076 UTC |
| Kaydedilmiş yürütme süresi | **316.146 ms = 5 dakika 16,146 saniye** |
| Oluşturulmadan startedAt'e | 7.057 ms; başlangıç/queue/readiness evreleri ayrı span olmadığı için ayrıştırılamıyor |
| Launch profili | nesy.launch.cold-real-login |
| Çalışan cihaz | Samsung SM A346E |
| Plan / gözlenen occurrence | 102 plan adımı / 86 occurrence |
| Workflow durum etiketi | completed |
| Ürün hükmü | **INCONCLUSIVE — EVIDENCE_INSUFFICIENT** |
| Son aksiyon kapısı | deliver-tap-scan-confirm: TIMED_OUT |
| Cleanup | auth-clear-session: FAILED |
| Operasyonel durum | NEEDS_ATTENTION |
| Release gate | false |

**completed burada “bütün teslimat kanıtlandı” anlamına gelmiyor.** Teslimatın sonraki tamamla/onayla adımlarına ulaşılmamış. 102 ile 86 arasındaki fark da yalnız hata sayısı değildir; dallarda çalışmayan adımlar da planın içindedir. Gate timeout'undan sonra cleanup çalışmış.

### 3.1 Sürenin çakışmayan kaba dağılımı

| Aralık | Süre | Açıklama |
|---|---:|---|
| 86 occurrence'ın started_at → completed_at toplamı | 274,151 sn | Adımların içindeki cihaz, sorgu, gate, persistence vb. birleşik süre |
| Ardışık occurrence'lar arasındaki 85 boşluk | 39,468 sn | Medyan 433 ms; 380–1.106 ms aralığı |
| Run başlangıcı → ilk occurrence | 0,889 sn | Başlangıç sınırının dışında kalan bölüm değil; startedAt sonrası |
| Son occurrence → run kapanışı | 1,638 sn | Kapanış işi |
| **Toplam** | **316,146 sn** | Birbirini dışlayan aralıkların toplamı |

Adım completed_at alanı, terminal occurrence kaydı DB'ye gönderilmeden önce üretiliyor. Bu nedenle adımlar arası 39,468 saniyeyi “motorun sleep süresi” diye okumak yanlış olur; son kaydın tamamlanması ve geçiş işi de bu aralığa düşer. [K4]

### 3.2 Adım türlerine göre ölçüm

Aşağıdaki tablo yalnız occurrence iç sürelerini toplar; yukarıdaki boşlukları ayrıca içermez.

| Tür | Adet | Toplam | Medyan |
|---|---:|---:|---:|
| BRIDGE_ACTION | 23 | 123,767 sn | 4.068 ms |
| RESOLVE_TARGET | 23 | 67,610 sn | 2.452 ms |
| SDK_QUERY | 15 | 27,791 sn | 1.878 ms |
| ASSERT_FACT | 6 | 14,315 sn | 2.453 ms |
| WAIT_EVENT | 6 | 12,861 sn | 2.100 ms |
| CONDITION | 6 | 11,023 sn | 1.540 ms |
| REMOTE_ACTION | 4 | 10,329 sn | 2.574,5 ms |
| ANNOTATE | 1 | 2,621 sn | 2.621 ms |
| WAIT_ANY | 1 | 2,292 sn | 2.292 ms |
| CLEANUP | 1 | 1,542 sn | 1.542 ms |

**En ayırt edici ölçüm:** Açık continueGate/finalOraclePolicy taşımayan ve WAIT türünde de olmayan 67 adım toplam **188,922 saniye** sürmüş. Bu, koşunun yaklaşık %59,8'i. “Bu adımlar hiçbir veri okumuyor” demek değildir; SDK_QUERY, CONDITION ve hedef bulma gibi işleri içerir. Fakat bu taban maliyeti business oracle'ı kapatarak ortadan kaldıramazsın.

Sadece koşulu değerlendiren CONDITION medyanının 1,54 saniye; sadece ANNOTATE adımının 2,621 saniye olması, odağı doğrudan Android tap hızına koymamamız gerektiğini gösteriyor.

### 3.3 Oracle ve bekleme kayıtları

- 61 oracle kaydı var; bunlar 61 ayrı uzun iş doğrulaması değil.
- 49 kayıt CONTINUE_GATE / UNKNOWN.
- 5 kayıt CONTINUE_GATE / SATISFIED.
- 1 kayıt CONTINUE_GATE / TIMED_OUT.
- 6 kayıt FINAL_ORACLE / SATISFIED.
- Son teslimat kapısı tek başına 33 oracle kaydı üretmiş: 32 UNKNOWN + 1 TIMED_OUT.
- 7 wait kaydı EXPECTED_MATCH durumunda. Bu tablo explicit WAIT adımlarını gösterir; bütün continue gate'lerin süresi burada bulunmaz.

Telemetride 65 HTTP çağrısı var: HTTP p50 150 ms, p95 554 ms ve kayıtlı HTTP hata oranı 0. Bu değerler bütün koşunun veya iş başarısının ölçümü değildir. Çağrılar çakışabileceği için sürelerini toplayıp run süresinden çıkarmak da doğru değildir.

**Ölçüm boşlukları:** spans alanı boş; span ölçümü UNAVAILABLE. Target-resolution API'si kayıt bulunmadığını ve partial=true döndürüyor. Diagnostic capture listesi boş, ölçüm UNAVAILABLE. Buradan “hiç screenshot alınmadı”, “crash olmadı” veya “Bridge şu kadar ms sürdü” sonucu çıkmaz.

## 4. En önemli performans bulguları

### 4.1 P0 — Cihaz aksiyonundan önce çok sayıda senkron DB turu var

Executor her adımın başında occurrence ve recovery checkpoint yazar. Bridge aksiyonunda ayrıca fence kontrolü ve dört transition kaydını sırayla bekler. Sonra bir fence kontrolü daha yapıp cihaz portunu çağırır. Sonuçta terminal transition, varsa gate/oracle kaydı, ikinci checkpoint ve terminal occurrence yazılır. [K3]

Prisma persistence'ta bu yazıların önemli bölümü withFence içinden geçiyor:

~~~text
transaction aç
  → run satırını FOR UPDATE ile kilitle
  → lease/fence bilgisini oku ve doğrula
  → ilgili kaydı yaz
transaction kapat
~~~

Checkpoint yolu bunun içinde ayrıca mevcut checkpoint'i okuyor ve revision koşuluyla update yapıyor. Bunlar küçük, fakat çok sayıda ve ardışık işlemler. Aynı run satırını kilitleyen worker'lar da birbirini bekletebilir. Bu olası bekleme ayrıca ölçülmeli. [K4]

**Koşudaki gözlem:** 23 Bridge aksiyonunun sentetik GESTURE_COMPLETED zamanından ilgili DB satırının created_at zamanına kadar medyan 1.531 ms; aralık 1.378–1.948 ms. Bu aralık, kodda cihaz dispatch'inden önceki seri kayıt bölümüne denk geliyor. Tüm 23 aralığın toplamı 35,632 saniye.

Bu 35,632 saniye:

- Zaten 316,146 saniyenin içindedir; tekrar eklenmez.
- Saf DB CPU süresi değildir; transaction, ağ, lock ve host zamanlaması karışımıdır.
- Tamamı kaldırılabilir diye kabul edilemez; gerekli dayanıklılık sınırları korunmalıdır.
- Yine de, tap'in fiziksel 50 ms süresinden çok daha önemli bir adaydır.

**Güncel salt okunur DB ölçümü:** SELECT 1 örnekleri 150,35 / 82,35 / 89,99 / 82,21 / 79,62 / 78,52 ms. İlk örnek sonrası beş ölçümün medyanı 82,21 ms. Bu, bugünkü bağlantının küçük bir round-trip'i bile ücretsiz yapmadığını gösterir. Tarihsel koşudaki transaction sürelerini bununla bire bir hesaplayamayız.

**Önerilen değişim:**

1. DB pool bekleme, transaction açılış, lock bekleme, sorgu ve commit sürelerini ayrı ölç.
2. Host–DB yerleşimini incele; yürütmenin kritik verisini düşük gecikmeli bağlantıda tut.
3. Adım başı occurrence + checkpoint gibi birlikte atomik olması gereken kayıtları tek persistence operasyonunda birleştirmeyi tasarla.
4. Adım sonu terminal sonuç + checkpoint'i aynı şekilde birleştir.
5. Dört transition için dört ayrı transaction yerine gerçek zamanlı olaylarla beslenen toplu kayıt yolu tasarla.
6. UI live feed ve ayrıntılı gözlem kaydının gereksiz işlerini kritik yoldan çıkar.

**Korunacak sınır:** Kalıcı intent, lease/fence ve belirsiz etkiden sonra kör replay yasağı kaldırılmayacak. DB yazılarını topluca fire-and-forget yapmak crash/recovery semantiğini bozar. Optimizasyon, aynı garantiyi daha az round-trip ile vermelidir.

### 4.2 P0 — “Jest tamamlandı” zamanlarının bir bölümü sentetik

buildPreEffectTransitions, RECEIVED / TARGET_RESOLVED / GESTURE_DISPATCHED / GESTURE_COMPLETED işaretlerini cihaz aksiyonu çağrılmadan önce oluşturuyor. Örnek kayıtta bu dört işaret aynı timestamp'e sahip. [K3]

Örnek: auth-tap-submit için:

| Olay | Occurrence başlangıcına göre |
|---|---:|
| Dört sentetik host işaretinin zamanı | +995 ms |
| GESTURE_COMPLETED satırının created_at zamanı | +2.526 ms |
| EFFECT_VERIFIED host işareti | +2.917 ms |
| Adımın bitişi | +8.126 ms |

Burada +995 ms “cihaz jesti tamamladı” demek değildir. Önceki konuşmada önerilen “host gönderdi / Bridge bitti / gate kapandı” ayrımını mevcut kolonlarla doğrudan yapmak güvenilir olmaz.

Manager'ın kendi kodu da protokol v1'in gestureStartMonoTs ve gestureEndMonoTs alanlarını göndermediğini açıkça belirtiyor. Porttaki effectVerified şu anda terminal SUCCEEDED, method bilgisi ve contaminated olmamasına dayanıyor; sonraki ekranın doğru olduğunu kanıtlamıyor. [K5] [K6]

**Öneri:** Host kayıtları gerçek aşamaları temsil etsin. Cihaz süreleri ayrı clock domain'iyle raporlansın. Gönderilmemiş bir komut için “tamamlandı” üretilmesin. Eksik ölçüm null/UNAVAILABLE kalsın.

Ek veri tutarlılığı konusu: runEpochMs epoch görünümünde bir değer taşırken runEpochUnit MONOTONIC_MS olarak yazılıyor; queue fallback yollarında Date.now() ile bu etiket birlikte kullanılıyor. IR schema metadata'sı da executor'da compiled plan.schemaVersion üzerinden dolduruluyor; kaynak IR v2 iken run'da 1 görülebiliyor. Bunlar hızın kanıtlanmış nedeni değildir, fakat doğru karşılaştırma ve migration için düzeltilmesi gereken provenance sorunlarıdır. [K7] [K3]

### 4.3 P1 — Hedef bulma tekrarı var; fakat koruması rastgele silinmemeli

Bugünkü normal yol:

~~~text
RESOLVE_TARGET adımı → find_id/find_text
BRIDGE_ACTION:
  manager.act → tekrar resolve
  tap_id → cihazda güncel ağacı yeniden oku ve hedefi doğrula
~~~

Bu tekrarın bir kısmı, saniyeler önce alınmış hedefin hâlâ geçerli olduğunu doğruluyor. Manager, expectTreeGen gönderiyor; stale_tree etkisiz reddinden sonra bir kez yeniden çözümleyebiliyor. [K5]

**Optimizasyon sırası:**

1. Önce iki mantıksal adım arasındaki DB maliyetini azalt.
2. Ardından yalnız tek tüketicili, düz akıştaki resolve + action çiftlerini aynı yürütme biriminde çalıştırmayı değerlendir.
3. Mantıksal adım kimlikleri ve sonuçları raporda kalabilsin; yürütme birimi her UI node'u için ayrı transaction olmak zorunda değil.
4. Ara condition, branch, interrupt, başka tüketici veya entity değişimi varsa birleştirme yapma.
5. Son cihaz sınırında taze hedef, görünürlük, ambiguity ve doğru entity kontrollerini koru.

“Hedef handle'ını uzun süre sakla ve eski koordinata bas” önerilmiyor. Bu hem güvenilirliği hem gerçek kullanıcı yolunu değiştirir.

### 4.4 P1 — Bilinen overlay, tam hedef timeout'u bittikten sonra temizleniyor

visit-resolve-search-toggle **12,886 saniye** sürmüş. Kayıtta swept=nesy.notification-list-dialog var.

Kod önce hedefin çözülme süresini tüketiyor, ancak hedef hâlâ bulunamadıysa tanımlı interrupt yüzeylerini kapatıyor. Sonra hedef için yeni bir çözümleme bütçesi açıyor. Bu sırada host NOT_FOUND sorgularını 250 ms aralıklarla tekrarlıyor; sweep'te 400 ms settle ve en fazla üç dismiss denemesi var. [K6]

Bu örnek için yaklaşık 10 saniyelik ilk arama penceresi önemli bir aday. 12,886 saniyenin tamamını “dialog kapatma süresi” diye adlandıramayız.

**Öneri:** Paketçe tanımlı, görünür olduğu bilinen notification dialog'unu ilk NOT_FOUND sonrasında veya olay geldiğinde kontrol et. Hedef + bilinen overlay + timeout sonuçlarını tek bounded wait akışında yarıştır. Her normal tap öncesi bütün ekranı taramak yeni sabit maliyet yaratır; erken kontrol olaya veya başarısız hedef aramasına bağlı olsun.

### 4.5 P1 — Oracle döngüsünde aynı gözlemler yeni revision olarak tekrar yayımlanıyor

Oracle worker host durumunu 250 ms cadence ile yenileyebiliyor ve değerlendirmeleri await ederek kalıcı yazıyor. refreshOccurrenceEvidence, mevcut SDK gözlemlerini ve derived fact'leri yeniden yayımlıyor. publishSdkObservations/publishDerivedFacts her yeniden yayında revision artırıyor. [K8] [K9]

Son teslimat kapısının kayıtlarında evidence revision'ın 59, 83, 107…755 şeklinde ilerlemesi ve 32 kez UNKNOWN yazılması bu tasarımla uyumlu. Revision artışı tek başına 24 yeni ürün olayı geldiğini göstermez.

**Öneri:**

- Değişmeyen gözlemi aynı scope/source/version için tekrar yayımlama.
- Derived fact'i yalnız girdilerinin sürümü veya ilgili zaman sınırı değişince yeniden hesapla.
- Aynı anlamsal UNKNOWN için her polling turunda DB transaction açma; ilk durum, anlamlı değişim ve terminal sonuç kalıcı olsun.
- Geçen süreyi, yeni fiziksel gözlemi, aynı değerin yeni observation'ını ve eski gözlemin tekrar publish edilmesini ayır.
- Freshness, stableForMs, EVENTUAL deadline ve negative observation semantiğini dedup sırasında koru.

Bu, kanıtı kapatmadan hem kanıtlı akışları hem DB yükünü iyileştirebilir.

### 4.6 P1 — Her Bridge aksiyonunda SDK correlation komutu await ediliyor

createBridgeRuntimePort içindeki pushCorrelation, kontrol kanalı varsa her aksiyondan önce nesy.binding.correlation seed komutunu bekliyor. Hatası best-effort olarak loglanıp yutulsa da çağrı cevaplanana kadar aksiyon başlamıyor. [K6]

Sadece yerel continueGate var mı diye bakıp bu işlemi silmek yanlış olur: kanıtsız bir aksiyon daha sonraki kanıtlı adımın okuyacağı olayı üretebilir.

**Öneri:** Compiler, downstream kanıtın hangi aksiyonlardan üretildiğini hesaplasın. Tamamen bağımsız ACTION_ONLY adımları için SDK correlation gereksizse çağrı hiç yapılmasın. Karma koşuda sonraki kanıt için producer olan aksiyonlarda correlation devam etsin. Async'ye çevrilen seed'in tap'ten sonra yetişmesi, olayı yanlış occurrence'a bağlayabilir.

SDK bulunmayan planda bu çağrının “hata verip timeout olmasını” beklemek opsiyonellik değildir. Yol baştan kurulmayacak.

### 4.7 P2 — Bridge'in fiziksel tap süresi ilk hedef değil

Android UiActions içinde TAP_DURATION_MS = 50. Protokolde tap settleMs varsayılanı 0; 2.000 ms'lik default timeout bir sabit sleep değil, üst sınır. [K14] [K15]

wait_node/wait_any ilk değerlendirmeyi yapabiliyor; olay geldiğinde uyanma ve sessiz OEM davranışına karşı güvenlik taraması var. Güvenlik taraması 50 ms'den 1.000 ms'ye kadar geri çekilebiliyor. Dolayısıyla “daima 50 ms'de bir bakar, en fazla 50 ms kaybedersin” iddiası doğru değil.

23 aksiyonun tamamı tap olsaydı bile 50 ms'yi sıfırlamanın teorik üst sınırı 1,15 saniye olurdu; gerçekte aksiyonların bir kısmı setText/scroll. Buna karşılık birçok normal BRIDGE_ACTION adımı 4 saniye civarında. Önce saniyelik ortak maliyet çözülmeli.

Accessibility activate ile fiziksel gesture birbirine eşdeğer sayılmamalı. activate_id mevcut olsa da farklı kullanıcı davranışını test eder; gizli hız hilesi olarak tap'in yerine konmamalı.

### 4.8 P2 — SDK overhead'i ölçülmeli, fakat bu koşu SDK'yı suçlamıyor

SDK kurulumu WAL, transport, lifecycle/capture ve uygulama sağlayıcılarını bağlıyor. Transport yokluğu WAL'ın yokluğu değil. Mobile bootstrap network body politikası, interaction capture, 5 saniyelik memory sampling ve App Adapter capability'lerini kuruyor. [K16] [K17]

Eski readiness belgesinde yaklaşık 74 ms A/B baseline var; belge kendisi de bunun sabit olmadığını söylüyor. Bu koşudaki SDK overhead'ini 74 ms ölçmedik. Bu sayıyı bugünkü bütün cihazlara genellemek doğru olmaz. [K24]

İhtiyaca göre HTTP body, yoğun interaction stream ve rutin capture azaltılabilir. Bu ayarlar iş kanıtının zorunluluğundan ayrı bir telemetry policy olmalıdır. Sonraki kanıtın ihtiyaç duyduğu event lane, güvenilir teslim ve correlation ekran bazında aç/kapat yapılmamalı.

### 4.9 P2 — App/remote süreleri ve başlangıç ayrı konular

Koşu başlangıcından önceki 7,057 saniyenin ne kadarı queue, launch veya readiness, mevcut span'lerden ayrıştırılamıyor. Full journey'deki login gerçek UI'den test edilecekse cold launch maliyetini o testten silmek kapsamı değiştirir. Login yalnız hazırlıksa warm/reuse-session ayrı bir seçim olabilir.

APP/LOCAL doğrulamasını beklememek, uygulamanın login HTTP isteğini veya rota yüklemesini ortadan kaldırmaz. Sonraki ekrandaki hedef henüz oluşmadıysa onun çözülmesi yine bekler. Beklemeyi gate'ten sonraki target resolution'a taşımak tek başına toplam kazanç değildir.

Remote örnekler de ayrımın önemini gösteriyor: auth-verify-backend-session adımı 2,880 saniye, iç remote attempt 686 ms. Aradaki süreyi API'nin işi diye raporlamamak gerekir.

### 4.10 Süre bütçesi cihaz aksiyonundan önce tüketiliyor

Continue gate'in deadline'ı worker çağrıldığı andan değil, occurrence startedAtMs + deadlineMs üzerinden hesaplanıyor. Dolayısıyla cihaz dispatch'inden önce geçen kayıt zamanı gate'in kullanabileceği pencereyi de azaltıyor. Host maliyetini azaltmak sadece hız değil, gereksiz timeout olasılığı açısından da faydalı. [K8]

Optimizasyon sırasında bu semantik sessizce “her katmanda yeniden tam timeout” haline getirilmemeli. Occurrence bütçesi, aksiyon bütçesi, hazır olma bütçesi ve oracle deadline'ı açık tanımlanmalı; retry/sweep kalan süreyi kullanmalı veya sözleşmede ayrı bir recovery bütçesi taşımalı. Mevcut overlay sonrası ikinci tam arama bütçesi de bu gözle denetlenmeli.

### 4.11 Mobile'ın kendi iki dakikalık bekleme davranışı ayrı bir hız sınıfı

Mobile kodunda bazı DELIVER_PARCELS yolları, VPos ayrımı ve diğer koşullara göre isWaitingRequest=true kaydediliyor. RequestSenderService, bekleyen kayıtları createdAt + 120 saniye penceresine göre gönderime açıyor. Yani bütün uzun beklemeler Cockpit'in veya SDK'nın icadı değil; bazıları uygulamanın kendi ürün davranışı. [K26] [K27]

Ayrıca mevcut kodda automation için SKIP_DELIVERY_WAIT / skip_delivery_wait seam'i var. Hem kayıt oluştururken hem bekleyen kayıtları gönderime açarken bu flag okunuyor. Bu analizde flag ayarlanmadı; örnek run bu teslimat gönderim aşamasına ulaşmadığı için **316 saniyenin sebebi olarak bu iki dakikalık pencere gösterilemez.**

Bu seam, talep edilen doğrulama checkbox'ından farklıdır:

- “İş doğrulamasını çalıştırma” testin neyi kontrol ettiğini değiştirir.
- “Delivery wait'i atla” test edilen uygulamanın çalışma davranışını değiştirir.

UI geliştirme/debug veya sonraki adımı hazırlama amacıyla bu seam ayrı ve açık bir setup seçeneği olabilir. Üretimle aynı offline kuyruk, iptal penceresi veya gönderim zamanlaması testinde kullanılmamalı. Kullanılan seam run provenance'ında görünmeli; bu koşu normal bekleme davranışını doğruladığını iddia etmemeli. Hız checkbox'ı bu flag'i gizlice açmamalı.

## 5. Mevcut mimaride hazır olanlar ve eksikler

| Konu | Mevcut durum | Dönüşüm ihtiyacı |
|---|---|---|
| Adım bazında gate/oracle | WorkflowStepBase'de ikisi de optional | Kullanıcı seçimini ve kapsamını birinci sınıf tanımla |
| Ayrı action/gate/oracle sonuçları | Step outcome eksenleri var | “Kullanıcı değerlendirmedi” nedenini açık sakla |
| SDK'sız Bridge | Fiziksel Bridge SDK'dan ayrı | Queue/preflight/cleanup bağımlılıklarını plan bazında kur |
| UI hedef bekleme | find_id, wait_node, wait_any var | Host polling ve tekrar adımlarını azalt |
| Makro kompozisyonu | full-courier-day yedi işi birleştiriyor | Checkbox'ı doğru makro instance'ına yay |
| Run provenance | Plan hash, paket digest, source map var | Seçili ve etkili policy'yi hash/snapshot'a ekle |
| Final ürün hükmü | PASS_ONLINE, PASS_QUEUED_OFFLINE, FAIL_PRODUCT, INCONCLUSIVE, NOT_EVALUATED | Kapsam ve UI sonucu ayrı eksenler olarak eklenmeli |
| Kalıcı yürütme | Fence/checkpoint/transition kayıtları var | Round-trip azalt; semantiği koru |
| Performans görünürlüğü | Span altyapısı var, örnek run'da yok | BridgeFlow kritik yolu ölçüme bağla |

continueGate ve finalOraclePolicy alanlarını kaldırmak tek başına yeterli değil. ASSERT_FACT aksiyonu ayrıca durdurabilir; SDK_QUERY ve REMOTE_ACTION adımları çalışmaya devam eder; başlangıç hâlâ SDK ister. [K1] [K3] [K7]

### 5.1 Kritik editor/compiler açığı

Editor run isteğinde nodes/connections gönderiyor. Auth / Login node'u varsa ayrıca cold-real-login profili seçiyor. [K19]

API'deki materializeWorkflowIr:

- Gelen veri zaten IR ise onu kullanıyor.
- Canvas ise workflowRef üzerinden paket workflow'unu buluyor.
- Tek makro snapshot varsa onun genericIr'ını alıyor.
- GRANT_PERMISSIONS varlığı gibi dar bir kontrol yapıyor.
- Genel node config'lerini makro adımlarının yürütme politikasına dönüştürmüyor. [K2]

**Sonuç:** Bugün node config'e fast=true yazan bir checkbox, compiler genişletilmeden çalıştırılan planı değiştirmeyebilir. Kullanıcı “hızlı” seçer, sistem yine eski kanıtlı makroyu koşar.

Sadece client tarafında step silmek de çözüm değil. API compiler hangi policy'nin hangi paket/makro instance'ına uygulandığını açıkça işlemeli ve run isteği bu derlenmiş plan hash'ini kullanmalıdır.

## 6. Ürün modeli: Sürüş, doğrulama, veri ve telemetriyi ayır

### 6.1 Üç doğrulama modu

Aşağıdaki adlar **önerilen sözleşmedir**, mevcut enum'lar değildir.

| Seçim | Plan davranışı | Adım sonucu ne söyler? | Ne söylemez? |
|---|---|---|---|
| BUSINESS_PROOF | Seçilmiş iş claim'inin gate/oracle ve gerekli producer'larını yürüt | İş koşulu doğrulandı/doğrulanamadı | Her ekran/API mutlaka gerekir demez |
| UI_ASSERT | Tanımlı UI beklentisini doğrula | Beklenen yüzey/veri gözlendi | DB/backend işlemi tamamlandı demez |
| ACTION_ONLY | Aksiyonu uygula; sonuç assertion'ı çalıştırma | Komut yürütüldü; sonuç doğrulanmadı | UI testi geçti veya iş tamamlandı demez |

**Kanıtsız adım desteklenecek.** ACTION_ONLY terminalde de seçilebilir. O durumda “yürütme tamamlandı, sonuç doğrulanmadı” yazılır. Sonradan zorunlu wait_node ekleyip UI_ASSERT gibi davranılmaz.

### 6.2 Senkronizasyon ayrı eksen

Bir sonraki aksiyonu uygulamak için hedefe ihtiyaç vardır. “Doğrulamasız” seçeneği, hedef bulunamadığında sonsuz koordinat tıklaması anlamına gelmemeli.

- CURRENT_ACTION_ACK: Mevcut komutun gerçek terminal cevabını bekle.
- NEXT_TARGET_READY: Sonraki aksiyon kendi hedefini görünür/uygulanabilir olduğunda kullanır.
- EXPLICIT_UI_ASSERT: Kullanıcı ayrıca bir UI beklentisi tanımlamıştır.
- BUSINESS_DEPENDENCY: Sonraki adım veri/iş sonucu olmadan ilerleyemez.

İlk iki seçenek operasyonel sürüş içindir; otomatik olarak bir test assertion'ı üretmez.

~~~text
Login — ACTION_ONLY
  PIN alanını bul → metni gir → submit'e bas → komut cevabını al
  login doğrulaması: DEĞERLENDİRİLMEDİ

Sonraki “Rota seç”:
  hedefi hazır olduğunda bul → rota seçimini uygula
~~~

Rota hedefi bulunamazsa koşu yürütme problemiyle durabilir. Bu durum geriye dönük “login business testi fail oldu” diye yeniden etiketlenmez; login'in sonucu ölçülmemiştir.

### 6.3 Dört farklı “gerekli veri” sebebi

Checkbox'ın bütün sorguları silmemesi için her veri tüketimi ayrılmalı:

1. **Sürüş verisi:** Sonraki satırın kimliği, rota anahtarı, koşul girdisi.
2. **Senkronizasyon:** Sonraki etkileşimin uygulanabileceği durum.
3. **İş doğrulaması:** İş iddiasının APP/LOCAL/REMOTE gereksinimleri.
4. **Tanısal veri:** Hata açıklaması, capture, isteğe bağlı gözlem.

Aynı sorgu iki role hizmet edebilir. İş doğrulaması kapatılsa bile sonraki adımın stop_id ihtiyacı varsa sorgu tutulur. Compiler “hızlı seçildi ama bu okuma sonraki adımın girdisi olduğu için korunuyor” bilgisini önizlemede gösterebilir.

## 7. Checkbox deneyimi ve gerçek login örneği

### 7.1 Kullanıcının göreceği basit yüzey

Login node'u özelliklerinde:

~~~text
[ ] Bu adımı hızlı geç — iş doğrulamasını çalıştırma

Seçilince:
  Login aksiyonları uygulanır. Login başarısı ayrıca doğrulanmaz.

İsteğe bağlı:
[ ] Geçişte bir UI beklentisini doğrula
    Beklenti: Rota seçimi penceresi veya rota listesi
~~~

Birinci checkbox seçili, ikinci boş ise ACTION_ONLY. İkinci de seçiliyse UI_ASSERT. İkisi boşsa mevcut paket davranışı BUSINESS_PROOF.

“Oturumu yeniden kullan / login aksiyonlarını atla” bundan **ayrı** bir launch/setup seçeneği olmalı. Kanıtı beklememek ile login'i hiç yapmamak farklı kapsamlardır.

### 7.2 Login makrosunda ne değişir?

| Mevcut parça | Hızlı login'de karar |
|---|---|
| auth-prepare-startup-permissions | Başlangıç gereksinimi ise kalır; tekrar yapılan bootstrap var mı ayrıca ölçülür |
| auth-read-session-precheck | Branch için gerekiyorsa kalır; kesin logged-out fixture'da ayrı policy ile kaldırılabilir |
| auth-check-already-signed-in | Precheck ile birlikte değerlendirilir; kaldırılan producer'a referans bırakılmaz |
| auth-resolve-pin-field | UI sürüşü için kalır; resolve/action birleştirme adayı |
| auth-enter-pin | Kalır |
| auth-resolve-submit | Kalır veya submit aksiyonuna güvenli biçimde birleştirilir |
| auth-tap-submit | Kalır; seçilen doğrulama/senkronizasyon politikasını kullanır |
| auth-read-app-session | Yalnız login claim'ini besliyorsa kaldırılabilir |
| auth-read-local-session | Yalnız login claim'ini besliyorsa kaldırılabilir |
| auth-verify-backend-session | Tanısal/optional gözlem; istenmiyorsa çalıştırılmaz |
| auth-assert-login | Hem ASSERT_FACT kontrolü hem finalOraclePolicy kaldırılmalı veya doğrulamasız logical boundary'ye dönüştürülmeli |
| auth-clear-session | Cleanup/isolation ihtiyacına göre korunur; “kanıt kapalı” diye kaybolmaz |
| route-read-current-route | Sonraki makronun veri ihtiyacı olarak ayrı değerlendirilir |

Bu dört doğrulama adımının örnek koşudaki toplamı:

| Adım | Süre |
|---|---:|
| auth-read-app-session | 2,023 sn |
| auth-read-local-session | 1,664 sn |
| auth-verify-backend-session | 2,880 sn |
| auth-assert-login | 2,575 sn |
| **Toplam** | **9,142 sn** |

Bu dört adımın ardından gelen ilgili geçiş boşlukları da toplam 1,848 saniye. “9,142 + 1,848 kesin kazanılır” denemez; yeni akışta bazı kayıt ve sonraki hedef bekleme maliyetleri kalır. Bu değerler mevcut maliyet havuzunu gösterir.

İlk login occurrence'ından route-read-current-route başlangıcına kadar **40,429 saniye** var. Login doğrulamalarını kaldırmak bu 40 saniyenin tamamını kaldırmaz. PIN girişi, target resolution, başlangıç işi ve ortak kayıt yolu hâlâ durur.

auth-tap-submit'in gate'i yalnız saf business proof değildir: UI.ROUTE_LIST_READY / UI.ROUTE_DIALOG_READY / APP.LOGIN_REJECTED alternatiflerini ve session-expired dışlamasını içerir. Bu gate'i körlemesine silmek yerine:

- ACTION_ONLY'de sonuç assertion'ı kaldırılır; sonraki aksiyonun kendi hedef bekleme sorumluluğu belirgin kalır.
- UI_ASSERT'te success yüzeyi veya görünür rejection sonucu Bridge ile tanımlanır.
- BUSINESS_PROOF'ta mevcut iş kapsamı korunur.

### 7.3 Optional remote gözlem hızdan bağımsız da incelenecek

Mevcut login kodu, nesy.backoffice.read-session isteğinin dashboard admin kimliğini okuduğunu ve kurye login'ini kanıtlamadığı için OPTIONAL tutulduğunu açıklıyor. Dolayısıyla bu çağrının normal yürütmede çalıştırılmaması güçlü bir aday; fakat buna “REMOTE login kanıtını kaybettik” demek de yanlış. [K12]

OPTIONAL obligation, o veriyi üreten REMOTE_ACTION'ın ücretsiz veya otomatik olarak çalıştırılmaz olduğu anlamına gelmiyor. **Kanıtın zorunluluğu** ile **toplama politikasını** ayrı modellemek gerekli.

## 8. Karma workflow'da kanıt kapsamı nasıl korunur?

Örnek kullanıcı seçimi:

| İş | Mod | İddia |
|---|---|---|
| Login | ACTION_ONLY | Login aksiyonları yürütüldü; login doğrulanmadı |
| Rota aç / menülerde gezin | ACTION_ONLY | Navigasyon sürüldü |
| İlgili gönderiyi bul | UI_ASSERT | İstenen gönderi kimliği UI'de gözlendi |
| Teslimatı tamamla | BUSINESS_PROOF | Seçilmiş teslimat claim'i kanıtlandı/doğrulanamadı |

Login doğrulamasını kapatmak **teslimat kanıtını otomatik olarak geçersiz yapmaz**. Teslimat claim'i kendi gereken kullanıcı, gönderi, session veya backend koşullarını yeterli kaynaklarla kanıtlıyorsa bağımsız bir kapsamda sonuç üretilebilir. Fakat bu run artık “login dahil bütün kurye günü doğrulandı” diye raporlanamaz.

Önerilen dört ayrı rapor ekseni:

- **Yürütme:** tamamlandı / durdu / iptal / belirsiz etki.
- **UI doğrulaması:** başarılı / başarısız / değerlendirilmedi.
- **İş doğrulaması:** mevcut ProductVerdict enum'u; hangi claim'ler için olduğu ile birlikte.
- **Kapsam:** paket varsayılan kapsamı, kullanıcının seçtiği kapsam, tamamlanan kapsam ve kapsam dışı bırakılanlar.

Bugünkü aggregation, yalnız gerçekten üretilen product verdict'leri birleştiriyor. Login oracle'ı silinip teslimat oracle'ı PASS_ONLINE dönerse, üst seviye run sonucu kalan verdict'lerden PASS_ONLINE olabilir. Bu yüzden yalnız step policy değiştirmek yeterli değil; **kapsam manifest'i de zorunlu.** [K10]

### 8.1 Release davranışı

- Mevcut “full courier day” release kapsamı login'i içeriyorsa login'in kaldırılması o kapıyı karşılamaz.
- Kullanıcı isterse login'i hazırlık kabul eden, yalnız teslimat claim'ini değerlendiren ayrı kapsam tanımlayabilir.
- İlk sürümde en basit davranış: azaltılmış kapsamlı koşular releaseGate=false; sonuçta kapsam dışı işler görünür.
- Sonraki sürümde release policy, kendi requiredClaimIds kümesini kontrol ederek dar kapsamlı release kapılarına izin verebilir.
- Hiç business claim seçilmediyse ProductVerdict=NOT_EVALUATED.
- Hiç UI assertion seçilmediyse UI sonucu da değerlendirilmedi; yalnız yürütme tamamlandı bilgisi vardır.

UI_PASS, ACTION_ONLY ve BUSINESS_PROOF adları mevcut enum'lara gelişi güzel eklenmemeli. Mevcut API tüketicileri ve geçmiş koşular için ayrı versiyonlanmış projection/alanlar daha güvenli.

### 8.2 Boş oracle tuzağı

Mevcut evaluateFinalOracle, requirements boş veya hepsi NOT_APPLICABLE olduğunda bir eksik/ihlal bayrağı oluşmazsa SATISFIED ve PASS_ONLINE yoluna düşebiliyor. UI-only dönüşümünde boş finalOraclePolicy bırakmak sahte iş yeşiline kapı açar. [K11]

Çözüm:

- Doğrulaması kaldırılan iş adımının final oracle'ını hiç çalıştırma.
- Seçilmiş claim yoksa run ürün sonucu NOT_EVALUATED olsun.
- “Kullanıcı doğrulamayı kaldırdı” ile “bu gereksinim bu işte semantik olarak uygulanamaz” durumlarını aynı NOT_APPLICABLE sebebine sıkıştırma.
- Boş claim kümesi veya boş oracle politikasıyla ürün PASS üretilmesini sözleşme testleriyle önle.

## 9. Compiler dönüşümü

### 9.1 Canonical policy

Önerilen policy aşağıdaki kavramları taşımalı; alan isimleri uygulama sırasında sözleşmeye dönüştürülecek:

| Alan | Amaç |
|---|---|
| policyVersion | Eski ve yeni semantiği ayır |
| sourceNodeId / macroInstanceId | Kullanıcının hangi node/gruba seçim yaptığını sabitle |
| verificationMode | BUSINESS_PROOF / UI_ASSERT / ACTION_ONLY |
| uiExpectationRef | Seçilmişse UI assertion tanımı |
| selectedClaimIds | Bu run'ın gerçekten değerlendireceği iş iddiaları |
| declaredRequirements | Paketin orijinal gereksinimleri |
| effectiveRequirements | Bu planın çalıştıracağı gereksinimler |
| skippedRequirements + reason | Kullanıcı seçimiyle çıkarılanlar |
| executionDependencies | Branch, hedef, entity ve cleanup için gereken veri |
| sdkRequirement | REQUIRED / OPTIONAL / NOT_REQUIRED; bağımlılıklardan türetilir |
| telemetryPolicy | Capture ve tanısal gözlem kapsamı |
| executionPolicyDigest | Etkili seçimlerin plan kimliği |

UI'daki checkbox bir yazım kolaylığıdır; runtime'ın okuduğu tek gerçek canonical policy olur. Kullanıcı config'ine bakıp executor içinde farklı yerlere if-fast eklemek yerine compiler etkili planı üretir.

### 9.2 Derleme sırası

1. Paket/version/digest ve authoring kaynağını sabitle.
2. Canvas node'larını açık macro instance kimlikleriyle eşle.
3. Paket makrolarını generic IR'ye genişlet.
4. Node seçimlerini instance/step policy'lerine uygula.
5. İş claim'lerinden producer, sorgu ve derived-fact bağımlılıklarını çıkar.
6. Branch, variable, target, entity ve cleanup bağımlılıklarını ayrıca ekle.
7. Yalnız doğrulamayı besleyen kullanılmayan işleri buda.
8. Next/branch kenarlarını ve output referanslarını yeniden doğrula.
9. Capability manifest, evidence manifest ve release kapsamını yeniden üret.
10. Etkili policy, kaynak eşlemesi ve planı deterministik hash'e dahil et.
11. Kullanıcıya etki önizlemesini döndür; yürütme bu hash'le başlasın.

Başlangıç uygulaması login gibi tek macro instance'ı üzerinden yapılabilir. Ancak auth- önekini Core içine hardcode etmek yerine makro sahipliği/source map bilgisini kullanmalı. Aynı workflow'da iki login node'u, loop içindeki aynı macro ve farklı branch'teki instance'lar birbirine karışmamalı.

### 9.3 Veri bağımlılığı kuralları

- Silinen query'nin output'unu CONDITION kullanıyorsa query tutulur veya branch açıkça yeniden yazılır.
- Silinen APP fact'i daha sonraki derived fact'in girdisiyse producer tutulur.
- Önceki UI aksiyonu sonraki proof için olay üretiyorsa correlation tutulur.
- Remote VALIDATION ile remote SETUP/MUTATION ayrılır. Tur onayını yapan ikinci aktör çağrısı yalnızca “kanıt” değildir; işin gerçekleşmesini sağlar.
- Cleanup ve compensatesStepIds yürütülmüş aksiyonlara göre güncellenir.
- Hız seçimi effectClass, maxAttempts veya UNKNOWN_EFFECT semantiğini kendiliğinden değiştirmez.
- Koşu başladıktan sonra seçim değiştirilmez; yeni deneme yeni plan/policy kimliği taşır.

## 10. SDK'sız veya az SDK bağımlı çalışmak

### 10.1 Bugünkü engel

Bridge APK fiziksel UI'yı SDK olmadan sürebilir. Fakat mevcut queue:

- App run/session state'ini kuruyor ve kontrol ediyor.
- Cold-start yolunda SDK state, health, WAL/WS ve actionability'yi birlikte değerlendiriyor.
- Cold olmayan yolda da runId'nin SDK state'inde gözlenmesini bekliyor.
- SDK gözlem deposu ve screen observer kuruyor.
- Cleanup'ta reset_state kontrol komutunu kullanabiliyor. [K7] [K6]

Dolayısıyla “SDK'yı sökelim, aynı run zaten çalışır” bugünkü kod için doğru değil.

### 10.2 Planın gerçek bağımlılığına göre üç çalışma şekli

| Şekil | Başlangıç ve runtime |
|---|---|
| SDK_REQUIRED | Herhangi bir seçili proof, sürüş query'si, seam veya cleanup SDK'ya ihtiyaç duyuyorsa gerekli lane'leri doğrula |
| SDK_OPTIONAL | SDK yalnız tanısal tanık; absence hiçbir step'te gizli bekleme üretmez |
| SDK_NOT_REQUIRED | Bridge + cihaz erişimi + target/application context yeterli; SDK session/WAL/oracle bağlama yolu kurulmaz |

Karma Nesy workflow'da yalnız login kanıtı kaldırılınca bütün koşu SDK_NOT_REQUIRED olmaz. Sonraki rota/gönderi sorguları ve teslimat proof'u SDK gerektirir.

Mackolik benzeri, UI'den veri okuyan bir akış için SDK_NOT_REQUIRED gerçek ürün yolu olabilir. Read-only uygulama olmak, hiçbir anlamlı assertion yok demek değildir: doğru maç, skor satırı, boş durum, hata ekranı veya loading'in kalkması UI_ASSERT ile test edilebilir. Kullanıcı bunları da istemezse ACTION_ONLY seçer.

### 10.3 Readiness optimizasyonu

Mevcut device-readiness servisi lane probe'larını ardışık await ile topluyor. Gerekmeyen lane'leri sormamak, bağımsız salt okunur probe'ları sınırlı paralellikte almak başlangıcı hızlandırabilir. UI tarafı burada yalnız ACT_MODE_POLICY BLOCKED sonucunu engel olarak kullanıyor; buna rağmen bütün lane'ler okunuyor. [K21] [K20]

Runtime'da da sade readiness “hazır olmayan ekrana bas” anlamına gelmez. Bridge bağlantısı, doğru uygulama/yüzey, hedefin uygulanabilirliği, cihaz sahipliği ve izinler kalır. SDK/WAL hazır olması, yalnız SDK gerçekten gerektiğinde ön koşul olur.

Cold/warm/prepared-session ayrı benchmark hücreleri olmalı. Başlangıç zamanı run toplamından sessizce çıkarılmamalı.

## 11. Örnek run'ın iki problemli noktasında ne yapılır?

### 11.1 Notification dialog

visit-resolve-search-toggle adımındaki 12,886 saniyelik maliyet iş oracle'ından kaynaklanmıyor. ACTION_ONLY seçmek tek başına değiştirmez. Bilinen overlay'in erken ele alınması ve host polling'in device wait'e taşınması gerekir.

Bu optimizasyon, kanıtlı akışta da aynı kullanıcı yolu korunduğu sürece uygulanabilir.

### 11.2 Teslimat scan gate timeout'u

deliver-tap-scan-confirm aksiyonu SUCCEEDED; gate APP.DELIVERY_PARCEL_SCANNED beklerken TIMED_OUT. Adım 21,466 saniye sürmüş.

Evidence journey'deki 24 kayıtta APP.PARCEL_SCANNED ve APP.DELIVERY_FLOW_STARTED var, beklenen APP.DELIVERY_PARCEL_SCANNED yok. Journey'nin eksiksiz raw-event dökümü olduğu kanıtlanmadığından bundan “Mobile kesin emit etmedi” sonucu çıkarılamaz.

Mobile'da beklenen kritik event'in üreticisi mevcut; scanned boolean ve scanned_count/total_count taşıyor. Başka bir parcel-scanned fact'ini bunun yerine geçirip gate'i tatmin etmek doğru olmaz. [K25]

- Teslimat BUSINESS_PROOF seçiliyse bu kanıt zinciri ayrıca araştırılmalı: emit, taşınma, correlation, lane, true/false ve doğru gönderi eşleşmesi.
- Teslimat UI_ASSERT seçiliyse açık UI beklentisine göre karar verilir; business fact beklenmez.
- ACTION_ONLY seçiliyse bu gate çalıştırılmaz; ama sonraki complete hedefi/uygulama iş kuralları yine ilerlemeyi engelleyebilir.

**20 saniyeyi kaldırmak teslimatın gerçekleşeceğini garanti etmez.** Uygulama gerçekten kabul etmediğinde sonraki hedef bekler veya aksiyon reddedilir. Hız modunun amacı bu arızayı sahte başarıyla kapatmak değil, kullanıcının seçmediği testi çalıştırmamaktır.

Cleanup FAILED için API'de yeterli ayrıntı yok; mevcut kod artık açıklayıcı evidenceRef üretse de bu koşuda ilgili transition görünmüyor. “SDK kapalıydı”, “reset timeout oldu” gibi bir kök neden atanamaz. Hız dönüşümünden ayrı bir teşhis eksikliği olarak tutulmalı.

## 12. Kazançları nasıl hesaplamalı?

| Değişim adayı | Bu run'daki ilgili maliyet | Ne kadar güvenebiliriz? |
|---|---:|---|
| Login'in dört doğrulama adımını budamak | 9,142 sn + bazı geçiş maliyetleri | Mevcut maliyet ölçülü; yeni süreden tasarruf henüz ölçülmedi |
| Login optional admin-session gözlemini çıkarmak | 2,880 sn adım / 686 ms remote attempt | Yukarıdaki 9,142 sn'nin içindedir; ayrıca toplanmaz |
| Notification overlay'i erken ele almak | 12,886 sn adım; ilk arama bütçesi yaklaşık 10 sn | Büyük aday; yeni gerçek cihaz ölçümü gerekir |
| 23 aksiyonun dört seri pre-transition kaydını azaltmak | 35,632 sn gözlenen aralık toplamı | Saf DB süre toplamı veya tamamı kaldırılabilir süre değildir |
| Tüm adımlar arası geçişleri optimize etmek | 39,468 sn | Terminal kayıt/host işi içerir; diğer persistence kazançlarıyla çakışabilir |
| Son delivery gate'i ACTION_ONLY'de kaldırmak | 20 sn deadline / 21,466 sn adım | Sadece test kapsamı değişirse; sonraki UI başarısı bilinmiyor |
| Fiziksel tap süresini azaltmak | Tap başına 50 ms | Bu run'ın ana kazanç alanı değil |
| SDK capture azaltımı | Bu run'da ayrı ölçülmemiş | A/B olmadan saniye tahmini verilmez |

**Bu satırlar toplanarak yeni run süresi hesaplanmamalı.** Aynı süre birden fazla optimizasyonun hedefi olabilir. Kaldırılan gate'in beklediği gerçek UI hazır oluşu sonraki adıma taşınabilir.

Motor sabitken yalnız login checkbox'ı anlamlı ama sınırlı fayda sağlar. Seri persistence, gereksiz producer'lar, overlay bekleme ve hedef çözümleme birlikte iyileştirilirse çok daha büyük kazanç olasıdır. “316 saniye 30 saniye olacak” iddiasını bu veriyle vermiyorum.

## 13. Önerilen uygulama sırası

### Faz 0 — Ölçüm ve rapor doğruluğu

- Gerçek host dispatch/ack, cihaz yürütme ve gate sürelerini ayır.
- Sentetik gesture completed işaretlerini düzelt.
- Persistence/lock/pool/commit span'lerini ekle.
- Wall clock ve monotonic clock sözleşmesini düzelt.
- Kapsam, NOT_EVALUATED ve cleanup durumlarını dashboard'da açık göster.

**Çıkış:** Basit bir tap'in bekleme maliyetinin hangi katmanda olduğu ölçülebiliyor; boş kanıt kümesi ürün PASS sayılmıyor.

### Faz 1 — Ortak motor maliyetini azalt

- Transaction sayısını ve tekrarlı fence/checkpoint okumalarını azalt.
- Gerekli intent/terminal atomiklik ve recovery korumalarını tut.
- Oracle tekrar publish/yazma döngüsünü azalt.
- Gereksiz live-read polling ve diagnostik işi kritik yoldan çıkar.
- DB bağlantı yerleşimini/pool'u ölçüme göre düzenle.

**Çıkış:** Aynı kanıtlı plan aynı sonucu üretirken hedef bulma ve tap adımlarının host maliyeti belirgin düşüyor. Bu değişim checkbox'tan bağımsız teslim edilebilir.

### Faz 2 — Login üzerinden adım/makro policy'si

- Checkbox + opsiyonel UI assertion ayarı.
- Compiler overlay, claim scope ve producer bağımlılıkları.
- Plan hash/snapshot ve editor reload/run round-trip.
- Login ACTION_ONLY, UI_ASSERT, BUSINESS_PROOF uçtan uca.
- Azaltılmış kapsamlı koşular için releaseGate=false.

**Çıkış:** Checkbox'ın planı gerçekten değiştirdiği ve hangi işleri çıkardığı önizlemede görülebiliyor; login fiziksel olarak yürütülüyor.

### Faz 3 — Genel UI yolu ve SDK opsiyonelliği

- Plan bazında SDK capability gereksinimi.
- Gereksiz SDK readiness ve correlation çağrılarının kaldırılması.
- SDK gerektirmeyen cleanup/launch politikası.
- Tamamen ACTION_ONLY ve tamamen UI_ASSERT workflow desteği.

**Çıkış:** SDK'sız APK'da tanımlı UI akışı çalışıyor; handshake bekleme hatasıyla sürünmüyor.

### Faz 4 — UI hot path

- Bounded device wait; gerektiğinde hedef/interrupt birlikte bekleme.
- Güvenli resolve/action birleştirme.
- Makro instance'larında gereksiz tekrar wait ve query budama.
- Gerekli ise küçük device-side komut grupları; sonuç/cancel/unknown-effect sınırları açık.

Device-side batching ilk çözüm değildir. Mevcut Bridge protokolünü büyütmeden host'ta önemli maliyet kaldırılabilir. Batching sonradan eklenirse her alt aksiyonun request kimliği, terminal durumu ve replay sınırı korunmalı.

### Faz 5 — Kanıt toplamayı sürüşten ayırma

Seçilmiş BUSINESS_PROOF için gerekiyorsa “şimdi doğrula” ve “akışı ilerlet, belirtilen sınırda doğrulamayı tamamla” ayrı timing politikası düşünülebilir.

Bu ilk sürüm işi olmamalı. Final oracle şu anda executor tarafından await ediliyor. Arka plana almak; pending proof ledger, scope/occurrence pinleme, deadline, failure sonrası durdurma, kaynak ömrü, run kapanışı ve recovery davranışını birlikte gerektirir.

EVENTUAL deadline bir sabit sleep değildir; veri erken geldiyse erken tamamlanmalı. Asenkronlaştırma sadece bağımsız işleri örtüştürür, ihtiyaç duyulan gerçek veriyi ortadan kaldırmaz.

## 14. Doğrulama ve benchmark planı

Bu analiz sırasında aşağıdaki testler **çalıştırılmadı**. Bunlar dönüşümün kabul planıdır.

### 14.1 Dört kontrollü ölçüm kolu

| Kol | Doğrulama | Motor |
|---|---|---|
| A | Mevcut tam kapsam | Mevcut yürütme |
| B | Aynı tam kapsam | Persistence/overlay/tekrar iş optimizasyonu |
| C | Seçilmiş hızlı login veya UI kapsamı | Mevcut motor; semantik değişimin kazancını ayırmak için |
| D | C ile aynı kapsam | Optimize motor |

A→B aynı doğruluk seviyesinde hız kazancı; A→C daha az test yapılmasının maliyet farkı; C→D ortak motor kazancı. D'yi A ile kıyaslayıp bütün farkı “SDK hızlandı” diye sunmamak gerekir.

İlk doğrulama hücresinde en az 30 tekrar; cihaz/build/backend/dataset ve cold/warm koşulu sabit. Daha sonra farklı cihaz ailesi ve gecikme koşulları. p99 için 30 örnek yeterli değildir; yeterli örnek toplanana kadar p99 iddiası yapılmaz.

Raporlanacak metrikler:

- Queue dahil toplam süre ve executor süresi.
- Host hazırlık/kalıcı intent, gerçek Bridge request/response, cihaz yürütme, hedef hazır olma.
- Correlation komutu, SDK query, remote attempt.
- Gate/oracle bekleme ve hesaplama.
- DB round-trip adedi, transaction/lock/pool bekleme, commit süresi.
- Adım başına artifact/telemetry maliyeti.
- İlk denemede tamamlanma, retry/cancel/UNKNOWN_EFFECT, toplam tekrar dahil suite süresi.
- Seçilmiş UI/business claim coverage ve yanlış PASS sayısı.

**İlk mühendislik hedefleri; ölçüm sonucu değildir:** Hazır hedefte kanıt beklemeyen adım için gereksiz host orkestrasyon p95'ini 100–200 ms bandına indirmeyi hedefle. Bunu APK/OS rendering süresini veya gerekli DB dayanıklılığını yok sayarak tutturma. Mevcut 80 ms civarı DB round-trip koşulunda çok sayıda senkron transaction ile bu bütçenin zor olduğu açıkça görülsün.

### 14.2 Anlamlı sözleşme ve recovery testleri

1. Checkbox kaydet → reload → compile → run: seçilen macro instance'ının planı değişiyor.
2. Eski workflow'da policy yok: eski semantik korunuyor.
3. Policy değişirse hash değişiyor; aynı policy/plan deterministik.
4. ACTION_ONLY login APP/LOCAL/REMOTE oracle'ını ve yalnız onun producer'larını çalıştırmıyor.
5. Aynı login'deki downstream veri bağımlılığı yanlışlıkla silinmiyor.
6. ACTION_ONLY terminal adım “executed” oluyor; UI/business PASS uydurulmuyor.
7. UI_ASSERT hedefi yanlışsa test fail; gesture ack UI assertion yerine geçmiyor.
8. Mixed run, kalan claim'i kanıtlarken login'i kapsam dışında gösteriyor.
9. Mevcut full release gate, daraltılmış kapsamı kabul etmiyor.
10. Boş/N/A oracle ve tamamen assertionsız run ürün PASS üretmiyor.
11. SDK'sız UI run, gereksiz SDK handshake/cleanup/correlation timeout'u yaşamıyor.
12. Optional witness eksikliği planın iş kararını değiştirmiyor; gerekli SDK eksikliği açık capability hatası.
13. Gönderim öncesi crash, etki sonrası response kaybı, terminal commit öncesi crash: otomatik çift login/teslim/ödeme oluşmuyor.
14. Eski lease sahibi devam edemiyor; DB transaction birleştirmesi fence'i zayıflatmıyor.
15. Loop ve branch içindeki policy değişikliği başka occurrence veya macro instance'a sızmıyor.
16. Aynı değerin yeni gözlemi ile eski fact'in tekrar publish edilmesi ayrılıyor; freshness/stability bozulmuyor.
17. Overlay erken temizleniyor, tanımsız/uyumsuz yüzey gelişi güzel kapatılmıyor.
18. Hızlı moda geçiş maxAttempts/effectClass veya unknown-effect retry semantiğini değiştirmiyor.

## 15. Geriye uyum ve devreye alma

- İlk değişim yeni sürümlü contract/policy ile opt-in olsun; geçmiş planlar yeniden yorumlanmasın.
- Policy'siz eski workflow ve kayıtlar “legacy/original scope” olarak aynı sonuçları korusun.
- Yeni alanları anlamayan eski executor planı sessizce yok saymasın; capability/version uyuşmazlığı açık hata olsun.
- Editor yalnız runtime destekliyorsa checkbox'ı çalıştırılabilir göstersin.
- Run içinde declared/effective policy ve scope snapshot saklansın; paket güncellemesi eski raporun anlamını değiştirmesin.
- Resume, kaydedilmiş policy/plan kimliğini kullansın; değişen taslakla eski run'a devam edilmesin.
- Geri alma, yeni koşular için policy özelliğini kapatabilsin; başlamış koşunun ortasında modu değiştirmesin.
- Persistence optimizasyonu ve doğrulama kapsamı feature flag'leri ayrı olsun; problemli değişim bağımsız geri alınabilsin.
- Published pack/template REQUIREMENT'ları kaynakta silinmesin; kullanıcının seçimi ayrı etkili plan olarak kayıtlı kalsın.

## 16. Dosya ve bileşen etki haritası

| Bileşen | Beklenen çalışma |
|---|---|
| workflow-contract: ir-v2 / evidence-policy / outcome-axes / validate | Mod, scope, bağımlılık ve evaluation disposition sözleşmesi |
| bridgeflow-compiler: domain-expansion / evidence-compiler / capability / canonical / source-map | Policy overlay, producer pruning, hash, capability ve provenance |
| API bridgeflow-compile-adapter | Canvas checkbox'ını gerçek IR/instance'a uygulama |
| API workflow-run.service / compile service | Etkili policy snapshot, capability sürümü, hash doğrulama |
| Editor workflow-editor / workflow-types / node-config-registry | Checkbox, UI assertion ayarı, etki önizlemesi ve reload |
| start-pinned-run / readiness service / execution queue | Planın gerektirdiği lane'leri kurma; SDK'sız yol |
| bridgeflow-executor / bridgeflow-prisma-persistence | Gerçek aşama zamanları; daha az transaction; mode/scope sonuçları |
| bridge-device-manager / bridgeflow-device-ports | Correlation gereksinimi, hedef/wait iyileştirmesi, birleştirme |
| oracle-evaluation-worker / evidence runtime | Tekrarlı yayın/yazma azaltımı; claim kapsamı |
| oracle-engine / run aggregation | Boş oracle ve kapsam eksikliğinde yanlış PASS'i önleme |
| Nesy domain pack login/full-courier-day ve diğer makrolar | İş claim'leri, macro instance sınırları, sürüş/proof producer ayrımı |
| Run history / detail / performance / provenance | Yürütme, UI sonucu, iş sonucu ve kapsamı ayrı gösterme |
| Mobile SDK / App Adapter | İlk checkbox için genellikle değişim gerekmiyor; telemetry ve query performansı ayrı ölçülür |
| Android Bridge | İlk checkbox için yeni tap API gerekmiyor; gerçek süre alanları ve gelişmiş wait/batch sonradan |

## 17. Önceki konuşmadan düzeltilmesi gereken sonuçlar

| Önceki ifade | Bu incelemeden çıkan daha doğru sonuç |
|---|---|
| “Genel UI testinde doğası gereği yavaş kalırsın” | Zorunlu değil. Seçilmiş doğrulama, düşük host maliyeti ve iyi senkronizasyonla genel UI yolu yapılabilir. Rakip hız kıyası bu çalışmada ölçülmedi. |
| “Kanıtı kapatma, hep bir wait_node bırak” | ACTION_ONLY geçerli bir kullanıcı seçimi. wait_node assertion olmak zorunda değil; gerekiyorsa sonraki hedefin sürüş senkronizasyonudur. |
| “SDK değil, neredeyse kesin gate/settle” | Bu koşuda gate'siz ve WAIT'siz 67 adım 188,922 saniye. Senkron persistence önemli bir aday. |
| “UI kontrolü her zaman yalnız onlarca ms ekler” | Hedef hazırsa ucuz olabilir; görünür olma, event kaybı, tarama backoff'u ve host persistence süreyi uzatabilir. |
| “SDK optional demek yeterli” | Bugünkü queue, correlation, SDK_QUERY ve cleanup yolları ayrıca plan bazında ayrışmalı. |
| “OPTIONAL kanıt bekleme maliyeti getirmez” | Optional veriyi üreten query/remote action yine çalışıyor olabilir. |
| “Gate'i silmek iş doğrulamasını kapatır” | ASSERT_FACT, finalOraclePolicy, producer ve run aggregation da ele alınmalı. |
| “Boş veya N/A oracle güvenli UI-only verir” | Mevcut oracle fallback'i PASS_ONLINE üretebilir; claim kapsamı şart. |
| “UI-only yolu Maestro kadar dürüst olmaz” | Dürüstlük, vaat edilen assertion ile raporlanan sonucun eşleşmesidir. Kapsamı açık ACTION_ONLY yanıltıcı olmak zorunda değildir. |

## 18. Uygulanabilir karar

**Login node'una hızlı geçiş checkbox'ı eklenmeli.** Seçildiğinde login gerçek UI üzerinden sürülmeli; kullanıcı ayrıca istemiyorsa login'e ait UI/business assertion çalışmamalı. Başka bir işin kanıtını besleyen veri, correlation ve gerekli senkronizasyon bağımlılıkları korunmalı. Rapor login için “yürütüldü, doğrulanmadı” demeli.

İlk teknik öncelik, bu seçeneğin compiler'da gerçek planı değiştirmesi ve sonuç kapsamının korunmasıdır. İlk performans önceliği ise Bridge'in 50 ms tap'ini kısaltmak değil; her küçük adımda saniyeler yaratan seri persistence yolunu, tekrar gözlem işini ve timeout sonuna bırakılan interrupt kontrolünü azaltmaktır.

Bu yaklaşım aynı sistemde hem hızlı genel UI sürüşünü hem seçilmiş kritik işlemlerde ayrıntılı kanıtı mümkün kılar.

## Ek A — Kaynak kod referansları

Aşağıdaki bağlantılar inceleme anındaki yerel kaynaklara gider. Satırlar tarihsel kurulu APK'nın sürüm kanıtı değildir.

- [K1 — Step policy alanları ve kanıt sözleşmesi][K1]
- [K2 — Canvas'tan paket snapshot'ına materialization][K2]
- [K3 — Executor başlangıç, action, checkpoint ve sentetik transition yolu][K3]
- [K4 — Prisma occurrence/transition ve fenced transaction yolu][K4]
- [K5 — Bridge manager resolve/act ve protokol timestamp sınırı][K5]
- [K6 — SDK correlation, query, cleanup, hedef polling ve overlay sweep][K6]
- [K7 — Queue readiness, SDK bağlama ve runtime kurulumu][K7]
- [K8 — Oracle worker değerlendirme/persistence döngüsü][K8]
- [K9 — SDK ve derived fact yeniden yayınlama][K9]
- [K10 — Run product verdict aggregation][K10]
- [K11 — Final oracle başarı fallback'i][K11]
- [K12 — Login sorguları, optional remote ve assertion][K12]
- [K13 — Full courier day makro kompozisyonu][K13]
- [K14 — Android tap süresi][K14]
- [K15 — Bridge protokol settle ve wait varsayılanları][K15]
- [K16 — SDK kurulumu, WAL ve transport][K16]
- [K17 — Mobile automation bootstrap/capture ayarları][K17]
- [K18 — App Adapter APP/LOCAL sorgu ayrımı][K18]
- [K19 — Editor Run Test isteği ve launch seçimi][K19]
- [K20 — Pinned run compile/start ve preflight][K20]
- [K21 — Device readiness lane probe'ları][K21]
- [K22 — Plan persistence ve hash kimliği][K22]
- [K23 — Run span altyapısı][K23]
- [K24 — Tarihsel SDK A/B baseline'ın sınırı][K24]
- [K25 — Mobile delivery scanned event üreticisi][K25]
- [K26 — Mobile request oluşturma, waiting koşulları ve test seam'i][K26]
- [K27 — Mobile 120 saniyelik waiting request penceresi][K27]

## Ek B — Koşunun tam adım zaman tablosu

Bir sonraki tablo hash'i doğrulanmış compiled plan ile occurrence kayıtları eşleştirilerek üretilmiştir. “Gate” yalnız açık continueGate alanını gösterir; WAIT adımının kendi beklemesi bunun dışında olabilir. “Önceki aralık”, bir önceki occurrence completed_at ile bu adım started_at arasındadır.

| # | Adım | Tür | Süre (ms) | Önceki aralık (ms) | Gate | Final oracle | Aksiyon sonucu |
|---:|---|---|---:|---:|---|---|---|
| 1 | auth-prepare-startup-permissions | ANNOTATE | 2621 | 0 | — | — | SUCCEEDED |
| 2 | auth-read-session-precheck | SDK_QUERY | 1888 | 563 | — | — | SUCCEEDED |
| 3 | auth-check-already-signed-in | CONDITION | 3233 | 521 | — | — | SUCCEEDED |
| 4 | auth-resolve-pin-field | RESOLVE_TARGET | 2744 | 474 | — | — | SUCCEEDED |
| 5 | auth-enter-pin | BRIDGE_ACTION | 4663 | 478 | — | — | SUCCEEDED |
| 6 | auth-resolve-submit | RESOLVE_TARGET | 2577 | 518 | — | — | SUCCEEDED |
| 7 | auth-tap-submit | BRIDGE_ACTION | 8126 | 547 | Var | — | SUCCEEDED |
| 8 | auth-read-app-session | SDK_QUERY | 2023 | 486 | — | — | SUCCEEDED |
| 9 | auth-read-local-session | SDK_QUERY | 1664 | 488 | — | — | SUCCEEDED |
| 10 | auth-verify-backend-session | REMOTE_ACTION | 2880 | 453 | — | — | SUCCEEDED |
| 11 | auth-assert-login | ASSERT_FACT | 2575 | 490 | — | Var | SUCCEEDED |
| 12 | route-read-current-route | SDK_QUERY | 1878 | 417 | — | — | SUCCEEDED |
| 13 | route-check-already-selected | CONDITION | 1805 | 485 | — | — | SUCCEEDED |
| 14 | route-wait-dialog | WAIT_EVENT | 2641 | 552 | — | — | SUCCEEDED |
| 15 | route-read-offered-routes | SDK_QUERY | 2020 | 535 | — | — | SUCCEEDED |
| 16 | route-check-offered | CONDITION | 1546 | 517 | — | — | SUCCEEDED |
| 17 | route-resolve-spinner | RESOLVE_TARGET | 2369 | 401 | — | — | SUCCEEDED |
| 18 | route-tap-spinner | BRIDGE_ACTION | 4291 | 441 | — | — | SUCCEEDED |
| 19 | route-scroll-to-row | BRIDGE_ACTION | 4377 | 423 | — | — | SUCCEEDED |
| 20 | route-resolve-row | RESOLVE_TARGET | 2796 | 492 | — | — | SUCCEEDED |
| 21 | route-tap-row | BRIDGE_ACTION | 3716 | 488 | — | — | SUCCEEDED |
| 22 | route-resolve-confirm | RESOLVE_TARGET | 2454 | 428 | — | — | SUCCEEDED |
| 23 | route-tap-confirm | BRIDGE_ACTION | 5217 | 399 | Var | — | SUCCEEDED |
| 24 | route-read-local-schedule | SDK_QUERY | 2119 | 481 | — | — | SUCCEEDED |
| 25 | route-read-available-stops | SDK_QUERY | 1729 | 561 | — | — | SUCCEEDED |
| 26 | route-read-selected-route | SDK_QUERY | 1655 | 413 | — | — | SUCCEEDED |
| 27 | route-assert-selection | ASSERT_FACT | 2607 | 415 | — | Var | SUCCEEDED |
| 28 | load-wait-stop-list-ready | WAIT_EVENT | 2151 | 431 | — | — | SUCCEEDED |
| 29 | load-resolve-manual-entry | RESOLVE_TARGET | 2394 | 439 | — | — | SUCCEEDED |
| 30 | load-tap-manual-entry | BRIDGE_ACTION | 4113 | 431 | — | — | SUCCEEDED |
| 31 | load-resolve-barcode-field | RESOLVE_TARGET | 2531 | 435 | — | — | SUCCEEDED |
| 32 | load-enter-barcode | BRIDGE_ACTION | 4068 | 647 | — | — | SUCCEEDED |
| 33 | load-resolve-input-confirm | RESOLVE_TARGET | 2344 | 433 | — | — | SUCCEEDED |
| 34 | load-tap-input-confirm | BRIDGE_ACTION | 3974 | 444 | — | — | SUCCEEDED |
| 35 | load-resolve-time-slot | RESOLVE_TARGET | 2400 | 441 | — | — | SUCCEEDED |
| 36 | load-tap-time-slot | BRIDGE_ACTION | 3898 | 459 | — | — | SUCCEEDED |
| 37 | load-resolve-acknowledge | RESOLVE_TARGET | 2516 | 465 | — | — | SUCCEEDED |
| 38 | load-tap-acknowledge | BRIDGE_ACTION | 4269 | 718 | — | — | SKIPPED |
| 39 | load-read-parcel-state | SDK_QUERY | 2243 | 405 | — | — | SUCCEEDED |
| 40 | load-read-local-schedule | SDK_QUERY | 2038 | 579 | — | — | SUCCEEDED |
| 41 | load-read-available-stops | SDK_QUERY | 1595 | 483 | — | — | SUCCEEDED |
| 42 | load-check-load-refused | CONDITION | 1534 | 402 | — | — | SUCCEEDED |
| 43 | load-assert-loaded | ASSERT_FACT | 2590 | 411 | — | Var | SUCCEEDED |
| 44 | permit-read-current-schedule | SDK_QUERY | 2094 | 437 | — | — | SUCCEEDED |
| 45 | permit-check-request-already-open | CONDITION | 1493 | 533 | — | — | SUCCEEDED |
| 46 | permit-resolve-request-button | RESOLVE_TARGET | 2325 | 448 | — | — | SUCCEEDED |
| 47 | permit-tap-request | BRIDGE_ACTION | 3918 | 397 | — | — | SUCCEEDED |
| 48 | permit-resolve-routing-choice | RESOLVE_TARGET | 2395 | 415 | — | — | SUCCEEDED |
| 49 | permit-tap-routing-choice | BRIDGE_ACTION | 8614 | 424 | Var | — | SUCCEEDED |
| 50 | permit-verify-request-record | REMOTE_ACTION | 2648 | 561 | — | — | SUCCEEDED |
| 51 | permit-dispatcher-approves | REMOTE_ACTION | 2501 | 485 | — | — | SUCCEEDED |
| 52 | permit-verify-approved-status | REMOTE_ACTION | 2300 | 431 | — | — | SUCCEEDED |
| 53 | permit-await-push | WAIT_EVENT | 2153 | 647 | — | — | SUCCEEDED |
| 54 | permit-assert-approved | ASSERT_FACT | 2331 | 417 | — | Var | SUCCEEDED |
| 55 | visit-wait-stop-list-ready | WAIT_EVENT | 1927 | 411 | — | — | SUCCEEDED |
| 56 | visit-read-available | SDK_QUERY | 1707 | 399 | — | — | SUCCEEDED |
| 57 | visit-probe-search-field | RESOLVE_TARGET | 2452 | 426 | — | — | SUCCEEDED |
| 58 | visit-check-search-open | CONDITION | 1412 | 418 | — | — | SUCCEEDED |
| 59 | visit-resolve-search-toggle | RESOLVE_TARGET | 12886 | 404 | — | — | SUCCEEDED |
| 60 | visit-tap-search-toggle | BRIDGE_ACTION | 3945 | 429 | — | — | SUCCEEDED |
| 61 | visit-resolve-search-field | RESOLVE_TARGET | 2389 | 1106 | — | — | SUCCEEDED |
| 62 | visit-enter-search-term | BRIDGE_ACTION | 3850 | 403 | — | — | SUCCEEDED |
| 63 | visit-resolve-search-submit | RESOLVE_TARGET | 2690 | 402 | — | — | SUCCEEDED |
| 64 | visit-tap-search-submit | BRIDGE_ACTION | 3954 | 433 | — | — | SUCCEEDED |
| 65 | visit-resolve-row | RESOLVE_TARGET | 2392 | 403 | — | — | SUCCEEDED |
| 66 | visit-tap-row | BRIDGE_ACTION | 5236 | 419 | Var | — | SUCCEEDED |
| 67 | visit-await-destination | WAIT_ANY | 2292 | 400 | — | — | SUCCEEDED |
| 68 | visit-read-active-stop | SDK_QUERY | 1591 | 477 | — | — | SUCCEEDED |
| 69 | visit-assert-correct-item | ASSERT_FACT | 2074 | 425 | — | Var | SUCCEEDED |
| 70 | item-wait-task-list | WAIT_EVENT | 1940 | 400 | — | — | SUCCEEDED |
| 71 | item-resolve-manual-entry | RESOLVE_TARGET | 2495 | 411 | — | — | SUCCEEDED |
| 72 | item-tap-manual-entry | BRIDGE_ACTION | 3995 | 465 | — | — | SUCCEEDED |
| 73 | item-resolve-scan-field | RESOLVE_TARGET | 2854 | 481 | — | — | SUCCEEDED |
| 74 | item-enter-scan-value | BRIDGE_ACTION | 3571 | 532 | — | — | SUCCEEDED |
| 75 | item-resolve-input-confirm | RESOLVE_TARGET | 2262 | 396 | — | — | SUCCEEDED |
| 76 | item-tap-input-confirm | BRIDGE_ACTION | 7102 | 402 | Var | — | SUCCEEDED |
| 77 | item-read-pending-queue | SDK_QUERY | 1547 | 413 | — | — | SUCCEEDED |
| 78 | item-assert-delivery-started | ASSERT_FACT | 2138 | 427 | — | Var | SUCCEEDED |
| 79 | deliver-wait-flow | WAIT_EVENT | 2049 | 407 | — | — | SUCCEEDED |
| 80 | deliver-resolve-scan-entry | RESOLVE_TARGET | 2403 | 467 | — | — | SUCCEEDED |
| 81 | deliver-tap-scan-entry | BRIDGE_ACTION | 3634 | 407 | — | — | SUCCEEDED |
| 82 | deliver-resolve-scan-field | RESOLVE_TARGET | 2569 | 380 | — | — | SUCCEEDED |
| 83 | deliver-type-barcode | BRIDGE_ACTION | 3770 | 396 | — | — | SUCCEEDED |
| 84 | deliver-resolve-scan-confirm | RESOLVE_TARGET | 2373 | 403 | — | — | SUCCEEDED |
| 85 | deliver-tap-scan-confirm | BRIDGE_ACTION | 21466 | 424 | Var | — | SUCCEEDED |
| 86 | auth-clear-session | CLEANUP | 1542 | 418 | — | — | FAILED |

Tablodaki süreler integer milisaniyedir. İç süre toplamı 274.151 ms, önceki aralık toplamı 39.468 ms. Run başlangıç/son sınırlarıyla birlikte toplam 316.146 ms.

[K1]: </Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobileCocpit/packages/workflow-contract/src/ir-v2.ts:162>
[K2]: </Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobileCocpit/apps/api/src/services/bridgeflow-compile-adapter.ts:101>
[K3]: </Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobileCocpit/packages/bridgeflow-executor/src/index.ts:898>
[K4]: </Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobileCocpit/apps/api/src/services/bridgeflow-prisma-persistence.ts:144>
[K5]: </Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobileCocpit/apps/api/src/services/bridge-device-manager.ts:402>
[K6]: </Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobileCocpit/apps/api/src/services/bridgeflow-device-ports.ts:270>
[K7]: </Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobileCocpit/apps/api/src/services/bridgeflow-execution-queue.ts:977>
[K8]: </Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobileCocpit/apps/api/src/services/oracle-evaluation-worker.ts:144>
[K9]: </Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobileCocpit/apps/api/src/services/bridgeflow-execution-queue.ts:495>
[K10]: </Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobileCocpit/packages/bridgeflow-executor/src/index.ts:1907>
[K11]: </Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobileCocpit/packages/oracle-engine/src/index.ts:162>
[K12]: </Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobileCocpit/domain-packs/nesy-courier/src/macros/login.ts:227>
[K13]: </Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobileCocpit/domain-packs/nesy-courier/src/macros/full-courier-day.ts:143>
[K14]: </Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-bridge/app/src/main/java/com/verdict/bridge/UiActions.kt:718>
[K15]: </Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-bridge/app/src/main/java/com/verdict/bridge/ProtocolV1.kt:2030>
[K16]: </Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/verdict-sdk/src/main/kotlin/com/verdict/sdk/VerdictSdkImpl.kt:109>
[K17]: </Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/app/src/automation/java/com/arasdigital/nesymobile/verdict/VerdictBootstrap.kt:103>
[K18]: </Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/app/src/automation/java/com/arasdigital/nesymobile/verdict/NesyAppAdapterQueryCapability.kt:76>
[K19]: </Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobileCocpit/apps/web/src/app/(automation-editor)/automation/[id]/workflow-editor.tsx:2653>
[K20]: </Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobileCocpit/apps/web/src/lib/verdict-runtime/start-pinned-run.ts:24>
[K21]: </Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobileCocpit/apps/api/src/services/device-readiness.service.ts:43>
[K22]: </Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobileCocpit/apps/api/src/services/phase6-prisma-stores.ts:71>
[K23]: </Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobileCocpit/apps/api/src/services/run-spans.ts:1>
[K24]: </Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobileCocpit/docs/verdict/goals/G90-stabilization/READINESS.md:22>
[K25]: </Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/app/src/automation/java/com/arasdigital/nesymobile/verdict/AutomationDeliveryHelper.kt:118>
[K26]: </Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/app/src/main/java/com/arasdigital/nesymobile/main/SharedViewModel.kt:1307>
[K27]: </Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile/app/src/main/java/com/arasdigital/nesymobile/services/RequestSenderService.kt:250>
