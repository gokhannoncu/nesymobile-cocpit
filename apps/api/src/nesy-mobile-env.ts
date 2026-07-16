export type NesyMobileCountry = 'HR' | 'SI' | 'RS' | 'BA' | 'ME'
export type NesyMobileEnvironment = 'stage' | 'prod'

export const NESY_MOBILE_COUNTRIES: NesyMobileCountry[] = ['HR', 'SI', 'RS', 'BA', 'ME']
export const NESY_MOBILE_ENVIRONMENTS: NesyMobileEnvironment[] = ['stage', 'prod']

/** Workflow / mobile automation: which environments can be selected for which countries. */
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

export function coerceNesyMobileEnvironment(
  country: NesyMobileCountry,
  environment: NesyMobileEnvironment,
): NesyMobileEnvironment {
  const allowed = getNesyMobileEnvironmentsForCountry(country)
  return allowed.includes(environment) ? environment : (allowed[0] ?? environment)
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
      process.env.NESY_MOBILE_HR_STAGE_APPLICATION_ID ??
      process.env.NEXT_PUBLIC_NESY_MOBILE_HR_STAGE_APPLICATION_ID ??
      'com.arasdigital.nesymobile.test',
    prod:
      process.env.NESY_MOBILE_HR_PROD_APPLICATION_ID ??
      process.env.NEXT_PUBLIC_NESY_MOBILE_HR_PROD_APPLICATION_ID ??
      'com.arasdigital.nesymobileprod',
  },
  SI: {
    stage:
      process.env.NESY_MOBILE_SI_STAGE_APPLICATION_ID ??
      process.env.NEXT_PUBLIC_NESY_MOBILE_SI_STAGE_APPLICATION_ID ??
      'com.arasdigital.nesymobile.sitest',
    prod:
      process.env.NESY_MOBILE_SI_PROD_APPLICATION_ID ??
      process.env.NEXT_PUBLIC_NESY_MOBILE_SI_PROD_APPLICATION_ID ??
      'com.arasdigital.nesymobileprod.si',
  },
  RS: {
    stage:
      process.env.NESY_MOBILE_RS_STAGE_APPLICATION_ID ??
      process.env.NEXT_PUBLIC_NESY_MOBILE_RS_STAGE_APPLICATION_ID ??
      'com.arasdigital.nesymobile.rstest',
    prod:
      process.env.NESY_MOBILE_RS_PROD_APPLICATION_ID ??
      process.env.NEXT_PUBLIC_NESY_MOBILE_RS_PROD_APPLICATION_ID ??
      'com.arasdigital.nesymobileprod.rs',
  },
  BA: {
    stage:
      process.env.NESY_MOBILE_BA_STAGE_APPLICATION_ID ??
      process.env.NEXT_PUBLIC_NESY_MOBILE_BA_STAGE_APPLICATION_ID ??
      'com.arasdigital.nesymobile.batest',
    prod:
      process.env.NESY_MOBILE_BA_PROD_APPLICATION_ID ??
      process.env.NEXT_PUBLIC_NESY_MOBILE_BA_PROD_APPLICATION_ID ??
      'com.arasdigital.nesymobileprod.ba',
  },
  ME: {
    stage:
      process.env.NESY_MOBILE_ME_STAGE_APPLICATION_ID ??
      process.env.NEXT_PUBLIC_NESY_MOBILE_ME_STAGE_APPLICATION_ID ??
      'com.arasdigital.nesymobile.metest',
    prod:
      process.env.NESY_MOBILE_ME_PROD_APPLICATION_ID ??
      process.env.NEXT_PUBLIC_NESY_MOBILE_ME_PROD_APPLICATION_ID ??
      'com.arasdigital.nesymobileprod.me',
  },
}

export function isNesyMobileCountry(value: string): value is NesyMobileCountry {
  return NESY_MOBILE_COUNTRIES.includes(value as NesyMobileCountry)
}

export function isNesyMobileEnvironment(value: string): value is NesyMobileEnvironment {
  return NESY_MOBILE_ENVIRONMENTS.includes(value as NesyMobileEnvironment)
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
