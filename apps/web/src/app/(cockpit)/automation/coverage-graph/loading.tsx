import { CoverageGraphPageShimmer } from '@/components/automation/shimmers/product-coverage-shimmers'
import { ProductPage } from '@/components/product'

export default function Loading() {
  return (
    <ProductPage path="/automation/coverage-graph" hideToolbar>
      <CoverageGraphPageShimmer />
    </ProductPage>
  )
}
