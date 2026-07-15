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
        title="Kuryenin günü: beş temel flow."
        lead="Tour Start'tan Locker Delivery'ye, sahadaki her flow'un adımları ve ürettiği event'ler. Ülkeye göre değişen adımlar notlarla işaretlidir; kesin davranış Country Matrix'tedir."
        chips={['5 flow', 'Event-driven', 'Country notes']}
      />

      <PageSection eyebrow="Flows" title="End-to-End Journeys" icon={Truck} tone="orange">
        <SegmentTabs
          items={[
            {
              value: 'tour-start',
              label: 'Tour Start',
              icon: ScanLine,
              content: (
                <Timeline
                  items={[
                    {
                      period: 'Day start · Step 1',
                      title: 'Route Selection',
                      desc: 'Kurye uygulamada kendi rotasını seçer.',
                      icon: MapPin,
                      tone: 'blue',
                    },
                    {
                      period: 'Step 2',
                      title: 'Parcel Scan',
                      desc: 'Araca yüklenen tüm koliler barkodla okutulur.',
                      icon: ScanLine,
                      tone: 'blue',
                    },
                    {
                      period: 'Step 3',
                      title: 'Approval Request',
                      desc: 'Kurye tur başlangıç onayı ister; onay her durumda zorunludur.',
                      icon: Send,
                      tone: 'indigo',
                      bullets: ['HR & SI: ilk tur onayından sonra ek okutulan koliler otomatik onaylanır'],
                    },
                    {
                      period: 'During day',
                      title: 'Stop Management',
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
              label: 'Delivery',
              icon: PackageCheck,
              content: (
                <Timeline
                  items={[
                    {
                      period: 'At door · Step 1',
                      title: 'Stop Arrival & Receiver Verification',
                      desc: 'Alıcı adı CORE\'da ön-doludur ve düzenlenebilir (HR\'de ön-dolu gelmez).',
                      icon: DoorOpen,
                      tone: 'teal',
                    },
                    {
                      period: 'Step 2',
                      title: 'Collection (COD/ExW)',
                      desc: 'Nakit her ülkede; kart HR\'de Raipay, SI\'da Softpos ile. BA/ME yalnızca nakit.',
                      icon: Banknote,
                      tone: 'green',
                    },
                    {
                      period: 'Step 3',
                      title: 'Fiscalization (RS + CORE only)',
                      desc: 'VPFR tetiklenir, fiskal fiş kapıda yazdırılır; iptal durumunda SSC tetiklenir.',
                      icon: Receipt,
                      tone: 'purple',
                    },
                    {
                      period: 'Step 4',
                      title: 'Signature',
                      desc: 'CORE\'da dijital imza zorunlu; RS/BA/ME\'de opsiyonel. Fiziksel belge indirilebilir.',
                      icon: PenLine,
                      tone: 'indigo',
                    },
                    {
                      period: 'On success',
                      title: 'DELY — Task Closed',
                      desc: 'Teslimat event\'i üretilir, takip ekranı ve Ebranch güncellenir.',
                      icon: CheckCircle2,
                      tone: 'green',
                      status: 'done',
                    },
                    {
                      period: 'On failure',
                      title: 'Failed Reason + Photo',
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
              label: 'Pickup',
              icon: PackageSearch,
              content: (
                <Timeline
                  items={[
                    {
                      period: 'Assignment',
                      title: 'Task Assignment',
                      desc: 'CORE/SI/ME: her 3 dakikada otomatik job. HR/RS/BA: dispatcher manuel atar.',
                      icon: ClipboardList,
                      tone: 'blue',
                    },
                    {
                      period: 'In field',
                      title: 'Pickup & Collection (CPP)',
                      desc: 'Gönderici bilgileri uygulamada gösterilir (BA\'da alıcı bilgisi de). CPP tahsilatı yalnızca CORE/HR/RS\'de.',
                      icon: Banknote,
                      tone: 'green',
                    },
                    {
                      period: 'On failure',
                      title: 'Failed Reason Code',
                      desc: 'NOPC, NPNP, NRDY, NSYS, PABS, PADU, PTIM — RDOC görevlerde yalnızca NOPC.',
                      icon: Undo2,
                      tone: 'red',
                    },
                    {
                      period: 'Next day',
                      title: 'Auto Re-assignment',
                      desc: 'Belirli kodlardan sonra görev ertesi iş gününe otomatik taşınır; tetikleyici kod seti ülkeye göre değişir (BA/ME\'de yok).',
                      icon: Route,
                      tone: 'indigo',
                    },
                    {
                      period: 'End of day',
                      title: 'PAC Rule',
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
                      period: 'Step 1',
                      title: 'Pickup at Customer task oluşur',
                      desc: 'Sistemde henüz gönderi kaydı olmayan koli için görev açılır.',
                      icon: ClipboardList,
                      tone: 'blue',
                    },
                    {
                      period: 'Step 2',
                      title: 'Parcel Pickup',
                      desc: 'Red label koli mobil uygulama üzerinden teslim alınır.',
                      icon: PackageSearch,
                      tone: 'teal',
                    },
                    {
                      period: 'Step 3',
                      title: 'Npoint Drop-off',
                      desc: 'Koli dağıtım noktasında (Npoint) araçtan indirilir.',
                      icon: Boxes,
                      tone: 'indigo',
                    },
                    {
                      period: 'Step 4',
                      title: 'Shipment Creation',
                      desc: 'Koli için sistemde gönderi kaydı açılır.',
                      icon: Package,
                      tone: 'purple',
                    },
                    {
                      period: 'Step 5',
                      title: 'Backoffice Completion',
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
                      period: 'Reservation',
                      title: 'LCR Creation',
                      desc: 'Kurye Nesy Mobile\'dan ya da alıcı Ebranch\'tan (LCR + DDP) dolap rezervasyonu yapar; legacy ID D4Me\'ye gönderilir.',
                      icon: QrCode,
                      tone: 'blue',
                      bullets: ['RS: tam ID yerine Legacy ID\'nin ilk 14 hanesi kullanılır'],
                    },
                    {
                      period: 'Drop-off',
                      title: 'DEPT Event',
                      desc: 'Kurye koliyi dolaba bırakır; DEPT, D4MeCallback ile sisteme düşer.',
                      icon: Lock,
                      tone: 'teal',
                    },
                    {
                      period: 'Picked up on time',
                      title: 'DELY Callback',
                      desc: 'Alıcı koliyi süresinde alır; teslimat callback ile kapanır.',
                      icon: CheckCircle2,
                      tone: 'green',
                      status: 'done',
                    },
                    {
                      period: 'Not picked up',
                      title: 'Locker Pickup Task',
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

      <Callout icon={Info} title="Flows & Matrix" tone="orange">
        Buradaki adımlar anlatı düzeyindedir; bir adımın belirli bir ülkedeki kesin davranışı{' '}
        <b>Country Matrix</b>&apos;teki ilgili feature satırından okunur. Çelişki durumunda matris
        kazanır.
      </Callout>
    </ProductPage>
  )
}
