'use client'

import {
  Boxes,
  Building2,
  Globe,
  Grid3x3,
  Layers,
  MapPin,
  Package,
  PackageCheck,
  PackageSearch,
  Route,
  Smartphone,
  Table2,
  Truck,
  Users,
} from 'lucide-react'
import {
  Callout,
  CardGrid,
  HeroCallout,
  InfoCard,
  PageSection,
  ProductPage,
  StatCard,
  StatGrid,
} from '@/components/product'
import { COUNTRIES, MODULES, TOTAL_FEATURES, supportedCount } from '@/data/product/nesy'

const moduleIcons = [PackageCheck, PackageSearch, Route, Truck, Globe, Boxes] as const
const moduleTones = ['orange', 'amber', 'teal', 'blue', 'purple', 'indigo'] as const

export default function ProductOverviewPage() {
  const activeCountries = COUNTRIES.filter((c) => c.id !== 'core')

  return (
    <ProductPage path="/product/overview">
      <HeroCallout
        icon={Smartphone}
        eyebrow="Nesy Mobile"
        tone="orange"
        title="Kurye operasyonunun sahadaki tek uygulaması."
        lead="Nesy Mobile; teslimat, toplama, tur/durak yönetimi, gönderi takibi ve akıllı dolap teslimatını tek mobil uygulamada toplayan bir kurye uygulamasıdır. Tek bir CORE altyapı üzerinde, her ülke kendi regülasyonuna ve operasyon modeline göre yapılandırılır — fork değil, konfigürasyon."
        chips={['Kurye Uygulaması', 'CORE + ülke konfigürasyonu', 'Balkanlar & Orta Avrupa']}
      >
        <StatGrid cols={2}>
          <StatCard label="Aktif Ülke" value={activeCountries.length} tone="orange" icon={MapPin} hint="CORE hariç ülke paketi" />
          <StatCard label="Feature" value={TOTAL_FEATURES} tone="amber" icon={Grid3x3} hint={`${MODULES.length} modülde`} />
        </StatGrid>
      </HeroCallout>

      <PageSection
        eyebrow="Modüller"
        title="Altı ürün modülü"
        icon={Layers}
        tone="orange"
        description="Uygulamanın tamamı altı modülden oluşur; her modülün ülke bazlı davranışı Country Matrix'te izlenir."
      >
        <CardGrid cols={3}>
          {MODULES.map((m, i) => (
            <InfoCard
              key={m.id}
              icon={moduleIcons[i % moduleIcons.length]!}
              tone={moduleTones[i % moduleTones.length]!}
              title={m.title}
              desc={m.desc}
              badges={[{ label: `${m.features.length} feature` }]}
              href="/product/feature-library"
            />
          ))}
        </CardGrid>
      </PageSection>

      <PageSection
        eyebrow="Ülke Kapsamı"
        title="Ülke bazında kapsam"
        icon={Globe}
        tone="orange"
        description="Her ülke paketi CORE'un bir alt kümesini + yerel farklılıkları (ödeme sağlayıcı, fiskalizasyon, event listesi) taşır."
      >
        <StatGrid cols={4}>
          {activeCountries.map((c) => (
            <StatCard
              key={c.id}
              label={`${c.name} · ${c.subtitle}`}
              value={supportedCount(c.id)}
              suffix={` / ${TOTAL_FEATURES}`}
              tone={c.status === 'Gelişmiş' ? 'purple' : c.status === 'Aktif' ? 'green' : 'gray'}
              icon={MapPin}
              hint={`${c.status} · ${c.price}`}
            />
          ))}
        </StatGrid>
      </PageSection>

      <PageSection
        eyebrow="Bu Alan"
        title="Product alanının haritası"
        icon={Package}
        tone="amber"
      >
        <CardGrid cols={3}>
          <InfoCard
            icon={Grid3x3}
            tone="teal"
            title="Feature Library"
            desc="Modül modül tüm yetenekler ve ülke kapsam sayıları."
            href="/product/feature-library"
          />
          <InfoCard
            icon={Table2}
            tone="indigo"
            title="Country Matrix"
            desc="Feature × ülke tam karşılaştırma matrisi — tek gerçek kaynak."
            href="/product/country-matrix"
          />
          <InfoCard
            icon={Building2}
            tone="orange"
            title="Country Profiles"
            desc="Ülke paketleri: fiyat, durum ve öne çıkan farklılıklar."
            href="/product/country-profiles"
          />
          <InfoCard
            icon={Users}
            tone="purple"
            title="Who We Serve"
            desc="Kurye, dispatcher, alıcı, gönderici ve backoffice profilleri."
            href="/product/who-we-serve"
          />
          <InfoCard
            icon={Route}
            tone="blue"
            title="User Journeys"
            desc="Teslimat, toplama, tur başlangıcı ve locker akışları adım adım."
            href="/product/user-journeys"
          />
          <InfoCard
            icon={Layers}
            tone="amber"
            title="Solution Overview"
            desc="Ürünün çözüm yaklaşımı: CORE + ülke konfigürasyonu modeli."
            href="/product/solution-overview"
          />
        </CardGrid>
      </PageSection>

      <Callout icon={Table2} title="Tek gerçek kaynak" tone="orange">
        Ülke bazlı davranış farklılıklarının tamamı <b>Country Matrix</b>&apos;te tutulur. Bir
        feature&apos;ın bir ülkedeki davranışı belirsizse önce matrise bakılır; matris ile saha
        davranışı çelişiyorsa bu bir üründür kaydıdır ve matris güncellenir.
      </Callout>
    </ProductPage>
  )
}
