// Field Ticket Intelligence — veri katmanı.
// Ticket'lar kendi kök neden metnini üretmez: her ticket kanonik bir ROOT_CAUSE
// kaydına, root cause'lar da kalıcı ACTION kayıtlarına bağlanır (Ticket → Belirti →
// Ekran → Kök Neden → Müdahale → Kalıcı Çözüm → Doğrulama → Tekrar Riski zinciri).
// Ticket kayıtları NesyArchitectureReport/tickets.json'dan üretilir (field-ticket-records.ts).

import type { Tone } from '@/components/product'
import { FIELD_TICKET_RECORDS } from './field-ticket-records'

// ── Tipler ───────────────────────────────────────────────────────

export type TicketSeverity = 'critical' | 'high' | 'medium'
export type TicketStatus = 'open' | 'closed'
export type RepeatRisk = 'high' | 'medium' | 'low'
export type FixType = 'none' | 'workaround' | 'permanent'

export interface FieldTicket {
  id: string // GH-4575
  ghId: number
  customerTicket: string // UAT-HR#2504
  title: string
  type: string // bug | enhancement | feature
  severity: TicketSeverity
  status: TicketStatus
  country: string // HR | RS | CEE | General
  date: string
  group: string // Finans & Ödeme, Barcode & Scan…
  screen: string
  symptom: string // kullanıcının/operasyonun gördüğü davranış
  location: string // kod içi konum
  rootCause: string // kanonik RC-xx
  contributing: string[] // katkı veren diğer RC'ler
  rootNote: string // bu ticket'a özgü kök neden notu
  confidence: number // 0-100 — kök neden teşhisine güven
  repeatRisk: RepeatRisk
  pastAttempt: string // ne denendi (workaround / geçmiş fix)
  whyInsufficient: string // neden yeterli olmadı / mevcut durum
  fix: string // önerilen kalıcı çözüm
  fixType: FixType // ticket kapanış şekli
  detectability: string | null // low | medium | high (story'den)
  edgeCases: string[]
  ghUrl: string
}

export type RootCauseStatus =
  | 'hypothesis'
  | 'investigating'
  | 'probable'
  | 'confirmed'
  | 'mitigated'
  | 'fixed'
  | 'verified'
  | 'accepted-risk'

export interface RootCause {
  id: string // RC-01
  title: string
  family: string // State & Race, Finans & Ödeme…
  mechanism: string // failure mechanism kısa etiketi
  status: RootCauseStatus
  confidence: 'low' | 'medium' | 'high' | 'verified'
  repeatRisk: RepeatRisk
  summary: string // kanonik teknik açıklama
  amplifiedBy: string[] // contributing factor'lar (metin)
  actions: string[] // ACT-xx
  edgeCases: string[]
  adrRefs: string[] // ADR / NESY-ARCH doküman referansları
}

export type ActionStatus =
  | 'proposed'
  | 'planned'
  | 'in-progress'
  | 'verification'
  | 'completed'
  | 'accepted-risk'

export interface ArchAction {
  id: string // ACT-01
  title: string
  type:
    | 'architecture'
    | 'code-fix'
    | 'instrumentation'
    | 'test-coverage'
    | 'monitoring'
    | 'process'
  status: ActionStatus
  rootCauses: string[] // RC-xx
  summary: string
  verification: string // doğrulama kriteri
  ref: string // ADR / NESY-ARCH referansı
}

// ── Meta haritalar ───────────────────────────────────────────────

export const SEVERITY_META: Record<TicketSeverity, { label: string; tone: Tone; rank: number }> = {
  critical: { label: 'Critical', tone: 'red', rank: 0 },
  high: { label: 'High', tone: 'orange', rank: 1 },
  medium: { label: 'Medium', tone: 'amber', rank: 2 },
}

export const RISK_META: Record<RepeatRisk, { label: string; tone: Tone; rank: number }> = {
  high: { label: 'Yüksek', tone: 'red', rank: 0 },
  medium: { label: 'Orta', tone: 'amber', rank: 1 },
  low: { label: 'Düşük', tone: 'green', rank: 2 },
}

export const FIX_TYPE_META: Record<FixType, { label: string; tone: Tone }> = {
  none: { label: 'Çözüm yok', tone: 'red' },
  workaround: { label: 'Workaround', tone: 'amber' },
  permanent: { label: 'Kalıcı', tone: 'green' },
}

export const RC_STATUS_META: Record<RootCauseStatus, { label: string; tone: Tone }> = {
  hypothesis: { label: 'Hypothesis', tone: 'gray' },
  investigating: { label: 'Under Investigation', tone: 'blue' },
  probable: { label: 'Probable', tone: 'indigo' },
  confirmed: { label: 'Confirmed', tone: 'orange' },
  mitigated: { label: 'Mitigated', tone: 'amber' },
  fixed: { label: 'Fixed', tone: 'teal' },
  verified: { label: 'Verified', tone: 'green' },
  'accepted-risk': { label: 'Accepted Risk', tone: 'purple' },
}

