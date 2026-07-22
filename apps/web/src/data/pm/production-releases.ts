// Production release history derived from first-parent merges on rel/env-prod.
// Commits inside a merged PR are intentionally not counted as separate releases.

import type { CountryId, Release } from './types'

export type ProductionReleaseKind = 'code' | 'workflow' | 'rollout'

export interface CountryVersionTransition {
  countryId: Extract<CountryId, 'hr' | 'si' | 'rs' | 'ba' | 'me'>
  from: number | null
  to: number
}

export interface ProductionRelease extends Release {
  sequence: number
  title: string
  commit: string
  time?: string
  kind: ProductionReleaseKind
  versionTransitions: CountryVersionTransition[]
  alerts?: string[]
  sourceBranch: 'rel/env-prod'
}

type ReleaseInput = Pick<
  ProductionRelease,
  | 'sequence'
  | 'title'
  | 'commit'
  | 'date'
  | 'kind'
  | 'versionTransitions'
  | 'features'
  | 'fixes'
> &
  Partial<Pick<ProductionRelease, 'time' | 'notes' | 'alerts'>>

const productionRelease = (input: ReleaseInput): ProductionRelease => ({
  ...input,
  id: `prod-${input.commit}`,
  version: `R${String(input.sequence).padStart(2, '0')}`,
  status: 'released',
  countries: [...new Set(input.versionTransitions.map((transition) => transition.countryId))],
  ticketIds: [],
  sourceBranch: 'rel/env-prod',
})

