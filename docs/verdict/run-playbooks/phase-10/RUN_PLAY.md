# Phase 10 RUN_PLAY — Workflow Evidence Completion (login → select-route → …)

```yaml
runPlayId: verdict-cockpit-phase-10-run-play
phase: "10"
phaseName: "Workflow Evidence Completion"
status: IN_PROGRESS
createdAt: "2026-08-12 05:20:00 +03"
startedAt: "2026-08-11 14:00:00 +03"
completedAt: null
lastUpdatedAt: "2026-08-13 08:00:00 +03"
timezone: "Europe/Istanbul"
previousPhaseResult: "docs/verdict/run-playbooks/phase-9/RESULT.md"
resultFile: "docs/verdict/run-playbooks/phase-10/RESULT.md"
phase10Target: "EVERY_WORKFLOW_DECIDABLE_ON_DEVICE"
domainPackVersion: "1.22.0"
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

Üçü de kuruldu (**plumbing / `CODE_WIRED`**). Bu, login golden occurrence’da
`ROUTE_LIST_READY` / `LOGIN_REJECTED` **live observed** demek değildir.
G90 o iddiayı ayrı tutar: `implemented ≠ live observed ≠ golden accepted`
([`../../goals/G90-stabilization/RESULT.md`](../../goals/G90-stabilization/RESULT.md) §1.1).

Yol boyunca iki tıkanma daha çıktı, ikisi de aynı sınıftan —
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

### 5.0g TUR ONAYI CİHAZDA PASS_ONLINE — beş fact de SATISFIED

`run_6cbc80f2`, pack 1.13.0, dokuz adım, final oracle SATISFIED:

```text
APP.TOUR_APPROVAL_REQUESTED           SATISFIED
REMOTE.TOUR_APPROVAL_REQUEST_CREATED  SATISFIED
REMOTE.TOUR_APPROVAL_STATUS_APPROVED  SATISFIED
REMOTE.TOUR_APPROVAL_CONFIRMED        SATISFIED   ← türetilmiş
APP.TOUR_APPROVAL_PUSH_RECEIVED       SATISFIED
```

Buraya gelmek **dokuz ayrı kusur** aldı ve hepsi aynı sınıftandı: *pack
bildiriyor, host okumuyor.* Sırayla, hepsi ölçümle bulundu:

| # | Kusur | Nerede |
|---|---|---|
| 1 | Hedef uydurulmuş (`tour_approval_request_button`) | `targets.ts` |
| 2 | Yanlış ekran (`endOfDay` ↔ stop list) | makro |
| 3 | Rota diyaloğu modellenmemiş — istek tek tap sanılıyordu | makro |
| 4 | Adapter operasyonları yanlış kuyrukta | `nesy-backoffice-endpoints.ts` |
| 5 | `entityBinding.id` okunmuyordu → boş dize sorgulanıyordu | `bridgeflow-remote-steps.ts` |
| 6 | `onTimeout: CONTINUE` okunmuyordu | `bridgeflow-executor` |
| 7 | Tazelik ikamet süresi gibi uygulanıyordu (üç ayrı yerde) | evidence runtime, oracle engine, derived publish |
| 8 | Cihaz olayları gözlem deposuna hiç girmiyordu | `bridgeflow-durable-evidence-ingest.ts` |
| 9 | `correlationPath` okunmuyordu → türetme hiç ateşlenemezdi | remote steps + device event sources |

**En pahalı ders — teşhiste değeri yazdır.** Üç hipotez arka arkaya yanlış çıktı
çünkü `REQUIRED_TIMEOUT` iki farklı durumu aynı gösteriyor: "oracle fact'i
göremiyor" ve "oracle `false` diyen bir fact görüyor". Trace'e fact
**değerlerini** eklediğim anda sebep göründü. `VERDICT_FACT_TRACE` ortam
değişkeni bu yüzden kodda kaldı.

**İkinci ders — tazelik girişi denetler, ikameti değil.** Bir koşunun kabul
ettiği, koreleettiği ve üzerine iş yaptığı fact, yalnız okuyucu geç kaldığı için
kaybolmamalı. Aksi hâlde ortasında uzun bir bekleme olan her dilim kendi kanıtını
yitirir. Karşı taraf korunuyor: teklif edildiğinde zaten eski olan gözlem hâlâ
reddediliyor, ve continue gate'in tazelik kuralı bilerek DEĞİŞMEDİ — "şu an doğru
mu" ile "oldu mu" aynı soru değil.

Mobil tarafta üç düzeltme: push iki kez yayınlanıyordu, occurrence bağlamı adım
bitince temizlenmiyordu (kira modeli), ve tur olayları `schedule_id` taşımıyordu
— korelasyon değeri olmadan türetme hiç ateşlenmez.

### 5.0h `open-stop` ölçüldü — üç uydurma daha, biri hâlâ açık

`stop_row_*` ve `stop_list` de hiç var olmamış. Cihazda bir durak satırı, `rv`
RecyclerView'ı içinde **kimliksiz** bir `LinearLayout`; kimlik çocuklarında
(`tv_address`, `consignee`, `textViewLegacySystemId`). `route_row_*` ve
`tour_approval_request_button` ile birlikte bu, isimden türetilmiş üçüncü hedef.

İki düzeltme yapıldı (pack 1.15.0):
- `stopRow` zincirinden `ACCESSIBILITY_ID` çıkarıldı, konteynerler `rv` oldu,
  `ENTITY_BINDING` başa geçti.
- Varlık kontrolü `read-available.codes` diye bir alanı karşılaştırıyordu;
  `nesy.availableStops` yalnız `stop_id` / `stop_order` / `task_count`
  yayınlıyor. Artık `stop_id` okunuyor — ve `check-present` cihazda gerçekten
  TRUE dalına giriyor.

**AÇIK:** `resolve-row` hâlâ düşüyor. Host `ENTITY_BINDING`'i "kimlik, entity
anahtarının METNİdir" diye uyguluyor (`bridgeflow-target-fingerprint.ts`), yani
ekranda `6a7cc56a…` yazısını arıyor — durak satırı stop id'yi göstermiyor.
`STRUCTURAL_FINGERPRINT`'in Bridge v1'de karşılığı yok, dosya bunu açıkça
söylüyor, ve fingerprint üreteci ilk kullanılabilir stratejide `return` ediyor —
yani zincir bir yedek denemiyor.

Doğru çözüm host'ta değil üründe: satırın kararlı bir kimliği olmalı
(`contentDescription` ya da bir view id, stop id'yi taşıyan). Ölçüm bunu söylüyor;
uydurmadan önce app'in vermesi gerekiyor.

2026-08-13'te bugünün gerçek stop id'siyle tekrar koşuldu
(`6a7d12d83c20eeb7d96c5669`): `check-present` **geçiyor** — yani `stop_id`
düzeltmesi doğru, durak projeksiyonda gerçekten bulunuyor. `resolve-row` yine
`NOT_FOUND`, aynı sebeple. Kalan tek iş budur ve mobil tarafta:

1. Durak satırına stop id taşıyan bir `contentDescription` ver.
2. Bridge'in metin aramasının `contentDescription`'ı da taradığını doğrula
   (taramıyorsa önce onu ekle — fingerprint yalnız `by: id` ve `by: text`
   biliyor).
3. Sonra `stopRow` zincirine `TEXT_MATCH`/`ENTITY_BINDING` olarak bağla.

Android view id'leri statik kaynaklar olduğu için `idPrefix + key` kuralı bu
satır için **çalışamaz**; kimlik ya içerik açıklamasından ya da görünen bir
metinden gelmek zorunda.

### 5.0k ÇÖZÜLDÜ — durak, ürünün kendi arama kutusuyla açılıyor (1.17.0)

Kullanıcının önerisi ölçüldü ve doğru çıktı: **ara kutusuna iş anahtarını yaz,
liste filtrelensin, kalanına dokun.** Cihazda kanıtlanan dizi:

```text
close_search_bar  → çubuk açılır (TOGGLE)
tietSearchText    ← waybill yazılır        (input_text, `id` parametresiyle)
search_button     → liste filtrelenir
find_text kısa barkod → matched: 1  (textViewLegacySystemId, satırın kendisi)
tap_text          → köprü tıklanabilir ATAYA yürür → görev listesi açıldı
```

Olumsuz kontrol de yapıldı: uydurma bir terim listeyi **0 satıra** düşürüyor
(`tv_empty`). Yani filtre gerçekten çalışıyor, tesadüf değil.

**Neden bu, satır indeksinden farklı.** "İlk satıra dokun" konumu kimlik yapmaktır
— bu paketin varlık sebebi olan hata. Burada kimliği **filtre** kuruyor: koşu
benzersiz bir iş anahtarı yazıyor, liste ona göre daraltılıyor, ve `ambiguityPolicy:
FAIL` birden fazla aday kalırsa koşuyu durduruyor. Kimlik koşunun KURDUĞU bir şey,
tahmin ettiği değil.

**İki anahtar, bilerek.** Arama kutusu yazılanı SAKLIYOR. Aynı değerle hem arayıp
hem satırı tanımak iki eşleşme verir ve ambiguity'de kapanır — ölçüldü. Bu yüzden
`searchTerm` (waybill, kutuya yazılır) ve `rowKey` (kısa barkod, satırda görünür)
ayrı girdiler.

**Kaldırılan önkoşul kontrolü.** Eski `check-present`, istenen kodu
`nesy.availableStops` projeksiyonuna karşı sınıyordu — o projeksiyon durak id'si
taşıyor, parça anahtarı taşımıyor; yani sorulan soruyu hiç cevaplayamazdı.
Güvence artık aksiyonun olduğu yerde: satır, satırın GÖSTERDİĞİ metinle çözülüyor
ve belirsizlik kapanıyor. Eylem anında kontrol etmek, anahtarı taşımayan bir
projeksiyonu kontrol etmekten güçlüdür.

**Toggle durumu da modellendi.** `close_search_bar` bir TOGGLE: açıkken basmak
kapatıyor. Körlemesine basan makro tek bir başlangıç durumundan çalışır, diğerinden
kırılır — bu da ölçüldü. Artık alan önce `TREAT_AS_ABSENT` ile yoklanıyor ve
toggle yalnız çubuk kapalıysa tıklanıyor; "açık mı bilmiyorum" `FAIL`, çünkü
tahminle basmak tam olarak kapatmakla sonuçlanır.

**Cihazda:** dokuz adımın hepsi SUCCEEDED, `tap-row` continue gate'i SATISFIED,
görev listesi açıldı.

### 5.0l `await-destination` — hipotez ÖLÇÜLDÜ, doğru çıktı, düzeltildi

Üç halka da doğrulandı:

1. Derleyici her WAIT_ANY bacağını `{ by: "id", value: <factKey> }` yapıyor
   (`wait-compiler.ts:70`).
2. Executor yalnız `WAIT_EVENT`'i fact beklemesi olarak kılıflıyor
   (`index.ts:1174`); `WAIT_ANY` köprünün UI yolundan geçiyor.
3. Cihazda, **görev listesi ekrandayken**: `find_id UI.TASK_LIST_READY` → matched
   0, `find_id UI.DELIVERY_FLOW_READY` → matched 0.

Yani bekleme yalnızca zaman aşımına uğrayabilirdi. `open-stop` bu adıma, aynı iki
fact'le continue gate'ini AZ ÖNCE doyurmuş ve durağı açmış olarak geliyor, sonra
zaten bulunduğu yere varmayı bekleyip düşüyordu.

**Düzeltme dar tutuldu, bilerek.** Adım başlarken fact'lerden biri ZATEN doğruysa
o bacak kazanır ve kendi `onWin` dalına gider; değilse köprü yolu aynen çalışır.
Fact yolunu köprünün YERİNE koymak daha temiz görünürdü ama kesme yüzeylerini
bekleme sırasında izleyen taraf köprü — onu sessizce kapatmak, düzelttiğinden
büyük bir delik açardı.

**Bu düzeltmenin kapatMADIĞI şey:** adım başladıktan SONRA doğru olan bir bacak
hâlâ görünmez, çünkü o noktadan sonra beklemeyi köprü yönetiyor ve köprü bir view
arıyor. Kapatmak için ya köprünün fact bacaklarını kabul etmesi ya da host'un
ikisini yarıştırması gerek — tahmin etmek yerine kaydedildi.

### 5.0m AÇIK — arama çubuğu durumu ekran geçişine duyarlı

`open-stop` bir koşuda dokuz adımı da geçti; sonraki koşuda
`resolve-search-field` düştü. Sebep yarış: yoklama (`probe-search-field`) bir
ekranda alınıyor, toggle başka bir ekranda tıklanıyor. Görev listesinden BACK ile
dönerken yoklama alanı yok görüyor, "aç" dalına giriyor, ve tıklama stop list'e
vardığında çubuk ZATEN açık olduğu için onu kapatıyor.

Ayrıca `resolve-search-field`, hedef `notFoundPolicy: TREAT_AS_ABSENT` bildirmesine
rağmen `FAILED` raporladı — `SKIPPED` bekleniyordu. Bu ikisi ayrı sorular; ikincisi
§5.0a'daki düzeltmenin bu yolda geçerli olup olmadığını sorguluyor ve
**ölçülmedi**.

### 5.0n Üç düzeltme yapıldı — `open-stop` 4 adımdan 10 adıma çıktı

**Fix 1 — hedef çözümlemesi tek atıştı.** `TargetResolutionPolicy.deadlineMs`
sözleşmede hep vardı ve bu runtime cihaza **bir kez** soruyordu. 300 ms sonra
beliren bir kontrol — açılan arama çubuğu, hâlâ şişirilen bir diyalog — ilk
karede `NOT_FOUND` dönüyordu. Ölçüldü: aynı iki çağrıyı aralarında bir duraklama
ile elle tekrarlamak her seferinde buluyordu. Artık deadline boyunca yeniden
deneniyor.

Yalnız `NOT_FOUND` bekleniyor: `AMBIGUOUS` ve `STALE_TREE` birer CEVAP ("birden
çok buldum", "ağaç altımdan kaydı"), onları tekrarlamak aynı soruya farklı yanıt
ummaktır.

**Ve yalnız zorunlu hedefler için.** İlk hâli `TREAT_AS_ABSENT` hedefleri de
bekletiyordu — yani var olmaması BEKLENEN bir kontrol için her koşuya tam
deadline fatura ediliyordu. Testlerden biri anında yakaladı. Yokluk meşru bir
cevapsa ilk `NOT_FOUND` **cevabın kendisidir**.

**Fix 2 — `TREAT_AS_ABSENT` okunuyormuş.** Ölçüm hipotezimi çürüttü: kod
`bridgeflow-device-ports.ts`'te duruyor ve çalışıyor. Gerçek sebep başkaydı: tek
hedef iki farklı soru soruyordu. Yoklama "şu an açık mı" diye soruyor ve HEMEN
cevap almalı; tıklama sonrası çözümleme "çubuk az önce açıldı, alan nerede" diye
soruyor ve animasyonu BEKLEMELİ. Bir hedef hem yokluk-toleranslı hem sabırlı
olamaz — ikiye ayrıldı (`stopSearchFieldProbe` / `stopSearchField`).

Dal da düzeldi: eşitlik yerine **varlık** testi. Yoklama işaretçiyi yalnız çubuk
kapalıyken yazıyor, yani `absentTarget == true` karşılaştırması AÇIK durumda
operandı çözemiyor, UNKNOWN veriyor ve `unknownPolicy: FAIL` ekranı gayet iyi olan
bir koşuyu öldürüyordu. İki durumlu soru varlık testiyle sorulur.

**Fix 3 — WAIT_ANY fact ön-kontrolü** (§5.0l) cihazda doğrulandı:
`await-destination` artık `SUCCEEDED`.

**Cihazda şu an:** on adım geçiyor — yoklama, dal, arama, filtre, satır çözümleme,
tap, ve varış beklemesi.

### 5.0o AÇIK — `read-active-stop` cihazda cevaplanamıyor

Son iki adım kaldı ve engel host'ta değil cihazda: `nesy.stopState`
**`stopId` parametresi zorunlu** kılıyor
(`NesyAppAdapterQueryCapability.kt:444`), yani "şu durak hakkında bilgi ver" diye
soruyor. Makronun sorması gereken şey ise "**hangi** durak açık" — ve koşu artık
mongo stop id'sini bilmiyor (girdiler `searchTerm` ve `rowKey`).

Bu, `APP.ACTIVE_STOP_MATCHES` yanlış-satır muhafızının dayandığı gözlem. Parametre
uydurmak muhafızı kendi kendini onaylar hâle getirirdi.

**Gereken:** cihazda parametresiz bir "aktif durak" projeksiyonu
(`nesy.activeStop`), açık durağın kimliğini döndüren. Sonra `read-active-stop`
onu okur ve `assert-correct-item` gerçekten karşılaştırma yapar.

### 5.0p `open-stop` PASS_ONLINE — on iki adım, yanlış-satır muhafızı dahil

`run_b57445bb`, pack 1.19.2. Üç requirement de SATISFIED:

```text
APP.AVAILABLE_STOPS_LOADED  SATISFIED
APP.ACTIVE_STOP_OBSERVED    SATISFIED
APP.ACTIVE_STOP_MATCHES     SATISFIED   ← yanlış-satır muhafızı
```

**Cihaza `nesy.activeStop` eklendi.** Parametresiz: "hangi durak açık" diye
soruyor. `SP.selectedStopId` görev listesi açılırken yazılıyor, uygulama o
bağlamdan çıkarken temizleniyor — yani uygulamanın KENDİ cevabı, hangi ekranın
açık olduğundan çıkarılmış bir tahmin değil. Boş prefs sıfır satır döndürüyor:
"hiçbiri açık değil" kanıtı, boş kimlik değil.

**Muhafız neyi neyle karşılaştırıyor — iki kez düzeltildi.**

Önce `stop_id` ile karşılaştırıyordu. Ama koşu durağı arama kutusundan
adresliyor ve mongo stop id'sini hiç öğrenmiyor: muhafıza yalnız bir tarafın
sahip olduğu bir değer verilirdi. Daha kötüsü, koşu o id'yi bilseydi, muhafız
koşunun kendi varsayımını doğrulamış olurdu. **Kendi girdisini doğrulayan şey
muhafız değildir.**

Bu yüzden `nesy.activeStop` artık `row_key` de yayınlıyor — açık durağın
taşıdığı parça anahtarı. Sorulan soru artık doğru soru: *açılan durak, aradığım
parçayı taşıyan durak mı?*

İkinci düzeltme daha ince: `comparePath` parametresi **hiç okunmuyor**. Motor
gözlemin `correlationValue`'suna bakıyor (`derived-fact-engine.ts:96`), yani
kararı `outputFactBindings`'teki `correlationColumn` veriyor. Cihaz `row_key`'i
yayınlıyorken bağlama hâlâ `stop_id`'yi korelasyon değeri yapıyordu — muhafız
doğru açılmış bir durağa VIOLATED dedi. İkisi artık aynı kolonu gösteriyor ve
yorumda niye ikisinin birlikte tutulması gerektiği yazılı; ayrışmaları bu
muhafızı sessizleştirmenin yolu.

**Yedi iş akışından beşi artık cihazda PASS_ONLINE:** login, select-route,
load-to-vehicle, tour-approval-lifecycle, open-stop. Kalan ikisi
(`process-parcel`, `complete-delivery`) hiç koşulmadı.

### 5.0i Bildirim listesi ve cihaz-düzlemi statü — yazıldı, cihazda doğrulanmadı

**Bildirim listesi artık bir surface** (`nesy.notification-list-dialog`, HANDLE +
`nesy.macro.dismiss-notification-list`). Gün boyu her koşuyu bozan şey buydu:
push geldiğinde uygulama kendiliğinden bildirim ekranına gidiyor ve sonraki koşu
altındaki ekranı bulamıyor. Elle `btn_exit` ile kurtarmak zorunda kaldığımız her
sefer bunun kaydıydı.

Kritik ayrıntı: surface'in `detection.requiredFactKeys`'i
`UI.NOTIFICATION_LIST_PRESENT` diyordu ve **o fact'i hiçbir şey üretmiyordu** —
bu pack'in kendi kuralının ihlali. Mobil tarafa `SURFACE_NOTIFICATION_LIST_READY`
yayını eklendi (`emitSurfaceReady` / `markSurfaceHidden`, dismiss listener'ında)
ve host'a kaydı yapıldı. **Göremediği bir surface'i host hiç kapatamaz.**

**`APP.SCHEDULE_STATUS_APPROVED`** eklendi: uygulama bir schedule'ı KABUL ettiği
anda sayısal statüyü ve `schedule_id` korelasyonunu yayınlıyor
(`ScheduleRepositoryImpl`, iki nokta). Bilerek tur onayı oracle'ına
**konulmadı** — backend'in APPROVED'ı ile cihazın APPROVED'ı iki ayrı iddia, ve
aradaki 28 saniye asıl sorulacak soru. Onu ayrı bir dilim soracak.

### 5.0j DOĞRULAMA KOŞUSU — dört iş akışı, temiz cihazdan, hepsi PASS

2026-08-13, logout durumdaki cihazdan başlayarak, pack 1.16.0:

```text
login             PASS_ONLINE
select-route      PASS_ONLINE   ← rota diyaloğu gerçekten çıktı, 12 adım
load-to-vehicle   PASS_ONLINE
tour-approval     PASS_ONLINE   ← beş requirement de SATISFIED
```

`run_f0acc136`. Yeni schedule `11-31-20260813-1` (gün döndü, rota seçimi bugünün
schedule'ını yarattı).

**İki yeni fact de cihazda aktı.** `SCHEDULE_STATUS_APPROVED` **canlı**
occurrence ile geldi (`run_f0acc136…:tap-routing-choice:0`) — occurrence kirası
çalışıyor, artık bir önceki koşunun adımını taşımıyor. O anki değeri `false`,
doğrusu da o: schedule henüz `WaitingForApproval`'dı. `SURFACE_NOTIFICATION_LIST_READY`
de yayınlandı ve koşu bildirim ekranına takılmadı.

**Onuncu kusur, koşu sırasında bulundu ve kapatıldı.** İlk denemede beş
requirement de SATISFIED, final oracle SATISFIED — ama `assert-approved` adımı
FAILED ve koşu INCONCLUSIVE. Sebep: `ASSERT_FACT` tek atışlık okuyor, oysa aynı
adımın oracle'ı o fact'i `EVENTUAL` (180 sn) olarak bekliyor. Türetilmiş sonuç
henüz o occurrence'a yayınlanmadan assert bakıyor, `evidenceInsufficient`
işaretleyip koşuyu durduruyor — ve `aggregateProductVerdicts` bu bayrakta kısa
devre yaptığı için, yanı başında EVET diyen oracle hiç okunmuyor.

Düzeltme: fact henüz ÖLÇÜLMEMİŞSE ve adımın kendi final oracle'ı o fact'i
EVENTUAL olarak talep ediyorsa, assert kararı oracle'a bırakır (`SKIPPED`).
ÖLÇÜLMÜŞ bir çelişki hâlâ anında düşürür — koşunun elindeki cevabı üç dakika
bekletmek gerçek bir ürün hatasını geciktirmek olurdu. Test eklendi.

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

### 5.0q PROCESS_PARCEL tek bir dala daraltıldı (1.20.0) — koşu enjeksiyonda takılı

**Önce harita çıkarıldı.** Durakta bir barkod okutmak tek akış değil: task
sayfasındaki `whenBarcodeDetect` yaklaşık **yirmi** sonuca ayrılıyor — pickup,
return document, D4M/LOS, force load, labelless, gray label — ve dallar ülkeye
(`RS/HR/SI/BA/ME/AZ/BG`; B2 kontrolü SI'yi hariç tutuyor), schedule statüsüne,
task tipine, item durumuna/konumuna, pickup tipine, `counterLocationType`'a, PAK
header'a, offline moda ve assistant-courier bayrağına göre bölünüyor.

Üç bulgu haritanın kendisinden daha önemli:

**1. `ScanProcessor` bu sayfada YOK** — yalnız `StopListFragment`'ın. Zimmet
ağacının tamamı task sayfasından erişilemez. Makro bir tarayıcı yüzeyi
bekliyordu; o ekranı bu dilim hiç ziyaret etmiyor.

**2. `APP.PARCEL_SCANNED` yönlendirmeden ÖNCE, kabul edilen her tarama için
yayınlanıyor** (`MainActivity` ~1636). Makronun bugün çalışan tek fact'i buydu.
Yani sadece ona dayanan bir koşu, **hiçbir şey yapmayıp toast gösteren dallarda
da yeşil verirdi.** Kanıt üretmeden geçen bir test.

**3. `getTransaction` saf sınıflandırıcı değil — mutasyon yapıp kaydediyor**
(`SharedViewModel` ~1754, ~1792). Fiili döndürmeden önce item durumunu değiştirip
schedule'ı diske yazıyor. Koşu sonra reddedilse bile DB değişmiş oluyor.

**Seçilen dal: C3 — teslim.** Durakta okutulan parça teslim akışını açar. Dilim
ülkeye bağlı DEĞİL (koşulları item durumu/konumu, schedule statüsü, task tipi);
yalnızca RS cihazında koşuluyor. Ülkeye bağlı komşular (`B2` return-document,
`B3a/C6` PAK+peşin ödeme, LOS) açıkça kapsam dışı.

**Yeni ayırt edici: `APP.DELIVERY_FLOW_STARTED`.** Cihaza boolean `delivery_started`
ve korelasyon için `barcode` eklendi (`DELIVERY_STARTED` teli; tek ad, tek anlam,
boolean değer — `VEHICLE_LOADING_STEP` dersi).

**`APP.SCHEDULE_STATUS_APPROVED` oracle'a REQUIRED olarak girdi.** `Delivery` ile
`Already_Load`'u ayıran **tek** alan `scheduleStatus == Approved(2)`
(`SharedViewModel` ~1766 vs ~1773) ve ekranda görünmüyor. Dün eklenen fact'in
asıl işi buymuş.

**İki gereklilik yanlıştı, eksik değil.** `LOCAL.PARCEL_RECORD_PERSISTED` bu
dalın yapmadığı bir yerel yazmayı istiyordu — kaldırıldı.
`APP.SESSION_ISOLATION_ASSERTED` istenmesi doğruydu ama makro
`nesy.assert.release-isolation`'ı hiç çağırmıyordu, yani yalnız zaman aşımına
uğrayabilirdi; artık çağırıyor. Enjeksiyon yapan tek dilimde bu en çok önemli
olan: o dikiş release'e sızarsa, suite gerçek kuryenin giremediği bir yolu
kanıtlıyor olurdu.

### 5.0r AÇIK — cihaz komutlarının host'ta çalıştırıcısı yok

Koşu `inject-payload`'da düşüyor, cihaza hiç ulaşmadan. Sebep sınıfı tanıdık ama
şekli yeni:

`nesy.setup.scanner-inject` cihazda bir **komut** (`NesyAppAdapterCommands` ~618,
`nesy.assert.release-isolation` ve `nesy.setup.prepared-session` ile aynı aile).
Pack ise onu bir **adapter operasyonu** olarak REMOTE_ACTION ile çağırıyor — ve
host'un tek uzak adaptörü back-office HTTP'si, bu ref için endpoint'i yok.

Yol zaten var ve kullanılıyor: launch profile önkoşullarını
`controlExecutor.run(deviceId, { op: 'seed', … })` ile kuruyor
(`bridgeflow-execution-queue.ts` ~323). Eksik olan, operationRef'i bir cihaz
komutu olan REMOTE_ACTION adımlarını o yola bağlamak.

**Uyarı:** bu turda eklediğim `assert-release-isolation` adımı **aynı aileden** ve
aynı sebeple düşecek. İkisi tek düzeltmeyle açılır; ayrı ayrı kovalanmamalı.

## 5.5 COMPLETE_DELIVERY planı — teslim ekranı haritalandı

Teslim ekranı taramadan kayda kadar **~34 karar dalı** taşıyor ve **en az 21'i
hiçbir şey yaymıyor**. Ama bu bölümün asıl konusu eksik teller değil: burada
**yanıltıcı** teller var, ve plan onlarla başlamak zorunda.

### 5.5.1 ÖNCE DÜZELT — yeşil yalan söyleyen tel

`DELIVERY_UI_COMPLETED` **başarısızlık yolunda da yayınlanıyor**:
`emitDeliveryError` aynı `step="COMPLETED"`i kullanıyor, `success=false` ve
`delivery_submitted` alanı **yok**. Katalog bu teli
`nesy.events.critical/delivery-submitted` → `APP.DELIVERY_SUBMITTED` diye
kaydediyor.

Yani tel adına bakan bir oracle, **backend reddini teslim olarak okur.** Bu,
"kanıt yok" değil "yanlış kanıt" — ve bu fazın kovaladığı her şeyden daha
tehlikeli. Değer alanı olarak `delivery_submitted` okunmalı ve o alanı taşımayan
kare **reddedilmeli**, varsayılana düşülmemeli.

Aynı sınıftan iki tel daha: `DIALOG_SHOWN` bu ekranda **dört**, `DIALOG_DISMISSED`
**üç** anlam taşıyor, ayrımı boolean olmayan `data.step`/`dialogType` yapıyor —
`VEHICLE_LOADING_STEP` hatasının birebir tekrarı. `normalizeData` `userChoice`'u
bir dalda `"DELY"`, başka dalda `"true"` üretiyor. Hiçbirinde `data` içinde
korelasyon yok.

`PAYMENT_COMPLETED` ve `FISCAL_COMPLETED`: boolean değer alanı yok, `data` içinde
korelasyon yok, `FISCAL_COMPLETED`'ın `invoice_id`'si `ALREADY_CREATED` dalında
**boş dize**.

**Sonuç: hiçbir dilim yazılmadan önce tel hijyeni.** Bugüne kadar bunu üç kez
kanıtladık (`PARCEL_SCANNED`, `TOUR_STARTED`, `DELIVERY_STARTED`): boolean değer
alanı + `data` içinde korelasyon. Aynısı burada beş tele gerekiyor.

### 5.5.2 Birleştirme zinciri kopuk

`DELIVERY_STARTED` `data.barcode` taşıyor, `DELIVERY_UI_COMPLETED` taşımıyor.
`DELIVERY_UI_COMPLETED`'ın `requestId`'si yok, `DELIVERY_PERSISTED`'ın var.
Ve `DELIVERY_PERSISTED`'ın zarf `taskId`'si **waybill**, `DELIVERY_UI_COMPLETED`'ınki
**parça barkodu** — ikisinin farklı olduğu bir gönderide birleştirme kırılır.

Uçtan uca tek anahtar yok. Plan bunu varsaymamalı; fixture üzerinde ölçmeli.

### 5.5.3 Fiscal, gradle'da ve YALNIZ RS'te

`isFiscailzationFeatureEnabled` (kaynakta yazım hatasıyla) tam olarak **üç**
flavour'da açık, üçü de RS: `tstrs`, `productionrs`, `productiondexpressrs`.
Diğer on bir flavour'da kapalı.

**Bizim cihazımız `tstrs`** — yani RS'te koştuğumuz her teslim fiscal koduna
giriyor. Bu, `open-stop`/`process-parcel`'ın tersi: orada dilim ülke-bağımsızdı,
burada RS teslimi doğası gereği fiscal'a bağlı.

Bir rahatlık: `tstrs`'te `isPrinterConnectionRequired = false`, yani yazıcı
donanımı bağımlılığı test cihazında yok (production RS'te var). Fiscal'ı yazıcı
olmadan koşabiliyoruz — ama bu, **production RS'i test etmediğimiz** anlamına da
gelir ve dilimin `notResponsibleFor`'una yazılmalı.

`TestEvent.FISCAL_COMPLETED` dokümantasyonu "BG/RS Datecs" diyor; **BG'de fiscal
kapalı**. Belge yanlış.

### 5.5.4 Sıra

**1. Tel hijyeni** (mobil + host). Beş tele boolean değer alanı ve `data`
korelasyonu; `DELIVERY_UI_COMPLETED`'ın hata yolunu ayrı bir tele ya da en azından
`delivery_submitted` yokluğuyla reddedilebilir hâle getirmek. Bu bitmeden dilim
yazmak, yanlış kanıtın üstüne oracle kurmaktır.

**2. RS ödemesiz DELY** — tek parça, tek shipment, sıfır tahsilat. Ödeme
diyaloğu, fiscal, yazıcı ve beş sağlayıcı yolu tamamen atlanır; kalan şey teslimin
kendisidir. `isDeliveryCodeOrSignatureNotRequired()` RS'te true olduğu için imza
ve teslim kodu da devre dışı.
Önkoşullar arasında **durakta tek task** olması şart: `checkUnScannedShipmentItems`
tüm durağı sayıyor, çok task'lı durak uyarı diyaloğunu tetikliyor.

**3. RS nakit + EXW → fiscal fatura.** `FISCAL_COMPLETED` ve
`PAYMENT_COMPLETED{fiscal=true}` üreten tek akış, RS'e özel, ve **regüle** — yanlış
sonuç UX değil hukuk sorunu. Sekiz iptal dalının hepsi bugün sessiz.

**4. RS nakit, yalnız COD (EXW yok).** Fiscal kapısını **negatif** kanıtlar:
`EXW > 0` koşulu kayarsa ülkedeki her COD teslimi sessizce fiscal'lanır ya da
fiscal'dan çıkar. En yüksek frekanslı ödemeli teslim.

**5. RS skip-EXW.** `exwSkipForCurrentDelivery` bayrağı ödeme tutarını sessizce
sıfırlıyor ve ayrı bir kalıcılık yükü yazıyor; bugünkü tek izi, ilkinden ayırt
edilemeyen ikinci bir `DIALOG_SHOWN`.

### 5.5.5 Yol boyunca bulunan iki ürün kusuru

**SI kimlik kontrolü koşulsuz `return` ediyor** (`DeliveryFragment` ~726-731):
`if (!isValidTaxNumber(...)) { toast }` ve ardından `return` — `if`'in DIŞINDA.
Geçerli vergi numarası da olsa teslim ilerlemiyor, ve hiçbir şey yayınlanmıyor.
Bizim RS dilimimizi etkilemiyor; SI'de teslimi durduruyor.

**`createFiscalInvoice` `shipmentId` parametresini kullanmıyor** (~3440); listeyi
`exworkWaybills`'ten yeniden kuruyor. Çağıran taraf iç içe döngüde atanan
`selectedShipmentId`'yi geçiyor, yani taranan değil **son** teslim edilmemiş
waybill. Ölü parametre, altında yanlış-gönderi kusuru saklıyor.

İkisi de bizim koşacağımız dalın dışında; kaydedildi, uydurulmadı.

### 5.5.6 ÖLÇÜLDÜ — Complete butonu `btn_deliver`, pack id'si uydurmaydı

2026-08-13, R6CW400BC8N, teslim ekranı açıkken köprü `dump scope=full` (uiautomator dump görünmez düğümleri atlıyor):

```text
btn_deliver   LinearLayout  clickable  enabled
              ilk kare: visible=false  bounds.top=2517  (katmanın altında)
              kaydırınca: visible=true  [127,1990][953,2191]
              find_id matched=1  her iki durumda