export const ACTION_STATUS_META: Record<ActionStatus, { label: string; tone: Tone }> = {
  proposed: { label: 'Proposed', tone: 'gray' },
  planned: { label: 'Planned', tone: 'blue' },
  'in-progress': { label: 'In Progress', tone: 'indigo' },
  verification: { label: 'Verification', tone: 'amber' },
  completed: { label: 'Completed', tone: 'green' },
  'accepted-risk': { label: 'Accepted Risk', tone: 'purple' },
}

export const ACTION_TYPE_LABEL: Record<ArchAction['type'], string> = {
  architecture: 'Architecture change',
  'code-fix': 'Code fix',
  instrumentation: 'Instrumentation',
  'test-coverage': 'Test coverage',
  monitoring: 'Monitoring',
  process: 'Operational process',
}

// ── Kanonik Root Cause havuzu ────────────────────────────────────
// Her kayıt birden fazla ticket'ın bağlandığı tek gerçek nedendir.

export const ROOT_CAUSES: RootCause[] = [
  {
    id: 'RC-01',
    title: 'Scan dispatch belirsizliği',
    family: 'Barcode & Scan',
    mechanism: 'Lifecycle race',
    status: 'confirmed',
    confidence: 'high',
    repeatRisk: 'high',
    summary:
      "Stop listten taranan barkodun MainActivity.onNewIntent() üzerinden hangi fragment'e gideceği navigation geçişi anında belirsiz. Eski fragment destroy olmadan scan event tetiklendiğinde event yanlış/ölmekte olan ekrana düşüyor ('barcode empty', 'stop not found', DEPS→TOUR hataları).",
    amplifiedBy: [
      'Fragment lifecycle timing garantisi yok',
      'Barkod ScheduleStopChunk JSON içinde — DB index yok',
      'Scan için tek giriş noktası (coordinator) yok',
    ],
    actions: ['ACT-06', 'ACT-01'],
    edgeCases: ['E31'],
    adrRefs: ['ADR-05', 'NESY-ARCH-001'],
  },
  {
    id: 'RC-02',
    title: 'JSON-chunk veri yapısı — normalize şema yok',
    family: 'Barcode & Scan',
    mechanism: 'Data model',
    status: 'confirmed',
    confidence: 'high',
    repeatRisk: 'high',
    summary:
      "Shipment/barkod verisi ScheduleStopChunk içinde JSON blob olarak saklanıyor; DB kolonu ve index yok. Her arama O(n) lineer JSON parse gerektiriyor — büyük schedule'larda main thread donması (ANR), alan bazlı gösterimlerde (shipper adı vb.) parse zorunluluğu.",
    amplifiedBy: ['Main thread üzerinde parse', 'Alan bazlı sorgu imkânı yok'],
    actions: ['ACT-01'],
    edgeCases: ['E34'],
    adrRefs: ['NESY-ARCH-001'],
  },
  {
    id: 'RC-03',
    title: 'Barkod eşleştirme kopyaları tutarsız',
    family: 'Barcode & Scan',
    mechanism: 'Duplicated logic',
    status: 'confirmed',
    confidence: 'high',
    repeatRisk: 'medium',
    summary:
      "Barkod/stop eşleştirme mantığı 5+ farklı yerde kopya olarak yaşıyor. Merged stop toplu işlemleri ve RDOC/dely stop gruplaması kopyalar arasında tutarsız çalışıyor; atomik toplu güncelleme yapılamıyor.",
    amplifiedBy: ['God Object içinde dağınık akış', 'Room transaction kullanılmıyor'],
    actions: ['ACT-01', 'ACT-15'],
    edgeCases: ['E32'],
    adrRefs: ['NESY-ARCH-001', 'NESY-ARCH-003'],
  },
  {
    id: 'RC-04',
    title: 'Scan dedup state uçucu — SharedPreferences bayatlıyor',
    family: 'Barcode & Scan',
    mechanism: 'Volatile state',
    status: 'confirmed',
    confidence: 'high',
    repeatRisk: 'medium',
    summary:
      "Okutulmuş barkod listesi SharedPreferences'ta tutuluyor; restart sonrası bayatlıyor veya kayboluyor. Aynı pickup barkodu tekrar okutulduğunda mükerrer parsel oluşuyor, mükerrer uyarı güvenilir verilemiyor.",
    amplifiedBy: ['UI debounce yok', 'Idempotency key yok'],
    actions: ['ACT-06', 'ACT-04'],
    edgeCases: ['E33'],
    adrRefs: ['ADR-09'],
  },
  {
    id: 'RC-05',
    title: 'FCM × UI race — atomik olmayan shipment state yazımı',
    family: 'State & Race',
    mechanism: 'Race condition',
    status: 'confirmed',
    confidence: 'high',
    repeatRisk: 'high',
    summary:
      "FCM refresh ile UI event'i aynı shipment state'ini eş zamanlı, transaction'sız güncelliyor; last-writer-wins ile çift TOUR/DELY eventi ve bildirim sonrası scan crash'i üretiyor. Son-trigger kontrolleri atomik olmadığı için iki thread aynı eski state'i okuyabiliyor.",
    amplifiedBy: [
      'SharedViewModel (3.450 LOC) global mutable state',
      'Room transaction yok',
      'Event ordering garantisi yok',
      'Idempotency key yok',
    ],
    actions: ['ACT-05', 'ACT-04', 'ACT-09'],
    edgeCases: ['ES1', 'ES3', 'ES4'],
    adrRefs: ['NESY-ARCH-001', 'NESY-ARCH-005', 'ADR-02'],
  },
  {
    id: 'RC-06',
    title: 'Üç doğruluk kaynağı — Room / bellek / SharedPreferences desync',
    family: 'State & Race',
    mechanism: 'No SSoT',
    status: 'confirmed',
    confidence: 'high',
    repeatRisk: 'high',
    summary:
      "Aynı veri Room, bellek ve SharedPreferences'ta bağımsız güncelleniyor; senkron garantisi yok. Rota değişince eski rota kuryede kalıyor, teslim edilen gönderi tracking'de 'Not Delivered' görünüyor, servis tipi yanlış kaynaktan okunuyor.",
    amplifiedBy: ['Reactive tek kaynak (DAO Flow) yok', 'ScheduleIngestor atomik replace yapmıyor'],
    actions: ['ACT-02', 'ACT-03'],
    edgeCases: ['ES1', 'ES2'],
    adrRefs: ['NESY-ARCH-002', 'NESY-ARCH-003'],
  },
  {
    id: 'RC-07',
    title: 'Stale in-memory state — currentTask temizlenmiyor',
    family: 'State & Race',
    mechanism: 'Stale state',
    status: 'confirmed',
    confidence: 'high',
    repeatRisk: 'medium',
    summary:
      "Tamamlanan task bellekteki SharedViewModel._currentTask'ta temizlenmediği için assign tab'da 'bitmemiş' görünmeye devam ediyor. Manuel temizleme yamaları God Object içinde eksik/unutulmuş noktalar bıraktığı için tekrarlıyor.",
    amplifiedBy: ['God Object tek paylaşılan state', 'DB yerine bellekten okuma'],
    actions: ['ACT-03', 'ACT-09'],
    edgeCases: ['ES7'],
    adrRefs: ['NESY-ARCH-003'],
  },
  {
    id: 'RC-08',
    title: 'Outbox yok — memory queue, FIFO ve idempotency garantisi yok',
    family: 'Event & Sync',
    mechanism: 'Unreliable delivery',
    status: 'confirmed',
    confidence: 'high',
    repeatRisk: 'high',
    summary:
      "Event'ler (DELY, CASH, rezervasyon…) RequestSenderService memory kuyruğunda bekliyor. Telefon kapanınca/app kill'de kayboluyor, paralel event'lerde sıra bozuluyor (DDSP→LCR), idempotency olmadığı için mükerrer gönderim oluşuyor.",
    amplifiedBy: ['Persist edilmeyen kuyruk', 'Event sıralama garantisi yok', 'Retry mükerrer üretiyor'],
    actions: ['ACT-04', 'ACT-07'],
    edgeCases: ['E7', 'E9', 'E10', 'ED3'],
    adrRefs: ['NESY-ARCH-004', 'ADR-07'],
  },
  {
    id: 'RC-09',
    title: 'Fiscal sıra garantisi yok — teslim → tahsilat → fiscal zorunlu değil',
    family: 'Finans & Ödeme',
    mechanism: 'Ordering',
    status: 'probable',
    confidence: 'medium',
    repeatRisk: 'high',
    summary:
      "Fiscal fiş üretimi teslim onayından bağımsız/önce tetiklenebiliyor; sıra büyük if/else bloklarıyla ve zaman penceresi kurallarıyla (2 dk) yönetiliyor. 'Fiş var ama teslim yok', 'teslim var ama fiş yok' ve iptal akışında cancel-fiscal atlaması bu yüzden oluşuyor.",
    amplifiedBy: ['Sıra koda gömülü, kuyruk yok', 'Zamanlamaya dayalı kurallar', 'God Object içinde dağınık akış'],
    actions: ['ACT-10', 'ACT-07'],
    edgeCases: [],
    adrRefs: ['NESY-ARCH-004'],
  },
  {
    id: 'RC-10',
    title: 'Fiscal üretimi atomik/idempotent değil',
    family: 'Finans & Ödeme',
    mechanism: 'No idempotency',
    status: 'probable',
    confidence: 'medium',
    repeatRisk: 'medium',
    summary:
      "Fiscal fiş üretimi stop bazında atomik bir kuralla değil, tek shipment üzerinden ve tekrar-tetik koruması olmadan çalışıyor. Aynı stopta mükerrer fiş, çoklu pickup'ta eksik shipment, ekran döndüğünde ikinci reprint/cancel tetiklenmesi bu kaydın belirtileri.",
    amplifiedBy: ['DB kilidi yok', 'Fiscal mantığı god object içinde', 'Gruplama kuralı atomik değil'],
    actions: ['ACT-10', 'ACT-04'],
    edgeCases: [],
    adrRefs: ['NESY-ARCH-004'],
  },
  {
    id: 'RC-11',
    title: 'Ödeme sonucu persist edilmiyor — memory-only payment state',
    family: 'Finans & Ödeme',
    mechanism: 'Volatile state',
    status: 'probable',
    confidence: 'medium',
    repeatRisk: 'high',
    summary:
      "POS/RaiPay ödeme sonucu önce belleğe yazılıp oradan gönderiliyor; DB kaydı gönderimden önce atılmıyor. Telefon kapanması, app kill veya zamanlama kenarında ödeme NESY'ye hiç yansımıyor — sessiz kayıp, ancak gün sonu mutabakatında görülüyor.",
    amplifiedBy: ['Outbox yok (RC-08)', 'CASH–CODC eşleşmesi uçucu bellekte', 'Kısmi teslim durumunu ayrıştıramayan bellek seti'],
    actions: ['ACT-11', 'ACT-04'],
    edgeCases: [],
    adrRefs: ['NESY-ARCH-004'],
  },
  {
    id: 'RC-12',
    title: 'Ödeme/servis tipi normalize değil — karar tek noktada verilmiyor',
    family: 'Finans & Ödeme',
    mechanism: 'No SSoT',
    status: 'confirmed',
    confidence: 'medium',
    repeatRisk: 'medium',
    summary:
      "Servis tipi (COD/Exworks), müşteri tipi (sözleşmeli/peşin) ve ödeme tipi (nakit/kart) bellek+JSON karışımından okunuyor; tahsilat kararı tek iş kuralında verilmiyor. Yanlış COD talebi, sözleşmeli müşteriden ödeme isteme ve gün sonu nakit/kart karışması bu kaydın belirtileri.",
    amplifiedBy: ['Üç doğruluk kaynağı (RC-06)', 'Karar mantığı ekranlara dağılmış'],
    actions: ['ACT-03', 'ACT-11'],
    edgeCases: [],
    adrRefs: ['NESY-ARCH-003'],
  },
  {
    id: 'RC-13',
    title: 'God Object — validasyon ve dallanma 8+ dosyada dağınık',
    family: 'Architecture',
    mechanism: 'God Object',
    status: 'confirmed',
    confidence: 'high',
    repeatRisk: 'medium',
    summary:
      "DeliveryFragment (4.074 LOC) ve SharedViewModel (3.450 LOC) içinde validasyon/iş kuralı if/else zincirleriyle dağınık. D4Me GSM validasyonu, RDOC-locker engeli, multicolli boyut kontrolü gibi kurallar kenar durumlarda tutarsız davranıyor.",
    amplifiedBy: ['Merkezi policy/validator yok', 'UI state machine yok'],
    actions: ['ACT-08', 'ACT-09'],
    edgeCases: ['ED2', 'ED6', 'ED8'],
    adrRefs: ['ADR-02', 'ADR-08'],
  },
  {
    id: 'RC-14',
    title: 'Bildirim içerik/navigasyon mantığı merkezi değil',
    family: 'Bildirim',
    mechanism: 'Scattered logic',
    status: 'probable',
    confidence: 'medium',
    repeatRisk: 'medium',
    summary:
      "Bildirim içeriği tek UseCase'te üretilmiyor; tetikleyici durumlar dağınık olduğu için yanlış/eksik içerik oluşuyor ve hata sessiz kalıyor (metrik yok). Bildirim → ekran navigasyonu tek seferlik UiEffect yerine LiveData zinciriyle yapıldığında kayıp/yanlış yönlenme riski taşıyor.",
    amplifiedBy: ['Observability yok (E35)', 'Time frame seçimi kuryeye kapalı'],
    actions: ['ACT-12'],
    edgeCases: ['ES6', 'E35'],
    adrRefs: ['NESY-ARCH-004F'],
  },
  {
    id: 'RC-15',
    title: 'Konum verisi güvenilir değil — outlier filtresi ve normalize kolon yok',
    family: 'Konum & GPS',
    mechanism: 'Data quality',
    status: 'confirmed',
    confidence: 'high',
    repeatRisk: 'high',
    summary:
      "Konum memory-only tutuluyor ve outlier filtresi yok; 0.0/geçersiz koordinat 'geçerli' kabul edilip navigasyona gönderiliyor. Stop koordinatları normalize kolonda olmadığı için ayıklanamıyor.",
    amplifiedBy: ['LocationService tek sınıfta (399 LOC)', 'Koordinat SSoT yok'],
    actions: ['ACT-13', 'ACT-01'],
    edgeCases: ['E25'],
    adrRefs: ['ADR-10'],
  },
  {
    id: 'RC-16',
    title: 'Permission/servis durumu runtime izlenmiyor',
    family: 'Konum & GPS',
    mechanism: 'Missing monitor',
    status: 'confirmed',
    confidence: 'high',
    repeatRisk: 'low',
    summary:
      'Konum servisi kapalıyken veya izin revoke edildiğinde uygulama sessiz kalıyor; kurye bilgilendirilmiyor ve yeniden izin talep akışı yok.',
    amplifiedBy: ['PermissionWatcher yok'],
    actions: ['ACT-14'],
    edgeCases: ['KN-4'],
    adrRefs: ['ADR-13'],
  },
  {
    id: 'RC-17',
    title: 'Event üretimi tek UseCase\'te değil — yanlış/erken event tipleri',
    family: 'Event & Sync',
    mechanism: 'Scattered logic',
    status: 'confirmed',
    confidence: 'medium',
    repeatRisk: 'medium',
    summary:
      "TOUR/PTOU gibi event'ler ekran kodunda üretiliyor: pickup'lara TOUR atanması, TOUR'un scan anında atomik atılıp erteleme senaryosunu imkânsız kılması bu yüzden. Event üretimi CompleteDelivery/CompletePickup gibi tek UseCase noktalarına alınmalı.",
    amplifiedBy: ['Scan dispatch belirsizliği (RC-01)', 'Outbox yok (RC-08)'],
    actions: ['ACT-15', 'ACT-04'],
    edgeCases: ['ES7', 'E31'],
    adrRefs: ['NESY-ARCH-004'],
  },
  {
    id: 'RC-18',
    title: 'Legacy UI / config boşlukları — mimari olmayan kayıtlar',
    family: 'UI & Config',
    mechanism: 'Feature gap',
    status: 'confirmed',
    confidence: 'high',
    repeatRisk: 'low',
    summary:
      "Mimari kök neden taşımayan kayıtların toplandığı kova: numerik klavye açılmaması, arama çubuğu eksikliği, undelivery reason listesinin config'ten yönetilememesi, NLOC onay ekranı ihtiyacı. Çözümleri lokal; ancak config kayıtları NESY-ARCH-003 app_config tablosuna bağlanmalı.",
    amplifiedBy: ['Reason set kod içinde sabit', 'Onay state persist edilmiyor'],
    actions: ['ACT-03'],
    edgeCases: [],
    adrRefs: ['NESY-ARCH-003'],
  },
]

