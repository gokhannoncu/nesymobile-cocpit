// Graylog Query Generator — all mock data and constants.
// UI texts and technical terms are in English; query contents are in Graylog syntax.

import type { Tone } from '@/components/product'

// ── Scenario chips ────────────────────────────────────────────

export type ScenarioChip = {
  id: string
  label: string
  /** Natural language request placed in textarea when chip is clicked. */
  text: string
}

export const SCENARIO_CHIPS: ScenarioChip[] = [
  {
    id: 'shipment-flow',
    label: 'Track shipment flow',
    text: 'Show delivery, fiscal, and retry logs generated in the last 2 hours for Shipment 45-40-20251224-1.',
  },
  {
    id: 'courier-login',
    label: 'Courier login problem',
    text: 'List this morning\'s login attempts and authentication errors for Courier 3021; include token refresh logs.',
  },
  {
    label: 'Search fiscal error code',
    id: 'fiscal-error',
    text: 'Show fiscal service logs generating FISCAL_TIMEOUT or FISCAL_DUPLICATE error code in the last 6 hours for Croatia.',
  },
  {
    id: 'offline-queue',
    label: 'Offline queue requests',
    text: 'Get offline request logs waiting or falling into retry status in RequestSenderService queue for the last 1 hour.',
  },
  {
    id: 'barcode-scan',
    label: 'Barcode scan logs',
    text: 'Show barcode scan events and errors occurring after scan on Device NX-4412 for the last 15 minutes.',
  },
  {
    id: 'd4me-callback',
    label: 'D4Me callback chain',
    text: 'Show D4Me locker callback chain for Shipment 45-40-20251218-7; match callback_received and callback_processed events.',
  },
  {
    id: 'device-crash',
    label: 'Pre-crash logs on specific device',
    text: 'Get all application logs in chronological order for the 10 minutes before the last crash on Device NX-2087.',
  },
  {
    id: 'api-401',
    label: 'API 401 and logout flow',
    text: 'Group API calls returning 401 and immediately following logout events by courier in the last 1 hour.',
  },
]

// ── Query context options ────────────────────────────────────

export type SelectOption = { value: string; label: string }

export const ENVIRONMENTS: SelectOption[] = [
  { value: 'uat', label: 'UAT' },
  { value: 'production', label: 'Production' },
]

export const COUNTRIES: SelectOption[] = [
  { value: 'HR', label: 'HR — Croatia' },
  { value: 'SI', label: 'SI — Slovenia' },
  { value: 'RS', label: 'RS — Serbia' },
  { value: 'BA', label: 'BA — Bosnia and Herzegovina' },
  { value: 'ME', label: 'ME — Montenegro' },
]

export const APPLICATIONS: SelectOption[] = [
  { value: 'nesy-mobile', label: 'nesy-mobile' },
  { value: 'nesy-backend', label: 'nesy-backend' },
  { value: 'nesy-fiscal', label: 'nesy-fiscal' },
  { value: 'nesy-d4me', label: 'nesy-d4me' },
]

export const SERVICES: SelectOption[] = [
  { value: 'any', label: 'All' },
  { value: 'RequestSenderService', label: 'RequestSenderService' },
  { value: 'DeliveryService', label: 'DeliveryService' },
  { value: 'FiscalService', label: 'FiscalService' },
  { value: 'AuthService', label: 'AuthService' },
  { value: 'LocationService', label: 'LocationService' },
  { value: 'NotificationService', label: 'NotificationService' },
]

export const LOG_LEVELS: SelectOption[] = [
  { value: 'any', label: 'All' },
  { value: 'error', label: 'ERROR' },
  { value: 'warn', label: 'WARN' },
  { value: 'info', label: 'INFO' },
  { value: 'debug', label: 'DEBUG' },
]

export const TIME_RANGES: SelectOption[] = [
  { value: '15m', label: 'Last 15 minutes' },
  { value: '1h', label: 'Last 1 hour' },
  { value: '6h', label: 'Last 6 hours' },
  { value: '24h', label: 'Last 24 hours' },
  { value: 'custom', label: 'Custom' },
]

