/**
 * Capability-aware compilation  (Plan D.7 · B-13 · Phase 4C)
 *
 * When a plan step requires a capability the device doesn't have,
 * the compiler must either:
 *   - Produce a fallback plan (e.g., SEQUENTIAL_LEGS for wait_any)
 *   - Produce a compile error
 *
 * This is the B-13 model: Bridge v1 devices lack certain capabilities,
 * and the compiler handles that at compile time, not at runtime.
 */

import type { BridgeCapabilityManifest } from "@nesy/bridge-contract";
import type { WorkflowCapabilityRequirement } from "@nesy/workflow-contract";
import type { WaitCapabilityFallback } from "./ui-wait-plan.js";
import type { CompileIssue } from "./compile-issues.js";
import { createIssue } from "./compile-issues.js";

/**
 * Resolve wait_any capability: if not available, apply fallback.
 */
export function resolveWaitAnyCapability(
  deviceCapabilities: BridgeCapabilityManifest,
  capabilityReqs: readonly WorkflowCapabilityRequirement[],
  issues: CompileIssue[],
): WaitCapabilityFallback[] {
  const fallbacks: WaitCapabilityFallback[] = [];

  const waitAnyReq = capabilityReqs.find((r) => r.capability === "verdict.core.wait_any");
  if (waitAnyReq && !deviceCapabilities.supportsWaitAny) {
    if (waitAnyReq.optional && waitAnyReq.fallback) {
      fallbacks.push({
        capability: "verdict.core.wait_any",
        available: false,
        fallback: waitAnyReq.fallback,
      });
    } else if (!waitAnyReq.optional) {
      issues.push(
        createIssue(
          "WAIT_ANY_CAPABILITY_MISSING",
          "wait_any capability required but device does not support it; no fallback declared",
        ),
      );
    }
  }

  const cancelReq = capabilityReqs.find((r) => r.capability === "verdict.core.cancel_request");
  if (cancelReq && !deviceCapabilities.supportsCancelRequest) {
    if (cancelReq.optional && cancelReq.fallback) {
      fallbacks.push({
        capability: "verdict.core.cancel_request",
        available: false,
        fallback: cancelReq.fallback,
      });
    } else if (!cancelReq.optional) {
      issues.push(
        createIssue(
          "CANCEL_REQUEST_CAPABILITY_MISSING",
          "cancel_request capability required but device does not support it",
        ),
      );
    }
  }

  return fallbacks;
}

/**
 * Check app version compatibility.
 */
export function checkAppVersionCompatibility(
  appRefs: readonly string[],
  bundleAppRefs: readonly string[],
  issues: CompileIssue[],
): void {
  for (const ref of appRefs) {
    if (!bundleAppRefs.includes(ref)) {
      issues.push(
        createIssue(
          "APP_VERSION_INCOMPATIBLE",
          `Application ref "${ref}" not found in the domain pack bundle`,
          { path: `appCompatibilityRefs`, sourceRef: ref },
        ),
      );
    }
  }
}

/**
 * Check adapter compatibility.
 */
export function checkAdapterCompatibility(
  adapterRefs: readonly string[],
  bundleAdapterRefs: readonly string[],
  issues: CompileIssue[],
): void {
  for (const ref of adapterRefs) {
    if (!bundleAdapterRefs.includes(ref)) {
      issues.push(
        createIssue(
          "ADAPTER_INCOMPATIBLE",
          `Adapter ref "${ref}" not found in the domain pack bundle`,
          { path: `adapterCompatibilityRefs`, sourceRef: ref },
        ),
      );
    }
  }
}
