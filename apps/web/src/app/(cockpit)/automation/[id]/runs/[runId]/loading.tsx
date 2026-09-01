import { RunDetailPageShimmer } from '@/components/automation/shimmers/run-detail-shimmer'
import { ProductPage } from '@/components/product/page-shell'

export default function RunDetailLoading() {
  return (
    <ProductPage path="/automation/list" title="Loading run">
      <RunDetailPageShimmer />
    </ProductPage>
  )
}
