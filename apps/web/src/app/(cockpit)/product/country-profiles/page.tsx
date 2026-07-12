'use client'

import { Building2, CreditCard, Globe, Info, MapPin, Receipt, Zap } from 'lucide-react'
import {
  Callout,
  CardGrid,
  ComparisonTable,
  HeroCallout,
  InfoCard,
  PageSection,
  ProductPage,
  type Tone,
} from '@/components/product'
import { COUNTRIES, TOTAL_FEATURES, supportedCount } from '@/data/product/nesy'

const statusTone: Record<string, Tone> = {
  Küresel: 'indigo',
  Aktif: 'green',
  Gelişmiş: 'purple',
  Kısıtlı: 'gray',
}

// Ülke paketlerinin öne çıkan farklılıkları — matristen türetilmiş özet.
const highlights: Record<string, string[]> = {
  core: [
    'Tüm feature setinin varsayılan davranışı',
    'Nakit + kredi kartı tahsilat, VPFR fiskalizasyon',
    'Otomatik pickup ataması (3 dakikada bir job)',
  ],
  hr: [
    'Kredi kartı tahsilatı Raipay üzerinden',
    'Fiskalizasyon yok; pickup ataması dispatcher ile manuel',
    'İlk tur sonrası ek koliler otomatik onaylanır',
  ],
  si: [
    'Kredi kartı tahsilatı Softpos üzerinden',
    'CPP ve Red Label kapsam dışı; sınırlı failed-reason listesi',
    'Aksiyonsuz PAC görevi gün sonunu engellemez',
  ],
  rs: [
    'Fiskalizasyon (VPFR) CORE ile aynı — en geniş kapsam',
    'Softpos entegrasyonu yolda; dijital imza opsiyonel',
    'D4Me entegrasyonu 14 haneli Legacy ID eşlemesiyle',
  ],
  ba: [
    'Yalnızca nakit tahsilat; fotoğraf kanıtı çekilemez',
    'Parcelshop / locker teslimatı kapsam dışı',
    'Event listesinde ek PICK event’i',
  ],
  me: [
    'Yalnızca nakit tahsilat; Red Label kapsam dışı',
    'Parcelshop / locker teslimatı kapsam dışı',
    'Event listesinde ek RETS (Return to Sender) event’i',
  ],
  sk: [
    'Devreye alınma aşamasında — davranışlar henüz tanımlanmadı',
    'Feature seti Country Matrix üzerinden tanımlanacak',
  ],
}

export default function CountryProfilesPage() {
  return (
    <ProductPage path="/product/country-profiles">
      <HeroCallout
        icon={Globe}
        eyebrow="Capabilities & Countries"
        tone="orange"
        title="Ülke paketleri: aynı çekirdek, yerel davranış."
        lead="Her ülke, CORE altyapısının üzerine kendi ödeme sağlayıcısını, fiskalizasyon kuralını ve operasyon modelini koyar. Bu sayfa paketlerin ticari ve operasyonel özetidir."
        chips={['CORE + 6 ülke', 'Balkanlar & Orta Avrupa']}
      />

      <PageSection
        eyebrow="Paketler"
        title="Ülke paketleri"
        icon={MapPin}
        tone="orange"
        description="Kapsam sayısı, o ülkede aktif (kapsam dışı ve tanımsız olmayan) feature sayısıdır."
      >
        <CardGrid cols={3}>
          {COUNTRIES.map((c) => (
            <InfoCard
              key={c.id}
              icon={c.id === 'core' ? Building2 : MapPin}
              tone={statusTone[c.status] ?? 'gray'}
              eyebrow={c.status}
              title={`${c.name} — ${c.subtitle}`}
              desc={`${c.price} · ${supportedCount(c.id)}/${TOTAL_FEATURES} feature aktif${c.isPopular ? ' · En yaygın paket' : ''}`}
              bullets={highlights[c.id]}
              href="/product/country-matrix"
            />
          ))}
        </CardGrid>
      </PageSection>

      <PageSection
        eyebrow="Yerel Farklılıklar"
        title="Ödeme ve fiskalizasyon özeti"
        icon={CreditCard}
        tone="purple"
        description="Ülke davranış farklılıklarının en sık kaynağı: tahsilat sağlayıcısı ve fiskal zorunluluklar."
      >
        <ComparisonTable
          headers={[
            { label: 'Ülke' },
            { label: 'Nakit', tone: 'green' },
            { label: 'Kredi Kartı', tone: 'blue' },
            { label: 'Fiskalizasyon', tone: 'purple' },
          ]}
          rows={[
            ['CORE', 'Var', 'Var', 'VPFR — teslimat ve CPP toplamada'],
            ['Scale HR · Hırvatistan', 'Var', 'Raipay', 'Yok'],
            ['Scale SI · Slovenya', 'Var', 'Softpos', 'Yok'],
            ['Scale Plus RS · Sırbistan', 'Var', 'Softpos (entegre edilecek)', 'VPFR — CORE ile aynı'],
            ['Start BA · Bosna', 'Var', 'Yok', 'Yok'],
            ['Start ME · Karadağ', 'Var', 'Yok', 'Yok'],
            ['Scale SK · Slovakya', '—', '—', '—'],
          ]}
          highlightCol={0}
        />
      </PageSection>

      <Callout icon={Zap} title="Yeni ülke açılışı" tone="orange">
        Yeni bir ülke, önce Country Matrix&apos;te bir sütun olarak tanımlanır (Scale SK örneğindeki
        gibi). Davranışlar feature feature netleştikçe matris doldurulur; paket ancak matris
        tamamlandığında &quot;Aktif&quot; statüsüne geçer.
      </Callout>

      <Callout icon={Receipt} title="Fiyatlandırma notu" tone="gray">
        <span className="inline-flex items-center gap-1">
          <Info className="size-3.5" /> Paket fiyatları aylık abonelik referans değerleridir; sözleşme
          bazlı değişebilir. Ticari detaylar Business &amp; Growth alanında izlenir.
        </span>
      </Callout>
    </ProductPage>
  )
}
