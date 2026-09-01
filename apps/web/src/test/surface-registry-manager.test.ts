import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(
  resolve(__dirname, '../components/automation/domain-pack/SurfaceRegistryManager.tsx'),
  'utf8',
)
const PAGE = readFileSync(
  resolve(
    __dirname,
    '../app/(cockpit)/automation/domain-packs/[packId]/surfaces/page.tsx',
  ),
  'utf8',
)
const TABS = readFileSync(
  resolve(__dirname, '../components/automation/domain-pack/DomainPackTabs.tsx'),
  'utf8',
)
const DETAIL = readFileSync(
  resolve(__dirname, '../components/automation/domain-pack/surface-registry/SurfaceDetailPanel.tsx'),
  'utf8',
)
const CLIENT = readFileSync(
  resolve(__dirname, '../lib/verdict-runtime/client.ts'),
  'utf8',
)
const MANIFEST = readFileSync(resolve(__dirname, '../lib/page-migration-manifest.ts'), 'utf8')

describe('SurfaceRegistryManager — 6D.2', () => {
  it('loads the pack screen-surface registry instead of JSON stubs', () => {
    expect(SRC).toMatch(/fetchVerdictScreenSurfaces/)
    expect(SRC).toMatch(/SurfaceRegistryHeader/)
    expect(CLIENT).toMatch(/screen-surfaces/)
    expect(TABS).toMatch(/SurfaceRegistryManager/)
    expect(PAGE).toMatch(/SurfaceRegistryManager/)
  })

  it('separates loading, empty, and error states', () => {
    expect(SRC).toMatch(/status: 'loading'/)
    expect(SRC).toMatch(/status: 'empty'/)
    expect(SRC).toMatch(/status: 'error'/)
    expect(SRC).toMatch(/Surface registry unavailable/)
    expect(SRC).toMatch(/No applications, screens, or surfaces/)
  })

  it('keeps PUBLISHED packs read-only with an explicit reason', () => {
    expect(SRC).toMatch(/immutableReason/)
    expect(SRC).toMatch(/readOnly/)
    expect(SRC).toMatch(/publicationState !== 'DRAFT'/)
    expect(DETAIL).toMatch(/Save surface to draft/)
  })

  it('edits surface fields and persists via draft save', () => {
    expect(SRC).toMatch(/parentScreenRefs/)
    expect(SRC).toMatch(/defaultPolicy/)
    expect(SRC).toMatch(/detection/)
    expect(SRC).toMatch(/saveDomainPackDraft/)
    expect(SRC).toMatch(/expectedRevision/)
    expect(SRC).toMatch(/fetchVerdictDomainPackAdmin/)
  })

  it('registers the nested surfaces route in the migration manifest', () => {
    expect(MANIFEST).toMatch(/routePattern: '\/automation\/domain-packs\/\[packId\]\/surfaces'/)
    expect(MANIFEST).toMatch(/surface-registry-manager\.test\.ts/)
  })
})
