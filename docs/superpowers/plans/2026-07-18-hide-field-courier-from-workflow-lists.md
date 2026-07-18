# Hide Field Courier from Workflow Lists Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide the `field-courier-login` system workflow and its Maestro runs from Workflow Library and Run History while keeping Field Login’s dedicated history unchanged.

**Architecture:** Add a small web helper that identifies hidden system workflows by slug. Filter workflows/runs in the existing library and history filter modules (or immediately after fetch on the pages) so list rows and summary cards use the same visible set. No Automation API (`:3008`) or DB changes.

**Tech Stack:** Next.js (`apps/web`), Vitest, existing `automation-api` types.

## Global Constraints

- Identifier: workflow `slug === "field-courier-login"` (exact string)
- Approach: web UI filter after fetch only
- Do not change Field Login page or `field_courier_logins`
- Do not add Maestro run detail links
- Do not modify external Automation API (`:3008`)
- Do not commit unless user explicitly asks

## File map

| File | Responsibility |
| --- | --- |
| `apps/web/src/lib/automation/system-workflows.ts` | Shared slug constant + `isHiddenSystemWorkflow` |
| `apps/web/src/lib/automation/system-workflows.test.ts` | Unit tests for the helper |
| `apps/web/src/lib/automation/workflow-library-filters.ts` | Export `isVisibleLibraryWorkflow` using the helper |
| `apps/web/src/lib/automation/workflow-library-filters.test.ts` | Cover visibility + existing status filter |
| `apps/web/src/lib/automation/run-history-filters.ts` | Export `isVisibleHistoryRun` using the helper |
| `apps/web/src/lib/automation/run-history-filters.test.ts` | Cover visibility + existing status filter |
| `apps/web/src/app/(cockpit)/automation/list/page.tsx` | Stats + filtered list use visible workflows only |
| `apps/web/src/app/(cockpit)/automation/history/page.tsx` | Stats + table use visible runs only |

Spec: `docs/superpowers/specs/2026-07-18-hide-field-courier-from-workflow-lists-design.md`

---

### Task 1: System workflow helper + tests

**Files:**
- Create: `apps/web/src/lib/automation/system-workflows.ts`
- Create: `apps/web/src/lib/automation/system-workflows.test.ts`

**Interfaces:**
- Produces:
  - `FIELD_COURIER_LOGIN_WORKFLOW_SLUG: "field-courier-login"`
  - `isHiddenSystemWorkflow(slug: string | null | undefined): boolean`

- [x] **Step 1: Write the failing tests**

Create `apps/web/src/lib/automation/system-workflows.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import {
  FIELD_COURIER_LOGIN_WORKFLOW_SLUG,
  isHiddenSystemWorkflow,
} from './system-workflows'

describe('isHiddenSystemWorkflow', () => {
  it('hides the field courier login slug', () => {
    expect(isHiddenSystemWorkflow(FIELD_COURIER_LOGIN_WORKFLOW_SLUG)).toBe(true)
    expect(isHiddenSystemWorkflow('field-courier-login')).toBe(true)
  })

  it('keeps normal workflow slugs visible', () => {
    expect(isHiddenSystemWorkflow('login-flow')).toBe(false)
    expect(isHiddenSystemWorkflow('delivery-happy-path')).toBe(false)
  })

  it('does not hide missing slugs', () => {
    expect(isHiddenSystemWorkflow(undefined)).toBe(false)
    expect(isHiddenSystemWorkflow(null)).toBe(false)
    expect(isHiddenSystemWorkflow('')).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm --filter web test -- src/lib/automation/system-workflows.test.ts
```

Expected: FAIL — module `./system-workflows` not found (or export missing).

- [ ] **Step 3: Implement the helper**

Create `apps/web/src/lib/automation/system-workflows.ts`:

```ts
/** Must match apps/api field-courier-login-orchestrator SYSTEM_WORKFLOW_SLUG. */
export const FIELD_COURIER_LOGIN_WORKFLOW_SLUG = 'field-courier-login'

export function isHiddenSystemWorkflow(slug: string | null | undefined): boolean {
  return slug === FIELD_COURIER_LOGIN_WORKFLOW_SLUG
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm --filter web test -- src/lib/automation/system-workflows.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add apps/web/src/lib/automation/system-workflows.ts apps/web/src/lib/automation/system-workflows.test.ts
git commit -m "$(cat <<'EOF'
feat(web): add helper to identify hidden system workflows

EOF
)"
```

