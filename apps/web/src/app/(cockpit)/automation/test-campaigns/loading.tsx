import { TestCampaignsPageShimmer } from '@/components/automation/shimmers/test-shimmers'
import { ProductPage } from '@/components/product'

export default function Loading() {
  return (
    <ProductPage path="/automation/test-campaigns" hideToolbar>
      <TestCampaignsPageShimmer />
    </ProductPage>
  )
}
