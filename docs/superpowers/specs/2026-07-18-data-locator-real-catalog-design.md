# Data Locator — Real Metadata Catalog

**Date:** 2026-07-18  
**Status:** Approved  
**App:** NesyMobileCocpit (`/engineering/tools/data-locator`)

## Problem

Data Locator is fully client-side mock: conceptual names (`shipments`, camelCase
fields), keyword “semantic” search over fake intents, and no API. Names do not
match real NESY `BsonCollection` documents or Courier.Mobile Room entities.

## Goals

1. Serve a **real metadata catalog** (no live record lookup) from the API.
2. **Compose** Mongo sources from existing `MONGO_CATALOG` (`keyFields` join).
3. Include **mobile local sources** verified from Courier.Mobile (Room /
   SharedPreferences / memory).
4. Keep **keyword/intent** search (no Claude/LLM in this iteration).
5. Wire filters and Mongo Query Generator deep-links.

## Non-goals

- Live Mongo / NESY HTTP shipment lookup
- Claude / LLM semantic search
- Graylog, D4Me provider, external Fiscal SQL as catalog rows
- Postgres persistence
- Device/ADB reads

## Decisions

| Topic | Choice |
| --- | --- |
| Catalog meaning | A — real metadata, not live records |
| Scope | B — Mongo core + mobile local |
| Search | A — keyword intents |
| Delivery | A — API catalog (composition over `mongo-catalog`) |
| Architecture | 1 — Composition |

## Architecture

```
UI → GET /api/data-locator/catalog
       → data-locator-catalog.ts
            ├─ Mongo: ref(database, collection) ⋈ MONGO_CATALOG.keyFields
            ├─ Mobile: Room / SharedPreferences / memory
            └─ intents + lineage + recipes + guardrails

UI → GET /api/data-locator/search?q=
       → resolveIntent(q)

Detail (mongo) → /engineering/tools/mongodb-query-generator?database=&collection=
```

## Source scope

### Mongo

All entries in `MONGO_CATALOG` are exposed as Data Locator sources with locator
metadata (truth, purpose, domains, …). Primary mappings from old mock names:

| Old mock | Real |
| --- | --- |
| shipments | `NESY_ShipmentDB.Shipment` |
| schedules | `NESY_TaskDB.Schedule` |
| fiscal-invoice-data | `NESY_ShipmentDB.FiscalInvoiceDocument` |
| live-location | `NESY_TrackingDB.CourierLastLocation` |
| delivery-events | `NESY_TrackingDB.ShipmentEventLog` (+ history DB logs as supporting) |

### Mobile (Courier.Mobile)

| id | Real artifact |
| --- | --- |
| `mobile:schedule-stop-chunk` | Room `@Entity ScheduleStopChunk` |
| `mobile:request` | Room `@Entity Request` (RequestSender queue) |
| `mobile:notification-info` | Room `@Entity NotificationInfo` |
| `mobile:force-loaded-barcodes` | SharedPreferences key `forceLoadBarcodeList` |
| `mobile:paid-shipments` | `SharedViewModel` in-memory `paidShipments` |

## API

Mounted at `/api/data-locator`:

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/catalog` | sources + intents + lineage + recipes + guardrails + filter options |
| `GET` | `/search?q=` | keyword resolveIntent |
| `GET` | `/sources/:id` | single source |

No NESY login required (static metadata only).

## UI

- Fetch catalog on mount; loading/error + retry
- Search via `/search`; chips from intent `chipLabel`
- Filter rail filters result cards client-side
- Remove Graylog/D4Me/Fiscal-SQL mock rows; hide dead “Data Mapping” CTA
- Mongo detail CTA deep-links with query params

## Testing

- Unit: mongo join, resolveIntent, id format
- Manual: catalog loads; shipment intent → `Shipment`; deep-link opens generator

## Implementation order

1. Spec (this file)
2. `data-locator-catalog.ts` + unit tests
3. Router + `app.ts` mount
4. Web service + page/catalog/detail wire-up
5. Generator query-param support
6. Smoke on localhost
