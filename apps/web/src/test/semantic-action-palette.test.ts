import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(
  resolve(__dirname, '../components/automation/editor/SemanticActionPalette.tsx'),
  'utf8',
)
const CLIENT = readFileSync(
  resolve(__dirname, '../lib/verdict-runtime/client.ts'),
  'utf8',
)

describe('SemanticActionPalette — runtime binding (6D.1e)', () => {
  it('loads actions from the published domain pack instead of hardcoded mocks', () => {
    expect(SRC).toMatch(/verdict-runtime\/client/)
    expect(SRC).toMatch(/fetchVerdictSemanticActions/)
    expect(SRC).toMatch(/fetchVerdictDomainPacks/)
    expect(SRC).not.toMatch(/const ACTIONS = \[/)
    expect(SRC).not.toMatch(/Tap Element/)
    expect(SRC).not.toMatch(/Query Database/)
    expect(SRC).not.toMatch(/Assert Visible/)
  })

  it('separates loading, empty, and error states', () => {
    expect(SRC).toMatch(/status: 'loading'/)
    expect(SRC).toMatch(/status: 'empty'/)
    expect(SRC).toMatch(/status: 'error'/)
    expect(SRC).toMatch(/Palette empty/)
    expect(SRC).toMatch(/Semantic actions unavailable/)
    expect(SRC).toMatch(/no published Domain Pack/)
  })

  it('surfaces capabilityStatus and does not treat fetch failure as empty', () => {
    expect(SRC).toMatch(/capabilityStatus/)
    expect(SRC).toMatch(/required capabilities not satisfied/)
    expect(SRC).toMatch(/semantic action catalog unavailable/)
    expect(SRC).toMatch(/catch \(error\)/)
    expect(CLIENT).toMatch(/semantic-actions/)
  })
})
