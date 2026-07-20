export type CreateShipmentTypeId =
  | "standard"
  | "cod"
  | "exw"
  | "deps"
  | "d4me"
  | "multicolli"
  | "rdoc"
  | "delivery-pick"
  | "doco"
  | "cpp"
  | "ovsz"
  | "ddef";

export type CreateShipmentExtra = "cod" | "exw" | "deps" | "d4me" | "multicolli";

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
  { id: "d4me", title: "D4ME", bffShipmentType: "d4me", extras: ["d4me"] },
  {
    id: "multicolli",
    title: "Multicolli",
    bffShipmentType: "multicolli",
    extras: ["multicolli"],
  },
  { id: "rdoc", title: "RDOC", bffShipmentType: "return-document", extras: [] },
  {
    id: "delivery-pick",
    title: "Delivery & Pick",
    bffShipmentType: "delivery-pick",
    extras: [],
  },
  { id: "doco", title: "DOCO", bffShipmentType: "doco", extras: [] },
  /** Explicit Collect CPP (Cash Prepayed) — same BFF path as Standard */
  { id: "cpp", title: "CPP", bffShipmentType: "standard", extras: [] },
  /** Oversized — Standard create + hub unload with isOversize */
  { id: "ovsz", title: "OVSZ", bffShipmentType: "standard", extras: [] },
  /** DDEF — Standard without unload (PAC scan source) */
  { id: "ddef", title: "DDEF", bffShipmentType: "standard", extras: [] },
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

/** OVSZ must unload with oversize flag; DDEF must stay unloaded for PAC. */
export function getCreateShipmentUnloadDefaults(id: CreateShipmentTypeId): {
  forceUnload?: boolean;
  forceNoUnload?: boolean;
  isOversize?: boolean;
} {
  if (id === "ovsz") return { forceUnload: true, isOversize: true };
  if (id === "ddef") return { forceNoUnload: true };
  return {};
}
