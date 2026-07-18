'use client'

import { Footprints, Map } from 'lucide-react'
import {
  Callout,
  HeroCallout,
  JourneyExplorer,
  ProductPage,
  SegmentTabs,
} from '@/components/product'
import { USER_JOURNEYS } from '@/data/product/user-journeys'

export default function UserJourneysPage() {
  return (
    <ProductPage path="/product/user-journeys">
      <HeroCallout
        icon={Footprints}
        eyebrow="Users & Field Experience · Journeys"
        tone="orange"
        title="What journeys does the courier experience in the field?"
        lead="This page maps the screen and decision-level journeys of Nesy Mobile as interactive flows: select a step to see what happens, what the courier is trying to complete, and where design can recover friction."
        chips={['5 journeys', 'Interactive flow', 'Decision branches', 'Step-level detail']}
      />

      <Callout icon={Map} title="Journey ≠ Country Matrix" tone="orange">
        <b>User Journey</b> describes the screens and decision moments the courier goes through while
        completing a task. <b>Country Matrix</b> holds the exact behavior of the same step across
        countries. This page explains the experience; the matrix explains the operational truth; in
        case of conflict, the matrix is the source of record.
      </Callout>

      <SegmentTabs
        variant="button"
        items={USER_JOURNEYS.map((journey) => ({
          value: journey.value,
          label: journey.label,
          icon: journey.icon,
          content: <JourneyExplorer journey={journey} />,
        }))}
      />
    </ProductPage>
  )
}
