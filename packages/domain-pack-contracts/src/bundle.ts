/**
 * ===========================================================================
 *  Domain Pack bundle: canonical form, digest, immutability  (D.6B.14 · 4B.12)
 *
 *  A bundle is the publishable unit: one manifest plus every registry, sealed by
 *  a SHA-256 digest of its canonical form. Three properties make it useful, and
 *  each exists to answer a question that gets asked during an incident.
 *
 *    DETERMINISTIC — "is the pack that judged this run the same pack we have
 *    now?" Two assemblies of the same content must digest identically, so the
 *    digest is computed over canonical JSON (see `canonical.ts`).
 *
 *    IMMUTABLE ONCE PUBLISHED — "did someone edit the pack after the run?"
 *    A published version cannot be edited; a change means a new version with a
 *    new digest and a `supersedesDigest` link. {@link freezeBundle} makes that
 *    structural rather than procedural, because a mutable published artifact
 *    turns every historical verdict into an anecdote.
 *
 *    PINNED PER RUN — "which pack was live when this ran?" A run holds an
 *    {@link ActiveRunPinnedBundleRef}. Hot-reloading a pack must not retroactively
 *    change what a running test is being judged against; a run that switched
 *    packs mid-flight would produce evidence that matches neither version.
 *
 *  And the prohibition that makes publishing safe at all: NO RUNTIME CODE. A
 *  published bundle is data. `RuntimeCodePolicy` is declarative-only and
 *  {@link findRuntimeCodeViolations} scans the assembled bundle for code-shaped
 *  content, because "we would never do that" is not a control.
 * ===========================================================================
 */

import type { ApplicationDefinition } from "./application.js";
import { canonicalizeDomainDocument, digestDomainDocument } from "./canonical.js";
import type { EntityDefinition, TargetDefinition } from "./entity-target.js";
import type { DerivedFactGraph, EvidenceSourceDefinition } from "./evidence-source.js";
import type { CapabilityContract, FeatureBlueprint } from "./feature-capability.js";
import type { DomainPackManifest } from "./manifest.js";
import type { LaunchProfile, TestCampaignDefinition, TestProfileDefinition } from "./profile.js";
import type { RemoteAdapterDefinition } from "./remote-adapter.js";
import type { ScreenDefinition, SurfaceDefinition } from "./screen-surface.js";
import type {
  IndependentTestWorkflowDefinition,
  MacroDefinition,
  ReusableFlowFragmentDefinition,
  SemanticActionDefinition,
} from "./semantic-action.js";

/**
 * The declarative-only execution policy.
 *
 * Typed as literal `false` so a diff that flips it does not type-check, and
 * validated at runtime as well because bundles arrive as JSON where the literal
 * type has no force.
 */
export interface RuntimeCodePolicy {
  allowInlineScript: false;
  allowEval: false;
  allowDynamicImport: false;
  /** Reducer/provider kinds are chosen from closed unions, never authored. */
  declarativeOnly: true;
}

export const DECLARATIVE_RUNTIME_CODE_POLICY: RuntimeCodePolicy = {
  allowInlineScript: false,
  allowEval: false,
  allowDynamicImport: false,
  declarativeOnly: true,
};

/** Every registry of a pack, in one document. */
export interface DomainPackRegistries {
  applications: readonly ApplicationDefinition[];
  screens: readonly ScreenDefinition[];
  surfaces: readonly SurfaceDefinition[];
  entities: readonly EntityDefinition[];
  targets: readonly TargetDefinition[];
  evidenceSources: readonly EvidenceSourceDefinition[];
  derivedFacts: DerivedFactGraph;
  semanticActions: readonly SemanticActionDefinition[];
  macros: readonly MacroDefinition[];
  fragments: readonly ReusableFlowFragmentDefinition[];
  independentWorkflows: readonly IndependentTestWorkflowDefinition[];
  launchProfiles: readonly LaunchProfile[];
  testProfiles: readonly TestProfileDefinition[];
  campaigns: readonly TestCampaignDefinition[];
  features: readonly FeatureBlueprint[];
  capabilities: readonly CapabilityContract[];
  remoteAdapters: readonly RemoteAdapterDefinition[];
}

