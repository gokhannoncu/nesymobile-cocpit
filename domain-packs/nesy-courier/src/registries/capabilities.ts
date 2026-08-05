/**
 * ===========================================================================
 *  Nesy Courier capability catalog  (Plan D.6B · 4B.15)
 *
 *  Three layers, deliberately: `verdict.core` for what every tenant needs,
 *  `nesy` for this tenant's App Adapter and back-office seams, and a single
 *  `mackolik` entry.
 *
 *  That last one is not filler. A catalog with one tenant looks identical to a
 *  catalog with no tenant concept at all, and the first time a second tenant
 *  arrives, `nesy`-shaped assumptions have already hardened into the core layer.
 *  One foreign entry keeps the layering honest and gives the promotion rule
 *  something to be tested against.
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
    capabilityKey: "nesy.adapter.named-query",
    layer: "nesy",
    provider: "APP_ADAPTER",
    displayName: "Nesy named queries",
    description: "Bounded read of route/task/shipment projections from the courier app.",
    runtimeDetected: true,
    detectionRef: "nesy.adapter.capabilities.namedQuery",
    automationOnly: true,
  },
  {
    capabilityKey: "nesy.adapter.state-projection",
    layer: "nesy",
    provider: "APP_ADAPTER",
    displayName: "Nesy state projection",
    description: "Read a bounded projection of the courier app's own state providers.",
    runtimeDetected: true,
    detectionRef: "nesy.adapter.capabilities.stateProjection",
    automationOnly: true,
  },
  {
    capabilityKey: "nesy.adapter.event-stream",
    layer: "nesy",
    provider: "APP_ADAPTER",
    displayName: "Nesy critical event stream",
    description: "Subscribe to the courier app's structured critical-event seam.",
    runtimeDetected: true,
    detectionRef: "nesy.adapter.capabilities.eventStream",
    automationOnly: true,
  },
  {
    capabilityKey: "nesy.adapter.session-prepared",
    layer: "nesy",
    provider: "APP_ADAPTER",
    displayName: "Prepared session",
    description: "Install an already-authenticated session, skipping the login screens.",
    runtimeDetected: true,
    detectionRef: "nesy.adapter.capabilities.preparedSession",
    automationOnly: true,
  },
  {
    capabilityKey: "nesy.adapter.direct-state",
    layer: "nesy",
    provider: "APP_ADAPTER",
    displayName: "Direct state preparation",
    description: "Write a bounded business precondition directly, skipping the UI path that creates it.",
    runtimeDetected: true,
    detectionRef: "nesy.adapter.capabilities.directState",
    automationOnly: true,
  },
  {
    capabilityKey: "nesy.adapter.release-isolation",
    layer: "nesy",
    provider: "APP_ADAPTER",
    displayName: "Release isolation assertion",
    description: "Assert at run time that automation-only seams are absent from a non-automation build.",
    runtimeDetected: true,
    detectionRef: "nesy.adapter.capabilities.releaseIsolation",
    automationOnly: false,
  },
  {
    capabilityKey: "nesy.scanner.inject",
    layer: "nesy",
    provider: "APP_ADAPTER",
    displayName: "Scanner injection",
    description: "Feed a scan payload to the app as if the camera had read it.",
    runtimeDetected: true,
    detectionRef: "nesy.adapter.capabilities.scannerInject",
    automationOnly: true,
  },
  {
    capabilityKey: "nesy.scanner.manual-entry",
    layer: "nesy",
    provider: "APP_ADAPTER",
    displayName: "Manual scan entry fallback",
    description: "Enter a scan payload through the app's own manual-entry surface when injection is unavailable.",
    runtimeDetected: true,
    detectionRef: "nesy.adapter.capabilities.manualEntry",
    automationOnly: false,
  },
  {
    capabilityKey: "nesy.backoffice.approval-operations",
    layer: "nesy",
    provider: "BACKOFFICE_ADAPTER",
    displayName: "Nesy back-office approval operations",
    description: "Typed, audited dispatcher/supervisor operations used by multi-actor slices.",
    runtimeDetected: false,
    automationOnly: false,
  },
];

/**
 * The second tenant.
 *
 * Present so the layering is exercised rather than asserted. See the header.
 */
const MACKOLIK_CAPABILITIES: readonly CapabilityContract[] = [
  {
    capabilityKey: "mackolik.adapter.named-query",
    layer: "mackolik",
    provider: "APP_ADAPTER",
    displayName: "Maçkolik named queries",
    description: "Second-tenant named query seam; declared here only to keep the catalog layered.",
    runtimeDetected: true,
    detectionRef: "mackolik.adapter.capabilities.namedQuery",
    automationOnly: true,
  },
];

export const NESY_COURIER_CAPABILITIES: readonly CapabilityContract[] = [
  ...CORE_CAPABILITIES,
  ...NESY_CAPABILITIES,
  ...MACKOLIK_CAPABILITIES,
];
