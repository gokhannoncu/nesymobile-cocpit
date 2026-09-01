import { FieldCourierLoginTableShimmer } from '@/components/automation/field-courier-login-shimmer'
import { ProductPage } from '@/components/product'

export default function Loading() {
  return (
    <ProductPage path="/automation/field-login">
      <FieldCourierLoginTableShimmer />
    </ProductPage>
  )
}
