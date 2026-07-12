'use client'

import { useParams, notFound } from 'next/navigation'
import { ComparisonTable, PageSection, ProductPage } from '@/components/product'
import { KnowledgeNav, RightRail, type NavGroup } from '@/components/engineering/mobile-knowledge'
import { SCREENS, getScreen } from '@/data/engineering/mobile-knowledge/screens'
import { SCREEN_GROUP_META, type ScreenGroup } from '@/data/engineering/mobile-knowledge/types'
import { ScreenView } from './screen-view'

const BASE = '/engineering/mobile-knowledge/screens'
const GROUP_ORDER = Object.keys(SCREEN_GROUP_META) as ScreenGroup[]

/** Delivery vs Delivery Failed karşılaştırması (QA / yeni ekip için). */
function DeliveryComparison() {
  return (
    <PageSection eyebrow="Karşılaştırma" title="Delivery vs Delivery Failed" tone="indigo">
      <ComparisonTable
        headers={[{ label: 'Boyut' }, { label: 'Delivery', tone: 'teal' }, { label: 'Delivery Failed', tone: 'red' }]}
        rows={[
          ['Amaç', 'Başarılı teslim', 'Başarısız teslim nedeni'],
          ['Payment', 'Olabilir', 'Genelde yok'],
          ['Fiscal', 'Olabilir', 'Yok'],
          ['Offline', 'Desteklenir', 'Desteklenir'],
          ['Ana endpoint', 'delivery/complete', 'delivery/complete (FAILED)'],
          ['Risk', 'Partial success', 'Reason mismatch'],
        ]}
      />
    </PageSection>
  )
}

export default function ScreenDetailPage() {
  const params = useParams()
  const slug = Array.isArray(params.screenId) ? params.screenId[0] : params.screenId
  const screen = slug ? getScreen(slug) : undefined

  if (!screen) {
    notFound()
  }

  const navGroups: NavGroup[] = GROUP_ORDER.map((g) => ({
    label: SCREEN_GROUP_META[g].label,
    items: SCREENS.filter((s) => s.group === g).map((s) => ({
      slug: s.slug,
      title: s.title,
      documented: s.documented,
    })),
  })).filter((g) => g.items.length > 0)

  const showComparison = screen.slug === 'delivery' || screen.slug === 'delivery-failed'

  return (
    <ProductPage path={`${BASE}/${screen.slug}`} title={`Screen · ${screen.title}`}>
      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="w-full shrink-0 lg:w-60">
          <KnowledgeNav groups={navGroups} basePath={BASE} activeSlug={screen.slug} />
        </div>
        <div className="min-w-0 flex-1 space-y-8">
          <ScreenView screen={screen} />
          {showComparison && screen.documented && <DeliveryComparison />}
        </div>
        <RightRail sections={[]} meta={screen.meta} related={screen.related} />
      </div>
    </ProductPage>
  )
}