// ── Kalıcı aksiyon havuzu ────────────────────────────────────────

export const ACTIONS: ArchAction[] = [
  {
    id: 'ACT-01',
    title: 'NESY-ARCH-001 — Normalize shipment şeması (ShipmentItemEntity + barcode index)',
    type: 'architecture',
    status: 'planned',
    rootCauses: ['RC-01', 'RC-02', 'RC-03', 'RC-15'],
    summary:
      'JSON chunk → ilişkisel yapı. barcode UNIQUE INDEX ile O(log n) sorgu, shipment.sender ve stop.latitude/longitude normalize kolonları.',
    verification: 'Büyük schedule (500+ stop) scan benchmark + ANR metriği; alan bazlı sorguların JSON parse içermediğinin kod denetimi.',
    ref: 'NESY-ARCH-001',
  },
  {
    id: 'ACT-02',
    title: 'NESY-ARCH-002 — ScheduleIngestor atomik replace',
    type: 'architecture',
    status: 'planned',
    rootCauses: ['RC-06'],
    summary: 'Schedule yazımı tek transaction içinde atomik replace; kısmi yazım ve chunk/SP bayat değer kombinasyonu ortadan kalkar.',
    verification: 'Rota değişikliği regression testi: eski rotanın hiçbir kaynakta (Room/SP/bellek) kalmadığının doğrulanması.',
    ref: 'NESY-ARCH-002',
  },
  {
    id: 'ACT-03',
    title: 'NESY-ARCH-003 — Room SSoT + reactive DAO + app_config',
    type: 'architecture',
    status: 'in-progress',
    rootCauses: ['RC-06', 'RC-07', 'RC-12', 'RC-18'],
    summary:
      "UI tek kaynaktan (DAO Flow<List<T>>) reaktif beslenir; bellek state (currentTask vb.) kaldırılır, reason set/config app_config tablosuna taşınır.",
    verification: 'DELY sonrası tracking ekranı tutarlılık testi; process-death sonrası state restore testi.',
    ref: 'NESY-ARCH-003',
  },
  {
    id: 'ACT-04',
    title: 'NESY-ARCH-004 — Outbox + SyncWorker + idempotency key',
    type: 'architecture',
    status: 'planned',
    rootCauses: ['RC-04', 'RC-05', 'RC-08', 'RC-10', 'RC-11', 'RC-17'],
    summary:
      "Her event UUID idempotency_key ile OutboxEventEntity'ye yazılır; SyncWorker FIFO gönderir. Telefon kapansa da event kaybolmaz, mükerrer gönderim yapısal olarak engellenir.",
    verification: 'App-kill / airplane-mode testleri: event kaybı 0; duplicate FCM/retry testinde backend tarafında tek event.',
    ref: 'NESY-ARCH-004',
  },
  {
    id: 'ACT-05',
    title: 'NESY-ARCH-005 — FCM işleme WorkManager ile serialize',
    type: 'architecture',
    status: 'planned',
    rootCauses: ['RC-05'],
    summary: 'FCM refresh işlemleri tek worker kuyruğunda sıralı çalışır; UI mutasyonuyla eş zamanlı yazma çakışması kalkar.',
    verification: 'Duplicate FCM + eş zamanlı UI aksiyonu race testi; çift TOUR reprodüksiyonunun negatife dönmesi.',
    ref: 'NESY-ARCH-005',
  },
  {
    id: 'ACT-06',
    title: 'ADR-05 — ScanCoordinator: tek scan giriş noktası',
    type: 'architecture',
    status: 'proposed',
    rootCauses: ['RC-01', 'RC-04'],
    summary:
      'Tüm barkod eventleri tek coordinator üzerinden screen-scoped BarcodeHandler\'lara dağıtılır; coordinator-scoped in-memory dedup set (ADR-09) ile restart = temiz başlangıç.',
    verification: 'Ekran geçişi anında scan testi (stop list → delivery); scan kaybı/yanlış ekran dispatch oranı 0.',
    ref: 'ADR-05 / ADR-09',
  },
  {
    id: 'ACT-07',
    title: 'ADR-07 — Outbox FIFO event zinciri (LCR→DDSP sıra garantisi)',
    type: 'architecture',
    status: 'proposed',
    rootCauses: ['RC-08', 'RC-09'],
    summary: 'Bağımlı event çiftleri (LCR→DDSP, CODC→CASH, DELY→fiscal) outbox içinde sıra garantisiyle gönderilir.',
    verification: 'Paralel event üretim testi: backend\'e varış sırasının her koşulda korunması.',
    ref: 'ADR-07',
  },
  {
    id: 'ACT-08',
    title: 'ADR-08 — Locker/D4Me policy: Validator + Strategy',
    type: 'code-fix',
    status: 'proposed',
    rootCauses: ['RC-13'],
    summary:
      'LockerProviderPolicy (Strategy) + LockerCapacityValidator + ayrık GSM validator: RDOC engeli, multicolli boyut kontrolü ve GSM kuralları tek noktada.',
    verification: 'Servis kombinasyonu matrisi üzerinde parametrik unit testler (RDOC × multicolli × GSM).',
    ref: 'ADR-08',
  },
  {
    id: 'ACT-09',
    title: 'ADR-02 — God Object parçalama: ekran başına ViewModel',
    type: 'architecture',
    status: 'proposed',
    rootCauses: ['RC-05', 'RC-07', 'RC-13'],
    summary: 'SharedViewModel/DeliveryFragment sorumlulukları ekran bazlı ViewModel + UseCase katmanına bölünür; UiEffect Channel ile tek seferlik efektler.',
    verification: 'Bildirim sonrası scan crash reprodüksiyonu negatif; state sızıntısı (stale task) regression suite.',
    ref: 'ADR-02',
  },
  {
    id: 'ACT-10',
    title: 'Fiscal FSM — teslim → tahsilat → fiscal sıra makinesi',
    type: 'architecture',
    status: 'proposed',
    rootCauses: ['RC-09', 'RC-10'],
    summary:
      'Fiscal üretimi durum makinesine bağlanır: teslim onaylanmadan fiscal kesilmez, stop bazında gruplanır, her fiş DB kilidi + idempotency ile tek etki üretir. Zaman penceresi kuralları sıralama garantisiyle değiştirilir.',
    verification: "Kısmi teslim, iptal (cancel fiscal), çoklu pickup ve reprint senaryolarında event log denetimi: 'VPFR var ama DELY yok' tutarsızlığı 0.",
    ref: 'NESY-ARCH-004 / RS fiscal',
  },
  {
    id: 'ACT-11',
    title: 'Payment FSM — POS öncesi persist + recovery',
    type: 'architecture',
    status: 'proposed',
    rootCauses: ['RC-11', 'RC-12'],
    summary:
      "Ödeme POS'a gönderilmeden önce DB'ye yazılır; uygulama açılışında yarım kalan ödemeler tamamlanır. CODC→CASH ikilisi outbox üzerinden sıralı gider; ödeme tipi normalize kaynaktan okunur.",
    verification: 'POS onayı sonrası app-kill testi: ödeme kaybı 0, çift tahsilat 0; gün sonu mutabakat farkı metriği.',
    ref: 'NESY-ARCH-004',
  },
  {
    id: 'ACT-12',
    title: 'Notification içerik UseCase + UiEffect + structured logging',
    type: 'code-fix',
    status: 'proposed',
    rootCauses: ['RC-14'],
    summary:
      'Bildirim içeriği tek UseCase\'te üretilir, navigasyon tek seferlik UiEffect ile yapılır (stop detayına deep-link), içerik hataları structured log/metrik ile görünür kılınır.',
    verification: 'İçerik şablonu snapshot testleri + bildirim tıklama → doğru stop detayı E2E testi.',
    ref: 'NESY-ARCH-004F',
  },
  {
    id: 'ACT-13',
    title: 'ADR-10 — Konum OutlierFilter + koordinat normalize',
    type: 'code-fix',
    status: 'proposed',
    rootCauses: ['RC-15'],
    summary: 'Speed+distance+accuracy tabanlı outlier filtresi; 0.0/geçersiz koordinat ayıklanır, stop.latitude/longitude normalize kolondan okunur.',
    verification: 'Navigasyon intent testlerinde geçersiz koordinat oranı 0; saha GPS log örneklemi denetimi.',
    ref: 'ADR-10',
  },
  {
    id: 'ACT-14',
    title: 'ADR-13 — PermissionWatcher: runtime izin/servis izleme',
    type: 'monitoring',
    status: 'proposed',
    rootCauses: ['RC-16'],
    summary: 'Konum servisi/izin durumu runtime izlenir; kapalı/revoke durumunda UI uyarısı + yeniden talep akışı.',
    verification: 'İzin revoke + servis kapatma senaryolarında uyarının göründüğü UI testi.',
    ref: 'ADR-13',
  },
  {
    id: 'ACT-15',
    title: 'Event UseCase konsolidasyonu — CompleteDelivery / CompletePickup',
    type: 'code-fix',
    status: 'proposed',
    rootCauses: ['RC-03', 'RC-17'],
    summary:
      'TOUR/PTOU/DELY event üretimi ekran kodundan çıkarılıp tek UseCase noktalarına alınır (outbox.enqueue ile); erteleme gibi akışlar event üretiminden ayrışır.',
    verification: 'Pickup → PTOU, delivery → DELY event tipi unit testleri; postpone senaryosunda TOUR üretilmediğinin doğrulanması.',
    ref: 'NESY-ARCH-004',
  },
]

