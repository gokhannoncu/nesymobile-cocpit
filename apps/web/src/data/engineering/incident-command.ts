// Incident Command Center — tek gerçek kaynak.
// Detect → Declare → Contain → Diagnose → Recover → Learn akışının veri katmanı.
// Grup playbook'ları ve SEV kartları incidents.ts'ten gelir; bu dosya komuta katmanını tanımlar.

import type { Tone } from '@/components/product'

// ---------------------------------------------------------------------------
// 0. Canlı incident üst barı — demo incident
// ---------------------------------------------------------------------------

export const INCIDENT_STATUSES = [
  'Değerlendiriliyor',
  'Araştırılıyor',
  'Neden belirlendi',
  'Mitigasyon uygulanıyor',
  'İzleniyor',
  'Çözüldü',
] as const

export type IncidentStatus = (typeof INCIDENT_STATUSES)[number]

export const LIVE_INCIDENT = {
  id: 'INC-2026-0712-03',
  title: 'Payment completed but delivery not saved',
  status: 'Araştırılıyor' as IncidentStatus,
  sev: 'SEV-1',
  startedAt: '10:07',
  elapsed: '00:28:42',
  scope: 'HR + RS · v8.4.60',
  commander: 'M. Kovač',
  lastUpdate: '10:32',
  nextComms: '10:45',
  objective: 'Çift işlem riskini durdur ve etkilenen shipment listesini çıkar.',
  impact: [
    { label: 'Ülke', value: '2' },
    { label: 'Kurye', value: '34' },
    { label: 'Shipment', value: '87' },
    { label: 'Ödeme kaydı', value: '12' },
    { label: 'Sürüm', value: '8.4.60' },
  ],
  team: [
    { role: 'IC', name: 'M. Kovač' },
    { role: 'Ops Lead', name: 'A. Yılmaz' },
    { role: 'Comms', name: 'S. Novak' },
    { role: 'Scribe', name: 'D. Horvat' },
    { role: 'SME', name: 'Backend fiscal · Mobile payment' },
  ],
  lastDecision: '10:32 — Payment retry geçici olarak kapatıldı.',
  nextCheck: '10:45 — Error rate ve queue durumu kontrol edilecek.',
  timeline: [
    { time: '10:04', event: 'İlk operasyon bildirimi' },
    { time: '10:07', event: 'Incident ilan edildi' },
    { time: '10:09', event: 'SEV-1 olarak sınıflandırıldı' },
    { time: '10:13', event: 'Çift tahsilat riski doğrulandı' },
    { time: '10:18', event: 'Retry akışı durduruldu' },
    { time: '10:26', event: 'Etkilenen shipment listesi çıkarıldı' },
  ],
}

// ---------------------------------------------------------------------------
// 1. Bu bir incident mı? — triage soruları
// ---------------------------------------------------------------------------

export interface TriageQuestion {
  id: string
  question: string
  options: { label: string; weight: number }[]
}

// weight: 0 = incident sinyali yok, 1 = zayıf, 2 = güçlü, 3 = SEV-1 adayı
export const TRIAGE_QUESTIONS: TriageQuestion[] = [
  {
    id: 'ongoing',
    question: 'Etki şu anda devam ediyor mu?',
    options: [
      { label: 'Evet, kullanıcılar hâlâ etkileniyor', weight: 2 },
      { label: 'Hayır, olay sona ermiş görünüyor', weight: 0 },
      { label: 'Emin değilim', weight: 1 },
    ],
  },
  {
    id: 'blocked',
    question: 'İş akışı engelleniyor mu?',
    options: [
      { label: 'Teslimat yapılamıyor', weight: 3 },
      { label: 'Ödeme/fiscal işlemi yapılamıyor', weight: 3 },
      { label: 'Gönderiler kaydedilemiyor', weight: 2 },
      { label: 'Uygulama kullanılamıyor', weight: 3 },
      { label: 'Workaround var', weight: 1 },
      { label: 'Yalnızca kozmetik/UI sorunu', weight: 0 },
    ],
  },
  {
    id: 'scope',
    question: 'Etki kapsamı nedir?',
    options: [
      { label: 'Tek cihaz/kullanıcı', weight: 0 },
      { label: 'Birden fazla kurye', weight: 1 },
      { label: 'Tek şube/hub', weight: 1 },
      { label: 'Tek ülke', weight: 2 },
      { label: 'Birden fazla ülke', weight: 3 },
      { label: 'Tüm saha', weight: 3 },
    ],
  },
  {
    id: 'risk',
    question: 'Risk türü var mı?',
    options: [
      { label: 'Finansal kayıp', weight: 3 },
      { label: 'Çift tahsilat', weight: 3 },
      { label: 'Fiscal kayıt tutarsızlığı', weight: 3 },
      { label: 'Veri kaybı', weight: 3 },
      { label: 'Operasyonun durması', weight: 3 },
      { label: 'Güvenlik riski', weight: 3 },
      { label: 'Yasal/uyumluluk riski', weight: 2 },
      { label: 'Yok/bilinmiyor', weight: 0 },
    ],
  },
]

