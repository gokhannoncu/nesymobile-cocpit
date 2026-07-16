import { API_BASE } from '@/services/api'

export type NesyCountry = 'HR' | 'SI' | 'RS' | 'BA' | 'ME' | 'SK' | 'AZ'
export type NesyEnvironment = 'stage' | 'prod'

/** Dashboard (BFF) login: ülke x stage+prod; SK henüz yok. */
export const NESY_DASHBOARD_COUNTRY_ENVIRONMENTS = {
  HR: ['stage', 'prod'],
  RS: ['stage', 'prod'],
  SI: ['stage', 'prod'],
  BA: ['stage', 'prod'],
  ME: ['stage', 'prod'],
  AZ: ['stage'],
} as const satisfies Record<Exclude<NesyCountry, 'SK'>, NesyEnvironment[]>

export type NesyDashboardToolbarCountry = keyof typeof NESY_DASHBOARD_COUNTRY_ENVIRONMENTS

export const NESY_DASHBOARD_TOOLBAR_COUNTRIES: NesyDashboardToolbarCountry[] = [
  'HR',
  'SI',
  'RS',
  'BA',
  'ME',
  'AZ',
]

export interface NesyLoginResult {
  resultCode: number
  resultMessage: string
  payload?: {
    token?: string
    user?: {
      username?: string
      fullName?: string
      role?: string
      channelType?: string
      hubName?: string
      branchId?: string
      userId?: string
      UserId?: string
      email?: string
      Email?: string
    }
  }
}

export interface NesyAuthResponse {
  message: string
  country: NesyCountry
  environment: NesyEnvironment
  result: NesyLoginResult
}

export async function loginNesyDashboard(
  country: NesyCountry,
  environment: NesyEnvironment,
): Promise<NesyAuthResponse> {
  const response = await fetch(`${API_BASE}/nesy/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ country, environment }),
    signal: AbortSignal.timeout(30_000),
  })

  const json = await response.json()
  if (!response.ok) {
    throw new Error(json?.message ?? 'Nesy login request failed.')
  }

  return json as NesyAuthResponse
}
