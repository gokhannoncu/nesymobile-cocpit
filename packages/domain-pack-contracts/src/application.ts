/**
 * ===========================================================================
 *  Application Registry  (Plan D.6B · FAZ 4B · RUN_PLAY 4B.5)
 *
 *  A Domain Pack is written against a specific application at a specific range
 *  of versions, driven through a specific adapter. All three are declared here
 *  because all three drift independently:
 *
 *    - The app ships a redesign and every screen key silently means something
 *      else.
 *    - The adapter gains a named query the pack assumed already existed.
 *    - Someone runs a 2024 pack against a 2026 build and reads the red as a
 *      product regression.
 *
 *  Declared compatibility turns each of those from a misleading failure into a
 *  refusal to compile, which is the only version of this that helps.
 * ===========================================================================
 */

/**
 * Version compatibility window.
 *
 * `minVersionCode` / `maxVersionCode` are the platform's monotonic build
 * counters — the only ordering that survives marketing version strings like
 * "5.2 (hotfix)". `maxVersionCode: null` means "open ended", which is a
 * deliberate, visible choice rather than an omission.
 */
export interface AppVersionCompatibility {
  minVersionCode: number;
  maxVersionCode: number | null;
  /** Human-facing range, for operators reading a failure. */
  minVersionName?: string;
  maxVersionName?: string;
  /** Build flavours the pack was validated against, e.g. "qa", "release". */
  validatedFlavours?: readonly string[];
}

/**
 * Which App Adapter contract version the pack expects.
 *
 * The adapter is a bounded, typed seam inside the app under test (named
 * queries, state projections, session preparation). It is NOT a second
 * automation engine: see {@link AppAdapterCapabilityKind}.
 */
export interface AppAdapterCompatibility {
  /** Adapter id, e.g. "nesy.courier.app-adapter". */
  adapterRef: string;
  minAdapterVersion: number;
  maxAdapterVersion: number | null;
  /** Adapter capabilities the pack relies on. */
  requiredCapabilities: readonly AppAdapterCapabilityKind[];
}

/**
 * What an App Adapter is allowed to expose.
 *
 * This union is closed on purpose. Every member is a bounded read, a bounded
 * fixture preparation or a declaration — never "run this flow". Business
 * decisions stay in Cockpit runtime, UI actions stay on the Bridge, and
 * semantic expansion stays in the pack. An adapter that could branch would be a
 * second, invisible automation engine inside the product, and the two engines
 * would disagree exactly when it matters.
 */
export type AppAdapterCapabilityKind =
  | "NAMED_QUERY"
  | "STATE_PROJECTION"
  | "CRITICAL_EVENT_STREAM"
  | "SESSION_PREPARATION"
  | "DIRECT_STATE_PREPARATION"
  | "SCANNER_INJECTION"
  | "ENTITY_TARGET_BINDING"
  | "RELEASE_ISOLATION_ASSERTION";

export const APP_ADAPTER_CAPABILITY_KINDS: readonly AppAdapterCapabilityKind[] = [
  "NAMED_QUERY",
  "STATE_PROJECTION",
  "CRITICAL_EVENT_STREAM",
  "SESSION_PREPARATION",
  "DIRECT_STATE_PREPARATION",
  "SCANNER_INJECTION",
  "ENTITY_TARGET_BINDING",
  "RELEASE_ISOLATION_ASSERTION",
];

/**
 * Adapter capabilities that must never exist.
 *
 * Kept as data so {@link validateDomainPackBundle} can reject them, rather than
 * as prose in a design doc nobody re-reads during a deadline.
 */
export const FORBIDDEN_APP_ADAPTER_CAPABILITY_KINDS: readonly string[] = [
  "WORKFLOW_BRANCH_ENGINE",
  "UI_ACTION_EXECUTOR",
  "BUSINESS_DECISION_RUNNER",
  "BACKEND_MUTATION_HOOK",
  "RAW_HTTP_RUNNER",
  "SCRIPT_RUNNER",
];

/**
 * How an adapter capability is gated in shipped builds.
 *
 * `automationOnly` is the release-isolation promise: the seam must not exist in
 * a production build, or the test harness becomes an attack surface for real
 * users. A capability that claims otherwise has to say so explicitly and gets
 * flagged.
 */
export interface AppAdapterCapabilityDeclaration {
  kind: AppAdapterCapabilityKind;
  /** Allowlisted operation ids this capability exposes. Opaque to Core. */
  operationRefs: readonly string[];
  automationOnly: boolean;
  /** Build gate that removes/disables it, e.g. "automationRelease=false". */
  releaseGuard: string;
  /** Whether the capability can mutate app or backend state. */
  mutating: boolean;
}

/**
 * One application a pack targets.
 *
 * `platform` is present because the same business pack can legitimately target
 * two clients, and a screen key valid on one is meaningless on the other.
 */
export interface ApplicationDefinition {
  /** Namespaced application key, e.g. "nesy.courier.mobile". */
  applicationKey: string;
  displayName: string;
  platform: "ANDROID" | "IOS" | "WEB";
  /** Platform package/bundle identity, e.g. an Android applicationId. */
  packageIdentity: string;
  versionCompatibility: AppVersionCompatibility;
  adapterCompatibility: AppAdapterCompatibility;
  adapterCapabilities: readonly AppAdapterCapabilityDeclaration[];
  /** Capability ids the application itself must provide. */
  capabilityRefs: readonly string[];
}
