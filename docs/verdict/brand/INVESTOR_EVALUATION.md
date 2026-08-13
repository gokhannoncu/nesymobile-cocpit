# Verdict — Yatırımcı gözüyle dürüst değerlendirme

**Tarih:** 2026-08-12  
**Durum:** Bağlayıcı yatırımcı anlatı notu (dürüst underwriting — gerçekleşmiş finans değil).  
**Marka:** [`DOMAIN_AND_LANDING.md`](./DOMAIN_AND_LANDING.md)  
**Konum:** [`COMPETITIVE_POSITIONING.md`](./COMPETITIVE_POSITIONING.md)  
**Müşteri evreni / beachhead:** [`CUSTOMER_UNIVERSE.md`](./CUSTOMER_UNIVERSE.md)  
**Saha istihbaratı:** [`competitive-intel/README.md`](./competitive-intel/README.md)  
**Fiyat / paket:** [`competitive-intel/03-pricing.md`](./competitive-intel/03-pricing.md)  
**Paketleme / LTV düzeltmeleri (bağlayıcı):** [`PRODUCT_PACKAGING_AND_LTV_REVISIONS.md`](./PRODUCT_PACKAGING_AND_LTV_REVISIONS.md)

---

## 0. TL;DR

Verdict şu anda **çok güçlü bir teknoloji tezi**, henüz **kanıtlanmış şirket değil**.

| Ne güçlü | Ne eksik |
|---|---|
| Mimari seviyesi yüksek | Ücretli müşteri, yenileme, churn, CAC ölçülmedi |
| SDK evidence core `GO` (master plan) | Tam platform release / production rollout `NO_GO` |
| Cockpit E2E ve Bridge koşullu | Nesy pilotu + fiziksel Bridge + ilk ücretli sözleşme |

Yatırımcıya söylenecek cümle:

> **“Ürün tamamlandı” değil — “çekirdek teknoloji doğrulandı; şimdi ticari vertical slice’ı kapatıyoruz.”**

En iyi şans:

> Genel test otomasyonunda rakipleri geçmek değil; **kritik Android saha transaction’larının proof, resilience ve certification kategorisini ilk sahiplenen şirket olmak.**

Nesy bunun yalnızca müşterisi değil — **kategorinin ilk laboratuvarı**.

---

## 1. Son feature set

### 1.1 V1 ürün çekirdeği

**Deterministik mobil yürütme**

- `WorkflowIR v2`
- Maestro’dan bağımsız `BridgeFlowExecutor`
- Accessibility tabanlı fiziksel action (gerçek cihaz)
- `TargetFingerprint` + ambiguity detection
- Device command lane’leri
- Fiziksel action lifecycle (Bridge business yüklenmez):

```text
RECEIVED
→ TARGET_RESOLVED
→ GESTURE_DISPATCHED
→ GESTURE_COMPLETED
→ UI_EFFECT_OBSERVED
→ ORACLE_EVALUATED
```

**Dört katmanlı kanıt:** UI + App + Local + Remote  

Occurrence zinciri:

```text
run → iteration → occurrence → entity → request → evidence → Oracle
```

**İki aşamalı doğrulama**

| Kapı | Soru |
|---|---|
| Continue Gate | Akış güvenle devam edebilir mi? |
| Final Oracle | İşlem business olarak doğru tamamlandı mı? |

**Evidence Journey + exact reproduction**

- SDK çıkışından Oracle’a izlenebilirlik
- `NOT_OBSERVED` / `NOT_CAPTURED` / `FAILED` ayrımı
- Toplanmayan dump/artifact uydurulmaz
- Koşumdan tekrar üretilebilir profil

### 1.2 V1 Test Profile Catalog — Core vs Preview

Aynı runtime üzerinde deklaratif `TestProfile` (ayrı motor değil).

**V1 Core (10 production):** Smoke · Critical Regression · Differential Regression · Recovery · State-Aware Bad Day · Business Contract and Consistency · Load · Short Soak · Compatibility Certification · Security / Release Isolation  

**V1 Preview (2):** Basic Accessibility Preview · Smart Explorer Preview  

Smart Explorer release gate üretmez. Ayrıntı: [`PRODUCT_PACKAGING_AND_LTV_REVISIONS.md`](./PRODUCT_PACKAGING_AND_LTV_REVISIONS.md) §1.2.

### 1.3 DGX Spark — 30 günlük Intelligence Preview

