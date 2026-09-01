import { describe, expect, it } from 'vitest'

import {
  defaultRuntimeLaunchTarget,
  extractLaunchAppTarget,
  formatLaunchAppTargetLabel,
  resolveRunTarget,
} from './launch-app-target.js'

describe('launch app target', () => {
  it('reads country and environment from canvas data.config', () => {
    expect(
      extractLaunchAppTarget([
        {
          type: 'LAUNCH_APP',
          data: { config: { country: 'RS', environment: 'stage' } },
        },
      ]),
    ).toEqual({ country: 'RS', environment: 'STAGE' })
  })

  it('reads seeded catalog nodes that store config at the top level', () => {
    expect(
      extractLaunchAppTarget([{ type: 'LAUNCH_APP', config: { country: 'hr', environment: 'prod' } }]),
    ).toEqual({ country: 'HR', environment: 'PROD' })
  })

  it('splits a legacy combined value such as RS_STAGE', () => {
    expect(
      extractLaunchAppTarget([{ type: 'launch-app', config: { environment: 'RS_STAGE' } }]),
    ).toEqual({ country: 'RS', environment: 'STAGE' })
  })

  it('prefers the persisted run target over the workflow fallback', () => {
    expect(
      resolveRunTarget(
        { country: 'BA', environment: 'prod' },
        { country: 'RS', environment: 'stage' },
      ),
    ).toEqual({ country: 'BA', environment: 'prod' })
  })

  it('uses the runtime remote-action target when a run did not pin one', () => {
    expect(defaultRuntimeLaunchTarget()).toEqual({ country: 'RS', environment: 'STAGE' })
  })

  it('formats the cockpit chip as RS-STAGE', () => {
    expect(formatLaunchAppTargetLabel({ country: 'RS', environment: 'stage' })).toBe('RS-STAGE')
    expect(formatLaunchAppTargetLabel({ country: null, environment: null })).toBeNull()
  })
})
