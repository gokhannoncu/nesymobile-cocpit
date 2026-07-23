/** Zimmet / LOAD_TO_VEHICLE scan ids — prefer legacySystemShortBarcode (PATH-NOTES). */

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function shortFromParcel(parcel: Record<string, unknown>): string {
  const short =
    str(parcel.legacySystemShortBarcode) ||
    str(parcel.LegacySystemShortBarcode) ||
    str(parcel.shortBarcode) ||
    str(parcel.ShortBarcode);
  if (short) return short;

  const legacy = str(parcel.legacySystemBarcode) || str(parcel.LegacySystemBarcode);
  const match = legacy.match(/688005\d{10}/);
  if (match?.[0]) return match[0];

  return str(parcel.barcode) || str(parcel.Barcode);
}

/** All parcel scan barcodes for a Cockpit shipment `data` payload (multicolli-aware). */
export function extractZimmetBarcodes(data: Record<string, unknown> | null | undefined): string[] {
  if (!data) return [];
  const parcelsRaw = data.parcels ?? data.Parcels;
  if (!Array.isArray(parcelsRaw)) return [];

  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of parcelsRaw) {
    const parcel = asRecord(item);
    if (!parcel) continue;
    const code = shortFromParcel(parcel);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}
