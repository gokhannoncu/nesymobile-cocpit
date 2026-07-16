export interface ParcelBarcode {
  barcode: string;
  order: number;
}

export function extractBarcodes(data: Record<string, unknown>): ParcelBarcode[] {
  const parcels = data.parcels as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(parcels)) return [];
  return parcels
    .filter((p) => typeof p.barcode === "string" && p.barcode.length > 0)
    .map((p) => ({
      barcode: p.barcode as string,
      order: (p.order as number) ?? 0,
    }));
}
