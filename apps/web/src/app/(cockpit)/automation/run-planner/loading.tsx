import { RunPlannerPageShimmer } from '@/components/automation/shimmers/operations-shimmers'
import { ProductPage } from '@/components/product'

export default function Loading() {
  return (
    <ProductPage path="/automation/run-planner">
      <RunPlannerPageShimmer />
    </ProductPage>
  )
}
