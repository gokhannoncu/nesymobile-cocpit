// Nesy Mobile ürün verisi — tek gerçek kaynak.
// Kaynak: NesyMobileTBD ülke-bazlı özellik matrisi (kurye uygulaması).
// Country id'leri Feature kayıtlarındaki alan adlarıyla eşleşir.

export type CountryId = 'core' | 'hr' | 'si' | 'rs' | 'ba' | 'me' | 'sk'

export interface Country {
  id: CountryId
  name: string
  subtitle: string
  price: string
  status: 'Küresel' | 'Aktif' | 'Gelişmiş' | 'Kısıtlı'
  isPopular?: boolean
}

export interface Feature {
  id: string
  title: string
  desc: string
  /** Ülke bazlı davranış — '—' henüz yok, 'N/A' kapsam dışı, diğer her şey açıklama. */
  values: Record<CountryId, string>
}

export interface Module {
  id: string
  title: string
  desc: string
  features: Feature[]
}

export const COUNTRIES: Country[] = [
  { id: 'core', name: 'CORE', subtitle: 'Standart Altyapı', price: 'Varsayılan', status: 'Küresel' },
  { id: 'hr', name: 'Scale HR', subtitle: 'Hırvatistan', price: '€299/ay', status: 'Aktif', isPopular: true },
  { id: 'si', name: 'Scale SI', subtitle: 'Slovenya', price: '€249/ay', status: 'Aktif' },
  { id: 'rs', name: 'Scale Plus RS', subtitle: 'Sırbistan', price: '€399/ay', status: 'Gelişmiş' },
  { id: 'ba', name: 'Start BA', subtitle: 'Bosna', price: '€149/ay', status: 'Kısıtlı' },
  { id: 'me', name: 'Start ME', subtitle: 'Karadağ', price: '€149/ay', status: 'Kısıtlı' },
  { id: 'sk', name: 'Scale SK', subtitle: 'Slovakya', price: '€249/ay', status: 'Kısıtlı' },
]

