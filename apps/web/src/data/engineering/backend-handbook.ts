// Backend Handbook — the mobile engineer's reference for the NESY backend estate.
// Extracted from the real NesyMobileArchive projects: NESY.APIGateway (KrakenD 2.11 +
// Go router plugin, configurations/Development.json = 73 endpoints) and the
// NESY.WebAPI .NET microservices solution (topic-based CQRS routing).
// Exemplar-first: TaskWebAPI, ShipmentWebAPI and Auth/Identity are fully documented;
// the remaining services are structural stubs awaiting a documentation pass.

import type { Tone } from '@/components/product'

export const HANDBOOK_SCAN_DATE = '18 Tem 2026'
export const HANDBOOK_GATEWAY_ENDPOINTS = 73

// ─── Gateway ────────────────────────────────────────────────────────────────

export const HANDBOOK_GATEWAY = {
  stack: 'KrakenD 2.11 + custom Go router plugin',
  pluginFile: 'NESY.APIGateway/router-plugin/plugin.go',
  configDir: 'NESY.APIGateway/configurations/*.json',
  envelope: 'BaseResponse { ResultCode: int, ResultMessage: string, Payload: object }',
  envelopeSource: 'shared/Nesy.Shared.Hosting.Microservices/Filters/RequestResponseActionFilter.cs',
  routes: [
    { pattern: 'POST /{Service}/{topic}', target: 'http://{service}-webapi-service/{Service}/{topic}', note: 'JSON body — topic = Operation sınıfındaki public metod adı, ilk parametre = request body' },
    { pattern: 'POST /{Service}/f/{topic}', target: 'aynı servis', note: 'multipart/form-data — IFormFile/IFormCollection alan metodlar' },
    { pattern: 'POST /ShipmentCache|CustomerCache|GeocodeCache/{topic}', target: 'ilgili servisin /Cache/{topic} yolu', note: 'Cache varyantları' },
    { pattern: 'POST identity-service/{controller}/{topic}', target: 'identity-webapi-service api/identity-service/…', note: 'Yeni ABP-style identity host (LoginMobile burada)' },
    { pattern: 'GET /{Service}/Info', target: 'servis health/topic-info', note: 'Sağlık ve topic envanteri' },
    { pattern: 'GET /OpenApi/{Service} · GET /docs', target: 'swagger.json + bundled swagger-ui', note: 'Sözleşme keşfi' },
  ],
  authPipeline: [
    { step: 'Bearer JWT doğrulama', detail: 'Authorization header → StripBearerPrefix → ExtractClaims; geçersizse 401 "Not valid JWT" (plugin.go checkAndFetch ~:251-363)' },
    { step: 'JTI blacklist', detail: 'Token jti’si, Kafka BlacklistJTI topic’inden beslenen TTL cache’e karşı kontrol edilir; eşleşirse 401 "Logout required, this session is expired."' },
    { step: 'X-Protected-Request-Key', detail: 'Korunan endpoint’lerde (helpers.IsProtectedEndpoint) RSA imzalı mobile request key doğrulanır (MobileKeyValidator) — username/appName/clientVersion çıkarılır' },
    { step: 'Versiyon kontrolü', detail: 'X-AppName + X-Client-Version canlı versiyon haritasıyla karşılaştırılır; şu an log-only (reject kodu yorum satırında)' },
  ],
  headers: [
    'Authorization', 'X-Protected-Request-Key', 'X-Client-Version', 'X-Device-Info',
    'X-AppName', 'X-Channel', 'X-Client-Request-Time', 'X-Correlation-Id', 'X-Timezone',
    'X-Error-Handling', 'Accept-Language',
  ],
  injected: 'Gateway downstream’e X-Service (= request path) enjekte eder, X-Forwarded-For korunur.',
  tenants:
    'Ülke/ortam başına ayrı config: ArasKargoProd (HR), ExpressoneBAProd, ExpressoneSIStaging, ExpressoneBGProd, CityexpressProd (RS), StarexAZProd, OverseasPreprod, SPSProd, TRProduction… (.public / .integration varyantları). Aynı endpoint’ler, farklı backend host’ları.',
  gaps: 'Dev config’de /Locker ve /TransferCenter top-level route YOK — Locker topic’lerine Shipment/Task üzerinden ulaşılır; TransferCenter henüz expose edilmemiş.',
}

