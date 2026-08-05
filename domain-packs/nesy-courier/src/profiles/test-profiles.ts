/**
 * ===========================================================================
 *  Nesy Courier test profiles and campaign  (Plan D.6B · 4B.15)
 *
 *  Four profiles, differing in what they are ALLOWED TO CONCLUDE.
 *
 *  `release-core` is the gate. It observes every occurrence
 *  (`evidenceSampleEveryN: 1`) and retains raw evidence, because a gate that
 *  looks at every third occurrence sometimes does not look at the one that broke.
 *
 *  `preview-smoke` samples evidence and skips slices for speed. It is useful and
 *  it can never say GO: `validateTestProfile` raises
 *  PREVIEW_PROFILE_GATES_RELEASE for a PREVIEW profile with `releaseGate: true`.
 *
 *  `bad-day` injects faults. Every injection names a `correlationFactKey` and an
 *  `expectedRecoveryFactKey`, because an injected fault indistinguishable from a
 *  real one produces noise instead of resilience evidence — and "it broke" with
 *  no expected recovery reads as a pass.
 *
 *  `differential-baseline` compares against a baseline build and must name the
 *  facts whose difference actually matters; otherwise every cosmetic diff weighs
 *  as much as a missing delivery confirmation.
 * ===========================================================================
 */

import type { TestCampaignDefinition, TestProfileDefinition } from "@nesy/domain-pack-contracts";
import { NESY_COURIER_APPLICATION_KEY } from "../registries/application.js";
import { NESY_FACTS } from "../registries/facts.js";
import { NESY_LAUNCH_PROFILES } from "./launch.js";
import { NESY_WORKFLOWS } from "./workflows.js";

const APP = NESY_COURIER_APPLICATION_KEY;

export const NESY_TEST_PROFILES = {
  releaseCore: "nesy.profile.release-core",
  previewSmoke: "nesy.profile.preview-smoke",
  badDay: "nesy.profile.bad-day",
  differentialBaseline: "nesy.profile.differential-baseline",
} as const;

export const NESY_CAMPAIGNS = {
  releaseGate: "nesy.campaign.release-gate",
} as const;