**Ana (v0):** Verified Execution Memory · Structured Failure Fingerprint · Similar Run Search · Evidence-Grounded Run Analyst · Deterministic Differential Analyzer · basit performance anomaly  

**Stretch preview (ürün gibi satma):** Failure Genome Preview · Flakiness Condition Discovery · Candidate Invariant Preview · Intent-to-TestProfile Preview  

**RED:** AI asla PASS/FAIL otoritesi olmaz. Final Oracle deterministik kalır. Candidate invariant → ürün sahibi onayı zorunlu.

### 1.4 12–24 aylık deep-tech moat

Dört eksen: Temporal Proof · Recovery/Fault · Execution Memory · Physical Mobile Verification. Canvas = deneyim katmanı.

> Generative UI ürün deneyimidir; moat değildir. Moat = fiziksel eylem + zamansal business state + fault + recovery + çok katmanlı kanıt aynı tekrar üretilebilir transaction modelinde.

---

## 2. Illustrative Account Value / LTV Scenarios

**Gerçek finansal LTV değil** — underwriting / hesap büyüklüğü senaryosu. Yenileme, logo churn, expansion, CAC henüz ölçülmedi.  
Bağlayıcı düzeltmeler: [`PRODUCT_PACKAGING_AND_LTV_REVISIONS.md`](./PRODUCT_PACKAGING_AND_LTV_REVISIONS.md) §4–6.

### 2.1 Senaryolar (Revenue LTV doğrulanmış)

| Müşteri türü | İlk yıllık lisans | Onboarding | Süre | Yıllık expansion | Revenue LTV | Base-case GP LTV |
|---|---|---|---|---|---|---|
| Design Partner | $50K | $20K | 5 yıl | %8 | **$313K** | **~$252K** ($245–259K) |
| Core Enterprise | $75K | $25K | 5 yıl | %12 | **$501K** | **~$406K** ($394–417K) |
| Multi-country Strategic | $120K | $40K | 7 yıl | %15 | **$1.37M** | **~$1.12M** ($1.08–1.15M) |

Varsayım: lisans GP base **%82.5** (downside %80 / upside %85); onboarding **%50**.

### 2.2 Nesy paket — liste vs design partner

```text
Enterprise Platform                $40K–$60K
Courier Domain Pack                $10K–$20K
Payment/Fiscal Resilience Pack     $15K–$25K
Dedicated onboarding/support       $15K–$25K
```

| | Liste | Design partner / bundle |
|---|---|---|
| Year 1 | **$80K–$130K** | **$65K–$110K** contracted ACV |
| Renewal | **$65K–$105K** | **$50K–$90K** target |

Bundle bandı indirim / phased scope / pack dahil etme gerektirir — liste ile karıştırma.  
Ayrıca: [`competitive-intel/03-pricing.md`](./competitive-intel/03-pricing.md).

### 2.3 Sağlıklı SaaS hedefleri (üç seviye)

| Metrik | Minimum | Hedef | Üstün |
|---|---|---|---|
| GP LTV / CAC | >3 | >5 | >7 |
| CAC payback | <24 ay | <15 ay | <12 ay |
| Logo retention | >85% | >90% | >95% |
| NRR | >100% | >110% | >120% |
| Custom implementation | <30% | <20% | <10% |

İlk yıllarda CAC payback >15 ay başarısızlık sayılmaz; asıl mesele onboarding maliyetinin düşmesi.

**En büyük tehlike:** Her müşteride özel yazılım → SaaS zannedilen danışmanlık.

Mimari oran stratejik hedef; **LOC ile ölçülmez**. Kritik test: yeni müşteride Core PR gerekli mi? → hayır olmalı. Ölçüler: Core değişikliği %0 · yeni Bridge business command 0 · adapter effort <%10–15 · custom runtime <%5.

---

## 3. Ne kadar yatırım?

AI test / quality’de ilgi gerçek (örn. Momentic seed $3.7M → Series A $15M; benzer seed’ler ~$2.7–4.5M). Momentic’in “verification layer” dili kategoriye ilgiyi gösterir; Verdict’in **daha dar mesaj** seçmesi gerekir.

### 3.1 Gerçekçi aralıklar

