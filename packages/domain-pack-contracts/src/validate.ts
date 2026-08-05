/**
 * ===========================================================================
 *  Domain Pack bundle validation  (Plan D.6B · 4B.12 · 4B.13)
 *
 *  A bundle arrives from a JSON file, an API POST or a fixture — never from a
 *  type-checked call site. So the type system is not the gate; this file is.
 *
 *  Validation returns ALL issues rather than throwing on the first, because the
 *  consumer is a pack editor that needs to underline every bad field at once,
 *  and each issue carries a path for exactly that.
 *
 *  The execution-plane guard at the bottom deserves its own note. A Domain Pack
 *  must not carry `RunManifest`, `TestExecution`, `Lease`, `ResourceLease`,
 *  `SchedulerDisposition`, `WorkerHeartbeat` or a full `ImpactGraph`. Those are
 *  Phase 5/6 runtime state, and a pack that carried them would stop being
 *  publishable as an immutable artifact: its digest would change every time a
 *  worker sent a heartbeat. Keeping that rule as a failing test rather than a
 *  design note is the difference between a boundary and an intention.
 * ===========================================================================
 */

import { FORBIDDEN_APP_ADAPTER_CAPABILITY_KINDS } from "./application.js";
import {
  computeBundleDigest,
  findRuntimeCodeViolations,
  type DomainPackBundle,
  type RuntimeCodeViolation,
} from "./bundle.js";
import { validateTargetResolutionPolicy } from "./entity-target.js";
import { validateDerivedFactGraph, validateEvidenceSource } from "./evidence-source.js";
import { validateCapabilityContract, validateFeatureBlueprint } from "./feature-capability.js";
import { DOMAIN_PACK_SCHEMA_VERSION } from "./manifest.js";
import { validateLaunchProfile, validateTestProfile } from "./profile.js";
import { validateRemoteAdapterOperation } from "./remote-adapter.js";
import { SURFACE_KINDS } from "./screen-surface.js";
import { validateMacroDefinition, validateReusableFlowFragment, type KnownRegistryKeys } from "./semantic-action.js";

export type DomainPackIssueCode =
  | "NOT_AN_OBJECT"
  | "MISSING_FIELD"
  | "UNSUPPORTED_SCHEMA_VERSION"
  | "MISSING_NOT_RESPONSIBLE_FOR"
  | "DUPLICATE_REGISTRY_KEY"
  | "UNKNOWN_REGISTRY_REF"
  | "MISSING_APP_COMPATIBILITY"
  | "FORBIDDEN_ADAPTER_CAPABILITY"
  | "ADAPTER_SEAM_NOT_ISOLATED"
  | "DIALOG_DECLARED_AS_SCREEN"
  | "SURFACE_PARENT_INCOMPATIBLE"
  | "PUBLISHED_WITHOUT_PROVENANCE"
  | "PUBLISHED_DIGEST_MISMATCH"
  | "THIRD_PARTY_RELEASE_GATE"
  | "EXECUTION_PLANE_LEAKAGE"
  | "TARGET_RESOLUTION_INVALID"
  | "EVIDENCE_INVALID"
  | "PROFILE_INVALID"
  | "FEATURE_INVALID"
  | "CAPABILITY_INVALID"
  | "SEMANTIC_ACTION_INVALID"
  | "REMOTE_ADAPTER_INVALID"
  | "RUNTIME_CODE_FORBIDDEN";

export interface DomainPackIssue {
  /** Path into the bundle, e.g. `registries.targets[2].resolution`. */
  path: string;
  code: DomainPackIssueCode;
  message: string;
}

export type DomainPackParseResult =
  | { ok: true; value: DomainPackBundle }
  | { ok: false; issues: readonly DomainPackIssue[] };

/**
 * Type names that must never appear in a Domain Pack.
 *
 * `ImpactGraph` is listed while `DomainImpactRef` is not: a REF into the impact
 * service is exactly how a pack is supposed to point at coverage without
 * embedding mutable runtime state.
 */
export const FORBIDDEN_EXECUTION_TYPE_NAMES: readonly string[] = [
  "RunManifest",
  "TestExecution",
  "ResourceLease",
  "SchedulerDisposition",
  "ExecutionLifecycle",
  "WorkerHeartbeat",
  "DependencyExecutionState",
  "ImpactGraph",
  "CoverageGraph",
];

/**
 * Names matched as whole identifier segments rather than substrings.
 *
 * `Lease` hides inside `Release`, `releaseGate` and `releaseIsolation` — all of
 * which are legitimate and frequent here. A guard that flagged those would cry
 * wolf, and a test that cries wolf gets deleted, so precision is part of the
 * contract.
 */
