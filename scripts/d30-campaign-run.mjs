#!/usr/bin/env node
/**
 * D30 login campaign runner — 20-gate then optional 100-run.
 *
 * Watches the counters that stopped the last rerun:
 *   transactionTimeout, blockedTerminalPollingBug, cleanupMissing,
 *   orderedMissing, failureClassNoneOnNonPass
 *
 * After a non-pass the runner isolates the DUT (reset_state + start-state
 * verify). Recovery failure, or APP_NOT_READY after an infra primary, stops
 * the campaign so later rows are not counted as independent failures.
 *
 * Class axes (do not collapse):
 *   evaluationFailureClass  persisted eval axis (ENVIRONMENT_FAILURE, …)
 *   d30Class                RUN_PLAY §5 histogram (ENV_FAILURE, …)
 *
 * Preflight refuses next-dev / tsx-watch / dirty source / pack drift.
 *
 * Usage:
 *   node scripts/d30-campaign-run.mjs --phase 20
 *   node scripts/d30-campaign-run.mjs --phase 100
 *   node scripts/d30-campaign-run.mjs --phase 20 --continue-100
 */
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require_ = createRequire(import.meta.url)
const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const API = process.env.VERDICT_API ?? 'http://127.0.0.1:4001/api'
const DEVICE = process.env.VERDICT_DEVICE ?? 'R6CW400BC8N'
const APP_ID = process.env.VERDICT_APP_ID ?? 'com.arasdigital.nesymobile.rstest'
const PROFILE = 'nesy.launch.cold-real-login'
const VALID_PIN = process.env.VERDICT_VALID_PIN ?? '3680'
const INVALID_PIN = process.env.VERDICT_INVALID_PIN ?? '0000'
const TIMEOUT_SEC = Number(process.env.VERDICT_TIMEOUT ?? 180)
const TERMINAL = new Set(['completed', 'failed', 'cancelled', 'error', 'blocked'])

const RERUN_MANIFEST = join(REPO, 'docs/verdict/goals/D30-100-login-campaign-rerun-2026-08-15.json')
const OUT_DIR = join(REPO, 'docs/verdict/goals')
const PINNED_PACK = {
  key: 'nesy.courier',
  version: '1.30.0',
  digest: 'sha256:81b241227d3b9c720d97540e4820f0c21683142082d7b6e64ee3efd795a57ebb',
}
const PINNED_PLANS = {
  valid: {
    ref: 'bfp-nesy.reference.login-1',
    hash: 'sha256:0ee8c6f9339eb9374eafe0d1c04040fd5d480892479f9d5e1374ac0b72a950a1',
  },
  invalid: {
    ref: 'bfp-nesy.reference.login-rejected-1',
    hash: 'sha256:32064e1d6a1cb7b92da6529deb257fb070317e8690b34370a303adfb0b65d1d4',
  },
}
const GATE20_SEQUENCE = [
  'invalid',
  'valid',
  'valid',
  'valid',
  'valid',
  'invalid',
  'valid',
  'invalid',
  'invalid',
  'valid',
  'valid',
  'invalid',
  'invalid',
  'invalid',
  'valid',
  'invalid',
  'invalid',
  'invalid',
  'valid',
  'valid',
]
const CAMPAIGN_SEED = '90320260815-rerun-lcg'

function parseArgs(argv) {
  const opts = { phase: '20', continue100: false, resetFirst: true }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--phase') opts.phase = argv[++i]
    else if (arg === '--continue-100') opts.continue100 = true
    else if (arg === '--no-reset') opts.resetFirst = false
    else throw new Error(`unknown option: ${arg}`)
  }
  if (!['20', '100'].includes(opts.phase)) throw new Error('--phase 20|100')
  return opts
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

function adbPath() {
  if (process.env.ADB_PATH) return process.env.ADB_PATH
  try {
    const { resolveAdbPath } = require_(join(REPO, 'packages/platform-paths/dist/index.js'))
    return resolveAdbPath() ?? 'adb'
  } catch {
    return process.env.HOME
      ? join(process.env.HOME, 'Library/Android/sdk/platform-tools/adb')
      : 'adb'
  }
}