// ─── Services ───────────────────────────────────────────────────────────────

export type HandbookTopic = {
  topic: string
  request?: string
  response?: string
  note?: string
  multipart?: boolean
  /** Kafka event consumer / callback — HTTP üzerinden mobil çağrısı değil. */
  eventDriven?: boolean
}

export type TopicGroup = {
  title: string
  /** Operation dosyası — archive köküne göre. */
  source?: string
  topics: HandbookTopic[]
}

export type HandbookService = {
  id: string
  name: string
  port?: number
  prefixes: string[]
  tone: Tone
  summary: string
  documented: boolean
  topicGroups?: TopicGroup[]
  notes?: string[]
}

export const HANDBOOK_SERVICES: HandbookService[] = [
  {
    id: 'task',
    name: 'TaskWebAPI',
    port: 5003,
    prefixes: ['Task'],
    tone: 'green',
    documented: true,
    summary:
      'Kurye iş akışının merkezi: schedule, stop, delivery, pickup, end-of-day, D4Me ve onay akışları. Mobilin en yoğun konuştuğu servis.',
    topicGroups: [
      {
        title: 'Schedule / route / stops',
        source: 'NESY.WebAPI/TaskWebAPI/Operations/TaskOperation.cs',
        topics: [
          { topic: 'GetMyScheduleByZoneCode', request: 'GetMyScheduleRequest', response: 'Schedule', note: 'Mobilin ana schedule kaynağı — protected endpoint' },
          { topic: 'GetTodaySelectedScheduleRouteList' },
          { topic: 'CheckHasCourierTodaySchedule' },
          { topic: 'GetBranchSchedulesByBranchId', request: 'GetBranchSchedulesByBranchIdFilter' },
          { topic: 'AddUserIdToSchedule / RemoveUserIdFromSchedule / ScheduleStatusChange' },
          { topic: 'OrderStopListFromTerminal', request: 'OrderStopListFromTerminalRequestModel' },
          { topic: 'ManuelMergeStopsInSchedule / ManuelSplitStopsInSchedule', request: 'ManuelMergeSplitStopsInScheduleRequest' },
          { topic: 'CourierRouteChange', request: 'CourierRouteChangeRequestModel' },
          { topic: 'DeleteStopFromSchedule', request: 'DeleteStopFromScheduleRequestModel' },
        ],
      },
      {
        title: 'Delivery',
        source: 'NESY.WebAPI/TaskWebAPI/Operations/TaskOperation.cs',
        topics: [
          { topic: 'DeliverParcelsV2', request: 'DeliveryModel', note: 'Birincil delivery-complete — mobil path "Task/DeliverParcels/" ile eşleşme doğrulanmalı (contract riski)' },
          { topic: 'DeliverParcelsFromParcelShop', request: 'DeliveryModel' },
          { topic: 'DeliverParcelsFromCounterLocation', request: 'CounterLocationDeliveryModel' },
          { topic: 'ForceDeliverParcels', request: 'ForceDeliveryModel' },
          { topic: 'DeliveryFailed', request: 'FailedDeliveryModel' },
          { topic: 'RejectDelivery / DropAtTheDoor / ConfirmConsigneeAtTheAddress', request: 'ConsigneeAtTheAddressModel' },
          { topic: 'MakeAnAppointment', request: 'AppointmentModel' },
          { topic: 'SaveDeliveryToNeighbourRequest', request: 'DeliveryToNeighbourModel' },
          { topic: 'UpdateRemarkText', request: 'DeliveryRemarkRequestModel' },
        ],
      },
      {
        title: 'Pickup',
        source: 'NESY.WebAPI/TaskWebAPI/Operations/TaskOperation.cs',
        topics: [
          { topic: 'PickupParcelToCourierVehicleV2', request: 'PickupParcelModel', note: 'Mobil path V2’siz — contract riski' },
          { topic: 'PickupFailed', request: 'FailedPickupModel' },
          { topic: 'GetPickupTaskList / GetDeliveryTaskList', request: 'GetTaskRequestModel' },
          { topic: 'GetPickupShipmenDetails', request: 'GetPickupShipmentDetailsRequest' },
          { topic: 'CreatePickupTask / UpdatePickupTask', request: 'PickupDocumentModel' },
          { topic: 'AssignPickupToCourier', request: 'UpdatePickupModel' },
          { topic: 'AssignMultiplePickupTask', request: 'List<PickupAssignModel>' },
        ],
      },
      {
        title: 'End-of-day & onay akışları',
        source: 'NESY.WebAPI/TaskWebAPI/Operations/TaskOperation.cs',
        topics: [
          { topic: 'RequestScheduleEndOfDay', request: 'EndOfDayReq' },
          { topic: 'ApproveScheduleEndOfDay', request: 'List<string>' },
          { topic: 'RejectScheduleEndOfDay', request: 'RejectEndOfDayModel' },
          { topic: 'RequestLeavingPermission / ApproveLeavingPermission / RejectLeavingPermission', note: 'Sahadan ayrılma izni iş akışı' },
          { topic: 'GetWaitingLeavingRequests', request: 'GetWaitingLeavingRequestsRequestModel' },
        ],
      },
      {
        title: 'D4Me',
        source: 'NESY.WebAPI/TaskWebAPI/Operations/TaskOperation.cs',
        topics: [
          { topic: 'GetD4MPrivateLocations', request: 'GetPrivateD4MeLocationsRequest' },
          { topic: 'CreateD4MReservation', request: 'D4MReservationRequestModel' },
          { topic: 'CompleteD4MShipments', request: 'D4MShipmentCompleteModel' },
          { topic: 'Direct4MeShipments_CallBack', request: 'D4MCallbackRequestModel', eventDriven: true },
        ],
      },
    ],
    notes: [
      'ETA hesaplaması TaskOperation.CalculateETA içinde — Routing servisinin duration matrix’ini kullanır.',
      'Aynı topic adı Shipment tarafında da olabilir (DeliveryFailed, PickupFailed) — kurye girişi Task, shipment-state event’i Shipment.',
    ],
  },
  {
    id: 'shipment',
    name: 'ShipmentWebAPI',
    port: 5013,
    prefixes: ['Shipment'],
    tone: 'orange',
    documented: true,
    summary:
      'En büyük servis: shipment çekirdeği, payment (RaiPay/WSPay/SoftPOS), fiscal, cash desk, locker event’leri, barkod ve fiyatlama.',
    topicGroups: [
      {
        title: 'Shipment çekirdeği',
        source: 'NESY.WebAPI/ShipmentWebAPI/Operations/ShipmentOperation.cs',
        topics: [
          { topic: 'SaveShipment / CheckAndSaveShipment / SaveOrder', request: 'ShipmentRequestModel' },
          { topic: 'SearchShipment', request: 'ShipmentSearchModel' },
          { topic: 'ShipmentTrackingPageListAsync', request: 'ShipmentTrackingPageRequestDto' },
          { topic: 'GetShipperCustomerByBarcode' },
          { topic: 'SetParcelScanTime', request: 'List<string>' },
          { topic: 'DeliverParcel / DeliveryFailed / DeliveryCancel', request: 'DeliveryModel', eventDriven: true, note: 'Task tarafındaki delivery’nin shipment-state karşılığı' },
          { topic: 'PickupParcels / ShipmentPickupFailed', request: 'PickupRequestModel', eventDriven: true },
        ],
      },
      {
        title: 'Payment',
        source: 'NESY.WebAPI/ShipmentWebAPI/Operations/PaymentOperation.cs',
        topics: [
          { topic: 'Inquiry', request: 'PaymentInquiryRequest', note: 'Payment initialize/inquiry' },
          { topic: 'Pay', request: 'PaymentConfirmationRequestModel', note: 'Confirm/collect' },
          { topic: 'GetShipmentCollectionStatus', request: 'CheckPaymentRequest' },
          { topic: 'CreatePaymentLinkForCOD', request: 'CreatePaymentLinkForCODRequestModel' },
          { topic: 'CreateSoftPosTransactionDocument', request: 'CreateSoftPosTransactionDocumentRequestModel' },
          { topic: 'WSPayCallback', request: 'WSPayCallbackRequestModel', eventDriven: true },
          { topic: 'SaveSignature', request: 'SaveSignatureRequestModel' },
          { topic: 'PaymentCollectOnDelivery', request: 'PaymentCollectOnDeliveryModel' },
        ],
      },
      {
        title: 'RaiPay (kart terminali)',
        source: 'NESY.WebAPI/ShipmentWebAPI/Operations/RaiPayPaymentOperation.cs',
        topics: [
          { topic: 'RaiPayAuthToken' },
          { topic: 'GetRaiPayPaymentToken', request: 'GetRaiPayPaymentTokenRequestModel' },
          { topic: 'GetRaiPayPaymentTokenStatus', note: 'Mobil polling’in nihai otoritesi' },
          { topic: 'GetPaymentReceipt' },
          { topic: 'RaipayBindMobileDeviceToPaymentTerminal', request: 'RaipayTerminalIdAndDeviceIdRequestModel', note: 'Mobil path "…MobilDevice…" yazıyor — yazım farkı contract riski' },
          { topic: 'RaipayPaymentTerminalRebinding / Unbinding / DeviceClose / MobileDeviceStatus', request: 'RaipayTerminalIdAndDeviceIdRequestModel' },
          { topic: 'RaiPayCallback', request: 'RaiPayCallbackRequestModel', eventDriven: true },
        ],
      },
      {
        title: 'Fiscal',
        source: 'NESY.WebAPI/ShipmentWebAPI/Operations/FiscalInvoiceOperation.cs',
        topics: [
          { topic: 'CreateFiscalInvoice', request: 'FiscalInvoiceRequestModel', response: 'FiscalInvoiceResponseModel', note: 'Balkan fiscalization (SDC)' },
          { topic: 'RetryFiscalInvoice' },
          { topic: 'RefundInvoice', request: 'RefundFiscalInvoiceRequestModel' },
          { topic: 'UpdateInvoice', request: 'UpdateFiscalInvoiceRequestModel' },
          { topic: 'GetFiscalInvoiceDetail' },
          { topic: 'GetFiscalZplJournal', request: 'GetFiscalZplJournalRequestModel', note: 'Yazıcı journal çıktısı' },
          { topic: 'FiscalCollectionOnDelivery', request: 'FiscalCollectOnDeliveryModel' },
        ],
      },
      {
        title: 'Cash desk / collection',
        source: 'NESY.WebAPI/ShipmentWebAPI/Operations/CashDeskOperations.cs',
        topics: [
          { topic: 'SaveCollectedShipmentListToCashDesk', request: 'SaveCollectedShipmentListToCashDeskRequestModel' },
          { topic: 'GetCollectedParcelList', request: 'GetCollectedParcelListRequestModel' },
          { topic: 'GetCollectedParcelsByCourier / …ByParcelShop' },
          { topic: 'ApproveCashDeskStatus / SetCollectedValues' },
          { topic: 'UpdateCodShipmentInfo', request: 'CODShipmentRequestModel' },
        ],
      },
      {
        title: 'Locker event’leri & barkod',
        source: 'ShipmentWebAPI/Operations/{LockerOperation,NPointOperation}.cs',
        topics: [
          { topic: 'SaveLockerEvent', request: 'SaveLockerEventModel' },
          { topic: 'ActiveLockerCounterLocations', request: 'GetLockerDeliveryPointsRequestModel' },
          { topic: 'GetLockerShipmentEvent' },
          { topic: 'SaveNoDataScanLog', request: 'NoDataScanLogRequest' },
          { topic: 'UpdateCustomerBarcodeOfParcel', request: 'UnloadModel' },
        ],
      },
    ],
    notes: [
      'SEPA/fiscal dönüştürücüler ülkeye özel: ShipmentWebAPI/Operations/SepaConverters/{HrSepaXmlConverter, SiSepaXmlConverter}.cs.',
      'Barkod üretimi BarcodeOperation.GenerateBarcode — internal helper, HTTP topic değil.',
    ],
  },
  {
    id: 'auth',
    name: 'UserWebAPI + IdentityService',
    port: 5001,
    prefixes: ['Auth', 'User', 'Role', 'Permission', 'identity-service'],
    tone: 'indigo',
    documented: true,
    summary:
      'İki paralel auth yolu: yeni ABP-style Nesy.IdentityService.Http.Host (LoginMobile/LoginDevice buradan) ve legacy UserWebAPI AuthOperation. Kullanıcı profili, cihaz, PIN, OTP, consent.',
    topicGroups: [
      {
        title: 'Login & token (IdentityService)',
        source: 'NESY.WebAPI/services/Nesy.IdentityService.Http.Host/Controllers/AuthController.cs',
        topics: [
          { topic: 'identity-service/Auth/LoginMobile', request: 'LoginRequestDto', response: 'LoginResponseDto', note: 'Mobil login — JWT döner' },
          { topic: 'identity-service/Auth/LoginDevice', request: 'LoginRequestDto', note: 'Cihaz/PIN girişi' },
          { topic: 'identity-service/Auth/Logout', note: 'JTI, Kafka BlacklistJTI topic’ine düşer → gateway cache' },
          { topic: 'identity-service/Auth/ForgotPassword', request: 'ForgotPasswordRequestDto' },
          { topic: 'identity-service/Auth/LoggedInUserChangeOwnPassword / LoggedOutUserChangePassword', request: 'LoggedOutUserChangePasswordDto' },
          { topic: 'identity-service/Role/GetCurrentUserMobileCachedPermissions', note: 'Drawer menü izin cache’i' },
        ],
      },
      {
        title: 'Legacy auth (UserWebAPI)',
        source: 'NESY.WebAPI/UserWebAPI/Operations/AuthOperation.cs',
        topics: [
          { topic: 'Auth/LoginAsync', request: 'LoginRequest' },
          { topic: 'Auth/ChangePasswordAsync', request: 'LoggedOutUserChangePasswordRequest' },
          { topic: 'Auth/CreateTokenByCourierUserId', request: 'UserDevicePinCodeRequestModel' },
          { topic: 'Auth/SsoLoginAsync / GetCustomerApiKeyTokenAsync' },
        ],
      },
      {
        title: 'Kullanıcı / cihaz / PIN / OTP / consent',
        source: 'UserWebAPI/Operations/{UserOperation,DriverOtpOperation,ConsentOperation}.cs',
        topics: [
          { topic: 'User/GetMyInfo / GetMyProfile / UpdateMyProfile', request: 'SetMyProfileDto' },
          { topic: 'User/f/SaveUserProfileImage', multipart: true },
          { topic: 'User/SetUserDeviceAsync / GetUserDevicesAsync', request: 'SetUserDeviceDto' },
          { topic: 'User/SetUserPinAsync / GetMyPinCode / GetUserDevicePinCode' },
          { topic: 'User/RequestOtpAsync / VerifyOtpAsync', request: 'DriverOtp*RequestModel', note: 'Sürücü OTP akışı' },
          { topic: 'User/CheckUserConsent / SaveUserConsent', note: 'KVKK consent' },
          { topic: 'User/UpdateCourierZoneAsync', request: 'UpdateUserCourierZoneRequest' },
          { topic: 'User/AskQuestionAsync', request: 'AskQuestionRequest' },
        ],
      },
    ],
    notes: [
      'Token üretimi IdentityService’te; gateway JWT claim’leri + JTI blacklist ile doğrular.',
      'İki auth yolunun birlikte yaşaması geçiş dönemi işareti — mobil login identity-service’i kullanır.',
    ],
  },
  // ── Stubs ──
  {
    id: 'history',
    name: 'HistoryWebAPI',
    port: 5004,
    prefixes: ['History'],
    tone: 'gray',
    documented: false,
    summary: 'Audit/history olayları; mobilin dead-letter diagnostiği (SaveTerminalFailedRequests, SaveTerminalRequestDbSnapshot) ve soru-cevap geçmişi buraya düşer.',
  },
  {
    id: 'tracking',
    name: 'TrackingWebAPI',
    port: 5005,
    prefixes: ['Tracking'],
    tone: 'blue',
    documented: false,
    summary: 'Kurye konumu (SaveCourierLocation), cihaz telemetrisi, delivery proof, tracking arama (SearchTrackingInfo → TrackingSearchResponse), GSM ile shipment listesi.',
  },
  {
    id: 'integration',
    name: 'IntegrationWebAPI',
    port: 5006,
    prefixes: ['Integration'],
    tone: 'gray',
    documented: false,
    summary: 'Dış sistem entegrasyonu, dosya import/export; mobilde waybill sorgulama (GetShipmentDetailByWaybillNumber) ve counter-location devri buradan geçer.',
  },
  {
    id: 'routing',
    name: 'RoutingWebAPI',
    port: 5007,
    prefixes: ['Routing'],
    tone: 'teal',
    documented: false,
    summary: 'Rota optimizasyonu ve ETA: RouteAsync/ManualRouteAsync/OptimizeRouteAsync (RoutingRequest → RoutingResponse), CalculateTotalDistance, GetDurationMatrix (Google + custom optimizer).',
  },
  {
    id: 'notification',
    name: 'Notification / Push / Viber / Sms / Email',
    prefixes: ['Notification', 'PushNotification', 'Viber', 'Sms', 'Email'],
    tone: 'gray',
    documented: false,
    summary: 'Mesajlaşma servisleri ailesi (portlar 5008-5012): bildirim dağıtımı, push, Viber, SMS, e-posta. Mobil remark mesajları Notification üzerinden akar.',
  },
  {
    id: 'eventtower',
    name: 'EventTowerWebAPI',
    port: 5011,
    prefixes: ['EventTower'],
    tone: 'gray',
    documented: false,
    summary: 'Event orkestrasyonu; mobil hub-companion event tip listesini (EventTower/GetEvents) buradan alır.',
  },
  {
    id: 'geocode',
    name: 'GeocodeWebAPI',
    port: 5015,
    prefixes: ['Geocode'],
    tone: 'gray',
    documented: false,
    summary: 'Geocoding: adres geocode güncelleme, hub lokasyonları (GetAllHubs/GetUserHub), auto-deps rota kontrolü. GeocodeCache route’u da var.',
  },
  {
    id: 'versioning',
    name: 'VersioningWebAPI',
    port: 5016,
    prefixes: ['Version'],
    tone: 'gray',
    documented: false,
    summary: 'Mobil versiyon / forced-update linkleri (GET /Version/LatestVersionsLink); gateway’in X-AppName/X-Client-Version kontrolünü besler.',
  },
  {
    id: 'customer',
    name: 'CustomerWebAPI',
    port: 5017,
    prefixes: ['Customer'],
    tone: 'gray',
    documented: false,
    summary: 'Müşteri, fiyatlama (CalculatePrice), adres defteri, müşteri tercihleri. CustomerCache route’u da var.',
  },
  {
    id: 'hubcompanion',
    name: 'HubCompanionWebAPI',
    port: 5018,
    prefixes: ['HubCompanion'],
    tone: 'teal',
    documented: false,
    summary: 'Hub tarama companion: ProcessAndLogEventParcelsAsync, GetShipmentEventHistory, GetLogsByUserName, f/SaveImage (multipart foto).',
  },
  {
    id: 'locker',
    name: 'LockerWebAPI',
    prefixes: ['(Shipment/Task üzerinden)'],
    tone: 'nesy',
    documented: false,
    summary: 'Parcel locker istasyonları: GetLockerStations, GetLockerBluetoothInfo, GetAvailableCompartment, Acknowledge* akışları, ReportIssue. Dev gateway’de top-level route’u yok — Shipment/Task path’leri üzerinden erişilir.',
  },
  {
    id: 'other',
    name: 'Eurodis · Document · TransferCenter',
    prefixes: ['Eurodis', 'Document'],
    tone: 'gray',
    documented: false,
    summary: 'Eurodis (5014, cross-border network), Document (PDF üretimi), TransferCenter (linehaul trip/sürücü/araç/protokol — dev gateway’de henüz expose edilmemiş).',
  },
]