| Aşama | Bant | Şartlar |
|---|---|---|
| 30 gün — yalnız çalışan demo | **$400K–$700K** pre-seed | Nesy demo; 200–500 kontrollü run; SDK+Bridge+Final Oracle; Execution Memory v0 + Failure Fingerprint v0; Evidence Journey; yatırımcı demosu. Ücretli müşteri yoksa üst sınıra çıkmak zor |
| Ücretli Nesy pilotu veya güçlü LOI | **$750K–$1.25M** pre-seed | Yazılı pilot; gerçek fiziksel cihaz; payment/fiscal/offline recovery; ölçülebilir ROI; ikinci müşteri pipeline; temiz IP/sözleşme. **Türkiye merkezli tur için en gerçekçi hedef** |
| 2–3 ücretli enterprise | **$1.5M–$3M** seed | $150–300K ARR; ikinci uygulamaya taşınabilirlik; Domain Pack onboarding süresi ölçülü; ≥2 ülke veya cihaz ailesi; 500–2.000 yapılandırılmış koşum; ilk müşteri bağımlılığı ↓; ABD/Avrupa fonu |

Exit bağlamı (haber kaynaklı, resmî exit fiyatı her zaman açıklanmaz): Testim ~$18M yatırım → $150–200M bandı; Perfecto ≈ $200M — potansiyel var, garanti değil. Ayrıntı: [`competitive-intel/02-finance-and-exits.md`](./competitive-intel/02-finance-and-exits.md).

### 3.2 Tercih edilen 30 günlük tur

> **$1M yatırım, 18 aylık runway**

| Alan | Pay |
|---|---|
| Core SDK / Bridge / Cockpit | %35 |
| Domain Pack ve onboarding | %20 |
| Resilience / reproduction | %15 |
| DGX Intelligence | %15 |
| Enterprise security / deployment | %10 |
| Satış ve hukuk | %5 |

Tur milestone:

```text
3 ücretli müşteri
$300K ARR
2 domain
5 cihaz ailesi
%70+ generic reuse
12 aydan kısa onboarding payback
```

---

## 4. Potansiyel

Automated software quality pazarı 2025’te ~$6.3B (çift haneli büyüme). Tricentis ~$500M ARR / 3.000+ müşteri; BrowserStack 50.000+ müşteri — bütçe kanıtı var.

| Senaryo | Müşteri | Ortalama ACV | Potansiyel ARR |
|---|---|---|---|
| Türkiye + Balkan nişi | 15–25 | $60–100K | **$0.9–2.5M** |
| CEE mission-critical mobile | 75–150 | $80–130K | **$6–19.5M** |
| Global category company | 300–500 | $100–200K | **$30–100M** |

Bunlar pazar TAM’ı değil — **satış senaryosu**.

Daha gerçekçi şirket sonucu:

- İyi: $5–15M ARR  
- Çok iyi: $20–50M ARR  
- Kategori lideri: $100M+ ARR  
- Erken stratejik exit potansiyeli: $100–300M bandı (garanti değil)

---

## 5. Üç yatırımcı sorusu

### 5.1 Küçük pazarda büyük pay?

**Bugün: Evet — ama “mobil test otomasyonu” pazarında değil.**

Geniş pazar (web/mobile/API/visual/cloud/no-code/AI) BrowserStack / Momentic / Tricentis ile genel araç savaşıdır — yanlış savaş.

**Domine edilecek dar pazar:**

> Türkiye, Balkanlar ve CEE’de; dedicated Android cihaz, offline queue, scanner, printer, POS veya fiscal kullanan mission-critical courier ve field-delivery uygulamaları.

Filtre:

```text
Android saha uygulaması
+ kritik iş transaction’ı
+ offline çalışma
+ fiziksel peripheral
+ backend reconciliation
+ ülke / fiscal farklılığı
+ yüzlerce veya binlerce günlük işlem
```

Beachhead: genel TAM slaytı değil — **40–60 named account**.

24 aylık domination ölçütleri:

```text
10 ücretli müşteri
3 ülke
4 cihaz / peripheral ailesi
20+ certified transaction profile
%70 Domain Pack reuse
$800K–$1.5M ARR
```

10 müşterilik segmentte 3–4 müşteri = görünür liderlik. 50’de 10 = %20 pay.

**Pazarı kapatacak fikirler**

1. **Courier Certification Pack** — normal/COD/card/fiscal/multicolli/pickup/offline/queue flush/process death/duplicate callback/scanner-printer recovery/country rules  
2. **Verdict Certified** — sürüm başına sertifika (`RS / Datecs / COD / Offline Recovery · Build 7.2.4`) → release risk sertifikasyonu  
3. **Device-vendor ortaklığı** — Datecs, Urovo, Zebra, POS, fiscal → satış kanalını cihaz üreticilerine taşı  

