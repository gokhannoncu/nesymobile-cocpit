// Nesy Mobile incident playbook'ları — tek gerçek kaynak.
// Kaynak: Nesy ticket analizi (48 ticket) + incident triage matrisi.
// Her grup: ilk kontroller (kod lokasyonlarıyla), hızlı aksiyonlar ve ilgili ekranlar.

export interface IncidentGroup {
  id: string
  name: string
  tone: 'red' | 'orange' | 'amber' | 'purple' | 'blue' | 'teal' | 'indigo' | 'gray'
  tickets: number
  open: number
  highRisk: number
  /** İlk 15 dakikada bakılacak kod noktaları. */
  firstChecks: { location: string; why: string }[]
  quickActions: string[]
  relatedScreens: string[]
}

export const SEVERITY_PROTOCOL = [
  {
    level: 'SEV-1',
    label: 'Saha durdu',
    tone: 'red' as const,
    examples: 'Çift tahsilat, toplu sessiz logout, migration veri kaybı, fiscal basılamıyor (RS)',
    response: '15 dk içinde müdahale · operasyon + backend + mobil birlikte · ülke operasyonu bilgilendirilir',
  },
  {
    level: 'SEV-2',
    label: 'Akış bozuk, workaround var',
    tone: 'orange' as const,
    examples: 'Scan eşleşmiyor (manuel giriş mümkün), bildirim yönlendirmesi bozuk, D4Me rezervasyon hatası',
    response: 'Aynı gün müdahale · workaround sahaya duyurulur · kök neden 48 saat içinde',
  },
  {
    level: 'SEV-3',
    label: 'Kısıtlı etki',
    tone: 'amber' as const,
    examples: 'Tekil cihaz sorunu, UI kusuru, düşük hacimli endpoint regresyonu',
    response: 'Backlog’a önceliklendirilir · haftalık triage’da gözden geçirilir',
  },
]

export const FIRST_15_MINUTES = [
  'Etki kapsamını belirle: hangi ülke(ler), hangi sürüm, kaç kurye? (Crashlytics + versiyon dağılımı)',
  'Sınıflandır: hangi playbook grubu? (aşağıdaki gruplardan biri) — grubu bilinmiyorsa Edge Case Map’ten tetikleyici ara.',
  'Offline kuyruk durumunu kontrol et: RequestSenderService kilitli mi (E8), isOfflineMode takılı mı (E7)?',
  'Son deploy/sürüm değişikliğine bak: version-prod.json sayaçları ve son CI çalıştırmaları.',
  'Finansal etki varsa (tahsilat/fiscal) SEV-1 ilan et; ülke operasyonuna "işlemi tekrarlamayın" duyurusu geç.',
  'Kanıt topla: cihaz logları, Crashlytics event’leri, ilgili shipment ID’leri — düzeltmeden önce kayıt altına al.',
]

