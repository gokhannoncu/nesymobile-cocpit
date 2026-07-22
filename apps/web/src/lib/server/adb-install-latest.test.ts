import { describe, expect, it } from 'vitest'
import {
  InstallLatestError,
  parseInstallLatestInput,
} from './adb-install-latest-input'
import {
  resolveInstallEnvironment,
  resolveNesyMobileAppName,
  resolveNesyMobileBaseUrl,
} from '../../services/nesy-mobile-env'

describe('resolveInstallEnvironment / AppName map', () => {
  it('maps UI test to stage and prod to prod', () => {
    expect(resolveInstallEnvironment('test')).toBe('stage')
    expect(resolveInstallEnvironment('prod')).toBe('prod')
  })

  it('resolves flavor AppNames from Courier.Mobile build.gradle', () => {
    expect(resolveNesyMobileAppName('HR', 'stage')).toBe('test-Nesy-Mobile-Test')
    expect(resolveNesyMobileAppName('HR', 'prod')).toBe('Nesy-Mobile-Prod')
    expect(resolveNesyMobileAppName('RS', 'prod')).toBe('Nesy-Mobile-Prod-RS')
    expect(resolveNesyMobileAppName('SI', 'prod')).toBe('Nesy-Mobile-Prod-SI')
    expect(resolveNesyMobileAppName('BA', 'prod')).toBe('Nesy-Mobile-Prod-BA')
    expect(resolveNesyMobileAppName('ME', 'prod')).toBe('Nesy-Mobile-Prod-ME')
  })

  it('points GetLatestVersion at country mobile hosts', () => {
    expect(resolveNesyMobileBaseUrl('HR', 'stage')).toBe(
      'https://nesy-staging-mobile-api.overseas.hr',
    )
    expect(resolveNesyMobileBaseUrl('RS', 'prod')).toBe(
      'https://nesy-mobile-api.cityexpress.rs',
    )
  })
})

describe('parseInstallLatestInput', () => {
  it('accepts country + test|prod', () => {
    expect(parseInstallLatestInput({ country: 'hr', environment: 'test' })).toEqual({
      country: 'HR',
      environment: 'test',
    })
    expect(parseInstallLatestInput({ country: 'ME', environment: 'prod' })).toEqual({
      country: 'ME',
      environment: 'prod',
    })
  })

  it('rejects invalid country or environment', () => {
    expect(() => parseInstallLatestInput({ country: 'SK', environment: 'prod' })).toThrow(
      InstallLatestError,
    )
    expect(() => parseInstallLatestInput({ country: 'HR', environment: 'stage' })).toThrow(
      InstallLatestError,
    )
  })
})
