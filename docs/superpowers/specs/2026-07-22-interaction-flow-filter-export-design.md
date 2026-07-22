# Interaction Flow — Filter + JSON Export

**Date:** 2026-07-22  
**Status:** Approved  
**App:** NesyMobileCocpit (`/debug-view/interactions`)

## Problem

The Interaction Flow timeline only filters by event kind (click, screen, scan, …). Teams need to narrow a session by time and free-text search, then download the visible result as JSON for offline analysis or ticket attachments. Multiple instrumented apps on one device (e.g. RS Stage + RS Prod) both emit `InteractionEvent` into the same stream; app identity is not in the payload today, so app-based filtering is deferred.

## Goals

1. Filter captured interactions by **kind** (existing), **date/time range**, and **text search**.
2. Export the **currently filtered** event list as a JSON file.
3. Keep capture/storage unchanged (`InteractionCaptureProvider`, adb SSE, localStorage).

## Non-goals

- Filtering or labeling by application / package (Stage vs Prod)
- CSV or other export formats
- Exporting the full retained set when filters are active (export = filtered view only)
- Server-side export API
- Changing `InteractionEvent` schema or mobile instrumentation
- Raising the 2,000-event retention cap

## Decisions (approved)

| Topic | Choice |
| --- | --- |
| Approach | Client-side filter bar + Blob download on the page |
| App separation | Deferred (option 3) |
| Export format | JSON only |
| Export scope | Filtered view only |
| Date controls | `datetime-local` From / To; empty = unbounded that side |
| Search fields | `label`, `detail`, `screen`, `analyticsEvent` (case-insensitive contains) |
| Kind chips | Unchanged UX; counts reflect date+search-applied set |

## Behavior

### Filters

Applied in order: kind → date range → text search.

- **From / To:** `datetime-local` values are interpreted in the browser’s local timezone (`new Date(from)` / `new Date(to)`). Compare against `Date.parse(event.timestamp)`. Empty From or To means no bound on that side. If From > To, treat as empty result (no swap). Events whose timestamp does not parse are excluded when any date bound is set.
- **Search:** trim; empty string = no text filter. Match if any of label / detail / screen / analyticsEvent contains the query (case-insensitive). Null fields are skipped.
- **Kind:** existing `all | InteractionKind` chips.
- **Clear filters:** kind → `all`, From/To → empty, search → empty.
- Kind chip **counts** are computed from the set after date + search (before kind filter), so switching kind does not zero out peer counts incorrectly.
- Timeline renders the fully filtered list (still with consecutive same kind/label/screen grouping for display only).

### Empty states

- No events stored → existing “No interactions captured yet” onboarding.
- Events exist but filters yield zero → “No matches” with Clear filters (extends current kind-only empty state).

### Export

- **Export JSON** button next to Clear; disabled when filtered list is empty.
- Client-side `Blob` + anchor download; no API.
- Filename: `interactions-{deviceSerial}-{ISO-timestamp}.json` (sanitize serial for filesystem safety).
- Payload events are the filtered list as raw `InteractionEvent[]` (chronological by timestamp ascending), **not** display-grouped (`repeatCount` omitted).
- Embedded `filters` snapshot matches UI state at click time.

```json
{
  "exportedAt": "2026-07-22T13:56:00.000Z",
  "device": { "serial": "…", "name": "Samsung SM-A346E" },
  "filters": {
    "kind": "all",
    "from": null,
    "to": null,
    "search": ""
  },
  "count": 42,
  "events": []
}
```

## Architecture

```
InteractionCaptureProvider.events (unchanged)
  → filterInteractions(events, { kind, from, to, search })
  → filteredEvents
       ├─→ timeline display (group consecutive for UI)
       └─→ buildInteractionExport({ device, filters, events: filteredEvents })
            → download JSON Blob
```

### Files

| Path | Role |
| --- | --- |
| `apps/web/src/lib/debug-view/filter-interactions.ts` | Pure `filterInteractions` + `buildInteractionExport` |
| `apps/web/src/lib/debug-view/filter-interactions.test.ts` | Unit tests for filter combos + export shape |
| `apps/web/src/app/(cockpit)/debug-view/interactions/page.tsx` | Filter UI + Export button; delegates to helpers |

Unchanged: `interaction-capture-context.tsx`, stream route, `InteractionEvent` type, parser.

## Testing

- Kind-only, date-only, search-only, and combined filters.
- Unbounded From or To; search on null detail/analytics.
- Export payload: count matches events length; filters echo input; chronological order; no `repeatCount`.
- Page smoke: button disabled when filtered empty; enabled when matches exist.

## Out of scope follow-ups

- Add `packageName` (or logcat UID mapping) for Stage/Prod filtering.
- CSV export / “export all retained”.
- Persist filter state in URL query params.