// ---------------------------------------------------------------------------
// 2. Daha önce yaşandı mı? — fingerprint sinyalleri ve eşleşme sonuçları
// ---------------------------------------------------------------------------

export const FINGERPRINT_SIGNALS = [
  'Error code',
  'Exception / stack trace',
  'Crash fingerprint',
  'Ekran',
  'Incident grubu',
  'Ülke',
  'Uygulama sürümü',
  'Cihaz / scanner modeli',
  'Shipment ID davranışı',
  'API endpoint',
  'Son deploy',
  'Ticket anahtar kelimeleri',
]

export interface MatchResult {
  kind: 'open' | 'known' | 'none'
  title: string
  tone: Tone
  example?: string
  detail: string
  shows?: string[]
  actions: string[]
}

export const MATCH_RESULTS: MatchResult[] = [
  {
    kind: 'open',
    title: 'A · Açık bir incident ile eşleşiyor',
    tone: 'red',
    example: '%92 eşleşme — INC-2026-0712-01 · aynı hata kodu, aynı sürüm, aynı ekran',
    detail:
      'Ayrı çözüm çalışması başlatılmaz; yeni ticket mevcut incidente bağlanır ve etki sayıları güncellenir.',
    actions: [
      'Bu incidente bağla',
      'Yeni ticket’ı child/related issue yap',
      'Etkilenen kullanıcı sayısını incidente ekle',
    ],
  },
  {
    kind: 'known',
    title: 'B · Geçmişte yaşanmış, çözümü biliniyor',
    tone: 'amber',
    detail: 'Known issue kaydı açılır; workaround uygulanırken incident değerlendirmesi sürer.',
    shows: [
      'Geçmiş incident + kök neden',
      'Uygulanan workaround ve kalıcı çözüm',
      'İlgili playbook',
      'Tekrar oluşma şartları',
    ],
    actions: [
      'Bilinen workaround’u uygula',
      'Incident’i yeniden aç',
      'Yeni occurrence olarak kaydet',
      'Benzer ancak farklı incident oluştur',
    ],
  },
  {
    kind: 'none',
    title: 'C · Eşleşme bulunamadı',
    tone: 'blue',
    detail:
      'Arama incident müdahalesini geciktirmez — eşleşme yoksa sistem yeni incident akışına devam eder.',
    actions: [
      'Yeni incident oluştur',
      'İlk fingerprint’i kaydet',
      'İlgili grup ve ekranı seç',
      'Yeni playbook kaydı için provisional etiket oluştur',
    ],
  },
]

export const ROUTING_TREE = `Aktif etki var mı?
├─ Hayır → Normal ticket triage
└─ Evet
   ├─ Açık incident ile aynı mı?
   │  └─ Evet → Mevcut incidente bağla
   └─ Hayır
      ├─ Bilinen issue/playbook var mı?
      │  ├─ Evet → Workaround + incident değerlendirmesi
      │  └─ Hayır → Yeni incident ilanı
      └─ Finansal/fiscal/veri kaybı riski var mı?
         ├─ Evet → SEV-1 değerlendirmesi
         └─ Hayır → Etki kapsamına göre SEV-2/SEV-3`

// ---------------------------------------------------------------------------
// 3. Severity hesaplayıcı
// ---------------------------------------------------------------------------

