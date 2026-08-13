# Verdict — Rekabet konumu ve savunulabilir farklılaşma

**Tarih:** 2026-08-12  
**Durum:** Bağlayıcı strateji notu (yatırım / satış / kamu iddiası dili).  
**Kapsam:** Plan **tamamlandığında** geçerli konum — bugünkü implementasyon durumu ayrı playbook’larda.  
**Marka adresi:** [`DOMAIN_AND_LANDING.md`](./DOMAIN_AND_LANDING.md)  
**Saha istihbaratı (özellik / finans / fiyat):** [`competitive-intel/README.md`](./competitive-intel/README.md)  
**Yatırımcı değerlendirme:** [`INVESTOR_EVALUATION.md`](./INVESTOR_EVALUATION.md)  
**Teknik omurga:** [`../SISTEM_NASIL_CALISIR.md`](../SISTEM_NASIL_CALISIR.md) · [`../CONDITION_ENGINE_AND_BRIDGEFLOW.md`](../CONDITION_ENGINE_AND_BRIDGEFLOW.md) · [`../semantic-actions/HOW_IT_WORKS.md`](../semantic-actions/HOW_IT_WORKS.md)

---

## 0. TL;DR — net hüküm

Plan tamamlandığında Verdict’in en güçlü ve savunulabilir konumu:

> **Kritik mobil iş akışları için işlem doğrulama ve kanıt altyapısı.**

| Verdict **olmayacak** | Verdict **olacak** |
|---|---|
| En kapsamlı mobil test platformu | Offline-first / operasyonel mobil işlerde **transaction verification** |
| En büyük device cloud | UI → App → Local → Remote zincirini **tek occurrence** altında yargılayan runtime |
| En güçlü Visual AI / performans lab | Continue Gate ≠ Final Oracle; offline-aware verdict |

Kısa kategori mesajı:

> **Appium executes. BrowserStack scales. Applitools sees. HeadSpin measures. Tricentis orchestrates. Verdict proves the transaction.**

---

## 1. Savunulabilir runtime modeli

Üstünlük iddiası dar fakat değerli alanda geçerlidir:

```text
Bridge fiziksel işlemi gerçekleştirir
        ↓
SDK uygulamanın tepkisini gözler
        ↓
Local persistence ve offline queue doğrulanır
        ↓
Remote business state doğrulanır
        ↓
Cockpit aynı occurrence altında nihai hüküm verir
```

Bunu destekleyen temel bileşenler (tamamlanmış plan):

- Domain Pack → generic WorkflowIR v2 **deterministic** compilation
- Continue Gate ile Final Oracle **ayrımı**
- UI / App / Local / Remote evidence
- Occurrence / entity correlation
- Offline-aware sonuç taksonomisi
- Evidence authority, freshness, provenance

First-class kombinasyon (kamuya açık dokümanlarda başka üründe bütün halinde doğrulanamadı):

1. Fiziksel UI action lifecycle
2. App içi canonical evidence
3. On-device local persistence / queue doğrulaması
4. Remote business entity doğrulaması
5. Aynı run / occurrence / entity altında temporal correlation
6. Continue Gate / Final Oracle ayrımı
7. Offline-aware PASS / PENDING / FAIL semantiği
8. Domain Pack’ten deterministic execution planı
9. Evidence authority, freshness ve provenance

**Önemli sınır:** Bu, “başka hiçbir ekip custom kodla yapamaz” demek değildir. Tosca, Katalon veya Espresso/Appium üzerine özel modüllerle parçalar üretilebilir. Fark: Verdict bunu müşterinin yeniden kuracağı glue script değil, **ürünün doğal veri ve execution modeli** olarak sunar.

---

## 2. Yasak iddialar — eski abartılar

Yatırım veya satış sunumunda **kullanılmayacak** ifadeler:

| Eski iddia | Neden yanlış |
|---|---|
| “Rakiplerin tamamı sadece UI’a bakıyor” | Espresso idling resources; Detox gray-box sync; Tosca mobil+API+DB; Katalon mobile/API/web/desktop aynı flow |
| “Rakiplerde network ve performans yok” | Sauce network capture / offline sim; BrowserStack app performance; Kobiton / HeadSpin performans odaklı |
| “Rakiplerde design audit yok” | Applitools Visual AI; Tricentis Vision AI — Verdict bu alanda başlangıçta **daha zayıf** |
| “50× hız / sıfır overhead” | Kanıtsız; Espresso/Detox/Maestro senaryoya göre hızlı olabilir; fark ölçülmeli |
| “Hiçbir rakip bunu yapmıyor” / “sıfır ek maliyet” | Savunulamaz |

---

## 3. Pazar haritası

### 3.1 UI automation framework’leri

