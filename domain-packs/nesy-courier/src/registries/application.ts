/**
 * ===========================================================================
 *  Nesy Courier application and App Adapter declaration  (D.6C · 4B.16)
 *
 *  The adapter surface here is deliberately small and entirely made of bounded
 *  reads, bounded preparations and declarations. What it does NOT contain is the
 *  point: no branch engine, no UI action executor, no business decision runner,
 *  no hidden backend mutation hook, no raw HTTP runner.
 *
 *  If the adapter could branch, the product would contain a second automation
 *  engine — invisible in the Cockpit, versioned with the app, and disagreeing
 *  with the Cockpit exactly when a flow gets complicated. UI actions stay on the
 *  Bridge, semantic expansion stays in this pack, decisions stay in Cockpit
 *  runtime.
 *
 *  Every mutating seam is automation-only and names the build gate that removes
 *  it. A session-injection seam in a build a real user can install is a
 *  production vulnerability, not a test convenience.
 * ===========================================================================
 */

import type { ApplicationDefinition } from "@nesy/domain-pack-contracts";

export const NESY_COURIER_APPLICATION_KEY = "nesy.courier.mobile";

export const NESY_COURIER_ADAPTER_REF = "nesy.courier.app-adapter";

/** Bounded named queries the adapter exposes. Read-only projections. */
export const NESY_ADAPTER_QUERY_REFS = {
  availableStops: "nesy.availableStops",
  stopState: "nesy.stopState",
  taskState: "nesy.taskState",
  parcelState: "nesy.parcelState",
  pendingOperation: "nesy.pendingOperation",
  sessionState: "nesy.sessionState",
  /**
   * LOCAL plane counterpart of `sessionState`.
   *
   * `sessionState` projects SharedPreferences and SDK runtime state — what the
   * app believes. This one reads the device's persisted Room login record — what
   * the device kept. The login oracle compares the two, so one query answering
   * both would collapse the distinction it is there to test.
   */
  dbSession: "nesy.db.session",
  /**
   * The working schedule as ROOM holds it — not as the session believes it.
   *
   * Selecting a route is supposed to create today's schedule and persist it. When
   * the create call fails, `StopListFragment` falls back to
   * `loadStopListFromLocal()` for ANY schedule already in Room, including the
   * previous day's, and the screen shows it as if it were today's work. Reading
   * this alongside `routeState` is what makes that state visible: one answers
   * "which schedule is the session using", the other "what is actually stored,
   * and is it today's". A single query answering both would erase the mismatch
   * that IS the defect.
   *
   * `schedule_is_today` comes from the product's own `ScheduleSessionValidator`,
   * and `id_date_is_today` is a second independent reading from the schedule id's
   * date segment — reported separately so a disagreement between the app's two
   * notions of "today" shows up instead of being averaged.
   */
  dbSchedule: "nesy.db.schedule",
  routeState: "nesy.routeState",
  /**
   * What the route dialog is OFFERING right now.
   *
   * Distinct from `routeState`, which answers which route is SELECTED — before a
   * selection that is "none", so reading it to ask "was this route offered"
   * could never be satisfied.
   *
   * Rows carry `match_key` (a name the route answers to), `route_code` (its
   * identity), `route_label` (as displayed) and `fiscal_required`. The last is a
   * Serbian business rule the spinner encodes as a trailing `*`: fiscal receipts
   * are mandatory on that route. It is reported as a fact rather than left buried
   * in a display string, because a route is the same route with or without it.
   */
  offeredRoutes: "nesy.offeredRoutes",
} as const;

/** Preparation and injection operations. All automation-only. */
export const NESY_ADAPTER_SETUP_REFS = {
  preparedSession: "nesy.setup.prepared-session",
  directState: "nesy.setup.direct-state",
  scannerInject: "nesy.setup.scanner-inject",
  scannerManualEntry: "nesy.setup.scanner-manual-entry",
  releaseIsolationAssert: "nesy.assert.release-isolation",
  clearPreparedSession: "nesy.cleanup.clear-prepared-session",
  clearDirectState: "nesy.cleanup.clear-direct-state",
} as const;

