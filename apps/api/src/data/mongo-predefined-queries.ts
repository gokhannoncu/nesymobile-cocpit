/** 50 ops/debug predefined NL query intents for Mongo Query Generator. */

/**
 * Sample ops day: local calendar 2026-07-17 in CEST (UTC+2).
 * Local midnight fields (ScheduleDate, PickupDate) and "today" event windows
 * use previous-day 22:00Z → next-day 22:00Z — never UTC midnight.
 */
export const SAMPLE_LOCAL_DAY = '2026-07-17'
export const SAMPLE_LOCAL_DAY_CEST_WINDOW =
  '$gte ISODate("2026-07-16T22:00:00.000Z"), $lt ISODate("2026-07-17T22:00:00.000Z")'
/** NL phrase reused in ScheduleDate / PickupDate / "today" filters. */
export const SAMPLE_LOCAL_DAY_CEST_NL = `local day ${SAMPLE_LOCAL_DAY} (CEST: ${SAMPLE_LOCAL_DAY_CEST_WINDOW})`
/** Rolling 7 local days ending SAMPLE_LOCAL_DAY (CEST). */
export const SAMPLE_LAST_7_LOCAL_DAYS_CEST_NL =
  'last 7 local days ending 2026-07-17 (CEST: $gte ISODate("2026-07-10T22:00:00.000Z"), $lt ISODate("2026-07-17T22:00:00.000Z"))'
/** Rolling ~24h = one CEST local day (sample). */
export const SAMPLE_LAST_24H_CEST_NL = SAMPLE_LOCAL_DAY_CEST_NL

export type PredefinedQueryPriority = 'P0' | 'P1' | 'P2'

export type PredefinedQueryCategory =
  | 'identity'
  | 'schedule'
  | 'pickup'
  | 'status'
  | 'money'
  | 'courier'
  | 'transfer'

export type PredefinedQuery = {
  id: number
  label: string
  text: string
  database: string
  collection: string
  category: PredefinedQueryCategory
  reason: string
  priority: PredefinedQueryPriority
}

export type CatalogExamplePrompt = {
  label: string
  text: string
}

/**
 * Canonical library of 50 ops queries (barcode/legacy → shipment → schedule,
 * courier/zone tours, events, COD/fiscal, auth, transfer).
 */
