// ============================================================================
// Device Lab – Real ADB Scenarios (Courier Mobile hard situations)
// ============================================================================
//
// ⚠️ `command` fields are COPY-PASTE PREVIEWS shown in the "commands" tab, not
//    executed code — execution lives in `lib/server/adb-scenario-executor.ts`.
//
// ⚠️ Every scenario below that broadcasts to `ChaosReceiver` targets a receiver
//    that DOES NOT EXIST in the NesyMobile app (verified: no ChaosReceiver in
//    app/src, Kotlin or manifest). Those previews cannot work today, and the
//    executor gates them behind `requiresChaos`. They are left in place as a
//    specification of what the receiver would need to support; do not read them
//    as working commands.
//
// The two Verdict control previews ARE real and are derived from
// `@nesy/control-channels` so they cannot drift from the executed call (C.9).

import type {
  ScenarioPackage,
  ScenarioCategory,
  ExecutionRecord,
  PreflightCheck,
  CategoryInfo,
} from './device-lab-types'
import type { ControlOperation } from '@nesy/control-contract'
import { previewCommand } from '@nesy/control-channels'

/** Packages used by NESY Courier Mobile flavors (test + common). */
export const NESY_MOBILE_PACKAGES = [
  'com.arasdigital.nesymobile.test',
  'com.arasdigital.nesymobile.rstest',
  'com.arasdigital.nesymobile.sitest',
  'com.arasdigital.nesymobile.batest',
  'com.arasdigital.nesymobile.metest',
  'com.arasdigital.nesymobile.aztest',
  'com.arasdigital.nesymobile.bgtest',
  'com.arasdigital.nesymobiledev',
]

const PKG = '{package}'
const SERIAL = '{serial}'

/**
 * Preview command for a control-plane op, rendered from the SAME routing table
 * the real call uses (`@nesy/control-channels`).
 *
 * These strings are copy-paste previews for the "commands" tab, not executed
 * code — execution goes through `adb-scenario-executor.ts`. They used to be
 * hand-written literals, which meant Faz 4 (mobile deletes both receivers)
 * would leave them SILENTLY WRONG: no error anywhere, the user just copies a
 * command that no longer works. Deriving them removes that failure mode.
 */
function controlPreview(
  op: Extract<ControlOperation['op'], 'get_device_id' | 'get_request_key'>,
): string {
  const envelope = { requestId: 'preview', scope: 'preview' }
  const built: ControlOperation =
    op === 'get_device_id'
      ? { ...envelope, op: 'get_device_id' }
      : { ...envelope, op: 'get_request_key' }
  return previewCommand(built, { applicationId: PKG, serial: SERIAL }) ?? ''
}

// ---------------------------------------------------------------------------
// 1. SCENARIO CATEGORIES
// ---------------------------------------------------------------------------

export const SCENARIO_CATEGORIES: CategoryInfo[] = [
  {
    id: 'network',
    label: 'Network',
    description: 'Offline, airplane, wifi flap chaos',
    icon: '📡',
    scenarioCount: 5,
  },
  {
    id: 'auth',
    label: 'Authentication',
    description: 'Token, session and API host chaos',
    icon: '🔐',
    scenarioCount: 4,
  },
  {
    id: 'schedule',
    label: 'Schedule',
    description: 'Schedule date skew and wipe',
    icon: '📅',
    scenarioCount: 3,
  },
  {
    id: 'shipment',
    label: 'Shipment',
    description: 'Shipment restart / queue chaos',
    icon: '📦',
    scenarioCount: 1,
  },
  {
    id: 'lifecycle',
    label: 'Lifecycle',
    description: 'Process kill and cold start',
    icon: '🔄',
    scenarioCount: 2,
  },
  {
    id: 'permission',
    label: 'Permissions',
    description: 'Runtime permission revocation',
    icon: '🛡️',
    scenarioCount: 2,
  },
  {
    id: 'diagnostic',
    label: 'Diagnostic',
    description: 'State dump, protected key, bug pack',
    icon: '🔍',
    scenarioCount: 3,
  },
]

// ---------------------------------------------------------------------------
// 2. PREFLIGHT CHECKS
// ---------------------------------------------------------------------------