export const NESY_COURIER_APPLICATION: ApplicationDefinition = {
  applicationKey: NESY_COURIER_APPLICATION_KEY,
  displayName: "Nesy Courier Mobile",
  platform: "ANDROID",
  // Lab DUT (RS test flavour). Production courier identity stays documented in
  // versionCompatibility.validatedFlavours; the installed package under test is
  // what Bridge/SDK control must address.
  packageIdentity: "com.arasdigital.nesymobile.rstest",
  versionCompatibility: {
    minVersionCode: 41200,
    maxVersionCode: null,
    minVersionName: "4.12.0",
    validatedFlavours: ["qa", "automation"],
  },
  adapterCompatibility: {
    adapterRef: NESY_COURIER_ADAPTER_REF,
    minAdapterVersion: 1,
    maxAdapterVersion: null,
    requiredCapabilities: [
      "NAMED_QUERY",
      "STATE_PROJECTION",
      "CRITICAL_EVENT_STREAM",
      "SESSION_PREPARATION",
      "DIRECT_STATE_PREPARATION",
      "SCANNER_INJECTION",
      "ENTITY_TARGET_BINDING",
      "RELEASE_ISOLATION_ASSERTION",
    ],
  },
  adapterCapabilities: [
    {
      kind: "NAMED_QUERY",
      operationRefs: Object.values(NESY_ADAPTER_QUERY_REFS),
      automationOnly: true,
      releaseGuard: "automationRelease=false",
      mutating: false,
    },
    {
      kind: "STATE_PROJECTION",
      operationRefs: [NESY_ADAPTER_QUERY_REFS.stopState, NESY_ADAPTER_QUERY_REFS.sessionState],
      automationOnly: true,
      releaseGuard: "automationRelease=false",
      mutating: false,
    },
    {
      kind: "CRITICAL_EVENT_STREAM",
      operationRefs: ["nesy.events.critical"],
      automationOnly: true,
      releaseGuard: "automationRelease=false",
      mutating: false,
    },
    {
      kind: "ENTITY_TARGET_BINDING",
      operationRefs: ["nesy.binding.selected-entity"],
      automationOnly: true,
      releaseGuard: "automationRelease=false",
      mutating: false,
    },
    {
      // Mutating and therefore automation-only. This is the seam that, left in a
      // shipped build, would let anyone install a session they never earned.
      kind: "SESSION_PREPARATION",
      operationRefs: [NESY_ADAPTER_SETUP_REFS.preparedSession, NESY_ADAPTER_SETUP_REFS.clearPreparedSession],
      automationOnly: true,
      releaseGuard: "automationRelease=false",
      mutating: true,
    },
    {
      kind: "DIRECT_STATE_PREPARATION",
      operationRefs: [NESY_ADAPTER_SETUP_REFS.directState, NESY_ADAPTER_SETUP_REFS.clearDirectState],
      automationOnly: true,
      releaseGuard: "automationRelease=false",
      mutating: true,
    },
    {
      kind: "SCANNER_INJECTION",
      operationRefs: [NESY_ADAPTER_SETUP_REFS.scannerInject, NESY_ADAPTER_SETUP_REFS.scannerManualEntry],
      automationOnly: true,
      releaseGuard: "automationRelease=false",
      mutating: true,
    },
    {
      // Not automation-only on purpose: the assertion must be callable in the
      // build being shipped, otherwise it cannot prove the other seams are gone.
      kind: "RELEASE_ISOLATION_ASSERTION",
      operationRefs: [NESY_ADAPTER_SETUP_REFS.releaseIsolationAssert],
      automationOnly: false,
      releaseGuard: "always-present",
      mutating: false,
    },
  ],
  capabilityRefs: [
    "domain.nesy.adapter.named-query",
    "domain.nesy.adapter.state-projection",
    "domain.nesy.adapter.event-stream",
    "domain.nesy.adapter.session-prepared",
    "domain.nesy.adapter.direct-state",
    "domain.nesy.adapter.release-isolation",
    "domain.nesy.scanner.inject",
    "domain.nesy.scanner.manual-entry",
  ],
};
