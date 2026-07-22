'use client'

import { Map } from 'lucide-react'
import { HeroCallout, ProductPage } from '@/components/product'
import { ScreenMapExplorer } from '@/components/product/screen-map-explorer'

export default function ScreenMapPage() {
  return (
    <ProductPage path="/product/screen-map" hideToolbar>
      <HeroCallout
        compact
        icon={Map}
        eyebrow="Courier Mobile"
        tone="blue"
        title="Screen Map"
        lead="Product flow knowledge map — which screens connect, and which actions move the courier between them."
      />
      <ScreenMapExplorer />
    </ProductPage>
  )
}