export const PREFLIGHT_CHECKS: PreflightCheck[] = [
  {
    id: 'device-connected',
    label: 'Device connected and ADB access available',
    description: 'Verification of ADB connection via USB or WiFi',
    required: true,
  },
  {
    id: 'app-installed',
    label: 'NesyMobile app installed',
    description: 'Target package name must be present on device',
    required: true,
  },
  {
    id: 'debuggable',
    label: 'Debug / test build (chaos receiver)',
    description: 'Verdict control SDK only — ChaosReceiver does not exist in the app (see note at top of file)',
    required: false,
  },
  {
    id: 'chaos-receiver',
    label: 'Chaos receiver available',
    description: 'Test/dev flavor with ENABLE_CHAOS_RECEIVER',
    required: false,
  },
  {
    id: 'battery-ok',
    label: 'Battery level sufficient (>20%)',
    description: 'Minimum battery level for long operations',
    required: false,
  },
  {
    id: 'no-active-run',
    label: 'No other scenario in progress',
    description: 'Conflict prevention — single run',
    required: true,
  },
]

// ---------------------------------------------------------------------------
// 3. QUICK VIEW FILTERS
// ---------------------------------------------------------------------------

export const QUICK_VIEW_FILTERS = [
  { key: 'all', label: 'All', icon: '📋' },
  { key: 'frequently-used', label: 'Frequently Used', icon: '🔥' },
  { key: 'safe', label: 'Safe', icon: '🛡️' },
  { key: 'data-manipulation', label: 'Data Manipulation', icon: '📊' },
  { key: 'favorites', label: 'Favorites', icon: '⭐' },
  { key: 'debug-only', label: 'Debug Only', icon: '🐛' },
] as const

function baseScenario(
  partial: Omit<ScenarioPackage, 'supportedPackages' | 'supportedAndroidVersions' | 'requiresRoot' | 'deviceRequirement' | 'lastVerifiedVersion' | 'lastVerifiedAt' | 'owner' | 'reviewer' | 'version' | 'executionCount'> &
    Partial<ScenarioPackage>,
): ScenarioPackage {
  return {
    supportedPackages: NESY_MOBILE_PACKAGES,
    supportedAndroidVersions: '>=10',
    requiresRoot: false,
    deviceRequirement: 'any',
    lastVerifiedVersion: '0.1157',
    lastVerifiedAt: '2026-07-18',
    owner: 'Device Lab',
    reviewer: 'Device Lab',
    version: '2.0.0',
    executionCount: 0,
    ...partial,
  }
}

// ---------------------------------------------------------------------------
// 4. SCENARIO PACKAGES (20 hard situations)
// ---------------------------------------------------------------------------