export const FORBIDDEN_EXECUTION_TYPE_WORDS: readonly string[] = ["LEASE", "LEASES"];

export interface ExecutionPlaneLeakageHit {
  token: string;
  location: string;
}

/** Splits an identifier into uppercase segments (snake, kebab, dotted, camel). */
export function identifierSegments(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[^A-Za-z0-9]+/)
    .filter((segment) => segment !== "")
    .map((segment) => segment.toUpperCase());
}

/** Scans one text for execution/scheduler vocabulary. */
export function findExecutionPlaneLeakage(text: string, location: string): ExecutionPlaneLeakageHit[] {
  const hits: ExecutionPlaneLeakageHit[] = [];
  // Separators are stripped before matching so that `ResourceLease`,
  // `resource_lease` and `resource-lease` are the same violation. These names are
  // long and distinctive enough that collapsing word boundaries does not
  // manufacture false positives.
  const compact = text.toUpperCase().replace(/[^A-Z0-9]/g, "");

  for (const token of FORBIDDEN_EXECUTION_TYPE_NAMES) {
    if (compact.includes(token.toUpperCase())) hits.push({ token, location });
  }

  const segments = new Set(identifierSegments(text));
  for (const word of FORBIDDEN_EXECUTION_TYPE_WORDS) {
    if (segments.has(word)) hits.push({ token: word, location });
  }

  return hits;
}

/**
 * Scans a module's exported surface as text.
 *
 * Stringifying catches a leak whether it arrives as a type name, a union member
 * or an exported constant — a guard that checked only one shape would be
 * trivially bypassed.
 */
export function scanExportSurfaceForExecutionTypes(
  moduleName: string,
  moduleExports: Record<string, unknown>,
): ExecutionPlaneLeakageHit[] {
  const hits: ExecutionPlaneLeakageHit[] = [];
  for (const [name, value] of Object.entries(moduleExports)) {
    hits.push(...findExecutionPlaneLeakage(name, `${moduleName}.${name}`));
    if (typeof value === "function") continue;
    hits.push(...findExecutionPlaneLeakage(JSON.stringify(value) ?? "", `${moduleName}.${name}`));
  }
  return hits;
}

// ───────────────────────────────────────────────────────────────────────────
//  Bundle validation
// ───────────────────────────────────────────────────────────────────────────

/** Collects the keys a pack defines, for bounding every cross-reference. */
export function collectKnownRegistryKeys(bundle: DomainPackBundle): KnownRegistryKeys {
  const factKeys = new Set<string>();
  for (const source of bundle.registries.evidenceSources) {
    if (source.factKey !== undefined) factKeys.add(source.factKey);
  }
  for (const derived of bundle.registries.derivedFacts.facts) factKeys.add(derived.factKey);
  for (const adapter of bundle.registries.remoteAdapters) {
    for (const operation of adapter.operations) {
      for (const output of operation.outputs) factKeys.add(output.factKey);
    }
  }

  return {
    screenKeys: new Set(bundle.registries.screens.map((s) => s.screenKey)),
    surfaceKeys: new Set(bundle.registries.surfaces.map((s) => s.surfaceKey)),
    entityTypes: new Set(bundle.registries.entities.map((e) => e.entityType)),
    targetKeys: new Set(bundle.registries.targets.map((t) => t.targetKey)),
    factKeys,
  };
}

/**
 * Validates a whole bundle.
 *
 * The order is deliberate: structural problems first, then per-registry
 * validation, then the two whole-bundle guards (runtime code, execution plane).
 * A bundle with a missing manifest would otherwise produce a hundred confusing
 * reference errors instead of one clear one.
 */