export const INCIDENT_GROUPS: IncidentGroup[] = [
  {
    id: 'payment',
    name: 'Finans & Ödeme',
    tone: 'red',
    tickets: 15,
    open: 3,
    highRisk: 8,
    firstChecks: [
      { location: 'TaskListFragment.kt (~6.044 satır)', why: '5 ödeme yöntemi (Cash/CreditCard/RaiPay/SoftPOS/WPOS) tek fragment’ta — hangi yol tetiklenmiş?' },
      { location: 'SharedViewModel.revertShipmentFiscalCreated()', why: 'Fiscal durum geri alma — çift fiş vakalarında ilk bakılacak yer.' },
      { location: 'PrinterManager.kt (245) · printTextWithQrCode()', why: 'Zebra yazıcı akışı — "fiş basılamıyor" vakaları.' },
      { location: 'RequestSenderService (offline kuyruk)', why: 'Ödeme event’i kuyruğa yazılmış ama gönderilmemiş olabilir (E8/E9).' },
      { location: 'FiscalInvoiceData (Room)', why: 'Fiscal kayıt ile teslim kaydının eşleşmesini doğrula (E28).' },
    ],
    quickActions: [
      'Cihazda shipment’ın ödeme/fiscal durumunu backoffice kaydıyla karşılaştır.',
      'Çift tahsilat şüphesinde POS sağlayıcı kayıtlarını (RaiPay/SoftPos/WSPay) çek.',
      'Fiş basılamıyorsa: yazıcı bağlantısı → fiscal servis (VPFR) → SSC telafi akışı sırasıyla.',
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
      { location: 'MainActivity.onBarcodeRead() (L1575)', why: '18 fragment’a is-check ile dispatch — scan yanlış ekrana gitmiş olabilir (E31).' },
      { location: 'StopListFragment.whenBarcodeDetect()', why: 'O(n⁴) eşleştirme + 5 dosyada kopya barcode utils — trim/varyant tutarsızlığı (E32).' },
      { location: 'ScanProcessor.kt (427) · 5 sn cooldown', why: 'Cooldown StateFlow’u geçerli scan’i yutmuş olabilir.' },
      { location: 'sp.forceLoadedBarcodeList (SharedPreferences)', why: 'Bayat dedup listesi geçerli paketi "duplicate" sayabilir (E33).' },
    ],
    quickActions: [
      'Aynı barkodu TaskList ve Delivery ekranlarında ayrı ayrı dene — fark varsa eşleştirme kopyası sorunudur.',
      'Dedup şüphesinde forceLoadedBarcodeList temizliğini dene (oturum yeniden başlat).',
      'Donanım scanner (Honeywell/Urovo/Zebra) ile kamera scan davranışını karşılaştır.',
    ],
    relatedScreens: ['Stop List', 'Task List', 'Delivery Failed', 'Pick Up', 'Shipment Tracking'],
  },
  {
    id: 'tour',
    name: 'Tour & Teslimat',
    tone: 'indigo',
    tickets: 6,
    open: 1,
    highRisk: 3,
    firstChecks: [
      { location: 'DeliveryFragment.deliverShipment() (160 satır, 5 seviye iç içe)', why: 'Teslim akışının ana yolu — dallanma hatası burada başlar.' },
      { location: 'DeliveryFragment.offlineDelivery() (165 satır)', why: 'Offline teslim yolu — kuyruk/senkron sorunlarında ikinci yol.' },
      { location: 'DeliveryFailedFragment.showDeliveryFailedMenu() (240 satır)', why: 'Başarısız teslimat neden listesi ülke koduna göre 5 yerde tekrarlı.' },
    ],
    quickActions: [
      'Shipment’ın event zincirini çek (TOUR → DELY/RETS) — sıra ihlali var mı (E10)?',
      'Merged stop ise: alt gönderilerin ayrı ayrı durumlarını doğrula.',
      'DDSP/DEPS yönlendirmeli gönderilerde TOUR alma hatalarını kontrol et.',
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
      { location: 'SharedViewModel (3.602 satır, ~100+ fonksiyon)', why: 'God object — currentTask temizlenmemiş olabilir (E17).' },
      { location: 'StopListFragment (30+ mutable alan)', why: 'State makinesi yok — yarış koşulları buradan doğar.' },
      { location: 'DeliveryFragment 5 sn Handler polling', why: 'Lifecycle-aware değil — bayat state ile UI güncellenebilir.' },
    ],
    quickActions: [
      'Cihazı yeniden başlatıp aynı akışı dene — sorun kayboluyorsa memory-state sorunudur (kalıcı düzeltme gerekir).',
      'Çift TOUR eventi şüphesinde event zincirinde duplicate timestamp ara.',
      'Push (FCM) geldiği anda yapılan işlemi belirle — E15 push yarışı deseni.',
    ],
    relatedScreens: ['Route Selection', 'Shipment Tracking', 'Pick Up', 'Stop List'],
  },
  {
    id: 'notification',
    name: 'Bildirim',
    tone: 'blue',
    tickets: 4,
    open: 2,
    highRisk: 0,
    firstChecks: [
      { location: 'MainActivity BroadcastReceiver (L266)', why: 'Bildirim tıklama yönlendirmesi buradan dağıtılır.' },
      { location: 'StopListFragment.showSavedNotification()', why: 'Kaydedilmiş bildirim gösterimi — içerik eksik/hatalı vakaları.' },
      { location: 'NotificationInfo (Room)', why: 'Bildirim kaydının kalıcı hali — payload doğru mu?' },
    ],
    quickActions: [
      'FCM payload’ını Firebase konsolundan doğrula.',
      'Bildirim → stop detay yönlendirmesini uygulama açık/kapalı/arka planda üç durumda test et.',
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
      { location: 'LeanLockerTaskListFragment (882 satır)', why: 'Locker görev listesi — yanlış Crashlytics sabiti nedeniyle loglar yanıltıcı olabilir.' },
      { location: 'SharedViewModel D4Me rezervasyon akışı', why: 'LCR oluşturma ve callback eşleşmesi (RS’de 14 haneli ID kuralı).' },
      { location: 'PudoLockerParcelReleaseFragment', why: 'Locker teslim bırakma — observeForever leak mevcut.' },
    ],
    quickActions: [
      'D4MeCallback event’lerini (DEPT/DELY/COPT) shipment üzerinden sırayla doğrula.',
      'RS vakalarında Legacy ID ilk 14 hane eşleşmesini kontrol et.',
      'Multicolli gönderi locker’a bırakılmışsa bilinen kısıt — operasyona geri çağırma talimatı ver.',
    ],
    relatedScreens: ['D4Me/Locker', 'Delivery Failed', 'Route Selection'],
  },
  {
    id: 'location',
    name: 'Konum & GPS',
    tone: 'amber',
    tickets: 2,
    open: 1,
    highRisk: 1,
    firstChecks: [
      { location: 'LocationService.kt (399 satır)', why: '1 sn örnekleme + 10 kayıt batch — kara delik deseni (E24).' },
      { location: 'MapFragment.kt (409)', why: 'WebView Leaflet harita — getElementsById typo nedeniyle CSS injection çalışmıyor.' },
      { location: 'LiveLocation (Room)', why: 'Retention yok — tablo şişmesi ANR’ye yol açabilir (E23).' },
    ],
    quickActions: [
      'Cihazda konum izni durumunu doğrula — izin gün ortasında kapatılmış olabilir (E25).',
      'Dispatch "kurye kayboldu" diyorsa upload kuyruğunda bekleyen batch var mı bak.',
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
      { location: 'MainActivity.onBackPressed() (150 satır, 20+ dal)', why: 'Deprecated + karmaşık — geri tuşu kaynaklı state bozulmaları.' },
      { location: 'CameraFragment (787) · observeForever (L735)', why: 'Bilinen memory leak — uzun oturumda crash.' },
      { location: 'Crashlytics konsolu', why: 'Aynı stack’in ülke/sürüm dağılımına bak; manuel recordException ~30 dosyada dağınık.' },
    ],
    quickActions: [
      'Crash spike’ında önce sürüm korelasyonu: tek sürümde mi, tek ülkede mi?',
      'Bildirim sonrası scan crash’i (ticket 4484) deseni için repro: bildirim → hemen barkod okut.',
    ],
    relatedScreens: ['Stop List', 'Task List', 'Camera'],
  },
]

export const INCIDENT_STATS = {
  totalTickets: 48,
  openTickets: 15,
  bySeverity: { critical: 2, high: 26, medium: 20 },
  byCountry: { HR: 21, RS: 12, General: 11, CEE: 4 },
  riskiestGroup: 'Finans & Ödeme (15 ticket · 8 yüksek risk)',
  riskiestScreens: 'Delivery + Delivery Failed (16 ticket)',
}
