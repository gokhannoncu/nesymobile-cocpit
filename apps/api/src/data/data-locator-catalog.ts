/** Data Locator catalog — Mongo composition over MONGO_CATALOG + mobile locals. */

import { getCollectionEntry, MONGO_CATALOG } from './mongo-catalog.js'

export type TruthLevel =
  | 'authoritative'
  | 'operational'
  | 'cached'
  | 'derived'
  | 'temporary'
  | 'audit'

export type SourceType =
  | 'MongoDB Collection'
  | 'Android Room'
  | 'SharedPreferences'
  | 'Memory State'

export type DataDomain =
  | 'Shipment'
  | 'Delivery'
  | 'Payment'
  | 'Fiscal'
  | 'Schedule'
  | 'Courier'
  | 'Barcode'
  | 'Offline Queue'
  | 'Notification'
  | 'Location'
  | 'Authentication'
  | 'Customer'
  | 'Transfer'
  | 'Inventory'
  | 'Routing'

export type SourceEnvironment = 'Mobile local' | 'Backend' | 'UAT' | 'Production'
export type SourceCountry = 'HR' | 'BA' | 'SI' | 'RS' | 'General'
export type ResultRole = 'primary' | 'supporting' | 'log' | 'cache' | 'external'
export type SourceKind = 'mongo' | 'mobile'

export type LocatorKeyField = {
  name: string
  type: string
  meaning: string
}

export type DataLocatorSource = {
  id: string
  kind: SourceKind
  name: string
  system: string
  sourceType: SourceType
  database?: string
  collection?: string
  service?: string
  domains: DataDomain[]
  truth: TruthLevel
  owner: string
  freshness: string
  retention: string
  updateFrequency: string
  environments: SourceEnvironment[]
  countries: SourceCountry[]
  lastSchemaUpdate: string
  purpose: string
  notFor: string
  keyFields: LocatorKeyField[]
  commonQuestions: string[]
  exampleQuery: { label: string; code: string }
  relatedSources: string[]
  caveats: string[]
}

export type SearchIntent = {
  id: string
  chipLabel?: string
  keywords: string[]
  guidance: { headline: string; detail: string }
  results: { sourceId: string; role: ResultRole }[]
}

export type LineageChain = {
  id: string
  title: string
  description: string
  nodes: { label: string; sourceId?: string }[]
}

export type InvestigationRecipe = {
  id: string
  title: string
  purpose: string
  checkOrder: string[]
  identifier: string
  cta: { label: string; href: string }
}

export type Guardrail = {
  title: string
  body: string
  tone: 'amber' | 'gray'
}

type MongoMeta = {
  domains: DataDomain[]
  truth: TruthLevel
  owner?: string
  freshness?: string
  retention?: string
  updateFrequency?: string
  environments?: SourceEnvironment[]
  countries?: SourceCountry[]
  lastSchemaUpdate?: string
  purpose: string
  notFor: string
  commonQuestions: string[]
  relatedKeys?: string[]
  /** Fully-qualified mobile source ids (`mobile:…`). */
  relatedMobile?: string[]
  caveats?: string[]
  exampleFilter?: string
}

function mongoId(database: string, collection: string) {
  return `mongo:${database}:${collection}`
}

function mobileId(slug: string) {
  return `mobile:${slug}`
}

const SHIPMENT = mongoId('NESY_ShipmentDB', 'Shipment')
const FISCAL = mongoId('NESY_ShipmentDB', 'FiscalInvoiceDocument')
const SOFTPOS = mongoId('NESY_ShipmentDB', 'SoftPosTransaction')
const SCHEDULE = mongoId('NESY_TaskDB', 'Schedule')
const TRACKING = mongoId('NESY_TrackingDB', 'TrackingData')
const EVENT_LOG = mongoId('NESY_TrackingDB', 'ShipmentEventLog')
const COURIER_LAST = mongoId('NESY_TrackingDB', 'CourierLastLocation')
const USER = mongoId('NESY_UserDB', 'User')
const HISTORY_EVENT = mongoId('NESY_HistoryDB', 'ShipmentEventLog')
const FAILED_REQ = mongoId('NESY_HistoryDB', 'FailedRequest')

const MOBILE_CHUNK = mobileId('schedule-stop-chunk')
const MOBILE_REQUEST = mobileId('request')
const MOBILE_NOTIF = mobileId('notification-info')
const MOBILE_FORCE = mobileId('force-loaded-barcodes')
const MOBILE_PAID = mobileId('paid-shipments')

const DEFAULT_OWNER = 'NESY Backend'
const DEFAULT_FRESHNESS = 'Event-driven / near real-time'
const DEFAULT_RETENTION = 'Per service retention policy'
const DEFAULT_UPDATE = 'On write / sync events'
const DEFAULT_ENVS: SourceEnvironment[] = ['Backend', 'Production', 'UAT']
const DEFAULT_COUNTRIES: SourceCountry[] = ['General']
const DEFAULT_SCHEMA = '2026-07-18'

