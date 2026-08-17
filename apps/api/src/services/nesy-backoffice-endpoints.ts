/**
 * Domain Pack back-office operation → real Nesy endpoint.
 *
 * The Domain Pack declares operations and never endpoints — that is the whole
 * point of its allowlist, and `FORBIDDEN_REMOTE_OPERATION_FIELDS` enforces it.
 * The endpoint therefore has to live host-side, and this file is the only place
 * it does. Everything here was read out of the Nesy backend source
 * (`NESY.WebAPI`), the KrakenD gateway configs and the courier app, not guessed:
 * every path below is a `[MessageHandler(ExposeToHttp = true)]` service method
 * reachable through the gateway's `/{service}/{topic}` route.
 *
 * One operation is marked `INFERRED`. The backend has no endpoint that reads
 * exactly what the pack describes, so the closest honest observation is used and
 * labelled. An inferred mapping still proves something real — it just proves
 * slightly less than the operation's name suggests, and that difference must be
 * visible here rather than discovered during an incident.
 */

import { parseProofEventDate } from './eventual-observation-time.js'

export type EndpointConfidence = 'SOURCE_VERIFIED' | 'INFERRED'

export interface BackofficeEndpoint {
  /** Gateway path, e.g. `Task/ApproveScheduleEndOfDay`. Always POST. */
  path: string
  confidence: EndpointConfidence
  /** Why this endpoint answers the operation; read this before changing it. */
  rationale: string
  /**
   * Build the request body from the operation's resolved inputs.
   *
   * Bodies are typed per operation because the backend is not uniform: some
   * topics take a model, `AddUserIdToSchedule` takes a bare string.
   */
  body: (inputs: Readonly<Record<string, unknown>>) => unknown
  /**
   * Normalize the envelope payload into the shape the pack's `responsePath`
   * bindings address. Without this the pack would have to know backend field
   * names, which is the coupling the adapter exists to prevent.
   */
  normalize?: (payload: unknown, inputs: Readonly<Record<string, unknown>>) => Record<string, unknown>
}

/**
 * Schedule lifecycle states, from `ScheduleStatusType`.
 *
 * The tour approval flow lives entirely on these: `RequestLeavingPermission`
 * writes `waitingForApproval`, `ApproveLeavingPermission` writes `approved`.
 */
export const SCHEDULE_STATUS = {
  beginningOfDay: 0,
  waitingForApproval: 1,
  approved: 2,
  endOfDay: 3,
  endOfDayApproved: 4,
  endOfDayRejected: 5,
} as const

function str(value: unknown): string {
  return typeof value === 'string' ? value : value === undefined || value === null ? '' : String(value)
}

function asArray(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (payload !== null && typeof payload === 'object') {
    for (const value of Object.values(payload as Record<string, unknown>)) {
      if (Array.isArray(value)) return value
    }
  }
  return []
}

/**
 * RS staging `GetShipmentDeliveryProof` rows use camelCase `waybillNumber`.
 * The older PascalCase `ShipmentId` / `Barcode` aliases are kept so a
 * serializer flip does not silently un-match a real Delivered row.
 */
function proofRowId(row: Record<string, unknown>): string {
  return str(
    row['waybillNumber'] ??
      row['WaybillNumber'] ??
      row['ShipmentId'] ??
      row['shipmentId'] ??
      row['Barcode'] ??
      row['barcode'],
  )
}

/**
 * Find the leaving-permission row for one schedule.
 *
 * `GetWaitingLeavingRequests` returns every WaitingForApproval and Approved
 * schedule in the hub — 47 of them on RS staging when this was measured — so the
 * scheduleId match is not a convenience, it is what stops another courier's tour
 * from answering this run's question.
 */
function leavingRequestFor(payload: unknown, scheduleId: string): Record<string, unknown> | undefined {
  if (scheduleId === '') return undefined
  return asArray(payload).find(
    (row) =>
      row !== null &&
      typeof row === 'object' &&
      str((row as Record<string, unknown>)['scheduleId']) === scheduleId,
  ) as Record<string, unknown> | undefined
}

function scheduleStatusOf(row: Record<string, unknown> | undefined): number | null {
  if (row === undefined) return null
  const raw = row['scheduleStatus']
  return typeof raw === 'number' ? raw : null
}

/** True when GetWaitingLeavingRequests still lists this schedule as WaitingForApproval. */
export function isWaitingForApproval(payload: unknown, scheduleId: string): boolean {
  return scheduleStatusOf(leavingRequestFor(payload, scheduleId)) === SCHEDULE_STATUS.waitingForApproval
}

/**
 * The ten allowlisted operations of `nesy.backoffice`.
 *
 * Keys are the pack's `operationRef` values verbatim; an operation absent from
 * this map fails closed rather than falling back to a guessed path.
 */
