import { afterEach, describe, expect, it } from 'vitest'

import {
  assertFaultInjectionAllowed,
  isFaultInjectionAllowedEnvironment,
  resolveRemoteActionEnvironment,
} from './fault-injection-environment.js'
import { parseInjectedFaultBody } from './workflow-run.service.js'

const previous = process.env.NESY_REMOTE_ACTION_ENV

afterEach(() => {
  if (previous === undefined) delete process.env.NESY_REMOTE_ACTION_ENV
  else process.env.NESY_REMOTE_ACTION_ENV = previous
})

describe('fault injection environment', () => {
  it('defaults to the lab environment the adapter also defaults to', () => {
    expect(resolveRemoteActionEnvironment({})).toBe('stage')
    expect(isFaultInjectionAllowedEnvironment({})).toBe(true)
  })

  it('refuses anything that is not a declared lab environment', () => {
    expect(isFaultInjectionAllowedEnvironment({ NESY_REMOTE_ACTION_ENV: 'prod' })).toBe(false)
    expect(isFaultInjectionAllowedEnvironment({ NESY_REMOTE_ACTION_ENV: 'production' })).toBe(false)
    expect(isFaultInjectionAllowedEnvironment({ NESY_REMOTE_ACTION_ENV: 'live' })).toBe(false)
    expect(() => assertFaultInjectionAllowed({ NESY_REMOTE_ACTION_ENV: 'prod' })).toThrow(/not allowed/)
  })

  it('accepts the lab environments case-insensitively', () => {
    expect(isFaultInjectionAllowedEnvironment({ NESY_REMOTE_ACTION_ENV: 'QA' })).toBe(true)
    expect(isFaultInjectionAllowedEnvironment({ NESY_REMOTE_ACTION_ENV: ' staging ' })).toBe(true)
  })

  it('refuses an injected run start against a live environment', () => {
    process.env.NESY_REMOTE_ACTION_ENV = 'prod'
    expect(() =>
      parseInjectedFaultBody({ injectedFault: 'BACKEND_TIMEOUT', injectedFaultHost: 'B' }),
    ).toThrow(/not allowed/)
  })

  it('leaves an uninjected run start alone whatever the environment is', () => {
    process.env.NESY_REMOTE_ACTION_ENV = 'prod'
    expect(parseInjectedFaultBody({})).toEqual({ injectedFault: null, injectedFaultHost: null })
  })
})
