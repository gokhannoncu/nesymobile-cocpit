/**
 * ===========================================================================
 *  Nesy Courier feature blueprints  (Plan D.6B · 4B.15)
 *
 *  Each blueprint is deliberately split in two. `authoring` holds prose that can
 *  be edited freely; `executable` holds what actually decides behaviour, and the
 *  digest is computed over the executable half ALONE.
 *
 *  So fixing a typo in a description provably does not move the digest, and
 *  changing an invariant provably does. Without that split, every wording edit
 *  would invalidate pinned runs, the executable diff would be buried in wording
 *  churn, and the review that was meant to catch behaviour changes would stop
 *  being read.
 *
 *  The `AI_SUGGESTED` invariant on the delivery feature is intentional and
 *  intentionally non-gating. An AI-proposed rule is a useful starting point and
 *  an unaccountable gate: nobody agreed to it, so when it fails at 2am there is
 *  no one who can say whether the failure matters. `bindsReleaseGate: false` is
 *  the only value `validateFeatureBlueprint` accepts for it.
 * ===========================================================================
 */

import {
  computeFeatureExecutableDigest,
  type FeatureBlueprint,
  type FeatureExecutableContract,
} from "@nesy/domain-pack-contracts";
import { NESY_COURIER_APPLICATION_KEY } from "./application.js";
import { NESY_FACTS } from "./facts.js";
import { NESY_SCREENS, NESY_SURFACES } from "./screens.js";

const APP = NESY_COURIER_APPLICATION_KEY;

/** Pairs an executable contract with its recomputed digest, never a literal. */
function blueprint(
  executable: FeatureExecutableContract,
  authoring: FeatureBlueprint["authoring"],
): FeatureBlueprint {
  return {
    featureKey: executable.featureKey,
    authoring,
    executable,
    executableDigest: computeFeatureExecutableDigest(executable),
  };
}

const STOP_HANDLING_EXECUTABLE: FeatureExecutableContract = {
  featureKey: "nesy.feature.stop-handling",
  contractVersion: 1,
  applicationRef: APP,
  macroRefs: ["nesy.macro.open-stop", "nesy.macro.select-route"],
  workflowRefs: ["nesy.workflow.open-stop", "nesy.workflow.select-route"],
  invariants: [
    {
      invariantKey: "nesy.invariant.opened-stop-is-requested-stop",
      statement: "The stop the app treats as active is always the stop the run asked for.",
      // A human owns this rule, so it may block a ship.
      authority: "PRODUCT_APPROVED",
      factKeys: [NESY_FACTS.ACTIVE_STOP_MATCHES, NESY_FACTS.ACTIVE_STOP_OBSERVED],
      bindsReleaseGate: true,
    },
    {
      invariantKey: "nesy.invariant.stop-list-loaded-before-action",
      statement: "No stop row is touched before the available-stops projection has loaded.",
      authority: "TECHNICAL_DEFAULT",
      factKeys: [NESY_FACTS.AVAILABLE_STOPS_LOADED],
      bindsReleaseGate: true,
    },
  ],
  requiredCapabilityRefs: [
    "verdict.core.bridge.tap",
    "verdict.core.bridge.resolve-target",
    "nesy.adapter.named-query",
  ],
  screenRefs: [NESY_SCREENS.routeStopList, NESY_SCREENS.stopTaskList],
  surfaceRefs: [NESY_SURFACES.routeSelectionDialog],
  notResponsibleFor: [
    "stop list ordering and route optimisation",
    "the work performed inside an opened stop",
  ],
};

