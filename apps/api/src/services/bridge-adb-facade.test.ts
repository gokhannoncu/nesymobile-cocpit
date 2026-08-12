/**
 * The accessibility restore sequence is several separate `adb` calls with no
 * transaction around them, and it runs against a REAL phone. What matters is not
 * only that it ends in the right state but that every point it can be interrupted
 * at leaves the device usable — a harness that turns off accessibility and dies
 * has done something worse than fail a test.
 */
import { describe, expect, it } from 'vitest'

import { createAdbFacade } from './bridge-adb-facade.js'

const COMPONENT = 'com.verdict.bridge/com.verdict.bridge.BridgeAccessibilityService'

function recordingFacade() {
  const calls: string[][] = []
  const facade = createAdbFacade(async (args) => {
    calls.push(args)
    return ''
  })
  return { facade, calls }
}

/** `settings put secure <key> <value>` / `settings delete secure <key>` as a readable string. */
function settingsOps(calls: string[][]): string[] {
  return calls
    .filter((args) => args.includes('settings'))
    .map((args) => args.slice(args.indexOf('settings')).join(' '))
}

describe('adb facade accessibility restore', () => {
  it('never disables the device-wide accessibility switch', async () => {
    const { facade, calls } = recordingFacade()
    await facade.restoreAccessibilityService('device-1', COMPONENT)

    // The regression this pins: the sequence used to open with
    // `accessibility_enabled 0`. An API restart between that call and the closing
    // `1` left the phone with accessibility globally off and the bridge service
    // still listed — observed on a real device, and visible to its owner only as
    // "the bridge suddenly stopped working".
    expect(settingsOps(calls)).not.toContain('settings put secure accessibility_enabled 0')
  })

  it('transitions the service list before enabling, so the service actually rebinds', async () => {
    const { facade, calls } = recordingFacade()
    await facade.restoreAccessibilityService('device-1', COMPONENT)

    // Writing the master switch alone does not rebind: AccessibilityManagerService
    // only re-binds on a service-list transition, so the delete/put pair has to
    // happen and it has to happen BEFORE the switch is turned on.
    expect(settingsOps(calls)).toEqual([
      'settings delete secure enabled_accessibility_services',
      `settings put secure enabled_accessibility_services ${COMPONENT}`,
      'settings put secure accessibility_enabled 1',
    ])
  })
})
