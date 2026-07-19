// Nesy Mobile edge-case map — single source of truth.
// Source: NesyMobile Architecture Health Scan (June 2026) E1–E33 catalogue.
// Each record: trigger condition, operational impact, and mitigation approach.

export type EdgeCategory =
  | 'data'
  | 'state'
  | 'offline'
  | 'conflict'
  | 'ui'
  | 'api'
  | 'location'
  | 'payment'
  | 'scan'

export type Severity = 'critical' | 'high' | 'medium'

export interface EdgeCase {
  id: string
  title: string
  category: EdgeCategory
  severity: Severity
  /** When / how is it triggered? */
  trigger: string
  /** What breaks in the field and in the data? */
  impact: string
  /** Brief mitigation / modernization approach. */
  mitigation: string
}

export const EDGE_CATEGORIES: Record<EdgeCategory, { label: string; desc: string }> = {
  data: { label: 'Veri & DB', desc: 'Room JSON chunk yapısı ve migration güvenlik önlemleri' },
  state: { label: 'State Kopyaları', desc: 'Room / SharedViewModel / SharedPreferences sapması' },
  offline: { label: 'Offline Sync', desc: 'RequestSenderService kuyruk ve retry davranışı' },
  conflict: { label: 'Conflict Resolution', desc: 'Schedule refresh ve merge kuralları' },
  ui: { label: 'Presentation Layer', desc: 'Fragment lifecycle ve observer davranışı' },
  api: { label: 'API & Auth', desc: 'Token, host seçimi ve TLS yapılandırması' },
  location: { label: 'Location Tracking', desc: 'GPS örnekleme, batch upload ve izinler' },
  payment: { label: 'Payment & Fiscal', desc: 'POS akışları, idempotency ve fiscal kayıtlar' },
  scan: { label: 'Scan & Barcode', desc: 'Çok kanallı giriş ve dedup state' },
}

