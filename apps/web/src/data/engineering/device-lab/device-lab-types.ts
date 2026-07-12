// ============================================================================
// Device Lab – Shared Types
// ============================================================================

// === Device Types ===

export type DeviceStatus =
  | 'connected'
  | 'unauthorized'
  | 'offline'
  | 'app-not-installed'
  | 'incompatible-build'
  | 'busy'

export type TransportType = 'usb' | 'wifi'

export type BuildType = 'debug' | 'internal' | 'release' | 'production'

export type ConfigType = 'production' | 'staging' | 'development'

/**
 * ADB üzerinden bağlı olan veya geçmişte bağlanmış bir Android cihazın
 * anlık durum bilgisini temsil eder. Fiziksel cihazlar ve emülatörler
 * aynı yapı ile ifade edilir.
 */
export interface ConnectedDevice {
  id: string
  name: string
  serial: string
  isPhysical: boolean
  androidVersion: string
  apiLevel: number
  appInstalled: boolean
  appVersion: string | null
  isDebuggable: boolean
  status: DeviceStatus
  transport: TransportType
  buildType: BuildType | null
  configType: ConfigType | null
  batteryLevel: number
  lastUsed: string
  country: string | null
}

// === Scenario Types ===

export type RiskLevel = 'safe' | 'caution' | 'destructive'

export type BuildCompatibility = 'debug' | 'internal' | 'any' | 'root'

export type DeviceRequirement = 'any' | 'physical' | 'emulator'

export type ScenarioCategory =
  | 'schedule'
  | 'auth'
  | 'shared-prefs'
  | 'room-db'
  | 'offline-sync'
  | 'lifecycle'
  | 'permission'
  | 'diagnostic'

export type ParamType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'datetime'
  | 'select'
  | 'multiselect'

/**
 * Senaryo çalıştırılmadan önce kullanıcıdan alınacak bir parametre
 * tanımını temsil eder. `select` ve `multiselect` türleri için
 * `options` alanı zorunludur.
 */
export interface ScenarioParam {
  key: string
  label: string
  type: ParamType
  required: boolean
  defaultValue: any
  options?: { label: string; value: string }[]
  hint?: string
}

/**
 * Senaryo çalıştırılmadan önce gerçekleştirilecek ön kontrol adımı.
 * Örneğin "cihazda uygulama yüklü mü?" veya "debug build mi?" gibi
 * koşulları temsil eder.
 */
export interface PreflightCheck {
  id: string
  label: string
  description: string
  required: boolean
}

/**
 * ADB veya shell üzerinden çalıştırılacak tek bir komut adımı.
 * `command` alanı gerçek terminal komutunu içerir.
 */
export interface ScenarioCommand {
  step: number
  label: string
  command: string
  description: string
}

/**
 * Senaryo tamamlandıktan sonra değişikliğin doğrulanması için
 * yapılacak kontrol adımı. İsteğe bağlı olarak bir sorgu içerebilir.
 */
export interface VerificationStep {
  step: number
  label: string
  description: string
  query?: string
}

/**
 * Yapılan değişikliği geri almak için kullanılacak adım.
 * Her senaryo en az bir rollback adımı içermelidir.
 */
export interface RollbackStep {
  label: string
  command: string
  description: string
}

/**
 * Tek bir ADB senaryosunun tüm tanımını kapsayan ana yapı.
 * Parametreler, komutlar, doğrulama adımları ve geri alma
 * talimatlarını bir arada barındırır.
 */
export interface ScenarioPackage {
  id: string
  name: string
  description: string
  category: ScenarioCategory
  riskLevel: RiskLevel
  buildCompatibility: BuildCompatibility
  deviceRequirement: DeviceRequirement
  requiresRoot: boolean
  supportedPackages: string[]
  supportedAndroidVersions: string
  parameters: ScenarioParam[]
  preflightChecks: string[]
  commands: ScenarioCommand[]
  verificationSteps: VerificationStep[]
  rollbackSteps: RollbackStep[]
  /** Tahmini çalışma süresi (saniye) */
  estimatedDuration: number
  lastVerifiedVersion: string
  lastVerifiedAt: string
  owner: string
  reviewer: string
  version: string
  isFavorite: boolean
  executionCount: number
  tags: string[]
}

/**
 * Senaryo kategorisinin UI'da görüntülenmesi için gereken
 * meta bilgileri (ikon, etiket, açıklama, senaryo sayısı).
 */
export interface CategoryInfo {
  id: ScenarioCategory
  label: string
  description: string
  icon: string
  scenarioCount: number
}

// === Run Types ===

export type RunStatus = 'pending' | 'running' | 'success' | 'partial' | 'failed'

export type StepStatus = 'waiting' | 'running' | 'completed' | 'failed' | 'skipped'

