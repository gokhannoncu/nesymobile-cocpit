// MongoDB Query Generator — mock veri ve sabitler.
// Sayfa tamamen simülasyon: üretilen sorgu, açıklama, validasyon ve
// recent query kayıtları bu dosyadan beslenir.

import type { Tone } from '@/components/product'

// ── Form seçenekleri ─────────────────────────────────────────────

export const ENVIRONMENTS = ['Development', 'Test', 'UAT', 'Production'] as const
export type Environment = (typeof ENVIRONMENTS)[number]

export const DATABASES = ['nesy-delivery', 'nesy-fiscal', 'nesy-courier', 'nesy-sync'] as const

export const COLLECTIONS = [
  'deliveryRequests',
  'shipments',
  'offlineQueue',
  'fiscalRecords',
  'courierSchedules',
] as const

export const QUERY_TYPES = ['Find', 'Aggregate', 'Count', 'Distinct'] as const
export type QueryType = (typeof QUERY_TYPES)[number]

export const COUNTRIES = ['HR', 'SI', 'RS', 'BA', 'MK', 'Tümü'] as const

export const TIME_RANGES = ['Son 1 saat', 'Son 24 saat', 'Son 7 gün', 'Son 30 gün', 'Özel'] as const

// ── Örnek istekler (chip'ler) ────────────────────────────────────

export type ExamplePrompt = { label: string; text: string }

export const EXAMPLE_PROMPTS: ExamplePrompt[] = [
  {
    label: 'Son başarısız teslimatlar',
    text: 'Son 24 saatte HR ülkesinde başarısız olan ve henüz retry edilmemiş delivery request\'lerini göster.',
  },
  {
    label: 'Belirli shipment geçmişi',
    text: 'SHP-2026-118442 numaralı shipment\'ın tüm durum geçişlerini ve son güncelleme zamanlarını kronolojik sırayla getir.',
  },
  {
    label: 'Bekleyen offline request\'ler',
    text: 'Offline kuyrukta 2 saatten uzun süredir bekleyen, senkronize edilmemiş request\'leri courier bilgisiyle listele.',
  },
  {
    label: 'Fiscal kaydı oluşmayan teslimatlar',
    text: 'Son 7 günde tamamlanmış ama karşılığında fiscal kaydı oluşmamış teslimatları ülke bazında getir.',
  },
  {
    label: 'Bir courier\'ın son schedule kaydı',
    text: 'COU-4471 numaralı courier\'ın en güncel schedule kaydını ve atanmış rota bilgisini göster.',
  },
]

// ── Şema bilgisi (mock satırlar) ─────────────────────────────────

export type SchemaRow = { field: string; type: string; description: string; example: string }

export const SCHEMA_ROWS: SchemaRow[] = [
  {
    field: 'countryCode',
    type: 'string',
    description: 'ISO ülke kodu — sorgular ülke bazında ayrışır',
    example: '"HR"',
  },
  {
    field: 'status',
    type: 'string (enum)',
    description: 'Request durumu: PENDING · SENT · FAILED · COMPLETED',
    example: '"FAILED"',
  },
  {
    field: 'updatedAt',
    type: 'ISODate',
    description: 'Son durum değişikliği zamanı — index\'in son alanı',
    example: 'ISODate("2026-07-11T14:32:05Z")',
  },
]

// ── Güvenlik toggle'ları ─────────────────────────────────────────

export type SafetyToggle = { id: string; label: string; description: string }

export const SAFETY_TOGGLES: SafetyToggle[] = [
  {
    id: 'limit',
    label: 'Sonuç limitini otomatik ekle',
    description: 'Her sorguya .limit(100) eklenir — büyük collection taraması engellenir.',
  },
  {
    id: 'mask',
    label: 'Hassas alanları maskele',
    description: 'PII alanları (telefon, adres) projection\'dan otomatik çıkarılır.',
  },
  {
    id: 'timeRange',
    label: 'Tarih aralığını zorunlu tut',
    description: 'Zaman filtresi olmayan sorgular son 24 saate daraltılır.',
  },
  {
    id: 'explain',
    label: 'Query explanation oluştur',
    description: 'Sorgunun ne yaptığı adım adım doğal dille açıklanır.',
  },
]

// ── Üretilen sorgu (mock sonuç) ──────────────────────────────────

export const GENERATED_QUERY = {
  code: `db.deliveryRequests.find({
  countryCode: "HR",
  status: "FAILED",
  isWaiting: false,
  updatedAt: {
    $gte: ISODate("2026-07-11T00:00:00Z")
  }
})
.sort({ updatedAt: -1 })
.limit(100)`,
  summary: 'Collection: deliveryRequests · Filter: 4 conditions · Sort: updatedAt DESC · Limit: 100',
}

