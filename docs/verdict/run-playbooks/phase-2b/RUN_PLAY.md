# Phase 2B RUN_PLAY — B-10 Prisma Baseline Migration Repair

```yaml
runPlayId: verdict-cockpit-phase-2b-b10-migration-repair
phase: "2B"
phaseName: "B-10 Prisma Baseline Migration Repair"
status: COMPLETED
recoveryState: COMPLETED
createdAt: "2026-08-05 06:24:33 +03"
startedAt: "2026-08-05 06:24:33 +03"
completedAt: "2026-08-05 06:24:33 +03"
lastUpdatedAt: "2026-08-05 06:24:33 +03"
timezone: "Europe/Istanbul"
masterPlanPath: "docs/verdict/VERDICT_COCKPIT_SDK_BRIDGE_PLAN_V1_FULL.md"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:76024d898cb152fe4d885fb18e798cb24b6c3df31715eac546c64383ed5c2bd0"
verifyMasterPlanCommand: "pnpm verdict:verify-master-plan"
previousPhaseResult: "docs/verdict/run-playbooks/phase-2/RESULT.md"
resultFile: "docs/verdict/run-playbooks/phase-2b/RESULT.md"
phase3Readiness: "READY_WITH_NON_BLOCKING_DEBT"
```

## 1. Amaç

Phase 2B'nin amacı Phase 2 sonunda açık kalan **B-10 migration geçmişi eksik**
borcunu kapatmaktır.

Problem:

```text
prisma migrate deploy
  → boş PostgreSQL DB
  → 20260720000000_add_run_input
  → ALTER TABLE "workflow_runs"
  → relation "workflow_runs" does not exist
```

Kök neden: bazı temel tablolar geçmişte `prisma db push` ile oluşturulmuş, fakat
committed migration history içine hiç girmemişti. CI ise doğru şekilde `migrate
deploy` kullanıyor; bu yüzden integration job boş DB'de yeşile dönemezdi.

## 2. Scope

Bu faz sadece migration history repair yapar:

- Eksik legacy baseline tablolarını ilk migration olarak ekler.
- Migration history ile current Prisma schema arasındaki default drift'ini kapatır.
- Boş disposable PostgreSQL 16 üzerinde `migrate deploy` kanıtı alır.
- Aynı DB üzerinde Phase 2 integration suite'ini çalıştırır.

## 3. Kapsam dışı

- Mevcut shared/production-benzeri DB'ye migration çalıştırmak.
- Data migration veya destructive schema değişikliği.
- Phase 3 Bridge Host Client implementasyonu.
- Prisma schema model değişikliği.
- Test gevşetme veya skip ekleme.

## 4. Owned paths

```text
packages/db/prisma/migrations/20260401000000_init_legacy_baseline/migration.sql
packages/db/prisma/migrations/20260805010000_align_schema_defaults/migration.sql
docs/verdict/run-playbooks/phase-2b/RUN_PLAY.md
docs/verdict/run-playbooks/phase-2b/RESULT.md
docs/verdict/run-playbooks/phase-2/RUN_PLAY.md
docs/verdict/run-playbooks/phase-2/RESULT.md
```

## 5. Recovery state

| Alan | Değer |
|---|---|
| Current phase | `2B` |
| Current step | `2B.6` |
| Current state | `COMPLETED` |
| Last successful step | `2B.6` |
| Last attempted step | `2B.6` |
| Last update | `2026-08-05 06:24:33 +03` |
| Recovery instruction | `B-10 kapandı. Boş postgres:16 üzerinde migrate deploy PASS, migrate status up-to-date, migration diff empty, integration 37/37 PASS. Existing shared DB'lerde baseline migration kör uygulanmaz; önce inspection + migrate resolve --applied gerekir.` |

## 6. Work package checklist

| Step | Status |
|---|---|
| 2B.1 Migration history root cause doğrulama | `DONE` |
| 2B.2 Eksik legacy baseline migration | `DONE` |
| 2B.3 Prisma schema default drift alignment | `DONE` |
| 2B.4 Disposable PostgreSQL 16 migrate deploy | `DONE` |
| 2B.5 Integration suite | `DONE` |
| 2B.6 Result/handoff | `DONE` |

## 7. Kapanış acceptance

- Boş DB'de `prisma migrate deploy` PASS.
- `prisma migrate status` up-to-date.
- `prisma migrate diff --from-migrations --to-schema-datamodel` empty.
- Phase 2 integration suite gerçek PostgreSQL 16 üzerinde 37/37 PASS, 0 skip.
- Shared DB operasyon riski result içinde açık.

