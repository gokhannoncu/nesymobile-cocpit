import { describe, expect, it } from 'vitest'
import {
  componentCount,
  countReleaseGateTests,
  coverageChainComplete,
  coverageChainStatusTone,
  coverageGapLayers,
  coverageScore,
  sumCoverageTotals,
} from './coverage-graph'

describe('coverage-graph helpers', () => {
  const completeRow = {
    features: 2,
    screens: 1,
    surfaces: 0,
    targets: 3,
    evidence: 4,
    tests: 2,
    releaseGateTests: 1,
  }

  it('detects a complete coverage chain', () => {
    expect(coverageChainComplete(completeRow)).toBe(true)
    expect(coverageGapLayers(completeRow)).toEqual([])
    expect(coverageScore(completeRow)).toBe(100)
  })

  it('lists missing layers', () => {
    const gaps = {
      features: 0,
      screens: 0,
      surfaces: 0,
      targets: 0,
      evidence: 1,
      tests: 0,
      releaseGateTests: 0,
    }
    expect(coverageChainComplete(gaps)).toBe(false)
    expect(coverageGapLayers(gaps)).toEqual(['features', 'components', 'tests'])
    expect(coverageScore(gaps)).toBe(25)
  })

  it('sums component counts and release gates', () => {
    expect(componentCount({ screens: 2, surfaces: 1, targets: 3 })).toBe(6)
    expect(
      countReleaseGateTests([
        { releaseGate: true },
        { releaseGate: false },
        { releaseGate: true },
      ]),
    ).toBe(2)
    expect(sumCoverageTotals([completeRow, { ...completeRow, features: 1 }])).toMatchObject({
      features: 3,
      tests: 4,
      releaseGateTests: 2,
    })
  })

  it('classifies chain status tone', () => {
    expect(coverageChainStatusTone(true, 0)).toBe('complete')
    expect(coverageChainStatusTone(false, 1)).toBe('warning')
    expect(coverageChainStatusTone(false, 3)).toBe('critical')
  })
})
