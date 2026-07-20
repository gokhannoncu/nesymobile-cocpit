# Create Forms Happy Path Types Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Create Shipment and Create Pickup dialogs so operators can create every creatable Happy Path shipment/pickup type without running a Happy Path set.

**Architecture:** Keep create dialogs calling existing BFF services (`createSingleShipment`, `createPickup`). Add a small pure type-config module for shipment create types (BFF mapping + which extra fields show). Expand Create Shipment card grid and type-specific fields; restyle Create Pickup Remote/PAC as cards and pass Happy Path pickup settings. No new API routes.

**Tech Stack:** Next.js client components, existing `@/services/shipment` + `@/services/pickup`, Happy Path helpers (`getDefaultCodSettings`, `getDefaultExwBillingOption`, `getDefaultPickupSettings`, `OohPointPicker`, `bffCustomerFromConsigneeParty`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-20-create-forms-happy-path-types-design.md`
- Do not add `red-label` or DDEF types
- Do not refactor Happy Path `execute-generation-job` into a shared executor (YAGNI)
- Reuse existing BFF fields only — no new `/shipments` or `/pickups` endpoints
- Do not commit unless the user explicitly asks
- After code changes: run `graphify update .`

## File map

| File | Responsibility |
| --- | --- |
| `apps/web/src/lib/data-center/create-shipment-types.ts` | Pure type ids, labels, BFF mapping, which extras each type needs |
| `apps/web/src/lib/data-center/create-shipment-types.test.ts` | Unit tests for mapping / extras |
| `apps/web/src/components/data-center/shipment/create-shipment-dialog.tsx` | UI cards + extra fields + create payload |
| `apps/web/src/components/data-center/pickup/create-pickup-dialog.tsx` | Card UI for Remote/PAC + optional pickup settings |

---

### Task 1: Pure create-shipment type config + unit tests

**Files:**
- Create: `apps/web/src/lib/data-center/create-shipment-types.ts`
- Create: `apps/web/src/lib/data-center/create-shipment-types.test.ts`

**Interfaces:**
- Produces:
  - `export type CreateShipmentTypeId = "standard" | "cod" | "exw" | "deps" | "multicolli" | "rdoc" | "delivery-pick" | "doco"`
  - `export type CreateShipmentExtra = "cod" | "exw" | "deps" | "multicolli"`
  - `export interface CreateShipmentTypeDef { id: CreateShipmentTypeId; title: string; bffShipmentType: string; extras: CreateShipmentExtra[] }`
  - `export const CREATE_SHIPMENT_TYPES: readonly CreateShipmentTypeDef[]`
  - `export function mapCreateShipmentTypeToBff(id: CreateShipmentTypeId): string`
  - `export function getCreateShipmentExtras(id: CreateShipmentTypeId): CreateShipmentExtra[]`

- [x] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  CREATE_SHIPMENT_TYPES,
  getCreateShipmentExtras,
  mapCreateShipmentTypeToBff,
} from "./create-shipment-types";

describe("create-shipment-types", () => {
  it("lists all creatable Happy Path shipment types in UI order", () => {
    expect(CREATE_SHIPMENT_TYPES.map((t) => t.id)).toEqual([
      "standard",
      "cod",
      "exw",
      "deps",
      "multicolli",
      "rdoc",
      "delivery-pick",
      "doco",
    ]);
  });

  it("maps UI ids to BFF shipmentType values", () => {
    expect(mapCreateShipmentTypeToBff("standard")).toBe("standard");
    expect(mapCreateShipmentTypeToBff("cod")).toBe("cod");
    expect(mapCreateShipmentTypeToBff("exw")).toBe("exw");
    expect(mapCreateShipmentTypeToBff("deps")).toBe("deps");
    expect(mapCreateShipmentTypeToBff("multicolli")).toBe("multicolli");
    expect(mapCreateShipmentTypeToBff("rdoc")).toBe("return-document");
    expect(mapCreateShipmentTypeToBff("delivery-pick")).toBe("delivery-pick");
    expect(mapCreateShipmentTypeToBff("doco")).toBe("doco");
  });

  it("declares extras per type", () => {
    expect(getCreateShipmentExtras("standard")).toEqual([]);
    expect(getCreateShipmentExtras("cod")).toEqual(["cod"]);
    expect(getCreateShipmentExtras("exw")).toEqual(["exw"]);
    expect(getCreateShipmentExtras("deps")).toEqual(["deps"]);
    expect(getCreateShipmentExtras("multicolli")).toEqual(["multicolli"]);
    expect(getCreateShipmentExtras("rdoc")).toEqual([]);
    expect(getCreateShipmentExtras("delivery-pick")).toEqual([]);
    expect(getCreateShipmentExtras("doco")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (module missing)**

```bash
pnpm --filter @nesy/web exec vitest run src/lib/data-center/create-shipment-types.test.ts
```

Expected: FAIL (cannot find module / file)

- [ ] **Step 3: Implement module**

```ts
export type CreateShipmentTypeId =
  | "standard"
  | "cod"
  | "exw"
  | "deps"
  | "multicolli"
  | "rdoc"
  | "delivery-pick"
  | "doco";

export type CreateShipmentExtra = "cod" | "exw" | "deps" | "multicolli";

export interface CreateShipmentTypeDef {
  id: CreateShipmentTypeId;
  title: string;
  bffShipmentType: string;
  extras: CreateShipmentExtra[];
}

export const CREATE_SHIPMENT_TYPES: readonly CreateShipmentTypeDef[] = [
  { id: "standard", title: "Standard", bffShipmentType: "standard", extras: [] },
  { id: "cod", title: "COD", bffShipmentType: "cod", extras: ["cod"] },
  { id: "exw", title: "EXW", bffShipmentType: "exw", extras: ["exw"] },
  { id: "deps", title: "DEPS", bffShipmentType: "deps", extras: ["deps"] },
  { id: "multicolli", title: "Multicolli", bffShipmentType: "multicolli", extras: ["multicolli"] },
  { id: "rdoc", title: "RDOC", bffShipmentType: "return-document", extras: [] },
  { id: "delivery-pick", title: "Delivery & Pick", bffShipmentType: "delivery-pick", extras: [] },
  { id: "doco", title: "DOCO", bffShipmentType: "doco", extras: [] },
] as const;

const byId = Object.fromEntries(
  CREATE_SHIPMENT_TYPES.map((t) => [t.id, t]),
) as Record<CreateShipmentTypeId, CreateShipmentTypeDef>;

export function mapCreateShipmentTypeToBff(id: CreateShipmentTypeId): string {
  return byId[id].bffShipmentType;
}

export function getCreateShipmentExtras(id: CreateShipmentTypeId): CreateShipmentExtra[] {
  return byId[id].extras;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm --filter @nesy/web exec vitest run src/lib/data-center/create-shipment-types.test.ts
```

Expected: PASS (3 tests)

---

### Task 2: Create Shipment dialog — type cards + type-specific fields

**Files:**
- Modify: `apps/web/src/components/data-center/shipment/create-shipment-dialog.tsx`

**Interfaces:**
- Consumes: `CREATE_SHIPMENT_TYPES`, `CreateShipmentTypeId`, `mapCreateShipmentTypeToBff`, `getCreateShipmentExtras` from Task 1
- Consumes: `getDefaultCodSettings`, `getDefaultExwBillingOption`, `type OohPointSelection`, `type ExwBillingOption`, `type NesyCountryCode` from `@/lib/happy-path/shipment-group-settings`
- Consumes: `OohPointPicker` from `@/components/data-center/happy-path/settings/ooh-point-picker`
- Produces: UI that can select all 8 types and collect COD / EXW / DEPS / Multicolli field values

- [ ] **Step 1: Replace local `ShipmentType` / `shipmentTypes` / `mapShipmentType`**

Remove:

```ts
type ShipmentType = "standard" | "cod" | "rdoc";
function mapShipmentType(...) { ... }
const shipmentTypes = [ ... ];
```

Import Task 1 helpers. Change state:

```ts
const [selectedType, setSelectedType] = useState<CreateShipmentTypeId | null>(null);
```

Drive the card grid from `CREATE_SHIPMENT_TYPES` (keep existing card button markup). Map icons locally:

```ts
const TYPE_ICONS: Record<CreateShipmentTypeId, LucideIcon> = {
  standard: Package,
  cod: DollarSign,
  exw: Building2, // or CircleDollarSign / FileText — pick one existing lucide import
  deps: Building2,
  multicolli: Package,
  rdoc: RefreshCcw,
  "delivery-pick": RefreshCcw,
  doco: CircleCheck,
};
```

Use `grid-cols-3` (or `sm:grid-cols-4`) so 8 cards wrap cleanly.

- [ ] **Step 2: Add state for extras + country-aware defaults**

```ts
const countryCode = (country as NesyCountryCode) || "HR";
const defaultCod = getDefaultCodSettings(countryCode);

const [codAmount, setCodAmount] = useState(String(defaultCod.codAmount));
const [codCurrency, setCodCurrency] = useState(defaultCod.codCurrency);
const [iban, setIban] = useState(defaultCod.iban);
const [bicSwift, setBicSwift] = useState(defaultCod.bicSwift);
const [exwBillingOption, setExwBillingOption] = useState<ExwBillingOption>(
  getDefaultExwBillingOption(countryCode),
);
const [depsOoh, setDepsOoh] = useState<OohPointSelection | undefined>(undefined);
const [multicolliParcelCount, setMulticolliParcelCount] = useState(3);
const [multicolliIntegrationCode, setMulticolliIntegrationCode] = useState("CREATE-MC-001");
```

On `resetForm`, reset these to defaults for current country. When `country` changes while dialog open and type is COD/EXW, refresh defaults only if user has not edited (simplest acceptable approach: refresh on country change always when dialog opens via existing reset).

- [ ] **Step 3: Render type-specific fields under the type cards**

Show blocks when `selectedType` has the matching extra:

- **COD:** Amount, Currency select (`EUR`/`RSD`), IBAN, BIC/SWIFT (optional)
- **EXW:** Billing option select — `"EXWORKS on invoice"` | `"EXWORKS in cash"`
- **DEPS:** `<OohPointPicker label="Parcel shop / OOH" oohKind="parcelshop" value={depsOoh} onChange={setDepsOoh} />`
- **Multicolli:** Parcel count input (min 2 max 10), integration code input

When Multicolli is selected and not distinct-stops, bind effective parcel count to `multicolliParcelCount` (sync `parcelCount` state on change, or compute `effectiveParcelCount` from multicolli).

- [ ] **Step 4: Gate Create readiness**

Extend `addressesReady` / create button disabled logic:

```ts
const extras = selectedType ? getCreateShipmentExtras(selectedType) : [];
const typeFieldsReady =
  selectedType !== null &&
  (!extras.includes("cod") || Number.parseFloat(codAmount) >= 0) &&
  (!extras.includes("deps") || !!depsOoh?.oohPointId) &&
  (!extras.includes("multicolli") ||
    (multicolliParcelCount >= 2 && multicolliParcelCount <= 10));
```

Require `typeFieldsReady` before create (same place `addressesReady` is checked).

- [ ] **Step 5: Manual UI check (no commit)**

Open Create Shipment dialog connected to stage: confirm 8 cards, COD/EXW/DEPS/Multicolli fields appear on select, Create stays disabled for DEPS without OOH.

---

### Task 3: Create Shipment dialog — wire create payload + Delivery & Pick

**Files:**
- Modify: `apps/web/src/components/data-center/shipment/create-shipment-dialog.tsx`
- Modify imports only if needed: `@/services/pickup` (`createPickup`), `@/lib/nesy-customer-mapper` (`bffCustomerFromConsigneeParty`)

**Interfaces:**
- Consumes: `createSingleShipment` (existing), `createPickup`, `bffCustomerFromConsigneeParty`, `mapCreateShipmentTypeToBff`
- Produces: successful creates for all 8 types including linked pickup for `delivery-pick`

- [ ] **Step 1: Replace create body construction**

Inside `handleCreate`, replace:

```ts
const apiShipmentType = mapShipmentType(selectedType);
// ...
shipmentType: apiShipmentType,
...(apiShipmentType === "cod" ? { codAmount: ... } : {}),
```

With:

```ts
const apiShipmentType = mapCreateShipmentTypeToBff(selectedType);
const extras = getCreateShipmentExtras(selectedType);
const effectiveParcelCount = distinctStops
  ? 1
  : extras.includes("multicolli")
    ? multicolliParcelCount
    : parcelCount;

const createBody: Parameters<typeof createSingleShipment>[0] = {
  token,
  country,
  environment,
  parcelCount: effectiveParcelCount,
  shipmentType: apiShipmentType,
  parties: buildPartiesForIndex(i),
};

if (extras.includes("cod")) {
  createBody.codAmount = Number.parseFloat(codAmount) || 0;
  createBody.codCurrency = codCurrency;
  createBody.iban = iban;
  createBody.bicSwift = bicSwift;
}
if (extras.includes("exw")) {
  createBody.billingOption = exwBillingOption;
  createBody.payerType = 1;
}
if (extras.includes("deps") && depsOoh?.oohPointId) {
  createBody.counterLocationConsigneeId = depsOoh.oohPointId;
}
if (extras.includes("multicolli") && multicolliIntegrationCode.trim()) {
  createBody.integrationCode1 = multicolliIntegrationCode.trim();
}

record = await createSingleShipment(createBody);
```

- [ ] **Step 2: After successful create, handle Delivery & Pick linked pickup**

```ts
if (selectedType === "delivery-pick" && record) {
  try {
    const parties = buildPartiesForIndex(i);
    const linkedCustomer = bffCustomerFromConsigneeParty(parties);
    const pickupRecord = await createPickup({
      token,
      country,
      environment,
      pickupType: "remote",
      shipmentCount: 1,
      customer: linkedCustomer,
    });
    addLog({
      key: `s${shipNum}-linked-pickup`,
      success: true,
      message: `Linked pickup created (${pickupRecord.shipmentId})`,
      time: formatLogTime(),
    });
  } catch (error) {
    addLog({
      key: `s${shipNum}-linked-pickup`,
      success: false,
      message: `Delivery created but linked pickup failed: ${
        error instanceof Error ? error.message : "Unknown"
      }`,
      time: formatLogTime(),
    });
  }
}
```

Place this after the shipment create success log and before unload loop. Do not abort remaining shipments on linked-pickup failure.

- [ ] **Step 3: Update `handleCreate` dependency array** with new state fields (`codCurrency`, `iban`, `bicSwift`, `exwBillingOption`, `depsOoh`, `multicolliParcelCount`, `multicolliIntegrationCode`).

- [ ] **Step 4: Smoke (manual)**

With Nesy connection: create one Standard (regression), one COD, one EXW, one Multicolli (3 parcels). Confirm rows appear on Shipment list with expected type labels.

---

### Task 4: Create Pickup dialog — cards + Happy Path pickup settings

**Files:**
- Modify: `apps/web/src/components/data-center/pickup/create-pickup-dialog.tsx`

**Interfaces:**
- Consumes: `getDefaultPickupSettings` from `@/lib/happy-path/shipment-group-settings`
- Consumes: existing `createPickup`
- Produces: card UI for `remote` | `customer` + optional settings passed to API

- [ ] **Step 1: Replace Select with card grid**

Define:

```ts
const pickupTypes = [
  { value: "remote" as const, title: "Remote Pickup", icon: Package },
  { value: "customer" as const, title: "Pickup At Customer", icon: Building2 },
] as const;
```

Render a 2-column card grid matching Create Shipment card classes (`border-nesy` when selected, check circle). Remove `Select` / `SelectItem` imports if unused.

Default `pickupType` remains `"remote"`.

- [ ] **Step 2: Add optional settings fields**

```ts
const defaults = getDefaultPickupSettings();
const [pickUpDateOffsetDays, setPickUpDateOffsetDays] = useState(defaults.pickUpDateOffsetDays);
const [pickupEndTime, setPickupEndTime] = useState(defaults.pickupEndTime);
const [parcelWeight, setParcelWeight] = useState(defaults.parcelWeight);
```

UI labels:

- Pickup date offset (days) — number input min 0
- Pickup end time — text/time input (`21:00`)
- Parcel weight — number input min 0.1

Reset in `resetForm`.

- [ ] **Step 3: Pass settings into `createPickup`**

```ts
const record = await createPickup({
  token,
  country,
  environment,
  pickupType,
  shipmentCount,
  pickUpDateOffsetDays,
  pickupEndTime,
  parcelWeight,
  ...(bffCustomer ? { customer: bffCustomer } : {}),
});
```

- [ ] **Step 4: Manual UI check**

Open Create Pickup: two cards, settings visible, create Remote + PAC once each.

---

### Task 5: Verification + graphify

**Files:**
- None (verification only); touch dialogs only if smoke finds bugs

- [ ] **Step 1: Run unit tests**

```bash
pnpm --filter @nesy/web exec vitest run src/lib/data-center/create-shipment-types.test.ts
```

Expected: PASS

- [ ] **Step 2: Typecheck touched packages (if project script exists)**

```bash
pnpm --filter @nesy/web exec tsc --noEmit
```

Expected: no errors in modified files (pre-existing errors elsewhere OK if already known)

- [ ] **Step 3: Manual checklist (spec)**

1. Create Shipment: Standard, COD, EXW, DEPS (with OOH), Multicolli, RDOC, Delivery & Pick, DOCO
2. Delivery & Pick → shipment + pickup rows
3. Create Pickup: Remote + PAC via cards; settings forwarded
4. Regression: unload toggle + distinct stops on Standard

- [ ] **Step 4: Update knowledge graph**

```bash
graphify update .
```

- [ ] **Step 5: Do not commit** unless user asks

---

## Spec coverage checklist

| Spec requirement | Task |
| --- | --- |
| All creatable shipment types on Create Shipment | 1, 2 |
| COD / EXW / DEPS / Multicolli extra fields | 2, 3 |
| Delivery & Pick linked remote pickup | 3 |
| Create Pickup Remote/PAC cards | 4 |
| Pickup optional settings | 4 |
| No red-label / DDEF | (excluded from Task 1 list) |
| No new API routes | (all tasks use existing services) |
| Manual smoke | 3, 4, 5 |