/** Default time range in Production — limits broad search costs. */
export const PRODUCTION_DEFAULT_TIME_RANGE = '1h'

export const DEVICES: SelectOption[] = [
  { value: 'any', label: 'All' },
  { value: 'NX-4412', label: 'NX-4412' },
  { value: 'NX-2087', label: 'NX-2087' },
  { value: 'NX-3155', label: 'NX-3155' },
]

export const APP_VERSIONS: SelectOption[] = [
  { value: 'any', label: 'All' },
  { value: '4.12.0', label: '4.12.0' },
  { value: '4.11.2', label: '4.11.2' },
  { value: '4.10.5', label: '4.10.5' },
]

// ── Known identifiers ────────────────────────────────────────────

export type IdentifierField = {
  key: string
  label: string
  placeholder: string
}

export const IDENTIFIER_FIELDS: IdentifierField[] = [
  { key: 'shipmentId', label: 'Shipment ID', placeholder: '45-40-20251224-1' },
  { key: 'courierId', label: 'Courier ID', placeholder: '3021' },
  { key: 'scheduleId', label: 'Schedule ID', placeholder: 'SCH-2025-8841' },
  { key: 'requestId', label: 'Request ID', placeholder: 'req_9f3c1a72' },
  { key: 'deviceId', label: 'Device ID', placeholder: 'NX-4412' },
  { key: 'fiscalId', label: 'Fiscal ID', placeholder: 'FIS-HR-338291' },
  { key: 'errorCode', label: 'Error code', placeholder: 'FISCAL_TIMEOUT' },
  { key: 'customerTicketId', label: 'Customer ticket ID', placeholder: 'CT-10592' },
]

// ── Log sources ───────────────────────────────────────────────

export type LogSource = { id: string; label: string }

export const LOG_SOURCES: LogSource[] = [
  { id: 'mobile', label: 'Mobile application' },
  { id: 'backend', label: 'Backend API' },
  { id: 'fiscal', label: 'Fiscal service' },
  { id: 'd4me', label: 'D4Me / Locker' },
  { id: 'notification', label: 'Notification' },
  { id: 'location', label: 'Location service' },
  { id: 'offline-queue', label: 'Offline queue' },
  { id: 'auth', label: 'Authentication' },
]

// ── Guardrail messages ──────────────────────────────────────────

export const GUARDRAIL_BROAD_SCOPE =
  'This search can generate a very broad log volume. Narrow the scope by adding a service, country, or identifier.'

export const GUARDRAIL_SOFT_HINTS = [
  'The query can work, but it looks very broad.',
  'For faster results, add one of the shipmentId, requestId, or service fields.',
]

// ── Generated query (mock) ────────────────────────────────────────

export const GENERATED_QUERY = `application:nesy-mobile
AND country:HR
AND shipmentId:"45-40-20251224-1"
AND (
  event:delivery
  OR event:fiscal
  OR service:RequestSenderService
)`

export type QueryBreakdownRow = {
  part: string
  explanation: string
  tone: Tone
}

export const QUERY_BREAKDOWN: QueryBreakdownRow[] = [
  {
    part: 'application:nesy-mobile',
    explanation: 'Limits to logs coming from Nesy Mobile application.',
    tone: 'blue',
  },
  {
    part: 'country:HR',
    explanation: 'Returns only Croatia records.',
    tone: 'teal',
  },
  {
    part: 'shipmentId:"45-40-20251224-1"',
    explanation: 'Searches all associated logs of a specific shipment.',
    tone: 'indigo',
  },
  {
    part: '(event:delivery OR event:fiscal OR service:RequestSenderService)',
    explanation: 'Shows the delivery, fiscal, and offline retry chain together.',
    tone: 'orange',
  },
]

// ── Expected signals ─────────────────────────────────────────────

export const EXPECTED_EVENT_SEQUENCE: string[] = [
  'delivery_started',
  'payment_completed',
  'fiscal_created',
  'delivery_saved',
  'request_completed',
]

export type AnomalyExample = {
  title: string
  description: string
}

