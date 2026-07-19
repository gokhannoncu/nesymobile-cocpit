// Incident Command Center — single source of truth.
// Data layer for the Detect → Declare → Contain → Diagnose → Recover → Learn flow.
// Group playbooks and SEV cards come from incidents.ts; this file defines the command layer.

import type { Tone } from '@/components/product'

// ---------------------------------------------------------------------------
// 1. Is this an incident? — triage questions
// ---------------------------------------------------------------------------

export interface TriageQuestion {
  id: string
  question: string
  options: { label: string; weight: number }[]
}

// weight: 0 = no incident signal, 1 = weak, 2 = strong, 3 = SEV-1 candidate
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
    question: 'İş akışı engellendi mi?',
    options: [
      { label: 'Teslimatlar yapılamıyor', weight: 3 },
      { label: 'Ödeme/fiscal işlemler tamamlanamıyor', weight: 3 },
      { label: 'Gönderiler kaydedilemiyor', weight: 2 },
      { label: 'Uygulama kullanılamıyor', weight: 3 },
      { label: 'Workaround mevcut', weight: 1 },
      { label: 'Yalnızca görsel/UI sorunu var', weight: 0 },
    ],
  },
  {
    id: 'scope',
    question: 'Etkinin kapsamı nedir?',
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
    question: 'Bir risk türü var mı?',
    options: [
      { label: 'Mali kayıp', weight: 3 },
      { label: 'Double charge', weight: 3 },
      { label: 'Fiscal kayıt tutarsızlığı', weight: 3 },
      { label: 'Veri kaybı', weight: 3 },
      { label: 'Operasyonların durması', weight: 3 },
      { label: 'Güvenlik riski', weight: 3 },
      { label: 'Yasal/uyumluluk riski', weight: 2 },
      { label: 'Yok/bilinmiyor', weight: 0 },
    ],
  },
]

// ---------------------------------------------------------------------------
// 2. Has this happened before? — fingerprint signals and match results
// ---------------------------------------------------------------------------

export const FINGERPRINT_SIGNALS = [
  'Error code',
  'Exception / stack trace',
  'Crash fingerprint',
  'Ekran',
  'Incident grubu',
  'Ülke',
  'App version',
  'Cihaz / scanner modeli',
  'Gönderi ID davranışı',
  'API endpoint',
  'Last deploy',
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
    example: '%92 eşleşme — INC-2026-0712-01 · aynı error code, aynı version, aynı ekran',
    detail:
      'Ayrı bir çözüm çalışması başlatılmaz; yeni ticket mevcut incident ile ilişkilendirilir ve etki sayıları güncellenir.',
    actions: [
      'Bu incident ile ilişkilendir',
      'Yeni ticket’ı child/related issue yap',
      'Etkilenen kullanıcı sayısını incident’a ekle',
    ],
  },
  {
    kind: 'known',
    title: 'B · Daha önce yaşandı, çözümü biliniyor',
    tone: 'amber',
    detail: 'Bir Known Issue kaydı açılır; workaround uygulanırken incident değerlendirmesi sürer.',
    shows: [
      'Geçmiş incident + root cause',
      'Uygulanan workaround ve permanent fix',
      'İlgili playbook',
      'Tekrarlama koşulları',
    ],
    actions: [
      'Bilinen workaround’u uygula',
      'Incident’ı yeniden aç',
      'Yeni oluşum olarak kaydet',
      'Benzer ancak ayrı bir incident oluştur',
    ],
  },
  {
    kind: 'none',
    title: 'C · Eşleşme bulunamadı',
    tone: 'blue',
    detail:
      'Arama incident müdahalesini geciktirmez; eşleşme yoksa sistem yeni incident akışıyla devam eder.',
    actions: [
      'Yeni incident oluştur',
      'İlk fingerprint’i kaydet',
      'İlgili grup ve ekranı seç',
      'Yeni playbook kaydı için geçici tag oluştur',
    ],
  },
]