---

### Task 2: Library + history filter helpers

**Files:**
- Modify: `apps/web/src/lib/automation/workflow-library-filters.ts`
- Modify: `apps/web/src/lib/automation/workflow-library-filters.test.ts`
- Modify: `apps/web/src/lib/automation/run-history-filters.ts`
- Modify: `apps/web/src/lib/automation/run-history-filters.test.ts`

**Interfaces:**
- Consumes: `isHiddenSystemWorkflow` from `./system-workflows`
- Produces:
  - `isVisibleLibraryWorkflow(workflow: Pick<WorkflowListItem, 'slug'>): boolean`
  - `isVisibleHistoryRun(run: Pick<WorkflowRun, 'workflow'>): boolean`

- [ ] **Step 1: Extend library filter tests**

Append to `apps/web/src/lib/automation/workflow-library-filters.test.ts`:

```ts
import { isVisibleLibraryWorkflow, workflowMatchesStatusFilter } from './workflow-library-filters'

const workflow = (status: string, slug = 'login-flow') =>
  ({
    id: 'wf-1',
    status,
    slug,
  }) as Parameters<typeof workflowMatchesStatusFilter>[0]

describe('isVisibleLibraryWorkflow', () => {
  it('hides field-courier-login', () => {
    expect(isVisibleLibraryWorkflow(workflow('active', 'field-courier-login'))).toBe(false)
  })

  it('keeps other workflows', () => {
    expect(isVisibleLibraryWorkflow(workflow('active', 'login-flow'))).toBe(true)
  })
})
```

Update the existing `workflow` helper in that file to accept an optional `slug` (as above) so both describes share one factory. Keep existing status-filter tests unchanged in behavior.

- [ ] **Step 2: Extend history filter tests**

Append to `apps/web/src/lib/automation/run-history-filters.test.ts`:

```ts
import { isVisibleHistoryRun, runMatchesStatusFilter } from './run-history-filters'

const run = (status: string, slug?: string) =>
  ({
    id: 'run-1',
    status,
    workflow: slug
      ? { id: 'wf-1', slug, name: slug }
      : undefined,
  }) as Parameters<typeof runMatchesStatusFilter>[0]

describe('isVisibleHistoryRun', () => {
  it('hides runs for field-courier-login', () => {
    expect(isVisibleHistoryRun(run('success', 'field-courier-login'))).toBe(false)
  })

  it('keeps runs for other workflows', () => {
    expect(isVisibleHistoryRun(run('success', 'login-flow'))).toBe(true)
  })

  it('keeps runs with missing workflow slug', () => {
    expect(isVisibleHistoryRun(run('success'))).toBe(true)
  })
})
```

Update the existing `run` factory similarly; keep status-filter tests working.

- [ ] **Step 3: Run filter tests to verify new cases fail**

```bash
pnpm --filter web test -- src/lib/automation/workflow-library-filters.test.ts src/lib/automation/run-history-filters.test.ts
```

Expected: FAIL — `isVisibleLibraryWorkflow` / `isVisibleHistoryRun` not exported.

- [ ] **Step 4: Implement filter helpers**

In `apps/web/src/lib/automation/workflow-library-filters.ts`, add:

```ts
import { isHiddenSystemWorkflow } from './system-workflows'

export function isVisibleLibraryWorkflow(
  workflow: Pick<WorkflowListItem, 'slug'>,
): boolean {
  return !isHiddenSystemWorkflow(workflow.slug)
}
```

In `apps/web/src/lib/automation/run-history-filters.ts`, add:

```ts
import { isHiddenSystemWorkflow } from './system-workflows'

export function isVisibleHistoryRun(
  run: Pick<WorkflowRun, 'workflow'>,
): boolean {
  return !isHiddenSystemWorkflow(run.workflow?.slug)
}
```

Keep existing `workflowMatchesStatusFilter` / `runMatchesStatusFilter` / `format*Share` unchanged.

- [ ] **Step 5: Run filter tests to verify they pass**

```bash
pnpm --filter web test -- src/lib/automation/workflow-library-filters.test.ts src/lib/automation/run-history-filters.test.ts src/lib/automation/system-workflows.test.ts
```

Expected: PASS

- [ ] **Step 6: Commit (only if user asked)**

