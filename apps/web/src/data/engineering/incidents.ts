// Nesy Mobile incident playbooks — single source of truth.
// Source: Nesy ticket analysis (48 tickets) + incident triage matrix.
// Each group: first checks (with code locations), quick actions, and related screens.

export interface IncidentGroup {
  id: string
  name: string
  tone: 'red' | 'orange' | 'amber' | 'purple' | 'blue' | 'teal' | 'indigo' | 'gray'
  tickets: number
  open: number
  highRisk: number
  /** Code locations to check in the first 15 minutes. */
  firstChecks: { location: string; why: string }[]
  quickActions: string[]
  relatedScreens: string[]
}

export const SEVERITY_PROTOCOL = [
  {
    level: 'SEV-1',
    label: 'Saha durdu',
    tone: 'red' as const,
    examples: 'Double charge, toplu silent logout, migration veri kaybı, fiscal makbuz yazdırılamaması (RS)',
    response: '15 dakika içinde müdahale · operasyon + backend + mobile birlikte · ülke operasyonları bilgilendirilir',
  },
  {
    level: 'SEV-2',
    label: 'Akış bozuk, workaround mevcut',
    tone: 'orange' as const,
    examples: 'Scan eşleşmemesi (manuel giriş mümkün), notification routing bozuk, D4Me rezervasyon hatası',
    response: 'Aynı gün müdahale · workaround sahaya duyurulur · root cause 48 saat içinde belirlenir',
  },
  {
    level: 'SEV-3',
    label: 'Sınırlı etki',
    tone: 'amber' as const,
    examples: 'Tek cihaz sorunu, UI kusuru, düşük hacimli endpoint regression’ı',
    response: 'Backlog’da önceliklendirilir · haftalık triage’da incelenir',
  },
]

export const FIRST_15_MINUTES = [
  'Etki kapsamını belirle: hangi ülke(ler), hangi version, kaç kurye? (Crashlytics + version dağılımı)',
  'Sınıflandır: hangi playbook grubu? (aşağıdaki gruplardan biri) — grup bilinmiyorsa tetikleyiciyi Edge Case Map içinde ara.',
  'Offline queue durumunu kontrol et: RequestSenderService kilitli mi (E8), isOfflineMode takılı mı (E7)?',
  'Son deploy/version değişikliğini kontrol et: version-prod.json sayaçları ve son CI run’ları.',
  'Mali etki (charge/fiscal) varsa SEV-1 ilan et; ülke operasyonlarına "işlemi retry etmeyin" duyurusu yap.',
  'Evidence topla: cihaz logları, Crashlytics event’leri, ilgili gönderi ID’leri — herhangi bir fix uygulamadan önce kaydet.',
]