/** Locator metadata keyed by `database/collection`. */
const MONGO_META: Record<string, MongoMeta> = {
  'NESY_ShipmentDB/Shipment': {
    domains: ['Shipment', 'Delivery', 'Payment'],
    truth: 'operational',
    purpose:
      'Current operational state of a shipment: status, parcels/barcodes, customer/consignee, last event. First place for payment + delivery questions.',
    notFor:
      'Fiscal compliance proof (use FiscalInvoiceDocument) or full event replay (use Tracking/History event logs).',
    commonQuestions: [
      'What state is this shipment in right now?',
      'Which barcodes belong to this shipment?',
      'Is the mobile screen identical to the backend?',
    ],
    relatedKeys: [
      'NESY_ShipmentDB/FiscalInvoiceDocument',
      'NESY_ShipmentDB/SoftPosTransaction',
      'NESY_TrackingDB/ShipmentEventLog',
      'NESY_TaskDB/Schedule',
    ],
    relatedMobile: [MOBILE_CHUNK, MOBILE_REQUEST, MOBILE_PAID],
    caveats: [
      'Mobile Room copy may lag behind backend until sync.',
      'Fiscal status is not the same as ShipmentStatus.',
    ],
    exampleFilter: 'ShipmentId: "<SHIPMENT_ID>"',
  },
  'NESY_ShipmentDB/ShipmentHistory': {
    domains: ['Shipment'],
    truth: 'audit',
    purpose: 'Historical change records for a shipment (update events).',
    notFor: 'Current operational status — use Shipment.',
    commonQuestions: ['What changed on this shipment and when?'],
    relatedKeys: ['NESY_ShipmentDB/Shipment', 'NESY_TrackingDB/ShipmentEventLog'],
  },
  'NESY_ShipmentDB/ShipmentStatusLog': {
    domains: ['Shipment', 'Delivery'],
    truth: 'audit',
    purpose: 'Append-only status transition log for shipments.',
    notFor: 'Authoritative current status — use Shipment.ShipmentStatus.',
    commonQuestions: ['Which status transitions occurred for this shipment?'],
    relatedKeys: ['NESY_ShipmentDB/Shipment'],
  },
  'NESY_ShipmentDB/FiscalInvoiceDocument': {
    domains: ['Fiscal', 'Payment'],
    truth: 'authoritative',
    countries: ['HR', 'BA', 'SI', 'RS', 'General'],
    purpose:
      'Official fiscal invoice document for a collection: invoice number, fiscal status, amount, SDC time.',
    notFor: 'Delivery completion proof — fiscal success ≠ delivered.',
    commonQuestions: [
      'Was fiscalization completed for this shipment?',
      'Does fiscal amount match SoftPos / COD?',
    ],
    relatedKeys: [
      'NESY_ShipmentDB/Shipment',
      'NESY_ShipmentDB/SoftPosTransaction',
      'NESY_ShipmentDB/Invoice',
    ],
    relatedMobile: [MOBILE_PAID, MOBILE_REQUEST],
    caveats: ['Fiscal callback can lag minutes behind SoftPos approval.'],
    exampleFilter: 'ShipmentId: "<SHIPMENT_ID>"',
  },
  'NESY_ShipmentDB/Invoice': {
    domains: ['Fiscal', 'Payment'],
    truth: 'operational',
    purpose: 'Invoice records linked to shipments.',
    notFor: 'Tax-authority fiscal codes — prefer FiscalInvoiceDocument.',
    commonQuestions: ['Which invoice number is linked to this shipment?'],
    relatedKeys: ['NESY_ShipmentDB/FiscalInvoiceDocument', 'NESY_ShipmentDB/Shipment'],
  },
  'NESY_ShipmentDB/SoftPosTransaction': {
    domains: ['Payment'],
    truth: 'operational',
    purpose: 'SoftPOS / card collection transaction results for a shipment.',
    notFor: 'In-memory mobile paid badge (SharedViewModel) or fiscal authority record.',
    commonQuestions: ['Did SoftPOS approve the collection?', 'What status did POS return?'],
    relatedKeys: [
      'NESY_ShipmentDB/Shipment',
      'NESY_ShipmentDB/FiscalInvoiceDocument',
    ],
    relatedMobile: [MOBILE_PAID],
    exampleFilter: 'ShipmentId: "<SHIPMENT_ID>"',
  },
  'NESY_ShipmentDB/CodShipment': {
    domains: ['Payment', 'Shipment'],
    truth: 'operational',
    purpose: 'Cash-on-delivery amount and barcode linkage for COD shipments.',
    notFor: 'Card SoftPOS results.',
    commonQuestions: ['What COD amount is expected for this shipment?'],
    relatedKeys: ['NESY_ShipmentDB/Shipment'],
  },
  'NESY_ShipmentDB/AddressRouteLookUp': {
    domains: ['Routing', 'Shipment'],
    truth: 'derived',
    purpose: 'Zip/route/center lookup used for address routing coverage.',
    notFor: 'Live courier GPS or schedule stops.',
    commonQuestions: ['Which route/center covers this zip code?'],
  },
  'NESY_ShipmentDB/Inventory': {
    domains: ['Inventory', 'Barcode', 'Shipment'],
    truth: 'operational',
    purpose: 'Parcel inventory / barcode inventory view tied to shipments.',
    notFor: 'Courier offline force-load history on device.',
    commonQuestions: ['Is this barcode in inventory for the shipment?'],
    relatedKeys: ['NESY_ShipmentDB/Shipment'],
    relatedMobile: [MOBILE_FORCE],
  },
  'NESY_TaskDB/Schedule': {
    domains: ['Schedule', 'Courier'],
    truth: 'authoritative',
    purpose:
      'Courier daily tour (schedule): stops, assigned work, courier identity, schedule date. Backend source of truth for tour data.',
    notFor: 'What the courier currently sees offline — that is ScheduleStopChunk on device.',
    commonQuestions: [
      'Which schedule is active for this courier today?',
      'Which schedule owns this stop/shipment assignment?',
    ],
    relatedKeys: ['NESY_TaskDB/Pickup', 'NESY_TaskDB/CourierZone', 'NESY_ShipmentDB/Shipment'],
    relatedMobile: [MOBILE_CHUNK, MOBILE_NOTIF],
    caveats: ['After replanning, mobile chunks may show old order until FCM/sync.'],
    exampleFilter: 'CourierUserId: "<COURIER_USER_ID>", ScheduleDate: …',
  },
  'NESY_TaskDB/Pickup': {
    domains: ['Schedule', 'Shipment'],
    truth: 'operational',
    purpose: 'Pickup tasks linked to schedules and shipments.',
    notFor: 'Delivery stop list UI cache.',
    commonQuestions: ['What pickup tasks exist for this schedule/day?'],
    relatedKeys: ['NESY_TaskDB/Schedule'],
  },
  'NESY_TaskDB/CourierZone': {
    domains: ['Courier', 'Schedule'],
    truth: 'authoritative',
    purpose: 'Courier zone definitions used for planning and assignment.',
    notFor: 'Live GPS position.',
    commonQuestions: ['Which zone is this courier assigned to?'],
    relatedKeys: ['NESY_TaskDB/VehicleCourierZone', 'NESY_TaskDB/Schedule'],
  },
  'NESY_TaskDB/VehicleCourierZone': {
    domains: ['Courier', 'Transfer'],
    truth: 'operational',
    purpose: 'Vehicle ↔ courier zone mapping.',
    notFor: 'Trip waybill state — use TransferCenter Trip.',
    commonQuestions: ['Which vehicle is mapped to this courier zone?'],
    relatedKeys: ['NESY_TaskDB/CourierZone', 'NESY_TransferCenterDB/Vehicle'],
  },
  'NESY_TaskDB/Approval': {
    domains: ['Courier', 'Authentication'],
    truth: 'operational',
    purpose: 'Approval records for courier/ops workflows.',
    notFor: 'Offline request queue on device.',
    commonQuestions: ['Is there a pending/processed approval for this action?'],
    relatedKeys: ['NESY_TaskDB/WaitingApprovalRequest'],
  },
  'NESY_TaskDB/WaitingApprovalRequest': {
    domains: ['Courier', 'Offline Queue'],
    truth: 'temporary',
    purpose: 'Requests waiting for approval before continuing the workflow.',
    notFor: 'Mobile RequestSender Room queue.',
    commonQuestions: ['Which requests are blocked on approval?'],
    relatedKeys: ['NESY_TaskDB/Approval'],
  },
  'NESY_TrackingDB/TrackingData': {
    domains: ['Shipment', 'Delivery'],
    truth: 'operational',
    purpose: 'Tracking projection used by tracking pages (by tracking number / hash).',
    notFor: 'Full shipment commercial detail — use Shipment.',
    commonQuestions: ['What tracking info exists for this tracking number?'],
    relatedKeys: [
      'NESY_TrackingDB/ShipmentEventLog',
      'NESY_ShipmentDB/Shipment',
    ],
    exampleFilter: 'TrackingNumber: "<TRACKING_NUMBER>"',
  },
  'NESY_TrackingDB/ShipmentEventLog': {
    domains: ['Delivery', 'Shipment', 'Payment'],
    truth: 'audit',
    purpose: 'Time-ordered shipment event stream for ops diagnosis (what happened, in what order).',
    notFor: 'Authoritative current shipment status — confirm on Shipment.',
    commonQuestions: [
      'What event chain ran for this shipment?',
      'Did a PAY/DELY event arrive?',
    ],
    relatedKeys: [
      'NESY_ShipmentDB/Shipment',
      'NESY_HistoryDB/ShipmentEventLog',
      'NESY_TrackingDB/TrackingData',
    ],
    relatedMobile: [MOBILE_REQUEST],
    exampleFilter: 'ShipmentId: "<SHIPMENT_ID>"',
  },
  'NESY_TrackingDB/CourierLocation': {
    domains: ['Location', 'Courier'],
    truth: 'derived',
    purpose: 'Courier location history / samples.',
    notFor: 'Proof of delivery.',
    commonQuestions: ['What location trail exists for this courier?'],
    relatedKeys: ['NESY_TrackingDB/CourierLastLocation'],
  },
  'NESY_TrackingDB/CourierLastLocation': {
    domains: ['Location', 'Courier'],
    truth: 'derived',
    freshness: '~heartbeat interval from device',
    purpose: 'Last known courier GPS position for maps / ETA.',
    notFor: 'Delivery proof or historical route analysis beyond retention.',
    commonQuestions: [
      'Where was the courier last seen?',
      'How stale is the last location?',
    ],
    relatedKeys: ['NESY_TrackingDB/CourierLocation', 'NESY_TaskDB/Schedule'],
    exampleFilter: 'CourierUserId / CourierId field from schema',
  },
  'NESY_UserDB/User': {
    domains: ['Authentication', 'Courier'],
    truth: 'authoritative',
    purpose: 'User / courier identity and account record.',
    notFor: 'Tour contents — use Schedule.',
    commonQuestions: ['Which user id / username is this courier?'],
    relatedKeys: ['NESY_UserDB/DriverStatus', 'NESY_UserDB/UserLoginLog'],
  },
  'NESY_UserDB/UserLoginLog': {
    domains: ['Authentication'],
    truth: 'audit',
    purpose: 'Login audit trail for users/couriers.',
    notFor: 'Current driver online status — use DriverStatus.',
    commonQuestions: ['When did this courier last log in?'],
    relatedKeys: ['NESY_UserDB/User'],
  },
  'NESY_UserDB/DriverStatus': {
    domains: ['Courier', 'Authentication'],
    truth: 'operational',
    purpose: 'Current driver/courier operational status flags.',
    notFor: 'GPS location.',
    commonQuestions: ['Is the driver marked available / busy / offline?'],
    relatedKeys: ['NESY_UserDB/User'],
  },
  'NESY_TransferCenterDB/Trip': {
    domains: ['Transfer', 'Shipment'],
    truth: 'operational',
    purpose: 'Transfer-center trip records (linehaul / hub moves).',
    notFor: 'Last-mile courier Schedule.',
    commonQuestions: ['Which trip carries this waybill/transfer?'],
    relatedKeys: [
      'NESY_TransferCenterDB/Driver',
      'NESY_TransferCenterDB/Vehicle',
    ],
  },
  'NESY_TransferCenterDB/Driver': {
    domains: ['Transfer', 'Courier'],
    truth: 'authoritative',
    purpose: 'Transfer-center driver master data.',
    notFor: 'Last-mile User/DriverStatus in UserDB (different domain).',
    commonQuestions: ['Which transfer driver is assigned to this trip?'],
    relatedKeys: ['NESY_TransferCenterDB/Trip'],
  },
  'NESY_TransferCenterDB/Vehicle': {
    domains: ['Transfer'],
    truth: 'authoritative',
    purpose: 'Transfer-center vehicle master data.',
    notFor: 'Courier zone vehicle mapping alone — also check VehicleCourierZone.',
    commonQuestions: ['Which vehicle is on this trip?'],
    relatedKeys: ['NESY_TransferCenterDB/Trip', 'NESY_TaskDB/VehicleCourierZone'],
  },
  'NESY_CustomerDB/Customer': {
    domains: ['Customer', 'Shipment'],
    truth: 'authoritative',
    purpose: 'Customer master record (shipper / account).',
    notFor: 'Consignee address snapshot on Shipment document.',
    commonQuestions: ['Which customer owns this shipment account?'],
    relatedKeys: ['NESY_CustomerDB/CustomerAddress', 'NESY_ShipmentDB/Shipment'],
  },
  'NESY_CustomerDB/CustomerAddress': {
    domains: ['Customer'],
    truth: 'operational',
    purpose: 'Customer address book / locations.',
    notFor: 'Live delivery address on an in-flight shipment (Shipment.Consignee).',
    commonQuestions: ['What addresses exist for this customer?'],
    relatedKeys: ['NESY_CustomerDB/Customer'],
  },
  'NESY_HistoryDB/ShipmentEventLog': {
    domains: ['Shipment', 'Delivery'],
    truth: 'audit',
    purpose: 'History service copy of shipment event logs for longer retention / reporting paths.',
    notFor: 'Real-time tracking projection — prefer TrackingDB first.',
    commonQuestions: ['Is the event also present in history storage?'],
    relatedKeys: [
      'NESY_TrackingDB/ShipmentEventLog',
      'NESY_ShipmentDB/Shipment',
    ],
  },
  'NESY_HistoryDB/FailedRequest': {
    domains: ['Offline Queue', 'Shipment'],
    truth: 'audit',
    purpose: 'Failed backend request archive (endpoint + error) for diagnosis.',
    notFor: 'Device RequestSender queue (may never have reached the backend).',
    commonQuestions: ['Did this API call fail on the backend side?'],
    relatedKeys: ['NESY_ShipmentDB/Shipment'],
    relatedMobile: [MOBILE_REQUEST],
  },
}

