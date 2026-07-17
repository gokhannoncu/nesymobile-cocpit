import { Router, type Router as RouterType } from "express";
import { prisma } from "@nesy/db";

const router: RouterType = Router();

const VALID_COUNTRIES = new Set(["HR", "SI", "RS", "BA", "ME"]);
const VALID_ENVIRONMENTS = new Set(["stage", "prod"]);

function normalizeHubId(raw: unknown): string {
  return typeof raw === "string" ? raw.trim() : "";
}

function parseCountryEnv(body: Record<string, unknown>): { country: string; environment: string } | null {
  const country = typeof body.country === "string" ? body.country.trim().toUpperCase() : "";
  const environment = typeof body.environment === "string" ? body.environment.trim().toLowerCase() : "";
  if (!VALID_COUNTRIES.has(country) || !VALID_ENVIRONMENTS.has(environment)) return null;
  return { country, environment };
}

/** POST create / update — aynı username+hubId+country+environment upsert */
router.post("/", async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password.trim() : "";
    const hubName = typeof body.hubName === "string" ? body.hubName.trim() : "";
    const hubId = normalizeHubId(body.hubId);
    const scope = parseCountryEnv(body);

    if (!username) {
      res.status(400).json({ message: "username is required." });
      return;
    }
    if (!hubName) {
      res.status(400).json({ message: "hubName is required." });
      return;
    }
    if (!/^\d{4}$/.test(password)) {
      res.status(400).json({ message: "password (PIN) must be exactly 4 digits." });
      return;
    }
    if (!scope) {
      res.status(400).json({ message: "country (HR|SI|RS|BA|ME) and environment (stage|prod) are required." });
      return;
    }

    const row = await prisma.courierWallet.upsert({
      where: {
        username_hubId_country_environment: {
          username,
          hubId,
          country: scope.country,
          environment: scope.environment,
        },
      },
      create: {
        username,
        password,
        hubName,
        hubId,
        country: scope.country,
        environment: scope.environment,
      },
      update: {
        password,
        hubName,
      },
    });

    res.status(201).json({
      data: {
        id: row.id,
        username: row.username,
        hubName: row.hubName,
        hubId: row.hubId,
        country: row.country,
        environment: row.environment,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Courier wallet could not be saved.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/** GET list — country+environment query ile filtreli (PIN yok) */
router.get("/", async (req, res) => {
  try {
    const country = typeof req.query.country === "string" ? req.query.country.trim().toUpperCase() : "";
    const environment = typeof req.query.environment === "string" ? req.query.environment.trim().toLowerCase() : "";

    const where: Record<string, string> = {};
    if (VALID_COUNTRIES.has(country)) where.country = country;
    if (VALID_ENVIRONMENTS.has(environment)) where.environment = environment;

    const rows = await prisma.courierWallet.findMany({
      where,
      select: { id: true, username: true, country: true, environment: true },
      orderBy: { username: "asc" },
    });
    res.json({ data: rows });
  } catch (error) {
    res.status(500).json({
      message: "Courier wallets could not be fetched.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

/** GET by id — PIN dahil (iç ağ aracı varsayımı) */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!id?.trim()) {
      res.status(400).json({ message: "id is required." });
      return;
    }

    const row = await prisma.courierWallet.findUnique({
      where: { id: id.trim() },
    });

    if (!row) {
      res.status(404).json({ message: "Courier wallet not found." });
      return;
    }

    res.json({
      data: {
        id: row.id,
        username: row.username,
        password: row.password,
        hubName: row.hubName,
        hubId: row.hubId,
        country: row.country,
        environment: row.environment,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      message: "Courier wallet could not be fetched.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const id = typeof req.params.id === "string" ? req.params.id.trim() : "";
    if (!id) {
      res.status(400).json({ message: "id is required." });
      return;
    }

    const deleted = await prisma.courierWallet.deleteMany({
      where: { id },
    });

    if (deleted.count === 0) {
      res.status(404).json({ message: "Courier wallet not found." });
      return;
    }

    res.status(204).end();
  } catch (error) {
    res.status(500).json({
      message: "Courier wallet could not be deleted.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