export const ANOMALY_EXAMPLES: AnomalyExample[] = [
  {
    title: 'payment_completed exists, delivery_saved does not',
    description:
      'Payment completed but delivery record not created — check the possibility of offline queue or isProcessing lock.',
  },
  {
    title: 'request_started exists, request_completed does not',
    description:
      'Request chain left half-way; same requestId should be searched in RequestSenderService retry logs.',
  },
  {
    title: 'Same fiscal_created twice',
    description:
      'Duplicate fiscal record — retry mechanism trying again without idempotency is typical reason.',
  },
  {
    title: 'Logout after 401',
    description:
      'When token expires, user silently drops from session; match with AuthService refresh logs.',
  },
  {
    title: 'isProcessing remained true',
    description:
      'Transaction flag not reset; all subsequent transactions might be silently blocked — check the last event before crash.',
  },
]

// ── Query quality ────────────────────────────────────────────────

export type QualityCheck = {
  label: string
  value: string
  tone: Tone
}

export const QUALITY_CHECKS: QualityCheck[] = [
  { label: 'Syntax valid', value: 'Graylog syntax verified', tone: 'green' },
  { label: 'Time range valid', value: 'Last 1 hour — acceptable', tone: 'green' },
  { label: 'Search scope', value: 'Single application · single country', tone: 'green' },
  { label: 'Identifier strength', value: 'shipmentId — strong narrower', tone: 'green' },
  { label: 'Expected volume', value: '~150-400 rows', tone: 'blue' },
  { label: 'Sensitive data', value: 'PII fields masked', tone: 'gray' },
]

export type QualityVerdict = {
  label: string
  tone: Tone
  explanation: string
}

export const QUALITY_VERDICT_STRONG: QualityVerdict = {
  label: 'Query quality: Strong',
  tone: 'green',
  explanation:
    'Search scope is narrow enough because Shipment ID, country, and time range are used together.',
}

export const QUALITY_VERDICT_BROAD: QualityVerdict = {
  label: 'Query quality: Broad',
  tone: 'amber',
  explanation: "Only 'error' word is searched. Adding a service or identifier is recommended.",
}

// ── Common Graylog fields ────────────────────────────────────────

export type GraylogField = {
  field: string
  meaning: string
  example: string
  source: string
}

