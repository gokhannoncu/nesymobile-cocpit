// Screen Manual — ekran kayıtları.
// delivery ve delivery-failed tam belgelendirilmiş örnek; diğerleri stub.

import type { Screen, ScreenGroup } from './types'

const DELIVERY: Screen = {
  slug: 'delivery',
  title: 'Delivery',
  subtitle: 'Shipment’ın teslim edilmesi, ödeme seçimi ve teslimat sonucunun kaydedilmesi',
  group: 'shipment-operations',
  tone: 'teal',
  documented: true,
  roles: ['Courier'],
  meta: {
    owner: 'Mobile Delivery',
    reviewer: 'QA Guild',
    version: '8.4.60+',
    countries: ['HR', 'BA', 'SI', 'RS'],
    lastVerified: '10 Tem 2026',
    nextReview: '10 Eyl 2026',
    status: 'approved',
  },
  purpose:
    'Delivery ekranı, courier’ın shipment’ı alıcıya teslim etmesini, ödeme türünü seçmesini ve teslimat sonucunu kaydetmesini sağlar.',
  entryFlow: ['Route Selection', 'Stop List', 'Shipment Detail', 'Delivery'],
  hotspots: [
    { num: 1, label: 'Shipment bilgileri', desc: 'Gönderi numarası, ağırlık ve içerik özeti.', x: 50, y: 12 },
    { num: 2, label: 'Recipient bilgileri', desc: 'Alıcı adı, adres ve iletişim.', x: 50, y: 30 },
    { num: 3, label: 'Payment türü', desc: 'COD shipment ise POS / Cash / SoftPOS seçimi.', x: 50, y: 48 },
    { num: 4, label: 'Delivery result', desc: 'Teslim edildi / edilemedi sonucu.', x: 30, y: 64 },
    { num: 5, label: 'Signature / photo', desc: 'Ülke kuralına göre imza veya fotoğraf kanıtı.', x: 70, y: 64 },
    { num: 6, label: 'Complete delivery', desc: 'Zorunlu alanlar dolduğunda teslimatı kaydeder.', x: 50, y: 88 },
  ],
  steps: [
    { title: 'Shipment bilgilerini doğrula', user: 'Barkodu okutur / bilgileri kontrol eder.', system: 'Shipment state’ini ve eşleşmeyi doğrular.', blockedWhen: 'Barkod eşleşmiyorsa.', error: 'E-SCAN mismatch uyarısı.' },
    { title: 'Teslimat sonucunu seç', user: 'Delivered / Failed seçer.', system: 'Uygun alt akışı açar (payment ya da reason).' },
    { title: 'Gerekliyse ödeme türünü seç', user: 'COD ise POS / Cash seçer.', system: 'Provider’ı çağırır, sonucu bekler.', blockedWhen: 'Ödeme reddedilirse.', error: 'E14 Payment declined.' },
    { title: 'İmza veya kanıt ekle', user: 'İmza alır ya da fotoğraf çeker.', system: 'Ülke kuralına göre zorunluluk uygular.' },
    { title: 'Teslimatı tamamla', user: 'Complete’e basar.', system: 'POST /delivery/complete çağrılır ya da kuyruğa alınır.' },
    { title: 'Sonuç ekranını kontrol et', user: 'Onay / hata mesajını görür.', system: 'Fiscal fiş basımı ve state güncellemesini yansıtır.' },
  ],
  buttons: [
    { element: 'Deliver', purpose: 'Teslimat akışını başlatır', activeWhen: 'Shipment uygun durumdaysa' },
    { element: 'Payment Type', purpose: 'Ödeme türünü seçer', activeWhen: 'COD shipment ise' },
    { element: 'Signature', purpose: 'İmza alır', activeWhen: 'Ülke kuralı gerektiriyorsa' },
    { element: 'Complete', purpose: 'İşlemi kaydeder', activeWhen: 'Zorunlu alanlar doluysa' },
  ],
  commonProblems: [
    { id: 'p1', title: 'Barkod eşleşmiyor', tone: 'amber', rows: [
      { label: 'Yapılacak', value: 'Shipment numarasını manuel doğrula, tekrar okut.' },
      { label: 'Yapılmayacak', value: 'Farklı shipment’ı zorla teslim etme.' },
      { label: 'Support’a ilet', value: 'Shipment ID + tarama zamanı.' },
    ]},
    { id: 'p2', title: 'Payment tamamlandı ama ekran ilerlemedi', tone: 'red', rows: [
      { label: 'Yapılacak', value: 'Bekle, tekrar tahsilat başlatma; sonuç ekranını kontrol et.' },
      { label: 'Yapılmayacak', value: 'Ödemeyi ikinci kez alma (duplicate riski).' },
      { label: 'Incident kriteri', value: 'Backend’de PAID ama ekran hâlâ pending ise.' },
    ]},
    { id: 'p3', title: 'Fiscal fiş basılmadı', tone: 'orange', rows: [
      { label: 'Yapılacak', value: 'Fiscal Result ekranından yeniden dene.' },
      { label: 'Support’a ilet', value: 'paymentId + fiscal hata kodu (E28/E29).' },
    ]},
    { id: 'p4', title: 'Shipment listeden kayboldu', tone: 'blue', rows: [
      { label: 'Neden', value: 'Push refresh chunk’ı üzerine yazmış olabilir.' },
      { label: 'Yapılacak', value: 'Schedule’ı yenile; GET /shipment/{id} ile doğrula.' },
    ]},
  ],
  does: ['Teslimat sonucunu alır', 'Payment/fiscal akışını başlatır', 'Offline request oluşturabilir'],
  dont: ['Backend payment kaydını tek başına doğrulamaz', 'Fiscal uyumluluğunu garanti etmez', 'Offline queue’nun işlendiğini anında garanti etmez'],
  architecture: [
    { label: 'Fragment', value: 'DeliveryFragment' },
    { label: 'ViewModel', value: 'SharedViewModel' },
    { label: 'Repository', value: 'ShipmentRepository' },
    { label: 'API service', value: 'DeliveryApi, PaymentApi, FiscalApi' },
    { label: 'Room tables', value: 'shipments, payments, fiscalInvoices, requestQueue' },
    { label: 'Navigation', value: '/delivery/{shipmentId}' },
  ],
  entryConditions: ['currentTask mevcut olmalı', 'Shipment state uygun olmalı', 'Country configuration yüklenmiş olmalı', 'Schedule aktif olmalı'],
  localState: [
    { state: 'currentTask', source: 'SharedViewModel', persistence: 'Memory', risk: 'Process restart’ta kayıp' },
    { state: 'paymentStatus', source: 'Room / memory', persistence: 'Kısmi', risk: 'Ayrışma (memory ≠ Room)' },
    { state: 'deliveryForm', source: 'Fragment', persistence: 'Screen lifecycle', risk: 'Rotation’da sıfırlanma' },
    { state: 'offlineRequest', source: 'Room', persistence: 'Kalıcı', risk: 'Zombie processing' },
  ],
  backendCalls: [
    { action: 'Complete delivery', endpoint: 'POST /delivery/complete', success: 'State güncellenir', failure: 'Queue’ya alınır' },
    { action: 'Payment', endpoint: 'POST /shipment/payment', success: 'Payment kaydı', failure: 'Retry riski' },
    { action: 'Fiscal', endpoint: 'POST /fiscal/create', success: 'Invoice oluşturulur', failure: 'Recovery gerekir' },
  ],
  eventChain: [
    { id: 'e1', label: 'Button Click', tone: 'blue' },
    { id: 'e2', label: 'Form Validation', tone: 'indigo' },
    { id: 'e3', label: 'Payment', tone: 'teal' },
    { id: 'e4', label: 'Fiscal', tone: 'amber' },
    { id: 'e5', label: 'Delivery API', tone: 'green' },
    { id: 'e6', label: 'Room Update', tone: 'blue' },
    { id: 'e7', label: 'Navigation', tone: 'purple' },
    { id: 'e8', label: 'Offline / Retry / Process death dalları', tone: 'orange', branch: true },
  ],
  validation: ['Mandatory fields (result, signature)', 'Country-specific rules (fiscal/signature)', 'Shipment status uygunluğu', 'Payment amount doğrulama', 'Barcode matching'],
  analytics: [
    { event: 'delivery_opened', trigger: 'Screen opened', params: 'country, shipment' },
    { event: 'payment_started', trigger: 'Payment selected', params: 'provider, amount' },
    { event: 'delivery_completed', trigger: 'Success', params: 'duration, offline' },
    { event: 'delivery_failed', trigger: 'Failure', params: 'reason, errorCode' },
  ],
  tests: ['Happy path', 'Offline', 'Process kill', 'Rotation', 'Double tap', 'Payment partial success', 'Fiscal failure', 'Retry', 'Backend cancel', 'Out-of-order response'],
  related: [
    { label: 'Payment & Fiscal (Backend Handbook)', href: '/engineering/mobile-knowledge/backend/payment-fiscal' },
    { label: 'Edge Case Map', href: '/engineering/edge-case-map' },
    { label: 'Incident Command Center', href: '/engineering/incident-playbook' },
    { label: 'Graylog Query Generator', href: '/engineering/tools/graylog-query-generator' },
  ],
}

