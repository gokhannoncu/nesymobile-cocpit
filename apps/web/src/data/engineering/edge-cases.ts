// Nesy Mobile edge-case haritası — tek gerçek kaynak.
// Kaynak: NesyMobile Mimari Sağlık Taraması (Haziran 2026) E1–E33 kataloğu.
// Her kayıt: tetikleyici koşul, operasyonel etki ve hafifletme yaklaşımı.

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
  /** Ne zaman / nasıl tetiklenir? */
  trigger: string
  /** Sahada ve veride ne bozulur? */
  impact: string
  /** Kısa hafifletme / modernizasyon yaklaşımı. */
  mitigation: string
}

export const EDGE_CATEGORIES: Record<EdgeCategory, { label: string; desc: string }> = {
  data: { label: 'Veri & DB', desc: 'Room JSON chunk yapısı ve migration güvenceleri' },
  state: { label: 'State Kopyaları', desc: 'Room / SharedViewModel / SharedPreferences ayrışması' },
  offline: { label: 'Offline Sync', desc: 'RequestSenderService kuyruk ve retry davranışı' },
  conflict: { label: 'Conflict Resolution', desc: 'Schedule yenileme ve merge kuralları' },
  ui: { label: 'Sunum Katmanı', desc: 'Fragment yaşam döngüsü ve observer davranışı' },
  api: { label: 'API & Auth', desc: 'Token, host seçimi ve TLS yapılandırması' },
  location: { label: 'Konum Takibi', desc: 'GPS örnekleme, batch upload ve izinler' },
  payment: { label: 'Ödeme & Fiscal', desc: 'POS akışları, idempotency ve fiscal kayıt' },
  scan: { label: 'Scan & Barkod', desc: 'Çoklu giriş kanalı ve dedup state' },
}

