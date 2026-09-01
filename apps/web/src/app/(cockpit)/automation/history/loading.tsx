import { AutomationHistoryPageShimmer } from '@/components/automation/automation-history-page-shimmer'
import { ProductPage } from '@/components/product'

export default function Loading() {
  return (
    <ProductPage path="/automation/history" hideToolbar>
      <AutomationHistoryPageShimmer />
    </ProductPage>
  )
}
