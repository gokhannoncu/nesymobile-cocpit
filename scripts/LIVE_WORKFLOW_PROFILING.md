# USB cihazda workflow performans ölçümü

Bu araç mevcut bir koşunun sabitlenmiş planını ve kayıtlı girdilerini kullanarak **gerçek bir yeni koşu başlatır**. Uygulamada o workflow'un işlemleri gerçekleşir. Sadece geçmiş kayıt okumaz. Yeni sessionCorrelationId üretir; kanıt kuralları, timeout, retry ve adım sırası değiştirilmez.

## Çalıştırma

Repo kökünden, API ve UI çalışırken:

```sh
node scripts/profile-live-workflow.mjs \
  --baseline-run run_3ef0e142-003b-4537-98c1-3939144f3feb \
  --device R6CW400BC8N \
  --output artifacts/live-profile/usb-measurement
```

API'nin ölçüm kodunu yüklemiş olması gerekir. Runner, `/tmp/nesy-live-profile-installed.json` içindeki PID'yi API portunu dinleyen PID ile karşılaştırır. Eski çalışan process kodu yüklememişse cihazda işlem başlatmadan durur. API yeniden başlatılması gerekiyorsa önce aktif koşunun bitmesini bekleyin.

Runner, USB bağlantısını, son 50 koşuda cihazı kullanan aktif kayıtları ve baseline workflow sürümünü kontrol eder. Bu kontrol ek bir ön kontroldür; gerçek cihaz sahipliği mevcut queue/fence mekanizmasında kalır. Aynı çıktıya ikinci koşu yazmak yerine yeni klasör kullanın. Varsayılan API `http://localhost:4001/api/verdict/runtime`; `--api`, `--adb`, `--device` ile değiştirilebilir. Bu sürüm aynı makinedeki API/PID/Prisma kurulumuna yöneliktir.

Tamamlandıktan sonra:

```sh
python3 scripts/analyze-live-profile.py artifacts/live-profile/usb-measurement/run_YENI_ID
```

## Çıktılar

| Dosya | İçerik |
|---|---|
| capture.json | Baseline, plan hash, cihaz, paket sürümü, girdi alanlarının isimleri |
| run-start.json | Gerçek yeni run ID |
| run-snapshot.json | Sonuç ve adım zamanları; girdi/remote payload yok |
| telemetry-summary.json | HTTP zaman/metot/host/path/status özeti; gövde yok |
| android.pftrace | Cihazın scheduler, process, Binder ve UI sistem izi |
| run_ID/manifest.json | Host saat başlangıcı |
| run_ID/events.jsonl | Gerçek metot/komut başlangıç ve süreleri, parent ilişkisi |
| run_ID/summary.json | Metot bazında inclusive/self süreler ve kayıt kaybı bilgisi |
| run_ID/trace.json | Chrome/Perfetto trace formatında host zaman çizelgesi |
| run_ID/complete.json | Host ölçümünün kapandığını gösterir; workflow PASS anlamına gelmez |
| run_ID/analysis.json, TIMINGS.md | Analiz scriptinin ürettiği tablolar |

Dosyalar `artifacts/live-profile/` altında Git dışında tutulur. Ölçüm katmanı PIN, SQL parametreleri, request/response gövdeleri veya exception mesajları kaydetmez. Android sistem izi process/ekran adlarını; HTTP özeti URL path'lerini içerebilir. Bunları paylaşmadan önce veri kapsamını değerlendirin.

## Ne ölçülür?

- `executor.step`: gerçek executor adımının toplam süresi.
- `persistence.*`: occurrence, recovery checkpoint, fence, transition ve oracle kayıt sınırları.
- `db.transaction`: callback transaction'ın bağlantı/başlatma/sorgular/commit dahil duvar saati süresi.
- `db.Model.operation`, `db.$queryRaw`: persistence client üzerinden gerçekten çalıştırılan DB çağrıları. SQL metni kaydedilmez.
- `bridge.admission_and_request`: host admission ve Bridge isteği.
- `bridge.client_request`: gerçek Bridge istemci isteği; komut türü ve requestId ile.
- `sdk.control`: host SDK kontrol çağrısı.
- `adb.control_command`: bu SDK kontrolünün kullandığı ADB alt çağrıları, sadece teknik fiil ile.
- `oracle.continue_gate`, `oracle.final`: gerçek kanıt değerlendirme/bekleme süresi.
- `port.remoteRuntime.execute`: remote adım portunun süresi; saf HTTP süresi değildir.

