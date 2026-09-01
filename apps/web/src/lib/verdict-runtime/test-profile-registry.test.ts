import { describe, expect, it } from 'vitest'
import {
  countProfilesByKind,
  testProfileIsBlocked,
  testProfileKindTone,
  testProfileResultTone,
} from './test-profile-registry'
import type { TestProfileCatalogItemApi } from './types'

function profile(
  overrides: Partial<TestProfileCatalogItemApi> = {},
): TestProfileCatalogItemApi {
  return {
    profileKey: 'smoke.login',
    version: 1,
    kind: 'CORE',
    releaseGate: true,
    packKey: 'nesy.courier',
    packVersion: '1.0.0',
    owner: 'qa',
    lastResult: 'NOT_RUN',
    ...overrides,
  }
}

describe('test-profile-registry helpers', () => {
  it('maps kind and result tones', () => {
    expect(testProfileKindTone('CORE')).toBe('blue')
    expect(testProfileKindTone('FAULT')).toBe('orange')
    expect(testProfileResultTone('PASS')).toBe('teal')
    expect(testProfileResultTone('FAIL')).toBe('orange')
  })

  it('detects blocked profiles', () => {
    expect(testProfileIsBlocked(profile())).toBe(false)
    expect(testProfileIsBlocked(profile({ blockedReason: 'missing device' }))).toBe(true)
  })

  it('counts profiles by kind', () => {
    expect(
      countProfilesByKind([
        profile({ kind: 'CORE' }),
        profile({ kind: 'PREVIEW', profileKey: 'preview.flow' }),
        profile({ kind: 'CORE', profileKey: 'core.regression' }),
      ]),
    ).toEqual({
      CORE: 2,
      PREVIEW: 1,
      SOAK: 0,
      FAULT: 0,
    })
  })
})
