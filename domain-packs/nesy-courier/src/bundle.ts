/**
 * ===========================================================================
 *  Nesy Courier bundle assembly  (Plan D.6B · 4B.14)
 *
 *  One function, one manifest, one bundle. The manifest's `notResponsibleFor` is
 *  the field worth reading: a pack that lists only what it covers reads as
 *  covering everything, and the first escaped bug becomes an argument about scope
 *  instead of a triage.
 *
 *  `publicationState: "DRAFT"` and no provenance: this pack version has not been
 *  published, and `validateDomainPackBundle` would demand a matching digest if it
 *  claimed otherwise. Publication happens through `publishBundle`, which computes
 *  the digest, records provenance and deep-freezes the result — see the
 *  `publishes and freezes` test.
 * ===========================================================================
 */

import {
  DECLARATIVE_RUNTIME_CODE_POLICY,
  type DomainPackBundle,
  type DomainPackManifest,
} from "@nesy/domain-pack-contracts";
import { NESY_BACKOFFICE_ADAPTER } from "./adapters/backoffice.js";
import { NESY_COURIER_DERIVED_FACTS } from "./evidence/derived.js";
import { NESY_COURIER_EVIDENCE_SOURCES } from "./evidence/sources.js";
import { NESY_COMPLETE_DELIVERY_MACRO } from "./macros/complete-delivery.js";
import { NESY_FULL_COURIER_DAY_MACRO } from "./macros/full-courier-day.js";
import { NESY_DISMISS_NOTIFICATION_LIST_MACRO, NESY_GRANT_PERMISSION_MACRO, NESY_RECOVER_NETWORK_MACRO } from "./macros/interrupt-handlers.js";
import { NESY_LOAD_TO_VEHICLE_MACRO } from "./macros/load-to-vehicle.js";
import { NESY_LOGIN_MACRO, NESY_LOGIN_REJECTED_MACRO } from "./macros/login.js";
import { NESY_LOGIN_AND_SELECT_ROUTE_MACRO } from "./macros/login-and-select-route.js";
import { NESY_OPEN_STOP_MACRO } from "./macros/open-stop.js";
import { NESY_PROCESS_PARCEL_MACRO } from "./macros/process-parcel.js";
import { NESY_SELECT_ROUTE_MACRO } from "./macros/select-route.js";
import { NESY_TOUR_APPROVAL_MACRO } from "./macros/tour-approval-lifecycle.js";
import { NESY_COURIER_LAUNCH_PROFILES } from "./profiles/launch.js";
import { NESY_COURIER_CAMPAIGNS, NESY_COURIER_TEST_PROFILES } from "./profiles/test-profiles.js";
import { NESY_COURIER_FRAGMENTS, NESY_COURIER_INDEPENDENT_WORKFLOWS } from "./profiles/workflows.js";
import { NESY_COURIER_SEMANTIC_ACTIONS } from "./registries/actions.js";
import { NESY_COURIER_APPLICATION, NESY_COURIER_APPLICATION_KEY } from "./registries/application.js";
import { NESY_COURIER_CAPABILITIES } from "./registries/capabilities.js";
import { NESY_COURIER_ENTITIES } from "./registries/entities.js";
import { NESY_COURIER_FEATURES } from "./registries/features.js";
import { NESY_COURIER_SCREENS } from "./registries/screens.js";
import { NESY_COURIER_SURFACES } from "./registries/surfaces.js";
import { NESY_COURIER_TARGETS } from "./registries/targets.js";

export const NESY_COURIER_PACK_KEY = "nesy.courier";

