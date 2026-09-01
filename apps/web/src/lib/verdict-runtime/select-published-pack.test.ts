import { describe, expect, it } from 'vitest'
import {
  comparePackVersions,
  isCanonicalPackDigest,
  packIdentity,
  parsePackIdentity,
  selectPinnedPublishedPack,
} from './select-published-pack'
import type { DomainPackSummary } from './types'

function pack(partial: Partial<DomainPackSummary> & Pick<DomainPackSummary, 'packKey' | 'version'>): DomainPackSummary {
  return {
    bundleDigest: partial.bundleDigest ?? `sha256:${'a'.repeat(64)}`,
    publicationState: partial.publicationState ?? 'PUBLISHED',
    revision: partial.revision ?? 1,
    ...partial,
  }
}

describe('selectPinnedPublishedPack', () => {
  it('skips stub digests and prefers newest nesy.courier', () => {
    const selected = selectPinnedPublishedPack([
      pack({
        packKey: 'nesy-courier',
        version: '2.0.0',
        bundleDigest: 'sha256:persist01',
      }),
      pack({
        packKey: 'nesy.courier',
        version: '1.0.0',
        bundleDigest: `sha256:${'b'.repeat(64)}`,
      }),
      pack({
        packKey: 'nesy.courier',
        version: '1.0.1',
        bundleDigest: `sha256:${'c'.repeat(64)}`,
      }),
      pack({
        packKey: 'acme.demo',
        version: '9.0.0',
        bundleDigest: `sha256:${'d'.repeat(64)}`,
      }),
    ])
    expect(selected).toMatchObject({ packKey: 'nesy.courier', version: '1.0.1' })
  })

  it('prefers compileReady packs when annotated', () => {
    const selected = selectPinnedPublishedPack([
      pack({
        packKey: 'nesy.courier',
        version: '1.0.1',
        bundleDigest: `sha256:${'c'.repeat(64)}`,
        compileReady: false,
      }),
      pack({
        packKey: 'nesy.courier',
        version: '1.0.2',
        bundleDigest: `sha256:${'e'.repeat(64)}`,
        compileReady: true,
      }),
    ])
    expect(selected?.version).toBe('1.0.2')
  })
})

describe('pack identity helpers', () => {
  it('round-trips packKey@version', () => {
    expect(packIdentity({ packKey: 'nesy.courier', version: '1.0.1' })).toBe('nesy.courier@1.0.1')
    expect(parsePackIdentity('nesy.courier@1.0.1')).toEqual({
      packKey: 'nesy.courier',
      version: '1.0.1',
    })
  })

  it('compares dotted versions numerically', () => {
    expect(comparePackVersions('1.0.2', '1.0.1')).toBeGreaterThan(0)
    expect(isCanonicalPackDigest(`sha256:${'f'.repeat(64)}`)).toBe(true)
    expect(isCanonicalPackDigest('sha256:persist01')).toBe(false)
  })
})
