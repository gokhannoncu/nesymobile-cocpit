#!/usr/bin/env node
/**
 * G90.10 Host B live fixture — starting business state only.
 *
 * Sets the BeginningOfDay schedule the tour-approval workflow needs so it can
 * reach `dispatcher-approves`. Does not skip that workflow and does not add a
 * fake-success seam.
 *
 *   create+unload one RS happy-path shipment   (data-center)
 *   nesy.workflow.load-to-vehicle              (product zimmet)
 *   Task/RejectLeavingPermission               (only if AutoApproveOnTour left BeginningOfDay)
 *   dismiss notification list                  (product close control btn_exit)
 *
 * Commands: provision | restore | snapshot
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loginDashboardDecision } from './g90-10-admin-auth-freeze.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const API = process.env.VERDICT_API ?? 'http://127.0.0.1:4001/api'
const WEB = process.env.VERDICT_WEB ?? 'http://127.0.0.1:4002'
const DEVICE = process.env.VERDICT_DEVICE ?? 'R6CW400BC8N'
const APP_ID = process.env.VERDICT_APP_ID ?? 'com.arasdigital.nesymobile.rstest'
const ROUTE = process.env.VERDICT_ROUTE_CODE ?? '31'
const CLOSED_API_PIDS = new Set(['55798', '21508', '16953', '8433', '13440', '52684', '10060', '63409', '7371'])
const PRESERVED_API_PID = process.env.VERDICT_PRESERVED_API_PID ?? ''
const TIMEOUT_SEC = Number(process.env.VERDICT_TIMEOUT ?? 240)

export { PRESERVED_API_PID, CLOSED_API_PIDS }

function sh(cmd, args, opts = {}) {
  return String(spawnSync(cmd, args, { cwd: REPO, encoding: 'utf8', ...opts }).stdout ?? '').trim()
}

function listenPids(port) {
  return sh('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'])
    .split(/\s+/)
    .filter(Boolean)
}

function commandOf(pid) {
  return sh('ps', ['-p', String(pid), '-o', 'command=']).replace(/\s+/g, ' ')
}

function adbPath() {
  if (process.env.ADB_PATH) return process.env.ADB_PATH
  const which = sh('which', ['adb'])
  if (which) return which
  return `${process.env.HOME}/Library/Android/sdk/platform-tools/adb`
}

function adb(args, timeoutMs = 20_000) {
  return spawnSync(adbPath(), ['-s', DEVICE, ...args], { encoding: 'utf8', timeout: timeoutMs })
}

export function assertPreservedPid() {
  const apiPid = listenPids(4001)[0] ?? null
  const apiCommand = apiPid ? commandOf(apiPid) : null
  if (!apiPid) {
    throw new Error('refusing to proceed: :4001 is not listening')
  }
  if (CLOSED_API_PIDS.has(apiPid)) {
    throw new Error(
      `refusing to proceed: PID ${apiPid} is a closed lineage (G90.9=55798, BD.3 LIVE_INJECTION=21508)`,
    )
  }
  if (PRESERVED_API_PID && apiPid !== PRESERVED_API_PID) {
    throw new Error(
      `refusing to proceed: :4001 PID is ${apiPid}, pinned lineage is ${PRESERVED_API_PID}.`,
    )
  }
  if (!apiCommand || !/dist\/server\.js/.test(apiCommand)) {
    throw new Error(`refusing to proceed: PID ${apiPid} is not node dist/server.js (${apiCommand})`)
  }
  return { apiPid, apiCommand, apiStartedAt: sh('ps', ['-p', apiPid, '-o', 'lstart=']).trim() }
}

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

function loadApiEnv() {
  const env = {}
  try {
    const raw = readFileSync(join(REPO, 'apps/api/.env'), 'utf8').replace(/^\uFEFF/, '')
    for (const line of raw.split('\n')) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
      if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '')
    }
  } catch {
    // caller reports missing keys
  }
  return env
}

function dumpUiXml() {
  adb(['shell', 'uiautomator', 'dump', '/sdcard/uidump.xml'])
  return adb(['shell', 'cat', '/sdcard/uidump.xml']).stdout ?? ''
}

function nodeAttr(xml, resourceId) {
  const escaped = resourceId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = xml.match(new RegExp(`<node[^>]*resource-id="[^"]*${escaped}"[^>]*>`))
  return match ? match[0] : null
}

function boundsCenter(nodeXml) {
  const match = /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(nodeXml ?? '')
  if (!match) return null
  return {
    x: Math.round((Number(match[1]) + Number(match[3])) / 2),
    y: Math.round((Number(match[2]) + Number(match[4])) / 2),
  }
}

function readUi(xml = dumpUiXml()) {
  const requestTour = /text="Request Tour Start"/.test(xml)
  const waitingApproval = /text="Waiting Approval"/.test(xml)
  const endOfTour = /text="End Of Tour"/.test(xml)
  return {
    btnOutPresent: /resource-id="[^"]*btn_out"/.test(xml),
    btnOutLabel: requestTour
      ? 'Request Tour Start'
      : waitingApproval
        ? 'Waiting Approval'
        : endOfTour
          ? 'End Of Tour'
          : null,
    autoRoutePresent: /resource-id="[^"]*auto_route"/.test(xml),
    manualRoutePresent: /resource-id="[^"]*manual_route"/.test(xml),
    notificationExitPresent: /resource-id="[^"]*btn_exit"/.test(xml),
    requestTour,
  }
}

async function readScreen() {
  const res = await fetch(`${WEB}/api/adb/screen?serial=${encodeURIComponent(DEVICE)}`)
  const body = res.ok ? await res.json() : {}
  return {
    fragment: body.current?.className ?? body.current?.name ?? null,
    overlay: body.overlay?.className ?? body.overlay?.name ?? null,
    appForeground: body.appForeground === true,
  }
}

async function readSchedule() {
  const res = await fetch(`${WEB}/api/adb/schedule?serial=${encodeURIComponent(DEVICE)}`)
  const body = res.ok ? await res.json() : {}
  const schedule = body.schedule ?? {}
  const stops = Array.isArray(schedule.stops) ? schedule.stops : []
  return {
    scheduleId: typeof schedule.scheduleId === 'string' ? schedule.scheduleId : null,
    status: schedule.status ?? null,
    stopCount: stops.length,
    stopChunkCount: body.stopChunkCount ?? null,
    courierName: schedule.courierName ?? null,
    courierId: schedule.courierId ?? null,
    branchCode: schedule.branchCode ?? null,
  }
}

export async function snapshotFixture() {
  const schedule = await readSchedule()
  const screen = await readScreen()
  const ui = readUi()
  const beginningOfDay = schedule.status === 0
  const hasWork = schedule.stopCount >= 1
  const onStopList = screen.fragment === 'StopListFragment' && screen.overlay == null
  const requestReady = ui.btnOutPresent && ui.btnOutLabel === 'Request Tour Start'
  const ready = Boolean(
    schedule.scheduleId && beginningOfDay && hasWork && onStopList && requestReady && !ui.autoRoutePresent,
  )
  return {
    ready,
    schedule,
    screen,
    ui,
    gates: {
      schedulePresent: Boolean(schedule.scheduleId),
      beginningOfDay,
      hasWork,
      onStopList,
      requestReady,
      routingDialogAbsent: !ui.autoRoutePresent,
    },
  }
}

function judgeSnapshot(snap) {
  const failures = []
  if (!snap.gates.schedulePresent) failures.push('no scheduleId on device')
  if (!snap.gates.beginningOfDay) failures.push(`status=${snap.schedule.status} (need BeginningOfDay=0)`)
  if (!snap.gates.hasWork) failures.push(`stopCount=${snap.schedule.stopCount} (empty BeginningOfDay cannot open auto_route)`)
  if (!snap.gates.onStopList) {
    failures.push(`not on stop list (${snap.screen.fragment}/${snap.screen.overlay})`)
  }
  if (!snap.gates.requestReady) {
    failures.push(`btn_out label=${snap.ui.btnOutLabel ?? 'absent'} (need Request Tour Start)`)
  }
  return { ok: snap.ready, failures }
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
    if (pack === null || String(candidate.version).localeCompare(String(pack.version), undefined, { numeric: true }) > 0) {
      pack = candidate
    }
  }
  if (!pack) throw new Error('no pinable published pack')
  return pack
}

async function compileWorkflow(pack, workflowRef) {
  const wf = await req('GET', `/workflows/${encodeURIComponent(workflowRef)}`)
  const currentVersion = wf.body?.data?.currentVersion ?? {}
  const compiled = await req('POST', '/verdict/runtime/compile', {
    workflowRef,
    workflowIr: { nodes: currentVersion.nodes ?? [], connections: currentVersion.connections ?? [] },
    domainPackKey: pack.packKey,
    domainPackVersion: pack.version,
    domainPackDigest: pack.bundleDigest,
  })
  if (!compiled.body.ok) throw new Error(`compile failed ${JSON.stringify(compiled.body.issues ?? compiled.body)}`)
  return compiled.body
}

async function pollRun(runId) {
  const deadline = Date.now() + TIMEOUT_SEC * 1000
  const terminal = new Set(['completed', 'failed', 'cancelled', 'error', 'blocked'])
  let detail = {}
  while (Date.now() < deadline) {
    const polled = await req('GET', `/verdict/runtime/runs/${encodeURIComponent(runId)}`)
    detail = polled.body
    if (terminal.has(String(detail.run?.status))) return detail
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  return detail
}

export async function runWorkflow(workflowRef, profileKey, inputs) {
  const pack = await pinPack()
  const compiled = await compileWorkflow(pack, workflowRef)
  const pinned = { ...inputs }
  if (workflowRef === 'nesy.workflow.tour-approval-lifecycle') {
    if (typeof pinned.scheduleId !== 'string' || pinned.scheduleId.trim() === '') {
      const schedule = await readSchedule()
      if (!schedule.scheduleId) {
        throw new Error('tour-approval-lifecycle needs a pinned scheduleId from device Room')
      }
      pinned.scheduleId = schedule.scheduleId
    } else {
      pinned.scheduleId = pinned.scheduleId.trim()
    }
    if (!pinned.routeCode) pinned.routeCode = ROUTE
  }
  const started = await req('POST', '/verdict/runtime/runs', {
    workflowRef,
    deviceId: DEVICE,
    appId: APP_ID,
    compiledPlanRef: compiled.compiledPlanRef,
    compiledPlanHash: compiled.compiledPlanHash,
    domainPackKey: pack.packKey,
    domainPackVersion: pack.version,
    domainPackDigest: pack.bundleDigest,
    profileKey,
    inputs: {
      ...pinned,
      sessionCorrelationId: pinned.sessionCorrelationId ?? `g90-10-fixture-${workflowRef}-${Date.now()}`,
    },
  })
  const runId = started.body.run?.runId ?? started.body.runId
  if (!runId) throw new Error(`${workflowRef} start returned no runId ${JSON.stringify(started.body).slice(0, 800)}`)
  const detail = await pollRun(runId)
  return {
    runId,
    productVerdict: detail.run?.productVerdict ?? detail.run?.product_verdict ?? null,
    status: detail.run?.status ?? null,
    cleanupResult: detail.runtime?.cleanupResult ?? detail.run?.cleanupResult ?? null,
  }
}

export async function createUnloadableShipment() {
  const created = await req('POST', '/nesy/auth/admin-fixture-create', {
    country: 'RS',
    environment: 'stage',
    customerId: process.env.VERDICT_FIXTURE_CUSTOMER_ID ?? '10330',
  })
  if (created.status === 409 || created.body.code === 'ADMIN_AUTH_NOT_READY') {
    throw new Error('ADMIN_AUTH_NOT_READY')
  }
  if (created.status === 400 && created.body.code === 'TARGET_NOT_STAGE') {
    throw new Error(`TARGET_NOT_STAGE: ${created.body.message}`)
  }
  const shipment = created.body.shipment
  if (created.status !== 200 || !shipment?.shipmentId || !shipment.scanValue) {
    throw new Error(`admin-fixture-create ${created.status}: ${JSON.stringify(created.body).slice(0, 400)}`)
  }
  if (created.body.token || shipment.token) {
    throw new Error('admin-fixture-create leaked a token field')
  }
  return {
    dbId: shipment.dbId,
    shipmentId: shipment.shipmentId,
    scanValue: shipment.scanValue,
    fullBarcode: shipment.fullBarcode,
    unloadStatus: shipment.unloadStatus,
  }
}

async function nesyTokenAndBase() {
  const cache = await req('GET', '/nesy/auth/admin-cache?country=RS&environment=stage')
  const decision = loginDashboardDecision(cache.body)
  if (cache.body.present !== true) {
    throw new Error(`${decision.code}: ${decision.detail}`)
  }
  throw new Error('refusing to read bearer from HTTP login; token is not in the response')
}

async function postNesy(base, token, path, body) {
  const res = await fetch(`${base}/${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json
  try {
    json = text ? JSON.parse(text) : {}
  } catch {
    json = { raw: text.slice(0, 400) }
  }
  return { status: res.status, body: json }
}

export async function approveLeavingPermission(schedule) {
  const { token, base } = await nesyTokenAndBase()
  return postNesy(base, token, 'Task/ApproveLeavingPermission', {
    ScheduleIds: [schedule.scheduleId],
    EventLocation: { Lat: 0, Lon: 0 },
    CourierUserNames: [],
  })
}

export async function rejectLeavingPermission(schedule) {
  const { token, base } = await nesyTokenAndBase()
  const candidates = [
    [{ ScheduleId: schedule.scheduleId, RejectionReason: 0 }],
    [{ ScheduleIds: [schedule.scheduleId], RejectionReason: 0 }],
    [
      {
        ScheduleId: schedule.scheduleId,
        RejectionReason: 0,
        EventLocation: { Latitude: 44.7866, Longitude: 20.4489, Accuracy: 10 },
      },
    ],
  ]
  const attempts = []
  for (const body of candidates) {
    const result = await postNesy(base, token, 'Task/RejectLeavingPermission', body)
    attempts.push({ body, ...result })
    const message = String(result.body?.resultMessage ?? '')
    if (result.status === 200 && result.body?.resultCode !== 500 && !/deserialize/i.test(message)) {
      return { ...result, attempts }
    }
  }
  return { status: attempts.at(-1)?.status ?? 0, body: attempts.at(-1)?.body ?? {}, attempts }
}

export function dismissNotificationList() {
  const xml = dumpUiXml()
  const exit = nodeAttr(xml, 'btn_exit')
  if (!exit) return { dismissed: false, reason: 'btn_exit absent' }
  const center = boundsCenter(exit)
  if (!center) return { dismissed: false, reason: 'btn_exit has no bounds' }
  adb(['shell', 'input', 'tap', String(center.x), String(center.y)])
  return { dismissed: true, at: center }
}

function tapRefresh() {
  const xml = dumpUiXml()
  const refresh = nodeAttr(xml, 'ib_refresh')
  const center = boundsCenter(refresh)
  if (!center) return { refreshed: false }
  adb(['shell', 'input', 'tap', String(center.x), String(center.y)])
  return { refreshed: true, at: center }
}

export async function settleDevice(label) {
  const actions = []
  await new Promise((resolve) => setTimeout(resolve, 2500))
  const first = readUi()
  if (first.notificationExitPresent) {
    actions.push({ op: 'dismiss-notification-list', ...dismissNotificationList() })
    await new Promise((resolve) => setTimeout(resolve, 1500))
  }
  const screen = await readScreen()
  if (screen.fragment !== 'StopListFragment') {
    actions.push({ op: 'refresh-after-leave-list', ...tapRefresh() })
    await new Promise((resolve) => setTimeout(resolve, 2000))
  }
  const snap = await snapshotFixture()
  if (!snap.gates.beginningOfDay || !snap.gates.requestReady) {
    actions.push({ op: 'refresh-schedule', ...tapRefresh() })
    await new Promise((resolve) => setTimeout(resolve, 2500))
  }
  return { label, actions, snapshot: await snapshotFixture() }
}

export async function restoreFixture() {
  assertPreservedPid()
  const before = await snapshotFixture()
  const result = {
    before,
    reject: null,
    settle: null,
    after: before,
    usedFakeSuccess: false,
  }
  if (before.ready) return { ...result, ok: true, reason: 'already at Host B starting state' }

  if (before.schedule.scheduleId && before.schedule.status !== 0) {
    try {
      result.reject = await rejectLeavingPermission(before.schedule)
    } catch (error) {
      result.reject = { status: 0, body: { error: error instanceof Error ? error.message : String(error) } }
    }
  }
  result.settle = await settleDevice('restore')
  result.after = result.settle.snapshot
  const judge = judgeSnapshot(result.after)
  return { ...result, ok: judge.ok, failures: judge.failures }
}

export async function provisionFixture() {
  const identity = assertPreservedPid()
  const before = await snapshotFixture()
  const log = {
    identity,
    routeCode: ROUTE,
    before,
    shipment: null,
    loadToVehicle: null,
    restore: null,
    after: before,
    usedFakeSuccess: false,
    note: 'Fixture sets starting business state only. Tour-approval workflow is not skipped.',
  }

  if (before.ready) {
    log.after = before
    log.ok = true
    log.reason = 'already at Host B starting state'
    return log
  }

  if (!before.schedule.scheduleId) {
    throw new Error('no schedule on device — select route 31 first; this fixture does not skip select-route')
  }
  if (before.screen.fragment !== 'StopListFragment') {
    throw new Error(`device is on ${before.screen.fragment}, not StopListFragment — will not fake navigation`)
  }

  if (!before.gates.hasWork) {
    log.shipment = await createUnloadableShipment()
    log.loadToVehicle = await runWorkflow('nesy.workflow.load-to-vehicle', 'nesy.launch.reuse-session', {
      scanValue: log.shipment.scanValue,
      alternateKey: log.shipment.shipmentId,
    })
    if (log.loadToVehicle.productVerdict !== 'PASS_ONLINE') {
      log.ok = false
      log.failures = [`load-to-vehicle ${log.loadToVehicle.productVerdict} (${log.loadToVehicle.runId})`]
      log.after = await snapshotFixture()
      return log
    }
  }

  log.restore = await restoreFixture()
  log.after = log.restore.after
  const judge = judgeSnapshot(log.after)
  log.ok = judge.ok
  log.failures = judge.failures
  return log
}

export function writeFixtureArtifact(report) {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')
  const out = join(REPO, 'docs/verdict/goals', `G90-10-host-b-fixture-${stamp}.json`)
  writeFileSync(out, JSON.stringify(report, null, 2) + '\n')
  return out
}

const isMain = /g90-10-host-b-fixture\.mjs$/.test(process.argv[1] ?? '')
if (isMain) {
  const command = process.argv[2] ?? 'provision'
  const run = async () => {
    if (command === 'snapshot') return snapshotFixture()
    if (command === 'restore') return restoreFixture()
    if (command === 'provision') return provisionFixture()
    throw new Error(`unknown command ${command} (provision|restore|snapshot)`)
  }
  const report = await run()
  if (command === 'provision' || command === 'restore') {
    const out = writeFixtureArtifact({
      command,
      closedAt: new Date().toISOString(),
      preservedApiPid: PRESERVED_API_PID,
      ...report,
    })
    console.log(JSON.stringify({ artifact: out, ok: report.ok, after: report.after, failures: report.failures }, null, 2))
    process.exit(report.ok ? 0 : 5)
  }
  console.log(JSON.stringify(report, null, 2))
  process.exit(report.ready ? 0 : 5)
}
