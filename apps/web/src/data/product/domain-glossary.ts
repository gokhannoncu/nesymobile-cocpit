// ─── Domain Entity Sözlüğü (Ubiquitous Language) ────────────────────────────
// NeSy Mobile uygulamasının domain varlıkları, hiyerarşik ilişkileri,
// statü geçişleri ve statü yayılım kuralları.

// ═══ Temel Tipler ══════════════════════════════════════════════════════════

export type EntityLevel = 0 | 1 | 2 | 3 | 4 | 5

export type StatusPropagation = 'up' | 'down' | 'both' | 'none'

export interface StatusDef {
  code: string
  label: string
  color: string       // tailwind color name (e.g. 'green', 'red')
  description: string
  isTerminal: boolean
}

export interface StatusTransition {
  from: string
  to: string
  trigger: string
  condition?: string
  propagation?: string  // human-readable description
}

export interface PropagationRule {
  id: string
  direction: StatusPropagation
  title: string
  description: string
  example: string
  fromEntity: string
  toEntity: string
}

export interface DomainEntity {
  id: string
  name: string
  turkishName: string
  aliases: string[]
  level: EntityLevel
  parentId: string | null
  childIds: string[]
  icon: string             // lucide icon name
  color: string            // tone color
  definition: string
  businessContext: string
  technicalContext: string
  cardinality: string      // e.g. '1:N', '1:1'
  cardinalityDesc: string  // human-readable
  screens: string[]        // related app screens
  antiPatterns: string[]   // common misunderstandings
  statuses: StatusDef[]
  transitions: StatusTransition[]
  keyAttributes: { name: string; type: string; description: string }[]
  relatedEntities: string[]
  prerequisiteIds: string[]  // entities to understand BEFORE this one
}

export interface EntityRelation {
  from: string
  to: string
  label: string
  cardinality: string
  description: string
}

// ═══ Domain Entity Tanımları ═══════════════════════════════════════════════

