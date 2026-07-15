'use client'

import {
  Banknote,
  Boxes,
  CheckCircle2,
  ClipboardList,
  DoorOpen,
  Footprints,
  Info,
  Lightbulb,
  LineChart,
  Lock,
  Map,
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
  ShieldCheck,
  Undo2,
  type LucideIcon,
} from 'lucide-react'
import {
  Callout,
  ComparisonTable,
  HeroCallout,
  JourneyMap,
  PageSection,
  ProductPage,
  SegmentTabs,
} from '@/components/product'
import type { JourneyStep, Tone } from '@/components/product'

interface JourneyDefinition {
  value: string
  label: string
  icon: LucideIcon
  tone: Tone
  purpose: string
  steps: JourneyStep[]
  rows: [string, string, string, string, string][]
}

const JOURNEYS: JourneyDefinition[] = [
  {
    value: 'tour-start',
    label: 'Tour Start',
    icon: ScanLine,
    tone: 'blue',
    purpose:
      'Kuryenin güne doğru rota ve eksiksiz koli setiyle başlamasını sağlamak; onay bekleme anını görünür, sonradan eklenen gönderileri ise kesintisiz yönetmek.',
    steps: [
      {
        label: 'Rotasını seçer',
        desc: 'Kurye kendisine atanmış rotayı uygulamada açar.',
        icon: MapPin,
        emotion: 3,
        nesy: true,
      },
      {
        label: 'Kolileri okutur',
        desc: 'Araca yüklenen gönderiler barkodla doğrulanır.',
        icon: ScanLine,
        emotion: 3,
        nesy: true,
      },
      {
        label: 'Onay ister',
        desc: 'Tur başlangıcı operasyon onayına gönderilir.',
        icon: Send,
        emotion: 2,
        nesy: true,
      },
      {
        label: 'Durakları yönetir',
        desc: 'Aynı adresler birleşir, yeni gönderiler tur içine alınır.',
        icon: Boxes,
        emotion: 4,
        nesy: true,
      },
    ],
    rows: [
      ['Rota seçimi', 'Doğru turu hatasız başlatmak', 'Rota seçim ekranı', '😐 Odaklı', 'Yanlış rota riskini gün/araç özetiyle azaltmak.'],
      ['Koli okutma', 'Araçtaki fiziksel yükü sistemle eşleştirmek', 'Barkod tarayıcı', '😐 Tekrarlı işlem', 'İlerleme ve eksik koli sayısını sürekli görünür tutmak.'],
      ['Onay bekleme', 'Sahaya çıkmak için izin almak', 'Onay durumu', '😟 Bekleme', 'Beklemenin nedenini ve sahibi olan rolü açıkça göstermek.'],
      ['Durak yönetimi', 'Günün planını değişikliklere rağmen korumak', 'Stop listesi', '🙂 Kontrol hissi', 'Otomatik birleşen ve sonradan gelen durakları ayırt etmek.'],
    ],
  },
  {
    value: 'delivery',
    label: 'Delivery',
    icon: PackageCheck,
    tone: 'teal',
    purpose:
      'Kapıdaki teslimat anını; alıcı doğrulama, tahsilat, fiskalizasyon ve imza adımları boyunca hızlı ama hataya dayanıklı biçimde tamamlamak.',
    steps: [
      {
        label: 'Durağa ulaşır',
        desc: 'Alıcı ve gönderi bilgilerini doğrular.',
        icon: DoorOpen,
        emotion: 3,
        nesy: true,
      },
      {
        label: 'Tahsilat yapar',
        desc: 'COD/ExW tutarı nakit veya ülkeye uygun kart akışıyla alınır.',
        icon: Banknote,
        emotion: 2,
        nesy: true,
      },
      {
        label: 'Fişi oluşturur',
        desc: 'Gerekli pazarlarda fiskalizasyon tetiklenir.',
        icon: Receipt,
        emotion: 3,
        nesy: true,
      },
      {
        label: 'İmzayı alır',
        desc: 'Dijital veya fiziksel teslim kanıtı tamamlanır.',
        icon: PenLine,
        emotion: 3,
        nesy: true,
      },
      {
        label: 'Teslimatı kapatır',
        desc: 'DELY eventi üretilir ve takip yüzeyleri güncellenir.',
        icon: CheckCircle2,
        emotion: 5,
        nesy: true,
      },
    ],
    rows: [
      ['Alıcı doğrulama', 'Doğru kişiye doğru gönderiyi vermek', 'Teslimat ekranı', '😐 Kontrollü', 'Ülkeye göre ön-dolu/düzenlenebilir alanları açıkça ayırmak.'],
      ['Tahsilat', 'Tutarı güvenli ve hızlı almak', 'Ödeme yöntemi', '😟 Kritik an', 'Raipay, SoftPOS ve nakit seçeneklerini ülkeye göre sadeleştirmek.'],
      ['Fiskalizasyon', 'Yasal fişi doğru anda üretmek', 'VPFR / yazıcı', '😐 Bekliyor', 'Entegrasyon hatasında tekrar ve iptal yollarını görünür yapmak.'],
      ['İmza', 'Teslim kanıtını tamamlamak', 'İmza yüzeyi', '😐 Son kontrol', 'Zorunlu ve opsiyonel imza durumunu yanlış anlaşılmayacak biçimde göstermek.'],
      ['Başarılı teslim', 'Görevi güvenle kapatmak', 'Başarı özeti', '😌 Tamamlandı', 'DELY sonucunu ve tahsilat özetini tek ekranda teyit etmek.'],
      ['Başarısız teslim', 'Doğru neden ve kanıtı kaydetmek', 'Neden + fotoğraf', '😟 Baskı altında', 'Ülkeye göre fotoğraf zorunluluğunu işlem anında açıklamak.'],
    ],
  },
  {
    value: 'pickup',
    label: 'Pickup',
    icon: PackageSearch,
    tone: 'indigo',
    purpose:
      'Toplama görevini atamadan gün sonuna kadar izlenebilir tutmak; başarısız durumda doğru kodu üretip gerekiyorsa görevi sonraki iş gününe taşımak.',
    steps: [
      {
        label: 'Görevi alır',
        desc: 'Otomatik job veya dispatcher atamasıyla pickup oluşur.',
        icon: ClipboardList,
        emotion: 3,
        nesy: true,
      },
      {
        label: 'Göndericiye ulaşır',
        desc: 'Gönderici ve gerekli pazarlarda alıcı bilgilerini görür.',
        icon: MapPin,
        emotion: 3,
        nesy: true,
      },
      {
        label: 'Koliyi teslim alır',
        desc: 'Pickup ve varsa CPP tahsilatı tamamlanır.',
        icon: PackageSearch,
        emotion: 4,
        nesy: true,
      },
      {
        label: 'Sorunu kodlar',
        desc: 'Başarısızlık nedeni doğru operasyon koduyla seçilir.',
        icon: Undo2,
        emotion: 2,
        nesy: true,
      },
      {
        label: 'Takibi planlar',
        desc: 'Uygun nedenlerde sonraki iş gününe yeniden atama yapılır.',
        icon: Route,
        emotion: 4,
        nesy: true,
      },
    ],
    rows: [
      ['Görev atama', 'Günün pickup işlerini görmek', 'Görev listesi', '😐 Planlıyor', 'Otomatik ve manuel atamaların kaynağını görünür kılmak.'],
      ['Gönderici bilgisi', 'Doğru adrese ve kişiye ulaşmak', 'Pickup detayı', '😐 Sahada', 'Eksik iletişim bilgisini operasyon kanalına hızlı eskale etmek.'],
      ['Pickup + CPP', 'Koliyi ve ödemeyi eksiksiz almak', 'Toplama akışı', '🙂 İlerliyor', 'CPP kapsamını ülkeye göre yalnız gerekli durumda göstermek.'],
      ['Başarısızlık kodu', 'Gerçek nedeni doğru kaydetmek', 'Reason code seçimi', '😟 Karar anı', 'Kodları teknik kısaltma yerine açıklamayla desteklemek.'],
      ['Yeniden atama', 'Görevin kaybolmadığından emin olmak', 'Görev sonucu', '🙂 Netlik', 'Sonraki çalışma gününü ve yeni görev durumunu açıkça göstermek.'],
    ],
  },
  {
    value: 'red-label',
    label: 'Red Label',
    icon: Package,
    tone: 'purple',
    purpose:
      'Henüz sistemde gönderi kaydı bulunmayan fiziksel bir koliyi müşteri noktasından alıp Npoint ve backoffice üzerinden izlenebilir gönderiye dönüştürmek.',
    steps: [
      {
        label: 'PAC görevi oluşur',
        desc: 'Kayıtsız koli için pickup-at-customer görevi açılır.',
        icon: ClipboardList,
        emotion: 3,
        nesy: true,
      },
      {
        label: 'Koliyi alır',
        desc: 'Red label fiziksel olarak teslim alınır.',
        icon: PackageSearch,
        emotion: 3,
        nesy: true,
      },
      {
        label: 'Npoint’e bırakır',
        desc: 'Koli operasyon noktasında araçtan indirilir.',
        icon: Boxes,
        emotion: 3,
        nesy: true,
      },
      {
        label: 'Gönderi oluşur',
        desc: 'Koli sistemde takip edilebilir bir shipment olur.',
        icon: Package,
        emotion: 4,
        nesy: true,
      },
      {
        label: 'Veri tamamlanır',
        desc: 'Eksik alanlar backoffice tarafından zenginleştirilir.',
        icon: CheckCircle2,
        emotion: 4,
      },
    ],
    rows: [
      ['PAC oluşturma', 'Kayıtsız koliyi operasyon içine almak', 'Görev listesi', '😐 Belirsiz başlangıç', 'Red Label görevini standart pickup’tan görsel olarak ayırmak.'],
      ['Fiziksel pickup', 'Kolinin sorumluluğunu devralmak', 'Pickup onayı', '😐 Dikkatli', 'Geçici kimliği ve fiziksel etiketi birlikte doğrulamak.'],
      ['Npoint drop-off', 'Koliyi doğru operasyona bırakmak', 'Unload ekranı', '😐 Operasyonel', 'Noktayı ve teslim alan birimi açıkça teyit etmek.'],
      ['Shipment creation', 'Koliyi izlenebilir hale getirmek', 'Gönderi sonucu', '🙂 Rahatlama', 'Yeni shipment kimliğini eski görevle bağlayarak göstermek.'],
      ['Backoffice completion', 'Eksik veriyi tamamlamak', 'Backoffice', '🙂 Kontrol', 'Mobilde hangi alanların daha sonra tamamlanacağını açıklamak.'],
    ],
  },
  {
    value: 'd4me',
    label: 'D4Me Locker',
    icon: Lock,
    tone: 'orange',
    purpose:
      'Dolap rezervasyonundan alıcı teslimine kadar D4Me entegrasyonunu görünür tutmak; süre aşımında koliyi kontrollü biçimde yeniden kurye akışına almak.',
    steps: [
      {
        label: 'Rezervasyon yapar',
        desc: 'Kurye veya alıcı LCR/DDP rezervasyonu oluşturur.',
        icon: QrCode,
        emotion: 3,
        nesy: true,
      },
      {
        label: 'Dolaba bırakır',
        desc: 'Koli yerleştirilir ve DEPT callback’i işlenir.',
        icon: Lock,
        emotion: 4,
        nesy: true,
      },
      {
        label: 'Alıcı teslim alır',
        desc: 'Süresinde alım DELY callback’iyle kapanır.',
        icon: CheckCircle2,
        emotion: 5,
        nesy: true,
      },
      {
        label: 'Süre aşımını yönetir',
        desc: 'Locker pickup görevi oluşur; alımda COPT üretilir.',
        icon: Undo2,
        emotion: 2,
        nesy: true,
      },
    ],
    rows: [
      ['LCR / DDP', 'Uygun dolabı rezerve etmek', 'Rezervasyon ekranı', '😐 Seçim yapıyor', 'Legacy ID dönüşümünü kullanıcıdan saklayıp sonucu açık göstermek.'],
      ['Locker drop-off', 'Doğru göze doğru koliyi bırakmak', 'D4Me yönlendirmesi', '🙂 İlerliyor', 'Callback gelene kadar işlemi tamamlandı göstermemek.'],
      ['Alıcı pickup', 'Teslimatı otomatik kapatmak', 'D4Me callback', '😌 Tamamlandı', 'DELY sonucunu takip ekranlarına gecikmesiz yansıtmak.'],
      ['Süre aşımı', 'Koliyi kaybetmeden geri toplamak', 'Locker pickup görevi', '😟 İstisna', 'Yeni görevin nedenini, son tarihi ve dolap konumunu birlikte göstermek.'],
    ],
  },
]