async function resetState() {
  const mod = await import(
    new URL('../packages/control-channels/dist/node-executor.js', import.meta.url).href
  )
  const exec = mod.createControlExecutor({ applicationId: APP_ID, forceChannel: 'verdict' })
  const res = await exec.run(DEVICE, {
    op: 'reset_state',
    requestId: `d30-reset-${Date.now()}`,
    scope: 'probe',
  })
  console.log(res.ok ? 'reset_state OK' : `reset_state HATA ${res.code} ${res.detail ?? ''}`)
  return res
}

async function verifyStartState() {
  const readiness = await req(
    'GET',
    `/verdict/runtime/devices/${encodeURIComponent(DEVICE)}/readiness?appId=${encodeURIComponent(APP_ID)}`,
  )
  const lanes = readiness.body.lanes ?? []
  const lane = (name) => lanes.find((item) => item.lane === name)
  const adb = lane('ADB')
  const bridge = lane('BRIDGE')
  const activeRun = lane('ACTIVE_RUN')
  const commandAdmission = lane('COMMAND_ADMISSION')
  const snapshot = {
    overall: readiness.body.overall ?? null,
    adb: adb?.status ?? null,
    bridge: bridge?.status ?? null,
    activeRun: activeRun?.status ?? null,
    commandAdmission: commandAdmission?.status ?? null,
  }
  const ok =
    snapshot.adb === 'UP' &&
    snapshot.bridge !== 'DOWN' &&
    snapshot.activeRun === 'UP' &&
    snapshot.commandAdmission !== 'BLOCKED'
  return { ok, ...snapshot }
}

function sh(cmd, args) {
  const res = spawnSync(cmd, args, { cwd: REPO, encoding: 'utf8' })
  return (res.stdout || '').trim()
}

function listenPids(port) {
  return sh('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t'])
    .split(/\s+/)
    .filter(Boolean)
}

function commandOf(pid) {
  return sh('ps', ['-p', String(pid), '-o', 'command=']).replace(/\s+/g, ' ')
}

function sourceTreeDirty() {
  return sh('git', ['status', '--porcelain', '--', 'apps', 'packages', 'scripts', 'domain-packs'])
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
    // Campaign preflight will report a missing DATABASE_URL separately.
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

function collectSourceIdentity(processSnap, pack, compiled) {
  return {
    gitCommit: sh('git', ['rev-parse', 'HEAD']),
    workingTreeClean: sourceTreeDirty().length === 0,
    packVersion: pack.version,
    packKey: pack.packKey,
    packDigest: pack.bundleDigest,
    compiledPlanId: {
      valid: compiled.valid.compiledPlanRef,
      invalid: compiled.invalid.compiledPlanRef,
    },
    compiledPlanHash: {
      valid: compiled.valid.compiledPlanHash,
      invalid: compiled.invalid.compiledPlanHash,
    },
    apiCommand: processSnap.apiCommand,
    apiPid: processSnap.apiPid,
    apiStarted: processSnap.apiStarted,
    webCommand: processSnap.webCommand,
    webPid: processSnap.webPid,
    bridgeVersion: '1',
    sdkVersion: '1',
    dbSchema: 'up-to-date',
    deviceId: DEVICE,
    campaignSeed: CAMPAIGN_SEED,
    apiStartupTimestamp: processSnap.apiStarted,
    apiInitialPid: processSnap.apiPid,
  }
}

function processSnapshot() {
  const apiPids = listenPids(4001)
  const webPids = listenPids(4002)
  const apiPid = apiPids[0] ?? null
  const webPid = webPids[0] ?? null
  const apiMeta = apiPid ? sh('ps', ['-p', apiPid, '-o', 'lstart=']).trim() : null
  return {
    apiPids,
    webPids,
    apiPid,
    webPid,
    apiCommand: apiPid ? commandOf(apiPid) : null,
    webCommand: webPid ? commandOf(webPid) : null,
    apiStarted: apiMeta,
  }
}

function preflightRuntime() {
  const snap = processSnapshot()
  const issues = []
  if (snap.apiPids.length !== 1) issues.push(`:4001 listener count ${snap.apiPids.length}`)
  if (snap.webPids.length !== 1) issues.push(`:4002 listener count ${snap.webPids.length}`)
  if (!snap.apiCommand || !/dist\/server\.js/.test(snap.apiCommand)) {
    issues.push(`:4001 command is not node dist/server.js (${snap.apiCommand ?? 'none'})`)
  }
  if (/tsx watch|src\/server\.ts/.test(snap.apiCommand ?? '')) {
    issues.push(':4001 is tsx watch / next-dev lineage')
  }
  if (!snap.webCommand || /next dev/.test(snap.webCommand)) {
    issues.push(`:4002 is not next start (${snap.webCommand ?? 'none'})`)
  }
  const dirty = sourceTreeDirty()
  if (dirty.length > 0) issues.push(`source tree dirty: ${dirty.join(' | ')}`)
  return { ok: issues.length === 0, issues, process: snap }
}

async function recoverIsolation() {
  const reset = await resetState()
  if (!reset.ok) {
    return { ok: false, reason: `reset_state ${reset.code} ${reset.detail ?? ''}`.trim() }
  }
  const start = await verifyStartState()
  if (!start.ok) {
    return { ok: false, reason: `start state not clean ${JSON.stringify(start)}` }
  }
  return { ok: true, start }
}

function isSecondaryContamination(row, primary) {
  if (!primary) return false
  const blockedDirty =
    row.status === 'blocked' &&
    (row.readinessClass === 'APP_NOT_READY' ||
      /APP_NOT_READY|UI_VISIBLE|StopListFragment/i.test(
        `${row.readinessClass ?? ''} ${row.failureClass ?? ''} ${row.error ?? ''}`,
      ))
  if (primary.persistenceUnavailable || primary.failureClass === 'ENVIRONMENT_FAILURE') {
    return row.status === 'blocked' || blockedDirty
  }
  return blockedDirty
}

const canonicalDigest = (d) => /^sha256:[a-f0-9]{64}$/i.test(String(d ?? '').trim())
const versionKey = (v) => String(v ?? '').split('.').map((p) => (/^\d+$/.test(p) ? Number(p) : -1))
function newerVersion(a, b) {
  const left = versionKey(a)
  const right = versionKey(b)
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const l = left[i] ?? -1
    const r = right[i] ?? -1
    if (l !== r) return l > r
  }
  return false
}

