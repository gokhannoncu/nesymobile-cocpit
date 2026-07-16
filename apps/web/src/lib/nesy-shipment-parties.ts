/** Web mirror of apps/api/src/nesy-shipment-parties.ts types */

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
    payerAddress: NesyAddress;
  };
  shipper: ShipmentPartySelection;
  consignee: ShipmentPartySelection;
}

export const ADDRESS_TYPE_OPTIONS = [
  { value: 0, label: "Standard" },
  { value: 1, label: "Pick Up" },
  { value: 2, label: "Delivery" },
  { value: 3, label: "Return" },
  { value: 4, label: "Invoice" },
  { value: 5, label: "Returning Document" },
] as const;
