import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = readFileSync(
  resolve(__dirname, '../components/automation/evidence/EvidenceSourceRegistry.tsx'),
  'utf8',
)

describe('EvidenceSourceRegistry — runtime binding (6D.1a)', () => {
  it('calls the verdict-runtime client instead of shipping fabricated rows', () => {
    expect(SRC).toMatch(/verdict-runtime\/client/)
    expect(SRC).toMatch(/fetchVerdictEvidenceSources/)
    expect(SRC).not.toMatch(/Main Activity Screen/)
    expect(SRC).not.toMatch(/Analytics SDK/)
  })

  it('separates loading, empty, and error states', () => {
    expect(SRC).toMatch(/status: 'loading'/)
    expect(SRC).toMatch(/status: 'empty'/)
    expect(SRC).toMatch(/status: 'error'/)
    expect(SRC).toMatch(/No evidence source registered/)
    expect(SRC).toMatch(/Registry unavailable/)
  })

  it('renders the runtime catalog fields required by the playbook', () => {
    for (const field of [
      'sourceEvent',
      'factKey',
      'plane',
      'subtype',
      'authority',
      'deliveryLanes',
      'freshnessMaxAgeMs',
    ]) {
      expect(SRC, `missing field ${field}`).toContain(field)
    }
  })

  it('optionally enriches with run-scoped conflicts', () => {
    expect(SRC).toMatch(/fetchVerdictRunEvidenceSources/)
    expect(SRC).toMatch(/conflicts/)
  })
})
