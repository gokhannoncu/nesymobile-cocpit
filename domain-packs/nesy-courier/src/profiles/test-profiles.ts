/**
 * ===========================================================================
 *  Nesy Courier test profiles and campaigns  (Plan D.6B · Phase 7.20–7.22)
 *
 *  Phase 7 CHECKPOINT catalog keys (nesy.smoke.core, …) are first-class.
 *  Legacy 4B names remain as aliases so older docs/refs still resolve.
 *
 *  Preview / DIAGNOSTIC profiles never set releaseGate:true
 *  (PREVIEW_PROFILE_GATES_RELEASE). Gating profiles observe every occurrence
 *  (evidenceSampleEveryN: 1) and retain raw evidence.
 * ===========================================================================
 */

import type { TestCampaignDefinition, TestProfileDefinition } from "@nesy/domain-pack-contracts";
import { NESY_COURIER_APPLICATION_KEY } from "../registries/application.js";
import { NESY_FACTS } from "../registries/facts.js";
import { NESY_LAUNCH_PROFILES } from "./launch.js";
import { NESY_WORKFLOWS } from "./workflows.js";

const APP = NESY_COURIER_APPLICATION_KEY;

export const NESY_TEST_PROFILES = {
  smokeCore: "nesy.smoke.core",
  regressionCritical: "nesy.regression.critical",
  regressionDifferential: "nesy.regression.differential",
  recoveryPaymentProcessKill: "nesy.recovery.payment-process-kill",
  recoveryFiscalProcessKill: "nesy.recovery.fiscal-process-kill",
  recoveryQueueFlush: "nesy.recovery.queue-flush",
  badDayStateAwareShort: "nesy.bad-day.state-aware-short",
  contractConsistency: "nesy.contract.consistency",
  loadNormal60Stop: "nesy.load.normal-60-stop",
  loadBusy120Stop: "nesy.load.busy-120-stop",
  compatibilityFieldDevices: "nesy.compatibility.field-devices",
  securityReleaseIsolation: "nesy.security.release-isolation",
  soakShort: "nesy.soak.short",
  previewAccessibilityBasic: "nesy.preview.accessibility.basic",
  previewSmartExplorer: "nesy.preview.smart-explorer",
  /** @deprecated Phase 4B name — alias of smokeCore */
  releaseCore: "nesy.smoke.core",
  /** @deprecated Phase 4B name — alias of previewAccessibilityBasic for smoke */
  previewSmoke: "nesy.profile.preview-smoke",
  /** @deprecated Phase 4B name — alias of badDayStateAwareShort */
  badDay: "nesy.bad-day.state-aware-short",
  /** @deprecated Phase 4B name — alias of regressionDifferential */
  differentialBaseline: "nesy.regression.differential",
} as const;

export const NESY_CAMPAIGNS = {
  pr: "nesy.campaign.pr",
  nightly: "nesy.campaign.nightly",
  weekly: "nesy.campaign.weekly",
  release: "nesy.campaign.release",
  /** @deprecated Phase 4B name — alias of release */
  releaseGate: "nesy.campaign.release",
} as const;

const CORE_JOURNEY = [
  NESY_WORKFLOWS.login,
  NESY_WORKFLOWS.selectRoute,
  NESY_WORKFLOWS.openStop,
  NESY_WORKFLOWS.processParcel,
  NESY_WORKFLOWS.completeDelivery,
  NESY_WORKFLOWS.tourApproval,
] as const;

const GATE_TELEMETRY = {
  captureArtifacts: true,
  evidenceSampleEveryN: 1,
  retainRawEvidence: true,
} as const;

const PREVIEW_TELEMETRY = {
  captureArtifacts: false,
  evidenceSampleEveryN: 3,
  retainRawEvidence: false,
} as const;

const CORE_CAPS = [
  "verdict.core.bridge.tap",
  "verdict.core.remote.allowlisted-operation",
  "domain.nesy.adapter.named-query",
] as const;