export const NESY_COURIER_MANIFEST: DomainPackManifest = {
  schemaVersion: 1,
  packKey: NESY_COURIER_PACK_KEY,
  packName: "Nesy Courier",
  // 1.40.0 — composed legs also namespace `var.<name>` references that live
  //   inside a step's args. run_237cb164 asked the device to scroll to row "-"
  //   because `scroll-to-row` still pointed at the pre-rename variable; the
  //   branch had never executed before, because every earlier composed run
  //   found the route already selected.
  //
  // 1.39.0 — the stop row is addressed by the legacy system id the row PRINTS,
  //   not the mongo stop_id no screen renders. run_3acf9459: the old key made
  //   the only match on screen the search box the run had just typed into, so
  //   the bridge tapped an EditText and reported RESOLVED_UNIQUE.
  //
  // 1.38.0 — tour approval measures the already-open path instead of waiting for
  //   an event that cannot be re-emitted: the schedule read publishes
  //   LOCAL.TOUR_APPROVAL_REQUEST_ALREADY_OPEN, a second correlated derivation
  //   concludes REMOTE.TOUR_APPROVAL_CONFIRMED_FOR_OPEN_REQUEST, and the final
  //   oracle applies exactly one of the two conclusions per path.
  //
  // 1.37.0 — tour approval accepts an already WaitingForApproval/Approved
  //   schedule and jumps to backend verification instead of reopening UI request.
  //
  // 1.36.0 — select-route first accepts an already-selected matching route and
  //   its not-offered branch fails closed instead of ending a composed run green.
  //
  // 1.35.0 — cold login workflows expose an executable post-launch Android
  //   permission bootstrap before the first PIN target is resolved.
  //
  // 1.34.0 — G90.10 BD.6: complete-delivery keeps the product scan on
  //   consignmentNumber (short barcode) and asks GetShipmentDeliveryProof
  //   with proofLookupId (waybill). run_c96899d5 submitted locally then
  //   FAIL_PRODUCT because the proof call used the scan barcode and
  //   returned []. Classifier/oracle contract unchanged.
  //
  // 1.33.0 — G90.10 BD.6 host amend: complete-delivery binds
  //   LOCAL.OFFLINE_QUEUE_ITEM_WAITING from nesy.pendingOperation after
  //   tap-delivery-confirm. process-parcel / tap-input-confirm is
  //   HOST_NOT_CAPABLE (negative live: WAN cut, no queue row). Classifier
  //   unchanged.
  //
  // 1.32.0 — G90.10 BD.6: process-parcel reads `nesy.pendingOperation` after
  //   the scan confirm and carries LOCAL.OFFLINE_QUEUE_ITEM_WAITING as an
  //   OPTIONAL oracle fact. Online uninjected stays PASS_ONLINE; a real queue
  //   row is what can produce PASS_QUEUED_OFFLINE. Not a remote-mutation host.
  //
  // 1.31.0 — G90.10 BD.3 live isolation: `release-approval-fixture` now carries
  //   a TEARDOWN spec (`reject-tour-request` → RejectLeavingPermission). The
  //   success path still ends at assert-approved; the failure path finally has
  //   an executable cleanup instead of a spec-less FAILED.
  //
  // 1.30.0 — G90.3 repeat runs exposed cross-run contamination: login cleanup
  //   existed as a disconnected CLEANUP node, so successful login left a real
  //   session behind and the next cold-real-login run opened StopListFragment.
  //   The assert steps now continue into `clear-session`, whose host runtime
  //   resets app state after the oracle has voted.
  //
  // 1.29.0 — G90.3 splits expected wrong-PIN rejection into its own independent
  //   workflow (`nesy.workflow.login-rejected`). The real UI action path is the
  //   same PIN-submit path, but the final oracle now votes on
  //   APP.LOGIN_REJECTED instead of successful session facts.
  //
  // 1.28.0 — G90.2b cold-start readiness owns the pre-action gate. The login
  //   workflow now enters at `resolve-pin-field`; the legacy `wait-login-ready`
  //   plan step is removed from the pack because INTERACTION_READY is enforced
  //   by the runtime before the first Bridge action.
  //
  // 1.27.0 — FULL_COURIER_DAY chains all seven product legs into one run, so the
  //   HAND-OFFS between them are finally under test: each leg now starts from the
  //   state the previous leg actually produced instead of one a launch profile
  //   installed. Four things had to be decided rather than concatenated, and each
  //   was a defect in the naive version:
  //
  //   1. Nine plan-step ids collide across these seven macros (`tap-row`,
  //      `tap-input-confirm`, `read-local-schedule`, …) and so do five variables.
  //      A concatenation is not untidy, it is INVALID — the IR validator rejects
  //      duplicate ids — and had it been accepted, `tap-row` would have meant the
  //      route row and the stop row at once. Legs are namespaced with
  //      domain-NEUTRAL prefixes because variable names are Core identifiers.
  //   2. Four legs open by waiting for a screen the PREVIOUS leg's continue gate
  //      already closed on. That is the 1.21.1 bug exactly: an event is stamped
  //      with the occurrence the host last seeded, so the wait looks under its own
  //      occurrence and never finds a fact that had plainly arrived. Those four
  //      waits stay in the timeline but became confirmatory (CONTINUE, short
  //      budget) instead of fatal.
  //   3. The push notification list is HANDLED here and only here. It is screen-
  //      scoped to the stop list, and the standalone tour-approval run ENDS just
  //      after the push — but this composition's next leg searches the stop list
  //      underneath it, which is the all-day failure 1.16.0 describes.
  //   4. The final oracle is built from the legs' ASSERT_FACT `finalOraclePolicy`,
  //      NOT from their macro `oracleTemplate.finalOracle`. Those two have drifted
  //      and the step is the current one — process-parcel's template still asks
  //      for `LOCAL.PARCEL_RECORD_PERSISTED` and `APP.SESSION_ISOLATION_ASSERTED`,
  //      a local write its branch does not perform and an assertion 1.21.0
  //      deliberately dropped. Merging the templates would have failed a correct
  //      day on evidence nothing in the run can produce.
  //
  //   Preconditions are login's ALONE, not the union: open-stop requires stops to
  //   be loaded and tour approval requires the approval NOT to exist yet, and both
  //   are statements about the middle of this run rather than its start.
  //
  // 1.25.0 — COMPLETE_DELIVERY runs the flow the courier actually performs.
  //   Measured 2026-08-13 on R6CW400BC8N, and the old plan was wrong in three
  //   independent ways, each of which alone would have stalled the run:
  //
  //   1. The Complete tap is not the last tap. `btn_deliver` opens "Choose A
  //      Delivery Option"; `btnDely` opens an ArasDialog confirmation; only
  //      its positive button delivers. Three taps, gated one at a time on the
  //      dedicated wire each raises, so a stall names the step that stalled.
  //   2. The scan is a precondition. `initiateDeliveryProcess` requires
  //      `shipmentModelList.any { isScanned }` and otherwise toasts and
  //      returns, emitting nothing. The screen opens with the counter at 0, so
  //      the macro scans on the delivery screen and gates on
  //      APP.DELIVERY_PARCEL_SCANNED — the gate the product itself checks.
  //   3. `btn_deliver` starts below the fold and `tap_id` rightly refuses an
  //      invisible node. New `reveal` action: the platform's own
  //      ACTION_SHOW_ON_SCREEN makes the app scroll, and the tap keeps its
  //      visibility gate. Not a pixel swipe, not a click on what nobody can see.
  //
  //   Also: `branch-on-queue` read `local.result` at `pendingOperation.count`,
  //   which nothing in this macro produced, so the branch could only resolve to
  //   unknown. It now reads `nesy.pendingOperation` (column `pending_count`).
  //   Invisible until now because no run had ever got past the Complete tap.
  //
  // 1.23.0 — delivery-screen wires each have one meaning. Shared DIALOG_SHOWN /
  //   DIALOG_DISMISSED stay uncatalogued (ArasDialog central + ScanProcessor).
  //   Payment, fiscal, type/confirm/unscanned/skip-EXW dialogs, and the
  //   DELIVERY_UI_COMPLETED error path now carry a boolean on every emit and
  //   data.barcode to join. COMPLETE_DELIVERY is still the unpaid DELY path;
  //   the new facts exist so later slices do not invent them under a shared name.
  //
  // 1.22.0 — COMPLETE_DELIVERY addresses the button that is actually on the
  //   Delivery screen. Measured 2026-08-13 on R6CW400BC8N: the control is
  //   `btn_deliver` (LinearLayout, label "Delivery" on a non-clickable child
  //   `text1`, below the fold until `delivery_scroll` is moved). The previous
  //   id `delivery_complete_button` exists nowhere — same invention as
  //   `tour_approval_request_button`. ID only: the word "Delivery" is also the
  //   action-bar title, so a text match is ambiguous. This slice remains the
  //   unpaid DELY path; payment/fiscal wires stay uncatalogued until each has
  //   one meaning and a boolean on every emit.
  //
  // 1.21.1 — both scan facts are gated on the TAP that causes them instead of on
  //   separate wait steps. A device event is stamped with the occurrence the host
  //   last seeded — the tapping step — so a wait looked under its own occurrence
  //   and never found a fact that had plainly arrived. Same shape TOUR_APPROVAL
  //   already uses.
  //
  // 1.21.0 — PROCESS_PARCEL drives the product's own input instead of a seam.
  //   It injected the scan through `nesy.setup.scanner-inject`, an
  //   automation-only backdoor that then had to be justified by asserting
  //   release isolation — and that the host had no runtime for anyway, the ref
  //   being a DEVICE COMMAND called as an adapter operation.
  //
  //   Measured: the task page carries the SAME manual-entry control as the stop
  //   list (`manuel_input` → `et_input_dialog_barcode_number` → `btn_ok`), and
  //   typing there produced PARCEL_SCANNED, SCREEN_READY and DELIVERY_STARTED
  //   with the delivery screen open. A courier can type a barcode, so the test
  //   does too. No seam, no adapter to wire, no backdoor to explain — and
  //   `SESSION_ISOLATION_ASSERTED` went with the injection, because it guarded a
  //   risk this slice no longer takes.
  //
  // 1.20.0 — PROCESS_PARCEL names ONE branch instead of implying all of them.
  //   Mapped 2026-08-13: a scan on the task page has roughly twenty outcomes —
  //   pickup, return document, D4M/LOS, force load, labelless, gray label — split
  //   by country, schedule status, task type, item state and pickup type, and
  //   MOST OF THEM EMIT NOTHING. `APP.PARCEL_SCANNED` fires for every accepted
  //   scan BEFORE the app routes it, so a slice resting on it would have gone
  //   green on branches that show a toast and change nothing.
  //
  //   The slice now claims the DELIVERY branch and says so: scan at a stop opens
  //   the delivery flow. `APP.DELIVERY_FLOW_STARTED` is the new discriminator,
  //   and `APP.SCHEDULE_STATUS_APPROVED` is required alongside it because that
  //   single field is the ONLY thing separating a real delivery from the
  //   `Already_Load` warning toast — invisible on screen, so it has to be
  //   evidence.
  //
  //   Two requirements were wrong rather than merely unproduced.
  //   `LOCAL.PARCEL_RECORD_PERSISTED` asked for a local write this branch does
  //   not perform. `APP.SESSION_ISOLATION_ASSERTED` was right to demand but
  //   nothing invoked `nesy.assert.release-isolation`, so it could only time
  //   out; the macro now calls it, which matters most in the one slice that
  //   INJECTS a scan.
  //
  // 1.19.0 — the wrong-row guard gets an observation it did not parameterise.
  //   `nesy.stopState` requires a stopId, so it answers 'tell me about THIS
  //   stop' — a run that passes the id it hoped for and gets a row back has
  //   confirmed its own assumption. OPEN_STOP now reads `nesy.activeStop`, a
  //   parameterless projection of the stop the APP has open, added to the device
  //   for exactly this. A guard that validates its own input is not a guard.
  //
  // 1.18.1 — the search-bar branch asks whether the absent marker EXISTS instead
  //   of comparing it to true. The probe writes the marker only when the bar is
  //   shut, so the equality form left the open case unresolvable and a run whose
  //   screen was fine died on unknownPolicy FAIL.
  //
  // 1.18.0 — the stop list search bar is a TOGGLE, and the pack now says so.
  //   Two targets for one field: a probe that answers 'is it open right now' at
  //   once (absent-tolerant), and the field itself, mandatory, resolved after the
  //   toggle tap so the host waits out the open animation. One target cannot be
  //   both absent-tolerant and patient.
  //
  // 1.17.0 — OPEN_STOP addresses a stop the way the PRODUCT does: type a key
  //   into the stop list search box, let the list filter, tap what survives.
  //   Measured 2026-08-13: a bogus term empties the list, the waybill leaves one
  //   row, and tapping the row text opens the task list. Two keys, deliberately:
  //   the search box KEEPS what was typed, so recognising the row by the same
  //   value matches twice and fails closed. The old projection pre-check is gone
  //   — it compared against a projection carrying no parcel key and could never
  //   answer the question; the guarantee now sits at the tap, where ambiguity
  //   fails closed.
  //
  // 1.16.0 — two surfaces the runs kept tripping over become modelled, and the
  //   device gets a fact for its OWN view of the schedule.
  //
  //   `nesy.notification-list-dialog` is the interrupt the tour approval runs
  //   fought all day: an FCM push does not merely arrive, the app NAVIGATES to
  //   its notification list, and every following run failed on the screen
  //   underneath it. HANDLE + a dismiss handler, and the app now emits the
  //   surface visibility — a surface the host cannot see is one it can never
  //   dismiss, so declaring the fact without an emit would have been the same
  //   mistake this pack keeps recording.
  //
  //   `APP.SCHEDULE_STATUS_APPROVED` is the device's own answer to "is this tour
  //   approved", emitted with the numeric status when the app ACCEPTS a schedule.
  //   It is deliberately NOT in the tour approval oracle yet: backend-approved
  //   and device-approved are two claims, and the 28-second gap between them
  //   (measured) is the product question worth asking separately.
  //
  // 1.15.0 — OPEN_STOP is addressed by the column the projection really has.
  //   Its presence check compared the requested code against
  //   `read-available.codes`, a field `nesy.availableStops` never emits, and the
  //   stop row bound on `stopCode`, which is the ENTITY business key and appears
  //   in no projection. Measured: the condition resolved against nothing, took
  //   the absent branch, and reported a precondition mismatch for a stop that was
  //   on screen. Both now read `stop_id`.
  //
  // 1.14.0 — the stop row is resolved by what is on the screen. Its chain opened
  //   with `ACCESSIBILITY_ID idPrefix: "stop_row_"` and fell back to a container
  //   `stop_list`; dumped from the device, neither exists — a row is an id-less
  //   clickable LinearLayout inside the RecyclerView `rv`. ENTITY_BINDING now
  //   leads, the fingerprint and index hint point at `rv`, and the index hint
  //   still establishes nothing. Third target in this pack written from a name
  //   instead of from the screen, after `route_row_*` and
  //   `tour_approval_request_button`.
  //
  // 1.13.0 — the tour start routing chooser becomes a real surface
  //   (`nesy.tour.routing-dialog`) instead of two targets hung off the stop list
  //   screen with a comment apologising for it. It is a DRIVEN surface: the slice
  //   opens it and the slice answers it, so its policy is IGNORE and the macro
  //   lists it as handled — HANDLE would put a dismissal handler in a race with
  //   the tap that carries the business meaning.
  //
  // 1.12.0 — TOUR_APPROVAL_LIFECYCLE is rebuilt around what the device and the
  //   backend actually do, after the flow was run by hand end to end on RS
  //   staging. Four things were wrong and all four were plausible:
  //
  //   The target `tour_approval_request_button` existed nowhere in the app. The
  //   real control is `btn_out` on the STOP LIST, and the slice was waiting for
  //   END_OF_DAY_READY on a screen the button does not live on.
  //
  //   The request is not one tap. Tapping opens a routing chooser, and only that
  //   choice issues `Task/RequestLeavingPermission`. The continue gate moved to
  //   the second tap; gating the first would wait for an event that cannot exist
  //   yet.
  //
  //   Both back-office reads pointed at `MobileApprovalRequests` — a queue this
  //   flow never writes to. The real state lives on the schedule
  //   (`ScheduleStatus`: WaitingForApproval → Approved) and is read through
  //   `GetWaitingLeavingRequests` / `ApproveLeavingPermission`.
  //
  //   `approvalRequestCode` was a required input nothing could supply: the
  //   request answers with a bare string and no identifier is minted anywhere.
  //   The correlation anchor is the SCHEDULE ID, which the device sends itself.
  //
  //   Still open, deliberately: the device-plane "schedule status is Approved"
  //   fact. Measured, the push does NOT refresh the schedule — 28 seconds and
  //   zero schedule calls passed between the push and the fetch, which a screen
  //   change triggered. Backend-approved and device-approved are two different
  //   claims and this version only makes the first.
  //
  // 1.11.0 — the zimmet slice gets the model it was written for, now that the
  //   host honours it: the RS time-range picker and the refusal dialog are
  //   absent-tolerant targets (notFoundPolicy TREAT_AS_ABSENT), and a step whose
  //   target is declared absent reports the new SKIPPED terminal state instead of
  //   failing. 1.10.1 had to declare FAIL and call the slice RS-only because the
  //   runtime read neither.
  //
  // 1.10.1 — LOAD_TO_VEHICLE (zimmet): the seventh slice, and the step that puts
  //   work into the schedule route selection creates empty. Every target in it was
  //   DUMPED from the device: manuel_input, et_input_dialog_barcode_number, btn_ok,
  //   btnSave (RS time range) and btn_arasDg_positive_button. Measured for one
  //   parcel: Loaded Parcels 0 → 1, one stop appeared, stop_chunk_count 0 → 1, and
  //   nesy.parcelState for that barcode returned item_status 4 (Loaded).
  //
  //   The country rule is a POLICY, not an : Serbia asks for a delivery time
  //   range and nobody else does, so the picker's confirm target declares
  //   notFoundPolicy TREAT_AS_ABSENT. A missing picker is a correct state.
  //
  //   The slice judges the QUERY planes, not the step wire. ScanProcessor already
  //   emits LOAD_TO_VEHICLE events for FETCH_SHIPMENT / CREATE_TASK /
  //   FETCH_SCHEDULE, but the host maps one wire name to one fact and needs a
  //   boolean valueField on every emit — and a refused frame BLOCKS. One name
  //   carrying three meanings cannot be registered, so those facts are
  //   deliberately not declared rather than declared without a producer.
  //
  //   select-route's macro oracleTemplate is brought back in step with its own
  //   ASSERT_FACT policy; the two had drifted, with the template still demanding
  //   the back-office assignment and gating on stops.
  //
  // 1.44.0 — no behaviour change. 1.43.0 was published and then edited (a probe
  //   target added during diagnosis was rolled back once the host's own surface
  //   sweep turned out to own that job), which left the published digest and the
  //   code disagreeing. A published version is immutable, so the corrected
  //   content needs its own number rather than a quiet reissue.
  //
  // 1.43.0 — open-stop waits for the stop list before probing it. The probe's
  //   TREAT_AS_ABSENT answers "absent" both when the search bar is shut and when
  //   the stop list is not on screen, and the slice read absent as the former:
  //   it tapped for a toggle that only exists on that screen and reported a
  //   targeting defect for a screen that had gone away. Measured on
  //   run_bff4172e — the previous leg released its approval fixture, the app left
  //   StopListFragment, and the toggle resolved `matched=0` fourteen seconds
  //   later. `load-to-vehicle` has always opened with this wait.
  //
  // 1.42.0 — the tour approval entity is keyed by the schedule the run OBSERVED
  //   (`var.approvalScheduleRows.schedule_id`) instead of `run.input.scheduleId`.
  //   In a journey the schedule is created by the run, so its id cannot be an
  //   input: the binding resolved to nothing, the back-office adapter refused
  //   the unbound tour call — correctly, since correlation is what stops
  //   yesterday's approval from satisfying today's oracle — and the run died at
  //   `verify-request-record` citing an input nobody could have supplied.
  //
  // 1.41.0 — the login leg reads the session BEFORE deciding to sign in, so an
  //   already-signed-in device is a branch and not a failure. A journey run
  //   against a device left signed in used to die on `resolve-pin-field`: the
  //   field is not on screen, the step failed, and the run aborted six seconds
  //   in with nothing saying the app was simply already past login. The precheck
  //   publishes NO facts — `USER_SESSION_AVAILABLE_APP` still comes from
  //   `read-app-session` after a real sign-in — so the login oracle cannot be
  //   satisfied by a session this run never established. The login-REJECTED
  //   slice keeps the unconditional path on purpose: it exists to prove a wrong
  //   PIN is refused, which needs the real screen.
  //
  // 1.9.0 — route selection is judged by the SCHEDULE it produces, not by a
  //   back-office row. Picking a route is supposed to create today's schedule and
  //   store it; when that create call fails, `StopListFragment` falls back to
  //   `loadStopListFromLocal()` for ANY schedule Room holds — including the
  //   previous day's — and the screen looks entirely normal while the courier
  //   works a stale plan. Nothing in a run said so, because "a schedule is on
  //   screen" was never separated from "today's schedule was created".
  //
  //   So the two planes are now read on their own terms and correlated:
  //   `APP.SCHEDULE_IN_USE` (which schedule the session holds),
  //   `LOCAL.SCHEDULE_PERSISTED` (the plan is stored: a meta row with a parseable
  //   payload) and
  //   `LOCAL.SCHEDULE_IS_TODAY` (the product's own `ScheduleSessionValidator`
  //   rule, not a copy of it). The derived `APP.SCHEDULE_IN_USE_IS_TODAYS`
  //   requires all three to agree ON THE SCHEDULE ID, which is what a stale
  //   fallback cannot do.
  //
  //   `REMOTE.ROUTE_ASSIGNED` leaves this slice's oracle. Whether a back-office
  //   table lists the assignment is a different question with a different owner,
  //   and requiring it here made a staging data gap read as a route-selection
  //   defect. The fact stays in the registry for slices that reason about the
  //   backend's own record.
  //
  //   The stored schedule must also belong to the SELECTED route
  //   (`APP.SCHEDULE_MATCHES_SELECTED_ROUTE`): freshness alone would accept a
  //   today, on-screen schedule created for a different route, and the courier
  //   would work someone else's plan on a day that looks normal.
  //
  //   `APP.AVAILABLE_STOPS_LOADED` is NOT a requirement of this slice, and that
  //   is the product's business rule rather than leniency: selecting a route
  //   creates the schedule EMPTY, the courier then loads the vehicle, and the
  //   schedule fills itself from what was loaded. A REQUIRED stop fact turned
  //   correct behaviour into FAIL_PRODUCT — measured, route 31's schedule was
  //   today's, stored, in use and for the right route, and the run still failed
  //   on zero stops. The count is still observed, because "0 at selection, N
  //   after loading" is the baseline the loading flow is judged against.
  //
  // 1.6.1 — the route dialog is retargeted at the arrangement the product
  //   actually renders. `route_row_*`, `route_list` and `route_dialog_confirm`
  //   were never on screen: the dialog is a Spinner (`dialog_spinner`) whose
  //   popup list carries NO id, rows share `android:id/text1`, and the confirm
  //   button is `yesButton`. Row identity is therefore the label the courier
  //   reads — `31 *` for a Serbian fiscal route, `31` elsewhere — bound from the
  //   projection rather than from the raw input. The offered read is narrowed by
  //   `matchKey`, which is what makes the row's index available at all, and the
  //   list is positioned by `scrollToItem` before the row is resolved: 9 of 253
  //   rows are on screen, so every route past the first screenful was
  //   unreachable, not merely hard to reach. The scroll step declares its own
  //   budget: the popup is a window the platform attaches after the tap returns,
  //   so a scroll issued in the same breath answers not_found and the same
  //   scroll succeeds a second later. How long a surface may take is a statement
  //   about the product, so it lives here.
  //
  // 1.5.0 — the fiscal marker is separated from route identity. Serbia shows
  //   fiscal-mandatory routes as `31 *`; the asterisk is a business rule, not a
  //   character of the code, and other countries offer the same route as `31`.
  //   The projection now reports `route_code`, `route_label` and
  //   `fiscal_required` separately and answers to either spelling.
  //
  // 1.4.1 — the offered-routes projection is bounded at 500, not 50: the device
  //   offers 253 routes and refused the read outright, and a truncated list would
  //   have answered "not offered" for a route that was.
  //
  // 1.4.0 — select-route reads the OFFERED routes (`nesy.offeredRoutes`) instead
  //   of the SELECTED one, and its condition addresses a column the projection
  //   actually has. The check could not pass before whatever the backend offered.
  //
  // 1.3.0 — the host now computes the pack's DERIVED facts, so open-stop's
  //   wrong-row guard and the tour-approval confirmation can be satisfied at all.
  //   open-stop's active-stop observation carries the stop identity the guard
  //   compares, and ACTIVE_STOP_MATCHES now compares against the input the macro
  //   actually declares (`requestedItemCode`) rather than a name nothing used.
  //
  // 1.26.0 — login-then-select-route is a composed macro (one expansion
  //   snapshot) so a cold start can PIN-login and pick the route in one run.
  //   The dedicated login and select-route workflows stay one-macro each.
  //
  // 1.2.0 — every independent workflow references exactly ONE macro. Signing in
  //   is a precondition installed by a launch profile, not a leg of the test:
  //   chaining it produced two expansion snapshots, which an empty canvas cannot
  //   auto-materialize, so five workflows could not compile at all — and it also
  //   would have reported a login defect as a route-selection failure.
  //
  // 1.1.0 — select-route and open-stop now OBSERVE the app-plane facts their
  //   oracles require (SDK_QUERY fact bindings), and select-route's confirm gate
  //   no longer waits on a fact produced two steps below it. Binding shape is now
  //   explicit about the question asked: a column, or whether the projection
  //   returned any row at all.
  //
  // Newest first. Every entry below is about ONE theme: the login slice used to
  // require evidence nothing produced, and each bump removed one such gap.
  //
  // 1.0.8 — the back-office read no longer aborts the run when it cannot be
  //   reached (`onUnavailable: RECORD_UNMEASURED`). It does not vote, so an
  //   outage must not turn a decidable login run into an automation failure.
  // 1.0.7 — a refused login is now its own fact (`APP.LOGIN_REJECTED`, from the
  //   app's `STATE_LOGIN_REJECTED` wire), and tap-submit's gate closes on EITHER
  //   outcome, so the run reaches its oracle instead of timing out and reporting
  //   "not enough evidence" for a product that answered clearly.
  // 1.0.6 — login OBSERVES the APP and LOCAL session planes with SDK_QUERY fact
  //   bindings instead of requiring facts no step produced, and
  //   `REMOTE.AUTH_ACCEPTED` drops to OPTIONAL because the mapped back-office
  //   read resolves the dashboard admin token rather than the courier's.
  // 1.45.0 — a REFUSED load is judged as untested, not as a product failure.
  //   `check-load-refused` branches on whether the app raised a dialog on the
  //   load path (`resolve-acknowledge` is TREAT_AS_ABSENT, so it already answers
  //   this) and routes to `assert-load-refused`, whose requirements time out
  //   INCONCLUSIVE instead of FAIL. Measured on run_38810dc0: a barcode naming a
  //   parcel delivered an hour earlier drew the app's own
  //   `DELY_DELR_STOR_LOST` dialog, nothing entered the schedule, and the run
  //   reported FAIL_PRODUCT for a product that had refused correctly. Being
  //   unsure still routes to the strict terminal — not knowing is not a refusal.
  // 1.45.1 — `check-load-refused` is an EXISTENCE test, not an equality one.
  //   The absent marker is present-or-missing by design, so comparing it to
  //   `true` left the present-dialog case resolving to nothing — the same
  //   mistake `open-stop`'s `check-search-open` already records. Caught on
  //   run_5b038e00 while reverting the mirrored `absentTarget: false` the host
  //   had briefly written, which would have made every existence test answer
  //   true in both states.
  version: { major: 1, minor: 45, patch: 1 },
  trustTier: "FIRST_PARTY",
  publicationState: "DRAFT",
  owner: "courier-mobile-quality",
  businessScope:
    "The courier's working day in the Nesy Courier mobile app: signing in, taking a route, opening stops, processing parcels, completing deliveries and getting the tour approved.",
  notResponsibleFor: [
    "the dispatcher's own back-office UI — only the typed operations this pack calls as a second actor",
    "payment, fiscal and settlement flows",
    "customer-facing tracking surfaces",
    "execution and scheduling: no run manifest, no queue, no lease lives in this pack",
    "any second tenant's business content",
  ],
  applicationRefs: [NESY_COURIER_APPLICATION_KEY],
  capabilityRequirements: [
    { capabilityRef: "verdict.core.bridge.tap", optional: false, reason: "Every slice acts on the UI." },
    { capabilityRef: "verdict.core.bridge.resolve-target", optional: false, reason: "Target resolution provider chain." },
    { capabilityRef: "domain.nesy.adapter.named-query", optional: false, reason: "Bounded projections back the evidence sources." },
    {
      capabilityRef: "domain.nesy.scanner.inject",
      optional: true,
      fallback: "DEGRADED_EVIDENCE",
      reason: "A device without the injection seam can fall back to the app's manual-entry surface.",
    },
    {
      capabilityRef: "domain.nesy.backoffice.approval-operations",
      optional: true,
      fallback: "SKIP_SLICE",
      reason: "Only TOUR_APPROVAL_LIFECYCLE needs the dispatcher operations; other slices run without them.",
    },
  ],
  dependencies: [],
  impactRefs: [
    { impactRef: "nesy.impact.stop-handling", kind: "FEATURE", note: "Pointer only; the impact graph itself is Phase 6 runtime state." },
    { impactRef: "nesy.impact.delivery-completion", kind: "FEATURE" },
    { impactRef: "nesy.impact.tour-approval", kind: "FEATURE" },
  ],
  resourceRequirementRefs: [
    { resourceRef: "nesy.resource.courier-account-pool", quantity: 1, exclusive: true, note: "A route may only be worked by one run at a time." },
    { resourceRef: "nesy.resource.android-device-class-a", quantity: 1, exclusive: true },
  ],
};

