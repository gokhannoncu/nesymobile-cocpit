-- ===========================================================================
--  Persist the Domain Pack version revision counter.
--
--  DomainPackAdminService uses `revision` for optimistic concurrency on
--  draft-save and publish. It was only ever held in memory, so the counter
--  reset on every API restart and concurrent editors could not be detected
--  once the service became database-backed.
--
--  Additive: existing rows get revision 1, matching a single completed write.
-- ===========================================================================

ALTER TABLE "verdict_domain_pack_version"
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;
