# Feature Detail Scroll Story Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do **not** create git commits unless the user explicitly asks.

**Goal:** Replace the tabbed feature detail template with an editorial scroll story + sticky mini-nav for every `/product/feature-library/[slugName]` page.

**Architecture:** Extract pure section-visibility helpers (vitest). Add small product UI helpers for sticky section nav and country rows. Rebuild `[slugName]/page.tsx` as a single scroll composition using existing `ProductPage`, `PageSection`, `FlowDiagram`, `TagBadge`, and `tone*` tokens. Feature content/data stays unchanged.

**Tech Stack:** Next.js App Router client page, React hooks (`useEffect`, `useState`, `useRef`), Tailwind, `@/components/product` tones + shells, vitest.

**Spec:** `docs/superpowers/specs/2026-07-18-feature-detail-scroll-story-design.md`

## Global Constraints

- Primary UI file: `apps/web/src/app/(cockpit)/product/feature-library/[slugName]/page.tsx`
- Do not rewrite `FEATURE_DETAILS` / `nesy.ts` feature narrative content
- Remove detail-page use of `SegmentTabs` (do not break other consumers)
- Section order: Identity → Overview → Flow → Countries → Tech → Ops → Prev/Next
- Sticky mini-nav anchors; omit empty sections from nav entirely
- Preserve product `tone*` system — no new brand palette
- Prev/Next follow `listFeatureRecordsByDomain()` order
- No commits unless the user asks

---

## File structure

| File | Responsibility |
| --- | --- |
| `apps/web/src/app/(cockpit)/product/feature-library/[slugName]/feature-detail-sections.ts` | Pure helpers: which sections exist, nav items |
| `apps/web/src/app/(cockpit)/product/feature-library/[slugName]/feature-detail-sections.test.ts` | Vitest for those helpers |
| `apps/web/src/components/product/sticky-section-nav.tsx` | Sticky horizontal mini-nav + IntersectionObserver active state |
| `apps/web/src/components/product/feature-country-rows.tsx` | Country status rows with expandable behavior text |
| `apps/web/src/components/product/index.ts` | Re-export new helpers if used outside the page |
| `apps/web/src/app/(cockpit)/product/feature-library/[slugName]/page.tsx` | Full scroll-story layout wiring |

---

### Task 1: Section visibility helpers + tests

**Files:**
- Create: `apps/web/src/app/(cockpit)/product/feature-library/[slugName]/feature-detail-sections.ts`
- Create: `apps/web/src/app/(cockpit)/product/feature-library/[slugName]/feature-detail-sections.test.ts`

**Interfaces:**
- Consumes: `FeatureDetail` from `@/data/product/nesy-types` (or structural duck-typing in the helper)
- Produces:
  - `export type FeatureDetailSectionId = 'overview' | 'flow' | 'countries' | 'tech' | 'ops'`
  - `export type FeatureDetailSection = { id: FeatureDetailSectionId; label: string }`
  - `export function resolveFeatureDetailSections(input: { hasDetail: boolean; hasDiagram: boolean }): FeatureDetailSection[]`
    - Always includes `countries` (country matrix always available from feature values)
    - If `!hasDetail`: return only `overview` + `countries`
    - If `hasDetail && !hasDiagram`: `overview`, `countries`, `tech`, `ops` (no `flow`)
    - If `hasDetail && hasDiagram`: all five in order Overview → Flow → Countries → Tech → Ops
  - Labels: Overview, Flow, Countries, Tech, Ops

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { resolveFeatureDetailSections } from './feature-detail-sections'

