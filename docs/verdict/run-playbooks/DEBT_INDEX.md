# Verdict Cockpit — Debt Playbook Index

Her `phase-N-debt/` klasörü, o fazın **kapanmış sayıldığı halde teslim edilmemiş**
işini taşır. Orijinal `phase-N/` playbook'ları değiştirilmez; borç ayrı bir iz
olarak yürütülür ve kapandıkça orijinal RESULT'a geri işlenir.

Son tarama: `2026-08-06`. Kaynak: her fazın `RESULT.md` blocker tabloları + bu
tarihte çalışan sistem üzerinde yapılan doğrulamalar.

## Klasörler

| Path | Kapsam | Öncelik |
|---|---|---|
| `phase-2-debt/` | Performans baseline eksikliği, repo geneli lint borcu | P3 |
| `phase-3-debt/` | CP3 full acceptance — production build cihaz engeli | P2 (harici) |
| `phase-4-debt/` | CP3-DUT devri, smoke handshake flakiness, protokol dokümanı | P2 (harici) |
| `phase-5-debt/` | **Runtime var, HTTP ucu yok** (evidence source, semantic action, target resolution, launch profile); stub compiler üretimde; admission süreç-içi | **P0** |
| `phase-6-debt/` | Editör panelleri veriye bağlı değil; **sol palet hâlâ sabit Maestro registry'si**; Surface Registry yok; CHECKPOINT 6 taraması yarım | **P1** |

Faz 0 ve Faz 1 için itemize edilmiş açık madde yok.

## Bağımlılık sırası

```text
phase-5-debt  (API yüzeyleri)
      │
      ▼
phase-6-debt  (UI binding + Surface Registry + CHECKPOINT 6 kapanışı)
      │
      ▼
Phase 7 gate

phase-2-debt   ─ bağımsız, paralel yürüyebilir
phase-3-debt   ─┐
phase-4-debt   ─┴ harici cihaz gerektirir; Faz 6 kapanışını engellemez,
                  production GO'yu engeller
```

**Kritik yol `phase-5-debt` → `phase-6-debt`.** Faz 6'nın 22–25 numaralı kabul
maddeleri, Faz 5'in açmadığı API uçlarına bağlı; sıra tersine çevrilemez.

Aynı bağımlılık paletin kendisi için de geçerli: CHECKPOINT madde 2 ("operatör
Maestro/YAML bilmeden workflow oluşturabiliyor") ancak sol palet Domain Pack'ten
beslendiğinde gerçekten sağlanır — `5D.1b` (SemanticActionQuery API) → `6D.1f`
(palet cutover).

## Mobil bağımlılığı olan tek şey

Semantic action **tanımlama, listeleme, palete düşme ve plana derlenme** mobil
beklemez. Yalnız cihazda `performAction` ile **çalıştırma** yetenek gerektirir
(mobil Faz 3 Bridge B2 capabilities, mobil Faz 4b App Adapter). Bu ayrım API'de
`capabilityStatus` alanıyla görünür kılınır; yeteneksiz action gizlenmez,
bloklu gösterilir.

## Harici engeller — kimse kodla çözemez

| ID | Ne gerekiyor | Bugünkü durum |
|---|---|---|
| `CP3-DUT` | `ro.build.type=userdebug` veya `eng` cihaz | Bağlı cihaz `SM-A346E` → `user` / `debuggable=0`. **Karşılamıyor** |
| `B-12` | Production cihazda kararlı smoke handshake | Mobile owner'da |

## Kapanış kuralı

Bir borç maddesi ancak şu üçü birden varsa `RESOLVED` yazılır:

1. Çalışan sistem üzerinde kanıt (HTTP yanıtı, ekran görüntüsü, gerçek cihaz çıktısı),
2. Regresyon testi,
3. İlgili orijinal `phase-N/RESULT.md` satırının düzeltilmesi.

Kanıtsız `PASS` yasak — bu borcun büyük kısmı zaten kanıtsız `DONE` işaretlemekten doğdu.