function metaFor(database: string, collection: string): MongoMeta {
  const key = `${database}/${collection}`
  const found = MONGO_META[key]
  if (found) return found
  return {
    domains: ['Shipment'],
    truth: 'operational',
    purpose: `${collection} in ${database} (${getCollectionEntry(database, collection)?.service ?? 'NESY'}).`,
    notFor: 'Use only when you know this collection is the right operational source.',
    commonQuestions: [`Where is ${collection} data stored?`],
    caveats: ['Locator metadata is generic fallback — refine if this source becomes primary.'],
  }
}

function buildMongoSource(
  database: string,
  collection: string,
): DataLocatorSource | null {
  const entry = getCollectionEntry(database, collection)
  if (!entry) {
    console.warn(`[data-locator] missing MONGO_CATALOG entry: ${database}/${collection}`)
    return null
  }
  const meta = metaFor(database, collection)
  const relatedFromKeys = (meta.relatedKeys ?? []).map((k) => {
    const [db, col] = k.split('/')
    return mongoId(db!, col!)
  })
  const related = [...relatedFromKeys, ...(meta.relatedMobile ?? [])]
  const filter = meta.exampleFilter ?? '_id: ObjectId("…")'
  return {
    id: mongoId(database, collection),
    kind: 'mongo',
    name: collection,
    system: `${database} / ${entry.service}`,
    sourceType: 'MongoDB Collection',
    database,
    collection,
    service: entry.service,
    domains: meta.domains,
    truth: meta.truth,
    owner: meta.owner ?? DEFAULT_OWNER,
    freshness: meta.freshness ?? DEFAULT_FRESHNESS,
    retention: meta.retention ?? DEFAULT_RETENTION,
    updateFrequency: meta.updateFrequency ?? DEFAULT_UPDATE,
    environments: meta.environments ?? DEFAULT_ENVS,
    countries: meta.countries ?? DEFAULT_COUNTRIES,
    lastSchemaUpdate: meta.lastSchemaUpdate ?? DEFAULT_SCHEMA,
    purpose: meta.purpose,
    notFor: meta.notFor,
    keyFields: entry.keyFields.map((f) => ({
      name: f.field,
      type: f.type,
      meaning: f.description,
    })),
    commonQuestions: meta.commonQuestions,
    exampleQuery: {
      label: 'mongodb',
      code: `db.${collection}.find({\n  ${filter}\n}).limit(100)`,
    },
    relatedSources: related,
    caveats: meta.caveats ?? [],
  }
}

