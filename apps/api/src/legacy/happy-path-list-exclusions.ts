import { prisma } from "@nesy/db";

function collectNonEmptyIds(values: Array<string | null | undefined>): string[] {
  const ids = new Set<string>();
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) ids.add(trimmed);
  }
  return [...ids];
}

/** Shipment / pickup rows linked to a Happy Path pool entry (ops list exclusion). */
export async function loadHappyPathLinkedRecordIds(): Promise<{
  shipmentIds: string[];
  pickupIds: string[];
}> {
  const entries = await prisma.happyPathPoolEntry.findMany({
    select: { shipmentId: true, pickupId: true },
  });

  return {
    shipmentIds: collectNonEmptyIds(entries.map((entry) => entry.shipmentId)),
    pickupIds: collectNonEmptyIds(entries.map((entry) => entry.pickupId)),
  };
}