export const EDGE_CASES: EdgeCase[] = [
  // ── Veri & DB (JSON chunk riski) ─────────────────────────────
  {
    id: 'E1',
    title: 'Push refresh çakışması',
    category: 'data',
    severity: 'critical',
    trigger: 'FCM refresh ile yerel teslim yazımı aynı anda aynı schedule chunk’ını günceller.',
    impact: 'Transaction / conflict yönetimi olmadığı için son yazan kazanır; teslim kaydı kaybolabilir.',
    mitigation: 'Chunk yerine ilişkisel satır modeli + transaction; merkezi conflict policy.',
  },
  {
    id: 'E2',
    title: 'Bozuk JSON chunk',
    category: 'data',
    severity: 'high',
    trigger: 'Crash sonrası chunk yarım kalır veya parse edilemez.',
    impact: 'Lokal değişiklikler atlanabilir; offline üretilmiş emek kaybolabilir.',
    mitigation: 'Satır bazlı şema + yazma sonrası doğrulama; kurtarma prosedürü.',
  },
  {
    id: 'E3',
    title: 'Migration veri kaybı',
    category: 'data',
    severity: 'critical',
    trigger: 'Şema v240; 241 migration’ın eksikliğinde fallbackToDestructiveMigration() devreye girer.',
    impact: 'Schedule + bekleyen request kayıtları dahil tüm lokal veri silinebilir.',
    mitigation: 'Destructive fallback kapatılır; migration test seti + sürüm kapısı.',
  },
  {
    id: 'E4',
    title: 'Gson kaynaklı ANR',
    category: 'data',
    severity: 'high',
    trigger: '200+ stop’lu rotada yüzlerce Gson parse/serialize main thread’e denk gelir (allowMainThreadQueries açık).',
    impact: 'UI donar; kurye gün ortasında uygulamayı öldürüp yeniden açar.',
    mitigation: 'Main thread query yasağı; IO dispatcher + sayfalı sorgular.',
  },
  // ── State kopyaları ──────────────────────────────────────────
  {
    id: 'E5',
    title: 'Ödendi bilgisi uçucu',
    category: 'state',
    severity: 'critical',
    trigger: 'paidShipments yalnızca SharedViewModel memory’sinde tutulur, persist edilmez.',
    impact: 'Restart sonrası ödeme akışı yeniden açılabilir → çift tahsilat riski.',
    mitigation: 'Ödeme durumu Room’a atomik yazılır; teslim onayına bağlanır.',
  },
  {
    id: 'E6',
    title: 'Schedule uyuşmazlığı',
    category: 'state',
    severity: 'high',
    trigger: 'DB yeni schedule’ı taşırken SharedPreferences eski scheduleId ile kalır.',
    impact: 'İstekler yanlış schedule üzerinden ilerler; operasyon raporları şaşar.',
    mitigation: 'Tek gerçek kaynak (Room); scheduleId türetilmiş değer olur.',
  },
  {
    id: 'E7',
    title: 'Offline modu kilitli kalır',
    category: 'state',
    severity: 'high',
    trigger: 'isOfflineMode true kaldığında ağ gelse bile RequestSenderService gönderimi atlar.',
    impact: 'Kuyruk uzun süre bekler; event’ler backoffice’e geç düşer.',
    mitigation: 'Connectivity callback ile otomatik mod sıfırlama + izleme metriği.',
  },
  // ── Offline sync (RequestSenderService) ──────────────────────
  {
    id: 'E8',
    title: 'Zombi istek',
    category: 'offline',
    severity: 'high',
    trigger: 'isProcessing=true yapılıp yalnızca hata akışında false’a döner; recovery yok. Servis ölürse kayıt kilitli kalır.',
    impact: 'İstek kuyruğu tıkanır; sonraki event’ler gönderilemez.',
    mitigation: 'Lease/timeout ile işleniyor durumu; başlangıçta stale kilit temizliği.',
  },
  {
    id: 'E9',
    title: 'Çift gönderim',
    category: 'offline',
    severity: 'critical',
    trigger: 'uniqueKey yalnızca lokal unique index; sunucu tarafında idempotency garantisi yok.',
    impact: 'Aynı teslim/tahsilat event’i sunucuda iki kez işlenebilir.',
    mitigation: 'Uçtan uca idempotency anahtarı; sunucuda dedup.',
  },
  {
    id: 'E10',
    title: 'Sıra ihlali',
    category: 'offline',
    severity: 'high',
    trigger: 'Aggregate bazlı ordering yok; event’ler arasında sıra garantisi sağlanmıyor.',
    impact: 'Teslim, iptalden önce işlenebilir; durum makinesi bozulur.',
    mitigation: 'Shipment bazlı FIFO kuyruk; sequence numarası.',
  },
  {
    id: 'E11',
    title: 'Retry fırtınası',
    category: 'offline',
    severity: 'medium',
    trigger: 'Backoff/jitter yok; tüm cihazlar 3 sn ritmiyle senkron yüklenir, tryCount<3 sonrası istek CompletedRequest’e taşınır.',
    impact: 'Backend’e eşzamanlı yük; başarısız istek sessizce "tamamlandı"ya düşer.',
    mitigation: 'Exponential backoff + jitter; dead-letter kuyruğu + alarm.',
  },
  {
    id: 'E12',
    title: 'FGS / Doze kesintisi',
    category: 'offline',
    severity: 'medium',
    trigger: 'Android foreground service ve Doze kısıtları arttıkça sabit polling modeli kesilir.',
    impact: 'Kuyruk işlenmez; gün sonu verisi eksik kalır.',
    mitigation: 'WorkManager tabanlı zamanlama; kısıt uyumlu tetikleme.',
  },
  // ── Conflict resolution ──────────────────────────────────────
  {
    id: 'E13',
    title: 'Sunucu iptali ezilir',
    category: 'conflict',
    severity: 'critical',
    trigger: 'Offline teslim kuyruğa yazılırken sunucuda shipment CANCELLED olur; refresh sırasında lokal liste bunu görünmez kılar.',
    impact: 'İptal edilmiş pakete gidilir; sahada yanlış yönlendirme.',
    mitigation: 'Merkezi conflict policy: sunucu iptali her zaman görünür kalır.',
  },
  {
    id: 'E14',
    title: 'Teslim geri sarma görünümü',
    category: 'conflict',
    severity: 'high',
    trigger: 'Teslim gönderildikten hemen sonra eski replica cevabı gelirse paket ekranda tekrar açık görünür.',
    impact: 'Aynı paket iki kez işlenme riski; kurye kafa karışıklığı.',
    mitigation: 'Timestamp/versiyon karşılaştırması tüm dallarda uygulanır.',
  },
  {
    id: 'E15',
    title: 'Push yarışı state kaybı',
    category: 'conflict',
    severity: 'high',
    trigger: 'FCM refresh, delivery ekranındaki item mutasyonuyla yarışır.',
    impact: 'Scan edilmiş item statüsü kaybolabilir.',
    mitigation: 'Ekran-aktif mutasyonlar refresh merge’üne dahil edilir.',
  },
  // ── Sunum katmanı ────────────────────────────────────────────
  {
    id: 'E16',
    title: 'Rotasyonda çift fiscal isteği',
    category: 'ui',
    severity: 'critical',
    trigger: 'Fiscal dialog açıkken rotasyonda observer yeniden bağlanır; createFiscalInvoice tekrar çalışır.',
    impact: 'Çift fiscal kayıt riski (RS’de yasal denetim bulgusu).',
    mitigation: 'Tek seferlik event (SingleLiveEvent/Flow) + idempotency anahtarı.',
  },
  {
    id: 'E17',
    title: 'Yanlış paket teslim edilir',
    category: 'ui',
    severity: 'critical',
    trigger: 'SharedViewModel.currentTask temizlenmezse eski task memory’de kalır; başka stop’ta yanlış task ile akış çalışır.',
    impact: 'Yanlış paket teslim onayı; operasyonel kaos + itiraz.',
    mitigation: 'Scope’lu state + ekran girişinde task doğrulama.',
  },
  {
    id: 'E18',
    title: 'Hayalet dialog',
    category: 'ui',
    severity: 'medium',
    trigger: 'Fragment pause/back sonrası geciken yanıt, geçersiz view üzerinde dialog açmaya çalışır.',
    impact: 'Crash / ANR riski.',
    mitigation: 'Lifecycle-aware collect; view geçerliliği kontrolü.',
  },
  {
    id: 'E19',
    title: 'ContentObserver sızıntısı',
    category: 'ui',
    severity: 'medium',
    trigger: 'Observer unregister edilmezse birikir; tek arama izinli event birden çok observer tetikler.',
    impact: 'Çoklu call log yazımı ve tekrar eden işlemler.',
    mitigation: 'Lifecycle’a bağlı register/unregister; tekil observer.',
  },
  // ── API & Auth ───────────────────────────────────────────────
  {
    id: 'E20',
    title: 'Vardiya ortasında sessiz logout',
    category: 'api',
    severity: 'critical',
    trigger: 'Token süresi dolar (refresh yok); sonraki çağrı 401 alır, ErrorInterceptor kullanıcıyı sessizce atar.',
    impact: 'Yarım teslim, ödeme akışı kesilir; kuyruktaki offline request’ler token’sız kalır. Sahada "işlem yaptım ama sistemden attı" krizi.',
    mitigation: 'Refresh token akışı; kuyruk için oturum yenileme + kullanıcı uyarısı.',
  },
  {
    id: 'E21',
    title: 'Kontrolsüz host yönlendirme',
    category: 'api',
    severity: 'critical',
    trigger: 'alternativeURL/Port/Http prefs değerleri doğrulanmadan kullanılır; allowlist yok.',
    impact: 'Trafik tümüyle beklenmeyen bir backend’e yönlenebilir; TrustAllCerts nedeniyle TLS kontrolü de etkisiz.',
    mitigation: 'Host allowlist + format doğrulama; TrustAllCerts kaldırılır.',
  },
  {
    id: 'E22',
    title: 'Cipher/imza hatası teşhis edilemez',
    category: 'api',
    severity: 'high',
    trigger: 'GetMySchedule, DeliverParcels gibi imzalı isteklerde cipher/imza üretimi başarısız olur.',
    impact: 'Hata genel bir hataya dönüşür; gerçek sebep görünmez, çözüm süresi uzar.',
    mitigation: 'Merkezi hata sınıflandırması; imza hatalarına özel teşhis logu.',
  },
  // ── Konum takibi ─────────────────────────────────────────────
  {
    id: 'E23',
    title: 'Şebekesiz günde konum tablosu şişer',
    category: 'location',
    severity: 'medium',
    trigger: 'Upload sürekli başarısız olursa LiveLocation tablosu retention/temizlik politikası olmadan büyür.',
    impact: 'Sorgular yavaşlar, batch işlemleri ağırlaşır; eski cihazlarda ANR riski.',
    mitigation: 'Retention + maksimum kayıt politikası; kademeli temizleme.',
  },
  {
    id: 'E24',
    title: '9 örneklik kara delik',
    category: 'location',
    severity: 'medium',
    trigger: 'Batch eşiği 10 kayıt; servis 5–9 kayıt arasındayken ölürse bu kayıtlar bir sonraki batch dolana kadar gönderilemez.',
    impact: 'Dispatch ekranında kurye bir süre "kaybolur".',
    mitigation: 'Zaman bazlı flush (eşik VEYA süre); servis kapanışında boşaltma.',
  },
  {
    id: 'E25',
    title: 'İzin geri çekilince servis yanıltıcı',
    category: 'location',
    severity: 'high',
    trigger: 'Kullanıcı konum iznini gün ortasında kapatır; SecurityException yakalanır ve sadece loglanır.',
    impact: 'Servis çalışıyor görünür; dispatch bayat/eksik konuma bakar. Kullanıcıya net uyarı gitmez.',
    mitigation: 'İzin durumu sürekli izlenir; kullanıcı + dispatch bilgilendirilir.',
  },
  {
    id: 'E26',
    title: 'GPS sıçraması metrikleri bozar',
    category: 'location',
    severity: 'medium',
    trigger: 'Tek hatalı GPS fix’i büyük bir sıçrama yaratır; outlier filtre yok, sıçrama mesafeye eklenir.',
    impact: 'Route alignment, toplam mesafe ve saha raporları hatalı üretilir.',
    mitigation: 'Outlier filtreleme + hız/mesafe akla yatkınlık kontrolü.',
  },
  // ── Ödeme & Fiscal ───────────────────────────────────────────
  {
    id: 'E27',
    title: 'Para alınır, teslim kaydı oluşmaz',
    category: 'payment',
    severity: 'critical',
    trigger: 'POS ödemesi başarılı döner; ancak handleDelivery() çağrılmadan önce process ölür. Ödeme kalıcı değildir.',
    impact: 'Sistem ödeme alındığını bilmez; akış tekrar başlatılabilir → çift tahsilat veya kasa farkı.',
    mitigation: '"Ödeme alındı / teslim bekliyor" ara durumu DB’ye atomik yazılır.',
  },
  {
    id: 'E28',
    title: 'Öksüz fiscal fatura',
    category: 'payment',
    severity: 'critical',
    trigger: 'Fiscal kayıt teslimden önce oluşturulur; teslim başarısız olursa fiscal sistemde karşılıksız fatura kalır.',
    impact: 'Operasyonel veri ile mali kayıt ayrışır; RS/BA’da yasal denetim riski.',
    mitigation: 'Fiscal, teslim onayına bağlanır; telafi (void/SSC) akışı tanımlanır.',
  },
  {
    id: 'E29',
    title: 'Rotasyon kaynaklı çift fiscal kayıt',
    category: 'payment',
    severity: 'high',
    trigger: 'Fiscal dialog açıkken rotasyon yaşanır; observer tekrar bağlanır ve fiscal isteği ikinci kez tetiklenebilir.',
    impact: 'İdempotency olmadığı için aynı tahsilata iki fiscal kayıt oluşabilir.',
    mitigation: 'Fiscal isteğine idempotency anahtarı; tek seferlik event.',
  },
  {
    id: 'E30',
    title: 'Ödeme durumu restart sonrası kaybolur',
    category: 'payment',
    severity: 'critical',
    trigger: 'Ödeme bilgisi sadece memory/callback’te tutulur; app restart olduğunda shipment "ödenmedi" görünür.',
    impact: 'POS akışı yeniden başlatılabilir → çift tahsilat veya hatalı ödeme denemesi.',
    mitigation: 'Ödeme state makinesi kalıcı depoya taşınır (Room).',
  },
  // ── Scan & Barkod ────────────────────────────────────────────
  {
    id: 'E31',
    title: 'Ekran geçişinde scan kaybı',
    category: 'scan',
    severity: 'high',
    trigger: 'TaskList → Delivery geçişinde donanım scan’i gelir; aktif ekran netleşmeden event işlenir.',
    impact: 'Barcode kaybolabilir veya önceki ekran bağlamında yorumlanır; yanlış operasyon (zimmet, filtreleme) tetiklenir.',
    mitigation: 'Tek Scan Orchestrator; event aktif bağlama güvenli yönlendirilir.',
  },
  {
    id: 'E32',
    title: 'Ekranlar arası eşleştirme tutarsızlığı',
    category: 'scan',
    severity: 'high',
    trigger: 'TaskList trim varyantıyla eşleşir; Delivery’de aynı trim kontrolü yoksa "barkod eşleşmedi" hatası verir.',
    impact: 'Kurye manuel girişe düşer; işlem süresi uzar, hata oranı artar.',
    mitigation: 'Merkezi Barcode Matcher; kural tek noktadan yönetilir.',
  },
  {
    id: 'E33',
    title: 'Bayat dedup listesi geçerli scan’i reddeder',
    category: 'scan',
    severity: 'medium',
    trigger: 'forceLoadedBarcodeList (SharedPreferences) zamanla şişer ve temizlenmez; dün okutulan barcode bugün "duplicate" sayılır.',
    impact: 'Geçerli paket reddedilir; operasyon aksar.',
    mitigation: 'Oturum bazlı dedup (in-memory) + saklama politikası.',
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

export const EDGE_STATS = {
  total: EDGE_CASES.length,
  critical: EDGE_CASES.filter((e) => e.severity === 'critical').length,
  high: EDGE_CASES.filter((e) => e.severity === 'high').length,
  medium: EDGE_CASES.filter((e) => e.severity === 'medium').length,
}
