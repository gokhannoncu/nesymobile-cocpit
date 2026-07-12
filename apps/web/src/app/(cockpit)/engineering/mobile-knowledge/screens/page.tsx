'use client'

import { Smartphone } from 'lucide-react'
import { CardGrid, HeroCallout, InfoCard, PageSection, ProductPage } from '@/components/product'
import { KnowledgeNav, type NavGroup } from '@/components/engineering/mobile-knowledge'
import { SCREENS } from '@/data/engineering/mobile-knowledge/screens'
import { SCREEN_GROUP_META, type ScreenGroup } from '@/data/engineering/mobile-knowledge/types'

const BASE = '/engineering/mobile-knowledge/screens'
const GROUP_ORDER = Object.keys(SCREEN_GROUP_META) as ScreenGroup[]

export default function ScreenManualPage() {
  const navGroups: NavGroup[] = GROUP_ORDER.map((g) => ({
    label: SCREEN_GROUP_META[g].label,
    items: SCREENS.filter((s) => s.group === g).map((s) => ({
      slug: s.slug,
      title: s.title,
      documented: s.documented,
    })),
  })).filter((g) => g.items.length > 0)

  return (
    <ProductPage path="/engineering/mobile-knowledge/screens">
      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="w-full shrink-0 lg:w-60">
          <KnowledgeNav groups={navGroups} basePath={BASE} />
        </div>

        <div className="min-w-0 flex-1 space-y-8">
          <HeroCallout
            icon={Smartphone}
            eyebrow="Screen Manual"
            tone="teal"
            title="Ekran Ekran Mobil Kullanım Rehberi"
            lead="Her ekranın amacını, kullanıcı adımlarını, iş kurallarını, backend bağlantılarını ve hata senaryolarını iş akışına göre incele."
          />

          {GROUP_ORDER.map((g) => {
            const screens = SCREENS.filter((s) => s.group === g)
            if (!screens.length) return null
            return (
              <PageSection key={g} title={SCREEN_GROUP_META[g].label} tone={SCREEN_GROUP_META[g].tone}>
                <CardGrid cols={3}>
                  {screens.map((s) => (
                    <InfoCard
                      key={s.slug}
                      icon={Smartphone}
                      tone={s.tone}
                      title={s.title}
                      desc={s.subtitle}
                      href={`${BASE}/${s.slug}`}
                      badges={
                        s.documented
                          ? [{ label: 'Belgelendi', tone: 'green' }]
                          : [{ label: 'Taslak', tone: 'amber' }]
                      }
                    />
                  ))}
                </CardGrid>
              </PageSection>
            )
          })}
        </div>
      </div>
    </ProductPage>
  )
}
