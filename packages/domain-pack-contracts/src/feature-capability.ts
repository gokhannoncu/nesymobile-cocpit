/**
 * ===========================================================================
 *  Feature blueprint and capability catalog  (Plan D.6B · 4B.11)
 *
 *  THE AUTHORING / EXECUTABLE SPLIT
 *
 *  A feature record carries two very different kinds of content. One kind is
 *  prose and process: descriptions, owners, tags, links to tickets, review
 *  notes. The other kind decides what actually runs and what the run is allowed
 *  to conclude: macros, oracles, invariants, capabilities.
 *
 *  Folding them together has a concrete cost. Fixing a typo in a description
 *  changes the feature's digest; every pinned run now points at a "different"
 *  feature; the diff review that was supposed to catch executable changes is
 *  buried in wording churn, and eventually people stop reading it.
 *
 *  So the digest is computed over {@link FeatureExecutableContract} ONLY.
 *  Editing {@link FeatureAuthoringMetadata} provably does not move it, and
 *  editing anything executable provably does. Both directions are tested.
 *
 *  AI_SUGGESTED INVARIANTS CANNOT GATE A RELEASE
 *
 *  An AI-proposed invariant is a useful starting point and an unaccountable
 *  gate: nobody agreed to it, so when it fails at 2am there is no one who can
 *  say whether the failure matters. It needs `PRODUCT_APPROVED` (a human owns
 *  the business rule) or `TECHNICAL_DEFAULT` (a platform rule with an owner)
 *  before it can block a ship.
 *
 *  CAPABILITY CATALOG IS LAYERED
 *
 *  `verdict.core` capabilities are platform-wide. Domain-specific capabilities
 *  live under `domain.<pack>`. A domain capability may not be declared as core,
 *  and may not be promoted into the core layer without recorded evidence —
 *  otherwise the first tenant's assumptions become everyone's platform.
 * ===========================================================================
 */

import { digestDomainDocument } from "./canonical.js";

/**
 * Non-executable feature content.
 *
 * Everything here can change freely without invalidating a pinned run. That is
 * the entire purpose of the type.
 */
export interface FeatureAuthoringMetadata {
  displayName: string;
  description: string;
  owner: string;
  tags: readonly string[];
  /** Ticket/spec/design links. Prose, not behaviour. */
  referenceLinks?: readonly string[];
  reviewNotes?: readonly string[];
  lastEditedBy?: string;
  lastEditedAt?: string;
}

/** Who stands behind an invariant. */
export type InvariantAuthority = "AI_SUGGESTED" | "PRODUCT_APPROVED" | "TECHNICAL_DEFAULT";

export const INVARIANT_AUTHORITIES: readonly InvariantAuthority[] = [
  "AI_SUGGESTED",
  "PRODUCT_APPROVED",
  "TECHNICAL_DEFAULT",
];

/** Authorities that may bind a release gate. */
export const GATING_INVARIANT_AUTHORITIES: readonly InvariantAuthority[] = [
  "PRODUCT_APPROVED",
  "TECHNICAL_DEFAULT",
];

/**
 * A rule the feature claims always holds.
 *
 * `factKeys` rather than prose: an invariant nothing can observe is an opinion,
 * and an opinion cannot fail a build for a reason anyone can act on.
 */
export interface FeatureInvariant {
  invariantKey: string;
  statement: string;
  authority: InvariantAuthority;
  /** Facts that evidence the invariant. */
  factKeys: readonly string[];
  /** Whether a violation blocks a release. Requires a gating authority. */
  bindsReleaseGate: boolean;
}

/**
 * Executable feature content — the digest input.
 *
 * If a field would change what runs or what the run may conclude, it belongs
 * here. If it would not, it belongs in {@link FeatureAuthoringMetadata}.
 */