async function pinPack() {
  const packs = await req('GET', '/verdict/runtime/domain-packs')
  const published = (packs.body.items ?? []).filter(
    (p) => p.publicationState === 'PUBLISHED' && canonicalDigest(p.bundleDigest),
  )
  const compileReady = published.filter((p) => p.compileReady === true)
  const base = compileReady.length > 0 ? compileReady : published
  const preferred = base.filter((p) => p.packKey === 'nesy.courier')
  const candidates = preferred.length > 0 ? preferred : base
  let pack = null
  for (const candidate of candidates) {
    if (pack === null || newerVersion(candidate.version, pack.version)) pack = candidate
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
  if (!compiled.body.ok) {
    throw new Error(`compile failed ${workflowRef}: ${JSON.stringify(compiled.body.issues ?? compiled.body).slice(0, 500)}`)
  }
  return compiled.body
}

function countReceiptOrdered(detail) {
  const blob = JSON.stringify(detail)
  const receipt = (blob.match(/receipt-safe facts/g) ?? []).length > 0 || /"receipt"/i.test(blob)
  const ordered = /ordered/i.test(blob)
  const evals = detail.oracleEvaluations ?? []
  const receiptSafe = evals.filter((e) =>
    String(e.requirements?.reason ?? e.reason ?? '').includes('receipt-safe'),
  ).length
  const seen = new Set()
  let duplicateLogical = 0
  for (const item of evals) {
    const key = [
      item.factKey ?? item.requirementRef ?? item.id ?? '',
      item.occurrenceId ?? '',
      item.iterationKey ?? '',
      item.result ?? item.verdict ?? '',
    ].join('|')
    if (seen.has(key)) duplicateLogical += 1
    else seen.add(key)
  }
  return {
    receiptHint: receiptSafe > 0 || receipt ? 1 : 0,
    orderedHint: ordered ? 1 : 0,
    oracleEvaluations: evals.length,
    duplicateLogical,
  }
}

const D30_READINESS_CLASSES = new Set([
  'FORCE_STOP_NOT_CONFIRMED',
  'PROCESS_NOT_STARTED',
  'COLD_START_OS_SUSPEND',
  'APP_NOT_READY',
  'A11Y_SYNC_PENDING',
  'UI_NOT_ACTIONABLE',
  'SDK_NOT_READY',
  'AUTH_PENDING',
  'BACKEND_BOOTSTRAP_PENDING',
])

function toD30HistogramClass({ productVerdict, evaluationFailureClass, readinessClass }) {
  if (productVerdict === 'PASS_ONLINE' || productVerdict === 'PASS_QUEUED_OFFLINE') return 'PRODUCT_PASS'
  if (String(productVerdict ?? '').startsWith('FAIL_')) return 'PRODUCT_FAIL'
  if (evaluationFailureClass === 'ENVIRONMENT_FAILURE' || evaluationFailureClass === 'ENV_FAILURE') {
    return 'ENV_FAILURE'
  }
  if (evaluationFailureClass === 'EVIDENCE_INSUFFICIENT' || evaluationFailureClass === 'EVIDENCE_TIMEOUT') {
    return 'EVIDENCE_TIMEOUT'
  }
  if (readinessClass && D30_READINESS_CLASSES.has(readinessClass)) return readinessClass
  return 'UNCLASSIFIED'
}

function classify(scenario, detail, poll) {
  const run = detail.run ?? {}
  const verdict = run.product_verdict ?? run.productVerdict ?? null
  const failureClass = run.evaluation_failure_class ?? run.evaluationFailureClass ?? null
  const cleanup = run.cleanup_result ?? run.cleanupResult ?? null
  const status = String(run.status ?? '')
  const failureDetail = String(run.failure_detail ?? run.failureDetail ?? '')
  const passing = verdict === 'PASS_ONLINE' || verdict === 'PASS_QUEUED_OFFLINE'
  const evidence = countReceiptOrdered(detail)
  const readinessClass = run.readiness_class ?? run.readinessClass ?? null
  const classified =
    (failureClass !== null && failureClass !== 'NONE') ||
    (readinessClass !== null && String(readinessClass).trim() !== '')

  const transactionTimeout =
    /Transaction already closed|timeout for this transaction|expired transaction/i.test(failureDetail)
  const persistenceUnavailable =
    /Server has closed the connection|Can't reach database server|P1017|P1001|P2024|P2028|expired transaction/i.test(
      failureDetail,
    )
  const blockedTerminalPollingBug = poll.timedOut && status === 'blocked'
  const cleanupMissing =
    (status === 'completed' || passing || status === 'failed' || status === 'blocked') &&
    cleanup !== 'SUCCEEDED' &&
    cleanup !== 'FAILED' &&
    cleanup !== 'PARTIAL'
  const orderedMissing = passing && evidence.oracleEvaluations === 0
  const receiptMissing = passing && evidence.receiptHint === 0
  const failureClassNoneOnNonPass = !passing && !classified
  const lifecycle = run.lifecycle ?? null
  const readinessStatus = run.readiness_status ?? run.readinessStatus ?? null
  const productFail = /^FAIL_/.test(String(verdict ?? ''))
  const dbDisconnect = /Server has closed the connection|P1017/i.test(failureDetail)
  const emergencyReset =
    persistenceUnavailable ||
    /emergency reset|emergency-reset/i.test(failureDetail)
  const harnessAnomaly =
    transactionTimeout ||
    dbDisconnect ||
    persistenceUnavailable ||
    failureClassNoneOnNonPass ||
    cleanupMissing ||
    orderedMissing ||
    receiptMissing ||
    evidence.duplicateLogical > 0 ||
    poll.timedOut ||
    blockedTerminalPollingBug ||
    readinessStatus !== 'INTERACTION_READY' ||
    lifecycle !== 'CLOSED' ||
    status !== 'completed' ||
    cleanup !== 'SUCCEEDED'

  return {
    scenario,
    runId: run.run_id ?? run.id ?? poll.runId,
    status,
    lifecycle,
    productVerdict: verdict,
    evaluationFailureClass: failureClass,
    d30Class: toD30HistogramClass({
      productVerdict: verdict,
      evaluationFailureClass: failureClass,
      readinessClass,
    }),
    failureClass,
    termination: run.termination_reason ?? run.terminationReason ?? null,
    readinessStatus,
    readinessClass,
    cleanupResult: cleanup,
    pollTimedOut: poll.timedOut,
    pollSawBlocked: poll.sawBlocked,
    persistenceUnavailable,
    transactionTimeout,
    dbDisconnect,
    emergencyReset,
    blockedTerminalPollingBug,
    cleanupMissing,
    orderedMissing,
    receiptMissing,
    duplicateLogical: evidence.duplicateLogical,
    failureClassNoneOnNonPass,
    productFail,
    harnessAnomaly,
    receiptHint: evidence.receiptHint,
    orderedHint: evidence.orderedHint,
    ok: passing && !harnessAnomaly,
  }
}

