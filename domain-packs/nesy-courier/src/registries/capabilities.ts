/**
 * ===========================================================================
 *  Nesy Courier capability catalog  (Plan D.6B · 4B.15)
 *
 *  Two layers: `verdict.core` for platform capabilities and `domain.nesy` for
 *  this pack's App Adapter and back-office seams.
 *
 *  A Nesy reference pack must not contain another customer's layer. Cross-domain
 *  portability is proven by the shared `domain.<pack>` contract and synthetic
 *  contract fixtures, not by carrying foreign tenant capabilities inside this
 *  repository.
 * ===========================================================================
 */

import type { CapabilityContract } from "@nesy/domain-pack-contracts";

/** Platform capabilities — nothing here mentions couriers. */
const CORE_CAPABILITIES: readonly CapabilityContract[] = [
  {
    capabilityKey: "verdict.core.bridge.tap",
    layer: "verdict.core",
    provider: "BRIDGE",
    displayName: "Bridge tap",
    description: "Perform a tap on a resolved target.",
    runtimeDetected: true,
    detectionRef: "bridge.capabilities.tap",
    automationOnly: false,
  },
  {
    capabilityKey: "verdict.core.bridge.set-text",
    layer: "verdict.core",
    provider: "BRIDGE",
    displayName: "Bridge setText",
    description: "Set text on a resolved input target.",
    runtimeDetected: true,
    detectionRef: "bridge.capabilities.setText",
    automationOnly: false,
  },
  {
    capabilityKey: "verdict.core.bridge.resolve-target",
    layer: "verdict.core",
    provider: "BRIDGE",
    displayName: "Target resolution",
    description: "Resolve a logical target to a fingerprinted device node.",
    runtimeDetected: true,
    detectionRef: "bridge.capabilities.resolveTarget",
    automationOnly: false,
  },
  {
    capabilityKey: "verdict.core.bridge.watch-fact",
    layer: "verdict.core",
    provider: "BRIDGE",
    displayName: "UI fact watch",
    description: "Observe a UI-plane readiness fact without polling a sleep.",
    runtimeDetected: true,
    detectionRef: "bridge.capabilities.watch",
    automationOnly: false,
  },
  {
    capabilityKey: "verdict.core.adapter.named-query",
    layer: "verdict.core",
    provider: "APP_ADAPTER",
    displayName: "Named query",
    description: "Execute a bounded, allowlisted named query inside the app under test.",
    runtimeDetected: true,
    detectionRef: "adapter.capabilities.namedQuery",
    automationOnly: true,
  },
  {
    capabilityKey: "verdict.core.remote.allowlisted-operation",
    layer: "verdict.core",
    provider: "BACKOFFICE_ADAPTER",
    displayName: "Allowlisted remote operation",
    description: "Invoke a typed, audited operation in an allowlisted backend adapter.",
    runtimeDetected: false,
    automationOnly: false,
  },
];

/** Nesy-specific seams. Every automation-only one names its release guard. */
const NESY_CAPABILITIES: readonly CapabilityContract[] = [
  {
    capabilityKey: "domain.nesy.adapter.named-query",
    layer: "domain.nesy",
    provider: "APP_ADAPTER",
    displayName: "Nesy named queries",
    description: "Bounded read of route/task/shipment projections from the courier app.",
    runtimeDetected: true,
    detectionRef: "nesy.adapter.capabilities.namedQuery",
    automationOnly: true,
  },
  {
    capabilityKey: "domain.nesy.adapter.state-projection",
    layer: "domain.nesy",
    provider: "APP_ADAPTER",
    displayName: "Nesy state projection",
    description: "Read a bounded projection of the courier app's own state providers.",
    runtimeDetected: true,
    detectionRef: "nesy.adapter.capabilities.stateProjection",
    automationOnly: true,
  },
  {
    capabilityKey: "domain.nesy.adapter.event-stream",
    layer: "domain.nesy",
    provider: "APP_ADAPTER",
    displayName: "Nesy critical event stream",
    description: "Subscribe to the courier app's structured critical-event seam.",
    runtimeDetected: true,
    detectionRef: "nesy.adapter.capabilities.eventStream",
    automationOnly: true,
  },
  {
    capabilityKey: "domain.nesy.adapter.session-prepared",
    layer: "domain.nesy",
    provider: "APP_ADAPTER",
    displayName: "Prepared session",
    description: "Install an already-authenticated session, skipping the login screens.",
    runtimeDetected: true,
    detectionRef: "nesy.adapter.capabilities.preparedSession",
    automationOnly: true,
  },
  {
    capabilityKey: "domain.nesy.adapter.direct-state",
    layer: "domain.nesy",
    provider: "APP_ADAPTER",
    displayName: "Direct state preparation",
    description: "Write a bounded business precondition directly, skipping the UI path that creates it.",
    runtimeDetected: true,
    detectionRef: "nesy.adapter.capabilities.directState",
    automationOnly: true,
  },
  {
    capabilityKey: "domain.nesy.adapter.release-isolation",
    layer: "domain.nesy",
    provider: "APP_ADAPTER",
    displayName: "Release isolation assertion",
    description: "Assert at run time that automation-only seams are absent from a non-automation build.",
    runtimeDetected: true,
    detectionRef: "nesy.adapter.capabilities.releaseIsolation",
    automationOnly: false,
  },
  {
    capabilityKey: "domain.nesy.scanner.inject",
    layer: "domain.nesy",
    provider: "APP_ADAPTER",
    displayName: "Scanner injection",
    description: "Feed a scan payload to the app as if the camera had read it.",
    runtimeDetected: true,
    detectionRef: "nesy.adapter.capabilities.scannerInject",
    automationOnly: true,
  },
  {
    capabilityKey: "domain.nesy.scanner.manual-entry",
    layer: "domain.nesy",
    provider: "APP_ADAPTER",
    displayName: "Manual scan entry fallback",
    description: "Enter a scan payload through the app's own manual-entry surface when injection is unavailable.",
    runtimeDetected: true,
    detectionRef: "nesy.adapter.capabilities.manualEntry",
    automationOnly: false,
  },
  {
    capabilityKey: "domain.nesy.backoffice.approval-operations",
    layer: "domain.nesy",
    provider: "BACKOFFICE_ADAPTER",
    displayName: "Nesy back-office approval operations",
    description: "Typed, audited dispatcher/supervisor operations used by multi-actor slices.",
    runtimeDetected: false,
    automationOnly: false,
  },
];

export const NESY_COURIER_CAPABILITIES: readonly CapabilityContract[] = [
  ...CORE_CAPABILITIES,
  ...NESY_CAPABILITIES,
];
