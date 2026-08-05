/**
 * ===========================================================================
 *  Nesy Courier launch profiles  (Plan D.6C · 4B.15)
 *
 *  Four profiles, and the difference between the first one and the other three
 *  is the whole reason the type exists.
 *
 *  `cold-real-login` drives the product's own login screens, so it is the only
 *  profile that may write a product verdict about signing in
 *  (`producesProductVerdict: true`).
 *
 *  The other three install a session or a business precondition through an
 *  automation-only App Adapter seam. They are faster, they are correct, and they
 *  are SETUP. All three declare `producesProductVerdict: false`, and
 *  `validateLaunchProfile` refuses any other combination — because the moment a
 *  prepared session can carry a verdict, the login test quietly stops testing
 *  login while continuing to report a pass.
 *
 *  Every shortcut profile also declares `releaseIsolation.automationOnly: true`
 *  with a named build guard. A session-injection seam in a build a real user can
 *  install is a production vulnerability, not a test convenience.
 * ===========================================================================
 */

import type { LaunchProfile } from "@nesy/domain-pack-contracts";
import { NESY_ADAPTER_SETUP_REFS, NESY_COURIER_APPLICATION_KEY } from "../registries/application.js";
import { NESY_FACTS } from "../registries/facts.js";
import { NESY_SCREENS, NESY_SURFACES } from "../registries/screens.js";

const APP = NESY_COURIER_APPLICATION_KEY;

export const NESY_LAUNCH_PROFILES = {
  coldRealLogin: "nesy.launch.cold-real-login",
  preparedSession: "nesy.launch.prepared-session",
  directState: "nesy.launch.direct-state",
  reuseSession: "nesy.launch.reuse-session",
} as const;

export const NESY_COURIER_LAUNCH_PROFILES: readonly LaunchProfile[] = [
  {
    // The only verdict-bearing profile.
    profileKey: NESY_LAUNCH_PROFILES.coldRealLogin,
    applicationRef: APP,
    displayName: "Cold start, real UI login",
    startMode: "COLD_START",
    sessionPreparation: "REAL_UI_LOGIN",
    preconditionFactKeys: [NESY_FACTS.SESSION_ISOLATION_ASSERTED],
    entry: {
      kind: "WORKFLOW_ENTRY",
      entryRef: "nesy.entry.cold-launch",
      expectedScreenRef: NESY_SCREENS.login,
      expectedSurfaceRefs: [NESY_SURFACES.permissionDialog],
    },
    // Empty by necessity: REAL_LOGIN_WITH_PREPARATION_OPS fires otherwise, and a
    // profile that shortcuts half the path cannot claim the whole path.
    preparationOperationRefs: [],
    cleanup: {
      cleanupRefs: [NESY_ADAPTER_SETUP_REFS.clearPreparedSession],
      runOnFailure: true,
      deadlineMs: 30_000,
    },
    producesProductVerdict: true,
    releaseIsolation: {
      automationOnly: false,
      releaseGuard: "automationRelease=false",
      assertionFactKey: NESY_FACTS.SESSION_ISOLATION_ASSERTED,
      allowedEnvironments: ["qa", "staging", "automation"],
    },
    requiredCapabilityRefs: ["verdict.core.bridge.tap", "verdict.core.bridge.set-text", "nesy.adapter.release-isolation"],
  },
  {
    profileKey: NESY_LAUNCH_PROFILES.preparedSession,
    applicationRef: APP,
    displayName: "Warm start with a prepared session",
    startMode: "WARM_START",
    sessionPreparation: "PREPARED_SESSION",
    preconditionFactKeys: [NESY_FACTS.SESSION_ISOLATION_ASSERTED],
    entry: {
      kind: "TEST_GATEWAY",
      entryRef: "nesy.entry.gateway-route-list",
      expectedScreenRef: NESY_SCREENS.routeStopList,
      expectedSurfaceRefs: [],
    },
    preparationOperationRefs: [NESY_ADAPTER_SETUP_REFS.preparedSession],
    cleanup: {
      cleanupRefs: [NESY_ADAPTER_SETUP_REFS.clearPreparedSession],
      runOnFailure: true,
      deadlineMs: 30_000,
    },
    // Setup. A prepared session proves nothing about signing in.
    producesProductVerdict: false,
    releaseIsolation: {
      automationOnly: true,
      releaseGuard: "automationRelease=false",
      assertionFactKey: NESY_FACTS.SESSION_ISOLATION_ASSERTED,
      allowedEnvironments: ["qa", "automation"],
    },
    requiredCapabilityRefs: ["nesy.adapter.session-prepared", "nesy.adapter.release-isolation"],
  },
  {
    profileKey: NESY_LAUNCH_PROFILES.directState,
    applicationRef: APP,
    displayName: "Warm start with a directly written business state",
    startMode: "WARM_START",
    sessionPreparation: "DIRECT_STATE",
    preconditionFactKeys: [NESY_FACTS.SESSION_ISOLATION_ASSERTED],
    entry: {
      kind: "DEEP_LINK",
      entryRef: "nesy.link.vehicle-loading",
      expectedScreenRef: NESY_SCREENS.vehicleLoading,
      expectedSurfaceRefs: [],
    },
    preparationOperationRefs: [NESY_ADAPTER_SETUP_REFS.preparedSession, NESY_ADAPTER_SETUP_REFS.directState],
    cleanup: {
      cleanupRefs: [NESY_ADAPTER_SETUP_REFS.clearDirectState, NESY_ADAPTER_SETUP_REFS.clearPreparedSession],
      runOnFailure: true,
      deadlineMs: 45_000,
    },
    producesProductVerdict: false,
    releaseIsolation: {
      automationOnly: true,
      releaseGuard: "automationRelease=false",
      assertionFactKey: NESY_FACTS.SESSION_ISOLATION_ASSERTED,
      allowedEnvironments: ["qa", "automation"],
    },
    requiredCapabilityRefs: ["nesy.adapter.direct-state", "nesy.adapter.session-prepared", "nesy.adapter.release-isolation"],
  },
  {
    profileKey: NESY_LAUNCH_PROFILES.reuseSession,
    applicationRef: APP,
    displayName: "Reuse the session left by the previous run",
    startMode: "REUSE_SESSION",
    sessionPreparation: "PREPARED_SESSION",
    preconditionFactKeys: [NESY_FACTS.USER_SESSION_AVAILABLE_APP, NESY_FACTS.SESSION_ISOLATION_ASSERTED],
    entry: {
      kind: "WORKFLOW_ENTRY",
      entryRef: "nesy.entry.post-login",
      expectedScreenRef: NESY_SCREENS.routeStopList,
      expectedSurfaceRefs: [],
    },
    preparationOperationRefs: [NESY_ADAPTER_SETUP_REFS.preparedSession],
    cleanup: {
      // Deliberately does not clear the session — that is the point of reuse —
      // but the state written for the run is still released.
      cleanupRefs: [NESY_ADAPTER_SETUP_REFS.clearDirectState],
      runOnFailure: true,
      deadlineMs: 20_000,
    },
    producesProductVerdict: false,
    releaseIsolation: {
      automationOnly: true,
      releaseGuard: "automationRelease=false",
      assertionFactKey: NESY_FACTS.SESSION_ISOLATION_ASSERTED,
      allowedEnvironments: ["qa", "automation"],
    },
    requiredCapabilityRefs: ["nesy.adapter.session-prepared", "nesy.adapter.release-isolation"],
  },
];