çocuk text1   "Delivery"  clickable=false
delivery_complete_button  find_id → not_found
```

Metinle bağlamak ambiguous: action-bar başlığı da `"Delivery"`. `btn_out` ile aynı kural — yalnız id.

`delivery_scroll` koleksiyon değil (`collection_info_unavailable`); `scroll_to_item` bu ekranda çalışmaz. Köprü swipe, imza pad'inin ÜSTÜNDEKI parça bandından (`y=1250→400`) butonu görünür kıldı. Host `fromX` gönderiyordu, cihaz `missing_startX` dedi; `startX`/`endX` kabul edildi.

`tv_deliver_item_size` hâlâ `0`; buton yine de enabled. Satır seçiminin Complete önkoşulu olup olmadığı tap edilmediği için bilinmiyor.

Pack 1.22.0 hedefi `btn_deliver` yaptı. Koordinat swipe makroya yazılmadı — kimlik değil.

### 5.5.7 Tel hijyeni — mobil + host

Mobil (`NesyMobile`) ve host, dilim yazılmadan önce beş yanıltıcı teli ayırdı:

| Tel | Önce | Sonra |
|---|---|---|
| `DELIVERY_UI_COMPLETED` hata yolu | `delivery_submitted` yok → host reddeder → INCONCLUSIVE | `delivery_submitted=false` + `data.barcode` → ölçülmüş ret, teslim değil |
| `DIALOG_SHOWN` / `DIALOG_DISMISSED` (teslim ekranı) | dört / üç anlam, `data.step` ile | ayrı teller; paylaşılan isimler ArasDialog merkezi + ScanProcessor için kaldı, **katalogda yok** |
| `PAYMENT_COMPLETED` / `FISCAL_COMPLETED` | boolean yok, korelasyon yok; `invoice_id=""` | `payment_completed` / `fiscal_completed` + `data.barcode`; join `invoice_id` değil |
| skip-EXW | `ArasDialog` → ayırt edilemeyen `DIALOG_SHOWN` | `SKIP_EXW_DIALOG_SHOWN` / `SKIP_EXW_RESULT` (`skip_exw_accepted`) |

Pack **1.23.0** katalogda (`sha256:1ade5d481b79be5b0e1153249150377cc34b785f48df8df017fe0999e261f4b9`).

### 5.5.8 ÖLÇÜLDÜ — hijyen APK kuruldu; off-screen `tap_id` reddediliyor

2026-08-13 08:27, `installTstrsDebug` → `nesymobile-rstest-v0.1157.apk` (`lastUpdateTime=2026-08-13 08:27:20`). Oturum ve zimmet durdu (Stop List: Loaded Parcels 1, Remaining Stops 1, KNEZA MILOSA / Zimmet Olcum 01). Teslim ekranı kısa barkod `6880051000289711` ile manuel girişten açıldı; uzun `N68801…` aynı diyalogda teslimi açmadı.

```text
find_id btn_deliver  matched=1  visible=false  enabled=true  clickable=true
                     bounds.top=2517  (ekran 2340)
