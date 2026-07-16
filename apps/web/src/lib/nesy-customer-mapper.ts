import type {
  BffCreateShipmentParties,
  NesyAddress,
  ShipmentPartySelection,
} from "@/lib/nesy-shipment-parties";
import type { BffCustomerPayload } from "@/services/customer";

type UnknownRecord = Record<string, unknown>;

function pickAddress(d: UnknownRecord): UnknownRecord {
  const list = d.addresses ?? d.customerAddressList ?? d.addressList;
  if (Array.isArray(list) && list.length > 0) {
    const main = list.find(
      (a) => a && typeof a === "object" && (a as UnknownRecord).addressType === 0
    ) as UnknownRecord | undefined;
    if (main) return main;
    const first = list[0];
    if (first && typeof first === "object") {
      return first as UnknownRecord;
    }
  }
  return d;
}

/** Nesy: bazen { payload: {...} } veya { customer: {...} } gelir; musteri ozunu bul */
function unwrapCustomerRoot(raw: unknown): UnknownRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const top = raw as UnknownRecord;
  if (top.customerId != null || top.CustomerId != null) return top;
  if (top.customer && typeof top.customer === "object") {
    return top.customer as UnknownRecord;
  }
  if (top.payload && typeof top.payload === "object") {
    const p = top.payload as UnknownRecord;
    if (p.customerId != null || p.CustomerId != null) return p;
    if (p.customer && typeof p.customer === "object") return p.customer as UnknownRecord;
  }
  if (top.searchResult && typeof top.searchResult === "object") {
    return top.searchResult as UnknownRecord;
  }
  return top;
}

function parseCustomerId(d: UnknownRecord): number | null {
  for (const c of [d.customerId, d.CustomerId, d.oib]) {
    if (c == null) continue;
    if (typeof c === "number" && Number.isFinite(c) && c > 0) return c;
    const digits = String(c).trim().replace(/[^\d]/g, "");
    const n = digits ? Number(digits) : Number.NaN;
    if (Number.isFinite(n) && n > 0 && n < 1e12) return n;
  }
  const ka = d.keyAccountCustomerId;
  if (typeof ka === "number" && ka > 0) return ka;
  return null;
}

function buildFromSearchRowOnly(row: Record<string, unknown>): BffCustomerPayload {
  const id = parseCustomerId(row);
  if (id == null) {
    throw new Error("Musteri numarasi (customerId) cozumlenemedi");
  }
  const center = String(row.hubId ?? row.customerCenter ?? row.centerNo ?? "1").trim() || "1";
  const name = String(
    row.name ?? row.fullName ?? row.shortName ?? `Customer ${id}`
  ).trim();
  const phone = "4607-000";
  return {
    customerId: id,
    customerCenter: center,
    name: name || `Customer ${id}`,
    phone,
    gsm: phone,
    email: null,
    addressStreet: String(row.street ?? "").trim() || "ZASTAVNICE 38A",
    addressCity: String(row.city ?? "").trim() || "HRVATSKI LESKOVAC",
    addressZipCode: "10251",
    addressCountry: "HR",
    addressTitle: name || `Customer ${id}`,
  };
}

/**
 * GetCustomerDetails yanitindan (veya buna yakin) BFF BffCustomerPayload uretir.
 * `fromSearchRow`: SearchCustomerByAll satiri — detay API farkli sekille donse bile id/adres doldurulur.
 */
