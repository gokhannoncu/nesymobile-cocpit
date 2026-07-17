/** Operational core Mongo catalog — real NESY BsonCollection names. */

import {
  examplePromptsFor,
  PREDEFINED_QUERY_LIBRARY,
  type CatalogExamplePrompt,
  type PredefinedQuery,
} from './mongo-predefined-queries.js'

export type CatalogField = {
  field: string
  type: string
  description: string
  example: string
}

export type { CatalogExamplePrompt, PredefinedQuery }

export type CatalogCollection = {
  database: string
  collection: string
  service: string
  keyFields: CatalogField[]
  examplePrompts: CatalogExamplePrompt[]
}

function withPrompts(
  entry: Omit<CatalogCollection, 'examplePrompts'>,
  fallback: CatalogExamplePrompt[] = [],
): CatalogCollection {
  const fromLibrary = examplePromptsFor(entry.database, entry.collection)
  return {
    ...entry,
    examplePrompts: fromLibrary.length > 0 ? fromLibrary : fallback,
  }
}

export const MONGO_CATALOG: CatalogCollection[] = [
  withPrompts({
    database: 'NESY_ShipmentDB',
    collection: 'Shipment',
    service: 'ShipmentWebAPI',
    keyFields: [
      { field: 'ShipmentId', type: 'string', description: 'Business shipment id', example: '"HR1234567890"' },
      { field: 'ShipmentStatus', type: 'enum', description: 'Operational status', example: '"Delivered"' },
      { field: 'LegacySystemMasterId', type: 'string', description: 'Legacy master id', example: '"LEG-MASTER-1"' },
      { field: 'Parcels.Barcode', type: 'string', description: 'NESY parcel barcode', example: '"NESYBARCODE123"' },
      {
        field: 'Parcels.LegacySystemShortBarcode',
        type: 'string',
        description: 'Legacy short barcode on parcel',
        example: '"LEGACY12345"',
      },
      {
        field: 'Parcels.LegacySystemBarcode',
        type: 'string',
        description: 'Legacy full barcode',
        example: '"LEGACYFULL999"',
      },
      {
        field: 'Parcels.CustomerBarcode',
        type: 'string',
        description: 'Customer-owned barcode',
        example: '"CUSTBAR456"',
      },
      {
        field: 'Parcels.InternationalBarcode',
        type: 'string',
        description: 'International / Eurodis barcode',
        example: '"INTL789"',
      },
      { field: 'Customer.CustomerId', type: 'string', description: 'Owning customer', example: '"C-100"' },
      {
        field: 'Consignee.CurrentAddress.Country',
        type: 'string',
        description: 'Delivery country',
        example: '"HR"',
      },
      { field: 'LastEvent.EventType', type: 'enum', description: 'Last processed event', example: '"Unload"' },
      {
        field: 'ShippingDate',
        type: 'DateTime',
        description: 'Shipment shipping date',
        example: 'ISODate("2026-07-17T00:00:00Z")',
      },
    ],
  }),
  withPrompts({
    database: 'NESY_ShipmentDB',
    collection: 'ShipmentHistory',
    service: 'ShipmentWebAPI',
    keyFields: [
      { field: 'ShipmentId', type: 'string', description: 'Related shipment', example: '"HR1234567890"' },
      { field: 'EventType', type: 'enum', description: 'History event type', example: '"UpdateShipment"' },
      {
        field: 'CreatedAt',
        type: 'DateTime',
        description: 'Event time',
        example: 'ISODate("2026-07-17T10:00:00Z")',
      },
    ],
  }),
  withPrompts({
    database: 'NESY_ShipmentDB',
    collection: 'ShipmentStatusLog',
    service: 'ShipmentWebAPI',
    keyFields: [
      { field: 'ShipmentId', type: 'string', description: 'Related shipment', example: '"HR1234567890"' },
      { field: 'Status', type: 'string', description: 'Logged status', example: '"InDelivery"' },
      {
        field: 'CreatedAt',
        type: 'DateTime',
        description: 'Log time',
        example: 'ISODate("2026-07-17T10:00:00Z")',
      },
    ],
  }),
  withPrompts({
    database: 'NESY_ShipmentDB',
    collection: 'FiscalInvoiceDocument',
    service: 'ShipmentWebAPI',
    keyFields: [
      { field: 'ShipmentId', type: 'string', description: 'Fiscalized shipment', example: '"HR1234567890"' },
      { field: 'InvoiceNumber', type: 'string', description: 'Fiscal invoice number', example: '"42/1"' },
      {
        field: 'FiscalInvoiceStatus',
        type: 'enum',
        description: 'Accept / Failed',
        example: '1',
      },
      { field: 'TotalAmount', type: 'decimal', description: 'Total amount', example: '25.50' },
      {
        field: 'SdcDateTime',
        type: 'DateTime',
        description: 'SDC timestamp',
        example: 'ISODate("2026-07-17T12:00:00Z")',
      },
    ],
  }),
  withPrompts({
    database: 'NESY_ShipmentDB',
    collection: 'Invoice',
    service: 'ShipmentWebAPI',
    keyFields: [
      { field: 'ShipmentId', type: 'string', description: 'Related shipment', example: '"HR1234567890"' },
      { field: 'InvoiceNumber', type: 'string', description: 'Invoice number', example: '"INV-100"' },
      {
        field: 'CreatedAt',
        type: 'DateTime',
        description: 'Created time',
        example: 'ISODate("2026-07-17T12:00:00Z")',
      },
    ],
  }),
  withPrompts({
    database: 'NESY_ShipmentDB',
    collection: 'SoftPosTransaction',
    service: 'ShipmentWebAPI',
    keyFields: [
      { field: 'ShipmentId', type: 'string', description: 'Related shipment', example: '"HR1234567890"' },
      { field: 'Status', type: 'string', description: 'POS result status', example: '"Approved"' },
      {
        field: 'CreatedAt',
        type: 'DateTime',
        description: 'Transaction time',
        example: 'ISODate("2026-07-17T12:00:00Z")',
      },
    ],
  }),
  withPrompts({
    database: 'NESY_ShipmentDB',
    collection: 'CodShipment',
    service: 'ShipmentWebAPI',
    keyFields: [
      { field: 'ShipmentId', type: 'string', description: 'COD shipment id', example: '"HR1234567890"' },
      { field: 'Amount', type: 'decimal', description: 'COD amount', example: '40.00' },
      { field: 'Currency', type: 'string', description: 'Currency code', example: '"EUR"' },
      {
        field: 'LegacySystemShortBarcodeTrim',
        type: 'string',
        description: 'Trimmed legacy short barcode',
        example: '"LEGACY12345"',
      },
    ],
  }),
  withPrompts({
    database: 'NESY_ShipmentDB',
    collection: 'AddressRouteLookUp',
    service: 'ShipmentWebAPI',
    keyFields: [
      { field: 'ZipCode', type: 'string', description: 'Postal / zip code', example: '"10000"' },
      { field: 'Route', type: 'int', description: 'Route number', example: '12' },
      { field: 'RouteName', type: 'string', description: 'Route name', example: '"Zagreb North"' },
      { field: 'Center', type: 'int', description: 'Center id', example: '10' },
      { field: 'CenterName', type: 'string', description: 'Center name', example: '"Zagreb Hub"' },
      {
        field: 'IsCargoCoverageEnabled',
        type: 'bool',
        description: 'Cargo coverage flag',
        example: 'true',
      },
    ],
  }),
  withPrompts(
    {
      database: 'NESY_ShipmentDB',
      collection: 'Inventory',
      service: 'ShipmentWebAPI',
      keyFields: [
        { field: 'ShipmentId', type: 'string', description: 'Related shipment', example: '"HR1234567890"' },
        { field: 'ParcelBarcode', type: 'string', description: 'NESY parcel barcode', example: '"NESYBARCODE123"' },
        {
          field: 'LegacySystemBarcode',
          type: 'string',
          description: 'Legacy barcode in inventory',
          example: '"LEGACYFULL999"',
        },
        { field: 'HubId', type: 'int', description: 'Hub id', example: '10' },
        { field: 'Status', type: 'enum', description: 'Inventory status', example: '"InStock"' },
        { field: 'ScheduleId', type: 'string', description: 'Linked schedule if any', example: '"SCH-20260717-1"' },
      ],
    },
    [
      {
        label: 'Inventory by barcode',
        text: 'Find Inventory for ParcelBarcode NESYBARCODE123 or LegacySystemBarcode LEGACYFULL999.',
      },
    ],
  ),
  withPrompts({
    database: 'NESY_TaskDB',
    collection: 'Schedule',
    service: 'TaskWebAPI',
    keyFields: [
      {
        field: 'ScheduleId',
        type: 'string',
        description: 'Daily schedule id (BranchId-Zone-Date-Seq)',
        example: '"60-6-20260717-1"',
      },
      {
        field: 'CourierUserId',
        type: 'string',
        description: 'Preferred courier filter — assigned courier user id',
        example: '"6a167fda501cb8412213dd82"',
      },
      {
        field: 'CourierName',
        type: 'string',
        description: 'Preferred courier display-name filter (not Username)',
        example: '"rezerva izola 1"',
      },
      {
        field: 'ScheduleDate',
        type: 'DateTime',
        description:
          'Local calendar day at 00:00 stored as UTC. ScheduleId …20260717… → ScheduleDate 2026-07-16T22:00:00.000Z (CEST UTC+2). For local day 2026-07-17 use $gte ISODate("2026-07-16T22:00:00Z") and $lt ISODate("2026-07-17T22:00:00Z"). Do NOT use 2026-07-17T00:00:00Z or 2026-07-17T22:00:00Z as the start for that day.',
        example: 'ISODate("2026-07-16T22:00:00Z")',
      },
      {
        field: 'ScheduleStatus',
        type: 'enum',
        description:
          'BeginningOfDay | WaitingForApproval | Approved | EndOfDay | EndOfDayApproved | EndOfDayRejected',
        example: '"Approved"',
      },
      { field: 'CourierZoneCode', type: 'string', description: 'Zone code', example: '"6"' },
      {
        field: 'NumberPlate',
        type: 'string',
        description: 'Vehicle plate on schedule (nullable)',
        example: 'null',
      },
      { field: 'HubId', type: 'int', description: 'Hub id (often 0; prefer BranchId)', example: '0' },
      { field: 'BranchId', type: 'int', description: 'Branch id', example: '60' },
      {
        field: 'DailyScheduleNumber',
        type: 'int',
        description: 'Daily schedule sequence number',
        example: '7',
      },
      {
        field: 'RecordStatus',
        type: 'enum',
        description: 'Document record status',
        example: '"Active"',
      },
      {
        field: 'FirstScanTime',
        type: 'DateTime',
        description: 'First scan on tour',
        example: 'ISODate("2026-07-17T06:56:47.638Z")',
      },
      {
        field: 'LastScanTime',
        type: 'DateTime',
        description: 'Last scan on tour',
        example: 'ISODate("2026-07-17T09:04:19.087Z")',
      },
      {
        field: 'StopList.StopOrder',
        type: 'int',
        description: 'Stop sequence on the tour',
        example: '1',
      },
      {
        field: 'StopList.TaskList.TaskStatus',
        type: 'enum',
        description: 'Task status',
        example: '"Assigned"',
      },
      {
        field: 'StopList.TaskList.TaskType',
        type: 'enum',
        description: 'Delivery | Pickup | …',
        example: '"Delivery"',
      },
      {
        field: 'StopList.TaskList.TaskParty',
        type: 'string',
        description: 'Consignee / party name on task',
        example: '"Tina Grbec Kleva"',
      },
      {
        field: 'StopList.TaskList.Gsm',
        type: 'string',
        description: 'Task contact phone',
        example: '"0038640426639"',
      },
      {
        field: 'StopList.TaskList.OriginalConsigneeGsm',
        type: 'string',
        description: 'Original consignee phone on task',
        example: '"0038640426639"',
      },
      {
        field: 'StopList.TaskList.ShipmentList.TrackingNumber',
        type: 'string',
        description: 'Embedded waybill / tracking id',
        example: '"27663656233444"',
      },
      {
        field: 'StopList.TaskList.ShipmentList.WaybillNumber',
        type: 'string',
        description: 'Waybill number (often same as TrackingNumber)',
        example: '"27663656233444"',
      },
      {
        field: 'StopList.TaskList.ShipmentList.ConsigneeGsm',
        type: 'string',
        description: 'Consignee phone on embedded shipment',
        example: '"0038640426639"',
      },
      {
        field: 'StopList.TaskList.ShipmentList.LegacySystemCargoId',
        type: 'string',
        description: 'Legacy cargo id on embedded shipment',
        example: '"7050015259128713"',
      },
      {
        field: 'StopList.TaskList.ShipmentList.ShipmentItemList.Barcode',
        type: 'string',
        description: 'NESY parcel barcode',
        example: '"N0400700009900000010047050600000300060001000127663656233444FJ18211"',
      },
      {
        field: 'StopList.TaskList.ShipmentList.ShipmentItemList.LegacySystemShortBarcode',
        type: 'string',
        description: 'Legacy short barcode',
        example: '"7050015259128713"',
      },
      {
        field: 'StopList.TaskList.ShipmentList.ShipmentItemList.ItemCurrentLocation',
        type: 'enum',
        description: 'Physical location of item',
        example: '"OnDeliveryCourier"',
      },
      {
        field: 'StopList.TaskList.ShipmentList.ShipmentItemList.ShipmentItemStatus',
        type: 'enum',
        description: 'Item status on tour',
        example: '"Loaded"',
      },
      {
        field: 'EndofDayRequestTime',
        type: 'DateTime',
        description: 'EOD request timestamp (sentinel if unset)',
        example: 'ISODate("2026-07-17T16:00:00Z")',
      },
    ],
  }),
  withPrompts({
    database: 'NESY_TaskDB',
    collection: 'Pickup',
    service: 'TaskWebAPI',
    keyFields: [
      {
        field: 'ReturnCode',
        type: 'string',
        description: 'Links to shipment id in many flows',
        example: '"HR1234567890"',
      },
      { field: 'PickupStatus', type: 'enum', description: 'Pickup save status', example: '"Assigned"' },
      { field: 'ShipmentStatus', type: 'enum', description: 'Related shipment status', example: '"Created"' },
      { field: 'CourierZoneCode', type: 'string', description: 'Assigned zone', example: '"ZG-01"' },
      { field: 'HubId', type: 'string', description: 'Hub id', example: '"10"' },
      { field: 'RouteNumber', type: 'string', description: 'Route number', example: '"12"' },
      {
        field: 'PickupDate',
        type: 'DateTime',
        description:
          'Local pickup day at 00:00 stored as UTC — same CEST rule as ScheduleDate. Local 2026-07-17 → filter $gte ISODate("2026-07-16T22:00:00.000Z"), $lt ISODate("2026-07-17T22:00:00.000Z"). Do NOT use T00:00:00Z as the day start.',
        example: 'ISODate("2026-07-16T22:00:00.000Z")',
      },
      {
        field: 'ItemBarcode',
        type: 'array',
        description: 'NESY item barcodes',
        example: '["NESYBARCODE123"]',
      },
      {
        field: 'ItemLegacySystemShortBarcode',
        type: 'array',
        description: 'Legacy short barcodes',
        example: '["LEGACY12345"]',
      },
    ],
  }),
  withPrompts({
    database: 'NESY_TaskDB',
    collection: 'CourierZone',
    service: 'TaskWebAPI',
    keyFields: [
      { field: 'Code', type: 'string', description: 'Zone code', example: '"ZG-01"' },
      { field: 'ShortName', type: 'string', description: 'Zone short name', example: '"ZG North"' },
      { field: 'BranchId', type: 'int', description: 'Branch id', example: '10' },
      { field: 'PlateNumber', type: 'string', description: 'Default plate', example: '"ZG1234AB"' },
    ],
  }),
  withPrompts({
    database: 'NESY_TaskDB',
    collection: 'VehicleCourierZone',
    service: 'TaskWebAPI',
    keyFields: [
      { field: 'CourierZone', type: 'string', description: 'Zone code', example: '"ZG-01"' },
      { field: 'CourierId', type: 'string', description: 'Courier user id', example: '"user-123"' },
      { field: 'CourierName', type: 'string', description: 'Courier display name', example: '"Ana Anić"' },
      { field: 'PlateNumber', type: 'string', description: 'Assigned plate', example: '"ZG1234AB"' },
      { field: 'BranchId', type: 'int', description: 'Branch id', example: '10' },
      { field: 'CourierStatus', type: 'enum', description: 'Courier status', example: '"Active"' },
      { field: 'MainZone', type: 'string', description: 'Main zone code', example: '"ZG-01"' },
    ],
  }),
  withPrompts({
    database: 'NESY_TaskDB',
    collection: 'Approval',
    service: 'TaskWebAPI',
    keyFields: [
      { field: 'ApprovalType', type: 'enum', description: 'Approval type', example: '"Leaving"' },
      { field: 'ApprovalState', type: 'enum', description: 'Approval state', example: '"Pending"' },
      { field: 'RequestedBy', type: 'string', description: 'Requester username/id', example: '"courier01"' },
      {
        field: 'ApprovalUpdatedAt',
        type: 'DateTime',
        description: 'Last approval update',
        example: 'ISODate("2026-07-17T08:00:00Z")',
      },
    ],
  }),
  withPrompts(
    {
      database: 'NESY_TaskDB',
      collection: 'WaitingApprovalRequest',
      service: 'TaskWebAPI',
      keyFields: [
        { field: 'ScheduleId', type: 'string', description: 'Related schedule', example: '"SCH-20260717-1"' },
        { field: 'ShipmentId', type: 'string', description: 'Related shipment', example: '"HR1234567890"' },
        { field: 'CourierZoneCode', type: 'string', description: 'Zone code', example: '"ZG-01"' },
        { field: 'Status', type: 'enum', description: 'Mobile approval status', example: '"Waiting"' },
        {
          field: 'BarcodeList',
          type: 'array',
          description: 'NESY barcodes in request',
          example: '["NESYBARCODE123"]',
        },
        {
          field: 'LegacySystemShortBarcodeList',
          type: 'array',
          description: 'Legacy short barcodes',
          example: '["LEGACY12345"]',
        },
      ],
    },
    [
      {
        label: 'Waiting leaving requests',
        text: 'List WaitingApprovalRequest with Status Waiting for ScheduleDate-related ScheduleId SCH-20260717-1.',
      },
    ],
  ),
  withPrompts({
    database: 'NESY_TrackingDB',
    collection: 'TrackingData',
    service: 'TrackingWebAPI',
    keyFields: [
      { field: 'ScheduleId', type: 'string', description: 'Live schedule being tracked', example: '"SCH-20260717-1"' },
      { field: 'CourierUserId', type: 'string', description: 'Courier user id', example: '"user-123"' },
      { field: 'StopId', type: 'ObjectId', description: 'Current stop id', example: 'ObjectId("...")' },
      { field: 'TaskId', type: 'ObjectId', description: 'Current task id', example: 'ObjectId("...")' },
      { field: 'TaskStatus', type: 'enum', description: 'Current task status', example: '"InProgress"' },
      { field: 'RemainingStopCount', type: 'int', description: 'Stops remaining', example: '5' },
      { field: 'ProgressRate', type: 'int', description: 'Tour progress percent', example: '40' },
      {
        field: 'TrackingShipmentList',
        type: 'array',
        description: 'Shipments on current stop/task',
        example: '[{ TrackingNumber: "HR1234567890" }]',
      },
    ],
  }),
  withPrompts({
    database: 'NESY_TrackingDB',
    collection: 'ShipmentEventLog',
    service: 'TrackingWebAPI',
    keyFields: [
      { field: 'ShipmentId', type: 'string', description: 'Shipment id', example: '"HR1234567890"' },
      { field: 'EventType', type: 'string', description: 'Event code', example: '"Delivered"' },
      {
        field: 'CreatedAt',
        type: 'DateTime',
        description: 'Event time',
        example: 'ISODate("2026-07-17T12:00:00Z")',
      },
    ],
  }),
  withPrompts({
    database: 'NESY_TrackingDB',
    collection: 'CourierLocation',
    service: 'TrackingWebAPI',
    keyFields: [
      { field: 'CourierUserId', type: 'string', description: 'Courier user id', example: '"user-123"' },
      { field: 'Latitude', type: 'double', description: 'Latitude', example: '45.81' },
      { field: 'Longitude', type: 'double', description: 'Longitude', example: '15.98' },
      {
        field: 'CreatedAt',
        type: 'DateTime',
        description: 'Reported at',
        example: 'ISODate("2026-07-17T12:00:00Z")',
      },
    ],
  }),
  withPrompts({
    database: 'NESY_TrackingDB',
    collection: 'CourierLastLocation',
    service: 'TrackingWebAPI',
    keyFields: [
      { field: 'CourierUserId', type: 'string', description: 'Courier user id', example: '"user-123"' },
      { field: 'Latitude', type: 'double', description: 'Last latitude', example: '45.81' },
      { field: 'Longitude', type: 'double', description: 'Last longitude', example: '15.98' },
      {
        field: 'UpdatedAt',
        type: 'DateTime',
        description: 'Last heartbeat',
        example: 'ISODate("2026-07-17T12:00:00Z")',
      },
    ],
  }),
  withPrompts({
    database: 'NESY_UserDB',
    collection: 'User',
    service: 'UserWebAPI',
    keyFields: [
      { field: 'Username', type: 'string', description: 'Login username', example: '"courier01"' },
      { field: 'Email', type: 'string', description: 'Email', example: '"a@b.com"' },
      { field: 'Role', type: 'string', description: 'Primary role', example: '"Courier"' },
      { field: 'BranchId', type: 'int', description: 'Branch / hub id', example: '10' },
      {
        field: 'LockedUntil',
        type: 'DateTime',
        description: 'Account lock expiry if locked',
        example: 'ISODate("2026-07-17T08:00:00Z")',
      },
    ],
  }),
  withPrompts({
    database: 'NESY_UserDB',
    collection: 'UserLoginLog',
    service: 'UserWebAPI',
    keyFields: [
      { field: 'Username', type: 'string', description: 'Login username', example: '"courier01"' },
      {
        field: 'LoginAt',
        type: 'DateTime',
        description: 'Login attempt time',
        example: 'ISODate("2026-07-17T07:00:00Z")',
      },
      { field: 'IsSuccessful', type: 'bool', description: 'Login success', example: 'true' },
      { field: 'FailureReason', type: 'string', description: 'Failure reason if any', example: '"InvalidPassword"' },
      { field: 'Channel', type: 'string', description: 'Login channel', example: '"Mobile"' },
    ],
  }),
  withPrompts({
    database: 'NESY_UserDB',
    collection: 'DriverStatus',
    service: 'UserWebAPI',
    keyFields: [
      { field: 'UserId', type: 'string', description: 'Driver user id', example: '"user-123"' },
      { field: 'Status', type: 'enum', description: 'Driver status', example: '"Online"' },
      {
        field: 'UpdatedAt',
        type: 'DateTime',
        description: 'Status change time',
        example: 'ISODate("2026-07-17T07:00:00Z")',
      },
    ],
  }),
  withPrompts({
    database: 'NESY_TransferCenterDB',
    collection: 'Trip',
    service: 'TransferCenterWebAPI',
    keyFields: [
      { field: 'TripId', type: 'string', description: 'Trip id', example: '"TRIP-1"' },
      { field: 'Status', type: 'enum', description: 'Trip status', example: '"InProgress"' },
      { field: 'DriverId', type: 'string', description: 'Assigned driver', example: '"DRV-1"' },
      { field: 'VehicleId', type: 'string', description: 'Assigned vehicle', example: '"VEH-1"' },
    ],
  }),
  withPrompts({
    database: 'NESY_TransferCenterDB',
    collection: 'Driver',
    service: 'TransferCenterWebAPI',
    keyFields: [
      { field: 'DriverId', type: 'string', description: 'Driver id', example: '"DRV-1"' },
      { field: 'FullName', type: 'string', description: 'Driver name', example: '"Ana Anić"' },
      { field: 'IsActive', type: 'bool', description: 'Active flag', example: 'true' },
    ],
  }),
  withPrompts({
    database: 'NESY_TransferCenterDB',
    collection: 'Vehicle',
    service: 'TransferCenterWebAPI',
    keyFields: [
      { field: 'VehicleId', type: 'string', description: 'Vehicle id', example: '"VEH-1"' },
      { field: 'PlateNumber', type: 'string', description: 'Plate', example: '"ZG1234AB"' },
      { field: 'IsActive', type: 'bool', description: 'Active flag', example: 'true' },
    ],
  }),
  withPrompts(
    {
      database: 'NESY_CustomerDB',
      collection: 'Customer',
      service: 'CustomerWebAPI',
      keyFields: [
        { field: 'CustomerId', type: 'string', description: 'Customer id', example: '"C-100"' },
        { field: 'Name', type: 'string', description: 'Customer name', example: '"Acme d.o.o."' },
        { field: 'IsActive', type: 'bool', description: 'Active flag', example: 'true' },
      ],
    },
    [
      {
        label: 'Customer lookup',
        text: 'Find Customer with CustomerId C-100.',
      },
    ],
  ),
  withPrompts(
    {
      database: 'NESY_CustomerDB',
      collection: 'CustomerAddress',
      service: 'CustomerWebAPI',
      keyFields: [
        { field: 'CustomerId', type: 'string', description: 'Owner customer', example: '"C-100"' },
        { field: 'Country', type: 'string', description: 'Country code', example: '"HR"' },
        { field: 'City', type: 'string', description: 'City', example: '"Zagreb"' },
      ],
    },
    [
      {
        label: 'Customer addresses',
        text: 'List CustomerAddress for CustomerId C-100 in country HR.',
      },
    ],
  ),
  withPrompts({
    database: 'NESY_HistoryDB',
    collection: 'ShipmentEventLog',
    service: 'HistoryWebAPI',
    keyFields: [
      { field: 'ShipmentId', type: 'string', description: 'Shipment id', example: '"HR1234567890"' },
      { field: 'EventType', type: 'string', description: 'Historical event', example: '"Delivered"' },
      {
        field: 'CreatedAt',
        type: 'DateTime',
        description: 'Event time',
        example: 'ISODate("2026-07-17T12:00:00Z")',
      },
    ],
  }),
  withPrompts({
    database: 'NESY_HistoryDB',
    collection: 'FailedRequest',
    service: 'HistoryWebAPI',
    keyFields: [
      { field: 'Endpoint', type: 'string', description: 'Failed endpoint', example: '"/api/shipment/save"' },
      { field: 'ErrorMessage', type: 'string', description: 'Error text', example: '"timeout"' },
      {
        field: 'CreatedAt',
        type: 'DateTime',
        description: 'Failure time',
        example: 'ISODate("2026-07-17T12:00:00Z")',
      },
    ],
  }),
]

export function listDatabases(): string[] {
  return [...new Set(MONGO_CATALOG.map((c) => c.database))]
}

export function collectionsForDatabase(database: string): CatalogCollection[] {
  return MONGO_CATALOG.filter((c) => c.database === database)
}

export function getCollectionEntry(
  database: string,
  collection: string,
): CatalogCollection | undefined {
  return MONGO_CATALOG.find((c) => c.database === database && c.collection === collection)
}

export function getCatalogPayload() {
  return {
    databases: listDatabases(),
    collections: MONGO_CATALOG,
    predefinedQueries: PREDEFINED_QUERY_LIBRARY,
  }
}