export function validateDomainPackBundle(bundle: DomainPackBundle): DomainPackIssue[] {
  const issues: DomainPackIssue[] = [];

  if (bundle === null || typeof bundle !== "object") {
    return [{ path: "$", code: "NOT_AN_OBJECT", message: "bundle is not an object" }];
  }
  if (bundle.manifest === undefined || bundle.registries === undefined) {
    return [{ path: "$", code: "MISSING_FIELD", message: "bundle needs both a manifest and registries" }];
  }

  const { manifest, registries } = bundle;
  const shapeIssues = validateBundleShape(bundle as unknown as Record<string, unknown>);
  if (shapeIssues.length > 0) return shapeIssues;

  if (manifest.schemaVersion !== DOMAIN_PACK_SCHEMA_VERSION) {
    issues.push({
      path: "manifest.schemaVersion",
      code: "UNSUPPORTED_SCHEMA_VERSION",
      message: `unsupported Domain Pack schema version ${String(manifest.schemaVersion)}; expected ${DOMAIN_PACK_SCHEMA_VERSION}`,
    });
  }

  // A pack that lists only what it covers reads as covering everything, and the
  // first escaped bug then gets argued about instead of triaged.
  if (manifest.notResponsibleFor.length === 0) {
    issues.push({
      path: "manifest.notResponsibleFor",
      code: "MISSING_NOT_RESPONSIBLE_FOR",
      message: "a pack must state its non-goals; an unbounded scope claim cannot be reviewed",
    });
  }

  issues.push(...validateApplications(bundle));
  issues.push(...validateScreensAndSurfaces(bundle));
  issues.push(...validateTargets(bundle));
  issues.push(...validateEvidence(bundle));
  issues.push(...validateSemantics(bundle));
  issues.push(...validateProfiles(bundle));
  issues.push(...validateFeaturesAndCapabilities(bundle));
  issues.push(...validateRemoteAdapters(bundle));
  issues.push(...validatePublication(bundle));
  issues.push(...toIssues(findRuntimeCodeViolations(bundle)));
  issues.push(...validateNoExecutionPlaneLeakage(bundle));

  issues.push(...validateUniqueKeys("registries.applications", registries.applications.map((a) => a.applicationKey)));
  issues.push(...validateUniqueKeys("registries.screens", registries.screens.map((s) => s.screenKey)));
  issues.push(...validateUniqueKeys("registries.surfaces", registries.surfaces.map((s) => s.surfaceKey)));
  issues.push(...validateUniqueKeys("registries.entities", registries.entities.map((e) => e.entityType)));
  issues.push(...validateUniqueKeys("registries.targets", registries.targets.map((t) => t.targetKey)));
  issues.push(...validateUniqueKeys("registries.macros", registries.macros.map((m) => m.macroKey)));
  issues.push(
    ...validateUniqueKeys("registries.capabilities", registries.capabilities.map((c) => c.capabilityKey)),
  );

  return issues;
}

const REQUIRED_MANIFEST_ARRAY_FIELDS = [
  "notResponsibleFor",
  "applicationRefs",
  "capabilityRequirements",
  "dependencies",
  "impactRefs",
  "resourceRequirementRefs",
] as const;

const REQUIRED_REGISTRY_ARRAY_FIELDS = [
  "applications",
  "screens",
  "surfaces",
  "entities",
  "targets",
  "evidenceSources",
  "semanticActions",
  "macros",
  "fragments",
  "independentWorkflows",
  "launchProfiles",
  "testProfiles",
  "campaigns",
  "features",
  "capabilities",
  "remoteAdapters",
] as const;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validateBundleShape(bundle: Record<string, unknown>): DomainPackIssue[] {
  const issues: DomainPackIssue[] = [];

  if (!isPlainObject(bundle.manifest)) {
    issues.push({ path: "manifest", code: "MISSING_FIELD", message: "manifest must be an object" });
  }
  if (!isPlainObject(bundle.registries)) {
    issues.push({ path: "registries", code: "MISSING_FIELD", message: "registries must be an object" });
  }
  if (!isPlainObject(bundle.runtimeCodePolicy)) {
    issues.push({
      path: "runtimeCodePolicy",
      code: "MISSING_FIELD",
      message: "runtimeCodePolicy must be an object; published packs must declare the no-runtime-code policy",
    });
  }

  if (!isPlainObject(bundle.manifest) || !isPlainObject(bundle.registries)) return issues;

  for (const field of REQUIRED_MANIFEST_ARRAY_FIELDS) {
    if (!Array.isArray(bundle.manifest[field])) {
      issues.push({
        path: `manifest.${field}`,
        code: "MISSING_FIELD",
        message: `manifest.${field} must be an array`,
      });
    }
  }

  for (const field of REQUIRED_REGISTRY_ARRAY_FIELDS) {
    if (!Array.isArray(bundle.registries[field])) {
      issues.push({
        path: `registries.${field}`,
        code: "MISSING_FIELD",
        message: `registries.${field} must be an array`,
      });
    }
  }

  const derivedFacts = bundle.registries.derivedFacts;
  if (!isPlainObject(derivedFacts) || !Array.isArray(derivedFacts.facts)) {
    issues.push({
      path: "registries.derivedFacts.facts",
      code: "MISSING_FIELD",
      message: "registries.derivedFacts.facts must be an array",
    });
  }

  return issues;
}