export interface FeatureExecutableContract {
  featureKey: string;
  /** Bumped by hand when the executable meaning changes intentionally. */
  contractVersion: number;
  applicationRef: string;
  /** Macros this feature is exercised by. */
  macroRefs: readonly string[];
  /** Independent test workflows that judge it. */
  workflowRefs: readonly string[];
  invariants: readonly FeatureInvariant[];
  requiredCapabilityRefs: readonly string[];
  /** Screens/surfaces the feature is considered to cover. */
  screenRefs: readonly string[];
  surfaceRefs: readonly string[];
  /** Explicit non-goals — required, same reasoning as elsewhere. */
  notResponsibleFor: readonly string[];
}

/**
 * The two halves, joined only at the top level.
 *
 * `executableDigest` is stored alongside so that a bundle read back from disk
 * can be checked against a recomputation instead of trusted.
 */
export interface FeatureBlueprint {
  featureKey: string;
  authoring: FeatureAuthoringMetadata;
  executable: FeatureExecutableContract;
  /** `sha256:` digest of {@link FeatureExecutableContract} alone. */
  executableDigest: string;
}

/**
 * Computes the executable digest.
 *
 * Note what is NOT passed in: `authoring`. That omission is the guarantee, and
 * the reason it is a separate function rather than a digest of the blueprint.
 */
export function computeFeatureExecutableDigest(executable: FeatureExecutableContract): string {
  return digestDomainDocument(executable);
}

// ───────────────────────────────────────────────────────────────────────────
//  Capability catalog
// ───────────────────────────────────────────────────────────────────────────

/**
 * Catalog layers.
 *
 * `verdict.core` is the platform layer. Domain-specific layers use the
 * `domain.<pack>` namespace. The shared contract deliberately does not hardcode
 * customer or product names; concrete tenant layers belong in their own Domain
 * Pack.
 */
export type CoreCapabilityLayer = "verdict.core";

export type DomainCapabilityLayer = `domain.${string}`;

export type CapabilityLayer = CoreCapabilityLayer | DomainCapabilityLayer;

export const CAPABILITY_LAYERS: readonly CoreCapabilityLayer[] = ["verdict.core"];

export const CORE_CAPABILITY_LAYER: CoreCapabilityLayer = "verdict.core";

/** Which side provides the capability. */
export type CapabilityProvider = "BRIDGE" | "APP_ADAPTER" | "BACKOFFICE_ADAPTER" | "COCKPIT_RUNTIME" | "DEVICE";

export const CAPABILITY_PROVIDERS: readonly CapabilityProvider[] = [
  "BRIDGE",
  "APP_ADAPTER",
  "BACKOFFICE_ADAPTER",
  "COCKPIT_RUNTIME",
  "DEVICE",
];

/**
 * One capability.
 *
 * `promotionEvidenceRefs` is what stops the core layer from silently absorbing a
 * tenant assumption: a capability that starts in `nesy` and wants to become
 * `verdict.core` must carry evidence that a second tenant needs the same shape.
 */
export interface CapabilityContract {
  /** Layer-prefixed id, e.g. "verdict.core.bridge.tap" or "domain.example.scanner.inject". */
  capabilityKey: string;
  layer: CapabilityLayer;
  provider: CapabilityProvider;
  displayName: string;
  description: string;
  /** Whether presence must be detected at run time rather than assumed. */
  runtimeDetected: boolean;
  /** Fact/probe ref used to detect it. Required when `runtimeDetected`. */
  detectionRef?: string;
  /** Whether the capability is an automation-only seam. */
  automationOnly: boolean;
  /** Evidence supporting promotion of a tenant capability into the core layer. */
  promotionEvidenceRefs?: readonly string[];
}

export interface FeatureCapabilityViolation {
  code:
    | "AI_INVARIANT_GATES_RELEASE"
    | "INVARIANT_WITHOUT_EVIDENCE"
    | "FEATURE_DIGEST_MISMATCH"
    | "AUTHORING_FIELD_IN_EXECUTABLE"
    | "CAPABILITY_LAYER_PREFIX_MISMATCH"
    | "DOMAIN_CAPABILITY_CLAIMS_CORE"
    | "UNDETECTED_RUNTIME_CAPABILITY";
  message: string;
}

