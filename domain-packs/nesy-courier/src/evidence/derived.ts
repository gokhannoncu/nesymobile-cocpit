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
        // `requestedItemCode` is what the macro's input is actually called. This
        // said `stopCode`, a name no macro declares, so the comparison had nothing
        // to compare against — the guard would have stayed silent even once a
        // reducer existed to run it.
        parameters: { comparePath: "stopId", against: "macro.input.requestedItemCode" },
      },
      preserveInputs: true,
      requiresCorrelation: true,
    },
    {
      factKey: NESY_FACTS.SCHEDULE_IN_USE_IS_TODAYS,
      plane: "APP",
      authority: "PRIMARY",
      displayName: "The schedule the session uses is today's stored one",
      provenance: {
        reducerKind: "CORRELATED_ALL_OF",
        reducerVersion: 1,
        // Three claims, one conclusion. Separately each is satisfiable by the
        // BROKEN state: the session shows a schedule (yesterday's), a schedule is
        // stored (yesterday's), and something is today's (nothing says the screen
        // uses it). Correlating on the schedule id is what makes them one answer.
        inputFactKeys: [
          NESY_FACTS.SCHEDULE_IN_USE,
          NESY_FACTS.SCHEDULE_PERSISTED,
          NESY_FACTS.SCHEDULE_IS_TODAY,
        ],
        parameters: { correlationPath: "scheduleId" },
      },
      preserveInputs: true,
      // The failure this guards is a MISMATCH, so an uncorrelated set must not
      // fire: route selection failing to create a schedule leaves the previous
      // day's plan on screen, and that is indistinguishable from success unless
      // the ids are required to agree.
      requiresCorrelation: true,
    },
    {
      factKey: NESY_FACTS.SCHEDULE_MATCHES_SELECTED_ROUTE,
      plane: "APP",
      authority: "PRIMARY",
      displayName: "The stored schedule belongs to the selected route",
      provenance: {
        reducerKind: "ENTITY_STATUS_EQUALS",
        reducerVersion: 1,
        // ORDER MATTERS: the reducer compares the first input that carries a
        // correlation value, so the route-carrying observation has to come first.
        // `SCHEDULE_ROUTE_OBSERVED` correlates on the route code the stored
        // schedule was created for; the observed selection is what makes this a
        // comparison about a SELECTION rather than about an intention — comparing
        // a stored route to a run input while the app selected nothing would
        // report agreement between two things that never met.
        inputFactKeys: [NESY_FACTS.SCHEDULE_ROUTE_OBSERVED, NESY_FACTS.SELECTED_ROUTE_OBSERVED],
        // `comparePath` is documentation here, not behaviour: the implemented
        // reducer reads the observation's correlation value. Naming the column it
        // came from keeps the pack readable without implying the host parses it.
        parameters: { comparePath: "schedule_route_code", against: "macro.input.routeCode" },
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
