/**
 * ===========================================================================
 *  CP4B-Core acceptance suite  (CHECKPOINT 4B)
 *
 *  This suite tests the CONTRACT, not a pack. The reference pack's own suite
 *  proves that a real, complete pack satisfies these rules; this one proves the
 *  rules exist and bite, using the smallest inputs that can express each
 *  violation.
 *
 *  Two guards deserve a note, because they are the boundary Phase 4B exists to
 *  draw:
 *
 *    The EXECUTION-PLANE guard scans this package's own export surface for
 *    `RunManifest`, `Lease`, `SchedulerDisposition` and friends. A pack that
 *    carried run state could not be published as an immutable artifact — its
 *    digest would change on every worker heartbeat — so the boundary has to be a
 *    failing test rather than a design note.
 *
 *    The RUNTIME-CODE guard scans an assembled bundle for anything executable.
 *    A published pack is authored content; executing authored content on the
 *    Cockpit host is remote code execution with an editor in front of it.
 * ===========================================================================
 */

import { describe, expect, it } from "vitest";
import * as application from "./application.js";
import * as bundleModule from "./bundle.js";
import {
  computeBundleDigest,
  DECLARATIVE_RUNTIME_CODE_POLICY,
  findRuntimeCodeViolations,
  freezeBundle,
  pinnedBundleMatches,
  publishBundle,
  type DomainPackBundle,
} from "./bundle.js";
import * as canonical from "./canonical.js";
import { canonicalizeDomainDocument, digestDomainDocument, domainDocumentsEqual } from "./canonical.js";
import * as entityTarget from "./entity-target.js";
import {
  DEFAULT_AMBIGUITY_POLICY,
  validateTargetResolutionPolicy,
  type TargetResolutionPolicy,
} from "./entity-target.js";
import * as evidenceSource from "./evidence-source.js";
import {
  ALLOWED_SOURCE_KINDS_BY_PLANE,
  EVIDENCE_PLANES,
  FORBIDDEN_EVIDENCE_PLANES,
  validateDerivedFactGraph,
  validateEvidenceSource,
  type DerivedFactGraph,
  type EvidenceSourceDefinition,
} from "./evidence-source.js";
import * as featureCapability from "./feature-capability.js";
import {
  computeFeatureExecutableDigest,
  GATING_INVARIANT_AUTHORITIES,
  validateCapabilityContract,
  validateFeatureBlueprint,
  type FeatureBlueprint,
  type FeatureExecutableContract,
} from "./feature-capability.js";
import * as manifestModule from "./manifest.js";
import { DOMAIN_PACK_SCHEMA_VERSION, formatDomainPackVersion } from "./manifest.js";
import * as profile from "./profile.js";
import {
  SETUP_ONLY_SESSION_MODES,
  validateLaunchProfile,
  validateTestProfile,
  type LaunchProfile,
  type TestProfileDefinition,
} from "./profile.js";
import * as remoteAdapter from "./remote-adapter.js";
import { validateRemoteAdapterOperation, type RemoteAdapterOperation } from "./remote-adapter.js";
import * as screenSurface from "./screen-surface.js";
import { compareSurfacePriority, surfaceAllowedOnScreen, type SurfaceDefinition } from "./screen-surface.js";
import * as semanticAction from "./semantic-action.js";
import {
  validateReusableFlowFragment,
  type ReusableFlowFragmentDefinition,
} from "./semantic-action.js";
import * as validateModule from "./validate.js";
import {
  FORBIDDEN_EXECUTION_TYPE_NAMES,
  findExecutionPlaneLeakage,
  identifierSegments,
  parseDomainPackBundle,
  scanExportSurfaceForExecutionTypes,
  validateDomainPackBundle,
} from "./validate.js";

// ───────────────────────────────────────────────────────────────────────────
//  Minimal fixtures
// ───────────────────────────────────────────────────────────────────────────

/**
 * The smallest bundle that validates cleanly.
 *
 * Deliberately tiny: every negative test below mutates ONE field of it, so the
 * resulting issue list is unambiguous about what was rejected and why.
 */
