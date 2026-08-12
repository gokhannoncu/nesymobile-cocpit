# Phase 10 RUN_PLAY — Workflow Evidence Completion (login → select-route → …)

```yaml
runPlayId: verdict-cockpit-phase-10-run-play
phase: "10"
phaseName: "Workflow Evidence Completion"
status: IN_PROGRESS
createdAt: "2026-08-12 05:20:00 +03"
startedAt: "2026-08-11 14:00:00 +03"
completedAt: null
lastUpdatedAt: "2026-08-12 11:30:00 +03"
timezone: "Europe/Istanbul"
previousPhaseResult: "docs/verdict/run-playbooks/phase-9/RESULT.md"
resultFile: "docs/verdict/run-playbooks/phase-10/RESULT.md"
phase10Target: "EVERY_WORKFLOW_DECIDABLE_ON_DEVICE"
domainPackVersion: "1.5.0"
device: "R6CW400BC8N / com.arasdigital.nesymobile.rstest / tstrsDebug"
```

## 1. Amaç

Phase 9 runtime lane'lerini `CODE_WIRED` durumuna getirdi. Bu faz, o lane'lerin
gerçekten **karar üretip üretmediğini** kapatır: her iş akışı, cihazda koştuğunda
PASS ya da FAIL diyebilmeli — `INCONCLUSIVE / EVIDENCE_INSUFFICIENT` değil.

Fazın çıkış noktası şuydu: `nesy.workflow.login` cihazda koşuyor ama **1 adımda**
duruyor ve verdict `INCONCLUSIVE` geliyordu. Kök neden aramak, sistemik bir
desen ortaya çıkardı — Domain Pack bir fact bildiriyor, host tarafında onu üreten
hiçbir şey yok. Bu faz o deseni her katmanda kapatır.

## 2. Ana bulgu (fazın gerekçesi)

> Pack bir kanıt kaynağı **bildirdiği** için, o kanıtın **üretildiği** varsayıldı.
> Üretilmiyordu.

Bir makronun üreticisi olmayan bir fact'i REQUIRED tutması katı olmak değil,
**cevabı olmayan bir soru sormaktır**. Sonuç her zaman `EVIDENCE_INSUFFICIENT`
olur ve bu, test altyapısını suçlayan bir mesajdır — ürünü değil. Yani gerçek bir
ürün kusuru olsa bile aynı çıktıyı görürdük.

Fazın tamamı bu ayrımı korumak üzerine kuruldu:

| Durum | Doğru rapor |
|---|---|
| Gözlendi, doğru | PASS |
| Gözlendi, yanlış | **FAIL_PRODUCT** |
| Gözlenemedi | INCONCLUSIVE |
| Önkoşul kurulamadı | BLOCKED |

## 3. Yapılanlar

### 3.1 Back-office sözleşme hizalaması

| # | İş | Durum |
|---|---|---|
| 1 | `responsePath` sözleşme testi (9 operasyonu total şekilde doğrular) | `DONE` |
| 2 | Dört kırık normalizer düzeltildi | `DONE` |
| 3 | Çift zarf açma + iç iş hatasının yakalanması | `DONE` |
| 4 | Remote çağrı denetim kaydı (`responseRef`, audit sink) | `DONE` |

**Ölçüm:** uyuşmazlık `read-session`'a özel değildi — 6 operasyondan 4'ü kırıktı.
`select-route`'un bağladığı `assignment.exists` de sessizce `UNKNOWN` yayınlıyordu.