export const NESY_BACKOFFICE_ENDPOINTS: Readonly<Record<string, BackofficeEndpoint>> = {
  // ── Tour approval: the leaving-permission flow, keyed by scheduleId ────────
  //
  // These three pointed at `MobileApprovalRequests` until 2026-08-12, when the
  // flow was run by hand on RS staging. That queue is a different mechanism
  // altogether — written by `SendMobileApprovalRequests`, its `UniqueIdentifier`
  // supplied by the client, a general "a supervisor must approve this mobile
  // request" facility. The courier's Request Tour Start button never touches it.
  // `Task/RequestLeavingPermission` does exactly one thing (TaskOperation.cs:2198):
  //
  //     scheduleDocument.ScheduleStatus = ScheduleStatusType.WaitingForApproval
  //
  // The old mappings were `SOURCE_VERIFIED` and the label was honest — those
  // endpoints really do behave as described. They were verified against the wrong
  // flow. Reading the source proves what an endpoint does, not that it is the
  // endpoint the operation means.
  //
  // The correlation key is `scheduleId` throughout. There is no approval request
  // code to correlate on: the request response is the bare string "Leaving
  // permission request saved" and no identifier is minted anywhere.
  'nesy.backoffice.approve-tour-request': {
    path: 'Task/ApproveLeavingPermission',
    confidence: 'SOURCE_VERIFIED',
    rationale:
      'TaskService.ApproveLeavingPermission takes ApproveLeavingPermissionModel{ScheduleIds, EventLocation, CourierUserNames} and moves the schedule WaitingForApproval -> Approved. Measured against RS staging 2026-08-12: 200, and the schedule advanced.',
    // EventLocation must be an object even though the service overwrites its
    // coordinates from the request point — it dereferences the field first.
    body: (inputs) => ({
      ScheduleIds: [str(inputs['approvalRequest'])],
      EventLocation: { Lat: 0, Lon: 0 },
      CourierUserNames: [],
    }),
  },

  'nesy.backoffice.read-tour-approval-request': {
    path: 'Task/GetWaitingLeavingRequests',
    confidence: 'SOURCE_VERIFIED',
    rationale:
      'Returns every schedule in the hub sitting at WaitingForApproval or Approved. The presence of this run\'s scheduleId proves the courier request was recorded; absence proves it was not.',
    body: () => ({}),
    normalize: (payload, inputs) => {
      const row = leavingRequestFor(payload, str(inputs['approvalRequest']))
      return {
        request: {
          exists: row !== undefined,
          status: scheduleStatusOf(row),
          scheduleId: row === undefined ? null : row['scheduleId'],
        },
      }
    },
  },

  'nesy.backoffice.reject-tour-request': {
    path: 'Task/RejectLeavingPermission',
    confidence: 'SOURCE_VERIFIED',
    rationale:
      'TaskOperation.RejectLeavingPermission writes ScheduleStatus = BeginningOfDay unconditionally. Measured 2026-08-15 on RS staging: the topic deserializes List<RejectLeavingPermissionRequest>, not the ApproveLeavingPermission object shape. Body is [{ ScheduleId, RejectionReason }]. RejectionReason is an enum; 0 is the lab reset used to repeat tour-approval. This is TEARDOWN, not a product-success path. Transport "Request(s) are rejected" is not enough: the adapter must re-read GetWaitingLeavingRequests and fail if this schedule is still WaitingForApproval.',
    body: (inputs) => [
      {
        ScheduleId: str(inputs['approvalRequest']),
        RejectionReason: 0,
      },
    ],
  },

  'nesy.backoffice.read-tour-approval-status': {
    path: 'Task/GetWaitingLeavingRequests',
    confidence: 'SOURCE_VERIFIED',
    rationale:
      'Same read, different question: not "is there a request" but "did THIS schedule reach Approved". Both are needed — a schedule can be present and still be WaitingForApproval, which is precisely the failure a single existence check would report as success.',
    body: () => ({}),
    normalize: (payload, inputs) => {
      const row = leavingRequestFor(payload, str(inputs['approvalRequest']))
      const status = scheduleStatusOf(row)
      return {
        approval: {
          statusIsApproved: status === SCHEDULE_STATUS.approved,
          status,
          scheduleId: row === undefined ? null : row['scheduleId'],
        },
      }
    },
  },

  // ── Route assignment: schedule.CourierUserId ──────────────────────────────
  'nesy.backoffice.read-route-assignment': {
    path: 'Task/CheckHasCourierTodaySchedule',
    confidence: 'SOURCE_VERIFIED',
    rationale:
      'Returns { HasCourierTodaySchedule, Route } for the authenticated courier — exactly "does the backend consider a route assigned to this courier", with the zone code as the correlating status.',
    body: () => ({}),
    normalize: (payload) => {
      const record = (payload ?? {}) as Record<string, unknown>
      const route = record['Route'] ?? null
      return {
        assignment: {
          exists: record['HasCourierTodaySchedule'] === true,
          status: route === null ? null : 'ASSIGNED',
          routeCode: route,
        },
      }
    },
  },

  'nesy.backoffice.seed-route-assignment': {
    path: 'Task/AddUserIdToSchedule',
    confidence: 'SOURCE_VERIFIED',
    rationale:
      'TaskService.AddUserIdToSchedule reads AddUserIdToScheduleRequest.ScheduleId, then TaskOperation.AddUserIdToSchedule writes CourierUserId/CourierName from the bearer token.',
    body: (inputs) => ({ ScheduleId: str(inputs['scheduleId'] ?? inputs['route']) }),
  },

  'nesy.backoffice.release-route-assignment': {
    path: 'Task/RemoveUserIdFromSchedule',
    confidence: 'SOURCE_VERIFIED',
    rationale:
      "Clears CourierUserId on the authenticated courier's own non-approved schedule for today. Takes no body; the user comes from the token.",
    body: () => ({}),
  },

  'nesy.backoffice.read-routes': {
    path: 'Task/GetBranchSchedules',
    confidence: 'SOURCE_VERIFIED',
    rationale:
      "Today's schedules for the user's branch. A courier offered no route sees an empty dialog; this says whether that is a backend state or a UI defect.",
    body: () => ({}),
    normalize: (payload) => {
      const rows = asArray(payload)
      return {
        routes: {
          available: rows.length > 0,
          status: rows.length === 0 ? 'NONE_OFFERED' : 'OFFERED',
          // GetBranchSchedules answers for the branch, not for one correlated
          // request, so there is no backend-issued correlation id to report.
          correlationId: null,
          count: rows.length,
        },
      }
    },
  },

  // ── Inferred: no endpoint reads exactly what the pack describes ───────────
  'nesy.backoffice.read-session': {
    path: 'User/GetMyInfo',
    confidence: 'INFERRED',
    rationale:
      'The backend writes UserLoginLog on sign-in (UserWebAPI AuthOperation) but exposes no read for it. GetMyInfo resolving the caller token is the closest available observation.\n' +
      'KNOWN LIMITATION — this runs with the DASHBOARD ADMIN token, so it resolves the admin identity, not the courier that just signed in. It proves the back office is reachable and the admin session is live; it does NOT prove the courier authenticated. `nesy.macro.login` therefore does not treat REMOTE.AUTH_ACCEPTED as REQUIRED. Closing this needs a backend read for the courier login record, or the courier token carried into the evidence lane.',
    body: () => ({}),
    normalize: (payload) => {
      const record = (payload ?? {}) as Record<string, unknown>
      const userId = record['Id'] ?? record['id'] ?? null
      return {
        session: {
          accepted: userId !== null,
          status: userId === null ? null : 'LIVE',
          // The backend's own identifier for the resolved session. Echoing the
          // caller's `sessionCorrelationId` back would read as backend
          // confirmation of a correlation the backend never checked.
          correlationId: userId,
          userId,
        },
      }
    },
  },

  'nesy.backoffice.read-delivery-status': {
    path: 'Tracking/GetShipmentDeliveryProof',
    confidence: 'SOURCE_VERIFIED',
    rationale:
      'TrackingService.GetShipmentDeliveryProof exposes the proof-of-delivery event log by ShipmentIdList. This is stronger than Shipment/SearchShipment status and matches the delivery confirmation oracle.',
    body: (inputs) => ({ ShipmentIdList: [str(inputs['shipment'] ?? inputs['shipmentId'] ?? inputs['barcode'])] }),
    normalize: (payload, inputs) => {
      const shipmentId = str(inputs['shipment'] ?? inputs['shipmentId'] ?? inputs['barcode'])
      const row = asArray(payload).find(
        (candidate) =>
          candidate !== null &&
          typeof candidate === 'object' &&
          proofRowId(candidate as Record<string, unknown>) === shipmentId,
      ) as Record<string, unknown> | undefined
      const matchedId = row === undefined ? '' : proofRowId(row)
      return {
        delivery: {
          // Empty / unmatched is REMOTE_PENDING, not a proven negative.
          // `completed: false` is a MEASURED contradiction: ASSERT_FACT and
          // the Final Oracle then skip the pack's EVENTUAL 120s window.
          // That window is the product's TwoDelayFlow (`createdAt + 120`),
          // not a timeout invented to green one run.
          completed: row === undefined ? null : true,
          status: row === undefined ? 'REMOTE_PENDING' : 'PROOF_AVAILABLE',
          // The matched row's own waybill, not the requested one: an echo of
          // the input would correlate the observation with itself.
          correlationId: matchedId || null,
          shipmentId: matchedId || shipmentId,
          // Authoritative payload time. EVENTUAL eligibility uses this
          // when trusted; HTTP request start is never a substitute.
          sourceEventAtMs:
            row === undefined ? null : parseProofEventDate(row['eventDate'] ?? row['EventDate']),
        },
      }
    },
  },
}

export function resolveBackofficeEndpoint(operationRef: string): BackofficeEndpoint | undefined {
  return NESY_BACKOFFICE_ENDPOINTS[operationRef]
}
