# Domain Model Split-View UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do **not** create git commits unless the user explicitly asks.

**Goal:** Redesign `/product/domain-model` into a sticky master-detail split with vertical chain nav, flat cross-cutting list, and category chip + search filters.

**Architecture:** Extract pure filter/selection helpers into a small module with vitest coverage. Rebuild page chrome + navigation in `domain-model/page.tsx` around those helpers; keep `EntityDetailPanel` content and `domain-glossary` data unchanged.

**Tech Stack:** Next.js App Router client page, React state, Tailwind + existing `@/components/product` tone helpers, vitest, framer-motion (existing chrome animation only).

**Spec:** `docs/superpowers/specs/2026-07-18-domain-model-ux-redesign.md`

## Global Constraints

- Primary UI file: `apps/web/src/app/(cockpit)/product/domain-model/page.tsx`
- Do not change `apps/web/src/data/product/domain-glossary.ts` content/API
- Preserve product `tone*` system — no new color theme
- Remove 6-column card grid, `1:N` inter-card connectors, large dashed cross-cutting card grid
- Desktop `lg+`: left ~320–360px nav + right detail; mobile: horizontal chain pills + list + detail below
- Category filter: `All` + `ENTITY_CATEGORIES`; composes with search
- Auto-select first visible entity when current selection is filtered out; if none visible, show full-width `EmptyState` and leave `selectedId` unchanged
- No commits unless the user asks

---

## File structure

| File | Responsibility |
| --- | --- |
| `apps/web/src/app/(cockpit)/product/domain-model/domain-model-filters.ts` | Pure filter + selection correction helpers |
| `apps/web/src/app/(cockpit)/product/domain-model/domain-model-filters.test.ts` | Vitest for those helpers |
| `apps/web/src/app/(cockpit)/product/domain-model/page.tsx` | Chrome, nav rail, split layout, wiring; keeps `EntityDetailPanel` |

---

### Task 1: Filter helpers + tests

**Files:**
- Create: `apps/web/src/app/(cockpit)/product/domain-model/domain-model-filters.ts`
- Create: `apps/web/src/app/(cockpit)/product/domain-model/domain-model-filters.test.ts`

**Interfaces:**
- Consumes: `DomainEntity`, `EntityCategory` from `@/data/product/domain-glossary`
- Produces:
  - `export type CategoryFilter = EntityCategory | 'all'`
  - `export function entityMatchesCategory(entity: DomainEntity, category: CategoryFilter, categoryOf: (e: DomainEntity) => EntityCategory): boolean`
  - `export function filterEntities(entities: DomainEntity[], query: string, category: CategoryFilter, matchesQuery: (e: DomainEntity, q: string) => boolean, categoryOf: (e: DomainEntity) => EntityCategory): DomainEntity[]`
  - `export function resolveSelection(selectedId: string, visibleChain: DomainEntity[], visibleCrossCutting: DomainEntity[]): string | null`  
    Returns `selectedId` if still visible; else first chain id; else first cross-cutting id; else `null` (caller keeps previous id and shows empty state)

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import type { DomainEntity, EntityCategory } from '@/data/product/domain-glossary'
import {
  entityMatchesCategory,
  filterEntities,
  resolveSelection,
  type CategoryFilter,
} from './domain-model-filters'

function stub(partial: Partial<DomainEntity> & Pick<DomainEntity, 'id' | 'name'>): DomainEntity {
  return {
    parentId: null,
    childIds: [],
    level: 0,
    icon: 'Package',
    aliases: [],
    definition: '',
    businessContext: '',
    technicalContext: '',
    cardinalityDesc: '',
    statuses: [],
    antiPatterns: [],
    prerequisiteIds: [],
    ...partial,
  } as DomainEntity
}

const categoryOf = (e: DomainEntity): EntityCategory =>
  e.id === 'hub' ? 'transfer' : e.id === 'schedule' ? 'planning' : 'delivery'

const matchesQuery = (e: DomainEntity, q: string) =>
  !q || e.name.toLowerCase().includes(q.toLowerCase())