/**
 * The publishable bundle.
 *
 * `runtimeCodePolicy` is stored inside the digest input on purpose: a bundle
 * cannot claim to be declarative in one place and be executed differently
 * elsewhere without changing its identity.
 */
export interface DomainPackBundle {
  manifest: DomainPackManifest;
  registries: DomainPackRegistries;
  runtimeCodePolicy: RuntimeCodePolicy;
}

/** Canonical text of a bundle. Stable across key ordering. */
export function canonicalizeBundle(bundle: DomainPackBundle): string {
  return canonicalizeDomainDocument(bundle);
}

/**
 * The bundle digest.
 *
 * Computed over the bundle INCLUDING its manifest but EXCLUDING the manifest's
 * own `provenance` — otherwise the digest would have to exist before it could be
 * recorded, which is not a thing.
 */
export function computeBundleDigest(bundle: DomainPackBundle): string {
  const manifestFields = Object.fromEntries(
    Object.entries(bundle.manifest as unknown as Record<string, unknown>).filter(([key]) => key !== "provenance"),
  );
  return digestDomainDocument({
    manifest: manifestFields,
    registries: bundle.registries,
    runtimeCodePolicy: bundle.runtimeCodePolicy,
  });
}

/** A digest paired with what it covers, for storage next to a run. */
export interface BundleDigest {
  packKey: string;
  version: string;
  digest: string;
}

/** A published, immutable pack version. */
export interface PublishedVersion {
  packKey: string;
  version: string;
  digest: string;
  publishedAt: string;
  /** Frozen bundle content. */
  bundle: DomainPackBundle;
}

/**
 * What a run pins.
 *
 * The run stores the DIGEST, not a pointer to "the current pack". A pointer
 * would re-resolve after a hot reload and the run's own evidence would stop
 * matching the pack it is compared against.
 */
export interface ActiveRunPinnedBundleRef {
  workflowRunId: string;
  packKey: string;
  version: string;
  digest: string;
  pinnedAt: string;
}

/**
 * Deep-freezes a bundle.
 *
 * `Object.freeze` at the top level only would leave every nested registry array
 * writable, which is exactly where an accidental mutation would land.
 */
export function freezeBundle(bundle: DomainPackBundle): Readonly<DomainPackBundle> {
  deepFreeze(bundle as unknown);
  return bundle;
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (Object.isFrozen(value)) return;
  Object.freeze(value);
  for (const nested of Object.values(value as Record<string, unknown>)) deepFreeze(nested);
}

/**
 * Publishes a bundle: digest it, record provenance, freeze it.
 *
 * The digest is computed AFTER `publicationState` is set to `PUBLISHED`, because
 * that field is part of the digest input. Digesting the draft first would record
 * a digest that the published bundle no longer matches, and
 * {@link validateDomainPackBundle} would then reject every freshly published
 * version as edited-in-place.
 */
export function publishBundle(
  bundle: DomainPackBundle,
  provenance: Omit<NonNullable<DomainPackManifest["provenance"]>, "bundleDigest">,
): PublishedVersion {
  const withState: DomainPackBundle = {
    ...bundle,
    manifest: { ...bundle.manifest, publicationState: "PUBLISHED" },
  };
  const digest = computeBundleDigest(withState);
  const published: DomainPackBundle = {
    ...withState,
    manifest: { ...withState.manifest, provenance: { ...provenance, bundleDigest: digest } },
  };
  freezeBundle(published);
  return {
    packKey: bundle.manifest.packKey,
    version: formatVersionForDigest(bundle.manifest),
    digest,
    publishedAt: provenance.publishedAt,
    bundle: published,
  };
}

