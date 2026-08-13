# Verdict — Rekabet saha istihbaratı (indeks)

**Kesim tarihi:** 2026-08-02 (kamuya açık resmî ürün sayfaları + dokümantasyon)  
**Derleme:** 2026-08-12  
**Durum:** Araştırma envanteri — satış / yatırım dili için kaynak; iddia üretmeden önce [`../COMPETITIVE_POSITIONING.md`](../COMPETITIVE_POSITIONING.md) ile çapraz oku.  
**Marka:** [`../DOMAIN_AND_LANDING.md`](../DOMAIN_AND_LANDING.md)  
**Yatırımcı değerlendirme:** [`../INVESTOR_EVALUATION.md`](../INVESTOR_EVALUATION.md)

---

## 0. Metodoloji ve sınırlar

Bu envanter **satın alınabilir veya kamuya duyurulmuş ürün yüzeyini** kapsar.

| Dahil | Hariç |
|---|---|
| Resmî ürün sayfası / docs | Enterprise sözleşmeye gömülü özellikler |
| Kamuya duyurulmuş beta (açıkça yazılmışsa) | Satış demosunda gösterilip dokümante edilmeyen özellikler |
| Haber + üçüncü taraf finans/fiyat (etiketli) | “Şirket içindeki her özellik” iddiası |

**Monogram** dahil edilmedi — ürün tasarımı referansı olabilir; test otomasyonu rakibi değil.

Güven etiketleri (finans / fiyat):

| Etiket | Anlam |
|---|---|
| **Resmî** | Şirketin kendi açıklaması veya finansal belge |
| **Haber** | Reuters, TechCrunch vb. |
| **Tahmin** | Sacra, Latka, ZoomInfo, Growjo, satın alma platformları |

---

## 1. Dosya haritası

| Dosya | İçerik |
|---|---|
| [`01-feature-inventory.md`](./01-feature-inventory.md) | 18 oyuncu: özellik envanteri, Verdict açığı, white-space, tehdit sırası, sahiplenilecek 8 alan |
| [`02-finance-and-exits.md`](./02-finance-and-exits.md) | Yatırım, müşteri ölçeği, ARR/gelir, exit’ler, Verdict için emsaller |
| [`03-pricing.md`](./03-pricing.md) | Yıllık fiyat katmanları, rakip paketleri, Verdict paket önerisi |

---

## 2. TL;DR — üç hüküm

### Konum (özellik)

Rakipler test üretir, stabil çalıştırır ve başarısızlığı analiz eder. Verdict’in white-space’i:

```text
Semantic business intent
→ typed temporal obligation
→ physical mobile action
→ app-internal evidence
→ local persistence/queue evidence
→ remote business evidence
→ exact business-state fault injection
→ recovery correctness verdict
→ proof-carrying run
→ automatic minimal reproducer
```

Table stakes (doğal dil, self-heal, device cloud, video, HAR, Visual AI…) **benzersiz moat diye satılmaz** — ayrıntı: `01-feature-inventory.md` § table stakes.

### Finans

İlk yıllar için emsal: Momentic, Testim, Kobiton, Autify, Mobot, Testsigma, QA Wolf — **Tricentis / BrowserStack değil**.  
En iyi erken exit örneği: Testim. En iyi bağımsız ölçek: BrowserStack. En önemli kötü örnek: HeadSpin (dürüst metrik).

### Fiyat

Verdict’i `$2.388/yıl` device-cloud parallel ile kıyaslama. Doğru bant: enterprise kalite sözleşmeleri **`$25.000–$100.000/yıl`**.  
Nesy tam paket önerisi: **`$50.000–$90.000/yıl`** — ayrıntı: `03-pricing.md`.

---

## 3. Rakip kümeleri (özet)

| Kategori | Başlıca oyuncular |
|---|---|
| AI-native authoring | Momentic, mabl, Autify/Aximo, testRigor |
| Low-code / enterprise | Tricentis Tosca, Testim Mobile, Katalon, Testsigma, ACCELQ |
| Gerçek cihaz / altyapı | BrowserStack, Sauce Labs, Kobiton, Perfecto |
| Mobil performans | HeadSpin |
| Görsel doğrulama | Applitools |
| Managed hizmet | QA Wolf |
| Fiziksel robot | Mobot |
| Yap-kendin | Appium, Maestro, Espresso, XCUITest + kurum içi |

---

## 4. Tehdit sırası (özellik araştırması — 2026-08-02)

| Sıra | Rakip | Neden |
|---|---|---|
| 1 | BrowserStack | Gerçek cihaz + AI ajanlar + a11y + diagnostics |
| 2 | Sauce Labs | Real device + AI authoring/insights + production feedback |
| 3 | Tricentis Tosca | Enterprise breadth, API/DB/business process |
| 4 | Momentic | AI-native authoring, mobile agent, healing, app graph |
| 5 | Kobiton | Mobile-first AI + gerçek cihaz + Appium generation |
| 6 | Perfecto | Enterprise mobile cloud + AI + visual/semantic |
| 7 | Testim Mobile | Rich hierarchy, resilient locator, mobile low-code |
| 8 | mabl | Unified web/mobile/API + agentic workflow |
| 9 | HeadSpin | Performance + real-world device intelligence |
| 10 | Autify/Aximo | Otonom görsel test ajanı |
| 11 | Katalon | Uygun maliyet, geniş platform |
| 12 | Testsigma | Agentic no-code + gerçek cihaz |
| 13 | QA Wolf | Managed service (sonuç satışı) |
| 14 | ACCELQ | Enterprise no-code + API/backend |
| 15 | testRigor | Plain-English standardı |
| 16 | Applitools | Visual AI liderliği |
| 17 | Mobot | Fiziksel robot / donanım |
| — | Kurum içi stack | En kontrol edilebilir alternatif |

> Not: [`../COMPETITIVE_POSITIONING.md`](../COMPETITIVE_POSITIONING.md) stratejik tehditte Tosca/Katalon/glue’yu öne alır; bu sıra **kamuya açık özellik yüzeyinin genişliğine** göre. İkisi çelişmez — farklı sorulara cevap verir.

---

## 5. Sahiplenilecek 8 alan

1. Proof-Carrying Mobile Transaction  
2. UI / App / Local / Remote occurrence correlation  
3. Typed Temporal Business Oracle  
4. Business-state synchronized fault injection  
5. Offline ve eventual-consistency recovery lattice  
6. Peripheral hardware-in-the-loop  
7. Failure Genome ve automatic minimal reproducer  
8. Evidence-generated investigation workspace  

**Tek cümle:**

> Rakipler testleri üretir, stabil çalıştırır ve neyin başarısız olduğunu analiz eder. Verdict kritik mobil işlemin cihaz ve backend boyunca gerçekten doğru sonuçlandığını kanıtlar, işlemi tam risk sınırında bozar ve hatayı yeniden üretilebilir bir karşı örneğe dönüştürür.
