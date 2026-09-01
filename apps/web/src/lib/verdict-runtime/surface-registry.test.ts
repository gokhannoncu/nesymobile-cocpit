import { describe, expect, it } from 'vitest'
import { filterSurfaces, surfaceRegistryStats } from './surface-registry'
import type { ScreenSurfaceCatalogApi } from '@/lib/verdict-runtime/types'

const catalog: ScreenSurfaceCatalogApi = {
  apiVersion: 'verdict-runtime.v1',
  packKey: 'nesy.courier',
  packVersion: '1.40.0',
  publicationState: 'PUBLISHED',
  revision: 1,
  bundleDigest: 'sha256:test',
  partial: false,
  applications: [
    { applicationKey: 'nesy.courier.mobile', displayName: 'Nesy Courier Mobile', platform: 'ANDROID' },
  ],
  screens: [
    {
      screenKey: 'nesy.route.stop-list',
      applicationRef: 'nesy.courier.mobile',
      displayName: 'Route stop list',
      readiness: {
        requiredFactKeys: ['UI.ROUTE_LIST_READY'],
        anyOfFactKeys: [],
        noneOfFactKeys: [],
        deadlineMs: 25000,
        stableForMs: 250,
      },
      supportedSurfaceRefs: ['nesy.route.selection-dialog'],
    },
  ],
  surfaces: [
    {
      surfaceKey: 'nesy.route.selection-dialog',
      applicationRef: 'nesy.courier.mobile',
      kind: 'DIALOG',
      displayName: 'Route selection dialog',
      parentScreenRefs: ['nesy.route.stop-list'],
      detection: {
        requiredFactKeys: ['UI.ROUTE_DIALOG_READY'],
        anyOfFactKeys: [],
        noneOfFactKeys: [],
        deadlineMs: 15000,
        stableForMs: 200,
      },
      defaultPolicy: 'HANDLE',
      priority: 40,
      handlerMacroRef: 'nesy.macro.select-route',
      blocksProductVerdict: false,
    },
    {
      surfaceKey: 'nesy.scanner.surface',
      applicationRef: 'nesy.courier.mobile',
      kind: 'SCANNER',
      displayName: 'Scanner overlay',
      parentScreenRefs: ['*'],
      detection: {
        requiredFactKeys: ['UI.SCANNER_READY'],
        anyOfFactKeys: [],
        noneOfFactKeys: [],
        deadlineMs: 10000,
        stableForMs: null,
      },
      defaultPolicy: 'HANDLE',
      priority: 10,
      handlerMacroRef: null,
      blocksProductVerdict: true,
    },
  ],
}

describe('surface-registry', () => {
  it('computes registry stats', () => {
    const stats = surfaceRegistryStats(catalog)
    expect(stats.surfaceCount).toBe(2)
    expect(stats.verdictBlocking).toBe(1)
    expect(stats.kinds.DIALOG).toBe(1)
  })

  it('filters surfaces by screen and query', () => {
    const filtered = filterSurfaces(catalog.surfaces, {
      appKey: 'nesy.courier.mobile',
      screenKey: 'nesy.route.stop-list',
      kind: null,
      policy: null,
      query: 'route',
    })
    expect(filtered).toHaveLength(1)
    expect(filtered[0]?.surfaceKey).toBe('nesy.route.selection-dialog')
  })
})
