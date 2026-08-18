#!/usr/bin/env node
/**
 * Prove LoginDashboard → SAME PID cache → verify adapter readback.
 *
 * Does not create a shipment. Does not inject OFFLINE_QUEUE.
 * LoginDashboard is called at most once (POST /nesy/auth/login), and only
 * after an external captcha/400-clear signal:
 *
 *   VERDICT_ADMIN_AUTH_GO=1
 *   VERDICT_ADMIN_AUTH_GO_REASON='…'
 *
 * Peek / cached-token / admin-preflight never increment LoginDashboardCalls.
 * An empty cache after resultCode=400 is not GO.
 *
 *   node scripts/g90-10-admin-auth-preflight.mjs
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  AUTH_FREEZE_CODE,
  CLOSED_AUTH_PIDS,
  loginDashboardDecision,
  writeAuthFreezeArtifact,
} from './g90-10-admin-auth-freeze.mjs'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')
const API = process.env.VERDICT_API ?? 'http://127.0.0.1:4001/api'
const HEALTH = process.env.VERDICT_API_HEALTH ?? 'http://127.0.0.1:4001/health'

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
const decision = CLOSED_AUTH_PIDS.includes(String(apiPid))
  ? {
      allowed: false,
      code: AUTH_FREEZE_CODE,
      detail: `PID ${apiPid} already spent its LoginDashboard shot; start a new PID after an external clear.`,
    }
  : loginDashboardDecision(before.body)
const freeze = writeAuthFreezeArtifact({
  runtime: {
    apiPid,
    apiCommand,
    cachePresent: before.body.present === true,
    loginDashboardCalls: before.body.loginDashboardCalls ?? 0,
    tokenFingerprint: before.body.tokenFingerprint ?? null,
  },
  loginDecision: decision,
})

if (!decision.allowed && before.body.present !== true) {
  const artifact = {
    kind: 'g90-10-admin-auth-preflight',
    notBd6Proof: true,
    noShipmentCreated: true,
    ready: false,
    code: decision.code,
    detail: decision.detail,
    freezePath: freeze.outPath,
    runtime: { apiPid, apiCommand, health: healthOk ? 200 : String(healthRes) },
    steps: {
      cacheBefore: stripToken(before.body),
      login: { skipped: true, reason: decision.code },
    },
  }
  const outDir = join(REPO, 'docs/verdict/goals')
  mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, 'G90-10-admin-auth-preflight.json')
  writeFileSync(outPath, `${JSON.stringify(artifact, null, 2)}\n`)
  console.log(
    JSON.stringify(
      {
        ready: false,
        code: decision.code,
        outPath,
        freezePath: freeze.outPath,
        apiPid,
        loginDashboardCalls: before.body.loginDashboardCalls ?? 0,
      },
      null,
      2,
    ),
  )
  process.exit(decision.code === AUTH_FREEZE_CODE ? 3 : 1)
}

const login = decision.allowed
  ? await cockpit('POST', '/nesy/auth/login', { country: 'RS', environment: 'stage' })
  : { status: 200, body: { result: { resultCode: 200, tokenPresent: true, fromCache: true } } }
const loginResult = login.body.result ?? {}
const loginResultCode = loginResult.resultCode ?? loginResult.ResultCode ?? null
const extracted = before.body.present === true || loginResult.tokenPresent === true
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
const expectedCallsAfterLogin = before.body.present
  ? before.body.loginDashboardCalls
  : (before.body.loginDashboardCalls ?? 0) + 1
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
  afterLogin.body.loginDashboardCalls === expectedCallsAfterLogin

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
        login: decision.allowed
      ? {
          http: login.status,
          resultCode: loginResultCode,
          resultMessage:
            afterLogin.body.lastResultMessage ??
            login.body.result?.resultMessage ??
            login.body.result?.ResultMessage ??
            null,
          nextLoginRequiresCaptcha:
            afterLogin.body.nextLoginRequiresCaptcha ??
            login.body.result?.payload?.nextLoginRequiresCaptcha ??
            null,
          accountIsBlocked: afterLogin.body.accountIsBlocked ?? null,
          expirySource: afterLogin.body.expirySource ?? null,
          expiresAt: afterLogin.body.expiresAt ?? null,
          extracted,
          fromCache: Boolean(before.body.present),
        }
      : { skipped: true, reason: decision.code },
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
console.log(
  JSON.stringify(
    { ready, code: artifact.code, outPath, apiPid, fingerprint: afterLogin.body.tokenFingerprint ?? null },
    null,
    2,
  ),
)
process.exit(ready ? 0 : 1)
