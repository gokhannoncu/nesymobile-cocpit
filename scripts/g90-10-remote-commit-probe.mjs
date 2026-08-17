#!/usr/bin/env node
/**
 * Uninjected complete-delivery remote-commit probe.
 *
 * Uses the SAME PID dashboard-admin cache. Does not call LoginDashboard.
 * Cache miss → FAIL_FAST ADMIN_AUTH_NOT_READY (auth fixture, not EVENTUAL).
 *
 * Problem A only: did Task/DeliverParcels land, and when do SearchShipment
 * and GetShipmentDeliveryProof catch up? Not a BD.6 injector run.
 *
 *   node scripts/g90-10-remote-commit-probe.mjs \
 *     --waybill 53940270186302 \
 *     --barcode 6880051000293817 \
 *     --run-id run_xxx
 *
 * Writes docs/verdict/goals/G90-10-remote-commit-<runOrWaybill>.json
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const API = process.env.VERDICT_API ?? 'http://127.0.0.1:4001/api'
const DEVICE = process.env.VERDICT_DEVICE ?? 'R6CW400BC8N'
const APP_ID = process.env.VERDICT_APP_ID ?? 'com.arasdigital.nesymobile.rstest'
const OFFSETS_MS = (process.env.VERDICT_PROBE_OFFSETS ?? '0,2000,5000,10000,30000,120000,130000')
  .split(',')
  .map((value) => Number(value.trim()))
  .filter((value) => Number.isFinite(value) && value >= 0)

function arg(name, fallback = '') {
  const index = process.argv.indexOf(name)
  if (index === -1) return process.env[fallback] ?? ''
  return process.argv[index + 1] ?? ''
}

function sh(cmd, args) {
  return String(spawnSync(cmd, args, { cwd: REPO, encoding: 'utf8' }).stdout ?? '').trim()
}

function adb(args, timeoutMs = 20_000) {
  const adbBin =
    process.env.ADB_PATH ||
    sh('which', ['adb']) ||
    `${process.env.HOME}/Library/Android/sdk/platform-tools/adb`
  return spawnSync(adbBin, ['-s', DEVICE, ...args], { encoding: 'utf8', timeout: timeoutMs })
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function cockpit(method, path, body) {
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

function proofSummary(json) {
  const payload = json?.payload ?? json?.Payload ?? []
  const rows = Array.isArray(payload) ? payload : []
  const first = rows[0] ?? null
  return {
    resultCode: json?.resultCode ?? json?.ResultCode ?? null,
    count: rows.length,
    eventType: first?.eventType ?? first?.EventType ?? null,
    shipmentStatus: first?.shipmentStatus ?? first?.ShipmentStatus ?? null,
    eventDate: first?.eventDate ?? first?.EventDate ?? null,
    waybillNumber: first?.waybillNumber ?? first?.WaybillNumber ?? null,
  }
}

function searchSummary(details) {
  const row =
    details?.result?.payload ??
    details?.data?.payload ??
    details?.payload ??
    details
  const item = Array.isArray(row) ? row[0] : row
  if (!item || typeof item !== 'object') {
    return { found: false }
  }
  return {
    found: true,
    shipmentStatus: item.shipmentStatus ?? item.ShipmentStatus ?? null,
    shipmentStatusName: item.shipmentStatusName ?? item.ShipmentStatusName ?? null,
    lastEventType: item.lastEventType ?? item.LastEventType ?? item.eventType ?? null,
    actualDeliveryDate: item.actualDeliveryDate ?? item.ActualDeliveryDate ?? null,
    waybillNumber: item.waybillNumber ?? item.WaybillNumber ?? item.shipmentId ?? null,
  }
}

function dumpCompletedRequests(waybill, barcode) {
  const db = `/data/data/${APP_ID}/databases/nesy-database`
  const sql = `SELECT id, requestName, createdAt, processTime, tryCount, isWaitingRequest, isProcessing, requestTrace, waybillNumbers FROM CompletedRequest WHERE waybillNumbers LIKE '%${waybill}%' OR waybillNumbers LIKE '%${barcode}%' OR requestJson LIKE '%${waybill}%' OR requestJson LIKE '%${barcode}%';`
  const out = adb(['shell', `run-as ${APP_ID} sqlite3 ${db} "${sql.replace(/"/g, '\\"')}"`], 15_000)
  const pending = adb(
    [
      'shell',
      `run-as ${APP_ID} sqlite3 ${db} "SELECT id, requestName, createdAt, processTime, tryCount, isWaitingRequest, isProcessing, requestTrace, waybillNumbers FROM Request WHERE waybillNumbers LIKE '%${waybill}%' OR requestJson LIKE '%${waybill}%';"`,
    ],
    15_000,
  )
  return {
    completedStdout: (out.stdout ?? '').trim(),
    completedStderr: (out.stderr ?? '').trim(),
    pendingStdout: (pending.stdout ?? '').trim(),
    pendingStderr: (pending.stderr ?? '').trim(),
  }
}

const waybill = arg('--waybill', 'VERDICT_PROBE_WAYBILL')
const barcode = arg('--barcode', 'VERDICT_PROBE_BARCODE')
const runId = arg('--run-id', 'VERDICT_PROBE_RUN_ID')
const occurrenceId = arg('--occurrence-id', 'VERDICT_PROBE_OCCURRENCE_ID')
if (!waybill) {
  console.error('usage: node scripts/g90-10-remote-commit-probe.mjs --waybill <id> [--barcode <scan>] [--run-id <id>]')
  process.exit(2)
}

const cached = await cockpit(
  'GET',
  '/nesy/auth/cached-token?country=RS&environment=stage',
)
if (cached.status === 409 || cached.body.code === 'ADMIN_AUTH_NOT_READY' || cached.body.present !== true) {
  console.error('FAIL_FAST: ADMIN_AUTH_NOT_READY')
  console.error(
    JSON.stringify({
      code: 'ADMIN_AUTH_NOT_READY',
      status: cached.status,
      cache: cached.body.cache ?? cached.body,
    }),
  )
  process.exit(1)
}

const t0 = Date.now()
const t0Iso = new Date(t0).toISOString()
const remoteReads = []

for (const offset of OFFSETS_MS) {
  const wait = t0 + offset - Date.now()
  if (wait > 0) await sleep(wait)
  const at = new Date().toISOString()
  const read = await cockpit('POST', '/nesy/auth/admin-shipment-read', {
    country: 'RS',
    environment: 'stage',
    shipmentId: waybill,
  })
  const proof = read.body.proof ?? { http: read.status, ms: 0, result: {} }
  const details = read.body.details ?? { http: read.status, result: {} }
  remoteReads.push({
    label: `t+${offset}ms`,
    offsetMs: offset,
    at,
    proof: { http: proof.http, ms: proof.ms, ...proofSummary(proof.result) },
    search: { http: details.http, ...searchSummary(details.result) },
  })
  console.log(
    JSON.stringify({
      at,
      offsetMs: offset,
      proofCount: remoteReads.at(-1).proof.count,
      proofEvent: remoteReads.at(-1).proof.eventType,
      searchStatus: remoteReads.at(-1).search.shipmentStatusName ?? remoteReads.at(-1).search.shipmentStatus,
    }),
  )
}

const deviceQueue = dumpCompletedRequests(waybill, barcode || waybill)
const artifact = {
  kind: 'uninjected-complete-delivery-remote-commit',
  notBd6Proof: true,
  adminAuth: {
    source: 'dashboard-admin-cache',
    pid: cached.body.pid ?? null,
    tokenFingerprint: cached.body.tokenFingerprint ?? null,
    ageMs: cached.body.ageMs ?? null,
    expiresAt: cached.body.expiresAt ?? null,
    loginDashboardCalls: cached.body.loginDashboardCalls ?? null,
  },
  runId: runId || null,
  occurrenceId: occurrenceId || null,
  barcode: barcode || null,
  waybill,
  shipmentId: waybill,
  probeStartedAt: t0Iso,
  offsetsMs: OFFSETS_MS,
  deliverParcels: {
    endpoint: 'Task/DeliverParcels/',
    note: 'HTTP start/complete come from device Request/CompletedRequest, not this probe. Dump is attached.',
  },
  remoteReads,
  deviceQueue,
}

const outDir = join(REPO, 'docs/verdict/goals')
mkdirSync(outDir, { recursive: true })
const outName = `G90-10-remote-commit-${runId || waybill}.json`
const outPath = join(outDir, outName)
writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`)
console.log(`wrote ${outPath}`)