/** Safe parse for untrusted input. Never throws. */
export function parseDomainPackBundle(input: unknown): DomainPackParseResult {
  if (input === null || typeof input !== "object") {
    return { ok: false, issues: [{ path: "$", code: "NOT_AN_OBJECT", message: "bundle is not an object" }] };
  }
  const issues = validateDomainPackBundle(input as DomainPackBundle);
  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: input as DomainPackBundle };
}

/** Throwing wrapper for call sites where a bad bundle is a programming error. */
export function assertDomainPackBundle(input: unknown): DomainPackBundle {
  const result = parseDomainPackBundle(input);
  if (!result.ok) {
    throw new Error(
      `invalid Domain Pack bundle:\n${result.issues.map((i) => `  ${i.path}: [${i.code}] ${i.message}`).join("\n")}`,
    );
  }
  return result.value;
}

// ───────────────────────────────────────────────────────────────────────────
//  Per-registry validation
// ───────────────────────────────────────────────────────────────────────────

function validateApplications(bundle: DomainPackBundle): DomainPackIssue[] {
  const issues: DomainPackIssue[] = [];

  for (const [index, application] of bundle.registries.applications.entries()) {
    const path = `registries.applications[${index}]`;

    // A pack with no declared version window will eventually be run against the
    // wrong build, and the resulting red gets blamed on the app.
    const compatibility = application.versionCompatibility as unknown;
    if (compatibility === undefined || application.versionCompatibility.minVersionCode === undefined) {
      issues.push({
        path: `${path}.versionCompatibility`,
        code: "MISSING_APP_COMPATIBILITY",
        message: "application declares no app-version compatibility window",
      });
    }
    if ((application.adapterCompatibility as unknown) === undefined) {
      issues.push({
        path: `${path}.adapterCompatibility`,
        code: "MISSING_APP_COMPATIBILITY",
        message: "application declares no App Adapter compatibility",
      });
    }

    const maxVersionCode = application.versionCompatibility?.maxVersionCode;
    if (
      maxVersionCode !== undefined &&
      maxVersionCode !== null &&
      maxVersionCode < application.versionCompatibility.minVersionCode
    ) {
      issues.push({
        path: `${path}.versionCompatibility`,
        code: "MISSING_APP_COMPATIBILITY",
        message: `maxVersionCode ${maxVersionCode} is below minVersionCode ${application.versionCompatibility.minVersionCode}; the window matches no build`,
      });
    }

    for (const [capIndex, capability] of (application.adapterCapabilities ?? []).entries()) {
      const capPath = `${path}.adapterCapabilities[${capIndex}]`;
      if (FORBIDDEN_APP_ADAPTER_CAPABILITY_KINDS.includes(capability.kind as unknown as string)) {
        issues.push({
          path: `${capPath}.kind`,
          code: "FORBIDDEN_ADAPTER_CAPABILITY",
          message: `"${String(capability.kind)}" would make the App Adapter a second automation engine inside the product`,
        });
      }
      // A mutating seam that ships to users is an attack surface, not a test aid.
      if (capability.mutating && !capability.automationOnly) {
        issues.push({
          path: `${capPath}.automationOnly`,
          code: "ADAPTER_SEAM_NOT_ISOLATED",
          message: `mutating adapter capability "${capability.kind}" must be automation-only`,
        });
      }
      if (capability.automationOnly && capability.releaseGuard.trim() === "") {
        issues.push({
          path: `${capPath}.releaseGuard`,
          code: "ADAPTER_SEAM_NOT_ISOLATED",
          message: `automation-only capability "${capability.kind}" names no release guard; an unenforced isolation claim decays`,
        });
      }
    }
  }

  return issues;
}

