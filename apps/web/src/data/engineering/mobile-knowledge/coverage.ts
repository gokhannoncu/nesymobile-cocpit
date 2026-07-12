// Mobile Knowledge Hub — Overview metrikleri.
// Sayımlar domain/screen kayıtlarından türetilir; kapsam yüzdeleri manuel takip.

import { BACKEND_DOMAINS } from './backend-domains'
import { SCREENS } from './screens'

export interface CoverageRow {
  area: string
  pct: number
}

/** Documentation Coverage kartları. */
export const COVERAGE: CoverageRow[] = [
  { area: 'Backend domain’leri', pct: 82 },
  { area: 'Endpoint açıklamaları', pct: 71 },
  { area: 'Mobil ekranlar', pct: 88 },
  { area: 'Error state’ler', pct: 64 },
  { area: 'Screenshot’lar', pct: 76 },
  { area: 'Son sürüm doğrulaması', pct: 69 },
]

export interface RecentItem {
  title: string
  href: string
  when: string
}

export const RECENTLY_UPDATED: RecentItem[] = [
  { title: 'Payment & Fiscal backend akışı', href: '/engineering/mobile-knowledge/backend/payment-fiscal', when: '10 Tem 2026' },
  { title: 'Delivery ekranı', href: '/engineering/mobile-knowledge/screens/delivery', when: '10 Tem 2026' },
  { title: 'D4Me Locker teslimatı', href: '/engineering/mobile-knowledge/backend/d4me-locker', when: '08 Tem 2026' },
  { title: 'Offline request queue', href: '/engineering/mobile-knowledge/backend/offline-sync', when: '05 Tem 2026' },
  { title: 'Route Selection ekranı', href: '/engineering/mobile-knowledge/screens/route-selection', when: '03 Tem 2026' },
]

export const NEEDS_ATTENTION: string[] = [
  '6 doküman 90+ gündür doğrulanmadı',
  '4 yeni endpoint belgelenmedi',
  '3 ekranın hata durumları eksik',
  '2 ülke özelinde farklı davranış tanımsız',
  '5 dokümanın owner’ı yok',
]

/** Overview modül kartları için canlı sayımlar. */
export function hubCounts() {
  const domainsDocumented = BACKEND_DOMAINS.filter((d) => d.documented).length
  const endpoints = BACKEND_DOMAINS.reduce((n, d) => n + (d.endpoints?.length ?? 0), 0)
  const screensDocumented = SCREENS.filter((s) => s.documented).length
  return {
    domainsTotal: BACKEND_DOMAINS.length,
    domainsDocumented,
    domainsStale: BACKEND_DOMAINS.length - domainsDocumented,
    endpoints,
    screensTotal: SCREENS.length,
    screensDocumented,
    screensMissing: SCREENS.length - screensDocumented,
  }
}
