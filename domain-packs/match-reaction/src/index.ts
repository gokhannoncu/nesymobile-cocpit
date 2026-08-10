import {
  DECLARATIVE_RUNTIME_CODE_POLICY,
  computeFeatureExecutableDigest,
  type ApplicationDefinition,
  type CapabilityContract,
  type DomainPackBundle,
  type DomainPackManifest,
  type EntityDefinition,
  type EvidenceSourceDefinition,
  type FeatureBlueprint,
  type MacroDefinition,
  type ScreenDefinition,
  type SemanticActionDefinition,
  type TargetDefinition,
} from "@nesy/domain-pack-contracts";
import type { WorkflowIrV2, WorkflowStepV2 } from "@nesy/workflow-contract";

export const MATCH_REACTION_PACK_KEY = "match.reaction";
export const MATCH_REACTION_APPLICATION_KEY = "match.reaction.mobile";
export const MATCH_REACTION_MACRO_KEY = "match.macro.single-reaction-persists";
export const MATCH_REACTION_WORKFLOW_KEY = "match.workflow.single-reaction-persists";
export const MATCH_REACTION_FACT = "match.fact.reaction.persisted";
export const MATCH_REACTION_READY_FACT = "match.fact.detail.ready";
export const MATCH_REACTION_CAPABILITY = "domain.match.reaction.state-projection";

const manifest: DomainPackManifest = {
  schemaVersion: 1,
  packKey: MATCH_REACTION_PACK_KEY,
  packName: "Match Reaction",
  version: { major: 1, minor: 0, patch: 0 },
  trustTier: "FIRST_PARTY",
  publicationState: "DRAFT",
  owner: "platform-app-agnostic-proof",
  businessScope: "A sports app user chooses one reaction on a match detail screen and the reaction is persisted.",
  notResponsibleFor: [
    "courier, shipment, route, stop, parcel, payment or fiscal behavior",
    "betting, subscription and advertising surfaces",
    "execution queues, resource leases or run manifests",
  ],
  applicationRefs: [MATCH_REACTION_APPLICATION_KEY],
  capabilityRequirements: [
    {
      capabilityRef: MATCH_REACTION_CAPABILITY,
      optional: false,
      reason: "The app adapter must expose the reaction state fact.",
    },
  ],
  dependencies: [],
  impactRefs: [{ impactRef: "match.impact.reaction", kind: "FEATURE" }],
  resourceRequirementRefs: [],
};

const application: ApplicationDefinition = {
  applicationKey: MATCH_REACTION_APPLICATION_KEY,
  displayName: "Match Reaction Demo",
  platform: "ANDROID",
  packageIdentity: "com.example.matchreaction",
  versionCompatibility: { minVersionCode: 1, maxVersionCode: null, minVersionName: "1.0.0" },
  adapterCompatibility: {
    adapterRef: "match.reaction.app-adapter",
    minAdapterVersion: 1,
    maxAdapterVersion: null,
    requiredCapabilities: ["STATE_PROJECTION"],
  },
  adapterCapabilities: [
    {
      kind: "STATE_PROJECTION",
      operationRefs: ["match.reactionState"],
      automationOnly: true,
      releaseGuard: "automationRelease=false",
      mutating: false,
    },
  ],
  capabilityRefs: [MATCH_REACTION_CAPABILITY],
};

const screen: ScreenDefinition = {
  screenKey: "match.screen.detail",
  applicationRef: MATCH_REACTION_APPLICATION_KEY,
  displayName: "Match detail",
  runtimeImplementation: { kind: "COMPOSE", hostActivity: "MainActivity", routeKey: "match/{matchId}" },
  entryStrategies: [
    {
      kind: "WORKFLOW_ENTRY",
      entryRef: MATCH_REACTION_MACRO_KEY,
      provesUserPath: true,
      requiredCapabilityRefs: [],
    },
  ],
  readiness: { requiredFactKeys: [MATCH_REACTION_READY_FACT], deadlineMs: 10_000 },
  supportedSurfaceRefs: [],
  supportedActionRefs: ["match.action.choose-reaction"],
};

const entity: EntityDefinition = {
  entityType: "REACTION",
  applicationRef: MATCH_REACTION_APPLICATION_KEY,
  displayName: "Reaction",
  businessKeyPath: "reaction.id",
  identityPaths: ["matchId", "reactionKind"],
  correlation: { correlationPaths: ["matchId", "reactionKind"], crossPlane: true },
  freshness: { maxAgeMs: 30_000, onStale: "REFRESH" },
  redaction: { redactPaths: [] },
  sourceQueryRefs: ["match.reactionState"],
};

const target: TargetDefinition = {
  targetKey: "match.target.reaction-button",
  applicationRef: MATCH_REACTION_APPLICATION_KEY,
  screenRef: screen.screenKey,
  displayName: "Reaction button",
  resolution: {
    chain: [
      { kind: "ACCESSIBILITY_ID", selector: { id: "reaction_button" }, establishesIdentity: true },
      { kind: "ENTITY_BINDING", selector: { keyPath: "reactionKind" }, establishesIdentity: true },
    ],
    ambiguityPolicy: "FAIL",
    notFoundPolicy: "FAIL",
    deadlineMs: 10_000,
    reverifyBeforeAction: true,
  },
  entityBinding: {
    entityTypeRef: entity.entityType,
    targetRef: "match.target.reaction-button",
    projectedPaths: ["matchId", "reactionKind"],
    redactProjection: false,
  },
};