describe('entityMatchesCategory', () => {
  it('allows all categories when filter is all', () => {
    expect(entityMatchesCategory(stub({ id: 'hub', name: 'Hub' }), 'all', categoryOf)).toBe(true)
  })

  it('matches only the selected category', () => {
    expect(entityMatchesCategory(stub({ id: 'hub', name: 'Hub' }), 'transfer', categoryOf)).toBe(true)
    expect(entityMatchesCategory(stub({ id: 'schedule', name: 'Schedule' }), 'transfer', categoryOf)).toBe(false)
  })
})

describe('filterEntities', () => {
  const list = [
    stub({ id: 'schedule', name: 'Schedule' }),
    stub({ id: 'hub', name: 'Hub' }),
    stub({ id: 'shipment', name: 'Shipment' }),
  ]

  it('applies search and category together', () => {
    const result = filterEntities(list, 'hu', 'transfer', matchesQuery, categoryOf)
    expect(result.map((e) => e.id)).toEqual(['hub'])
  })

  it('returns empty when nothing matches', () => {
    expect(filterEntities(list, 'zzz', 'all', matchesQuery, categoryOf)).toEqual([])
  })
})

describe('resolveSelection', () => {
  const schedule = stub({ id: 'schedule', name: 'Schedule' })
  const hub = stub({ id: 'hub', name: 'Hub' })

  it('keeps selection when still visible', () => {
    expect(resolveSelection('hub', [schedule], [hub])).toBe('hub')
  })

  it('falls back to first chain then first cross-cutting', () => {
    expect(resolveSelection('missing', [schedule], [hub])).toBe('schedule')
    expect(resolveSelection('missing', [], [hub])).toBe('hub')
  })

  it('returns null when nothing visible', () => {
    expect(resolveSelection('schedule', [], [])).toBe(null)
  })
})
```

Adjust `stub` fields if TypeScript complains — mirror required `DomainEntity` fields from `domain-glossary.ts`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @nesy/web test src/app/(cockpit)/product/domain-model/domain-model-filters.test.ts`

Expected: FAIL (module not found / exports missing)

- [ ] **Step 3: Implement helpers**

```ts
import type { DomainEntity, EntityCategory } from '@/data/product/domain-glossary'

export type CategoryFilter = EntityCategory | 'all'

export function entityMatchesCategory(
  entity: DomainEntity,
  category: CategoryFilter,
  categoryOf: (entity: DomainEntity) => EntityCategory,
): boolean {
  return category === 'all' || categoryOf(entity) === category
}

export function filterEntities(
  entities: DomainEntity[],
  query: string,
  category: CategoryFilter,
  matchesQuery: (entity: DomainEntity, query: string) => boolean,
  categoryOf: (entity: DomainEntity) => EntityCategory,
): DomainEntity[] {
  return entities.filter(
    (entity) => matchesQuery(entity, query) && entityMatchesCategory(entity, category, categoryOf),
  )
}

export function resolveSelection(
  selectedId: string,
  visibleChain: DomainEntity[],
  visibleCrossCutting: DomainEntity[],
): string | null {
  const visible = [...visibleChain, ...visibleCrossCutting]
  if (visible.some((entity) => entity.id === selectedId)) return selectedId
  return visibleChain[0]?.id ?? visibleCrossCutting[0]?.id ?? null
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @nesy/web test src/app/(cockpit)/product/domain-model/domain-model-filters.test.ts`

Expected: PASS

- [ ] **Step 5: Commit only if user asked** — otherwise skip

---

### Task 2: Chrome — category chips + tighter header

**Files:**
- Modify: `apps/web/src/app/(cockpit)/product/domain-model/page.tsx` (`DomainModelChrome`, page state)

**Interfaces:**
- Consumes: `CategoryFilter`, `ENTITY_CATEGORIES`
- Produces: page state `category: CategoryFilter` (default `'all'`); chrome props `category`, `onCategoryChange`

- [ ] **Step 1: Add category state on the page**

In `DomainModelPage`:

```tsx
const [category, setCategory] = useState<CategoryFilter>('all')
```

Pass into chrome and the view that will become the split layout.

- [ ] **Step 2: Extend `DomainModelChrome` props**

```tsx
function DomainModelChrome({
  query,
  onQueryChange,
  category,
  onCategoryChange,
}: {
  query: string
  onQueryChange: (query: string) => void
  category: CategoryFilter
  onCategoryChange: (category: CategoryFilter) => void
}) {
```

