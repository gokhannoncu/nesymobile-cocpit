# Local PostgreSQL + persistence iyileştirmesi — RUN

```yaml
workPackage: local-postgres-persistence-performance-2026-09-05
packageState: READY_FOR_CURSOR
executionState: NOT_STARTED
createdAt: 2026-09-05
language: tr
play: PLAY.md
result: RESULT.md
```

Bu klasör Cursor'a devredilecek uygulama ve ölçüm paketidir. Dosyaların oluşturulması optimizasyonların uygulandığı veya yeni deneylerin çalıştırıldığı anlamına gelmez. Sonuçları yalnız gerçek çalışmadan sonra RESULT.md'ye yaz.

## Cursor'a verilecek başlangıç mesajı

> Bu klasördeki RUN.md, PLAY.md ve RESULT.md dosyalarını oku. PLAY.md sırasıyla üç işi uygula: (1) aynı planı aynı şema/veri modeliyle local PostgreSQL üzerinde karşılaştırmalı ölç; (2) recovery ve fence güvenliğini koruyarak aynı atomik sınıra ait persistence kayıtlarını birleştir; (3) karar için gerekmeyen raporlama/projection kayıtlarını yerelde dayanıklı outbox üzerinden toplu arka plan aktarımına ayır. Mevcut profil araçlarını kullan ve gerektiğinde uyumlu geliştir. Her fazı ayrı değişiklik ve ayrı ölçüm olarak kaydet. Uygulamayı ve gerçek USB koşularını tamamla; yalnız öneri yazıp bırakma. Gerçek bir dış bağımlılık engeli varsa etkilenen fazı BLOCKED_EXTERNAL olarak raporla ve bağımsız işleri sürdür. RESULT.md'yi gerçek run ID, süre, test, artifact ve kalan sorunlarla doldur. Workflow'un kanıt kurallarını gevşeterek, başarısız adımları atlayarak veya eksik girdiyi tahmin ederek hızlanma üretme. Mevcut kullanıcı değişikliklerini koru.

## Amaç ve kapsam

Başarı üç ayrı soruya sayıyla cevap verebilmek:

1. Uzak PostgreSQL → local PostgreSQL değişikliği, aynı kodla ne kazandırdı?
2. Aynı local DB üzerinde transaction birleştirmesi ayrıca ne kazandırdı?
3. Aynı kod/DB koşulunda raporlama aktarımını bekleme yolundan çıkarmak ayrıca ne kazandırdı; veri kaybı veya recovery gerilemesi oluştu mu?

Bu paket Cockpit'in persistence ve raporlama yolunu değiştirir. Mongo geçişi, SDK kapatma, UI-only checkbox, domain pack iş kurallarını değiştirme, overlay timeout düzeltmesi ve mobil WAL optimizasyonu kapsam dışıdır. Gerekirse bunlar sonuçta ayrı takip maddesi olur. Böylece ölçümde hangi değişikliğin etkili olduğu anlaşılır.

## Çalışma alanları

- Cockpit: `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobileCocpit`
- Mobile/SDK/Bridge: `/Users/gokhanoncu/Desktop/Pype/Pype Develop/Consultants/NesyMobile`
- Workflow: `nesy.workflow.full-courier-day`
- UI: `http://localhost:4002/automation/nesy.workflow.full-courier-day`
- API: `http://localhost:4001/api/verdict/runtime`
- USB cihaz: `R6CW400BC8N` — Samsung SM_A346E
- Uygulama: `com.arasdigital.nesymobile.rstest`
- ADB: `/Users/gokhanoncu/Library/Android/sdk/platform-tools/adb`

Bunlar paket hazırlanırken kullanılan değerlerdir; çalışmaya başlarken erişimi ve aktif konfigürasyonu doğrula. Mobil/SDK/Bridge kodunu başlangıçta değiştirme veya APK'yı yeniden kurma. Gerekli bağımsız bir uyumluluk değişikliği ortaya çıkarsa fazdan ayırıp nedenini raporla.

## Önce okunacak kanıt

- [Gerçek USB darboğaz raporu](../../analysis/LIVE_USB_WORKFLOW_BOTTLENECK_REPORT_2026-09-05.md)
- [Adım modları ve mimari analiz](../../analysis/STEP_EXECUTION_MODES_AND_PERFORMANCE_ANALYSIS_2026-09-05.md)
- [Mevcut profiler kullanım kılavuzu](../../../../scripts/LIVE_WORKFLOW_PROFILING.md)

Tarihsel ölçüm — yeni deney sonucu olarak kullanma:

| Ölçüm | Değer |
|---|---:|
| Run | `run_1129ab94-bf0c-4528-ae90-5c417af425eb` |
| History / queue kapsamı | 237,054 / 245,809 sn |
| DB aralıklarının birleşimi | 210,877 sn |
| Transaction | 423 adet; toplam 207,881 sn; medyan 470,65 ms |
| Gerçek Bridge istekleri | Toplam 3,470 sn |
| SDK kontrolü | Toplam 4,166 sn; ADB bunun içinde |
| PIN yazma adımı | 4.361,4 ms; DB 4.117,6 ms |
| Host span kalitesi | 4.042 span; dropped=0; writeError=false |

