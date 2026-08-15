#!/usr/bin/env node
/**
 * G90.9 live qualification — two smokes on a fresh pnpm prod lineage.
 *
 *   A  uninjected login: injectedFault stays null, PASS_ONLINE, cleanup SUCCEEDED
 *   B  metadata only:    injectedFault=BACKEND_TIMEOUT persists; observedClass
 *                        is not copied from the input
 *
 * This is not BD.3 injector qualification and not a D60 campaign.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const API = process.env.VERDICT_API ?? 'http://127.0.0.1:4001/api'
const DEVICE = process.env.VERDICT_DEVICE ?? 'R6CW400BC8N'
const APP_ID = process.env.VERDICT_APP_ID ?? 'com.arasdigital.nesymobile.rstest'
const PROFILE = 'nesy.launch.cold-real-login'
const WORKFLOW = 'nesy.workflow.login'
const PIN = process.env.VERDICT_VALID_PIN ?? '3680'
const TIMEOUT_SEC = Number(process.env.VERDICT_TIMEOUT ?? 180)
const PINNED_COMMIT = '3770d2a'

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
  return {
    runId: run.id ?? run.runId ?? started?.runId ?? null,
    productVerdict: run.productVerdict ?? run.product_verdict ?? null,
    cleanupResult: runtime.cleanupResult ?? run.cleanupResult ?? run.cleanup_result ?? null,
    injectedFault: runtime.injectedFault ?? started?.injectedFault ?? null,
    expectedClass: runtime.expectedClass ?? started?.expectedClass ?? null,
    observedClass: runtime.observedClass ?? null,
    injectedFaultHost: runtime.injectedFaultHost ?? started?.injectedFaultHost ?? null,
    evaluationFailureClass: runtime.evaluationFailureClass ?? run.evaluationFailureClass ?? null,
    failureDetail: runtime.failureDetail ?? run.failureDetail ?? run.failure_detail ?? null,
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

async function compileLogin(pack) {
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

async function resetState() {
  const mod = await import(new URL('../packages/control-channels/dist/node-executor.js', import.meta.url).href)
  const exec = mod.createControlExecutor({ applicationId: APP_ID, forceChannel: 'verdict' })
  return exec.run(DEVICE, { op: 'reset_state', requestId: `g90-9-reset-${Date.now()}`, scope: 'probe' })
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

async function runSmoke(label, pack, compiled, fault) {
  const reset = await resetState()
  if (!reset.ok) throw new Error(`${label} reset_state failed ${reset.code} ${reset.detail ?? ''}`)
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
    inputs: { pin: PIN, sessionCorrelationId: `g90-9-${label}-${Date.now()}` },
    ...(fault === null
      ? {}
      : { injectedFault: fault.injectedFault, injectedFaultHost: fault.injectedFaultHost }),
  }
  const started = await req('POST', '/verdict/runtime/runs', startBody)
  const start = started.body
  const runId = start.run?.runId ?? start.runId
  if (!runId) throw new Error(`${label} start returned no runId ${JSON.stringify(start).slice(0, 800)}`)
  const detail = await pollRun(runId)
  return { start, axes: axesOf(detail, start), detail }
}

function judgeA(row) {
  const failures = []
  if (row.axes.injectedFault != null) failures.push(`injectedFault=${row.axes.injectedFault}`)
  if (row.axes.observedClass != null) failures.push(`observedClass filled on uninjected (${row.axes.observedClass})`)
  if (row.axes.productVerdict !== 'PASS_ONLINE') failures.push(`productVerdict=${row.axes.productVerdict}`)
  if (row.axes.cleanupResult !== 'SUCCEEDED') failures.push(`cleanup=${row.axes.cleanupResult}`)
  return { ok: failures.length === 0, failures }
}

function judgeB(row) {
  const failures = []
  if (row.start.injectedFault !== 'BACKEND_TIMEOUT') {
    failures.push(`start.injectedFault=${row.start.injectedFault}`)
  }
  if (row.axes.injectedFault !== 'BACKEND_TIMEOUT') {
    failures.push(`readback.injectedFault=${row.axes.injectedFault}`)
  }
  if (row.axes.expectedClass !== 'BACKEND_TIMEOUT') {
    failures.push(`expectedClass=${row.axes.expectedClass}`)
  }
  if (row.axes.observedClass === 'BACKEND_TIMEOUT') {
    failures.push('observedClass was copied from injectedFault')
  }
  if (row.axes.observedClass != null) {
    failures.push(`observedClass should stay null until a classifier writes it (${row.axes.observedClass})`)
  }
  return { ok: failures.length === 0, failures }
}

const processSnap = processSnapshot()
const issues = []
if (!processSnap.apiCommand || !/dist\/server\.js/.test(processSnap.apiCommand)) {
  issues.push(`:4001 is not node dist/server.js (${processSnap.apiCommand ?? 'none'})`)
}
if (/tsx watch|src\/server\.ts/.test(processSnap.apiCommand ?? '')) {
  issues.push(':4001 is the D30-incompatible tsx/dev lineage')
}
if (!processSnap.webCommand || /next dev/.test(processSnap.webCommand)) {
  issues.push(`:4002 is not next start (${processSnap.webCommand ?? 'none'})`)
}
const codeDirty = sourceDirty(['apps', 'packages', 'domain-packs'])
if (codeDirty.length > 0) issues.push(`G90.9 code dirty: ${codeDirty.join(' | ')}`)
const head = sh('git', ['rev-parse', 'HEAD'])
const headShort = sh('git', ['rev-parse', '--short', 'HEAD'])
if (!head.startsWith(PINNED_COMMIT) && headShort !== PINNED_COMMIT) {
  issues.push(`HEAD ${headShort} is not pinned G90.9 commit ${PINNED_COMMIT}`)
}
if (issues.length > 0) {
  console.error('G90.9 smoke preflight failed:')
  for (const issue of issues) console.error(`  ${issue}`)
  process.exit(2)
}

const schema = schemaStatus()
const dbSchema = schema.ok ? 'up-to-date' : `unknown: ${schema.text}`

const identity = {
  gitCommit: head,
  gitCommitShort: headShort,
  workingTreeClean: sourceDirty(['apps', 'packages', 'scripts', 'domain-packs']).length === 0,
  g90_9ImplementationClean: codeDirty.length === 0,
  apiCommand: processSnap.apiCommand,
  apiPid: processSnap.apiPid,
  apiStartedAt: processSnap.apiStartedAt,
  webCommand: processSnap.webCommand,
  webPid: processSnap.webPid,
  dbSchema,
  deviceId: DEVICE,
}

console.log('G90.9 identity')
console.log(JSON.stringify(identity, null, 2))

const pack = await pinPack()
identity.packVersion = pack.version
identity.packKey = pack.packKey
identity.packDigest = pack.bundleDigest
const compiled = await compileLogin(pack)
identity.compiledPlanRef = compiled.compiledPlanRef
identity.compiledPlanHash = compiled.compiledPlanHash

console.log('\n=== Smoke A uninjected ===')
const smokeA = await runSmoke('A', pack, compiled, null)
const judgeAResult = judgeA(smokeA)
console.log(JSON.stringify({ start: smokeA.start, axes: smokeA.axes, judge: judgeAResult }, null, 2))
if (!judgeAResult.ok) {
  console.error('Smoke A FAILED')
  process.exit(3)
}

console.log('\n=== Smoke B injected metadata ===')
const smokeB = await runSmoke('B', pack, compiled, {
  injectedFault: 'BACKEND_TIMEOUT',
  injectedFaultHost: 'A',
})
const judgeBResult = judgeB(smokeB)
console.log(JSON.stringify({ start: smokeB.start, axes: smokeB.axes, judge: judgeBResult }, null, 2))
if (!judgeBResult.ok) {
  console.error('Smoke B FAILED')
  process.exit(4)
}

const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')
const out = join(REPO, 'docs/verdict/goals', `G90-9-live-smoke-${stamp}.json`)
const report = {
  status: 'LIVE_QUALIFIED',
  closedAt: new Date().toISOString(),
  identity,
  smokeA: { axes: smokeA.axes, start: smokeA.start, judge: judgeAResult },
  smokeB: { axes: smokeB.axes, start: smokeB.start, judge: judgeBResult },
  note: 'Metadata contract only. Not BD.3 injector qualification. D60 campaign NOT_STARTED.',
}
writeFileSync(out, JSON.stringify(report, null, 2) + '\n')
console.log(`\nG90.9 LIVE_QUALIFIED  ${out}`)
