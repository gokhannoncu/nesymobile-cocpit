# Phase 4 DEBT RUN_PLAY — Smoke Handshake Flakiness and Protocol Documentation

```yaml
runPlayId: verdict-cockpit-phase-4-debt-run-play
debtOf: "4a / 4b / 4c"
phaseName: "Phase 4 carried debt: flaky handshake, runEpoch protocol write-up, inherited CP3-DUT"
createdAt: "2026-08-06 09:30:00 +03"
timezone: "Europe/Istanbul"
originalResults:
  - "docs/verdict/run-playbooks/phase-4a/RESULT.md"
  - "docs/verdict/run-playbooks/phase-4b/RESULT.md"
  - "docs/verdict/run-playbooks/phase-4c/RESULT.md"
priority: P2
blocksPhase6Closure: false
blocksProductionGo: true
```

## 1. Why this debt exists

Faz 4a, 4b ve 4c'nin üçü de `COMPLETED` kapandı ve üçü de aynı blocker setini
taşıdı. Hiçbiri çözülmedi, her fazda kopyalandı:

| ID | Sev | Kayıt | Status |
|---|---|---|---|
| `CP3-DUT` | HIGH/EXTERNAL | “CP3 full mutation acceptance için userdebug/eng lab cihaz gerekiyor” | `OPEN_EXTERNAL` |
| `B-12` | MEDIUM | “Production cihazda arka arkaya smoke handshake flaky” | `OPEN` |
| `B-14` | LOW | “`runEpoch` birimi Bridge protocol v2'de açık yazılmalı” | `OPEN_LOW` |
| `B-8` | MEDIUM | ESLint borcu | `OPEN_NON_BLOCKING` |

`CP3-DUT` → `phase-3-debt/` altında izleniyor.
`B-8` → `phase-2-debt/` altında izleniyor.
Bu playbook **`B-12` ve `B-14`** için.

## 2. AI agent starting prompt

```text
Verdict Cockpit Phase 4 DEBT'i uygula.

Oku:
docs/verdict/run-playbooks/phase-4-debt/RUN_PLAY.md
docs/verdict/run-playbooks/phase-4a/RESULT.md  (B-12 ve B-14'ün ilk kaydı)
docs/verdict/run-playbooks/phase-4c/RESULT.md  (aynı blocker'ların son hali)
docs/verdict/run-playbooks/phase-5/RESULT.md   (B-14'ü RESOLVED_LOCAL saymış — kontrol et)

İki iş var:

1) B-12 — smoke handshake flakiness:
   Bu bir KARARLILIK sorunu, tek seferlik hata değil. Önce ÖLÇ:
   handshake'i arka arkaya N kez çalıştır, başarısızlık oranını ve
   başarısızlık ANINDAKİ durumu kaydet. Kök nedeni bulmadan "düzelttim" deme.
   Tek bir başarılı koşu kanıt değildir.

2) B-14 — runEpoch birimi:
   Faz 5 bunu RESOLVED_LOCAL (MONOTONIC_MS) işaretledi. Ama orijinal talep
   "Bridge protocol v2 dokümanında açık yazılmalı" idi. Kodda çözülmüş olması
   protokol dokümanının güncellendiği anlamına gelmez — DOĞRULA.
   Doküman güncel değilse güncelle; güncelse B-14'ü tüm RESULT'larda kapat.

Kesin kurallar:
- Flaky bir testi retry ekleyerek "çözme". Kök neden bulunacak.
- Başarısızlık oranını ölçmeden kapatma.
- Cihaz gerektiren kısımda ro.build.type kontrol et; user build ile
  production smoke senaryosu temsili değilse bunu yaz.
```

## 3. Precondition gate

| Gate | Required | Not |
|---|---|---|
| Faz 4a/4b/4c | `COMPLETED` | `PASS` |
| Cihaz erişimi (B-12 için) | production benzeri cihaz | bağlı `SM-A346E` `user` build — B-12 için uygun olabilir |

`B-12` production cihazdaki davranışla ilgili olduğu için, `user` build cihaz
burada **CP3'ün aksine** temsili olabilir. Bunu doğrula ve RESULT'a yaz.

## 4. Görevler

### 4D.1 — `B-12` smoke handshake flakiness

**Kayıt:** “Production cihazda arka arkaya smoke handshake flaky.”

**Ölçüm önce:**
1. Handshake'i arka arkaya en az 30 kez çalıştıran bir harness yaz.
2. Her koşu için kaydet: sonuç, süre, başarısızlıksa hangi aşamada (adb forward,
   accessibility service, bridge connect, ilk mesaj), cihaz logu.
3. Başarısızlık oranını ve dağılımını raporla.

**Sonra kök neden:**
Şüpheli alanlar — `bridge-device-gate.ts` içindeki host port lease
(`HOST_PORT_RANGE 21876–21975`), `adb forward --no-rebind` yarışı, accessibility
service'in hazır olmasını beklemeden bağlanma.

**Kabul:** 30 ardışık koşuda sıfır başarısızlık **ve** kök nedenin ne olduğu
yazılı. Retry eklemek çözüm değil.

### 4D.2 — `B-14` runEpoch protokol dokümanı

**Kayıt:** “`runEpoch` birimi Bridge protocol v2'de açık yazılmalı.”

Faz 5 RESULT bunu `RESOLVED_LOCAL` / `MONOTONIC_MS` işaretlemiş — yani kodda
birim belirlenmiş. Orijinal talep dokümantasyondu.

1. Bridge protocol v2 dokümanını bul; `runEpoch` biriminin yazılı olup olmadığını
   doğrula.
2. Yazılı değilse ekle: birim `MONOTONIC_MS`, hangi saatten türediği, wall-clock
   ile karıştırılmaması gerektiği, ve `bridgeflow_run_runtime.run_epoch_unit`
   kolonuyla ilişkisi.
3. `B-14`'ü 4a/4b/4c RESULT'larında `RESOLVED` yap.

**Kabul:** protokol dokümanında birim açıkça yazılı.

### 4D.3 — Devredilen maddelerin işaretlenmesi

`CP3-DUT` ve `B-8` bu playbook'ta çözülmez; sırasıyla `phase-3-debt/` ve
`phase-2-debt/` altında izlenir. Buradaki iş yalnız çapraz referansın doğru
kalması.

## 5. Verification

```bash
pnpm --filter @nesy/api test
pnpm typecheck
# B-12 harness
node scripts/<handshake-stability-harness>.mjs --runs 30
```

## 6. Acceptance checklist

| # | Madde | Kanıt |
|---|---|---|
| 1 | Handshake stability harness var | script |
| 2 | 30 koşuluk ölçüm raporlandı | çıktı |
| 3 | Kök neden yazılı | RESULT |
| 4 | 30/30 başarılı | çıktı |
| 5 | Retry ile maskelenmedi | diff |
| 6 | `runEpoch` birimi protokol dokümanında | doküman |
| 7 | `B-12` ve `B-14` 4a/4b/4c'de `RESOLVED` | diff |
| 8 | `CP3-DUT` / `B-8` çapraz referansı doğru | diff |
