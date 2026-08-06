import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const OUTCOME = readFileSync(
  resolve(__dirname, '../components/automation/run-detail/OutcomePanel.tsx'),
  'utf8',
)
const DISPOSITION = readFileSync(
  resolve(__dirname, '../components/automation/run-detail/VerdictDisposition.tsx'),
  'utf8',
)

describe('Run Detail outcome / disposition — no fabricated lanes (6D.3)', () => {
  it('OutcomePanel reads runtime fields and fails closed to NOT_MEASURED', () => {
    expect(OUTCOME).toMatch(/NOT_MEASURED/)
    expect(OUTCOME).toMatch(/runtime\.productVerdict|runtime\.cleanupResult/)
    expect(OUTCOME).not.toMatch(/>COMPLETED</)
    expect(OUTCOME).not.toMatch(/>FAILED</)
    expect(OUTCOME).not.toMatch(/text-green-600 border-green-200 bg-green-50">PASS/)
  })

  it('VerdictDisposition does not hardcode NORMAL / FAILED / READY', () => {
    expect(DISPOSITION).toMatch(/NOT_MEASURED/)
    expect(DISPOSITION).toMatch(/terminationReason/)
    expect(DISPOSITION).toMatch(/operationalDisposition/)
    expect(DISPOSITION).not.toMatch(/>NORMAL</)
    expect(DISPOSITION).not.toMatch(/>FAILED</)
    expect(DISPOSITION).not.toMatch(/>READY</)
  })
})
