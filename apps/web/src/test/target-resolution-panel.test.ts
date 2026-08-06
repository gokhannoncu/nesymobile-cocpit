import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(
  resolve(__dirname, '../components/automation/evidence/TargetResolutionPanel.tsx'),
  'utf8',
)

describe('TargetResolutionPanel — runtime binding (6D.1b)', () => {
  it('calls the verdict-runtime client instead of shipping fabricated rows', () => {
    expect(SRC).toMatch(/verdict-runtime\/client/)
    expect(SRC).toMatch(/fetchVerdictTargetResolution/)
    expect(SRC).toMatch(/fetchVerdictDomainPacks/)
    expect(SRC).not.toMatch(/Semantic Matcher/)
    expect(SRC).not.toMatch(/Fuzzy Text Resolver/)
    expect(SRC).not.toMatch(/Use First Match/)
  })

  it('separates loading, empty, and error states', () => {
    expect(SRC).toMatch(/status: 'loading'/)
    expect(SRC).toMatch(/status: 'empty'/)
    expect(SRC).toMatch(/status: 'error'/)
    expect(SRC).toMatch(/No provider chain/)
    expect(SRC).toMatch(/Target resolution unavailable/)
  })

  it('surfaces provider chain fields and policy violations', () => {
    for (const field of [
      'strategies',
      'ambiguityPolicy',
      'notFoundPolicy',
      'deadlineMs',
      'reverifyBeforeAction',
      'violations',
    ]) {
      expect(SRC, `missing ${field}`).toContain(field)
    }
  })

  it('disables act when ambiguity / identity policy is unsafe', () => {
    expect(SRC).toMatch(/ambiguityBlocksAction/)
    expect(SRC).toMatch(/disabled=\{ambiguityBlocksAction\}/)
    expect(SRC).toMatch(/Resolve \/ act disabled/)
  })
})