Appium · Maestro · Espresso · Detox · UIAutomator · XCUITest

Execution primitive’leri ve test framework’leri. Appium ekosistem; Maestro kolay YAML flow; Espresso/Detox app-aware sync’te daha güçlü.

### 3.2 Device cloud / mobile quality

BrowserStack · Sauce Labs · Kobiton · Perfecto

Gerçek cihaz, paralel execution, log/video/network/performance artifact, kurumsal cihaz operasyonu.

### 3.3 Kurumsal test platformları — en yakın ticari rakipler

Tricentis Tosca · Katalon

Yalnız UI değil: model-based / low-code authoring, API/DB, orchestration, enterprise raporlama.

### 3.4 AI-native authoring / managed coverage

QA Wolf · Momentic · mabl

Yazma, bakım, coverage, onboarding hızı.

### 3.5 Uzman ürünler

| Ürün | Odak | Verdict ilişkisi |
|---|---|---|
| Applitools | Visual correctness | Modül rakibi; entegre evidence source adayı |
| HeadSpin | Mobile performance | Modül rakibi; occurrence’a bağlanan metrik tamamlayıcı |
| Mobot | Fiziksel robot / hardware | Niş; Bridge yazılımsal dokunuştan farklı |

---

## 4. Verification derinliği

İşaretler:

- **FC** — first-class temel ürün yeteneği
- **MOD** — yapılabilir veya ayrı modül / custom entegrasyon gerektirir
- **—** — kamuya açık dokümanlarda first-class olarak görülmedi

| Platform | App-aware state | API/DB | On-device local | Tek occurrence 4D evidence | Continue Gate / Final Oracle | Offline-aware verdict | Domain semantics |
|---|---|---|---|---|---|---|---|
| **Verdict – tamamlanmış plan** | FC | FC | FC | **FC** | **FC** | **FC** | **FC** |
| Tricentis Tosca | MOD | FC | MOD | MOD | — | MOD | MOD |
| Katalon | MOD | FC | MOD | MOD | — | MOD | MOD |
| Sauce Labs | MOD | MOD | — | — | — | MOD | — |
| BrowserStack | MOD | MOD | — | — | — | MOD | — |
| Kobiton / Perfecto | MOD | MOD | — | — | — | MOD | — |
| Espresso / Detox | **FC** | MOD | MOD | — | MOD | MOD | — |
| QA Wolf / Momentic / mabl | MOD | MOD | — | — | — | MOD | — |

Asıl fark “rakip API çağrısı yapabilir mi?” değildir:

```text
# Adım dizisi (klasik)
Mobile step → API step → Database step

# Occurrence modeli (Verdict)
Aynı physical action occurrence için:
  UI sonucu · App transition · Local persistence · Remote entity
  + authority / freshness / correlation / eventual-consistency
```

---

## 5. Pazar genişliği

| Platform | Android | iOS | Büyük device cloud | AI/low-code | Visual AI | Performance | Enterprise |
|---|---|---|---|---|---|---|---|
| **Verdict – ilk tamamlanmış sürüm** | **FC** | — | MOD | MOD | MOD | MOD | MOD |
| Tricentis Tosca | FC | FC | MOD | **FC** | **FC** | MOD | **FC** |
| Katalon | FC | FC | FC / entegrasyon | **FC** | MOD | MOD | **FC** |
| Sauce Labs | FC | FC | **FC** | FC | MOD | **FC** | **FC** |
| BrowserStack | FC | FC | **FC** | MOD | **FC** (Percy) | **FC** | **FC** |
| Kobiton / Perfecto | FC | FC | **FC** | **FC** | FC | **FC** | **FC** |
| QA Wolf / Momentic / mabl | FC | FC | FC | **FC** | MOD | MOD | MOD / FC |
| Applitools | FC | FC | partner | FC | **FC** | — | **FC** |
| HeadSpin | FC | FC | **FC** | MOD | MOD | **FC** | **FC** |
| Mobot | FC | FC | fiziksel robot | managed | visual report | MOD | MOD |

> **Verdict verification derinliğinde öne çıkabilir; pazar genişliğinde başlangıçta rakiplerinin gerisinde olacaktır.**

---

## 6. Rakip bazında kıyas

### 6.1 Tricentis Tosca — en yakın stratejik rakip · tehdit: **çok yüksek**

**Onların gücü:** Android+iOS; model-based/codeless; mobile+API+DB; Vision AI; enterprise breadth ve kanal.

**Verdict’in alanı:** On-device Room/queue first-class evidence; occurrence correlation; Continue Gate ≠ Final Oracle; `PASS_QUEUED_OFFLINE`; `UNKNOWN_ACTION_EFFECT` / process-death recovery; Domain Pack fact/authority; command→gesture→app→local→remote waterfall.