export const NESY_COURIER_TEST_PROFILES: readonly TestProfileDefinition[] = [
  {
    profileKey: NESY_TEST_PROFILES.releaseCore,
    version: 1,
    kind: "RELEASE",
    displayName: "Core courier journey, release gate",
    applicationRef: APP,
    launchProfileRef: NESY_LAUNCH_PROFILES.coldRealLogin,
    includedWorkflowRefs: [
      NESY_WORKFLOWS.login,
      NESY_WORKFLOWS.selectRoute,
      NESY_WORKFLOWS.openStop,
      NESY_WORKFLOWS.processParcel,
      NESY_WORKFLOWS.completeDelivery,
      NESY_WORKFLOWS.tourApproval,
    ],
    releaseGate: true,
    // Every occurrence, raw evidence retained. See the header.
    telemetry: { captureArtifacts: true, evidenceSampleEveryN: 1, retainRawEvidence: true },
    performanceBudgetRefs: [
      { budgetRef: "nesy.budget.stop-open-latency", appliesToRef: "nesy.macro.open-stop" },
      { budgetRef: "nesy.budget.delivery-confirm-latency", appliesToRef: "nesy.macro.complete-delivery" },
    ],
    requiredCapabilityRefs: [
      "verdict.core.bridge.tap",
      "verdict.core.remote.allowlisted-operation",
      "domain.nesy.adapter.named-query",
      "domain.nesy.scanner.inject",
      "domain.nesy.backoffice.approval-operations",
    ],
  },
  {
    profileKey: NESY_TEST_PROFILES.previewSmoke,
    version: 1,
    kind: "PREVIEW",
    displayName: "Fast preview smoke",
    applicationRef: APP,
    launchProfileRef: NESY_LAUNCH_PROFILES.preparedSession,
    includedWorkflowRefs: [NESY_WORKFLOWS.openStop, NESY_WORKFLOWS.processParcel],
    releaseGate: false,
    telemetry: { captureArtifacts: false, evidenceSampleEveryN: 3, retainRawEvidence: false },
    performanceBudgetRefs: [],
    requiredCapabilityRefs: ["domain.nesy.adapter.session-prepared", "domain.nesy.scanner.inject"],
  },
  {
    profileKey: NESY_TEST_PROFILES.badDay,
    version: 1,
    kind: "BAD_DAY",
    displayName: "Bad day — network and process faults",
    applicationRef: APP,
    launchProfileRef: NESY_LAUNCH_PROFILES.coldRealLogin,
    includedWorkflowRefs: [NESY_WORKFLOWS.completeDelivery, NESY_WORKFLOWS.tourApproval],
    // Not a gate: a fault-injection run answers "does it recover?", not "may we
    // ship?". The two questions have different pass criteria.
    releaseGate: false,
    telemetry: { captureArtifacts: true, evidenceSampleEveryN: 1, retainRawEvidence: true },
    faultPlan: {
      expectRecovery: true,
      injections: [
        {
          faultRef: "nesy.fault.network-drop-at-submit",
          kind: "NETWORK",
          triggerRef: "nesy.macro.complete-delivery",
          correlationFactKey: NESY_FACTS.OFFLINE_QUEUE_ITEM_WAITING,
          expectedRecoveryFactKey: NESY_FACTS.DELIVERY_CONFIRMED,
        },
        {
          faultRef: "nesy.fault.process-death-after-request",
          kind: "PROCESS_DEATH",
          triggerRef: "nesy.macro.tour-approval-lifecycle",
          correlationFactKey: NESY_FACTS.TOUR_APPROVAL_REQUESTED,
          expectedRecoveryFactKey: NESY_FACTS.TOUR_APPROVAL_CONFIRMED,
        },
      ],
    },
    performanceBudgetRefs: [],
    requiredCapabilityRefs: ["verdict.core.remote.allowlisted-operation", "domain.nesy.backoffice.approval-operations"],
  },
  {
    profileKey: NESY_TEST_PROFILES.differentialBaseline,
    version: 1,
    kind: "DIFFERENTIAL",
    displayName: "Differential against the previous release build",
    applicationRef: APP,
    launchProfileRef: NESY_LAUNCH_PROFILES.preparedSession,
    includedWorkflowRefs: [NESY_WORKFLOWS.openStop, NESY_WORKFLOWS.completeDelivery],
    releaseGate: false,
    telemetry: { captureArtifacts: true, evidenceSampleEveryN: 1, retainRawEvidence: true },
    differential: {
      baselineBuildRef: "nesy.build.previous-release",
      // Named explicitly so a cosmetic diff does not weigh as much as a missing
      // business confirmation.
      criticalFactKeys: [
        NESY_FACTS.ACTIVE_STOP_MATCHES,
        NESY_FACTS.DELIVERY_CONFIRMED,
        NESY_FACTS.PARCEL_STATE_PROCESSED,
      ],
      onCriticalDiff: "OPERATOR_ATTENTION",
    },
    performanceBudgetRefs: [{ budgetRef: "nesy.budget.stop-open-latency", appliesToRef: "nesy.macro.open-stop" }],
    requiredCapabilityRefs: ["domain.nesy.adapter.session-prepared"],
  },
];

export const NESY_COURIER_CAMPAIGNS: readonly TestCampaignDefinition[] = [
  {
    campaignKey: NESY_CAMPAIGNS.releaseGate,
    version: 1,
    displayName: "Release gate campaign",
    // Preview first for fast feedback, then the actual gate. The campaign gates
    // because it contains a gating profile — validateDomainPackBundle rejects a
    // gating campaign made only of non-gating profiles, which would launder a
    // preview result into a ship decision.
    profileRefs: [NESY_TEST_PROFILES.previewSmoke, NESY_TEST_PROFILES.releaseCore],
    releaseGate: true,
    onProfileFailure: "CONTINUE",
  },
];
