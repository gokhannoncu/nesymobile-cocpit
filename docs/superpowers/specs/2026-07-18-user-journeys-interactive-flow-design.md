# User Journeys — Interactive Flow + Step Detail Panel

**Date:** 2026-07-18  
**Status:** Approved  
**App:** NesyMobileCocpit (`/product/user-journeys`)

## Problem

The User Journeys page presents each courier journey as a static step-card grid,
an experience curve, and a comparison table. That layout reads like an analytics
summary rather than a user flow: it is hard to see what happens at each step,
where decisions branch, and how exception paths rejoin the happy path.

## Goals

1. Redesign `/product/user-journeys` as an **interactive user flow**: vertical
   flowchart on the left, selected-step detail panel on the right.
2. Support full flowchart semantics (`start`, `process`, `decision`, `end`,
   `error`, `external`) with yes/no branches for all **five** journeys.
3. Move step narrative (goal, touchpoint, experience, design opportunity) into
   the detail panel so the page tells “what happens here” without the table.
4. Keep Feature Library’s existing `FlowDiagram` behavior unchanged.

## Non-goals

- Experience curve (removed from this page)
- ComparisonTable on this page
- Auto-play walkthrough / play-pause tour
- React Flow or other external diagram libraries
- Changing Country Matrix or journey ↔ matrix relationship callout meaning
- Removing `JourneyMap` from the codebase in this change (unused after page
  migration; cleanup may follow in a separate pass)

## Decisions (approved)

| Topic | Choice |
| --- | --- |
| Primary UX | A — clickable vertical flow + right detail panel |
| Curve + table | A — remove both; all step info lives in the panel |
| Branching | C — full flowchart (Feature Library diagram language) |
| Scope | All five journeys, complete diagram + step detail content |
| Implementation shape | New `InteractiveJourneyFlow` (+ panel); do not overload Feature Library `FlowDiagram` click behavior |

## Page layout

Unchanged chrome:

- `HeroCallout` (Users & Field Experience · Journeys)
- `Callout` “Journey ≠ Country Matrix”
- `SegmentTabs` for Tour Start / Delivery / Pickup / Red Label / D4Me

Per-tab content:

1. Journey purpose callout (existing short purpose text)
2. Two-column layout:
   - **Left (~45%)** — `InteractiveJourneyFlow` (vertical flowchart)
   - **Right (~55%)** — `JourneyStepPanel` (selected step detail)
3. No experience curve, no comparison table

Interaction:

- On tab open / journey change: select the journey’s **start** node (or first
  node with an `id` if start is missing — should not happen in complete data).
- Clicking a `node` selects it (highlight + panel update).
- `arrow` and `branch` connectors are not clickable.
- Mobile (`< md`): stack columns — flow first, panel below. Selecting a node
  may scroll the panel into view.

## Data model

Extract journey definitions from the page into a dedicated data module, e.g.
`apps/web/src/data/product/user-journeys.ts`.

### Types

Extend diagram nodes with an optional `id` (backward compatible for Feature
Library diagrams that omit it):

```ts
// nesy-types.ts — DiagramElement node variant gains optional id
{ type: 'node'; id?: string; label: string; variant: DiagramNodeVariant; desc?: string }
```

Journey types:

```ts
type JourneyActor = 'courier' | 'ops' | 'system' | 'external'

interface JourneyStepDetail {
  title: string
  whatHappens: string
  courierGoal: string
  touchpoint: string
  experience: string          // e.g. "😟 Waiting"
  designOpportunity: string
  nesyActive: boolean
  actor?: JourneyActor
}

interface UserJourney {
  value: string
  label: string
  icon: LucideIcon            // imported from lucide-react in the data module
  tone: Tone
  purpose: string
  diagram: DiagramElement[]
  steps: Record<string, JourneyStepDetail>
}
```

Rules:

- Every selectable diagram `node` **must** have an `id`.
- Every `id` **must** have a matching entry in `steps`.
- Branch / error / external nodes get full panel copy (not empty stubs).
- Existing table rows migrate into the corresponding happy-path step details;
  new copy is authored for branches and exceptions.

### Content coverage (all five journeys)

| Journey | Must include |
| --- | --- |
| Tour Start | Route select → scan → approval decision (approved / waiting) → stop management; incomplete scan path |
| Delivery | Consignee → collection → fiscalization → signature → success (DELY) vs failed delivery (reason + photo) |
| Pickup | Task → sender → pickup/CPP → failure code decision → reassignment when eligible |
| Red Label | PAC → physical pickup → Npoint drop → shipment create → backoffice completion (`external`) |
| D4Me | Reservation → locker deposit → consignee pickup (`end`) vs timeout → locker pickup task |

Diagram language matches Feature Library: `node` / `arrow` / `branch` with
`yes` / `no` arms. Prefer realistic branch labels (e.g. “Approved” /
“Waiting”, “Delivered” / “Failed”) over generic Yes/No when clearer.

## Components

### `InteractiveJourneyFlow`

- Location: `apps/web/src/components/product/` (new file, e.g.
  `interactive-journey-flow.tsx`)
- Reuses visual language from `flow-diagram.tsx` (node variant styles, branch
  layout) but owns selection state wiring via props:
  - `elements`, `tone`, `selectedId`, `onSelect(id)`
- Selected node: stronger border/ring + slight scale
- Entry animations via `framer-motion` (staggered nodes; connector fade / short
  draw where cheap)
- Does not change Feature Library consumers of `FlowDiagram`

### `JourneyStepPanel`

- Shows fields from `JourneyStepDetail`
- `nesyActive` badge when true
- Optional `actor` chip
- Animate content change on `selectedId` change (fade + short slide)

### Page

- `user-journeys/page.tsx` becomes a thin shell: tabs + purpose + flow/panel
  composition
- Local state: `selectedId` per active journey (reset when tab changes)

### `JourneyMap`

- Remove usage from this page only
- Leave component in place unless a quick unused-export cleanup is trivial

## Animation budget

Intentional, not noisy:

1. Flow nodes stagger-in on journey tab reveal
2. Selected node highlight transition
3. Panel content cross-fade / short slide on selection change

No autoplay sequence. No continuous looping motion.

## Accessibility

- Nodes are buttons (or `role="button"` with keyboard activation)
- Selected state exposed via `aria-current` or `aria-pressed`
- Panel region has an accessible name (e.g. “Step detail”)
- Diagram remains readable without color alone (variant icons + labels)

## Testing / verification

- Manual: each of the five tabs opens with start selected; every node click
  updates the panel; branch arms render; mobile stack works
- Typecheck: every diagram node `id` exists in `steps` (enforce in data review;
  optional small unit test that walks all journeys)
- Confirm Feature Library feature detail diagrams still render unchanged

## Out of scope follow-ups

- Delete or refactor unused `JourneyMap`
- Deep-link to a step (`?journey=&step=`)
- Syncing journey steps automatically from feature inventory / country matrix

## Implementation notes (for plan phase)

1. Extend `DiagramElement` node with optional `id`
2. Add journey data file with five complete diagrams + step maps
3. Build `InteractiveJourneyFlow` + `JourneyStepPanel`
4. Rewire `user-journeys/page.tsx`; remove curve/table
5. Visual/manual QA across five journeys + Feature Library smoke check
`)