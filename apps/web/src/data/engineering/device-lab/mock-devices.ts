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
    label: 'Connected',
    tone: 'green',
    dotClass: 'bg-green-500 animate-pulse',
    description: 'Device is connected and accessible via ADB.',
  },
  unauthorized: {
    label: 'Pending Authorization',
    tone: 'amber',
    dotClass: 'bg-amber-500 animate-pulse',
    description:
      'USB debugging permission has not yet been granted on the device. Confirm the permission dialog on the device screen.',
  },
  offline: {
    label: 'Offline',
    tone: 'gray',
    dotClass: 'bg-gray-400',
    description:
      'Device is detected but ADB connection cannot be established. Check the cable or change the USB mode.',
  },
  'app-not-installed': {
    label: 'App Not Installed',
    tone: 'orange',
    dotClass: 'bg-orange-500',
    description:
      'Device is connected but NesyMobile app is not installed. Install the app first.',
  },
  'incompatible-build': {
    label: 'Incompatible Build',
    tone: 'red',
    dotClass: 'bg-red-500',
    description:
      'The build installed on the device is incompatible with the selected scenario. Switch to the correct build type.',
  },
  busy: {
    label: 'Busy',
    tone: 'purple',
    dotClass: 'bg-purple-500 animate-pulse',
    description:
      'Another scenario is currently running on the device. Wait for it to complete or cancel it.',
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
    label: 'Safe',
    tone: 'green',
    description:
      'This scenario contains read-only queries or reversible changes. There is no risk of data loss.',
  },
  caution: {
    label: 'Caution',
    tone: 'amber',
    description:
      'This scenario makes changes on the device but is reversible. Run it after verifying the parameters.',
  },
  destructive: {
    label: 'Destructive',
    tone: 'red',
    description:
      'This scenario may make irreversible changes (e.g. database deletion, factory reset). Be extremely careful.',
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
      'Only runs on devices with a debug build installed. The debuggable flag must be active.',
  },
  internal: {
    label: 'Internal',
    tone: 'purple',
    description:
      'Requires an internal or debug build. Does not run on production builds.',
  },
  any: {
    label: 'All Builds',
    tone: 'green',
    description:
      'Can be run on all devices regardless of the build type.',
  },
  root: {
    label: 'Root Required',
    tone: 'red',
    description:
      'Runs on devices with root access. Typically used with emulators or specially configured test devices.',
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