Below the search input, render chips:

```tsx
<div className="flex flex-wrap gap-1.5">
  <button
    type="button"
    onClick={() => onCategoryChange('all')}
    className={cn(
      'rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors',
      category === 'all'
        ? cn(toneCard.teal, toneText.teal)
        : 'border-border/70 bg-background text-muted-foreground hover:bg-muted/40',
    )}
  >
    All
  </button>
  {ENTITY_CATEGORIES.map((item) => {
    const tone = CATEGORY_TONE[item.id]
    const active = category === item.id
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => onCategoryChange(item.id)}
        className={cn(
          'rounded-md border px-2.5 py-1 text-[11px] font-semibold transition-colors',
          active ? cn(toneCard[tone], toneText[tone]) : 'border-border/70 bg-background text-muted-foreground hover:bg-muted/40',
        )}
      >
        {item.label}
      </button>
    )
  })}
</div>
```

Tighten header spacing: keep `p-3.5 sm:p-4` / `space-y-3` (already compact); do not add extra vertical padding around search.

- [ ] **Step 3: Manual check**

Open `http://localhost:4002/product/domain-model` — chips render and toggle visually (filter wiring may still be incomplete until Task 3).

- [ ] **Step 4: Commit only if user asked** — otherwise skip

---

### Task 3: Split layout + nav rows (replace Hierarchy card grid)

**Files:**
- Modify: `apps/web/src/app/(cockpit)/product/domain-model/page.tsx`
- Delete usage of: `HierarchyNode`, `HierarchyConnector`, `HierarchyView` (remove those functions once replaced)

**Interfaces:**
- Consumes: `filterEntities`, `resolveSelection`, `entityMatches`, `entityCategory` / `categoryMeta`, `CHAIN`, `CROSS_CUTTING`, `EntityDetailPanel`, `EmptyState`
- Produces: `DomainModelSplitView` (name flexible) rendering desktop split + mobile stack

- [ ] **Step 1: Derive visible lists + selection correction**

Inside the page (or split view):

```tsx
const visibleChain = filterEntities(CHAIN, query, category, entityMatches, entityCategory)
const visibleCrossCutting = filterEntities(CROSS_CUTTING, query, category, entityMatches, entityCategory)
const hasResults = visibleChain.length > 0 || visibleCrossCutting.length > 0

useEffect(() => {
  const next = resolveSelection(selectedId, visibleChain, visibleCrossCutting)
  if (next && next !== selectedId) setSelectedId(next)
}, [selectedId, visibleChain, visibleCrossCutting])
```

Note: `visibleChain` / `visibleCrossCutting` are new arrays each render — either depend on `query`/`category`/`selectedId` only and recompute inside the effect, or memoize with stable deps to avoid loops:

```tsx
useEffect(() => {
  const chain = filterEntities(CHAIN, query, category, entityMatches, entityCategory)
  const cross = filterEntities(CROSS_CUTTING, query, category, entityMatches, entityCategory)
  const next = resolveSelection(selectedId, chain, cross)
  if (next && next !== selectedId) setSelectedId(next)
}, [query, category, selectedId])
```

- [ ] **Step 2: Implement compact nav row components**

`ChainNavRow` (desktop vertical):

```tsx
function ChainNavRow({
  entity,
  selectedId,
  onSelect,
}: {
  entity: DomainEntity
  selectedId: string
  onSelect: (id: string) => void
}) {
  const Icon = ICONS[entity.icon] ?? Package
  const tone = entityTone(entity)
  const { label: categoryLabel, tone: categoryTone } = categoryMeta(entityCategory(entity))
  const isSelected = selectedId === entity.id
  const selectedIndex = CHAIN.findIndex((item) => item.id === selectedId)
  const index = CHAIN.findIndex((item) => item.id === entity.id)
  const distance = selectedIndex < 0 ? 0 : Math.abs(selectedIndex - index)

  return (
    <button
      type="button"
      onClick={() => onSelect(entity.id)}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors',
        isSelected
          ? cn('border-transparent shadow-sm ring-2 ring-offset-1 ring-offset-background', TONE_RING[tone], toneCard[tone])
          : 'border-border/60 bg-card hover:bg-muted/30',
        selectedIndex >= 0 && distance > 1 && !isSelected && 'opacity-50',
      )}
    >
      <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg border', toneIconBox[tone])}>
        <Icon className={cn('size-3.5', toneIcon[tone])} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-foreground">{entity.name}</span>
          <span className={cn('text-[10px] font-bold uppercase tracking-wide', toneText[tone])}>L{entity.level}</span>
        </span>
        <span className={cn('block truncate text-[11px]', toneText[categoryTone])}>{categoryLabel}</span>
      </span>
    </button>
  )
}
```

