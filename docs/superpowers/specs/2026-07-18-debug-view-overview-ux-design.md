# Debug View Overview — Status-Driven UX

**Date:** 2026-07-18  
**Status:** Implemented  
**Scope:** `/debug-view/overview` only (`apps/web/src/app/(cockpit)/debug-view/overview/page.tsx`)

## Problem

The Device Overview page tints almost every surface with `tone="orange"`:
header, badges, KPI cards, page sections, detail panels, meta strip, and hover
borders. Decorative orange washes out hierarchy, so healthy vs warning vs error
states are hard to scan.

## Goals

1. Surfaces stay **neutral** (`border` + `bg-card` / `bg-muted`).
2. Color appears only when it carries **status or section meaning**.
3. Keep layout, data wiring, and shared debug components unchanged.

## Non-goals

- Other Debug View pages (database, schedule, network, …)
- Changes to `shared.tsx`, `tones.ts`, or product primitives
- New components or copy rewrites beyond tone/class updates

## Decisions (approved)

| Topic | Choice |
| --- | --- |
| Scope | A — overview page only |
| Approach | Status-driven neutral surfaces |
| Header accent | `teal` (Debug View default) |
| Section accents | Network `blue`, System `indigo`, Firebase `teal` |
| KPI colors | Status thresholds only (green / amber / red / gray) |

## Visual rules

### Header

- `DebugHeader` tone: `teal`
- Badges: outline, no orange tone (neutral / omit tone)

### Meta strip (`RuntimeMetaStrip`)

- Remove `bg-orange-50/40` header wash → muted / default card header
- Icons and serial badge: `gray` / muted, not orange
- Hover borders: `border-border`, not `hover:border-orange-500/25`

### KPI bar (`StatCard`)

| Card | Tone rule |
| --- | --- |
| Connection | offline → `red`; wifi/cellular → `green` |
| Latency | null → `gray`; low → `green`; mid → `amber`; high → `red` |
| Battery | keep existing: null `gray`, ≤15 `red`, ≤50 `amber`, else healthy `green` (not orange) |
| NesyMobile | process running → `green`; installed not running → `amber`; missing → `red` |

Latency thresholds (ms): ≤80 green, ≤200 amber, else red. Null stays gray.

### Sections & panels

- `PageSection` tones: Network `blue`, System `indigo`, Firebase `teal`
- Detail cards: `rounded-xl border bg-card` (or `toneCard.gray` where a soft fill helps) — not `toneCard.orange`
- Remove orange hover borders and orange header strips on Application process / permissions
- Progress bars: default muted/foreground fill; high usage (≥85%) amber or red
- FCM token block: `bg-muted` mono, not orange-tinted code well

### Status that stays colored

- Roaming, battery optimization, debuggable build, permission granted/denied
- Firebase unavailable warning (amber dashed)
- Snapshot error state (red) — unchanged

## Implementation notes

- Single file touch: `overview/page.tsx`
- Small helpers OK if they clarify KPI tone mapping (e.g. `latencyTone`, `batteryTone`)
- No API / mock data changes

## Acceptance

- [ ] Page is not visually orange-dominant at first glance
- [ ] KPI colors change with real device status
- [ ] Network / System / Firebase sections are distinguishable without reading titles alone
- [ ] Other debug-view routes unchanged