export const SCENARIO_PACKAGES: ScenarioPackage[] = [
  baseScenario({
    id: 'scn-mid-delivery-offline',
    name: 'Mid-Delivery Offline',
    description: 'Cuts Wi-Fi and mobile data to simulate network loss during delivery/scan.',
    category: 'network',
    riskLevel: 'caution',
    buildCompatibility: 'any',
    parameters: [],
    preflightChecks: ['device-connected', 'app-installed', 'no-active-run'],
    commands: [
      { step: 1, label: 'Disable Wi-Fi', command: `adb -s ${SERIAL} shell svc wifi disable`, description: 'Wi-Fi off' },
      { step: 2, label: 'Disable data', command: `adb -s ${SERIAL} shell svc data disable`, description: 'Mobile data off' },
    ],
    verificationSteps: [
      { step: 1, label: 'App shows offline', description: 'Courier UI / OfflineModeOldService should mark offline' },
    ],
    rollbackSteps: [
      { label: 'Restore network', command: `adb -s ${SERIAL} shell svc wifi enable && adb -s ${SERIAL} shell svc data enable`, description: 'Re-enable radios' },
    ],
    estimatedDuration: 6,
    isFavorite: true,
    tags: ['network', 'offline', 'delivery'],
  }),
  baseScenario({
    id: 'scn-force-offline-flag',
    name: 'Force Offline Flag',
    description: 'Forces SharedPreferences offlineMode via ChaosReceiver (bypasses health probe).',
    category: 'network',
    riskLevel: 'caution',
    buildCompatibility: 'debug',
    parameters: [
      { key: 'offline', label: 'Offline', type: 'boolean', required: true, defaultValue: true },
    ],
    preflightChecks: ['device-connected', 'app-installed', 'debuggable', 'chaos-receiver', 'no-active-run'],
    commands: [
      {
        step: 1,
        label: 'SET_OFFLINE',
        command: `adb -s ${SERIAL} shell am broadcast -n ${PKG}/${'com.arasdigital.nesymobile.adb.ChaosReceiver'} -a com.arasdigital.nesymobile.SET_OFFLINE --ez offline {offline}`,
        description: 'Force offlineMode preference',
      },
    ],
    verificationSteps: [
      { step: 1, label: 'DUMP_STATE', description: 'offlineMode should match parameter' },
    ],
    rollbackSteps: [
      {
        label: 'Clear offline flag',
        command: `adb -s ${SERIAL} shell am broadcast -n ${PKG}/com.arasdigital.nesymobile.adb.ChaosReceiver -a com.arasdigital.nesymobile.SET_OFFLINE --ez offline false`,
        description: 'offlineMode=false',
      },
    ],
    estimatedDuration: 4,
    isFavorite: true,
    tags: ['network', 'offline', 'chaos'],
  }),
  baseScenario({
    id: 'scn-restore-network',
    name: 'Restore Network',
    description: 'Re-enables Wi-Fi/data and clears airplane mode so offline queue can drain.',
    category: 'network',
    riskLevel: 'safe',
    buildCompatibility: 'any',
    parameters: [],
    preflightChecks: ['device-connected', 'app-installed', 'no-active-run'],
    commands: [
      { step: 1, label: 'Enable Wi-Fi', command: `adb -s ${SERIAL} shell svc wifi enable`, description: 'Wi-Fi on' },
      { step: 2, label: 'Enable data', command: `adb -s ${SERIAL} shell svc data enable`, description: 'Data on' },
    ],
    verificationSteps: [
      { step: 1, label: 'Queue drain', description: 'Watch RequestSenderService / OkHttp logs' },
    ],
    rollbackSteps: [{ label: 'N/A', command: '# N/A', description: 'Harmless restore' }],
    estimatedDuration: 5,
    isFavorite: true,
    tags: ['network', 'restore', 'sync'],
  }),
  baseScenario({
    id: 'scn-airplane-mode',
    name: 'Airplane Mode Toggle',
    description: 'Toggles airplane mode for hard radio-off conditions.',
    category: 'network',
    riskLevel: 'caution',
    buildCompatibility: 'any',
    parameters: [
      { key: 'enabled', label: 'Airplane On', type: 'boolean', required: true, defaultValue: true },
    ],
    preflightChecks: ['device-connected', 'app-installed', 'no-active-run'],
    commands: [
      {
        step: 1,
        label: 'Airplane mode',
        command: `adb -s ${SERIAL} shell settings put global airplane_mode_on {enabled}`,
        description: 'Toggle airplane',
      },
    ],
    verificationSteps: [
      { step: 1, label: 'Connectivity', description: 'Confirm no network in courier app' },
    ],
    rollbackSteps: [
      {
        label: 'Airplane off',
        command: `adb -s ${SERIAL} shell settings put global airplane_mode_on 0`,
        description: 'Disable airplane',
      },
    ],
    estimatedDuration: 4,
    isFavorite: false,
    tags: ['network', 'airplane'],
  }),
  baseScenario({
    id: 'scn-network-flap',
    name: 'Network Flap ×3',
    description: 'Rapid Wi-Fi off/on cycles to stress offline transitions and queue.',
    category: 'network',
    riskLevel: 'caution',
    buildCompatibility: 'any',
    parameters: [],
    preflightChecks: ['device-connected', 'app-installed', 'battery-ok', 'no-active-run'],
    commands: [
      { step: 1, label: 'Wi-Fi flap loop', command: `adb -s ${SERIAL} shell svc wifi disable/enable ×3`, description: 'Three flaps' },
    ],
    verificationSteps: [
      { step: 1, label: 'Transition log', description: 'Check NetworkDiagnosticLogger file / logcat' },
    ],
    rollbackSteps: [
      { label: 'Ensure Wi-Fi on', command: `adb -s ${SERIAL} shell svc wifi enable`, description: 'Leave radio on' },
    ],
    estimatedDuration: 12,
    isFavorite: false,
    tags: ['network', 'flap', 'stress'],
  }),
  baseScenario({
    id: 'scn-clear-token',
    name: 'Clear Session Token',
    description: 'Clears JWT and relaunches app — forces re-login.',
    category: 'auth',
    riskLevel: 'caution',
    buildCompatibility: 'debug',
    parameters: [],
    preflightChecks: ['device-connected', 'app-installed', 'debuggable', 'chaos-receiver', 'no-active-run'],
    commands: [
      {
        step: 1,
        label: 'CLEAR_TOKEN',
        command: `adb -s ${SERIAL} shell am broadcast -n ${PKG}/com.arasdigital.nesymobile.adb.ChaosReceiver -a com.arasdigital.nesymobile.CLEAR_TOKEN`,
        description: 'Clear SP.token',
      },
      {
        step: 2,
        label: 'Relaunch',
        command: `adb -s ${SERIAL} shell am force-stop ${PKG} && adb -s ${SERIAL} shell am start -n ${PKG}/com.arasdigital.nesymobile.SplashActivity`,
        description: 'Restart app',
      },
    ],
    verificationSteps: [
      { step: 1, label: 'Login screen', description: 'App should land on login' },
    ],
    rollbackSteps: [
      { label: 'Re-login', command: '# Use field-login or manual login', description: 'Session must be recreated' },
    ],
    estimatedDuration: 8,
    isFavorite: true,
    tags: ['auth', 'token', 'logout'],
  }),
  baseScenario({
    id: 'scn-corrupt-token',
    name: 'Corrupt Token (401)',
    description: 'Corrupts the bearer token so the next API call hits 401 / ErrorInterceptor logout.',
    category: 'auth',
    riskLevel: 'caution',
    buildCompatibility: 'debug',
    parameters: [],
    preflightChecks: ['device-connected', 'app-installed', 'debuggable', 'chaos-receiver', 'no-active-run'],
    commands: [
      {
        step: 1,
        label: 'CORRUPT_TOKEN',
        command: `adb -s ${SERIAL} shell am broadcast -n ${PKG}/com.arasdigital.nesymobile.adb.ChaosReceiver -a com.arasdigital.nesymobile.CORRUPT_TOKEN`,
        description: 'Corrupt token string',
      },
    ],
    verificationSteps: [
      { step: 1, label: 'Trigger API', description: 'Navigate to a screen that calls API — expect logout' },
    ],
    rollbackSteps: [
      { label: 'Re-login', command: '# Re-login required', description: 'Restore valid session' },
    ],
    estimatedDuration: 5,
    isFavorite: false,
    tags: ['auth', 'token', '401'],
  }),
  baseScenario({
    id: 'scn-expire-token-foreground',
    name: 'Expire Token (Foreground)',
    description: 'Injects an expired JWT and relaunches — ScheduleSessionValidator should logout.',
    category: 'auth',
    riskLevel: 'caution',
    buildCompatibility: 'debug',
    parameters: [],
    preflightChecks: ['device-connected', 'app-installed', 'debuggable', 'chaos-receiver', 'no-active-run'],
    commands: [
      {
        step: 1,
        label: 'SET_TOKEN_EXPIRY_HINT',
        command: `adb -s ${SERIAL} shell am broadcast -n ${PKG}/com.arasdigital.nesymobile.adb.ChaosReceiver -a com.arasdigital.nesymobile.SET_TOKEN_EXPIRY_HINT`,
        description: 'Write expired JWT',
      },
      {
        step: 2,
        label: 'Relaunch',
        command: `adb -s ${SERIAL} shell am force-stop ${PKG} && adb -s ${SERIAL} shell am start -n ${PKG}/com.arasdigital.nesymobile.SplashActivity`,
        description: 'Trigger foreground session check',
      },
    ],
    verificationSteps: [
      { step: 1, label: 'Logout', description: 'Expect login after JWT exp check' },
    ],
    rollbackSteps: [
      { label: 'Re-login', command: '# Re-login required', description: 'Restore session' },
    ],
    estimatedDuration: 8,
    isFavorite: true,
    tags: ['auth', 'jwt', 'expiry'],
  }),
  baseScenario({
    id: 'scn-schedule-yesterday',
    name: 'Schedule Date → Yesterday',
    description: 'Mutates Room scheduleMetaJson.scheduleDate to yesterday so hasValidTodaySchedule fails.',
    category: 'schedule',
    riskLevel: 'caution',
    buildCompatibility: 'debug',
    parameters: [],
    preflightChecks: ['device-connected', 'app-installed', 'debuggable', 'chaos-receiver', 'no-active-run'],
    commands: [
      {
        step: 1,
        label: 'SET_SCHEDULE_DATE yesterday',
        command: `adb -s ${SERIAL} shell am broadcast -n ${PKG}/com.arasdigital.nesymobile.adb.ChaosReceiver -a com.arasdigital.nesymobile.SET_SCHEDULE_DATE --es date_offset yesterday`,
        description: 'Skew schedule date',
      },
      {
        step: 2,
        label: 'Relaunch',
        command: `adb -s ${SERIAL} shell am force-stop ${PKG} && adb -s ${SERIAL} shell am start -n ${PKG}/com.arasdigital.nesymobile.SplashActivity`,
        description: 'Apply schedule validation',
      },
    ],
    verificationSteps: [
      { step: 1, label: 'Route selection', description: 'App should not treat schedule as today' },
    ],
    rollbackSteps: [
      {
        label: 'Set today',
        command: `adb -s ${SERIAL} shell am broadcast -n ${PKG}/com.arasdigital.nesymobile.adb.ChaosReceiver -a com.arasdigital.nesymobile.SET_SCHEDULE_DATE --es date_offset tomorrow`,
        description: 'Or re-fetch schedule from server',
      },
    ],
    estimatedDuration: 10,
    isFavorite: true,
    tags: ['schedule', 'date', 'chaos'],
  }),
  baseScenario({
    id: 'scn-schedule-tomorrow',
    name: 'Schedule Date → Tomorrow',
    description: 'Sets scheduleDate to tomorrow (postpone / future-day edge).',
    category: 'schedule',
    riskLevel: 'caution',
    buildCompatibility: 'debug',
    parameters: [],
    preflightChecks: ['device-connected', 'app-installed', 'debuggable', 'chaos-receiver', 'no-active-run'],
    commands: [
      {
        step: 1,
        label: 'SET_SCHEDULE_DATE tomorrow',
        command: `adb -s ${SERIAL} shell am broadcast -n ${PKG}/com.arasdigital.nesymobile.adb.ChaosReceiver -a com.arasdigital.nesymobile.SET_SCHEDULE_DATE --es date_offset tomorrow`,
        description: 'Future schedule date',
      },
      {
        step: 2,
        label: 'Relaunch',
        command: `adb -s ${SERIAL} shell am force-stop ${PKG} && adb -s ${SERIAL} shell am start -n ${PKG}/com.arasdigital.nesymobile.SplashActivity`,
        description: 'Apply validation',
      },
    ],
    verificationSteps: [
      { step: 1, label: 'Schedule validity', description: 'Confirm today-schedule logic rejects or routes correctly' },
    ],
    rollbackSteps: [
      { label: 'Re-sync schedule', command: '# Login / GetMySchedule', description: 'Restore from server' },
    ],
    estimatedDuration: 10,
    isFavorite: false,
    tags: ['schedule', 'postpone', 'date'],
  }),
  baseScenario({
    id: 'scn-clear-schedule',
    name: 'Clear Schedule Tables',
    description: 'Wipes local schedule (and optionally request queue) via ChaosReceiver.',
    category: 'schedule',
    riskLevel: 'destructive',
    buildCompatibility: 'debug',
    parameters: [
      { key: 'clearQueue', label: 'Also clear request queue', type: 'boolean', required: false, defaultValue: false },
    ],
    preflightChecks: ['device-connected', 'app-installed', 'debuggable', 'chaos-receiver', 'no-active-run'],
    commands: [
      {
        step: 1,
        label: 'CLEAR_SCHEDULE',
        command: `adb -s ${SERIAL} shell am broadcast -n ${PKG}/com.arasdigital.nesymobile.adb.ChaosReceiver -a com.arasdigital.nesymobile.CLEAR_SCHEDULE --ez clear_queue {clearQueue}`,
        description: 'Delete schedule rows',
      },
    ],
    verificationSteps: [
      { step: 1, label: 'Empty schedule', description: 'Stop list / schedule screens empty or prompt route select' },
    ],
    rollbackSteps: [
      { label: 'Re-fetch schedule', command: '# GetMySchedule after login', description: 'Restore from API' },
    ],
    estimatedDuration: 8,
    isFavorite: false,
    tags: ['schedule', 'destructive', 'room'],
  }),
  baseScenario({
    id: 'scn-restart-shipment',
    name: 'Restart Shipment',
    description: 'Cancels waiting delivery requests for a waybill (Chaos RESTART_SHIPMENT).',
    category: 'shipment',
    riskLevel: 'caution',
    buildCompatibility: 'debug',
    parameters: [
      { key: 'waybill', label: 'Waybill number', type: 'text', required: true, defaultValue: '', hint: 'Exact waybill on device queue' },
    ],
    preflightChecks: ['device-connected', 'app-installed', 'debuggable', 'chaos-receiver', 'no-active-run'],
    commands: [
      {
        step: 1,
        label: 'RESTART_SHIPMENT',
        command: `adb -s ${SERIAL} shell am broadcast -n ${PKG}/com.arasdigital.nesymobile.adb.ChaosReceiver -a com.arasdigital.nesymobile.RESTART_SHIPMENT --es waybill "{waybill}"`,
        description: 'Delete matching delivery queue items',
      },
    ],
    verificationSteps: [
      { step: 1, label: 'Queue', description: 'Waiting deliverParcels for waybill removed; check RestartDebug logs' },
    ],
    rollbackSteps: [
      { label: 'Re-deliver', command: '# Manual re-delivery on device', description: 'Cannot auto-restore UI state' },
    ],
    estimatedDuration: 6,
    isFavorite: true,
    tags: ['shipment', 'restart', 'queue'],
  }),
  baseScenario({
    id: 'scn-alt-api-endpoint',
    name: 'Alternate API Endpoint',
    description: 'Points HostSelectionInterceptor at a custom host (pinning may break).',
    category: 'auth',
    riskLevel: 'caution',
    buildCompatibility: 'debug',
    parameters: [
      { key: 'host', label: 'Host', type: 'text', required: true, defaultValue: '10.0.2.2', hint: 'Hostname without scheme' },
      { key: 'scheme', label: 'Scheme', type: 'select', required: true, defaultValue: 'https', options: [
        { label: 'https', value: 'https' },
        { label: 'http', value: 'http' },
      ] },
      { key: 'port', label: 'Port', type: 'number', required: false, defaultValue: 0, hint: '0 = default' },
    ],
    preflightChecks: ['device-connected', 'app-installed', 'debuggable', 'chaos-receiver', 'no-active-run'],
    commands: [
      {
        step: 1,
        label: 'SET_ALT_URL',
        command: `adb -s ${SERIAL} shell am broadcast -n ${PKG}/com.arasdigital.nesymobile.adb.ChaosReceiver -a com.arasdigital.nesymobile.SET_ALT_URL --es host "{host}" --es scheme "{scheme}" --ei port {port}`,
        description: 'Write alternativeURL prefs',
      },
    ],
    verificationSteps: [
      { step: 1, label: 'Next API call', description: 'Traffic goes to alt host or fails pinning' },
    ],
    rollbackSteps: [
      {
        label: 'Clear alt URL',
        command: `adb -s ${SERIAL} shell am broadcast -n ${PKG}/com.arasdigital.nesymobile.adb.ChaosReceiver -a com.arasdigital.nesymobile.SET_ALT_URL --es host "" --es scheme "https" --ei port 0`,
        description: 'May need in-app delete-DB / clear prefs',
      },
    ],
    estimatedDuration: 8,
    isFavorite: false,
    tags: ['auth', 'api', 'host'],
  }),
  baseScenario({
    id: 'scn-force-stop-mid-tour',
    name: 'Force-Stop Mid-Tour',
    description: 'Kills the process mid-tour and relaunches SplashActivity.',
    category: 'lifecycle',
    riskLevel: 'safe',
    buildCompatibility: 'any',
    parameters: [
      { key: 'waitSec', label: 'Wait (sec)', type: 'number', required: false, defaultValue: 2 },
    ],
    preflightChecks: ['device-connected', 'app-installed', 'no-active-run'],
    commands: [
      { step: 1, label: 'Force-stop', command: `adb -s ${SERIAL} shell am force-stop ${PKG}`, description: 'Kill process' },
      { step: 2, label: 'Start Splash', command: `adb -s ${SERIAL} shell am start -n ${PKG}/com.arasdigital.nesymobile.SplashActivity`, description: 'Cold-ish start' },
    ],
    verificationSteps: [
      { step: 1, label: 'Recovery', description: 'Session/schedule restore behaves correctly' },
    ],
    rollbackSteps: [{ label: 'N/A', command: '# N/A', description: 'Harmless' }],
    estimatedDuration: 6,
    isFavorite: true,
    tags: ['lifecycle', 'force-stop'],
  }),
  baseScenario({
    id: 'scn-pm-clear-cold',
    name: 'Clear App Data (Cold)',
    description: 'Destructive pm clear — wipes prefs, Room DB, and login state.',
    category: 'lifecycle',
    riskLevel: 'destructive',
    buildCompatibility: 'any',
    parameters: [],
    preflightChecks: ['device-connected', 'app-installed', 'no-active-run'],
    commands: [
      { step: 1, label: 'pm clear', command: `adb -s ${SERIAL} shell pm clear ${PKG}`, description: 'Full app data wipe' },
      { step: 2, label: 'Start Splash', command: `adb -s ${SERIAL} shell am start -n ${PKG}/com.arasdigital.nesymobile.SplashActivity`, description: 'Fresh launch' },
    ],
    verificationSteps: [
      { step: 1, label: 'Login required', description: 'No residual schedule/token' },
    ],
    rollbackSteps: [
      { label: 'Re-login', command: '# Field login / manual', description: 'Full setup again' },
    ],
    estimatedDuration: 10,
    isFavorite: false,
    tags: ['lifecycle', 'destructive', 'pm-clear'],
  }),
  baseScenario({
    id: 'scn-revoke-location',
    name: 'Revoke Location Permission',
    description: 'Revokes fine/coarse location to break LocationService / headers.',
    category: 'permission',
    riskLevel: 'caution',
    buildCompatibility: 'any',
    parameters: [],
    preflightChecks: ['device-connected', 'app-installed', 'no-active-run'],
    commands: [
      {
        step: 1,
        label: 'Revoke FINE',
        command: `adb -s ${SERIAL} shell pm revoke ${PKG} android.permission.ACCESS_FINE_LOCATION`,
        description: 'Revoke fine location',
      },
      {
        step: 2,
        label: 'Revoke COARSE',
        command: `adb -s ${SERIAL} shell pm revoke ${PKG} android.permission.ACCESS_COARSE_LOCATION`,
        description: 'Revoke coarse location',
      },
    ],
    verificationSteps: [
      { step: 1, label: 'Location flows', description: 'Delivery/location dependent screens fail gracefully' },
    ],
    rollbackSteps: [
      {
        label: 'Re-grant',
        command: `adb -s ${SERIAL} shell pm grant ${PKG} android.permission.ACCESS_FINE_LOCATION`,
        description: 'Grant location again',
      },
    ],
    estimatedDuration: 5,
    isFavorite: false,
    tags: ['permission', 'location'],
  }),
  baseScenario({
    id: 'scn-revoke-camera',
    name: 'Revoke Camera Permission',
    description: 'Revokes CAMERA to break barcode / damage photo flows.',
    category: 'permission',
    riskLevel: 'caution',
    buildCompatibility: 'any',
    parameters: [],
    preflightChecks: ['device-connected', 'app-installed', 'no-active-run'],
    commands: [
      {
        step: 1,
        label: 'Revoke CAMERA',
        command: `adb -s ${SERIAL} shell pm revoke ${PKG} android.permission.CAMERA`,
        description: 'Revoke camera',
      },
    ],
    verificationSteps: [
      { step: 1, label: 'Scan/camera', description: 'Camera fragment should request or fail cleanly' },
    ],
    rollbackSteps: [
      {
        label: 'Re-grant',
        command: `adb -s ${SERIAL} shell pm grant ${PKG} android.permission.CAMERA`,
        description: 'Grant camera',
      },
    ],
    estimatedDuration: 4,
    isFavorite: false,
    tags: ['permission', 'camera', 'scan'],
  }),
  baseScenario({
    id: 'scn-dump-courier-state',
    name: 'Dump Courier State',
    description: 'Broadcast DUMP_STATE — returns token/schedule/offline JSON via result data.',
    category: 'diagnostic',
    riskLevel: 'safe',
    buildCompatibility: 'debug',
    parameters: [],
    preflightChecks: ['device-connected', 'app-installed', 'debuggable', 'chaos-receiver', 'no-active-run'],
    commands: [
      {
        step: 1,
        label: 'DUMP_STATE',
        command: `adb -s ${SERIAL} shell am broadcast -n ${PKG}/com.arasdigital.nesymobile.adb.ChaosReceiver -a com.arasdigital.nesymobile.DUMP_STATE`,
        description: 'Read courier debug snapshot',
      },
    ],
    verificationSteps: [
      { step: 1, label: 'Result data', description: 'Broadcast data= JSON with scheduleId/offlineMode' },
    ],
    rollbackSteps: [{ label: 'N/A', command: '# N/A', description: 'Read-only' }],
    estimatedDuration: 3,
    isFavorite: true,
    tags: ['diagnostic', 'dump', 'chaos'],
  }),
  baseScenario({
    id: 'scn-get-protected-key',
    name: 'Get Protected Key + Device ID',
    description: 'Exercises Verdict get_request_key/get_device_id used by Cockpit field-login.',
    category: 'diagnostic',
    riskLevel: 'safe',
    buildCompatibility: 'debug',
    parameters: [],
    preflightChecks: ['device-connected', 'app-installed', 'debuggable', 'chaos-receiver', 'no-active-run'],
    commands: [
      {
        step: 1,
        label: 'GET_DEVICE_ID',
        command: controlPreview('get_device_id'),
        description: 'ANDROID_ID via broadcast',
      },
      {
        step: 2,
        label: 'GET_KEY',
        command: controlPreview('get_request_key'),
        description: 'Native protected request key',
      },
    ],
    verificationSteps: [
      { step: 1, label: 'Result data', description: 'Non-empty data= for both actions' },
    ],
    rollbackSteps: [{ label: 'N/A', command: '# N/A', description: 'Read-only' }],
    estimatedDuration: 5,
    isFavorite: true,
    tags: ['diagnostic', 'protected-key', 'field-login'],
  }),
  baseScenario({
    id: 'scn-capture-bugreport',
    name: 'Capture Device Bug Pack',
    description: 'Collects props, package dump, and recent Chaos/Restart logs (lightweight bug pack).',
    category: 'diagnostic',
    riskLevel: 'safe',
    buildCompatibility: 'any',
    parameters: [],
    preflightChecks: ['device-connected', 'app-installed', 'no-active-run'],
    commands: [
      { step: 1, label: 'Device props', command: `adb -s ${SERIAL} shell getprop ro.product.model`, description: 'Model / battery' },
      { step: 2, label: 'Package dump', command: `adb -s ${SERIAL} shell dumpsys package ${PKG}`, description: 'Version / debuggable' },
      { step: 3, label: 'Logcat slice', command: `adb -s ${SERIAL} logcat -d -t 80 -s ChaosReceiver:I`, description: 'Recent chaos logs' },
    ],
    verificationSteps: [
      { step: 1, label: 'Output', description: 'Terminal shows device + package + logs' },
    ],
    rollbackSteps: [{ label: 'N/A', command: '# N/A', description: 'Read-only' }],
    estimatedDuration: 15,
    isFavorite: false,
    tags: ['diagnostic', 'bugreport', 'logs'],
  }),
]