const MOBILE_SOURCES: DataLocatorSource[] = [
  {
    id: MOBILE_CHUNK,
    kind: 'mobile',
    name: 'ScheduleStopChunk',
    system: 'Courier Mobile Room (AppDatabase)',
    sourceType: 'Android Room',
    domains: ['Schedule', 'Shipment', 'Delivery'],
    truth: 'cached',
    owner: 'Mobile Team',
    freshness: 'Last successful schedule sync / FCM refresh',
    retention: 'On device until cleared / logout / day end workflows',
    updateFrequency: 'Schedule sync + local stop mutations',
    environments: ['Mobile local', 'Production', 'UAT'],
    countries: ['General'],
    lastSchemaUpdate: 'Courier.Mobile AppDatabase v240',
    purpose:
      'Chunked copy of schedule stops on device (`ScheduleStopChunk`: scheduleId, stopIndex, stopJson, stopId). Powers stop list UI and offline work.',
    notFor: 'Operational validation against backend — Schedule in NESY_TaskDB wins on conflict.',
    keyFields: [
      { name: 'id', type: 'Int', meaning: 'Room primary key (auto).' },
      { name: 'scheduleId', type: 'String', meaning: 'Backend schedule id.' },
      { name: 'stopIndex', type: 'Int', meaning: 'Stop order index in the tour.' },
      { name: 'stopId', type: 'String', meaning: 'Stop identifier.' },
      { name: 'stopJson', type: 'String (JSON)', meaning: 'Serialized stop + tasks/shipments payload.' },
    ],
    commonQuestions: [
      'Why does the courier screen show an old stop order?',
      'Is the shipment present in the local stopJson?',
    ],
    exampleQuery: {
      label: 'sql (room)',
      code: "SELECT * FROM ScheduleStopChunk\nWHERE scheduleId = '<SCHEDULE_ID>'\nORDER BY stopIndex ASC;",
    },
    relatedSources: [SCHEDULE, SHIPMENT, MOBILE_REQUEST, MOBILE_NOTIF],
    caveats: [
      'Device-only; not remotely queryable without the handset/ADB.',
      'stopJson may lag after intraday replanning until sync.',
    ],
  },
  {
    id: MOBILE_REQUEST,
    kind: 'mobile',
    name: 'Request',
    system: 'Courier Mobile Room + RequestSenderService',
    sourceType: 'Android Room',
    domains: ['Offline Queue', 'Shipment', 'Delivery', 'Payment'],
    truth: 'temporary',
    owner: 'Mobile Team',
    freshness: 'Live on device while RequestSenderService drains the queue',
    retention: 'Deleted/archived after successful send; old completed cleanup ~7 days',
    updateFrequency: 'Insert on offline action; drain on connectivity',
    environments: ['Mobile local', 'Production', 'UAT'],
    countries: ['General'],
    lastSchemaUpdate: 'Courier.Mobile AppDatabase v240',
    purpose:
      'Offline action queue (`Request` entity): requestName, requestJson, tryCount, isProcessing, uniqueKey. First place for “action done on device but missing in backend”.',
    notFor: 'Permanent history — use backend event logs / FailedRequest after the call leaves the device.',
    keyFields: [
      { name: 'id', type: 'Int', meaning: 'Room primary key.' },
      { name: 'uniqueKey', type: 'String', meaning: 'Idempotency key (unique index).' },
      { name: 'requestName', type: 'String', meaning: 'API/action name constant.' },
      { name: 'requestJson', type: 'String (JSON)', meaning: 'Payload body to send.' },
      { name: 'tryCount', type: 'Int', meaning: 'Retry count; climbing means send failures.' },
      { name: 'isProcessing', type: 'Boolean', meaning: 'Currently in the send loop.' },
      { name: 'isWaitingRequest', type: 'Boolean', meaning: 'Waiting/deferred before send.' },
      { name: 'createdAt', type: 'Long', meaning: 'Queue insert time (epoch ms).' },
      { name: 'waybillNumbers', type: 'List<String>?', meaning: 'Related waybills when set.' },
      { name: 'fiscalInvoiceId', type: 'String?', meaning: 'Linked fiscal invoice id when present.' },
    ],
    commonQuestions: [
      'Why did the courier action not reach the backend?',
      'Is isProcessing stuck true?',
      'How many retries has this uniqueKey accumulated?',
    ],
    exampleQuery: {
      label: 'sql (room)',
      code: 'SELECT id, requestName, tryCount, isProcessing, uniqueKey\nFROM Request\nORDER BY createdAt ASC;',
    },
    relatedSources: [SHIPMENT, EVENT_LOG, FAILED_REQ, MOBILE_CHUNK, MOBILE_PAID],
    caveats: [
      'Visible only on the device.',
      'If isProcessing sticks, the queue may stop draining.',
    ],
  },
  {
    id: MOBILE_NOTIF,
    kind: 'mobile',
    name: 'NotificationInfo',
    system: 'Courier Mobile Room',
    sourceType: 'Android Room',
    domains: ['Notification', 'Schedule'],
    truth: 'derived',
    owner: 'Mobile Team',
    freshness: 'When FCM message is persisted locally',
    retention: 'On device until cleared',
    updateFrequency: 'On push handling (ArasFirebaseMessagingService)',
    environments: ['Mobile local', 'Production', 'UAT'],
    countries: ['General'],
    lastSchemaUpdate: 'Courier.Mobile AppDatabase v240',
    purpose:
      'Local record of notifications shown/stored for the courier (`courierID`, `messageBody`, `hasRead`, timestamps).',
    notFor: 'Business data itself — payload is often a trigger; pull real data via schedule sync.',
    keyFields: [
      { name: 'id', type: 'Int', meaning: 'Room primary key.' },
      { name: 'courierID', type: 'String?', meaning: 'Courier receiving the notification.' },
      { name: 'messageBody', type: 'String?', meaning: 'Notification body text/payload.' },
      { name: 'hasRead', type: 'Boolean?', meaning: 'Read flag.' },
      { name: 'creationTime', type: 'String?', meaning: 'Display time string.' },
      { name: 'creationDate', type: 'Long?', meaning: 'Creation epoch.' },
    ],
    commonQuestions: [
      'Did a schedule-refresh style notification land on the device?',
      'Was the notification marked read?',
    ],
    exampleQuery: {
      label: 'sql (room)',
      code: 'SELECT * FROM NotificationInfo\nORDER BY creationDate DESC\nLIMIT 20;',
    },
    relatedSources: [MOBILE_CHUNK, SCHEDULE],
    caveats: ['FCM delivery is not guaranteed; missing row ≠ missing backend event.'],
  },
  {
    id: MOBILE_FORCE,
    kind: 'mobile',
    name: 'forceLoadBarcodeList',
    system: 'Courier Mobile SharedPreferences (SP.forceLoadedBarcodeList)',
    sourceType: 'SharedPreferences',
    domains: ['Barcode', 'Shipment'],
    truth: 'cached',
    owner: 'Mobile Team',
    freshness: 'Last force-load / scan-queue mutation on device',
    retention: 'Persists on device until cleared / logout wipe',
    updateFrequency: 'When courier force-loads or scan queue updates the list',
    environments: ['Mobile local', 'Production', 'UAT'],
    countries: ['General'],
    lastSchemaUpdate: 'SP.kt key forceLoadBarcodeList',
    purpose:
      'JSON list of force-loaded barcodes in default SharedPreferences (`forceLoadBarcodeList`). Used for duplicate force-load warnings and support checks.',
    notFor: 'Official scan history — prefer backend Inventory / Shipment / event logs.',
    keyFields: [
      {
        name: 'forceLoadBarcodeList',
        type: 'String (JSON array of String)',
        meaning: 'Serialized barcode strings (distinct on write).',
      },
    ],
    commonQuestions: [
      'Was this barcode force-loaded on this device?',
      'How many force-loaded barcodes are pending locally?',
    ],
    exampleQuery: {
      label: 'kotlin',
      code: 'sp.forceLoadedBarcodeList\n// SharedPreferences key: "forceLoadBarcodeList"',
    },
    relatedSources: [SHIPMENT, mongoId('NESY_ShipmentDB', 'Inventory'), EVENT_LOG],
    caveats: ['Device-specific; changing handset loses the list.'],
  },
  {
    id: MOBILE_PAID,
    kind: 'mobile',
    name: 'paidShipments',
    system: 'Courier Mobile SharedViewModel (memory)',
    sourceType: 'Memory State',
    domains: ['Payment', 'Shipment'],
    truth: 'temporary',
    owner: 'Mobile Team',
    freshness: 'Instant within UI process lifetime',
    retention: 'Process lifetime; lost on process death',
    updateFrequency: 'When POS/collection UI marks a shipment paid in-session',
    environments: ['Mobile local'],
    countries: ['General'],
    lastSchemaUpdate: 'SharedViewModel.kt',
    purpose:
      'In-memory `mutableSetOf<String>` of shipment ids marked paid in the current app session — drives UI “paid” badges between screens.',
    notFor: 'Any validation — SoftPosTransaction + FiscalInvoiceDocument + Shipment are the real answers.',
    keyFields: [
      { name: 'paidShipments', type: 'Set<String>', meaning: 'Shipment ids marked paid in memory.' },
    ],
    commonQuestions: [
      'UI shows paid but backend still pending — is it only memory state?',
      'Did the POS result reach SharedViewModel?',
    ],
    exampleQuery: {
      label: 'kotlin',
      code: '// SharedViewModel\npaidShipments // mutableSetOf<String> shipment ids',
    },
    relatedSources: [SHIPMENT, SOFTPOS, FISCAL, MOBILE_REQUEST],
    caveats: [
      'Lost after process restart.',
      'UI paid can coexist with Request still queued offline.',
    ],
  },
]