// ── Türetilmiş koleksiyonlar ─────────────────────────────────────

export const FIELD_TICKETS: FieldTicket[] = FIELD_TICKET_RECORDS

export const RC_BY_ID = new Map(ROOT_CAUSES.map((rc) => [rc.id, rc]))
export const ACTION_BY_ID = new Map(ACTIONS.map((a) => [a.id, a]))

export function ticketsOf(rcId: string): FieldTicket[] {
  return FIELD_TICKETS.filter((t) => t.rootCause === rcId || t.contributing.includes(rcId))
}

export function primaryTicketsOf(rcId: string): FieldTicket[] {
  return FIELD_TICKETS.filter((t) => t.rootCause === rcId)
}

export function actionTickets(actionId: string): FieldTicket[] {
  const act = ACTION_BY_ID.get(actionId)
  if (!act) return []
  return FIELD_TICKETS.filter((t) => act.rootCauses.includes(t.rootCause))
}

// ── KPI'lar ──────────────────────────────────────────────────────

export function fieldTicketKpis() {
  const total = FIELD_TICKETS.length
  const open = FIELD_TICKETS.filter((t) => t.status === 'open').length
  const critical = FIELD_TICKETS.filter((t) => t.severity === 'critical').length
  const workaroundClosed = FIELD_TICKETS.filter(
    (t) => t.status === 'closed' && t.fixType === 'workaround',
  ).length
  const highRepeatRc = ROOT_CAUSES.filter((rc) => rc.repeatRisk === 'high').length
  const unclear = FIELD_TICKETS.filter((t) => t.confidence < 65).length
  const openActions = ACTIONS.filter(
    (a) => a.status !== 'completed' && a.status !== 'accepted-risk',
  ).length
  const linked = FIELD_TICKETS.filter(
    (t) => t.rootCause && t.edgeCases.length + (t.fix ? 1 : 0) > 0,
  ).length
  const coverage = Math.round((linked / total) * 100)
  return {
    total,
    open,
    critical,
    rootCauses: ROOT_CAUSES.length,
    families: new Set(FIELD_TICKETS.map((t) => t.group)).size,
    workaroundClosed,
    highRepeatRc,
    unclear,
    openActions,
    coverage,
  }
}

