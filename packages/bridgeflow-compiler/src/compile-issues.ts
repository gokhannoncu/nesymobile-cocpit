/**
 * Compile issue codes  (Plan D.7 · Phase 4C)
 *
 * Every validation check the compiler performs has a distinct code.
 * Issues are COLLECTED, never first-error-only: the compiler reports
 * everything it finds so the author can fix multiple problems in one pass.
 */

/** Issue severity. */
export type CompileIssueSeverity = "ERROR" | "WARNING" | "INFO";

/** All compile issue codes — closed union. */
export type CompileIssueCode =
  // Domain macro validation (4C.7)
  | "UNKNOWN_MACRO"
  | "UNKNOWN_ACTION"
  | "UNKNOWN_REGISTRY_REF"
  | "MACRO_OUTSIDE_GENERIC_IR"
  | "MACRO_ENTITY_INPUT_UNTYPED"
  | "MACRO_MISSING_PRECONDITION"
  | "MACRO_EXPANSION_MISMATCH"
  // WorkflowIR validation (4C.8)
  | "UNKNOWN_STEP_KIND"
  | "INVALID_STEP_REFERENCE"
  | "UNREACHABLE_STEP"
  | "MISSING_SOURCE_MAP_ENTRY"
  // Control flow (4C.9)
  | "UNBOUNDED_FOR_EACH"
  | "UNBOUNDED_WAIT"
  | "FIXED_WAIT_FORBIDDEN"
  | "UNSAFE_NON_IDEMPOTENT_RETRY"
  | "MISSING_SWITCH_DEFAULT"
  | "OVERLAPPING_BRANCHES"
  // Target validation (4C.10)
  | "AMBIGUOUS_TARGET"
  | "WEAK_TARGET_ROW_INDEX"
  | "WEAK_TARGET_TEXT_ONLY"
  | "TARGET_DRIFT_DETECTED"
  | "TARGET_FINGERPRINT_MISSING"
  // UiWaitPlan (4C.11)
  | "WAIT_PLAN_UNBOUNDED"
  | "FULL_DUMP_HOT_PATH"
  | "MISSING_EXPECTED_TARGET"
  | "MISSING_INTERRUPT_POLICY"
  // Capability (4C.12)
  | "MISSING_CAPABILITY"
  | "CAPABILITY_FALLBACK_REQUIRED"
  | "WAIT_ANY_CAPABILITY_MISSING"
  | "CANCEL_REQUEST_CAPABILITY_MISSING"
  | "APP_VERSION_INCOMPATIBLE"
  | "ADAPTER_INCOMPATIBLE"
  // Evidence (4C.13)
  | "CONTINUE_GATE_FINAL_ORACLE_MERGED"
  | "PARALLEL_ORACLE_LISTS"
  | "MISSING_EVIDENCE_SOURCE"
  | "MISSING_EVIDENCE_CAPABILITY"
  | "HTTP_2XX_AS_BUSINESS_SUCCESS"
  | "ORDERED_REQUIRED_RECEIPT_ONLY_GATE"
  | "MISSING_EVIDENCE_CORRELATION"
  | "MISSING_EVIDENCE_FRESHNESS"
  | "DERIVED_GRAPH_DIGEST_MISSING"
  // Profile (4C.14)
  | "PROFILE_REQUESTS_NEW_RUNNER"
  | "PROFILE_REQUESTS_NEW_ENGINE"
  | "FRAGMENT_PRODUCES_VERDICT"
  | "FAULT_WITHOUT_CORRELATION"
  | "DIFFERENTIAL_WITHOUT_BASELINE"
  | "DEPENDENCY_MODELED_AS_FAILED"
  // Leakage (4C.19)
  | "DOMAIN_BUSINESS_TOKEN_IN_EXPORT"
  | "COMPILER_EXECUTOR_EXPORT";

/** One compile issue. */
export interface CompileIssue {
  code: CompileIssueCode;
  severity: CompileIssueSeverity;
  message: string;
  /** Path to the offending element. */
  path?: string;
  /** Source-map ref for tracing back to domain. */
  sourceRef?: string;
  /** Suggested fix, when available. */
  suggestion?: string;
}

