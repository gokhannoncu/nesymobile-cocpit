# Phase 10 RUN_PLAY — Workflow Evidence Completion (login → select-route → …)

```yaml
runPlayId: verdict-cockpit-phase-10-run-play
phase: "10"
phaseName: "Workflow Evidence Completion"
status: IN_PROGRESS
createdAt: "2026-08-12 05:20:00 +03"
startedAt: "2026-08-11 14:00:00 +03"
completedAt: null
lastUpdatedAt: "2026-08-12 20:15:00 +03"
timezone: "Europe/Istanbul"
previousPhaseResult: "docs/verdict/run-playbooks/phase-9/RESULT.md"
resultFile: "docs/verdict/run-playbooks/phase-10/RESULT.md"
phase10Target: "EVERY_WORKFLOW_DECIDABLE_ON_DEVICE"
domainPackVersion: "1.11.0"
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
