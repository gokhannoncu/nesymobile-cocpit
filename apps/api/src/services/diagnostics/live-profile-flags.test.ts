import { afterEach, describe, expect, it } from 'vitest'

import { batchPersistenceEnabled, liveProfilingEnabled } from './live-profile-flags.js'

const original = {
  profile: process.env.NESY_LIVE_PROFILE,
  batch: process.env.NESY_PERSISTENCE_BATCH,
}

afterEach(() => {
  for (const [key, value] of [
    ['NESY_LIVE_PROFILE', original.profile],
    ['NESY_PERSISTENCE_BATCH', original.batch],
  ] as const) {
    if (value === undefined) delete process.env[key]
    else process.env[key] = value
  }
})

describe('liveProfilingEnabled', () => {
  it('stays off unless a measurement run explicitly asks for it', () => {
    delete process.env.NESY_LIVE_PROFILE
    expect(liveProfilingEnabled()).toBe(false)
    process.env.NESY_LIVE_PROFILE = ''
    expect(liveProfilingEnabled()).toBe(false)
    process.env.NESY_LIVE_PROFILE = '0'
    expect(liveProfilingEnabled()).toBe(false)
  })

  it('accepts the two spellings the campaign scripts use', () => {
    process.env.NESY_LIVE_PROFILE = '1'
    expect(liveProfilingEnabled()).toBe(true)
    process.env.NESY_LIVE_PROFILE = 'true'
    expect(liveProfilingEnabled()).toBe(true)
  })
})

describe('batchPersistenceEnabled', () => {
  it('defaults to the shipped batch path', () => {
    delete process.env.NESY_PERSISTENCE_BATCH
    expect(batchPersistenceEnabled()).toBe(true)
  })

  it('turns off for the serial A/B arms and for rollback', () => {
    process.env.NESY_PERSISTENCE_BATCH = '0'
    expect(batchPersistenceEnabled()).toBe(false)
    process.env.NESY_PERSISTENCE_BATCH = 'false'
    expect(batchPersistenceEnabled()).toBe(false)
  })
})
