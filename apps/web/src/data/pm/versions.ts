// ─── Project Management — Version & Country Data ─────────────────────────────

import type { CountryVersion, VersionEntry } from './types'

export const COUNTRY_LABELS: Record<string, string> = {
  core: 'CORE',
  hr: 'Hırvatistan',
  si: 'Slovenya',
  rs: 'Sırbistan',
  ba: 'Bosna-Hersek',
  me: 'Karadağ',
  sk: 'Slovakya',
}

export const countryVersions: CountryVersion[] = [
  {
    countryId: 'hr',
    countryName: 'Hırvatistan (HR)',
    production: '4.3.0',
    staging: '4.3.1-rc.2',
    lastDeployDate: '2026-07-01',
    storeUrl: 'https://play.google.com/store/apps/details?id=com.aras.nesy.hr',
  },
  {
    countryId: 'rs',
    countryName: 'Sırbistan (RS)',
    production: '4.3.0',
    staging: '4.3.1-rc.2',
    lastDeployDate: '2026-07-01',
    storeUrl: 'https://play.google.com/store/apps/details?id=com.aras.nesy.rs',
  },
  {
    countryId: 'si',
    countryName: 'Slovenya (SI)',
    production: '4.3.0',
    staging: '4.3.1-rc.2',
    lastDeployDate: '2026-07-01',
    storeUrl: 'https://play.google.com/store/apps/details?id=com.aras.nesy.si',
  },
  {
    countryId: 'ba',
    countryName: 'Bosna-Hersek (BA)',
    production: '4.2.1',
    staging: '4.3.0-rc.1',
    lastDeployDate: '2026-06-15',
    storeUrl: 'https://play.google.com/store/apps/details?id=com.aras.nesy.ba',
  },
  {
    countryId: 'me',
    countryName: 'Karadağ (ME)',
    production: '4.2.1',
    staging: '4.3.0-rc.1',
    lastDeployDate: '2026-06-15',
    storeUrl: 'https://play.google.com/store/apps/details?id=com.aras.nesy.me',
  },
  {
    countryId: 'sk',
    countryName: 'Slovakya (SK)',
    production: '4.2.0',
    staging: '4.3.0-beta.1',
    lastDeployDate: '2026-05-20',
    storeUrl: 'https://play.google.com/store/apps/details?id=com.aras.nesy.sk',
  },
]

export const versionHistory: VersionEntry[] = [
  {
    version: '4.3.0',
    releaseDate: '2026-07-01',
    ticketsResolved: 6,
    highlights: [
      'D4Me otomatik flaş QR okuma',
      'Bildirim kanalı ayrımı',
      'Dark mode WCAG AA uyum',
      'Vergi BigDecimal geçişi',
    ],
  },
  {
    version: '4.2.1',
    releaseDate: '2026-06-15',
    ticketsResolved: 3,
    highlights: [
      'PDF encoding düzeltmesi',
      'Barkod karakter limiti artışı',
      'Bildirim kanal yapılandırması',
    ],
  },
  {
    version: '4.2.0',
    releaseDate: '2026-05-20',
    ticketsResolved: 1,
    highlights: [
      'Yeni End of Day rapor ekranı',
      'Shipment Tracking iyileştirmesi',
      'Dark mode temel destek',
    ],
  },
  {
    version: '4.1.2',
    releaseDate: '2026-04-28',
    ticketsResolved: 0,
    highlights: [
      'HR fiskalizasyon sertifika yenileme',
      'RS POS bağlantı stabilitesi',
    ],
  },
  {
    version: '4.1.0',
    releaseDate: '2026-03-15',
    ticketsResolved: 0,
    highlights: [
      'Hub Companion modülü',
      'Shipment Detail gelişmiş görünüm',
      'Task List yeni filtreler',
    ],
  },
  {
    version: '4.0.0',
    releaseDate: '2025-12-01',
    endOfLife: '2026-06-01',
    ticketsResolved: 0,
    highlights: [
      'İlk multi-country release',
      'CORE + 4 ülke desteği',
    ],
  },
  {
    version: '3.9.2',
    releaseDate: '2025-09-15',
    endOfLife: '2026-03-15',
    ticketsResolved: 0,
    highlights: [
      'Son legacy architecture release',
      'Sadece HR desteği',
    ],
  },
]

// ═══ Helpers ════════════════════════════════════════════════════════════════

export function getProductionVersion(countryId: string) {
  return countryVersions.find((v) => v.countryId === countryId)?.production
}

export function getOutdatedCountries() {
  const latest = countryVersions
    .map((v) => v.production)
    .sort((a, b) => b.localeCompare(a))[0]
  return countryVersions.filter((v) => v.production !== latest)
}
