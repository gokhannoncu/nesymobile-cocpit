// Mobile Knowledge Hub — paylaşılan tipler.
// Backend Handbook (mobilin servislerle nasıl konuştuğu) ve Screen Manual
// (kullanıcının ne gördüğü + teknik çalışma) tek tip sözlüğünü paylaşır.
// İkonlar burada tutulmaz (data lucide'den bağımsız); ikon eşlemesi sayfa/bileşen
// katmanında slug üzerinden yapılır.

import type { Tone } from '@/components/product'

/** Nesy Mobile'ın operasyonel olduğu ülkeler. */
export type Country = 'HR' | 'BA' | 'SI' | 'RS'

export const COUNTRY_LABELS: Record<Country, string> = {
  HR: 'Hırvatistan',
  BA: 'Bosna-Hersek',
  SI: 'Slovenya',
  RS: 'Sırbistan',
}

/** Doküman yaşam döngüsü. */
export type DocStatus =
  | 'draft'
  | 'technical-review'
  | 'operational-review'
  | 'approved'
  | 'published'
  | 'needs-update'
  | 'archived'

export const DOC_STATUS_META: Record<DocStatus, { label: string; tone: Tone }> = {
  draft: { label: 'Taslak', tone: 'gray' },
  'technical-review': { label: 'Teknik İnceleme', tone: 'blue' },
  'operational-review': { label: 'Operasyon İncelemesi', tone: 'indigo' },
  approved: { label: 'Onaylandı', tone: 'green' },
  published: { label: 'Yayınlandı', tone: 'teal' },
  'needs-update': { label: 'Güncelleme Gerekli', tone: 'amber' },
  archived: { label: 'Arşiv', tone: 'gray' },
}

/** Veri kaynağı otorite seviyesi (lineage). */
export type SourceLevel = 'authoritative' | 'operational' | 'cached' | 'temporary' | 'log-only'

export const SOURCE_LEVEL_META: Record<SourceLevel, { label: string; tone: Tone }> = {
  authoritative: { label: 'Authoritative', tone: 'green' },
  operational: { label: 'Operational', tone: 'blue' },
  cached: { label: 'Cached', tone: 'amber' },
  temporary: { label: 'Temporary', tone: 'orange' },
  'log-only': { label: 'Log only', tone: 'gray' },
}

/** Doküman metadatası — hem backend domain hem ekran için ortak. */
export interface DocMeta {
  owner: string
  reviewer?: string
  /** Uygulandığı mobil sürüm, ör. "8.4.60+". */
  version: string
  countries: Country[]
  /** Son doğrulama tarihi (ISO ya da okunabilir). */
  lastVerified: string
  nextReview?: string
  status: DocStatus
}

