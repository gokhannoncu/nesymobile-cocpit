// @ts-nocheck
import { Router, type Router as RouterType } from "express";
import { prisma, type Prisma } from "@nesy/db";
import { deleteRecordsLinkedToHappyPathPools } from "./happy-path-list-exclusions.js";

const router: RouterType = Router();

const POOL_STATUSES = new Set(["Draft", "Generating", "Created", "Failed", "Completed"]);

function normalizeEnvironment(value: string): string {
  return value.trim().toLowerCase();
}

function formatCreatedDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function normalizePoolStatus(status: string): string {
  return status === "Completed" ? "Created" : status;
}

function mapPoolToListItem(pool: {
  id: string;
  name: string;
  country: string;
  environment: string;
  status: string;
  shipmentCount: number;
  createdAt: Date;
}) {
  return {
    id: pool.id,
    name: pool.name,
    country: pool.country,
    environment: pool.environment.toUpperCase(),
    shipmentCount: pool.shipmentCount,
    status: normalizePoolStatus(pool.status),
    createdDate: formatCreatedDate(pool.createdAt),
  };
}

// ─── GET / — list pools ─────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const country = typeof req.query.country === "string" ? req.query.country : undefined;
    const environment =
      typeof req.query.environment === "string"
        ? normalizeEnvironment(req.query.environment)
        : undefined;

    const where: Prisma.HappyPathPoolWhereInput | undefined =
      country && environment ? { country, environment } : undefined;

    const pools = await prisma.happyPathPool.findMany({
      ...(where ? { where } : {}),
      orderBy: { createdAt: "desc" },
    });

    res.json({ data: pools.map(mapPoolToListItem) });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch happy path pools.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ─── GET /:id — pool detail with entries ───────────────────────
