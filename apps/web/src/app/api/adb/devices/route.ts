// GET /api/adb/devices — lists connected devices via local adb.

import { NextResponse } from 'next/server'
import { listConnectedDevices, resolveAdbPath } from '@/lib/server/adb'
import { getAdbResolutionHint } from '@/lib/server/adb-path'
import type { AdbDevicesResponse } from '@/data/debug-view/live-types'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const adbPath = resolveAdbPath()
  if (!adbPath) {
    return NextResponse.json<AdbDevicesResponse>({
      adbAvailable: false,
      adbPath: null,
      error: `adb binary not found. ${getAdbResolutionHint()}.`,
      devices: [],
    })
  }
  try {
    const devices = await listConnectedDevices()
    return NextResponse.json<AdbDevicesResponse>({
      adbAvailable: true,
      adbPath,
      error: null,
      devices,
    })
  } catch (err) {
    return NextResponse.json<AdbDevicesResponse>(
      {
        adbAvailable: true,
        adbPath,
        error: err instanceof Error ? err.message : 'Could not execute adb devices',
        devices: [],
      },
      { status: 500 },
    )
  }
}