/** Dikey akış diyagramı adımı (Temel akış / Event chain). */
export interface FlowStep {
  id: string
  label: string
  note?: string
  tone?: Tone
  /** Tıklanınca gösterilecek kısa detay (endpoint/ekran/kod). */
  detail?: string
  /** Ana hatta göre yan (branch) dal mı? */
  branch?: boolean
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
export type OfflineSupport = 'yes' | 'no' | 'partial'

export const OFFLINE_META: Record<OfflineSupport, { label: string; tone: Tone }> = {
  yes: { label: 'Evet', tone: 'green' },
  no: { label: 'Hayır', tone: 'red' },
  partial: { label: 'Kısmi', tone: 'amber' },
}

/** Backend endpoint kaydı; satıra tıklanınca drawer'da tüm alanlar gösterilir. */
export interface Endpoint {
  method: HttpMethod
  path: string
  /** Mobil kullanım özeti (tablo hücresi). */
  usage: string
  criticalFields: string[]
  offline: OfflineSupport
  // Drawer detayları
  purpose?: string
  request?: string
  successResponse?: string
  errorResponse?: string
  mobileMapping?: string
  errorCodes?: { code: string; meaning: string }[]
  caller?: string
  retry?: string
  idempotency?: string
  timeout?: string
  relatedScreens?: string[]
  graylog?: string
  mongo?: string
}

/** Mobilde nereden çağrılır tablosu. */
export interface MobileCaller {
  feature: string
  classMethod: string
  screen: string
  note?: string
}

export interface LineageNode {
  label: string
  level: SourceLevel
}

/** Hata davranışı / sık karşılaşılan durum — accordion. */
export interface ErrorBehaviour {
  id: string
  title: string
  tone?: Tone
  rows: { label: string; value: string }[]
}

/** Ülke farklılıkları tablosu satırı. */
export interface CountryDiffRow {
  behaviour: string
  values: Partial<Record<Country, string>>
}

/** İnceleme / araştırma kısayolu. */
export interface InvestigationShortcut {
  label: string
  tool: string
  href?: string
}

export interface ChangeEntry {
  version: string
  note: string
}

/** Backend Handbook domain kaydı. */
export interface BackendDomain {
  slug: string
  title: string
  subtitle: string
  tone: Tone
  documented: boolean
  meta: DocMeta
  purpose: string
  whenUsed: string[]
  flow?: FlowStep[]
  endpoints?: Endpoint[]
  callers?: MobileCaller[]
  lineage?: LineageNode[]
  errors?: ErrorBehaviour[]
  countryDiffs?: CountryDiffRow[]
  investigation?: InvestigationShortcut[]
  risks?: string[]
  changes?: ChangeEntry[]
}

// ── Screen Manual ────────────────────────────────────────────────

export type ScreenGroup =
  | 'application-entry'
  | 'daily-operation'
  | 'shipment-operations'
  | 'payment-fiscal'
  | 'additional-operations'
  | 'end-of-shift'

export const SCREEN_GROUP_META: Record<ScreenGroup, { label: string; tone: Tone }> = {
  'application-entry': { label: 'Application Entry', tone: 'indigo' },
  'daily-operation': { label: 'Daily Operation', tone: 'blue' },
  'shipment-operations': { label: 'Shipment Operations', tone: 'teal' },
  'payment-fiscal': { label: 'Payment & Fiscal', tone: 'green' },
  'additional-operations': { label: 'Additional Operations', tone: 'amber' },
  'end-of-shift': { label: 'End of Shift', tone: 'purple' },
}

/** Ekran görüntüsü üzerindeki numaralı hotspot (yüzde konum). */
export interface Hotspot {
  num: number
  label: string
  desc: string
  /** Mock frame üzerinde 0-100 arası konum. */
  x: number
  y: number
}

export interface ScreenStep {
  title: string
  user: string
  system: string
  blockedWhen?: string
  error?: string
}

export interface ButtonGuide {
  element: string
  purpose: string
  activeWhen: string
}

export interface LocalStateRow {
  state: string
  source: string
  persistence: string
  risk: string
}

export interface BackendCallRow {
  action: string
  endpoint: string
  success: string
  failure: string
}

export interface AnalyticsEvent {
  event: string
  trigger: string
  params: string
}

export interface RelatedLink {
  label: string
  href?: string
}

export interface Screen {
  slug: string
  title: string
  subtitle: string
  group: ScreenGroup
  tone: Tone
  documented: boolean
  meta: DocMeta
  roles?: string[]
  // User Manual
  purpose: string
  entryFlow?: string[]
  hotspots?: Hotspot[]
  steps?: ScreenStep[]
  buttons?: ButtonGuide[]
  commonProblems?: ErrorBehaviour[]
  does?: string[]
  dont?: string[]
  // Engineering Details
  architecture?: { label: string; value: string }[]
  entryConditions?: string[]
  localState?: LocalStateRow[]
  backendCalls?: BackendCallRow[]
  eventChain?: FlowStep[]
  validation?: string[]
  analytics?: AnalyticsEvent[]
  tests?: string[]
  related?: RelatedLink[]
}

/** Birleşik arama için düzleştirilmiş belge. */
export interface SearchDoc {
  id: string
  kind: 'screen' | 'backend' | 'issue' | 'tool'
  title: string
  subtitle?: string
  href: string
  keywords?: string[]
}
