import { AutomationListPageShimmer } from '@/components/automation/automation-list-page-shimmer'
import { ProductPage } from '@/components/product'

export default function Loading() {
  return (
    <ProductPage path="/automation/list" hideToolbar>
      <AutomationListPageShimmer />
    </ProductPage>
  )
}
