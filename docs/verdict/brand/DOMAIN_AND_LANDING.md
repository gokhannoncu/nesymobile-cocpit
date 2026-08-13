# Verdict — Domain seçimi ve ilk landing odağı

**Tarih:** 2026-08-12  
**Durum:** Stratejik karar notu (marka adresi + ilk kamu yüzü).  
**Bağlam:** Yüksek hacimli B2B operasyonlara teknik altyapı ve danışmanlık; hedef alıcı CTO / C-Level; ürün vizyonu “test aracı” değil **otonom Kalite İşletim Sistemi**.  
**İlgili teknik anlatım:** [`../SISTEM_NASIL_CALISIR.md`](../SISTEM_NASIL_CALISIR.md) · [`../CONDITION_ENGINE_AND_BRIDGEFLOW.md`](../CONDITION_ENGINE_AND_BRIDGEFLOW.md)  
**Rekabet / konumlandırma:** [`COMPETITIVE_POSITIONING.md`](./COMPETITIVE_POSITIONING.md) · [`competitive-intel/README.md`](./competitive-intel/README.md)  
**Yatırımcı değerlendirme:** [`INVESTOR_EVALUATION.md`](./INVESTOR_EVALUATION.md) · [`PRODUCT_PACKAGING_AND_LTV_REVISIONS.md`](./PRODUCT_PACKAGING_AND_LTV_REVISIONS.md)  
**Müşteri evreni / beachhead:** [`CUSTOMER_UNIVERSE.md`](./CUSTOMER_UNIVERSE.md)

---

## 0. TL;DR

| Karar | Seçim |
|---|---|
| Birincil kamu domaini | **`verdictlabs.com`** |
| `verdict.build` rolü | İkincil / mühendis yüzü (docs, status, redirect veya alt marka) — birincil satış adresi değil |
| İlk landing hero odağı | **Kurumsal sonuç:** Sıfır sessiz regresyon / Kalite İşletim Sistemi |
| Mimari (SDK + Bridge + Cockpit) | Hero’da değil; **ikinci katmanda kanıt** |

---

## 1. İki domainin psikolojik ağırlığı

İkisi de vizyoner ve “premium” okunabilir; masaya koydukları **güven türü** ve **hedef kitle** farklıdır.

### 1.1 `verdictlabs.com` — kurumsal, Ar-Ge, Deep Tech

Silikon Vadisi’nde “Labs” takısı tek bir yazılımı değil; arkasında sürekli araştırma, kaos mühendisliği ve inovasyon yapan bir **kurumu** çağırır (algı referansları: OpenAI Labs, çeşitli kurumsal R&D lab’leri — isim benzerliği iddiası değil, kategorik sinyal).

| Boyut | Etki |
|---|---|
| Alıcı hissi | “Araç” değil; arkasında ciddi mühendislik takımı olan bir **platform / kurum** |
| Yatırımcı | “Self-Learning Oracle”, ajanlar, otonom yargı gibi iddialı vizyonlar Labs çatısı altında daha organik |
| Kurumsal satış | Aras Kargo, Delivery Hero vb. masasında anında **Vendor Trust** ağırlığı |

**Uyum:** Vizyon “Kalite İşletim Sistemi” ise birincil adres kurumsal ve deep-tech sinyali vermelidir. `verdictlabs.com` bu sinyalle hizalanır.

### 1.2 `verdict.build` — agresif, eylem, geliştirici

Doğrudan yazılım üretim döngüsüne (CI/CD, derleme, sürüm) bağlanır.

| Boyut | Etki |
|---|---|
| Avantaj | Modern, dinamik; DevOps / QA eylem diline yakın |
| Risk | Bottom-up, “açık kaynak tool” veya bireysel geliştirici aracı hissi |
| C-Level okuma | Pahalı bir işletim sistemi / vendor’dan çok teknik bir yardımcı araç |

**Uyum:** Mühendis onboarding, docs, changelog, status page için güçlü; **birincil kurumsal satış ve yatırımcı adresi** olarak zayıf.

---

## 2. Değerlendirme — hüküm neden `verdictlabs.com`

Analizdeki ayrım doğru ve savunulabilir:

1. **Satış birimi farklı.** B2B’de fatura ve risk CTO / operasyon / kalite liderliğinde kapanır. Onların ilk 5 saniyesi “bu bir tool mu, bir kurum mu?” sorusudur. Labs bu soruyu kurum lehine cevaplar; `.build` tool lehine çeker.
2. **Vizyon–URL uyumu.** “Otonom Kalite İşletim Sistemi” + gelecek iddiaları (oracle, ajan, self-learning) Labs kategorisinde tutarlıdır. Aynı iddiayı `.build` üzerinde taşımak abartılı veya uyumsuz okunabilir.
3. **Vendor Trust maliyeti.** Büyük lojistik / delivery oyuncularında güvenlik, süreklilik ve Ar-Ge kapasitesi algısı fiyat kadar önemlidir. Domain bu algının ilk pikselidir.
4. **`.build` yok sayılmaz — ikincil kalır.** Teknik kitleyi kaybetmemek için `verdict.build` → docs / developers / status redirect veya “Engineers” alt yüzeyi olarak saklanabilir; birincil marka ve e-posta kimliği `verdictlabs.com` olmalıdır (`hello@`, `security@`, sözleşme PDF’leri).

