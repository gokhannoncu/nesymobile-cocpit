import type { Tone } from '@/components/product/tones'
import type {
  ApplicationRegistryItemApi,
  ScreenRegistryItemApi,
  ScreenSurfaceCatalogApi,
  SurfaceRegistryItemApi,
} from '@/lib/verdict-runtime/types'

export function surfaceKindTone(kind: string): Tone {
  switch (kind) {
    case 'DIALOG':
      return 'purple'
    case 'BOTTOM_SHEET':
      return 'teal'
    case 'SYSTEM_OVERLAY':
      return 'orange'
    case 'SCANNER':
      return 'nesy'
    case 'WEBVIEW_OVERLAY':
      return 'indigo'
    case 'POPUP':
      return 'gray'
    default:
      return 'gray'
  }
}

export function surfacePolicyTone(policy: string): Tone {
  switch (policy) {
    case 'HANDLE':
      return 'teal'
    case 'IGNORE':
      return 'gray'
    case 'FAIL':
      return 'red'
    case 'OPERATOR_ATTENTION':
      return 'orange'
    default:
      return 'gray'
  }
}

export function packDetailHref(packKey: string, version: string): string {
  return `/automation/domain-packs/${encodeURIComponent(packKey)}?version=${encodeURIComponent(version)}`
}

export function surfaceRegistryStats(catalog: ScreenSurfaceCatalogApi) {
  const kinds: Record<string, number> = {}
  const policies: Record<string, number> = {}
  let verdictBlocking = 0

  for (const surface of catalog.surfaces) {
    kinds[surface.kind] = (kinds[surface.kind] ?? 0) + 1
    policies[surface.defaultPolicy] = (policies[surface.defaultPolicy] ?? 0) + 1
    if (surface.blocksProductVerdict) verdictBlocking += 1
  }

  return {
    applicationCount: catalog.applications.length,
    screenCount: catalog.screens.length,
    surfaceCount: catalog.surfaces.length,
    verdictBlocking,
    kinds,
    policies,
  }
}

export function filterSurfaces(
  surfaces: readonly SurfaceRegistryItemApi[],
  filters: {
    appKey: string | null
    screenKey: string | null
    kind: string | null
    policy: string | null
    query: string
  },
): SurfaceRegistryItemApi[] {
  const normalizedQuery = filters.query.trim().toLowerCase()

  return surfaces.filter((surface) => {
    if (filters.appKey && surface.applicationRef !== filters.appKey) return false
    if (filters.screenKey) {
      const matchesScreen =
        surface.parentScreenRefs.includes('*') ||
        surface.parentScreenRefs.includes(filters.screenKey)
      if (!matchesScreen) return false
    }
    if (filters.kind && surface.kind !== filters.kind) return false
    if (filters.policy && surface.defaultPolicy !== filters.policy) return false
    if (normalizedQuery) {
      const haystack = [
        surface.surfaceKey,
        surface.displayName,
        surface.handlerMacroRef ?? '',
        ...surface.parentScreenRefs,
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(normalizedQuery)) return false
    }
    return true
  })
}

export function screensForApplication(
  screens: readonly ScreenRegistryItemApi[],
  appKey: string | null,
): ScreenRegistryItemApi[] {
  if (!appKey) return [...screens]
  return screens.filter((screen) => screen.applicationRef === appKey)
}

export function surfacesForScreen(
  surfaces: readonly SurfaceRegistryItemApi[],
  appKey: string | null,
  screenKey: string | null,
): SurfaceRegistryItemApi[] {
  return filterSurfaces(surfaces, {
    appKey,
    screenKey,
    kind: null,
    policy: null,
    query: '',
  })
}

export function formatFactKeys(keys: readonly string[]): string {
  if (keys.length === 0) return '—'
  return keys.join(', ')
}

export function formatParentScreens(refs: readonly string[]): string {
  if (refs.length === 0) return '—'
  if (refs.includes('*')) return 'All screens (*)'
  return refs.join(', ')
}

export function uniqueSurfaceKinds(surfaces: readonly SurfaceRegistryItemApi[]): string[] {
  return [...new Set(surfaces.map((surface) => surface.kind))].sort()
}

export function uniqueSurfacePolicies(surfaces: readonly SurfaceRegistryItemApi[]): string[] {
  return [...new Set(surfaces.map((surface) => surface.defaultPolicy))].sort()
}

export function applicationLabel(
  applications: readonly ApplicationRegistryItemApi[],
  applicationRef: string,
): string {
  const match = applications.find((app) => app.applicationKey === applicationRef)
  return match?.displayName ?? applicationRef
}
