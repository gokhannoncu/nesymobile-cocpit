#!/usr/bin/env node
/**
 * G90.10 BD.6 live qualification — Host B complete-delivery LOCAL queue.
 *
 * process-parcel / tap-input-confirm is HOST_NOT_CAPABLE (negative live
 * run_578dcc5d). Initial LIVE_QUALIFIED host is complete-delivery /
 * tap-delivery-confirm. Do not loosen observeInjectedClass.
 *
 *   0  refuse closed PIDs (incl. 25062) / tsx / dirty apps+packages / pack != 1.34.0
 *   1  uninjected complete-delivery twin
 *   2  restore known delivery start (not Host B reject; not G4 flush)
 *   3  injected OFFLINE_QUEUE (controlled device WAN cut)
 *   4  cleanup = radios + queue isolate; G4 flush is not a bar
 *
 * Not a D60 campaign. Not airplane/USB. Not HOST_TRANSPORT_CUT.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  approveLeavingPermission,
  createUnloadableShipment,
  dismissNotificationList,
  rejectLeavingPermission,
  runWorkflow,
  settleDevice,
} from './g90-10-host-b-fixture.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const API = process.env.VERDICT_API ?? 'http://127.0.0.1:4001/api'
const WEB = process.env.VERDICT_WEB ?? 'http://127.0.0.1:4002'
const DEVICE = process.env.VERDICT_DEVICE ?? 'R6CW400BC8N'
const APP_ID = process.env.VERDICT_APP_ID ?? 'com.arasdigital.nesymobile.rstest'
const WORKFLOW = 'nesy.workflow.complete-delivery'
const PROFILE = 'nesy.launch.reuse-session'
const REQUIRED_PACK = '1.34.0'
const TIMEOUT_SEC = Number(process.env.VERDICT_TIMEOUT ?? 360)
const CLOSED_PIDS = new Set(['55798', '21508', '29171', '38870', '64978', '95043', '25062', '8433', '13440', '52684', '10060', '63409', '7371', '52089', '30115'])
const CLOSED_COMMITS = new Set(['3770d2a', '291553b', '94a9acf', '413485a', 'eb48304'])
const REMOTE_SUCCESS_FACTS = new Set([
  'REMOTE.DELIVERY_STATUS_COMPLETED',
  'REMOTE.DELIVERY_CONFIRMED',
  'REMOTE.TOUR_APPROVAL_REQUEST_CREATED',
  'REMOTE.TOUR_APPROVAL_STATUS_APPROVED',
  'REMOTE.TOUR_APPROVAL_CONFIRMED',
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

function adbPath() {
  if (process.env.ADB_PATH) return process.env.ADB_PATH
  const which = sh('which', ['adb'])
  if (which) return which
  return `${process.env.HOME}/Library/Android/sdk/platform-tools/adb`
}

function adb(args, timeoutMs = 20_000) {
  return spawnSync(adbPath(), ['-s', DEVICE, ...args], { encoding: 'utf8', timeout: timeoutMs })
}

function listenPids(port) {
  return sh('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'])
    .split(/\s+/)
    .filter(Boolean)
}

function commandOf(pid) {
  return sh('ps', ['-p', String(pid), '-o', 'command=']).replace(/\s+/g, ' ')
}

function processSnapshot() {
  const apiPid = listenPids(4001)[0] ?? null
  const webPid = listenPids(4002)[0] ?? null
  return {
    apiPid,
    webPid,
    apiCommand: apiPid ? commandOf(apiPid) : null,
    webCommand: webPid ? commandOf(webPid) : null,
    apiStartedAt: apiPid ? sh('ps', ['-p', apiPid, '-o', 'lstart=']).trim() : null,
  }
}

function sourceDirty(paths) {
  return sh('git', ['status', '--porcelain', '--', ...paths])
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
}

function loadApiEnv() {
  try {
    const raw = readFileSync(join(REPO, 'apps/api/.env'), 'utf8').replace(/^\uFEFF/, '')
    for (const line of raw.split('\n')) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim())
      if (match && !process.env[match[1]]) {
        process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
      }
    }
  } catch {
    // schemaStatus reports missing DATABASE_URL
  }
}

function schemaStatus() {
  loadApiEnv()
  const res = spawnSync(
    'pnpm',
    ['--filter', '@nesy/db', 'exec', 'prisma', 'migrate', 'status', '--schema', 'prisma/schema.prisma'],
    { cwd: REPO, encoding: 'utf8', env: process.env },
  )
  const text = `${res.stdout}\n${res.stderr}`
  return {
    ok: res.status === 0 && /Database schema is up to date/i.test(text),
    text: text.slice(0, 800),
  }
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

function tapResource(resourceId) {
  const center = boundsCenter(nodeAttr(dumpUiXml(), resourceId))
  if (!center) return { tapped: false, resourceId }
  adb(['shell', 'input', 'tap', String(center.x), String(center.y)])
  return { tapped: true, resourceId, at: center }
}

function tapText(text) {
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = dumpUiXml().match(new RegExp(`<node[^>]*text="${escaped}"[^>]*>`))
  const center = boundsCenter(match ? match[0] : null)
  if (!center) return { tapped: false, text }
  adb(['shell', 'input', 'tap', String(center.x), String(center.y)])
  return { tapped: true, text, at: center }
}

function dismissUnscannedWarning() {
  const xml = dumpUiXml()
  if (!/There are still some shipment items not scanned/.test(xml)) {
    return { dismissed: false, reason: 'warning absent' }
  }
  const scan = tapText('Continue scanning parcel')
  return { dismissed: scan.tapped, ...scan }
}

function pressBack() {
  adb(['shell', 'input', 'keyevent', '4'])
  return { op: 'BACK' }
}

async function fetchJson(url, attempts = 3) {
  let lastError
  for (let i = 0; i < attempts; i += 1) {
    try {
      const res = await fetch(url)
      return await res.json()
    } catch (error) {
      lastError = error
      await new Promise((resolve) => setTimeout(resolve, 750 * (i + 1)))
    }
  }
  throw lastError
}

async function readScreen() {
  try {
    const body = await fetchJson(`${WEB}/api/adb/screen?serial=${encodeURIComponent(DEVICE)}`)
    const current = body.current ?? {}
    const overlay = body.overlay ?? {}
    return {
      fragment: current.className ?? current.name ?? null,
      overlay: overlay.className ?? overlay.name ?? null,
      appForeground: body.appForeground ?? null,
    }
  } catch (error) {
    return { fragment: null, overlay: null, error: error instanceof Error ? error.message : String(error) }
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
            itemLocation: item.itemCurrentLocation,
          })
        }
      }
    }
  }
  return {
    scheduleId: schedule.scheduleId ?? null,
    status: schedule.status ?? null,
    stopCount: (schedule.stops ?? []).length,
    parcels,
  }
}

function radioState() {
  const wifi = String(adb(['shell', 'settings', 'get', 'global', 'wifi_on']).stdout ?? '').trim()
  const data = String(adb(['shell', 'settings', 'get', 'global', 'mobile_data']).stdout ?? '').trim()
  const adbState = String(adb(['get-state']).stdout ?? '').trim()
  return {
    wifiOn: wifi,
    mobileData: data,
    adbState,
    radiosRestored: (wifi === '1' || wifi === 'true') && adbState === 'device',
  }
}

function restoreRadios() {
  adb(['shell', 'svc', 'wifi', 'enable'])
  adb(['shell', 'svc', 'data', 'enable'])
  return radioState()
}

async function leftoverQueueIsolate() {
  try {
    const snap = await fetchJson(`${WEB}/api/adb/database?serial=${encodeURIComponent(DEVICE)}&limit=20`)
    const tables = (snap.tables ?? []).filter((table) => /pending|queue|offline/i.test(String(table.name ?? '')))
    const leftover = tables.filter((table) => Number(table.rowCount) > 0)
    const details = []
    for (const table of leftover.slice(0, 2)) {
      const rows = await fetchJson(
        `${WEB}/api/adb/database?serial=${encodeURIComponent(DEVICE)}&table=${encodeURIComponent(table.name)}&limit=20`,
      )
      details.push({
        table: table.name,
        rowCount: table.rowCount,
        rows: (rows.tableData?.rows ?? []).map((row) => ({
          id: row.id ?? row.Id ?? null,
          subtype: row.subtype ?? row.type ?? row.operationType ?? null,
          correlation: row.correlationId ?? row.occurrenceId ?? row.entityId ?? row.shipmentId ?? null,
        })),
      })
    }
    return {
      probed: true,
      leftoverPresent: leftover.length > 0,
      tables: leftover.map((table) => ({ name: table.name, rowCount: table.rowCount })),
      details,
      note:
        leftover.length > 0
          ? 'leftover LOCAL queue rows remain after WAN restore. Isolation = document + distinct next barcode. G4 flush is not a LIVE_QUALIFIED bar.'
          : 'no pending/queue table rows after WAN restore',
    }
  } catch (error) {
    return { probed: false, error: error instanceof Error ? error.message : String(error) }
  }
}

function axesOf(detail, started) {
  const runtime = detail.runtime ?? {}
  const run = detail.run ?? {}
  const provenance = runtime.faultProvenance ?? runtime.fault_provenance ?? null
  return {
    runId: run.id ?? run.runId ?? started?.runId ?? null,
    productVerdict: run.productVerdict ?? run.product_verdict ?? null,
    cleanupResult: runtime.cleanupResult ?? run.cleanupResult ?? run.cleanup_result ?? null,
    injectedFault: runtime.injectedFault ?? started?.injectedFault ?? null,
    expectedClass: runtime.expectedClass ?? started?.expectedClass ?? null,
    observedClass: runtime.observedClass ?? null,
    injectedFaultHost: runtime.injectedFaultHost ?? started?.injectedFaultHost ?? null,
    evaluationFailureClass: runtime.evaluationFailureClass ?? run.evaluationFailureClass ?? null,
    terminationReason: runtime.terminationReason ?? run.terminationReason ?? run.termination_reason ?? null,
    resourceReleaseResult: runtime.resourceReleaseResult ?? run.resourceReleaseResult ?? null,
    faultProvenance: provenance,
    status: run.status ?? null,
    lifecycle: runtime.lifecycle ?? run.lifecycle ?? null,
  }
}

function factsOf(detail) {
  const evaluations = detail.oracleEvaluations ?? detail.oracle_evaluations ?? []
  const rows = []
  for (const item of evaluations) {
    const reqs = item.requirements
    if (!reqs || typeof reqs !== 'object') continue
    for (const [key, value] of Object.entries(reqs)) {
      if (key.startsWith('__') || value == null || typeof value !== 'object') continue
      rows.push({
        factKey: value.factKey ?? value.fact_key ?? key,
        status: value.state ?? null,
        value: value.state === 'SATISFIED' || value.state === 'MET' ? true : false,
        obligation: value.requirement?.obligation ?? null,
        subtype: null,
        source: item.evaluator_kind ?? item.evaluatorKind ?? null,
        occurrenceId: item.occurrence_id ?? item.occurrenceId ?? null,
      })
    }
  }
  return rows
}

function queueFact(facts, runId) {
  return facts.find((row) => {
    if (row.factKey !== 'LOCAL.OFFLINE_QUEUE_ITEM_WAITING') return false
    if (row.status !== 'SATISFIED' && row.status !== 'MET') return false
    if (runId && row.occurrenceId && !String(row.occurrenceId).includes(runId)) return false
    return true
  }) ?? null
}

function remoteSuccessFacts(facts) {
  return facts.filter(
    (row) =>
      REMOTE_SUCCESS_FACTS.has(String(row.factKey)) &&
      (row.value === true || row.status === 'SATISFIED' || row.status === 'MET'),
  )
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

async function runCompleteDelivery(label, pack, compiled, parcel, fault) {
  const startBody = {
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
      sessionCorrelationId: `g90-10-bd6-${label}-${Date.now()}`,
    },
    ...(fault === null
      ? {}
      : { injectedFault: fault.injectedFault, injectedFaultHost: fault.injectedFaultHost }),
  }
  const started = await req('POST', '/verdict/runtime/runs', startBody)
  const start = started.body
  const runId = start.run?.runId ?? start.runId
  if (!runId) throw new Error(`${label} start returned no runId ${JSON.stringify(start).slice(0, 800)}`)
  const detail = await pollRun(runId)
  const facts = factsOf(detail)
  return {
    start,
    axes: axesOf(detail, start),
    facts,
    queueFact: queueFact(facts, runId),
    remoteSuccess: remoteSuccessFacts(facts),
    steps: (detail.steps ?? []).map((step) => ({
      planStepId: step.plan_step_id ?? step.planStepId ?? null,
      actionResult: step.action_result ?? step.actionResult ?? null,
      continueGate: step.continue_gate_result ?? step.continueGateResult ?? null,
      oracle: step.final_oracle_result ?? step.finalOracleResult ?? null,
    })),
  }
}

function isUsableParcel(parcel) {
  return Boolean(parcel?.scanPayload) && parcel.shipmentStatus === 0
}

function singletonUsable(parcels) {
  const usable = parcels.filter(isUsableParcel)
  const byStop = new Map()
  for (const parcel of usable) {
    const key = parcel.stopId ?? parcel.shipmentId
    byStop.set(key, (byStop.get(key) ?? 0) + 1)
  }
  return usable.filter((parcel) => (byStop.get(parcel.stopId ?? parcel.shipmentId) ?? 0) === 1)
}

function provisionedScans(log) {
  const fromLog = (log ?? [])
    .map((row) => row?.shipment?.scanValue)
    .filter((value) => typeof value === 'string' && value.length > 0)
  const fromEnv = String(process.env.VERDICT_BD6_PREFERRED_SCANS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  return new Set([...fromLog, ...fromEnv])
}

function pickProvisionedSingleton(singletons, log, excludeScan) {
  const preferred = provisionedScans(log)
  const pool =
    preferred.size > 0 ? singletons.filter((parcel) => preferred.has(parcel.scanPayload)) : singletons
  return pool.find((parcel) => parcel.scanPayload && parcel.scanPayload !== excludeScan) ?? null
}

function preferredSingletonCount(fixture, log) {
  const preferred = provisionedScans(log)
  if (preferred.size === 0) return fixture.singletonCount
  return fixture.singleton.filter((parcel) => preferred.has(parcel.scanPayload)).length
}

function snapshotProcessParcel(schedule, screen, xml = dumpUiXml()) {
  const loaded = schedule.parcels.filter((parcel) => parcel.scanPayload)
  const usable = loaded.filter(isUsableParcel)
  const singleton = singletonUsable(loaded)
  const approved = schedule.status === 2
  return {
    scheduleId: schedule.scheduleId,
    status: schedule.status,
    fragment: screen.fragment,
    overlay: screen.overlay,
    appForeground: screen.appForeground,
    parcelCount: loaded.length,
    usableCount: usable.length,
    singletonCount: singleton.length,
    parcels: loaded,
    usable,
    singleton,
    manuelInput: /resource-id="[^"]*manuel_input"/.test(xml),
    barcodeField: /resource-id="[^"]*et_input_dialog_barcode_number"/.test(xml),
    radios: radioState(),
    approved,
    ready:
      approved &&
      screen.fragment === 'TaskListFragment' &&
      singleton.length > 0 &&
      /resource-id="[^"]*manuel_input"/.test(xml),
    deliveryReady: approved && screen.fragment === 'DeliveryFragment' && singleton.length > 0,
  }
}

async function prepareApprovedTaskList(scheduleId, provisioned = []) {
  const log = []
  let screen = await readScreen()
  if (screen.fragment === 'TaskListFragment') {
    const current = snapshotProcessParcel(await readSchedule(), screen)
    if (current.ready) return { ok: true, log, fixture: current }
    log.push({ op: 'BACK-from-task-list', ...pressBack() })
    await new Promise((resolve) => setTimeout(resolve, 1500))
    screen = await readScreen()
  }

  const dismissed = dismissNotificationList()
  if (dismissed.dismissed) {
    log.push({ op: 'dismiss-notification-list', ...dismissed })
    await new Promise((resolve) => setTimeout(resolve, 1500))
    screen = await readScreen()
  }

  let schedule = await readSchedule()
  const xml = dumpUiXml()
  const requestReady = /text="Request Tour Start"/.test(xml)
  log.push({ screen, requestReady, status: schedule.status })

  if (screen.fragment === 'StopListFragment' && requestReady && schedule.status === 0) {
    const tour = await runWorkflow('nesy.workflow.tour-approval-lifecycle', 'nesy.launch.reuse-session', {
      routeCode: '31',
      scheduleId,
      sessionCorrelationId: `g90-10-bd6-fixture-tour-${Date.now()}`,
    })
    log.push({ op: 'tour-approval-fixture', ...tour })
    const afterPush = dismissNotificationList()
    log.push({ op: 'dismiss-approval-push', ...afterPush })
    await new Promise((resolve) => setTimeout(resolve, 2000))
    schedule = await readSchedule()
    screen = await readScreen()
  }
  if (schedule.status === 1) {
    const approved = await approveLeavingPermission({ scheduleId })
    log.push({
      op: 'approve-leaving-permission',
      status: approved.status,
      resultCode: approved.body?.resultCode ?? approved.body?.ResultCode,
      message: approved.body?.resultMessage ?? approved.body?.ResultMessage,
    })
    await new Promise((resolve) => setTimeout(resolve, 2000))
    dismissNotificationList()
    const settled = await settleDevice('bd6-after-approve')
    log.push({ op: 'settle-after-approve', status: settled.snapshot?.schedule?.status, fragment: settled.snapshot?.screen?.fragment })
    schedule = await readSchedule()
    screen = await readScreen()
  }

  if (schedule.status !== 2) {
    return { ok: false, reason: `not approved status=${schedule.status}`, log }
  }
  if (screen.fragment !== 'StopListFragment') {
    return { ok: false, reason: `need StopListFragment to open-stop, got ${screen.fragment}`, log }
  }

  const singletons = singletonUsable(schedule.parcels ?? [])
  const parcel = pickProvisionedSingleton(singletons, provisioned) ?? singletons[0] ?? (schedule.parcels ?? []).find(isUsableParcel)
  if (!parcel) return { ok: false, reason: 'no parcel to open', log }
  if (singletons.length === 0) {
    return { ok: false, reason: 'no singleton-stop parcel to open — refusing same-stop sibling host', log }
  }
  const opened = await runWorkflow('nesy.workflow.open-stop', 'nesy.launch.reuse-session', {
    searchTerm: parcel.shipmentId,
    rowKey: parcel.scanPayload,
    sessionCorrelationId: `g90-10-bd6-fixture-open-${Date.now()}`,
  })
  log.push({ op: 'open-stop-fixture', ...opened })
  screen = await readScreen()
  const fixture = snapshotProcessParcel(await readSchedule(), screen)
  return { ok: fixture.ready, reason: fixture.ready ? undefined : `after open-stop ${screen.fragment} status=${fixture.status} verdict=${opened.productVerdict}`, log, fixture }
}

async function restoreToTaskList(maxBacks = 4) {
  const actions = []
  const xml = dumpUiXml()
  if (/resource-id="[^"]*btn_exit"/.test(xml)) {
    actions.push({ op: 'dismiss-notification-list', ...tapResource('btn_exit') })
    await new Promise((resolve) => setTimeout(resolve, 1200))
  }
  for (let i = 0; i < maxBacks; i += 1) {
    const screen = await readScreen()
    if (screen.fragment === 'TaskListFragment') {
      return { ok: true, actions, screen, schedule: await readSchedule() }
    }
    if (screen.fragment === 'StopListFragment') {
      return { ok: false, reason: 'landed on StopListFragment', actions, screen, schedule: await readSchedule() }
    }
    actions.push(pressBack())
    await new Promise((resolve) => setTimeout(resolve, 1200))
  }
  const screen = await readScreen()
  return {
    ok: screen.fragment === 'TaskListFragment',
    reason: screen.fragment === 'TaskListFragment' ? undefined : `still on ${screen.fragment}`,
    actions,
    screen,
    schedule: await readSchedule(),
  }
}

async function provisionSecondParcel() {
  const shipment = await createUnloadableShipment()
  const loaded = await runWorkflow('nesy.workflow.load-to-vehicle', 'nesy.launch.reuse-session', {
    scanValue: shipment.scanValue,
    alternateKey: shipment.shipmentId,
  })
  return { shipment, loaded }
}

function isolationOf(row, radios) {
  const failures = []
  if (row.axes.lifecycle !== 'CLOSED' && row.axes.status !== 'completed') {
    failures.push(`not closed (${row.axes.lifecycle}/${row.axes.status})`)
  }
  if (!radios.radiosRestored) {
    failures.push(`radios not restored wifi=${radios.wifiOn} adb=${radios.adbState}`)
  }
  if (radios.adbState !== 'device') failures.push(`adb=${radios.adbState}`)
  return { clean: failures.length === 0, failures, radios }
}

function judgeBaseline(row, radios) {
  const isolation = isolationOf(row, radios)
  const failures = []
  if (row.axes.injectedFault != null) failures.push(`injectedFault=${row.axes.injectedFault}`)
  if (row.axes.observedClass != null) failures.push(`observedClass filled on uninjected (${row.axes.observedClass})`)
  if (row.axes.productVerdict !== 'PASS_ONLINE') {
    failures.push(`expected business result PASS_ONLINE, got ${row.axes.productVerdict}`)
  }
  if (row.queueFact) {
    failures.push('LOCAL.OFFLINE_QUEUE_ITEM_WAITING present on uninjected twin')
  }
  const cleanupOk =
    row.axes.cleanupResult === 'SUCCEEDED' ||
    ((row.axes.cleanupResult === 'NOT_REQUIRED' || row.axes.cleanupResult === 'NOT_STARTED') &&
      row.axes.productVerdict === 'PASS_ONLINE' &&
      row.axes.lifecycle === 'CLOSED' &&
      row.axes.resourceReleaseResult === 'RELEASED')
  if (!cleanupOk) failures.push(`cleanup=${row.axes.cleanupResult}`)
  if (!isolation.clean) failures.push(`isolation dirty: ${isolation.failures.join(', ')}`)
  return { ok: failures.length === 0, failures, isolation }
}

function judgeBd6(row, radios) {
  const isolation = isolationOf(row, radios)
  const failures = []
  const provenance = row.axes.faultProvenance ?? {}
  if (row.start.injectedFault !== 'OFFLINE_QUEUE') failures.push(`start.injectedFault=${row.start.injectedFault}`)
  if (row.axes.injectedFault !== 'OFFLINE_QUEUE') failures.push(`readback.injectedFault=${row.axes.injectedFault}`)
  if (row.axes.expectedClass !== 'OFFLINE_QUEUED') failures.push(`expectedClass=${row.axes.expectedClass}`)
  if (row.axes.observedClass !== 'OFFLINE_QUEUED') failures.push(`observedClass=${row.axes.observedClass}`)
  if (row.axes.productVerdict !== 'PASS_QUEUED_OFFLINE') {
    failures.push(`productVerdict=${row.axes.productVerdict} (need PASS_QUEUED_OFFLINE)`)
  }
  if (row.axes.productVerdict === 'FAIL_PRODUCT' || String(row.axes.productVerdict ?? '').startsWith('FAIL_')) {
    failures.push(`PRODUCT_FAIL ${row.axes.productVerdict}`)
  }
  if (provenance.phase !== 'EFFECT_OBSERVED') failures.push(`provenance.phase=${provenance.phase}`)
  if (provenance.actuallyFired !== true) failures.push(`actuallyFired=${provenance.actuallyFired}`)
  if (provenance.abortKind !== 'NONE') failures.push(`abortKind=${provenance.abortKind}`)
  if (provenance.effectKind !== 'LOCAL_QUEUE_PERSIST') failures.push(`effectKind=${provenance.effectKind}`)
  if (provenance.effectKind === 'HOST_TRANSPORT_CUT') failures.push('HOST_TRANSPORT_CUT present — BD.6 stole BD.2 path')
  const chain = [provenance.requestedAtMs, provenance.armedAtMs, provenance.triggeredAtMs, provenance.effectObservedAtMs]
  if (chain.some((item) => item == null)) failures.push(`provenance timestamps incomplete ${JSON.stringify(chain)}`)
  if (!row.queueFact) failures.push('LOCAL.OFFLINE_QUEUE_ITEM_WAITING absent')
  if (row.remoteSuccess.length > 0) {
    failures.push(`remote-success fact present ${row.remoteSuccess.map((item) => item.factKey).join(',')}`)
  }
  if (!isolation.clean) failures.push(`isolation dirty: ${isolation.failures.join(', ')}`)
  return {
    ok: failures.length === 0,
    failures,
    provenance,
    isolation,
    note: 'WAN restore is cleanup. Queue flush / G4 reconnect is not a LIVE_QUALIFIED bar.',
  }
}

async function classifierIndependence(row) {
  const { observeInjectedClass } = await import(
    new URL('../packages/workflow-contract/dist/index.js', import.meta.url).href
  )
  const recomputed = observeInjectedClass({
    actionResult: null,
    productVerdict: row.axes.productVerdict,
    localQueueObserved: Boolean(row.queueFact),
    provenance: row.axes.faultProvenance ?? {},
  })
  const withoutEvidence = observeInjectedClass({
    actionResult: null,
    productVerdict: row.axes.productVerdict,
    localQueueObserved: false,
    provenance: row.axes.faultProvenance ?? {},
  })
  const failures = []
  if (recomputed !== 'OFFLINE_QUEUED') {
    failures.push(`classifier without injectedFault returned ${recomputed}`)
  }
  if (recomputed !== row.axes.observedClass) {
    failures.push(`recomputed ${recomputed} != persisted observedClass ${row.axes.observedClass}`)
  }
  if (withoutEvidence === 'OFFLINE_QUEUED') {
    failures.push('classifier emitted OFFLINE_QUEUED without localQueueObserved — input/measurement collapsed')
  }
  return { ok: failures.length === 0, failures, recomputed, withoutEvidence, usedInjectedFault: false }
}

const processSnap = processSnapshot()
const issues = []
issues.push(
  'BD.6 is CLOSED until uninjected complete-delivery is PASS_ONLINE with REMOTE.DELIVERY_CONFIRMED SATISFIED and observedClass=null',
)
if (!processSnap.apiCommand || !/dist\/server\.js/.test(processSnap.apiCommand)) {
  issues.push(`:4001 is not node dist/server.js (${processSnap.apiCommand ?? 'none'})`)
}
if (CLOSED_PIDS.has(String(processSnap.apiPid))) {
  issues.push(`PID ${processSnap.apiPid} is a closed lineage, not a BD.6 qualification PID`)
}
if (/tsx watch|src\/server\.ts/.test(processSnap.apiCommand ?? '')) {
  issues.push(':4001 is tsx/dev')
}
if (!processSnap.webCommand || /next dev/.test(processSnap.webCommand)) {
  issues.push(`:4002 is not next start (${processSnap.webCommand ?? 'none'})`)
}
const codeDirty = sourceDirty(['apps', 'packages', 'domain-packs'])
if (codeDirty.length > 0) issues.push(`G90.10 code dirty: ${codeDirty.join(' | ')}`)
const head = sh('git', ['rev-parse', 'HEAD'])
const headShort = sh('git', ['rev-parse', '--short', 'HEAD'])
if ([...CLOSED_COMMITS].some((commit) => headShort === commit || head.startsWith(commit))) {
  issues.push(`HEAD ${headShort} is a closed G90.9/BD.2/BD.3/process-parcel-negative reference commit`)
}
if (issues.length > 0) {
  console.error('G90.10 BD.6 preflight failed:')
  for (const issue of issues) console.error(`  ${issue}`)
  process.exit(2)
}

const schema = schemaStatus()
const identity = {
  gitCommit: head,
  gitCommitShort: headShort,
  workingTreeClean: sourceDirty(['apps', 'packages', 'scripts', 'domain-packs']).length === 0,
  g90_10ImplementationClean: codeDirty.length === 0,
  runnerDirty: sourceDirty(['scripts/g90-10-bd6-live-smoke.mjs', 'scripts/g90-10-host-b-fixture.mjs']).length > 0,
  apiCommand: processSnap.apiCommand,
  apiPid: processSnap.apiPid,
  apiStartedAt: processSnap.apiStartedAt,
  webCommand: processSnap.webCommand,
  webPid: processSnap.webPid,
  dbSchema: schema.ok ? 'up-to-date' : `unknown: ${schema.text}`,
  deviceId: DEVICE,
  host: 'B',
  workflowRef: WORKFLOW,
  profileKey: PROFILE,
  injectionModel: 'controlled device WAN cut representing BD.6 OFFLINE_QUEUE',
  closedLineages: {
    g90_9: { gitCommit: '3770d2a', apiPid: 55798 },
    bd3: { gitCommit: '291553b', apiPid: 29171, note: 'BD.3 LIVE_QUALIFIED historical proof' },
    bd2: { gitCommit: '94a9acf', apiPid: 95043, note: 'BD.2 LIVE_QUALIFIED historical proof; do not re-qualify' },
    bd6ProcessParcelNegative: {
      gitCommit: 'eb48304',
      apiPid: 25062,
      note: 'process-parcel HOST_NOT_CAPABLE negative live; do not bind complete-delivery qual here',
    },
    designRuntime: { apiPid: 38870, note: 'pre-BD.2 design runtime; not a qualification PID' },
  },
}

console.log('G90.10 BD.6 identity')
console.log(JSON.stringify(identity, null, 2))

const pack = await pinPack()
identity.packVersion = pack.version
identity.packKey = pack.packKey
identity.packDigest = pack.bundleDigest
if (pack.version !== REQUIRED_PACK) {
  console.error(`pack pin ${pack.packKey}@${pack.version} is not ${REQUIRED_PACK} — refusing live smoke`)
  process.exit(2)
}
const compiled = await compileWorkflow(pack, WORKFLOW)
identity.compiledPlanRef = compiled.compiledPlanRef
identity.compiledPlanHash = compiled.compiledPlanHash
identity.sourceMap = compiled.sourceMap ?? null
if (compiled.sourceMap && !Object.values(compiled.sourceMap).some((value) => String(value).includes('sm-done-3e'))) {
  console.error('compiled plan has no complete-delivery read-pending-queue source map (sm-done-3e)')
  process.exit(2)
}
if (compiled.sourceMap && !Object.keys(compiled.sourceMap).includes('tap-delivery-confirm')) {
  console.error('compiled plan has no tap-delivery-confirm — refusing process-parcel host')
  process.exit(2)
}

console.log('\n=== complete-delivery fixture snapshot ===')
let schedule = await readSchedule()
let screen = await readScreen()
let fixture = snapshotProcessParcel(schedule, screen)
console.log(JSON.stringify(fixture, null, 2))

const provisionLog = []
const warning = dismissUnscannedWarning()
if (warning.dismissed) {
  provisionLog.push({ op: 'dismiss-unscanned-warning', ...warning })
  await new Promise((resolve) => setTimeout(resolve, 1200))
  const backed = await restoreToTaskList()
  provisionLog.push({ op: 'leave-delivery-after-warning', ...backed })
  schedule = backed.schedule ?? (await readSchedule())
  screen = backed.screen ?? (await readScreen())
  fixture = snapshotProcessParcel(schedule, screen)
}

if (screen.fragment === 'LoginFragment') {
  console.log('\n=== session expired — cold-real-login fixture (not BD.6 measurement) ===')
  const loggedIn = await runWorkflow('nesy.workflow.login', 'nesy.launch.cold-real-login', {
    pin: process.env.VERDICT_VALID_PIN ?? '3680',
    sessionCorrelationId: `g90-10-bd6-fixture-login-${Date.now()}`,
  })
  provisionLog.push({ op: 'cold-real-login', ...loggedIn })
  if (loggedIn.productVerdict !== 'PASS_ONLINE') {
    console.error(`login fixture ${loggedIn.productVerdict}`)
    process.exit(5)
  }
  await new Promise((resolve) => setTimeout(resolve, 2000))
  schedule = await readSchedule()
  screen = await readScreen()
  fixture = snapshotProcessParcel(schedule, screen)
  console.log(JSON.stringify({ screen, status: fixture.status, usableCount: fixture.usableCount }, null, 2))
}

if (!fixture.deliveryReady && (!schedule.scheduleId || /Please Select Route|resource-id="[^"]*dialog_spinner"/.test(dumpUiXml()))) {
  console.log('\n=== select-route 31 fixture (not BD.6 measurement) ===')
  const selected = await runWorkflow('nesy.workflow.select-route', 'nesy.launch.reuse-session', {
    routeCode: '31',
    sessionCorrelationId: `g90-10-bd6-fixture-route-${Date.now()}`,
  })
  provisionLog.push({ op: 'select-route', ...selected })
  await new Promise((resolve) => setTimeout(resolve, 2000))
  schedule = await readSchedule()
  screen = await readScreen()
  fixture = snapshotProcessParcel(schedule, screen)
  console.log(JSON.stringify({ screen, scheduleId: fixture.scheduleId, status: fixture.status, usableCount: fixture.usableCount, selectRoute: selected.productVerdict }, null, 2))
  if (!fixture.scheduleId) {
    console.error(`select-route fixture ${selected.productVerdict} and no schedule on device`)
    process.exit(5)
  }
}

if (!fixture.deliveryReady && screen.fragment === 'TaskListFragment' && schedule.status === 0) {
  console.log('\n=== BeginningOfDay on task list — BACK to stop list (measured) ===')
  pressBack()
  await new Promise((resolve) => setTimeout(resolve, 1500))
  schedule = await readSchedule()
  screen = await readScreen()
  fixture = snapshotProcessParcel(schedule, screen)
}

if (!fixture.deliveryReady && fixture.approved && fixture.singletonCount < 2) {
  console.log('\n=== approved tour has no singleton stop — RejectLeavingPermission teardown to BeginningOfDay ===')
  const rejected = await rejectLeavingPermission({ scheduleId: fixture.scheduleId })
  provisionLog.push({ op: 'reject-leaving-permission', status: rejected.status, resultCode: rejected.body?.resultCode })
  await new Promise((resolve) => setTimeout(resolve, 2000))
  dismissNotificationList()
  const settled = await settleDevice('bd6-singleton-reset')
  provisionLog.push({ op: 'settle-after-reject', gates: settled.snapshot?.gates, status: settled.snapshot?.schedule?.status })
  schedule = await readSchedule()
  screen = await readScreen()
  fixture = snapshotProcessParcel(schedule, screen)
  console.log(JSON.stringify({ status: fixture.status, fragment: fixture.fragment, singletonCount: fixture.singletonCount }, null, 2))
}

let provisionAttempts = 0
while (
  !fixture.deliveryReady &&
  preferredSingletonCount(fixture, provisionLog) < 2 &&
  (screen.fragment === 'StopListFragment' || screen.fragment === 'TaskListFragment')
) {
  provisionAttempts += 1
  if (provisionAttempts > 4) {
    console.error(`singleton-stop provision stalled after 4 creates (singletonCount=${fixture.singletonCount})`)
    process.exit(5)
  }
  console.log(`\n=== provision singleton-stop parcel (${fixture.singletonCount}/2, attempt ${provisionAttempts}) ===`)
  try {
    const extra = await provisionSecondParcel()
    provisionLog.push(extra)
    schedule = await readSchedule()
    screen = await readScreen()
    fixture = snapshotProcessParcel(schedule, screen)
    const landed = fixture.parcels.some((parcel) => parcel.scanPayload === extra.shipment?.scanValue)
    if (!landed && extra.loaded?.productVerdict && extra.loaded.productVerdict !== 'PASS_ONLINE') {
      console.error(`load-to-vehicle ${extra.loaded.productVerdict}`)
      process.exit(5)
    }
    console.log(JSON.stringify({
      shipmentId: extra.shipment?.shipmentId,
      scanValue: extra.shipment?.scanValue,
      load: extra.loaded?.productVerdict,
      singletonCount: fixture.singletonCount,
      preferredCount: preferredSingletonCount(fixture, provisionLog),
      usableCount: fixture.usableCount,
    }, null, 2))
  } catch (error) {
    provisionLog.push({ error: error instanceof Error ? error.message : String(error) })
    console.error(`parcel provision failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(5)
  }
}

if (!fixture.deliveryReady && !fixture.ready) {
  console.log('\n=== approve tour + open-stop (fixture only) ===')
  const prepared = await prepareApprovedTaskList(schedule.scheduleId, provisionLog)
  provisionLog.push(prepared)
  if (!prepared.ok) {
    console.error(`delivery fixture not ready — ${prepared.reason ?? 'Approved + TaskListFragment required before opening delivery'}`)
    process.exit(5)
  }
  fixture = prepared.fixture ?? snapshotProcessParcel(await readSchedule(), await readScreen())
}

if (!fixture.deliveryReady && fixture.ready) {
  console.log('\n=== process-parcel fixture to open delivery (not BD.6 measurement) ===')
  const opener =
    pickProvisionedSingleton(fixture.singleton, provisionLog) ??
    fixture.singleton[0] ??
    fixture.usable[0] ??
    fixture.parcels[0]
  const opened = await runWorkflow('nesy.workflow.process-parcel', 'nesy.launch.reuse-session', {
    scanPayload: opener.scanPayload,
    taskCode: opener.taskId,
    sessionCorrelationId: `g90-10-bd6-fixture-open-delivery-${Date.now()}`,
  })
  provisionLog.push({ op: 'process-parcel-open-delivery', ...opened })
  schedule = await readSchedule()
  screen = await readScreen()
  fixture = snapshotProcessParcel(schedule, screen)
}

if (!fixture.deliveryReady) {
  console.error('complete-delivery fixture not ready — Approved + DeliveryFragment + consignment required')
  process.exit(5)
}

const resumeBaseline = process.env.VERDICT_BD6_BASELINE_RUN?.trim() || ''
const consumedScan = process.env.VERDICT_BD6_BASELINE_SCAN?.trim() || ''
const baselineParcel =
  fixture.singleton.find((parcel) => parcel.scanPayload === consumedScan) ??
  pickProvisionedSingleton(fixture.singleton, provisionLog) ??
  fixture.singleton[0] ??
  fixture.usable[0] ??
  fixture.parcels[0]
const injectedParcel =
  pickProvisionedSingleton(fixture.singleton, provisionLog, consumedScan || baselineParcel?.scanPayload) ??
  fixture.singleton.find((parcel) => parcel.scanPayload && parcel.scanPayload !== (consumedScan || baselineParcel?.scanPayload)) ??
  null

console.log('\n=== complete-delivery uninjected twin ===')
const baseline = resumeBaseline
  ? await (async () => {
      const detail = (await req('GET', `/verdict/runtime/runs/${encodeURIComponent(resumeBaseline)}`)).body
      const facts = factsOf(detail)
      return {
        start: {
          runId: resumeBaseline,
          injectedFault: detail.runtime?.injectedFault ?? null,
          expectedClass: detail.runtime?.expectedClass ?? null,
        },
        axes: axesOf(detail, { runId: resumeBaseline }),
        facts,
        queueFact: queueFact(facts, resumeBaseline),
        remoteSuccess: remoteSuccessFacts(facts),
        steps: (detail.steps ?? []).map((step) => ({
          planStepId: step.plan_step_id ?? step.planStepId ?? null,
          actionResult: step.action_result ?? step.actionResult ?? null,
          continueGate: step.continue_gate_result ?? step.continueGateResult ?? null,
          oracle: step.final_oracle_result ?? step.finalOracleResult ?? null,
        })),
        resumed: true,
      }
    })()
  : await runCompleteDelivery('baseline', pack, compiled, baselineParcel, null)
const baselineRadios = restoreRadios()
const baselineJudge = judgeBaseline(baseline, baselineRadios)
console.log(JSON.stringify({ start: baseline.start, axes: baseline.axes, queueFact: baseline.queueFact, remoteSuccess: baseline.remoteSuccess, steps: baseline.steps, judge: baselineJudge }, null, 2))
if (!baselineJudge.ok) {
  console.error('complete-delivery uninjected twin FAILED')
  process.exit(3)
}

console.log('\n=== BD.6 restore (known delivery start; not Host B reject; not G4 flush) ===')
const restored = await restoreToTaskList()
console.log(JSON.stringify({ ok: restored.ok, reason: restored.reason, actions: restored.actions, screen: restored.screen }, null, 2))
schedule = restored.schedule ?? (await readSchedule())
fixture = snapshotProcessParcel(schedule, restored.screen ?? (await readScreen()))

let injectedTarget =
  injectedParcel ??
  fixture.singleton.find((parcel) => parcel.scanPayload && parcel.scanPayload !== baselineParcel.scanPayload) ??
  null
if (!injectedTarget) {
  console.log('\n=== provision injected parcel after uninjected consume ===')
  try {
    const second = await provisionSecondParcel()
    provisionLog.push(second)
    schedule = await readSchedule()
    const landed = (schedule.parcels ?? []).some((parcel) => parcel.scanPayload === second.shipment?.scanValue)
    if (!landed && second.loaded.productVerdict !== 'PASS_ONLINE') {
      console.error('second load-to-vehicle did not PASS_ONLINE')
      process.exit(5)
    }
    injectedTarget =
      pickProvisionedSingleton(singletonUsable(schedule.parcels ?? []), provisionLog, baselineParcel.scanPayload) ??
      singletonUsable(schedule.parcels ?? []).find((parcel) => parcel.scanPayload !== baselineParcel.scanPayload) ??
      null
  } catch (error) {
    console.error(`second parcel provision failed: ${error instanceof Error ? error.message : String(error)}`)
    process.exit(5)
  }
}
if (!injectedTarget) {
  console.error('no distinct injected barcode after restore — refusing to reuse the uninjected consignment')
  process.exit(5)
}

console.log('\n=== process-parcel fixture to reopen delivery for injected consignment ===')
const reopen = await runWorkflow('nesy.workflow.process-parcel', 'nesy.launch.reuse-session', {
  scanPayload: injectedTarget.scanPayload,
  taskCode: injectedTarget.taskId,
  sessionCorrelationId: `g90-10-bd6-fixture-reopen-delivery-${Date.now()}`,
})
provisionLog.push({ op: 'process-parcel-reopen-delivery', ...reopen })
screen = await readScreen()
if (screen.fragment !== 'DeliveryFragment') {
  console.error(`reopen left device on ${screen.fragment} — complete-delivery needs DeliveryFragment`)
  process.exit(5)
}

console.log('\n=== complete-delivery BD.6 controlled device WAN cut ===')
const injected = await runCompleteDelivery('bd6', pack, compiled, injectedTarget, {
  injectedFault: 'OFFLINE_QUEUE',
  injectedFaultHost: 'B',
})
const injectedRadios = restoreRadios()
const leftoverQueue = await leftoverQueueIsolate()
const injectedJudge = judgeBd6(injected, injectedRadios)
const independence = await classifierIndependence(injected)
console.log(JSON.stringify({
  start: injected.start,
  axes: injected.axes,
  queueFact: injected.queueFact,
  remoteSuccess: injected.remoteSuccess,
  steps: injected.steps,
  judge: injectedJudge,
  independence,
  radios: injectedRadios,
  leftoverQueue,
}, null, 2))

const hostAmendNeeded =
  !injected.queueFact ||
  injected.axes.observedClass !== 'OFFLINE_QUEUED' ||
  injected.axes.productVerdict !== 'PASS_QUEUED_OFFLINE'

if (!injectedJudge.ok || !independence.ok) {
  const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')
  const out = join(REPO, 'docs/verdict/goals', `G90-10-bd6-live-smoke-${stamp}.json`)
  writeFileSync(
    out,
    JSON.stringify(
      {
        status: hostAmendNeeded ? 'LIVE_INJECTION_FAILED_HOST_AMEND_CANDIDATE' : 'LIVE_INJECTION_FAILED',
        closedAt: new Date().toISOString(),
        injectionModel: identity.injectionModel,
        identity,
        provisionLog,
        baseline: { axes: baseline.axes, start: baseline.start, judge: baselineJudge, queueFact: baseline.queueFact },
        bd6: { axes: injected.axes, start: injected.start, judge: injectedJudge, independence, queueFact: injected.queueFact, leftoverQueue },
        note:
          hostAmendNeeded
            ? 'complete-delivery did not persist/observe LOCAL.OFFLINE_QUEUE_ITEM_WAITING. Do not loosen observeInjectedClass. Re-measure the product offline-queue transaction.'
            : 'controlled device WAN cut representing BD.6 OFFLINE_QUEUE. G4 reconnect is not a bar. D60 campaign NOT_STARTED.',
      },
      null,
      2,
    ) + '\n',
  )
  console.error(`Host B BD.6 FAILED  ${out}`)
  process.exit(4)
}

const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')
const out = join(REPO, 'docs/verdict/goals', `G90-10-bd6-live-smoke-${stamp}.json`)
const report = {
  status: 'LIVE_QUALIFIED',
  closedAt: new Date().toISOString(),
  injectionModel: identity.injectionModel,
  identity,
  provisionLog,
  baseline: { axes: baseline.axes, start: baseline.start, judge: baselineJudge, queueFact: baseline.queueFact },
  bd6: { axes: injected.axes, start: injected.start, judge: injectedJudge, independence, queueFact: injected.queueFact, leftoverQueue },
  note: 'controlled device WAN cut representing BD.6 OFFLINE_QUEUE. Not airplane/USB. Not HOST_TRANSPORT_CUT. WAN restore is cleanup; G4 reconnect/flush is not a bar. D60 campaign NOT_STARTED.',
}
writeFileSync(out, JSON.stringify(report, null, 2) + '\n')
console.log(`\nG90.10 BD.6 LIVE_QUALIFIED  ${out}`)