/**
 * Authoring field names that must never appear inside the executable contract.
 *
 * Without this check, the split could be re-broken one field at a time: someone
 * adds `description` to the executable contract "just for convenience" and every
 * wording edit starts moving digests again.
 */
const AUTHORING_ONLY_FIELDS: readonly string[] = [
  "description",
  "displayName",
  "tags",
  "owner",
  "referenceLinks",
  "reviewNotes",
  "lastEditedBy",
  "lastEditedAt",
];

/** Validates one feature blueprint. */
export function validateFeatureBlueprint(blueprint: FeatureBlueprint, path: string): FeatureCapabilityViolation[] {
  const violations: FeatureCapabilityViolation[] = [];

  const recomputed = computeFeatureExecutableDigest(blueprint.executable);
  if (recomputed !== blueprint.executableDigest) {
    violations.push({
      code: "FEATURE_DIGEST_MISMATCH",
      message: `${path}.executableDigest is ${blueprint.executableDigest} but the executable contract digests to ${recomputed}`,
    });
  }

  const executableFields = new Set(Object.keys(blueprint.executable as unknown as Record<string, unknown>));
  for (const field of AUTHORING_ONLY_FIELDS) {
    if (executableFields.has(field)) {
      violations.push({
        code: "AUTHORING_FIELD_IN_EXECUTABLE",
        message: `${path}.executable.${field}: authoring metadata inside the executable contract would make every wording edit move the digest`,
      });
    }
  }

  for (const [index, invariant] of blueprint.executable.invariants.entries()) {
    const invariantPath = `${path}.executable.invariants[${index}]`;
    if (invariant.bindsReleaseGate && !GATING_INVARIANT_AUTHORITIES.includes(invariant.authority)) {
      violations.push({
        code: "AI_INVARIANT_GATES_RELEASE",
        message: `${invariantPath}: invariant "${invariant.invariantKey}" has ${invariant.authority} authority and cannot bind a release gate; it needs PRODUCT_APPROVED or TECHNICAL_DEFAULT`,
      });
    }
    if (invariant.factKeys.length === 0) {
      violations.push({
        code: "INVARIANT_WITHOUT_EVIDENCE",
        message: `${invariantPath}: invariant "${invariant.invariantKey}" names no fact; an unobservable invariant cannot fail for a reason anyone can act on`,
      });
    }
  }

  return violations;
}

/** Validates one capability declaration. */
export function validateCapabilityContract(
  capability: CapabilityContract,
  path: string,
): FeatureCapabilityViolation[] {
  const violations: FeatureCapabilityViolation[] = [];

  // The id carries its layer so that a mislayered capability is visible in every
  // log line, not only in the registry row.
  if (!capability.capabilityKey.startsWith(`${capability.layer}.`)) {
    violations.push({
      code: "CAPABILITY_LAYER_PREFIX_MISMATCH",
      message: `${path}.capabilityKey "${capability.capabilityKey}" must be prefixed with its layer "${capability.layer}."`,
    });
  }

  if (capability.layer === CORE_CAPABILITY_LAYER) {
    const looksTenantSpecific = capability.capabilityKey.toLowerCase().includes(".domain.");
    if (looksTenantSpecific && (capability.promotionEvidenceRefs ?? []).length === 0) {
      violations.push({
        code: "DOMAIN_CAPABILITY_CLAIMS_CORE",
        message: `${path}: "${capability.capabilityKey}" is tenant-shaped but declared in the core layer with no promotion evidence`,
      });
    }
  }

  if (capability.runtimeDetected && (capability.detectionRef === undefined || capability.detectionRef === "")) {
    violations.push({
      code: "UNDETECTED_RUNTIME_CAPABILITY",
      message: `${path}: "${capability.capabilityKey}" claims runtime detection but names no detectionRef; an undetectable capability is an assumption`,
    });
  }

  return violations;
}
