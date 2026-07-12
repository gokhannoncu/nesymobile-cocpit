// Backend Handbook — domain kayıtları.
// payment-fiscal tam belgelendirilmiş örnek (exemplar); diğer domain'ler
// yapısal stub olarak tutulur ve zamanla doldurulur.

import type { BackendDomain } from './types'

const PAYMENT_FISCAL: BackendDomain = {
  slug: 'payment-fiscal',
  title: 'Payment & Fiscal',
  subtitle: 'Mobil ödeme, tahsilat sonucu, fiscal kayıt ve delivery state ilişkisi',
  tone: 'green',
  documented: true,
  meta: {
    owner: 'Payment Team',
    reviewer: 'Backend Guild',
    version: '8.4.60+',
    countries: ['HR', 'BA', 'SI', 'RS'],
    lastVerified: '10 Tem 2026',
    nextReview: '10 Eyl 2026',
    status: 'approved',
  },
  purpose:
    'Payment domain’i shipment için tahsilat sonucunu alır, ödeme durumunu operasyonel state’e bağlar ve ülkeye göre fiscal kayıt akışını tetikler. Fiscal ve delivery adımları atomik değildir; recovery kuralları bu domain tarafından tanımlanır.',
  whenUsed: [
    'Delivery onayı sırasında ödeme türü seçimi',
    'POS / SoftPOS üzerinden kart tahsilatı',
    'Cash / COD tahsilat seçimi',
    'Ülke kuralına göre fiscal belge oluşturma',
    'Başarısız ödeme sonrası payment retry',
    'Partial success sonrası delivery recovery',
  ],
  flow: [
    { id: 'f1', label: 'Delivery Screen', tone: 'blue', detail: 'Courier teslimatı başlatır; shipment state uygunsa Payment Selection açılır.' },
    { id: 'f2', label: 'Payment Selection', tone: 'indigo', detail: 'COD shipment ise ödeme türü seçilir (POS / Cash / SoftPOS).' },
    { id: 'f3', label: 'POS / Cash / SoftPOS', tone: 'teal', detail: 'Ülkeye göre WSPay (HR) veya RaiPay (RS) provider’ı çağrılır.' },
    { id: 'f4', label: 'Payment Result', tone: 'green', detail: 'POST /shipment/payment sonucu SharedViewModel’e yazılır.' },
    { id: 'f5', label: 'Fiscal Creation', tone: 'amber', detail: 'Fiscal zorunlu ülkelerde POST /fiscal/create tetiklenir (offline değil).' },
    { id: 'f6', label: 'Delivery Save', tone: 'blue', detail: 'POST /delivery/complete ile teslimat kapatılır; offline destekli.' },
    { id: 'f7', label: 'Offline Queue / Backend Confirmation', tone: 'orange', detail: 'Bağlantı yoksa RequestSenderService kuyruğuna alınır.' },
  ],
  endpoints: [
    {
      method: 'POST',
      path: '/shipment/payment',
      usage: 'Ödeme sonucunu kaydeder',
      criticalFields: ['shipmentId', 'amount', 'paymentType'],
      offline: 'partial',
      purpose: 'Bir shipment için tahsilat sonucunu (tutar, tür, provider referansı) backend’e bildirir ve payment state’ini günceller.',
      request:
        '{\n  "shipmentId": "SHP-88213",\n  "amount": 24.90,\n  "currency": "EUR",\n  "paymentType": "POS",\n  "providerRef": "WSPAY-7781"\n}',
      successResponse:
        '{\n  "status": "PAID",\n  "paymentId": "PMT-55120",\n  "fiscalRequired": true\n}',
      errorResponse:
        '{\n  "error": "PAYMENT_DECLINED",\n  "code": "E14",\n  "retryable": true\n}',
      mobileMapping: 'status → SharedViewModel.paymentStatus; fiscalRequired true ise Fiscal Creation adımı çağrılır.',
      errorCodes: [
        { code: 'E14', meaning: 'Kart reddedildi — retry edilebilir' },
        { code: 'E21', meaning: 'Provider timeout — duplicate riski' },
        { code: '401', meaning: 'Session expired — re-auth gerekir' },
      ],
      caller: 'SharedViewModel.submitPayment()',
      retry: 'Kullanıcı tetiklemeli; otomatik retry yok (duplicate riski).',
      idempotency: 'providerRef alanı ile zayıf idempotency; backend tarafında garanti edilmez.',
      timeout: '30s (POS provider callback dahil)',
      relatedScreens: ['payment-selection', 'delivery'],
      graylog: 'app:nesy-mobile AND msg:"payment" AND shipmentId:SHP-*',
      mongo: 'db.payments.find({ shipmentId: "SHP-88213" })',
    },
    {
      method: 'POST',
      path: '/fiscal/create',
      usage: 'Fiscal kayıt oluşturur',
      criticalFields: ['fiscalId', 'paymentType', 'amount'],
      offline: 'no',
      purpose: 'Ülke fiscal otoritesine belge kaydı oluşturur. Offline desteklenmez — bağlantı zorunludur.',
      request:
        '{\n  "paymentId": "PMT-55120",\n  "paymentType": "POS",\n  "amount": 24.90\n}',
      successResponse: '{\n  "fiscalId": "FIS-99001",\n  "jir": "a1b2...",\n  "zki": "c3d4..."\n}',
      errorResponse: '{\n  "error": "FISCAL_TIMEOUT",\n  "code": "E28"\n}',
      mobileMapping: 'fiscalId → FiscalInvoiceData (Room); başarısızsa recovery kuyruğuna değil, kullanıcı uyarısına gider.',
      errorCodes: [
        { code: 'E28', meaning: 'Orphan fiscal invoice — payment var, fiscal yok' },
        { code: 'E29', meaning: 'Printer bağlantısı yok' },
      ],
      caller: 'FiscalService.create()',
      retry: 'Kontrollü retry (yalnızca HR/RS); manuel recovery.',
      idempotency: 'paymentId bazlı; backend duplicate’i reddeder.',
      timeout: '20s',
      relatedScreens: ['fiscal-result', 'receipt'],
      graylog: 'app:nesy-mobile AND msg:"fiscal" AND code:E28',
      mongo: 'db.fiscalInvoices.find({ paymentId: "PMT-55120" })',
    },
    {
      method: 'POST',
      path: '/delivery/complete',
      usage: 'Teslimatı tamamlar',
      criticalFields: ['shipmentId', 'event'],
      offline: 'yes',
      purpose: 'Teslimat sonucunu operasyonel state’e işler. Offline üretilip kuyruğa alınabilir.',
      request: '{\n  "shipmentId": "SHP-88213",\n  "event": "DELIVERED",\n  "signature": "base64..."\n}',
      successResponse: '{\n  "status": "DELIVERED",\n  "stateVersion": 240\n}',
      errorResponse: '{\n  "error": "STATE_CONFLICT",\n  "code": "E1"\n}',
      mobileMapping: 'status → schedule chunk güncellenir; offline ise RequestSenderService kuyruğu.',
      errorCodes: [{ code: 'E1', meaning: 'Push refresh çakışması — son yazan kazanır' }],
      caller: 'DeliveryFragment.completeDelivery()',
      retry: 'Offline queue otomatik retry eder.',
      idempotency: 'shipmentId + event; tekrar gönderim tolere edilir.',
      timeout: '15s',
      relatedScreens: ['delivery', 'delivery-failed'],
      graylog: 'app:nesy-mobile AND msg:"delivery/complete"',
      mongo: 'db.shipments.find({ shipmentId: "SHP-88213" })',
    },
    {
      method: 'GET',
      path: '/shipment/{id}',
      usage: 'Güncel state’i getirir',
      criticalFields: ['status', 'payment'],
      offline: 'no',
      purpose: 'Bir shipment’ın backend’deki güncel durumunu ve ödeme özetini döner.',
      request: 'GET /shipment/SHP-88213',
      successResponse: '{\n  "status": "DELIVERED",\n  "payment": { "status": "PAID" }\n}',
      mobileMapping: 'Recovery ve reconciliation ekranlarında authoritative kaynak olarak kullanılır.',
      caller: 'ShipmentRepository.refresh()',
      retry: 'Serbest — read-only.',
      idempotency: 'N/A (GET)',
      timeout: '10s',
      relatedScreens: ['shipment-detail'],
    },
  ],
  callers: [
    { feature: 'Delivery', classMethod: 'DeliveryFragment', screen: 'Delivery', note: 'Ana teslim akışı' },
    { feature: 'Payment', classMethod: 'SharedViewModel', screen: 'Payment dialog', note: 'Sonuç state’i' },
    { feature: 'Offline', classMethod: 'RequestSenderService', screen: 'Background', note: 'Retry kuyruğu' },
  ],
  lineage: [
    { label: 'Backend Shipment', level: 'authoritative' },
    { label: 'API Response', level: 'authoritative' },
    { label: 'SharedViewModel', level: 'operational' },
    { label: 'Room / Schedule Chunk', level: 'cached' },
    { label: 'Delivery UI', level: 'temporary' },
    { label: 'Offline Request Queue', level: 'operational' },
  ],
  errors: [
    {
      id: 'err-401',
      title: '401 / Session Expired',
      tone: 'red',
      rows: [
        { label: 'Mobil ne yapar?', value: 'Token yenileme dener; başarısızsa Login ekranına yönlendirir.' },
        { label: 'Kullanıcı ne görür?', value: '“Oturum süresi doldu” uyarısı ve yeniden giriş ekranı.' },
        { label: 'Offline queue’ya ne olur?', value: 'Kuyruk korunur; auth sonrası tekrar denenir.' },
        { label: 'Nasıl araştırılır?', value: 'Graylog’da 401 + shipmentId zaman aralığına bakılır.' },
        { label: 'Graylog', value: 'app:nesy-mobile AND status:401' },
      ],
    },
    {
      id: 'err-timeout',
      title: 'Timeout',
      tone: 'amber',
      rows: [
        { label: 'Request tekrar gönderilir mi?', value: 'Payment için hayır (duplicate riski); delivery için evet.' },
        { label: 'Backend tamamlamış olabilir mi?', value: 'Evet — POS callback sonrası tamamlanmış olabilir.' },
        { label: 'Duplicate riski', value: 'providerRef zayıf idempotency; çift tahsilat mümkün.' },
      ],
    },
    {
      id: 'err-partial',
      title: 'Partial Success',
      tone: 'orange',
      rows: [
        { label: 'Payment OK, delivery fail', value: 'Delivery kuyruğa alınır; payment korunur.' },
        { label: 'Fiscal OK, shipment fail', value: 'Orphan fiscal invoice (E28) — reconciliation gerekir.' },
        { label: 'Recovery nasıl?', value: 'GET /shipment/{id} ile authoritative state alınır, fark kapatılır.' },
      ],
    },
  ],
  countryDiffs: [
    { behaviour: 'Fiscal zorunlu', values: { HR: 'Evet', BA: 'Kısmi', SI: 'Hayır', RS: 'Evet' } },
    { behaviour: 'POS provider', values: { HR: 'WSPay', BA: '—', SI: '—', RS: 'RaiPay' } },
    { behaviour: 'Offline delivery', values: { HR: 'Evet', BA: 'Evet', SI: 'Evet', RS: 'Evet' } },
    { behaviour: 'Fiscal retry', values: { HR: 'Kontrollü', BA: '—', SI: '—', RS: 'Kontrollü' } },
  ],
  investigation: [
    { label: 'MongoDB Query Generator’da aç', tool: 'MongoDB', href: '/engineering/tools/mongodb-query-generator' },
    { label: 'Graylog Query Generator’da aç', tool: 'Graylog', href: '/engineering/tools/graylog-query-generator' },
    { label: 'Data Locator’da kaynağı bul', tool: 'Data Locator', href: '/engineering/tools/data-locator' },
    { label: 'İlgili incident’leri görüntüle', tool: 'Incidents', href: '/engineering/incident-playbook' },
    { label: 'İlgili edge case’leri görüntüle', tool: 'Edge Cases', href: '/engineering/edge-case-map' },
  ],
  risks: [
    'Payment state memory’de kalabilir (process restart’ta kayıp).',
    'Fiscal ve delivery atomik değil — partial success mümkün.',
    'Duplicate callback riski (POS provider).',
    'Retry idempotency eksik — çift tahsilat.',
  ],
  changes: [
    { version: 'v8.4.60', note: 'RaiPay callback mapping güncellendi.' },
    { version: 'v8.4.40', note: 'Fiscal recovery akışı eklendi.' },
    { version: 'v8.3.90', note: 'Payment result Room’a taşındı.' },
  ],
}

