// POST /api/versions/download-link — GetLatestVersion SAS downloadUrl for one country × test|prod

import { NextResponse } from 'next/server'
import {
  InstallLatestError,
  fetchLatestVersion,
  parseInstallLatestInput,
} from '@/lib/server/adb-install-latest'
import { resolveInstallEnvironment } from '@/services/nesy-mobile-env'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(request: Request) {
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { ok: false, code: 'INVALID_INPUT', message: 'Geçersiz JSON gövdesi' },
      { status: 400 },
    )
  }

  try {
    const input = parseInstallLatestInput(body)
    const mobileEnvironment = resolveInstallEnvironment(input.environment)
    const version = await fetchLatestVersion(input.country, mobileEnvironment)
    return NextResponse.json({
      ok: true,
      country: input.country,
      environment: input.environment,
      mobileEnvironment,
      appName: version.appName,
      applicationId: version.applicationId,
      versionNumber: version.versionNumber,
      buildNumber: version.buildNumber,
      downloadUrl: version.downloadUrl,
    })
  } catch (err) {
    if (err instanceof InstallLatestError) {
      const status =
        err.code === 'INVALID_INPUT'
          ? 400
          : err.code === 'VERSION_FETCH_FAILED' || err.code === 'NO_DOWNLOAD_URL'
            ? 502
            : 500
      return NextResponse.json(
        { ok: false, code: err.code, message: err.message },
        { status },
      )
    }
    return NextResponse.json(
      {
        ok: false,
        code: 'VERSION_FETCH_FAILED',
        message: err instanceof Error ? err.message : 'Link alınamadı',
      },
      { status: 500 },
    )
  }
}
