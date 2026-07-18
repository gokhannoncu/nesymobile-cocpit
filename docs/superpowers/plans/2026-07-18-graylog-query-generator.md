# Graylog Query Generator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the Graylog Query Generator to match the MongoDB tool shell (vertical form → workspace → recent history) and generate/persist real Lucene queries via Claude CLI + Postgres.

**Architecture:** Parallel Mongo stack — curated field dictionary in `apps/api`, Express router at `/api/graylog-query` calling shared `runClaudePrompt`, rows in `graylog_query_runs`, Next.js page wired through `services/graylog-query.ts` with Mongo-parity `workspace.tsx` / `recent-queries.tsx`.

**Tech Stack:** Prisma/Postgres, Express (legacy routers), Next.js client, Vitest, Claude Code CLI (`apps/api/src/lib/claude-cli.ts`), framer-motion (workspace animation).

## Global Constraints

- Default model: `haiku` via `CLAUDE_GRAYLOG_QUERY_MODEL` (fallback `CLAUDE_MONGO_QUERY_MODEL` then `haiku`)
- Auto-save on every successful Generate
- Search-only queries; reject mutation/admin Graylog syntax server-side
- Manual SQL migration alongside Prisma schema (repo pattern)
- Copy Mongo UI patterns; do **not** extract a shared query-tool shell
- No live Graylog execute / Open-in-Graylog deep-link
- Do not commit unless the user explicitly asks
- After code changes: `graphify update .` if `graphify-out/graph.json` exists

## File map

| File | Responsibility |
| --- | --- |
| `packages/db/prisma/schema.prisma` | `GraylogQueryRun` model |
| `packages/db/prisma/manual-migrations/20260718_graylog_query_runs.sql` | Table + indexes |
| `apps/api/src/data/graylog-fields.ts` | Field dictionary source of truth |
| `apps/api/src/lib/graylog-query-guardrails.ts` | Search-only assert + status/quality helpers |
| `apps/api/src/lib/graylog-query-guardrails.test.ts` | Unit tests |
| `apps/api/src/legacy/graylog-query.router.ts` | REST API |
| `apps/api/src/app.ts` | Mount + JSON allowlist |
| `apps/api/src/env.ts` | Optional Graylog Claude env vars |
| `apps/web/src/services/graylog-query.ts` | Fetch client + types |
| `apps/web/.../graylog-query-generator/workspace.tsx` | Empty / generating / result |
| `apps/web/.../graylog-query-generator/recent-queries.tsx` | History table + sheet |
| `apps/web/.../graylog-query-generator/page.tsx` | Vertical shell + form |
| Delete `result-panel.tsx`, `investigations.tsx` after replacements |
| `apps/web/src/data/engineering/tools/graylog-generator.ts` | Keep UI options/chips; drop mock runtime sources |

---

### Task 1: Prisma model + manual migration

**Files:**
- Modify: `packages/db/prisma/schema.prisma` (append after `MongoQueryRun`)
- Create: `packages/db/prisma/manual-migrations/20260718_graylog_query_runs.sql`

**Interfaces:**
- Produces: Prisma model `GraylogQueryRun` → table `graylog_query_runs`

- [ ] **Step 1: Add Prisma model** after `MongoQueryRun` in `schema.prisma`:

```prisma
model GraylogQueryRun {
  id               String   @id @default(cuid())
  name             String
  naturalLanguage  String
  query            String
  environment      String
  country          String?
  application      String
  service          String?
  logLevel         String?
  timeRange        String
  device           String?
  appVersion       String?
  identifiers      Json?
  sources          Json?
  status           String
  explanation      Json
  validation       Json
  quality          Json?
  expectedSignals  Json?
  summary          String?
  model            String?
  createdBy        String   @default("local")
  relatedIncident  String?
  createdAt        DateTime @default(now())
  lastUsedAt       DateTime @default(now())

  @@index([lastUsedAt])
  @@index([environment])
  @@index([country])
  @@map("graylog_query_runs")
}
```

- [ ] **Step 2: Write SQL migration**

