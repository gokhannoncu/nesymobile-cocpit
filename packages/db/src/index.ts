import { PrismaClient } from "@prisma/client";

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
    if (hasGraylog && hasMongo && hasEngineeringIncidents && hasEngineeringIncidentEvents) return cached;
    void cached.$disconnect().catch(() => undefined);
  }
  const client = createPrismaClient();
  if (process.env.NODE_ENV !== "production") {
    globalThis.__prisma__ = client;
  }
  return client;
}

export const prisma = resolvePrismaClient();

export * from "@prisma/client";