async function startRun(pack, compiled, workflowRef, pin, corr) {
  spawnSync(adbPath(), ['-s', DEVICE, 'logcat', '-c'], { encoding: 'utf8', timeout: 10_000 })
  const started = await req('POST', '/verdict/runtime/runs', {
    workflowRef,
    deviceId: DEVICE,
    appId: APP_ID,
    compiledPlanRef: compiled.compiledPlanRef,
    compiledPlanHash: compiled.compiledPlanHash,
    domainPackKey: pack.packKey,
    domainPackVersion: pack.version,
    domainPackDigest: pack.bundleDigest,
    profileKey: PROFILE,
    inputs: { pin, sessionCorrelationId: corr },
  })
  const runId = started.body?.run?.runId ?? started.body?.runId
  if (!runId) {
    throw new Error(`start failed HTTP ${started.status}: ${JSON.stringify(started.body).slice(0, 800)}`)
  }
  return runId
}

async function pollRun(runId) {
  const deadline = Date.now() + TIMEOUT_SEC * 1000
  let detail = {}
  let lastLine = ''
  let sawBlocked = false
  while (Date.now() < deadline) {
    const polled = await req('GET', `/verdict/runtime/runs/${encodeURIComponent(runId)}`)
    detail = polled.body
    const run = detail.run ?? {}
    const status = String(run.status ?? '')
    if (status === 'blocked') sawBlocked = true
    const line = `status=${status} verdict=${run.product_verdict ?? '-'} cleanup=${run.cleanup_result ?? '-'}`
    if (line !== lastLine) {
      const elapsed = Math.round((TIMEOUT_SEC * 1000 - (deadline - Date.now())) / 1000)
      console.log(`  [${String(elapsed).padStart(3)}s] ${line}`)
      lastLine = line
    }
    if (TERMINAL.has(status)) {
      return { detail, timedOut: false, sawBlocked, runId }
    }
    await new Promise((r) => setTimeout(r, 2000))
  }
  return { detail, timedOut: true, sawBlocked, runId }
}

