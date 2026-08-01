// GET /api/versions/latest?environment=test|prod|all
// Proxies country × environment GetLatestVersion calls (AppName + mobile base URL).

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

type InstallEnvironment = 'test' | 'prod'

type VersionRow = {
  country: NesyMobileCountry
  environment: InstallEnvironment
  versionNumber: number | null
  appName: string
  error: string | null
}

const INSTALL_ENVIRONMENTS: InstallEnvironment[] = ['test', 'prod']

async function fetchCountryVersion(
  country: NesyMobileCountry,
  environment: InstallEnvironment,
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
        environment,
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
      environment,
      versionNumber,
      appName,
      error: versionNumber == null ? 'versionNumber yok' : null,
    }
  } catch (err) {
    return {
      country,
      environment,
      versionNumber: null,
      appName,
      error: err instanceof Error ? err.message : 'İstek başarısız',
    }
  }
}

function byCountryMap(rows: VersionRow[]): Record<string, number | null> {
  return Object.fromEntries(
    rows.map((row) => [row.country.toLowerCase(), row.versionNumber]),
  ) as Record<string, number | null>
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const environmentRaw = (searchParams.get('environment') ?? 'all').toLowerCase()
  if (
    environmentRaw !== 'test' &&
    environmentRaw !== 'prod' &&
    environmentRaw !== 'all'
  ) {
    return NextResponse.json(
      { error: 'environment test, prod veya all olmalıdır' },
      { status: 400 },
    )
  }

  const environments: InstallEnvironment[] =
    environmentRaw === 'all' ? INSTALL_ENVIRONMENTS : [environmentRaw]

  const rows = await Promise.all(
    environments.flatMap((environment) =>
      NESY_MOBILE_COUNTRIES.map((country) => fetchCountryVersion(country, environment)),
    ),
  )

  const byEnvironment = Object.fromEntries(
    environments.map((environment) => [
      environment,
      byCountryMap(rows.filter((row) => row.environment === environment)),
    ]),
  ) as Record<InstallEnvironment, Record<string, number | null>>

  // Backward-compatible single-environment shape
  if (environmentRaw !== 'all') {
    return NextResponse.json({
      environment: environmentRaw,
      fetchedAt: new Date().toISOString(),
      byCountry: byEnvironment[environmentRaw],
      byEnvironment,
      rows,
    })
  }

  return NextResponse.json({
    environment: 'all',
    fetchedAt: new Date().toISOString(),
    byCountry: byEnvironment.test,
    byEnvironment,
    rows,
  })
}
