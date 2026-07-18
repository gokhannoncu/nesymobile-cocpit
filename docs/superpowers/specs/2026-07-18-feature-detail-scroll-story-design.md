# Feature Detail Page — Editorial Scroll Story Redesign

**Date:** 2026-07-18  
**Status:** Draft for review  
**App:** NesyMobileCocpit (`/product/feature-library/[slugName]`)

## Problem

The shared feature detail template (`[slugName]/page.tsx`) packs rich feature
knowledge into a tabbed card stack (Overview / Country Scope / Flow /
Parameters & API / Know-how & Score). That layout fails three jobs at once:

- **Hierarchy** — “what is this / how risky / what differs by country” is not
  visible in one scan; users hop tabs and lose context.
- **Visual language** — Hero + repeated tone panels + chips feel generic and
  disconnected from stronger product pages (e.g. Domain Model).
- **Operability** — flow, tickets, APIs, and country deltas are hard to act on
  because they compete inside dense card grids.

This redesign applies to **all** feature detail pages via the shared template
(Collect COD is the primary smoke case; e.g. `/product/feature-library/collect-cod`).

Related but distinct: `2026-07-18-feature-library-ux-redesign-design.md` covers
the list catalog + identity badges. **This spec supersedes that document’s
“detail body stays as tabs” stance** — detail chrome and body layout are fully
redesigned here. Feature narrative content remains unchanged.

## Goals

1. Replace tabs with a single **editorial scroll story**.
2. Add a **sticky mini-nav** with in-page anchors (`Overview · Flow · Countries · Tech · Ops`).
3. Rebuild visual hierarchy: identity band → sections with clear eyebrows;
   reduce card clutter while keeping product `tone*` language.
4. Keep existing data model and feature content; redesign presentation only.
5. Scale cleanly to every feature slug, including empty / partial `detail`.

## Non-goals

- Rewriting `FEATURE_DETAILS` copy, diagrams, tickets, or APIs
- Changing Feature Library list page layout (out of scope unless link/breadcrumb
  breakage appears)
- New backend / API routes
- Adding new domain fields to the feature model
- Per-feature custom layouts (no Collect-COD-only page)

## Decisions (approved)

| Topic | Choice |
| --- | --- |
| Scope | Shared template for all feature detail pages |
| Problem focus | Hierarchy + visual language + operability |
| Reading model | Editorial scroll story (no tabs) |
| In-page nav | Sticky mini-nav with section anchors |
| Layout approach | Editorial Story (not signal-first strip, not split canvas) |
| Section order | Identity → Overview → Flow → Countries → Tech → Ops → Prev/Next |
| Content model | Unchanged; presentation only |

## Information architecture

```
Breadcrumb + counter
Identity band (title, lead, badges, 3 signals)
Sticky mini-nav (anchors)
── Overview ──  whatIs · howItWorks · screens
── Flow ──────  FlowDiagram (if present)
── Countries ─  country rows (status + behavior)
── Tech ──────  parameters · APIs
── Ops ───────  tips · score · tickets · experts
Prev / Next footer
```

### Sticky mini-nav

- Items: Overview, Flow, Countries, Tech, Ops
- Behavior: `scrollIntoView` / hash anchors; active section via
  `IntersectionObserver` scroll-spy
- Not a tab panel — all sections remain mounted in the DOM when shown
- Mobile: horizontal scrollable bar
- Sections without data (e.g. no `detail`, no diagram) are **omitted** from the
  nav entirely (do not show disabled stubs)

### Section order rationale

Overview before Flow so readers understand the feature before the diagram.
Countries after Flow so operational variance follows the happy path.
Tech and Ops remain reference sections at the bottom.

## Visual language

Preserve existing product tones (`toneCard`, `toneIcon`, module tone rotation).
Reduce “card everywhere” density.

### Identity band

- Full-width, subtle tone-tinted surface (aligned with current product hero
  language — not a new brand system)
- Left: module icon, title, lead description
- Right / below: three typography-forward signals — Country coverage, Risk
  (`bugProneness/5` when detail exists), Ticket count
- Sparse chips: CORE (if applicable), process module, detail ready/pending

### Sections

- Each section: small uppercase eyebrow + one headline (+ optional one-line lead)
- Prefer section dividers and light surfaces over nested bordered panels
- Use compact list rows / limited bordered items only where interaction or
  scannability needs them (country rows, tips, tickets, API rows)

### Countries

- Replace `DataTable` with country rows: name · type/status badge · behavior
- Long behavior text: ~2-line clamp + expand control

### Flow / Tech / Ops

- Flow: existing `FlowDiagram` in a spacious container
- Tech: two columns (parameters | APIs), stack on small screens
- Ops: tips + score side-by-side; tickets + experts below

### Motion

- Mini-nav active indicator transition
- Light section enter / sticky shadow if needed
- Prev/Next hover affordance
- No decorative animation noise

## Data & empty states

**Sources unchanged:** `listFeatureRecordsByDomain()`, `FEATURE_DETAILS` via
feature records, `COUNTRIES`, `getFeatureDomain`, `isSupported`, `toFeatureSlug`.

| Case | Behavior |
| --- | --- |
| Unknown slug | Existing not-found callout + link back |
| No `detail` | Identity + Countries + Overview empty (“Detail pending”); hide Flow/Tech/Ops from nav |
| Empty sub-collection (e.g. no APIs) | Inline empty inside section; page remains intact |
| No diagram | Hide Flow section + nav item |

## Components & files

| Area | Files |
| --- | --- |
| Primary | `apps/web/src/app/(cockpit)/product/feature-library/[slugName]/page.tsx` |
| Optional helpers | `apps/web/src/components/product/` — e.g. sticky section nav, section shell, country rows |
| Exports | `apps/web/src/components/product/index.ts` if new public helpers are added |
| Unchanged content | `feature-details.ts`, `nesy.ts` feature narratives |
| Unchanged consumers | Country Matrix, list page layout (unless breadcrumb/prev-next order already domain-ordered) |

Remove detail-page usage of `SegmentTabs` for this view. Do not break other
pages that still use `SegmentTabs`.

## Error / edge cases

- Hash deep-link (`#tech`) should scroll to section when present
- Sticky nav must not cover section headings (`scroll-margin-top`)
- Prev/Next follow `listFeatureRecordsByDomain()` order (same source as today)
- Mobile: identity metrics stack; mini-nav scrolls horizontally; Tech/Ops stack

## Testing

1. Collect COD smoke: all sections render; mini-nav jumps and highlights
2. Feature without `detail`: Overview empty; Flow/Tech/Ops omitted
3. Feature with detail but empty `apis` / `tips`: inline empties only
4. Breadcrumb + domain link + prev/next still work
5. Desktop + mobile layout check (no horizontal page overflow)
6. Unknown slug still shows not-found

## Implementation notes

- Presentation-only change; YAGNI on new data fields and per-feature layouts
- Stay inside product visual language; this is hierarchy/UX, not a new brand
- After code changes, run `graphify update .` before architecture Q&A (local graph)