```bash
git add apps/web/src/lib/automation/workflow-library-filters.ts apps/web/src/lib/automation/workflow-library-filters.test.ts apps/web/src/lib/automation/run-history-filters.ts apps/web/src/lib/automation/run-history-filters.test.ts
git commit -m "$(cat <<'EOF'
feat(web): exclude system workflows from library and history filters

EOF
)"
```

---

### Task 3: Wire Workflow Library + Run History pages

**Files:**
- Modify: `apps/web/src/app/(cockpit)/automation/list/page.tsx`
- Modify: `apps/web/src/app/(cockpit)/automation/history/page.tsx`

**Interfaces:**
- Consumes: `isVisibleLibraryWorkflow`, `isVisibleHistoryRun`

- [ ] **Step 1: Filter Workflow Library before stats and table**

In `apps/web/src/app/(cockpit)/automation/list/page.tsx`:

1. Import `isVisibleLibraryWorkflow` from `@/lib/automation/workflow-library-filters` (same import block as `workflowMatchesStatusFilter`).
2. Add a `visibleWorkflows` memo **above** `stats`:

```ts
const visibleWorkflows = useMemo(
  () => workflows.filter(isVisibleLibraryWorkflow),
  [workflows],
)
```

3. In `stats` and `filteredWorkflows`, replace every use of `workflows` with `visibleWorkflows` (counts, share denominators, status filter input). Leave `setWorkflows(data)` from fetch unchanged — filtering is derived, not destructive.

`stats` dependency array becomes `[visibleWorkflows, statusFilter]`.  
`filteredWorkflows` becomes:

```ts
const filteredWorkflows = useMemo(
  () =>
    visibleWorkflows.filter((workflow) =>
      workflowMatchesStatusFilter(workflow, statusFilter),
    ),
  [visibleWorkflows, statusFilter],
)
```

- [ ] **Step 2: Filter Run History before stats and table**

In `apps/web/src/app/(cockpit)/automation/history/page.tsx`:

1. Import `isVisibleHistoryRun` from `@/lib/automation/run-history-filters`.
2. Add:

```ts
const visibleRuns = useMemo(
  () => runs.filter(isVisibleHistoryRun),
  [runs],
)
```

3. In the page-level `stats` memo, use `visibleRuns` instead of `runs` for `total` / `success` / `active` / `failed`.
4. Pass `visibleRuns` into `RunHistoryTable` instead of `runs`:

```tsx
<RunHistoryTable
  runs={visibleRuns}
  statusFilter={statusFilter}
  onStatusFilterChange={setStatusFilter}
  onDeleteRun={handleDeleteRun}
/>
```

`handleDeleteRun` may still update the full `runs` state (fine — hidden rows stay filtered out). Footer “N runs total” inside the table will automatically reflect `visibleRuns` once the table receives the filtered array.

- [ ] **Step 3: Run unit tests again**

```bash
pnpm --filter web test -- src/lib/automation/system-workflows.test.ts src/lib/automation/workflow-library-filters.test.ts src/lib/automation/run-history-filters.test.ts
```

Expected: PASS

- [ ] **Step 4: Manual verification**

With the web app running and Field Courier runs present in the Automation API:

1. Open `/automation/list` — “Field Courier Login” must not appear; summary cards must not count it.
2. Open `/automation/history` — Field Courier Login SUCCESS rows must not appear; Total / Successful / pass rate must exclude them.
3. Open `/automation/field-login` — courier session history still loads.
4. Confirm another workflow (e.g. “Login Flow”) still appears in list/history.

- [ ] **Step 5: Commit (only if user asked)**

```bash
git add apps/web/src/app/(cockpit)/automation/list/page.tsx apps/web/src/app/(cockpit)/automation/history/page.tsx
git commit -m "$(cat <<'EOF'
feat(web): hide field courier login from workflow library and history

EOF
)"
```

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| Hide workflow from Library | Task 2 + 3 |
| Hide runs from History | Task 2 + 3 |
| Stats exclude hidden runs/workflows | Task 3 |
| Keep DB / API storage | No destructive task (by design) |
| Field Login unchanged | No Field Login file edits |
| No Maestro detail link | Non-goal — skipped |
| Identifier = `field-courier-login` slug | Task 1 |

## Self-review notes

- No placeholders / TBD steps.
- Helper slug matches orchestrator `SYSTEM_WORKFLOW_SLUG`.
- Missing slug on a run stays visible (spec: prefer slug; do not guess by name).
- Commit steps gated on explicit user request (repo rule).
