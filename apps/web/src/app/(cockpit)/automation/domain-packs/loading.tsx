import { DomainPackCatalogPageShimmer } from '@/components/automation/domain-pack/domain-pack-catalog-shimmer'
import { ProductPage } from '@/components/product'

export default function Loading() {
  return (
    <ProductPage path="/automation/domain-packs" hideToolbar>
      <DomainPackCatalogPageShimmer />
    </ProductPage>
  )
}
