/**
 * ===========================================================================
 *  Screen Registry and Surface Registry  (Plan D.6B · RUN_PLAY 4B.6)
 *
 *  These are two registries, not one, and keeping them apart is the point.
 *
 *  A SCREEN is a destination: it can be navigated to, it has an entry strategy,
 *  and being on it is a state the run can be in. A SURFACE is something that
 *  appears ON TOP of wherever you already are: a dialog, a bottom sheet, a
 *  permission prompt, a scanner, a system overlay.
 *
 *  Modelling a dialog as a screen is the single most common way an automation
 *  suite becomes unmaintainable. "Navigate to the session-expired dialog" is
 *  not a thing anyone can do, so the entry strategy is fabricated; and because
 *  the dialog is a screen, an interrupt that appears anywhere has to be handled
 *  by every flow separately. Declared as a surface instead, it is handled once
 *  by policy and the interrupt is caught wherever it fires.
 *
 *  Readiness is event/state-driven, never a sleep. A screen that is "ready
 *  after 800ms" passes when the app is merely late and fails when the device is
 *  merely slow.
 * ===========================================================================
 */

/**
 * What the screen actually is at runtime.
 *
 * A union rather than a string because target resolution differs fundamentally:
 * a Compose screen has no view ids to match, and a WebView's content is not in
 * the native accessibility tree at all. A pack that lies about this produces
 * resolution failures that look like app bugs.
 */
export type ScreenRuntimeImplementation =
  | { kind: "ACTIVITY"; componentName: string }
  | { kind: "FRAGMENT"; hostActivity: string; fragmentTag: string }
  | { kind: "COMPOSE"; hostActivity: string; routeKey: string }
  | { kind: "WEBVIEW"; hostActivity: string; urlPattern: string }
  | { kind: "NATIVE_MODAL_HOST"; hostActivity: string }
  | { kind: "WEB_ROUTE"; routePattern: string };

export type ScreenRuntimeImplementationKind = ScreenRuntimeImplementation["kind"];

export const SCREEN_RUNTIME_IMPLEMENTATION_KINDS: readonly ScreenRuntimeImplementationKind[] = [
  "ACTIVITY",
  "FRAGMENT",
  "COMPOSE",
  "WEBVIEW",
  "NATIVE_MODAL_HOST",
  "WEB_ROUTE",
];

/**
 * How a run gets to a screen.
 *
 * `WORKFLOW_ENTRY` (drive the real UI) is the honest default. `DEEP_LINK` and
 * `TEST_GATEWAY` are shortcuts, and a shortcut that skips the product's own
 * navigation cannot then be used to claim the navigation works — which is why
 * {@link ScreenEntryStrategy.provesUserPath} exists and is read by validation.
 */
export interface ScreenEntryStrategy {
  kind: "WORKFLOW_ENTRY" | "DEEP_LINK" | "TEST_GATEWAY" | "RESTORED_SESSION";
  /** Opaque entry ref: a deep-link key, a gateway operation id, a macro ref. */
  entryRef: string;
  /**
   * Whether arriving this way exercises the real user path.
   *
   * A `TEST_GATEWAY` entry that claimed `true` would let a setup shortcut
   * masquerade as navigation coverage.
   */
  provesUserPath: boolean;
  /** Capability ids the entry needs (e.g. a deep-link gate in the build). */
  requiredCapabilityRefs: readonly string[];
}

/**
 * When a screen/surface counts as usable.
 *
 * Every member is a fact the run can actually observe. There is no
 * `settleMs`-style field: `stableForMs` qualifies an observed fact, it does not
 * replace one.
 */
export interface ReadinessContract {
  /** Normalized fact keys that must hold. Resolved by the Evidence Registry. */
  requiredFactKeys: readonly string[];
  /** Any-of alternative, for screens with two legitimate ready shapes. */
  anyOfFactKeys?: readonly string[];
  /** Facts that must NOT hold, e.g. a blocking spinner fact. */
  noneOfFactKeys?: readonly string[];
  /** Upper bound on the event-driven wait. Never a sleep. */
  deadlineMs: number;
  /** How long the condition must hold before readiness counts. */
  stableForMs?: number;
}