function minimalBundle(): DomainPackBundle {
  return {
    manifest: {
      schemaVersion: DOMAIN_PACK_SCHEMA_VERSION,
      packKey: "fixture.pack",
      packName: "Fixture pack",
      version: { major: 1, minor: 0, patch: 0 },
      trustTier: "FIRST_PARTY",
      publicationState: "DRAFT",
      owner: "fixture-owner",
      businessScope: "A minimal pack used only by the contract acceptance suite.",
      notResponsibleFor: ["anything real"],
      applicationRefs: ["fixture.app"],
      capabilityRequirements: [{ capabilityRef: "verdict.core.bridge.tap", optional: false }],
      dependencies: [],
      impactRefs: [],
      resourceRequirementRefs: [],
    },
    runtimeCodePolicy: DECLARATIVE_RUNTIME_CODE_POLICY,
    registries: {
      applications: [
        {
          applicationKey: "fixture.app",
          displayName: "Fixture app",
          platform: "ANDROID",
          packageIdentity: "com.fixture.app",
          versionCompatibility: { minVersionCode: 1, maxVersionCode: null },
          adapterCompatibility: {
            adapterRef: "fixture.adapter",
            minAdapterVersion: 1,
            maxAdapterVersion: null,
            requiredCapabilities: ["NAMED_QUERY"],
          },
          adapterCapabilities: [
            {
              kind: "NAMED_QUERY",
              operationRefs: ["fixture.query.items"],
              automationOnly: true,
              releaseGuard: "automationRelease=false",
              mutating: false,
            },
          ],
          capabilityRefs: ["verdict.core.bridge.tap"],
        },
      ],
      screens: [
        {
          screenKey: "fixture.home",
          applicationRef: "fixture.app",
          displayName: "Home",
          runtimeImplementation: { kind: "ACTIVITY", componentName: "com.fixture.app/.HomeActivity" },
          entryStrategies: [
            { kind: "WORKFLOW_ENTRY", entryRef: "fixture.entry", provesUserPath: true, requiredCapabilityRefs: [] },
          ],
          readiness: { requiredFactKeys: ["UI.HOME_READY"], deadlineMs: 10_000 },
          supportedSurfaceRefs: ["fixture.confirm-dialog"],
          supportedActionRefs: ["fixture.action.pick"],
        },
      ],
      surfaces: [
        {
          surfaceKey: "fixture.confirm-dialog",
          applicationRef: "fixture.app",
          kind: "DIALOG",
          displayName: "Confirm dialog",
          parentScreenRefs: ["fixture.home"],
          detection: { requiredFactKeys: ["UI.CONFIRM_PRESENT"], deadlineMs: 5_000 },
          defaultPolicy: "IGNORE",
          priority: 10,
          blocksProductVerdict: false,
        },
      ],
      entities: [
        {
          entityType: "ITEM",
          applicationRef: "fixture.app",
          displayName: "Item",
          businessKeyPath: "itemCode",
          identityPaths: ["itemId"],
          correlation: { correlationPaths: ["itemCode"], crossPlane: true },
          freshness: { maxAgeMs: 60_000, onStale: "REFRESH" },
          redaction: { redactPaths: [] },
          sourceQueryRefs: ["fixture.query.items"],
        },
      ],
      targets: [
        {
          targetKey: "fixture.target.row",
          applicationRef: "fixture.app",
          screenRef: "fixture.home",
          displayName: "Item row",
          resolution: {
            chain: [
              { kind: "ACCESSIBILITY_ID", selector: { idPrefix: "row_" }, establishesIdentity: true },
              { kind: "ENTITY_BINDING", selector: { keyPath: "itemCode" }, establishesIdentity: true },
              { kind: "ROW_INDEX_HINT", selector: { containerId: "list" }, establishesIdentity: false },
            ],
            ambiguityPolicy: "FAIL",
            notFoundPolicy: "FAIL",
            deadlineMs: 10_000,
            reverifyBeforeAction: true,
          },
          entityBinding: {
            entityTypeRef: "ITEM",
            targetRef: "fixture.target.row",
            projectedPaths: ["itemCode"],
            redactProjection: true,
          },
        },
      ],
      evidenceSources: [
        {
          sourceKey: "fixture.ui.home-ready",
          plane: "UI",
          kind: "BRIDGE_WATCH",
          authority: "PRIMARY",
          displayName: "Home ready",
          factKey: "UI.HOME_READY",
          observationRef: "fixture.watch.home",
          freshness: { maxAgeMs: 5_000, onStale: "REOBSERVE" },
          correlation: {
            requireEntityMatch: false,
            requireOccurrenceMatch: true,
            correlationPaths: ["treeGen"],
            crossPlane: false,
          },
          redaction: { redactPaths: [] },
          preservesRawEvidence: true,
          requiredCapabilityRefs: [],
        },
        {
          sourceKey: "fixture.ui.confirm-present",
          plane: "UI",
          kind: "BRIDGE_WATCH",
          authority: "PRIMARY",
          displayName: "Confirm present",
          factKey: "UI.CONFIRM_PRESENT",
          observationRef: "fixture.watch.confirm",
          freshness: { maxAgeMs: 5_000, onStale: "REOBSERVE" },
          correlation: {
            requireEntityMatch: false,
            requireOccurrenceMatch: true,
            correlationPaths: ["treeGen"],
            crossPlane: false,
          },
          redaction: { redactPaths: [] },
          preservesRawEvidence: true,
          requiredCapabilityRefs: [],
        },
        {
          sourceKey: "fixture.app.item-picked",
          plane: "APP",
          kind: "SDK_EVENT",
          authority: "PRIMARY",
          displayName: "Item picked",
          factKey: "APP.ITEM_PICKED",
          observationRef: "fixture.events/item-picked",
          freshness: { maxAgeMs: 15_000, onStale: "REOBSERVE" },
          correlation: {
            requireEntityMatch: true,
            requireOccurrenceMatch: true,
            correlationPaths: ["itemCode"],
            crossPlane: true,
          },
          redaction: { redactPaths: [] },
          preservesRawEvidence: true,
          requiredCapabilityRefs: [],
        },
      ],
      derivedFacts: {
        facts: [
          {
            factKey: "APP.PICK_CONFIRMED",
            plane: "APP",
            authority: "PRIMARY",
            displayName: "Pick confirmed",
            provenance: {
              reducerKind: "CORRELATED_ALL_OF",
              reducerVersion: 1,
              inputFactKeys: ["APP.ITEM_PICKED", "UI.HOME_READY"],
            },
            preserveInputs: true,
            requiresCorrelation: true,
          },
        ],
      },
      semanticActions: [
        {
          actionKey: "fixture.action.pick",
          applicationRef: "fixture.app",
          displayName: "Pick an item",
          businessMeaning: "Picks one item from the list.",
          notResponsibleFor: ["list ordering"],
          screenRefs: ["fixture.home"],
          surfaceRefs: [],
          entityTypeRefs: ["ITEM"],
          targetRefs: ["fixture.target.row"],
          requiredCapabilityRefs: ["verdict.core.bridge.tap"],
        },
      ],
      macros: [
        {
          macroKey: "fixture.macro.pick",
          actionRef: "fixture.action.pick",
          displayName: "Pick item",
          businessMeaning: "Picks the requested item by business key.",
          notResponsibleFor: ["what happens after the pick"],
          input: { fields: [{ name: "item", type: "entityRef", required: true, entityTypeRef: "ITEM" }] },
          output: { fields: [{ name: "picked", type: "boolean", factKey: "APP.PICK_CONFIRMED" }] },
          preconditions: [{ kind: "SCREEN_READY", ref: "fixture.home", deadlineMs: 10_000, onUnmet: "FAIL" }],
          allowedRegistryRefs: {
            screenRefs: ["fixture.home"],
            surfaceRefs: ["fixture.confirm-dialog"],
            entityTypeRefs: ["ITEM"],
            targetRefs: ["fixture.target.row"],
            factKeys: ["UI.HOME_READY", "APP.ITEM_PICKED", "APP.PICK_CONFIRMED"],
            queryRefs: ["fixture.query.items"],
            adapterOperationRefs: [],
          },
          oracleTemplate: {
            continueGate: { allOf: ["UI.HOME_READY"], deadlineMs: 10_000, unknownPolicy: "RETRY" },
            finalOracle: {
              requirements: [
                { factKey: "APP.PICK_CONFIRMED", obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "FAIL" },
              ],
            },
          },
          interruptPolicy: {
            handledSurfaceRefs: ["fixture.confirm-dialog"],
            fatalSurfaceRefs: [],
            unlistedSurfacePolicy: "OPERATOR_ATTENTION",
            maxHandledInterrupts: 2,
          },
          requiredCapabilityRefs: ["verdict.core.bridge.tap"],
        },
      ],
      fragments: [
        {
          fragmentKey: "fixture.fragment.reach-home",
          displayName: "Reach home",
          businessMeaning: "Gets the app to the home screen.",
          notResponsibleFor: ["producing any verdict"],
          macroRefs: ["fixture.macro.pick"],
          producesTerminalVerdict: false,
          continueGate: { allOf: ["UI.HOME_READY"], deadlineMs: 10_000, unknownPolicy: "FAIL" },
        },
      ],
      independentWorkflows: [
        {
          workflowKey: "fixture.workflow.pick",
          displayName: "Picking works",
          businessMeaning: "Proves an item can be picked.",
          notResponsibleFor: ["downstream processing"],
          macroRefs: ["fixture.macro.pick"],
          fragmentRefs: ["fixture.fragment.reach-home"],
          occurrenceScope: "INDEPENDENT",
          oracleTemplate: {
            continueGate: { allOf: ["UI.HOME_READY"], deadlineMs: 10_000, unknownPolicy: "RETRY" },
            finalOracle: {
              requirements: [
                { factKey: "APP.PICK_CONFIRMED", obligation: "REQUIRED", timing: "IMMEDIATE", onTimeout: "FAIL" },
              ],
            },
          },
          producesTerminalVerdict: true,
        },
      ],
      launchProfiles: [
        {
          profileKey: "fixture.launch.real",
          applicationRef: "fixture.app",
          displayName: "Cold start, real path",
          startMode: "COLD_START",
          sessionPreparation: "REAL_UI_LOGIN",
          preconditionFactKeys: [],
          entry: {
            kind: "WORKFLOW_ENTRY",
            entryRef: "fixture.entry",
            expectedScreenRef: "fixture.home",
            expectedSurfaceRefs: [],
          },
          preparationOperationRefs: [],
          cleanup: { cleanupRefs: [], runOnFailure: true, deadlineMs: 10_000 },
          producesProductVerdict: true,
          releaseIsolation: {
            automationOnly: false,
            releaseGuard: "automationRelease=false",
            allowedEnvironments: ["qa"],
          },
          requiredCapabilityRefs: [],
        },
      ],
      testProfiles: [
        {
          profileKey: "fixture.profile.release",
          version: 1,
          kind: "RELEASE",
          displayName: "Release",
          applicationRef: "fixture.app",
          launchProfileRef: "fixture.launch.real",
          includedWorkflowRefs: ["fixture.workflow.pick"],
          releaseGate: true,
          telemetry: { captureArtifacts: true, evidenceSampleEveryN: 1, retainRawEvidence: true },
          performanceBudgetRefs: [],
          requiredCapabilityRefs: [],
        },
      ],
      campaigns: [
        {
          campaignKey: "fixture.campaign.gate",
          version: 1,
          displayName: "Gate",
          profileRefs: ["fixture.profile.release"],
          releaseGate: true,
          onProfileFailure: "STOP",
        },
      ],
      features: [minimalFeature()],
      capabilities: [
        {
          capabilityKey: "verdict.core.bridge.tap",
          layer: "verdict.core",
          provider: "BRIDGE",
          displayName: "Tap",
          description: "Tap a resolved target.",
          runtimeDetected: false,
          automationOnly: false,
        },
      ],
      remoteAdapters: [],
    },
  };
}

function minimalExecutable(): FeatureExecutableContract {
  return {
    featureKey: "fixture.feature.picking",
    contractVersion: 1,
    applicationRef: "fixture.app",
    macroRefs: ["fixture.macro.pick"],
    workflowRefs: ["fixture.workflow.pick"],
    invariants: [
      {
        invariantKey: "fixture.invariant.picked-item-is-requested",
        statement: "The picked item is the requested item.",
        authority: "PRODUCT_APPROVED",
        factKeys: ["APP.PICK_CONFIRMED"],
        bindsReleaseGate: true,
      },
    ],
    requiredCapabilityRefs: ["verdict.core.bridge.tap"],
    screenRefs: ["fixture.home"],
    surfaceRefs: [],
    notResponsibleFor: ["list ordering"],
  };
}

function minimalFeature(): FeatureBlueprint {
  const executable = minimalExecutable();
  return {
    featureKey: executable.featureKey,
    authoring: {
      displayName: "Picking",
      description: "Picking an item from the list.",
      owner: "fixture-owner",
      tags: ["fixture"],
    },
    executable,
    executableDigest: computeFeatureExecutableDigest(executable),
  };
}