// ── Arama (serbest metin + key:value komutları) ──────────────────

const SEARCH_KEYS = [
  'severity', 'status', 'country', 'group', 'screen', 'rootcause', 'risk',
  'fix', 'confidence', 'edge', 'type', 'workaround', 'action',
] as const

function matchesToken(t: FieldTicket, key: string, value: string): boolean {
  const v = value.toLowerCase().replace(/^"|"$/g, '')
  const rc = RC_BY_ID.get(t.rootCause)
  switch (key) {
    case 'severity': return t.severity === v
    case 'status': return t.status === v
    case 'country': return t.country.toLowerCase() === v
    case 'group': return t.group.toLowerCase().includes(v)
    case 'screen': return t.screen.toLowerCase().includes(v)
    case 'rootcause':
      return (
        t.rootCause.toLowerCase() === v ||
        (rc ? rc.title.toLowerCase().includes(v) || rc.mechanism.toLowerCase().includes(v) : false)
      )
    case 'risk': return v === 'repeat' ? t.repeatRisk === 'high' : t.repeatRisk === v
    case 'fix': return v === 'false' || v === 'none' ? t.fixType !== 'permanent' : t.fixType === v
    case 'workaround': return (t.fixType === 'workaround') === (v === 'true')
    case 'confidence':
      return v === 'low' ? t.confidence < 65 : v === 'high' ? t.confidence >= 80 : t.confidence >= 65 && t.confidence < 80
    case 'edge': return t.edgeCases.some((e) => e.toLowerCase() === v)
    case 'type': return t.type === v
    case 'action': {
      if (!rc) return false
      const acts = ACTIONS.filter((a) => a.rootCauses.includes(rc.id))
      return v === 'open'
        ? acts.some((a) => a.status !== 'completed' && a.status !== 'accepted-risk')
        : acts.some((a) => a.id.toLowerCase() === v || a.status === v)
    }
    default: return true
  }
}

