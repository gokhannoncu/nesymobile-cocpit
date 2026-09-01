import { ComponentRegistryPageShimmer } from '@/components/automation/shimmers/registry-shimmers'
import { ProductPage } from '@/components/product'

export default function Loading() {
  return (
    <ProductPage path="/automation/components" hideToolbar>
      <ComponentRegistryPageShimmer />
    </ProductPage>
  )
}
