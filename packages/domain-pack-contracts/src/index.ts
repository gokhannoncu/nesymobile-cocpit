/**
 * ===========================================================================
 *  @nesy/domain-pack-contracts — Verdict Domain Pack contract
 *
 *  This package is the seam between a domain-neutral core and a real business.
 *  `@nesy/workflow-contract` carries opaque refs — `factKey`, `targetRef`,
 *  `operationRef` — and a Domain Pack is what gives them meaning. The direction
 *  is one-way: a pack expands INTO the Core step union and never extends it.
 *
 *  Four prohibitions, each enforced by a failing test rather than a convention:
 *
 *    1. NO EXECUTION PLANE. No RunManifest, TestExecution, Lease, ResourceLease,
 *       SchedulerDisposition, WorkerHeartbeat or full ImpactGraph. Those are
 *       Phase 5/6 runtime state; a pack carrying them could not be published as
 *       an immutable, digestible artifact.
 *    2. NO RUNTIME CODE. A published bundle is declarative data. No inline
 *       script, no eval, no dynamic import, no function values.
 *    3. NO COMPILER. Macro expansion snapshots here are hand-authored REVIEW
 *       artifacts. The domain-aware BridgeFlowCompiler is Phase 4C.
 *    4. NO TRANSPORT. Remote operations name an allowlisted adapter operation.
 *       There is no url, method, header or body field to hide an endpoint in.
 * ===========================================================================
 */
export * from "./manifest.js";
export * from "./application.js";
export * from "./screen-surface.js";
export * from "./entity-target.js";
export * from "./evidence-source.js";
export * from "./semantic-action.js";
export * from "./profile.js";
export * from "./feature-capability.js";
export * from "./remote-adapter.js";
export * from "./canonical.js";
export * from "./bundle.js";
export * from "./validate.js";