**Açık:** Nesy tek başına hakimiyet kanıtı değil. Gerekli: (1) Courier Pack ikinci lojistik app’te, (2) onboarding &lt; 4 hafta, (3) custom kod &lt; %20, (4) ilk ücretli sözleşme.

| Bugün | Hedef |
|---|---|
| **7/10** | İkinci lojistik müşteri → **9/10** |

---

### 5.2 20 yıl içinde sektörde fark?

**Bugün: Mevcut feature listesiyle hayır. Mevcut mimari yönüyle evet.**

Kopyalanabilir: AI gen, generative UI, self-heal, test memory, failure summary, device control, network logs, visual. Momentic NL + “verification layer” kullanıyor; Android’de şu an emu (gerçek cihaz yok — kapatılabilir).

20 yıllık avantaj feature’dan değil — **biriken sistemden**.

**Beş kalıcı moat**

1. **Mobile Transaction Proof Protocol** — intent → occurrence → action/app/local/peripheral/remote → temporal obligations → proof. Protokol açık olabilir; compiler/verifier/memory/enterprise runtime proprietary. Hedef: standardı Verdict tanımlasın.  
2. **Verified Failure Genome ağı** — anonim: cihaz, firmware, transaction, fault, zaman, recovery, min reproducer → doğrulanmış failure knowledge graph (log/sohbet değil).  
3. **Domain Pack + certification ekosistemi** — Courier, Mobile POS, Warehouse, Field Service, Banking, Healthcare; partner pack + Verdict imza.  
4. **Peripheral / firmware knowledge** — Datecs, Zebra, Urovo, BT POS, fiscal, OEM Android, doze, clock drift, scanner duplicate… BrowserStack erişim verir; Verdict “bu firmware altında transaction doğru bitti mi”yi bilir.  
5. **Güven ve tarihsel baseline** — 5 yıllık transaction perf, recovery, drift, genome, release risk, certified builds → switching cost.

**Yol**

```text
0–2 yıl:   Courier + mobile POS transaction assurance
2–5 yıl:   Warehouse, retail, field service, fintech
5–10 yıl:  Certification standardı + partner ekosistemi
10–20 yıl: Mission-critical mobile için transaction proof infrastructure
```

**Açık:** Açık spec, certification markası, second-domain proof, partner ekosistem, büyük failure dataset yok → “üç ayda kopyalar” riski.

| Bugün | Hedef |
|---|---|
| **6.5/10** | Protocol + certification + data moat → **9/10** |

---

### 5.3 Kimsenin görmediği fırsat?

**En güçlü cevap. Bugün 8.5/10; silent-failure demosuyla 10/10.**

> Mobil test endüstrisi problemi çoğunlukla ekrana doğru tıklama sanıyor. Asıl gözden kaçan: kesintili bağlantı ve fiziksel cihazlar üzerinde dağıtık **transaction tutarlılığı**.

```text
UI             SUCCESS
App event      PAYMENT_COMPLETED
Local DB       DELIVERY_MISSING
Offline queue  EMPTY
Backend        PAYMENT_COMPLETED
→ klasik UI testi: PASS
→ Verdict: FAIL_LOCAL / ZOMBIE_PAYMENT / RETRY MUST BE BLOCKED
```

Teknik gerçek: Android process death; offline-first çoklu veri kaynağı → UI/local/remote ayrışması doğal risk (Android Developers). Uber 2026 chaos: 47 kritik akışta 180K+ test, 23 resilience risk (12 kritik; 2 yalnız chaos’ta yakalanan crash) — problem teorik değil (arXiv).

**Kategori adı:** Mobile Transaction Assurance · daha derin: **Proof-Carrying Mobile Resilience**

**Contrarian truth (yatırımcı):**

> Herkes test otomasyonunun locator ve test yazma problemi olduğunu düşünüyor. Kritik saha uygulamalarında yanlış problem bu. Gerçek kayıp: UI başarılı görünürken ödeme, teslimat, fiscal, cihaz-local state ve backend’in farklı gerçekliklerde kalması. Verdict bu transaction’ı uçtan uca kanıtlar.

**Üründe görünür kılmak — dört özellik**

| Parça | İçerik |
|---|---|
| Transaction Proof ID | `TX-PROOF-9F28` — user/Bridge/app/local/peripheral/remote/recovery/Oracle/artifact hashes |
| Proof Bundle | `transaction-proof.json` + evidence-manifest + oracle-result + artifacts/ + signature.sig |
| Recovery Certificate | örn. PROCESS_KILL after PAYMENT_COMPLETED → 9/10 recovery, 0 duplicate payment / orphan fiscal / missing delivery |
| Minimum Counterexample | Datecs · RS · COD · 2 parcels · Process kill + 470 ms |

