// GET /api/adb/screen?serial=XXX — live screen state of the selected device.
// Parses `dumpsys activity top` for the currently on-screen fragment, its
// lifecycle, any overlaid dialog, visible controls and running services.

import { NextResponse, type NextRequest } from 'next/server'
import { getDeviceScreenState, resolveAdbPath } from '@/lib/server/adb'

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
    const snapshot = await getDeviceScreenState(serial)
    return NextResponse.json(snapshot, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not read screen state' },
      { status: 500 },
    )
  }
}
