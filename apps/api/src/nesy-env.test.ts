import { afterEach, describe, expect, it } from 'vitest'
import { resolveDashboardBaseUrl } from './nesy-env.js'

const ORIGINAL_ENV = { ...process.env }

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
})

describe('nesy-env', () => {
  it('resolves dashboard base URL from country and environment', () => {
    process.env.NESY_HR_STAGE_DASHBOARD_BASE_URL = 'https://nesy-staging.overseas.hr/'

    expect(resolveDashboardBaseUrl('HR', 'stage')).toBe('https://nesy-staging.overseas.hr')
  })
})
