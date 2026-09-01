import { describe, expect, it } from 'vitest'
import {
  capabilityLayerBadgeClass,
  capabilityProviderBadgeClass,
} from './capability-registry'

describe('capability-registry badges', () => {
  it('uses NESY primary for core layers and bridge provider', () => {
    expect(capabilityLayerBadgeClass('verdict.core.remote')).toContain('bg-nesy-soft')
    expect(capabilityProviderBadgeClass('BRIDGE')).toContain('bg-nesy-soft')
  })

  it('uses NESY secondary outline for domain layers and app adapters', () => {
    expect(capabilityLayerBadgeClass('domain.nesy.adapter')).toContain('bg-background')
    expect(capabilityLayerBadgeClass('domain.nesy.adapter')).toContain('text-nesy-ink')
    expect(capabilityProviderBadgeClass('APP_ADAPTER')).toContain('bg-background')
  })

  it('uses neutral styling for backoffice adapters', () => {
    expect(capabilityProviderBadgeClass('BACKOFFICE_ADAPTER')).toContain('bg-muted/35')
  })
})
