import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  assertFaultInjectionAllowed,
  isFaultInjectionAllowedEnvironment,
  resolveFaultInjectionTarget,
  resolveRemoteActionEnvironment,
} from './fault-injection-environment.js'
import { parseInjectedFaultBody } from './workflow-run.service.js'

const STAGE_URL = 'https://stage.example.test'
const PROD_URL = 'https://prod.example.test'
const LAB_ENV = {
  NESY_REMOTE_ACTION_ENV: 'stage',
  NESY_REMOTE_ACTION_COUNTRY: 'RS',
  NESY_RS_STAGE_BASE_URL: STAGE_URL,
  NESY_RS_PROD_BASE_URL: PROD_URL,
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('fault injection environment', () => {
  it('defaults the label to stage but fails closed without a resolved target', () => {
    expect(resolveRemoteActionEnvironment({})).toBe('stage')
    expect(isFaultInjectionAllowedEnvironment({})).toBe(false)
  })

  it('refuses anything that is not a declared lab environment', () => {
    expect(isFaultInjectionAllowedEnvironment({ ...LAB_ENV, NESY_REMOTE_ACTION_ENV: 'prod' })).toBe(false)
    expect(isFaultInjectionAllowedEnvironment({ NESY_REMOTE_ACTION_ENV: 'production' })).toBe(false)
    expect(isFaultInjectionAllowedEnvironment({ NESY_REMOTE_ACTION_ENV: 'live' })).toBe(false)
    expect(() => assertFaultInjectionAllowed({ ...LAB_ENV, NESY_REMOTE_ACTION_ENV: 'prod' })).toThrow(/not allowed/)
  })

  it('accepts stage only when the resolved URL matches the configured stage origin', () => {
    expect(isFaultInjectionAllowedEnvironment(LAB_ENV)).toBe(true)
    expect(isFaultInjectionAllowedEnvironment({ ...LAB_ENV, NESY_REMOTE_ACTION_ENV: ' staging ' })).toBe(true)
  })

  it('refuses a prod or unknown override even when the declaration says stage', () => {
    expect(
      resolveFaultInjectionTarget({
        ...LAB_ENV,
        NESY_BACKOFFICE_BASE_URL: PROD_URL,
      }),
    ).toMatchObject({ allowed: false, targetOrigin: PROD_URL })
    expect(
      resolveFaultInjectionTarget({
        ...LAB_ENV,
        NESY_BACKOFFICE_BASE_URL: 'https://unknown.example.test',
      }),
    ).toMatchObject({ allowed: false, reason: expect.stringMatching(/does not match/) })
  })

  it('refuses an injected run start against a live environment', () => {
    for (const [key, value] of Object.entries({ ...LAB_ENV, NESY_REMOTE_ACTION_ENV: 'prod' })) {
      vi.stubEnv(key, value)
    }
    expect(() =>
      parseInjectedFaultBody({ injectedFault: 'BACKEND_TIMEOUT', injectedFaultHost: 'B' }),
    ).toThrow(/not allowed/)
  })

  it('refuses an injected run start when stage points at the resolved prod URL', () => {
    for (const [key, value] of Object.entries({
      ...LAB_ENV,
      NESY_BACKOFFICE_BASE_URL: PROD_URL,
    })) {
      vi.stubEnv(key, value)
    }
    expect(() =>
      parseInjectedFaultBody({ injectedFault: 'BACKEND_TIMEOUT', injectedFaultHost: 'B' }),
    ).toThrow(/production origin/)
  })

  it('leaves an uninjected run start alone whatever the environment is', () => {
    vi.stubEnv('NESY_REMOTE_ACTION_ENV', 'prod')
    expect(parseInjectedFaultBody({})).toEqual({ injectedFault: null, injectedFaultHost: null })
  })
})
