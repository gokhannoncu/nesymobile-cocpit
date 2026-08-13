# Verdict — Ürün paketleme ve LTV düzeltmeleri (bağlayıcı)

**Tarih:** 2026-08-12  
**Durum:** [`INVESTOR_EVALUATION.md`](./INVESTOR_EVALUATION.md) üzerine **son değerlendirme / düzeltme**. Yatırımcı veya master plana “son feature set” konmadan önce bu not uygulanır.  
**Fiyat:** [`competitive-intel/03-pricing.md`](./competitive-intel/03-pricing.md)

---

## 0. TL;DR — dört zorunlu düzeltme

| # | Düzeltme |
|---|---|
| 1 | **V1 Core** ile **V1 Preview** ayrılmalı |
| 2 | 30 günlük intelligence = kontrollü **preview**, “tam ürün” değil |
| 3 | LTV = **Illustrative Account Value / LTV Scenarios** — gerçek finansal LTV değil |
| 4 | Nesy fiyatı: **liste** ($80–130K Y1) vs **design-partner / bundle** ($65–110K Y1) ayrılmalı |

**Puan (düzeltmeler sonrası):** Feature stratejisi **9.4/10** · LTV underwriting başlangıcı **8.3/10**

En doğru ticari-teknik cümle:

> **Verdict önce kanıt üreten deterministic mobil doğrulama altyapısını satar; intelligence bu güvenilir execution memory’nin üzerinde büyür.**

---

## 1. Feature set değerlendirmesi

### 1.1 V1 Core — doğru ve master planla uyumlu

```text
WorkflowIR v2
BridgeFlowExecutor
Accessibility Bridge
TargetFingerprint
Action lifecycle
Occurrence correlation
Continue Gate
Final Oracle
Evidence Journey
Exact reproduction
```

Master plan: Domain Pack → generic WorkflowIR → BridgeFlowPlan; Bridge/SDK/local/remote aynı occurrence altında; Core’a `STOP` / `PARCEL` / `MATCH` sızmaz.

**Lifecycle düzeltmesi:** `EFFECT_VERIFIED` tek aşama Bridge’e business yükler. Ayrım:

| Etki | Örnek | Sahip |
|---|---|---|
| Fiziksel / UI | Butona basıldı | Bridge |
| Business | Payment kaydı oluştu | Final Oracle |

**Önerilen lifecycle (bağlayıcı):**

```text
RECEIVED
→ TARGET_RESOLVED
→ GESTURE_DISPATCHED
→ GESTURE_COMPLETED
→ UI_EFFECT_OBSERVED
→ ORACLE_EVALUATED
```

(Alternatif etiket: `PHYSICAL_EFFECT_VERIFIED` vs `BUSINESS_EFFECT_VERIFIED` — Oracle adımı business tarafındadır.)

### 1.2 Test Profile Catalog — 10 Core + 2 Preview

**V1 Core Profiles (bağlayıcı, production):**

1. Smoke  
2. Critical Regression  
3. Differential Regression  
4. Recovery  
5. State-Aware Bad Day  
6. Business Contract and Consistency  
7. Load  
8. Short Soak  
9. Compatibility Certification  
10. Security / Release Isolation  

**V1 Preview Profiles (aynı olgunlukta değil):**

- Basic Accessibility Preview  
- Smart Explorer Preview  

Smart Explorer release gate üretmez; deterministic runtime’ın yerine geçmez. Ayrım yapılmazsa müşteri tam otonom keşif + release kararı bekler.

```text
Verdict V1 Core Profiles
├── (10 production profiles)
Verdict V1 Preview Profiles
├── Basic Accessibility Preview
└── Smart Explorer Preview
```

---

## 2. DGX Spark — 30 günlük intelligence

Yön doğru; sekiz özelliğin tamamını bir ayda **üretim kalitesinde** sunmak gerçekçi değil.

### 2.1 Bir ay — gerçekçi ana çıktılar

| Çıktı | Not |
|---|---|
| **Verified Execution Memory v0** | Build, Device, Workflow, Domain Pack, Dataset, Fault, Occurrence, Evidence, Oracle, Reproduction metadata — model öncesi veri omurgası |
| **Structured Failure Fingerprint v0** | Henüz “tam Failure Genome” değil — boundary, fault, ui/app/local/remote/queue outcome |
| **Similar Run Search v0** | İlk sürüm embedding zorunlu değil; yapılandırılmış ağırlıklı benzerlik daha açıklanabilir |
| **Evidence-Grounded Run Analyst v0** | Her claim: evidence refs, confidence, missing, alternative, suggested experiment |
| **Deterministic Differential Analyzer** | AI değil — fact/oracle/latency/memory/applicability/boundary diff; AI yalnız açıklar |
| **Basit performance anomaly** | Device+workflow+dataset+build → median, p95, slope, baseline sapması |