/**
 * One logical screen.
 *
 * `supportedSurfaceRefs` is what makes surface policy composable: a surface
 * declares its parent, and the screen declares which surfaces it can legally
 * host, so a mismatch is a validation error rather than a runtime surprise.
 */
export interface ScreenDefinition {
  /** Namespaced logical key, e.g. "nesy.route.stop-list". */
  screenKey: string;
  applicationRef: string;
  displayName: string;
  runtimeImplementation: ScreenRuntimeImplementation;
  entryStrategies: readonly ScreenEntryStrategy[];
  readiness: ReadinessContract;
  /** Surface keys legally hosted by this screen. */
  supportedSurfaceRefs: readonly string[];
  /** Semantic action ids valid on this screen. */
  supportedActionRefs: readonly string[];
  /** Design revision the mapping was authored against. */
  designRevision?: string;
  /** Narrower app-version window than the application's, when needed. */
  minVersionCode?: number;
  maxVersionCode?: number | null;
}

/**
 * Surface kinds.
 *
 * Closed union: each kind has different detection and different default
 * handling, and "some other overlay" would collapse straight back into the
 * dialog-as-screen problem this registry exists to avoid.
 */
export type SurfaceKind =
  | "DIALOG"
  | "BOTTOM_SHEET"
  | "SYSTEM_OVERLAY"
  | "SCANNER"
  | "WEBVIEW_OVERLAY"
  | "POPUP";

export const SURFACE_KINDS: readonly SurfaceKind[] = [
  "DIALOG",
  "BOTTOM_SHEET",
  "SYSTEM_OVERLAY",
  "SCANNER",
  "WEBVIEW_OVERLAY",
  "POPUP",
];

/**
 * What the run does when the surface appears.
 *
 * `IGNORE` is not "pretend it is not there" — it means the surface is benign and
 * does not block the current step. `OPERATOR_ATTENTION` exists so that "we do
 * not know what this is" has an honest outcome instead of a guess.
 */
export type SurfaceDefaultPolicy = "HANDLE" | "IGNORE" | "FAIL" | "OPERATOR_ATTENTION";

export const SURFACE_DEFAULT_POLICIES: readonly SurfaceDefaultPolicy[] = [
  "HANDLE",
  "IGNORE",
  "FAIL",
  "OPERATOR_ATTENTION",
];

/**
 * One interrupt surface.
 *
 * `priority` orders competing interrupts (a mandatory-update dialog outranks a
 * network toast). Ties are broken deterministically by `surfaceKey` in
 * {@link compareSurfacePriority} — an unstable order would make the same device
 * state produce two different runs.
 */
export interface SurfaceDefinition {
  /** Namespaced key, e.g. "nesy.session-expired-dialog". */
  surfaceKey: string;
  applicationRef: string;
  kind: SurfaceKind;
  displayName: string;
  /**
   * Screens this surface can appear over.
   *
   * `"*"` means "any screen" and is the correct declaration for genuinely
   * global interrupts such as a session-expired dialog.
   */
  parentScreenRefs: readonly string[];
  /** Facts that indicate the surface is present. */
  detection: ReadinessContract;
  defaultPolicy: SurfaceDefaultPolicy;
  priority: number;
  /** Macro that dismisses/handles it, required when policy is HANDLE. */
  handlerMacroRef?: string;
  /**
   * Whether hitting this surface invalidates the product verdict.
   *
   * A mandatory-update dialog mid-flow means the run never tested the flow; a
   * benign network toast does not.
   */
  blocksProductVerdict: boolean;
}

/**
 * Deterministic interrupt ordering: priority first, then key.
 *
 * The tie-break is the load-bearing half. Two same-priority surfaces resolved by
 * object iteration order would make interrupt handling depend on JSON key order.
 */
export function compareSurfacePriority(a: SurfaceDefinition, b: SurfaceDefinition): number {
  if (a.priority !== b.priority) return b.priority - a.priority;
  return a.surfaceKey < b.surfaceKey ? -1 : a.surfaceKey > b.surfaceKey ? 1 : 0;
}

/** Whether a surface may legally appear over a given screen. */
export function surfaceAllowedOnScreen(surface: SurfaceDefinition, screenKey: string): boolean {
  return surface.parentScreenRefs.includes("*") || surface.parentScreenRefs.includes(screenKey);
}
