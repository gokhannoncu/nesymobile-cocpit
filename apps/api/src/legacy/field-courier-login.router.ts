import { Router, type Router as RouterType } from "express";
import { prisma } from "@nesy/db";

const router: RouterType = Router();

const VALID_COUNTRIES = new Set(["HR", "SI", "RS", "BA", "ME"]);
const VALID_ENVIRONMENTS = new Set(["stage", "prod"]);

router.get("/", async (req, res) => {
  try {
    const country =
      typeof req.query.country === "string" ? req.query.country.trim().toUpperCase() : "";
    const environment =
      typeof req.query.environment === "string"
        ? req.query.environment.trim().toLowerCase()
        : "";

    const where: Record<string, string> = {};
    if (VALID_COUNTRIES.has(country)) where.country = country;
    if (VALID_ENVIRONMENTS.has(environment)) where.environment = environment;

    let rows;
    try {
      rows = await prisma.fieldCourierLogin.findMany({
        where,
        orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        take: 200,
      });
    } catch (orderErr) {
      // Older DB / stale Prisma client without updatedAt — keep list working.
      console.warn(
        "[field-courier-login] orderBy updatedAt failed, falling back to createdAt:",
        orderErr instanceof Error ? orderErr.message : orderErr,
      );
      rows = await prisma.fieldCourierLogin.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: 200,
      });
    }
    res.json({ data: rows });
  } catch (error) {
    console.error("[field-courier-login] history fetch failed", error);
    res.status(500).json({
      message: "Field courier login history could not be fetched.",
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
    const deleted = await prisma.fieldCourierLogin.deleteMany({ where: { id } });
    if (deleted.count === 0) {
      res.status(404).json({ message: "Record not found." });
      return;
    }
    res.status(204).end();
  } catch (error) {
    res.status(500).json({
      message: "Field courier login record could not be deleted.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.post("/sessions", async (req, res) => {
  res.status(410).json({
    message: "Legacy field courier login sessions have been removed. Use Verdict WorkflowRunApi.",
    replacement: "/api/verdict/runtime/runs",
  });
});

router.get("/sessions/:id", (req, res) => {
  res.status(410).json({
    message: "Legacy field courier login sessions have been removed. Use Verdict run detail.",
    sessionId: req.params.id,
    replacement: "/api/verdict/runtime/runs/:runId",
  });
});

router.get("/sessions/:id/events", (req, res) => {
  res.status(410).json({
    message: "Legacy field courier login event stream has been removed. Use Verdict interactions.",
    sessionId: req.params.id,
    replacement: "/api/verdict/runtime/runs/:runId/interactions",
  });
});

export default router;
