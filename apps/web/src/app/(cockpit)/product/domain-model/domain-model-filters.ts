import type { DomainEntity, EntityCategory } from '@/data/product/domain-glossary'

export type CategoryFilter = EntityCategory | 'all'

export function entityMatchesCategory(
  entity: DomainEntity,
  category: CategoryFilter,
  categoryOf: (entity: DomainEntity) => EntityCategory,
): boolean {
  return category === 'all' || categoryOf(entity) === category
}

export function filterEntities(
  entities: DomainEntity[],
  query: string,
  category: CategoryFilter,
  matchesQuery: (entity: DomainEntity, query: string) => boolean,
  categoryOf: (entity: DomainEntity) => EntityCategory,
): DomainEntity[] {
  return entities.filter(
    (entity) => matchesQuery(entity, query) && entityMatchesCategory(entity, category, categoryOf),
  )
}

export function resolveSelection(
  selectedId: string,
  visibleChain: DomainEntity[],
  visibleCrossCutting: DomainEntity[],
): string | null {
  const visible = [...visibleChain, ...visibleCrossCutting]
  if (visible.some((entity) => entity.id === selectedId)) return selectedId
  return visibleChain[0]?.id ?? visibleCrossCutting[0]?.id ?? null
}
