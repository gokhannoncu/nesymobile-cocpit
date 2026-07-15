// ============================================================================
// Debug View — Database Access + Request table mock data
// ============================================================================
// 1) Release APK üzerinden cihaz Room DB'sine erişim yöntemleri analizi.
// 2) NesyMobile `request` tablosunun (offline kuyruk, AppDatabase v240) satırları.
//    Alan adları database.Request entity'siyle birebir; requestName değerleri
//    util/Constants.kt'teki gerçek sabitlerden.

import type { DbAccessMethod, RequestRow, DbTableInfo } from './types'

// ---------------------------------------------------------------------------
// 1. Release APK üzerinden veritabanına erişim yöntemleri
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
      'Uygulama debuggable=true ise, root olmadan uygulama sandbox\'ındaki nesy Room DB dosyalarına doğrudan erişilir. Release (debuggable=false) build\'lerde çalışmaz.',
    steps: [
      'Cihazda debug/internal build yüklü olduğundan emin olun (isDebuggable=true).',
      'run-as ile uygulama veri dizinine geçin.',
      'databases/ altındaki nesy .db + -wal + -shm dosyalarını çekin.',
      'SQLite tarayıcıda (DB Browser for SQLite) açın.',
    ],
    commands: [
      'adb shell run-as com.arasdigital.nesymobile ls databases/',
      'adb exec-out run-as com.arasdigital.nesymobile cat databases/nesy.db > nesy.db',
      'adb exec-out run-as com.arasdigital.nesymobile cat databases/nesy.db-wal > nesy.db-wal',
    ],
    caveats: [
      'Release build\'de "run-as: package not debuggable" hatası döner.',
      'WAL modu aktifse -wal ve -shm dosyaları da alınmalı, yoksa son yazılanlar görünmez.',
    ],
    tone: 'green',
  },
  {
    id: 'in-app-export',
    name: 'Uygulama içi DB snapshot (önerilen)',
    tool: 'History/SaveTerminalRequestDbSnapshot',
    requiresRoot: false,
    worksOnRelease: true,
    difficulty: 'easy',
    summary:
      'Uygulama zaten request tablosunun gzip\'lenmiş anlık görüntüsünü backend\'e gönderiyor (RequestSenderService → SaveTerminalRequestDbSnapshot). Release cihazlardan veri almanın en güvenli yolu budur.',
    steps: [
      'Backend\'de ilgili scheduleId / username için son snapshot kaydını bulun.',
      'gzip+base64 payload\'ı çözün.',
      'request tablosu satırlarını JSON olarak inceleyin.',
    ],
    commands: [
      '# Graylog / backend log: requestName=SaveTerminalRequestDbSnapshot',
      "# veya Nesy Device Bridge: bridge pull-request-snapshot --schedule SCH-HR-...",
    ],
    caveats: [
      'Yalnızca request tablosunu kapsar — diğer tablolar (schedule, stop) dahil değil.',
      'Snapshot periyodik gönderilir; en güncel satırlar birkaç dakika gecikmeli olabilir.',
    ],
    tone: 'teal',
  },
  {
    id: 'root-pull',
    name: 'Root ile doğrudan dosya çekme',
    tool: 'adb root / su',
    requiresRoot: true,
    worksOnRelease: true,
    difficulty: 'moderate',
    summary:
      'Root\'lu cihaz veya emülatörde /data/data altındaki DB dosyalarına doğrudan erişilir. Release build\'de bile çalışır ama saha cihazları genelde root\'suzdur.',
    steps: [
      'adb root (emülatör) veya su (root\'lu cihaz).',
      '/data/data/com.arasdigital.nesymobile/databases/ dizinini kopyalayın.',
      'SQLite ile açın.',
    ],
    commands: [
      'adb root',
      'adb shell "su -c \'cp /data/data/com.arasdigital.nesymobile/databases/* /sdcard/nesy-db/\'"',
      'adb pull /sdcard/nesy-db/',
    ],
    caveats: [
      'Saha üretim cihazları (Urovo/Zebra) root\'suz gelir.',
      'Root işlemi cihaz garantisini/uyumluluğunu etkileyebilir.',
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
      'Debuggable süreç için canlı, salt-okunur olmayan SQL sorgu arayüzü. Cihaz USB ile bağlıyken tabloları gerçek zamanlı izler. Release süreçlere attach olmaz.',
    steps: [
      'Cihazı USB ile bağlayın, uygulamayı debuggable build ile çalıştırın.',
      'View → Tool Windows → App Inspection → Database Inspector.',
      'nesy DB\'yi seçip request tablosuna canlı SQL sorgusu çalıştırın.',
    ],
    commands: ["SELECT * FROM request WHERE isProcessing = 1 ORDER BY timeStamp;"],
    caveats: [
      'Yalnızca debuggable süreçlere bağlanır.',
      'API 26+ gerektirir.',
    ],
    tone: 'blue',
  },
  {
    id: 'release-blocked',
    name: 'Release APK — doğrudan erişim',
    tool: '—',
    requiresRoot: false,
    worksOnRelease: false,
    difficulty: 'blocked',
    summary:
      'Root\'suz, debuggable olmayan production cihazda sandbox\'a doğrudan erişim işletim sistemi tarafından engellenir. Bu durumda tek yol uygulama içi snapshot veya backend kayıtlarıdır.',
    steps: [
      'Uygulama içi snapshot (SaveTerminalRequestDbSnapshot) kullanın.',
      'Veya backend Graylog kayıtlarından requestName bazlı sorgulayın.',
      'Veya cihazı geçici olarak internal build ile flash\'layın.',
    ],
    commands: ['# adb run-as → "package not debuggable" (engelli)'],
    caveats: [
      'APK\'yi yeniden imzalayıp debuggable yapmak imza doğrulamasını bozar ve sertifika pinnini geçersiz kılar.',
    ],
    tone: 'red',
  },
]

// ---------------------------------------------------------------------------
// 2. request tablosu satırları (offline kuyruk anlık görüntüsü)
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
// 3. nesy Room DB tablo özeti (AppDatabase v240)
// ---------------------------------------------------------------------------

export const DB_TABLES: DbTableInfo[] = [
  { name: 'request', rowCount: 7, sizeKb: 34, description: 'Offline istek kuyruğu (gönderilmeyi bekleyen)', primaryKey: 'id (autoGenerate)' },
  { name: 'CompletedRequest', rowCount: 128, sizeKb: 512, description: 'Başarıyla gönderilmiş istek arşivi', primaryKey: 'id' },
  { name: 'Schedule', rowCount: 1, sizeKb: 96, description: 'Aktif günlük çizelge (body JSON)', primaryKey: 'id' },
  { name: 'Stop', rowCount: 18, sizeKb: 72, description: 'Çizelgedeki duraklar', primaryKey: 'stopId' },
  { name: 'Task', rowCount: 54, sizeKb: 210, description: 'Duraklardaki görevler', primaryKey: 'taskId' },
]

export const DB_META = {
  databaseName: 'nesy.db',
  version: 240,
  journalMode: 'WAL',
  path: '/data/data/com.arasdigital.nesymobile/databases/nesy.db',
  sizeMb: 3.4,
}