Sentetik `GESTURE_COMPLETED` transition zamanlarından cihaz jest süresi türetilmez. SDK ve Bridge APK'ları bu çalışma için yeniden derlenmez. Android sistem izi ayrı alınır.

## Sürelerin doğru okunması

DB süresi oracle süresinin içinde, ADB süresi SDK süresinin içinde olabilir. Tablodaki kategorileri toplamayın. Analiz her kategori içinde zaman aralıklarının birleşimini alır; ortak aralıkları iki kez saymaz. `selfMs`, doğrudan çocuk span'ların birleşimini çıkarır; saf CPU süresi değildir.

`bridge.client_request` soket/pool/transport ve cihaz işlemini içerir. `sdk.control` uygulama içi SDK bootstrap veya saf SDK CPU maliyetine eşit değildir. `db.transaction` doğrudan PostgreSQL sunucu CPU süresi değildir; network, transaction yaşam döngüsü ve kilit beklemesi içerebilir. Profil kapsamı queue execute başlangıcından kapanışına kadardır; API admission öncesini ayrı ölçmez.

Host trace `performance.now()` kullanır. `Date.now()` epoch anchor manifest'tedir. Android trace farklı monoton saat kullanır; iki dosyayı başlangıçları aynıymış gibi üst üste koymayın. Process CPU toplamı da kullanıcıya yansıyan gecikme ile aynı değildir.

## Davranış ve sınırlar

Ölçüm varsayılan kapalıdır. Runner cihaz/workflow ile eşleşen tek kullanımlık `/tmp/nesy-live-profile-arm.json` oluşturur; queue bunu tüketir. Sonraki koşu kendiliğinden profillenmez. `VERDICT_LIVE_PROFILE_ARM` iki process'te aynı ayarlanarak yol değiştirilebilir.

Ölçüm yeni iş kuralı, SDK kapatma, gate atlama veya ek retry eklemez. Run async context'inin dışındaki background işler ayrı etiketlenmez; yaratabilecekleri DB/CPU rekabeti ölçülen süreye yansıyabilir. Prisma proxy mevcut persistence katmanındaki callback transaction kullanımına yöneliktir; genel amaçlı tüm Prisma kullanım biçimleri için kütüphane değildir.

En fazla 100.000 tamamlanmış host span tutulur. `summary.json` / `complete.json` içindeki `dropped` ve `writeError` kontrol edilmelidir. Android kaydı en çok 10 dakika/512 MB; uzun veya çok yoğun koşuda erken kesilebilir. Runner toplam 15 dakika sonra ölçüm beklemesini bırakır; workflow'u otomatik iptal etmez veya yeniden çalıştırmaz. Ctrl-C sonrası workflow API'de sürüyor olabilir; yeni koşudan önce sahiplik kontrol edin.

Trace toplamak da ek yük getirir. Profilli koşuyu tek başına bir performans garantisi olarak kullanmayın; aynı planın yeterli sayıda eş koşulda profilli/profilsiz tekrarları gerekir. Başarıyla ilerlediği farklı adım sayıları olan iki koşunun toplam süresini hızlanma yüzdesi diye sunmayın.

Android dosyasını sorgulamak için resmi [Perfetto Trace Processor](https://perfetto.dev/docs/analysis/trace-processor) kullanılabilir. Host trace ve Android trace yerel analiz içindir; çalışma sırasında dış servise yüklenmez.

Trace Processor kuruluysa process/thread CPU süreleri ve kayıp sayaçları:

```sh
trace_processor query -f scripts/analyze-android-profile.sql artifacts/live-profile/usb-measurement/android.pftrace
```

5 Eylül 2026 gerçek koşu sonuçları: [USB darboğaz raporu](../docs/verdict/analysis/LIVE_USB_WORKFLOW_BOTTLENECK_REPORT_2026-09-05.md).

## İlgili uygulama kodu

- `apps/api/src/services/diagnostics/live-profile-recorder.ts`: saatler, span hiyerarşisi, JSONL/trace export, Prisma callback ölçümü.
- `apps/api/src/services/diagnostics/live-run-profiler.ts`: mevcut runtime metotlarına tanısal hook'lar.
- `apps/api/src/services/diagnostics/profiled-control.ts`: SDK kontrolü ve onun ADB runner'ı.
- `apps/api/src/server.ts`: hook'ların yüklenmesi.
- `apps/api/src/services/bridgeflow-execution-queue.ts`: koşu kontrol executor'ının ölçümlü oluşturulması.

Bu sürüm bir teşhis aracıdır. Kalıcı ürün telemetry altyapısına taşınacaksa prototype hook'ları yerine açık observer portları, exporter backpressure ve schema sürümlemesi eklenmelidir.