export const ROUTING_TREE = `Aktif etki var mı?
├─ Hayır → Normal ticket triage
└─ Evet
   ├─ Açık bir incident ile aynı mı?
   │  └─ Evet → Mevcut incident ile ilişkilendir
   └─ Hayır
      ├─ Known Issue/playbook mevcut mu?
      │  ├─ Evet → Workaround + incident değerlendirmesi
      │  └─ Hayır → Yeni incident ilan et
      └─ Mali/fiscal/veri kaybı riski var mı?
         ├─ Evet → SEV-1 değerlendirmesi
         └─ Hayır → Etki kapsamına göre SEV-2/SEV-3`

// ---------------------------------------------------------------------------
// 3. Severity calculator
// ---------------------------------------------------------------------------

// checked=true → score towards SEV-1. threshold: >=4 SEV-1, >=2 SEV-2, else SEV-3.
export const SEVERITY_QUESTIONS = [
  { id: 'halted', label: 'Saha veya kritik iş akışı tamamen durdu mu?', points: 3 },
  { id: 'fiscal', label: 'Mali/fiscal işlemler etkileniyor mu?', points: 3 },
  { id: 'dataloss', label: 'Veri kaybı veya tutarsızlık olasılığı var mı?', points: 3 },
  { id: 'retry', label: 'İşlemi retry etmek zararı artırır mı?', points: 2 },
  { id: 'multi', label: 'Birden fazla ülke etkileniyor mu?', points: 2 },
  { id: 'many', label: '10+ kurye/kullanıcı etkileniyor mu?', points: 1 },
  { id: 'deploy', label: 'Son deploy ile güçlü bir ilişki var mı?', points: 1 },
  { id: 'noWorkaround', label: 'Workaround YOK mu?', points: 2 },
]

export const SEV1_ACTIONS = [
  'Incident Commander atanır',
  'Incident room açılır',
  'Operasyon, backend ve mobile birlikte çağrılır',
  'Zararlı işlem durdurulur',
  'Düzenli durum iletişimi başlatılır',
]

// ---------------------------------------------------------------------------
// 4. Roles
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
      'Genel kararları verir ve öncelikleri belirler',
      'Görevleri devreder',
      'Incident’ın çözüme doğru ilerlemesini sağlar',
    ],
    antiPattern: 'Tek başına code/debug yapmamalıdır; koordinasyon ve derin debugging aynı kişide birleşmemelidir.',
  },
  {
    role: 'Operations Lead',
    tone: 'orange',
    duties: [
      'Teknik incelemeyi yönetir',
      'Mobile, backend, fiscal ve operasyon uzmanlarını koordine eder',
      'Hipotezleri ve testleri yönetir',
    ],
  },
  {
    role: 'Communications Lead',
    tone: 'blue',
    duties: [
      'Gerektiğinde operasyonu, yönetimi, support ekibini ve müşterileri bilgilendirir',
      'Bilinmeyen konularda tahminde bulunmaz',
      'Mesajların tek kaynaktan çıkmasını sağlar',
    ],
  },
  {
    role: 'Scribe / Timeline Owner',
    tone: 'teal',
    duties: [
      'Alınan kararları ve denenen eylemleri kaydeder',
      'Incident timeline’ını oluşturur',
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
  'Etkilenen version',
  'Etkilenen cihaz modelleri',
  'Etkilenen scanner türü',
  'Etkilenen ekran',
  'Etkilenen gönderi sayısı',
  'Etkilenen kurye sayısı',
  'Başarısız işlem oranı',
  'Mali/fiscal etki',
  'Online/offline durumu',
  'Backend karşılığı var mı?',
  'Eğilim: artıyor / sabit / azalıyor',
]

export const IMPACT_COMPARISONS = [
  'Önceki version’a göre error rate',
  'Son deploy öncesi/sonrası',
  'Ülkelere göre dağılım',
  'Cihaz/scanner dağılımı',
  'API error rate’leri',
  'Crash-free user değişimi',
  'Offline queue boyutu',
  'Başarılı ve başarısız event chain’leri',
]

// ---------------------------------------------------------------------------
// 6. First 15-minute protocol — phased checklist
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
    window: '0-5 min',
    title: 'Kontrolü ele al',
    tone: 'red',
    steps: [
      'Incident’ı ilan et',
      'Severity seviyesini belirle',
      'Incident Commander ve resolver ata',
      'Incident channel/call aç',
      'Etkilenen operasyonları bilgilendir',
      'Sorunu büyütebilecek kullanıcı eylemlerini engelle',
    ],
    warning: 'Mali/fiscal risk varsa: "Kritik uyarı — işlemi retry etmeyin."',
  },
  {
    window: '5-10 min',
    title: 'Etkiyi sınırla',
    tone: 'orange',
    steps: [
      'Hangi ülkeler etkileniyor?',
      'Hangi version’lar etkileniyor?',
      'Kaç kurye ve gönderi etkileniyor?',
      'Yakın zamanda deploy veya feature flag değişikliği yapıldı mı?',
      'Offline queue durumu nedir? (RequestSenderService kilitli mi — E8, isOfflineMode takılı mı — E7)',
      'Backend ve mobile kayıtları aynı sonucu mu gösteriyor?',
    ],
  },
  {
    window: '10-15 min',
    title: 'Evidence ve mitigation',
    tone: 'amber',
    steps: [
      'Cihaz loglarını topla',
      'Crashlytics event/stack trace kaydını al',
      'Gönderi ve transaction ID’lerini koru',
      'State temizlenmeden önce screenshot al',
      'Rollback / feature flag / workaround kararını ver',
      'İlk incident durum güncellemesini yayınla',
    ],
  },
]

