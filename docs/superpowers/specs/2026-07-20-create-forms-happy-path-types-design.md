# Create Shipment / Pickup Forms — Happy Path Types

**Date:** 2026-07-20  
**Status:** Draft for review  
**App:** NesyMobileCocpit (Data Center → Shipment / Pickup create dialogs)

## Problem

Happy Path can generate many shipment and pickup variants (Standard, COD, EXW,
DEPS, Multicolli, RDOC, Delivery & Pick, DOCO, Remote Pickup, PAC). The standalone
**Create Shipment** dialog only offers Standard / COD / RDOC. **Create Pickup**
only exposes Remote / Customer via a plain select, with no card UI parity and no
optional Happy Path pickup settings.

Operators who want a single typed shipment/pickup without running a full Happy
Path set must leave the create forms and use Happy Path instead.

## Goals

1. Extend **Create Shipment** type cards to cover all creatable Happy Path
   shipment routes, using the same BFF `shipmentType` values as Happy Path.
2. Show **type-specific extra fields** (COD, EXW, DEPS, Multicolli) when needed.
3. Support **Delivery & Pick** as shipment create + linked remote pickup (same
   behavior as Happy Path `execute-generation-job`).
4. Restyle **Create Pickup** Remote / PAC as the same card picker pattern; keep
   existing `createPickup` API (`pickupType: remote | customer`).
5. Optionally expose Happy Path pickup settings (date offset, end time, weight)
   on Create Pickup.

## Non-goals

- Adding `red-label` (Happy Path `route: "skip"` — not creatable)
- Adding PAC-linked DDEF shipment types (`ddef-shipment-1/2/3`) to Create Shipment
- Refactoring Happy Path generation into a shared executor (Approach 2 deferred)
- Changing Nesy `ClientSaveShipment` payload shapes beyond what BFF already sends
- Bulk “set” generation UI inside create dialogs

## Decisions (approved)

| Topic | Choice |
| --- | --- |
| Scope | D — all creatable Happy Path shipment types + pickup Remote/PAC |
| Implementation approach | 1 — extend existing card UI + type-specific fields |
| Shared executor refactor | Deferred; call `createSingleShipment` / `createPickup` directly |
| DDEF / red-label | Out of scope |
| Pickup UI | Card grid matching Create Shipment style |
| Pickup extra settings | Include date offset / end time / parcel weight (defaults from Happy Path) |

## Create Shipment — types

| Card label | BFF `shipmentType` | Extra UI | Notes |
| --- | --- | --- | --- |
| Standard | `standard` | — | Existing |
| COD | `cod` | Amount; currency + IBAN from country defaults when omitted | Existing amount field; add currency/IBAN parity with Happy Path defaults |
| EXW | `exw` | Billing option select | Pass `billingOption` + `payerType: 1` |
| DEPS | `deps` | OOH point picker (required) | Pass `counterLocationConsigneeId` |
| Multicolli | `multicolli` | Parcel count 2–10, optional integration code | Parcel count drives create `parcelCount` when this type is selected |
| RDOC | `return-document` | — | Existing |
| Delivery & Pick | `delivery-pick` | — | After successful shipment create, also `createPickup` (remote) with consignee-derived customer |
| DOCO | `doco` | — | Uses existing BFF services builder |

Reuse icons/labels consistent with Happy Path where practical. Keep the current
3-column card grid; wrap to multiple rows.

### Validation

- Type must be selected before create (unchanged).
- COD: `codAmount` required (numeric).
- DEPS: OOH point required before enable Create.
- Multicolli: parcel count clamped to 2–10; when Multicolli selected, distinct-stops
  multi-parcel rules stay consistent (parcel count comes from multicolli settings).
- Distinct stops + unload toggles remain available for all types where they already
  make sense; DEPS continues to use parcel-shop/OOH path as today for address UI.

### Create payload mapping

Mirror `apps/web/src/lib/happy-path/execute-generation-job.ts` for shipment route:

- COD → `codAmount`, `codCurrency`, `iban`, `bicSwift`
- EXW → `billingOption`, `payerType: 1`
- DEPS → `counterLocationConsigneeId` from OOH selection
- Multicolli → `parcelCount`, optional `integrationCode1`
- Delivery & Pick → create shipment, then linked `createPickup` (`pickupType: "remote"`)
  using consignee party → BFF customer (same helper pattern as Happy Path)

No new API routes required; `POST /shipments/create` and `POST /pickups/create`
already accept these fields.

## Create Pickup — types

| Card label | `pickupType` |
| --- | --- |
| Remote Pickup | `remote` |
| Pickup At Customer | `customer` |

Replace the Select with a 2-column card grid (same visual language as shipment
type cards). Keep `shipmentCount`. Add optional fields with Happy Path defaults:

- `pickUpDateOffsetDays`
- `pickupEndTime`
- `parcelWeight`

Pass through existing `createPickup` service params. Customer search remains
optional/required per current dialog rules.

## UI / components

- Prefer extending `create-shipment-dialog.tsx` and `create-pickup-dialog.tsx`
  rather than extracting a shared picker in v1 (YAGNI). If the type card markup
  is duplicated once, a small local helper in each file is fine; extract only if
  a third consumer appears.
- Reuse `OohPointPicker` from Happy Path settings for DEPS.
- Reuse country COD defaults from `shipment-group-settings.ts`
  (`getDefaultCodSettings`, `getDefaultExwBillingOption`).

## Error handling

- Per-shipment create/unload logging stays as today.
- Delivery & Pick: if shipment succeeds but linked pickup fails, surface the same
  style of error as Happy Path (`Delivery created but linked pickup failed: …`)
  and still list the created shipment id in progress logs.
- API validation errors (e.g. missing COD amount) continue to surface via existing
  `throwDataCenterApiError` → log line.

## Testing

Manual smoke (connected Nesy stage):

1. Create Shipment: each new type once with minimal valid fields.
2. COD with amount; DEPS with OOH; EXW with both billing options; Multicolli 3 parcels.
3. Delivery & Pick → shipment row + pickup row appear.
4. Create Pickup: Remote and PAC via cards; optional settings forwarded.
5. Regression: Standard / RDOC / unload / distinct stops still work.

## Out of scope follow-ups

- Shared `executeCreateShipment` module used by both Happy Path and dialogs
- Red Label / DDEF on create forms
- Visual redesign beyond card expansion
