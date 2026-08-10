/**
 * ===========================================================================
 *  @nesy/nesy-courier-domain-pack — the first-party reference Domain Pack
 *
 *  This is where courier business language is ALLOWED to live. `STOP`, `PARCEL`,
 *  `SHIPMENT`, `TOUR_APPROVAL`, `DELIVERY` — all of it belongs here and nowhere
 *  upstream. `@nesy/workflow-contract` and `@nesy/bridge-contract` carry opaque
 *  refs; this package is what gives them meaning.
 *
 *  The inversion matters: a second tenant adds a pack, not a Core change. The
 *  moment a business step kind lands in the shared IR union, the second domain
 *  requires a Core redesign — which is precisely the debt Phases 4A and 4B exist
 *  to prevent.
 *
 *  What this package still does NOT contain, by contract:
 *
 *    - a generic compiler implementation: expansion snapshots are compiler
 *      authored WorkflowIR v2 artifacts, but the shared compiler remains
 *      domain-neutral;
 *    - an executor, queue, lease or run manifest (Phase 5);
 *    - a manager UI (Phase 6);
 *    - any runtime code: the published bundle is declarative data.
 * ===========================================================================
 */
export * from "./slice.js";
export * from "./registries/facts.js";
export * from "./registries/application.js";
export * from "./registries/screens.js";
export * from "./registries/surfaces.js";
export * from "./registries/entities.js";
export * from "./registries/targets.js";
export * from "./registries/actions.js";
export * from "./registries/capabilities.js";
export * from "./registries/features.js";
export * from "./evidence/sources.js";
export * from "./evidence/derived.js";
export * from "./adapters/backoffice.js";
export * from "./macros/common.js";
export * from "./macros/ir-authoring.js";
export * from "./macros/login.js";
export * from "./macros/select-route.js";
export * from "./macros/open-stop.js";
export * from "./macros/process-parcel.js";
export * from "./macros/complete-delivery.js";
export * from "./macros/full-courier-golden.js";
export * from "./macros/tour-approval-lifecycle.js";
export * from "./macros/interrupt-handlers.js";
export * from "./profiles/launch.js";
export * from "./profiles/workflows.js";
export * from "./profiles/test-profiles.js";
export * from "./reference.js";
export * from "./bundle.js";
