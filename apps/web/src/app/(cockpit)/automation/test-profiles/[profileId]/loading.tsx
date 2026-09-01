import { TestProfileDetailPageShimmer } from '@/components/automation/shimmers/test-shimmers'
import { ProductPage } from '@/components/product'

export default function Loading() {
  return (
    <ProductPage path="/automation/test-profiles" hideToolbar>
      <TestProfileDetailPageShimmer />
    </ProductPage>
  )
}
