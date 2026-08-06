import { describe, expect, it } from 'vitest'
import { createDeviceCommandAdmission } from './device-command-admission.js'

describe('device command admission', () => {
  it('gives exclusive mutation ownership and blocks a second run with a reason', () => {
    const admission = createDeviceCommandAdmission()
    expect(admission.acquireMutation('device-1', 'run-a')).toEqual({
      acquired: true,
      ownerRunId: 'run-a',
      blockedReason: null,
    })
    expect(admission.acquireMutation('device-1', 'run-b')).toEqual({
      acquired: false,
      ownerRunId: 'run-a',
      blockedReason: 'mutation lane owned by run run-a',
    })
    expect(admission.snapshot('device-1')).toMatchObject({
      activeMutationOwnerRunId: 'run-a',
      activeCounts: expect.objectContaining({ MUTATION: 1 }),
      blockedReason: 'mutation lane owned by run run-a',
    })
  })

  it('releases mutation ownership so another run can acquire', () => {
    const admission = createDeviceCommandAdmission()
    admission.acquireMutation('device-1', 'run-a')
    admission.releaseMutation('device-1', 'run-a')
    expect(admission.acquireMutation('device-1', 'run-b').acquired).toBe(true)
    expect(admission.snapshot('device-1').blockedReason).toBe(
      'mutation lane owned by run run-b',
    )
  })

  it('keeps re-acquire by the same run idempotent so one release clears the lane', () => {
    const admission = createDeviceCommandAdmission()
    admission.acquireMutation('device-1', 'run-a')
    expect(admission.acquireMutation('device-1', 'run-a')).toEqual({
      acquired: true,
      ownerRunId: 'run-a',
      blockedReason: null,
    })
    expect(admission.snapshot('device-1').activeCounts.MUTATION).toBe(1)
    admission.releaseMutation('device-1', 'run-a')
    expect(admission.snapshot('device-1')).toMatchObject({
      activeMutationOwnerRunId: null,
      blockedReason: null,
      activeCounts: expect.objectContaining({ MUTATION: 0 }),
    })
  })

  it('tracks observation/wait/control counts separately from mutation ownership', () => {
    const admission = createDeviceCommandAdmission()
    admission.beginLane('device-1', 'OBSERVATION')
    admission.enqueue('device-1', 'WAIT')
    admission.beginLane('device-1', 'CONTROL')
    expect(admission.snapshot('device-1')).toMatchObject({
      activeCounts: { CONTROL: 1, OBSERVATION: 1, WAIT: 0, MUTATION: 0 },
      queuedCounts: { CONTROL: 0, OBSERVATION: 0, WAIT: 1, MUTATION: 0 },
      activeMutationOwnerRunId: null,
      blockedReason: null,
    })
  })
})