**Nihai hüküm:** Birincil tescil ve kamu yüzü **`verdictlabs.com`**.  
`verdict.build` elde tutulursa stratejik yedek / mühendis kapısı; rakip birincil marka değil.

---

## 3. İlk landing — vizyon mu, mimari mi?

Soru:

> Odağı kurumsal “Sıfır Hata / Regresyon” vizyonuna mı çekelim, yoksa doğrudan mimarinin teknik gücünü (SDK + Bridge) mi öne çıkaralım?

### 3.1 Karar: Hero = kurumsal sonuç; kanıt katmanı = mimari

| Katman | İçerik | Kime konuşur |
|---|---|---|
| **1. Hero (ilk viewport)** | Kalite İşletim Sistemi · sessiz regresyonun bitişi · üretim gerçeğine dayanan yargı | CEO / CTO / Head of Quality |
| **2. Kanıt (scroll)** | Üç oyuncu: Cockpit (beyin) · SDK (sinirler) · Bridge (göz + parmak) — karar Cockpit’te | Meraklı CTO / mimar |
| **3. Güven** | Domain pack, oracle, evidence — “neden Maestro-script değil OS” | Teknik alıcı + risk |
| **4. CTA** | Demo / pilot / contact — tool signup değil kurumsal konuşma | Satış |

**Neden bu sıra**

- Domain seçimi Labs ise landing’in ilk cümlesi yine **kurum + sonuç** olmalıdır. Hero’yu SDK/Bridge jargonuna vermek, az önce kazandığımız Vendor Trust’ı “yine bir test framework’ü”ne indirger.
- C-Level “tap/dump/waitEvent” satın almaz; **üretimde sessiz kırılmanın görünür ve yargılanabilir olmasını** satın alır. Mimari, o vaadin teknik olarak nasıl tutulduğunun kanıtıdır — vaadin kendisi değil.
- Teknik güç gizlenmez: ikinci katmanda net diyagram + üç oyuncu kuralı (`Bridge karar vermez · SDK dokunmaz · Kararı Cockpit verir`). Bu, SISTEM_NASIL_CALISIR anlatımıyla aynı omurgadır; kamu yüzüne sadeleştirilir.
- “Sıfır hata” mutlak iddia olarak risklidir. Tercih dil: **sıfır sessiz regresyon** / **kanıtsız yeşil yok** / **her adımda yargı**. Absolut “zero bugs” yerine ölçülebilir kalite işletim vaadi.

### 3.2 Hero’da kaçınılacaklar

- İlk viewport’ta API, paket adı, Maestro karşılaştırması, CI badge duvarı
- “Developer tool” / “for QA engineers” birincil hitap (ikincil sayfada olur)
- Mor gradient / generic AI SaaS kalıbı — Labs ciddiyeti ile çelişir
- Mimariyi hero’nun tek görseli yapmak (diyagram kanıt katmanına)

### 3.3 Önerilen mesaj iskeleti (landing v1)

```text
Verdict Labs
Kalite İşletim Sistemi — üretim gerçeğine dayanan yargı.

Mobil operasyonlarınızda “test geçti” ile “iş doğru bitti”
aynı cümle olsun. Sessiz regresyon görünür; her adım kanıt ister.

[ Kurumsal demo ]   [ Mimariyi gör ]
```

Altında kısa üç sütun (Cockpit / SDK / Bridge) — tıklanınca teknik derin sayfa veya anchor.

---

## 4. Domain sonrası operasyonel checklist

| Madde | Not |
|---|---|
| `verdictlabs.com` tescil + DNS | Birincil |
| `verdict.build` (opsiyonel) | Docs/developers redirect veya park |
| E-posta / sözleşme kimliği | `@verdictlabs.com` |
| İlk landing | §3 iskeleti; hero = sonuç, scroll = mimari |
| Teknik deep-link | Mevcut iç dokümanlar (`SISTEM_NASIL_CALISIR`, BridgeFlow planı) kamu diline sadeleştirilerek §2–3’e beslenir — kod path’leri landing’e taşınmaz |

---

## 5. Tek cümlelik özet

> **Adres Labs, vaat işletim sistemi, kanıt mimari.**  
> `verdictlabs.com` birincil markadır; ilk sayfa “SDK + Bridge” satmaz — sessiz regresyonun bittiği Kalite İşletim Sistemi’ni satar; SDK + Bridge o vaadi inandıran ikinci katmandır.
