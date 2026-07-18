import { Router, type Router as RouterType } from "express";
import { prisma } from "@nesy/db";
import {
  getFieldLoginSession,
  startFieldLoginSession,
  subscribeFieldLoginSession,
  type FieldLoginSessionInput,
} from "../lib/field-courier-login-orchestrator.js";

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

    const rows = await prisma.fieldCourierLogin.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json({ data: rows });
  } catch (error) {
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
  try {
    const body = (req.body ?? {}) as FieldLoginSessionInput;
    const session = startFieldLoginSession(body);
    res.status(202).json({ data: session });
  } catch (error) {
    res.status(400).json({
      message: error instanceof Error ? error.message : "Could not start session.",
    });
  }
});

router.get("/sessions/:id", (req, res) => {
  const id = typeof req.params.id === "string" ? req.params.id.trim() : "";
  const session = getFieldLoginSession(id);
  if (!session) {
    res.status(404).json({ message: "Session not found." });
    return;
  }
  res.json({ data: session });
});

router.get("/sessions/:id/events", (req, res) => {
  const id = typeof req.params.id === "string" ? req.params.id.trim() : "";
  const session = getFieldLoginSession(id);
  if (!session) {
    res.status(404).json({ message: "Session not found." });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const send = (payload: unknown) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  send(session);

  if (session.status !== "running") {
    res.write("event: end\ndata: {}\n\n");
    res.end();
    return;
  }

  const unsubscribe = subscribeFieldLoginSession(id, (next) => {
    send(next);
    if (next.status !== "running") {
      res.write("event: end\ndata: {}\n\n");
      unsubscribe();
      res.end();
    }
  });

  const heartbeat = setInterval(() => {
    res.write(": ping\n\n");
  }, 15_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

export default router;
