# Feature Library UX Redesign — Domain Hierarchy + Core-First Catalog

**Date:** 2026-07-18  
**Status:** Draft for review  
**App:** NesyMobileCocpit (`/product/feature-library` + detail slug page)

## Problem

The Feature Library presents all capabilities as a process-module kanban
(`BoardGrid` columns: Delivery Process, Pickup Process, …). That layout fails
the product mental model:

- **Groups are unclear** — finance (COD, ExW, CPP, fiscalization) sits beside
  signature / failed-delivery cards with equal visual weight.
- **Core is unclear** — CORE is a small badge, not a hierarchy.
- **Hierarchy is flat** — no domain → core → related structure.
- **Naming feels inconsistent** — e.g. “Collect COD” reads like jargon without
  a Payments context.

Country Matrix and other product pages correctly treat `MODULES` as **process**
ownership. Feature Library needs a second axis: **capability domain**.

## Goals

1. Regroup the inventory by **capability domains** (Payments & Fiscal first).
2. Make **CORE capabilities** an explicit strip inside each domain.
3. Keep **process + country + risk** signals on each card (hybrid model).
4. Replace the kanban board with a **stacked domain catalog** and **rich cards**.
5. Align the **detail page** identity (breadcrumb + domain/CORE/process badges)
   without rewriting feature content.
6. Preserve `MODULES` as process source of truth for Country Matrix and friends.

## Non-goals

- Rewriting Country Matrix / Country Profiles layouts
- Changing feature narrative content (whatIs, flows, APIs, tickets)
- Backend/API work
- Adding or removing features from the inventory
- Full product-area comparison / matrix redesign

## Decisions (approved)

| Topic | Choice |
| --- | --- |
| Navigation axis | Hybrid — domains primary; process + CORE + country on cards |
| CORE presentation | Core capabilities strip at top of each domain; related below |
| Domain taxonomy | Payments & Fiscal · Delivery Outcomes · Pickup Operations · Tour & Stops · Tracking & Self-service |
| Page layout | Stacked domain catalog (not sidebar, not domain kanban) |
| Card density | Rich — desc, process chip, country dots, risk, tickets |
| Filters | Domain jump chips + search + Core only toggle (does not hide other domains unless Core-only empties them) |
| Scope | List page + detail page identity alignment |
| Data approach | Keep `MODULES`; add `domainId` on Feature + `FEATURE_DOMAINS` catalog |

## Information architecture

Two orthogonal axes:

| Axis | Source | Used by |
| --- | --- | --- |
| Process module | Existing `MODULES` | Country Matrix, process chip on cards, detail badge |
| Capability domain | New `FEATURE_DOMAINS` + `Feature.domainId` | Feature Library grouping & jump nav, detail breadcrumb |

```
FEATURE_DOMAINS[]
  └── features[] (via domainId)
        ├── process module (parent MODULES entry)
        ├── CORE? (isSupported(values.core))
        └── country coverage (values[hr|si|…])
```

### Domain catalog

| Domain ID | Title | Role |
| --- | --- | --- |
| `payments-fiscal` | Payments & Fiscal | Money collection, skip rules, fiscal print |
| `delivery-outcomes` | Delivery Outcomes | Doorstep completion, failure, alt delivery points |
| `pickup-operations` | Pickup Operations | Assignment, pickup variants, failures, reassignment |
| `tour-stops` | Tour & Stops | Stop merge, BOD approval, HC events |
| `tracking-self-service` | Tracking & Self-service | Tracking UI, Ebranch options, D4Me locker |

### Feature → domain map (v1)

| Domain | Feature IDs |
| --- | --- |
| Payments & Fiscal | `collect_cod`, `collect_exw`, `skip_exwork`, `fiscalization_dp`, `collect_cpp`, `pickup_fiscalization` |
| Delivery Outcomes | `failed_reasons`, `consignee_info`, `signature_dp`, `delivery_parcelshop`, `delivery_locker` |
| Pickup Operations | `pickup_assignment`, `pickup_at_customer`, `remote_pickup`, `red_label`, `pickup_failed_non_rdoc`, `rdoc_failed_reasons`, `auto_reassignment` |
| Tour & Stops | `creation_of_stops`, `merge_stops_manual`, `tour_start_approval`, `app_hc_event_list` |
| Tracking & Self-service | `shipment_tracking_screen`, `ebranch_tracking_link`, `d4me_locker_delivery` |

Every existing feature appears in exactly one domain. Process module membership
is unchanged.

## Data model changes

**File:** `apps/web/src/data/product/nesy-types.ts`