export const MODULES: Module[] = [
  {
    id: 'delivery-process',
    title: 'Delivery Process',
    desc: 'Kapıda teslimat akışı: tahsilat, fiskalizasyon, imza, başarısız teslimat ve alternatif teslim noktaları.',
    features: [
      {
        id: 'collect_cod',
        title: 'Collect COD',
        desc: 'Kapıda nakit ve kredi kartı tahsilatı (cash on delivery).',
        values: {
          core: 'Nakit ve kredi kartı ödemeleri desteklenir',
          hr: 'Nakit mevcut\nKredi kartı Raipay üzerinden',
          si: 'Nakit mevcut\nKredi kartı Softpos üzerinden',
          rs: 'Nakit mevcut\nKredi kartı Softpos üzerinden (entegre edilecek)',
          ba: 'Yalnızca nakit tahsilat',
          me: 'Yalnızca nakit tahsilat',
          sk: '—',
        },
      },
      {
        id: 'collect_exw',
        title: 'Collect ExW',
        desc: 'Pickup noktasında ex-works tahsilatı.',
        values: {
          core: 'Nakit ve kredi kartı ödemeleri desteklenir',
          hr: 'Nakit mevcut\nKredi kartı Raipay üzerinden',
          si: 'Nakit mevcut\nKredi kartı Softpos üzerinden',
          rs: 'Nakit mevcut\nKredi kartı Softpos üzerinden (entegre edilecek)',
          ba: 'Yalnızca nakit tahsilat',
          me: 'Yalnızca nakit tahsilat',
          sk: '—',
        },
      },
      {
        id: 'skip_exwork',
        title: 'Skip Exwork',
        desc: 'Kurye beklenen exwork tutarını atlayabilir.',
        values: {
          core: 'Beklenen exwork tutarı kurye tarafından atlanabilir; gönderi güncellenir ve müşteriye faturalanır.',
          hr: 'N/A',
          si: 'N/A',
          rs: 'Core ile aynı',
          ba: 'N/A',
          me: 'N/A',
          sk: '—',
        },
      },
      {
        id: 'fiscalization_dp',
        title: 'Fiscalization',
        desc: 'Teslimatta fiskal fiş tetiklenir ve yazdırılır.',
        values: {
          core: 'Teslimatta VPFR tetiklenir ve fiş yazdırılır',
          hr: 'N/A',
          si: 'N/A',
          rs: 'Core ile aynı',
          ba: 'N/A',
          me: 'N/A',
          sk: '—',
        },
      },
      {
        id: 'failed_reasons',
        title: 'Delivery Failed Reasons / Photo',
        desc: 'Başarısız teslimat nedeni seçimi ve zorunlu fotoğraf kanıtı.',
        values: {
          core: 'Tam başarısız neden listesi + bazı durumlarda zorunlu fotoğraf',
          hr: 'Core ile aynı',
          si: 'Sınırlı liste (fotoğraf Core ile aynı)',
          rs: 'Core ile aynı, fotoğraf opsiyonel',
          ba: 'Core ile aynı, fotoğraf çekilemez',
          me: 'Core ile aynı, fotoğraf opsiyonel',
          sk: '—',
        },
      },
      {
        id: 'consignee_info',
        title: 'Consignee Information',
        desc: 'Teslimatta alıcı adının ön-dolumu ve düzenlenme davranışı.',
        values: {
          core: 'Ad ön-dolu, düzenlenebilir',
          hr: 'Ad ön-dolu değil, harici olarak manuel gönderilir',
          si: 'Core ile aynı',
          rs: 'Core ile aynı',
          ba: 'Core ile aynı',
          me: 'Core ile aynı',
          sk: '—',
        },
      },
      {
        id: 'signature_dp',
        title: 'Signature',
        desc: 'Teslimatta dijital ve fiziksel imza toplama.',
        values: {
          core: 'Dijital imza zorunlu\nFiziksel belge indirilebilir ve imzalanır',
          hr: 'Dijital imza Core ile aynı\nDely list Core ile aynı (kod merge sonrası)',
          si: 'Core ile aynı',
          rs: 'Dijital imza opsiyonel\nDely list Core ile aynı',
          ba: 'Dijital imza opsiyonel\nDely list Core ile aynı',
          me: 'Dijital imza opsiyonel\nDely list Core ile aynı',
          sk: '—',
        },
      },
      {
        id: 'delivery_parcelshop',
        title: 'Delivery to Parcelshop',
        desc: 'Gönderilerin parcel shop / pick-up noktasına teslimi.',
        values: {
          core: 'RDOC ve OVSZ gönderiler teslim edilemez',
          hr: 'Core ile aynı',
          si: 'Core ile aynı',
          rs: 'Core ile aynı',
          ba: 'N/A',
          me: 'N/A',
          sk: '—',
        },
      },
      {
        id: 'delivery_locker',
        title: 'Delivery to Locker',
        desc: 'Akıllı dolap teslimatları için D4ME entegrasyonu.',
        values: {
          core: 'D4ME entegrasyonu\nRDOC ve OVSZ gönderiler teslim edilemez',
          hr: 'Core ile aynı',
          si: 'Core ile aynı',
          rs: 'Core ile aynı',
          ba: 'N/A',
          me: 'N/A',
          sk: '—',
        },
      },
    ],
  },
  {
    id: 'pickup-process',
    title: 'Pickup Process',
    desc: 'Toplama akışı: görev atama, CPP tahsilatı, başarısız toplama nedenleri ve otomatik yeniden atama.',
    features: [
      {
        id: 'pickup_assignment',
        title: 'Pickup Assignment',
        desc: 'Toplama görevlerinin kuryelere atanma biçimi.',
        values: {
          core: 'Toplama görevleri job ile otomatik atanır (her 3 dakikada)',
          hr: 'Dispatcher tarafından manuel atanır',
          si: 'Core ile aynı',
          rs: 'Dispatcher tarafından manuel atanır',
          ba: 'Dispatcher tarafından manuel atanır',
          me: 'Core ile aynı',
          sk: '—',
        },
      },
      {
        id: 'collect_cpp',
        title: 'Collect CPP',
        desc: 'Toplama noktasında nakit ve kredi kartı tahsilatı.',
        values: {
          core: 'Nakit ve kredi kartı ödemeleri desteklenir',
          hr: 'Nakit mevcut\nKredi kartı Raipay üzerinden',
          si: 'N/A',
          rs: 'Nakit mevcut\nKredi kartı Softpos üzerinden (entegre edilecek)',
          ba: 'N/A',
          me: 'N/A',
          sk: '—',
        },
      },
      {
        id: 'pickup_fiscalization',
        title: 'Pickup Fiscalization (Print Fiscal)',
        desc: 'CPP gönderiler için toplamada fiskal fiş tetiklenir ve yazdırılır.',
        values: {
          core: 'CPP gönderiler için toplamada VPFR tetiklenir ve fiş yazdırılır',
          hr: 'N/A',
          si: 'N/A',
          rs: 'N/A',
          ba: 'N/A',
          me: 'N/A',
          sk: '—',
        },
      },
      {
        id: 'pickup_at_customer',
        title: 'Pickup at Customer',
        desc: 'PAC görev davranışı ve gün sonu engelleme kuralları.',
        values: {
          core: 'Aksiyonsuz PAC görevi gün sonunu engeller',
          hr: 'Core ile aynı',
          si: 'Aksiyonsuz PAC görevi gün sonunu ENGELLEMEZ',
          rs: 'Core ile aynı',
          ba: 'Core ile aynı',
          me: 'Core ile aynı',
          sk: '—',
        },
      },
      {
        id: 'remote_pickup',
        title: 'Remote Pickup',
        desc: 'Mobil uygulamada gönderici ve alıcı bilgilerinin gösterimi.',
        values: {
          core: 'Gönderici bilgileri mobil uygulamada gösterilir',
          hr: 'Core ile aynı',
          si: 'Core ile aynı',
          rs: 'Core ile aynı',
          ba: 'Alıcı bilgileri de gönderici ile birlikte gösterilir',
          me: 'Core ile aynı',
          sk: '—',
        },
      },
      {
        id: 'red_label',
        title: 'Red Label',
        desc: 'Red label gönderilerin mobil uygulama üzerinden toplanma akışı.',
        values: {
          core: 'Redlabel gönderiler mobil uygulama ile toplanır\n\nSüreç akışı:\n- Pickup at customer görevi oluşur\n- Kurye koliyi toplar\n- Koli Npoint’te indirilir\n- Gönderi oluşturulur\n- Backoffice eksik veriyi tamamlar',
          hr: 'Core ile aynı',
          si: 'N/A',
          rs: 'Core ile aynı akış',
          ba: 'Core ile aynı',
          me: 'N/A',
          sk: '—',
        },
      },
      {
        id: 'pickup_failed_non_rdoc',
        title: 'Pickup Failed Reason (Non-RDOC)',
        desc: 'RDOC olmayan toplama görevleri için başarısız neden kodları.',
        values: {
          core: 'NOPC, NPNP, NRDY, NSYS, PABS, PADU, PTIM',
          hr: 'Core ile aynı',
          si: 'Core ile aynı',
          rs: 'Core ile aynı',
          ba: 'Core ile aynı',
          me: 'Core ile aynı',
          sk: '—',
        },
      },
      {
        id: 'rdoc_failed_reasons',
        title: 'RDOC Failed Reasons',
        desc: 'RDOC toplama görevleri için başarısız neden kodları.',
        values: {
          core: 'NOPC',
          hr: 'Core ile aynı',
          si: 'Core ile aynı',
          rs: 'Core ile aynı',
          ba: 'Core ile aynı',
          me: 'Core ile aynı',
          sk: '—',
        },
      },
      {
        id: 'auto_reassignment',
        title: 'Auto Reassignment to Next Working Day',
        desc: 'Başarısız toplama sonrası otomatik yeniden atama tetikleyici kodları.',
        values: {
          core: 'Başarısız nedenlerden sonra (NPNP, NRDY, PABS, PTIM)',
          hr: 'Core ile aynı',
          si: 'NPNP, NRDY, PABS, PADU, PTIM',
          rs: 'NPNP, NRDY, NSYS, PABS, PADU, PTIM',
          ba: '—',
          me: '—',
          sk: '—',
        },
      },
    ],
  },
  {
    id: 'tour-stop-management',
    title: 'Tour & Stop Management',
    desc: 'Tur ve durak yönetimi: durak oluşturma/birleştirme kuralları, gün başı tur onayı ve event listesi.',
    features: [
      {
        id: 'creation_of_stops',
        title: 'Creation of Stops (Merge Shipments)',
        desc: 'Otomatik ve manuel durak oluşturma ile gönderi birleştirme kuralları.',
        values: {
          core: '- Alıcı adı ve adresi aynıysa → gönderiler aynı durak altında otomatik birleşir (dely)\n- Gönderici adı ve adresi aynıysa → otomatik birleşir (pickup)\n- Tur onayından sonra yeni gönderiler, eşleşen durak yoksa yeni durak olarak eklenir\n- Tur başlangıç onayından önce kurye durakları manuel birleştirebilir',
          hr: 'Core ile aynı',
          si: 'Core ile aynı',
          rs: 'Core ile aynı',
          ba: 'Core ile aynı',
          me: 'Core ile aynı',
          sk: '—',
        },
      },
      {
        id: 'merge_stops_manual',
        title: 'Merge Stops (Manual)',
        desc: 'Ana durak seçip alt durakları altında manuel birleştirme.',
        values: {
          core: 'Kullanıcı bir ana durak seçer ve alt durakları seçerek farklı durakları onun altında birleştirir',
          hr: 'Core ile aynı',
          si: 'Core ile aynı',
          rs: 'Core ile aynı',
          ba: 'Core ile aynı',
          me: 'Core ile aynı',
          sk: '—',
        },
      },
      {
        id: 'tour_start_approval',
        title: 'Tour Start Approval (Beginning of Day)',
        desc: 'Gün başında koli okutma ve tur onay akışı.',
        values: {
          core: 'Kurye rota seçer, kolileri okutur ve onay talebi gönderir\nTur başlangıç onayı her durumda zorunlu',
          hr: 'İlk tur başlangıcından sonra ek okutulan koliler otomatik onaylanır',
          si: 'İlk tur başlangıcından sonra ek okutulan koliler otomatik onaylanır',
          rs: 'Core ile aynı',
          ba: 'Core ile aynı',
          me: 'Core ile aynı',
          sk: '—',
        },
      },
      {
        id: 'app_hc_event_list',
        title: 'Application HC – Event List',
        desc: 'Mobil uygulama event listesindeki mevcut event’ler.',
        values: {
          core: 'Core event listesi',
          hr: 'Core ile aynı',
          si: 'Core ile aynı',
          rs: 'Core ile aynı',
          ba: 'Core event’leri + PICK event',
          me: 'Core event’leri + RETS (Return to Sender)',
          sk: '—',
        },
      },
    ],
  },
  {
    id: 'shipment-tracking',
    title: 'Shipment Tracking',
    desc: 'Gönderi takip ekranı: kimlik, konum, son event, taraf bilgileri ve fiskal detaylar.',
    features: [
      {
        id: 'shipment_tracking_screen',
        title: 'Shipment Tracking Screen',
        desc: 'Gönderi takip ekranında gösterilen bilgiler ve fiskal detaylar.',
        values: {
          core: 'Takip ekranı ShipmentID, Güncel Konum, Son Event, Gönderici ve Alıcıyı gösterir\n\nExW / CPP gönderilerde fiskal detaylar görünür. Fiskal iptal edilirse SSC tetiklenir',
          hr: 'Core ile aynı (fiskalizasyon hariç)',
          si: 'Core ile aynı (fiskalizasyon hariç)',
          rs: 'Core ile aynı',
          ba: 'Core ile aynı (fiskalizasyon hariç)',
          me: 'Core ile aynı (fiskalizasyon hariç)',
          sk: '—',
        },
      },
    ],
  },
  {
    id: 'ebranch-delivery-options',
    title: 'Ebranch & Delivery Options',
    desc: 'Alıcıya giden takip linki ve tur öncesi/sonrası self-servis teslimat seçenekleri.',
    features: [
      {
        id: 'ebranch_tracking_link',
        title: 'Ebranch Tracking Link & Delivery Options',
        desc: 'Takip linki üretimi ve tur öncesi/sonrası teslimat seçenekleri.',
        values: {
          core: '• Gönderi oluşturulduktan sonra branch linki üretilir\n\nTUR öncesi:\n• Parcel Shop’a teslim\n• D4Me Locker’a teslim\n• D4Me Private Locker’a teslim\n\nGönderi otomatik yönlendirilmişse (DSSA):\n• Şubeden al\n• Teslimatı reddet\n\nTUR sonrası:\n• Evde\n• Teslimat tarihini değiştir\n• Adres değiştir\n• Şubeden al\n• Teslimatı reddet\n• Parcel Shop / D4Me Locker / Private Locker’a teslim\n\n• COD/ExW ise → INIT sonrası "Pay with Link" görünür\n• Branch linki DELY / RETS / STOR / DELR sonrası geçersizleşir',
          hr: '"D4Me Private Locker’a teslim" TUR öncesi görünmez\nCOD/ExW TUR öncesi ödendiyse → Cashdesk’te "CC Overseas" altında görünür',
          si: 'Ebranch’ta şu seçenekler görünmez:\n• Şubeden al\n• Teslimatı reddet\n\nCOD/ExW TUR öncesi ödendiyse → Cashdesk’te "CC ExpressOne" altında görünür',
          rs: 'N/A',
          ba: 'N/A',
          me: 'N/A',
          sk: '—',
        },
      },
    ],
  },
  {
    id: 'd4me-locker',
    title: 'D4Me Locker',
    desc: 'D4Me entegrasyonu ile dolap rezervasyonu, teslim ve süre aşımı yönetimi.',
    features: [
      {
        id: 'd4me_locker_delivery',
        title: 'D4Me Locker Delivery Process',
        desc: 'D4Me entegrasyonu üzerinden dolap rezervasyonu, teslim ve süre aşımı yönetimi.',
        values: {
          core: '• Kurye Nesy Mobile üzerinden D4Me Locker rezervasyonu (LCR) oluşturabilir\n• VEYA alıcı Ebranch üzerinden rezervasyon oluşturabilir (LCR + DDP)\n• Rezervasyon adımında legacy ID D4Me’ye gönderilir\n• Kurye koliyi dolaba bırakır → DEPT event’i D4MeCallback ile gönderilir\n• Alıcı zamanında alırsa → callback ile DELY alınır\n• Alınmazsa → Locker Pickup görevi oluşturulur\n• Kurye süresi geçen koliyi alırsa → COPT event’i atanır',
          hr: 'Core ile aynı',
          si: 'Core ile aynı',
          rs: '• Entegrasyon Legacy ID’nin ilk 14 hanesi ile yönetilir\n• Tam Legacy ID yerine 14 haneli ID gönderilir\n• DEPT 14 haneli eşleme ile işlenir\n• Callback ile gelen DELY saklanan tam Legacy ID’ye eşlenir',
          ba: 'N/A',
          me: 'N/A',
          sk: '—',
        },
      },
    ],
  },
]

/** Bir feature değeri o ülkede "destekleniyor" mu? */
export function isSupported(value: string): boolean {
  return value !== '—' && value !== 'N/A'
}

/** Ülke bazında desteklenen feature sayısı. */
export function supportedCount(countryId: CountryId): number {
  return MODULES.flatMap((m) => m.features).filter((f) => isSupported(f.values[countryId])).length
}

export const TOTAL_FEATURES = MODULES.reduce((acc, m) => acc + m.features.length, 0)
