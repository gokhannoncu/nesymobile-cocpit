'use client'

import {
  Boxes,
  Globe,
  Layers,
  Lightbulb,
  PackageCheck,
  PackageSearch,
  Route,
  Settings2,
  Smartphone,
  Truck,
} from 'lucide-react'
import {
  Callout,
  CardGrid,
  DoesDontGrid,
  HeroCallout,
  InfoCard,
  PageSection,
  ProductPage,
} from '@/components/product'
import { MODULES } from '@/data/product/nesy'

const moduleIcons = [PackageCheck, PackageSearch, Route, Truck, Globe, Boxes] as const
const moduleTones = ['orange', 'amber', 'teal', 'blue', 'purple', 'indigo'] as const

export default function SolutionOverviewPage() {
  return (
    <ProductPage path="/product/solution-overview">
      <HeroCallout
        icon={Lightbulb}
        eyebrow="Product Foundation"
        tone="orange"
        title="Tek CORE, ülke başına konfigürasyon."
        lead="Nesy Mobile'ın çözüm modeli: tüm kurye akışları tek bir CORE üründe yaşar; ülkeler fork almaz, davranışı konfigürasyonla değiştirir. Ödeme sağlayıcısı, fiskalizasyon, atama modeli ve event listesi ülke paketi düzeyinde belirlenir."
        chips={['CORE + konfigürasyon', 'Fork yok', 'Tek kod tabanı']}
      />

      <PageSection
        eyebrow="Çözüm Modeli"
        title="Üç katmanlı yaklaşım"
        icon={Layers}
        tone="orange"
      >
        <CardGrid cols={3}>
          <InfoCard
            icon={Smartphone}
            tone="teal"
            eyebrow="Katman 1"
            title="CORE akışları"
            desc="Teslimat, toplama, tur/durak, takip, Ebranch ve D4Me — tüm ülkelerin paylaştığı varsayılan davranış."
          />
          <InfoCard
            icon={Settings2}
            tone="indigo"
            eyebrow="Katman 2"
            title="Ülke konfigürasyonu"
            desc="Ödeme sağlayıcısı (Raipay/Softpos), fiskalizasyon (VPFR), atama modeli, failed-reason listeleri ve event setleri ülke paketiyle açılıp kapanır."
          />
          <InfoCard
            icon={Globe}
            tone="orange"
            eyebrow="Katman 3"
            title="Yerel istisnalar"
            desc="Konfigürasyonla çözülemeyen tekil davranışlar (ör. Sırbistan D4Me 14 haneli ID eşlemesi) matris kaydıyla izlenen istisnalardır."
          />
        </CardGrid>
      </PageSection>

      <PageSection
        eyebrow="Kapsam"
        title="Altı modül"
        icon={Boxes}
        tone="blue"
        description="Modüllerin feature detayı Feature Library'de, ülke davranışları Country Matrix'tedir."
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

      <PageSection eyebrow="Sınırlar" title="Ürün ne yapar, ne yapmaz?" icon={Lightbulb} tone="green">
        <DoesDontGrid
          doesTitle="Nesy Mobile Ne Yapar?"
          dontTitle="Nesy Mobile Ne Yapmaz?"
          does={[
            'Kuryenin gün başından gün sonuna tüm saha akışını yönetir',
            'Kapıda ve toplama noktasında tahsilat (nakit + kart) alır',
            'Zorunlu ülkelerde fiskal fiş üretir ve yazdırır',
            'Durak birleştirme ve tur onayını kurallarla otomatikleştirir',
            'D4Me locker ve parcelshop teslimatını uçtan uca entegre eder',
          ]}
          dont={[
            'Rota optimizasyonu motoru değildir (rota, dispatch sisteminden gelir)',
            'Backoffice/faturalama sistemi değildir — event üretir, muhasebe yapmaz',
            'Son kullanıcı (alıcı) uygulaması değildir; alıcı tarafı Ebranch linkidir',
            'Ülke regülasyonunu yorumlamaz — davranış matriste önceden tanımlanır',
          ]}
        />
      </PageSection>

      <Callout icon={Settings2} title="Neden konfigürasyon, neden fork değil?" tone="orange">
        Yeni bir feature CORE&apos;a bir kez yazılır ve tüm ülkelere aynı sürümle dağıtılır; ülke
        farklılığı kod dalı değil, matris satırıdır. Bu model yeni ülke açılışını &quot;kod projesi&quot;
        olmaktan çıkarıp &quot;konfigürasyon + doğrulama&quot; işine dönüştürür (bkz. Scale SK süreci).
      </Callout>
    </ProductPage>
  )
}
