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
  // 1.6.1 — the route dialog is retargeted at the arrangement the product
  //   actually renders. `route_row_*`, `route_list` and `route_dialog_confirm`
  //   were never on screen: the dialog is a Spinner (`dialog_spinner`) whose
  //   popup list carries NO id, rows share `android:id/text1`, and the confirm
  //   button is `yesButton`. Row identity is therefore the label the courier
  //   reads — `31 *` for a Serbian fiscal route, `31` elsewhere — bound from the
  //   projection rather than from the raw input. The offered read is narrowed by
  //   `matchKey`, which is what makes the row's index available at all, and the
  //   list is positioned by `scrollToItem` before the row is resolved: 9 of 253
  //   rows are on screen, so every route past the first screenful was
  //   unreachable, not merely hard to reach. The scroll step declares its own
  //   budget: the popup is a window the platform attaches after the tap returns,
  //   so a scroll issued in the same breath answers not_found and the same
  //   scroll succeeds a second later. How long a surface may take is a statement
  //   about the product, so it lives here.
  //
  // 1.5.0 — the fiscal marker is separated from route identity. Serbia shows
  //   fiscal-mandatory routes as `31 *`; the asterisk is a business rule, not a
  //   character of the code, and other countries offer the same route as `31`.
  //   The projection now reports `route_code`, `route_label` and
  //   `fiscal_required` separately and answers to either spelling.
  //
  // 1.4.1 — the offered-routes projection is bounded at 500, not 50: the device
  //   offers 253 routes and refused the read outright, and a truncated list would
  //   have answered "not offered" for a route that was.
  //
  // 1.4.0 — select-route reads the OFFERED routes (`nesy.offeredRoutes`) instead
  //   of the SELECTED one, and its condition addresses a column the projection
  //   actually has. The check could not pass before whatever the backend offered.
  //
  // 1.3.0 — the host now computes the pack's DERIVED facts, so open-stop's
  //   wrong-row guard and the tour-approval confirmation can be satisfied at all.
  //   open-stop's active-stop observation carries the stop identity the guard
  //   compares, and ACTIVE_STOP_MATCHES now compares against the input the macro
  //   actually declares (`requestedItemCode`) rather than a name nothing used.
  //
  // 1.2.0 — every independent workflow references exactly ONE macro. Signing in
  //   is a precondition installed by a launch profile, not a leg of the test:
  //   chaining it produced two expansion snapshots, which an empty canvas cannot
  //   auto-materialize, so five workflows could not compile at all — and it also
  //   would have reported a login defect as a route-selection failure.
  //
  // 1.1.0 — select-route and open-stop now OBSERVE the app-plane facts their
  //   oracles require (SDK_QUERY fact bindings), and select-route's confirm gate
  //   no longer waits on a fact produced two steps below it. Binding shape is now
  //   explicit about the question asked: a column, or whether the projection
  //   returned any row at all.
  //
  // Newest first. Every entry below is about ONE theme: the login slice used to
  // require evidence nothing produced, and each bump removed one such gap.
  //
  // 1.0.8 — the back-office read no longer aborts the run when it cannot be
  //   reached (`onUnavailable: RECORD_UNMEASURED`). It does not vote, so an
  //   outage must not turn a decidable login run into an automation failure.
  // 1.0.7 — a refused login is now its own fact (`APP.LOGIN_REJECTED`, from the
  //   app's `STATE_LOGIN_REJECTED` wire), and tap-submit's gate closes on EITHER
  //   outcome, so the run reaches its oracle instead of timing out and reporting
  //   "not enough evidence" for a product that answered clearly.
  // 1.0.6 — login OBSERVES the APP and LOCAL session planes with SDK_QUERY fact
  //   bindings instead of requiring facts no step produced, and
  //   `REMOTE.AUTH_ACCEPTED` drops to OPTIONAL because the mapped back-office
  //   read resolves the dashboard admin token rather than the courier's.
  version: { major: 1, minor: 6, patch: 1 },
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
