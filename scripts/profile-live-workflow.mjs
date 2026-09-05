#!/usr/bin/env node
/**
 * Replay an existing hash-pinned run under opt-in profiling. No PIN/payload logs.
 * API must load live-run-profiler (server.ts does). Android Perfetto optional.
 * Run from repo root: node scripts/profile-live-workflow.mjs --baseline-run run_...
 */
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync, writeFileSync, existsSync, readFileSync, unlinkSync, chmodSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(join(root, 'apps/api/package.json'))
const args = process.argv.slice(2)
const arg = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback
const envFile = resolve(arg('--env-file', join(root, 'apps/api/.env')))
require('dotenv').config({ path: envFile, quiet: true })
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()
const baselineId = arg('--baseline-run')
if (!baselineId || !/^run_[a-zA-Z0-9-]+$/.test(baselineId)) throw new Error('--baseline-run required')
const api = arg('--api', 'http://localhost:4001/api/verdict/runtime')
const adb = arg('--adb', join(process.env.HOME, 'Library/Android/sdk/platform-tools/adb'))
const output = resolve(arg('--output', join(root, 'artifacts/live-profile', new Date().toISOString().replaceAll(':', '-'))))
const dbBranch = arg('--db-branch', 'unspecified')
const buildRef = arg('--build-ref', 'unspecified')
const armPath = process.env.VERDICT_LIVE_PROFILE_ARM ?? '/tmp/nesy-live-profile-arm.json'
const installed = JSON.parse(readFileSync('/tmp/nesy-live-profile-installed.json', 'utf8'))
const listeners = execFileSync('lsof', ['-t', '-iTCP:' + (new URL(api).port || '80'), '-sTCP:LISTEN'],
  { encoding: 'utf8' }).trim().split('\n')
