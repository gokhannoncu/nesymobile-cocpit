-- ===========================================================================
--  Align committed migration history with the current Prisma schema
--
--  These defaults came from earlier hand-written migrations but are not present
--  in `schema.prisma`. Dropping them is non-destructive: Prisma writes
--  `@updatedAt` values from the client, and `riskTypes` is a required field in
--  the application model.
--
--  Without this migration, `prisma migrate diff --from-migrations
--  --to-schema-datamodel` reports drift even after a clean `migrate deploy`.
-- ===========================================================================

ALTER TABLE "engineering_incidents"
  ALTER COLUMN "riskTypes" DROP DEFAULT,
  ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "mobile_devices"
  ALTER COLUMN "updatedAt" DROP DEFAULT;