export const entities: DomainEntity[] = [
  // ─── Level 0: Schedule (En üst) ────────────────────────────────────────
  {
    id: 'schedule',
    name: 'Schedule',
    turkishName: 'Çizelge',
    aliases: ['Günlük Plan', 'Gün Planı', 'Daily Schedule'],
    level: 0,
    parentId: null,
    childIds: ['route'],
    icon: 'Calendar',
    color: 'purple',
    definition: 'Bir kuryenin belirli bir gün için aldığı tüm iş yükünü kapsayan en üst düzey varlık. Schedule, kuryenin sabah hub\'dan çıkıp akşam hub\'a dönene kadarki tüm operasyonun kapsayıcısıdır.',
    businessContext: 'Her kurye her gün tek bir Schedule alır. Schedule "yüklendi" olduğunda kurye güne başlayabilir; tüm işler tamamlandığında "tamamlandı" olarak kapatılır. Schedule kapatılmadan End of Day raporu oluşturulamaz.',
    technicalContext: 'StopListFragment içinde yüklenir. SharedViewModel.loadSchedule() çağrısıyla backend\'den çekilir. Offline mode\'da Room DB\'den okunur. 7059 satırlık monster fragment bu entity\'nin orchestration\'ını yapıyor.',
    cardinality: '1:N',
    cardinalityDesc: '1 Schedule → N Route',
    screens: ['Stop List', 'End of Day'],
    antiPatterns: [
      '❌ Schedule = Route değildir. Bir Schedule birden fazla Route içerebilir.',
      '❌ Schedule kapatılmadan yeni Schedule yüklenemez.',
      '❌ Schedule sadece teslimat değildir, pickup ve collection\'ları da kapsar.',
    ],
    statuses: [
      { code: 'NOT_LOADED', label: 'Yüklenmedi', color: 'gray', description: 'Schedule henüz backend\'den çekilmedi.', isTerminal: false },
      { code: 'LOADED', label: 'Yüklendi', color: 'blue', description: 'Schedule başarıyla indirildi, stop listesi gösteriliyor.', isTerminal: false },
      { code: 'IN_PROGRESS', label: 'Devam Ediyor', color: 'amber', description: 'En az bir Stop/Task üzerinde işlem başladı.', isTerminal: false },
      { code: 'COMPLETED', label: 'Tamamlandı', color: 'green', description: 'Tüm Route, Stop ve Task\'lar final durumda.', isTerminal: true },
      { code: 'FORCE_CLOSED', label: 'Zorla Kapatıldı', color: 'red', description: 'Operasyon yöneticisi tarafından manuel kapatıldı.', isTerminal: true },
    ],
    transitions: [
      { from: 'NOT_LOADED', to: 'LOADED', trigger: 'loadSchedule()', condition: 'Backend bağlantısı veya offline cache mevcut' },
      { from: 'LOADED', to: 'IN_PROGRESS', trigger: 'İlk Stop/Task başlatıldığında', propagation: '⬆ İlk child IN_PROGRESS olunca otomatik' },
      { from: 'IN_PROGRESS', to: 'COMPLETED', trigger: 'Tüm child Route\'lar COMPLETED', propagation: '⬆ Tüm child\'lar tamamlanınca otomatik' },
      { from: 'IN_PROGRESS', to: 'FORCE_CLOSED', trigger: 'Yönetici müdahalesi', condition: 'Supervisor override yetkisi gerekli' },
    ],
    keyAttributes: [
      { name: 'scheduleId', type: 'String', description: 'Backend tarafından atanan unique ID' },
      { name: 'date', type: 'LocalDate', description: 'Çizelge tarihi (YYYY-MM-DD)' },
      { name: 'courierId', type: 'String', description: 'Atanan kuryenin ID\'si' },
      { name: 'hubId', type: 'String', description: 'Başlangıç hub\'ının ID\'si' },
      { name: 'totalStops', type: 'Int', description: 'Toplam durak sayısı' },
      { name: 'completedStops', type: 'Int', description: 'Tamamlanan durak sayısı' },
    ],
    relatedEntities: ['route', 'stop'],
    prerequisiteIds: [],
  },

  // ─── Level 1: Route ────────────────────────────────────────────────────
  {
    id: 'route',
    name: 'Route',
    turkishName: 'Rota',
    aliases: ['Tur', 'Güzergâh', 'Tour'],
    level: 1,
    parentId: 'schedule',
    childIds: ['stop'],
    icon: 'Route',
    color: 'blue',
    definition: 'Schedule içindeki coğrafi olarak gruplandırılmış durak (Stop) dizisi. Bir Route, kuryenin belirli bir bölgedeki teslimat/toplama rotasını temsil eder.',
    businessContext: 'Route\'lar genellikle posta kodu veya bölge bazlı oluşturulur. Kurye, Route Selection ekranında aktif Route\'u seçer. Bir Schedule birden fazla Route içerebilir (örn. sabah teslimat rotası + öğleden sonra pickup rotası).',
    technicalContext: 'Route Selection ekranında gösterilir. Route optimizasyonu backend\'de yapılır ama sıralama mobile\'a iletilmediği için kurye manuel sıralama yapıyor (Ticket #601). GPS bazlı re-routing henüz implemente değil.',
    cardinality: '1:N',
    cardinalityDesc: '1 Route → N Stop',
    screens: ['Route Selection', 'Stop List', 'Map/Navigation'],
    antiPatterns: [
      '❌ Route = Schedule değildir. Schedule güne, Route coğrafyaya bağlıdır.',
      '❌ Route sıralaması GPS optimize DEĞİLDİR — manuel sıralamaya güvenilmemelidir.',
      '❌ Route boş olamaz — en az 1 Stop içermelidir.',
    ],
    statuses: [
      { code: 'PENDING', label: 'Bekliyor', color: 'gray', description: 'Route henüz başlatılmadı.', isTerminal: false },
      { code: 'SELECTED', label: 'Seçildi', color: 'blue', description: 'Kurye bu Route\'u aktif Route olarak seçti.', isTerminal: false },
      { code: 'IN_PROGRESS', label: 'Devam Ediyor', color: 'amber', description: 'Route\'taki en az bir Stop üzerinde işlem var.', isTerminal: false },
      { code: 'COMPLETED', label: 'Tamamlandı', color: 'green', description: 'Tüm Stop\'lar final durumda (teslim edildi veya başarısız).', isTerminal: true },
    ],
    transitions: [
      { from: 'PENDING', to: 'SELECTED', trigger: 'Kurye Route Selection\'da seçim yapar' },
      { from: 'SELECTED', to: 'IN_PROGRESS', trigger: 'İlk Stop üzerinde işlem başladığında', propagation: '⬆ Schedule → IN_PROGRESS' },
      { from: 'IN_PROGRESS', to: 'COMPLETED', trigger: 'Tüm Stop\'lar final durumda', propagation: '⬆ Tüm Route\'lar tamamlanınca Schedule → COMPLETED' },
    ],
    keyAttributes: [
      { name: 'routeId', type: 'String', description: 'Route unique ID' },
      { name: 'routeCode', type: 'String', description: 'Bölge/posta kodu bazlı Route kodu' },
      { name: 'sequence', type: 'Int', description: 'Schedule içindeki sıra numarası' },
      { name: 'optimizedOrder', type: 'List<Int>', description: 'GPS bazlı önerilen sıralama (henüz aktif değil)' },
    ],
    relatedEntities: ['schedule', 'stop'],
    prerequisiteIds: ['schedule'],
  },

  // ─── Level 2: Stop ─────────────────────────────────────────────────────
  {
    id: 'stop',
    name: 'Stop',
    turkishName: 'Durak',
    aliases: ['Teslimat Noktası', 'Adres', 'Delivery Point'],
    level: 2,
    parentId: 'route',
    childIds: ['task'],
    icon: 'MapPin',
    color: 'teal',
    definition: 'Kuryenin fiziksel olarak durduğu coğrafi konum. Bir adresteki tüm işlemleri (teslimat, toplama, iade) gruplar. Stop, kurye ile müşterinin yüz yüze geldiği noktadır.',
    businessContext: 'Bir Stop, aynı adrese giden birden fazla Task\'ı bir araya getirir. Örneğin: aynı apartmana 3 teslimat + 1 toplama olabilir = 4 Task, 1 Stop. Merge Stop özelliği ile aynı adresteki Stop\'lar birleştirilebilir.',
    technicalContext: 'StopListFragment\'ta render edilir. O(n⁴) performans sorunu burada: stop→task→shipment→shipmentItem nested iteration. Stop merge algoritması da bu fragment\'ta implemente edilmiş. DiffUtil yerine notifyDataSetChanged() kullanılıyor.',
    cardinality: '1:N',
    cardinalityDesc: '1 Stop → N Task',
    screens: ['Stop List', 'Map/Navigation'],
    antiPatterns: [
      '❌ Stop = Shipment değildir. Bir Stop birden fazla Shipment\'ı barındırabilir.',
      '❌ Stop adresi = GPS koordinatı değildir. Adres çözümlemesi ayrı bir süreçtir.',
      '❌ Stop kapatılmadan sonraki Stop\'a geçilmemelidir (ama şu an teknik olarak mümkün).',
      '❌ "Boş Stop" olabilir — tüm Task\'lar iptal edilirse Stop da cancel olur.',
    ],
    statuses: [
      { code: 'PENDING', label: 'Bekliyor', color: 'gray', description: 'Stop\'a henüz varılmadı.', isTerminal: false },
      { code: 'ARRIVED', label: 'Varıldı', color: 'blue', description: 'Kurye Stop konumuna GPS bazlı vardı.', isTerminal: false },
      { code: 'IN_PROGRESS', label: 'İşlemde', color: 'amber', description: 'En az bir Task üzerinde operasyon yapılıyor.', isTerminal: false },
      { code: 'COMPLETED', label: 'Tamamlandı', color: 'green', description: 'Tüm Task\'lar final durumda.', isTerminal: true },
      { code: 'SKIPPED', label: 'Atlandı', color: 'orange', description: 'Kurye bu durağı atladı (izinli).', isTerminal: true },
      { code: 'CANCELLED', label: 'İptal', color: 'red', description: 'Tüm Task\'lar iptal edildi.', isTerminal: true },
    ],
    transitions: [
      { from: 'PENDING', to: 'ARRIVED', trigger: 'GPS proximity veya manuel "Vardım" tıklaması', condition: 'GPS fix alınabilmeli (0,0 koordinat sorunu — Ticket #1001)' },
      { from: 'ARRIVED', to: 'IN_PROGRESS', trigger: 'İlk Task üzerinde işlem başladığında' },
      { from: 'IN_PROGRESS', to: 'COMPLETED', trigger: 'Tüm Task\'lar teslim veya başarısız', propagation: '⬆ Route → progress check' },
      { from: 'PENDING', to: 'SKIPPED', trigger: 'Kurye "Atla" seçer', condition: 'Skip izni gerekebilir' },
      { from: 'PENDING', to: 'CANCELLED', trigger: 'Tüm child Task\'lar iptal edilince', propagation: '⬆ Otomatik' },
    ],
    keyAttributes: [
      { name: 'stopId', type: 'String', description: 'Stop unique ID' },
      { name: 'address', type: 'Address', description: 'Tam adres (sokak, bina, kat, daire)' },
      { name: 'latitude', type: 'Double', description: 'GPS enlem (0,0 olabilir — bilinen sorun!)' },
      { name: 'longitude', type: 'Double', description: 'GPS boylam' },
      { name: 'sequence', type: 'Int', description: 'Route içindeki sıra numarası' },
      { name: 'taskCount', type: 'Int', description: 'Bu duraktaki toplam Task sayısı' },
      { name: 'timeWindow', type: 'TimeWindow?', description: 'Teslimat zaman penceresi (UTC — timezone sorunu var!)' },
    ],
    relatedEntities: ['route', 'task', 'shipment'],
    prerequisiteIds: ['schedule', 'route'],
  },

  // ─── Level 3: Task ─────────────────────────────────────────────────────
  {
    id: 'task',
    name: 'Task',
    turkishName: 'Görev',
    aliases: ['İş Emri', 'İşlem', 'Job', 'Work Order'],
    level: 3,
    parentId: 'stop',
    childIds: ['shipment'],
    icon: 'ClipboardCheck',
    color: 'indigo',
    definition: 'Bir Stop\'ta yapılacak tek atomik iş birimi. Task, kuryenin o durakta gerçekleştireceği belirli bir eylem türünü temsil eder: teslimat, toplama veya iade.',
    businessContext: 'Bir Task "ne yapılacağını" tanımlar. Aynı Stop\'ta farklı tipte Task\'lar olabilir (örn: 2 Delivery Task + 1 Pickup Task). Task tipi, kuryenin hangi akışı takip edeceğini belirler. TaskListFragment 5864 satırdır — 5 farklı ödeme yöntemi (Cash/CreditCard/RaiPay/SoftPOS/WPOS) burada yönetilir.',
    technicalContext: 'TaskListFragment\'ta detayları gösterilir. whenBarcodeDetect() 200+ satırlık when bloğu ile barkod→Task eşleştirmesi yapılır. Her ödeme yöntemi ayrı intent flow\'u gerektirir. Payment state machine yok — mutable flag\'lerle yönetiliyor.',
    cardinality: '1:N',
    cardinalityDesc: '1 Task → N Shipment',
    screens: ['Task List', 'Delivery', 'Pick Up'],
    antiPatterns: [
      '❌ Task = Shipment değildir. Task "ne yapılacağını", Shipment "neyin taşındığını" ifade eder.',
      '❌ Task tipi runtime\'da değişmez — oluşturulurken belirlenir.',
      '❌ Bir Task birden fazla Shipment içerebilir (çoklu paket teslimatlarda).',
      '❌ Task ödemesi = Shipment ödemesi değildir. Ödeme Task seviyesinde toplanır ama Shipment bazında bölünür.',
    ],
    statuses: [
      { code: 'PENDING', label: 'Bekliyor', color: 'gray', description: 'Task henüz başlatılmadı.', isTerminal: false },
      { code: 'IN_PROGRESS', label: 'İşlemde', color: 'amber', description: 'Barkod tarandı veya teslimat akışı başladı.', isTerminal: false },
      { code: 'DELIVERED', label: 'Teslim Edildi', color: 'green', description: 'Gönderi(ler) başarıyla teslim edildi.', isTerminal: true },
      { code: 'FAILED', label: 'Başarısız', color: 'red', description: 'Teslimat başarısız — neden kodu seçildi.', isTerminal: true },
      { code: 'PARTIAL', label: 'Kısmi Teslim', color: 'orange', description: 'Shipment\'ların bir kısmı teslim, bir kısmı başarısız.', isTerminal: true },
      { code: 'CANCELLED', label: 'İptal', color: 'red', description: 'Task backend tarafından iptal edildi.', isTerminal: true },
    ],
    transitions: [
      { from: 'PENDING', to: 'IN_PROGRESS', trigger: 'Barkod tarama veya Task detay açma' },
      { from: 'IN_PROGRESS', to: 'DELIVERED', trigger: 'İmza + ödeme + fiş alındı', propagation: '⬆ Stop → progress check, ⬇ Tüm Shipment\'lar → DELIVERED' },
      { from: 'IN_PROGRESS', to: 'FAILED', trigger: 'Başarısız neden kodu seçildi + fotoğraf', propagation: '⬆ Stop → progress check, ⬇ Tüm Shipment\'lar → FAILED' },
      { from: 'IN_PROGRESS', to: 'PARTIAL', trigger: 'Bazı Shipment\'lar teslim, bazıları başarısız', propagation: '⬆ Stop → progress check' },
    ],
    keyAttributes: [
      { name: 'taskId', type: 'String', description: 'Task unique ID' },
      { name: 'taskType', type: 'TaskType', description: 'DELIVERY | PICKUP | RETURN | COLLECTION' },
      { name: 'codAmount', type: 'BigDecimal?', description: 'Kapıda ödenecek tutar (COD)' },
      { name: 'paymentMethod', type: 'PaymentMethod?', description: 'Cash | CreditCard | RaiPay | SoftPOS | WPOS' },
      { name: 'failedReason', type: 'FailedReason?', description: 'Başarısız teslimat neden kodu' },
      { name: 'signature', type: 'Bitmap?', description: 'Dijital imza verisi' },
      { name: 'photo', type: 'URI?', description: 'Teslimat/başarısız kanıt fotoğrafı' },
    ],
    relatedEntities: ['stop', 'shipment', 'collection'],
    prerequisiteIds: ['schedule', 'route', 'stop'],
  },

  // ─── Level 4: Shipment ─────────────────────────────────────────────────
  {
    id: 'shipment',
    name: 'Shipment',
    turkishName: 'Gönderi',
    aliases: ['Kargo', 'Paket', 'Parcel', 'Consignment'],
    level: 4,
    parentId: 'task',
    childIds: ['shipment-item'],
    icon: 'Package',
    color: 'orange',
    definition: 'Fiziksel olarak taşınan tek bir gönderi birimi. Bir barkod numarası ile tanımlanır. Shipment, lojistik zincirindeki izlenebilir birimdir.',
    businessContext: 'Shipment müşterinin "paketim nerede?" sorusunun cevabıdır. Her Shipment\'ın barkodu taranarak teslimat onaylanır. Bir Task birden fazla Shipment içerebilir (örn: aynı alıcıya 3 paketlik sipariş). COD tahsilatı Shipment bazında hesaplanır ama Task seviyesinde toplanır.',
    technicalContext: 'DeliveryFragment\'ta (4113 satır) işlenir. deliverShipment() 160 satır, 5 seviye nesting. Fragment doğrudan shipmentItem.shipmentItemStatus mutate ediyor — ViewModel bypass. Barkod → Shipment eşleştirmesi O(n⁴) karmaşıklıkta (JSON blob parse).',
    cardinality: '1:N',
    cardinalityDesc: '1 Shipment → N ShipmentItem',
    screens: ['Delivery', 'Shipment Detail', 'Shipment Tracking', 'Pick Up'],
    antiPatterns: [
      '❌ Shipment = Task değildir. Bir Task birden fazla Shipment içerebilir.',
      '❌ Shipment barkodu = tracking numarası olabilir ama her zaman değildir.',
      '❌ Shipment statüsü doğrudan değiştirilmez — Task statüsünden propagate edilir.',
      '❌ Shipment silinmez — sadece statüsü değişir.',
    ],
    statuses: [
      { code: 'IN_TRANSIT', label: 'Yolda', color: 'blue', description: 'Gönderi kurye aracında.', isTerminal: false },
      { code: 'OUT_FOR_DELIVERY', label: 'Dağıtımda', color: 'amber', description: 'Kurye teslimat noktasına doğru yolda.', isTerminal: false },
      { code: 'DELIVERED', label: 'Teslim Edildi', color: 'green', description: 'Alıcıya başarıyla teslim edildi.', isTerminal: true },
      { code: 'FAILED', label: 'Başarısız', color: 'red', description: 'Teslimat başarısız oldu.', isTerminal: true },
      { code: 'RETURNED', label: 'İade', color: 'orange', description: 'Gönderi hub\'a iade edildi.', isTerminal: true },
      { code: 'AT_LOCKER', label: 'Locker\'da', color: 'indigo', description: 'D4Me/Locker noktasına bırakıldı.', isTerminal: false },
    ],
    transitions: [
      { from: 'IN_TRANSIT', to: 'OUT_FOR_DELIVERY', trigger: 'Schedule yüklendiğinde otomatik' },
      { from: 'OUT_FOR_DELIVERY', to: 'DELIVERED', trigger: 'Task → DELIVERED', propagation: '⬇ Tüm ShipmentItem\'lar → DELIVERED' },
      { from: 'OUT_FOR_DELIVERY', to: 'FAILED', trigger: 'Task → FAILED', propagation: '⬇ Tüm ShipmentItem\'lar → FAILED' },
      { from: 'OUT_FOR_DELIVERY', to: 'AT_LOCKER', trigger: 'Locker\'a bırakıldığında' },
      { from: 'FAILED', to: 'RETURNED', trigger: 'End of Day sırasında hub\'a iade' },
    ],
    keyAttributes: [
      { name: 'shipmentId', type: 'String', description: 'Gönderi unique ID' },
      { name: 'barcode', type: 'String', description: 'Fiziksel barkod numarası (taranır)' },
      { name: 'trackingNumber', type: 'String', description: 'Müşteriye verilen takip numarası' },
      { name: 'weight', type: 'Double', description: 'Ağırlık (kg)' },
      { name: 'dimensions', type: 'Dimensions?', description: 'Boyut bilgisi (en×boy×yükseklik)' },
      { name: 'codAmount', type: 'BigDecimal?', description: 'Kapıda tahsil edilecek tutar' },
      { name: 'consignee', type: 'Consignee', description: 'Alıcı bilgileri (ad, telefon)' },
    ],
    relatedEntities: ['task', 'shipment-item', 'collection'],
    prerequisiteIds: ['schedule', 'route', 'stop', 'task'],
  },

  // ─── Level 5: ShipmentItem ─────────────────────────────────────────────
  {
    id: 'shipment-item',
    name: 'ShipmentItem',
    turkishName: 'Gönderi Kalemi',
    aliases: ['Paket Parçası', 'Koli', 'Item', 'Piece'],
    level: 5,
    parentId: 'shipment',
    childIds: [],
    icon: 'Box',
    color: 'amber',
    definition: 'Bir Shipment\'ın fiziksel parçası. Çoklu parçalı gönderilerde her koli ayrı bir ShipmentItem olarak izlenir. Tekil gönderilerde Shipment = 1 ShipmentItem.',
    businessContext: 'Büyük siparişlerde bir gönderi birden fazla koliden oluşabilir (örn: mobilya siparişi = 3 koli). Her koli ayrı taranır ve ayrı izlenir. Tüm koli\'ler teslim edilmeden Shipment tamamlanmaz.',
    technicalContext: 'DeliveryFragment\'ta doğrudan shipmentItem.shipmentItemStatus mutate ediliyor — bu anti-pattern. O(n⁴) iteration\'ın en iç döngüsü bu entity. Her item ayrı barkod tarama gerektirir.',
    cardinality: '—',
    cardinalityDesc: 'Yaprak düğüm — alt varlığı yok',
    screens: ['Delivery', 'Shipment Detail'],
    antiPatterns: [
      '❌ ShipmentItem statüsü doğrudan Fragment\'tan mutate edilmemeli — ViewModel üzerinden yönetilmeli.',
      '❌ Tüm ShipmentItem\'lar taranmadan Shipment teslim edilmemeli.',
    ],
    statuses: [
      { code: 'PENDING', label: 'Bekliyor', color: 'gray', description: 'Henüz taranmadı.', isTerminal: false },
      { code: 'SCANNED', label: 'Tarandı', color: 'blue', description: 'Barkod başarıyla tarandı.', isTerminal: false },
      { code: 'DELIVERED', label: 'Teslim', color: 'green', description: 'Koli teslim edildi.', isTerminal: true },
      { code: 'FAILED', label: 'Başarısız', color: 'red', description: 'Koli teslim edilemedi.', isTerminal: true },
      { code: 'DAMAGED', label: 'Hasarlı', color: 'orange', description: 'Koli hasarlı olarak işaretlendi.', isTerminal: false },
    ],
    transitions: [
      { from: 'PENDING', to: 'SCANNED', trigger: 'Barkod tarandığında' },
      { from: 'SCANNED', to: 'DELIVERED', trigger: 'Task → DELIVERED', propagation: '⬆ Shipment → progress check' },
      { from: 'SCANNED', to: 'FAILED', trigger: 'Task → FAILED' },
      { from: 'PENDING', to: 'DAMAGED', trigger: 'Hasar bildirimi', condition: 'Fotoğraf zorunlu' },
    ],
    keyAttributes: [
      { name: 'itemId', type: 'String', description: 'Item unique ID' },
      { name: 'barcode', type: 'String', description: 'Fiziksel barkod (farklı parçalar farklı barkod)' },
      { name: 'sequence', type: 'Int', description: 'Shipment içindeki sıra' },
      { name: 'weight', type: 'Double', description: 'Koli ağırlığı' },
    ],
    relatedEntities: ['shipment'],
    prerequisiteIds: ['schedule', 'route', 'stop', 'task', 'shipment'],
  },

  // ─── Cross-cutting: Collection ─────────────────────────────────────────
  {
    id: 'collection',
    name: 'Collection',
    turkishName: 'Tahsilat',
    aliases: ['Ödeme', 'COD', 'Cash on Delivery', 'Kapıda Ödeme'],
    level: 3,
    parentId: null,
    childIds: [],
    icon: 'Wallet',
    color: 'green',
    definition: 'Teslimat sırasında alıcıdan toplanan ödeme. Collection, Task ile 1:1 ilişkide olup Shipment bazında hesaplanan tutarların toplamıdır.',
    businessContext: 'Her ülkede farklı ödeme yöntemleri desteklenir: Nakit, Kredi Kartı (RaiPay/SoftPOS/WPOS). Fiskalizasyon gerektiren ülkelerde (RS) ödeme alındığında otomatik fiş kesilir. Çift ödeme riski var — Ticket #438.',
    technicalContext: 'TaskListFragment\'ta 5 farklı ödeme yöntemi yönetiliyor. CollectionType mismatch sessizce Crashlytics\'e loglanıyor (anti-pattern). Payment state machine yok — mutable flag\'lerle yönetiliyor. Çift tıklama guard eklenecek (Sprint 23).',
    cardinality: '1:1',
    cardinalityDesc: 'Task ile 1:1 ilişki',
    screens: ['Task List', 'Delivery', 'End of Day'],
    antiPatterns: [
      '❌ Collection tutarı Shipment bazında hesaplanır ama Task seviyesinde tahsil edilir.',
      '❌ Kısmi ödeme mantığı karmaşık — kalan tutar hesaplamasında float aritmetik sorunu var.',
      '❌ Çift tıklama durumunda çift ödeme kaydı oluşabiliyor (guard eksik).',
      '❌ Fiskalizasyon timeout\'u main thread\'i blokluyor.',
    ],
    statuses: [
      { code: 'NOT_REQUIRED', label: 'Gerekmez', color: 'gray', description: 'Bu Task için ödeme gerekmez.', isTerminal: true },
      { code: 'PENDING', label: 'Bekliyor', color: 'amber', description: 'Ödeme henüz alınmadı.', isTerminal: false },
      { code: 'COLLECTED', label: 'Tahsil Edildi', color: 'green', description: 'Ödeme başarıyla alındı.', isTerminal: true },
      { code: 'PARTIAL', label: 'Kısmi', color: 'orange', description: 'Tutarın bir kısmı tahsil edildi.', isTerminal: false },
      { code: 'SKIPPED', label: 'Atlandı', color: 'red', description: 'Ödeme atlandı (Skip ExW).', isTerminal: true },
    ],
    transitions: [
      { from: 'PENDING', to: 'COLLECTED', trigger: 'Ödeme alındı (nakit/kart)', propagation: 'Task → DELIVERED ön koşulu' },
      { from: 'PENDING', to: 'PARTIAL', trigger: 'Kısmi tutar alındı' },
      { from: 'PARTIAL', to: 'COLLECTED', trigger: 'Kalan tutar alındı' },
      { from: 'PENDING', to: 'SKIPPED', trigger: 'Skip ExW seçildi', condition: 'Ülke konfigürasyonunda izinli olmalı' },
    ],
    keyAttributes: [
      { name: 'collectionId', type: 'String', description: 'Tahsilat unique ID' },
      { name: 'amount', type: 'BigDecimal', description: 'Toplam tahsil edilecek tutar' },
      { name: 'collectedAmount', type: 'BigDecimal', description: 'Tahsil edilen tutar' },
      { name: 'paymentMethod', type: 'PaymentMethod', description: 'Cash | CreditCard | RaiPay | SoftPOS | WPOS' },
      { name: 'fiscalReceipt', type: 'FiscalReceipt?', description: 'Fiskalizasyon fişi (varsa)' },
    ],
    relatedEntities: ['task', 'shipment'],
    prerequisiteIds: ['task'],
  },

  // ─── Cross-cutting: D4Me / Locker ──────────────────────────────────────
  {
    id: 'locker',
    name: 'D4Me / Locker',
    turkishName: 'Posta Kutusu / Dolap',
    aliases: ['Akıllı Dolap', 'Parcel Locker', 'Self-Service Nokta'],
    level: 3,
    parentId: null,
    childIds: [],
    icon: 'DoorOpen',
    color: 'red',
    definition: 'Alıcının evde olmadığı durumlarda gönderinin bırakılabileceği otomatik dolap sistemi. QR kodu veya BLE ile açılır.',
    businessContext: 'D4Me locker\'ları özellikle HR ve SI\'da yaygın. Slot rezervasyonu backend tarafında yapılır (TTL 5 dakika ama mobile\'da countdown gösterilmiyor — Ticket #901). Locker pin kodu logcat\'te plaintext yazdırılıyor (güvenlik açığı — Ticket #902).',
    technicalContext: 'StopListFragment içinde D4Me akışı yönetiliyor. QR kod okuma düşük ışıkta sorunlu (Ticket #903). BLE bağlantı timeout\'u 5 saniye — retry mekanizması yok (Ticket #904). CameraX torch mode otomatik değil.',
    cardinality: '1:1',
    cardinalityDesc: 'Shipment ile 1:1 ilişki (bir gönderiye bir slot)',
    screens: ['D4Me/Locker', 'Stop List'],
    antiPatterns: [
      '❌ Locker slot = adres değildir. Locker konumu farklı bir Stop oluşturur.',
      '❌ Rezervasyon TTL\'i 5 dakika — countdown olmadan kurye habersiz slot kaybedebilir.',
      '❌ Pin kodu loglarda plaintext — güvenlik ihlali.',
    ],
    statuses: [
      { code: 'NO_LOCKER', label: 'Locker Yok', color: 'gray', description: 'Bu gönderi için locker teslimatı geçerli değil.', isTerminal: true },
      { code: 'RESERVED', label: 'Rezerve', color: 'blue', description: 'Slot rezerve edildi (TTL 5dk).', isTerminal: false },
      { code: 'OPENED', label: 'Açıldı', color: 'amber', description: 'Locker kapısı açıldı.', isTerminal: false },
      { code: 'DEPOSITED', label: 'Bırakıldı', color: 'green', description: 'Gönderi dolaba bırakıldı ve kapı kapatıldı.', isTerminal: true },
      { code: 'TIMEOUT', label: 'Zaman Aşımı', color: 'red', description: 'Rezervasyon süresi doldu.', isTerminal: true },
    ],
    transitions: [
      { from: 'NO_LOCKER', to: 'RESERVED', trigger: 'Backend slot atar', condition: 'Müsait slot olmalı' },
      { from: 'RESERVED', to: 'OPENED', trigger: 'QR/BLE ile kapı açıldığında' },
      { from: 'OPENED', to: 'DEPOSITED', trigger: 'Gönderi bırakılıp kapı kapatıldığında', propagation: '→ Shipment → AT_LOCKER' },
      { from: 'RESERVED', to: 'TIMEOUT', trigger: '5 dakika dolduğunda' },
    ],
    keyAttributes: [
      { name: 'lockerId', type: 'String', description: 'Locker istasyonu ID' },
      { name: 'slotId', type: 'String', description: 'Atanan slot numarası' },
      { name: 'pinCode', type: 'String', description: 'Alıcı pin kodu (⚠️ hassas veri!)' },
      { name: 'reservationExpiry', type: 'Instant', description: 'Rezervasyon bitiş zamanı' },
    ],
    relatedEntities: ['shipment', 'stop'],
    prerequisiteIds: ['shipment'],
  },
]

