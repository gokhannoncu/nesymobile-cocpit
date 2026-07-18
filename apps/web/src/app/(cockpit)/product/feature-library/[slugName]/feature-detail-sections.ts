export type FeatureDetailSectionId = 'overview' | 'flow' | 'countries' | 'tech' | 'ops'

export type FeatureDetailSection = {
  id: FeatureDetailSectionId
  label: string
}

const LABELS: Record<FeatureDetailSectionId, string> = {
  overview: 'Overview',
  flow: 'Flow',
  countries: 'Countries',
  tech: 'Tech',
  ops: 'Ops',
}

export function resolveFeatureDetailSections(input: {
  hasDetail: boolean
  hasDiagram: boolean
}): FeatureDetailSection[] {
  const ids: FeatureDetailSectionId[] = input.hasDetail
    ? input.hasDiagram
      ? ['overview', 'flow', 'countries', 'tech', 'ops']
      : ['overview', 'countries', 'tech', 'ops']
    : ['overview', 'countries']

  return ids.map((id) => ({ id, label: LABELS[id] }))
}