function validateScreensAndSurfaces(bundle: DomainPackBundle): DomainPackIssue[] {
  const issues: DomainPackIssue[] = [];
  const surfaceKinds = new Set<string>(SURFACE_KINDS);
  const applicationKeys = new Set(bundle.registries.applications.map((a) => a.applicationKey));
  const screenKeys = new Set(bundle.registries.screens.map((s) => s.screenKey));
  const surfacesByKey = new Map(bundle.registries.surfaces.map((s) => [s.surfaceKey, s]));

  for (const [index, screen] of bundle.registries.screens.entries()) {
    const path = `registries.screens[${index}]`;

    if (!applicationKeys.has(screen.applicationRef)) {
      issues.push({
        path: `${path}.applicationRef`,
        code: "UNKNOWN_REGISTRY_REF",
        message: `unknown application "${screen.applicationRef}"`,
      });
    }

    // The dialog-as-screen mistake, made mechanical. A screen whose name or
    // runtime shape is a surface kind cannot be navigated to, so its entry
    // strategy is necessarily fabricated.
    const nameSegments = new Set(identifierSegments(screen.screenKey));
    for (const kind of surfaceKinds) {
      if (identifierSegments(kind).every((segment) => nameSegments.has(segment))) {
        issues.push({
          path: `${path}.screenKey`,
          code: "DIALOG_DECLARED_AS_SCREEN",
          message: `"${screen.screenKey}" names the surface kind ${kind}; an overlay belongs in the Surface Registry, where interrupt policy handles it once instead of per flow`,
        });
      }
    }

    for (const ref of screen.supportedSurfaceRefs) {
      if (!surfacesByKey.has(ref)) {
        issues.push({
          path: `${path}.supportedSurfaceRefs`,
          code: "UNKNOWN_REGISTRY_REF",
          message: `unknown surface "${ref}"`,
        });
      }
    }

    if (screen.entryStrategies.length === 0) {
      issues.push({
        path: `${path}.entryStrategies`,
        code: "MISSING_FIELD",
        message: "a screen with no entry strategy cannot be reached by any run",
      });
    }
  }

  for (const [index, surface] of bundle.registries.surfaces.entries()) {
    const path = `registries.surfaces[${index}]`;

    for (const parent of surface.parentScreenRefs) {
      if (parent !== "*" && !screenKeys.has(parent)) {
        issues.push({
          path: `${path}.parentScreenRefs`,
          code: "UNKNOWN_REGISTRY_REF",
          message: `unknown parent screen "${parent}"`,
        });
      }
    }

    // A surface the hosting screen does not list would be an interrupt nobody
    // planned for on that screen.
    for (const parent of surface.parentScreenRefs) {
      if (parent === "*") continue;
      const screen = bundle.registries.screens.find((s) => s.screenKey === parent);
      if (screen !== undefined && !screen.supportedSurfaceRefs.includes(surface.surfaceKey)) {
        issues.push({
          path: `${path}.parentScreenRefs`,
          code: "SURFACE_PARENT_INCOMPATIBLE",
          message: `screen "${parent}" does not list surface "${surface.surfaceKey}" in supportedSurfaceRefs`,
        });
      }
    }

    if (surface.defaultPolicy === "HANDLE" && (surface.handlerMacroRef === undefined || surface.handlerMacroRef === "")) {
      issues.push({
        path: `${path}.handlerMacroRef`,
        code: "MISSING_FIELD",
        message: `surface "${surface.surfaceKey}" has policy HANDLE but names no handler macro`,
      });
    }
  }

  return issues;
}

function validateTargets(bundle: DomainPackBundle): DomainPackIssue[] {
  const issues: DomainPackIssue[] = [];
  const screenKeys = new Set(bundle.registries.screens.map((s) => s.screenKey));
  const surfaceKeys = new Set(bundle.registries.surfaces.map((s) => s.surfaceKey));
  const entityTypes = new Set(bundle.registries.entities.map((e) => e.entityType));

  for (const [index, target] of bundle.registries.targets.entries()) {
    const path = `registries.targets[${index}]`;

    if (!screenKeys.has(target.screenRef)) {
      issues.push({
        path: `${path}.screenRef`,
        code: "UNKNOWN_REGISTRY_REF",
        message: `unknown screen "${target.screenRef}"`,
      });
    }
    if (target.surfaceRef !== undefined && !surfaceKeys.has(target.surfaceRef)) {
      issues.push({
        path: `${path}.surfaceRef`,
        code: "UNKNOWN_REGISTRY_REF",
        message: `unknown surface "${target.surfaceRef}"`,
      });
    }

    for (const violation of validateTargetResolutionPolicy(target.resolution, `${path}.resolution`)) {
      issues.push({
        path: `${path}.resolution`,
        code: "TARGET_RESOLUTION_INVALID",
        message: `[${violation.code}] ${violation.message}`,
      });
    }

    const binding = target.entityBinding;
    if (binding !== undefined) {
      if (!entityTypes.has(binding.entityTypeRef)) {
        issues.push({
          path: `${path}.entityBinding.entityTypeRef`,
          code: "UNKNOWN_REGISTRY_REF",
          message: `unknown entity type "${binding.entityTypeRef}"`,
        });
      }
      // An unbounded projection of the selected entity into the plan turns
      // evidence capture into data exfiltration.
      if (binding.projectedPaths.length === 0) {
        issues.push({
          path: `${path}.entityBinding.projectedPaths`,
          code: "TARGET_RESOLUTION_INVALID",
          message: "entity binding must declare the bounded set of fields resolution may read",
        });
      }
    }

    const usesEntityBinding = target.resolution.chain.some((s) => s.kind === "ENTITY_BINDING");
    if (usesEntityBinding && binding === undefined) {
      issues.push({
        path: `${path}.entityBinding`,
        code: "TARGET_RESOLUTION_INVALID",
        message: "chain uses an ENTITY_BINDING provider but the target declares no entity binding",
      });
    }
  }

  return issues;
}