// checked=true → SEV-1 yönünde puan. threshold: >=4 SEV-1, >=2 SEV-2, else SEV-3.
export const SEVERITY_QUESTIONS = [
  { id: 'halted', label: 'Saha veya kritik iş akışı tamamen durdu mu?', points: 3 },
  { id: 'fiscal', label: 'Finansal/fiscal işlem etkileniyor mu?', points: 3 },
  { id: 'dataloss', label: 'Veri kaybı ya da tutarsızlık ihtimali var mı?', points: 3 },
  { id: 'retry', label: 'Kullanıcı işlemi tekrar denerse zarar büyür mü?', points: 2 },
  { id: 'multi', label: 'Birden fazla ülke etkileniyor mu?', points: 2 },
  { id: 'many', label: '10+ kurye/kullanıcı etkileniyor mu?', points: 1 },
  { id: 'deploy', label: 'Son deploy ile kuvvetli korelasyon var mı?', points: 1 },
  { id: 'noWorkaround', label: 'Workaround YOK mu?', points: 2 },
]

export const SEV1_ACTIONS = [
  'Incident Commander atanır',
  'Incident odası açılır',
  'Operasyon ve backend/mobile birlikte çağrılır',
  'Zararlı işlem durdurulur',
  'Düzenli durum iletişimi başlatılır',
]

// ---------------------------------------------------------------------------
// 4. Roller
// ---------------------------------------------------------------------------

export interface IncidentRole {
  role: string
  tone: Tone
  duties: string[]
  antiPattern?: string
}

export const INCIDENT_ROLES: IncidentRole[] = [
  {
    role: 'Incident Commander',
    tone: 'red',
    duties: [
      'Genel kararları verir, öncelikleri belirler',
      'İşleri delege eder',
      'Incident’in çözüme doğru ilerlemesini sağlar',
    ],
    antiPattern: 'Kendi başına kod/debug yapmamalıdır — koordinasyon ve yoğun debug aynı kişide birleşmez.',
  },
  {
    role: 'Operations Lead',
    tone: 'orange',
    duties: [
      'Teknik araştırmayı yönetir',
      'Mobil, backend, fiscal ve operasyon uzmanlarını koordine eder',
      'Hipotezleri ve testleri yönetir',
    ],
  },
  {
    role: 'Communications Lead',
    tone: 'blue',
    duties: [
      'Operasyon, yönetim, destek ve gerekiyorsa müşteriye bilgi verir',
      'Bilinmeyen konularda tahmin yürütmez',
      'Mesajların tek kaynaktan çıkmasını sağlar',
    ],
  },
  {
    role: 'Scribe / Timeline Owner',
    tone: 'teal',
    duties: [
      'Alınan kararları ve denenen aksiyonları kaydeder',
      'Incident zaman çizelgesini oluşturur',
      'Postmortem için veri toplar',
    ],
  },
]

export const SMALL_INCIDENT_STRUCTURE = `Incident Commander
├─ Operations / Resolver
└─ Scribe + Communications`

// ---------------------------------------------------------------------------
// 5. Impact Snapshot
// ---------------------------------------------------------------------------

export const IMPACT_FIELDS = [
  'İlk görülme zamanı',
  'Son görülme zamanı',
  'Etkilenen ülke',
  'Etkilenen sürüm',
  'Etkilenen cihaz modelleri',
  'Etkilenen scanner tipi',
  'Etkilenen ekran',
  'Etkilenen shipment sayısı',
  'Etkilenen kurye sayısı',
  'Başarısız işlem oranı',
  'Finansal/fiscal etki',
  'Online/offline durumu',
  'Backend tarafında karşılığı var mı?',
  'Trend: artıyor / sabit / azalıyor',
]

export const IMPACT_COMPARISONS = [
  'Önceki sürüm ile hata oranı',
  'Son deploy’dan önce/sonra',
  'Ülkeler arası dağılım',
  'Device/scanner dağılımı',
  'API hata oranları',
  'Crash-free kullanıcı değişimi',
  'Offline queue büyüklüğü',
  'Başarılı ve başarısız event zincirleri',
]

// ---------------------------------------------------------------------------
// 6. İlk 15 dakika protokolü — fazlı checklist
// ---------------------------------------------------------------------------

export interface ProtocolPhase {
  window: string
  title: string
  tone: Tone
  steps: string[]
  warning?: string
}