export const CHECKLIST_COLUMNS = ['Owner', 'Başlangıç', 'Bitiş', 'Sonuç', 'Evidence'] as const

// ---------------------------------------------------------------------------
// 8. Evidence Gate
// ---------------------------------------------------------------------------

export const EVIDENCE_ITEMS = [
  'Crashlytics stack trace',
  'Cihaz logcat',
  'Backend request/response logları',
  'Gönderi ID · Kurye ID',
  'Transaction/fiscal ID',
  'Event ordering',
  'Offline queue kayıtları',
  'Room data',
  'SharedPreferences state',
  'App version',
  'Cihaz/scanner modeli',
  'Network durumu',
  'Ekran kaydı',
  'Son başarılı ve ilk başarısız işlem',
]

export const DESTRUCTIVE_ACTIONS = [
  'Uygulamayı yeniden başlat',
  'Cache’i temizle',
  'Log out/log in yap',
  'Verileri sil',
  'Queue’yu resetle',
  'İşlemi yeniden gönder',
]

// ---------------------------------------------------------------------------
// 9. Hypothesis and experiment area
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
    hypothesis: 'Son version regression’ı',
    test: 'Önceki APK ile dene',
    owner: 'Mobile',
    result: 'Önceki version’da sorun yok',
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
    hypothesis: 'Scanner’a bağlı',
    test: 'Kamera ile karşılaştır',
    owner: 'QA',
    result: 'Her ikisinde de var',
    status: 'Elendi' as HypothesisStatus,
  },
]

// ---------------------------------------------------------------------------
// 10. Containment / mitigation
// ---------------------------------------------------------------------------

export const MITIGATION_OPTIONS = [
  'Son deploy’u rollback et',
  'Feature flag’i devre dışı bırak',
  'Etkilenen ülke akışını durdur',
  'Belirli version’ı engelle',
  'Backend endpoint’i geçici olarak kısıtla',
  'Offline queue tüketimini durdur',
  'Manuel işlem/workaround yayınla',
  'Sorunlu scanner entegrasyonunu devre dışı bırak',
  '"İşlemi retry etmeyin" bildirimi gönder',
  'Eski kararlı akışa yönlendir',
]

export const MITIGATION_CARD_FIELDS = [
  'Beklenen fayda',
  'Risk',
  'Etkilenen kullanıcılar',
  'Rollback yöntemi',
  'Uygulayan / onaylayan',
  'Uygulama zamanı · sonuç',
]