function buildAllSources(): DataLocatorSource[] {
  const mongo = MONGO_CATALOG.map((c) => buildMongoSource(c.database, c.collection)).filter(
    (s): s is DataLocatorSource => s != null,
  )
  return [...mongo, ...MOBILE_SOURCES]
}

let cachedSources: DataLocatorSource[] | null = null

export function listSources(): DataLocatorSource[] {
  if (!cachedSources) cachedSources = buildAllSources()
  return cachedSources
}

export function getSourceById(id: string): DataLocatorSource | undefined {
  return listSources().find((s) => s.id === id)
}

export const SEARCH_INTENTS: SearchIntent[] = [
  {
    id: 'payment-and-delivery',
    keywords: [
      'payment ve delivery',
      'payment ve teslimat',
      'birlikte',
      'ödeme ve teslimat',
      'payment durumu ile delivery',
      'payment and delivery',
    ],
    guidance: {
      headline: 'Tek kaynak yetmez — Shipment ile FiscalInvoiceDocument / SoftPos birlikte okunmalı.',
      detail:
        'Operasyonel payment+delivery durumu NESY_ShipmentDB.Shipment üzerindedir. Fiscal için FiscalInvoiceDocument, kart tahsilatı için SoftPosTransaction bakın. Cihazda “paid” yalnızca memory; offline ise Request kuyruğu.',
    },
    results: [
      { sourceId: SHIPMENT, role: 'primary' },
      { sourceId: FISCAL, role: 'supporting' },
      { sourceId: SOFTPOS, role: 'supporting' },
      { sourceId: MOBILE_CHUNK, role: 'cache' },
      { sourceId: EVENT_LOG, role: 'log' },
      { sourceId: MOBILE_PAID, role: 'cache' },
    ],
  },
  {
    id: 'shipment-location',
    chipLabel: 'Shipment nerede tutulur?',
    keywords: ['shipment nerede', 'shipment kayd', 'gönderi nerede', 'shipment tutul', 'where is shipment'],
    guidance: {
      headline: 'Önce NESY_ShipmentDB.Shipment collection’ına bak.',
      detail:
        'Güncel operasyonel kayıt backend Mongo Shipment’tadır. Mobil ekrandaki kopya ScheduleStopChunk.stopJson üzerinden gelir ve gecikebilir.',
    },
    results: [
      { sourceId: SHIPMENT, role: 'primary' },
      { sourceId: MOBILE_CHUNK, role: 'cache' },
      { sourceId: EVENT_LOG, role: 'log' },
      { sourceId: TRACKING, role: 'supporting' },
    ],
  },
  {
    id: 'payment-status',
    chipLabel: 'Payment durumu nereden okunur?',
    keywords: ['payment', 'ödeme', 'tahsilat', 'pos', 'paid', 'softpos', 'cod'],
    guidance: {
      headline: 'Önce Shipment, sonra SoftPosTransaction / FiscalInvoiceDocument.',
      detail:
        'Operasyonel durum Shipment’ta; kart sonucu SoftPosTransaction; mali kayıt FiscalInvoiceDocument. UI paid badge = SharedViewModel memory.',
    },
    results: [
      { sourceId: SHIPMENT, role: 'primary' },
      { sourceId: SOFTPOS, role: 'supporting' },
      { sourceId: FISCAL, role: 'supporting' },
      { sourceId: MOBILE_PAID, role: 'cache' },
      { sourceId: EVENT_LOG, role: 'log' },
    ],
  },
  {
    id: 'fiscal-record',
    chipLabel: 'Fiscal kayıt nasıl bulunur?',
    keywords: ['fiscal', 'fatura', 'invoice', 'jir', 'zki', 'fiscalization', 'sdc'],
    guidance: {
      headline: 'Fiscal kaydın ana kaynağı FiscalInvoiceDocument collection’ıdır.',
      detail:
        'ShipmentId ile Shipment ve SoftPosTransaction ile karşılaştırın. Mobilde ayrıca Room FiscalInvoiceData entity’si vardır ama bu katalogda backend fiscal document önceliklidir.',
    },
    results: [
      { sourceId: FISCAL, role: 'primary' },
      { sourceId: SHIPMENT, role: 'supporting' },
      { sourceId: SOFTPOS, role: 'supporting' },
      { sourceId: EVENT_LOG, role: 'log' },
    ],
  },
  {
    id: 'offline-queue',
    chipLabel: 'Offline queue nerede?',
    keywords: ['offline', 'queue', 'kuyruk', 'requestsender', 'sync bekle', 'gönderilmedi', 'request entity'],
    guidance: {
      headline: 'Offline işlemler cihazdaki Room Request tablosunda bekler.',
      detail:
        'RequestSenderService bu kuyruğu drain eder. Backend’e hiç ulaşmamış çağrılar FailedRequest’te görünmez; önce Request.isProcessing / tryCount kontrol edin.',
    },
    results: [
      { sourceId: MOBILE_REQUEST, role: 'primary' },
      { sourceId: MOBILE_CHUNK, role: 'cache' },
      { sourceId: FAILED_REQ, role: 'log' },
      { sourceId: SHIPMENT, role: 'supporting' },
      { sourceId: EVENT_LOG, role: 'log' },
    ],
  },
  {
    id: 'schedule-data',
    chipLabel: 'Schedule verisi nerede?',
    keywords: ['schedule', 'tur', 'stop list', 'rota', 'plan', 'tour'],
    guidance: {
      headline: 'Schedule’ın tek gerçek kaynağı NESY_TaskDB.Schedule’dır.',
      detail:
        'Kuryenin ekranda gördüğü liste ScheduleStopChunk kopyasındandır. “Ekran eski” şikayetinde önce backend Schedule, sonra cihaz chunk’larını karşılaştırın.',
    },
    results: [
      { sourceId: SCHEDULE, role: 'primary' },
      { sourceId: MOBILE_CHUNK, role: 'cache' },
      { sourceId: MOBILE_NOTIF, role: 'supporting' },
      { sourceId: EVENT_LOG, role: 'log' },
    ],
  },
  {
    id: 'courier-location',
    chipLabel: 'Courier location nerede?',
    keywords: ['location', 'konum', 'courier nerede', 'kurye nerede', 'gps', 'harita', 'last location'],
    guidance: {
      headline: 'Son bilinen konum CourierLastLocation collection’ındadır.',
      detail:
        'Konum türetilmiş anlık veridir — teslimat kanıtı değildir. Stale ise heartbeat kesilmiş olabilir; Schedule durumuyla birlikte değerlendirin.',
    },
    results: [
      { sourceId: COURIER_LAST, role: 'primary' },
      { sourceId: mongoId('NESY_TrackingDB', 'CourierLocation'), role: 'supporting' },
      { sourceId: SCHEDULE, role: 'supporting' },
      { sourceId: USER, role: 'supporting' },
    ],
  },
  {
    id: 'barcode-history',
    chipLabel: 'Barcode geçmişi nerede?',
    keywords: ['barcode', 'barkod', 'force load', 'okutma', 'scan', 'inventory'],
    guidance: {
      headline: 'Force-load geçmişi cihazdaki forceLoadBarcodeList’tedir; resmi barkod Shipment/Inventory’dedir.',
      detail:
        'SharedPreferences listesi cihaza özeldir. Operasyonel eşleşme için Shipment.Parcels.* ve Inventory; olaylar için ShipmentEventLog.',
    },
    results: [
      { sourceId: MOBILE_FORCE, role: 'cache' },
      { sourceId: SHIPMENT, role: 'primary' },
      { sourceId: mongoId('NESY_ShipmentDB', 'Inventory'), role: 'supporting' },
      { sourceId: EVENT_LOG, role: 'log' },
    ],
  },
  {
    id: 'courier-identity',
    chipLabel: 'Courier / user nerede?',
    keywords: ['courier', 'kurye', 'user', 'driver', 'login', 'kimlik'],
    guidance: {
      headline: 'Kimlik NESY_UserDB.User; tur NESY_TaskDB.Schedule.',
      detail:
        'Login audit UserLoginLog’da; operasyonel driver flag’leri DriverStatus’ta. Last-mile schedule ile transfer Driver koleksiyonunu karıştırmayın.',
    },
    results: [
      { sourceId: USER, role: 'primary' },
      { sourceId: mongoId('NESY_UserDB', 'DriverStatus'), role: 'supporting' },
      { sourceId: SCHEDULE, role: 'supporting' },
      { sourceId: mongoId('NESY_UserDB', 'UserLoginLog'), role: 'log' },
    ],
  },
]

