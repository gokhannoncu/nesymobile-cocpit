#!/usr/bin/env node
/**
 * Uninjected complete-delivery remote-commit close.
 *
 * Not BD.6. No OFFLINE_QUEUE. Investigation lineage only.
 * Starts the remote-commit probe at APP.DELIVERY_SUBMITTED, not at run start.
 */
import { spawn, spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { assertPreservedPid, runWorkflow } from './g90-10-host-b-fixture.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const API = process.env.VERDICT_API ?? 'http://127.0.0.1:4001/api'
const WEB = process.env.VERDICT_WEB ?? 'http://127.0.0.1:4002'
const DEVICE = process.env.VERDICT_DEVICE ?? 'R6CW400BC8N'
const APP_ID = process.env.VERDICT_APP_ID ?? 'com.arasdigital.nesymobile.rstest'
const WORKFLOW = 'nesy.workflow.complete-delivery'
const PROFILE = 'nesy.launch.reuse-session'
const TIMEOUT_SEC = Number(process.env.VERDICT_TIMEOUT ?? 480)
const TARGET_WAYBILL = process.env.VERDICT_PROBE_WAYBILL ?? '53940270186302'
const TARGET_BARCODE = process.env.VERDICT_PROBE_BARCODE ?? '6880051000293817'
const CLOSED_PIDS = new Set([
  '55798',
  '21508',
  '29171',
  '38870',
  '64978',
  '95043',
  '25062',
  '84598',
  '91738',
  '19017',
  '20130',
  '32122',
  '52134',
])

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

function sh(cmd, args) {
  return String(spawnSync(cmd, args, { cwd: REPO, encoding: 'utf8' }).stdout ?? '').trim()
}

async function fetchJson(url) {
  const res = await fetch(url)
  return res.ok ? await res.json() : {}
}

async function readScreen() {
  const body = await fetchJson(`${WEB}/api/adb/screen?serial=${encodeURIComponent(DEVICE)}`)
  return {
    fragment: body.current?.className ?? body.current?.name ?? null,
    overlay: body.overlay?.className ?? body.overlay?.name ?? null,
  }
}

async function readSchedule() {
  const body = await fetchJson(`${WEB}/api/adb/schedule?serial=${encodeURIComponent(DEVICE)}`)
  const schedule = body.schedule ?? {}
  const parcels = []
  for (const stop of schedule.stops ?? []) {
    for (const task of stop.taskList ?? []) {
      for (const shipment of task.shipmentList ?? []) {
        for (const item of shipment.shipmentItemList ?? []) {
          parcels.push({
            stopId: stop.stopId,
            taskId: task.taskId,
            taskParty: task.taskParty,
            shipmentId: shipment.waybillNumber ?? shipment.trackingNumber,
            shipmentStatus: shipment.shipmentStatus,
            scanPayload: item.legacySystemShortBarcode,
            fullBarcode: item.barcode,
            itemStatus: item.shipmentItemStatus,
          })
        }
      }
    }
  }
  return { scheduleId: schedule.scheduleId ?? null, status: schedule.status ?? null, parcels }
}

async function searchShipment(waybill) {
  const cached = await req('GET', '/nesy/auth/cached-token?country=RS&environment=stage')
  const token = cached.body.token
  if (cached.status === 409 || cached.body.code === 'ADMIN_AUTH_NOT_READY' || !token) {
    throw new Error('ADMIN_AUTH_NOT_READY')
  }
  const details = await req('POST', '/shipments/details', {
    token,
    country: 'RS',
    environment: 'stage',
    shipmentId: waybill,
  })
  const payload =
    details.body.data ??
    details.body.result?.payload ??
    details.body.data?.payload ??
    details.body.payload
  const row = Array.isArray(payload) ? payload[0] : payload
  return {
    http: details.status,
    shipmentStatus: row?.shipmentStatus ?? row?.ShipmentStatus ?? null,
    shipmentStatusName: row?.shipmentStatusName ?? row?.ShipmentStatusName ?? null,
    waybillNumber: row?.waybillNumber ?? row?.WaybillNumber ?? row?.shipmentId ?? null,
    loaded:
      row?.shipmentStatus === 0 ||
      String(row?.shipmentStatus ?? row?.ShipmentStatus ?? '').toLowerCase() === 'loaded',
  }
}

function factsOf(detail) {
  return (detail.facts ?? detail.evidenceFacts ?? detail.run?.facts ?? []).map((fact) => ({
    factKey: fact.factKey ?? fact.fact_key,
    value: fact.value,
    observedAtMs: fact.observedAtMs ?? fact.observed_at_ms ?? null,
  }))
}

function firstFact(facts, key, value) {
  return facts.find((fact) => fact.factKey === key && (value === undefined || fact.value === value))
}

async function pinPack() {
  const packs = await req('GET', '/verdict/runtime/domain-packs')
  const published = (packs.body.items ?? []).filter(
    (item) => item.publicationState === 'PUBLISHED' && /^sha256:[a-f0-9]{64}$/i.test(String(item.bundleDigest ?? '')),
  )
  const preferred = published.filter((item) => item.packKey === 'nesy.courier')
  const pool = preferred.length > 0 ? preferred : published
  let pack = null
  for (const candidate of pool) {
    if (
      pack === null ||
      String(candidate.version).localeCompare(String(pack.version), undefined, { numeric: true }) > 0
    ) {
      pack = candidate
    }
  }
  if (!pack) throw new Error('no pinable published pack')
  return pack
}

async function compileWorkflow(pack) {
  const wf = await req('GET', `/workflows/${encodeURIComponent(WORKFLOW)}`)
  const currentVersion = wf.body?.data?.currentVersion ?? {}
  const compiled = await req('POST', '/verdict/runtime/compile', {
    workflowRef: WORKFLOW,
    workflowIr: { nodes: currentVersion.nodes ?? [], connections: currentVersion.connections ?? [] },
    domainPackKey: pack.packKey,
    domainPackVersion: pack.version,
    domainPackDigest: pack.bundleDigest,
  })
  if (!compiled.body.ok) throw new Error(`compile failed ${JSON.stringify(compiled.body.issues ?? compiled.body)}`)
  return compiled.body
}

function startProbe(runId, waybill, barcode) {
  const child = spawn(
    process.execPath,
    [
      join(REPO, 'scripts/g90-10-remote-commit-probe.mjs'),
      '--waybill',
      waybill,
      '--barcode',
      barcode,
      '--run-id',
      runId,
    ],
    { cwd: REPO, stdio: ['ignore', 'pipe', 'pipe'] },
  )
  let stdout = ''
  child.stdout.on('data', (chunk) => {
    stdout += chunk
    process.stdout.write(chunk)
  })
  child.stderr.on('data', (chunk) => process.stderr.write(chunk))
  return {
    child,
    done: new Promise((resolve) => child.on('close', (code) => resolve({ code, stdout }))),
  }
}

const identity = assertPreservedPid()
if (CLOSED_PIDS.has(String(identity.apiPid))) {
  console.error(`PID ${identity.apiPid} is a closed lineage`)
  process.exit(2)
}
console.log('identity', JSON.stringify({ ...identity, head: sh('git', ['rev-parse', '--short', 'HEAD']) }, null, 2))

let remote = { loaded: null, error: null }
try {
  remote = await searchShipment(TARGET_WAYBILL)
} catch (error) {
  remote = { loaded: null, error: error instanceof Error ? error.message : String(error) }
}
console.log('leftover remote', JSON.stringify(remote, null, 2))
if (remote.loaded === false) {
  console.error(`leftover ${TARGET_WAYBILL} is not Loaded — refusing to invent a different fixture mid-gate`)
  process.exit(5)
}

const schedule = await readSchedule()
const parcel = schedule.parcels.find(
  (row) => row.shipmentId === TARGET_WAYBILL && row.scanPayload === TARGET_BARCODE && row.shipmentStatus === 0,
)
console.log(
  JSON.stringify(
    {
      scheduleId: schedule.scheduleId,
      status: schedule.status,
      parcel,
      singletonHint: schedule.parcels.filter((row) => row.shipmentStatus === 0).map((row) => row.shipmentId),
    },
    null,
    2,
  ),
)
if (!parcel) {
  console.error('leftover is Loaded remotely but not a usable Loaded singleton on the device tour')
  process.exit(5)
}

let screen = await readScreen()
if (screen.fragment !== 'DeliveryFragment') {
  if (screen.fragment === 'StopListFragment') {
    console.log('=== open-stop fixture (not the measurement) ===')
    const opened = await runWorkflow('nesy.workflow.open-stop', PROFILE, {
      searchTerm: parcel.shipmentId,
      rowKey: parcel.scanPayload,
      sessionCorrelationId: `g90-10-uninjected-open-${Date.now()}`,
    })
    console.log(JSON.stringify(opened, null, 2))
    screen = await readScreen()
  }
  if (screen.fragment !== 'DeliveryFragment') {
    console.log('=== process-parcel fixture to open delivery (not the measurement) ===')
    const opened = await runWorkflow('nesy.workflow.process-parcel', PROFILE, {
      scanPayload: parcel.scanPayload,
      taskCode: parcel.taskId,
      sessionCorrelationId: `g90-10-uninjected-open-delivery-${Date.now()}`,
    })
    console.log(JSON.stringify(opened, null, 2))
    screen = await readScreen()
  }
}
if (screen.fragment !== 'DeliveryFragment') {
  console.error(`need DeliveryFragment before complete-delivery, got ${screen.fragment}`)
  process.exit(5)
}

const pack = await pinPack()
const compiled = await compileWorkflow(pack)
const started = await req('POST', '/verdict/runtime/runs', {
  workflowRef: WORKFLOW,
  deviceId: DEVICE,
  appId: APP_ID,
  compiledPlanRef: compiled.compiledPlanRef,
  compiledPlanHash: compiled.compiledPlanHash,
  domainPackKey: pack.packKey,
  domainPackVersion: pack.version,
  domainPackDigest: pack.bundleDigest,
  profileKey: PROFILE,
  inputs: {
    consignmentNumber: parcel.scanPayload,
    proofLookupId: parcel.shipmentId,
    sessionCorrelationId: `g90-10-uninjected-${Date.now()}`,
  },
})
const runId = started.body.run?.runId ?? started.body.runId
if (!runId) {
  console.error('no runId', JSON.stringify(started.body).slice(0, 800))
  process.exit(1)
}
console.log('started', runId)

const deadline = Date.now() + TIMEOUT_SEC * 1000
const terminal = new Set(['completed', 'failed', 'cancelled', 'error', 'blocked'])
let detail = {}
let probe = null
while (Date.now() < deadline) {
  const polled = await req('GET', `/verdict/runtime/runs/${encodeURIComponent(runId)}`)
  detail = polled.body
  const facts = factsOf(detail)
  const submitted = firstFact(facts, 'APP.DELIVERY_SUBMITTED', true)
  const steps = detail.steps ?? []
  const confirm = steps.find((step) => (step.plan_step_id ?? step.planStepId) === 'tap-delivery-confirm')
  if (
    probe === null &&
    (submitted ||
      confirm?.action_result === 'SUCCEEDED' ||
      confirm?.actionResult === 'SUCCEEDED' ||
      confirm?.continue_gate_result === 'SATISFIED' ||
      confirm?.continueGateResult === 'SATISFIED')
  ) {
    console.log('confirm observed — starting remote-commit probe')
    probe = startProbe(runId, TARGET_WAYBILL, TARGET_BARCODE)
  }
  if (terminal.has(String(detail.run?.status))) break
  await new Promise((resolve) => setTimeout(resolve, 2000))
}

const probeResult = probe ? await probe.done : { code: null, stdout: '' }
const facts = factsOf(detail)
const submitted = firstFact(facts, 'APP.DELIVERY_SUBMITTED', true)
const remoteDone = firstFact(facts, 'REMOTE.DELIVERY_STATUS_COMPLETED', true)
const remoteCommitLatencyMs =
  submitted?.observedAtMs != null && remoteDone?.observedAtMs != null
    ? remoteDone.observedAtMs - submitted.observedAtMs
    : null

const summary = {
  notBd6Proof: true,
  runId,
  waybill: TARGET_WAYBILL,
  barcode: TARGET_BARCODE,
  pack: { key: pack.packKey, version: pack.version, digest: pack.bundleDigest },
  apiPid: identity.apiPid,
  status: detail.run?.status ?? null,
  productVerdict: detail.run?.productVerdict ?? detail.run?.product_verdict ?? null,
  observedClass: detail.runtime?.observedClass ?? detail.run?.observedClass ?? null,
  injectedFault: detail.runtime?.injectedFault ?? detail.run?.injectedFault ?? null,
  remoteCommitLatencyMs,
  APP_DELIVERY_SUBMITTED: submitted ?? null,
  REMOTE_DELIVERY_STATUS_COMPLETED: remoteDone ?? firstFact(facts, 'REMOTE.DELIVERY_STATUS_COMPLETED'),
  probeExit: probeResult.code,
}

console.log(JSON.stringify(summary, null, 2))
if (summary.productVerdict !== 'PASS_ONLINE' || summary.observedClass != null) process.exit(6)
