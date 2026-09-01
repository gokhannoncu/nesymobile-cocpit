import { CapabilitiesPageShimmer } from '@/components/automation/shimmers/product-coverage-shimmers'
import { ProductPage } from '@/components/product'

export default function Loading() {
  return (
    <ProductPage path="/automation/capabilities">
      <CapabilitiesPageShimmer />
    </ProductPage>
  )
}
