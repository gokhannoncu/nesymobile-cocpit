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
 * Two operations are marked `INFERRED`. The backend has no endpoint that reads
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

/** Schedule lifecycle states, from `ScheduleStatusType` in the backend. */
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

function scheduleMatching(payload: unknown, scheduleId: string): Record<string, unknown> | undefined {
  return asArray(payload).find(
    (row) =>
      row !== null &&
      typeof row === 'object' &&
      str((row as Record<string, unknown>)['ScheduleId']) === scheduleId,
  ) as Record<string, unknown> | undefined
}

/**
 * The nine allowlisted operations of `nesy.backoffice`.
 *
 * Keys are the pack's `operationRef` values verbatim; an operation absent from
 * this map fails closed rather than falling back to a guessed path.
 */
export const NESY_BACKOFFICE_ENDPOINTS: Readonly<Record<string, BackofficeEndpoint>> = {
  // ── Tour approval: `ScheduleStatusType` EndOfDay(3) → EndOfDayApproved(4) ──
  'nesy.backoffice.approve-tour-request': {
    path: 'Task/ApproveScheduleEndOfDay',
    confidence: 'SOURCE_VERIFIED',
    rationale:
      'TaskService.ApproveScheduleEndOfDay takes ApproveScheduleEndOfDayRequest.ScheduleIdList and moves the schedule to EndOfDayApproved. This is the dispatcher action the courier waits on.',
    body: (inputs) => ({ ScheduleIdList: [str(inputs['approvalRequest'])] }),
  },

  'nesy.backoffice.read-tour-approval-request': {
    path: 'Task/GetBranchSchedulesByBranchId',
    confidence: 'SOURCE_VERIFIED',
    rationale:
      'The end-of-day request IS the schedule row leaving BeginningOfDay. Filtering the branch schedules on the end-of-day states and matching ScheduleId proves the courier request created a record.',
    body: (inputs) => ({
      BranchId: Number(inputs['branchId'] ?? 0),
      ScheduleStatus: [
        SCHEDULE_STATUS.endOfDay,
        SCHEDULE_STATUS.endOfDayApproved,
        SCHEDULE_STATUS.endOfDayRejected,
      ],
    }),
    normalize: (payload, inputs) => {
      const schedule = scheduleMatching(payload, str(inputs['approvalRequest']))
      return {
        request: {
          exists: schedule !== undefined,
          status: schedule === undefined ? null : schedule['ScheduleStatus'],
          approvalRequestCode: schedule === undefined ? null : schedule['ScheduleId'],
        },
      }
    },
  },

  'nesy.backoffice.read-tour-approval-status': {
    path: 'Task/GetBranchSchedulesByBranchId',
    confidence: 'SOURCE_VERIFIED',
    rationale:
      'Same read, narrowed to EndOfDayApproved(4). The record being present under this filter is the approval itself, not an acknowledgement that an approval call was accepted.',
    body: (inputs) => ({
      BranchId: Number(inputs['branchId'] ?? 0),
      ScheduleStatus: [SCHEDULE_STATUS.endOfDayApproved],
    }),
    normalize: (payload, inputs) => {
      const schedule = scheduleMatching(payload, str(inputs['approvalRequest']))
      return {
        approval: {
          statusIsApproved: schedule !== undefined,
          status: schedule === undefined ? null : schedule['ScheduleStatus'],
          approvalRequestCode: schedule === undefined ? null : schedule['ScheduleId'],
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
      'Writes CourierUserId/CourierName onto the schedule. Body is a bare scheduleId string, not a model — TaskOperation.AddUserIdToSchedule(string scheduleId).',
    body: (inputs) => str(inputs['scheduleId'] ?? inputs['route']),
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
    path: 'Shipment/SearchShipment',
    confidence: 'INFERRED',
    rationale:
      'Returns the shipment record with its status, correlated by barcode. Tracking/GetShipmentDeliveryProof is the stronger source if proof-of-delivery rather than status is what the oracle should require.',
    body: (inputs) => ({ Barcode: str(inputs['shipment'] ?? inputs['barcode']) }),
    normalize: (payload, inputs) => {
      const barcode = str(inputs['shipment'] ?? inputs['barcode'])
      const row = asArray(payload).find(
        (candidate) =>
          candidate !== null &&
          typeof candidate === 'object' &&
          str((candidate as Record<string, unknown>)['Barcode']) === barcode,
      ) as Record<string, unknown> | undefined
      return {
        delivery: {
          recorded: row !== undefined,
          status: row?.['ShipmentStatus'] ?? null,
          barcode: row?.['Barcode'] ?? null,
        },
      }
    },
  },
}

export function resolveBackofficeEndpoint(operationRef: string): BackofficeEndpoint | undefined {
  return NESY_BACKOFFICE_ENDPOINTS[operationRef]
}
