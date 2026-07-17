# MongoDB Query Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace mock MongoDB Query Generator with a real NESY collection catalog, Claude CLI (haiku) generation, and Postgres-backed recent query history.

**Architecture:** Static catalog in `apps/api`; `POST /api/mongo-query/generate` spawns `claude -p --bare --model haiku`; results persist to `mongo_query_runs`; UI loads catalog/recent and displays generated workspace from API.

**Tech Stack:** Prisma/Postgres, Express (legacy routers), Fastify host, Next.js client, Claude Code CLI.

## Global Constraints

- Default model: `haiku` (`CLAUDE_MONGO_QUERY_MODEL`)
- Auto-save on every successful Generate
- Read-only queries only (server reject write ops)
- Core catalog only (~15–25 collections from real `BsonCollection` names)
- Manual SQL migration alongside Prisma schema (repo pattern)
- Do not commit unless user explicitly asks

---

### Task 1: Prisma model + manual migration

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/manual-migrations/20260718_mongo_query_runs.sql`
- Modify: `packages/db/src/index.ts` (only if exports need update)

**Interfaces:**
- Produces: Prisma model `MongoQueryRun` mapped to `mongo_query_runs`

- [ ] **Step 1: Add Prisma model**

```prisma
model MongoQueryRun {
  id               String   @id @default(cuid())
  name             String
  naturalLanguage  String
  query            String
  database         String
  collection       String
  environment      String
  queryType        String
  country          String?
  status           String
  explanation      Json
  validation       Json
  estimatedScope   Json?
  safetyToggles    Json?
  model            String?
  createdBy        String   @default("local")
  owner            String?
  relatedTicket    String?
  relatedIncident  String?
  createdAt        DateTime @default(now())
  lastUsedAt       DateTime @default(now())

  @@index([lastUsedAt])
  @@index([collection])
  @@index([environment])
  @@map("mongo_query_runs")
}
```

- [ ] **Step 2: Write SQL migration** matching columns/indexes with `CREATE TABLE IF NOT EXISTS`

- [ ] **Step 3: Generate Prisma client + execute migration**

```bash
pnpm --filter @nesy/db exec prisma generate
pnpm --filter @nesy/db exec prisma db execute --file prisma/manual-migrations/20260718_mongo_query_runs.sql
```

---

### Task 2: Core catalog + guardrails + Claude runner

**Files:**
- Create: `apps/api/src/data/mongo-catalog.ts`
- Create: `apps/api/src/lib/mongo-query-guardrails.ts`
- Create: `apps/api/src/lib/claude-cli.ts`
- Create: `apps/api/src/lib/mongo-query-guardrails.test.ts` (or colocated test if suite pattern exists)

**Interfaces:**
- Produces:
  - `MONGO_CATALOG`, `getCollectionEntry(db, collection)`, `listDatabases()`
  - `assertReadOnlyQuery(query: string): void`
  - `ensureLimit(query: string, queryType: string): string`
  - `runClaudePrompt(prompt: string, opts): Promise<{ resultText: string; model: string }>`

- [ ] **Step 1: Implement catalog** with real DB/collection names and keyFields for core set from spec
- [ ] **Step 2: Implement guardrails** (reject write ops; append limit)
- [ ] **Step 3: Implement Claude CLI spawn** (`--bare`, `--model haiku`, `--output-format json`, `--max-turns 1`, timeout, path resolve)

---

### Task 3: API router

**Files:**
- Create: `apps/api/src/legacy/mongo-query.router.ts`
- Modify: `apps/api/src/app.ts` — mount `/api/mongo-query`
- Modify: `apps/api/src/env.ts` — optional Claude env vars

**Interfaces:**
- `GET /api/mongo-query/catalog`
- `GET /api/mongo-query/recent?limit=50`
- `GET /api/mongo-query/recent/:id`
- `POST /api/mongo-query/generate`

- [ ] **Step 1: Implement router** following `courier-wallets.router.ts` Express style
- [ ] **Step 2: Wire into `app.ts` express mount list + JSON middleware path allowlist**
- [ ] **Step 3: Add env defaults for Claude settings**

---

### Task 4: Wire UI

**Files:**
- Modify: `apps/web/src/data/engineering/tools/mongodb-generator.ts`
- Modify: `apps/web/src/app/(cockpit)/engineering/tools/mongodb-query-generator/page.tsx`
- Modify: `apps/web/src/app/(cockpit)/engineering/tools/mongodb-query-generator/workspace.tsx`
- Modify: `apps/web/src/app/(cockpit)/engineering/tools/mongodb-query-generator/recent-queries.tsx`
- Create (if needed): `apps/web/src/services/mongo-query.ts` for fetch helpers

**Interfaces:**
- Consumes API types from generate/recent/catalog responses
- Workspace receives generated result object (not static mock)

- [ ] **Step 1: API client helpers** (base URL same pattern as other services)
- [ ] **Step 2: Page loads catalog; Generate calls API; auto-refresh recent**
- [ ] **Step 3: Workspace + recent table bind to live data; remove RECENT_QUERIES mock**

---

### Task 5: Verify

- [ ] Migration applied
- [ ] `GET /api/mongo-query/catalog` returns real DBs
- [ ] Generate (manual or curl) inserts row; recent lists it
- [ ] `graphify update .` after code changes if graph exists
