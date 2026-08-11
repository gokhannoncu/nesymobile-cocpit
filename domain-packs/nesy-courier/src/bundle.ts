/**
 * ===========================================================================
 *  Nesy Courier bundle assembly  (Plan D.6B · 4B.14)
 *
 *  One function, one manifest, one bundle. The manifest's `notResponsibleFor` is
 *  the field worth reading: a pack that lists only what it covers reads as
 *  covering everything, and the first escaped bug becomes an argument about scope
 *  instead of a triage.
 *
 *  `publicationState: "DRAFT"` and no provenance: this pack version has not been
 *  published, and `validateDomainPackBundle` would demand a matching digest if it
 *  claimed otherwise. Publication happens through `publishBundle`, which computes
 *  the digest, records provenance and deep-freezes the result — see the
 *  `publishes and freezes` test.
 * ===========================================================================
 */

import {
  DECLARATIVE_RUNTIME_CODE_POLICY,
  type DomainPackBundle,
  type DomainPackManifest,
} from "@nesy/domain-pack-contracts";
import { NESY_BACKOFFICE_ADAPTER } from "./adapters/backoffice.js";
import { NESY_COURIER_DERIVED_FACTS } from "./evidence/derived.js";
import { NESY_COURIER_EVIDENCE_SOURCES } from "./evidence/sources.js";
import { NESY_COMPLETE_DELIVERY_MACRO } from "./macros/complete-delivery.js";
import { NESY_GRANT_PERMISSION_MACRO, NESY_RECOVER_NETWORK_MACRO } from "./macros/interrupt-handlers.js";
import { NESY_LOGIN_MACRO } from "./macros/login.js";
import { NESY_OPEN_STOP_MACRO } from "./macros/open-stop.js";
import { NESY_PROCESS_PARCEL_MACRO } from "./macros/process-parcel.js";
import { NESY_SELECT_ROUTE_MACRO } from "./macros/select-route.js";
import { NESY_TOUR_APPROVAL_MACRO } from "./macros/tour-approval-lifecycle.js";
import { NESY_COURIER_LAUNCH_PROFILES } from "./profiles/launch.js";
import { NESY_COURIER_CAMPAIGNS, NESY_COURIER_TEST_PROFILES } from "./profiles/test-profiles.js";
import { NESY_COURIER_FRAGMENTS, NESY_COURIER_INDEPENDENT_WORKFLOWS } from "./profiles/workflows.js";
import { NESY_COURIER_SEMANTIC_ACTIONS } from "./registries/actions.js";
import { NESY_COURIER_APPLICATION, NESY_COURIER_APPLICATION_KEY } from "./registries/application.js";
import { NESY_COURIER_CAPABILITIES } from "./registries/capabilities.js";
import { NESY_COURIER_ENTITIES } from "./registries/entities.js";
import { NESY_COURIER_FEATURES } from "./registries/features.js";
import { NESY_COURIER_SCREENS } from "./registries/screens.js";
import { NESY_COURIER_SURFACES } from "./registries/surfaces.js";
import { NESY_COURIER_TARGETS } from "./registries/targets.js";

export const NESY_COURIER_PACK_KEY = "nesy.courier";

