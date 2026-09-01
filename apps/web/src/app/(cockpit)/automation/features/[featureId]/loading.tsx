import { FeatureDetailPageShimmer } from '@/components/automation/shimmers/test-shimmers'
import { ProductPage } from '@/components/product'

export default function Loading() {
  return (
    <ProductPage path="/automation/features">
      <FeatureDetailPageShimmer />
    </ProductPage>
  )
}
