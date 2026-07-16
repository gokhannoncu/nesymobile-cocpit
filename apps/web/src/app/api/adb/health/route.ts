// GET /api/adb/health?serial=XXX — composed operational-readiness snapshot.
// Reuses the runtime/schedule/database reads plus dedicated probes (running
// services, session/JWT, location, backend reachability, peripherals) and
// derives per-card and overall Ready / Attention / Blocked verdicts.

import { NextResponse, type NextRequest } from 'next/server'
import { getDeviceHealthSnapshot, resolveAdbPath } from '@/lib/server/adb'

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
    const snapshot = await getDeviceHealthSnapshot(serial)
    return NextResponse.json(snapshot, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Could not get health snapshot' },
      { status: 500 },
    )
  }
}