export const NESY_COURIER_MANIFEST: DomainPackManifest = {
  schemaVersion: 1,
  packKey: NESY_COURIER_PACK_KEY,
  packName: "Nesy Courier",
  // 1.0.6 — login observes the APP and LOCAL session planes with SDK_QUERY fact
  // bindings instead of requiring facts no step produced, and REMOTE.AUTH_ACCEPTED
  // drops to OPTIONAL because the mapped back-office read resolves the dashboard
  // admin token rather than the courier's. See `macros/login.ts`.
  version: { major: 1, minor: 0, patch: 6 },
  trustTier: "FIRST_PARTY",
  publicationState: "DRAFT",
  owner: "courier-mobile-quality",
  businessScope:
    "The courier's working day in the Nesy Courier mobile app: signing in, taking a route, opening stops, processing parcels, completing deliveries and getting the tour approved.",
  notResponsibleFor: [
    "the dispatcher's own back-office UI — only the typed operations this pack calls as a second actor",
    "payment, fiscal and settlement flows",
    "customer-facing tracking surfaces",
    "execution and scheduling: no run manifest, no queue, no lease lives in this pack",
    "any second tenant's business content",
  ],
  applicationRefs: [NESY_COURIER_APPLICATION_KEY],
  capabilityRequirements: [
    { capabilityRef: "verdict.core.bridge.tap", optional: false, reason: "Every slice acts on the UI." },
    { capabilityRef: "verdict.core.bridge.resolve-target", optional: false, reason: "Target resolution provider chain." },
    { capabilityRef: "domain.nesy.adapter.named-query", optional: false, reason: "Bounded projections back the evidence sources." },
    {
      capabilityRef: "domain.nesy.scanner.inject",
      optional: true,
      fallback: "DEGRADED_EVIDENCE",
      reason: "A device without the injection seam can fall back to the app's manual-entry surface.",
    },
    {
      capabilityRef: "domain.nesy.backoffice.approval-operations",
      optional: true,
      fallback: "SKIP_SLICE",
      reason: "Only TOUR_APPROVAL_LIFECYCLE needs the dispatcher operations; other slices run without them.",
    },
  ],
  dependencies: [],
  impactRefs: [
    { impactRef: "nesy.impact.stop-handling", kind: "FEATURE", note: "Pointer only; the impact graph itself is Phase 6 runtime state." },
    { impactRef: "nesy.impact.delivery-completion", kind: "FEATURE" },
    { impactRef: "nesy.impact.tour-approval", kind: "FEATURE" },
  ],
  resourceRequirementRefs: [
    { resourceRef: "nesy.resource.courier-account-pool", quantity: 1, exclusive: true, note: "A route may only be worked by one run at a time." },
    { resourceRef: "nesy.resource.android-device-class-a", quantity: 1, exclusive: true },
  ],
};

/** Assembles the full, validatable bundle. */
export function buildNesyCourierBundle(): DomainPackBundle {
  return {
    manifest: NESY_COURIER_MANIFEST,
    runtimeCodePolicy: DECLARATIVE_RUNTIME_CODE_POLICY,
    registries: {
      applications: [NESY_COURIER_APPLICATION],
      screens: NESY_COURIER_SCREENS,
      surfaces: NESY_COURIER_SURFACES,
      entities: NESY_COURIER_ENTITIES,
      targets: NESY_COURIER_TARGETS,
      evidenceSources: NESY_COURIER_EVIDENCE_SOURCES,
      derivedFacts: NESY_COURIER_DERIVED_FACTS,
      semanticActions: NESY_COURIER_SEMANTIC_ACTIONS,
      macros: [
        NESY_LOGIN_MACRO,
        NESY_SELECT_ROUTE_MACRO,
        NESY_OPEN_STOP_MACRO,
        NESY_PROCESS_PARCEL_MACRO,
        NESY_COMPLETE_DELIVERY_MACRO,
        NESY_TOUR_APPROVAL_MACRO,
        NESY_GRANT_PERMISSION_MACRO,
        NESY_RECOVER_NETWORK_MACRO,
      ],
      fragments: NESY_COURIER_FRAGMENTS,
      independentWorkflows: NESY_COURIER_INDEPENDENT_WORKFLOWS,
      launchProfiles: NESY_COURIER_LAUNCH_PROFILES,
      testProfiles: NESY_COURIER_TEST_PROFILES,
      campaigns: NESY_COURIER_CAMPAIGNS,
      features: NESY_COURIER_FEATURES,
      capabilities: NESY_COURIER_CAPABILITIES,
      remoteAdapters: [NESY_BACKOFFICE_ADAPTER],
    },
  };
}