const evidenceSources: readonly EvidenceSourceDefinition[] = [
  {
    sourceKey: "match.ui.detail-ready",
    plane: "UI",
    kind: "BRIDGE_WATCH",
    authority: "PRIMARY",
    displayName: "Match detail ready",
    factKey: MATCH_REACTION_READY_FACT,
    observationRef: "match.watch.detail-ready",
    freshness: { maxAgeMs: 5_000, onStale: "REOBSERVE" },
    correlation: { requireEntityMatch: false, requireOccurrenceMatch: true, correlationPaths: [], crossPlane: false },
    redaction: { redactPaths: [] },
    preservesRawEvidence: true,
    requiredCapabilityRefs: ["verdict.core.bridge.watch-fact"],
  },
  {
    sourceKey: "match.app.reaction-state",
    plane: "APP",
    kind: "SDK_STATE",
    authority: "PRIMARY",
    displayName: "Reaction persisted",
    factKey: MATCH_REACTION_FACT,
    observationRef: "match.reactionState",
    freshness: { maxAgeMs: 30_000, onStale: "REOBSERVE" },
    correlation: { requireEntityMatch: true, requireOccurrenceMatch: true, correlationPaths: ["matchId", "reactionKind"], crossPlane: true },
    redaction: { redactPaths: [] },
    preservesRawEvidence: true,
    requiredCapabilityRefs: [MATCH_REACTION_CAPABILITY],
  },
];

const semanticAction: SemanticActionDefinition = {
  actionKey: "match.action.choose-reaction",
  applicationRef: MATCH_REACTION_APPLICATION_KEY,
  displayName: "Choose reaction",
  businessMeaning: "A user chooses exactly one reaction on a match detail screen.",
  notResponsibleFor: ["commenting, sharing, betting or subscription behavior"],
  screenRefs: [screen.screenKey],
  surfaceRefs: [],
  entityTypeRefs: [entity.entityType],
  targetRefs: [target.targetKey],
  requiredCapabilityRefs: [MATCH_REACTION_CAPABILITY],
};

const steps: readonly WorkflowStepV2[] = [
  {
    planStepId: "assert-reaction-persisted",
    kind: "ASSERT_FACT",
    sourceMapRef: "match-sm-1",
    timeoutMs: 10_000,
    retryPolicy: { maxAttempts: 1, effectClass: "READ_ONLY" },
    capabilityRequirements: [{ capability: MATCH_REACTION_CAPABILITY, optional: false }],
    continueGate: { allOf: [MATCH_REACTION_READY_FACT], deadlineMs: 10_000, unknownPolicy: "FAIL" },
    finalOraclePolicy: {
      requirements: [
        {
          factKey: MATCH_REACTION_FACT,
          obligation: "REQUIRED",
          timing: "IMMEDIATE",
          onTimeout: "FAIL",
        },
      ],
    },
    factKey: MATCH_REACTION_FACT,
    expected: true,
    unknownPolicy: "FAIL",
    entityBinding: { type: entity.entityType, id: "run.input.reactionId" },
    next: null,
  },
];

const genericIr: WorkflowIrV2 = {
  schemaVersion: 2,
  workflowId: MATCH_REACTION_WORKFLOW_KEY,
  workflowVersion: 1,
  name: "Single reaction persists",
  source: { kind: "DOMAIN_PACK_EXPANSION", ref: MATCH_REACTION_MACRO_KEY },
  inputs: [
    { name: "matchId", type: "string", required: true },
    { name: "reactionKind", type: "string", required: true },
    { name: "reactionId", type: "string", required: true },
  ],
  variables: [],
  steps,
  entryStepId: "assert-reaction-persisted",
  policies: {
    runDeadlineMs: 60_000,
    cleanupDeadlineMs: 10_000,
    defaultRetry: { maxAttempts: 1, effectClass: "READ_ONLY" },
    artifactPolicy: { captureOnSuccess: false, captureOnFailure: true, kinds: ["SCREENSHOT"] },
    redactionPolicy: { redactPaths: [] },
  },
  capabilityRequirements: [{ capability: MATCH_REACTION_CAPABILITY, optional: false }],
  sourceMap: [
    {
      ref: "match-sm-1",
      planStepId: "assert-reaction-persisted",
      domainSourceRef: MATCH_REACTION_MACRO_KEY,
      note: "second-domain app-agnostic proof",
    },
  ],
};

const oracleTemplate = {
  continueGate: { allOf: [MATCH_REACTION_READY_FACT], deadlineMs: 10_000, unknownPolicy: "FAIL" as const },
  finalOracle: {
    requirements: [
      { factKey: MATCH_REACTION_FACT, obligation: "REQUIRED" as const, timing: "IMMEDIATE" as const, onTimeout: "FAIL" as const },
    ],
  },
  notResponsibleFor: ["network transport acknowledgement without reaction state"],
};

