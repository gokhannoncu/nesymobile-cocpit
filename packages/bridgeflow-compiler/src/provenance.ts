/**
 * Provenance and capability manifest construction  (Plan D.7 · Phase 4C)
 */

import type { BridgeCapabilityManifest } from "@nesy/bridge-contract";
import type {
  DomainPackCapabilityRequirement,
} from "@nesy/domain-pack-contracts";
import type {
  CompiledCapabilityManifest,
  CompiledCapabilityRequirement,
  CompiledCapabilityGap,
} from "./bridgeflow-plan.js";
import type { CompileIssue } from "./compile-issues.js";
import { createIssue } from "./compile-issues.js";

/**
 * Build a compiled capability manifest by resolving pack requirements
 * against the device's actual capabilities.
 */
export function buildCapabilityManifest(
  packRequirements: readonly DomainPackCapabilityRequirement[],
  stepRequirements: readonly CompiledCapabilityRequirement[],
  deviceCapabilities: BridgeCapabilityManifest,
  issues: CompileIssue[],
): CompiledCapabilityManifest {
  const required: CompiledCapabilityRequirement[] = [];
  const optional: CompiledCapabilityRequirement[] = [];
  const gaps: CompiledCapabilityGap[] = [];

  const allRequirements = [
    ...packRequirements.map((r) => ({
      capability: r.capabilityRef,
      optional: r.optional,
      fallback: r.fallback,
      sourceRef: "pack-manifest",
    })),
    ...stepRequirements,
  ];

  const seen = new Set<string>();

  for (const req of allRequirements) {
    if (seen.has(req.capability)) continue;
    seen.add(req.capability);

    const available = isCapabilityAvailable(req.capability, deviceCapabilities);

    if (req.optional) {
      optional.push(req);
    } else {
      required.push(req);
    }

    if (!available) {
      if (!req.optional) {
        gaps.push({
          capability: req.capability,
          reason: `Required capability "${req.capability}" not available on device`,
          severity: "ERROR",
          fallback: req.fallback,
        });
        issues.push(
          createIssue("MISSING_CAPABILITY", `Required capability "${req.capability}" is not available`, {
            sourceRef: req.sourceRef,
          }),
        );
      } else if (req.fallback) {
        gaps.push({
          capability: req.capability,
          reason: `Optional capability "${req.capability}" not available; using fallback "${req.fallback}"`,
          severity: "WARNING",
          fallback: req.fallback,
        });
      }
    }
  }

  return { required, optional, gaps };
}

function isCapabilityAvailable(
  capability: string,
  deviceCapabilities: BridgeCapabilityManifest,
): boolean {
  // Core Bridge capabilities
  if (capability === "verdict.core.wait_any") return deviceCapabilities.supportsWaitAny;
  if (capability === "verdict.core.cancel_request") return deviceCapabilities.supportsCancelRequest;
  if (capability === "verdict.core.unsolicited_push") return deviceCapabilities.supportsUnsolicitedPush;

  // Bridge commands
  if (capability.startsWith("verdict.core.command.")) {
    const cmd = capability.replace("verdict.core.command.", "");
    return deviceCapabilities.commands.includes(cmd as never);
  }

  // Domain/custom capabilities are assumed available unless we know otherwise
  return true;
}