export const productionReleases: ProductionRelease[] = [
  productionRelease({
    sequence: 1,
    title: 'İlk prod matrisi',
    commit: 'ff27ebbf',
    date: '2026-03-22',
    kind: 'workflow',
    versionTransitions: [
      { countryId: 'hr', from: null, to: 248 },
      { countryId: 'si', from: null, to: 160 },
      { countryId: 'rs', from: null, to: 51 },
      { countryId: 'ba', from: null, to: 16 },
      { countryId: 'me', from: null, to: 8 },
    ],
    features: [
      'version-prod.json oluşturuldu.',
      'Tüm ülkeler için Android prod build workflow’u hazırlandı ve güncellendi.',
    ],
    fixes: [],
    notes: 'Uygulama özelliği yok; prod release altyapısının başlangıcı.',
  }),
  productionRelease({
    sequence: 2,
    title: 'SI, RS, BA ve ME rollout',
    commit: '8eb86b52',
    date: '2026-03-23',
    kind: 'rollout',
    versionTransitions: [
      { countryId: 'si', from: 160, to: 161 },
      { countryId: 'rs', from: 51, to: 52 },
      { countryId: 'ba', from: 16, to: 17 },
      { countryId: 'me', from: 8, to: 9 },
    ],
    features: [],
    fixes: [],
    notes: 'Yalnızca rollout; yeni uygulama kodu yok.',
  }),
  productionRelease({
    sequence: 3,
    title: 'ME ödeme diyaloğu',
    commit: '908fd406',
    date: '2026-03-24',
    time: '03:48',
    kind: 'code',
    versionTransitions: [
      { countryId: 'rs', from: 52, to: 53 },
      { countryId: 'me', from: 9, to: 10 },
    ],
    features: [
      'Ödeme diyaloğu Karadağ (ME) teslimat akışında da açılacak şekilde genişletildi.',
      'Sırbistan’a uygulanan ödeme diyaloğu davranışı ME için de etkinleştirildi.',
    ],
    fixes: [],
  }),
  productionRelease({
    sequence: 4,
    title: 'ME kamera davranışı düzeltmesi',
    commit: 'a29209aa',
    date: '2026-03-24',
    time: '03:57',
    kind: 'code',
    versionTransitions: [{ countryId: 'me', from: 10, to: 11 }],
    features: [],
    fixes: [
      'Başarısız teslimat ekranındaki kamera/fotoğraf seçeneği RS ile birlikte ME için de kısıtlandı.',
      'Yanlış ülke koşulundan kaynaklanan kamera davranışı düzeltildi.',
    ],
  }),
  productionRelease({
    sequence: 5,
    title: 'ME teslimat UAT düzeltmeleri',
    commit: 'f3a8ce2f',
    date: '2026-03-24',
    time: '04:54',
    kind: 'code',
    versionTransitions: [
      { countryId: 'rs', from: 53, to: 54 },
      { countryId: 'me', from: 11, to: 12 },
    ],
    features: [
      'ME teslimat akışında DEPS seçeneği gizlendi.',
      'ME için teslimat kodu veya imza zorunluluğu kaldırıldı.',
      'ME için müşteri kartla ödeme uygunluk servisi çağrılmadan mevcut ödeme akışına devam edilmesi sağlandı.',
      'Aynı davranışlar görev listesi ve teslimat seçenekleri ekranlarına uygulandı.',
    ],
    fixes: ['UAT sırasında tespit edilen ME teslimat sorunları giderildi.'],
  }),
  productionRelease({
    sequence: 6,
    title: 'ME rollout',
    commit: '49034dc0',
    date: '2026-03-24',
    time: '06:01',
    kind: 'rollout',
    versionTransitions: [{ countryId: 'me', from: 12, to: 13 }],
    features: [],
    fixes: [],
    notes: 'Yalnızca rollout; yeni uygulama kodu yok.',
  }),
  productionRelease({
    sequence: 7,
    title: 'BA ödeme diyaloğu',
    commit: 'e797489b',
    date: '2026-03-24',
    time: '06:48',
    kind: 'code',
    versionTransitions: [{ countryId: 'rs', from: 54, to: 55 }],
    features: [
      'Bosna (BA) teslimatları ödeme diyaloğuna dahil edildi.',
      'RS ve ME için çalışan ödeme seçimi davranışı BA için de etkinleştirildi.',
    ],
    fixes: [],
  }),
  productionRelease({
    sequence: 8,
    title: 'BA rollout',
    commit: '3e99d01b',
    date: '2026-03-24',
    time: '06:55',
    kind: 'rollout',
    versionTransitions: [{ countryId: 'ba', from: 17, to: 18 }],
    features: [],
    fixes: [],
    notes: 'Yalnızca rollout; yeni uygulama kodu yok.',
  }),
  productionRelease({
    sequence: 9,
    title: 'BA para birimi normalizasyonu',
    commit: '609873d6',
    date: '2026-03-24',
    time: '07:11',
    kind: 'code',
    versionTransitions: [{ countryId: 'ba', from: 18, to: 19 }],
    features: [],
    fixes: [
      'Bosna para birimi normalizasyonu yapıldı.',
      'API’den EUR gelen BA tutarlarının BAM olarak gösterilmesi sağlandı.',
      'Boş veya Default para birimlerinin ülkenin yerel para birimine dönüştürülmesi sağlandı.',
    ],
  }),
  productionRelease({
    sequence: 10,
    title: 'BA kararlılık paketi',
    commit: '3cead850',
    date: '2026-03-24',
    time: '23:45',
    kind: 'code',
    versionTransitions: [{ countryId: 'ba', from: 19, to: 20 }],
    features: [
      'Bosna telefon numarası normalizasyonu eklendi.',
      'BA için teslimat kodu/imza zorunluluğu kaldırıldı.',
      'Kamera ve hasar fotoğrafları PNG yerine doğru MIME tipiyle JPEG olarak kaydedilmeye başlandı.',
      'Fotoğraf URI’larının ekranlar arasında güvenli taşınması sağlandı.',
    ],
    fixes: [
      'Shipment, Task ve Collection modellerindeki Parcelable kaynaklı crash’ler düzeltildi.',
      'Fragment kapanırken yapılan UI işlemlerine lifecycle kontrolleri eklendi.',
      'Pickup fail reason liste/ID eşleşmesinden kaynaklanan index crash’leri düzeltildi.',
      'Route onay butonunun hata sonrasında kilitli kalması düzeltildi.',
      'Dil seçiminde activity’nin gereksiz tekrar oluşturulmasından kaynaklanan ANR düzeltildi.',
      'Bildirim veritabanı işlemleri ve çağrı logu okumaları arka plana taşındı.',
      'Foreground request service başlangıç ve kapanış davranışları sağlamlaştırıldı.',
      'İmza dosya adları güvenli hale getirildi; dosya oluşturma hataları ele alındı.',
    ],
    notes: 'Geniş kapsamlı kararlılık paketi.',
  }),
  productionRelease({
    sequence: 11,
    title: 'HR, RS ve ME rollout',
    commit: '2f582bf8',
    date: '2026-03-25',
    time: '00:49',
    kind: 'rollout',
    versionTransitions: [
      { countryId: 'hr', from: 248, to: 249 },
      { countryId: 'rs', from: 55, to: 56 },
      { countryId: 'me', from: 13, to: 14 },
    ],
    features: [],
    fixes: [],
    notes: 'Yalnızca rollout; yeni uygulama kodu yok.',
  }),
  productionRelease({
    sequence: 12,
    title: 'SI gün sonu CPP düzenlemesi',
    commit: '175e5dd9',
    date: '2026-03-25',
    time: '04:21',
    kind: 'code',
    versionTransitions: [{ countryId: 'si', from: 161, to: 162 }],
    features: [],
    fixes: [
      'Slovenya için CPP/Cash Prepaid tutarlarının gün sonu özetine dahil edilmesi kaldırıldı.',
      'SI özet ekranında CPP satırı ve ilgili tahsilat hesapları gizlendi.',
    ],
  }),
  productionRelease({
    sequence: 13,
    title: 'SI notification lifecycle crash düzeltmesi',
    commit: '789f64f8',
    date: '2026-03-25',
    time: '04:28',
    kind: 'code',
    versionTransitions: [{ countryId: 'si', from: 162, to: 163 }],
    features: [],
    fixes: [
      'Notification DAO referansı coroutine başlamadan alınarak fragment/database lifecycle kaynaklı SI crash’i giderildi.',
    ],
  }),
  productionRelease({
    sequence: 14,
    title: 'HR ve BA rollout',
    commit: 'ab609a51',
    date: '2026-03-25',
    time: '05:01',
    kind: 'rollout',
    versionTransitions: [
      { countryId: 'hr', from: 249, to: 250 },
      { countryId: 'ba', from: 20, to: 21 },
    ],
    features: [],
    fixes: [],
    notes: 'Yalnızca rollout; yeni uygulama kodu yok.',
  }),
  productionRelease({
    sequence: 15,
    title: 'SI ve RS rollout',
    commit: 'efa8120c',
    date: '2026-03-25',
    time: '05:24',
    kind: 'rollout',
    versionTransitions: [
      { countryId: 'si', from: 163, to: 164 },
      { countryId: 'rs', from: 56, to: 57 },
    ],
    features: [],
    fixes: [],
    notes: 'Yalnızca rollout; yeni uygulama kodu yok.',
  }),
  productionRelease({
    sequence: 16,
    title: 'ME rollout',
    commit: '75faceff',
    date: '2026-03-25',
    time: '22:08',
    kind: 'rollout',
    versionTransitions: [{ countryId: 'me', from: 14, to: 15 }],
    features: [],
    fixes: [],
    notes: 'Yalnızca rollout; yeni uygulama kodu yok.',
  }),
  productionRelease({
    sequence: 17,
    title: 'Route ve crash kararlılık iyileştirmeleri',
    commit: '60c0333f',
    date: '2026-03-26',
    kind: 'code',
    versionTransitions: [
      { countryId: 'hr', from: 250, to: 251 },
      { countryId: 'si', from: 164, to: 165 },
      { countryId: 'rs', from: 57, to: 58 },
      { countryId: 'ba', from: 21, to: 22 },
      { countryId: 'me', from: 15, to: 16 },
    ],
    features: [
      'Create Instance Task servisinin hata mesajı kullanıcıya dialog ile gösterilmeye başlandı.',
      'Servis cevabına expected/actual zone bilgileri eklendi.',
    ],
    fixes: [
      'Change Route butonu gün başlangıcı ve onay bekleme durumlarında gösterilecek şekilde düzeltildi.',
      'Route ve Auto-DEPS seçiminin yalnızca başarılı işlemden sonra kaydedilmesi sağlandı.',
      'Klavye autocomplete işlemlerindeki IndexOutOfBoundsException için güvenli EditText bileşenleri geliştirildi ve ekranlara uygulandı.',
      'Hub Companion parcel listelerinde null parcel ve bulunamayan barkod crash’leri giderildi.',
      'Shipment RecyclerView adapter kullanımı ve performansı iyileştirildi.',
      'HR/RS/ME ve ParcelShop/Locker pickup’larında NOPE reason seçeneği filtrelendi.',
      'Test workflow’unda Gradle native cache temizleme sırası düzeltildi.',
    ],
  }),
  productionRelease({
    sequence: 18,
    title: 'Call Log ve lifecycle kararlılık iyileştirmeleri',
    commit: '6a7fb9c7',
    date: '2026-03-31',
    kind: 'code',
    versionTransitions: [
      { countryId: 'hr', from: 251, to: 252 },
      { countryId: 'si', from: 165, to: 166 },
      { countryId: 'rs', from: 58, to: 59 },
      { countryId: 'ba', from: 22, to: 23 },
      { countryId: 'me', from: 16, to: 17 },
    ],
    features: [
      'Android Call Log’a gecikmeli yansıyan telefon görüşmesi kayıtları için 5 denemeli retry mekanizması eklendi.',
      'Aynı görüşme loglarının çakışmaması için çağrı başlangıç zamanı request unique key’e eklendi.',
    ],
    fixes: [
      'RS telefon numarası Call Log sorgusunda bozulmadan kullanılmaya başlandı.',
      'Pickup NOPE reason filtresi SI için de etkinleştirildi.',
      'Foreground RequestSenderService başlatma hataları düzeltildi.',
      'Fragment kapandıktan sonra navigation veya content observer işlemlerinden oluşan crash’ler engellendi.',
    ],
  }),
  productionRelease({
    sequence: 19,
    title: 'Fiscal yazdırma ve servis kararlılığı',
    commit: '857a99e0',
    date: '2026-04-13',
    kind: 'code',
    versionTransitions: [
      { countryId: 'si', from: 166, to: 167 },
      { countryId: 'rs', from: 59, to: 60 },
      { countryId: 'me', from: 17, to: 18 },
    ],
    features: [
      'Yazıcı bağlantısı zorunluluğu build configuration üzerinden yönetilebilir hale getirildi.',
      'CPP tutarı yoksa yazıcı kontrolünü atlama davranışı eklendi.',
      'CPP fiscal fişi yazdırılamazsa faturanın refund edilmesi, yerel durumun geri alınması ve refund fişinin yazdırılması eklendi.',
      'Foreground servis crash kayıtlarının sonraki açılışta sunucuya gönderilmesi eklendi.',
      'Loglara schedule, kurye ve kullanıcı bilgileri eklendi.',
    ],
    fixes: [
      'D4ME/LOS rezervasyon davranışları düzeltildi.',
      'BA ve ME için DEPS butonu gizlendi.',
      'Cleartext HTTP trafiği kapatıldı.',
      'Eski OfflineModeCheckService kaldırıldı; offline/foreground servis yapısı sadeleştirildi.',
      'RequestSender ve Location service lifecycle/performance iyileştirmeleri yapıldı.',
      'Stop listesi boşken gün sonu yapılamadığına dair uyarı tüm dillerde yerelleştirildi.',
    ],
    notes: 'Geniş kapsamlı işlev ve kararlılık release’i.',
  }),
  productionRelease({
    sequence: 20,
    title: 'HR ve SI rollout',
    commit: 'df71e56f',
    date: '2026-04-29',
    time: '03:43',
    kind: 'rollout',
    versionTransitions: [
      { countryId: 'hr', from: 252, to: 253 },
      { countryId: 'si', from: 167, to: 168 },
    ],
    features: [],
    fixes: [],
    notes: 'Yalnızca rollout; yeni uygulama kodu yok.',
  }),
  productionRelease({
    sequence: 21,
    title: 'SI müşteri doğrulama düzeltmesi',
    commit: 'fcf41692',
    date: '2026-04-29',
    time: '05:52',
    kind: 'code',
    versionTransitions: [{ countryId: 'si', from: 168, to: 169 }],
    features: [],
    fixes: [
      'Görev listesindeki müşteri doğrulama koşulu düzeltildi.',
      'Geçersiz customerId bulunmasının tek başına işleme izin vermesi engellendi.',
      'İşlemin yalnızca shipment müşteri kontrolü gerçekten başarılı olduğunda devam etmesi sağlandı.',
    ],
  }),
  productionRelease({
    sequence: 22,
    title: 'RS rollout',
    commit: '039300f1',
    date: '2026-04-29',
    time: '23:41',
    kind: 'rollout',
    versionTransitions: [{ countryId: 'rs', from: 60, to: 61 }],
    features: [],
    fixes: [],
    notes: 'Yalnızca rollout; yeni uygulama kodu yok.',
  }),
  productionRelease({
    sequence: 23,
    title: 'BA session ve izin hotfix’i',
    commit: '44de8646',
    date: '2026-05-06',
    kind: 'code',
    versionTransitions: [{ countryId: 'ba', from: 23, to: 24 }],
    features: [
      'JWT ve mevcut schedule üzerinden merkezi session validator eklendi.',
      'Süresi bitmiş kurye oturumlarının uygulama açılışında login ekranına yönlendirilmesi sağlandı.',
      'Hub Companion ve Branch Manager rolleri session kontrolünden ayrıldı.',
    ],
    fixes: [
      'Call Log observer yalnız gerekli telefon izinleri varsa kaydedilecek şekilde düzeltildi.',
      'Telefon izni olmadığında oluşan SecurityException crash’leri giderildi.',
      'Kamera, telefon ve konum izinlerine ilişkin açıklamalar ortak ve doğru bir metinde birleştirildi.',
      'Delivery ve Stop List ekranlarında fragment kapandıktan sonra çalışan callback’lere lifecycle kontrolleri eklendi.',
      'Çeşitli NPE crash’leri düzeltildi.',
    ],
    notes: 'Prod hotfix paketi.',
  }),
  productionRelease({
    sequence: 24,
    title: 'HR kredi kartı / RaiPay hotfix’i',
    commit: '8dd21cd5',
    date: '2026-05-15',
    kind: 'code',
    versionTransitions: [{ countryId: 'hr', from: 253, to: 255 }],
    features: [],
    fixes: [
      'Offline durumda kredi kartı işlemi yapılması engellendi.',
      'RaiPay dönüşünde teslimatın yalnız HTTP success’e göre değil, status_transaction == 1 sonucuna göre tamamlanması sağlandı.',
      'Ödeme onaylanmadıysa teslimatın yanlışlıkla tamamlanması engellendi.',
      'Başarısız veya iptal edilen ödeme sonrasında pending payment ve collection state temizlendi.',
      'Uygulama yeniden açıldığında pending ödeme kontrolü başarısızsa queued delivery oluşturulması engellendi.',
      'Aynı teslimat request’inin iki defa kuyruğa alınması engellendi.',
    ],
  }),
  productionRelease({
    sequence: 25,
    title: 'Scan Optimization V2',
    commit: '6263a157',
    date: '2026-05-20',
    time: '15:24',
    kind: 'code',
    versionTransitions: [
      { countryId: 'rs', from: 61, to: 62 },
      { countryId: 'ba', from: 24, to: 27 },
      { countryId: 'me', from: 18, to: 17 },
    ],
    features: [
      'Scan akışı ScanCoordinator, ScanProcessor, ScanState, ScanFlowState, ScanQueueGuard ve ScanLoadingController bileşenlerine ayrıldı.',
      'Baştan sona scan ve load-to-vehicle akışı yeniden geliştirildi.',
      'Eş zamanlı/tekrarlı taramaları engelleyen queue guard eklendi.',
      'Scan API çağrıları ve UI state yönetimi merkezi hale getirildi.',
      'Scan sürelerini ve darboğazları ölçen performans trace altyapısı eklendi.',
      'Parcel ID ve Nesy barkodundan çıkarılan parcel ID eşleştirmesi eklendi.',
      'LOS/D4ME aktif rezervasyonları için kullanıcı uyarısı ve rezervasyon iptal akışı eklendi.',
    ],
    fixes: [
      'Network hataları normal servis hatalarından ayrıldı ve offline dialog gösterildi.',
      'Scan loading, dialog ve state’in kilitli kalmasına neden olan UAT sorunları giderildi.',
      'Delivery collection polling LiveData yerine güvenli suspend çağrılarına geçirildi.',
      'Offline teslimatta fragment context’i yerine application context kullanılarak lifecycle crash’i engellendi.',
      'Kredi kartı düzeltmeleri bu dala da dahil edildi.',
      'Başarılı scan loglarının gereksiz gönderimi kapatıldı.',
    ],
    alerts: ['ME version’ı 18→17 geri alındı; bu release’te artış yerine rollback var.'],
    notes: 'Büyük Scan Optimization V2 release’i.',
  }),
  productionRelease({
    sequence: 26,
    title: 'HR ve SI Scan V2 rollout',
    commit: 'ae8dc755',
    date: '2026-05-20',
    time: '15:29',
    kind: 'rollout',
    versionTransitions: [
      { countryId: 'hr', from: 255, to: 256 },
      { countryId: 'si', from: 169, to: 170 },
    ],
    features: [],
    fixes: [],
    notes: 'Yeni kod yok; bir önceki Scan Optimization V2 kodunun HR/SI paket rollout’u.',
  }),
  productionRelease({
    sequence: 27,
    title: 'RS ve ME rollout',
    commit: '372f0760',
    date: '2026-05-21',
    kind: 'rollout',
    versionTransitions: [
      { countryId: 'rs', from: 62, to: 65 },
      { countryId: 'me', from: 17, to: 27 },
    ],
    features: [],
    fixes: [],
    notes: 'Yalnızca rollout; özellikle ME için büyük sürüm sıçramasına rağmen kaynak kod değişmedi.',
  }),
  productionRelease({
    sequence: 28,
    title: 'HR ve SI rollout',
    commit: 'bd0901d3',
    date: '2026-06-04',
    kind: 'rollout',
    versionTransitions: [
      { countryId: 'hr', from: 256, to: 257 },
      { countryId: 'si', from: 170, to: 171 },
    ],
    features: [],
    fixes: [],
    notes: 'Yalnızca rollout; yeni uygulama kodu yok.',
  }),
  productionRelease({
    sequence: 29,
    title: 'HR, SI, RS ve ME rollout',
    commit: 'd7f365bc',
    date: '2026-06-07',
    kind: 'rollout',
    versionTransitions: [
      { countryId: 'hr', from: 257, to: 258 },
      { countryId: 'si', from: 171, to: 172 },
      { countryId: 'rs', from: 65, to: 66 },
      { countryId: 'me', from: 27, to: 28 },
    ],
    features: [],
    fixes: [],
    notes: 'Yalnızca rollout; yeni uygulama kodu yok.',
  }),
  productionRelease({
    sequence: 30,
    title: 'HR ve SI rollout',
    commit: 'ec583390',
    date: '2026-06-23',
    kind: 'rollout',
    versionTransitions: [
      { countryId: 'hr', from: 258, to: 259 },
      { countryId: 'si', from: 172, to: 173 },
    ],
    features: [],
    fixes: [],
    notes: 'Yalnızca rollout; yeni uygulama kodu yok.',
  }),
  productionRelease({
    sequence: 31,
    title: 'Gün sonu ve crash hotfix paketi',
    commit: 'fed54a9f',
    date: '2026-06-25',
    kind: 'code',
    versionTransitions: [
      { countryId: 'rs', from: 66, to: 67 },
      { countryId: 'ba', from: 27, to: 28 },
      { countryId: 'me', from: 28, to: 29 },
    ],
    features: [],
    fixes: [
      'End of Day gönderildikten sonra status’un bellekte ve yerel veritabanında kalıcı olarak saklanması sağlandı.',
      'Ekrana geri dönüldüğünde eski Approved status’unun End of Day butonunu yeniden açması engellendi.',
      'End of Day veya Waiting for Approval durumunda butonun yanlışlıkla tur başlatma akışını açması engellendi.',
      'Delivery Failed ekranında fragment activity’den ayrıldıktan sonra oluşan crash giderildi.',
      'Hub Companion Scan Parcel ekranındaki activity cast/NPE sorunları düzeltildi.',
      'Scan bottom sheet’in FragmentManager transaction sırasında açılmasından kaynaklanan crash giderildi.',
      'Bazı cihazlarda network callback kaydında oluşan SecurityException yakalanarak uygulamanın açılışta çökmesi engellendi.',
    ],
  }),
  productionRelease({
    sequence: 32,
    title: 'HR ödeme hotfix’i',
    commit: '5d6e1c30',
    date: '2026-07-09',
    time: '17:31',
    kind: 'code',
    versionTransitions: [{ countryId: 'hr', from: 259, to: 261 }],
    features: [],
    fixes: [
      'Ödeme tahsilat kontrolü yalnızca taranıp seçilen shipment’lara uygulanacak şekilde düzeltildi.',
      'Seçilmemiş bir pakette tahsil edilmemiş collection bulunmasının mevcut teslimatı yanlışlıkla bloke etmesi engellendi.',
    ],
  }),
  productionRelease({
    sequence: 33,
    title: 'HR version düzeltmesi',
    commit: '1a4572e5',
    date: '2026-07-09',
    time: '23:12',
    kind: 'rollout',
    versionTransitions: [{ countryId: 'hr', from: 261, to: 262 }],
    features: [],
    fixes: [],
    notes: 'Yalnızca rollout/version düzeltmesi; yeni uygulama kodu yok.',
  }),
  productionRelease({
    sequence: 34,
    title: 'SI, RS, BA ve ME toplu rollout',
    commit: 'd5941156',
    date: '2026-07-10',
    kind: 'rollout',
    versionTransitions: [
      { countryId: 'si', from: 173, to: 174 },
      { countryId: 'rs', from: 67, to: 68 },
      { countryId: 'ba', from: 28, to: 29 },
      { countryId: 'me', from: 29, to: 30 },
    ],
    features: [],
    fixes: [],
    notes:
      'Yeni kod yok; o tarihte prod dalında bulunan gün sonu, crash ve HR ödeme hotfix kodlarıyla aynı kod tabanı paketlendi.',
  }),
  productionRelease({
    sequence: 35,
    title: 'GetLatestVersion canlı prod sürümleri',
    commit: 'glv-20260722',
    date: '2026-07-22',
    kind: 'rollout',
    versionTransitions: [
      { countryId: 'hr', from: 262, to: 264 },
      { countryId: 'si', from: 174, to: 176 },
      { countryId: 'rs', from: 68, to: 69 },
      { countryId: 'me', from: 30, to: 31 },
    ],
    features: [],
    fixes: [],
    notes:
      'Ülke × prod GetLatestVersion (AppName) yanıtlarından alındı. BA prod 29’da kaldı. Test (stage) versionCode’ları bu tabloda tutulmaz.',
  }),
]