export const FIRST_15_PROTOCOL: ProtocolPhase[] = [
  {
    window: '0–5 dk',
    title: 'Kontrolü ele al',
    tone: 'red',
    steps: [
      'Incident’i ilan et',
      'Severity belirle',
      'Incident Commander ve resolver ata',
      'Incident kanalı/call aç',
      'Etkilenen operasyonu bilgilendir',
      'Kullanıcının problemi büyütecek işlemlerini engelle',
    ],
    warning: 'Finansal/fiscal ihtimal varsa: "Kritik uyarı — işlemi tekrar denemeyin."',
  },
  {
    window: '5–10 dk',
    title: 'Etkiyi sınırla',
    tone: 'orange',
    steps: [
      'Hangi ülkeler etkileniyor?',
      'Hangi sürümler etkileniyor?',
      'Kaç kurye ve shipment etkileniyor?',
      'Son deploy veya feature flag değişikliği var mı?',
      'Offline queue durumu nedir? (RequestSenderService kilitli mi — E8, isOfflineMode takılı mı — E7)',
      'Backend ve mobil kayıtları aynı sonucu gösteriyor mu?',
    ],
  },
  {
    window: '10–15 dk',
    title: 'Kanıt ve mitigasyon',
    tone: 'amber',
    steps: [
      'Cihaz loglarını al',
      'Crashlytics event/stack trace’i kaydet',
      'Shipment ve transaction ID’lerini koru',
      'State temizlemeden önce ekran görüntüsü al',
      'Rollback / feature flag / workaround kararını ver',
      'İlk incident durum güncellemesini yayınla',
    ],
  },
]

export const CHECKLIST_COLUMNS = ['Owner', 'Başlangıç', 'Bitiş', 'Sonuç', 'Kanıt'] as const

// ---------------------------------------------------------------------------
// 8. Evidence Gate
// ---------------------------------------------------------------------------

export const EVIDENCE_ITEMS = [
  'Crashlytics stack trace',
  'Cihaz logcat',
  'Backend request/response kayıtları',
  'Shipment ID · Courier ID',
  'Transaction/fiscal ID',
  'Event sıralaması',
  'Offline queue kayıtları',
  'Room verisi',
  'SharedPreferences state’i',
  'Uygulama sürümü',
  'Device/scanner modeli',
  'Network durumu',
  'Ekran kaydı',
  'Son başarılı ve ilk başarısız işlem',
]

export const DESTRUCTIVE_ACTIONS = [
  'Uygulamayı yeniden başlat',
  'Cache temizle',
  'Logout/login yap',
  'Veriyi sil',
  'Kuyruğu sıfırla',
  'İşlemi yeniden gönder',
]

// ---------------------------------------------------------------------------
// 9. Hipotez ve deney alanı
// ---------------------------------------------------------------------------

export type HypothesisStatus = 'Yeni' | 'Test ediliyor' | 'Güçlü sinyal' | 'Doğrulandı' | 'Elendi'

export const HYPOTHESIS_STATUS_TONE: Record<HypothesisStatus, Tone> = {
  Yeni: 'gray',
  'Test ediliyor': 'blue',
  'Güçlü sinyal': 'amber',
  Doğrulandı: 'green',
  Elendi: 'gray',
}

export const HYPOTHESES = [
  {
    time: '10:14',
    hypothesis: 'Son sürüm regresyonu',
    test: 'Önceki APK ile dene',
    owner: 'Mobile',
    result: 'Sorun önceki sürümde yok',
    status: 'Güçlü sinyal' as HypothesisStatus,
  },
  {
    time: '10:18',
    hypothesis: 'Offline queue kilitli',
    test: 'Queue kayıtlarını kontrol et',
    owner: 'Backend',
    result: '87 kayıt bekliyor',
    status: 'Doğrulandı' as HypothesisStatus,
  },
  {
    time: '10:24',
    hypothesis: 'Scanner bağımlı',
    test: 'Kamera ile karşılaştır',
    owner: 'QA',
    result: 'İkisinde de var',
    status: 'Elendi' as HypothesisStatus,
  },
]

// ---------------------------------------------------------------------------
// 10. Containment / mitigasyon
// ---------------------------------------------------------------------------

export const MITIGATION_OPTIONS = [
  'Son deploy’u rollback et',
  'Feature flag kapat',
  'İlgili ülke akışını durdur',
  'Belirli sürümü blokla',
  'Backend endpoint’i geçici olarak sınırla',
  'Offline queue tüketimini durdur',
  'Manuel işlem/workaround yayınla',
  'Problemli scanner entegrasyonunu devre dışı bırak',
  '"İşlemi tekrarlamayın" bildirimi gönder',
  'Eski stabil akışa yönlendir',
]

export const MITIGATION_CARD_FIELDS = [
  'Beklenen fayda',
  'Risk',
  'Etkilenecek kullanıcı',
  'Geri alma yöntemi',
  'Uygulayan / onaylayan',
  'Uygulama zamanı · sonuç',
]

