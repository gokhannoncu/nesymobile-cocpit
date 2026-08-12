/**
 * ===========================================================================
 *  NESY_COURIER_DOMAIN_PACK_REFERENCE_V1  (Plan D.6C · RUN_PLAY 4B.17)
 *
 *  The canonical reference artifact: six vertical slices covering one courier's
 *  day, from signing in to getting the tour approved.
 *
 *  WHAT IT IS FOR
 *
 *  Three audiences, one document:
 *
 *    A reviewer asks "does this pack model the business honestly?" and reads the
 *    slices' `businessMeaning`, `notResponsibleFor` and `negativeCases`.
 *
 *    Phase 4C asks "what must the compiler produce?" and reads
 *    `macroExpansion.genericIr` — a frozen example of a correct expansion, plus
 *    the source map that ties every generic step back to its macro.
 *
 *    A regression asks "did this change meaning?" and compares the artifact
 *    digest.
 *
 *  WHAT IT IS NOT
 *
 *  Runtime output. Every snapshot is `authoredBy: "COMPILER"` WorkflowIR v2 and
 *  validated against `validateWorkflowIrV2`, so the shape and provenance are
 *  proven before publish. The artifact remains a reference bundle, not a live run
 *  result or an executor trace.
 *
 *  SLICE ORDER IS THE COURIER'S DAY
 *
 *  Not alphabetical, and not arbitrary: each slice's preconditions are the
 *  previous slice's outputs, which is what makes the artifact readable as one
 *  journey rather than six unrelated tests.
 * ===========================================================================
 */

import { digestDomainDocument } from "@nesy/domain-pack-contracts";
import { COMPLETE_DELIVERY_SLICE } from "./macros/complete-delivery.js";
import { COURIER_LOGIN_SLICE } from "./macros/login.js";
import { OPEN_STOP_SLICE } from "./macros/open-stop.js";
import { PROCESS_PARCEL_SLICE } from "./macros/process-parcel.js";
import { LOAD_TO_VEHICLE_SLICE } from "./macros/load-to-vehicle.js";
import { SELECT_ROUTE_SLICE } from "./macros/select-route.js";
import { TOUR_APPROVAL_LIFECYCLE_SLICE } from "./macros/tour-approval-lifecycle.js";
import type { NesyReferenceSlice } from "./slice.js";

export const NESY_COURIER_REFERENCE_ARTIFACT_KEY = "NESY_COURIER_DOMAIN_PACK_REFERENCE_V1";

/** The six canonical slice keys, in courier-day order. */
export const NESY_COURIER_REFERENCE_SLICE_KEYS: readonly string[] = [
  "COURIER_LOGIN",
  "SELECT_ROUTE",
  // Courier-day order: the route's schedule is created empty, and this is the
  // step that puts work in it. Everything below depends on something being
  // loaded first.
  "LOAD_TO_VEHICLE",
  "OPEN_STOP",
  "PROCESS_PARCEL",
  "COMPLETE_DELIVERY",
  "TOUR_APPROVAL_LIFECYCLE",
];

export interface NesyCourierReferenceArtifact {
  artifactKey: string;
  version: 1;
  packKey: string;
  /** Slices in courier-day order. */
  slices: readonly NesyReferenceSlice[];
  /** What the artifact deliberately does not cover. */
  notResponsibleFor: readonly string[];
}

export const NESY_COURIER_DOMAIN_PACK_REFERENCE_V1: NesyCourierReferenceArtifact = {
  artifactKey: NESY_COURIER_REFERENCE_ARTIFACT_KEY,
  version: 1,
  packKey: "nesy.courier",
  slices: [
    COURIER_LOGIN_SLICE,
    SELECT_ROUTE_SLICE,
    LOAD_TO_VEHICLE_SLICE,
    OPEN_STOP_SLICE,
    PROCESS_PARCEL_SLICE,
    COMPLETE_DELIVERY_SLICE,
    TOUR_APPROVAL_LIFECYCLE_SLICE,
  ],
  notResponsibleFor: [
    "pickup, vehicle-loading and end-of-day flows beyond the tour approval request — their screens are registered, but no slice judges them yet",
    "payment, fiscal and cancellation paths",
    "runtime execution output — snapshots are compiler-authored reference artifacts, not run traces",
    "execution: no run manifest, no queue, no lease. This artifact says what a test MEANS, never what a run is DOING",
  ],
};

/** Looks up one slice by key. */
export function findReferenceSlice(sliceKey: string): NesyReferenceSlice | undefined {
  return NESY_COURIER_DOMAIN_PACK_REFERENCE_V1.slices.find((slice) => slice.sliceKey === sliceKey);
}

/**
 * Content digest of the whole artifact.
 *
 * Same canonicalization as the bundle digest, so "did the reference change?" is a
 * comparison rather than a diff review.
 */
export function referenceArtifactDigest(): string {
  return digestDomainDocument(NESY_COURIER_DOMAIN_PACK_REFERENCE_V1);
}
