// Nesy Mobile current architecture & technical debt data — single source of truth.
// Source: Architecture Health Scan (June 2026) + Codebase Report (46 screens x 15 categories).

export const LAYER_MAP = [
  {
    name: 'Application',
    role: 'Uygulama kabuğu — giriş noktası ve flavor wiring',
    responsibilities: [
      'MainActivity / SplashActivity lifecycle ve navigation host',
      'Hilt ile dependency injection başlatma',
      'HR · RS · SI · BA · ME flavor yapılandırması',
    ],
    components: ['MainActivity', 'SplashActivity', 'Hilt', '11 flavor'],
    issue: 'Tek module — tüm katmanlar aynı classpath içinde',
    tone: 'blue' as const,
  },
  {
    name: 'Presentation',
    role: 'UI yüzeyi — kullanıcı etkileşimi ve ekran akışları',
    responsibilities: [
      'Fragment lifecycle, adapter binding ve custom view render',
      'Barcode / tarama event’lerini UI katmanında yakalama',
      'Dialog ve bottom sheet ile operasyon adımlarını gösterme',
    ],
    components: ['53 Fragment', '36 adapter', '138 XML layout'],
    issue: 'Business rules fragment / adapter / dialog içine dağılmış',
    tone: 'green' as const,
  },
  {
    name: 'Business',
    role: 'Operasyon mantığı — orchestration ve paylaşılan state',
    responsibilities: [
      'Tarama kuyruğu, offline akış ve schedule session yönetimi',
      'Ekranlar arası shared state (currentTask, paidShipments…)',
      'Feature-specific koordinasyon (delivery, pickup, routing)',
    ],
    components: ['SharedViewModel', 'ScanProcessor', 'ScanCoordinator', 'QueueGuard'],
    issue: 'SharedViewModel ~3.450 satır — god object, test edilemez',
    tone: 'teal' as const,
  },
  {
    name: 'Data',
    role: 'Kalıcılık ve remote erişim — local DB + API',
    responsibilities: [
      'Room ile schedule / request / parcel kayıtlarını tutma',
      'Repository üzerinden APIService çağrıları (pass-through)',
      'Offline queue ve SharedPreferences cache yönetimi',
    ],
    components: ['Room v240 · 11 tables', 'MainRepository', 'APIService · 527 endpoints'],
    issue: 'JSON chunk model · allowMainThreadQueries() · tek APIService interface',
    tone: 'red' as const,
  },
  {
    name: 'Common',
    role: 'Cross-cutting altyapı — config, network, auth',
    responsibilities: [
      'BuildConfig / flavor sabitleri ve ülke bazlı flag’ler',
      'AuthInterceptor, CertificatePinner ve NetworkModule wiring',
      'FCM token ve global utility sınıfları',
    ],
    components: ['AuthInterceptor', 'CertificatePinner', 'NetworkModule', 'BuildConfig.*'],
    issue: 'BuildConfig.COUNTRY_CODE 163 kullanım — strategy pattern yok',
    tone: 'purple' as const,
  },
  {
    name: 'Remote & Peripheral',
    role: 'Dış servisler ve cihaz entegrasyonları',
    responsibilities: [
      'Firebase Analytics / FCM / Crashlytics telemetrisi',
      'WorkManager ile background sync (tanımlı ama fiilen az kullanılıyor)',
      'Zebra scanner, ödeme terminali ve Bluetooth yazıcı bağlantısı',
    ],
    components: ['Firebase', 'WorkManager', 'DataWedge / ML Kit', 'RaiPay · WSPay · SoftPOS'],
    issue: 'Peripheral callback’ler Presentation / Business’a doğrudan sızıyor',
    tone: 'gray' as const,
  },
] as const
