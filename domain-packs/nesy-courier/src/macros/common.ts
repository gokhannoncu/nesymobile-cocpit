/**
 * ===========================================================================
 *  Shared slice policy defaults  (RUN_PLAY 4B.18)
 *
 *  The interrupt policy below is shared because the four global surfaces are
 *  genuinely global: a mandatory update or an expired session can appear during
 *  any slice. Repeating the list per slice would guarantee that one slice
 *  eventually forgets an entry and hangs on a dialog nobody planned for.
 *
 *  Note which surfaces are FATAL. A mandatory-update or session-expired dialog
 *  mid-flow means the run never exercised the flow at all, so continuing past it
 *  would produce a verdict about nothing. A permission prompt or a network dialog
 *  is a normal part of a courier's day and is handled.
 *
 *  `unlistedSurfacePolicy: "OPERATOR_ATTENTION"` rather than FAIL: an unknown
 *  overlay is a gap in the registry, and "someone needs to look at this" is a more
 *  useful signal than a red that gets re-run until it passes.
 * ===========================================================================
 */

import type { InterruptPolicy, ReleaseIsolationContract } from "@nesy/domain-pack-contracts";
import { NESY_SURFACES } from "../registries/screens.js";

export const NESY_DEFAULT_INTERRUPT_POLICY: InterruptPolicy = {
  handledSurfaceRefs: [NESY_SURFACES.permissionDialog, NESY_SURFACES.networkDialog],
  fatalSurfaceRefs: [NESY_SURFACES.mandatoryUpdateDialog, NESY_SURFACES.sessionExpiredDialog],
  unlistedSurfacePolicy: "OPERATOR_ATTENTION",
  // Bounded so a dialog that reappears on dismissal cannot hold a device forever.
  maxHandledInterrupts: 3,
};

/** Interrupt policy for slices that legitimately drive the scanner surface. */
export const NESY_SCANNER_INTERRUPT_POLICY: InterruptPolicy = {
  handledSurfaceRefs: [
    NESY_SURFACES.permissionDialog,
    NESY_SURFACES.networkDialog,
    NESY_SURFACES.scannerSurface,
  ],
  fatalSurfaceRefs: [NESY_SURFACES.mandatoryUpdateDialog, NESY_SURFACES.sessionExpiredDialog],
  unlistedSurfacePolicy: "OPERATOR_ATTENTION",
  maxHandledInterrupts: 3,
};

/**
 * Interrupt policy for the slice that legitimately drives the tour-start routing
 * chooser.
 *
 * The surface's own `defaultPolicy` is IGNORE, and that is not enough by itself:
 * `unlistedSurfacePolicy` applies to anything missing from THIS policy's lists,
 * so a registered surface the driving macro forgot to name would raise
 * OPERATOR_ATTENTION on the happy path. Listing it as handled — with no handler
 * macro, exactly as the scanner is listed above — says "the macro accounts for
 * this one itself", which is the truth.
 */
export const NESY_TOUR_ROUTING_INTERRUPT_POLICY: InterruptPolicy = {
  handledSurfaceRefs: [
    NESY_SURFACES.permissionDialog,
    NESY_SURFACES.networkDialog,
    NESY_SURFACES.tourRoutingDialog,
    NESY_SURFACES.notificationListDialog,
  ],
  fatalSurfaceRefs: [NESY_SURFACES.mandatoryUpdateDialog, NESY_SURFACES.sessionExpiredDialog],
  unlistedSurfacePolicy: "OPERATOR_ATTENTION",
  maxHandledInterrupts: 3,
};

/**
 * Release isolation for slices that use no automation-only seam.
 *
 * `automationOnly: false` is correct here: the slice drives the product's own UI,
 * so there is nothing test-only to keep out of a shipped build. The assertion
 * fact is still declared, because the run should notice if the build it is
 * testing happens to contain seams it did not ask for.
 */
export const NESY_UI_ONLY_RELEASE_ISOLATION: ReleaseIsolationContract = {
  automationOnly: false,
  releaseGuard: "automationRelease=false",
  assertionFactKey: "APP.SESSION_ISOLATION_ASSERTED",
  allowedEnvironments: ["qa", "staging", "automation"],
};

/** Release isolation for slices that use an automation-only adapter seam. */
export const NESY_SEAM_RELEASE_ISOLATION: ReleaseIsolationContract = {
  automationOnly: true,
  releaseGuard: "automationRelease=false",
  assertionFactKey: "APP.SESSION_ISOLATION_ASSERTED",
  allowedEnvironments: ["qa", "automation"],
};
