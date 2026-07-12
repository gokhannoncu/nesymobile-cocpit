// ============================================================================
// Device Lab – Mock Devices & Meta Mappings
// ============================================================================

import type {
  ConnectedDevice,
  DeviceStatus,
  RiskLevel,
  BuildType,
  BuildCompatibility,
} from './device-lab-types'
import type { Tone } from '@/components/product'

// ---------------------------------------------------------------------------
// 1. MOCK_DEVICES
// ---------------------------------------------------------------------------

export const MOCK_DEVICES: ConnectedDevice[] = [
  {
    id: 'dev-urovo-dt50-001',
    name: 'Urovo DT50',
    serial: 'UROVO-DT50-A1B2C3',
    isPhysical: true,
    androidVersion: '11',
    apiLevel: 30,
    appInstalled: true,
    appVersion: '4.12.1-debug',
    isDebuggable: true,
    status: 'connected',
    transport: 'usb',
    buildType: 'debug',
    configType: 'production',
    batteryLevel: 74,
    lastUsed: '2026-07-12T18:45:00Z',
    country: 'HR',
  },
  {
    id: 'dev-samsung-a13-002',
    name: 'Samsung Galaxy A13',
    serial: 'R5CR30LDJNM',
    isPhysical: true,
    androidVersion: '13',
    apiLevel: 33,
    appInstalled: true,
    appVersion: '4.12.0-internal',
    isDebuggable: true,
    status: 'connected',
    transport: 'wifi',
    buildType: 'internal',
    configType: 'staging',
    batteryLevel: 85,
    lastUsed: '2026-07-12T17:30:00Z',
    country: 'TR',
  },
  {
    id: 'dev-pixel7-emu-003',
    name: 'Google Pixel 7 Emulator',
    serial: 'emulator-5554',
    isPhysical: false,
    androidVersion: '14',
    apiLevel: 34,
    appInstalled: true,
    appVersion: '4.13.0-debug',
    isDebuggable: true,
    status: 'connected',
    transport: 'usb',
    buildType: 'debug',
    configType: 'development',
    batteryLevel: 100,
    lastUsed: '2026-07-12T19:10:00Z',
    country: null,
  },
  {
    id: 'dev-zebra-tc21-004',
    name: 'Zebra TC21',
    serial: 'ZEBRA-TC21-X9Y8Z7',
    isPhysical: true,
    androidVersion: '11',
    apiLevel: 30,
    appInstalled: false,
    appVersion: null,
    isDebuggable: false,
    status: 'unauthorized',
    transport: 'usb',
    buildType: null,
    configType: null,
    batteryLevel: 62,
    lastUsed: '2026-07-11T14:20:00Z',
    country: 'TR',
  },
  {
    id: 'dev-urovo-dt50-005',
    name: 'Urovo DT50 #2',
    serial: 'UROVO-DT50-D4E5F6',
    isPhysical: true,
    androidVersion: '11',
    apiLevel: 30,
    appInstalled: false,
    appVersion: null,
    isDebuggable: false,
    status: 'offline',
    transport: 'usb',
    buildType: null,
    configType: null,
    batteryLevel: 0,
    lastUsed: '2026-07-10T09:00:00Z',
    country: 'TR',
  },
  {
    id: 'dev-samsung-s23-006',
    name: 'Samsung Galaxy S23',
    serial: 'R5CT90MMWPE',
    isPhysical: true,
    androidVersion: '14',
    apiLevel: 34,
    appInstalled: false,
    appVersion: null,
    isDebuggable: false,
    status: 'app-not-installed',
    transport: 'wifi',
    buildType: null,
    configType: null,
    batteryLevel: 91,
    lastUsed: '2026-07-12T16:05:00Z',
    country: 'TR',
  },
]

// ---------------------------------------------------------------------------
// 2. DEVICE_STATUS_META
// ---------------------------------------------------------------------------

export const DEVICE_STATUS_META: Record<
  DeviceStatus,
  { label: string; tone: Tone; dotClass: string; description: string }