tap_id  btn_deliver  ok=false  error=not_visible
```

Köprü `visible=false` düğüme `ACTION_CLICK` göndermiyor — `tapTargetRejection`. Kaydırmadan Complete basılamaz. `delivery_scroll` hâlâ koleksiyon değil; teslim ekranındaki `rv` `collection_info` veriyor ama `rowCount=-1`, `visibleRowCount=0`, çocukları clickable değil. `tv_deliver_item_size` hâlâ `"0"`.

Makrodaki `tap-complete` bu haliyle `not_visible` ile düşer. Koordinat swipe kimlik değil; off-screen tıklamayı köprüye açmak da kuryenin kaydırmasını atlar. İkisi de ayrı karar — uydurulmadı.

### 5.5.9 COMPLETE_DELIVERY cihazda KARAR ÜRETİYOR (1.25.1) — üç bağımsız hata

2026-08-13. §5.5.8'in sunduğu iki seçenek (koordinat swipe / görünmez düğüme
`ACTION_CLICK`) **ikisi de gereksizdi** ve asıl engel off-screen tap değildi.
Ölçüm üç bağımsız hata gösterdi; her biri tek başına koşuyu durduruyordu.

**1. `tap-complete` son tap değil.** `btn_deliver` → "Choose A Delivery Option"
(`btnDely`) → ArasDialog onayı (`btn_arasDg_positive_button`) → teslim. Üç tap.
Makro tek tap modelliyordu; buton görünür olsa bile `DELIVERY_SUBMITTED` hiç
gelmez, kapı 25 sn dolar. **Görünürlük düzeltilse bile koşu düşerdi.**

**2. Tarama bir önkoşul.** `initiateDeliveryProcess`'in ilk satırı
`shipmentModelList.any { isScanned }`; değilse toast atıp **hiçbir şey yaymadan**
dönüyor. Ölçüldü: teslim ekranı `tv_deliver_item_size = "0"` ile açılıyor, aynı
barkod ekranda okutulunca `"1"`. Layout'ta `android:text` yok — yani `"0"` kodun
yazdığı değer, sayaç gerçekten sıfırdı.

Kök neden bir **ürün tutarsızlığı**: `reloadDeliveryPage` (ekranı AÇAN yol) beş
alanı normalize etmeden eşliyor ve `legacySystemShortBarcodeTrim`'i hiç okumuyor;
`addBarcodesFromList` (ekranda OKUTMA yolu) altı alanı `trim().uppercase()` ile
eşliyor. Aynı barkod, iki farklı cevap. Kurye kısa barkodla sayfayı açıyor, "0
parça" görüyor, Delivery'e basıyor ve az önce yazdığı barkod için "en az bir
barkod okutulmalı" uyarısı alıyor. **Değiştirilmedi** — düzeltmesi ayrı bir
karar; `DeliveryFragment` içinde yorum olarak kayıtlı.

**3. Off-screen tap — üçüncü seçenek vardı.** `reveal_id` köprü komutu: düğümü id
ile bul, **düğümün kendisine** `ACTION_SHOW_ON_SCREEN` gönder. Kaydırmayı
uygulamanın kendi `delivery_scroll`'u yapıyor — ürünün imza pad'i açılınca aynı
butona yaptığı şeyin aynısı (`DeliveryFragment` `smoothScrollTo(btnDeliver…)`).
`ACTION_SHOW_ON_SCREEN` köprüde zaten vardı ama yalnız `scroll_to_item`
üzerinden, o da `collectionInfo` şartına bağlı; `delivery_scroll` bir `ScrollView`,
koleksiyon değil — bu yüzden yol kapalıydı.

Cihazda ölçüldü:

```text
find_id  btn_deliver   visible=false  top=2517   (ekran 2340)
tap_id   btn_deliver   not_visible                ← kapı YERİNDE kalıyor
reveal_id btn_deliver  ok  revealAction=show_on_screen
find_id  btn_deliver   visible=true   top=1990    ← uygulama kaydırdı
tap_id   btn_deliver   ok → "Choose A Delivery Option"
```

`already_visible` (idempotent), `stale_tree` çiti ve `not_found` de cihazda
doğrulandı. `tap`ın `not_visible` kapısı **bilinçli olarak duruyor**: görünmez bir
düğüme tıklamak, kuryenin ulaşamadığı bir kontrolü yeşil yapardı.

**4. `branch-on-queue` hiç çözülemezmiş.** `local.result` altında
`pendingOperation.count` okuyordu; bu makroda onu üreten hiçbir şey yok. Üstelik
projeksiyonun kolonu `pending_count` ve değer **String** (`"0"`), condition
evaluator ise `greaterThan`'i **yalnız number** için tanımlıyor (dize
karşılaştırması bilinçli olarak UNKNOWN). Yani hiçbir cihazda, hiçbir durumda
çözülemezdi. Eklendi: `read-pending-queue` (`nesy.pendingOperation`), ve koşul
`notIn` ile skaler eşitliğe indirildi. Bugüne kadar görünmemesinin sebebi: hiçbir
koşu Complete tap'ini geçememişti.

> Aynı bozuk operand `full-courier-golden.ts`'te de duruyor — bu dilimde
> değiştirilmedi, kayda geçti.

**Tel hijyeni tamamlandı.** Teslim dilimindeki her tel artık TEK kanonik anahtar
taşıyor: `shipmentItemBarcode`. Ölçülen kusur — `DELIVERY_TYPE_DIALOG_SHOWN` uzun
legacy formu, `PARCEL_SCANNED` yazılan kısa formu taşıyordu, aynı parça, iki
anahtar, `correlationField: 'barcode'` birleşimi sessizce hiç ateşlemiyordu.
`emitScreenLoaded` artık `canonicalBarcodeFor(initialBarcode)` alıyor;
`selectedBarcodeList` zaten `shipmentItemBarcode` tutuyordu. Ekrandaki üç kopya
matcher tek `matchesBarcode`'a indirildi (`reloadDeliveryPage` bilinçli istisna,
madde 2).

Yeni tel `DELIVERY_PARCEL_SCANNED` (`delivery_parcel_scanned` boolean +
`scanned_count`/`total_count`): `PARCEL_SCANNED` bu kapıyı kanıtlamaz, çünkü o
yönlendirmeden ÖNCE her ekranda yayınlanıyor.

**Cihazda sonuç** (pack 1.25.1, `reuse-session`):

```text
15/15 aksiyon adımı SUCCEEDED
  tap-scan-confirm      gate SATISFIED   APP.DELIVERY_PARCEL_SCANNED
  tap-complete          gate SATISFIED   APP.DELIVERY_TYPE_DIALOG_SHOWN
  tap-delivery-type     gate SATISFIED   APP.DELIVERY_CONFIRM_DIALOG_SHOWN
  tap-delivery-confirm  gate SATISFIED   APP.DELIVERY_SUBMITTED   ← teslim GERÇEKTEN gitti
  read-pending-queue    SUCCEEDED
  branch-on-queue       SUCCEEDED
  verify-backend-status SUCCEEDED