export const EXPLANATION_STEPS: string[] = [
  'deliveryRequests collection\'ında yalnızca HR ülkesine ait kayıtlara bakılır (countryCode: "HR").',
  'Durumu FAILED olan request\'ler filtrelenir — başarılı veya bekleyen kayıtlar sonuç dışıdır.',
  'isWaiting: false koşuluyla retry kuyruğunda bekleyen kayıtlar hariç tutulur; yalnızca henüz retry edilmemiş olanlar kalır.',
  'updatedAt alanı son 24 saate daraltılır (>= 11 Jul 2026 00:00 UTC) — tarih aralığı guardrail\'i uygulandı.',
  'Sonuçlar updatedAt alanına göre azalan sıralanır: en yeni başarısızlık en üstte görünür.',
  'Sorgu en fazla 100 doküman döndürür — sonuç limiti guardrail\'i uygulandı.',
]

// ── Validasyon kontrolleri ───────────────────────────────────────

export type ValidationStatus = 'pass' | 'warn'

export type ValidationCheck = {
  id: string
  label: string
  detail: string
  status: ValidationStatus
}

export const VALIDATION_CHECKS: ValidationCheck[] = [
  {
    id: 'syntax',
    label: 'Syntax valid',
    detail: 'Sorgu MongoDB 6.x sözdizimiyle uyumlu; parse hatası yok.',
    status: 'pass',
  },
  {
    id: 'collection',
    label: 'Collection found',
    detail: 'deliveryRequests, nesy-delivery database\'inde mevcut (son şema senkronu: 12 Jul 2026).',
    status: 'pass',
  },
  {
    id: 'fields',
    label: 'Fields matched',
    detail:
      'isWaiting alanı collection kayıtlarının yalnızca %62\'sinde bulunuyor. Eksik alanlar sorgu dışında kalabilir.',
    status: 'warn',
  },
  {
    id: 'readonly',
    label: 'Read-only',
    detail: 'Sorgu veri değiştirmez; write operatörü içermiyor.',
    status: 'pass',
  },
  {
    id: 'timeRange',
    label: 'Time range applied',
    detail: 'updatedAt filtresi son 24 saat ile sınırlandı.',
    status: 'pass',
  },
  {
    id: 'limit',
    label: 'Limit applied',
    detail: '.limit(100) eklendi — sonuç kümesi sınırlı.',
    status: 'pass',
  },
]

// ── Estimated Scope ──────────────────────────────────────────────

export type EstimatedScope = {
  documents: string
  index: string | null
  response: string
  /** Index bulunamadığında gösterilecek amber mesaj. */
  noIndexWarning: string
}

export const ESTIMATED_SCOPE: EstimatedScope = {
  documents: '12.4K',
  index: 'countryCode_1_status_1_updatedAt_-1',
  response: '< 800 ms',
  noIndexWarning: 'Bu filtre kombinasyonu için uygun index bulunamadı.',
}

// ── Guardrail mesajları ──────────────────────────────────────────

export const PRODUCTION_NOTICE =
  'Production sorguları read-only oluşturulur. Sonuç limiti ve zaman aralığı otomatik uygulanır.'

export const WRITE_INTENT_NOTICE =
  'Bu araç yalnızca read-only sorgular üretir. Update ve delete işlemleri için onaylı database operasyon süreci kullanılmalıdır.'

/** Doğal dil metninde write niyeti (update/delete/sil/güncelle vb.) var mı? */
export function hasWriteIntent(text: string): boolean {
  return /(update|delete|remove|drop\b|güncelle|\bsil(in|me|mek|ip)?\b)/i.test(
    text.toLocaleLowerCase('tr-TR'),
  )
}

// ── Recent Queries ───────────────────────────────────────────────

export type RecentQueryStatus = 'validated' | 'warning'

export const RECENT_STATUS_META: Record<RecentQueryStatus, { label: string; tone: Tone }> = {
  validated: { label: 'Validated', tone: 'green' },
  warning: { label: 'Warning', tone: 'amber' },
}

export type RecentQuery = {
  id: string
  name: string
  collection: string
  environment: Environment
  queryType: QueryType
  createdBy: string
  lastUsed: string
  status: RecentQueryStatus
  naturalLanguage: string
  query: string
  explanation: string[]
  validationHistory: { date: string; result: string; status: RecentQueryStatus }[]
  relatedTicket: string | null
  relatedIncident: string | null
  owner: string
}

