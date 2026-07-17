import { prisma, type Prisma } from "@nesy/db";

function collectNonEmptyIds(values: Array<string | null | undefined>): string[] {
  const ids = new Set<string>();
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) ids.add(trimmed);
  }
  return [...ids];
}

function readWaybillFromShipmentData(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const record = data as Record<string, unknown>;
  const waybill = record.shipmentId;
  return typeof waybill === "string" && waybill.trim() ? waybill.trim() : null;
}

/** Shipment / pickup rows tied to Happy Path — excluded from ops list tables. */
export async function loadHappyPathLinkedRecordIds(): Promise<{
  shipmentIds: string[];
  pickupIds: string[];
}> {
  const entries = await prisma.happyPathPoolEntry.findMany({
    select: { shipmentId: true, pickupId: true },
  });

  const shipmentIdSet = new Set(collectNonEmptyIds(entries.map((entry) => entry.shipmentId)));
  const pickupIdSet = new Set(collectNonEmptyIds(entries.map((entry) => entry.pickupId)));

  const [taggedShipments, taggedPickups, linkedShipments] = await Promise.all([
    prisma.shipment.findMany({
      where: {
        data: {
          path: ["happyPathOrigin"],
          equals: true,
        },
      },
      select: { id: true },
    }),
    prisma.pickup.findMany({
      where: {
        data: {
          path: ["happyPathOrigin"],
          equals: true,
        },
      },
      select: { id: true },
    }),
    shipmentIdSet.size > 0
      ? prisma.shipment.findMany({
          where: { id: { in: [...shipmentIdSet] } },
          select: { data: true },
        })
      : Promise.resolve([]),
  ]);

  for (const row of taggedShipments) shipmentIdSet.add(row.id);
  for (const row of taggedPickups) pickupIdSet.add(row.id);

  const waybills = collectNonEmptyIds(
    linkedShipments.map((row) => readWaybillFromShipmentData(row.data)),
  );

  if (waybills.length > 0) {
    const pickupsByWaybill = await prisma.pickup.findMany({
      where: { shipmentId: { in: waybills } },
      select: { id: true },
    });
    for (const row of pickupsByWaybill) pickupIdSet.add(row.id);
  }

  return {
    shipmentIds: [...shipmentIdSet],
    pickupIds: [...pickupIdSet],
  };
}

export function mergeHappyPathOrigin(
  data: Record<string, unknown>,
  happyPathOrigin?: boolean,
): Record<string, unknown> {
  if (!happyPathOrigin) return data;
  return { ...data, happyPathOrigin: true };
}

async function tagRecordDataIfNeeded(
  kind: "shipment" | "pickup",
  id: string,
): Promise<void> {
  if (kind === "shipment") {
    const row = await prisma.shipment.findUnique({ where: { id }, select: { data: true } });
    if (!row) return;
    const data = (row.data ?? {}) as Record<string, unknown>;
    if (data.happyPathOrigin === true) return;
    await prisma.shipment.update({
      where: { id },
      data: {
        data: mergeHappyPathOrigin(data, true) as Prisma.InputJsonValue,
      },
    });
    return;
  }

  const row = await prisma.pickup.findUnique({ where: { id }, select: { data: true } });
  if (!row) return;
  const data = (row.data ?? {}) as Record<string, unknown>;
  if (data.happyPathOrigin === true) return;
  await prisma.pickup.update({
    where: { id },
    data: {
      data: mergeHappyPathOrigin(data, true) as Prisma.InputJsonValue,
    },
  });
}

/** One-time per process: tag DB rows referenced by pool entries (legacy happy path pickups). */
let backfillPromise: Promise<void> | null = null;

export function ensureHappyPathRecordTagsBackfill(): Promise<void> {
  if (!backfillPromise) {
    backfillPromise = backfillHappyPathRecordTags().catch(() => {
      backfillPromise = null;
    });
  }
  return backfillPromise;
}

async function backfillHappyPathRecordTags(): Promise<void> {
  const entries = await prisma.happyPathPoolEntry.findMany({
    select: { shipmentId: true, pickupId: true },
  });

  const shipmentIds = collectNonEmptyIds(entries.map((entry) => entry.shipmentId));
  const pickupIds = collectNonEmptyIds(entries.map((entry) => entry.pickupId));

  await Promise.all([
    ...shipmentIds.map((id) => tagRecordDataIfNeeded("shipment", id)),
    ...pickupIds.map((id) => tagRecordDataIfNeeded("pickup", id)),
  ]);

  if (shipmentIds.length === 0) return;

  const shipments = await prisma.shipment.findMany({
    where: { id: { in: shipmentIds } },
    select: { data: true },
  });

  const waybills = collectNonEmptyIds(
    shipments.map((row) => readWaybillFromShipmentData(row.data)),
  );

  if (waybills.length === 0) return;

  const linkedPickups = await prisma.pickup.findMany({
    where: { shipmentId: { in: waybills } },
    select: { id: true },
  });

  await Promise.all(
    linkedPickups.map((row) => tagRecordDataIfNeeded("pickup", row.id)),
  );
}

/** Remove shipment/pickup DB rows referenced by pool entries (before pool delete). */
export async function deleteRecordsLinkedToHappyPathPools(poolIds: string[]): Promise<{
  deletedShipments: number;
  deletedPickups: number;
}> {
  const uniquePoolIds = [...new Set(poolIds.map((id) => id.trim()).filter(Boolean))];
  if (uniquePoolIds.length === 0) {
    return { deletedShipments: 0, deletedPickups: 0 };
  }

  const entries = await prisma.happyPathPoolEntry.findMany({
    where: { poolId: { in: uniquePoolIds } },
    select: { shipmentId: true, pickupId: true },
  });

  const shipmentIdSet = new Set(collectNonEmptyIds(entries.map((entry) => entry.shipmentId)));
  const pickupIdSet = new Set(collectNonEmptyIds(entries.map((entry) => entry.pickupId)));

  if (shipmentIdSet.size > 0) {
    const shipments = await prisma.shipment.findMany({
      where: { id: { in: [...shipmentIdSet] } },
      select: { data: true },
    });
    const waybills = collectNonEmptyIds(
      shipments.map((row) => readWaybillFromShipmentData(row.data)),
    );
    if (waybills.length > 0) {
      const pickupsByWaybill = await prisma.pickup.findMany({
        where: { shipmentId: { in: waybills } },
        select: { id: true },
      });
      for (const row of pickupsByWaybill) pickupIdSet.add(row.id);
    }
  }

  const pickupIds = [...pickupIdSet];
  const shipmentIds = [...shipmentIdSet];

  let deletedPickups = 0;
  let deletedShipments = 0;

  if (pickupIds.length > 0) {
    const pickupResult = await prisma.pickup.deleteMany({
      where: { id: { in: pickupIds } },
    });
    deletedPickups = pickupResult.count;
  }
  if (shipmentIds.length > 0) {
    const shipmentResult = await prisma.shipment.deleteMany({
      where: { id: { in: shipmentIds } },
    });
    deletedShipments = shipmentResult.count;
  }

  return { deletedShipments, deletedPickups };
}