// ─── Key models ─────────────────────────────────────────────────────────────

export type ModelField = { name: string; type?: string; desc?: string }

export type HandbookModel = {
  name: string
  file: string
  desc: string
  fields: ModelField[]
}

export const HANDBOOK_MODELS: HandbookModel[] = [
  {
    name: 'BaseResponse (envelope)',
    file: 'shared/Nesy.Shared.Hosting.Microservices/Filters/RequestResponseActionFilter.cs',
    desc: 'Tüm servislerin standart cevap zarfı — gateway RejectResponse da aynı şekli taklit eder. Mobil BaseResponse modeli buna karşılık gelir.',
    fields: [
      { name: 'ResultCode', type: 'int', desc: 'İş sonucu kodu — HTTP 200 olsa bile hata taşıyabilir' },
      { name: 'ResultMessage', type: 'string', desc: 'İnsan-okur mesaj (lokalize olabilir)' },
      { name: 'Payload', type: 'object', desc: 'Asıl cevap gövdesi — endpoint’e göre tip değişir' },
    ],
  },
  {
    name: 'LoginRequestDto / LoginResponseDto',
    file: 'services/Nesy.IdentityService.Http.Host/Application/Contracts/Dtos/Auth/',
    desc: 'Mobil login sözleşmesi. Legacy LoginRequest (Adx.Nesy.Shared…/Auth) ek olarak CaptchaToken taşır.',
    fields: [
      { name: 'Username / Password', type: 'string', desc: 'Kimlik bilgileri' },
      { name: 'DeviceCode / PinCode', type: 'string', desc: 'Cihaz girişi varyantı' },
      { name: 'PushRegistrationId', type: 'string', desc: 'Push kaydı' },
      { name: 'ChannelVersion', type: 'string', desc: 'Uygulama sürümü' },
      { name: '→ Token', type: 'string', desc: 'JWT — mobil SP.token’a yazar' },
      { name: '→ User', type: 'object', desc: 'Username, FullName, Role, BranchId, HubName, CourierZone, CashRegisterKey…' },
    ],
  },
  {
    name: 'DeliveryModel',
    file: 'Adx.Nesy.Shared.Hosting.Microservices/Shipment/DeliveryModel.cs',
    desc: 'Delivery-complete payload’u (DeliverParcelsV2). Mobil DeliveryReq bu sözleşmeye map olur — alan bazlı doğrulama contract review’un konusu.',
    fields: [
      { name: 'ShipmentIds', type: 'List<string>', desc: 'Teslim edilen gönderiler' },
      { name: 'AffinityType / PartyName / IdentityNumber', desc: 'Teslim alan kişi bilgisi' },
      { name: 'DeliveryCode', desc: 'Teslimat nedeni/kodu' },
      { name: 'CashOnDelivery', type: 'decimal', desc: 'COD tutarı' },
      { name: 'CollectionType', desc: 'Ödeme rayı — mobilde None kurtarma savunması var' },
      { name: 'SignatureUrl', desc: 'İmza referansı' },
      { name: 'FiscalIdentityNumber', desc: 'Fiscal bağlantısı' },
      { name: 'ScheduleId / CourierName / OOHId', desc: 'Operasyon bağlamı' },
      { name: 'CollectedByCourier / ShouldCallPaymentCollectOnDeliveryMethod', type: 'bool', desc: 'Tahsilat davranış bayrakları' },
    ],
  },
  {
    name: 'PaymentInquiryRequest / PaymentConfirmationRequestModel',
    file: 'ShipmentWebAPI/Models/Payment/',
    desc: 'Payment initialize (Inquiry) ve confirm (Pay) sözleşmeleri — WSPay/kart akışı alanları.',
    fields: [
      { name: 'ShoppingCartId', desc: 'Ödeme oturumu kimliği' },
      { name: 'OrganizationCode / Status / Signature', desc: 'Inquiry alanları' },
      { name: 'PaymentType / PaymentPlan', desc: 'Confirm — ödeme tipi' },
      { name: 'AprovalCode / WsPayOrderId / STAN', desc: 'Provider referansları' },
      { name: 'Amount / InitialAmount', type: 'decimal', desc: 'Tutarlar' },
      { name: 'MaskedPan / ExpirationDate', desc: 'Maskeli kart bilgisi — asla düz PAN taşınmaz' },
    ],
  },
  {
    name: 'FiscalInvoiceRequestModel / FiscalInvoiceResponseModel',
    file: 'ShipmentWebAPI/Models/FiscalInvoice/CreateFiscalInvoiceModels.cs',
    desc: 'Balkan fiscalization (SDC) sözleşmesi. Response mobilde Room FiscalInvoiceData’ya yazılır.',
    fields: [
      { name: 'Cashier / InvoiceType / TransactionType', desc: 'Fiş başlığı (int enum’lar)' },
      { name: 'ReferentDocumentNumber / BuyerId', desc: 'Referans ve alıcı' },
      { name: 'Payment[]', type: 'List<FiscalPaymentModel>', desc: '{ Amount, PaymentType }' },
      { name: 'Items[]', type: 'List<FiscalPaymentItemModel>', desc: '{ Name, Quantity, Labels, UnitPrice, TotalAmount }' },
      { name: '→ InvoiceNumber / InvoiceCounter', desc: 'SDC fiş kimliği' },
      { name: '→ SdcDateTime', desc: 'Fiscal cihaz zamanı — cihaz saatiyle karıştırılmamalı' },
      { name: '→ VerificationUrl / VerificationQRCode / Journal / Signature', desc: 'Doğrulama ve yazıcı çıktısı' },
      { name: '→ TaxItems / TotalAmount / BusinessName / Tin', desc: 'Vergi kalemleri ve işletme bilgisi' },
    ],
  },
]

