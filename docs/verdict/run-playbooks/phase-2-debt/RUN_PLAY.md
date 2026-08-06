# Phase 2 DEBT RUN_PLAY — Performance Baseline and Repo-Wide Lint

```yaml
runPlayId: verdict-cockpit-phase-2-debt-run-play
debtOf: "2 / 2b"
phaseName: "Phase 2 carried debt: no performance budget, non-blocking lint gate"
createdAt: "2026-08-06 09:30:00 +03"
timezone: "Europe/Istanbul"
originalResult: "docs/verdict/run-playbooks/phase-2/RESULT.md"
priority: P3
blocksPhase6Closure: false
```

## 1. Why this debt exists

Phase 2 closed with `phase3Readiness: READY_WITH_NON_BLOCKING_DEBT`. Two items
were explicitly deferred and have been carried through every later phase:

| ID | Sev | Phase 2 RESULT'taki kayıt |
|---|---|---|
| `B-6` | LOW | “Performans baseline script'i yok; receipt dispatch latency / ordered lag için hedef eşik tanımlı değil (sayı görünür, bütçe yok).” `OPEN` |
| `B-8` | MEDIUM | “Repo-wide lint ESLint v9 flat-config borcu yüzünden blocking değil.” `OPEN_NON_BLOCKING` |

`B-8` Faz 3, 4a, 4b, 4c, 5 ve 6'nın blocker tablolarında da taşınıyor. Hiçbirini
engellemedi, ama her fazda “touched surfaces must stay green” şartıyla
tekrarlandı — yani gerçek gate hiç kapanmadı.

## 2. AI agent starting prompt

```text
Verdict Cockpit Phase 2 DEBT'i uygula.

Oku:
docs/verdict/run-playbooks/phase-2-debt/RUN_PLAY.md
docs/verdict/run-playbooks/phase-2/RESULT.md   (B-6 ve B-8 kayıtları)

Görev iki bağımsız parçadan oluşur; ikisi de başka hiçbir fazı engellemez,
paralel yürütülebilir.

1) B-6 — performans bütçesi:
   Receipt dispatch latency ve ordered bus lag için ÖLÇÜM zaten var; eksik olan
   HEDEF EŞİK ve onu doğrulayan script. Eşikleri uydurma — mevcut ölçümlerden
   p50/p95 çıkar, owner'a öner, onaylananı sabitle.

2) B-8 — ESLint v9 flat config:
   Repo geneli lint'i blocking hale getir. Mevcut ihlalleri tek seferde
   düzeltmeye çalışma; önce flat config'i kur, sonra paket paket devreye al.
   Bir paketi yeşile çekmeden gate'i açma.

Kesin kurallar:
- Performans eşiğini kanıtsız belirleme. Ölçülmüş dağılımdan türet.
- Lint düzeltirken davranış değiştirme; sadece lint. Davranış değişikliği
  gerekiyorsa ayrı commit ve testle.
- turbo.json'daki lint task'ını blocking yapmadan önce tüm paketler yeşil olmalı.
```

## 3. Precondition gate

| Gate | Required | Not |
|---|---|---|
| Phase 2 RESULT | `COMPLETED` | `PASS` |
| Diğer fazlardan bağımsızlık | evet | bu borç kimseyi engellemez |

## 4. Görevler

### 2D.1 — Performans baseline ve bütçe (`B-6`)

**Eksik olan:** eşik ve doğrulayıcı script. Ölçüm mevcut.

1. Mevcut receipt dispatch latency ve ordered bus lag ölçümlerini topla; p50/p95/p99 çıkar.
2. `scripts/verdict-perf-baseline.mjs` — ölçümü çalıştırır, JSON baseline üretir,
   eşiğin üstünde kalırsa non-zero exit döner.
3. Eşikleri `docs/verdict/perf-budget.md` içine gerekçesiyle yaz (hangi ölçümden
   türetildi, hangi cihaz/ortam).
4. `package.json`'a `verdict:perf-baseline` script'i ekle.
5. CI'da önce **uyarı** modunda çalıştır; iki hafta veri topladıktan sonra
   blocking'e al.

**Kabul:** eşik keyfi değil, ölçülmüş dağılımdan türetilmiş ve gerekçesi yazılı.

### 2D.2 — ESLint v9 flat config (`B-8`)

**Eksik olan:** repo geneli blocking lint gate.

1. `@nesy/eslint-config` paketini flat-config (`eslint.config.js`) formatına taşı.
   Faz 3'te eklenen iki paket bunu zaten kullanıyor — referans al.
2. Paket paket devreye al. Her paket için: config bağla → ihlalleri düzelt →
   yeşil olduğunu doğrula → sonrakine geç.
3. Hepsi yeşil olunca `turbo.json` `lint` task'ını blocking yap.
4. Faz 3/4a/4b/4c/5/6 RESULT'larındaki `B-8` satırlarını `RESOLVED` yap.

**Not:** `next build` çıktısında `@typescript-eslint/ban-ts-comment` uyarıları
görülüyor (`@ts-nocheck` kullanımı). Bunlar bu iş kapsamında ele alınmalı —
`@ts-nocheck` bir dosyada tip kontrolünü tamamen kapatır.

**Kabul:** `pnpm lint` tüm workspace'te sıfır hata; gate blocking.

## 5. Verification

```bash
pnpm verdict:perf-baseline
pnpm lint
pnpm typecheck
```

## 6. Acceptance checklist

| # | Madde | Kanıt |
|---|---|---|
| 1 | Perf baseline script çalışıyor | komut çıktısı |
| 2 | Eşikler ölçümden türetilmiş ve gerekçeli | `perf-budget.md` |
| 3 | Eşik aşımında non-zero exit | komut çıktısı |
| 4 | Flat config tüm paketlerde | `eslint.config.js` |
| 5 | `pnpm lint` sıfır hata | komut çıktısı |
| 6 | `@ts-nocheck` kullanımları ele alındı | diff |
| 7 | Lint gate blocking | `turbo.json` |
| 8 | `B-6` ve `B-8` tüm RESULT'larda `RESOLVED` | diff |