export const NESY_COURIER_TEST_PROFILES: readonly TestProfileDefinition[] = [
  {
    profileKey: NESY_TEST_PROFILES.smokeCore,
    version: 1,
    kind: "RELEASE",
    displayName: "Smoke core courier journey (release gate)",
    applicationRef: APP,
    launchProfileRef: NESY_LAUNCH_PROFILES.coldRealLogin,
    includedWorkflowRefs: [...CORE_JOURNEY],
    releaseGate: true,
    telemetry: GATE_TELEMETRY,
    performanceBudgetRefs: [
      { budgetRef: "nesy.budget.stop-open-latency", appliesToRef: "nesy.macro.open-stop" },
      { budgetRef: "nesy.budget.delivery-confirm-latency", appliesToRef: "nesy.macro.complete-delivery" },
    ],
    requiredCapabilityRefs: [
      ...CORE_CAPS,
      "domain.nesy.scanner.inject",
      "domain.nesy.backoffice.approval-operations",
    ],
  },
  {
    profileKey: NESY_TEST_PROFILES.regressionCritical,
    version: 1,
    kind: "RELEASE",
    displayName: "Critical regression — delivery + tour approval",
    applicationRef: APP,
    launchProfileRef: NESY_LAUNCH_PROFILES.coldRealLogin,
    includedWorkflowRefs: [
      NESY_WORKFLOWS.login,
      NESY_WORKFLOWS.completeDelivery,
      NESY_WORKFLOWS.tourApproval,
    ],
    releaseGate: true,
    telemetry: GATE_TELEMETRY,
    performanceBudgetRefs: [
      { budgetRef: "nesy.budget.delivery-confirm-latency", appliesToRef: "nesy.macro.complete-delivery" },
    ],
    requiredCapabilityRefs: [
      ...CORE_CAPS,
      "domain.nesy.backoffice.approval-operations",
    ],
  },
  {
    profileKey: NESY_TEST_PROFILES.regressionDifferential,
    version: 1,
    kind: "DIFFERENTIAL",
    displayName: "Differential regression against previous release build",
    applicationRef: APP,
    launchProfileRef: NESY_LAUNCH_PROFILES.preparedSession,
    includedWorkflowRefs: [NESY_WORKFLOWS.openStop, NESY_WORKFLOWS.completeDelivery],
    releaseGate: false,
    telemetry: GATE_TELEMETRY,
    differential: {
      baselineBuildRef: "nesy.build.previous-release",
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
  {
    profileKey: NESY_TEST_PROFILES.recoveryPaymentProcessKill,
    version: 1,
    kind: "BAD_DAY",
    displayName: "Recovery — payment process kill",
    applicationRef: APP,
    launchProfileRef: NESY_LAUNCH_PROFILES.coldRealLogin,
    includedWorkflowRefs: [NESY_WORKFLOWS.completeDelivery],
    releaseGate: false,
    telemetry: GATE_TELEMETRY,
    faultPlan: {
      expectRecovery: true,
      injections: [
        {
          faultRef: "nesy.fault.payment-process-kill",
          kind: "PROCESS_DEATH",
          triggerRef: "nesy.macro.complete-delivery",
          correlationFactKey: NESY_FACTS.OFFLINE_QUEUE_ITEM_WAITING,
          expectedRecoveryFactKey: NESY_FACTS.DELIVERY_CONFIRMED,
        },
      ],
    },
    performanceBudgetRefs: [],
    requiredCapabilityRefs: ["verdict.core.remote.allowlisted-operation"],
  },
  {
    profileKey: NESY_TEST_PROFILES.recoveryFiscalProcessKill,
    version: 1,
    kind: "BAD_DAY",
    displayName: "Recovery — fiscal process kill",
    applicationRef: APP,
    launchProfileRef: NESY_LAUNCH_PROFILES.coldRealLogin,
    includedWorkflowRefs: [NESY_WORKFLOWS.completeDelivery],
    releaseGate: false,
    telemetry: GATE_TELEMETRY,
    faultPlan: {
      expectRecovery: true,
      injections: [
        {
          faultRef: "nesy.fault.fiscal-process-kill",
          kind: "PROCESS_DEATH",
          triggerRef: "nesy.macro.complete-delivery",
          correlationFactKey: NESY_FACTS.OFFLINE_QUEUE_ITEM_WAITING,
          expectedRecoveryFactKey: NESY_FACTS.DELIVERY_CONFIRMED,
        },
      ],
    },
    performanceBudgetRefs: [],
    requiredCapabilityRefs: ["verdict.core.remote.allowlisted-operation"],
  },
  {
    profileKey: NESY_TEST_PROFILES.recoveryQueueFlush,
    version: 1,
    kind: "BAD_DAY",
    displayName: "Recovery — offline queue flush",
    applicationRef: APP,
    launchProfileRef: NESY_LAUNCH_PROFILES.coldRealLogin,
    includedWorkflowRefs: [NESY_WORKFLOWS.completeDelivery],
    releaseGate: false,
    telemetry: GATE_TELEMETRY,
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
      ],
    },
    performanceBudgetRefs: [],
    requiredCapabilityRefs: ["verdict.core.remote.allowlisted-operation"],
  },
  {
    profileKey: NESY_TEST_PROFILES.badDayStateAwareShort,
    version: 1,
    kind: "BAD_DAY",
    displayName: "Bad day — network and process faults (state-aware short)",
    applicationRef: APP,
    launchProfileRef: NESY_LAUNCH_PROFILES.coldRealLogin,
    includedWorkflowRefs: [NESY_WORKFLOWS.completeDelivery, NESY_WORKFLOWS.tourApproval],
    releaseGate: false,
    telemetry: GATE_TELEMETRY,
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
    requiredCapabilityRefs: [
      "verdict.core.remote.allowlisted-operation",
      "domain.nesy.backoffice.approval-operations",
    ],
  },
  {
    profileKey: NESY_TEST_PROFILES.contractConsistency,
    version: 1,
    kind: "DIAGNOSTIC",
    displayName: "Contract consistency — HTTP/local/remote evidence planes",
    applicationRef: APP,
    launchProfileRef: NESY_LAUNCH_PROFILES.preparedSession,
    includedWorkflowRefs: [NESY_WORKFLOWS.completeDelivery, NESY_WORKFLOWS.tourApproval],
    releaseGate: false,
    telemetry: GATE_TELEMETRY,
    performanceBudgetRefs: [],
    requiredCapabilityRefs: [
      "verdict.core.remote.allowlisted-operation",
      "domain.nesy.adapter.session-prepared",
    ],
  },
  {
    profileKey: NESY_TEST_PROFILES.loadNormal60Stop,
    version: 1,
    kind: "DIAGNOSTIC",
    displayName: "Load — normal ~60 stop day",
    applicationRef: APP,
    launchProfileRef: NESY_LAUNCH_PROFILES.preparedSession,
    includedWorkflowRefs: [NESY_WORKFLOWS.fullCourierGolden],
    releaseGate: false,
    telemetry: { captureArtifacts: true, evidenceSampleEveryN: 5, retainRawEvidence: false },
    performanceBudgetRefs: [
      { budgetRef: "nesy.budget.stop-open-latency", appliesToRef: "nesy.macro.open-stop" },
    ],
    requiredCapabilityRefs: ["domain.nesy.adapter.session-prepared", "domain.nesy.adapter.named-query"],
  },
  {
    profileKey: NESY_TEST_PROFILES.loadBusy120Stop,
    version: 1,
    kind: "DIAGNOSTIC",
    displayName: "Load — busy ~120 stop day",
    applicationRef: APP,
    launchProfileRef: NESY_LAUNCH_PROFILES.preparedSession,
    includedWorkflowRefs: [NESY_WORKFLOWS.fullCourierGolden],
    releaseGate: false,
    telemetry: { captureArtifacts: true, evidenceSampleEveryN: 10, retainRawEvidence: false },
    performanceBudgetRefs: [
      { budgetRef: "nesy.budget.stop-open-latency", appliesToRef: "nesy.macro.open-stop" },
    ],
    requiredCapabilityRefs: ["domain.nesy.adapter.session-prepared", "domain.nesy.adapter.named-query"],
  },
  {
    profileKey: NESY_TEST_PROFILES.compatibilityFieldDevices,
    version: 1,
    kind: "DIAGNOSTIC",
    displayName: "Compatibility — field device matrix",
    applicationRef: APP,
    launchProfileRef: NESY_LAUNCH_PROFILES.coldRealLogin,
    includedWorkflowRefs: [NESY_WORKFLOWS.login, NESY_WORKFLOWS.openStop, NESY_WORKFLOWS.processParcel],
    releaseGate: false,
    telemetry: GATE_TELEMETRY,
    performanceBudgetRefs: [],
    requiredCapabilityRefs: [...CORE_CAPS, "domain.nesy.scanner.inject"],
  },
  {
    profileKey: NESY_TEST_PROFILES.securityReleaseIsolation,
    version: 1,
    kind: "RELEASE",
    displayName: "Security — release isolation (automation seam leak → NO_GO)",
    applicationRef: APP,
    launchProfileRef: NESY_LAUNCH_PROFILES.coldRealLogin,
    includedWorkflowRefs: [NESY_WORKFLOWS.login],
    releaseGate: true,
    telemetry: GATE_TELEMETRY,
    performanceBudgetRefs: [],
    requiredCapabilityRefs: [
      "verdict.core.bridge.tap",
      "domain.nesy.adapter.release-isolation",
    ],
  },
  {
    profileKey: NESY_TEST_PROFILES.soakShort,
    version: 1,
    kind: "DIAGNOSTIC",
    displayName: "Short soak — restart/resume state continuity",
    applicationRef: APP,
    launchProfileRef: NESY_LAUNCH_PROFILES.reuseSession,
    includedWorkflowRefs: [NESY_WORKFLOWS.openStop, NESY_WORKFLOWS.completeDelivery],
    releaseGate: false,
    telemetry: GATE_TELEMETRY,
    performanceBudgetRefs: [],
    requiredCapabilityRefs: ["domain.nesy.adapter.session-prepared"],
  },
  {
    profileKey: NESY_TEST_PROFILES.previewSmoke,
    version: 1,
    kind: "PREVIEW",
    displayName: "Fast preview smoke (legacy key; non-gating)",
    applicationRef: APP,
    launchProfileRef: NESY_LAUNCH_PROFILES.preparedSession,
    includedWorkflowRefs: [NESY_WORKFLOWS.openStop, NESY_WORKFLOWS.processParcel],
    releaseGate: false,
    telemetry: PREVIEW_TELEMETRY,
    performanceBudgetRefs: [],
    requiredCapabilityRefs: ["domain.nesy.adapter.session-prepared", "domain.nesy.scanner.inject"],
  },
  {
    profileKey: NESY_TEST_PROFILES.previewAccessibilityBasic,
    version: 1,
    kind: "PREVIEW",
    displayName: "Preview — basic accessibility (Bridge metadata only)",
    applicationRef: APP,
    launchProfileRef: NESY_LAUNCH_PROFILES.preparedSession,
    includedWorkflowRefs: [NESY_WORKFLOWS.openStop],
    releaseGate: false,
    telemetry: PREVIEW_TELEMETRY,
    performanceBudgetRefs: [],
    requiredCapabilityRefs: ["verdict.core.bridge.resolve-target", "domain.nesy.adapter.session-prepared"],
  },
  {
    profileKey: NESY_TEST_PROFILES.previewSmartExplorer,
    version: 1,
    kind: "PREVIEW",
    displayName: "Preview — Smart Explorer (crash/ANR/unexpected surface signals)",
    applicationRef: APP,
    launchProfileRef: NESY_LAUNCH_PROFILES.preparedSession,
    includedWorkflowRefs: [NESY_WORKFLOWS.openStop, NESY_WORKFLOWS.processParcel],
    releaseGate: false,
    telemetry: PREVIEW_TELEMETRY,
    performanceBudgetRefs: [],
    requiredCapabilityRefs: ["domain.nesy.adapter.session-prepared"],
  },
];

