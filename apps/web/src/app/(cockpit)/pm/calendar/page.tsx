'use client'

import { CalendarDays } from 'lucide-react'
import { ProductPage, HeroCallout } from '@/components/product'

export default function CalendarPage() {
  return (
    <ProductPage path="/pm/calendar" title="Sprint Calendar">
      <HeroCallout
        icon={CalendarDays}
        eyebrow="Planning"
        tone="nesy"
        title="Sprint Calendar"
        lead="Bu sayfa henüz içerik taşımıyor."
      />
    </ProductPage>
  )
}
