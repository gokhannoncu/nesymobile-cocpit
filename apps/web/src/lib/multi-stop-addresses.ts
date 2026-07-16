// @ts-nocheck
import {
  buildPartiesFromDetails,
  type NormalizedCustomerDetails,
} from "@/lib/nesy-customer-details";
import type { ShipmentPartySelection } from "@/lib/nesy-shipment-parties";

/** Croatian locations with distinct coordinates for stop separation on load. */
const STOP_LOCATION_POOL = [
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
] as const;

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Builds a unique consignee for batch shipment index `index` (0-based).
 * Each address uses distinct coordinates, name, street, phone and email so
 * CreateInstantTask groups them into separate stops on load.
 */
export function buildDistinctStopConsignee(
  index: number,
  details: NormalizedCustomerDetails,
): ShipmentPartySelection {
  const base = STOP_LOCATION_POOL[index % STOP_LOCATION_POOL.length];
  const ring = Math.floor(index / STOP_LOCATION_POOL.length);
  const seq = index + 1;
  const label = `Stop Test ${pad2(seq)}`;
  const houseNo = base.houseNumber + ring * 17 + (index % 7);
  const latOffset = ring * 0.003 + (index % 4) * 0.0015;
  const lngOffset = ring * 0.004 + (index % 3) * 0.0012;
  const phoneSuffix = String(7_000_000 + seq).slice(-7);

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
      countryCode: "HR",
      houseNumber: String(houseNo),
      latitude: base.latitude + latOffset,
      longitude: base.longitude + lngOffset,
    },
    contact: {
      name: label,
      phone: `091${phoneSuffix}`,
      gsm: `091${phoneSuffix}`,
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
) {
  const consignee = buildDistinctStopConsignee(consigneeIndex, details);
  return buildPartiesFromDetails(details, shipper, consignee);
}
