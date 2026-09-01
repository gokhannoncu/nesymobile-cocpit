import {
  isCoreCapabilityLayer,
  isDomainCapabilityLayer,
} from '@/lib/verdict-runtime/domain-pack-detail'
import { cn } from '@nesy/metronic/lib/utils'

export const capabilityBadgeBase =
  'inline-flex rounded-[4px] px-1.5 py-px text-[8px] font-bold uppercase tracking-wide leading-none ring-1 ring-inset'

const layerCoreBadge = cn(
  capabilityBadgeBase,
  'bg-indigo-50 text-indigo-700 ring-indigo-200/80',
  'dark:bg-indigo-950/40 dark:text-indigo-300 dark:ring-indigo-800/50',
)

const layerDomainBadge = cn(
  capabilityBadgeBase,
  'bg-violet-50 text-violet-700 ring-violet-200/80',
  'dark:bg-violet-950/40 dark:text-violet-300 dark:ring-violet-800/50',
)

const badgeNeutral = cn(
  capabilityBadgeBase,
  'bg-slate-100 text-slate-600 ring-slate-200/80',
  'dark:bg-muted/40 dark:text-muted-foreground dark:ring-border/80',
)

const providerBridgeBadge = cn(
  capabilityBadgeBase,
  'bg-sky-50 text-sky-700 ring-sky-200/80',
  'dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-800/50',
)

const providerAppBadge = cn(
  capabilityBadgeBase,
  'bg-teal-50 text-teal-700 ring-teal-200/80',
  'dark:bg-teal-950/40 dark:text-teal-300 dark:ring-teal-800/50',
)

const traitRuntimeBadge = cn(
  capabilityBadgeBase,
  'bg-emerald-50 text-emerald-700 ring-emerald-200/80',
  'dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-800/50',
)

const traitAutomationBadge = cn(
  capabilityBadgeBase,
  'bg-amber-50 text-amber-700 ring-amber-200/80',
  'dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-800/50',
)

/** @deprecated Use semantic layer/provider/trait helpers instead. */
export const capabilityBadgePrimary = layerCoreBadge

/** @deprecated Use semantic layer/provider/trait helpers instead. */
export const capabilityBadgeSecondary = layerDomainBadge

/** @deprecated Use semantic layer/provider/trait helpers instead. */
export const capabilityBadgeNeutral = badgeNeutral

export function capabilityLayerBadgeClass(layer: string): string {
  if (isCoreCapabilityLayer(layer)) return layerCoreBadge
  if (isDomainCapabilityLayer(layer)) return layerDomainBadge
  return badgeNeutral
}

export function capabilityProviderBadgeClass(provider: string): string {
  switch (provider) {
    case 'BRIDGE':
      return providerBridgeBadge
    case 'APP_ADAPTER':
      return providerAppBadge
    case 'BACKOFFICE_ADAPTER':
      return badgeNeutral
    default:
      return badgeNeutral
  }
}

export function capabilityTraitBadgeClass(trait: 'runtime' | 'automation'): string {
  switch (trait) {
    case 'runtime':
      return traitRuntimeBadge
    case 'automation':
      return traitAutomationBadge
    default:
      return badgeNeutral
  }
}

export function capabilityLayerLabel(layer: string): string {
  return layer.replace(/^verdict\./, '').replace(/^domain\./, 'domain.')
}

export function capabilityProviderLabel(provider: string): string {
  return provider.replace(/_/g, ' ')
}
