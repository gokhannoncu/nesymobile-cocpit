# Phase 2B RESULT — B-10 Prisma Baseline Migration Repair

```yaml
runPlayId: verdict-cockpit-phase-2b-b10-migration-repair
phase: "2B"
phaseName: "B-10 Prisma Baseline Migration Repair"
resultState: COMPLETED
startedAt: "2026-08-05 06:24:33 +03"
completedAt: "2026-08-05 06:24:33 +03"
lastUpdatedAt: "2026-08-05 06:24:33 +03"
timezone: "Europe/Istanbul"
masterPlanVersion: "v1.1.3"
masterPlanDigest: "sha256:b81631396044cab7f83f6b6efea2f47ff4b4bda4b177b2d7a2ad705535b660b2"
runPlayFile: "docs/verdict/run-playbooks/phase-2b/RUN_PLAY.md"
previousPhaseResult: "docs/verdict/run-playbooks/phase-2/RESULT.md"
phase3Readiness: "READY_WITH_NON_BLOCKING_DEBT"
```

## 1. Executive result

**B-10 kapandı.** CI integration job'ının boş PostgreSQL DB'de patlamasına neden olan
eksik migration geçmişi düzeltildi.

Eklenen migration'lar:

| Migration | Amaç |
|---|---|
| `20260401000000_init_legacy_baseline` | Migration geçmişinde hiç yaratılmamış legacy/core tabloları ilk sırada oluşturur. |
| `20260805010000_align_schema_defaults` | Current Prisma schema ile migration history arasındaki üç default drift'ini kapatır. |

Kanıt:

```text
prisma migrate deploy       PASS — boş postgres:16 üzerinde 14/14 migration applied
prisma migrate status       PASS — Database schema is up to date
prisma migrate diff         PASS — empty migration
integration suite           PASS — 37 passed / 0 skipped
```

## 2. Root cause

Phase 2 sonunda bulunan hata doğruydu: committed migration history, current Prisma
schema'nın bazı temel tablolarını hiç yaratmıyordu. Daha sonra gelen migration'lar ise
bu tablolar varmış gibi `ALTER TABLE` veya FK ekliyordu.

İlk kırılan yer:

```text
20260720000000_add_run_input
ALTER TABLE "workflow_runs" ADD COLUMN IF NOT EXISTS "runInput" JSONB;
```

Boş DB'de `workflow_runs` henüz yoktu. Bunun sebebi Phase 2 durable runtime değil;
önceden `db push` ile oluşmuş ama migration history'ye baseline olarak girmemiş
legacy schema idi.

## 3. What changed

### 3.1 Legacy baseline migration

`20260401000000_init_legacy_baseline` sadece migration history'de eksik olan tabloları
yaratır:

```text
workflows
workflow_versions
workflow_runs
workflow_step_results
courier_wallets
field_courier_logins
mongo_query_runs
graylog_query_runs
```

Bilerek yaratmadığı tablolar:

```text
AutomationRun
Note
Shipment
Pickup
mobile_devices
happy_path_pools
happy_path_pool_entries
engineering_incidents
engineering_incident_events
verdict_inbox
verdict_gap
verdict_stream
verdict_diagnostic_capture
verdict_run_closure
```

Bunlar zaten mevcut migration'lar tarafından yaratılıyor. Baseline'ın tüm current
schema'yı yaratması duplicate table/column hatası üretirdi.

### 3.2 Schema drift alignment migration

`migrate deploy` geçtikten sonra ayrıca şu kontrol yapıldı:

```bash
prisma migrate diff \
  --from-migrations prisma/migrations \
  --to-schema-datamodel prisma/schema.prisma \
  --shadow-database-url postgresql://postgres:postgres@localhost:55433/verdict_shadow \
  --script
```

İlk sonuç üç default drift'i gösterdi:

```sql
ALTER TABLE "engineering_incidents" ALTER COLUMN "riskTypes" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "mobile_devices" ALTER COLUMN "updatedAt" DROP DEFAULT;
```

Bunlar `schema.prisma` içinde yoktu. Bu nedenle non-destructive alignment migration
eklendi. İkinci diff sonucu:

```text
-- This is an empty migration.
```

## 4. Commands and evidence

Disposable PostgreSQL 16:

```bash
docker run -d --name verdict-b10-pg -p 55433:5432 \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_DB=verdict_test \
  postgres:16
```

Migration deploy:

```bash
DATABASE_URL='postgresql://postgres:postgres@localhost:55433/verdict_test' \
  pnpm --filter @nesy/db exec prisma migrate deploy
```

Result:

```text
14 migrations found in prisma/migrations
Applying migration `20260401000000_init_legacy_baseline`
...
Applying migration `20260805010000_align_schema_defaults`
All migrations have been successfully applied.
```

Migration status:

```text
Database schema is up to date!
```

Migration diff:

```text
-- This is an empty migration.
```

Integration:

```bash
DATABASE_URL='postgresql://postgres:postgres@localhost:55433/verdict_test' \
VERDICT_DB_IT=1 \
pnpm --filter @nesy/api test -- --no-file-parallelism \
  src/services/verdict-ingest.integration.test.ts \
  src/services/test-event-ws-server.integration.test.ts \
  src/services/verdict-durable-runtime.integration.test.ts
```

Result:

```text
Test Files  3 passed (3)
Tests       37 passed (37)
```

## 5. Changed files

| File | Change | Reason |
|---|---|---|
| `packages/db/prisma/migrations/20260401000000_init_legacy_baseline/migration.sql` | new | Missing legacy/core baseline tables |
| `packages/db/prisma/migrations/20260805010000_align_schema_defaults/migration.sql` | new | Remove migration-history/schema default drift |
| `docs/verdict/run-playbooks/phase-2b/RUN_PLAY.md` | new | Phase 2B execution playbook |
| `docs/verdict/run-playbooks/phase-2b/RESULT.md` | new | Phase 2B result evidence |
| `docs/verdict/run-playbooks/phase-2/RUN_PLAY.md` | update | Handoff B-10 status |
| `docs/verdict/run-playbooks/phase-2/RESULT.md` | update | Handoff B-10 status |

## 6. Existing environment warning

This fix is safe for **fresh CI/disposable databases**.

Existing shared databases that already contain these baseline tables must not blindly
run the new first migration. They require an explicit operational step:

```bash
pnpm --filter @nesy/db exec prisma migrate resolve \
  --applied 20260401000000_init_legacy_baseline
```

Only after confirming the existing DB really matches the baseline should this be
marked applied. The later `20260805010000_align_schema_defaults` migration is
non-destructive, but still must be rolled out through the normal DB release path.

No shared or production-like DB was modified during this work.

## 7. Blockers

| ID | Previous | Current |
|---|---|---|
| B-10 | `OPEN / HIGH` | **`CLOSED`** |
| B-8 | `OPEN_NON_BLOCKING` | unchanged |
| CP0 external DUT | `OPEN/EXTERNAL` | unchanged |

## 8. Phase 3 readiness

```text
READY_WITH_NON_BLOCKING_DEBT
```

Phase 3 can start with a real CI-compatible migration path. Remaining debt is not
Phase 2/2B blocking:

- B-8 repo-wide lint flat-config debt.
- CP0 external physical DUT/SSOT gates.