**Not:** Tosca müşteri modülleriyle yaklaşabilir; Verdict’in avantajı dar, mobil-native derinliktir.

### 6.2 Katalon — mid-market · tehdit: **yüksek**

**Onların gücü:** All-in-one, low-code, cloud, TestOps, kolay onboarding.

**Fark:**

```text
Katalon:  Tap Deliver → Call API → Run DB → Assert
Verdict:  Complete Delivery → UI/App/Local/Remote evidence otomatik bağlanır
          → online/offline policy ile hüküm
```

Müşterilerin çoğu için “yeterince iyi, daha kolay, daha geniş” riski yüksek.

### 6.3 Sauce Labs — mobile diagnostics · tehdit: **orta-yüksek**

**Onların gücü:** Real device scale; network capture/throttle/offline sim; vitals; logs; timeline; AI diagnostics.

**Fark:** Sauce çoğunlukla “ne oldu?” artifact’ı verir. Verdict “işlem business olarak tamamlandı mı, hangi katmanda bozuldu?” typed Oracle üretir (`HTTP 200` ama entity değişmedi → `FAIL_REMOTE`).

**Not:** İleride execution altyapısı olarak entegrasyon adayı.

### 6.4 BrowserStack — altyapı · tehdit: **orta** (ürün genişlerse yükselir)

Cihaz bulutu / reporting / Percy. Doğru strateji: Verdict runtime **+** BrowserStack device infra — cloud’a karşı cloud kurmak değil.

### 6.5 Kobiton / Perfecto — mobile-first · tehdit: **orta-yüksek**

Execution, scriptless, visual/performance/accessibility olgunluğu. Verdict farkı yine local+remote business occurrence bağlama.

### 6.6 Espresso / Detox — teknik karşılaştırma · tehdit: **çok yüksek build-vs-buy**

App-aware sync Verdict’in icadı değil. Doğru fark:

```text
Espresso / Detox:  App artık busy değil mi?
Verdict:           Bu business action için blocking evidence oluştu mu?
                   Eventual business sonucu doğru mu?
```

Idleness ≠ Continue Gate. Güçlü Android ekibi custom stack kurabilir; Verdict TCO, false-pass ve teşhis hızını ölçülü pilotla kanıtlamalı.

### 6.7 QA Wolf / Momentic / mabl — authoring · tehdit: **orta**

Yazma/bakım/onboarding üstünlüğü. Potansiyel tamamlayıcı: onlar üretir ve çalıştırır; Verdict sonucu kanıtlar. Evidence SDK + Oracle yatırırlarsa doğrudan rakibe dönüşürler.

### 6.8 Applitools — visual · tehdit: **düşük doğrudan, yüksek özellik**

Visual AI ana moat **değil**. Applitools/Percy benzeri ürünleri evidence source olarak entegre et.

### 6.9 HeadSpin — performans · tehdit: **düşük doğrudan, yüksek modül**

Verdict metrikleri business occurrence’a bağlar (`Stop 17 Complete Delivery` → memory/frame + `PASS_ONLINE` + performance warning); ilk sürümde performans lab’i değildir.

### 6.10 Mobot — fiziksel dünya · tehdit: **düşük**

Yazılımsal Bridge ≠ mekanik robot / kamera / kart / çevresel donanım.

---

## 7. En yakın rakip sıralaması

| Sıra | Rakip | Tehdit | Neden |
|---|---|---|---|
| 1 | Tricentis Tosca | Çok yüksek | Mobil + API + DB + model-based enterprise |
| 2 | Katalon | Yüksek | Kolay, geniş, all-in-one |
| 3 | Sauce Labs | Yüksek | Diagnostics, device cloud, AI release assurance |
| 4 | Kobiton / Perfecto | Orta-yüksek | Mobile-first enterprise execution |
| 5 | BrowserStack | Orta-yüksek | Altyapı, dağıtım, enterprise reach |
| 6 | Espresso/Detox + internal platform | Çok yüksek build-vs-buy | Güçlü ekip kendisi yapabilir |
| 7 | QA Wolf / Momentic / mabl | Orta | Authoring, coverage, onboarding |
| 8 | Applitools / HeadSpin | Modül | Visual / performance uzmanlığı |
| 9 | Mobot | Niş | Fiziksel hardware senaryoları |

---

## 8. Verdict’in gerçekten kazandığı alanlar

