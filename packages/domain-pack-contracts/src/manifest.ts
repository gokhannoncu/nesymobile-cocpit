/**
 * ===========================================================================
 *  Domain Pack manifest and application compatibility  (Plan D.6B · FAZ 4B)
 *
 *  A Domain Pack is the ONLY place business language is allowed to live. Core
 *  (`@nesy/workflow-contract`) and Bridge (`@nesy/bridge-contract`) carry
 *  opaque refs; the pack is what resolves them. That inversion is the whole
 *  architecture, and this file is its root document.
 *
 *  Two prohibitions shape every type here, and both are enforced by tests
 *  rather than by review convention:
 *
 *    NO EXECUTION PLANE. There is no RunManifest, no TestExecution, no Lease,
 *    no ResourceLease, no SchedulerDisposition, no WorkerHeartbeat and no full
 *    ImpactGraph. A pack declares what a test MEANS; it never carries what a
 *    run is currently DOING. The moment mutable run state lands in a pack, the
 *    pack stops being publishable as an immutable, digestible artifact — and
 *    the digest is what makes a months-old verdict re-explainable.
 *
 *    NO RUNTIME CODE. A published pack is declarative data. It cannot ship a
 *    TypeScript/JavaScript body, an `eval` string or a `new Function` payload,
 *    because a pack is authored content and executing authored content on the
 *    Cockpit host is remote code execution with an editor in front of it.
 *
 *  Compatibility is declared, never inferred: a pack that does not say which
 *  app versions and which adapter it was written against will be run against
 *  the wrong build eventually, and the resulting red will be blamed on the app.
 * ===========================================================================
 */

/** Only one schema version exists today; the field exists so migration is possible. */
export type DomainPackSchemaVersion = 1;

export const DOMAIN_PACK_SCHEMA_VERSION: DomainPackSchemaVersion = 1;

/**
 * Pack version.
 *
 * Kept structured rather than a bare string so that "is this pack newer?" is a
 * comparison instead of a regex at every call site.
 */
export interface DomainPackVersion {
  major: number;
  minor: number;
  patch: number;
  /** Optional pre-release label, e.g. "rc.1". Never used for ordering here. */
  prerelease?: string;
}

/** Formats a version for logs and digest inputs. */
export function formatDomainPackVersion(version: DomainPackVersion): string {
  const base = `${version.major}.${version.minor}.${version.patch}`;
  return version.prerelease === undefined ? base : `${base}-${version.prerelease}`;
}

/**
 * Trust tier of a pack.
 *
 * `THIRD_PARTY` exists so the validator can be stricter about it, not so it can
 * be waved through: a third-party pack may not declare host-privileged
 * capabilities, and cannot be marked release-gating.
 */
export type DomainPackTrustTier = "FIRST_PARTY" | "INTERNAL" | "THIRD_PARTY";

export const DOMAIN_PACK_TRUST_TIERS: readonly DomainPackTrustTier[] = [
  "FIRST_PARTY",
  "INTERNAL",
  "THIRD_PARTY",
];

/** Publication lifecycle of a pack version. */
export type DomainPackPublicationState = "DRAFT" | "PUBLISHED" | "DEPRECATED" | "REVOKED";

export const DOMAIN_PACK_PUBLICATION_STATES: readonly DomainPackPublicationState[] = [
  "DRAFT",
  "PUBLISHED",
  "DEPRECATED",
  "REVOKED",
];

/**
 * A capability the whole pack needs.
 *
 * `optional` + `fallback` mirrors the Core requirement shape on purpose (B-13):
 * a pack that hard-requires `wait_any` simply cannot run on a Bridge v1 device,
 * and discovering that at compile time beats discovering it mid-run.
 */
export interface DomainPackCapabilityRequirement {
  /** Capability id from a {@link CapabilityContract} catalog. */
  capabilityRef: string;
  optional: boolean;
  /** What happens when the capability is absent. */
  fallback?: "SKIP_SLICE" | "DEGRADED_EVIDENCE" | "FAIL_FAST" | "OPERATOR_ATTENTION";
  /** Why the pack needs it — read by operators, not by code. */
  reason?: string;
}

/**
 * Where a published bundle came from.
 *
 * Every field here answers a question someone asks during an incident: which
 * commit, which author, which digest, which build. A provenance record without
 * a digest is a rumour.
 */
export interface PublishedBundleProvenance {
  /** SHA-256 of the canonical bundle form, `sha256:`-prefixed. */
  bundleDigest: string;
  publishedAt: string;
  publishedBy: string;
  /** VCS commit the pack source was published from. */
  sourceCommit: string;
  /** Build/CI job reference, when published by automation. */
  buildRef?: string;
  /** Digest of the previous published version, forming an audit chain. */
  supersedesDigest?: string;
}

/**
 * How a pack declares its own reliance on registry entries of other packs.
 *
 * Cross-pack refs stay declarative refs, never imports: a pack that imports
 * another pack's module could execute it, and §RUNTIME CODE forbids that.
 */
export interface DomainDependencyRef {
  /** Depended-on pack key. */
  packKey: string;
  /** Minimum acceptable version of that pack. */
  minVersion: DomainPackVersion;
  /** Registry entry ids consumed from that pack. */
  consumedRefs: readonly string[];
}

/**
 * A pointer at an impact/coverage record that lives OUTSIDE this package.
 *
 * Deliberately a ref and not a graph: the full ImpactGraph is Phase 6 runtime
 * state. Storing it in a pack would make an immutable artifact depend on a
 * mutable one.
 */
export interface DomainImpactRef {
  /** Opaque id in the impact/coverage service. */
  impactRef: string;
  kind: "COMPONENT" | "FEATURE" | "SCREEN" | "SURFACE" | "ENTITY" | "CAPABILITY";
  note?: string;
}

/**
 * A pointer at a resource the pack needs (device class, account pool, fixture).
 *
 * Also deliberately a ref: an actual `ResourceLease` is Phase 5 execution state.
 */
export interface ResourceRequirementRef {
  resourceRef: string;
  /** How many distinct instances a single slice needs. */
  quantity: number;
  exclusive: boolean;
  note?: string;
}

/**
 * The root document of a Domain Pack.
 *
 * `notResponsibleFor` is a first-class field, not documentation. A pack that
 * only lists what it covers reads as covering everything, and the first
 * escaped bug is then argued about instead of triaged.
 */
export interface DomainPackManifest {
  schemaVersion: DomainPackSchemaVersion;
  /** Stable, namespaced pack key, e.g. "nesy.courier". */
  packKey: string;
  packName: string;
  version: DomainPackVersion;
  trustTier: DomainPackTrustTier;
  publicationState: DomainPackPublicationState;
  owner: string;
  /** What business area this pack is responsible for. */
  businessScope: string;
  /** Explicit non-goals. Required — see the note above. */
  notResponsibleFor: readonly string[];
  /** Application keys defined in this pack's Application Registry. */
  applicationRefs: readonly string[];
  capabilityRequirements: readonly DomainPackCapabilityRequirement[];
  dependencies: readonly DomainDependencyRef[];
  impactRefs: readonly DomainImpactRef[];
  resourceRequirementRefs: readonly ResourceRequirementRef[];
  /** Present only once the version is published; absent on DRAFT. */
  provenance?: PublishedBundleProvenance;
}