const DELIVERY_FAILED: Screen = {
  slug: 'delivery-failed',
  title: 'Delivery Failed',
  subtitle: 'Başarısız teslimat nedeninin seçilmesi ve kaydedilmesi',
  group: 'shipment-operations',
  tone: 'red',
  documented: true,
  roles: ['Courier'],
  meta: {
    owner: 'Mobile Delivery',
    reviewer: 'QA Guild',
    version: '8.4.60+',
    countries: ['HR', 'BA', 'SI', 'RS'],
    lastVerified: '08 Tem 2026',
    nextReview: '08 Eyl 2026',
    status: 'approved',
  },
  purpose:
    'Delivery Failed ekranı, teslim edilemeyen shipment için nedeni seçip kaydeder ve gönderiyi uygun kurtarma akışına yönlendirir.',
  entryFlow: ['Stop List', 'Shipment Detail', 'Delivery', 'Delivery Failed'],
  hotspots: [
    { num: 1, label: 'Shipment bilgileri', desc: 'Teslim edilemeyen gönderinin özeti.', x: 50, y: 14 },
    { num: 2, label: 'Failure reason', desc: 'Standart başarısızlık nedeni listesi.', x: 50, y: 38 },
    { num: 3, label: 'Not / kanıt', desc: 'Opsiyonel açıklama ve fotoğraf.', x: 50, y: 60 },
    { num: 4, label: 'Save', desc: 'Nedeni kaydeder ve listeye döner.', x: 50, y: 86 },
  ],
  steps: [
    { title: 'Nedeni seç', user: 'Standart reason listesinden seçer.', system: 'Reason mapping’i doğrular.', blockedWhen: 'Reason seçilmediyse.', error: 'Reason zorunlu.' },
    { title: 'Kanıt ekle', user: 'Gerekliyse fotoğraf/not ekler.', system: 'Ülke kuralına göre zorunluluk uygular.' },
    { title: 'Kaydet', user: 'Save’e basar.', system: 'DeliveryFailed event’i gönderilir ya da kuyruğa alınır.' },
  ],
  buttons: [
    { element: 'Reason', purpose: 'Başarısızlık nedenini seçer', activeWhen: 'Her zaman' },
    { element: 'Add Photo', purpose: 'Kanıt ekler', activeWhen: 'Ülke kuralı gerektiriyorsa' },
    { element: 'Save', purpose: 'Nedeni kaydeder', activeWhen: 'Reason seçiliyse' },
  ],
  commonProblems: [
    { id: 'f1', title: 'Yanlış reason seçildi', tone: 'amber', rows: [
      { label: 'Yapılacak', value: 'Kaydetmeden önce doğru reason’ı seç.' },
      { label: 'Support’a ilet', value: 'Shipment ID + seçilen reason.' },
    ]},
    { id: 'f2', title: 'İşlem offline kaldı', tone: 'blue', rows: [
      { label: 'Neden', value: 'Bağlantı yok; event kuyruğa alındı.' },
      { label: 'Yapılacak', value: 'Bağlantı gelince kuyruğun işlendiğini doğrula.' },
    ]},
  ],
  does: ['Başarısızlık nedenini kaydeder', 'Offline request oluşturabilir', 'Gönderiyi kurtarma akışına bağlar'],
  dont: ['Payment akışı başlatmaz', 'Fiscal kayıt oluşturmaz', 'Shipment’ı otomatik yeniden planlamaz'],
  architecture: [
    { label: 'Fragment', value: 'DeliveryFailedFragment' },
    { label: 'ViewModel', value: 'SharedViewModel' },
    { label: 'API service', value: 'DeliveryApi' },
    { label: 'Room tables', value: 'shipments, requestQueue' },
    { label: 'Navigation', value: '/delivery/{shipmentId}/failed' },
  ],
  entryConditions: ['currentTask mevcut olmalı', 'Shipment state uygun olmalı'],
  localState: [
    { state: 'currentTask', source: 'SharedViewModel', persistence: 'Memory', risk: 'Process restart’ta kayıp' },
    { state: 'failureReason', source: 'Fragment', persistence: 'Screen lifecycle', risk: 'Rotation’da sıfırlanma' },
    { state: 'offlineRequest', source: 'Room', persistence: 'Kalıcı', risk: 'Zombie processing' },
  ],
  backendCalls: [
    { action: 'Save failure', endpoint: 'POST /delivery/complete (event=FAILED)', success: 'State güncellenir', failure: 'Queue’ya alınır' },
  ],
  eventChain: [
    { id: 'e1', label: 'Reason Select', tone: 'blue' },
    { id: 'e2', label: 'Validation', tone: 'indigo' },
    { id: 'e3', label: 'Delivery API (FAILED)', tone: 'red' },
    { id: 'e4', label: 'Room Update', tone: 'blue' },
    { id: 'e5', label: 'Navigation', tone: 'purple' },
    { id: 'e6', label: 'Offline / Retry dalı', tone: 'orange', branch: true },
  ],
  validation: ['Reason zorunlu', 'Country-specific kanıt kuralı', 'Shipment status uygunluğu'],
  analytics: [
    { event: 'delivery_failed_opened', trigger: 'Screen opened', params: 'country, shipment' },
    { event: 'delivery_failed_saved', trigger: 'Save', params: 'reason, offline' },
  ],
  tests: ['Happy path', 'Offline', 'Reason mismatch', 'Rotation', 'Double tap'],
  related: [
    { label: 'Delivery (Screen Manual)', href: '/engineering/mobile-knowledge/screens/delivery' },
    { label: 'Tour & Delivery (Backend Handbook)', href: '/engineering/mobile-knowledge/backend/tour-delivery' },
    { label: 'Edge Case Map', href: '/engineering/edge-case-map' },
  ],
}

