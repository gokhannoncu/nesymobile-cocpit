'use client'

import {
  AlertTriangle,
  Banknote,
  CircleHelp,
  FileWarning,
  Globe,
  Layers,
  MapPin,
  Receipt,
  Route,
  Split,
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

export default function ProblemSpacePage() {
  return (
    <ProductPage path="/product/problem-space">
      <HeroCallout
        icon={CircleHelp}
        eyebrow="Product Foundation"
        tone="red"
        title="Çok ülkeli kurye operasyonu neden zor?"
        lead="Aynı kurye şirketi birden fazla ülkede çalıştığında her ülke farklı ödeme altyapısı, fiskal zorunluluk ve operasyon modeli dayatır. Ülke başına ayrı uygulama geliştirmek maliyeti patlatır; tek tip bir uygulama ise yerel regülasyona uymaz. Nesy Mobile'ın çözdüğü temel gerilim budur."
        chips={['Çok ülkeli operasyon', 'Regülasyon farklılıkları', 'Saha verimliliği']}
      >
        <StatGrid cols={2}>
          <StatCard label="Ülke Farklılığı Kaynağı" value={4} tone="red" icon={Split} hint="Ödeme, fiskal, atama, event listesi" />
          <StatCard label="Operasyon Modeli" value={2} tone="orange" icon={Route} hint="Otomatik vs. dispatcher-manuel" />
        </StatGrid>
      </HeroCallout>

      <PageSection
        eyebrow="Problem Alanları"
        title="Sahadaki beş temel problem"
        icon={AlertTriangle}
        tone="red"
        description="Her problem, Country Matrix'te gözlemlenen gerçek ülke farklılıklarından türetilmiştir."
      >
        <CardGrid cols={3}>
          <InfoCard
            icon={Banknote}
            tone="red"
            title="Parçalı ödeme altyapısı"
            desc="Kapıda tahsilat her ülkede farklı çalışır: Hırvatistan Raipay, Slovenya Softpos, Bosna ve Karadağ yalnızca nakit."
            bullets={[
              'Kurye her ülkede farklı cihaz/akış öğrenmek zorunda kalır',
              'COD/ExW/CPP tahsilat kuralları ülkeye göre değişir',
            ]}
          />
          <InfoCard
            icon={Receipt}
            tone="orange"
            title="Fiskalizasyon zorunlulukları"
            desc="Sırbistan'da teslimat ve toplamada fiskal fiş (VPFR) zorunlu; diğer ülkelerde hiç yok."
            bullets={[
              'Fiskal iptalde SSC gibi telafi akışları gerekir',
              'Uyumsuzluk doğrudan yasal risk üretir',
            ]}
          />
          <InfoCard
            icon={Users}
            tone="amber"
            title="Farklı atama modelleri"
            desc="CORE pickup görevlerini 3 dakikada bir otomatik atar; Hırvatistan, Sırbistan ve Bosna dispatcher ile manuel çalışır."
            bullets={[
              'Tek tip atama motoru her operasyona uymaz',
              'Gün sonu engelleme kuralları bile ülkeye göre değişir (PAC)',
            ]}
          />
          <InfoCard
            icon={FileWarning}
            tone="purple"
            title="Kanıt ve imza rejimleri"
            desc="Başarısız teslimat neden listeleri, zorunlu fotoğraf ve dijital imza kuralları ülke bazında farklılaşır."
            bullets={[
              'Bosna: fotoğraf çekilemez; Sırbistan: imza opsiyonel',
              'Kanıt eksikliği itiraz süreçlerini zorlaştırır',
            ]}
          />
          <InfoCard
            icon={MapPin}
            tone="blue"
            title="Alternatif teslim noktaları eşitsiz"
            desc="Parcelshop ve D4Me locker bazı ülkelerde tam entegre, bazılarında tamamen kapsam dışı."
            bullets={[
              'Ebranch self-servis seçenekleri ülkeye göre kırpılır',
              'Sırbistan D4Me için 14 haneli ID eşlemesi gibi yerel istisnalar',
            ]}
          />
          <InfoCard
            icon={Layers}
            tone="gray"
            title="Fork maliyeti"
            desc="Her ülke için ayrı uygulama sürümü, her yeni feature'ı N kez geliştirme ve test etme anlamına gelir."
            bullets={[
              'Sürümler arası davranış kayması (drift) kaçınılmaz olur',
              'Yeni ülke açılışı aylarca sürer',
            ]}
          />
        </CardGrid>
      </PageSection>

      <Callout icon={Globe} title="Problemin çerçevesi" tone="red">
        Problem &quot;kurye uygulaması yazmak&quot; değil; <b>tek bir üründe ülke başına doğru davranışı
        garanti etmek</b>tir. Çözüm yaklaşımı Solution Overview&apos;da, davranışların tek kaynağı
        Country Matrix&apos;te tanımlıdır.
      </Callout>
    </ProductPage>
  )
}
