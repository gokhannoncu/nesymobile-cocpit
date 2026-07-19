-- CreateTable
CREATE TABLE "engineering_incidents" (
    "id" TEXT NOT NULL,
    "incidentNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT,
    "severity" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ASSESSING',
    "objective" TEXT NOT NULL,
    "countries" TEXT[] NOT NULL,
    "environment" TEXT NOT NULL,
    "appVersion" TEXT NOT NULL,
    "affectedScreen" TEXT NOT NULL,
    "riskTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "reporterName" TEXT NOT NULL,
    "incidentCommander" TEXT NOT NULL,
    "operationsLead" TEXT,
    "communicationsLead" TEXT,
    "scribe" TEXT,
    "affectedCouriers" INTEGER NOT NULL DEFAULT 0,
    "affectedShipments" INTEGER NOT NULL DEFAULT 0,
    "affectedPaymentRecords" INTEGER NOT NULL DEFAULT 0,
    "relatedTicket" TEXT,
    "nextCommunicationAt" TIMESTAMP(3),
    "resolutionSummary" TEXT,
    "rootCause" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "durationSeconds" INTEGER,
    "lastUpdateAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "engineering_incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engineering_incident_events" (
    "id" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT,
    "message" TEXT NOT NULL,
    "createdBy" TEXT,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "engineering_incident_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "engineering_incidents_incidentNumber_key"
  ON "engineering_incidents"("incidentNumber");

-- CreateIndex
CREATE INDEX "engineering_incidents_status_startedAt_idx"
  ON "engineering_incidents"("status", "startedAt");

-- CreateIndex
CREATE INDEX "engineering_incidents_endedAt_startedAt_idx"
  ON "engineering_incidents"("endedAt", "startedAt");

-- CreateIndex
CREATE INDEX "engineering_incident_events_incidentId_occurredAt_idx"
  ON "engineering_incident_events"("incidentId", "occurredAt");

-- AddForeignKey
ALTER TABLE "engineering_incident_events"
  ADD CONSTRAINT "engineering_incident_events_incidentId_fkey"
  FOREIGN KEY ("incidentId") REFERENCES "engineering_incidents"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
