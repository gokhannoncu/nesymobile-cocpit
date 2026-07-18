import {
  GRAYLOG_PREDEFINED_QUERY_LIBRARY,
  type GraylogPredefinedQuery,
} from './graylog-predefined-queries.js'

export type GraylogField = {
  field: string
  meaning: string
  example: string
  source: string
}

const GRAYLOG_FIELDS: GraylogField[] = [
  {
    field: 'shipmentId',
    meaning:
      'Unique identifier of the shipment — connects delivery, fiscal, and retry logs in a single chain.',
    example: '45-40-20251224-1',
    source: 'Mobile · Backend · Fiscal',
  },
  {
    field: 'courierId',
    meaning: 'Courier identifier — filters login, shift, and delivery logs by person.',
    example: '3021',
    source: 'Mobile · Authentication',
  },
  {
    field: 'scheduleId',
    meaning: 'Shift/route plan identifier — groups all shipment logs in the same shift.',
    example: 'SCH-2025-8841',
    source: 'Backend',
  },
  {
    field: 'requestId',
    meaning: 'Offline queue request identifier — matches every attempt in the retry chain.',
    example: 'req_9f3c1a72',
    source: 'Offline queue · Backend',
  },
  {
    field: 'fiscalId',
    meaning: 'Fiscal record identifier — key for duplicate fiscal and timeout investigations.',
    example: 'FIS-HR-338291',
    source: 'Fiscal service',
  },
  {
    field: 'errorCode',
    meaning: 'Standard error code — provides filtering by error family.',
    example: 'FISCAL_TIMEOUT',
    source: 'All services',
  },
  {
    field: 'appVersion',
    meaning: 'Mobile application version — used in version-based regression investigations.',
    example: '4.12.0',
    source: 'Mobile',
  },
  {
    field: 'country',
    meaning: 'Operation country (ISO code) — narrows log volume by country.',
    example: 'HR',
    source: 'All services',
  },
  {
    field: 'barcode',
    meaning:
      'Parcel barcode from scan or DeliverParcels BarcodeList — use when shipmentId is unknown.',
    example: 'HR304418872299001',
    source: 'Mobile · Scan · Delivery',
  },
  {
    field: 'deviceId',
    meaning: 'Handset device id (X-DeviceId) — device crash windows and version regressions.',
    example: 'NX-4412',
    source: 'Mobile',
  },
  {
    field: 'requestName',
    meaning:
      'Offline queue / Firebase requestName token — e.g. deliverParcels, DeliveryFailed, SaveTerminalFailedRequests.',
    example: 'deliverParcels',
    source: 'Offline queue · Mobile',
  },
  {
    field: 'username',
    meaning: 'Courier username — correlates login, AskQuestion, and non-200 request analytics.',
    example: 'courier.hr.3021',
    source: 'Mobile · Authentication',
  },
]

/** Known mobile API / queue tokens for Claude prompt enrichment. */
export const GRAYLOG_MOBILE_REQUEST_TOKENS = [
  'Task/DeliverParcels/',
  'Task/DeliverParcelsFromParcelShop/',
  'Task/DeliveryFailed/',
  'Task/PickupFailed/',
  'Task/LoadParcelToCourierVehicle/',
  'Task/UnloadParcelFromCourierVehicle/',
  'Task/ReleaseParcel/',
  'Task/UpdateDeliveryRemark/',
  'Task/GetMyScheduleByZoneCode/',
  'Task/OrderStopListFromTerminal/',
  'Task/CreateInstantTask',
  'Auth/LoginMobile/',
  'Auth/LoginDevice/',
  'Tracking/SaveCourierLocation/',
  'History/SaveTerminalFailedRequests/',
  'History/SaveTerminalRequestDbSnapshot/',
  'History/GetAskQuestion/',
  'User/AskQuestion/',
  'Shipment/CreateFiscalInvoice',
  'Shipment/SaveNoDataScanLog',
  'HubCompanion/ScanSpecial',
  'requestName: deliverParcels',
  'requestName: deliverParcelToParcelShop',
  'requestName: DeliveryFailed',
  'requestName: PickupFailed',
  'requestName: SaveTerminalFailedRequests',
  'header X-Channel: Terminal (ChannelType=9)',
  'X-DeviceId',
  'X-AppName (e.g. Nesy-Mobile-Prod)',
]

export function getGraylogFields(): GraylogField[] {
  return GRAYLOG_FIELDS
}

export function getFieldsPayload(): {
  fields: GraylogField[]
  predefinedQueries: GraylogPredefinedQuery[]
} {
  return {
    fields: GRAYLOG_FIELDS,
    predefinedQueries: GRAYLOG_PREDEFINED_QUERY_LIBRARY,
  }
}
