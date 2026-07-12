'use client'

import {
  Boxes,
  Globe,
  Grid3x3,
  PackageCheck,
  PackageSearch,
  Route,
  Truck,
} from 'lucide-react'
import {
  Callout,
  CardGrid,
  HeroCallout,
  InfoCard,
  PageSection,
  ProductPage,
} from '@/components/product'
import { COUNTRIES, MODULES, TOTAL_FEATURES, isSupported } from '@/data/product/nesy'

const moduleIcons = [PackageCheck, PackageSearch, Route, Truck, Globe, Boxes] as const
const moduleTones = ['orange', 'amber', 'teal', 'blue', 'purple', 'indigo'] as const

export default function FeatureLibraryPage() {
  const activeCountries = COUNTRIES.filter((c) => c.id !== 'core')

  return (
    <ProductPage path="/product/feature-library">
      <HeroCallout
        icon={Grid3x3}
        eyebrow="Capabilities & Countries"
        tone="orange"
        title="Nesy Mobile'ın tüm yetenekleri, modül modül."
        lead="Her kart bir feature'ı ve kaç ülkede aktif olduğunu gösterir. Ülke bazlı davranış detayı için Country Matrix'e gidin."
        chips={[`${TOTAL_FEATURES} feature`, `${MODULES.length} modül`]}
      />

      {MODULES.map((m, mi) => (
        <PageSection
          key={m.id}
          eyebrow={`Modül ${mi + 1}`}
          title={m.title}
          description={m.desc}
          icon={moduleIcons[mi % moduleIcons.length]}
          tone={moduleTones[mi % moduleTones.length]}
        >
          <CardGrid cols={3}>
            {m.features.map((f) => {
              const count = activeCountries.filter((c) => isSupported(f.values[c.id])).length
              return (
                <InfoCard
                  key={f.id}
                  icon={moduleIcons[mi % moduleIcons.length]!}
                  tone={moduleTones[mi % moduleTones.length]!}
                  title={f.title}
                  desc={f.desc}
                  badges={[
                    { label: `CORE: ${isSupported(f.values.core) ? 'var' : 'yok'}` },
                    { label: `${count}/${activeCountries.length} ülkede aktif` },
                  ]}
                  href="/product/country-matrix"
                />
              )
            })}
          </CardGrid>
        </PageSection>
      ))}

      <Callout icon={Grid3x3} title="Yeni feature eklerken" tone="orange">
        Feature önce CORE davranışıyla tanımlanır, sonra ülke farklılıkları matrise işlenir. Kaynak
        dosya: <code>src/data/product/nesy.ts</code> — kart ve matris sayfaları otomatik güncellenir.
      </Callout>
    </ProductPage>
  )
}
