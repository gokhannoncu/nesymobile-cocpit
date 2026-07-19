import type { FeatureDomain, FeatureDomainId } from './nesy-types'

export const FEATURE_DOMAINS: FeatureDomain[] = [
  {
    id: 'payments-fiscal',
    title: 'Ödemeler & Fiskal',
    desc: 'Nakit/kart tahsilatı, skip kuralları ve teslimat veya pickup sırasında fiskal fiş yazdırma.',
  },
  {
    id: 'delivery-outcomes',
    title: 'Teslimat sonuçları',
    desc: 'Kapı teslimatı tamamlama: başarısızlık kanıtı, alıcı, imza ve alternatif teslimat noktaları.',
  },
  {
    id: 'pickup-operations',
    title: 'Pickup operasyonları',
    desc: 'Pickup ataması, saha varyantları, başarısızlık nedenleri ve ertesi gün yeniden atama.',
  },
  {
    id: 'tour-stops',
    title: 'Tour & Stop',
    desc: 'Stop oluşturma/birleştirme, beginning-of-day tour onayı ve HC event listesi.',
  },
  {
    id: 'tracking-self-service',
    title: 'Tracking & self-service',
    desc: 'Shipment tracking UI, Ebranch teslimat seçenekleri ve D4Me locker akışları.',
  },
]

export function getFeatureDomain(id: FeatureDomainId): FeatureDomain | undefined {
  return FEATURE_DOMAINS.find((domain) => domain.id === id)
}
