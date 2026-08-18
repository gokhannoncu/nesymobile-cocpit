import { afterEach, describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { AUTH_FREEZE_CODE, loginDashboardDecision } from './g90-10-admin-auth-freeze.mjs'

describe('admin auth freeze', () => {
  afterEach(() => {
    delete process.env.VERDICT_ADMIN_AUTH_GO
    delete process.env.VERDICT_ADMIN_AUTH_GO_REASON
  })

  it('refuses login on empty cache after resultCode=400', () => {
    const decision = loginDashboardDecision({ present: false, loginDashboardCalls: 0 })
    assert.equal(decision.allowed, false)
    assert.equal(decision.code, AUTH_FREEZE_CODE)
  })

  it('does not treat GO=1 without an external reason as a captcha-clear', () => {
    process.env.VERDICT_ADMIN_AUTH_GO = '1'
    process.env.VERDICT_ADMIN_AUTH_GO_REASON = '   '
    const decision = loginDashboardDecision({ present: false, loginDashboardCalls: 0 })
    assert.equal(decision.allowed, false)
    assert.equal(decision.code, AUTH_FREEZE_CODE)
  })

  it('allows the one shot only when GO and reason are both set and calls=0', () => {
    process.env.VERDICT_ADMIN_AUTH_GO = '1'
    process.env.VERDICT_ADMIN_AUTH_GO_REASON = 'manual dashboard login confirmed 200'
    const decision = loginDashboardDecision({ present: false, loginDashboardCalls: 0 })
    assert.equal(decision.allowed, true)
    assert.equal(decision.code, 'ADMIN_AUTH_GO')
  })

  it('refuses a second login after resultCode=400 unless GO is armed', () => {
    const decision = loginDashboardDecision({
      present: false,
      loginDashboardCalls: 1,
      lastResultCode: 400,
      nextLoginRequiresCaptcha: true,
    })
    assert.equal(decision.allowed, false)
    assert.equal(decision.code, AUTH_FREEZE_CODE)
  })

  it('allows the same PID to retry after 400 when GO and reason are set', () => {
    process.env.VERDICT_ADMIN_AUTH_GO = '1'
    process.env.VERDICT_ADMIN_AUTH_GO_REASON = 'manual dashboard login confirmed 200'
    const decision = loginDashboardDecision({
      present: false,
      loginDashboardCalls: 1,
      lastResultCode: 400,
      nextLoginRequiresCaptcha: true,
    })
    assert.equal(decision.allowed, true)
    assert.equal(decision.code, 'ADMIN_AUTH_GO')
  })

  it('allows one same-PID refresh after a 200 JWT expires, without GO', () => {
    const decision = loginDashboardDecision({
      present: false,
      loginDashboardCalls: 1,
      lastResultCode: 200,
      jwtExpired: true,
      cacheExpired: true,
    })
    assert.equal(decision.allowed, true)
    assert.equal(decision.code, 'JWT_EXPIRED_REFRESH')
  })

  it('does not login when the cache already holds a token', () => {
    process.env.VERDICT_ADMIN_AUTH_GO = '1'
    process.env.VERDICT_ADMIN_AUTH_GO_REASON = 'manual dashboard login confirmed 200'
    const decision = loginDashboardDecision({ present: true, loginDashboardCalls: 1 })
    assert.equal(decision.allowed, false)
    assert.equal(decision.code, 'CACHE_PRESENT')
  })
})
