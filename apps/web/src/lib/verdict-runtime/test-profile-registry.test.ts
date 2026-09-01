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
  it('maps kind and result badge classes to NESY palette', () => {
    expect(testProfileKindBadgeClass('CORE')).toContain('bg-nesy-soft')
    expect(testProfileKindBadgeClass('PREVIEW')).toContain('bg-background')
    expect(testProfileKindBadgeClass('FAULT')).toContain('bg-nesy-muted/25')
    expect(testProfileResultBadgeClass('PASS')).toContain('bg-nesy-soft')
    expect(testProfileResultBadgeClass('FAIL')).toContain('bg-nesy-muted/25')
    expect(testProfileResultBadgeClass('NOT_RUN', true)).toContain('bg-nesy-muted/25')
  })

  it('maps legacy kind and result tones', () => {
    expect(testProfileKindTone('CORE')).toBe('nesy')
    expect(testProfileKindTone('PREVIEW')).toBe('teal')
    expect(testProfileKindTone('SOAK')).toBe('gray')
    expect(testProfileKindTone('FAULT')).toBe('orange')
    expect(testProfileResultTone('PASS')).toBe('teal')
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