function stub(slug: string, title: string, subtitle: string, group: ScreenGroup, purpose: string): Screen {
  return {
    slug,
    title,
    subtitle,
    group,
    tone: 'gray',
    documented: false,
    meta: {
      owner: 'Mobile Team',
      version: '8.4.60+',
      countries: ['HR', 'BA', 'SI', 'RS'],
      lastVerified: '—',
      status: 'draft',
    },
    purpose,
  }
}

export const SCREENS: Screen[] = [
  // Application Entry
  stub('login', 'Login', 'Kullanıcı girişi ve kimlik doğrulama', 'application-entry', 'Kullanıcının uygulamaya giriş yaptığı ekran.'),
  stub('settings', 'Settings', 'Uygulama ayarları', 'application-entry', 'Dil, host ve tercih ayarları.'),
  stub('host-selection', 'Host Selection', 'Backend host seçimi', 'application-entry', 'Ortam / host seçim ekranı.'),
  // Daily Operation
  stub('schedule', 'Schedule', 'Günlük plan görünümü', 'daily-operation', 'Courier’ın günlük planını gösterir.'),
  stub('route-selection', 'Route Selection', 'Rota seçimi', 'daily-operation', 'Günün rotasının seçildiği ekran.'),
  stub('stop-list', 'Stop List', 'Durak listesi', 'daily-operation', 'Rotadaki durakların listesi.'),
  stub('task-list', 'Task List', 'Görev listesi', 'daily-operation', 'Duraktaki görevlerin listesi.'),
  // Shipment Operations
  stub('shipment-detail', 'Shipment Detail', 'Gönderi detayı', 'shipment-operations', 'Tek bir gönderinin detay ekranı.'),
  stub('pick-up', 'Pick Up', 'Gönderi toplama', 'shipment-operations', 'Pickup akışı.'),
  DELIVERY,
  DELIVERY_FAILED,
  // Payment & Fiscal
  stub('payment-selection', 'Payment Selection', 'Ödeme türü seçimi', 'payment-fiscal', 'COD gönderilerde ödeme türünün seçildiği ekran.'),
  stub('pos', 'POS', 'Kart tahsilatı', 'payment-fiscal', 'POS / SoftPOS tahsilat ekranı.'),
  stub('fiscal-result', 'Fiscal Result', 'Fiscal sonuç', 'payment-fiscal', 'Fiscal kayıt sonucunun gösterildiği ekran.'),
  stub('receipt', 'Receipt', 'Fiş / makbuz', 'payment-fiscal', 'Basılan fiş / makbuz görünümü.'),
  // Additional Operations
  stub('d4me-locker', 'D4Me / Locker', 'Locker teslimatı', 'additional-operations', 'Locker teslimat akışı ekranı.'),
  stub('shipment-tracking', 'Shipment Tracking', 'Gönderi takibi', 'additional-operations', 'Gönderi izleme ekranı.'),
  stub('map-navigation', 'Map / Navigation', 'Harita ve navigasyon', 'additional-operations', 'Rota haritası ve yönlendirme.'),
  stub('hub-companion', 'Hub Companion', 'Hub yardımcı ekranı', 'additional-operations', 'Hub operasyonları yardımcı ekranı.'),
  // End of Shift
  stub('end-of-day', 'End of Day', 'Vardiya sonu', 'end-of-shift', 'Vardiya kapanış ve mutabakat ekranı.'),
]

export function getScreen(slug: string): Screen | undefined {
  return SCREENS.find((s) => s.slug === slug)
}