// ---------------------------------------------------------------------------
// 11. İletişim merkezi
// ---------------------------------------------------------------------------

export const COMMS_AUDIENCES = [
  'Ülke operasyonları',
  'Mobil ekip',
  'Backend ekip',
  'Support',
  'Yönetim',
  'Finans/fiscal sorumluları',
  'Müşteri / dış paydaş',
]

export const COMMS_TEMPLATE = [
  {
    label: 'Ne oldu?',
    text: 'Bazı kuryelerde ödeme tamamlandıktan sonra teslimat kaydı oluşmuyor.',
  },
  {
    label: 'Etki',
    text: 'HR ve RS üzerinde sürüm 8.4.60 kullanıcılarının bir bölümü etkileniyor.',
  },
  {
    label: 'Ne yapıyoruz?',
    text: 'Ödeme ve teslimat kayıtları karşılaştırılıyor. İlgili akışta tekrar işlem yapılması geçici olarak durduruldu.',
  },
  {
    label: 'Kullanıcı ne yapmalı?',
    text: 'Aynı shipment için ödeme işlemini tekrar denemeyin.',
  },
  { label: 'Sonraki güncelleme', text: 'Bir sonraki durum güncellemesi: 10:45.' },
]

// ---------------------------------------------------------------------------
// 12. Recovery ve doğrulama
// ---------------------------------------------------------------------------

export const EXIT_CRITERIA = [
  'Yeni hata oluşmuyor',
  'Error rate normal seviyeye döndü',
  'Başarısız queue azalmaya başladı, tamamen takılı değil',
  'Ödeme ve fiscal kayıtları uzlaştırıldı',
  'Shipment state’leri doğrulandı',
  'Etkilenen ülke operasyonu onay verdi',
  'En az bir gerçek/kontrollü işlem başarıyla tamamlandı',
  'Rollback/feature flag sonrası yeni regresyon görülmedi',
  'Belirlenen izleme süresi tamamlandı',
]

export const STATUS_FLOW = ['Investigating', 'Identified', 'Mitigating', 'Monitoring', 'Resolved']

// ---------------------------------------------------------------------------
// 13. Kapatma
// ---------------------------------------------------------------------------

export const CLOSING_OPERATIONAL = [
  'Etki sona erdi mi?',
  'Etkilenen tüm ülkeler doğruladı mı?',
  'Bekleyen queue işlendi mi?',
  'Finansal uzlaştırma gerekli mi?',
  'Kullanıcılara son bilgilendirme yapıldı mı?',
  'Geçici mitigasyon hâlâ açık mı?',
  'Incident yeniden oluşabilir mi?',
]

export const CLOSING_TECHNICAL = [
  'Kök neden biliniyor mu?',
  'Bilinmiyorsa takip ticket’ı açıldı mı?',
  'Kalıcı çözüm ticket’ı açıldı mı?',
  'Test kapsamı belirlendi mi?',
  'Monitoring/alert eksikliği kaydedildi mi?',
  'İlgili risk haritası güncellendi mi?',
]

// ---------------------------------------------------------------------------
// 14. Postmortem
// ---------------------------------------------------------------------------

export const POSTMORTEM_STRUCTURE = [
  'Incident özeti',
  'Kullanıcı ve iş etkisi',
  'Timeline',
  'Detection yöntemi',
  'Kök neden',
  'Katkıda bulunan faktörler',
  'Neden daha erken yakalanmadı?',
  'Neler iyi çalıştı?',
  'Neler kötü çalıştı?',
  'Kalıcı aksiyonlar',
  'Owner ve termin tarihleri',
  'Tekrarı engelleyecek sinyaller',
]

export const AUTO_UPDATED_SYSTEMS = [
  'Known Issue kütüphanesi',
  'Reproduce Lab',
  'Risk Haritası',
  'İlk kontrol listesi',
  'Benzer ticket eşleştirme fingerprint’i',
  'Monitoring/alert kuralları',
  'Modernization Plan',
  'Regression test listesi',
]

// ---------------------------------------------------------------------------
// 7. Ekran seçici — Diagnosis Workspace
// ---------------------------------------------------------------------------

export const DIAGNOSIS_SCREENS = [
  'Delivery',
  'Delivery Failed',
  'Stop List',
  'Task List',
  'Route Selection',
  'Pick Up',
  'D4Me / Locker',
  'Shipment Tracking',
  'End of Day',
  'Map / Navigation',
  'Login / Settings',
  'Shipment Detail',
]
