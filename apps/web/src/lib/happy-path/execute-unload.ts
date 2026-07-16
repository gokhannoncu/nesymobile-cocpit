import { unloadParcel, type ShipmentRecord } from "@/services/shipment";
import { extractBarcodes } from "./shipment-barcodes";

interface ExecuteContext {
  token: string;
  country: string;
  environment: string;
}

export interface UnloadResult {
  ok: boolean;
  parcelsTotal: number;
  parcelsUnloaded: number;
  error?: string;
}

export async function executeUnloadForRecord(params: {
  record: ShipmentRecord;
  ctx: ExecuteContext;
  onParcelProgress?: (current: number, total: number) => void;
}): Promise<UnloadResult> {
  const { record, ctx, onParcelProgress } = params;
  const barcodes = extractBarcodes(record.data);

  if (barcodes.length === 0) {
    return {
      ok: false,
      parcelsTotal: 0,
      parcelsUnloaded: 0,
      error: "No barcodes found, skipping unload",
    };
  }

  let parcelsUnloaded = 0;

  for (let i = 0; i < barcodes.length; i++) {
    const parcel = barcodes[i];
    if (!parcel) continue;

    const isLast = i === barcodes.length - 1;
    onParcelProgress?.(i + 1, barcodes.length);

    try {
      await unloadParcel({
        shipmentDbId: record.id,
        token: ctx.token,
        country: ctx.country,
        environment: ctx.environment,
        barcode: parcel.barcode,
        isLastParcel: isLast,
      });
      parcelsUnloaded++;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown unload error";
      return {
        ok: false,
        parcelsTotal: barcodes.length,
        parcelsUnloaded,
        error: `Parcel ${i + 1}/${barcodes.length} unload failed: ${message}`,
      };
    }
  }

  return {
    ok: true,
    parcelsTotal: barcodes.length,
    parcelsUnloaded,
  };
}