async function enrichPoolEntriesWithNesyShipmentIds(
  entries: {
    route: string;
    shipmentId: string | null;
    pickupId: string | null;
    [key: string]: unknown;
  }[],
) {
  const shipmentDbIds = [
    ...new Set(
      entries
        .map((e) => e.shipmentId?.trim())
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const pickupDbIds = [
    ...new Set(
      entries
        .map((e) => e.pickupId?.trim())
        .filter((id): id is string => Boolean(id)),
    ),
  ];

  const [shipments, pickups] = await Promise.all([
    shipmentDbIds.length
      ? prisma.shipment.findMany({
          where: { id: { in: shipmentDbIds } },
          select: { id: true, data: true },
        })
      : Promise.resolve([]),
    pickupDbIds.length
      ? prisma.pickup.findMany({
          where: { id: { in: pickupDbIds } },
          select: { id: true, shipmentId: true },
        })
      : Promise.resolve([]),
  ]);

  const nesyByShipmentDbId = new Map<string, string>();
  for (const row of shipments) {
    const data = row.data as Record<string, unknown> | null;
    const nesyId = typeof data?.shipmentId === "string" ? data.shipmentId.trim() : "";
    if (nesyId) nesyByShipmentDbId.set(row.id, nesyId);
  }

  const nesyByPickupDbId = new Map<string, string>();
  for (const row of pickups) {
    const sid = row.shipmentId?.trim();
    if (sid) nesyByPickupDbId.set(row.id, sid);
  }

  return entries.map((entry) => {
    let nesyShipmentId: string | null = null;
    if (entry.route === "shipment" && entry.shipmentId) {
      nesyShipmentId = nesyByShipmentDbId.get(entry.shipmentId.trim()) ?? null;
    } else if (entry.route === "pickup" && entry.pickupId) {
      nesyShipmentId = nesyByPickupDbId.get(entry.pickupId.trim()) ?? null;
    }
    return { ...entry, nesyShipmentId };
  });
}

router.get("/:id", async (req, res) => {
  try {
    const pool = await prisma.happyPathPool.findUnique({
      where: { id: req.params.id },
      include: { entries: { orderBy: { sortOrder: "asc" } } },
    });

    if (!pool) {
      res.status(404).json({ message: "Happy path pool not found." });
      return;
    }

    const entries = await enrichPoolEntriesWithNesyShipmentIds(pool.entries);

    res.json({
      data: {
        ...mapPoolToListItem(pool),
        assignmentMode: pool.assignmentMode,
        meta: pool.meta,
        entries,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to fetch happy path pool.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

interface PoolEntryInput {
  typeId: string;
  label: string;
  route: string;
  status: string;
  shipmentId?: string | null;
  pickupId?: string | null;
  unloadStatus?: string | null;
  error?: string | null;
  sortOrder?: number;
}

interface CreatePoolBody {
  name?: string;
  country?: string;
  environment?: string;
  status?: string;
  shipmentCount?: number;
  assignmentMode?: string;
  meta?: Record<string, unknown>;
  entries?: PoolEntryInput[];
}

// ─── POST / — create pool + entries ────────────────────────────
router.post("/", async (req, res) => {
  try {
    const body = req.body as CreatePoolBody;
    const { name, country, environment, assignmentMode, meta, entries } = body;

    if (!name?.trim() || !country?.trim() || !environment?.trim()) {
      res.status(400).json({ message: "name, country, environment are required." });
      return;
    }

    const statusRaw = body.status && POOL_STATUSES.has(body.status) ? body.status : "Created";
    const status = statusRaw === "Completed" ? "Created" : statusRaw;
    const shipmentCount =
      typeof body.shipmentCount === "number"
        ? body.shipmentCount
        : (entries ?? []).filter((e) => e.status === "success").length;

    const pool = await prisma.happyPathPool.create({
      data: {
        name: name.trim(),
        country: country.trim(),
        environment: normalizeEnvironment(environment),
        status,
        shipmentCount,
        assignmentMode: assignmentMode?.trim() || null,
        meta: meta ? (meta as Prisma.InputJsonValue) : undefined,
        entries: {
          create: (entries ?? []).map((entry, index) => ({
            typeId: entry.typeId,
            label: entry.label,
            route: entry.route,
            status: entry.status,
            shipmentId: entry.shipmentId?.trim() || null,
            pickupId: entry.pickupId?.trim() || null,
            unloadStatus: entry.unloadStatus?.trim() || null,
            error: entry.error?.trim() || null,
            sortOrder: entry.sortOrder ?? index,
          })),
        },
      },
      include: { entries: true },
    });

    res.status(201).json({ data: mapPoolToListItem(pool) });
  } catch (error) {
    res.status(500).json({
      message: "Failed to create happy path pool.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ─── PATCH /:id — update pool metadata ─────────────────────────
router.patch("/:id", async (req, res) => {
  try {
    const existing = await prisma.happyPathPool.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      res.status(404).json({ message: "Happy path pool not found." });
      return;
    }

    const body = req.body as { name?: string };
    const name = typeof body.name === "string" ? body.name.trim() : "";

    if (!name) {
      res.status(400).json({ message: "name is required." });
      return;
    }

    const pool = await prisma.happyPathPool.update({
      where: { id: req.params.id },
      data: { name },
    });

    res.json({ data: mapPoolToListItem(pool) });
  } catch (error) {
    res.status(500).json({
      message: "Failed to update happy path pool.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ─── DELETE /bulk — delete multiple pools (before /:id) ─────────
router.delete("/bulk", async (req, res) => {
  try {
    const { ids } = req.body as { ids?: string[] };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ message: "ids array is required." });
      return;
    }

    const trimmedIds = ids.map((id) => String(id).trim()).filter(Boolean);
    const linked = await deleteRecordsLinkedToHappyPathPools(trimmedIds);

    const result = await prisma.happyPathPool.deleteMany({
      where: { id: { in: trimmedIds } },
    });

    res.json({
      deleted: result.count,
      deletedShipments: linked.deletedShipments,
      deletedPickups: linked.deletedPickups,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete happy path pools.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

// ─── DELETE /:id — delete pool (cascade entries) ─────────────────
router.delete("/:id", async (req, res) => {
  try {
    const existing = await prisma.happyPathPool.findUnique({
      where: { id: req.params.id },
    });

    if (!existing) {
      res.status(404).json({ message: "Happy path pool not found." });
      return;
    }

    const linked = await deleteRecordsLinkedToHappyPathPools([req.params.id]);

    await prisma.happyPathPool.delete({ where: { id: req.params.id } });
    res.json({
      deleted: true,
      deletedShipments: linked.deletedShipments,
      deletedPickups: linked.deletedPickups,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to delete happy path pool.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