describe('resolveFeatureDetailSections', () => {
  it('returns overview + countries when detail is missing', () => {
    expect(resolveFeatureDetailSections({ hasDetail: false, hasDiagram: false }).map((s) => s.id)).toEqual([
      'overview',
      'countries',
    ])
  })

  it('omits flow when detail exists but diagram is empty', () => {
    expect(resolveFeatureDetailSections({ hasDetail: true, hasDiagram: false }).map((s) => s.id)).toEqual([
      'overview',
      'countries',
      'tech',
      'ops',
    ])
  })

  it('returns full ordered list when detail and diagram exist', () => {
    expect(resolveFeatureDetailSections({ hasDetail: true, hasDiagram: true }).map((s) => s.id)).toEqual([
      'overview',
      'flow',
      'countries',
      'tech',
      'ops',
    ])
  })

  it('uses stable labels', () => {
    const labels = resolveFeatureDetailSections({ hasDetail: true, hasDiagram: true }).map((s) => s.label)
    expect(labels).toEqual(['Overview', 'Flow', 'Countries', 'Tech', 'Ops'])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @nesy/web test -- "src/app/(cockpit)/product/feature-library/[slugName]/feature-detail-sections.test.ts"`

Expected: FAIL (module / export not found)

- [ ] **Step 3: Implement helpers**

```ts
export type FeatureDetailSectionId = 'overview' | 'flow' | 'countries' | 'tech' | 'ops'

export type FeatureDetailSection = {
  id: FeatureDetailSectionId
  label: string
}

const LABELS: Record<FeatureDetailSectionId, string> = {
  overview: 'Overview',
  flow: 'Flow',
  countries: 'Countries',
  tech: 'Tech',
  ops: 'Ops',
}

export function resolveFeatureDetailSections(input: {
  hasDetail: boolean
  hasDiagram: boolean
}): FeatureDetailSection[] {
  const ids: FeatureDetailSectionId[] = input.hasDetail
    ? input.hasDiagram
      ? ['overview', 'flow', 'countries', 'tech', 'ops']
      : ['overview', 'countries', 'tech', 'ops']
    : ['overview', 'countries']

  return ids.map((id) => ({ id, label: LABELS[id] }))
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @nesy/web test -- "src/app/(cockpit)/product/feature-library/[slugName]/feature-detail-sections.test.ts"`

Expected: PASS (4 tests)

- [ ] **Step 5: Stop — do not commit** (user requested no commits)

---

### Task 2: StickySectionNav component

**Files:**
- Create: `apps/web/src/components/product/sticky-section-nav.tsx`
- Modify: `apps/web/src/components/product/index.ts` — add `export * from './sticky-section-nav'`

**Interfaces:**
- Consumes: `FeatureDetailSection[]` shape `{ id: string; label: string }`, `Tone` optional for accent
- Produces: `export function StickySectionNav({ items, tone }: { items: { id: string; label: string }[]; tone?: Tone })`

Behavior requirements:
- Sticky under page chrome: `sticky top-0 z-20` (or match cockpit header offset if an existing sticky offset class is already used nearby — prefer `top-0` inside `ProductPage` content)
- Horizontal scroll on narrow viewports
- Clicking an item scrolls to `#feature-{id}` via `document.getElementById` + `scrollIntoView({ behavior: 'smooth', block: 'start' })`
- Active item from `IntersectionObserver` watching elements with ids `feature-${id}`; rootMargin top bias so the section under the sticky bar counts as active
- Active style: underline / stronger text using `toneText[tone]` when tone provided, else primary/foreground
- No tabs: does not mount/unmount section content

- [ ] **Step 1: Implement `StickySectionNav`**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { cn } from '@nesy/metronic/lib/utils'
import { type Tone, toneText } from './tones'

export function StickySectionNav({
  items,
  tone = 'gray',
}: {
  items: { id: string; label: string }[]
  tone?: Tone
}) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? '')

  useEffect(() => {
    if (items.length === 0) return
    const elements = items
      .map((item) => document.getElementById(`feature-${item.id}`))
      .filter((el): el is HTMLElement => Boolean(el))

    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        const top = visible[0]?.target.id.replace(/^feature-/, '')
        if (top) setActiveId(top)
      },
      { rootMargin: '-20% 0px -60% 0px', threshold: [0.1, 0.25, 0.5] },
    )

    for (const el of elements) observer.observe(el)
    return () => observer.disconnect()
  }, [items])

  if (items.length === 0) return null

  return (
    <nav
      aria-label="Feature sections"
      className="sticky top-0 z-20 -mx-1 overflow-x-auto border-b border-border/70 bg-background/90 px-1 py-2 backdrop-blur-md"
    >
      <ul className="flex min-w-max gap-1">
        {items.map((item) => {
          const active = item.id === activeId
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => {
                  document.getElementById(`feature-${item.id}`)?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                  })
                }}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                  active
                    ? cn('bg-muted text-foreground', toneText[tone])
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {item.label}
              </button>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
```

- [ ] **Step 2: Export from product index**

Add to `apps/web/src/components/product/index.ts`:

```ts
export * from './sticky-section-nav'
```

- [ ] **Step 3: Manual smoke after page wiring (Task 4)** — component alone has no vitest; verify with Collect COD scroll-spy in Task 4

- [ ] **Step 4: Stop — do not commit**

---

### Task 3: FeatureCountryRows component

**Files:**
- Create: `apps/web/src/components/product/feature-country-rows.tsx`
- Modify: `apps/web/src/components/product/index.ts` — add `export * from './feature-country-rows'`

**Interfaces:**
- Consumes: country list shaped as `{ id: string; name: string; subtitle: string; value: string }` where `value` is the feature.values entry
- Produces: `export function FeatureCountryRows({ rows }: { rows: FeatureCountryRow[] })`
- Expandable behavior: if text length > 120 chars (or contains `\n` and > 80), show clamp + Toggle “Show more / Show less”

Row mapping rules (same semantics as current page):
- `value === '—'` → status None / tone red / behavior “Not available yet.”
- `value === 'N/A'` → Out of scope / gray
- else → Active / green / show value with `whitespace-pre-line`
- `id === 'core'` → type badge Standard/indigo; else Country/gray

- [ ] **Step 1: Implement component**

```tsx
'use client'

import { useState } from 'react'
import { cn } from '@nesy/metronic/lib/utils'
import { TagBadge } from './collection'

export type FeatureCountryRow = {
  id: string
  name: string
  subtitle: string
  value: string
}

function statusOf(value: string): { label: string; tone: 'red' | 'gray' | 'green'; text: string } {
  if (value === '—') return { label: 'None', tone: 'red', text: 'Not available yet.' }
  if (value === 'N/A') return { label: 'Out of scope', tone: 'gray', text: 'Out of scope for this country.' }
  return { label: 'Active', tone: 'green', text: value }
}

function ExpandableText({ text }: { text: string }) {
  const needsClamp = text.length > 120 || (text.includes('\n') && text.length > 80)
  const [open, setOpen] = useState(false)
  return (
    <div>
      <p
        className={cn(
          'text-xs leading-relaxed text-foreground/80 whitespace-pre-line',
          needsClamp && !open && 'line-clamp-2',
        )}
      >
        {text}
      </p>
      {needsClamp && (
        <button
          type="button"
          className="mt-1 text-[11px] font-semibold text-primary"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}

export function FeatureCountryRows({ rows }: { rows: FeatureCountryRow[] }) {
  return (
    <ul className="divide-y divide-border/60 rounded-xl border border-border/70 bg-card/40">
      {rows.map((row) => {
        const status = statusOf(row.value)
        const isCore = row.id === 'core'
        return (
          <li key={row.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(140px,180px)_auto_1fr] sm:items-start sm:gap-4">
            <div>
              <div className="text-sm font-semibold text-foreground">{row.name}</div>
              <div className="text-xs text-muted-foreground">{row.subtitle}</div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <TagBadge label={isCore ? 'Standard' : 'Country'} tone={isCore ? 'indigo' : 'gray'} />
              <TagBadge label={status.label} tone={status.tone} />
            </div>
            <ExpandableText text={status.text} />
          </li>
        )
      })}
    </ul>
  )
}
```

- [ ] **Step 2: Export from product index**

```ts
export * from './feature-country-rows'
```

- [ ] **Step 3: Stop — do not commit**

---

### Task 4: Rebuild detail page as scroll story

**Files:**
- Modify: `apps/web/src/app/(cockpit)/product/feature-library/[slugName]/page.tsx` (full rewrite of render tree; keep not-found branch)

**Interfaces:**
- Consumes:
  - `resolveFeatureDetailSections` from `./feature-detail-sections`
  - `StickySectionNav`, `FeatureCountryRows`, `ProductPage`, `PageSection`, `FlowDiagram`, `TagBadge`, `Callout`, tones
  - Existing data helpers: `listFeatureRecordsByDomain`, `getFeatureDomain`, `isSupported`, `COUNTRIES`, `toFeatureSlug`
- Produces: Client page with scroll sections ids `feature-overview|flow|countries|tech|ops`

- [ ] **Step 1: Remove `SegmentTabs` usage and tab content tree from this page**

Keep imports that remain useful; delete unused tab-only helpers if orphaned (`DetailPanel` may stay as a lighter local list wrapper or be inlined — prefer a slim local `SectionBlock` only if `PageSection` is insufficient for nested panels).

- [ ] **Step 2: Wire section list**

```ts
const sections = resolveFeatureDetailSections({
  hasDetail: Boolean(detail),
  hasDiagram: Boolean(detail?.diagram && detail.diagram.length > 0),
})
```

- [ ] **Step 3: Identity band (replace `HeroCallout`)**

Structure:
- Breadcrumb row (existing links)
- Band: `rounded-2xl border p-5 sm:p-6` + `toneCard[tone]` / soft `toneHero` if available
- Left: ModuleIcon in `toneIconBox`, title (`text-2xl`/`text-3xl` font-bold), lead (`feature.desc`)
- Sparse chips: CORE / No CORE, module title, detail ready/pending
- Right or bottom metrics (typography, not mini cards): Country `supported/total`, Risk `bugProneness/5` or `—`, Tickets count

Use `scroll-mt-24` (or `scroll-mt-28`) on every `feature-*` section so sticky nav does not cover headings.

- [ ] **Step 4: Insert `<StickySectionNav items={sections} tone={tone} />` after identity band**

- [ ] **Step 5: Render sections in order, only when present in `sections`**

**Overview (`id="feature-overview"`):**
- If no detail: empty dashed panel “Detail content is not prepared yet for this feature.”
- If detail: `whatIs` paragraph; numbered `howItWorks`; compact `screens` list

**Flow (`id="feature-flow"`):** only if in sections — wrap `FlowDiagram` in spacious bordered container (existing diagram styles OK)

**Countries (`id="feature-countries"`):**
```tsx
<FeatureCountryRows
  rows={COUNTRIES.map((country) => ({
    id: country.id,
    name: country.name,
    subtitle: country.subtitle,
    value: feature.values[country.id],
  }))}
/>
```

**Tech (`id="feature-tech"`):** parameters + APIs two-column grid; inline empty strings when arrays empty

**Ops (`id="feature-ops"`):** tips + score; tickets + experts — reuse existing score bar / ticket / expert row visuals but without heavy nested tone cards where possible

- [ ] **Step 6: Keep prev/next footer** using `featureRecords` indices as today

- [ ] **Step 7: Preserve unknown-slug not-found UI**

- [ ] **Step 8: Typecheck / lint the touched files**

Run: `pnpm --filter @nesy/web exec tsc --noEmit -p tsconfig.json`  
(or the repo’s usual web typecheck script if different)

Expected: no errors in new/changed files

- [ ] **Step 9: Stop — do not commit**

---

### Task 5: Manual verification

**Files:** none (browser / local app)

- [ ] **Step 1: Open Collect COD**

URL: `http://localhost:4002/product/feature-library/collect-cod`

Checklist:
1. No tabs; single scroll
2. Sticky mini-nav shows Overview · Flow · Countries · Tech · Ops
3. Clicking each nav item scrolls to the matching section
4. Active nav item updates while scrolling
5. Countries are rows with expand for long values (e.g. HR/SI multi-line)
6. Flow diagram renders
7. Tech shows parameters + APIs
8. Ops shows tips, scores, tickets, experts
9. Breadcrumb + prev/next work
10. Mobile width: mini-nav horizontal scroll; sections stack

- [ ] **Step 2: Open a feature without detail (if any) or temporarily verify via helper tests** — Overview empty + Countries only in nav (Flow/Tech/Ops omitted)

- [ ] **Step 3: Unknown slug** `/product/feature-library/not-a-real-feature` → not-found callout

- [ ] **Step 4: Re-run unit tests**

Run: `pnpm --filter @nesy/web test -- "src/app/(cockpit)/product/feature-library/[slugName]/feature-detail-sections.test.ts"`

Expected: PASS

- [ ] **Step 5: If `graphify-out/graph.json` exists, run `graphify update .`** (skip if CLI unavailable)

- [ ] **Step 6: Stop — do not commit**

---

## Spec coverage check

| Spec requirement | Task |
| --- | --- |
| Shared template for all feature slugs | Task 4 |
| Scroll story, no tabs | Task 4 |
| Sticky mini-nav + IntersectionObserver | Task 2, 4 |
| Section order Overview→Flow→Countries→Tech→Ops | Task 1, 4 |
| Omit empty sections from nav | Task 1, 4 |
| Identity band + 3 signals | Task 4 |
| Country rows + expand | Task 3, 4 |
| Keep FlowDiagram / content model | Task 4 |
| Empty / partial detail behavior | Task 1, 4, 5 |
| Prev/Next via `listFeatureRecordsByDomain` | Task 4 |
| No content rewrite | Global constraint |
| Collect COD smoke | Task 5 |

## Notes for implementers

- Prefer `PageSection` for section eyebrows/titles (`id` prop exists) — if `id` must be `feature-*`, pass `id={\`feature-${section.id}\`}` directly.
- Do not introduce a Collect-COD-only route.
- `feature-detail-dialog.tsx` is out of scope unless it still duplicates tabs and the user later asks to align it.