// ═══ İlişkiler (Hiyerarşi + Cross-cutting) ═════════════════════════════════

export const relations: EntityRelation[] = [
  // Hiyerarşik (dikey)
  { from: 'schedule', to: 'route', label: 'içerir', cardinality: '1:N', description: 'Bir Schedule birden fazla Route içerebilir.' },
  { from: 'route', to: 'stop', label: 'içerir', cardinality: '1:N', description: 'Bir Route birden fazla Stop içerir.' },
  { from: 'stop', to: 'task', label: 'gruplar', cardinality: '1:N', description: 'Bir Stop aynı adresteki Task\'ları gruplar.' },
  { from: 'task', to: 'shipment', label: 'taşır', cardinality: '1:N', description: 'Bir Task birden fazla Shipment içerebilir.' },
  { from: 'shipment', to: 'shipment-item', label: 'parçalanır', cardinality: '1:N', description: 'Bir Shipment birden fazla fiziksel parçadan oluşabilir.' },
  // Cross-cutting (yatay)
  { from: 'task', to: 'collection', label: 'tahsil eder', cardinality: '1:1', description: 'Bir Task\'ın bir Collection\'ı olabilir (COD varsa).' },
  { from: 'shipment', to: 'locker', label: 'bırakılabilir', cardinality: '1:1', description: 'Bir Shipment D4Me/Locker noktasına yönlendirilebilir.' },
]