function validateEvidence(bundle: DomainPackBundle): DomainPackIssue[] {
  const issues: DomainPackIssue[] = [];

  for (const [index, source] of bundle.registries.evidenceSources.entries()) {
    const path = `registries.evidenceSources[${index}]`;
    for (const violation of validateEvidenceSource(source, path)) {
      issues.push({ path, code: "EVIDENCE_INVALID", message: `[${violation.code}] ${violation.message}` });
    }
  }

  const rawFactKeys = bundle.registries.evidenceSources
    .map((source) => source.factKey)
    .filter((key): key is string => key !== undefined);
  const adapterFactKeys = bundle.registries.remoteAdapters.flatMap((adapter) =>
    adapter.operations.flatMap((operation) => operation.outputs.map((output) => output.factKey)),
  );

  for (const violation of validateDerivedFactGraph(
    bundle.registries.derivedFacts,
    [...rawFactKeys, ...adapterFactKeys],
    "registries.derivedFacts",
  )) {
    issues.push({
      path: "registries.derivedFacts",
      code: "EVIDENCE_INVALID",
      message: `[${violation.code}] ${violation.message}`,
    });
  }

  return issues;
}

function validateSemantics(bundle: DomainPackBundle): DomainPackIssue[] {
  const issues: DomainPackIssue[] = [];
  const known = collectKnownRegistryKeys(bundle);
  const actionKeys = new Set(bundle.registries.semanticActions.map((a) => a.actionKey));
  const macroKeys = new Set(bundle.registries.macros.map((m) => m.macroKey));

  for (const [index, action] of bundle.registries.semanticActions.entries()) {
    const path = `registries.semanticActions[${index}]`;
    if (action.notResponsibleFor.length === 0) {
      issues.push({
        path: `${path}.notResponsibleFor`,
        code: "MISSING_NOT_RESPONSIBLE_FOR",
        message: `action "${action.actionKey}" states no non-goals`,
      });
    }
  }

  for (const [index, macro] of bundle.registries.macros.entries()) {
    const path = `registries.macros[${index}]`;

    if (!actionKeys.has(macro.actionRef)) {
      issues.push({
        path: `${path}.actionRef`,
        code: "UNKNOWN_REGISTRY_REF",
        message: `unknown semantic action "${macro.actionRef}"`,
      });
    }
    if (macro.notResponsibleFor.length === 0) {
      issues.push({
        path: `${path}.notResponsibleFor`,
        code: "MISSING_NOT_RESPONSIBLE_FOR",
        message: `macro "${macro.macroKey}" states no non-goals`,
      });
    }

    for (const violation of validateMacroDefinition(macro, known, path)) {
      issues.push({ path, code: "SEMANTIC_ACTION_INVALID", message: `[${violation.code}] ${violation.message}` });
    }
  }

  for (const [index, fragment] of bundle.registries.fragments.entries()) {
    const path = `registries.fragments[${index}]`;
    for (const violation of validateReusableFlowFragment(fragment, path)) {
      issues.push({ path, code: "SEMANTIC_ACTION_INVALID", message: `[${violation.code}] ${violation.message}` });
    }
    for (const ref of fragment.macroRefs) {
      if (!macroKeys.has(ref)) {
        issues.push({ path: `${path}.macroRefs`, code: "UNKNOWN_REGISTRY_REF", message: `unknown macro "${ref}"` });
      }
    }
  }

  for (const [index, workflow] of bundle.registries.independentWorkflows.entries()) {
    const path = `registries.independentWorkflows[${index}]`;
    const raw = workflow as unknown as Record<string, unknown>;
    // An independent workflow that shared occurrence space with its fragments
    // would let a failure in one test taint another that reuses the same helper.
    if (raw.occurrenceScope !== "INDEPENDENT") {
      issues.push({
        path: `${path}.occurrenceScope`,
        code: "SEMANTIC_ACTION_INVALID",
        message: "an independent test workflow must own its occurrence scope, not inherit a fragment's",
      });
    }
    if (workflow.oracleTemplate === undefined || workflow.oracleTemplate.finalOracle.requirements.length === 0) {
      issues.push({
        path: `${path}.oracleTemplate`,
        code: "SEMANTIC_ACTION_INVALID",
        message: "an independent test workflow carries its own Final Oracle snapshot",
      });
    }
    for (const ref of workflow.macroRefs) {
      if (!macroKeys.has(ref)) {
        issues.push({ path: `${path}.macroRefs`, code: "UNKNOWN_REGISTRY_REF", message: `unknown macro "${ref}"` });
      }
    }
  }

  return issues;
}

