import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(
  resolve(__dirname, '../components/automation/editor/EntityBindingEditor.tsx'),
  'utf8',
)
const CLIENT = readFileSync(
  resolve(__dirname, '../lib/verdict-runtime/client.ts'),
  'utf8',
)

describe('EntityBindingEditor — runtime binding (6D.1d)', () => {
  it('calls the verdict-runtime client instead of hardcoded entities', () => {
    expect(SRC).toMatch(/verdict-runtime\/client/)
    expect(SRC).toMatch(/fetchVerdictEntityBindings/)
    expect(SRC).toMatch(/fetchVerdictDomainPacks/)
    expect(SRC).not.toMatch(/UserAccount/)
    expect(SRC).not.toMatch(/ProductItem/)
    expect(SRC).not.toMatch(/\$\.currentUser\.id/)
  })

  it('separates loading, empty, and error states', () => {
    expect(SRC).toMatch(/status: 'loading'/)
    expect(SRC).toMatch(/status: 'empty'/)
    expect(SRC).toMatch(/status: 'error'/)
    expect(SRC).toMatch(/No entity bindings/)
    expect(SRC).toMatch(/Entity bindings unavailable/)
  })

  it('surfaces EntityDefinition and EntityBindingDefinition evidence fields', () => {
    expect(SRC).toMatch(/EntityDefinition/)
    expect(SRC).toMatch(/EntityBindingDefinition/)
    expect(SRC).toMatch(/businessKeyPath/)
    expect(SRC).toMatch(/projectedPaths/)
    expect(SRC).toMatch(/entityKnown/)
    expect(SRC).toMatch(/redactProjection/)
    expect(CLIENT).toMatch(/entity-bindings/)
  })

  it('does not treat fetch failure as empty success', () => {
    expect(SRC).toMatch(/entity binding catalog unavailable/)
    expect(SRC).toMatch(/catch \(error\)/)
    expect(SRC).not.toMatch(/setBindings\(\[/)
  })
})
