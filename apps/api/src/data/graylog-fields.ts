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

/**
 * Field names verified against HR prod Graylog `/api/system/fields` (Graylog 6.1).
 * Do NOT invent camelCase aliases — unknown fields return 0 hits / UI warnings.
 */
const GRAYLOG_FIELDS: GraylogField[] = [
  {
    field: 'Log_ShipmentId',
    meaning: 'Shipment id on service logs. Also try Log_Data_ShipmentId or message:"<id>".',
    example: '70957029401697',
    source: 'services_nesy_hr',
  },
  {
    field: 'Log_Data_ShipmentId',
    meaning: 'Shipment id nested under Log.Data payloads.',
    example: '70957029401697',
    source: 'services_nesy_hr',
  },
  {
    field: 'Log_Data_Barcode',
    meaning: 'Parcel barcode on structured Data payloads (preferred over inventing barcode:).',
    example: 'N1911370022000000148901915540000100532871000164080147938285BO77151',
    source: 'services_nesy_hr',
  },
  {
    field: 'Log_Barcode',
    meaning: 'Alternate barcode field (sparse). Prefer Log_Data_Barcode or message:"<barcode>".',
    example: 'N1911370022…',
    source: 'services_nesy_hr',
  },
  {
    field: 'Log_WaybillNumber',
    meaning: 'Waybill / tracking number.',
    example: '16107353889218',
    source: 'services_nesy_hr',
  },
  {
    field: 'Log_ScheduleId',
    meaning: 'Courier schedule / tour id (e.g. 52-50-20260718-1).',
    example: '52-50-20260718-1',
    source: 'services_nesy_hr · microservice_hr',
  },
  {
    field: 'Channel',
    meaning: 'Request channel. Mobile terminal traffic uses Channel:Terminal (NOT X-Channel).',
    example: 'Terminal',
    source: 'microservice_hr',
  },
  {
    field: 'Log_Request_Channel',
    meaning: 'Channel on RequestLog documents (same meaning as Channel).',
    example: 'Terminal',
    source: 'services_nesy_hr',
  },
  {
    field: 'To',
    meaning:
      'Downstream handler / API name. Use To:DeliverParcels (NOT requestName:deliverParcels).',
    example: 'DeliverParcels',
    source: 'microservice_hr',
  },
  {
    field: 'From',
    meaning: 'Upstream producer / previous hop. Often From:Client or From:DeliverParcels.',
    example: 'Client',
    source: 'microservice_hr',
  },
  {
    field: 'Log_To',
    meaning: 'To-equivalent on services_* RequestLog style messages.',
    example: 'AppendParcelsToSchedule',
    source: 'services_nesy_hr',
  },
  {
    field: 'Log_From',
    meaning: 'From-equivalent on services_* messages.',
    example: 'SendReceiptByServiceType',
    source: 'services_nesy_hr',
  },
  {
    field: 'message',
    meaning:
      'Full text. Use for path tokens e.g. message:"Task/DeliverParcels" or free-text barcode/shipment ids.',
    example: 'Task/DeliverParcels',
    source: 'All',
  },
  {
    field: 'Log_Request_User_Username',
    meaning: 'Courier / user username on RequestLog.',
    example: 'J.BRALA',
    source: 'services_nesy_hr',
  },
  {
    field: 'Log_RequestData_CourierId',
    meaning: 'Courier id in request data (D4Me / delivery APIs).',
    example: '3021',
    source: 'services_nesy_hr',
  },
  {
    field: 'Log_CourierUserId',
    meaning: 'Courier user id on some service logs.',
    example: '68a2efb3…',
    source: 'services_nesy_hr',
  },
  {
    field: 'ClientVersion',
    meaning: 'Mobile client / app version string (NOT appVersion:).',
    example: '4.12.0',
    source: 'microservice_hr',
  },
  {
    field: 'Log_Request_LogProperties_ClientVersion',
    meaning: 'Client version on RequestLog properties.',
    example: '4.12.0',
    source: 'services_nesy_hr',
  },
  {
    field: 'MessageId',
    meaning: 'Request message id (correlation). Also Log_Request_MessageId / Log_CorrelationId.',
    example: '15146f59-1e82-409c-a577-83e82fe92c36',
    source: 'microservice_hr',
  },
  {
    field: 'Log_Request_MessageId',
    meaning: 'Message id on RequestLog.',
    example: '9874f417-bc3f-4b42-8a61-63cea15c64e3',
    source: 'services_nesy_hr',
  },
  {
    field: 'Log_CorrelationId',
    meaning: 'Correlation id across hops.',
    example: '…',
    source: 'services_nesy_hr',
  },
  {
    field: 'source',
    meaning: 'Graylog source host/service tag e.g. microservice_hr, services_nesy_hr, apigateway_nesy_hr.',
    example: 'microservice_hr',
    source: 'All',
  },
  {
    field: 'stringLevel',
    meaning: 'Log level label (Information, Warning, Error).',
    example: 'Error',
    source: 'All',
  },
]

