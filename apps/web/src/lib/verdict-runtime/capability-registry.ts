import {
  isCoreCapabilityLayer,
  isDomainCapabilityLayer,
} from '@/lib/verdict-runtime/domain-pack-detail'
import { cn } from '@nesy/metronic/lib/utils'

export const capabilityBadgeBase =
  'inline-flex rounded-[4px] border px-1.5 py-px text-[8px] font-bold uppercase tracking-wide leading-none'

/** Filled NESY primary — core platform seams and bridge provider. */
export const capabilityBadgePrimary = cn(
  capabilityBadgeBase,
  'border-nesy/30 bg-nesy-soft text-nesy-ink dark:border-nesy/35 dark:bg-nesy-soft/20 dark:text-nesy',
)

/** Outlined NESY secondary — domain pack seams and app adapters. */
export const capabilityBadgeSecondary = cn(
  capabilityBadgeBase,
  'border-nesy/25 bg-background text-nesy-ink dark:border-nesy/30 dark:bg-card dark:text-nesy',
)

/** Neutral tertiary — backoffice and unknown providers. */
export const capabilityBadgeNeutral = cn(
  capabilityBadgeBase,
  'border-border bg-muted/35 text-muted-foreground',
)

export function capabilityLayerBadgeClass(layer: string): string {
  if (isCoreCapabilityLayer(layer)) return capabilityBadgePrimary
  if (isDomainCapabilityLayer(layer)) return capabilityBadgeSecondary
  return capabilityBadgeNeutral
}

export function capabilityProviderBadgeClass(provider: string): string {
  switch (provider) {
    case 'BRIDGE':
      return capabilityBadgePrimary
    case 'APP_ADAPTER':
      return capabilityBadgeSecondary
    case 'BACKOFFICE_ADAPTER':
      return capabilityBadgeNeutral
    default:
      return capabilityBadgeNeutral
  }
}

export function capabilityTraitBadgeClass(trait: 'runtime' | 'automation'): string {
  switch (trait) {
    case 'runtime':
      return capabilityBadgePrimary
    case 'automation':
      return cn(
        capabilityBadgeBase,
        'border-nesy-muted/70 bg-nesy-muted/25 text-nesy-ink dark:border-nesy/25 dark:bg-nesy-soft/10 dark:text-nesy',
      )
    default:
      return capabilityBadgeNeutral
  }
}

export function capabilityLayerLabel(layer: string): string {
  return layer.replace(/^verdict\./, '').replace(/^domain\./, 'domain.')
}

export function capabilityProviderLabel(provider: string): string {
  return provider.replace(/_/g, ' ')
}
