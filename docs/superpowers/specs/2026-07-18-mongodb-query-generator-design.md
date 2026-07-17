# MongoDB Query Generator — Real Catalog + Claude CLI + DB History

**Date:** 2026-07-18  
**Status:** Draft for review  
**App:** NesyMobileCocpit (`/engineering/tools/mongodb-query-generator`)

## Problem

The MongoDB Query Generator page is fully mock: fake databases (`nesy-delivery`),
fake collections (`deliveryRequests`), static generated queries, and hardcoded
recent-query history. It does not reflect real NESY Mongo databases/collections
and does not persist generated queries.

## Goals

1. Replace mock DB/collection options with an **operational core catalog** derived
   from real backend `[BsonCollection]` documents (~15–25 collections).
2. Generate queries via **Claude Code CLI** on the host machine
   (`claude -p --bare`), default model **haiku** for low cost.
3. **Auto-save** every successful Generate into Postgres; Recent Queries reads
   from DB.
4. Ship a **Prisma schema update + manual SQL migration** (repo pattern).

## Non-goals

- Executing queries against live MongoDB
- Generating write/update/delete/drop operations
- Live schema introspection from Mongo
- Docker/sidecar Claude bridge (local API process spawns CLI directly)
- Full 200+ collection catalog (deferred; core set only)

## Decisions (approved)

| Topic | Choice |
| --- | --- |
| Catalog scope | A — operational core (~15–25) |
| History write | A — auto-save on every Generate |
| LLM runtime | Claude Code CLI via `apps/api` `child_process` |
| Model | `haiku` (env override `CLAUDE_MONGO_QUERY_MODEL`) |
| Cost controls | `--max-turns 1`, schema for selected collection only; `--bare` only with API key |

## Architecture

```
UI (Generate) → POST /api/mongo-query/generate
                    → load core catalog schema for collection
                    → spawn: claude -p --bare --model haiku --output-format json
                    → parse + validate (read-only, limit)
                    → INSERT mongo_query_runs
                    → return result to UI

UI (Recent)   → GET /api/mongo-query/recent
                    → SELECT from mongo_query_runs ORDER BY lastUsedAt DESC
```

### Claude CLI invocation

```text
claude -p
  --model <CLAUDE_MONGO_QUERY_MODEL|haiku>
  --output-format json
  --max-turns 1
  [--bare]   # only when ANTHROPIC_API_KEY or CLAUDE_MONGO_QUERY_BARE=1
  "<system+user prompt with schema + NL + guardrails>"
```

- Resolve binary: `CLAUDE_CLI_PATH` env, else `where.exe claude` / `which claude`.
- Default auth: OAuth via `claude login` (no `--bare`). API-key mode uses `--bare`.
- Timeout: 90s (configurable via `CLAUDE_MONGO_QUERY_TIMEOUT_MS`).
- On CLI missing / auth failure / timeout: return actionable 502/503; do not insert history.
- Prompt asks for strict JSON in the result text:

```json
{
  "name": "short title",
  "query": "db.Shipment.find({...}).limit(100)",
  "summary": "one-line summary",
  "explanation": ["step 1", "step 2"],
  "validation": [
    { "id": "syntax", "label": "...", "detail": "...", "status": "pass|warn" }
  ],
  "estimatedScope": {
    "documents": "unknown|estimate",
    "index": null,
    "response": "unknown"
  }
}
```

### Guardrails (server-side, after CLI)

Reject / rewrite if query contains write operators:
`update`, `updateOne`, `updateMany`, `delete`, `deleteOne`, `deleteMany`,
`drop`, `insert`, `insertOne`, `insertMany`, `replaceOne`, `findAndModify`,
`bulkWrite`, `$out`, `$merge`.

If safety toggle `limit` is on and no `.limit(` / `$limit` present, append
`.limit(100)` (find) or `$limit: 100` (aggregate) before save.

## Core catalog

Single static TypeScript catalog module at
`apps/api/src/data/mongo-catalog.ts`, sourced from real NESY backends and
exposed to the UI via `GET /api/mongo-query/catalog` (UI does not duplicate the
catalog; it may keep only presentation helpers/types locally):

| Database | Collections (core) | Source service |
| --- | --- | --- |
| `NESY_ShipmentDB` | `Shipment`, `ShipmentHistory`, `ShipmentStatusLog`, `FiscalInvoiceDocument`, `Invoice`, `SoftPosTransaction`, `CodShipment` | ShipmentWebAPI |
| `NESY_TaskDB` | `Schedule`, `Pickup`, `CourierZone`, `Approval` | TaskWebAPI |
| `NESY_TrackingDB` | `TrackingData`, `ShipmentEventLog`, `CourierLocation`, `CourierLastLocation` | TrackingWebAPI |
| `NESY_UserDB` | `User`, `UserLoginLog`, `DriverStatus` | UserWebAPI |
| `NESY_TransferCenterDB` | `Trip`, `Driver`, `Vehicle` | TransferCenterWebAPI |
| `NESY_CustomerDB` | `Customer`, `CustomerAddress` | CustomerWebAPI |
| `NESY_HistoryDB` | `ShipmentEventHistory`, `FailedRequest` | HistoryWebAPI |