function clone(bundle: DomainPackBundle): DomainPackBundle {
  return JSON.parse(JSON.stringify(bundle)) as DomainPackBundle;
}

function codesOf(bundle: DomainPackBundle): string[] {
  return validateDomainPackBundle(bundle).map((issue) => issue.code);
}

function messagesOf(bundle: DomainPackBundle): string[] {
  return validateDomainPackBundle(bundle).map((issue) => issue.message);
}

// ───────────────────────────────────────────────────────────────────────────
//  Baseline
// ───────────────────────────────────────────────────────────────────────────

describe("minimal bundle", () => {
  it("validates with zero issues", () => {
    expect(validateDomainPackBundle(minimalBundle())).toEqual([]);
  });

  it("parses untrusted input without throwing", () => {
    expect(parseDomainPackBundle(null).ok).toBe(false);
    expect(parseDomainPackBundle("not a bundle").ok).toBe(false);
    expect(parseDomainPackBundle({}).ok).toBe(false);
    expect(parseDomainPackBundle(JSON.parse(JSON.stringify(minimalBundle()))).ok).toBe(true);
  });

  it("returns structural issues for malformed nested JSON instead of throwing", () => {
    const malformedInputs: readonly unknown[] = [
      { manifest: {}, registries: {}, runtimeCodePolicy: {} },
      { manifest: { notResponsibleFor: [] }, registries: { applications: [] }, runtimeCodePolicy: {} },
      { manifest: [], registries: {}, runtimeCodePolicy: {} },
      { manifest: {}, registries: [], runtimeCodePolicy: {} },
      { manifest: {}, registries: { derivedFacts: {} }, runtimeCodePolicy: undefined },
    ];

    for (const input of malformedInputs) {
      expect(() => parseDomainPackBundle(input)).not.toThrow();
      const result = parseDomainPackBundle(input);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.issues.map((issue) => issue.code)).toContain("MISSING_FIELD");
    }
  });

  it("requires a manifest scope statement of non-goals", () => {
    const mutated = clone(minimalBundle());
    mutated.manifest.notResponsibleFor = [];
    expect(codesOf(mutated)).toContain("MISSING_NOT_RESPONSIBLE_FOR");
  });

  it("refuses an unsupported schema version", () => {
    const mutated = clone(minimalBundle()) as unknown as { manifest: { schemaVersion: number } };
    mutated.manifest.schemaVersion = 99;
    expect(codesOf(mutated as unknown as DomainPackBundle)).toContain("UNSUPPORTED_SCHEMA_VERSION");
  });

  it("refuses duplicate registry keys", () => {
    const mutated = clone(minimalBundle());
    mutated.registries.screens = [...mutated.registries.screens, mutated.registries.screens[0]];
    expect(codesOf(mutated)).toContain("DUPLICATE_REGISTRY_KEY");
  });

  it("formats a pack version for logs and digests", () => {
    expect(formatDomainPackVersion({ major: 2, minor: 3, patch: 4 })).toBe("2.3.4");
    expect(formatDomainPackVersion({ major: 2, minor: 3, patch: 4, prerelease: "rc.1" })).toBe("2.3.4-rc.1");
  });
});

// ───────────────────────────────────────────────────────────────────────────
//  4B.5 Application / adapter compatibility
// ───────────────────────────────────────────────────────────────────────────

describe("application compatibility", () => {
  it("refuses an app-version window that matches no build", () => {
    const mutated = clone(minimalBundle());
    mutated.registries.applications[0].versionCompatibility = { minVersionCode: 100, maxVersionCode: 50 };
    expect(codesOf(mutated)).toContain("MISSING_APP_COMPATIBILITY");
  });

  it("refuses a missing adapter compatibility declaration", () => {
    const mutated = clone(minimalBundle()) as unknown as {
      registries: { applications: { adapterCompatibility?: unknown }[] };
    };
    delete mutated.registries.applications[0].adapterCompatibility;
    expect(codesOf(mutated as unknown as DomainPackBundle)).toContain("MISSING_APP_COMPATIBILITY");
  });

  it("refuses an adapter capability that would be a second automation engine", () => {
    const mutated = clone(minimalBundle()) as unknown as {
      registries: { applications: { adapterCapabilities: { kind: string }[] }[] };
    };
    mutated.registries.applications[0].adapterCapabilities[0].kind = "WORKFLOW_BRANCH_ENGINE";
    expect(codesOf(mutated as unknown as DomainPackBundle)).toContain("FORBIDDEN_ADAPTER_CAPABILITY");
  });

  it("keeps the forbidden adapter capability list explicit", () => {
    expect(application.FORBIDDEN_APP_ADAPTER_CAPABILITY_KINDS).toContain("UI_ACTION_EXECUTOR");
    expect(application.FORBIDDEN_APP_ADAPTER_CAPABILITY_KINDS).toContain("RAW_HTTP_RUNNER");
    expect(application.FORBIDDEN_APP_ADAPTER_CAPABILITY_KINDS).toContain("BACKEND_MUTATION_HOOK");
  });

  it("refuses a mutating adapter seam that is not automation-only", () => {
    const mutated = clone(minimalBundle());
    mutated.registries.applications[0].adapterCapabilities[0] = {
      kind: "SESSION_PREPARATION",
      operationRefs: ["fixture.setup.session"],
      automationOnly: false,
      releaseGuard: "automationRelease=false",
      mutating: true,
    };
    expect(codesOf(mutated)).toContain("ADAPTER_SEAM_NOT_ISOLATED");
  });

  it("refuses an automation-only seam with no named release guard", () => {
    const mutated = clone(minimalBundle());
    mutated.registries.applications[0].adapterCapabilities[0].releaseGuard = "";
    expect(codesOf(mutated)).toContain("ADAPTER_SEAM_NOT_ISOLATED");
  });
});

// ───────────────────────────────────────────────────────────────────────────
//  4B.6 Screen / Surface registry
// ───────────────────────────────────────────────────────────────────────────

describe("screen and surface registries", () => {
  it("refuses an overlay declared as a screen", () => {
    const mutated = clone(minimalBundle());
    mutated.registries.screens[0].screenKey = "fixture.confirm-dialog-screen";
    mutated.registries.surfaces[0].parentScreenRefs = ["*"];
    expect(codesOf(mutated)).toContain("DIALOG_DECLARED_AS_SCREEN");
  });

  it("refuses a surface whose parent screen does not host it", () => {
    const mutated = clone(minimalBundle());
    mutated.registries.screens[0].supportedSurfaceRefs = [];
    expect(codesOf(mutated)).toContain("SURFACE_PARENT_INCOMPATIBLE");
  });

  it("refuses a screen with no entry strategy", () => {
    const mutated = clone(minimalBundle());
    mutated.registries.screens[0].entryStrategies = [];
    expect(codesOf(mutated)).toContain("MISSING_FIELD");
  });

  it("refuses a HANDLE surface with no handler macro", () => {
    const mutated = clone(minimalBundle());
    mutated.registries.surfaces[0].defaultPolicy = "HANDLE";
    expect(codesOf(mutated)).toContain("MISSING_FIELD");
  });

  it("breaks same-priority interrupt ties deterministically", () => {
    const base: SurfaceDefinition = minimalBundle().registries.surfaces[0];
    const a: SurfaceDefinition = { ...base, surfaceKey: "a.surface", priority: 10 };
    const b: SurfaceDefinition = { ...base, surfaceKey: "b.surface", priority: 10 };
    const higher: SurfaceDefinition = { ...base, surfaceKey: "z.surface", priority: 99 };

    expect([b, a, higher].sort(compareSurfacePriority).map((s) => s.surfaceKey)).toEqual([
      "z.surface",
      "a.surface",
      "b.surface",
    ]);
    // The order must not depend on input order.
    expect([a, higher, b].sort(compareSurfacePriority).map((s) => s.surfaceKey)).toEqual([
      "z.surface",
      "a.surface",
      "b.surface",
    ]);
  });

  it("lets a global surface appear over any screen", () => {
    const base = minimalBundle().registries.surfaces[0];
    expect(surfaceAllowedOnScreen({ ...base, parentScreenRefs: ["*"] }, "anything")).toBe(true);
    expect(surfaceAllowedOnScreen(base, "fixture.home")).toBe(true);
    expect(surfaceAllowedOnScreen(base, "somewhere.else")).toBe(false);
  });

  it("keeps surface kinds and screen implementations closed unions", () => {
    expect(screenSurface.SURFACE_KINDS).toContain("SCANNER");
    expect(screenSurface.SURFACE_KINDS).not.toContain("OTHER");
    expect(screenSurface.SCREEN_RUNTIME_IMPLEMENTATION_KINDS).toContain("COMPOSE");
  });
});

