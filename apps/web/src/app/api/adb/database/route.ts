// GET /api/adb/database?serial=XXX — read-only Room DB snapshot over adb run-as.

import { NextResponse, type NextRequest } from 'next/server'
import { getDeviceDatabaseSnapshot, resolveAdbPath } from '@/lib/server/adb'

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

  const table = req.nextUrl.searchParams.get('table')
  if (table && (table.length > 128 || [...table].some((character) => character.charCodeAt(0) < 32))) {
    return NextResponse.json({ error: 'Invalid table parameter' }, { status: 400 })
  }
  const requestedLimit = Number(req.nextUrl.searchParams.get('limit') ?? 100)
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 200) : 100

  try {
    const snapshot = await getDeviceDatabaseSnapshot(serial, table, limit)
    return NextResponse.json(snapshot, {
      headers: { 'Cache-Control': 'no-store, max-age=0' },
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Could not get database snapshot' },
      { status: 500 },
    )
  }
}
