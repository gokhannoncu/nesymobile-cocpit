'use client'

import { Map } from 'lucide-react'
import { ProductPage, HeroCallout } from '@/components/product'

export default function RoadmapPage() {
  return (
    <ProductPage path="/pm/roadmap" title="Roadmap">
      <HeroCallout
        icon={Map}
        eyebrow="Planning"
        tone="nesy"
        title="Roadmap"
        lead="Bu sayfa henüz içerik taşımıyor."
      />
    </ProductPage>
  )
}
