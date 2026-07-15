// Feature Detail verileri — mobil proje kaynak kod analizi + issue raporları + mimari analiz belgelerinden çıkarılmıştır.
// Kaynak: NesyMobile Android projesi (com.arasdigital.nesymobile.*)
// Kaynak: PLAN5-Enterprise-Architecture-Decision.md (37 edge case, 162 ticket)
// Kaynak: nesy_mobile_issue_raporu.md, nesy_mobile_mimari_onceliklendirme.md

import type { FeatureDetail } from './nesy-types'

export const FEATURE_DETAILS: Record<string, FeatureDetail> = {
  /* ═══════════════════════════════════════════════════════
   * DELIVERY PROCESS MODULE
   * ═══════════════════════════════════════════════════════ */

  collect_cod: {
    whatIs:
      'Kapıda ödeme (Cash on Delivery) tahsilatı. Kurye, teslimat anında alıcıdan nakit veya kredi kartı ile ödeme alır. Ödeme tutarı gönderi üzerindeki COD alanından belirlenir. Nakit tahsilat doğrudan yapılırken, kredi kartı tahsilatı ülkeye göre farklı ödeme sistemleri (RaiPay, SoftPos, WSPay) üzerinden gerçekleşir.',
    howItWorks: [
      'Kurye stop ekranında gönderiyi seçer',
      'Gönderi üzerinde COD tutarı varsa tahsilat ekranı açılır',
      'Ödeme yöntemi seçilir: Nakit veya Kredi Kartı',
      'Nakit seçilirse tutar girilir ve onaylanır',
      'Kredi kartı seçilirse ilgili ödeme uygulaması (RaiPay/SoftPos) tetiklenir',
      'Ödeme başarılı olursa gönderi teslimat akışına devam eder',
      'Ödeme başarısız olursa teslimat başarısız olarak işaretlenebilir',
    ],
    screens: [
      'DeliveryFragment — Ana teslimat ekranı',
      'PaymentFragment — Ödeme yöntemi seçimi',
      'RaiPayActivity — RaiPay kredi kartı entegrasyonu (HR)',
      'SoftPosActivity — SoftPos kredi kartı entegrasyonu (SI, RS)',
    ],
    parameters: [
      { name: 'shipment.collectionAmount', desc: 'Tahsil edilecek COD tutarı', type: 'decimal' },
      { name: 'shipment.collectionCurrency', desc: 'Para birimi (EUR, RSD, BAM)', type: 'string' },
      { name: 'shipment.paymentType', desc: 'Ödeme tipi (CASH, CC)', type: 'enum' },
      { name: 'country.paymentProvider', desc: 'Ülkeye göre ödeme sağlayıcı', type: 'enum' },
    ],
    diagram: [
      { type: 'node', label: 'Kurye gönderiyi seçer', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'COD var mı?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Evet',
          steps: [
            { type: 'node', label: 'Tahsilat ekranı açılır', variant: 'process' },
            { type: 'arrow' },
            { type: 'node', label: 'Ödeme yöntemi?', variant: 'decision' },
            {
              type: 'branch',
              yes: {
                label: 'Nakit',
                steps: [
                  { type: 'node', label: 'Tutar girilir', variant: 'process' },
                ],
              },
              no: {
                label: 'Kredi Kartı',
                steps: [
                  { type: 'node', label: 'Ödeme uygulaması açılır', variant: 'external' },
                  { type: 'arrow' },
                  { type: 'node', label: 'Başarılı?', variant: 'decision' },
                  {
                    type: 'branch',
                    yes: {
                      label: 'Evet',
                      steps: [
                        { type: 'node', label: 'Devam', variant: 'process' },
                      ],
                    },
                    no: {
                      label: 'Hayır',
                      steps: [
                        { type: 'node', label: 'Retry', variant: 'error' },
                      ],
                    },
                  },
                ],
              },
            },
            { type: 'arrow' },
            { type: 'node', label: 'Tahsilat onaylanır', variant: 'process' },
          ],
        },
        no: {
          label: 'Hayır',
          steps: [
            { type: 'node', label: 'Doğrudan teslimat', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Teslimat devam', variant: 'end' },
    ],
    tips: [
      'HR\'de kredi kartı ödemeleri RaiPay üzerinden yapılır — RaiPay uygulamasının cihazda kurulu ve bağlı olması gerekir',
      'SI ve RS\'de SoftPos kullanılır — RS\'de entegrasyon henüz tamamlanmamıştır',
      'BA ve ME\'de yalnızca nakit tahsilat desteklenir, kredi kartı altyapısı yoktur',
      'Offline modda tahsilat yapılabilir ancak senkronizasyon sonrası doğrulanır',
      'COD tutarı 0 ise tahsilat ekranı atlanır',
      'Birden fazla gönderi aynı durumda toplu tahsilat edilebilir',
    ],
    tickets: [
      { id: 'NESY-142', title: 'COD tahsilat sonrası tutar uyuşmazlığı', status: 'open' },
      { id: 'NESY-87', title: 'RaiPay bağlantı hatası tekrar denemede başarısız', status: 'closed' },
      { id: 'NESY-201', title: 'Offline COD tahsilatta race condition', status: 'open' },
    ],
    experts: [
      { name: 'Finans Ekibi', role: 'Ödeme Entegrasyonları' },
      { name: 'Mobile Geliştirici', role: 'Android Ödeme Akışı' },
    ],
    score: { bugProneness: 4, boilerplate: 3, complexity: 4, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Shipment/GetShipmentCollectionStatus', desc: 'Gönderi tahsilat durumu sorgulama' },
      { method: 'POST', endpoint: 'Shipment/GetPaymentId', desc: 'Ödeme ID\'si oluşturma' },
      { method: 'POST', endpoint: 'Shipment/RaipayBindMobilDeviceToPaymentTerminal', desc: 'RaiPay cihaz bağlama' },
      { method: 'POST', endpoint: 'Shipment/RaiPayAuthToken', desc: 'RaiPay yetkilendirme token\'ı alma' },
      { method: 'POST', endpoint: 'Shipment/GetRaiPayPaymentToken', desc: 'RaiPay ödeme token\'ı alma' },
      { method: 'POST', endpoint: 'Shipment/GetRaiPayPaymentStatus', desc: 'RaiPay ödeme durumu sorgulama' },
      { method: 'POST', endpoint: 'Shipment/SaveCollectedShipmentListToCashDesk', desc: 'Tahsilatları kasaya kaydetme' },
    ],
  },

  collect_exw: {
    whatIs:
      'Pickup noktasında yapılan ex-works tahsilatı. Kurye, gönderiyi topladığı noktada göndericiden ödeme alır. ExW (Ex Works) gönderilerde ödeme toplama anında gerçekleşir, teslimat anında değil.',
    howItWorks: [
      'Kurye pickup görevini seçer',
      'Gönderi ExW ise tahsilat ekranı açılır',
      'Ödeme yöntemi seçilir (Nakit / Kredi Kartı)',
      'Tahsilat tamamlanır',
      'Gönderi toplama işlemine devam eder',
      'Fiskal fiş gerekiyorsa otomatik tetiklenir (RS)',
    ],
    screens: [
      'PickupFragment — Toplama ekranı',
      'PaymentFragment — Ödeme seçim ekranı',
    ],
    parameters: [
      { name: 'shipment.exwAmount', desc: 'ExW tahsilat tutarı', type: 'decimal' },
      { name: 'shipment.isExW', desc: 'Gönderi ExW mı?', type: 'boolean' },
      { name: 'country.paymentProvider', desc: 'Ödeme sağlayıcı', type: 'enum' },
    ],
    diagram: [
      { type: 'node', label: 'Pickup görevi seçilir', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'ExW gönderi mi?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Evet',
          steps: [
            { type: 'node', label: 'Tahsilat ekranı açılır', variant: 'process' },
            { type: 'arrow' },
            { type: 'node', label: 'Ödeme yöntemi seçilir', variant: 'process' },
            { type: 'arrow' },
            { type: 'node', label: 'Tahsilat kaydedilir', variant: 'process' },
            { type: 'arrow' },
            { type: 'node', label: 'Fiskal fiş gerekli mi?', variant: 'decision' },
            {
              type: 'branch',
              yes: {
                label: 'Evet',
                steps: [
                  { type: 'node', label: 'VPFR tetiklenir', variant: 'external' },
                ],
              },
              no: {
                label: 'Hayır',
                steps: [
                  { type: 'node', label: 'Devam', variant: 'process' },
                ],
              },
            },
          ],
        },
        no: {
          label: 'Hayır',
          steps: [
            { type: 'node', label: 'Normal toplama', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Devam', variant: 'end' },
    ],
    tips: [
      'ExW ve COD tahsilatı aynı ödeme altyapısını kullanır ancak farklı event\'ler tetikler',
      'ExW fiskalizasyonu yalnızca RS\'de zorunludur',
      'ExW tahsilatı Skip edilebilir (bkz. skip_exwork feature)',
    ],
    tickets: [
      { id: 'NESY-156', title: 'ExW tahsilat sonrası fiskal fiş oluşmuyor', status: 'closed' },
    ],
    experts: [
      { name: 'Finans Ekibi', role: 'Tahsilat Akışları' },
    ],
    score: { bugProneness: 3, boilerplate: 3, complexity: 3, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Shipment/GetShipmentCollectionStatus', desc: 'ExW tahsilat durumu sorgulama' },
      { method: 'POST', endpoint: 'Shipment/GetCollectionsFromShipment', desc: 'Gönderi tahsilat bilgileri' },
    ],
  },

  skip_exwork: {
    whatIs:
      'Kurye, beklenen ExW tutarını atlayabilir. Bu durumda gönderi güncellenir ve müşteriye faturalanır. Bu özellik yalnızca RS\'de aktiftir; diğer ülkelerde ExW atlanamaz.',
    howItWorks: [
      'Kurye ExW tahsilat ekranında "Atla" butonuna basar',
      'Sistem onay dialog\'u gösterir',
      'Onay sonrası gönderi ExW tutarı sıfırlanır',
      'Gönderi güncellenir ve müşteriye faturalanması backend\'de işlenir',
      'Toplama akışı devam eder',
    ],
    screens: [
      'PickupFragment — ExW atla butonu',
    ],
    parameters: [
      { name: 'country.canSkipExW', desc: 'ExW atlama izninin olup olmadığı', type: 'boolean' },
      { name: 'shipment.exwAmount', desc: 'Atlanan ExW tutarı', type: 'decimal' },
    ],
    diagram: [
      { type: 'node', label: 'ExW tahsilat ekranı', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Atla butonuna basılır', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Onay?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Evet',
          steps: [
            { type: 'node', label: 'Tutar sıfırlanır', variant: 'process' },
            { type: 'arrow' },
            { type: 'node', label: 'Gönderi güncellenir', variant: 'process' },
            { type: 'arrow' },
            { type: 'node', label: 'Devam', variant: 'process' },
          ],
        },
        no: {
          label: 'Hayır',
          steps: [
            { type: 'node', label: 'Geri dön', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Akış tamamlanır', variant: 'end' },
    ],
    tips: [
      'Yalnızca RS\'de aktif — diğer ülkelerde bu buton görünmez',
      'Skip sonrası gönderi durumu değişir, geri alınamaz',
      'Finansal raporlamada "skipped ExW" olarak ayrı takip edilir',
    ],
    tickets: [],
    experts: [
      { name: 'RS Operasyon Ekibi', role: 'Sırbistan Özel Kuralları' },
    ],
    score: { bugProneness: 2, boilerplate: 1, complexity: 2, testCoverage: 1 },
  },

  fiscalization_dp: {
    whatIs:
      'Teslimatta VPFR (Virtual Fiscal Printer) tetiklenir ve fiskal fiş yazdırılır. Fiskalizasyon, devlet tarafından zorunlu kılınan mali belge düzenleme işlemidir. Her COD/ExW ödemesi için fiskal fiş oluşturulmalıdır. RS\'de zorunlu, diğer ülkelerde henüz aktif değildir.',
    howItWorks: [
      'Teslimat veya toplama sırasında ödeme alınır',
      'Ödeme başarılı olduktan sonra VPFR tetiklenir',
      'Fiş verisi backend\'e gönderilir (CreateFiscalInvoice)',
      'Backend VPFR\'den yanıt alır ve fiş numarası döner',
      'Fiş yazdırılır (Bluetooth yazıcı veya dijital)',
      'Fiskal iptal durumunda SSC (Status Change) tetiklenir',
    ],
    screens: [
      'FiscalPrintFragment — Fiş yazdırma ekranı',
      'PrinterSettingsFragment — Yazıcı ayarları',
      'DeliveryFragment — Teslimat ana ekranı (fiskal tetikleyici)',
    ],
    parameters: [
      { name: 'country.fiscalizationEnabled', desc: 'Fiskalizasyon aktif mi?', type: 'boolean' },
      { name: 'printer.bluetoothAddress', desc: 'Bluetooth yazıcı MAC adresi', type: 'string' },
      { name: 'fiscal.vpfrUrl', desc: 'VPFR endpoint URL\'i', type: 'string' },
    ],
    diagram: [
      { type: 'node', label: 'Ödeme tamamlanır', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Fiskal zorunlu mu?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Evet',
          steps: [
            { type: 'node', label: 'CreateFiscalInvoice API', variant: 'external' },
            { type: 'arrow' },
            { type: 'node', label: 'Başarılı?', variant: 'decision' },
            {
              type: 'branch',
              yes: {
                label: 'Evet',
                steps: [
                  { type: 'node', label: 'Fiş yazdırılır', variant: 'process' },
                ],
              },
              no: {
                label: 'Hayır',
                steps: [
                  { type: 'node', label: 'Retry', variant: 'error' },
                ],
              },
            },
          ],
        },
        no: {
          label: 'Hayır',
          steps: [
            { type: 'node', label: 'Devam', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Akış tamamlanır', variant: 'end' },
    ],
    tips: [
      'VPFR bağlantısı timeout alabilir — retry mekanizması mevcut (RetryFiscalInvoice)',
      'Fiskal fiş oluşturulduktan sonra iptal edilirse RefundFiscalInvoice çağrılır ve SSC event tetiklenir',
      'Fiskalizasyon şu an yalnızca RS\'de zorunlu, BA\'da planlanan (Bulgaristan genişlemesiyle)',
      'Bluetooth yazıcı bağlantısı sık kopar — cihaz pair kontrolü önemli',
      'Offline modda fiskal fiş oluşturulamaz, kuyrukta bekler',
    ],
    tickets: [
      { id: 'NESY-103', title: 'Fiskal fiş retry\'da sonsuz döngü', status: 'open' },
      { id: 'NESY-178', title: 'VPFR timeout sonrası fiş numarası kaybolması', status: 'open' },
      { id: 'NESY-45', title: 'Bluetooth yazıcı bağlantı kaybında crash', status: 'closed' },
    ],
    experts: [
      { name: 'Finans Ekibi', role: 'Fiskal Entegrasyon' },
      { name: 'RS Operasyon', role: 'VPFR Süreçleri' },
    ],
    score: { bugProneness: 5, boilerplate: 4, complexity: 5, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Shipment/CreateFiscalInvoice', desc: 'Fiskal fiş oluşturma' },
      { method: 'POST', endpoint: 'Shipment/RetryFiscalInvoice', desc: 'Başarısız fiskal fiş tekrar deneme' },
      { method: 'POST', endpoint: 'Shipment/RefundFiscalInvoice', desc: 'Fiskal fiş iptali' },
      { method: 'POST', endpoint: 'Shipment/UpdateFiscalInvoice', desc: 'Fiskal fiş güncelleme' },
      { method: 'POST', endpoint: 'Shipment/GetFiscalInvoiceDetail', desc: 'Fiskal fiş detay sorgulama' },
    ],
  },

  failed_reasons: {
    whatIs:
      'Teslimat başarısız olduğunda kurye bir neden seçer ve bazı durumlarda fotoğraf kanıtı çeker. Başarısız teslimat nedenleri ülkeye göre özelleştirilmiştir. Fotoğraf zorunluluğu da neden koduna ve ülkeye bağlıdır.',
    howItWorks: [
      'Kurye "Teslimat Başarısız" butonuna basar',
      'Neden listesi açılır (ülkeye göre filtrelenir)',
      'Kurye bir neden seçer',
      'Seçilen nedene göre fotoğraf zorunlu olabilir',
      'Fotoğraf çekilirse CameraFragment açılır',
      'Fotoğraf sunucuya yüklenir (SaveImageFile)',
      'DeliveryFailed API çağrılır ve gönderi durumu güncellenir',
    ],
    screens: [
      'DeliveryFailedFragment — Başarısız neden seçim ekranı',
      'CameraFragment — Fotoğraf çekim ekranı',
    ],
    parameters: [
      { name: 'country.failedReasons', desc: 'Ülkeye özel başarısız neden kodları listesi', type: 'string[]' },
      { name: 'failedReason.requiresPhoto', desc: 'Bu neden fotoğraf gerektiriyor mu?', type: 'boolean' },
      { name: 'country.photoMandatory', desc: 'Fotoğraf zorunlu mu?', type: 'boolean' },
    ],
    diagram: [
      { type: 'node', label: 'Teslimat başarısız', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Neden listesi açılır', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Neden seçilir', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Fotoğraf zorunlu mu?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Evet',
          steps: [
            { type: 'node', label: 'Kamera açılır', variant: 'process' },
            { type: 'arrow' },
            { type: 'node', label: 'Fotoğraf yüklenir', variant: 'process' },
          ],
        },
        no: {
          label: 'Hayır',
          steps: [
            { type: 'node', label: 'Direkt devam', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'DeliveryFailed API', variant: 'external' },
      { type: 'arrow' },
      { type: 'node', label: 'Gönderi durumu güncellenir', variant: 'end' },
    ],
    tips: [
      'SI\'da sınırlı neden listesi kullanılır — CORE\'a göre daha az seçenek',
      'BA\'da fotoğraf çekilemez — kamera iznine rağmen fotoğraf adımı atlanır',
      'RS ve ME\'de fotoğraf opsiyonel — kurye isterse atlayabilir',
      'CameraFragment ~35K satır — en büyük fragment, refactoring ihtiyacı yüksek',
      'Fotoğraf yükleme offline modda kuyrukta kalır',
    ],
    tickets: [
      { id: 'NESY-89', title: 'Fotoğraf yükleme sırasında bellek yetersizliği', status: 'open' },
      { id: 'NESY-134', title: 'Başarısız neden listesi ülkeye göre filtre çalışmıyor', status: 'closed' },
    ],
    experts: [
      { name: 'Mobile Geliştirici', role: 'Kamera & Fotoğraf Akışı' },
    ],
    score: { bugProneness: 4, boilerplate: 3, complexity: 3, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Task/DeliveryFailed', desc: 'Başarısız teslimat bildirimi' },
      { method: 'POST', endpoint: 'Task/f/SaveImageFile', desc: 'Fotoğraf yükleme (multipart)' },
    ],
  },

  consignee_info: {
    whatIs:
      'Teslimat anında alıcı adının gösterilmesi ve düzenlenebilirliği. CORE davranışında alıcı adı gönderi verisinden ön-dolu gelir ve düzenlenebilir. HR\'de ise ad ön-dolu değildir, harici olarak (SMS/telefon) bildirilir.',
    howItWorks: [
      'Kurye teslimat ekranına gelir',
      'Alıcı adı alanı gönderi verisinden dolu veya boş gelir (ülkeye göre)',
      'Kurye gerekirse adı düzenleyebilir',
      'Teslimat tamamlandığında alıcı adı kaydedilir',
    ],
    screens: [
      'DeliveryFragment — Alıcı bilgi alanı',
    ],
    parameters: [
      { name: 'country.consigneePreFilled', desc: 'Alıcı adı ön-dolu mu?', type: 'boolean' },
      { name: 'country.consigneeEditable', desc: 'Alıcı adı düzenlenebilir mi?', type: 'boolean' },
    ],
    diagram: [
      { type: 'node', label: 'Teslimat ekranı açılır', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Ön-dolu mu?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Evet',
          steps: [
            { type: 'node', label: 'Dolu gösterilir', variant: 'process' },
          ],
        },
        no: {
          label: 'Hayır',
          steps: [
            { type: 'node', label: 'Kurye yazar', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Düzenlenir', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Kaydedilir', variant: 'end' },
    ],
    tips: [
      'HR\'de alıcı adı ön-dolu gelmez — kurye teslimat anında sorar ve yazar',
      'Bu davranış HR\'ye özel, diğer tüm ülkelerde CORE ile aynı',
    ],
    tickets: [],
    experts: [
      { name: 'HR Operasyon', role: 'Hırvatistan Özel Kuralları' },
    ],
    score: { bugProneness: 1, boilerplate: 1, complexity: 1, testCoverage: 1 },
  },

  signature_dp: {
    whatIs:
      'Teslimat anında dijital (ekran üzeri) ve fiziksel (basılı belge üzeri) imza toplama. Dijital imza kurye cihazının ekranında alınır. Fiziksel imza için teslimat listesi (dely list) indirilip bastırılır ve müşteriye imzalattırılır.',
    howItWorks: [
      'Teslimat onay adımında imza ekranı açılır',
      'Alıcı parmağıyla dijital imza atar',
      'İmza görüntüsü base64 olarak kaydedilir (SaveSignature API)',
      'Teslimat listesi (dely list) indirilebilir ve fiziksel imza alınabilir',
      'İmza zorunluluğu ülkeye göre değişir',
    ],
    screens: [
      'SignaturePadFragment — Dijital imza ekranı',
      'DeliveryFragment — İmza tetikleme',
    ],
    parameters: [
      { name: 'country.signatureMandatory', desc: 'Dijital imza zorunlu mu?', type: 'boolean' },
      { name: 'country.delyListEnabled', desc: 'Dely list indirme aktif mi?', type: 'boolean' },
    ],
    diagram: [
      { type: 'node', label: 'Teslimat onayı', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Zorunlu mu?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Evet',
          steps: [
            { type: 'node', label: 'İmza ekranı açılır', variant: 'process' },
          ],
        },
        no: {
          label: 'Opsiyonel',
          steps: [
            { type: 'node', label: 'Kurye istiyor mu?', variant: 'decision' },
            {
              type: 'branch',
              yes: {
                label: 'Evet',
                steps: [
                  { type: 'node', label: 'İmza ekranı açılır', variant: 'process' },
                ],
              },
              no: {
                label: 'Hayır',
                steps: [
                  { type: 'node', label: 'Devam', variant: 'process' },
                ],
              },
            },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Alıcı imzalar', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'SaveSignature API', variant: 'external' },
      { type: 'arrow' },
      { type: 'node', label: 'Devam', variant: 'end' },
    ],
    tips: [
      'RS, BA ve ME\'de dijital imza opsiyoneldir — kurye atlayabilir',
      'Dely list HR\'de kod merge sonrasında aktif hale gelmiştir',
      'İmza pad touch sensitivity cihaza göre değişir — bazı Zebra cihazlarda sorun yaşanabilir',
    ],
    tickets: [
      { id: 'NESY-67', title: 'İmza pad\'de çok ince çizgi sorunu', status: 'closed' },
    ],
    experts: [
      { name: 'Mobile Geliştirici', role: 'UI Bileşenleri' },
    ],
    score: { bugProneness: 2, boilerplate: 2, complexity: 2, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Shipment/SaveSignature', desc: 'İmza kaydetme' },
    ],
  },

  delivery_parcelshop: {
    whatIs:
      'Gönderilerin parcel shop (pick-up noktası) veya şubeye teslimi. Kurye, alıcı yerine bir parcel shop noktasına teslimat yapar. RDOC ve OVSZ (oversized) gönderiler parcel shop\'a teslim edilemez.',
    howItWorks: [
      'Teslimat görevi parcel shop adresine atanır',
      'Kurye parcel shop\'a gelir',
      'Gönderiler teslim edilir (ReleaseParcel API)',
      'RDOC ve OVSZ kontrolü yapılır — bu tipler engellidir',
      'Teslim edilen gönderiler için DEPT event oluşur',
    ],
    screens: [
      'ParcelReleaseFragment — Parsel bırakma ekranı',
      'StopListFragment — Durak listesi (parcel shop duraklı)',
    ],
    parameters: [
      { name: 'shipment.isRDOC', desc: 'Gönderi RDOC tipinde mi?', type: 'boolean' },
      { name: 'shipment.isOVSZ', desc: 'Gönderi oversized mı?', type: 'boolean' },
      { name: 'counterLocation.type', desc: 'Teslim noktası tipi (parcelshop/locker)', type: 'enum' },
    ],
    diagram: [
      { type: 'node', label: 'Görev atanır', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'PS\'ye gelir', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'RDOC/OVSZ?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Engel',
          steps: [
            { type: 'node', label: 'Teslim edilemez', variant: 'error' },
          ],
        },
        no: {
          label: 'Normal',
          steps: [
            { type: 'node', label: 'ReleaseParcel API', variant: 'external' },
            { type: 'arrow' },
            { type: 'node', label: 'DEPT event oluşur', variant: 'process' },
            { type: 'arrow' },
            { type: 'node', label: 'Tamamlanır', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Akış sona erer', variant: 'end' },
    ],
    tips: [
      'RDOC gönderiler hiçbir ülkede parcel shop\'a teslim edilemez',
      'OVSZ gönderiler de engellenir — boyut kontrolü frontend\'de yapılır',
      'BA ve ME\'de parcel shop altyapısı yoktur (N/A)',
    ],
    tickets: [],
    experts: [
      { name: 'Operasyon Ekibi', role: 'Parcel Shop Süreçleri' },
    ],
    score: { bugProneness: 2, boilerplate: 2, complexity: 2, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Task/ReleaseParcel', desc: 'Parsel bırakma işlemi' },
      { method: 'POST', endpoint: 'Integration/ProcessHandOverParcelsToCounterLocation', desc: 'Kolileri teslim noktasına devretme' },
    ],
  },

  delivery_locker: {
    whatIs:
      'D4ME (Direct4Me) akıllı dolap entegrasyonu üzerinden dolap teslimatı. Kurye, gönderiyi akıllı dolaba bırakır ve alıcı kendisi dolaptam alır. D4ME uygulaması ile entegre çalışır.',
    howItWorks: [
      'Kurye dolap konumuna gelir',
      'D4ME uygulaması açılır (intent ile)',
      'Dolap rezervasyonu kontrol edilir veya oluşturulur',
      'Kurye koliyi dolaba yerleştirir',
      'DEPT event\'i D4MeCallback ile gönderilir',
      'Alıcı alırsa DELY, almazsa Locker Pickup görevi oluşur',
    ],
    screens: [
      'LeanLockerFragment — Dolap etkileşim ekranı',
      'D4ME External App — Harici D4ME uygulaması',
    ],
    parameters: [
      { name: 'd4me.packageName', desc: 'D4ME uygulama paket adı', type: 'string' },
      { name: 'shipment.lockerReservationId', desc: 'Dolap rezervasyon ID', type: 'string' },
      { name: 'shipment.isRDOC', desc: 'RDOC gönderiler dolaba konulamaz', type: 'boolean' },
    ],
    diagram: [
      { type: 'node', label: 'Dolap konumuna gelir', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'D4ME açılır', variant: 'external' },
      { type: 'arrow' },
      { type: 'node', label: 'Rezervasyon var mı?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Evet',
          steps: [
            { type: 'node', label: 'Kapak açılır', variant: 'process' },
          ],
        },
        no: {
          label: 'Hayır',
          steps: [
            { type: 'node', label: 'CreateD4MReservation', variant: 'external' },
            { type: 'arrow' },
            { type: 'node', label: 'Kapak açılır', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Koli yerleştirilir', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'DEPT callback gönderilir', variant: 'external' },
      { type: 'arrow' },
      { type: 'node', label: 'Alıcı aldı mı?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Evet',
          steps: [
            { type: 'node', label: 'DELY callback', variant: 'process' },
          ],
        },
        no: {
          label: 'Hayır',
          steps: [
            { type: 'node', label: 'Locker Pickup görevi oluşur', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Akış tamamlanır', variant: 'end' },
    ],
    tips: [
      'D4ME uygulamasının cihazda kurulu olması gerekir — yoksa Google Play\'e yönlendirilir',
      'RDOC ve OVSZ gönderiler dolaba konulamaz',
      'RS\'de Legacy ID\'nin ilk 14 hanesi ile eşleme yapılır — tam ID yerine kısaltılmış ID gönderilir',
      'D4ME callback\'leri async gelir — birden fazla gün sürebilir',
      'Dolap dolu olabilir — kapasite kontrolü D4ME tarafında yapılır',
    ],
    tickets: [
      { id: 'NESY-112', title: 'D4ME callback sonrası gönderi durumu güncellenmemesi', status: 'open' },
      { id: 'NESY-198', title: 'RS\'de 14 haneli ID eşleme hatası', status: 'open' },
      { id: 'NESY-76', title: 'D4ME uygulama versiyonu uyumsuzluğu', status: 'closed' },
    ],
    experts: [
      { name: 'D4ME Entegrasyon Ekibi', role: 'Dolap Entegrasyonu' },
    ],
    score: { bugProneness: 5, boilerplate: 4, complexity: 5, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Task/CreateD4MReservation', desc: 'D4ME dolap rezervasyonu oluşturma' },
      { method: 'POST', endpoint: 'Task/DeleteD4MReservation', desc: 'D4ME rezervasyon iptali' },
      { method: 'POST', endpoint: 'Task/CompleteD4MShipments', desc: 'D4ME teslimat tamamlama' },
      { method: 'POST', endpoint: 'Shipment/ActiveD4MCounterLocations', desc: 'Aktif D4ME dolap konumları' },
      { method: 'POST', endpoint: 'Shipment/ActiveLockerCounterLocations', desc: 'Aktif dolap konumları listesi' },
    ],
  },

  /* ═══════════════════════════════════════════════════════
   * PICKUP PROCESS MODULE
   * ═══════════════════════════════════════════════════════ */

  pickup_assignment: {
    whatIs:
      'Toplama görevlerinin kuryelere atanma mekanizması. CORE davranışında toplama görevleri her 3 dakikada çalışan bir job tarafından otomatik atanır. Bazı ülkelerde ise dispatcher tarafından manuel atama yapılır.',
    howItWorks: [
      'Backend\'de GeneratePickupTaskJob her 3 dakikada çalışır (CORE)',
      'Veya dispatcher backoffice\'ten kurye seçerek manuel atama yapar',
      'Atanan görev kurye\'nin schedule\'üne eklenir',
      'Kurye task listesinde yeni görevi görür',
      'Push notification ile bilgilendirilir',
    ],
    screens: [
      'TaskListFragment — Görev listesi',
      'StopListFragment — Durak listesi (pickup durakları)',
    ],
    parameters: [
      { name: 'country.pickupAutoAssign', desc: 'Otomatik atama aktif mi?', type: 'boolean' },
      { name: 'job.interval', desc: 'Otomatik atama job çalışma aralığı (dk)', type: 'number' },
    ],
    diagram: [
      { type: 'node', label: 'Atama tipi belirlenir', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Atama tipi?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Otomatik',
          steps: [
            { type: 'node', label: 'Job çalışır', variant: 'process', desc: 'GeneratePickupTaskJob' },
          ],
        },
        no: {
          label: 'Manuel',
          steps: [
            { type: 'node', label: 'Dispatcher seçer', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Schedule\'e eklenir', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Bildirim gönderilir', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Listede görünür', variant: 'end' },
    ],
    tips: [
      'HR, RS ve BA\'da dispatcher manuel atar — otomatik atama kapalıdır',
      'SI ve ME\'de CORE ile aynı — otomatik atama aktif',
      'Manuel atamada dispatcher kurye\'nin mevcut yükünü görebilir',
    ],
    tickets: [],
    experts: [
      { name: 'Backend Ekibi', role: 'Görev Atama Motoru' },
    ],
    score: { bugProneness: 2, boilerplate: 1, complexity: 2, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Task/GeneratePickupTaskJobNew', desc: 'Pickup görev job tetikleme' },
    ],
  },

  collect_cpp: {
    whatIs:
      'Toplama noktasında CPP (Cash Pre-Paid) gönderiler için tahsilat. Göndericiden toplama anında nakit veya kredi kartı ile ödeme alınır. COD\'dan farklı olarak ödeme toplama sırasında gerçekleşir.',
    howItWorks: [
      'Kurye toplama görevini seçer',
      'Gönderi CPP ise tahsilat ekranı açılır',
      'Ödeme yöntemi seçilir',
      'Tahsilat tamamlanır',
      'Fiskal fiş gerekiyorsa tetiklenir (RS)',
      'Toplama işlemi devam eder',
    ],
    screens: [
      'PickupFragment — Toplama ekranı',
      'PaymentFragment — Ödeme seçim ekranı',
    ],
    parameters: [
      { name: 'shipment.isCPP', desc: 'Gönderi CPP tipinde mi?', type: 'boolean' },
      { name: 'shipment.cppAmount', desc: 'CPP tahsilat tutarı', type: 'decimal' },
    ],
    diagram: [
      { type: 'node', label: 'Toplama görevi seçilir', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'CPP gönderi mi?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Evet',
          steps: [
            { type: 'node', label: 'Tahsilat ekranı açılır', variant: 'process' },
            { type: 'arrow' },
            { type: 'node', label: 'Ödeme yöntemi seçilir', variant: 'process' },
            { type: 'arrow' },
            { type: 'node', label: 'Tahsilat tamamlanır', variant: 'process' },
            { type: 'arrow' },
            { type: 'node', label: 'Fiskal fiş gerekli mi?', variant: 'decision' },
            {
              type: 'branch',
              yes: {
                label: 'Evet',
                steps: [
                  { type: 'node', label: 'VPFR tetiklenir', variant: 'external' },
                ],
              },
              no: {
                label: 'Hayır',
                steps: [
                  { type: 'node', label: 'Devam', variant: 'process' },
                ],
              },
            },
          ],
        },
        no: {
          label: 'Hayır',
          steps: [
            { type: 'node', label: 'Normal toplama', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Devam', variant: 'end' },
    ],
    tips: [
      'SI, BA ve ME\'de CPP tahsilatı desteklenmez (N/A)',
      'HR\'de kredi kartı tahsilatı RaiPay üzerinden yapılır',
      'RS\'de SoftPos entegrasyonu planlanmıştır ama henüz entegre edilmemiştir',
    ],
    tickets: [
      { id: 'NESY-167', title: 'CPP toplama sonrası fiskal fiş hatalı tutar', status: 'open' },
    ],
    experts: [
      { name: 'Finans Ekibi', role: 'Tahsilat Akışları' },
    ],
    score: { bugProneness: 3, boilerplate: 3, complexity: 3, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Shipment/GetShipmentCollectionStatus', desc: 'CPP tahsilat durumu' },
      { method: 'POST', endpoint: 'Shipment/GetCollectionsFromShipment', desc: 'Gönderi tahsilat detayları' },
    ],
  },

  pickup_fiscalization: {
    whatIs:
      'CPP gönderiler için toplama anında fiskal fiş oluşturma. Delivery fiskalizasyonuyla aynı VPFR altyapısını kullanır ancak yalnızca CPP gönderiler için tetiklenir. Şu an sadece RS\'de aktif.',
    howItWorks: [
      'CPP toplama tamamlanır',
      'Ödeme başarılı olursa VPFR tetiklenir',
      'CreateFiscalInvoice API çağrılır',
      'Fiş numarası alınır ve yazdırılır',
    ],
    screens: [
      'FiscalPrintFragment — Fiş yazdırma',
      'PickupFragment — Toplama ekranı (tetikleyici)',
    ],
    parameters: [
      { name: 'country.pickupFiscalEnabled', desc: 'Toplama fiskalizasyonu aktif mi?', type: 'boolean' },
    ],
    diagram: [
      { type: 'node', label: 'CPP toplama tamamlanır', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Ödeme başarılı', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'VPFR tetiklenir', variant: 'external' },
      { type: 'arrow' },
      { type: 'node', label: 'CreateFiscalInvoice API', variant: 'external' },
      { type: 'arrow' },
      { type: 'node', label: 'Başarılı?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Evet',
          steps: [
            { type: 'node', label: 'Fiş yazdırılır', variant: 'process' },
          ],
        },
        no: {
          label: 'Hayır',
          steps: [
            { type: 'node', label: 'Retry', variant: 'error' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Devam', variant: 'end' },
    ],
    tips: [
      'Yalnızca RS\'de aktif — diğer tüm ülkelerde N/A',
      'Delivery fiskalizasyonu ile aynı API\'ları kullanır',
      'CPP olmayan gönderiler için tetiklenmez',
    ],
    tickets: [],
    experts: [
      { name: 'RS Operasyon', role: 'VPFR Süreçleri' },
    ],
    score: { bugProneness: 3, boilerplate: 4, complexity: 4, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Shipment/CreateFiscalInvoice', desc: 'Fiskal fiş oluşturma' },
      { method: 'POST', endpoint: 'Shipment/RetryFiscalInvoice', desc: 'Fiskal retry' },
    ],
  },

  pickup_at_customer: {
    whatIs:
      'PAC (Pickup at Customer) görev davranışı. Müşteri lokasyonundan koli toplama görevi. Aksiyonsuz PAC görevi gün sonunu engeller (CORE) veya engellemez (SI). Bu kural gün sonu (End of Day) akışını doğrudan etkiler.',
    howItWorks: [
      'PAC görevi kurye\'nin schedule\'üne atanır',
      'Kurye müşteri lokasyonuna gider',
      'Kolileri toplar ve araçta okutarak onaylar',
      'Eğer PAC görevi aksiyonsuz bırakılırsa:',
      '  - CORE/HR/RS/BA/ME: Gün sonunu engeller',
      '  - SI: Gün sonunu ENGELLEMEZ',
    ],
    screens: [
      'PickupFragment — Toplama ekranı',
      'TaskListFragment — Görev listesi',
    ],
    parameters: [
      { name: 'country.pacBlocksEod', desc: 'PAC görevi gün sonunu engelliyor mu?', type: 'boolean' },
    ],
    diagram: [
      { type: 'node', label: 'PAC görevi atanır', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Lokasyona gidilir', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Koliler toplanır', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Okutma yapılır', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Aksiyonsuz mu?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Evet',
          steps: [
            { type: 'node', label: 'EOD engeller mi?', variant: 'decision' },
            {
              type: 'branch',
              yes: {
                label: 'CORE',
                steps: [
                  { type: 'node', label: 'Engeller', variant: 'error' },
                ],
              },
              no: {
                label: 'SI',
                steps: [
                  { type: 'node', label: 'Engellemez', variant: 'process' },
                ],
              },
            },
          ],
        },
        no: {
          label: 'Hayır',
          steps: [
            { type: 'node', label: 'Tamamlandı', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Akış sona erer', variant: 'end' },
    ],
    tips: [
      'SI\'da aksiyonsuz PAC görevi gün sonunu engellemez — kurye ertesi güne bırakabilir',
      'Diğer tüm ülkelerde PAC tamamlanmadan gün sonu yapılamaz',
      'PAC ve PickupAtCustomer farkı: PAC müşteri talebine bağlı, Pickup schedule\'a bağlı',
    ],
    tickets: [],
    experts: [
      { name: 'Operasyon Ekibi', role: 'Görev Yönetimi' },
    ],
    score: { bugProneness: 2, boilerplate: 1, complexity: 2, testCoverage: 1 },
  },

  remote_pickup: {
    whatIs:
      'Mobil uygulamada gönderici ve alıcı bilgilerinin gösterimi. Remote pickup senaryosunda gönderici bilgileri kurye uygulamasında gösterilir. BA\'da ek olarak alıcı bilgileri de gösterilir.',
    howItWorks: [
      'Toplama görevi atanır',
      'Kurye görev detaylarını açar',
      'Gönderici bilgileri (ad, adres, telefon) gösterilir',
      'BA\'da ek olarak alıcı bilgileri de görünür',
    ],
    screens: [
      'PickupFragment — Toplama detay ekranı',
      'TaskListFragment — Görev listesi',
    ],
    parameters: [
      { name: 'country.showReceiverInPickup', desc: 'Toplamada alıcı bilgisi gösterilsin mi?', type: 'boolean' },
    ],
    diagram: [
      { type: 'node', label: 'Görev atanır', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Detaylar açılır', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Gönderici bilgileri gösterilir', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'BA mı?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Evet',
          steps: [
            { type: 'node', label: 'Alıcı bilgileri de gösterilir', variant: 'process' },
          ],
        },
        no: {
          label: 'Hayır',
          steps: [
            { type: 'node', label: 'Sadece gönderici gösterilir', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Toplama başlar', variant: 'end' },
    ],
    tips: [
      'BA\'da alıcı bilgileri de gösterilir — kurye koliyi doğru adrese yönlendirebilir',
      'Diğer ülkelerde yalnızca gönderici bilgisi görünür',
    ],
    tickets: [],
    experts: [
      { name: 'BA Operasyon', role: 'Bosna Özel Kuralları' },
    ],
    score: { bugProneness: 1, boilerplate: 1, complexity: 1, testCoverage: 1 },
  },

  red_label: {
    whatIs:
      'Red label (kırmızı etiketli) gönderilerin mobil uygulama üzerinden toplanması. Red label, etiket bilgileri eksik gönderiler için kullanılır. Kurye koliyi toplar, Npoint\'te indirir, gönderi oluşturulur ve backoffice eksik veriyi tamamlar.',
    howItWorks: [
      'Pickup at customer görevi oluşur (red label)',
      'Kurye müşteriye gider ve koliyi toplar',
      'Koli Npoint\'te (hub) indirilir',
      'CreateRedGreyLabelShipmentWithoutDetails API çağrılır',
      'Gönderi sisteme oluşturulur (eksik detaylarla)',
      'Backoffice operatörü eksik bilgileri tamamlar',
    ],
    screens: [
      'GrayLabelFragment — Red/gray label toplama ekranı',
      'PickupFragment — Toplama akışı',
    ],
    parameters: [
      { name: 'shipment.isRedLabel', desc: 'Gönderi red label mı?', type: 'boolean' },
      { name: 'country.redLabelEnabled', desc: 'Red label toplama aktif mi?', type: 'boolean' },
    ],
    diagram: [
      { type: 'node', label: 'PAC görevi oluşur', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Müşteriye gidilir', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Koli toplanır', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Npoint\'te indirilir', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'CreateRedGreyLabel API', variant: 'external' },
      { type: 'arrow' },
      { type: 'node', label: 'Gönderi oluşturulur', variant: 'process', desc: 'Eksik detaylarla' },
      { type: 'arrow' },
      { type: 'node', label: 'Backoffice tamamlar', variant: 'end' },
    ],
    tips: [
      'SI ve ME\'de red label toplama desteklenmez (N/A)',
      'Red label ve gray label aynı fragment\'ı (GrayLabelFragment) kullanır',
      'Gönderi backoffice\'te tamamlanana kadar teslimat yapılamaz',
    ],
    tickets: [
      { id: 'NESY-155', title: 'Red label gönderi oluşturma sırasında timeout', status: 'open' },
    ],
    experts: [
      { name: 'Operasyon Ekibi', role: 'Red Label Süreçleri' },
    ],
    score: { bugProneness: 3, boilerplate: 2, complexity: 3, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Shipment/CreateRedGreyLabelShipmentWithoutDetails', desc: 'Red/gray label gönderi oluşturma' },
    ],
  },

  pickup_failed_non_rdoc: {
    whatIs:
      'RDOC olmayan toplama görevleri için başarısız neden kodları. Kurye toplama yapamadığında uygun bir neden kodu seçer. Neden kodları: NOPC, NPNP, NRDY, NSYS, PABS, PADU, PTIM.',
    howItWorks: [
      'Kurye "Toplama Başarısız" seçer',
      'Neden kodu listesi açılır',
      'Uygun kod seçilir',
      'PickupFailed API çağrılır',
      'Seçilen koda göre otomatik yeniden atama tetiklenebilir',
    ],
    screens: [
      'PickupFailedFragment — Başarısız toplama neden ekranı',
    ],
    parameters: [
      { name: 'failedReason.code', desc: 'Başarısız neden kodu (NOPC/NPNP/NRDY/NSYS/PABS/PADU/PTIM)', type: 'enum' },
    ],
    diagram: [
      { type: 'node', label: 'Başarısız seçilir', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Neden listesi açılır', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Kod seçilir', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'PickupFailed API', variant: 'external' },
      { type: 'arrow' },
      { type: 'node', label: 'Otomatik yeniden atama?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Evet',
          steps: [
            { type: 'node', label: 'Ertesi gün atanır', variant: 'process' },
          ],
        },
        no: {
          label: 'Hayır',
          steps: [
            { type: 'node', label: 'Kapanır', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Akış tamamlanır', variant: 'end' },
    ],
    tips: [
      'Tüm ülkelerde CORE ile aynı neden kodları kullanılır',
      'Bazı neden kodları otomatik yeniden atamayı tetikler (bkz. auto_reassignment)',
      'NOPC: No Parcel / NPNP: Not at Pickup Point / NRDY: Not Ready / NSYS: System / PABS: Absent / PADU: Address Unknown / PTIM: Past Time',
    ],
    tickets: [],
    experts: [
      { name: 'Operasyon Ekibi', role: 'Toplama Süreçleri' },
    ],
    score: { bugProneness: 1, boilerplate: 1, complexity: 1, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Task/PickupFailed', desc: 'Toplama başarısız bildirimi' },
    ],
  },

  rdoc_failed_reasons: {
    whatIs:
      'RDOC (Return Document) toplama görevleri için başarısız neden kodları. RDOC görevleri yalnızca NOPC neden koduyla başarısız olabilir — diğer kodlar kullanılamaz.',
    howItWorks: [
      'Kurye RDOC toplama görevini başarısız yapar',
      'Tek seçenek olarak NOPC gösterilir',
      'PickupFailed API çağrılır',
    ],
    screens: [
      'PickupFailedFragment — Başarısız RDOC ekranı',
    ],
    parameters: [
      { name: 'task.isRDOC', desc: 'Görev RDOC tipinde mi?', type: 'boolean' },
    ],
    diagram: [
      { type: 'node', label: 'RDOC başarısız', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Tek seçenek: NOPC', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'NOPC seçilir', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'PickupFailed API', variant: 'external' },
      { type: 'arrow' },
      { type: 'node', label: 'Kapanır', variant: 'end' },
    ],
    tips: [
      'RDOC görevlerde yalnızca NOPC kullanılabilir — UI tek seçenek gösterir',
      'Tüm ülkelerde aynı davranış',
    ],
    tickets: [],
    experts: [
      { name: 'Operasyon Ekibi', role: 'RDOC Süreçleri' },
    ],
    score: { bugProneness: 1, boilerplate: 1, complexity: 1, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Task/PickupFailed', desc: 'RDOC başarısız bildirimi' },
    ],
  },

  auto_reassignment: {
    whatIs:
      'Başarısız toplama sonrası otomatik yeniden atama. Belirli başarısız neden kodları bir sonraki iş gününe otomatik yeniden atamayı tetikler. Tetikleyici kodlar ülkeye göre farklılık gösterir.',
    howItWorks: [
      'Toplama başarısız olur',
      'Seçilen neden kodu kontrol edilir',
      'Kod tetikleyici listesindeyse otomatik yeniden atama planlanır',
      'Ertesi iş günü görev kurye\'ye tekrar atanır',
    ],
    screens: [
      'Background Service — Otomatik yeniden atama (backend tarafında)',
    ],
    parameters: [
      { name: 'country.autoReassignCodes', desc: 'Otomatik yeniden atama tetikleyen kodlar', type: 'string[]' },
    ],
    diagram: [
      { type: 'node', label: 'Toplama başarısız olur', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Kod kontrol edilir', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Tetikleyici mi?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Evet',
          steps: [
            { type: 'node', label: 'Yeniden atama planlanır', variant: 'process' },
            { type: 'arrow' },
            { type: 'node', label: 'Ertesi gün atanır', variant: 'process' },
          ],
        },
        no: {
          label: 'Hayır',
          steps: [
            { type: 'node', label: 'Kapanır', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Akış tamamlanır', variant: 'end' },
    ],
    tips: [
      'CORE: NPNP, NRDY, PABS, PTIM',
      'SI: NPNP, NRDY, PABS, PADU, PTIM (+PADU)',
      'RS: NPNP, NRDY, NSYS, PABS, PADU, PTIM (+NSYS, +PADU)',
      'BA ve ME\'de otomatik yeniden atama yoktur',
    ],
    tickets: [],
    experts: [
      { name: 'Backend Ekibi', role: 'Görev Yönetimi' },
    ],
    score: { bugProneness: 2, boilerplate: 1, complexity: 2, testCoverage: 1 },
  },

  /* ═══════════════════════════════════════════════════════
   * TOUR & STOP MANAGEMENT MODULE
   * ═══════════════════════════════════════════════════════ */

  creation_of_stops: {
    whatIs:
      'Otomatik ve manuel durak oluşturma ile gönderi birleştirme kuralları. Aynı alıcı adı ve adresine sahip gönderiler otomatik olarak aynı durakta birleşir. Tur başlamadan önce kurye durakları manuel birleştirebilir.',
    howItWorks: [
      'Schedule yüklendiğinde gönderiler adreslere göre gruplandırılır',
      'Aynı alıcı + adres → aynı durakta birleşir (delivery)',
      'Aynı gönderici + adres → aynı durakta birleşir (pickup)',
      'Tur onayından sonra yeni gelen gönderiler, eşleşen durak yoksa yeni durak oluşturur',
      'Tur başlangıcından önce kurye durakları manuel birleştirebilir',
    ],
    screens: [
      'StopListFragment — Durak listesi ve yönetimi',
    ],
    parameters: [
      { name: 'stop.mergeKey', desc: 'Birleştirme anahtarı (ad+adres hash)', type: 'string' },
      { name: 'schedule.isApproved', desc: 'Tur onaylandı mı?', type: 'boolean' },
    ],
    diagram: [
      { type: 'node', label: 'Schedule yüklenir', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Adrese göre gruplama yapılır', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Aynı alıcı+adres mi?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Evet',
          steps: [
            { type: 'node', label: 'Birleşir', variant: 'process' },
          ],
        },
        no: {
          label: 'Hayır',
          steps: [
            { type: 'node', label: 'Yeni durak oluşur', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Sonradan gelen gönderi?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Eşleşen var',
          steps: [
            { type: 'node', label: 'Mevcut durağa eklenir', variant: 'process' },
          ],
        },
        no: {
          label: 'Eşleşen yok',
          steps: [
            { type: 'node', label: 'Yeni durak oluşur', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Duraklar hazır', variant: 'end' },
    ],
    tips: [
      'Tüm ülkelerde CORE ile aynı davranış',
      'Adres eşleşmesi case-insensitive yapılır',
      'Tur onayından sonra otomatik birleştirme devam eder ama manuel birleştirme yapılamaz',
    ],
    tickets: [
      { id: 'NESY-91', title: 'Farklı adreslerin yanlışlıkla birleşmesi', status: 'closed' },
    ],
    experts: [
      { name: 'Backend Ekibi', role: 'Durak Yönetimi' },
    ],
    score: { bugProneness: 3, boilerplate: 2, complexity: 3, testCoverage: 1 },
  },

  merge_stops_manual: {
    whatIs:
      'Kurye\'nin durakları manuel olarak birleştirmesi. Bir ana durak seçilir ve diğer duraklar onun altına alınır. Bu işlem yalnızca tur başlamadan önce yapılabilir.',
    howItWorks: [
      'Kurye durak listesinde "Birleştir" modunu açar',
      'Ana durak seçilir',
      'Birleştirilecek alt duraklar seçilir',
      'ManuelMergeStopsInSchedule API çağrılır',
      'Duraklar tek durak altında birleşir',
    ],
    screens: [
      'MergeStopsFragment — Durak birleştirme ekranı',
      'StopListFragment — Durak listesi',
    ],
    parameters: [
      { name: 'mainStop.id', desc: 'Ana durak ID\'si', type: 'string' },
      { name: 'subStops', desc: 'Birleştirilecek alt durak ID listesi', type: 'string[]' },
    ],
    diagram: [
      { type: 'node', label: 'Birleştir modu açılır', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Ana durak seçilir', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Alt duraklar seçilir', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'ManuelMergeStopsInSchedule API', variant: 'external' },
      { type: 'arrow' },
      { type: 'node', label: 'Duraklar birleşir', variant: 'end' },
    ],
    tips: [
      'Tur başladıktan sonra birleştirme yapılamaz',
      'Split (ayırma) da aynı ekrandan yapılabilir (ManuelSplitStopsInSchedule)',
      'Tüm ülkelerde aynı davranış',
    ],
    tickets: [],
    experts: [
      { name: 'Mobile Geliştirici', role: 'Durak Yönetimi UI' },
    ],
    score: { bugProneness: 2, boilerplate: 2, complexity: 2, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Task/ManuelMergeStopsInSchedule', desc: 'Manuel durak birleştirme' },
      { method: 'POST', endpoint: 'Task/ManuelSplitStopsInSchedule', desc: 'Manuel durak ayırma' },
    ],
  },

  tour_start_approval: {
    whatIs:
      'Gün başında koli okutma ve tur başlangıç onay akışı. Kurye rota seçer, kolileri barkod okutarak araçta onaylar ve tur başlangıcı için onay talebi gönderir. HR ve SI\'da ilk tur onayından sonra ek okutulan koliler otomatik onaylanır.',
    howItWorks: [
      'Kurye schedule\'den rota seçer',
      'Kolileri barkod okutarak yükler (LoadParcelToCourierVehicle)',
      'Tur onay talebi gönderir',
      'Dispatcher onaylar (veya CORE\'da otomatik onay)',
      'Tur başlar ve kurye durak listesine yönlendirilir',
    ],
    screens: [
      'ScanFragment — Barkod okutma ekranı',
      'ScheduleFragment — Rota seçim ekranı',
      'StopListFragment — Tur başladıktan sonra durak listesi',
    ],
    parameters: [
      { name: 'schedule.routeCode', desc: 'Seçilen rota kodu', type: 'string' },
      { name: 'country.autoApproveAfterFirst', desc: 'İlk onay sonrası otomatik mı?', type: 'boolean' },
    ],
    diagram: [
      { type: 'node', label: 'Rota seçilir', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Koli okutma', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'LoadParcelToCourierVehicle API', variant: 'external' },
      { type: 'arrow' },
      { type: 'node', label: 'Tur onay talebi gönderilir', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Onay türü?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Manuel',
          steps: [
            { type: 'node', label: 'Dispatcher onaylar', variant: 'process' },
          ],
        },
        no: {
          label: 'Otomatik',
          steps: [
            { type: 'node', label: 'Auto onay', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Tur başlar', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Durak listesi gösterilir', variant: 'end' },
    ],
    tips: [
      'HR ve SI\'da ilk tur onayından sonra ek gelen koliler otomatik onaylanır — ikinci onay gerekmez',
      'CORE, RS, BA, ME\'de her tur başlangıcı onay gerektirir',
      'Barkod okutma Zebra DataWedge, Honeywell ve kamera (MLKit) ile desteklenir',
      'Scan fragment barkod routing mantığı oldukça karmaşık — farklı barkod formatları farklı akışlar tetikler',
    ],
    tickets: [
      { id: 'NESY-203', title: 'Tur onayı bekleme sırasında schedule kaybolması', status: 'open' },
      { id: 'NESY-58', title: 'Barkod okutma sırasında çift okutma sorunu', status: 'open' },
    ],
    experts: [
      { name: 'Mobile Geliştirici', role: 'Barkod/Scan Akışları' },
      { name: 'Operasyon Ekibi', role: 'Tur Yönetimi' },
    ],
    score: { bugProneness: 4, boilerplate: 4, complexity: 4, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Task/LoadParcelToCourierVehicle', desc: 'Koli araçta okutma' },
      { method: 'POST', endpoint: 'Task/GetMyScheduleByZoneCode', desc: 'Schedule sorgulama' },
      { method: 'POST', endpoint: 'Task/AddUserIdToSchedule', desc: 'Kullanıcıyı schedule\'e ekleme' },
      { method: 'POST', endpoint: 'Task/ScheduleStatusChange', desc: 'Schedule durum değişikliği' },
    ],
  },

  app_hc_event_list: {
    whatIs:
      'Mobil uygulama event listesi — uygulamadaki mevcut event tipleri. Event\'ler gönderilerin hayat döngüsündeki aşamaları temsil eder. Bazı ülkelerde ek event\'ler mevcuttur.',
    howItWorks: [
      'EventTower/GetEvents API\'dan event tipi listesi çekilir',
      'Kurye gönderi üzerinde event seçebilir',
      'Seçilen event gönderi durumunu günceller',
    ],
    screens: [
      'EventListFragment — Event listesi ekranı',
      'MainActivity — Ana uygulama (event tetikleme)',
    ],
    parameters: [
      { name: 'country.additionalEvents', desc: 'Ülkeye özel ek event\'ler', type: 'string[]' },
    ],
    diagram: [
      { type: 'node', label: 'GetEvents API çağrılır', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Event listesi çekilir', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Kurye event seçer', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Durum güncellenir', variant: 'end' },
    ],
    tips: [
      'BA\'da CORE event\'lerine ek olarak PICK event\'i var',
      'ME\'de RETS (Return to Sender) event\'i eklenmiş',
      'Event listesi dinamik olarak backend\'den çekilir',
    ],
    tickets: [],
    experts: [
      { name: 'Backend Ekibi', role: 'Event Yönetimi' },
    ],
    score: { bugProneness: 1, boilerplate: 1, complexity: 1, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'EventTower/GetEvents', desc: 'Event tipi listesi sorgulama' },
    ],
  },

  /* ═══════════════════════════════════════════════════════
   * SHIPMENT TRACKING MODULE
   * ═══════════════════════════════════════════════════════ */

  shipment_tracking_screen: {
    whatIs:
      'Gönderi takip ekranı — ShipmentID, güncel konum, son event, gönderici ve alıcı bilgilerini gösterir. ExW/CPP gönderilerde fiskal detaylar da görünür. Fiskalizasyonu olan ülkelerde fiskal iptal edilirse SSC tetiklenir.',
    howItWorks: [
      'Kurye barkod okutarak veya listeden gönderi seçer',
      'GetShipmentDetails API çağrılır',
      'Takip ekranı gösterilir: ID, konum, son event, taraflar',
      'ExW/CPP ise fiskal detaylar da gösterilir',
      'Gönderi geçmişi GetShipmentHistory ile çekilir',
    ],
    screens: [
      'ShipmentTrackingFragment — Gönderi takip ekranı',
    ],
    parameters: [
      { name: 'shipment.id', desc: 'Gönderi ID', type: 'string' },
      { name: 'country.fiscalizationVisible', desc: 'Fiskal detaylar görünür mü?', type: 'boolean' },
    ],
    diagram: [
      { type: 'node', label: 'Barkod okutma', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'GetShipmentDetails API', variant: 'external' },
      { type: 'arrow' },
      { type: 'node', label: 'Takip ekranı gösterilir', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'ExW/CPP mi?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Evet',
          steps: [
            { type: 'node', label: 'Fiskal detaylar gösterilir', variant: 'process' },
          ],
        },
        no: {
          label: 'Hayır',
          steps: [
            { type: 'node', label: 'Standart görünüm', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Geçmiş çekilir', variant: 'process', desc: 'GetShipmentHistory' },
      { type: 'arrow' },
      { type: 'node', label: 'Takip tamamlanır', variant: 'end' },
    ],
    tips: [
      'HR, SI, BA, ME\'de fiskalizasyon detayları görünmez — yalnızca RS\'de aktif',
      'Fiskal iptal edilirse SSC (Status Change) event\'i otomatik tetiklenir',
      'Tracking ekranı hem teslimat hem pickup gönderileri için kullanılır',
    ],
    tickets: [
      { id: 'NESY-129', title: 'Takip ekranında eski event verisi gösterilmesi', status: 'closed' },
    ],
    experts: [
      { name: 'Mobile Geliştirici', role: 'Takip Ekranı' },
    ],
    score: { bugProneness: 2, boilerplate: 2, complexity: 2, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Shipment/GetShipmentDetails', desc: 'Gönderi detay sorgulama' },
      { method: 'POST', endpoint: 'Integration/GetShipmentHistory', desc: 'Gönderi hareket geçmişi' },
      { method: 'POST', endpoint: 'Integration/GetShipmentDetailByWaybillNumber', desc: 'İrsaliye ile sorgulama' },
      { method: 'POST', endpoint: 'Shipment/GetShipments', desc: 'Toplu gönderi sorgulama' },
    ],
  },

  /* ═══════════════════════════════════════════════════════
   * EBRANCH & DELIVERY OPTIONS MODULE
   * ═══════════════════════════════════════════════════════ */

  ebranch_tracking_link: {
    whatIs:
      'Alıcıya giden takip linki (Branch Link) ve self-servis teslimat seçenekleri. Gönderi oluşturulduktan sonra alıcıya bir link gönderilir. Alıcı bu link üzerinden tur öncesi ve sonrası çeşitli teslimat tercihleri yapabilir.',
    howItWorks: [
      'Gönderi oluşturulduğunda branch linki otomatik üretilir',
      'Alıcı linke tıklayarak ebranch sayfasını açar',
      'TUR öncesi: Parcel Shop, D4Me Locker, Private Locker seçimi',
      'DSSA (otomatik yönlendirme) durumunda: Şubeden al, Teslimatı reddet',
      'TUR sonrası: Evde, Tarih değiştir, Adres değiştir, Şubeden al, Reddet, PS/Locker',
      'COD/ExW ise "Pay with Link" seçeneği görünür',
      'Branch linki DELY/RETS/STOR/DELR sonrası geçersizleşir',
    ],
    screens: [
      'Ebranch Web Sayfası — Mobil uygulamada değil, web üzerinde',
    ],
    parameters: [
      { name: 'shipment.branchLink', desc: 'Alıcıya gönderilen tracking linki', type: 'string' },
      { name: 'shipment.isDSSA', desc: 'Gönderi DSSA ile otomatik yönlendirilmiş mi?', type: 'boolean' },
      { name: 'country.payWithLinkEnabled', desc: 'Pay with Link aktif mi?', type: 'boolean' },
    ],
    diagram: [
      { type: 'node', label: 'Gönderi oluşur', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Link üretilir', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Alıcı tıklar', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Durum?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'TUR öncesi',
          steps: [
            { type: 'node', label: 'PS/Locker seçimi', variant: 'process' },
          ],
        },
        no: {
          label: 'TUR sonrası',
          steps: [
            { type: 'node', label: 'Evde/Tarih/Adres/Reddet seçenekleri', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Tercih kaydedilir', variant: 'end' },
    ],
    tips: [
      'RS, BA, ME\'de ebranch desteklenmez (N/A)',
      'HR\'de "D4Me Private Locker\'a teslim" TUR öncesi görünmez',
      'SI\'da "Şubeden al" ve "Teslimatı reddet" seçenekleri görünmez',
      'COD/ExW TUR öncesi ödendiyse Cashdesk\'te ilgili ülke altında görünür',
      'Bu özellik backend-driven — mobil uygulamada doğrudan bir ekranı yoktur',
    ],
    tickets: [],
    experts: [
      { name: 'Web Ekibi', role: 'Ebranch Sayfası' },
      { name: 'Backend Ekibi', role: 'Branch Link Üretimi' },
    ],
    score: { bugProneness: 3, boilerplate: 2, complexity: 4, testCoverage: 1 },
  },

  /* ═══════════════════════════════════════════════════════
   * D4ME LOCKER MODULE
   * ═══════════════════════════════════════════════════════ */

  d4me_locker_delivery: {
    whatIs:
      'D4Me entegrasyonu üzerinden tam dolap teslimat süreci. Kurye veya alıcı dolap rezervasyonu yapabilir. Kurye koliyi dolaba bırakır, alıcı alır veya süre aşımında Locker Pickup görevi oluşur. RS\'de Legacy ID\'nin ilk 14 hanesi ile eşleme yapılır.',
    howItWorks: [
      'Kurye: Nesy Mobile üzerinden D4Me Locker rezervasyonu (LCR) oluşturur',
      'VEYA: Alıcı Ebranch üzerinden rezervasyon oluşturur (LCR + DDP)',
      'Rezervasyonda legacy ID D4Me\'ye gönderilir',
      'Kurye koliyi dolaba bırakır',
      'DEPT event\'i D4MeCallback ile gönderilir',
      'Alıcı zamanında alırsa → callback ile DELY alınır',
      'Alınmazsa → Locker Pickup görevi oluşturulur',
      'Kurye süresi geçen koliyi alırsa → COPT event\'i atanır',
    ],
    screens: [
      'LeanLockerFragment — D4Me dolap etkileşim ekranı',
      'D4Me External App — D4Me Android uygulaması (intent ile açılır)',
    ],
    parameters: [
      { name: 'd4me.legacyId', desc: 'Gönderi legacy ID (RS: ilk 14 hane)', type: 'string' },
      { name: 'd4me.reservationId', desc: 'Dolap rezervasyon ID', type: 'string' },
      { name: 'd4me.timeoutHours', desc: 'Alıcı için bekleme süresi (saat)', type: 'number' },
    ],
    diagram: [
      { type: 'node', label: 'Rezervasyon başlar', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Kim oluşturuyor?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Kurye',
          steps: [
            { type: 'node', label: 'LCR via NesyMobile', variant: 'process' },
          ],
        },
        no: {
          label: 'Alıcı',
          steps: [
            { type: 'node', label: 'LCR via Ebranch', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Legacy ID gönderilir', variant: 'external' },
      { type: 'arrow' },
      { type: 'node', label: 'Dolaba bırakılır', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'DEPT callback gönderilir', variant: 'external' },
      { type: 'arrow' },
      { type: 'node', label: 'Alıcı aldı mı?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Evet',
          steps: [
            { type: 'node', label: 'DELY callback', variant: 'process' },
          ],
        },
        no: {
          label: 'Hayır',
          steps: [
            { type: 'node', label: 'Locker Pickup görevi', variant: 'process' },
            { type: 'arrow' },
            { type: 'node', label: 'Kurye alır → COPT', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Akış tamamlanır', variant: 'end' },
    ],
    tips: [
      'RS\'de Legacy ID\'nin ilk 14 hanesi gönderilir — tam ID yerine kısaltılmış ID',
      'DEPT event D4MeCallback ile gelir — async, birkaç gün sürebilir',
      'BA ve ME\'de D4Me entegrasyonu yoktur (N/A)',
      'D4Me uygulamasının test ve prod versiyonları ayrı paket adlarına sahip',
      'Dolap dolu olabilir — kapasite kontrolü D4Me API\'sinde yapılır',
      'LeanLocker (LOS) entegrasyonu da ayrıca mevcut — D4Me\'den farklı bir dolap sistemi',
    ],
    tickets: [
      { id: 'NESY-112', title: 'D4Me callback sonrası gönderi durumu güncellenmemesi', status: 'open' },
      { id: 'NESY-198', title: 'RS 14 haneli ID eşleme hatası', status: 'open' },
      { id: 'NESY-76', title: 'D4Me uygulama versiyonu uyumsuzluğu', status: 'closed' },
      { id: 'NESY-221', title: 'Locker Pickup görevi timeout hesaplama hatası', status: 'open' },
    ],
    experts: [
      { name: 'D4Me Entegrasyon Ekibi', role: 'Dolap Entegrasyonu' },
      { name: 'RS Operasyon', role: 'Legacy ID Eşleme' },
    ],
    score: { bugProneness: 5, boilerplate: 4, complexity: 5, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Task/CreateD4MReservation', desc: 'D4Me dolap rezervasyonu' },
      { method: 'POST', endpoint: 'Task/DeleteD4MReservation', desc: 'D4Me rezervasyon iptali' },
      { method: 'POST', endpoint: 'Task/CompleteD4MShipments', desc: 'D4Me teslimat tamamlama' },
      { method: 'POST', endpoint: 'Shipment/ActiveD4MCounterLocations', desc: 'Aktif D4Me konumları' },
      { method: 'POST', endpoint: 'Shipment/ActiveLockerCounterLocations', desc: 'Aktif dolap konumları' },
      { method: 'POST', endpoint: 'Task/MakeLockerReservation', desc: 'LOS dolap rezervasyonu' },
      { method: 'POST', endpoint: 'Task/CancelLockerReservation', desc: 'LOS rezervasyon iptali' },
      { method: 'POST', endpoint: 'Task/ManuelLockerCompleteReservation', desc: 'LOS manuel tamamlama' },
    ],
  },
}