```sql
-- aras_db: Graylog Query Generator history
-- Çalıştırma:
--   pnpm --filter @nesy/db exec prisma db execute --file prisma/manual-migrations/20260718_graylog_query_runs.sql --schema prisma/schema.prisma

CREATE TABLE IF NOT EXISTS "graylog_query_runs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "naturalLanguage" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "environment" TEXT NOT NULL,
    "country" TEXT,
    "application" TEXT NOT NULL,
    "service" TEXT,
    "logLevel" TEXT,
    "timeRange" TEXT NOT NULL,
    "device" TEXT,
    "appVersion" TEXT,
    "identifiers" JSONB,
    "sources" JSONB,
    "status" TEXT NOT NULL,
    "explanation" JSONB NOT NULL,
    "validation" JSONB NOT NULL,
    "quality" JSONB,
    "expectedSignals" JSONB,
    "summary" TEXT,
    "model" TEXT,
    "createdBy" TEXT NOT NULL DEFAULT 'local',
    "relatedIncident" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "graylog_query_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "graylog_query_runs_lastUsedAt_idx" ON "graylog_query_runs"("lastUsedAt");
CREATE INDEX IF NOT EXISTS "graylog_query_runs_environment_idx" ON "graylog_query_runs"("environment");
CREATE INDEX IF NOT EXISTS "graylog_query_runs_country_idx" ON "graylog_query_runs"("country");
```

- [ ] **Step 3: Generate client + execute migration**

```bash
pnpm --filter @nesy/db exec prisma generate
pnpm --filter @nesy/db exec prisma db execute --file prisma/manual-migrations/20260718_graylog_query_runs.sql --schema prisma/schema.prisma
```

Expected: generate succeeds; execute exits 0 (table created or already exists).

---

### Task 2: Field dictionary + guardrails (TDD)

**Files:**
- Create: `apps/api/src/data/graylog-fields.ts`
- Create: `apps/api/src/lib/graylog-query-guardrails.ts`
- Create: `apps/api/src/lib/graylog-query-guardrails.test.ts`
- Source fields from: `apps/web/src/data/engineering/tools/graylog-generator.ts` (`GRAYLOG_FIELDS` array)

**Interfaces:**
- Produces:
  - `export type GraylogField = { field: string; meaning: string; example: string; source: string }`
  - `export function getGraylogFields(): GraylogField[]`
  - `export function getFieldsPayload(): { fields: GraylogField[] }`
  - `export class UnsafeGraylogQueryError extends Error`
  - `export function assertSearchOnlyQuery(query: string): void`
  - `export function deriveStatus(validation: Array<{ status?: string }>): 'validated' | 'warning'`
  - `export function hasIdentifier(identifiers: Record<string, string> | null | undefined): boolean`
  - `export function buildQuality(input: { identifiers: Record<string, string>; timeRange: string; environment: string; llmQuality?: { verdict?: string; explanation?: string } | null }): { verdict: 'strong' | 'broad'; explanation: string }`
  - `export function ensureValidationChecks(input: { validation: Array<{ id?: string; label?: string; detail?: string; status?: string }>; query: string; timeRange: string; identifiers: Record<string, string>; environment: string }): Array<{ id: string; label: string; detail: string; status: 'pass' | 'warn' }>`

- [ ] **Step 1: Write failing tests** in `graylog-query-guardrails.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  assertSearchOnlyQuery,
  buildQuality,
  deriveStatus,
  hasIdentifier,
  UnsafeGraylogQueryError,
} from './graylog-query-guardrails.js'

describe('graylog-query-guardrails', () => {
  it('rejects stream delete / indexer mutation syntax', () => {
    expect(() => assertSearchOnlyQuery('delete streams:abc')).toThrow(UnsafeGraylogQueryError)
    expect(() => assertSearchOnlyQuery('| delete')).toThrow(UnsafeGraylogQueryError)
  })

  it('allows normal Lucene search', () => {
    expect(() =>
      assertSearchOnlyQuery('application:nesy-mobile AND shipmentId:"45-40-20251224-1"'),
    ).not.toThrow()
  })

  it('detects identifiers', () => {
    expect(hasIdentifier({ shipmentId: 'x', courierId: '' })).toBe(true)
    expect(hasIdentifier({ shipmentId: '', courierId: '  ' })).toBe(false)
  })

  it('marks broad quality when 24h and no identifier', () => {
    const q = buildQuality({
      identifiers: {},
      timeRange: '24h',
      environment: 'production',
    })
    expect(q.verdict).toBe('broad')
  })

  it('marks strong when identifier present', () => {
    const q = buildQuality({
      identifiers: { shipmentId: '45-40-20251224-1' },
      timeRange: '1h',
      environment: 'production',
    })
    expect(q.verdict).toBe('strong')
  })

  it('derives warning status', () => {
    expect(deriveStatus([{ status: 'pass' }, { status: 'warn' }])).toBe('warning')
    expect(deriveStatus([{ status: 'pass' }])).toBe('validated')
  })
})
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
pnpm --filter @nesy/api test -- src/lib/graylog-query-guardrails.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement `graylog-fields.ts`** — copy the 8 `GRAYLOG_FIELDS` entries from the web data file into API; export `getGraylogFields()` / `getFieldsPayload()`.

- [ ] **Step 4: Implement `graylog-query-guardrails.ts`**

```ts
const UNSAFE_PATTERNS: RegExp[] = [
  /\bdelete\s+streams?\b/i,
  /\|\s*delete\b/i,
  /\bdrop\s+index/i,
  /\bremove\s+messages?\b/i,
]

