'use client'

import { BookOpen, Network, Smartphone } from 'lucide-react'
import {
  CardGrid,
  HeroCallout,
  InfoCard,
  PageSection,
  ProductPage,
} from '@/components/product'
import {
  CoverageCards,
  NeedsAttention,
  RecentlyUpdated,
  SearchLauncher,
} from '@/components/engineering/mobile-knowledge'
import { hubCounts } from '@/data/engineering/mobile-knowledge/coverage'

export default function MobileKnowledgeOverviewPage() {
  const c = hubCounts()

  return (
    <ProductPage path="/engineering/mobile-knowledge">
      <HeroCallout
        icon={BookOpen}
        eyebrow="Mobile Knowledge Hub"
        tone="indigo"
        title="Mobile Knowledge Hub"
        lead="Mobil uygulamanın backend davranışlarını, ekran akışlarını, iş kurallarını ve operasyonel kullanımını tek kaynaktan keşfet."
        chips={['Backend Handbook', 'Screen Manual', 'Unified Search']}
      />

      <SearchLauncher />

      <PageSection
        eyebrow="Modüller"
        title="İki bilgi tabanı, tek arama"
        description="Backend Handbook mobilin servislerle nasıl konuştuğunu; Screen Manual kullanıcının ne gördüğünü ve bu arayüzün teknik olarak nasıl çalıştığını anlatır."
        icon={BookOpen}
        tone="indigo"
      >
        <CardGrid cols={2}>
          <InfoCard
            icon={Network}
            tone="blue"
            eyebrow="Backend Handbook"
            title="Mobilin Backend’i El Kitabı"
            desc="Mobil uygulamanın kullandığı servisleri, endpoint’leri, veri modellerini, event zincirlerini ve hata davranışlarını öğren."
            href="/engineering/mobile-knowledge/backend"
            badges={[
              { label: `${c.domainsTotal} domain`, tone: 'blue' },
              { label: `${c.endpoints} endpoint`, tone: 'teal' },
              { label: `${c.domainsStale} güncel değil`, tone: 'amber' },
            ]}
          />
          <InfoCard
            icon={Smartphone}
            tone="teal"
            eyebrow="Screen Manual"
            title="Ekran Ekran Mobil Kullanım Rehberi"
            desc="Her ekranın amacını, kullanıcı adımlarını, iş kurallarını, backend bağlantılarını ve hata senaryolarını incele."
            href="/engineering/mobile-knowledge/screens"
            badges={[
              { label: `${c.screensTotal} ekran`, tone: 'teal' },
              { label: `${c.screensDocumented} belgelendi`, tone: 'green' },
              { label: `${c.screensMissing} eksik`, tone: 'amber' },
            ]}
          />
        </CardGrid>
      </PageSection>

      <div className="grid gap-8 lg:grid-cols-2">
        <PageSection eyebrow="Aktivite" title="Recently Updated" tone="green">
          <RecentlyUpdated />
        </PageSection>
        <PageSection eyebrow="Bakım" title="Needs Attention" icon={BookOpen} tone="amber">
          <NeedsAttention />
        </PageSection>
      </div>

      <PageSection
        eyebrow="Kalite"
        title="Documentation Coverage"
        description="Dokümantasyonun yaşayan bir sistem olarak kapsamı."
        tone="blue"
      >
        <CoverageCards />
      </PageSection>
    </ProductPage>
  )
}
