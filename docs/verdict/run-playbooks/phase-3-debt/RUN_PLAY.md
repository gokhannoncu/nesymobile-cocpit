# Phase 3 DEBT RUN_PLAY — CP3 Full Acceptance Blocked by Production Build Device

```yaml
runPlayId: verdict-cockpit-phase-3-debt-run-play
debtOf: "3"
phaseName: "Phase 3 carried debt: CP3 mutation acceptance never completed"
createdAt: "2026-08-06 09:30:00 +03"
timezone: "Europe/Istanbul"
originalResult: "docs/verdict/run-playbooks/phase-3/RESULT.md"
priority: P2
externalBlocker: "CP3-DUT"
blocksPhase6Closure: false
blocksProductionGo: true
```

## 1. Why this debt exists

Phase 3 never closed as `COMPLETED`. Its recorded state is:

```text
resultState: IMPLEMENTATION_COMPLETE_CP3_BLOCKED_PRODUCTION_DUT
```

Phase 3 RESULT's own words: *“CP3 full acceptance tamamlanamadı — ama beklenen
sebepten değil.”* The implementation is done; the acceptance could not run
because the available device is a **production build**: `ro.build.type=user`.

Phase 4a, 4b and 4c each inherited this as `CP3-DUT` (HIGH/EXTERNAL) and closed
`READY_WITH_EXTERNAL_BLOCKERS` on top of it. Phase 5 item 60 (“Nesy setup mode
real product PASS”) is blocked by the same thing.

## 2. Current device reality (checked 2026-08-06)

A physical device is attached over USB, but it does not qualify:

```text
serial                  R6CW400BC8N
ro.product.model        SM-A346E        (Samsung Galaxy A34)
ro.build.version.release 16
ro.build.type           user            <-- CP3 requires userdebug or eng
ro.debuggable           0               <-- no debuggable surface
```

**Bu cihaz CP3 engelini kaldırmıyor.** ADB seviyesinde gözlem (device health
lane, screen state, interaction observation) yapılabilir; mutation acceptance
yapılamaz.

## 3. AI agent starting prompt

```text
Verdict Cockpit Phase 3 DEBT'i uygula.

Oku:
docs/verdict/run-playbooks/phase-3-debt/RUN_PLAY.md
docs/verdict/run-playbooks/phase-3/RESULT.md   (CP3'ün neden bloklandığı)
docs/verdict/run-playbooks/phase-4a/RESULT.md  (CP3-DUT devri)

ÖNCE CİHAZI DOĞRULA:
  adb devices -l
  adb -s <serial> shell getprop ro.build.type
  adb -s <serial> shell getprop ro.debuggable

ro.build.type 'userdebug' veya 'eng' DEĞİLSE:
  Bu playbook'un acceptance kısmına BAŞLAMA.
  RESULT.md'ye BLOCKED_EXTERNAL yaz, gördüğün build type'ı kaydet, dur.
  Emulator ile ikame etme — CP3 gerçek DUT acceptance'ıdır.

Uygun cihaz VARSA:
  Phase 3 RUN_PLAY'indeki CP3 acceptance adımlarını uygula, her adımın
  kanıtını (komut çıktısı, ekran görüntüsü, cihaz logu) RESULT'a yaz.

Kesin kurallar:
- Setup login sonucunu gerçek ürün PASS'i gibi raporlama.
- Unknown dialog/effect için sessiz retry veya green üretme.
- Emulator sonucunu DUT sonucu diye yazma.
- Cihaz bulunamadığında maddeyi PASS yapma; BLOCKED_EXTERNAL yaz.
```

## 4. Precondition gate

| Gate | Required | Current |
|---|---|---|
| Phase 3 implementation | complete | `PASS` |
| `ro.build.type` | `userdebug` \| `eng` | **`FAIL`** — `user` |
| `ro.debuggable` | `1` | **`FAIL`** — `0` |
| Lab cihaz erişimi | var | **`FAIL`** |

```text
acceptanceStart: BLOCKED_BY_DEVICE_BUILD_TYPE
```

## 5. Görevler

### 3D.1 — Uygun cihaz temini (owner işi, kod değil)

Şunlardan biri gerekir:
- `userdebug` veya `eng` build yüklü fiziksel Nesy DUT, veya
- lab cihazına uzaktan erişim.

Bu, Device/Mobile owner'ın işi. **Kod tarafında yapılabilecek bir şey yok.**

### 3D.2 — CP3 full mutation acceptance

Cihaz geldiğinde Phase 3 RUN_PLAY'indeki CP3 adımları yürütülür. Her adım için:
komut çıktısı, cihaz üzerinde gözlenen durum, ve elde edilen evidence referansı.

### 3D.3 — Bağlı maddelerin kapatılması

CP3 geçtiğinde şunlar da kapanır:
- Phase 4a/4b/4c `CP3-DUT` satırları
- Phase 5 §9 madde 60
- Phase 6 CHECKPOINT maddeleri 50, 52, 53, 54 ve Act Mode ile ilgili olanlar

### 3D.4 — Cihaz olmadan yapılabilecekler (bu turda mümkün)

Bağlı `user` build cihazla şunlar **yapılabilir** ve ayrı kanıt sayılır:
- ADB lane readiness probe doğrulaması (yapıldı, `2026-08-06`)
- Screen state gözlemi
- Interaction origin gözlemi (mutation olmadan)

Bunlar CP3 yerine geçmez; ayrı olarak raporlanır.

## 6. Acceptance checklist

| # | Madde | Kanıt |
|---|---|---|
| 1 | Uygun build type cihaz mevcut | `getprop` çıktısı |
| 2 | CP3 mutation acceptance yürütüldü | adım adım kanıt |
| 3 | Setup login ile gerçek UI login ayrı raporlandı | RESULT |
| 4 | Unknown effect'te sessiz green üretilmedi | RESULT |
| 5 | Phase 4a/4b/4c `CP3-DUT` kapatıldı | diff |
| 6 | Phase 5 madde 60 kapatıldı | diff |
| 7 | Phase 3 `resultState` `COMPLETED` yapıldı | diff |