### 2.2 Stretch — demo / research preview adları

Flakiness condition discovery · Candidate invariant miner · Intent-to-TestProfile · Failure Genome clustering · benzerlik kalibrasyonu  

Sunum adı:

```text
Failure Genome Preview
Candidate Invariant Preview
Intent-to-TestProfile Preview
```

**RED — candidate invariant miner:** `PAYMENT_COMPLETED → DELIVERY_PERSISTED` gözlemi kural önerisi olabilir; gerçek invariant mı tesadüfi korelasyon mu → ürün sahibi onayı zorunlu.

**RED:** AI asla PASS/FAIL otoritesi değil.

---

## 3. 12–24 aylık moat — dört eksen

> Generative UI ürün deneyimidir; asıl moat değildir.

| Eksen | Bileşenler |
|---|---|
| **Temporal Proof Engine** | Proof-Carrying Runs · Temporal Business Spec Language · Oracle Mutation Lab · Change-to-Transaction Impact Graph |
| **Recovery and Fault Engine** | Recovery Correctness Lattice · State-Synchronized Fault Injection · Autonomous Counterexample · Automatic Minimal Reproducer |
| **Execution Memory** | Verified Execution Memory · Failure Genome · Cross-build historical · Flakiness condition discovery |
| **Physical Mobile Verification** | Accessibility Bridge · Peripheral HIL · Device/firmware/country certification · Payment/fiscal/printer/scanner |

`Evidence-generated Verdict Canvas` = bu teknolojileri açan deneyim katmanı.

Savunulabilirlik cümlesi:

> **Verdict’in moat’ı test üretmesi değil; fiziksel mobil eylem, zamansal business state, fault, recovery ve çok katmanlı kanıtı aynı tekrar üretilebilir transaction modeli içinde birleştirmesidir.**

---

## 4. LTV — matematik doğrulandı; terminoloji düzeltilmeli

### 4.1 Revenue LTV (doğrulanan)

Model: Onboarding + Yıl 1 lisans + expansion uygulanmış sonraki yıllar.

| Müşteri | Revenue LTV |
|---|---|
| Design Partner | **$313,330** → **$313K** |
| Core Enterprise | **$501,464** → **$501K** |
| Multi-country Strategic | **$1,368,016** → **$1.37M** |

### 4.2 Brüt kâr LTV — marj standardizasyonu

Önceki tabloda lisans marjı satır satır farklı görünüyordu (%80 / %82 / %85) — band içinde ama tek tabloda tutarsız.

**Standart varsayım:**

```text
Base case license GP margin: %82.5
Downside: %80
Upside: %85
Onboarding GP margin: %50
```

| Müşteri | Brüt kâr LTV aralığı | Base-case GP LTV |
|---|---|---|
| Design Partner | **$245K–$259K** | **~$252K** |
| Core Enterprise | **$394K–$417K** | **~$406K** |
| Multi-country Strategic | **$1.08M–$1.15M** | **~$1.12M** |

### 4.3 Sunum başlığı (zorunlu)

> **Illustrative Account Value / LTV Scenarios**

Sabit varsayımlar (açıkça söyle): 5 veya 7 yıl kalış · yıllık expansion · logo churn yok · expansion ihtimali ayrı model değil · discount rate yok · device lab/support/CS marj içinde genellenmiş.

İleride gerçek LTV girdileri: annual renewal probability · logo churn · expansion/contraction probability · discount rate · support · device COGS · CS · Domain Pack maintenance.

Şu anki model = hesap büyüklüğü potansiyeli; retention ölçülmeden **gerçek LTV iddiası yok**.

---

## 5. Nesy paket — matematik düzeltmesi

Liste satırları:

```text
Enterprise Platform                $40K–$60K
Courier Domain Pack                $10K–$20K
Payment/Fiscal Resilience Pack     $15K–$25K
Dedicated onboarding/support       $15K–$25K
```

| | Liste (toplam) | Onboarding hariç renewal |
|---|---|---|
| Min | 40+10+15+15 = **$80K** | 40+10+15 = **$65K** |
| Max | 60+20+25+25 = **$130K** | 60+20+25 = **$105K** |

**Bağlayıcı sunum:**