export class UnsafeGraylogQueryError extends Error {
  constructor(message = 'Generated query contains unsafe Graylog operations and was rejected.') {
    super(message)
    this.name = 'UnsafeGraylogQueryError'
  }
}

export function assertSearchOnlyQuery(query: string): void {
  const text = query.trim()
  for (const pattern of UNSAFE_PATTERNS) {
    if (pattern.test(text)) {
      throw new UnsafeGraylogQueryError(`Unsafe operator matched: ${pattern}`)
    }
  }
}

export function deriveStatus(
  validation: Array<{ status?: string }>,
): 'validated' | 'warning' {
  return validation.some((v) => v.status === 'warn') ? 'warning' : 'validated'
}

export function hasIdentifier(
  identifiers: Record<string, string> | null | undefined,
): boolean {
  if (!identifiers) return false
  return Object.values(identifiers).some((v) => String(v ?? '').trim().length > 0)
}

export function buildQuality(input: {
  identifiers: Record<string, string>
  timeRange: string
  environment: string
  llmQuality?: { verdict?: string; explanation?: string } | null
}): { verdict: 'strong' | 'broad'; explanation: string } {
  if (input.llmQuality?.verdict === 'strong' || input.llmQuality?.verdict === 'broad') {
    return {
      verdict: input.llmQuality.verdict,
      explanation:
        input.llmQuality.explanation?.trim() ||
        (input.llmQuality.verdict === 'strong'
          ? 'Search scope looks narrow enough.'
          : 'Search scope looks broad — add an identifier or shorten the time range.'),
    }
  }
  const identified = hasIdentifier(input.identifiers)
  if (!identified && (input.timeRange === '24h' || input.timeRange === 'custom')) {
    return {
      verdict: 'broad',
      explanation:
        'No identifier with a wide time range. Add shipmentId, requestId, or a service filter.',
    }
  }
  if (identified) {
    return {
      verdict: 'strong',
      explanation: 'An identifier narrows the search scope.',
    }
  }
  return {
    verdict: 'broad',
    explanation: 'No strong identifier — results may be noisy.',
  }
}