/** Issue severity mapping — which codes are errors vs warnings. */
export const COMPILE_ISSUE_SEVERITIES: Readonly<Record<CompileIssueCode, CompileIssueSeverity>> = {
  // Errors — compilation cannot produce a valid plan
  UNKNOWN_MACRO: "ERROR",
  UNKNOWN_ACTION: "ERROR",
  UNKNOWN_REGISTRY_REF: "ERROR",
  MACRO_OUTSIDE_GENERIC_IR: "ERROR",
  MACRO_ENTITY_INPUT_UNTYPED: "ERROR",
  MACRO_MISSING_PRECONDITION: "ERROR",
  MACRO_EXPANSION_MISMATCH: "WARNING",
  UNKNOWN_STEP_KIND: "ERROR",
  INVALID_STEP_REFERENCE: "ERROR",
  UNREACHABLE_STEP: "ERROR",
  MISSING_SOURCE_MAP_ENTRY: "ERROR",
  UNBOUNDED_FOR_EACH: "ERROR",
  UNBOUNDED_WAIT: "ERROR",
  FIXED_WAIT_FORBIDDEN: "ERROR",
  UNSAFE_NON_IDEMPOTENT_RETRY: "ERROR",
  MISSING_SWITCH_DEFAULT: "ERROR",
  OVERLAPPING_BRANCHES: "WARNING",
  AMBIGUOUS_TARGET: "ERROR",
  WEAK_TARGET_ROW_INDEX: "WARNING",
  WEAK_TARGET_TEXT_ONLY: "WARNING",
  TARGET_DRIFT_DETECTED: "WARNING",
  TARGET_FINGERPRINT_MISSING: "ERROR",
  WAIT_PLAN_UNBOUNDED: "ERROR",
  FULL_DUMP_HOT_PATH: "ERROR",
  MISSING_EXPECTED_TARGET: "ERROR",
  MISSING_INTERRUPT_POLICY: "ERROR",
  MISSING_CAPABILITY: "ERROR",
  CAPABILITY_FALLBACK_REQUIRED: "ERROR",
  WAIT_ANY_CAPABILITY_MISSING: "ERROR",
  CANCEL_REQUEST_CAPABILITY_MISSING: "WARNING",
  APP_VERSION_INCOMPATIBLE: "ERROR",
  ADAPTER_INCOMPATIBLE: "ERROR",
  CONTINUE_GATE_FINAL_ORACLE_MERGED: "ERROR",
  PARALLEL_ORACLE_LISTS: "ERROR",
  MISSING_EVIDENCE_SOURCE: "ERROR",
  MISSING_EVIDENCE_CAPABILITY: "ERROR",
  HTTP_2XX_AS_BUSINESS_SUCCESS: "ERROR",
  ORDERED_REQUIRED_RECEIPT_ONLY_GATE: "ERROR",
  MISSING_EVIDENCE_CORRELATION: "WARNING",
  MISSING_EVIDENCE_FRESHNESS: "WARNING",
  DERIVED_GRAPH_DIGEST_MISSING: "ERROR",
  PROFILE_REQUESTS_NEW_RUNNER: "ERROR",
  PROFILE_REQUESTS_NEW_ENGINE: "ERROR",
  FRAGMENT_PRODUCES_VERDICT: "ERROR",
  FAULT_WITHOUT_CORRELATION: "ERROR",
  DIFFERENTIAL_WITHOUT_BASELINE: "ERROR",
  DEPENDENCY_MODELED_AS_FAILED: "ERROR",
  DOMAIN_BUSINESS_TOKEN_IN_EXPORT: "ERROR",
  COMPILER_EXECUTOR_EXPORT: "ERROR",
};

/** Helper: create an issue with auto-severity. */
export function createIssue(
  code: CompileIssueCode,
  message: string,
  options?: { path?: string; sourceRef?: string; suggestion?: string },
): CompileIssue {
  return {
    code,
    severity: COMPILE_ISSUE_SEVERITIES[code],
    message,
    ...options,
  };
}

/** Whether the issue list contains at least one error. */
export function hasErrors(issues: readonly CompileIssue[]): boolean {
  return issues.some((i) => i.severity === "ERROR");
}
