# Phase 5 DEBT RESULT

```yaml
runPlayId: verdict-cockpit-phase-5-debt-run-play
debtOf: "5"
resultState: NOT_STARTED
createdAt: "2026-08-06 09:30:00 +03"
startedAt: null
completedAt: null
lastUpdatedAt: "2026-08-06 09:30:00 +03"
timezone: "Europe/Istanbul"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:76024d898cb152fe4d885fb18e798cb24b6c3df31715eac546c64383ed5c2bd0"
runPlayFile: "docs/verdict/run-playbooks/phase-5-debt/RUN_PLAY.md"
originalResult: "docs/verdict/run-playbooks/phase-5/RESULT.md"
phase6DebtReadiness: "NOT_EVALUATED"
priority: P0
```

## 1. Executive result

Henüz başlamadı. Bu dosya, borç yürütülürken `IN_PROGRESS`, kapanışta
`COMPLETED` / `BLOCKED_EXTERNAL` / `FAILED` olarak güncellenir.

```text
Kapsam: Phase 5'in Phase 6'ya söz verdiği ama açmadığı okuma API'leri
Kritik yol: EVET — phase-6-debt bu bitmeden başlayamaz
Harici bağımlılık: yalnız madde 60 (CP3-DUT)
```

## 2. Recovery state

| Alan | Değer |
|---|---|
| Current debt | `phase-5-debt` |
| Current step | `5D.1` |
| Current state | `NOT_STARTED` |
| Last successful step | — |
| Last attempted step | — |
| Recovery instruction | `5D.1'den başla: EvidenceSourceResolver'a list() ekle ve GET /runtime/evidence-sources aç.` |

## 3. Precondition gate

| Gate | Required | Evidence |
|---|---|---|
| Phase 5 RESULT | `COMPLETED` | `PASS` |
| PostgreSQL 18/18 migration | applied | `PASS` — 2026-08-06 |
| Domain pack persistence | restart-safe | `PASS` — phase-6/RESULT §16 |
| API + cockpit çalışıyor | evet | `PASS` — :4001 / :4002 |

## 4. Kanıtlanmış boşluk (2026-08-06 taraması)

| Yüzey | Runtime | HTTP ucu | UI |
|---|---|---|---|
| Evidence Source Registry | `evidence-source-resolver.ts` var | **YOK** | sabit 2 satır maket |
| Semantic Actions | `semantic-action.ts` sözleşme + validator + bundle alanı var | **YOK** | palet 660 satırlık sabit `workflow-registry.ts` |
| Target Resolution Provider Chain | `entity-target.ts` sözleşme + validator var | **YOK** | statik maket |
| Launch Profile | `profile.ts` sözleşme + `validate.ts` var | **YOK** | bağlanmamış form |

Phase 5 RESULT §9 madde 45 “Phase 6 DTO targets — `PASS`” bu dört yüzey için
geçersiz; kapanışta düzeltilecek.

## 5. Step execution log

| Step | Status | Evidence |
|---|---|---|
| 5D.1 EvidenceSourceQuery API | `PENDING` | — |
| 5D.1b SemanticActionQuery API | `PENDING` | — |
| 5D.2 TargetResolutionQuery API | `PENDING` | — |
| 5D.3 LaunchProfile API | `PENDING` | — |
| 5D.4 Stub compiler kararı | `PENDING` | — |
| 5D.5 Admission durable lease | `PENDING` | — |
| 5D.6 Madde 60 gerçek DUT | `BLOCKED_EXTERNAL` | `CP3-DUT` |

## 6. Changed files

| Path | Değişim | Neden |
|---|---|---|
| — | — | henüz yok |

## 7. Verification results

| Komut | Sonuç |
|---|---|
| `pnpm typecheck` | `NOT_RUN` |
| `pnpm --filter @nesy/api test` | `NOT_RUN` |
| `pnpm --filter @nesy/web test` | `NOT_RUN` |
| `next build` | `NOT_RUN` |
| Runtime uç doğrulaması | `NOT_RUN` |

## 8. Acceptance checklist

12 maddenin tamamı `PENDING` — RUN_PLAY §7.

## 9. Blockers

| ID | Sev | Status | Açıklama |
|---|---|---|---|
| `CP3-DUT` | HIGH/EXTERNAL | `OPEN_EXTERNAL` | Yalnız 5D.6'yı etkiler; diğer beş adımı engellemez |

## 10. Readiness decision

```text
phase6DebtReadiness: NOT_EVALUATED
```

5D.1–5D.5 kapanmadan `phase-6-debt` başlatılmaz.