`CrossCuttingNavRow`:

```tsx
function CrossCuttingNavRow({
  entity,
  selectedId,
  onSelect,
}: {
  entity: DomainEntity
  selectedId: string
  onSelect: (id: string) => void
}) {
  const Icon = ICONS[entity.icon] ?? Package
  const tone = entityTone(entity)
  const rel = relations.find((relation) => relation.from === entity.id || relation.to === entity.id)
  const peer = entityById(rel?.from === entity.id ? rel.to : rel?.from ?? null)
  const isSelected = selectedId === entity.id

  return (
    <button
      type="button"
      onClick={() => onSelect(entity.id)}
      className={cn(
        'flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors',
        isSelected
          ? cn('border-transparent shadow-sm ring-2', TONE_RING[tone], toneCard[tone])
          : 'border-border/60 bg-card hover:bg-muted/30',
      )}
    >
      <span className={cn('flex size-8 shrink-0 items-center justify-center rounded-lg border', toneIconBox[tone])}>
        <Icon className={cn('size-3.5', toneIcon[tone])} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{entity.name}</span>
        {peer && (
          <span className="block truncate text-[11px] text-muted-foreground">— {peer.name}</span>
        )}
      </span>
    </button>
  )
}
```

Mobile chain pill (horizontal):

```tsx
function ChainPill({
  entity,
  selectedId,
  onSelect,
}: {
  entity: DomainEntity
  selectedId: string
  onSelect: (id: string) => void
}) {
  const tone = entityTone(entity)
  const isSelected = selectedId === entity.id
  return (
    <button
      type="button"
      onClick={() => onSelect(entity.id)}
      className={cn(
        'shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold',
        isSelected ? cn(toneCard[tone], toneText[tone], 'ring-2', TONE_RING[tone]) : 'border-border/70 bg-card text-foreground',
      )}
    >
      {entity.name}
    </button>
  )
}
```

- [ ] **Step 3: Implement `DomainModelSplitView` layout**

```tsx
function DomainModelSplitView({
  query,
  category,
  selectedId,
  onSelect,
}: {
  query: string
  category: CategoryFilter
  selectedId: string
  onSelect: (id: string) => void
}) {
  const visibleChain = filterEntities(CHAIN, query, category, entityMatches, entityCategory)
  const visibleCrossCutting = filterEntities(CROSS_CUTTING, query, category, entityMatches, entityCategory)
  const selected = entityById(selectedId) ?? visibleChain[0] ?? visibleCrossCutting[0]
  const hasResults = visibleChain.length > 0 || visibleCrossCutting.length > 0

  if (!hasResults) return <EmptyState query={query || category} />

  const nav = (
    <div className="space-y-4">
      <div>
        <h2 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <GitBranch className="size-3.5 text-teal-600 dark:text-teal-400" />
          Main chain
        </h2>
        {/* mobile pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
          {visibleChain.map((entity) => (
            <ChainPill key={entity.id} entity={entity} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </div>
        {/* desktop vertical */}
        <div className="hidden space-y-1.5 lg:block">
          {visibleChain.map((entity) => (
            <ChainNavRow key={entity.id} entity={entity} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-card/50 p-3">
        <h2 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <ArrowLeftRight className="size-3.5 text-amber-600" />
          Cross-cutting
          <span className="font-mono text-[10px] text-muted-foreground/80">({visibleCrossCutting.length})</span>
        </h2>
        <div className="space-y-1.5">
          {visibleCrossCutting.map((entity) => (
            <CrossCuttingNavRow key={entity.id} entity={entity} selectedId={selectedId} onSelect={onSelect} />
          ))}
        </div>
      </div>
    </div>
  )

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)] lg:items-start">
      <aside className="min-w-0 lg:sticky lg:top-3 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
        {nav}
      </aside>
      <div className="min-w-0 lg:sticky lg:top-3 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
        {selected && (
          <EntityDetailPanel key={`detail-${selected.id}`} entity={selected} onNavigate={onSelect} />
        )}
      </div>
    </div>
  )
}
```