if (!listeners.includes(String(installed.pid))) throw new Error('Listening API has not loaded profiler; restart API first')
mkdirSync(output, { recursive: true })
chmodSync(output, 0o700)
const save = (name, value) => writeFileSync(join(output, name), JSON.stringify(value, null, 2), { mode: 0o600 })
const get = async path => { const r = await fetch(api + path); if (!r.ok) throw new Error('GET ' + path + ': ' + r.status); return r.json() }
const select = (o, keys) => Object.fromEntries(keys.filter(k => o[k] !== undefined).map(k => [k, o[k]]))
const summarizeDatabaseUrl = raw => {
  if (!raw) return { configured: false }
  try {
    const url = new URL(raw)
    return {
      configured: true,
      protocol: url.protocol.replace(':', ''),
      host: url.hostname,
      port: url.port || '(default)',
      database: url.pathname.replace(/^\//, '') || '(none)',
      user: url.username ? 'set' : 'unset',
      password: url.password ? 'set' : 'unset',
    }
  } catch {
    return { configured: true, parse: 'failed', length: raw.length }
  }
}
let serial, perfettoPid, runId
const deviceTrace = '/data/misc/perfetto-traces/nesy-profile-' + randomUUID() + '.pftrace'
try {
  const baseline = await get('/runs/' + baselineId)
  const stored = await prisma.workflowRun.findUnique({ where: { id: baselineId }, select: {
    runInput: true, versionId: true, workflow: { select: { currentVersionId: true } },
  } })
  if (!stored || !stored.runInput) throw new Error('Baseline has no persisted inputs')
  if (stored.workflow.currentVersionId !== stored.versionId) throw new Error('Workflow version changed; select a matching baseline')
  serial = arg('--device', baseline.run.deviceId)
  if (execFileSync(adb, ['-s', serial, 'get-state'], { encoding: 'utf8' }).trim() !== 'device') throw new Error('USB device unavailable')
  const history = await get('/runs?limit=50')
  if (history.items.some(i => i.run.deviceId === serial && ['running', 'queued', 'pending'].includes(i.run.status))) {
    throw new Error('Another run owns or may acquire the device')
  }
  if (existsSync(armPath)) throw new Error('Profiler already armed')
  const request = {
    workflowRef: baseline.run.workflowSlug, deviceId: serial,
    compiledPlanRef: baseline.run.compiled_plan_ref, compiledPlanHash: baseline.run.compiled_plan_hash,
    domainPackKey: baseline.run.domain_pack_key, domainPackVersion: baseline.run.domain_pack_version,
    domainPackDigest: baseline.run.domain_pack_digest,
    profileKey: baseline.run.profile_snapshot?.profileKey ?? 'nesy.launch.cold-real-login',
    country: baseline.run.country, environment: baseline.run.environment,
    inputs: { ...stored.runInput, sessionCorrelationId: randomUUID() }, releaseGate: false,
  }
  save('capture.json', {
    baselineId, deviceId: serial, workflowRef: request.workflowRef,
    compiledPlanHash: request.compiledPlanHash, domainPackVersion: request.domainPackVersion,
    country: request.country, environment: request.environment, startedAt: new Date().toISOString(),
    inputKeys: Object.keys(request.inputs), payloadsCaptured: false, packageRebuilt: false,
    dbBranch, buildRef, envFile: envFile.replace(root, '<repo>'),
    database: summarizeDatabaseUrl(process.env.DATABASE_URL),
    profiling: 'host spans + callback-transaction queries + Android system trace',
  })
  try {
    const result = execFileSync(adb, ['-s', serial, 'shell', 'perfetto', '--background-wait',
      '-t', '10m', '-b', '32mb', '-s', '512mb', '-o', deviceTrace,
      'sched', 'freq', 'idle', 'am', 'wm', 'gfx', 'view', 'binder_driver'], { encoding: 'utf8', timeout: 35000 })
    const candidate = result.trim().split('\n').at(-1)?.trim()
    if (/^\d+$/.test(candidate ?? '')) perfettoPid = candidate
    save('android-trace-start.json', { active: !!perfettoPid, pid: perfettoPid, deviceTrace, startedAt: new Date().toISOString() })
  } catch { save('android-trace-start.json', { active: false, reason: 'Perfetto unavailable' }) }
  writeFileSync(armPath, JSON.stringify({ outputDir: output, deviceId: serial, workflowRef: request.workflowRef }), { mode: 0o600 })
  const response = await fetch(api + '/runs', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(request),
  })
  const started = await response.json()
  if (!response.ok || !started.runId) {
    save('start-failure.json', { status: response.status, detail: started.detail, result: started.status })
    throw new Error('Run start rejected; see start-failure.json')
  }
  runId = started.runId
  save('run-start.json', { ...select(started, ['runId', 'executionId', 'status']), output })
  console.log(JSON.stringify({ runId, output }))
  const dir = join(output, runId)
  let latestStep = '', lastProgress = 0
  const deadline = Date.now() + 15 * 60_000
  const captureStarted = Date.now()
  while (!existsSync(join(dir, 'complete.json'))) {
    if (Date.now() > deadline) throw new Error('Capture deadline reached; run was NOT automatically retried or cancelled')
    if (Date.now() - captureStarted > 40_000 && !existsSync(join(dir, 'manifest.json'))) {
      throw new Error('Host trace did not attach; run was NOT automatically retried or cancelled')
    }
    if (Date.now() - lastProgress > 15_000) {
      const eventsPath = join(dir, 'events.jsonl')
      if (existsSync(eventsPath)) {
        const lines = readFileSync(eventsPath, 'utf8').trim().split('\n')
        for (const line of lines.slice(-10).reverse()) {
          try { const e = JSON.parse(line); if (e.attrs.stepId) { latestStep = e.attrs.stepId; break } } catch {}
        }
        console.log(JSON.stringify({ runId, events: lines.length, latestStep }))
      } else if (Date.now() - lastProgress > 30_000 && !existsSync(armPath)) {
        console.log(JSON.stringify({ runId, waitingForTrace: true }))
      }
      lastProgress = Date.now()
    }
    await new Promise(r => setTimeout(r, 2000))
  }
  const detail = await get('/runs/' + runId)
  save('run-snapshot.json', {
    run: select(detail.run, ['id', 'status', 'product_verdict', 'evaluation_failure_class', 'termination_reason',
      'cleanup_result', 'operational_disposition', 'startedAt', 'completedAt', 'duration', 'readiness_status']),
    steps: detail.steps.map(s => select(s, ['plan_step_id', 'occurrence_id', 'started_at', 'completed_at',
      'action_result', 'continue_gate_result', 'final_oracle_result'])),
    remoteActions: detail.remoteActions.map(r => select(r, ['occurrence_id', 'operation_ref', 'status', 'started_at', 'completed_at'])),
    oracleEvaluations: detail.oracleEvaluations.map(o => select(o, ['occurrence_id', 'evaluator_kind', 'outcome', 'created_at', 'revision'])),
  })
  const telemetry = await get('/runs/' + runId + '/telemetry')
  save('telemetry-summary.json', { measurementState: telemetry.measurementState, summary: telemetry.summary,
    httpCalls: telemetry.httpCalls.map(h => select(h, ['atMs', 'method', 'host', 'path', 'status', 'durationMs'])) })
  console.log(JSON.stringify({ runId, status: detail.run.status, verdict: detail.run.product_verdict,
    durationMs: detail.run.duration, output }))
} finally {
  await prisma.$disconnect()
  if (existsSync(armPath)) {
    try { if (JSON.parse(readFileSync(armPath, 'utf8')).outputDir === output) unlinkSync(armPath) } catch {}
  }
  if (serial && perfettoPid) {
    try {
      try { execFileSync(adb, ['-s', serial, 'shell', 'kill', '-TERM', perfettoPid], { stdio: 'ignore' }) } catch {}
      await new Promise(r => setTimeout(r, 1500))
      execFileSync(adb, ['-s', serial, 'pull', deviceTrace, join(output, 'android.pftrace')], { stdio: 'ignore' })
      execFileSync(adb, ['-s', serial, 'shell', 'rm', deviceTrace], { stdio: 'ignore' })
    } catch { console.warn('Android trace export incomplete; host trace remains available') }
  }
}
