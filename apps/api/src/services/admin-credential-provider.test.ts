import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { resolveCachedStageAdminCredentials, TARGET_NOT_STAGE } from './admin-credential-provider.js'
import {
  ADMIN_AUTH_NOT_READY,
  getLoginDashboardCallCount,
  rememberDashboardAdminToken,
  resetDashboardAdminTokenStateForTests,
} from './nesy-admin-token.js'

const STAGE_URL = 'https://stage.example.test'
const PROD_URL = 'https://prod.example.test'
const LAB_ENV = {
  NESY_REMOTE_ACTION_ENV: 'stage',
  NESY_REMOTE_ACTION_COUNTRY: 'RS',
  NESY_RS_STAGE_BASE_URL: STAGE_URL,
  NESY_RS_PROD_BASE_URL: PROD_URL,
} as NodeJS.ProcessEnv

describe('resolveCachedStageAdminCredentials', () => {
  beforeEach(() => {
    resetDashboardAdminTokenStateForTests()
  })

  afterEach(() => {
    resetDashboardAdminTokenStateForTests()
  })

  it('refuses prod even when a stage cache exists', () => {
    rememberDashboardAdminToken('RS', 'stage', 'admin-bearer-secret')
    const decision = resolveCachedStageAdminCredentials('RS', 'prod', LAB_ENV)
    expect(decision).toMatchObject({ ok: false, code: TARGET_NOT_STAGE })
    expect(getLoginDashboardCallCount()).toBe(0)
  })

  it('refuses a stage label whose resolved origin is production', () => {
    rememberDashboardAdminToken('RS', 'stage', 'admin-bearer-secret')
    const decision = resolveCachedStageAdminCredentials('RS', 'stage', {
      ...LAB_ENV,
      NESY_BACKOFFICE_BASE_URL: PROD_URL,
    })
    expect(decision).toMatchObject({ ok: false, code: TARGET_NOT_STAGE })
  })

  it('refuses an empty cache without calling LoginDashboard', () => {
    const decision = resolveCachedStageAdminCredentials('RS', 'stage', LAB_ENV)
    expect(decision).toMatchObject({ ok: false, code: ADMIN_AUTH_NOT_READY })
    expect(getLoginDashboardCallCount()).toBe(0)
  })

  it('returns the cached bearer only in-process', () => {
    rememberDashboardAdminToken('RS', 'stage', 'admin-bearer-secret')
    const decision = resolveCachedStageAdminCredentials('RS', 'stage', LAB_ENV)
    expect(decision.ok).toBe(true)
    if (!decision.ok) return
    expect(decision.token).toBe('admin-bearer-secret')
    expect(decision.environment).toBe('stage')
    expect(decision.cache.credentialSource).toBe('dashboard-admin-cache')
    expect(decision.cache).not.toHaveProperty('token')
    expect(getLoginDashboardCallCount()).toBe(0)
  })
})