/**
 * Known mobile API / queue tokens — express as To:/From:/message: filters.
 * Never emit requestName: or X-Channel: (those fields do not exist).
 */
export const GRAYLOG_MOBILE_REQUEST_TOKENS = [
  'To:DeliverParcels OR message:"Task/DeliverParcels"',
  'To:DeliverParcelsFromParcelShop OR message:"Task/DeliverParcelsFromParcelShop"',
  'To:DeliveryFailed OR message:"Task/DeliveryFailed"',
  'To:PickupFailed OR message:"Task/PickupFailed"',
  'To:LoadParcelToCourierVehicle OR message:"Task/LoadParcelToCourierVehicle"',
  'To:UnloadParcelFromCourierVehicle OR message:"Task/UnloadParcelFromCourierVehicle"',
  'To:ReleaseParcel OR message:"Task/ReleaseParcel"',
  'To:UpdateDeliveryRemark OR message:"Task/UpdateDeliveryRemark"',
  'To:GetMyScheduleByZoneCode OR message:"Task/GetMyScheduleByZoneCode"',
  'To:OrderStopListFromTerminal OR message:"Task/OrderStopListFromTerminal"',
  'To:CreateInstantTask OR message:"Task/CreateInstantTask"',
  'message:"/Auth/" OR message:LoginMobile OR message:LoginDevice (To:LoginMobile is often empty — prefer message path)',
  'Log_Request_User_Username + Log_Request_Channel:Terminal for courier-scoped terminal traffic',
  'To:SaveCourierLocation OR message:"Tracking/SaveCourierLocation"',
  'To:SaveTerminalFailedRequests OR message:"History/SaveTerminalFailedRequests"',
  'To:SaveTerminalRequestDbSnapshot OR message:"History/SaveTerminalRequestDbSnapshot"',
  'To:GetAskQuestion OR message:"History/GetAskQuestion"',
  'To:AskQuestion OR message:"User/AskQuestion"',
  'message:CreateFiscalInvoice OR message:FiscalInvoice OR message:"/Shipment/" (fiscal volume varies by window)',
  'To:SaveNoDataScanLog OR message:"Shipment/SaveNoDataScanLog"',
  'To:ScanSpecial OR message:"HubCompanion/ScanSpecial"',
  'Channel:Terminal (mobile; never X-Channel)',
  'Log_Request_Channel:Terminal (RequestLog variant)',
  'ClientVersion for app version (never appVersion: or deviceId: as Graylog fields)',
]

/** UI identifier keys → real Lucene field hints for the LLM. */
export const GRAYLOG_IDENTIFIER_FIELD_MAP: Record<string, string> = {
  shipmentId: 'Log_ShipmentId OR Log_Data_ShipmentId OR message:"<value>"',
  courierId: 'Log_RequestData_CourierId OR Log_CourierUserId OR Log_Request_User_Username',
  scheduleId: 'Log_ScheduleId',
  requestId: 'MessageId OR Log_Request_MessageId OR Log_CorrelationId',
  deviceId: 'search message:"<value>" (no deviceId field in Graylog schema)',
  fiscalId: 'message:"<value>" OR Log_ShipmentId when fiscal tied to shipment',
  errorCode: 'Log_Code OR ResultCode OR message:"<value>"',
  customerTicketId: 'message:"<value>"',
  barcode: 'Log_Data_Barcode OR Log_Barcode OR message:"<value>"',
}

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
