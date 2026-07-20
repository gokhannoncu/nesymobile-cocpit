// @ts-nocheck
import {
  buildPartiesFromDetails,
  type NormalizedCustomerDetails,
} from "@/lib/nesy-customer-details";
import type { ShipmentPartySelection } from "@/lib/nesy-shipment-parties";

type StopLocation = {
  city: string;
  zipCode: string;
  street: string;
  houseNumber: number;
  latitude: number;
  longitude: number;
};

/** Croatian locations with distinct coordinates for stop separation on load. */
const STOP_LOCATION_POOL_HR: readonly StopLocation[] = [
  { city: "ZAGREB", zipCode: "10000", street: "ILICA", houseNumber: 10, latitude: 45.8131, longitude: 15.9773 },
  { city: "ZAGREB", zipCode: "10010", street: "VUKOVARSKA", houseNumber: 20, latitude: 45.7939, longitude: 15.9766 },
  { city: "ZAGREB", zipCode: "10020", street: "SAVSKA", houseNumber: 30, latitude: 45.8025, longitude: 15.9711 },
  { city: "ZAGREB", zipCode: "10040", street: "DUBRAVSKA", houseNumber: 40, latitude: 45.8336, longitude: 16.0139 },
  { city: "ZAGREB", zipCode: "10090", street: "MAKSIMIRSKA", houseNumber: 50, latitude: 45.8269, longitude: 16.0161 },
  { city: "SAMOBOR", zipCode: "10430", street: "STAROGRADSKA", houseNumber: 12, latitude: 45.8031, longitude: 15.7178 },
  { city: "VELIKA GORICA", zipCode: "10410", street: "ZAGREBACKA", houseNumber: 22, latitude: 45.7125, longitude: 16.0756 },
  { city: "ZAPRESIC", zipCode: "10290", street: "LJUBLJANSKA", houseNumber: 32, latitude: 45.8564, longitude: 15.8078 },
  { city: "KARLOVAC", zipCode: "47000", street: "STAROGRADSKA", houseNumber: 42, latitude: 45.4929, longitude: 15.5553 },
  { city: "RIJEKA", zipCode: "51000", street: "KORZO", houseNumber: 52, latitude: 45.3271, longitude: 14.4422 },
  { city: "SPLIT", zipCode: "21000", street: "MARJANSKA", houseNumber: 62, latitude: 43.5081, longitude: 16.4402 },
  { city: "OSIJEK", zipCode: "31000", street: "EUROPSKA", houseNumber: 72, latitude: 45.555, longitude: 18.6955 },
  { city: "ZADAR", zipCode: "23000", street: "KALELARGA", houseNumber: 82, latitude: 44.1194, longitude: 15.2314 },
  { city: "SISAK", zipCode: "44000", street: "STAROGRADSKA", houseNumber: 92, latitude: 45.4669, longitude: 16.3783 },
  { city: "VARAZDIN", zipCode: "42000", street: "IVANA KUKULJEVICA", houseNumber: 102, latitude: 46.3057, longitude: 16.3366 },
  { city: "DUBROVNIK", zipCode: "20000", street: "STRADUN", houseNumber: 112, latitude: 42.6403, longitude: 18.1083 },
  { city: "PULA", zipCode: "52100", street: "SERPILISSE", houseNumber: 122, latitude: 44.8666, longitude: 13.8496 },
  { city: "SIBENIK", zipCode: "22000", street: "OBALA", houseNumber: 132, latitude: 43.7357, longitude: 15.8952 },
  { city: "CAKOVEC", zipCode: "40000", street: "TRG REPUBLIKE", houseNumber: 142, latitude: 46.3844, longitude: 16.4339 },
  { city: "BJELOVAR", zipCode: "43000", street: "EUROPSKA", houseNumber: 152, latitude: 45.8986, longitude: 16.8489 },
];

