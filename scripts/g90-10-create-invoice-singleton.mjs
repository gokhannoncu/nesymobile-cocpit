#!/usr/bin/env node
/**
 * Create one unpaid invoice singleton on the current approved tour.
 * Requires ADMIN_AUTH_READY. The API performs the read with its process-local
 * cache; the bearer token never crosses HTTP. Does not inject OFFLINE_QUEUE.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { AUTH_FREEZE_CODE, loginDashboardDecision, writeAuthFreezeArtifact } from './g90-10-admin-auth-freeze.mjs'
import { assertPreservedPid, createUnloadableShipment, runWorkflow } from './g90-10-host-b-fixture.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const API = process.env.VERDICT_API ?? 'http://127.0.0.1:4001/api'

async function req(method, path, body) {
  const res = await fetch(API + path, {
    method,
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    json = { raw: text.slice(0, 2000) }
  }
  return { status: res.status, body: json }
}

async function searchShipment(waybill) {
  const cached = await req('GET', '/nesy/auth/cached-token?country=RS&environment=stage')
  if (cached.status === 409 || cached.body.present !== true) throw new Error('ADMIN_AUTH_NOT_READY')
  const read = await req('POST', '/nesy/auth/admin-shipment-read', {
    country: 'RS',
    environment: 'stage',
    shipmentId: waybill,
  })
  const details = read.body.details ?? {}
  const payload =
    details.result?.data ??
    details.result?.result?.payload ??
    details.result?.data?.payload ??
    details.result?.payload
  const items = payload?.items ?? payload?.Items
  const row = Array.isArray(payload)
    ? payload[0]
    : Array.isArray(items)
      ? items[0]
      : payload
  return {
    http: details.http ?? read.status,
    shipmentStatus: row?.shipmentStatus ?? row?.ShipmentStatus ?? null,
    shipmentStatusName: row?.shipmentStatusName ?? row?.ShipmentStatusName ?? null,
    waybillNumber: row?.waybillNumber ?? row?.WaybillNumber ?? row?.shipmentId ?? null,
  }
}

const identity = assertPreservedPid()
const cache = await req('GET', '/nesy/auth/admin-cache?country=RS&environment=stage')
if (!cache.body.present) {
  const decision = loginDashboardDecision(cache.body)
  writeAuthFreezeArtifact({
    runtime: { apiPid: identity.apiPid, loginDashboardCalls: cache.body.loginDashboardCalls ?? 0 },
    loginDecision: decision,
  })
  console.error(decision.code === AUTH_FREEZE_CODE ? AUTH_FREEZE_CODE : 'ADMIN_AUTH_NOT_READY')
  process.exit(decision.code === AUTH_FREEZE_CODE ? 3 : 1)
}

const shipment = await createUnloadableShipment()
const loaded = await runWorkflow('nesy.workflow.load-to-vehicle', 'nesy.launch.reuse-session', {
  scanValue: shipment.scanValue,
  alternateKey: shipment.shipmentId,
})
const remote = await searchShipment(shipment.shipmentId)
const artifact = {
  kind: 'g90-10-third-invoice-singleton',
  notBd6Proof: true,
  apiPid: identity.apiPid,
  shipment,
  loadToVehicle: {
    runId: loaded.runId,
    productVerdict: loaded.productVerdict,
    observedClass: loaded.observedClass ?? null,
  },
  remote,
  adminAuth: {
    present: cache.body.present,
    tokenFingerprint: cache.body.tokenFingerprint,
    loginDashboardCalls: cache.body.loginDashboardCalls,
  },
}

const outDir = join(REPO, 'docs/verdict/goals')
mkdirSync(outDir, { recursive: true })
const outPath = join(outDir, `G90-10-fresh-singleton-${shipment.shipmentId}.json`)
writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`)
console.log(JSON.stringify({ outPath, ...artifact }, null, 2))
if (loaded.productVerdict !== 'PASS_ONLINE') process.exit(6)
