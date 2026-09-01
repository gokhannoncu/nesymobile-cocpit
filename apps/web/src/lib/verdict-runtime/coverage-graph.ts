export type CoverageGraphCounts = {
  features: number
  screens: number
  surfaces: number
  targets: number
  evidence: number
  tests: number
  releaseGateTests: number
}

export type CoverageLayerKey = 'features' | 'components' | 'evidence' | 'tests'

export function componentCount(
  counts: Pick<CoverageGraphCounts, 'screens' | 'surfaces' | 'targets'>,
): number {
  return counts.screens + counts.surfaces + counts.targets
}

export function countReleaseGateTests(testProfiles: readonly Record<string, unknown>[]): number {
  return testProfiles.filter((profile) => profile.releaseGate === true).length
}

export function coverageChainComplete(counts: CoverageGraphCounts): boolean {
  return (
    counts.features > 0 &&
    componentCount(counts) > 0 &&
    counts.evidence > 0 &&
    counts.tests > 0
  )
}

export function coverageGapLayers(counts: CoverageGraphCounts): CoverageLayerKey[] {
  const gaps: CoverageLayerKey[] = []
  if (counts.features <= 0) gaps.push('features')
  if (componentCount(counts) <= 0) gaps.push('components')
  if (counts.evidence <= 0) gaps.push('evidence')
  if (counts.tests <= 0) gaps.push('tests')
  return gaps
}

export function coverageScore(counts: CoverageGraphCounts): number {
  let filled = 0
  if (counts.features > 0) filled += 1
  if (componentCount(counts) > 0) filled += 1
  if (counts.evidence > 0) filled += 1
  if (counts.tests > 0) filled += 1
  return Math.round((filled / 4) * 100)
}

export function coverageLayerLabel(layer: CoverageLayerKey): string {
  switch (layer) {
    case 'features':
      return 'Features'
    case 'components':
      return 'Components'
    case 'evidence':
      return 'Evidence'
    case 'tests':
      return 'Tests'
  }
}

export function sumCoverageTotals(rows: readonly CoverageGraphCounts[]) {
  return rows.reduce(
    (totals, row) => ({
      features: totals.features + row.features,
      screens: totals.screens + row.screens,
      surfaces: totals.surfaces + row.surfaces,
      targets: totals.targets + row.targets,
      evidence: totals.evidence + row.evidence,
      tests: totals.tests + row.tests,
      releaseGateTests: totals.releaseGateTests + row.releaseGateTests,
    }),
    {
      features: 0,
      screens: 0,
      surfaces: 0,
      targets: 0,
      evidence: 0,
      tests: 0,
      releaseGateTests: 0,
    },
  )
}