// ───────────────────────────────────────────────────────────────────────────
//  4B.7 Target resolution provider chain
// ───────────────────────────────────────────────────────────────────────────

describe("target resolution provider chain", () => {
  const validPolicy = (): TargetResolutionPolicy => minimalBundle().registries.targets[0].resolution;

  it("defaults ambiguity to fail-closed and offers no first-match escape", () => {
    expect(DEFAULT_AMBIGUITY_POLICY).toBe("FAIL");
    expect(entityTarget.AMBIGUITY_POLICIES).not.toContain("FIRST_MATCH");
  });

  it("accepts a chain whose hint comes last and claims no identity", () => {
    expect(validateTargetResolutionPolicy(validPolicy(), "$")).toEqual([]);
  });

  it("refuses a row index that claims identity", () => {
    const policy = validPolicy();
    const chain = policy.chain.map((s) => (s.kind === "ROW_INDEX_HINT" ? { ...s, establishesIdentity: true } : s));
    const codes = validateTargetResolutionPolicy({ ...policy, chain }, "$").map((v) => v.code);
    expect(codes).toContain("ROW_INDEX_AS_IDENTITY");
  });

  it("refuses a row index placed before a real provider", () => {
    const policy = validPolicy();
    const codes = validateTargetResolutionPolicy(
      { ...policy, chain: [policy.chain[2], policy.chain[0]] },
      "$",
    ).map((v) => v.code);
    expect(codes).toContain("ROW_INDEX_NOT_LAST");
  });

  it("refuses a hint-only chain", () => {
    const policy = validPolicy();
    const codes = validateTargetResolutionPolicy({ ...policy, chain: [policy.chain[2]] }, "$").map((v) => v.code);
    expect(codes).toContain("NO_IDENTITY_PROVIDER");
  });

  it("refuses an empty chain and a non-positive deadline", () => {
    const policy = validPolicy();
    expect(validateTargetResolutionPolicy({ ...policy, chain: [] }, "$").map((v) => v.code)).toEqual(["EMPTY_CHAIN"]);
    expect(validateTargetResolutionPolicy({ ...policy, deadlineMs: 0 }, "$").map((v) => v.code)).toContain(
      "INVALID_DEADLINE",
    );
  });

  it("requires an entity binding when the chain resolves by entity", () => {
    const mutated = clone(minimalBundle());
    delete mutated.registries.targets[0].entityBinding;
    expect(codesOf(mutated)).toContain("TARGET_RESOLUTION_INVALID");
  });

  it("requires the entity projection to be bounded", () => {
    const mutated = clone(minimalBundle());
    const binding = mutated.registries.targets[0].entityBinding;
    if (binding !== undefined) (binding as { projectedPaths: string[] }).projectedPaths = [];
    expect(codesOf(mutated)).toContain("TARGET_RESOLUTION_INVALID");
  });

  it("refuses a target on an unknown screen", () => {
    const mutated = clone(minimalBundle());
    mutated.registries.targets[0].screenRef = "nowhere";
    expect(codesOf(mutated)).toContain("UNKNOWN_REGISTRY_REF");
  });

  it("marks only the row index hint as a non-identity strategy", () => {
    expect(entityTarget.NON_IDENTITY_STRATEGY_KINDS).toEqual(["ROW_INDEX_HINT"]);
  });
});

// ───────────────────────────────────────────────────────────────────────────
//  4B.9 Evidence sources and derived facts
// ───────────────────────────────────────────────────────────────────────────

describe("evidence source registry", () => {
  const uiSource = (): EvidenceSourceDefinition => minimalBundle().registries.evidenceSources[0];

  it("has exactly four planes and refuses mechanism-as-plane", () => {
    expect(EVIDENCE_PLANES).toEqual(["UI", "APP", "LOCAL", "REMOTE"]);
    expect(FORBIDDEN_EVIDENCE_PLANES).toContain("QUEUE");
    expect(FORBIDDEN_EVIDENCE_PLANES).toContain("APP_STATE");

    const codes = validateEvidenceSource(
      { ...uiSource(), plane: "QUEUE" as unknown as "UI" },
      "$",
    ).map((v) => v.code);
    expect(codes).toContain("FORBIDDEN_PLANE");
  });

  it("keeps the offline queue as a LOCAL source kind", () => {
    expect(ALLOWED_SOURCE_KINDS_BY_PLANE.LOCAL).toContain("OFFLINE_QUEUE_WATCH");
    expect(ALLOWED_SOURCE_KINDS_BY_PLANE.UI).not.toContain("OFFLINE_QUEUE_WATCH");
  });

  it("keeps SDK state as an APP source kind rather than its own plane", () => {
    expect(ALLOWED_SOURCE_KINDS_BY_PLANE.APP).toContain("SDK_STATE");
    expect(ALLOWED_SOURCE_KINDS_BY_PLANE.APP).toContain("SDK_EVENT");
  });

  it("refuses a source kind that plane cannot observe", () => {
    const codes = validateEvidenceSource({ ...uiSource(), kind: "REMOTE_VALIDATOR" }, "$").map((v) => v.code);
    expect(codes).toContain("SOURCE_KIND_PLANE_MISMATCH");
  });

  it("refuses an HTTP 2xx source binding a business fact or holding primary authority", () => {
    const codes = validateEvidenceSource(
      {
        ...uiSource(),
        plane: "REMOTE",
        kind: "NETWORK_OPERATION",
        authority: "PRIMARY",
        factKey: "REMOTE.THING_HAPPENED",
        transportSuccessOnly: true,
      },
      "$",
    ).map((v) => v.code);
    expect(codes).toContain("TRANSPORT_SUCCESS_AS_BUSINESS_FACT");
    expect(codes).toContain("TRANSPORT_SUCCESS_PRIMARY");
  });

  it("accepts a transport-only source that binds nothing", () => {
    expect(
      validateEvidenceSource(
        {
          ...uiSource(),
          plane: "REMOTE",
          kind: "NETWORK_OPERATION",
          authority: "FALLBACK",
          factKey: undefined,
          transportSuccessOnly: true,
        },
        "$",
      ),
    ).toEqual([]);
  });

  it("refuses a source that discards its raw observation", () => {
    const codes = validateEvidenceSource({ ...uiSource(), preservesRawEvidence: false }, "$").map((v) => v.code);
    expect(codes).toContain("RAW_EVIDENCE_DISCARDED");
  });

  it("refuses an unknown authority", () => {
    const codes = validateEvidenceSource(
      { ...uiSource(), authority: "DEFINITELY" as unknown as "PRIMARY" },
      "$",
    ).map((v) => v.code);
    expect(codes).toContain("INVALID_AUTHORITY");
  });
});

