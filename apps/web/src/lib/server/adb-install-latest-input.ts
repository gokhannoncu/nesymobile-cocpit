import {
  isNesyMobileCountry,
  type NesyMobileCountry,
} from '../../services/nesy-mobile-env'

export type InstallLatestEnvironment = 'test' | 'prod'

export type InstallLatestErrorCode =
  | 'NO_ADB'
  | 'NO_DEVICE'
  | 'MULTIPLE_DEVICES'
  | 'INVALID_INPUT'
  | 'VERSION_FETCH_FAILED'
  | 'NO_DOWNLOAD_URL'
  | 'DOWNLOAD_FAILED'
  | 'INSTALL_FAILED'

export class InstallLatestError extends Error {
  constructor(
    public readonly code: InstallLatestErrorCode,
    message: string,
  ) {
    super(message)
    this.name = 'InstallLatestError'
  }
}

export function parseInstallLatestInput(body: unknown): {
  country: NesyMobileCountry
  environment: InstallLatestEnvironment
} {
  if (!body || typeof body !== 'object') {
    throw new InstallLatestError('INVALID_INPUT', 'Geçersiz istek gövdesi')
  }
  const record = body as Record<string, unknown>
  const countryRaw = typeof record.country === 'string' ? record.country.toUpperCase() : ''
  const environmentRaw =
    typeof record.environment === 'string' ? record.environment.toLowerCase() : ''

  if (!isNesyMobileCountry(countryRaw)) {
    throw new InstallLatestError(
      'INVALID_INPUT',
      'Ülke HR, SI, RS, BA veya ME olmalıdır',
    )
  }
  if (environmentRaw !== 'test' && environmentRaw !== 'prod') {
    throw new InstallLatestError('INVALID_INPUT', 'Ortam test veya prod olmalıdır')
  }

  return { country: countryRaw, environment: environmentRaw }
}
