import { beforeEach, describe, expect, it, vi } from 'vitest'

const db = vi.hoisted(() => ({
  execute: vi.fn(),
  query: vi.fn(),
}))

vi.mock('@nesy/db', () => ({
  prisma: {
    $executeRaw: db.execute,
    $queryRaw: db.query,
  },
}))

import { claimVerdictStreamOwner, verdictStreamOwnedBy } from './verdict-stream-owner.js'

describe('Verdict stream ownership', () => {
  beforeEach(() => {
    db.execute.mockReset()
    db.query.mockReset()
    db.execute.mockResolvedValue(1)
  })

  it('keeps an idempotent device and app claim', async () => {
    db.query.mockResolvedValue([{ device_id: 'device-1', app_id: 'app-1' }])

    await expect(
      claimVerdictStreamOwner({ runId: 'run-1', deviceId: 'device-1', appId: 'app-1' }),
    ).resolves.toBe(true)
  })

  it('rejects a conflicting application on the same device', async () => {
    db.query.mockResolvedValue([{ device_id: 'device-1', app_id: 'app-original' }])

    await expect(
      claimVerdictStreamOwner({ runId: 'run-1', deviceId: 'device-1', appId: 'app-other' }),
    ).resolves.toBe(false)
  })

  it('pins a legacy run only after its durable device matches', async () => {
    db.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ device_id: 'device-1' }])
      .mockResolvedValueOnce([{ device_id: 'device-1', app_id: 'app-1' }])

    await expect(
      verdictStreamOwnedBy('legacy-run', { deviceId: 'device-1', appId: 'app-1' }),
    ).resolves.toBe(true)
    expect(db.execute).toHaveBeenCalledTimes(1)
  })

  it('does not claim a legacy run owned by another device', async () => {
    db.query
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ device_id: 'device-other' }])

    await expect(
      verdictStreamOwnedBy('legacy-run', { deviceId: 'device-1', appId: 'app-1' }),
    ).resolves.toBe(false)
    expect(db.execute).not.toHaveBeenCalled()
  })
})