export const RECENT_QUERIES: RecentQuery[] = [
  {
    id: 'q-failed-hr',
    name: 'Failed HR deliveries',
    collection: 'deliveryRequests',
    environment: 'Production',
    queryType: 'Find',
    createdBy: 'B. Kovačević',
    lastUsed: '12 Jul 2026 · 09:41',
    status: 'validated',
    naturalLanguage:
      'Son 24 saatte HR ülkesinde başarısız olan ve henüz retry edilmemiş delivery request\'lerini göster.',
    query: GENERATED_QUERY.code,
    explanation: [
      'HR ülkesindeki FAILED durumundaki request\'ler filtrelenir.',
      'Retry kuyruğunda bekleyenler (isWaiting: true) hariç tutulur.',
      'Son 24 saat penceresi ve 100 kayıt limiti otomatik uygulanır.',
    ],
    validationHistory: [
      { date: '12 Jul 2026', result: '6/6 kontrol geçti — isWaiting kapsam uyarısı ile', status: 'validated' },
      { date: '08 Jul 2026', result: 'Index önerisi güncellendi (updatedAt eklendi)', status: 'validated' },
    ],
    relatedTicket: 'FT-0142 · HR teslimat retry döngüsü',
    relatedIncident: 'INC-2036 · HR delivery backlog',
    owner: 'Delivery Ops',
  },
  {
    id: 'q-offline-queue',
    name: 'Pending offline queue',
    collection: 'offlineQueue',
    environment: 'Production',
    queryType: 'Find',
    createdBy: 'G. Öncü',
    lastUsed: '11 Jul 2026 · 17:05',
    status: 'warning',
    naturalLanguage:
      'Offline kuyrukta 2 saatten uzun süredir bekleyen, senkronize edilmemiş request\'leri courier bilgisiyle listele.',
    query: `db.offlineQueue.find({
  syncStatus: "PENDING",
  enqueuedAt: {
    $lte: ISODate("2026-07-11T15:00:00Z")
  }
})
.sort({ enqueuedAt: 1 })
.limit(100)`,
    explanation: [
      'Senkron durumu PENDING olan kuyruğa alınmış kayıtlar filtrelenir.',
      '2 saatlik eşik enqueuedAt üzerinden hesaplanır; en eski bekleyen en üstte.',
      'Courier bilgisi ayrı lookup gerektirir — Find sürümünde yalnızca courierId döner.',
    ],
    validationHistory: [
      {
        date: '11 Jul 2026',
        result: 'enqueuedAt için index yok — COLLSCAN uyarısı verildi',
        status: 'warning',
      },
    ],
    relatedTicket: 'FT-0137 · Offline kuyruk şişmesi',
    relatedIncident: null,
    owner: 'Sync Platform',
  },
  {
    id: 'q-fiscal-recon',
    name: 'Shipment fiscal reconciliation',
    collection: 'fiscalRecords',
    environment: 'UAT',
    queryType: 'Aggregate',
    createdBy: 'M. Jurić',
    lastUsed: '10 Jul 2026 · 14:22',
    status: 'validated',
    naturalLanguage:
      'Son 7 günde tamamlanmış ama karşılığında fiscal kaydı oluşmamış teslimatları ülke bazında getir.',
    query: `db.shipments.aggregate([
  { $match: {
      status: "COMPLETED",
      completedAt: { $gte: ISODate("2026-07-05T00:00:00Z") }
  } },
  { $lookup: {
      from: "fiscalRecords",
      localField: "shipmentId",
      foreignField: "shipmentId",
      as: "fiscal"
  } },
  { $match: { fiscal: { $size: 0 } } },
  { $group: { _id: "$countryCode", missing: { $sum: 1 } } },
  { $sort: { missing: -1 } },
  { $limit: 100 }
])`,
    explanation: [
      'Son 7 günde tamamlanan shipment\'lar fiscalRecords ile eşleştirilir.',
      'Fiscal karşılığı olmayanlar ($size: 0) ülke bazında gruplanır.',
      'En çok eksik kaydı olan ülke en üstte listelenir.',
    ],
    validationHistory: [
      { date: '10 Jul 2026', result: '6/6 kontrol geçti — lookup maliyeti kabul edilebilir', status: 'validated' },
    ],
    relatedTicket: 'FT-0129 · Fiscal kaydı sessiz atlanıyor',
    relatedIncident: 'INC-2031 · SI fiscal mutabakat farkı',
    owner: 'Fiscal Integrations',
  },
  {
    id: 'q-courier-schedule',
    name: 'Courier schedule lookup',
    collection: 'courierSchedules',
    environment: 'Test',
    queryType: 'Find',
    createdBy: 'A. Petrović',
    lastUsed: '09 Jul 2026 · 08:55',
    status: 'validated',
    naturalLanguage: 'COU-4471 numaralı courier\'ın en güncel schedule kaydını ve atanmış rota bilgisini göster.',
    query: `db.courierSchedules.find({
  courierId: "COU-4471"
})
.sort({ effectiveFrom: -1 })
.limit(1)`,
    explanation: [
      'courierId eşleşmesiyle tek courier\'a daraltılır.',
      'effectiveFrom azalan sıralanır; .limit(1) ile yalnızca en güncel kayıt döner.',
    ],
    validationHistory: [
      { date: '09 Jul 2026', result: '6/6 kontrol geçti — covered query', status: 'validated' },
    ],
    relatedTicket: null,
    relatedIncident: null,
    owner: 'Courier Ops',
  },
]
