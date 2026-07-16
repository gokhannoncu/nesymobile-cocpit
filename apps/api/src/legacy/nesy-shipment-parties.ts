/**
 * Shipper / Consignee party selection for ClientSaveShipment.
 * Mirrors NESY Dashboard ShipmentStateService.buildShipper/buildConsignee/buildCustomer.
 */

export type AddressMode = "existing" | "addressbook" | "newaddress" | "parcelshop";

export interface NesyAddress {
  addressId?: number | string;
  addressType?: number;
  name?: string;
  street?: string;
  city?: string;
  zipCode?: string;
  countryCode?: string;
  houseNumber?: string | null;
  doorNumber?: string | null;
  addressText?: string;
  phone?: string;
  counterLocationId?: number | string;
  latitude?: number;
  longitude?: number;
}

export interface PartyContact {
  name: string;
  phone: string;
  gsm: string;
  email?: string | null;
  contactPerson?: string;
  remark?: string;
  customerId?: number;
  customerCenter?: string;
}

export interface ParcelShopSelection {
  oohId: number | string;
  oohType?: string | number;
  name: string;
  phone?: string;
  email?: string;
  address: NesyAddress;
}

export interface ShipmentPartySelection {
  mode: AddressMode;
  address: NesyAddress;
  contact: PartyContact;
  addressBookIndex?: number;
  saveAddress?: boolean;
  saveAddressBook?: boolean;
  isInternational?: boolean;
  parcelShop?: ParcelShopSelection;
}

export interface BffCreateShipmentParties {
  customer: {
    customerId: number;
    customerCenter: string;
    name: string;
    phone: string;
    gsm: string;
    email?: string | null;
    customerPreferences?: Record<string, unknown>;
    customerAlphanumericId?: string | null;
    /** Payer standard address for customer* fields */
    payerAddress: NesyAddress;
  };
  shipper: ShipmentPartySelection;
  consignee: ShipmentPartySelection;
}

function formatCustomerName(raw: string): { withUnderscore: string; noUnderscore: string } {
  const trimmed = raw.trim();
  const withUnderscore = trimmed.startsWith("_") ? trimmed : `_${trimmed}`;
  const noUnderscore = trimmed.replace(/^_/, "");
  return { withUnderscore, noUnderscore };
}

function str(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  return String(v).trim();
}

function resolveAddress(selection: ShipmentPartySelection): NesyAddress {
  if (selection.mode === "parcelshop" && selection.parcelShop) {
    const ps = selection.parcelShop;
    const addr = ps.address;
    return {
      addressType: mapOohToAddressType(ps.oohType),
      name: ps.name || addr.name,
      street: addr.street,
      city: addr.city,
      zipCode: addr.zipCode,
      countryCode: addr.countryCode,
      houseNumber: addr.houseNumber,
      doorNumber: addr.doorNumber,
      addressText: addr.addressText,
      phone: ps.phone || addr.phone,
      counterLocationId: ps.oohId,
      latitude: addr.latitude,
      longitude: addr.longitude,
    };
  }
  return selection.address;
}

/** CounterLocationType: Locker=2, ParcelShop=10 */
function mapOohToAddressType(oohType?: string | number): number {
  const t = String(oohType ?? "").toLowerCase();
  if (t.includes("locker")) return 2;
  if (t.includes("parcel") || t.includes("shop") || t.includes("pudo")) return 10;
  return 0;
}

function buildAddressText(addr: NesyAddress): string {
  const existing = str(addr.addressText);
  if (existing) return existing;
  const parts = [
    str(addr.street),
    str(addr.zipCode),
    str(addr.city),
    str(addr.countryCode, "HR"),
  ].filter(Boolean);
  return parts.join(" ,");
}

function contactPhone(contact: PartyContact, addr: NesyAddress): string {
  const p = str(contact.phone);
  if (p) return p;
  return str(addr.phone, "4607-000");
}

function contactGsm(contact: PartyContact, phone: string): string {
  const g = str(contact.gsm);
  if (g) return g;
  return phone;
}

