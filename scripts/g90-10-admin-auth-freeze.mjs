/**
 * G90.10 admin-auth freeze after LoginDashboard resultCode=400.
 *
 * Last real auth signal was 400 on PID 8433. An empty cache on a later PID
 * is not evidence that captcha/400 cleared. Firing LoginDashboard to "see
 * if it opened" spends the one shot on that PID.
 *
 * GO is only:
 *   VERDICT_ADMIN_AUTH_GO=1
 *   VERDICT_ADMIN_AUTH_GO_REASON=<external clear signal>
 *
 * Reason must name the outside evidence (captcha reset/expiry, manual
 * dashboard login confirmed, other auth-health). The flag alone is not GO.
 *
 * Does not call LoginDashboard. Does not create a shipment. Not BD.6.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..')

export const AUTH_FREEZE_CODE = 'AUTH_EXTERNAL_SIGNAL_REQUIRED'
export const CLOSED_AUTH_PIDS = Object.freeze(['8433', '13440', '52684', '16953', '10060', '63409', '7371'])

export const FROZEN_AUTH_STATE = Object.freeze({
  kind: 'g90-10-admin-auth-freeze',
  verdict: 'NO_GO',
  notBd6Proof: true,
  commit: '1caf40f',
  eventualContract: 'LOCKED',
  deadlineMs: 120_000,
  flushGraceMs: 2_000,
  adapterTimeoutMs: 20_000,
  lastAuthSignal: {
    pid: 8433,
    resultCode: 400,
    independentCaptchaClear: false,
    note: 'PID 8433 later exit 137 was operational replacement, not ENV_FAILURE',
  },
  adminAuthReady: false,
  singleton: null,
  uninjected: 'NOT_STARTED',
  bd6: 'CLOSED',
  loginGo: {
    env: 'VERDICT_ADMIN_AUTH_GO=1',
    reasonEnv: 'VERDICT_ADMIN_AUTH_GO_REASON',
    requires: 'external captcha/400 clear — not an empty cache and not a retry',
  },
})

export function adminAuthGoReason() {
  return String(process.env.VERDICT_ADMIN_AUTH_GO_REASON ?? '').trim()
}

export function isAdminAuthGoArmed() {
  return process.env.VERDICT_ADMIN_AUTH_GO === '1' && adminAuthGoReason() !== ''
}

/**
 * May this process fire LoginDashboard?
 *
 * Cache already present → no. Empty cache without an external reason → no.
 * Calls already > 0 on this PID → no. GO+reason and calls === 0 → yes.
 */
export function loginDashboardDecision(cache) {
  const present = cache?.present === true
  const calls = Number(cache?.loginDashboardCalls ?? 0)
  const reason = adminAuthGoReason()
  const goArmed = isAdminAuthGoArmed()
  if (present) {
    return { allowed: false, code: 'CACHE_PRESENT', detail: 'cache already holds a token; do not login' }
  }
  if (calls > 0) {
    return {
      allowed: false,
      code: AUTH_FREEZE_CODE,
      detail: `LoginDashboardCalls=${calls}; the one shot on this PID is spent`,
    }
  }
  if (!goArmed) {
    return {
      allowed: false,
      code: AUTH_FREEZE_CODE,
      detail:
        'last signal was LoginDashboard resultCode=400; empty cache is not a captcha-clear. Set VERDICT_ADMIN_AUTH_GO=1 and VERDICT_ADMIN_AUTH_GO_REASON to the external evidence.',
    }
  }
  return { allowed: true, code: 'ADMIN_AUTH_GO', detail: reason }
}

export function writeAuthFreezeArtifact(extra = {}) {
  const outDir = join(REPO, 'docs/verdict/goals')
  mkdirSync(outDir, { recursive: true })
  const outPath = join(outDir, 'G90-10-admin-auth-freeze.json')
  const body = {
    ...FROZEN_AUTH_STATE,
    writtenAt: new Date().toISOString(),
    goArmed: isAdminAuthGoArmed(),
    goReasonPresent: adminAuthGoReason() !== '',
    ...extra,
  }
  writeFileSync(outPath, `${JSON.stringify(body, null, 2)}\n`)
  return { outPath, body }
}
