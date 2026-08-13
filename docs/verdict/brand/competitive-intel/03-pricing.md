# Rekabet — yıllık fiyatlar ve Verdict paketleme

**Kesim:** 2026-08-02 · **İndeks:** [`README.md`](./README.md)

Güven:

- **Resmî liste** — üretici sayfasında açık fiyat  
- **Resmî teklif** — fiyat gizli; satış görüşmesi  
- **Pazar tahmini** — satın alma platformları / kullanıcı bildirimleri / üçüncü taraf (kesin teklif değil)

Fiyatlar genelde KDV, kurulum, profesyonel hizmet, özel cihaz/bulut ve ek concurrency **içermez**.

---

## 1. Toplu fiyat tablosu

| Rakip / ürün | Açıklanan başlangıç | Yıllık karşılık | Tipik kurumsal bütçe | Güven |
|---|---|---|---|---|
| **Momentic** | Açıklanmıyor | Özel teklif | Güvenilir kamu rakamı yok | Resmî teklif |
| **mabl** | Tahminen $499/ay | ≈ **$5.988/yıl** | **$14.400–$40.000+** | Tahmin |
| **BrowserStack App Automate** | $199/ay/parallel | **$2.388/yıl/parallel** | 5+ parallel → özel | Resmî liste |
| **BrowserStack App Automate Pro** | $249/ay/parallel | **$2.988/yıl/parallel** | Enterprise özel | Resmî liste |
| **Sauce Real Device Cloud** | $199/ay/parallel | **$2.388/yıl/parallel** | **$25.000–$75.000+** | Liste + tahmin |
| **Sauce Virtual Device Cloud** | $149/ay/parallel | **$1.788/yıl/parallel** | Enterprise özel | Resmî liste |
| **Kobiton Startup** | $83/ay | **$996/yıl** | 500 dk/ay | Resmî liste |
| **Kobiton Accelerate** | $399/ay | **$4.788/yıl** | 3.000 dk/ay | Resmî liste |
| **Kobiton Scale** | Yıllık paket | **$9.000/yıl** | Enterprise özel | Resmî liste |
| **Perfecto** | Açıklanmıyor | Özel | Genelde **$15.000–$100.000+** | Tahmin |
| **HeadSpin CloudTest Lite** | $39/ay (yıllık) | **$468/yıl** | Sınırlı manuel | Resmî liste |
| **HeadSpin CloudTest Go** | $83/ay (yıllık) | **$996/yıl** | Otomasyon add-on | Resmî liste |
| **HeadSpin Pro / özel cihaz** | Açıklanmıyor | Özel | Örn. 16 cihaz **$42–48K/yıl** | Kullanıcı bildirimi |
| **Tricentis Tosca** | Açıklanmıyor | Özel | **€20–100K+**; büyük €200K+ | Tahmin |
| **Tricentis Testim** | Açıklanmıyor | Özel | Küçük **$10–20K**; orta **$20–50K+** | Tahmin |
| **Katalon Studio Enterprise** | İlk 3 seat $1.000/yıl | **$1.000/seat/yıl** | 4+ seat **$2.199/seat/yıl** | Resmî liste |
| **Katalon True Platform** | $700/seat/yıl | **$700–900/seat/yıl** | Enterprise özel | Resmî liste |
| **Katalon True Automation** | $2.000/seat/yıl | **$2.000–2.500/seat/yıl** | Enterprise özel | Resmî liste |
| **Testsigma** | Açıklanmıyor | Özel | Küçük **$8–14K**; orta **$30–50K** | Tahmin |
| **testRigor Pro** | Tahminen $900–1.000/ay | **$10.8–12K/yıl** | Enterprise özel | Tahmin |
| **ACCELQ** | Açıklanmıyor | Özel | ≈ **$840–1.440/kullanıcı/yıl** | Tahmin |
| **Autify/Aximo Core** | $99/ay (yıllık) | **$1.188/yıl** | 72K kredi/yıl | Resmî liste |
| **Autify/Aximo Team** | $450/ay (yıllık) | **$5.400/yıl** | 360K kredi/yıl | Resmî liste |
| **Applitools** | Paid açıklanmıyor | Özel | ≈ **$2.500–30.000+** | Tahmin |
| **QA Wolf** | Test başına aylık | Özel | Genelde **$60–250K/yıl** | Tahmin |
| **Mobot** | Robot aksiyonu | Özel | Tahmini **$120–600K+/yıl** | Düşük güven |
| **Appium / Maestro / Espresso / XCUITest** | $0 lisans | **$0 lisans** | Mühendislik + cihaz + CI | Resmî OSS |

