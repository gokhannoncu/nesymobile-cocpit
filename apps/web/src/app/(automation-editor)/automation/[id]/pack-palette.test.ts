import { describe, expect, it } from 'vitest'
import { buildPackPaletteGroups, paletteItemFromSemanticAction } from './pack-palette'
import type { SemanticActionApi, SemanticActionCatalogApi } from '@/lib/verdict-runtime/types'

function action(overrides: Partial<SemanticActionApi> = {}): SemanticActionApi {
  return {
    actionKey: 'nesy.action.login',
    displayName: 'Sign in',
    businessMeaning: 'A courier authenticates.',
    notResponsibleFor: ['password reset'],
    applicationRef: 'nesy.courier.mobile',
    screenRefs: ['nesy.auth.login'],
    surfaceRefs: [],
    entityTypeRefs: [],
    targetRefs: [],
    requiredCapabilityRefs: ['verdict.core.bridge.tap'],
    capabilityStatus: { satisfied: true, missing: [], reason: null },
    ...overrides,
  }
}

describe('pack palette capability gating', () => {
  it('keeps satisfied actions droppable', () => {
    const item = paletteItemFromSemanticAction(action())
    expect(item.paletteDisabled).toBe(false)
    expect(item.paletteDisabledReason).toBeUndefined()
    expect(item.title).toBe('Sign in')
  })

  it('disables unsatisfied actions with the catalog reason', () => {
    const item = paletteItemFromSemanticAction(
      action({
        capabilityStatus: {
          satisfied: false,
          missing: ['verdict.core.bridge.tap'],
          reason: 'Host Bridge B2 baseline missing capabilities: verdict.core.bridge.tap',
        },
      }),
    )
    expect(item.paletteDisabled).toBe(true)
    expect(item.paletteDisabledReason).toMatch(/Host Bridge B2 baseline missing capabilities/)
  })

  it('groups courier actions under applicationRef and screenRefs', () => {
    const catalog: SemanticActionCatalogApi = {
      apiVersion: 'verdict-runtime.v1',
      packKey: 'nesy.courier',
      packVersion: '1.40.0',
      partial: false,
      items: [
        action(),
        action({
          actionKey: 'nesy.action.select-route',
          displayName: 'Select route',
          screenRefs: ['nesy.route.stop-list'],
        }),
      ],
      macros: [],
    }
    const groups = buildPackPaletteGroups(catalog)
    expect(groups).toHaveLength(1)
    expect(groups[0]?.title).toBe('nesy.courier.mobile')
    expect(groups[0]?.subsections?.map((sub) => sub.title)).toEqual([
      'nesy.auth.login',
      'nesy.route.stop-list',
    ])
  })
})
