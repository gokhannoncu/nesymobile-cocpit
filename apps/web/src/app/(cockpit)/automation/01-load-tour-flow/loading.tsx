import { LoadTourFlowPageShimmer } from '@/components/automation/shimmers/load-tour-flow-shimmer'
import { ProductPage } from '@/components/product'
import { AUTOMATION_LOAD_TOUR_PATH } from '@nesy/metronic/config/layout-21.config'

export default function Loading() {
  return (
    <ProductPage path={AUTOMATION_LOAD_TOUR_PATH} title="Load & Tour Flow">
      <LoadTourFlowPageShimmer />
    </ProductPage>
  )
}
