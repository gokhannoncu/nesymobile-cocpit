import { describe, expect, it } from 'vitest'
import {
  countProfilesByKind,
  testProfileIsBlocked,
  testProfileKindBadgeClass,
  testProfileKindTone,
  testProfileResultBadgeClass,
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
  it('maps kind and result badge classes to semantic palette', () => {
    expect(testProfileKindBadgeClass('CORE')).toContain('bg-indigo-50')
    expect(testProfileKindBadgeClass('PREVIEW')).toContain('bg-teal-50')
    expect(testProfileKindBadgeClass('FAULT')).toContain('bg-amber-50')
    expect(testProfileResultBadgeClass('PASS')).toContain('bg-emerald-50')
    expect(testProfileResultBadgeClass('FAIL')).toContain('bg-rose-50')
    expect(testProfileResultBadgeClass('NOT_RUN', true)).toContain('bg-amber-50')
  })

  it('maps kind and result tones', () => {
    expect(testProfileKindTone('CORE')).toBe('indigo')
    expect(testProfileKindTone('PREVIEW')).toBe('teal')
    expect(testProfileKindTone('SOAK')).toBe('gray')
    expect(testProfileKindTone('FAULT')).toBe('amber')
    expect(testProfileResultTone('PASS')).toBe('green')
    expect(testProfileResultTone('FAIL')).toBe('red')
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
