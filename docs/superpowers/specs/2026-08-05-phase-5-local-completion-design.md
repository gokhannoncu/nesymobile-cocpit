# Phase 5 Local Completion Design

## Status and scope

This document freezes the approved local-completion architecture for Phase 5.
It adds contracts and persistence foundations without cutting over the existing
Maestro/YAML path. Real DUT acceptance, B-12, and deployment of migrations to a
shared PostgreSQL database remain external work and are not completion evidence
for this local task.

## Ownership boundaries

`packages/execution-contract` owns domain-neutral runtime state and pure
transitions. This includes scheduler lease recovery, first-terminal-wins wait
settlement, remote-action terminal outcomes, and replay-safe revision
identities. It reuses the shared workflow lifecycle, verdict, scheduler
disposition, and cleanup unions instead of defining competing meanings.

`packages/bridgeflow-executor` executes compiled plans through injected ports.
It may consume execution contracts, but it contains no Prisma client, database
schema knowledge, Domain Pack storage logic, or domain-specific persistence
details.

`apps/api` owns runtime workers, persistence adapters, HTTP/WebSocket routes,
and query/read-model assembly. It translates between durable rows and the
domain-neutral contracts. Domain Pack bundles and profile/campaign snapshots are
data supplied to adapters; they do not move persistence concerns into the
executor.

## Evidence and evaluation flow

Raw evidence follows one canonical nine-stage journey:

1. `EMIT`
2. `WAL`
3. `TRANSPORT`
4. `INBOX`
5. `RECEIPT`
6. `ORDERED`
7. `NORMALIZATION`
8. `CORRELATION`
9. `EVALUATION`

The first six stages establish provenance and durable delivery. Normalization
turns raw records into domain-neutral facts, correlation binds those facts to
the exact run, occurrence, and iteration, and evaluation creates versioned
Continue Gate or Final Oracle revisions. Evidence and Oracle revision writes
must carry stable idempotency keys, and each logical fact/evaluator revision has
a compound uniqueness constraint. Replay therefore updates the same logical
revision instead of inventing a second row.

Only normalized, applicable, correlated evidence can influence Gate or Oracle
state. HTTP 2xx, UI state, action transport success, or remote transport success
does not itself create a business `PASS`; the Final Oracle remains the sole
owner of product verdicts.

## Recovery rules

Wait settlement is first-terminal-wins. Once a terminal wait result is stored,
a timeout, cancellation, or match arriving later cannot overwrite it.

Scheduler recovery evaluates the durable execution lifecycle, lease expiry,
heartbeat freshness, and physical-effect state:

- A completed occurrence is skipped and is never executed again.
- Only a `RUNNING` execution with scheduler disposition `LEASED`, a non-empty
  lease owner, a finite expiry, and a present fresh heartbeat remains owned by
  its worker.
- An expired or stale lease may be requeued only when no physical effect began.
- Missing ownership/expiry or invalid lifecycle/disposition combinations become
  `ORPHANED`.
- A lost worker with a physical effect in flight becomes `UNKNOWN_EFFECT`; it is
  never retried as though nothing happened and may later require reconciliation.
- A terminal execution is never reopened by recovery.

Remote actions preserve four distinct terminal meanings: `SUCCEEDED`, `FAILED`,
`UNKNOWN_EFFECT`, and `RECONCILIATION_REQUIRED`. The latter two cannot be
collapsed into failure because doing so would permit a duplicate physical or
remote mutation. Transport success remains operational evidence, not a product
verdict.

## Durable model foundation

The Prisma schema remains additive. Existing WorkflowRun and Maestro columns
remain unchanged.

- Evidence facts and Oracle evaluations require explicit replay-safe
  idempotency keys and enforce one row per logical revision.
- Test executions expose lease owner, lease expiry, and heartbeat timestamps for
  restart recovery.
- Domain Packs have stable identities and versioned bundle snapshots. A
  published snapshot records its immutable timestamp and publication metadata.
  A database trigger rejects update or deletion of an already published
  snapshot; changes require a new version.
- Test Profiles are stored as versioned definition snapshots.
- Test Campaign runs pin a campaign key/version and Domain Pack version.
- Campaign Cells persist profile/version, matrix coordinates, actual run IDs,
  result, blocked reason, and evidence summary reference.

The migration is generated as an additive SQL artifact only. This design does
not authorize applying it to a local, shared, staging, or production database.

## External completion boundaries

The following remain explicitly outside local completion:

- real DUT acceptance;
- B-12 device handshake stabilization/acceptance;
- controlled `prisma migrate deploy` against shared PostgreSQL;
- Maestro/YAML removal or runtime cutover.

No local test, schema validation, HTTP response, UI state, or remote transport
result may be reported as satisfying those external gates.
