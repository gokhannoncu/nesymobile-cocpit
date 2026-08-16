#!/usr/bin/env node
/**
 * Prove LoginDashboard → SAME PID cache → verify adapter readback.
 *
 * Does not create a shipment. Does not inject OFFLINE_QUEUE.
 * LoginDashboard is called at most once (POST /nesy/auth/login).
 * Probe-equivalent cached-token read must not increment that count.
 *
 *   node scripts/g90-10-admin-auth-preflight.mjs
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const API = process.env.VERDICT_API ?? 'http://127.0.0.1:4001/api'
const HEALTH = (process.env.VERDICT_API_HEALTH ?? 'http://127.0.0.1:4001/health')

function sh(cmd, args) {
  return String(spawnSync(cmd, args, { cwd: REPO, encoding: 'utf8' }).stdout ?? '').trim()
}

function listenPid(port) {
  return sh('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t']).split(/\s+/).filter(Boolean)[0] ?? null
}

function commandOf(pid) {
  return pid ? sh('ps', ['-p', String(pid), '-o', 'command=']).replace(/\s+/g, ' ') : null
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

function stripToken(value) {
  if (!value || typeof value !== 'object') return value
  const { token: _token, ...rest } = value
  return rest
}

const apiPid = listenPid(4001)
const apiCommand = commandOf(apiPid)
const healthRes = await fetch(HEALTH, { signal: AbortSignal.timeout(5_000) }).catch((error) => error)
const healthOk = healthRes instanceof Response && healthRes.status === 200

const before = await cockpit('GET', '/nesy/auth/admin-cache?country=RS&environment=stage')
const login = await cockpit('POST', '/nesy/auth/login', { country: 'RS', environment: 'stage' })
const loginResult = login.body.result ?? {}
const loginResultCode = loginResult.resultCode ?? loginResult.ResultCode ?? null
const extracted = Boolean(loginResult.payload?.token || loginResult.payload?.Token)
const afterLogin = await cockpit('GET', '/nesy/auth/admin-cache?country=RS&environment=stage')
const cachedToken = await cockpit('GET', '/nesy/auth/cached-token?country=RS&environment=stage')
const afterCachedRead = await cockpit('GET', '/nesy/auth/admin-cache?country=RS&environment=stage')
const preflight = await cockpit('POST', '/nesy/auth/admin-preflight', { country: 'RS', environment: 'stage' })
const afterPreflight = await cockpit('GET', '/nesy/auth/admin-cache?country=RS&environment=stage')

const loginCalls = [
  before.body.loginDashboardCalls,
  afterLogin.body.loginDashboardCalls,
  afterCachedRead.body.loginDashboardCalls,
  afterPreflight.body.loginDashboardCalls,
]
const ready =
  healthOk &&
  login.status === 200 &&
  loginResultCode === 200 &&
  extracted &&
  afterLogin.body.present === true &&
  afterLogin.body.pid === Number(apiPid) &&
  afterLogin.body.tokenFingerprint &&
  cachedToken.status === 200 &&
  cachedToken.body.tokenFingerprint === afterLogin.body.tokenFingerprint &&
  afterCachedRead.body.loginDashboardCalls === afterLogin.body.loginDashboardCalls &&
  preflight.body.adapterReadback?.source === 'dashboard-admin-cache' &&
  preflight.body.adapterReadback?.matchesCache === true &&
  preflight.body.adapterReadback?.loginDashboardCallsAfter ===
    preflight.body.adapterReadback?.loginDashboardCallsBefore &&
  preflight.body.harmlessRead?.http === 200 &&
  preflight.body.harmlessRead?.resultCode === 200 &&
  afterPreflight.body.loginDashboardCalls === afterLogin.body.loginDashboardCalls &&
  afterLogin.body.loginDashboardCalls === (before.body.present ? before.body.loginDashboardCalls : 1)

const artifact = {
  kind: 'g90-10-admin-auth-preflight',
  notBd6Proof: true,
  noShipmentCreated: true,
  ready,
  code: ready ? 'ADMIN_AUTH_READY' : login.status !== 200 || !extracted ? 'ADMIN_AUTH_NOT_READY' : 'ADMIN_AUTH_HANDOFF_FAILED',
  runtime: {
    apiPid,
    apiCommand,
    health: healthOk ? 200 : healthRes instanceof Response ? healthRes.status : String(healthRes),
  },
  steps: {
    cacheBefore: stripToken(before.body),
    login: {
      http: login.status,
      resultCode: loginResultCode,
      extracted,
      fromCache: Boolean(before.body.present),
    },
    cacheAfterLogin: stripToken(afterLogin.body),
    cachedTokenRead: {
      http: cachedToken.status,
      code: cachedToken.body.code ?? null,
      tokenFingerprint: cachedToken.body.tokenFingerprint ?? null,
    },
    cacheAfterCachedRead: stripToken(afterCachedRead.body),
    adapterPreflight: {
      http: preflight.status,
      ready: preflight.body.ready ?? false,
      code: preflight.body.code ?? null,
      adapterReadback: preflight.body.adapterReadback ?? null,
      harmlessRead: preflight.body.harmlessRead ?? null,
    },
    cacheAfterPreflight: stripToken(afterPreflight.body),
    loginDashboardCalls: loginCalls,
  },
}

const outDir = join(REPO, 'docs/verdict/goals')
mkdirSync(outDir, { recursive: true })
const outPath = join(outDir, 'G90-10-admin-auth-preflight.json')
writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`)
console.log(JSON.stringify({ ready, code: artifact.code, outPath, apiPid, fingerprint: afterLogin.body.tokenFingerprint ?? null }, null, 2))
process.exit(ready ? 0 : 1)
