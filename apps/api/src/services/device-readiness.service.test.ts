import { describe, expect, it } from 'vitest'

import { DeviceReadinessService } from './device-readiness.service.js'
import type { DeviceCommandAdmission } from './device-command-admission.js'

const admission = {
  snapshot: async () => ({
    activeMutationOwnerRunId: null,
    blockedReason: null,
    activeCounts: {},
    queuedCounts: {},
  }),
} as DeviceCommandAdmission

describe('DeviceReadinessService', () => {
  it('preserves structured Act Mode blockers in the readiness lanes', async () => {
    const service = new DeviceReadinessService(admission, {
      adb: async () => 'UP',
      bridge: async () => 'UP',
      actModePolicy: async () => ({
        lane: 'ACT_MODE_POLICY',
        status: 'BLOCKED',
        detail: 'device-1 is not on the lab allowlist',
        remediation: 'add device-1 to VERDICT_BRIDGE_LAB_DEVICES',
      }),
    })

    const snapshot = await service.get('device-1')

    expect(snapshot.overall).toBe('BLOCKED')
    expect(snapshot.lanes).toContainEqual(
      expect.objectContaining({
        lane: 'ACT_MODE_POLICY',
        status: 'BLOCKED',
        detail: 'device-1 is not on the lab allowlist',
        remediation: 'add device-1 to VERDICT_BRIDGE_LAB_DEVICES',
      }),
    )
  })
})