export const GRAYLOG_FIELDS: GraylogField[] = [
  {
    field: 'shipmentId',
    meaning: "Unique identifier of the shipment — connects delivery, fiscal, and retry logs in a single chain.",
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
]

// ── Saved investigations ─────────────────────────────────────────

export type SavedInvestigation = {
  id: string
  name: string
  purpose: string
  country: string
  timeRange: string
  relatedIncident: string
  createdBy: string
  lastUsed: string
  objective: string
  query: string
  expectedEventChain: string[]
  knownAnomalies: string[]
  relatedTickets: string[]
  rootCause: string
  edgeCase: string
}

export const SAVED_INVESTIGATIONS: SavedInvestigation[] = [
  {
    id: 'inv-double-fiscal',
    name: 'Double fiscal investigation',
    purpose: 'Find the source of two fiscal_created records for the same shipment',
    country: 'HR',
    timeRange: 'Last 6 hours',
    relatedIncident: 'INC-2025-114',
    createdBy: 'M. Kovacic',
    lastUsed: '2 days ago',
    objective:
      'Catch cases where the retry mechanism resends the fiscal request without idempotency control. We are looking for multiple fiscal_created events under the same shipmentId.',
    query: `application:nesy-fiscal
AND country:HR
AND event:fiscal_created
AND shipmentId:*
| aggregate count by shipmentId having count > 1`,
    expectedEventChain: ['payment_completed', 'fiscal_requested', 'fiscal_created', 'fiscal_confirmed'],
    knownAnomalies: [
      'fiscal_created event 2+ times for the same shipmentId',
      'Second record usually within 30-90 sec after retry',
    ],
    relatedTickets: ['FT-031', 'CT-10233'],
    rootCause: 'RequestSenderService retry resends fiscal request without idempotency key.',
    edgeCase: 'If response arrives before timeout in weak signal, both original and retry are considered successful.',
  },
  {
    id: 'inv-silent-logout',
    name: 'Silent logout during shift',
    purpose: 'Detect couriers experiencing silent logout during shift',
    country: 'SI',
    timeRange: 'Last 24 hours',
    relatedIncident: 'INC-2025-098',
    createdBy: 'A. Novak',
    lastUsed: '5 hours ago',
    objective:
      'Find sessions falling to logout without refresh attempt after 401. Since the session is closed without the courier noticing, deliveries stack up in the offline queue.',
    query: `application:nesy-mobile
AND country:SI
AND (statusCode:401 OR event:logout)
AND courierId:*
| sort timestamp asc`,
    expectedEventChain: ['token_expired', 'token_refresh_attempted', 'token_refreshed'],
    knownAnomalies: ['No token_refresh_attempted event after 401', 'logout event within shift hours'],
    relatedTickets: ['FT-018', 'CT-10471'],
    rootCause: 'No refresh token mechanism; when access token expires, session silently drops.',
    edgeCase: 'If device clock is skewed, token expires early according to server.',
  },
  {
    id: 'inv-zombie-queue',
    name: 'Zombie request queue',
    purpose: 'Find request chains started in queue but never completed',
    country: 'HR',
    timeRange: 'Last 24 hours',
    relatedIncident: 'INC-2025-121',
    createdBy: 'G. Oncu',
    lastUsed: 'Yesterday',
    objective:
      'Detect records that have request_started but do not produce request_completed or request_failed. These chains silently block the queue and delay subsequent deliveries.',
    query: `service:RequestSenderService
AND country:HR
AND event:request_started
NOT event:request_completed
| aggregate count by requestId`,
    expectedEventChain: ['request_queued', 'request_started', 'request_completed'],
    knownAnomalies: ['10+ min silence after request_started', 'records where isProcessing remained true'],
    relatedTickets: ['FT-027'],
    rootCause: 'When crash occurs during processing, isProcessing flag is not reset; queue locks.',
    edgeCase: 'If OS kills process while app is in background, finally block never runs.',
  },
  {
    id: 'inv-barcode-crash',
    name: 'Barcode scan crash',
    purpose: 'Extract log pattern before crash on scan screen',
    country: 'RS',
    timeRange: 'Last 6 hours',
    relatedIncident: 'INC-2025-107',
    createdBy: 'D. Petrovic',
    lastUsed: '3 days ago',
    objective:
      'Collect last events before crashes occurring after barcode scan on specific device models; suspicion of camera buffer error to be confirmed.',
    query: `application:nesy-mobile
AND country:RS
AND event:barcode_scan
AND deviceId:NX-2087
| sort timestamp desc | limit 200`,
    expectedEventChain: ['scan_opened', 'barcode_scan', 'scan_validated', 'shipment_loaded'],
    knownAnomalies: ['Log cuts off after barcode_scan before scan_validated arrives', 'Recurring pattern on the same device'],
    relatedTickets: ['FT-035', 'CT-10518'],
    rootCause: 'On low-memory devices, second scan opens before camera buffer is released.',
    edgeCase: 'Rapid double scan (double tap) in a row significantly increases crash probability.',
  },
  {
    id: 'inv-d4me-mismatch',
    name: 'D4Me callback mismatch',
    purpose: 'Find cases where locker callback and shipment status do not match',
    country: 'HR',
    timeRange: 'Last 24 hours',
    relatedIncident: 'INC-2025-119',
    createdBy: 'M. Kovacic',
    lastUsed: '1 week ago',
    objective:
      'Catch records where D4Me callback_received event arrived but shipment status is not updated; suspicion of callback ordering or duplicate delivery.',
    query: `application:nesy-d4me
AND country:HR
AND event:callback_received
NOT event:callback_processed
| aggregate count by shipmentId`,
    expectedEventChain: ['locker_reserved', 'parcel_deposited', 'callback_received', 'callback_processed'],
    knownAnomalies: ['callback_received exists, callback_processed does not', 'Different locker code for the same shipment'],
    relatedTickets: ['FT-022', 'CT-10390'],
    rootCause: 'Callback handler returns early on out-of-order messages; state machine is not updated.',
    edgeCase: 'When locker network connection drops, callbacks arrive in bulk and out-of-order.',
  },
]