export function resolveIntent(query: string): SearchIntent | null {
  const q = query.trim().toLowerCase()
  if (!q) return null
  let best: SearchIntent | null = null
  let bestScore = 0
  for (const intent of SEARCH_INTENTS) {
    const score = intent.keywords.filter((k) => q.includes(k)).length
    if (score > bestScore) {
      best = intent
      bestScore = score
    }
  }
  return best
}

export const LINEAGE_CHAINS: LineageChain[] = [
  {
    id: 'payment-flow',
    title: 'Payment → Delivery data flow',
    description: 'Collection path from SoftPOS / fiscal through shipment state to mobile cache.',
    nodes: [
      { label: 'SoftPOS / COD', sourceId: SOFTPOS },
      { label: 'Shipment', sourceId: SHIPMENT },
      { label: 'FiscalInvoiceDocument', sourceId: FISCAL },
      { label: 'Event log', sourceId: EVENT_LOG },
      { label: 'Mobile Request queue', sourceId: MOBILE_REQUEST },
      { label: 'ScheduleStopChunk', sourceId: MOBILE_CHUNK },
    ],
  },
  {
    id: 'schedule-flow',
    title: 'Schedule → device → backend',
    description: 'Tour planned in TaskDB, cached on device, actions return via RequestSender.',
    nodes: [
      { label: 'Schedule', sourceId: SCHEDULE },
      { label: 'ScheduleStopChunk', sourceId: MOBILE_CHUNK },
      { label: 'Stop list UI' },
      { label: 'Request queue', sourceId: MOBILE_REQUEST },
      { label: 'Shipment / events', sourceId: SHIPMENT },
      { label: 'ShipmentEventLog', sourceId: EVENT_LOG },
    ],
  },
]