function validateProfiles(bundle: DomainPackBundle): DomainPackIssue[] {
  const issues: DomainPackIssue[] = [];
  const launchKeys = new Set(bundle.registries.launchProfiles.map((p) => p.profileKey));
  const screenKeys = new Set(bundle.registries.screens.map((s) => s.screenKey));
  const workflowKeys = new Set(bundle.registries.independentWorkflows.map((w) => w.workflowKey));
  const profileKeys = new Set(bundle.registries.testProfiles.map((p) => p.profileKey));

  for (const [index, profile] of bundle.registries.launchProfiles.entries()) {
    const path = `registries.launchProfiles[${index}]`;
    for (const violation of validateLaunchProfile(profile, path)) {
      issues.push({ path, code: "PROFILE_INVALID", message: `[${violation.code}] ${violation.message}` });
    }
    if (!screenKeys.has(profile.entry.expectedScreenRef)) {
      issues.push({
        path: `${path}.entry.expectedScreenRef`,
        code: "UNKNOWN_REGISTRY_REF",
        message: `unknown screen "${profile.entry.expectedScreenRef}"`,
      });
    }
  }

  for (const [index, profile] of bundle.registries.testProfiles.entries()) {
    const path = `registries.testProfiles[${index}]`;
    for (const violation of validateTestProfile(profile, path)) {
      issues.push({ path, code: "PROFILE_INVALID", message: `[${violation.code}] ${violation.message}` });
    }
    if (!launchKeys.has(profile.launchProfileRef)) {
      issues.push({
        path: `${path}.launchProfileRef`,
        code: "UNKNOWN_REGISTRY_REF",
        message: `unknown launch profile "${profile.launchProfileRef}"`,
      });
    }
    for (const ref of profile.includedWorkflowRefs) {
      if (!workflowKeys.has(ref)) {
        issues.push({
          path: `${path}.includedWorkflowRefs`,
          code: "UNKNOWN_REGISTRY_REF",
          message: `unknown independent test workflow "${ref}"`,
        });
      }
    }
  }

  for (const [index, campaign] of bundle.registries.campaigns.entries()) {
    const path = `registries.campaigns[${index}]`;
    for (const ref of campaign.profileRefs) {
      if (!profileKeys.has(ref)) {
        issues.push({
          path: `${path}.profileRefs`,
          code: "UNKNOWN_REGISTRY_REF",
          message: `unknown test profile "${ref}"`,
        });
      }
    }
    // A gating campaign made of non-gating profiles would launder a preview
    // result into a release decision.
    if (campaign.releaseGate) {
      const gating = campaign.profileRefs.filter(
        (ref) => bundle.registries.testProfiles.find((p) => p.profileKey === ref)?.releaseGate === true,
      );
      if (gating.length === 0) {
        issues.push({
          path: `${path}.releaseGate`,
          code: "PROFILE_INVALID",
          message: "a release-gating campaign contains no release-gating profile",
        });
      }
    }
  }

  return issues;
}

function validateFeaturesAndCapabilities(bundle: DomainPackBundle): DomainPackIssue[] {
  const issues: DomainPackIssue[] = [];
  const capabilityKeys = new Set(bundle.registries.capabilities.map((c) => c.capabilityKey));

  for (const [index, feature] of bundle.registries.features.entries()) {
    const path = `registries.features[${index}]`;
    for (const violation of validateFeatureBlueprint(feature, path)) {
      issues.push({ path, code: "FEATURE_INVALID", message: `[${violation.code}] ${violation.message}` });
    }
    for (const ref of feature.executable.requiredCapabilityRefs) {
      if (!capabilityKeys.has(ref)) {
        issues.push({
          path: `${path}.executable.requiredCapabilityRefs`,
          code: "UNKNOWN_REGISTRY_REF",
          message: `unknown capability "${ref}"`,
        });
      }
    }
  }

  for (const [index, capability] of bundle.registries.capabilities.entries()) {
    const path = `registries.capabilities[${index}]`;
    for (const violation of validateCapabilityContract(capability, path)) {
      issues.push({ path, code: "CAPABILITY_INVALID", message: `[${violation.code}] ${violation.message}` });
    }
  }

  return issues;
}