assert-confirmed        VIOLATED  →  FAIL_PRODUCT, termination COMPLETED
```

`INCONCLUSIVE` değil, **karar**. Bu iş akışı için fazın çıkış ölçütü karşılandı.

**AÇIK — bu `FAIL_PRODUCT` dürüst mü?** `assert-confirmed` ihlali ya gerçek bir
ürün kusuru (backend teslimi completed olarak kaydetmedi) ya da
`readDeliveryStatus`'un yanlış alanı okuması. §5.0d'nin dersi tam buydu:
*kaynağı okumak, doğru kaynağı okuduğunu garanti etmiyor.* İddia edilmedi,
ölçülmedi — sıradaki iş bu.

**Ölçülmeyen iki şey daha:**

- `DIRECT_STATE` launch profile **işlevsiz**. `applyLaunchPreparation`
  `params: {}` gönderiyor, ama `nesy.setup.direct-state` `targetScreen` VE
  `shipmentId` istiyor (cihazda doğrulandı: sırayla `MISSING_PARAM`). Koşu doğru
  şekilde `BLOCKED` dedi — ürün hatası değil. Yani hazırlık **çağrılıyor** ama
  **parametreleri taşınmıyor**: §2 deseninin yeni bir yüzü. Bu dilim geçici
  olarak `reuse-session` + elle açılmış teslim ekranıyla ölçüldü; kalıcı çözüm ya
  launch profile'ın parametre bildirmesi ya da makronun durak listesinden
  başlaması (ölçüldü: `manuel_input` → barkod → `btnDelivery` bottom sheet →
  teslim ekranı).
- Durak listesindeki **`DeliveryOptionsBottomSheet`** (`btnDelivery` /
  `btnDeliveryFailed` / `btnDeps`) hiçbir yerde modellenmemiş bir yüzey.

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
  kendi yolundan çıkar. `scripts/create-ready-rs-shipments.mjs` sekiz tipi sekiz
  AYRI durakta yaratıyor; tek gönderi için `TYPES`'ı `standard`'a indiren bir
  kopya yeter — o zaman gönderi listedeki ilk durağa (KNEZA MILOSA) düşer ve
  cihazın durak listesi yedi fazladan durakla kirlenmez. Script barkodu
  yazdırmıyor: `barcodes` yalnız unload çağrısında kullanılıyor, yani teslim
  koşusunun ihtiyacı olan parça barkodunu görmek için o satıra eklemek gerekiyor
  (özet satırı **shipmentId** basıyor, barkod değil — ikisini karıştırmak
  `PARCEL_IN_SCHEDULE` VIOLATED olarak geri döner; ölçüldü).
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
