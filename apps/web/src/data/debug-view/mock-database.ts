// ============================================================================
// Debug View — Database Access + Request table mock data
// ============================================================================
// 1) Device Room DB access methods analysis over Release APK.
// 2) NesyMobile `request` table (offline queue, AppDatabase v240) rows.
//    Field names match database.Request entity exactly; requestName values
//    from real constants in util/Constants.kt.

import type { DbAccessMethod, RequestRow, DbTableInfo } from './types'

// ---------------------------------------------------------------------------
// 1. Database access methods via Release APK
// ---------------------------------------------------------------------------

export const DB_ACCESS_METHODS: DbAccessMethod[] = [
  {
    id: 'run-as',
    name: 'adb run-as (debuggable build)',
    tool: 'adb + run-as',
    requiresRoot: false,
    worksOnRelease: false,
    difficulty: 'easy',
    summary:
      'If application is debuggable=true, access nesy Room DB files directly in the application sandbox without root. Does not work on Release (debuggable=false) builds.',
    steps: [
      'Ensure debug/internal build is installed on device (isDebuggable=true).',
      'Switch to application data directory using run-as.',
      'Pull nesy .db + -wal + -shm files under databases/.',
      'Open in SQLite browser (DB Browser for SQLite).',
    ],
    commands: [
      'adb shell run-as com.arasdigital.nesymobile ls databases/',
      'adb exec-out run-as com.arasdigital.nesymobile cat databases/nesy.db > nesy.db',
      'adb exec-out run-as com.arasdigital.nesymobile cat databases/nesy.db-wal > nesy.db-wal',
    ],
    caveats: [
      'Returns "run-as: package not debuggable" error on Release build.',
      'If WAL mode is active, -wal and -shm files must also be pulled, otherwise last written ones won\'t be visible.',
    ],
    tone: 'green',
  },
  {
    id: 'in-app-export',
    name: 'In-app DB snapshot (recommended)',
    tool: 'History/SaveTerminalRequestDbSnapshot',
    requiresRoot: false,
    worksOnRelease: true,
    difficulty: 'easy',
    summary:
      'The app already sends gzipped snapshot of the request table to the backend (RequestSenderService → SaveTerminalRequestDbSnapshot). This is the safest way to get data from Release devices.',
    steps: [
      'Find the latest snapshot record for the relevant scheduleId / username on the backend.',
      'Extract gzip+base64 payload.',
      'Examine request table rows as JSON.',
    ],
    commands: [
      '# Graylog / backend log: requestName=SaveTerminalRequestDbSnapshot',
      "# veya Nesy Device Bridge: bridge pull-request-snapshot --schedule SCH-HR-...",
    ],
    caveats: [
      'Only covers the request table — other tables (schedule, stop) are not included.',
      'Snapshot is sent periodically; the most current rows may be delayed by a few minutes.',
    ],
    tone: 'teal',
  },
  {
    id: 'root-pull',
    name: 'Direct file pull with Root',
    tool: 'adb root / su',
    requiresRoot: true,
    worksOnRelease: true,
    difficulty: 'moderate',
    summary:
      'Directly access DB files under /data/data on rooted device or emulator. Works even on Release build, but field devices are usually unrooted.',
    steps: [
      'adb root (emulator) or su (rooted device).',
      'Copy /data/data/com.arasdigital.nesymobile/databases/ directory.',
      'Open with SQLite.',
    ],
    commands: [
      'adb root',
      'adb shell "su -c \'cp /data/data/com.arasdigital.nesymobile/databases/* /sdcard/nesy-db/\'"',
      'adb pull /sdcard/nesy-db/',
    ],
    caveats: [
      'Field production devices (Urovo/Zebra) come unrooted.',
      'Rooting may affect device warranty/compatibility.',
    ],
    tone: 'amber',
  },
  {
    id: 'android-studio',
    name: 'Android Studio Database Inspector',
    tool: 'Android Studio',
    requiresRoot: false,
    worksOnRelease: false,
    difficulty: 'easy',
    summary:
      'Live, non-read-only SQL query interface for debuggable process. Monitors tables in real time while device is connected via USB. Does not attach to Release processes.',
    steps: [
      'Connect device via USB, run application with debuggable build.',
      'View → Tool Windows → App Inspection → Database Inspector.',
      'Select nesy DB and run live SQL query on the request table.',
    ],
    commands: ["SELECT * FROM request WHERE isProcessing = 1 ORDER BY timeStamp;"],
    caveats: [
      'Only attaches to debuggable processes.',
      'Requires API 26+.',
    ],
    tone: 'blue',
  },
  {
    id: 'release-blocked',
    name: 'Release APK — direct access',
    tool: '—',
    requiresRoot: false,
    worksOnRelease: false,
    difficulty: 'blocked',
    summary:
      'Direct access to sandbox on an unrooted, non-debuggable production device is blocked by the OS. In this case, the only way is in-app snapshot or backend records.',
    steps: [
      'Use in-app snapshot (SaveTerminalRequestDbSnapshot).',
      'Or query from backend Graylog records based on requestName.',
      'Or temporarily flash the device with internal build.',
    ],
    commands: ['# adb run-as → "package not debuggable" (blocked)'],
    caveats: [
      'Resigning the APK and making it debuggable breaks signature verification and invalidates certificate pinning.',
    ],
    tone: 'red',
  },
]

// ---------------------------------------------------------------------------
// 2. request table rows (offline queue snapshot)
// ---------------------------------------------------------------------------

