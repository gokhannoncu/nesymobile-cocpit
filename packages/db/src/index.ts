import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

if (!process.env.DATABASE_URL?.trim()) {
  const apiEnvPath = resolve(process.cwd(), "../../apps/api/.env");
  if (existsSync(apiEnvPath)) {
    const match = /^DATABASE_URL=(.*)$/m.exec(readFileSync(apiEnvPath, "utf8"));
    const raw = match?.[1]?.trim();
    if (raw) process.env.DATABASE_URL = raw.replace(/^["']|["']$/g, "");
  }
}

declare global {
  var __prisma__: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient();
}

/** Drop cached client in dev when schema gained new delegates (avoids stale hot-reload clients). */
function resolvePrismaClient(): PrismaClient {
  const cached = globalThis.__prisma__;
  if (cached) {
    const hasGraylog = typeof (cached as { graylogQueryRun?: unknown }).graylogQueryRun !== "undefined";
    const hasMongo = typeof (cached as { mongoQueryRun?: unknown }).mongoQueryRun !== "undefined";
    const hasEngineeringIncidents =
      typeof (cached as { engineeringIncident?: unknown }).engineeringIncident !== "undefined";
    const hasEngineeringIncidentEvents =
      typeof (cached as { engineeringIncidentEvent?: unknown }).engineeringIncidentEvent !== "undefined";
    const hasVerdictDiagnosticCaptures =
      typeof (cached as { verdictDiagnosticCapture?: unknown }).verdictDiagnosticCapture !== "undefined";
    const hasBridgeFlowRuntime =
      typeof (cached as { bridgeFlowRunRuntime?: unknown }).bridgeFlowRunRuntime !== "undefined" &&
      typeof (cached as { bridgeFlowStepOccurrence?: unknown }).bridgeFlowStepOccurrence !== "undefined" &&
      typeof (cached as { verdictTestExecution?: unknown }).verdictTestExecution !== "undefined";
    if (
      hasGraylog &&
      hasMongo &&
      hasEngineeringIncidents &&
      hasEngineeringIncidentEvents &&
      hasVerdictDiagnosticCaptures &&
      hasBridgeFlowRuntime
    ) {
      return cached;
    }
    // Hot-reload in `pnpm dev` used to silently $disconnect the live client
    // mid-run. That is the "Server has closed the connection" class: the
    // backend is gone because this process retired it. Log the close so a
    // campaign can tell restart from a pool/server drop.
    const createdAt = (cached as { __createdAtMs?: number }).__createdAtMs;
    console.warn("[prisma] replacing stale client (schema delegates changed)", {
      pid: process.pid,
      uptimeSec: Math.round(process.uptime()),
      nodeEnv: process.env.NODE_ENV ?? null,
      replacedClientAgeSec:
        typeof createdAt === "number" ? Math.round((Date.now() - createdAt) / 1000) : null,
    });
    void cached.$disconnect().catch(() => undefined);
  }
  const client = createPrismaClient();
  (client as { __createdAtMs?: number }).__createdAtMs = Date.now();
  if (process.env.NODE_ENV !== "production") {
    globalThis.__prisma__ = client;
  }
  return client;
}

export const prisma = resolvePrismaClient();

export * from "@prisma/client";
