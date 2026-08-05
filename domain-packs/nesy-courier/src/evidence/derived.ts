/**
 * ===========================================================================
 *  Nesy Courier derived facts  (Plan D.6E · 4B.15)
 *
 *  Every derivation here exists because one plane alone is not enough evidence.
 *
 *  `APP.LOGIN_SUCCEEDED` needs all three of: the backend accepted the
 *  credentials, the app holds a session, and the device persisted one. Any two
 *  without the third is a real, seen bug class — a session that exists in memory
 *  and vanishes on restart, or a backend that authenticated a client which then
 *  failed to store anything.
 *
 *  `APP.ACTIVE_STOP_MATCHES` is the wrong-row guard. It compares the stop the app
 *  says is active against the stop the plan asked for. Without it, a run that
 *  opened the wrong row proceeds to deliver the wrong parcel successfully, and
 *  every downstream oracle passes.
 *
 *  `REMOTE.TOUR_APPROVAL_CONFIRMED` requires the courier's request, the created
 *  back-office record and the approved status — CORRELATED, so a pre-existing
 *  approval from an earlier run cannot satisfy this one.
 *
 *  Note what no derivation does: replace its inputs. `preserveInputs` is true
 *  everywhere, so the raw observations remain answerable months later.
 * ===========================================================================
 */

import type { DerivedFactGraph } from "@nesy/domain-pack-contracts";
import { NESY_FACTS } from "../registries/facts.js";

export const NESY_COURIER_DERIVED_FACTS: DerivedFactGraph = {
  facts: [
    {
      factKey: NESY_FACTS.LOGIN_SUCCEEDED,
      plane: "APP",
      authority: "PRIMARY",
      displayName: "Login succeeded across all three planes",
      provenance: {
        reducerKind: "CORRELATED_ALL_OF",
        reducerVersion: 1,
        inputFactKeys: [
          NESY_FACTS.AUTH_ACCEPTED,
          NESY_FACTS.USER_SESSION_AVAILABLE_APP,
          NESY_FACTS.USER_SESSION_AVAILABLE_LOCAL,
        ],
        parameters: { correlationPath: "sessionId" },
      },
      preserveInputs: true,
      requiresCorrelation: true,
    },
    {
      factKey: NESY_FACTS.ACTIVE_STOP_MATCHES,
      plane: "APP",
      authority: "PRIMARY",
      displayName: "The active stop is the requested stop",
      provenance: {
        reducerKind: "ENTITY_STATUS_EQUALS",
        reducerVersion: 1,
        inputFactKeys: [NESY_FACTS.ACTIVE_STOP_OBSERVED, NESY_FACTS.AVAILABLE_STOPS_LOADED],
        parameters: { comparePath: "stopCode", against: "macro.input.stopCode" },
      },
      preserveInputs: true,
      requiresCorrelation: true,
    },
    {
      factKey: NESY_FACTS.DELIVERY_CONFIRMED,
      plane: "REMOTE",
      authority: "PRIMARY",
      displayName: "Delivery confirmed by the backend for this submission",
      provenance: {
        reducerKind: "CORRELATED_ALL_OF",
        reducerVersion: 1,
        inputFactKeys: [NESY_FACTS.DELIVERY_STATUS_COMPLETED, NESY_FACTS.DELIVERY_SUBMITTED],
        parameters: { correlationPath: "correlationId" },
      },
      preserveInputs: true,
      requiresCorrelation: true,
    },
    {
      factKey: NESY_FACTS.TOUR_APPROVAL_CONFIRMED,
      plane: "REMOTE",
      authority: "PRIMARY",
      displayName: "Tour approval requested by the courier and approved by the dispatcher",
      provenance: {
        reducerKind: "CORRELATED_ALL_OF",
        reducerVersion: 1,
        inputFactKeys: [
          NESY_FACTS.TOUR_APPROVAL_REQUESTED,
          NESY_FACTS.TOUR_APPROVAL_REQUEST_CREATED,
          NESY_FACTS.TOUR_APPROVAL_STATUS_APPROVED,
        ],
        parameters: { correlationPath: "approvalRequestCode" },
      },
      preserveInputs: true,
      requiresCorrelation: true,
    },
  ],
};