---

## 2. Tek tek notlar

### Momentic

Fiyat yok; custom (kullanım / run / ekip / mobile-web / enterprise). Bütçede **$10–50K/yıl** düşünmek makul olabilir — doğrulanabilir kamu fiyatı olmadığı için ana tabloya tahmin satırı eklenmedi.

### mabl

Resmî açık liste yok (ihtiyaç + cloud-run kredisi). Üçüncü taraf 2026: Starter ~$499/ay; Growth/Pro ~$1.2–3K/ay; Enterprise ~$40K+/yıl — **mabl doğrulamadı**.

### BrowserStack App Automate

```text
1 parallel Device Cloud:     $199/ay → $2.388/yıl
Device Cloud Pro:            $249/ay → $2.988/yıl
```

Yıllık ödeme; parallel arttıkça maliyet artar; 5+ satış. Düz çarpım örneği: 5 parallel ≈ $11.9–14.9K; 10 ≈ $23.9–29.9K (hacim indirimi olabilir).

Ek: Percy Desktop+Mobile $599/ay ($7.188/yıl); App Percy Essentials $199; App Percy Device Cloud $399; Test Management Team $99 / Pro $199. Tam mobil yığın kolayca **$15–40K/yıl**.

### Sauce Labs

Live $39/ay; Virtual $149/ay; Real Device $199/ay — her biri **1 parallel**. Enterprise AI, private cloud, SSO özel. Orta ölçek enterprise bildirimi ≈ **$25–75K/yıl** (vendr).

### Kobiton (şeffaf)

Startup $83/ay (500 dk); Accelerate $399/ay (3.000 dk); Scale $9.000/yıl (7.500 dk); Enterprise custom. Dakika + cihaz; private slot / no-code / enterprise ayrı.

### Perfecto

Resmî fiyat yok. Pazar: küçük/public ~$15K; orta $30–80K; enterprise/private $100K+ — **resmî liste değil**.

### HeadSpin

Lite $39/ay ($468/yıl); Go $83/ay ($996/yıl); Pro custom. Lite: 40 saat/ay, 1 kullanıcı. Kullanıcı örneği: 16 özel cihaz ≈ **$42–48K/yıl**.

### Tricentis Tosca

Tamamen teklif. Pazar: başlangıç €20–40K; orta €60–100K; çok modüllü €200K+. Named user bazı verilerde $3–5K/yıl. Maliyeti şişirenler: execution agent, SAP/mobile/API, Vision AI, test data, virtualization, PS/eğitim.

### Tricentis Testim

Community ücretsiz; Essentials/Pro/Mobile fiyat gizli. 2026 tahmin: küçük $10–20K; orta $20–50K; Tricentis bundle $100K+. Tarihsel açık fiyatlar (satın alma öncesi) Essentials ~$450/ay, Pro ~$1K/ay — güncel teklif bazlı.

### Katalon (açık)

Studio Enterprise: ilk 3 seat **$1.000/seat/yıl**, 4+ **$2.199**. True Platform **$700–900/seat**. True Automation **$2.000–2.500/seat**. Örnek 5× True Automation ≈ **$10K/yıl** (+ cloud/parallel/governance).

### Testsigma / testRigor / ACCELQ

Hepsi ağırlıklı özel teklif. Testsigma model: 5 kişi / 50–80 test $8–14K; 200–400 test $30–50K. testRigor Pro tahmin $900–1K/ay. ACCELQ tahmin $70–120/user/ay → 5 user $4.2–7.2K; 20 user $16.8–28.8K.

