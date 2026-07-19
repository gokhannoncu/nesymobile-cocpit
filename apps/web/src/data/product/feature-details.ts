// Feature Detail data — extracted from mobile project source code analysis + issue reports + architecture analysis documents.
// Source: NesyMobile Android project (com.arasdigital.nesymobile.*)
// Source: PLAN5-Enterprise-Architecture-Decision.md (37 edge cases, 162 tickets)
// Source: nesy_mobile_issue_raporu.md, nesy_mobile_mimari_onceliklendirme.md

import type { FeatureDetail } from './nesy-types'

export const FEATURE_DETAILS: Record<string, FeatureDetail> = {
  /* ═══════════════════════════════════════════════════════
   * DELIVERY PROCESS MODULE
   * ═══════════════════════════════════════════════════════ */

  collect_cod: {
    whatIs:
      'Kapıda ödeme (COD) tahsilatı. Kurye, teslimat sırasında alıcıdan nakit veya kredi kartı ile ödeme alır. Tutar, shipment üzerindeki COD field\'ından belirlenir. Nakit tahsilat doğrudan işlenir; kredi kartı tahsilatı ülkeye göre farklı ödeme sistemleri (RaiPay, SoftPos, WSPay) üzerinden yürür.',
    howItWorks: [
      'Kurye stop ekranından shipment\'ı seçer',
      'Shipment\'ta COD tutarı varsa collection ekranı açılır',
      'Ödeme yöntemi seçilir: Cash veya Credit Card',
      'Cash seçilirse tutar girilir ve onaylanır',
      'Credit Card seçilirse ilgili ödeme uygulaması (RaiPay/SoftPos) tetiklenir',
      'Ödeme başarılı olursa shipment delivery akışına devam eder',
      'Ödeme başarısız olursa teslimat failed olarak işaretlenebilir',
    ],
    screens: [
      'DeliveryFragment — Main delivery screen',
      'PaymentFragment — Payment method selection',
      'RaiPayActivity — RaiPay credit card integration (HR)',
      'SoftPosActivity — SoftPos credit card integration (SI, RS)',
    ],
    parameters: [
      { name: 'shipment.collectionAmount', desc: 'COD amount to be collected', type: 'decimal' },
      { name: 'shipment.collectionCurrency', desc: 'Currency (EUR, RSD, BAM)', type: 'string' },
      { name: 'shipment.paymentType', desc: 'Payment type (CASH, CC)', type: 'enum' },
      { name: 'country.paymentProvider', desc: 'Payment provider by country', type: 'enum' },
    ],
    diagram: [
      { type: 'node', label: 'Kurye shipment’ı seçer', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'COD var mı?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Evet',
          steps: [
            { type: 'node', label: 'Collection ekranı açılır', variant: 'process' },
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
                label: 'Kredi kartı',
                steps: [
                  { type: 'node', label: 'Ödeme uygulaması açılır', variant: 'external' },
                  { type: 'arrow' },
                  { type: 'node', label: 'Başarılı mı?', variant: 'decision' },
                  {
                    type: 'branch',
                    yes: {
                      label: 'Evet',
                      steps: [
                        { type: 'node', label: 'Devam eder', variant: 'process' },
                      ],
                    },
                    no: {
                      label: 'Hayır',
                      steps: [
                        { type: 'node', label: 'Tekrar dene', variant: 'error' },
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
      { type: 'node', label: 'Teslimat devam eder', variant: 'end' },
    ],
    tips: [
      'HR\'de kredi kartı ödemeleri RaiPay üzerinden işlenir — cihazda RaiPay uygulamasının kurulu ve bağlı olması gerekir',
      'SI ve RS\'de SoftPos kullanılır — RS\'de entegrasyon henüz tamamlanmadı',
      'BA ve ME\'de yalnızca nakit tahsilat desteklenir; kredi kartı altyapısı yok',
      'Tahsilat offline mode\'da yapılabilir ancak synchronization sonrası doğrulanır',
      'COD tutarı 0 ise collection ekranı atlanır',
      'Aynı statüdeki birden fazla shipment toplu olarak tahsil edilebilir',
    ],
    tickets: [],
    experts: [
      { name: 'Finance Team', role: 'Ödeme entegrasyonları' },
      { name: 'Mobile Developer', role: 'Android ödeme akışı' },
    ],
    score: { bugProneness: 4, boilerplate: 3, complexity: 4, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Shipment/GetShipmentCollectionStatus', desc: 'Query shipment collection status' },
      { method: 'POST', endpoint: 'Shipment/GetPaymentId', desc: 'Generate payment ID' },
      { method: 'POST', endpoint: 'Shipment/RaipayBindMobilDeviceToPaymentTerminal', desc: 'Bind device to RaiPay terminal' },
      { method: 'POST', endpoint: 'Shipment/RaiPayAuthToken', desc: 'Obtain RaiPay authorization token' },
      { method: 'POST', endpoint: 'Shipment/GetRaiPayPaymentToken', desc: 'Obtain RaiPay payment token' },
      { method: 'POST', endpoint: 'Shipment/GetRaiPayPaymentStatus', desc: 'Query RaiPay payment status' },
      { method: 'POST', endpoint: 'Shipment/SaveCollectedShipmentListToCashDesk', desc: 'Save collections to cash desk' },
    ],
  },

  collect_exw: {
    whatIs:
      'Toplama noktasında Ex-works tahsilatı. Kurye, pickup konumunda göndericiden ödeme alır. ExW (Ex Works) shipment\'larda ödeme teslimat sırasında değil, pickup sırasında yapılır.',
    howItWorks: [
      'Kurye pickup task\'ını seçer',
      'Shipment ExW ise collection ekranı açılır',
      'Ödeme yöntemi seçilir (Cash / Credit Card)',
      'Tahsilat tamamlanır',
      'Pickup süreci devam eder',
      'Fiskal fiş gerekliyse otomatik tetiklenir (RS)',
    ],
    screens: [
      'PickupFragment — Pickup screen',
      'PaymentFragment — Payment selection screen',
    ],
    parameters: [
      { name: 'shipment.exwAmount', desc: 'ExW collection amount', type: 'decimal' },
      { name: 'shipment.isExW', desc: 'Is the shipment ExW?', type: 'boolean' },
      { name: 'country.paymentProvider', desc: 'Payment provider', type: 'enum' },
    ],
    diagram: [
      { type: 'node', label: 'Pickup görevi seçilir', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'ExW shipment mı?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Evet',
          steps: [
            { type: 'node', label: 'Collection ekranı açılır', variant: 'process' },
            { type: 'arrow' },
            { type: 'node', label: 'Ödeme yöntemi seçilir', variant: 'process' },
            { type: 'arrow' },
            { type: 'node', label: 'Collection kaydedilir', variant: 'process' },
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
                  { type: 'node', label: 'Devam eder', variant: 'process' },
                ],
              },
            },
          ],
        },
        no: {
          label: 'Hayır',
          steps: [
            { type: 'node', label: 'Normal pickup', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Devam eder', variant: 'end' },
    ],
    tips: [
      'ExW ve COD collection aynı payment infrastructure\'ı kullanır ancak farklı event\'ler tetikler',
      'ExW fiscalization yalnızca RS\'de zorunludur',
      'ExW collection atlanabilir (skip_exwork feature\'ına bakın)',
    ],
    tickets: [],
    experts: [
      { name: 'Finance Team', role: 'Tahsilat akışları' },
    ],
    score: { bugProneness: 3, boilerplate: 3, complexity: 3, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Shipment/GetShipmentCollectionStatus', desc: 'Query ExW collection status' },
      { method: 'POST', endpoint: 'Shipment/GetCollectionsFromShipment', desc: 'Shipment collection details' },
    ],
  },

  skip_exwork: {
    whatIs:
      'Kurye beklenen ExW tutarını atlayabilir (skip). Bu durumda shipment güncellenir ve müşteriye faturalandırılır. Bu özellik yalnızca RS\'de aktiftir; diğer ülkelerde ExW atlanamaz.',
    howItWorks: [
      'Kurye ExW collection ekranında "Skip" butonuna basar',
      'Sistem onay dialog\'u gösterir',
      'Onay sonrası shipment ExW tutarı sıfırlanır',
      'Shipment güncellenir ve müşteri faturalandırması backend\'de yönetilir',
      'Pickup akışı devam eder',
    ],
    screens: [
      'PickupFragment — ExW skip button',
    ],
    parameters: [
      { name: 'country.canSkipExW', desc: 'Whether ExW skip permission exists', type: 'boolean' },
      { name: 'shipment.exwAmount', desc: 'Skipped ExW amount', type: 'decimal' },
    ],
    diagram: [
      { type: 'node', label: 'ExW collection ekranı', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Skip butonuna basılır', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Onaylandı mı?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Evet',
          steps: [
            { type: 'node', label: 'Tutar sıfırlanır', variant: 'process' },
            { type: 'arrow' },
            { type: 'node', label: 'Shipment güncellenir', variant: 'process' },
            { type: 'arrow' },
            { type: 'node', label: 'Devam eder', variant: 'process' },
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
      'Skip sonrası shipment status değişir, geri alınamaz',
      'Finansal raporlamada ayrı olarak "skipped ExW" olarak izlenir',
    ],
    tickets: [],
    experts: [
      { name: 'RS Operations Team', role: 'Sırbistan\'a özel kurallar' },
    ],
    score: { bugProneness: 2, boilerplate: 1, complexity: 2, testCoverage: 1 },
  },

  fiscalization_dp: {
    whatIs:
      'Teslimat sırasında VPFR (Virtual Fiscal Printer) tetiklenir ve fiskal fiş yazdırılır. Fiskalizasyon, devlet zorunluluğu olan mali belge düzenleme sürecidir. Her COD/ExW ödemesi için fiskal fiş oluşturulmalıdır. RS\'de zorunludur; diğer ülkelerde henüz aktif değildir.',
    howItWorks: [
      'Teslimat veya pickup sırasında ödeme alınır',
      'Başarılı ödeme sonrası VPFR tetiklenir',
      'Fiş verisi backend\'e gönderilir (CreateFiscalInvoice)',
      'Backend VPFR yanıtını alır ve fiş numarasını döner',
      'Fiş yazdırılır (Bluetooth printer veya dijital)',
      'Fiskal iptal durumunda SSC (Status Change) event\'i tetiklenir',
    ],
    screens: [
      'FiscalPrintFragment — Receipt printing screen',
      'PrinterSettingsFragment — Printer settings',
      'DeliveryFragment — Main delivery screen (fiscal trigger)',
    ],
    parameters: [
      { name: 'country.fiscalizationEnabled', desc: 'Is fiscalization active?', type: 'boolean' },
      { name: 'printer.bluetoothAddress', desc: 'Bluetooth printer MAC address', type: 'string' },
      { name: 'fiscal.vpfrUrl', desc: 'VPFR endpoint URL', type: 'string' },
    ],
    diagram: [
      { type: 'node', label: 'Ödeme tamamlanır', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Fiskal gerekli mi?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Evet',
          steps: [
            { type: 'node', label: 'CreateFiscalInvoice API', variant: 'external' },
            { type: 'arrow' },
            { type: 'node', label: 'Başarılı mı?', variant: 'decision' },
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
                  { type: 'node', label: 'Tekrar dene', variant: 'error' },
                ],
              },
            },
          ],
        },
        no: {
          label: 'Hayır',
          steps: [
            { type: 'node', label: 'Devam eder', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Akış tamamlanır', variant: 'end' },
    ],
    tips: [
      'VPFR bağlantısı timeout olabilir — retry mekanizması vardır (RetryFiscalInvoice)',
      'Fiskal fiş oluşturulduktan sonra iptal edilirse RefundFiscalInvoice çağrılır ve SSC event tetiklenir',
      'Fiscalization şu an yalnızca RS\'de zorunlu, BA için planlanıyor (Bulgaria expansion ile)',
      'Bluetooth printer bağlantısı sık kopar — cihaz eşleştirme kontrolü önemli',
      'Fiskal fişler offline mode\'da oluşturulamaz; kuyrukta bekler',
    ],
    tickets: [],
    experts: [
      { name: 'Finance Team', role: 'Fiskal entegrasyon' },
      { name: 'RS Operations', role: 'VPFR süreçleri' },
    ],
    score: { bugProneness: 5, boilerplate: 4, complexity: 5, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Shipment/CreateFiscalInvoice', desc: 'Create fiscal receipt' },
      { method: 'POST', endpoint: 'Shipment/RetryFiscalInvoice', desc: 'Retry failed fiscal receipt' },
      { method: 'POST', endpoint: 'Shipment/RefundFiscalInvoice', desc: 'Cancel fiscal receipt' },
      { method: 'POST', endpoint: 'Shipment/UpdateFiscalInvoice', desc: 'Update fiscal receipt' },
      { method: 'POST', endpoint: 'Shipment/GetFiscalInvoiceDetail', desc: 'Query fiscal receipt details' },
    ],
  },

  failed_reasons: {
    whatIs:
      'Teslimat başarısız olduğunda kurye bir neden seçer ve bazı durumlarda fotoğraf kanıtı alır. Başarısız teslimat nedenleri ülkeye göre özelleştirilir. Fotoğraf zorunluluğu da neden koduna ve ülkeye bağlıdır.',
    howItWorks: [
      'Kurye "Delivery Failed" butonuna basar',
      'Neden listesi açılır (ülkeye göre filtrelenir)',
      'Kurye bir neden seçer',
      'Seçilen nedene göre fotoğraf gerekebilir',
      'Fotoğraf çekilirse CameraFragment açılır',
      'Fotoğraf sunucuya yüklenir (SaveImageFile)',
      'DeliveryFailed API çağrılır ve shipment durumu güncellenir',
    ],
    screens: [
      'DeliveryFailedFragment — Failed reason selection screen',
      'CameraFragment — Photo capture screen',
    ],
    parameters: [
      { name: 'country.failedReasons', desc: 'Country-specific failed reason codes list', type: 'string[]' },
      { name: 'failedReason.requiresPhoto', desc: 'Does this reason require a photo?', type: 'boolean' },
      { name: 'country.photoMandatory', desc: 'Is photo mandatory?', type: 'boolean' },
    ],
    diagram: [
      { type: 'node', label: 'Teslimat başarısız', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Neden listesi açılır', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Neden seçilir', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Fotoğraf gerekli mi?', variant: 'decision' },
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
            { type: 'node', label: 'Doğrudan devam eder', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'DeliveryFailed API', variant: 'external' },
      { type: 'arrow' },
      { type: 'node', label: 'Shipment status güncellenir', variant: 'end' },
    ],
    tips: [
      'SI\'da sınırlı reason listesi kullanılır — CORE\'a göre daha az seçenek',
      'BA\'da fotoğraf çekilemez — camera permission olsa bile fotoğraf adımı atlanır',
      'RS ve ME\'de fotoğraflar opsiyonel — kurye isterse atlayabilir',
      'CameraFragment ~35K satır — en büyük fragment, yüksek refactoring ihtiyacı',
      'Fotoğraf upload offline mode\'da kuyrukta kalır',
    ],
    tickets: [],
    experts: [
      { name: 'Mobile Developer', role: 'Kamera ve fotoğraf akışı' },
    ],
    score: { bugProneness: 4, boilerplate: 3, complexity: 3, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Task/DeliveryFailed', desc: 'Failed delivery notification' },
      { method: 'POST', endpoint: 'Task/f/SaveImageFile', desc: 'Photo upload (multipart)' },
    ],
  },

  consignee_info: {
    whatIs:
      'Teslimat anında alıcı (consignee) adının gösterimi ve düzenlenebilirliği. CORE davranışında consignee adı shipment verisinden önceden doldurulmuş gelir ve düzenlenebilir. HR\'de ad önceden doldurulmaz; harici olarak (SMS/telefon ile) iletilir.',
    howItWorks: [
      'Kurye delivery ekranına gider',
      'Consignee ad alanı shipment verisinden dolu veya boş gelir (ülkeye göre)',
      'Gerekirse kurye adı düzenleyebilir',
      'Teslimat tamamlandığında consignee adı kaydedilir',
    ],
    screens: [
      'DeliveryFragment — Consignee info field',
    ],
    parameters: [
      { name: 'country.consigneePreFilled', desc: 'Is consignee name pre-filled?', type: 'boolean' },
      { name: 'country.consigneeEditable', desc: 'Is consignee name editable?', type: 'boolean' },
    ],
    diagram: [
      { type: 'node', label: 'Teslimat ekranı açılır', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Önceden dolu mu?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Evet',
          steps: [
            { type: 'node', label: 'Dolu olarak gösterilir', variant: 'process' },
          ],
        },
        no: {
          label: 'Hayır',
          steps: [
            { type: 'node', label: 'Kurye girer', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Düzenlendi', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Kaydedildi', variant: 'end' },
    ],
    tips: [
      'HR\'de consignee adı önceden doldurulmaz — kurye teslimat anında sorar ve girer',
      'Bu davranış HR\'e özgüdür; diğer tüm ülkeler CORE davranışını izler',
    ],
    tickets: [],
    experts: [
      { name: 'HR Operations', role: 'Hırvatistan\'a özel kurallar' },
    ],
    score: { bugProneness: 1, boilerplate: 1, complexity: 1, testCoverage: 1 },
  },

  signature_dp: {
    whatIs:
      'Teslimat anında dijital (ekran üzerinde) ve fiziksel (basılı belge) imza toplama. Dijital imza kurye cihaz ekranında alınır. Fiziksel imza için delivery list (dely list) indirilir, yazdırılır ve müşteri tarafından imzalanır.',
    howItWorks: [
      'Teslimat onay adımında imza ekranı açılır',
      'Alıcı parmağıyla dijital imza atar',
      'İmza görseli base64 olarak kaydedilir (SaveSignature API)',
      'Delivery list (dely list) indirilebilir ve fiziksel olarak imzalanabilir',
      'İmza zorunluluğu ülkeye göre değişir',
    ],
    screens: [
      'SignaturePadFragment — Digital signature screen',
      'DeliveryFragment — Signature trigger',
    ],
    parameters: [
      { name: 'country.signatureMandatory', desc: 'Is digital signature mandatory?', type: 'boolean' },
      { name: 'country.delyListEnabled', desc: 'Is dely list download active?', type: 'boolean' },
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
                  { type: 'node', label: 'Devam eder', variant: 'process' },
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
      { type: 'node', label: 'Devam eder', variant: 'end' },
    ],
    tips: [
      'RS, BA ve ME\'de dijital imza opsiyonel — kurye atlayabilir',
      'Dely list HR\'de code merge sonrası aktif oldu',
      'İmza pad dokunma hassasiyeti cihaza göre değişir — bazı Zebra cihazlarda sorun olabilir',
    ],
    tickets: [],
    experts: [
      { name: 'Mobile Developer', role: 'UI bileşenleri' },
    ],
    score: { bugProneness: 2, boilerplate: 2, complexity: 2, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Shipment/SaveSignature', desc: 'Save signature' },
    ],
  },

  delivery_parcelshop: {
    whatIs:
      'Shipment\'ların parcel shop (pick-up point) veya şubeye teslimi. Kurye, alıcı yerine parcel shop konumuna teslim eder. RDOC ve OVSZ (oversized) shipment\'lar parcel shop\'lara teslim edilemez.',
    howItWorks: [
      'Delivery task parcel shop adresine atanır',
      'Kurye parcel shop\'a gelir',
      'Shipment\'lar teslim edilir (ReleaseParcel API)',
      'RDOC ve OVSZ kontrolü yapılır — bu tipler engellenir',
      'Teslim edilen shipment\'lar için DEPT event\'i oluşturulur',
    ],
    screens: [
      'ParcelReleaseFragment — Parcel release screen',
      'StopListFragment — Stop list (with parcel shop stops)',
    ],
    parameters: [
      { name: 'shipment.isRDOC', desc: 'Is the shipment RDOC type?', type: 'boolean' },
      { name: 'shipment.isOVSZ', desc: 'Is the shipment oversized?', type: 'boolean' },
      { name: 'counterLocation.type', desc: 'Delivery point type (parcelshop/locker)', type: 'enum' },
    ],
    diagram: [
      { type: 'node', label: 'Görev atanır', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'PS’e varır', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'RDOC/OVSZ?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Bloklandı',
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
            { type: 'node', label: 'Tamamlandı', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Akış biter', variant: 'end' },
    ],
    tips: [
      'RDOC shipment\'lar hiçbir ülkede parcel shop\'lara teslim edilemez',
      'OVSZ shipment\'lar da engellenir — boyut kontrolü frontend\'de yapılır',
      'Parcel shop altyapısı BA ve ME\'de yok (N/A)',
    ],
    tickets: [],
    experts: [
      { name: 'Operations Team', role: 'Parcel shop süreçleri' },
    ],
    score: { bugProneness: 2, boilerplate: 2, complexity: 2, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Task/ReleaseParcel', desc: 'Parcel release operation' },
      { method: 'POST', endpoint: 'Integration/ProcessHandOverParcelsToCounterLocation', desc: 'Hand over parcels to counter location' },
    ],
  },

  delivery_locker: {
    whatIs:
      'D4ME (Direct4Me) smart locker entegrasyonu ile locker teslimatı. Kurye shipment\'ı smart locker\'a bırakır, alıcı alır. D4ME uygulaması ile entegre çalışır.',
    howItWorks: [
      'Kurye locker konumuna gelir',
      'D4ME uygulaması açılır (intent ile)',
      'Locker rezervasyonu kontrol edilir veya oluşturulur',
      'Kurye koliyi locker\'a bırakır',
      'DEPT event\'i D4MeCallback ile gönderilir',
      'Alıcı alırsa → DELY; aksi halde Locker Pickup task\'ı oluşturulur',
    ],
    screens: [
      'LeanLockerFragment — Locker interaction screen',
      'D4ME External App — External D4ME application',
    ],
    parameters: [
      { name: 'd4me.packageName', desc: 'D4ME app package name', type: 'string' },
      { name: 'shipment.lockerReservationId', desc: 'Locker reservation ID', type: 'string' },
      { name: 'shipment.isRDOC', desc: 'RDOC shipments cannot be placed in lockers', type: 'boolean' },
    ],
    diagram: [
      { type: 'node', label: 'Locker konumuna varır', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'D4ME açılır', variant: 'external' },
      { type: 'arrow' },
      { type: 'node', label: 'Rezervasyon var mı?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Evet',
          steps: [
            { type: 'node', label: 'Kapı açılır', variant: 'process' },
          ],
        },
        no: {
          label: 'Hayır',
          steps: [
            { type: 'node', label: 'CreateD4MReservation', variant: 'external' },
            { type: 'arrow' },
            { type: 'node', label: 'Kapı açılır', variant: 'process' },
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
      'D4ME uygulamasının cihazda kurulu olması gerekir — aksi halde Google Play\'e yönlendirilir',
      'RDOC ve OVSZ shipment\'lar locker\'a bırakılamaz',
      'RS\'de eşleme Legacy ID\'nin ilk 14 hanesi ile yapılır — tam ID yerine kısaltılmış ID gönderilir',
      'D4ME callback\'leri async gelir — birkaç gün sürebilir',
      'Locker dolu olabilir — kapasite kontrolü D4ME tarafında yapılır',
    ],
    tickets: [],
    experts: [
      { name: 'D4ME Integration Team', role: 'Locker entegrasyonu' },
    ],
    score: { bugProneness: 5, boilerplate: 4, complexity: 5, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Task/CreateD4MReservation', desc: 'Create D4ME locker reservation' },
      { method: 'POST', endpoint: 'Task/DeleteD4MReservation', desc: 'Cancel D4ME reservation' },
      { method: 'POST', endpoint: 'Task/CompleteD4MShipments', desc: 'Complete D4ME delivery' },
      { method: 'POST', endpoint: 'Shipment/ActiveD4MCounterLocations', desc: 'Active D4ME locker locations' },
      { method: 'POST', endpoint: 'Shipment/ActiveLockerCounterLocations', desc: 'Active locker locations list' },
    ],
  },

  /* ═══════════════════════════════════════════════════════
   * PICKUP PROCESS MODULE
   * ═══════════════════════════════════════════════════════ */

  pickup_assignment: {
    whatIs:
      'Pickup task\'larının kuryelere atanma mekanizması. CORE davranışında pickup task\'ları her 3 dakikada çalışan bir job ile otomatik atanır. Bazı ülkelerde atamalar dispatcher tarafından manuel yapılır.',
    howItWorks: [
      'GeneratePickupTaskJob backend\'de her 3 dakikada çalışır (CORE)',
      'Veya dispatcher backoffice\'ten kurye seçerek manuel atama yapar',
      'Atanan task kurye schedule\'ine eklenir',
      'Kurye yeni task\'ı task listesinde görür',
      'Kurye push notification ile bilgilendirilir',
    ],
    screens: [
      'TaskListFragment — Task list',
      'StopListFragment — Stop list (pickup stops)',
    ],
    parameters: [
      { name: 'country.pickupAutoAssign', desc: 'Is auto-assignment active?', type: 'boolean' },
      { name: 'job.interval', desc: 'Auto-assignment job run interval (min)', type: 'number' },
    ],
    diagram: [
      { type: 'node', label: 'Atama türü belirlenir', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Atama türü?', variant: 'decision' },
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
      { type: 'node', label: 'Schedule’a eklenir', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Bildirim gönderilir', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Listede görünür', variant: 'end' },
    ],
    tips: [
      'HR, RS ve BA\'da dispatcher manuel atama yapar — auto-assignment kapalı',
      'SI ve ME\'de CORE ile aynı — auto-assignment aktif',
      'Manuel atamada dispatcher kuryenin mevcut workload\'unu görebilir',
    ],
    tickets: [],
    experts: [
      { name: 'Backend Team', role: 'Task atama motoru' },
    ],
    score: { bugProneness: 2, boilerplate: 1, complexity: 2, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Task/GeneratePickupTaskJobNew', desc: 'Trigger pickup task job' },
    ],
  },

  collect_cpp: {
    whatIs:
      'Pickup noktasında CPP (Cash Pre-Paid) shipment\'lar için tahsilat. Ödeme, pickup sırasında göndericiden nakit veya kredi kartı ile alınır. COD\'dan farklı olarak ödeme teslimat sırasında değil pickup sırasında yapılır.',
    howItWorks: [
      'Kurye pickup task\'ını seçer',
      'Shipment CPP ise collection ekranı açılır',
      'Ödeme yöntemi seçilir',
      'Tahsilat tamamlanır',
      'Fiskal fiş gerekliyse tetiklenir (RS)',
      'Pickup süreci devam eder',
    ],
    screens: [
      'PickupFragment — Pickup screen',
      'PaymentFragment — Payment selection screen',
    ],
    parameters: [
      { name: 'shipment.isCPP', desc: 'Is the shipment CPP type?', type: 'boolean' },
      { name: 'shipment.cppAmount', desc: 'CPP collection amount', type: 'decimal' },
    ],
    diagram: [
      { type: 'node', label: 'Pickup görevi seçilir', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'CPP shipment mı?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Evet',
          steps: [
            { type: 'node', label: 'Collection ekranı açılır', variant: 'process' },
            { type: 'arrow' },
            { type: 'node', label: 'Ödeme yöntemi seçilir', variant: 'process' },
            { type: 'arrow' },
            { type: 'node', label: 'Collection tamamlanır', variant: 'process' },
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
                  { type: 'node', label: 'Devam eder', variant: 'process' },
                ],
              },
            },
          ],
        },
        no: {
          label: 'Hayır',
          steps: [
            { type: 'node', label: 'Normal pickup', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Devam eder', variant: 'end' },
    ],
    tips: [
      'CPP collection SI, BA ve ME\'de desteklenmez (N/A)',
      'HR\'de kredi kartı tahsilatı RaiPay üzerinden işlenir',
      'RS\'de SoftPos entegrasyonu planlanıyor ancak henüz entegre edilmedi',
    ],
    tickets: [],
    experts: [
      { name: 'Finance Team', role: 'Tahsilat akışları' },
    ],
    score: { bugProneness: 3, boilerplate: 3, complexity: 3, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Shipment/GetShipmentCollectionStatus', desc: 'CPP collection status' },
      { method: 'POST', endpoint: 'Shipment/GetCollectionsFromShipment', desc: 'Shipment collection details' },
    ],
  },

  pickup_fiscalization: {
    whatIs:
      'CPP shipment\'lar için pickup sırasında fiskal fiş oluşturma. Delivery fiskalizasyonu ile aynı VPFR altyapısını kullanır ancak yalnızca CPP shipment\'lar için tetiklenir. Şu anda yalnızca RS\'de aktiftir.',
    howItWorks: [
      'CPP pickup tamamlanır',
      'Ödeme başarılıysa VPFR tetiklenir',
      'CreateFiscalInvoice API çağrılır',
      'Fiş numarası alınır ve yazdırılır',
    ],
    screens: [
      'FiscalPrintFragment — Receipt printing',
      'PickupFragment — Pickup screen (trigger)',
    ],
    parameters: [
      { name: 'country.pickupFiscalEnabled', desc: 'Is pickup fiscalization active?', type: 'boolean' },
    ],
    diagram: [
      { type: 'node', label: 'CPP pickup tamamlanır', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Ödeme başarılı', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'VPFR tetiklenir', variant: 'external' },
      { type: 'arrow' },
      { type: 'node', label: 'CreateFiscalInvoice API', variant: 'external' },
      { type: 'arrow' },
      { type: 'node', label: 'Başarılı mı?', variant: 'decision' },
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
            { type: 'node', label: 'Tekrar dene', variant: 'error' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Devam eder', variant: 'end' },
    ],
    tips: [
      'Yalnızca RS\'de aktif — diğer tüm ülkelerde N/A',
      'Delivery fiscalization ile aynı API\'leri kullanır',
      'CPP olmayan shipment\'lar için tetiklenmez',
    ],
    tickets: [],
    experts: [
      { name: 'RS Operations', role: 'VPFR süreçleri' },
    ],
    score: { bugProneness: 3, boilerplate: 4, complexity: 4, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Shipment/CreateFiscalInvoice', desc: 'Create fiscal receipt' },
      { method: 'POST', endpoint: 'Shipment/RetryFiscalInvoice', desc: 'Fiscal retry' },
    ],
  },

  pickup_at_customer: {
    whatIs:
      'PAC (Pickup at Customer) task davranışı. Müşteri konumundan parcel pickup task\'ı. İşlem görmemiş PAC task end of day\'i engeller (CORE) veya engellemez (SI). Bu kural End of Day akışını doğrudan etkiler.',
    howItWorks: [
      'PAC task kurye schedule\'ine atanır',
      'Kurye müşteri konumuna gider',
      'Kolileri toplar ve araçta tarama ile onaylar',
      'PAC task işlem görmeden bırakılırsa:',
      '  - CORE/HR/RS/BA/ME: End of day\'i engeller',
      '  - SI: End of day\'i engellemez',
    ],
    screens: [
      'PickupFragment — Pickup screen',
      'TaskListFragment — Task list',
    ],
    parameters: [
      { name: 'country.pacBlocksEod', desc: 'Does PAC task block end of day?', type: 'boolean' },
    ],
    diagram: [
      { type: 'node', label: 'PAC görevi atanır', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Konuma gider', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Koliler toplanır', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Tarama yapılır', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Aksiyon alınmadı mı?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Evet',
          steps: [
            { type: 'node', label: 'EOD’u bloklar mı?', variant: 'decision' },
            {
              type: 'branch',
              yes: {
                label: 'CORE',
                steps: [
                  { type: 'node', label: 'Bloklar', variant: 'error' },
                ],
              },
              no: {
                label: 'SI',
                steps: [
                  { type: 'node', label: 'Bloklamaz', variant: 'process' },
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
      { type: 'node', label: 'Akış biter', variant: 'end' },
    ],
    tips: [
      'SI\'da işlem görmemiş PAC task End of Day\'i engellemez — kurye ertesi güne bırakabilir',
      'Diğer tüm ülkelerde PAC tamamlanmadan End of Day yapılamaz',
      'PAC ile PickupAtCustomer farkı: PAC müşteri talebine bağlı, Pickup schedule\'e bağlı',
    ],
    tickets: [],
    experts: [
      { name: 'Operations Team', role: 'Task yönetimi' },
    ],
    score: { bugProneness: 2, boilerplate: 1, complexity: 2, testCoverage: 1 },
  },

  remote_pickup: {
    whatIs:
      'Mobil uygulamada gönderici ve alıcı bilgilerinin gösterimi. Remote pickup senaryosunda gönderici bilgisi kurye uygulamasında görüntülenir. BA\'da alıcı bilgisi de gösterilir.',
    howItWorks: [
      'Pickup task atanır',
      'Kurye task detaylarını açar',
      'Gönderici bilgisi (ad, adres, telefon) gösterilir',
      'BA\'da alıcı bilgisi de görünür',
    ],
    screens: [
      'PickupFragment — Pickup detail screen',
      'TaskListFragment — Task list',
    ],
    parameters: [
      { name: 'country.showReceiverInPickup', desc: 'Show receiver info in pickup?', type: 'boolean' },
    ],
    diagram: [
      { type: 'node', label: 'Görev atanır', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Detaylar açılır', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Gönderici bilgisi gösterilir', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'BA mı?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Evet',
          steps: [
            { type: 'node', label: 'Alıcı bilgisi de gösterilir', variant: 'process' },
          ],
        },
        no: {
          label: 'Hayır',
          steps: [
            { type: 'node', label: 'Yalnızca gönderici gösterilir', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Pickup başlar', variant: 'end' },
    ],
    tips: [
      'BA\'da alıcı bilgisi de gösterilir — kurye koliyi doğru adrese yönlendirebilir',
      'Diğer ülkelerde yalnızca gönderici bilgisi görünür',
    ],
    tickets: [],
    experts: [
      { name: 'BA Operations', role: 'Bosna\'ya özel kurallar' },
    ],
    score: { bugProneness: 1, boilerplate: 1, complexity: 1, testCoverage: 1 },
  },

  red_label: {
    whatIs:
      'Mobil uygulama üzerinden red label (kırmızı etiketli) shipment pickup\'ı. Red label, etiket bilgisi eksik shipment\'lar için kullanılır. Kurye koliyi toplar, Npoint\'e bırakır, shipment oluşturulur ve backoffice eksik veriyi tamamlar.',
    howItWorks: [
      'Pickup at customer task oluşturulur (red label)',
      'Kurye müşteriye gider ve koliyi toplar',
      'Koli Npoint\'e (hub) bırakılır',
      'CreateRedGreyLabelShipmentWithoutDetails API çağrılır',
      'Shipment sistemde oluşturulur (eksik detaylarla)',
      'Backoffice operatörü eksik bilgileri tamamlar',
    ],
    screens: [
      'GrayLabelFragment — Red/gray label pickup screen',
      'PickupFragment — Pickup flow',
    ],
    parameters: [
      { name: 'shipment.isRedLabel', desc: 'Is the shipment red label?', type: 'boolean' },
      { name: 'country.redLabelEnabled', desc: 'Is red label pickup active?', type: 'boolean' },
    ],
    diagram: [
      { type: 'node', label: 'PAC görevi oluşur', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Müşteriye gider', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Koli toplanır', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Npoint’e bırakılır', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'CreateRedGreyLabel API', variant: 'external' },
      { type: 'arrow' },
      { type: 'node', label: 'Shipment oluşur', variant: 'process', desc: 'With missing details' },
      { type: 'arrow' },
      { type: 'node', label: 'Backoffice tamamlar', variant: 'end' },
    ],
    tips: [
      'Red label pickup SI ve ME\'de desteklenmez (N/A)',
      'Red label ve gray label aynı fragment\'ı kullanır (GrayLabelFragment)',
      'Backoffice\'te shipment tamamlanmadan delivery yapılamaz',
    ],
    tickets: [],
    experts: [
      { name: 'Operations Team', role: 'Red label süreçleri' },
    ],
    score: { bugProneness: 3, boilerplate: 2, complexity: 3, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Shipment/CreateRedGreyLabelShipmentWithoutDetails', desc: 'Create red/gray label shipment' },
    ],
  },

  pickup_failed_non_rdoc: {
    whatIs:
      'RDOC olmayan pickup task\'ları için başarısızlık neden kodları. Kurye pickup\'ı tamamlayamazsa uygun bir neden kodu seçer. Neden kodları: NOPC, NPNP, NRDY, NSYS, PABS, PADU, PTIM.',
    howItWorks: [
      'Kurye "Pickup Failed" seçer',
      'Neden kodu listesi açılır',
      'Uygun kod seçilir',
      'PickupFailed API çağrılır',
      'Seçilen koda göre otomatik reassignment tetiklenebilir',
    ],
    screens: [
      'PickupFailedFragment — Failed pickup reason screen',
    ],
    parameters: [
      { name: 'failedReason.code', desc: 'Failed reason code (NOPC/NPNP/NRDY/NSYS/PABS/PADU/PTIM)', type: 'enum' },
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
            { type: 'node', label: 'Ertesi güne atanır', variant: 'process' },
          ],
        },
        no: {
          label: 'Hayır',
          steps: [
            { type: 'node', label: 'Kapalı', variant: 'process' },
          ],
        },
      },
      { type: 'arrow' },
      { type: 'node', label: 'Akış tamamlanır', variant: 'end' },
    ],
    tips: [
      'Tüm ülkeler CORE ile aynı reason code\'ları kullanır',
      'Bazı reason code\'lar otomatik reassignment tetikler (auto_reassignment\'a bakın)',
      'NOPC: No Parcel / NPNP: Not at Pickup Point / NRDY: Not Ready / NSYS: System / PABS: Absent / PADU: Address Unknown / PTIM: Past Time',
    ],
    tickets: [],
    experts: [
      { name: 'Operations Team', role: 'Pickup süreçleri' },
    ],
    score: { bugProneness: 1, boilerplate: 1, complexity: 1, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Task/PickupFailed', desc: 'Pickup failed notification' },
    ],
  },

  rdoc_failed_reasons: {
    whatIs:
      'RDOC (Return Document) pickup task\'ları için başarısızlık neden kodları. RDOC task\'ları yalnızca NOPC neden kodu ile failed yapılabilir — diğer kodlar kullanılamaz.',
    howItWorks: [
      'Kurye RDOC pickup task\'ını failed olarak işaretler',
      'Yalnızca NOPC seçenek olarak gösterilir',
      'PickupFailed API çağrılır',
    ],
    screens: [
      'PickupFailedFragment — Failed RDOC screen',
    ],
    parameters: [
      { name: 'task.isRDOC', desc: 'Is the task RDOC type?', type: 'boolean' },
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
      { type: 'node', label: 'Kapalı', variant: 'end' },
    ],
    tips: [
      'RDOC task\'lar için yalnızca NOPC kullanılabilir — UI tek seçenek gösterir',
      'Tüm ülkelerde aynı davranış',
    ],
    tickets: [],
    experts: [
      { name: 'Operations Team', role: 'RDOC süreçleri' },
    ],
    score: { bugProneness: 1, boilerplate: 1, complexity: 1, testCoverage: 1 },
    apis: [
      { method: 'POST', endpoint: 'Task/PickupFailed', desc: 'RDOC failed notification' },
    ],
  },

  auto_reassignment: {
    whatIs:
      'Başarısız pickup sonrası otomatik yeniden atama. Belirli başarısızlık neden kodları bir sonraki iş gününe otomatik yeniden atamayı tetikler. Tetikleyen kodlar ülkeye göre değişir.',
    howItWorks: [
      'Pickup başarısız olur',
      'Seçilen neden kodu kontrol edilir',
      'Kod tetikleyici listedeyse otomatik reassignment planlanır',
      'Task bir sonraki iş günü kuryeye yeniden atanır',
    ],
    screens: [
      'Background Service — Automatic reassignment (backend side)',
    ],
    parameters: [
      { name: 'country.autoReassignCodes', desc: 'Codes that trigger automatic reassignment', type: 'string[]' },
    ],
    diagram: [
      { type: 'node', label: 'Pickup başarısız', variant: 'start' },
      { type: 'arrow' },
      { type: 'node', label: 'Kod kontrol edilir', variant: 'process' },
      { type: 'arrow' },
      { type: 'node', label: 'Trigger mı?', variant: 'decision' },
      {
        type: 'branch',
        yes: {
          label: 'Evet',
          steps: [
            { type: 'node', label: 'Yeniden atama planlanır', variant: 'process' },
            { type: 'arrow' },
            { type: 'node', label: 'Ertesi güne atanır', variant: 'process' },
          ],
        },
        no: {
          label: 'Hayır',
          steps: [
            { type: 'node', label: 'Kapalı', variant: 'process' },
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
      'BA ve ME\'de otomatik reassignment yok',
    ],
    tickets: [],
    experts: [
      { name: 'Backend Team', role: 'Task yönetimi' },
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
    tickets: [],
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
    tickets: [],
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
    tickets: [],
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
    tickets: [],
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
