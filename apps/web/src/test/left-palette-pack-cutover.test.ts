import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const EDITOR = readFileSync(
  resolve(__dirname, '../app/(automation-editor)/automation/[id]/workflow-editor.tsx'),
  'utf8',
)
const PACK_PALETTE = readFileSync(
  resolve(__dirname, '../app/(automation-editor)/automation/[id]/pack-palette.ts'),
  'utf8',
)
const MANIFEST = readFileSync(resolve(__dirname, '../lib/page-migration-manifest.ts'), 'utf8')

describe('Left palette pack cutover (6D.1f)', () => {
  it('loads semantic actions from the published domain pack as primary source', () => {
    expect(EDITOR).toMatch(/fetchVerdictSemanticActions/)
    expect(EDITOR).toMatch(/fetchVerdictDomainPacks/)
    expect(EDITOR).toMatch(/buildPackPaletteGroups/)
    expect(PACK_PALETTE).toMatch(/applicationRef/)
    expect(PACK_PALETTE).toMatch(/screenRefs/)
    expect(PACK_PALETTE).toMatch(/notResponsibleFor/)
    expect(PACK_PALETTE).toMatch(/capabilityStatus/)
  })

  it('keeps unsatisfied capabilities visible but disabled with a reason', () => {
    expect(PACK_PALETTE).toMatch(/Bridge B2 capability negotiation not available/)
    expect(PACK_PALETTE).toMatch(/paletteDisabled/)
    expect(EDITOR).toMatch(/paletteDisabled/)
    expect(EDITOR).toMatch(/paletteDisabledReason/)
  })

  it('blocks action authoring instead of falling back to the old palette', () => {
    expect(EDITOR).toMatch(/Domain Pack palette blocked/)
    expect(EDITOR).toMatch(/mode: 'blocked'/)
    expect(EDITOR).not.toMatch(/legacy palette/)
    expect(EDITOR).not.toMatch(/mode: 'legacy'/)
    expect(PACK_PALETTE).toMatch(/Structural editor tools/)
  })

  it('records legacyCleanup on the editor migration manifest entry', () => {
    expect(MANIFEST).toMatch(/routePattern: '\/automation\/\[id\]'/)
    expect(MANIFEST).toMatch(/legacyCleanup:/)
    expect(MANIFEST).toMatch(/legacyCleanupExpiry:/)
    expect(MANIFEST).toMatch(/left-palette-pack-cutover\.test\.ts/)
    expect(MANIFEST).toMatch(/BRIDGEFLOW_ONLY/)
  })
})
