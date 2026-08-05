/**
 * Compiled UiWaitPlan contract  (Plan B.10D · Phase 4C)
 *
 * A compiled UiWaitPlan is the compiler's instruction to Phase 5's executor
 * about what UI surfaces to expect, what interrupts to handle, and how to
 * bound the wait. The compiler produces the plan; it never executes it.
 *
 * Key rules:
 *   NO FULL DUMP HOT PATH — diagnostic capture is a separate artifact path.
 *   BOUNDED — every wait has deadlineMs and maxLegs.
 *   CAPABILITY-AWARE — wait_any/cancel_request fallback when unavailable.
 */

import type { BridgeSelector, UiWaitUntil } from "@nesy/bridge-contract";

/** A compiled UI predicate: what to look for on the screen. */
export interface CompiledUiPredicate {
  selector: BridgeSelector;
  until: UiWaitUntil;
  stableForMs?: number;
}

/** A compiled expected target in the wait plan. */
export interface CompiledUiWaitTarget {
  key: string;
  predicate: CompiledUiPredicate;
  /** Screen/surface registry ref this target came from. */
  sourceRef?: string;
  /** Whether this target is the primary expected outcome. */
  primary?: boolean;
}

/** A compiled interrupt target — surfaces that may appear unexpectedly. */
export interface CompiledUiInterruptTarget {
  key: string;
  predicate: CompiledUiPredicate;
  /** Whether this interrupt is expected to appear. */
  expected: boolean;
  /** Surface ref from the domain pack's interrupt policy. */
  surfaceRef?: string;
  /** What to do when this interrupt fires. */
  onInterrupt: "HANDLE" | "FATAL" | "OPERATOR_ATTENTION";
}

/** Ambiguity policy for the wait plan. */
export type WaitPlanAmbiguityPolicy = "FAIL" | "OPERATOR_ATTENTION" | "BEST_MATCH";

/** Capability fallback for wait_any/cancel_request when Bridge lacks support. */
export interface WaitCapabilityFallback {
  capability: string;
  available: boolean;
  fallback: "SEQUENTIAL_LEGS" | "HOST_ONLY_CANCEL" | "SKIP_STEP" | "FAIL_FAST";
  compileIssueRef?: string;
}

/** The compiled UiWaitPlan — one per WAIT_ANY/wait-bearing step. */
export interface CompiledUiWaitPlan {
  /** Unique id within the plan, referenced from BridgeFlowPlanStep. */
  waitPlanId: string;
  /** IR step this wait belongs to. */
  planStepId: string;
  /** Source map ref for tracing. */
  sourceMapRef: string;
  /** Expected surfaces/targets. */
  expected: readonly CompiledUiWaitTarget[];
  /** Interrupt surfaces. */
  interrupts: readonly CompiledUiInterruptTarget[];
  /** Upper bound on total wait time. */
  deadlineMs: number;
  /** Stability window — how long the target must be stable. */
  stableForMs?: number;
  /** Maximum candidates to consider during matching. */
  candidateLimit?: number;
  /** Maximum legs (for wait_any with multiple surfaces). */
  maxLegs: number;
  /** Priority for tie-breaking when multiple waits are active. */
  priority?: number;
  /** Ambiguity policy when multiple targets match. */
  ambiguityPolicy: WaitPlanAmbiguityPolicy;
  /** Whether cancel_request can only come from host. */
  hostOnlyCancel: boolean;
  /** Capability fallbacks for this wait. */
  capabilityFallbacks: readonly WaitCapabilityFallback[];
  /** Diagnostic-only: NO full dump hot path. This is a separate artifact. */
  diagnosticCaptureArtifactPath?: string;
}

/**
 * Full-dump hot path guard.
 *
 * The compiler must never produce a plan where the primary evaluation
 * path relies on a full accessibility dump. Diagnostic capture is allowed
 * as a SEPARATE ARTIFACT only.
 */
export const FULL_DUMP_HOT_PATH_FORBIDDEN = true;