Each collection entry includes:

- `database`, `collection` (exact `BsonCollection` name)
- `service` label
- `keyFields[]` — field name, type, short description, example
- `examplePrompts[]` — 1–2 NL chips when that collection is selected
- Country filter fields when applicable (e.g. address country paths on Shipment)

UI Database select filters Collections; Schema panel shows `keyFields` for the
selected collection (no live Mongo fetch in this iteration — button can stay
disabled or show “catalog schema”).

## Data model (Postgres)

Prisma model + `@@map("mongo_query_runs")`:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT PK | cuid |
| `name` | TEXT | short title from LLM or derived |
| `naturalLanguage` | TEXT | user prompt |
| `query` | TEXT | generated Mongo shell query |
| `database` | TEXT | e.g. `NESY_ShipmentDB` |
| `collection` | TEXT | e.g. `Shipment` |
| `environment` | TEXT | Development / Test / UAT / Production |
| `queryType` | TEXT | Find / Aggregate / Count / Distinct |
| `country` | TEXT? | HR, SI, … or All |
| `status` | TEXT | `validated` \| `warning` |
| `explanation` | JSONB | string[] |
| `validation` | JSONB | checks[] |
| `estimatedScope` | JSONB? | optional |
| `safetyToggles` | JSONB? | toggles snapshot |
| `model` | TEXT? | e.g. `haiku` |
| `createdBy` | TEXT | default `local` until auth wired |
| `owner` | TEXT? | optional |
| `relatedTicket` | TEXT? | optional |
| `relatedIncident` | TEXT? | optional |
| `createdAt` | TIMESTAMP | |
| `lastUsedAt` | TIMESTAMP | set on create; bump if exact reuse later (optional) |

Indexes: `(lastUsedAt DESC)`, `(collection)`, `(environment)`.

### Migration

1. Update `packages/db/prisma/schema.prisma` with `MongoQueryRun` model.
2. Add `packages/db/prisma/manual-migrations/20260718_mongo_query_runs.sql`
   (`CREATE TABLE IF NOT EXISTS` + indexes) matching existing workflow migration style.
3. Run via `pnpm exec prisma db execute --file …` (document in migration header).

## API

Express router mounted at `/api/mongo-query` (same pattern as courier-wallets):

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/catalog` | Return databases + collections + keyFields + example prompts |
| `GET` | `/recent?limit=50` | List recent runs from DB |
| `GET` | `/recent/:id` | Single run detail |
| `POST` | `/generate` | Body: NL, environment, database, collection, queryType, country, timeRange, toggles → Claude CLI → validate → insert → return |

`POST /generate` response includes the persisted row (id + all fields needed by
workspace tabs).

Env additions (`apps/api`):

- `CLAUDE_CLI_PATH` (optional)
- `CLAUDE_MONGO_QUERY_MODEL` (default `haiku`)
- `CLAUDE_MONGO_QUERY_TIMEOUT_MS` (default `90000`)

## UI changes

Files primarily under:

- `apps/web/src/data/engineering/tools/mongodb-generator.ts` → catalog constants + types; remove fake DBs/RECENT_QUERIES mock list
- `page.tsx` / `workspace.tsx` / `recent-queries.tsx` → fetch catalog + recent; call generate; show loading/error; bind workspace to API result

Behavior:

- Defaults: first core DB/collection (`NESY_ShipmentDB` / `Shipment`)
- Example chips from selected collection’s `examplePrompts`
- Generate disabled while request in flight; show error toast/banner if CLI fails
- Recent table: load from API on mount; refresh after successful generate
- Reuse: fill form + show prior generated result; optionally bump `lastUsedAt` (nice-to-have)

## Error handling

| Case | UX |
| --- | --- |
| Claude CLI not on PATH | Clear message: install/login Claude Code; set `CLAUDE_CLI_PATH` |
| Auth / quota failure | Surface CLI stderr snippet (sanitized) |
| Timeout | Ask to retry; no DB insert |
| Write intent in NL | Keep amber notice; still generate only if CLI returns read-only (server rejects writes) |
| Invalid JSON from model | 502 + log raw result; no insert |

## Testing

- Unit: guardrail rewrite/reject; catalog shape; CLI stdout JSON parse helpers
- Manual: Generate against `Shipment` with haiku; row appears in Recent; page reload still shows it
- Migration: table exists after SQL execute; Prisma client can create/list

## Implementation order

1. Prisma model + manual migration + run migration
2. Core catalog TS module (real names/fields from Documents)
3. Claude CLI runner + generate/recent/catalog routes
4. Wire UI to API; remove mock recent/generated constants
5. Smoke-test Generate + Recent on localhost

## Open follow-ups (out of scope)

- Wire `createdBy` to real cockpit auth user
- Optional “Save as favorite” / rename
- Live Mongo schema fetch button
- Expand catalog beyond core set
