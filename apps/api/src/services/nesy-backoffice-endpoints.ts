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

/** Mobile approval request states, from `MobileApprovalRequestsStatus`. */
export const MOBILE_APPROVAL_STATUS = {
  waiting: 0,
  approved: 1,
  rejected: 2,
  all: 3,
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

function approvalMatching(payload: unknown, uniqueIdentifier: string): Record<string, unknown> | undefined {
  return asArray(payload).find(
    (row) =>
      row !== null &&
      typeof row === 'object' &&
      str((row as Record<string, unknown>)['UniqueIdentifier']) === uniqueIdentifier,
  ) as Record<string, unknown> | undefined
}

/**
 * The nine allowlisted operations of `nesy.backoffice`.
 *
 * Keys are the pack's `operationRef` values verbatim; an operation absent from
 * this map fails closed rather than falling back to a guessed path.
 */
export const NESY_BACKOFFICE_ENDPOINTS: Readonly<Record<string, BackofficeEndpoint>> = {
  // ── Tour approval: mobile approval queue, not schedule end-of-day ──
  'nesy.backoffice.approve-tour-request': {
    path: 'Task/ValidateMobileApprovalRequests',
    confidence: 'SOURCE_VERIFIED',
    rationale:
      'TaskService.ValidateMobileApprovalRequests takes ValidateMobileApprovalRequestModel.UniqueIdentifier and Status. This approves the mobile approval request queue entry; schedule end-of-day is a separate flow.',
    body: (inputs) => ({
      UniqueIdentifier: str(inputs['approvalRequest']),
      Status: MOBILE_APPROVAL_STATUS.approved,
    }),
  },

  'nesy.backoffice.read-tour-approval-request': {
    path: 'Task/GetMobileApprovalRequests',
    confidence: 'SOURCE_VERIFIED',
    rationale:
      'Reads the mobile approval queue for the hub. Matching UniqueIdentifier proves the courier request created an approval record.',
    body: () => ({ Status: MOBILE_APPROVAL_STATUS.all }),
    normalize: (payload, inputs) => {
      const approval = approvalMatching(payload, str(inputs['approvalRequest']))
      return {
        request: {
          exists: approval !== undefined,
          status: approval === undefined ? null : approval['Status'],
          approvalRequestCode: approval === undefined ? null : approval['UniqueIdentifier'],
        },
      }
    },
  },

  'nesy.backoffice.read-tour-approval-status': {
    path: 'Task/GetMobileApprovalRequests',
    confidence: 'SOURCE_VERIFIED',
    rationale:
      'Reads approved mobile approval queue entries and matches UniqueIdentifier. This is distinct from schedule EndOfDayApproved.',
    body: () => ({ Status: MOBILE_APPROVAL_STATUS.approved }),
    normalize: (payload, inputs) => {
      const approval = approvalMatching(payload, str(inputs['approvalRequest']))
      return {
        approval: {
          statusIsApproved: approval !== undefined,
          status: approval === undefined ? null : approval['Status'],
          approvalRequestCode: approval === undefined ? null : approval['UniqueIdentifier'],
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
      return {
        assignment: {
          assigned: record['HasCourierTodaySchedule'] === true,
          route: record['Route'] ?? null,
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
      return { routes: { count: rows.length, any: rows.length > 0 } }
    },
  },

  // ── Inferred: no endpoint reads exactly what the pack describes ───────────
  'nesy.backoffice.read-session': {
    path: 'User/GetMyInfo',
    confidence: 'INFERRED',
    rationale:
      'The backend writes UserLoginLog on sign-in but exposes no read for it. GetMyInfo resolving the courier token is the closest available proof that the backend authenticated this session — it proves the session is live, not that a specific login row was written.',
    body: () => ({}),
    normalize: (payload) => {
      const record = (payload ?? {}) as Record<string, unknown>
      const userId = record['Id'] ?? record['id'] ?? null
      return { session: { authenticated: userId !== null, userId } }
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
          (str((candidate as Record<string, unknown>)['ShipmentId']) === shipmentId ||
            str((candidate as Record<string, unknown>)['Barcode']) === shipmentId),
      ) as Record<string, unknown> | undefined
      return {
        delivery: {
          completed: row !== undefined,
          status: row === undefined ? null : 'PROOF_AVAILABLE',
          shipmentId: row?.['ShipmentId'] ?? shipmentId,
        },
      }
    },
  },
}

export function resolveBackofficeEndpoint(operationRef: string): BackofficeEndpoint | undefined {
  return NESY_BACKOFFICE_ENDPOINTS[operationRef]
}