/** Stub domain üretici — henüz tam belgelenmemiş domain'ler için. */
function stub(
  slug: string,
  title: string,
  subtitle: string,
  tone: BackendDomain['tone'],
  owner: string,
  purpose: string,
): BackendDomain {
  return {
    slug,
    title,
    subtitle,
    tone,
    documented: false,
    meta: {
      owner,
      version: '8.4.60+',
      countries: ['HR', 'BA', 'SI', 'RS'],
      lastVerified: '—',
      status: 'draft',
    },
    purpose,
    whenUsed: [],
  }
}

export const BACKEND_DOMAINS: BackendDomain[] = [
  stub('system-overview', 'System Overview', 'Mobil ↔ backend topolojisi ve servis haritası', 'indigo', 'Architecture Guild', 'Mobil uygulamanın hangi servislerle konuştuğunu ve veri akışının üst seviye topolojisini özetler.'),
  stub('authentication', 'Authentication & Session', 'Token, host seçimi ve oturum yönetimi', 'red', 'Platform Team', 'Login, token yenileme, host seçimi ve 401 davranışının backend sözleşmesi.'),
  stub('schedule', 'Schedule', 'Günlük plan, chunk yapısı ve yenileme', 'blue', 'Schedule Team', 'Courier’ın günlük planının nasıl indirildiği, chunk’landığı ve yenilendiği.'),
  stub('stops-shipments', 'Stops & Shipments', 'Durak ve gönderi state modeli', 'teal', 'Operations Backend', 'Stop List ve shipment state geçişlerinin backend kaynağı.'),
  stub('tour-delivery', 'Tour & Delivery', 'Tur yönetimi ve teslimat state’leri', 'blue', 'Delivery Team', 'Tur başlatma, teslimat event zinciri ve state save davranışı.'),
  PAYMENT_FISCAL,
  stub('offline-sync', 'Offline Sync', 'RequestSenderService kuyruk ve retry', 'orange', 'Platform Team', 'Offline üretilen request’lerin kuyruklanması, retry ve zombie processing davranışı.'),
  stub('notifications', 'Notifications', 'FCM push ve refresh tetikleyicileri', 'purple', 'Platform Team', 'Push mesajlarının şeması ve schedule refresh tetikleme davranışı.'),
  stub('barcode-scan', 'Barcode & Scan', 'Çoklu giriş kanalı ve dedup', 'amber', 'Mobile Core', 'Barkod okuma kanalları, eşleştirme ve dedup state’i.'),
  stub('d4me-locker', 'D4Me & Locker', 'Locker teslimatı ve D4Me akışı', 'teal', 'Delivery Team', 'Locker teslimat akışı, kapı açma ve doğrulama sözleşmeleri.'),
  stub('location', 'Location', 'GPS örnekleme ve batch upload', 'green', 'Platform Team', 'Konum örnekleme, batch upload ve izin davranışı.'),
  stub('country-config', 'Country Configurations', 'Ülkeye göre davranış farkları', 'indigo', 'Product Backend', 'Ülke bazlı feature flag ve konfigürasyon yükleme sözleşmesi.'),
  stub('error-model', 'Error Model', 'Standart hata kodları ve mapping', 'red', 'Backend Guild', 'Backend hata modelinin mobil tarafındaki standart karşılıkları.'),
  stub('investigation-recipes', 'Common Investigation Recipes', 'Sık kullanılan araştırma reçeteleri', 'gray', 'SRE', 'Sık karşılaşılan olaylar için hazır Graylog / MongoDB sorgu reçeteleri.'),
]

export function getBackendDomain(slug: string): BackendDomain | undefined {
  return BACKEND_DOMAINS.find((d) => d.slug === slug)
}