export const EDGE_CASES: EdgeCase[] = [
  // ── Data & DB (JSON chunk risk) ─────────────────────────────
  {
    id: 'E1',
    title: 'Push refresh çakışması',
    category: 'data',
    severity: 'critical',
    trigger: 'FCM refresh ve yerel delivery yazımı aynı schedule chunk\'ını eşzamanlı günceller.',
    impact: 'Transaction / conflict yönetimi olmadan son yazan kazanır; delivery kayıtları kaybolabilir.',
    mitigation: 'Chunk yerine ilişkisel satır modeli + transaction; merkezi conflict policy.',
  },
  {
    id: 'E2',
    title: 'Bozuk JSON chunk',
    category: 'data',
    severity: 'high',
    trigger: 'Crash sonrası chunk yarım kalır veya parse edilemez.',
    impact: 'Yerel değişiklikler atlanabilir; offline üretilen iş kaybolabilir.',
    mitigation: 'Satır düzeyinde schema + yazım sonrası doğrulama; recovery prosedürü.',
  },
  {
    id: 'E3',
    title: 'Migration veri kaybı',
    category: 'data',
    severity: 'critical',
    trigger: 'Schema v240; v241 migration eksik olduğunda fallbackToDestructiveMigration() devreye girer.',
    impact: 'Schedule + bekleyen request kayıtları dahil tüm yerel veri silinebilir.',
    mitigation: 'Destructive fallback devre dışı; migration test suite + version gate.',
  },
  {
    id: 'E4',
    title: 'Gson kaynaklı ANR',
    category: 'data',
    severity: 'high',
    trigger: '200+ duraklı bir rota için main thread\'de yüzlerce Gson parse/serialize çağrısı (allowMainThreadQueries açık).',
    impact: 'UI donar; kurye gün ortasında uygulamayı kapatıp yeniden başlatır.',
    mitigation: 'Main thread query yasağı; IO dispatcher + paginated query.',
  },
  // ── State copies ──────────────────────────────────────────
  {
    id: 'E5',
    title: 'Ödeme durumu volatile',
    category: 'state',
    severity: 'critical',
    trigger: 'paidShipments yalnızca SharedViewModel belleğinde tutulur, persist edilmez.',
    impact: 'Restart sonrası payment akışı yeniden açılabilir — çift tahsilat riski.',
    mitigation: 'Payment durumu atomik olarak Room\'a yazılır; delivery confirmation ile bağlanır.',
  },
  {
    id: 'E6',
    title: 'Schedule uyumsuzluğu',
    category: 'state',
    severity: 'high',
    trigger: 'DB yeni schedule\'ı taşırken SharedPreferences eski scheduleId\'yi saklar.',
    impact: 'Request\'ler yanlış schedule altında ilerler; operasyon raporları sapar.',
    mitigation: 'Tek doğruluk kaynağı (Room); scheduleId türetilmiş değer olur.',
  },
  {
    id: 'E7',
    title: 'Offline mod kilitli kalır',
    category: 'state',
    severity: 'high',
    trigger: 'isOfflineMode true kaldığında bağlantı dönse bile RequestSenderService gönderimi atlar.',
    impact: 'Kuyruk uzun süre takılır; event\'ler back-office\'e geç ulaşır.',
    mitigation: 'Connectivity callback ile otomatik mod sıfırlama + izleme metriği.',
  },
  // ── Offline sync (RequestSenderService) ──────────────────────
  {
    id: 'E8',
    title: 'Zombie request',
    category: 'offline',
    severity: 'high',
    trigger: 'isProcessing true yapılır ve yalnızca error path\'te false\'a döner; recovery yok. Service ölürse kayıt kilitli kalır.',
    impact: 'Request kuyruğu bloke olur; sonraki event\'ler gönderilemez.',
    mitigation: 'Processing state için lease/timeout; başlangıçta stale lock temizliği.',
  },
  {
    id: 'E9',
    title: 'Çift gönderim',
    category: 'offline',
    severity: 'critical',
    trigger: 'uniqueKey yalnızca yerel unique index; server-side idempotency garantisi yok.',
    impact: 'Aynı delivery/collection event server\'da iki kez işlenebilir.',
    mitigation: 'Uçtan uca idempotency key; server-side dedup.',
  },
  {
    id: 'E10',
    title: 'Sıra ihlali',
    category: 'offline',
    severity: 'high',
    trigger: 'Aggregate düzeyinde sıralama yok; event\'ler arası sıra garantisi yok.',
    impact: 'Delivery iptalden önce işlenebilir; state machine bozulur.',
    mitigation: 'Shipment başına FIFO kuyruk; sequence number.',
  },
  {
    id: 'E11',
    title: 'Retry fırtınası',
    category: 'offline',
    severity: 'medium',
    trigger: 'Backoff/jitter yok; tüm cihazlar 3 sn ritminde senkron yüklenir. tryCount<3 sonrası request CompletedRequest\'e taşınır.',
    impact: 'Backend\'e eşzamanlı yük; başarısız request sessizce "completed" olur.',
    mitigation: 'Exponential backoff + jitter; dead-letter queue + alarm.',
  },
  {
    id: 'E12',
    title: 'FGS / Doze kesintisi',
    category: 'offline',
    severity: 'medium',
    trigger: 'Android foreground service ve Doze kısıtlamaları arttıkça sabit polling modeli bozulur.',
    impact: 'Kuyruk işlenmez; gün sonu verisi eksik kalır.',
    mitigation: 'WorkManager tabanlı scheduling; constraint-aware triggering.',
  },
  // ── Conflict resolution ──────────────────────────────────────
  {
    id: 'E13',
    title: 'Server iptali ezilir',
    category: 'conflict',
    severity: 'critical',
    trigger: 'Offline delivery kuyruktayken shipment server\'da CANCELLED olur; refresh sırasında yerel liste bunu gizler.',
    impact: 'Kurye iptal edilmiş pakete gider; sahada yanlış yönlendirme.',
    mitigation: 'Merkezi conflict policy: server iptali her zaman görünür kalır.',
  },
  {
    id: 'E14',
    title: 'Delivery geri alma görünümü',
    category: 'conflict',
    severity: 'high',
    trigger: 'Delivery gönderildikten hemen sonra eski replica response gelirse paket ekranda tekrar açık görünür.',
    impact: 'Aynı paketin iki kez işlenmesi riski; kurye kafa karışıklığı.',
    mitigation: 'Tüm dallarda timestamp/version karşılaştırması uygulanır.',
  },
  {
    id: 'E15',
    title: 'Push race state kaybı',
    category: 'conflict',
    severity: 'high',
    trigger: 'FCM refresh, delivery ekranındaki item mutation ile yarışır.',
    impact: 'Taranan item durumu kaybolabilir.',
    mitigation: 'Ekran-aktif mutation\'lar refresh merge\'e dahil edilir.',
  },
  // ── Presentation layer ────────────────────────────────────────
  {
    id: 'E16',
    title: 'Rotation\'da çift fiscal request',
    category: 'ui',
    severity: 'critical',
    trigger: 'Fiscal dialog açıkken rotation\'da observer yeniden bağlanır; createFiscalInvoice tekrar tetiklenir.',
    impact: 'Çift fiscal kayıt riski (RS\'de yasal denetim bulgusu).',
    mitigation: 'One-shot event (SingleLiveEvent/Flow) + idempotency key.',
  },
  {
    id: 'E17',
    title: 'Yanlış paket teslim edildi',
    category: 'ui',
    severity: 'critical',
    trigger: 'SharedViewModel.currentTask temizlenmezse eski task bellekte kalır; başka durakta akış yanlış task ile çalışır.',
    impact: 'Yanlış paket delivery confirmation; operasyonel kaos + itiraz.',
    mitigation: 'Scoped state + ekran girişinde task doğrulama.',
  },
  {
    id: 'E18',
    title: 'Hayalet dialog',
    category: 'ui',
    severity: 'medium',
    trigger: 'Fragment pause/back sonrası gecikmiş response geçersiz view üzerinde dialog açmaya çalışır.',
    impact: 'Crash / ANR riski.',
    mitigation: 'Lifecycle-aware collect; view geçerlilik kontrolü.',
  },
  {
    id: 'E19',
    title: 'ContentObserver sızıntısı',
    category: 'ui',
    severity: 'medium',
    trigger: 'Observer unregister edilmezse birikir; tek call-permission event birden fazla observer tetikler.',
    impact: 'Birden fazla call log yazımı ve tekrarlayan operasyonlar.',
    mitigation: 'Lifecycle-bound register/unregister; singleton observer.',
  },
  // ── API & Auth ───────────────────────────────────────────────
  {
    id: 'E20',
    title: 'Vardiya ortasında sessiz logout',
    category: 'api',
    severity: 'critical',
    trigger: 'Token süresi dolar (refresh yok); sonraki çağrı 401 alır, ErrorInterceptor kullanıcıyı sessizce logout eder.',
    impact: 'Yarım kalan delivery, payment akışı kesilir; kuyruktaki offline request\'ler tokensız kalır. Saha krizi: "İşlemi tamamladım ama sistem beni attı".',
    mitigation: 'Refresh token flow; kuyruk için session renewal + kullanıcı uyarısı.',
  },
  {
    id: 'E21',
    title: 'Kontrolsüz host yönlendirmesi',
    category: 'api',
    severity: 'critical',
    trigger: 'alternativeURL/Port/Http prefs değerleri doğrulama olmadan kullanılır; allowlist yok.',
    impact: 'Trafik beklenmeyen backend\'e yönlenebilir; TrustAllCerts nedeniyle TLS kontrolleri de etkisiz.',
    mitigation: 'Host allowlist + format doğrulama; TrustAllCerts kaldırılması.',
  },
  {
    id: 'E22',
    title: 'Cipher/signature hatası teşhis edilemiyor',
    category: 'api',
    severity: 'high',
    trigger: 'GetMySchedule, DeliverParcels gibi imzalı request\'lerde cipher/signature üretimi başarısız olur.',
    impact: 'Hata generic error\'a dönüşür; gerçek neden gizlenir, çözüm süresi uzar.',
    mitigation: 'Merkezi error classification; signature hataları için ayrı diagnostic log.',
  },
  // ── Location tracking ─────────────────────────────────────────
  {
    id: 'E23',
    title: 'Bağlantısız günlerde location tablosu şişer',
    category: 'location',
    severity: 'medium',
    trigger: 'Upload sürekli başarısız olursa LiveLocation tablosu retention/cleanup policy olmadan büyür.',
    impact: 'Query\'ler yavaşlar, batch operasyonlar ağırlaşır; eski cihazlarda ANR riski.',
    mitigation: 'Retention + max record policy; aşamalı cleanup.',
  },
  {
    id: 'E24',
    title: '9 örnek kara deliği',
    category: 'location',
    severity: 'medium',
    trigger: 'Batch eşiği 10 kayıt; service 5–9 kayıtla ölürse bir sonraki batch dolana kadar gönderilemez.',
    impact: 'Kurye bir süre dispatch ekranında "kaybolur".',
    mitigation: 'Zamana dayalı flush (eşik VEYA süre); service kapanışında drain.',
  },
  {
    id: 'E25',
    title: 'İptal edilen izin service\'i yanıltır',
    category: 'location',
    severity: 'high',
    trigger: 'Kullanıcı gün ortasında location iznini iptal eder; SecurityException yakalanır ve yalnızca loglanır.',
    impact: 'Service çalışıyor görünür; dispatch eski/eksik konuma güvenir. Kullanıcıya net uyarı yok.',
    mitigation: 'Permission state sürekli izlenir; kullanıcı + dispatch bilgilendirilir.',
  },
  {
    id: 'E26',
    title: 'GPS sıçraması metrikleri bozar',
    category: 'location',
    severity: 'medium',
    trigger: 'Tek hatalı GPS fix büyük sıçrama yaratır; outlier filter yok, sıçrama mesafeye eklenir.',
    impact: 'Rota hizalama, toplam mesafe ve saha raporları hatalı üretilir.',
    mitigation: 'Outlier filtering + hız/mesafe plausibility kontrolü.',
  },
  // ── Payment & Fiscal ───────────────────────────────────────
  {
    id: 'E27',
    title: 'Ödeme alındı, delivery kaydı oluşmadı',
    category: 'payment',
    severity: 'critical',
    trigger: 'POS payment başarı döner; ancak handleDelivery() çağrılmadan önce process ölür. Payment persist edilmez.',
    impact: 'Sistem ödemenin alındığını bilmez; akış yeniden başlayabilir — çift tahsilat veya nakit farkı.',
    mitigation: '"Payment received / delivery pending" ara durumu atomik olarak DB\'ye yazılır.',
  },
  {
    id: 'E28',
    title: 'Yetim fiscal invoice',
    category: 'payment',
    severity: 'critical',
    trigger: 'Fiscal kayıt delivery\'den önce oluşturulur; delivery başarısız olursa fiscal sistemde eşleşmeyen invoice kalır.',
    impact: 'Operasyonel veri ve finansal kayıtlar sapar; RS/BA\'da yasal denetim riski.',
    mitigation: 'Fiscal delivery confirmation\'a bağlanır; compensation (void/SSC) akışı tanımlanır.',
  },
  {
    id: 'E29',
    title: 'Rotation kaynaklı çift fiscal kayıt',
    category: 'payment',
    severity: 'high',
    trigger: 'Fiscal dialog açıkken rotation olur; observer yeniden bağlanır ve fiscal request ikinci kez tetiklenebilir.',
    impact: 'Idempotency olmadan aynı collection için iki fiscal kayıt oluşabilir.',
    mitigation: 'Fiscal request için idempotency key; one-shot event.',
  },
  {
    id: 'E30',
    title: 'Restart sonrası payment durumu kayboldu',
    category: 'payment',
    severity: 'critical',
    trigger: 'Payment bilgisi yalnızca bellek/callback\'te; uygulama restart olunca shipment "unpaid" görünür.',
    impact: 'POS akışı yeniden başlayabilir — çift tahsilat veya hatalı payment denemesi.',
    mitigation: 'Payment state machine kalıcı depolamaya (Room) taşınır.',
  },
  // ── Scan & Barcode ────────────────────────────────────────
  {
    id: 'E31',
    title: 'Ekran geçişinde scan kaybı',
    category: 'scan',
    severity: 'high',
    trigger: 'TaskList → Delivery geçişinde hardware scan gelir; aktif ekran çözülmeden event işlenir.',
    impact: 'Barcode kaybolabilir veya önceki ekran bağlamında yorumlanır; yanlış operasyon (custody, filtering) tetiklenir.',
    mitigation: 'Tek Scan Orchestrator; event güvenle aktif context\'e yönlendirilir.',
  },
  {
    id: 'E32',
    title: 'Ekranlar arası eşleştirme tutarsızlığı',
    category: 'scan',
    severity: 'high',
    trigger: 'TaskList trim varyantı ile eşleşir; Delivery aynı trim kontrolüne sahip değilse "barcode not matched" hatası fırlatılır.',
    impact: 'Kurye manuel girişe döner; işlem süresi artar, hata oranı yükselir.',
    mitigation: 'Merkezi Barcode Matcher; kurallar tek noktadan yönetilir.',
  },
  {
    id: 'E33',
    title: 'Eski dedup listesi geçerli scan\'i reddeder',
    category: 'scan',
    severity: 'medium',
    trigger: 'forceLoadedBarcodeList (SharedPreferences) cleanup olmadan büyür; dün taranan barcode bugün "duplicate" sayılır.',
    impact: 'Geçerli paket reddedilir; operasyonlar aksar.',
    mitigation: 'Session-scoped dedup (in-memory) + retention policy.',
  },
]

export const SEVERITY_META: Record<Severity, { label: string; tone: 'red' | 'orange' | 'amber' }> = {
  critical: { label: 'Kritik', tone: 'red' },
  high: { label: 'Yüksek', tone: 'orange' },
  medium: { label: 'Orta', tone: 'amber' },
}

export function edgeCasesByCategory(cat: EdgeCategory): EdgeCase[] {
  return EDGE_CASES.filter((e) => e.category === cat)
}
