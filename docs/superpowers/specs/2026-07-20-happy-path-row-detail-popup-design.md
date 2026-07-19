# Happy Path Row → Detail Popup

**Date:** 2026-07-20  
**Status:** Approved  
**App:** NesyMobileCocpit (`/data-center/happy-path`)

## Problem

In the Happy Path view dialog, clicking a shipment/pickup row opens Nesy Dashboard in a new tab. On the Shipment and Pickup pages, the same kind of record opens an in-app detail dialog (`ShipmentViewSheet` / `PickupViewDialog`). Users want that same detail experience from Happy Path.

## Goals

1. Row click on a Happy Path entry with a DB record opens the same detail dialog as the list pages.
2. External-link control opens Nesy (previous row-click behavior).
3. Reuse existing detail components; do not rebuild detail UI.

## Non-goals

- Changing `ShipmentViewSheet` / `PickupViewDialog` internals
- Embedding full record `data` into Happy Path pool payloads
- Opening detail for “not generated” / failed rows without a DB id

## Decisions (approved)

| Topic | Choice |
| --- | --- |
| Row click | Opens detail dialog only |
| Nesy open | External link icon (stopPropagation) |
| Pickups | Open `PickupViewDialog` |
| Data loading | Fetch record by id on click |
| Approach | Add `GET /shipments/:id` and `GET /pickups/:id` |

## Behavior

- If entry has `shipmentId` / `pickupId` (`hasRecord`):
  - Row click / Enter / Space → fetch record → open detail
  - External link click → existing Nesy URL flow
- If no record id: row not interactive for detail; no Nesy affordance change for error-only rows
- While fetching: per-row spinner; ignore double-clicks
- Fetch error / 404: do not open dialog; show error in Happy Path dialog
- Closing detail leaves Happy Path dialog open; clears selected record
- Footer hint: row opens detail · external icon opens Nesy

## Architecture

```
EntryListItem click
  → handleOpenDetail(entry)
    → getShipment(id) | getPickup(id)
    → setSelectedShipment | setSelectedPickup + open flag
    → ShipmentViewSheet | PickupViewDialog

ExternalLink click (stopPropagation)
  → handleOpenNesy(entry)  // unchanged
```

### API

- `GET /api/shipments/:id` → `{ data: ShipmentRecord }` or 404  
- `GET /api/pickups/:id` → `{ data: PickupRecord }` or 404  

Response shape matches list endpoints (`findUnique` of the same Prisma models).

Register after more-specific `/:id/...` routes so Express matching stays correct.

### Web services

- `getShipment(id: string): Promise<ShipmentRecord>`
- `getPickup(id: string): Promise<PickupRecord>`

### UI (`happy-path-view-dialog.tsx`)

- State: `selectedShipment`, `isShipmentViewOpen`, `selectedPickup`, `isPickupViewOpen`, `openingDetailKey`
- Props into `ShipmentViewSheet`: record + `token` + pool `country` / `environment`
- Props into `PickupViewDialog`: record only
- External link becomes a focusable control with `stopPropagation`

## Error handling

| Case | Result |
| --- | --- |
| Missing record id | No detail open |
| 404 / network error | Error message; dialog stays closed |
| Concurrent click | Blocked while `openingDetailKey` set |

## Manual test plan

- [ ] Created shipment row → `ShipmentViewSheet`
- [ ] Created pickup row → `PickupViewDialog`
- [ ] External icon → Nesy new tab
- [ ] Failed / not generated without id → no detail
- [ ] Close detail → Happy Path remains open
- [ ] Fetch failure shows error, no blank dialog
