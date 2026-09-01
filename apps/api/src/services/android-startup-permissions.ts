import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { getAdbPathHint, resolveAdbPath } from '@nesy/platform-paths'

const execFileAsync = promisify(execFile)

export const STARTUP_PERMISSION_PLAN_STEP_ID = 'prepare-startup-permissions'
export const STARTUP_PERMISSION_ANNOTATION = 'POST_LAUNCH_ANDROID_PERMISSION_BOOTSTRAP'

export const NESY_LOGIN_STARTUP_PERMISSIONS = [
  'android.permission.ACCESS_COARSE_LOCATION',
  'android.permission.ACCESS_FINE_LOCATION',
  'android.permission.CAMERA',
  'android.permission.CALL_PHONE',
  'android.permission.READ_CALL_LOG',
  'android.permission.WRITE_CALL_LOG',
  'android.permission.READ_PHONE_STATE',
  'android.permission.READ_PHONE_NUMBERS',
  'android.permission.POST_NOTIFICATIONS',
] as const

const OVERLAY_PERMISSION = 'android.permission.SYSTEM_ALERT_WINDOW'
const NESY_PACKAGE = /^com\.arasdigital\.nesymobile(?:[a-z0-9.]*)$/i

export type AndroidPermissionAdbRunner = (
  deviceId: string,
  args: readonly string[],
  timeoutMs?: number,
) => Promise<string>

export interface AndroidStartupPermissionReport {
  ok: true
  changed: boolean
  restarted: boolean
  grantedNow: readonly string[]
  alreadyGranted: readonly string[]
  skippedNotRuntime: readonly string[]
  overlay: 'granted-now' | 'already-granted' | 'not-requested'
}

function adbBinary(): string {
  const resolved = resolveAdbPath()
  if (resolved === null) throw new Error(`adb binary not found. ${getAdbPathHint()}`)
  return resolved
}

async function runAdb(deviceId: string, args: readonly string[], timeoutMs = 15_000): Promise<string> {
  const result = await execFileAsync(adbBinary(), ['-s', deviceId, ...args], {
    timeout: timeoutMs,
    maxBuffer: 2 * 1024 * 1024,
  })
  return String(result.stdout).trim()
}

export function parseRuntimePermissionGrants(packageDump: string): ReadonlyMap<string, boolean> {
  const grants = new Map<string, boolean>()
  const runtimeSection =
    packageDump.match(/\bruntime permissions:\s*\n([\s\S]*?)(?=\n {0,6}\S|\n\S|$)/)?.[1] ?? ''
  for (const match of runtimeSection.matchAll(/^\s*(android\.permission\.[A-Z0-9_]+): granted=(true|false)\b/gm)) {
    grants.set(match[1]!, match[2] === 'true')
  }
  return grants
}

function packageRequests(packageDump: string, permission: string): boolean {
  return packageDump.includes(permission)
}

function overlayAllowed(appOps: string): boolean {
  return /\bSYSTEM_ALERT_WINDOW:\s*allow\b/i.test(appOps)
}

/**
 * Setup-only step for a cold/clean install.
 *
 * MainActivity opens its own permission confirmation dialog before the system
 * dialogs. When grants change we therefore restart once: the second launch
 * observes all grants and reaches LoginFragment without touching either dialog.
 */
export async function ensureNesyLoginStartupPermissions(input: {
  deviceId: string
  applicationId: string
  runner?: AndroidPermissionAdbRunner
}): Promise<AndroidStartupPermissionReport> {
  const { deviceId, applicationId } = input
  if (!NESY_PACKAGE.test(applicationId)) {
    throw new Error(`startup permission bootstrap refuses non-Nesy package "${applicationId}"`)
  }

  const runner = input.runner ?? runAdb
  const before = await runner(deviceId, ['shell', 'dumpsys', 'package', applicationId])
  if (!before.includes(applicationId)) throw new Error(`package "${applicationId}" is not installed on ${deviceId}`)

  const beforeGrants = parseRuntimePermissionGrants(before)
  const alreadyGranted: string[] = []
  const grantedNow: string[] = []
  const skippedNotRuntime: string[] = []

  for (const permission of NESY_LOGIN_STARTUP_PERMISSIONS) {
    if (!packageRequests(before, permission) || !beforeGrants.has(permission)) {
      skippedNotRuntime.push(permission)
      continue
    }
    if (beforeGrants.get(permission) === true) {
      alreadyGranted.push(permission)
      continue
    }
    await runner(deviceId, ['shell', 'pm', 'grant', applicationId, permission])
    grantedNow.push(permission)
  }

  let overlay: AndroidStartupPermissionReport['overlay'] = 'not-requested'
  if (packageRequests(before, OVERLAY_PERMISSION)) {
    const current = await runner(deviceId, ['shell', 'appops', 'get', applicationId, 'SYSTEM_ALERT_WINDOW']).catch(
      () => '',
    )
    if (overlayAllowed(current)) {
      overlay = 'already-granted'
    } else {
      await runner(deviceId, ['shell', 'appops', 'set', applicationId, 'SYSTEM_ALERT_WINDOW', 'allow'])
      overlay = 'granted-now'
    }
  }

  const changed = grantedNow.length > 0 || overlay === 'granted-now'
  if (changed) {
    await runner(deviceId, ['shell', 'am', 'force-stop', applicationId])
    await runner(
      deviceId,
      ['shell', 'monkey', '-p', applicationId, '-c', 'android.intent.category.LAUNCHER', '1'],
      15_000,
    )
  }

  const after = await runner(deviceId, ['shell', 'dumpsys', 'package', applicationId])
  const afterGrants = parseRuntimePermissionGrants(after)
  const missing = NESY_LOGIN_STARTUP_PERMISSIONS.filter(
    (permission) => beforeGrants.has(permission) && afterGrants.get(permission) !== true,
  )
  if (missing.length > 0) {
    throw new Error(`startup permission verification failed: ${missing.join(', ')}`)
  }

  if (packageRequests(before, OVERLAY_PERMISSION)) {
    const verifiedOverlay = await runner(deviceId, [
      'shell',
      'appops',
      'get',
      applicationId,
      'SYSTEM_ALERT_WINDOW',
    ])
    if (!overlayAllowed(verifiedOverlay)) throw new Error('startup overlay permission verification failed')
  }

  return {
    ok: true,
    changed,
    restarted: changed,
    grantedNow,
    alreadyGranted,
    skippedNotRuntime,
    overlay,
  }
}