function emptyCounters() {
  return {
    transactionTimeout: 0,
    dbDisconnect: 0,
    blockedTerminalPollingBug: 0,
    cleanupMissing: 0,
    orderedMissing: 0,
    receiptMissing: 0,
    duplicateLogical: 0,
    failureClassNoneOnNonPass: 0,
    emergencyReset: 0,
    unexpectedInitialState: 0,
    pass: 0,
    fail: 0,
    productFail: 0,
    blocked: 0,
    pollTimeout: 0,
    primaryFailures: 0,
    secondaryContamination: 0,
    isolationRecoveryFailed: 0,
    interactionReady: 0,
    closed: 0,
    completed: 0,
    cleanupSucceeded: 0,
  }
}

function addCounters(counters, row) {
  if (row.transactionTimeout) counters.transactionTimeout++
  if (row.dbDisconnect) counters.dbDisconnect++
  if (row.blockedTerminalPollingBug) counters.blockedTerminalPollingBug++
  if (row.cleanupMissing) counters.cleanupMissing++
  if (row.orderedMissing) counters.orderedMissing++
  if (row.receiptMissing) counters.receiptMissing++
  if (row.duplicateLogical) counters.duplicateLogical++
  if (row.failureClassNoneOnNonPass) counters.failureClassNoneOnNonPass++
  if (row.emergencyReset) counters.emergencyReset++
  if (row.unexpectedInitialState) counters.unexpectedInitialState++
  if (row.ok) counters.pass++
  else if (row.productFail && !row.harnessAnomaly) counters.productFail++
  else counters.fail++
  if (row.status === 'blocked') counters.blocked++
  if (row.pollTimedOut) counters.pollTimeout++
  if (row.role === 'primary') counters.primaryFailures++
  if (row.role === 'secondary_contamination') counters.secondaryContamination++
  if (row.isolationRecovered === false) counters.isolationRecoveryFailed++
  if (row.readinessStatus === 'INTERACTION_READY') counters.interactionReady++
  if (row.lifecycle === 'CLOSED') counters.closed++
  if (row.status === 'completed') counters.completed++
  if (row.cleanupResult === 'SUCCEEDED') counters.cleanupSucceeded++
}