describe("derived fact graph", () => {
  const graph = (inputs: readonly string[], factKey = "APP.DERIVED"): DerivedFactGraph => ({
    facts: [
      {
        factKey,
        plane: "APP",
        authority: "PRIMARY",
        displayName: "Derived",
        provenance: { reducerKind: "ALL_OF", reducerVersion: 1, inputFactKeys: inputs },
        preserveInputs: true,
        requiresCorrelation: true,
      },
    ],
  });

  it("accepts a derivation over known raw facts", () => {
    expect(validateDerivedFactGraph(graph(["UI.A", "UI.B"]), ["UI.A", "UI.B"], "$")).toEqual([]);
  });

  it("refuses a self-referencing derivation", () => {
    const codes = validateDerivedFactGraph(graph(["APP.DERIVED"]), [], "$").map((v) => v.code);
    expect(codes).toContain("DERIVED_FACT_SELF_REFERENCE");
  });

  it("refuses a derivation with no inputs", () => {
    const codes = validateDerivedFactGraph(graph([]), [], "$").map((v) => v.code);
    expect(codes).toContain("DERIVED_FACT_NO_INPUTS");
  });

  it("refuses an input nothing produces", () => {
    const codes = validateDerivedFactGraph(graph(["UI.TYPO"]), ["UI.A"], "$").map((v) => v.code);
    expect(codes).toContain("DERIVED_FACT_UNDEFINED_INPUT");
  });

  it("refuses a two-node cycle", () => {
    const cyclic: DerivedFactGraph = {
      facts: [
        { ...graph(["APP.B"], "APP.A").facts[0] },
        { ...graph(["APP.A"], "APP.B").facts[0] },
      ],
    };
    const codes = validateDerivedFactGraph(cyclic, [], "$").map((v) => v.code);
    expect(codes).toContain("DERIVED_FACT_CYCLE");
  });

  it("refuses a derivation that replaces its inputs", () => {
    const mutated = graph(["UI.A"]);
    (mutated.facts[0] as { preserveInputs: boolean }).preserveInputs = false;
    const codes = validateDerivedFactGraph(mutated, ["UI.A"], "$").map((v) => v.code);
    expect(codes).toContain("DERIVED_INPUTS_NOT_PRESERVED");
  });

  it("offers no author-supplied reducer body", () => {
    expect(evidenceSource.DERIVED_FACT_REDUCER_KINDS).not.toContain("CUSTOM");
    for (const kind of evidenceSource.DERIVED_FACT_REDUCER_KINDS) {
      expect(kind).toMatch(/^[A-Z_]+$/);
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
//  4B.8 Macro / fragment contract
// ───────────────────────────────────────────────────────────────────────────

describe("semantic macros and fragments", () => {
  it("keeps the Continue Gate and the Final Oracle structurally separate", () => {
    const macro = minimalBundle().registries.macros[0];
    expect(macro.oracleTemplate.continueGate.deadlineMs).toBeGreaterThan(0);
    expect(macro.oracleTemplate.finalOracle.requirements.length).toBeGreaterThan(0);
    expect("requirements" in macro.oracleTemplate.continueGate).toBe(false);
    expect("unknownPolicy" in macro.oracleTemplate.finalOracle).toBe(false);
  });

  it("refuses a macro with no oracle requirement", () => {
    const mutated = clone(minimalBundle());
    mutated.registries.macros[0].oracleTemplate.finalOracle.requirements = [];
    expect(messagesOf(mutated).some((m) => m.includes("MACRO_MISSING_ORACLE"))).toBe(true);
  });

  it("refuses an untyped entity input", () => {
    const mutated = clone(minimalBundle());
    delete mutated.registries.macros[0].input.fields[0].entityTypeRef;
    expect(messagesOf(mutated).some((m) => m.includes("MACRO_ENTITY_INPUT_UNTYPED"))).toBe(true);
  });

  it("refuses a macro referencing a registry entry the pack does not define", () => {
    const mutated = clone(minimalBundle());
    mutated.registries.macros[0].allowedRegistryRefs.targetRefs = ["fixture.target.nowhere"];
    expect(messagesOf(mutated).some((m) => m.includes("MACRO_UNDECLARED_REF"))).toBe(true);
  });

  it("refuses a macro whose action does not exist", () => {
    const mutated = clone(minimalBundle());
    mutated.registries.macros[0].actionRef = "fixture.action.nowhere";
    expect(codesOf(mutated)).toContain("UNKNOWN_REGISTRY_REF");
  });

  it("refuses a fragment that produces a terminal verdict", () => {
    const fragment = minimalBundle().registries.fragments[0];
    const broken = { ...fragment, producesTerminalVerdict: true } as unknown as ReusableFlowFragmentDefinition;
    const codes = validateReusableFlowFragment(broken, "$").map((v) => v.code);
    expect(codes).toContain("FRAGMENT_PRODUCES_VERDICT");
  });

  it("refuses a fragment that carries a Final Oracle", () => {
    const fragment = minimalBundle().registries.fragments[0];
    const broken = {
      ...fragment,
      oracleTemplate: { finalOracle: { requirements: [] } },
    } as unknown as ReusableFlowFragmentDefinition;
    const codes = validateReusableFlowFragment(broken, "$").map((v) => v.code);
    expect(codes).toContain("FRAGMENT_HAS_FINAL_ORACLE");
  });

  it("refuses an independent workflow that shares an occurrence scope", () => {
    const mutated = clone(minimalBundle()) as unknown as {
      registries: { independentWorkflows: { occurrenceScope: string }[] };
    };
    mutated.registries.independentWorkflows[0].occurrenceScope = "SHARED";
    expect(codesOf(mutated as unknown as DomainPackBundle)).toContain("SEMANTIC_ACTION_INVALID");
  });

  it("refuses an independent workflow with no oracle of its own", () => {
    const mutated = clone(minimalBundle());
    mutated.registries.independentWorkflows[0].oracleTemplate.finalOracle.requirements = [];
    expect(codesOf(mutated)).toContain("SEMANTIC_ACTION_INVALID");
  });

  it("refuses a semantic action with no declared non-goals", () => {
    const mutated = clone(minimalBundle());
    mutated.registries.semanticActions[0].notResponsibleFor = [];
    expect(codesOf(mutated)).toContain("MISSING_NOT_RESPONSIBLE_FOR");
  });

  it("refuses an expansion snapshot that is not WorkflowIR v2", () => {
    const codes = semanticAction
      .validateExpansionSnapshot(
        {
          macroRef: "fixture.macro.pick",
          authoredBy: "HAND",
          genericIr: { schemaVersion: 1 } as never,
          irSourceMap: [],
          domainSourceMap: [{ ref: "d1", macroRef: "fixture.macro.pick", planStepIds: [] }],
        },
        "fixture.macro.pick",
        "$",
      )
      .map((v) => v.code);
    expect(codes).toContain("EXPANSION_NOT_GENERIC_IR");
  });

  it("refuses an expansion snapshot whose source map does not reach its macro", () => {
    const codes = semanticAction
      .validateExpansionSnapshot(
        {
          macroRef: "fixture.macro.pick",
          authoredBy: "HAND",
          genericIr: { schemaVersion: 2, steps: [] } as never,
          irSourceMap: [],
          domainSourceMap: [{ ref: "d1", macroRef: "some.other.macro", planStepIds: [] }],
        },
        "fixture.macro.pick",
        "$",
      )
      .map((v) => v.code);
    expect(codes).toContain("EXPANSION_SOURCE_MAP_BROKEN");
  });
});

// ───────────────────────────────────────────────────────────────────────────
//  4B.10 Launch / test profiles
// ───────────────────────────────────────────────────────────────────────────

describe("launch profiles", () => {
  const realLogin = (): LaunchProfile => minimalBundle().registries.launchProfiles[0];

  it("names the setup-only session modes explicitly", () => {
    expect(SETUP_ONLY_SESSION_MODES).toEqual(["PREPARED_SESSION", "DIRECT_STATE"]);
  });

  it("accepts a real-login profile that carries a verdict", () => {
    expect(validateLaunchProfile(realLogin(), "$")).toEqual([]);
  });

  it("refuses a prepared session that claims a product verdict", () => {
    const codes = validateLaunchProfile(
      { ...realLogin(), sessionPreparation: "PREPARED_SESSION", producesProductVerdict: true },
      "$",
    ).map((v) => v.code);
    expect(codes).toContain("SETUP_LAUNCH_PRODUCES_VERDICT");
  });

  it("refuses a direct-state profile that claims a product verdict", () => {
    const codes = validateLaunchProfile(
      { ...realLogin(), sessionPreparation: "DIRECT_STATE", producesProductVerdict: true },
      "$",
    ).map((v) => v.code);
    expect(codes).toContain("SETUP_LAUNCH_PRODUCES_VERDICT");
  });

  it("refuses a session-injection seam that is not automation-only", () => {
    const codes = validateLaunchProfile(
      {
        ...realLogin(),
        sessionPreparation: "PREPARED_SESSION",
        producesProductVerdict: false,
        releaseIsolation: { ...realLogin().releaseIsolation, automationOnly: false },
      },
      "$",
    ).map((v) => v.code);
    expect(codes).toContain("SETUP_LAUNCH_WITHOUT_ISOLATION");
  });

  it("refuses a real-login profile that also shortcuts preparation", () => {
    const codes = validateLaunchProfile(
      { ...realLogin(), preparationOperationRefs: ["fixture.setup.session"] },
      "$",
    ).map((v) => v.code);
    expect(codes).toContain("REAL_LOGIN_WITH_PREPARATION_OPS");
  });

  it("requires a cleanup deadline", () => {
    const codes = validateLaunchProfile(
      { ...realLogin(), cleanup: { cleanupRefs: [], runOnFailure: true, deadlineMs: 0 } },
      "$",
    ).map((v) => v.code);
    expect(codes).toContain("MISSING_CLEANUP_DEADLINE");
  });

  it("refuses an entry screen the pack does not define", () => {
    const mutated = clone(minimalBundle());
    mutated.registries.launchProfiles[0].entry.expectedScreenRef = "nowhere";
    expect(codesOf(mutated)).toContain("UNKNOWN_REGISTRY_REF");
  });
});

describe("test profiles and campaigns", () => {
  const release = (): TestProfileDefinition => minimalBundle().registries.testProfiles[0];

  it("accepts a release profile that observes every occurrence", () => {
    expect(validateTestProfile(release(), "$")).toEqual([]);
  });

  it("refuses a preview profile that gates a release", () => {
    const codes = validateTestProfile({ ...release(), kind: "PREVIEW", releaseGate: true }, "$").map((v) => v.code);
    expect(codes).toContain("PREVIEW_PROFILE_GATES_RELEASE");
  });

  it("refuses a diagnostic profile that gates a release", () => {
    const codes = validateTestProfile({ ...release(), kind: "DIAGNOSTIC", releaseGate: true }, "$").map((v) => v.code);
    expect(codes).toContain("PREVIEW_PROFILE_GATES_RELEASE");
  });

  it("refuses a gating profile that samples its evidence", () => {
    const codes = validateTestProfile(
      { ...release(), telemetry: { captureArtifacts: true, evidenceSampleEveryN: 3, retainRawEvidence: true } },
      "$",
    ).map((v) => v.code);
    expect(codes).toContain("GATING_PROFILE_SAMPLES_EVIDENCE");
  });

  it("refuses a fault with no correlation or no expected recovery", () => {
    const codes = validateTestProfile(
      {
        ...release(),
        kind: "BAD_DAY",
        releaseGate: false,
        faultPlan: {
          expectRecovery: true,
          injections: [
            {
              faultRef: "fixture.fault.drop",
              kind: "NETWORK",
              triggerRef: "fixture.macro.pick",
              correlationFactKey: "",
              expectedRecoveryFactKey: "",
            },
          ],
        },
      },
      "$",
    ).map((v) => v.code);
    expect(codes).toContain("FAULT_WITHOUT_CORRELATION");
    expect(codes).toContain("FAULT_WITHOUT_EXPECTED_RECOVERY");
  });

  it("refuses a differential profile with no baseline", () => {
    const codes = validateTestProfile({ ...release(), kind: "DIFFERENTIAL", releaseGate: false }, "$").map(
      (v) => v.code,
    );
    expect(codes).toContain("DIFFERENTIAL_WITHOUT_BASELINE");
  });

  it("refuses a differential profile with no critical facts", () => {
    const codes = validateTestProfile(
      {
        ...release(),
        kind: "DIFFERENTIAL",
        releaseGate: false,
        differential: { baselineBuildRef: "b", criticalFactKeys: [], onCriticalDiff: "FAIL" },
      },
      "$",
    ).map((v) => v.code);
    expect(codes).toContain("DIFFERENTIAL_WITHOUT_CRITICAL_FACTS");
  });

  it("refuses a gating campaign made only of non-gating profiles", () => {
    const mutated = clone(minimalBundle());
    mutated.registries.testProfiles[0].kind = "PREVIEW";
    mutated.registries.testProfiles[0].releaseGate = false;
    expect(codesOf(mutated)).toContain("PROFILE_INVALID");
  });

  it("carries no execution or scheduling field on a campaign", () => {
    const campaign = minimalBundle().registries.campaigns[0] as unknown as Record<string, unknown>;
    for (const forbidden of ["queue", "lease", "worker", "disposition", "heartbeat"]) {
      expect(campaign[forbidden]).toBeUndefined();
    }
  });
});

// ───────────────────────────────────────────────────────────────────────────
//  4B.11 Feature authoring/executable split, capability layers
// ───────────────────────────────────────────────────────────────────────────

describe("feature authoring / executable split", () => {
  it("computes the digest over the executable contract alone", () => {
    const feature = minimalFeature();
    const authoringChanged: FeatureBlueprint = {
      ...feature,
      authoring: {
        ...feature.authoring,
        description: "completely different prose",
        tags: ["other"],
        reviewNotes: ["re-reviewed"],
        lastEditedBy: "someone",
      },
    };

    // The guarantee: prose churn cannot invalidate a pinned run.
    expect(computeFeatureExecutableDigest(authoringChanged.executable)).toBe(feature.executableDigest);
    expect(validateFeatureBlueprint(authoringChanged, "$")).toEqual([]);
  });

  it("moves the digest when the executable contract changes", () => {
    const feature = minimalFeature();
    const changed = computeFeatureExecutableDigest({ ...feature.executable, contractVersion: 2 });
    expect(changed).not.toBe(feature.executableDigest);
  });

  it("detects a stale recorded digest", () => {
    const feature = minimalFeature();
    const codes = validateFeatureBlueprint({ ...feature, executableDigest: "sha256:0" }, "$").map((v) => v.code);
    expect(codes).toContain("FEATURE_DIGEST_MISMATCH");
  });

  it("refuses authoring metadata smuggled into the executable contract", () => {
    const feature = minimalFeature();
    const executable = { ...feature.executable, description: "prose" } as unknown as FeatureExecutableContract;
    const codes = validateFeatureBlueprint(
      { ...feature, executable, executableDigest: computeFeatureExecutableDigest(executable) },
      "$",
    ).map((v) => v.code);
    expect(codes).toContain("AUTHORING_FIELD_IN_EXECUTABLE");
  });

  it("refuses an AI_SUGGESTED invariant bound to a release gate", () => {
    const feature = minimalFeature();
    const executable: FeatureExecutableContract = {
      ...feature.executable,
      invariants: [{ ...feature.executable.invariants[0], authority: "AI_SUGGESTED" }],
    };
    const codes = validateFeatureBlueprint(
      { ...feature, executable, executableDigest: computeFeatureExecutableDigest(executable) },
      "$",
    ).map((v) => v.code);
    expect(codes).toContain("AI_INVARIANT_GATES_RELEASE");
  });

  it("accepts an AI_SUGGESTED invariant that does not gate", () => {
    const feature = minimalFeature();
    const executable: FeatureExecutableContract = {
      ...feature.executable,
      invariants: [{ ...feature.executable.invariants[0], authority: "AI_SUGGESTED", bindsReleaseGate: false }],
    };
    expect(
      validateFeatureBlueprint(
        { ...feature, executable, executableDigest: computeFeatureExecutableDigest(executable) },
        "$",
      ),
    ).toEqual([]);
  });

  it("names the authorities that may gate", () => {
    expect(GATING_INVARIANT_AUTHORITIES).toEqual(["PRODUCT_APPROVED", "TECHNICAL_DEFAULT"]);
    expect(GATING_INVARIANT_AUTHORITIES).not.toContain("AI_SUGGESTED");
  });

  it("refuses an invariant nothing can observe", () => {
    const feature = minimalFeature();
    const executable: FeatureExecutableContract = {
      ...feature.executable,
      invariants: [{ ...feature.executable.invariants[0], factKeys: [] }],
    };
    const codes = validateFeatureBlueprint(
      { ...feature, executable, executableDigest: computeFeatureExecutableDigest(executable) },
      "$",
    ).map((v) => v.code);
    expect(codes).toContain("INVARIANT_WITHOUT_EVIDENCE");
  });
});

describe("capability catalog", () => {
  it("keeps the shared catalog free of hardcoded tenant layers", () => {
    expect(featureCapability.CAPABILITY_LAYERS).toEqual(["verdict.core"]);
    expect(featureCapability.CORE_CAPABILITY_LAYER).toBe("verdict.core");
  });

  it("refuses a capability id that does not carry its layer", () => {
    const codes = validateCapabilityContract(
      {
        capabilityKey: "bridge.tap",
        layer: "verdict.core",
        provider: "BRIDGE",
        displayName: "Tap",
        description: "",
        runtimeDetected: false,
        automationOnly: false,
      },
      "$",
    ).map((v) => v.code);
    expect(codes).toContain("CAPABILITY_LAYER_PREFIX_MISMATCH");
  });

  it("refuses a tenant-shaped capability promoted to core with no evidence", () => {
    const codes = validateCapabilityContract(
      {
        capabilityKey: "verdict.core.domain.fixture.scanner-inject",
        layer: "verdict.core",
        provider: "APP_ADAPTER",
        displayName: "Injection",
        description: "",
        runtimeDetected: false,
        automationOnly: true,
      },
      "$",
    ).map((v) => v.code);
    expect(codes).toContain("DOMAIN_CAPABILITY_CLAIMS_CORE");
  });

  it("accepts the same promotion once evidence is recorded", () => {
    expect(
      validateCapabilityContract(
        {
          capabilityKey: "verdict.core.domain.fixture.scanner-inject",
          layer: "verdict.core",
          provider: "APP_ADAPTER",
          displayName: "Injection",
          description: "",
          runtimeDetected: false,
          automationOnly: true,
          promotionEvidenceRefs: ["adr://second-tenant-needs-the-same-shape"],
        },
        "$",
      ),
    ).toEqual([]);
  });

  it("refuses a runtime-detected capability with no detection ref", () => {
    const codes = validateCapabilityContract(
      {
        capabilityKey: "domain.fixture.thing",
        layer: "domain.fixture",
        provider: "APP_ADAPTER",
        displayName: "Thing",
        description: "",
        runtimeDetected: true,
        automationOnly: false,
      },
      "$",
    ).map((v) => v.code);
    expect(codes).toContain("UNDETECTED_RUNTIME_CAPABILITY");
  });

  it("refuses a feature requiring a capability the pack never declares", () => {
    const mutated = clone(minimalBundle());
    mutated.registries.features[0].executable.requiredCapabilityRefs = ["nowhere.capability"];
    mutated.registries.features[0].executableDigest = computeFeatureExecutableDigest(
      mutated.registries.features[0].executable,
    );
    expect(codesOf(mutated)).toContain("UNKNOWN_REGISTRY_REF");
  });
});

// ───────────────────────────────────────────────────────────────────────────
//  Remote adapter allowlist
// ───────────────────────────────────────────────────────────────────────────

describe("remote adapter allowlist", () => {
  const readOperation = (): RemoteAdapterOperation => ({
    operationRef: "fixture.backoffice.read-thing",
    displayName: "Read thing",
    businessMeaning: "Reads a record.",
    role: "VALIDATION",
    actorRole: "BACK_OFFICE_SYSTEM",
    effectClass: "READ_ONLY",
    idempotencyClass: "NATURALLY_IDEMPOTENT",
    inputs: [],
    outputs: [
      {
        factKey: "REMOTE.THING_OK",
        responsePath: "thing.ok",
        entityStatusPath: "thing.status",
        correlationPath: "thing.correlationId",
      },
    ],
    audit: { recordRequest: true, recordResponse: true, redactFields: [] },
    allowedEnvironments: ["qa"],
  });

  it("accepts a typed, audited, correlated read", () => {
    expect(validateRemoteAdapterOperation(readOperation(), "$")).toEqual([]);
  });

  it("refuses transport detail in any of its named fields", () => {
    for (const field of remoteAdapter.FORBIDDEN_REMOTE_OPERATION_FIELDS) {
      const codes = validateRemoteAdapterOperation(
        { ...readOperation(), [field]: "https://example.invalid" } as unknown as RemoteAdapterOperation,
        "$",
      ).map((v) => v.code);
      expect(codes).toContain("RAW_HTTP_FIELD");
    }
  });

  it("refuses a validation output with no entity status or correlation", () => {
    const codes = validateRemoteAdapterOperation(
      { ...readOperation(), outputs: [{ factKey: "REMOTE.THING_OK", responsePath: "thing.ok" }] },
      "$",
    ).map((v) => v.code);
    expect(codes).toContain("BUSINESS_FACT_WITHOUT_ENTITY_STATUS");
  });

  it("refuses a transport-only operation used as validation", () => {
    const codes = validateRemoteAdapterOperation({ ...readOperation(), transportSuccessOnly: true }, "$").map(
      (v) => v.code,
    );
    expect(codes).toContain("TRANSPORT_SUCCESS_AS_VALIDATION");
  });

  it("refuses a validation operation binding no fact", () => {
    const codes = validateRemoteAdapterOperation({ ...readOperation(), outputs: [] }, "$").map((v) => v.code);
    expect(codes).toContain("VALIDATION_WITHOUT_OUTPUT_FACT");
  });

  it("refuses a setup operation binding business evidence", () => {
    const codes = validateRemoteAdapterOperation({ ...readOperation(), role: "SETUP" }, "$").map((v) => v.code);
    expect(codes).toContain("SETUP_BINDS_BUSINESS_FACT");
  });

  it("refuses an unaudited or unbounded mutation", () => {
    const codes = validateRemoteAdapterOperation(
      {
        ...readOperation(),
        role: "ACTOR_ACTION",
        effectClass: "IDEMPOTENT_MUTATION",
        idempotencyClass: "KEYED",
        outputs: [],
        audit: { recordRequest: false, recordResponse: false, redactFields: [] },
        allowedEnvironments: [],
      },
      "$",
    ).map((v) => v.code);
    expect(codes).toContain("UNAUDITED_MUTATION");
    expect(codes).toContain("MUTATION_WITHOUT_ENVIRONMENT_ALLOWLIST");
  });

  it("refuses an untyped entity input", () => {
    const codes = validateRemoteAdapterOperation(
      { ...readOperation(), inputs: [{ name: "thing", type: "entityRef", required: true }] },
      "$",
    ).map((v) => v.code);
    expect(codes).toContain("ENTITY_INPUT_UNTYPED");
  });
});

// ───────────────────────────────────────────────────────────────────────────
//  4B.12 Canonical form, digest, immutability, runtime code
// ───────────────────────────────────────────────────────────────────────────

describe("canonical serialization and digest", () => {
  it("ignores key order", () => {
    expect(canonicalizeDomainDocument({ a: 1, b: { c: 2, d: 3 } })).toBe(
      canonicalizeDomainDocument({ b: { d: 3, c: 2 }, a: 1 }),
    );
    expect(digestDomainDocument({ a: 1, b: 2 })).toBe(digestDomainDocument({ b: 2, a: 1 }));
  });

  it("distinguishes absent from null and preserves array order", () => {
    expect(canonicalizeDomainDocument({ a: undefined, b: 1 })).toBe('{"b":1}');
    expect(canonicalizeDomainDocument({ a: null, b: 1 })).toBe('{"a":null,"b":1}');
    expect(canonicalizeDomainDocument([1, 2])).not.toBe(canonicalizeDomainDocument([2, 1]));
  });

  it("refuses non-finite numbers instead of coercing them to null", () => {
    // JSON.stringify(NaN) is `null`, which would make two different broken packs
    // digest identically.
    expect(() => canonicalizeDomainDocument({ a: Number.NaN })).toThrow(/non-finite/);
    expect(() => canonicalizeDomainDocument({ a: Number.POSITIVE_INFINITY })).toThrow(/non-finite/);
  });

  it("compares documents by content", () => {
    expect(domainDocumentsEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
    expect(domainDocumentsEqual({ a: 1 }, { a: 2 })).toBe(false);
  });

  it("prefixes the digest with its algorithm", () => {
    expect(digestDomainDocument({})).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("digests a bundle deterministically and independently of provenance", () => {
    const a = minimalBundle();
    const b = minimalBundle();
    expect(computeBundleDigest(a)).toBe(computeBundleDigest(b));

    const withProvenance = clone(a);
    withProvenance.manifest.provenance = {
      bundleDigest: "sha256:0",
      publishedAt: "2026-01-01T00:00:00.000Z",
      publishedBy: "x",
      sourceCommit: "abc",
    };
    // Provenance is excluded, otherwise the digest would have to exist before it
    // could be recorded.
    expect(computeBundleDigest(withProvenance)).toBe(computeBundleDigest(a));
  });
});

describe("publication and immutability", () => {
  it("publishes with a matching digest and validates afterwards", () => {
    const published = publishBundle(minimalBundle(), {
      publishedAt: "2026-08-05T00:00:00.000Z",
      publishedBy: "suite",
      sourceCommit: "deadbeef",
    });
    expect(published.bundle.manifest.provenance?.bundleDigest).toBe(published.digest);
    expect(validateDomainPackBundle(published.bundle)).toEqual([]);
  });

  it("deep-freezes the published bundle", () => {
    const published = publishBundle(minimalBundle(), {
      publishedAt: "2026-08-05T00:00:00.000Z",
      publishedBy: "suite",
      sourceCommit: "deadbeef",
    });
    expect(Object.isFrozen(published.bundle)).toBe(true);
    expect(Object.isFrozen(published.bundle.registries)).toBe(true);
    expect(Object.isFrozen(published.bundle.registries.targets[0].resolution)).toBe(true);
    expect(() => {
      (published.bundle.manifest as { packName: string }).packName = "edited";
    }).toThrow();
  });

  it("refuses a published bundle with no provenance", () => {
    const mutated = clone(minimalBundle());
    mutated.manifest.publicationState = "PUBLISHED";
    expect(codesOf(mutated)).toContain("PUBLISHED_WITHOUT_PROVENANCE");
  });

  it("detects a published bundle edited in place", () => {
    const published = publishBundle(minimalBundle(), {
      publishedAt: "2026-08-05T00:00:00.000Z",
      publishedBy: "suite",
      sourceCommit: "deadbeef",
    });
    const tampered = clone(published.bundle);
    tampered.manifest.owner = "someone-else";
    expect(codesOf(tampered)).toContain("PUBLISHED_DIGEST_MISMATCH");
  });

  it("keeps a pinned run tied to a digest, not to a moving pointer", () => {
    const published = publishBundle(minimalBundle(), {
      publishedAt: "2026-08-05T00:00:00.000Z",
      publishedBy: "suite",
      sourceCommit: "deadbeef",
    });
    const pinned = {
      workflowRunId: "run-1",
      packKey: published.packKey,
      version: published.version,
      digest: published.digest,
      pinnedAt: "2026-08-05T00:00:01.000Z",
    };
    expect(pinnedBundleMatches(pinned, published)).toBe(true);

    // A hot reload publishes a new version; the running test must not follow it.
    const reloaded = publishBundle(
      { ...minimalBundle(), manifest: { ...minimalBundle().manifest, businessScope: "changed" } },
      { publishedAt: "2026-08-05T01:00:00.000Z", publishedBy: "suite", sourceCommit: "cafe" },
    );
    expect(pinnedBundleMatches(pinned, reloaded)).toBe(false);
  });

  it("refuses a third-party pack that gates a release", () => {
    const mutated = clone(minimalBundle());
    mutated.manifest.trustTier = "THIRD_PARTY";
    expect(codesOf(mutated)).toContain("THIRD_PARTY_RELEASE_GATE");
  });

  it("freezes an unpublished bundle on request", () => {
    const frozen = freezeBundle(minimalBundle());
    expect(Object.isFrozen(frozen.registries.macros[0])).toBe(true);
  });
});

describe("runtime code policy", () => {
  it("accepts the declarative-only policy", () => {
    expect(findRuntimeCodeViolations(minimalBundle())).toEqual([]);
  });

  it("refuses a relaxed policy flag", () => {
    for (const field of ["allowInlineScript", "allowEval", "allowDynamicImport"]) {
      const mutated = clone(minimalBundle());
      (mutated.runtimeCodePolicy as unknown as Record<string, unknown>)[field] = true;
      expect(findRuntimeCodeViolations(mutated).map((v) => v.code)).toContain("RUNTIME_CODE_POLICY_RELAXED");
    }
  });

  it("refuses a code-carrying field name anywhere in the bundle", () => {
    for (const field of ["script", "code", "expression", "handlerCode", "module"]) {
      const mutated = clone(minimalBundle()) as unknown as Record<string, unknown>;
      (mutated.registries as Record<string, unknown>)[field] = "anything";
      const codes = findRuntimeCodeViolations(mutated as unknown as DomainPackBundle).map((v) => v.code);
      expect(codes).toContain("INLINE_SCRIPT_FIELD");
    }
  });

  it("refuses code-shaped content hiding in an ordinary string", () => {
    for (const payload of [
      "eval('x')",
      "new Function('return 1')",
      "require('fs')",
      "import('node:fs')",
      "(a) => { return a }",
      "function go() {}",
      "process.env.SECRET",
      "child_process",
    ]) {
      const mutated = clone(minimalBundle());
      mutated.manifest.businessScope = payload;
      const codes = findRuntimeCodeViolations(mutated).map((v) => v.code);
      expect({ payload, codes }).toEqual({ payload, codes: ["CODE_SHAPED_VALUE"] });
    }
  });

  it("refuses a function value, which could never have round-tripped through publication", () => {
    const mutated = minimalBundle() as unknown as Record<string, unknown>;
    (mutated.registries as Record<string, unknown>).reducer = () => true;
    const codes = findRuntimeCodeViolations(mutated as unknown as DomainPackBundle).map((v) => v.code);
    expect(codes).toContain("NON_SERIALIZABLE_VALUE");
  });

  it("surfaces runtime-code violations through bundle validation", () => {
    const mutated = clone(minimalBundle());
    mutated.manifest.businessScope = "eval('x')";
    expect(codesOf(mutated)).toContain("RUNTIME_CODE_FORBIDDEN");
  });
});

// ───────────────────────────────────────────────────────────────────────────
//  4B.13 Execution/impact plane leakage
// ───────────────────────────────────────────────────────────────────────────

describe("execution plane boundary", () => {
  const MODULES: Readonly<Record<string, Record<string, unknown>>> = {
    manifest: manifestModule as unknown as Record<string, unknown>,
    application: application as unknown as Record<string, unknown>,
    "screen-surface": screenSurface as unknown as Record<string, unknown>,
    "entity-target": entityTarget as unknown as Record<string, unknown>,
    "evidence-source": evidenceSource as unknown as Record<string, unknown>,
    "semantic-action": semanticAction as unknown as Record<string, unknown>,
    profile: profile as unknown as Record<string, unknown>,
    "feature-capability": featureCapability as unknown as Record<string, unknown>,
    "remote-adapter": remoteAdapter as unknown as Record<string, unknown>,
    canonical: canonical as unknown as Record<string, unknown>,
    bundle: bundleModule as unknown as Record<string, unknown>,
  };

  it("carries no execution or scheduler vocabulary on any export surface", () => {
    for (const [name, moduleExports] of Object.entries(MODULES)) {
      const hits = scanExportSurfaceForExecutionTypes(name, moduleExports);
      expect({ module: name, hits }).toEqual({ module: name, hits: [] });
    }
  });

  it("names the forbidden execution types explicitly", () => {
    for (const forbidden of [
      "RunManifest",
      "TestExecution",
      "ResourceLease",
      "SchedulerDisposition",
      "WorkerHeartbeat",
      "ImpactGraph",
    ]) {
      expect(FORBIDDEN_EXECUTION_TYPE_NAMES).toContain(forbidden);
    }
  });

  it("detects execution vocabulary in a name", () => {
    expect(findExecutionPlaneLeakage("RunManifest", "x").map((h) => h.token)).toContain("RunManifest");
    expect(findExecutionPlaneLeakage("resourceLease", "x").map((h) => h.token)).toContain("ResourceLease");
    expect(findExecutionPlaneLeakage("lease", "x").map((h) => h.token)).toContain("LEASE");
    expect(findExecutionPlaneLeakage("full-impact-graph", "x").length).toBeGreaterThan(0);
  });

  it("does not cry wolf on release vocabulary", () => {
    // `Lease` hides inside `Release`, and release words are everywhere here. A
    // guard that flagged them would be deleted, and then nothing is guarded.
    for (const safe of ["releaseGate", "releaseIsolation", "releaseGuard", "ReleaseIsolationContract", "released"]) {
      expect(findExecutionPlaneLeakage(safe, "x")).toEqual([]);
    }
  });

  it("splits identifiers into segments across every casing convention", () => {
    expect(identifierSegments("resourceLease")).toEqual(["RESOURCE", "LEASE"]);
    expect(identifierSegments("resource_lease")).toEqual(["RESOURCE", "LEASE"]);
    expect(identifierSegments("resource-lease")).toEqual(["RESOURCE", "LEASE"]);
    expect(identifierSegments("nesy.target.stop-row")).toEqual(["NESY", "TARGET", "STOP", "ROW"]);
  });

  it("rejects a bundle carrying an execution field", () => {
    const mutated = clone(minimalBundle()) as unknown as {
      registries: { applications: Record<string, unknown>[] };
    };
    mutated.registries.applications[0].resourceLease = { leaseId: "l-1" };
    expect(codesOf(mutated as unknown as DomainPackBundle)).toContain("EXECUTION_PLANE_LEAKAGE");
  });

  it("rejects a scheduler disposition and a worker heartbeat too", () => {
    for (const field of ["schedulerDisposition", "workerHeartbeat", "runManifest", "dependencyExecutionState"]) {
      const mutated = clone(minimalBundle()) as unknown as { manifest: Record<string, unknown> };
      mutated.manifest[field] = { anything: true };
      expect(codesOf(mutated as unknown as DomainPackBundle)).toContain("EXECUTION_PLANE_LEAKAGE");
    }
  });

  it("still allows an impact REF, which is how a pack points at coverage", () => {
    const mutated = clone(minimalBundle());
    mutated.manifest.impactRefs = [{ impactRef: "fixture.impact.picking", kind: "FEATURE" }];
    expect(codesOf(mutated)).not.toContain("EXECUTION_PLANE_LEAKAGE");
    expect(validateDomainPackBundle(mutated)).toEqual([]);
  });

  it("keeps the contract package free of a compiler entry point", () => {
    const exported = Object.keys(validateModule as unknown as Record<string, unknown>).concat(
      Object.keys(bundleModule as unknown as Record<string, unknown>),
      Object.keys(semanticAction as unknown as Record<string, unknown>),
    );
    for (const name of exported) {
      // Phase 4C owns compilation. A `compile*`/`expandMacro*` export here would
      // be the compiler starting to exist inside the contract package.
      expect(name).not.toMatch(/^compile/i);
      expect(name).not.toMatch(/^expandMacro/i);
      expect(name).not.toMatch(/BridgeFlowCompiler/);
    }
  });
});
