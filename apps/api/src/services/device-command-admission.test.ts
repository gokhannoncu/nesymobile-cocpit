import { describe, expect, it } from 'vitest'
import {
  createDeviceCommandAdmission,
  DeviceCommandAdmission,
  InMemoryDeviceMutationLeaseStore,
} from './device-command-admission.js'

describe('device command admission', () => {
  it('gives exclusive mutation ownership and blocks a second run with a reason', async () => {
    const admission = createDeviceCommandAdmission()
    expect(await admission.acquireMutation('device-1', 'run-a')).toEqual({
      acquired: true,
      ownerRunId: 'run-a',
      blockedReason: null,
    })
    expect(await admission.acquireMutation('device-1', 'run-b')).toEqual({
      acquired: false,
      ownerRunId: 'run-a',
      blockedReason: 'mutation lane owned by run run-a',
    })
    expect(await admission.snapshot('device-1')).toMatchObject({
      activeMutationOwnerRunId: 'run-a',
      activeCounts: expect.objectContaining({ MUTATION: 1 }),
      blockedReason: 'mutation lane owned by run run-a',
    })
  })

  it('releases mutation ownership so another run can acquire', async () => {
    const admission = createDeviceCommandAdmission()
    await admission.acquireMutation('device-1', 'run-a')
    await admission.releaseMutation('device-1', 'run-a')
    expect((await admission.acquireMutation('device-1', 'run-b')).acquired).toBe(true)
    expect((await admission.snapshot('device-1')).blockedReason).toBe(
      'mutation lane owned by run run-b',
    )
  })

  it('keeps re-acquire by the same run idempotent so one release clears the lane', async () => {
    const admission = createDeviceCommandAdmission()
    await admission.acquireMutation('device-1', 'run-a')
    expect(await admission.acquireMutation('device-1', 'run-a')).toEqual({
      acquired: true,
      ownerRunId: 'run-a',
      blockedReason: null,
    })
    expect((await admission.snapshot('device-1')).activeCounts.MUTATION).toBe(1)
    await admission.releaseMutation('device-1', 'run-a')
    expect(await admission.snapshot('device-1')).toMatchObject({
      activeMutationOwnerRunId: null,
      blockedReason: null,
      activeCounts: expect.objectContaining({ MUTATION: 0 }),
    })
  })

  it('tracks observation/wait/control counts separately from mutation ownership', async () => {
    const admission = createDeviceCommandAdmission()
    admission.beginLane('device-1', 'OBSERVATION')
    admission.enqueue('device-1', 'WAIT')
    admission.beginLane('device-1', 'CONTROL')
    expect(await admission.snapshot('device-1')).toMatchObject({
      activeCounts: { CONTROL: 1, OBSERVATION: 1, WAIT: 0, MUTATION: 0 },
      queuedCounts: { CONTROL: 0, OBSERVATION: 0, WAIT: 1, MUTATION: 0 },
      activeMutationOwnerRunId: null,
      blockedReason: null,
    })
  })

  it('expires a stale lease so a second run can acquire after TTL', async () => {
    let nowMs = 1_000
    const store = new InMemoryDeviceMutationLeaseStore()
    const timed = new DeviceCommandAdmission(store, 100, () => nowMs)
    expect((await timed.acquireMutation('device-1', 'run-a')).acquired).toBe(true)
    nowMs = 1_200
    expect((await timed.acquireMutation('device-1', 'run-b')).acquired).toBe(true)
  })
})
