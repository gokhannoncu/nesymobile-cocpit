// ─── Project Management — Version & Country Data ─────────────────────────────

import type { CountryVersion, VersionEntry } from './types'

export const COUNTRY_LABELS: Record<string, string> = {
  core: 'CORE',
  hr: 'Croatia',
  si: 'Slovenia',
  rs: 'Serbia',
  ba: 'Bosnia-Herzegovina',
  me: 'Montenegro',
  sk: 'Slovakia',
}

export const countryVersions: CountryVersion[] = [
  {
    countryId: 'hr',
    countryName: 'Croatia (HR)',
    production: '4.3.0',
    staging: '4.3.1-rc.2',
    lastDeployDate: '2026-07-01',
    storeUrl: 'https://play.google.com/store/apps/details?id=com.aras.nesy.hr',
  },
  {
    countryId: 'rs',
    countryName: 'Serbia (RS)',
    production: '4.3.0',
    staging: '4.3.1-rc.2',
    lastDeployDate: '2026-07-01',
    storeUrl: 'https://play.google.com/store/apps/details?id=com.aras.nesy.rs',
  },
  {
    countryId: 'si',
    countryName: 'Slovenia (SI)',
    production: '4.3.0',
    staging: '4.3.1-rc.2',
    lastDeployDate: '2026-07-01',
    storeUrl: 'https://play.google.com/store/apps/details?id=com.aras.nesy.si',
  },
  {
    countryId: 'ba',
    countryName: 'Bosnia-Herzegovina (BA)',
    production: '4.2.1',
    staging: '4.3.0-rc.1',
    lastDeployDate: '2026-06-15',
    storeUrl: 'https://play.google.com/store/apps/details?id=com.aras.nesy.ba',
  },
  {
    countryId: 'me',
    countryName: 'Montenegro (ME)',
    production: '4.2.1',
    staging: '4.3.0-rc.1',
    lastDeployDate: '2026-06-15',
    storeUrl: 'https://play.google.com/store/apps/details?id=com.aras.nesy.me',
  },
  {
    countryId: 'sk',
    countryName: 'Slovakia (SK)',
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
      'D4Me automatic flash QR scanning',
      'Notification channel separation',
      'Dark mode WCAG AA compliance',
      'Tax BigDecimal migration',
    ],
  },
  {
    version: '4.2.1',
    releaseDate: '2026-06-15',
    ticketsResolved: 3,
    highlights: [
      'PDF encoding fix',
      'Barcode character limit increase',
      'Notification channel configuration',
    ],
  },
  {
    version: '4.2.0',
    releaseDate: '2026-05-20',
    ticketsResolved: 1,
    highlights: [
      'New End of Day report screen',
      'Shipment Tracking enhancement',
      'Dark mode basic support',
    ],
  },
  {
    version: '4.1.2',
    releaseDate: '2026-04-28',
    ticketsResolved: 0,
    highlights: [
      'HR fiscalization certificate renewal',
      'RS POS connection stability',
    ],
  },
  {
    version: '4.1.0',
    releaseDate: '2026-03-15',
    ticketsResolved: 0,
    highlights: [
      'Hub Companion module',
      'Shipment Detail advanced view',
      'Task List new filters',
    ],
  },
  {
    version: '4.0.0',
    releaseDate: '2025-12-01',
    endOfLife: '2026-06-01',
    ticketsResolved: 0,
    highlights: [
      'First multi-country release',
      'CORE + 4 country support',
    ],
  },
  {
    version: '3.9.2',
    releaseDate: '2025-09-15',
    endOfLife: '2026-03-15',
    ticketsResolved: 0,
    highlights: [
      'Last legacy architecture release',
      'HR only support',
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
