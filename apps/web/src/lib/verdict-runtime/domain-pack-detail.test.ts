import { describe, expect, it } from 'vitest'
import type { DomainPackAdminGetApi, DomainPackSummary } from './types'
import {
  capabilityContractTitle,
  featureContractDescription,
  featureContractKey,
  featureContractTags,
  featureContractTitle,
  mapAdminPackToDetailApi,
  selectLatestPublishedPacks,
} from './domain-pack-detail'

const admin = (features: unknown[]): DomainPackAdminGetApi => ({
  apiVersion: 'verdict-runtime.v1',
  pack: {
    packKey: 'nesy.courier',
    version: '1.38.0',
    bundleDigest: 'sha256:abc',
    publicationState: 'PUBLISHED',
    revision: 1,
    bundle: {
      manifest: { packName: 'Nesy Courier' },
      registries: {
        features,
        capabilities: [{ capabilityKey: 'verdict.core.bridge.tap', displayName: 'Tap' }],
        screens: [],
        surfaces: [],
        entities: [],
        targets: [],
        evidenceSources: [],
        semanticActions: [],
        macros: [],
        launchProfiles: [],
        testProfiles: [],
        applications: [],
      },
      runtimeCodePolicy: {},
    },
  },
})

describe('mapAdminPackToDetailApi', () => {
  it('lifts registries.features onto the flat detail shape', () => {
    const detail = mapAdminPackToDetailApi(
      admin([
        {
          featureKey: 'nesy.feature.stop-handling',
          authoring: {
            displayName: 'Stop handling',
            description: 'Selecting a route and opening the correct stop from the route list.',
            tags: ['core-journey'],
            owner: 'courier-mobile-quality',
          },
          executable: {
            invariants: [{ bindsReleaseGate: true }, { bindsReleaseGate: false }],
            screenRefs: ['a', 'b'],
            workflowRefs: ['w'],
          },
        },
      ]),
    )

    expect(detail.packKey).toBe('nesy.courier')
    expect(detail.displayName).toBe('Nesy Courier')
    expect(detail.features).toHaveLength(1)
    expect(detail.capabilities).toHaveLength(1)
    expect(featureContractTitle(detail.features[0]!)).toBe('Stop handling')
    expect(featureContractKey(detail.features[0]!)).toBe('nesy.feature.stop-handling')
    expect(featureContractDescription(detail.features[0]!)).toBe(
      'Selecting a route and opening the correct stop from the route list.',
    )
    expect(featureContractTags(detail.features[0]!)).toEqual(['core-journey'])
  })
})

describe('selectLatestPublishedPacks', () => {
  it('keeps one published version per packKey', () => {
    const items = [
      {
        packKey: 'nesy.courier',
        version: '1.34.0',
        publicationState: 'PUBLISHED',
        bundleDigest: 'a',
        revision: 1,
      },
      {
        packKey: 'nesy.courier',
        version: '1.38.0',
        publicationState: 'PUBLISHED',
        bundleDigest: 'b',
        revision: 1,
      },
      {
        packKey: 'acme.demo',
        version: '1.0.0',
        publicationState: 'PUBLISHED',
        bundleDigest: 'c',
        revision: 1,
      },
      {
        packKey: 'nesy.courier',
        version: '9.0.0',
        publicationState: 'DRAFT',
        bundleDigest: 'd',
        revision: 1,
      },
    ] as DomainPackSummary[]

    expect(selectLatestPublishedPacks(items).map((item) => `${item.packKey}@${item.version}`)).toEqual([
      'acme.demo@1.0.0',
      'nesy.courier@1.38.0',
    ])
  })
})

describe('capabilityContractTitle', () => {
  it('falls back to capabilityKey', () => {
    expect(capabilityContractTitle({ capabilityKey: 'domain.x' })).toBe('domain.x')
  })
})