function formatVersionForDigest(manifest: DomainPackManifest): string {
  const { major, minor, patch, prerelease } = manifest.version;
  const base = `${major}.${minor}.${patch}`;
  return prerelease === undefined ? base : `${base}-${prerelease}`;
}

/** Whether a pinned run still matches the pack it was pinned to. */
export function pinnedBundleMatches(pinned: ActiveRunPinnedBundleRef, published: PublishedVersion): boolean {
  return pinned.packKey === published.packKey && pinned.digest === published.digest;
}

// ───────────────────────────────────────────────────────────────────────────
//  Runtime-code scan
// ───────────────────────────────────────────────────────────────────────────

export interface RuntimeCodeViolation {
  path: string;
  code: "INLINE_SCRIPT_FIELD" | "CODE_SHAPED_VALUE" | "RUNTIME_CODE_POLICY_RELAXED" | "NON_SERIALIZABLE_VALUE";
  message: string;
}

/**
 * Field names that would hold a code body.
 *
 * A bundle is authored content. If any of these appear, someone intends the host
 * to execute pack-supplied code, and that is remote code execution with an
 * editor in front of it.
 */
const CODE_FIELD_NAMES: readonly string[] = [
  "script",
  "scriptBody",
  "code",
  "js",
  "javascript",
  "ts",
  "typescript",
  "expression",
  "evalString",
  "fn",
  "handlerCode",
  "module",
  "require",
];

/** Substrings that betray a code body hiding inside a normal string field. */
const CODE_SHAPED_PATTERNS: readonly RegExp[] = [
  /\beval\s*\(/,
  /new\s+Function\s*\(/,
  /\brequire\s*\(/,
  /\bimport\s*\(/,
  /=>\s*\{/,
  /\bfunction\s*\w*\s*\(/,
  /\bprocess\s*\.\s*env\b/,
  /\bchild_process\b/,
];

/**
 * Scans an assembled bundle for anything executable.
 *
 * Functions are reported rather than ignored: a bundle carrying a function value
 * is not serializable, so it could never have round-tripped through publication —
 * which means it was assembled in-process and would behave differently from the
 * published artifact.
 */
export function findRuntimeCodeViolations(bundle: DomainPackBundle): RuntimeCodeViolation[] {
  const violations: RuntimeCodeViolation[] = [];
  const policy = bundle.runtimeCodePolicy as unknown as Record<string, unknown>;

  for (const [key, expected] of Object.entries(DECLARATIVE_RUNTIME_CODE_POLICY)) {
    if (policy[key] !== expected) {
      violations.push({
        path: `runtimeCodePolicy.${key}`,
        code: "RUNTIME_CODE_POLICY_RELAXED",
        message: `runtimeCodePolicy.${key} must be ${String(expected)}; a published pack is declarative data`,
      });
    }
  }

  walk(bundle as unknown, "$", violations, new Set());
  return violations;
}

function walk(value: unknown, path: string, violations: RuntimeCodeViolation[], seen: Set<object>): void {
  if (typeof value === "function") {
    violations.push({
      path,
      code: "NON_SERIALIZABLE_VALUE",
      message: `${path} holds a function; a published bundle must be serializable declarative data`,
    });
    return;
  }

  if (typeof value === "string") {
    for (const pattern of CODE_SHAPED_PATTERNS) {
      if (pattern.test(value)) {
        violations.push({
          path,
          code: "CODE_SHAPED_VALUE",
          message: `${path} contains code-shaped content matching ${String(pattern)}; packs declare, they do not execute`,
        });
        break;
      }
    }
    return;
  }

  if (value === null || typeof value !== "object") return;
  if (seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) walk(item, `${path}[${index}]`, violations, seen);
    return;
  }

  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    if (CODE_FIELD_NAMES.includes(key)) {
      violations.push({
        path: `${path}.${key}`,
        code: "INLINE_SCRIPT_FIELD",
        message: `${path}.${key} is a code-carrying field name; a Domain Pack cannot ship a runtime body`,
      });
    }
    walk(nested, `${path}.${key}`, violations, seen);
  }
}
