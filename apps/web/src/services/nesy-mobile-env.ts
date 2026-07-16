export type NesyMobileCountry = 'HR' | 'SI' | 'RS' | 'BA' | 'ME'
export type NesyMobileEnvironment = 'stage' | 'prod'

export const NESY_MOBILE_COUNTRIES: NesyMobileCountry[] = ['HR', 'SI', 'RS', 'BA', 'ME']
export const NESY_MOBILE_ENVIRONMENTS: NesyMobileEnvironment[] = ['stage', 'prod']

export const NESY_MOBILE_COUNTRY_ENVIRONMENTS = {
  HR: ['stage', 'prod'],
  SI: ['prod'],
  RS: ['stage', 'prod'],
  BA: ['prod'],
  ME: ['prod'],
} as const satisfies Record<NesyMobileCountry, readonly NesyMobileEnvironment[]>

export function getNesyMobileEnvironmentsForCountry(
  country: NesyMobileCountry,
): NesyMobileEnvironment[] {
  return [...NESY_MOBILE_COUNTRY_ENVIRONMENTS[country]]
}

export const NESY_MOBILE_BASE_URLS: Record<
  NesyMobileCountry,
  Record<NesyMobileEnvironment, string>
> = {
  HR: {
    stage: 'https://nesy-staging-mobile-api.overseas.hr/',
    prod: 'https://nesy-mobile-api.overseas.hr/',
  },
  SI: {
    stage: 'https://nesy-staging-mobile-api.overseas.hr/',
    prod: 'https://nesy-mobile-api.expressone.si/',
  },
  RS: {
    stage: 'https://nesy-staging-mobile-api.cityexpress.rs/',
    prod: 'https://nesy-mobile-api.cityexpress.rs/',
  },
  BA: {
    stage: 'https://nesy-staging-mobile-api.cityexpress.rs/',
    prod: 'https://nesy-mobile-api.expressone.ba/',
  },
  ME: {
    stage: 'https://nesy-staging-mobile-api.cityexpress.rs/',
    prod: 'https://nesy-mobile-api.expressone.me/',
  },
}

export const NESY_MOBILE_APPLICATION_IDS: Record<
  NesyMobileCountry,
  Record<NesyMobileEnvironment, string>
> = {
  HR: {
    stage:
      process.env.NEXT_PUBLIC_NESY_MOBILE_HR_STAGE_APPLICATION_ID ??
      'com.arasdigital.nesymobile.test',
    prod:
      process.env.NEXT_PUBLIC_NESY_MOBILE_HR_PROD_APPLICATION_ID ??
      'com.arasdigital.nesymobileprod',
  },
  SI: {
    stage:
      process.env.NEXT_PUBLIC_NESY_MOBILE_SI_STAGE_APPLICATION_ID ??
      'com.arasdigital.nesymobile.sitest',
    prod:
      process.env.NEXT_PUBLIC_NESY_MOBILE_SI_PROD_APPLICATION_ID ??
      'com.arasdigital.nesymobileprod.si',
  },
  RS: {
    stage:
      process.env.NEXT_PUBLIC_NESY_MOBILE_RS_STAGE_APPLICATION_ID ??
      'com.arasdigital.nesymobile.rstest',
    prod:
      process.env.NEXT_PUBLIC_NESY_MOBILE_RS_PROD_APPLICATION_ID ??
      'com.arasdigital.nesymobileprod.rs',
  },
  BA: {
    stage:
      process.env.NEXT_PUBLIC_NESY_MOBILE_BA_STAGE_APPLICATION_ID ??
      'com.arasdigital.nesymobile.batest',
    prod:
      process.env.NEXT_PUBLIC_NESY_MOBILE_BA_PROD_APPLICATION_ID ??
      'com.arasdigital.nesymobileprod.ba',
  },
  ME: {
    stage:
      process.env.NEXT_PUBLIC_NESY_MOBILE_ME_STAGE_APPLICATION_ID ??
      'com.arasdigital.nesymobile.metest',
    prod:
      process.env.NEXT_PUBLIC_NESY_MOBILE_ME_PROD_APPLICATION_ID ??
      'com.arasdigital.nesymobileprod.me',
  },
}

export function resolveNesyMobileBaseUrl(
  country: NesyMobileCountry,
  environment: NesyMobileEnvironment,
) {
  return NESY_MOBILE_BASE_URLS[country][environment].replace(/\/$/, '')
}

export function resolveNesyMobileApplicationId(
  country: NesyMobileCountry,
  environment: NesyMobileEnvironment,
) {
  return NESY_MOBILE_APPLICATION_IDS[country][environment]
}

export function resolveNesyMobileHost(
  country: NesyMobileCountry,
  environment: NesyMobileEnvironment,
) {
  return new URL(resolveNesyMobileBaseUrl(country, environment)).host
}