export const INVESTIGATION_RECIPES: InvestigationRecipe[] = [
  {
    id: 'payment-completed-delivery-missing',
    title: 'Payment completed, delivery missing',
    purpose:
      'Collection looks successful but delivery state is missing. Narrow which hop broke.',
    checkOrder: [
      'NESY_ShipmentDB.Shipment (status + payment-related fields)',
      'SoftPosTransaction / CodShipment',
      'FiscalInvoiceDocument',
      'Mobile Request queue (isProcessing / tryCount)',
      'TrackingDB.ShipmentEventLog chain',
    ],
    identifier: 'ShipmentId',
    cta: {
      label: 'Open investigation',
      href: '/engineering/tools/mongodb-query-generator?database=NESY_ShipmentDB&collection=Shipment',
    },
  },
  {
    id: 'shipment-appears-twice',
    title: 'Shipment appears twice',
    purpose: 'Same shipment appears twice in a list — distinguish event, cache, or idempotency leak.',
    checkOrder: [
      'Shipment document uniqueness / updated fields',
      'ShipmentEventLog duplicate events',
      'NotificationInfo duplicate triggers on device',
      'ScheduleStopChunk duplicate stopJson entries',
      'Request.uniqueKey repeats in offline queue',
    ],
    identifier: 'ShipmentId + event type',
    cta: {
      label: 'Open investigation',
      href: '/engineering/tools/mongodb-query-generator?database=NESY_TrackingDB&collection=ShipmentEventLog',
    },
  },
  {
    id: 'courier-data-not-syncing',
    title: 'Courier data not syncing',
    purpose: 'Courier actions are not reaching the backend. Walk device queue → network → backend.',
    checkOrder: [
      'Room Request queue depth + isProcessing',
      'tryCount / requestTrace on stuck rows',
      'HistoryDB.FailedRequest for accepted-but-failed calls',
      'Shipment / Schedule after successful drain',
      'ScheduleStopChunk dirty/stale stopJson',
    ],
    identifier: 'uniqueKey + CourierUserId',
    cta: {
      label: 'Open investigation',
      href: '/engineering/tools/mongodb-query-generator?database=NESY_HistoryDB&collection=FailedRequest',
    },
  },
]