// ═══ Statü Yayılım Kuralları ════════════════════════════════════════════════

export const propagationRules: PropagationRule[] = [
  {
    id: 'prop-up-completed',
    direction: 'up',
    title: 'Tamamlanma Yayılımı (⬆ Yukarı)',
    description: 'Alt varlıkların tamamı final duruma geçtiğinde, üst varlık otomatik olarak COMPLETED olur.',
    example: 'Tüm Task\'lar DELIVERED/FAILED → Stop COMPLETED → Route COMPLETED → Schedule COMPLETED',
    fromEntity: 'task',
    toEntity: 'schedule',
  },
  {
    id: 'prop-up-progress',
    direction: 'up',
    title: 'İlerleme Yayılımı (⬆ Yukarı)',
    description: 'İlk alt varlık IN_PROGRESS olduğunda, üst varlık da otomatik IN_PROGRESS olur.',
    example: 'İlk Task IN_PROGRESS → Stop IN_PROGRESS → Route IN_PROGRESS → Schedule IN_PROGRESS',
    fromEntity: 'task',
    toEntity: 'schedule',
  },
  {
    id: 'prop-down-delivered',
    direction: 'down',
    title: 'Teslimat Yayılımı (⬇ Aşağı)',
    description: 'Task DELIVERED olduğunda, altındaki tüm Shipment ve ShipmentItem\'lar da DELIVERED olur.',
    example: 'Task DELIVERED → Shipment DELIVERED → ShipmentItem DELIVERED',
    fromEntity: 'task',
    toEntity: 'shipment-item',
  },
  {
    id: 'prop-down-failed',
    direction: 'down',
    title: 'Başarısızlık Yayılımı (⬇ Aşağı)',
    description: 'Task FAILED olduğunda, altındaki tüm Shipment ve ShipmentItem\'lar da FAILED olur.',
    example: 'Task FAILED → Shipment FAILED → ShipmentItem FAILED',
    fromEntity: 'task',
    toEntity: 'shipment-item',
  },
  {
    id: 'prop-cancel',
    direction: 'up',
    title: 'İptal Yayılımı (⬆ Yukarı)',
    description: 'Tüm Task\'lar iptal edilirse, Stop otomatik olarak CANCELLED olur.',
    example: 'Tüm Task\'lar CANCELLED → Stop CANCELLED',
    fromEntity: 'task',
    toEntity: 'stop',
  },
  {
    id: 'prop-collection',
    direction: 'none',
    title: 'Tahsilat Bağımlılığı (↔ Yatay)',
    description: 'Collection COLLECTED olmadan Task DELIVERED olamaz (COD gönderilerde). Ödeme önce alınmalıdır.',
    example: 'Collection PENDING iken Task DELIVERED → HATA! Önce Collection COLLECTED olmalı.',
    fromEntity: 'collection',
    toEntity: 'task',
  },
]

// ═══ Öğrenme Sırası (Prerequisite Chain) ════════════════════════════════════

export const learningPath = [
  { entityId: 'schedule', step: 1, title: 'Başlangıç', hint: 'Her şey bir Schedule ile başlar — kuryenin günlük planı.' },
  { entityId: 'route', step: 2, title: 'Coğrafya', hint: 'Schedule\'ı coğrafi bölgelere ayırıyoruz.' },
  { entityId: 'stop', step: 3, title: 'Durak', hint: 'Kuryenin fiziksel olarak durduğu her yer bir Stop.' },
  { entityId: 'task', step: 4, title: 'İş', hint: 'Stop\'ta ne yapılacağını Task belirler.' },
  { entityId: 'shipment', step: 5, title: 'Gönderi', hint: 'Task\'ın taşıdığı fiziksel paket.' },
  { entityId: 'shipment-item', step: 6, title: 'Parça', hint: 'Çok kolili gönderilerin her bir parçası.' },
  { entityId: 'collection', step: 7, title: 'Tahsilat', hint: 'Kapıda ödeme alınması gereken durumlar.' },
  { entityId: 'locker', step: 8, title: 'Locker', hint: 'Alıcı yoksa gönderinin bırakılacağı akıllı dolap.' },
]
