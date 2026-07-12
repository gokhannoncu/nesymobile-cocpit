'use client'

import {
  Camera,
  Compass,
  Layers,
  ShieldCheck,
  Smartphone,
  Table2,
  Zap,
} from 'lucide-react'
import {
  Callout,
  CardGrid,
  HeroCallout,
  PageSection,
  PrincipleCard,
  ProductPage,
} from '@/components/product'

export default function ProductPrinciplesPage() {
  return (
    <ProductPage path="/product/product-principles">
      <HeroCallout
        icon={Compass}
        eyebrow="Product Foundation"
        tone="orange"
        title="Ürün kararlarının pusulası."
        lead="Bir feature isteği geldiğinde bu beş prensiple test edilir. Prensiple çelişen istek ya reddedilir ya da prensibi bilinçli olarak revize eden bir karar kaydıyla ilerler."
        chips={['5 prensip', 'Karar filtresi']}
      />

      <PageSection eyebrow="Prensipler" title="Beş ürün prensibi" icon={Compass} tone="purple">
        <CardGrid cols={2}>
          <PrincipleCard
            num={1}
            icon={Table2}
            tone="teal"
            title="Konfigürasyon fork'a yener"
            why="Ülke başına kod dalı, davranış kayması ve N kat bakım maliyeti üretir."
            inPractice="Yeni ülke davranışı önce Country Matrix'e yazılır; kod yalnızca konfigürasyon anahtarı ekler."
            violation="'Sırbistan için ayrı APK çıkaralım, orada işler farklı' — farklılık matrise işlenmeden dallanma."
          />
          <PrincipleCard
            num={2}
            icon={Smartphone}
            tone="blue"
            title="Kuryenin günü kutsaldır"
            why="Uygulamanın kullanıcısı masa başında değil, kapıda ve yağmurda çalışır."
            inPractice="Her akış tek elle, minimum dokunuşla ve kesintiye dayanıklı tasarlanır; gün sonunu keyfî engelleyen kural eklenmez."
            violation="Teslimat onayına, sahada değeri olmayan üç zorunlu form alanı eklemek."
          />
          <PrincipleCard
            num={3}
            icon={ShieldCheck}
            tone="green"
            title="Regülasyon varsayılan olarak doğru"
            why="Fiskalizasyon ve kanıt kuralları yasal yükümlülüktür; kurye inisiyatifine bırakılamaz."
            inPractice="Zorunlu ülkede fiskal fiş atlanamaz; imza/fotoğraf kuralı ülke paketinden gelir, kullanıcı ayarından değil."
            violation="'Fiş yazıcısı bozuksa teslimatı yine de kapatabilsin' — telafi akışı (SSC) yerine kuralı delmek."
          />
          <PrincipleCard
            num={4}
            icon={Zap}
            tone="orange"
            title="Event üret, durum sakla(t)ma"
            why="Operasyonun gerçeği event zinciridir (DEPT, DELY, RETS…); ekranlar bu zincirden türetilir."
            inPractice="Her saha aksiyonu bir event üretir; entegrasyonlar (D4Me, Ebranch) event/callback ile konuşur."
            violation="Bir modülün, event üretmeden kendi lokal durumunu 'tek gerçek' sayması."
          />
          <PrincipleCard
            num={5}
            icon={Camera}
            tone="red"
            title="Kanıt olmadan kapanış olmaz"
            why="Başarısız teslimat ve tahsilat itirazları ancak kanıtla savunulur."
            inPractice="Failed-reason + (ülke kuralına göre) fotoğraf/imza olmadan görev kapanmaz; kanıt gereksinimleri matriste tanımlıdır."
            violation="Ülke kuralı 'fotoğraf zorunlu' derken akışa 'atla' butonu eklemek."
          />
        </CardGrid>
      </PageSection>

      <Callout icon={Layers} title="Prensipler nasıl güncellenir?" tone="orange">
        Prensip değişikliği bir ürün kararıdır: gerekçesiyle birlikte karar kaydına işlenir ve bu
        sayfa güncellenir. Prensiple çelişen ama kabul edilen her istisna, ilgili karar kaydına
        bağlanır.
      </Callout>
    </ProductPage>
  )
}
