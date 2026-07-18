# Domain Model Page — Split-View UX Redesign

**Date:** 2026-07-18  
**Status:** Draft for review  
**App:** NesyMobileCocpit (`/product/domain-model`)

## Problem

The Domain Model page packs the main entity chain into six narrow side-by-side
cards with `1:N` connectors, then dumps ~17 cross-cutting entities into large
pastel cards. The layout feels cramped, low-contrast, and hard to scan; the
detail panel sits below everything and forces long vertical scrolling away from
navigation context.

## Goals

1. Replace the cramped card grid with a **sticky master-detail split** on
   desktop: left navigation, right detail.
2. Keep the **main chain** readable as a vertical stepper (not six squeezed
   cards).
3. Present **cross-cutting entities** as a flat compact list with a **category
   chip filter** (plus search).
4. Preserve existing product tone system, data model, and
   `EntityDetailPanel` content — redesign chrome and navigation only.
5. Remain usable on mobile: horizontal chain pills + list + detail below.

## Non-goals

- Rewriting Domain Glossary or other product pages
- Graph/canvas relationship diagram
- Collapsible left rail (deferred)
- Content/copy rewrite of entity definitions
- New API routes or data-layer changes

## Decisions (approved)

| Topic | Choice |
| --- | --- |
| Detail presentation | A — split view (left nav, right sticky detail) |
| Cross-cutting organization | 2 — flat list + category chip filter |
| Layout approach | 1 — sticky master-detail (not top horizontal chain + split, not collapsible rail) |

## Layout

### Desktop (`lg+`)

```
┌─────────────────────────────────────────────────────────┐
│ Header · stats chips · search · category chips          │
├──────────────────┬──────────────────────────────────────┤
│ LEFT ~320–360px  │ RIGHT flex-1                         │
│ sticky / scroll  │ sticky detail                        │
│                  │                                      │
│ Main chain       │ EntityDetailPanel                    │
│ (vertical)       │                                      │
│ Cross-cutting    │                                      │
│ (flat list)      │                                      │
└──────────────────┴──────────────────────────────────────┘
```

- Two-column grid under the chrome.
- Left column: `max-h` relative to viewport + internal scroll so chain and
  cross-cutting stay reachable while reading detail.
- Right column: selected entity detail; independent scroll.
- Remove the 6-column card row, `1:N` connector badges between cards, and the
  large dashed cross-cutting card grid.

### Mobile (`< lg`)

1. Compact header + search + category chips (unchanged role).
2. Main chain as a **horizontal scrollable pill strip**.
3. Cross-cutting as a vertical compact list.
4. Detail panel **below** the lists (full width).

## Navigation

### Main chain

- Vertical list of chain entities (`CHAIN` — parent/child linked entities).
- Each row: icon, name, `L#`, short category label.
- Selected row: tone accent (left bar / ring) using existing `tone*` helpers.
- Optional distance fade for non-adjacent chain items when a chain entity is
  selected (preserve current “focus” feel without heavy opacity noise).
- No separate `1:N` badges between rows; cardinality remains in the detail
  panel (`cardinalityDesc` / relationships).

### Cross-cutting

- Section eyebrow + count.
- Flat list items (not cards): icon, name, optional peer hint truncated to one
  line (e.g. related entity from `relations`).
- Filtered by the same search query and category chips as the chain.

### Selection

- Clicking any nav row sets `selectedId` and shows that entity in
  `EntityDetailPanel`.
- In-panel navigation (`EntityNavChip`, learning-path Continue) continues to
  call the same `onNavigate` / `setSelectedId` path.
- If the current selection is hidden by search/category filters, auto-select
  the first visible match (chain first, then cross-cutting). If nothing is
  visible, show `EmptyState` and leave `selectedId` unchanged until a match
  returns.

## Filtering

| Control | Behavior |
| --- | --- |
| Search | Existing `entityMatches` / `searchableEntity` over chain + cross-cutting |
| Category chips | `All` + `ENTITY_CATEGORIES`; hide entities whose `ENTITY_CATEGORY` does not match |
| Combined | Entity must match both search and category (when category ≠ All) |
| Empty | If no entities match: replace the split with full-width `EmptyState` under the chrome |

Stats chips in the header (levels / chain count / cross-cutting count) remain
summary metadata; they are not filters.

## Visual language

- Keep `@/components/product` tone helpers (`toneCard`, `toneIcon`, `toneHero`,
  etc.). No new color theme.
- Tighter header padding; keep small stats chips.
- Left list: muted borders, compact `py-2` rows; selected state uses accent +
  light background — not full pastel card fills.
- Cross-cutting section: simple bordered block with small eyebrow (not large
  dashed amber hero box).
- `EntityDetailPanel` internal sections stay as-is; only placement moves to the
  right column.

## Implementation scope

**Primary file**

- `apps/web/src/app/(cockpit)/product/domain-model/page.tsx`

**Likely refactors inside that file**

- Replace `HierarchyView` / `HierarchyNode` / `HierarchyConnector` card-grid UI
  with split layout components (e.g. `EntityNavRail`, `ChainRow`,
  `CrossCuttingRow`, category chip bar in chrome or above the split).
- Extend `DomainModelChrome` (or sibling) with category chip state.
- Keep helpers: `entityMatches`, `EntityDetailPanel`, `EmptyState`, tone maps,
  `TECHNICAL_MAP`, etc.

**Unchanged**

- `apps/web/src/data/product/domain-glossary.ts`
- Product page shell (`ProductPage`)
- Domain glossary route

## State

| State | Notes |
| --- | --- |
| `query` | Search string (existing) |
| `selectedId` | Selected entity id (existing; default `schedule`) |
| `category` | New: `EntityCategory \| 'all'`, default `'all'` |

Derived: `visibleChain`, `visibleCrossCutting` from filters; selection
correction effect when selection leaves the visible set.

## Verification

- Desktop: two-column sticky master-detail; selecting chain or cross-cutting
  updates the right panel without losing nav context.
- Mobile: horizontal chain pills + list + detail below; no horizontal
  overflow from old 6-card grid.
- Search + category chips compose correctly; empty query/`All` shows full sets.
- Filter that hides current selection jumps to first visible entity.
- Learning-path Continue and relationship chips still change selection.
- Visual: no 6-wide squeezed cards; no large cross-cutting card grid; tone
  system still applies to icons/selected states.

## Out of scope follow-ups

- Collapsible / icon-only left rail
- Persisting last selected entity in URL query (`?entity=`)
- Interactive relationship graph
