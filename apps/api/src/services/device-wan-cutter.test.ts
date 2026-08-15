import { describe, expect, it } from 'vitest'

import { createAdbDeviceWanCutter } from './device-wan-cutter.js'

describe('device WAN cutter', () => {
  it('cuts wifi and data, then restores both — never airplane', async () => {
    const calls: string[][] = []
    const cutter = createAdbDeviceWanCutter({
      shell: async (args) => {
        calls.push([...args])
        return ''
      },
    })
    await cutter.cut()
    await cutter.restore()
    expect(calls).toEqual([
      ['shell', 'svc', 'wifi', 'disable'],
      ['shell', 'svc', 'data', 'disable'],
      ['shell', 'svc', 'wifi', 'enable'],
      ['shell', 'svc', 'data', 'enable'],
    ])
    expect(calls.flat().join(' ')).not.toMatch(/airplane/)
  })
})
