'use client'

import { Network } from 'lucide-react'
import { CardGrid, HeroCallout, InfoCard, PageSection, ProductPage } from '@/components/product'
import { KnowledgeNav } from '@/components/engineering/mobile-knowledge'
import { BACKEND_DOMAINS } from '@/data/engineering/mobile-knowledge/backend-domains'

const BASE = '/engineering/mobile-knowledge/backend'

export default function BackendHandbookPage() {
  const navGroups = [
    { items: BACKEND_DOMAINS.map((d) => ({ slug: d.slug, title: d.title, documented: d.documented })) },
  ]

  return (
    <ProductPage path="/engineering/mobile-knowledge/backend">
      <div className="flex flex-col gap-8 lg:flex-row">
        <div className="w-full shrink-0 lg:w-60">
          <KnowledgeNav groups={navGroups} basePath={BASE} />
        </div>

        <div className="min-w-0 flex-1 space-y-8">
          <HeroCallout
            icon={Network}
            eyebrow="Backend Handbook"
            tone="blue"
            title="Mobilin Backend’i El Kitabı"
            lead="Backend’in mobil açısından nasıl bölündüğünü, hangi domain’in hangi servisleri ve endpoint’leri kapsadığını keşfet."
          />

          <PageSection eyebrow="Domain Tree" title="Backend domain’leri" icon={Network} tone="blue">
            <CardGrid cols={2}>
              {BACKEND_DOMAINS.map((d) => (
                <InfoCard
                  key={d.slug}
                  icon={Network}
                  tone={d.tone}
                  title={d.title}
                  desc={d.subtitle}
                  href={`${BASE}/${d.slug}`}
                  badges={
                    d.documented
                      ? [{ label: 'Belgelendi', tone: 'green' }]
                      : [{ label: 'Taslak', tone: 'amber' }]
                  }
                />
              ))}
            </CardGrid>
          </PageSection>
        </div>
      </div>
    </ProductPage>
  )
}