export const NESY_COURIER_CAMPAIGNS: readonly TestCampaignDefinition[] = [
  {
    campaignKey: NESY_CAMPAIGNS.pr,
    version: 1,
    displayName: "PR campaign — smoke + preview feedback",
    profileRefs: [NESY_TEST_PROFILES.previewSmoke, NESY_TEST_PROFILES.smokeCore],
    releaseGate: false,
    onProfileFailure: "CONTINUE",
  },
  {
    campaignKey: NESY_CAMPAIGNS.nightly,
    version: 1,
    displayName: "Nightly campaign — critical regression + bad day",
    profileRefs: [
      NESY_TEST_PROFILES.regressionCritical,
      NESY_TEST_PROFILES.badDayStateAwareShort,
      NESY_TEST_PROFILES.contractConsistency,
    ],
    releaseGate: false,
    onProfileFailure: "CONTINUE",
  },
  {
    campaignKey: NESY_CAMPAIGNS.weekly,
    version: 1,
    displayName: "Weekly campaign — load + compatibility + soak",
    profileRefs: [
      NESY_TEST_PROFILES.loadNormal60Stop,
      NESY_TEST_PROFILES.loadBusy120Stop,
      NESY_TEST_PROFILES.compatibilityFieldDevices,
      NESY_TEST_PROFILES.soakShort,
      NESY_TEST_PROFILES.regressionDifferential,
    ],
    releaseGate: false,
    onProfileFailure: "OPERATOR_ATTENTION",
  },
  {
    campaignKey: NESY_CAMPAIGNS.release,
    version: 1,
    displayName: "Release gate campaign",
    profileRefs: [
      NESY_TEST_PROFILES.previewSmoke,
      NESY_TEST_PROFILES.smokeCore,
      NESY_TEST_PROFILES.securityReleaseIsolation,
      NESY_TEST_PROFILES.regressionCritical,
    ],
    releaseGate: true,
    onProfileFailure: "STOP",
  },
];
