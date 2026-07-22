// GET /api/versions/latest?environment=test|prod
// Proxies country GetLatestVersion calls (AppName + mobile base URL).

import { NextResponse } from 'next/server'
import {
  NESY_MOBILE_COUNTRIES,
  resolveInstallEnvironment,
  resolveNesyMobileAppName,
  resolveNesyMobileBaseUrl,
  type NesyMobileCountry,
} from '@/services/nesy-mobile-env'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

type VersionRow = {
  country: NesyMobileCountry
  versionNumber: number | null
  appName: string
  error: string | null
}

async function fetchCountryVersion(
  country: NesyMobileCountry,
  environment: 'test' | 'prod',
): Promise<VersionRow> {
  const mobileEnvironment = resolveInstallEnvironment(environment)
  const appName = resolveNesyMobileAppName(country, mobileEnvironment)
  const baseUrl = resolveNesyMobileBaseUrl(country, mobileEnvironment)
  const url = `${baseUrl}/Version/GetLatestVersion/`

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ AppName: appName }),
      cache: 'no-store',
    })
    if (!response.ok) {
      return {
        country,
        versionNumber: null,
        appName,
        error: `HTTP ${response.status}`,
      }
    }
    const json = (await response.json()) as {
      payload?: { versionNumber?: number } | null
    }
    const versionNumber =
      typeof json.payload?.versionNumber === 'number' ? json.payload.versionNumber : null
    return {
      country,
      versionNumber,
      appName,
      error: versionNumber == null ? 'versionNumber yok' : null,
    }
  } catch (err) {
    return {
      country,
      versionNumber: null,
      appName,
      error: err instanceof Error ? err.message : 'İstek başarısız',
    }
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const environmentRaw = (searchParams.get('environment') ?? 'test').toLowerCase()
  if (environmentRaw !== 'test' && environmentRaw !== 'prod') {
    return NextResponse.json(
      { error: 'environment test veya prod olmalıdır' },
      { status: 400 },
    )
  }

  const rows = await Promise.all(
    NESY_MOBILE_COUNTRIES.map((country) => fetchCountryVersion(country, environmentRaw)),
  )

  const byCountry = Object.fromEntries(
    rows.map((row) => [row.country.toLowerCase(), row.versionNumber]),
  ) as Record<string, number | null>

  return NextResponse.json({
    environment: environmentRaw,
    fetchedAt: new Date().toISOString(),
    byCountry,
    rows,
  })
}