function countersClean(counters, expected) {
  return (
    counters.transactionTimeout === 0 &&
    counters.dbDisconnect === 0 &&
    counters.blockedTerminalPollingBug === 0 &&
    counters.cleanupMissing === 0 &&
    counters.orderedMissing === 0 &&
    counters.receiptMissing === 0 &&
    counters.duplicateLogical === 0 &&
    counters.failureClassNoneOnNonPass === 0 &&
    counters.emergencyReset === 0 &&
    counters.unexpectedInitialState === 0 &&
    counters.pollTimeout === 0 &&
    counters.fail === 0 &&
    counters.productFail === 0 &&
    counters.secondaryContamination === 0 &&
    counters.pass === expected &&
    counters.interactionReady === expected &&
    counters.closed === expected &&
    counters.completed === expected &&
    counters.cleanupSucceeded === expected
  )
}

function writeSummary(outSummary, payload) {
  writeFileSync(outSummary, JSON.stringify(payload, null, 2))
}

async function runSequence(label, sequence, pack, compiled, outJsonl, outSummary, identity) {
  const counters = emptyCounters()
  const rows = []
  let primaryFailure = null
  let isolationRecovered = true
  let stopReason = null
  mkdirSync(OUT_DIR, { recursive: true })
  writeFileSync(outJsonl, '')
  console.log(`\n===== ${label}  n=${sequence.length}  out=${outJsonl} =====`)

  for (let i = 0; i < sequence.length; i++) {
    const scenario = sequence[i]
    const workflowRef = scenario === 'valid' ? 'nesy.workflow.login' : 'nesy.workflow.login-rejected'
    const pin = scenario === 'valid' ? VALID_PIN : INVALID_PIN
    const corr = `d30-${label}-${Date.now()}-${i + 1}`
    console.log(`\n#${i + 1}/${sequence.length} ${scenario}  ${workflowRef}  pin=${pin === VALID_PIN ? 'valid' : 'invalid'}`)
    const startedAt = Date.now()
    let row
    try {
      const startState = await verifyStartState()
      const live = processSnapshot()
      if (!startState.ok) {
        row = {
          scenario,
          runId: null,
          status: 'unexpected_initial_state',
          productVerdict: null,
          evaluationFailureClass: null,
          d30Class: 'UNCLASSIFIED',
          failureClass: null,
          ok: false,
          unexpectedInitialState: true,
          harnessAnomaly: true,
          startState,
        }
      } else if (identity?.apiInitialPid && live.apiPid !== identity.apiInitialPid) {
        row = {
          scenario,
          runId: null,
          status: 'api_pid_changed',
          productVerdict: null,
          evaluationFailureClass: 'ENVIRONMENT_FAILURE',
          d30Class: 'ENV_FAILURE',
          failureClass: 'ENVIRONMENT_FAILURE',
          ok: false,
          harnessAnomaly: true,
          unexpectedInitialState: true,
          apiPid: live.apiPid,
        }
      } else {
        const runId = await startRun(pack, compiled[scenario], workflowRef, pin, corr)
        const poll = await pollRun(runId)
        row = classify(scenario, poll.detail, poll)
        row.startState = startState
        row.apiPid = live.apiPid
      }
    } catch (err) {
      row = {
        scenario,
        runId: null,
        status: 'runner_error',
        productVerdict: null,
        evaluationFailureClass: null,
        d30Class: 'UNCLASSIFIED',
        failureClass: null,
        ok: false,
        transactionTimeout: /transaction/i.test(String(err)),
        blockedTerminalPollingBug: false,
        cleanupMissing: true,
        orderedMissing: true,
        receiptMissing: true,
        failureClassNoneOnNonPass: true,
        harnessAnomaly: true,
        error: String(err).slice(0, 500),
      }
      console.error('  RUNNER ERROR', err)
    }
    row.index = i + 1
    row.wallMs = Date.now() - startedAt

    if (row.ok) {
      row.role = 'pass'
    } else if (row.productFail && !row.harnessAnomaly) {
      row.role = 'product_fail'
      stopReason = `product fail on #${i + 1} — evidence complete, not a harness anomaly`
    } else if (primaryFailure && (!isolationRecovered || isSecondaryContamination(row, primaryFailure))) {
      row.role = 'secondary_contamination'
      row.blastRadiusOf = primaryFailure.index
      stopReason = isolationRecovered
        ? `secondary contamination of primary #${primaryFailure.index}`
        : `dirty start after unrecovered primary #${primaryFailure.index}`
    } else {
      row.role = 'primary'
      primaryFailure = row
      console.log('  isolating DUT after primary failure')
      const isolation = await recoverIsolation()
      row.isolationRecovered = isolation.ok
      isolationRecovered = isolation.ok
      if (!isolation.ok) {
        row.isolationReason = isolation.reason
        stopReason = `isolation recovery failed after primary #${row.index}: ${isolation.reason}`
      }
    }

    rows.push(row)
    addCounters(counters, row)
    appendFileSync(outJsonl, JSON.stringify(row) + '\n')
    console.log(
      `  → ${row.runId ?? '-'}  verdict=${row.productVerdict}  cleanup=${row.cleanupResult}  class=${row.failureClass}  role=${row.role}  ok=${row.ok}`,
    )
    console.log(
      `  counters  txnTimeout=${counters.transactionTimeout}  blockedPollBug=${counters.blockedTerminalPollingBug}  cleanupMissing=${counters.cleanupMissing}  orderedMissing=${counters.orderedMissing}  noneOnNonPass=${counters.failureClassNoneOnNonPass}  pass=${counters.pass} fail=${counters.fail}  primary=${counters.primaryFailures} secondary=${counters.secondaryContamination}`,
    )
    writeSummary(outSummary, {
      label,
      updatedAt: new Date().toISOString(),
      completed: i + 1,
      total: sequence.length,
      stopReason,
      counters,
      last: row,
    })
    if (stopReason) {
      console.log(`  STOP  ${stopReason}`)
      break
    }
  }

  const clean = countersClean(counters, sequence.length) && stopReason === null
  writeSummary(outSummary, {
    label,
    finishedAt: new Date().toISOString(),
    completed: rows.length,
    total: sequence.length,
    clean,
    sourceIdentity: identity ?? null,
    stopReason,
    primaryFailure: primaryFailure
      ? {
          index: primaryFailure.index,
          runId: primaryFailure.runId,
          evaluationFailureClass: primaryFailure.evaluationFailureClass ?? primaryFailure.failureClass,
          d30Class: primaryFailure.d30Class ?? null,
          failureClass: primaryFailure.failureClass,
          persistenceUnavailable: primaryFailure.persistenceUnavailable ?? false,
          isolationRecovered: primaryFailure.isolationRecovered ?? null,
        }
      : null,
    counters,
    rows: rows.map((r) => ({
      index: r.index,
      scenario: r.scenario,
      runId: r.runId,
      ok: r.ok,
      role: r.role ?? null,
      blastRadiusOf: r.blastRadiusOf ?? null,
      productVerdict: r.productVerdict,
      evaluationFailureClass: r.evaluationFailureClass ?? r.failureClass,
      d30Class: r.d30Class ?? null,
      failureClass: r.failureClass,
      cleanupResult: r.cleanupResult,
      status: r.status,
    })),
  })
  console.log(`\n===== ${label} DONE  clean=${clean}  stop=${stopReason ?? 'none'}  ${JSON.stringify(counters)} =====`)
  return { clean, counters, rows, stopReason }
}

