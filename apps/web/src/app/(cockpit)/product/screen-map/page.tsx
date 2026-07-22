'use client'

import { Map } from 'lucide-react'
import { ProductPage, PageSection } from '@/components/product'
import { ScreenMapExplorer } from '@/components/product/screen-map-explorer'

export default function ScreenMapPage() {
  return (
    <ProductPage path="/product/screen-map" hideToolbar>
      <PageSection
        eyebrow="Courier Mobile"
        title="Screen Map"
        description="Product flow knowledge map — which screens connect, and which actions move the courier between them."
        icon={Map}
        tone="blue"
      >
        <ScreenMapExplorer />
      </PageSection>
    </ProductPage>
  )
}