/** Serbian locations (Belgrade metro + nearby) for RS distinct-stop loads. */
const STOP_LOCATION_POOL_RS: readonly StopLocation[] = [
  { city: "BEOGRAD", zipCode: "11000", street: "KNEZA MILOSA", houseNumber: 10, latitude: 44.8055, longitude: 20.4649 },
  { city: "BEOGRAD", zipCode: "11070", street: "BULEVAR MIHAJLA PUPINA", houseNumber: 20, latitude: 44.8142, longitude: 20.4214 },
  { city: "ZEMUN", zipCode: "11080", street: "GLAVNA", houseNumber: 30, latitude: 44.8456, longitude: 20.4012 },
  { city: "SURCIN", zipCode: "11271", street: "VOJVODE STEPE", houseNumber: 40, latitude: 44.7921, longitude: 20.2789 },
  { city: "BEOGRAD", zipCode: "11060", street: "BULEVAR KRALJA ALEKSANDRA", houseNumber: 50, latitude: 44.7948, longitude: 20.5021 },
  { city: "PANCEVO", zipCode: "26000", street: "VOJVODE RADOMIRA PUTNIKA", houseNumber: 12, latitude: 44.8708, longitude: 20.6403 },
  { city: "SMEDEREVO", zipCode: "11300", street: "KARADJORDJEVA", houseNumber: 22, latitude: 44.6644, longitude: 20.9276 },
  { city: "NOVI SAD", zipCode: "21000", street: "BULEVAR OSLOBODJENJA", houseNumber: 32, latitude: 45.2551, longitude: 19.8452 },
  { city: "KRAGUJEVAC", zipCode: "34000", street: "KNEZA MIHAILA", houseNumber: 42, latitude: 44.0128, longitude: 20.9114 },
  { city: "NIS", zipCode: "18000", street: "OBILICEV VENAC", houseNumber: 52, latitude: 43.3209, longitude: 21.8958 },
  { city: "SUBOTICA", zipCode: "24000", street: "KORZO", houseNumber: 62, latitude: 46.1003, longitude: 19.6669 },
  { city: "CACAK", zipCode: "32000", street: "GRADSKO SETALISTE", houseNumber: 72, latitude: 43.8914, longitude: 20.3497 },
  { city: "SABAC", zipCode: "15000", street: "GOSPODAR JEVREMOVA", houseNumber: 82, latitude: 44.7467, longitude: 19.6936 },
  { city: "VALJEVO", zipCode: "14000", street: "KARADJORDJEVA", houseNumber: 92, latitude: 44.2751, longitude: 19.8982 },
  { city: "KRALJEVO", zipCode: "36000", street: "OLGE JOVICIC RITA", houseNumber: 102, latitude: 43.7259, longitude: 20.6894 },
  { city: "UZICE", zipCode: "31000", street: "DIMITRIJA TUCOVICA", houseNumber: 112, latitude: 43.8586, longitude: 19.8488 },
  { city: "LESKOVAC", zipCode: "16000", street: "BULEVAR OSLOBODJENJA", houseNumber: 122, latitude: 42.9981, longitude: 21.946 },
  { city: "VRANJE", zipCode: "17500", street: "PARTIZANSKA", houseNumber: 132, latitude: 42.5514, longitude: 21.9003 },
  { city: "SOMBOR", zipCode: "25000", street: "VENAC VOJVODE STEPE", houseNumber: 142, latitude: 45.7742, longitude: 19.1122 },
  { city: "ZRENJANIN", zipCode: "23000", street: "KARADJORDJEV TRG", houseNumber: 152, latitude: 45.3811, longitude: 20.3914 },
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function resolveCountryCode(details: NormalizedCustomerDetails, country?: string): string {
  const fromArg = country?.trim().toUpperCase();
  if (fromArg && fromArg.length === 2) return fromArg;
  const fromPayer = details.payerAddress?.countryCode?.trim().toUpperCase();
  if (fromPayer && fromPayer.length === 2) return fromPayer;
  const fromAddr = details.addresses?.[0]?.countryCode?.trim().toUpperCase();
  if (fromAddr && fromAddr.length === 2) return fromAddr;
  return "HR";
}

function stopPoolForCountry(countryCode: string): readonly StopLocation[] {
  return countryCode === "RS" ? STOP_LOCATION_POOL_RS : STOP_LOCATION_POOL_HR;
}

function phoneForCountry(countryCode: string, seq: number): string {
  const suffix = String(7_000_000 + seq).slice(-7);
  if (countryCode === "RS") return `06${suffix}`;
  return `091${suffix}`;
}

/**
 * Builds a unique consignee for batch shipment index `index` (0-based).
 * Each address uses distinct coordinates, name, street, phone and email so
 * CreateInstantTask groups them into separate stops on load.
 */
export function buildDistinctStopConsignee(
  index: number,
  details: NormalizedCustomerDetails,
  country?: string,
): ShipmentPartySelection {
  const countryCode = resolveCountryCode(details, country);
  const pool = stopPoolForCountry(countryCode);
  const base = pool[index % pool.length];
  const ring = Math.floor(index / pool.length);
  const seq = index + 1;
  const label = `Stop Test ${pad2(seq)}`;
  const houseNo = base.houseNumber + ring * 17 + (index % 7);
  const latOffset = ring * 0.003 + (index % 4) * 0.0015;
  const lngOffset = ring * 0.004 + (index % 3) * 0.0012;
  const phone = phoneForCountry(countryCode, seq);

  return {
    mode: "newaddress",
    isInternational: false,
    saveAddress: false,
    address: {
      addressType: 0,
      name: label,
      street: base.street,
      city: base.city,
      zipCode: base.zipCode,
      countryCode,
      houseNumber: String(houseNo),
      latitude: base.latitude + latOffset,
      longitude: base.longitude + lngOffset,
    },
    contact: {
      name: label,
      phone,
      gsm: phone,
      email: `stop${pad2(seq)}@test.nesy.local`,
      customerId: details.customerId,
      customerCenter: details.customerCenter,
    },
  };
}

export function buildPartiesWithDistinctConsignee(
  details: NormalizedCustomerDetails,
  shipper: ShipmentPartySelection,
  consigneeIndex: number,
  country?: string,
) {
  const consignee = buildDistinctStopConsignee(consigneeIndex, details, country);
  return buildPartiesFromDetails(details, shipper, consignee);
}