Bu dörtlü soyut fırsatı yeni ürün kategorisine çevirir.

---

## 6. Rakip avantajı — son hali

| Onlar | Verdict |
|---|---|
| Momentic — AI authoring/bakım | |
| BrowserStack — cihaz scale | |
| Tricentis — enterprise breadth | |
| Sauce — cloud + diagnostics | |
| Applitools — visual AI | |
| HeadSpin — performance | |
| Mobot — fiziksel robot | |
| | **Test adımı çalıştı mı?** vs **İşlem doğru sonuçlandı mı, arıza altında recover oldu mu, hata yeniden üretilebilir mi?** |

“Verification layer” tek başına kullanma — Momentic resmi kullanıyor.

Savunulabilir konum:

> **Verdict is the proof-carrying resilience runtime for mission-critical Android field transactions.**

> **Verdict, kritik Android saha işlemleri için kanıt taşıyan doğrulama ve dayanıklılık runtime’ıdır.**

---

## 7. Güncel puan kartı

| Alan | Bugün | 30 gün hedef |
|---|---|---|
| Teknoloji mimarisi | **9.2** | 9.4 |
| Uygulanmış ürün | **6.5** | 7.8 |
| Özgünlük | **8.5** | 9.0 |
| Güncel teknik moat | **5.5** | 7.0 |
| Uzun dönem moat potansiyeli | **9.0** | 9.2 |
| Rakip karşısı konum | **7.5** | 8.5 |
| Ticari doğrulama | **3.5** | 6.5 |
| Yatırım yapılabilirlik | **6.5** | 8.0 |
| Global şirket potansiyeli | **9.0** | 9.0 |

En zayıf taraf teknoloji değil:

> **Ücretli müşteri, tekrar edilebilir onboarding ve ikinci uygulama kanıtı.**

---

## 8. Üç cevap — hazır metin

### Küçük pazarı domine?

> Evet. İlk pazarımız genel mobil test değil; Türkiye ve CEE’de dedicated Android cihaz, offline queue, scanner, POS ve fiscal kullanan courier ve field-delivery uygulamalarıdır. Bu pazarı named-account yaklaşımıyla kapatacağız. Hedefimiz 24 ayda 10 ücretli müşteri, üç ülke ve dört cihaz ailesinde standartlaşmış Courier Certification Pack oluşturmaktır.

### 20 yıl fark?

> Tek tek özelliklerimiz kopyalanabilir. Kopyalanması zor olan: yıllar içinde birikecek doğrulanmış Failure Genome, cihaz/firmware davranış bilgisi, Domain Pack ekosistemi ve Mobile Transaction Proof Protocol. Hedefimiz bir test aracından çok, kritik mobil transaction’ların doğrulama standardı olmaktır.

### Kimsenin görmediği fırsat?

> Pazar mobil QA’yı çoğunlukla ekrana doğru tıklama problemi olarak görüyor. Kritik saha uygulamalarındaki gerçek risk, UI başarılı görünürken cihaz-local state, ödeme, fiscal, offline queue ve backend’in farklı gerçekliklerde kalmasıdır. Verdict her transaction için bu katmanları aynı occurrence altında kanıtlıyor, arızayı tam business boundary’de uyguluyor ve hatayı minimum yeniden üretilebilir karşı örneğe indiriyor.

---

## 9. Nihai hüküm

> **Genel test otomasyonunda rakipleri geçmek değil; kritik Android saha transaction’larının proof, resilience ve certification kategorisini ilk sahiplenen şirket olmak.**

Nesy = kategorinin **ilk laboratuvarı**.

---

## 10. Yatırımcı sunum checklist

| OK | YASAK |
|---|---|
| “Çekirdek doğrulandı; vertical slice kapanıyor” | “Ürün tamam / production GO” |
| Mobile Transaction Assurance / Proof-Carrying Resilience | “Verification layer” (Momentic çakışması) |
| Named-account beachhead + Certification Pack | Genel “mobil test pazarı lideri” |
| LTV/CAC hedefleri underwriting olarak etiketlenmiş | Gerçekleşmiş LTV gibi sunmak |
| Pilot ROI + ikinci app + custom &lt; %20 | Nesy tek referansla pazar hakimiyeti iddiası |
| AI = analyst; Oracle = deterministic | AI PASS/FAIL otoritesi |
