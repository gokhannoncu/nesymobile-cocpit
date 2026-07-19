export type FeatureDetailSectionId = 'overview' | 'flow' | 'countries' | 'ops'

export type FeatureDetailSection = {
  id: FeatureDetailSectionId
  label: string
}

const LABELS: Record<FeatureDetailSectionId, string> = {
  overview: 'Genel bakış',
  flow: 'İş akışı',
  countries: 'Ülkeler',
  ops: 'Saha notları',
}

export function resolveFeatureDetailSections(input: {
  hasDetail: boolean
  hasDiagram: boolean
}): FeatureDetailSection[] {
  const ids: FeatureDetailSectionId[] = input.hasDetail
    ? input.hasDiagram
      ? ['overview', 'flow', 'countries', 'ops']
      : ['overview', 'countries', 'ops']
    : ['overview', 'countries']

  return ids.map((id) => ({ id, label: LABELS[id] }))
}
