export const HAPPY_PATH_GROUP_TYPE_IDS: Record<string, readonly string[]> = {
  delivery: ["standard-delivery", "exw-delivery", "mono-multicolli", "deps"],
  cod: ["cod-delivery"],
  pickup: ["remote-pickup", "pickup-at-customer"],
  return: ["rdoc", "delivery-pick", "red-label", "doco"],
};

/** Legacy DDEF shipments scanned into PAC tasks — same shipper customer, no hub INIT */
export const PAC_DDEF_TYPE_IDS = [
  "ddef-shipment-1",
  "ddef-shipment-2",
  "ddef-shipment-3",
] as const;

export type PacDdefTypeId = (typeof PAC_DDEF_TYPE_IDS)[number];

export const HAPPY_PATH_TYPE_ORDER = [
  "standard-delivery",
  "cod-delivery",
  "exw-delivery",
  "deps",
  "mono-multicolli",
  "remote-pickup",
  "ddef-shipment-1",
  "ddef-shipment-2",
  "ddef-shipment-3",
  "pickup-at-customer",
  "rdoc",
  "delivery-pick",
  "red-label",
  "doco",
] as const;

export type HappyPathTypeId = (typeof HAPPY_PATH_TYPE_ORDER)[number];

export const HAPPY_PATH_TYPE_LABELS: Record<HappyPathTypeId, string> = {
  "standard-delivery": "Standard Delivery",
  "cod-delivery": "COD Delivery",
  "exw-delivery": "EXW Delivery",
  deps: "DEPS",
  "mono-multicolli": "Multicolli Delivery",
  "remote-pickup": "Remote Pickup",
  "pickup-at-customer": "Pickup At Customer (PAC)",
  "ddef-shipment-1": "DDEF Shipment 1",
  "ddef-shipment-2": "DDEF Shipment 2",
  "ddef-shipment-3": "DDEF Shipment 3",
  rdoc: "RDOC (Return Document)",
  "delivery-pick": "Delivery & Pick",
  "red-label": "Red Label",
  doco: "DOCO",
};

export type GenerationRoute = "shipment" | "pickup" | "skip";

export interface HappyPathTypeConfig {
  typeId: HappyPathTypeId;
  label: string;
  route: GenerationRoute;
  /** Hub INIT unload after portal create */
  requiresUnloadAfterCreate: boolean;
  /** BFF shipmentType param */
  bffShipmentType?: string;
  pickupType?: "remote" | "customer";
}

