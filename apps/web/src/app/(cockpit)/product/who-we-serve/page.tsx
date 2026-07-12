'use client'

import {
  Building2,
  ClipboardList,
  Headset,
  Link2,
  MapPin,
  Package,
  Route,
  Smartphone,
  Truck,
  UserRound,
  Users,
} from 'lucide-react'
import {
  Callout,
  CardGrid,
  HeroCallout,
  InfoCard,
  PageSection,
  ProductPage,
  SegmentTabs,
} from '@/components/product'

export default function WhoWeServePage() {
  return (
    <ProductPage path="/product/who-we-serve">
      <HeroCallout
        icon={Users}
        eyebrow="Users & Experience"
        tone="orange"
        title="Uygulamayı kim kullanır, kim etkilenir?"
        lead="Nesy Mobile'ın birincil kullanıcısı kuryedir. Dispatcher ve backoffice sistem üzerinden operasyonu yönetir; alıcı ve gönderici uygulamayı hiç görmez ama her akışın çıktısını yaşar."
        chips={['1 birincil kullanıcı', '2 operasyon rolü', '2 dolaylı taraf']}
      />

      <PageSection eyebrow="Roller" title="Beş rol, tek akış" icon={Users} tone="blue">
        <SegmentTabs
          items={[
            {
              value: 'courier',
              label: 'Kurye',
              icon: Truck,
              content: (
                <CardGrid cols={3}>
                  <InfoCard
                    icon={Smartphone}
                    tone="teal"
                    eyebrow="Birincil kullanıcı"
                    title="Uygulamanın sahibi"
                    desc="Günün tamamını uygulamada geçirir: tur başlatır, koli okutur, teslim eder, toplar, tahsilat yapar."
                    bullets={[
                      'Tur başlangıcında rota seçer ve kolileri okutur',
                      'Teslimat/toplama görevlerini kapatır, kanıt üretir',
                      'COD/ExW/CPP tahsilatı ve (Sırbistan) fiskal fiş',
                    ]}
                  />
                  <InfoCard
                    icon={Route}
                    tone="blue"
                    eyebrow="İhtiyaç"
                    title="Hız ve kesintisizlik"
                    desc="Kapıda geçen her saniye maliyettir; akışlar tek elle ve minimum adımla tasarlanır."
                    bullets={[
                      'Durak birleştirme ile aynı adrese tek uğrama',
                      'Başarısız teslimatta hızlı neden seçimi',
                    ]}
                  />
                  <InfoCard
                    icon={MapPin}
                    tone="orange"
                    eyebrow="Ülke farkı"
                    title="Ülkeye göre değişen gün"
                    desc="Aynı rol, ülkeye göre farklı kurallarla çalışır: Bosna'da fotoğraf çekilemez, Sırbistan'da fiş yazdırılır."
                  />
                </CardGrid>
              ),
            },
            {
              value: 'dispatcher',
              label: 'Dispatcher',
              icon: Headset,
              content: (
                <CardGrid cols={3}>
                  <InfoCard
                    icon={ClipboardList}
                    tone="indigo"
                    eyebrow="Operasyon rolü"
                    title="Görev dağıtıcı"
                    desc="Manuel atama modelindeki ülkelerde (HR, RS, BA) pickup görevlerini kuryelere dağıtır."
                    bullets={[
                      'Tur başlangıç onaylarını verir',
                      'Gün içi yeni görevleri dengeler',
                    ]}
                  />
                  <InfoCard
                    icon={Route}
                    tone="blue"
                    eyebrow="İhtiyaç"
                    title="Görünürlük"
                    desc="Hangi kuryenin nerede olduğunu ve hangi görevin beklediğini anlık görmek ister."
                  />
                  <InfoCard
                    icon={MapPin}
                    tone="orange"
                    eyebrow="Ülke farkı"
                    title="Otomatik ülkelerde pasif"
                    desc="CORE/SI/ME otomatik atama kullanır; dispatcher yalnızca istisna yönetir."
                  />
                </CardGrid>
              ),
            },
            {
              value: 'backoffice',
              label: 'Backoffice',
              icon: Building2,
              content: (
                <CardGrid cols={3}>
                  <InfoCard
                    icon={Package}
                    tone="purple"
                    eyebrow="Operasyon rolü"
                    title="Veri tamamlayıcı"
                    desc="Red Label akışında sahada oluşturulan gönderilerin eksik verisini tamamlar."
                    bullets={[
                      'Event zincirinden operasyon raporları üretir',
                      'Tahsilat mutabakatını (Cashdesk) yürütür',
                    ]}
                  />
                  <InfoCard
                    icon={Link2}
                    tone="blue"
                    eyebrow="İhtiyaç"
                    title="Temiz event verisi"
                    desc="Uygulamanın ürettiği her event (DELY, RETS, DEPT…) backoffice süreçlerinin girdisidir."
                  />
                  <InfoCard
                    icon={MapPin}
                    tone="orange"
                    eyebrow="Ülke farkı"
                    title="Fiskal mutabakat"
                    desc="Sırbistan'da fiskal fiş kayıtları ek mutabakat yükü getirir; HR/SI'da kart tahsilatı Cashdesk'te ayrı kalemdir."
                  />
                </CardGrid>
              ),
            },
            {
              value: 'consignee',
              label: 'Alıcı',
              icon: UserRound,
              content: (
                <CardGrid cols={3}>
                  <InfoCard
                    icon={Link2}
                    tone="green"
                    eyebrow="Dolaylı taraf"
                    title="Ebranch kullanıcısı"
                    desc="Uygulamayı görmez; takip linki (Ebranch) üzerinden teslimatı yönetir."
                    bullets={[
                      'Teslim noktası değiştirir (parcelshop, D4Me locker)',
                      'Tarih/adres değiştirir, "Pay with Link" ile öder',
                    ]}
                  />
                  <InfoCard
                    icon={MapPin}
                    tone="orange"
                    eyebrow="Ülke farkı"
                    title="Seçenekler ülkeye göre kırpılır"
                    desc="SI'da 'şubeden al' ve 'reddet' görünmez; RS/BA/ME'de Ebranch seçenekleri kapsam dışıdır."
                  />
                  <InfoCard
                    icon={Package}
                    tone="teal"
                    eyebrow="Deneyim"
                    title="Kapıdaki muhatap"
                    desc="İmza, ödeme ve kimlik doğrulama deneyimi kuryenin uygulama akışıyla belirlenir."
                  />
                </CardGrid>
              ),
            },
            {
              value: 'shipper',
              label: 'Gönderici',
              icon: Package,
              content: (
                <CardGrid cols={3}>
                  <InfoCard
                    icon={Package}
                    tone="amber"
                    eyebrow="Dolaylı taraf"
                    title="Toplama müşterisi"
                    desc="Pickup ve Red Label akışlarının başlangıç noktası; ExW/CPP tahsilatının muhatabı."
                    bullets={[
                      'Remote pickup\'ta bilgileri kuryeye gösterilir',
                      'Başarısız toplama nedenleri (NRDY, PABS…) onun süreçlerini etkiler',
                    ]}
                  />
                  <InfoCard
                    icon={Route}
                    tone="blue"
                    eyebrow="İhtiyaç"
                    title="Öngörülebilir toplama"
                    desc="Başarısız toplamada ertesi iş gününe otomatik yeniden atama, gönderici deneyiminin sigortasıdır."
                  />
                  <InfoCard
                    icon={MapPin}
                    tone="orange"
                    eyebrow="Ülke farkı"
                    title="Yeniden atama kuralları"
                    desc="Otomatik yeniden atama tetikleyicileri ülkeye göre farklı kod setleriyle çalışır; BA/ME'de yoktur."
                  />
                </CardGrid>
              ),
            },
          ]}
        />
      </PageSection>

      <Callout icon={Truck} title="Tasarım önceliği" tone="orange">
        Roller çakıştığında öncelik sırası: <b>kurye &gt; dispatcher &gt; backoffice</b>. Alıcı ve
        gönderici deneyimi, kurye akışının çıktısı olarak tasarlanır — kuryeyi yavaşlatarak alıcı
        deneyimi &quot;iyileştirilmez&quot;.
      </Callout>
    </ProductPage>
  )
}
