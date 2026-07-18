import { describe, expect, it } from 'vitest'
import { SCENARIO_PACKAGES } from '../../data/engineering/device-lab/adb-scenarios'

/** Keep in sync with apps/web/src/lib/server/adb-scenario-executor.ts SCENARIOS keys. */
const EXECUTABLE_IDS = [
  'scn-mid-delivery-offline',
  'scn-force-offline-flag',
  'scn-restore-network',
  'scn-airplane-mode',
  'scn-network-flap',
  'scn-clear-token',
  'scn-corrupt-token',
  'scn-expire-token-foreground',
  'scn-schedule-yesterday',
  'scn-schedule-tomorrow',
  'scn-clear-schedule',
  'scn-restart-shipment',
  'scn-alt-api-endpoint',
  'scn-force-stop-mid-tour',
  'scn-pm-clear-cold',
  'scn-revoke-location',
  'scn-revoke-camera',
  'scn-dump-courier-state',
  'scn-get-protected-key',
  'scn-capture-bugreport',
] as const

describe('adb scenario catalog', () => {
  it('defines exactly 20 hard-situation scenarios', () => {
    expect(SCENARIO_PACKAGES).toHaveLength(20)
    expect(EXECUTABLE_IDS).toHaveLength(20)
  })

  it('catalog ids match the allowlisted executor set', () => {
    const catalogIds = SCENARIO_PACKAGES.map((s) => s.id).sort()
    expect(catalogIds).toEqual([...EXECUTABLE_IDS].sort())
  })

  it('uses real arasdigital package names', () => {
    for (const scenario of SCENARIO_PACKAGES) {
      expect(scenario.supportedPackages.every((p) => p.includes('arasdigital.nesymobile'))).toBe(true)
    }
  })
})
