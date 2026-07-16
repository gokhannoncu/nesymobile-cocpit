import type {
  NesyAddress,
  PartyContact,
  ShipmentPartySelection,
} from "@/lib/nesy-shipment-parties";

type UnknownRecord = Record<string, unknown>;

export interface NormalizedCustomerDetails {
  customerId: number;
  customerCenter: string;
  name: string;
  phone: string;
  gsm: string;
  email: string | null;
  customerPreferences?: Record<string, unknown>;
  customerAlphanumericId: string | null;
  addresses: NesyAddress[];
  addressBook: NesyAddress[];
  payerAddress: NesyAddress;
  baseContact: PartyContact;
}

function str(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  return String(v).trim();
}

function parseCustomerId(d: UnknownRecord): number | null {
  for (const c of [d.customerId, d.CustomerId, d.oib]) {
    if (c == null) continue;
    if (typeof c === "number" && Number.isFinite(c) && c > 0) return c;
    const n = Number(String(c).replace(/[^\d]/g, ""));
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function mapRawAddress(raw: UnknownRecord): NesyAddress {
  return {
    addressId: (raw.addressId ?? raw.AddressId) as number | string | undefined,
    addressType:
      typeof raw.addressType === "number"
        ? raw.addressType
        : typeof raw.AddressType === "number"
          ? raw.AddressType
          : Number(raw.addressType ?? raw.AddressType) || 0,
    name: str(raw.name ?? raw.Name ?? raw.addressTitle ?? raw.AddressTitle),
    street: str(raw.street ?? raw.Street ?? raw.addressStreet ?? raw.AddressStreet),
    city: str(raw.city ?? raw.City ?? raw.addressCity ?? raw.AddressCity),
    zipCode: str(raw.zipCode ?? raw.ZipCode ?? raw.postalCode ?? raw.zip),
    countryCode: str(
      raw.countryCode ?? raw.CountryCode ?? raw.country ?? raw.Country,
      "HR",
    )
      .slice(0, 2)
      .toUpperCase(),
    houseNumber:
      raw.houseNumber != null || raw.HouseNumber != null
        ? str(raw.houseNumber ?? raw.HouseNumber)
        : null,
    doorNumber:
      raw.doorNumber != null || raw.DoorNumber != null
        ? str(raw.doorNumber ?? raw.DoorNumber)
        : null,
    addressText: str(raw.addressText ?? raw.AddressText) || undefined,
    phone: str(raw.phone ?? raw.Phone) || undefined,
    counterLocationId: (raw.counterLocationId ?? raw.CounterLocationId) as
      | number
      | string
      | undefined,
    latitude:
      typeof raw.latitude === "number"
        ? raw.latitude
        : typeof raw.Latitude === "number"
          ? raw.Latitude
          : undefined,
    longitude:
      typeof raw.longitude === "number"
        ? raw.longitude
        : typeof raw.Longitude === "number"
          ? raw.Longitude
          : undefined,
  };
}

function mapAddressBookEntry(raw: UnknownRecord): NesyAddress {
  const addr = mapRawAddress(raw);
  return {
    ...addr,
    name: str(raw.name ?? raw.fullName ?? addr.name),
  };
}

export function mapNesyCustomerDetails(raw: unknown): NormalizedCustomerDetails {
  if (!raw || typeof raw !== "object") {
    throw new Error("Invalid customer details response");
  }
  const d = raw as UnknownRecord;
  const customerId = parseCustomerId(d);
  if (customerId == null) {
    throw new Error("Could not parse customerId from details");
  }

  const customerCenter = str(d.hubId ?? d.customerCenter ?? d.centerNo, "1");
  const name = str(d.name ?? d.fullName ?? d.shortName, `Customer ${customerId}`);
  const defaultPhone = "4607-000";
  const phone = str(d.phone ?? d.landlinePhone, defaultPhone);
  const gsm = str(d.gsm ?? d.mobilePhone ?? d.mobile, phone);

  const rawAddresses =
    d.addresses ?? d.Addresses ?? d.customerAddressList ?? d.addressList;
  const addresses: NesyAddress[] = Array.isArray(rawAddresses)
    ? rawAddresses
        .filter((a) => a && typeof a === "object")
        .map((a) => mapRawAddress(a as UnknownRecord))
    : [];

  const rawBook = d.addressBook ?? d.AddressBooks ?? d.addressBooks;
  const addressBook: NesyAddress[] = Array.isArray(rawBook)
    ? rawBook
        .filter((a) => a && typeof a === "object")
        .map((a) => mapAddressBookEntry(a as UnknownRecord))
    : [];

  const standard =
    addresses.find((a) => a.addressType === 0) ?? addresses[0] ?? {
      addressType: 0,
      name,
      street: "ZASTAVNICE 38A",
      city: "HRVATSKI LESKOVAC",
      zipCode: "10251",
      countryCode: "HR",
    };

  const payerAddress: NesyAddress = { ...standard, name: standard.name || name };

  const baseContact: PartyContact = {
    name,
    phone,
    gsm,
    email: d.email != null && str(d.email) ? str(d.email) : null,
    customerId,
    customerCenter,
    contactPerson: str(d.contactPerson) || undefined,
  };

  return {
    customerId,
    customerCenter,
    name,
    phone,
    gsm,
    email: baseContact.email ?? null,
    customerPreferences:
      d.customerPreferences && typeof d.customerPreferences === "object"
        ? (d.customerPreferences as Record<string, unknown>)
        : undefined,
    customerAlphanumericId:
      d.customerAlphanumericId != null ? str(d.customerAlphanumericId) : null,
    addresses,
    addressBook,
    payerAddress,
    baseContact,
  };
}

export function buildDefaultPartySelection(
  details: NormalizedCustomerDetails,
  address: NesyAddress,
  mode: ShipmentPartySelection["mode"] = "existing",
): ShipmentPartySelection {
  return {
    mode,
    address: { ...address },
    contact: { ...details.baseContact, name: details.name },
  };
}

export function findFirstStandardAddress(
  details: NormalizedCustomerDetails,
): NesyAddress | undefined {
  return details.addresses.find((a) => (a.addressType ?? 0) === 0);
}

function formatAddressLineForMatch(addr: NesyAddress): string {
  const text = addr.addressText?.trim();
  if (text) return text;
  return [addr.street, addr.zipCode, addr.city, addr.countryCode]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(", ");
}

/** Match assignment dialog subtitle to a customer address (Delivery & Pick consignee). */
export function findAddressForAssignmentLine(
  details: NormalizedCustomerDetails,
  addressLine?: string,
): NesyAddress | undefined {
  const candidates = collectSelectableAddresses(details);
  const normalized = addressLine?.trim().toLowerCase();
  if (normalized) {
    const match = candidates.find((addr) => {
      const line = formatAddressLineForMatch(addr).toLowerCase();
      return line === normalized || line.includes(normalized) || normalized.includes(line);
    });
    if (match) return match;
  }
  return findFirstStandardAddress(details) ?? candidates[0];
}

/** All pickable addresses: customer addresses plus address book (deduped). */
export function collectSelectableAddresses(
  details: NormalizedCustomerDetails,
): NesyAddress[] {
  const seen = new Set<string>();
  const result: NesyAddress[] = [];

  for (const addr of [...details.addresses, ...details.addressBook]) {
    const key =
      addr.addressId != null
        ? String(addr.addressId)
        : `${addr.name}|${addr.street}|${addr.city}|${addr.zipCode}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(addr);
  }

  return result;
}

/** Initial existing-customer tab with Standard address type selected. */
export function buildInitialPartySelection(
  details: NormalizedCustomerDetails,
  options?: { selectFirstStandardAddress?: boolean },
): ShipmentPartySelection {
  const firstStandard =
    options?.selectFirstStandardAddress === true
      ? findFirstStandardAddress(details)
      : undefined;

  if (firstStandard) {
    return buildDefaultPartySelection(details, firstStandard, "existing");
  }

  return {
    mode: "existing",
    address: {
      addressType: 0,
      street: "",
      city: "",
      zipCode: "",
      countryCode: "HR",
    },
    contact: { ...details.baseContact, name: details.name },
  };
}

/** @deprecated Use buildInitialPartySelection */
export function buildEmptyPartySelection(
  details: NormalizedCustomerDetails,
): ShipmentPartySelection {
  return buildInitialPartySelection(details);
}

export function buildPartiesFromDetails(
  details: NormalizedCustomerDetails,
  shipper: ShipmentPartySelection,
  consignee: ShipmentPartySelection,
) {
  return {
    customer: {
      customerId: details.customerId,
      customerCenter: details.customerCenter,
      name: details.name,
      phone: details.phone,
      gsm: details.gsm,
      email: details.email,
      customerPreferences: details.customerPreferences,
      customerAlphanumericId: details.customerAlphanumericId,
      payerAddress: details.payerAddress,
    },
    shipper,
    consignee,
  };
}

/**
 * Light check used for progressive disclosure (showing the next form section).
 * Only requires a mode + contact name; does NOT enforce phone/email.
 */
export function isPartySectionFilled(selection: ShipmentPartySelection | null): boolean {
  if (!selection) return false;
  if (selection.mode === "parcelshop") {
    return !!selection.parcelShop?.oohId;
  }
  return !!str(selection.contact.name);
}

/** Strict check used to enable the Create Shipment button. */
export function isPartySelectionValid(selection: ShipmentPartySelection | null): boolean {
  if (!selection) return false;
  const addr = selection.address;
  const contact = selection.contact;

  if (selection.mode === "parcelshop") {
    return !!selection.parcelShop?.oohId;
  }

  if (!str(contact.name) || !str(addr.city) || !str(addr.street)) {
    return false;
  }

  if (selection.mode === "addressbook" || selection.mode === "newaddress") {
    const phone = str(contact.phone);
    const email = str(contact.email ?? "");
    if (phone.length < 3) return false;
    if (email.length < 3 || !email.includes("@")) return false;
  }

  return true;
}