const opts = parseArgs(process.argv.slice(2))
const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')

console.log(`D30 campaign  phase=${opts.phase}  device=${DEVICE}`)
const runtime = preflightRuntime()
console.log(`preflight runtime ${runtime.ok ? 'OK' : 'FAIL'} apiPid=${runtime.process.apiPid} webPid=${runtime.process.webPid}`)
if (!runtime.ok) {
  for (const issue of runtime.issues) console.error(`  ${issue}`)
  process.exit(2)
}
const schema = schemaStatus()
if (!schema.ok) {
  console.error('preflight DB schema is not current')
  console.error(schema.text)
  process.exit(2)
}

const healthOk = await fetch('http://127.0.0.1:4001/health')
  .then((res) => res.ok)
  .catch(() => false)
if (!healthOk) {
  console.error('preflight API health failed')
  process.exit(2)
}

const readiness = await req(
  'GET',
  `/verdict/runtime/devices/${encodeURIComponent(DEVICE)}/readiness?appId=${encodeURIComponent(APP_ID)}`,
)
console.log(`readiness overall=${readiness.body.overall ?? '?'}`)
for (const lane of readiness.body.lanes ?? []) {
  if (lane.status !== 'UP') console.log(`  ${lane.lane}=${lane.status}`)
}

if (opts.resetFirst) {
  console.log('\npre-campaign reset_state')
  await resetState()
}