export const productionReleaseSummary = {
  total: productionReleases.length,
  code: productionReleases.filter((release) => release.kind === 'code').length,
  workflow: productionReleases.filter((release) => release.kind === 'workflow').length,
  rollout: productionReleases.filter((release) => release.kind === 'rollout').length,
} as const

export function getCountryVersionHistory(countryId: CountryVersionTransition['countryId']) {
  return productionReleases.flatMap((release) => {
    const transition = release.versionTransitions.find((item) => item.countryId === countryId)
    return transition ? [{ release, transition }] : []
  })
}

/**
 * Returns the application-code releases carried by a rollout-only package.
 *
 * Each country's last version transition is used as the lower boundary. When
 * there was no new code between two rollout steps, the latest code release is
 * still returned because that is the codebase being repackaged.
 */
export function getCarriedCodeReleases(target: ProductionRelease) {
  if (target.kind !== 'rollout') return []

  const targetIndex = productionReleases.findIndex((release) => release.id === target.id)
  if (targetIndex <= 0) return []

  const carriedReleaseIds = new Set<string>()
  const priorReleases = productionReleases.slice(0, targetIndex)

  target.versionTransitions.forEach(({ countryId }) => {
    let previousTransitionIndex = -1

    for (let index = targetIndex - 1; index >= 0; index -= 1) {
      if (
        productionReleases[index]?.versionTransitions.some(
          (transition) => transition.countryId === countryId,
        )
      ) {
        previousTransitionIndex = index
        break
      }
    }

    const codeReleases = productionReleases
      .slice(previousTransitionIndex >= 0 ? previousTransitionIndex : 0, targetIndex)
      .filter((release) => release.kind === 'code')

    if (codeReleases.length > 0) {
      codeReleases.forEach((release) => carriedReleaseIds.add(release.id))
      return
    }

    const latestPriorCodeRelease = [...priorReleases]
      .reverse()
      .find((release) => release.kind === 'code')

    if (latestPriorCodeRelease) carriedReleaseIds.add(latestPriorCodeRelease.id)
  })

  return productionReleases
    .filter((release) => carriedReleaseIds.has(release.id))
    .sort((a, b) => b.sequence - a.sequence)
}

export const latestCountryVersions = productionReleases.reduce<Partial<Record<CountryId, number>>>(
  (versions, release) => {
    release.versionTransitions.forEach((transition) => {
      versions[transition.countryId] = transition.to
    })
    return versions
  },
  {},
)

export function getLatestProductionRelease() {
  return productionReleases.at(-1)
}