`GetMyInfo` iki katman zarf döndürüyor (`UserOperation.GetMyInfo`
`SetSuccessResponse`'a tam bir `ResponseMessage` veriyor), diğer üç uç tek katman.
Ölçülerek doğrulandı; körlemesine iki kat açmak yerine **tespit üzerine** açılıyor.
Dıştaki 200'ün altında gizlenen iç iş hatası da artık yakalanıyor.

### 3.2 Kanıt üretim hattı

| # | İş | Durum |
|---|---|---|
| 5 | `nesy.db.session` named query (LOCAL düzlem) | `DONE` |
| 6 | login makrosuna SDK_QUERY fact bağlamaları | `DONE` |
| 9 | Türetilmiş fact motoru | `DONE` |
| 12 | Cihaz olayı kaynak kayıtları | `PARTIAL` |
| 14 | Surface hazırlık kanıtı | `DONE` |
| 15 | Launch profile önkoşul kurulumu | `DONE` |

**Cihaz olayı → fact borusu üç halkalı ve üçü de eksikti:**
host cihaza korelasyon göndermiyordu, cihaz emit'lerine iliştirmiyordu, host'ta
sözlük boştu. Sonuç: **hiçbir cihaz olayı fact'e dönüşmüyordu** — sadece login
için değil, hiçbir iş akışı için.

Üçü de kuruldu. Yol boyunca iki tıkanma daha çıktı, ikisi de aynı sınıftan —
"bilmiyorum"u "hata" saymak:

- Korelasyon artık her emit'te olduğu için, **kayıtlı olmayan her tel adı** sıralı
  kanıt hattını kilitliyordu (`orderedLag: 10`). Bildirilmemiş olay artık yok
  sayılıyor, reddedilmiyor.
- **Kaynağın bildirmediği hat** da kilitliyordu. İngest her kareyi iki hatta
  dağıtıyor; tek hat bildiren kaynak diğerini kaçınılmaz görüyor.

**Kapı/oracle hat ayrımı:** devam kapıları `RECEIPT_SAFE`, final oracle
`ORDERED_REQUIRED` okuyor. Kapının görmesi gereken bir fact iki hatta da
kaydedilmeli — bu bir tur kaybettirdi.

**Occurrence kapsamı:** kanıt occurrence'a göre kapsamlı; bir adımda yayınlanan
fact sonraki adımın oracle'ına ulaşmaz. `sdk-observation-store.ts` gözlemi
kaydediyor, kanıt portu **soran occurrence'ın kapsamına** yayınlıyor — ekran
gözlemcisinin zaten kullandığı desen.

**Türetilmiş fact motoru** (`derived-fact-engine.ts`): pack hep bildiriyordu,
host hiç okumuyordu. İki reducer uygulandı; uygulanmayanlar **sessiz kalıyor** —
kimsenin yazmadığı bir reducer'dan uydurulmuş sonuç, kendini karşılanmamış diye
raporlayan bir gereksinimden kötüdür. Korelasyon istendiğinde girdiler aynı
`correlationValue`'yu taşımıyorsa ateşlemiyor: "backend bir turu onayladı" +
"kurye bir tur istedi", aynı tur değilse kanıt değildir.

**Launch profile hazırlığı:** `preparationOperationRefs` sözleşmede,
doğrulamasında ve bir read model'de geçiyordu; **hiçbir runtime çağırmıyordu**.
`PREPARED_SESSION` / `DIRECT_STATE` profilleri tamamen işlevsizdi. Artık
çağrılıyor ve tutmazsa koşu `BLOCKED` — ürün hatası değil.

### 3.3 Karar semantiği

| # | İş | Durum |
|---|---|---|
| 7 | `REMOTE.AUTH_ACCEPTED` OPTIONAL + belgelendi | `DONE` |
| 10 | Reddedilen login artık ürün hatası | `DONE` |
| 11 | Bayat koşu çiti | `DONE` |

**`ASSERT_FACT` her tatmin edilmeyen durumda `evidenceInsufficient` işaretliyordu**
— fact'in **yok** olmasıyla **false ölçülmüş** olmasını aynı kutuya koyuyordu.
`aggregateProductVerdicts` bu bayrağı görünce oracle'ın ürettiği `FAIL_PRODUCT`'ı
maskeliyordu. Yani **her gerçek ürün hatası "yeterli kanıt yok" diye raporlanıyordu.**

**Koşu çiti:** `BridgeDeviceManager` cihaz başına bir kez yaratılıp **ilk koşunun**
kimliğini süreç boyunca taşıyordu. İkinci koşudan itibaren her koşu cihaza birinci
koşunun adına dokunuyordu — çitleme fiilen kapalıydı.

**OPTIONAL doğrulama adımı** artık koşuyu iptal etmiyor
(`onUnavailable: RECORD_UNMEASURED`, yalnız READ_ONLY VALIDATION için).
Oy kullanmayan bir ayağın erişilemez olması testi düşürmemeli.

### 3.4 İş akışı modelleme düzeltmeleri

| # | İş | Durum |
|---|---|---|
| 16 | `select-route` sunulan rotaları okuyor | `DONE` |
| 17 | Rota diyaloğu hedef modeli | `OPEN` |
| 18 | `sql_named` parametre transport'u | `DONE` |

- Her bağımsız iş akışı artık **tek makro** referans ediyor. `macroRefs: [login, X]`
  iki anlık görüntü üretiyordu ve boş kanvas tek görüntüden materyalize
  edilebildiği için **beş iş akışı hiç derlenemiyordu**. Giriş yapmak bir önkoşul,
  launch profile'ın işi.
- `read-offered-routes` adım adını taşıyıp **seçili** rotayı okuyordu; seçimden
  önce cevabı "hiçbiri", yani kontrol hiçbir koşulda geçemezdi.
- Koşul `step.output` operandı adım kimliğine bakıyor, SDK_QUERY ise çıktısını
  `outputVariable` adıyla saklıyordu — değişken hiç bulunamıyordu.
- `.codes` diye bir alan yoktu; bir yol parçası satır kümesine uygulandığında
  artık o sütunu her satırdan topluyor.
- Sınır 50'ydi, cihaz **253 rota** ile okumayı komple reddediyordu. Kısaltma
  sessizce yalan söylerdi: kesim ötesindeki rota "sunulmadı" olurdu.
- `tap-confirm` kapısı iki adım **aşağıda** üretilen bir fact'i bekliyordu.

### 3.5 #18 — named query parametre transport'u

**Kök neden iki taraf arasındaki sessiz ayrışmaydı, tek bir hata değil.** Host
parametreleri **tek tek** broadcast extra'sı olarak yolluyordu; cihazdaki
`sqlNamedHandler` ise **iç içe bir nesne** (`params["params"]`) okuyordu. Nesne
hiç oluşmadığı için `args` her zaman boştu — sorgu koşuyor ama **filtresiz**,
hata da vermeden. Parametre alan her named query bundan etkileniyordu.

Kaynağı okurken not edilenden **iki fazla** uyuşmazlık çıktı:

- `ControlPlaneContract` `extras["params"]`'ı Map olarak ayrıştırdıktan sonra
  içeriğini **üst seviyeye düzleştiriyordu**, `"params"` de rezerve olduğu için
  flat döngü onu geri eklemiyordu. Yani Map gönderilebilse **bile**
  `params["params"]` asla oluşmayacaktı — nested yol da ölüydü, sadece transport
  değil.
- `params.params` şekli WebSocket kanalında **zaten kanonik ve çalışır durumda**
  (`WebSocketCommandChannel` envelope'un params nesnesini düzleştirmez). Bu,
  seçenek (b)'nin maliyetini yükseltti: `OptionalBuiltins`'i flat okumaya
  çevirmek WS'teki çalışan şekli de kırardı.

**Kullanıcı kararı: (a).** Uygulanan:

| Katman | Değişiklik |
|---|---|
| `ControlPlaneContract.kt` | `extras["params"]` JSON **string** kabul ediyor, `CommandJsonReader` ile ayrıştırılıyor, **düzleştirilmeden** `params["params"]` altında kalıyor. Boş extra = parametre yok; bozuk/nesne olmayan JSON → `INVALID_PARAM "params"`; 64 KiB sınırı |
| `WebSocketCommandChannel.kt` | `CommandJsonReader` `internal` — iki kanal **tek** parser paylaşıyor |
| `OptionalBuiltins.kt` | **değişmedi** — (a)'nın amacı buydu |
| `control-channels/index.ts` | `sql_named` tek `--es params '<json>'` yolluyor; `name` ve `maxRows` düz kalıyor (maxRows sorgu argümanı değil, kayıt zamanı sınırı) |
| `control-channels/index.ts` | `deviceShellQuoted` — `adb shell` argv'yi uzak `sh -c`'ye birleştirdiği için JSON tek tırnakla korunuyor |
| `control-channels/index.ts` | rezerve alan koruması `sql_named`'i de kapsıyor ve `throw` yerine kodlu `INVALID_PARAM` dönüyor (`seed` ile aynı; throw kanaldan kaçıp çağırana exception gidiyordu) |

**İkinci bir parser yazılmadı.** İki tarafın ayrı ayrı ayrıştırması bu hatanın
tekrar doğma yoluydu; WS'in okuyucusu paylaşıldı.

**Cihazda ölçüldü** (R6CW400BC8N, tstrsDebug). Ölçüm uygulama verisinden
bağımsız iki sonda ile yapıldı — çünkü `NesyOfferedRoutesStore` bellekte ve rota
diyaloğu açılınca dolduğu için taze kurulumda filtreli/filtresiz **ikisi de 0
satır** verir, hiçbir şey ayırt etmez:

```text
nesy.parcelState  parametresiz  → MISSING_PARAM barcode|waybillNumber
nesy.parcelState  {barcode:…}   → OK            (argüman handler'a ULAŞTI)
nesy.recovery.fiscal echo       → "31 *" · "tek'tirnak" · 'cift"tirnak'
                                  · çoklu boşluk — HEPSİ BİREBİR döndü
sayısal değer                   → String'e dönüşmüyor, JSON tipi korunuyor
```

Boşluklu değerin çalışması yeni bir kazanç: `--es matchKey "31 *"` eskiden
reddediliyordu, yani fiscal etiketiyle sorgulamak **hiç** mümkün değildi.

**Fixture iki tarafı birlikte sabitliyor:** `index.test.ts` emit edilen argv'nin
tırnaklı tek `params` extra'sı olduğunu ve parametrelerin üst seviyede
**olmadığını** doğruluyor; `ControlPlaneContractTest.kt` aynı JSON'un cihaz
tarafında iç içe kaldığını, bozuk JSON'un reddedildiğini doğruluyor.

**Ölçülmeyen:** orijinal belirtinin kendisi — `nesy.offeredRoutes`
`matchKey="31"` ile 353 → 1 satır. Önkoşulu login + rota diyaloğu (VPN + API).
Uygulama tarafındaki filtre zaten yerinde
(`NesyAppAdapterQueryCapability.kt`, `params["matchKey"]` okuyor); eksik olan tek
şey transport'tu. Bu ölçüm §5.1'in ilk adımı.

### 3.6 Sırbistan fiscal kuralı

`31 *` içindeki yıldız **rota kodunun parçası değil** — fiscal zorunluluğunu
gösteren, Sırbistan'a özel bir iş kuralı. Diğer ülkelerde aynı rota `31`.

Ayrıştırma cihazda yapılıyor (görünen metni ve ülke bilgisini o taşıyor) ve
projeksiyon üçünü ayrı bildiriyor: `route_code` (kimlik), `route_label`
(görünen), `fiscal_required` (kural). Her fiscal rota iki adreslenebilir adla
satır üretiyor, ikisi de aynı `route_code`'da anlaşıyor — böylece workflow UI'dan
`31` de `31 *` de yazılabiliyor.

**Ölçüldü:** 253 rota → 353 satır, 200 satır fiscal (100 fiscal + 153 düz rota).

### 3.7 Yan bulgu — erişilebilirlik onarımı

`restoreAccessibilityService` dört ayrı adb çağrısıydı ve `accessibility_enabled=0`
ile başlıyordu. Kesinti (API restart) **cihazın genel erişilebilirlik anahtarını
kapalı bırakıyordu**. Bu bir test hatası değil, birinin telefonunda erişilebilirliği
sessizce kapatmaktır. Ana anahtar artık hiç 0'a yazılmıyor.

## 4. Cihazda doğrulanan durum

```text
login   doğru PIN    → PASS_ONLINE    9 adım    (9 ardışık koşu, 0 stale_run)
login   yanlış PIN   → FAIL_PRODUCT   9 adım
select-route          → wait-dialog / read-offered-routes / check-offered SUCCEEDED
                        resolve-row FAILED  (#18 öncesi ölçüm; transport düzeldi,
                        yeniden koşulmadı — §5.1)
sql_named params      → argümanlar handler'a ulaşıyor, değer birebir taşınıyor
                        (§3.5 sondaları, #18 sonrası)
```

Statik kanıt kapsaması (6 makro):

```text
login              OK
select-route       OK
open-stop          OK
tour-approval      OK
process-parcel     2 eksik
complete-delivery  2 eksik
```

Faza başlarken bu tablo `login OK` + diğer beşi eksikti.

**Testler:** API 532 · pack 133 · executor 32 · contract 82 · compiler 39 ·
oracle-engine 16 · control-channels 39 · mobil `verdict-core` 430.

`verdict-core`'da 3 test kırmızı ve **üçü de temiz ağaçta da kırmızı** —
değişiklikler stash'lenip tekrar koşularak doğrulandı: `LogcatSinkCorpusTest` ×2,
`ResetEngineTest` ×1. Windows yol/satır sonu varsayımı kokuyor, ürün kusuru
değil. Task non-zero döndüğü için yeşil bir değişiklik de kırmızı görünür —
baseline budur, fazlası sizindir.

## 5. Kalan iş

### 5.1 SIRADAKİ — select-route'u cihazda tamamla (#17 + #18 ölçümü)

#18 transport'u açtı; **select-route'un kalan tek engeli #17'dir.** İki adım, bu
sırayla — çünkü ilki ikincinin girdisini üretiyor.

**Adım 1 — #18'in aşağı akış etkisini ölç (kısa, engelleyici değil).**
Önkoşul: VPN + API ayakta. API çalışıyorsa yeni `control-channels/dist`'i alması
için bir kez yeniden başlat (`touch apps/api/src/server.ts`).

```text
login koş → rota diyaloğunu aç  (NesyOfferedRoutesStore bellekte, diyalog doldurur)
nesy.offeredRoutes matchKey="31"  → 353 değil TEK satır beklenir
aynı sorgu matchKey="31 *"        → fiscal etiketiyle de tek satır
                                    (eskiden transport bu değeri hiç kabul etmiyordu)
```

Bu ölçüm §3.5'in bilinçli olarak açık bıraktığı halkadır. Adım 2 zaten aynı yolu
gerçek veriyle kullanacağı için ayrıca koşmak zorunlu değil — ama bir hata olursa
onu **transport'ta** mı **hedef zincirinde** mi olduğunu ayırt etmenin en ucuz
yolu budur.

**Adım 2 — #17 rota diyaloğu hedef zincirini gerçek arayüze göre yaz.**
Pack `route_row_*`, `route_list`, `route_dialog_confirm` bekliyor; cihazda
gerçekte `dialog_spinner` ve `yesButton` var — yani pack'in hedefleri kurgusal.
Kullanıcı kararı: **gerçek UI sürülecek** (uygulamanın `select_route` komutu
değil), ama indeksle hızlı:

```text
matchKey ile tek satır çek → route_index al
→ scroll_to_item (listId + rowIndex) ile doğrudan pozisyona git
→ öğeye bas → yesButton'a bas
```

Bridge `scroll_to_item`'ı zaten `listId` + `rowIndex` ile destekliyor. 253 rotada
bile tek atış, tarama yok. `route_index` artık gerçekten okunabiliyor — #18'den
önce o satırı tek başına çekmek imkânsızdı, `resolve-row` bu yüzden düşüyordu.

**Bitiş ölçütü:** `select-route` cihazda uçtan uca koşar ve `PASS_ONLINE` ya da
`FAIL_PRODUCT` üretir; `resolve-row` dahil hiçbir adım `INCONCLUSIVE` bırakmaz.

### 5.2 Sonra — cihazda hiç koşulmamış iş akışları

`open-stop` ve `tour-approval` **kanıt olarak tam** ama cihazda hiç koşulmadı;
önkoşul verisi gerekiyor (rota seçili / durak açık). select-route bitince bu
önkoşul kendiliğinden kurulabilir hâle geliyor — sıralama tesadüf değil.

`process-parcel` ve `complete-delivery` shipment istiyor:
`scripts/create-ready-rs-shipments.mjs`. Bu ikisinin ayrıca §5.3'teki kanıt
boşlukları da var.

### 5.3 Kalan kanıt boşlukları

| Fact | Eksik |
|---|---|
| `APP.PARCEL_STATE_PROCESSED` | `parcelState` boolean taşımıyor, durum karşılaştırması gerek |
| `LOCAL.PARCEL_RECORD_PERSISTED` | `nesy.db.parcel` eklendi, makro bağlamıyor |
| `APP.SESSION_ISOLATION_ASSERTED` | sorgu değil, operasyon |
| `LOCAL.OFFLINE_QUEUE_DRAINED` | kuyruk gözlemi bağlı değil |

## 6. Çalışma notları

- **Pack değişimi:** build → `seed:verdict-catalog` → API reload.
  **Sürüm yükseltmeden seed reddeder** (digest değişti).
- **Fixture'lar** in-code slice'tan üretilir; makro değişince yeniden üret.
- **Koşu başlatma idempotent** — her koşuda benzersiz `sessionCorrelationId` ver.
- **gradle çıktısını `| tail` ile borulama** — çıkış kodunu maskeliyor,
  `BUILD FAILED` olduğu halde 0 görünüyor.
- **APK:** `./gradlew :app:installTstrsDebug` (automationRelease değil).
- **`control-channels` değişimi:** `pnpm --filter @nesy/control-channels build` —
  API `dist/`'i tüketiyor, `src/`'i değil. Ayakta bir API'yi yeniden başlat.
- **`verdict-core` testleri:** temiz ağaçta 430'un 3'ü kırmızı
  (`LogcatSinkCorpusTest` ×2, `ResetEngineTest` ×1). Baseline bu; peşine düşme.
- **adb broadcast extra'ları skaler** — Map/Bundle gönderilemez. İç içe veri JSON
  string olarak gider ve **cihaz kabuğu için tırnaklanmalı**: `adb shell` argv'yi
  boşlukla birleştirip uzak `sh -c`'ye verir, yani orada yeniden ayrıştırılır.
  Tırnaklanmamış boşluklu değer sessizce ikiye bölünür.
- API tam suite'i yük altında `test-event-ws-server.integration`'da takılabiliyor
  (8765 portu); izole koşuda geçiyor — çakışma, gerçek hata değil.
- Backend (`NESY.WebAPI`) **salt okunur** (kullanıcı kararı). Bilinen iki kusur
  orada duruyor: `GetMyInfo` çift zarfı, `UserLoginLog` için okuma ucu yokluğu.

## 7. Fazın kapanma ölçütü

```text
her bağımsız iş akışı cihazda koşar ve PASS_ONLINE ya da FAIL_PRODUCT üretir
hiçbir REQUIRED fact üreticisiz değildir
EVIDENCE_INSUFFICIENT yalnız gerçekten gözlenemeyen durumda görülür
```