const macro: MacroDefinition = {
  macroKey: MATCH_REACTION_MACRO_KEY,
  actionRef: semanticAction.actionKey,
  displayName: "Single reaction persists",
  businessMeaning: semanticAction.businessMeaning,
  notResponsibleFor: semanticAction.notResponsibleFor,
  input: { fields: [] },
  output: { fields: [{ name: "persisted", type: "boolean", factKey: MATCH_REACTION_FACT }] },
  preconditions: [{ kind: "SCREEN_READY", ref: screen.screenKey, deadlineMs: 10_000, onUnmet: "FAIL" }],
  allowedRegistryRefs: {
    screenRefs: [screen.screenKey],
    surfaceRefs: [],
    entityTypeRefs: [entity.entityType],
    targetRefs: [target.targetKey],
    factKeys: [MATCH_REACTION_READY_FACT, MATCH_REACTION_FACT],
    queryRefs: ["match.reactionState"],
    adapterOperationRefs: [],
  },
  oracleTemplate,
  interruptPolicy: {
    handledSurfaceRefs: [],
    fatalSurfaceRefs: [],
    unlistedSurfacePolicy: "FAIL",
    maxHandledInterrupts: 0,
  },
  requiredCapabilityRefs: [MATCH_REACTION_CAPABILITY],
  expansionSnapshot: {
    macroRef: MATCH_REACTION_MACRO_KEY,
    authoredBy: "COMPILER",
    genericIr,
    irSourceMap: genericIr.sourceMap,
    domainSourceMap: [
      {
        ref: "match-domain-sm-1",
        macroRef: MATCH_REACTION_MACRO_KEY,
        planStepIds: ["assert-reaction-persisted"],
        sliceRef: "match.slice.reaction",
      },
    ],
  },
  bridgeFlowPlanSnapshot: {
    macroRef: MATCH_REACTION_MACRO_KEY,
    authoredBy: "COMPILER",
    requiredCapabilityRefs: [MATCH_REACTION_CAPABILITY],
    legs: [
      {
        planStepId: "assert-reaction-persisted",
        bridgeVerb: "assert_fact",
        awaitFactKey: MATCH_REACTION_FACT,
      },
    ],
  },
};

const executable = {
  featureKey: "match.feature.single-reaction",
  contractVersion: 1,
  applicationRef: MATCH_REACTION_APPLICATION_KEY,
  macroRefs: [MATCH_REACTION_MACRO_KEY],
  workflowRefs: [MATCH_REACTION_WORKFLOW_KEY],
  invariants: [
    {
      invariantKey: "match.invariant.single-reaction-persists",
      statement: "A chosen reaction must be persisted for the match.",
      authority: "PRODUCT_APPROVED" as const,
      factKeys: [MATCH_REACTION_FACT],
      bindsReleaseGate: true,
    },
  ],
  requiredCapabilityRefs: [MATCH_REACTION_CAPABILITY],
  screenRefs: [screen.screenKey],
  surfaceRefs: [],
  notResponsibleFor: ["reaction comments, subscriptions, ads and betting widgets"],
};

const feature: FeatureBlueprint = {
  featureKey: executable.featureKey,
  authoring: {
    displayName: "Single reaction",
    description: "Users can select one reaction and have it persisted.",
    owner: "platform-app-agnostic-proof",
    tags: ["second-domain", "reaction"],
  },
  executable,
  executableDigest: computeFeatureExecutableDigest(executable),
};

const capability: CapabilityContract = {
  capabilityKey: MATCH_REACTION_CAPABILITY,
  layer: "domain.match",
  provider: "APP_ADAPTER",
  displayName: "Reaction state projection",
  description: "The app adapter exposes whether the selected reaction persisted.",
  runtimeDetected: true,
  detectionRef: "match.reactionState",
  automationOnly: true,
  promotionEvidenceRefs: ["match.second-domain-proof"],
};

export function buildMatchReactionBundle(): DomainPackBundle {
  return {
    manifest,
    runtimeCodePolicy: DECLARATIVE_RUNTIME_CODE_POLICY,
    registries: {
      applications: [application],
      screens: [screen],
      surfaces: [],
      entities: [entity],
      targets: [target],
      evidenceSources,
      derivedFacts: { facts: [] },
      semanticActions: [semanticAction],
      macros: [macro],
      fragments: [],
      independentWorkflows: [
        {
          workflowKey: MATCH_REACTION_WORKFLOW_KEY,
          displayName: "Single reaction persists",
          businessMeaning: "A reaction choice persists as app state.",
          notResponsibleFor: ["betting, ads, subscriptions or courier logistics"],
          macroRefs: [MATCH_REACTION_MACRO_KEY],
          fragmentRefs: [],
          occurrenceScope: "INDEPENDENT",
          oracleTemplate,
          producesTerminalVerdict: true,
        },
      ],
      launchProfiles: [],
      testProfiles: [],
      campaigns: [],
      features: [feature],
      capabilities: [capability],
      remoteAdapters: [],
    },
  };
}

export const MATCH_REACTION_BUNDLE = buildMatchReactionBundle();