export function searchFieldTickets(query: string, items: FieldTicket[]): FieldTicket[] {
  const q = query.trim()
  if (!q) return items
  // "key:value" ve "key:\"çok kelime\"" token'larını ayıkla
  const tokenRe = /(\w+):("([^"]*)"|\S+)/g
  const tokens: Array<[string, string]> = []
  let rest = q
  let m: RegExpExecArray | null
  while ((m = tokenRe.exec(q)) !== null) {
    const key = (m[1] ?? '').toLowerCase()
    if ((SEARCH_KEYS as readonly string[]).includes(key)) {
      tokens.push([key, m[3] ?? m[2] ?? ''])
      rest = rest.replace(m[0], ' ')
    }
  }
  const free = rest.trim().toLowerCase()
  return items.filter((t) => {
    for (const [k, v] of tokens) if (!matchesToken(t, k, v)) return false
    if (!free) return true
    const rc = RC_BY_ID.get(t.rootCause)
    const hay = [
      t.id, t.customerTicket, t.title, t.symptom, t.rootNote, t.location,
      t.screen, t.group, t.country, t.fix, t.pastAttempt,
      rc?.id ?? '', rc?.title ?? '', ...t.edgeCases,
    ].join(' ').toLowerCase()
    return free.split(/\s+/).every((w) => hay.includes(w))
  })
}