const pack = await pinPack()
if (pack.packKey !== PINNED_PACK.key || pack.version !== PINNED_PACK.version || pack.bundleDigest !== PINNED_PACK.digest) {
  console.error(`preflight pack drift ${pack.packKey}@${pack.version} ${pack.bundleDigest}`)
  process.exit(2)
}
console.log(`pack ${pack.packKey}@${pack.version} ${pack.bundleDigest.slice(0, 24)}…`)
const compiled = {
  valid: await compileWorkflow(pack, 'nesy.workflow.login'),
  invalid: await compileWorkflow(pack, 'nesy.workflow.login-rejected'),
}
for (const kind of ['valid', 'invalid']) {
  if (
    compiled[kind].compiledPlanRef !== PINNED_PLANS[kind].ref ||
    compiled[kind].compiledPlanHash !== PINNED_PLANS[kind].hash
  ) {
    console.error(
      `preflight compiled ${kind} drift ${compiled[kind].compiledPlanRef} ${compiled[kind].compiledPlanHash}`,
    )
    process.exit(2)
  }
}
console.log(`compiled valid=${compiled.valid.compiledPlanRef} invalid=${compiled.invalid.compiledPlanRef}`)

const identity = collectSourceIdentity(runtime.process, pack, compiled)
console.log(`source ${identity.gitCommit} clean=${identity.workingTreeClean} apiPid=${identity.apiInitialPid}`)

if (opts.phase === '20') {
  const result = await runSequence(
    'gate20',
    GATE20_SEQUENCE,
    pack,
    compiled,
    join(OUT_DIR, `D30-20-gate-${stamp}.jsonl`),
    join(OUT_DIR, `D30-20-gate-${stamp}.summary.json`),
    identity,
  )
  if (opts.continue100 && result.clean) {
    console.log('\n20-gate clean — starting 100-run from rerun manifest')
    const manifest = JSON.parse(readFileSync(RERUN_MANIFEST, 'utf8'))
    const hundred = await runSequence(
      'rerun100',
      manifest.sequence,
      pack,
      compiled,
      join(OUT_DIR, `D30-100-rerun-${stamp}.jsonl`),
      join(OUT_DIR, `D30-100-rerun-${stamp}.summary.json`),
      identity,
    )
    process.exit(hundred.clean ? 0 : 1)
  } else if (opts.continue100 && !result.clean) {
    console.log('\n20-gate NOT clean — 100-run will not start')
    process.exit(result.stopReason?.includes('product fail') ? 3 : 2)
  }
  process.exit(result.clean ? 0 : 1)
}

const manifest = JSON.parse(readFileSync(RERUN_MANIFEST, 'utf8'))
const result = await runSequence(
  'rerun100',
  manifest.sequence,
  pack,
  compiled,
  join(OUT_DIR, `D30-100-rerun-${stamp}.jsonl`),
  join(OUT_DIR, `D30-100-rerun-${stamp}.summary.json`),
  identity,
)
process.exit(result.clean ? 0 : 1)