interface PartyFlatFields {
  customer: string;
  customerId: number;
  customerCenter: string;
  name: string;
  phone: string;
  gsm: string;
  email: string | null;
  addressType: number;
  addressTitle: string;
  addressText: string;
  addressCountry: string;
  addressStreet: string;
  addressCity: string;
  addressZipCode: string;
  houseNumber: string | null;
  doorNumber: string | null;
  saveAddress: boolean;
  saveAddressBook: boolean;
  saveAddressBookIndex: number;
  counterLocationId: number;
  addressBookCity?: string;
  addressBookStreet?: string;
  addressBookHouseNumber?: string | null;
  contactPerson?: string;
  remark?: string;
}

function buildPartyFlat(
  selection: ShipmentPartySelection,
  defaults: { customerId: number; customerCenter: string },
): PartyFlatFields {
  const addr = resolveAddress(selection);
  const contact = selection.contact;
  const phone = contactPhone(contact, addr);
  const gsm = contactGsm(contact, phone);
  const name = str(contact.name) || str(addr.name);

  const saveBook = selection.saveAddressBook === true;
  const bookIndex =
    saveBook && typeof selection.addressBookIndex === "number"
      ? selection.addressBookIndex
      : -1;

  return {
    customer: name,
    customerId: contact.customerId ?? defaults.customerId,
    customerCenter: str(contact.customerCenter, defaults.customerCenter),
    name,
    phone,
    gsm,
    email: contact.email ?? null,
    addressType: addr.addressType ?? 0,
    addressTitle: str(addr.name, name),
    addressText: buildAddressText(addr),
    addressCountry: str(addr.countryCode, "HR").slice(0, 2).toUpperCase(),
    addressStreet: str(addr.street),
    addressCity: str(addr.city),
    addressZipCode: str(addr.zipCode).toUpperCase(),
    houseNumber: addr.houseNumber != null ? str(addr.houseNumber) : null,
    doorNumber: addr.doorNumber != null ? str(addr.doorNumber) : null,
    saveAddress: selection.saveAddress === true,
    saveAddressBook: saveBook,
    saveAddressBookIndex: bookIndex,
    counterLocationId: Number(addr.counterLocationId) || 0,
    ...(saveBook
      ? {
          addressBookCity: str(addr.city),
          addressBookStreet: str(addr.street),
          addressBookHouseNumber: addr.houseNumber,
        }
      : {}),
    contactPerson: contact.contactPerson,
    remark: contact.remark,
  };
}

