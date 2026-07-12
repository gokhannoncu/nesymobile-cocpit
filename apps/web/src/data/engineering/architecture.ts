// Nesy Mobile mevcut mimari & teknik borç verisi — tek gerçek kaynak.
// Kaynak: Mimari Sağlık Taraması (Haziran 2026) + Codebase Report (46 ekran × 15 kategori).

export const INFRA_METRICS = [
  { label: 'Modül sayısı', value: '1 (app)', hint: 'Hiçbir sınır yok; her şey her şeyi görebiliyor', tone: 'red' as const },
  { label: 'Kotlin dosyası / LOC', value: '515 / ~68K', hint: 'Tek modül için yönetilemez büyüklük', tone: 'orange' as const },
  { label: 'Test dosyası', value: '0', hint: 'junit/espresso bağımlılıkları duruyor ama kullanılmamış', tone: 'red' as const },
  { label: 'Room şema versiyonu', value: '240', hint: 'fallbackToDestructiveMigration() açık → migration hatasında saha verisi silinir', tone: 'red' as const },
  { label: 'UI yüzeyi', value: '53 Fragment · 138 XML', hint: '36 adapter · 0 Compose · adapter’larda iş mantığı', tone: 'orange' as const },
  { label: 'API', value: '527 endpoint / 1 interface', hint: 'Tek APIService — interface segregation ihlali', tone: 'orange' as const },
  { label: 'Flavor', value: '11 variant / 5 ülke', hint: 'HR, RS, SI, BA, ME — davranış farkları BuildConfig flag’lerine gömülü', tone: 'amber' as const },
  { label: 'allowMainThreadQueries()', value: 'Açık', hint: 'ANR riski; SSoT’nin reaktif olmadığının itirafı', tone: 'red' as const },
]

export const GOD_OBJECTS = [
  { name: 'StopListFragment', lines: 7059, note: 'Projedeki en büyük dosya · 15+ sorumluluk · 30+ mutable alan · O(n⁴) eşleştirme' },
  { name: 'TaskListFragment', lines: 5864, note: '5 ödeme yöntemi tek fragment’ta · whenBarcodeDetect() 200+ satır' },
  { name: 'DeliveryFragment', lines: 4113, note: 'En düşük sağlık skoru (1.9/10) · deliverShipment() 160 satır, 5 seviye iç içe' },
  { name: 'SharedViewModel', lines: 3602, note: 'GOD OBJECT · ~100+ fonksiyon · 8+ sorumluluk · temizleme sözleşmesi yok' },
  { name: 'StopViewModel', lines: 2482, note: 'İkinci god object · ~70+ fonksiyon' },
  { name: 'ExtensionMethods', lines: 2419, note: '~%50’si yorum satırına alınmış ölü kod' },
]

export const LAYER_MAP = [
  { name: 'Application', desc: 'Tek modüllü Android kabuk — MainActivity/SplashActivity, Hilt entry, 10 flavor wiring', tone: 'blue' as const },
  { name: 'Presentation', desc: '53 Fragment, 36 adapter, custom view’lar — iş kuralları fragment/adapter/dialog’a dağılmış', tone: 'green' as const },
  { name: 'Business', desc: 'SharedViewModel (3.450+ satır), ScanProcessor/Coordinator/QueueGuard, feature logic klasörleri', tone: 'teal' as const },
  { name: 'Data', desc: 'Room v240 (11 tablo), MainRepository (136 pass-through), APIService (527 endpoint)', tone: 'red' as const },
  { name: 'Common', desc: 'Constants/BuildConfig/flavor config, AuthInterceptor/CertificatePinner, FCM/NetworkModule', tone: 'purple' as const },
  { name: 'Remote & Peripheral', desc: 'Firebase (Analytics/FCM/Crashlytics), WorkManager, Zebra DataWedge/ML Kit, RaiPay/WSPay/SoftPOS, Bluetooth printer', tone: 'gray' as const },
]

