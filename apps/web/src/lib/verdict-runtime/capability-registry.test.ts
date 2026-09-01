import { describe, expect, it } from 'vitest'
import {
  capabilityLayerBadgeClass,
  capabilityProviderBadgeClass,
  capabilityTraitBadgeClass,
} from './capability-registry'

describe('capability-registry badges', () => {
  it('uses indigo for core layers and sky for bridge provider', () => {
    expect(capabilityLayerBadgeClass('verdict.core.remote')).toContain('bg-indigo-50')
    expect(capabilityProviderBadgeClass('BRIDGE')).toContain('bg-sky-50')
  })

  it('uses violet for domain layers and teal for app adapters', () => {
    expect(capabilityLayerBadgeClass('domain.nesy.adapter')).toContain('bg-violet-50')
    expect(capabilityProviderBadgeClass('APP_ADAPTER')).toContain('bg-teal-50')
  })

  it('uses neutral styling for backoffice adapters', () => {
    expect(capabilityProviderBadgeClass('BACKOFFICE_ADAPTER')).toContain('bg-slate-100')
  })

  it('uses emerald and amber for runtime and automation traits', () => {
    expect(capabilityTraitBadgeClass('runtime')).toContain('bg-emerald-50')
    expect(capabilityTraitBadgeClass('automation')).toContain('bg-amber-50')
  })
})