export const INCIDENT_GROUPS: IncidentGroup[] = [
  {
    id: 'payment',
    name: 'Finance & Payment',
    tone: 'red',
    tickets: 15,
    open: 3,
    highRisk: 8,
    firstChecks: [
      { location: 'TaskListFragment.kt (~6,044 lines)', why: 'Tek bir fragment içinde 5 payment method (Cash/CreditCard/RaiPay/SoftPOS/WPOS) var — hangi path tetiklendi?' },
      { location: 'SharedViewModel.revertShipmentFiscalCreated()', why: 'Fiscal status rollback — double-receipt vakalarında ilk kontrol noktası.' },
      { location: 'PrinterManager.kt (245) · printTextWithQrCode()', why: 'Zebra printer flow — "makbuz yazdırılamıyor" vakaları.' },
      { location: 'RequestSenderService (offline queue)', why: 'Payment event queue’ya yazılmış ancak hiç gönderilmemiş olabilir (E8/E9).' },
      { location: 'FiscalInvoiceData (Room)', why: 'Fiscal kayıt ile teslimat kaydı arasındaki eşleşmeyi doğrula (E28).' },
    ],
    quickActions: [
      'Cihazdaki gönderi payment/fiscal status’unu back-office kaydıyla karşılaştır.',
      'Double charge şüphesi varsa POS sağlayıcı loglarını çek (RaiPay/SoftPos/WSPay).',
      'Makbuz yazdırılamıyorsa şu sırayla kontrol et: printer bağlantısı → fiscal service (VPFR) → SSC compensation flow.',
    ],
    relatedScreens: ['Delivery', 'Delivery Failed', 'End of Day', 'Pick Up', 'Shipment Detail'],
  },
  {
    id: 'scan',
    name: 'Barcode & Scan',
    tone: 'orange',
    tickets: 10,
    open: 3,
    highRisk: 5,
    firstChecks: [
      { location: 'MainActivity.onBarcodeRead() (L1575)', why: 'is-check ile 18 fragment’a dispatch eder — scan yanlış ekrana yönlenmiş olabilir (E31).' },
      { location: 'StopListFragment.whenBarcodeDetect()', why: 'O(n4) matching + 5 dosyada tekrarlanan barcode utils — trim/variant tutarsızlığı (E32).' },
      { location: 'ScanProcessor.kt (427) · 5 sec cooldown', why: 'Cooldown StateFlow geçerli bir scan’i yutmuş olabilir.' },
      { location: 'sp.forceLoadedBarcodeList (SharedPreferences)', why: 'Stale dedup listesi geçerli bir paketi "duplicate" olarak işaretleyebilir (E33).' },
    ],
    quickActions: [
      'Aynı barcode’u TaskList ve Delivery ekranlarında ayrı ayrı dene — davranış farklıysa sorun matching duplication kaynaklıdır.',
      'Dedup şüphesi varsa forceLoadedBarcodeList’i temizlemeyi dene (session’ı yeniden başlat).',
      'Hardware scanner (Honeywell/Urovo/Zebra) davranışını camera scan ile karşılaştır.',
    ],
    relatedScreens: ['Stop List', 'Task List', 'Delivery Failed', 'Pick Up', 'Shipment Tracking'],
  },
  {
    id: 'tour',
    name: 'Tour & Delivery',
    tone: 'indigo',
    tickets: 6,
    open: 1,
    highRisk: 3,
    firstChecks: [
      { location: 'DeliveryFragment.deliverShipment() (160 lines, 5 levels deep)', why: 'Teslimat akışının main path’i — branching hataları burada başlar.' },
      { location: 'DeliveryFragment.offlineDelivery() (165 lines)', why: 'Offline teslimat path’i — queue/sync sorunları için ikincil rota.' },
      { location: 'DeliveryFailedFragment.showDeliveryFailedMenu() (240 lines)', why: 'Başarısız teslimat nedenleri listesi country code’a göre 5 yerde tekrarlanıyor.' },
    ],
    quickActions: [
      'Gönderi event chain’ini çek (TOUR → DELY/RETS) — sequence ihlali var mı (E10)?',
      'Merged stop varsa alt gönderilerin status’larını ayrı ayrı doğrula.',
      'DDSP/DEPS yönlendirmeli gönderilerde TOUR retrieval hatalarını kontrol et.',
    ],
    relatedScreens: ['Delivery', 'Delivery Failed', 'Route Selection', 'Stop List'],
  },
  {
    id: 'state',
    name: 'State & Race',
    tone: 'purple',
    tickets: 4,
    open: 2,
    highRisk: 3,
    firstChecks: [
      { location: 'SharedViewModel (3,602 lines, ~100+ functions)', why: 'God object — currentTask temizlenmemiş olabilir (E17).' },
      { location: 'StopListFragment (30+ mutable fields)', why: 'State machine yok — race condition’lar burada başlıyor.' },
      { location: 'DeliveryFragment 5 sec Handler polling', why: 'Lifecycle-aware değil — UI stale state ile güncellenebilir.' },
    ],
    quickActions: [
      'Cihazı yeniden başlatıp aynı akışı tekrar dene — sorun kaybolursa memory-state problemidir (permanent fix gerekir).',
      'Double TOUR event şüphesi varsa event chain’de duplicate timestamp ara.',
      'Push (FCM) geldiğinde yapılan işlemi belirle — E15 push race pattern.',
    ],
    relatedScreens: ['Route Selection', 'Shipment Tracking', 'Pick Up', 'Stop List'],
  },
  {
    id: 'notification',
    name: 'Notification',
    tone: 'blue',
    tickets: 4,
    open: 2,
    highRisk: 0,
    firstChecks: [
      { location: 'MainActivity BroadcastReceiver (L266)', why: 'Notification tap routing buradan dispatch edilir.' },
      { location: 'StopListFragment.showSavedNotification()', why: 'Kaydedilmiş notification gösterimi — eksik/yanlış içerik vakaları.' },
      { location: 'NotificationInfo (Room)', why: 'Notification kaydının persistent biçimi — payload doğru mu?' },
    ],
    quickActions: [
      'FCM payload’u Firebase console üzerinden doğrula.',
      'Notification → stop detail routing akışını üç state’te test et: app açık/kapalı/background.',
    ],
    relatedScreens: ['Stop List', 'Delivery', 'End of Day'],
  },
  {
    id: 'locker',
    name: 'D4Me & Locker',
    tone: 'teal',
    tickets: 4,
    open: 1,
    highRisk: 2,
    firstChecks: [
      { location: 'LeanLockerTaskListFragment (882 lines)', why: 'Locker task list — yanlış Crashlytics constant nedeniyle loglar yanıltıcı olabilir.' },
      { location: 'SharedViewModel D4Me reservation flow', why: 'LCR oluşturma ve callback matching (RS için 14 haneli ID kuralı).' },
      { location: 'PudoLockerParcelReleaseFragment', why: 'Locker parcel release — mevcut observeForever leak’i.' },
    ],
    quickActions: [
      'Gönderideki D4MeCallback event’lerini (DEPT/DELY/COPT) sırayla doğrula.',
      'RS vakalarında Legacy ID’nin ilk 14 hanesinin eşleşmesini kontrol et.',
      'Multicolli gönderi locker’a yerleştirildiyse bu bilinen bir sınırlamadır — operasyona recall talimatı ver.',
    ],
    relatedScreens: ['D4Me/Locker', 'Delivery Failed', 'Route Selection'],
  },
  {
    id: 'location',
    name: 'Location & GPS',
    tone: 'amber',
    tickets: 2,
    open: 1,
    highRisk: 1,
    firstChecks: [
      { location: 'LocationService.kt (399 lines)', why: '1 sec sampling + 10 kayıtlık batch — black hole pattern (E24).' },
      { location: 'MapFragment.kt (409)', why: 'WebView Leaflet map — getElementsById typo nedeniyle CSS injection çalışmıyor.' },
      { location: 'LiveLocation (Room)', why: 'Retention yok — table bloat ANR’ye neden olabilir (E23).' },
    ],
    quickActions: [
      'Cihazdaki location permission durumunu doğrula — permission gün içinde kaldırılmış olabilir (E25).',
      'Dispatch "kurye kayboldu" diyorsa upload queue’da bekleyen batch olup olmadığını kontrol et.',
    ],
    relatedScreens: ['Map/Navigation', 'Login/Settings'],
  },
  {
    id: 'crash',
    name: 'UI & Crash',
    tone: 'gray',
    tickets: 3,
    open: 2,
    highRisk: 2,
    firstChecks: [
      { location: 'MainActivity.onBackPressed() (150 lines, 20+ branches)', why: 'Deprecated + complex — back button kaynaklı state corruption.' },
      { location: 'CameraFragment (787) · observeForever (L735)', why: 'Bilinen memory leak — uzun session’larda crash.' },
      { location: 'Crashlytics console', why: 'Aynı stack’in ülke/version dağılımını kontrol et; manuel recordException yaklaşık 30 dosyaya dağılmış.' },
    ],
    quickActions: [
      'Crash spike olduğunda önce version correlation’ını kontrol et: tek version mı, tek ülke mi?',
      'Notification sonrası scan crash (ticket 4484) pattern’i için repro: notification → hemen barcode scan.',
    ],
    relatedScreens: ['Stop List', 'Task List', 'Camera'],
  },
]

export const INCIDENT_STATS = {
  totalTickets: 48,
  openTickets: 15,
  bySeverity: { critical: 2, high: 26, medium: 20 },
  byCountry: { HR: 21, RS: 12, General: 11, CEE: 4 },
  riskiestGroup: 'Finance & Payment (15 ticket · 8 yüksek risk)',
  riskiestScreens: 'Delivery + Delivery Failed (16 ticket)',
}