> = {
  connected: {
    label: 'Bağlı',
    tone: 'green',
    dotClass: 'bg-green-500 animate-pulse',
    description: 'Cihaz bağlı ve ADB üzerinden erişilebilir durumda.',
  },
  unauthorized: {
    label: 'Yetki Bekliyor',
    tone: 'amber',
    dotClass: 'bg-amber-500 animate-pulse',
    description:
      'Cihazda USB hata ayıklama izni henüz verilmedi. Cihaz ekranındaki izin iletişim kutusunu onaylayın.',
  },
  offline: {
    label: 'Çevrimdışı',
    tone: 'gray',
    dotClass: 'bg-gray-400',
    description:
      'Cihaz algılanıyor ancak ADB bağlantısı kurulamıyor. Kabloyu kontrol edin veya USB modunu değiştirin.',
  },
  'app-not-installed': {
    label: 'Uygulama Yüklü Değil',
    tone: 'orange',
    dotClass: 'bg-orange-500',
    description:
      'Cihaz bağlı ancak NesyMobile uygulaması yüklü değil. Önce uygulamayı yükleyin.',
  },
  'incompatible-build': {
    label: 'Uyumsuz Build',
    tone: 'red',
    dotClass: 'bg-red-500',
    description:
      'Cihazda yüklü build, seçilen senaryo ile uyumsuz. Doğru build türüne geçiş yapın.',
  },
  busy: {
    label: 'Meşgul',
    tone: 'purple',
    dotClass: 'bg-purple-500 animate-pulse',
    description:
      'Cihazda şu anda başka bir senaryo çalıştırılıyor. Tamamlanmasını bekleyin veya iptal edin.',
  },
}

// ---------------------------------------------------------------------------
// 3. RISK_LEVEL_META
// ---------------------------------------------------------------------------

export const RISK_LEVEL_META: Record<
  RiskLevel,
  { label: string; tone: Tone; description: string }
> = {
  safe: {
    label: 'Güvenli',
    tone: 'green',
    description:
      'Bu senaryo salt-okunur sorgular veya geri alınabilir değişiklikler içerir. Veri kaybı riski yoktur.',
  },
  caution: {
    label: 'Dikkat',
    tone: 'amber',
    description:
      'Bu senaryo cihaz üzerinde değişiklik yapar ancak geri alınabilir. Parametreleri doğruladıktan sonra çalıştırın.',
  },
  destructive: {
    label: 'Yıkıcı',
    tone: 'red',
    description:
      'Bu senaryo geri alınamaz değişiklikler yapabilir (örn. veritabanı silme, fabrika ayarlarına sıfırlama). Son derece dikkatli olun.',
  },
}

// ---------------------------------------------------------------------------
// 4. BUILD_COMPATIBILITY_META
// ---------------------------------------------------------------------------

export const BUILD_COMPATIBILITY_META: Record<
  BuildCompatibility,
  { label: string; tone: Tone; description: string }
> = {
  debug: {
    label: 'Debug',
    tone: 'blue',
    description:
      'Sadece debug build yüklü cihazlarda çalışır. Debuggable flag\'inin aktif olması gerekir.',
  },
  internal: {
    label: 'Internal',
    tone: 'purple',
    description:
      'Internal veya debug build gerektirir. Production build\'lerde çalışmaz.',
  },
  any: {
    label: 'Tüm Build\'ler',
    tone: 'green',
    description:
      'Build türünden bağımsız olarak tüm cihazlarda çalıştırılabilir.',
  },
  root: {
    label: 'Root Gerekli',
    tone: 'red',
    description:
      'Root erişimi olan cihazlarda çalışır. Genellikle emülatörler veya özel yapılandırılmış test cihazları ile kullanılır.',
  },
}

// ---------------------------------------------------------------------------
// 5. BUILD_TYPE_META
// ---------------------------------------------------------------------------

export const BUILD_TYPE_META: Record<
  BuildType,
  { label: string; tone: Tone }
> = {
  debug: {
    label: 'Debug',
    tone: 'blue',
  },
  internal: {
    label: 'Internal',
    tone: 'purple',
  },
  release: {
    label: 'Release',
    tone: 'teal',
  },
  production: {
    label: 'Production',
    tone: 'green',
  },
}