Ek salt okuma teşhisi: uzak DB'de sekiz sıcak `SELECT 1` istemci ölçümü 66,72–87,46 ms; üç seri `SELECT 1` içeren transaction 401,22–409,55 ms; tek `EXPLAIN ANALYZE SELECT 1` sunucu execution değeri 0,02 ms. Bunlar disk yazma hızını ölçmez. Ağ/istemci/transaction yaşam döngüsü maliyetini ayırmaya yardımcı olur.

Tarihsel run **70 occurrence sonunda `deliver-type-barcode` adımında `run.input.consignmentNumber` eksikliğiyle durdu**; product verdict `INCONCLUSIVE`, cleanup `SUCCEEDED`. Daha eski referans `run_3ef0e142-003b-4537-98c1-3939144f3feb` da aynı şekilde geçerli tam akış baseline'ı sayılmamalı. Eksik girdili geçmiş run'ı yeniden başlatıp “tam workflow testi tamamlandı” deme.

## Değişmez koşullar

- Cihaz sahipliği, lease/fence token ve epoch, expiry, idempotency ve recovery revision denetimleri korunur.
- Kalıcı checkpoint oluşmadan sonraki aksiyonun güvenliği varsayılmaz; belirsiz dispatch sonucu otomatik tekrar tap'e çevrilmez.
- Continue gate/final oracle zorunlulukları, proof kapsamı, timeout, retry, cleanup ve workflow step sırası performans için değiştirilmez.
- Gerçek gesture gerçekleşmeden `GESTURE_COMPLETED` gibi zamanların oluştuğu mevcut sorun başarı kanıtı sayılmaz. Profil gerçek çağrı sınırlarından alınır. Semantik transition düzeltmesi gerekiyorsa ayrı commit/ölçüm ile açıkça gösterilir.
- Ağ/remote işlem veya cihaz gesture'ı boyunca DB row lock/transaction açık tutulmaz.
- Remote DB için schema migration, reset, truncate veya eski kayıtların toplu değiştirilmesi yapılmaz. Deneysel migration ve hata enjeksiyonu yalnız ayrılmış local test DB/sink'te.
- Aynı USB cihazı iki queue/recovery worker kümesi aynı anda yönetmez. Kopya DB'lerdeki fence'ler birbirinden habersizdir.
- PIN, token, bağlantı şifresi, ham müşteri girdisi, DB dump veya kişisel veriler RESULT.md'ye/Git'e yazılmaz.

## Fazlar ve karşılaştırma

| Kol | DB | Persistence | Rapor aktarımı |
|---|---|---|---|
| A | Mevcut uzak PostgreSQL | Mevcut seri yol | Mevcut davranış |
| B | İzole local PostgreSQL | A ile aynı kod | A ile aynı davranış |
| C | B ile aynı local DB koşulu | Birleştirilmiş atomik kayıt sınırları | B ile aynı davranış |
| D | C ile aynı local DB koşulu | C ile aynı | Dayanıklı outbox + toplu worker |

A/B DB konumunu; B/C transaction tasarımını; C/D raporlama ayrımını ölçer. D'de raporlanan veri kapsamı artıyorsa bunu eş iş yükü kıyası diye sunma; eş kapsamlı kontrollü reporting deneyi PLAY.md'de tariflidir.

Her faz sonunda sonuç checkpoint'i bırak. Tek büyük refactor yapıp yalnız ilk/son toplamları kıyaslama. Bir faz ölçülebilir fayda göstermiyorsa bunu açıkça yaz; hızlanma garantisi yok.

## Tamamlanma tanımı

1. Local DB güvenli kurulum, eş veri hazırlama, seçme ve eski konfigürasyona dönüş adımları çalışır ve belgelenmiştir.
2. A/B karşılaştırması yeni, eş kapsamlı koşularla yapılmış veya neden karşılaştırılamadığı açıkça raporlanmıştır.
3. Transaction değişikliği gerçek PostgreSQL üzerinde fence/recovery/replay testlerini geçmiştir; transaction turu ve süre etkisi gösterilmiştir.
4. Raporlama sınıflandırması yapılmış; yalnız projection'lar arka plana ayrılmıştır. Outbox commit, retry, duplicate/reorder, restart ve sink kesintisi testleri geçmiştir.
5. Tam iş akışı geçemiyorsa ürün başarısı iddia edilmemiş; durduğu adım/girdi/kanıt nedeni kaydedilmiştir. Performans ve ürün sonucu ayrı durumdur.
6. RESULT.md doldurulmuş, artifact yolları açılabilir, çalıştırılan kod sürümü ve build kimliği kayıtlıdır.
7. Son aktif DB modu, API/UI sağlık durumu, worker'lar ve rollback durumu açıkça bildirilmiştir.

Teknik ilerleme yetkisi bu paket kapsamındadır. Geçerli iş girdisi, erişim veya cihaz yoksa tahmin etme; gerekli bilgiyi açıkça bildir ve yalnız ona bağımlı işi durdur. Bu paketi yürütmek için tekrar genel “devam edeyim mi” onayı isteme.