```text
Liste fiyatı
  Year 1:   $80K–$130K
  Renewal:  $65K–$105K

Design partner / bundle hedefi
  Year 1 contracted ACV: $65K–$110K
  Renewal target:        $50K–$90K
```

`$65–110K / $50–90K` yalnız indirim, phased scope (Payment/Fiscal opsiyonel), Domain Pack’in platforma dahil edilmesi veya design-partner indirimi ile mümkün — aksi halde liste ile çelişir.

---

## 6. SaaS metrikleri — üç seviye

| Metrik | Minimum sağlıklı | Hedef | Üstün |
|---|---|---|---|
| GP LTV / CAC | >3 | >5 | >7 |
| CAC payback | <24 ay | <15 ay | <12 ay |
| Logo retention | >85% | >90% | >95% |
| NRR | >100% | >110% | >120% |
| Custom implementation | <30% | <20% | <10% |

İlk yıllarda enterprise satış / pilot / güvenlik / cihaz nedeniyle CAC payback >15 ay **başarısızlık sayılmaz**. Asıl mesele: her yeni müşteride onboarding maliyetinin düşmesi.

---

## 7. Core / Pack / Adapter oranı — LOC ile ölçme

Hedef oran stratejik olarak doğru (%70–80 / %15–20 / %5–10) ama **LOC üzerinden ölçülmez** (deklaratif pack uzun olabilir, mühendislik ihtiyacı düşük).

Daha iyi ölçüler:

```text
Yeni müşteri için Core değişikliği: %0
Yeni executor/compiler branch: 0
Yeni Bridge business command: 0
Mevcut capability ile tanımlanan node oranı: >%80
Customer adapter engineering effort: <%10–15
Custom runtime code: <%5
Onboarding süresinin her müşteriyle azalması
```

**Kritik ürünleşme testi:**

> Yeni müşteri geldiğinde Core PR’ı açmak zorunda kalıyor muyuz?

Sık “evet” → SaaS değil, müşteri projeleri üzerinde büyüyen platform danışmanlığı.

---

## 8. Revize ürün katmanları (özet)

| Katman | İçerik |
|---|---|
| **V1 Binding Core** | Deterministic execution · WorkflowIR v2 · BridgeFlow · Four-plane evidence · Continue Gate · Final Oracle · Evidence Journey · Reproduction · Domain Pack · Test Profile / Campaign |
| **V1 Core Profile Catalog** | 10 production profiles |
| **V1 Preview** | Basic Accessibility · Smart Explorer |
| **30-Day Intelligence Preview** | Execution Memory v0 · Failure Fingerprint v0 · Similar Runs v0 · Grounded Run Analyst v0 · Deterministic Differential Analyzer · Performance Anomaly v0 |
| **Stretch Research Preview** | Failure Genome · Flakiness Condition Discovery · Candidate Invariant Miner · Intent-to-TestProfile |
| **12–24 Month Moat** | Temporal proof · Recovery correctness · State-synchronized faulting · Counterexample synthesis · Minimal reproduction · Execution memory · HIL · Impact graph |

---

## 9. Nihai karar

Düzeltmelerden sonra:

- V1 vaatleri şişirilmez  
- Intelligence kanıtlanmadan ürünleşmiş gibi gösterilmez  
- LTV matematik + terminoloji tutarlı  
- Nesy liste fiyatı ile design-partner indirimi ayrışır  
- Domain Pack → danışmanlık riski ölçülebilir  

| Alan | Puan |
|---|---|
| Feature stratejisi | **9.4/10** |
| LTV underwriting başlangıcı | **8.3/10** |

---

## 10. Checklist — yatırımcı / master plan’a koymadan

| OK | YASAK |
|---|---|
| Lifecycle: UI_EFFECT_OBSERVED → ORACLE_EVALUATED | Bridge üzerinde EFFECT_VERIFIED = business |
| 10 Core + 2 Preview ayrı paketleme | 12 profili aynı olgunlukta satmak |
| Intelligence = v0 / Preview | “30 günde Failure Genome ürünü” |
| Illustrative Account Value başlığı | Gerçekleşmiş LTV iddiası |
| Nesy liste $80–130K vs DP $65–110K | Tek satırda $65–110K’yı liste gibi göstermek |
| GP marjı aralık veya base %82.5 | Satır satır farklı gizli marj |
| Core PR = 0 hedefi | LOC ile %70 Core ölçmek |
| AI ≠ PASS/FAIL | Candidate invariant’ı otomatik kural yapmak |