const DELIVERY_EXECUTABLE: FeatureExecutableContract = {
  featureKey: "nesy.feature.delivery-completion",
  contractVersion: 1,
  applicationRef: APP,
  macroRefs: ["nesy.macro.process-parcel", "nesy.macro.complete-delivery"],
  workflowRefs: ["nesy.workflow.process-parcel", "nesy.workflow.complete-delivery"],
  invariants: [
    {
      invariantKey: "nesy.invariant.delivery-reaches-backend",
      statement:
        "Every completed delivery is eventually recorded by the backend for the same shipment, online or after the queue drains.",
      authority: "PRODUCT_APPROVED",
      factKeys: [NESY_FACTS.DELIVERY_CONFIRMED, NESY_FACTS.DELIVERY_SUBMITTED],
      bindsReleaseGate: true,
    },
    {
      // AI_SUGGESTED and therefore non-gating. See the file header.
      invariantKey: "nesy.invariant.queue-drains-within-five-minutes",
      statement: "A queued delivery operation drains within five minutes of connectivity returning.",
      authority: "AI_SUGGESTED",
      factKeys: [NESY_FACTS.OFFLINE_QUEUE_DRAINED, NESY_FACTS.OFFLINE_QUEUE_ITEM_WAITING],
      bindsReleaseGate: false,
    },
  ],
  requiredCapabilityRefs: [
    "verdict.core.bridge.tap",
    "verdict.core.remote.allowlisted-operation",
    "nesy.scanner.inject",
    "nesy.adapter.named-query",
  ],
  screenRefs: [NESY_SCREENS.deliveryFlow],
  surfaceRefs: [NESY_SURFACES.scannerSurface, NESY_SURFACES.paymentSurface, NESY_SURFACES.fiscalSurface],
  notResponsibleFor: ["payment collection", "fiscal receipts", "failure and cancellation reason codes"],
};

const TOUR_APPROVAL_EXECUTABLE: FeatureExecutableContract = {
  featureKey: "nesy.feature.tour-approval",
  contractVersion: 1,
  applicationRef: APP,
  macroRefs: ["nesy.macro.tour-approval-lifecycle"],
  workflowRefs: ["nesy.workflow.tour-approval-lifecycle"],
  invariants: [
    {
      invariantKey: "nesy.invariant.approval-needs-two-backend-facts",
      statement:
        "A tour counts as approved only when the request record exists AND its status is APPROVED, correlated to the courier's own request.",
      authority: "PRODUCT_APPROVED",
      factKeys: [
        NESY_FACTS.TOUR_APPROVAL_REQUEST_CREATED,
        NESY_FACTS.TOUR_APPROVAL_STATUS_APPROVED,
        NESY_FACTS.TOUR_APPROVAL_CONFIRMED,
      ],
      bindsReleaseGate: true,
    },
  ],
  requiredCapabilityRefs: ["verdict.core.remote.allowlisted-operation", "nesy.backoffice.approval-operations"],
  screenRefs: [NESY_SCREENS.endOfDay],
  surfaceRefs: [],
  notResponsibleFor: [
    "dispatcher authorisation rules",
    "rejection and rework flows",
    "push notification delivery reliability",
  ],
};

export const NESY_COURIER_FEATURES: readonly FeatureBlueprint[] = [
  blueprint(STOP_HANDLING_EXECUTABLE, {
    displayName: "Stop handling",
    description: "Selecting a route and opening the correct stop from the route list.",
    owner: "courier-mobile-quality",
    tags: ["core-journey", "targeting"],
    referenceLinks: ["nesy://spec/stop-handling"],
    reviewNotes: ["Reviewed against 2026-06 design revision 3."],
  }),
  blueprint(DELIVERY_EXECUTABLE, {
    displayName: "Delivery completion",
    description: "Scanning parcels and completing deliveries, including the offline queue path.",
    owner: "courier-mobile-quality",
    tags: ["core-journey", "offline"],
    referenceLinks: ["nesy://spec/delivery-completion"],
  }),
  blueprint(TOUR_APPROVAL_EXECUTABLE, {
    displayName: "Tour approval",
    description: "End-of-day tour approval across the courier/dispatcher handover.",
    owner: "dispatch-quality",
    tags: ["multi-actor", "back-office"],
    referenceLinks: ["nesy://spec/tour-approval"],
  }),
];