1. **İşlem bazlı evidence graph** — rastgele artifact değil; `deliver-stop / stop:84127 / attempt:1` altında UI/App/Local/Remote → örn. `PASS_QUEUED_OFFLINE`
2. **Continue Gate ≠ Final Oracle** — “akış ilerleyebilir mi?” vs “işlem business doğrulandı mı?”
3. **Local mobile truth** — Room, offline queue, prefs, pending op, process restart recovery (bounded, versioned evidence)
4. **Offline / eventual consistency** — `PASS_QUEUED_OFFLINE`, `PENDING_REMOTE` vb. klasik kırmızı/yeşilden daha değerli
5. **Domain Pack** — `tap text "Deliver"` yerine `Complete Delivery` niyeti → version/country/capability’ye göre generic plan

---

## 9. Rakiplerin geçtiği alanlar (tamamlanmış planda dahi)

1. iOS (ilk model Android ağırlıklı)
2. Device scale
3. Visual AI
4. Performance laboratory
5. AI test authoring
6. Enterprise integration / compliance
7. Onboarding sürtünmesi (SDK + App Adapter + Domain Pack)
8. Cross-platform breadth (web/desktop)
9. Yerleşik satış, referans, procurement

---

## 10. Asıl rakip: glue stack

En tehlikeli alternatif tek bir ürün değil:

```text
Appium / Espresso / Maestro
+ BrowserStack / Sauce
+ API testleri
+ SQL script’leri
+ Sentry / Datadog
+ custom dashboards
```

Müşteri: “Zaten hepsine sahibiz; neden Verdict?”

**Yanlış cevap:** “Hepsi tek ekranda.”  
**Doğru cevap:** Bu araçlar ayrı kanıt üretir. Verdict aynı business occurrence için hangi eylemin hangi app transition’ını, local transaction’ı ve remote sonucu oluşturduğunu deterministik ilişkilendirir ve tek hüküm üretir.

Yenilmesi gereken en büyük rakip: **mevcut araçlar üzerine yazılmış şirket içi glue code**.

---

## 11. Kamuya çıkış dili

### Kullanılmayacak

> Dünyada SDK, Bridge ve Oracle kullanan başka kimse yok.

Kanıtlanamaz; kolayca çürütülür.

### Kullanılacak

**EN:** Existing tools execute mobile tests, provide device infrastructure, or collect diagnostics. Verdict turns a mobile business action into a correlated, cross-layer proof of outcome.

**TR:** Mevcut araçlar mobil testi çalıştırır veya teknik artifact toplar. Verdict, mobil bir iş aksiyonunu UI, uygulama, cihaz ve backend katmanlarında doğrulanmış bir sonuç kanıtına dönüştürür.

Landing ([`DOMAIN_AND_LANDING.md`](./DOMAIN_AND_LANDING.md)) ile hizalama: hero’da bu **işlem kanıtı / sessiz regresyon** vaadi; SDK+Bridge ikinci katmanda kanıt mimarisi.

---

## 12. Nihai rekabet hükmü

Plan tamamlandığında Verdict:

- En iyi genel mobil test platformu **olmaz**
- En büyük cihaz bulutuna sahip **olmaz**
- En güçlü visual AI **olmaz**
- En kolay test generator **olmayabilir**
- En geniş cross-platform suite **olmaz**

Liderlik şansı şu kategoride:

> **Offline-first, finansal veya operasyonel mobil uygulamalarda business transaction verification.**

Rekabet avantajı “SDK + Bridge var” değildir — kopyalanabilir. Asıl avantaj kombinasyondur:

```text
Domain Pack
+ canonical evidence
+ occurrence correlation
+ local/remote reconciliation
+ Continue Gate
+ Final Oracle
+ offline-aware verdict
+ reproducible evidence waterfall
```

**En dürüst sonuç:** Kamuya açık rakip ürünlerde bu kombinasyonun tamamını first-class görmüyoruz. Parçaların çoğu rakiplerde var; Tosca/Katalon/custom stack önemli bölümü taklit edebilir. Gerçek üstünlük ancak **daha düşük entegrasyon maliyeti, daha az false-pass, daha hızlı teşhis ve mission-critical hataları yakalayan ölçülmüş pilotlarla** kanıtlanır.

---

## 13. Sunum checklist

| Durum | İfade / davranış |
|---|---|
| OK | Transaction verification; occurrence; 4D evidence; offline-aware verdict |
| OK | “Appium executes… Verdict proves the transaction” |
| OK | Tricentis/Katalon’u en yakın rakip olarak adlandırmak |
| OK | BrowserStack/Sauce’u rakip + potansiyel infra partner diye ayırmak |
| YASAK | “Kimse UI dışında bakmıyor” / “50×” / “sıfır overhead” / “ilk biz” absolutleri |
| YASAK | Visual AI veya device cloud’u birincil moat diye satmak |
| ZORUNLU | Her üstünlük iddiasında pilot metriği (false-pass ↓, MTTD ↓, entegrasyon günü) |
