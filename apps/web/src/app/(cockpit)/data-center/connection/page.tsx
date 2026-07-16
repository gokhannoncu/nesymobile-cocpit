'use client'

import { ProductPage } from '@/components/product'
import { NesyConnectionPanel } from '@/components/data-center/nesy-connection-panel'

export default function DataCenterConnectionPage() {
  return (
    <ProductPage path="/data-center/connection">
      <NesyConnectionPanel />
    </ProductPage>
  )
}