export const GUARDRAILS: Guardrail[] = [
  {
    title: 'Cache ≠ Source of Truth',
    body: 'Mobile Room, SharedPreferences, or memory state must not be treated as the operational record of truth.',
    tone: 'amber',
  },
  {
    title: 'Log ≠ Business Record',
    body: 'Event logs explain sequence; confirm outcomes on Shipment / FiscalInvoiceDocument / Schedule.',
    tone: 'amber',
  },
  {
    title: 'Same Field ≠ Same Meaning',
    body: 'Status-like fields differ across mobile, Shipment, SoftPos, and fiscal documents.',
    tone: 'gray',
  },
  {
    title: 'Freshness matters',
    body: 'Local and backend records can diverge briefly due to sync delay or offline queues.',
    tone: 'gray',
  },
]

export const NO_RESULT = {
  title: 'No directly matching data source was found.',
  suggestions: [
    'Try a broader business term — e.g. “payment” or “schedule”.',
    'Add shipment / courier context words to improve keyword match.',
    'Use domain filters after a successful search to narrow cards.',
    'Browse the full catalog table below if intent search misses.',
  ],
}

export function getCatalogPayload() {
  const sources = listSources()
  return {
    sources,
    intents: SEARCH_INTENTS,
    lineage: LINEAGE_CHAINS,
    recipes: INVESTIGATION_RECIPES,
    guardrails: GUARDRAILS,
    noResult: NO_RESULT,
    filterOptions: {
      domains: [...new Set(sources.flatMap((s) => s.domains))].sort(),
      sourceTypes: [...new Set(sources.map((s) => s.sourceType))].sort(),
      environments: [...new Set(sources.flatMap((s) => s.environments))].sort(),
      countries: [...new Set(sources.flatMap((s) => s.countries))].sort(),
    },
  }
}

/** Test helpers — stable ids used by intents. */
export const DATA_LOCATOR_IDS = {
  SHIPMENT,
  FISCAL,
  SOFTPOS,
  SCHEDULE,
  TRACKING,
  EVENT_LOG,
  COURIER_LAST,
  USER,
  HISTORY_EVENT,
  FAILED_REQ,
  MOBILE_CHUNK,
  MOBILE_REQUEST,
  MOBILE_NOTIF,
  MOBILE_FORCE,
  MOBILE_PAID,
}