export function buildShipmentPayloadFromParties(
  parties: BffCreateShipmentParties,
  parcels: unknown[],
  parcelCount: number,
  services: unknown[],
  billing: { billingOption: string; payerType: number },
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  const { withUnderscore, noUnderscore } = formatCustomerName(parties.customer.name);
  const payerAddr = parties.customer.payerAddress;
  const payerAddressText = buildAddressText(payerAddr);
  const preferences =
    parties.customer.customerPreferences &&
    Object.keys(parties.customer.customerPreferences).length > 0
      ? parties.customer.customerPreferences
      : undefined;

  const defaults = {
    customerId: parties.customer.customerId,
    customerCenter: parties.customer.customerCenter,
  };

  const shipper = buildPartyFlat(parties.shipper, defaults);
  const consignee = buildPartyFlat(parties.consignee, defaults);
  const consigneeAddr = resolveAddress(parties.consignee);

  const isWorldWide =
    parties.consignee.mode === "newaddress" && parties.consignee.isInternational === true;

  return {
    customerCustomer: withUnderscore,
    customerAddressTitle: withUnderscore,
    customerCustomerId: parties.customer.customerId,
    customerCustomerCenter: parties.customer.customerCenter,
    customerName: withUnderscore,
    customerPhone: parties.customer.phone,
    customerGsm: parties.customer.gsm,
    codReturnBankAccount: "",
    codReturnBankCode: "",
    customerAddressType: payerAddr.addressType ?? 0,
    customerAddressText: payerAddressText,
    customerAddressCountry: str(payerAddr.countryCode, "HR").slice(0, 2).toUpperCase(),
    customerAddressStreet: str(payerAddr.street),
    customerAddressCity: str(payerAddr.city),
    customerAddressZipCode: str(payerAddr.zipCode).toUpperCase(),
    customerHouseNumber: payerAddr.houseNumber != null ? str(payerAddr.houseNumber) : null,
    customerDoorNumber: payerAddr.doorNumber != null ? str(payerAddr.doorNumber) : null,
    customerSaveAddress: false,
    customerSaveAddressBookIndex: -1,
    customerPreferences: preferences,
    customerCustomerAlphanumericId: parties.customer.customerAlphanumericId ?? null,

    shipperCustomer: shipper.name,
    shipperCustomerId: shipper.customerId,
    shipperCustomerCenter: shipper.customerCenter,
    shipperName: shipper.name,
    shipperPhone: shipper.phone,
    shipperGsm: shipper.gsm,
    shipperEmail: shipper.email,
    shipperContactPerson: shipper.contactPerson ?? null,
    shipperRemark: shipper.remark ?? null,
    shipperAddressType: shipper.addressType,
    shipperAddressTitle: shipper.addressTitle,
    shipperAddressText: shipper.addressText,
    shipperAddressCountry: shipper.addressCountry,
    shipperAddressStreet: shipper.addressStreet,
    shipperAddressCity: shipper.addressCity,
    shipperAddressZipCode: shipper.addressZipCode,
    shipperHouseNumber: shipper.houseNumber,
    shipperDoorNumber: shipper.doorNumber,
    shipperSaveAddress: shipper.saveAddress,
    shipperSaveAddressBook: shipper.saveAddressBook,
    shipperSaveAddressBookIndex: shipper.saveAddressBookIndex,
    ...(shipper.saveAddressBook
      ? {
          shipperAddressBookCity: shipper.addressBookCity,
          shipperAddressBookStreet: shipper.addressBookStreet,
          shipperAddressBookHouseNumber: shipper.addressBookHouseNumber,
        }
      : {}),
    counterLocationShipperId: shipper.counterLocationId,
    shipperCustomerAlphanumericId: parties.customer.customerAlphanumericId ?? null,

    isWorldWide,
    consigneeCustomer: consignee.name,
    consigneeName: consignee.name,
    consigneeCustomerId: consignee.customerId,
    consigneeCustomerCenter: consignee.customerCenter,
    consigneePhone: consignee.phone,
    consigneeGsm: consignee.gsm,
    consigneeEmail: consignee.email,
    consigneeContactPerson: consignee.contactPerson ?? null,
    consigneeRemark: consignee.remark ?? null,
    consigneeAddressType: consignee.addressType,
    consigneeAddressTitle: consignee.addressTitle,
    consigneeAddressText: consignee.addressText,
    consigneeAddressCountry: consignee.addressCountry,
    consigneeAddressStreet: consignee.addressStreet,
    consigneeAddressCity: consignee.addressCity,
    consigneeAddressZipCode: consignee.addressZipCode,
    consigneeHouseNumber: consignee.houseNumber,
    consigneeDoorNumber: consignee.doorNumber,
    consigneeSaveAddress: consignee.saveAddress,
    consigneeSaveAddressBook: consignee.saveAddressBook,
    consigneeSaveAddressBookIndex: consignee.saveAddressBookIndex,
    ...(consignee.saveAddressBook
      ? {
          consigneeAddressBookCity: consignee.addressBookCity,
          consigneeAddressBookStreet: consignee.addressBookStreet,
          consigneeAddressBookHouseNumber: consignee.addressBookHouseNumber,
        }
      : {}),
    counterLocationConsigneeId: consignee.counterLocationId,

    ...(consigneeAddr.latitude != null
      ? { consigneeLatitude: String(consigneeAddr.latitude) }
      : {}),
    ...(consigneeAddr.longitude != null
      ? { consigneeLongitude: String(consigneeAddr.longitude) }
      : {}),

    parcels,
    parcelCount,
    integrationCode1: null,
    integrationCode2: null,
    integrationCode3: null,
    internationalCode: "",
    parcelType: "PARCEL",
    channel: "Portal",
    billingOption: billing.billingOption,
    payerType: billing.payerType,
    codCurrency: 0,
    services,
    dimCount: null,
    ...extra,
  };
}
