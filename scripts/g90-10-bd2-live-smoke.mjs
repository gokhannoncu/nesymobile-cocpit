#!/usr/bin/env node
/**
 * G90.10 BD.2 live qualification — Host B tour-approval.
 *
 * Initial host is tour-approval / approve-tour-request (RUN_PLAY §17).
 * complete-delivery remotes are READ_ONLY. process-parcel is reserved for BD.6.
 * Host A PIN first qualification is closed.
 *
 *   0  refuse closed PIDs / tsx / dirty apps+packages
 *   1  uninjected Host B baseline
 *   2  injected Host B BD.2 (controlled host-side transport cut)
 *
 * Not a D60 campaign. Not an airplane/USB claim. G4 reconnect is not a bar.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { restoreFixture, settleDevice, snapshotFixture } from './g90-10-host-b-fixture.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const API = process.env.VERDICT_API ?? 'http://127.0.0.1:4001/api'
const DEVICE = process.env.VERDICT_DEVICE ?? 'R6CW400BC8N'
const APP_ID = process.env.VERDICT_APP_ID ?? 'com.arasdigital.nesymobile.rstest'
const WORKFLOW = 'nesy.workflow.tour-approval-lifecycle'
const PROFILE = 'nesy.launch.reuse-session'
const ROUTE = process.env.VERDICT_ROUTE_CODE ?? '31'
const SCHEDULE = process.env.VERDICT_SCHEDULE_ID ?? ''
const TIMEOUT_SEC = Number(process.env.VERDICT_TIMEOUT ?? 240)
const CLOSED_PIDS = new Set(['55798', '21508', '29171', '38870'])
const CLOSED_COMMITS = new Set(['3770d2a', '291553b'])

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

function pickScheduleId(input) {
  const scheduleId = input?.scheduleId ?? input?.schedule_id
  const routeCode = input?.routeCode ?? input?.route_code
  if (typeof scheduleId !== 'string' || scheduleId.trim() === '') return null
  if (routeCode !== undefined && String(routeCode) !== ROUTE) return null
  return scheduleId.trim()
}

async function resolveScheduleId() {
  if (SCHEDULE.trim() !== '') return { scheduleId: SCHEDULE.trim(), source: 'VERDICT_SCHEDULE_ID' }

  const web = process.env.VERDICT_WEB ?? 'http://127.0.0.1:4002'
  try {
    const snapshot = await fetch(`${web}/api/adb/schedule?serial=${encodeURIComponent(DEVICE)}`)
    if (snapshot.ok) {
      const body = await snapshot.json()
      const fromDevice = body?.schedule?.scheduleId
      if (typeof fromDevice === 'string' && fromDevice.trim() !== '') {
        return { scheduleId: fromDevice.trim(), source: 'device-room' }
      }
    }
  } catch {
    // fall through to run history
  }

  const history = await req('GET', '/verdict/runtime/runs?limit=40')
  for (const item of history.body.items ?? []) {
    const runId = item.correlation?.runId ?? item.run?.id ?? item.run?.runId
    if (!runId) continue
    const detail = await req('GET', `/verdict/runtime/runs/${encodeURIComponent(runId)}`)
    const found = pickScheduleId(detail.body.run?.runInput ?? detail.body.run?.run_input ?? {})
    if (found) return { scheduleId: found, source: `run-history:${runId}` }
  }
  throw new Error(
    'Host B tour-approval needs scheduleId. Set VERDICT_SCHEDULE_ID, select route 31, or leave a schedule on the DUT.',
  )
}

async function runHostB(label, pack, compiled, scheduleId, fault) {
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
      routeCode: ROUTE,
      scheduleId,
      sessionCorrelationId: `g90-10-bd2-${label}-${Date.now()}`,
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
  return { start, axes: axesOf(detail, start) }
}

function isolationOf(row) {
  const failures = []
  const successPathCleanup =
    row.axes.cleanupResult === 'NOT_STARTED' &&
    row.axes.productVerdict === 'PASS_ONLINE' &&
    row.axes.resourceReleaseResult === 'RELEASED'
  if (row.axes.cleanupResult !== 'SUCCEEDED' && !successPathCleanup) {
    failures.push(`cleanup=${row.axes.cleanupResult}`)
  }
  if (row.axes.lifecycle !== 'CLOSED' && row.axes.status !== 'completed') {
    failures.push(`not closed (${row.axes.lifecycle}/${row.axes.status})`)
  }
  return { clean: failures.length === 0, failures }
}

function judgeBaseline(row) {
  const isolation = isolationOf(row)
  const failures = []
  if (row.axes.injectedFault != null) failures.push(`injectedFault=${row.axes.injectedFault}`)
  if (row.axes.observedClass != null) failures.push(`observedClass filled on uninjected (${row.axes.observedClass})`)
  const verdict = row.axes.productVerdict
  if (verdict !== 'PASS_ONLINE') failures.push(`expected business result PASS_ONLINE, got ${verdict}`)
  const cleanupOk =
    row.axes.cleanupResult === 'SUCCEEDED' ||
    (row.axes.cleanupResult === 'NOT_STARTED' &&
      verdict === 'PASS_ONLINE' &&
      row.axes.lifecycle === 'CLOSED' &&
      row.axes.resourceReleaseResult === 'RELEASED')
  if (!cleanupOk) failures.push(`cleanup=${row.axes.cleanupResult}`)
  if (!isolation.clean) failures.push(`isolation dirty: ${isolation.failures.join(', ')}`)
  return { ok: failures.length === 0, failures, expectedBusiness: verdict, isolation }
}

function judgeBd2(row) {
  const isolation = isolationOf(row)
  const failures = []
  const provenance = row.axes.faultProvenance ?? {}
  if (row.start.injectedFault !== 'NETWORK_DISCONNECT') failures.push(`start.injectedFault=${row.start.injectedFault}`)
  if (row.axes.injectedFault !== 'NETWORK_DISCONNECT') failures.push(`readback.injectedFault=${row.axes.injectedFault}`)
  if (row.axes.expectedClass !== 'NETWORK_PARTITION') failures.push(`expectedClass=${row.axes.expectedClass}`)
  if (row.axes.observedClass !== 'NETWORK_PARTITION') failures.push(`observedClass=${row.axes.observedClass}`)
  if (row.axes.productVerdict === 'FAIL_PRODUCT' || String(row.axes.productVerdict ?? '').startsWith('FAIL_')) {
    failures.push(`PRODUCT_FAIL ${row.axes.productVerdict}`)
  }
  if (row.axes.cleanupResult !== 'SUCCEEDED') failures.push(`cleanup=${row.axes.cleanupResult}`)
  if (provenance.phase !== 'EFFECT_OBSERVED') failures.push(`provenance.phase=${provenance.phase}`)
  if (provenance.actuallyFired !== true) failures.push(`actuallyFired=${provenance.actuallyFired}`)
  if (provenance.abortKind !== 'TRANSPORT') failures.push(`abortKind=${provenance.abortKind}`)
  if (provenance.effectKind !== 'HOST_TRANSPORT_CUT') failures.push(`effectKind=${provenance.effectKind}`)
  const chain = [provenance.requestedAtMs, provenance.armedAtMs, provenance.triggeredAtMs, provenance.effectObservedAtMs]
  if (chain.some((item) => item == null)) failures.push(`provenance timestamps incomplete ${JSON.stringify(chain)}`)
  if (!isolation.clean) failures.push(`isolation dirty: ${isolation.failures.join(', ')}`)
  return { ok: failures.length === 0, failures, provenance, isolation }
}

async function classifierIndependence(row) {
  const { observeInjectedClass } = await import(
    new URL('../packages/workflow-contract/dist/index.js', import.meta.url).href
  )
  const actionResult =
    row.axes.terminationReason === 'UNKNOWN_ACTION_EFFECT' || row.axes.productVerdict === 'INCONCLUSIVE'
      ? 'UNKNOWN_EFFECT'
      : null
  const recomputed = observeInjectedClass({
    actionResult,
    provenance: row.axes.faultProvenance ?? {},
  })
  const failures = []
  if (recomputed !== 'NETWORK_PARTITION') {
    failures.push(`classifier without injectedFault returned ${recomputed}`)
  }
  if (recomputed !== row.axes.observedClass) {
    failures.push(`recomputed ${recomputed} != persisted observedClass ${row.axes.observedClass}`)
  }
  return { ok: failures.length === 0, failures, recomputed, usedInjectedFault: false }
}

const processSnap = processSnapshot()
const issues = []
if (!processSnap.apiCommand || !/dist\/server\.js/.test(processSnap.apiCommand)) {
  issues.push(`:4001 is not node dist/server.js (${processSnap.apiCommand ?? 'none'})`)
}
if (CLOSED_PIDS.has(String(processSnap.apiPid))) {
  issues.push(`PID ${processSnap.apiPid} is a closed or design-only lineage, not a BD.2 qualification PID`)
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
  issues.push(`HEAD ${headShort} is a closed G90.9/BD.3 reference commit`)
}
if (issues.length > 0) {
  console.error('G90.10 BD.2 preflight failed:')
  for (const issue of issues) console.error(`  ${issue}`)
  process.exit(2)
}

const schema = schemaStatus()
const identity = {
  gitCommit: head,
  gitCommitShort: headShort,
  workingTreeClean: sourceDirty(['apps', 'packages', 'scripts', 'domain-packs']).length === 0,
  g90_10ImplementationClean: codeDirty.length === 0,
  runnerDirty: sourceDirty(['scripts/g90-10-bd2-live-smoke.mjs']).length > 0,
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
  injectionModel: 'controlled host-side transport cut representing BD.2 NETWORK_DISCONNECT',
  closedLineages: {
    g90_9: { gitCommit: '3770d2a', apiPid: 55798 },
    bd3: { gitCommit: '291553b', apiPid: 29171, note: 'BD.3 LIVE_QUALIFIED historical proof' },
    designRuntime: { apiPid: 38870, note: 'pre-BD.2 design runtime; not a qualification PID' },
  },
}

console.log('G90.10 BD.2 identity')
console.log(JSON.stringify(identity, null, 2))

const pack = await pinPack()
identity.packVersion = pack.version
identity.packKey = pack.packKey
identity.packDigest = pack.bundleDigest
const compiled = await compileWorkflow(pack, WORKFLOW)
identity.compiledPlanRef = compiled.compiledPlanRef
identity.compiledPlanHash = compiled.compiledPlanHash
const resolvedSchedule = await resolveScheduleId()
identity.routeCode = ROUTE
identity.scheduleId = resolvedSchedule.scheduleId
identity.scheduleIdSource = resolvedSchedule.source
const scheduleId = resolvedSchedule.scheduleId

console.log('\n=== Host B fixture gates ===')
const fixtureBefore = await snapshotFixture()
console.log(JSON.stringify({ ready: fixtureBefore.ready, gates: fixtureBefore.gates, schedule: fixtureBefore.schedule, ui: fixtureBefore.ui }, null, 2))
if (!fixtureBefore.ready) {
  console.error('Host B fixture not ready — refusing to start the workflow. Provision with scripts/g90-10-host-b-fixture.mjs')
  process.exit(5)
}

console.log('\n=== Host B uninjected baseline ===')
const baseline = await runHostB('baseline', pack, compiled, scheduleId, null)
const baselineJudge = judgeBaseline(baseline)
console.log(JSON.stringify({ start: baseline.start, axes: baseline.axes, judge: baselineJudge }, null, 2))
if (!baselineJudge.ok) {
  console.error('Host B uninjected baseline FAILED')
  process.exit(3)
}

console.log('\n=== Restore Host B starting state (RejectLeavingPermission if needed) ===')
const restored = await restoreFixture()
console.log(JSON.stringify({ ok: restored.ok, failures: restored.failures, after: restored.after?.gates ?? restored.after, rejectStatus: restored.reject?.status ?? null }, null, 2))
if (!restored.ok) {
  console.error('Host B fixture restore failed — BD.2 not started. Same starting state is required for the injected run.')
  process.exit(5)
}

console.log('\n=== Host B BD.2 controlled host-side transport cut ===')
const injected = await runHostB('bd2', pack, compiled, scheduleId, {
  injectedFault: 'NETWORK_DISCONNECT',
  injectedFaultHost: 'B',
})
const injectedJudge = judgeBd2(injected)
const independence = await classifierIndependence(injected)
console.log(JSON.stringify({ start: injected.start, axes: injected.axes, judge: injectedJudge, independence }, null, 2))
if (!injectedJudge.ok || !independence.ok) {
  console.error('Host B BD.2 FAILED')
  process.exit(4)
}

console.log('\n=== Post-cleanup fixture ===')
const immediate = await snapshotFixture()
console.log(JSON.stringify({ phase: 'immediate', ready: immediate.ready, gates: immediate.gates, schedule: immediate.schedule, ui: immediate.ui }, null, 2))
const settled = await settleDevice('post-cleanup')
console.log(JSON.stringify({
  phase: 'settled',
  actions: settled.actions,
  ready: settled.snapshot.ready,
  gates: settled.snapshot.gates,
  schedule: settled.snapshot.schedule,
  ui: settled.snapshot.ui,
}, null, 2))
if (
  !settled.snapshot.gates.beginningOfDay ||
  !settled.snapshot.gates.hasWork ||
  !settled.snapshot.ready
) {
  console.error('Post-cleanup fixture contaminated after settle — LIVE_QUALIFIED not claimed')
  process.exit(4)
}

const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')
const out = join(REPO, 'docs/verdict/goals', `G90-10-bd2-live-smoke-${stamp}.json`)
const report = {
  status: 'LIVE_QUALIFIED',
  closedAt: new Date().toISOString(),
  injectionModel: identity.injectionModel,
  identity,
  baseline: { axes: baseline.axes, start: baseline.start, judge: baselineJudge },
  bd2: { axes: injected.axes, start: injected.start, judge: injectedJudge, independence },
  note: 'controlled host-side transport cut representing BD.2 NETWORK_DISCONNECT. Not airplane/USB. G4 reconnect is not a bar. D60 campaign NOT_STARTED.',
}
writeFileSync(out, JSON.stringify(report, null, 2) + '\n')
console.log(`\nG90.10 BD.2 LIVE_QUALIFIED  ${out}`)