export function ensureValidationChecks(input: {
  validation: Array<{ id?: string; label?: string; detail?: string; status?: string }>
  query: string
  timeRange: string
  identifiers: Record<string, string>
  environment: string
}): Array<{ id: string; label: string; detail: string; status: 'pass' | 'warn' }> {
  const base = input.validation
    .filter((v) => v && (v.label || v.id))
    .map((v, i) => ({
      id: String(v.id ?? `check-${i}`),
      label: String(v.label ?? 'Check'),
      detail: String(v.detail ?? ''),
      status: (v.status === 'warn' ? 'warn' : 'pass') as 'pass' | 'warn',
    }))

  const hasTimeHint =
    /\d+\s*(m|h|d)\b/i.test(input.query) ||
    /timestamp|from:|to:/i.test(input.query) ||
    Boolean(input.timeRange)
  if (!base.some((c) => c.id === 'time')) {
    base.push({
      id: 'time',
      label: 'Time range',
      detail: hasTimeHint
        ? `Context time range: ${input.timeRange}`
        : 'No explicit time filter in query string — rely on Graylog UI range.',
      status: input.timeRange ? 'pass' : 'warn',
    })
  }

  if (!hasIdentifier(input.identifiers) && input.timeRange === '24h') {
    if (!base.some((c) => c.id === 'scope')) {
      base.push({
        id: 'scope',
        label: 'Search scope',
        detail: '24h without identifier — broad volume risk.',
        status: 'warn',
      })
    }
  }

  return base
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
pnpm --filter @nesy/api test -- src/lib/graylog-query-guardrails.test.ts
```

Expected: all tests PASS.

---

### Task 3: API router + mount + env

**Files:**
- Create: `apps/api/src/legacy/graylog-query.router.ts`
- Modify: `apps/api/src/app.ts` — add `/api/graylog-query` to JSON allowlist + mount
- Modify: `apps/api/src/env.ts` — add Graylog Claude env vars

**Interfaces:**
- Consumes: `runClaudePrompt`, `extractJsonObject`, `ClaudeCliError` from `../lib/claude-cli.js`
- Consumes: guardrails + `getFieldsPayload` / `getGraylogFields`
- Produces HTTP:
  - `GET /api/graylog-query/fields` → `{ data: { fields } }`
  - `GET /api/graylog-query/recent?limit=50` → `{ data: GraylogQueryRunDto[] }`
  - `GET /api/graylog-query/recent/:id`
  - `POST /api/graylog-query/generate` body below → `201 { data }`
  - `POST /api/graylog-query/recent/:id/reuse`
  - `DELETE /api/graylog-query/recent/:id` → `204`

**Generate body:**

```ts
{
  naturalLanguage: string
  environment: string
  country: string
  application: string
  service: string
  logLevel: string
  timeRange: string
  device: string
  appVersion: string
  identifiers: Record<string, string>
  sources: string[]
}
```

**DTO fields** (ISO date strings for timestamps): `id`, `name`, `naturalLanguage`, `query`, `environment`, `country`, `application`, `service`, `logLevel`, `timeRange`, `device`, `appVersion`, `identifiers`, `sources`, `status`, `explanation` (string[]), `validation` (checks[]), `quality`, `expectedSignals`, `summary`, `model`, `createdBy`, `relatedIncident`, `createdAt`, `lastUsedAt`.

- [ ] **Step 1: Add env vars** in `apps/api/src/env.ts`:

```ts
CLAUDE_GRAYLOG_QUERY_MODEL: z.string().default('haiku'),
CLAUDE_GRAYLOG_QUERY_TIMEOUT_MS: z.coerce.number().int().positive().default(90_000),
```

- [ ] **Step 2: Implement router** mirroring `mongo-query.router.ts` structure:

`buildPrompt` must:
- Instruct Graylog Lucene / search syntax only
- Inject field dictionary lines from `getGraylogFields()`
- Include all context fields + identifiers + sources
- Ask for JSON keys: `name`, `query`, `summary`, `explanation`, `validation`, `quality`, `expectedSignals`
- Forbid delete/drop/indexer ops; prefer identifier + time narrowing

`POST /generate` flow:
1. Validate `naturalLanguage` non-empty
2. Normalize identifiers object + sources array
3. `runClaudePrompt(prompt, { model: process.env.CLAUDE_GRAYLOG_QUERY_MODEL ?? 'haiku', timeoutMs: Number(process.env.CLAUDE_GRAYLOG_QUERY_TIMEOUT_MS ?? 90_000) })`
4. `extractJsonObject` → require `query` string
5. `assertSearchOnlyQuery(query)`
6. `ensureValidationChecks(...)` + `buildQuality(...)` + `deriveStatus`
7. `prisma.graylogQueryRun.create(...)`
8. Return `201` mapped DTO
9. Catch `UnsafeGraylogQueryError` → 422; `ClaudeCliError` → 503; else 500

`mapRow` must coerce JSON fields to arrays/objects safely (same style as mongo `mapRow`).

- [ ] **Step 3: Mount in `app.ts`**

In the JSON allowlist condition, add:

```ts
path.startsWith('/api/graylog-query') ||
```

After mongo mount:

```ts
const { default: graylogQueryRouter } = await import('./legacy/graylog-query.router.js')
dataCenterApi.use('/api/graylog-query', graylogQueryRouter)
```

- [ ] **Step 4: Smoke GET fields** (API running on 4001):

```bash
curl -s http://localhost:4001/api/graylog-query/fields
```

Expected: JSON with `data.fields` array length ≥ 8.

---

### Task 4: Web service client

**Files:**
- Create: `apps/web/src/services/graylog-query.ts`

**Interfaces:**
- Produces types + functions consumed by page/workspace/recent:
  - `GraylogField`, `GraylogValidationCheck`, `GraylogQuality`, `GraylogQueryRun`
  - `fetchGraylogFields(): Promise<GraylogField[]>`
  - `fetchRecentGraylogQueries(limit?: number): Promise<GraylogQueryRun[]>`
  - `generateGraylogQuery(input: GenerateGraylogInput): Promise<GraylogQueryRun>`
  - `reuseGraylogQuery(id: string): Promise<GraylogQueryRun>`
  - `deleteGraylogQuery(id: string): Promise<void>`

- [ ] **Step 1: Implement client** following `apps/web/src/services/mongo-query.ts` patterns (`API_BASE`, `readError`, `{ data }` unwrap, `normalizeRun` for explanation/validation arrays).

```ts
import { API_BASE } from '@/services/api'

export type GraylogField = {
  field: string
  meaning: string
  example: string
  source: string
}

export type GraylogValidationCheck = {
  id?: string
  label?: string
  detail?: string
  status?: 'pass' | 'warn' | string
}

export type GraylogQuality = {
  verdict?: 'strong' | 'broad' | string
  explanation?: string
} | null

export type GraylogQueryRun = {
  id: string
  name: string
  naturalLanguage: string
  query: string
  environment: string
  country: string | null
  application: string
  service: string | null
  logLevel: string | null
  timeRange: string
  device: string | null
  appVersion: string | null
  identifiers: Record<string, string> | null
  sources: string[] | null
  status: string
  explanation: string[]
  validation: GraylogValidationCheck[]
  quality: GraylogQuality
  expectedSignals?: string[] | null
  summary?: string | null
  model?: string | null
  createdBy: string
  relatedIncident?: string | null
  createdAt: string
  lastUsedAt: string
}

export type GenerateGraylogInput = {
  naturalLanguage: string
  environment: string
  country: string
  application: string
  service: string
  logLevel: string
  timeRange: string
  device: string
  appVersion: string
  identifiers: Record<string, string>
  sources: string[]
}

// Implement fetchGraylogFields, fetchRecentGraylogQueries,
// generateGraylogQuery, reuseGraylogQuery, deleteGraylogQuery
// exactly like mongo-query.ts path shapes under `${API_BASE}/graylog-query/...`
```

---

### Task 5: Workspace UI (empty / generating / result)

**Files:**
- Create: `apps/web/src/app/(cockpit)/engineering/tools/graylog-query-generator/workspace.tsx`
- Reference: `apps/web/src/app/(cockpit)/engineering/tools/mongodb-query-generator/workspace.tsx`
- Use: `@/components/engineering/tools/shared` `CodeBlock` for Lucene (not Mongo editor)

**Interfaces:**
- Consumes: `GraylogQueryRun` from `@/services/graylog-query`
- Produces: `export function QueryWorkspace({ run, loading }: { run: GraylogQueryRun | null; loading?: boolean })`

- [ ] **Step 1: Port Mongo workspace structure** with Graylog labels:
  - `GENERATE_STEPS`: Mapping field dictionary → Composing Claude prompt → Running Claude CLI (haiku) → Applying search-only guardrails → Formatting Graylog Lucene query
  - Sample typewriter lines: `application:nesy-mobile`, `AND country:HR`, `AND shipmentId:"…"`
  - Empty state icon: `Terminal` or `SearchX`; copy: “Graylog query not yet generated”
  - Tabs: `Generated Query` | `Explanation` | `Validation`
  - Generated Query tab: context summary line (`environment · country · timeRange · N sources`) + `CodeBlock` with `label="graylog"` `labelTone="orange"`
  - Explanation: numbered list from `run.explanation`
  - Validation: pass/warn cards from `run.validation` (same card UI as Mongo)
  - Bottom panel `QueryQuality` from `run.quality` (verdict strong/broad + explanation); if missing, derive from status

- [ ] **Step 2: Keep forward-only animation** (`STEP_ENTER_AT_MS`, park on CLI step, finish on `complete`) identical timing to Mongo.

---

### Task 6: Recent Queries table

**Files:**
- Create: `apps/web/src/app/(cockpit)/engineering/tools/graylog-query-generator/recent-queries.tsx`
- Reference: Mongo `recent-queries.tsx` (table + Sheet + delete AlertDialog)
- Optional shimmer: reuse simple loading rows or copy Mongo shimmer pattern without new file if small

**Interfaces:**
- Produces: `export function RecentQueriesTable({ queries, loading, error, onReuse, onDelete })`
- Columns: Query name | Application | Country | Time range | Created by | Last used | Status | Actions
- Sheet details: NL prompt, query `CodeBlock`, explanation list, quality verdict, related incident if any
- Actions: Details, Delete (confirm), Reuse button in sheet calling `onReuse`

- [ ] **Step 1: Implement table** binding to `GraylogQueryRun`
- [ ] **Step 2: `formatLastUsed`** — either import a small shared helper or copy the relative-time helper from `mongodb-generator.ts` into `graylog-generator.ts` as `formatLastUsed(iso: string)`

---

### Task 7: Page vertical shell + wire API

**Files:**
- Modify: `apps/web/src/app/(cockpit)/engineering/tools/graylog-query-generator/page.tsx`
- Modify: `apps/web/src/data/engineering/tools/graylog-generator.ts` — keep options/chips/guardrail strings; stop exporting mock `GENERATED_QUERY` / `SAVED_INVESTIGATIONS` as required runtime (delete constants if unused)
- Delete: `result-panel.tsx`, `investigations.tsx` after page no longer imports them

**Interfaces:**
- Page state mirrors current form fields + adds: `fields`, `fieldsLoading`, `result`, `generating`, `generateError`, `recent`, `recentLoading`, `recentError`, `fieldDictOpen`, `fieldFilter`
- Layout:

```tsx
<ProductPage path={PATH}>
  <ToolHeader ... lead=... tone="orange" /> {/* drop large badge strip or keep ≤3 badges */}
  <div className="space-y-6">
    <ToolCard step="1" title="Define your log needs" description="..." className="w-full">
      {/* chips, textarea, context grid, identifiers, sources,
          collapsible Field dictionary, amber guardrail, Generate/Clear */}
    </ToolCard>
    <div className="w-full">
      <QueryWorkspace run={result} loading={generating} />
    </div>
  </div>
  <PageSection eyebrow="History" title="Recent Queries" icon={History} tone="orange" description="...">
    <RecentQueriesTable ... />
  </PageSection>
</ProductPage>
```

- [ ] **Step 1: Restructure layout** — remove `xl:grid-cols-[45fr_55fr]`; stack ToolCard then Workspace
- [ ] **Step 2: Move field dictionary** into `Collapsible` inside ToolCard (Mongo schema panel styling); click row appends `field:` to textarea
- [ ] **Step 3: Load fields + recent on mount** via service client
- [ ] **Step 4: `onGenerate`** calls `generateGraylogQuery`, sets `result`, refreshes recent; disable button while `generating` or empty NL; show amber `generateError`
- [ ] **Step 5: Reuse/delete** wire to recent table; reuse fills form + `setResult` + scroll top + `reuseGraylogQuery`
- [ ] **Step 6: Delete** `result-panel.tsx` and `investigations.tsx`; remove unused mock exports from `graylog-generator.ts`

---

### Task 8: Verify end-to-end

**Files:** none new

- [ ] **Step 1: Unit tests still pass**

```bash
pnpm --filter @nesy/api test -- src/lib/graylog-query-guardrails.test.ts
```

- [ ] **Step 2: API smoke**

```bash
curl -s http://localhost:4001/api/graylog-query/fields
curl -s http://localhost:4001/api/graylog-query/recent
```

- [ ] **Step 3: Manual UI** at `http://localhost:4002/engineering/tools/graylog-query-generator`
  - Page is vertical (form above, workspace below)
  - Field dictionary collapsible works
  - Generate with shipment identifier shows animation then query tabs
  - Recent row appears; reload still shows it
  - Reuse + delete work

- [ ] **Step 4: graphify** (if graph exists)

```bash
graphify update .
```

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| Vertical Mongo-parity layout | 7 |
| Field dictionary collapsible in form | 7 |
| Recent Queries DB history | 1, 3, 6, 7 |
| Claude CLI generate (haiku) | 3 |
| Prisma + manual migration | 1 |
| Workspace empty/anim/tabs/quality | 5 |
| Guardrails search-only + broad warn | 2, 3 |
| Web service client | 4 |
| Non-goals (no live Graylog, no shared shell) | respected |

## Self-review notes

- No TBD placeholders
- Types aligned: `GraylogQueryRun` fields match Prisma + router DTO + web service
- `runClaudePrompt` opts carry Graylog model/timeout without forking `claude-cli.ts`
- Commit steps omitted per Global Constraints (user must ask)
