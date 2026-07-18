# Graylog Query Generator — MongoDB Parity UI + Claude CLI + DB History

**Date:** 2026-07-18  
**Status:** Draft for review  
**App:** NesyMobileCocpit (`/engineering/tools/graylog-query-generator`)

## Problem

The Graylog Query Generator page uses a side-by-side form/result layout, mock
generated queries, and static “Saved Investigations.” It does not match the
MongoDB Query Generator’s vertical tool shell (form → workspace → recent
history) and does not generate or persist real queries.

## Goals

1. **UI parity with MongoDB Query Generator** — full-width vertical layout,
   ToolCard form, QueryWorkspace (empty → generating animation → result tabs),
   Recent Queries history section.
2. Move **Common Graylog Fields** into a collapsible “Field dictionary” inside
   the form card (Mongo schema-information pattern).
3. Replace mock Saved Investigations with **DB-backed Recent Queries**
   (auto-save on Generate).
4. Generate queries via **Claude Code CLI** on the host (`runClaudePrompt`),
   default model **haiku**, parallel to Mongo’s stack.
5. Ship **Prisma model + manual SQL migration** for `graylog_query_runs`.

## Non-goals

- Executing searches against a live Graylog cluster
- Real “Open in Graylog” deep-link (toolbar may stay mock/disabled)
- Shared abstracted “query tool shell” refactor across Mongo + Graylog
  (deferred; copy Mongo patterns instead)
- Auth-wired `createdBy` (default `local` until cockpit auth is wired)

## Decisions (approved)

| Topic | Choice |
| --- | --- |
| Scope | C — full page Mongo alignment (not layout-only) |
| Field dictionary | A — collapsible inside form card |
| History | Recent Queries table (Mongo pattern); drop static investigations |
| Generate UX | C — generating animation + real Claude CLI backend |
| Implementation approach | 1 — parallel Mongo stack (separate router/table/UI files) |
| LLM runtime | Reuse `apps/api/src/lib/claude-cli.ts` |
| Model | `haiku` (env override `CLAUDE_GRAYLOG_QUERY_MODEL`) |
| History write | Auto-save on every successful Generate |

## UI layout

```
ProductPage
├── ToolHeader (Terminal, tone orange)
├── space-y-6
│   ├── ToolCard step=1 — "Define your log needs"
│   │   ├── Scenario chips (existing SCENARIO_CHIPS)
│   │   ├── Natural language textarea
│   │   ├── Context selects (env, country, application, service,
│   │   │   log level, time range, device, app version)
│   │   ├── Known identifiers + Log sources
│   │   ├── Collapsible Field dictionary (GRAYLOG_FIELDS + search)
│   │   ├── Amber guardrail (24h + no identifier)
│   │   └── Generate / Clear
│   └── QueryWorkspace (full width)
│       ├── EmptyState
│       ├── GeneratingAnimation (Graylog-flavored steps)
│       └── Result: tabs + Query Quality panel
└── PageSection "Recent Queries"
```

### File changes (web)

| Current | Target |
| --- | --- |
| `page.tsx` | Restructure to Mongo vertical shell; wire API |
| `result-panel.tsx` | Replace with `workspace.tsx` |
| `investigations.tsx` | Replace with `recent-queries.tsx` |
| `graylog-generator.ts` | Keep presentation constants/options; remove mock
  `GENERATED_QUERY` / `SAVED_INVESTIGATIONS` as runtime sources |
| (new) | `apps/web/src/services/graylog-query.ts` — fetch helpers |

### Workspace tabs

| Tab | Content |
| --- | --- |
| Generated Query | Code block / editor + context summary bar |
| Explanation | Step list (maps from former Query Breakdown) |
| Validation | Quality checks as pass/warn cards |

Below tabs: **Query Quality** panel (strong/broad verdict + check grid),
analogous to Mongo **Estimated Scope**.

### Generating animation steps

1. Mapping field dictionary  
2. Composing Claude prompt  
3. Running Claude CLI (haiku)  
4. Applying search-only guardrails  
5. Formatting Graylog Lucene query  

Forward-only park-on-CLI behavior mirrors Mongo `workspace.tsx`.

## Architecture

```
UI (Generate) → POST /api/graylog-query/generate
                    → load field dictionary into prompt
                    → runClaudePrompt (haiku)
                    → parse + validate (search-only, time range)
                    → INSERT graylog_query_runs
                    → return result to UI

UI (Recent)   → GET /api/graylog-query/recent
                    → SELECT ORDER BY lastUsedAt DESC
```

### Claude CLI

Reuse `runClaudePrompt` / `extractJsonObject`. Prefer Graylog-specific env
overrides with fallback to Mongo defaults where sensible:

- `CLAUDE_GRAYLOG_QUERY_MODEL` (default `haiku`)
- `CLAUDE_GRAYLOG_QUERY_TIMEOUT_MS` (default `90000`)
- `CLAUDE_CLI_PATH` (shared)

Prompt asks for strict JSON:

```json
{
  "name": "short title",
  "query": "application:nesy-mobile AND …",
  "summary": "one-line summary",
  "explanation": ["step 1", "step 2"],
  "validation": [
    { "id": "time", "label": "...", "detail": "...", "status": "pass|warn" }
  ],
  "quality": {
    "verdict": "strong|broad",
    "explanation": "…"
  },
  "expectedSignals": ["event_a", "event_b"]
}
```

`expectedSignals` is optional in v1; UI may omit a dedicated tab if empty
(keep Explanation + Validation parity with Mongo first).

### Guardrails (server-side)

- Search-only: reject mutation-like / admin syntax if model invents it
  (no stream delete, no indexer ops).