```ts
export type FeatureDomainId =
  | 'payments-fiscal'
  | 'delivery-outcomes'
  | 'pickup-operations'
  | 'tour-stops'
  | 'tracking-self-service'

export interface FeatureDomain {
  id: FeatureDomainId
  title: string
  desc: string
}

export interface Feature {
  id: string
  title: string
  desc: string
  domainId: FeatureDomainId
  values: Record<CountryId, string>
  detail?: FeatureDetail
}
```

**File:** `apps/web/src/data/product/nesy.ts` (or small sibling `feature-domains.ts`)

- Export `FEATURE_DOMAINS: FeatureDomain[]`
- Set `domainId` on every feature in `MODULES`
- Helper: `featuresByDomain()` / `getFeatureDomain(id)` for list + detail

Country Matrix continues to iterate `MODULES` only — no domain dependency.

## List page UX (`/product/feature-library`)

### Hero

Keep `HeroCallout`. Retarget copy to domain inventory + Core-first hierarchy.
Chips: total features · 5 domains · active countries · Core baseline.

### Sticky filter bar

- Search over feature title + description (tr-TR normalize, existing behavior)
- Domain jump chips → `scrollIntoView` / hash `#domain-{id}` (sections stay mounted)
- **Core only** toggle → within each domain, hide non-CORE features; hide domains
  that become empty
- Result count on the right (xl+)

Remove process-module filter pills from this page (process remains on cards).

### Domain sections

Replace `BoardGrid` with stacked sections. Each section:

1. Anchor id `domain-{domainId}`
2. Header: title, short desc, feature count (respecting active filters)
3. **Core capabilities** panel — features where `isSupported(values.core)`
4. **Related / country-scoped** list — remaining features in that domain

If a domain has no CORE features after filters, omit the Core panel (do not show
an empty strip). If both strips empty, omit the whole domain section.

### Rich feature card

| Element | Source |
| --- | --- |
| Title | `feature.title` |
| CORE badge | `isSupported(values.core)` |
| Description | `feature.desc` |
| Process chip | parent module title |
| Country dots | HR SI RS BA ME SK — filled if supported, muted if `—` / `N/A` |
| Risk badge | optional, `detail.score.bugProneness >= 4` |
| Meta | ticket count + “View details →” |
| Link | `/product/feature-library/{slug}` |

Reuse existing product tones / `TagBadge` patterns. Prefer a dedicated
`FeatureCatalogCard` (or equivalent) over overloading `BoardGrid` cards.

### Empty state

Dashed panel + clear search + reset Core only (same spirit as today).

## Detail page UX (`/product/feature-library/[slug]`)

Do **not** rewrite body content. Update identity chrome only:

- Breadcrumb / back context: Feature Library → **{Domain title}** → Feature
- Badges row: CORE (if applicable) · Process module · `{n}/6 countries`
- Optional subtle domain eyebrow above the title

Previous / next navigation: **domain-ordered, CORE-first within each domain**
(same reading order as the list catalog).

## Components & files (expected touch list)

| Area | Files |
| --- | --- |
| Types / data | `nesy-types.ts`, `nesy.ts`, optional `feature-domains.ts` |
| List page | `apps/web/src/app/(cockpit)/product/feature-library/page.tsx` |
| Detail page | `apps/web/src/app/(cockpit)/product/feature-library/[slugName]/page.tsx` |
| UI primitives | new catalog section/card under `apps/web/src/components/product/` (or colocated) |
| Unchanged | `country-matrix`, `country-profiles`, `feature-details` content |

## Error / edge cases

- Search with no matches → empty state; domains hidden
- Core only + search → intersection; empty domains omitted
- Feature missing `domainId` → treat as implementation bug; fail typecheck (required field)
- Feature with no CORE and no countries supported → still listed under Related if it exists in data

## Testing

Manual / light automated as fits repo norms:

1. All features appear exactly once across the five domains
2. Payments & Fiscal contains COD / ExW / CPP / fiscalization features
3. Core strip only lists CORE-supported features
4. Core only toggle hides non-CORE cards
5. Domain jump scrolls to the correct section
6. Search filters across domains
7. Rich card links to correct slug
8. Detail shows domain + process + CORE badges
9. Country Matrix still renders process modules unchanged

## Implementation notes

- Stay inside existing product visual language (`ProductPage`, `PageSection`,
  tones). This is a hierarchy/UX change, not a new brand surface.
- YAGNI: no persisted filter state, no new backend, no domain editor UI.
- After code changes, run `graphify update .` before architecture Q&A (local graph).