/** Assembles the full, validatable bundle. */
export function buildNesyCourierBundle(): DomainPackBundle {
  return {
    manifest: NESY_COURIER_MANIFEST,
    runtimeCodePolicy: DECLARATIVE_RUNTIME_CODE_POLICY,
    registries: {
      applications: [NESY_COURIER_APPLICATION],
      screens: NESY_COURIER_SCREENS,
      surfaces: NESY_COURIER_SURFACES,
      entities: NESY_COURIER_ENTITIES,
      targets: NESY_COURIER_TARGETS,
      evidenceSources: NESY_COURIER_EVIDENCE_SOURCES,
      derivedFacts: NESY_COURIER_DERIVED_FACTS,
      semanticActions: NESY_COURIER_SEMANTIC_ACTIONS,
      macros: [
        NESY_LOGIN_MACRO,
        NESY_LOGIN_REJECTED_MACRO,
        NESY_SELECT_ROUTE_MACRO,
        NESY_LOGIN_AND_SELECT_ROUTE_MACRO,
        NESY_LOAD_TO_VEHICLE_MACRO,
        NESY_OPEN_STOP_MACRO,
        NESY_PROCESS_PARCEL_MACRO,
        NESY_COMPLETE_DELIVERY_MACRO,
        NESY_TOUR_APPROVAL_MACRO,
        NESY_FULL_COURIER_DAY_MACRO,
        NESY_GRANT_PERMISSION_MACRO,
        NESY_RECOVER_NETWORK_MACRO,
        NESY_DISMISS_NOTIFICATION_LIST_MACRO,
      ],
      fragments: NESY_COURIER_FRAGMENTS,
      independentWorkflows: NESY_COURIER_INDEPENDENT_WORKFLOWS,
      launchProfiles: NESY_COURIER_LAUNCH_PROFILES,
      testProfiles: NESY_COURIER_TEST_PROFILES,
      campaigns: NESY_COURIER_CAMPAIGNS,
      features: NESY_COURIER_FEATURES,
      capabilities: NESY_COURIER_CAPABILITIES,
      remoteAdapters: [NESY_BACKOFFICE_ADAPTER],
    },
  };
}