export const HAPPY_PATH_TYPE_CONFIG: Record<HappyPathTypeId, HappyPathTypeConfig> = {
  "standard-delivery": {
    typeId: "standard-delivery",
    label: HAPPY_PATH_TYPE_LABELS["standard-delivery"],
    route: "shipment",
    requiresUnloadAfterCreate: true,
    bffShipmentType: "standard",
  },
  "cod-delivery": {
    typeId: "cod-delivery",
    label: HAPPY_PATH_TYPE_LABELS["cod-delivery"],
    route: "shipment",
    requiresUnloadAfterCreate: true,
    bffShipmentType: "cod",
  },
  "exw-delivery": {
    typeId: "exw-delivery",
    label: HAPPY_PATH_TYPE_LABELS["exw-delivery"],
    route: "shipment",
    requiresUnloadAfterCreate: true,
    bffShipmentType: "exw",
  },
  deps: {
    typeId: "deps",
    label: HAPPY_PATH_TYPE_LABELS.deps,
    route: "shipment",
    requiresUnloadAfterCreate: true,
    bffShipmentType: "deps",
  },
  "mono-multicolli": {
    typeId: "mono-multicolli",
    label: HAPPY_PATH_TYPE_LABELS["mono-multicolli"],
    route: "shipment",
    requiresUnloadAfterCreate: true,
    bffShipmentType: "multicolli",
  },
  "remote-pickup": {
    typeId: "remote-pickup",
    label: HAPPY_PATH_TYPE_LABELS["remote-pickup"],
    route: "pickup",
    requiresUnloadAfterCreate: false,
    pickupType: "remote",
  },
  "pickup-at-customer": {
    typeId: "pickup-at-customer",
    label: HAPPY_PATH_TYPE_LABELS["pickup-at-customer"],
    route: "pickup",
    requiresUnloadAfterCreate: false,
    pickupType: "customer",
  },
  "ddef-shipment-1": {
    typeId: "ddef-shipment-1",
    label: HAPPY_PATH_TYPE_LABELS["ddef-shipment-1"],
    route: "shipment",
    requiresUnloadAfterCreate: false,
    bffShipmentType: "standard",
  },
  "ddef-shipment-2": {
    typeId: "ddef-shipment-2",
    label: HAPPY_PATH_TYPE_LABELS["ddef-shipment-2"],
    route: "shipment",
    requiresUnloadAfterCreate: false,
    bffShipmentType: "standard",
  },
  "ddef-shipment-3": {
    typeId: "ddef-shipment-3",
    label: HAPPY_PATH_TYPE_LABELS["ddef-shipment-3"],
    route: "shipment",
    requiresUnloadAfterCreate: false,
    bffShipmentType: "standard",
  },
  rdoc: {
    typeId: "rdoc",
    label: HAPPY_PATH_TYPE_LABELS.rdoc,
    route: "shipment",
    requiresUnloadAfterCreate: true,
    bffShipmentType: "return-document",
  },
  "delivery-pick": {
    typeId: "delivery-pick",
    label: HAPPY_PATH_TYPE_LABELS["delivery-pick"],
    route: "shipment",
    requiresUnloadAfterCreate: true,
    bffShipmentType: "delivery-pick",
  },
  "red-label": {
    typeId: "red-label",
    label: HAPPY_PATH_TYPE_LABELS["red-label"],
    route: "skip",
    requiresUnloadAfterCreate: false,
  },
  doco: {
    typeId: "doco",
    label: HAPPY_PATH_TYPE_LABELS.doco,
    route: "shipment",
    requiresUnloadAfterCreate: true,
    bffShipmentType: "doco",
  },
};

export function getGroupIdForType(typeId: string): string | null {
  for (const [groupId, typeIds] of Object.entries(HAPPY_PATH_GROUP_TYPE_IDS)) {
    if (typeIds.includes(typeId)) return groupId;
  }
  return null;
}

export function isHappyPathTypeId(id: string): id is HappyPathTypeId {
  return id in HAPPY_PATH_TYPE_CONFIG;
}

export function isPacDdefTypeId(id: string): id is PacDdefTypeId {
  return (PAC_DDEF_TYPE_IDS as readonly string[]).includes(id);
}

/** Keep PAC DDEF types in sync with pickup-at-customer selection */
export function syncPacDdefTypeIds(typeIds: Set<string>): Set<string> {
  const next = new Set(typeIds);
  const hasPac = next.has("pickup-at-customer");
  for (const id of PAC_DDEF_TYPE_IDS) {
    if (hasPac) next.add(id);
    else next.delete(id);
  }
  return next;
}

export function pacDdefTypesInSync(typeIds: Set<string>): boolean {
  const synced = syncPacDdefTypeIds(typeIds);
  if (synced.size !== typeIds.size) return false;
  for (const id of synced) {
    if (!typeIds.has(id)) return false;
  }
  return true;
}

/** Types only available in specific countries (toolbar country code). */
export const TYPE_AVAILABLE_COUNTRIES: Partial<
  Record<HappyPathTypeId, readonly string[]>
> = {
  "exw-delivery": ["RS"],
};

export function isTypeAvailableForCountry(typeId: string, country: string): boolean {
  if (!isHappyPathTypeId(typeId)) return true;
  const allowed = TYPE_AVAILABLE_COUNTRIES[typeId];
  if (!allowed) return true;
  return allowed.includes(country);
}

export function filterTypeIdsForCountry(
  typeIds: readonly string[],
  country: string,
): string[] {
  return typeIds.filter((id) => isTypeAvailableForCountry(id, country));
}
