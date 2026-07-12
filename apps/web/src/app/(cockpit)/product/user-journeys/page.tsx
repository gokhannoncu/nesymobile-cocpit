'use client'

import {
  Banknote,
  Boxes,
  Camera,
  CheckCircle2,
  ClipboardList,
  DoorOpen,
  Info,
  Lock,
  MapPin,
  Package,
  PackageCheck,
  PackageSearch,
  PenLine,
  QrCode,
  Receipt,
  Route,
  ScanLine,
  Send,
  Truck,
  Undo2,
} from 'lucide-react'
import {
  Callout,
  HeroCallout,
  PageSection,
  ProductPage,
  SegmentTabs,
  Timeline,
} from '@/components/product'

export default function UserJourneysPage() {
  return (
    <ProductPage path="/product/user-journeys">
      <HeroCallout
        icon={Route}
        eyebrow="Users & Experience"
        tone="orange"
        title="Kuryenin günü: beş temel akış."
        lead="Tur başlangıcından locker teslimatına, sahadaki her akışın adımları ve ürettiği event'ler. Ülkeye göre değişen adımlar notlarla işaretlidir; kesin davranış Country Matrix'tedir."
        chips={['5 akış', 'Event tabanlı', 'Ülke notlarıyla']}
      />

      <PageSection eyebrow="Akışlar" title="Uçtan uca yolculuklar" icon={Truck} tone="orange">
        <SegmentTabs
          items={[
            {
              value: 'tour-start',
              label: 'Tur Başlangıcı',
              icon: ScanLine,
              content: (
                <Timeline
                  items={[
                    {
                      period: 'Gün başı · Adım 1',
                      title: 'Rota seçimi',
                      desc: 'Kurye uygulamada kendi rotasını seçer.',
                      icon: MapPin,
                      tone: 'blue',
                    },
                    {
                      period: 'Adım 2',
                      title: 'Koli okutma',
                      desc: 'Araca yüklenen tüm koliler barkodla okutulur.',
                      icon: ScanLine,
                      tone: 'blue',
                    },
                    {
                      period: 'Adım 3',
                      title: 'Onay talebi',
                      desc: 'Kurye tur başlangıç onayı ister; onay her durumda zorunludur.',
                      icon: Send,
                      tone: 'indigo',
                      bullets: ['HR & SI: ilk tur onayından sonra ek okutulan koliler otomatik onaylanır'],
                    },
                    {
                      period: 'Gün içi',
                      title: 'Durak yönetimi',
                      desc: 'Aynı ad+adres otomatik birleşir; onay öncesi kurye durakları manuel de birleştirebilir.',
                      icon: Boxes,
                      tone: 'teal',
                      bullets: [
                        'Alıcı adı+adres aynı → teslimat durakları birleşir',
                        'Gönderici adı+adres aynı → toplama durakları birleşir',
                        'Onay sonrası yeni gönderiler yeni durak olarak eklenir',
                      ],
                    },
                  ]}
                />
              ),
            },
            {
              value: 'delivery',
              label: 'Teslimat',
              icon: PackageCheck,
              content: (
                <Timeline
                  items={[
                    {
                      period: 'Kapıda · Adım 1',
                      title: 'Durağa varış ve alıcı doğrulama',
                      desc: 'Alıcı adı CORE\'da ön-doludur ve düzenlenebilir (HR\'de ön-dolu gelmez).',
                      icon: DoorOpen,
                      tone: 'teal',
                    },
                    {
                      period: 'Adım 2',
                      title: 'Tahsilat (COD/ExW)',
                      desc: 'Nakit her ülkede; kart HR\'de Raipay, SI\'da Softpos ile. BA/ME yalnızca nakit.',
                      icon: Banknote,
                      tone: 'green',
                    },
                    {
                      period: 'Adım 3',
                      title: 'Fiskalizasyon (yalnızca RS + CORE)',
                      desc: 'VPFR tetiklenir, fiskal fiş kapıda yazdırılır; iptal durumunda SSC tetiklenir.',
                      icon: Receipt,
                      tone: 'purple',
                    },
                    {
                      period: 'Adım 4',
                      title: 'İmza',
                      desc: 'CORE\'da dijital imza zorunlu; RS/BA/ME\'de opsiyonel. Fiziksel belge indirilebilir.',
                      icon: PenLine,
                      tone: 'indigo',
                    },
                    {
                      period: 'Başarılıysa',
                      title: 'DELY — görev kapanır',
                      desc: 'Teslimat event\'i üretilir, takip ekranı ve Ebranch güncellenir.',
                      icon: CheckCircle2,
                      tone: 'green',
                      status: 'done',
                    },
                    {
                      period: 'Başarısızsa',
                      title: 'Failed reason + fotoğraf',
                      desc: 'Neden listeden seçilir; bazı durumlarda fotoğraf zorunludur (BA\'da fotoğraf çekilemez, RS/ME\'de opsiyonel).',
                      icon: Camera,
                      tone: 'red',
                    },
                  ]}
                />
              ),
            },
            {
              value: 'pickup',
              label: 'Toplama',
              icon: PackageSearch,
              content: (
                <Timeline
                  items={[
                    {
                      period: 'Atama',
                      title: 'Görev kuryeye düşer',
                      desc: 'CORE/SI/ME: her 3 dakikada otomatik job. HR/RS/BA: dispatcher manuel atar.',
                      icon: ClipboardList,
                      tone: 'blue',
                    },
                    {
                      period: 'Sahada',
                      title: 'Toplama ve tahsilat (CPP)',
                      desc: 'Gönderici bilgileri uygulamada gösterilir (BA\'da alıcı bilgisi de). CPP tahsilatı yalnızca CORE/HR/RS\'de.',
                      icon: Banknote,
                      tone: 'green',
                    },
                    {
                      period: 'Başarısızsa',
                      title: 'Failed reason kodu',
                      desc: 'NOPC, NPNP, NRDY, NSYS, PABS, PADU, PTIM — RDOC görevlerde yalnızca NOPC.',
                      icon: Undo2,
                      tone: 'red',
                    },
                    {
                      period: 'Ertesi gün',
                      title: 'Otomatik yeniden atama',
                      desc: 'Belirli kodlardan sonra görev ertesi iş gününe otomatik taşınır; tetikleyici kod seti ülkeye göre değişir (BA/ME\'de yok).',
                      icon: Route,
                      tone: 'indigo',
                    },
                    {
                      period: 'Gün sonu',
                      title: 'PAC kuralı',
                      desc: 'Aksiyonsuz "pickup at customer" görevi gün sonunu engeller (SI hariç).',
                      icon: CheckCircle2,
                      tone: 'amber',
                    },
                  ]}
                />
              ),
            },
            {
              value: 'red-label',
              label: 'Red Label',
              icon: Package,
              content: (
                <Timeline
                  items={[
                    {
                      period: 'Adım 1',
                      title: 'Pickup at customer görevi oluşur',
                      desc: 'Sistemde henüz gönderi kaydı olmayan koli için görev açılır.',
                      icon: ClipboardList,
                      tone: 'blue',
                    },
                    {
                      period: 'Adım 2',
                      title: 'Kurye koliyi toplar',
                      desc: 'Red label koli mobil uygulama üzerinden teslim alınır.',
                      icon: PackageSearch,
                      tone: 'teal',
                    },
                    {
                      period: 'Adım 3',
                      title: 'Npoint\'te indirme',
                      desc: 'Koli dağıtım noktasında (Npoint) araçtan indirilir.',
                      icon: Boxes,
                      tone: 'indigo',
                    },
                    {
                      period: 'Adım 4',
                      title: 'Gönderi oluşturulur',
                      desc: 'Koli için sistemde gönderi kaydı açılır.',
                      icon: Package,
                      tone: 'purple',
                    },
                    {
                      period: 'Adım 5',
                      title: 'Backoffice tamamlar',
                      desc: 'Eksik veri backoffice tarafından tamamlanır. Akış SI ve ME\'de kapsam dışıdır.',
                      icon: CheckCircle2,
                      tone: 'green',
                      status: 'done',
                    },
                  ]}
                />
              ),
            },
            {
              value: 'd4me',
              label: 'D4Me Locker',
              icon: Lock,
              content: (
                <Timeline
                  items={[
                    {
                      period: 'Rezervasyon',
                      title: 'LCR oluşturulur',
                      desc: 'Kurye Nesy Mobile\'dan ya da alıcı Ebranch\'tan (LCR + DDP) dolap rezervasyonu yapar; legacy ID D4Me\'ye gönderilir.',
                      icon: QrCode,
                      tone: 'blue',
                      bullets: ['RS: tam ID yerine Legacy ID\'nin ilk 14 hanesi kullanılır'],
                    },
                    {
                      period: 'Bırakma',
                      title: 'DEPT event\'i',
                      desc: 'Kurye koliyi dolaba bırakır; DEPT, D4MeCallback ile sisteme düşer.',
                      icon: Lock,
                      tone: 'teal',
                    },
                    {
                      period: 'Zamanında alınırsa',
                      title: 'DELY callback',
                      desc: 'Alıcı koliyi süresinde alır; teslimat callback ile kapanır.',
                      icon: CheckCircle2,
                      tone: 'green',
                      status: 'done',
                    },
                    {
                      period: 'Alınmazsa',
                      title: 'Locker Pickup görevi',
                      desc: 'Süresi dolan koli için toplama görevi oluşur; kurye alırsa COPT event\'i atanır.',
                      icon: Undo2,
                      tone: 'orange',
                    },
                  ]}
                />
              ),
            },
          ]}
        />
      </PageSection>

      <Callout icon={Info} title="Akışlar ve matris" tone="orange">
        Buradaki adımlar anlatı düzeyindedir; bir adımın belirli bir ülkedeki kesin davranışı{' '}
        <b>Country Matrix</b>&apos;teki ilgili feature satırından okunur. Çelişki durumunda matris
        kazanır.
      </Callout>
    </ProductPage>
  )
}