export const ANTI_PATTERNS = [
  { title: 'God Object', detail: 'SharedViewModel 3.602 + StopViewModel 2.482 satır — merkezi state tanrı nesneleri.', severity: 'critical' as const },
  { title: 'Sıfır test kapsaması', detail: 'test/ ve androidTest/ boş; 140 bug-fix commit’ine rağmen 0 regresyon testi.', severity: 'critical' as const },
  { title: 'Massive duplication', detail: 'Barcode utils 7+ dosyada kopya; printInvoice 3 yerde; Damage↔CaseDetection %70 aynı.', severity: 'high' as const },
  { title: 'God Fragment', detail: 'StopList 7.059 / TaskList 5.864 / Delivery 4.113 satır.', severity: 'critical' as const },
  { title: 'Country-code branching', detail: 'BuildConfig.COUNTRY_CODE 163 kullanım; BuildConfig.* 269 — strateji deseni yok.', severity: 'high' as const },
  { title: 'WebView debug prod’da açık', detail: 'setWebContentsDebuggingEnabled(true) — ManuelRouting + Map.', severity: 'high' as const },
  { title: 'observeForever sızıntıları', detail: 'Camera, Damage, CaseDetection, PudoLocker — unregister edilmeyen observer’lar.', severity: 'high' as const },
  { title: 'Anemik repository', detail: 'MainRepository 136 pass-through fonksiyon (243 satır) — iş mantığı taşımıyor.', severity: 'medium' as const },
  { title: 'Handler polling', detail: 'RequestSenderService 3 sn polling (1.190 satır) — backoff/jitter yok.', severity: 'high' as const },
  { title: 'Deprecated API’ler', detail: 'onActivityResult, startActivityForResult, onBackPressed, getParcelable, setHasOptionsMenu…', severity: 'medium' as const },
]

export const CRITICAL_BUGS = [
  { id: 'CB1', where: 'AnswerFragment L89', what: '.askQuestion yerine .answer kullanılmalı — cevaplar hiç gösterilmiyor.', severity: 'critical' as const },
  { id: 'CB2', where: 'SplashActivity L39', what: 'animationStarted immutable val(false) — guard hiç çalışmıyor; finish() de çağrılmıyor.', severity: 'critical' as const },
  { id: 'CB3', where: 'QuestionFragment & AskQuestionFragment', what: '@Inject var ama @AndroidEntryPoint yok → runtime crash.', severity: 'critical' as const },
  { id: 'CB4', where: 'ManuelRoutingFragment L467-513', what: 'AlertDialog show() çağrılmıyor → manuel rotalama kaydedilemiyor.', severity: 'critical' as const },
  { id: 'CB5', where: 'MapFragment L362', what: 'getElementsById typo (getElementById olmalı) → CSS injection hiç çalışmıyor.', severity: 'critical' as const },
  { id: 'CB6', where: 'ManuelRouting + Map', what: 'WebView remote debug production’da açık.', severity: 'high' as const },
  { id: 'CB7', where: 'CameraFragment L735 · Damage L124/L214', what: 'observeForever memory leak.', severity: 'high' as const },
  { id: 'CB8', where: 'PickUpFragment L325-372', what: '5 barcode helper tanımlı ama kullanılmıyor (ölü kod) + yorumlanmış API çağrısı.', severity: 'medium' as const },
  { id: 'CB9', where: 'CreateKTF & LeanLocker', what: 'Yanlış Crashlytics sabiti — loglar başka ekrana yazılıyor.', severity: 'medium' as const },
]

/** En riskli ekranlar (46 ekran × 15 sağlık kategorisi analizinden). */
export const SCREEN_HEALTH = [
  { rank: 1, name: 'StopListFragment', lines: 7059, score: 2.2, module: 'stop_list', finding: 'O(n⁴) iç içe forEach · barcode utils 5 dosyada kopya · DiffUtil yerine notifyDataSetChanged' },
  { rank: 2, name: 'TaskListFragment', lines: 5864, score: 2.3, module: 'task_list', finding: 'ViewModel yok · RaiPay intent’leri 3× kopya · hardcoded kullanıcı mesajları' },
  { rank: 3, name: 'DeliveryFragment', lines: 4113, score: 1.9, module: 'delivery', finding: 'Mock akış production’da · 5 sn lifecycle-dışı polling · CollectionType uyuşmazlığı sessizce loglanıyor' },
  { rank: 4, name: 'MainActivity (+SharedViewModel)', lines: 2053, score: 2.4, module: 'main', finding: 'onBackPressed 150 satır/20+ dal · onBarcodeRead 130 satır is-check zinciri · >500KB bundle temizliği' },
  { rank: 5, name: 'DeliveryFailedFragment', lines: 1576, score: 2.6, module: 'deliveryFailed', finding: 'showDeliveryFailedMenu 240 satır · ülke-kod neden ID’si 5× tekrar · binding!! kullanımı' },
  { rank: 7, name: 'LoginFragment', lines: 1081, score: 3.9, module: 'login', finding: 'Büyük ekranlar içindeki en sağlıklısı — login block (5 deneme/5 dk) ve Crashlytics anahtarları iyi' },
]

export const HEALTH_SCORE_NOTE =
  '46 ekran (44 Fragment + 2 Activity), 15 sağlık kategorisinde 1–10 arası puanlandı (kod yapısı, mimari, karmaşıklık, state, test edilebilirlik, güvenlik…). En temiz ekran HandTransactionFragment (5.1/10) — kod tabanında 7 üzeri ekran yok.'