For empty-state query prop, if `query` is empty but category filters everything, pass a readable label e.g. `category === 'all' ? query : ENTITY_CATEGORIES.find(...)?.label ?? category`.

- [ ] **Step 4: Wire page + delete old hierarchy UI**

```tsx
export default function DomainModelPage() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryFilter>('all')
  const [selectedId, setSelectedId] = useState('schedule')

  useEffect(() => {
    const chain = filterEntities(CHAIN, query, category, entityMatches, entityCategory)
    const cross = filterEntities(CROSS_CUTTING, query, category, entityMatches, entityCategory)
    const next = resolveSelection(selectedId, chain, cross)
    if (next && next !== selectedId) setSelectedId(next)
  }, [query, category, selectedId])

  return (
    <ProductPage path="/product/domain-model">
      <DomainModelChrome
        query={query}
        onQueryChange={setQuery}
        category={category}
        onCategoryChange={setCategory}
      />
      <main className="pt-3">
        <DomainModelSplitView
          query={query}
          category={category}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />
      </main>
    </ProductPage>
  )
}
```

Remove `HierarchyView`, `HierarchyNode`, `HierarchyConnector` and unused imports (`ChevronRight` only if unused, `ArrowDown` if unused).

- [ ] **Step 5: Verify filters + layout manually**

Checklist at `http://localhost:4002/product/domain-model`:

1. Desktop: left nav + right detail side by side; no 6-wide cards; no `1:N` badges between chain rows
2. Click Schedule → Shipment Item → Hub — detail updates
3. Category chip e.g. Transfer — chain/cross lists shrink; selection jumps if needed
4. Search `webhook` — only matching rows; empty nonsense query shows `EmptyState`
5. Narrow viewport: horizontal chain pills; detail below lists
6. Learning-path Continue / EntityNavChip still navigate

- [ ] **Step 6: Run unit tests again**

Run: `pnpm --filter @nesy/web test src/app/(cockpit)/product/domain-model/domain-model-filters.test.ts`

Expected: PASS

- [ ] **Step 7: Commit only if user asked** — otherwise skip

---

### Task 4: Polish + regression sweep

**Files:**
- Modify: `apps/web/src/app/(cockpit)/product/domain-model/page.tsx` (spacing/contrast only if needed)

- [ ] **Step 1: Visual polish pass**

- Ensure cross-cutting block is a simple bordered section (not dashed amber hero)
- Ensure selected nav rows use tone ring + light fill, not large pastel cards
- Confirm header stats chips still show total chain/cross counts (unfiltered totals from `CHAIN` / `CROSS_CUTTING`), not filtered counts
- Confirm `EntityDetailPanel` internals unchanged

- [ ] **Step 2: Typecheck / lint touched files**

Run: `pnpm --filter @nesy/web typecheck`

Expected: no errors from new/changed domain-model files

- [ ] **Step 3: Final manual pass** — same checklist as Task 3 Step 5

- [ ] **Step 4: Commit only if user asked** — otherwise skip

---

## Spec coverage (self-review)

| Spec requirement | Task |
| --- | --- |
| Sticky master-detail desktop | Task 3 |
| Vertical main chain | Task 3 |
| Flat cross-cutting + category chips | Task 2 + 3 |
| Search + category compose | Task 1 + 3 |
| Selection auto-correct / empty state | Task 1 + 3 |
| Mobile pills + list + detail below | Task 3 |
| Keep tone system + EntityDetailPanel | Task 3–4 |
| No domain-glossary changes | All tasks |
| Remove card grid / 1:N connectors | Task 3 |

## Placeholder scan

No TBD/TODO steps; commit steps explicitly gated on user request.