/**
 * Senaryo çalıştırılırken her bir komut adımının anlık durumunu
 * ve çıktısını takip etmek için kullanılır.
 */
export interface RunStep {
  step: number
  label: string
  status: StepStatus
  output?: string
  startedAt?: string
  completedAt?: string
}

/**
 * Tamamlanmış veya devam eden bir senaryo çalıştırmasının
 * tüm kayıt bilgisini tutar. Parametre değerleri, önceki/yeni
 * değerler, terminal çıktısı ve geri alma durumu dahildir.
 */
export interface ExecutionRecord {
  id: string
  scenarioId: string
  scenarioName: string
  deviceId: string
  deviceName: string
  user: string
  startedAt: string
  completedAt: string | null
  status: RunStatus
  steps: RunStep[]
  parameters: Record<string, any>
  previousValues: Record<string, any>
  newValues: Record<string, any>
  terminalOutput: string
  linkedSessionId: string | null
  rollbackAvailable: boolean
}

// === Log Types ===

export type LogLevel = 'verbose' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export type LogSource =
  | 'app'
  | 'system'
  | 'network'
  | 'okhttp'
  | 'offline-queue'
  | 'fiscal'
  | 'scanner'
  | 'location'
  | 'payment'
  | 'crash'
  | 'workmanager'
  | 'firebase'
  | 'room'

export type CaptureMode =
  | 'quick'
  | 'app-session'
  | 'specific-flow'
  | 'crash-anr'
  | 'full-diagnostic'
  | 'custom'

export type SessionStatus = 'capturing' | 'paused' | 'stopped' | 'saved'

export type TimeRange = 'now' | '5min' | '15min' | '1hour' | 'app-start' | 'custom'

/**
 * Logcat'ten yakalanan tek bir log satırını temsil eder.
 * Süreç/thread bilgisi, korelasyon ID'leri ve ham metin
 * dahildir.
 */
export interface LogEvent {
  id: string
  timestamp: string
  source: LogSource
  level: LogLevel
  tag: string
  message: string
  processId: number
  threadId: number
  threadName: string
  correlationId?: string
  shipmentId?: string
  requestId?: string
  fiscalId?: string
  stackTrace?: string
  raw: string
}

/**
 * Log akışı içerisine eklenen zaman işareti. Kullanıcı
 * tarafından veya otomatik olarak eklenebilir; bir ADB
 * çalıştırmasıyla ilişkilendirilebilir.
 */
export interface LogMarker {
  id: string
  timestamp: string
  label: string
  type: 'user' | 'auto' | 'adb-run'
  linkedRunId?: string
}

/**
 * Belirli bir akış veya hata tipi için önceden tanımlanmış
 * log yakalama şablonu. Kaynak filtreleri, beklenen olaylar
 * ve anomali ipuçları içerir.
 */
export interface CapturePreset {
  id: string
  name: string
  description: string
  sources: LogSource[]
  tags: string[]
  levels: LogLevel[]
  expectedEvents: string[]
  anomalyHints: string[]
  systemDumps: string[]
  icon: string
}

/**
 * Bir cihazdan başlatılan log yakalama oturumu. Başlangıç/bitiş
 * zamanları, olay sayısı, işaretçiler ve paylaşım bilgilerini
 * kapsar.
 */
export interface LogSession {
  id: string
  deviceId: string
  deviceName: string
  presetId: string | null
  presetName: string | null
  status: SessionStatus
  startedAt: string
  stoppedAt: string | null
  /** Oturum süresi (saniye) */
  duration: number
  eventCount: number
  createdBy: string
  markers: LogMarker[]
  context: Record<string, string>
  sharedTo: string | null
}

/**
 * Birden fazla log olayını bir iş akışı içinde ilişkilendirmek
 * için kullanılan kural tanımı. Beklenen olaylar ve analiz
 * şablonu içerir.
 */
export interface CorrelationRule {
  id: string
  name: string
  flow: string
  expectedEvents: { event: string; required: boolean }[]
  analysisTemplate: string
}

/**
 * Log paylaşımı sırasında hassas verilerin maskelenmesi için
 * kullanılan gizlilik kuralı.
 */
export interface PrivacyRule {
  id: string
  field: string
  pattern: string
  replacement: string
  description: string
}

/**
 * Log oturumunun dışa aktarma ve paylaşım yapılandırması.
 * Format, erişim seviyesi ve süre sınırı gibi ayarları içerir.
 */
export interface ShareConfig {
  contents: string[]
  format: 'link' | 'zip' | 'plaintext' | 'ticket' | 'incident'
  access: 'internal' | 'team' | 'public'
  expiryDays: 7 | 30 | null
  auditEnabled: boolean
}