// ---------------------------------------------------------------------------
// 11. Communications center
// ---------------------------------------------------------------------------

export const COMMS_AUDIENCES = [
  'Ülke operasyonları',
  'Mobile ekibi',
  'Backend ekibi',
  'Support',
  'Yönetim',
  'Finans/fiscal sorumluları',
  'Müşteri / dış paydaş',
]

export const COMMS_TEMPLATE = [
  {
    label: 'Ne oldu?',
    text: 'Bazı kuryeler için ödeme tamamlandıktan sonra teslimat kaydı oluşturulmuyor.',
  },
  {
    label: 'Etki',
    text: 'HR ve RS ülkelerinde 8.4.60 version’ını kullanan bazı kullanıcılar etkileniyor.',
  },
  {
    label: 'Ne yapıyoruz?',
    text: 'Ödeme ve teslimat kayıtları karşılaştırılıyor. Etkilenen akışta işlemlerin retry edilmesi geçici olarak durduruldu.',
  },
  {
    label: 'Kullanıcı ne yapmalı?',
    text: 'Aynı gönderi için ödeme işlemini retry etmeyin.',
  },
  { label: 'Sonraki güncelleme', text: 'Sonraki durum güncellemesi: 10:45.' },
]

// ---------------------------------------------------------------------------
// 12. Recovery and validation
// ---------------------------------------------------------------------------

export const EXIT_CRITERIA = [
  'Yeni error oluşmuyor',
  'Error rate normal seviyelere döndü',
  'Başarısız queue azalıyor, tamamen takılı değil',
  'Ödeme ve fiscal kayıtlar uzlaştırıldı',
  'Gönderi state’leri doğrulandı',
  'Etkilenen ülke operasyonları onay verdi',
  'En az bir gerçek/kontrollü işlem başarıyla tamamlandı',
  'Rollback/feature flag değişikliğinden sonra yeni regression görülmedi',
  'Belirlenen monitoring süresi tamamlandı',
]

export const STATUS_FLOW = ['İnceleniyor', 'Belirlendi', 'Mitigation uygulanıyor', 'İzleniyor', 'Çözüldü']

// ---------------------------------------------------------------------------
// 13. Closing
// ---------------------------------------------------------------------------

export const CLOSING_OPERATIONAL = [
  'Etki sona erdi mi?',
  'Etkilenen tüm ülkeler onay verdi mi?',
  'Bekleyen queue işlendi mi?',
  'Mali uzlaştırma gerekiyor mu?',
  'Kullanıcılara son bildirim gönderildi mi?',
  'Geçici mitigation hâlâ aktif mi?',
  'Incident tekrarlanabilir mi?',
]

export const CLOSING_TECHNICAL = [
  'Root cause biliniyor mu?',
  'Bilinmiyorsa follow-up ticket oluşturuldu mu?',
  'Permanent fix ticket’ı oluşturuldu mu?',
  'Test coverage belirlendi mi?',
  'Monitoring/alert açığı kaydedildi mi?',
  'İlgili Risk Map güncellendi mi?',
]

// ---------------------------------------------------------------------------
// 14. Postmortem
// ---------------------------------------------------------------------------

export const POSTMORTEM_STRUCTURE = [
  'Incident özeti',
  'Kullanıcı ve iş etkisi',
  'Timeline',
  'Tespit yöntemi',
  'Root cause',
  'Katkıda bulunan etkenler',
  'Neden daha önce yakalanmadı?',
  'Neler iyi çalıştı?',
  'Neler iyi çalışmadı?',
  'Kalıcı aksiyonlar',
  'Owner ve son tarihler',
  'Tekrarı önleyecek sinyaller',
]

export const AUTO_UPDATED_SYSTEMS = [
  'Known Issue kütüphanesi',
  'Reproduce Lab',
  'Risk Map',
  'First check listesi',
  'Benzer ticket eşleştirme fingerprint’i',
  'Monitoring/alert kuralları',
  'Modernization Plan',
  'Regression test listesi',
]

// ---------------------------------------------------------------------------
// 7. Screen selector — Diagnosis Workspace
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
