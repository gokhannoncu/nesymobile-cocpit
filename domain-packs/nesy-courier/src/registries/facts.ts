/**
 * ===========================================================================
 *  Normalized fact keys  (Plan D.6E · 4B.15)
 *
 *  Fact keys are plane-prefixed. That is not cosmetic: the same business
 *  question answered by the UI, by the app's own state, by the device's local
 *  store and by the backend are FOUR different pieces of evidence with four
 *  different failure modes. `USER_SESSION_AVAILABLE` alone would let a run
 *  satisfy a backend requirement with a screen observation.
 *
 *  Queue facts live under `LOCAL.`, not under a `QUEUE.` prefix, because an
 *  offline queue is a source kind inside the local plane. A plane per mechanism
 *  would mean a Core change for every new mechanism.
 * ===========================================================================
 */

/** Every fact this pack can produce, as a named constant per fact. */
export const NESY_FACTS = {
  // ── UI plane ────────────────────────────────────────────────────────────
  LOGIN_SCREEN_READY: "UI.LOGIN_SCREEN_READY",
  ROUTE_DIALOG_READY: "UI.ROUTE_DIALOG_READY",
  ROUTE_LIST_READY: "UI.ROUTE_LIST_READY",
  TASK_LIST_READY: "UI.TASK_LIST_READY",
  DELIVERY_FLOW_READY: "UI.DELIVERY_FLOW_READY",
  PICKUP_FLOW_READY: "UI.PICKUP_FLOW_READY",
  VEHICLE_LOADING_READY: "UI.VEHICLE_LOADING_READY",
  END_OF_DAY_READY: "UI.END_OF_DAY_READY",
  SCANNER_SURFACE_READY: "UI.SCANNER_SURFACE_READY",
  PAYMENT_SURFACE_READY: "UI.PAYMENT_SURFACE_READY",
  FISCAL_SURFACE_READY: "UI.FISCAL_SURFACE_READY",
  UPDATE_DIALOG_PRESENT: "UI.UPDATE_DIALOG_PRESENT",
  SESSION_EXPIRED_DIALOG_PRESENT: "UI.SESSION_EXPIRED_DIALOG_PRESENT",
  PERMISSION_DIALOG_PRESENT: "UI.PERMISSION_DIALOG_PRESENT",
  NETWORK_DIALOG_PRESENT: "UI.NETWORK_DIALOG_PRESENT",
  /**
   * The push-driven notification list is on screen, covering the stop list.
   *
   * A PRESENCE fact, in the same family as the two dialog-present facts above and
   * for the same reason: an interrupt is only handleable if its arrival can be
   * observed. Measured on device 2026-08-12 — an FCM push
   * ("Leaving Permission Approved by your Dispatcher") makes `MainActivity`'s
   * LocalBroadcast receiver call `StopListFragment.setAndShowNotificationsList()`,
   * and the run that followed reported `resolve:id=btn_out:NOT_FOUND` because the
   * list was over the stop list the whole time.
   */
  NOTIFICATION_LIST_PRESENT: "UI.NOTIFICATION_LIST_PRESENT",
  LOADING_BLOCKER_PRESENT: "UI.LOADING_BLOCKER_PRESENT",

  // ── APP plane (SDK state / adapter projections / critical events) ───────
  USER_SESSION_AVAILABLE_APP: "APP.USER_SESSION_AVAILABLE",
  AVAILABLE_STOPS_LOADED: "APP.AVAILABLE_STOPS_LOADED",
  ACTIVE_STOP_OBSERVED: "APP.ACTIVE_STOP_OBSERVED",
  /** The wrong-row guard. See `open-stop.ts`. */
  ACTIVE_STOP_MATCHES: "APP.ACTIVE_STOP_MATCHES",
  SELECTED_ROUTE_OBSERVED: "APP.SELECTED_ROUTE_OBSERVED",
  /**
   * The SESSION is working with a schedule — the screen has one in hand.
   *
   * Deliberately says nothing about WHICH schedule, because that is the whole
   * question: selecting a route is supposed to create today's schedule, and when
   * that creation fails the app loads whatever Room happens to hold — including
   * yesterday's. A screen showing a plan is therefore not evidence that the plan
   * is today's, and folding the two into one fact would hide exactly the defect
   * worth catching. Correlated with [SCHEDULE_IS_TODAY] by schedule id.
   */
  SCHEDULE_IN_USE: "APP.SCHEDULE_IN_USE",
  /** Derived: the schedule the session is using IS today's persisted one. */
  SCHEDULE_IN_USE_IS_TODAYS: "APP.SCHEDULE_IN_USE_IS_TODAYS",
  /**
   * Derived: the stored schedule was created FOR the route this run selected.
   *
   * Freshness is not enough. A schedule can be today's, stored and on screen and
   * still belong to a different route — the courier would then work someone
   * else's plan on a day that looks perfectly normal, which is the same class of
   * silent wrongness as tapping the wrong row.
   */
  SCHEDULE_MATCHES_SELECTED_ROUTE: "APP.SCHEDULE_MATCHES_SELECTED_ROUTE",
  PARCEL_SCANNED: "APP.PARCEL_SCANNED",
  PARCEL_STATE_PROCESSED: "APP.PARCEL_STATE_PROCESSED",
  DELIVERY_SUBMITTED: "APP.DELIVERY_SUBMITTED",
  TOUR_APPROVAL_REQUESTED: "APP.TOUR_APPROVAL_REQUESTED",
  TOUR_APPROVAL_PUSH_RECEIVED: "APP.TOUR_APPROVAL_PUSH_RECEIVED",
  /**
   * The DEVICE's own stored schedule reads Approved — not "the backend approved it".
   *
   * These are two facts, and the gap between them is the defect. Measured on
   * 2026-08-12: after a dispatcher approval the push landed on the device in 6.3s,
   * then 28 seconds and ZERO `Task/GetMyScheduleByZoneCode` calls passed before a
   * screen change finally made the app refetch. For that whole window the backend
   * said Approved and the courier's device did not, and only the device's answer
   * governs what the courier can actually do next.
   *
   * Sourced from an SDK event rather than the UI because the UI cannot answer it:
   * the stop-list `btn_out` label is a function of schedule status, but
   * ScheduleStatusType Approved(2) and EndOfDay(3) BOTH render "End Of Tour", and
   * the only discriminator — `enabled` — is clobbered by the click handler
   * re-enabling the view 1s after any tap. The numeric status has to come off the
   * wire; the device emits it at schedule-store time as a boolean.
   */
  SCHEDULE_STATUS_APPROVED: "APP.SCHEDULE_STATUS_APPROVED",
  LOGIN_SUCCEEDED: "APP.LOGIN_SUCCEEDED",
  /**
   * The backend REFUSED the credentials.
   *
   * Not the negation of a session fact. "No session" covers a refused login, a
   * login never attempted, and automation that broke before typing — and a test
   * that cannot tell those apart blames itself for a product defect. This fact is
   * only ever true when the product itself said no.
   */
  LOGIN_REJECTED: "APP.LOGIN_REJECTED",
  SESSION_ISOLATION_ASSERTED: "APP.SESSION_ISOLATION_ASSERTED",

  // ── LOCAL plane (device store, offline queue) ──────────────────────────
  USER_SESSION_AVAILABLE_LOCAL: "LOCAL.USER_SESSION_AVAILABLE",
  OFFLINE_QUEUE_ITEM_WAITING: "LOCAL.OFFLINE_QUEUE_ITEM_WAITING",
  OFFLINE_QUEUE_DRAINED: "LOCAL.OFFLINE_QUEUE_DRAINED",
  PARCEL_RECORD_PERSISTED: "LOCAL.PARCEL_RECORD_PERSISTED",
  /**
   * The scanned parcel is IN the working schedule.
   *
   * Observed through `nesy.parcelState` narrowed by the scanned value, so a row
   * at all means THAT parcel — not "some parcel was loaded". The projection
   * matches `barcode`, `legacySystemBarcode` and `legacySystemShortBarcode`
   * against the same argument, which is why one input covers all three spellings.
   *
   * Deliberately NOT "status == Loaded": the projection reports `item_status` as
   * a number in a string (`"4"`), and the host reads a fact value only from
   * `"true"`/`"false"`. Asserting the status needs a boolean column on the app
   * side; claiming it from a numeric string would be the harness inventing a
   * measurement. See the pack's own note in the load macro.
   */
  PARCEL_IN_SCHEDULE: "LOCAL.PARCEL_IN_SCHEDULE",
  /**
   * The stored schedule now carries a BODY — at least one stop chunk.
   *
   * The counterpart of the select-route baseline: route selection creates the
   * schedule empty, and loading is what puts work in it. "0 at selection, N after
   * loading" is the shape, and this fact is the N side of it.
   */
  SCHEDULE_BODY_STORED: "LOCAL.SCHEDULE_BODY_STORED",
  /**
   * A schedule is stored WITH ITS BODY — meta row plus stop chunks.
   *
   * A meta row on its own is not a usable plan: `saveScheduleToLocal` writes the
   * meta and the stop chunks separately, so a half-written schedule looks present
   * and works badly. The projection counts chunks for that exact schedule id.
   */
  SCHEDULE_PERSISTED: "LOCAL.SCHEDULE_PERSISTED",
  /**
   * WHICH route the stored schedule was created for.
   *
   * A separate fact from [SCHEDULE_PERSISTED] because a fact carries ONE
   * correlation value and these two are correlated on different things: the
   * stored plan is identified by its schedule id, while "is this the right
   * route" can only be judged against the route code. `ENTITY_STATUS_EQUALS`
   * compares the observation's correlation value, so the claim about the route
   * has to be the fact that carries the route.
   */
  SCHEDULE_ROUTE_OBSERVED: "LOCAL.SCHEDULE_ROUTE_OBSERVED",
  /**
   * The stored schedule is TODAY'S, by the product's own rule.
   *
   * Read from `ScheduleSessionValidator`, the same object the screens consult —
   * not a re-implementation of the date comparison, which would only ever prove
   * the copy agrees with itself.
   */
  SCHEDULE_IS_TODAY: "LOCAL.SCHEDULE_IS_TODAY",

  // ── REMOTE plane (backend validators, back-office adapter) ─────────────
  AUTH_ACCEPTED: "REMOTE.AUTH_ACCEPTED",
  ROUTES_AVAILABLE: "REMOTE.ROUTES_AVAILABLE",
  ROUTE_ASSIGNED: "REMOTE.ROUTE_ASSIGNED",
  DELIVERY_STATUS_COMPLETED: "REMOTE.DELIVERY_STATUS_COMPLETED",
  DELIVERY_CONFIRMED: "REMOTE.DELIVERY_CONFIRMED",
  TOUR_APPROVAL_REQUEST_CREATED: "REMOTE.TOUR_APPROVAL_REQUEST_CREATED",
  TOUR_APPROVAL_STATUS_APPROVED: "REMOTE.TOUR_APPROVAL_STATUS_APPROVED",
  TOUR_APPROVAL_CONFIRMED: "REMOTE.TOUR_APPROVAL_CONFIRMED",
} as const;

export type NesyFactKey = (typeof NESY_FACTS)[keyof typeof NESY_FACTS];
