import {
  AutomationHistoryStatCardsShimmer,
  AutomationHistoryTableShimmer,
} from '@/components/automation/automation-history-page-shimmer'
import { ProductPage } from '@/components/product'

export default function Loading() {
  return (
    <ProductPage path="/automation/history">
      <div className="space-y-6" aria-busy="true" aria-label="Loading run history">
        <AutomationHistoryStatCardsShimmer />
        <AutomationHistoryTableShimmer />
      </div>
    </ProductPage>
  )
}