function validateRemoteAdapters(bundle: DomainPackBundle): DomainPackIssue[] {
  const issues: DomainPackIssue[] = [];
  for (const [adapterIndex, adapter] of bundle.registries.remoteAdapters.entries()) {
    for (const [opIndex, operation] of adapter.operations.entries()) {
      const path = `registries.remoteAdapters[${adapterIndex}].operations[${opIndex}]`;
      for (const violation of validateRemoteAdapterOperation(operation, path)) {
        issues.push({ path, code: "REMOTE_ADAPTER_INVALID", message: `[${violation.code}] ${violation.message}` });
      }
    }
  }
  return issues;
}

function validatePublication(bundle: DomainPackBundle): DomainPackIssue[] {
  const issues: DomainPackIssue[] = [];
  const { manifest } = bundle;

  if (manifest.publicationState === "PUBLISHED") {
    if (manifest.provenance === undefined) {
      issues.push({
        path: "manifest.provenance",
        code: "PUBLISHED_WITHOUT_PROVENANCE",
        message: "a published pack without provenance cannot be traced back to a commit or an author",
      });
    } else {
      const recomputed = computeBundleDigest(bundle);
      if (manifest.provenance.bundleDigest !== recomputed) {
        issues.push({
          path: "manifest.provenance.bundleDigest",
          code: "PUBLISHED_DIGEST_MISMATCH",
          message: `recorded digest ${manifest.provenance.bundleDigest} does not match the bundle's content digest ${recomputed}; a published version was edited in place`,
        });
      }
    }
  }

  // Third-party content deciding whether we ship is a supply-chain decision
  // nobody signed up for.
  if (manifest.trustTier === "THIRD_PARTY") {
    const gating = bundle.registries.testProfiles.filter((profile) => profile.releaseGate);
    if (gating.length > 0) {
      issues.push({
        path: "manifest.trustTier",
        code: "THIRD_PARTY_RELEASE_GATE",
        message: `a THIRD_PARTY pack declares ${gating.length} release-gating profile(s); third-party content cannot decide a ship`,
      });
    }
  }

  return issues;
}

/**
 * Scans the bundle's FIELD NAMES for execution/scheduler vocabulary.
 *
 * Field names, not values, and the distinction is the guard's content. A pack
 * carrying run state carries it as a field — `lease`, `schedulerDisposition`,
 * `workerHeartbeat` — so that is what has to be caught. Scanning prose would
 * flag the manifest's own `notResponsibleFor` entry saying "no lease lives in
 * this pack", which is the correct sentence to have written; a guard that fails
 * on its own documentation gets deleted, and then nothing is guarded.
 *
 * Type-level leakage is covered separately by
 * {@link scanExportSurfaceForExecutionTypes} over the package's exports.
 */
function validateNoExecutionPlaneLeakage(bundle: DomainPackBundle): DomainPackIssue[] {
  const issues: DomainPackIssue[] = [];
  const seen = new Set<object>();

  const walkKeys = (value: unknown, path: string): void => {
    if (value === null || typeof value !== "object") return;
    if (seen.has(value)) return;
    seen.add(value);

    if (Array.isArray(value)) {
      for (const [index, item] of value.entries()) walkKeys(item, `${path}[${index}]`);
      return;
    }

    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      for (const hit of findExecutionPlaneLeakage(key, `${path}.${key}`)) {
        issues.push({
          path: hit.location,
          code: "EXECUTION_PLANE_LEAKAGE",
          message: `execution/scheduler vocabulary "${hit.token}" appears as a bundle field; run state belongs to the Phase 5 execution plane, and a pack carrying it would change digest on every heartbeat`,
        });
      }
      walkKeys(nested, `${path}.${key}`);
    }
  };

  walkKeys(bundle as unknown, "$");
  return issues;
}

function validateUniqueKeys(path: string, keys: readonly string[]): DomainPackIssue[] {
  const seen = new Set<string>();
  const issues: DomainPackIssue[] = [];
  for (const key of keys) {
    if (seen.has(key)) {
      issues.push({ path, code: "DUPLICATE_REGISTRY_KEY", message: `duplicate registry key "${key}"` });
    }
    seen.add(key);
  }
  return issues;
}

function toIssues(violations: readonly RuntimeCodeViolation[]): DomainPackIssue[] {
  return violations.map((violation) => ({
    path: violation.path,
    code: "RUNTIME_CODE_FORBIDDEN" as const,
    message: `[${violation.code}] ${violation.message}`,
  }));
}
