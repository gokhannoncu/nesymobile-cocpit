/**
 * Process-local admin credential for loopback fixture mutations.
 *
 * Cache only. This path must not call LoginDashboard and must not fall back
 * to NESY_BACKOFFICE_TOKEN — those would either increment the login counter
 * or use a credential that is not the RS dashboard user.
 *
 * The resolved back-office origin must be the configured stage target, same
 * fail-closed rule as fault-injection: a stage label pointing at prod is not
 * stage.
 */

import type { NesyCountry, NesyEnvironment } from '../nesy-env.js'
import { resolveFaultInjectionTarget } from './fault-injection-environment.js'
import {
  ADMIN_AUTH_NOT_READY,
  fingerprintAdminToken,
  getCachedDashboardAdminToken,
  peekDashboardAdminCache,
  type DashboardAdminCachePeek,
} from './nesy-admin-token.js'

export const TARGET_NOT_STAGE = 'TARGET_NOT_STAGE'

export type CachedStageAdminDecision =
  | {
      ok: true
      token: string
      tokenFingerprint: string
      baseUrl: string
      country: NesyCountry
      environment: 'stage'
      cache: DashboardAdminCachePeek
    }
  | {
      ok: false
      code: typeof ADMIN_AUTH_NOT_READY | typeof TARGET_NOT_STAGE
      message: string
      cache: DashboardAdminCachePeek
    }

export function resolveCachedStageAdminCredentials(
  country: NesyCountry,
  environment: NesyEnvironment,
  env: NodeJS.ProcessEnv = process.env,
): CachedStageAdminDecision {
  const cache = peekDashboardAdminCache(country, environment)
  if (environment !== 'stage') {
    return {
      ok: false,
      code: TARGET_NOT_STAGE,
      message: `admin fixture mutations are stage-only; got ${environment}`,
      cache,
    }
  }

  const target = resolveFaultInjectionTarget(env)
  if (!target.allowed || target.targetOrigin === null) {
    return {
      ok: false,
      code: TARGET_NOT_STAGE,
      message: `resolved back-office target is not stage: ${target.reason}`,
      cache,
    }
  }

  const token = getCachedDashboardAdminToken(country, environment)
  if (!token || !cache.present || cache.credentialSource !== 'dashboard-admin-cache') {
    return {
      ok: false,
      code: ADMIN_AUTH_NOT_READY,
      message: 'Dashboard admin token cache is empty. Warm /nesy/auth/login once on this PID first.',
      cache,
    }
  }

  return {
    ok: true,
    token,
    tokenFingerprint: fingerprintAdminToken(token),
    baseUrl: target.targetOrigin,
    country,
    environment: 'stage',
    cache,
  }
}
