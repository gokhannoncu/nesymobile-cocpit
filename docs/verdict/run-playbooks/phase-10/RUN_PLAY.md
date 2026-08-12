# Phase 10 RUN_PLAY — Workflow Evidence Completion (login → select-route → …)

```yaml
runPlayId: verdict-cockpit-phase-10-run-play
phase: "10"
phaseName: "Workflow Evidence Completion"
status: IN_PROGRESS
createdAt: "2026-08-12 05:20:00 +03"
startedAt: "2026-08-11 14:00:00 +03"
completedAt: null
lastUpdatedAt: "2026-08-12 20:35:00 +03"
timezone: "Europe/Istanbul"
previousPhaseResult: "docs/verdict/run-playbooks/phase-9/RESULT.md"
resultFile: "docs/verdict/run-playbooks/phase-10/RESULT.md"
phase10Target: "EVERY_WORKFLOW_DECIDABLE_ON_DEVICE"
domainPackVersion: "1.12.0"
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
| 17 | Rota diyaloğu hedef modeli | `DONE` |
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

### 3.6 #17 — rota diyaloğu gerçek arayüze bağlandı

Doküman bunu "hedefleri yeniden yaz" işi sanıyordu. Ölçüm dört bağımsız engel
gösterdi ve üçü **generic katmanın** eksiğiydi, bu uygulamanın özelliği değil.
Kullanıcı kararı: dördü de yapılsın, **pack en son** yazılsın — eksik host'a
karşı yazılan pack workaround kodlar.

**L1 — dinamik hedef kimliği (host).** Pack koşudan önce yazıldığı için kimliğin
NEREDEN geldiğini bildirebilir, hangi kaydın istendiğini bilemez.
`buildTargetFingerprint` yalnız literal okuyordu; pack `idPrefix`/`keyPath` (bir
kural) veriyordu → zincir sonuna kadar yürünüyor, hedef `undefined` dönüyor ve
`resolve-row` cihaza hiç sormadan, sebep bile söylemeden düşüyordu. Artık adımın
`entityBinding.id`'si (`run.input.` / `var.`) çözülüp fingerprint'e veriliyor; iki
kural da pack tarafından BİLDİRİLİYOR: `idPrefix + entityKey`, ve `ENTITY_BINDING`
için "entity key metnin kendisidir". Key'i olmayan halka **atlanıyor**, boş
dizgiye çevrilmiyor — `route_row_` her satırla eşleşir.

**L3 — id'siz koleksiyon (cihaz).** `scroll_to_item` `listId`'yi birebir
eşliyordu; Android'in Spinner popup'ı, AlertDialog listesi ve autocomplete'i kendi
layout'undan doğduğu için `viewIdResourceName` **null**. Artık `listId` **ya da**
`listClass` — birebir `className` **ve** `collectionInfo != null`. İkinci koşul
taşıyıcı: sınıf adı tek başına aynı sınıftan sıradan bir container'ı da adlar ve
onu kaydırmak, başarı diye okunan bir no-op olur. İki eşleşme `ambiguous` ile
düşüyor, tıpkı iki id gibi. İki form birlikte gönderilirse `multiple_list_forms`.

**L3b — aynı ağacın iki farklı anlık görüntüsü.** İlk cihaz koşusunda `dump`
listeyi görüyor, `scroll_to_item` görmüyordu. Sebep: aksiyon yolu `toActionSnapshot`
kullanıyor ve orada `className` **null**, `collectionInfo` **hiç doldurulmuyordu**.
Yani protokolün planlayabildiği bir seçiciyi executor planlayamıyordu. Planlayıcının
okuduğu alan, o planlayıcıya verilen HER anlık görüntüde bulunmalı — hafif bir
görüntü, farklı bir ağaçtır.

**L4 — scroll yolu (host).** `scroll_to_item` `BRIDGE_COMMANDS`'ta ilan edilmişti
ama hiçbir host yolu çağıramıyordu (`act()` dört komut kabul ediyor). Artık
`manager.scrollToItem()` var ve `BRIDGE_ACTION action: "scrollToItem"` dalı
`back`/`swipe` gibi hedef aramadan önce duruyor — **konumlandırır, kimlik
kurmaz**. `rowIndex` `resolveArgValue`'dan geçiyor, yani sorgu sonucundan
(`var.…`) gelebiliyor: hangi satırda olduğu BU koşunun olgusu.

`var.` referansları artık nokta yolu izliyor ve bunu **condition dilinin aynı
`dig()` fonksiyonuyla** yapıyor — "yol satır kümesi üzerinde ne demek" sorusunun
iki kopyası kaçınılmaz olarak ayrışırdı. Skaler bir argüman TEK değer ister: sütun
çekimi diziyse ve birden fazla eleman varsa `undefined` döner, `[0]` alınmaz —
hangi kaydın istendiği hakkında tahmin, bu kod tabanının başka her yerde
reddettiği yanlış-satır hatasıdır.

**Bekleme, uyku değil.** Popup, tap döndükten sonra platformun bağladığı bir
pencere: aynı nefeste atılan scroll `not_found` diyor, bir saniye sonrası
başarılı. Host yalnız `not_found`'u yeniden deniyor — o ret planlama sırasında
verildiği için cihaz hiçbir şeye dokunmamıştır, `stale_tree`'yi tekrarlanabilir
yapan özelliğin aynısı. Bütçe adımın kendi `timeoutMs`'i, yani pack'te bildirilen
bir ifade; host'ta gömülü bir sabit değil.

**L2 — pack (1.6.1).** Ölçülen arayüz: `dialog_spinner` (Spinner), popup
`ListView` (id yok), satırlar `android:id/text1` paylaşıyor, onay `yesButton`.
Zincir: `matchKey` ile tek satır çek → spinner'ı çöz ve bas → `route_index` ile
listeyi konumlandır → satırı **etiketiyle** çöz (`route_label`: fiscal rotada
`31 *`, `routeCode` ise `31`) → bas → `yesButton`'a bas.

### 3.7 #19 — select-route'un iş alanı: schedule (kullanıcı kararı)

**Doğru soru "backend atadı mı" değil.** Rota seçilince bir schedule yaratılır ve
mobilde Room'a yazılır. Yaratılamadığında `StopListFragment` şunu yapıyor:

```kotlin
Resource.Status.ERROR -> {
    if (viewModel.isScheduleNotNull()) loadStopListFromLocal()  // ← DÜNDEN kalma da olabilir
    else logout
}
```

Ekran tamamen normal görünür, kurye bayat bir planla çalışır ve koşu bunu hiç
söylemez — çünkü "ekranda bir plan var" ile "bugünün planı yaratıldı" aynı şeye
sayılıyordu. Kullanıcı kararı: **remote doğrulama bu dilimden çıkar**, doğrulama
uygulamada yapılır.

**Yeni named query `nesy.db.schedule`** (LOCAL düzlem, Room gerçeği). Ölçülen
alanlar cihazda doğrulandı:

```text
schedule_id       = 11-31-20260812-1     → rota 31, tarih bugün
schedule_is_today = true                 (ürünün KENDİ ScheduleSessionValidator'ı)
id_date_is_today  = true                 (ikinci bağımsız okuma: id'nin tarih segmenti)
persisted_at      = 12-08-2026-15:45:38  persisted_today = true
stop_chunk_count  = 0                    schedule_body_stored = false
courier_matches_session = true
```

Tarih kuralı **kopyalanmadı**: ekranların danıştığı validator'ın kendisi okunuyor.
Kopya yazılsa, ürün kuralı değiştiğinde gözlem kendi kopyasıyla hemfikir kalırdı.
İki "bugün" okuması ayrı raporlanıyor ki aralarındaki bir çelişki görünür olsun.

**`schedule_persisted` durak sayısına BAĞLANMADI.** İlk tasarımda `chunk > 0`
şartı vardı; o, durağı olmayan bir rotayı ürün kusuru sayardı. Boş gün bir kusur
değil. Sayı yine raporlanıyor (`schedule_body_stored`, `stop_chunk_count`), yani
"yazma yarım kaldı" ile "bugün iş yok" hâlâ ayırt edilebilir.

**Oracle (pack 1.7.3):** `REMOTE.ROUTE_ASSIGNED` çıktı. Yerine
`LOCAL.SCHEDULE_PERSISTED`, `LOCAL.SCHEDULE_IS_TODAY`, türetilmiş
`APP.SCHEDULE_IN_USE_IS_TODAYS` (üçü **schedule id üzerinde** uyuşmalı) ve
`APP.SCHEDULE_MATCHES_SELECTED_ROUTE` girdi.

**İŞ KURALI DÜZELTMESİ (kullanıcı):** rota seçimi schedule'ı **BOŞ** yaratır;
kurye aracına load yapar ve schedule kendini yüklenenden doldurur. Dolayısıyla
seçim sonrası durak beklemek ürünün tasarımını FAIL etmek olur.
`APP.AVAILABLE_STOPS_LOADED` bu dilimde gereksinim değil — gözlem olarak kaldı,
çünkü sayı load akışının tabanı ("seçimde 0, yüklemeden sonra N"). Fact ait olduğu
yerde hâlâ REQUIRED: bir durak açıldıktan sonra durakların var olması gerekir.

**Cihazda ölçüldü** (14/14 adım SUCCEEDED, oracle SATISFIED, **`PASS_ONLINE`**):

```text
LOCAL.SCHEDULE_IS_TODAY              SATISFIED   bugünün planı
LOCAL.SCHEDULE_PERSISTED             SATISFIED   saklandı
APP.SELECTED_ROUTE_OBSERVED          SATISFIED
APP.SCHEDULE_IN_USE_IS_TODAYS        SATISFIED   ekrandaki = saklanan = bugünün (id'ler uyuştu)
APP.SCHEDULE_MATCHES_SELECTED_ROUTE  SATISFIED   schedule rota 31 için yaratılmış
REMOTE.ROUTES_AVAILABLE              WARNING_TIMEOUT (yalnız teşhis, karar vermez)
```

### 3.8 #20 — zimmet alma (`LOAD_TO_VEHICLE`), yedinci dilim

Rota seçimi schedule'ı boş yaratıyor; **işi içine koyan adım bu.** Kullanıcı
kararı: önce cihazda ÖLÇ, sonra pack'i yaz. #17'de tersi yapılmış ve üç engelle
karşılaşılmıştı.

**Zimmet cihazda tek akış değil — üç ayrı yol var:**

| Yol | Tetikleyici | Uç |
|---|---|---|
| **A. FORCE_LOAD** | Barkod schedule'da **yok** | `GetShipmentCreateInstantTaskServiceData` → `CreateInstantTask` |
| B. LOAD | Barkod schedule'da var, Loaded değil | offline kuyruk → `LoadParcelToCourierVehicle` |
| C. VehicleLoading | Menü → el terminali | `InsertCargoTransaction` (TTI + torba/kargo) |

Boş schedule'da `getTransaction` eşleşme bulamaz ve `FORCE_LOAD` döner — yani
**bizim durumumuzda daima A yolu**, ve asıl akış `StopListFragment` değil
`ScanProcessor`.

**Ölçülen arayüz** (hepsi bridge dump'ından, layout'tan değil):

```text
StopList     app:manuel_input · app:camera · app:tv_total_picked_up_count
             app:tv_remaining_count · app:rv (COLL) · app:btn_out "Request Tour Start"
Giriş        app:title "Write barcode number" · app:et_input_dialog_barcode_number
             app:btn_ok            ← OK'ında doğrulama YOK, hepsi yorumlanmış
Hata         app:tv_arasDg_title · app:tv_arasDg_message · app:btn_arasDg_positive_button
RS seçici    app:dialogTitle "Select Time Range" · NumberPicker · app:btnSave "Select"
```

**Ölçülen olay akışı** — geçersiz barkod ve mutlu yol:

```text
PARCEL_SCANNED        SCAN_PARCEL       SUCCESS   taskId=<barkod>
VEHICLE_LOADING_STEP  LOAD_TO_VEHICLE   ERROR     step=FETCH_SHIPMENT
DIALOG_SHOWN          LOAD_TO_VEHICLE   dialog=GENERIC_ERROR
                      message="9999999999999999 barcode not found."
— mutlu yol —
VEHICLE_LOADING_STEP  SUCCESS  step=FETCH_SHIPMENT
DIALOG_SHOWN          dialogType=SingleChoicePickerDialogFragment
                      fragmentTag=TimeSlotSelectionPickerFragment   ← RS
VEHICLE_LOADING_STEP  SUCCESS  step=CREATE_TASK
VEHICLE_LOADING_STEP  SUCCESS  step=FETCH_SCHEDULE
```

Sonrasında: `Loaded Parcels` 0→1, bir durak, `stop_chunk_count` 0→1,
`nesy.parcelState{barcode}` → `item_status=4` (Loaded).

**Backend kuralları** (`ShipmentOperation.GetShipmentCreateInstantTaskServiceData`,
sırayla): alıcı adı/adresi boş → red · barkod yok → red · `Returned` →
`-HASRETURN` · `Delivered` → `-DELY` + ALRT olayı · **başka şube → UYARI**
(devam edilebilir) · `Weight==0` + INIT yok → `-UNLOAD`/`-PICKUP` · RDOC + ENTY yok
+ `IsRdocUnloadRequiredOnAssignment` → `-ENTY` · Direct4Me pickup → `-PICKUP` ·
tek parça + rol courier + son olay DELY/DELR/LOST/STOR → red. Geçerse backend
**yazmaz**, `CreateInstantTaskRequest`'i mobile geri verir. `CreateInstantTask`
ise `AddParcelsToSchedule` ile `Loaded/OnDeliveryCourier` yazar,
`InsertUniqueScheduleBarcodeKey` idempotency çiti kurar, durakları
`(lat, lon, timeWindow, counterLocationId)` ile gruplar ve `AutoApproveOnTour`
çağırır. **Lat/Lon null ise parça sessizce atlanır.**

**Üç tuzak, pack'te kayıtlı:**

1. **Dilim bugün RS-only** ve bunu söylüyor. RS saat aralığı seçicisi
   `TREAT_AS_ABSENT` ile ülke-nötr modellenmek istendi; **host `notFoundPolicy`'yi
   hiç okumuyor** (§5.0). Politika `FAIL` bırakıldı — çalışmayan bir politikayla
   nötrlük iddia eden yorum, yalan söyleyen yorumdur.
2. **Adım teli kanıt olarak bağlanmadı.** `VEHICLE_LOADING_STEP` tek tel adında üç
   anlam taşıyor ve boolean alanı yok; host sözlüğü tel adı → tek fact eşliyor ve
   `valueField`'ı her emit'te şart koşuyor, kare reddi de **bloke edici**. Dilim
   bu yüzden ölçülmüş **sorgu düzlemlerinden** karar veriyor.
3. **Durum karşılaştırması yapılmadı.** `item_status` sayıyı dizgide taşıyor
   (`"4"`); host fact değerini yalnız `"true"/"false"`'dan okur. `ROWS_PRESENT` ile
   "bu parça schedule'da mı" soruldu — sorgu barkodla daraltıldığı için cevap **o
   parça** hakkında. `== Loaded` iddiası app tarafında boolean kolon gerektirir.

**Cihazda `PASS_ONLINE`** (13/13 adım, oracle SATISFIED):

```text
LOCAL.PARCEL_IN_SCHEDULE     SATISFIED
LOCAL.SCHEDULE_BODY_STORED   SATISFIED
APP.AVAILABLE_STOPS_LOADED   SATISFIED   ← burada REQUIRED, select-route'ta değil
```

`AVAILABLE_STOPS_LOADED` ayrımı bilinçli: seçimde schedule boş doğar (§5.0), ama
zimmet tam olarak durağı yaratan şeydir.

### 3.9 Sırbistan fiscal kuralı

`31 *` içindeki yıldız **rota kodunun parçası değil** — fiscal zorunluluğunu
gösteren, Sırbistan'a özel bir iş kuralı. Diğer ülkelerde aynı rota `31`.

Ayrıştırma cihazda yapılıyor (görünen metni ve ülke bilgisini o taşıyor) ve
projeksiyon üçünü ayrı bildiriyor: `route_code` (kimlik), `route_label`
(görünen), `fiscal_required` (kural). Her fiscal rota iki adreslenebilir adla
satır üretiyor, ikisi de aynı `route_code`'da anlaşıyor — böylece workflow UI'dan
`31` de `31 *` de yazılabiliyor.

**Ölçüldü:** 253 rota → 353 satır, 200 satır fiscal (100 fiscal + 153 düz rota).

### 3.10 Yan bulgu — erişilebilirlik onarımı

`restoreAccessibilityService` dört ayrı adb çağrısıydı ve `accessibility_enabled=0`
ile başlıyordu. Kesinti (API restart) **cihazın genel erişilebilirlik anahtarını
kapalı bırakıyordu**. Bu bir test hatası değil, birinin telefonunda erişilebilirliği
sessizce kapatmaktır. Ana anahtar artık hiç 0'a yazılmıyor.

## 4. Cihazda doğrulanan durum

```text
login   doğru PIN    → PASS_ONLINE    9 adım    (9 ardışık koşu, 0 stale_run)
login   yanlış PIN   → FAIL_PRODUCT   9 adım
select-route  route 31 → PASS_ONLINE    14/14 adım SUCCEEDED, oracle SATISFIED
                        SELECTED_ROUTE_OBSERVED · SCHEDULE_PERSISTED · SCHEDULE_IS_TODAY
                        SCHEDULE_IN_USE_IS_TODAYS · SCHEDULE_MATCHES_SELECTED_ROUTE → hepsi SATISFIED
                        ROUTES_AVAILABLE WARNING_TIMEOUT (yalnız teşhis, karar vermez)
                        AVAILABLE_STOPS_LOADED artık gereksinim DEĞİL: seçimde schedule boş doğar
load-to-vehicle       → PASS_ONLINE    13/13 adım SUCCEEDED, oracle SATISFIED
                        PARCEL_IN_SCHEDULE · SCHEDULE_BODY_STORED
                        AVAILABLE_STOPS_LOADED → hepsi SATISFIED
                        RS saat aralığı seçicisi çözüldü ve onaylandı
sql_named params      → argümanlar handler'a ulaşıyor, değer birebir taşınıyor
                        (§3.5 sondaları, #18 sonrası)
offeredRoutes         → parametresiz 353 satır, matchKey="31" TEK satır
                        (index 29), matchKey="31 *" aynı satır, "999" boş
```

Statik kanıt kapsaması (7 makro):

```text
login              OK
select-route       OK
load-to-vehicle    OK
open-stop          OK
tour-approval      OK
process-parcel     2 eksik
complete-delivery  2 eksik
```

Faza başlarken bu tablo `login OK` + diğer beşi eksikti.

**Testler:** API bridgeflow+derived 82 · pack 134 · executor 32 · compiler 39 ·
oracle-engine 16 · control-channels 39 · mobil `verdict-core` 430 ·
`verdict-bridge` 63.

`verdict-core`'da 3 test kırmızı ve **üçü de temiz ağaçta da kırmızı** —
değişiklikler stash'lenip tekrar koşularak doğrulandı: `LogcatSinkCorpusTest` ×2,
`ResetEngineTest` ×1. Windows yol/satır sonu varsayımı kokuyor, ürün kusuru
değil. Task non-zero döndüğü için yeşil bir değişiklik de kırmızı görünür —
baseline budur, fazlası sizindir.

## 5. Kalan iş

### 5.0 SIRADAKİ — `open-stop` ve `tour-approval` cihazda hiç koşulmadı

Önkoşulları artık **kurulabilir** ve türetilmiş fact'leri artık **akıyor**:

```text
login → select-route → load-to-vehicle    üçü de cihazda PASS_ONLINE
```

Zimmet durağı yaratıyor, yani `open-stop`'un açacağı şey artık var. Her ikisi de
`APP.ACTIVE_STOP_MATCHES` / `REMOTE.TOUR_APPROVAL_CONFIRMED` gibi türetilmiş
fact'lere dayanıyor — bunlar §5.0c'ye kadar hiçbir oracle'a ulaşmıyordu, o
düzeltme önlerini açtı ama **hiçbiri henüz ölçülmedi**.

Sıra: `reset_state → login → select-route → load-to-vehicle → open-stop`.

### 5.0d Tur onayı uçtan uca ÖLÇÜLDÜ — makro yanlış akışı test ediyormuş

2026-08-12 akşamı, cihazda ve RS staging'de, `tour-approval-lifecycle`'ın
tamamı elle koşuldu. Makro çalıştırılmadı; her adım tek tek ölçüldü, çünkü
makronun kendisinin doğru akışı tarif ettiği varsayımı test edilecek şeydi.
Etmiyormuş.

**Ölçülen gerçek akış** (schedule `11-31-20260812-1`, rota 31):

```text
btn_out tap  →  rota optimizasyon diyaloğu (auto_route | manual_route)
             →  POST Task/RequestLeavingPermission {calculateRoute, scheduleId}
             →  schedule.ScheduleStatus = WaitingForApproval(1)
             →  NESY_TEST_EVENT TOUR_STARTED
GetWaitingLeavingRequests  →  kayıt bulundu (scheduleId + scheduleStatus)
ApproveLeavingPermission   →  200, ScheduleStatus = Approved(2)
             →  +6.3 sn: FCM push, TOUR_APPROVAL_PUSH decision=APPROVED
             →  +28 sn : Task/GetMyScheduleByZoneCode — ama push yüzünden DEĞİL
```

**Bulgu 1 — pack yanlış kuyruğu hedefliyor.** `Task/RequestLeavingPermission`
`MobileApprovalRequests` koleksiyonuna **hiç dokunmuyor**; yaptığı tek şey
`scheduleDocument.ScheduleStatus = WaitingForApproval` (TaskOperation.cs:2198).
`MobileApprovalRequests` ayrı bir mekanizma: `SendMobileApprovalRequests` ile
yazılıyor, `UniqueIdentifier`'ı istemci üretiyor, genel amaçlı "bu mobil isteği
amir onaylasın" kuyruğu. Tur onayıyla ilgisi yok.

Yani `nesy-backoffice-endpoints.ts`'teki üç tur-onayı operasyonunun üçü de yanlış
hedefte. `SOURCE_VERIFIED` etiketleri **dürüst** — o endpoint'ler gerçekten öyle
çalışıyor — ama doğrulanan şey yanlış akıştı. **Kaynağı okumak, doğru kaynağı
okuduğunu garanti etmiyor.** Bu, §2'deki desenin yeni bir yüzü: orada pack
bildiriyor host okumuyordu; burada host doğru okuyor ama yanlış yeri.

Doğrusu:

| Rol | Gerçek yol | Anahtar |
|---|---|---|
| istek | `Task/RequestLeavingPermission` | `scheduleId` |
| bulma + statü | `Task/GetWaitingLeavingRequests` | `scheduleId` |
| onay | `Task/ApproveLeavingPermission` (`{ScheduleIds, EventLocation, CourierUserNames}`) | `scheduleId` |

`ApproveLeavingPermission` idempotent: `WaitingForApproval` şartlı update yapıyor
ve `ModifiedCount > 0` değilse atlıyor (TaskOperation.cs:2325). Çifte onay zaten
imkânsız — makronun `KEYED` + `RECONCILE_BEFORE_RELEASE` kurgusu bu akış için
gereğinden ağır ama zararsız.

**Bulgu 2 — `approvalRequestCode` üretilmiyor.** İstek yanıtı düz bir string
("Leaving permission request saved"); hiçbir kimlik dönmüyor. Makronun zorunlu
`approvalRequestCode` girdisi **doldurulamaz bir alan** — tap'ten önce
bilinemez, tap'ten sonra da verilmiyor. Korelasyon çapası `scheduleId` olmalı;
onu `select-route` zaten üretiyor ve cihaz istekte kendisi gönderiyor.

**Bulgu 3 — push schedule'ı tazelemiyor.** Push ile fetch arasında 28 saniye ve
**sıfır** schedule çağrısı var (HTTP logunda yalnız 10 sn'lik `Task/Info` sağlık
atışları). Fetch'i tetikleyen, bildirim ekranından çıkış oldu — fragment resume.
FCM handler yalnız bildirimi kaydedip yerel yayın yapıyor; alıcı
(`MainActivity.kt:275`) bildirim listesini açıyor, schedule'a dokunmuyor.

Dilim açısından: "bildirim → fetch → APPROVED" nedensel zinciri **kurulamaz**;
tazelemeyi tetikleyen açık bir adım modellenmeli. Ürün açısından: durak
listesinde bekleyen kurye, ekranla etkileşime girmedikçe onayı görmüyor. 28 sn
ölçüldü; daha uzun periyotlu bir tazeleme var mı — **ölçülmedi**, alt sınır bu.

**Bulgu 4 — statü UI'dan okunamaz.** `btn_out`'un etiketi schedule statüsünün
fonksiyonu, ama `Approved(2)` ve `EndOfDay(3)` **aynı** metni taşıyor ("End Of
Tour"); tek ayırt edici `enabled`. O da güvenilmez: tıklama handler'ı her
tap'ten 1 sn sonra `isEnabled = true` yazıyor (StopListFragment.kt:1961-1963) ve
ölçümde `WaitingForApproval` statüsünde bile `enabled: true` görüldü. Sayısal
statüyü taşıyan ayrı bir Verdict olayı **şart**; UI okuması ancak teyit kanalı
olabilir.

**Bulgu 5 — iki küçük delik.** `TOUR_APPROVAL_PUSH` 23 ms arayla **iki kez**
yayınlanıyor (`handleIntent` ve `onMessageReceived` ikisi de çağırıyor). Ve hem
`TOUR_STARTED` hem push olayları `occurrenceId: run_…:tap-acknowledge:0`
taşıyor — bir önceki `load-to-vehicle` koşusundan kalma. `requireOccurrenceMatch:
true` ile bu, korelasyonu sessizce düşürür.

**Yapıldı:** `targets.ts` düzeltildi (aşağıda). **Yapılmadı:** adapter
operasyonları hâlâ yanlış kuyrukta, makro hâlâ `endOfDay` bekliyor,
`approvalRequestCode` hâlâ zorunlu girdi, cihaz-düzlemi statü fact'i hâlâ yok.

### 5.0e `targets.ts` düzeltildi — hedef ne var olmuş ne doğru ekrandaydı

`tour_approval_request_button` uygulamanın **hiçbir yerinde** geçmiyordu ve
`endOfDay` ekranında aranıyordu. Gerçeği: `btn_out`, **stop list** ekranında
(`fragment_stops.xml:121`). `route_row_*` ile birebir aynı hastalık — hedef
cihazdan ölçülerek değil, isimden türetilerek yazılmış.

Düzeltildi: `tourApprovalRequestButton` → `ACCESSIBILITY_ID: btn_out`,
`screenRef: routeStopList`. Zincir tek halka, bilerek: `btn_out`'un kendi metni
yok (etiket tıklanamayan `text1` çocuğunda, o da ekranda dört kez tekrarlıyor) ve
metin zaten statüyle değişiyor.

Eklendi: `tourRoutingAuto` (`auto_route`) ve `tourRoutingManual`
(`manual_route`). Tur isteği **tek tap değil** — arada rota optimizasyon
diyaloğu var ve backend çağrısını ancak buradaki seçim yapıyor.

Bilinçli boşluk: bu diyalog kendi başına bir **surface**, ama `NESY_SURFACES`'a
eklemek interrupt policy ve kendi policy testini gerektiriyor. Şimdilik ikisi de
stop list ekranına asıldı ve durum `targets.ts` yorumunda kayıtlı — kaçak
girmesin diye.

Pack testleri 134/134 yeşil (target sayısı 16 → 18, referans dokümanı §2 tablosu
da güncellendi; o tabloda başka bayat sayılar da vardı, onlar da düzeltildi).

### 5.0a Kapatıldı — iki host boşluğu: opsiyonel etkileşim modellenebiliyor (#20)

**İkisi de kapatıldı ve cihazda doğrulandı** (`tap-acknowledge action=SKIPPED`,
koşu `PASS_ONLINE`). Aşağıdaki teşhis, neyin neden değiştiğinin kaydı.

**Düzeltme (a):** `RESOLVE_TARGET` artık hedefin `notFoundPolicy`'sini okuyor.
`NOT_FOUND` + `TREAT_AS_ABSENT` → adım geçer ve değişkene açık bir işaretçi
yazılır (`{ absentTarget: true, targetRef }`) — boş değişken DEĞİL, çünkü "pack
burada olmayabilir diyor" ile "resolve hiç koşmadı" birbirine benzememeli. Yalnız
`NOT_FOUND` tolere edilir; `AMBIGUOUS`/`STALE_TREE` hâlâ hata ("ayırt edemedim",
"orada değil"in tersidir).

**Düzeltme (b):** `BridgeActionTerminalState`'e `SKIPPED` eklendi; executor'da
ayrı dal — automation failure değil, success de değil, `effectVerified` okunmaz.
Prisma'da `actionResult` düz `String`, migration gerekmedi.

**Testler:** absent hedef cihaza ulaşırsa fake manager throw ediyor; boş değişken
hâlâ FAILED; `AMBIGUOUS` tolere edilmiyor.

### 5.0b Kapatıldı — durak zorunluluğu iş kuralına aykırıydı

Kullanıcı düzeltmesi: **rota seçimi schedule'ı BOŞ yaratır.** Kurye sonra aracına
load yapar ve schedule kendini yüklenenden doldurur. Yani seçim sonrası durak
beklemek, ürünün tasarlanmış davranışını `FAIL_PRODUCT` yapıyordu — ölçüldü: rota
31'in schedule'ı bugüne ait, saklanmış, kullanımda ve doğru rotaya aitti, koşu
yine sıfır durak yüzünden düşüyordu.

`APP.AVAILABLE_STOPS_LOADED` bu dilimin gereksinimi olmaktan çıktı; **gözlem
olarak kaldı**, çünkü sayı load akışının karşılaştırılacağı taban: "seçimde 0,
yüklemeden sonra N". Fact hâlâ ait olduğu yerde REQUIRED — bir durak açıldıktan
sonra durakların var olması gerekir.

`select-route` bundan sonra cihazda **`PASS_ONLINE`** üretiyor (§4).

### 5.0c Kapatıldı — iki türetilmiş fact artık ateşliyor (#19)

İkisi de `REQUIRED_TIMEOUT` veriyordu. İki ayrı sebep çıktı; **biri tahmin
ettiğim yer değildi ve daha büyüktü.**

**(b) `ENTITY_STATUS_EQUALS` `comparePath`'i KULLANMIYOR.**
`derived-fact-engine.ts` gözlemin `correlationValue`'sunu alıp
`expectations[against]` ile karşılaştırıyor; `comparePath` hiçbir yerde okunmuyor.
Benim tanımım korelasyon değeri olarak schedule **id**'sini taşıyordu
(`11-31-20260812-1`), rota kodunu değil. Düzeltme: `nesy.db.schedule`'a
`correlationColumn: "schedule_route_code"` ile ikinci bir fact
(`LOCAL.SCHEDULE_ROUTE_OBSERVED`) bağlandı ve türetim onun üzerine kuruldu. Bir
fact TEK korelasyon değeri taşır; aynı satır hakkındaki iki farklı soru iki fact
gerektirir.

**(a) TÜRETİLMİŞ FACT'LER HİÇ YAYINLANMIYORDU.** İlk hipotezim (`observationRef`
çakışması) yanlıştı — `publishSdkObservations` kaynak eşlemesi yapmıyor, her
gözlemi factKey ile yayınlıyor. İkinci hipotezim (30 sn tazelik penceresi) de
yanlıştı: gözlemleri assert'in hemen öncesine taşımak hiçbir şeyi değiştirmedi.

Gerçek sebep: `deriveFacts` yalnız `bridgeflow-execution-queue`'nun
`factsForOccurrence` dönüş değerinde kullanılıyordu. **Oracle worker kendi fact
kümesini `runtime.currentFacts` ile kuruyor ve türetim motorunu hiç çağırmıyor.**
Yani türetilmiş her fact condition resolver'a görünüyor, hiçbir oracle'a
görünmüyordu — ve türetilmiş HER gereksinim, koşu o sonuca varmış olsa bile zaman
aşımına uğruyordu. Bu yalnız schedule'ı değil, `APP.ACTIVE_STOP_MATCHES` (yanlış
satır koruması) ve `REMOTE.TOUR_APPROVAL_CONFIRMED` dahil tüm türetimleri
etkiliyordu; open-stop ve tour-approval cihazda hiç koşulmadığı için kimse
görmemişti.

Düzeltme: `publishDerivedFacts` — türetilmiş fact'ler kanıt runtime'ına **iki
hatta da** yayınlanıyor (`ORDERED_REQUIRED` + `RECEIPT_SAFE`), `reducerTrace`
ile birlikte. İki hat, çünkü kapılar `RECEIPT_SAFE` okuyor ve yanlış-satır
koruması tam olarak bir KAPININ görmesi gereken türetilmiş fact.

**Cihazda ölçüldü — ikisi de SATISFIED:**

```text
LOCAL.SCHEDULE_IS_TODAY              SATISFIED   bugünün planı
LOCAL.SCHEDULE_PERSISTED             SATISFIED   saklandı
APP.SELECTED_ROUTE_OBSERVED          SATISFIED
APP.SCHEDULE_IN_USE_IS_TODAYS        SATISFIED   ekrandaki = saklanan = bugünün (id'ler uyuştu)
APP.SCHEDULE_MATCHES_SELECTED_ROUTE  SATISFIED   schedule rota 31 için yaratılmış
APP.AVAILABLE_STOPS_LOADED           VIOLATED    tek kalan: durak yok → §5.0
```

> Kapsama boşluğu, bilinçli: `publishDerivedFacts` modül-özel ve yalnız cihaz
> koşusuyla doğrulandı. Tanımların doğruluğu `derived-schedule-facts.test.ts`
> ile sabitlendi (yanlış schedule id → false, yanlış rota → false, eksik girdi →
> sessiz), ama "türetilmiş fact oracle'a ULAŞIR" invaryantı için kuyruk seviyesinde
> bir test yok. Bu delik bir kez daha açılırsa yine sessizce açılır.

### 5.0f Tur onayı 1.12.0 ile cihazda koştu — yedi adım geçti, oracle görmedi

Pack **1.12.0**: hedefler, makro ve adapter operasyonları §5.0d'deki ölçüme göre
yeniden yazıldı. Katalog seed'lendi
(`sha256:09a4dce8…`), cihazda koşuldu.

**Cihazda kanıtlanan** (`run_309118ae`):

```text
resolve-request-button  SUCCEEDED   btn_out çözüldü
tap-request             SUCCEEDED   rota diyaloğu açıldı
resolve-routing-choice  SUCCEEDED   auto_route RESOLVED_UNIQUE
tap-routing-choice      SUCCEEDED   gate SATISFIED — istek gitti
verify-request-record   SUCCEEDED   GetWaitingLeavingRequests
dispatcher-approves     SUCCEEDED   ApproveLeavingPermission
verify-approved-status  SUCCEEDED   statü okundu
await-push              SKIPPED     onTimeout CONTINUE (aşağıya bakın)
assert-approved         çalıştı     → INCONCLUSIVE
```

Yani §5.0d'de elle ölçülen akışın tamamı artık **makroyla** koşuyor. Yeni
hedefler ve yeni endpoint'ler doğru: hiçbir adım hedef bulamamaktan ya da yanlış
kuyruktan düşmedi.

**Kapatılan host boşluğu — `onTimeout` okunmuyordu.** İlk koşuda `await-push`
`FAILED` verip koşuyu durdurdu, oysa adım `onTimeout: CONTINUE` bildiriyor.
Executor bekleme adımının deadline'ını okuyup **politikasını okumuyordu**; üstelik
iki ayrı zaman aşımı dalı var ve fact beklemelerinin geçtiği dal (`WAIT_EVENT`,
`index.ts:1181`) ilk düzeltmede atlanmıştı — yalnız köprü dalını düzeltmek hiçbir
şeyi düzeltmiyor. Artık `CONTINUE` → `SKIPPED` (her iki eksende), `next` izlenir.
`SUCCEEDED` değil: hiçbir şey gözlenmedi, etki iddia edilemez — `TREAT_AS_ABSENT`
hedeflerdeki ayrımın aynısı. İki executor testi eklendi (biri WAIT_EVENT dalı
için, ki asıl taşıyan o).

Bu, aynı sınıfın **altıncı** örneği: pack bildiriyor, host okumuyor.

**AÇIK — beş fact'in hiçbiri final oracle'a ulaşmıyor.** Üreten adımların
**dokuzu da** başarılı, buna rağmen:

```text
APP.TOUR_APPROVAL_REQUESTED           REQUIRED_TIMEOUT
REMOTE.TOUR_APPROVAL_REQUEST_CREATED  REQUIRED_TIMEOUT
REMOTE.TOUR_APPROVAL_STATUS_APPROVED  REQUIRED_TIMEOUT
REMOTE.TOUR_APPROVAL_CONFIRMED        REQUIRED_TIMEOUT
APP.TOUR_APPROVAL_PUSH_RECEIVED       WARNING_TIMEOUT
```

`APP.TOUR_APPROVAL_REQUESTED` aynı koşuda `tap-routing-choice`'un continue
gate'ini SATISFIED yaptı — yani fact gözlendi, sonra kayboldu. Sorun üretimde
değil, **occurrence'lar arası görünürlükte**.

**İki hipotez kuruldu, ikisi de gerçek kusur çıktı, ikisi de düzeltildi — ve
hiçbiri bu belirtiyi çözmedi.** Üçü de cihazda ölçüldü; sıradaki oturum bunları
yeniden denemesin.

*Hipotez 1 — tazelik.* Adım zamanlamaları ölçüldü: istek olayı 17:27:22'de geldi
ve continue gate'i doyurdu; opsiyonel push beklemesi 120 sn'lik bütçesinin
tamamını yaktı; `assert-approved` 17:29:41'de sordu. Olay o an **139 sn** yaşındaydı,
APP tazelik penceresi ise 15 sn. İki backend okuması da (30 sn pencere) bayattı.
Sebep buymuş gibi duruyordu.

Ve `currentFacts` gerçekten de tazeliği **her okumada** yeniden uyguluyordu: koşunun
kabul ettiği, koreleettiği, üzerine iş yaptığı bir fact, dünyada hiçbir şey
değişmeden, yalnız okuyucu geç kaldığı için kendi occurrence'ından siliniyordu.
Düzeltildi: **tazelik girişi denetler, ikameti değil** — "teklif edildiğinde zaten
eski miydi" sorusunun tek cevabı var ve bir kez, kabul anında sorulur. Üç yeni
test. Belirti değişmedi.

*Hipotez 2 — asimetrik yenileme.* Oracle worker'ın `refreshFacts` kancası yalnız
canlı ekran hazırlığını yayınlıyordu; executor'ın `factsForOccurrence` portu ise
ayrıca SDK/remote gözlemlerini yeniden yayınlayıp türetilmiş fact'leri
hesaplıyordu. Oracle bir EVENTUAL deadline boyunca kendi döngüsünde okuduğu için,
koşunun çoğunda **dar pencereden bakan taraf asıl karar veren taraftı**. Düzeltildi:
tek bir `refreshOccurrenceEvidence` her ikisini de besliyor, bir daha ayrışamazlar.
Belirti değişmedi.

*Elenenler:* fact üretimi (adımlar başarılı, gate doyuyor), tazelik penceresi,
iki yenileme yolunun asimetrisi.

*Sonra ölçüldü ve üçüncü hipotez de yanlış çıktı.* Trace (`VERDICT_FACT_TRACE`
ortam değişkeni, `refreshOccurrenceEvidence` içinde) her occurrence'ın gerçekte
ne gördüğünü yazdırdı. iterationKey her yerde `root`; uyuşmazlık yok.

**Trace fact DEĞERLERİNİ de yazdırınca gerçek sebep göründü:**

```text
REMOTE.TOUR_APPROVAL_REQUEST_CREATED = false
REMOTE.TOUR_APPROVAL_STATUS_APPROVED = false
```

Fact'ler eksik değildi. **Oradaydılar ve "hayır" diyorlardı.** Bir requirement
durumu (`REQUIRED_TIMEOUT`) bu iki hâli aynı gösteriyor: "oracle fact'i göremiyor"
ile "oracle `false` diyen bir fact görüyor". Üç hipotezi bu yüzden yanlış yerde
aradım. **Ders: fact eksikliğini teşhis ederken önce değerini yazdırın.**

**Kök neden — entity kimliği hiç çözülmüyordu.** `resolveInputs`'ta `entityRef`
kaynaklı bir girdi yalnızca `variables.get(binding.name)`'e bakıyordu, yani daha
önceki bir adımın yayınladığı çalışma-zamanı kimliğine. Tur onayında böyle bir
adım yok — schedule id bir koşu girdisi. Sonuç: girdi `undefined`, adapter back
office'te **boş dizeyi** aradı, bulamadı, `exists: false` yayınladı. Adım
`SUCCEEDED` raporladı (endpoint gerçekten çağrılmıştı), koşu son adıma kadar
sağlıklı göründü.

Pack bunu zaten bildiriyordu: `entityBinding: { type, id: "run.input.scheduleId" }`.
Host yalnızca `type`'ı okuyup `id`'yi görmezden geliyordu. **Aynı sınıfın
yedinci örneği.** Düzeltildi: adım bir kimlik yayınlamışsa o kazanır (koşunun
GÖZLEMLEDİĞİ kimliktir), yoksa `entityBinding.id` çözülür — `run.input.*` /
`macro.input.*` bir yol, gerisi sabit id. Test eklendi.

**Düzeltme sonrası cihazda ölçüldü:** dört fact de `true`, doğru lane, PRIMARY
yetki, `assert-approved`'ın occurrence'ında. `await-push` de artık `SKIPPED`
değil `SUCCEEDED` — push korele oldu.

**HÂLÂ AÇIK:** oracle bunları buna rağmen saymıyor; beş requirement da
`REQUIRED_TIMEOUT`. Yani kalan boşluk tam olarak "fact mevcut, doğru, doğru
lane'de, doğru occurrence'ta" ile "oracle onu sayıyor" arasında. Kalan adaylar,
bu sefer daraltılmış: requirement'ların korelasyon şartı (fact'lerde entity ile
eşleşen `correlationValue` yok) ve `observedBeforeMs` penceresi. Türetilmiş
`REMOTE.TOUR_APPROVAL_CONFIRMED` de `assert-approved`'ta artık üretilmiyor — bu,
korelasyon şartı hipotezini destekliyor, çünkü `CORRELATED_ALL_OF` girdilerinin
korele olmasını istiyor.

Sonraki adım: `evaluateFinalOracle`'a giren fact'lerin `correlationValue`'sunu
yazdırın; üçünü de tahminle değil ölçümle eleyin.

Verdict bu yüzden hâlâ `INCONCLUSIVE / EVIDENCE_INSUFFICIENT`. Ürün hakkında
hiçbir şey söylemiyor — §2'nin tarif ettiği durumun ta kendisi.

**Yan bulgu:** koşuyu tekrarlamak için schedule'ı `Task/RejectLeavingPermission`
ile `BeginningOfDay`'e çekiyoruz (statüyü koşulsuz yazıyor, `RejectionReason` bir
enum). Ama bu cihaza bir bildirim push'u gönderiyor ve uygulama **kendiliğinden
bildirim listesi ekranına gidiyor** — sonraki koşu `btn_out`'u bulamıyor. Bildirim
ekranı pack'te bir surface olarak modellenmiş değil; şimdilik elle çıkılıyor.

### 5.1 TAMAMLANDI — select-route'u cihazda tamamla (#17 + #18 ölçümü)

#18 transport'u açtı; **select-route'un kalan tek engeli #17'dir.** İki adım, bu
sırayla — çünkü ilki ikincinin girdisini üretiyor.

#### Adım 1 — `DONE`, cihazda ölçüldü

§3.5'in açık bıraktığı halka kapandı. `scripts/verdict-run.mjs` ile login
koşuldu (`PASS_ONLINE`, 9 adım), rota diyaloğu açıldı
(`nesy.sessionState.route_dialog_visible = true`), sonra:

```text
nesy.offeredRoutes  parametresiz        → 353 satır
nesy.offeredRoutes  matchKey="31"       →   1 satır  route_code=31 route_index=29
nesy.offeredRoutes  matchKey="31 *"     →   1 satır  AYNI route_code=31, index 29
nesy.offeredRoutes  matchKey="999"      →   0 satır  (sunulmayan rota → boş, "hepsi" değil)
```

Fiscal etiketiyle sorgulamak artık mümkün; boşluklu değer eskiden transport'ta
reddediliyordu. `route_index` de okunabiliyor — Adım 2'nin ihtiyacı olan girdi bu.

#### Adım 2 — `DONE`; plan ölçümle değişti, sonuç §3.6'da

Aşağıdaki tanı ve sıralama korunuyor: L1→L3→L4→L2 uygulandı, cihazda 14/14 adım
geçti ve koşu `FAIL_PRODUCT` üretti (§4). Uygulamanın ayrıntısı §3.6'da; burada
kalan, tanının nasıl çıktığı — dokümanın eski planı üç engeli hiç görmüyordu.

**Ölçüm, buradaki eski planı çürüttü.** Cihazdaki gerçek diyalog (bridge'in kendi
ağacından, `dump`):

```text
courierName    TextView      "Please Select Route"
dialog_spinner Spinner       clickable    → basınca popup ListView açılır
  popup:       ListView      id=null      collectionInfo={rowCount:-1,…}
    satırlar:  CheckedTextView  id=android:id/text1  rowIndex=0..8  text=route_label
yesButton      LinearLayout  clickable    "OK"
logout         LinearLayout  clickable    "Logout"
```

Dört bağımsız engel çıktı; üçü dokümanda hiç yoktu:

| # | Engel | Kanıt |
|---|---|---|
| E1 | `routeRow` hedefi **hiç selector üretmiyor** | `buildTargetFingerprint` `ACCESSIBILITY_ID` için `id/viewId/accessibilityId/resourceId`, `ENTITY_BINDING` için `text/value/label/entityKey` okuyor; pack `idPrefix` ve `keyPath` veriyor → ikisi de atlanıyor → `undefined` → `RESOLVE_TARGET` selector'sız `FAILED` |
| E2 | Hedef kimliği **statik**, dinamik olamıyor | `RESOLVE_TARGET` runtime'ı `step.entityBinding`'i hiç okumuyor; fingerprint yalnız pack'teki sabit dizgiden kuruluyor. Hangi rotanın istendiği koşudan geliyor → statik selector yetmez |
| E3 | Satırların **kendine ait id'si yok** | Hepsi `android:id/text1` paylaşıyor → id ile eşleme ambiguous. Tek kimlik `route_label` metni — ve fiscal rotada bu `"31 *"`, `routeCode` ise `"31"`: ikisi AYNI DEĞİL |
| E4 | Popup listesi **adreslenemiyor** | `selectListNode` `viewIdResourceName`'i birebir eşliyor; ListView'ın id'si `null` (Android'in kendi Spinner popup'ı, uygulama id'si asla taşımaz). Üstelik host'ta `scroll_to_item` yolu **yok**: `manager.act` yalnız `tap_id/tap_text/activate_id/input_text` kabul ediyor |

> **Düzeltme:** `resolve-row FAILED`'in sebebi #18 değildi — E1'di. Transport
> düzelmesi o adımı kendiliğinden geçirmez. §4'teki eski not bu yüzden yanıltıcıydı.

**Doküman "bridge scroll_to_item'ı zaten destekliyor" diyordu; doğru ama eksik:**
cihaz destekliyor, **host çağıramıyor** ve liste **id'siz olduğu için** cihaz da
bu listeyi kabul etmez.

##### Uygulama sırası (bağımlılık sırası, atlanamaz)

| Katman | İş | Neden bu sırada |
|---|---|---|
| **L1** host | `RESOLVE_TARGET` dinamik kimlik: adımın entity key'i (`run.input.` / `var.`) çözülüp `buildTargetFingerprint`'e verilsin; `ENTITY_BINDING.keyPath` nereden okunacağını söylesin | E1+E2. Bu olmadan HİÇBİR satır adreslenemez |
| **L2** pack | Gerçek hedefler (`dialog_spinner`, satır = `route_label` metni, `yesButton`) + `SDK_QUERY params: { matchKey: run.input.routeCode }` ile tek satır → `route_label` ve `route_index` değişkenleri. Sürüm 1.6.0 + seed + fixture | E3. `SdkQueryStep.params` sözleşmede zaten var (#18 onu açtı) |
| **L3** bridge | `scroll_to_item` id'siz koleksiyonu adresleyebilsin: `listId` **ya da** `listClass` (birebir `className` + `collectionInfo != null`), ambiguity'de fail closed | E4 cihaz tarafı. Android framework popup'ları hiçbir zaman uygulama id'si taşımaz — bu genel bir boşluk, spinner'a özel değil |
| **L4** host | `manager.scrollToItem()` + `act()` içinde `action: 'scrollToItem'` dalı (`back`/`swipe` gibi, hedef aramadan önce), `rowIndex` `var.`'dan çözülsün | E4 host tarafı |

**L1+L2 tek başına** ilk görünür penceredeki rotaları (satır 0-8: `1 *`, `2 *`,
`3`, `4`, `5`, `7`, `8 *`, `9`, `10`) uçtan uca seçilebilir yapar — zincirin
tamamı kanıtlanır. **L3+L4** aynı zinciri 253 rotanın hepsine genişletir; `31`
(index 29) sanallaştırıldığı için ona L3+L4 olmadan ulaşılamaz.

**Bitiş ölçütü:** `select-route` cihazda uçtan uca koşar ve `PASS_ONLINE` ya da
`FAIL_PRODUCT` üretir; `resolve-row` dahil hiçbir adım `INCONCLUSIVE` bırakmaz.
İlk görünür penceredeki bir rota ile ölçmek L1+L2'yi kapatır; `31` ile ölçmek
L3+L4'ü de kapatır.

##### Yan bulgu — diyalogda `back` = logout

Rota diyaloğunda geri tuşu diyaloğu kapatmakla kalmıyor, **oturumu düşürüyor**
(`is_logged_in` false). Teşhis sırasında ölçüldü. Diyalogda `back` gönderen bir
adım, önkoşulu sessizce yok eder.

### 5.2 Sonra — shipment gerektiren iki iş akışı

`process-parcel` ve `complete-delivery` **taranacak bir shipment istiyor**
(`scripts/create-ready-rs-shipments.mjs`, ya da tek gönderi için §7'deki not) ve
ayrıca §5.3'teki kanıt boşlukları var — yani `open-stop`/`tour-approval`'dan
(§5.0) farklı olarak bunlar yalnız önkoşulla açılmıyor.

`process-parcel` de türetilmiş fact'e dayanıyor (`APP.ACTIVE_STOP_MATCHES`);
§5.0c o yolu açtı ama ölçülmedi.

### 5.3 Kalan kanıt boşlukları

| Fact | Eksik |
|---|---|
| `APP.PARCEL_STATE_PROCESSED` | `parcelState` boolean taşımıyor, durum karşılaştırması gerek |
| `LOCAL.PARCEL_RECORD_PERSISTED` | `nesy.db.parcel` eklendi, makro bağlamıyor |
| `APP.SESSION_ISOLATION_ASSERTED` | sorgu değil, operasyon |
| `LOCAL.OFFLINE_QUEUE_DRAINED` | kuyruk gözlemi bağlı değil |

## 6. Cihazda koşu nasıl yapılır

### 6.1 Runner ve eski script'in sınırı

`scripts/diag-login-run.py` cockpit'in "Run Test" yolunu birebir taklit eder
(`apps/web/src/lib/verdict-runtime/start-pinned-run.ts` ile aynı sıra). Ama iki
yeri sabit yazılmış ve Windows'ta koşmaz:

```python
API    = "http://127.0.0.1:4001/api"
WF     = "nesy.workflow.login"          # tek iş akışı
DEVICE = "R6CW400BC8N"
subprocess.run(["/Users/gokhanoncu/Library/Android/sdk/platform-tools/adb", ...])
```

`adb` yolu macOS'e sabit (`logcat -c` ve sonda logcat okuması için). Repoda
`@nesy/platform-paths` içinde `resolveAdbPath()` var; kalıcı bir runner onu
kullanmalı ya da `ADB_PATH` ortam değişkenini okumalı.

**Kalıcı runner yazıldı: `scripts/verdict-run.mjs`.** Aşağıdaki sırayı koşar,
`adb` yolunu `@nesy/platform-paths`'ten (ya da `$ADB_PATH`'ten) çözer, launch
profile'ı iş akışına göre tablodan seçer ve benzersiz `sessionCorrelationId`'yi
çağıran unutsa bile enjekte eder.

```bash
node scripts/verdict-run.mjs nesy.workflow.login --input pin=3680 --reset
node scripts/verdict-run.mjs nesy.workflow.select-route --input routeCode=31
```

`--reset` koşudan ÖNCE `reset_state` gönderir (§6.6 kalıbı). `--json` ham koşu
detayını, `--no-logcat` sonda logcat özetini kapatır.

### 6.2 Runner'ın izlediği sıra

Her adım bir öncekinin çıktısını kullanır; atlanamaz.

| # | Ne | Uç |
|---|---|---|
| 1 | Cihaz hazırlığı | `GET /verdict/runtime/devices/{id}/readiness?appId={pkg}` |
| 2 | Pack pinle | `GET /verdict/runtime/domain-packs` → `PUBLISHED` + `compileReady`, `nesy.courier`, en yüksek sürüm |
| 3 | Workflow IR | `GET /workflows/{workflowRef}` → `currentVersion.nodes/connections` |
| 4 | Derle | `POST /verdict/runtime/compile` |
| 5 | Başlat | `POST /verdict/runtime/runs` → `202` + `runId` |
| 6 | Yokla | `GET /verdict/runtime/runs/{runId}` terminal olana kadar |

**Derleme gövdesi:**

```json
{ "workflowRef": "...", "workflowIr": { "nodes": [], "connections": [] },
  "domainPackKey": "nesy.courier", "domainPackVersion": "...",
  "domainPackDigest": "sha256:..." }
```

Kanvas boş olabilir — derleyici pack'in makro anlık görüntüsünden materyalize
eder. Bunun **tek makro** gerektirdiğini unutma (§3.4).

**Koşu gövdesi:**

```json
{ "workflowRef": "...", "deviceId": "R6CW400BC8N",
  "compiledPlanRef": "...", "compiledPlanHash": "...",
  "domainPackKey": "nesy.courier", "domainPackVersion": "...",
  "domainPackDigest": "sha256:...",
  "profileKey": "nesy.launch.cold-real-login",
  "inputs": { "pin": "3680", "sessionCorrelationId": "diag-<benzersiz>" } }
```

`profileKey` **zorunlu sayılmalı**: onsuz hiçbir şey uygulamayı soğuk başlatmaz
ve `wait-login-ready` yalnızca zaman aşımına uğrar.

| İş akışı | profileKey | inputs |
|---|---|---|
| `nesy.workflow.login` | `nesy.launch.cold-real-login` | `pin` |
| `nesy.workflow.select-route` | `nesy.launch.reuse-session` | `routeCode` (ör. `31` veya `31 *`) |
| `nesy.workflow.load-to-vehicle` | `nesy.launch.reuse-session` | `scanValue` (yazılan barkod), `alternateKey` (waybill — §7'deki normalizasyon notu) |
| `nesy.workflow.open-stop` | `nesy.launch.reuse-session` | `requestedItemCode` |
| `nesy.workflow.process-parcel` | `nesy.launch.direct-state` | `scanPayload`, `taskCode` |
| `nesy.workflow.complete-delivery` | `nesy.launch.direct-state` | `consignmentNumber` |
| `nesy.workflow.tour-approval-lifecycle` | `nesy.launch.reuse-session` | `routeCode`, `approvalRequestCode` |

> **Koşu başlatma idempotent.** Aynı gövde aynı `runId`'yi döndürür — yeni koşu
> başlamaz, eski koşunun sonucunu okursun. `inputs` içine her seferinde benzersiz
> bir `sessionCorrelationId` koy. Bu, "düzelttim ama hiçbir şey değişmedi"
> sanılan bir turu yuttu.

### 6.3 Sonucu okuma

`GET /verdict/runtime/runs/{runId}` beş yeri birden verir:

| Alan | Ne söyler |
|---|---|
| `run.product_verdict` / `evaluation_failure_class` | Nihai karar |
| `steps[]` | `action_result`, `continue_gate_result`, `final_oracle_result` |
| `oracleEvaluations[]` | Gereksinim gereksinim durum + `evidence_refs` |
| `actionTransitions[]` | `evidence_ref` — cihazın **reddetme sebebi** burada |
| `remoteActions[]` | Back-office çağrısı, artık gövdesiyle birlikte |

`INCONCLUSIVE` gördüğünde sırayla bak: hangi adım düştü → `actionTransitions`
son `evidence_ref` → `oracleEvaluations` içinde hangi fact `REQUIRED_TIMEOUT`.

### 6.4 Teşhis sondaları

Koşu dışında cihaza doğrudan sormak, bir hatanın kanıt hattında mı yoksa üründe
mi olduğunu ayırt eden en hızlı yol.

**Named query** (`packages/control-channels/dist/node-executor.js`,
`createControlExecutor({ applicationId })`):

```js
exec.run(DEVICE, { op: 'sql_named', requestId, scope: 'probe',
                   name: 'nesy.sessionState', maxRows: 1 })
```

Faydalı sorgular: `nesy.sessionState` (`is_logged_in`, `current_screen`,
`route_dialog_visible`), `nesy.db.session`, `nesy.offeredRoutes`
(`params: { matchKey }`), `nesy.stopState`.

**Oturumu sıfırla** (çıkış yaptırır — negatif koşu ve temiz önkoşul için):

```js
exec.run(DEVICE, { op: 'reset_state', requestId, scope: 'probe' })
```

**Kanıt hattı sağlığı:** `GET /api/verdict/events/health` → ilgili `runId`'nin
`orderedLag` ve `lastError` alanları. `orderedLag > 0` sıralı hattın tıkandığını
söyler.

**Cihaz olayları:** `adb logcat -d | grep NESY_TEST_EVENT` — `event`, `data`,
`occurrenceId`/`iterationKey` alanlarını doğrular. Korelasyon alanları yoksa olay
`LEGACY_NO_CONTEXT` olarak dosyalanır ve hiçbir oracle'a ulaşmaz.

**Köprü sağlığı:** `node scripts/verdict-bridge-smoke.mjs <deviceId> --read-only`.
`scoped-dump` adımındaki `treeGen` artmıyorsa erişilebilirlik servisi yarım
bağlanmıştır. Bu script çıkışta port yönlendirmesini **kaldırır**; preflight
yeniden kurar.

### 6.5 Koşu öncesi kontrol listesi

```text
1. VPN açık            nslookup nesy-staging-api.cityexpress.rs → 10.216.x.x
                       curl -o /dev/null -w "%{http_code}" https://…  (TLS geçerli olmalı)
2. Cihaz bağlı         adb devices → "device"
3. APK güncel          adb shell dumpsys package com.arasdigital.nesymobile.rstest | grep lastUpdateTime
4. Pack katalogda      GET /verdict/runtime/domain-packs → beklenen sürüm + digest
5. API ayakta          curl -o /dev/null -w "%{http_code}" http://127.0.0.1:4001/api/verdict/runtime/domain-packs
```

Pack ya da host kodu değiştiyse:

```bash
pnpm --filter @nesy/nesy-courier-domain-pack build
pnpm --filter @nesy/api seed:verdict-catalog     # SÜRÜM YÜKSELTMEDEN reddeder
touch apps/api/src/server.ts                     # tsx watch yeniden başlatır (~30 sn)
```

### 6.6 Ardışık koşu

Aynı önkoşuldan başlamayan koşular birbirini yanıltır. Kalıp:

```text
her tur: reset_state → koşuyu başlat → verdict + adımları oku
```

`reset_state` kasıtlı olarak koşulardan **önce** çağrılır: hem önkoşulu geri
kurar (login ekranı), hem de eskiden bir sonraki koşuyu `stale_run`'a düşüren
kanal müdahalesini tekrarlar — yani çit düzeltmesini (§3.3) her turda yeniden
sınar. Bu kalıpla 9 ardışık `PASS_ONLINE` ölçüldü, `stale_run` sıfır.

## 7. Çalışma notları

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
- **Cihazın sakladığı barkod, cockpit'in create yanıtındakiyle AYNI OLMAYABİLİR.**
  Ölçüldü: aynı script'in iki çağrısından biri `N6880110004100000…`, diğeri
  `N6880100000000000…` döndürdü; cihaz her ikisini de normalize edilmiş biçimde
  sakladı. Yazılan barkodla `nesy.parcelState{barcode}` boş dönebilir,
  `{waybillNumber}` bulur. Zimmet makrosu iki anahtarı birlikte geçiyor
  (`scanValue` + `alternateKey`); tek anahtara güvenen bir kanıt okuması kırılgan.
- **Zimmet koşusu için parça HER SEFERİNDE yeni olmalı.** Aynı barkod ikinci kez
  okutulduğunda `getTransaction` `FORCE_LOAD` değil `ALREADY_LOAD` döner ve makro
  kendi yolundan çıkar. `scratchpad/create-one-loadable.mjs` tek gönderi yaratır;
  repodaki `scripts/create-ready-rs-shipments.mjs` sekiz tip yaratıyor.
- **`shipments/create` yanıtı bazen `parcels` alanını taşımıyor.** shipmentId
  dönüyor ama barkod çıkarılamıyor; o çağrı unload edilmemiş bir gönderi bırakır.
  Barkod gerektiren bir script bu durumu ele almalı, sessizce geçmemeli.
- **Rota diyaloğunda `back` = LOGOUT.** Diyaloğu kapatmakla kalmıyor, oturumu
  düşürüyor. Teşhis sırasında `is_logged_in` false'a döndü; diyalogda geri
  gönderen bir adım önkoşulu sessizce yok eder.
- **Yarıda kalan `select-route` koşusu dropdown'ı AÇIK bırakıyor** ve popup
  açıkken `dialog_spinner` aktif pencerede olmadığı için bir sonraki koşu
  `resolve-spinner`'da `not_found` alır. Makronun popup'ı kapatan bir `CLEANUP`
  adımı yok; şimdilik kalıp `reset_state → login → select-route`. Ölçüldü:
  temizlik yapılmadan ikinci koşu, kod doğruyken bile düşer.
- **`verdict-bridge` ayrı bir Gradle projesi** (`verdict-bridge/gradlew`), kök
  `Nesy Mobile` projesinden `:verdict-bridge:app:...` diye çağrılamaz.
- **Bridge APK'sı imza uyuşmazlığı verebilir:** cihazdaki kopya başka bir
  makinenin `debug.keystore`'uyla imzalanmışsa `INSTALL_FAILED_UPDATE_INCOMPATIBLE`
  gelir ve tek yol `adb uninstall com.verdict.bridge`. Kaldırma erişilebilirlik
  servisini düşürür; `bridge-adb-facade.ts`'teki sırayla geri gelir (servis
  listesini SİL + yaz + master switch 1 — master switch ASLA 0 yazılmaz).
- **`ProtocolV1WaitAnyTest > wait_any times out with bounded evaluations under
  wake source` FLAKY.** Tam suite altında düşüp `--rerun-tasks` ile geçiyor;
  zamana duyarlı. Bir kez kırmızı gördüğünüzde tekrar koşun.
- **`NesyOfferedRoutesStore` bellekte.** Rota diyaloğu açılmadan boş; taze
  kurulumda `offeredRoutes` filtreli/filtresiz 0 satır verir ve hiçbir şeyi
  ayırt etmez. Ölçüm için önce login + diyalog gerekir.
- API tam suite'i yük altında `test-event-ws-server.integration`'da takılabiliyor
  (8765 portu); izole koşuda geçiyor — çakışma, gerçek hata değil.
- Backend (`NESY.WebAPI`) **salt okunur** (kullanıcı kararı). Bilinen iki kusur
  orada duruyor: `GetMyInfo` çift zarfı, `UserLoginLog` için okuma ucu yokluğu.

## 8. Fazın kapanma ölçütü

```text
her bağımsız iş akışı cihazda koşar ve PASS_ONLINE ya da FAIL_PRODUCT üretir
hiçbir REQUIRED fact üreticisiz değildir
EVIDENCE_INSUFFICIENT yalnız gerçekten gözlenemeyen durumda görülür
```