- Require a time-range constraint in the returned query or in metadata
  that the UI/API already sent (prefer embedding relative range in summary
  and validation; Lucene string must not imply unbounded production search
  without identifier when env is production — surface as `warn` not hard fail).
- Sensitive fields: prompt instructs masking; validation can `warn` if
  obvious PII field names appear unmasked.
- Broad scope: if no identifier and time range ≥ 24h → validation `warn`
  (matches existing amber UI guardrail).

## Data model (Postgres)

Prisma model + `@@map("graylog_query_runs")`:

| Column | Type | Notes |
| --- | --- | --- |
| `id` | TEXT PK | cuid |
| `name` | TEXT | short title from LLM or derived |
| `naturalLanguage` | TEXT | user prompt |
| `query` | TEXT | generated Graylog Lucene query |
| `environment` | TEXT | uat / production |
| `country` | TEXT? | HR, SI, … |
| `application` | TEXT | e.g. nesy-mobile |
| `service` | TEXT? | service or any |
| `logLevel` | TEXT? | |
| `timeRange` | TEXT | e.g. 1h, 24h |
| `device` | TEXT? | |
| `appVersion` | TEXT? | |
| `identifiers` | JSONB? | known identifier map |
| `sources` | JSONB? | selected log source ids |
| `status` | TEXT | `validated` \| `warning` |
| `explanation` | JSONB | string[] |
| `validation` | JSONB | checks[] |
| `quality` | JSONB? | verdict + explanation |
| `expectedSignals` | JSONB? | optional string[] |
| `summary` | TEXT? | |
| `model` | TEXT? | e.g. haiku |
| `createdBy` | TEXT | default `local` |
| `relatedIncident` | TEXT? | optional |
| `createdAt` | TIMESTAMP | |
| `lastUsedAt` | TIMESTAMP | bump on reuse |

Indexes: `(lastUsedAt DESC)`, `(environment)`, `(country)`.

### Migration

1. Update `packages/db/prisma/schema.prisma` with `GraylogQueryRun`.
2. Add `packages/db/prisma/manual-migrations/20260718_graylog_query_runs.sql`
   (`CREATE TABLE IF NOT EXISTS` + indexes).
3. Run via `pnpm exec prisma db execute --file …` (document in migration header).

## API

Express router mounted at `/api/graylog-query` (same pattern as mongo-query):

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/fields` | Return field dictionary for collapsible UI |
| `GET` | `/recent?limit=50` | List recent runs |
| `GET` | `/recent/:id` | Single run detail |
| `POST` | `/generate` | NL + context → Claude → validate → insert → return |
| `POST` | `/recent/:id/reuse` | Bump `lastUsedAt` |
| `DELETE` | `/recent/:id` | Delete run |

Mount in `apps/api/src/app.ts` next to mongo-query (auth bypass list if needed).

## Field dictionary

Source of truth for fields:

- Keep curated list in API module
  `apps/api/src/data/graylog-fields.ts` (ported from current
  `GRAYLOG_FIELDS` in web data file).
- UI loads via `GET /fields` (or embeds static copy initially with API as
  source of truth — prefer single API source like Mongo catalog).

Collapsible UI: search filter + click-to-append field to NL textarea
(preserve current behavior).

## Error handling

| Case | UX |
| --- | --- |
| Claude CLI not on PATH | Amber banner; install/login / `CLAUDE_CLI_PATH` |
| Auth / quota failure | Sanitized stderr snippet |
| Timeout | Retry; no DB insert |
| Invalid JSON from model | 502; no insert |
| Broad scope | Allow generate; validation `warn` + amber notice |

## Testing

- Unit: Graylog guardrail helpers; JSON parse shape
- Manual: Generate with shipment identifier; row in Recent; reload persists
- Migration: table exists; Prisma client create/list

## Implementation order

1. Prisma model + manual migration + run migration  
2. `graylog-fields` data module + guardrails  
3. Claude prompt + `graylog-query` router + mount  
4. Web service client + page/workspace/recent UI parity  
5. Remove mock generated/investigations constants from runtime path  
6. Smoke-test Generate + Recent on localhost  

## Predefined queries (Mongo parity)

Static library of **50 NL intents** at
`apps/api/src/data/graylog-predefined-queries.ts`, exposed on
`GET /api/graylog-query/fields` as `predefinedQueries` alongside the field
dictionary.

| Field | Notes |
| --- | --- |
| `id`, `label`, `text` | NL prompt with sample placeholders |
| `application`, `service` | Form context defaults (`nesy-mobile`, `RequestSenderService`, …) |
| `category` | `identity` \| `delivery` \| `terminal` \| `auth` \| `scan` \| `money` \| `locker` \| `support` |
| `priority` | `P0` \| `P1` \| `P2` — Top ops tab = all P0 |
| `timeRange`, `device`, `appVersion`, `identifiers`, `sources` | Optional form defaults; identifier keys limited to UI `IDENTIFIER_FIELDS` |

UI: tabbed card gallery inside the form card (same pattern as Mongo Query
Generator). Former `SCENARIO_CHIPS` are absorbed into this library and removed
from the page.

Field dictionary also includes `barcode`, `deviceId`, `requestName`,
`username`. Claude generate prompt lists known mobile/terminal request tokens
(`Task/DeliverParcels/`, `X-Channel: Terminal`, offline `requestName`s, …).

## Open follow-ups (out of scope)

- Live Graylog Open/search deep-link  
- Shared query-tool shell extraction with Mongo  
- Wire `createdBy` to real cockpit auth  
- Expected Signals as a fourth tab if product wants it later  
