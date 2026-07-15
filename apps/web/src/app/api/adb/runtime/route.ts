// GET /api/adb/runtime?serial=XXX — live runtime snapshot from selected device.

import { NextResponse, type NextRequest } from 'next/server'
import { getDeviceRuntime, resolveAdbPath } from '@/lib/server/adb'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const serial = req.nextUrl.searchParams.get('serial')
  if (!serial || !/^[\w.:-]+$/.test(serial)) {
    return NextResponse.json({ error: 'Valid serial parameter is required' }, { status: 400 })
  }
  if (!resolveAdbPath()) {
    return NextResponse.json({ error: 'adb binary not found' }, { status: 503 })
  }
  try {
    const snapshot = await getDeviceRuntime(serial)
    return NextResponse.json(snapshot)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not get runtime snapshot' },
      { status: 500 },
    )
  }
}
