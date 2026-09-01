import { describe, expect, it } from 'vitest'
import {
  ensureNesyLoginStartupPermissions,
  NESY_LOGIN_STARTUP_PERMISSIONS,
  parseRuntimePermissionGrants,
  type AndroidPermissionAdbRunner,
} from './android-startup-permissions.js'

const APP_ID = 'com.arasdigital.nesymobile.rstest'

function packageDump(granted: ReadonlySet<string>): string {
  return `
Package [${APP_ID}]
    requested permissions:
${NESY_LOGIN_STARTUP_PERMISSIONS.map((permission) => `      ${permission}`).join('\n')}
      android.permission.SYSTEM_ALERT_WINDOW
    runtime permissions:
${NESY_LOGIN_STARTUP_PERMISSIONS.map(
  (permission) => `        ${permission}: granted=${String(granted.has(permission))}, flags=[]`,
).join('\n')}
    enabledComponents:
`
}

function statefulRunner(initiallyGranted: readonly string[] = [], overlayInitiallyAllowed = false) {
  const granted = new Set(initiallyGranted)
  let overlayAllowed = overlayInitiallyAllowed
  const calls: readonly string[][] = []
  const mutableCalls = calls as string[][]

  const runner: AndroidPermissionAdbRunner = async (_deviceId, args) => {
    mutableCalls.push([...args])
    if (args[1] === 'dumpsys') return packageDump(granted)
    if (args[1] === 'pm' && args[2] === 'grant') {
      granted.add(String(args[4]))
      return ''
    }
    if (args[1] === 'appops' && args[2] === 'get') {
      return `SYSTEM_ALERT_WINDOW: ${overlayAllowed ? 'allow' : 'ignore'}`
    }
    if (args[1] === 'appops' && args[2] === 'set') {
      overlayAllowed = true
      return ''
    }
    if (args[1] === 'am' && args[2] === 'force-stop') return ''
    if (args[1] === 'monkey') return 'Events injected: 1'
    throw new Error(`unexpected adb call: ${args.join(' ')}`)
  }

  return { runner, calls }
}

describe('Nesy post-launch startup permission bootstrap', () => {
  it('parses runtime permission state without treating requested permissions as grants', () => {
    const grants = parseRuntimePermissionGrants(
      packageDump(new Set(['android.permission.CAMERA', 'android.permission.POST_NOTIFICATIONS'])),
    )

    expect(grants.get('android.permission.CAMERA')).toBe(true)
    expect(grants.get('android.permission.CALL_PHONE')).toBe(false)
  })

  it('grants missing permissions one by one, grants overlay, then restarts once', async () => {
    const { runner, calls } = statefulRunner()
    const report = await ensureNesyLoginStartupPermissions({
      deviceId: 'device-1',
      applicationId: APP_ID,
      runner,
    })

    expect(report).toMatchObject({
      ok: true,
      changed: true,
      restarted: true,
      grantedNow: [...NESY_LOGIN_STARTUP_PERMISSIONS],
      overlay: 'granted-now',
    })
    expect(calls.filter((args) => args[1] === 'pm' && args[2] === 'grant').map((args) => args[4])).toEqual([
      ...NESY_LOGIN_STARTUP_PERMISSIONS,
    ])
    expect(calls.filter((args) => args[1] === 'am' && args[2] === 'force-stop')).toHaveLength(1)
    expect(calls.filter((args) => args[1] === 'monkey')).toHaveLength(1)
  })

  it('is idempotent when startup permissions are already granted', async () => {
    const { runner, calls } = statefulRunner([...NESY_LOGIN_STARTUP_PERMISSIONS], true)
    const report = await ensureNesyLoginStartupPermissions({
      deviceId: 'device-1',
      applicationId: APP_ID,
      runner,
    })

    expect(report.changed).toBe(false)
    expect(report.restarted).toBe(false)
    expect(report.alreadyGranted).toEqual([...NESY_LOGIN_STARTUP_PERMISSIONS])
    expect(calls.some((args) => args[1] === 'pm' || args[1] === 'am' || args[1] === 'monkey')).toBe(false)
  })

  it('refuses to grant permissions to an unrelated package', async () => {
    const { runner } = statefulRunner()
    await expect(
      ensureNesyLoginStartupPermissions({
        deviceId: 'device-1',
        applicationId: 'com.example.other',
        runner,
      }),
    ).rejects.toThrow(/refuses non-Nesy package/)
  })
})
