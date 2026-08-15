/**
 * ===========================================================================
 *  @nesy/workflow-contract — Verdict WorkflowIR v2 shared contract
 *
 *  Three prohibitions, each of which must be visible at review time:
 *
 *    1. NO TRANSPORT, NO PERSISTENCE. This package does not know TCP, HTTP,
 *       Prisma or Socket.io. API and Web both consume it; nothing here consumes
 *       them.
 *    2. NO DOMAIN. `STOP`, `PARCEL`, `TOUR`, `COURIER`,
 *       `OPEN_STOP`, `APPROVE_TOUR`, `COURIER_LOGIN` cannot appear in this
 *       package's surface. A Domain Pack expands INTO this union; it never
 *       extends it. `domain-leakage.ts` makes that a failing test rather than a
 *       review convention.
 *    3. NO FIXED WAIT, NO EVAL. Deadlines are upper bounds on event-driven
 *       evaluation, and conditions are a typed AST. Both bans are enforced by
 *       the validator, not by comment.
 * ===========================================================================
 */
export * from "./outcome-axes.js";
export * from "./injected-fault.js";
export * from "./correlation.js";
export * from "./condition.js";
export * from "./condition-evaluator.js";
export * from "./evidence-policy.js";
export * from "./remote-action.js";
export * from "./ir-v2.js";
export * from "./validate.js";
export * from "./canonicalize.js";
export * from "./legacy-migration.js";
export * from "./domain-leakage.js";