export const PREDEFINED_QUERY_LIBRARY: PredefinedQuery[] = [
  // A. Identity (1–10)
  {
    id: 1,
    label: 'Shipment by id',
    text: 'Find shipment ShipmentId HR1234567890 and return ShipmentStatus, LastEvent, and Consignee.CurrentAddress.Country.',
    database: 'NESY_ShipmentDB',
    collection: 'Shipment',
    category: 'identity',
    reason: 'Dashboard shipment-detail / mobile tracking primary lookup',
    priority: 'P0',
  },
  {
    id: 2,
    label: 'NESY barcode → shipment',
    text: 'Find the shipment where Parcels.Barcode equals NESYBARCODE123 and return ShipmentId, ShipmentStatus, and LastEvent.',
    database: 'NESY_ShipmentDB',
    collection: 'Shipment',
    category: 'identity',
    reason: 'Mobile scan / HubCompanion SearchShipment',
    priority: 'P0',
  },
  {
    id: 3,
    label: 'Legacy short → shipment',
    text: 'Find the shipment where Parcels.LegacySystemShortBarcode equals LEGACY12345 and return ShipmentId, ShipmentStatus, and LegacySystemMasterId.',
    database: 'NESY_ShipmentDB',
    collection: 'Shipment',
    category: 'identity',
    reason: 'Physical labels are often legacy; LegacyBarcodeListDialog on stop cards',
    priority: 'P0',
  },
  {
    id: 4,
    label: 'Legacy full / master id',
    text: 'Find the shipment by LegacySystemMasterId or Parcels.LegacySystemBarcode equal to LEGACYFULL999 and return ShipmentId and status.',
    database: 'NESY_ShipmentDB',
    collection: 'Shipment',
    category: 'identity',
    reason: 'Ops search by old-system full barcode or master id',
    priority: 'P1',
  },
  {
    id: 5,
    label: 'Customer / intl barcode',
    text: 'Find the shipment where Parcels.CustomerBarcode or Parcels.InternationalBarcode equals CUSTBAR456 and return ShipmentId and ShipmentStatus.',
    database: 'NESY_ShipmentDB',
    collection: 'Shipment',
    category: 'identity',
    reason: 'Cross-border / customer-owned barcode lookup',
    priority: 'P1',
  },
  {
    id: 6,
    label: 'Waybill / tracking',
    text: 'Find the shipment by waybill or tracking number TRK-1001 and return ShipmentId, ShipmentStatus, and LastEvent.',
    database: 'NESY_ShipmentDB',
    collection: 'Shipment',
    category: 'identity',
    reason: 'Integration GetShipmentDetailByWaybillNumber',
    priority: 'P1',
  },
  {
    id: 7,
    label: 'Shipment → which schedule',
    text: 'Find Schedule where StopList.TaskList.ShipmentList.TrackingNumber equals 27663656233444 and return ScheduleId, CourierName, CourierUserId, ScheduleDate, ScheduleStatus, StopList.StopOrder, TaskList.TaskType, and TaskList.TaskStatus.',
    database: 'NESY_TaskDB',
    collection: 'Schedule',
    category: 'identity',
    reason: 'Most common ops question: why is parcel missing from courier tour?',
    priority: 'P0',
  },
  {
    id: 8,
    label: 'Legacy → schedule/stop/task',
    text: 'Find Schedule where StopList.TaskList.ShipmentList.ShipmentItemList.LegacySystemShortBarcode equals 7050015259128713 and return ScheduleId, StopOrder, TaskType, TaskStatus, TrackingNumber, and WaybillNumber.',
    database: 'NESY_TaskDB',
    collection: 'Schedule',
    category: 'identity',
    reason: 'X legacy hangi schedule üzerinde? end-to-end debug',
    priority: 'P0',
  },
  {
    id: 9,
    label: 'Barcode on today schedule?',
    text: `Find Schedule where ScheduleDate is ${SAMPLE_LOCAL_DAY_CEST_NL} and StopList.TaskList.ShipmentList.ShipmentItemList.Barcode equals N0400700009900000010047050600000300060001000127663656233444FJ18211.`,
    database: 'NESY_TaskDB',
    collection: 'Schedule',
    category: 'identity',
    reason: 'Mobile: is parcel on today’s tour?',
    priority: 'P0',
  },
  {
    id: 10,
    label: 'Multi-piece mixed status',
    text: 'Find shipment ShipmentId HR1234567890 and show whether Parcels have mixed statuses or missing pieces (multi-piece incomplete).',
    database: 'NESY_ShipmentDB',
    collection: 'Shipment',
    category: 'identity',
    reason: 'Partial delivery / missing piece debug',
    priority: 'P1',
  },

  // B. Schedule / courier / zone (11–20)
  {
    id: 11,
    label: 'Courier schedule today',
    text: `Show Schedule for CourierName "rezerva izola 1" where ScheduleDate is ${SAMPLE_LOCAL_DAY_CEST_NL}. Return ScheduleStatus, NumberPlate, CourierZoneCode, BranchId, CourierUserId. Use CourierName or CourierUserId only — never Username / CourierUsername.`,
    database: 'NESY_TaskDB',
    collection: 'Schedule',
    category: 'schedule',
    reason: 'GetMyScheduleByZoneCode / StopListFragment',
    priority: 'P0',
  },
  {
    id: 12,
    label: 'CourierUserId schedule today',
    text: `Show Schedule for CourierUserId 6a167fda501cb8412213dd82 with ScheduleDate ${SAMPLE_LOCAL_DAY_CEST_NL}. Return ScheduleStatus, NumberPlate, CourierZoneCode, CourierName.`,
    database: 'NESY_TaskDB',
    collection: 'Schedule',
    category: 'schedule',
    reason: 'Ops lookup by courier user id',
    priority: 'P1',
  },
  {
    id: 13,
    label: 'Zone schedules today',
    text: `List Schedule for CourierZoneCode 6 with ScheduleDate ${SAMPLE_LOCAL_DAY_CEST_NL}.`,
    database: 'NESY_TaskDB',
    collection: 'Schedule',
    category: 'schedule',
    reason: 'Dispatcher dashboard zone view',
    priority: 'P1',
  },
  {
    id: 14,
    label: 'Branch schedules today',
    text: `List Schedule for BranchId 60 with ScheduleDate ${SAMPLE_LOCAL_DAY_CEST_NL} and ScheduleStatus Approved or WaitingForApproval.`,
    database: 'NESY_TaskDB',
    collection: 'Schedule',
    category: 'schedule',
    reason: 'Hub/branch ops daily tour list (BranchId; HubId is often 0)',
    priority: 'P1',
  },
  {
    id: 15,
    label: 'Schedule by id',
    text: 'Find ScheduleId 60-6-20260717-1 and return ScheduleStatus, NumberPlate, CourierZoneCode, CourierName, CourierUserId, BranchId, and StopList length.',
    database: 'NESY_TaskDB',
    collection: 'Schedule',
    category: 'schedule',
    reason: 'Dashboard task-tracking / GetScheduleDetailById',
    priority: 'P0',
  },
  {
    id: 16,
    label: 'Schedule nested barcodes',
    text: 'For ScheduleId 60-6-20260717-1 project StopList.TaskList.ShipmentList.TrackingNumber, WaybillNumber, and ShipmentItemList.Barcode plus LegacySystemShortBarcode.',
    database: 'NESY_TaskDB',
    collection: 'Schedule',
    category: 'schedule',
    reason: 'Tour content audit / load control',
    priority: 'P0',
  },
  {
    id: 17,
    label: 'Shipment stop/task on schedule',
    text: 'Find Schedule where StopList.TaskList.ShipmentList.TrackingNumber equals 27663656233444 and return StopList.StopOrder, TaskList.TaskType, and TaskList.TaskStatus.',
    database: 'NESY_TaskDB',
    collection: 'Schedule',
    category: 'schedule',
    reason: 'Why this stop? / post-reorder verification',
    priority: 'P1',
  },
  {
    id: 18,
    label: 'Plate → schedule today',
    text: `Find Schedule for NumberPlate ZG1234AB with ScheduleDate ${SAMPLE_LOCAL_DAY_CEST_NL}. NumberPlate may be null on some tours.`,
    database: 'NESY_TaskDB',
    collection: 'Schedule',
    category: 'schedule',
    reason: 'VehicleWelcome / vehicle-tour match',
    priority: 'P0',
  },
  {
    id: 19,
    label: 'EOD / waiting approval schedules',
    text: `List Schedule with ScheduleDate ${SAMPLE_LOCAL_DAY_CEST_NL} and ScheduleStatus WaitingForApproval or EndOfDayRejected.`,
    database: 'NESY_TaskDB',
    collection: 'Schedule',
    category: 'schedule',
    reason: 'End-of-day / leaving-requests flow',
    priority: 'P1',
  },
  {
    id: 20,
    label: 'Open OnDeliveryCourier after EOD',
    text: `Find Schedule where EndofDayRequestTime is within ${SAMPLE_LOCAL_DAY_CEST_NL} and StopList.TaskList.ShipmentList.ShipmentItemList.ItemCurrentLocation equals OnDeliveryCourier; return ScheduleId, TrackingNumber, Barcode, and ShipmentItemStatus.`,
    database: 'NESY_TaskDB',
    collection: 'Schedule',
    category: 'schedule',
    reason: 'EOD reject / unfinished tour inventory',
    priority: 'P1',
  },

  // C. Pickup / zone / route (21–26)
  {
    id: 21,
    label: 'Unassigned pickups by zone',
    text: `List Pickup documents for CourierZoneCode ZG-01 where PickupDate is ${SAMPLE_LOCAL_DAY_CEST_NL} (same local-midnight UTC rule as ScheduleDate) and PickupStatus is not Assigned.`,
    database: 'NESY_TaskDB',
    collection: 'Pickup',
    category: 'pickup',
    reason: 'create-pickup / series-pickup; mobile pickup list',
    priority: 'P1',
  },
  {
    id: 22,
    label: 'Pickup ↔ shipment link',
    text: 'Find Pickup where ReturnCode or ItemBarcode matches HR1234567890 / NESYBARCODE123 and return PickupStatus and CourierZoneCode.',
    database: 'NESY_TaskDB',
    collection: 'Pickup',
    category: 'pickup',
    reason: 'Pickup ↔ Shipment mismatch debug',
    priority: 'P1',
  },
  {
    id: 23,
    label: 'CourierZone by Code',
    text: 'Find CourierZone with Code ZG-01 and return ShortName, BranchId, and PlateNumber.',
    database: 'NESY_TaskDB',
    collection: 'CourierZone',
    category: 'pickup',
    reason: 'Zone definition / wrong-zone suspicion',
    priority: 'P1',
  },
  {
    id: 24,
    label: 'Zone → vehicle/courier',
    text: 'Find VehicleCourierZone for CourierZone ZG-01 and return CourierId, CourierName, PlateNumber, and CourierStatus.',
    database: 'NESY_TaskDB',
    collection: 'VehicleCourierZone',
    category: 'pickup',
    reason: 'Vehicle-zone mismatch',
    priority: 'P1',
  },
  {
    id: 25,
    label: 'Zip → route lookup',
    text: 'Find AddressRouteLookUp for ZipCode 10000 and return Route, RouteName, Center, and CenterName.',
    database: 'NESY_ShipmentDB',
    collection: 'AddressRouteLookUp',
    category: 'pickup',
    reason: 'Why did this address fall on this route?',
    priority: 'P1',
  },
  {
    id: 26,
    label: 'Failed pickups 24h',
    text: `List Pickup documents with failed or incomplete PickupStatus where ModifiedAt or CreatedAt is within ${SAMPLE_LAST_24H_CEST_NL}, grouped by CourierZoneCode.`,
    database: 'NESY_TaskDB',
    collection: 'Pickup',
    category: 'pickup',
    reason: 'PickupFailed screen / ops backlog',
    priority: 'P2',
  },

  // D. Status / events (27–34)
  {
    id: 27,
    label: 'Failed / returned 24h',
    text: `Show shipments with ShipmentStatus Return, Cancelled, or Failed in HR where ModifiedAt or CreatedAt is within ${SAMPLE_LAST_24H_CEST_NL}, newest first.`,
    database: 'NESY_ShipmentDB',
    collection: 'Shipment',
    category: 'status',
    reason: 'Dashboard shipment-search; mobile DeliveryFailed',
    priority: 'P1',
  },
  {
    id: 28,
    label: 'ShipmentHistory timeline',
    text: 'List ShipmentHistory for ShipmentId HR1234567890 in chronological order by CreatedAt.',
    database: 'NESY_ShipmentDB',
    collection: 'ShipmentHistory',
    category: 'status',
    reason: 'Movement / history screen',
    priority: 'P0',
  },
  {
    id: 29,
    label: 'Status log transitions',
    text: 'Get ShipmentStatusLog rows for ShipmentId HR1234567890 sorted by CreatedAt ascending.',
    database: 'NESY_ShipmentDB',
    collection: 'ShipmentStatusLog',
    category: 'status',
    reason: 'Status skip / barcode change audit',
    priority: 'P0',
  },
  {
    id: 30,
    label: 'Tracking event chain',
    text: 'List TrackingDB ShipmentEventLog for ShipmentId HR1234567890 sorted by CreatedAt ascending.',
    database: 'NESY_TrackingDB',
    collection: 'ShipmentEventLog',
    category: 'status',
    reason: 'Live event vs history comparison',
    priority: 'P0',
  },
  {
    id: 31,
    label: 'HistoryDB event log',
    text: 'List HistoryDB ShipmentEventLog for ShipmentId HR1234567890 sorted by CreatedAt ascending.',
    database: 'NESY_HistoryDB',
    collection: 'ShipmentEventLog',
    category: 'status',
    reason: 'Long-term audit trail',
    priority: 'P1',
  },
  {
    id: 32,
    label: 'Physical location / LastEvent',
    text: 'For ShipmentId HR1234567890 return LastEvent and parcel itemCurrentLocation to see hub vs courier vs locker.',
    database: 'NESY_ShipmentDB',
    collection: 'Shipment',
    category: 'status',
    reason: 'Where is the parcel physically?',
    priority: 'P1',
  },
  {
    id: 33,
    label: 'TrackingData by schedule',
    text: 'Find TrackingData for ScheduleId SCH-20260717-1 and return RemainingStopCount, ProgressRate, TaskStatus, and TrackingShipmentList.',
    database: 'NESY_TrackingDB',
    collection: 'TrackingData',
    category: 'status',
    reason: 'Live ETA / remaining stops',
    priority: 'P1',
  },
  {
    id: 34,
    label: 'Hub scan vs schedule',
    text: `For ShipmentId / TrackingNumber 27663656233444 compare LastEvent Load/Unload with whether StopList.TaskList.ShipmentList.TrackingNumber is present on a Schedule with ScheduleDate ${SAMPLE_LOCAL_DAY_CEST_NL}.`,
    database: 'NESY_ShipmentDB',
    collection: 'Shipment',
    category: 'status',
    reason: 'HubCompanion vs tour mismatch',
    priority: 'P2',
  },

  // E. Money / fiscal / COD (35–39)
  {
    id: 35,
    label: 'COD by shipment',
    text: 'Find CodShipment for ShipmentId HR1234567890.',
    database: 'NESY_ShipmentDB',
    collection: 'CodShipment',
    category: 'money',
    reason: 'COD collection screen',
    priority: 'P0',
  },
  {
    id: 36,
    label: 'SoftPOS failures 24h',
    text: `List SoftPosTransaction records that are not Approved where CreatedAt is within ${SAMPLE_LAST_24H_CEST_NL}.`,
    database: 'NESY_ShipmentDB',
    collection: 'SoftPosTransaction',
    category: 'money',
    reason: 'RaiPay / card payment failures',
    priority: 'P0',
  },
  {
    id: 37,
    label: 'Failed fiscal 7d',
    text: `Find FiscalInvoiceDocument records with FiscalInvoiceStatus Failed where CreatedAt is within ${SAMPLE_LAST_7_LOCAL_DAYS_CEST_NL}.`,
    database: 'NESY_ShipmentDB',
    collection: 'FiscalInvoiceDocument',
    category: 'money',
    reason: 'Fiscal / invoice-operations',
    priority: 'P0',
  },
  {
    id: 38,
    label: 'Invoice by shipment',
    text: 'Find Invoice documents for ShipmentId HR1234567890.',
    database: 'NESY_ShipmentDB',
    collection: 'Invoice',
    category: 'money',
    reason: 'Missing invoice check',
    priority: 'P1',
  },
  {
    id: 39,
    label: 'Open COD collections',
    text: 'Find CodShipment or Shipment Collections that are still open/uncollected for recent deliveries.',
    database: 'NESY_ShipmentDB',
    collection: 'CodShipment',
    category: 'money',
    reason: 'Delivery collection not closed',
    priority: 'P2',
  },

  // F. Courier location / user / auth (40–44)
  {
    id: 40,
    label: 'Courier last location',
    text: 'Find CourierLastLocation for CourierUserId user-123.',
    database: 'NESY_TrackingDB',
    collection: 'CourierLastLocation',
    category: 'courier',
    reason: 'Map / GPS silent?',
    priority: 'P1',
  },
  {
    id: 41,
    label: 'Courier location trail',
    text: 'Get last 50 CourierLocation points for CourierUserId user-123 sorted by CreatedAt descending.',
    database: 'NESY_TrackingDB',
    collection: 'CourierLocation',
    category: 'courier',
    reason: 'Trail / late debug',
    priority: 'P1',
  },
  {
    id: 42,
    label: 'Courier user lookup',
    text: 'Find User with Username courier01 and return Role, BranchId, HubId, and LockedUntil.',
    database: 'NESY_UserDB',
    collection: 'User',
    category: 'courier',
    reason: 'Login / permission issues',
    priority: 'P1',
  },
  {
    id: 43,
    label: 'Failed logins 24h',
    text: `List UserLoginLog where IsSuccessful is false and LoginAt is within ${SAMPLE_LAST_24H_CEST_NL}, sorted by LoginAt descending.`,
    database: 'NESY_UserDB',
    collection: 'UserLoginLog',
    category: 'courier',
    reason: 'Mobile login fail spike',
    priority: 'P1',
  },
  {
    id: 44,
    label: 'Online drivers',
    text: 'Find DriverStatus documents with Status Online.',
    database: 'NESY_UserDB',
    collection: 'DriverStatus',
    category: 'courier',
    reason: 'Transfer + last-mile availability',
    priority: 'P2',
  },

  // G. Transfer / vehicle / trip + exceptions (45–50)
  {
    id: 45,
    label: 'Vehicle by plate',
    text: 'Find Vehicle with PlateNumber ZG1234AB.',
    database: 'NESY_TransferCenterDB',
    collection: 'Vehicle',
    category: 'transfer',
    reason: 'VehicleWelcome / transfer-management',
    priority: 'P0',
  },
  {
    id: 46,
    label: 'Active trips',
    text: 'List Trip documents with Status InProgress including DriverId and VehicleId.',
    database: 'NESY_TransferCenterDB',
    collection: 'Trip',
    category: 'transfer',
    reason: 'Linehaul / transfer control',
    priority: 'P1',
  },
  {
    id: 47,
    label: 'Active drivers',
    text: 'Find Driver documents where IsActive is true.',
    database: 'NESY_TransferCenterDB',
    collection: 'Driver',
    category: 'transfer',
    reason: 'Trip assignment precondition',
    priority: 'P2',
  },
  {
    id: 48,
    label: 'FailedRequest 24h',
    text: `Show FailedRequest documents where CreatedAt is within ${SAMPLE_LAST_24H_CEST_NL}, sorted by CreatedAt descending.`,
    database: 'NESY_HistoryDB',
    collection: 'FailedRequest',
    category: 'transfer',
    reason: 'Mobile offline sync / API fail; HistoryWebAPI',
    priority: 'P0',
  },
  {
    id: 49,
    label: 'Phone → stop/task today',
    text: `Find Schedule with ScheduleDate ${SAMPLE_LOCAL_DAY_CEST_NL} where StopList.TaskList.Gsm or StopList.TaskList.ShipmentList.ConsigneeGsm equals 0038640426639; return ScheduleId, StopOrder, TaskType, TaskStatus, TaskParty.`,
    database: 'NESY_TaskDB',
    collection: 'Schedule',
    category: 'transfer',
    reason: 'Find stop after call; Task.Gsm / ShipmentList.ConsigneeGsm',
    priority: 'P0',
  },
  {
    id: 50,
    label: 'Pending approvals today',
    text: `List Approval documents with ApprovalState Pending where ApprovalUpdatedAt is within ${SAMPLE_LOCAL_DAY_CEST_NL}; return ApprovalType and RequestedBy.`,
    database: 'NESY_TaskDB',
    collection: 'Approval',
    category: 'transfer',
    reason: 'leaving-requests / EOD approval',
    priority: 'P1',
  },
]

export function examplePromptsFor(
  database: string,
  collection: string,
): CatalogExamplePrompt[] {
  return PREDEFINED_QUERY_LIBRARY.filter(
    (q) => q.database === database && q.collection === collection,
  ).map(({ label, text }) => ({ label, text }))
}

export function predefinedQueriesForCollection(
  database: string,
  collection: string,
): PredefinedQuery[] {
  return PREDEFINED_QUERY_LIBRARY.filter(
    (q) => q.database === database && q.collection === collection,
  )
}

export function p0PredefinedQueries(): PredefinedQuery[] {
  return PREDEFINED_QUERY_LIBRARY.filter((q) => q.priority === 'P0')
}
