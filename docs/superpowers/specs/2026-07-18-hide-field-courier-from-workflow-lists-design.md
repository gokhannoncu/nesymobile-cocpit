# Hide Field Courier Login from Workflow Library & Run History

**Date:** 2026-07-18  
**Status:** Draft for review  
**Surfaces:** `/automation/list`, `/automation/history`  
**Dedicated surface (unchanged):** `/automation/field-login`

## Problem

Field Courier Login is a dedicated Automation feature with its own page and
Postgres history (`field_courier_logins`). To drive the Maestro login step, the
orchestrator also creates/uses a system workflow:

| Field | Value |
| --- | --- |
| slug | `field-courier-login` |
| name | Field Courier Login |
| category | `system` |

Each login creates a normal `workflow_runs` row. Those runs and the system
workflow currently appear in the generic **Workflow Library** and **Run
History**, crowding out real user workflows.

## Goals

1. Hide the `field-courier-login` workflow from **Workflow Library**.
2. Hide all runs for that workflow from **Run History** (including summary
   cards / pass-rate stats).
3. Keep Maestro workflow + runs stored in the Automation DB (no delete, no
   schema change).
4. Leave Field Login page and `field_courier_logins` behavior unchanged.

## Non-goals

- Changes to the external Automation API (`:3008`)
- Maestro run detail links from Field Login UI
- A separate Field Courier Run History page
- Workflow editor read-only / delete guards for the system workflow
- Hiding arbitrary future system workflows beyond the agreed identifier (may
  reuse the helper later)

## Decisions (approved)

| Topic | Choice |
| --- | --- |
| Approach | A — Web UI filter after fetch |
| Identifier | Workflow `slug === "field-courier-login"` |
| Maestro detail access | None for now (option 1) |
| Dedicated history | Field Login page only |

## Architecture

```
Automation API (:3008)
  GET /workflows          → still returns field-courier-login
  GET /workflows/runs     → still returns those runs
        │
        ▼
Web filter (new helper)
  isHiddenSystemWorkflow(slug)
        │
        ├─► Workflow Library  — exclude from list + stats
        └─► Run History       — exclude from list + stats

Field Login (/automation/field-login)
  → field_courier_logins only (unchanged)
```

Filtering is client-side in the cockpit web app after existing
`fetchWorkflows()` / `fetchAllRuns()` calls. Persistence and orchestration are
untouched.

## Implementation

### 1. Shared helper

New module, e.g. `apps/web/src/lib/automation/system-workflows.ts`:

- `FIELD_COURIER_LOGIN_WORKFLOW_SLUG = "field-courier-login"`
- `isHiddenSystemWorkflow(slug: string | null | undefined): boolean`
- Optional: `isHiddenSystemWorkflowEntity(entity: { slug?: string | null })`

Orchestrator in `apps/api` already uses a local `SYSTEM_WORKFLOW_SLUG` with the
same value. Sharing across packages is optional; if not shared, keep both
literals identical and document the coupling in a one-line comment.

### 2. Workflow Library

Files:

- `apps/web/src/lib/automation/workflow-library-filters.ts`
- `apps/web/src/app/(cockpit)/automation/list/page.tsx`

Rules:

- Exclude hidden system workflows before search / status filter / pagination.
- Summary counts (if any) use the filtered set.

### 3. Run History

Files:

- `apps/web/src/lib/automation/run-history-filters.ts`
- `apps/web/src/app/(cockpit)/automation/history/page.tsx`

Rules:

- Exclude a run when `run.workflow?.slug` matches the hidden slug (fallback:
  workflow name only if slug missing — prefer slug).
- Total / Successful / In progress / Failed cards and “N runs total” use the
  filtered set so Field Courier runs do not inflate pass rate.

### 4. Tests (if filter helpers are unit-tested today)

Extend or add small unit tests on the filter helpers for:

- visible workflow/run kept
- `field-courier-login` excluded
- missing slug → not excluded (unless only Field Courier is identified by slug)

## Out of scope follow-ups

- API-level exclusion on `:3008` (`category = system`)
- Deep link from Field Login row → Maestro run detail
- Editor/list delete protection for system workflows

## Acceptance criteria

1. Opening Workflow Library does not show “Field Courier Login”.
2. Opening Run History does not show Field Courier Login runs.
3. History summary cards exclude those runs.
4. Field Login page still lists courier sessions from `field_courier_logins`.
5. New Field Login executions still succeed; they simply do not appear on
   Library / History.
6. Other workflows and runs (e.g. “Login Flow”) remain visible.