export function mapNesyDetailsToBffPayload(
  raw: unknown,
  fromSearchRow?: Record<string, unknown>
): BffCustomerPayload {
  if (!raw || typeof raw !== "object") {
    if (fromSearchRow) {
      return buildFromSearchRowOnly(fromSearchRow);
    }
    throw new Error("Gecersiz musteri verisi");
  }
  const unwrapped = unwrapCustomerRoot(raw) ?? (raw as UnknownRecord);
  // Liste satiri altta, detay cevabi ustte biner (detay ayni alanlari tanimliyorsa gecerli)
  const d: UnknownRecord = { ...(fromSearchRow ?? {}), ...unwrapped };
  const addr = pickAddress(d);

  const customerId = parseCustomerId(d);
  if (customerId == null && fromSearchRow) {
    return buildFromSearchRowOnly(fromSearchRow);
  }
  if (customerId == null) {
    throw new Error("Musteri numarasi (customerId) cozumlenemedi");
  }

  const centerRaw =
    d.customerCenter ??
    d.centerNo ??
    d.CustomerCenter ??
    d.hubId ??
    fromSearchRow?.hubId;
  const customerCenter = String(centerRaw ?? "1").trim() || "1";

  const name = String(
    d.name ?? d.fullName ?? d.shortName ?? d.displayName ?? `Customer ${customerId}`
  ).trim();

  const defaultPhone = "4607-000";
  let phone = String(
    addr.phone ?? addr.tel ?? d.phone ?? d.landlinePhone ?? d.landline ?? d.tel ?? defaultPhone
  ).trim();
  let gsm = String(
    addr.gsm ?? d.gsm ?? d.mobilePhone ?? d.mobile ?? d.phoneGsm ?? phone
  ).trim();
  if (phone.length < 3) phone = defaultPhone;
  if (gsm.length < 3) gsm = phone;

  const fallback = {
    addressStreet: "ZASTAVNICE 38A",
    addressCity: "HRVATSKI LESKOVAC",
    addressZipCode: "10251",
    addressCountry: "HR",
  };

  let addressStreet = String(
    addr.street ?? addr.addressStreet ?? addr.streetName ?? d.customerAddressStreet ?? ""
  ).trim();
  let addressCity = String(
    addr.city ?? addr.addressCity ?? d.customerAddressCity ?? ""
  ).trim();
  let addressZipCode = String(
    addr.zipCode ?? addr.postalCode ?? addr.zip ?? d.customerAddressZipCode ?? ""
  ).trim();
  let addressCountry = String(
    addr.countryCode ?? addr.country ?? d.customerAddressCountry ?? "HR"
  )
    .trim()
    .slice(0, 2)
    .toUpperCase() || "HR";

  if (!addressStreet) addressStreet = fallback.addressStreet;
  if (!addressCity) addressCity = fallback.addressCity;
  if (!addressZipCode) addressZipCode = fallback.addressZipCode;
  if (!addressCountry) addressCountry = fallback.addressCountry;

  const emailRaw = addr.email ?? d.email;
  const addressText = String(addr.addressText ?? "").trim() || undefined;

  return {
    customerId,
    customerCenter,
    name: name || `Customer ${customerId}`,
    phone,
    gsm,
    email: emailRaw != null && String(emailRaw) !== "" ? String(emailRaw) : null,
    addressStreet,
    addressCity,
    addressZipCode,
    addressCountry,
    addressTitle:
      (addr.name as string) ?? (addr.title as string) ?? (addr.addressTitle as string) ?? name,
    addressText,
    customerPreferences:
      d.customerPreferences && typeof d.customerPreferences === "object"
        ? (d.customerPreferences as Record<string, unknown>)
        : undefined,
  };
}

function resolvePartyAddress(selection: ShipmentPartySelection): NesyAddress {
  if (selection.mode === "parcelshop" && selection.parcelShop) {
    return selection.parcelShop.address;
  }
  return selection.address;
}

/** Remote pickup shipper = delivery consignee (Delivery & Pick linkage). */
export function bffCustomerFromConsigneeParty(
  parties: BffCreateShipmentParties,
): BffCustomerPayload {
  const addr = resolvePartyAddress(parties.consignee);
  const contact = parties.consignee.contact;
  const customer = parties.customer;

  return {
    customerId: customer.customerId,
    customerCenter: customer.customerCenter,
    name: contact.name?.trim() || customer.name,
    phone: contact.phone?.trim() || customer.phone,
    gsm: contact.gsm?.trim() || customer.gsm,
    email: contact.email ?? customer.email ?? null,
    addressStreet: addr.street?.trim() || "",
    addressCity: addr.city?.trim() || "",
    addressZipCode: addr.zipCode?.trim() || "",
    addressCountry: (addr.countryCode?.trim() || "HR").slice(0, 2).toUpperCase(),
    addressTitle: addr.name?.trim() || contact.name?.trim() || customer.name,
    addressText: addr.addressText?.trim() || undefined,
    customerPreferences: customer.customerPreferences,
  };
}
