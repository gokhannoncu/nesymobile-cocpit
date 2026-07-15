// GET /api/adb/schedule?serial=XXX — parsed Schedule tree over adb run-as.

import { NextResponse, type NextRequest } from 'next/server'
import { getDeviceScheduleSnapshot, resolveAdbPath } from '@/lib/server/adb'

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
    const snapshot = await getDeviceScheduleSnapshot(serial)
    return NextResponse.json(snapshot, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not get schedule snapshot' },
      { status: 500 },
    )
  }
}