### Autify / Aximo (açık)

Core $99/ay ($1.188/yıl) — 72K kredi, 2 mobile concurrency. Team $450/ay ($5.400) — 360K kredi, 5 concurrency. Enterprise custom. Kredi aşımı / dedicated infra ayrı.

### Applitools

Test Unit bazlı; paid fiyat gizli. Pazar: küçük $1.2–2.4K; orta $6–30K; dedicated daha yüksek. Başka model checkpoint’e göre $2.5–30K.

### QA Wolf — Coverage as a Service

Test oluşturma + infra + bakım + triage + bug reporting; tutar gizli. Vendr: sözleşme **$60–250K/yıl**; ~$40–70/test/ay. Örnek: 100 test $48–84K; 200 $96–168K; 400 $192–336K. Yüksek çünkü insan operasyonu dahil.

### Mobot

Tap/swipe/drag **action** sayısı; yıllık sözleşme; tutar yok. Dış tahmin $10–50K+/ay ($120–600K+/yıl) — düşük güven. SaaS ile birebir kıyaslama.

### Açık kaynak

Lisans $0. Gerçek TCO: otomasyon mühendisi + CI + cihazlar + farm + bakım + raporlama + backend/local doğrulama → büyük kurumda kolayca **$150–500K+/yıl**.

---

## 3. Piyasa katmanları

| Katman | Bant | Örnekler |
|---|---|---|
| Self-service / küçük ekip | **$500–10K/yıl** | HeadSpin Lite/Go, Kobiton Startup/Accelerate, Autify Core/Team, BS 1 parallel, Katalon küçük |
| Mid-market AI automation | **$10–50K/yıl** | mabl, Testim, Testsigma, testRigor, ACCELQ, BS/Sauce multi-parallel, Applitools |
| Enterprise platform | **$50–200K+/yıl** | Tosca, Perfecto, Sauce/BS Enterprise, HeadSpin özel cihaz, büyük Katalon |
| Managed / fiziksel | **$60–600K+/yıl** | QA Wolf, Mobot |

---

## 4. Verdict fiyatlama sonucu

Yalnız kullanıcı veya cihaz dakikası üzerinden fiyatlama **yapma**. Tercih modeli:

```text
Platform license
+ concurrent device capacity
+ Domain Pack
+ Test Profile / certification package
+ optional private deployment
+ optional managed onboarding
```

### Nesy için ilk ticari paket (liste vs design partner)

Satır kalemleri:

```text
Enterprise Platform                $40K–$60K
Courier Domain Pack                $10K–$20K
Payment/Fiscal Resilience Pack     $15K–$25K
Dedicated onboarding/support       $15K–$25K
```

| | Liste | Design partner / bundle |
|---|---|---|
| **Year 1** | **$80K–$130K** | **$65K–$110K** contracted ACV |
| **Renewal** | **$65K–$105K** | **$50K–$90K** target |

Bundle bandı indirim, phased scope (Payment/Fiscal opsiyonel) veya pack’in platforma dahil edilmesiyle oluşur — liste fiyatıyla karıştırılmaz.  
Bağlayıcı düzeltme: [`../PRODUCT_PACKAGING_AND_LTV_REVISIONS.md`](../PRODUCT_PACKAGING_AND_LTV_REVISIONS.md) §5.

Alternatif paket isimleri (daha geniş enterprise):

| Paket | Yıllık fiyat |
|---|---|
| **Verdict Design Partner** | **$25.000–$40.000/yıl** (dar kapsamlı giriş) |
| **Verdict Enterprise Core** | **$40.000–$75.000/yıl** |
| **Resilience + Payment/Fiscal Pack** | **+$15.000–$30.000/yıl** |
| **Private deployment / dedicated support** | **+$15.000–$40.000/yıl** |

Doğru karşılaştırma **$2.388’lık device cloud değil**, **$25–100K+ enterprise kalite sözleşmeleri**.

Satılan şey:

> Cihaz erişimi değil — kritik mobil işlemin doğruluğunu ve recovery’sini kanıtlayan domain uzmanlığı.