/** Empty until real runs are recorded in the client session. */
export const MOCK_EXECUTION_HISTORY: ExecutionRecord[] = []

// ---------------------------------------------------------------------------
// 5. HELPERS
// ---------------------------------------------------------------------------

export function getScenariosByCategory(category: ScenarioCategory): ScenarioPackage[] {
  return SCENARIO_PACKAGES.filter((s) => s.category === category)
}

export function filterScenarios(
  search: string,
  filter: string,
  category: ScenarioCategory | null,
): ScenarioPackage[] {
  let results = [...SCENARIO_PACKAGES]

  if (category) {
    results = results.filter((s) => s.category === category)
  }

  switch (filter) {
    case 'frequently-used':
      results = results.filter((s) => s.isFavorite)
      break
    case 'safe':
      results = results.filter((s) => s.riskLevel === 'safe')
      break
    case 'data-manipulation':
      results = results.filter((s) => ['schedule', 'shipment', 'auth'].includes(s.category))
      break
    case 'favorites':
      results = results.filter((s) => s.isFavorite)
      break
    case 'debug-only':
      results = results.filter((s) => s.buildCompatibility === 'debug')
      break
  }

  if (search.trim()) {
    const q = search.toLowerCase()
    results = results.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some((t) => t.includes(q)),
    )
  }

  return results
}

export function getScenarioById(id: string): ScenarioPackage | undefined {
  return SCENARIO_PACKAGES.find((s) => s.id === id)
}

/** Interpolate command preview with serial + params (display only). */
export function interpolateCommand(
  template: string,
  serial: string,
  packageName: string,
  params: Record<string, unknown>,
): string {
  let out = template.replaceAll('{serial}', serial).replaceAll('{package}', packageName)
  for (const [key, value] of Object.entries(params)) {
    out = out.replaceAll(`{${key}}`, String(value ?? ''))
  }
  return out
}