// ─── Conventions / guardrails ───────────────────────────────────────────────

export const HANDBOOK_CONVENTIONS: { title: string; body: string; tone: Tone }[] = [
  {
    title: 'Topic = metod adı',
    body: 'Bir servisin tam topic listesi için Operations/*.cs içinde public Task metodlarına bakılır — metod adı path segmenti, ilk parametre tipi request body’dir. /{Service}/Info ve /OpenApi/{Service} canlı envanter verir.',
    tone: 'blue',
  },
  {
    title: 'Her public metod HTTP topic değildir',
    body: 'ShipmentDocument/ScheduleDocument parametresi alan veya _Callback ile biten metodlar tipik olarak Kafka event consumer’ıdır — mobil bunları çağırmaz. Handbook’ta bunlar "event" rozetiyle işaretlidir.',
    tone: 'amber',
  },
  {
    title: 'Aynı topic ≠ aynı servis',
    body: 'DeliveryFailed hem Task hem Shipment’ta var. Path prefix’i belirleyicidir: kurye girişi TaskWebAPI, shipment-state event’i ShipmentWebAPI. Mobil her zaman Task tarafını çağırır.',
    tone: 'red',
  },
  {
    title: 'Ülke davranışı config-driven',
    body: 'Aynı endpoint seti tüm tenant’larda geçerlidir; fark gateway config’i (host/backend) ve ülkeye özel converter’lardadır (Hr/SiSepaXmlConverter, fiscal kuralları). Endpoint davranış farkı ararken önce tenant config’ine bakın.',
    tone: 'teal',
  },
]
