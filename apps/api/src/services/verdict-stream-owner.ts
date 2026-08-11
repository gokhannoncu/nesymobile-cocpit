import { prisma } from '@nesy/db'

export interface VerdictStreamOwner {
  runId: string
  deviceId: string
  appId: string
}

/**
 * Pins a run to the device/application that receives its secret.
 *
 * A repeated identical claim is idempotent. A conflicting claim fails closed: rotating a
 * secret must never transfer ownership of already-ingested evidence to another device.
 */
export async function claimVerdictStreamOwner(owner: VerdictStreamOwner): Promise<boolean> {
  if (!owner.runId || !owner.deviceId || !owner.appId) return false
  await prisma.$executeRaw`
    INSERT INTO verdict_stream_owner (run_id, device_id, app_id)
    VALUES (${owner.runId}, ${owner.deviceId}, ${owner.appId})
    ON CONFLICT (run_id) DO NOTHING
  `
  const rows = await prisma.$queryRaw<{ device_id: string; app_id: string }[]>`
    SELECT device_id, app_id
    FROM verdict_stream_owner
    WHERE run_id = ${owner.runId}
    LIMIT 1
  `
  const stored = rows[0]
  return stored?.device_id === owner.deviceId && stored.app_id === owner.appId
}

/** True only when the target run is durably pinned to this authenticated peer. */
export async function verdictStreamOwnedBy(
  runId: string,
  owner: Pick<VerdictStreamOwner, 'deviceId' | 'appId'>,
): Promise<boolean> {
  if (!runId || !owner.deviceId || !owner.appId) return false
  const rows = await prisma.$queryRaw<{ device_id: string; app_id: string }[]>`
    SELECT device_id, app_id
    FROM verdict_stream_owner
    WHERE run_id = ${runId}
    LIMIT 1
  `
  const stored = rows[0]
  if (stored !== undefined) {
    return stored.device_id === owner.deviceId && stored.app_id === owner.appId
  }

  // Migration bridge for runs created before verdict_stream_owner existed. Both run
  // lifecycles durably recorded the target device, but not the application id. The current
  // HMAC secret was issued to a concrete device+app pair; matching the durable device lets
  // that authenticated app pin the legacy row exactly once. A different app cannot take it
  // over after the insert.
  const legacy = await prisma.$queryRaw<{ device_id: string | null }[]>`
    SELECT device_id
    FROM verdict_run_start
    WHERE run_id = ${runId}
    UNION ALL
    SELECT "deviceId" AS device_id
    FROM workflow_runs
    WHERE id = ${runId}
    LIMIT 1
  `
  if (legacy[0]?.device_id !== owner.deviceId) return false
  return claimVerdictStreamOwner({ runId, deviceId: owner.deviceId, appId: owner.appId })
}
