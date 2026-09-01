import { ExecutionQueuePageShimmer } from '@/components/automation/shimmers/operations-shimmers'
import { ProductPage } from '@/components/product'

export default function Loading() {
  return (
    <ProductPage path="/automation/execution-queue" hideToolbar>
      <ExecutionQueuePageShimmer />
    </ProductPage>
  )
}