// ── Hızlı filtreler & Saved Views ────────────────────────────────

export interface TicketFilter {
  id: string
  label: string
  desc?: string
  match: (t: FieldTicket) => boolean
}

export const QUICK_FILTERS: TicketFilter[] = [
  { id: 'open', label: 'Açık', match: (t) => t.status === 'open' },
  { id: 'crit', label: 'Kritik / Yüksek', match: (t) => t.severity !== 'medium' },
  { id: 'repeat', label: 'Yüksek tekrar riski', match: (t) => t.repeatRisk === 'high' },
  { id: 'wa', label: 'Workaround ile kapalı', match: (t) => t.status === 'closed' && t.fixType === 'workaround' },
  { id: 'nofix', label: 'Kalıcı çözüm yok', match: (t) => t.fixType !== 'permanent' },
  { id: 'lowconf', label: 'Kök nedeni belirsiz', match: (t) => t.confidence < 65 },
  { id: 'finance', label: 'Finans & Ödeme', match: (t) => t.group === 'Finans & Ödeme' },
]

export const SAVED_VIEWS: TicketFilter[] = [
  {
    id: 'exec-risk',
    label: 'Executive Risk',
    desc: 'Kritik/yüksek + yüksek tekrar riski — kalıcı aksiyonu açık kayıtlar',
    match: (t) => t.severity !== 'medium' && t.repeatRisk === 'high' && t.fixType !== 'permanent',
  },
  {
    id: 'rc-unknown',
    label: 'Root Cause Unknown',
    desc: 'Kök neden teşhisi düşük güvenli (confidence < 65)',
    match: (t) => t.confidence < 65,
  },
  {
    id: 'wa-debt',
    label: 'Workaround Debt',
    desc: 'Ticket kapalı, workaround var, kalıcı çözüm yok',
    match: (t) => t.status === 'closed' && t.fixType === 'workaround',
  },
  {
    id: 'repeat-offenders',
    label: 'Repeat Offenders',
    desc: 'Aynı kanonik kök nedene bağlı 3+ ticket',
    match: (t) => primaryTicketsOf(t.rootCause).length >= 3,
  },
  {
    id: 'financial-safety',
    label: 'Financial Safety',
    desc: 'Ödeme, fiscal ve mutabakat güvenliğini etkileyen kayıtlar',
    match: (t) => ['RC-09', 'RC-10', 'RC-11', 'RC-12'].includes(t.rootCause) || t.group === 'Finans & Ödeme',
  },
  {
    id: 'verification-queue',
    label: 'Verification Queue',
    desc: 'Müdahale uygulanmış ancak doğrulaması yapılmamış kayıtlar',
    match: (t) => t.pastAttempt !== '' && t.repeatRisk !== 'low',
  },
]

export const LAST_UPDATED = '2026-07-12'
export const DATA_SOURCES = 'GitHub (nesy-analysis) + UAT + Architecture Reports'