export default function UserJourneysPage() {
  return (
    <ProductPage path="/product/user-journeys">
      <HeroCallout
        icon={Footprints}
        eyebrow="Users & Field Experience · Journeys"
        tone="orange"
        title="Kurye sahada hangi yolculukları yaşıyor?"
        lead="Bu sayfa Nesy Mobile'ın ekran ve görev seviyesindeki yolculuklarını haritalar: kurye neyi tamamlamaya çalışıyor, hangi temas noktasında sürtünme yaşıyor ve hangi event ile güvenli biçimde ilerliyor? Her journey, adım haritası ve deneyim eğrisiyle birlikte okunur."
        chips={['5 journey', 'Deneyim eğrisi 1–5', 'Ekran-seviyesi adımlar', 'Ülke fırsatları']}
      />

      <Callout icon={Map} title="Journey ≠ Country Matrix" tone="orange">
        <b>User Journey</b> kuryenin görevi tamamlarken geçtiği ekran ve karar anlarını anlatır.{' '}
        <b>Country Matrix</b> ise aynı adımın ülkelerdeki kesin davranışını tutar. Bu sayfa deneyimi,
        matris operasyonel gerçeği açıklar; çelişki durumunda matris kaynak kabul edilir.
      </Callout>

      <SegmentTabs
        variant="button"
        items={JOURNEYS.map((journey) => ({
          value: journey.value,
          label: journey.label,
          icon: journey.icon,
          content: (
            <div className="space-y-4">
              <Callout icon={journey.icon} title="Yolculuğun amacı" tone={journey.tone}>
                {journey.purpose}
              </Callout>

              <JourneyMap steps={journey.steps} tone={journey.tone} />

              <ComparisonTable
                headers={[
                  { label: 'Adım' },
                  { label: 'Kurye hedefi' },
                  { label: 'Temas noktası' },
                  { label: 'Deneyim' },
                  { label: 'Tasarım fırsatı', tone: 'orange' },
                ]}
                rows={journey.rows}
              />
            </div>
          ),
        }))}
      />

      <PageSection
        eyebrow="Okuma Rehberi"
        title="Deneyim eğrisi nasıl yorumlanır?"
        icon={LineChart}
        tone="orange"
        description="Eğri 1 (yüksek sürtünme) ile 5 (güvende) arasında çizilir. Hedef her adımı 5 yapmak değil; kritik düşüşleri görünür, açıklanabilir ve toparlanabilir hale getirmektir."
      >
        <div className="grid gap-3.5 md:grid-cols-2">
          <Callout icon={Lightbulb} title="Düşüş her zaman hata değildir" tone="blue">
            Tahsilat, onay bekleme veya başarısız neden seçimi doğal olarak gerilimlidir. Tasarımın görevi
            bu gerilimi saklamak değil; nedeni, sonucu ve sonraki güvenli adımı açıkça göstermektir.
          </Callout>
          <Callout icon={ShieldCheck} title="Nesy devrede işareti" tone="orange">
            Turuncu “Nesy devrede” etiketi ürünün doğrudan yönettiği temas noktalarını gösterir. Etiketsiz
            adımlar backoffice, fiziksel operasyon veya harici sistem sorumluluğundadır.
          </Callout>
        </div>
      </PageSection>

      <Callout icon={Info} title="Journey verisinin kaynağı" tone="indigo">
        Journey adımları feature envanteri ve ülke matrisiyle birlikte güncellenir. Yeni bir ekran veya
        operasyon adımı eklendiğinde yalnız akış değil, deneyim düşüşü ve tasarım fırsatı da kayda alınır.
      </Callout>
    </ProductPage>
  )
}
