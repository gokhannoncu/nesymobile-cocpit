import { Router, type Router as RouterType } from "express";
import { prisma } from "@nesy/db";

const router: RouterType = Router();

function readTrimmed(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

router.post("/", async (req, res) => {
  try {
    const body = req.body as Record<string, unknown>;
    const deviceId = readTrimmed(body.deviceId);
    const adbDeviceId = readTrimmed(body.adbDeviceId);
    const modelName = readTrimmed(body.modelName) || "Unknown model";
    const product = readTrimmed(body.product);
    const transportId = readTrimmed(body.transportId);
    const label = readTrimmed(body.label);

    if (!deviceId) {
      res.status(400).json({ message: "deviceId is required." });
      return;
    }

    const existing = await prisma.mobileDevice.findUnique({ where: { deviceId } });
    if (existing) {
      res.status(409).json({
        message: "This device ID is already saved.",
        data: existing,
      });
      return;
    }

    const row = await prisma.mobileDevice.create({
      data: {
        deviceId,
        adbDeviceId: adbDeviceId || null,
        modelName,
        product: product || null,
        transportId: transportId || null,
        label: label || null,
      },
    });

    res.status(201).json({ data: row });
  } catch (error) {
    res.status(500).json({
      message: "Mobile device could not be saved.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

router.get("/", async (_req, res) => {
  try {
    const rows = await prisma.mobileDevice.findMany({
      orderBy: [{ updatedAt: "desc" }, { modelName: "asc" }],
    });
    res.json({ data: rows });
  } catch (error) {
    res.status(500).json({
      message: "Mobile devices could not be fetched.",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
});

export default router;