export const MOCK_REQUEST_ROWS: RequestRow[] = [
  {
    id: 401,
    userName: 'ikrunic',
    requestName: 'deliverParcels',
    requestJson: '{"selectedBarcodeList":["HR304418872299001","HR304418872299002"],"deliveryCode":"4471","effectiveType":6}',
    timeStamp: '2026-07-15T09:14:05+02:00',
    tryCount: 0,
    isProcessing: false,
    isWaitingRequest: false,
    createdAt: 1752563645000,
    waybillNumbers: ['HR304418872299'],
    sendWithoutWaiting: false,
    fiscalInvoiceId: 'FIS-HR-88213',
    uniqueKey: 'deliverParcels_ZG-IST-07_HR304418872299001,HR304418872299002',
    derivedState: 'pending',
  },
  {
    id: 402,
    userName: 'ikrunic',
    requestName: 'saveImageFile',
    requestJson: '{"path":"NESYMobileCustomerSignature/2026-07-15","fileName":"signature_884213.jpg"}',
    timeStamp: '2026-07-15T09:14:31+02:00',
    tryCount: 0,
    isProcessing: true,
    isWaitingRequest: false,
    createdAt: 1752563671000,
    waybillNumbers: ['HR304418872299'],
    sendWithoutWaiting: true,
    fiscalInvoiceId: null,
    uniqueKey: 'saveImageFile_signature_884213.jpg',
    derivedState: 'in-flight',
  },
  {
    id: 403,
    userName: 'ikrunic',
    requestName: 'DeliveryFailed',
    requestJson: '{"waybillNumber":"HR304418000112","reasonCode":11,"remark":"Consignee was not at the address"}',
    timeStamp: '2026-07-15T09:16:18+02:00',
    tryCount: 1,
    isProcessing: false,
    isWaitingRequest: false,
    createdAt: 1752563778000,
    waybillNumbers: ['HR304418000112'],
    sendWithoutWaiting: false,
    fiscalInvoiceId: null,
    uniqueKey: 'DeliveryFailed_HR304418000112',
    derivedState: 'retrying',
  },
  {
    id: 404,
    userName: 'ikrunic',
    requestName: 'loadParcelToCourierVehicle',
    requestJson: '{"barcodeList":["HR304418872310","HR304418872311"],"vehiclePlate":"ZG-1842-KM"}',
    timeStamp: '2026-07-15T09:21:39+02:00',
    tryCount: 2,
    isProcessing: false,
    isWaitingRequest: true,
    createdAt: 1752564099000,
    waybillNumbers: ['HR304418872310', 'HR304418872311'],
    sendWithoutWaiting: false,
    fiscalInvoiceId: null,
    uniqueKey: 'loadParcelToCourierVehicle_ZG-1842-KM_HR304418872310,HR304418872311',
    derivedState: 'waiting',
  },
  {
    id: 405,
    userName: 'ikrunic',
    requestName: 'SaveCallLogs',
    requestJson: '{"callType":2,"callDuration":47,"callStartTime":"2026-07-15T09:15:10","waybillNumber":"HR304418000112"}',
    timeStamp: '2026-07-15T09:15:58+02:00',
    tryCount: 0,
    isProcessing: false,
    isWaitingRequest: false,
    createdAt: 1752563758000,
    waybillNumbers: ['HR304418000112'],
    sendWithoutWaiting: true,
    fiscalInvoiceId: null,
    uniqueKey: 'SaveCallLogs_HR304418000112_2026-07-15T09:15:10',
    derivedState: 'pending',
  },
  {
    id: 406,
    userName: 'ikrunic',
    requestName: 'MoveTaskToEndOfStopList',
    requestJson: '{"taskId":"TASK-1002","stopId":"STOP-002"}',
    timeStamp: '2026-07-15T09:17:02+02:00',
    tryCount: 3,
    isProcessing: false,
    isWaitingRequest: false,
    createdAt: 1752563822000,
    waybillNumbers: [],
    sendWithoutWaiting: false,
    fiscalInvoiceId: null,
    uniqueKey: 'MoveTaskToEndOfStopList_TASK-1002',
    derivedState: 'dead',
  },
  {
    id: 407,
    userName: 'ikrunic',
    requestName: 'ReleaseParcel',
    requestJson: '{"barcode":"HR304418872320","counterLocationId":"PUDO-ZG-114"}',
    timeStamp: '2026-07-15T09:19:44+02:00',
    tryCount: 0,
    isProcessing: false,
    isWaitingRequest: false,
    createdAt: 1752563984000,
    waybillNumbers: ['HR304418872320'],
    sendWithoutWaiting: false,
    fiscalInvoiceId: null,
    uniqueKey: 'ReleaseParcel_HR304418872320',
    derivedState: 'pending',
  },
]

// ---------------------------------------------------------------------------
// 3. nesy Room DB table summary (AppDatabase v240)
// ---------------------------------------------------------------------------

export const DB_TABLES: DbTableInfo[] = [
  { name: 'request', rowCount: 7, sizeKb: 34, description: 'Offline request queue (waiting to be sent)', primaryKey: 'id (autoGenerate)' },
  { name: 'CompletedRequest', rowCount: 128, sizeKb: 512, description: 'Successfully sent request archive', primaryKey: 'id' },
  { name: 'Schedule', rowCount: 1, sizeKb: 96, description: 'Active daily schedule (body JSON)', primaryKey: 'id' },
  { name: 'Stop', rowCount: 18, sizeKb: 72, description: 'Stops in schedule', primaryKey: 'stopId' },
  { name: 'Task', rowCount: 54, sizeKb: 210, description: 'Tasks at stops', primaryKey: 'taskId' },
]

export const DB_META = {
  databaseName: 'nesy.db',
  version: 240,
  journalMode: 'WAL',
  path: '/data/data/com.arasdigital.nesymobile/databases/nesy.db',
  sizeMb: 3.4,
}
